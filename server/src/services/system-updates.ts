/**
 * System Update Manager service.
 * Persists per-organization update state, checks GitHub releases,
 * and runs guarded install/rollback workflows with step-level logging.
 */
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getAppInfo } from "../lib/app-info.js";

export type UpdateChannel = "stable" | "beta";
export type UpdateJobType = "INSTALL" | "ROLLBACK";
export type UpdateRunStatus = "QUEUED" | "RUNNING" | "FAILED" | "ROLLED_BACK" | "COMPLETED";
export type UpdateStepStatus = "PENDING" | "RUNNING" | "SUCCESS" | "FAILED" | "SKIPPED";

interface PersistedStore {
  organizations: Record<string, OrganizationUpdateStore>;
}

interface OrganizationUpdateStore {
  currentVersion: string;
  maintenanceMode: boolean;
  selectedChannel: UpdateChannel;
  latestRelease: SystemReleaseSummary | null;
  latestCheckedAt: string | null;
  activeJob: ActiveUpdateJob | null;
  history: UpdateRunRecord[];
  updatedAt: string;
}

interface ActiveUpdateJob {
  id: string;
  type: UpdateJobType;
  targetVersion: string;
  status: Extract<UpdateRunStatus, "QUEUED" | "RUNNING">;
  startedAt: string;
  requestedByUserId: string;
  requestedByEmail: string;
}

export interface SystemReleaseSummary {
  tagName: string;
  name: string;
  prerelease: boolean;
  publishedAt: string;
  htmlUrl: string;
  notes: string;
}

export interface UpdateStepRecord {
  id: string;
  key: string;
  label: string;
  status: UpdateStepStatus;
  command: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  message: string | null;
}

export interface UpdateRunRecord {
  id: string;
  type: UpdateJobType;
  requestedVersion: string;
  installedVersion: string | null;
  previousVersion: string | null;
  status: UpdateRunStatus;
  requestedByUserId: string;
  requestedByEmail: string;
  releaseNotes: string | null;
  startedAt: string;
  finishedAt: string | null;
  failureStep: string | null;
  failureMessage: string | null;
  rollbackAttempted: boolean;
  rollbackSucceeded: boolean;
  steps: UpdateStepRecord[];
  logs: string[];
}

export interface SystemUpdateStatusResponse {
  currentVersion: string;
  maintenanceMode: boolean;
  selectedChannel: UpdateChannel;
  latestRelease: SystemReleaseSummary | null;
  latestCheckedAt: string | null;
  updateConfigured: boolean;
  executionEnabled: boolean;
  activeJob: ActiveUpdateJob | null;
  lastRun: UpdateRunRecord | null;
  backupStatus: UpdateStepStatus | null;
  migrationStatus: UpdateStepStatus | null;
  smokeStatus: UpdateStepStatus | null;
}

export interface ListReleasesResult {
  channel: UpdateChannel;
  releases: SystemReleaseSummary[];
  latestRelease: SystemReleaseSummary | null;
  checkedAt: string;
  sourceConfigured: boolean;
}

interface RequestActor {
  userId: string;
  email: string;
}

interface CommandTemplates {
  backup: string;
  download: string;
  install: string;
  build: string;
  migrate: string;
  restart: string;
  smoke: string;
  rollback: string;
}

interface UpdateConfig {
  executionEnabled: boolean;
  releaseSourceConfigured: boolean;
  githubRepo: string;
  githubToken: string;
  defaultChannel: UpdateChannel;
  commandCwd: string;
  commands: CommandTemplates;
}

interface RunStepDefinition {
  key: string;
  label: string;
  commandKey: keyof CommandTemplates;
  allowSkip?: boolean;
}

const STORE_DIR = path.resolve(process.cwd(), "server", ".data");
const STORE_FILE = path.join(STORE_DIR, "system-updates-store.json");
const MAX_HISTORY = 50;
const MAX_LOG_LINES = 500;

let storeCache: PersistedStore | null = null;
let writeQueue: Promise<void> = Promise.resolve();

function nowIso(): string {
  return new Date().toISOString();
}

