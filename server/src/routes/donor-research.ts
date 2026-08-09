/**
 * Donor Research routes.
 *
 * External lookups are transient. A separate, permissioned save action creates an
 * unverified finding with source provenance; staff must verify or dismiss it later.
 */
import { Router, type Request } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  lookupProPublica,
  lookupSecEdgar,
  getWealthEngineConfiguration,
  lookupWealthEnginePerson,
  type PublicResearchResult,
  type PublicResearchProvider,
} from "../services/public-donor-research.js";

const router = Router();
const PROVIDERS = new Set<PublicResearchProvider>(["propublica", "sec_edgar", "wealthengine"]);
const PUBLIC_LOOKUP_PROVIDERS = new Set<PublicResearchProvider>(["propublica", "sec_edgar"]);
const SIGNAL_TYPES = new Set(["FOUNDATION_ACTIVITY", "NONPROFIT_LEADERSHIP", "CORPORATE_AFFILIATION", "WEALTH_SCREENING"]);
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

function isAllowedSourceUrl(provider: PublicResearchProvider, rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:") return false;
    if (provider === "propublica") return url.hostname === "projects.propublica.org";
    if (provider === "wealthengine") {
      return url.hostname === "apidocs.wealthengine.com"
        || url.hostname === "api.wealthengine.com"
        || url.hostname === "api-sandbox.wealthengine.com";
    }
    return url.hostname === "www.sec.gov" || url.hostname === "data.sec.gov" || url.hostname.endsWith(".sec.gov");
  } catch {
    return false;
  }
}

interface LicensedEvidencePayload {
  organizationId: string;
  constituentId: string;
  expiresAt: number;
  result: PublicResearchResult;
}

function evidenceSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) throw new Error("JWT_SECRET must be configured before licensed screening can run.");
  return secret;
}

function signLicensedEvidence(payload: LicensedEvidencePayload): string {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", evidenceSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyLicensedEvidence(token: string): LicensedEvidencePayload | null {
  try {
    const [encoded, suppliedSignature, extra] = token.split(".");
    if (!encoded || !suppliedSignature || extra) return null;
    const expectedSignature = createHmac("sha256", evidenceSecret()).update(encoded).digest("base64url");
    const suppliedBuffer = Buffer.from(suppliedSignature);
    const expectedBuffer = Buffer.from(expectedSignature);
    if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as LicensedEvidencePayload;
    if (!payload || payload.expiresAt < Date.now() || payload.result?.provider !== "wealthengine") return null;
    return payload;
  } catch {
    return null;
  }
}

async function requestContext(req: Request) {
  const organizationId = await resolveOrganizationId({ req });
  const userId = req?.user?.sub?.trim() ?? "";
  return { organizationId, userId };
}

router.get("/providers", requirePermission("view:constituents"), (_req, res) => {
  const secConfigured = Boolean(process.env.SEC_EDGAR_USER_AGENT?.trim());
  const wealthEngine = getWealthEngineConfiguration();
  res.json({
    providers: [
      {
        key: "propublica",
        name: "Nonprofit Explorer",
        configured: true,
        access: "Live public API",
        bestFor: "Foundations and nonprofit entities",
        limitation: "Organization records and IRS filings; not individual net worth.",
      },
      {
        key: "sec_edgar",
        name: "SEC EDGAR",
        configured: secConfigured,
        access: secConfigured ? "Live public API" : "Set SEC_EDGAR_USER_AGENT",
        bestFor: "Known public-company filers and disclosed filings",
        limitation: "Requires a CIK and does not establish identity, ownership, or personal wealth by itself.",
      },
      {
        key: "wealthengine",
        name: "WealthEngine",
        configured: wealthEngine.configured,
        access: wealthEngine.configured
          ? wealthEngine.mode === "sandbox" ? "Sandbox API — synthetic data" : "Licensed production API"
          : "Set WEALTHENGINE_API_KEY",
        bestFor: "Individual donor wealth and gift-capacity screening",
        limitation: wealthEngine.mode === "sandbox"
          ? "Sandbox responses are synthetic workflow samples and cannot be saved."
          : "Licensed vendor estimates require identity review and must not be treated as verified assets or an ask recommendation.",
        mode: wealthEngine.mode,
        category: "individual",
      },
    ],
    policy: {
      transientLookup: true,
      autoVerify: false,
      storesRawPayloads: false,
      prohibitedUses: ["Automated net-worth claims", "Unreviewed identity matching", "Sensitive-trait scoring"],
    },
  });
});

