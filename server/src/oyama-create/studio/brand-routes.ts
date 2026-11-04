import { assertAvailableSelections } from "../trash-selection.js";
import { trashedIds } from "../trash-state.js";
import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../../lib/prisma.js";
import { json } from "../../services/letter-production.js";
import { can, demand } from "../access.js";
import { CreateError, string } from "../domain.js";
import { route, param } from "../http.js";
import { normalizeBrand } from "./brand.js";
import { readBrand, publishBrand, brandReviewToken, sanitizeBrandHtml, brandForDesign } from "./brand-service.js";
import { assertStudioAssetOwnership } from "./asset-ownership.js";
const router = Router();
async function view(req: Parameters<typeof can>[0]) { if (!await can(req, "letters.view") && !await can(req, "view:communications")) throw new CreateError(403, "Brand resources require communications or letter access."); }
router.get("/brand", route(async (req, res, org) => {
  await view(req); const state = await readBrand(org);
  res.json({ ...state, canEditIdentity: await can(req, "create.brand.publish"), canEditPresets: await can(req, "letters.manage_branding"), canEditSignatures: await can(req, "letters.manage_signatures"), canPublish: await can(req, "create.brand.publish") });
}));
router.put("/brand/draft", route(async (req, res, org, actor) => {
  await view(req); const current = await readBrand(org), document = sanitizeBrandHtml(normalizeBrand(req.body.document));
  assertStudioAssetOwnership(org,document);
  await assertAvailableSelections(org, document, current.document);
  const currentDocument = normalizeBrand(current.document);
  // Historical draft restoration keeps recoverable library records addressable by their original IDs.
  for (const signer of current.document.signers.filter(item => item.trashed)) if (!document.signers.some(item => item.id === signer.id)) document.signers.push(normalizeBrand({ version: 1, signers: [signer] }).signers[0]);
  for (const preset of current.document.presets.filter(item => item.trashed)) if (!document.presets.some(item => item.id === preset.id)) document.presets.push(normalizeBrand({ version: 1, presets: [preset] }).presets[0]);
  const [signersInTrash, presetsInTrash] = await Promise.all([trashedIds(org, "SIGNATURE"), trashedIds(org, "PRESET")]);
  if (document.defaultSignerId && signersInTrash.includes(document.defaultSignerId) || document.presets.some(preset => preset.active && preset.isDefault && presetsInTrash.includes(preset.id))) throw new CreateError(409, "Restore the library item before making it an active default.");
  if (JSON.stringify(currentDocument.identity) !== JSON.stringify(document.identity)) await demand(req, "create.brand.publish");
  if (JSON.stringify([currentDocument.presets, currentDocument.profiles]) !== JSON.stringify([document.presets, document.profiles])) await demand(req, "letters.manage_branding");
  if (JSON.stringify([currentDocument.signers, currentDocument.defaultSignerId]) !== JSON.stringify([document.signers, document.defaultSignerId])) await demand(req, "letters.manage_signatures");
  if (req.body.revision !== current.draftRevision) throw new CreateError(409, "The brand draft changed. Your local changes are preserved; reload before saving.");
  if (!current.draftRevision) await prisma.createBrandDraft.create({ data: { organizationId: org, documentJson: json(document), updatedBy: actor } });
  else {
    const saved = await prisma.createBrandDraft.updateMany({ where: { organizationId: org, revision: current.draftRevision }, data: { documentJson: json(document), updatedBy: actor, revision: { increment: 1 } } });
    if (!saved.count) throw new CreateError(409, "The brand draft changed in another session.");
  }
  res.json({ revision: current.draftRevision + 1, document });
}));
router.get("/brand/review", route(async (req, res, org) => {
  await view(req); const state = await readBrand(org);
  const [bindings, designs] = await Promise.all([prisma.createBrandBinding.findMany({ where: { organizationId: org }, take: 501 }), prisma.createContent.count({ where: { organizationId: org, designJson: { not: Prisma.DbNull } } })]);
  const prior = state.published?.document.identity || {};
  res.json({ draftRevision: state.draftRevision, publishedId: state.published?.id || null, document: state.document, changes: Object.keys(state.document.identity).filter(key => state.document.identity[key] !== prior[key]), reviewToken: brandReviewToken(org, state.draftRevision, state.published?.id || null, state.document), pinnedDesigns: designs, publicBindings: bindings.slice(0, 500), hasMoreBindings: bindings.length > 500, message: "Publication changes active defaults. Existing designs and public output remain pinned until explicitly updated." });
}));
router.post("/brand/publish", route(async (req, res, org, actor) => {
  await demand(req, "create.brand.publish");
  res.json(await publishBrand(org, actor, { draftRevision: req.body.draftRevision, publishedId: string(req.body.publishedId) || null, reviewToken: string(req.body.reviewToken), confirm: req.body.confirm === true }));
}));
router.get("/brand/history", route(async (req, res, org) => { await view(req); res.json(await prisma.createBrandRevision.findMany({ where: { organizationId: org }, select: { id: true, revision: true, publishedBy: true, publishedAt: true }, orderBy: { revision: "desc" }, take: 100 })); }));
router.get("/brand/revisions/:id", route(async (req, res, org) => { await view(req); res.json({ id: param(req), document: await brandForDesign(org, param(req)) }); }));
router.put("/studio/config", route(async (req, res, org) => {
  await demand(req, "create.connections.manage");
  if (req.body.confirm !== true || typeof req.body.studioEnabled !== "boolean" || typeof req.body.brandHubEnabled !== "boolean") throw new CreateError(400, "Review and confirm the organization rollout settings.");
  const currentSettings=await prisma.organizationSettings.findUnique({where:{organizationId:org}});
  if (req.body.brandHubEnabled && !currentSettings?.createBrandPublicBaselineId) throw new CreateError(422, "Preview and publish the initial brand revision in Brand Hub before enabling its navigation cutover.");
  const data = { oyamaCreateStudioEnabled: req.body.studioEnabled, oyamaCreateBrandHubEnabled: req.body.brandHubEnabled };
  await prisma.organizationSettings.upsert({ where: { organizationId: org }, create: { organizationId: org, ...data }, update: data });
  res.json({ studioEnabled: data.oyamaCreateStudioEnabled, brandHubEnabled: data.oyamaCreateBrandHubEnabled });
}));
export async function assertLegacyBrandWrite(org: string) {
  const setting = await prisma.organizationSettings.findUnique({ where: { organizationId: org } });
  if (setting?.createBrandPublicBaselineId) throw new CreateError(409, "Brand changes now require preview and publication in oyamaCreate → Library → Brand.");
}
export default router;
