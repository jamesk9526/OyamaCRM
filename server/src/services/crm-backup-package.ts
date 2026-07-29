/**
 * Portable OyamaCRM backup package support.
 *
 * The package is a standards-compatible, uncompressed ZIP so it can be
 * archived outside OyamaCRM. We deliberately write the small ZIP subset we
 * consume (stored entries, checksums, no path traversal) rather than relying
 * on a runtime dependency whose native store may differ between deployments.
 */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { CrmBackupBundle } from "./crm-backup.js";

const BACKUP_PACKAGE_FORMAT = "oyama-crm-backup-package";
const BACKUP_PACKAGE_VERSION = 1;
const ZIP_LOCAL_FILE_HEADER = 0x04034b50;
const ZIP_CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const ZIP_END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const MAX_PACKAGE_BYTES = 1024 * 1024 * 1024;
const MAX_PACKAGE_ENTRIES = 50_000;

export interface CrmBackupPackageAsset {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface CrmBackupPackageManifest {
  format: typeof BACKUP_PACKAGE_FORMAT;
  formatVersion: typeof BACKUP_PACKAGE_VERSION;
  packageId: string;
  generatedAt: string;
  organizationId: string;
  appVersion: string;
  includesWatchdogDatabase: boolean;
  backupJsonSha256: string;
  backupSqlSha256: string;
  assets: CrmBackupPackageAsset[];
}

interface ZipEntry {
  path: string;
  content: Buffer;
}

interface ParsedZipEntry {
  path: string;
  content: Buffer;
}

export interface ParsedCrmBackupPackage {
  manifest: CrmBackupPackageManifest;
  bundle: CrmBackupBundle;
  assets: Array<{ relativePath: string; content: Buffer }>;
}

function sha256(content: Buffer | string): string {
  return createHash("sha256").update(content).digest("hex");
}

function normalizePackagePath(value: string): string {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("\0") || normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error("Backup package contains an unsafe file path.");
  }
  return normalized;
}

