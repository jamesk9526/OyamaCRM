/**
 * OyamaEmail API routes for dedicated template-builder workflows.
 * Uses EmailCampaign persistence while exposing a template-first API surface.
 */

import { Router } from "express";
import { randomUUID } from "node:crypto";
import type { EmailPurpose } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { categoryForPurpose, evaluateRecipientEligibility, hashPublicEmailToken, parseEmailPurpose } from "../services/email-compliance.js";
import { loadOrganizationBrandingContext } from "../services/organization-branding.js";
import {
  buildEmailMergePreviewWarnings,
  EMAIL_MERGE_FIELD_GROUPS,
  findUnsupportedEmailMergeTokens,
} from "../services/oyama-email/merge-field-catalog.js";
import { createOrganizationEmailSender } from "../services/smtp-service.js";
import {
  applyMergeTokens,
  createDefaultEmailTemplateDocument,
  normalizeEmailTemplateDocument,
  normalizeEmailTemplateSettings,
  renderEmailTemplateDocument,
  renderEmailTemplateDocumentWithMerge,
  type OyamaEmailTemplateDocument,
  type OyamaEmailTemplateSettings,
} from "../services/oyama-email/email-render-service.js";

const router = Router();

const EMAIL_PATTERN =
  /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;

interface StoredTemplateJson {
  template: OyamaEmailTemplateDocument;
  settings: OyamaEmailTemplateSettings;
  preferenceCategory: string;
}

interface TemplatePayload {
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  purpose: EmailPurpose;
  preferenceCategory: string;
  template: OyamaEmailTemplateDocument;
  settings: OyamaEmailTemplateSettings;
}

function isValidEmail(value: string): boolean {
  return EMAIL_PATTERN.test(value.trim());
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value;
}

function asBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }
  return fallback;
}

function formatDate(value: Date | null | undefined): string {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatCurrency(value: unknown): string {
  const numeric = Number(value ?? Number.NaN);
  if (!Number.isFinite(numeric)) return "";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numeric);
}

function parseStoredTemplateJson(raw: string | null): StoredTemplateJson {
  if (!raw?.trim()) {
    return {
      template: createDefaultEmailTemplateDocument(),
      settings: normalizeEmailTemplateSettings({}),
      preferenceCategory: "GENERAL_UPDATES",
    };
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    const obj = asObject(parsed);

    const hasWrappedTemplate = Boolean(obj.template || obj.settings || obj.preferenceCategory);
    const template = hasWrappedTemplate ? obj.template : parsed;
    const settings = hasWrappedTemplate ? obj.settings : {};
    const preferenceCategory = hasWrappedTemplate
      ? asString(obj.preferenceCategory, "GENERAL_UPDATES").trim() || "GENERAL_UPDATES"
      : "GENERAL_UPDATES";

    return {
      template: normalizeEmailTemplateDocument(template),
      settings: normalizeEmailTemplateSettings(settings),
      preferenceCategory,
    };
  } catch {
    return {
      template: createDefaultEmailTemplateDocument(),
      settings: normalizeEmailTemplateSettings({}),
      preferenceCategory: "GENERAL_UPDATES",
    };
  }
}

function serializeStoredTemplateJson(input: StoredTemplateJson): string {
  return JSON.stringify({
    version: 1,
    template: input.template,
    settings: input.settings,
    preferenceCategory: input.preferenceCategory,
  });
}

function appBaseUrl(): string {
  const value = process.env.NEXT_PUBLIC_APP_URL || process.env.FRONTEND_ORIGIN || "http://localhost:3000";
  return value.replace(/\/+$/, "");
}

function composeDefaultFromName(input: {
  userFirstName?: string | null;
  userLastName?: string | null;
  organizationName?: string | null;
  fallback?: string;
}): string {
  const userName = [String(input.userFirstName ?? "").trim(), String(input.userLastName ?? "").trim()]
    .filter(Boolean)
    .join(" ")
    .trim();
  const orgName = String(input.organizationName ?? "").trim();
  if (userName && orgName) return `${userName} - ${orgName}`;
  if (orgName) return orgName;
  if (userName) return userName;
  return input.fallback?.trim() || "Oyama Ministries";
}

