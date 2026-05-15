/**
 * Steward Signals API routes.
 *
 * Provides read APIs for summary, opportunity queue, lapse cohorts, and donor profile widgets,
 * plus confirm-first action endpoints for opportunity-driven task/email/dismiss workflows.
 *
 * Routes:
 *   GET  /api/steward-signals/summary
 *   GET  /api/steward-signals/daily-thought
 *   POST /api/steward-signals/daily-thought/regenerate
 *   GET  /api/steward-signals/growth-ideas
 *   GET  /api/steward-signals/opportunities
 *   GET  /api/steward-signals/lapse-radar
 *   POST /api/steward-signals/email-draft
 *   POST /api/steward-signals/email-draft/save
 *   POST /api/steward-signals/email-draft/create-follow-up-task
 *   GET  /api/steward-signals/donors/:id/widget
 *   POST /api/steward-signals/opportunities/:id/create-task
 *   POST /api/steward-signals/opportunities/:id/draft-email
 *   POST /api/steward-signals/opportunities/:id/dismiss
 *
 * @module routes/steward-signals
 */
import { Router } from "express";
import type { DonorStatus, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { parseStewardAiConfig, runStewardAiChat } from "../services/steward-ai-ollama.js";
import { withStewardAiTask } from "../services/steward-ai-runtime-status.js";
import {
  buildDailyStewardThoughtFallback,
  buildDeterministicEmailDraft,
  buildGrowthIdeas,
  calculateLapseRisk as calculateIntelligenceLapseRisk,
  calculatePropensityWindow,
  calculateRfmScore,
  normalizeDailyThoughtAiResponse,
  type DailyStewardThought,
  type DailyThoughtContext,
  type EmailDraftStudioArtifact,
  type EmailDraftStudioInput,
  type StewardIntelligenceDonorInput,
} from "../services/steward-intelligence-engine.js";

const router = Router();
const STEWARD_SIGNALS_INDEX_PLUGIN_KEY = "steward_signals_index";
const STEWARD_DAILY_THOUGHT_PLUGIN_KEY = "steward_daily_thought";
const STEWARD_AI_PLUGIN_KEY = "steward_ai";
const STEWARD_SIGNAL_FIELD_KEYS = {
  generosity: "demoStewardGenerosityScore",
  lapseRisk: "demoStewardLapseRisk",
  opportunity: "demoStewardOpportunityScore",
  recommendation: "demoStewardOpportunityRecommendation",
  indexedAt: "demoStewardIndexedAt",
} as const;

// All Steward Signals endpoints require authentication.
router.use(requireAuth);

type OpportunityPriority = "High" | "Medium" | "Low";
type OpportunityStatus = "Needs Review" | "Queued";

interface OpportunityRecord {
  id: string;
  constituentId: string;
  donorName: string;
  priority: OpportunityPriority;
  opportunityType: string;
  reason: string;
  suggestedAction: string;
  channel: string;
  dueDateIso: string;
  ownerName: string;
  status: OpportunityStatus;
  confidence: number;
  confidenceReason: string;
  opportunityScore: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

interface TaskSuggestionRecord {
  id: string;
  opportunityId: string;
  constituentId: string;
  donorName: string;
  title: string;
  description: string;
  taskType: "THANK_YOU" | "FOLLOW_UP";
  priority: "HIGH" | "MEDIUM" | "LOW";
  channel: string;
  dueDateIso: string;
  confidence: number;
  confidenceReason: string;
  reason: string;
}

interface StewardWidgetResponse {
  constituentId: string;
  donorName: string;
  generosityScore: number;
  opportunityScore: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  bestNextStep: string;
  bestChannel: string;
  confidence: number;
  explanation: string;
  lastGiftDate: string | null;
  lastGiftAmount: number;
  totalLifetimeGiving: number;
  giftCount: number;
  inDevelopmentNote: string;
}

interface StewardIndexState {
  fingerprint: string;
  lastIndexedAt: string;
  indexedConstituentCount: number;
  autoRebuildCount: number;
  manualRebuildCount: number;
  lastTrigger: "auto" | "manual";
}

interface StewardRebuildResponse {
  rebuilt: boolean;
  reason: string;
  state: StewardIndexState;
}

interface DailyThoughtRecord {
  dateKey: string;
  generatedAt: string;
  generatedByUserId: string | null;
  thought: DailyStewardThought;
  context: DailyThoughtContext;
  aiError: string | null;
}

interface EmailDraftStudioRequestPayload {
  donorId?: string;
  donorName?: string;
  donorFirstName?: string;
  messageGoal?: EmailDraftStudioInput["messageGoal"];
  messageIdea?: string;
  tone?: EmailDraftStudioInput["tone"];
  length?: EmailDraftStudioInput["length"];
  includeGivingContext?: boolean;
  includeCampaignContext?: boolean;
  includeMinistryImpact?: boolean;
  callToAction?: string;
  signature?: string;
  useAi?: boolean;
  saveAsDraft?: boolean;
}

/** Returns whether Steward AI is enabled for the active organization. */
async function isStewardAiEnabled(organizationId: string): Promise<boolean> {
  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_AI_PLUGIN_KEY,
      },
    },
    select: {
      enabled: true,
    },
  });

  return Boolean(setting?.enabled);
}

