/** Versioned, channel-neutral authoring and delivery contracts. No clinical merge context. */
export const CHANNELS = ["EMAIL", "LETTER", "WEB", "SMS", "SOCIAL"] as const;
export type Channel = typeof CHANNELS[number];
export const DELIVERY_MODES = ["EMAIL_FIRST", "LETTER_FIRST", "BOTH"] as const;
export type DeliveryMode = typeof DELIVERY_MODES[number];
export type SharedBlock = { id: string; kind: "heading" | "paragraph" | "image" | "link"; text: string; url?: string };
export type SharedDocument = { version: 1; blocks: SharedBlock[] };
export type VariantDocument = {
  overrides: Record<string, string>;
  scheduledAt: string | null;
  subject: string;
  caption: string;
  mediaUrl: string;
  accountId: string;
  network: "FACEBOOK" | "INSTAGRAM";
  ctaLabel: string;
  ctaUrl: string;
  formEnabled: boolean;
  consentText: string;
  requiresLandingPage: boolean;
};
export type AudienceMember = {
  key: string; constituentId: string | null; firstName: string; lastName: string; name?: string;
  email: string; phone: string; addressLine1: string; addressLine2: string; city: string; state: string; zip: string; country: string;
  doNotContact: boolean; doNotMail: boolean; doNotEmail: boolean; emailOptOut: boolean;
};
export type PlannedRecipient = { channel: "EMAIL" | "LETTER" | "SMS"; key: string; member: AudienceMember };
export type AudiencePlan = { recipients: PlannedRecipient[]; total: number; overlap: number; excluded: number; missingEmail: number; missingPostal: number; missingSmsConsent: number; counts: Record<string, number> };
export class CreateError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export const object = (value: unknown): Record<string, unknown> => value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
export const string = (value: unknown) => typeof value === "string" ? value : "";
export function required(value: unknown, name: string, max = 191): string {
  const text = string(value).trim();
  if (!text || text.length > max) throw new CreateError(400, `${name} is required and must be at most ${max} characters.`);
  return text;
}
export function safeUrl(value: unknown): string {
  const text = string(value).trim();
  if (!text) return "";
  if (text.length > 2000) throw new CreateError(400, "The URL is too long.");
  try { const url = new URL(text); if (url.protocol === "https:" && !url.username && !url.password) return url.toString(); } catch { /* validation below */ }
  throw new CreateError(400, "Use a complete HTTPS URL.");
}
export function documentFrom(value: unknown): SharedDocument {
  const input = object(value);
  if (input.version !== 1 || !Array.isArray(input.blocks) || input.blocks.length > 200) throw new CreateError(400, "A version 1 document with up to 200 blocks is required.");
  const ids = new Set<string>();
  const blocks = input.blocks.map(raw => {
    const block = object(raw); const id = required(block.id, "Block ID", 100);
    if (ids.has(id) || !/^[a-z0-9:_-]+$/i.test(id)) throw new CreateError(400, "Block IDs must be unique and contain only letters, numbers, colons, underscores or hyphens.");
    ids.add(id);
    const kind = string(block.kind);
    if (!["heading", "paragraph", "image", "link"].includes(kind)) throw new CreateError(400, "Unsupported shared block type.");
    if (string(block.text).length > 20000) throw new CreateError(400, "A text block exceeds 20,000 characters.");
    return { id, kind: kind as SharedBlock["kind"], text: string(block.text), ...(["link", "image"].includes(kind) ? { url: safeUrl(block.url) } : {}) };
  });
  if (JSON.stringify(blocks).length > 300000) throw new CreateError(400, "This document exceeds the size limit.");
  return { version: 1, blocks };
}
export function variantFrom(value: unknown): VariantDocument {
  const input = object(value); const overrides: Record<string, string> = {};
  for (const [key, text] of Object.entries(object(input.overrides))) {
    if (!/^[a-z0-9:_-]{1,100}$/i.test(key) || typeof text !== "string" || text.length > 20000) throw new CreateError(400, "Invalid format customization.");
    overrides[key] = text;
  }
  if (Object.keys(overrides).length > 200) throw new CreateError(400, "Too many customizations.");
  let scheduledAt: string | null = null;
  if (input.scheduledAt !== undefined && input.scheduledAt !== null && input.scheduledAt !== "") {
    const date = new Date(string(input.scheduledAt));
    if (!Number.isFinite(date.getTime()) || date.getUTCFullYear() < 1000 || date.getUTCFullYear() > 9999) throw new CreateError(400, "Choose a valid channel delivery date and time.");
    scheduledAt = date.toISOString();
  }
  for (const key of ["subject", "caption", "consentText", "ctaLabel"]) if (string(input[key]).length > (key === "caption" ? 2048 : 1000)) throw new CreateError(400, `${key} is too long.`);
  return { overrides, scheduledAt, subject: string(input.subject), caption: string(input.caption), mediaUrl: safeUrl(input.mediaUrl), accountId: string(input.accountId).slice(0, 100), network: input.network === "INSTAGRAM" ? "INSTAGRAM" : "FACEBOOK", ctaLabel: string(input.ctaLabel), ctaUrl: safeUrl(input.ctaUrl), formEnabled: input.formEnabled === true, consentText: string(input.consentText), requiresLandingPage: input.requiresLandingPage === true };
}
export function escapeHtml(text: string): string { return text.replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]!); }
export function effectiveBlocks(document: SharedDocument, variant: VariantDocument): SharedBlock[] { return document.blocks.map(block => ({ ...block, text: variant.overrides[block.id] ?? block.text })); }
export function renderShared(document: SharedDocument, variant: VariantDocument): { html: string; text: string } {
  const blocks = effectiveBlocks(document, variant);
  return {
    html: blocks.map(block => {
      const text = escapeHtml(block.text).replace(/\n/g, "<br>"); const url = escapeHtml(block.url || "");
      if (block.kind === "heading") return `<h2>${text}</h2>`;
      if (block.kind === "image") return url ? `<p><img src="${url}" alt="${text}" style="max-width:100%"></p>` : "";
      if (block.kind === "link") return url ? `<p><a href="${url}">${text}</a></p>` : `<p>${text}</p>`;
      return `<p>${text}</p>`;
    }).join("\n"),
    text: blocks.map(block => block.text + (block.url ? ` (${block.url})` : "")).join("\n\n"),
  };
}
export function publicCopySafe(document: SharedDocument, variant: VariantDocument): boolean {
  const values = [...document.blocks.flatMap(block => [block.text, block.url || ""]), ...Object.values(variant.overrides), variant.subject, variant.caption, variant.ctaLabel, variant.ctaUrl, variant.consentText];
  return values.every(value => !/\{\{|\{[a-z][a-z0-9_.]*\}|(^|[\s([>])\/\/[a-z][a-z0-9_.]*\b/i.test(value));
}
/** Fallback means eligible at review time; provider failures never silently change the approved channel. */
export function planAudience(members: AudienceMember[], channels: Channel[], mode: DeliveryMode | null, eligibleEmails: Set<string>, smsConsent: Set<string>): AudiencePlan {
  if (channels.includes("EMAIL") && channels.includes("LETTER") && !mode) throw new CreateError(400, "Choose email first, letter first, or both eligible formats before review.");
  const plan: AudiencePlan = { recipients: [], total: members.length, overlap: 0, excluded: 0, missingEmail: 0, missingPostal: 0, missingSmsConsent: 0, counts: { EMAIL: 0, LETTER: 0, SMS: 0 } };
  const seen = new Set<string>();
  for (const member of members) {
    const email = !member.doNotContact && !member.doNotEmail && !member.emailOptOut && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email) && eligibleEmails.has(member.email.toLowerCase());
    const postal = !member.doNotContact && !member.doNotMail && !!(member.constituentId && member.addressLine1.trim() && member.city.trim() && member.zip.trim() && member.country.trim());
    const sms = !member.doNotContact && /^\+[1-9]\d{7,14}$/.test(member.phone) && smsConsent.has(member.phone);
    if (!email) plan.missingEmail++;
    if (!postal) plan.missingPostal++;
    if (!sms) plan.missingSmsConsent++;
    if (email && postal) plan.overlap++;
    const selected: Array<"EMAIL" | "LETTER" | "SMS"> = [];
    if (channels.includes("EMAIL") && email && (mode !== "LETTER_FIRST" || !channels.includes("LETTER") || !postal)) selected.push("EMAIL");
    if (channels.includes("LETTER") && postal && (mode !== "EMAIL_FIRST" || !channels.includes("EMAIL") || !email)) selected.push("LETTER");
    if (channels.includes("SMS") && sms) selected.push("SMS");
    if (!selected.length) plan.excluded++;
    for (const channel of selected) {
      const key = channel === "EMAIL" ? member.email.toLowerCase() : channel === "SMS" ? member.phone : member.constituentId!;
      if (seen.has(`${channel}:${key}`)) continue;
      seen.add(`${channel}:${key}`); plan.counts[channel]++; plan.recipients.push({ channel, key, member });
    }
  }
  return plan;
}
