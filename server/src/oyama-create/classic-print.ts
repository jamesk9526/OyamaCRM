import type { CreateCampaign } from "@prisma/client";
import type { Request } from "express";
import { PDFDocument } from "pdf-lib";
import { DomUtils, parseDocument } from "htmlparser2";
import { prisma } from "../lib/prisma.js";
import { digest, freezeAsset, ProductionError, recipientSnapshot } from "../services/letter-production.js";
import { productionLayout, type LetterSnapshot } from "../services/letter-production-contract.js";
import { resolveLetterMergeContext } from "../services/letters-execution.js";
import { collectMergeFieldKeys, renderMergeFields, unsupportedMergeFieldKeys } from "../services/letters-merge.js";
import { demand } from "./access.js";
import { CreateError, escapeHtml } from "./domain.js";
import { classicConfig, type loadClassicLetter } from "./classic-letter.js";
import { brandForStudio } from "./studio/brand-service.js";
import { resolveStudioDonor } from "./studio/donor.js";
import { freezeStudioPrint } from "./studio/print.js";
import { designSensitive, plainText } from "./studio/render.js";
import { hydrateSourceHtml } from "./studio/source-html.js";
import type { ArtifactKind, DonorContext, StudioDesign } from "./studio/types.js";
import { sanitizeStudioHtml } from "./studio/html.js";

type LetterInputs = Pick<Awaited<ReturnType<typeof loadClassicLetter>>, "config" | "template" | "design">;
type Recipient = LetterSnapshot["recipient"];
export type ClassicArtifact = { kind: ArtifactKind; snapshot: LetterSnapshot };
const sensitiveKey = /^(?:gift\.|giving\.|pledge\.|year\.|donor\.(?:total|lifetime)|ask\.)/i;
const classicHeaderFields = ["organization.contact"];

