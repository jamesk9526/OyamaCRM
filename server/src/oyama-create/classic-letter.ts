import { LetterCategory, LetterTemplateStatus, Prisma, type CreateContent, type CreateVariant, type LetterTemplate } from "@prisma/client";
import type { Request } from "express";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { CreateError, documentFrom, object, renderShared, string, variantFrom } from "./domain.js";
import { demand } from "./access.js";
import { nativeRecord } from "./legacy.js";
import { CLASSIC_CRM_FIELDS, CLASSIC_PAPERS, type ClassicCrmBlock, type ClassicLetterAdvanced, type ClassicLetterDraft, type ClassicLetterResponse, type ClassicLetterSettings } from "./classic-letter-contract.js";
import { baselineBrand, brandForStudio } from "./studio/brand-service.js";
import { channelDesign, defaultDesign, normalizeDesign, sourceIdentity, walkNodes } from "./studio/design.js";
import { classicRegionHtml, exportHtmlDocument, importHtmlDocument, nodeHtml } from "./studio/html-document.js";
import { htmlToStudio, sanitizeStudioHtml } from "./studio/html.js";
import { hydrateSourceHtml } from "./studio/source-html.js";
import { assertAvailableSelections } from "./trash-selection.js";
import { assertStudioAssetOwnership } from "./studio/asset-ownership.js";
import { upgradeUnifiedDesign } from "./studio/unified-document.js";
import { newBlock } from "./studio/registry.js";
import type { StudioDesign } from "./studio/types.js";
import type { readClassicLetterhead } from "../routes/letters.js";

type ContentWithVariants = CreateContent & { variants: CreateVariant[] };
export type ClassicLetterhead = Awaited<ReturnType<typeof readClassicLetterhead>>;
type ClassicConfig = {
  version: 1;
  renderer: "classic" | "studio";
  letterhead: ClassicLetterhead;
  settings: ClassicLetterSettings;
  diagnostics: string[];
  reviewed: boolean;
  selections?: Pick<ClassicLetterDraft, "headerPresetId" | "footerPresetId" | "signatureBlockId" | "logoMode" | "customLogoUrl">;
};

export async function classicWorkingCopy(org: string, contentId: string, db: Prisma.TransactionClient = prisma) {
  const row = await db.letterTemplate.findFirst({ where: { organizationId: org, createContentId: contentId } });
  return row?.createContentId === contentId ? row : null;
}

export function classicConfig(template: LetterTemplate): ClassicConfig {
  return template.documentJson as unknown as ClassicConfig;
}

export async function classicEnabled(org: string) {
  return (await prisma.organizationSettings.findUnique({ where: { organizationId: org } }))?.oyamaCreateClassicLettersEnabled === true;
}

export async function usesClassicLetter(content: ContentWithVariants) {
  return content.variants.some(item => item.channel === "LETTER")
    && (!!await classicWorkingCopy(content.organizationId, content.id) || await classicEnabled(content.organizationId));
}

