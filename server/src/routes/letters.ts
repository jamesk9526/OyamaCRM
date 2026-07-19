/**
 * Donor CRM Letters & Printables API routes.
 * Provides template management, merge preview, generated letters, and email-draft integration.
 */
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { Router, type Request } from "express";
import type { jsPDF as JsPdfDocument } from "jspdf";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { hasDefaultPermission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { isSchemaDriftError, migrationRequiredMessage } from "../lib/prisma-runtime-errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import {
  generateLetterFromTemplate,
  getTemplateForGeneration,
  resolveLetterMergeContext,
  validateGenerationPlan,
  type GenerationValidationCode,
} from "../services/letters-execution.js";
import {
  collectMergeFieldKeys,
  COMPATIBILITY_LETTER_MERGE_FIELDS,
  SIMPLE_LETTER_MERGE_FIELDS,
  SUPPORTED_LETTER_MERGE_FIELDS,
  unsupportedMergeFieldKeys,
} from "../services/letters-merge.js";
import { parseStewardAiConfig, runStewardAiChat, type StewardAiChatMessage } from "../services/steward-ai-ollama.js";
import { withStewardAiTask } from "../services/steward-ai-runtime-status.js";

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
const PRINT_QUEUE_STATUSES = ["GENERATED", "NEEDS_REVIEW", "APPROVED", "QUEUED_FOR_PRINT", "PRINTED", "FAILED", "CANCELED", "ARCHIVED"] as const;
const MAIL_QUEUE_STATUSES = ["QUEUED_FOR_MAIL", "MAILED", "RETURNED", "ADDRESS_ISSUE", "COMPLETED", "CANCELED", "ARCHIVED"] as const;
const LETTER_PRIORITY = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const LETTER_DELIVERY_TARGETS = ["PDF_ONLY", "PRINT_QUEUE", "MAIL_QUEUE"] as const;
const LETTER_DONATION_MODES = ["none", "specific", "recent", "selected"] as const;
const LETTER_WORKFLOW_POLICY_PLUGIN_KEY = "letters-workflow-settings";
const LETTER_PUBLISH_HISTORY_PLUGIN_KEY = "letters-template-publish-history";
const LETTER_BRANDING_PLUGIN_KEY = "organization-branding";
const STEWARD_AI_PLUGIN_KEY = "steward_ai";
const LETTER_TEMPLATE_AI_ASSISTED_MARKER = "oyama-ai-assisted";
const LETTER_TEMPLATE_EXPORT_SCHEMA = "oyama-letter-template-export";
const LETTER_TEMPLATE_EXPORT_VERSION = 1;
const LETTER_PUBLISH_HISTORY_LIMIT = 200;
const PDF_FALLBACK_MODES = ["BROWSER_PRINT", "SERVER_RENDER"] as const;
const LETTER_MEDIA_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

type PrintQueueStatus = (typeof PRINT_QUEUE_STATUSES)[number];
type MailQueueStatus = (typeof MAIL_QUEUE_STATUSES)[number];
type LetterPriority = (typeof LETTER_PRIORITY)[number];
type PdfFallbackMode = (typeof PDF_FALLBACK_MODES)[number];
type LetterDeliveryTarget = (typeof LETTER_DELIVERY_TARGETS)[number];
type LetterDonationMode = (typeof LETTER_DONATION_MODES)[number];
type LetterTemplateExportPayload = {
  schema: typeof LETTER_TEMPLATE_EXPORT_SCHEMA;
  version: typeof LETTER_TEMPLATE_EXPORT_VERSION;
  kind: "oyama-letter-template";
  exportedAt: string;
  source: {
    templateId: string;
    organizationId: string;
    app: "OyamaLetters";
  };
  template: {
    name: string;
    category: string;
    description: string | null;
    printSubject: string | null;
    printBody: string;
    printLayoutJson: unknown;
    emailSubject: string | null;
    emailBody: string | null;
    headerPresetId: string | null;
    footerPresetId: string | null;
    signatureBlockId: string | null;
    logoMode: string;
    customLogoUrl: string | null;
    crmScope: string;
  };
};

interface LetterPdfBrandingContext {
  organizationName: string;
  tagline: string;
  addressLine: string;
  contactLine: string;
  taxId: string;
  footerLegalText: string;
  globalHeaderHtml?: string;
  globalFooterHtml?: string;
  logoDataUrl: string | null;
  logoFormat: "PNG" | "JPEG" | "WEBP" | null;
  primaryColor: string;
}

interface LetterPdfPresetContext {
  headerPreset?: {
    logoAlignment?: string | null;
    showOrganizationName: boolean;
    showTagline: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showWebsite: boolean;
    customHtml?: string | null;
  } | null;
  footerPreset?: {
    showOrganizationName: boolean;
    showAddress: boolean;
    showPhone: boolean;
    showEmail: boolean;
    showWebsite: boolean;
    showTaxId: boolean;
    showPageNumber: boolean;
    customText?: string | null;
    customHtml?: string | null;
  } | null;
  signatureBlock?: {
    signerName: string;
    signerTitle?: string | null;
    closingPhrase?: string | null;
    signatureImageUrl?: string | null;
    typedSignature?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
}

interface LetterPdfRecipientContext {
  fullName: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  zip: string;
}

interface LettersWorkflowPolicy {
  autoQueueBatchToPrint: boolean;
  requirePrintApproval: boolean;
  defaultPriority: LetterPriority;
  mailingSlaDays: number;
  allowDirectMailQueue: boolean;
  enableAddressValidationGate: boolean;
  pdfFallbackMode: PdfFallbackMode;
  notes: string;
}

interface GeneratedLetterQueueMetadata {
  printStatus?: PrintQueueStatus;
  mailStatus?: MailQueueStatus;
  reviewStatus?: "NEEDS_REVIEW" | "APPROVED";
  priority?: LetterPriority;
  batchId?: string;
  statusNote?: string;
  returnReason?: string;
  queuedForPrintAt?: string;
  queuedForMailAt?: string;
  returnedAt?: string;
  updatedByUserId?: string;
}

interface LetterTemplatePublishSnapshot {
  id: string;
  templateId: string;
  templateName: string;
  createdAt: string;
  createdByUserId: string;
  previousStatus: string;
  nextStatus: string;
  unsupportedFields: string[];
  warnings: string[];
  sampleValidation: {
    valid: boolean;
    reasons: string[];
  } | null;
  samplePdfPreflight: {
    checked: boolean;
    canRender: boolean;
    renderer: "SERVER_RENDER";
    parser: "htmlToPdfBlocks";
    blockCount: number;
    reason: "NO_SAMPLE_RECIPIENT" | "PARSER_FAILURE" | null;
  };
  snapshot: {
    name: string;
    category: string;
    status: string;
    headerPresetId: string | null;
    footerPresetId: string | null;
    signatureBlockId: string | null;
    logoMode: string;
    customLogoUrl: string | null;
    printSubject: string | null;
    printBody: string;
    emailSubject: string | null;
    emailBody: string | null;
  };
}

interface LetterAiComposePayload {
  prompt?: string;
  tone?: string;
  length?: string;
  useMergeFields?: boolean;
  selectedText?: string;
  currentBodyHtml?: string;
  templateName?: string;
  category?: string;
}

interface LetterAiSuggestPayload {
  textBeforeCursor?: string;
  currentBodyHtml?: string;
  previousSuggestion?: string;
  templateName?: string;
  category?: string;
  useMergeFields?: boolean;
}

interface ParsedLetterAiCompose {
  bodyText: string;
  bodyHtml: string;
  mergeFieldsUsed: string[];
}

router.use(requireAuth);

/** Resolves a safe image extension for editor and signature uploads. */
function resolveLetterMediaExtension(mimeType: string, fileName: string): string {
  const normalized = mimeType.toLowerCase();
  if (LETTER_MEDIA_EXTENSIONS[normalized]) return LETTER_MEDIA_EXTENSIONS[normalized];
  const fromName = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(fromName)) return fromName === "jpeg" ? "jpg" : fromName;
  return "png";
}

/** Validates and returns the active organization context for one request. */
async function requireOrganizationId(req: Request): Promise<string | null> {
  const organizationId = await resolveOrganizationId({ req });
  return organizationId || null;
}

/** Normalizes Express route id params into one string value. */
function getRouteId(req: Request): string {
  const raw = req.params?.id;
  if (Array.isArray(raw)) return raw[0] ?? "";
  return raw ?? "";
}

/** Parses one enum-like input value against an allowed literal list. */
function parseEnum<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toUpperCase();
  return allowed.find((item) => item.toUpperCase() === normalized) ?? null;
}

/** Normalizes optional string id values and maps blank strings to null. */
function normalizeOptionalId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}

/** Converts unknown request bodies to plain records for import parsing. */
function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Converts unknown JSON input to a JSON-safe value for Prisma JSON storage. */
function asJsonObject(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  } catch {
    return undefined;
  }
}

function sanitizeJsonDownloadName(value: string): string {
  const cleaned = value.trim().replace(/[^a-z0-9_-]+/gi, "_").replace(/^_+|_+$/g, "");
  return cleaned || "template";
}

async function normalizeImportedLetterPresetId(
  kind: "header" | "footer" | "signature",
  value: unknown,
  organizationId: string,
): Promise<string | null> {
  const id = normalizeOptionalId(value);
  if (!id) return null;
  if (kind === "header") {
    const match = await prisma.letterHeaderPreset.findFirst({ where: { id, organizationId }, select: { id: true } });
    return match?.id ?? null;
  }
  if (kind === "footer") {
    const match = await prisma.letterFooterPreset.findFirst({ where: { id, organizationId }, select: { id: true } });
    return match?.id ?? null;
  }
  const match = await prisma.letterSignatureBlock.findFirst({ where: { id, organizationId }, select: { id: true } });
  return match?.id ?? null;
}

function unwrapLetterTemplateImport(input: unknown): Record<string, unknown> {
  const body = asRecord(input);
  const wrapped = asRecord(body.export);
  return Object.keys(wrapped).length > 0 ? wrapped : body;
}

/** Maps shared validation output into stable batch skip reason strings. */
function toBatchSkipReason(reason: GenerationValidationCode): string {
  if (reason === "SUPPRESSED_DO_NOT_MAIL") return "DO_NOT_MAIL";
  if (reason === "MISSING_ADDRESS") return "MISSING_ADDRESS";
  if (reason === "UNSUPPORTED_MERGE_FIELD") return "UNSUPPORTED_MERGE_FIELDS";
  if (reason === "MISSING_REQUIRED_MERGE_DATA") return "MISSING_REQUIRED_MERGE_DATA";
  return "GENERATION_FAILED";
}

/** Reads queue metadata from GeneratedLetter.metadataJson with safe defaults. */
function readQueueMetadata(value: unknown): GeneratedLetterQueueMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const asObject = value as Record<string, unknown>;
  const queue = asObject.queue;
  if (!queue || typeof queue !== "object" || Array.isArray(queue)) return {};

  const raw = queue as Record<string, unknown>;
  return {
    printStatus: parseEnum(raw.printStatus, PRINT_QUEUE_STATUSES) ?? undefined,
    mailStatus: parseEnum(raw.mailStatus, MAIL_QUEUE_STATUSES) ?? undefined,
    reviewStatus: parseEnum(raw.reviewStatus, ["NEEDS_REVIEW", "APPROVED"] as const) ?? undefined,
    priority: parseEnum(raw.priority, LETTER_PRIORITY) ?? undefined,
    batchId: typeof raw.batchId === "string" ? raw.batchId : undefined,
    statusNote: typeof raw.statusNote === "string" ? raw.statusNote : undefined,
    returnReason: typeof raw.returnReason === "string" ? raw.returnReason : undefined,
    queuedForPrintAt: typeof raw.queuedForPrintAt === "string" ? raw.queuedForPrintAt : undefined,
    queuedForMailAt: typeof raw.queuedForMailAt === "string" ? raw.queuedForMailAt : undefined,
    returnedAt: typeof raw.returnedAt === "string" ? raw.returnedAt : undefined,
    updatedByUserId: typeof raw.updatedByUserId === "string" ? raw.updatedByUserId : undefined,
  };
}

/** Writes queue metadata back to metadataJson while preserving existing non-queue fields. */
function buildMetadataWithQueue(existing: unknown, queue: GeneratedLetterQueueMetadata): Prisma.InputJsonValue {
  const safeBase = existing && typeof existing === "object" && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {};

  const queueJson = JSON.parse(JSON.stringify(queue)) as Prisma.InputJsonValue;

  return JSON.parse(JSON.stringify({
    ...safeBase,
    queue: queueJson,
  })) as Prisma.InputJsonValue;
}

/** Derives print queue status from explicit queue metadata and legacy generated-letter status. */
function derivePrintQueueStatus(letterStatus: string, queue: GeneratedLetterQueueMetadata): PrintQueueStatus {
  if (queue.printStatus) return queue.printStatus;
  if (letterStatus === "PRINTED") return "PRINTED";
  if (letterStatus === "ARCHIVED") return "ARCHIVED";
  return "GENERATED";
}

/** Derives mail queue status from explicit queue metadata and legacy generated-letter status. */
function deriveMailQueueStatus(letterStatus: string, queue: GeneratedLetterQueueMetadata): MailQueueStatus {
  if (queue.mailStatus) return queue.mailStatus;
  if (letterStatus === "MAILED") return "MAILED";
  return "QUEUED_FOR_MAIL";
}

/** True when address fields appear complete enough for mail-queue fulfillment. */
function hasCompleteMailAddress(constituent: {
  addressLine1?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
} | null | undefined): boolean {
  if (!constituent) return false;
  return Boolean(
    constituent.addressLine1?.trim()
    && constituent.city?.trim()
    && constituent.state?.trim()
    && constituent.zip?.trim(),
  );
}

const ADDRESS_MERGE_FIELDS = new Set([
  "donor.addressLine1",
  "donor.addressLine2",
  "donor.city",
  "donor.state",
  "donor.zip",
  "donor.addressBlock",
  "constituent.addressLine1",
  "constituent.addressLine2",
  "constituent.city",
  "constituent.state",
  "constituent.zip",
  "constituent.addressBlock",
]);

/** Returns true when a template references fields that need recipient mailing data. */
function templateUsesAddressMergeFields(template: {
  printBody?: string | null;
  emailBody?: string | null;
  printSubject?: string | null;
  emailSubject?: string | null;
}): boolean {
  return collectMergeFieldKeys(template.printBody, template.emailBody, template.printSubject, template.emailSubject)
    .some((field) => ADDRESS_MERGE_FIELDS.has(field));
}

