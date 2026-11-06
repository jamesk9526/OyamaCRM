import type { LetterTemplate } from "@prisma/client";
import { collectMergeFieldKeys, unsupportedMergeFieldKeys } from "../services/letters-merge.js";
import { object, string, type Channel } from "./domain.js";
import { fingerprint } from "./legacy.js";
import { normalizeDoc, walkNodes } from "./studio/design.js";
import { htmlToStudio, sanitizeStudioHtml } from "./studio/html.js";
import { nodeHtml } from "./studio/html-document.js";
import { paragraph } from "./studio/registry.js";
import { plainText } from "./studio/render.js";
import { tokenizeMergeText } from "./studio/merge-token.js";
import type { StudioDesign, StudioDoc, StudioNode } from "./studio/types.js";

export const LETTER_ADAPTATION_CHANNELS = ["EMAIL", "WEB", "SOCIAL", "SMS"] as const;
export type LetterAdaptationChannel = typeof LETTER_ADAPTATION_CHANNELS[number];
type Link = { source: string; targetId?: string; applied?: string; excerpt: string };
export type LetterAdaptation = { version: 1; letterRevision: number; links: Link[] };
type Change = { id: number; before: string; after: string; current?: string; action: "add" | "replace" | "remove" | "conflict" };
type Step = { old?: Link; incoming?: StudioNode; change?: Change };
const printOnly = new Set(["letterPageBreak", "letterSpacer", "studioSignature", "studioAddress", "studioQr", "studioResponse", "studioLegacy"]);
const recipientBlocks = new Set(["studioSalutation", "studioField", "studioReceipt", "studioHistory", "studioAsk", "studioPledge", "studioCondition"]);
const publicImage = /^\/(?:api\/public-media\/branding|api\/letters\/media|uploads\/branding|uploads\/letter-media)\//i;
const digestNode = (node: StudioNode) => {
  const normalized = normalizeDoc({ type: "doc", content: [node] });
  for (const child of walkNodes(normalized)) if (child.content) child.content = child.content.flatMap(item => item.type === "text" ? tokenizeMergeText(item.text || "", item.marks) : [item]);
  return fingerprint(JSON.stringify(normalized, (key, value) => ["studioId", "reviewedHtml"].includes(key) ? undefined : value));
};
const nodeId = (node: StudioNode) => string(node.attrs?.studioId);
const excerpt = (node: StudioNode) => plainText(nodeHtml(node, "#126f68")).slice(0, 320);

export function readLetterAdaptation(raw: unknown): LetterAdaptation | null {
  const value = object(raw);
  return value.version === 1 && Number.isInteger(value.letterRevision) && Array.isArray(value.links) ? value as unknown as LetterAdaptation : null;
}