/** Returns days elapsed since a gift date; large sentinel value when missing. */
function daysSince(date: Date | null | undefined): number {
  if (!date) return 9999;
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

/** Best-effort conversion from unknown to number. */
function asNumber(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  // Prisma Decimal-like objects stringify safely (for example Decimal.js instances).
  if (value && typeof value === "object" && "toString" in value && typeof value.toString === "function") {
    const parsed = Number.parseFloat(value.toString());
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/** Best-effort conversion from unknown to string. */
function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Escapes HTML-sensitive characters for safe rich-text body construction. */
function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Converts plain-text email copy into simple paragraph-based HTML. */
function bodyTextToHtml(bodyText: string): string {
  const paragraphs = bodyText
    .split(/\n\s*\n/g)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0)
    .slice(0, 14);

  if (paragraphs.length === 0) {
    return "<p>Hello,</p><p>Thank you for your support.</p>";
  }

  return paragraphs
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

interface ParsedEmailDraft {
  subject: string;
  previewText: string;
  bodyText: string;
}

/** Parses AI-generated draft content, preferring explicit JSON payloads with safe fallbacks. */
function parseGeneratedDraft(raw: string, donorFirstName: string): ParsedEmailDraft {
  const fallback: ParsedEmailDraft = {
    subject: `Thank you for your continued partnership`,
    previewText: `Steward Signals generated a draft for review before sending.`,
    bodyText: [
      `Dear ${donorFirstName},`,
      "",
      "Thank you for your support. This draft was generated from Steward Signals and requires staff review before sending.",
    ].join("\n"),
  };

  const cleaned = String(raw ?? "").trim();
  if (!cleaned) return fallback;

  const directJsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (directJsonMatch) {
    try {
      const parsed = JSON.parse(directJsonMatch[0]) as Partial<ParsedEmailDraft>;
      const subject = asString(parsed.subject, "").trim() || fallback.subject;
      const previewText = asString(parsed.previewText, "").trim() || fallback.previewText;
      const bodyText = asString(parsed.bodyText, "").trim() || fallback.bodyText;
      return {
        subject: subject.slice(0, 180),
        previewText: previewText.slice(0, 220),
        bodyText: bodyText.slice(0, 6000),
      };
    } catch {
      // Fall through to heuristic parsing.
    }
  }

  const heuristicLines = cleaned
    .replace(/```json|```/gi, "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const subjectLine = heuristicLines.find((line) => /^subject\s*:/i.test(line));
  const previewLine = heuristicLines.find((line) => /^preview\s*text\s*:/i.test(line));
  const bodyStart = heuristicLines.findIndex((line) => /^body\s*text\s*:/i.test(line));

  const subject = subjectLine ? subjectLine.replace(/^subject\s*:/i, "").trim() : fallback.subject;
  const previewText = previewLine ? previewLine.replace(/^preview\s*text\s*:/i, "").trim() : fallback.previewText;

  const bodyText = bodyStart >= 0
    ? heuristicLines.slice(bodyStart + 1).join("\n").trim()
    : cleaned;

  return {
    subject: (subject || fallback.subject).slice(0, 180),
    previewText: (previewText || fallback.previewText).slice(0, 220),
    bodyText: (bodyText || fallback.bodyText).slice(0, 6000),
  };
}

/** Parses AI output into the Email Draft Studio artifact contract with deterministic fallback. */
function parseStudioAiDraft(raw: string, fallback: EmailDraftStudioArtifact): EmailDraftStudioArtifact {
  const cleaned = String(raw ?? "").trim();
  if (!cleaned) return fallback;

  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return fallback;

  try {
    const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;
    const subject = asString(parsed.subject, fallback.subject).trim().slice(0, 180);
    const previewText = asString(parsed.previewText, fallback.previewText).trim().slice(0, 220);
    const bodyMarkdown = asString(parsed.bodyMarkdown, asString(parsed.bodyText, fallback.bodyMarkdown)).trim();
    const bodyPlainText = asString(parsed.bodyPlainText, bodyMarkdown || fallback.bodyPlainText).trim();
    const bodyHtml = asString(parsed.bodyHtml, bodyTextToHtml(bodyPlainText || fallback.bodyPlainText)).trim();
    const warnings = Array.isArray(parsed.warnings)
      ? parsed.warnings.map((item) => asString(item, "").trim()).filter(Boolean).slice(0, 10)
      : fallback.warnings;

    if (!subject || !bodyPlainText) return fallback;

    return {
      ...fallback,
      subject,
      previewText,
      bodyMarkdown: (bodyMarkdown || bodyPlainText).slice(0, 8000),
      bodyPlainText: bodyPlainText.slice(0, 8000),
      bodyHtml: bodyHtml.slice(0, 12000),
      warnings,
    };
  } catch {
    return fallback;
  }
}

/** Returns a user-facing label for opportunity kind values embedded in opportunity IDs. */
function opportunityKindLabel(kind: string): string {
  if (kind === "second-gift") return "Second Gift Invitation";
  if (kind === "lapse-follow-up") return "Lapsed Donor Reconnect";
  if (kind === "major-stewardship") return "Major Gift Stewardship";
  return "Stewardship Follow-Up";
}

/** Keeps numeric scores bounded in an inclusive range. */
function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Computes deterministic confidence with explicit evidence from live donor/task signals.
 */
function computeOpportunityConfidence(params: {
  kind: "second-gift" | "lapse-follow-up" | "major-stewardship";
  daysFromGift: number;
  opportunityScore: number;
  giftCount: number;
  lastGiftAmount: number;
  donorStatus: DonorStatus;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  hasOpenTasks: boolean;
}): { confidence: number; reason: string } {
  const scoreSignal = Math.round(clampNumber(params.opportunityScore, 0, 100) * 0.22);
  const openTaskPenalty = params.hasOpenTasks ? 10 : 0;

  if (params.kind === "second-gift") {
    // Ideal second-gift prompt zone is around 35-45 days after first gift.
    const windowFit = clampNumber(28 - Math.round(Math.abs(params.daysFromGift - 40) * 0.8), 0, 28);
    const firstGiftSignal = params.giftCount === 1 ? 18 : 0;
    const confidence = clampNumber(35 + windowFit + firstGiftSignal + scoreSignal - openTaskPenalty, 40, 95);
    const reason = `confidence from first-gift trigger (${params.giftCount === 1 ? "matched" : "not matched"}), day-window fit (${params.daysFromGift} days), score signal (${params.opportunityScore}), and ${params.hasOpenTasks ? "existing open tasks penalty" : "no open-task penalty"}`;
    return { confidence, reason };
  }

  if (params.kind === "lapse-follow-up") {
    const lapseWeight = params.lapseRisk === "CRITICAL" ? 28 : params.lapseRisk === "HIGH" ? 18 : 10;
    const overdueWeight = params.daysFromGift > 365 ? 20 : params.daysFromGift > 180 ? 12 : 6;
    const confidence = clampNumber(32 + lapseWeight + overdueWeight + scoreSignal - openTaskPenalty, 45, 96);
    const reason = `confidence from lapse risk (${params.lapseRisk}), recency delay (${params.daysFromGift} days), score signal (${params.opportunityScore}), and ${params.hasOpenTasks ? "existing open tasks penalty" : "no open-task penalty"}`;
    return { confidence, reason };
  }

  const majorStatusWeight = params.donorStatus === "MAJOR_DONOR" ? 22 : 10;
  const amountWeight = params.lastGiftAmount >= 5000
    ? clampNumber(10 + Math.round(Math.log10(params.lastGiftAmount + 1) * 4), 10, 24)
    : 0;
  const confidence = clampNumber(34 + majorStatusWeight + amountWeight + scoreSignal - openTaskPenalty, 48, 98);
  const reason = `confidence from donor status (${params.donorStatus}), last gift amount ($${params.lastGiftAmount.toFixed(0)}), score signal (${params.opportunityScore}), and ${params.hasOpenTasks ? "existing open tasks penalty" : "no open-task penalty"}`;
  return { confidence, reason };
}

/** Loads steward custom field IDs for score/value retrieval when configured. */
async function loadStewardFieldIds(organizationId: string): Promise<Record<string, string>> {
  const fields = await prisma.customField.findMany({
    where: {
      organizationId,
      entityType: "constituent",
      key: {
        in: Object.values(STEWARD_SIGNAL_FIELD_KEYS),
      },
    },
    select: { id: true, key: true },
  });

  return Object.fromEntries(fields.map((field) => [field.key, field.id]));
}

/** Loads custom signal values for a list of constituents when fields are present. */
async function loadSignalValues(
  constituentIds: string[],
  fieldIds: Record<string, string>
): Promise<Map<string, Record<string, string>>> {
  const uniqueFieldIds = Object.values(fieldIds);
  if (constituentIds.length === 0 || uniqueFieldIds.length === 0) {
    return new Map<string, Record<string, string>>();
  }

  const storedValues = await prisma.customFieldValue.findMany({
    where: {
      entityType: "constituent",
      entityId: { in: constituentIds },
      fieldId: { in: uniqueFieldIds },
    },
    select: {
      entityId: true,
      fieldId: true,
      value: true,
    },
  });

  const byConstituent = new Map<string, Record<string, string>>();

  for (const value of storedValues) {
    const entry = byConstituent.get(value.entityId) ?? {};
    const fieldKey = Object.entries(fieldIds).find((pair) => pair[1] === value.fieldId)?.[0];
    if (!fieldKey) continue;

    let normalized = "";
    if (value.value !== null && value.value !== undefined) {
      try {
        normalized = String(JSON.parse(value.value));
      } catch {
        normalized = String(value.value);
      }
    }

    entry[fieldKey] = normalized;
    byConstituent.set(value.entityId, entry);
  }

  return byConstituent;
}

/** Derives lapse risk with custom-field override and deterministic fallback rules. */
function deriveLapseRisk(
  donorStatus: DonorStatus,
  lastGiftDate: Date | null,
  customLapseRisk?: string
): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  const custom = customLapseRisk?.toUpperCase();
  if (custom === "LOW" || custom === "MEDIUM" || custom === "HIGH" || custom === "CRITICAL") {
    return custom;
  }

  const elapsed = daysSince(lastGiftDate);
  if (donorStatus === "LAPSED" || elapsed > 730) return "CRITICAL";
  if (elapsed > 365) return "HIGH";
  if (elapsed > 180) return "MEDIUM";
  return "LOW";
}

/** Derives opportunity score with custom-field override and behavior fallback rules. */
function deriveOpportunityScore(params: {
  customOpportunityScore?: string;
  donorStatus: DonorStatus;
  giftCount: number;
  engagementScore: number;
  lastGiftAmount: Prisma.Decimal | number | null;
  lastGiftDate: Date | null;
}): number {
  const custom = asNumber(params.customOpportunityScore, Number.NaN);
  if (Number.isFinite(custom)) return Math.max(0, Math.min(100, Math.round(custom)));

  let score = params.engagementScore;
  if (params.donorStatus === "MAJOR_DONOR") score += 14;
  if (params.giftCount >= 4) score += 8;
  if (asNumber(params.lastGiftAmount, 0) >= 5000) score += 10;

  const elapsed = daysSince(params.lastGiftDate);
  if (elapsed <= 45) score += 8;
  if (elapsed > 365) score -= 20;

  return Math.max(0, Math.min(100, Math.round(score)));
}

/** Derives generosity score with custom-field override and giving-history fallback rules. */
function deriveGenerosityScore(params: {
  customGenerosityScore?: string;
  donorStatus: DonorStatus;
  totalLifetimeGiving: Prisma.Decimal | number;
  giftCount: number;
  engagementScore: number;
}): number {
  const custom = asNumber(params.customGenerosityScore, Number.NaN);
  if (Number.isFinite(custom)) return Math.max(0, Math.min(100, Math.round(custom)));

  let score = Math.round(params.engagementScore * 0.55);
  score += Math.min(20, Math.floor(params.giftCount / 2));
  score += Math.min(20, Math.floor(asNumber(params.totalLifetimeGiving, 0) / 5000));
  if (params.donorStatus === "MAJOR_DONOR") score += 8;
  if (params.donorStatus === "LAPSED") score -= 14;

  return Math.max(0, Math.min(100, score));
}

/** Builds a deterministic next-step recommendation used by indexed signal values. */
function deriveRecommendation(params: {
  donorStatus: DonorStatus;
  giftCount: number;
  lapseRisk: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  doNotEmail: boolean;
  doNotCall: boolean;
}): string {
  if (params.lapseRisk === "CRITICAL") {
    return "Create reconnect task and schedule personal outreach call this week.";
  }
  if (params.giftCount <= 1) {
    return params.doNotEmail
      ? "Create second-gift invitation task with phone-first outreach."
      : "Draft second-gift invitation with impact-focused thank-you message.";
  }
  if (params.donorStatus === "MAJOR_DONOR") {
    return "Prepare personalized impact update and assign major-donor stewardship follow-up.";
  }
  if (params.lapseRisk === "HIGH" || params.lapseRisk === "MEDIUM") {
    return params.doNotCall
      ? "Queue stewardship letter and track follow-up completion."
      : "Assign cadence-recovery follow-up task with personal check-in call.";
  }
  return "Assign stewardship check-in task and draft donor impact update.";
}

/** Returns a stable marker for optional date values used in index fingerprints. */
function isoOrNone(value: Date | null | undefined): string {
  return value ? value.toISOString() : "none";
}

/** Converts primitive values to JSON-encoded custom-field storage strings. */
function encodeSignalValue(value: string | number): string {
  return JSON.stringify(value);
}

/** Computes an organization fingerprint from core donor data timestamps. */
async function computeSignalsFingerprint(organizationId: string): Promise<string> {
  const [constituentMax, donationMax, taskMax] = await Promise.all([
    prisma.constituent.aggregate({
      where: { organizationId },
      _max: { updatedAt: true },
    }),
    prisma.donation.aggregate({
      where: {
        constituent: { organizationId },
      },
      _max: { updatedAt: true },
    }),
    prisma.task.aggregate({
      where: {
        OR: [
          { constituent: { organizationId } },
          { meeting: { organizationId } },
        ],
      },
      _max: { updatedAt: true },
    }),
  ]);

  return [
    isoOrNone(constituentMax._max.updatedAt),
    isoOrNone(donationMax._max.updatedAt),
    isoOrNone(taskMax._max.updatedAt),
  ].join("|");
}

/** Returns a safe default index state when no persisted state exists. */
function defaultStewardIndexState(fingerprint: string): StewardIndexState {
  return {
    fingerprint,
    lastIndexedAt: new Date(0).toISOString(),
    indexedConstituentCount: 0,
    autoRebuildCount: 0,
    manualRebuildCount: 0,
    lastTrigger: "auto",
  };
}

/** Parses persisted plugin config into a typed Steward index state object. */
function parseStewardIndexState(raw: unknown, fallbackFingerprint: string): StewardIndexState {
  const base = defaultStewardIndexState(fallbackFingerprint);
  if (!raw || typeof raw !== "object") return base;

  const config = raw as Record<string, unknown>;
  const triggerRaw = asString(config.lastTrigger, "auto");
  const lastTrigger = triggerRaw === "manual" ? "manual" : "auto";

  return {
    fingerprint: asString(config.fingerprint, base.fingerprint),
    lastIndexedAt: asString(config.lastIndexedAt, base.lastIndexedAt),
    indexedConstituentCount: Math.max(0, Math.round(asNumber(config.indexedConstituentCount, 0))),
    autoRebuildCount: Math.max(0, Math.round(asNumber(config.autoRebuildCount, 0))),
    manualRebuildCount: Math.max(0, Math.round(asNumber(config.manualRebuildCount, 0))),
    lastTrigger,
  };
}

/** Loads the persisted Steward index state from plugin settings. */
async function readStewardIndexState(
  organizationId: string,
  fallbackFingerprint: string
): Promise<{ exists: boolean; state: StewardIndexState }> {
  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_SIGNALS_INDEX_PLUGIN_KEY,
      },
    },
    select: {
      config: true,
    },
  });

  return {
    exists: Boolean(setting),
    state: parseStewardIndexState(setting?.config, fallbackFingerprint),
  };
}