function csvSet(value: string): Set<string> {
  return new Set(
    value
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  );
}

function sanitizeLogLine(line: string): string {
  return line.replace(/\s+/g, " ").trim().slice(0, 1000);
}

function parseBool(value: string | undefined, fallback = false): boolean {
  if (typeof value !== "string") return fallback;
  return /^(1|true|yes|on)$/i.test(value.trim());
}

function parseChannel(raw: string | undefined): UpdateChannel {
  return raw === "beta" ? "beta" : "stable";
}

function parseVersionParts(tag: string): { major: number; minor: number; patch: number; preRelease: string | null } | null {
  const normalized = tag.trim().replace(/^v/i, "");
  const match = normalized.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: Number.parseInt(match[1], 10),
    minor: Number.parseInt(match[2], 10),
    patch: Number.parseInt(match[3], 10),
    preRelease: match[4] ?? null,
  };
}

function compareSemverTags(a: string, b: string): number {
  const pa = parseVersionParts(a);
  const pb = parseVersionParts(b);
  if (!pa && !pb) return a.localeCompare(b);
  if (!pa) return -1;
  if (!pb) return 1;

  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  if (pa.patch !== pb.patch) return pa.patch - pb.patch;

  if (pa.preRelease && !pb.preRelease) return -1;
  if (!pa.preRelease && pb.preRelease) return 1;
  if (!pa.preRelease && !pb.preRelease) return 0;
  return String(pa.preRelease).localeCompare(String(pb.preRelease));
}

function isValidVersionTag(tag: string): boolean {
  return /^v\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(tag.trim());
}

function createDefaultOrgStore(): OrganizationUpdateStore {
  return {
    currentVersion: getAppInfo().version,
    maintenanceMode: false,
    selectedChannel: parseChannel(process.env.SYSTEM_UPDATE_DEFAULT_CHANNEL),
    latestRelease: null,
    latestCheckedAt: null,
    activeJob: null,
    history: [],
    updatedAt: nowIso(),
  };
}

function ensureOrgStore(store: PersistedStore, organizationId: string): OrganizationUpdateStore {
  const existing = store.organizations[organizationId];
  if (existing) {
    if (!existing.currentVersion) existing.currentVersion = getAppInfo().version;
    if (!existing.selectedChannel) existing.selectedChannel = parseChannel(process.env.SYSTEM_UPDATE_DEFAULT_CHANNEL);
    if (!Array.isArray(existing.history)) existing.history = [];
    return existing;
  }

  const created = createDefaultOrgStore();
  store.organizations[organizationId] = created;
  return created;
}

async function loadStore(): Promise<PersistedStore> {
  if (storeCache) return storeCache;

  try {
    const raw = await readFile(STORE_FILE, "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "organizations" in parsed) {
      const organizations = (parsed as { organizations?: Record<string, OrganizationUpdateStore> }).organizations;
      storeCache = { organizations: organizations && typeof organizations === "object" ? organizations : {} };
    } else {
      storeCache = { organizations: {} };
    }
  } catch {
    storeCache = { organizations: {} };
  }

  return storeCache;
}

async function persistStore(store: PersistedStore): Promise<void> {
  storeCache = store;
  writeQueue = writeQueue.then(async () => {
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(STORE_FILE, JSON.stringify(store, null, 2), "utf8");
  });
  await writeQueue;
}

async function updateOrgStore<T>(organizationId: string, updater: (orgStore: OrganizationUpdateStore) => T): Promise<T> {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, organizationId);
  const result = updater(orgStore);
  orgStore.updatedAt = nowIso();
  await persistStore(store);
  return result;
}

async function readOrgStore<T>(organizationId: string, reader: (orgStore: OrganizationUpdateStore) => T): Promise<T> {
  const store = await loadStore();
  const orgStore = ensureOrgStore(store, organizationId);
  return reader(orgStore);
}