export function projectLetterAdaptation(letter: Pick<LetterTemplate, "printBody" | "documentJson">, design: StudioDesign, channel: LetterAdaptationChannel) {
  const rich = object(letter.documentJson).renderer === "studio";
  const authoring = rich ? design.channels?.LETTER?.document || design.body : htmlToStudio(letter.printBody, "letter-source").document;
  let omitted = 0;
  function project(node: StudioNode): StudioNode | null {
    const html = nodeHtml(node, design.styles.primary);
    const keys = collectMergeFieldKeys(html, JSON.stringify(node.attrs || {}));
    const recipientCopy = recipientBlocks.has(node.type) || keys.some(key => !key.startsWith("organization.") && !["campaign.name", "currentDate"].includes(key));
    const textOnly = channel === "SOCIAL" || channel === "SMS";
    if (node.attrs?.printOnly || printOnly.has(node.type) || /data-letter-(?:page-break|spacer|signature|qr)|data-keep-together="signature"/i.test(html)
      || channel !== "EMAIL" && (recipientCopy || /(?:[?&]|&amp;)(?:createResponse|recipientId)=/i.test(html)) || unsupportedMergeFieldKeys(keys).length > 0
      || textOnly && /\[Studio block:/.test(html)
      || node.type === "studioHtml" && node.attrs?.sourceRevisionId) {
      omitted++; return null;
    }
    if (channel !== "EMAIL" && node.type === "image" && !publicImage.test(string(node.attrs?.src))) {
      omitted++; return null;
    }
    if (channel !== "EMAIL" && node.type === "studioHtml" && /<img\b|<a\b/i.test(html)) {
      omitted++; return null;
    }
    const next = structuredClone(node);
    if (next.type === "studioHtml") {
      const sanitized = sanitizeStudioHtml(html);
      next.attrs = { ...next.attrs, html: sanitized, reviewedHtml: sanitized };
    }
    if (next.content) next.content = next.content.flatMap(child => project(child) || []);
    return next;
  }
  const content = authoring.content.flatMap(node => {
    const projected = project(node);
    if (!projected) return [];
    if (channel !== "SMS" && channel !== "SOCIAL") return [projected];
    const text = plainText(nodeHtml(projected, design.styles.primary)).replace(/\s+/g, " ").trim();
    return text ? [paragraph(nodeId(projected) || "copy", text)] : [];
  });
  return {
    content,
    warnings: omitted ? [`${omitted} print-only, personal, or unsupported section${omitted === 1 ? " was" : "s were"} omitted. Add any replacement copy in the channel draft.`] : [],
  };
}

/** Match stable content in order, then pair replacements within each changed span. */
function matchBlocks(prior: Link[], next: StudioNode[]) {
  const keys = next.map(digestNode), cols = next.length + 1;
  const counts = new Uint16Array((prior.length + 1) * cols);
  for (let i = prior.length - 1; i >= 0; i--) for (let j = next.length - 1; j >= 0; j--) {
    counts[i * cols + j] = prior[i].source === keys[j] ? 1 + counts[(i + 1) * cols + j + 1] : Math.max(counts[(i + 1) * cols + j], counts[i * cols + j + 1]);
  }
  const matches: Array<[number, number]> = [];
  let i = 0, j = 0;
  while (i < prior.length && j < next.length) {
    if (prior[i].source === keys[j]) matches.push([i++, j++]);
    else if (counts[(i + 1) * cols + j] >= counts[i * cols + j + 1]) i++;
    else j++;
  }
  return [...matches, [prior.length, next.length] as [number, number]];
}

export function compareLetterAdaptation(prior: LetterAdaptation | null, target: StudioDoc, incoming: StudioNode[]) {
  const previous = prior?.links || [], targetById = new Map(target.content.map(node => [nodeId(node), node]));
  const steps: Step[] = [], changes: Change[] = [];
  let oldIndex = 0, newIndex = 0;
  for (const [oldMatch, newMatch] of matchBlocks(previous, incoming)) {
    while (oldIndex < oldMatch || newIndex < newMatch) {
      const old = oldIndex < oldMatch ? previous[oldIndex++] : undefined;
      const next = newIndex < newMatch ? incoming[newIndex++] : undefined;
      const targetNode = old?.targetId ? targetById.get(old.targetId) : undefined;
      const conflict = !!old?.targetId && (!targetNode || old.applied !== digestNode(targetNode));
      const change: Change = {
        id: changes.length, action: conflict ? "conflict" : next ? targetNode ? "replace" : "add" : "remove",
        before: old?.excerpt || "", after: next ? excerpt(next) : "", ...(conflict ? { current: targetNode ? excerpt(targetNode) : "" } : {}),
      };
      changes.push(change); steps.push({ old, incoming: next, change });
    }
    if (oldMatch < previous.length) steps.push({ old: previous[oldMatch], incoming: incoming[newMatch] });
    oldIndex = oldMatch + 1; newIndex = newMatch + 1;
  }
  return { changes, steps };
}

export function applyLetterAdaptation(target: StudioDoc, steps: Step[], selected: ReadonlySet<number>, channel: Channel, key: string) {
  const content = [...target.content], links: Link[] = [];
  let anchor: string | undefined;
  for (const [index, { old, incoming, change }] of steps.entries()) {
    const position = old?.targetId ? content.findIndex(node => nodeId(node) === old.targetId) : -1;
    const accept = change && change.action !== "conflict" && selected.has(change.id);
    if (!incoming) {
      if (accept && position >= 0) content.splice(position, 1);
      continue;
    }
    const source = digestNode(incoming), text = excerpt(incoming);
    if (!accept) {
      links.push({ ...old, source, excerpt: text });
      if (position >= 0) anchor = old?.targetId;
      continue;
    }
    const targetId = position >= 0 ? old!.targetId! : `letter-${channel.toLowerCase()}-${key}-${index}`;
    const node = structuredClone(incoming);
    walkNodes(node).forEach((child, i) => {
      if (!["text", "mergeField", "hardBreak"].includes(child.type)) child.attrs = { ...child.attrs, studioId: i === 0 ? targetId : `${targetId}-${i}` };
    });
    if (position >= 0) content[position] = node;
    else {
      const after = anchor ? content.findIndex(item => nodeId(item) === anchor) : -1;
      const following = steps.slice(index + 1).find(step => step.old?.targetId && content.some(item => nodeId(item) === step.old!.targetId));
      const before = following ? content.findIndex(item => nodeId(item) === following.old!.targetId) : -1;
      content.splice(after >= 0 ? after + 1 : before >= 0 ? before : content.length, 0, node);
    }
    links.push({ source, targetId, applied: digestNode(node), excerpt: text }); anchor = targetId;
  }
  return { document: { type: "doc" as const, content }, links };
}