/** Persists the latest Steward index state in plugin settings. */
async function writeStewardIndexState(organizationId: string, state: StewardIndexState): Promise<void> {
  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_SIGNALS_INDEX_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: STEWARD_SIGNALS_INDEX_PLUGIN_KEY,
      enabled: true,
      config: state as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: true,
      config: state as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Ensures steward signal custom fields exist before writing indexed analysis values. */
async function ensureStewardFieldIds(organizationId: string): Promise<Record<string, string>> {
  const definitions = [
    {
      key: STEWARD_SIGNAL_FIELD_KEYS.generosity,
      name: "Steward Generosity Score",
      fieldType: "number",
    },
    {
      key: STEWARD_SIGNAL_FIELD_KEYS.lapseRisk,
      name: "Steward Lapse Risk",
      fieldType: "text",
    },
    {
      key: STEWARD_SIGNAL_FIELD_KEYS.opportunity,
      name: "Steward Opportunity Score",
      fieldType: "number",
    },
    {
      key: STEWARD_SIGNAL_FIELD_KEYS.recommendation,
      name: "Steward Opportunity Recommendation",
      fieldType: "textarea",
    },
    {
      key: STEWARD_SIGNAL_FIELD_KEYS.indexedAt,
      name: "Steward Indexed At",
      fieldType: "date",
    },
  ] as const;

  const fields = await Promise.all(definitions.map((definition) => prisma.customField.upsert({
    where: {
      organizationId_entityType_key: {
        organizationId,
        entityType: "constituent",
        key: definition.key,
      },
    },
    create: {
      organizationId,
      entityType: "constituent",
      key: definition.key,
      name: definition.name,
      fieldType: definition.fieldType,
      required: false,
      sortOrder: 0,
      active: true,
    },
    update: {
      name: definition.name,
      active: true,
    },
    select: {
      id: true,
      key: true,
    },
  })));

  return Object.fromEntries(fields.map((field) => [field.key, field.id]));
}

/** Rebuilds indexed Steward Signals values and persists refreshed index state metadata. */
async function rebuildStewardSignalsIndex(params: {
  organizationId: string;
  trigger: "auto" | "manual";
  fingerprint?: string;
}): Promise<StewardRebuildResponse> {
  const fingerprint = params.fingerprint ?? await computeSignalsFingerprint(params.organizationId);
  const indexedAtIso = new Date().toISOString();

  const [fieldIds, constituents, previousState] = await Promise.all([
    ensureStewardFieldIds(params.organizationId),
    prisma.constituent.findMany({
      where: {
        organizationId: params.organizationId,
      },
      select: {
        id: true,
        donorStatus: true,
        giftCount: true,
        lastGiftDate: true,
        lastGiftAmount: true,
        totalLifetimeGiving: true,
        engagementScore: true,
        doNotEmail: true,
        doNotCall: true,
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 4000,
    }),
    readStewardIndexState(params.organizationId, fingerprint),
  ]);

  const operations: Prisma.PrismaPromise<unknown>[] = [];
  const pushValueUpsert = (fieldKey: string, entityId: string, value: string) => {
    const fieldId = fieldIds[fieldKey];
    if (!fieldId) return;
    operations.push(
      prisma.customFieldValue.upsert({
        where: {
          fieldId_entityId: {
            fieldId,
            entityId,
          },
        },
        create: {
          fieldId,
          entityId,
          entityType: "constituent",
          value,
        },
        update: {
          value,
        },
      })
    );
  };

  for (const constituent of constituents) {
    const lapseRisk = deriveLapseRisk(constituent.donorStatus, constituent.lastGiftDate);
    const generosityScore = deriveGenerosityScore({
      donorStatus: constituent.donorStatus,
      totalLifetimeGiving: constituent.totalLifetimeGiving,
      giftCount: constituent.giftCount,
      engagementScore: constituent.engagementScore,
    });
    const opportunityScore = deriveOpportunityScore({
      donorStatus: constituent.donorStatus,
      giftCount: constituent.giftCount,
      engagementScore: constituent.engagementScore,
      lastGiftAmount: constituent.lastGiftAmount,
      lastGiftDate: constituent.lastGiftDate,
    });
    const recommendation = deriveRecommendation({
      donorStatus: constituent.donorStatus,
      giftCount: constituent.giftCount,
      lapseRisk,
      doNotEmail: constituent.doNotEmail,
      doNotCall: constituent.doNotCall,
    });

    pushValueUpsert(STEWARD_SIGNAL_FIELD_KEYS.generosity, constituent.id, encodeSignalValue(generosityScore));
    pushValueUpsert(STEWARD_SIGNAL_FIELD_KEYS.lapseRisk, constituent.id, encodeSignalValue(lapseRisk));
    pushValueUpsert(STEWARD_SIGNAL_FIELD_KEYS.opportunity, constituent.id, encodeSignalValue(opportunityScore));
    pushValueUpsert(STEWARD_SIGNAL_FIELD_KEYS.recommendation, constituent.id, encodeSignalValue(recommendation));
    pushValueUpsert(STEWARD_SIGNAL_FIELD_KEYS.indexedAt, constituent.id, encodeSignalValue(indexedAtIso));

    if (operations.length >= 500) {
      await prisma.$transaction(operations.splice(0, operations.length));
    }
  }

  if (operations.length > 0) {
    await prisma.$transaction(operations);
  }

  const nextState: StewardIndexState = {
    fingerprint,
    lastIndexedAt: indexedAtIso,
    indexedConstituentCount: constituents.length,
    autoRebuildCount: previousState.state.autoRebuildCount + (params.trigger === "auto" ? 1 : 0),
    manualRebuildCount: previousState.state.manualRebuildCount + (params.trigger === "manual" ? 1 : 0),
    lastTrigger: params.trigger,
  };

  await writeStewardIndexState(params.organizationId, nextState);

  return {
    rebuilt: true,
    reason: params.trigger === "manual"
      ? "Manual analysis rebuild completed."
      : "Signals index auto-refreshed after data changes.",
    state: nextState,
  };
}

/** Ensures steward index data is current with recent donor/task/donation edits. */
async function ensureStewardSignalsIndexCurrent(organizationId: string): Promise<StewardRebuildResponse> {
  const fingerprint = await computeSignalsFingerprint(organizationId);
  const currentState = await readStewardIndexState(organizationId, fingerprint);
  const hasRealIndexedTimestamp = currentState.state.lastIndexedAt !== new Date(0).toISOString();

  if (currentState.exists && hasRealIndexedTimestamp && currentState.state.fingerprint === fingerprint) {
    return {
      rebuilt: false,
      reason: "Signals index is already current.",
      state: currentState.state,
    };
  }

  return rebuildStewardSignalsIndex({
    organizationId,
    trigger: "auto",
    fingerprint,
  });
}

/** Builds stable opportunity IDs that action endpoints can parse deterministically. */
function buildOpportunityId(kind: string, constituentId: string): string {
  return `${kind}__${constituentId}`;
}

/** Parses opportunity IDs from route params. */
function parseOpportunityId(rawId: string): { kind: string; constituentId: string } | null {
  const [kind, constituentId] = rawId.split("__");
  if (!kind || !constituentId) return null;
  return { kind, constituentId };
}

/**
 * Creates opportunity queue records from current constituent + task + signal context.
 * This logic is intentionally explainable and deterministic while model-based scoring evolves.
 */
function buildOpportunities(params: {
  constituents: Array<{
    id: string;
    firstName: string;
    lastName: string;
    donorStatus: DonorStatus;
    giftCount: number;
    lastGiftDate: Date | null;
    lastGiftAmount: Prisma.Decimal | null;
    engagementScore: number;
    doNotEmail: boolean;
    doNotCall: boolean;
    doNotMail: boolean;
  }>;
  openTasksByConstituent: Map<string, number>;
  signalValuesByConstituent: Map<string, Record<string, string>>;
  dismissedOpportunityIds: Set<string>;
}): OpportunityRecord[] {
  const output: OpportunityRecord[] = [];

  for (const constituent of params.constituents) {
    const donorName = `${constituent.firstName} ${constituent.lastName}`;
    const signal = params.signalValuesByConstituent.get(constituent.id) ?? {};
    const lapseRisk = deriveLapseRisk(constituent.donorStatus, constituent.lastGiftDate, signal.demoStewardLapseRisk);
    const opportunityScore = deriveOpportunityScore({
      customOpportunityScore: signal.demoStewardOpportunityScore,
      donorStatus: constituent.donorStatus,
      giftCount: constituent.giftCount,
      engagementScore: constituent.engagementScore,
      lastGiftAmount: constituent.lastGiftAmount,
      lastGiftDate: constituent.lastGiftDate,
    });

    const hasOpenTasks = (params.openTasksByConstituent.get(constituent.id) ?? 0) > 0;
    const daysFromGift = daysSince(constituent.lastGiftDate);
    const preferredChannel = constituent.doNotEmail
      ? (constituent.doNotCall ? "Mail" : "Phone")
      : "Email";

    // New donor second-gift follow-up.
    if (constituent.giftCount === 1 && daysFromGift >= 14 && daysFromGift <= 65) {
      const id = buildOpportunityId("second-gift", constituent.id);
      if (!params.dismissedOpportunityIds.has(id)) {
        const confidence = computeOpportunityConfidence({
          kind: "second-gift",
          daysFromGift,
          opportunityScore,
          giftCount: constituent.giftCount,
          lastGiftAmount: asNumber(constituent.lastGiftAmount, 0),
          donorStatus: constituent.donorStatus,
          lapseRisk,
          hasOpenTasks,
        });

        output.push({
          id,
          constituentId: constituent.id,
          donorName,
          priority: "High",
          opportunityType: "Second Gift Invitation",
          reason: `First gift was ${daysFromGift} days ago and second-gift follow-up is due.`,
          suggestedAction: "Create personal follow-up task and draft thank-you + invitation email.",
          channel: preferredChannel,
          dueDateIso: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
          ownerName: hasOpenTasks ? "Assigned via open task" : "Unassigned",
          status: hasOpenTasks ? "Queued" : "Needs Review",
          confidence: confidence.confidence,
          confidenceReason: confidence.reason,
          opportunityScore,
          lapseRisk,
        });
      }
    }

    // Lapse / cadence broken follow-up.
    if (lapseRisk === "HIGH" || lapseRisk === "CRITICAL" || daysFromGift > 180) {
      const id = buildOpportunityId("lapse-follow-up", constituent.id);
      if (!params.dismissedOpportunityIds.has(id)) {
        const confidence = computeOpportunityConfidence({
          kind: "lapse-follow-up",
          daysFromGift,
          opportunityScore,
          giftCount: constituent.giftCount,
          lastGiftAmount: asNumber(constituent.lastGiftAmount, 0),
          donorStatus: constituent.donorStatus,
          lapseRisk,
          hasOpenTasks,
        });

        output.push({
          id,
          constituentId: constituent.id,
          donorName,
          priority: lapseRisk === "CRITICAL" ? "High" : "Medium",
          opportunityType: lapseRisk === "CRITICAL" ? "Lapsed Donor Reconnect" : "Cadence Broken Follow-Up",
          reason: `Lapse risk is ${lapseRisk}; last completed gift was ${daysFromGift} days ago.`,
          suggestedAction: "Create reconnect outreach task and draft a stewardship follow-up message.",
          channel: constituent.doNotCall ? "Mail" : "Phone",
          dueDateIso: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000).toISOString(),
          ownerName: hasOpenTasks ? "Assigned via open task" : "Unassigned",
          status: hasOpenTasks ? "Queued" : "Needs Review",
          confidence: confidence.confidence,
          confidenceReason: confidence.reason,
          opportunityScore,
          lapseRisk,
        });
      }
    }

    // Major gift stewardship follow-up.
    if (constituent.donorStatus === "MAJOR_DONOR" || asNumber(constituent.lastGiftAmount, 0) >= 5000) {
      const id = buildOpportunityId("major-stewardship", constituent.id);
      if (!params.dismissedOpportunityIds.has(id)) {
        const confidence = computeOpportunityConfidence({
          kind: "major-stewardship",
          daysFromGift,
          opportunityScore,
          giftCount: constituent.giftCount,
          lastGiftAmount: asNumber(constituent.lastGiftAmount, 0),
          donorStatus: constituent.donorStatus,
          lapseRisk,
          hasOpenTasks,
        });

        output.push({
          id,
          constituentId: constituent.id,
          donorName,
          priority: "High",
          opportunityType: "Major Gift Stewardship",
          reason: "Major-gift signals are present and proactive stewardship is recommended.",
          suggestedAction: "Create personalized stewardship task and draft impact-update email.",
          channel: constituent.doNotEmail ? "Phone" : "Email then phone",
          dueDateIso: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          ownerName: hasOpenTasks ? "Assigned via open task" : "Unassigned",
          status: hasOpenTasks ? "Queued" : "Needs Review",
          confidence: confidence.confidence,
          confidenceReason: confidence.reason,
          opportunityScore,
          lapseRisk,
        });
      }
    }
  }

  const priorityRank: Record<OpportunityPriority, number> = { High: 3, Medium: 2, Low: 1 };

  return output
    .sort((a, b) => {
      if (priorityRank[a.priority] !== priorityRank[b.priority]) {
        return priorityRank[b.priority] - priorityRank[a.priority];
      }
      return b.opportunityScore - a.opportunityScore;
    });
}

/** Builds deterministic task suggestions from opportunity queue records. */
function buildTaskSuggestions(opportunities: OpportunityRecord[]): TaskSuggestionRecord[] {
  const priorityRank: Record<OpportunityPriority, number> = { High: 3, Medium: 2, Low: 1 };
  const taskPriorityByOpportunity: Record<OpportunityPriority, "HIGH" | "MEDIUM" | "LOW"> = {
    High: "HIGH",
    Medium: "MEDIUM",
    Low: "LOW",
  };

  // Keep only the highest-priority opportunity per constituent for immediate action clarity.
  const bestByConstituent = new Map<string, OpportunityRecord>();
  for (const record of opportunities) {
    const existing = bestByConstituent.get(record.constituentId);
    if (!existing) {
      bestByConstituent.set(record.constituentId, record);
      continue;
    }

    if (priorityRank[record.priority] > priorityRank[existing.priority] || record.opportunityScore > existing.opportunityScore) {
      bestByConstituent.set(record.constituentId, record);
    }
  }

  return Array.from(bestByConstituent.values())
    .sort((a, b) => {
      if (priorityRank[a.priority] !== priorityRank[b.priority]) {
        return priorityRank[b.priority] - priorityRank[a.priority];
      }
      return b.opportunityScore - a.opportunityScore;
    })
    .map((opportunity) => {
      const taskType = opportunity.opportunityType === "Second Gift Invitation" ? "THANK_YOU" : "FOLLOW_UP";
      const taskTitle =
        opportunity.opportunityType === "Second Gift Invitation"
          ? `${opportunity.donorName}: Send second-gift thank-you + invitation`
          : opportunity.opportunityType === "Major Gift Stewardship"
            ? `${opportunity.donorName}: Complete major donor stewardship touchpoint`
            : `${opportunity.donorName}: Reconnect stewardship follow-up`;

      const description = [
        `Steward Signals suggestion from ${opportunity.opportunityType}.`,
        `Reason: ${opportunity.reason}`,
        `Suggested action: ${opportunity.suggestedAction}`,
        `Preferred channel: ${opportunity.channel}`,
      ].join(" ");

      return {
        id: `task-suggestion__${opportunity.id}`,
        opportunityId: opportunity.id,
        constituentId: opportunity.constituentId,
        donorName: opportunity.donorName,
        title: taskTitle,
        description,
        taskType,
        priority: taskPriorityByOpportunity[opportunity.priority],
        channel: opportunity.channel,
        dueDateIso: opportunity.dueDateIso,
        confidence: opportunity.confidence,
        confidenceReason: opportunity.confidenceReason,
        reason: opportunity.reason,
      };
    });
}

/** Loads queue primitives used by summary, opportunities, and lapse-radar endpoints. */
async function loadOpportunityContext(organizationId: string, userId?: string): Promise<OpportunityRecord[]> {
  const [constituents, openTasks, fieldIds] = await Promise.all([
    prisma.constituent.findMany({
      where: { organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        donorStatus: true,
        giftCount: true,
        lastGiftDate: true,
        lastGiftAmount: true,
        engagementScore: true,
        doNotEmail: true,
        doNotCall: true,
        doNotMail: true,
      },
      orderBy: [{ updatedAt: "desc" }],
      take: 750,
    }),
    prisma.task.findMany({
      where: {
        status: { in: ["PENDING", "IN_PROGRESS"] },
        constituent: { organizationId },
      },
      select: {
        constituentId: true,
      },
      take: 2500,
    }),
    loadStewardFieldIds(organizationId),
  ]);

  const openTasksByConstituent = new Map<string, number>();
  for (const task of openTasks) {
    if (!task.constituentId) continue;
    const count = openTasksByConstituent.get(task.constituentId) ?? 0;
    openTasksByConstituent.set(task.constituentId, count + 1);
  }

  const signalValuesByConstituent = await loadSignalValues(constituents.map((c) => c.id), fieldIds);

  const dismissedLogs = await prisma.auditLog.findMany({
    where: {
      organizationId,
      action: "STEWARD_OPPORTUNITY_DISMISSED",
      ...(userId ? { userId } : {}),
    },
    select: { entityId: true },
    take: 5000,
    orderBy: { createdAt: "desc" },
  });

  const dismissedOpportunityIds = new Set(
    dismissedLogs.map((log) => log.entityId).filter((id): id is string => Boolean(id))
  );

  return buildOpportunities({
    constituents,
    openTasksByConstituent,
    signalValuesByConstituent,
    dismissedOpportunityIds,
  });
}

/** Generates a stable UTC date key used for once-per-day thought persistence. */
function toUtcDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** Parses plugin config payload into a typed daily-thought record when valid. */
function parseDailyThoughtRecord(raw: unknown): DailyThoughtRecord | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const candidate = raw as Record<string, unknown>;
  const thoughtRaw = candidate.thought;
  const contextRaw = candidate.context;

  if (!thoughtRaw || typeof thoughtRaw !== "object" || Array.isArray(thoughtRaw)) return null;
  if (!contextRaw || typeof contextRaw !== "object" || Array.isArray(contextRaw)) return null;

  const thoughtCandidate = thoughtRaw as Record<string, unknown>;
  const contextCandidate = contextRaw as Record<string, unknown>;
  const sourceRaw = asString(thoughtCandidate.sourceType, "rules");

  const thought: DailyStewardThought = {
    title: asString(thoughtCandidate.title, "Today's Steward Thought").slice(0, 100),
    message: asString(thoughtCandidate.message, "").slice(0, 500),
    reason: asString(thoughtCandidate.reason, "").slice(0, 240),
    sourceType: sourceRaw === "ai" ? "ai" : "rules",
  };

  if (!thought.message) return null;

  return {
    dateKey: asString(candidate.dateKey, ""),
    generatedAt: asString(candidate.generatedAt, new Date(0).toISOString()),
    generatedByUserId: asString(candidate.generatedByUserId, "") || null,
    aiError: asString(candidate.aiError, "") || null,
    thought,
    context: {
      firstTimeDonorsThisMonth: Math.max(0, Math.round(asNumber(contextCandidate.firstTimeDonorsThisMonth, 0))),
      thankYousNeeded: Math.max(0, Math.round(asNumber(contextCandidate.thankYousNeeded, 0))),
      atRiskCount: Math.max(0, Math.round(asNumber(contextCandidate.atRiskCount, 0))),
      monthlyGivingCandidates: Math.max(0, Math.round(asNumber(contextCandidate.monthlyGivingCandidates, 0))),
      highOpportunityCount: Math.max(0, Math.round(asNumber(contextCandidate.highOpportunityCount, 0))),
    },
  };
}

