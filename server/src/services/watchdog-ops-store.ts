/**
 * Watchdog operations store service.
 * Persists backup policies, verification jobs, restore safety records, vault access events, and module settings.
 */
import { randomUUID } from "crypto";
import mysql from "mysql2/promise";

export type WatchdogBackupScope =
  | "FULL_PLATFORM"
  | "DATABASE"
  | "FILES_MEDIA"
  | "CONFIGURATION"
  | "ENVIRONMENT_MANIFEST"
  | "MODULE";

export type WatchdogBackupVerificationStatus = "QUEUED" | "RUNNING" | "VERIFIED" | "FAILED";

export interface WatchdogBackupPolicy {
  id: string;
  organizationId: string;
  policyName: string;
  backupScope: WatchdogBackupScope;
  moduleScope: string | null;
  cronExpression: string;
  retentionDays: number;
  storageTarget: string;
  encrypted: boolean;
  enabled: boolean;
  notes: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WatchdogBackupVerification {
  id: number;
  organizationId: string;
  backupId: string;
  status: WatchdogBackupVerificationStatus;
  checksumMatches: boolean | null;
  details: Record<string, unknown> | null;
  errorMessage: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WatchdogRestoreDryRunStatus = "DRY_RUN_RUNNING" | "DRY_RUN_PASSED" | "DRY_RUN_FAILED";

export interface WatchdogRestoreDryRun {
  id: string;
  organizationId: string;
  backupId: string;
  status: WatchdogRestoreDryRunStatus;
  riskLevel: "low" | "medium" | "high" | "critical";
  overwriteSummary: Record<string, unknown> | null;
  warnings: string[];
  requestedBy: string;
  createdAt: string;
}

export type WatchdogRestoreJobStatus =
  | "DRAFT"
  | "AWAITING_APPROVAL"
  | "RUNNING"
  | "VERIFYING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELED";

export interface WatchdogRestoreJob {
  id: string;
  organizationId: string;
  backupId: string;
  dryRunId: string;
  status: WatchdogRestoreJobStatus;
  riskLevel: "low" | "medium" | "high" | "critical";
  breakGlassUsed: boolean;
  preRestoreBackupId: string | null;
  requestedBy: string;
  reason: string | null;
  report: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WatchdogVaultAccessType = "reveal" | "copy" | "rotate" | "export";

export interface WatchdogVaultAccessEvent {
  id: number;
  organizationId: string;
  vaultEntryId: string;
  accessType: WatchdogVaultAccessType;
  accessedBy: string;
  reason: string | null;
  createdAt: string;
}

let watchdogOpsPool: mysql.Pool | null = null;
let opsSchemaReady = false;

/** Resets pooled Watchdog operations DB connection to apply updated environment URLs. */
export async function resetWatchdogOpsStoreConnections(): Promise<void> {
  if (watchdogOpsPool) {
    await watchdogOpsPool.end();
  }
  watchdogOpsPool = null;
  opsSchemaReady = false;
}

/** Resolves the effective Watchdog DB URL with a safe non-production fallback. */
function getEffectiveWatchdogDatabaseUrl(): string | undefined {
  const explicit = process.env.WATCHDOG_DATABASE_URL?.trim();
  if (explicit) return explicit;

  if (process.env.NODE_ENV !== "production") {
    return process.env.DATABASE_URL?.trim();
  }

  return undefined;
}

/** Gets or creates the pooled MySQL connection for Watchdog operations tables. */
function getOpsPool(): mysql.Pool {
  const databaseUrl = getEffectiveWatchdogDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("WATCHDOG_DATABASE_URL is missing (and no non-production DATABASE_URL fallback is available).");
  }

  if (!watchdogOpsPool) {
    watchdogOpsPool = mysql.createPool(databaseUrl);
  }

  return watchdogOpsPool;
}

/** Parses one JSON column and returns a record when valid. */
function parseJsonRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Parses one JSON column and returns a string array when valid. */
function parseJsonStringArray(value: unknown): string[] {
  if (typeof value !== "string" || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === "string");
  } catch {
    return [];
  }
}

/** Ensures Watchdog operations schema tables exist. */
async function ensureOpsSchema(): Promise<void> {
  if (opsSchemaReady) return;

  const pool = getOpsPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_backup_policies (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      policy_name VARCHAR(180) NOT NULL,
      backup_scope VARCHAR(40) NOT NULL,
      module_scope VARCHAR(120) NULL,
      cron_expression VARCHAR(120) NOT NULL,
      retention_days INT NOT NULL DEFAULT 30,
      storage_target VARCHAR(180) NOT NULL DEFAULT 'watchdog-default',
      encrypted TINYINT(1) NOT NULL DEFAULT 1,
      enabled TINYINT(1) NOT NULL DEFAULT 1,
      notes TEXT NULL,
      created_by VARCHAR(64) NOT NULL,
      updated_by VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_watchdog_backup_policy_org_enabled (organization_id, enabled, updated_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_backup_verifications (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      backup_id VARCHAR(64) NOT NULL,
      verification_status VARCHAR(24) NOT NULL DEFAULT 'QUEUED',
      checksum_matches TINYINT(1) NULL,
      details_json LONGTEXT NULL,
      error_message TEXT NULL,
      verified_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_watchdog_backup_verify_org_backup (organization_id, backup_id, id),
      INDEX idx_watchdog_backup_verify_org_status (organization_id, verification_status, updated_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_restore_dry_runs (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      backup_id VARCHAR(64) NOT NULL,
      dry_run_status VARCHAR(24) NOT NULL,
      risk_level VARCHAR(20) NOT NULL DEFAULT 'medium',
      overwrite_summary_json LONGTEXT NULL,
      warnings_json LONGTEXT NULL,
      requested_by VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_watchdog_restore_dry_org_backup (organization_id, backup_id, created_at),
      INDEX idx_watchdog_restore_dry_org_status (organization_id, dry_run_status, created_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_restore_jobs (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      backup_id VARCHAR(64) NOT NULL,
      dry_run_id VARCHAR(64) NOT NULL,
      restore_status VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
      risk_level VARCHAR(20) NOT NULL DEFAULT 'medium',
      break_glass_used TINYINT(1) NOT NULL DEFAULT 0,
      pre_restore_backup_id VARCHAR(64) NULL,
      requested_by VARCHAR(64) NOT NULL,
      reason TEXT NULL,
      report_json LONGTEXT NULL,
      error_message TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_watchdog_restore_jobs_org_status (organization_id, restore_status, updated_at),
      INDEX idx_watchdog_restore_jobs_org_backup (organization_id, backup_id, created_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_vault_access_events (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      vault_entry_id VARCHAR(64) NOT NULL,
      access_type VARCHAR(24) NOT NULL,
      accessed_by VARCHAR(64) NOT NULL,
      reason TEXT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_watchdog_vault_access_org_entry (organization_id, vault_entry_id, created_at),
      INDEX idx_watchdog_vault_access_org_type (organization_id, access_type, created_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_settings (
      organization_id VARCHAR(64) NOT NULL PRIMARY KEY,
      settings_json LONGTEXT NOT NULL,
      updated_by VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  opsSchemaReady = true;
}

/** Lists backup policies configured for one organization. */
export async function listWatchdogBackupPolicies(organizationId: string): Promise<WatchdogBackupPolicy[]> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, organization_id, policy_name, backup_scope, module_scope, cron_expression,
             retention_days, storage_target, encrypted, enabled, notes, created_by, updated_by,
             created_at, updated_at
      FROM watchdog_backup_policies
      WHERE organization_id = ?
      ORDER BY enabled DESC, updated_at DESC
    `,
    [organizationId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    policyName: String(row.policy_name),
    backupScope: String(row.backup_scope) as WatchdogBackupScope,
    moduleScope: row.module_scope ? String(row.module_scope) : null,
    cronExpression: String(row.cron_expression),
    retentionDays: Number(row.retention_days ?? 30),
    storageTarget: String(row.storage_target),
    encrypted: Boolean(row.encrypted),
    enabled: Boolean(row.enabled),
    notes: row.notes ? String(row.notes) : null,
    createdBy: String(row.created_by),
    updatedBy: String(row.updated_by),
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

/** Creates one backup policy record. */
export async function createWatchdogBackupPolicy(params: {
  organizationId: string;
  createdBy: string;
  policyName: string;
  backupScope: WatchdogBackupScope;
  moduleScope?: string | null;
  cronExpression: string;
  retentionDays: number;
  storageTarget: string;
  encrypted: boolean;
  enabled: boolean;
  notes?: string | null;
}): Promise<WatchdogBackupPolicy> {
  await ensureOpsSchema();
  const pool = getOpsPool();
  const id = randomUUID();

  await pool.query(
    `
      INSERT INTO watchdog_backup_policies
      (id, organization_id, policy_name, backup_scope, module_scope, cron_expression, retention_days,
       storage_target, encrypted, enabled, notes, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      params.organizationId,
      params.policyName,
      params.backupScope,
      params.moduleScope ?? null,
      params.cronExpression,
      params.retentionDays,
      params.storageTarget,
      params.encrypted ? 1 : 0,
      params.enabled ? 1 : 0,
      params.notes?.trim() ? params.notes.trim() : null,
      params.createdBy,
      params.createdBy,
    ],
  );

  const [created] = await listWatchdogBackupPolicies(params.organizationId);
  if (!created || created.id !== id) {
    const policies = await listWatchdogBackupPolicies(params.organizationId);
    const match = policies.find((policy) => policy.id === id);
    if (!match) {
      throw new Error("Failed to read created backup policy.");
    }
    return match;
  }

  return created;
}

/** Updates one backup policy record. */
export async function updateWatchdogBackupPolicy(params: {
  organizationId: string;
  id: string;
  updatedBy: string;
  policyName?: string;
  backupScope?: WatchdogBackupScope;
  moduleScope?: string | null;
  cronExpression?: string;
  retentionDays?: number;
  storageTarget?: string;
  encrypted?: boolean;
  enabled?: boolean;
  notes?: string | null;
}): Promise<WatchdogBackupPolicy | null> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  const fields: string[] = ["updated_by = ?"];
  const values: Array<string | number | null> = [params.updatedBy];

  if (params.policyName !== undefined) {
    fields.push("policy_name = ?");
    values.push(params.policyName);
  }
  if (params.backupScope !== undefined) {
    fields.push("backup_scope = ?");
    values.push(params.backupScope);
  }
  if (params.moduleScope !== undefined) {
    fields.push("module_scope = ?");
    values.push(params.moduleScope);
  }
  if (params.cronExpression !== undefined) {
    fields.push("cron_expression = ?");
    values.push(params.cronExpression);
  }
  if (params.retentionDays !== undefined) {
    fields.push("retention_days = ?");
    values.push(params.retentionDays);
  }
  if (params.storageTarget !== undefined) {
    fields.push("storage_target = ?");
    values.push(params.storageTarget);
  }
  if (params.encrypted !== undefined) {
    fields.push("encrypted = ?");
    values.push(params.encrypted ? 1 : 0);
  }
  if (params.enabled !== undefined) {
    fields.push("enabled = ?");
    values.push(params.enabled ? 1 : 0);
  }
  if (params.notes !== undefined) {
    fields.push("notes = ?");
    values.push(params.notes?.trim() ? params.notes.trim() : null);
  }

  if (fields.length === 1) {
    const existing = await listWatchdogBackupPolicies(params.organizationId);
    return existing.find((policy) => policy.id === params.id) ?? null;
  }

  values.push(params.organizationId, params.id);

  await pool.query(
    `
      UPDATE watchdog_backup_policies
      SET ${fields.join(", ")}
      WHERE organization_id = ? AND id = ?
    `,
    values,
  );

  const items = await listWatchdogBackupPolicies(params.organizationId);
  return items.find((policy) => policy.id === params.id) ?? null;
}

/** Deletes one backup policy record. */
export async function deleteWatchdogBackupPolicy(params: {
  organizationId: string;
  id: string;
}): Promise<boolean> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  const [result] = await pool.query<mysql.ResultSetHeader>(
    `DELETE FROM watchdog_backup_policies WHERE organization_id = ? AND id = ?`,
    [params.organizationId, params.id],
  );

  return result.affectedRows > 0;
}

/** Creates one backup verification record. */
export async function createWatchdogBackupVerification(params: {
  organizationId: string;
  backupId: string;
  status: WatchdogBackupVerificationStatus;
  checksumMatches?: boolean | null;
  details?: Record<string, unknown> | null;
  errorMessage?: string | null;
  verifiedBy?: string | null;
}): Promise<WatchdogBackupVerification> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  const [result] = await pool.query<mysql.ResultSetHeader>(
    `
      INSERT INTO watchdog_backup_verifications
      (organization_id, backup_id, verification_status, checksum_matches, details_json, error_message, verified_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      params.organizationId,
      params.backupId,
      params.status,
      params.checksumMatches === undefined ? null : params.checksumMatches ? 1 : 0,
      params.details ? JSON.stringify(params.details) : null,
      params.errorMessage ?? null,
      params.verifiedBy ?? null,
    ],
  );

  const id = Number(result.insertId);
  const verification = await getWatchdogBackupVerificationById({ organizationId: params.organizationId, id });
  if (!verification) {
    throw new Error("Failed to read created backup verification.");
  }
  return verification;
}

/** Updates one backup verification record. */
export async function updateWatchdogBackupVerification(params: {
  organizationId: string;
  id: number;
  status?: WatchdogBackupVerificationStatus;
  checksumMatches?: boolean | null;
  details?: Record<string, unknown> | null;
  errorMessage?: string | null;
  verifiedBy?: string | null;
}): Promise<WatchdogBackupVerification | null> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  if (params.status !== undefined) {
    fields.push("verification_status = ?");
    values.push(params.status);
  }
  if (params.checksumMatches !== undefined) {
    fields.push("checksum_matches = ?");
    values.push(params.checksumMatches === null ? null : params.checksumMatches ? 1 : 0);
  }
  if (params.details !== undefined) {
    fields.push("details_json = ?");
    values.push(params.details ? JSON.stringify(params.details) : null);
  }
  if (params.errorMessage !== undefined) {
    fields.push("error_message = ?");
    values.push(params.errorMessage);
  }
  if (params.verifiedBy !== undefined) {
    fields.push("verified_by = ?");
    values.push(params.verifiedBy);
  }

  if (fields.length === 0) {
    return getWatchdogBackupVerificationById({ organizationId: params.organizationId, id: params.id });
  }

  values.push(params.organizationId, params.id);

  await pool.query(
    `
      UPDATE watchdog_backup_verifications
      SET ${fields.join(", ")}
      WHERE organization_id = ? AND id = ?
    `,
    values,
  );

  return getWatchdogBackupVerificationById({ organizationId: params.organizationId, id: params.id });
}

/** Lists backup verification records for one organization, optionally scoped to one backup. */
export async function listWatchdogBackupVerifications(params: {
  organizationId: string;
  backupId?: string;
  limit?: number;
}): Promise<WatchdogBackupVerification[]> {
  await ensureOpsSchema();
  const pool = getOpsPool();
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 500);

  const query = params.backupId
    ? `
      SELECT id, organization_id, backup_id, verification_status, checksum_matches, details_json, error_message,
             verified_by, created_at, updated_at
      FROM watchdog_backup_verifications
      WHERE organization_id = ? AND backup_id = ?
      ORDER BY id DESC
      LIMIT ?
    `
    : `
      SELECT id, organization_id, backup_id, verification_status, checksum_matches, details_json, error_message,
             verified_by, created_at, updated_at
      FROM watchdog_backup_verifications
      WHERE organization_id = ?
      ORDER BY id DESC
      LIMIT ?
    `;

  const args = params.backupId
    ? [params.organizationId, params.backupId, limit]
    : [params.organizationId, limit];

  const [rows] = await pool.query<mysql.RowDataPacket[]>(query, args);

  return rows.map((row) => ({
    id: Number(row.id),
    organizationId: String(row.organization_id),
    backupId: String(row.backup_id),
    status: String(row.verification_status) as WatchdogBackupVerificationStatus,
    checksumMatches: row.checksum_matches === null ? null : Boolean(row.checksum_matches),
    details: parseJsonRecord(row.details_json),
    errorMessage: row.error_message ? String(row.error_message) : null,
    verifiedBy: row.verified_by ? String(row.verified_by) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

/** Gets the most recent verification result for one backup. */
export async function getLatestWatchdogBackupVerification(params: {
  organizationId: string;
  backupId: string;
}): Promise<WatchdogBackupVerification | null> {
  const items = await listWatchdogBackupVerifications({
    organizationId: params.organizationId,
    backupId: params.backupId,
    limit: 1,
  });
  return items[0] ?? null;
}

/** Gets one backup verification record by identifier. */
export async function getWatchdogBackupVerificationById(params: {
  organizationId: string;
  id: number;
}): Promise<WatchdogBackupVerification | null> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, organization_id, backup_id, verification_status, checksum_matches, details_json, error_message,
             verified_by, created_at, updated_at
      FROM watchdog_backup_verifications
      WHERE organization_id = ? AND id = ?
      LIMIT 1
    `,
    [params.organizationId, params.id],
  );

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    id: Number(row.id),
    organizationId: String(row.organization_id),
    backupId: String(row.backup_id),
    status: String(row.verification_status) as WatchdogBackupVerificationStatus,
    checksumMatches: row.checksum_matches === null ? null : Boolean(row.checksum_matches),
    details: parseJsonRecord(row.details_json),
    errorMessage: row.error_message ? String(row.error_message) : null,
    verifiedBy: row.verified_by ? String(row.verified_by) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/** Creates one restore dry-run record. */
export async function createWatchdogRestoreDryRun(params: {
  organizationId: string;
  backupId: string;
  status: WatchdogRestoreDryRunStatus;
  riskLevel: "low" | "medium" | "high" | "critical";
  overwriteSummary?: Record<string, unknown> | null;
  warnings?: string[];
  requestedBy: string;
}): Promise<WatchdogRestoreDryRun> {
  await ensureOpsSchema();
  const pool = getOpsPool();
  const id = randomUUID();

  await pool.query(
    `
      INSERT INTO watchdog_restore_dry_runs
      (id, organization_id, backup_id, dry_run_status, risk_level, overwrite_summary_json, warnings_json, requested_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      params.organizationId,
      params.backupId,
      params.status,
      params.riskLevel,
      params.overwriteSummary ? JSON.stringify(params.overwriteSummary) : null,
      params.warnings ? JSON.stringify(params.warnings) : JSON.stringify([]),
      params.requestedBy,
    ],
  );

  const created = await getWatchdogRestoreDryRun({ organizationId: params.organizationId, id });
  if (!created) {
    throw new Error("Failed to read created restore dry-run record.");
  }
  return created;
}

/** Gets one restore dry-run by identifier. */
export async function getWatchdogRestoreDryRun(params: {
  organizationId: string;
  id: string;
}): Promise<WatchdogRestoreDryRun | null> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, organization_id, backup_id, dry_run_status, risk_level, overwrite_summary_json,
             warnings_json, requested_by, created_at
      FROM watchdog_restore_dry_runs
      WHERE organization_id = ? AND id = ?
      LIMIT 1
    `,
    [params.organizationId, params.id],
  );

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    id: String(row.id),
    organizationId: String(row.organization_id),
    backupId: String(row.backup_id),
    status: String(row.dry_run_status) as WatchdogRestoreDryRunStatus,
    riskLevel: String(row.risk_level) as WatchdogRestoreDryRun["riskLevel"],
    overwriteSummary: parseJsonRecord(row.overwrite_summary_json),
    warnings: parseJsonStringArray(row.warnings_json),
    requestedBy: String(row.requested_by),
    createdAt: new Date(row.created_at).toISOString(),
  };
}

/** Lists restore jobs for one organization. */
export async function listWatchdogRestoreJobs(params: {
  organizationId: string;
  limit?: number;
}): Promise<WatchdogRestoreJob[]> {
  await ensureOpsSchema();
  const pool = getOpsPool();
  const limit = Math.min(Math.max(params.limit ?? 100, 1), 300);

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, organization_id, backup_id, dry_run_id, restore_status, risk_level, break_glass_used,
             pre_restore_backup_id, requested_by, reason, report_json, error_message, created_at, updated_at
      FROM watchdog_restore_jobs
      WHERE organization_id = ?
      ORDER BY updated_at DESC
      LIMIT ?
    `,
    [params.organizationId, limit],
  );

  return rows.map((row) => ({
    id: String(row.id),
    organizationId: String(row.organization_id),
    backupId: String(row.backup_id),
    dryRunId: String(row.dry_run_id),
    status: String(row.restore_status) as WatchdogRestoreJobStatus,
    riskLevel: String(row.risk_level) as WatchdogRestoreJob["riskLevel"],
    breakGlassUsed: Boolean(row.break_glass_used),
    preRestoreBackupId: row.pre_restore_backup_id ? String(row.pre_restore_backup_id) : null,
    requestedBy: String(row.requested_by),
    reason: row.reason ? String(row.reason) : null,
    report: parseJsonRecord(row.report_json),
    errorMessage: row.error_message ? String(row.error_message) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  }));
}

/** Creates one restore execution job. */
export async function createWatchdogRestoreJob(params: {
  organizationId: string;
  backupId: string;
  dryRunId: string;
  status: WatchdogRestoreJobStatus;
  riskLevel: "low" | "medium" | "high" | "critical";
  breakGlassUsed: boolean;
  preRestoreBackupId?: string | null;
  requestedBy: string;
  reason?: string | null;
  report?: Record<string, unknown> | null;
  errorMessage?: string | null;
}): Promise<WatchdogRestoreJob> {
  await ensureOpsSchema();
  const pool = getOpsPool();
  const id = randomUUID();

  await pool.query(
    `
      INSERT INTO watchdog_restore_jobs
      (id, organization_id, backup_id, dry_run_id, restore_status, risk_level, break_glass_used,
       pre_restore_backup_id, requested_by, reason, report_json, error_message)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      params.organizationId,
      params.backupId,
      params.dryRunId,
      params.status,
      params.riskLevel,
      params.breakGlassUsed ? 1 : 0,
      params.preRestoreBackupId ?? null,
      params.requestedBy,
      params.reason?.trim() ? params.reason.trim() : null,
      params.report ? JSON.stringify(params.report) : null,
      params.errorMessage ?? null,
    ],
  );

  const jobs = await listWatchdogRestoreJobs({ organizationId: params.organizationId, limit: 200 });
  const match = jobs.find((job) => job.id === id);
  if (!match) {
    throw new Error("Failed to read created restore job.");
  }
  return match;
}

/** Updates one restore execution job. */
export async function updateWatchdogRestoreJob(params: {
  organizationId: string;
  id: string;
  status?: WatchdogRestoreJobStatus;
  preRestoreBackupId?: string | null;
  report?: Record<string, unknown> | null;
  errorMessage?: string | null;
}): Promise<WatchdogRestoreJob | null> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  const fields: string[] = [];
  const values: Array<string | number | null> = [];

  if (params.status !== undefined) {
    fields.push("restore_status = ?");
    values.push(params.status);
  }
  if (params.preRestoreBackupId !== undefined) {
    fields.push("pre_restore_backup_id = ?");
    values.push(params.preRestoreBackupId);
  }
  if (params.report !== undefined) {
    fields.push("report_json = ?");
    values.push(params.report ? JSON.stringify(params.report) : null);
  }
  if (params.errorMessage !== undefined) {
    fields.push("error_message = ?");
    values.push(params.errorMessage);
  }

  if (fields.length > 0) {
    values.push(params.organizationId, params.id);
    await pool.query(
      `
        UPDATE watchdog_restore_jobs
        SET ${fields.join(", ")}
        WHERE organization_id = ? AND id = ?
      `,
      values,
    );
  }

  const jobs = await listWatchdogRestoreJobs({ organizationId: params.organizationId, limit: 200 });
  return jobs.find((job) => job.id === params.id) ?? null;
}

/** Records one vault access audit event for reveal/copy/rotate/export operations. */
export async function recordWatchdogVaultAccessEvent(params: {
  organizationId: string;
  vaultEntryId: string;
  accessType: WatchdogVaultAccessType;
  accessedBy: string;
  reason?: string | null;
}): Promise<void> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  await pool.query(
    `
      INSERT INTO watchdog_vault_access_events
      (organization_id, vault_entry_id, access_type, accessed_by, reason)
      VALUES (?, ?, ?, ?, ?)
    `,
    [
      params.organizationId,
      params.vaultEntryId,
      params.accessType,
      params.accessedBy,
      params.reason?.trim() ? params.reason.trim() : null,
    ],
  );
}

/** Lists vault access events for an organization, optionally scoped to one vault entry. */
export async function listWatchdogVaultAccessEvents(params: {
  organizationId: string;
  vaultEntryId?: string;
  limit?: number;
}): Promise<WatchdogVaultAccessEvent[]> {
  await ensureOpsSchema();
  const pool = getOpsPool();
  const limit = Math.min(Math.max(params.limit ?? 200, 1), 500);

  const query = params.vaultEntryId
    ? `
      SELECT id, organization_id, vault_entry_id, access_type, accessed_by, reason, created_at
      FROM watchdog_vault_access_events
      WHERE organization_id = ? AND vault_entry_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `
    : `
      SELECT id, organization_id, vault_entry_id, access_type, accessed_by, reason, created_at
      FROM watchdog_vault_access_events
      WHERE organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `;

  const args = params.vaultEntryId
    ? [params.organizationId, params.vaultEntryId, limit]
    : [params.organizationId, limit];

  const [rows] = await pool.query<mysql.RowDataPacket[]>(query, args);

  return rows.map((row) => ({
    id: Number(row.id),
    organizationId: String(row.organization_id),
    vaultEntryId: String(row.vault_entry_id),
    accessType: String(row.access_type) as WatchdogVaultAccessType,
    accessedBy: String(row.accessed_by),
    reason: row.reason ? String(row.reason) : null,
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

/** Reads persisted Watchdog settings JSON for one organization. */
export async function getWatchdogSettings(organizationId: string): Promise<Record<string, unknown> | null> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT settings_json
      FROM watchdog_settings
      WHERE organization_id = ?
      LIMIT 1
    `,
    [organizationId],
  );

  if (rows.length === 0) return null;
  return parseJsonRecord(rows[0].settings_json);
}

/** Upserts persisted Watchdog settings JSON for one organization. */
export async function upsertWatchdogSettings(params: {
  organizationId: string;
  settings: Record<string, unknown>;
  updatedBy: string;
}): Promise<Record<string, unknown>> {
  await ensureOpsSchema();
  const pool = getOpsPool();

  await pool.query(
    `
      INSERT INTO watchdog_settings
      (organization_id, settings_json, updated_by)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        settings_json = VALUES(settings_json),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    [params.organizationId, JSON.stringify(params.settings), params.updatedBy],
  );

  return params.settings;
}
