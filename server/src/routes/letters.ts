/**
 * Donor CRM Letters & Printables API routes.
 * Provides template management, merge preview, generated letters, and email-draft integration.
 */
import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { Router, type Request } from "express";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { hasDefaultPermission } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { isSchemaDriftError, migrationRequiredMessage } from "../lib/prisma-runtime-errors.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { generateLetterFromTemplate, getTemplateForGeneration, resolveLetterMergeContext } from "../services/letters-execution.js";
import { collectMergeFieldKeys, SUPPORTED_LETTER_MERGE_FIELDS } from "../services/letters-merge.js";

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
const LETTER_WORKFLOW_POLICY_PLUGIN_KEY = "letters-workflow-settings";
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
  return allowed.includes(normalized as T) ? (normalized as T) : null;
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

/** Converts line-break text into simple HTML paragraphs for email draft creation. */
function textToHtml(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped.replace(/\n\n+/g, "</p><p>").replace(/\n/g, "<br />");
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
function htmlToPlainText(value: string): string {
  const withoutTags = value
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
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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

/** Renders one generated letter into PDF bytes using jsPDF server-side. */
async function renderGeneratedLetterPdf(params: {
  templateName: string;
  subject: string;
  constituentName: string;
  generatedAt: Date;
  mergedPrintBody: string;
}): Promise<Buffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", compress: true });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 54;
  const marginTop = 56;
  const marginBottom = 56;
  const maxTextWidth = pageWidth - marginX * 2;
  let cursorY = marginTop;

  const ensurePageSpace = (requiredHeight: number) => {
    if (cursorY + requiredHeight <= pageHeight - marginBottom) return;
    doc.addPage();
    cursorY = marginTop;
  };

  const writeParagraph = (
    text: string,
    fontSize: number,
    fontStyle: "normal" | "bold" = "normal",
    marginAfter = 8,
  ) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    doc.setFont("helvetica", fontStyle);
    doc.setFontSize(fontSize);

    const lines = doc.splitTextToSize(trimmed, maxTextWidth) as string[];
    const lineHeight = Math.max(14, Math.round(fontSize * 1.45));

    for (const line of lines) {
      ensurePageSpace(lineHeight);
      doc.text(line, marginX, cursorY);
      cursorY += lineHeight;
    }

    cursorY += marginAfter;
  };

  writeParagraph(params.templateName || "Generated Letter", 16, "bold", 4);
  writeParagraph(`Subject: ${params.subject || "Letter"}`, 11, "bold", 4);
  if (params.constituentName) {
    writeParagraph(`Constituent: ${params.constituentName}`, 10, "normal", 2);
  }
  writeParagraph(`Generated: ${params.generatedAt.toLocaleString()}`, 10, "normal", 10);

  const plainTextBody = htmlToPlainText(params.mergedPrintBody || "");
  const paragraphs = plainTextBody.length > 0 ? plainTextBody.split(/\n{2,}/g) : ["(No letter content)"];

  for (const paragraph of paragraphs) {
    writeParagraph(paragraph, 11, "normal", 8);
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

    res.json(templates);
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
      printLayoutJson: asJsonObject(req.body?.printLayoutJson),
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
  const sourceTaskId = typeof req.query.sourceTaskId === "string" ? req.query.sourceTaskId : undefined;
  const stewardPathEnrollmentId = typeof req.query.stewardPathEnrollmentId === "string" ? req.query.stewardPathEnrollmentId : undefined;
  const stewardPathStepRunId = typeof req.query.stewardPathStepRunId === "string" ? req.query.stewardPathStepRunId : undefined;
  const limit = parsePositiveInt(req.query.limit, 100, 1, 400);

  const rows = await prisma.generatedLetter.findMany({
    where: {
      organizationId,
      ...(status ? { status } : {}),
      ...(category ? { category } : {}),
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

  const template = await getTemplateForGeneration(organizationId, templateId);
  if (!template) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
  }

  const year = typeof req.body?.year === "number" ? req.body.year : Number.parseInt(String(req.body?.year ?? ""), 10);
  const merged = await resolveLetterMergeContext({
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

  const year = typeof req.body?.year === "number" ? req.body.year : Number.parseInt(String(req.body?.year ?? ""), 10);
  const result = await generateLetterFromTemplate({
    organizationId,
    templateId,
    actorUserId: userId,
    constituentId: typeof req.body?.constituentId === "string" ? req.body.constituentId : undefined,
    donationId: typeof req.body?.donationId === "string" ? req.body.donationId : undefined,
    campaignId: typeof req.body?.campaignId === "string" ? req.body.campaignId : undefined,
    eventId: typeof req.body?.eventId === "string" ? req.body.eventId : undefined,
    year: Number.isFinite(year) ? year : undefined,
    sourceTaskId: typeof req.body?.sourceTaskId === "string" ? req.body.sourceTaskId : undefined,
    stewardPathEnrollmentId: typeof req.body?.stewardPathEnrollmentId === "string" ? req.body.stewardPathEnrollmentId : undefined,
    stewardPathStepRunId: typeof req.body?.stewardPathStepRunId === "string" ? req.body.stewardPathStepRunId : undefined,
  });
  if (!result) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Template not found." } });
    return;
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
      status: { in: ["GENERATED", "PRINTED", "MAILED", "ARCHIVED"] },
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
      status: { in: ["PRINTED", "MAILED", "ARCHIVED", "GENERATED"] },
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

  const rows = await prisma.generatedLetter.findMany({
    where: { organizationId, id: { in: ids } },
    select: { id: true, status: true, metadataJson: true, constituentId: true },
  });

  const now = new Date();
  for (const row of rows) {
    const currentQueue = readQueueMetadata(row.metadataJson);
    const nextQueue: GeneratedLetterQueueMetadata = {
      ...currentQueue,
      updatedByUserId: userId,
      statusNote: note ?? currentQueue.statusNote,
      priority: priority ?? currentQueue.priority ?? "NORMAL",
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

  const action = parseEnum(req.body?.action, ["QUEUE_FOR_MAIL", "MARK_MAILED", "MARK_RETURNED", "ADDRESS_ISSUE", "REPRINT", "ARCHIVE"] as const);
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
      if (!addressComplete) {
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
      nextQueue.printStatus = "QUEUED_FOR_PRINT";
      nextQueue.mailStatus = "QUEUED_FOR_MAIL";
      nextQueue.queuedForPrintAt = now.toISOString();
      nextStatus = "GENERATED";
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
      template: { select: { name: true } },
      constituent: { select: { firstName: true, lastName: true } },
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
  const subject = generatedLetter.mergedPrintSubject?.trim() || templateName;

  try {
    const pdfBuffer = await renderGeneratedLetterPdf({
      templateName,
      subject,
      constituentName,
      generatedAt: generatedLetter.generatedAt,
      mergedPrintBody: generatedLetter.mergedPrintBody,
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

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename=\"${fileName}\"`);
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(pdfBuffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown PDF export failure";

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

    res.status(500).json({
      error: {
        code: "PDF_EXPORT_FAILED",
        message: "Failed to export this generated letter as PDF.",
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

  const dryRun = req.body?.dryRun === true;
  const addToPrintQueue = req.body?.addToPrintQueue !== false;
  const dedupeHousehold = req.body?.dedupeHousehold === true;
  const year = typeof req.body?.year === "number"
    ? req.body.year
    : Number.parseInt(String(req.body?.year ?? ""), 10);

  const requestedIds = Array.isArray(req.body?.constituentIds)
    ? req.body.constituentIds.map((value: unknown) => String(value)).filter(Boolean)
    : [];

  const filterType = parseEnum(req.body?.filterType, ["ALL", "ACTIVE", "LAPSED", "NEW", "MAJOR_DONOR", "MONTHLY_DONOR"] as const) ?? "ALL";
  const donorStatusFilter = filterType === "ALL" || filterType === "MONTHLY_DONOR" ? undefined : filterType;
  const recurringFilter = filterType === "MONTHLY_DONOR" ? { donations: { some: { isRecurring: true } } } : {};

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
        ...recurringFilter,
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

  for (const candidate of candidates) {
    if (candidate.doNotMail) {
      skipped.push({ constituentId: candidate.id, reason: "DO_NOT_MAIL" });
      continue;
    }

    if (!hasCompleteMailAddress(candidate)) {
      skipped.push({ constituentId: candidate.id, reason: "MISSING_ADDRESS" });
      continue;
    }

    if (dedupeHousehold && candidate.householdId) {
      if (seenHouseholds.has(candidate.householdId)) {
        skipped.push({ constituentId: candidate.id, reason: "DUPLICATE_HOUSEHOLD" });
        continue;
      }
      seenHouseholds.add(candidate.householdId);
    }

    const preview = await resolveLetterMergeContext({
      organizationId,
      template,
      constituentId: candidate.id,
      year: Number.isFinite(year) ? year : undefined,
      actorUserId: userId,
    });

    if (preview.unsupportedFields.length > 0) {
      skipped.push({ constituentId: candidate.id, reason: "UNSUPPORTED_MERGE_FIELDS" });
      continue;
    }

    if (preview.mergedPrintBody.includes("{{")) {
      skipped.push({ constituentId: candidate.id, reason: "MISSING_REQUIRED_MERGE_DATA" });
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
      year: Number.isFinite(year) ? year : undefined,
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

    if (addToPrintQueue) {
      const queue: GeneratedLetterQueueMetadata = {
        printStatus: "QUEUED_FOR_PRINT",
        reviewStatus: "APPROVED",
        priority: "NORMAL",
        queuedForPrintAt: new Date().toISOString(),
        updatedByUserId: userId,
      };

      await prisma.generatedLetter.update({
        where: { id: generated.generated.id },
        data: {
          metadataJson: buildMetadataWithQueue(generated.generated.metadataJson, queue),
        },
      });
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
    skippedCount: skipped.length,
    skippedByReason,
    skipped,
    generated: generatedSample.slice(0, 200),
    addToPrintQueue,
  });
});

export default router;