export async function loadClassicLetter(req: Request, content: ContentWithVariants) {
  const org = content.organizationId;
  const variant = content.variants.find(item => item.channel === "LETTER");
  if (!variant) throw new CreateError(404, "This content piece has no Letter format.");
  const existing = await classicWorkingCopy(org, content.id);
  if (existing) {
    const config = classicConfig(existing);
    return { existing, config, template: classicTemplate({ ...existing, ...config.selections }, content.name), design: content.designJson ? normalizeDesign(content.designJson) : null };
  }
  if (!await classicEnabled(org)) throw new CreateError(404, "The classic Letter pilot is off for this organization.");

  const source = await prisma.createImportSource.findFirst({ where: { organizationId: org, contentId: content.id, sourceType: "LETTER", sourceId: variant.legacyId || undefined } });
  const accepted = source?.acceptedFingerprint ? await prisma.createImportSourceRevision.findUnique({
    where: { sourceId_fingerprint: { sourceId: source.id, fingerprint: source.acceptedFingerprint } },
  }) : null;
  const snapshot = object(accepted?.snapshotJson);
  const binding = !accepted && variant.legacyId ? await nativeRecord(org, variant, prisma, true) : null;
  const original = accepted ? object(snapshot.record) : binding?.kind === "LETTER" ? object(binding.record) : {};
  const template = classicTemplate(original, content.name);
  const design = content.designJson ? normalizeDesign(content.designJson) : null;
  const useStudio = design && await hasEditedStudioLetter(content, design, accepted?.id, !!template.printBody.trim());
  if (!template.printBody && !useStudio) {
    template.printBody = sanitizeStudioHtml(renderShared(documentFrom(content.documentJson), variantFrom(variant.documentJson)).html, true);
  }
  const letterhead = snapshot.classicLetterhead ? snapshot.classicLetterhead as unknown as ClassicLetterhead :
    await (await import("../routes/letters.js")).readClassicLetterhead(org, template, snapshot.brand ? object(snapshot.brand).identity : undefined);
  const config = classicSourceEdit(content, original, letterhead).config;
  if (accepted && !snapshot.classicLetterhead) {
    config.reviewed = false;
    config.diagnostics.push("This older import predates the native letterhead snapshot. Compare its header, signer and recipient PDF with the original before approving.");
  }
  if (useStudio) {
    config.renderer = "studio"; config.reviewed = false;
    config.diagnostics.push("Compare the saved Studio layout with the classic canvas and its PDF before approving this letter.");
    const brand = await brandForStudio(org, design, "LETTER");
    const html = classicRegionHtml(design, brand, await hydrateSourceHtml(req, org, design));
    template.printBody = sanitizeStudioHtml(html.body, true);
    template.printLayoutJson = classicPageLayout(design.page, template.printLayoutJson);
    if (walkNodes(channelDesign(design, "LETTER").body).some(node => node.type === "studioLegacy")) {
      config.diagnostics.push("A preserved block needs manual review. Its source remains in Create history.");
    }
  }
  return { existing, config, template, design };
}

export function classicSourceEdit(content: CreateContent, original: unknown, letterhead: ClassicLetterhead) {
  const template = classicTemplate(original, content.name);
  const right = letterhead.presets.headerPreset;
  const config: ClassicConfig = {
    version: 1, renderer: "classic", letterhead, reviewed: true, diagnostics: [],
    selections: { headerPresetId: template.headerPresetId, footerPresetId: template.footerPresetId, signatureBlockId: template.signatureBlockId, logoMode: template.logoMode, customLogoUrl: template.customLogoUrl },
    settings: {
      headerMode: right?.rightColumnMode === "CUSTOM" ? "CUSTOM" : right?.rightColumnMode === "RECIPIENT" ? "RECIPIENT" : "ORGANIZATION",
      headerHtml: sanitizeStudioHtml(right?.rightColumnHtml || (right?.rightColumnMode === "CUSTOM" ? right?.customHtml || "" : "")),
      footerHtml: sanitizeStudioHtml(letterhead.presets.footerPreset?.customHtml || letterhead.branding.globalFooterHtml || ""),
    },
  };
  return { config, template, design: content.designJson ? normalizeDesign(content.designJson) : null };
}

function letterFootprint(design: StudioDesign) {
  const scoped = channelDesign(upgradeUnifiedDesign(design), "LETTER");
  return JSON.stringify({ ...scoped, channels: undefined, email: undefined, presentation: undefined, styles: { ...scoped.styles, emailFont: undefined } });
}

async function hasEditedStudioLetter(content: ContentWithVariants, design: StudioDesign, sourceRevisionId: string | undefined, hasNativeBody: boolean) {
  const scoped = channelDesign(design, "LETTER");
  if (!sourceRevisionId) return scoped.body.content.length > 0 || !!design.channels?.LETTER || Object.values(design.regions).some(region => region.mode === "custom") ||
    !!design.pack.replySlip.enabled || design.pack.outerEnvelope.enabled || design.pack.returnEnvelope.enabled;
  const revisions = await prisma.createDocumentRevision.findMany({
    where: { organizationId: content.organizationId, contentId: content.id }, orderBy: { revision: "asc" }, select: { documentJson: true },
  });
  for (const revision of revisions) {
    const saved = object(revision.documentJson).studio;
    if (!saved) continue;
    const initial = normalizeDesign(saved);
    if (channelDesign(initial, "LETTER").presentation?.sourceRevisionId === sourceRevisionId) {
      return !hasNativeBody || letterFootprint(initial) !== letterFootprint(design);
    }
  }
  return scoped.body.content.length > 0;
}

