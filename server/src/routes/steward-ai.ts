/** Steward AI API routes for config, health test, and chat completion. */
import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import {
  defaultStewardAiConfig,
  listStewardAiModels,
  parseStewardAiConfig,
  runStewardAiChat,
  runStewardAiChatStream,
  testStewardAiConnection,
  type StewardAiChatMessage,
  type StewardAiMode,
  type StewardAiReasoningMode,
} from "../services/steward-ai-ollama.js";
import {
  getStewardAiRuntimeState,
  recordStewardAiConnectionError,
  recordStewardAiConnectionSuccess,
  refreshStewardAiRuntimeState,
  withStewardAiTask,
} from "../services/steward-ai-runtime-status.js";
import {
  buildDonorToolContextForChat,
  executeStewardTool,
  listStewardTools,
  StewardToolError,
  type StewardToolExecutionContext,
} from "../services/steward-tool-registry.js";
import { fmtDate } from "../services/steward-donor-context.js";
import type { Prisma } from "@prisma/client";
import type { Router as ExpressRouter } from "express";

const router: ExpressRouter = Router();
const STEWARD_AI_PLUGIN_KEY = "steward_ai";

// Steward AI endpoints require authenticated users.
router.use(requireAuth);

interface StewardAiConfigResponse {
  enabled: boolean;
  mode: StewardAiMode;
  endpointUrl: string;
  model: string;
  thinkingModel: string;
  reasoningMode: StewardAiReasoningMode;
  agenticMultiStage: boolean;
  chatHeadEnabled: boolean;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  systemPrompt: string;
  hasApiKey: boolean;
}

interface StewardAiUpdatePayload {
  enabled?: boolean;
  mode?: StewardAiMode;
  endpointUrl?: string;
  model?: string;
  thinkingModel?: string;
  reasoningMode?: StewardAiReasoningMode;
  agenticMultiStage?: boolean;
  chatHeadEnabled?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
  apiKey?: string;
}

interface StewardAiModelsQuery {
  endpointUrl?: string;
}

interface StewardAiStatusQuery {
  force?: string;
}

interface BridgePairingRequestPayload {
  siteUrl?: string;
}

type ReadinessStatus = "Working" | "Partially Working" | "Broken";

interface BridgeReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

interface BridgeReadinessPayload {
  status: ReadinessStatus;
  summary: string;
  checks: BridgeReadinessCheck[];
  testedAt: string;
}

interface BridgePairingKeyPayload {
  version: 1;
  kind: "oyama.bridge.pairing";
  generatedAt: string;
  expiresAt: string;
  organizationId: string;
  organizationName: string;
  bridgeConfig: {
    bridgeAutostart: boolean;
    bridgeUpstreamUrl: string;
    bridgePort: number;
    bridgeApiKey: string;
    bridgeAllowedOrigins: string;
    bridgePublicBaseUrl: string;
    bridgeDomainUrl: string;
    bridgeModel: string;
    bridgeThinkingModel: string;
    bridgeCudaDevice: string;
    bridgeTemperature: number;
    bridgeTimeoutMs: number;
  };
  aiHints: {
    mode: "remote";
    endpointUrl: string;
    model: string;
    thinkingModel: string;
  };
}

interface StewardAiChatPayload {
  messages?: StewardAiChatMessage[];
  mode?: "ask" | "analyze" | "draft" | "action" | "help";
  moduleKey?: "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "oshareview";
  scopePath?: string;
  /** @mention-locked donors from the chat composer. Each entry provides a constituentId to load a full profile for. */
  donorContext?: Array<{ id?: string; name?: string }>;
  /** Reporting year mode set in the chat composer FY toggle. */
  reportingYearMode?: "calendar" | "fiscal";
  /** The fiscal year number the user has locked to (e.g. 2026). */
  fiscalYear?: number;
  /** Org fiscal year start month (1-12). */
  fiscalYearStart?: number;
}

interface StewardToolListQuery {
  moduleKey?: "donor" | "oshareview";
  scopePath?: string;
}

interface StewardToolExecutePayload {
  tool?: string;
  input?: Record<string, unknown>;
  confirm?: boolean;
  moduleKey?: "donor" | "oshareview";
  scopePath?: string;
}

type StewardChatMode = NonNullable<StewardAiChatPayload["mode"]>;

interface StewardContextResult {
  contextText: string;
  toolsUsed: string[];
  recordsUsed: string[];
}

interface TopDonorResult {
  reply: string;
  toolsUsed: string[];
  recordsUsed: string[];
}

interface AgenticPreparationResult {
  reasoningModel: string;
  stageSummaries: string[];
  toolsUsed: string[];
}

type StewardArtifactType =
  | "email_draft"
  | "donor_list"
  | "report_summary"
  | "task_list"
  | "call_script"
  | "csv_rows"
  | "report_card"
  | "chart";

interface StewardSuggestedActionPayload {
  label: string;
  actionType: string;
  requiresConfirmation: boolean;
  payload?: Record<string, string | number | boolean | null>;
}

interface StewardEvidencePayload {
  label: string;
  detail?: string;
}

interface StewardStructuredResponsePayload {
  version: 1;
  replyMarkdown: string;
  artifacts: Array<Record<string, unknown>>;
  suggestedActions: StewardSuggestedActionPayload[];
  evidence: StewardEvidencePayload[];
  parseWarning?: string;
}

const ALLOWED_STEWARD_ARTIFACT_TYPES = new Set<StewardArtifactType>([
  "email_draft",
  "donor_list",
  "report_summary",
  "task_list",
  "call_script",
  "csv_rows",
  "report_card",
  "chart",
]);

const ALLOWED_SUGGESTED_ACTION_TYPES = new Set<string>([
  "open_report",
  "open_donor",
  "copy",
  "copy_donor_list",
  "copy_csv",
  "prepare_steward_loop",
  "communications.create_email_draft",
  "tasks.create_follow_up_task",
  "letters.create_letter_draft",
]);

function asSafeText(value: unknown, fallback = "", maxLength = 4000): string {
  if (typeof value !== "string") return fallback;
  return value.trim().slice(0, maxLength);
}

function sanitizeArtifactRows(rawRows: unknown): Array<Record<string, string | number | null>> {
  if (!Array.isArray(rawRows)) return [];

  return rawRows
    .slice(0, 120)
    .map((row) => {
      if (!row || typeof row !== "object" || Array.isArray(row)) return null;

      const normalized: Record<string, string | number | null> = {};
      for (const [key, value] of Object.entries(row as Record<string, unknown>).slice(0, 14)) {
        const safeKey = String(key || "").trim().slice(0, 80);
        if (!safeKey) continue;

        if (value == null) {
          normalized[safeKey] = null;
          continue;
        }

        if (typeof value === "number" && Number.isFinite(value)) {
          normalized[safeKey] = value;
          continue;
        }

        normalized[safeKey] = String(value).slice(0, 400);
      }

      return Object.keys(normalized).length > 0 ? normalized : null;
    })
    .filter((entry): entry is Record<string, string | number | null> => Boolean(entry));
}

function sanitizeActionPayload(rawPayload: unknown): Record<string, string | number | boolean | null> | undefined {
  if (!rawPayload || typeof rawPayload !== "object" || Array.isArray(rawPayload)) {
    return undefined;
  }

  const entries = Object.entries(rawPayload as Record<string, unknown>).slice(0, 20);
  if (entries.length === 0) return undefined;

  const sanitized: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of entries) {
    const safeKey = asSafeText(key, "", 80);
    if (!safeKey) continue;

    if (value == null) {
      sanitized[safeKey] = null;
      continue;
    }

    if (typeof value === "boolean") {
      sanitized[safeKey] = value;
      continue;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      sanitized[safeKey] = value;
      continue;
    }

    sanitized[safeKey] = asSafeText(value, "", 300);
  }

  return Object.keys(sanitized).length > 0 ? sanitized : undefined;
}