/** Loads donor rows required by deterministic intelligence scoring helpers. */
async function loadStewardIntelligenceInputs(organizationId: string): Promise<StewardIntelligenceDonorInput[]> {
  const constituents = await prisma.constituent.findMany({
    where: { organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      donorStatus: true,
      giftCount: true,
      totalLifetimeGiving: true,
      lastGiftAmount: true,
      firstGiftDate: true,
      lastGiftDate: true,
      engagementScore: true,
      doNotEmail: true,
      doNotCall: true,
    },
    orderBy: [{ updatedAt: "desc" }],
    take: 4000,
  });

  return constituents.map((constituent) => ({
    id: constituent.id,
    firstName: constituent.firstName,
    lastName: constituent.lastName,
    donorStatus: constituent.donorStatus,
    giftCount: constituent.giftCount,
    totalLifetimeGiving: asNumber(constituent.totalLifetimeGiving, 0),
    lastGiftAmount: asNumber(constituent.lastGiftAmount, 0),
    firstGiftDate: constituent.firstGiftDate,
    lastGiftDate: constituent.lastGiftDate,
    engagementScore: constituent.engagementScore,
    doNotEmail: constituent.doNotEmail,
    doNotCall: constituent.doNotCall,
  }));
}

/** Computes deterministic counts used by Daily Thought fallback selection. */
async function buildDailyThoughtContext(organizationId: string, userId?: string): Promise<DailyThoughtContext> {
  await ensureStewardSignalsIndexCurrent(organizationId);

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const [opportunities, recentDonations, pendingThankYous, firstTimeDonorsThisMonth] = await Promise.all([
    loadOpportunityContext(organizationId, userId),
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
      },
      select: {
        constituentId: true,
        isRecurring: true,
      },
      take: 12000,
    }),
    prisma.task.count({
      where: {
        constituent: { organizationId },
        type: "THANK_YOU",
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
    prisma.constituent.count({
      where: {
        organizationId,
        firstGiftDate: {
          gte: monthStart,
          lt: nextMonthStart,
        },
      },
    }),
  ]);

  const donationCountByConstituent = new Map<string, { total: number; recurring: number }>();
  for (const donation of recentDonations) {
    const entry = donationCountByConstituent.get(donation.constituentId) ?? { total: 0, recurring: 0 };
    entry.total += 1;
    if (donation.isRecurring) entry.recurring += 1;
    donationCountByConstituent.set(donation.constituentId, entry);
  }

  const monthlyGivingCandidates = Array.from(donationCountByConstituent.values()).filter(
    (entry) => entry.total >= 3 && entry.recurring === 0
  ).length;

  const atRiskCount = opportunities.filter((item) => item.lapseRisk === "HIGH" || item.lapseRisk === "CRITICAL").length;
  const highOpportunityCount = opportunities.filter((item) => item.opportunityScore >= 78).length;

  return {
    firstTimeDonorsThisMonth,
    thankYousNeeded: pendingThankYous,
    atRiskCount,
    monthlyGivingCandidates,
    highOpportunityCount,
  };
}