function classicTemplate(value: unknown, fallbackName: string): ClassicLetterDraft {
  const row = object(value);
  return {
    name: string(row.name) || fallbackName, description: string(row.description), category: string(row.category) || "GENERAL",
    status: row.status === "ACTIVE" || row.status === "ARCHIVED" ? row.status : "DRAFT",
    printSubject: string(row.printSubject), printBody: sanitizeStudioHtml(string(row.printBody), true), emailSubject: string(row.emailSubject),
    emailBody: sanitizeStudioHtml(string(row.emailBody), true), headerPresetId: string(row.headerPresetId),
    footerPresetId: string(row.footerPresetId), signatureBlockId: string(row.signatureBlockId),
    logoMode: string(row.logoMode) || "ORGANIZATION_DEFAULT", customLogoUrl: string(row.customLogoUrl), printLayoutJson: row.printLayoutJson ?? null,
  };
}

function classicPageLayout(page: StudioDesign["page"], previous: unknown) {
  return { ...object(previous), letterPdfLayout: { version: 1, pageSize: CLASSIC_PAPERS[page.paper], orientation: page.orientation, margins: page.margins } };
}

async function advancedLetter(req: Request, content: CreateContent, design: StudioDesign): Promise<ClassicLetterAdvanced> {
  const brand = await brandForStudio(content.organizationId, design, "LETTER");
  const { body: _body, ...html } = classicRegionHtml(design, brand, await hydrateSourceHtml(req, content.organizationId, design), true);
  const { content: _reply, ...replySlip } = design.pack.replySlip;
  const blocks = walkNodes(channelDesign(design, "LETTER").body).flatMap(node => {
    if (!Object.prototype.hasOwnProperty.call(CLASSIC_CRM_FIELDS, node.type)) return [];
    const type = node.type as ClassicCrmBlock["type"], id = string(node.attrs?.studioId);
    if (!id) return [];
    return [{ id, type, attrs: Object.fromEntries(CLASSIC_CRM_FIELDS[type].map(key => [key, node.attrs?.[key]])),
      ...(type === "studioCondition" ? { contentHtml: (node.content || []).map(child => nodeHtml(child, design.styles.primary)).join("") } : {}) }];
  });
  return {
    page: design.page, styles: design.styles, data: design.data, html,
    regions: {
      firstHeader: regionSettings(design.regions.firstHeader), header: regionSettings(design.regions.header),
      firstFooter: regionSettings(design.regions.firstFooter), footer: regionSettings(design.regions.footer),
    },
    pack: { ...design.pack, replySlip }, blocks,
  };
}

function regionSettings(region: StudioDesign["regions"]["header"]) {
  return { mode: region.mode, presetId: region.presetId };
}

export async function classicResponse(req: Request, content: CreateContent, campaignRevision: number, loaded: Awaited<ReturnType<typeof loadClassicLetter>>): Promise<ClassicLetterResponse> {
  const { template, config, existing, design } = loaded;
  const signer = config.letterhead.presets.signatureBlock;
  const advanced = config.renderer === "studio" && design ? await advancedLetter(req, content, design) : null;
  const signers = advanced && design ? (await brandForStudio(content.organizationId, design, "LETTER")).signers.filter(item => item.active && !item.trashed).map(item => ({ id: item.id, name: item.signerName })) : undefined;
  return {
    template, revision: content.revision, campaignRevision, letterRevision: existing?.revision ?? 0, renderer: config.renderer,
    settings: config.settings, advanced, signers,
    logoUrl: config.letterhead.logoSource, brandName: config.letterhead.branding.organizationName,
    signature: signer ? { name: signer.signerName, title: signer.signerTitle || "", imageUrl: signer.signatureImageUrl || "", closing: signer.closingPhrase || "" } : null,
    diagnostics: config.diagnostics, needsReview: !config.reviewed, saved: !!existing,
  };
}