function getUpdateConfig(): UpdateConfig {
  const githubRepo = String(process.env.SYSTEM_UPDATE_GITHUB_REPO ?? "").trim();
  const githubToken = String(process.env.SYSTEM_UPDATE_GITHUB_TOKEN ?? "").trim();

  return {
    executionEnabled: parseBool(process.env.SYSTEM_UPDATE_EXECUTION_ENABLED, false),
    releaseSourceConfigured: Boolean(githubRepo),
    githubRepo,
    githubToken,
    defaultChannel: parseChannel(process.env.SYSTEM_UPDATE_DEFAULT_CHANNEL),
    commandCwd: String(process.env.SYSTEM_UPDATE_COMMAND_CWD ?? process.cwd()).trim() || process.cwd(),
    commands: {
      backup: String(process.env.SYSTEM_UPDATE_BACKUP_COMMAND ?? "").trim(),
      download: String(process.env.SYSTEM_UPDATE_DOWNLOAD_COMMAND ?? "").trim(),
      install: String(process.env.SYSTEM_UPDATE_INSTALL_COMMAND ?? "pnpm install --frozen-lockfile").trim(),
      build: String(process.env.SYSTEM_UPDATE_BUILD_COMMAND ?? "pnpm build && pnpm build:server").trim(),
      migrate: String(process.env.SYSTEM_UPDATE_MIGRATE_COMMAND ?? "pnpm db:migrate").trim(),
      restart: String(process.env.SYSTEM_UPDATE_RESTART_COMMAND ?? "pnpm pm2:restart -- --env production --update-env").trim(),
      smoke: String(process.env.SYSTEM_UPDATE_SMOKE_COMMAND ?? "pnpm test:smoke").trim(),
      rollback: String(process.env.SYSTEM_UPDATE_ROLLBACK_COMMAND ?? "").trim(),
    },
  };
}

function templateCommand(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((acc, [key, value]) => acc.split(`{${key}}`).join(value), template);
}

async function runShellCommand(command: string, cwd: string, onLine: (line: string) => Promise<void>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, {
      cwd,
      shell: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });

    const streamHandler = (chunk: Buffer) => {
      const lines = chunk
        .toString("utf8")
        .split(/\r?\n/)
        .map((line) => sanitizeLogLine(line))
        .filter(Boolean);

      void Promise.all(lines.map((line) => onLine(line)));
    };

    child.stdout.on("data", streamHandler);
    child.stderr.on("data", streamHandler);

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`Command exited with code ${code ?? "unknown"}`));
    });
  });
}

function findStep(record: UpdateRunRecord, stepKey: string): UpdateStepRecord | null {
  return record.steps.find((step) => step.key === stepKey) ?? null;
}

async function appendLog(organizationId: string, runId: string, line: string): Promise<void> {
  await updateOrgStore(organizationId, (orgStore) => {
    const run = orgStore.history.find((item) => item.id === runId);
    if (!run) return;
    run.logs.push(`[${nowIso()}] ${line}`);
    if (run.logs.length > MAX_LOG_LINES) {
      run.logs = run.logs.slice(run.logs.length - MAX_LOG_LINES);
    }
  });
}

async function setRunStepState(
  organizationId: string,
  runId: string,
  stepKey: string,
  patch: Partial<UpdateStepRecord>,
): Promise<void> {
  await updateOrgStore(organizationId, (orgStore) => {
    const run = orgStore.history.find((item) => item.id === runId);
    if (!run) return;
    const step = findStep(run, stepKey);
    if (!step) return;
    Object.assign(step, patch);
  });
}

async function setRunState(
  organizationId: string,
  runId: string,
  patch: Partial<UpdateRunRecord>,
): Promise<void> {
  await updateOrgStore(organizationId, (orgStore) => {
    const run = orgStore.history.find((item) => item.id === runId);
    if (!run) return;
    Object.assign(run, patch);
  });
}

async function setActiveJob(
  organizationId: string,
  job: ActiveUpdateJob | null,
): Promise<void> {
  await updateOrgStore(organizationId, (orgStore) => {
    orgStore.activeJob = job;
  });
}

function latestBySemver(releases: SystemReleaseSummary[]): SystemReleaseSummary | null {
  if (releases.length === 0) return null;
  return [...releases].sort((a, b) => compareSemverTags(b.tagName, a.tagName))[0] ?? null;
}

