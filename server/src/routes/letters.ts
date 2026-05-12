/**
 * Donor CRM Letters & Printables API routes.
 * Provides template management, merge preview, generated letters, and email-draft integration.
 */
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { hasDefaultPermission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { collectMergeFieldKeys, renderMergeFields, SUPPORTED_LETTER_MERGE_FIELDS, unsupportedMergeFieldKeys } from "../services/letters-merge.js";

const router = Router();

const LETTER_CATEGORIES = [
  "THANK_YOU",
  "TAX_RECEIPT",
  "END_OF_YEAR",
  "NEWSLETTER",
  "CAMPAIGN",
  "SPONSOR",
  "EVENT",
  "MONTHLY_DONOR",
  "MAJOR_DONOR",
  "GENERAL",
] as const;

const LETTER_TEMPLATE_STATUSES = ["DRAFT", "ACTIVE", "ARCHIVED"] as const;
const LETTER_GENERATED_STATUSES = ["DRAFT", "GENERATED", "PRINTED", "MAILED", "EMAIL_DRAFT_CREATED", "EMAIL_SENT", "ARCHIVED"] as const;
const LETTER_LOGO_MODES = ["ORGANIZATION_DEFAULT", "CUSTOM", "NONE"] as const;
const LETTER_CRM_SCOPES = ["DONOR", "EVENTS", "COMPASSION", "GLOBAL"] as const;
const LETTER_ALIGNMENT = ["LEFT", "CENTER", "RIGHT", "NONE"] as const;

router.use(requireAuth);

/** Validates and returns the active organization context for one request. */
async function requireOrganizationId(req: Parameters<typeof resolveOrganizationId>[0]["req"]): Promise<string | null> {
  const organizationId = await resolveOrganizationId({ req });
  return organizationId || null;
}

/** Parses one enum-like input value against an allowed literal list. */
function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return allowed.includes(normalized as T) ? (normalized as T) : null;
}

/** Converts unknown JSON input to a safe record for Prisma JSON storage. */
function asJsonObject(value: unknown): Prisma.InputJsonValue | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Prisma.InputJsonValue;
}

/** Parses a positive integer value with fallback and min/max bounds. */
function parsePositiveInt(value: unknown, fallback: number, min = 1, max = 500): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Converts a decimal-ish Prisma value into a number safely. */
function toNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  if (value && typeof value === "object" && "toString" in (value as Record<string, unknown>)) {
    const parsed = Number.parseFloat((value as { toString(): string }).toString());
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

/** Formats currency values for merged donor-facing content. */
function formatCurrency(value: unknown): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(toNumber(value));
}

/** Formats dates for merged donor-facing content. */
function formatDate(value: Date | null | undefined): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric" }).format(value);
}

/** Converts line-break text into simple HTML paragraphs for email draft creation. */
function textToHtml(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br />");
}

/** Evaluates one permission key with explicit user override support. */
async function hasPermission(req: { user?: { sub?: string; role?: string } }, permission: "letters.view_sensitive_merge_data"): Promise<boolean> {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId || !role) return false;

  const override = await prisma.userPermission.findUnique({
    where: {
      userId_permission: {
        userId,
        permission,
      },
    },
    select: { granted: true },
  });

  if (override && !override.granted) return false;
  if (override && override.granted) return true;
  return hasDefaultPermission(role, permission);
}

interface MergeContextParams {
  organizationId: string;
  template: {
    id: string;
    printBody: string;
    emailBody: string | null;
    printSubject: string | null;
    emailSubject: string | null;
  };
  constituentId?: string;
  donationId?: string;
  campaignId?: string;
  eventId?: string;
  year?: number;
  actorUserId?: string;
}

