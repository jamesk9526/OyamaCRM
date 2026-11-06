import { Router } from "express";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../../lib/prisma.js";
import { readArtifact } from "../../services/letter-production.js";
import { assertCampaign, demand } from "../access.js";
import { CreateError, object, string } from "../domain.js";
import { route, param } from "../http.js";
import {assertStudioPrintAccess} from "./print-access.js";
import { renderAvery5160Pdf } from "../../services/avery-labels.js";
import { logAudit } from "../../lib/audit.js";
import type { LetterSnapshot } from "../../services/letter-production-contract.js";
const router = Router();
const packOrder = ["LETTER", "REPLY_SLIP", "OUTER_ENVELOPE", "RETURN_ENVELOPE"];
router.get(["/deliveries/:id/pack", "/deliveries/:id/pack/pdf", "/releases/:id/print-export"], route(async (req, res, org, actor) => {
  await demand(req, "letters.view");
  const byRelease = req.path.includes("/releases/");
  const deliveries = await prisma.createDelivery.findMany({ where: { organizationId: org, channel: "LETTER", ...(byRelease ? { releaseId: param(req) } : { id: param(req) }) }, include: { release: true }, take: 501, orderBy: { recipientKey: "asc" } });
  if (!deliveries.length) throw new CreateError(404, "Print delivery not found.");
  if (deliveries.length > 500) throw new CreateError(422, "Export at most 500 recipient packs at a time. Use a smaller print batch.");
  await assertCampaign(req, deliveries[0].release.campaignId);
  const fallback = [...deliveries].sort((a, b) => a.id.localeCompare(b.id));
  const positions = new Map(fallback.map((delivery, index) => {
    const frozen = object(delivery.payloadJson).printPosition;
    return [delivery.id, { index: typeof frozen === "number" ? frozen : index, current: typeof frozen === "number" }];
  }));
  const parts = (await prisma.createPrintArtifact.findMany({ where: { organizationId: org, deliveryId: { in: deliveries.map(item => item.id) } } }))
    .sort((a, b) => {
      const left = positions.get(a.deliveryId)!, right = positions.get(b.deliveryId)!;
      return left.index - right.index || (left.current && right.current ? packOrder.indexOf(a.kind) - packOrder.indexOf(b.kind) : a.kind.localeCompare(b.kind));
    });
  for(const part of parts)await assertStudioPrintAccess(req,part.snapshotJson);
  const manifest = parts.map(part => { const snapshot = object(part.snapshotJson); return { id: part.id, deliveryId: part.deliveryId, kind: part.kind, generatedLetterId: part.generatedLetterId, artifactId: part.renderJobId, recipientId: snapshot.recipientId, recipient: object(snapshot.recipient).name, responseCode: object(snapshot.studio).responseCode, status: part.status }; });
  if (byRelease && req.query.format === "labels") {
    await demand(req, "letters.export_pdf");
    const startPosition = req.query.startPosition === undefined ? 1 : Number(req.query.startPosition);
    if (!Number.isInteger(startPosition) || startPosition < 1 || startPosition > 30) throw new CreateError(400, "Choose a starting label between 1 and 30.");
    const letters = parts.filter(part => part.kind === "LETTER");
    if (letters.length !== deliveries.length) throw new CreateError(409, "Wait until all Letter proofs for this release are prepared.");
    const labels = [];
    for (const part of letters) {
      if (!part.renderJobId) throw new CreateError(409, "A Letter proof is still being prepared.");
      await readArtifact(org, part.renderJobId);
      const snapshot = part.snapshotJson as unknown as LetterSnapshot;
      labels.push(snapshot.recipient);
    }
    const pdf = await renderAvery5160Pdf(labels, { startPosition, showGuides: req.query.guides === "true" });
    await logAudit({ organizationId: org, userId: actor, action: "CREATE_PRINT_LABELS_VIEWED", entity: "CreateRelease", entityId: deliveries[0].releaseId, metadata: { startPosition, count: labels.length } });
    res.set({ "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="mailing-labels.pdf"', "X-Content-Type-Options": "nosniff" }).send(pdf);
    return;
  }
  if (!req.path.endsWith("/pdf") && req.query.format !== "pdf") { res.json({ releaseId: deliveries[0].releaseId, pieces: manifest, openingDoesNotMarkPrinted: true }); return; }
  await demand(req, "letters.export_pdf");
  const kind = string(req.query.kind) || "ALL";
  if (!["ALL", "LETTER", "REPLY_SLIP", "OUTER_ENVELOPE", "RETURN_ENVELOPE"].includes(kind)) throw new CreateError(400, "Choose a print piece type.");
  const selected = parts.filter(part => kind === "ALL" || part.kind === kind);
  if (!selected.length) throw new CreateError(422, "No prepared pieces of that type are available.");
  const output = await PDFDocument.create();
  for (const part of selected) {
    if (!part.renderJobId) throw new CreateError(409, "A print piece is still being prepared.");
    const { bytes } = await readArtifact(org, part.renderJobId), source = await PDFDocument.load(bytes);
    for (const page of await output.copyPages(source, source.getPageIndices())) output.addPage(page);
  }
  res.set({ "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="appeal-pack-${kind.toLowerCase()}.pdf"`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }); res.send(Buffer.from(await output.save()));
}));
export default router;