async function issueTemplateComplianceLinks(params: {
  organizationId: string;
  campaignId: string;
  purpose: EmailPurpose;
  email: string;
}) {
  const normalizedEmail = params.email.trim().toLowerCase();
  const subscription = await prisma.emailSubscription.upsert({
    where: {
      organizationId_email: {
        organizationId: params.organizationId,
        email: normalizedEmail,
      },
    },
    create: {
      organizationId: params.organizationId,
      email: normalizedEmail,
      globalStatus: "UNKNOWN",
      source: "oyama-email-template",
    },
    update: {},
  });

  const rawToken = `${randomUUID()}${randomUUID()}`;
  const tokenHash = hashPublicEmailToken(rawToken);
  const expiresAt = new Date(Date.now() + (180 * 24 * 60 * 60 * 1000));

  await prisma.emailUnsubscribeToken.create({
    data: {
      organizationId: params.organizationId,
      subscriptionId: subscription.id,
      tokenHash,
      email: normalizedEmail,
      category: categoryForPurpose(params.purpose),
      campaignId: params.campaignId,
      expiresAt,
    },
  });

  const appBase = appBaseUrl();
  return {
    unsubscribeUrl: `${appBase}/unsubscribe/${rawToken}`,
    preferencesUrl: `${appBase}/preferences/${rawToken}`,
  };
}

