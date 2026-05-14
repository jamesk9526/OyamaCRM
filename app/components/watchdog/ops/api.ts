// Client API helpers for the OyamaWatchdog operations workspace.

import { apiFetch } from "@/app/lib/auth-client";
import type {
  WatchdogAuditResponse,
  WatchdogBackupPolicy,
  WatchdogBackupRecord,
  WatchdogBackupVerification,
  WatchdogDatabaseConfigResponse,
  WatchdogHealthResponse,
  WatchdogOverviewResponse,
  WatchdogRestoreJob,
  WatchdogRestorePoint,
  WatchdogRunbooksResponse,
  WatchdogSecuritySummary,
  WatchdogVaultAccessEvent,
  WatchdogVaultItem,
} from "@/app/components/watchdog/ops/types";

/** Loads central Watchdog overview metrics and attention queue data. */
export async function fetchWatchdogOverview(): Promise<WatchdogOverviewResponse> {
  return apiFetch<WatchdogOverviewResponse>("/api/watchdog/ops/overview");
}

/** Loads backup scope coverage and implementation state. */
export async function fetchWatchdogBackupCoverage(): Promise<{
  scopes: Array<{
    scope: string;
    label: string;
    status: string;
    implemented: boolean;
    reason?: string;
  }>;
  moduleScopes: string[];
}> {
  return apiFetch("/api/watchdog/ops/backups/coverage");
}

/** Lists full backup snapshots currently stored through Watchdog. */
export async function fetchWatchdogBackups(): Promise<WatchdogBackupRecord[]> {
  const response = await apiFetch<{ items: WatchdogBackupRecord[] }>("/api/watchdog/backups?limit=100");
  return Array.isArray(response.items) ? response.items : [];
}

/** Triggers full backup export in the legacy backup endpoint. */
export async function runWatchdogFullBackupNow(params: {
  label?: string;
  includeWatchdogDatabase?: boolean;
}): Promise<{ item: WatchdogBackupRecord }> {
  return apiFetch("/api/watchdog/backups/export", {
    method: "POST",
    body: JSON.stringify({
      label: params.label,
      includeWatchdogDatabase: params.includeWatchdogDatabase ?? true,
    }),
  });
}