function sanitizeArtifact(rawArtifact: unknown): Record<string, unknown> | null {
  if (!rawArtifact || typeof rawArtifact !== "object" || Array.isArray(rawArtifact)) return null;
  const candidate = rawArtifact as Record<string, unknown>;
  const rawType = asSafeText(candidate.type, "", 80) as StewardArtifactType;

  if (!ALLOWED_STEWARD_ARTIFACT_TYPES.has(rawType)) return null;

  const sanitized: Record<string, unknown> = {
    type: rawType,
    title: asSafeText(candidate.title, "", 140),
    description: asSafeText(candidate.description, "", 500),
  };

  if (rawType === "email_draft") {
    sanitized.subject = asSafeText(candidate.subject, "", 240);
    sanitized.previewText = asSafeText(candidate.previewText, "", 260);
    const bodyPlainText = asSafeText(candidate.bodyPlainText, asSafeText(candidate.body, "", 8000), 8000);
    const bodyMarkdown = asSafeText(candidate.bodyMarkdown, bodyPlainText, 8000);
    const bodyHtml = asSafeText(candidate.bodyHtml, "", 12000);
    sanitized.body = bodyPlainText;
    sanitized.bodyPlainText = bodyPlainText;
    sanitized.bodyMarkdown = bodyMarkdown;
    sanitized.bodyHtml = bodyHtml;
    sanitized.audience = asSafeText(candidate.audience, "", 220);
    sanitized.warnings = Array.isArray(candidate.warnings)
      ? candidate.warnings.map((warning) => asSafeText(warning, "", 240)).filter(Boolean).slice(0, 10)
      : [];
    if (!sanitized.subject || !bodyPlainText) return null;
  }

  if (rawType === "donor_list" || rawType === "csv_rows") {
    sanitized.columns = Array.isArray(candidate.columns)
      ? candidate.columns.map((column) => asSafeText(column, "", 80)).filter(Boolean).slice(0, 14)
      : [];
    sanitized.rows = sanitizeArtifactRows(candidate.rows);
    sanitized.fileName = asSafeText(candidate.fileName, "", 120);
    if (!Array.isArray(sanitized.rows) || sanitized.rows.length === 0) return null;
  }

  if (rawType === "report_summary") {
    sanitized.headline = asSafeText(candidate.headline, "", 220);
    sanitized.boardSummary = asSafeText(candidate.boardSummary, "", 8000);
    sanitized.keyMetrics = Array.isArray(candidate.keyMetrics)
      ? candidate.keyMetrics.map((item) => asSafeText(item, "", 240)).filter(Boolean).slice(0, 12)
      : [];
    sanitized.risks = Array.isArray(candidate.risks)
      ? candidate.risks.map((item) => asSafeText(item, "", 240)).filter(Boolean).slice(0, 12)
      : [];
    sanitized.opportunities = Array.isArray(candidate.opportunities)
      ? candidate.opportunities.map((item) => asSafeText(item, "", 240)).filter(Boolean).slice(0, 12)
      : [];
  }

  if (rawType === "task_list") {
    const tasks = Array.isArray(candidate.tasks)
      ? candidate.tasks
        .map((task) => {
          if (!task || typeof task !== "object" || Array.isArray(task)) return null;
          const rawTask = task as Record<string, unknown>;
          const title = asSafeText(rawTask.title, "", 220);
          if (!title) return null;
          return {
            title,
            priority: asSafeText(rawTask.priority, "", 80),
            dueDate: asSafeText(rawTask.dueDate, "", 80),
            donorName: asSafeText(rawTask.donorName, "", 140),
          };
        })
        .filter((task): task is { title: string; priority: string; dueDate: string; donorName: string } => Boolean(task))
        .slice(0, 25)
      : [];

    if (tasks.length === 0) return null;
    sanitized.tasks = tasks;
  }

  if (rawType === "call_script") {
    sanitized.openingLine = asSafeText(candidate.openingLine, "", 400);
    sanitized.donorContext = asSafeText(candidate.donorContext, "", 600);
    sanitized.talkingPoints = Array.isArray(candidate.talkingPoints)
      ? candidate.talkingPoints.map((item) => asSafeText(item, "", 300)).filter(Boolean).slice(0, 12)
      : [];
    sanitized.nextStep = asSafeText(candidate.nextStep, "", 280);
  }

  if (rawType === "report_card") {
    sanitized.fiscalYearLabel = asSafeText(candidate.fiscalYearLabel, "", 60);
    sanitized.deepLink = asSafeText(candidate.deepLink, "", 120);
    sanitized.deepLinkLabel = asSafeText(candidate.deepLinkLabel, "", 80);
    const rawMetrics = Array.isArray(candidate.metrics) ? candidate.metrics : [];
    sanitized.metrics = rawMetrics
      .map((m) => {
        if (!m || typeof m !== "object" || Array.isArray(m)) return null;
        const rm = m as Record<string, unknown>;
        const label = asSafeText(rm.label, "", 80);
        const value = asSafeText(rm.value, "", 80);
        if (!label || !value) return null;
        const trend = asSafeText(rm.trend, "", 10) as "up" | "down" | "flat" | "";
        return {
          label,
          value,
          delta: asSafeText(rm.delta, "", 60),
          trend: trend || undefined,
        };
      })
      .filter(Boolean)
      .slice(0, 10);
    if (candidate.chartData && typeof candidate.chartData === "object" && !Array.isArray(candidate.chartData)) {
      const cd = candidate.chartData as Record<string, unknown>;
      const cdLabels = Array.isArray(cd.labels) ? cd.labels.map((l) => asSafeText(l, "", 20)).filter(Boolean).slice(0, 36) : [];
      const cdValues = Array.isArray(cd.values) ? cd.values.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)).slice(0, 36) : [];
      if (cdLabels.length > 0 && cdValues.length > 0) sanitized.chartData = { labels: cdLabels, values: cdValues };
    }
  }

  if (rawType === "chart") {
    const rawChartType = asSafeText(candidate.chartType, "bar", 12);
    const validChartTypes = new Set(["bar", "line", "pie", "donut", "stacked_bar"]);
    sanitized.chartType = validChartTypes.has(rawChartType) ? rawChartType : "bar";
    sanitized.labels = Array.isArray(candidate.labels)
      ? candidate.labels.map((l) => asSafeText(l, "", 30)).filter(Boolean).slice(0, 36)
      : [];
    sanitized.yAxisPrefix = asSafeText(candidate.yAxisPrefix, "", 10);
    sanitized.yAxisLabel = asSafeText(candidate.yAxisLabel, "", 60);
    const rawSeries = Array.isArray(candidate.series) ? candidate.series : [];
    sanitized.series = rawSeries
      .map((s) => {
        if (!s || typeof s !== "object" || Array.isArray(s)) return null;
        const rs = s as Record<string, unknown>;
        const name = asSafeText(rs.name, "Series", 80);
        const data = Array.isArray(rs.data)
          ? rs.data.map((v) => (typeof v === "number" && Number.isFinite(v) ? v : 0)).slice(0, 36)
          : [];
        if (data.length === 0) return null;
        return { name, color: asSafeText(rs.color, "", 30) || undefined, data };
      })
      .filter(Boolean)
      .slice(0, 6);
    // pie/donut only need at least 1 data series; bar/line/stacked_bar need labels too
    const needsLabels = sanitized.chartType === "bar" || sanitized.chartType === "line" || sanitized.chartType === "stacked_bar";
    if (needsLabels && (!Array.isArray(sanitized.labels) || (sanitized.labels as string[]).length === 0)) return null;
    if (!Array.isArray(sanitized.series) || (sanitized.series as unknown[]).length === 0) return null;
  }

  return sanitized;
}

function extractStewardArtifacts(rawText: string): { replyMarkdown: string; artifactsJson: string | null } {
  const blockRegex = /```steward-artifacts\s*([\s\S]*?)```/i;
  const match = rawText.match(blockRegex);

  if (!match) {
    return {
      replyMarkdown: rawText.trim(),
      artifactsJson: null,
    };
  }

  const replyMarkdown = rawText.replace(blockRegex, "").trim();

  return {
    replyMarkdown,
    artifactsJson: match[1]?.trim() || null,
  };
}

/** Normalizes model text into markdown + structured artifacts, never throwing on parse failures. */
function normalizeStewardStructuredResponse(rawText: string, options: { debug: boolean }): StewardStructuredResponsePayload {
  const extracted = extractStewardArtifacts(String(rawText || ""));
  const base: StewardStructuredResponsePayload = {
    version: 1,
    replyMarkdown: extracted.replyMarkdown,
    artifacts: [],
    suggestedActions: [],
    evidence: [],
  };

  if (!extracted.artifactsJson) {
    return base;
  }

  try {
    const parsed = JSON.parse(extracted.artifactsJson) as Record<string, unknown>;
    const rawArtifacts = Array.isArray(parsed.artifacts) ? parsed.artifacts : [];
    const rawActions = Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions : [];
    const rawEvidence = Array.isArray(parsed.evidence) ? parsed.evidence : [];

    const artifacts = rawArtifacts
      .map((artifact) => sanitizeArtifact(artifact))
      .filter((artifact): artifact is Record<string, unknown> => Boolean(artifact))
      .slice(0, 8);

    const suggestedActions = rawActions
      .map((action) => {
        if (!action || typeof action !== "object" || Array.isArray(action)) return null;
        const candidate = action as Record<string, unknown>;
        const label = asSafeText(candidate.label, "", 220);
        const actionType = asSafeText(candidate.actionType, "", 80);
        if (!label || !actionType || !ALLOWED_SUGGESTED_ACTION_TYPES.has(actionType)) return null;

        const payload = sanitizeActionPayload(candidate.payload);

        return {
          label,
          actionType,
          requiresConfirmation: candidate.requiresConfirmation !== false,
          ...(payload ? { payload } : {}),
        };
      })
      .filter((action): action is StewardSuggestedActionPayload => Boolean(action))
      .slice(0, 10);

    const evidence = rawEvidence
      .map((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return null;
        const candidate = item as Record<string, unknown>;
        const label = asSafeText(candidate.label, "", 220);
        if (!label) return null;
        const detail = asSafeText(candidate.detail, "", 420);
        return {
          label,
          ...(detail ? { detail } : {}),
        };
      })
      .filter((item): item is { label: string; detail?: string } => Boolean(item))
      .slice(0, 16);

    return {
      version: 1,
      replyMarkdown: asSafeText(parsed.replyMarkdown, extracted.replyMarkdown, 12000) || extracted.replyMarkdown,
      artifacts,
      suggestedActions,
      evidence,
    };
  } catch {
    if (options.debug) {
      return {
        ...base,
        parseWarning: "Structured output unavailable due to invalid steward-artifacts JSON.",
      };
    }
    return base;
  }
}

/** Returns query tokens suitable for lightweight retrieval. */
function tokenizeQuery(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 6);
}

/** Extracts path-scoped IDs from known workspace routes. */
function parseScopeIdentifiers(scopePath: string): { clientId?: string; eventId?: string; constituentId?: string } {
  const parts = scopePath.split("/").filter(Boolean);
  if (parts[0] === "compassion" && parts[1] === "clients" && parts[2]) {
    return { clientId: parts[2] };
  }
  if (parts[0] === "events" && parts[1] && !["events", "setup", "check-in", "guests", "reports", "tickets", "tables", "sponsors", "fundraising", "communications"].includes(parts[1])) {
    return { eventId: parts[1] };
  }
  if (parts[0] === "constituents" && parts[1]) {
    return { constituentId: parts[1] };
  }
  return {};
}

/** Returns true when a donor question clearly asks for top/major donor ranking. */
function isTopDonorQuestion(input: string): boolean {
  const normalized = input.toLowerCase();
  return /(top\s+donors?|largest\s+donors?|major\s+donors?|highest\s+donors?)/.test(normalized);
}

