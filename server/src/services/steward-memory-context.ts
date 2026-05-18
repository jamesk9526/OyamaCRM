/**
 * Steward AI memory and file-context service.
 * Stores context per authenticated user and returns small retrieval snippets for chat grounding.
 */
import crypto from "node:crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

export type AiWorkspaceScope = "donor" | "events" | "compassion" | "hrm" | "watchdog" | "webmaster" | "steward" | "global";
export type AiMemoryCategory =
  | "preference"
  | "organization"
  | "writing_style"
  | "project"
  | "workflow"
  | "event"
  | "crm_setting"
  | "communication"
  | "other";

export interface StewardContextSnippet {
  contextText: string;
  toolsUsed: string[];
  recordsUsed: string[];
}

const ALLOWED_SCOPES = new Set<AiWorkspaceScope>([
  "donor",
  "events",
  "compassion",
  "hrm",
  "watchdog",
  "webmaster",
  "steward",
  "global",
]);

const ALLOWED_CATEGORIES = new Set<AiMemoryCategory>([
  "preference",
  "organization",
  "writing_style",
  "project",
  "workflow",
  "event",
  "crm_setting",
  "communication",
  "other",
]);

export function normalizeWorkspaceScope(raw: unknown): AiWorkspaceScope | null {
  const normalized = String(raw ?? "").trim().toLowerCase();
  return ALLOWED_SCOPES.has(normalized as AiWorkspaceScope) ? (normalized as AiWorkspaceScope) : null;
}

export function normalizeMemoryCategory(raw: unknown): AiMemoryCategory {
  const normalized = String(raw ?? "").trim().toLowerCase();
  return ALLOWED_CATEGORIES.has(normalized as AiMemoryCategory) ? (normalized as AiMemoryCategory) : "other";
}

export function safeText(value: unknown, fallback = "", maxLength = 4000): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

export function normalizeTags(raw: unknown): string[] {
  const values = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(",")
      : [];
  return Array.from(new Set(values
    .map((item) => String(item ?? "").trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12)));
}

export async function getOrCreateAiMemoryPreference(organizationId: string, userId: string) {
  return prisma.aiMemoryPreference.upsert({
    where: { userId },
    create: {
      organizationId,
      userId,
      memoryEnabled: true,
      fileContextEnabled: true,
    },
    update: {},
  });
}

function tokenize(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 8);
}

function scoreText(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  return tokens.reduce((score, token) => score + (lower.includes(token) ? 1 : 0), 0);
}

export function createContentHash(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

export function chunkText(input: string, maxChars = 1800): string[] {
  const normalized = input.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!normalized) return [];
  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const next = current ? `${current}\n\n${paragraph}` : paragraph;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }
    if (current) chunks.push(current.slice(0, maxChars));
    if (paragraph.length <= maxChars) {
      current = paragraph;
      continue;
    }
    for (let index = 0; index < paragraph.length; index += maxChars) {
      chunks.push(paragraph.slice(index, index + maxChars));
    }
    current = "";
  }

  if (current) chunks.push(current.slice(0, maxChars));
  return chunks.slice(0, 80);
}

export async function replaceContextChunks(options: {
  organizationId: string;
  userId: string;
  fileId: string;
  extractedText: string;
}) {
  const chunks = chunkText(options.extractedText);
  await prisma.aiContextChunk.deleteMany({
    where: {
      organizationId: options.organizationId,
      userId: options.userId,
      fileId: options.fileId,
    },
  });

  if (chunks.length === 0) {
    await prisma.aiContextFile.update({
      where: { id: options.fileId },
      data: {
        indexingStatus: "needs_text",
        indexedAt: null,
      },
    });
    return { chunkCount: 0, indexingStatus: "needs_text" };
  }

  await prisma.aiContextChunk.createMany({
    data: chunks.map((chunk, index) => ({
      organizationId: options.organizationId,
      userId: options.userId,
      fileId: options.fileId,
      chunkIndex: index,
      chunkText: chunk,
      tokenEstimate: Math.max(1, Math.ceil(chunk.length / 4)),
    })),
  });

  await prisma.aiContextFile.update({
    where: { id: options.fileId },
    data: {
      indexingStatus: "indexed",
      indexedAt: new Date(),
    },
  });

  return { chunkCount: chunks.length, indexingStatus: "indexed" };
}