/** Returns existing thought when fresh, otherwise computes and persists a new daily thought entry. */
async function getOrCreateDailyThought(params: {
  organizationId: string;
  userId?: string;
  forceRegenerate?: boolean;
}): Promise<DailyThoughtRecord> {
  const dateKey = toUtcDateKey();

  const existingSetting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId: params.organizationId,
        pluginKey: STEWARD_DAILY_THOUGHT_PLUGIN_KEY,
      },
    },
    select: {
      config: true,
    },
  });

  const parsedExisting = parseDailyThoughtRecord(existingSetting?.config);
  if (parsedExisting && parsedExisting.dateKey === dateKey && !params.forceRegenerate) {
    return parsedExisting;
  }

  const context = await buildDailyThoughtContext(params.organizationId, params.userId);
  const fallbackThought = buildDailyStewardThoughtFallback(context);

  let thought = fallbackThought;
  let aiError: string | null = null;

  const aiEnabled = await isStewardAiEnabled(params.organizationId);
  if (aiEnabled) {
    try {
      const setting = await prisma.pluginSetting.findUnique({
        where: {
          organizationId_pluginKey: {
            organizationId: params.organizationId,
            pluginKey: STEWARD_AI_PLUGIN_KEY,
          },
        },
        select: {
          config: true,
        },
      });

      const aiConfig = parseStewardAiConfig(setting?.config ?? {});
      const aiPrompt = [
        "Generate one concise daily stewardship thought for nonprofit fundraising staff.",
        "Return JSON only with keys: title, message, reason.",
        "Constraints: title <= 70 chars, message <= 320 chars, reason <= 180 chars.",
        "Avoid over-claiming and keep the message practical and donor-centered.",
        "Signal context:",
        `- firstTimeDonorsThisMonth: ${context.firstTimeDonorsThisMonth}`,
        `- thankYousNeeded: ${context.thankYousNeeded}`,
        `- atRiskCount: ${context.atRiskCount}`,
        `- monthlyGivingCandidates: ${context.monthlyGivingCandidates}`,
        `- highOpportunityCount: ${context.highOpportunityCount}`,
      ].join("\n");

      const aiResult = await withStewardAiTask(
        {
          organizationId: params.organizationId,
          enabled: true,
          config: aiConfig,
          label: "Generating daily stewardship thought",
          status: "thinking",
          fallbackOnError: true,
        },
        () => runStewardAiChat(
          aiConfig,
          [{ role: "user", content: aiPrompt }],
          {
            model: aiConfig.model,
            temperature: 0.22,
            maxTokens: 420,
          }
        )
      );

      thought = normalizeDailyThoughtAiResponse(aiResult.content, fallbackThought);
    } catch (error) {
      aiError = error instanceof Error ? error.message : "AI daily thought generation failed.";
    }
  }

  const generatedAt = new Date().toISOString();
  const record: DailyThoughtRecord = {
    dateKey,
    generatedAt,
    generatedByUserId: params.userId ?? null,
    thought,
    context,
    aiError,
  };

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId: params.organizationId,
        pluginKey: STEWARD_DAILY_THOUGHT_PLUGIN_KEY,
      },
    },
    create: {
      organizationId: params.organizationId,
      pluginKey: STEWARD_DAILY_THOUGHT_PLUGIN_KEY,
      enabled: true,
      config: record as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: true,
      config: record as unknown as Prisma.InputJsonValue,
    },
  });

  return record;
}

/**
 * GET /api/steward-signals/index/state
 * Returns persisted analysis index status for Steward Signals workspace.
 */
router.get("/index/state", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const fingerprint = await computeSignalsFingerprint(organizationId);
  const state = await readStewardIndexState(organizationId, fingerprint);

  res.json({
    data: {
      state: state.state,
    },
  });
});

/**
 * POST /api/steward-signals/index/rebuild
 * Manually rebuilds the Steward Signals analysis index.
 */
router.post("/index/rebuild", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const rebuild = await rebuildStewardSignalsIndex({
    organizationId,
    trigger: "manual",
  });

  await logAudit({
    action: "STEWARD_SIGNALS_ANALYSIS_REBUILT",
    entity: "PluginSetting",
    entityId: STEWARD_SIGNALS_INDEX_PLUGIN_KEY,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      trigger: "manual",
      indexedConstituentCount: rebuild.state.indexedConstituentCount,
      fingerprint: rebuild.state.fingerprint,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    data: rebuild,
  });
});

/**
 * GET /api/steward-signals/summary
 * Returns dashboard summary cards:
 * { highOpportunityDonors, atRiskCadenceBroken, monthlyGivingCandidates, thankYousNeeded, updatedAt }
 */