router.post("/lookup", requirePermission("view:constituents"), async (req, res) => {
  const provider = text(req.body?.provider, 40) as PublicResearchProvider;
  const query = text(req.body?.query, 180);
  if (!PUBLIC_LOOKUP_PROVIDERS.has(provider)) {
    res.status(400).json({ error: { code: "INVALID_PROVIDER", message: "Choose a supported public-data provider." } });
    return;
  }
  if (query.length < 2) {
    res.status(400).json({ error: { code: "INVALID_QUERY", message: "Enter at least 2 characters to search." } });
    return;
  }
  if (provider === "sec_edgar" && !process.env.SEC_EDGAR_USER_AGENT?.trim()) {
    res.status(503).json({
      error: {
        code: "PROVIDER_NOT_CONFIGURED",
        message: "SEC EDGAR access needs SEC_EDGAR_USER_AGENT configured as an application name and contact email.",
      },
    });
    return;
  }

  try {
    const results = provider === "propublica"
      ? await lookupProPublica(query)
      : await lookupSecEdgar(query, process.env.SEC_EDGAR_USER_AGENT?.trim() ?? "");
    res.json({ provider, query, searchedAt: new Date().toISOString(), results });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The public source lookup failed.";
    const notConfigured = provider === "sec_edgar" && !process.env.SEC_EDGAR_USER_AGENT?.trim();
    res.status(notConfigured ? 503 : 502).json({
      error: {
        code: notConfigured ? "PROVIDER_NOT_CONFIGURED" : "PUBLIC_SOURCE_UNAVAILABLE",
        message: notConfigured
          ? "SEC EDGAR access needs SEC_EDGAR_USER_AGENT configured as an application name and contact email."
          : message,
      },
    });
  }
});

router.post("/lookup-person", requirePermission("edit:constituents"), async (req, res) => {
  const { organizationId, userId } = await requestContext(req);
  const constituentId = text(req.body?.constituentId, 191);
  const permissionConfirmed = req.body?.permissionConfirmed === true;
  const wealthEngine = getWealthEngineConfiguration();
  const apiKey = process.env.WEALTHENGINE_API_KEY?.trim() ?? "";

  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "A signed-in organization user is required." } });
    return;
  }
  if (!wealthEngine.configured || !apiKey) {
    res.status(503).json({
      error: {
        code: "PROVIDER_NOT_CONFIGURED",
        message: "Individual screening needs a licensed WEALTHENGINE_API_KEY. Use the sandbox base URL only for synthetic workflow tests.",
      },
    });
    return;
  }
  if (!permissionConfirmed) {
    res.status(400).json({
      error: {
        code: "SCREENING_AUTHORIZATION_REQUIRED",
        message: "Confirm that you are authorized to send this constituent's identity to the configured screening provider.",
      },
    });
    return;
  }
  if (!constituentId) {
    res.status(400).json({ error: { code: "CONSTITUENT_REQUIRED", message: "Choose an individual constituent to screen." } });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: constituentId, organizationId },
    select: {
      id: true,
      entityKind: true,
      firstName: true,
      lastName: true,
      email: true,
      addressLine1: true,
      city: true,
      state: true,
      zip: true,
    },
  });
  if (!constituent) {
    res.status(404).json({ error: { code: "CONSTITUENT_NOT_FOUND", message: "The selected constituent was not found in this organization." } });
    return;
  }
  if (constituent.entityKind === "ORGANIZATION") {
    res.status(400).json({ error: { code: "INDIVIDUAL_REQUIRED", message: "WealthEngine screening is available for individual constituent records, not organization records." } });
    return;
  }

  try {
    const results = await lookupWealthEnginePerson(constituent, apiKey, wealthEngine);
    const signedResults = results.map((result) => ({
      ...result,
      evidenceToken: signLicensedEvidence({
        organizationId,
        constituentId,
        expiresAt: Date.now() + 15 * 60_000,
        result,
      }),
    }));
    await logAudit({
      action: "DONOR_RESEARCH_PERSON_SCREENED",
      entity: "Constituent",
      entityId: constituentId,
      userId,
      organizationId,
      metadata: {
        provider: "wealthengine",
        mode: wealthEngine.mode,
        resultCount: results.length,
        matchRoute: constituent.addressLine1 && constituent.city && constituent.state && constituent.zip ? "address" : "email",
      },
      ipAddress: req.ip,
      userAgent: req.get("user-agent"),
    });
    res.json({
      provider: "wealthengine",
      mode: wealthEngine.mode,
      searchedAt: new Date().toISOString(),
      results: signedResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The licensed individual screening lookup failed.";
    const invalidProfile = message.startsWith("The constituent") || message.startsWith("Add either");
    res.status(invalidProfile ? 400 : 502).json({
      error: { code: invalidProfile ? "SCREENING_PROFILE_INCOMPLETE" : "LICENSED_SOURCE_UNAVAILABLE", message },
    });
  }
});