/** Parses optional donation date filters from the batch/generate payload. */
function parseDonationDateRange(rawRange: unknown, legacyFrom?: unknown, legacyTo?: unknown): { from?: Date; to?: Date } {
  const parseStart = (raw: unknown): Date | undefined => {
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    const parsed = new Date(`${raw.trim()}T00:00:00.000Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };
  const parseEnd = (raw: unknown): Date | undefined => {
    if (typeof raw !== "string" || !raw.trim()) return undefined;
    const parsed = new Date(`${raw.trim()}T23:59:59.999Z`);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  };

  if (rawRange && typeof rawRange === "object" && !Array.isArray(rawRange)) {
    const range = rawRange as Record<string, unknown>;
    return { from: parseStart(range.from), to: parseEnd(range.to) };
  }

  if (typeof legacyFrom === "string" || typeof legacyTo === "string") {
    return { from: parseStart(legacyFrom), to: parseEnd(legacyTo) };
  }

  const label = typeof rawRange === "string" ? rawRange.trim().toLowerCase() : "";
  const now = new Date();
  if (!label || label === "all time") return {};
  if (label === "last 30 days") return { from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
  if (label === "last 90 days") return { from: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000), to: now };
  if (label === "last 12 months") return { from: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000), to: now };
  if (label === "this year") return { from: new Date(Date.UTC(now.getUTCFullYear(), 0, 1)), to: now };
  return {};
}

/** Builds the qualifying donation filter shared by preview and batch generation. */
function buildDonationContextFilter(body: unknown): Prisma.DonationWhereInput {
  const raw = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
  const range = parseDonationDateRange(raw.donationDateRange, raw.dateFrom, raw.dateTo);
  const minimum = typeof raw.donationMinimum === "number"
    ? raw.donationMinimum
    : Number.parseFloat(String(raw.donationMinimum ?? ""));
  const typeLabel = typeof raw.donationType === "string" ? raw.donationType.trim() : "";
  const normalizedType = typeLabel.toUpperCase().replace(/[ -]/g, "_");
  const paymentMethod = parseEnum(normalizedType, ["CREDIT_CARD", "ACH", "CHECK", "WIRE", "STOCK", "IN_KIND", "CASH", "ONLINE"] as const);

  return {
    status: "COMPLETED",
    ...(range.from || range.to
      ? {
          date: {
            ...(range.from ? { gte: range.from } : {}),
            ...(range.to ? { lte: range.to } : {}),
          },
        }
      : {}),
    ...(Number.isFinite(minimum) && minimum > 0 ? { amount: { gte: minimum } } : {}),
    ...(/^recurring/i.test(typeLabel) ? { isRecurring: true } : {}),
    ...(/^one[-\s]?time/i.test(typeLabel) ? { isRecurring: false } : {}),
    ...(paymentMethod ? { paymentMethod } : {}),
  };
}

/** Finds the most recent completed donation matching the user's donation context choices. */
async function resolveRecentDonationIdForRecipient(params: {
  organizationId: string;
  constituentId: string;
  donationWhere: Prisma.DonationWhereInput;
}): Promise<string | undefined> {
  const row = await prisma.donation.findFirst({
    where: {
      ...params.donationWhere,
      constituentId: params.constituentId,
      constituent: { organizationId: params.organizationId },
    },
    select: { id: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });
  return row?.id;
}

function parseDonationIds(rawDonationIds: unknown): string[] {
  const readDonationId = (value: unknown): string => {
    if (typeof value === "string") return value.trim();
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (typeof record.id === "string") return record.id.trim();
      if (typeof record.donationId === "string") return record.donationId.trim();
    }
    return "";
  };
  if (Array.isArray(rawDonationIds)) {
    return Array.from(new Set(rawDonationIds.map(readDonationId).filter(Boolean)));
  }
  const single = readDonationId(rawDonationIds);
  return single ? [single] : [];
}

async function buildSelectedDonationIdByConstituent(params: {
  organizationId: string;
  donationIds: string[];
}): Promise<Map<string, string>> {
  if (params.donationIds.length === 0) return new Map();

  const rows = await prisma.donation.findMany({
    where: {
      id: { in: params.donationIds },
      status: "COMPLETED",
      constituent: { organizationId: params.organizationId },
    },
    select: { id: true, constituentId: true, date: true, createdAt: true },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
  });

  const byConstituent = new Map<string, string>();
  for (const row of rows) {
    if (!byConstituent.has(row.constituentId)) {
      byConstituent.set(row.constituentId, row.id);
    }
  }
  return byConstituent;
}

async function resolveDonationIdForRecipient(params: {
  organizationId: string;
  constituentId?: string;
  donationMode: LetterDonationMode;
  specificDonationId?: string;
  selectedDonationIds?: string[];
  selectedDonationIdByConstituent?: Map<string, string>;
  donationWhere: Prisma.DonationWhereInput;
}): Promise<string | undefined> {
  if (params.donationMode === "specific") return params.specificDonationId;
  if (!params.constituentId) return undefined;
  if (params.donationMode === "selected") {
    const selectedForConstituent = params.selectedDonationIdByConstituent?.get(params.constituentId);
    if (selectedForConstituent) return selectedForConstituent;
    if (params.selectedDonationIds?.length === 1) return params.selectedDonationIds[0];
    return undefined;
  }
  if (params.donationMode === "recent") {
    return resolveRecentDonationIdForRecipient({
      organizationId: params.organizationId,
      constituentId: params.constituentId,
      donationWhere: params.donationWhere,
    });
  }
  return undefined;
}

/** Produces initial queue metadata for generated letters without calling guarded queue actions. */
function buildDeliveryQueueMetadata(params: {
  deliveryTarget: LetterDeliveryTarget;
  workflowPolicy: LettersWorkflowPolicy;
  userId: string;
  constituent?: { addressLine1?: string | null; city?: string | null; state?: string | null; zip?: string | null } | null;
}): GeneratedLetterQueueMetadata | null {
  const now = new Date().toISOString();
  if (params.deliveryTarget === "PDF_ONLY") return null;

  if (params.deliveryTarget === "PRINT_QUEUE") {
    return {
      printStatus: params.workflowPolicy.requirePrintApproval ? "NEEDS_REVIEW" : "QUEUED_FOR_PRINT",
      reviewStatus: params.workflowPolicy.requirePrintApproval ? "NEEDS_REVIEW" : "APPROVED",
      priority: params.workflowPolicy.defaultPriority,
      queuedForPrintAt: params.workflowPolicy.requirePrintApproval ? undefined : now,
      updatedByUserId: params.userId,
    };
  }

  const addressComplete = hasCompleteMailAddress(params.constituent);
  return {
    mailStatus: params.workflowPolicy.enableAddressValidationGate && !addressComplete ? "ADDRESS_ISSUE" : "QUEUED_FOR_MAIL",
    priority: params.workflowPolicy.defaultPriority,
    queuedForMailAt: params.workflowPolicy.enableAddressValidationGate && !addressComplete ? undefined : now,
    updatedByUserId: params.userId,
  };
}

/** Parses a positive integer value with fallback and min/max bounds. */
function parsePositiveInt(value: unknown, fallback: number, min = 1, max = 500): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

/** Default workflow policy values for print/mail operations and PDF fallback behavior. */
function defaultLettersWorkflowPolicy(): LettersWorkflowPolicy {
  return {
    autoQueueBatchToPrint: true,
    requirePrintApproval: true,
    defaultPriority: "NORMAL",
    mailingSlaDays: 7,
    allowDirectMailQueue: false,
    enableAddressValidationGate: true,
    pdfFallbackMode: "SERVER_RENDER",
    notes: "",
  };
}

/** Normalizes unknown workflow policy payloads to safe persisted values. */
function normalizeLettersWorkflowPolicy(input: unknown): LettersWorkflowPolicy {
  const defaults = defaultLettersWorkflowPolicy();
  const raw = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};

  return {
    autoQueueBatchToPrint: typeof raw.autoQueueBatchToPrint === "boolean" ? raw.autoQueueBatchToPrint : defaults.autoQueueBatchToPrint,
    requirePrintApproval: typeof raw.requirePrintApproval === "boolean" ? raw.requirePrintApproval : defaults.requirePrintApproval,
    defaultPriority: parseEnum(raw.defaultPriority, LETTER_PRIORITY) ?? defaults.defaultPriority,
    mailingSlaDays: parsePositiveInt(raw.mailingSlaDays, defaults.mailingSlaDays, 1, 30),
    allowDirectMailQueue: typeof raw.allowDirectMailQueue === "boolean" ? raw.allowDirectMailQueue : defaults.allowDirectMailQueue,
    enableAddressValidationGate: typeof raw.enableAddressValidationGate === "boolean"
      ? raw.enableAddressValidationGate
      : defaults.enableAddressValidationGate,
    pdfFallbackMode: parseEnum(raw.pdfFallbackMode, PDF_FALLBACK_MODES) ?? defaults.pdfFallbackMode,
    notes: typeof raw.notes === "string" ? raw.notes.trim().slice(0, 600) : defaults.notes,
  };
}

/** Normalizes publish history payload from plugin settings storage. */
function normalizeTemplatePublishHistory(input: unknown): LetterTemplatePublishSnapshot[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((item) => item && typeof item === "object" && !Array.isArray(item))
    .map((item) => {
      const raw = item as Record<string, unknown>;
      return {
        id: typeof raw.id === "string" ? raw.id : randomUUID(),
        templateId: typeof raw.templateId === "string" ? raw.templateId : "",
        templateName: typeof raw.templateName === "string" ? raw.templateName : "",
        createdAt: typeof raw.createdAt === "string" ? raw.createdAt : new Date(0).toISOString(),
        createdByUserId: typeof raw.createdByUserId === "string" ? raw.createdByUserId : "",
        previousStatus: typeof raw.previousStatus === "string" ? raw.previousStatus : "DRAFT",
        nextStatus: typeof raw.nextStatus === "string" ? raw.nextStatus : "ACTIVE",
        unsupportedFields: Array.isArray(raw.unsupportedFields) ? raw.unsupportedFields.map((entry) => String(entry)) : [],
        warnings: Array.isArray(raw.warnings) ? raw.warnings.map((entry) => String(entry)) : [],
        sampleValidation: raw.sampleValidation && typeof raw.sampleValidation === "object" && !Array.isArray(raw.sampleValidation)
          ? {
            valid: (raw.sampleValidation as Record<string, unknown>).valid === true,
            reasons: Array.isArray((raw.sampleValidation as Record<string, unknown>).reasons)
              ? ((raw.sampleValidation as Record<string, unknown>).reasons as unknown[]).map((entry) => String(entry))
              : [],
          }
          : null,
        samplePdfPreflight: raw.samplePdfPreflight && typeof raw.samplePdfPreflight === "object" && !Array.isArray(raw.samplePdfPreflight)
          ? {
            checked: (raw.samplePdfPreflight as Record<string, unknown>).checked === true,
            canRender: (raw.samplePdfPreflight as Record<string, unknown>).canRender === true,
            renderer: "SERVER_RENDER",
            parser: "htmlToPdfBlocks",
            blockCount: parsePositiveInt((raw.samplePdfPreflight as Record<string, unknown>).blockCount, 0, 0, 100000),
            reason: ((raw.samplePdfPreflight as Record<string, unknown>).reason === "NO_SAMPLE_RECIPIENT"
              || (raw.samplePdfPreflight as Record<string, unknown>).reason === "PARSER_FAILURE")
              ? ((raw.samplePdfPreflight as Record<string, unknown>).reason as "NO_SAMPLE_RECIPIENT" | "PARSER_FAILURE")
              : null,
          }
          : {
            checked: false,
            canRender: false,
            renderer: "SERVER_RENDER",
            parser: "htmlToPdfBlocks",
            blockCount: 0,
            reason: "NO_SAMPLE_RECIPIENT",
          },
        snapshot: raw.snapshot && typeof raw.snapshot === "object" && !Array.isArray(raw.snapshot)
          ? {
            name: typeof (raw.snapshot as Record<string, unknown>).name === "string" ? String((raw.snapshot as Record<string, unknown>).name) : "",
            category: typeof (raw.snapshot as Record<string, unknown>).category === "string" ? String((raw.snapshot as Record<string, unknown>).category) : "GENERAL",
            status: typeof (raw.snapshot as Record<string, unknown>).status === "string" ? String((raw.snapshot as Record<string, unknown>).status) : "DRAFT",
            headerPresetId: typeof (raw.snapshot as Record<string, unknown>).headerPresetId === "string" ? String((raw.snapshot as Record<string, unknown>).headerPresetId) : null,
            footerPresetId: typeof (raw.snapshot as Record<string, unknown>).footerPresetId === "string" ? String((raw.snapshot as Record<string, unknown>).footerPresetId) : null,
            signatureBlockId: typeof (raw.snapshot as Record<string, unknown>).signatureBlockId === "string" ? String((raw.snapshot as Record<string, unknown>).signatureBlockId) : null,
            logoMode: typeof (raw.snapshot as Record<string, unknown>).logoMode === "string" ? String((raw.snapshot as Record<string, unknown>).logoMode) : "ORGANIZATION_DEFAULT",
            customLogoUrl: typeof (raw.snapshot as Record<string, unknown>).customLogoUrl === "string" ? String((raw.snapshot as Record<string, unknown>).customLogoUrl) : null,
            printSubject: typeof (raw.snapshot as Record<string, unknown>).printSubject === "string" ? String((raw.snapshot as Record<string, unknown>).printSubject) : null,
            printBody: typeof (raw.snapshot as Record<string, unknown>).printBody === "string" ? String((raw.snapshot as Record<string, unknown>).printBody) : "",
            emailSubject: typeof (raw.snapshot as Record<string, unknown>).emailSubject === "string" ? String((raw.snapshot as Record<string, unknown>).emailSubject) : null,
            emailBody: typeof (raw.snapshot as Record<string, unknown>).emailBody === "string" ? String((raw.snapshot as Record<string, unknown>).emailBody) : null,
          }
          : {
            name: "",
            category: "GENERAL",
            status: "DRAFT",
            headerPresetId: null,
            footerPresetId: null,
            signatureBlockId: null,
            logoMode: "ORGANIZATION_DEFAULT",
            customLogoUrl: null,
            printSubject: null,
            printBody: "",
            emailSubject: null,
            emailBody: null,
          },
      } satisfies LetterTemplatePublishSnapshot;
    })
    .filter((entry) => Boolean(entry.templateId && entry.createdAt));
}

/** Returns immutable template publish snapshots for one organization. */
async function getTemplatePublishHistory(organizationId: string): Promise<LetterTemplatePublishSnapshot[]> {
  const row = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: LETTER_PUBLISH_HISTORY_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  return normalizeTemplatePublishHistory(row?.config)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** Appends one immutable publish snapshot to plugin settings storage. */
async function appendTemplatePublishHistory(organizationId: string, snapshot: LetterTemplatePublishSnapshot): Promise<void> {
  const current = await getTemplatePublishHistory(organizationId);
  const next = [snapshot, ...current]
    .slice(0, LETTER_PUBLISH_HISTORY_LIMIT);

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: LETTER_PUBLISH_HISTORY_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: LETTER_PUBLISH_HISTORY_PLUGIN_KEY,
      config: asJsonObject(next) ?? [],
    },
    update: {
      config: asJsonObject(next) ?? [],
    },
  });
}

/** Reads persisted workflow policy settings with safe defaults. */
async function getLettersWorkflowPolicy(organizationId: string): Promise<LettersWorkflowPolicy> {
  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: LETTER_WORKFLOW_POLICY_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  return normalizeLettersWorkflowPolicy(setting?.config);
}

/** Persists the current default letters signature into shared organization branding settings. */
async function syncDefaultLetterSignatureIntoBranding(organizationId: string): Promise<void> {
  const [defaultSignature, branding] = await Promise.all([
    prisma.letterSignatureBlock.findFirst({
      where: { organizationId, isDefault: true },
      orderBy: [{ isActive: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        name: true,
        signerName: true,
        signerTitle: true,
        closingPhrase: true,
        signatureImageUrl: true,
        typedSignature: true,
        email: true,
        phone: true,
      },
    }),
    prisma.pluginSetting.findUnique({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: LETTER_BRANDING_PLUGIN_KEY,
        },
      },
      select: { config: true },
    }),
  ]);

  const currentConfig = branding?.config && typeof branding.config === "object" && !Array.isArray(branding.config)
    ? (branding.config as Record<string, unknown>)
    : {};

  const nextConfig = {
    ...currentConfig,
    defaultLetterSignatureBlockId: defaultSignature?.id ?? "",
    defaultLetterSignatureName: defaultSignature?.name ?? "",
    defaultLetterSignerName: defaultSignature?.signerName ?? "",
    defaultLetterSignerTitle: defaultSignature?.signerTitle ?? "",
    defaultLetterClosingPhrase: defaultSignature?.closingPhrase ?? "",
    defaultLetterSignatureImageUrl: defaultSignature?.signatureImageUrl ?? "",
    defaultLetterTypedSignature: defaultSignature?.typedSignature ?? "",
    defaultLetterSignerEmail: defaultSignature?.email ?? "",
    defaultLetterSignerPhone: defaultSignature?.phone ?? "",
  };

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: LETTER_BRANDING_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: LETTER_BRANDING_PLUGIN_KEY,
      enabled: true,
      config: asJsonObject(nextConfig) ?? {},
    },
    update: {
      enabled: true,
      config: asJsonObject(nextConfig) ?? {},
    },
  });
}

/** Converts line-break text into simple HTML paragraphs for email draft creation. */
function textToHtml(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br />");
}

function plainTextToParagraphHtml(value: string): string {
  const paragraphs = value
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/g)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
  return paragraphs.length > 0
    ? paragraphs.map((paragraph) => `<p>${textToHtml(paragraph)}</p>`).join("")
    : "";
}

function asShortString(value: unknown, fallback = "", maxLength = 12000): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

function parseLetterAiComposeResponse(rawContent: string): ParsedLetterAiCompose {
  const cleaned = rawContent
    .replace(/```(?:json)?/gi, "")
    .replace(/```/g, "")
    .trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  let parsed: Record<string, unknown> | null = null;

  if (jsonMatch) {
    try {
      parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
  }

  const rawBodyText = asShortString(parsed?.bodyText, "", 8000);
  const bodyHtmlFromModel = asShortString(parsed?.bodyHtml, "", 12000)
    .replace(/<\s*(script|style|iframe|object|embed)\b[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(['"]).*?\1/gi, "")
    .replace(/\s(href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi, "");
  const normalizedText = rawBodyText || htmlToPlainText(bodyHtmlFromModel) || htmlToPlainText(cleaned);
  const mergeFieldsUsed = Array.isArray(parsed?.mergeFieldsUsed)
    ? parsed.mergeFieldsUsed.map((field) => asShortString(field, "", 120)).filter(Boolean)
    : collectMergeFieldKeys(`${bodyHtmlFromModel}\n${normalizedText}`);

  return {
    bodyText: normalizedText,
    bodyHtml: plainTextToParagraphHtml(normalizedText || htmlToPlainText(bodyHtmlFromModel)),
    mergeFieldsUsed,
  };
}

function fallbackLetterAiCompose(payload: LetterAiComposePayload): ParsedLetterAiCompose {
  const prompt = asShortString(payload.prompt, "", 1200).toLowerCase();
  const useMergeFields = payload.useMergeFields !== false;
  const salutation = useMergeFields ? "{{donor.salutation}}" : "Friend";
  const organizationName = useMergeFields ? "{{organization.name}}" : "our organization";
  const mission = useMergeFields ? "{{organization.mission}}" : "this mission";
  const giftAmount = useMergeFields ? "{{gift.amount}}" : "your gift";
  const giftDate = useMergeFields ? "{{gift.date}}" : "recently";

  const paragraphs = prompt.includes("impact")
    ? [
        `Because of your generosity, ${organizationName} can continue ${mission}.`,
        "Your partnership matters, and we are grateful for the trust you place in this work.",
      ]
    : [
        `Dear ${salutation},`,
        `Thank you for your generous gift of ${giftAmount} on ${giftDate}. Your support helps ${organizationName} continue ${mission}.`,
        "We are grateful for your partnership and for the care you show through your giving.",
      ];

  const bodyText = paragraphs.join("\n\n");
  const bodyHtml = plainTextToParagraphHtml(bodyText);
  return {
    bodyText,
    bodyHtml,
    mergeFieldsUsed: collectMergeFieldKeys(bodyText),
  };
}

function normalizeInlineSuggestion(value: string, previousSuggestion = ""): string {
  const cleaned = htmlToPlainText(value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/^["']|["']$/g, "")
    .trim())
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const sentenceMatch = cleaned.match(/^(.{1,220}?[.!?])(?:\s|$)/);
  const suggestion = sentenceMatch?.[1] ?? cleaned.slice(0, 180);
  const normalized = suggestion.replace(/^[-*]\s*/, "").trim();
  return normalized.toLowerCase() === previousSuggestion.trim().toLowerCase() ? "" : normalized;
}

function fallbackInlineSuggestion(payload: LetterAiSuggestPayload): string {
  const context = asShortString(payload.textBeforeCursor, "", 1400).trim();
  const lower = context.toLowerCase();
  const previous = asShortString(payload.previousSuggestion, "", 220).trim().toLowerCase();
  const organizationName = payload.useMergeFields !== false ? "{{organization.name}}" : "our organization";
  const mission = payload.useMergeFields !== false ? "{{organization.mission}}" : "this mission";
  const candidates = lower.endsWith("thank you") || /\bthank\s*you\s*(for)?$/i.test(context)
    ? [
        "for your generous support and faithful partnership.",
        `for helping ${organizationName} continue ${mission}.`,
        "for the care and commitment behind your giving.",
      ]
    : /\bgift|giving|generosity|donation\b/i.test(context)
      ? [
          `Your generosity helps ${organizationName} continue ${mission}.`,
          "Your support makes steady, practical ministry possible.",
          "This gift is a meaningful part of the work ahead.",
        ]
      : /\bimpact|because|helps?|serv(e|ing)|mission\b/i.test(context)
        ? [
            `Together, we can continue ${mission}.`,
            "Your partnership keeps this work moving forward with care.",
            "That impact is possible because friends like you choose to give.",
          ]
        : /\bgrateful|gratitude|appreciate\b/i.test(context)
          ? [
              "for the trust you place in this work.",
              "for the steady encouragement your support provides.",
              "for standing with this mission in such a practical way.",
            ]
          : [
              "Your partnership matters deeply to this work.",
              `Thank you for helping ${organizationName} continue ${mission}.`,
              "We are grateful for the generosity behind your support.",
            ];

  return candidates.find((candidate) => candidate.toLowerCase() !== previous) ?? candidates[0];
}

type PdfExportStatus = "SUCCESS" | "FAILED";

/** Reads persisted PDF export status from generated-letter metadata. */
function readPdfExportStatus(value: unknown): PdfExportStatus | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const asObject = value as Record<string, unknown>;
  const raw = asObject.pdfExport;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const status = (raw as Record<string, unknown>).lastStatus;
  return status === "SUCCESS" || status === "FAILED" ? status : null;
}

/** Writes PDF export metadata while preserving existing metadata payload fields. */
function buildMetadataWithPdfExport(
  existing: unknown,
  payload: {
    lastStatus: PdfExportStatus;
    lastError?: string | null;
    lastExportedAt?: string | null;
    updatedByUserId?: string | null;
  },
): Prisma.InputJsonValue {
  const base = existing && typeof existing === "object" && !Array.isArray(existing)
    ? { ...(existing as Record<string, unknown>) }
    : {};

  const previousPdfExport = base.pdfExport && typeof base.pdfExport === "object" && !Array.isArray(base.pdfExport)
    ? (base.pdfExport as Record<string, unknown>)
    : {};

  return JSON.parse(JSON.stringify({
    ...base,
    pdfExport: {
      ...previousPdfExport,
      ...payload,
    },
  })) as Prisma.InputJsonValue;
}

/** Converts merged HTML into plain text for deterministic server-side PDF rendering. */
export function htmlToPlainText(value: string): string {
  const listStack: Array<{ index: number; ordered: boolean }> = [];
  const withListMarkers = value.replace(/<\s*(\/?)\s*(ul|ol|li)\b([^>]*)>/gi, (_tag, closingToken: string, rawTag: string, attributes: string) => {
    const closing = closingToken === "/";
    const tag = rawTag.toLowerCase();
    if (tag === "ul" || tag === "ol") {
      if (closing) listStack.pop();
      else {
        const requestedStart = Number.parseInt(readHtmlAttribute(attributes, "start"), 10);
        listStack.push({ index: tag === "ol" && Number.isFinite(requestedStart) ? requestedStart : 1, ordered: tag === "ol" });
      }
      return "\n";
    }
    if (closing) return "\n";
    const list = listStack[listStack.length - 1] ?? { index: 1, ordered: false };
    const marker = list.ordered ? `${list.index}.` : "-";
    list.index += 1;
    return `\n${"  ".repeat(Math.max(0, listStack.length - 1))}${marker} `;
  });

  const withoutTags = withListMarkers
    .replace(/\r\n/g, "\n")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(p|div|h\d|li|tr|table|section|article|blockquote)\s*>/gi, "\n")
    .replace(/<\s*li\b[^>]*>/gi, "- ")
    .replace(/<\s*hr\b[^>]*>/gi, "\n----------------\n")
    .replace(/<[^>]+>/g, " ");

  const decoded = withoutTags
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, group) => {
      const codePoint = Number.parseInt(group, 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return "";
      return String.fromCodePoint(codePoint);
    })
    .replace(/&#x([a-f0-9]+);/gi, (_match, group) => {
      const codePoint = Number.parseInt(group, 16);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return "";
      return String.fromCodePoint(codePoint);
    });

  return decoded
    .replace(/[\t\f\v]+/g, " ")
    .replace(/(?<=\S)[ ]{2,}/g, " ")
    .replace(/\n{9,}/g, "\n\n\n\n\n\n\n\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_match, group) => {
      const codePoint = Number.parseInt(group, 10);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return "";
      return String.fromCodePoint(codePoint);
    })
    .replace(/&#x([a-f0-9]+);/gi, (_match, group) => {
      const codePoint = Number.parseInt(group, 16);
      if (!Number.isFinite(codePoint) || codePoint < 0 || codePoint > 0x10ffff) return "";
      return String.fromCodePoint(codePoint);
    });
}

function stripHtmlInline(value: string): string {
  return decodeHtmlEntities(value
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/ ?\n ?/g, "\n"))
    .replace(/\n{9,}/g, "\n\n\n\n\n\n\n\n")
    .trim();
}

type PdfContentBlock =
  | { kind: "heading"; text: string; level: number; lineHeight?: number; align?: PdfTextAlign; fontSize?: number; fontFamily?: PdfFontFamily }
  | { kind: "paragraph"; text: string; lineHeight?: number; align?: PdfTextAlign; fontSize?: number; fontFamily?: PdfFontFamily }
  | { kind: "quote"; text: string; lineHeight?: number; align?: PdfTextAlign; fontSize?: number; fontFamily?: PdfFontFamily }
  | { kind: "list"; text: string; ordered: boolean; index: number; depth: number; lineHeight?: number; align?: PdfTextAlign; fontSize?: number; fontFamily?: PdfFontFamily }
  | { kind: "tableRow"; cells: PdfTableCell[]; header: boolean }
  | { kind: "divider" }
  | { kind: "pageBreak" }
  | { kind: "spacer"; height: number; fill?: boolean }
  | {
      kind: "image";
      src: string;
      alt: string;
      widthPercent: number;
      dataUrl?: string;
      format?: "PNG" | "JPEG" | "WEBP";
      aspectRatio?: number;
    };

type PdfTextAlign = "left" | "center" | "right" | "justify";
type PdfFontFamily = "helvetica" | "times" | "courier";

/** Thrown when a letter needs an extra page but no author-requested page break exists. */
export class LetterPdfLayoutError extends Error {
  readonly code = "LETTER_ONE_PAGE_LIMIT_EXCEEDED";

  constructor() {
    super("This letter exceeds one page. Shorten the content, tighten its formatting, or insert a Page Break where the next page should begin.");
    this.name = "LetterPdfLayoutError";
  }
}

interface PdfTableCell {
  text: string;
  header: boolean;
  align: PdfTextAlign;
}

function readHtmlAttribute(attributes: string, name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = attributes.match(new RegExp(`${escapedName}\\s*=\\s*["']([^"']*)["']`, "i"));
  return match?.[1]?.trim() ?? "";
}

function parsePdfImageWidth(attributes: string): number {
  const marker = Number.parseFloat(readHtmlAttribute(attributes, "data-letter-width"));
  if (Number.isFinite(marker)) return Math.min(100, Math.max(10, marker));

  const percent = attributes.match(/(?:width|max-width)\s*:\s*([0-9]+(?:\.[0-9]+)?)%/i);
  if (percent) return Math.min(100, Math.max(10, Number.parseFloat(percent[1])));
  return 100;
}

function parsePdfImageBlock(attributes: string): PdfContentBlock | null {
  const src = readHtmlAttribute(attributes, "src");
  if (!src) return null;
  return {
    kind: "image",
    src,
    alt: readHtmlAttribute(attributes, "alt"),
    widthPercent: parsePdfImageWidth(attributes),
  };
}

function parsePdfLineHeight(attributes: string, innerHtml = ""): number | undefined {
  const match = `${attributes} ${innerHtml}`.match(/line-height\s*:\s*([0-9]+(?:\.[0-9]+)?)/i);
  if (!match) return undefined;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? Math.min(2.5, Math.max(1, value)) : undefined;
}

function parsePdfTextAlign(attributes: string, innerHtml = ""): PdfTextAlign | undefined {
  const explicit = readHtmlAttribute(attributes, "align").toLowerCase();
  if (explicit === "left" || explicit === "center" || explicit === "right" || explicit === "justify") return explicit;
  const match = `${attributes} ${innerHtml}`.match(/text-align\s*:\s*(left|center|right|justify)/i);
  const value = match?.[1]?.toLowerCase();
  return value === "left" || value === "center" || value === "right" || value === "justify" ? value : undefined;
}

function parsePdfSpacer(attributes: string, innerHtml: string): PdfContentBlock | null {
  const marker = attributes.match(/data-letter-spacer\s*=\s*["']([^"']+)["']/i)?.[1]?.trim().toLowerCase();
  if (marker === "fill") return { kind: "spacer", height: 0, fill: true };

  const markerHeight = marker ? Number.parseFloat(marker) : Number.NaN;
  const styleHeight = attributes.match(/(?:height|min-height)\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*(px|pt|in)?/i);
  const styleValue = styleHeight ? Number.parseFloat(styleHeight[1]) : Number.NaN;
  const styleUnit = styleHeight?.[2]?.toLowerCase();
  const stylePoints = Number.isFinite(styleValue)
    ? styleUnit === "in" ? styleValue * 72 : styleUnit === "px" ? styleValue * 0.75 : styleValue
    : Number.NaN;
  const explicitHeight = Number.isFinite(markerHeight) ? markerHeight : stylePoints;
  if (Number.isFinite(explicitHeight) && explicitHeight > 0) {
    return { kind: "spacer", height: Math.min(540, Math.max(8, explicitHeight)) };
  }

  const text = stripHtmlInline(innerHtml);
  if (text) return null;
  const breakCount = Array.from(innerHtml.matchAll(/<\s*br\s*\/?\s*>/gi)).length;
  return { kind: "spacer", height: Math.max(16, breakCount * 16) };
}

function plainTextToPdfBlocks(value: string): PdfContentBlock[] {
  const blocks: PdfContentBlock[] = [];
  const lines = value.replace(/\r\n/g, "\n").split("\n");
  let blankLines = 0;

  const flushBlankLines = () => {
    if (blankLines > 0) {
      blocks.push({ kind: "spacer", height: Math.min(540, blankLines * 16) });
      blankLines = 0;
    }
  };

  for (const line of lines) {
    const text = line.trim();
    if (!text) {
      blankLines += 1;
      continue;
    }
    flushBlankLines();
    if (/^[-=_]{5,}$/.test(text)) blocks.push({ kind: "divider" });
    else blocks.push({ kind: "paragraph", text });
  }
  flushBlankLines();
  return blocks;
}

type PdfListNode = {
  attributes: string;
  children: PdfListNode[];
  depth: number;
  htmlParts: string[];
  index: number;
  ordered: boolean;
};

/**
 * Flattens semantic HTML lists into ordered PDF item markers before the general
 * block parser runs. This keeps numbering and nested indentation without a DOM.
 */
function flattenHtmlListsForPdf(html: string): string {
  const parseListRegion = (region: string): string => {
    const rootNodes: PdfListNode[] = [];
    const listStack: Array<{ depth: number; nextIndex: number; nodes: PdfListNode[]; ordered: boolean }> = [];
    const itemStack: PdfListNode[] = [];
    const tokenPattern = /<\s*(\/?)\s*(ul|ol|li)\b([^>]*)>/gi;
    let cursor = 0;
    let token: RegExpExecArray | null = tokenPattern.exec(region);

    while (token) {
      const activeItem = itemStack[itemStack.length - 1];
      if (activeItem) activeItem.htmlParts.push(region.slice(cursor, token.index));

      const closing = token[1] === "/";
      const tag = token[2].toLowerCase();
      const attributes = token[3] ?? "";
      if (tag === "ul" || tag === "ol") {
        if (closing) {
          listStack.pop();
        } else {
          const parent = itemStack[itemStack.length - 1];
          const ordered = tag === "ol";
          const requestedStart = Number.parseInt(readHtmlAttribute(attributes, "start"), 10);
          listStack.push({
            depth: listStack.length,
            nextIndex: ordered && Number.isFinite(requestedStart) ? requestedStart : 1,
            nodes: parent ? parent.children : rootNodes,
            ordered,
          });
        }
      } else if (closing) {
        itemStack.pop();
      } else {
        const list = listStack[listStack.length - 1];
        if (list) {
          const node: PdfListNode = {
            attributes,
            children: [],
            depth: list.depth,
            htmlParts: [],
            index: list.nextIndex,
            ordered: list.ordered,
          };
          list.nextIndex += 1;
          list.nodes.push(node);
          itemStack.push(node);
        }
      }

      cursor = tokenPattern.lastIndex;
      token = tokenPattern.exec(region);
    }

    const activeItem = itemStack[itemStack.length - 1];
    if (activeItem) activeItem.htmlParts.push(region.slice(cursor));

    const serialize = (nodes: PdfListNode[]): string => nodes.map((node) => {
      const item = `<p${node.attributes} data-pdf-list-kind="${node.ordered ? "ordered" : "bullet"}" data-pdf-list-index="${node.index}" data-pdf-list-depth="${node.depth}">${node.htmlParts.join("")}</p>`;
      return `${item}${serialize(node.children)}`;
    }).join("");

    return serialize(rootNodes);
  };

  const listTagPattern = /<\s*(\/?)\s*(ul|ol)\b[^>]*>/gi;
  const regions: Array<{ start: number; end: number }> = [];
  let depth = 0;
  let regionStart = -1;
  let tag: RegExpExecArray | null = listTagPattern.exec(html);
  while (tag) {
    const closing = tag[1] === "/";
    if (!closing) {
      if (depth === 0) regionStart = tag.index;
      depth += 1;
    } else if (depth > 0) {
      depth -= 1;
      if (depth === 0 && regionStart >= 0) {
        regions.push({ start: regionStart, end: listTagPattern.lastIndex });
        regionStart = -1;
      }
    }
    tag = listTagPattern.exec(html);
  }

  if (regions.length === 0) return html;
  let output = "";
  let cursor = 0;
  regions.forEach((region) => {
    output += html.slice(cursor, region.start);
    output += parseListRegion(html.slice(region.start, region.end));
    cursor = region.end;
  });
  return output + html.slice(cursor);
}

function parsePdfFontSize(attributes: string, innerHtml = ""): number | undefined {
  const match = `${attributes} ${innerHtml}`.match(/font-size\s*:\s*([0-9]+(?:\.[0-9]+)?)\s*(pt|px)?/i);
  if (!match) return undefined;
  const rawValue = Number.parseFloat(match[1]);
  if (!Number.isFinite(rawValue)) return undefined;
  const points = match[2]?.toLowerCase() === "px" ? rawValue * 0.75 : rawValue;
  return Math.min(28, Math.max(8, points));
}

function parsePdfFontFamily(attributes: string, innerHtml = ""): PdfFontFamily | undefined {
  const match = `${attributes} ${innerHtml}`.match(/font-family\s*:\s*([^;"'>]+)/i);
  const value = match?.[1]?.replace(/["']/g, "").trim().toLowerCase() ?? "";
  if (!value) return undefined;
  if (value.includes("times") || value.includes("georgia") || value.includes("serif")) return "times";
  if (value.includes("courier") || value.includes("mono")) return "courier";
  return "helvetica";
}

function isPdfPageBreak(attributes: string): boolean {
  if (readHtmlAttribute(attributes, "data-letter-page-break").toLowerCase() === "true") return true;
  return /(?:page-break-after|break-after)\s*:\s*(?:always|page)/i.test(attributes);
}

/** Converts simple template HTML into PDF layout blocks while preserving common editor formatting. */
export function htmlToPdfBlocks(html: string): PdfContentBlock[] {
  const blocks: PdfContentBlock[] = [];
  const normalized = flattenHtmlListsForPdf(html)
    .replace(/\r\n/g, "\n")
    .replace(/<\s*\/\s*(div|section|article)\s*>/gi, "</p>")
    .replace(/<\s*(div|section|article)\b([^>]*)>/gi, "<p$2>");

  const pattern = /<\s*(h[1-3]|p|li|blockquote|tr)\b([^>]*)>([\s\S]*?)<\s*\/\s*\1\s*>|<\s*img\b([^>]*)>|<\s*hr\b[^>]*>/gi;
  let match: RegExpExecArray | null = pattern.exec(normalized);
  while (match) {
    const tag = (match[1] ?? (match[4] !== undefined ? "img" : "hr")).toLowerCase();
    const attributes = match[2] ?? match[4] ?? "";
    const inner = match[3] ?? "";
    if (tag === "hr") {
      blocks.push({ kind: "divider" });
    } else if (tag === "img") {
      const image = parsePdfImageBlock(attributes);
      if (image) blocks.push(image);
    } else if (tag === "tr") {
      const cells = Array.from(inner.matchAll(/<\s*(td|th)\b([^>]*)>([\s\S]*?)<\s*\/\s*\1\s*>/gi))
        .map((cell) => {
          const cellTag = (cell[1] ?? "td").toLowerCase();
          const cellAttributes = cell[2] ?? "";
          const cellInner = cell[3] ?? "";
          const text = stripHtmlInline(cellInner);
          return {
            text,
            header: cellTag === "th",
            align: parsePdfTextAlign(cellAttributes, cellInner) ?? parsePdfTextAlign(attributes, inner) ?? "left",
          } satisfies PdfTableCell;
        })
        .filter((cell) => cell.text);
      if (cells.length > 0) {
        blocks.push({ kind: "tableRow", cells, header: cells.some((cell) => cell.header) });
      }
    } else if (isPdfPageBreak(attributes)) {
      blocks.push({ kind: "pageBreak" });
    } else {
      const text = stripHtmlInline(inner);
      const lineHeight = parsePdfLineHeight(attributes, inner);
      const align = parsePdfTextAlign(attributes, inner);
      const fontSize = parsePdfFontSize(attributes, inner);
      const fontFamily = parsePdfFontFamily(attributes, inner);
      if (text) {
        if (/^[-=_]{5,}$/.test(text)) blocks.push({ kind: "divider" });
        else if (tag.startsWith("h")) blocks.push({ kind: "heading", text, level: Number.parseInt(tag.slice(1), 10) || 2, lineHeight, align, fontSize, fontFamily });
        else if (tag === "blockquote") blocks.push({ kind: "quote", text, lineHeight, align, fontSize, fontFamily });
        else if (readHtmlAttribute(attributes, "data-pdf-list-kind")) {
          blocks.push({
            kind: "list",
            text,
            ordered: readHtmlAttribute(attributes, "data-pdf-list-kind") === "ordered",
            index: Math.max(1, Number.parseInt(readHtmlAttribute(attributes, "data-pdf-list-index"), 10) || 1),
            depth: Math.max(0, Number.parseInt(readHtmlAttribute(attributes, "data-pdf-list-depth"), 10) || 0),
            lineHeight,
            align,
            fontSize,
            fontFamily,
          });
        } else if (tag === "li") {
          blocks.push({ kind: "list", text, ordered: false, index: 1, depth: 0, lineHeight, align, fontSize, fontFamily });
        }
        else blocks.push({ kind: "paragraph", text, lineHeight, align, fontSize, fontFamily });
      } else {
        const nestedImageAttributes = inner.match(/<\s*img\b([^>]*)>/i)?.[1];
        const nestedImage = nestedImageAttributes ? parsePdfImageBlock(nestedImageAttributes) : null;
        if (nestedImage) blocks.push(nestedImage);
        else {
          const spacer = parsePdfSpacer(attributes, inner);
          if (spacer) blocks.push(spacer);
        }
      }
    }
    match = pattern.exec(normalized);
  }

  if (blocks.length === 0) {
    const plain = htmlToPlainText(html);
    return plain ? plainTextToPdfBlocks(plain) : [];
  }

  return blocks;
}

async function hydratePdfImageBlocks(blocks: PdfContentBlock[]): Promise<PdfContentBlock[]> {
  return Promise.all(blocks.map(async (block) => {
    if (block.kind !== "image") return block;
    const image = await loadBrandingLogoDataUrl(block.src);
    return image ? { ...block, dataUrl: image.dataUrl, format: image.format } : block;
  }));
}

function readTextConfig(config: unknown, key: string): string {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "";
  const raw = (config as Record<string, unknown>)[key];
  return typeof raw === "string" ? raw.trim() : "";
}

function readFirstTextConfig(config: unknown, keys: string[]): string {
  for (const key of keys) {
    const value = readTextConfig(config, key);
    if (value) return value;
  }
  return "";
}

function buildAddressLineFromBranding(config: unknown): string {
  const city = readFirstTextConfig(config, ["city", "town"]);
  const state = readFirstTextConfig(config, ["stateProvince", "state", "province"]);
  const parts = [
    readFirstTextConfig(config, ["streetAddress1", "addressLine1", "address1"]),
    readFirstTextConfig(config, ["streetAddress2", "addressLine2", "address2"]),
    [city, state].filter(Boolean).join(", "),
    readFirstTextConfig(config, ["postalCode", "zip", "zipCode"]),
    readTextConfig(config, "country"),
  ].filter(Boolean);
  return parts.join(" | ");
}

function inferSupportedPdfLogoMime(filePath: string): "image/png" | "image/jpeg" | null {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".png") return "image/png";
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  return null;
}

function inferPdfLogoFormatFromDataUrl(value: string): "PNG" | "JPEG" | "WEBP" | null {
  if (value.startsWith("data:image/png")) return "PNG";
  if (value.startsWith("data:image/jpeg") || value.startsWith("data:image/jpg")) return "JPEG";
  if (value.startsWith("data:image/webp")) return "WEBP";
  return null;
}

function normalizePdfHexColor(value: string): [number, number, number] {
  const normalized = /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#0f766e";
  return [
    Number.parseInt(normalized.slice(1, 3), 16),
    Number.parseInt(normalized.slice(3, 5), 16),
    Number.parseInt(normalized.slice(5, 7), 16),
  ];
}

async function loadBrandingLogoDataUrl(rawLogoPath: string): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null> {
  let logoPath = rawLogoPath.trim().replace(/\\/g, "/");
  if (!logoPath) return null;
  if (!logoPath.startsWith("/") && /^https?:\/\//i.test(logoPath)) {
    try {
      const parsed = new URL(logoPath);
      logoPath = `${parsed.pathname || ""}${parsed.search || ""}`;
    } catch {
      return null;
    }
  }
  const logoWithoutQuery = logoPath.split("?")[0]?.split("#")[0] ?? logoPath;
  const inlineFormat = inferPdfLogoFormatFromDataUrl(logoPath);
  if (inlineFormat) return { dataUrl: logoPath, format: inlineFormat };
  if (!logoWithoutQuery.startsWith("/")) return null;

  const publicDir = path.resolve(process.cwd(), "public");
  const absolutePath = path.resolve(publicDir, `.${logoWithoutQuery}`);
  if (!absolutePath.startsWith(publicDir)) return null;

  const extension = path.extname(absolutePath).toLowerCase();
  const mimeType = extension === ".webp" ? "image/webp" : inferSupportedPdfLogoMime(absolutePath);
  if (!mimeType) return null;
  const format = mimeType === "image/jpeg" ? "JPEG" : mimeType === "image/webp" ? "WEBP" : "PNG";

  try {
    const bytes = await readFile(absolutePath);
    if (bytes.byteLength === 0) return null;
    return { dataUrl: `data:${mimeType};base64,${bytes.toString("base64")}`, format };
  } catch {
    return null;
  }
}

async function resolveBrandingLogoDataUrl(
  branding: unknown,
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" | "WEBP" } | null> {
  const candidates = [
    readFirstTextConfig(branding, ["logoUrl", "logo", "primaryLogoUrl", "brandLogoUrl"]),
    readFirstTextConfig(branding, ["logoSquareUrl", "squareLogoUrl", "secondaryLogoUrl"]),
  ].filter(Boolean);
  for (const candidate of candidates) {
    const logo = await loadBrandingLogoDataUrl(candidate);
    if (logo) return logo;
  }
  // Do not guess from the newest branding upload. It can be unrelated to the
  // configured identity and makes the recipient-facing PDF disagree with the UI.
  return null;
}

async function getLetterPdfBrandingContext(organizationId: string): Promise<LetterPdfBrandingContext> {
  const [organization, settings, brandingSetting] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.organizationSettings.findUnique({ where: { organizationId }, select: { smtpFromEmail: true, smtpFromName: true } }),
    prisma.pluginSetting.findUnique({
      where: { organizationId_pluginKey: { organizationId, pluginKey: "organization-branding" } },
      select: { config: true },
    }),
  ]);

  const branding = brandingSetting?.config;
  const organizationName =
    readFirstTextConfig(branding, ["organizationDisplayName", "legalOrganizationName", "organizationName"])
    || organization?.name
    || settings?.smtpFromName
    || "Organization";
  const contactLine = [
    readFirstTextConfig(branding, ["contactPhone", "phone"]),
    readFirstTextConfig(branding, ["contactEmail", "email"]) || settings?.smtpFromEmail || "",
    readFirstTextConfig(branding, ["websiteUrl", "website"]),
  ].filter(Boolean).join(" | ");
  const logo = await resolveBrandingLogoDataUrl(branding);

  return {
    organizationName,
    tagline: readTextConfig(branding, "tagline"),
    addressLine: buildAddressLineFromBranding(branding),
    contactLine,
    taxId: readFirstTextConfig(branding, ["taxId", "ein"]),
    footerLegalText: readTextConfig(branding, "footerLegalText"),
    globalHeaderHtml: readTextConfig(branding, "globalHeaderHtml"),
    globalFooterHtml: readTextConfig(branding, "globalFooterHtml"),
    logoDataUrl: logo?.dataUrl ?? null,
    logoFormat: logo?.format ?? null,
    primaryColor: readFirstTextConfig(branding, ["primaryColor", "accentColor"]) || "#0f766e",
  };
}

/** Sanitizes a value for safe ASCII PDF filename usage. */
function sanitizePdfFilename(value: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9_-]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "generated_letter";
}

/** Keeps internal template labels out of the recipient-facing correspondence. */
export function recipientFacingLetterSubject(value: string | null | undefined): string {
  const subject = value?.trim() ?? "";
  return subject.toLowerCase() === "printable letter" ? "" : subject;
}

function headerLines(branding: LetterPdfBrandingContext, preset?: LetterPdfPresetContext["headerPreset"]): string[] {
  const customHeader = preset?.customHtml?.trim() || branding.globalHeaderHtml?.trim() || "";
  if (customHeader) return [stripHtmlInline(customHeader)].filter(Boolean);
  return [
    (preset?.showOrganizationName ?? true) ? branding.organizationName : "",
    (preset?.showTagline ?? false) ? branding.tagline : "",
    (preset?.showAddress ?? true) ? branding.addressLine : "",
    (preset?.showPhone ?? true) || (preset?.showWebsite ?? true) ? branding.contactLine : "",
  ].filter(Boolean);
}

function footerLines(branding: LetterPdfBrandingContext, preset?: LetterPdfPresetContext["footerPreset"]): string[] {
  const customFooter = preset?.customHtml?.trim() || branding.globalFooterHtml?.trim() || "";
  if (customFooter) return [stripHtmlInline(customFooter)].filter(Boolean);
  return [
    preset?.customText ?? "",
    branding.footerLegalText,
    (preset?.showOrganizationName ?? true) ? branding.organizationName : "",
    (preset?.showAddress ?? true) ? branding.addressLine : "",
    [
      (preset?.showPhone ?? true) ? branding.contactLine.split(" | ")[0] ?? "" : "",
      (preset?.showEmail ?? true) ? branding.contactLine.split(" | ")[1] ?? "" : "",
      (preset?.showWebsite ?? true) ? branding.contactLine.split(" | ")[2] ?? "" : "",
    ].filter(Boolean).join(" | "),
    (preset?.showTaxId ?? false) && branding.taxId ? `Tax ID: ${branding.taxId}` : "",
  ].filter(Boolean);
}

async function getDefaultLetterPdfPresets(organizationId: string): Promise<LetterPdfPresetContext> {
  const [headerPreset, footerPreset, signatureBlock] = await Promise.all([
    prisma.letterHeaderPreset.findFirst({ where: { organizationId, isDefault: true, isActive: true } }),
    prisma.letterFooterPreset.findFirst({ where: { organizationId, isDefault: true, isActive: true } }),
    prisma.letterSignatureBlock.findFirst({ where: { organizationId, isDefault: true, isActive: true } }),
  ]);
  return { headerPreset, footerPreset, signatureBlock };
}

function buildRecipientCityStateZip(recipient?: LetterPdfRecipientContext | null): string {
  if (!recipient) return "";
  const city = recipient.city.trim();
  const state = recipient.state.trim();
  const zip = recipient.zip.trim();
  const cityState = [city, state].filter(Boolean).join(", ");
  return [cityState, zip].filter(Boolean).join(" ").trim();
}

function buildRecipientAddressLines(recipient?: LetterPdfRecipientContext | null): string[] {
  if (!recipient) return [];
  const lines = [
    recipient.fullName.trim(),
    recipient.addressLine1.trim(),
    recipient.addressLine2.trim(),
    buildRecipientCityStateZip(recipient),
  ].filter((value) => value.length > 0);
  return lines;
}

function normalizeAddressCompare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function stripLeadingRecipientAddressBlocks(blocks: PdfContentBlock[], recipient?: LetterPdfRecipientContext | null): PdfContentBlock[] {
  const recipientLines = buildRecipientAddressLines(recipient);
  if (recipientLines.length === 0 || blocks.length === 0) return blocks;

  const normalizedRecipientLines = recipientLines
    .map((line) => normalizeAddressCompare(line))
    .filter((line) => line.length > 0);
  if (normalizedRecipientLines.length === 0) return blocks;
  const recipientLineSet = new Set(normalizedRecipientLines);

  const matchesRecipientLine = (line: string): boolean => {
    const segments = line
      .split(/\n+/g)
      .map((segment) => normalizeAddressCompare(segment))
      .filter((segment) => segment.length > 0);

    if (segments.length === 0) return false;
    return segments.every((segment) => recipientLineSet.has(segment));
  };

  let index = 0;
  let matched = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    if (block.kind !== "paragraph") break;
    if (!matchesRecipientLine(block.text)) {
      if (matched > 0) break;
      return blocks;
    }
    matched += 1;
    index += 1;
  }

  if (matched === 0) return blocks;
  return blocks.slice(index);
}

function drawPdfChrome(
  doc: JsPdfDocument,
  branding: LetterPdfBrandingContext,
  presets: LetterPdfPresetContext,
  recipient?: LetterPdfRecipientContext | null,
  pageRange?: { startPage?: number; endPage?: number },
  documentMeta?: { subject?: string; generatedAt?: Date },
): void {
  const pageCount = doc.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 54;
  const footerY = pageHeight - 54;
  const fallbackLogoWidth = 48;
  const fallbackLogoHeight = 48;
  const logoMaxWidth = 160;
  const logoMaxHeight = 48;
  const normalizedLogoAlignment = String(presets.headerPreset?.logoAlignment ?? "LEFT").toUpperCase();
  const logoAlignment = normalizedLogoAlignment === "CENTER" || normalizedLogoAlignment === "RIGHT" || normalizedLogoAlignment === "NONE"
    ? normalizedLogoAlignment
    : "LEFT";
  const showLogoSlot = logoAlignment !== "NONE";
  const hasLogo = showLogoSlot && Boolean(branding.logoDataUrl);
  const hasFallbackLogo = showLogoSlot && !hasLogo;
  let renderedLogoWidth = fallbackLogoWidth;
  let renderedLogoHeight = fallbackLogoHeight;

  if (hasLogo && branding.logoDataUrl) {
    try {
      const properties = doc.getImageProperties(branding.logoDataUrl) as { width?: number; height?: number };
      const sourceWidth = Number(properties?.width ?? 0);
      const sourceHeight = Number(properties?.height ?? 0);
      if (sourceWidth > 0 && sourceHeight > 0) {
        const scale = Math.min(logoMaxWidth / sourceWidth, logoMaxHeight / sourceHeight);
        renderedLogoWidth = Math.max(12, sourceWidth * scale);
        renderedLogoHeight = Math.max(12, sourceHeight * scale);
      }
    } catch {
      renderedLogoWidth = fallbackLogoWidth;
      renderedLogoHeight = fallbackLogoHeight;
    }
  }

  const activeLogoWidth = hasFallbackLogo ? fallbackLogoWidth : renderedLogoWidth;
  const activeLogoHeight = hasFallbackLogo ? fallbackLogoHeight : renderedLogoHeight;
  const logoX = logoAlignment === "CENTER" ? (pageWidth - activeLogoWidth) / 2 : logoAlignment === "RIGHT" ? pageWidth - marginX - activeLogoWidth : marginX;
  const logoY = 24 + Math.max(0, (logoMaxHeight - activeLogoHeight) / 2);
  const header = headerLines(branding, presets.headerPreset);
  const recipientAddressLines = buildRecipientAddressLines(recipient);
  const footer = footerLines(branding, presets.footerPreset);
  const logoFormat = branding.logoFormat ?? "PNG";
  const [brandR, brandG, brandB] = normalizePdfHexColor(branding.primaryColor);
  const firstPage = Math.max(1, pageRange?.startPage ?? 1);
  const lastPage = Math.min(pageCount, pageRange?.endPage ?? pageCount);

  for (let page = firstPage; page <= lastPage; page += 1) {
    doc.setPage(page);
    doc.setDrawColor(226, 232, 240);
    doc.setTextColor(15, 23, 42);

    if (hasLogo && branding.logoDataUrl) {
      try {
        doc.addImage(branding.logoDataUrl, logoFormat, logoX, logoY, renderedLogoWidth, renderedLogoHeight);
      } catch {
        // Keep PDF generation resilient if logo decoding fails.
      }
    }
    if (hasFallbackLogo) {
      doc.setFillColor(brandR, brandG, brandB);
      doc.roundedRect(logoX, logoY, fallbackLogoWidth, fallbackLogoHeight, 8, 8, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text((branding.organizationName.trim()[0] || "O").toUpperCase(), logoX + fallbackLogoWidth / 2, logoY + 31, { align: "center" });
      doc.setTextColor(15, 23, 42);
    }

    if (header.length > 0 || hasLogo || hasFallbackLogo) {
      const headerTextX = logoAlignment === "LEFT" && (hasLogo || hasFallbackLogo)
        ? logoX + activeLogoWidth + 12
        : logoAlignment === "CENTER"
          ? pageWidth / 2
          : logoAlignment === "RIGHT"
            ? pageWidth - marginX
            : marginX;
      const headerTextAlign = logoAlignment === "CENTER" ? "center" : logoAlignment === "RIGHT" ? "right" : "left";
      const headerTextY = hasLogo || hasFallbackLogo ? logoY + activeLogoHeight / 2 + 5 : 48;
      const detailColumnWidth = 248;
      const titleMaxWidth = logoAlignment === "LEFT"
        ? Math.max(96, pageWidth - marginX - headerTextX - detailColumnWidth - 18)
        : Math.max(160, pageWidth - marginX * 2);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(15, 23, 42);
      // A wide wordmark already includes the organization name. Rendering the text
      // again beside it causes the collision visible in exported PDFs.
      const logoIncludesOrganizationName = hasLogo && renderedLogoWidth >= 104;
      if (header[0] && !logoIncludesOrganizationName) {
        const titleLines = doc.splitTextToSize(header[0], titleMaxWidth) as string[];
        const titleLineHeight = 14;
        const titleStartY = headerTextY - ((Math.max(1, titleLines.length) - 1) * titleLineHeight) / 2;
        titleLines.slice(0, 2).forEach((line, index) => {
          doc.text(line, headerTextX, titleStartY + index * titleLineHeight, { align: headerTextAlign });
        });
      }
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(15, 23, 42);
      const detailX = logoAlignment === "LEFT" ? pageWidth - marginX : headerTextX;
      const detailAlign = logoAlignment === "LEFT" ? "right" : headerTextAlign;
      const detailLines = header.slice(1, 4).flatMap((line) => doc.splitTextToSize(line, detailColumnWidth) as string[]);
      detailLines.slice(0, 4).forEach((line, index) => {
        doc.text(line, detailX, 42 + index * 10, { align: detailAlign });
      });
      doc.setDrawColor(brandR, brandG, brandB);
      doc.line(marginX, 104, pageWidth - marginX, 104);
    }

    if (recipientAddressLines.length > 0 && page === firstPage) {
      const maxLines = 5;
      const addressLines = recipientAddressLines.slice(0, maxLines);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      addressLines.forEach((line, index) => {
        doc.text(line, marginX, 136 + index * 13);
      });
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const renderedDate = documentMeta?.generatedAt
        ? new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" }).format(documentMeta.generatedAt)
        : "";
      if (renderedDate) doc.text(renderedDate, pageWidth - marginX, 136, { align: "right" });
      const subject = recipientFacingLetterSubject(documentMeta?.subject);
      if (subject) {
        const subjectY = 136 + addressLines.length * 13 + 22;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(brandR, brandG, brandB);
        doc.text("RE:", marginX, subjectY);
        const subjectOffset = doc.getTextWidth("RE: ");
        doc.setTextColor(15, 23, 42);
        doc.text(subject, marginX + subjectOffset, subjectY);
      }
    }

    doc.setDrawColor(226, 232, 240);
    doc.line(marginX, footerY - 16, pageWidth - marginX, footerY - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    footer.slice(0, 4).forEach((line, index) => {
      doc.setTextColor(71, 85, 105);
      doc.text(line, pageWidth / 2, footerY + index * 10, { align: "center" });
    });
  }
}

function appendSignatureBlocks(blocks: PdfContentBlock[], signature?: LetterPdfPresetContext["signatureBlock"]): PdfContentBlock[] {
  if (!signature) return blocks;
  const next = [...blocks];
  if (next.length > 0) next.push({ kind: "spacer", height: 10 });
  if (signature.closingPhrase) next.push({ kind: "paragraph", text: signature.closingPhrase });
  if (signature.signatureImageUrl) {
    next.push({ kind: "image", src: signature.signatureImageUrl, alt: `${signature.signerName} signature`, widthPercent: 34 });
  } else {
    next.push({ kind: "paragraph", text: signature.typedSignature || signature.signerName });
  }
  if (signature.signerName && signature.typedSignature && signature.typedSignature !== signature.signerName) {
    next.push({ kind: "paragraph", text: signature.signerName });
  } else if (signature.signatureImageUrl && signature.signerName) {
    next.push({ kind: "paragraph", text: signature.signerName });
  }
  if (signature.signerTitle) next.push({ kind: "paragraph", text: signature.signerTitle });
  const contact = [signature.email, signature.phone].filter(Boolean).join(" | ");
  if (contact) next.push({ kind: "paragraph", text: contact });
  return next;
}

function normalizeSignatureCompare(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9@.+]+/g, " ").trim();
}

function pdfBodyAlreadyHasSignature(html: string, signature?: LetterPdfPresetContext["signatureBlock"]): boolean {
  if (!signature) return false;
  if (signature.signatureImageUrl && html.includes(signature.signatureImageUrl)) return true;

  const tailLines = htmlToPlainText(html)
    .split(/\n+/g)
    .map((line) => normalizeSignatureCompare(line))
    .filter(Boolean)
    .slice(-8);
  if (tailLines.length === 0) return false;

  const signerCandidates = [signature.signerName, signature.typedSignature]
    .map((value) => normalizeSignatureCompare(String(value ?? "")))
    .filter(Boolean);
  const supportingCandidates = [
    signature.closingPhrase,
    signature.signerTitle,
    signature.email,
    signature.phone,
  ].map((value) => normalizeSignatureCompare(String(value ?? ""))).filter(Boolean);

  const hasSignerLine = tailLines.some((line) => signerCandidates.some((candidate) => line === candidate || line.includes(candidate)));
  if (!hasSignerLine) return false;
  if (supportingCandidates.length === 0) return tailLines[tailLines.length - 1] === signerCandidates[0];
  return tailLines.some((line) => supportingCandidates.some((candidate) => line === candidate || line.includes(candidate)));
}

export async function buildLetterPdfBodyBlocks(
  mergedPrintBody: string,
  signature?: LetterPdfPresetContext["signatureBlock"],
  recipient?: LetterPdfRecipientContext | null,
): Promise<PdfContentBlock[]> {
  const bodyBlocks = stripLeadingRecipientAddressBlocks(htmlToPdfBlocks(mergedPrintBody || ""), recipient);
  const signedBlocks = pdfBodyAlreadyHasSignature(mergedPrintBody || "", signature)
    ? bodyBlocks
    : appendSignatureBlocks(bodyBlocks, signature);
  return hydratePdfImageBlocks(signedBlocks);
}

function renderPdfContentBlocks(doc: JsPdfDocument, blocks: PdfContentBlock[], options: { startY: number; continuationStartY?: number; requireExplicitPageBreaks?: boolean }): void {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 54;
  const marginBottom = 96;
  const contentTop = options.startY;
  const maxTextWidth = pageWidth - marginX * 2;
  let cursorY = contentTop;

  const ensurePageSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= pageHeight - marginBottom) return;
    if (options.requireExplicitPageBreaks) throw new LetterPdfLayoutError();
    doc.addPage();
    cursorY = options.continuationStartY ?? contentTop;
  };

  type PdfTextOptions = { align?: PdfTextAlign; maxWidth?: number };
  const drawText = (text: string | string[], x: number, y: number, options?: PdfTextOptions) => {
    if (!options) {
      doc.text(text, x, y);
      return;
    }
    // Keep jsPDF method context bound to the document instance.
    const textWithOptions = doc.text as unknown as (value: string | string[], textX: number, textY: number, textOptions: PdfTextOptions) => JsPdfDocument;
    textWithOptions.call(doc, text, x, y, options);
  };

  const textHeight = (text: string, fontSize: number, lineHeightMultiplier = 1.38, indent = 0, widthOverride?: number) => {
    const trimmed = text.trim();
    if (!trimmed) return 0;
    doc.setFontSize(fontSize);
    const width = widthOverride ?? (maxTextWidth - indent);
    const lines = doc.splitTextToSize(trimmed, width) as string[];
    const lineHeight = Math.max(fontSize, Math.round(fontSize * lineHeightMultiplier));
    return Math.max(1, lines.length) * lineHeight;
  };

  const tableRowHeight = (block: Extract<PdfContentBlock, { kind: "tableRow" }>) => {
    const cellWidth = maxTextWidth / Math.max(block.cells.length, 1);
    const lineCounts = block.cells.map((cell) => {
      doc.setFontSize(9);
      return (doc.splitTextToSize(cell.text, Math.max(12, cellWidth - 10)) as string[]).length;
    });
    return Math.max(24, Math.max(1, ...lineCounts) * 11 + 14);
  };

  const estimatedBlockHeight = (block: PdfContentBlock): number => {
    if (block.kind === "heading") {
      const size = block.fontSize ?? (block.level === 1 ? 18 : block.level === 2 ? 15 : 13);
      return textHeight(block.text, size, block.lineHeight) + 10;
    }
    if (block.kind === "quote") return textHeight(block.text, block.fontSize ?? 10.5, block.lineHeight, 18) + 10;
    if (block.kind === "list") {
      const listIndent = 28 + block.depth * 16;
      return textHeight(block.text, block.fontSize ?? 10.5, block.lineHeight, listIndent) + 6;
    }
    if (block.kind === "divider") return 18;
    if (block.kind === "pageBreak") return 0;
    if (block.kind === "spacer") return block.fill ? 0 : block.height;
    if (block.kind === "image") {
      const width = maxTextWidth * (block.widthPercent / 100);
      if (block.dataUrl) {
        try {
          const properties = doc.getImageProperties(block.dataUrl) as { width?: number; height?: number };
          const sourceWidth = Number(properties.width ?? 0);
          const sourceHeight = Number(properties.height ?? 0);
          if (sourceWidth > 0 && sourceHeight > 0) return width * (sourceHeight / sourceWidth) + 8;
        } catch {
          // Fall through to the conservative image-height estimate.
        }
      }
      return block.aspectRatio ? width / block.aspectRatio + 8 : width * 0.35 + 8;
    }
    if (block.kind === "tableRow") return tableRowHeight(block);
    return textHeight(block.text, 11, block.lineHeight) + 8;
  };

  const writeText = (
    text: string,
    fontSize: number,
    fontStyle: "normal" | "bold" | "italic" = "normal",
    marginAfter = 8,
    indent = 0,
    lineHeightMultiplier = 1.38,
    align: PdfTextAlign = "left",
    fontFamily: PdfFontFamily = "helvetica",
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    doc.setFont(fontFamily, fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(15, 23, 42);
    const width = maxTextWidth - indent;
    const lines = doc.splitTextToSize(trimmed, width) as string[];
    const lineHeight = Math.max(fontSize, Math.round(fontSize * lineHeightMultiplier));
    for (const line of lines) {
      ensurePageSpace(lineHeight);
      const x = align === "center"
        ? marginX + indent + width / 2
        : align === "right"
          ? marginX + indent + width
          : marginX + indent;
      const options = align === "left"
        ? undefined
        : { align, maxWidth: width };
      drawText(line, x, cursorY, options);
      cursorY += lineHeight;
    }
    cursorY += marginAfter;
  };

  const writeQuote = (block: Extract<PdfContentBlock, { kind: "quote" }>) => {
    const fontSize = block.fontSize ?? 10.5;
    const estimatedHeight = Math.max(18, textHeight(block.text, fontSize, block.lineHeight, 18));
    ensurePageSpace(estimatedHeight + 8);
    const quoteTop = cursorY - 9;
    writeText(block.text, fontSize, "italic", 8, 18, block.lineHeight, block.align, block.fontFamily);
    doc.setDrawColor(148, 163, 184);
    doc.setLineWidth(1.5);
    doc.line(marginX + 4, quoteTop, marginX + 4, Math.max(quoteTop + 14, cursorY - 8));
    doc.setLineWidth(0.2);
  };

  const writeListItem = (block: Extract<PdfContentBlock, { kind: "list" }>) => {
    const trimmed = block.text.trim();
    if (!trimmed) return;
    const fontSize = block.fontSize ?? 10.5;
    const marker = block.ordered ? `${block.index}.` : "•";
    const markerIndent = 10 + block.depth * 16;
    const contentIndent = markerIndent + 18;
    const width = maxTextWidth - contentIndent;
    const lineHeight = Math.max(fontSize, Math.round(fontSize * (block.lineHeight ?? 1.38)));

    doc.setFont(block.fontFamily ?? "helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(trimmed, width) as string[];
    lines.forEach((line, lineIndex) => {
      ensurePageSpace(lineHeight);
      if (lineIndex === 0) {
        drawText(marker, marginX + markerIndent, cursorY);
      }
      const x = block.align === "center"
        ? marginX + contentIndent + width / 2
        : block.align === "right"
          ? marginX + contentIndent + width
          : marginX + contentIndent;
      const options = block.align && block.align !== "left"
        ? { align: block.align, maxWidth: width }
        : undefined;
      drawText(line, x, cursorY, options);
      cursorY += lineHeight;
    });
    cursorY += 6;
  };

  const renderedBlocks = blocks.length > 0 ? blocks : [{ kind: "paragraph", text: "(No letter content)" } as PdfContentBlock];
  renderedBlocks.forEach((block, index) => {
    if (block.kind === "pageBreak") {
      if (index < renderedBlocks.length - 1) {
        doc.addPage();
        cursorY = options.continuationStartY ?? contentTop;
      }
    } else if (block.kind === "heading") {
      const size = block.fontSize ?? (block.level === 1 ? 18 : block.level === 2 ? 15 : 13);
      writeText(block.text, size, "bold", 10, 0, block.lineHeight, block.align, block.fontFamily);
    } else if (block.kind === "quote") {
      writeQuote(block);
    } else if (block.kind === "list") {
      writeListItem(block);
    } else if (block.kind === "divider") {
      ensurePageSpace(18);
      doc.setDrawColor(203, 213, 225);
      doc.line(marginX, cursorY, pageWidth - marginX, cursorY);
      cursorY += 18;
    } else if (block.kind === "spacer") {
      if (block.fill) {
        const remainingHeight = renderedBlocks.slice(index + 1).reduce((total, nextBlock) => total + estimatedBlockHeight(nextBlock), 0);
        const bottomAlignedY = pageHeight - marginBottom - remainingHeight;
        if (bottomAlignedY > cursorY) cursorY = bottomAlignedY;
      } else {
        ensurePageSpace(block.height);
        cursorY += block.height;
      }
    } else if (block.kind === "image") {
      if (!block.dataUrl || !block.format) return;
      const properties = doc.getImageProperties(block.dataUrl) as { width?: number; height?: number };
      const sourceWidth = Number(properties.width ?? 0);
      const sourceHeight = Number(properties.height ?? 0);
      if (sourceWidth <= 0 || sourceHeight <= 0) return;
      const imageWidth = maxTextWidth * (block.widthPercent / 100);
      const imageHeight = imageWidth * (sourceHeight / sourceWidth);
      ensurePageSpace(imageHeight + 8);
      doc.addImage(block.dataUrl, block.format, marginX, cursorY, imageWidth, imageHeight);
      cursorY += imageHeight + 8;
    } else if (block.kind === "tableRow") {
      const rowHeight = tableRowHeight(block);
      ensurePageSpace(rowHeight);
      const cellWidth = maxTextWidth / Math.max(block.cells.length, 1);
      doc.setFontSize(9);
      doc.setDrawColor(203, 213, 225);
      block.cells.forEach((cell, index) => {
        const x = marginX + index * cellWidth;
        if (block.header || cell.header) {
          doc.setFillColor(248, 250, 252);
          doc.rect(x, cursorY - 12, cellWidth, rowHeight, "FD");
        } else {
          doc.rect(x, cursorY - 12, cellWidth, rowHeight);
        }
        doc.setFont("helvetica", cell.header ? "bold" : "normal");
        doc.setTextColor(15, 23, 42);
        const lines = doc.splitTextToSize(cell.text, Math.max(12, cellWidth - 10)) as string[];
        const textX = cell.align === "center"
          ? x + cellWidth / 2
          : cell.align === "right"
            ? x + cellWidth - 5
            : x + 5;
        const options = cell.align === "left"
          ? undefined
          : { align: cell.align, maxWidth: cellWidth - 10 };
        lines.slice(0, Math.max(1, Math.floor((rowHeight - 10) / 11))).forEach((line, lineIndex) => {
          drawText(line, textX, cursorY + 2 + lineIndex * 11, options);
        });
      });
      cursorY += rowHeight;
    } else {
      writeText(block.text, block.fontSize ?? 11, "normal", 8, 0, block.lineHeight, block.align, block.fontFamily);
    }
  });
}

/** Renders one generated letter into PDF bytes using jsPDF server-side. */
export async function renderGeneratedLetterPdf(params: {
  templateName: string;
  subject: string;
  constituentName: string;
  recipient?: LetterPdfRecipientContext | null;
  generatedAt: Date;
  mergedPrintBody: string;
  branding: LetterPdfBrandingContext;
  presets: LetterPdfPresetContext;
}): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });

  const blocks = await buildLetterPdfBodyBlocks(params.mergedPrintBody, params.presets.signatureBlock, params.recipient);
  renderPdfContentBlocks(doc, blocks, {
    startY: 230,
    continuationStartY: 132,
    requireExplicitPageBreaks: true,
  });
  drawPdfChrome(doc, params.branding, params.presets, params.recipient, undefined, {
    subject: params.subject,
    generatedAt: params.generatedAt,
  });

  const pdfBytes = doc.output("arraybuffer");
  return Buffer.from(pdfBytes);
}

function formatPdfDonationDate(date: Date, style: "long" | "short" | "numeric", timeZone?: string): string {
  const options: Intl.DateTimeFormatOptions = style === "numeric"
    ? { month: "2-digit", day: "2-digit", year: "numeric" }
    : { month: style, day: "numeric", year: "numeric" };
  return new Intl.DateTimeFormat("en-US", {
    ...options,
    ...(timeZone ? { timeZone } : {}),
  }).format(date);
}

/** Normalizes already-merged donation date text before server PDF export. */
export function normalizeMergedDonationDateTextForPdfExport(mergedPrintBody: string, donationDate?: Date | null): string {
  if (!donationDate || !mergedPrintBody) return mergedPrintBody;

  const correctLabels = {
    long: formatPdfDonationDate(donationDate, "long", "UTC"),
    short: formatPdfDonationDate(donationDate, "short", "UTC"),
    numeric: formatPdfDonationDate(donationDate, "numeric", "UTC"),
  };
  const previousUtcDate = new Date(donationDate.getTime() - 24 * 60 * 60 * 1000);
  const staleCandidates = [
    [formatPdfDonationDate(donationDate, "long"), correctLabels.long],
    [formatPdfDonationDate(donationDate, "short"), correctLabels.short],
    [formatPdfDonationDate(donationDate, "numeric"), correctLabels.numeric],
    [formatPdfDonationDate(previousUtcDate, "long", "UTC"), correctLabels.long],
    [formatPdfDonationDate(previousUtcDate, "short", "UTC"), correctLabels.short],
    [formatPdfDonationDate(previousUtcDate, "numeric", "UTC"), correctLabels.numeric],
  ];

  let output = mergedPrintBody;
  for (const [staleLabel, correctLabel] of staleCandidates) {
    if (staleLabel && staleLabel !== correctLabel) {
      output = output.split(staleLabel).join(correctLabel);
    }
  }
  return output;
}

/** Renders many generated letters into one multi-page PDF for batch print/export workflows. */
async function renderGeneratedLettersBatchPdf(items: Array<{
  templateName: string;
  subject: string;
  constituentName: string;
  recipient?: LetterPdfRecipientContext | null;
  generatedAt: Date;
  mergedPrintBody: string;
  branding: LetterPdfBrandingContext;
  presets: LetterPdfPresetContext;
}>): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });

  for (const [index, item] of items.entries()) {
    if (index > 0) {
      doc.addPage();
    }
    const startPage = doc.getNumberOfPages();
    const blocks = await buildLetterPdfBodyBlocks(item.mergedPrintBody, item.presets.signatureBlock, item.recipient);
    renderPdfContentBlocks(doc, blocks, {
      startY: 230,
      continuationStartY: 132,
      requireExplicitPageBreaks: true,
    });
    const endPage = doc.getNumberOfPages();
    drawPdfChrome(doc, item.branding, item.presets, item.recipient, {
      startPage,
      endPage,
    }, {
      subject: item.subject,
      generatedAt: item.generatedAt,
    });
  }

  const pdfBytes = doc.output("arraybuffer");
  return Buffer.from(pdfBytes);
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
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 7);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const queueRows = await prisma.generatedLetter.findMany({
    where: { organizationId },
    select: {
      status: true,
      metadataJson: true,
      printedAt: true,
      mailedAt: true,
      emailDraftCreatedAt: true,
    },
    take: 4000,
  });

  const queueStats = queueRows.reduce((acc, row) => {
    const queue = readQueueMetadata(row.metadataJson);
    const printStatus = derivePrintQueueStatus(row.status, queue);
    const mailStatus = deriveMailQueueStatus(row.status, queue);
    const pdfExportStatus = readPdfExportStatus(row.metadataJson);

    if (printStatus === "NEEDS_REVIEW" || row.status === "GENERATED") acc.needsReview += 1;
    if (printStatus === "QUEUED_FOR_PRINT") acc.queuedForPrint += 1;
    if (row.printedAt && row.printedAt >= todayStart) acc.printedToday += 1;
    if (mailStatus === "QUEUED_FOR_MAIL" || row.status === "PRINTED") acc.queuedForMail += 1;
    if (row.mailedAt && row.mailedAt >= weekStart) acc.mailedThisWeek += 1;
    if (mailStatus === "ADDRESS_ISSUE") acc.addressIssues += 1;
    if (pdfExportStatus === "FAILED") acc.pdfExportFailures += 1;
    if (row.emailDraftCreatedAt) acc.emailDraftsCreated += 1;

    return acc;
  }, {
    needsReview: 0,
    queuedForPrint: 0,
    printedToday: 0,
    queuedForMail: 0,
    mailedThisWeek: 0,
    addressIssues: 0,
    pdfExportFailures: 0,
    emailDraftsCreated: 0,
  });

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
    needsReview: queueStats.needsReview,
    queuedForPrint: queueStats.queuedForPrint,
    printedToday: queueStats.printedToday,
    queuedForMail: queueStats.queuedForMail,
    mailedThisWeek: queueStats.mailedThisWeek,
    addressIssues: queueStats.addressIssues,
    pdfExportFailures: queueStats.pdfExportFailures,
    emailDraftsCreated: queueStats.emailDraftsCreated,
    recentlyUsedTemplates: recentlyUsed,
    batchGenerationStatus: "WORKING",
    pdfExportStatus: "WORKING",
  });
});

/** GET /api/letters/workflow-settings — Returns persisted letters workflow policy controls. */
router.get("/workflow-settings", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: LETTER_WORKFLOW_POLICY_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  res.json(normalizeLettersWorkflowPolicy(setting?.config));
});

/** PUT /api/letters/workflow-settings — Persists queue and workflow policy controls. */
router.put("/workflow-settings", requirePermission("letters.manage_branding"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const normalized = normalizeLettersWorkflowPolicy(req.body);

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: LETTER_WORKFLOW_POLICY_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: LETTER_WORKFLOW_POLICY_PLUGIN_KEY,
      enabled: true,
      config: normalized as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: true,
      config: normalized as unknown as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    action: "LETTERS_WORKFLOW_SETTINGS_UPDATED",
    entity: "PluginSetting",
    entityId: organizationId,
    organizationId,
    userId,
    metadata: normalized as unknown as Record<string, unknown>,
  });

  res.json(normalized);
});

/** GET /api/letters/merge-fields — Returns merge field catalog and sensitivity flags. */
router.get("/merge-fields", requirePermission("letters.view"), async (req, res) => {
  const canViewSensitive = await hasPermission(req, "letters.view_sensitive_merge_data");
  const sections = [
    {
      key: "simple",
      label: "Simple Fields",
      sensitive: false,
      fields: SIMPLE_LETTER_MERGE_FIELDS,
    },
    {
      key: "compatibility",
      label: "Compatibility Fields",
      sensitive: false,
      fields: COMPATIBILITY_LETTER_MERGE_FIELDS,
    },
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

/** POST /api/letters/merge-fields/line-preview - Renders one editor line for up to five real recipients. */
router.post("/merge-fields/line-preview", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const body = req.body && typeof req.body === "object" && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  const line = asShortString(body.line, "", 2000).trim();
  const limit = parsePositiveInt(body.limit, 5, 1, 5);
  if (!line) {
    res.json({ items: [] });
    return;
  }

  const rows = await prisma.constituent.findMany({
    where: { organizationId },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      organizationName: true,
    },
  });

  const items = await Promise.all(rows.map(async (row) => {
    const donation = await prisma.donation.findFirst({
      where: {
        constituentId: row.id,
        status: "COMPLETED",
        constituent: { organizationId },
      },
      select: { id: true, amount: true, date: true },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    });
    const merged = await resolveLetterMergeContext({
      organizationId,
      actorUserId: req.user?.sub,
      constituentId: row.id,
      donationId: donation?.id,
      template: {
        id: "merge-field-line-preview",
        printSubject: null,
        emailSubject: null,
        printBody: line,
        emailBody: null,
      },
    });
    const recipientName = [row.firstName, row.lastName].filter(Boolean).join(" ").trim()
      || row.displayName?.trim()
      || row.organizationName?.trim()
      || row.id;

    return {
      constituentId: row.id,
      donationId: donation?.id ?? null,
      recipientName,
      renderedLine: htmlToPlainText(merged.mergedPrintBody || line),
      missingFields: merged.missingFields,
      unsupportedFields: merged.unsupportedFields,
    };
  }));

  res.json({ items });
});

/** POST /api/letters/ai-compose — Uses Steward AI to draft insertable letter content with supported merge fields. */
router.post("/ai-compose", requirePermission("letters.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = req.body as LetterAiComposePayload;
  const userPrompt = asShortString(payload.prompt, "", 1200);
  if (!userPrompt) {
    res.status(400).json({ error: { code: "PROMPT_REQUIRED", message: "Describe what Steward should write." } });
    return;
  }

  const aiSetting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_AI_PLUGIN_KEY,
      },
    },
    select: {
      enabled: true,
      config: true,
    },
  });

  if (!aiSetting?.enabled) {
    res.status(412).json({
      error: {
        code: "AI_NOT_ENABLED",
        message: "Steward AI is not enabled. Configure it in Settings > AI Assistant.",
      },
    });
    return;
  }

  const aiConfig = parseStewardAiConfig(aiSetting.config ?? {});
  const selectedText = asShortString(payload.selectedText, "", 4000);
  const currentBodyText = htmlToPlainText(asShortString(payload.currentBodyHtml, "", 12000)).slice(0, 2500);
  const useMergeFields = payload.useMergeFields !== false;
  const supportedFields = SUPPORTED_LETTER_MERGE_FIELDS.join(", ");
  const promptMessages: StewardAiChatMessage[] = [
    {
      role: "system",
      content: [
        "You are Steward AI writing one insertable section for an OyamaCRM donor letter template.",
        "Return JSON only with keys: bodyText, bodyHtml, mergeFieldsUsed.",
        "Write warm, donor-first nonprofit stewardship copy for staff review.",
        "Do not invent donor facts, donation history, program outcomes, staff actions, or promises.",
        "Do not include letterhead, footer, signature, page numbers, markdown fences, or explanations.",
        "bodyHtml must be a simple HTML fragment using only p, strong, em, ul, ol, li, br.",
        useMergeFields
          ? `You may personalize with only these exact merge fields: ${supportedFields}. Prefer salutation/name fields when helpful.`
          : "Do not include merge fields unless the user explicitly asks for a literal placeholder.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Template name: ${asShortString(payload.templateName, "Untitled letter", 160)}`,
        `Category: ${asShortString(payload.category, "GENERAL", 80)}`,
        `Tone: ${asShortString(payload.tone, "Warm and grateful", 80)}`,
        `Length: ${asShortString(payload.length, "Short", 80)}`,
        selectedText ? `Selected text to revise or continue:\n${selectedText}` : "Selected text: none",
        currentBodyText ? `Current letter context:\n${currentBodyText}` : "Current letter context: none",
        `Writing request:\n${userPrompt}`,
      ].join("\n\n"),
    },
  ];

  try {
    const aiResult = await withStewardAiTask(
      {
        organizationId,
        enabled: true,
        config: aiConfig,
        label: "Drafting letter editor content",
        status: "running_task",
        fallbackOnError: false,
      },
      () => runStewardAiChat(aiConfig, promptMessages, {
        model: aiConfig.model,
        temperature: 0.32,
        maxTokens: Math.min(Math.max(aiConfig.maxTokens || 900, 700), 1400),
      }),
    );

    const parsed = parseLetterAiComposeResponse(aiResult.content);
    await logAudit({
      action: "LETTER_AI_CONTENT_COMPOSED",
      entity: "LetterTemplate",
      entityId: "editor",
      userId: req.user?.sub,
      organizationId,
      metadata: {
        templateName: asShortString(payload.templateName, "", 160),
        category: asShortString(payload.category, "", 80),
        model: aiResult.model,
        mergeFieldsUsed: parsed.mergeFieldsUsed,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      bodyText: parsed.bodyText,
      bodyHtml: parsed.bodyHtml,
      mergeFieldsUsed: parsed.mergeFieldsUsed,
      model: aiResult.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Steward AI could not draft letter content.";
    if (/empty assistant response/i.test(message)) {
      const parsed = fallbackLetterAiCompose(payload);
      await logAudit({
        action: "LETTER_AI_CONTENT_COMPOSED_FALLBACK",
        entity: "LetterTemplate",
        entityId: "editor",
        userId: req.user?.sub,
        organizationId,
        metadata: {
          templateName: asShortString(payload.templateName, "", 160),
          category: asShortString(payload.category, "", 80),
          reason: message,
          mergeFieldsUsed: parsed.mergeFieldsUsed,
        },
        ipAddress: req.ip,
        userAgent: req.headers["user-agent"],
      }).catch(() => undefined);

      res.json({
        bodyText: parsed.bodyText,
        bodyHtml: parsed.bodyHtml,
        mergeFieldsUsed: parsed.mergeFieldsUsed,
        model: "steward-fallback",
      });
      return;
    }

    console.error("[letters] POST /ai-compose failed", error);
    res.status(500).json({
      error: {
        code: "AI_COMPOSE_FAILED",
        message,
      },
    });
  }
});

/** POST /api/letters/ai-suggest — Returns one short inline writing suggestion for the editor cursor. */
router.post("/ai-suggest", requirePermission("letters.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = req.body as LetterAiSuggestPayload;
  const textBeforeCursor = asShortString(payload.textBeforeCursor, "", 1400);
  if (textBeforeCursor.trim().length < 12) {
    res.status(400).json({ error: { code: "CONTEXT_REQUIRED", message: "Type more letter content before requesting an inline suggestion." } });
    return;
  }

  const aiSetting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_AI_PLUGIN_KEY,
      },
    },
    select: {
      enabled: true,
      config: true,
    },
  });

  if (!aiSetting?.enabled) {
    res.status(412).json({
      error: {
        code: "AI_NOT_ENABLED",
        message: "Steward AI is not enabled. Configure it in Settings > AI Assistant.",
      },
    });
    return;
  }

  const aiConfig = parseStewardAiConfig(aiSetting.config ?? {});
  const currentBodyText = htmlToPlainText(asShortString(payload.currentBodyHtml, "", 12000)).slice(-2200);
  const previousSuggestion = asShortString(payload.previousSuggestion, "", 220);
  const trailingFragment = textBeforeCursor.split(/\n+/).pop()?.slice(-360) ?? textBeforeCursor.slice(-360);
  const promptMessages: StewardAiChatMessage[] = [
    {
      role: "system",
      content: [
        "You are Steward AI completing a donor letter sentence inside an editor.",
        "Return plain text only. No JSON. No markdown. No thinking. No explanation.",
        "Write at most one sentence, or a short phrase if the cursor appears mid-sentence.",
        "Continue the exact text before the cursor. Do not restart the paragraph.",
        "Do not repeat the same suggestion if a previous suggestion is provided.",
        "Do not invent donor facts, amounts, dates, or program outcomes.",
        payload.useMergeFields !== false
          ? "You may use supported OyamaCRM merge fields only when naturally needed."
          : "Do not include merge fields.",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `Template name: ${asShortString(payload.templateName, "Untitled letter", 160)}`,
        `Category: ${asShortString(payload.category, "GENERAL", 80)}`,
        `Letter context:\n${currentBodyText || textBeforeCursor}`,
        previousSuggestion ? `Previous suggestion to avoid:\n${previousSuggestion}` : "Previous suggestion to avoid: none",
        `Text immediately before cursor:\n${trailingFragment}`,
        "Continue from the cursor with the shortest useful completion.",
      ].join("\n\n"),
    },
  ];

  try {
    const aiResult = await withStewardAiTask(
      {
        organizationId,
        enabled: true,
        config: aiConfig,
        label: "Drafting inline letter suggestion",
        status: "running_task",
        fallbackOnError: false,
      },
      () => runStewardAiChat(aiConfig, promptMessages, {
        model: aiConfig.model,
        temperature: 0.18,
        maxTokens: 80,
      }),
    );

    const suggestion = normalizeInlineSuggestion(aiResult.content, previousSuggestion);
    res.json({
      suggestion: suggestion || fallbackInlineSuggestion(payload),
      model: aiResult.model,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Inline suggestion failed.";
    if (/empty assistant response/i.test(message)) {
      res.json({
        suggestion: fallbackInlineSuggestion(payload),
        model: "steward-fallback",
      });
      return;
    }
    console.error("[letters] POST /ai-suggest failed", error);
    res.status(500).json({
      error: {
        code: "AI_SUGGEST_FAILED",
        message,
      },
    });
  }
});