async function fetchGithubReleases(channel: UpdateChannel): Promise<ListReleasesResult> {
  const config = getUpdateConfig();
  const checkedAt = nowIso();

  if (!config.releaseSourceConfigured) {
    return {
      channel,
      releases: [],
      latestRelease: null,
      checkedAt,
      sourceConfigured: false,
    };
  }

  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "OyamaCRM-System-Updates",
  };

  if (config.githubToken) {
    headers.Authorization = `Bearer ${config.githubToken}`;
  }

  const response = await fetch(`https://api.github.com/repos/${config.githubRepo}/releases?per_page=25`, {
    method: "GET",
    headers,
  });

  if (!response.ok) {
    throw new Error(`GitHub release check failed (${response.status})`);
  }

  const payload = await response.json() as unknown;
  const items = Array.isArray(payload) ? payload : [];

  const releases: SystemReleaseSummary[] = items
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const entry = item as Record<string, unknown>;
      const tagName = String(entry.tag_name ?? "").trim();
      if (!isValidVersionTag(tagName)) return null;

      const prerelease = Boolean(entry.prerelease);
      if (channel === "stable" && prerelease) return null;

      return {
        tagName,
        name: String(entry.name ?? tagName),
        prerelease,
        publishedAt: String(entry.published_at ?? ""),
        htmlUrl: String(entry.html_url ?? ""),
        notes: String(entry.body ?? ""),
      } satisfies SystemReleaseSummary;
    })
    .filter((value): value is SystemReleaseSummary => value !== null)
    .sort((a, b) => compareSemverTags(b.tagName, a.tagName));

  return {
    channel,
    releases,
    latestRelease: releases[0] ?? null,
    checkedAt,
    sourceConfigured: true,
  };
}

async function refreshReleasesForOrg(organizationId: string, channel: UpdateChannel): Promise<ListReleasesResult> {
  const result = await fetchGithubReleases(channel);
  await updateOrgStore(organizationId, (orgStore) => {
    orgStore.selectedChannel = channel;
    orgStore.latestCheckedAt = result.checkedAt;
    orgStore.latestRelease = result.latestRelease;
  });
  return result;
}

async function runNamedStep(
  organizationId: string,
  runId: string,
  targetVersion: string,
  previousVersion: string,
  definition: RunStepDefinition,
  options: { dryRun: boolean; config: UpdateConfig },
): Promise<void> {
  const { dryRun, config } = options;
  const template = config.commands[definition.commandKey];

  if (!template && dryRun) {
    await setRunStepState(organizationId, runId, definition.key, {
      status: "SUCCESS",
      startedAt: nowIso(),
      finishedAt: nowIso(),
      message: "Dry-run completed with no configured command.",
      command: null,
    });
    await appendLog(organizationId, runId, `${definition.label}: dry-run success (no command configured)`);
    return;
  }

  if (!template && definition.allowSkip) {
    await setRunStepState(organizationId, runId, definition.key, {
      status: "SKIPPED",
      startedAt: nowIso(),
      finishedAt: nowIso(),
      message: "Step skipped because no command is configured.",
      command: null,
    });
    await appendLog(organizationId, runId, `${definition.label}: skipped (no command configured)`);
    return;
  }

  if (!template) {
    throw new Error(`${definition.label} command is not configured.`);
  }

  const command = templateCommand(template, {
    version: targetVersion,
    targetVersion,
    previousVersion,
  });

  await setRunStepState(organizationId, runId, definition.key, {
    status: "RUNNING",
    startedAt: nowIso(),
    command,
    message: null,
  });
  await appendLog(organizationId, runId, `${definition.label}: started`);

  if (dryRun) {
    await appendLog(organizationId, runId, `${definition.label}: dry-run mode active, command not executed: ${command}`);
    await setRunStepState(organizationId, runId, definition.key, {
      status: "SUCCESS",
      finishedAt: nowIso(),
      message: "Dry-run completed.",
    });
    return;
  }

  await runShellCommand(command, config.commandCwd, async (line) => {
    await appendLog(organizationId, runId, `[${definition.key}] ${line}`);
  });

  await setRunStepState(organizationId, runId, definition.key, {
    status: "SUCCESS",
    finishedAt: nowIso(),
    message: "Completed.",
  });
  await appendLog(organizationId, runId, `${definition.label}: completed`);
}

