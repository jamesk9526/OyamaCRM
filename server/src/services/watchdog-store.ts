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

/** Checks whether the Watchdog secondary database is configured. */
export function isWatchdogDbConfigured(): boolean {
  return Boolean(process.env.WATCHDOG_DATABASE_URL?.trim());
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
  const databaseUrl = process.env.WATCHDOG_DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error("WATCHDOG_DATABASE_URL is missing.");
  }

  if (!watchdogPool) {
    watchdogPool = mysql.createPool(databaseUrl);
  }

  return watchdogPool;
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

  // Backfill newer incident columns when the table was created before the workflow upgrade.
  await pool.query(`ALTER TABLE watchdog_security_events ADD COLUMN IF NOT EXISTS incident_status VARCHAR(24) NOT NULL DEFAULT 'new'`);
  await pool.query(`ALTER TABLE watchdog_security_events ADD COLUMN IF NOT EXISTS incident_updated_at DATETIME NULL`);
  await pool.query(`ALTER TABLE watchdog_security_events ADD COLUMN IF NOT EXISTS incident_updated_by VARCHAR(64) NULL`);

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