/** Formats a numeric donation value for concise human-readable output. */
function formatGivingAmount(value: unknown): string {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return String(value ?? "0");
  return `$${parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Builds a deterministic top-donor answer through the approved donor intelligence tool layer. */
async function buildTopDonorResult(context: StewardToolExecutionContext): Promise<TopDonorResult> {
  const brief = await executeStewardTool(context, "donor.getDailyBrief", undefined);
  const topDonors = (brief.result as {
    topDonors?: Array<{ name: string; lifetimeGiving: number; lastGiftDate: string | null }>;
  }).topDonors ?? [];

  if (topDonors.length === 0) {
    return {
      reply: "I could not find any donors with lifetime giving greater than $0 yet.",
      toolsUsed: [brief.tool],
      recordsUsed: [],
    };
  }

  const lines = topDonors.map((donor, index) => {
    const amount = formatGivingAmount(donor.lifetimeGiving);
    const lastGift = donor.lastGiftDate ? fmtDate(donor.lastGiftDate) : "no date on record";
    return `${index + 1}. ${donor.name} — ${amount} (last gift: ${lastGift})`;
  });

  return {
    reply: [
      "Your top donors by lifetime giving are:",
      ...lines,
    ].join("\n"),
    toolsUsed: [brief.tool],
    recordsUsed: topDonors.map((donor, index) =>
      `${index + 1}. ${donor.name} (${formatGivingAmount(donor.lifetimeGiving)})`
    ),
  };
}

/** Returns true when the query is asking for a report, YTD summary, or giving chart. */
function isReportQuestion(input: string): boolean {
  const n = input.toLowerCase();
  return /(ytd|year.to.date|annual\s+report|giving\s+report|monthly\s+giving|giving\s+by\s+month|retention\s+rate|donor\s+retention|lybunt|revenue\s+report|kpi|summary\s+report|financial\s+report|fundraising\s+report|show.*report|open.*report|report.+chart|chart.*giving|giving.*chart)/.test(n);
}

/** Formats dollar amounts concisely. */
function fmtDollar(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

interface ReportCardResult {
  reply: string;
  structured: StewardStructuredResponsePayload;
  toolsUsed: string[];
}

/** Builds a deterministic report card + chart from live CRM data. */
async function buildReportCardResult(context: StewardToolExecutionContext): Promise<ReportCardResult> {
  const toolsUsed: string[] = [];

  const [summaryResult, monthlyResult] = await Promise.all([
    executeStewardTool(context, "reports.runSummary", undefined),
    executeStewardTool(context, "reports.runGivingByMonth", undefined),
  ]);
  toolsUsed.push(summaryResult.tool, monthlyResult.tool);

  const s = summaryResult.result as {
    fiscalYearLabel?: string;
    ytdRevenue?: number;
    ytdGiftCount?: number;
    ytdGrantAmount?: number;
    weekRevenue?: number;
    weekGiftCount?: number;
    totalConstituents?: number;
    activeCampaigns?: number;
    pendingTasks?: number;
    overdueTasks?: number;
  };

  const m = monthlyResult.result as {
    months?: Array<{ month: string; amount: number; count: number }>;
    totals?: { amount: number; count: number };
  };

  const fyLabel = s.fiscalYearLabel ?? "This Fiscal Year";
  const ytdRevenue = Number(s.ytdRevenue ?? 0);
  const ytdGiftCount = Number(s.ytdGiftCount ?? 0);
  const ytdGrantAmount = Number(s.ytdGrantAmount ?? 0);
  const weekRevenue = Number(s.weekRevenue ?? 0);
  const totalConstituents = Number(s.totalConstituents ?? 0);
  const activeCampaigns = Number(s.activeCampaigns ?? 0);
  const overdueTasks = Number(s.overdueTasks ?? 0);

  const months = m.months ?? [];

  const reportCardArtifact = {
    type: "report_card",
    title: `YTD Giving Summary — ${fyLabel}`,
    fiscalYearLabel: fyLabel,
    metrics: [
      { label: "YTD Revenue", value: fmtDollar(ytdRevenue), trend: "up" as const },
      { label: "YTD Gifts", value: ytdGiftCount.toLocaleString() },
      { label: "Grants Awarded", value: fmtDollar(ytdGrantAmount) },
      { label: "This Week", value: fmtDollar(weekRevenue) },
      { label: "Constituents", value: totalConstituents.toLocaleString() },
      { label: "Active Campaigns", value: String(activeCampaigns) },
      ...(overdueTasks > 0 ? [{ label: "Overdue Tasks", value: String(overdueTasks), trend: "down" as const }] : []),
    ],
    deepLink: "/reports/giving-summary",
    deepLinkLabel: "View Full Report",
    chartData: months.length > 0
      ? {
          labels: months.map((mo) => mo.month),
          values: months.map((mo) => mo.amount),
        }
      : undefined,
  };

  const chartArtifact = months.length > 0
    ? {
        type: "chart",
        title: `Monthly Giving — ${fyLabel}`,
        chartType: "bar",
        labels: months.map((mo) => mo.month),
        series: [{ name: "Giving", color: "#16a34a", data: months.map((mo) => mo.amount) }],
        yAxisPrefix: "$",
        yAxisLabel: "Donations",
      }
    : null;

  const replyLines = [
    `Here is the YTD fundraising summary for **${fyLabel}**:`,
    "",
    `- **Total revenue raised:** ${fmtDollar(ytdRevenue)} across ${ytdGiftCount} gifts`,
    ytdGrantAmount > 0 ? `- **Grants awarded:** ${fmtDollar(ytdGrantAmount)}` : "",
    weekRevenue > 0 ? `- **This week:** ${fmtDollar(weekRevenue)} (${Number(s.weekGiftCount ?? 0)} gifts)` : "",
    `- **Constituents:** ${totalConstituents.toLocaleString()}`,
    `- **Active campaigns:** ${activeCampaigns}`,
    overdueTasks > 0 ? `- **Overdue follow-up tasks:** ${overdueTasks}` : "",
    months.length > 0 ? `\nThe bar chart shows giving month-by-month. Use the "View Full Report" link to explore breakdowns by campaign, designation, or donor segment.` : "",
    "\n**Next steps:**",
    "1. Open the full report to filter by campaign or designation.",
    "2. Review overdue stewardship tasks in the Tasks view.",
    "3. Use Steward Signals for upgrade or retention opportunities.",
  ].filter((l) => l !== "").join("\n");

  return {
    reply: replyLines,
    toolsUsed,
    structured: {
      version: 1,
      replyMarkdown: replyLines,
      artifacts: [
        reportCardArtifact,
        ...(chartArtifact ? [chartArtifact] : []),
      ] as Array<Record<string, unknown>>,
      suggestedActions: [
        { label: "Open Full Report", actionType: "open_report", requiresConfirmation: false, payload: { route: "/reports/giving-summary" } },
        { label: "View Monthly Breakdown", actionType: "open_report", requiresConfirmation: false, payload: { route: "/reports/giving-by-month" } },
      ],
      evidence: [
        { label: `YTD Revenue: ${fmtDollar(ytdRevenue)}` },
        { label: `YTD Gifts: ${ytdGiftCount}` },
        ...(ytdGrantAmount > 0 ? [{ label: `Grants: ${fmtDollar(ytdGrantAmount)}` }] : []),
      ],
    },
  };
}

/** Returns mode-specific next-step defaults when the model does not provide explicit actions. */
function defaultNextStepsByMode(mode: StewardChatMode): string[] {
  if (mode === "analyze") {
    return [
      "Filter the Constituents view by this segment and review individual records.",
      "Prioritize the highest-opportunity donors for personal outreach this week.",
      "Save these findings to a task or note before taking action.",
    ];
  }

  if (mode === "draft") {
    return [
      "Review the draft and personalize the opening line before sending.",
      "Confirm the recipient's communication preferences are set to allow email.",
      "Save to Communications for team review before final send.",
    ];
  }

  if (mode === "action") {
    return [
      "Review the proposed steps and confirm the scope of impacted records.",
      "Assign the action to a specific team member with a due date.",
      "Log a note once the action is complete so the audit trail is clear.",
    ];
  }

  if (mode === "help") {
    return [
      "Follow the steps shown for your current page.",
      "Check your role permissions if expected options are not visible.",
      "Use AI Settings to verify runtime connectivity if responses stop working.",
    ];
  }

  return [
    "Open the relevant donor records and review the details shown above.",
    "Create a follow-up task or draft communication from the action buttons below.",
    "Re-ask this question after making changes to see updated results.",
  ];
}

/** Returns a clean reply string for deterministic paths. Does not add robot-style Evidence sections. */
function formatReplyByMode(options: {
  mode: StewardChatMode;
  reply: string;
  toolsUsed: string[];
  recordsUsed: string[];
}): string {
  // Return the reply as-is. The UI renders metadata separately in the "About this answer" panel.
  // Only append next steps when the reply itself does not already end with one.
  const cleaned = options.reply.trim() || "No summary was returned from the CRM data.";
  const hasNextSteps = /next step|recommended|suggest|you can|you should/i.test(cleaned);
  if (!hasNextSteps && (options.mode === "analyze" || options.mode === "ask")) {
    const steps = defaultNextStepsByMode(options.mode);
    return `${cleaned}\n\n**What you can do next:**\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
  }
  return cleaned;
}

function buildTopDonorStructuredResponse(result: TopDonorResult, templatedReply: string): StewardStructuredResponsePayload {
  const rows = result.recordsUsed
    .map((entry) => {
      const match = entry.match(/^\d+\.\s(.+?)\s\((.+)\)$/);
      if (!match) {
        return { donor: entry };
      }

      return {
        donor: match[1],
        lifetimeGiving: match[2],
      };
    })
    .slice(0, 10);

  return {
    version: 1,
    replyMarkdown: templatedReply,
    artifacts: rows.length > 0
      ? [{
          type: "donor_list",
          title: "Top Donors By Lifetime Giving",
          columns: ["donor", "lifetimeGiving"],
          rows,
        }]
      : [],
    suggestedActions: [],
    evidence: result.recordsUsed.map((item) => ({ label: item })),
  };
}

/** Builds a deterministic response directly from retrieved CRM context when model output is empty. */
function buildFallbackReplyFromContext(options: {
  mode: StewardChatMode;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  retrieval: StewardContextResult;
}): string {
  const contextLines = options.retrieval.contextText
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .filter((line) => !/^(Donor scope path|Fiscal year context|Current fiscal year|Fiscal YTD|Calendar year)/.test(line))
    .slice(0, 8);

  if (contextLines.length === 0) {
    return [
      "I was not able to generate a full AI response at this time.",
      options.userQuery ? `You asked: "${options.userQuery}"` : "",
      "Please check that AI is enabled and connected in Settings, then try again.",
    ].filter(Boolean).join("\n\n");
  }

  return [
    "The AI model did not return a response, but here is what the CRM currently shows for your question:",
    options.userQuery ? `> ${options.userQuery}` : "",
    contextLines.map((line) => `- ${line.replace(/^-\s*/, "")}`).join("\n"),
    "**What you can do next:** Open the relevant records directly, or re-ask once AI connectivity is restored.",
  ].filter(Boolean).join("\n\n");
}