router.get("/summary", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      highOpportunityDonors: 0,
      atRiskCadenceBroken: 0,
      monthlyGivingCandidates: 0,
      thankYousNeeded: 0,
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const indexRefresh = await ensureStewardSignalsIndexCurrent(organizationId);

  const [opportunities, recentDonations, pendingThankYous] = await Promise.all([
    loadOpportunityContext(organizationId, req.user?.sub),
    prisma.donation.findMany({
      where: {
        constituent: { organizationId },
        status: "COMPLETED",
        date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
      },
      select: {
        constituentId: true,
        isRecurring: true,
      },
      take: 12000,
    }),
    prisma.task.count({
      where: {
        constituent: { organizationId },
        type: "THANK_YOU",
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
  ]);

  const donationCountByConstituent = new Map<string, { total: number; recurring: number }>();
  for (const donation of recentDonations) {
    const entry = donationCountByConstituent.get(donation.constituentId) ?? { total: 0, recurring: 0 };
    entry.total += 1;
    if (donation.isRecurring) entry.recurring += 1;
    donationCountByConstituent.set(donation.constituentId, entry);
  }

  const monthlyGivingCandidates = Array.from(donationCountByConstituent.values()).filter(
    (entry) => entry.total >= 3 && entry.recurring === 0
  ).length;

  const highOpportunityDonors = opportunities.filter((opp) => opp.opportunityScore >= 78).length;
  const atRiskCadenceBroken = opportunities.filter((opp) => opp.lapseRisk === "HIGH" || opp.lapseRisk === "CRITICAL").length;

  res.json({
    highOpportunityDonors,
    atRiskCadenceBroken,
    monthlyGivingCandidates,
    thankYousNeeded: pendingThankYous,
    updatedAt: indexRefresh.state.lastIndexedAt,
  });
});

/**
 * GET /api/steward-signals/daily-thought
 * Returns one persisted daily thought per organization per UTC day.
 */
router.get("/daily-thought", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  const userRole = asString(req.user?.role, "").toLowerCase();
  const canRegenerate = userRole === "admin" || userRole === "super_admin";

  if (!organizationId) {
    const fallback = buildDailyStewardThoughtFallback({
      firstTimeDonorsThisMonth: 0,
      thankYousNeeded: 0,
      atRiskCount: 0,
      monthlyGivingCandidates: 0,
      highOpportunityCount: 0,
    });

    res.json({
      thought: fallback,
      dateKey: toUtcDateKey(),
      generatedAt: new Date().toISOString(),
      context: {
        firstTimeDonorsThisMonth: 0,
        thankYousNeeded: 0,
        atRiskCount: 0,
        monthlyGivingCandidates: 0,
        highOpportunityCount: 0,
      },
      canRegenerate,
    });
    return;
  }

  const record = await getOrCreateDailyThought({
    organizationId,
    userId: req.user?.sub,
    forceRegenerate: false,
  });

  res.json({
    thought: record.thought,
    dateKey: record.dateKey,
    generatedAt: record.generatedAt,
    context: record.context,
    canRegenerate,
    ...(canRegenerate && record.aiError ? { aiError: record.aiError } : {}),
  });
});

/**
 * POST /api/steward-signals/daily-thought/regenerate
 * Admin-only forced regeneration for the daily thought card.
 */
router.post("/daily-thought/regenerate", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const record = await getOrCreateDailyThought({
    organizationId,
    userId: req.user?.sub,
    forceRegenerate: true,
  });

  await logAudit({
    action: "STEWARD_DAILY_THOUGHT_REGENERATED",
    entity: "PluginSetting",
    entityId: STEWARD_DAILY_THOUGHT_PLUGIN_KEY,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      dateKey: record.dateKey,
      sourceType: record.thought.sourceType,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    thought: record.thought,
    dateKey: record.dateKey,
    generatedAt: record.generatedAt,
    context: record.context,
    aiError: record.aiError,
  });
});

/**
 * GET /api/steward-signals/growth-ideas
 * Returns deterministic growth opportunities with explainable donor counts.
 */
router.get("/growth-ideas", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      ideas: [],
      scoringSummary: {
        averageRfm: 0,
        highPropensityWindowCount: 0,
        atRiskCount: 0,
      },
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "6", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 12) : 6;

  const donorInputs = await loadStewardIntelligenceInputs(organizationId);
  const ideas = buildGrowthIdeas(donorInputs).slice(0, limit);

  const rfmValues = donorInputs.map((item) => calculateRfmScore(item).score);
  const propensityWindowCount = donorInputs.filter((item) => calculatePropensityWindow(item).window === "0-30").length;
  const atRiskCount = donorInputs.filter((item) => {
    const risk = calculateIntelligenceLapseRisk(item).risk;
    return risk === "HIGH" || risk === "CRITICAL";
  }).length;

  const averageRfm = rfmValues.length > 0
    ? Math.round(rfmValues.reduce((total, value) => total + value, 0) / rfmValues.length)
    : 0;

  res.json({
    ideas,
    scoringSummary: {
      averageRfm,
      highPropensityWindowCount: propensityWindowCount,
      atRiskCount,
    },
    updatedAt: new Date().toISOString(),
  });
});

/**
 * GET /api/steward-signals/opportunities?limit=50
 * Returns explainable opportunity queue records for action review.
 */
router.get("/opportunities", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  await ensureStewardSignalsIndexCurrent(organizationId);

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "50", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 250) : 50;

  const opportunities = await loadOpportunityContext(organizationId, req.user?.sub);

  res.json(opportunities.slice(0, limit));
});

/**
 * GET /api/steward-signals/task-suggestions?limit=30
 * Returns deterministic, non-AI suggested stewardship tasks derived from opportunity rules.
 */
router.get("/task-suggestions", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  await ensureStewardSignalsIndexCurrent(organizationId);

  const parsedLimit = Number.parseInt((req.query.limit as string) ?? "30", 10);
  const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 150) : 30;

  const opportunities = await loadOpportunityContext(organizationId, req.user?.sub);
  const suggestions = buildTaskSuggestions(opportunities);
  res.json(suggestions.slice(0, limit));
});

/**
 * GET /api/steward-signals/lapse-radar
 * Returns lapse cohort counts and top at-risk sample records.
 */
router.get("/lapse-radar", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({
      cohorts: {
        low: 0,
        medium: 0,
        high: 0,
        critical: 0,
      },
      sample: [],
      updatedAt: new Date().toISOString(),
    });
    return;
  }

  const indexRefresh = await ensureStewardSignalsIndexCurrent(organizationId);

  const opportunities = await loadOpportunityContext(organizationId, req.user?.sub);
  const byDonor = new Map<string, OpportunityRecord>();

  for (const record of opportunities) {
    const existing = byDonor.get(record.constituentId);
    if (!existing || record.opportunityScore > existing.opportunityScore) {
      byDonor.set(record.constituentId, record);
    }
  }

  const unique = Array.from(byDonor.values());

  const cohorts = {
    low: unique.filter((item) => item.lapseRisk === "LOW").length,
    medium: unique.filter((item) => item.lapseRisk === "MEDIUM").length,
    high: unique.filter((item) => item.lapseRisk === "HIGH").length,
    critical: unique.filter((item) => item.lapseRisk === "CRITICAL").length,
  };

  const sample = unique
    .filter((item) => item.lapseRisk === "HIGH" || item.lapseRisk === "CRITICAL")
    .sort((a, b) => b.opportunityScore - a.opportunityScore)
    .slice(0, 12)
    .map((item) => ({
      constituentId: item.constituentId,
      donorName: item.donorName,
      lapseRisk: item.lapseRisk,
      reason: item.reason,
      recommendedAction: item.suggestedAction,
    }));

  res.json({
    cohorts,
    sample,
    updatedAt: indexRefresh.state.lastIndexedAt,
  });
});

/**
 * POST /api/steward-signals/email-draft
 * Generates a steward email draft artifact from explicit user form input.
 */
