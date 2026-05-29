/** Shared execution helpers for letters preview/generation across API routes and steward-path steps. */
import { type LetterCategory, type LetterTemplateStatus } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { collectMergeFieldKeys, renderMergeFields, unsupportedMergeFieldKeys } from "./letters-merge.js";

interface TemplateForMerge {
  id: string;
  name: string;
  category: LetterCategory;
  status: LetterTemplateStatus;
  printBody: string;
  emailBody: string | null;
  printSubject: string | null;
  emailSubject: string | null;
}

export interface ResolveMergeContextInput {
  organizationId: string;
  template: Pick<TemplateForMerge, "id" | "printBody" | "emailBody" | "printSubject" | "emailSubject">;
  constituentId?: string;
  donationId?: string;
  campaignId?: string;
  eventId?: string;
  year?: number;
  actorUserId?: string;
}

export interface ResolveMergeContextOutput {
  values: Record<string, string>;
  unsupportedFields: string[];
  missingFields: string[];
  mergedPrintBody: string;
  mergedEmailBody: string | null;
  mergedPrintSubject: string | null;
  mergedEmailSubject: string | null;
  resolvedConstituentId: string | null;
  resolvedDonationId: string | null;
  resolvedCampaignId: string | null;
  resolvedEventId: string | null;
}

export interface GenerateLetterInput {
  organizationId: string;
  templateId: string;
  actorUserId: string;
  constituentId?: string;
  donationId?: string;
  campaignId?: string;
  eventId?: string;
  year?: number;
  sourceTaskId?: string;
  stewardPathEnrollmentId?: string;
  stewardPathStepRunId?: string;
  activeOnly?: boolean;
}

export type GenerationValidationCode =
  | "VALID"
  | "MISSING_ADDRESS"
  | "MISSING_REQUIRED_MERGE_DATA"
  | "UNSUPPORTED_MERGE_FIELD"
  | "SUPPRESSED_DO_NOT_MAIL";

export interface GenerationValidationResult {
  valid: boolean;
  reasons: GenerationValidationCode[];
}

interface GenerationValidationInput {
  constituent?: {
    doNotMail?: boolean | null;
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    zip?: string | null;
  } | null;
  merged: Pick<ResolveMergeContextOutput, "missingFields" | "unsupportedFields" | "mergedPrintBody">;
  options?: {
    requireMailingAddress?: boolean;
    requireMergeData?: boolean;
    allowPdfOnlyWithoutAddress?: boolean;
  };
}

interface TemplateForGenerationOptions {
  activeOnly?: boolean;
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

/** Returns true when the constituent has enough mailing fields for printed delivery. */
function hasCompleteMailAddress(constituent: GenerationValidationInput["constituent"]): boolean {
  if (!constituent) return true;
  return Boolean(constituent.addressLine1 && constituent.city && constituent.state && constituent.zip);
}

/** Applies the same eligibility rules used by single and batch generation flows. */
export function validateGenerationPlan(input: GenerationValidationInput): GenerationValidationResult {
  const reasons: GenerationValidationCode[] = [];
  const requireMailingAddress = input.options?.requireMailingAddress ?? true;
  const requireMergeData = input.options?.requireMergeData ?? true;
  const allowPdfOnlyWithoutAddress = input.options?.allowPdfOnlyWithoutAddress ?? false;

  if (input.constituent?.doNotMail) {
    reasons.push("SUPPRESSED_DO_NOT_MAIL");
  }

  if (requireMailingAddress && !allowPdfOnlyWithoutAddress && !hasCompleteMailAddress(input.constituent)) {
    reasons.push("MISSING_ADDRESS");
  }

  if ((input.merged.unsupportedFields ?? []).length > 0) {
    reasons.push("UNSUPPORTED_MERGE_FIELD");
  }

  if (requireMergeData && ((input.merged.missingFields ?? []).length > 0 || input.merged.mergedPrintBody.includes("{{"))) {
    reasons.push("MISSING_REQUIRED_MERGE_DATA");
  }

  return {
    valid: reasons.length === 0,
    reasons: reasons.length === 0 ? ["VALID"] : reasons,
  };
}

/** Loads merge context and resolves all placeholders used by letters. */
export async function resolveLetterMergeContext(params: ResolveMergeContextInput): Promise<ResolveMergeContextOutput> {
  const [organization, settings, user, brandingSetting] = await Promise.all([
    prisma.organization.findUnique({ where: { id: params.organizationId }, select: { id: true, name: true } }),
    prisma.organizationSettings.findUnique({
      where: { organizationId: params.organizationId },
      select: { smtpFromEmail: true, smtpFromName: true },
    }),
    params.actorUserId
      ? prisma.user.findUnique({ where: { id: params.actorUserId }, select: { id: true, firstName: true, lastName: true, email: true, role: true } })
      : Promise.resolve(null),
    prisma.pluginSetting.findUnique({
      where: {
        organizationId_pluginKey: {
          organizationId: params.organizationId,
          pluginKey: "organization-branding",
        },
      },
      select: { config: true },
    }),
  ]);

  const brandingConfig = brandingSetting?.config && typeof brandingSetting.config === "object" && !Array.isArray(brandingSetting.config)
    ? (brandingSetting.config as Record<string, unknown>)
    : {};
  const readBrandingText = (key: string): string => {
    const raw = brandingConfig[key];
    return typeof raw === "string" ? raw.trim() : "";
  };
  const organizationMission = readBrandingText("missionStatement") || readBrandingText("tagline");

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
          household: { select: { id: true, name: true } },
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
  const donorAddressBlock = [
    constituent?.addressLine1,
    constituent?.addressLine2,
    [constituent?.city, constituent?.state, constituent?.zip].filter(Boolean).join(", ").replace(", ", ", "),
  ].filter((value) => Boolean(value && value.trim())).join("<br />");
  const campaignName = campaign?.name ?? donation?.campaign?.name ?? "";
  const eventName = event?.name ?? donation?.event?.name ?? "";

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
    "donor.addressBlock": donorAddressBlock,
    "donor.salutation": constituent?.firstName ? `Dear ${constituent.firstName},` : "Dear Friend,",
    "gift.amount": formatCurrency(donation?.amount ?? 0),
    "gift.date": formatDate(donation?.date),
    "gift.fund": donation?.designation?.name ?? "",
    "gift.campaign": campaignName,
    "gift.paymentMethod": donation?.paymentMethod ? donation.paymentMethod.replace(/_/g, " ") : "",
    "gift.receiptNumber": donation?.receiptNumber ?? "",
    "gift.taxDeductibleAmount": formatCurrency(donation?.taxDeductible ? donation.amount : 0),
    "year": String(targetYear),
    "year.totalGiving": formatCurrency(yearTotal),
    "year.firstGiftDate": formatDate(firstGift),
    "year.lastGiftDate": formatDate(lastGift),
    "year.numberOfGifts": String(yearDonations.length),
    "campaign.name": campaignName,
    "event.name": eventName,
    "household.name": constituent?.household?.name ?? "",
    "organization.name": organization?.name ?? "",
    "organization.mission": organizationMission,
    "organization.address": "",
    "organization.phone": "",
    "organization.email": settings?.smtpFromEmail ?? "",
    "organization.website": "",
    "organization.taxId": "",
    "staff.fullName": user ? `${user.firstName} ${user.lastName}`.trim() : "",
    "staff.title": user?.role ? user.role.toUpperCase() : "",
    "staff.email": user?.email ?? "",
  };