/** Loads merge context and resolves all placeholders used by letters. */
async function resolveMergeContext(params: MergeContextParams): Promise<{
  values: Record<string, string>;
  unsupportedFields: string[];
  mergedPrintBody: string;
  mergedEmailBody: string | null;
  mergedPrintSubject: string | null;
  mergedEmailSubject: string | null;
  resolvedConstituentId: string | null;
  resolvedDonationId: string | null;
  resolvedCampaignId: string | null;
  resolvedEventId: string | null;
}> {
  const [organization, settings, user] = await Promise.all([
    prisma.organization.findUnique({ where: { id: params.organizationId }, select: { id: true, name: true } }),
    prisma.organizationSettings.findUnique({
      where: { organizationId: params.organizationId },
      select: { smtpFromEmail: true, smtpFromName: true },
    }),
    params.actorUserId
      ? prisma.user.findUnique({ where: { id: params.actorUserId }, select: { id: true, firstName: true, lastName: true, email: true, role: true } })
      : Promise.resolve(null),
  ]);

  const donation = params.donationId
    ? await prisma.donation.findFirst({
        where: {
          id: params.donationId,
          constituent: { organizationId: params.organizationId },
        },
        include: {
          campaign: { select: { id: true, name: true } },
          designation: { select: { name: true } },
          constituent: { select: { id: true } },
          event: { select: { id: true, name: true } },
        },
      })
    : null;

  const resolvedConstituentId = params.constituentId ?? donation?.constituentId ?? null;

  const constituent = resolvedConstituentId
    ? await prisma.constituent.findFirst({
        where: { id: resolvedConstituentId, organizationId: params.organizationId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          zip: true,
        },
      })
    : null;

  const resolvedCampaignId = params.campaignId ?? donation?.campaignId ?? null;
  const campaign = resolvedCampaignId
    ? await prisma.campaign.findFirst({
        where: { id: resolvedCampaignId, organizationId: params.organizationId },
        select: { id: true, name: true },
      })
    : null;

  const resolvedEventId = params.eventId ?? donation?.eventId ?? null;
  const event = resolvedEventId
    ? await prisma.event.findFirst({
        where: { id: resolvedEventId, organizationId: params.organizationId },
        select: { id: true, name: true },
      })
    : null;

  const targetYear = Math.max(2000, Math.min(3000, params.year ?? new Date().getFullYear()));
  const yearStart = new Date(`${targetYear}-01-01T00:00:00.000Z`);
  const yearEnd = new Date(`${targetYear}-12-31T23:59:59.999Z`);

  const yearDonations = constituent
    ? await prisma.donation.findMany({
        where: {
          constituentId: constituent.id,
          date: { gte: yearStart, lte: yearEnd },
          status: "COMPLETED",
        },
        select: { amount: true, date: true },
        orderBy: { date: "asc" },
      })
    : [];

  const yearTotal = yearDonations.reduce((sum, donationRow) => sum + toNumber(donationRow.amount), 0);
  const firstGift = yearDonations[0]?.date ?? null;
  const lastGift = yearDonations[yearDonations.length - 1]?.date ?? null;

  const donorFullName = constituent ? `${constituent.firstName} ${constituent.lastName}`.trim() : "";

  const values: Record<string, string> = {
    "donor.firstName": constituent?.firstName ?? "",
    "donor.lastName": constituent?.lastName ?? "",
    "donor.fullName": donorFullName,
    "donor.preferredName": constituent?.firstName ?? "",
    "donor.email": constituent?.email ?? "",
    "donor.phone": constituent?.phone ?? "",
    "donor.addressLine1": constituent?.addressLine1 ?? "",
    "donor.addressLine2": constituent?.addressLine2 ?? "",
    "donor.city": constituent?.city ?? "",
    "donor.state": constituent?.state ?? "",
    "donor.zip": constituent?.zip ?? "",
    "donor.salutation": constituent?.firstName ? `Dear ${constituent.firstName},` : "Dear Friend,",
    "gift.amount": formatCurrency(donation?.amount ?? 0),
    "gift.date": formatDate(donation?.date),
    "gift.fund": donation?.designation?.name ?? "",
    "gift.campaign": campaign?.name ?? donation?.campaign?.name ?? "",
    "gift.paymentMethod": donation?.paymentMethod ? donation.paymentMethod.replaceAll("_", " ") : "",
    "gift.receiptNumber": donation?.receiptNumber ?? "",
    "gift.taxDeductibleAmount": formatCurrency(donation?.taxDeductible ? donation.amount : 0),
    "year": String(targetYear),
    "year.totalGiving": formatCurrency(yearTotal),
    "year.firstGiftDate": formatDate(firstGift),
    "year.lastGiftDate": formatDate(lastGift),
    "year.numberOfGifts": String(yearDonations.length),
    "organization.name": organization?.name ?? "",
    "organization.address": "",
    "organization.phone": "",
    "organization.email": settings?.smtpFromEmail ?? "",
    "organization.website": "",
    "organization.taxId": "",
    "staff.fullName": user ? `${user.firstName} ${user.lastName}`.trim() : "",
    "staff.title": user?.role ? user.role.toUpperCase() : "",
    "staff.email": user?.email ?? "",
  };

  const mergedPrintBody = renderMergeFields(params.template.printBody, values);
  const mergedEmailBody = params.template.emailBody ? renderMergeFields(params.template.emailBody, values) : null;
  const mergedPrintSubject = params.template.printSubject ? renderMergeFields(params.template.printSubject, values) : null;
  const mergedEmailSubject = params.template.emailSubject ? renderMergeFields(params.template.emailSubject, values) : null;

  const keys = collectMergeFieldKeys(
    params.template.printBody,
    params.template.emailBody,
    params.template.printSubject,
    params.template.emailSubject,
  );

  return {
    values,
    unsupportedFields: unsupportedMergeFieldKeys(keys),
    mergedPrintBody,
    mergedEmailBody,
    mergedPrintSubject,
    mergedEmailSubject,
    resolvedConstituentId: constituent?.id ?? null,
    resolvedDonationId: donation?.id ?? null,
    resolvedCampaignId: campaign?.id ?? null,
    resolvedEventId: event?.id ?? null,
  };
}

/** GET /api/letters/dashboard — Returns letter workspace summary cards. */
router.get("/dashboard", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [activeTemplates, generatedThisMonth, thankYouPending, taxReceiptsGenerated, emailDrafts, recentlyUsed] = await Promise.all([
    prisma.letterTemplate.count({ where: { organizationId, status: "ACTIVE" } }),
    prisma.generatedLetter.count({ where: { organizationId, generatedAt: { gte: monthStart } } }),
    prisma.generatedLetter.count({ where: { organizationId, category: "THANK_YOU", status: { in: ["GENERATED", "PRINTED"] } } }),
    prisma.generatedLetter.count({ where: { organizationId, category: "TAX_RECEIPT" } }),
    prisma.generatedLetter.count({ where: { organizationId, status: "EMAIL_DRAFT_CREATED" } }),
    prisma.letterTemplate.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      select: { id: true, name: true, category: true, status: true, updatedAt: true },
    }),
  ]);

  res.json({
    activeTemplates,
    generatedThisMonth,
    thankYouPending,
    taxReceiptsGenerated,
    emailDrafts,
    recentlyUsedTemplates: recentlyUsed,
    batchGenerationStatus: "PARTIAL",
    pdfExportStatus: "PARTIAL",
  });
});

/** GET /api/letters/merge-fields — Returns merge field catalog and sensitivity flags. */
router.get("/merge-fields", requirePermission("letters.view"), async (req, res) => {
  const canViewSensitive = await hasPermission(req, "letters.view_sensitive_merge_data");
  const sections = [
    {
      key: "donor",
      label: "Donor Fields",
      sensitive: false,
      fields: SUPPORTED_LETTER_MERGE_FIELDS.filter((field) => field.startsWith("{{donor.")),
    },
    {
      key: "gift",
      label: "Gift Fields",
      sensitive: true,
      fields: SUPPORTED_LETTER_MERGE_FIELDS.filter((field) => field.startsWith("{{gift.")),
    },
    {
      key: "year",
      label: "Year-End Fields",
      sensitive: true,
      fields: SUPPORTED_LETTER_MERGE_FIELDS.filter((field) => field.startsWith("{{year")),
    },
    {
      key: "organization",
      label: "Organization Fields",
      sensitive: false,
      fields: SUPPORTED_LETTER_MERGE_FIELDS.filter((field) => field.startsWith("{{organization.")),
    },
    {
      key: "staff",
      label: "Staff Fields",
      sensitive: false,
      fields: SUPPORTED_LETTER_MERGE_FIELDS.filter((field) => field.startsWith("{{staff.")),
    },
  ];

  res.json({
    sections: sections.filter((section) => (section.sensitive ? canViewSensitive : true)),
    canViewSensitive,
  });
});

