/**
 * OyamaPASSWORD secure store service.
 * Uses the primary Prisma database and auto-bootstraps schema + encryption key file.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "../lib/prisma.js";

interface EncryptedBlob {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface PasswordSecretPayload {
  password: string;
  notes?: string;
  hasMfa?: boolean;
  mfaMethod?: string;
  mfaConnectedTo?: string;
}

interface LockedBackupEnvelope {
  format: "oyama-password.locked-backup.v1";
  organizationId: string;
  createdAt: string;
  iv: string;
  tag: string;
  ciphertext: string;
  checksumSha256: string;
}

interface BackupPayloadEntry {
  id: string;
  title: string;
  username: string | null;
  website: string | null;
  ownerUserId: string;
  password: string;
  notes?: string;
  hasMfa?: boolean;
  mfaMethod?: string;
  mfaConnectedTo?: string;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
}

interface BackupPayloadShare {
  entryId: string;
  sharedWithUserId: string;
  canEdit: boolean;
  createdBy: string;
  createdAt: string;
}

interface BackupPayload {
  format: "oyama-password.backup.payload.v1";
  organizationId: string;
  exportedAt: string;
  entries: BackupPayloadEntry[];
  shares: BackupPayloadShare[];
}

interface EntryRow {
  id: string;
  entry_title: string;
  username: string | null;
  website: string | null;
  owner_user_id: string;
  secret_ciphertext: string;
  secret_iv: string;
  secret_tag: string;
  created_at: Date;
  updated_at: Date;
  last_accessed_at: Date | null;
}

interface ShareRow {
  entry_id: string;
  shared_with_user_id: string;
  can_edit: number;
  created_by: string;
  created_at: Date;
}

interface AccessRow {
  owner_user_id: string;
  can_edit: number | null;
}

interface PinRow {
  pin_hash: string;
  last_verified_at: Date | null;
}

interface SessionRow {
  id: string;
  expires_at: Date;
}

export interface OyamaPasswordEntryListItem {
  id: string;
  title: string;
  username: string | null;
  website: string | null;
  ownerUserId: string;
  canEdit: boolean;
  sharedByYou: boolean;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
}

export interface OyamaPasswordEntryRecord extends OyamaPasswordEntryListItem {
  password?: string;
  notes?: string;
  hasMfa?: boolean;
  mfaMethod?: string;
  mfaConnectedTo?: string;
}

export interface OyamaPasswordShareItem {
  sharedWithUserId: string;
  canEdit: boolean;
  createdBy: string;
  createdAt: string;
}

export interface OyamaPasswordBackupListItem {
  id: string;
  label: string;
  organizationId: string;
  fileName: string;
  checksumSha256: string;
  createdBy: string;
  createdAt: string;
  restoredAt: string | null;
}

let schemaReady = false;
let cachedCipherKey: Buffer | null = null;

function getDefaultKeyFilePath(): string {
  const cwd = process.cwd();
  if (path.basename(cwd).toLowerCase() === "server") {
    return path.resolve(cwd, ".secrets", "oyama-password.key");
  }
  return path.resolve(cwd, "server", ".secrets", "oyama-password.key");
}

function getKeyFileCandidates(): string[] {
  const configuredPath = process.env.OYAMA_PASSWORD_KEY_FILE_PATH?.trim();
  const cwd = process.cwd();
  const candidates = [
    configuredPath ? path.resolve(configuredPath) : null,
    getDefaultKeyFilePath(),
    path.resolve(cwd, ".secrets", "oyama-password.key"),
    path.resolve(cwd, "server", ".secrets", "oyama-password.key"),
    path.resolve(cwd, "..", "server", ".secrets", "oyama-password.key"),
  ].filter((value): value is string => Boolean(value));

  return Array.from(new Set(candidates));
}

function getKeyFilePath(): string {
  const configuredPath = process.env.OYAMA_PASSWORD_KEY_FILE_PATH?.trim();
  if (configuredPath) {
    return path.resolve(configuredPath);
  }
  return getDefaultKeyFilePath();
}

function normalizeKeySourceToCipherKey(keySourceRaw: string): Buffer {
  return /^[0-9a-fA-F]{64}$/.test(keySourceRaw)
    ? Buffer.from(keySourceRaw, "hex")
    : createHash("sha256").update(keySourceRaw).digest();
}

async function readExistingFileKeys(): Promise<string[]> {
  const found: string[] = [];
  for (const filePath of getKeyFileCandidates()) {
    try {
      const existing = (await fs.readFile(filePath, "utf8")).trim();
      if (existing) found.push(existing);
    } catch {
      // Continue scanning known key file locations.
    }
  }
  return Array.from(new Set(found));
}

async function readOrCreateFileKey(): Promise<string> {
  const existingKeys = await readExistingFileKeys();
  if (existingKeys.length > 0) {
    return existingKeys[0];
  }

  const filePath = getKeyFilePath();
  const generatedHex = randomBytes(32).toString("hex");
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, `${generatedHex}\n`, { mode: 0o600 });
  return generatedHex;
}

async function getCipherKeyCandidates(): Promise<Buffer[]> {
  const keySources = [
    process.env.OYAMA_PASSWORD_ENCRYPTION_KEY?.trim() || null,
    ...(await readExistingFileKeys()),
  ].filter((value): value is string => Boolean(value));

  if (keySources.length === 0) {
    keySources.push(await readOrCreateFileKey());
  }

  const normalized = keySources.map((source) => normalizeKeySourceToCipherKey(source));
  const deduped: Buffer[] = [];
  const seen = new Set<string>();
  for (const key of normalized) {
    const fingerprint = key.toString("hex");
    if (seen.has(fingerprint)) continue;
    seen.add(fingerprint);
    deduped.push(key);
  }
  return deduped;
}

async function getCipherKey(): Promise<Buffer> {
  if (cachedCipherKey) return cachedCipherKey;

  const keySourceRaw = process.env.OYAMA_PASSWORD_ENCRYPTION_KEY?.trim() || (await readOrCreateFileKey());
  const key = normalizeKeySourceToCipherKey(keySourceRaw);

  cachedCipherKey = key;
  return key;
}

async function hashUserPin(params: { organizationId: string; userId: string; pin: string; cipherKey?: Buffer }): Promise<string> {
  const key = params.cipherKey ?? await getCipherKey();
  return createHash("sha256")
    .update(`${params.organizationId}:${params.userId}:${params.pin}:${key.toString("hex")}`)
    .digest("hex");
}

function hashUserPinLegacy(params: { organizationId: string; userId: string; pin: string }): string {
  return createHash("sha256")
    .update(`${params.organizationId}:${params.userId}:${params.pin}`)
    .digest("hex");
}

function isAdminRole(role?: string | null): boolean {
  const normalized = String(role ?? "").toLowerCase();
  return normalized === "admin" || normalized === "super_admin";
}

export function isOyamaPasswordDbConfigured(): boolean {
  return true;
}

export function isOyamaPasswordEncryptionConfigured(): boolean {
  return true;
}

async function ensurePasswordSchema(): Promise<void> {
  if (schemaReady) return;

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS oyama_password_entries (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      owner_user_id VARCHAR(64) NOT NULL,
      entry_title VARCHAR(255) NOT NULL,
      username VARCHAR(255) NULL,
      website VARCHAR(255) NULL,
      secret_ciphertext LONGTEXT NOT NULL,
      secret_iv VARCHAR(64) NOT NULL,
      secret_tag VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      last_accessed_at DATETIME NULL,
      INDEX idx_oyama_password_org_owner (organization_id, owner_user_id),
      INDEX idx_oyama_password_org_updated (organization_id, updated_at)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS oyama_password_shares (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      entry_id VARCHAR(64) NOT NULL,
      shared_with_user_id VARCHAR(64) NOT NULL,
      can_edit TINYINT(1) NOT NULL DEFAULT 0,
      created_by VARCHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_oyama_password_share (entry_id, shared_with_user_id),
      INDEX idx_oyama_password_share_org_user (organization_id, shared_with_user_id)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS oyama_password_access_events (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      entry_id VARCHAR(64) NOT NULL,
      actor_user_id VARCHAR(64) NOT NULL,
      action_type VARCHAR(40) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_oyama_password_access_org_created (organization_id, created_at),
      INDEX idx_oyama_password_access_entry (entry_id, created_at)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS oyama_password_backups (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      backup_label VARCHAR(180) NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      checksum_sha256 VARCHAR(64) NOT NULL,
      locked_payload LONGTEXT NOT NULL,
      created_by VARCHAR(64) NOT NULL,
      restored_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_oyama_password_backups_org_created (organization_id, created_at),
      INDEX idx_oyama_password_backups_org_restored (organization_id, restored_at)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS oyama_password_user_pins (
      organization_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      pin_hash VARCHAR(128) NOT NULL,
      last_verified_at DATETIME NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (organization_id, user_id),
      INDEX idx_oyama_password_pin_verified (organization_id, last_verified_at)
    )
  `);

  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS oyama_password_pin_sessions (
      id VARCHAR(64) NOT NULL PRIMARY KEY,
      organization_id VARCHAR(64) NOT NULL,
      user_id VARCHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_seen_at DATETIME NULL,
      INDEX idx_oyama_password_pin_session_user (organization_id, user_id, expires_at)
    )
  `);

  schemaReady = true;
}

async function encryptPayload(payload: PasswordSecretPayload): Promise<EncryptedBlob> {
  const key = await getCipherKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    ciphertext: ciphertext.toString("base64"),
  };
}

async function decryptPayload(blob: EncryptedBlob): Promise<PasswordSecretPayload> {
  const keys = await getCipherKeyCandidates();
  let lastError: unknown = null;

  for (const key of keys) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(blob.iv, "hex"));
      decipher.setAuthTag(Buffer.from(blob.tag, "hex"));
      const plaintext = Buffer.concat([
        decipher.update(Buffer.from(blob.ciphertext, "base64")),
        decipher.final(),
      ]).toString("utf8");

      const parsed = JSON.parse(plaintext) as PasswordSecretPayload;
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid OyamaPASSWORD secret payload.");
      }
      return {
        password: parsed.password ?? "",
        notes: parsed.notes,
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw (lastError instanceof Error ? lastError : new Error("Invalid OyamaPASSWORD secret payload."));
}

async function encryptLockedBackupPayload(payload: BackupPayload): Promise<LockedBackupEnvelope> {
  const key = await getCipherKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const serialized = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(serialized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const checksumSha256 = createHash("sha256").update(ciphertext).digest("hex");

  return {
    format: "oyama-password.locked-backup.v1",
    organizationId: payload.organizationId,
    createdAt: new Date().toISOString(),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    checksumSha256,
  };
}

async function decryptLockedBackupPayload(lockedFileContents: string): Promise<BackupPayload> {
  const parsed = JSON.parse(lockedFileContents) as LockedBackupEnvelope;
  if (parsed.format !== "oyama-password.locked-backup.v1") {
    throw new Error("Unsupported backup file format.");
  }

  const ciphertextBuffer = Buffer.from(parsed.ciphertext, "base64");
  const checksum = createHash("sha256").update(ciphertextBuffer).digest("hex");
  if (checksum !== parsed.checksumSha256) {
    throw new Error("Backup checksum validation failed.");
  }

  const key = await getCipherKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(parsed.iv, "base64"));
  decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));

  const plaintext = Buffer.concat([
    decipher.update(ciphertextBuffer),
    decipher.final(),
  ]).toString("utf8");

  const payload = JSON.parse(plaintext) as BackupPayload;
  if (payload.format !== "oyama-password.backup.payload.v1") {
    throw new Error("Backup payload is invalid.");
  }
  return payload;
}

async function recordAccessEvent(params: {
  organizationId: string;
  entryId: string;
  actorUserId: string;
  actionType: "create" | "update" | "delete" | "reveal" | "share" | "unshare" | "backup_create" | "backup_restore";
}): Promise<void> {
  await ensurePasswordSchema();
  await prisma.$executeRaw`
    INSERT INTO oyama_password_access_events
    (organization_id, entry_id, actor_user_id, action_type)
    VALUES (${params.organizationId}, ${params.entryId}, ${params.actorUserId}, ${params.actionType})
  `;
}

async function resolveEntryAccess(params: {
  organizationId: string;
  entryId: string;
  userId: string;
  role?: string | null;
}): Promise<{ allowed: boolean; canEdit: boolean; isOwner: boolean }> {
  await ensurePasswordSchema();
  const rows = await prisma.$queryRaw<AccessRow[]>`
    SELECT e.owner_user_id, s.can_edit
    FROM oyama_password_entries e
    LEFT JOIN oyama_password_shares s
      ON s.entry_id = e.id
      AND s.organization_id = e.organization_id
      AND s.shared_with_user_id = ${params.userId}
    WHERE e.organization_id = ${params.organizationId}
      AND e.id = ${params.entryId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return { allowed: false, canEdit: false, isOwner: false };
  }

  const row = rows[0];
  const isOwner = String(row.owner_user_id) === params.userId;
  if (isAdminRole(params.role)) {
    return { allowed: true, canEdit: true, isOwner };
  }

  const shareCanEdit = Number(row.can_edit ?? 0) === 1;
  return {
    allowed: isOwner || row.can_edit !== null,
    canEdit: isOwner || shareCanEdit,
    isOwner,
  };
}

export async function getOyamaPasswordHealth(): Promise<{
  configured: boolean;
  connected: boolean;
  encryptionReady: boolean;
  message: string;
}> {
  try {
    await ensurePasswordSchema();
    await getCipherKey();
    await prisma.$queryRaw`SELECT 1`;
    return {
      configured: true,
      connected: true,
      encryptionReady: true,
      message: "OyamaPASSWORD using primary database with automatic encryption key-file bootstrap.",
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      encryptionReady: false,
      message: error instanceof Error ? error.message : "Unknown OyamaPASSWORD DB error.",
    };
  }
}

export async function getOyamaPasswordPinStatus(params: {
  organizationId: string;
  userId: string;
}): Promise<{ hasPin: boolean; lastVerifiedAt: string | null }> {
  await ensurePasswordSchema();
  const rows = await prisma.$queryRaw<PinRow[]>`
    SELECT pin_hash, last_verified_at
    FROM oyama_password_user_pins
    WHERE organization_id = ${params.organizationId}
      AND user_id = ${params.userId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    return { hasPin: false, lastVerifiedAt: null };
  }

  return {
    hasPin: true,
    lastVerifiedAt: rows[0].last_verified_at ? new Date(rows[0].last_verified_at).toISOString() : null,
  };
}

export async function setupOyamaPasswordPin(params: {
  organizationId: string;
  userId: string;
  pin: string;
}): Promise<{ sessionToken: string; expiresAt: string }> {
  await ensurePasswordSchema();
  const normalizedPin = String(params.pin ?? "").trim();
  if (!/^\d{4,10}$/.test(normalizedPin)) {
    throw new Error("PIN must be 4-10 digits.");
  }

  const pinHash = await hashUserPin({
    organizationId: params.organizationId,
    userId: params.userId,
    pin: normalizedPin,
  });

  await prisma.$executeRaw`
    INSERT INTO oyama_password_user_pins
    (organization_id, user_id, pin_hash, last_verified_at)
    VALUES (${params.organizationId}, ${params.userId}, ${pinHash}, CURRENT_TIMESTAMP)
    ON DUPLICATE KEY UPDATE
      pin_hash = VALUES(pin_hash),
      last_verified_at = CURRENT_TIMESTAMP
  `;

  return verifyOyamaPasswordPin(params);
}

export async function verifyOyamaPasswordPin(params: {
  organizationId: string;
  userId: string;
  pin: string;
}): Promise<{ sessionToken: string; expiresAt: string }> {
  await ensurePasswordSchema();

  const rows = await prisma.$queryRaw<PinRow[]>`
    SELECT pin_hash, last_verified_at
    FROM oyama_password_user_pins
    WHERE organization_id = ${params.organizationId}
      AND user_id = ${params.userId}
    LIMIT 1
  `;
  if (rows.length === 0) {
    throw new Error("PIN has not been set for this account.");
  }

  const normalizedPin = String(params.pin ?? "").trim();
  const keyCandidates = await getCipherKeyCandidates();
  const supportedHashes: string[] = [];
  const seenHashes = new Set<string>();

  for (const key of keyCandidates) {
    const candidate = await hashUserPin({
      organizationId: params.organizationId,
      userId: params.userId,
      pin: normalizedPin,
      cipherKey: key,
    });
    if (!seenHashes.has(candidate)) {
      seenHashes.add(candidate);
      supportedHashes.push(candidate);
    }
  }

  // Backward compatibility for previously deployed unkeyed PIN hashing.
  const legacyCandidate = hashUserPinLegacy({
    organizationId: params.organizationId,
    userId: params.userId,
    pin: normalizedPin,
  });
  if (!seenHashes.has(legacyCandidate)) {
    seenHashes.add(legacyCandidate);
    supportedHashes.push(legacyCandidate);
  }

  const storedHash = String(rows[0].pin_hash);
  const matched = supportedHashes.includes(storedHash);

  if (!matched) {
    throw new Error("Invalid PIN.");
  }

  // Self-heal: after successful verify, persist current canonical hash for future checks.
  const canonicalHash = await hashUserPin({
    organizationId: params.organizationId,
    userId: params.userId,
    pin: normalizedPin,
  });
  if (storedHash !== canonicalHash) {
    await prisma.$executeRaw`
      UPDATE oyama_password_user_pins
      SET pin_hash = ${canonicalHash}, updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ${params.organizationId}
        AND user_id = ${params.userId}
    `;
  }

  const sessionToken = randomUUID();
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 12);

  await prisma.$executeRaw`
    INSERT INTO oyama_password_pin_sessions
    (id, organization_id, user_id, expires_at, last_seen_at)
    VALUES (${sessionToken}, ${params.organizationId}, ${params.userId}, ${expiresAt}, CURRENT_TIMESTAMP)
  `;

  await prisma.$executeRaw`
    UPDATE oyama_password_user_pins
    SET last_verified_at = CURRENT_TIMESTAMP
    WHERE organization_id = ${params.organizationId}
      AND user_id = ${params.userId}
  `;

  return {
    sessionToken,
    expiresAt: expiresAt.toISOString(),
  };
}

export async function validateOyamaPasswordPinSession(params: {
  organizationId: string;
  userId: string;
  sessionToken: string;
}): Promise<boolean> {
  await ensurePasswordSchema();
  const rows = await prisma.$queryRaw<SessionRow[]>`
    SELECT id, expires_at
    FROM oyama_password_pin_sessions
    WHERE id = ${params.sessionToken}
      AND organization_id = ${params.organizationId}
      AND user_id = ${params.userId}
      AND expires_at > CURRENT_TIMESTAMP
    LIMIT 1
  `;

  if (rows.length === 0) {
    return false;
  }

  await prisma.$executeRaw`
    UPDATE oyama_password_pin_sessions
    SET last_seen_at = CURRENT_TIMESTAMP
    WHERE id = ${params.sessionToken}
  `;

  return true;
}

export async function listOyamaPasswordEntries(params: {
  organizationId: string;
  userId: string;
  role?: string | null;
}): Promise<OyamaPasswordEntryListItem[]> {
  await ensurePasswordSchema();

  if (isAdminRole(params.role)) {
    const adminRows = await prisma.$queryRaw<
      Array<{
        id: string;
        entry_title: string;
        username: string | null;
        website: string | null;
        owner_user_id: string;
        created_at: Date;
        updated_at: Date;
        last_accessed_at: Date | null;
      }>
    >`
      SELECT id, entry_title, username, website, owner_user_id, created_at, updated_at, last_accessed_at
      FROM oyama_password_entries
      WHERE organization_id = ${params.organizationId}
      ORDER BY updated_at DESC
    `;

    return adminRows.map((row) => ({
      id: String(row.id),
      title: String(row.entry_title),
      username: row.username ? String(row.username) : null,
      website: row.website ? String(row.website) : null,
      ownerUserId: String(row.owner_user_id),
      canEdit: true,
      sharedByYou: String(row.owner_user_id) === params.userId,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at).toISOString() : null,
    }));
  }

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      entry_title: string;
      username: string | null;
      website: string | null;
      owner_user_id: string;
      created_at: Date;
      updated_at: Date;
      last_accessed_at: Date | null;
      share_can_edit: number | null;
    }>
  >`
    SELECT e.id, e.entry_title, e.username, e.website, e.owner_user_id,
           e.created_at, e.updated_at, e.last_accessed_at,
           MAX(CASE WHEN s.shared_with_user_id = ${params.userId} THEN s.can_edit ELSE NULL END) AS share_can_edit
    FROM oyama_password_entries e
    LEFT JOIN oyama_password_shares s
      ON s.entry_id = e.id
      AND s.organization_id = e.organization_id
    WHERE e.organization_id = ${params.organizationId}
      AND (
        e.owner_user_id = ${params.userId}
        OR EXISTS (
          SELECT 1 FROM oyama_password_shares s2
          WHERE s2.entry_id = e.id
            AND s2.organization_id = e.organization_id
            AND s2.shared_with_user_id = ${params.userId}
        )
      )
    GROUP BY e.id, e.entry_title, e.username, e.website, e.owner_user_id, e.created_at, e.updated_at, e.last_accessed_at
    ORDER BY e.updated_at DESC
  `;

  return rows.map((row) => {
    const isOwner = String(row.owner_user_id) === params.userId;
    return {
      id: String(row.id),
      title: String(row.entry_title),
      username: row.username ? String(row.username) : null,
      website: row.website ? String(row.website) : null,
      ownerUserId: String(row.owner_user_id),
      canEdit: isOwner || Number(row.share_can_edit ?? 0) === 1,
      sharedByYou: isOwner,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at).toISOString() : null,
    };
  });
}

export async function createOyamaPasswordEntry(params: {
  organizationId: string;
  userId: string;
  title: string;
  username?: string;
  website?: string;
  password: string;
  notes?: string;
  hasMfa?: boolean;
  mfaMethod?: string;
  mfaConnectedTo?: string;
}): Promise<OyamaPasswordEntryListItem> {
  await ensurePasswordSchema();
  const id = randomUUID();
  const encrypted = await encryptPayload({
    password: params.password,
    notes: params.notes,
    hasMfa: params.hasMfa,
    mfaMethod: params.mfaMethod,
    mfaConnectedTo: params.mfaConnectedTo,
  });

  await prisma.$executeRaw`
    INSERT INTO oyama_password_entries
    (id, organization_id, owner_user_id, entry_title, username, website, secret_ciphertext, secret_iv, secret_tag)
    VALUES (
      ${id},
      ${params.organizationId},
      ${params.userId},
      ${params.title},
      ${params.username?.trim() || null},
      ${params.website?.trim() || null},
      ${encrypted.ciphertext},
      ${encrypted.iv},
      ${encrypted.tag}
    )
  `;

  await recordAccessEvent({
    organizationId: params.organizationId,
    entryId: id,
    actorUserId: params.userId,
    actionType: "create",
  });

  const nowIso = new Date().toISOString();
  return {
    id,
    title: params.title,
    username: params.username?.trim() || null,
    website: params.website?.trim() || null,
    ownerUserId: params.userId,
    canEdit: true,
    sharedByYou: true,
    createdAt: nowIso,
    updatedAt: nowIso,
    lastAccessedAt: null,
  };
}

export async function getOyamaPasswordEntry(params: {
  organizationId: string;
  userId: string;
  id: string;
  revealSecret: boolean;
  role?: string | null;
}): Promise<OyamaPasswordEntryRecord | null> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.id,
    userId: params.userId,
    role: params.role,
  });
  if (!access.allowed) return null;

  const rows = await prisma.$queryRaw<EntryRow[]>`
    SELECT id, entry_title, username, website, owner_user_id,
           secret_ciphertext, secret_iv, secret_tag,
           created_at, updated_at, last_accessed_at
    FROM oyama_password_entries
    WHERE organization_id = ${params.organizationId}
      AND id = ${params.id}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  const baseRecord: OyamaPasswordEntryRecord = {
    id: String(row.id),
    title: String(row.entry_title),
    username: row.username ? String(row.username) : null,
    website: row.website ? String(row.website) : null,
    ownerUserId: String(row.owner_user_id),
    canEdit: access.canEdit,
    sharedByYou: String(row.owner_user_id) === params.userId,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
    lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at).toISOString() : null,
  };

  if (!params.revealSecret) {
    return baseRecord;
  }

  const decrypted = await decryptPayload({
    ciphertext: String(row.secret_ciphertext),
    iv: String(row.secret_iv),
    tag: String(row.secret_tag),
  });

  await prisma.$executeRaw`
    UPDATE oyama_password_entries
    SET last_accessed_at = CURRENT_TIMESTAMP
    WHERE organization_id = ${params.organizationId}
      AND id = ${params.id}
  `;

  await recordAccessEvent({
    organizationId: params.organizationId,
    entryId: params.id,
    actorUserId: params.userId,
    actionType: "reveal",
  });

  return {
    ...baseRecord,
    password: decrypted.password,
    notes: decrypted.notes,
    hasMfa: Boolean(decrypted.hasMfa),
    mfaMethod: decrypted.mfaMethod,
    mfaConnectedTo: decrypted.mfaConnectedTo,
    lastAccessedAt: new Date().toISOString(),
  };
}

export async function updateOyamaPasswordEntry(params: {
  organizationId: string;
  userId: string;
  id: string;
  title?: string;
  username?: string | null;
  website?: string | null;
  password?: string;
  notes?: string;
  hasMfa?: boolean;
  mfaMethod?: string;
  mfaConnectedTo?: string;
  role?: string | null;
}): Promise<OyamaPasswordEntryListItem | null> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.id,
    userId: params.userId,
    role: params.role,
  });
  if (!access.allowed || !access.canEdit) return null;

  const rows = await prisma.$queryRaw<EntryRow[]>`
    SELECT id, entry_title, username, website, owner_user_id,
           secret_ciphertext, secret_iv, secret_tag,
           created_at, updated_at, last_accessed_at
    FROM oyama_password_entries
    WHERE organization_id = ${params.organizationId}
      AND id = ${params.id}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  const row = rows[0];

  let nextCiphertext = String(row.secret_ciphertext);
  let nextIv = String(row.secret_iv);
  let nextTag = String(row.secret_tag);

  if (
    params.password !== undefined ||
    params.notes !== undefined ||
    params.hasMfa !== undefined ||
    params.mfaMethod !== undefined ||
    params.mfaConnectedTo !== undefined
  ) {
    const decrypted = await decryptPayload({
      ciphertext: String(row.secret_ciphertext),
      iv: String(row.secret_iv),
      tag: String(row.secret_tag),
    });

    const encrypted = await encryptPayload({
      password: params.password ?? decrypted.password,
      notes: params.notes ?? decrypted.notes,
      hasMfa: params.hasMfa ?? Boolean(decrypted.hasMfa),
      mfaMethod: params.mfaMethod ?? decrypted.mfaMethod,
      mfaConnectedTo: params.mfaConnectedTo ?? decrypted.mfaConnectedTo,
    });
    nextCiphertext = encrypted.ciphertext;
    nextIv = encrypted.iv;
    nextTag = encrypted.tag;
  }

  const nextTitle = params.title?.trim() || String(row.entry_title);
  const nextUsername = params.username === undefined ? (row.username ? String(row.username) : null) : params.username;
  const nextWebsite = params.website === undefined ? (row.website ? String(row.website) : null) : params.website;

  await prisma.$executeRaw`
    UPDATE oyama_password_entries
    SET entry_title = ${nextTitle},
        username = ${nextUsername},
        website = ${nextWebsite},
        secret_ciphertext = ${nextCiphertext},
        secret_iv = ${nextIv},
        secret_tag = ${nextTag},
        updated_at = CURRENT_TIMESTAMP
    WHERE organization_id = ${params.organizationId}
      AND id = ${params.id}
  `;

  await recordAccessEvent({
    organizationId: params.organizationId,
    entryId: params.id,
    actorUserId: params.userId,
    actionType: "update",
  });

  const updatedRows = await prisma.$queryRaw<
    Array<{
      id: string;
      entry_title: string;
      username: string | null;
      website: string | null;
      owner_user_id: string;
      created_at: Date;
      updated_at: Date;
      last_accessed_at: Date | null;
    }>
  >`
    SELECT id, entry_title, username, website, owner_user_id, created_at, updated_at, last_accessed_at
    FROM oyama_password_entries
    WHERE organization_id = ${params.organizationId}
      AND id = ${params.id}
    LIMIT 1
  `;

  if (updatedRows.length === 0) return null;
  const updated = updatedRows[0];

  return {
    id: String(updated.id),
    title: String(updated.entry_title),
    username: updated.username ? String(updated.username) : null,
    website: updated.website ? String(updated.website) : null,
    ownerUserId: String(updated.owner_user_id),
    canEdit: access.canEdit,
    sharedByYou: String(updated.owner_user_id) === params.userId,
    createdAt: new Date(updated.created_at).toISOString(),
    updatedAt: new Date(updated.updated_at).toISOString(),
    lastAccessedAt: updated.last_accessed_at ? new Date(updated.last_accessed_at).toISOString() : null,
  };
}

export async function deleteOyamaPasswordEntry(params: {
  organizationId: string;
  userId: string;
  id: string;
  role?: string | null;
}): Promise<boolean> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.id,
    userId: params.userId,
    role: params.role,
  });
  if (!access.allowed || (!access.isOwner && !isAdminRole(params.role))) return false;

  await prisma.$executeRaw`
    DELETE FROM oyama_password_shares
    WHERE organization_id = ${params.organizationId}
      AND entry_id = ${params.id}
  `;

  const deleted = await prisma.$executeRaw`
    DELETE FROM oyama_password_entries
    WHERE organization_id = ${params.organizationId}
      AND id = ${params.id}
  `;

  if (Number(deleted) > 0) {
    await recordAccessEvent({
      organizationId: params.organizationId,
      entryId: params.id,
      actorUserId: params.userId,
      actionType: "delete",
    });
  }

  return Number(deleted) > 0;
}

export async function listOyamaPasswordShares(params: {
  organizationId: string;
  userId: string;
  entryId: string;
  role?: string | null;
}): Promise<OyamaPasswordShareItem[] | null> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.entryId,
    userId: params.userId,
    role: params.role,
  });

  if (!access.allowed || !access.canEdit) return null;

  const rows = await prisma.$queryRaw<ShareRow[]>`
    SELECT shared_with_user_id, can_edit, created_by, created_at
    FROM oyama_password_shares
    WHERE organization_id = ${params.organizationId}
      AND entry_id = ${params.entryId}
    ORDER BY created_at DESC
  `;

  return rows.map((row) => ({
    sharedWithUserId: String(row.shared_with_user_id),
    canEdit: Number(row.can_edit ?? 0) === 1,
    createdBy: String(row.created_by),
    createdAt: new Date(row.created_at).toISOString(),
  }));
}

export async function upsertOyamaPasswordShare(params: {
  organizationId: string;
  userId: string;
  entryId: string;
  sharedWithUserId: string;
  canEdit: boolean;
  role?: string | null;
}): Promise<boolean> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.entryId,
    userId: params.userId,
    role: params.role,
  });
  if (!access.allowed || !access.canEdit) return false;

  await prisma.$executeRaw`
    INSERT INTO oyama_password_shares
    (organization_id, entry_id, shared_with_user_id, can_edit, created_by)
    VALUES (
      ${params.organizationId},
      ${params.entryId},
      ${params.sharedWithUserId},
      ${params.canEdit ? 1 : 0},
      ${params.userId}
    )
    ON DUPLICATE KEY UPDATE
      can_edit = VALUES(can_edit),
      created_by = VALUES(created_by)
  `;

  await recordAccessEvent({
    organizationId: params.organizationId,
    entryId: params.entryId,
    actorUserId: params.userId,
    actionType: "share",
  });

  return true;
}

export async function removeOyamaPasswordShare(params: {
  organizationId: string;
  userId: string;
  entryId: string;
  sharedWithUserId: string;
  role?: string | null;
}): Promise<boolean> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.entryId,
    userId: params.userId,
    role: params.role,
  });
  if (!access.allowed || !access.canEdit) return false;

  const removed = await prisma.$executeRaw`
    DELETE FROM oyama_password_shares
    WHERE organization_id = ${params.organizationId}
      AND entry_id = ${params.entryId}
      AND shared_with_user_id = ${params.sharedWithUserId}
  `;

  if (Number(removed) > 0) {
    await recordAccessEvent({
      organizationId: params.organizationId,
      entryId: params.entryId,
      actorUserId: params.userId,
      actionType: "unshare",
    });
  }

  return Number(removed) > 0;
}

export async function listOyamaPasswordBackups(params: {
  organizationId: string;
}): Promise<OyamaPasswordBackupListItem[]> {
  await ensurePasswordSchema();

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      backup_label: string;
      organization_id: string;
      file_name: string;
      checksum_sha256: string;
      created_by: string;
      created_at: Date;
      restored_at: Date | null;
    }>
  >`
    SELECT id, backup_label, organization_id, file_name, checksum_sha256, created_by, created_at, restored_at
    FROM oyama_password_backups
    WHERE organization_id = ${params.organizationId}
    ORDER BY created_at DESC
    LIMIT 50
  `;

  return rows.map((row) => ({
    id: String(row.id),
    label: String(row.backup_label),
    organizationId: String(row.organization_id),
    fileName: String(row.file_name),
    checksumSha256: String(row.checksum_sha256),
    createdBy: String(row.created_by),
    createdAt: new Date(row.created_at).toISOString(),
    restoredAt: row.restored_at ? new Date(row.restored_at).toISOString() : null,
  }));
}

export async function createOyamaPasswordBackup(params: {
  organizationId: string;
  userId: string;
  label?: string;
}): Promise<{ item: OyamaPasswordBackupListItem; lockedFileContents: string }> {
  await ensurePasswordSchema();

  const entries = await prisma.$queryRaw<EntryRow[]>`
    SELECT id, entry_title, username, website, owner_user_id,
           secret_ciphertext, secret_iv, secret_tag,
           created_at, updated_at, last_accessed_at
    FROM oyama_password_entries
    WHERE organization_id = ${params.organizationId}
    ORDER BY updated_at DESC
  `;

  const shares = await prisma.$queryRaw<ShareRow[]>`
    SELECT entry_id, shared_with_user_id, can_edit, created_by, created_at
    FROM oyama_password_shares
    WHERE organization_id = ${params.organizationId}
    ORDER BY created_at DESC
  `;

  const payloadEntries: BackupPayloadEntry[] = [];
  for (const row of entries) {
    const decrypted = await decryptPayload({
      ciphertext: String(row.secret_ciphertext),
      iv: String(row.secret_iv),
      tag: String(row.secret_tag),
    });

    payloadEntries.push({
      id: String(row.id),
      title: String(row.entry_title),
      username: row.username ? String(row.username) : null,
      website: row.website ? String(row.website) : null,
      ownerUserId: String(row.owner_user_id),
      password: decrypted.password,
      notes: decrypted.notes,
      hasMfa: Boolean(decrypted.hasMfa),
      mfaMethod: decrypted.mfaMethod,
      mfaConnectedTo: decrypted.mfaConnectedTo,
      createdAt: new Date(row.created_at).toISOString(),
      updatedAt: new Date(row.updated_at).toISOString(),
      lastAccessedAt: row.last_accessed_at ? new Date(row.last_accessed_at).toISOString() : null,
    });
  }

  const payload: BackupPayload = {
    format: "oyama-password.backup.payload.v1",
    organizationId: params.organizationId,
    exportedAt: new Date().toISOString(),
    entries: payloadEntries,
    shares: shares.map((share) => ({
      entryId: String(share.entry_id),
      sharedWithUserId: String(share.shared_with_user_id),
      canEdit: Number(share.can_edit ?? 0) === 1,
      createdBy: String(share.created_by),
      createdAt: new Date(share.created_at).toISOString(),
    })),
  };

  const envelope = await encryptLockedBackupPayload(payload);
  const lockedFileContents = JSON.stringify(envelope, null, 2);
  const id = randomUUID();
  const createdAt = new Date().toISOString();
  const label = (params.label?.trim() || `Vault backup ${createdAt.slice(0, 10)}`).slice(0, 180);
  const fileName = `oyama-password-backup-${createdAt.slice(0, 10)}-${id.slice(0, 8)}.opvaultl`;

  await prisma.$executeRaw`
    INSERT INTO oyama_password_backups
    (id, organization_id, backup_label, file_name, checksum_sha256, locked_payload, created_by)
    VALUES (
      ${id},
      ${params.organizationId},
      ${label},
      ${fileName},
      ${envelope.checksumSha256},
      ${lockedFileContents},
      ${params.userId}
    )
  `;

  await recordAccessEvent({
    organizationId: params.organizationId,
    entryId: `BACKUP:${id}`,
    actorUserId: params.userId,
    actionType: "backup_create",
  });

  return {
    item: {
      id,
      label,
      organizationId: params.organizationId,
      fileName,
      checksumSha256: envelope.checksumSha256,
      createdBy: params.userId,
      createdAt,
      restoredAt: null,
    },
    lockedFileContents,
  };
}

export async function restoreOyamaPasswordBackup(params: {
  organizationId: string;
  userId: string;
  lockedFileContents: string;
  mode?: "merge" | "replace";
}): Promise<{ restoredEntries: number; restoredShares: number }> {
  await ensurePasswordSchema();
  const payload = await decryptLockedBackupPayload(params.lockedFileContents);
  if (payload.organizationId !== params.organizationId) {
    throw new Error("Backup organization does not match the current organization.");
  }

  const mode = params.mode === "replace" ? "replace" : "merge";

  await prisma.$transaction(async (tx) => {
    if (mode === "replace") {
      await tx.$executeRaw`
        DELETE FROM oyama_password_shares
        WHERE organization_id = ${params.organizationId}
      `;
      await tx.$executeRaw`
        DELETE FROM oyama_password_entries
        WHERE organization_id = ${params.organizationId}
      `;
    }

    for (const entry of payload.entries) {
      const encrypted = await encryptPayload({
        password: entry.password,
        notes: entry.notes,
        hasMfa: entry.hasMfa,
        mfaMethod: entry.mfaMethod,
        mfaConnectedTo: entry.mfaConnectedTo,
      });

      await tx.$executeRaw`
        INSERT INTO oyama_password_entries
        (id, organization_id, owner_user_id, entry_title, username, website, secret_ciphertext, secret_iv, secret_tag, created_at, updated_at, last_accessed_at)
        VALUES (
          ${entry.id},
          ${params.organizationId},
          ${entry.ownerUserId},
          ${entry.title},
          ${entry.username},
          ${entry.website},
          ${encrypted.ciphertext},
          ${encrypted.iv},
          ${encrypted.tag},
          ${new Date(entry.createdAt)},
          ${new Date(entry.updatedAt)},
          ${entry.lastAccessedAt ? new Date(entry.lastAccessedAt) : null}
        )
        ON DUPLICATE KEY UPDATE
          owner_user_id = VALUES(owner_user_id),
          entry_title = VALUES(entry_title),
          username = VALUES(username),
          website = VALUES(website),
          secret_ciphertext = VALUES(secret_ciphertext),
          secret_iv = VALUES(secret_iv),
          secret_tag = VALUES(secret_tag),
          updated_at = VALUES(updated_at),
          last_accessed_at = VALUES(last_accessed_at)
      `;
    }

    for (const share of payload.shares) {
      await tx.$executeRaw`
        INSERT INTO oyama_password_shares
        (organization_id, entry_id, shared_with_user_id, can_edit, created_by, created_at)
        VALUES (
          ${params.organizationId},
          ${share.entryId},
          ${share.sharedWithUserId},
          ${share.canEdit ? 1 : 0},
          ${share.createdBy},
          ${new Date(share.createdAt)}
        )
        ON DUPLICATE KEY UPDATE
          can_edit = VALUES(can_edit),
          created_by = VALUES(created_by)
      `;
    }
  });

  const checksumSha256 = createHash("sha256")
    .update(Buffer.from(params.lockedFileContents, "utf8"))
    .digest("hex");

  await prisma.$executeRaw`
    UPDATE oyama_password_backups
    SET restored_at = CURRENT_TIMESTAMP
    WHERE organization_id = ${params.organizationId}
      AND checksum_sha256 = ${checksumSha256}
  `;

  await recordAccessEvent({
    organizationId: params.organizationId,
    entryId: "BACKUP:restore",
    actorUserId: params.userId,
    actionType: "backup_restore",
  });

  return {
    restoredEntries: payload.entries.length,
    restoredShares: payload.shares.length,
  };
}