/** Picks the effective thinking model, falling back to the primary model when unset. */
function resolveThinkingModel(config: ReturnType<typeof parseStewardAiConfig>): string {
  return String(config.thinkingModel || config.model).trim() || config.model;
}

/** Extracts fiscal year label and calendar year from retrieval context text for system prompt injection. */
function extractFiscalYearFromContext(contextText: string): { fiscalYearLabel?: string; calendarYear?: number } {
  const fyMatch = contextText.match(/^Fiscal year context: (.+)$/m);
  const calMatch = contextText.match(/^Calendar year: (\d{4})$/m);
  return {
    fiscalYearLabel: fyMatch?.[1] ?? undefined,
    calendarYear: calMatch ? parseInt(calMatch[1], 10) : undefined,
  };
}

/** Builds the planner stage prompt for agentic multi-stage preparation. */
function buildPlannerPrompt(options: {
  mode: StewardChatMode;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  contextText: string;
}): string {
  return [
    "You are Steward's planning engine. Produce concise planning notes only.",
    "Do not answer the user yet.",
    `Mode: ${options.mode}`,
    `Module: ${options.moduleKey}`,
    `Scope: ${options.scopePath}`,
    "Return exactly three sections:",
    "1) Key intent",
    "2) Evidence to prioritize",
    "3) Execution plan",
    "Keep each section under 4 bullets and stay grounded in provided context.",
    "User query:",
    options.userQuery || "(empty query)",
    "Retrieved context:",
    options.contextText || "No retrieval context available.",
  ].join("\n\n");
}

/** Builds the reasoning stage prompt that pressure-tests the planner output. */
function buildReasoningPrompt(options: {
  mode: StewardChatMode;
  userQuery: string;
  contextText: string;
  plannerNotes: string;
}): string {
  return [
    "You are Steward's reasoning verifier.",
    "Do not answer the user directly.",
    `Mode: ${options.mode}`,
    "Validate the planner notes against evidence and identify any weak assumptions.",
    "Return exactly three sections:",
    "1) Validated evidence",
    "2) Risks and unknowns",
    "3) Final answer strategy",
    "Keep output concise, factual, and retrieval-grounded.",
    "User query:",
    options.userQuery || "(empty query)",
    "Planner notes:",
    options.plannerNotes || "(no planner notes)",
    "Retrieved context:",
    options.contextText || "No retrieval context available.",
  ].join("\n\n");
}

/** Runs agentic planning + reasoning stages when enabled and returns summary artifacts. */
async function buildAgenticPreparation(options: {
  organizationId: string;
  enabled: boolean;
  config: ReturnType<typeof parseStewardAiConfig>;
  mode: StewardChatMode;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  contextText: string;
}): Promise<AgenticPreparationResult> {
  if (!options.config.agenticMultiStage) {
    return {
      reasoningModel: options.config.model,
      stageSummaries: [],
      toolsUsed: [],
    };
  }

  const reasoningModel = options.config.reasoningMode === "thinking"
    ? resolveThinkingModel(options.config)
    : options.config.model;

  const stageSummaries: string[] = [];
  const toolsUsed: string[] = [];

  try {
    const plannerResult = await withStewardAiTask(
      {
        organizationId: options.organizationId,
        enabled: options.enabled,
        config: options.config,
        label: "Planning donor engagement reasoning",
        status: "thinking",
        fallbackOnError: true,
      },
      () => runStewardAiChat(
        options.config,
        [
          {
            role: "system",
            content: buildPlannerPrompt({
              mode: options.mode,
              moduleKey: options.moduleKey,
              scopePath: options.scopePath,
              userQuery: options.userQuery,
              contextText: options.contextText,
            }),
          },
        ],
        {
          model: reasoningModel,
          temperature: 0.2,
          maxTokens: 700,
        }
      )
    );

    stageSummaries.push(`Planner Notes:\n${plannerResult.content}`);
    toolsUsed.push("agentic.plan");

    const reasoningResult = await withStewardAiTask(
      {
        organizationId: options.organizationId,
        enabled: options.enabled,
        config: options.config,
        label: "Verifying recommendation confidence",
        status: "thinking",
        fallbackOnError: true,
      },
      () => runStewardAiChat(
        options.config,
        [
          {
            role: "system",
            content: buildReasoningPrompt({
              mode: options.mode,
              userQuery: options.userQuery,
              contextText: options.contextText,
              plannerNotes: plannerResult.content,
            }),
          },
        ],
        {
          model: reasoningModel,
          temperature: 0.15,
          maxTokens: 900,
        }
      )
    );

    stageSummaries.push(`Reasoning Notes:\n${reasoningResult.content}`);
    toolsUsed.push("agentic.reason");

    return {
      reasoningModel,
      stageSummaries,
      toolsUsed,
    };
  } catch {
    // Graceful fallback keeps chat responsive when the configured thinking model is unavailable.
    return {
      reasoningModel: options.config.model,
      stageSummaries,
      toolsUsed,
    };
  }
}

/** Creates a runtime instruction block tailored to mode/module/context. */
function buildRuntimeSystemPrompt(options: {
  mode: NonNullable<StewardAiChatPayload["mode"]>;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  contextText: string;
  agenticNotes?: string[];
  fiscalYearLabel?: string;
  calendarYear?: number;
}): string {
  const actionPolicy = options.mode === "action"
    ? "Action mode policy: do not claim an action is executed. Propose explicit steps, required confirmations, and rollback considerations."
    : "Non-action policy: provide read-first analysis and practical next steps.";

  const moduleLexicon = options.moduleKey === "compassion"
    ? "Use client-care terminology (client, case, appointment, follow-up). Avoid donor fundraising terms unless explicitly requested."
    : options.moduleKey === "events"
      ? "Use event-operations terminology (event, guest, check-in, sponsor, seating, registration)."
      : options.moduleKey === "watchdog"
        ? "Use security operations terminology (incident, severity, alert, audit, access control, encrypted vault)."
        : options.moduleKey === "webmaster"
          ? "Use website operations terminology (templates, pages, publishing, domain, SEO, approvals)."
          : options.moduleKey === "oshareview"
            ? "Use donor report and board-summary terminology. Focus on practical donor analysis artifacts and evidence-backed recommendations."
          : "Use donor stewardship terminology (constituent, donation, campaign, stewardship, retention). If the user asks for top donors and ranked donor context exists, answer directly from that ranked data with names plus lifetime values. Do not claim missing data for that question unless no ranked donor data exists.";

  const structuredProtocol = options.moduleKey === "donor" || options.moduleKey === "oshareview"
    ? [
        "For donor/report questions, optionally append a structured block after your markdown answer using this exact fence label:",
        "```steward-artifacts",
        "{\"version\":1,\"replyMarkdown\":\"...\",\"artifacts\":[...],\"suggestedActions\":[...],\"evidence\":[...]}",
        "```",
        "Allowed artifact types: email_draft, donor_list, report_summary, task_list, call_script, csv_rows, report_card, chart.",
        "Use report_card when sharing KPI metrics (ytdRevenue, retentionRate, giftCounts, etc.). Set deepLink to the CRM report route (e.g. \"/reports/giving-summary\").",
        "Use chart with chartType=bar and monthly data from reports.runGivingByMonth results. Set yAxisPrefix=\"$\" for dollar values. Limit to 12-24 labels.",
      ].join("\n")
    : "Do not emit steward-artifacts JSON for this module.";

  return [
    "You are Steward, a CRM analyst assistant for a nonprofit organization. Answer as a helpful, calm, and knowledgeable analyst — not as a debug console or system trace.",
    `Current module: ${options.moduleKey}.`,
    `Current scope path: ${options.scopePath}.`,
    options.fiscalYearLabel
      ? `Current fiscal year: ${options.fiscalYearLabel}. Calendar year: ${options.calendarYear ?? new Date().getFullYear()}.`
      : `Calendar year: ${options.calendarYear ?? new Date().getFullYear()}.`,
    actionPolicy,
    moduleLexicon,
    "CRITICAL OUTPUT RULES — follow these exactly:",
    "1. Write your answer in natural, flowing prose. Do not create sections labeled 'Evidence:', 'Tool:', 'Record:', or 'Sources:'.",
    "2. Do not mention tool names like donor.getDailyBrief, agentic.plan, or knowledge.searchCrmRecords in your answer. The UI shows those separately.",
    "3. Do not repeat the same donor or record multiple times. Consolidate duplicates into one clear statement.",
    "4. If data is available, state it clearly. If data is limited or missing, say specifically what is missing and why.",
    "5. Give specific, actionable next steps that are directly relevant to the question — not generic placeholders.",
    "6. Use markdown formatting: bold labels, bullet lists, numbered steps, and tables where they add clarity.",
    "7. Do not expose internal planning notes, reasoning traces, or retrieval metadata. Those stay hidden.",
    "8. End with 2-3 concrete next steps the user can take inside the CRM right now.",
    structuredProtocol,
    options.agenticNotes && options.agenticNotes.length > 0
      ? [
          "Background preparation notes (do not quote these directly; use them to inform your answer):",
          ...options.agenticNotes,
        ].join("\n\n")
      : "",
    "CRM data context follows. Use this as your primary source of truth:",
    options.contextText || "No retrieval context available. Acknowledge this and ask the user to check AI settings.",
  ].filter(Boolean).join("\n\n");
}

/** Builds donor module retrieval context from constituents, tasks, and meetings. */
async function buildDonorContext(params: {
  organizationId: string;
  scopePath: string;
  userId: string;
  role: string;
  moduleKey?: "donor" | "oshareview";
  userQuery: string;
  mentionedConstituentIds?: string[];
}): Promise<StewardContextResult> {
  return buildDonorToolContextForChat({
    organizationId: params.organizationId,
    userId: params.userId,
    role: params.role,
    scopePath: params.scopePath,
    moduleKey: params.moduleKey,
    query: params.userQuery,
    mentionedConstituentIds: params.mentionedConstituentIds,
  });
}