async function buildTemplateMergeVars(params: {
  organizationId: string;
  campaignId: string;
  campaignName: string;
  purpose: EmailPurpose;
  fromName: string;
  fromEmail: string;
  recipientEmail?: string | null;
}) {
  const normalizedRecipient = params.recipientEmail?.trim().toLowerCase() || null;

  const [organization, orgSettings, recipient] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: params.organizationId },
      select: { name: true },
    }),
    prisma.organizationSettings.findUnique({
      where: { organizationId: params.organizationId },
      select: {
        smtpFromName: true,
        smtpFromEmail: true,
      },
    }),
    normalizedRecipient
      ? prisma.constituent.findFirst({
          where: { organizationId: params.organizationId, email: normalizedRecipient },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            totalLifetimeGiving: true,
            totalYtdGiving: true,
            giftCount: true,
            firstGiftDate: true,
            lastGiftDate: true,
            lastGiftAmount: true,
          },
        })
      : prisma.constituent.findFirst({
          where: { organizationId: params.organizationId, email: { not: null } },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            totalLifetimeGiving: true,
            totalYtdGiving: true,
            giftCount: true,
            firstGiftDate: true,
            lastGiftDate: true,
            lastGiftAmount: true,
          },
        }),
  ]);
  const branding = await loadOrganizationBrandingContext(params.organizationId, organization?.name?.trim() || "");

  const donation = recipient?.id
    ? await prisma.donation.findFirst({
        where: { constituentId: recipient.id },
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        select: {
          amount: true,
          date: true,
          receiptNumber: true,
          taxDeductible: true,
          campaignId: true,
          campaign: { select: { name: true, goal: true } },
          event: { select: { name: true, startDate: true, location: true, city: true, state: true } },
        },
      })
    : null;

  const campaignRaisedAggregate = donation?.campaignId
    ? await prisma.donation.aggregate({
        where: { campaignId: donation.campaignId },
        _sum: { amount: true },
      })
    : null;

  const stewardEnrollment = recipient?.id
    ? await prisma.stewardPathEnrollment.findFirst({
        where: {
          organizationId: params.organizationId,
          constituentId: recipient.id,
        },
        orderBy: { updatedAt: "desc" },
        select: {
          status: true,
          nextStepDueAt: true,
          path: { select: { name: true } },
          currentStep: { select: { name: true } },
        },
      })
    : null;

  const firstName = recipient?.firstName?.trim() || "";
  const lastName = recipient?.lastName?.trim() || "";
  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();
  const organizationName = branding.organizationName || organization?.name?.trim() || "Your organization";
  const senderName = params.fromName.trim() || orgSettings?.smtpFromName?.trim() || organizationName;
  const senderEmail = orgSettings?.smtpFromEmail?.trim() || params.fromEmail.trim() || "";

  const donationCampaignName = donation?.campaign?.name?.trim() || params.campaignName;
  const campaignGoal = formatCurrency(donation?.campaign?.goal ?? null);
  const campaignRaisedLabel = formatCurrency(campaignRaisedAggregate?._sum.amount ?? null);
  const goalNumeric = Number(donation?.campaign?.goal ?? Number.NaN);
  const raisedNumeric = Number(campaignRaisedAggregate?._sum.amount ?? Number.NaN);
  const progressPercent = Number.isFinite(goalNumeric) && goalNumeric > 0 && Number.isFinite(raisedNumeric)
    ? `${Math.round((raisedNumeric / goalNumeric) * 100)}%`
    : "";

  const physicalAddress = branding.addressLine;
  const currentDate = formatDate(new Date());
  const effectiveRecipient = normalizedRecipient || recipient?.email?.trim().toLowerCase() || "";
  let unsubscribeUrl = "{{unsubscribeUrl}}";
  let managePreferencesUrl = "{{managePreferencesUrl}}";
  if (effectiveRecipient) {
    const links = await issueTemplateComplianceLinks({
      organizationId: params.organizationId,
      campaignId: params.campaignId,
      purpose: params.purpose,
      email: effectiveRecipient,
    });
    unsubscribeUrl = links.unsubscribeUrl;
    managePreferencesUrl = links.preferencesUrl;
  }

  return {
    recipient: recipient
      ? {
          email: recipient.email?.trim() || effectiveRecipient,
          firstName,
          lastName,
          fullName,
        }
      : null,
    vars: {
      "donor.firstName": firstName,
      "donor.lastName": lastName,
      "donor.fullName": fullName,
      "donor.email": recipient?.email?.trim() || effectiveRecipient,
      "donor.totalYtdGiving": formatCurrency(recipient?.totalYtdGiving ?? null),
      "donor.totalLifetimeGiving": formatCurrency(recipient?.totalLifetimeGiving ?? null),
      "donor.giftCount": recipient?.giftCount != null ? String(recipient.giftCount) : "",
      "donor.firstGiftDate": formatDate(recipient?.firstGiftDate ?? null),
      "donor.lastGiftDate": formatDate(recipient?.lastGiftDate ?? null),
      "donor.lastGiftAmount": formatCurrency(recipient?.lastGiftAmount ?? null),

      "gift.amount": formatCurrency(donation?.amount ?? null),
      "gift.date": formatDate(donation?.date ?? null),
      "gift.receiptNumber": donation?.receiptNumber?.trim() || "",
      "gift.taxDeductibleAmount": donation?.taxDeductible ? formatCurrency(donation?.amount ?? null) : "$0.00",

      "organization.name": organizationName,
      "organization.address": physicalAddress,
      "organization.taxId": branding.taxId,

      "event.name": donation?.event?.name?.trim() || "",
      "event.startDate": formatDate(donation?.event?.startDate ?? null),
      "event.location": [donation?.event?.location, donation?.event?.city, donation?.event?.state].filter(Boolean).join(", "),

      "campaign.name": donationCampaignName,
      "campaign.goal": campaignGoal,
      "campaign.raised": campaignRaisedLabel,
      "campaign.progressPercent": progressPercent,

      "staff.name": senderName,
      "staff.email": senderEmail,

      "stewardPath.name": stewardEnrollment?.path?.name?.trim() || "",
      "stewardPath.status": stewardEnrollment?.status || "",
      "stewardPath.currentStep": stewardEnrollment?.currentStep?.name?.trim() || "",
      "stewardPath.nextStepDueAt": formatDate(stewardEnrollment?.nextStepDueAt ?? null),

      firstName,
      lastName,
      fullName,
      preferredName: firstName || fullName || "Friend",
      email: recipient?.email?.trim() || effectiveRecipient,
      lastGiftAmount: formatCurrency(recipient?.lastGiftAmount ?? null),
      lastGiftDate: formatDate(recipient?.lastGiftDate ?? null),
      totalYtdGiving: formatCurrency(recipient?.totalYtdGiving ?? null),
      totalLifetimeGiving: formatCurrency(recipient?.totalLifetimeGiving ?? null),
      giftCount: recipient?.giftCount != null ? String(recipient.giftCount) : "",
      firstGiftDate: formatDate(recipient?.firstGiftDate ?? null),
      campaignName: donationCampaignName,
      campaignGoal,
      campaignRaised: campaignRaisedLabel,
      campaignProgressPercent: progressPercent,
      organizationName,
      organizationPhone: branding.contactPhone,
      organizationWebsite: branding.websiteUrl,
      addressBlock: physicalAddress,
      organizationTaxId: branding.taxId,
      staffName: senderName,
      staffTitle: branding.defaultSignerTitle,
      staffEmail: senderEmail,
      signatureName: senderName,
      receiptNumber: donation?.receiptNumber?.trim() || "",
      currentYear: String(new Date().getFullYear()),
      currentDate,
      donationUrl: branding.websiteUrl,
      donationAmount: formatCurrency(donation?.amount ?? null),
      taxDeductibleAmount: donation?.taxDeductible ? formatCurrency(donation?.amount ?? null) : "$0.00",
      organizationAddress: physicalAddress,
      unsubscribeUrl,
      unsubscribe_url: unsubscribeUrl,
      managePreferencesUrl,
      preferencesUrl: managePreferencesUrl,
      preferences_url: managePreferencesUrl,
    },
  };
}