export async function validateClassicEdit(req: Request, content: CreateContent, loaded: Awaited<ReturnType<typeof loadClassicLetter>>, raw: unknown) {
  const input = object(raw), draft = object(input.template), org = content.organizationId;
  if (typeof draft.printBody !== "string" || draft.printBody.length > 1_500_000 || !string(draft.name).trim() || string(draft.name).length > 191) {
    throw new CreateError(400, "Enter a letter name and body under the supported size limits.");
  }
  const template = classicTemplate({
    ...loaded.template, name: string(draft.name).trim(), description: draft.description, category: draft.category,
    printSubject: draft.printSubject, printBody: draft.printBody, signatureBlockId: draft.signatureBlockId ?? loaded.template.signatureBlockId,
    printLayoutJson: draft.printLayoutJson, status: "DRAFT",
  }, content.name);
  const categories = Object.values(LetterCategory) as string[];
  if (!categories.includes(template.category) || template.description.length > 10_000 || template.printSubject.length > 1000) throw new CreateError(400, "Choose a letter category and shorten the subject or description.");
  const config = structuredClone(loaded.config), settings = object(input.settings);
  const storedLayout = object(object(template.printLayoutJson).letterPdfLayout);
  if (Object.keys(storedLayout).length) {
    const storedMargins = object(storedLayout.margins);
    const margins = Object.fromEntries(["top", "right", "bottom", "left"].map(key => {
      const value = Number(storedMargins[key] ?? .25);
      if (!Number.isFinite(value) || value < .125 || value > 1.5) throw new CreateError(422, "Margins must be between 0.125 and 1.5 inches.");
      return [key, value];
    }));
    if (!(Object.values(CLASSIC_PAPERS) as string[]).includes(string(storedLayout.pageSize))) throw new CreateError(422, "Choose a supported paper size.");
    template.printLayoutJson = { ...object(loaded.template.printLayoutJson), letterPdfLayout: { version: 1, pageSize: storedLayout.pageSize, orientation: storedLayout.orientation === "landscape" ? "landscape" : "portrait", margins } };
  } else template.printLayoutJson = loaded.template.printLayoutJson;
  if (Object.keys(settings).length) {
    if (!["ORGANIZATION", "RECIPIENT", "CUSTOM"].includes(string(settings.headerMode)) || [settings.headerHtml, settings.footerHtml].some(html => typeof html !== "string" || html.length > 20_000)) {
      throw new CreateError(400, "Choose valid letterhead settings.");
    }
    const gifts = Object.entries(object(settings.giftSelections));
    if (gifts.length > 500 || gifts.some(([recipient, gift]) => !/^[a-z0-9_-]{1,191}$/i.test(recipient) || typeof gift !== "string" || !/^[a-z0-9_-]{1,191}$/i.test(gift))) throw new CreateError(400, "Choose a valid gift for each Letter recipient.");
    if (JSON.stringify(settings.giftSelections || {}) !== JSON.stringify(config.settings.giftSelections || {})) await demand(req, "letters.view_sensitive_merge_data");
    config.settings = { headerMode: settings.headerMode as ClassicLetterSettings["headerMode"], headerHtml: sanitizeStudioHtml(string(settings.headerHtml)), footerHtml: sanitizeStudioHtml(string(settings.footerHtml)),
      ...(gifts.length ? { giftSelections: Object.fromEntries(gifts) as Record<string, string> } : {}) };
  }
  if (template.signatureBlockId !== loaded.template.signatureBlockId) {
    const signature = await prisma.letterSignatureBlock.findFirst({ where: { organizationId: org, isActive: true, ...(template.signatureBlockId ? { id: template.signatureBlockId } : { isDefault: true }) } });
    if (template.signatureBlockId && !signature) throw new CreateError(422, "Select an active signer from this organization.");
    config.letterhead.presets.signatureBlock = signature;
    if (config.selections) config.selections.signatureBlockId = template.signatureBlockId;
  }
  assertStudioAssetOwnership(org, { bodyHtml: template.printBody, ...config.settings, signatureImageUrl: config.letterhead.presets.signatureBlock?.signatureImageUrl });
  if (template.printBody !== draft.printBody && /<script\b|\son\w+\s*=|javascript:|<iframe\b/i.test(draft.printBody)) {
    config.diagnostics = [...new Set([...config.diagnostics, "Unsafe markup was removed from the letter. Compare the saved content before approving."])];
    config.reviewed = false;
  }
  let design = loaded.design;
  if (config.renderer === "classic" && input.enableAdvanced === true) {
    const expanded = structuredClone(design || defaultDesign());
    expanded.brandRevisionId ||= await baselineBrand(org, req.user!.sub);
    const layout = object(object(template.printLayoutJson).letterPdfLayout), margins = object(layout.margins);
    const paper = (Object.keys(CLASSIC_PAPERS) as Array<keyof typeof CLASSIC_PAPERS>).find(key => CLASSIC_PAPERS[key] === layout.pageSize) || "LETTER";
    expanded.page = { ...expanded.page, paper, orientation: layout.orientation === "landscape" ? "landscape" : "portrait",
      margins: { top: Number(margins.top || .25), bottom: Number(margins.bottom || .25), left: Number(margins.left || .25), right: Number(margins.right || .25) } };
    const converted = htmlToStudio(template.printBody, "classic-body");
    expanded.channels = { ...expanded.channels, LETTER: { document: converted.document, reviewedSource: sourceIdentity(expanded) } };
    design = normalizeDesign(expanded);
    config.renderer = "studio"; config.reviewed = false;
    config.diagnostics = [...converted.diagnostics, "Advanced print layout is active. Review the recipient PDF with the selected margins and letterhead."];
    const brand = await brandForStudio(org, design, "LETTER");
    template.printBody = sanitizeStudioHtml(classicRegionHtml(design, brand).body, true);
    template.printLayoutJson = classicPageLayout(design.page, template.printLayoutJson);
  } else if (config.renderer === "studio" && design) {
    const adjusted = await updateStudioLetter(req, content, design, template, input.advanced);
    design = adjusted.design;
    template.printLayoutJson = classicPageLayout(design.page, template.printLayoutJson);
    config.diagnostics = [...new Set([...config.diagnostics, ...adjusted.diagnostics])];
    if (adjusted.diagnostics.length) config.reviewed = false;
  }
  if (input.confirmComparison === true && input.enableAdvanced !== true) {
    config.reviewed = true;
    if (config.renderer === "studio" && design) {
      const documents = [design.channels?.LETTER?.document || design.body, ...Object.values(design.regions).filter(region => region.mode === "custom").map(region => region.content)];
      if (design.pack.replySlip.enabled) documents.push(design.pack.replySlip.content);
      for (const node of documents.flatMap(walkNodes)) {
        if (node.type === "studioHtml" && node.attrs && (node.attrs.sourceRevisionId || node.attrs.html)) {
          node.attrs.reviewedHtml = node.attrs.sourceRevisionId || node.attrs.html;
        }
      }
    }
  }
  return { template, config, design };
}

