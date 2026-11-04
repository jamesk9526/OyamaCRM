import { Router, type Request } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { assertCampaign, can, demand, demandChannels } from "./access.js";
import { CreateError, string, type Channel } from "./domain.js";
import { route, param } from "./http.js";
import { readBrand } from "./studio/brand-service.js";
import { json } from "../services/letter-production.js";
import { normalizePublicMediaUrl } from "../lib/public-media.js";

const router = Router();
const kinds = ["CAMPAIGN", "ASSET", "SECTION", "SIGNATURE", "PRESET"] as const;
type Kind = typeof kinds[number];
const pending = ["HELD", "PENDING", "PAUSED", "PREPARING", "CLAIMED", "SENDING", "UNKNOWN", "RECONCILE", "RECONCILING"];
function kindOf(value: unknown): Kind {
  if (!kinds.includes(value as Kind)) throw new CreateError(400, "Choose a supported campaign or library item.");
  return value as Kind;
}
async function authorizeView(req: Request) {
  if (!await can(req, "letters.view") && !await can(req, "view:communications")) throw new CreateError(403, "Communications access is required.");
}
async function target(req: Request, kind: Kind, id: string) {
  const org = req.user!.orgId;
  if (kind === "CAMPAIGN") {
    const campaign = await assertCampaign(req, id, true, prisma, true);
    await demandChannels(req, campaign.channelsJson as Channel[], true);
    if (campaign.fundraisingCampaignId) await demand(req, "edit:campaigns");
    return { name: campaign.name, sourceRevision: String(campaign.revision), campaign, brand: null };
  }
  if (kind === "ASSET") {
    const asset = await prisma.createStudioAsset.findFirst({ where: { id, organizationId: org } });
    if (!asset) throw new CreateError(404, "Library image not found.");
    if (asset.kind === "SIGNATURE") await demand(req, "letters.manage_signatures");
    else if (!await can(req, "letters.edit") && !await can(req, "edit:communications") && !await can(req, "create.brand.publish")) throw new CreateError(403, "Asset editing permission is required.");
    const brand = await readBrand(org);
    return { name: asset.name, sourceRevision: `${asset.checksum}:${brand.draftRevision}:${brand.published?.id || "legacy"}`, asset, campaign: null, brand };
  }
  if (kind === "SECTION") {
    if (!await can(req, "letters.edit") && !await can(req, "edit:communications")) throw new CreateError(403, "Editing permission is required.");
    const section = await prisma.createStudioSection.findFirst({ where: { id, organizationId: org } });
    if (!section) throw new CreateError(404, "Saved section not found.");
    if (section.ownerId !== req.user!.sub && req.user!.role !== "admin") throw new CreateError(403, "Only the owner or an administrator can remove or restore this section.");
    return { name: section.name, sourceRevision: section.updatedAt.toISOString(), campaign: null, brand: null };
  }
  await demand(req, kind === "SIGNATURE" ? "letters.manage_signatures" : "letters.manage_branding");
  const brand = await readBrand(org);
  const item = kind === "SIGNATURE" ? brand.document.signers.find(item => item.id === id) : brand.document.presets.find(item => item.id === id);
  if (!item) throw new CreateError(404, "Brand library item not found.");
  return { name: item.name, sourceRevision: `${brand.draftRevision}:${brand.published?.id || "legacy"}`, campaign: null, brand };
}
async function review(req: Request, kind: Kind, id: string) {
  const item = await target(req, kind, id);
  const org = req.user!.orgId;
  const state = await prisma.createTrashItem.findUnique({ where: { organizationId_kind_resourceId: { organizationId: org, kind, resourceId: id } } });
  const pendingCount = item.campaign ? await prisma.createDelivery.count({ where: { organizationId: org, release: { campaignId: id }, status: { in: pending } } }) : 0;
  const currentBrand = item.brand;
  const activeDefault = currentBrand && (kind === "SIGNATURE"
    ? [currentBrand.document.defaultSignerId, currentBrand.published?.document.defaultSignerId].includes(id)
    : [currentBrand.document, currentBrand.published?.document].some(document => document?.presets.some(preset => preset.id === id && preset.active && preset.isDefault)));
  let isDefault = !!activeDefault;
  if (kind === "ASSET" && "asset" in item && item.asset) {
    const brand = await readBrand(org);
    const source = normalizePublicMediaUrl(item.asset.url);
    isDefault = [brand.document, brand.published?.document].some(document => document && [document.identity.logoUrl, document.identity.logoSquareUrl, document.signers.find(signer => signer.id === document.defaultSignerId)?.signatureImageUrl].some(value => typeof value === "string" && value && normalizePublicMediaUrl(value) === source));
  }
  const references = kind === "CAMPAIGN" ? [] : await prisma.createContent.findMany({ where: { organizationId: org }, select: { id: true, campaignId: true, name: true, designJson: true, documentJson: true }, take: 501 });
  const searchValue = kind === "ASSET" && "asset" in item && item.asset ? normalizePublicMediaUrl(item.asset.url) : id;
  const usedBy: Array<{ id: string; name: string }> = [];
  for (const content of references) {
    const serialized = JSON.stringify([content.designJson, content.documentJson]);
    if (!serialized.includes(id) && !serialized.includes(searchValue) && !(kind === "ASSET" && "asset" in item && item.asset && serialized.includes(item.asset.url))) continue;
    try { await assertCampaign(req, content.campaignId); usedBy.push({ id: content.id, name: content.name }); }
    catch (error) { if (!(error instanceof CreateError && [403, 404].includes(error.status))) throw error; }
  }
  const token = createHash("sha256").update(JSON.stringify([kind, id, item.sourceRevision, state?.revision || 0])).digest("hex");
  return { kind, resourceId: id, name: item.name, reviewToken: token, trashed: !!state && !state.restoredAt, revision: state?.revision || 0, pendingDeliveries: pendingCount, activeDefault: isDefault, usedBy: usedBy.slice(0, 100), usageMayBeIncomplete: references.length > 500, item, state };
}
router.get("/trash/preview", route(async (req, res) => {
  const { item: _item, state: _state, ...result } = await review(req, kindOf(req.query.kind), string(req.query.id));
  void _item; void _state;
  res.json(result);
}));
router.get("/library/items", route(async (req, res, org, actor) => {
  await authorizeView(req);
  const [removed, assets, sections, brand] = await Promise.all([
    prisma.createTrashItem.findMany({ where: { organizationId: org, restoredAt: null } }),
    prisma.createStudioAsset.findMany({ where: { organizationId: org }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.createStudioSection.findMany({ where: { organizationId: org, OR: [{ ownerId: actor }, { shared: true }] }, orderBy: { updatedAt: "desc" }, take: 200 }),
    readBrand(org),
  ]);
  const items = [
    ...assets.map(item => ({ id: item.id, name: item.name, kind: "ASSET" as Kind, url: normalizePublicMediaUrl(item.url) })),
    ...sections.map(item => ({ id: item.id, name: item.name, kind: "SECTION" as Kind })),
    ...brand.document.signers.map(item => ({ id: item.id, name: item.name, kind: "SIGNATURE" as Kind })),
    ...brand.document.presets.map(item => ({ id: item.id, name: item.name, kind: "PRESET" as Kind })),
  ].filter(item => !removed.some(row => row.kind === item.kind && row.resourceId === item.id));
  res.json(await Promise.all(items.map(async item => {
    let canTrash = true;
    try { await target(req, item.kind, item.id); }
    catch (error) { if (error instanceof CreateError && error.status === 403) canTrash = false; else throw error; }
    return { ...item, canTrash };
  })));
}));
router.post("/trash", route(async (req, res, org, actor) => {
  const kind = kindOf(req.body.kind), id = string(req.body.resourceId);
  const checked = await review(req, kind, id);
  if (req.body.confirm !== true || req.body.reviewToken !== checked.reviewToken) throw new CreateError(409, "Review the current item before moving it to Trash.");
  if (checked.trashed) throw new CreateError(409, "This item is already in Trash.");
  if (checked.pendingDeliveries) throw new CreateError(409, "Review and cancel pending deliveries before moving this campaign to Trash.");
  if (checked.activeDefault) throw new CreateError(409, "Choose and publish a replacement for this active default before moving it to Trash.");
  const result = await prisma.$transaction(async tx => {
    if (checked.item.campaign) {
      const locked = await tx.createCampaign.updateMany({ where: { id, organizationId: org, revision: checked.item.campaign.revision }, data: { revision: { increment: 1 } } });
      if (!locked.count) throw new CreateError(409, "The campaign changed. Review it again.");
      if (await tx.createDelivery.count({ where: { organizationId: org, release: { campaignId: id }, status: { in: pending } } })) throw new CreateError(409, "Cancel pending deliveries before moving this campaign to Trash.");
    }
    if (checked.item.brand) {
      const brand = checked.item.brand;
      if (!brand.draftRevision) await tx.createBrandDraft.create({ data: { organizationId: org, documentJson: json(brand.document), updatedBy: actor } });
      else {
        const locked = await tx.createBrandDraft.updateMany({ where: { organizationId: org, revision: brand.draftRevision }, data: { revision: { increment: 1 }, updatedBy: actor } });
        if (!locked.count) throw new CreateError(409, "The brand draft changed. Review it again.");
      }
    }
    const data = { name: checked.name, removedAt: new Date(), removedBy: actor, restoredAt: null };
    let entry;
    if (checked.state) {
      const changed = await tx.createTrashItem.updateMany({ where: { id: checked.state.id, revision: checked.state.revision }, data: { ...data, revision: { increment: 1 } } });
      if (!changed.count) throw new CreateError(409, "This item changed in another session. Review it again.");
      entry = await tx.createTrashItem.findUniqueOrThrow({ where: { id: checked.state.id } });
    } else entry = await tx.createTrashItem.create({ data: { organizationId: org, kind, resourceId: id, ...data } });
    await tx.auditLog.create({ data: { organizationId: org, userId: actor, action: "CREATE_ITEM_TRASHED", entity: "CreateTrashItem", entityId: entry.id, metadata: { kind, resourceId: id } } });
    return entry;
  });
  res.status(201).json(result);
}));
router.get("/trash", route(async (req, res, org) => {
  await authorizeView(req);
  const kind = req.query.kind ? kindOf(req.query.kind) : undefined;
  const rows = await prisma.createTrashItem.findMany({ where: { organizationId: org, restoredAt: null, ...(kind ? { kind } : {}) }, orderBy: { removedAt: "desc" }, take: 501 });
  const items = [];
  for (const row of rows) {
    try { await target(req, kindOf(row.kind), row.resourceId); items.push(row); }
    catch (error) { if (!(error instanceof CreateError && [403, 404].includes(error.status))) throw error; }
  }
  res.json({ items: items.slice(0, 500), hasMore: rows.length > 500 });
}));
router.post("/trash/:id/restore", route(async (req, res, org, actor) => {
  const entry = await prisma.createTrashItem.findFirst({ where: { id: param(req), organizationId: org, restoredAt: null } });
  if (!entry) throw new CreateError(404, "Trashed item not found.");
  const item = await target(req, kindOf(entry.kind), entry.resourceId);
  if (req.body.confirm !== true || req.body.revision !== entry.revision) throw new CreateError(409, "Review the current Trash entry before restoring it.");
  await prisma.$transaction(async tx => {
    if (item.campaign) {
      const locked = await tx.createCampaign.updateMany({ where: { id: item.campaign.id, organizationId: org, revision: item.campaign.revision }, data: { revision: { increment: 1 } } });
      if (!locked.count) throw new CreateError(409, "The campaign changed. Refresh Trash before restoring it.");
    }
    const changed = await tx.createTrashItem.updateMany({ where: { id: entry.id, organizationId: org, revision: entry.revision, restoredAt: null }, data: { restoredAt: new Date(), revision: { increment: 1 } } });
    if (!changed.count) throw new CreateError(409, "This item has already changed. Refresh Trash.");
    await tx.auditLog.create({ data: { organizationId: org, userId: actor, action: "CREATE_ITEM_RESTORED", entity: "CreateTrashItem", entityId: entry.id, metadata: { kind: entry.kind, resourceId: entry.resourceId } } });
  });
  res.json({ restored: true, resourceId: entry.resourceId });
}));
export default router;