function normalizeTemplatePayload(
  body: unknown,
  fallback: {
    name: string;
    subject: string;
    previewText: string;
    fromName: string;
    fromEmail: string;
    replyToEmail: string;
    purpose: EmailPurpose;
    preferenceCategory: string;
    template: OyamaEmailTemplateDocument;
    settings: OyamaEmailTemplateSettings;
  },
): TemplatePayload {
  const input = asObject(body);

  const template = normalizeEmailTemplateDocument(input.template ?? fallback.template);
  const settings = normalizeEmailTemplateSettings(input.settings ?? fallback.settings);
  const enforcedFromEmail = asString(fallback.fromEmail, "").trim();
  const enforcedReplyTo = asString(fallback.replyToEmail, enforcedFromEmail).trim() || enforcedFromEmail;

  return {
    name: asString(input.name, fallback.name).trim() || fallback.name,
    subject: asString(input.subject, fallback.subject).trim(),
    previewText: asString(input.previewText, fallback.previewText).trim(),
    fromName: asString(input.fromName, fallback.fromName).trim() || fallback.fromName,
    fromEmail: enforcedFromEmail,
    replyToEmail: enforcedReplyTo,
    purpose: parseEmailPurpose(input.purpose, fallback.purpose),
    preferenceCategory: asString(input.preferenceCategory, fallback.preferenceCategory).trim() || fallback.preferenceCategory,
    template,
    settings,
  };
}

function mapTemplateResponse(campaign: {
  id: string;
  name: string;
  subject: string;
  previewText: string | null;
  fromName: string;
  fromEmail: string;
  replyToEmail: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  purpose: EmailPurpose;
  templateJson: string | null;
}) {
  const stored = parseStoredTemplateJson(campaign.templateJson);
  const rendered = renderEmailTemplateDocument(stored.template, stored.settings);

  return {
    id: campaign.id,
    name: campaign.name,
    status: campaign.status,
    createdAt: campaign.createdAt,
    updatedAt: campaign.updatedAt,
    subject: campaign.subject,
    previewText: campaign.previewText || "",
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    replyToEmail: campaign.replyToEmail || "",
    purpose: campaign.purpose,
    preferenceCategory: stored.preferenceCategory,
    template: stored.template,
    settings: stored.settings,
    renderedHtml: rendered.html,
    renderedText: rendered.text,
    mergeFieldsUsed: rendered.mergeFieldsUsed,
  };
}

router.use(requireAuth);
router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:communications")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
    return requirePermission("edit:communications")(req, res, next);
  }
  return next();
});

router.get("/merge-fields", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const [donorCount, donationCount, eventCount, stewardCount] = await Promise.all([
    prisma.constituent.count({ where: { organizationId } }),
    prisma.donation.count({ where: { constituent: { organizationId } } }),
    prisma.event.count({ where: { organizationId } }),
    prisma.stewardPathEnrollment.count({ where: { organizationId } }),
  ]);

  const availabilityByKind = {
    always: true,
    donor: donorCount > 0,
    gift: donationCount > 0,
    event: eventCount > 0,
    steward: stewardCount > 0,
  } as const;

  res.json({
    groups: EMAIL_MERGE_FIELD_GROUPS.map((group) => ({
      key: group.key,
      label: group.label,
      available: availabilityByKind[group.availability],
      fields: group.fields,
    })),
  });
});