async function markFailure(
  organizationId: string,
  runId: string,
  stepKey: string,
  error: unknown,
): Promise<void> {
  const message = error instanceof Error ? error.message : "Unknown error";
  await setRunStepState(organizationId, runId, stepKey, {
    status: "FAILED",
    finishedAt: nowIso(),
    message,
  });
  await setRunState(organizationId, runId, {
    status: "FAILED",
    failureStep: stepKey,
    failureMessage: message,
    finishedAt: nowIso(),
  });
  await appendLog(organizationId, runId, `${stepKey}: failed - ${message}`);
}

async function executeRollbackFromFailure(
  organizationId: string,
  runId: string,
  targetVersion: string,
  previousVersion: string,
): Promise<boolean> {
  const config = getUpdateConfig();
  const dryRun = !config.executionEnabled;

  await setRunState(organizationId, runId, {
    rollbackAttempted: true,
  });

  try {
    await runNamedStep(
      organizationId,
      runId,
      targetVersion,
      previousVersion,
      {
        key: "rollback_restore",
        label: "Restore previous release",
        commandKey: "rollback",
      },
      { dryRun, config },
    );

    await runNamedStep(
      organizationId,
      runId,
      targetVersion,
      previousVersion,
      {
        key: "rollback_restart",
        label: "Restart services after rollback",
        commandKey: "restart",
      },
      { dryRun, config },
    );

    await runNamedStep(
      organizationId,
      runId,
      targetVersion,
      previousVersion,
      {
        key: "rollback_smoke",
        label: "Run rollback smoke tests",
        commandKey: "smoke",
      },
      { dryRun, config },
    );

    await setRunState(organizationId, runId, {
      status: "ROLLED_BACK",
      rollbackSucceeded: true,
      finishedAt: nowIso(),
    });

    await updateOrgStore(organizationId, (orgStore) => {
      orgStore.currentVersion = previousVersion;
    });

    await appendLog(organizationId, runId, "Rollback completed successfully.");
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown rollback failure";
    await appendLog(organizationId, runId, `Rollback failed: ${message}`);
    await setRunState(organizationId, runId, {
      rollbackSucceeded: false,
      failureMessage: message,
      finishedAt: nowIso(),
    });
    return false;
  }
}

async function runInstallJob(
  organizationId: string,
  runId: string,
  actor: RequestActor,
  targetVersion: string,
  releaseNotes: string | null,
): Promise<void> {
  const config = getUpdateConfig();
  const dryRun = !config.executionEnabled;

  const installSteps: RunStepDefinition[] = [
    { key: "maintenance_on", label: "Enable maintenance mode", commandKey: "backup", allowSkip: true },
    { key: "backup", label: "Create backups", commandKey: "backup" },
    { key: "download", label: "Download approved release", commandKey: "download" },
    { key: "install", label: "Install dependencies", commandKey: "install" },
    { key: "build", label: "Build web and API", commandKey: "build" },
    { key: "migrate", label: "Run database migrations", commandKey: "migrate" },
    { key: "restart", label: "Restart application", commandKey: "restart" },
    { key: "smoke", label: "Run smoke test", commandKey: "smoke" },
  ];

  const previousVersion = (await getSystemUpdateStatus({ organizationId })).currentVersion;

  await setRunState(organizationId, runId, {
    status: "RUNNING",
    previousVersion,
    releaseNotes,
  });

  await setActiveJob(organizationId, {
    id: runId,
    type: "INSTALL",
    targetVersion,
    status: "RUNNING",
    startedAt: nowIso(),
    requestedByUserId: actor.userId,
    requestedByEmail: actor.email,
  });

  await updateOrgStore(organizationId, (orgStore) => {
    orgStore.maintenanceMode = true;
  });

  for (const step of installSteps) {
    if (step.key === "maintenance_on") {
      await setRunStepState(organizationId, runId, step.key, {
        status: "SUCCESS",
        startedAt: nowIso(),
        finishedAt: nowIso(),
        message: "Maintenance mode enabled.",
        command: null,
      });
      await appendLog(organizationId, runId, "Maintenance mode enabled.");
      continue;
    }

    try {
      await runNamedStep(organizationId, runId, targetVersion, previousVersion, step, { dryRun, config });
    } catch (error) {
      await markFailure(organizationId, runId, step.key, error);
      await executeRollbackFromFailure(organizationId, runId, targetVersion, previousVersion);
      await updateOrgStore(organizationId, (orgStore) => {
        orgStore.maintenanceMode = false;
      });
      await setActiveJob(organizationId, null);
      return;
    }
  }

  await updateOrgStore(organizationId, (orgStore) => {
    orgStore.currentVersion = targetVersion;
    orgStore.maintenanceMode = false;
  });

  await setRunState(organizationId, runId, {
    status: "COMPLETED",
    installedVersion: targetVersion,
    finishedAt: nowIso(),
    failureMessage: null,
    failureStep: null,
  });

  await appendLog(organizationId, runId, `Install completed successfully: ${targetVersion}`);
  await setActiveJob(organizationId, null);
}

