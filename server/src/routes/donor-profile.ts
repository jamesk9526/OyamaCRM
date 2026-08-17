/** First-party OYAMADonorPROFILE API. External lookups remain transient until reviewed. */
import { Router, type Request } from "express";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { lookupProPublica, lookupSecEdgar, type PublicResearchResult } from "../services/public-donor-research.js";
import {
  OYAMA_DONOR_PROFILE_POLICY,
  OYAMA_DONOR_PROFILE_PRODUCT,
  resolveDonorProfileIdentity,
  type DonorProfileEvidenceCandidate,
} from "../services/oyama-donor-profile.js";

type ActiveProvider = "propublica" | "sec_edgar";

const router = Router();
const PROVIDERS = new Set<ActiveProvider>(["propublica", "sec_edgar"]);
const SIGNAL_TYPES = new Set(["FOUNDATION_ACTIVITY", "NONPROFIT_LEADERSHIP", "CORPORATE_AFFILIATION"]);
const CONFIDENCE_LEVELS = new Set(["LOW", "MEDIUM", "HIGH"]);
const REVIEW_STATUSES = new Set(["UNVERIFIED", "VERIFIED", "DISMISSED"]);

router.use(requireAuth);

function text(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function optionalDate(value: unknown): Date | null {
  const raw = text(value, 80);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function optionalAmount(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(parsed) && Math.abs(parsed) <= 999_999_999_999_999.99 ? parsed : null;
}

function isAllowedSourceUrl(provider: ActiveProvider, rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (provider === "propublica") return url.hostname === "projects.propublica.org";
    return url.hostname === "www.sec.gov" || url.hostname === "data.sec.gov" || url.hostname.endsWith(".sec.gov");
  } catch {
    return false;
  }
}

async function requestContext(req: Request) {
  const organizationId = await resolveOrganizationId({ req });
  const userId = req.user?.sub?.trim() ?? "";
  return { organizationId, userId };
}

router.get("/providers", requirePermission("view:constituents"), (_req, res) => {
  const secConfigured = Boolean(process.env.SEC_EDGAR_USER_AGENT?.trim());
  res.json({
    product: OYAMA_DONOR_PROFILE_PRODUCT,
    providers: [
      {
        key: "propublica",
        name: "OYAMA Foundation Intelligence",
        configured: true,
        access: "Live public API through OYAMA connector",
        bestFor: "Foundations, nonprofit entities, and IRS-linked filings",
        limitation: "Organization evidence only; this is not individual net worth or a nationwide donor list.",
      },
      {
        key: "sec_edgar",
        name: "OYAMA SEC Intelligence",
        configured: secConfigured,
        access: secConfigured ? "Live public API through OYAMA connector" : "Set SEC_EDGAR_USER_AGENT",
        bestFor: "Known public-company filers and disclosed filings",
        limitation: "A CIK is required. Entity filings do not establish a person's identity, holdings, or total wealth.",
      },
    ],
    policy: {
      ...OYAMA_DONOR_PROFILE_POLICY,
      transientLookup: true,
      autoVerify: false,
      storesRawPayloads: false,
    },
  });
});

router.post("/lookup", requirePermission("view:constituents"), async (req, res) => {
  const provider = text(req.body?.provider, 40) as ActiveProvider;
  const query = text(req.body?.query, 180);
  if (!PROVIDERS.has(provider)) {
    res.status(400).json({ error: { code: "INVALID_PROVIDER", message: "Choose an enabled OYAMADonorPROFILE source." } });
    return;
  }
  if (query.length < 2) {
    res.status(400).json({ error: { code: "INVALID_QUERY", message: "Enter at least 2 characters to search." } });
    return;
  }
  if (provider === "sec_edgar" && !process.env.SEC_EDGAR_USER_AGENT?.trim()) {
    res.status(503).json({ error: { code: "PROVIDER_NOT_CONFIGURED", message: "SEC EDGAR needs SEC_EDGAR_USER_AGENT set to an application name and contact email." } });
    return;
  }

  try {
    const results: PublicResearchResult[] = provider === "propublica"
      ? await lookupProPublica(query)
      : await lookupSecEdgar(query, process.env.SEC_EDGAR_USER_AGENT?.trim() ?? "");
    res.json({ product: OYAMA_DONOR_PROFILE_PRODUCT, provider, query, searchedAt: new Date().toISOString(), results });
  } catch (error) {
    res.status(502).json({ error: { code: "PUBLIC_SOURCE_UNAVAILABLE", message: error instanceof Error ? error.message : "The approved public source is unavailable." } });
  }
});

router.post("/identity/resolve", requirePermission("edit:constituents"), async (req, res) => {
  const { organizationId, userId } = await requestContext(req);
  const constituentId = text(req.body?.constituentId, 191);
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "A signed-in organization user is required." } });
    return;
  }
  const subject = await prisma.constituent.findFirst({
    where: { id: constituentId, organizationId },
    select: { firstName: true, lastName: true, addressLine1: true, city: true, state: true, zip: true, email: true, employer: true, occupation: true },
  });
  if (!subject) {
    res.status(404).json({ error: { code: "CONSTITUENT_NOT_FOUND", message: "The selected constituent was not found in this organization." } });
    return;
  }
  const input = req.body?.candidate ?? {};
  const candidate: DonorProfileEvidenceCandidate = {
    firstName: text(input.firstName, 100), middleName: text(input.middleName, 100), lastName: text(input.lastName, 100), suffix: text(input.suffix, 40),
    addressLine1: text(input.addressLine1, 255), city: text(input.city, 100), county: text(input.county, 100), state: text(input.state, 100), zip: text(input.zip, 30),
    email: text(input.email, 320), employer: text(input.employer, 255), occupation: text(input.occupation, 255), spouseName: text(input.spouseName, 255),
    knownOrganization: text(input.knownOrganization, 255), mailingAddress: text(input.mailingAddress, 255), businessAddress: text(input.businessAddress, 255),
    foundationAssociation: text(input.foundationAssociation, 255),
  };
  const result = resolveDonorProfileIdentity(subject, candidate);
  await logAudit({
    action: "OYAMA_DONOR_PROFILE_IDENTITY_RESOLVED",
    entity: "Constituent",
    entityId: constituentId,
    userId,
    organizationId,
    metadata: { score: result.score, band: result.band, signalKeys: result.signals.map((signal) => signal.key) },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  res.json({ product: OYAMA_DONOR_PROFILE_PRODUCT, identity: result });
});