export async function buildUserMemoryContext(options: {
  organizationId: string;
  userId: string;
  userQuery: string;
  workspaceScope?: string | null;
  limit?: number;
}): Promise<StewardContextSnippet> {
  const preference = await getOrCreateAiMemoryPreference(options.organizationId, options.userId);
  if (!preference.memoryEnabled) {
    return {
      contextText: "Saved memories: disabled by user preference.",
      toolsUsed: ["memory.preference"],
      recordsUsed: ["Memories disabled"],
    };
  }

  const tokens = tokenize(options.userQuery);
  const scope = normalizeWorkspaceScope(options.workspaceScope);
  const memories = await prisma.aiUserMemory.findMany({
    where: {
      organizationId: options.organizationId,
      userId: options.userId,
      active: true,
      ...(scope && scope !== "global"
        ? { OR: [{ workspaceScope: null }, { workspaceScope: "global" }, { workspaceScope: scope }] }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 80,
  });

  const ranked = memories
    .map((memory) => ({
      memory,
      score: scoreText(`${memory.title}\n${memory.content}\n${memory.category}`, tokens),
    }))
    .sort((left, right) => right.score - left.score || +right.memory.updatedAt - +left.memory.updatedAt)
    .slice(0, options.limit ?? 8);

  if (ranked.length === 0) {
    return {
      contextText: "Saved memories: none available for this user.",
      toolsUsed: ["memory.searchUserMemories"],
      recordsUsed: [],
    };
  }

  return {
    contextText: [
      "Saved user memories (long-term context; user-visible and user-controlled):",
      ...ranked.map(({ memory }) =>
        `- [${memory.category}${memory.workspaceScope ? `/${memory.workspaceScope}` : ""}] ${memory.title}: ${memory.content}`
      ),
    ].join("\n"),
    toolsUsed: ["memory.searchUserMemories"],
    recordsUsed: ranked.map(({ memory }) => `Memory: ${memory.title}`),
  };
}

export async function buildFileContext(options: {
  organizationId: string;
  userId: string;
  userQuery: string;
  workspaceScope?: string | null;
  limit?: number;
}): Promise<StewardContextSnippet> {
  const preference = await getOrCreateAiMemoryPreference(options.organizationId, options.userId);
  if (!preference.fileContextEnabled) {
    return {
      contextText: "Uploaded file context: disabled by user preference.",
      toolsUsed: ["files.preference"],
      recordsUsed: ["File context disabled"],
    };
  }

  const tokens = tokenize(options.userQuery);
  const scope = normalizeWorkspaceScope(options.workspaceScope);
  const chunks = await prisma.aiContextChunk.findMany({
    where: {
      organizationId: options.organizationId,
      userId: options.userId,
      file: {
        active: true,
        indexingStatus: "indexed",
        ...(scope && scope !== "global"
          ? { OR: [{ workspaceScope: null }, { workspaceScope: "global" }, { workspaceScope: scope }] }
          : {}),
      },
    },
    include: {
      file: {
        select: {
          id: true,
          displayName: true,
          workspaceScope: true,
          description: true,
          tags: true,
          updatedAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 240,
  });

  const ranked = chunks
    .map((chunk) => ({
      chunk,
      score: scoreText(`${chunk.file.displayName}\n${chunk.file.description ?? ""}\n${chunk.chunkText}`, tokens),
    }))
    .filter((item) => tokens.length === 0 || item.score > 0)
    .sort((left, right) => right.score - left.score || +right.chunk.file.updatedAt - +left.chunk.file.updatedAt)
    .slice(0, options.limit ?? 6);

  if (ranked.length === 0) {
    return {
      contextText: "Uploaded file context: no matching indexed files for this user.",
      toolsUsed: ["files.searchContextLibrary"],
      recordsUsed: [],
    };
  }

  return {
    contextText: [
      "Uploaded file context (indexed user library; retrieved before answering):",
      ...ranked.map(({ chunk }) =>
        `- ${chunk.file.displayName}${chunk.file.workspaceScope ? ` [${chunk.file.workspaceScope}]` : ""}: ${chunk.chunkText.slice(0, 1200)}`
      ),
    ].join("\n"),
    toolsUsed: ["files.searchContextLibrary"],
    recordsUsed: ranked.map(({ chunk }) => `File: ${chunk.file.displayName}`),
  };
}

export async function saveExplicitMemoryFromText(options: {
  organizationId: string;
  userId: string;
  text: string;
  workspaceScope?: string | null;
}) {
  const preference = await getOrCreateAiMemoryPreference(options.organizationId, options.userId);
  if (!preference.memoryEnabled) return null;

  const match = options.text.match(/\b(?:remember|please remember|for future reference|note that|save this)\b[:,\s-]*([\s\S]+)$/i);
  const content = safeText(match?.[1] ?? "", "", 1200);
  if (content.length < 12) return null;

  const category: AiMemoryCategory = /tone|style|write|writing|voice/i.test(content)
    ? "writing_style"
    : /event|gala|banquet|host|registration/i.test(content)
      ? "event"
      : /workflow|process|always|usually|recurring/i.test(content)
        ? "workflow"
        : /organization|org|church|ministry|nonprofit/i.test(content)
          ? "organization"
          : "preference";

  return prisma.aiUserMemory.create({
    data: {
      organizationId: options.organizationId,
      userId: options.userId,
      title: content.split(/[.!?\n]/)[0].slice(0, 120) || "Saved memory",
      content,
      category,
      source: "explicit_chat",
      confidence: 0.9,
      workspaceScope: normalizeWorkspaceScope(options.workspaceScope),
      active: true,
    },
  });
}

export function jsonTags(tags: string[]): Prisma.InputJsonValue {
  return tags as Prisma.InputJsonValue;
}
