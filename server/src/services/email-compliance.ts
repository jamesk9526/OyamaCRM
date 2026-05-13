/** Shared donor email compliance helpers for readiness checks, recipient eligibility, and token hashing. */
import { createHash } from "node:crypto";
import type {
  EmailCategory,
  EmailPurpose,
  EmailRecipientEligibilityStatus,
  EmailSuppressionReason,
  EmailSubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma.js";

/** Minimal recipient shape needed to evaluate compliance eligibility. */
export interface EmailRecipientCandidate {
  email: string;
  constituentId?: string | null;
  doNotEmail?: boolean;
  doNotContact?: boolean;
  emailOptOut?: boolean;
}

/** Result for one recipient eligibility decision used by send-audience reporting. */
export interface EmailEligibilityDecision {
  email: string;
  constituentId: string | null;
  subscriptionId: string | null;
  eligibilityStatus: EmailRecipientEligibilityStatus;
  ineligibilityReason: string | null;
}

/** Aggregate counts that power send confirmations and compliance audit metadata. */
export interface EmailEligibilitySummary {
  totalMatched: number;
  validEmail: number;
  missingEmail: number;
  optedOut: number;
  duplicateEmails: number;
  suppressionCount: number;
  finalSendCount: number;
  categoryOptOut: number;
  doNotContact: number;
  invalidEmail: number;
  suppressed: number;
}

/** Full recipient eligibility evaluation payload. */
export interface EmailEligibilityResult {
  category: EmailCategory;
  decisions: EmailEligibilityDecision[];
  recipients: string[];
  summary: EmailEligibilitySummary;
}

/** Checks whether one email address looks valid for application-level sending. */
export function isValidEmailAddress(value: string): boolean {
  const EMAIL_PATTERN =
    /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
  return EMAIL_PATTERN.test(value.trim());
}

/** Maps campaign purpose to the preference category used for opt-out checks. */
export function categoryForPurpose(purpose: EmailPurpose): EmailCategory {
  if (purpose === "FUNDRAISING") return "FUNDRAISING_APPEAL";
  if (purpose === "NEWSLETTER") return "NEWSLETTER";
  if (purpose === "EVENT_PROMOTION") return "EVENT_INVITATION";
  if (purpose === "RECEIPT") return "RECEIPTS";
  if (purpose === "THANK_YOU") return "THANK_YOU_EMAILS";
  if (purpose === "PERSONAL") return "PERSONAL_STAFF_EMAIL";
  return "ADMINISTRATIVE_NOTICE";
}

/** True when a campaign purpose must enforce unsubscribe + preference footer policy before send. */
export function requiresPreferenceCompliance(purpose: EmailPurpose): boolean {
  return purpose === "MARKETING"
    || purpose === "FUNDRAISING"
    || purpose === "NEWSLETTER"
    || purpose === "EVENT_PROMOTION";
}

/** Normalizes unknown purpose strings to a safe default. */
export function parseEmailPurpose(raw: unknown, fallback: EmailPurpose = "MARKETING"): EmailPurpose {
  if (typeof raw !== "string") return fallback;
  const value = raw.trim().toUpperCase() as EmailPurpose;
  const allowed: EmailPurpose[] = [
    "MARKETING",
    "FUNDRAISING",
    "NEWSLETTER",
    "EVENT_PROMOTION",
    "RECEIPT",
    "THANK_YOU",
    "TRANSACTIONAL",
    "ADMINISTRATIVE",
    "PERSONAL",
  ];
  return allowed.includes(value) ? value : fallback;
}

/**
 * Validates campaign content for compliance-gated purposes.
 * This ensures unsubscribe/manage-preferences controls are present before scheduling/sending.
 */
export function getCampaignComplianceIssues(input: {
  purpose: EmailPurpose;
  subject: string;
  bodyHtml: string | null;
  bodyText: string | null;
  fromEmail: string;
  replyToEmail: string | null;
}): string[] {
  const issues: string[] = [];
  const subject = input.subject.trim();
  const body = `${input.bodyHtml ?? ""}\n${input.bodyText ?? ""}`.toLowerCase();

  if (!subject) issues.push("Campaign subject is required.");
  if (!isValidEmailAddress(input.fromEmail)) issues.push("A valid fromEmail is required.");
  if (input.replyToEmail && !isValidEmailAddress(input.replyToEmail)) {
    issues.push("replyToEmail must be a valid email address.");
  }

  if (requiresPreferenceCompliance(input.purpose)) {
    const hasUnsubscribeControl = body.includes("unsubscribe") || body.includes("{{unsubscribe_url}}");
    const hasPreferencesControl = body.includes("preferences") || body.includes("{{preferences_url}}");

    if (!hasUnsubscribeControl) {
      issues.push("Marketing/fundraising emails must include an unsubscribe control.");
    }
    if (!hasPreferencesControl) {
      issues.push("Marketing/fundraising emails must include a manage-preferences control.");
    }
  }

  return issues;
}

/** Creates a deterministic SHA-256 token hash for public unsubscribe/preference links. */
export function hashPublicEmailToken(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Evaluates one recipient list against do-not-contact flags, suppressions, and category/global preferences.
 * Returns both eligible recipients and detailed skip reasons for compliance reporting.
 */
export async function evaluateRecipientEligibility(params: {
  organizationId: string;
  purpose: EmailPurpose;
  candidates: EmailRecipientCandidate[];
}): Promise<EmailEligibilityResult> {
  const category = categoryForPurpose(params.purpose);
  const normalizedRows = params.candidates.map((row) => ({
    ...row,
    email: row.email.trim().toLowerCase(),
  }));

  const distinctEmails = Array.from(new Set(normalizedRows.map((row) => row.email).filter(Boolean)));

  const constituents = distinctEmails.length > 0
    ? await prisma.constituent.findMany({
      where: {
        organizationId: params.organizationId,
        email: { in: distinctEmails },
      },
      select: {
        id: true,
        email: true,
        doNotEmail: true,
        doNotContact: true,
        emailOptOut: true,
      },
    })
    : [];

  const byEmailConstituent = new Map<string, {
    id: string;
    doNotEmail: boolean;
    doNotContact: boolean;
    emailOptOut: boolean;
  }>();

  for (const row of constituents) {
    const email = row.email?.trim().toLowerCase();
    if (!email || byEmailConstituent.has(email)) continue;
    byEmailConstituent.set(email, {
      id: row.id,
      doNotEmail: row.doNotEmail,
      doNotContact: row.doNotContact,
      emailOptOut: row.emailOptOut,
    });
  }

  const subscriptionsExisting = distinctEmails.length > 0
    ? await prisma.emailSubscription.findMany({
      where: {
        organizationId: params.organizationId,
        email: { in: distinctEmails },
      },
      select: {
        id: true,
        email: true,
        globalStatus: true,
      },
    })
    : [];

  const subscriptionByEmail = new Map<string, { id: string; globalStatus: EmailSubscriptionStatus }>();
  for (const row of subscriptionsExisting) {
    subscriptionByEmail.set(row.email.trim().toLowerCase(), {
      id: row.id,
      globalStatus: row.globalStatus,
    });
  }

  const missingSubscriptionEmails = distinctEmails.filter((email) => !subscriptionByEmail.has(email));
  if (missingSubscriptionEmails.length > 0) {
    await prisma.emailSubscription.createMany({
      data: missingSubscriptionEmails.map((email) => ({
        organizationId: params.organizationId,
        email,
        constituentId: byEmailConstituent.get(email)?.id,
        globalStatus: "UNKNOWN",
        source: "campaign-send",
      })),
      skipDuplicates: true,
    });

    const createdRows = await prisma.emailSubscription.findMany({
      where: {
        organizationId: params.organizationId,
        email: { in: missingSubscriptionEmails },
      },
      select: {
        id: true,
        email: true,
        globalStatus: true,
      },
    });
    for (const row of createdRows) {
      subscriptionByEmail.set(row.email.trim().toLowerCase(), {
        id: row.id,
        globalStatus: row.globalStatus,
      });
    }
  }

  const suppressionRows = distinctEmails.length > 0
    ? await prisma.emailSuppression.findMany({
      where: {
        organizationId: params.organizationId,
        active: true,
        email: { in: distinctEmails },
      },
      select: {
        email: true,
        reason: true,
      },
    })
    : [];

  const suppressionByEmail = new Map<string, EmailSuppressionReason>();
  for (const row of suppressionRows) {
    const email = row.email.trim().toLowerCase();
    if (!suppressionByEmail.has(email)) suppressionByEmail.set(email, row.reason);
  }

  const preferenceRequired = requiresPreferenceCompliance(params.purpose);
  const subscriptionIds = Array.from(new Set(
    Array.from(subscriptionByEmail.values()).map((value) => value.id),
  ));

  const preferenceRows = preferenceRequired && subscriptionIds.length > 0
    ? await prisma.emailPreference.findMany({
      where: {
        organizationId: params.organizationId,
        subscriptionId: { in: subscriptionIds },
        category,
      },
      select: {
        subscriptionId: true,
        status: true,
      },
    })
    : [];

  const preferenceBySubscription = new Map<string, "SUBSCRIBED" | "UNSUBSCRIBED">();
  for (const row of preferenceRows) {
    preferenceBySubscription.set(row.subscriptionId, row.status);
  }

  const seenEmails = new Set<string>();
  const decisions: EmailEligibilityDecision[] = [];
  const eligible: string[] = [];

  const summary: EmailEligibilitySummary = {
    totalMatched: normalizedRows.length,
    validEmail: 0,
    missingEmail: 0,
    optedOut: 0,
    duplicateEmails: 0,
    suppressionCount: 0,
    finalSendCount: 0,
    categoryOptOut: 0,
    doNotContact: 0,
    invalidEmail: 0,
    suppressed: 0,
  };

  for (const row of normalizedRows) {
    const email = row.email;

    if (!email) {
      summary.missingEmail += 1;
      decisions.push({
        email,
        constituentId: row.constituentId ?? null,
        subscriptionId: null,
        eligibilityStatus: "SKIPPED_MISSING_EMAIL",
        ineligibilityReason: "Missing email address",
      });
      continue;
    }

    if (!isValidEmailAddress(email)) {
      summary.invalidEmail += 1;
      decisions.push({
        email,
        constituentId: row.constituentId ?? byEmailConstituent.get(email)?.id ?? null,
        subscriptionId: subscriptionByEmail.get(email)?.id ?? null,
        eligibilityStatus: "SKIPPED_INVALID_EMAIL",
        ineligibilityReason: "Invalid email format",
      });
      continue;
    }

    summary.validEmail += 1;

    if (seenEmails.has(email)) {
      summary.duplicateEmails += 1;
      decisions.push({
        email,
        constituentId: row.constituentId ?? byEmailConstituent.get(email)?.id ?? null,
        subscriptionId: subscriptionByEmail.get(email)?.id ?? null,
        eligibilityStatus: "SKIPPED_DUPLICATE_EMAIL",
        ineligibilityReason: "Duplicate recipient email",
      });
      continue;
    }
    seenEmails.add(email);

    const constituent = byEmailConstituent.get(email);
    const doNotContact = row.doNotContact ?? constituent?.doNotContact ?? false;
    const doNotEmail = row.doNotEmail ?? constituent?.doNotEmail ?? false;
    const emailOptOut = row.emailOptOut ?? constituent?.emailOptOut ?? false;

    if (doNotContact || doNotEmail) {
      summary.doNotContact += 1;
      summary.optedOut += 1;
      decisions.push({
        email,
        constituentId: row.constituentId ?? constituent?.id ?? null,
        subscriptionId: subscriptionByEmail.get(email)?.id ?? null,
        eligibilityStatus: "SKIPPED_DO_NOT_CONTACT",
        ineligibilityReason: "Constituent is marked do-not-contact or do-not-email",
      });
      continue;
    }

    if (emailOptOut && preferenceRequired) {
      summary.optedOut += 1;
      decisions.push({
        email,
        constituentId: row.constituentId ?? constituent?.id ?? null,
        subscriptionId: subscriptionByEmail.get(email)?.id ?? null,
        eligibilityStatus: "SKIPPED_UNSUBSCRIBED",
        ineligibilityReason: "Constituent email opt-out is enabled",
      });
      continue;
    }

    const suppressionReason = suppressionByEmail.get(email);
    if (suppressionReason) {
      summary.suppressed += 1;
      decisions.push({
        email,
        constituentId: row.constituentId ?? constituent?.id ?? null,
        subscriptionId: subscriptionByEmail.get(email)?.id ?? null,
        eligibilityStatus: suppressionReason === "HARD_BOUNCE"
          ? "SKIPPED_HARD_BOUNCE"
          : "SKIPPED_SUPPRESSED",
        ineligibilityReason: `Suppressed: ${suppressionReason}`,
      });
      continue;
    }

    const subscription = subscriptionByEmail.get(email);
    if (preferenceRequired && subscription) {
      if (subscription.globalStatus === "UNSUBSCRIBED" || subscription.globalStatus === "SUPPRESSED") {
        summary.optedOut += 1;
        decisions.push({
          email,
          constituentId: row.constituentId ?? constituent?.id ?? null,
          subscriptionId: subscription.id,
          eligibilityStatus: "SKIPPED_UNSUBSCRIBED",
          ineligibilityReason: `Global status is ${subscription.globalStatus}`,
        });
        continue;
      }

      if (subscription.globalStatus === "BOUNCED") {
        summary.suppressed += 1;
        decisions.push({
          email,
          constituentId: row.constituentId ?? constituent?.id ?? null,
          subscriptionId: subscription.id,
          eligibilityStatus: "SKIPPED_HARD_BOUNCE",
          ineligibilityReason: "Global status is BOUNCED",
        });
        continue;
      }

      const categoryPreference = preferenceBySubscription.get(subscription.id);
      if (categoryPreference === "UNSUBSCRIBED") {
        summary.categoryOptOut += 1;
        decisions.push({
          email,
          constituentId: row.constituentId ?? constituent?.id ?? null,
          subscriptionId: subscription.id,
          eligibilityStatus: "SKIPPED_CATEGORY_OPT_OUT",
          ineligibilityReason: `Category ${category} is unsubscribed`,
        });
        continue;
      }
    }

    eligible.push(email);
    decisions.push({
      email,
      constituentId: row.constituentId ?? constituent?.id ?? null,
      subscriptionId: subscription?.id ?? null,
      eligibilityStatus: "ELIGIBLE",
      ineligibilityReason: null,
    });
  }

  summary.suppressionCount = summary.missingEmail
    + summary.optedOut
    + summary.duplicateEmails
    + summary.invalidEmail
    + summary.suppressed
    + summary.categoryOptOut
    + summary.doNotContact;
  summary.finalSendCount = eligible.length;

  return {
    category,
    decisions,
    recipients: eligible,
    summary,
  };
}
