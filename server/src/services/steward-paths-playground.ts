/**
 * Steward Paths Playground sandbox engine.
 *
 * Design constraints:
 * - In-memory state only (ephemeral, per-process)
 * - No database writes
 * - No outbound email sends
 * - Explicit sandbox metadata in every response
 */
import { randomUUID } from "crypto";

export type PlaygroundStepResult = "passed" | "skipped" | "branched" | "blocked" | "failed";
export type PlaygroundStepStatus = "pending" | "running" | PlaygroundStepResult;
export type PlaygroundRunStatus = "ready" | "running" | "paused" | "completed";
export type PlaygroundActivityLevel = "info" | "warn" | "error";

export interface PlaygroundTemplateStep {
  id: string;
  orderIndex: number;
  name: string;
  stepType: string;
  configJson: unknown;
}

export interface PlaygroundConstituentSnapshot {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  donorStatus: string;
  totalLifetimeGiving: unknown;
  lastGiftAmount: unknown;
  lastGiftDate: Date | string | null;
  engagementScore: number | null;
  doNotEmail: boolean;
  doNotMail: boolean;
  doNotContact: boolean;
}

export interface PlaygroundDonorProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  donorStatus: string;
  totalLifetimeGiving: number;
  lastGiftAmount: number;
  lastGiftDateIso: string | null;
  engagementScore: number;
  doNotEmail: boolean;
  doNotMail: boolean;
  doNotContact: boolean;
}

export interface PlaygroundScenario {
  id: string;
  name: string;
  description: string;
  donorProfile: PlaygroundDonorProfile;
  seededEvents: Array<{
    id: string;
    type: string;
    label: string;
    occurredAt: string;
  }>;
}

export interface PlaygroundStepPreview {
  type: "email" | "letter" | "task" | "timing" | "condition" | "action";
  description: string;
  subject?: string;
  fromEmail?: string;
  templateName?: string;
  taskTitle?: string;
  taskPriority?: string;
  waitAmount?: number;
  waitUnit?: string;
}

export interface PlaygroundRunStep {
  stepId: string;
  label: string;
  stepType: string;
  orderIndex: number;
  status: PlaygroundStepStatus;
  result: PlaygroundStepResult | null;
  plannedResult: PlaygroundStepResult;
  blockReason?: string;
  preview: PlaygroundStepPreview;
  executedAt: string | null;
}

export interface PlaygroundRunSummary {
  totalSteps: number;
  completedSteps: number;
  passed: number;
  skipped: number;
  branched: number;
  blocked: number;
  failed: number;
  emailsSimulated: number;
  lettersSimulated: number;
  tasksSimulated: number;
  overall: "pass" | "warn" | "fail";
}

export interface PlaygroundActivityItem {
  id: string;
  at: string;
  type: string;
  level: PlaygroundActivityLevel;
  message: string;
  metadata?: Record<string, unknown>;
}

export interface PlaygroundRunSnapshot {
  runId: string;
  pathId: string;
  pathName: string;
  status: PlaygroundRunStatus;
  isSandbox: true;
  createdAt: string;
  updatedAt: string;
  scenario: PlaygroundScenario;
  sourceConstituent: {
    id: string;
    name: string;
    email: string | null;
    source: "real" | "synthetic";
  };
  options: {
    skipDelays: boolean;
    testEmail: string | null;
  };
  cursor: number;
  steps: PlaygroundRunStep[];
  summary: PlaygroundRunSummary;
  activity: PlaygroundActivityItem[];
}

export interface SandboxEmailPreviewItem {
  stepId: string;
  label: string;
  toEmail: string;
  subject: string;
  body: string;
  status: "queued" | "skipped";
  reason?: string;
}

export interface SandboxEmailPreviewResult {
  isSandbox: true;
  analyticsTracked: false;
  runId: string;
  toEmail: string;
  message: string;
  sentCount: number;
  skippedCount: number;
  items: SandboxEmailPreviewItem[];
}