/** Creates redacted environment manifest backup metadata. */
export async function createEnvironmentManifestBackup(): Promise<{
  manifest: {
    manifestType: string;
    generatedAt: string;
    generatedBy: string;
    organizationId: string;
    entryCount: number;
    entries: Array<{ key: string; present: boolean; value: string | null }>;
  };
}> {
  return apiFetch("/api/watchdog/ops/backups/environment-manifest", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

/** Lists backup policy records. */
export async function fetchWatchdogBackupPolicies(): Promise<WatchdogBackupPolicy[]> {
  const response = await apiFetch<{ items: WatchdogBackupPolicy[] }>("/api/watchdog/ops/backups/policies");
  return Array.isArray(response.items) ? response.items : [];
}

/** Creates one backup policy record. */
export async function createWatchdogBackupPolicy(payload: {
  policyName: string;
  backupScope: string;
  moduleScope?: string | null;
  cronExpression: string;
  retentionDays: number;
  storageTarget: string;
  encrypted: boolean;
  enabled: boolean;
  notes?: string | null;
}): Promise<WatchdogBackupPolicy> {
  const response = await apiFetch<{ item: WatchdogBackupPolicy }>("/api/watchdog/ops/backups/policies", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.item;
}

/** Updates one backup policy. */
export async function updateWatchdogBackupPolicy(params: {
  id: string;
  patch: Partial<Omit<WatchdogBackupPolicy, "id" | "organizationId" | "createdAt" | "updatedAt" | "createdBy" | "updatedBy">>;
}): Promise<WatchdogBackupPolicy> {
  const response = await apiFetch<{ item: WatchdogBackupPolicy }>(`/api/watchdog/ops/backups/policies/${params.id}`, {
    method: "PATCH",
    body: JSON.stringify(params.patch),
  });
  return response.item;
}

/** Deletes one backup policy by identifier. */
export async function deleteWatchdogBackupPolicy(id: string): Promise<void> {
  await apiFetch(`/api/watchdog/ops/backups/policies/${id}`, {
    method: "DELETE",
    body: JSON.stringify({}),
  });
}

/** Triggers backup verification for one snapshot. */
export async function verifyWatchdogBackup(backupId: string): Promise<WatchdogBackupVerification> {
  const response = await apiFetch<{ item: WatchdogBackupVerification }>("/api/watchdog/ops/backups/verify", {
    method: "POST",
    body: JSON.stringify({ backupId }),
  });
  return response.item;
}

/** Lists backup verification rows. */
export async function fetchWatchdogBackupVerifications(backupId?: string): Promise<WatchdogBackupVerification[]> {
  const query = backupId ? `?backupId=${encodeURIComponent(backupId)}` : "";
  const response = await apiFetch<{ items: WatchdogBackupVerification[] }>(`/api/watchdog/ops/backups/verifications${query}`);
  return Array.isArray(response.items) ? response.items : [];
}

/** Lists restore points with verification summary and block reasons. */
export async function fetchWatchdogRestorePoints(): Promise<WatchdogRestorePoint[]> {
  const response = await apiFetch<{ points: WatchdogRestorePoint[] }>("/api/watchdog/ops/restore/points");
  return Array.isArray(response.points) ? response.points : [];
}

/** Runs restore dry-run for one restore point. */
export async function runWatchdogRestoreDryRun(backupId: string): Promise<{
  dryRun: {
    id: string;
    status: string;
    riskLevel: string;
    warnings: string[];
    createdAt: string;
  };
  latestVerification: WatchdogBackupVerification | null;
}> {
  return apiFetch("/api/watchdog/ops/restore/dry-run", {
    method: "POST",
    body: JSON.stringify({ backupId }),
  });
}

/** Executes guarded restore workflow. */
export async function executeWatchdogRestore(payload: {
  backupId: string;
  dryRunId: string;
  confirmationText: string;
  reason: string;
  breakGlass: boolean;
}): Promise<{
  success: boolean;
  restoreJobId: string;
  preRestoreBackupId: string | null;
  report: Record<string, unknown>;
}> {
  return apiFetch("/api/watchdog/ops/restore/execute", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      execute: true,
    }),
  });
}

/** Lists restore execution jobs. */
export async function fetchWatchdogRestoreJobs(): Promise<WatchdogRestoreJob[]> {
  const response = await apiFetch<{ items: WatchdogRestoreJob[] }>("/api/watchdog/ops/restore/jobs");
  return Array.isArray(response.items) ? response.items : [];
}

/** Lists vault metadata rows (without secret values). */
export async function fetchWatchdogVaultItems(): Promise<WatchdogVaultItem[]> {
  const response = await apiFetch<{ items: WatchdogVaultItem[] }>("/api/watchdog/vault");
  return Array.isArray(response.items) ? response.items : [];
}

