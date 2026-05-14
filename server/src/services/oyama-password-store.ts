/**
 * OyamaPASSWORD secure store service.
 * Uses a dedicated external database and AES-256-GCM encryption for credential payloads.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "crypto";
import mysql from "mysql2/promise";

interface EncryptedBlob {
  iv: string;
  tag: string;
  ciphertext: string;
}

interface PasswordSecretPayload {
  password: string;
  notes?: string;
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
}

export interface OyamaPasswordShareItem {
  sharedWithUserId: string;
  canEdit: boolean;
  createdBy: string;
  createdAt: string;
}

let passwordPool: mysql.Pool | null = null;
let schemaReady = false;

function getEffectivePasswordDatabaseUrl(): string | undefined {
  return process.env.OYAMA_PASSWORD_DATABASE_URL?.trim();
}

export function isOyamaPasswordDbConfigured(): boolean {
  return Boolean(getEffectivePasswordDatabaseUrl());
}

export function isOyamaPasswordEncryptionConfigured(): boolean {
  return Boolean(process.env.OYAMA_PASSWORD_ENCRYPTION_KEY?.trim());
}

function getCipherKey(): Buffer {
  const keySource = process.env.OYAMA_PASSWORD_ENCRYPTION_KEY?.trim();
  if (!keySource) {
    throw new Error("OYAMA_PASSWORD_ENCRYPTION_KEY is missing.");
  }

  if (/^[0-9a-fA-F]{64}$/.test(keySource)) {
    return Buffer.from(keySource, "hex");
  }

  return createHash("sha256").update(keySource).digest();
}

function getPasswordPool(): mysql.Pool {
  const databaseUrl = getEffectivePasswordDatabaseUrl();
  if (!databaseUrl) {
    throw new Error("OYAMA_PASSWORD_DATABASE_URL is missing.");
  }

  if (!passwordPool) {
    passwordPool = mysql.createPool(databaseUrl);
  }

  return passwordPool;
}

function encryptPayload(payload: PasswordSecretPayload): EncryptedBlob {
  const key = getCipherKey();
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

function decryptPayload(blob: EncryptedBlob): PasswordSecretPayload {
  const key = getCipherKey();
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
}

async function ensurePasswordSchema(): Promise<void> {
  if (schemaReady) return;

  const pool = getPasswordPool();

  await pool.query(`
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

  await pool.query(`
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

  await pool.query(`
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

  schemaReady = true;
}

async function recordAccessEvent(params: {
  organizationId: string;
  entryId: string;
  actorUserId: string;
  actionType: "create" | "update" | "delete" | "reveal" | "share" | "unshare";
}): Promise<void> {
  await ensurePasswordSchema();
  const pool = getPasswordPool();
  await pool.query(
    `
      INSERT INTO oyama_password_access_events
      (organization_id, entry_id, actor_user_id, action_type)
      VALUES (?, ?, ?, ?)
    `,
    [params.organizationId, params.entryId, params.actorUserId, params.actionType],
  );
}

async function resolveEntryAccess(params: {
  organizationId: string;
  entryId: string;
  userId: string;
}): Promise<{ allowed: boolean; canEdit: boolean; isOwner: boolean }> {
  await ensurePasswordSchema();
  const pool = getPasswordPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT e.owner_user_id, s.can_edit
      FROM oyama_password_entries e
      LEFT JOIN oyama_password_shares s
        ON s.entry_id = e.id
        AND s.organization_id = e.organization_id
        AND s.shared_with_user_id = ?
      WHERE e.organization_id = ? AND e.id = ?
      LIMIT 1
    `,
    [params.userId, params.organizationId, params.entryId],
  );

  if (rows.length === 0) {
    return { allowed: false, canEdit: false, isOwner: false };
  }

  const row = rows[0];
  const isOwner = String(row.owner_user_id) === params.userId;
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
  const configured = isOyamaPasswordDbConfigured();
  const encryptionReady = isOyamaPasswordEncryptionConfigured();

  if (!configured) {
    return {
      configured: false,
      connected: false,
      encryptionReady,
      message: "OYAMA_PASSWORD_DATABASE_URL is not configured.",
    };
  }

  try {
    await ensurePasswordSchema();
    const pool = getPasswordPool();
    await pool.query("SELECT 1");
    return {
      configured: true,
      connected: true,
      encryptionReady,
      message: encryptionReady
        ? "OyamaPASSWORD database connected and encryption key loaded."
        : "OyamaPASSWORD database connected but encryption key is missing.",
    };
  } catch (error) {
    return {
      configured: true,
      connected: false,
      encryptionReady,
      message: error instanceof Error ? error.message : "Unknown OyamaPASSWORD DB error.",
    };
  }
}

export async function listOyamaPasswordEntries(params: {
  organizationId: string;
  userId: string;
}): Promise<OyamaPasswordEntryListItem[]> {
  await ensurePasswordSchema();
  const pool = getPasswordPool();

  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT e.id, e.entry_title, e.username, e.website, e.owner_user_id,
             e.created_at, e.updated_at, e.last_accessed_at,
             MAX(CASE WHEN s.shared_with_user_id = ? THEN s.can_edit ELSE NULL END) AS share_can_edit
      FROM oyama_password_entries e
      LEFT JOIN oyama_password_shares s
        ON s.entry_id = e.id
        AND s.organization_id = e.organization_id
      WHERE e.organization_id = ?
        AND (e.owner_user_id = ? OR EXISTS (
          SELECT 1 FROM oyama_password_shares s2
          WHERE s2.entry_id = e.id
            AND s2.organization_id = e.organization_id
            AND s2.shared_with_user_id = ?
        ))
      GROUP BY e.id, e.entry_title, e.username, e.website, e.owner_user_id, e.created_at, e.updated_at, e.last_accessed_at
      ORDER BY e.updated_at DESC
    `,
    [params.userId, params.organizationId, params.userId, params.userId],
  );

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
}): Promise<OyamaPasswordEntryListItem> {
  await ensurePasswordSchema();
  const pool = getPasswordPool();
  const id = randomUUID();
  const encrypted = encryptPayload({
    password: params.password,
    notes: params.notes,
  });

  await pool.query(
    `
      INSERT INTO oyama_password_entries
      (id, organization_id, owner_user_id, entry_title, username, website, secret_ciphertext, secret_iv, secret_tag)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      id,
      params.organizationId,
      params.userId,
      params.title,
      params.username?.trim() || null,
      params.website?.trim() || null,
      encrypted.ciphertext,
      encrypted.iv,
      encrypted.tag,
    ],
  );

  await recordAccessEvent({
    organizationId: params.organizationId,
    entryId: id,
    actorUserId: params.userId,
    actionType: "create",
  });

  return {
    id,
    title: params.title,
    username: params.username?.trim() || null,
    website: params.website?.trim() || null,
    ownerUserId: params.userId,
    canEdit: true,
    sharedByYou: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastAccessedAt: null,
  };
}

export async function getOyamaPasswordEntry(params: {
  organizationId: string;
  userId: string;
  id: string;
  revealSecret: boolean;
}): Promise<OyamaPasswordEntryRecord | null> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.id,
    userId: params.userId,
  });
  if (!access.allowed) return null;

  const pool = getPasswordPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, entry_title, username, website, owner_user_id,
             secret_ciphertext, secret_iv, secret_tag,
             created_at, updated_at, last_accessed_at
      FROM oyama_password_entries
      WHERE organization_id = ? AND id = ?
      LIMIT 1
    `,
    [params.organizationId, params.id],
  );

  if (rows.length === 0) return null;
  const row = rows[0];

  const baseRecord: OyamaPasswordEntryRecord = {
    id: String(row.id),
    title: String(row.entry_title),
    username: row.username ? String(row.username) : null,
    website: row.website ? String(row.website) : null,
    ownerUserId: String(row.owner_user_id),
    canEdit: access.canEdit,
    sharedByYou: access.isOwner,
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
    `UPDATE oyama_password_entries SET last_accessed_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND id = ?`,
    [params.organizationId, params.id],
  );

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
}): Promise<OyamaPasswordEntryListItem | null> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.id,
    userId: params.userId,
  });
  if (!access.allowed || !access.canEdit) return null;

  const pool = getPasswordPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, entry_title, username, website, owner_user_id,
             secret_ciphertext, secret_iv, secret_tag,
             created_at, updated_at, last_accessed_at
      FROM oyama_password_entries
      WHERE organization_id = ? AND id = ?
      LIMIT 1
    `,
    [params.organizationId, params.id],
  );

  if (rows.length === 0) return null;
  const row = rows[0];

  let nextCiphertext = String(row.secret_ciphertext);
  let nextIv = String(row.secret_iv);
  let nextTag = String(row.secret_tag);

  if (params.password !== undefined || params.notes !== undefined) {
    const decrypted = decryptPayload({
      ciphertext: String(row.secret_ciphertext),
      iv: String(row.secret_iv),
      tag: String(row.secret_tag),
    });

    const encrypted = encryptPayload({
      password: params.password ?? decrypted.password,
      notes: params.notes ?? decrypted.notes,
    });
    nextCiphertext = encrypted.ciphertext;
    nextIv = encrypted.iv;
    nextTag = encrypted.tag;
  }

  const nextTitle = params.title?.trim() || String(row.entry_title);
  const nextUsername = params.username === undefined ? (row.username ? String(row.username) : null) : params.username;
  const nextWebsite = params.website === undefined ? (row.website ? String(row.website) : null) : params.website;

  await pool.query(
    `
      UPDATE oyama_password_entries
      SET entry_title = ?, username = ?, website = ?,
          secret_ciphertext = ?, secret_iv = ?, secret_tag = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE organization_id = ? AND id = ?
    `,
    [
      nextTitle,
      nextUsername,
      nextWebsite,
      nextCiphertext,
      nextIv,
      nextTag,
      params.organizationId,
      params.id,
    ],
  );

  await recordAccessEvent({
    organizationId: params.organizationId,
    entryId: params.id,
    actorUserId: params.userId,
    actionType: "update",
  });

  const [updatedRows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT id, entry_title, username, website, owner_user_id, created_at, updated_at, last_accessed_at
      FROM oyama_password_entries
      WHERE organization_id = ? AND id = ?
      LIMIT 1
    `,
    [params.organizationId, params.id],
  );

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
}): Promise<boolean> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.id,
    userId: params.userId,
  });
  if (!access.allowed || !access.isOwner) return false;

  const pool = getPasswordPool();
  await pool.query(
    `DELETE FROM oyama_password_shares WHERE organization_id = ? AND entry_id = ?`,
    [params.organizationId, params.id],
  );
  const [result] = await pool.query<mysql.ResultSetHeader>(
    `DELETE FROM oyama_password_entries WHERE organization_id = ? AND id = ?`,
    [params.organizationId, params.id],
  );

  if (result.affectedRows > 0) {
    await recordAccessEvent({
      organizationId: params.organizationId,
      entryId: params.id,
      actorUserId: params.userId,
      actionType: "delete",
    });
  }

  return result.affectedRows > 0;
}

export async function listOyamaPasswordShares(params: {
  organizationId: string;
  userId: string;
  entryId: string;
}): Promise<OyamaPasswordShareItem[] | null> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.entryId,
    userId: params.userId,
  });

  if (!access.allowed || !access.canEdit) return null;

  const pool = getPasswordPool();
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    `
      SELECT shared_with_user_id, can_edit, created_by, created_at
      FROM oyama_password_shares
      WHERE organization_id = ? AND entry_id = ?
      ORDER BY created_at DESC
    `,
    [params.organizationId, params.entryId],
  );

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
}): Promise<boolean> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.entryId,
    userId: params.userId,
  });
  if (!access.allowed || !access.canEdit) return false;

  const pool = getPasswordPool();
  await pool.query(
    `
      INSERT INTO oyama_password_shares
      (organization_id, entry_id, shared_with_user_id, can_edit, created_by)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        can_edit = VALUES(can_edit),
        created_by = VALUES(created_by)
    `,
    [
      params.organizationId,
      params.entryId,
      params.sharedWithUserId,
      params.canEdit ? 1 : 0,
      params.userId,
    ],
  );

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
}): Promise<boolean> {
  await ensurePasswordSchema();
  const access = await resolveEntryAccess({
    organizationId: params.organizationId,
    entryId: params.entryId,
    userId: params.userId,
  });
  if (!access.allowed || !access.canEdit) return false;

  const pool = getPasswordPool();
  const [result] = await pool.query<mysql.ResultSetHeader>(
    `
      DELETE FROM oyama_password_shares
      WHERE organization_id = ? AND entry_id = ? AND shared_with_user_id = ?
    `,
    [params.organizationId, params.entryId, params.sharedWithUserId],
  );

  if (result.affectedRows > 0) {
    await recordAccessEvent({
      organizationId: params.organizationId,
      entryId: params.entryId,
      actorUserId: params.userId,
      actionType: "unshare",
    });
  }

  return result.affectedRows > 0;
}