interface PlaygroundRunRecord {
  runId: string;
  organizationId: string;
  pathId: string;
  pathName: string;
  status: PlaygroundRunStatus;
  isSandbox: true;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  scenario: PlaygroundScenario;
  sourceConstituent: {
    id: string;
    name: string;
    email: string | null;
    source: "real" | "synthetic";
  };
  options: {
    skipDelays: boolean;
    testEmail: string | null;
  };
  cursor: number;
  steps: PlaygroundRunStep[];
  summary: PlaygroundRunSummary;
  activity: PlaygroundActivityItem[];
}

const RUN_TTL_MS = 6 * 60 * 60 * 1000;
const runStore = new Map<string, PlaygroundRunRecord>();

/** Returns an ISO timestamp for now. */
function nowIso(): string {
  return new Date().toISOString();
}

/** Converts unknown JSON-ish input to a plain object. */
function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Converts unknown to number with a fallback. */
function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof value === "object" && value && "toString" in value) {
    const parsed = Number((value as { toString: () => string }).toString());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Builds one display-safe full name. */
function displayName(firstName: string, lastName: string): string {
  const joined = `${firstName} ${lastName}`.trim();
  return joined || "Sandbox Donor";
}

/** Normalizes email and returns null when empty. */
function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return normalized || null;
}

/** Basic email format check. */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/** Trims expired in-memory runs to keep store bounded. */
function pruneExpiredRuns(): void {
  const now = Date.now();
  for (const [runId, record] of runStore.entries()) {
    const age = now - new Date(record.updatedAt).getTime();
    if (Number.isFinite(age) && age > RUN_TTL_MS) {
      runStore.delete(runId);
    }
  }
}

/** Deep clone helper for plain JSON-compatible values. */
function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/** Builds one deterministic activity entry. */
function buildActivity(params: {
  type: string;
  level: PlaygroundActivityLevel;
  message: string;
  metadata?: Record<string, unknown>;
}): PlaygroundActivityItem {
  return {
    id: `pga_${randomUUID()}`,
    at: nowIso(),
    type: params.type,
    level: params.level,
    message: params.message,
    metadata: params.metadata,
  };
}

/** Produces a baseline donor profile from constituent input when available. */
function baseDonorProfile(constituent?: PlaygroundConstituentSnapshot | null): PlaygroundDonorProfile {
  const firstName = constituent?.firstName?.trim() || "Sandbox";
  const lastName = constituent?.lastName?.trim() || "Donor";
  const lastGiftDate = constituent?.lastGiftDate
    ? new Date(constituent.lastGiftDate).toISOString()
    : null;

  return {
    id: constituent?.id || `sandbox_${randomUUID().slice(0, 8)}`,
    firstName,
    lastName,
    email: constituent?.email || null,
    donorStatus: constituent?.donorStatus || "ACTIVE",
    totalLifetimeGiving: toNumber(constituent?.totalLifetimeGiving, 2500),
    lastGiftAmount: toNumber(constituent?.lastGiftAmount, 150),
    lastGiftDateIso: lastGiftDate,
    engagementScore: toNumber(constituent?.engagementScore, 64),
    doNotEmail: constituent?.doNotEmail === true,
    doNotMail: constituent?.doNotMail === true,
    doNotContact: constituent?.doNotContact === true,
  };
}