/** GET /api/letters/templates — Lists letter templates for the active organization. */
router.get("/templates", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const status = parseEnum(req.query.status, LETTER_TEMPLATE_STATUSES);
  const category = parseEnum(req.query.category, LETTER_CATEGORIES);
  const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

  const templates = await prisma.letterTemplate.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(search ? { name: { contains: search } } : {}),
    },
    include: {
      headerPreset: { select: { id: true, name: true } },
      footerPreset: { select: { id: true, name: true } },
      signatureBlock: { select: { id: true, name: true, signerName: true } },
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      _count: { select: { generatedLetters: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  res.json(templates);
});

/** GET /api/letters/templates/:id — Returns one template with preset references. */
router.get("/templates/:id", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const template = await prisma.letterTemplate.findFirst({
    where: { id: req.params.id, organizationId },
    include: {
      headerPreset: true,
      footerPreset: true,
      signatureBlock: true,
      createdBy: { select: { id: true, firstName: true, lastName: true, email: true } },
      updatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  res.json(template);
});

/** POST /api/letters/templates — Creates a new letter template. */
router.post("/templates", requirePermission("letters.create"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: { code: "NAME_REQUIRED", message: "Template name is required." } });
    return;
  }

  const category = parseEnum(req.body?.category, LETTER_CATEGORIES) ?? "GENERAL";
  const status = parseEnum(req.body?.status, LETTER_TEMPLATE_STATUSES) ?? "DRAFT";
  const logoMode = parseEnum(req.body?.logoMode, LETTER_LOGO_MODES) ?? "ORGANIZATION_DEFAULT";
  const crmScope = parseEnum(req.body?.crmScope, LETTER_CRM_SCOPES) ?? "DONOR";

  const printBody = typeof req.body?.printBody === "string" ? req.body.printBody : "";
  if (!printBody.trim()) {
    res.status(400).json({ error: { code: "PRINT_BODY_REQUIRED", message: "Print body is required." } });
    return;
  }

  const mergeKeys = collectMergeFieldKeys(
    req.body?.printBody,
    req.body?.emailBody,
    req.body?.printSubject,
    req.body?.emailSubject,
  );

  const created = await prisma.letterTemplate.create({
    data: {
      organizationId,
      name,
      category,
      description: typeof req.body?.description === "string" ? req.body.description.trim() || null : null,
      status,
      printSubject: typeof req.body?.printSubject === "string" ? req.body.printSubject : null,
      printBody,
      emailSubject: typeof req.body?.emailSubject === "string" ? req.body.emailSubject : null,
      emailBody: typeof req.body?.emailBody === "string" ? req.body.emailBody : null,
      headerPresetId: typeof req.body?.headerPresetId === "string" ? req.body.headerPresetId : null,
      footerPresetId: typeof req.body?.footerPresetId === "string" ? req.body.footerPresetId : null,
      signatureBlockId: typeof req.body?.signatureBlockId === "string" ? req.body.signatureBlockId : null,
      logoMode,
      customLogoUrl: typeof req.body?.customLogoUrl === "string" ? req.body.customLogoUrl : null,
      mergeFieldsUsed: mergeKeys,
      crmScope,
      createdByUserId: userId,
      updatedByUserId: userId,
    },
  });

  await logAudit({
    action: "LETTER_TEMPLATE_CREATED",
    entity: "LetterTemplate",
    entityId: created.id,
    organizationId,
    userId,
    metadata: {
      category: created.category,
      status: created.status,
    },
  });

  res.status(201).json(created);
});