async function updateStudioLetter(req: Request, content: CreateContent, before: StudioDesign, draft: ClassicLetterDraft, raw: unknown) {
  const org = content.organizationId, changes = object(raw);
  const design = structuredClone(before);
  design.channels = { ...design.channels, LETTER: design.channels?.LETTER || { document: structuredClone(design.body), reviewedSource: null } };
  const body = design.channels.LETTER!.document;
  if (Array.isArray(changes.blocks)) {
    if (changes.blocks.length > 100) throw new CreateError(400, "Edit up to 100 configured CRM blocks at a time.");
    const byId = new Map(walkNodes(body).map(node => [string(node.attrs?.studioId), node]));
    for (const rawBlock of changes.blocks) {
      const block = object(rawBlock), id = string(block.id), type = string(block.type) as ClassicCrmBlock["type"];
      if (!/^[a-z0-9:_-]{1,100}$/i.test(id) || !Object.prototype.hasOwnProperty.call(CLASSIC_CRM_FIELDS, type)) throw new CreateError(400, "Choose a supported CRM block.");
      let node = byId.get(id);
      if (!node) { node = newBlock(type, id); body.content.push(node); byId.set(id, node); }
      if (node.type !== type) throw new CreateError(400, "A configured block must retain its type.");
      const attrs = object(block.attrs);
      node.attrs = { ...node.attrs, ...Object.fromEntries(CLASSIC_CRM_FIELDS[type].filter(key => Object.prototype.hasOwnProperty.call(attrs, key)).map(key => [key, attrs[key]])) };
      if (type === "studioCondition" && typeof block.contentHtml === "string" && block.contentHtml !== (node.content || []).map(child => nodeHtml(child, design.styles.primary)).join("")) {
        node.content = htmlToStudio(block.contentHtml, `condition-${id.slice(0, 50)}`).document.content;
      }
    }
  }
  const hydrated = await hydrateSourceHtml(req, org, design), brand = await brandForStudio(org, design, "LETTER");
  const submitted = object(changes.html);
  let html = exportHtmlDocument(design, brand, "LETTER", hydrated);
  html = html.replace(/<(main|div) data-oyama-region="([^"]+)">\n([\s\S]*?)\n<\/\1>(?=\n\n|\n<\/body>)/g, (section, tag: string, key: string) => {
    const value = key === "body" ? draft.printBody || "<p></p>" : submitted[key];
    return typeof value === "string" ? `<${tag} data-oyama-region="${key}">\n${sanitizeStudioHtml(value, true)}\n</${tag}>` : section;
  });
  // A disabled slip has no HTML region in the baseline document.
  if (!design.pack.replySlip.enabled && string(submitted.replySlip).trim()) {
    html = html.replace("</body>", `<div data-oyama-region="replySlip">\n${sanitizeStudioHtml(string(submitted.replySlip), true)}\n</div>\n</body>`);
  }
  const converted = importHtmlDocument(design, brand, html, "LETTER", hydrated), next = converted.design;
  if (Object.keys(changes).length) {
    const pack = object(changes.pack), reply = object(pack.replySlip), regions = object(changes.regions);
    next.page = { ...next.page, ...object(changes.page) };
    next.styles = { ...next.styles, ...object(changes.styles) };
    next.data = { ...next.data, ...object(changes.data) };
    next.pack = { ...next.pack, ...pack, replySlip: { ...next.pack.replySlip, enabled: reply.enabled === true, placement: reply.placement === "separate" ? "separate" : "attached" } };
    for (const key of ["firstHeader", "header", "firstFooter", "footer"] as const) {
      const region = object(regions[key]), mode = string(region.mode);
      if (mode === "brand" || mode === "custom" || mode === "none") next.regions[key] = { ...next.regions[key], mode, presetId: string(region.presetId) };
    }
  }
  const normalized = normalizeDesign(next);
  normalized.channels!.LETTER!.reviewedSource = sourceIdentity(normalized);
  assertStudioAssetOwnership(org, normalized);
  await assertAvailableSelections(org, normalized, content.designJson);
  return { design: normalized, diagnostics: converted.diagnostics };
}

