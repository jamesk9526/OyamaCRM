import { Router } from "express";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { json } from "../services/letter-production.js";
import { createWebmasterSite, createWebmasterPage, createWebmasterPublishVersion, listWebmasterPages, updateWebmasterPage, updateWebmasterSite } from "../services/webmaster-store.js";
import { assertCampaign, demand } from "./access.js";
import { route, param } from "./http.js";
import { CreateError, documentFrom, object, publicCopySafe, renderShared, required, string, variantFrom } from "./domain.js";
import type { FrozenContent, FrozenVariant, ReleaseSnapshot } from "./releases.js";
export const publicRouter = Router();
const router = Router();
export async function publishFrozenPage(org: string, actor: string, snapshot: ReleaseSnapshot, content: FrozenContent, variant: FrozenVariant) {
  if (!publicCopySafe(content.document, variant.format)) throw new CreateError(422, "Public pages cannot contain recipient merge fields.");
  const previous = await prisma.createPublication.findFirst({ where: { organizationId: org, contentId: content.id }, orderBy: { publishedAt: "desc" } });
  const slug = previous?.slug || `${snapshot.campaign.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 50).replace(/^-|-$/g, "") || "campaign"}-${content.id}`;
  const site = previous ? { id: previous.webmasterSiteId } : await createWebmasterSite({ organizationId: org, createdById: actor, ownerId: actor, name: snapshot.campaign.name, slug, siteType: "CAMPAIGN_SITE", connectedModule: "communications", connectedRecordId: snapshot.campaign.id, publishingTarget: "CRM_CAMPAIGN", status: "ACTIVE" });
  const pages = await listWebmasterPages({ organizationId: org, siteId: site.id, limit: 2 });
  const contentJson = { schema: "oyama-create-page-v1", document: content.document, variant: variant.format, attribution: { createCampaignId: snapshot.campaign.id, fundraisingCampaignId: snapshot.campaign.fundraisingCampaignId, eventId: snapshot.campaign.eventId } };
  if (pages[0]) await updateWebmasterPage({ organizationId: org, pageId: pages[0].id, updatedById: actor, title: content.name, status: "PUBLISHED", contentJson });
  else await createWebmasterPage({ organizationId: org, siteId: site.id, createdById: actor, title: content.name, slug: "index", path: "/", status: "PUBLISHED", contentJson });
  const version = await createWebmasterPublishVersion({ organizationId: org, siteId: site.id, createdById: actor, note: `oyamaCreate campaign revision ${snapshot.campaign.revision}` });
  await updateWebmasterSite({ organizationId: org, siteId: site.id, publishedVersionId: version.id, lastPublishedAt: new Date().toISOString(), launchStatus: "LIVE", status: "ACTIVE" });
  return prisma.$transaction(async tx => {
    // Serialize publication/rollback for this content without changing its authored revision.
    await tx.createContent.update({ where: { id: content.id }, data: { updatedAt: new Date() } });
    await tx.createPublication.updateMany({ where: { organizationId: org, contentId: content.id, active: true }, data: { active: false } });
    return tx.createPublication.create({ data: { organizationId: org, contentId: content.id, campaignId: snapshot.campaign.id, slug, documentJson: json(content.document), variantJson: json({ ...variant.format, attribution: { fundraisingCampaignId: snapshot.campaign.fundraisingCampaignId, eventId: snapshot.campaign.eventId } }), webmasterSiteId: site.id, webmasterVersionId: version.id, publishedBy: actor } });
  });
}
const publicLimit = rateLimit({ windowMs: 60000, limit: 15, standardHeaders: "draft-7", legacyHeaders: false });
publicRouter.get("/pages/:slug", async (req, res, next) => {
  try {
    const publication = await prisma.createPublication.findFirst({ where: { slug: string(req.params.slug), active: true }, orderBy: { publishedAt: "desc" } });
    if (!publication) { res.status(404).json({ error: { message: "This campaign page is not published." } }); return; }
    const format = variantFrom(publication.variantJson); const document = documentFrom(publication.documentJson);
    if (!publicCopySafe(document, format)) { res.status(404).json({ error: { message: "This campaign page is unavailable." } }); return; }
    const campaign = await prisma.createCampaign.findFirst({ where: { id: publication.campaignId, organizationId: publication.organizationId }, select: { name: true } });
    res.set("Cache-Control", "no-store").json({ id: publication.id, name: campaign?.name || "Campaign", document, format, ...renderShared(document, format), publishedAt: publication.publishedAt });
  } catch (error) { next(error); }
});
publicRouter.post("/pages/:slug/submissions", publicLimit, async (req, res, next) => {
  try {
    const publication = await prisma.createPublication.findFirst({ where: { slug: string(req.params.slug), active: true }, orderBy: { publishedAt: "desc" } });
    if (!publication || !variantFrom(publication.variantJson).formEnabled) throw new CreateError(404, "This form is unavailable.");
    const body = object(req.body); if (body.website) { res.status(202).json({ received: true }); return; }
    const email = required(body.email, "Email", 254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new CreateError(400, "Enter a valid email address.");
    if (body.consent !== true) throw new CreateError(400, "Confirm the form consent before submitting.");
    const name = required(body.name, "Name");
    const message = string(body.message).trim(); if (message.length > 5000) throw new CreateError(400, "Keep your message under 5,000 characters.");
    await prisma.createLead.create({ data: { organizationId: publication.organizationId, campaignId: publication.campaignId, publicationId: publication.id, name, email, message, consent: true, consentText: variantFrom(publication.variantJson).consentText } });
    res.status(202).json({ received: true });
  } catch (error) { if (error instanceof CreateError) { res.status(error.status).json({ error: { message: error.message } }); return; } next(error); }
});
router.get("/publications", route(async (req, res, org) => {
  await demand(req, "view:communications");
  res.json(await prisma.createPublication.findMany({ where: { organizationId: org, ...(req.query.campaignId ? { campaignId: string(req.query.campaignId) } : {}) }, orderBy: { publishedAt: "desc" }, take: 100, select: { id: true, campaignId: true, contentId: true, slug: true, webmasterSiteId: true, webmasterVersionId: true, active: true, publishedAt: true } }));
}));
router.post("/publications/:id/activate", route(async (req, res, org) => {
  await demand(req, "edit:communications");
  const publication = await prisma.createPublication.findFirst({ where: { id: param(req), organizationId: org } });
  if (!publication) throw new CreateError(404, "Publication not found.");
  await assertCampaign(req, publication.campaignId, true);
  if (req.body.confirm !== true) throw new CreateError(400, "Confirm publishing this historical version.");
  await prisma.$transaction(async tx => {
    await tx.createContent.update({ where: { id: publication.contentId }, data: { updatedAt: new Date() } });
    await tx.createPublication.updateMany({ where: { organizationId: org, contentId: publication.contentId }, data: { active: false } });
    await tx.createPublication.update({ where: { id: publication.id }, data: { active: true } });
  }); res.json({ active: true });
}));
router.get("/leads", route(async (req, res, org) => {
  await demand(req, "view:communications");
  res.json(await prisma.createLead.findMany({ where: { organizationId: org, status: "PENDING" }, orderBy: { createdAt: "desc" }, take: 100 }));
}));
router.post("/leads/:id/review", route(async (req, res, org, actor) => {
  await demand(req, "edit:communications"); await demand(req, "edit:constituents");
  const lead = await prisma.createLead.findFirst({ where: { id: param(req), organizationId: org, status: "PENDING" } });
  if (!lead) throw new CreateError(404, "Pending submission not found.");
  const choice = string(req.body.choice), constituentId = string(req.body.constituentId);
  if (!["MATCH", "CREATE", "DISMISS"].includes(choice) || req.body.confirm !== true) throw new CreateError(400, "Review the contact match and confirm a choice.");
  const result = await prisma.$transaction(async tx => {
    const claimed = await tx.createLead.updateMany({ where: { id: lead.id, organizationId: org, status: "PENDING" }, data: { status: choice === "DISMISS" ? "DISMISSED" : "REVIEWED", reviewedBy: actor, reviewedAt: new Date() } });
    if (!claimed.count) throw new CreateError(409, "This submission was already reviewed.");
    let matchedId: string | null = null;
    if (choice === "MATCH") {
      const contact = await tx.constituent.findFirst({ where: { id: constituentId, organizationId: org, closedAt: null } });
      if (!contact) throw new CreateError(404, "Choose an active contact in this organization.");
      matchedId = contact.id;
    }
    if (choice === "CREATE") {
      if (await tx.constituent.findFirst({ where: { organizationId: org, email: lead.email, closedAt: null } })) throw new CreateError(409, "A contact with this email exists. Review and match it instead.");
      const [firstName, ...last] = lead.name.split(/\s+/);
      matchedId = (await tx.constituent.create({ data: { organizationId: org, firstName, lastName: last.join(" "), email: lead.email } })).id;
    }
    // Form consent is retained as evidence; it never clears existing email, postal or SMS suppressions.
    return tx.createLead.update({ where: { id: lead.id }, data: { matchedConstituentId: matchedId } });
  }); res.json(result);
}));
export default router;