router.post("/email-draft", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = (req.body ?? {}) as EmailDraftStudioRequestPayload;
  const donorId = asString(payload.donorId, "").trim();

  const donor = donorId
    ? await prisma.constituent.findFirst({
      where: {
        id: donorId,
        organizationId,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        donorStatus: true,
        giftCount: true,
        totalLifetimeGiving: true,
        lastGiftAmount: true,
        doNotEmail: true,
        doNotCall: true,
        doNotMail: true,
        doNotContact: true,
      },
    })
    : null;

  if (donorId && !donor) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found for donorId." } });
    return;
  }

  const donorName = donor
    ? `${donor.firstName} ${donor.lastName}`
    : asString(payload.donorName, "").trim() || "Constituent";
  const donorFirstName = donor
    ? donor.firstName
    : asString(payload.donorFirstName, "").trim() || donorName.split(" ")[0] || "Friend";

  const studioInput: EmailDraftStudioInput = {
    donorName,
    donorFirstName,
    messageGoal: payload.messageGoal ?? "GENERAL_STEWARDSHIP",
    messageIdea: asString(payload.messageIdea, "").trim().slice(0, 1000),
    tone: payload.tone ?? "WARM",
    length: payload.length ?? "MEDIUM",
    includeGivingContext: payload.includeGivingContext ?? true,
    includeCampaignContext: payload.includeCampaignContext ?? false,
    includeMinistryImpact: payload.includeMinistryImpact ?? true,
    callToAction: asString(payload.callToAction, "").trim().slice(0, 360),
    signature: asString(payload.signature, "With gratitude,\n[Your Name]").trim().slice(0, 260),
  };

  let artifact = buildDeterministicEmailDraft(studioInput);
  const warningSet = new Set<string>(artifact.warnings);
  if (donor?.doNotEmail || donor?.doNotContact) {
    warningSet.add("Do not email flag is active for this donor. Use non-email outreach unless overridden by policy.");
  }
  if (donor?.doNotCall) {
    warningSet.add("Phone outreach restriction is active for this donor.");
  }
  if (donor?.doNotMail) {
    warningSet.add("Mail outreach restriction is active for this donor.");
  }

  let aiUsed = false;
  let aiError: string | null = null;

  if (payload.useAi) {
    const aiEnabled = await isStewardAiEnabled(organizationId);
    if (aiEnabled) {
      try {
        const setting = await prisma.pluginSetting.findUnique({
          where: {
            organizationId_pluginKey: {
              organizationId,
              pluginKey: STEWARD_AI_PLUGIN_KEY,
            },
          },
          select: {
            config: true,
          },
        });

        const aiConfig = parseStewardAiConfig(setting?.config ?? {});

        const aiPrompt = [
          "You are drafting a nonprofit donor outreach email for staff review.",
          "Return JSON only with keys: subject, previewText, bodyMarkdown, bodyPlainText, bodyHtml, warnings.",
          "Respect communication preferences and do not claim actions already completed.",
          `Donor name: ${studioInput.donorName}`,
          `Goal: ${studioInput.messageGoal}`,
          `Tone: ${studioInput.tone}`,
          `Length: ${studioInput.length}`,
          `Message idea: ${studioInput.messageIdea || "(none supplied)"}`,
          `Call to action: ${studioInput.callToAction || "(none supplied)"}`,
          `Include giving context: ${studioInput.includeGivingContext}`,
          `Include campaign context: ${studioInput.includeCampaignContext}`,
          `Include ministry impact: ${studioInput.includeMinistryImpact}`,
          `Draft signature: ${studioInput.signature}`,
        ].join("\n");

        const aiResult = await withStewardAiTask(
          {
            organizationId,
            enabled: true,
            config: aiConfig,
            label: "Generating donor email draft",
            status: "running_task",
            fallbackOnError: true,
          },
          () => runStewardAiChat(
            aiConfig,
            [{ role: "user", content: aiPrompt }],
            {
              model: aiConfig.model,
              temperature: 0.24,
              maxTokens: 1300,
            }
          )
        );

        artifact = parseStudioAiDraft(aiResult.content, artifact);
        warningSet.add("AI-generated draft. Human review required before send.");
        aiUsed = true;
      } catch (error) {
        aiError = error instanceof Error ? error.message : "AI draft generation failed.";
      }
    } else {
      aiError = "AI is disabled in settings. Generated deterministic draft instead.";
    }
  }

  artifact = {
    ...artifact,
    warnings: Array.from(warningSet).slice(0, 10),
  };

  let draft: { id: string; name: string; status: string; updatedAt: Date } | null = null;
  if (payload.saveAsDraft) {
    const [organization, settings] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      prisma.organizationSettings.findUnique({
        where: { organizationId },
        select: { smtpFromName: true, smtpFromEmail: true },
      }),
    ]);

    draft = await prisma.emailCampaign.create({
      data: {
        organizationId,
        name: `Steward Studio Draft: ${donorName}`,
        subject: artifact.subject,
        previewText: artifact.previewText,
        fromName: settings?.smtpFromName || organization?.name || "OyamaCRM Steward",
        fromEmail: settings?.smtpFromEmail || "noreply@oyamacrm.org",
        replyToEmail: settings?.smtpFromEmail || "support@oyamacrm.org",
        bodyHtml: artifact.bodyHtml,
        bodyText: artifact.bodyPlainText,
        audienceFilter: JSON.stringify({
          source: "steward-signals-email-studio",
          constituentIds: donor?.id ? [donor.id] : [],
          donorName,
        }),
        status: "DRAFT",
      },
      select: {
        id: true,
        name: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  await logAudit({
    action: "STEWARD_EMAIL_STUDIO_DRAFT_GENERATED",
    entity: "StewardEmailDraft",
    entityId: donor?.id ?? donorName,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      donorId: donor?.id ?? null,
      messageGoal: studioInput.messageGoal,
      aiUsed,
      savedAsDraft: Boolean(draft),
      aiError,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(draft ? 201 : 200).json({
    artifact,
    donor: donor
      ? {
        id: donor.id,
        name: donorName,
        email: donor.email,
      }
      : {
        id: null,
        name: donorName,
        email: null,
      },
    aiUsed,
    aiError,
    draft,
  });
});

/**
 * POST /api/steward-signals/email-draft/save
 * Persists an existing reviewed draft artifact as an EmailCampaign draft.
 */
router.post("/email-draft/save", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) {
    res.status(400).json({
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Saving a draft requires explicit confirmation with { confirm: true }.",
      },
    });
    return;
  }

  const donorId = asString(req.body?.donorId, "").trim();
  const donorName = asString(req.body?.donorName, "").trim() || "Constituent";
  const subject = asString(req.body?.subject, "").trim().slice(0, 240);
  const previewText = asString(req.body?.previewText, "").trim().slice(0, 240);
  const bodyPlainText = asString(req.body?.bodyPlainText, asString(req.body?.bodyMarkdown, "")).trim();
  const bodyHtml = asString(req.body?.bodyHtml, bodyTextToHtml(bodyPlainText)).trim();

  if (!subject || !bodyPlainText) {
    res.status(400).json({
      error: {
        code: "INVALID_DRAFT",
        message: "Subject and body content are required to save an email draft.",
      },
    });
    return;
  }

  const [organization, settings] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
    prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: { smtpFromName: true, smtpFromEmail: true },
    }),
  ]);

  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: `Steward Studio Draft: ${donorName}`,
      subject,
      previewText,
      fromName: settings?.smtpFromName || organization?.name || "OyamaCRM Steward",
      fromEmail: settings?.smtpFromEmail || "noreply@oyamacrm.org",
      replyToEmail: settings?.smtpFromEmail || "support@oyamacrm.org",
      bodyHtml,
      bodyText: bodyPlainText,
      audienceFilter: JSON.stringify({
        source: "steward-signals-email-studio-save",
        constituentIds: donorId ? [donorId] : [],
        donorName,
      }),
      status: "DRAFT",
    },
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      updatedAt: true,
    },
  });

  await logAudit({
    action: "STEWARD_EMAIL_STUDIO_DRAFT_SAVED",
    entity: "EmailCampaign",
    entityId: campaign.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      donorId: donorId || null,
      donorName,
      source: "api/steward-signals/email-draft/save",
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({
    success: true,
    draft: campaign,
    message: "Email draft saved for review.",
  });
});

/**
 * POST /api/steward-signals/email-draft/create-follow-up-task
 * Creates a follow-up task tied to a donor from Email Draft Studio.
 */
router.post("/email-draft/create-follow-up-task", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) {
    res.status(400).json({
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Creating follow-up tasks requires { confirm: true }.",
      },
    });
    return;
  }

  const donorId = asString(req.body?.donorId, "").trim();
  if (!donorId) {
    res.status(400).json({ error: { code: "DONOR_REQUIRED", message: "donorId is required." } });
    return;
  }

  const donor = await prisma.constituent.findFirst({
    where: {
      id: donorId,
      organizationId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!donor) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found." } });
    return;
  }

  const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const title = asString(req.body?.title, `${donor.firstName} ${donor.lastName}: Steward follow-up`).slice(0, 220);
  const note = asString(req.body?.note, "Follow up after draft review and choose outreach channel.").slice(0, 1400);

  const task = await prisma.task.create({
    data: {
      constituentId: donor.id,
      assigneeId: req.user?.sub,
      createdById: req.user?.sub,
      title,
      description: note,
      type: "FOLLOW_UP",
      status: "PENDING",
      priority: "MEDIUM",
      dueDate,
    },
    select: {
      id: true,
      title: true,
      status: true,
      priority: true,
      dueDate: true,
    },
  });

  await prisma.activity.create({
    data: {
      constituentId: donor.id,
      taskId: task.id,
      userId: req.user?.sub,
      type: "NOTE",
      description: "Email Draft Studio created a follow-up task.",
      metadata: {
        source: "api/steward-signals/email-draft/create-follow-up-task",
      },
    },
  });

  await logAudit({
    action: "STEWARD_EMAIL_STUDIO_TASK_CREATED",
    entity: "Task",
    entityId: task.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      donorId: donor.id,
      source: "api/steward-signals/email-draft/create-follow-up-task",
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({
    success: true,
    task,
    message: "Follow-up task created.",
  });
});

/**
 * GET /api/steward-signals/donors/:id/widget
 * Returns donor-profile widget data for Steward Signals:
 * { generosityScore, lapseRisk, opportunityScore, bestNextStep, bestChannel, confidence, explanation, ... }
 */
router.get("/donors/:id/widget", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  await ensureStewardSignalsIndexCurrent(organizationId);

  const constituentId = req.params.id as string;

  const constituent = await prisma.constituent.findFirst({
    where: {
      id: constituentId,
      organizationId,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      donorStatus: true,
      giftCount: true,
      lastGiftDate: true,
      lastGiftAmount: true,
      totalLifetimeGiving: true,
      engagementScore: true,
      doNotEmail: true,
      doNotCall: true,
    },
  });

  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found." } });
    return;
  }

  const [fieldIds, opportunities] = await Promise.all([
    loadStewardFieldIds(organizationId),
    loadOpportunityContext(organizationId, req.user?.sub),
  ]);
  const signalValues = await loadSignalValues([constituent.id], fieldIds);
  const signal = signalValues.get(constituent.id) ?? {};
  const liveOpportunity = opportunities.find((item) => item.constituentId === constituent.id);
  const daysFromLastGift = daysSince(constituent.lastGiftDate);

  const generosityScore = deriveGenerosityScore({
    customGenerosityScore: signal.demoStewardGenerosityScore,
    donorStatus: constituent.donorStatus,
    totalLifetimeGiving: constituent.totalLifetimeGiving,
    giftCount: constituent.giftCount,
    engagementScore: constituent.engagementScore,
  });

  const opportunityScore = deriveOpportunityScore({
    customOpportunityScore: signal.demoStewardOpportunityScore,
    donorStatus: constituent.donorStatus,
    giftCount: constituent.giftCount,
    engagementScore: constituent.engagementScore,
    lastGiftAmount: constituent.lastGiftAmount,
    lastGiftDate: constituent.lastGiftDate,
  });

  const lapseRisk = deriveLapseRisk(constituent.donorStatus, constituent.lastGiftDate, signal.demoStewardLapseRisk);

  const bestChannel = liveOpportunity?.channel
    ?? "Monitor";
  const bestNextStep = liveOpportunity?.suggestedAction
    ?? "No urgent stewardship task is due right now. Continue normal cadence monitoring.";

  const response: StewardWidgetResponse = {
    constituentId: constituent.id,
    donorName: `${constituent.firstName} ${constituent.lastName}`,
    generosityScore,
    opportunityScore,
    lapseRisk,
    bestNextStep,
    bestChannel,
    confidence: liveOpportunity?.confidence ?? Math.max(55, Math.min(98, Math.round((generosityScore + opportunityScore) / 2))),
    explanation: liveOpportunity
      ? `Live recommendation reason: ${liveOpportunity.reason}`
      : `No active trigger right now: gift count ${constituent.giftCount}, last gift ${daysFromLastGift} days ago, lapse risk ${lapseRisk}.`,
    lastGiftDate: constituent.lastGiftDate ? constituent.lastGiftDate.toISOString() : null,
    lastGiftAmount: asNumber(constituent.lastGiftAmount, 0),
    totalLifetimeGiving: asNumber(constituent.totalLifetimeGiving, 0),
    giftCount: constituent.giftCount,
    inDevelopmentNote: "Recommendations are rules-based (non-AI) and action endpoints are confirm-first.",
  };

  res.json(response);
});