/** Builds Compassion module retrieval context from clients, cases, appointments, and follow-ups. */
async function buildCompassionContext(params: {
  organizationId: string;
  tokens: string[];
  scopePath: string;
}): Promise<StewardContextResult> {
  const toolsUsed: string[] = ["compassion.clientLookup", "compassion.caseFollowupSnapshot"];
  const ids = parseScopeIdentifiers(params.scopePath);

  const scopedClient = ids.clientId
    ? await prisma.compassionClient.findFirst({
        where: { id: ids.clientId, organizationId: params.organizationId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientStatus: true,
          intakeDate: true,
          _count: { select: { cases: true, appointments: true, followUps: true } },
        },
      })
    : null;

  const matchedClients = params.tokens.length > 0
    ? await prisma.compassionClient.findMany({
        where: {
          organizationId: params.organizationId,
          OR: params.tokens.flatMap((token) => ([
            { firstName: { contains: token } },
            { lastName: { contains: token } },
            { email: { contains: token } },
          ])),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientStatus: true,
        },
        take: 6,
      })
    : [];

  const openCases = await prisma.compassionCase.findMany({
    where: {
      organizationId: params.organizationId,
      caseStatus: "OPEN",
    },
    select: {
      id: true,
      caseNumber: true,
      caseType: true,
      priority: true,
      client: { select: { firstName: true, lastName: true } },
    },
    orderBy: { openedAt: "desc" },
    take: 6,
  });

  const pendingFollowUps = await prisma.compassionFollowUp.count({
    where: {
      organizationId: params.organizationId,
      status: "PENDING",
    },
  });

  const lines = [
    `Compassion scope path: ${params.scopePath}`,
    scopedClient
      ? `Scoped client: ${scopedClient.firstName} ${scopedClient.lastName} [${scopedClient.clientStatus}] intake=${scopedClient.intakeDate.toISOString()} cases=${scopedClient._count.cases} appointments=${scopedClient._count.appointments} followUps=${scopedClient._count.followUps}`
      : "Scoped client: none",
    `Pending follow-ups: ${pendingFollowUps}`,
    `Open cases sampled: ${openCases.length}`,
    ...openCases.map((item) =>
      `- Case ${item.caseNumber} (${item.caseType}/${item.priority}) for ${item.client.firstName} ${item.client.lastName}`
    ),
    `Matched clients: ${matchedClients.length}`,
    ...matchedClients.map((client) => `- ${client.firstName} ${client.lastName} [${client.clientStatus}]`),
  ];

  return {
    contextText: lines.join("\n"),
    toolsUsed,
    recordsUsed: [
      ...(scopedClient ? [`Scoped client: ${scopedClient.firstName} ${scopedClient.lastName}`] : []),
      ...matchedClients.slice(0, 5).map((client) => `${client.firstName} ${client.lastName}`),
      ...openCases.slice(0, 4).map((item) => `Case ${item.caseNumber}`),
    ],
  };
}

/** Builds Events module retrieval context from event and guest operations data. */
async function buildEventsContext(params: {
  organizationId: string;
  tokens: string[];
  scopePath: string;
}): Promise<StewardContextResult> {
  const toolsUsed: string[] = ["events.eventLookup", "events.guestOpsSnapshot"];
  const ids = parseScopeIdentifiers(params.scopePath);

  const scopedEvent = ids.eventId
    ? await prisma.event.findFirst({
        where: { id: ids.eventId, organizationId: params.organizationId },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          _count: { select: { guests: true } },
        },
      })
    : null;

  const matchedEvents = params.tokens.length > 0
    ? await prisma.event.findMany({
        where: {
          organizationId: params.organizationId,
          OR: params.tokens.map((token) => ({ name: { contains: token } })),
        },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
        },
        take: 6,
      })
    : [];

  const guestCount = await prisma.eventGuest.count({
    where: {
      event: { organizationId: params.organizationId },
    },
  });

  const checkInCount = await prisma.eventGuest.count({
    where: {
      event: { organizationId: params.organizationId },
      checkedIn: true,
    },
  });

  const lines = [
    `Events scope path: ${params.scopePath}`,
    scopedEvent
      ? `Scoped event: ${scopedEvent.name} [${scopedEvent.status}] start=${scopedEvent.startDate.toISOString()} guests=${scopedEvent._count.guests}`
      : "Scoped event: none",
    `Guests total: ${guestCount}`,
    `Guests checked in: ${checkInCount}`,
    `Matched events: ${matchedEvents.length}`,
    ...matchedEvents.map((event) => `- ${event.name} [${event.status}] start=${event.startDate.toISOString()}`),
  ];

  return {
    contextText: lines.join("\n"),
    toolsUsed,
    recordsUsed: [
      ...(scopedEvent ? [`Scoped event: ${scopedEvent.name}`] : []),
      ...matchedEvents.slice(0, 5).map((event) => event.name),
      `Guests: ${guestCount}`,
      `Checked in: ${checkInCount}`,
    ],
  };
}

/** Runs module-specific retrieval tools and returns aggregated context text. */
async function buildRetrievalContext(params: {
  organizationId: string;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  userId: string;
  role: string;
  mentionedConstituentIds?: string[];
}): Promise<StewardContextResult> {
  const tokens = tokenizeQuery(params.userQuery);

  if (params.moduleKey === "compassion") {
    return buildCompassionContext({
      organizationId: params.organizationId,
      tokens,
      scopePath: params.scopePath,
    });
  }

  if (params.moduleKey === "events") {
    return buildEventsContext({
      organizationId: params.organizationId,
      tokens,
      scopePath: params.scopePath,
    });
  }

  if (params.moduleKey === "watchdog") {
    const recentSecurityAudits = await prisma.auditLog.findMany({
      where: {
        organizationId: params.organizationId,
        OR: [
          { action: { contains: "UNAUTHORIZED" } },
          { action: { contains: "FORBIDDEN" } },
          { action: { contains: "LOGIN" } },
          { action: { contains: "DELETE" } },
          { action: { contains: "RESET" } },
        ],
      },
      select: {
        id: true,
        action: true,
        entity: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return {
      toolsUsed: ["watchdog.auditSnapshot", "watchdog.accessRiskSummary"],
      contextText: [
        `Watchdog scope path: ${params.scopePath}`,
        `Recent critical/secure audit events: ${recentSecurityAudits.length}`,
        ...recentSecurityAudits.map((entry) => `- ${entry.action}${entry.entity ? ` on ${entry.entity}` : ""} at ${entry.createdAt.toISOString()}`),
      ].join("\n"),
      recordsUsed: recentSecurityAudits.slice(0, 8).map((entry) =>
        `${entry.action}${entry.entity ? ` (${entry.entity})` : ""}`
      ),
    };
  }

  if (params.moduleKey === "webmaster") {
    return {
      toolsUsed: ["webmaster.planningContext"],
      contextText: [
        `WebMaster scope path: ${params.scopePath}`,
        "Current module status: starter dashboard is active.",
        "No persisted website/page database records are available yet.",
        "Focus guidance on planning, IA, and staged implementation steps.",
      ].join("\n"),
      recordsUsed: [
        `Scope: ${params.scopePath}`,
        "WebMaster starter dashboard context",
      ],
    };
  }

  return buildDonorContext({
    organizationId: params.organizationId,
    scopePath: params.scopePath,
    userId: params.userId,
    role: params.role,
    moduleKey: params.moduleKey === "oshareview" ? "oshareview" : "donor",
    userQuery: params.userQuery,
    mentionedConstituentIds: params.mentionedConstituentIds,
  });
}

/** Resolves active org ID, failing gracefully with null when unavailable. */
async function resolveOrgId(req: import("express").Request): Promise<string | null> {
  return resolveOrganizationId({ req });
}

/** Loads persisted Steward AI plugin settings for one organization. */
async function getStewardAiSetting(organizationId: string) {
  return prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_AI_PLUGIN_KEY,
      },
    },
  });
}

/** Builds frontend-safe config payload without exposing secret fields. */
function toPublicConfig(enabled: boolean, config: ReturnType<typeof parseStewardAiConfig>): StewardAiConfigResponse {
  return {
    enabled,
    mode: config.mode,
    endpointUrl: config.endpointUrl,
    model: config.model,
    thinkingModel: config.thinkingModel,
    reasoningMode: config.reasoningMode,
    agenticMultiStage: config.agenticMultiStage,
    chatHeadEnabled: config.chatHeadEnabled,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    systemPrompt: config.systemPrompt,
    hasApiKey: Boolean(config.apiKey),
  };
}

function statusWeight(status: ReadinessStatus): number {
  if (status === "Broken") return 2;
  if (status === "Partially Working") return 1;
  return 0;
}

function pickOverallStatus(checks: BridgeReadinessCheck[]): ReadinessStatus {
  if (checks.some((check) => check.status === "Broken")) return "Broken";
  if (checks.some((check) => check.status === "Partially Working")) return "Partially Working";
  return "Working";
}

function createReadinessSummary(status: ReadinessStatus, checks: BridgeReadinessCheck[]): string {
  const blocked = checks.filter((check) => check.status === "Broken").length;
  const partial = checks.filter((check) => check.status === "Partially Working").length;

  if (status === "Working") {
    return "CRM online is ready for Oyama Bridge pairing.";
  }

  if (status === "Partially Working") {
    return `Bridge setup is partially ready. ${partial} check(s) need attention before full pairing.`;
  }

  return `Bridge setup is blocked. ${blocked} critical check(s) must be fixed before pairing.`;
}

function normalizeSiteUrl(rawSiteUrl: unknown, req: import("express").Request): string {
  const text = String(rawSiteUrl ?? "").trim();

  if (text.length > 0) {
    const parsed = new URL(text);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("Site URL must use http or https.");
    }
    return parsed.toString().replace(/\/+$/, "");
  }

  const originHeader = String(req.headers.origin || "").trim();
  if (originHeader) {
    const parsed = new URL(originHeader);
    return parsed.toString().replace(/\/+$/, "");
  }

  const host = String(req.headers.host || "").trim();
  if (!host) {
    return "http://localhost:3000";
  }
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").trim();
  const proto = forwardedProto === "https" ? "https" : "http";
  return `${proto}://${host}`;
}