async function runRollbackJob(
  organizationId: string,
  runId: string,
  actor: RequestActor,
  targetVersion: string,
): Promise<void> {
  const config = getUpdateConfig();
  const dryRun = !config.executionEnabled;
  const previousVersion = (await getSystemUpdateStatus({ organizationId })).currentVersion;

  await setRunState(organizationId, runId, {
    status: "RUNNING",
    previousVersion,
  });

  await setActiveJob(organizationId, {
    id: runId,
    type: "ROLLBACK",
    targetVersion,
    status: "RUNNING",
    startedAt: nowIso(),
    requestedByUserId: actor.userId,
    requestedByEmail: actor.email,
  });

  await updateOrgStore(organizationId, (orgStore) => {
    orgStore.maintenanceMode = true;
  });

  const rollbackSteps: RunStepDefinition[] = [
    { key: "rollback_restore", label: "Restore selected release", commandKey: "rollback" },
    { key: "rollback_restart", label: "Restart application", commandKey: "restart" },
    { key: "rollback_smoke", label: "Run smoke test", commandKey: "smoke" },
  ];

  for (const step of rollbackSteps) {
    try {
      await runNamedStep(organizationId, runId, targetVersion, previousVersion, step, { dryRun, config });
    } catch (error) {
      await markFailure(organizationId, runId, step.key, error);
      await updateOrgStore(organizationId, (orgStore) => {
        orgStore.maintenanceMode = false;
      });
      await setActiveJob(organizationId, null);
      return;
    }
  }

  await updateOrgStore(organizationId, (orgStore) => {
    orgStore.currentVersion = targetVersion;
    orgStore.maintenanceMode = false;
  });

  await setRunState(organizationId, runId, {
    status: "COMPLETED",
    installedVersion: targetVersion,
    finishedAt: nowIso(),
  });

  await appendLog(organizationId, runId, `Rollback completed successfully: ${targetVersion}`);
  await setActiveJob(organizationId, null);
}