/**
 * POST /api/steward-signals/opportunities/:id/create-task
 * Confirm-first action endpoint.
 * Body: { confirm: true, assigneeId?: string, dueDate?: string }
 */
router.post("/opportunities/:id/create-task", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const aiEnabled = await isStewardAiEnabled(organizationId);
  if (!aiEnabled) {
    res.status(412).json({
      error: {
        code: "AI_NOT_ENABLED",
        message: "Opportunity Engine is paused until AI is enabled in Settings > AI Assistant.",
      },
    });
    return;
  }

  const parsed = parseOpportunityId(req.params.id as string);
  if (!parsed) {
    res.status(400).json({ error: { code: "INVALID_OPPORTUNITY", message: "Invalid opportunity id format." } });
    return;
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) {
    res.status(400).json({
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Action requires explicit confirmation. Re-submit with { confirm: true }.",
      },
    });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: parsed.constituentId, organizationId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found for opportunity." } });
    return;
  }

  const dueDate = req.body?.dueDate ? new Date(req.body.dueDate) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const assigneeId = asString(req.body?.assigneeId, req.user?.sub ?? "") || undefined;

  const task = await prisma.task.create({
    data: {
      constituentId: constituent.id,
      assigneeId,
      createdById: req.user?.sub,
      title: `${constituent.firstName} ${constituent.lastName}: Steward opportunity follow-up`,
      description: `Opportunity ${parsed.kind} triggered from Steward Signals. ${req.body?.note ? String(req.body.note) : ""}`.trim(),
      type: parsed.kind === "second-gift" ? "THANK_YOU" : "FOLLOW_UP",
      status: "PENDING",
      priority: parsed.kind === "major-stewardship" ? "HIGH" : "MEDIUM",
      dueDate,
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      status: true,
      priority: true,
    },
  });

  await prisma.activity.create({
    data: {
      constituentId: constituent.id,
      taskId: task.id,
      userId: req.user?.sub,
      type: "NOTE",
      description: `Steward Signals created task from opportunity ${parsed.kind}.`,
      metadata: {
        source: "api/steward-signals/opportunities/create-task",
        opportunityId: req.params.id,
      },
    },
  });

  await logAudit({
    action: "STEWARD_OPPORTUNITY_TASK_CREATED",
    entity: "Task",
    entityId: task.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      opportunityId: req.params.id,
      constituentId: constituent.id,
      kind: parsed.kind,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  await ensureStewardSignalsIndexCurrent(organizationId);

  res.status(201).json({
    success: true,
    task,
    message: "Task created from opportunity with explicit confirmation.",
  });
});

/**
 * POST /api/steward-signals/opportunities/:id/draft-email
 * Confirm-first action endpoint.
 * Body: { confirm: true }
 */
router.post("/opportunities/:id/draft-email", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const aiEnabled = await isStewardAiEnabled(organizationId);
  if (!aiEnabled) {
    res.status(412).json({
      error: {
        code: "AI_NOT_ENABLED",
        message: "Opportunity Engine is paused until AI is enabled in Settings > AI Assistant.",
      },
    });
    return;
  }

  const parsed = parseOpportunityId(req.params.id as string);
  if (!parsed) {
    res.status(400).json({ error: { code: "INVALID_OPPORTUNITY", message: "Invalid opportunity id format." } });
    return;
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) {
    res.status(400).json({
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Action requires explicit confirmation. Re-submit with { confirm: true }.",
      },
    });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: parsed.constituentId, organizationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      donorStatus: true,
      giftCount: true,
      lastGiftDate: true,
      lastGiftAmount: true,
      totalLifetimeGiving: true,
      doNotEmail: true,
      doNotCall: true,
      doNotMail: true,
    },
  });
  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found for opportunity." } });
    return;
  }

  const [aiSetting, recentDonations, openTaskCount] = await Promise.all([
    prisma.pluginSetting.findUnique({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: STEWARD_AI_PLUGIN_KEY,
        },
      },
      select: {
        config: true,
      },
    }),
    prisma.donation.findMany({
      where: {
        constituentId: constituent.id,
        status: "COMPLETED",
      },
      select: {
        amount: true,
        date: true,
        campaign: { select: { name: true } },
      },
      orderBy: { date: "desc" },
      take: 5,
    }),
    prisma.task.count({
      where: {
        constituentId: constituent.id,
        status: { in: ["PENDING", "IN_PROGRESS"] },
      },
    }),
  ]);

  const aiConfig = parseStewardAiConfig(aiSetting?.config ?? {});
  const opportunityLabel = opportunityKindLabel(parsed.kind);
  const channelHint = constituent.doNotEmail
    ? (constituent.doNotCall ? "mail-first" : "phone-first")
    : "email-first";

  const donationHistoryLines = recentDonations.length > 0
    ? recentDonations.map((donation) =>
      `- ${donation.date.toISOString().slice(0, 10)}: $${asNumber(donation.amount, 0).toLocaleString()}${donation.campaign?.name ? ` (${donation.campaign.name})` : ""}`
    ).join("\n")
    : "- No completed donations in recent history.";

  const draftPrompt = [
    "You are Steward AI generating a nonprofit donor outreach draft for internal review.",
    "Return JSON only with keys: subject, previewText, bodyText.",
    "Constraints:",
    "- Keep donor-first gratitude tone, specific but not over-claiming impact.",
    "- Body text must be plain text with short paragraphs.",
    "- Do not claim any action already happened.",
    "- Keep subject under 80 chars and preview under 140 chars.",
    "Context:",
    `Donor: ${constituent.firstName} ${constituent.lastName}`,
    `Opportunity: ${opportunityLabel}`,
    `Donor status: ${constituent.donorStatus}`,
    `Gift count: ${constituent.giftCount}`,
    `Lifetime giving: $${asNumber(constituent.totalLifetimeGiving, 0).toLocaleString()}`,
    `Last gift date: ${constituent.lastGiftDate ? constituent.lastGiftDate.toISOString().slice(0, 10) : "unknown"}`,
    `Last gift amount: $${asNumber(constituent.lastGiftAmount, 0).toLocaleString()}`,
    `Open stewardship tasks: ${openTaskCount}`,
    `Communication constraints: doNotEmail=${constituent.doNotEmail}; doNotCall=${constituent.doNotCall}; doNotMail=${constituent.doNotMail}; preferred=${channelHint}`,
    "Recent donations:",
    donationHistoryLines,
  ].join("\n");

  let generatedDraft = parseGeneratedDraft("", constituent.firstName);
  let aiGenerated = false;
  let aiModelUsed: string | null = null;
  let aiGenerationError: string | null = null;

  try {
    const aiResult = await withStewardAiTask(
      {
        organizationId,
        enabled: true,
        config: aiConfig,
        label: "Drafting opportunity email recommendation",
        status: "running_task",
        fallbackOnError: true,
      },
      () => runStewardAiChat(
        aiConfig,
        [{ role: "user", content: draftPrompt }],
        {
          model: aiConfig.model,
          temperature: 0.28,
          maxTokens: 900,
        }
      )
    );
    generatedDraft = parseGeneratedDraft(aiResult.content, constituent.firstName);
    aiGenerated = true;
    aiModelUsed = aiResult.model;
  } catch (error) {
    aiGenerationError = error instanceof Error ? error.message : "AI generation failed.";
  }

  const campaign = await prisma.emailCampaign.create({
    data: {
      organizationId,
      name: `Steward Draft: ${constituent.firstName} ${constituent.lastName}`,
      subject: generatedDraft.subject,
      previewText: generatedDraft.previewText,
      fromName: "OyamaCRM Steward",
      fromEmail: "noreply@oyamacrm.org",
      replyToEmail: "support@oyamacrm.org",
      bodyHtml: bodyTextToHtml(generatedDraft.bodyText),
      bodyText: generatedDraft.bodyText,
      audienceFilter: JSON.stringify({ constituentIds: [constituent.id], source: "steward-signals" }),
      status: "DRAFT",
    },
    select: {
      id: true,
      name: true,
      subject: true,
      status: true,
      updatedAt: true,
    },
  });

  await logAudit({
    action: "STEWARD_OPPORTUNITY_EMAIL_DRAFTED",
    entity: "EmailCampaign",
    entityId: campaign.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      opportunityId: req.params.id,
      constituentId: constituent.id,
      kind: parsed.kind,
      aiGenerated,
      aiModelUsed,
      aiGenerationError,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  await ensureStewardSignalsIndexCurrent(organizationId);

  res.status(201).json({
    success: true,
    draft: campaign,
    message: aiGenerated
      ? "AI-generated email draft created from opportunity with explicit confirmation."
      : "Draft email created with fallback template after AI generation issue.",
  });
});

/**
 * POST /api/steward-signals/opportunities/:id/dismiss
 * Confirm-first action endpoint.
 * Body: { confirm: true, reason?: string }
 */
router.post("/opportunities/:id/dismiss", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const aiEnabled = await isStewardAiEnabled(organizationId);
  if (!aiEnabled) {
    res.status(412).json({
      error: {
        code: "AI_NOT_ENABLED",
        message: "Opportunity Engine is paused until AI is enabled in Settings > AI Assistant.",
      },
    });
    return;
  }

  const parsed = parseOpportunityId(req.params.id as string);
  if (!parsed) {
    res.status(400).json({ error: { code: "INVALID_OPPORTUNITY", message: "Invalid opportunity id format." } });
    return;
  }

  const confirm = req.body?.confirm === true;
  if (!confirm) {
    res.status(400).json({
      error: {
        code: "CONFIRMATION_REQUIRED",
        message: "Action requires explicit confirmation. Re-submit with { confirm: true }.",
      },
    });
    return;
  }

  await logAudit({
    action: "STEWARD_OPPORTUNITY_DISMISSED",
    entity: "Opportunity",
    entityId: req.params.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      kind: parsed.kind,
      constituentId: parsed.constituentId,
      reason: asString(req.body?.reason, "No reason supplied"),
      source: "api/steward-signals/opportunities/dismiss",
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    success: true,
    dismissed: true,
    opportunityId: req.params.id,
  });
});

export default router;