export async function persistClassicLetter(tx: Prisma.TransactionClient, content: CreateContent, actor: string, edit: Awaited<ReturnType<typeof validateClassicEdit>>, existing: LetterTemplate | null) {
  const { config, template, design } = edit;
  const organizationId = content.organizationId;
  const nullable = (value: string) => value || null;
  const data = {
    name: template.name, description: nullable(template.description), category: template.category as LetterCategory, status: LetterTemplateStatus.DRAFT,
    printSubject: nullable(template.printSubject), printBody: template.printBody, emailSubject: nullable(template.emailSubject), emailBody: nullable(template.emailBody),
    printLayoutJson: json(template.printLayoutJson ?? {}), documentJson: json(config),
    updatedByUserId: actor,
  };
  if (existing) {
    const changed = await tx.letterTemplate.updateMany({ where: { organizationId, createContentId: content.id, revision: existing.revision }, data: { ...data, revision: { increment: 1 } } });
    if (changed.count !== 1) throw new CreateError(409, "The letter changed in another session. Your local edits are retained.");
  } else {
    await tx.letterTemplate.create({ data: { ...data, organizationId, createContentId: content.id, createdByUserId: actor, revision: 1 } });
  }
  const saved = await tx.createContent.updateMany({
    where: { id: content.id, organizationId, revision: content.revision },
    data: { name: template.name, revision: { increment: 1 }, ...(design ? { designJson: json(design) } : {}) },
  });
  if (saved.count !== 1) throw new CreateError(409, "This content changed in another session. Your local edits are retained.");
  await tx.createDocumentRevision.create({ data: {
    contentId: content.id, organizationId, revision: content.revision + 1, createdBy: actor,
    documentJson: json({ shared: content.documentJson, studio: design, classicLetter: { template, config } }),
  } });
  return (await classicWorkingCopy(organizationId, content.id, tx))!;
}

export function classicInitialDesign(content: CreateContent): StudioDesign {
  return content.designJson ? normalizeDesign(content.designJson) : defaultDesign();
}

export async function classicStudioEdit(req: Request, content: CreateContent, working: LetterTemplate, design: StudioDesign, diagnostics: string[]) {
  const config = structuredClone(classicConfig(working));
  config.renderer = "studio"; config.reviewed = false;
  config.diagnostics = [...new Set([...diagnostics, "Review this updated Letter and its recipient PDF before approving."])];
  const brand = await brandForStudio(content.organizationId, design, "LETTER");
  const html = classicRegionHtml(design, brand, await hydrateSourceHtml(req, content.organizationId, design));
  const template = classicTemplate({ ...working, ...config.selections, printBody: html.body, printLayoutJson: classicPageLayout(design.page, working.printLayoutJson) }, content.name);
  return { config, template, design };
}