router.get("/findings", requirePermission("view:constituents"), async (req, res) => {
  const { organizationId } = await requestContext(req);
  const constituentId = text(req.query.constituentId, 191);
  if (!organizationId || !constituentId) {
    res.status(400).json({ error: { code: "MISSING_SCOPE", message: "Choose a constituent before loading research findings." } });
    return;
  }

  const findings = await prisma.donorResearchFinding.findMany({
    where: { organizationId, constituentId },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });
  res.json({ findings });
});

router.post("/findings", requirePermission("edit:constituents"), async (req, res) => {
  const { organizationId, userId } = await requestContext(req);
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "AUTH_REQUIRED", message: "A signed-in organization user is required." } });
    return;
  }

  const constituentId = text(req.body?.constituentId, 191);
  let provider = text(req.body?.provider, 40) as PublicResearchProvider;
  let sourceUrl = text(req.body?.sourceUrl, 1000);
  let sourceRecordId = text(req.body?.sourceRecordId, 120) || null;
  let signalType = text(req.body?.signalType, 60);
  let title = text(req.body?.title, 255);
  let summary = text(req.body?.summary, 8_000);
  let disclosedAmount = optionalAmount(req.body?.disclosedAmount);
  let disclosedAmountLabel = text(req.body?.disclosedAmountLabel, 120) || null;
  let sourcePublishedAt = optionalDate(req.body?.sourcePublishedAt);
  const matchConfidence = text(req.body?.matchConfidence, 20).toUpperCase() || "LOW";
  const matchRationale = text(req.body?.matchRationale, 4_000);

  if (provider === "wealthengine") {
    const evidence = verifyLicensedEvidence(text(req.body?.evidenceToken, 20_000));
    if (!evidence || evidence.organizationId !== organizationId || evidence.constituentId !== constituentId || evidence.result.synthetic) {
      res.status(400).json({
        error: {
          code: "LICENSED_EVIDENCE_INVALID",
          message: "This licensed screening result is synthetic, expired, modified, or belongs to another constituent. Run the screening again.",
        },
      });
      return;
    }
    provider = evidence.result.provider;
    sourceUrl = evidence.result.sourceUrl;
    sourceRecordId = evidence.result.sourceRecordId || null;
    signalType = evidence.result.signalType;
    title = evidence.result.title;
    summary = evidence.result.summary;
    disclosedAmount = evidence.result.disclosedAmount;
    disclosedAmountLabel = evidence.result.disclosedAmountLabel;
    sourcePublishedAt = optionalDate(evidence.result.sourcePublishedAt);
  }

  if (!constituentId || !PROVIDERS.has(provider) || !isAllowedSourceUrl(provider, sourceUrl) || !SIGNAL_TYPES.has(signalType) || !title || !summary) {
    res.status(400).json({ error: { code: "INVALID_FINDING", message: "The finding is missing valid source provenance or required evidence fields." } });
    return;
  }
  if (!CONFIDENCE_LEVELS.has(matchConfidence) || matchRationale.length < 12) {
    res.status(400).json({ error: { code: "MATCH_REVIEW_REQUIRED", message: "Record a confidence level and a specific match rationale before saving." } });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: constituentId, organizationId },
    select: { id: true },
  });
  if (!constituent) {
    res.status(404).json({ error: { code: "CONSTITUENT_NOT_FOUND", message: "The selected constituent was not found in this organization." } });
    return;
  }

  const finding = await prisma.donorResearchFinding.create({
    data: {
      organizationId,
      constituentId,
      provider,
      sourceRecordId,
      sourceUrl,
      signalType,
      title,
      summary,
      disclosedAmount,
      disclosedAmountLabel,
      sourcePublishedAt,
      matchConfidence,
      matchRationale,
      status: "UNVERIFIED",
      createdByUserId: userId,
    },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await logAudit({
    action: "DONOR_RESEARCH_FINDING_CREATED",
    entity: "DonorResearchFinding",
    entityId: finding.id,
    userId,
    organizationId,
    metadata: { constituentId, provider, sourceRecordId, status: "UNVERIFIED" },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
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
  const findingId = text(req.params.id, 191);

  const existing = await prisma.donorResearchFinding.findFirst({
    where: { id: findingId, organizationId },
    select: { id: true, constituentId: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "FINDING_NOT_FOUND", message: "Research finding not found." } });
    return;
  }

  const finding = await prisma.donorResearchFinding.update({
    where: { id: existing.id },
    data: status === "UNVERIFIED"
      ? { status, reviewNotes, reviewedAt: null, reviewedByUserId: null }
      : { status, reviewNotes, reviewedAt: new Date(), reviewedByUserId: userId },
    include: {
      createdBy: { select: { id: true, firstName: true, lastName: true } },
      reviewedBy: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  await logAudit({
    action: "DONOR_RESEARCH_FINDING_REVIEWED",
    entity: "DonorResearchFinding",
    entityId: finding.id,
    userId,
    organizationId,
    metadata: { constituentId: existing.constituentId, status },
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
  });
  res.json({ finding });
});

export default router;