/**
 * POST /api/letters/media — Uploads one editor/signature image and returns a public URL.
 * Request: { fileName: string, mimeType: image/*, dataBase64: string, purpose?: "editor" | "signature" | "preset" }
 * Response: { url, fileName, mimeType, sizeBytes }
 */
router.post("/media", requirePermission("letters.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const fileName = typeof req.body?.fileName === "string" ? req.body.fileName.trim() : "";
  const mimeType = typeof req.body?.mimeType === "string" ? req.body.mimeType.trim().toLowerCase() : "";
  const dataBase64 = typeof req.body?.dataBase64 === "string" ? req.body.dataBase64.trim() : "";
  const purpose = typeof req.body?.purpose === "string" ? req.body.purpose.trim().toLowerCase() : "editor";

  if (!fileName || !dataBase64) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "fileName and dataBase64 are required." } });
    return;
  }
  if (!mimeType.startsWith("image/")) {
    res.status(400).json({ error: { code: "INVALID_MEDIA_TYPE", message: "Only image uploads are supported for printables." } });
    return;
  }
  if ((purpose === "signature" || purpose === "editor") && !["image/png", "image/jpeg", "image/jpg", "image/webp"].includes(mimeType)) {
    res.status(400).json({ error: { code: "UNSUPPORTED_PDF_IMAGE_TYPE", message: "Letter and signature images must be PNG, JPG, or WEBP so they render in generated PDFs." } });
    return;
  }

  const normalizedData = dataBase64.includes(",") ? dataBase64.split(",").pop() ?? "" : dataBase64;
  const buffer = Buffer.from(normalizedData, "base64");
  if (!buffer || buffer.byteLength === 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid base64 payload." } });
    return;
  }

  const maxBytes = purpose === "signature" ? 2 * 1024 * 1024 : 5 * 1024 * 1024;
  if (buffer.byteLength > maxBytes) {
    res.status(413).json({ error: { code: "PAYLOAD_TOO_LARGE", message: `Image upload must be ${Math.round(maxBytes / 1024 / 1024)}MB or smaller.` } });
    return;
  }

  const ext = resolveLetterMediaExtension(mimeType, fileName);
  const safeName = `${randomUUID()}.${ext}`;
  const uploadDir = path.resolve(process.cwd(), "public", "uploads", "letter-media", organizationId);
  const targetPath = path.join(uploadDir, safeName);

  await mkdir(uploadDir, { recursive: true });
  await writeFile(targetPath, buffer);

  const publicUrl = `/uploads/letter-media/${organizationId}/${safeName}`;
  await logAudit({
    action: "LETTER_MEDIA_UPLOADED",
    entity: "LetterMedia",
    entityId: safeName,
    organizationId,
    userId,
    metadata: { fileName, mimeType, purpose, sizeBytes: buffer.byteLength, publicUrl },
  });

  res.status(201).json({ url: publicUrl, fileName, mimeType, sizeBytes: buffer.byteLength });
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

  try {
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

    res.json(templates.map((template) => ({
      ...template,
      aiAssisted: Boolean(
        template.printBody?.includes(LETTER_TEMPLATE_AI_ASSISTED_MARKER)
        || template.emailBody?.includes(LETTER_TEMPLATE_AI_ASSISTED_MARKER),
      ),
    })));
  } catch (error) {
    if (isSchemaDriftError(error)) {
      res.status(503).json({
        error: {
          code: "MIGRATION_REQUIRED",
          message: migrationRequiredMessage("Letter templates"),
        },
      });
      return;
    }

    console.error("[letters] GET /templates failed", error);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load letter templates." } });
  }
});

