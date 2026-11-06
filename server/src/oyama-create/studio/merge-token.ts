import { collectMergeFieldKeys, SUPPORTED_LETTER_MERGE_FIELDS } from "../../services/letters-merge.js";
import type { StudioNode } from "./types.js";
export const UNIFIED_FIELDS = [...new Set([...collectMergeFieldKeys(...SUPPORTED_LETTER_MERGE_FIELDS), "name", "salutation", "address", "entityKind", "gift.deductible", "giving.total", "giving.count", "giving.lastAmount", "giving.lastDate", "pledge.balance", "campaign.name", "responseCode", "asOf", "ask.suggested"])];
const tokenPattern = /\{\{\s*[a-zA-Z0-9_.]+(?:\s*\|\s*[^}]+?)?\s*\}\}|(?<!\{)\{\s*[a-zA-Z][a-zA-Z0-9]*(?:\s*\|\s*[^}]+?)?\s*\}|(?<![\w/])\/\/[a-zA-Z][a-zA-Z0-9]*(?![\w/])/g;
export function mergeFieldForToken(token: string): string | null {
  const match = token.match(tokenPattern);
  if (match?.length !== 1 || match[0] !== token) return null;
  const fields = collectMergeFieldKeys(token);
  return fields.length === 1 && UNIFIED_FIELDS.includes(fields[0]) ? fields[0] : null;
}
/** Authored aliases/filters are retained. A field id never authorizes its value. */
export function tokenizeMergeText(text: string, marks: StudioNode["marks"] = []): StudioNode[] {
  const nodes: StudioNode[] = []; let end = 0;
  for (const match of text.matchAll(tokenPattern)) {
    const field = mergeFieldForToken(match[0]); if (!field) continue;
    if (match.index! > end) nodes.push({ type: "text", text: text.slice(end, match.index), ...(marks.length ? { marks } : {}) });
    nodes.push({ type: "mergeField", attrs: { field, rawToken: match[0] }, ...(marks.length ? { marks } : {}) });
    end = match.index! + match[0].length;
  }
  if (end < text.length) nodes.push({ type: "text", text: text.slice(end), ...(marks.length ? { marks } : {}) });
  return nodes;
}