async function buildBridgeReadinessPayload(options: {
  enabled: boolean;
  config: ReturnType<typeof parseStewardAiConfig>;
  includeLiveTest: boolean;
}): Promise<BridgeReadinessPayload> {
  const checks: BridgeReadinessCheck[] = [];

  checks.push({
    id: "ai-enabled",
    label: "Steward AI enabled",
    status: options.enabled ? "Working" : "Broken",
    detail: options.enabled
      ? "AI runtime is enabled for chat and bridge calls."
      : "Enable Steward AI before pairing with desktop bridge.",
  });

  checks.push({
    id: "mode-remote",
    label: "Remote mode selected",
    status: options.config.mode === "remote" ? "Working" : "Partially Working",
    detail: options.config.mode === "remote"
      ? "Remote mode is active and compatible with desktop bridge relay."
      : "Switch to Remote mode so CRM online uses the bridge endpoint.",
  });

  checks.push({
    id: "endpoint-url",
    label: "Endpoint URL configured",
    status: options.config.endpointUrl.trim().length > 0 ? "Working" : "Broken",
    detail: options.config.endpointUrl.trim().length > 0
      ? `Current endpoint: ${options.config.endpointUrl}`
      : "Set an endpoint URL before bridge pairing.",
  });

  checks.push({
    id: "api-key",
    label: "API key present",
    status: options.config.apiKey ? "Working" : "Partially Working",
    detail: options.config.apiKey
      ? "API key is configured for secure bridge calls."
      : "Add an API key for bridge authentication hardening.",
  });

  checks.push({
    id: "model-configured",
    label: "Model configured",
    status: options.config.model.trim().length > 0 ? "Working" : "Broken",
    detail: options.config.model.trim().length > 0
      ? `Primary model: ${options.config.model}`
      : "Select a model for chat responses.",
  });

  checks.push({
    id: "thinking-model-configured",
    label: "Thinking model configured",
    status: options.config.thinkingModel.trim().length > 0 ? "Working" : "Partially Working",
    detail: options.config.thinkingModel.trim().length > 0
      ? `Thinking model: ${options.config.thinkingModel}`
      : "Set a thinking model for multi-stage reasoning mode.",
  });

  if (options.includeLiveTest) {
    const testStartedAt = Date.now();
    try {
      const result = await testStewardAiConnection(options.config);
      checks.push({
        id: "live-endpoint-test",
        label: "Live endpoint reachability",
        status: "Working",
        detail: `Connected in ${Date.now() - testStartedAt}ms. Models detected: ${result.modelCount}.`,
      });
    } catch (error) {
      checks.push({
        id: "live-endpoint-test",
        label: "Live endpoint reachability",
        status: "Broken",
        detail: error instanceof Error ? error.message : "Bridge endpoint health test failed.",
      });
    }
  }

  checks.sort((a, b) => statusWeight(b.status) - statusWeight(a.status));
  const status = pickOverallStatus(checks);

  return {
    status,
    summary: createReadinessSummary(status, checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

/** GET /api/steward-ai/config — Returns saved AI provider config for the active organization. */
router.get("/status", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const query = req.query as StewardAiStatusQuery;
  const setting = await getStewardAiSetting(organizationId);
  const config = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());
  const enabled = Boolean(setting?.enabled);
  const forceRefresh = String(query.force ?? "").toLowerCase() === "1" || String(query.force ?? "").toLowerCase() === "true";

  const state = forceRefresh
    ? await refreshStewardAiRuntimeState({ organizationId, enabled, config, forceRefresh: true })
    : await refreshStewardAiRuntimeState({ organizationId, enabled, config, forceRefresh: false });

  res.json({ data: state });
});

/** GET /api/steward-ai/config — Returns saved AI provider config for the active organization. */
router.get("/config", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  const config = parseStewardAiConfig(setting?.config);

  res.json({
    data: toPublicConfig(setting?.enabled ?? false, config),
  });
});

/** PUT /api/steward-ai/config — Updates AI provider mode + endpoint settings. Admin-only. */
router.put("/config", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = req.body as StewardAiUpdatePayload;
  const existing = await getStewardAiSetting(organizationId);
  const existingConfig = parseStewardAiConfig(existing?.config);

  const nextConfig = parseStewardAiConfig({
    ...existingConfig,
    mode: payload.mode ?? existingConfig.mode,
    endpointUrl: payload.endpointUrl ?? existingConfig.endpointUrl,
    model: payload.model ?? existingConfig.model,
    thinkingModel: payload.thinkingModel ?? existingConfig.thinkingModel,
    reasoningMode: payload.reasoningMode ?? existingConfig.reasoningMode,
    agenticMultiStage: payload.agenticMultiStage ?? existingConfig.agenticMultiStage,
    chatHeadEnabled: payload.chatHeadEnabled ?? existingConfig.chatHeadEnabled,
    temperature: payload.temperature ?? existingConfig.temperature,
    maxTokens: payload.maxTokens ?? existingConfig.maxTokens,
    timeoutMs: payload.timeoutMs ?? existingConfig.timeoutMs,
    systemPrompt: payload.systemPrompt ?? existingConfig.systemPrompt,
    apiKey: payload.apiKey !== undefined
      ? String(payload.apiKey ?? "").trim()
      : (existingConfig.apiKey ?? ""),
  });

  const enabled = typeof payload.enabled === "boolean" ? payload.enabled : (existing?.enabled ?? false);

  const upserted = await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_AI_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: STEWARD_AI_PLUGIN_KEY,
      enabled,
      config: nextConfig as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled,
      config: nextConfig as unknown as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    action: "STEWARD_AI_CONFIG_UPDATED",
    entity: "PluginSetting",
    entityId: upserted.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      enabled,
      mode: nextConfig.mode,
      endpointUrl: nextConfig.endpointUrl,
      model: nextConfig.model,
      thinkingModel: nextConfig.thinkingModel,
      reasoningMode: nextConfig.reasoningMode,
      agenticMultiStage: nextConfig.agenticMultiStage,
      hasApiKey: Boolean(nextConfig.apiKey),
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  getStewardAiRuntimeState({
    organizationId,
    enabled,
    config: nextConfig,
  });

  res.json({
    data: toPublicConfig(enabled, nextConfig),
  });
});

/** POST /api/steward-ai/test — Verifies Ollama reachability for current config. Admin-only. */
router.post("/test", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  const config = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());

  const startedAt = Date.now();
  try {
    const result = await testStewardAiConnection(config);
    recordStewardAiConnectionSuccess({
      organizationId,
      enabled: Boolean(setting?.enabled),
      config,
    });
    res.json({
      data: {
        ok: true,
        latencyMs: Date.now() - startedAt,
        modelCount: result.modelCount,
        firstModel: result.firstModel,
      },
    });
  } catch (error) {
    recordStewardAiConnectionError({
      organizationId,
      enabled: Boolean(setting?.enabled),
      config,
      message: error instanceof Error ? error.message : "Steward AI connection failed.",
      fallback: false,
    });
    res.status(502).json({
      error: {
        code: "AI_CONNECTION_FAILED",
        message: error instanceof Error ? error.message : "Steward AI connection failed.",
      },
    });
  }
});

/** GET /api/steward-ai/bridge/readiness — Reports if CRM online is ready for bridge runtime usage. */
router.get("/bridge/readiness", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const includeLiveTest = String(req.query.live || "").toLowerCase() === "1" || String(req.query.live || "").toLowerCase() === "true";
  const setting = await getStewardAiSetting(organizationId);
  const config = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());
  const readiness = await buildBridgeReadinessPayload({
    enabled: setting?.enabled ?? false,
    config,
    includeLiveTest,
  });

  res.json({
    data: readiness,
  });
});

/** POST /api/steward-ai/bridge/pairing-key — Generates one-step desktop pairing URL and downloadable key payload. */
router.post("/bridge/pairing-key", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = (req.body ?? {}) as BridgePairingRequestPayload;
  let siteUrl: string;
  try {
    siteUrl = normalizeSiteUrl(payload.siteUrl, req);
  } catch (error) {
    res.status(400).json({
      error: {
        code: "INVALID_SITE_URL",
        message: error instanceof Error ? error.message : "Site URL is invalid.",
      },
    });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  const config = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  const siteOrigin = new URL(siteUrl).origin;
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const bridgeApiKey = `oyama-${crypto.randomBytes(18).toString("hex")}`;

  const pairingPayload: BridgePairingKeyPayload = {
    version: 1,
    kind: "oyama.bridge.pairing",
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    organizationId,
    organizationName: organization?.name ?? "Organization",
    bridgeConfig: {
      bridgeAutostart: true,
      bridgeUpstreamUrl: "http://127.0.0.1:11434",
      bridgePort: 43110,
      bridgeApiKey,
      bridgeAllowedOrigins: siteOrigin,
      bridgePublicBaseUrl: "",
      bridgeDomainUrl: `${siteOrigin}/settings/ai`,
      bridgeModel: config.model,
      bridgeThinkingModel: config.thinkingModel,
      bridgeCudaDevice: "auto",
      bridgeTemperature: config.temperature,
      bridgeTimeoutMs: config.timeoutMs,
    },
    aiHints: {
      mode: "remote",
      endpointUrl: "Set to your desktop bridge endpoint after pairing",
      model: config.model,
      thinkingModel: config.thinkingModel,
    },
  };

  const pairingToken = Buffer.from(JSON.stringify(pairingPayload), "utf8").toString("base64url");
  const pairingUrl = `${siteOrigin}/settings/ai?bridgePair=${encodeURIComponent(pairingToken)}`;
  const readiness = await buildBridgeReadinessPayload({
    enabled: setting?.enabled ?? false,
    config,
    includeLiveTest: false,
  });

  await logAudit({
    action: "STEWARD_AI_BRIDGE_PAIRING_KEY_CREATED",
    entity: "PluginSetting",
    entityId: setting?.id ?? "steward_ai",
    userId: req.user?.sub,
    organizationId,
    metadata: {
      siteOrigin,
      readinessStatus: readiness.status,
      model: config.model,
      thinkingModel: config.thinkingModel,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    data: {
      pairingUrl,
      pairingToken,
      expiresAt: expiresAt.toISOString(),
      connectionKey: pairingPayload,
      readiness,
    },
  });
});

/** GET /api/steward-ai/models — Lists models from the configured local Ollama endpoint. Admin-only. */
router.get("/models", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const query = req.query as StewardAiModelsQuery;
  const endpointOverride = typeof query.endpointUrl === "string" ? query.endpointUrl : "";

  const setting = await getStewardAiSetting(organizationId);
  const savedConfig = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());
  const localConfig = parseStewardAiConfig({
    ...savedConfig,
    mode: "local",
    endpointUrl: endpointOverride || savedConfig.endpointUrl,
  });

  try {
    const models = await listStewardAiModels(localConfig);
    res.json({
      data: {
        models,
      },
    });
  } catch (error) {
    res.status(502).json({
      error: {
        code: "AI_MODELS_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Failed to load local Ollama models.",
      },
    });
  }
});