/** Returns canned sandbox scenarios for playback validation. */
export function buildPlaygroundScenarios(constituent?: PlaygroundConstituentSnapshot | null): PlaygroundScenario[] {
  const now = Date.now();
  const base = baseDonorProfile(constituent);

  return [
    {
      id: "baseline",
      name: "Baseline Healthy Donor",
      description: "Happy-path donor with no communication restrictions.",
      donorProfile: {
        ...base,
        donorStatus: "ACTIVE",
        engagementScore: Math.max(base.engagementScore, 70),
        doNotEmail: false,
        doNotMail: false,
        doNotContact: false,
      },
      seededEvents: [
        {
          id: "evt_baseline_donation",
          type: "DONATION_RECEIVED",
          label: "Recent donation received",
          occurredAt: new Date(now - 2 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
    {
      id: "major-donor-retention",
      name: "Major Donor Retention",
      description: "High-value donor profile to validate premium stewardship lanes.",
      donorProfile: {
        ...base,
        donorStatus: "MAJOR_DONOR",
        totalLifetimeGiving: Math.max(base.totalLifetimeGiving, 50000),
        lastGiftAmount: Math.max(base.lastGiftAmount, 5000),
        engagementScore: Math.max(base.engagementScore, 82),
        doNotEmail: false,
        doNotMail: false,
        doNotContact: false,
      },
      seededEvents: [
        {
          id: "evt_major_gift",
          type: "MAJOR_GIFT",
          label: "Major gift posted",
          occurredAt: new Date(now - 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
    {
      id: "lapsed-donor-revival",
      name: "Lapsed Donor Revival",
      description: "Low-engagement lapsed donor to test reactivation branches.",
      donorProfile: {
        ...base,
        donorStatus: "LAPSED",
        totalLifetimeGiving: Math.max(base.totalLifetimeGiving, 1200),
        lastGiftAmount: Math.max(base.lastGiftAmount, 75),
        lastGiftDateIso: new Date(now - 420 * 24 * 60 * 60 * 1000).toISOString(),
        engagementScore: Math.min(base.engagementScore, 35),
        doNotEmail: false,
        doNotMail: false,
        doNotContact: false,
      },
      seededEvents: [
        {
          id: "evt_lapsed_aging",
          type: "DONOR_LAPSED",
          label: "No gift in over 12 months",
          occurredAt: new Date(now - 5 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
    {
      id: "opt-out-guardrails",
      name: "Opt-out Guardrails",
      description: "Donor with contact restrictions to verify safety blocks.",
      donorProfile: {
        ...base,
        donorStatus: "ACTIVE",
        doNotEmail: true,
        doNotMail: true,
        doNotContact: true,
      },
      seededEvents: [
        {
          id: "evt_optout_profile",
          type: "PREFERENCE_UPDATED",
          label: "Communication opt-out flags are active",
          occurredAt: new Date(now - 3 * 24 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
  ];
}

/** Maps one path step to deterministic sandbox preview and expected result. */
function buildSandboxStep(
  step: PlaygroundTemplateStep,
  donorProfile: PlaygroundDonorProfile,
  skipDelays: boolean,
): PlaygroundRunStep {
  const cfg = asRecord(step.configJson);
  const str = (key: string, fallback = ""): string => (typeof cfg[key] === "string" ? String(cfg[key]) : fallback);
  const num = (key: string, fallback = 0): number => toNumber(cfg[key], fallback);

  const baseStep: PlaygroundRunStep = {
    stepId: step.id,
    label: step.name || step.stepType,
    stepType: step.stepType,
    orderIndex: step.orderIndex,
    status: "pending",
    result: null,
    plannedResult: "passed",
    preview: {
      type: "action",
      description: `${step.stepType} would execute in sandbox mode.`,
    },
    executedAt: null,
  };

  switch (step.stepType) {
    case "DELAY": {
      const waitAmount = num("amount", num("delayDays", 1));
      const waitUnit = str("unit", "days");
      return {
        ...baseStep,
        plannedResult: skipDelays ? "skipped" : "passed",
        preview: {
          type: "timing",
          waitAmount,
          waitUnit,
          description: skipDelays
            ? `Timing step simulated as instant in Playground. Would wait ${waitAmount} ${waitUnit} in production.`
            : `Timing step simulated with wait intent: ${waitAmount} ${waitUnit}.`,
        },
      };
    }

    case "DRAFT_EMAIL":
    case "SEND_EMAIL": {
      const blocked = donorProfile.doNotEmail || donorProfile.doNotContact;
      const subject = str("subjectTemplate", str("emailSubject", "(no subject configured)"));
      const fromEmail = str("fromEmail", "hello@yourorg.org");
      return {
        ...baseStep,
        plannedResult: blocked ? "blocked" : "passed",
        blockReason: blocked ? "Donor communication preferences block email send/draft actions." : undefined,
        preview: {
          type: "email",
          subject,
          fromEmail,
          templateName: str("templateName", str("emailTemplateId", "default")),
          description: blocked
            ? "Email step blocked by sandbox donor opt-out flags."
            : `Would queue sandbox email draft: \"${subject}\".`,
        },
      };
    }

    case "GENERATE_LETTER": {
      const blocked = donorProfile.doNotMail || donorProfile.doNotContact;
      return {
        ...baseStep,
        plannedResult: blocked ? "blocked" : "passed",
        blockReason: blocked ? "Donor communication preferences block physical mail." : undefined,
        preview: {
          type: "letter",
          templateName: str("templateName", str("templateId", "default")),
          description: blocked
            ? "Letter step blocked by sandbox donor do-not-mail flags."
            : `Would generate sandbox printable letter using ${str("templateName", str("templateId", "default"))}.`,
        },
      };
    }

    case "CREATE_TASK":
      return {
        ...baseStep,
        plannedResult: "passed",
        preview: {
          type: "task",
          taskTitle: str("titleTemplate", str("taskTitle", "(untitled task)")),
          taskPriority: str("priority", str("taskPriority", "MEDIUM")),
          description: `Would create sandbox task \"${str("titleTemplate", str("taskTitle", "(untitled task)"))}\".`,
        },
      };

    case "BRANCH_PLACEHOLDER":
      return {
        ...baseStep,
        plannedResult: "branched",
        preview: {
          type: "condition",
          description: "Branch condition evaluated with sandbox donor profile.",
        },
      };

    default:
      return baseStep;
  }
}

/** Computes run summary cards from executed step states. */
function computeSummary(steps: PlaygroundRunStep[]): PlaygroundRunSummary {
  const completed = steps.filter((step) => step.result !== null).length;
  const passed = steps.filter((step) => step.result === "passed").length;
  const skipped = steps.filter((step) => step.result === "skipped").length;
  const branched = steps.filter((step) => step.result === "branched").length;
  const blocked = steps.filter((step) => step.result === "blocked").length;
  const failed = steps.filter((step) => step.result === "failed").length;

  const overall: "pass" | "warn" | "fail" = failed > 0
    ? "fail"
    : blocked > 0 || skipped > 0
      ? "warn"
      : "pass";

  return {
    totalSteps: steps.length,
    completedSteps: completed,
    passed,
    skipped,
    branched,
    blocked,
    failed,
    emailsSimulated: steps.filter((step) => step.preview.type === "email" && step.result === "passed").length,
    lettersSimulated: steps.filter((step) => step.preview.type === "letter" && step.result === "passed").length,
    tasksSimulated: steps.filter((step) => step.preview.type === "task" && step.result === "passed").length,
    overall,
  };
}

/** Converts one mutable run record into an immutable API snapshot. */
function toSnapshot(record: PlaygroundRunRecord): PlaygroundRunSnapshot {
  return {
    runId: record.runId,
    pathId: record.pathId,
    pathName: record.pathName,
    status: record.status,
    isSandbox: true,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    scenario: clone(record.scenario),
    sourceConstituent: { ...record.sourceConstituent },
    options: { ...record.options },
    cursor: record.cursor,
    steps: record.steps.map((step) => ({ ...step, preview: { ...step.preview } })),
    summary: { ...record.summary },
    activity: record.activity.slice(-200).map((item) => ({ ...item })),
  };
}

/** Resolves one run by org + path + run id. */
function getRunRecord(
  organizationId: string,
  pathId: string,
  runId: string,
): PlaygroundRunRecord | null {
  pruneExpiredRuns();
  const record = runStore.get(runId);
  if (!record) return null;
  if (record.organizationId !== organizationId) return null;
  if (record.pathId !== pathId) return null;
  return record;
}

/** Executes one pending step and appends activity. */
function executeOneStep(record: PlaygroundRunRecord): boolean {
  if (record.cursor >= record.steps.length) {
    if (record.status !== "completed") {
      record.status = "completed";
      if (!record.completedAt) {
        record.completedAt = nowIso();
        record.activity.push(buildActivity({
          type: "run.completed",
          level: "info",
          message: "Sandbox run completed.",
        }));
      }
    }
    return false;
  }

  const now = nowIso();
  const step = record.steps[record.cursor];
  step.status = "running";
  step.result = step.plannedResult;
  step.status = step.plannedResult;
  step.executedAt = now;

  const level: PlaygroundActivityLevel = step.result === "failed"
    ? "error"
    : step.result === "blocked" || step.result === "skipped"
      ? "warn"
      : "info";

  record.activity.push(buildActivity({
    type: "step.executed",
    level,
    message: `${step.label} -> ${step.result}`,
    metadata: {
      stepId: step.stepId,
      stepType: step.stepType,
      orderIndex: step.orderIndex,
      result: step.result,
      blockReason: step.blockReason,
    },
  }));

  record.cursor += 1;
  if (record.cursor >= record.steps.length) {
    record.status = "completed";
    if (!record.completedAt) {
      record.completedAt = now;
      record.activity.push(buildActivity({
        type: "run.completed",
        level: "info",
        message: "Sandbox run completed.",
      }));
    }
  }

  return true;
}

/** Creates a new sandbox run for one path and scenario. */
export function createPlaygroundRun(params: {
  organizationId: string;
  pathId: string;
  pathName: string;
  steps: PlaygroundTemplateStep[];
  constituent?: PlaygroundConstituentSnapshot | null;
  scenarioId?: string | null;
  skipDelays?: boolean;
  testEmail?: string | null;
}): PlaygroundRunSnapshot {
  pruneExpiredRuns();

  const scenarios = buildPlaygroundScenarios(params.constituent);
  const selectedScenario = scenarios.find((scenario) => scenario.id === params.scenarioId) ?? scenarios[0];

  const skipDelays = params.skipDelays !== false;
  const testEmail = normalizeEmail(params.testEmail);

  const runSteps = [...params.steps]
    .sort((a, b) => a.orderIndex - b.orderIndex)
    .map((step) => buildSandboxStep(step, selectedScenario.donorProfile, skipDelays));

  const createdAt = nowIso();
  const runId = `spr_${randomUUID()}`;

  const sourceName = params.constituent
    ? displayName(params.constituent.firstName, params.constituent.lastName)
    : displayName(selectedScenario.donorProfile.firstName, selectedScenario.donorProfile.lastName);

  const record: PlaygroundRunRecord = {
    runId,
    organizationId: params.organizationId,
    pathId: params.pathId,
    pathName: params.pathName,
    status: "ready",
    isSandbox: true,
    createdAt,
    updatedAt: createdAt,
    completedAt: null,
    scenario: clone(selectedScenario),
    sourceConstituent: {
      id: params.constituent?.id || selectedScenario.donorProfile.id,
      name: sourceName,
      email: params.constituent?.email ?? selectedScenario.donorProfile.email,
      source: params.constituent ? "real" : "synthetic",
    },
    options: {
      skipDelays,
      testEmail,
    },
    cursor: 0,
    steps: runSteps,
    summary: computeSummary(runSteps),
    activity: [
      buildActivity({
        type: "run.created",
        level: "info",
        message: `Sandbox run created using scenario \"${selectedScenario.name}\".`,
        metadata: {
          scenarioId: selectedScenario.id,
          totalSteps: runSteps.length,
          skipDelays,
        },
      }),
    ],
  };

  runStore.set(runId, record);
  return toSnapshot(record);
}

/** Advances an existing sandbox run using one playback action. */
export function advancePlaygroundRun(params: {
  organizationId: string;
  pathId: string;
  runId: string;
  action: "step" | "auto" | "pause" | "fast-forward";
}): PlaygroundRunSnapshot | null {
  const record = getRunRecord(params.organizationId, params.pathId, params.runId);
  if (!record) return null;

  if (params.action === "pause") {
    if (record.status !== "completed") {
      record.status = "paused";
      record.activity.push(buildActivity({
        type: "run.paused",
        level: "info",
        message: "Sandbox playback paused.",
      }));
    }
  } else if (params.action === "step") {
    if (record.status === "paused") {
      record.status = "ready";
    }
    executeOneStep(record);
    if (record.status !== "completed") {
      record.status = "ready";
    }
  } else {
    if (record.status === "paused") {
      record.status = "ready";
    }
    record.status = "running";
    const safetyCap = Math.max(5, record.steps.length + 5);
    let ticks = 0;
    while (ticks < safetyCap && record.cursor < record.steps.length) {
      const moved = executeOneStep(record);
      if (!moved) break;
      ticks += 1;
    }

    if (params.action === "fast-forward") {
      record.activity.push(buildActivity({
        type: "run.fast-forward",
        level: "info",
        message: "Fast-forward completed in sandbox mode.",
      }));
    }

    if (record.cursor < record.steps.length) {
      record.status = "ready";
    }
  }

  record.updatedAt = nowIso();
  record.summary = computeSummary(record.steps);
  return toSnapshot(record);
}

/** Resets one existing sandbox run back to pending step state. */
export function resetPlaygroundRun(params: {
  organizationId: string;
  pathId: string;
  runId: string;
}): PlaygroundRunSnapshot | null {
  const record = getRunRecord(params.organizationId, params.pathId, params.runId);
  if (!record) return null;

  record.status = "ready";
  record.cursor = 0;
  record.completedAt = null;
  record.steps = record.steps.map((step) => ({
    ...step,
    status: "pending",
    result: null,
    executedAt: null,
  }));

  record.activity.push(buildActivity({
    type: "run.reset",
    level: "info",
    message: "Sandbox run reset to initial state.",
  }));

  record.updatedAt = nowIso();
  record.summary = computeSummary(record.steps);
  return toSnapshot(record);
}

/** Returns one sandbox run snapshot by org/path/run id. */
export function getPlaygroundRunSnapshot(params: {
  organizationId: string;
  pathId: string;
  runId: string;
}): PlaygroundRunSnapshot | null {
  const record = getRunRecord(params.organizationId, params.pathId, params.runId);
  if (!record) return null;
  return toSnapshot(record);
}

/** Returns full activity stream for one sandbox run. */
export function getPlaygroundRunActivity(params: {
  organizationId: string;
  pathId: string;
  runId: string;
}): PlaygroundActivityItem[] | null {
  const record = getRunRecord(params.organizationId, params.pathId, params.runId);
  if (!record) return null;
  return record.activity.map((item) => ({ ...item }));
}

/** Builds sandbox-only test email previews for executed/previewed email steps. */
export function previewSandboxTestEmails(params: {
  organizationId: string;
  pathId: string;
  runId: string;
  testEmail: string;
}): SandboxEmailPreviewResult | null {
  const record = getRunRecord(params.organizationId, params.pathId, params.runId);
  if (!record) return null;

  const toEmail = normalizeEmail(params.testEmail);
  if (!toEmail || !isValidEmail(toEmail)) {
    throw new Error("Valid testEmail is required for sandbox email preview.");
  }

  const items: SandboxEmailPreviewItem[] = record.steps
    .filter((step) => step.preview.type === "email")
    .map((step) => {
      const blocked = step.plannedResult === "blocked" || step.result === "blocked";
      const subjectBase = step.preview.subject || step.label;
      const subject = `[SANDBOX TEST] ${subjectBase}`;
      const body = [
        "SANDBOX TEST MESSAGE",
        "This preview was generated by Steward Paths Playground.",
        "No production recipient was contacted.",
        "No production analytics events were recorded.",
        "",
        `Path: ${record.pathName}`,
        `Run: ${record.runId}`,
        `Step: ${step.label}`,
        `Preview: ${step.preview.description}`,
      ].join("\n");

      return {
        stepId: step.stepId,
        label: step.label,
        toEmail,
        subject,
        body,
        status: blocked ? "skipped" : "queued",
        reason: blocked ? (step.blockReason || "Blocked by sandbox communication guardrails.") : undefined,
      };
    });

  const sentCount = items.filter((item) => item.status === "queued").length;
  const skippedCount = items.filter((item) => item.status === "skipped").length;

  record.options.testEmail = toEmail;
  record.activity.push(buildActivity({
    type: "sandbox.email-preview",
    level: "info",
    message: `Sandbox email preview generated for ${toEmail}.`,
    metadata: {
      sentCount,
      skippedCount,
    },
  }));
  record.updatedAt = nowIso();

  return {
    isSandbox: true,
    analyticsTracked: false,
    runId: record.runId,
    toEmail,
    message: "Sandbox preview generated. No production sends or analytics were triggered.",
    sentCount,
    skippedCount,
    items,
  };
}