function crc32(content: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < content.length; index += 1) {
    crc ^= content[index];
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Builds a standards-compatible ZIP with stored (not compressed) entries. */
export function createStoredZip(entries: ZipEntry[]): Buffer {
  if (entries.length === 0 || entries.length > MAX_PACKAGE_ENTRIES) {
    throw new Error("Backup package must contain a valid number of files.");
  }

  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;
  const seen = new Set<string>();

  for (const entry of entries) {
    const entryPath = normalizePackagePath(entry.path);
    if (seen.has(entryPath)) throw new Error(`Backup package has duplicate path: ${entryPath}`);
    seen.add(entryPath);

    const name = Buffer.from(entryPath, "utf8");
    const content = Buffer.from(entry.content);
    const checksum = crc32(content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(ZIP_LOCAL_FILE_HEADER, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10);
    local.writeUInt16LE(0, 12);
    local.writeUInt32LE(checksum, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(ZIP_CENTRAL_DIRECTORY_HEADER, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(0, 12);
    central.writeUInt16LE(0, 14);
    central.writeUInt32LE(checksum, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);
    offset += local.length + name.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(ZIP_END_OF_CENTRAL_DIRECTORY, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  const archive = Buffer.concat([...localParts, centralDirectory, end]);
  if (archive.length > MAX_PACKAGE_BYTES) {
    throw new Error("Backup package exceeds the 1 GB portable package limit.");
  }
  return archive;
}

/** Reads only the safe stored-entry ZIP format OyamaCRM writes. */
export function readStoredZip(archive: Buffer): ParsedZipEntry[] {
  if (archive.length < 22 || archive.length > MAX_PACKAGE_BYTES) {
    throw new Error("Backup package is empty, invalid, or exceeds the 1 GB package limit.");
  }

  let endOffset = -1;
  for (let offset = archive.length - 22; offset >= Math.max(0, archive.length - 65_557); offset -= 1) {
    if (archive.readUInt32LE(offset) === ZIP_END_OF_CENTRAL_DIRECTORY) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error("Backup package ZIP directory is missing.");

  const entryCount = archive.readUInt16LE(endOffset + 10);
  const centralSize = archive.readUInt32LE(endOffset + 12);
  const centralOffset = archive.readUInt32LE(endOffset + 16);
  if (entryCount === 0 || entryCount > MAX_PACKAGE_ENTRIES || centralOffset + centralSize > endOffset) {
    throw new Error("Backup package ZIP directory is invalid.");
  }

  const entries: ParsedZipEntry[] = [];
  const seen = new Set<string>();
  let cursor = centralOffset;
  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > centralOffset + centralSize || archive.readUInt32LE(cursor) !== ZIP_CENTRAL_DIRECTORY_HEADER) {
      throw new Error("Backup package ZIP entry directory is invalid.");
    }
    const flags = archive.readUInt16LE(cursor + 8);
    const compression = archive.readUInt16LE(cursor + 10);
    const expectedCrc = archive.readUInt32LE(cursor + 16);
    const compressedSize = archive.readUInt32LE(cursor + 20);
    const uncompressedSize = archive.readUInt32LE(cursor + 24);
    const nameLength = archive.readUInt16LE(cursor + 28);
    const extraLength = archive.readUInt16LE(cursor + 30);
    const commentLength = archive.readUInt16LE(cursor + 32);
    const localOffset = archive.readUInt32LE(cursor + 42);
    if ((flags & 0x0001) !== 0 || compression !== 0 || compressedSize !== uncompressedSize) {
      throw new Error("Backup package uses an unsupported ZIP entry format.");
    }
    const nameEnd = cursor + 46 + nameLength;
    if (nameEnd > archive.length) throw new Error("Backup package ZIP entry name is invalid.");
    const entryPath = normalizePackagePath(archive.subarray(cursor + 46, nameEnd).toString("utf8"));
    if (seen.has(entryPath)) throw new Error(`Backup package has duplicate path: ${entryPath}`);
    seen.add(entryPath);
    if (localOffset + 30 > archive.length || archive.readUInt32LE(localOffset) !== ZIP_LOCAL_FILE_HEADER) {
      throw new Error("Backup package local entry is invalid.");
    }
    const localNameLength = archive.readUInt16LE(localOffset + 26);
    const localExtraLength = archive.readUInt16LE(localOffset + 28);
    const contentOffset = localOffset + 30 + localNameLength + localExtraLength;
    const contentEnd = contentOffset + uncompressedSize;
    if (contentEnd > archive.length) throw new Error("Backup package file content is invalid.");
    const content = Buffer.from(archive.subarray(contentOffset, contentEnd));
    if (crc32(content) !== expectedCrc) throw new Error(`Backup package checksum failed for ${entryPath}.`);
    entries.push({ path: entryPath, content });
    cursor = nameEnd + extraLength + commentLength;
  }
  return entries;
}

async function listUploadFiles(root: string, current = ""): Promise<Array<{ relativePath: string; absolutePath: string }>> {
  const directory = path.join(root, current);
  let children;
  try {
    children = await readdir(directory, { withFileTypes: true });
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }

  const files: Array<{ relativePath: string; absolutePath: string }> = [];
  for (const child of children) {
    const relativePath = current ? path.posix.join(current.replace(/\\/g, "/"), child.name) : child.name;
    if (child.isSymbolicLink()) continue;
    if (child.isDirectory()) {
      files.push(...await listUploadFiles(root, relativePath));
    } else if (child.isFile()) {
      files.push({ relativePath: normalizePackagePath(relativePath), absolutePath: path.join(root, relativePath) });
    }
  }
  return files;
}

export function getCrmUploadsRoot(): string {
  return path.resolve(process.cwd(), "public", "uploads");
}

/** Exports the database snapshot and every local runtime upload into one portable package. */
export async function createCrmBackupPackage(backup: CrmBackupBundle): Promise<{ archive: Buffer; manifest: CrmBackupPackageManifest }> {
  const uploadsRoot = getCrmUploadsRoot();
  const uploadFiles = await listUploadFiles(uploadsRoot);
  const assets: CrmBackupPackageAsset[] = [];
  const entries: ZipEntry[] = [];

  for (const file of uploadFiles) {
    const content = await readFile(file.absolutePath);
    assets.push({ path: file.relativePath, sizeBytes: content.length, sha256: sha256(content) });
    entries.push({ path: `assets/${file.relativePath}`, content });
  }

  const backupJson = Buffer.from(JSON.stringify(backup, null, 2), "utf8");
  const backupSql = Buffer.from(backup.sqlDump, "utf8");
  const manifest: CrmBackupPackageManifest = {
    format: BACKUP_PACKAGE_FORMAT,
    formatVersion: BACKUP_PACKAGE_VERSION,
    packageId: randomUUID(),
    generatedAt: backup.generatedAt,
    organizationId: backup.organizationId,
    appVersion: backup.appVersion,
    includesWatchdogDatabase: Boolean(backup.watchdogDatabase),
    backupJsonSha256: sha256(backupJson),
    backupSqlSha256: sha256(backupSql),
    assets,
  };
  entries.unshift(
    { path: "manifest.json", content: Buffer.from(JSON.stringify(manifest, null, 2), "utf8") },
    { path: "backup.json", content: backupJson },
    { path: "backup.sql", content: backupSql },
  );
  return { archive: createStoredZip(entries), manifest };
}

function isManifest(value: unknown): value is CrmBackupPackageManifest {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return record.format === BACKUP_PACKAGE_FORMAT
    && record.formatVersion === BACKUP_PACKAGE_VERSION
    && typeof record.packageId === "string"
    && typeof record.organizationId === "string"
    && typeof record.backupJsonSha256 === "string"
    && typeof record.backupSqlSha256 === "string"
    && Array.isArray(record.assets)
    && record.assets.every((asset) => {
      if (!asset || typeof asset !== "object") return false;
      const item = asset as Record<string, unknown>;
      return typeof item.path === "string"
        && Number.isSafeInteger(item.sizeBytes)
        && Number(item.sizeBytes) >= 0
        && typeof item.sha256 === "string"
        && /^[a-f0-9]{64}$/i.test(item.sha256);
    });
}

/** Validates and reads an OyamaCRM portable backup package. */
export function parseCrmBackupPackage(archive: Buffer): ParsedCrmBackupPackage {
  const entries = readStoredZip(archive);
  const byPath = new Map(entries.map((entry) => [entry.path, entry.content]));
  const manifestBuffer = byPath.get("manifest.json");
  const backupBuffer = byPath.get("backup.json");
  const sqlBuffer = byPath.get("backup.sql");
  if (!manifestBuffer || !backupBuffer || !sqlBuffer) throw new Error("Backup package is missing required files.");

  let manifest: unknown;
  let bundle: unknown;
  try {
    manifest = JSON.parse(manifestBuffer.toString("utf8"));
    bundle = JSON.parse(backupBuffer.toString("utf8"));
  } catch {
    throw new Error("Backup package contains invalid JSON.");
  }
  if (!isManifest(manifest)) throw new Error("Backup package manifest is invalid.");
  if (sha256(backupBuffer) !== manifest.backupJsonSha256 || sha256(sqlBuffer) !== manifest.backupSqlSha256) {
    throw new Error("Backup package database integrity check failed.");
  }
  if (!bundle || typeof bundle !== "object" || (bundle as Record<string, unknown>).backupSchemaVersion !== "1") {
    throw new Error("Backup package database payload is invalid.");
  }
  const typedBundle = bundle as CrmBackupBundle;
  if (typedBundle.organizationId !== manifest.organizationId || typedBundle.sqlDump !== sqlBuffer.toString("utf8")) {
    throw new Error("Backup package manifest and database payload do not match.");
  }

  const assets: Array<{ relativePath: string; content: Buffer }> = [];
  const manifestAssets = new Map(manifest.assets.map((asset) => [normalizePackagePath(asset.path), asset]));
  if (manifestAssets.size !== manifest.assets.length || byPath.size !== manifest.assets.length + 3) {
    throw new Error("Backup package manifest does not match its file inventory.");
  }
  for (const [relativePath, asset] of manifestAssets.entries()) {
    const content = byPath.get(`assets/${relativePath}`);
    if (!content || content.length !== asset.sizeBytes || sha256(content) !== asset.sha256) {
      throw new Error(`Backup package asset integrity check failed for ${relativePath}.`);
    }
    assets.push({ relativePath, content });
  }
  const assetEntries = [...byPath.keys()].filter((entryPath) => entryPath.startsWith("assets/"));
  if (assetEntries.length !== assets.length) throw new Error("Backup package asset manifest does not match package files.");
  return { manifest, bundle: typedBundle, assets };
}

/** Stages and atomically swaps the complete uploads directory, preserving the prior directory for recovery. */
export async function restoreCrmBackupAssets(params: {
  assets: Array<{ relativePath: string; content: Buffer }>;
}): Promise<{ restoredAssetCount: number; recoveryDirectory: string | null }> {
  const uploadsRoot = getCrmUploadsRoot();
  const parentDirectory = path.dirname(uploadsRoot);
  const stagingDirectory = path.join(parentDirectory, `.uploads-restore-${randomUUID()}`);
  const recoveryDirectory = path.join(parentDirectory, `uploads-pre-restore-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  await mkdir(stagingDirectory, { recursive: true });
  try {
    for (const asset of params.assets) {
      const relativePath = normalizePackagePath(asset.relativePath);
      const destination = path.resolve(stagingDirectory, relativePath);
      if (!destination.startsWith(`${stagingDirectory}${path.sep}`)) throw new Error("Backup package asset path escapes restore staging directory.");
      await mkdir(path.dirname(destination), { recursive: true });
      await writeFile(destination, asset.content, { flag: "wx" });
    }
    const existing = await stat(uploadsRoot).then(() => true).catch(() => false);
    if (existing) await rename(uploadsRoot, recoveryDirectory);
    try {
      await rename(stagingDirectory, uploadsRoot);
    } catch (error) {
      if (existing) await rename(recoveryDirectory, uploadsRoot).catch(() => undefined);
      throw error;
    }
    return { restoredAssetCount: params.assets.length, recoveryDirectory: existing ? recoveryDirectory : null };
  } catch (error) {
    await rm(stagingDirectory, { recursive: true, force: true }).catch(() => undefined);
    throw error;
  }
}
