import { trashedIds } from "../trash-state.js";
import { parseSiteEmbedsConfig, SITE_EMBEDS_PLUGIN_KEY } from "../../services/site-embeds.js";
import { widgetBrandValues } from "./widget-brand.js";
import { defaultDesign } from "./design.js";
import { renderStudio, emptyDonor } from "./render.js";
import { createHash } from "node:crypto";
import { prisma } from "../../lib/prisma.js";
import { json } from "../../services/letter-production.js";
import { authoredLetterChromeHtml } from "../../services/letter-production-renderer.js";
import type { LetterSnapshot } from "../../services/letter-production-contract.js";
import { CreateError, object, string } from "../domain.js";
import { normalizeBrand, legacyBrandProjection, profileIdentity } from "./brand.js";
import { sanitizeStudioHtml } from "./html.js";
import { EMPTY_DOC, type BrandDocument } from "./types.js";
export const brandReviewToken = (org: string, revision: number, publishedId: string | null, document: unknown) => createHash("sha256").update(JSON.stringify([org, revision, publishedId, document])).digest("hex");

function legacyChrome(html:string){return html.replace(/padding:0 [0-9.]+in 0 [0-9.]+in/,"padding:0").replace(/class="pageNumber"/g,"data-studio-page-number").replace(/class="totalPages"/g,"data-studio-total-pages");}
export async function readLegacyBrand(org: string, selected?: { headerId?: string | null; footerId?: string | null; signerId?: string | null }): Promise<BrandDocument> {
  const [stored, organization, headers, footers, signers, embeds, moneySettings] = await Promise.all([
    prisma.pluginSetting.findUnique({ where: { organizationId_pluginKey: { organizationId: org, pluginKey: "organization-branding" } } }),
    prisma.organization.findUnique({ where: { id: org }, select: { name: true } }),
    prisma.letterHeaderPreset.findMany({ where: { organizationId: org, ...(selected ? { OR: [{ isDefault: true }, ...(selected.headerId ? [{ id: selected.headerId }] : [])] } : {}) }, take: 100 }),
    prisma.letterFooterPreset.findMany({ where: { organizationId: org, ...(selected ? { OR: [{ isDefault: true }, ...(selected.footerId ? [{ id: selected.footerId }] : [])] } : {}) }, take: 100 }),
    prisma.letterSignatureBlock.findMany({ where: { organizationId: org, ...(selected ? { OR: [{ isDefault: true }, ...(selected.signerId ? [{ id: selected.signerId }] : [])] } : {}) }, take: 200 }),
    prisma.pluginSetting.findUnique({where:{organizationId_pluginKey:{organizationId:org,pluginKey:SITE_EMBEDS_PLUGIN_KEY}}}),
    prisma.organizationSettings.findUnique({where:{organizationId:org},select:{currency:true}}),
  ]);
  const identity = { ...object(stored?.config) }; identity.organizationDisplayName ||= organization?.name || ""; identity.currency ||= moneySettings?.currency||"USD";
  const activeSigner = signers.find(signer => signer.id === selected?.signerId && signer.isActive) || signers.find(signer => signer.id === identity.defaultLetterSignatureBlockId && signer.isActive) || signers.find(signer => signer.isDefault && signer.isActive);
  const parsedSigners: unknown[] = signers.map(signer => ({ ...signer, active: signer.isActive }));
  if (!activeSigner && identity.defaultLetterSignerName) parsedSigners.push({ id: `legacy-${org}`, name: "Organization signer", signerName: string(identity.defaultLetterSignerName), signerTitle: string(identity.defaultLetterSignerTitle), closingPhrase: string(identity.defaultLetterClosingPhrase), signatureImageUrl: string(identity.defaultLetterSignatureImageUrl), typedSignature: string(identity.defaultLetterTypedSignature), email: string(identity.defaultLetterSignerEmail), phone: string(identity.defaultLetterSignerPhone), active: true });
  const branding = { organizationName: identity.organizationDisplayName, ...identity };
  const assets = Object.fromEntries([identity.logoUrl, identity.logoSquareUrl].filter(value => typeof value === "string" && value).map(value => [String(value), String(value)]));
  const snapshot: Pick<LetterSnapshot, "branding" | "assets" | "layout" | "header" | "footer"> = { branding, assets, layout: { paper: "Letter", margins: { top: .8, right: .75, bottom: .8, left: .75 } }, header: {}, footer: {} };
  const presets = [...headers.map(header => ({ id: header.id, name: header.name, kind: "header", content: EMPTY_DOC(), legacyHtml: legacyChrome(authoredLetterChromeHtml({ ...snapshot, header }, false)), active: header.isActive, isDefault: header.isDefault })), ...footers.map(footer => ({ id: footer.id, name: footer.name, kind: "footer", content: EMPTY_DOC(), legacyHtml: legacyChrome(authoredLetterChromeHtml({ ...snapshot, footer }, true)), active: footer.isActive, isDefault: footer.isDefault }))];
  return normalizeBrand({ version: 1, identity, signers: parsedSigners, presets, profiles: embeds ? parseSiteEmbedsConfig(embeds.config).sites.flatMap(site => (["WIDGET", "GIVING"] as const).map(channel => ({id:`legacy-${channel.toLowerCase()}-${site.id}`,name:`${site.name} ${channel.toLowerCase()}`,channel,resourceId:site.id,values:widgetBrandValues(site)}))) : [], defaultSignerId: activeSigner?.id || (identity.defaultLetterSignerName ? `legacy-${org}` : null) });
}
export async function readBrand(org: string) {
  const [draft, published, settings] = await Promise.all([
    prisma.createBrandDraft.findUnique({ where: { organizationId: org } }),
    prisma.createBrandRevision.findFirst({ where: { organizationId: org }, orderBy: { revision: "desc" } }),
    prisma.organizationSettings.findUnique({ where: { organizationId: org } }),
  ]);
  const baseline = published ? normalizeBrand(published.documentJson) : await readLegacyBrand(org);
  return { draftRevision: draft?.revision || 0, document: await brandAvailability(org, draft ? normalizeBrand(draft.documentJson) : baseline), published: published ? { id: published.id, revision: published.revision, publishedAt: published.publishedAt, document: baseline } : null, studioEnabled: settings?.oyamaCreateStudioEnabled === true, brandHubEnabled: settings?.oyamaCreateBrandHubEnabled === true };
}
export async function brandForDesign(org: string, revisionId: string | null): Promise<BrandDocument> {
  if (!revisionId) return brandAvailability(org, await readLegacyBrand(org));
  const revision = await prisma.createBrandRevision.findFirst({ where: { id: revisionId, organizationId: org } });
  if (!revision) throw new CreateError(404, "This brand revision is unavailable in your organization.");
  return brandAvailability(org, normalizeBrand(revision.documentJson));
}
export async function publicBrandIdentity(org: string, channel: "WEB" | "GIVING" | "EVENT" | "WIDGET", resourceId: string) {
  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId: org } });
  if (!settings?.createBrandPublicBaselineId) return null;
  const binding = await prisma.createBrandBinding.findUnique({ where: { organizationId_channel_resourceId: { organizationId: org, channel, resourceId } } });
  return profileIdentity(await brandForDesign(org, binding?.brandRevisionId || settings.createBrandPublicBaselineId), channel, resourceId);
}
export async function publishBrand(org: string, actor: string, input: { draftRevision: number; publishedId: string | null; reviewToken: string; confirm: boolean }) {
  const current = await readBrand(org);
  if (!input.confirm || input.draftRevision !== current.draftRevision || input.publishedId !== (current.published?.id || null) || input.reviewToken !== brandReviewToken(org, current.draftRevision, current.published?.id || null, current.document)) throw new CreateError(409, "The brand draft changed. Preview its impact again before publishing.");
  const baseline = current.published ? null : await readLegacyBrand(org);
  const document = normalizeBrand(current.document);
  const published = await prisma.$transaction(async tx => {
    const claimed = await tx.createBrandDraft.updateMany({ where: { organizationId: org, revision: input.draftRevision }, data: { revision: { increment: 1 }, updatedBy: actor } });
    if (!claimed.count) throw new CreateError(409, "The brand draft changed in another session.");
    let baselineId = current.published?.id;
    if (baseline) baselineId = (await tx.createBrandRevision.create({ data: { organizationId: org, revision: 1, documentJson: json(baseline), publishedBy: actor } })).id;
    const revision = await tx.createBrandRevision.create({ data: { organizationId: org, revision: (current.published?.revision || 1) + 1, documentJson: json(document), publishedBy: actor } });
    const setting = await tx.organizationSettings.findUnique({ where: { organizationId: org } });
    await tx.organizationSettings.upsert({ where: { organizationId: org }, create: { organizationId: org, createBrandPublicBaselineId: baselineId }, update: { createBrandPublicBaselineId: setting?.createBrandPublicBaselineId || baselineId } });
    const legacy = await tx.pluginSetting.findUnique({ where: { organizationId_pluginKey: { organizationId: org, pluginKey: "organization-branding" } } });
    const config = json({ ...object(legacy?.config), ...legacyBrandProjection(document), createBrandRevisionId: revision.id });
    await tx.pluginSetting.upsert({ where: { organizationId_pluginKey: { organizationId: org, pluginKey: "organization-branding" } }, create: { organizationId: org, pluginKey: "organization-branding", enabled: true, config }, update: { config } });
    for (const kind of ["header", "footer"] as const) {
      if(kind==="header")await tx.letterHeaderPreset.updateMany({where:{organizationId:org,isDefault:true},data:{isDefault:false}});
      else await tx.letterFooterPreset.updateMany({where:{organizationId:org,isDefault:true},data:{isDefault:false}});
      for (const preset of document.presets.filter(item=>item.kind===kind)) {
        const existing=kind==="header"?await tx.letterHeaderPreset.findUnique({where:{id:preset.id}}):await tx.letterFooterPreset.findUnique({where:{id:preset.id}});
        if(existing&&existing.organizationId!==org)throw new CreateError(403,"A branding preset belongs to another organization.");
        const design=defaultDesign();design.body=preset.content;
        const customHtml=preset.legacyHtml||renderStudio(design,emptyDonor(),document).html;
        const values={name:preset.name,customHtml,isActive:preset.active,isDefault:preset.active&&preset.isDefault};
        if(kind==="header")await tx.letterHeaderPreset.upsert({where:{id:preset.id},create:{...values,id:preset.id,organizationId:org},update:values});
        else await tx.letterFooterPreset.upsert({where:{id:preset.id},create:{...values,id:preset.id,organizationId:org},update:values});
      }
    }
    await tx.letterSignatureBlock.updateMany({ where: { organizationId: org, isDefault: true }, data: { isDefault: false } });
    for (const signer of document.signers) {
      const { active, id, ...values } = signer;
      const prior = await tx.letterSignatureBlock.findFirst({ where: { id, organizationId: org } });
      if (!prior && await tx.letterSignatureBlock.findUnique({ where: { id } })) throw new CreateError(403, "A signature belongs to another organization.");
      const data = { ...values, isActive: active, isDefault: id === document.defaultSignerId };
      await tx.letterSignatureBlock.upsert({ where: { id }, create: { ...data, id, organizationId: org }, update: data });
    }
    await tx.auditLog.create({ data: { organizationId: org, userId: actor, action: "CREATE_BRAND_PUBLISHED", entity: "CreateBrandRevision", entityId: revision.id, metadata: { revision: revision.revision } } });
    return revision;
  });
  return { id: published.id, revision: published.revision, draftRevision: current.draftRevision + 1 };
}
export function sanitizeBrandHtml(brand: BrandDocument): BrandDocument {
  const result = structuredClone(brand);
  // Draft branding still references uploaded files. Only final print HTML requires frozen data URLs.
  for (const key of ["globalHeaderHtml", "globalFooterHtml"]) if (result.identity[key]) result.identity[key] = sanitizeStudioHtml(String(result.identity[key]));
  for (const preset of result.presets) if (preset.legacyHtml) preset.legacyHtml = sanitizeStudioHtml(preset.legacyHtml);
  for (const profile of result.profiles) for (const key of ["globalHeaderHtml", "globalFooterHtml"]) if (profile.values[key]) profile.values[key] = sanitizeStudioHtml(String(profile.values[key]));
  return result;
}