router.get("/findings", requirePermission("view:constituents"), async (req, res) => {
  const { organizationId } = await requestContext(req);
  const constituentId = text(req.query.constituentId, 191);
  if (!organizationId || !constituentId) {
    res.status(400).json({ error: { code: "MISSING_SCOPE", message: "Choose a constituent before loading profile evidence." } });
    return;
  }
  const findings = await prisma.donorResearchFinding.findMany({
    where: { organizationId, constituentId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } }, reviewedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.json({ product: OYAMA_DONOR_PROFILE_PRODUCT, findings });
});

router.post("/findings", requirePermission("edit:constituents"), async (req, res) => {
  const { organizationId, userId } = await requestContext(req);
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "A signed-in organization user is required." } });
    return;
  }
  const constituentId = text(req.body?.constituentId, 191);
  const provider = text(req.body?.provider, 40) as ActiveProvider;
  const sourceUrl = text(req.body?.sourceUrl, 1000);
  const sourceRecordId = text(req.body?.sourceRecordId, 120) || null;
  const signalType = text(req.body?.signalType, 60);
  const title = text(req.body?.title, 255);
  const summary = text(req.body?.summary, 8_000);
  const matchConfidence = text(req.body?.matchConfidence, 20).toUpperCase() || "LOW";
  const matchRationale = text(req.body?.matchRationale, 4_000);
  if (!constituentId || !PROVIDERS.has(provider) || !isAllowedSourceUrl(provider, sourceUrl) || !SIGNAL_TYPES.has(signalType) || !title || !summary) {
    res.status(400).json({ error: { code: "INVALID_FINDING", message: "The evidence is missing valid source provenance or required fields." } });
    return;
  }
  if (!CONFIDENCE_LEVELS.has(matchConfidence) || matchRationale.length < 12) {
    res.status(400).json({ error: { code: "MATCH_REVIEW_REQUIRED", message: "Record confidence and a specific identity-match rationale before saving." } });
    return;
  }
  const constituent = await prisma.constituent.findFirst({ where: { id: constituentId, organizationId }, select: { id: true } });
  if (!constituent) {
    res.status(404).json({ error: { code: "CONSTITUENT_NOT_FOUND", message: "The selected constituent was not found in this organization." } });
    return;
  }
  const finding = await prisma.donorResearchFinding.create({
    data: {
      organizationId, constituentId, provider, sourceRecordId, sourceUrl, signalType, title, summary,
      disclosedAmount: optionalAmount(req.body?.disclosedAmount), disclosedAmountLabel: text(req.body?.disclosedAmountLabel, 120) || null,
      sourcePublishedAt: optionalDate(req.body?.sourcePublishedAt), matchConfidence, matchRationale, status: "UNVERIFIED", createdByUserId: userId,
    },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } }, reviewedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  await logAudit({ action: "OYAMA_DONOR_PROFILE_EVIDENCE_CREATED", entity: "DonorResearchFinding", entityId: finding.id, userId, organizationId, metadata: { constituentId, provider, sourceRecordId, status: "UNVERIFIED" }, ipAddress: req.ip, userAgent: req.get("user-agent") });
  res.status(201).json({ finding });
});

router.patch("/findings/:id", requirePermission("edit:constituents"), async (req, res) => {
  const { organizationId, userId } = await requestContext(req);
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "A signed-in organization user is required." } });
    return;
  }
  const status = text(req.body?.status, 20).toUpperCase();
  const reviewNotes = text(req.body?.reviewNotes, 4_000) || null;
  if (!REVIEW_STATUSES.has(status)) {
    res.status(400).json({ error: { code: "INVALID_REVIEW_STATUS", message: "Choose unverified, verified, or dismissed." } });
    return;
  }
  const existing = await prisma.donorResearchFinding.findFirst({ where: { id: text(req.params.id, 191), organizationId }, select: { id: true, constituentId: true } });
  if (!existing) {
    res.status(404).json({ error: { code: "FINDING_NOT_FOUND", message: "Profile evidence was not found." } });
    return;
  }
  const finding = await prisma.donorResearchFinding.update({
    where: { id: existing.id },
    data: status === "UNVERIFIED" ? { status, reviewNotes, reviewedAt: null, reviewedByUserId: null } : { status, reviewNotes, reviewedAt: new Date(), reviewedByUserId: userId },
    include: { createdBy: { select: { id: true, firstName: true, lastName: true } }, reviewedBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  await logAudit({ action: "OYAMA_DONOR_PROFILE_EVIDENCE_REVIEWED", entity: "DonorResearchFinding", entityId: finding.id, userId, organizationId, metadata: { constituentId: existing.constituentId, status }, ipAddress: req.ip, userAgent: req.get("user-agent") });
  res.json({ finding });
});

export default router;