router.get("/templates", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const limit = Math.min(100, Math.max(1, Number.parseInt(String(req.query.limit ?? "48"), 10) || 48));
  const rows = await prisma.emailCampaign.findMany({
    where: { organizationId },
    orderBy: { updatedAt: "desc" },
    take: limit,
  });

  res.json(rows.map((row) => mapTemplateResponse(row)));
});

router.post("/templates", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const [orgSettings, organization, currentUser] = await Promise.all([
    prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { smtpFromName: true, smtpFromEmail: true },
    }),
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    req.user?.sub
      ? prisma.user.findUnique({
          where: { id: req.user.sub },
          select: { firstName: true, lastName: true },
        })
      : Promise.resolve(null),
  ]);

  const smtpFromEmail = orgSettings?.smtpFromEmail?.trim() || "";
  if (!smtpFromEmail || !isValidEmail(smtpFromEmail)) {
    res.status(400).json({
      error: {
        code: "SMTP_NOT_READY",
        message: "Global SMTP from email is not configured. Update SMTP settings before creating templates.",
      },
    });
    return;
  }

  const organizationName = organization?.name?.trim() || orgSettings?.smtpFromName?.trim() || "Oyama Ministries";
  const defaultFromName = composeDefaultFromName({
    userFirstName: currentUser?.firstName,
    userLastName: currentUser?.lastName,
    organizationName,
    fallback: organizationName,
  });

  const fallback = {
    name: "Untitled Email Template",
    subject: "",
    previewText: "",
    fromName: defaultFromName,
    fromEmail: smtpFromEmail,
    replyToEmail: smtpFromEmail,
    purpose: parseEmailPurpose(undefined),
    preferenceCategory: "GENERAL_UPDATES",
    template: createDefaultEmailTemplateDocument(),
    settings: normalizeEmailTemplateSettings({ includeUnsubscribeLink: true, includePhysicalAddress: true, enablePlainTextVersion: true }),
  };

  const body = asObject(req.body);
  const payload = normalizeTemplatePayload(body, fallback);
  const requestedOverwriteTemplateId = asString(body.overwriteTemplateId).trim();
  const confirmOverwrite = asBoolean(body.confirmOverwrite, false);

  const conflictingByName = await prisma.emailCampaign.findFirst({
    where: {
      organizationId,
      name: payload.name,
      ...(requestedOverwriteTemplateId ? { id: { not: requestedOverwriteTemplateId } } : {}),
    },
    select: {
      id: true,
      name: true,
      updatedAt: true,
    },
  });

  const rendered = renderEmailTemplateDocument(payload.template, payload.settings);
  const templateJson = serializeStoredTemplateJson({
    template: payload.template,
    settings: payload.settings,
    preferenceCategory: payload.preferenceCategory,
  });

  const overwriteTemplateId = requestedOverwriteTemplateId || conflictingByName?.id || "";
  if (confirmOverwrite && overwriteTemplateId) {
    const existing = await prisma.emailCampaign.findFirst({
      where: {
        id: overwriteTemplateId,
        organizationId,
      },
    });

    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Template selected for overwrite was not found." } });
      return;
    }

    const overwritten = await prisma.emailCampaign.update({
      where: { id: existing.id },
      data: {
        name: payload.name,
        subject: payload.subject,
        previewText: payload.previewText,
        fromName: payload.fromName,
        fromEmail: payload.fromEmail,
        replyToEmail: payload.replyToEmail,
        purpose: payload.purpose,
        bodyHtml: rendered.html,
        bodyText: rendered.text,
        templateJson,
        status: "DRAFT",
      },
    });

    res.json(mapTemplateResponse(overwritten));
    return;
  }

  if (conflictingByName) {
    res.status(409).json({
      error: {
        code: "TEMPLATE_NAME_CONFLICT",
        message: "A template with this name already exists. Confirm overwrite or rename this template.",
      },
      conflict: {
        id: conflictingByName.id,
        name: conflictingByName.name,
        updatedAt: conflictingByName.updatedAt,
      },
    });
    return;
  }

  const created = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: payload.name,
      subject: payload.subject,
      previewText: payload.previewText,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail,
      replyToEmail: payload.replyToEmail,
      purpose: payload.purpose,
      bodyHtml: rendered.html,
      bodyText: rendered.text,
      templateJson,
      status: "DRAFT",
    },
  });

  res.status(201).json(mapTemplateResponse(created));
});

