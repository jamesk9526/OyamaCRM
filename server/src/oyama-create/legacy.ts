/** Native editors stay canonical for format-specific layout; changes require explicit review. */
import { Prisma, type CreateContent, type CreateVariant } from "@prisma/client";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { normalizeEmailTemplateDocument, normalizeEmailTemplateSettings, renderEmailTemplateDocument } from "../services/oyama-email/email-render-service.js";
import { CreateError, documentFrom, object, renderShared, string, variantFrom, type SharedDocument, type VariantDocument } from "./domain.js";

export const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function nativeRecord(org: string, variant: Pick<CreateVariant, "channel" | "legacyId">, db: Prisma.TransactionClient = prisma, allowMissing = false) {
  if (!variant.legacyId) return null;
  if (variant.channel === "EMAIL") {
    const email = await db.emailCampaign.findFirst({ where: { id: variant.legacyId, organizationId: org } });
    if (!email) { if (allowMissing) return null; throw new CreateError(409, "The linked email was removed. Review or replace the binding."); }
    return { kind: "EMAIL" as const, record: email, fingerprint: fingerprint([email.subject, email.bodyHtml, email.bodyText, email.templateJson, email.fromName, email.fromEmail, email.replyToEmail]) };
  }
  if (variant.channel === "LETTER") {
    const letter = await db.letterTemplate.findFirst({ where: { id: variant.legacyId, organizationId: org, crmScope: "DONOR" } });
    if (!letter) { if (allowMissing) return null; throw new CreateError(409, "The linked donor letter is unavailable."); }
    return { kind: "LETTER" as const, record: letter, fingerprint: fingerprint([letter.printSubject, letter.printBody, letter.printLayoutJson, letter.headerPresetId, letter.footerPresetId, letter.signatureBlockId, letter.documentJson]) };
  }
  return null;
}
export async function nativeChanged(org: string, variant: CreateVariant) {
  const native = await nativeRecord(org, variant);
  return !!native && native.fingerprint !== variant.legacyFingerprint;
}
export function parseStored(raw: string | null): Record<string, unknown> { try { return object(JSON.parse(raw || "{}")); } catch { return {}; } }
export function reusableEmailRecord(email: { status: string; totalRecipients: number; sentAt: Date | null; scheduledAt: Date | null; audienceFilter: string | null; templateJson: string | null }): boolean {
  return email.status === "DRAFT" && email.totalRecipients === 0 && !email.sentAt && !email.scheduledAt && !email.audienceFilter && !object(parseStored(email.templateJson)).templateSnapshot;
}
export function emailRecordSharing(email: { templateJson: string | null; audienceFilter: string | null }): { ownerId: string | null; sharedWithOrganization: boolean } {
  const stored = parseStored(email.templateJson), audience = parseStored(email.audienceFilter);
  if (audience._sharing && typeof audience._sharing === "object" && !Array.isArray(audience._sharing)) {
    const canonical = object(audience._sharing);
    return { ownerId: string(canonical.ownerId) || null, sharedWithOrganization: typeof canonical.sharedWithOrganization === "boolean" ? canonical.sharedWithOrganization : true };
  }
  return { ownerId: string(stored.ownerId) || null, sharedWithOrganization: stored.sharedWithOrganization === true };
}
export function emailRecordAccessible(email: { templateJson: string | null; audienceFilter: string | null }, actor: string, role: string, manage = false): boolean {
  const sharing = emailRecordSharing(email);
  return role === "admin" || !sharing.ownerId || sharing.ownerId === actor || !manage && sharing.sharedWithOrganization;
}
export function remapManagedCopy(value: unknown, previousId: string, contentId: string): unknown {
  if (Array.isArray(value)) return value.map(item => remapManagedCopy(item, previousId, contentId));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
    if (key === "id" && item === `create:${previousId}`) return [key, `create:${contentId}`];
    if (key === "createBlockId" && typeof item === "string" && item.startsWith(`${previousId}:`)) return [key, `${contentId}${item.slice(previousId.length)}`];
    if (typeof item === "string" && ["html", "printBody"].includes(key)) return [key, item.split(`data-create-block="${previousId}:`).join(`data-create-block="${contentId}:`).split(`data-create-block='${previousId}:`).join(`data-create-block='${contentId}:`)];
    return [key, remapManagedCopy(item, previousId, contentId)];
  }));
}

/** Managed paragraph identity survives structured letter editing and sanitization. */
export function projectLetterCopy(original: string, contentId: string, document: SharedDocument, format: VariantDocument): string {
  const pending = new Map(document.blocks.map(block => [block.id, renderShared({ version: 1, blocks: [block] }, format).html.replace(/^<(p|h2)>/, `<$1 data-create-block="${contentId}:${block.id}">`)]));
  const escapedId = contentId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`<([ph][1-6]?)\\b(?=[^>]*\\bdata-create-block=["']${escapedId}:([^"']+)["'])[^>]*>[\\s\\S]*?<\\/\\1>`, "gi");
  let found = false;
  const result = original.replace(pattern, (_match, _tag, id: string) => { found = true; const html = pending.get(id) || ""; pending.delete(id); return html; });
  const newCopy = [...pending.values()].join("\n");
  return found ? `${result}${newCopy}` : `${newCopy}${original}`;
}

