/** Utilities for visual print-layout blocks used by letters templates. */
import type { PrintLayoutBlock, PrintLayoutDocument, PrintLayoutKind } from "@/app/components/letters/types";

const DEFAULT_SPACER_HEIGHT = 24;

/** Creates a stable-enough client ID for new visual blocks. */
export function createPrintLayoutBlockId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Builds a default block object for the requested block kind. */
export function createDefaultPrintBlock(kind: PrintLayoutKind): PrintLayoutBlock {
  if (kind === "HEADING") {
    return { id: createPrintLayoutBlockId(), kind, content: "Section Heading", level: 2 };
  }
  if (kind === "MERGE_TOKEN") {
    return { id: createPrintLayoutBlockId(), kind, token: "{{donor.firstName}}" };
  }
  if (kind === "DIVIDER") {
    return { id: createPrintLayoutBlockId(), kind };
  }
  if (kind === "SPACER") {
    return { id: createPrintLayoutBlockId(), kind, spacerHeight: DEFAULT_SPACER_HEIGHT };
  }
  return { id: createPrintLayoutBlockId(), kind: "PARAGRAPH", content: "" };
}

/** Converts a plain print-body string into starter visual paragraph blocks. */
export function bodyToPrintLayout(body: string): PrintLayoutDocument {
  const normalized = body.trim();
  if (!normalized) return [];

  const paragraphs = normalized.split(/\n\s*\n+/).map((item) => item.trim()).filter(Boolean);
  if (paragraphs.length === 0) return [];

  return paragraphs.map((paragraph) => ({
    id: createPrintLayoutBlockId(),
    kind: "PARAGRAPH" as const,
    content: paragraph,
  }));
}

/** Converts visual blocks to the printBody format for backward compatibility. */
export function printLayoutToBody(blocks: PrintLayoutDocument): string {
  const lines: string[] = [];

  for (const block of blocks) {
    if (block.kind === "PARAGRAPH") {
      const text = String(block.content ?? "").trim();
      if (text) {
        lines.push(text, "");
      }
      continue;
    }

    if (block.kind === "HEADING") {
      const text = String(block.content ?? "").trim();
      if (text) {
        lines.push(text.toUpperCase(), "");
      }
      continue;
    }

    if (block.kind === "MERGE_TOKEN") {
      const token = String(block.token ?? "").trim();
      if (token) {
        lines.push(token, "");
      }
      continue;
    }

    if (block.kind === "DIVIDER") {
      lines.push("--------------------", "");
      continue;
    }

    if (block.kind === "SPACER") {
      const spacerLines = Math.max(1, Math.round((block.spacerHeight ?? DEFAULT_SPACER_HEIGHT) / 24));
      for (let index = 0; index < spacerLines; index += 1) {
        lines.push("");
      }
    }
  }

  while (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines.join("\n");
}

/** Safely parses unknown API JSON into a valid visual print-layout block array. */
export function parsePrintLayout(value: unknown): PrintLayoutDocument {
  if (!Array.isArray(value)) return [];

  const blocks: PrintLayoutDocument = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;
    const id = typeof candidate.id === "string" ? candidate.id : createPrintLayoutBlockId();
    const kind = typeof candidate.kind === "string" ? candidate.kind.toUpperCase() : "";

    if (kind === "PARAGRAPH" || kind === "HEADING") {
      blocks.push({ id, kind, content: typeof candidate.content === "string" ? candidate.content : "", level: Number(candidate.level ?? 2) });
      continue;
    }
    if (kind === "MERGE_TOKEN") {
      blocks.push({ id, kind, token: typeof candidate.token === "string" ? candidate.token : "{{donor.firstName}}" });
      continue;
    }
    if (kind === "DIVIDER") {
      blocks.push({ id, kind });
      continue;
    }
    if (kind === "SPACER") {
      blocks.push({ id, kind, spacerHeight: Number(candidate.spacerHeight ?? DEFAULT_SPACER_HEIGHT) });
    }
  }

  return blocks;
}