async function brandAvailability(org: string, document: BrandDocument): Promise<BrandDocument> {
  const [signers, presets] = await Promise.all([trashedIds(org, "SIGNATURE"), trashedIds(org, "PRESET")]);
  return { ...document, signers: document.signers.map(signer => ({ ...signer, trashed: signers.includes(signer.id) })), presets: document.presets.map(preset => ({ ...preset, trashed: presets.includes(preset.id) })) };
}

export async function brandForStudio(org: string, design: import("./types.js").StudioDesign, channel?: "LETTER"|"EMAIL"|"WEB"|"SOCIAL"|"SMS"): Promise<BrandDocument> {
  if(design.brandRevisionId)return brandForDesign(org,design.brandRevisionId);
  const revisionId = channel && design.channels?.[channel]?.sourceRevisionId || design.presentation?.sourceRevisionId;
  if (revisionId) {
    const revision = await prisma.createImportSourceRevision.findFirst({ where: { id: revisionId, source: { organizationId: org } } });
    if (!revision) throw new CreateError(404, "The imported source snapshot is unavailable in this organization.");
    const snapshot = object(revision.snapshotJson);
    if (snapshot.brand) return normalizeBrand(snapshot.brand);
  }
  return brandForDesign(org, design.brandRevisionId);
}


export async function baselineBrand(org: string, actor: string) {
  const existing = await prisma.createBrandRevision.findFirst({ where: { organizationId: org }, orderBy: { revision: "desc" } }); if (existing) return existing.id;
  const document = await readLegacyBrand(org);
  try { return (await prisma.createBrandRevision.create({ data: { organizationId: org, revision: 1, documentJson: json(document), publishedBy: actor } })).id; }
  catch { const concurrent = await prisma.createBrandRevision.findFirst({ where: { organizationId: org }, orderBy: { revision: "desc" } }); if (!concurrent) throw new CreateError(409, "The initial brand could not be preserved. Try again."); return concurrent.id; }
}