/** PATCH /api/letters/templates/:id — Updates template fields and merge metadata. */
router.patch("/templates/:id", requirePermission("letters.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterTemplate.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  const patch: Prisma.LetterTemplateUpdateInput = {
    updatedBy: { connect: { id: userId } },
  };

  if (typeof req.body?.name === "string") {
    const nextName = req.body.name.trim();
    if (!nextName) {
      res.status(400).json({ error: { code: "INVALID_NAME", message: "Template name cannot be blank." } });
      return;
    }
    patch.name = nextName;
  }
  if (typeof req.body?.description === "string") patch.description = req.body.description.trim() || null;

  const category = parseEnum(req.body?.category, LETTER_CATEGORIES);
  if (req.body?.category !== undefined && !category) {
    res.status(400).json({ error: { code: "INVALID_CATEGORY", message: "Invalid category." } });
    return;
  }
  if (category) patch.category = category;

  const status = parseEnum(req.body?.status, LETTER_TEMPLATE_STATUSES);
  if (req.body?.status !== undefined && !status) {
    res.status(400).json({ error: { code: "INVALID_STATUS", message: "Invalid template status." } });
    return;
  }
  if (status) patch.status = status;

  const logoMode = parseEnum(req.body?.logoMode, LETTER_LOGO_MODES);
  if (req.body?.logoMode !== undefined && !logoMode) {
    res.status(400).json({ error: { code: "INVALID_LOGO_MODE", message: "Invalid logo mode." } });
    return;
  }
  if (logoMode) patch.logoMode = logoMode;

  const crmScope = parseEnum(req.body?.crmScope, LETTER_CRM_SCOPES);
  if (req.body?.crmScope !== undefined && !crmScope) {
    res.status(400).json({ error: { code: "INVALID_CRM_SCOPE", message: "Invalid crmScope." } });
    return;
  }
  if (crmScope) patch.crmScope = crmScope;

  if (req.body?.printSubject !== undefined) patch.printSubject = typeof req.body.printSubject === "string" ? req.body.printSubject : null;
  if (req.body?.printBody !== undefined) {
    if (typeof req.body.printBody !== "string" || !req.body.printBody.trim()) {
      res.status(400).json({ error: { code: "INVALID_PRINT_BODY", message: "Print body cannot be empty." } });
      return;
    }
    patch.printBody = req.body.printBody;
  }
  if (req.body?.emailSubject !== undefined) patch.emailSubject = typeof req.body.emailSubject === "string" ? req.body.emailSubject : null;
  if (req.body?.emailBody !== undefined) patch.emailBody = typeof req.body.emailBody === "string" ? req.body.emailBody : null;

  if (req.body?.customLogoUrl !== undefined) patch.customLogoUrl = typeof req.body.customLogoUrl === "string" ? req.body.customLogoUrl : null;

  if (req.body?.headerPresetId !== undefined) {
    patch.headerPreset = typeof req.body.headerPresetId === "string" && req.body.headerPresetId
      ? { connect: { id: req.body.headerPresetId } }
      : { disconnect: true };
  }
  if (req.body?.footerPresetId !== undefined) {
    patch.footerPreset = typeof req.body.footerPresetId === "string" && req.body.footerPresetId
      ? { connect: { id: req.body.footerPresetId } }
      : { disconnect: true };
  }
  if (req.body?.signatureBlockId !== undefined) {
    patch.signatureBlock = typeof req.body.signatureBlockId === "string" && req.body.signatureBlockId
      ? { connect: { id: req.body.signatureBlockId } }
      : { disconnect: true };
  }

  const nextPrintBody = typeof req.body?.printBody === "string" ? req.body.printBody : existing.printBody;
  const nextEmailBody = req.body?.emailBody !== undefined ? (typeof req.body.emailBody === "string" ? req.body.emailBody : null) : existing.emailBody;
  const nextPrintSubject = req.body?.printSubject !== undefined ? (typeof req.body.printSubject === "string" ? req.body.printSubject : null) : existing.printSubject;
  const nextEmailSubject = req.body?.emailSubject !== undefined ? (typeof req.body.emailSubject === "string" ? req.body.emailSubject : null) : existing.emailSubject;

  patch.mergeFieldsUsed = collectMergeFieldKeys(nextPrintBody, nextEmailBody, nextPrintSubject, nextEmailSubject);

  const updated = await prisma.letterTemplate.update({
    where: { id: existing.id },
    data: patch,
  });

  await logAudit({
    action: "LETTER_TEMPLATE_UPDATED",
    entity: "LetterTemplate",
    entityId: updated.id,
    organizationId,
    userId,
    metadata: {
      previousStatus: existing.status,
      nextStatus: updated.status,
      previousCategory: existing.category,
      nextCategory: updated.category,
    },
  });

  res.json(updated);
});

/** POST /api/letters/templates/:id/duplicate — Clones one template into a new draft. */
router.post("/templates/:id/duplicate", requirePermission("letters.create"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterTemplate.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  const copy = await prisma.letterTemplate.create({
    data: {
      organizationId,
      name: `${existing.name} (Copy)`,
      category: existing.category,
      description: existing.description,
      status: "DRAFT",
      printSubject: existing.printSubject,
      printBody: existing.printBody,
      emailSubject: existing.emailSubject,
      emailBody: existing.emailBody,
      headerPresetId: existing.headerPresetId,
      footerPresetId: existing.footerPresetId,
      signatureBlockId: existing.signatureBlockId,
      logoMode: existing.logoMode,
      customLogoUrl: existing.customLogoUrl,
      mergeFieldsUsed: existing.mergeFieldsUsed,
      crmScope: existing.crmScope,
      createdByUserId: userId,
      updatedByUserId: userId,
    },
  });

  await logAudit({
    action: "LETTER_TEMPLATE_DUPLICATED",
    entity: "LetterTemplate",
    entityId: copy.id,
    organizationId,
    userId,
    metadata: { sourceTemplateId: existing.id },
  });

  res.status(201).json(copy);
});

/** DELETE /api/letters/templates/:id — Archives one template. */
router.delete("/templates/:id", requirePermission("letters.archive"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterTemplate.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  await prisma.letterTemplate.update({
    where: { id: existing.id },
    data: { status: "ARCHIVED", updatedByUserId: userId },
  });

  await logAudit({
    action: "LETTER_TEMPLATE_ARCHIVED",
    entity: "LetterTemplate",
    entityId: existing.id,
    organizationId,
    userId,
  });

  res.status(204).send();
});

/** GET /api/letters/header-presets — Lists header presets. */
router.get("/header-presets", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const presets = await prisma.letterHeaderPreset.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

  res.json(presets);
});

/** POST /api/letters/header-presets — Creates a header preset. */
router.post("/header-presets", requirePermission("letters.manage_branding"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: { code: "NAME_REQUIRED", message: "Header preset name is required." } });
    return;
  }

  const logoAlignment = parseEnum(req.body?.logoAlignment, LETTER_ALIGNMENT) ?? "LEFT";
  const preset = await prisma.letterHeaderPreset.create({
    data: {
      organizationId,
      name,
      logoAlignment,
      showOrganizationName: req.body?.showOrganizationName !== false,
      showTagline: req.body?.showTagline === true,
      showAddress: req.body?.showAddress !== false,
      showPhone: req.body?.showPhone !== false,
      showWebsite: req.body?.showWebsite !== false,
      customHtml: typeof req.body?.customHtml === "string" ? req.body.customHtml : null,
      isDefault: req.body?.isDefault === true,
      isActive: req.body?.isActive !== false,
    },
  });

  if (preset.isDefault) {
    await prisma.letterHeaderPreset.updateMany({
      where: { organizationId, id: { not: preset.id } },
      data: { isDefault: false },
    });
  }

  await logAudit({ action: "LETTER_HEADER_PRESET_CREATED", entity: "LetterHeaderPreset", entityId: preset.id, organizationId, userId });
  res.status(201).json(preset);
});