router.get("/templates/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });

  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
  }

  res.json(mapTemplateResponse(campaign));
});

router.put("/templates/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const existing = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });

  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
  }

  const body = asObject(req.body);
  const forceOverwrite = asBoolean(body.forceOverwrite, false);
  const lastKnownUpdatedAt = asString(body.lastKnownUpdatedAt).trim();

  if (!forceOverwrite && lastKnownUpdatedAt) {
    const parsed = new Date(lastKnownUpdatedAt);
    if (!Number.isNaN(parsed.getTime()) && parsed.getTime() !== existing.updatedAt.getTime()) {
      res.status(409).json({
        error: {
          code: "TEMPLATE_STALE_VERSION",
          message: "This template was updated by another session. Confirm overwrite to save anyway.",
        },
        conflict: {
          id: existing.id,
          name: existing.name,
          updatedAt: existing.updatedAt,
        },
      });
      return;
    }
  }

  const stored = parseStoredTemplateJson(existing.templateJson);

  const smtpSettings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { smtpFromEmail: true },
  });
  const smtpFromEmail = smtpSettings?.smtpFromEmail?.trim() || "";
  if (!smtpFromEmail || !isValidEmail(smtpFromEmail)) {
    res.status(400).json({
      error: {
        code: "SMTP_NOT_READY",
        message: "Global SMTP from email is not configured. Update SMTP settings before saving templates.",
      },
    });
    return;
  }

  const payload = normalizeTemplatePayload(body, {
    name: existing.name,
    subject: existing.subject,
    previewText: existing.previewText || "",
    fromName: existing.fromName,
    fromEmail: smtpFromEmail,
    replyToEmail: smtpFromEmail,
    purpose: existing.purpose,
    preferenceCategory: stored.preferenceCategory,
    template: stored.template,
    settings: stored.settings,
  });

  const conflictingByName = await prisma.emailCampaign.findFirst({
    where: {
      organizationId,
      name: payload.name,
      id: { not: existing.id },
    },
    select: {
      id: true,
      name: true,
      updatedAt: true,
    },
  });

  if (conflictingByName) {
    res.status(409).json({
      error: {
        code: "TEMPLATE_NAME_CONFLICT",
        message: "Another template already uses this name. Rename this template or confirm overwrite from the create flow.",
      },
      conflict: {
        id: conflictingByName.id,
        name: conflictingByName.name,
        updatedAt: conflictingByName.updatedAt,
      },
    });
    return;
  }

  const rendered = renderEmailTemplateDocument(payload.template, payload.settings);
  const templateJson = serializeStoredTemplateJson({
    template: payload.template,
    settings: payload.settings,
    preferenceCategory: payload.preferenceCategory,
  });

  const updated = await prisma.emailCampaign.update({
    where: { id: existing.id },
    data: {
      name: payload.name,
      subject: payload.subject,
      previewText: payload.previewText,
      fromName: payload.fromName,
      fromEmail: payload.fromEmail,
      replyToEmail: payload.replyToEmail,
      purpose: payload.purpose,
      bodyHtml: rendered.html,
      bodyText: rendered.text,
      templateJson,
      status: "DRAFT",
    },
  });

  res.json(mapTemplateResponse(updated));
});

