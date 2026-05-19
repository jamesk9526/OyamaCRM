/**
 * Steward AI query tokenization, scope parsing, and public shape helpers.
 * Pure functions — no Prisma I/O, no Express, no side effects.
 */

import type { StewardAiChatPayload } from "./types.js";
import type { Prisma } from "@prisma/client";

/** Splits a user query into lowercase alpha-numeric tokens for search/matching. */
export function tokenizeQuery(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 6);
}

/** Extracts path-scoped IDs from known workspace routes. */
export function parseScopeIdentifiers(scopePath: string): { clientId?: string; eventId?: string; constituentId?: string } {
  const parts = scopePath.split("/").filter(Boolean);
  if (parts[0] === "compassion" && parts[1] === "clients" && parts[2]) {
    return { clientId: parts[2] };
  }
  if (
    parts[0] === "events" &&
    parts[1] &&
    !["events", "setup", "check-in", "guests", "reports", "tickets", "tables", "sponsors", "fundraising", "communications"].includes(parts[1])
  ) {
    return { eventId: parts[1] };
  }
  if (parts[0] === "constituents" && parts[1]) {
    return { constituentId: parts[1] };
  }
  return {};
}

/** Maps a moduleKey to a short scope string used for memory/file filtering. */
export function scopeFromModuleKey(moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>): string {
  if (moduleKey === "oshareview") return "donor";
  return moduleKey;
}

/** Strips internal Date objects, exposing only ISO strings for public API responses. */
export function publicMemory(row: {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  confidence: number;
  active: boolean;
  workspaceScope: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Shapes a raw Prisma context-file row into a safe, client-facing object. */
export function publicContextFile(row: {
  id: string;
  fileName: string;
  displayName: string;
  mimeType: string;
  fileType: string;
  sizeBytes: number;
  workspaceScope: string | null;
  description: string | null;
  tags: Prisma.JsonValue;
  indexingStatus: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  indexedAt: Date | null;
  _count?: { chunks: number };
}) {
  return {
    id: row.id,
    fileName: row.fileName,
    displayName: row.displayName,
    mimeType: row.mimeType,
    fileType: row.fileType,
    sizeBytes: row.sizeBytes,
    workspaceScope: row.workspaceScope,
    description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [],
    indexingStatus: row.indexingStatus,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    indexedAt: row.indexedAt?.toISOString() ?? null,
    chunkCount: row._count?.chunks ?? 0,
  };
}