/** PATCH /api/letters/header-presets/:id — Updates one header preset. */
router.patch("/header-presets/:id", requirePermission("letters.manage_branding"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterHeaderPreset.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Header preset not found." } });
    return;
  }

  const patch: Prisma.LetterHeaderPresetUpdateInput = {};
  if (typeof req.body?.name === "string") {
    const nextName = req.body.name.trim();
    if (!nextName) {
      res.status(400).json({ error: { code: "INVALID_NAME", message: "Header preset name cannot be blank." } });
      return;
    }
    patch.name = nextName;
  }

  const logoAlignment = parseEnum(req.body?.logoAlignment, LETTER_ALIGNMENT);
  if (req.body?.logoAlignment !== undefined && !logoAlignment) {
    res.status(400).json({ error: { code: "INVALID_ALIGNMENT", message: "Invalid logo alignment." } });
    return;
  }
  if (logoAlignment) patch.logoAlignment = logoAlignment;

  if (typeof req.body?.showOrganizationName === "boolean") patch.showOrganizationName = req.body.showOrganizationName;
  if (typeof req.body?.showTagline === "boolean") patch.showTagline = req.body.showTagline;
  if (typeof req.body?.showAddress === "boolean") patch.showAddress = req.body.showAddress;
  if (typeof req.body?.showPhone === "boolean") patch.showPhone = req.body.showPhone;
  if (typeof req.body?.showWebsite === "boolean") patch.showWebsite = req.body.showWebsite;
  if (req.body?.customHtml !== undefined) patch.customHtml = typeof req.body.customHtml === "string" ? req.body.customHtml : null;
  if (typeof req.body?.isDefault === "boolean") patch.isDefault = req.body.isDefault;
  if (typeof req.body?.isActive === "boolean") patch.isActive = req.body.isActive;

  const updated = await prisma.letterHeaderPreset.update({ where: { id: existing.id }, data: patch });
  if (updated.isDefault) {
    await prisma.letterHeaderPreset.updateMany({
      where: { organizationId, id: { not: updated.id } },
      data: { isDefault: false },
    });
  }

  await logAudit({ action: "LETTER_HEADER_PRESET_UPDATED", entity: "LetterHeaderPreset", entityId: updated.id, organizationId, userId });
  res.json(updated);
});

/** DELETE /api/letters/header-presets/:id — Deletes one unused header preset. */
router.delete("/header-presets/:id", requirePermission("letters.manage_branding"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterHeaderPreset.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Header preset not found." } });
    return;
  }

  const usageCount = await prisma.letterTemplate.count({ where: { organizationId, headerPresetId: existing.id } });
  if (usageCount > 0) {
    res.status(409).json({ error: { code: "PRESET_IN_USE", message: "Header preset is in use by one or more templates." } });
    return;
  }

  await prisma.letterHeaderPreset.delete({ where: { id: existing.id } });
  await logAudit({ action: "LETTER_HEADER_PRESET_DELETED", entity: "LetterHeaderPreset", entityId: existing.id, organizationId, userId });
  res.status(204).send();
});

/** GET /api/letters/footer-presets — Lists footer presets. */
router.get("/footer-presets", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }
  const presets = await prisma.letterFooterPreset.findMany({ where: { organizationId }, orderBy: [{ isDefault: "desc" }, { name: "asc" }] });
  res.json(presets);
});

/** POST /api/letters/footer-presets — Creates a footer preset. */
router.post("/footer-presets", requirePermission("letters.manage_branding"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  if (!name) {
    res.status(400).json({ error: { code: "NAME_REQUIRED", message: "Footer preset name is required." } });
    return;
  }

  const preset = await prisma.letterFooterPreset.create({
    data: {
      organizationId,
      name,
      showOrganizationName: req.body?.showOrganizationName !== false,
      showAddress: req.body?.showAddress !== false,
      showPhone: req.body?.showPhone !== false,
      showEmail: req.body?.showEmail !== false,
      showWebsite: req.body?.showWebsite !== false,
      showTaxId: req.body?.showTaxId === true,
      showPageNumber: req.body?.showPageNumber === true,
      customText: typeof req.body?.customText === "string" ? req.body.customText : null,
      customHtml: typeof req.body?.customHtml === "string" ? req.body.customHtml : null,
      isDefault: req.body?.isDefault === true,
      isActive: req.body?.isActive !== false,
    },
  });

  if (preset.isDefault) {
    await prisma.letterFooterPreset.updateMany({
      where: { organizationId, id: { not: preset.id } },
      data: { isDefault: false },
    });
  }

  await logAudit({ action: "LETTER_FOOTER_PRESET_CREATED", entity: "LetterFooterPreset", entityId: preset.id, organizationId, userId });
  res.status(201).json(preset);
});

/** PATCH /api/letters/footer-presets/:id — Updates one footer preset. */
router.patch("/footer-presets/:id", requirePermission("letters.manage_branding"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterFooterPreset.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Footer preset not found." } });
    return;
  }

  const patch: Prisma.LetterFooterPresetUpdateInput = {};
  if (typeof req.body?.name === "string") {
    const nextName = req.body.name.trim();
    if (!nextName) {
      res.status(400).json({ error: { code: "INVALID_NAME", message: "Footer preset name cannot be blank." } });
      return;
    }
    patch.name = nextName;
  }
  if (typeof req.body?.showOrganizationName === "boolean") patch.showOrganizationName = req.body.showOrganizationName;
  if (typeof req.body?.showAddress === "boolean") patch.showAddress = req.body.showAddress;
  if (typeof req.body?.showPhone === "boolean") patch.showPhone = req.body.showPhone;
  if (typeof req.body?.showEmail === "boolean") patch.showEmail = req.body.showEmail;
  if (typeof req.body?.showWebsite === "boolean") patch.showWebsite = req.body.showWebsite;
  if (typeof req.body?.showTaxId === "boolean") patch.showTaxId = req.body.showTaxId;
  if (typeof req.body?.showPageNumber === "boolean") patch.showPageNumber = req.body.showPageNumber;
  if (req.body?.customText !== undefined) patch.customText = typeof req.body.customText === "string" ? req.body.customText : null;
  if (req.body?.customHtml !== undefined) patch.customHtml = typeof req.body.customHtml === "string" ? req.body.customHtml : null;
  if (typeof req.body?.isDefault === "boolean") patch.isDefault = req.body.isDefault;
  if (typeof req.body?.isActive === "boolean") patch.isActive = req.body.isActive;

  const updated = await prisma.letterFooterPreset.update({ where: { id: existing.id }, data: patch });
  if (updated.isDefault) {
    await prisma.letterFooterPreset.updateMany({
      where: { organizationId, id: { not: updated.id } },
      data: { isDefault: false },
    });
  }

  await logAudit({ action: "LETTER_FOOTER_PRESET_UPDATED", entity: "LetterFooterPreset", entityId: updated.id, organizationId, userId });
  res.json(updated);
});