/**
 * GET /api/steward-ai/tools
 * Lists available Steward tools for the current user, with permission visibility.
 */
router.get("/tools", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId || !role) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const query = req.query as StewardToolListQuery;
  const moduleKey = query.moduleKey === "oshareview" ? "oshareview" : "donor";
  const scopePath = asSafeText(query.scopePath, "/", 300);

  const context: StewardToolExecutionContext = {
    organizationId,
    userId,
    role,
    moduleKey,
    scopePath,
    requestRoute: req.path,
  };

  const tools = await listStewardTools(context);

  res.json({
    data: {
      moduleKey,
      scopePath,
      tools,
    },
  });
});

/**
 * POST /api/steward-ai/tools/execute
 * Executes one approved Steward tool through the controlled donor intelligence layer.
 */
router.post("/tools/execute", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId || !role) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }

  const payload = (req.body ?? {}) as StewardToolExecutePayload;
  const toolName = asSafeText(payload.tool, "", 120);
  if (!toolName) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "tool is required." } });
    return;
  }

  const moduleKey = payload.moduleKey === "oshareview" ? "oshareview" : "donor";
  const scopePath = asSafeText(payload.scopePath, "/", 300);
  const input = payload.input && typeof payload.input === "object" && !Array.isArray(payload.input)
    ? payload.input
    : undefined;

  const context: StewardToolExecutionContext = {
    organizationId,
    userId,
    role,
    moduleKey,
    scopePath,
    requestRoute: req.path,
  };

  try {
    const execution = await executeStewardTool(
      context,
      toolName,
      input,
      { confirm: payload.confirm === true }
    );

    await logAudit({
      action: execution.kind === "write" ? "STEWARD_TOOL_WRITE_EXECUTED" : "STEWARD_TOOL_READ_EXECUTED",
      entity: "StewardTool",
      entityId: execution.tool,
      userId,
      organizationId,
      metadata: {
        moduleKey,
        scopePath,
        tool: execution.tool,
        kind: execution.kind,
        requiresConfirmation: execution.requiresConfirmation,
        confirmed: payload.confirm === true,
        permissionsChecked: execution.permissionsChecked,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      data: execution,
    });
  } catch (error) {
    if (error instanceof StewardToolError) {
      res.status(error.status).json({
        error: {
          code: error.code,
          message: error.message,
        },
      });
      return;
    }

    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: error instanceof Error ? error.message : "Steward tool execution failed.",
      },
    });
  }
});