  const missingFields = new Set<string>();
  const renderOptions = { missingMode: "highlight" as const, missingFields };
  const mergedPrintBody = renderMergeFields(params.template.printBody, values, renderOptions);
  const mergedEmailBody = params.template.emailBody ? renderMergeFields(params.template.emailBody, values, renderOptions) : null;
  const mergedPrintSubject = params.template.printSubject ? renderMergeFields(params.template.printSubject, values, renderOptions) : null;
  const mergedEmailSubject = params.template.emailSubject ? renderMergeFields(params.template.emailSubject, values, renderOptions) : null;

  const keys = collectMergeFieldKeys(
    params.template.printBody,
    params.template.emailBody,
    params.template.printSubject,
    params.template.emailSubject,
  );

  return {
    values,
    unsupportedFields: unsupportedMergeFieldKeys(keys),
    missingFields: Array.from(missingFields).sort(),
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

/** Loads a template row for generation and enforces organization scoping. */
export async function getTemplateForGeneration(
  organizationId: string,
  templateId: string,
  options: TemplateForGenerationOptions = {},
): Promise<TemplateForMerge | null> {
  return prisma.letterTemplate.findFirst({
    where: {
      id: templateId,
      organizationId,
      ...(options.activeOnly ? { status: "ACTIVE" } : {}),
    },
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
}

/** Generates and stores one merged letter with communication activity linkage when constituent context exists. */
export async function generateLetterFromTemplate(input: GenerateLetterInput) {
  const template = await getTemplateForGeneration(input.organizationId, input.templateId, {
    activeOnly: input.activeOnly ?? true,
  });
  if (!template) return null;

  const merged = await resolveLetterMergeContext({
    organizationId: input.organizationId,
    template,
    constituentId: input.constituentId,
    donationId: input.donationId,
    campaignId: input.campaignId,
    eventId: input.eventId,
    year: input.year,
    actorUserId: input.actorUserId,
  });

  const generated = await prisma.$transaction(async (tx) => {
    const created = await tx.generatedLetter.create({
      data: {
        organizationId: input.organizationId,
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
        sourceTaskId: input.sourceTaskId,
        stewardPathEnrollmentId: input.stewardPathEnrollmentId,
        stewardPathStepRunId: input.stewardPathStepRunId,
        generatedByUserId: input.actorUserId,
        metadataJson: {
          unsupportedMergeFields: merged.unsupportedFields,
          missingMergeFields: merged.missingFields,
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
          description: `Generated ${template.category.toLowerCase().replace(/_/g, " ")} letter from template: ${template.name}`,
          metadata: {
            source: "letters-printables",
            communicationType: "printed_letter",
            letterId: created.id,
            templateId: template.id,
            category: template.category,
            sourceTaskId: input.sourceTaskId,
            stewardPathEnrollmentId: input.stewardPathEnrollmentId,
            stewardPathStepRunId: input.stewardPathStepRunId,
          },
          userId: input.actorUserId,
        },
      });

      return tx.generatedLetter.update({
        where: { id: created.id },
        data: { communicationActivityId: activity.id },
      });
    }

    return created;
  });

  return {
    template,
    merged,
    generated,
  };
}
