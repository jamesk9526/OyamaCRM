/**
 * Watchdog secure store service.
 * Uses a dedicated external database and AES-256-GCM encryption for vault secrets.
 */
import { createHash, createCipheriv, createDecipheriv, randomUUID, randomBytes } from "crypto";
import mysql from "mysql2/promise";

interface EncryptedBlob {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface VaultSecretPayload {
  password: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface WatchdogVaultListItem {
  id: string;
  name: string;
  category: string;
  username: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
}

export interface WatchdogVaultRecord extends WatchdogVaultListItem {
  password?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface WatchdogSecurityEvent {
  id: string;
  organizationId: string | null;
  severity: "low" | "medium" | "high" | "critical";
  eventType: string;
  sourceModule: string;
  message: string;
  incidentStatus: WatchdogIncidentStatus;
  incidentUpdatedAt: string | null;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface WatchdogCrmBackupListItem {
  id: string;
  label: string;
  organizationId: string;
  sourceVersion: string;
  primaryTableCount: number;
  primaryRowCount: number;
  watchdogTableCount: number;
  watchdogRowCount: number;
  checksumSha256: string;
  createdBy: string;
  createdAt: string;
  restoredAt: string | null;
}

export interface WatchdogCrmBackupRecord extends WatchdogCrmBackupListItem {
  backupJson: string;
}

export type WatchdogIncidentStatus = "new" | "acknowledged" | "escalated" | "resolved";

export type WatchdogIncidentSource = "audit" | "watchdog";

export type WatchdogIncidentAction = "acknowledge" | "escalate" | "resolve";

export interface WatchdogIncidentState {
  sourceType: WatchdogIncidentSource;
  eventRef: string;
  incidentStatus: WatchdogIncidentStatus;
  lastAction: WatchdogIncidentAction;
  notes: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

let watchdogPool: mysql.Pool | null = null;
let schemaReady = false;

/** Resolves the effective Watchdog DB URL with a safe non-production fallback. */
function getEffectiveWatchdogDatabaseUrl(): string | undefined {
  const explicit = process.env.WATCHDOG_DATABASE_URL?.trim();
  if (explicit) return explicit;

  if (process.env.NODE_ENV !== "production") {
    return process.env.DATABASE_URL?.trim();
  }

  return undefined;
}

/** Checks whether the Watchdog secondary database is configured. */
export function isWatchdogDbConfigured(): boolean {
  return Boolean(getEffectiveWatchdogDatabaseUrl());
}

/** Checks whether the Watchdog encryption key is configured. */
export function isWatchdogEncryptionConfigured(): boolean {
  return Boolean(process.env.WATCHDOG_ENCRYPTION_KEY?.trim());
}

/** Gets a stable 32-byte cipher key derived from WATCHDOG_ENCRYPTION_KEY. */
function getCipherKey(): Buffer {
  const keySource = process.env.WATCHDOG_ENCRYPTION_KEY?.trim();
  if (!keySource) {
    throw new Error("WATCHDOG_ENCRYPTION_KEY is missing.");
  }

  if (/^[0-9a-fA-F]{64}$/.test(keySource)) {
    return Buffer.from(keySource, "hex");
  }

  return createHash("sha256").update(keySource).digest();
}

/** Gets or creates the pooled MySQL connection for the Watchdog database. */
function getWatchdogPool(): mysql.Pool {
  const databaseUrl = getEffectiveWatchdogDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("WATCHDOG_DATABASE_URL is missing (and no non-production DATABASE_URL fallback is available).");
  }

  if (!watchdogPool) {
    watchdogPool = mysql.createPool(databaseUrl);
  }

  return watchdogPool;
}

/** Adds one column only when it is currently missing from the table schema. */
async function ensureColumnExists(params: {
  pool: mysql.Pool;
  tableName: string;
  columnName: string;
  addColumnSql: string;
}): Promise<void> {
  const [rows] = await params.pool.query<mysql.RowDataPacket[]>(
    `
      SELECT 1
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        AND COLUMN_NAME = ?
      LIMIT 1
    `,
    [params.tableName, params.columnName],
  );

  if (rows.length === 0) {
    await params.pool.query(params.addColumnSql);
  }
}

/**
 * Ensures the external Watchdog schema exists.
 * Creates vault and security-event tables when they are missing.
 */
async function ensureWatchdogSchema(): Promise<void> {
  if (schemaReady) return;

  const pool = getWatchdogPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_vault_entries (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      entry_name VARCHAR(255) NOT NULL,
      entry_category VARCHAR(120) NOT NULL DEFAULT 'general',
      username VARCHAR(255) NULL,
      website VARCHAR(255) NULL,
      secret_ciphertext LONGTEXT NOT NULL,
      secret_iv VARCHAR(64) NOT NULL,
      secret_tag VARCHAR(64) NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      updated_by VARCHAR(64) NOT NULL,
      last_accessed_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_watchdog_vault_org_name (organization_id, entry_name),
      INDEX idx_watchdog_vault_org_category (organization_id, entry_category)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_security_events (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      organization_id VARCHAR(64) NULL,
      severity VARCHAR(20) NOT NULL DEFAULT 'medium',
      event_type VARCHAR(120) NOT NULL,
      source_module VARCHAR(80) NOT NULL,
      message VARCHAR(500) NOT NULL,
      payload_json LONGTEXT NULL,
      incident_status VARCHAR(24) NOT NULL DEFAULT 'new',
      incident_updated_at DATETIME NULL,
      incident_updated_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_watchdog_events_org_created (organization_id, created_at),
      INDEX idx_watchdog_events_severity_created (severity, created_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_incident_states (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      source_type VARCHAR(20) NOT NULL,
      event_ref VARCHAR(120) NOT NULL,
      incident_status VARCHAR(24) NOT NULL DEFAULT 'new',
      last_action VARCHAR(24) NOT NULL DEFAULT 'acknowledge',
      notes TEXT NULL,
      updated_by VARCHAR(64) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_watchdog_incident_ref (organization_id, source_type, event_ref),
      INDEX idx_watchdog_incident_status (organization_id, incident_status, updated_at)
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchdog_crm_backups (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      backup_label VARCHAR(180) NOT NULL,
      source_version VARCHAR(80) NOT NULL,
      primary_table_count INT NOT NULL DEFAULT 0,
      primary_row_count BIGINT NOT NULL DEFAULT 0,
      watchdog_table_count INT NOT NULL DEFAULT 0,
      watchdog_row_count BIGINT NOT NULL DEFAULT 0,
      checksum_sha256 VARCHAR(64) NOT NULL,
      backup_json LONGTEXT NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      restored_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_watchdog_backup_org_created (organization_id, created_at),
      INDEX idx_watchdog_backup_org_restored (organization_id, restored_at)
    )
  `);

  // Backfill newer incident columns when the table was created before the workflow upgrade.
  await ensureColumnExists({
    pool,
    tableName: "watchdog_security_events",
    columnName: "incident_status",
    addColumnSql: "ALTER TABLE watchdog_security_events ADD COLUMN incident_status VARCHAR(24) NOT NULL DEFAULT 'new'",
  });
  await ensureColumnExists({
    pool,
    tableName: "watchdog_security_events",
    columnName: "incident_updated_at",
    addColumnSql: "ALTER TABLE watchdog_security_events ADD COLUMN incident_updated_at DATETIME NULL",
  });
  await ensureColumnExists({
    pool,
    tableName: "watchdog_security_events",
    columnName: "incident_updated_by",
    addColumnSql: "ALTER TABLE watchdog_security_events ADD COLUMN incident_updated_by VARCHAR(64) NULL",
  });

  schemaReady = true;
}

/** Encrypts JSON payload using AES-256-GCM. */
function encryptPayload(payload: VaultSecretPayload): EncryptedBlob {
  const key = getCipherKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const serialized = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

/** Decrypts an AES-256-GCM JSON payload. */
function decryptPayload(blob: EncryptedBlob): VaultSecretPayload {
  const key = getCipherKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "base64"));
  decipher.setAuthTag(Buffer.from(blob.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(blob.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");

  return JSON.parse(plaintext) as VaultSecretPayload;
}

/** Probes the external Watchdog database and encryption state. */
export async function getWatchdogHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  encryptionReady: boolean;
  message: string;
}> {
  const configured = isWatchdogDbConfigured();
  const encryptionReady = isWatchdogEncryptionConfigured();

  if (!configured) {
    return {
      configured: false,
      connected: false,
      encryptionReady,
      message: "WATCHDOG_DATABASE_URL is not configured.",
    };
  }

  try {
    await ensureWatchdogSchema();
    const pool = getWatchdogPool();
    await pool.query("SELECT 1");
    return {
      configured: true,
      connected: true,
      encryptionReady,
      message: encryptionReady
        ? "Watchdog database connected and encryption key loaded."
        : "Watchdog database connected but WATCHDOG_ENCRYPTION_KEY is missing.",
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      encryptionReady,
      message: error instanceof Error ? error.message : "Unknown Watchdog DB error.",
    };
  }
}

/** Lists encrypted vault entry metadata without revealing secrets. */
export async function listWatchdogVaultEntries(organizationId: string): Promise<WatchdogVaultListItem[]> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, entry_name, entry_category, username, website, created_at, updated_at, last_accessed_at
      FROM watchdog_vault_entries
      WHERE organization_id = ?
      ORDER BY updated_at DESC
      LIMIT 300
    `,
    [organizationId],
  );

  return rows.map((row) => ({
    id: String(row.id),
    name: String(row.entry_name),
    category: String(row.entry_category),
    username: row.username ? String(row.username) : null,
    website: row.website ? String(row.website) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at).toISOString() : null,
  }));
}

/** Creates a new encrypted vault entry in the external Watchdog database. */
export async function createWatchdogVaultEntry(params: {
  organizationId: string;
  createdBy: string;
  name: string;
  category?: string;
  username?: string;
  website?: string;
  password: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}): Promise<WatchdogVaultListItem> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();

  const id = randomUUID();
  const encrypted = encryptPayload({
    password: params.password,
    notes: params.notes,
    metadata: params.metadata,
  });

  await pool.query(
    `
      INSERT INTO watchdog_vault_entries
      (id, organization_id, entry_name, entry_category, username, website, secret_ciphertext, secret_iv, secret_tag, created_by, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      params.organizationId,
      params.name,
      params.category ?? "general",
      params.username ?? null,
      params.website ?? null,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
      params.createdBy,
      params.createdBy,
    ],
  );

  return {
    id,
    name: params.name,
    category: params.category ?? "general",
    username: params.username ?? null,
    website: params.website ?? null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: null,
  };
}

/** Reads one vault record; optionally includes decrypted secret fields. */
export async function getWatchdogVaultEntry(params: {
  organizationId: string;
  id: string;
  revealSecret: boolean;
}): Promise<WatchdogVaultRecord | null> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, entry_name, entry_category, username, website,
             secret_ciphertext, secret_iv, secret_tag,
             created_at, updated_at, last_accessed_at
      FROM watchdog_vault_entries
      WHERE organization_id = ? AND id = ?
      LIMIT 1
    `,
    [params.organizationId, params.id],
  );

  if (rows.length === 0) return null;
  const row = rows[0];

  const baseRecord: WatchdogVaultRecord = {
    id: String(row.id),
    name: String(row.entry_name),
    category: String(row.entry_category),
    username: row.username ? String(row.username) : null,
    website: row.website ? String(row.website) : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at).toISOString() : null,
  };

  if (!params.revealSecret) {
    return baseRecord;
  }

  const decrypted = decryptPayload({
    ciphertext: String(row.secret_ciphertext),
    iv: String(row.secret_iv),
    tag: String(row.secret_tag),
  });

  await pool.query(
    `UPDATE watchdog_vault_entries SET last_accessed_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND id = ?`,
    [params.organizationId, params.id],
  );

  return {
    ...baseRecord,
    password: decrypted.password,
    notes: decrypted.notes,
    metadata: decrypted.metadata,
    lastAccessedAt: new Date().toISOString(),
  };
}

/** Upserts a security event in the external Watchdog database. */
export async function recordWatchdogSecurityEvent(event: {
  organizationId?: string;
  severity: "low" | "medium" | "high" | "critical";
  eventType: string;
  sourceModule: string;
  message: string;
  incidentStatus?: WatchdogIncidentStatus;
  incidentUpdatedBy?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();

  await pool.query(
    `
      INSERT INTO watchdog_security_events
      (organization_id, severity, event_type, source_module, message, payload_json, incident_status, incident_updated_at, incident_updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
    `,
    [
      event.organizationId ?? null,
      event.severity,
      event.eventType,
      event.sourceModule,
      event.message,
      event.payload ? JSON.stringify(event.payload) : null,
      event.incidentStatus ?? "new",
      event.incidentUpdatedBy ?? null,
    ],
  );
}

/** Returns incident state overrides for a set of feed refs in one source domain. */
export async function listWatchdogIncidentStates(params: {
  organizationId: string;
  sourceType: WatchdogIncidentSource;
  refs: string[];
}): Promise<Record<string, WatchdogIncidentState>> {
  await ensureWatchdogSchema();
  if (params.refs.length === 0) return {};

  const pool = getWatchdogPool();
  const placeholders = params.refs.map(() => "?").join(", ");

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT source_type, event_ref, incident_status, last_action, notes, updated_by, updated_at
      FROM watchdog_incident_states
      WHERE organization_id = ?
        AND source_type = ?
        AND event_ref IN (${placeholders})
    `,
    [params.organizationId, params.sourceType, ...params.refs],
  );

  const stateMap: Record<string, WatchdogIncidentState> = {};
  for (const row of rows) {
    const key = String(row.event_ref);
    stateMap[key] = {
      sourceType: String(row.source_type) as WatchdogIncidentSource,
      eventRef: key,
      incidentStatus: String(row.incident_status) as WatchdogIncidentStatus,
      lastAction: String(row.last_action) as WatchdogIncidentAction,
      notes: row.notes ? String(row.notes) : null,
      updatedBy: row.updated_by ? String(row.updated_by) : null,
      updatedAt: new Date(row.updated_at).toISOString(),
    };
  }

  return stateMap;
}

/** Writes or updates one incident workflow state record for a feed item. */
export async function upsertWatchdogIncidentState(params: {
  organizationId: string;
  sourceType: WatchdogIncidentSource;
  eventRef: string;
  action: WatchdogIncidentAction;
  updatedBy: string;
  notes?: string;
}): Promise<WatchdogIncidentState> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();
  const nextStatus: WatchdogIncidentStatus =
    params.action === "acknowledge"
      ? "acknowledged"
      : params.action === "escalate"
        ? "escalated"
        : "resolved";

  await pool.query(
    `
      INSERT INTO watchdog_incident_states
      (organization_id, source_type, event_ref, incident_status, last_action, notes, updated_by)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        incident_status = VALUES(incident_status),
        last_action = VALUES(last_action),
        notes = VALUES(notes),
        updated_by = VALUES(updated_by),
        updated_at = CURRENT_TIMESTAMP
    `,
    [
      params.organizationId,
      params.sourceType,
      params.eventRef,
      nextStatus,
      params.action,
      params.notes?.trim() ? params.notes.trim() : null,
      params.updatedBy,
    ],
  );

  if (params.sourceType === "watchdog") {
    await pool.query(
      `
        UPDATE watchdog_security_events
        SET incident_status = ?, incident_updated_at = CURRENT_TIMESTAMP, incident_updated_by = ?
        WHERE (organization_id = ? OR organization_id IS NULL) AND id = ?
      `,
      [nextStatus, params.updatedBy, params.organizationId, params.eventRef],
    );
  }

  const latestMap = await listWatchdogIncidentStates({
    organizationId: params.organizationId,
    sourceType: params.sourceType,
    refs: [params.eventRef],
  });

  return latestMap[params.eventRef] ?? {
    sourceType: params.sourceType,
    eventRef: params.eventRef,
    incidentStatus: nextStatus,
    lastAction: params.action,
    notes: params.notes?.trim() ? params.notes.trim() : null,
    updatedBy: params.updatedBy,
    updatedAt: new Date().toISOString(),
  };
}

/** Returns recent external security events from the Watchdog database. */
export async function listWatchdogSecurityEvents(params: {
  organizationId: string;
  limit: number;
}): Promise<WatchdogSecurityEvent[]> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, organization_id, severity, event_type, source_module, message, payload_json, created_at
              , incident_status, incident_updated_at
      FROM watchdog_security_events
      WHERE organization_id = ? OR organization_id IS NULL
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [params.organizationId, params.limit],
  );

  return rows.map((row) => ({
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    severity: String(row.severity) as WatchdogSecurityEvent["severity"],
    eventType: String(row.event_type),
    sourceModule: String(row.source_module),
    message: String(row.message),
    incidentStatus: row.incident_status
      ? (String(row.incident_status) as WatchdogIncidentStatus)
      : "new",
    incidentUpdatedAt: row.incident_updated_at ? new Date(row.incident_updated_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    payload: row.payload_json ? (JSON.parse(String(row.payload_json)) as Record<string, unknown>) : undefined,
  }));
}

/** Returns one external Watchdog event by ID scoped to organization ownership. */
export async function getWatchdogSecurityEventById(params: {
  organizationId: string;
  id: string;
}): Promise<WatchdogSecurityEvent | null> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, organization_id, severity, event_type, source_module, message, payload_json, created_at,
             incident_status, incident_updated_at
      FROM watchdog_security_events
      WHERE (organization_id = ? OR organization_id IS NULL) AND id = ?
      LIMIT 1
    `,
    [params.organizationId, params.id],
  );

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    id: String(row.id),
    organizationId: row.organization_id ? String(row.organization_id) : null,
    severity: String(row.severity) as WatchdogSecurityEvent["severity"],
    eventType: String(row.event_type),
    sourceModule: String(row.source_module),
    message: String(row.message),
    incidentStatus: row.incident_status
      ? (String(row.incident_status) as WatchdogIncidentStatus)
      : "new",
    incidentUpdatedAt: row.incident_updated_at ? new Date(row.incident_updated_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    payload: row.payload_json ? (JSON.parse(String(row.payload_json)) as Record<string, unknown>) : undefined,
  };
}

/** Persists a full CRM backup bundle in the Watchdog external database. */
export async function createWatchdogCrmBackup(params: {
  organizationId: string;
  label: string;
  sourceVersion: string;
  primaryTableCount: number;
  primaryRowCount: number;
  watchdogTableCount: number;
  watchdogRowCount: number;
  backupJson: string;
  createdBy: string;
}): Promise<WatchdogCrmBackupListItem> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();
  const id = randomUUID();
  const checksumSha256 = createHash("sha256").update(params.backupJson).digest("hex");

  await pool.query(
    `
      INSERT INTO watchdog_crm_backups
      (id, organization_id, backup_label, source_version, primary_table_count, primary_row_count,
       watchdog_table_count, watchdog_row_count, checksum_sha256, backup_json, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      params.organizationId,
      params.label,
      params.sourceVersion,
      params.primaryTableCount,
      params.primaryRowCount,
      params.watchdogTableCount,
      params.watchdogRowCount,
      checksumSha256,
      params.backupJson,
      params.createdBy,
    ],
  );

  return {
    id,
    label: params.label,
    organizationId: params.organizationId,
    sourceVersion: params.sourceVersion,
    primaryTableCount: params.primaryTableCount,
    primaryRowCount: params.primaryRowCount,
    watchdogTableCount: params.watchdogTableCount,
    watchdogRowCount: params.watchdogRowCount,
    checksumSha256,
    createdBy: params.createdBy,
    createdAt: new Date().toISOString(),
    restoredAt: null,
  };
}

/** Lists recent CRM backup bundles saved from Watchdog. */
export async function listWatchdogCrmBackups(params: {
  organizationId: string;
  limit?: number;
}): Promise<WatchdogCrmBackupListItem[]> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();
  const limit = Math.min(Math.max(params.limit ?? 20, 1), 100);

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, organization_id, backup_label, source_version, primary_table_count, primary_row_count,
             watchdog_table_count, watchdog_row_count, checksum_sha256, created_by, created_at, restored_at
      FROM watchdog_crm_backups
      WHERE organization_id = ?
      ORDER BY created_at DESC
      LIMIT ?
    `,
    [params.organizationId, limit],
  );

  return rows.map((row) => ({
    id: String(row.id),
    label: String(row.backup_label),
    organizationId: String(row.organization_id),
    sourceVersion: String(row.source_version),
    primaryTableCount: Number(row.primary_table_count ?? 0),
    primaryRowCount: Number(row.primary_row_count ?? 0),
    watchdogTableCount: Number(row.watchdog_table_count ?? 0),
    watchdogRowCount: Number(row.watchdog_row_count ?? 0),
    checksumSha256: String(row.checksum_sha256),
    createdBy: String(row.created_by),
    createdAt: new Date(row.created_at).toISOString(),
    restoredAt: row.restored_at ? new Date(row.restored_at).toISOString() : null,
  }));
}

/** Loads one CRM backup bundle by ID for import/download workflows. */
export async function getWatchdogCrmBackup(params: {
  organizationId: string;
  id: string;
}): Promise<WatchdogCrmBackupRecord | null> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, organization_id, backup_label, source_version, primary_table_count, primary_row_count,
             watchdog_table_count, watchdog_row_count, checksum_sha256, backup_json, created_by, created_at, restored_at
      FROM watchdog_crm_backups
      WHERE organization_id = ? AND id = ?
      LIMIT 1
    `,
    [params.organizationId, params.id],
  );

  if (rows.length === 0) return null;
  const row = rows[0];

  return {
    id: String(row.id),
    label: String(row.backup_label),
    organizationId: String(row.organization_id),
    sourceVersion: String(row.source_version),
    primaryTableCount: Number(row.primary_table_count ?? 0),
    primaryRowCount: Number(row.primary_row_count ?? 0),
    watchdogTableCount: Number(row.watchdog_table_count ?? 0),
    watchdogRowCount: Number(row.watchdog_row_count ?? 0),
    checksumSha256: String(row.checksum_sha256),
    backupJson: String(row.backup_json),
    createdBy: String(row.created_by),
    createdAt: new Date(row.created_at).toISOString(),
    restoredAt: row.restored_at ? new Date(row.restored_at).toISOString() : null,
  };
}

/** Marks one backup bundle as restored after a successful import run. */
export async function markWatchdogCrmBackupRestored(params: {
  organizationId: string;
  id: string;
}): Promise<void> {
  await ensureWatchdogSchema();
  const pool = getWatchdogPool();

  await pool.query(
    `
      UPDATE watchdog_crm_backups
      SET restored_at = CURRENT_TIMESTAMP
      WHERE organization_id = ? AND id = ?
    `,
    [params.organizationId, params.id],
  );
}
