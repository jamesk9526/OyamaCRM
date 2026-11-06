import { Router } from "express";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { renderProductionLetter } from "../services/letter-production-renderer.js";
import { demand, demandChannels, touchCampaign } from "./access.js";
import { contentFor } from "./content.js";
import { CreateError, string, type Channel } from "./domain.js";
import { param, route } from "./http.js";
import { classicResponse, loadClassicLetter, persistClassicLetter, validateClassicEdit } from "./classic-letter.js";
import { freezeClassicArtifacts, printKinds } from "./classic-print.js";
import { renderFrozenStudio } from "./studio/print.js";
import type { ArtifactKind } from "./studio/types.js";

const router = Router();

router.get("/contents/:id/letter/recipients", route(async (req, res, org) => {
  await contentFor(req, param(req));
  await demand(req, "letters.view"); await demand(req, "view:constituents");
  const q = string(req.query.q).trim().slice(0, 100);
  const recipients = await prisma.constituent.findMany({
    where: { organizationId: org, ...(q ? { OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { displayName: { contains: q } }, { organizationName: { contains: q } }] } : {}) },
    orderBy: [{ lastName: "asc" }, { id: "asc" }], take: 80,
    select: { id: true, firstName: true, lastName: true, displayName: true, organizationName: true, entityKind: true,
      doNotMail: true, addressLine1: true, addressLine2: true, city: true, state: true, zip: true },
  });
  res.json(recipients);
}));

router.get("/contents/:id/letter", route(async (req, res) => {
  const { content, campaign } = await contentFor(req, param(req));
  await demand(req, "letters.view");
  const loaded = await loadClassicLetter(req, content);
  res.json(await classicResponse(req, content, campaign.revision, loaded));
}));

router.put("/contents/:id/letter", route(async (req, res, org, actor) => {
  const { content, campaign } = await contentFor(req, param(req), true);
  await demandChannels(req, campaign.channelsJson as Channel[], true);
  if (campaign.status !== "DRAFT") throw new CreateError(409, "Duplicate this campaign into a new draft before editing its Letter.");
  if (req.body.revision !== content.revision || req.body.campaignRevision !== campaign.revision) {
    throw new CreateError(409, "This letter has a newer revision. Your local edits are retained.");
  }
  const loaded = await loadClassicLetter(req, content);
  if (!loaded.existing) await demand(req, "letters.create");
  if (req.body.letterRevision !== (loaded.existing?.revision ?? 0)) throw new CreateError(409, "Refresh the working Letter before saving.");
  const edit = await validateClassicEdit(req, content, loaded, req.body);
  const saved = await prisma.$transaction(async tx => {
    await touchCampaign(tx, org, campaign.id, campaign.revision);
    const template = await persistClassicLetter(tx, content, actor, edit, loaded.existing);
    await tx.auditLog.create({ data: { organizationId: org, userId: actor, action: "CREATE_LETTER_SAVED", entity: "CreateContent", entityId: content.id, metadata: { revision: content.revision + 1, renderer: edit.config.renderer } } });
    return template;
  });
  res.json(await classicResponse(req, { ...content, revision: content.revision + 1 }, campaign.revision + 1, { ...edit, existing: saved }));
}));

router.post("/contents/:id/letter/proof", route(async (req, res, org, actor) => {
  const { content, campaign } = await contentFor(req, param(req));
  await demand(req, "letters.export_pdf");
  if (req.body.revision !== content.revision) throw new CreateError(409, "Refresh the current Letter before creating a proof.");
  const loaded = await loadClassicLetter(req, content);
  if (req.body.letterRevision !== (loaded.existing?.revision ?? 0)) throw new CreateError(409, "Refresh the working Letter before creating a proof.");
  if (req.body.template) await demand(req, "letters.edit");
  const inputs = req.body.template ? await validateClassicEdit(req, content, loaded, { ...req.body, enableAdvanced: false, confirmComparison: false }) : loaded;
  const constituentId = string(req.body.constituentId) || undefined;
  const requested = string(req.body.kind) || "LETTER";
  const available = printKinds(inputs.design, inputs.config.renderer);
  if (requested !== "ALL" && !available.includes(requested as ArtifactKind)) throw new CreateError(400, "This Letter does not include that print piece.");
  const artifacts = await freezeClassicArtifacts(req, campaign, inputs, {
    templateId: loaded.existing?.id || content.id, revision: content.revision, constituentId,
    donationId: string(req.body.donationId) || undefined, asOf: new Date(), sample: !constituentId, proof: true,
    kinds: requested === "ALL" ? available : [requested as ArtifactKind],
  });
  const output = artifacts.length > 1 ? await PDFDocument.create() : null;
  const warnings: string[] = [];
  let bytes: Buffer | undefined, pages = 0;
  for (const { snapshot } of artifacts) {
    const studio = snapshot.studio;
    const rendered = studio && (!constituentId || studio.issues.some(issue => issue.blocking))
      ? await renderFrozenStudio(studio, true) : await renderProductionLetter(snapshot);
    warnings.push(...rendered.warnings, ...(studio?.issues.filter(issue => issue.blocking).map(issue => issue.message) || []));
    if (output) {
      const part = await PDFDocument.load(rendered.bytes);
      for (const page of await output.copyPages(part, part.getPageIndices())) output.addPage(page);
    }
    bytes = rendered.bytes; pages += rendered.pageCount;
  }
  if (!bytes) throw new CreateError(422, "No Letter proof was generated.");
  await logAudit({ organizationId: org, userId: actor, action: "CREATE_LETTER_PROOF_VIEWED", entity: "CreateContent", entityId: content.id, metadata: { revision: content.revision, pages, kind: requested } });
  res.set({
    "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="letter-proof.pdf"', "X-Content-Type-Options": "nosniff",
    "X-Classic-Pages": String(pages), "X-Classic-Warnings": encodeURIComponent(JSON.stringify([...new Set(warnings)].slice(0, 12))),
  }).send(output ? Buffer.from(await output.save()) : bytes);
}));

export default router;