export function classicLetterIssues({ config, template, design }: LetterInputs) {
  const sources = [template.printBody, template.printSubject, config.settings.headerHtml, config.settings.footerHtml];
  const keys = collectMergeFieldKeys(...sources);
  const unsupported = config.renderer === "classic" ? unsupportedMergeFieldKeys(keys).filter(key => !classicHeaderFields.includes(key)) : [];
  const fonts = new Set(sources.flatMap(html => [...html.replace(/&quot;|&#39;/g, "").matchAll(/font-family\s*:\s*([^;<>]+)/gi)].map(match => match[1].split(",")[0].replace(/["']/g, "").trim())));
  const unknownFonts = [...fonts].filter(name => name && !/^(?:arial|calibri|helvetica|times new roman|times|georgia|courier new|courier|monospace|serif|sans-serif)$/i.test(name));
  const fontIssues = config.renderer === "classic" ? unknownFonts.map(name => `${name} is unavailable in the classic PDF layout. Choose an available print font.`) : [];
  return {
    keys,
    sensitive: keys.some(key => sensitiveKey.test(key)) || !!design && config.renderer === "studio" && designSensitive({ ...design, body: design.channels?.LETTER?.document || design.body, channels: undefined }),
    blockers: [...unsupported.map(key => `Unsupported letter field: ${key}.`), ...fontIssues],
  };
}

export function printKinds(design: StudioDesign | null, renderer: "classic" | "studio"): ArtifactKind[] {
  const kinds: ArtifactKind[] = ["LETTER"];
  if (design?.pack.replySlip.enabled && (renderer === "classic" || design.pack.replySlip.placement === "separate")) kinds.push("REPLY_SLIP");
  if (design?.pack.outerEnvelope.enabled) kinds.push("OUTER_ENVELOPE");
  if (design?.pack.returnEnvelope.enabled) kinds.push("RETURN_ENVELOPE");
  return kinds;
}

export async function freezeClassicArtifacts(
  req: Request, campaign: CreateCampaign, letter: LetterInputs, input: {
    templateId: string; revision: number; constituentId?: string; donationId?: string; asOf: Date;
    sample: boolean; proof?: boolean; responseCode?: string; kinds?: ArtifactKind[]; cache?: Map<string, Promise<string>>;
  },
): Promise<ClassicArtifact[]> {
  const org = campaign.organizationId;
  const { config, template, design } = letter, issues = classicLetterIssues(letter);
  const selectedGift = input.donationId || (input.constituentId ? config.settings.giftSelections?.[input.constituentId] : undefined);
  if (input.constituentId) {
    await demand(req, "view:constituents");
    if (issues.sensitive || selectedGift) await demand(req, "letters.view_sensitive_merge_data");
  }
  if (issues.keys.includes("event.name")) await demand(req, "view:events");
  if (issues.blockers.length) throw new CreateError(422, issues.blockers.join(" "));
  const contact = input.constituentId ? await prisma.constituent.findFirst({ where: { id: input.constituentId, organizationId: org } }) : null;
  if (input.constituentId && !contact) throw new CreateError(404, "Proof recipient not found.");
  const recipient = recipientSnapshot(contact);
  const kinds = input.kinds || printKinds(design, config.renderer);
  let donor: DonorContext | undefined;
  if (design && (config.renderer === "studio" || kinds.some(kind => kind !== "LETTER"))) {
    donor = await resolveStudioDonor(req, campaign, design, contact?.id, input.asOf, selectedGift);
    donor.responseCode = input.responseCode || "";
  }
  if (!input.sample && !input.proof && (contact?.doNotMail || contact?.doNotContact || !recipient.addressLine1 || !recipient.city || !recipient.zip)) {
    throw new CreateError(422, "A Letter recipient is suppressed or has an incomplete postal address.");
  }
  const base: LetterSnapshot = {
    version: 2, organizationId: org, templateId: input.templateId, revision: input.revision, title: template.name,
    subject: template.printSubject, bodyHtml: "", generatedAt: input.asOf.toISOString(), recipientId: contact?.id || null, recipient,
    branding: {}, header: {}, footer: {}, signature: {}, layout: productionLayout(template.printLayoutJson), assets: {}, warnings: [], blockers: [],
  };
  const results: ClassicArtifact[] = [];
  const cache = input.cache || new Map<string, Promise<string>>();
  for (const kind of kinds) {
    if (kind === "LETTER" && config.renderer === "classic") {
      results.push({ kind, snapshot: await freezeNative(req, campaign, letter, base, { ...input, donationId: selectedGift }, issues.sensitive, cache) });
    } else if (design && donor) {
      const hydrated = await hydrateSourceHtml(req, org, design), brand = await brandForStudio(org, hydrated, "LETTER");
      const studio = await freezeStudioPrint(org, hydrated, donor, brand, kind, input.sample);
      if (!input.sample && !input.proof && studio.issues.some(issue => issue.blocking)) throw new CreateError(422, studio.issues.filter(issue => issue.blocking).map(issue => issue.message).join(" "));
      results.push({ kind, snapshot: { ...base, bodyHtml: studio.html, assets: studio.assets, studio } });
    }
  }
  return results;
}

async function freezeNative(req: Request, campaign: CreateCampaign, letter: LetterInputs, base: LetterSnapshot, input: { donationId?: string; asOf: Date; sample: boolean; proof?: boolean }, sensitive: boolean, cache: Map<string, Promise<string>>) {
  const { config, template } = letter;
  const org = campaign.organizationId, { branding, logoSource } = config.letterhead;
  const hasGiftField = collectMergeFieldKeys(template.printBody, template.printSubject, config.settings.headerHtml, config.settings.footerHtml).some(key => key.startsWith("gift."));
  const needsDonation = input.donationId || hasGiftField;
  const donation = base.recipientId && needsDonation ? await prisma.donation.findFirst({
    where: {
      constituentId: base.recipientId, constituent: { organizationId: org }, status: "COMPLETED",
      ...(input.donationId ? { id: input.donationId } : {}),
    }, orderBy: [{ date: "desc" }, { id: "desc" }], select: { id: true },
  }) : null;
  if (input.donationId && !donation) throw new CreateError(422, "The selected gift is unavailable for this recipient.");
  const context = await resolveLetterMergeContext({
    organizationId: org, actorUserId: req.user!.sub, constituentId: base.recipientId || undefined, donationId: donation?.id,
    campaignId: campaign.fundraisingCampaignId || undefined, eventId: campaign.eventId || undefined, asOf: input.asOf,
    template: { id: base.templateId, printSubject: template.printSubject, printBody: "", emailBody: null, emailSubject: null },
  });
  const values = { ...context.values, "organization.name": branding.organizationName, "organization.address": branding.addressLine, "organization.contact": branding.contactLine };
  const missing = new Set<string>();
  const options = { missingFields: missing, additionalFields: classicHeaderFields, missingMode: input.sample ? "preserve" as const : "blank" as const };
  const htmlValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, escapeHtml(value).replace(/\r?\n/g, "<br>")]));
  const mergeHtml = (html: string) => sanitizeStudioHtml(renderMergeFields(html, htmlValues, options), true);
  const bodyHtml = mergeHtml(template.printBody);
  const subject = renderMergeFields(template.printSubject, values, options);
  const presets = structuredClone(config.letterhead.presets);
  presets.headerPreset = {
    showOrganizationName: true, showTagline: true, showAddress: true, showPhone: true, showWebsite: true,
    ...presets.headerPreset, rightColumnMode: config.settings.headerMode,
    rightColumnHtml: config.settings.headerMode === "CUSTOM" ? mergeHtml(config.settings.headerHtml) : "",
  };
  presets.footerPreset = {
    showOrganizationName: true, showAddress: true, showPhone: true, showEmail: true, showWebsite: true, showTaxId: false, showPageNumber: true,
    ...presets.footerPreset, customHtml: mergeHtml(config.settings.footerHtml),
  };
  const warnings = [...missing].map(key => `Missing recipient value for ${key}.`);
  if (!input.sample && !input.proof && (warnings.length || !plainText(bodyHtml).trim() && !/<img\b/i.test(bodyHtml))) {
    throw new CreateError(422, warnings.join(" ") || "Enter letter content before approval.");
  }
  const assets: Record<string, string> = {};
  const sources = new Set(DomUtils.getElementsByTagName("img", parseDocument(bodyHtml).children).map(node => node.attribs.src));
  if (logoSource && presets.headerPreset.logoAlignment !== "NONE") sources.add(logoSource);
  if (presets.signatureBlock?.signatureImageUrl) sources.add(presets.signatureBlock.signatureImageUrl);
  for (const source of sources) {
    if (!source) continue;
    if (!cache.has(source)) cache.set(source, freezeAsset(source, org));
    assets[source] = (await cache.get(source))!;
  }
  return { ...base, subject, bodyHtml, assets, warnings, classic: { version: 1 as const, branding: { ...branding, globalFooterHtml: "" }, presets, logoSource: presets.headerPreset.logoAlignment === "NONE" ? "" : logoSource, printLayout: template.printLayoutJson, sensitive, sample: input.sample } };
}

export async function renderFrozenClassicLetter(snapshot: LetterSnapshot) {
  const classic = snapshot.classic;
  if (classic?.version !== 1) throw new ProductionError(422, "This frozen classic Letter renderer version is unavailable.");
  const logoDataUrl = classic.logoSource ? snapshot.assets[classic.logoSource] : null;
  if (classic.logoSource && !logoDataUrl) throw new ProductionError(422, "The configured logo is missing from the frozen Letter.");
  const logoFormat = logoDataUrl?.startsWith("data:image/jpeg") ? "JPEG" : logoDataUrl?.startsWith("data:image/webp") ? "WEBP" : logoDataUrl ? "PNG" : null;
  const { renderGeneratedLetterPdf, recipientFacingLetterSubject } = await import("../routes/letters.js");
  const { name, ...address } = snapshot.recipient;
  const bytes = await renderGeneratedLetterPdf({
    templateName: snapshot.title, subject: recipientFacingLetterSubject(snapshot.subject), constituentName: name,
    recipient: { ...address, fullName: name }, generatedAt: new Date(snapshot.generatedAt), mergedPrintBody: snapshot.bodyHtml,
    branding: { ...classic.branding, logoDataUrl, logoFormat }, presets: classic.presets, printLayout: classic.printLayout,
    assets: snapshot.assets, sample: classic.sample, frozenId: digest(JSON.stringify([snapshot.bodyHtml, snapshot.generatedAt, snapshot.recipient, classic])).slice(0, 32),
  });
  return { bytes, pageCount: (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount(), warnings: snapshot.warnings };
}

export function letterProofInputs(template: NonNullable<Awaited<ReturnType<typeof loadClassicLetter>>["existing"]>, design: StudioDesign | null): LetterInputs {
  return {
    config: classicConfig(template), design,
    template: { ...template, description: template.description || "", printSubject: template.printSubject || "", emailSubject: template.emailSubject || "",
      emailBody: template.emailBody || "", headerPresetId: template.headerPresetId || "", footerPresetId: template.footerPresetId || "",
      signatureBlockId: template.signatureBlockId || "", customLogoUrl: template.customLogoUrl || "" },
  };
}
