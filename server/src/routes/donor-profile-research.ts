/** One-click automatic OYAMADonorPROFILE research orchestration. */
import { Router, type Request } from "express";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { researchAutomaticDonorProfile } from "../services/oyama-profile-research.js";

const router = Router();
router.use(requireAuth);

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

async function requestContext(req: Request) {
  return { organizationId: await resolveOrganizationId({ req }), userId: req.user?.sub?.trim() ?? "" };
}

router.post("/research", requirePermission("edit:constituents"), async (req, res) => {
  const { organizationId, userId } = await requestContext(req);
  const constituentId = text(req.body?.constituentId, 191);
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "A signed-in organization user is required." } });
    return;
  }
  if (!constituentId) {
    res.status(400).json({ error: { code: "CONSTITUENT_REQUIRED", message: "Choose the constituent to research." } });
    return;
  }
  const subject = await prisma.constituent.findFirst({
    where: { id: constituentId, organizationId },
    select: { id: true, entityKind: true, firstName: true, lastName: true, displayName: true, organizationName: true, email: true, addressLine1: true, city: true, state: true, zip: true, employer: true, occupation: true },
  });
  if (!subject) {
    res.status(404).json({ error: { code: "CONSTITUENT_NOT_FOUND", message: "The selected constituent was not found in this organization." } });
    return;
  }
  const savedEvidence = await prisma.donorResearchFinding.findMany({
    where: { organizationId, constituentId },
    orderBy: { createdAt: "desc" },
    select: { id: true, provider: true, sourceRecordId: true, sourceUrl: true, signalType: true, title: true, summary: true, status: true, matchConfidence: true, matchRationale: true, sourcePublishedAt: true, createdAt: true },
  });
  const profile = await researchAutomaticDonorProfile({ subject, savedEvidence, secUserAgent: process.env.SEC_EDGAR_USER_AGENT });
  await logAudit({
    action: "OYAMA_DONOR_PROFILE_RESEARCHED",
    entity: "Constituent",
    entityId: constituentId,
    userId,
    organizationId,
    metadata: { profileId: profile.id, status: profile.status, sourceCount: profile.sourceRuns.length, discoveredCount: profile.discoveredEvidence.length, savedEvidenceCount: profile.savedEvidence.length },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  res.json({ profile });
});

export default router;