/** DELETE /api/letters/footer-presets/:id — Deletes one unused footer preset. */
router.delete("/footer-presets/:id", requirePermission("letters.manage_branding"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterFooterPreset.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Footer preset not found." } });
    return;
  }

  const usageCount = await prisma.letterTemplate.count({ where: { organizationId, footerPresetId: existing.id } });
  if (usageCount > 0) {
    res.status(409).json({ error: { code: "PRESET_IN_USE", message: "Footer preset is in use by one or more templates." } });
    return;
  }

  await prisma.letterFooterPreset.delete({ where: { id: existing.id } });
  await logAudit({ action: "LETTER_FOOTER_PRESET_DELETED", entity: "LetterFooterPreset", entityId: existing.id, organizationId, userId });
  res.status(204).send();
});

/** GET /api/letters/signatures — Lists reusable signature blocks. */
router.get("/signatures", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const signatures = await prisma.letterSignatureBlock.findMany({
    where: { organizationId },
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });
  res.json(signatures);
});

/** POST /api/letters/signatures — Creates a reusable signature block. */
router.post("/signatures", requirePermission("letters.manage_signatures"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
  const signerName = typeof req.body?.signerName === "string" ? req.body.signerName.trim() : "";
  if (!name || !signerName) {
    res.status(400).json({ error: { code: "NAME_REQUIRED", message: "Signature name and signer name are required." } });
    return;
  }

  const signature = await prisma.letterSignatureBlock.create({
    data: {
      organizationId,
      name,
      signerName,
      signerTitle: typeof req.body?.signerTitle === "string" ? req.body.signerTitle : null,
      closingPhrase: typeof req.body?.closingPhrase === "string" ? req.body.closingPhrase : null,
      signatureImageUrl: typeof req.body?.signatureImageUrl === "string" ? req.body.signatureImageUrl : null,
      typedSignature: typeof req.body?.typedSignature === "string" ? req.body.typedSignature : null,
      email: typeof req.body?.email === "string" ? req.body.email : null,
      phone: typeof req.body?.phone === "string" ? req.body.phone : null,
      isDefault: req.body?.isDefault === true,
      isActive: req.body?.isActive !== false,
    },
  });

  if (signature.isDefault) {
    await prisma.letterSignatureBlock.updateMany({
      where: { organizationId, id: { not: signature.id } },
      data: { isDefault: false },
    });
  }

  await logAudit({ action: "LETTER_SIGNATURE_CREATED", entity: "LetterSignatureBlock", entityId: signature.id, organizationId, userId });
  res.status(201).json(signature);
});

/** PATCH /api/letters/signatures/:id — Updates a signature block. */
router.patch("/signatures/:id", requirePermission("letters.manage_signatures"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterSignatureBlock.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Signature block not found." } });
    return;
  }

  const patch: Prisma.LetterSignatureBlockUpdateInput = {};
  if (typeof req.body?.name === "string") {
    const nextName = req.body.name.trim();
    if (!nextName) {
      res.status(400).json({ error: { code: "INVALID_NAME", message: "Signature block name cannot be blank." } });
      return;
    }
    patch.name = nextName;
  }
  if (typeof req.body?.signerName === "string") {
    const nextSigner = req.body.signerName.trim();
    if (!nextSigner) {
      res.status(400).json({ error: { code: "INVALID_SIGNER", message: "Signer name cannot be blank." } });
      return;
    }
    patch.signerName = nextSigner;
  }
  if (req.body?.signerTitle !== undefined) patch.signerTitle = typeof req.body.signerTitle === "string" ? req.body.signerTitle : null;
  if (req.body?.closingPhrase !== undefined) patch.closingPhrase = typeof req.body.closingPhrase === "string" ? req.body.closingPhrase : null;
  if (req.body?.signatureImageUrl !== undefined) patch.signatureImageUrl = typeof req.body.signatureImageUrl === "string" ? req.body.signatureImageUrl : null;
  if (req.body?.typedSignature !== undefined) patch.typedSignature = typeof req.body.typedSignature === "string" ? req.body.typedSignature : null;
  if (req.body?.email !== undefined) patch.email = typeof req.body.email === "string" ? req.body.email : null;
  if (req.body?.phone !== undefined) patch.phone = typeof req.body.phone === "string" ? req.body.phone : null;
  if (typeof req.body?.isDefault === "boolean") patch.isDefault = req.body.isDefault;
  if (typeof req.body?.isActive === "boolean") patch.isActive = req.body.isActive;

  const updated = await prisma.letterSignatureBlock.update({ where: { id: existing.id }, data: patch });
  if (updated.isDefault) {
    await prisma.letterSignatureBlock.updateMany({
      where: { organizationId, id: { not: updated.id } },
      data: { isDefault: false },
    });
  }

  await logAudit({ action: "LETTER_SIGNATURE_UPDATED", entity: "LetterSignatureBlock", entityId: updated.id, organizationId, userId });
  res.json(updated);
});

/** DELETE /api/letters/signatures/:id — Deletes one unused signature block. */
router.delete("/signatures/:id", requirePermission("letters.manage_signatures"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterSignatureBlock.findFirst({ where: { id: req.params.id, organizationId } });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Signature block not found." } });
    return;
  }

  const usageCount = await prisma.letterTemplate.count({ where: { organizationId, signatureBlockId: existing.id } });
  if (usageCount > 0) {
    res.status(409).json({ error: { code: "SIGNATURE_IN_USE", message: "Signature block is in use by one or more templates." } });
    return;
  }

  await prisma.letterSignatureBlock.delete({ where: { id: existing.id } });
  await logAudit({ action: "LETTER_SIGNATURE_DELETED", entity: "LetterSignatureBlock", entityId: existing.id, organizationId, userId });
  res.status(204).send();
});