/** Creates one vault entry with encrypted secret payload. */
export async function createWatchdogVaultItem(payload: {
  name: string;
  category?: string;
  username?: string;
  website?: string;
  password: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<WatchdogVaultItem> {
  const response = await apiFetch<{ item: WatchdogVaultItem }>("/api/watchdog/vault", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return response.item;
}

/** Reveals one secret with explicit audited action. */
export async function revealWatchdogVaultSecret(id: string, reason: string): Promise<WatchdogVaultItem> {
  const response = await apiFetch<{ item: WatchdogVaultItem }>(`/api/watchdog/ops/vault/${id}/reveal`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return response.item;
}

/** Copies one secret with explicit audited action. */
export async function copyWatchdogVaultSecret(id: string, reason: string): Promise<WatchdogVaultItem> {
  const response = await apiFetch<{ item: WatchdogVaultItem }>(`/api/watchdog/ops/vault/${id}/copy`, {
    method: "POST",
    body: JSON.stringify({ reason }),
  });
  return response.item;
}

/** Updates vault metadata or rotates secret value. */
export async function updateWatchdogVaultItem(params: {
  id: string;
  patch: {
    name?: string;
    category?: string;
    username?: string | null;
    website?: string | null;
    notes?: string;
    password?: string;
    metadata?: Record<string, unknown>;
  };
}): Promise<WatchdogVaultItem> {
  const response = await apiFetch<{ item: WatchdogVaultItem }>(`/api/watchdog/ops/vault/${params.id}`, {
    method: "PATCH",
    body: JSON.stringify(params.patch),
  });
  return response.item;
}

/** Lists secret access history for reveal/copy/rotate actions. */
export async function fetchWatchdogVaultAccessEvents(vaultEntryId?: string): Promise<WatchdogVaultAccessEvent[]> {
  const query = vaultEntryId ? `?vaultEntryId=${encodeURIComponent(vaultEntryId)}` : "";
  const response = await apiFetch<{ items: WatchdogVaultAccessEvent[] }>(`/api/watchdog/ops/vault/access-events${query}`);
  return Array.isArray(response.items) ? response.items : [];
}

/** Loads security dashboard summary checks. */
export async function fetchWatchdogSecuritySummary(): Promise<WatchdogSecuritySummary> {
  return apiFetch<WatchdogSecuritySummary>("/api/watchdog/ops/security/summary");
}

/** Loads platform health checks from Watchdog operations API. */
export async function fetchWatchdogHealth(): Promise<WatchdogHealthResponse> {
  return apiFetch<WatchdogHealthResponse>("/api/watchdog/ops/health");
}

/** Loads filterable operations audit feed. */
export async function fetchWatchdogAudit(params: {
  page?: number;
  limit?: number;
  eventType?: string;
  user?: string;
  severity?: string;
  module?: string;
  entity?: string;
  dateFrom?: string;
  dateTo?: string;
}): Promise<WatchdogAuditResponse> {
  const search = new URLSearchParams();

  if (params.page) search.set("page", String(params.page));
  if (params.limit) search.set("limit", String(params.limit));
  if (params.eventType?.trim()) search.set("eventType", params.eventType.trim());
  if (params.user?.trim()) search.set("user", params.user.trim());
  if (params.severity?.trim()) search.set("severity", params.severity.trim());
  if (params.module?.trim()) search.set("module", params.module.trim());
  if (params.entity?.trim()) search.set("entity", params.entity.trim());
  if (params.dateFrom?.trim()) search.set("dateFrom", params.dateFrom.trim());
  if (params.dateTo?.trim()) search.set("dateTo", params.dateTo.trim());

  const suffix = search.toString() ? `?${search.toString()}` : "";
  return apiFetch<WatchdogAuditResponse>(`/api/watchdog/ops/audit${suffix}`);
}

/** Loads runbook catalog entries. */
export async function fetchWatchdogRunbooks(): Promise<WatchdogRunbooksResponse> {
  return apiFetch<WatchdogRunbooksResponse>("/api/watchdog/ops/runbooks");
}

/** Loads persisted Watchdog settings payload. */
export async function fetchWatchdogSettings(): Promise<Record<string, unknown>> {
  const response = await apiFetch<{ settings: Record<string, unknown> }>("/api/watchdog/ops/settings");
  return response.settings;
}

/** Persists Watchdog settings payload. */
export async function saveWatchdogSettings(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
  const response = await apiFetch<{ settings: Record<string, unknown> }>("/api/watchdog/ops/settings", {
    method: "PUT",
    body: JSON.stringify({ settings }),
  });
  return response.settings;
}

/** Loads masked database/environment config values used by Watchdog settings. */
export async function fetchWatchdogDatabaseConfig(): Promise<WatchdogDatabaseConfigResponse> {
  return apiFetch<WatchdogDatabaseConfigResponse>("/api/watchdog/ops/database-config");
}

/** Updates Watchdog database/environment config values after typed confirmation. */
export async function saveWatchdogDatabaseConfig(payload: {
  confirmationText: string;
  databaseUrl?: string;
  watchdogDatabaseUrl?: string;
  watchdogEncryptionKey?: string;
  jwtSecret?: string;
  nextPublicApiUrl?: string;
}): Promise<WatchdogDatabaseConfigResponse & { updatedKeys: string[]; requiresServiceRestart: boolean }> {
  return apiFetch("/api/watchdog/ops/database-config", {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