/** GET /api/letters/templates/:id/print-preview — Returns merged sample output for browser print/PDF. */
router.get("/templates/:id/print-preview", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const template = await prisma.letterTemplate.findFirst({
    where: { id: getRouteId(req), organizationId },
    select: {
      id: true,
      name: true,
      printSubject: true,
      printBody: true,
      emailSubject: true,
      emailBody: true,
    },
  });

  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  const detectedFields = collectMergeFieldKeys(template.printBody, template.emailBody, template.printSubject, template.emailSubject);
  const needsGiftContext = detectedFields.some((field) => field.startsWith("gift.") || field.startsWith("donation."));
  const requestedConstituentId = typeof req.query.constituentId === "string" ? req.query.constituentId.trim() : "";
  const sampleConstituent = await prisma.constituent.findFirst({
    where: {
      organizationId,
      ...(requestedConstituentId ? { id: requestedConstituentId } : {}),
      doNotMail: false,
      ...(needsGiftContext ? { donations: { some: { status: "COMPLETED" } } } : {}),
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      organizationName: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  if (requestedConstituentId && !sampleConstituent) {
    res.status(404).json({ error: { code: "PREVIEW_RECIPIENT_NOT_FOUND", message: "The selected preview recipient is unavailable or cannot receive mail." } });
    return;
  }

  const resolvedDonationId = await resolveDonationIdForRecipient({
    organizationId,
    constituentId: sampleConstituent?.id,
    donationMode: sampleConstituent ? "recent" : "none",
    donationWhere: buildDonationContextFilter({ donationDateRange: "All time" }),
  });

  const merged = await resolveLetterMergeContext({
    organizationId,
    template,
    constituentId: sampleConstituent?.id,
    donationId: resolvedDonationId,
    actorUserId: userId,
  });

  const recipientName = sampleConstituent
    ? [sampleConstituent.firstName, sampleConstituent.lastName].filter(Boolean).join(" ").trim()
      || sampleConstituent.displayName?.trim()
      || sampleConstituent.organizationName?.trim()
      || "Sample Preview Recipient"
    : "Sample Preview Recipient";

  res.json({
    templateId: template.id,
    templateName: template.name,
    mergedPrintSubject: recipientFacingLetterSubject(merged.mergedPrintSubject || template.printSubject),
    mergedPrintBody: merged.mergedPrintBody,
    missingFields: merged.missingFields,
    unsupportedFields: merged.unsupportedFields,
    resolvedConstituentId: merged.resolvedConstituentId,
    resolvedDonationId: merged.resolvedDonationId,
    recipient: sampleConstituent
      ? {
        id: sampleConstituent.id,
        displayName: recipientName,
        addressLine1: sampleConstituent.addressLine1 ?? "",
        addressLine2: sampleConstituent.addressLine2 ?? "",
        city: sampleConstituent.city ?? "",
        state: sampleConstituent.state ?? "",
        postalCode: sampleConstituent.zip ?? "",
      }
      : {
        id: null,
        displayName: recipientName,
        addressLine1: "",
        addressLine2: "",
        city: "",
        state: "",
        postalCode: "",
      },
  });
});

/** GET /api/letters/templates/:id — Returns one template with preset references. */
router.get("/templates/:id", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  try {
    const template = await prisma.letterTemplate.findFirst({
      where: { id: getRouteId(req), organizationId },
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
  } catch (error) {
    if (isSchemaDriftError(error)) {
      res.status(503).json({
        error: {
          code: "MIGRATION_REQUIRED",
          message: migrationRequiredMessage("Letter template details"),
        },
      });
      return;
    }

    console.error("[letters] GET /templates/:id failed", error);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load letter template." } });
  }
});

/** GET /api/letters/templates/:id/export — Downloads one portable letter template backup. */
router.get("/templates/:id/export", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const template = await prisma.letterTemplate.findFirst({ where: { id: getRouteId(req), organizationId } });
  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  const payload: LetterTemplateExportPayload = {
    schema: LETTER_TEMPLATE_EXPORT_SCHEMA,
    version: LETTER_TEMPLATE_EXPORT_VERSION,
    kind: "oyama-letter-template",
    exportedAt: new Date().toISOString(),
    source: {
      templateId: template.id,
      organizationId,
      app: "OyamaLetters",
    },
    template: {
      name: template.name,
      category: template.category,
      description: template.description,
      printSubject: template.printSubject,
      printBody: template.printBody,
      printLayoutJson: template.printLayoutJson,
      emailSubject: template.emailSubject,
      emailBody: template.emailBody,
      headerPresetId: template.headerPresetId,
      footerPresetId: template.footerPresetId,
      signatureBlockId: template.signatureBlockId,
      logoMode: template.logoMode,
      customLogoUrl: template.customLogoUrl,
      crmScope: template.crmScope,
    },
  };

  await logAudit({
    action: "LETTER_TEMPLATE_EXPORTED",
    entity: "LetterTemplate",
    entityId: template.id,
    organizationId,
    userId,
    metadata: { schema: payload.schema, version: payload.version },
  });

  const fileName = `${sanitizeJsonDownloadName(template.name)}_letter_template.json`;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "no-store");
  res.status(200).send(JSON.stringify(payload, null, 2));
});

/** POST /api/letters/templates/apply-default-branding — Applies current default header/footer/signature to all non-archived templates. */
router.post("/templates/apply-default-branding", requirePermission("letters.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const [defaultHeader, defaultFooter, defaultSignature] = await Promise.all([
    prisma.letterHeaderPreset.findFirst({ where: { organizationId, isDefault: true, isActive: true }, select: { id: true } }),
    prisma.letterFooterPreset.findFirst({ where: { organizationId, isDefault: true, isActive: true }, select: { id: true } }),
    prisma.letterSignatureBlock.findFirst({ where: { organizationId, isDefault: true, isActive: true }, select: { id: true } }),
  ]);

  if (!defaultHeader || !defaultFooter) {
    res.status(400).json({
      error: {
        code: "DEFAULT_BRANDING_INCOMPLETE",
        message: "Set an active default header and footer before applying defaults to templates.",
      },
    });
    return;
  }

  const result = await prisma.letterTemplate.updateMany({
    where: {
      organizationId,
      status: { in: ["DRAFT", "ACTIVE"] },
    },
    data: {
      headerPresetId: defaultHeader.id,
      footerPresetId: defaultFooter.id,
      ...(defaultSignature ? { signatureBlockId: defaultSignature.id } : {}),
      updatedByUserId: userId,
    },
  });

  await logAudit({
    action: "LETTER_TEMPLATE_DEFAULT_BRANDING_APPLIED",
    entity: "LetterTemplate",
    organizationId,
    userId,
    metadata: {
      updatedCount: result.count,
      headerPresetId: defaultHeader.id,
      footerPresetId: defaultFooter.id,
      signatureBlockId: defaultSignature?.id ?? null,
    },
  });

  res.json({
    success: true,
    updatedCount: result.count,
    applied: {
      headerPresetId: defaultHeader.id,
      footerPresetId: defaultFooter.id,
      signatureBlockId: defaultSignature?.id ?? null,
    },
  });
});