function makeRunRecord(input: {
  type: UpdateJobType;
  requestedVersion: string;
  actor: RequestActor;
}): UpdateRunRecord {
  const defaultSteps = input.type === "INSTALL"
    ? [
        { key: "maintenance_on", label: "Enable maintenance mode" },
        { key: "backup", label: "Create backups" },
        { key: "download", label: "Download approved release" },
        { key: "install", label: "Install dependencies" },
        { key: "build", label: "Build web and API" },
        { key: "migrate", label: "Run database migrations" },
        { key: "restart", label: "Restart application" },
        { key: "smoke", label: "Run smoke test" },
        { key: "rollback_restore", label: "Restore previous release" },
        { key: "rollback_restart", label: "Restart services after rollback" },
        { key: "rollback_smoke", label: "Run rollback smoke tests" },
      ]
    : [
        { key: "rollback_restore", label: "Restore selected release" },
        { key: "rollback_restart", label: "Restart application" },
        { key: "rollback_smoke", label: "Run smoke test" },
      ];

  return {
    id: randomUUID(),
    type: input.type,
    requestedVersion: input.requestedVersion,
    installedVersion: null,
    previousVersion: null,
    status: "QUEUED",
    requestedByUserId: input.actor.userId,
    requestedByEmail: input.actor.email,
    releaseNotes: null,
    startedAt: nowIso(),
    finishedAt: null,
    failureStep: null,
    failureMessage: null,
    rollbackAttempted: false,
    rollbackSucceeded: false,
    steps: defaultSteps.map((item) => ({
      id: randomUUID(),
      key: item.key,
      label: item.label,
      status: "PENDING",
      command: null,
      startedAt: null,
      finishedAt: null,
      message: null,
    })),
    logs: [],
  };
}

export async function getSystemUpdateStatus(opts: { organizationId: string }): Promise<SystemUpdateStatusResponse> {
  const config = getUpdateConfig();
  const orgStore = await readOrgStore(opts.organizationId, (state) => state);

  const lastRun = orgStore.history[0] ?? null;
  const backupStatus = lastRun?.steps.find((step) => step.key === "backup")?.status ?? null;
  const migrationStatus = lastRun?.steps.find((step) => step.key === "migrate")?.status ?? null;
  const smokeStatus = lastRun?.steps.find((step) => step.key === "smoke" || step.key === "rollback_smoke")?.status ?? null;

  return {
    currentVersion: orgStore.currentVersion,
    maintenanceMode: orgStore.maintenanceMode,
    selectedChannel: orgStore.selectedChannel,
    latestRelease: orgStore.latestRelease,
    latestCheckedAt: orgStore.latestCheckedAt,
    updateConfigured: config.releaseSourceConfigured,
    executionEnabled: config.executionEnabled,
    activeJob: orgStore.activeJob,
    lastRun,
    backupStatus,
    migrationStatus,
    smokeStatus,
  };
}

export async function listSystemUpdateHistory(opts: { organizationId: string; limit?: number }): Promise<UpdateRunRecord[]> {
  const historyLimit = Math.min(Math.max(opts.limit ?? 20, 1), MAX_HISTORY);
  const orgStore = await readOrgStore(opts.organizationId, (state) => state);
  return orgStore.history.slice(0, historyLimit);
}

export async function listSystemUpdateReleases(opts: {
  organizationId: string;
  channel?: UpdateChannel;
  refresh?: boolean;
}): Promise<ListReleasesResult> {
  const orgStore = await readOrgStore(opts.organizationId, (state) => state);
  const channel = opts.channel ?? orgStore.selectedChannel;

  if (!opts.refresh && orgStore.latestCheckedAt && orgStore.latestRelease) {
    return {
      channel,
      releases: orgStore.latestRelease ? [orgStore.latestRelease] : [],
      latestRelease: orgStore.latestRelease,
      checkedAt: orgStore.latestCheckedAt,
      sourceConfigured: getUpdateConfig().releaseSourceConfigured,
    };
  }

  return refreshReleasesForOrg(opts.organizationId, channel);
}