/** GET /api/letters/generated — Lists generated letters with optional filters. */
router.get("/generated", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const status = parseEnum(req.query.status, LETTER_GENERATED_STATUSES);
  const category = parseEnum(req.query.category, LETTER_CATEGORIES);
  const constituentId = typeof req.query.constituentId === "string" ? req.query.constituentId : undefined;
  const limit = parsePositiveInt(req.query.limit, 100, 1, 400);

  const rows = await prisma.generatedLetter.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(constituentId ? { constituentId } : {}),
    },
    include: {
      template: { select: { id: true, name: true, category: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      donation: { select: { id: true, amount: true, date: true } },
      campaign: { select: { id: true, name: true } },
      event: { select: { id: true, name: true } },
      emailCampaign: { select: { id: true, status: true, sentAt: true } },
      generatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
    orderBy: { generatedAt: "desc" },
    take: limit,
  });

  res.json(rows);
});

/** GET /api/letters/constituents/:id/generated — Lists one donor's generated letters. */
router.get("/constituents/:id/generated", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const rows = await prisma.generatedLetter.findMany({
    where: {
      organizationId,
      constituentId: req.params.id,
    },
    include: {
      template: { select: { id: true, name: true, category: true } },
      emailCampaign: { select: { id: true, status: true, sentAt: true } },
    },
    orderBy: { generatedAt: "desc" },
    take: 100,
  });

  res.json(rows);
});

/** POST /api/letters/generated/preview — Merges one template with selected donor/gift context without saving. */
router.post("/generated/preview", requirePermission("letters.generate"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const templateId = typeof req.body?.templateId === "string" ? req.body.templateId : "";
  if (!templateId) {
    res.status(400).json({ error: { code: "TEMPLATE_REQUIRED", message: "templateId is required." } });
    return;
  }

  const template = await prisma.letterTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: {
      id: true,
      printBody: true,
      emailBody: true,
      printSubject: true,
      emailSubject: true,
    },
  });
  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
  }

  const year = typeof req.body?.year === "number" ? req.body.year : Number.parseInt(String(req.body?.year ?? ""), 10);
  const merged = await resolveMergeContext({
    organizationId,
    template,
    constituentId: typeof req.body?.constituentId === "string" ? req.body.constituentId : undefined,
    donationId: typeof req.body?.donationId === "string" ? req.body.donationId : undefined,
    campaignId: typeof req.body?.campaignId === "string" ? req.body.campaignId : undefined,
    eventId: typeof req.body?.eventId === "string" ? req.body.eventId : undefined,
    year: Number.isFinite(year) ? year : undefined,
    actorUserId: userId,
  });

  res.json({
    ...merged,
    previewOnly: true,
  });
});

/** POST /api/letters/generated — Generates and stores one merged letter with communication history logging. */
router.post("/generated", requirePermission("letters.generate"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const templateId = typeof req.body?.templateId === "string" ? req.body.templateId : "";
  if (!templateId) {
    res.status(400).json({ error: { code: "TEMPLATE_REQUIRED", message: "templateId is required." } });
    return;
  }

  const template = await prisma.letterTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: {
      id: true,
      name: true,
      category: true,
      printBody: true,
      emailBody: true,
      printSubject: true,
      emailSubject: true,
      status: true,
    },
  });
  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
  }

  const year = typeof req.body?.year === "number" ? req.body.year : Number.parseInt(String(req.body?.year ?? ""), 10);
  const merged = await resolveMergeContext({
    organizationId,
    template,
    constituentId: typeof req.body?.constituentId === "string" ? req.body.constituentId : undefined,
    donationId: typeof req.body?.donationId === "string" ? req.body.donationId : undefined,
    campaignId: typeof req.body?.campaignId === "string" ? req.body.campaignId : undefined,
    eventId: typeof req.body?.eventId === "string" ? req.body.eventId : undefined,
    year: Number.isFinite(year) ? year : undefined,
    actorUserId: userId,
  });

  const generated = await prisma.$transaction(async (tx) => {
    const created = await tx.generatedLetter.create({
      data: {
        organizationId,
        templateId: template.id,
        constituentId: merged.resolvedConstituentId,
        donationId: merged.resolvedDonationId,
        campaignId: merged.resolvedCampaignId,
        eventId: merged.resolvedEventId,
        category: template.category,
        status: "GENERATED",
        mergedPrintSubject: merged.mergedPrintSubject,
        mergedPrintBody: merged.mergedPrintBody,
        mergedEmailBody: merged.mergedEmailBody,
        emailSubject: merged.mergedEmailSubject,
        generatedByUserId: userId,
        metadataJson: {
          unsupportedMergeFields: merged.unsupportedFields,
          templateStatusAtGeneration: template.status,
        },
      },
    });

    if (merged.resolvedConstituentId) {
      const activity = await tx.activity.create({
        data: {
          constituentId: merged.resolvedConstituentId,
          donationId: merged.resolvedDonationId,
          eventId: merged.resolvedEventId,
          type: "NOTE",
          description: `Generated ${template.category.toLowerCase().replaceAll("_", " ")} letter from template: ${template.name}`,
          metadata: {
            source: "letters-printables",
            communicationType: "printed_letter",
            letterId: created.id,
            templateId: template.id,
            category: template.category,
          },
          userId,
        },
      });

      return tx.generatedLetter.update({
        where: { id: created.id },
        data: { communicationActivityId: activity.id },
        include: {
          template: { select: { id: true, name: true, category: true } },
          constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
          donation: { select: { id: true, amount: true, date: true } },
          campaign: { select: { id: true, name: true } },
          event: { select: { id: true, name: true } },
        },
      });
    }

    return tx.generatedLetter.findUnique({
      where: { id: created.id },
      include: {
        template: { select: { id: true, name: true, category: true } },
        constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
        donation: { select: { id: true, amount: true, date: true } },
        campaign: { select: { id: true, name: true } },
        event: { select: { id: true, name: true } },
      },
    });
  });

  await logAudit({
    action: "LETTER_GENERATED",
    entity: "GeneratedLetter",
    entityId: generated?.id,
    organizationId,
    userId,
    metadata: {
      templateId: template.id,
      category: template.category,
      hasUnsupportedMergeFields: merged.unsupportedFields.length > 0,
    },
  });

  res.status(201).json(generated);
});