/** POST /api/letters/templates/import — Imports a portable letter template backup as a new draft. */
router.post("/templates/import", requirePermission("letters.create"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const imported = unwrapLetterTemplateImport(req.body);
  const template = asRecord(imported.template);
  if (imported.schema !== LETTER_TEMPLATE_EXPORT_SCHEMA || imported.kind !== "oyama-letter-template" || !template) {
    res.status(400).json({ error: { code: "INVALID_TEMPLATE_EXPORT", message: "Upload a valid OyamaLetters template export JSON file." } });
    return;
  }

  const name = typeof template.name === "string" && template.name.trim()
    ? `${template.name.trim()} (Imported ${new Date().toISOString().slice(0, 10)})`
    : `Imported Letter Template ${new Date().toISOString().slice(0, 10)}`;
  const printBody = typeof template.printBody === "string" ? template.printBody : "";
  if (!printBody.trim()) {
    res.status(400).json({ error: { code: "PRINT_BODY_REQUIRED", message: "Imported letter template is missing print body content." } });
    return;
  }

  const category = parseEnum(template.category, LETTER_CATEGORIES) ?? "GENERAL";
  const logoMode = parseEnum(template.logoMode, LETTER_LOGO_MODES) ?? "ORGANIZATION_DEFAULT";
  const crmScope = parseEnum(template.crmScope, LETTER_CRM_SCOPES) ?? "DONOR";
  const [headerPresetId, footerPresetId, signatureBlockId] = await Promise.all([
    normalizeImportedLetterPresetId("header", template.headerPresetId, organizationId),
    normalizeImportedLetterPresetId("footer", template.footerPresetId, organizationId),
    normalizeImportedLetterPresetId("signature", template.signatureBlockId, organizationId),
  ]);
  const emailBody = typeof template.emailBody === "string" ? template.emailBody : null;
  const printSubject = typeof template.printSubject === "string" ? template.printSubject : null;
  const emailSubject = typeof template.emailSubject === "string" ? template.emailSubject : null;
  const mergeKeys = collectMergeFieldKeys(printBody, emailBody, printSubject, emailSubject);

  const created = await prisma.letterTemplate.create({
    data: {
      organizationId,
      name,
      category,
      description: typeof template.description === "string" ? template.description.trim() || null : null,
      status: "DRAFT",
      printSubject,
      printBody,
      printLayoutJson: asJsonObject(template.printLayoutJson),
      emailSubject,
      emailBody,
      headerPresetId,
      footerPresetId,
      signatureBlockId,
      logoMode,
      customLogoUrl: typeof template.customLogoUrl === "string" ? template.customLogoUrl : null,
      mergeFieldsUsed: mergeKeys,
      crmScope,
      createdByUserId: userId,
      updatedByUserId: userId,
    },
  });

  await logAudit({
    action: "LETTER_TEMPLATE_IMPORTED",
    entity: "LetterTemplate",
    entityId: created.id,
    organizationId,
    userId,
    metadata: {
      sourceTemplateId: asRecord(imported.source).templateId ?? null,
      sourceOrganizationId: asRecord(imported.source).organizationId ?? null,
      restoredPresetLinks: {
        headerPresetId,
        footerPresetId,
        signatureBlockId,
      },
    },
  });

  res.status(201).json(created);
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

  const headerPresetId = normalizeOptionalId(req.body?.headerPresetId);
  const footerPresetId = normalizeOptionalId(req.body?.footerPresetId);
  const signatureBlockId = normalizeOptionalId(req.body?.signatureBlockId);

  if (headerPresetId) {
    const headerPreset = await prisma.letterHeaderPreset.findFirst({ where: { id: headerPresetId, organizationId }, select: { id: true } });
    if (!headerPreset) {
      res.status(400).json({ error: { code: "INVALID_HEADER_PRESET", message: "Selected header preset was not found." } });
      return;
    }
  }
  if (footerPresetId) {
    const footerPreset = await prisma.letterFooterPreset.findFirst({ where: { id: footerPresetId, organizationId }, select: { id: true } });
    if (!footerPreset) {
      res.status(400).json({ error: { code: "INVALID_FOOTER_PRESET", message: "Selected footer preset was not found." } });
      return;
    }
  }
  if (signatureBlockId) {
    const signatureBlock = await prisma.letterSignatureBlock.findFirst({ where: { id: signatureBlockId, organizationId }, select: { id: true } });
    if (!signatureBlock) {
      res.status(400).json({ error: { code: "INVALID_SIGNATURE_BLOCK", message: "Selected signature block was not found." } });
      return;
    }
  }

  const created = await prisma.letterTemplate.create({
    data: {
      organizationId,
      name,
      category,
      description: typeof req.body?.description === "string" ? req.body.description.trim() || null : null,
      status,
      printSubject: typeof req.body?.printSubject === "string" ? req.body.printSubject : null,
      printBody,
      printLayoutJson: asJsonObject(req.body?.printLayoutJson),
      emailSubject: typeof req.body?.emailSubject === "string" ? req.body.emailSubject : null,
      emailBody: typeof req.body?.emailBody === "string" ? req.body.emailBody : null,
      headerPresetId,
      footerPresetId,
      signatureBlockId,
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

  const existing = await prisma.letterTemplate.findFirst({ where: { id: getRouteId(req), organizationId } });
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
  if (req.body?.printLayoutJson !== undefined) {
    patch.printLayoutJson = asJsonObject(req.body.printLayoutJson) ?? Prisma.JsonNull;
  }
  if (req.body?.emailSubject !== undefined) patch.emailSubject = typeof req.body.emailSubject === "string" ? req.body.emailSubject : null;
  if (req.body?.emailBody !== undefined) patch.emailBody = typeof req.body.emailBody === "string" ? req.body.emailBody : null;

  if (req.body?.customLogoUrl !== undefined) patch.customLogoUrl = typeof req.body.customLogoUrl === "string" ? req.body.customLogoUrl : null;

  if (req.body?.headerPresetId !== undefined) {
    const nextHeaderPresetId = normalizeOptionalId(req.body.headerPresetId);
    if (nextHeaderPresetId) {
      const headerPreset = await prisma.letterHeaderPreset.findFirst({ where: { id: nextHeaderPresetId, organizationId }, select: { id: true } });
      if (!headerPreset) {
        res.status(400).json({ error: { code: "INVALID_HEADER_PRESET", message: "Selected header preset was not found." } });
        return;
      }
      patch.headerPreset = { connect: { id: nextHeaderPresetId } };
    } else {
      patch.headerPreset = { disconnect: true };
    }
  }
  if (req.body?.footerPresetId !== undefined) {
    const nextFooterPresetId = normalizeOptionalId(req.body.footerPresetId);
    if (nextFooterPresetId) {
      const footerPreset = await prisma.letterFooterPreset.findFirst({ where: { id: nextFooterPresetId, organizationId }, select: { id: true } });
      if (!footerPreset) {
        res.status(400).json({ error: { code: "INVALID_FOOTER_PRESET", message: "Selected footer preset was not found." } });
        return;
      }
      patch.footerPreset = { connect: { id: nextFooterPresetId } };
    } else {
      patch.footerPreset = { disconnect: true };
    }
  }
  if (req.body?.signatureBlockId !== undefined) {
    const nextSignatureBlockId = normalizeOptionalId(req.body.signatureBlockId);
    if (nextSignatureBlockId) {
      const signatureBlock = await prisma.letterSignatureBlock.findFirst({ where: { id: nextSignatureBlockId, organizationId }, select: { id: true } });
      if (!signatureBlock) {
        res.status(400).json({ error: { code: "INVALID_SIGNATURE_BLOCK", message: "Selected signature block was not found." } });
        return;
      }
      patch.signatureBlock = { connect: { id: nextSignatureBlockId } };
    } else {
      patch.signatureBlock = { disconnect: true };
    }
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

/** POST /api/letters/templates/:id/publish — Runs publish preflight checks and activates one template when confirmed. */
router.post("/templates/:id/publish", requirePermission("letters.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const template = await prisma.letterTemplate.findFirst({
    where: { id: getRouteId(req), organizationId },
    include: {
      headerPreset: { select: { id: true, name: true, isActive: true } },
      footerPreset: { select: { id: true, name: true, isActive: true } },
      signatureBlock: { select: { id: true, name: true, isActive: true } },
    },
  });
  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  const detectedFields = collectMergeFieldKeys(
    template.printBody,
    template.emailBody,
    template.printSubject,
    template.emailSubject,
  );
  const unsupportedFields = unsupportedMergeFieldKeys(detectedFields);

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (template.status === "ARCHIVED") {
    blockers.push("Archived templates cannot be published. Restore or duplicate first.");
  }
  if (!template.name.trim()) {
    blockers.push("Template name is required.");
  }
  if (!template.printBody.trim()) {
    blockers.push("Print body is required.");
  }
  if (unsupportedFields.length > 0) {
    blockers.push(`Unsupported merge fields detected: ${unsupportedFields.join(", ")}`);
  }

  if (template.headerPresetId && (!template.headerPreset || !template.headerPreset.isActive)) {
    blockers.push("Selected header preset is missing or inactive.");
  }
  if (template.footerPresetId && (!template.footerPreset || !template.footerPreset.isActive)) {
    blockers.push("Selected footer preset is missing or inactive.");
  }
  if (template.signatureBlockId && (!template.signatureBlock || !template.signatureBlock.isActive)) {
    blockers.push("Selected signature block is missing or inactive.");
  }

  const sampleConstituent = await prisma.constituent.findFirst({
    where: { organizationId, doNotMail: false },
    select: {
      id: true,
      doNotMail: true,
      addressLine1: true,
      city: true,
      state: true,
      zip: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  let sampleValidation: { valid: boolean; reasons: GenerationValidationCode[] } | null = null;
  let samplePdfPreflight: LetterTemplatePublishSnapshot["samplePdfPreflight"] = {
    checked: false,
    canRender: false,
    renderer: "SERVER_RENDER",
    parser: "htmlToPdfBlocks",
    blockCount: 0,
    reason: "NO_SAMPLE_RECIPIENT",
  };
  if (sampleConstituent) {
    const sampleMerged = await resolveLetterMergeContext({
      organizationId,
      template,
      constituentId: sampleConstituent.id,
      actorUserId: userId,
    });

    sampleValidation = validateGenerationPlan({
      constituent: sampleConstituent,
      merged: sampleMerged,
    });

    if (!sampleValidation.valid) {
      warnings.push(`Sample recipient validation produced: ${sampleValidation.reasons.filter((code) => code !== "VALID").join(", ")}`);
    }

    try {
      const blocks = htmlToPdfBlocks(sampleMerged.mergedPrintBody || "");
      samplePdfPreflight = {
        checked: true,
        canRender: true,
        renderer: "SERVER_RENDER",
        parser: "htmlToPdfBlocks",
        blockCount: blocks.length,
        reason: null,
      };
    } catch {
      samplePdfPreflight = {
        checked: true,
        canRender: false,
        renderer: "SERVER_RENDER",
        parser: "htmlToPdfBlocks",
        blockCount: 0,
        reason: "PARSER_FAILURE",
      };
      blockers.push("Sample PDF render preflight failed.");
    }
  } else {
    warnings.push("No sample recipient found. Publish preflight used a synthetic preview context for PDF parser checks.");
    try {
      const sampleMerged = await resolveLetterMergeContext({
        organizationId,
        template,
        actorUserId: userId,
      });
      const blocks = htmlToPdfBlocks(sampleMerged.mergedPrintBody || "");
      samplePdfPreflight = {
        checked: true,
        canRender: true,
        renderer: "SERVER_RENDER",
        parser: "htmlToPdfBlocks",
        blockCount: blocks.length,
        reason: null,
      };
    } catch {
      samplePdfPreflight = {
        checked: true,
        canRender: false,
        renderer: "SERVER_RENDER",
        parser: "htmlToPdfBlocks",
        blockCount: 0,
        reason: "PARSER_FAILURE",
      };
      blockers.push("Sample PDF render preflight failed.");
    }
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) {
    res.status(200).json({
      canPublish: true,
      confirmed: confirm,
      blockers,
      warnings,
      unsupportedFields,
      sampleValidation,
      samplePdfPreflight,
      template: {
        id: template.id,
        status: template.status,
      },
    });
    return;
  }

  const updated = await prisma.letterTemplate.update({
    where: { id: template.id },
    data: {
      status: "ACTIVE",
      updatedByUserId: userId,
    },
  });

  const publishedAt = new Date().toISOString();
  const publishSnapshot: LetterTemplatePublishSnapshot = {
    id: randomUUID(),
    templateId: template.id,
    templateName: template.name,
    createdAt: publishedAt,
    createdByUserId: userId,
    previousStatus: template.status,
    nextStatus: "ACTIVE",
    unsupportedFields,
    warnings,
    sampleValidation: sampleValidation
      ? {
        valid: sampleValidation.valid,
        reasons: sampleValidation.reasons,
      }
      : null,
    samplePdfPreflight,
    snapshot: {
      name: template.name,
      category: template.category,
      status: "ACTIVE",
      headerPresetId: template.headerPresetId,
      footerPresetId: template.footerPresetId,
      signatureBlockId: template.signatureBlockId,
      logoMode: template.logoMode,
      customLogoUrl: template.customLogoUrl,
      printSubject: template.printSubject,
      printBody: template.printBody,
      emailSubject: template.emailSubject,
      emailBody: template.emailBody,
    },
  };
  await appendTemplatePublishHistory(organizationId, publishSnapshot);

  await logAudit({
    action: "LETTER_TEMPLATE_PUBLISHED",
    entity: "LetterTemplate",
    entityId: updated.id,
    organizationId,
    userId,
    metadata: {
      previousStatus: template.status,
      nextStatus: updated.status,
      blockerCount: blockers.length,
      warningCount: warnings.length,
    },
  });

  res.json({
    canPublish: true,
    published: true,
    publishedAt,
    blockers,
    warnings,
    unsupportedFields,
    sampleValidation,
    samplePdfPreflight,
    publishSnapshotId: publishSnapshot.id,
    template: updated,
  });
});

/** GET /api/letters/templates/:id/publish-history — Returns immutable publish snapshots for one template. */
router.get("/templates/:id/publish-history", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const templateId = getRouteId(req);
  const existing = await prisma.letterTemplate.findFirst({
    where: { id: templateId, organizationId },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  const limit = parsePositiveInt(req.query.limit, 20, 1, 100);
  const rows = (await getTemplatePublishHistory(organizationId))
    .filter((entry) => entry.templateId === templateId)
    .slice(0, limit);

  res.json({ items: rows, count: rows.length });
});

/** POST /api/letters/templates/:id/sample-pdf — Renders one sample merged template PDF server-side. */
router.post("/templates/:id/sample-pdf", requirePermission("letters.edit"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const template = await prisma.letterTemplate.findFirst({
    where: { id: getRouteId(req), organizationId },
    select: {
      id: true,
      name: true,
      headerPresetId: true,
      footerPresetId: true,
      signatureBlockId: true,
      printSubject: true,
      printBody: true,
      emailSubject: true,
      emailBody: true,
      headerPreset: true,
      footerPreset: true,
      signatureBlock: true,
    },
  });
  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  const requestedConstituentId = typeof req.body?.constituentId === "string" ? req.body.constituentId.trim() : "";
  const draftInput = req.body?.draft && typeof req.body.draft === "object" && !Array.isArray(req.body.draft)
    ? req.body.draft as Record<string, unknown>
    : null;
  const draftSignatureBlockId = typeof draftInput?.signatureBlockId === "string" ? draftInput.signatureBlockId.trim() : "";
  const hasDraftSignatureOverride = Boolean(draftInput && Object.prototype.hasOwnProperty.call(draftInput, "signatureBlockId"));
  const previewTemplate = {
    id: template.id,
    name: typeof draftInput?.name === "string" && draftInput.name.trim() ? draftInput.name.trim() : template.name,
    printSubject: typeof draftInput?.printSubject === "string" ? draftInput.printSubject : template.printSubject,
    printBody: typeof draftInput?.printBody === "string" ? draftInput.printBody : template.printBody,
    emailSubject: typeof draftInput?.emailSubject === "string" ? draftInput.emailSubject : template.emailSubject,
    emailBody: typeof draftInput?.emailBody === "string" ? draftInput.emailBody : template.emailBody,
  };

  const sampleConstituent = await prisma.constituent.findFirst({
    where: requestedConstituentId
      ? { id: requestedConstituentId, organizationId }
      : { organizationId, doNotMail: false },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      doNotMail: true,
      addressLine1: true,
      addressLine2: true,
      city: true,
      state: true,
      zip: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  const sampleRecipient = sampleConstituent ?? {
    id: "sample-preview-recipient",
    firstName: "Sample",
    lastName: "Recipient",
    doNotMail: false,
    addressLine1: "123 Preview Lane",
    addressLine2: null,
    city: "Preview City",
    state: "ST",
    zip: "00000",
  };

  try {
    const [previewSignatureBlock, defaultPresets] = await Promise.all([
      hasDraftSignatureOverride
        ? draftSignatureBlockId
          ? prisma.letterSignatureBlock.findFirst({ where: { id: draftSignatureBlockId, organizationId } })
          : Promise.resolve(null)
        : Promise.resolve(template.signatureBlock),
      getDefaultLetterPdfPresets(organizationId),
    ]);

    const donationMode = parseEnum(req.body?.donationMode, LETTER_DONATION_MODES)
      ?? (req.body?.donationId ? "specific" : sampleConstituent ? "recent" : "none");
    const donationIds = parseDonationIds(req.body?.donationIds);
    const selectedDonationIdByConstituent = donationMode === "selected"
      ? await buildSelectedDonationIdByConstituent({ organizationId, donationIds })
      : undefined;
    const resolvedDonationId = await resolveDonationIdForRecipient({
      organizationId,
      constituentId: sampleConstituent?.id,
    donationMode,
    specificDonationId: typeof req.body?.donationId === "string" ? req.body.donationId : undefined,
    selectedDonationIds: donationIds,
    selectedDonationIdByConstituent,
    donationWhere: buildDonationContextFilter({
        ...(req.body && typeof req.body === "object" && !Array.isArray(req.body) ? req.body : {}),
        donationDateRange: req.body?.donationDateRange ?? "All time",
      }),
    });

    const merged = await resolveLetterMergeContext({
      organizationId,
      template: previewTemplate,
      constituentId: sampleConstituent?.id,
      donationId: resolvedDonationId,
      actorUserId: userId,
    });

    const branding = await getLetterPdfBrandingContext(organizationId);
    const constituentName = [sampleRecipient.firstName, sampleRecipient.lastName]
      .filter((value): value is string => Boolean(value && value.trim()))
      .join(" ")
      .trim();
    const templateName = previewTemplate.name?.trim() || "Template Sample";
    const subject = recipientFacingLetterSubject(merged.mergedPrintSubject || previewTemplate.printSubject);

    const pdfBuffer = await renderGeneratedLetterPdf({
      templateName,
      subject,
      constituentName,
      recipient: {
        fullName: constituentName,
        addressLine1: sampleRecipient.addressLine1 ?? "",
        addressLine2: sampleRecipient.addressLine2 ?? "",
        city: sampleRecipient.city ?? "",
        state: sampleRecipient.state ?? "",
        zip: sampleRecipient.zip ?? "",
      },
      generatedAt: new Date(),
      mergedPrintBody: merged.mergedPrintBody || "",
      branding,
      presets: {
        headerPreset: template.headerPreset ?? defaultPresets.headerPreset,
        footerPreset: template.footerPreset ?? defaultPresets.footerPreset,
        signatureBlock: previewSignatureBlock ?? defaultPresets.signatureBlock,
      },
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `${sanitizePdfFilename(templateName)}_sample_${timestamp}.pdf`;

    await logAudit({
      action: "LETTER_TEMPLATE_SAMPLE_PDF_EXPORTED",
      entity: "LetterTemplate",
      entityId: template.id,
      organizationId,
      userId,
      metadata: {
        mode: "SERVER_RENDER",
        status: "SUCCESS",
        sampleConstituentId: sampleConstituent?.id ?? null,
        syntheticPreviewRecipient: !sampleConstituent,
        draftPreview: Boolean(draftInput),
        byteLength: pdfBuffer.byteLength,
      },
    });

    const dispositionType = req.query.preview === "1" || req.query.inline === "1" ? "inline" : "attachment";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${dispositionType}; filename="${fileName}"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown sample PDF export failure";
    console.error("[letters] Sample PDF export failed", {
      templateId: template.id,
      templateName: previewTemplate.name,
      organizationId,
      userId,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      renderer: "SERVER_RENDER",
      parser: "htmlToPdfBlocks",
    });
    await logAudit({
      action: "LETTER_TEMPLATE_SAMPLE_PDF_EXPORT_FAILED",
      entity: "LetterTemplate",
      entityId: template.id,
      organizationId,
      userId,
      metadata: {
        mode: "SERVER_RENDER",
        status: "FAILED",
        error: message,
      },
    });

    if (error instanceof LetterPdfLayoutError) {
      res.status(422).json({ error: { code: error.code, message } });
      return;
    }

    res.status(500).json({
      error: {
        code: "PDF_EXPORT_FAILED",
        message: "Failed to export sample template PDF.",
        details: process.env.NODE_ENV === "production" ? undefined : message,
      },
    });
  }
});

/** POST /api/letters/templates/:id/duplicate — Clones one template into a new draft. */
router.post("/templates/:id/duplicate", requirePermission("letters.create"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const existing = await prisma.letterTemplate.findFirst({ where: { id: getRouteId(req), organizationId } });
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
      printLayoutJson: existing.printLayoutJson === null
        ? Prisma.JsonNull
        : (existing.printLayoutJson as Prisma.InputJsonValue | undefined),
      emailSubject: existing.emailSubject,
      emailBody: existing.emailBody,
      headerPresetId: existing.headerPresetId,
      footerPresetId: existing.footerPresetId,
      signatureBlockId: existing.signatureBlockId,
      logoMode: existing.logoMode,
      customLogoUrl: existing.customLogoUrl,
      mergeFieldsUsed: (existing.mergeFieldsUsed ?? []) as Prisma.InputJsonValue,
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

  const existing = await prisma.letterTemplate.findFirst({ where: { id: getRouteId(req), organizationId } });
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

  const existing = await prisma.letterHeaderPreset.findFirst({ where: { id: getRouteId(req), organizationId } });
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

  const existing = await prisma.letterHeaderPreset.findFirst({ where: { id: getRouteId(req), organizationId } });
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

  const existing = await prisma.letterFooterPreset.findFirst({ where: { id: getRouteId(req), organizationId } });
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

  const existing = await prisma.letterFooterPreset.findFirst({ where: { id: getRouteId(req), organizationId } });
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

function validateSignatureImageUrl(value: unknown): { ok: true; value: string | null } | { ok: false; message: string } {
  if (value === undefined) return { ok: true, value: null };
  if (value === null) return { ok: true, value: null };
  if (typeof value !== "string") return { ok: true, value: null };
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (trimmed.startsWith("data:image/")) {
    return { ok: false, message: "Handwritten signatures must be uploaded first. Data URLs are not supported for saving." };
  }
  if (trimmed.length > 2048) {
    return { ok: false, message: "Signature image URL is too long. Upload the image and use the stored media URL." };
  }
  return { ok: true, value: trimmed };
}

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

  const signatureImageValidation = validateSignatureImageUrl(req.body?.signatureImageUrl);
  if (!signatureImageValidation.ok) {
    res.status(400).json({ error: { code: "INVALID_SIGNATURE_IMAGE", message: signatureImageValidation.message } });
    return;
  }

  const signature = await prisma.letterSignatureBlock.create({
    data: {
      organizationId,
      name,
      signerName,
      signerTitle: typeof req.body?.signerTitle === "string" ? req.body.signerTitle : null,
      closingPhrase: typeof req.body?.closingPhrase === "string" ? req.body.closingPhrase : null,
      signatureImageUrl: signatureImageValidation.value,
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

  await syncDefaultLetterSignatureIntoBranding(organizationId);

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

  const existing = await prisma.letterSignatureBlock.findFirst({ where: { id: getRouteId(req), organizationId } });
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
  if (req.body?.signatureImageUrl !== undefined) {
    const signatureImageValidation = validateSignatureImageUrl(req.body.signatureImageUrl);
    if (!signatureImageValidation.ok) {
      res.status(400).json({ error: { code: "INVALID_SIGNATURE_IMAGE", message: signatureImageValidation.message } });
      return;
    }
    patch.signatureImageUrl = signatureImageValidation.value;
  }
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

  await syncDefaultLetterSignatureIntoBranding(organizationId);

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

  const existing = await prisma.letterSignatureBlock.findFirst({ where: { id: getRouteId(req), organizationId } });
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
  await syncDefaultLetterSignatureIntoBranding(organizationId);
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
  const templateId = typeof req.query.templateId === "string" ? req.query.templateId : undefined;
  const constituentId = typeof req.query.constituentId === "string" ? req.query.constituentId : undefined;
  const sourceTaskId = typeof req.query.sourceTaskId === "string" ? req.query.sourceTaskId : undefined;
  const stewardPathEnrollmentId = typeof req.query.stewardPathEnrollmentId === "string" ? req.query.stewardPathEnrollmentId : undefined;
  const stewardPathStepRunId = typeof req.query.stewardPathStepRunId === "string" ? req.query.stewardPathStepRunId : undefined;
  const limit = parsePositiveInt(req.query.limit, 100, 1, 400);

  const rows = await prisma.generatedLetter.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
      ...(templateId ? { templateId } : {}),
      ...(constituentId ? { constituentId } : {}),
      ...(sourceTaskId ? { sourceTaskId } : {}),
      ...(stewardPathEnrollmentId ? { stewardPathEnrollmentId } : {}),
      ...(stewardPathStepRunId ? { stewardPathStepRunId } : {}),
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
      constituentId: getRouteId(req),
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

  const template = await getTemplateForGeneration(organizationId, templateId, { activeOnly: true });
  if (!template) {
    res.status(404).json({
      error: {
        code: "TEMPLATE_NOT_ACTIVE",
        message: "Template not found or not ACTIVE. Only active templates can be batch generated.",
      },
    });
    return;
  }

  const year = typeof req.body?.year === "number" ? req.body.year : Number.parseInt(String(req.body?.year ?? ""), 10);
  const constituentId = typeof req.body?.constituentId === "string" ? req.body.constituentId : undefined;
  const donationMode = parseEnum(req.body?.donationMode, LETTER_DONATION_MODES) ?? (req.body?.donationId ? "specific" : "none");
  const donationIds = parseDonationIds(req.body?.donationIds);
  const selectedDonationIdByConstituent = donationMode === "selected"
    ? await buildSelectedDonationIdByConstituent({ organizationId, donationIds })
    : undefined;
  const donationWhere = buildDonationContextFilter(req.body);
  const resolvedDonationId = await resolveDonationIdForRecipient({
    organizationId,
    constituentId,
    donationMode,
    specificDonationId: typeof req.body?.donationId === "string" ? req.body.donationId : undefined,
    selectedDonationIds: donationIds,
    selectedDonationIdByConstituent,
    donationWhere,
  });
  const merged = await resolveLetterMergeContext({
    organizationId,
    template,
    constituentId,
    donationId: resolvedDonationId,
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

/** POST /api/letters/generated/preview-pdf — Renders a production-faithful PDF preview without saving a generated letter. */
router.post("/generated/preview-pdf", requirePermission("letters.generate"), async (req, res) => {
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

  const template = await getTemplateForGeneration(organizationId, templateId, { activeOnly: true });
  if (!template) {
    res.status(404).json({
      error: {
        code: "TEMPLATE_NOT_ACTIVE",
        message: "Template not found or not ACTIVE. Only active templates can be previewed for production generation.",
      },
    });
    return;
  }

  const constituentId = typeof req.body?.constituentId === "string" ? req.body.constituentId : undefined;
  if (!constituentId) {
    res.status(400).json({ error: { code: "CONSTITUENT_REQUIRED", message: "constituentId is required for PDF preview." } });
    return;
  }

  const year = typeof req.body?.year === "number" ? req.body.year : Number.parseInt(String(req.body?.year ?? ""), 10);
  const donationMode = parseEnum(req.body?.donationMode, LETTER_DONATION_MODES) ?? (req.body?.donationId ? "specific" : "none");
  const donationIds = parseDonationIds(req.body?.donationIds);
  const selectedDonationIdByConstituent = donationMode === "selected"
    ? await buildSelectedDonationIdByConstituent({ organizationId, donationIds })
    : undefined;
  const donationWhere = buildDonationContextFilter(req.body);
  const resolvedDonationId = await resolveDonationIdForRecipient({
    organizationId,
    constituentId,
    donationMode,
    specificDonationId: typeof req.body?.donationId === "string" ? req.body.donationId : undefined,
    selectedDonationIds: donationIds,
    selectedDonationIdByConstituent,
    donationWhere,
  });

  const [templateChrome, constituent] = await Promise.all([
    prisma.letterTemplate.findFirst({
      where: { id: templateId, organizationId, status: "ACTIVE" },
      select: { headerPreset: true, footerPreset: true, signatureBlock: true },
    }),
    prisma.constituent.findFirst({
      where: { id: constituentId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        organizationName: true,
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        zip: true,
      },
    }),
  ]);

  if (!constituent) {
    res.status(404).json({ error: { code: "CONSTITUENT_NOT_FOUND", message: "Preview recipient was not found." } });
    return;
  }

  try {
    const merged = await resolveLetterMergeContext({
      organizationId,
      template,
      constituentId,
      donationId: resolvedDonationId,
      campaignId: typeof req.body?.campaignId === "string" ? req.body.campaignId : undefined,
      eventId: typeof req.body?.eventId === "string" ? req.body.eventId : undefined,
      year: Number.isFinite(year) ? year : undefined,
      actorUserId: userId,
    });
    const [branding, defaultPresets] = await Promise.all([
      getLetterPdfBrandingContext(organizationId),
      getDefaultLetterPdfPresets(organizationId),
    ]);
    const constituentName = [constituent.firstName, constituent.lastName].filter(Boolean).join(" ").trim()
      || constituent.displayName?.trim()
      || constituent.organizationName?.trim()
      || "Preview Recipient";
    const subject = recipientFacingLetterSubject(merged.mergedPrintSubject || template.printSubject);
    const pdfBuffer = await renderGeneratedLetterPdf({
      templateName: template.name,
      subject,
      constituentName,
      recipient: {
        fullName: constituentName,
        addressLine1: constituent.addressLine1 ?? "",
        addressLine2: constituent.addressLine2 ?? "",
        city: constituent.city ?? "",
        state: constituent.state ?? "",
        zip: constituent.zip ?? "",
      },
      generatedAt: new Date(),
      mergedPrintBody: merged.mergedPrintBody || "",
      branding,
      presets: {
        headerPreset: templateChrome?.headerPreset ?? defaultPresets.headerPreset,
        footerPreset: templateChrome?.footerPreset ?? defaultPresets.footerPreset,
        signatureBlock: templateChrome?.signatureBlock ?? defaultPresets.signatureBlock,
      },
    });

    console.info("[letters] Generated production-faithful preview PDF", {
      templateId,
      constituentId,
      donationId: resolvedDonationId ?? null,
      organizationId,
      byteLength: pdfBuffer.byteLength,
      missingFields: merged.missingFields,
      unsupportedFields: merged.unsupportedFields,
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `${sanitizePdfFilename(template.name)}_${sanitizePdfFilename(constituentName)}_preview_${timestamp}.pdf`;
    const dispositionType = req.query.preview === "1" || req.query.inline === "1" ? "inline" : "attachment";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${dispositionType}; filename="${fileName}"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown preview PDF failure";
    console.error("[letters] Generated preview PDF failed", {
      templateId,
      constituentId,
      donationId: resolvedDonationId ?? null,
      organizationId,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
    });
    if (error instanceof LetterPdfLayoutError) {
      res.status(422).json({ error: { code: error.code, message } });
      return;
    }

    res.status(500).json({
      error: {
        code: "PDF_PREVIEW_FAILED",
        message,
      },
    });
  }
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

  const template = await getTemplateForGeneration(organizationId, templateId, { activeOnly: true });
  if (!template) {
    res.status(404).json({
      error: {
        code: "TEMPLATE_NOT_ACTIVE",
        message: "Template not found or not ACTIVE. Only active templates can be generated.",
      },
    });
    return;
  }

  const constituentId = typeof req.body?.constituentId === "string" ? req.body.constituentId : undefined;
  const donationMode = parseEnum(req.body?.donationMode, LETTER_DONATION_MODES) ?? (req.body?.donationId ? "specific" : "none");
  const donationIds = parseDonationIds(req.body?.donationIds);
  const selectedDonationIdByConstituent = donationMode === "selected"
    ? await buildSelectedDonationIdByConstituent({ organizationId, donationIds })
    : undefined;
  const donationWhere = buildDonationContextFilter(req.body);
  const donationId = await resolveDonationIdForRecipient({
    organizationId,
    constituentId,
    donationMode,
    specificDonationId: typeof req.body?.donationId === "string" ? req.body.donationId : undefined,
    selectedDonationIds: donationIds,
    selectedDonationIdByConstituent,
    donationWhere,
  });
  const campaignId = typeof req.body?.campaignId === "string" ? req.body.campaignId : undefined;
  const eventId = typeof req.body?.eventId === "string" ? req.body.eventId : undefined;
  const year = typeof req.body?.year === "number" ? req.body.year : Number.parseInt(String(req.body?.year ?? ""), 10);
  const deliveryTarget = parseEnum(req.body?.deliveryTarget, LETTER_DELIVERY_TARGETS) ?? "PDF_ONLY";
  const workflowPolicy = await getLettersWorkflowPolicy(organizationId);
  if (deliveryTarget === "MAIL_QUEUE" && !workflowPolicy.allowDirectMailQueue) {
    res.status(409).json({
      error: {
        code: "DIRECT_MAIL_QUEUE_DISABLED",
        message: "Workflow policy disables direct mail queue generation. Generate to PDF or print review first.",
      },
    });
    return;
  }

  const mergedPreview = await resolveLetterMergeContext({
    organizationId,
    template,
    constituentId,
    donationId,
    campaignId,
    eventId,
    year: Number.isFinite(year) ? year : undefined,
    actorUserId: userId,
  });

  const targetConstituent = mergedPreview.resolvedConstituentId
    ? await prisma.constituent.findFirst({
      where: { id: mergedPreview.resolvedConstituentId, organizationId },
      select: {
        doNotMail: true,
        addressLine1: true,
        city: true,
        state: true,
        zip: true,
      },
    })
    : null;

  const validation = validateGenerationPlan({
    constituent: targetConstituent,
    merged: mergedPreview,
    options: {
      requireMailingAddress: deliveryTarget === "MAIL_QUEUE" && workflowPolicy.enableAddressValidationGate
        ? true
        : deliveryTarget === "PDF_ONLY" && templateUsesAddressMergeFields(template),
      requireMergeData: true,
      allowPdfOnlyWithoutAddress: deliveryTarget === "PDF_ONLY" && !templateUsesAddressMergeFields(template),
    },
  });
  if (!validation.valid) {
    res.status(422).json({
      error: {
        code: "GENERATION_VALIDATION_FAILED",
        message: "Generation blocked by validation rules.",
      },
      reasons: validation.reasons,
    });
    return;
  }

  const result = await generateLetterFromTemplate({
    organizationId,
    templateId,
    actorUserId: userId,
    constituentId,
    donationId,
    campaignId,
    eventId,
    year: Number.isFinite(year) ? year : undefined,
    sourceTaskId: typeof req.body?.sourceTaskId === "string" ? req.body.sourceTaskId : undefined,
    stewardPathEnrollmentId: typeof req.body?.stewardPathEnrollmentId === "string" ? req.body.stewardPathEnrollmentId : undefined,
    stewardPathStepRunId: typeof req.body?.stewardPathStepRunId === "string" ? req.body.stewardPathStepRunId : undefined,
    activeOnly: true,
  });
  if (!result) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
  }

  const queueMetadata = buildDeliveryQueueMetadata({
    deliveryTarget,
    workflowPolicy,
    userId,
    constituent: targetConstituent,
  });
  if (queueMetadata) {
    await prisma.generatedLetter.update({
      where: { id: result.generated.id },
      data: {
        metadataJson: buildMetadataWithQueue(result.generated.metadataJson, queueMetadata),
      },
    });
  }

  const generated = await prisma.generatedLetter.findUnique({
    where: { id: result.generated.id },
    include: {
      template: { select: { id: true, name: true, category: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      donation: { select: { id: true, amount: true, date: true } },
      campaign: { select: { id: true, name: true } },
      event: { select: { id: true, name: true } },
    },
  });

  await logAudit({
    action: "LETTER_GENERATED",
    entity: "GeneratedLetter",
    entityId: generated?.id,
    organizationId,
    userId,
    metadata: {
      templateId: result.template.id,
      category: result.template.category,
      hasUnsupportedMergeFields: result.merged.unsupportedFields.length > 0,
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
    where: { id: getRouteId(req), organizationId },
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
        description: `Letter status updated to ${status.toLowerCase().replace(/_/g, " ")}`,
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

/** POST /api/letters/templates/:id/create-email-draft — Creates a Communications draft directly from a letter template. */
router.post("/templates/:id/create-email-draft", requirePermission("letters.create_email_draft"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const template = await prisma.letterTemplate.findFirst({
    where: { id: getRouteId(req), organizationId },
    select: {
      id: true,
      name: true,
      category: true,
      printSubject: true,
      printBody: true,
      emailSubject: true,
      emailBody: true,
    },
  });

  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Letter template not found." } });
    return;
  }

  const settings = await prisma.organizationSettings.findUnique({
    where: { organizationId },
    select: { smtpFromName: true, smtpFromEmail: true },
  });

  const htmlBody = (template.emailBody || template.printBody || "").trim();
  const bodyText = htmlToPlainText(htmlBody || `<p>${template.name}</p>`);
  const audienceFilter = JSON.stringify({
    type: "manual_selection",
    _sharing: {
      ownerId: userId,
      sharedWithOrganization: false,
    },
    _workflow: {
      preparationStatus: "DRAFT",
      source: "letters_template",
      sourceTemplateId: template.id,
    },
  });

  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: `Letter Template Draft: ${template.name}`,
      subject: (template.emailSubject || template.printSubject || template.name).trim(),
      previewText: bodyText.slice(0, 120),
      fromName: settings?.smtpFromName || "OyamaCRM",
      fromEmail: settings?.smtpFromEmail || "noreply@oyamacrm.org",
      bodyText,
      bodyHtml: htmlBody || `<p>${textToHtml(bodyText)}</p>`,
      audienceFilter,
      status: "DRAFT",
    },
  });

  await logAudit({
    action: "LETTER_TEMPLATE_EMAIL_DRAFT_CREATED",
    entity: "LetterTemplate",
    entityId: template.id,
    organizationId,
    userId,
    metadata: {
      emailCampaignId: campaign.id,
      category: template.category,
    },
  });

  res.json({
    emailCampaign: campaign,
    redirectTo: `/oyama-email/campaigns/${campaign.id}`,
  });
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
    where: { id: getRouteId(req), organizationId },
    include: {
      template: { select: { id: true, name: true, category: true } },
      constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
      emailCampaign: { select: { id: true, status: true } },
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

  if (generated.emailCampaign) {
    res.json({
      generatedLetter: generated,
      emailCampaign: generated.emailCampaign,
      redirectTo: `/oyama-email/campaigns/${generated.emailCampaign.id}`,
      reused: true,
    });
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
      source: "letters_generated",
      sourceGeneratedLetterId: generated.id,
      sourceTemplateId: generated.template.id,
      sourceConstituentId: generated.constituent.id,
    },
  });

  const subject = generated.emailSubject || generated.mergedPrintSubject || `${generated.template.name}`;
  const sourceBody = generated.mergedEmailBody || generated.mergedPrintBody;
  const bodyHtml = /<\/?[a-z][\s\S]*>/i.test(sourceBody)
    ? sourceBody
    : `<p>${textToHtml(sourceBody)}</p>`;
  const bodyText = htmlToPlainText(sourceBody);
  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: `Letter Draft: ${generated.template.name} (${generated.constituent.firstName} ${generated.constituent.lastName})`,
      subject,
      previewText: bodyText.slice(0, 120),
      fromName: settings?.smtpFromName || "OyamaCRM",
      fromEmail: settings?.smtpFromEmail || "noreply@oyamacrm.org",
      bodyText,
      bodyHtml,
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
    redirectTo: `/oyama-email/campaigns/${campaign.id}`,
    reused: false,
  });
});

/** GET /api/letters/generated/queue/print — Lists print queue records with derived queue metadata. */
router.get("/generated/queue/print", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const filterStatus = parseEnum(req.query.queueStatus, PRINT_QUEUE_STATUSES);
  const limit = parsePositiveInt(req.query.limit, 300, 1, 1000);

  const rows = await prisma.generatedLetter.findMany({
    where: {
      organizationId,
      status: { in: ["GENERATED", "PRINTED", "MAILED", "EMAIL_DRAFT_CREATED", "ARCHIVED"] },
    },
    include: {
      template: { select: { id: true, name: true, category: true } },
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
          doNotMail: true,
        },
      },
      donation: { select: { id: true, amount: true, date: true } },
      generatedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { generatedAt: "desc" },
    take: limit,
  });

  const mapped = rows.map((row) => {
    const queue = readQueueMetadata(row.metadataJson);
    const queueStatus = derivePrintQueueStatus(row.status, queue);
    const addressComplete = hasCompleteMailAddress(row.constituent);

    return {
      ...row,
      queueStatus,
      reviewStatus: queue.reviewStatus ?? (row.status === "GENERATED" ? "NEEDS_REVIEW" : "APPROVED"),
      priority: queue.priority ?? "NORMAL",
      batchId: queue.batchId ?? null,
      statusNote: queue.statusNote ?? null,
      addressComplete,
    };
  }).filter((row) => (filterStatus ? row.queueStatus === filterStatus : true));

  res.json(mapped);
});

/** GET /api/letters/generated/queue/mail — Lists mail queue records with address readiness checks. */
router.get("/generated/queue/mail", requirePermission("letters.view"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const filterStatus = parseEnum(req.query.queueStatus, MAIL_QUEUE_STATUSES);
  const limit = parsePositiveInt(req.query.limit, 300, 1, 1000);

  const rows = await prisma.generatedLetter.findMany({
    where: {
      organizationId,
      status: { in: ["PRINTED", "MAILED", "EMAIL_DRAFT_CREATED", "ARCHIVED", "GENERATED"] },
    },
    include: {
      template: { select: { id: true, name: true, category: true } },
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          zip: true,
          doNotMail: true,
        },
      },
      donation: { select: { id: true, amount: true, date: true } },
      generatedBy: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { generatedAt: "desc" },
    take: limit,
  });

  const mapped = rows.map((row) => {
    const queue = readQueueMetadata(row.metadataJson);
    const queueStatus = deriveMailQueueStatus(row.status, queue);
    const addressComplete = hasCompleteMailAddress(row.constituent);

    return {
      ...row,
      queueStatus,
      priority: queue.priority ?? "NORMAL",
      batchId: queue.batchId ?? null,
      statusNote: queue.statusNote ?? null,
      returnReason: queue.returnReason ?? null,
      returnedAt: queue.returnedAt ?? null,
      addressComplete,
      addressWarning: addressComplete ? null : "Address incomplete - cannot mark ready to mail",
    };
  }).filter((row) => (filterStatus ? row.queueStatus === filterStatus : true));

  res.json(mapped);
});

/** POST /api/letters/generated/queue/print/actions — Applies one bulk print-queue action to selected letters. */
router.post("/generated/queue/print/actions", requirePermission("letters.manage_print_queue"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const action = parseEnum(req.body?.action, ["APPROVE", "QUEUE_FOR_PRINT", "MARK_PRINTED", "MOVE_TO_MAIL_QUEUE", "CANCEL", "ARCHIVE"] as const);
  if (!action) {
    res.status(400).json({ error: { code: "INVALID_ACTION", message: "Invalid print queue action." } });
    return;
  }

  const ids = Array.isArray(req.body?.letterIds)
    ? req.body.letterIds.map((value: unknown) => String(value)).filter(Boolean)
    : [];
  if (ids.length === 0) {
    res.status(400).json({ error: { code: "LETTER_IDS_REQUIRED", message: "letterIds is required." } });
    return;
  }

  const note = typeof req.body?.note === "string" ? req.body.note.trim() : undefined;
  const priority = parseEnum(req.body?.priority, LETTER_PRIORITY) ?? undefined;
  const batchId = typeof req.body?.batchId === "string" ? req.body.batchId.trim() : undefined;
  const workflowPolicy = await getLettersWorkflowPolicy(organizationId);

  if (action === "MOVE_TO_MAIL_QUEUE" && !workflowPolicy.allowDirectMailQueue) {
    res.status(409).json({
      error: {
        code: "DIRECT_MAIL_QUEUE_DISABLED",
        message: "Workflow policy requires mail queue transitions from the mail queue lane instead of direct print-queue handoff.",
      },
    });
    return;
  }

  const rows = await prisma.generatedLetter.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true, status: true, metadataJson: true, constituentId: true },
  });

  if (workflowPolicy.requirePrintApproval && ["QUEUE_FOR_PRINT", "MARK_PRINTED", "MOVE_TO_MAIL_QUEUE"].includes(action)) {
    const blockedLetterIds = rows
      .filter((row) => readQueueMetadata(row.metadataJson).reviewStatus !== "APPROVED")
      .map((row) => row.id);

    if (blockedLetterIds.length > 0) {
      res.status(409).json({
        error: {
          code: "PRINT_APPROVAL_REQUIRED",
          message: "All selected letters must be approved before print execution actions.",
        },
        blockedLetterIds,
      });
      return;
    }
  }

  const now = new Date();
  for (const row of rows) {
    const currentQueue = readQueueMetadata(row.metadataJson);
    const nextQueue: GeneratedLetterQueueMetadata = {
      ...currentQueue,
      updatedByUserId: userId,
      statusNote: note ?? currentQueue.statusNote,
      priority: priority ?? currentQueue.priority ?? workflowPolicy.defaultPriority,
      batchId: batchId || currentQueue.batchId,
    };

    let nextStatus = row.status;
    if (action === "APPROVE") {
      nextQueue.reviewStatus = "APPROVED";
      nextQueue.printStatus = "APPROVED";
    }
    if (action === "QUEUE_FOR_PRINT") {
      nextQueue.reviewStatus = "APPROVED";
      nextQueue.printStatus = "QUEUED_FOR_PRINT";
      nextQueue.queuedForPrintAt = now.toISOString();
    }
    if (action === "MARK_PRINTED") {
      nextQueue.reviewStatus = "APPROVED";
      nextQueue.printStatus = "PRINTED";
      nextStatus = "PRINTED";
    }
    if (action === "MOVE_TO_MAIL_QUEUE") {
      nextQueue.reviewStatus = "APPROVED";
      nextQueue.printStatus = "PRINTED";
      nextQueue.mailStatus = "QUEUED_FOR_MAIL";
      nextQueue.queuedForMailAt = now.toISOString();
    }
    if (action === "CANCEL") {
      nextQueue.printStatus = "CANCELED";
      nextQueue.mailStatus = "CANCELED";
    }
    if (action === "ARCHIVE") {
      nextQueue.printStatus = "ARCHIVED";
      nextQueue.mailStatus = "ARCHIVED";
      nextStatus = "ARCHIVED";
    }

    await prisma.generatedLetter.update({
      where: { id: row.id },
      data: {
        status: nextStatus as never,
        printedAt: action === "MARK_PRINTED" ? now : undefined,
        metadataJson: buildMetadataWithQueue(row.metadataJson, nextQueue),
      },
    });

    if (row.constituentId) {
      await prisma.activity.create({
        data: {
          constituentId: row.constituentId,
          type: "NOTE",
          description: `Letter print-queue action: ${action.toLowerCase().replace(/_/g, " ")}`,
          metadata: {
            source: "letters-printables",
            communicationType: "printed_letter",
            letterId: row.id,
            action,
            note,
          },
          userId,
        },
      });
    }
  }

  await logAudit({
    action: "LETTER_PRINT_QUEUE_BULK_ACTION",
    entity: "GeneratedLetter",
    organizationId,
    userId,
    metadata: {
      action,
      count: rows.length,
      note,
      batchId,
      priority,
    },
  });

  res.json({ success: true, updatedCount: rows.length, action });
});

/** POST /api/letters/generated/queue/mail/actions — Applies one bulk mail-queue action to selected letters. */
router.post("/generated/queue/mail/actions", requirePermission("letters.manage_mail_queue"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const action = parseEnum(req.body?.action, ["QUEUE_FOR_MAIL", "MARK_MAILED", "MARK_RETURNED", "ADDRESS_ISSUE", "REPRINT", "DELETE_PRINTS", "ARCHIVE"] as const);
  if (!action) {
    res.status(400).json({ error: { code: "INVALID_ACTION", message: "Invalid mail queue action." } });
    return;
  }

  const ids = Array.isArray(req.body?.letterIds)
    ? req.body.letterIds.map((value: unknown) => String(value)).filter(Boolean)
    : [];
  if (ids.length === 0) {
    res.status(400).json({ error: { code: "LETTER_IDS_REQUIRED", message: "letterIds is required." } });
    return;
  }

  const note = typeof req.body?.note === "string" ? req.body.note.trim() : undefined;
  const returnReason = typeof req.body?.returnReason === "string" ? req.body.returnReason.trim() : undefined;
  const workflowPolicy = await getLettersWorkflowPolicy(organizationId);

  if (action === "QUEUE_FOR_MAIL" && !workflowPolicy.allowDirectMailQueue) {
    res.status(409).json({
      error: {
        code: "DIRECT_MAIL_QUEUE_DISABLED",
        message: "Workflow policy disables direct queueing from the mail lane. Route through approved print transitions first.",
      },
    });
    return;
  }

  const rows = await prisma.generatedLetter.findMany({
    where: { organizationId, id: { in: ids } },
    select: {
      id: true,
      status: true,
      metadataJson: true,
      constituentId: true,
      constituent: {
        select: {
          addressLine1: true,
          city: true,
          state: true,
          zip: true,
        },
      },
    },
  });

  const now = new Date();
  for (const row of rows) {
    const currentQueue = readQueueMetadata(row.metadataJson);
    const nextQueue: GeneratedLetterQueueMetadata = {
      ...currentQueue,
      updatedByUserId: userId,
      statusNote: note ?? currentQueue.statusNote,
    };

    let nextStatus = row.status;
    if (action === "QUEUE_FOR_MAIL") {
      const addressComplete = hasCompleteMailAddress(row.constituent);
      if (workflowPolicy.enableAddressValidationGate && !addressComplete) {
        nextQueue.mailStatus = "ADDRESS_ISSUE";
      } else {
        nextQueue.mailStatus = "QUEUED_FOR_MAIL";
        nextQueue.queuedForMailAt = now.toISOString();
      }
    }
    if (action === "MARK_MAILED") {
      nextQueue.mailStatus = "MAILED";
      nextStatus = "MAILED";
    }
    if (action === "MARK_RETURNED") {
      nextQueue.mailStatus = "RETURNED";
      nextQueue.returnReason = returnReason || "Returned mail";
      nextQueue.returnedAt = now.toISOString();
    }
    if (action === "ADDRESS_ISSUE") {
      nextQueue.mailStatus = "ADDRESS_ISSUE";
    }
    if (action === "REPRINT") {
      if (workflowPolicy.requirePrintApproval) {
        nextQueue.reviewStatus = "NEEDS_REVIEW";
        nextQueue.printStatus = "NEEDS_REVIEW";
      } else {
        nextQueue.reviewStatus = "APPROVED";
        nextQueue.printStatus = "QUEUED_FOR_PRINT";
        nextQueue.queuedForPrintAt = now.toISOString();
      }

      if (workflowPolicy.allowDirectMailQueue) {
        nextQueue.mailStatus = "QUEUED_FOR_MAIL";
        nextQueue.queuedForMailAt = now.toISOString();
      } else {
        nextQueue.mailStatus = undefined;
      }

      nextStatus = "GENERATED";
    }
    if (action === "DELETE_PRINTS") {
      nextQueue.mailStatus = "CANCELED";
      nextQueue.printStatus = "CANCELED";
      nextQueue.statusNote = note || "Print files deleted from mail queue.";
      nextStatus = "ARCHIVED";
    }
    if (action === "ARCHIVE") {
      nextQueue.mailStatus = "ARCHIVED";
      nextQueue.printStatus = "ARCHIVED";
      nextStatus = "ARCHIVED";
    }

    await prisma.generatedLetter.update({
      where: { id: row.id },
      data: {
        status: nextStatus as never,
        mailedAt: action === "MARK_MAILED" ? now : undefined,
        metadataJson: buildMetadataWithQueue(row.metadataJson, nextQueue),
      },
    });

    if (row.constituentId) {
      await prisma.activity.create({
        data: {
          constituentId: row.constituentId,
          type: "NOTE",
          description: `Letter mail-queue action: ${action.toLowerCase().replace(/_/g, " ")}`,
          metadata: {
            source: "letters-printables",
            communicationType: "printed_letter",
            letterId: row.id,
            action,
            note,
            returnReason,
          },
          userId,
        },
      });
    }
  }

  await logAudit({
    action: "LETTER_MAIL_QUEUE_BULK_ACTION",
    entity: "GeneratedLetter",
    organizationId,
    userId,
    metadata: {
      action,
      count: rows.length,
      note,
      returnReason,
    },
  });

  res.json({ success: true, updatedCount: rows.length, action });
});

/** POST /api/letters/generated/:id/export-pdf — Generates and streams one letter PDF. */
router.post("/generated/:id/export-pdf", requirePermission("letters.export_pdf"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const generatedLetter = await prisma.generatedLetter.findFirst({
    where: { id: getRouteId(req), organizationId },
    select: {
      id: true,
      mergedPrintSubject: true,
      mergedPrintBody: true,
      generatedAt: true,
      metadataJson: true,
      template: {
        select: {
          name: true,
          headerPreset: true,
          footerPreset: true,
          signatureBlock: true,
        },
      },
      constituent: {
        select: {
          firstName: true,
          lastName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          zip: true,
        },
      },
      donation: { select: { date: true } },
    },
  });

  if (!generatedLetter) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Generated letter not found." } });
    return;
  }

  const constituentName = [generatedLetter.constituent?.firstName, generatedLetter.constituent?.lastName]
    .filter((value): value is string => Boolean(value && value.trim()))
    .join(" ")
    .trim();
  const templateName = generatedLetter.template?.name?.trim() || "Generated Letter";
  const subject = recipientFacingLetterSubject(generatedLetter.mergedPrintSubject);

  try {
    const [branding, defaultPresets] = await Promise.all([
      getLetterPdfBrandingContext(organizationId),
      getDefaultLetterPdfPresets(organizationId),
    ]);
    const pdfBuffer = await renderGeneratedLetterPdf({
      templateName,
      subject,
      constituentName,
      recipient: {
        fullName: constituentName,
        addressLine1: generatedLetter.constituent?.addressLine1 ?? "",
        addressLine2: generatedLetter.constituent?.addressLine2 ?? "",
        city: generatedLetter.constituent?.city ?? "",
        state: generatedLetter.constituent?.state ?? "",
        zip: generatedLetter.constituent?.zip ?? "",
      },
      generatedAt: generatedLetter.generatedAt,
      mergedPrintBody: normalizeMergedDonationDateTextForPdfExport(generatedLetter.mergedPrintBody, generatedLetter.donation?.date),
      branding,
      presets: {
        headerPreset: generatedLetter.template?.headerPreset ?? defaultPresets.headerPreset,
        footerPreset: generatedLetter.template?.footerPreset ?? defaultPresets.footerPreset,
        signatureBlock: generatedLetter.template?.signatureBlock ?? defaultPresets.signatureBlock,
      },
    });

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `${sanitizePdfFilename(templateName)}_${sanitizePdfFilename(constituentName || generatedLetter.id)}_${timestamp}.pdf`;

    await prisma.generatedLetter.update({
      where: { id: generatedLetter.id },
      data: {
        metadataJson: buildMetadataWithPdfExport(generatedLetter.metadataJson, {
          lastStatus: "SUCCESS",
          lastError: null,
          lastExportedAt: new Date().toISOString(),
          updatedByUserId: userId,
        }),
      },
    });

    await logAudit({
      action: "LETTER_PDF_EXPORTED",
      entity: "GeneratedLetter",
      entityId: generatedLetter.id,
      organizationId,
      userId,
      metadata: {
        mode: "SERVER_RENDER",
        status: "SUCCESS",
        fileName,
        byteLength: pdfBuffer.byteLength,
      },
    });

    const dispositionType = req.query.preview === "1" || req.query.inline === "1" ? "inline" : "attachment";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${dispositionType}; filename=\"${fileName}\"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF export failure";
    console.error("[letters] Generated letter PDF export failed", {
      generatedLetterId: generatedLetter.id,
      templateName,
      constituentName,
      organizationId,
      userId,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      renderer: "SERVER_RENDER",
      parser: "htmlToPdfBlocks",
    });

    await prisma.generatedLetter.update({
      where: { id: generatedLetter.id },
      data: {
        metadataJson: buildMetadataWithPdfExport(generatedLetter.metadataJson, {
          lastStatus: "FAILED",
          lastError: message.slice(0, 400),
          lastExportedAt: new Date().toISOString(),
          updatedByUserId: userId,
        }),
      },
    });

    await logAudit({
      action: "LETTER_PDF_EXPORT_FAILED",
      entity: "GeneratedLetter",
      entityId: generatedLetter.id,
      organizationId,
      userId,
      metadata: {
        mode: "SERVER_RENDER",
        status: "FAILED",
        error: message,
      },
    });

    if (error instanceof LetterPdfLayoutError) {
      res.status(422).json({ error: { code: error.code, message } });
      return;
    }

    res.status(500).json({
      error: {
        code: "PDF_EXPORT_FAILED",
        message: "Failed to export this generated letter as PDF.",
        details: process.env.NODE_ENV === "production" ? undefined : message,
      },
    });
  }
});

/** POST /api/letters/generated/export-pdf-batch — Generates one combined PDF for multiple generated letters. */
router.post("/generated/export-pdf-batch", requirePermission("letters.export_pdf"), async (req, res) => {
  const organizationId = await requireOrganizationId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(400).json({ error: { code: "ORG_OR_USER_REQUIRED", message: "Organization and user are required." } });
    return;
  }

  const requestedIds: string[] = Array.isArray(req.body?.letterIds)
    ? (req.body.letterIds as unknown[])
      .map((value) => String(value).trim())
      .filter((value): value is string => value.length > 0)
    : [];
  const letterIds: string[] = [...new Set(requestedIds)];

  if (letterIds.length === 0) {
    res.status(400).json({ error: { code: "LETTER_IDS_REQUIRED", message: "letterIds is required." } });
    return;
  }

  if (letterIds.length > 500) {
    res.status(400).json({ error: { code: "TOO_MANY_LETTERS", message: "Batch PDF export supports up to 500 letters per request." } });
    return;
  }

  const rows = await prisma.generatedLetter.findMany({
    where: {
      organizationId,
      id: { in: letterIds },
    },
    select: {
      id: true,
      mergedPrintSubject: true,
      mergedPrintBody: true,
      generatedAt: true,
      metadataJson: true,
      template: {
        select: {
          name: true,
          headerPreset: true,
          footerPreset: true,
          signatureBlock: true,
        },
      },
      constituent: {
        select: {
          firstName: true,
          lastName: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          zip: true,
        },
      },
      donation: { select: { date: true } },
    },
  });

  if (rows.length === 0) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No generated letters found for the requested IDs." } });
    return;
  }

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const orderedRows: typeof rows = [];
  for (const id of letterIds) {
    const row = rowById.get(id);
    if (row) orderedRows.push(row);
  }

  if (orderedRows.length === 0) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No generated letters found for the requested IDs." } });
    return;
  }

  const exportedAtIso = new Date().toISOString();

  try {
    const [branding, defaultPresets] = await Promise.all([
      getLetterPdfBrandingContext(organizationId),
      getDefaultLetterPdfPresets(organizationId),
    ]);
    const pdfBuffer = await renderGeneratedLettersBatchPdf(
      orderedRows.map((row) => {
        const constituentName = [row.constituent?.firstName, row.constituent?.lastName]
          .filter((value): value is string => Boolean(value && value.trim()))
          .join(" ")
          .trim();
        const templateName = row.template?.name?.trim() || "Generated Letter";
        const subject = recipientFacingLetterSubject(row.mergedPrintSubject);

        return {
          templateName,
          subject,
          constituentName,
          recipient: {
            fullName: constituentName,
            addressLine1: row.constituent?.addressLine1 ?? "",
            addressLine2: row.constituent?.addressLine2 ?? "",
            city: row.constituent?.city ?? "",
            state: row.constituent?.state ?? "",
            zip: row.constituent?.zip ?? "",
          },
          generatedAt: row.generatedAt,
          mergedPrintBody: normalizeMergedDonationDateTextForPdfExport(row.mergedPrintBody, row.donation?.date),
          branding,
          presets: {
            headerPreset: row.template?.headerPreset ?? defaultPresets.headerPreset,
            footerPreset: row.template?.footerPreset ?? defaultPresets.footerPreset,
            signatureBlock: row.template?.signatureBlock ?? defaultPresets.signatureBlock,
          },
        };
      }),
    );

    await Promise.all(orderedRows.map((row) => prisma.generatedLetter.update({
      where: { id: row.id },
      data: {
        metadataJson: buildMetadataWithPdfExport(row.metadataJson, {
          lastStatus: "SUCCESS",
          lastError: null,
          lastExportedAt: exportedAtIso,
          updatedByUserId: userId,
        }),
      },
    })));

    const timestamp = new Date().toISOString().slice(0, 10);
    const fileName = `letters_batch_${timestamp}.pdf`;

    await logAudit({
      action: "LETTER_BATCH_PDF_EXPORTED",
      entity: "GeneratedLetter",
      organizationId,
      userId,
      metadata: {
        mode: "SERVER_RENDER",
        status: "SUCCESS",
        fileName,
        count: orderedRows.length,
        byteLength: pdfBuffer.byteLength,
      },
    });

    const dispositionType = req.query.preview === "1" || req.query.inline === "1" ? "inline" : "attachment";
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `${dispositionType}; filename=\"${fileName}\"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown batch PDF export failure";
    console.error("[letters] Batch PDF export failed", {
      generatedLetterIds: orderedRows.map((row) => row.id),
      count: orderedRows.length,
      organizationId,
      userId,
      error: message,
      stack: error instanceof Error ? error.stack : undefined,
      renderer: "SERVER_RENDER",
      parser: "htmlToPdfBlocks",
    });

    await Promise.all(orderedRows.map((row) => prisma.generatedLetter.update({
      where: { id: row.id },
      data: {
        metadataJson: buildMetadataWithPdfExport(row.metadataJson, {
          lastStatus: "FAILED",
          lastError: message.slice(0, 400),
          lastExportedAt: exportedAtIso,
          updatedByUserId: userId,
        }),
      },
    })));

    await logAudit({
      action: "LETTER_BATCH_PDF_EXPORT_FAILED",
      entity: "GeneratedLetter",
      organizationId,
      userId,
      metadata: {
        mode: "SERVER_RENDER",
        status: "FAILED",
        count: orderedRows.length,
        error: message,
      },
    });

    if (error instanceof LetterPdfLayoutError) {
      res.status(422).json({ error: { code: error.code, message } });
      return;
    }

    res.status(500).json({
      error: {
        code: "PDF_EXPORT_FAILED",
        message: "Failed to export generated letters as batch PDF.",
        details: process.env.NODE_ENV === "production" ? undefined : message,
      },
    });
  }
});

/** POST /api/letters/generated/batch — Generates letters in bulk with eligibility checks and skip reasons. */
router.post("/generated/batch", requirePermission("letters.generate_batch"), async (req, res) => {
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

  const template = await getTemplateForGeneration(organizationId, templateId);
  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
  }

  const workflowPolicy = await getLettersWorkflowPolicy(organizationId);

  const dryRun = req.body?.dryRun === true;
  const deliveryTarget = parseEnum(req.body?.deliveryTarget, LETTER_DELIVERY_TARGETS)
    ?? (req.body?.addToPrintQueue === true ? "PRINT_QUEUE" : "PDF_ONLY");
  if (deliveryTarget === "MAIL_QUEUE" && !workflowPolicy.allowDirectMailQueue) {
    res.status(409).json({
      error: {
        code: "DIRECT_MAIL_QUEUE_DISABLED",
        message: "Workflow policy disables direct mail queue generation. Generate to PDF or print review first.",
      },
    });
    return;
  }
  const addToPrintQueue = deliveryTarget === "PRINT_QUEUE";
  const donationMode = parseEnum(req.body?.donationMode, LETTER_DONATION_MODES) ?? (req.body?.donationId ? "specific" : "none");
  const specificDonationId = typeof req.body?.donationId === "string" && req.body.donationId.trim() ? req.body.donationId.trim() : undefined;
  const selectedDonationIds = parseDonationIds(req.body?.donationIds);
  const selectedDonationIdByConstituent = donationMode === "selected"
    ? await buildSelectedDonationIdByConstituent({ organizationId, donationIds: selectedDonationIds })
    : undefined;
  const donationContextFilter = buildDonationContextFilter(req.body);
  const templateNeedsAddress = templateUsesAddressMergeFields(template);
  const dedupeHousehold = req.body?.dedupeHousehold === true;
  const year = typeof req.body?.year === "number"
    ? req.body.year
    : Number.parseInt(String(req.body?.year ?? ""), 10);

  const requestedIds = Array.isArray(req.body?.constituentIds)
    ? req.body.constituentIds.map((value: unknown) => String(value)).filter(Boolean)
    : [];

  const filterType = parseEnum(req.body?.filterType, ["ALL", "ACTIVE", "LAPSED", "NEW", "MAJOR_DONOR", "MONTHLY_DONOR"] as const) ?? "ALL";
  const donorStatusFilter = filterType === "ALL" || filterType === "MONTHLY_DONOR" ? undefined : filterType;
  const campaignId = typeof req.body?.campaignId === "string" && req.body.campaignId.trim() ? req.body.campaignId.trim() : undefined;
  const eventId = typeof req.body?.eventId === "string" && req.body.eventId.trim() ? req.body.eventId.trim() : undefined;
  const dateFrom = typeof req.body?.dateFrom === "string" && req.body.dateFrom.trim() ? new Date(`${req.body.dateFrom.trim()}T00:00:00.000Z`) : null;
  const dateTo = typeof req.body?.dateTo === "string" && req.body.dateTo.trim() ? new Date(`${req.body.dateTo.trim()}T23:59:59.999Z`) : null;
  const donationAudienceFilter: Prisma.DonationWhereInput = {
    status: "COMPLETED",
    ...(filterType === "MONTHLY_DONOR" ? { isRecurring: true } : {}),
    ...(campaignId ? { campaignId } : {}),
    ...((dateFrom && !Number.isNaN(dateFrom.getTime())) || (dateTo && !Number.isNaN(dateTo.getTime()))
      ? {
          date: {
            ...(dateFrom && !Number.isNaN(dateFrom.getTime()) ? { gte: dateFrom } : {}),
            ...(dateTo && !Number.isNaN(dateTo.getTime()) ? { lte: dateTo } : {}),
          },
        }
      : {}),
  };
  const hasDonationAudienceFilter = Object.keys(donationAudienceFilter).length > 0;

  const candidates = requestedIds.length > 0
    ? await prisma.constituent.findMany({
      where: {
        organizationId,
        id: { in: requestedIds },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        donorStatus: true,
        householdId: true,
        doNotMail: true,
        addressLine1: true,
        city: true,
        state: true,
        zip: true,
      },
      take: 4000,
    })
    : await prisma.constituent.findMany({
      where: {
        organizationId,
        ...(donorStatusFilter ? { donorStatus: donorStatusFilter } : {}),
        ...(hasDonationAudienceFilter ? { donations: { some: donationAudienceFilter } } : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        donorStatus: true,
        householdId: true,
        doNotMail: true,
        addressLine1: true,
        city: true,
        state: true,
        zip: true,
      },
      take: 4000,
    });

  const seenHouseholds = new Set<string>();
  const skipped: Array<{ constituentId: string; reason: string }> = [];
  const generatedIds: string[] = [];
  const generatedSample: Array<{ id: string; constituentId: string; constituentName: string }> = [];
  let queuedForPrintCount = 0;
  let queuedForMailCount = 0;

  for (const candidate of candidates) {
    if (dedupeHousehold && candidate.householdId) {
      if (seenHouseholds.has(candidate.householdId)) {
        skipped.push({ constituentId: candidate.id, reason: "DUPLICATE_HOUSEHOLD" });
        continue;
      }
      seenHouseholds.add(candidate.householdId);
    }

    const recipientDonationId = await resolveDonationIdForRecipient({
      organizationId,
      constituentId: candidate.id,
      donationMode,
      specificDonationId,
      selectedDonationIds,
      selectedDonationIdByConstituent,
      donationWhere: donationContextFilter,
    });

    const preview = await resolveLetterMergeContext({
      organizationId,
      template,
      constituentId: candidate.id,
      donationId: recipientDonationId,
      campaignId,
      eventId,
      year: Number.isFinite(year) ? year : undefined,
      actorUserId: userId,
    });

    const validation = validateGenerationPlan({
      constituent: candidate,
      merged: preview,
      options: {
        requireMailingAddress: deliveryTarget === "MAIL_QUEUE" && workflowPolicy.enableAddressValidationGate
          ? true
          : deliveryTarget === "PDF_ONLY" && templateNeedsAddress,
        requireMergeData: true,
        allowPdfOnlyWithoutAddress: deliveryTarget === "PDF_ONLY" && !templateNeedsAddress,
      },
    });
    if (!validation.valid) {
      const firstReason = validation.reasons.find((reason) => reason !== "VALID") ?? "MISSING_REQUIRED_MERGE_DATA";
      skipped.push({ constituentId: candidate.id, reason: toBatchSkipReason(firstReason) });
      continue;
    }

    if (dryRun) {
      generatedSample.push({
        id: "dry-run",
        constituentId: candidate.id,
        constituentName: `${candidate.firstName} ${candidate.lastName}`.trim(),
      });
      continue;
    }

    const generated = await generateLetterFromTemplate({
      organizationId,
      templateId,
      actorUserId: userId,
      constituentId: candidate.id,
      donationId: recipientDonationId,
      campaignId,
      eventId,
      year: Number.isFinite(year) ? year : undefined,
      activeOnly: true,
    });

    if (!generated) {
      skipped.push({ constituentId: candidate.id, reason: "GENERATION_FAILED" });
      continue;
    }

    generatedIds.push(generated.generated.id);
    generatedSample.push({
      id: generated.generated.id,
      constituentId: candidate.id,
      constituentName: `${candidate.firstName} ${candidate.lastName}`.trim(),
    });

    if ((deliveryTarget === "PRINT_QUEUE" && workflowPolicy.autoQueueBatchToPrint) || deliveryTarget === "MAIL_QUEUE") {
      const queue = buildDeliveryQueueMetadata({
        deliveryTarget,
        workflowPolicy,
        userId,
        constituent: candidate,
      });

      if (queue) {
        await prisma.generatedLetter.update({
          where: { id: generated.generated.id },
          data: {
            metadataJson: buildMetadataWithQueue(generated.generated.metadataJson, queue),
          },
        });

        if (deliveryTarget === "PRINT_QUEUE") queuedForPrintCount += 1;
        if (deliveryTarget === "MAIL_QUEUE") queuedForMailCount += 1;
      }
    }
  }

  const skippedByReason = skipped.reduce<Record<string, number>>((acc, item) => {
    acc[item.reason] = (acc[item.reason] ?? 0) + 1;
    return acc;
  }, {});

  await logAudit({
    action: "LETTER_BATCH_GENERATION_RUN",
    entity: "LetterTemplate",
    entityId: templateId,
    organizationId,
    userId,
    metadata: {
      dryRun,
      filterType,
      deliveryTarget,
      donationMode,
      campaignId,
      eventId,
      dateFrom: dateFrom && !Number.isNaN(dateFrom.getTime()) ? dateFrom.toISOString() : null,
      dateTo: dateTo && !Number.isNaN(dateTo.getTime()) ? dateTo.toISOString() : null,
      selectedCount: candidates.length,
      generatedCount: generatedIds.length,
      skippedCount: skipped.length,
      skippedByReason,
    },
  });

  res.json({
    dryRun,
    templateId,
    totalSelected: candidates.length,
    eligible: candidates.length - skipped.length,
    generatedCount: generatedIds.length,
    generatedIds,
    skippedCount: skipped.length,
    skippedByReason,
    skipped,
    generated: generatedSample.slice(0, 200),
    addToPrintQueue,
    deliveryTarget,
    donationMode,
    queuedForPrintCount,
    queuedForMailCount,
    queuePolicyApplied: {
      autoQueueBatchToPrint: workflowPolicy.autoQueueBatchToPrint,
      requirePrintApproval: workflowPolicy.requirePrintApproval,
      allowDirectMailQueue: workflowPolicy.allowDirectMailQueue,
      enableAddressValidationGate: workflowPolicy.enableAddressValidationGate,
      defaultPriority: workflowPolicy.defaultPriority,
    },
  });
});

export default router;
