import { Router } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { can, demand, demandChannels } from "./access.js";
import { contentFor } from "./content.js";
import { route, param } from "./http.js";
import { CreateError, required, type Channel } from "./domain.js";
import { defaultDesign } from "./studio/design.js";
import { upgradeUnifiedDesign } from "./studio/unified-document.js";
import { baselineBrand } from "./studio/brand-service.js";
import { json } from "../services/letter-production.js";
import { syncNative } from "./legacy.js";
const router = Router();
const starts: Record<string, { name: string; objective: string; channels: Channel[] }> = {
  LETTER: { name: "Untitled letter", objective: "GENERAL", channels: ["LETTER"] },
  EMAIL: { name: "Untitled email", objective: "GENERAL", channels: ["EMAIL"] },
  NEWSLETTER: { name: "Untitled newsletter", objective: "NEWSLETTER", channels: ["EMAIL"] },
  APPEAL: { name: "Untitled appeal", objective: "FUNDRAISING", channels: ["LETTER", "EMAIL"] },
  ACKNOWLEDGMENT: { name: "Untitled thank-you", objective: "ACKNOWLEDGMENT", channels: ["LETTER"] },
  EVENT: { name: "Untitled event promotion", objective: "EVENT", channels: ["EMAIL", "WEB"] },
};
router.post("/workspace/start", route(async (req, res, org, actor) => {
  const start = typeof req.body.kind === "string" ? starts[req.body.kind] : null;
  if (!start) throw new CreateError(400, "Choose a letter, email, newsletter, appeal, acknowledgment or event promotion.");
  await demandChannels(req, start.channels, true);
  if (start.channels.includes("LETTER")) await demand(req, "letters.create");
  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId: org } });
  let design = defaultDesign(); design.brandRevisionId = await baselineBrand(org, actor);
  if (settings?.oyamaCreateUnifiedEditorEnabled) design = upgradeUnifiedDesign(design);
  design.styles.primary = "#126f68"; design.styles.accent = "#126f68";
  const draft = await prisma.$transaction(async tx => {
    const campaign = await tx.createCampaign.create({ data: { organizationId: org, ownerId: actor, name: req.body.name?required(req.body.name,"Document name"):start.name, objective: start.objective, channelsJson: json(start.channels), audienceListIds: json([]) } });
    const content = await tx.createContent.create({ data: { organizationId: org, campaignId: campaign.id, name: campaign.name, documentJson: json({ version: 1, blocks: [] }), designJson: json(design) } });
    for (const channel of start.channels) {
      const variant = await tx.createVariant.create({ data: { organizationId: org, contentId: content.id, channel, documentJson: json({ overrides: {}, scheduledAt: null, subject: "" }) } });
      if (channel === "LETTER" && !settings?.oyamaCreateClassicLettersEnabled) await syncNative(tx, org, actor, content, variant);
    }
    await tx.createDocumentRevision.create({ data: { organizationId: org, contentId: content.id, revision: 1, documentJson: json({ studio: design, shared: content.documentJson }), createdBy: actor } });
    return { campaignId: campaign.id, contentId: content.id };
  });
  res.status(201).json(draft);
}));
router.get("/workspace/config", route(async (req, res, org) => {
  if (!await can(req, "letters.view") && !await can(req, "view:communications")) throw new CreateError(403, "Create access is required.");
  const settings = await prisma.organizationSettings.findUnique({ where: { organizationId: org } });
  res.json({ shellEnabled: settings?.oyamaCreateV5ShellEnabled === true, unifiedEditorEnabled: settings?.oyamaCreateUnifiedEditorEnabled === true, classicLettersEnabled: settings?.oyamaCreateClassicLettersEnabled === true });
}));
router.put("/workspace/config", route(async (req, res, org, actor) => {
  await demand(req, "create.connections.manage");
  if (req.body.confirm !== true || typeof req.body.shellEnabled !== "boolean" || typeof req.body.unifiedEditorEnabled !== "boolean") throw new CreateError(400, "Review both workspace rollout settings before applying them.");
  if (req.body.classicLettersEnabled !== undefined && typeof req.body.classicLettersEnabled !== "boolean") throw new CreateError(400, "Choose enabled or disabled for the classic Letters pilot.");
  const data = { oyamaCreateV5ShellEnabled: req.body.shellEnabled, oyamaCreateUnifiedEditorEnabled: req.body.unifiedEditorEnabled, ...(typeof req.body.classicLettersEnabled === "boolean" ? { oyamaCreateClassicLettersEnabled: req.body.classicLettersEnabled } : {}) };
  await prisma.$transaction(async tx => {
    await tx.organizationSettings.upsert({ where: { organizationId: org }, create: { organizationId: org, ...data }, update: data });
    await tx.auditLog.create({ data: { organizationId: org, userId: actor, action: "CREATE_WORKSPACE_ROLLOUT", entity: "OrganizationSettings", entityId: org, metadata: data } });
  });
  res.json({ shellEnabled: data.oyamaCreateV5ShellEnabled, unifiedEditorEnabled: data.oyamaCreateUnifiedEditorEnabled, ...(data.oyamaCreateClassicLettersEnabled === undefined ? {} : { classicLettersEnabled: data.oyamaCreateClassicLettersEnabled }) });
}));
router.get("/contents/:id/notes", route(async (req, res, org) => {
  await contentFor(req, param(req));
  const note = await prisma.createContentNote.findFirst({ where: { contentId: param(req), organizationId: org } });
  res.json(note ? { text: note.text, revision: note.revision, updatedAt: note.updatedAt } : { text: "", revision: 0, updatedAt: null });
}));
router.put("/contents/:id/notes", route(async (req, res, org, actor) => {
  const { content, campaign } = await contentFor(req, param(req), true);
  await demandChannels(req, campaign.channelsJson as Channel[], true);
  if (campaign.status === "HISTORICAL") throw new CreateError(409, "Historical content is read-only. Duplicate it to add draft notes.");
  const { text, revision } = req.body;
  if (typeof text !== "string" || text.length > 20000 || !Number.isInteger(revision) || revision < 0) throw new CreateError(400, "Notes must be text up to 20,000 characters with their current revision.");
  try {
    const note = await prisma.$transaction(async tx => {
      if (revision === 0) return tx.createContentNote.create({ data: { organizationId: org, contentId: content.id, text, updatedBy: actor } });
      const changed = await tx.createContentNote.updateMany({ where: { organizationId: org, contentId: content.id, revision }, data: { text, revision: { increment: 1 }, updatedBy: actor } });
      if (!changed.count) throw new CreateError(409, "Another staff member updated these notes. Your text is retained; compare the latest notes before saving again.");
      return tx.createContentNote.findUniqueOrThrow({ where: { contentId: content.id } });
    });
    // Internal notes intentionally do not touch campaign/content revisions or frozen approvals.
    res.json({ text: note.text, revision: note.revision, updatedAt: note.updatedAt });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw new CreateError(409, "Notes were added in another session. Your local text is retained.");
    throw error;
  }
}));
export default router;