/** POST /api/steward-ai/chat — Produces a chat response using configured local/remote Ollama. */
router.post("/chat/stream", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  if (!setting?.enabled) {
    res.status(412).json({
      error: {
        code: "AI_NOT_ENABLED",
        message: "Steward AI is not enabled. Configure it in Settings > AI Assistant.",
      },
    });
    return;
  }

  const payload = req.body as StewardAiChatPayload;
  const normalizedMessages = (payload.messages ?? [])
    .filter((message) => message && typeof message.content === "string")
    .map((message): StewardAiChatMessage => ({
      role: message.role === "assistant" || message.role === "system" ? message.role : "user",
      content: message.content.slice(0, 3500),
    }))
    .slice(-20);

  if (normalizedMessages.length === 0) {
    res.status(400).json({
      error: {
        code: "EMPTY_MESSAGES",
        message: "At least one chat message is required.",
      },
    });
    return;
  }

  const config = parseStewardAiConfig(setting.config);
  const mode = payload.mode ?? "ask";
  const moduleKey = payload.moduleKey ?? "donor";
  const scopePath = payload.scopePath ?? "/";
  const latestUserMessage = [...normalizedMessages].reverse().find((message) => message.role === "user")?.content ?? "";
  const clientReportingYearMode = payload.reportingYearMode === "fiscal" ? "fiscal" : "calendar";
  const clientFiscalYear = typeof payload.fiscalYear === "number" ? payload.fiscalYear : undefined;
  const clientFiscalYearStart = typeof payload.fiscalYearStart === "number" ? payload.fiscalYearStart : undefined;

  // Extract constituent IDs from @mentioned donors in the chat composer
  const mentionedConstituentIds = Array.isArray(payload.donorContext)
    ? payload.donorContext
        .map((d) => (typeof d?.id === "string" ? d.id.trim() : ""))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  /** Sends a human-readable progress update to the client during pipeline stages. */
  function writeProgress(message: string): void {
    res.write(`${JSON.stringify({ type: "progress", message })}\n`);
  }

  /** Sends a thinking/reasoning delta to the client (DeepSeek reasoning tokens). */
  function writeThinking(delta: string): void {
    res.write(`${JSON.stringify({ type: "thinking", delta })}\n`);
  }

  try {
    if (moduleKey === "donor" && isTopDonorQuestion(latestUserMessage)) {
      writeProgress("Looking up top donor records…");
      const topDonorResult = await buildTopDonorResult({
        organizationId,
        userId: req.user?.sub ?? "",
        role: req.user?.role ?? "readonly",
        moduleKey,
        scopePath,
        requestRoute: req.path,
      });
      const templatedReply = formatReplyByMode({
        mode,
        reply: topDonorResult.reply,
        toolsUsed: topDonorResult.toolsUsed,
        recordsUsed: topDonorResult.recordsUsed,
      });
      const structured = buildTopDonorStructuredResponse(topDonorResult, templatedReply);
      res.write(`${JSON.stringify({ type: "chunk", delta: templatedReply })}\n`);
      res.write(`${JSON.stringify({
        type: "done",
        reply: templatedReply,
        structured,
        model: config.model,
        mode,
        runtimeMode: config.mode,
        provider: "crm-data",
        toolsUsed: topDonorResult.toolsUsed,
        recordsUsed: topDonorResult.recordsUsed,
        moduleKey,
        scopePath,
      })}\n`);
      res.end();
      return;
    }

    if (moduleKey === "donor" && isReportQuestion(latestUserMessage)) {
      writeProgress("Running YTD giving report…");
      const reportResult = await buildReportCardResult({
        organizationId,
        userId: req.user?.sub ?? "",
        role: req.user?.role ?? "readonly",
        moduleKey,
        scopePath,
        requestRoute: req.path,
      });
      res.write(`${JSON.stringify({ type: "chunk", delta: reportResult.reply })}\n`);
      res.write(`${JSON.stringify({
        type: "done",
        reply: reportResult.reply,
        structured: reportResult.structured,
        model: "crm-data",
        mode,
        runtimeMode: config.mode,
        provider: "crm-data",
        toolsUsed: reportResult.toolsUsed,
        recordsUsed: [],
        moduleKey,
        scopePath,
      })}\n`);
      res.end();
      return;
    }

    // ── Stage 1: Retrieval ──────────────────────────────────────────────────
    const retrievalProgressMessages: Record<string, string> = {
      donor:      "Reviewing donor records and giving history…",
      compassion: "Reviewing client and case records…",
      events:     "Reviewing event and registration data…",
      watchdog:   "Reviewing compliance and audit data…",
      webmaster:  "Reviewing site and content data…",
    };
    writeProgress(retrievalProgressMessages[moduleKey] ?? "Reviewing CRM records…");

    const retrieval = await buildRetrievalContext({
      organizationId,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
      userId: req.user?.sub ?? "",
      role: req.user?.role ?? "readonly",
      mentionedConstituentIds: mentionedConstituentIds.length > 0 ? mentionedConstituentIds : undefined,
    });

    if (retrieval.toolsUsed.length > 1) {
      writeProgress(`Checking ${retrieval.toolsUsed.length} data sources…`);
    }

    // ── Stage 2: Agentic multi-stage reasoning ──────────────────────────────
    if (config.agenticMultiStage) {
      writeProgress("Planning how to answer your question…");
    }

    const agenticPreparation = await buildAgenticPreparation({
      organizationId,
      enabled: Boolean(setting?.enabled),
      config,
      mode,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
      contextText: retrieval.contextText,
    });

    if (agenticPreparation.stageSummaries.length > 0) {
      writeProgress("Verifying data and checking for gaps…");
    }

    const fyMeta = extractFiscalYearFromContext(retrieval.contextText);
    // If the client has locked to fiscal year mode, override/supplement the extracted metadata.
    const resolvedFyLabel = fyMeta.fiscalYearLabel
      ?? (clientReportingYearMode === "fiscal" && clientFiscalYear ? `FY${clientFiscalYear}` : undefined);
    const resolvedCalendarYear = fyMeta.calendarYear ?? clientFiscalYear ?? new Date().getFullYear();
    const yearModeNote = clientReportingYearMode === "fiscal" && clientFiscalYear
      ? `The user has locked Steward to fiscal year mode: FY${clientFiscalYear}${clientFiscalYearStart ? ` (starts month ${clientFiscalYearStart})` : ""}. Answer all year-related questions using this fiscal year context unless the user asks for calendar year explicitly.`
      : `The user is in calendar year mode (${resolvedCalendarYear}).`;
    const runtimeSystemPrompt = buildRuntimeSystemPrompt({
      mode,
      moduleKey,
      scopePath,
      contextText: retrieval.contextText + `\n\n${yearModeNote}`,
      agenticNotes: agenticPreparation.stageSummaries,
      fiscalYearLabel: resolvedFyLabel,
      calendarYear: resolvedCalendarYear,
    });

    const toolsUsed = [...retrieval.toolsUsed, ...agenticPreparation.toolsUsed];
    let provider = agenticPreparation.stageSummaries.length > 0 ? "ollama-agentic" : "ollama";
    let completion: { content: string; model: string };

    writeProgress("Drafting a response…");

    try {
      completion = await withStewardAiTask(
        {
          organizationId,
          enabled: Boolean(setting?.enabled),
          config,
          label: "Generating donor engagement recommendations",
          status: "running_task",
          fallbackOnError: true,
        },
        () => runStewardAiChatStream(
          config,
          [
            { role: "system", content: runtimeSystemPrompt },
            ...normalizedMessages,
          ],
          {
            onDelta: (delta) => {
              res.write(`${JSON.stringify({ type: "chunk", delta })}\n`);
            },
            onThinkingDelta: (delta) => {
              writeThinking(delta);
            },
          }
        )
      );
    } catch (streamError) {
      const message = streamError instanceof Error ? streamError.message : "";
      if (!/empty assistant response/i.test(message)) {
        throw streamError;
      }

      completion = {
        content: buildFallbackReplyFromContext({
          mode,
          moduleKey,
          scopePath,
          userQuery: latestUserMessage,
          retrieval,
        }),
        model: config.model,
      };
      provider = "crm-fallback";
      toolsUsed.push("fallback.emptyAssistantResponse");
    }

    const parsedStructured = normalizeStewardStructuredResponse(completion.content, {
      debug: false,
    });

    const templatedReply = formatReplyByMode({
      mode,
      reply: parsedStructured.replyMarkdown || completion.content,
      toolsUsed,
      recordsUsed: retrieval.recordsUsed,
    });
    const structured: StewardStructuredResponsePayload = {
      ...parsedStructured,
      replyMarkdown: templatedReply,
    };

    await logAudit({
      action: "STEWARD_AI_CHAT",
      entity: "PluginSetting",
      entityId: setting.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        provider,
        aiMode: config.mode,
        model: completion.model,
        thinkingModel: config.thinkingModel,
        reasoningMode: config.reasoningMode,
        reasoningModelUsed: agenticPreparation.reasoningModel,
        agenticMultiStage: config.agenticMultiStage,
        agenticStageCount: agenticPreparation.stageSummaries.length,
        chatMode: mode,
        moduleKey,
        scopePath,
        messageCount: normalizedMessages.length,
        toolsUsed,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.write(`${JSON.stringify({
      type: "done",
      reply: templatedReply,
      structured,
      model: completion.model,
      mode,
      runtimeMode: config.mode,
      provider,
      toolsUsed,
      recordsUsed: retrieval.recordsUsed,
      moduleKey,
      scopePath,
    })}\n`);
    res.end();
  } catch (error) {
    res.write(`${JSON.stringify({
      type: "error",
      message: error instanceof Error ? error.message : "Steward AI request failed.",
    })}\n`);
    res.end();
  }
});

/** POST /api/steward-ai/chat — Produces a chat response using configured local/remote Ollama. */
router.post("/chat", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  if (!setting?.enabled) {
    res.status(412).json({
      error: {
        code: "AI_NOT_ENABLED",
        message: "Steward AI is not enabled. Configure it in Settings > AI Assistant.",
      },
    });
    return;
  }

  const payload = req.body as StewardAiChatPayload;
  const normalizedMessages = (payload.messages ?? [])
    .filter((message) => message && typeof message.content === "string")
    .map((message): StewardAiChatMessage => ({
      role: message.role === "assistant" || message.role === "system" ? message.role : "user",
      content: message.content.slice(0, 3500),
    }))
    .slice(-20);

  if (normalizedMessages.length === 0) {
    res.status(400).json({
      error: {
        code: "EMPTY_MESSAGES",
        message: "At least one chat message is required.",
      },
    });
    return;
  }

  const config = parseStewardAiConfig(setting.config);
  const mode = payload.mode ?? "ask";
  const moduleKey = payload.moduleKey ?? "donor";
  const scopePath = payload.scopePath ?? "/";
  const latestUserMessage = [...normalizedMessages].reverse().find((message) => message.role === "user")?.content ?? "";
  const clientReportingYearMode = payload.reportingYearMode === "fiscal" ? "fiscal" : "calendar";
  const clientFiscalYear = typeof payload.fiscalYear === "number" ? payload.fiscalYear : undefined;
  const clientFiscalYearStart = typeof payload.fiscalYearStart === "number" ? payload.fiscalYearStart : undefined;

  const mentionedConstituentIds = Array.isArray(payload.donorContext)
    ? payload.donorContext
        .map((d) => (typeof d?.id === "string" ? d.id.trim() : ""))
        .filter(Boolean)
        .slice(0, 5)
    : [];

  try {
    if (moduleKey === "donor" && isTopDonorQuestion(latestUserMessage)) {
      const topDonorResult = await buildTopDonorResult({
        organizationId,
        userId: req.user?.sub ?? "",
        role: req.user?.role ?? "readonly",
        moduleKey,
        scopePath,
        requestRoute: req.path,
      });
      const templatedReply = formatReplyByMode({
        mode,
        reply: topDonorResult.reply,
        toolsUsed: topDonorResult.toolsUsed,
        recordsUsed: topDonorResult.recordsUsed,
      });
      const structured = buildTopDonorStructuredResponse(topDonorResult, templatedReply);
      res.json({
        data: {
          reply: templatedReply,
          structured,
          model: config.model,
          mode,
          runtimeMode: config.mode,
          provider: "crm-data",
          toolsUsed: topDonorResult.toolsUsed,
          recordsUsed: topDonorResult.recordsUsed,
          moduleKey,
          scopePath,
        },
      });
      return;
    }

    if (moduleKey === "donor" && isReportQuestion(latestUserMessage)) {
      const reportResult = await buildReportCardResult({
        organizationId,
        userId: req.user?.sub ?? "",
        role: req.user?.role ?? "readonly",
        moduleKey,
        scopePath,
        requestRoute: req.path,
      });
      res.json({
        data: {
          reply: reportResult.reply,
          structured: reportResult.structured,
          model: "crm-data",
          mode,
          runtimeMode: config.mode,
          provider: "crm-data",
          toolsUsed: reportResult.toolsUsed,
          recordsUsed: [],
          moduleKey,
          scopePath,
        },
      });
      return;
    }

    const retrieval = await buildRetrievalContext({
      organizationId,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
      userId: req.user?.sub ?? "",
      role: req.user?.role ?? "readonly",
      mentionedConstituentIds: mentionedConstituentIds.length > 0 ? mentionedConstituentIds : undefined,
    });

    const agenticPreparation = await buildAgenticPreparation({
      organizationId,
      enabled: Boolean(setting?.enabled),
      config,
      mode,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
      contextText: retrieval.contextText,
    });

    const fyMeta = extractFiscalYearFromContext(retrieval.contextText);
    const resolvedFyLabelSync = fyMeta.fiscalYearLabel
      ?? (clientReportingYearMode === "fiscal" && clientFiscalYear ? `FY${clientFiscalYear}` : undefined);
    const resolvedCalendarYearSync = fyMeta.calendarYear ?? clientFiscalYear ?? new Date().getFullYear();
    const yearModeNoteSync = clientReportingYearMode === "fiscal" && clientFiscalYear
      ? `The user has locked Steward to fiscal year mode: FY${clientFiscalYear}${clientFiscalYearStart ? ` (starts month ${clientFiscalYearStart})` : ""}. Answer all year-related questions using this fiscal year context unless the user asks for calendar year explicitly.`
      : `The user is in calendar year mode (${resolvedCalendarYearSync}).`;
    const runtimeSystemPrompt = buildRuntimeSystemPrompt({
      mode,
      moduleKey,
      scopePath,
      contextText: retrieval.contextText + `\n\n${yearModeNoteSync}`,
      agenticNotes: agenticPreparation.stageSummaries,
      fiscalYearLabel: resolvedFyLabelSync,
      calendarYear: resolvedCalendarYearSync,
    });

    const toolsUsed = [...retrieval.toolsUsed, ...agenticPreparation.toolsUsed];
    let provider = agenticPreparation.stageSummaries.length > 0 ? "ollama-agentic" : "ollama";
    let completion: { content: string; model: string };

    try {
      completion = await withStewardAiTask(
        {
          organizationId,
          enabled: Boolean(setting?.enabled),
          config,
          label: "Generating donor engagement recommendations",
          status: "running_task",
          fallbackOnError: true,
        },
        () => runStewardAiChat(config, [
          { role: "system", content: runtimeSystemPrompt },
          ...normalizedMessages,
        ])
      );
    } catch (chatError) {
      const message = chatError instanceof Error ? chatError.message : "";
      if (!/empty assistant response/i.test(message)) {
        throw chatError;
      }

      completion = {
        content: buildFallbackReplyFromContext({
          mode,
          moduleKey,
          scopePath,
          userQuery: latestUserMessage,
          retrieval,
        }),
        model: config.model,
      };
      provider = "crm-fallback";
      toolsUsed.push("fallback.emptyAssistantResponse");
    }

    const parsedStructured = normalizeStewardStructuredResponse(completion.content, {
      debug: false,
    });

    const templatedReply = formatReplyByMode({
      mode,
      reply: parsedStructured.replyMarkdown || completion.content,
      toolsUsed,
      recordsUsed: retrieval.recordsUsed,
    });
    const structured: StewardStructuredResponsePayload = {
      ...parsedStructured,
      replyMarkdown: templatedReply,
    };

    await logAudit({
      action: "STEWARD_AI_CHAT",
      entity: "PluginSetting",
      entityId: setting.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        provider,
        aiMode: config.mode,
        model: completion.model,
        thinkingModel: config.thinkingModel,
        reasoningMode: config.reasoningMode,
        reasoningModelUsed: agenticPreparation.reasoningModel,
        agenticMultiStage: config.agenticMultiStage,
        agenticStageCount: agenticPreparation.stageSummaries.length,
        chatMode: mode,
        moduleKey,
        scopePath,
        messageCount: normalizedMessages.length,
        toolsUsed,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      data: {
        reply: templatedReply,
        structured,
        model: completion.model,
        mode,
        runtimeMode: config.mode,
        provider,
        toolsUsed,
        recordsUsed: retrieval.recordsUsed,
        moduleKey,
        scopePath,
      },
    });
  } catch (error) {
    res.status(502).json({
      error: {
        code: "AI_CHAT_FAILED",
        message: error instanceof Error ? error.message : "Steward AI request failed.",
      },
    });
  }
});

export default router;