export async function requestSystemUpdateInstall(opts: {
  organizationId: string;
  actor: RequestActor;
  requestedVersion?: string;
  channel?: UpdateChannel;
}): Promise<{ runId: string; requestedVersion: string }> {
  const status = await getSystemUpdateStatus({ organizationId: opts.organizationId });
  if (status.activeJob) {
    throw new Error("Another update job is already running.");
  }

  const channel = opts.channel ?? status.selectedChannel;
  let requestedVersion = opts.requestedVersion?.trim() ?? "";
  let releaseNotes: string | null = null;

  if (!requestedVersion) {
    const releases = await refreshReleasesForOrg(opts.organizationId, channel);
    if (!releases.latestRelease) {
      throw new Error("No release available for the selected channel.");
    }
    requestedVersion = releases.latestRelease.tagName;
    releaseNotes = releases.latestRelease.notes;
  }

  if (!isValidVersionTag(requestedVersion)) {
    throw new Error("Requested version is invalid. Use a tag like v1.2.3.");
  }

  const run = makeRunRecord({
    type: "INSTALL",
    requestedVersion,
    actor: opts.actor,
  });

  await updateOrgStore(opts.organizationId, (orgStore) => {
    orgStore.history.unshift(run);
    orgStore.history = orgStore.history.slice(0, MAX_HISTORY);
    orgStore.activeJob = {
      id: run.id,
      type: "INSTALL",
      targetVersion: requestedVersion,
      status: "QUEUED",
      startedAt: run.startedAt,
      requestedByUserId: opts.actor.userId,
      requestedByEmail: opts.actor.email,
    };
  });

  void runInstallJob(opts.organizationId, run.id, opts.actor, requestedVersion, releaseNotes).catch(async (error) => {
    const message = error instanceof Error ? error.message : "Unknown update failure";
    await setRunState(opts.organizationId, run.id, {
      status: "FAILED",
      failureMessage: message,
      finishedAt: nowIso(),
    });
    await updateOrgStore(opts.organizationId, (orgStore) => {
      orgStore.maintenanceMode = false;
      orgStore.activeJob = null;
    });
  });

  return { runId: run.id, requestedVersion };
}

export async function requestSystemUpdateRollback(opts: {
  organizationId: string;
  actor: RequestActor;
  requestedVersion?: string;
}): Promise<{ runId: string; requestedVersion: string }> {
  const status = await getSystemUpdateStatus({ organizationId: opts.organizationId });
  if (status.activeJob) {
    throw new Error("Another update job is already running.");
  }

  let requestedVersion = opts.requestedVersion?.trim() ?? "";
  if (!requestedVersion) {
    const history = await listSystemUpdateHistory({ organizationId: opts.organizationId, limit: 30 });
    const candidate = history.find((item) => item.previousVersion && (item.status === "FAILED" || item.status === "ROLLED_BACK"));
    requestedVersion = candidate?.previousVersion ?? "";
  }

  if (!requestedVersion) {
    throw new Error("No rollback target found. Provide an explicit version.");
  }

  if (!isValidVersionTag(requestedVersion)) {
    throw new Error("Rollback target is invalid. Use a tag like v1.2.3.");
  }

  const run = makeRunRecord({
    type: "ROLLBACK",
    requestedVersion,
    actor: opts.actor,
  });

  await updateOrgStore(opts.organizationId, (orgStore) => {
    orgStore.history.unshift(run);
    orgStore.history = orgStore.history.slice(0, MAX_HISTORY);
    orgStore.activeJob = {
      id: run.id,
      type: "ROLLBACK",
      targetVersion: requestedVersion,
      status: "QUEUED",
      startedAt: run.startedAt,
      requestedByUserId: opts.actor.userId,
      requestedByEmail: opts.actor.email,
    };
  });

  void runRollbackJob(opts.organizationId, run.id, opts.actor, requestedVersion).catch(async (error) => {
    const message = error instanceof Error ? error.message : "Unknown rollback failure";
    await setRunState(opts.organizationId, run.id, {
      status: "FAILED",
      failureMessage: message,
      finishedAt: nowIso(),
    });
    await updateOrgStore(opts.organizationId, (orgStore) => {
      orgStore.maintenanceMode = false;
      orgStore.activeJob = null;
    });
  });

  return { runId: run.id, requestedVersion };
}

export async function setSystemMaintenanceMode(opts: {
  organizationId: string;
  enabled: boolean;
}): Promise<void> {
  await updateOrgStore(opts.organizationId, (orgStore) => {
    orgStore.maintenanceMode = opts.enabled;
  });
}

export function getConfiguredSuperAdminEmails(): Set<string> {
  return csvSet(String(process.env.SYSTEM_UPDATE_SUPER_ADMIN_EMAILS ?? ""));
}