/** Project shared text into its own native block, preserving every other native block and setting. */
export async function syncNative(db: Prisma.TransactionClient, org: string, actor: string, content: Pick<CreateContent, "id" | "name" | "documentJson">, variant: CreateVariant, acceptExternal = false) {
  const document = documentFrom(content.documentJson); const format = variantFrom(variant.documentJson);
  const rendered = renderShared(document, format); const native = await nativeRecord(org, variant, db);
  if (native && native.fingerprint !== variant.legacyFingerprint && !acceptExternal) throw new CreateError(409, "The native layout changed. Review it before synchronizing shared text.");
  let legacyId = variant.legacyId;
  if (variant.channel === "EMAIL") {
    const settings = await db.organizationSettings.findUnique({ where: { organizationId: org } });
    const stored = native?.kind === "EMAIL" ? parseStored(native.record.templateJson) : {};
    const template = normalizeEmailTemplateDocument(stored.template);
    if (!native) template.blocks = [];
    const sharedId = `create:${content.id}`;
    const old = template.blocks.findIndex(block => block.id === sharedId);
    const block = { id: sharedId, type: "html" as const, html: rendered.html };
    if (old >= 0) template.blocks[old] = block; else template.blocks.unshift(block);
    const templateSettings = normalizeEmailTemplateSettings(stored.settings);
    templateSettings.includeUnsubscribeLink = true; templateSettings.includePhysicalAddress = true;
    const output = renderEmailTemplateDocument(template, templateSettings);
    const data = { name: content.name, subject: format.subject || content.name, fromName: native?.kind === "EMAIL" ? native.record.fromName : settings?.smtpFromName || "", fromEmail: native?.kind === "EMAIL" ? native.record.fromEmail : settings?.smtpFromEmail || "", replyToEmail: native?.kind === "EMAIL" ? native.record.replyToEmail : settings?.smtpFromEmail || "", bodyHtml: output.html, bodyText: output.text, templateJson: JSON.stringify({ ...stored, template, settings: templateSettings, ownerId: stored.ownerId || actor }) };
    if (native?.kind === "EMAIL") {
      if (native.record.status !== "DRAFT" || native.record.sentAt || native.record.totalRecipients > 0 || native.record.scheduledAt) throw new CreateError(409, "Historical executions are immutable. Duplicate this content into a new campaign to edit.");
      await db.emailCampaign.update({ where: { id: native.record.id }, data });
    } else { legacyId = (await db.emailCampaign.create({ data: { ...data, organizationId: org, purpose: "MARKETING" } })).id; }
  } else if (variant.channel === "LETTER") {
    const original = native?.kind === "LETTER" ? native.record.printBody : "";
    const body = projectLetterCopy(original, content.id, document, format);
    if (native?.kind === "LETTER") {
      await db.letterTemplate.update({ where: { id: native.record.id }, data: { printBody: body, printSubject: format.subject || content.name, documentJson: Prisma.DbNull, documentSchemaVersion: 1, revision: { increment: 1 }, updatedByUserId: actor } });
    } else { legacyId = (await db.letterTemplate.create({ data: { organizationId: org, name: content.name, printSubject: format.subject || content.name, printBody: body, createdByUserId: actor, crmScope: "DONOR" } })).id; }
  } else return;
  const next = await nativeRecord(org, { ...variant, legacyId }, db);
  await db.createVariant.update({ where: { id: variant.id }, data: { legacyId, legacyFingerprint: next!.fingerprint, nativeApproved: false } });
}

export function extractSharedFromEmail(raw: string | null): SharedDocument {
  const stored = parseStored(raw); const template = normalizeEmailTemplateDocument(stored.template);
  const blocks = template.blocks.filter(block => block.type === "text" || block.type === "header").map(block => ({ id: block.id, kind: block.type === "header" ? "heading" as const : "paragraph" as const, text: string(block.type === "header" ? block.headerTitle : block.content).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").trim() }));
  return { version: 1, blocks };
}

export function adaptationIssues(channel: string, document: SharedDocument, format: VariantDocument): string[] {
  const issues: string[] = [];
  if (["SMS", "SOCIAL"].includes(channel) && document.blocks.some(block => block.kind === "image")) issues.push("Shared inline images are not sent as message text. Choose social media separately.");
  if (channel === "SMS" && (format.caption || renderShared(document, format).text).length > 2048) issues.push("SMS text exceeds Azure's 2,048-character limit. Customize its caption.");
  return issues;
}
