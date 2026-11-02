import { Prisma } from "@prisma/client";
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requirePermission } from "../middleware/requirePermission.js";

// Mounted behind the Letters router's bearer authentication. Keep the existing
// DELETE /templates/:id archive contract; permanent removal is a separate route.
const router = Router();
class DeletionError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

async function deleteTemplate(tx: Prisma.TransactionClient, id: string, organizationId: string, userId: string) {
  const template = await tx.letterTemplate.findFirst({
    where: { id, organizationId },
    select: { id: true, name: true, _count: { select: { generatedLetters: true } } },
  });
  if (!template) throw new DeletionError(404, "NOT_FOUND", "Letter template not found.");
  if (template._count.generatedLetters) throw new DeletionError(409, "TEMPLATE_IN_USE", "This template has generated letters. Delete those letters first, or archive the template to retain their history.");
  const workflows = await tx.stewardPathStep.count({
    where: { path: { organizationId }, configJson: { path: "$.templateId", equals: id } },
  });
  if (workflows) throw new DeletionError(409, "TEMPLATE_IN_USE", "This template is used by a Steward Path. Choose another template in that workflow before deleting it.");
  const removed = await tx.letterTemplate.deleteMany({ where: { id, organizationId, generatedLetters: { none: {} } } });
  if (!removed.count) throw new DeletionError(409, "LETTER_CHANGED", "This template changed. Refresh the library and try again.");
  await tx.auditLog.create({ data: {
    action: "LETTER_TEMPLATE_DELETED", entity: "LetterTemplate", entityId: id, organizationId, userId,
    metadata: { name: template.name, permanent: true },
  } });
}

async function deleteGeneratedLetter(tx: Prisma.TransactionClient, id: string, organizationId: string, userId: string) {
  const letter = await tx.generatedLetter.findFirst({
    where: { id, organizationId },
    select: { id: true, templateId: true, status: true, printedAt: true, mailedAt: true, emailSentAt: true, emailCampaignId: true, communicationActivityId: true },
  });
  if (!letter) throw new DeletionError(404, "NOT_FOUND", "Generated letter not found.");
  const removed = await tx.generatedLetter.deleteMany({ where: { id, organizationId } });
  if (!removed.count) throw new DeletionError(409, "LETTER_CHANGED", "This letter changed. Refresh the list and try again.");
  // Contact activity, linked email campaigns, frozen proofs and batch manifests
  // have their own lifecycle. Deleting a letter must not delete those records.
  await tx.auditLog.create({ data: {
    action: "GENERATED_LETTER_DELETED", entity: "GeneratedLetter", entityId: id, organizationId, userId,
    metadata: { templateId: letter.templateId, status: letter.status, printedAt: letter.printedAt?.toISOString() ?? null, mailedAt: letter.mailedAt?.toISOString() ?? null, emailSentAt: letter.emailSentAt?.toISOString() ?? null, emailCampaignId: letter.emailCampaignId, communicationActivityId: letter.communicationActivityId, permanent: true },
  } });
}

for (const kind of ["template", "generated"] as const) {
  router.delete(kind === "template" ? "/templates/:id/permanent" : "/generated/:id", requirePermission("letters.archive"), async (req, res) => {
    const organizationId = req.user?.orgId;
    const userId = req.user?.sub;
    if (!organizationId || !userId) {
      res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
      return;
    }
    if (req.body?.confirmation !== "delete") {
      res.status(400).json({ error: { code: "DELETE_CONFIRMATION_REQUIRED", message: "Type delete to confirm removal." } });
      return;
    }
    const id = typeof req.params.id === "string" ? req.params.id : "";
    if (!id || id.length > 128) {
      res.status(400).json({ error: { code: "INVALID_ID", message: "A valid letter ID is required." } });
      return;
    }
    try {
      await prisma.$transaction(tx => kind === "template" ? deleteTemplate(tx, id, organizationId, userId) : deleteGeneratedLetter(tx, id, organizationId, userId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      res.status(204).send();
    } catch (error) {
      if (error instanceof DeletionError) {
        res.status(error.status).json({ error: { code: error.code, message: error.message } });
      } else if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2003")) {
        res.status(409).json({ error: { code: "LETTER_CHANGED", message: "The letter is in use or changed during deletion. Refresh and try again." } });
      } else {
        console.error("[letters] deletion failed");
        res.status(500).json({ error: { code: "DELETE_FAILED", message: "The letter could not be deleted. Try again." } });
      }
    }
  });
}

export default router;