/** PATCH /api/letters/generated/:id/status — Marks generated letter workflow status updates. */
router.patch("/generated/:id/status", requirePermission("letters.generate"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const status = parseEnum(req.body?.status, LETTER_GENERATED_STATUSES);
  if (!status) {
    res.status(400).json({ error: { code: "INVALID_STATUS", message: "Invalid generated-letter status." } });
    return;
  }

  const existing = await prisma.generatedLetter.findFirst({
    where: { id: req.params.id, organizationId },
    select: { id: true, constituentId: true, status: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Generated letter not found." } });
    return;
  }

  const now = new Date();
  const updated = await prisma.generatedLetter.update({
    where: { id: existing.id },
    data: {
      status,
      printedAt: status === "PRINTED" ? now : undefined,
      mailedAt: status === "MAILED" ? now : undefined,
      emailSentAt: status === "EMAIL_SENT" ? now : undefined,
    },
  });

  if (existing.constituentId) {
    await prisma.activity.create({
      data: {
        constituentId: existing.constituentId,
        type: "NOTE",
        description: `Letter status updated to ${status.toLowerCase().replaceAll("_", " ")}`,
        metadata: {
          source: "letters-printables",
          communicationType: "printed_letter",
          letterId: existing.id,
          status,
        },
        userId,
      },
    });
  }

  await logAudit({
    action: "LETTER_STATUS_UPDATED",
    entity: "GeneratedLetter",
    entityId: existing.id,
    organizationId,
    userId,
    metadata: { previousStatus: existing.status, nextStatus: status },
  });

  res.json(updated);
});

/** POST /api/letters/generated/:id/create-email-draft — Creates a linked communications draft campaign. */
router.post("/generated/:id/create-email-draft", requirePermission("letters.create_email_draft"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const generated = await prisma.generatedLetter.findFirst({
    where: { id: req.params.id, organizationId },
    include: {
      template: { select: { id: true, name: true, category: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
    },
  });

  if (!generated) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Generated letter not found." } });
    return;
  }

  if (!generated.constituent?.email) {
    res.status(400).json({ error: { code: "MISSING_EMAIL", message: "Constituent email is required to create an email draft." } });
    return;
  }

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { smtpFromName: true, smtpFromEmail: true },
  });

  const audienceFilter = JSON.stringify({
    type: "individual",
    recipientEmail: generated.constituent.email,
    recipientConstituentId: generated.constituent.id,
    _sharing: {
      ownerId: userId,
      sharedWithOrganization: false,
    },
    _workflow: {
      preparationStatus: "READY",
    },
  });

  const subject = generated.emailSubject || generated.mergedPrintSubject || `${generated.template.name}`;
  const bodyText = generated.mergedEmailBody || generated.mergedPrintBody;
  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: `Letter Draft: ${generated.template.name} (${generated.constituent.firstName} ${generated.constituent.lastName})`,
      subject,
      previewText: bodyText.slice(0, 120),
      fromName: settings?.smtpFromName || "OyamaCRM",
      fromEmail: settings?.smtpFromEmail || "noreply@oyamacrm.org",
      bodyText,
      bodyHtml: `<p>${textToHtml(bodyText)}</p>`,
      audienceFilter,
      status: "DRAFT",
    },
  });

  const now = new Date();
  const updatedLetter = await prisma.generatedLetter.update({
    where: { id: generated.id },
    data: {
      status: "EMAIL_DRAFT_CREATED",
      emailCampaignId: campaign.id,
      emailDraftCreatedAt: now,
    },
  });

  if (generated.constituentId) {
    await prisma.activity.create({
      data: {
        constituentId: generated.constituentId,
        type: "NOTE",
        description: `Created email draft from letter template: ${generated.template.name}`,
        metadata: {
          source: "letters-printables",
          communicationType: "email",
          letterId: generated.id,
          emailCampaignId: campaign.id,
          category: generated.category,
        },
        userId,
      },
    });
  }

  await logAudit({
    action: "LETTER_EMAIL_DRAFT_CREATED",
    entity: "GeneratedLetter",
    entityId: generated.id,
    organizationId,
    userId,
    metadata: {
      emailCampaignId: campaign.id,
      constituentId: generated.constituentId,
    },
  });

  res.json({
    generatedLetter: updatedLetter,
    emailCampaign: campaign,
  });
});

/** POST /api/letters/generated/:id/export-pdf — Returns explicit partial notice until PDF engine is wired. */
router.post("/generated/:id/export-pdf", requirePermission("letters.export_pdf"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const exists = await prisma.generatedLetter.findFirst({ where: { id: req.params.id, organizationId }, select: { id: true } });
  if (!exists) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Generated letter not found." } });
    return;
  }

  await logAudit({
    action: "LETTER_PDF_EXPORT_REQUESTED",
    entity: "GeneratedLetter",
    entityId: exists.id,
    organizationId,
    userId,
    metadata: {
      status: "PARTIAL_IMPLEMENTATION",
      note: "PDF pipeline not yet wired server-side",
    },
  });

  res.status(501).json({
    error: {
      code: "PDF_EXPORT_PARTIAL",
      message: "PDF export backend pipeline is not fully wired yet. Use browser print for now.",
    },
  });
});

/** POST /api/letters/generated/batch — Returns explicit partial notice for future batch architecture. */
router.post("/generated/batch", requirePermission("letters.generate_batch"), async (_req, res) => {
  res.status(501).json({
    error: {
      code: "BATCH_GENERATION_PARTIAL",
      message: "Batch generation is planned but not fully implemented in this pass.",
    },
  });
});

export default router;