router.post("/templates/:id/preview", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });

  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
  }

  const recipientEmail = asString(asObject(req.body).recipientEmail).trim().toLowerCase();
  if (recipientEmail && !isValidEmail(recipientEmail)) {
    res.status(400).json({ error: { code: "INVALID_EMAIL", message: "recipientEmail must be valid." } });
    return;
  }

  const stored = parseStoredTemplateJson(campaign.templateJson);
  const mergeContext = await buildTemplateMergeVars({
    organizationId,
    campaignId: campaign.id,
    campaignName: campaign.name,
    purpose: campaign.purpose,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    recipientEmail: recipientEmail || null,
  });

  const rendered = renderEmailTemplateDocumentWithMerge(stored.template, stored.settings, mergeContext.vars);
  const subject = applyMergeTokens(campaign.subject || campaign.name, mergeContext.vars);
  const previewText = applyMergeTokens(campaign.previewText || "", mergeContext.vars);
  const warnings = buildEmailMergePreviewWarnings([
    campaign.subject,
    campaign.previewText,
    campaign.bodyHtml,
    campaign.bodyText,
  ], mergeContext.vars);

  res.json({
    id: campaign.id,
    subject,
    previewText,
    html: rendered.html,
    text: rendered.text,
    mergeFieldsUsed: rendered.mergeFieldsUsed,
    recipient: mergeContext.recipient,
    warnings,
  });
});

router.post("/templates/:id/send-test", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const campaign = await prisma.emailCampaign.findFirst({
    where: {
      id: req.params.id,
      organizationId,
    },
  });

  if (!campaign) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
  }

  const body = asObject(req.body);
  const toEmail = asString(body.toEmail).trim().toLowerCase();
  const recipientEmail = asString(body.recipientEmail).trim().toLowerCase();

  if (!toEmail || !isValidEmail(toEmail)) {
    res.status(400).json({ error: { code: "INVALID_EMAIL", message: "toEmail is required and must be valid." } });
    return;
  }

  if (recipientEmail && !isValidEmail(recipientEmail)) {
    res.status(400).json({ error: { code: "INVALID_EMAIL", message: "recipientEmail must be valid." } });
    return;
  }

  const stored = parseStoredTemplateJson(campaign.templateJson);
  const unsupportedMergeTokens = findUnsupportedEmailMergeTokens([
    campaign.subject,
    campaign.previewText,
    campaign.bodyHtml,
    campaign.bodyText,
  ]);
  if (unsupportedMergeTokens.length > 0) {
    res.status(400).json({
      error: {
        code: "UNSUPPORTED_MERGE_FIELDS",
        message: `Unsupported merge fields: ${unsupportedMergeTokens.map((token) => `{{${token}}}`).join(", ")}.`,
      },
    });
    return;
  }
  const mergeContext = await buildTemplateMergeVars({
    organizationId,
    campaignId: campaign.id,
    campaignName: campaign.name,
    purpose: campaign.purpose,
    fromName: campaign.fromName,
    fromEmail: campaign.fromEmail,
    recipientEmail: recipientEmail || toEmail,
  });

  const rendered = renderEmailTemplateDocumentWithMerge(stored.template, stored.settings, mergeContext.vars);
  const subject = applyMergeTokens(campaign.subject || campaign.name, mergeContext.vars);

  const eligibility = await evaluateRecipientEligibility({
    organizationId,
    purpose: parseEmailPurpose(campaign.purpose),
    candidates: [{ email: toEmail }],
  });
  if (eligibility.recipients.length === 0) {
    const reason = eligibility.decisions[0]?.ineligibilityReason || "Recipient is not eligible for email sends.";
    res.status(409).json({ error: { code: "RECIPIENT_SUPPRESSED", message: reason } });
    return;
  }

  try {
    const sender = await createOrganizationEmailSender(organizationId);
    await sender.send({
      to: toEmail,
      subject: `[TEST] ${subject}`,
      html: rendered.html,
      text: rendered.text,
      fromNameOverride: campaign.fromName,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Outbound email provider is not ready.";
    res.status(400).json({ error: { code: "SMTP_NOT_READY", message } });
    return;
  }

  await prisma.auditLog.create({
    data: {
      organizationId,
      action: "OYAMA_EMAIL_TEMPLATE_TEST_SENT",
      entity: "EmailCampaign",
      entityId: campaign.id,
      metadata: { toEmail },
    },
  }).catch(() => {
    // Best-effort audit logging.
  });

  res.json({ success: true, toEmail });
});

export default router;
