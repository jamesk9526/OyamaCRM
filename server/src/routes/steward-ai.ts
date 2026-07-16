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
} from "../services/steward-ai-ollama.js";
import {
  getStewardAiRuntimeState,
  recordStewardAiConnectionError,
  recordStewardAiConnectionSuccess,
  refreshStewardAiRuntimeState,
  withStewardAiTask,
} from "../services/steward-ai-runtime-status.js";
import {
  StewardToolError,
  executeStewardTool,
  listStewardTools,
  type StewardToolExecutionContext,
} from "../services/steward-tool-registry.js";
import { fmtDate } from "../services/steward-donor-context.js";
import {
  createContentHash,
  getOrCreateAiMemoryPreference,
  jsonTags,
  normalizeMemoryCategory,
  normalizeTags,
  normalizeWorkspaceScope,
  replaceContextChunks,
  safeText as safeMemoryText,
  saveExplicitMemoryFromText,
} from "../services/steward-memory-context.js";
import type { Prisma } from "@prisma/client";
import type { Router as ExpressRouter } from "express";
// ─── Steward sub-module imports ────────────────────────────────────────────────
import type {
  StewardAiConfigResponse,
  StewardAiUpdatePayload,
  StewardAiModelsQuery,
  StewardAiStatusQuery,
  BridgePairingRequestPayload,
  ReadinessStatus,
  BridgeReadinessCheck,
  BridgeReadinessPayload,
  BridgePairingKeyPayload,
  StewardAiChatPayload,
  StewardToolListQuery,
  StewardToolExecutePayload,
  AiMemoryPayload,
  AiContextFilePayload,
  StewardChatMode,
  StewardResponseIntent,
  StewardContextResult,
  TopDonorResult,
  AgenticPreparationResult,
  StewardStructuredResponsePayload,
  StewardSuggestedActionPayload,
  StewardEvidencePayload,
} from "../steward/types.js";
import { asSafeText, normalizeStewardStructuredResponse } from "../steward/sanitize.js";
import { publicMemory, publicContextFile, scopeFromModuleKey } from "../steward/query-utils.js";
import {
  resolveThinkingModel,
  extractFiscalYearFromContext,
  detectStewardIntent,
  buildIntentResponseContract,
  buildModelContextForIntent,
} from "../steward/intent.js";
import {
  buildAgenticPreparation,
  buildAgenticToolPass,
  extractVerificationEvidence,
} from "../steward/agentic.js";
import { buildRuntimeSystemPrompt, buildRetrievalContext } from "../steward/context-builders.js";
import { buildThoughtStackAssessment } from "../steward/guide-paths.js";

const router: ExpressRouter = Router();
const STEWARD_AI_PLUGIN_KEY = "steward_ai";
const CHAT_CONTEXT_MAX_MESSAGES = 80;
const CHAT_CONTEXT_MAX_CHARS = 42_000;
const CHAT_CONTEXT_MESSAGE_MAX_CHARS = 3_500;
const CHAT_CONTEXT_ANCHOR_LIMIT = 8;

interface StewardChatContextWindow {
  normalizedMessages: StewardAiChatMessage[];
  totalInputMessages: number;
  droppedMessages: number;
  keptChars: number;
}

/**
 * Keeps full-chat continuity via a safe rolling window.
 * Strategy:
 * 1) sanitize all messages
 * 2) keep newest messages first (recency priority)
 * 3) add sparse older anchors when space allows (long-thread continuity)
 */
function buildSafeRollingContextWindow(payloadMessages: StewardAiChatPayload["messages"]): StewardChatContextWindow {
  const normalizedAll = (payloadMessages ?? [])
    .filter((message) => message && typeof message.content === "string")
    .map((message): StewardAiChatMessage => ({
      role: message.role === "assistant" || message.role === "system" ? message.role : "user",
      content: message.content.slice(0, CHAT_CONTEXT_MESSAGE_MAX_CHARS),
    }));

  if (normalizedAll.length === 0) {
    return {
      normalizedMessages: [],
      totalInputMessages: 0,
      droppedMessages: 0,
      keptChars: 0,
    };
  }

  const indexed = normalizedAll.map((message, index) => ({
    message,
    index,
    chars: message.content.length,
  }));
  const selectedIndices = new Set<number>();
  let keptChars = 0;

  for (let i = indexed.length - 1; i >= 0; i -= 1) {
    const candidate = indexed[i];
    const nextCount = selectedIndices.size + 1;
    const nextChars = keptChars + candidate.chars;
    if (nextCount > CHAT_CONTEXT_MAX_MESSAGES || nextChars > CHAT_CONTEXT_MAX_CHARS) {
      continue;
    }
    selectedIndices.add(candidate.index);
    keptChars = nextChars;
  }

  if (selectedIndices.size < CHAT_CONTEXT_MAX_MESSAGES && keptChars < CHAT_CONTEXT_MAX_CHARS) {
    const anchorStep = Math.max(1, Math.floor(indexed.length / CHAT_CONTEXT_ANCHOR_LIMIT));
    for (let i = 0; i < indexed.length; i += anchorStep) {
      const candidate = indexed[i];
      if (selectedIndices.has(candidate.index)) continue;
      const nextCount = selectedIndices.size + 1;
      const nextChars = keptChars + candidate.chars;
      if (nextCount > CHAT_CONTEXT_MAX_MESSAGES || nextChars > CHAT_CONTEXT_MAX_CHARS) {
        continue;
      }
      selectedIndices.add(candidate.index);
      keptChars = nextChars;
      if (selectedIndices.size >= CHAT_CONTEXT_MAX_MESSAGES || keptChars >= CHAT_CONTEXT_MAX_CHARS) {
        break;
      }
    }
  }

  const normalizedMessages = indexed
    .filter((item) => selectedIndices.has(item.index))
    .sort((a, b) => a.index - b.index)
    .map((item) => item.message);

  return {
    normalizedMessages,
    totalInputMessages: normalizedAll.length,
    droppedMessages: Math.max(0, normalizedAll.length - normalizedMessages.length),
    keptChars,
  };
}

// Steward AI endpoints require authenticated users.
router.use(requireAuth);
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

interface ForcedToolContextResult {
  contextText: string;
  toolsUsed: string[];
  recordsUsed: string[];
  warnings: string[];
}

function normalizeForcedToolNames(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return [...new Set(
    input
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, 8)
  )];
}

function stringifyForcedToolResult(value: unknown): string {
  if (value === null || value === undefined) return "(no data)";
  if (typeof value === "string") return value.slice(0, 2200);
  try {
    return JSON.stringify(value, null, 2).slice(0, 2200);
  } catch {
    return String(value).slice(0, 2200);
  }
}

/** Executes explicit user-selected read tools and folds their output into model context. */
async function buildForcedToolContext(
  context: StewardToolExecutionContext,
  forcedToolNames: string[]
): Promise<ForcedToolContextResult> {
  if (forcedToolNames.length === 0) {
    return { contextText: "", toolsUsed: [], recordsUsed: [], warnings: [] };
  }

  const tools = await listStewardTools(context);
  const readToolNames = new Set(
    tools
      .filter((tool) => tool.allowed && tool.kind === "read")
      .map((tool) => tool.name)
  );

  const contextBlocks: string[] = [];
  const toolsUsed: string[] = [];
  const recordsUsed: string[] = [];
  const warnings: string[] = [];

  for (const toolName of forcedToolNames) {
    if (!readToolNames.has(toolName as never)) {
      warnings.push(`Forced tool skipped (not allowed/read-only): ${toolName}`);
      continue;
    }

    try {
      const execution = await executeStewardTool(context, toolName as never, undefined);
      toolsUsed.push(execution.tool);
      const serialized = stringifyForcedToolResult(execution.result);
      contextBlocks.push(`Forced Tool ${execution.tool}:\n${serialized}`);
      recordsUsed.push(`Forced tool ${execution.tool} executed`);
    } catch (error) {
      warnings.push(`Forced tool failed (${toolName}): ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }

  return {
    contextText: contextBlocks.join("\n\n"),
    toolsUsed,
    recordsUsed,
    warnings,
  };
}

type ReportGuideTemplateId = "board_pack" | "campaign_pivot" | "retention_risk_plan";
type ReportLayoutHint = "compact" | "balanced" | "detailed";

interface ReportArtifactRefinePayload {
  path?: string;
  title?: string;
  prompt?: string;
  guideTemplate?: ReportGuideTemplateId;
  layoutHint?: ReportLayoutHint;
  filters?: string[];
  structured?: StewardStructuredResponsePayload;
  replyContent?: string;
}

interface ReportGuideTemplateConfig {
  id: ReportGuideTemplateId;
  label: string;
  description: string;
  defaultPrompt: string;
  layoutHint: ReportLayoutHint;
  defaultFilters: string[];
}

const REPORT_GUIDE_TEMPLATES: ReportGuideTemplateConfig[] = [
  {
    id: "board_pack",
    label: "Board Pack",
    description: "Executive-ready summary with governance-focused priorities and supporting evidence.",
    defaultPrompt: "Build a board-ready executive summary with top KPI drivers, risks, and recommended decisions.",
    layoutHint: "compact",
    defaultFilters: ["period:ytd", "audience:board", "scope:organization"],
  },
  {
    id: "campaign_pivot",
    label: "Campaign Pivot",
    description: "Operational pivot view focused on campaign velocity, underperformance, and next actions.",
    defaultPrompt: "Identify campaign pivots for the next 30 days, including segments, channels, and immediate actions.",
    layoutHint: "balanced",
    defaultFilters: ["window:90d", "dimension:campaign", "segment:active-donors"],
  },
  {
    id: "retention_risk_plan",
    label: "Retention Risk Plan",
    description: "Retention-first analysis of risk indicators, mitigation steps, and follow-up sequencing.",
    defaultPrompt: "Create a retention risk plan with highest-risk cohorts, mitigation actions, and follow-up sequencing.",
    layoutHint: "detailed",
    defaultFilters: ["metric:retention", "cohort:lapsed-risk", "window:12m"],
  },
];

/** Picks a deterministic guide template when none is supplied explicitly. */
function detectGuideTemplate(userPrompt: string, preferred?: ReportGuideTemplateId): ReportGuideTemplateId {
  if (preferred) return preferred;
  const prompt = userPrompt.toLowerCase();
  if (/board|executive|trustee|governance/.test(prompt)) return "board_pack";
  if (/campaign|pivot|channel|segment/.test(prompt)) return "campaign_pivot";
  if (/retention|lybunt|lapse|churn|risk/.test(prompt)) return "retention_risk_plan";
  return "board_pack";
}

/** Infers report layout style from prompt language. */
function detectLayoutHint(userPrompt: string, fallback: ReportLayoutHint): ReportLayoutHint {
  const prompt = userPrompt.toLowerCase();
  if (/detailed|deep|full|long/.test(prompt)) return "detailed";
  if (/compact|executive|brief|summary/.test(prompt)) return "compact";
  if (/balanced|standard/.test(prompt)) return "balanced";
  return fallback;
}

/** Adds deterministic filter hints inferred from prompt text. */
function inferFilterHintsFromPrompt(userPrompt: string): string[] {
  const prompt = userPrompt.toLowerCase();
  const hints = new Set<string>();
  if (/campaign/.test(prompt)) hints.add("dimension:campaign");
  if (/designation|fund/.test(prompt)) hints.add("dimension:designation");
  if (/major\s+gift|major\s+donor/.test(prompt)) hints.add("segment:major-gifts");
  if (/monthly|month/.test(prompt)) hints.add("window:month");
  if (/weekly|week/.test(prompt)) hints.add("window:week");
  if (/fiscal|fy/.test(prompt)) hints.add("period:fiscal");
  if (/calendar\s+year|cy/.test(prompt)) hints.add("period:calendar");
  if (/retention|lybunt|lapse/.test(prompt)) hints.add("metric:retention");
  return [...hints];
}

function normalizeReportFilters(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 20);
}

function collectMetricRecord(artifacts: Array<Record<string, unknown>>): Array<{ label: string; value: string; delta?: string; trend?: "up" | "down" | "flat" }> {
  const reportCard = artifacts.find((artifact) => artifact.type === "report_card") as {
    metrics?: Array<{ label?: string; value?: string; delta?: string; trend?: "up" | "down" | "flat" }>;
  } | undefined;

  if (!reportCard?.metrics || reportCard.metrics.length === 0) {
    return [];
  }

  return reportCard.metrics
    .map((metric) => ({
      label: String(metric.label ?? "").trim(),
      value: String(metric.value ?? "").trim(),
      delta: typeof metric.delta === "string" ? metric.delta : undefined,
      trend: metric.trend,
    }))
    .filter((metric) => metric.label.length > 0 && metric.value.length > 0);
}

/** Prioritizes report metrics by template intent while retaining all original rows. */
function orderMetricsByGuide(metrics: Array<{ label: string; value: string; delta?: string; trend?: "up" | "down" | "flat" }>, guide: ReportGuideTemplateId) {
  if (metrics.length === 0) return metrics;

  const priorityByGuide: Record<ReportGuideTemplateId, string[]> = {
    board_pack: ["YTD Revenue", "Fiscal Total", "Donor Total", "YTD Gifts", "Active Campaigns", "Overdue Tasks"],
    campaign_pivot: ["Active Campaigns", "Monthly Total", "Weekly Total", "YTD Revenue", "Donor Total"],
    retention_risk_plan: ["Donor Total", "YTD Gifts", "Monthly Total", "Weekly Total", "Overdue Tasks"],
  };

  const priorities = priorityByGuide[guide];
  const rank = (label: string): number => {
    const idx = priorities.findIndex((item) => item.toLowerCase() === label.toLowerCase());
    return idx >= 0 ? idx : priorities.length + 1;
  };

  return [...metrics].sort((a, b) => {
    const rankDiff = rank(a.label) - rank(b.label);
    if (rankDiff !== 0) return rankDiff;
    return a.label.localeCompare(b.label);
  });
}

function templateReplyPrefix(guide: ReportGuideTemplateId): string {
  if (guide === "campaign_pivot") return "Campaign pivot plan generated using deterministic report template.";
  if (guide === "retention_risk_plan") return "Retention risk plan generated using deterministic report template.";
  return "Board pack summary generated using deterministic report template.";
}

/** Produces a deterministic report refinement response from prior structured artifacts plus explicit guide intent. */
function buildDeterministicReportRefinement(payload: ReportArtifactRefinePayload): {
  structured: StewardStructuredResponsePayload;
  reply: string;
  appliedFilters: string[];
  layoutHint: ReportLayoutHint;
  guideTemplate: ReportGuideTemplateId;
  revisionLabel: string;
} {
  const baseStructured = payload.structured ?? {
    version: 1,
    replyMarkdown: payload.replyContent ?? "",
    artifacts: [],
    suggestedActions: [],
    evidence: [],
  };

  const prompt = String(payload.prompt ?? "").trim();
  const guideTemplate = detectGuideTemplate(prompt, payload.guideTemplate);
  const guideConfig = REPORT_GUIDE_TEMPLATES.find((template) => template.id === guideTemplate) ?? REPORT_GUIDE_TEMPLATES[0];
  const layoutHint = detectLayoutHint(prompt, payload.layoutHint ?? guideConfig.layoutHint);
  const appliedFilters = [
    ...new Set([
      ...guideConfig.defaultFilters,
      ...normalizeReportFilters(payload.filters),
      ...inferFilterHintsFromPrompt(prompt),
    ]),
  ].slice(0, 20);

  const metrics = orderMetricsByGuide(collectMetricRecord(baseStructured.artifacts), guideTemplate);
  const coreInsights = metrics.slice(0, 5).map((metric) => `${metric.label}: ${metric.value}${metric.delta ? ` (${metric.delta})` : ""}`);
  const existingEvidence = (baseStructured.evidence ?? []).slice(0, 10);

  const revisionTitle = payload.title || "Refined Report Artifact";
  const deterministicNotes = [
    templateReplyPrefix(guideTemplate),
    `Layout: ${layoutHint}.`,
    `Filters: ${appliedFilters.join(", ") || "none"}.`,
    prompt ? `Requested update: ${prompt}` : "Requested update: applied template defaults.",
  ];

  const nextReportCard = {
    ...(baseStructured.artifacts.find((artifact) => artifact.type === "report_card") ?? {}),
    type: "report_card",
    title: revisionTitle,
    description: guideConfig.description,
    metrics,
    layoutHint,
    appliedFilters,
    guideTemplate,
    deepLink: payload.path ?? "/reports/giving-summary",
    deepLinkLabel: "View Full Report",
  } as Record<string, unknown>;

  const existingChart = baseStructured.artifacts.find((artifact) => artifact.type === "chart");
  const artifacts: Array<Record<string, unknown>> = [nextReportCard];
  if (existingChart) {
    artifacts.push({
      ...(existingChart as Record<string, unknown>),
      layoutHint,
      appliedFilters,
      guideTemplate,
    });
  }

  const suggestedActions: StewardSuggestedActionPayload[] = [
    {
      label: "Open Refined Report",
      actionType: "open_report",
      requiresConfirmation: false,
      payload: { path: payload.path ?? "/reports/giving-summary", template: guideTemplate, layout: layoutHint },
    },
    {
      label: guideTemplate === "board_pack" ? "Prepare Board Briefing" : guideTemplate === "campaign_pivot" ? "Queue Campaign Pivot Tasks" : "Queue Retention Follow-Ups",
      actionType: "guidepath.choose",
      requiresConfirmation: false,
      payload: { prompt: guideConfig.defaultPrompt },
    },
  ];

  const evidence: StewardEvidencePayload[] = [
    ...existingEvidence,
    { label: `Template: ${guideConfig.label}` },
    { label: `Layout: ${layoutHint}` },
    { label: `Filters applied: ${appliedFilters.join(", ") || "none"}` },
    ...coreInsights.map((line) => ({ label: line })),
  ].slice(0, 16);

  const reply = [
    deterministicNotes.join(" "),
    "",
    "Top metric highlights:",
    ...coreInsights.map((line) => `- ${line}`),
    "",
    "Deterministic guide next step:",
    `- ${guideConfig.defaultPrompt}`,
  ].join("\n");

  return {
    reply,
    structured: {
      version: 1,
      replyMarkdown: reply,
      artifacts,
      suggestedActions,
      evidence,
    },
    appliedFilters,
    layoutHint,
    guideTemplate,
    revisionLabel: guideConfig.label,
  };
}

/** Builds a deterministic report card + chart from live CRM data. */
async function buildReportCardResult(context: StewardToolExecutionContext): Promise<ReportCardResult> {
  const toolsUsed: string[] = [];

  const [summaryResult, monthlyResult, totalsSnapshotResult] = await Promise.all([
    executeStewardTool(context, "reports.runSummary", undefined),
    executeStewardTool(context, "reports.runGivingByMonth", undefined),
    executeStewardTool(context, "reports.runTotalsSnapshot", undefined),
  ]);
  toolsUsed.push(summaryResult.tool, monthlyResult.tool, totalsSnapshotResult.tool);

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
  const totalsSnapshot = totalsSnapshotResult.result as {
    windows?: {
      weekly?: { amount?: number; donorTotal?: number; giftCount?: number };
      monthly?: { amount?: number; donorTotal?: number; giftCount?: number };
      fiscalYtd?: { amount?: number; donorTotal?: number; giftCount?: number };
      fiscalFullYear?: { amount?: number; donorTotal?: number; giftCount?: number };
    };
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
  const weeklyTotal = Number(totalsSnapshot.windows?.weekly?.amount ?? weekRevenue);
  const monthlyTotal = Number(totalsSnapshot.windows?.monthly?.amount ?? 0);
  const fiscalTotal = Number(totalsSnapshot.windows?.fiscalYtd?.amount ?? ytdRevenue);
  const donorTotal = Number(totalsSnapshot.windows?.fiscalYtd?.donorTotal ?? 0);

  const reportCardArtifact = {
    type: "report_card",
    title: `YTD Giving Summary — ${fyLabel}`,
    fiscalYearLabel: fyLabel,
    metrics: [
      { label: "YTD Revenue", value: fmtDollar(ytdRevenue), trend: "up" as const },
      { label: "Fiscal Total", value: fmtDollar(fiscalTotal) },
      { label: "Monthly Total", value: fmtDollar(monthlyTotal) },
      { label: "Weekly Total", value: fmtDollar(weeklyTotal) },
      { label: "Donor Total", value: donorTotal.toLocaleString() },
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
    `- **Fiscal total (YTD):** ${fmtDollar(fiscalTotal)}`,
    `- **Monthly total:** ${fmtDollar(monthlyTotal)}`,
    `- **Weekly total:** ${fmtDollar(weeklyTotal)}`,
    donorTotal > 0 ? `- **Donor total (YTD):** ${donorTotal.toLocaleString()} unique donors` : "",
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
  if (mode === "free") {
    return [
      "Ask a follow-up question if you want a narrower answer.",
      "Switch to Draft Outreach or Agentic mode if you want CRM-grounded output.",
    ];
  }

  if (mode === "agentic") {
    return [
      "Review the tool-grounded answer and confirm any write actions before proceeding.",
      "Ask for another pass if you want a different tool or a narrower scope.",
      "Switch to Pure mode if you want an unrestricted no-tools response.",
    ];
  }

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

  if (mode === "writing") {
    return [
      "Choose one audience and tailor the first paragraph to that audience's motivation.",
      "Validate names, campaign references, and gift facts before moving to review.",
      "Save the draft to Communications or Letters for team approval.",
    ];
  }

  if (mode === "llm") {
    return [
      "Convert the strongest recommendation into a concrete workflow or draft asset.",
      "Cross-check important numbers against report views before sending externally.",
      "Use follow-up prompts to refine one path into an executable action plan.",
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
  userIntent?: StewardResponseIntent;
  reply: string;
  toolsUsed: string[];
  recordsUsed: string[];
}): string {
  // Return the reply as-is. The UI renders metadata separately in the "About this answer" panel.
  // Only append next steps when the reply itself does not already end with one.
  const cleaned = options.reply.trim() || "No summary was returned from the CRM data.";
  if (options.userIntent === "draft_email") {
    return normalizeDraftEmailMergeFields(cleaned);
  }
  const hasNextSteps = /next step|recommended|suggest|you can|you should/i.test(cleaned);
  if (!hasNextSteps && (options.mode === "analyze" || options.mode === "ask" || options.mode === "llm" || options.mode === "writing")) {
    const steps = defaultNextStepsByMode(options.mode);
    return `${cleaned}\n\n**What you can do next:**\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;
  }
  return cleaned;
}

/** Normalizes common natural-language placeholders to canonical Email Builder merge fields. */
function normalizeDraftEmailMergeFields(reply: string): string {
  const replacements: Array<{ pattern: RegExp; token: string }> = [
    { pattern: /`?\[\s*donor\s*name\s*\]`?/gi, token: "{{fullName}}" },
    { pattern: /`?\[\s*full\s*name\s*\]`?/gi, token: "{{fullName}}" },
    { pattern: /`?\[\s*first\s*name\s*\]`?/gi, token: "{{preferredName}}" },
    { pattern: /`?\[\s*preferred\s*name\s*\]`?/gi, token: "{{preferredName}}" },
    { pattern: /`?\[\s*amount\s*\]`?/gi, token: "{{lastGiftAmount}}" },
    { pattern: /`?\[\s*gift\s*amount\s*\]`?/gi, token: "{{lastGiftAmount}}" },
    { pattern: /`?\[\s*date\s*\]`?/gi, token: "{{lastGiftDate}}" },
    { pattern: /`?\[\s*gift\s*date\s*\]`?/gi, token: "{{lastGiftDate}}" },
    { pattern: /`?\[\s*campaign\s*name\s*\]`?/gi, token: "{{campaignName}}" },
    { pattern: /`?\[\s*campaign\s*\]`?/gi, token: "{{campaignName}}" },
    { pattern: /`?\[\s*organization\s*name\s*\]`?/gi, token: "{{organizationName}}" },
    { pattern: /`?\[\s*staff\s*name\s*\]`?/gi, token: "{{staffName}}" },
    { pattern: /`?\[\s*contact\s*information\s*\]`?/gi, token: "{{organizationName}}" },
    { pattern: /`?\[\s*unsubscribe\s*url\s*\]`?/gi, token: "{{unsubscribeUrl}}" },
    { pattern: /`?\[\s*manage\s*preferences\s*url\s*\]`?/gi, token: "{{managePreferencesUrl}}" },
  ];

  let normalized = reply;
  for (const entry of replacements) {
    normalized = normalized.replace(entry.pattern, entry.token);
  }

  return normalized;
}

/** Ensures structured responses always include a dedicated Save Draft Letter action for deterministic UI affordance. */
function withDedicatedSaveDraftLetterAction(
  structured: StewardStructuredResponsePayload
): StewardStructuredResponsePayload {
  if (!structured.replyMarkdown.trim()) return structured;

  const saveDraftAction: StewardSuggestedActionPayload = {
    label: "Save Draft Letter",
    actionType: "letters.create_letter_draft",
    requiresConfirmation: true,
    payload: {
      category: "GENERAL",
    },
  };

  const nextActions = [
    saveDraftAction,
    ...structured.suggestedActions.filter((action) => action.actionType !== saveDraftAction.actionType),
  ].slice(0, 10);

  return {
    ...structured,
    suggestedActions: nextActions,
  };
}

interface DraftEmailParts {
  subject: string;
  previewText: string;
  body: string;
}

/** Extracts strict email sections from AI output and repairs common markdown drift. */
function parseDraftEmailParts(raw: string): DraftEmailParts {
  const normalized = String(raw || "").replace(/\r\n/g, "\n").trim();
  const lines = normalized.split("\n");

  let subject = "";
  let previewText = "";
  const bodyLines: string[] = [];
  let inBody = false;

  for (const line of lines) {
    const clean = line.trim();
    const subjectMatch = clean.match(/^\**\s*subject\s*:\s*(.+)$/i);
    const previewMatch = clean.match(/^\**\s*preview\s*text\s*:\s*(.+)$/i);
    const bodyHeaderMatch = clean.match(/^\**\s*body\s*:\s*(.*)$/i);

    if (subjectMatch) {
      subject = subjectMatch[1]?.trim() || subject;
      continue;
    }

    if (previewMatch) {
      previewText = previewMatch[1]?.trim() || previewText;
      continue;
    }

    if (bodyHeaderMatch) {
      inBody = true;
      const firstLine = bodyHeaderMatch[1]?.trim();
      if (firstLine) bodyLines.push(firstLine);
      continue;
    }

    if (inBody) {
      bodyLines.push(line);
      continue;
    }
  }

  // Fallback: if no explicit body header, treat remaining content as body after removing known headers.
  if (bodyLines.length === 0) {
    const fallbackBody = lines
      .filter((line) => !/^\**\s*(subject|preview\s*text)\s*:/i.test(line.trim()))
      .join("\n")
      .trim();
    if (fallbackBody) bodyLines.push(fallbackBody);
  }

  const finalSubject = normalizeDraftEmailMergeFields(subject || "Thank You For Your Support");
  const finalPreview = normalizeDraftEmailMergeFields(previewText || "A quick update on the impact your support is making.");
  const finalBody = normalizeDraftEmailMergeFields(bodyLines.join("\n").trim() || "Dear {{preferredName}},\n\nThank you for your support.\n\nWith gratitude,\n{{organizationName}}");

  return {
    subject: finalSubject,
    previewText: finalPreview,
    body: finalBody,
  };
}

/** Serializes parsed draft email parts into the strict Steward response contract shape. */
function serializeDraftEmailParts(parts: DraftEmailParts): string {
  return [
    "```email",
    `Subject: ${parts.subject}`,
    `Preview Text: ${parts.previewText}`,
    "",
    "Body:",
    parts.body,
    "```",
  ].join("\n");
}

/** Runs the dedicated draft email pipeline as a single-pass combined call.
 * Previously 3 sequential blocking calls (draft → review → format); collapsed to 1 to avoid
 * consuming the full timeout budget three times. deepseek-r1 handles self-review internally
 * via its <think> pass, so a separate review stage adds latency without quality gain.
 */
async function runDraftEmailPipeline(options: {
  organizationId: string;
  enabled: boolean;
  config: ReturnType<typeof parseStewardAiConfig>;
  mode: StewardChatMode;
  userQuery: string;
  contextText: string;
  reasoningModel: string;
}): Promise<{ content: string; model: string; toolsUsed: string[] }> {
  const toolsUsed: string[] = [];

  // Give the model enough time for its <think> pass plus generation (deepseek-r1 needs ~60s for thinking alone).
  const pipelineConfig = { ...options.config, timeoutMs: Math.max(options.config.timeoutMs, 180_000) };
  console.log("[steward-ai/emailPipeline] Single-pass call — timeoutMs:", pipelineConfig.timeoutMs, "model:", options.reasoningModel);

  const combinedPrompt = [
    "You are Steward, the nonprofit donor CRM assistant.",
    "Write a complete, sendable donor email directly in final ready-to-review format.",
    "",
    "Output ONLY these three sections with these exact plain-text headers (no markdown bold, no asterisks, no extra text before or after):",
    "Subject: <single descriptive subject line>",
    "Preview Text: <1-2 sentence inbox preview>",
    "Body:",
    "<email body in natural paragraphs>",
    "",
    "Requirements:",
    "- Tone: warm, mission-centered, grateful, and human — not generic or salesy.",
    "- Keep body to 3-5 paragraphs suitable for an email (not a long letter).",
    "- Use merge fields for personalization where personal/gift data is missing or variable:",
    "  {{preferredName}}, {{fullName}}, {{lastGiftAmount}}, {{lastGiftDate}}, {{campaignName}},",
    "  {{organizationName}}, {{staffName}}, {{unsubscribeUrl}}, {{managePreferencesUrl}}",
    "- Use CRM data from the context below when available; do not invent specifics.",
    "- Do not include markdown bold markers, tool traces, JSON, or raw CRM field dumps.",
    "- Do not add extra sections (no P.S., no call-to-action blocks unless the user asked).",
    "",
    "User request:",
    options.userQuery || "(no request provided)",
    "",
    "CRM context:",
    options.contextText || "No retrieval context available.",
  ].join("\n");

  const result = await withStewardAiTask(
    {
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: pipelineConfig,
      label: "Writing donor email draft",
      status: "running_task",
      fallbackOnError: true,
    },
    () => runStewardAiChat(
      pipelineConfig,
      [{ role: "system", content: combinedPrompt }],
      {
        model: options.reasoningModel,
        temperature: 0.3,
        maxTokens: 1400,
      }
    )
  );
  toolsUsed.push("email.pipeline.draft");

  const parsed = parseDraftEmailParts(result.content);
  return {
    content: serializeDraftEmailParts(parsed),
    model: result.model,
    toolsUsed,
  };
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

  const isDraftAsk = /(thank\s*you|draft|write|email|letter|message)/i.test(options.userQuery);
  const recoveryAction = isDraftAsk
    ? "Reply with \"continue\" and I will draft the thank-you note immediately using this context."
    : "Reply with \"continue\" and I will turn this into a concise action plan immediately.";

  return [
    "The AI model did not return a response, but here is what the CRM currently shows for your question:",
    options.userQuery ? `> ${options.userQuery}` : "",
    contextLines.map((line) => `- ${line.replace(/^-\s*/, "")}`).join("\n"),
    "**Recovery mode:** I used deterministic CRM evidence so you can keep moving.",
    recoveryAction,
  ].filter(Boolean).join("\n\n");
}

/** Attempts a non-stream rescue completion after an empty assistant response. */
async function runRescueCompletion(options: {
  config: ReturnType<typeof parseStewardAiConfig>;
  mode: StewardChatMode;
  userQuery: string;
  contextText: string;
  normalizedMessages: StewardAiChatMessage[];
}): Promise<{ content: string; model: string }> {
  const rescuePrompt = [
    "You are Steward rescue mode.",
    "The prior generation returned empty output.",
    "Produce a useful response now using available CRM context.",
    "If details are missing, make reasonable defaults and proceed.",
    "Ask one concise follow-up only when execution safety truly requires it.",
    "Do not mention internal tools or system failures.",
    `Chat mode: ${options.mode}`,
    "User query:",
    options.userQuery || "(empty query)",
    "CRM context:",
    options.contextText || "No retrieval context available.",
  ].join("\n\n");

  return runStewardAiChat(
    options.config,
    [
      { role: "system", content: rescuePrompt },
      ...options.normalizedMessages,
    ],
    {
      model: resolveThinkingModel(options.config),
      temperature: 0.1,
      maxTokens: 1000,
    }
  );
}

/** Raises reply token budgets for thinking mode so answers do not truncate mid-response. */
function recommendedReplyMaxTokens(
  config: ReturnType<typeof parseStewardAiConfig>,
  userIntent: StewardResponseIntent
): number {
  const thinkingFloor = config.reasoningMode === "thinking" ? 1400 : 900;
  const draftFloor = userIntent === "draft_email" ? 1400 : 0;
  return Math.max(config.maxTokens, thinkingFloor, draftFloor);
}

/** Heuristic detector for replies that appear cut off before completion. */
function isLikelyTruncatedReply(content: string): boolean {
  const trimmed = content.trim();
  if (!trimmed) return true;

  const fenceCount = (trimmed.match(/```/g) ?? []).length;
  if (fenceCount % 2 === 1) return true;

  const lastLine = trimmed.split("\n").at(-1)?.trim() ?? "";
  if (lastLine.startsWith("|") && !lastLine.endsWith("|")) return true;
  if (/[,;:\-([{/]\s*$/.test(trimmed)) return true;
  if (/\b(and|or|with|for|to|of|in|on|the|a|an)\s*$/i.test(trimmed)) return true;

  return false;
}

/** Merges continuation output with overlap trimming to avoid repeated text seams. */
function mergeReplyContinuation(baseReply: string, continuationReply: string): { merged: string; appended: string } {
  const base = baseReply.trimEnd();
  const continuation = continuationReply.trimStart();
  if (!continuation) return { merged: base, appended: "" };

  let overlap = 0;
  const maxOverlap = Math.min(220, base.length, continuation.length);
  for (let len = maxOverlap; len >= 24; len -= 1) {
    if (base.slice(-len).toLowerCase() === continuation.slice(0, len).toLowerCase()) {
      overlap = len;
      break;
    }
  }

  const appendedCore = continuation.slice(overlap).trimStart();
  if (!appendedCore) return { merged: base, appended: "" };

  const separator = base.endsWith("\n") ? "" : "\n";
  return {
    merged: `${base}${separator}${appendedCore}`,
    appended: `${separator}${appendedCore}`,
  };
}

/** Runs one continuation pass when model output appears truncated mid-response. */
async function continueTruncatedReply(options: {
  organizationId: string;
  enabled: boolean;
  config: ReturnType<typeof parseStewardAiConfig>;
  runtimeSystemPrompt: string;
  normalizedMessages: StewardAiChatMessage[];
  userIntent: StewardResponseIntent;
  partialReply: string;
}): Promise<{ mergedContent: string; appendedDelta: string; model: string } | null> {
  if (!isLikelyTruncatedReply(options.partialReply)) {
    return null;
  }

  const continuationPrompt = [
    "Continue the previous assistant reply from the exact stopping point.",
    "Do not restart or repeat what is already written.",
    "Finish any incomplete sentence, list, or markdown table.",
    "Keep the same tone and format as the existing reply.",
  ].join("\n");

  const continuation = await withStewardAiTask(
    {
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: options.config,
      label: "Completing truncated response",
      status: "running_task",
      fallbackOnError: true,
    },
    () => runStewardAiChat(
      options.config,
      [
        { role: "system", content: options.runtimeSystemPrompt },
        ...options.normalizedMessages,
        { role: "assistant", content: options.partialReply },
        { role: "user", content: continuationPrompt },
      ],
      {
        model: resolveThinkingModel(options.config),
        temperature: 0.1,
        maxTokens: Math.max(700, Math.floor(recommendedReplyMaxTokens(options.config, options.userIntent) * 0.6)),
      }
    )
  );

  if (!continuation.content?.trim()) {
    return null;
  }

  const merged = mergeReplyContinuation(options.partialReply, continuation.content);
  if (!merged.appended.trim()) {
    return null;
  }

  return {
    mergedContent: merged.merged,
    appendedDelta: merged.appended,
    model: continuation.model,
  };
}

/** Picks the effective thinking model, falling back to the primary model when unset. */
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

/** GET /api/steward-ai/memory/preferences — Returns per-user memory controls. */
router.get("/memory/preferences", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const preference = await getOrCreateAiMemoryPreference(organizationId, userId);
  res.json({
    data: {
      memoryEnabled: preference.memoryEnabled,
      fileContextEnabled: preference.fileContextEnabled,
      updatedAt: preference.updatedAt.toISOString(),
    },
  });
});

/** PUT /api/steward-ai/memory/preferences — Updates per-user memory controls. */
router.put("/memory/preferences", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const body = req.body as { memoryEnabled?: boolean; fileContextEnabled?: boolean };
  const preference = await getOrCreateAiMemoryPreference(organizationId, userId);
  const updated = await prisma.aiMemoryPreference.update({
    where: { id: preference.id },
    data: {
      memoryEnabled: typeof body.memoryEnabled === "boolean" ? body.memoryEnabled : preference.memoryEnabled,
      fileContextEnabled: typeof body.fileContextEnabled === "boolean" ? body.fileContextEnabled : preference.fileContextEnabled,
    },
  });

  await logAudit({
    action: "STEWARD_MEMORY_PREFERENCES_UPDATED",
    entity: "AiMemoryPreference",
    entityId: updated.id,
    userId,
    organizationId,
    metadata: {
      memoryEnabled: updated.memoryEnabled,
      fileContextEnabled: updated.fileContextEnabled,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    data: {
      memoryEnabled: updated.memoryEnabled,
      fileContextEnabled: updated.fileContextEnabled,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
});

/** GET /api/steward-ai/memories — Lists current user's saved memories. */
router.get("/memories", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const q = asSafeText(req.query.q, "", 160);
  const category = normalizeMemoryCategory(req.query.category);
  const hasCategory = typeof req.query.category === "string" && req.query.category.trim().length > 0;
  const workspaceScope = normalizeWorkspaceScope(req.query.workspaceScope);
  const activeRaw = String(req.query.active ?? "all").toLowerCase();

  const memories = await prisma.aiUserMemory.findMany({
    where: {
      organizationId,
      userId,
      ...(activeRaw === "true" ? { active: true } : activeRaw === "false" ? { active: false } : {}),
      ...(hasCategory ? { category } : {}),
      ...(workspaceScope ? { workspaceScope } : {}),
      ...(q ? {
        OR: [
          { title: { contains: q } },
          { content: { contains: q } },
        ],
      } : {}),
    },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  res.json({ data: memories.map(publicMemory) });
});

/** POST /api/steward-ai/memories — Manually creates a user memory. */
router.post("/memories", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const payload = req.body as AiMemoryPayload;
  const content = asSafeText(payload.content, "", 2400);
  if (content.length < 3) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Memory content is required." } });
    return;
  }

  const memory = await prisma.aiUserMemory.create({
    data: {
      organizationId,
      userId,
      title: asSafeText(payload.title, content.split(/[.!?\n]/)[0] || "Saved memory", 160),
      content,
      category: normalizeMemoryCategory(payload.category),
      source: asSafeText(payload.source, "manual", 60),
      confidence: typeof payload.confidence === "number" ? Math.min(Math.max(payload.confidence, 0), 1) : 1,
      active: payload.active !== false,
      workspaceScope: normalizeWorkspaceScope(payload.workspaceScope),
    },
  });

  await logAudit({
    action: "STEWARD_MEMORY_CREATED",
    entity: "AiUserMemory",
    entityId: memory.id,
    userId,
    organizationId,
    metadata: { category: memory.category, source: memory.source, workspaceScope: memory.workspaceScope },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({ data: publicMemory(memory) });
});

/** POST /api/steward-ai/memory-tool/save — Dedicated LLM/tool endpoint for saving durable memories. */
router.post("/memory-tool/save", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const preference = await getOrCreateAiMemoryPreference(organizationId, userId);
  if (!preference.memoryEnabled) {
    res.status(409).json({ error: { code: "MEMORY_DISABLED", message: "Memory is disabled for this user." } });
    return;
  }

  const payload = req.body as AiMemoryPayload;
  const content = asSafeText(payload.content, "", 2400);
  if (content.length < 12) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Memory tool requires durable, reusable content." } });
    return;
  }

  const memory = await prisma.aiUserMemory.create({
    data: {
      organizationId,
      userId,
      title: asSafeText(payload.title, content.split(/[.!?\n]/)[0] || "Steward saved memory", 160),
      content,
      category: normalizeMemoryCategory(payload.category),
      source: asSafeText(payload.source, "llm_memory_tool", 60),
      confidence: typeof payload.confidence === "number" ? Math.min(Math.max(payload.confidence, 0), 1) : 0.75,
      active: payload.active !== false,
      workspaceScope: normalizeWorkspaceScope(payload.workspaceScope),
    },
  });

  await logAudit({
    action: "STEWARD_MEMORY_TOOL_SAVED",
    entity: "AiUserMemory",
    entityId: memory.id,
    userId,
    organizationId,
    metadata: { category: memory.category, source: memory.source, confidence: memory.confidence },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({ data: publicMemory(memory) });
});

/** PUT /api/steward-ai/memories/:id — Edits or disables one memory. */
router.put("/memories/:id", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const existing = await prisma.aiUserMemory.findFirst({
    where: { id: req.params.id, organizationId, userId },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Memory not found." } });
    return;
  }

  const payload = req.body as AiMemoryPayload;
  const updated = await prisma.aiUserMemory.update({
    where: { id: existing.id },
    data: {
      title: payload.title !== undefined ? asSafeText(payload.title, existing.title, 160) : existing.title,
      content: payload.content !== undefined ? asSafeText(payload.content, existing.content, 2400) : existing.content,
      category: payload.category !== undefined ? normalizeMemoryCategory(payload.category) : existing.category,
      active: typeof payload.active === "boolean" ? payload.active : existing.active,
      workspaceScope: payload.workspaceScope !== undefined ? normalizeWorkspaceScope(payload.workspaceScope) : existing.workspaceScope,
    },
  });

  await logAudit({
    action: "STEWARD_MEMORY_UPDATED",
    entity: "AiUserMemory",
    entityId: updated.id,
    userId,
    organizationId,
    metadata: { active: updated.active, category: updated.category, workspaceScope: updated.workspaceScope },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ data: publicMemory(updated) });
});

/** DELETE /api/steward-ai/memories/:id — Deletes one memory. */
router.delete("/memories/:id", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const existing = await prisma.aiUserMemory.findFirst({
    where: { id: req.params.id, organizationId, userId },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Memory not found." } });
    return;
  }

  await prisma.aiUserMemory.delete({ where: { id: existing.id } });
  await logAudit({
    action: "STEWARD_MEMORY_DELETED",
    entity: "AiUserMemory",
    entityId: existing.id,
    userId,
    organizationId,
    metadata: { title: existing.title },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ data: { deleted: true } });
});

/** POST /api/steward-ai/memories/clear — Deletes all current-user memories. */
router.post("/memories/clear", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const result = await prisma.aiUserMemory.deleteMany({ where: { organizationId, userId } });
  await logAudit({
    action: "STEWARD_MEMORY_CLEARED",
    entity: "AiUserMemory",
    userId,
    organizationId,
    metadata: { deletedCount: result.count },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ data: { deletedCount: result.count } });
});

/** GET /api/steward-ai/context-files — Lists current user's AI Context Library. */
router.get("/context-files", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const q = asSafeText(req.query.q, "", 160);
  const workspaceScope = normalizeWorkspaceScope(req.query.workspaceScope);
  const files = await prisma.aiContextFile.findMany({
    where: {
      organizationId,
      userId,
      ...(workspaceScope ? { workspaceScope } : {}),
      ...(q ? {
        OR: [
          { displayName: { contains: q } },
          { fileName: { contains: q } },
          { description: { contains: q } },
        ],
      } : {}),
    },
    include: { _count: { select: { chunks: true } } },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });

  res.json({ data: files.map(publicContextFile) });
});

/** POST /api/steward-ai/context-files — Uploads/indexes a text-extracted context file. */
router.post("/context-files", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const payload = req.body as AiContextFilePayload;
  const fileName = asSafeText(payload.fileName, "", 255);
  if (!fileName) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "fileName is required." } });
    return;
  }

  const extractedText = safeMemoryText(payload.extractedText, "", 250000);
  const description = safeMemoryText(payload.description, "", 4000);
  const tags = normalizeTags(payload.tags);
  const file = await prisma.aiContextFile.create({
    data: {
      organizationId,
      userId,
      fileName,
      displayName: asSafeText(payload.displayName, fileName, 255),
      mimeType: asSafeText(payload.mimeType, "application/octet-stream", 120),
      fileType: asSafeText(payload.fileType, "unknown", 40),
      sizeBytes: typeof payload.sizeBytes === "number" && Number.isFinite(payload.sizeBytes)
        ? Math.max(0, Math.floor(payload.sizeBytes))
        : 0,
      workspaceScope: normalizeWorkspaceScope(payload.workspaceScope),
      description: description || null,
      tags: jsonTags(tags),
      indexingStatus: extractedText ? "pending" : "needs_text",
      active: true,
      extractedText: extractedText || null,
      contentHash: extractedText ? createContentHash(extractedText) : null,
    },
    include: { _count: { select: { chunks: true } } },
  });

  if (extractedText) {
    await replaceContextChunks({ organizationId, userId, fileId: file.id, extractedText });
  }

  const saved = await prisma.aiContextFile.findUniqueOrThrow({
    where: { id: file.id },
    include: { _count: { select: { chunks: true } } },
  });

  await logAudit({
    action: "STEWARD_CONTEXT_FILE_UPLOADED",
    entity: "AiContextFile",
    entityId: saved.id,
    userId,
    organizationId,
    metadata: { fileName: saved.fileName, indexingStatus: saved.indexingStatus, workspaceScope: saved.workspaceScope },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json({ data: publicContextFile(saved) });
});

/** PUT /api/steward-ai/context-files/:id — Updates one context source. */
router.put("/context-files/:id", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const existing = await prisma.aiContextFile.findFirst({
    where: { id: req.params.id, organizationId, userId },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Context file not found." } });
    return;
  }

  const payload = req.body as AiContextFilePayload & { active?: boolean };
  const extractedText = payload.extractedText !== undefined ? safeMemoryText(payload.extractedText, "", 250000) : undefined;

  const updated = await prisma.aiContextFile.update({
    where: { id: existing.id },
    data: {
      displayName: payload.displayName !== undefined ? asSafeText(payload.displayName, existing.displayName, 255) : existing.displayName,
      workspaceScope: payload.workspaceScope !== undefined ? normalizeWorkspaceScope(payload.workspaceScope) : existing.workspaceScope,
      description: payload.description !== undefined ? safeMemoryText(payload.description, "", 4000) || null : existing.description,
      tags: payload.tags !== undefined ? jsonTags(normalizeTags(payload.tags)) : (existing.tags as Prisma.InputJsonValue),
      active: typeof payload.active === "boolean" ? payload.active : existing.active,
      extractedText: extractedText !== undefined ? extractedText || null : existing.extractedText,
      contentHash: extractedText !== undefined && extractedText ? createContentHash(extractedText) : existing.contentHash,
      indexingStatus: extractedText !== undefined ? (extractedText ? "pending" : "needs_text") : existing.indexingStatus,
    },
    include: { _count: { select: { chunks: true } } },
  });

  if (extractedText !== undefined) {
    await replaceContextChunks({ organizationId, userId, fileId: updated.id, extractedText });
  }

  const saved = await prisma.aiContextFile.findUniqueOrThrow({
    where: { id: updated.id },
    include: { _count: { select: { chunks: true } } },
  });

  await logAudit({
    action: "STEWARD_CONTEXT_FILE_UPDATED",
    entity: "AiContextFile",
    entityId: saved.id,
    userId,
    organizationId,
    metadata: { active: saved.active, indexingStatus: saved.indexingStatus, workspaceScope: saved.workspaceScope },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ data: publicContextFile(saved) });
});

/** POST /api/steward-ai/context-files/:id/reindex — Rebuilds chunks from stored extracted text. */
router.post("/context-files/:id/reindex", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const file = await prisma.aiContextFile.findFirst({ where: { id: req.params.id, organizationId, userId } });
  if (!file) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Context file not found." } });
    return;
  }

  await replaceContextChunks({ organizationId, userId, fileId: file.id, extractedText: file.extractedText ?? "" });
  const saved = await prisma.aiContextFile.findUniqueOrThrow({
    where: { id: file.id },
    include: { _count: { select: { chunks: true } } },
  });

  await logAudit({
    action: "STEWARD_CONTEXT_FILE_REINDEXED",
    entity: "AiContextFile",
    entityId: saved.id,
    userId,
    organizationId,
    metadata: { indexingStatus: saved.indexingStatus, chunkCount: saved._count.chunks },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ data: publicContextFile(saved) });
});

/** DELETE /api/steward-ai/context-files/:id — Deletes one context source and its chunks. */
router.delete("/context-files/:id", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  const userId = req.user?.sub;
  if (!organizationId || !userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication is required." } });
    return;
  }

  const existing = await prisma.aiContextFile.findFirst({
    where: { id: req.params.id, organizationId, userId },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Context file not found." } });
    return;
  }

  await prisma.aiContextFile.delete({ where: { id: existing.id } });
  await logAudit({
    action: "STEWARD_CONTEXT_FILE_DELETED",
    entity: "AiContextFile",
    entityId: existing.id,
    userId,
    organizationId,
    metadata: { fileName: existing.fileName },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ data: { deleted: true } });
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
/**
 * Deterministic report artifact refinement endpoint.
 * This route transforms report artifacts intentionally (guide template + layout + filters)
 * instead of re-running broad chat generation.
 */
router.post("/report-artifact/refine", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = req.body as ReportArtifactRefinePayload;
  const refinement = buildDeterministicReportRefinement(payload);

  await logAudit({
    action: "STEWARD_REPORT_ARTIFACT_REFINED",
    entity: "PluginSetting",
    entityId: STEWARD_AI_PLUGIN_KEY,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      route: payload.path ?? "/reports/giving-summary",
      guideTemplate: refinement.guideTemplate,
      layoutHint: refinement.layoutHint,
      filters: refinement.appliedFilters,
      promptPreview: String(payload.prompt ?? "").slice(0, 280),
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    data: {
      reply: refinement.reply,
      structured: refinement.structured,
      guideTemplate: refinement.guideTemplate,
      layoutHint: refinement.layoutHint,
      appliedFilters: refinement.appliedFilters,
      revisionLabel: refinement.revisionLabel,
      guideTemplates: REPORT_GUIDE_TEMPLATES,
    },
  });
});

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
  const contextWindow = buildSafeRollingContextWindow(payload.messages);
  const normalizedMessages = contextWindow.normalizedMessages;

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
  const userIntent = detectStewardIntent(latestUserMessage, mode);
  const responseContract = [
    buildIntentResponseContract(userIntent),
    isReportQuestion(latestUserMessage)
      ? [
          "Report format requirement: output as professional markdown.",
          "Use markdown headings, concise sections, and bullet lists for KPIs.",
          "Do not output raw HTML.",
        ].join("\n")
      : "",
  ].filter(Boolean).join("\n\n");
  const clientReportingYearMode = payload.reportingYearMode === "fiscal" ? "fiscal" : "calendar";
  const clientFiscalYear = typeof payload.fiscalYear === "number" ? payload.fiscalYear : undefined;
  const clientFiscalYearStart = typeof payload.fiscalYearStart === "number" ? payload.fiscalYearStart : undefined;
  const thoughtStackEnabled = payload.thoughtStackEnabled !== false;
  const forcedToolNames = normalizeForcedToolNames(payload.forcedTools);
  const workspaceNoteTitle = asSafeText(payload.workspaceNotes?.title, "Workspace Notepad", 120);
  const workspaceNoteContent = asSafeText(payload.workspaceNotes?.content, "", 12000);
  const workspaceNoteVersion = typeof payload.workspaceNotes?.version === "number" ? payload.workspaceNotes.version : 1;
  const workspaceNoteIsSourceOfTruth = payload.workspaceNotes?.sourceOfTruth !== false;

  // Extract constituent IDs from @mentioned donors in the chat composer
  const mentionedConstituentIds = Array.isArray(payload.donorContext)
    ? payload.donorContext
        .map((d) => (typeof d?.id === "string" ? d.id.trim() : ""))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const taggedDonorFocus = moduleKey === "donor" && mentionedConstituentIds.length > 0;
  const explicitSavedMemory = await saveExplicitMemoryFromText({
    organizationId,
    userId: req.user?.sub ?? "",
    text: latestUserMessage,
    workspaceScope: scopeFromModuleKey(moduleKey),
  }).catch(() => null);
  if (explicitSavedMemory) {
    await logAudit({
      action: "STEWARD_MEMORY_EXPLICIT_CHAT_SAVED",
      entity: "AiUserMemory",
      entityId: explicitSavedMemory.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { category: explicitSavedMemory.category, workspaceScope: explicitSavedMemory.workspaceScope },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  // ── Debug logging ────────────────────────────────────────────────────────────
  console.log("[steward-ai/stream] REQUEST", JSON.stringify({
    organizationId,
    moduleKey,
    mode,
    userIntent,
    taggedDonorFocus,
    mentionedConstituentIds,
    messageCount: normalizedMessages.length,
    contextWindowTotalInputMessages: contextWindow.totalInputMessages,
    contextWindowDroppedMessages: contextWindow.droppedMessages,
    contextWindowKeptChars: contextWindow.keptChars,
    forcedToolNames,
    workspaceNoteAttached: workspaceNoteContent.length > 0,
    workspaceNoteChars: workspaceNoteContent.length,
    latestUserMessage,
    donorContext: payload.donorContext,
  }, null, 2));
  const _streamLines: string[] = [];
  const _origWrite = res.write.bind(res);
  res.write = (chunk: unknown, ...args: unknown[]) => {
    if (typeof chunk === "string") _streamLines.push(chunk.trimEnd());
    return (_origWrite as (...a: unknown[]) => boolean)(chunk, ...args);
  };

  /** Sends a human-readable progress update to the client during pipeline stages. */
  function writeProgress(message: string, stage: "retrieve" | "plan" | "generate" = "retrieve", percent = 0): void {
    res.write(`${JSON.stringify({ type: "progress", message, stage, percent })}\n`);
  }

  /** Emits a tool lifecycle event so the client can show which CRM tool is running. */
  function writeTool(name: string, label: string, status: "start" | "done" = "start"): void {
    res.write(`${JSON.stringify({ type: "tool", name, label, status })}\n`);
  }

  // Beta safety: keep raw reasoning private unless explicitly re-enabled for debugging.
  const STREAM_THINKING_TO_CLIENT = false;

  /** Sends a thinking/reasoning delta to the client (DeepSeek reasoning tokens). */
  function writeThinking(delta: string): void {
    if (!STREAM_THINKING_TO_CLIENT) return;
    res.write(`${JSON.stringify({ type: "thinking", delta })}\n`);
  }

  const thoughtStack = thoughtStackEnabled
    ? buildThoughtStackAssessment({
        mode,
        moduleKey,
        userIntent,
        userQuery: latestUserMessage,
      })
    : {
        state: "Ready to Act",
        confidence: "high",
        riskLevel: "low",
        requiresConfirmation: false,
        dryRunRecommended: false,
        selectedWorkflow: "thoughtstack.disabled.beta",
        missingDetails: [] as string[],
        summaryLines: ["ThoughtStack disabled by user for this chat."],
        structured: undefined,
      };

  if (thoughtStackEnabled && thoughtStack.structured) {
    const structured = thoughtStack.structured;
    const reply = structured.replyMarkdown || "ThoughtStack requires additional confirmation before continuing.";
    res.write(`${JSON.stringify({ type: "chunk", delta: reply })}\n`);
    res.write(`${JSON.stringify({
      type: "done",
      reply,
      structured,
      model: "thoughtstack",
      mode,
      runtimeMode: config.mode,
      provider: "thoughtstack",
      toolsUsed: ["thoughtstack.assess", thoughtStack.selectedWorkflow],
      recordsUsed: [],
      moduleKey,
      scopePath,
    })}\n`);
    res.end();
    return;
  }

  try {
    if (!taggedDonorFocus && forcedToolNames.length === 0 && mode !== "llm" && moduleKey === "donor" && isTopDonorQuestion(latestUserMessage)) {
      writeProgress("Looking up top donor records…", "retrieve", 20);
      const topDonorResult = await buildTopDonorResult({
        organizationId,
        userId: req.user?.sub ?? "",
        role: req.user?.role ?? "readonly",
        moduleKey,
        scopePath,
        requestRoute: req.path,
      });
      const earlyToolsUsed = explicitSavedMemory ? [...topDonorResult.toolsUsed, "memory.saveExplicit"] : topDonorResult.toolsUsed;
      const templatedReply = formatReplyByMode({
        mode,
        userIntent,
        reply: topDonorResult.reply,
        toolsUsed: earlyToolsUsed,
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
        toolsUsed: earlyToolsUsed,
        recordsUsed: topDonorResult.recordsUsed,
        moduleKey,
        scopePath,
      })}\n`);
      console.log("[steward-ai/stream] RESPONSE (top-donor fast path, " + _streamLines.length + " lines):\n" + _streamLines.join("\n"));
      res.end();
      return;
    }

    if (!taggedDonorFocus && forcedToolNames.length === 0 && mode !== "llm" && moduleKey === "donor" && isReportQuestion(latestUserMessage)) {
      writeProgress("Running YTD giving report…", "retrieve", 20);
      const reportResult = await buildReportCardResult({
        organizationId,
        userId: req.user?.sub ?? "",
        role: req.user?.role ?? "readonly",
        moduleKey,
        scopePath,
        requestRoute: req.path,
      });
      res.write(`${JSON.stringify({ type: "chunk", delta: reportResult.reply })}\n`);
      const earlyToolsUsed = explicitSavedMemory ? [...reportResult.toolsUsed, "memory.saveExplicit"] : reportResult.toolsUsed;
      res.write(`${JSON.stringify({
        type: "done",
        reply: reportResult.reply,
        structured: reportResult.structured,
        model: "crm-data",
        mode,
        runtimeMode: config.mode,
        provider: "crm-data",
        toolsUsed: earlyToolsUsed,
        recordsUsed: [],
        moduleKey,
        scopePath,
      })}\n`);
      console.log("[steward-ai/stream] RESPONSE (report fast path, " + _streamLines.length + " lines):\n" + _streamLines.join("\n"));
      res.end();
      return;
    }

    // ── Stage 1: Retrieval ──────────────────────────────────────────────────
    const retrieval = mode === "free"
      ? {
          contextText: "Pure mode selected: answer from the user's prompt only. Do not use CRM tools or retrieved records.",
          toolsUsed: [] as string[],
          recordsUsed: [] as string[],
        }
      : await (async () => {
          const retrievalProgressMessages: Record<string, string> = {
            donor:      "Reviewing donor records and giving history…",
            compassion: "Reviewing client and case records…",
            events:     "Reviewing event and registration data…",
            watchdog:   "Reviewing compliance and audit data…",
            webmaster:  "Reviewing site and content data…",
          };
          const retrievalMsg = retrievalProgressMessages[moduleKey] ?? "Reviewing CRM records…";
          writeProgress(retrievalMsg, "retrieve", 10);
          writeTool("context.retrieve", retrievalMsg, "start");

          return buildRetrievalContext({
            organizationId,
            moduleKey,
            mode,
            scopePath,
            userQuery: latestUserMessage,
            userId: req.user?.sub ?? "",
            role: req.user?.role ?? "readonly",
            mentionedConstituentIds: mentionedConstituentIds.length > 0 ? mentionedConstituentIds : undefined,
          });
        })();

    const forcedToolContext = mode === "free"
      ? { contextText: "", toolsUsed: [] as string[], recordsUsed: [] as string[], warnings: [] as string[] }
      : await buildForcedToolContext({
          organizationId,
          userId: req.user?.sub ?? "",
          role: req.user?.role ?? "readonly",
          moduleKey,
          scopePath,
          requestRoute: req.path,
        }, forcedToolNames);

    if (forcedToolContext.toolsUsed.length > 0) {
      writeProgress(`Running ${forcedToolContext.toolsUsed.length} forced tool${forcedToolContext.toolsUsed.length > 1 ? "s" : ""}…`, "retrieve", 36);
      for (const name of forcedToolContext.toolsUsed) {
        writeTool(name, `Forced tool: ${name}`, "done");
      }
    }

    const mergedContextText = [
      retrieval.contextText,
      forcedToolContext.contextText ? `Forced tool context:\n${forcedToolContext.contextText}` : "",
      forcedToolContext.warnings.length > 0 ? `Forced tool warnings:\n${forcedToolContext.warnings.map((w) => `- ${w}`).join("\n")}` : "",
      workspaceNoteContent
        ? [
            `Workspace note: ${workspaceNoteTitle} (v${workspaceNoteVersion})`,
            workspaceNoteIsSourceOfTruth
              ? "Treat this note as the source of truth for in-progress work."
              : "Use this note as additional context.",
            workspaceNoteContent,
            "If the user asks to update this note, prefer suggested actions: workspace.notes.replace / workspace.notes.append / workspace.notes.prepend.",
          ].join("\n")
        : "",
    ].filter(Boolean).join("\n\n");

    const modelContextText = buildModelContextForIntent(mergedContextText, userIntent);
    const combinedRecordsUsed = [...retrieval.recordsUsed, ...forcedToolContext.recordsUsed];

    console.log("[steward-ai/stream] RETRIEVAL", JSON.stringify({
      toolsUsed: [...retrieval.toolsUsed, ...forcedToolContext.toolsUsed],
      recordsUsed: combinedRecordsUsed,
      contextTextLength: mergedContextText.length,
      contextTextPreview: mergedContextText.slice(0, 800),
      forcedToolWarnings: forcedToolContext.warnings,
    }, null, 2));

    if (mode !== "free" && retrieval.toolsUsed.length > 1) {
      writeProgress(`Checking ${retrieval.toolsUsed.length} data sources…`, "retrieve", 40);
      // Emit each retrieval tool as "done" so the client can display them
      const TOOL_LABELS: Record<string, string> = {
        "context.retrieve":                  "Loading CRM context",
        "context.taggedDonorFocus":          "Tagged donor focus",
        "donor.getDailyBrief":               "Loading daily brief",
        "donor.getFullProfile":              "Loading donor profile",
        "donor.getTopDonors":               "Fetching top donors",
        "donor.getSegments":                "Loading donor segments",
        "knowledge.searchCrmRecords":       "Searching CRM records",
        "knowledge.searchUnifiedTimeline":  "Scanning activity timeline",
        "knowledge.findDonorByName":        "Finding donor by name",
        "reports.runSummary":               "Running YTD summary",
        "reports.runGivingByMonth":         "Building monthly chart",
        "reports.runTotalsSnapshot":        "Fetching totals snapshot",
        "compassion.clientLookup":          "Looking up client",
        "compassion.caseFollowupSnapshot":  "Reviewing case follow-ups",
        "events.eventLookup":              "Looking up event",
        "events.guestOpsSnapshot":         "Reviewing guest ops",
        "watchdog.auditSnapshot":          "Scanning audit log",
        "watchdog.accessRiskSummary":      "Reviewing access risks",
        "webmaster.planningContext":       "Loading site planning context",
        "help.guides":                     "Searching help guides",
        "memory.userMemories":             "Loading saved memories",
        "file.contextChunks":             "Reading uploaded files",
      };
      for (const toolName of retrieval.toolsUsed.slice(0, 10)) {
        const label = TOOL_LABELS[toolName] ?? toolName.replace(/\./g, " › ").replace(/_/g, " ");
        writeTool(toolName, label, "done");
      }
    } else if (mode !== "free") {
      writeTool("context.retrieve", "CRM context loaded", "done");
    }

    // ── Stage 2: Agentic multi-stage reasoning ──────────────────────────────
    if (config.agenticMultiStage && mode !== "free") {
      writeProgress("Planning how to answer your question…", "plan", 50);
      writeTool("agentic.prepare", "Multi-stage reasoning", "start");
    }

    const agenticPreparation = await buildAgenticPreparation({
      organizationId,
      enabled: Boolean(setting?.enabled),
      config,
      mode,
      userIntent,
      responseContract,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
      contextText: modelContextText,
    });

    const agenticToolPass = mode === "agentic"
      ? (taggedDonorFocus
          ? {
              notes: ["Agentic read-tool planning skipped because tagged donor focus mode is active."],
              toolsUsed: ["agentic.tools.skipped.taggedDonorFocus"],
            }
          : await buildAgenticToolPass({
              organizationId,
              enabled: Boolean(setting?.enabled),
              config,
              moduleKey,
              scopePath,
              userQuery: latestUserMessage,
              contextText: modelContextText,
              userId: req.user?.sub ?? "",
              role: req.user?.role ?? "readonly",
            }))
      : { notes: [] as string[], toolsUsed: [] as string[] };

    const agenticNotes = [...thoughtStack.summaryLines, ...agenticPreparation.stageSummaries, ...agenticToolPass.notes];
    const agenticToolsUsed = [...agenticPreparation.toolsUsed, ...agenticToolPass.toolsUsed];

    console.log("[steward-ai/stream] AGENTIC_PREP", JSON.stringify({
      reasoningModel: agenticPreparation.reasoningModel,
      stageSummaries: agenticPreparation.stageSummaries,
      toolsUsed: agenticPreparation.toolsUsed,
      agenticToolPassNotes: agenticToolPass.notes,
      agenticToolPassToolsUsed: agenticToolPass.toolsUsed,
    }, null, 2));

    if (agenticPreparation.stageSummaries.length > 0) {
      writeProgress("Verifying data and checking for gaps…", "plan", 62);
      writeTool("agentic.prepare", "Multi-stage reasoning", "done");
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
      userIntent,
      responseContract,
      moduleKey,
      scopePath,
      contextText: modelContextText + `\n\n${yearModeNote}`,
      agenticNotes,
      fiscalYearLabel: resolvedFyLabel,
      calendarYear: resolvedCalendarYear,
    });

    const toolsUsed = [
      ...retrieval.toolsUsed,
      ...forcedToolContext.toolsUsed,
      ...(thoughtStackEnabled ? ["thoughtstack.assess"] : ["thoughtstack.disabled.beta"]),
      ...agenticToolsUsed,
      ...(explicitSavedMemory ? ["memory.saveExplicit"] : []),
    ];
    const responseMaxTokens = recommendedReplyMaxTokens(config, userIntent);
    let provider = agenticPreparation.stageSummaries.length > 0 ? "ollama-agentic" : "ollama";
    let completion: { content: string; model: string };

    console.log("[steward-ai/stream] MODEL_CALL", JSON.stringify({
      model: config.model,
      thinkingModel: config.thinkingModel,
      reasoningModel: agenticPreparation.reasoningModel,
      temperature: config.temperature,
      maxTokens: responseMaxTokens,
      timeoutMs: config.timeoutMs,
      endpointUrl: config.endpointUrl,
      mode: config.mode,
      userIntent,
      systemPromptLength: runtimeSystemPrompt.length,
      systemPromptPreview: runtimeSystemPrompt.slice(0, 600),
      messageCount: normalizedMessages.length,
    }, null, 2));

    writeProgress("Drafting a response…", "generate", 72);
    writeTool("model.generate", "Drafting answer", "start");

    if (userIntent === "draft_email") {
      writeProgress("Writing first-pass email draft…", "generate", 74);
      writeTool("model.generate", "Writing email draft", "start");
      const emailPipeline = await runDraftEmailPipeline({
        organizationId,
        enabled: Boolean(setting?.enabled),
        config,
        mode,
        userQuery: latestUserMessage,
        contextText: modelContextText,
        reasoningModel: agenticPreparation.reasoningModel,
      });
      completion = {
        content: emailPipeline.content,
        model: emailPipeline.model,
      };
      provider = "ollama-email-pipeline";
      toolsUsed.push(...emailPipeline.toolsUsed);
      if (completion.content?.trim()) {
        res.write(`${JSON.stringify({ type: "chunk", delta: completion.content })}\n`);
      }
      writeTool("model.generate", "Writing email draft", "done");
    } else {
      try {
        console.log("[steward-ai/stream] Calling runStewardAiChatStream...");
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
                console.log("[steward-ai/stream] TOKEN_DELTA", JSON.stringify(delta));
                res.write(`${JSON.stringify({ type: "chunk", delta })}\n`);
              },
              onThinkingDelta: (delta) => {
                console.log("[steward-ai/stream] THINKING_DELTA", JSON.stringify(delta));
                writeThinking(delta);
              },
              maxTokens: responseMaxTokens,
            }
          )
        );
        console.log("[steward-ai/stream] MODEL_RAW_COMPLETION", JSON.stringify({
          model: completion.model,
          contentLength: completion.content.length,
          content: completion.content,
        }, null, 2));
      } catch (streamError) {
        const message = streamError instanceof Error ? streamError.message : "";
        if (!/empty assistant response/i.test(message)) {
          throw streamError;
        }

        writeProgress("Primary model returned empty output; attempting recovery generation…", "generate", 78);
        try {
          completion = await runRescueCompletion({
            config,
            mode,
            userQuery: latestUserMessage,
            contextText: modelContextText,
            normalizedMessages,
          });
          provider = "ollama-recovery";
          toolsUsed.push("fallback.recoveryCompletion");
          if (completion.content?.trim()) {
            res.write(`${JSON.stringify({ type: "chunk", delta: completion.content })}\n`);
          }
        } catch {
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
      }
    }

    if (isLikelyTruncatedReply(completion.content)) {
      writeProgress("Finishing response details…", "generate", 90);
      writeTool("model.generate", "Completing response", "start");
      try {
        const continuation = await continueTruncatedReply({
          organizationId,
          enabled: Boolean(setting?.enabled),
          config,
          runtimeSystemPrompt,
          normalizedMessages,
          userIntent,
          partialReply: completion.content,
        });

        if (continuation) {
          completion = {
            content: continuation.mergedContent,
            model: continuation.model || completion.model,
          };
          toolsUsed.push("fallback.continueReply");
          res.write(`${JSON.stringify({ type: "chunk", delta: continuation.appendedDelta })}\n`);
        }
      } catch {
        // Continue with the current reply if continuation recovery fails.
      }
      writeTool("model.generate", "Completing response", "done");
    }

    writeTool("model.generate", "Drafting answer", "done");

    const parsedStructured = normalizeStewardStructuredResponse(completion.content, {
      debug: false,
    });

    const templatedReply = formatReplyByMode({
      mode,
      userIntent,
      reply: parsedStructured.replyMarkdown || completion.content,
      toolsUsed,
      recordsUsed: combinedRecordsUsed,
    });
    const thoughtStackEvidence: StewardEvidencePayload[] = [
      { label: `ThoughtStack state: ${thoughtStack.state}` },
      { label: `ThoughtStack workflow: ${thoughtStack.selectedWorkflow}` },
      { label: `ThoughtStack risk: ${thoughtStack.riskLevel}` },
    ];
    const verificationEvidence = extractVerificationEvidence(agenticToolPass.notes);
    const structured: StewardStructuredResponsePayload = withDedicatedSaveDraftLetterAction({
      ...parsedStructured,
      replyMarkdown: templatedReply,
      evidence: [
        ...thoughtStackEvidence,
        ...verificationEvidence,
        ...parsedStructured.evidence,
      ].slice(0, 16),
    });

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
        thoughtStackState: thoughtStack.state,
        thoughtStackRiskLevel: thoughtStack.riskLevel,
        thoughtStackConfidence: thoughtStack.confidence,
        thoughtStackWorkflow: thoughtStack.selectedWorkflow,
        thoughtStackMissingDetails: thoughtStack.missingDetails,
        thoughtStackRequiresConfirmation: thoughtStack.requiresConfirmation,
        thoughtStackDryRunRecommended: thoughtStack.dryRunRecommended,
        thoughtStackEnabled,
        chatMode: mode,
        userIntent,
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
      recordsUsed: combinedRecordsUsed,
      moduleKey,
      scopePath,
    })}\n`);
    console.log("[steward-ai/stream] RESPONSE (" + _streamLines.length + " lines):\n" + _streamLines.join("\n"));
    res.end();
  } catch (error) {
    console.error("[steward-ai/stream] Unhandled error:", error);
    console.error("[steward-ai/stream] Stream output so far:\n" + _streamLines.join("\n"));
    res.write(`${JSON.stringify({
      type: "error",
      message: error instanceof Error ? error.message : "Steward AI request failed.",
    })}\n`);
    res.end();
  }
});
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
  const contextWindow = buildSafeRollingContextWindow(payload.messages);
  const normalizedMessages = contextWindow.normalizedMessages;

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
  const userIntent = detectStewardIntent(latestUserMessage, mode);
  const responseContract = [
    buildIntentResponseContract(userIntent),
    isReportQuestion(latestUserMessage)
      ? [
          "Report format requirement: output as professional markdown.",
          "Use markdown headings, concise sections, and bullet lists for KPIs.",
          "Do not output raw HTML.",
        ].join("\n")
      : "",
  ].filter(Boolean).join("\n\n");
  const clientReportingYearMode = payload.reportingYearMode === "fiscal" ? "fiscal" : "calendar";
  const clientFiscalYear = typeof payload.fiscalYear === "number" ? payload.fiscalYear : undefined;
  const clientFiscalYearStart = typeof payload.fiscalYearStart === "number" ? payload.fiscalYearStart : undefined;
  const thoughtStackEnabled = payload.thoughtStackEnabled !== false;
  const forcedToolNames = normalizeForcedToolNames(payload.forcedTools);
  const workspaceNoteTitle = asSafeText(payload.workspaceNotes?.title, "Workspace Notepad", 120);
  const workspaceNoteContent = asSafeText(payload.workspaceNotes?.content, "", 12000);
  const workspaceNoteVersion = typeof payload.workspaceNotes?.version === "number" ? payload.workspaceNotes.version : 1;
  const workspaceNoteIsSourceOfTruth = payload.workspaceNotes?.sourceOfTruth !== false;

  const mentionedConstituentIds = Array.isArray(payload.donorContext)
    ? payload.donorContext
        .map((d) => (typeof d?.id === "string" ? d.id.trim() : ""))
        .filter(Boolean)
        .slice(0, 5)
    : [];
  const taggedDonorFocus = moduleKey === "donor" && mentionedConstituentIds.length > 0;
  const explicitSavedMemory = await saveExplicitMemoryFromText({
    organizationId,
    userId: req.user?.sub ?? "",
    text: latestUserMessage,
    workspaceScope: scopeFromModuleKey(moduleKey),
  }).catch(() => null);
  if (explicitSavedMemory) {
    await logAudit({
      action: "STEWARD_MEMORY_EXPLICIT_CHAT_SAVED",
      entity: "AiUserMemory",
      entityId: explicitSavedMemory.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { category: explicitSavedMemory.category, workspaceScope: explicitSavedMemory.workspaceScope },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
  }

  const thoughtStack = thoughtStackEnabled
    ? buildThoughtStackAssessment({
        mode,
        moduleKey,
        userIntent,
        userQuery: latestUserMessage,
      })
    : {
        state: "Ready to Act",
        confidence: "high",
        riskLevel: "low",
        requiresConfirmation: false,
        dryRunRecommended: false,
        selectedWorkflow: "thoughtstack.disabled.beta",
        missingDetails: [] as string[],
        summaryLines: ["ThoughtStack disabled by user for this chat."],
        structured: undefined,
      };

  if (thoughtStackEnabled && thoughtStack.structured) {
    const structured = thoughtStack.structured;
    const reply = structured.replyMarkdown || "ThoughtStack requires additional confirmation before continuing.";
    res.json({
      data: {
        reply,
        structured,
        model: "thoughtstack",
        mode,
        runtimeMode: config.mode,
        provider: "thoughtstack",
        toolsUsed: ["thoughtstack.assess", thoughtStack.selectedWorkflow],
        recordsUsed: [],
        moduleKey,
        scopePath,
      },
    });
    return;
  }

  try {
    if (!taggedDonorFocus && forcedToolNames.length === 0 && mode !== "llm" && moduleKey === "donor" && isTopDonorQuestion(latestUserMessage)) {
      const topDonorResult = await buildTopDonorResult({
        organizationId,
        userId: req.user?.sub ?? "",
        role: req.user?.role ?? "readonly",
        moduleKey,
        scopePath,
        requestRoute: req.path,
      });
      const earlyToolsUsed = explicitSavedMemory ? [...topDonorResult.toolsUsed, "memory.saveExplicit"] : topDonorResult.toolsUsed;
      const templatedReply = formatReplyByMode({
        mode,
        userIntent,
        reply: topDonorResult.reply,
        toolsUsed: earlyToolsUsed,
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
          toolsUsed: earlyToolsUsed,
          recordsUsed: topDonorResult.recordsUsed,
          moduleKey,
          scopePath,
        },
      });
      return;
    }

    if (!taggedDonorFocus && forcedToolNames.length === 0 && mode !== "llm" && moduleKey === "donor" && isReportQuestion(latestUserMessage)) {
      const reportResult = await buildReportCardResult({
        organizationId,
        userId: req.user?.sub ?? "",
        role: req.user?.role ?? "readonly",
        moduleKey,
        scopePath,
        requestRoute: req.path,
      });
      const earlyToolsUsed = explicitSavedMemory ? [...reportResult.toolsUsed, "memory.saveExplicit"] : reportResult.toolsUsed;
      res.json({
        data: {
          reply: reportResult.reply,
          structured: reportResult.structured,
          model: "crm-data",
          mode,
          runtimeMode: config.mode,
          provider: "crm-data",
          toolsUsed: earlyToolsUsed,
          recordsUsed: [],
          moduleKey,
          scopePath,
        },
      });
      return;
    }

    const retrieval = mode === "free"
      ? {
          contextText: "Pure mode selected: answer from the user's prompt only. Do not use CRM tools or retrieved records.",
          toolsUsed: [] as string[],
          recordsUsed: [] as string[],
        }
      : await buildRetrievalContext({
          organizationId,
          moduleKey,
          mode,
          scopePath,
          userQuery: latestUserMessage,
          userId: req.user?.sub ?? "",
          role: req.user?.role ?? "readonly",
          mentionedConstituentIds: mentionedConstituentIds.length > 0 ? mentionedConstituentIds : undefined,
        });

    const forcedToolContext = mode === "free"
      ? { contextText: "", toolsUsed: [] as string[], recordsUsed: [] as string[], warnings: [] as string[] }
      : await buildForcedToolContext({
          organizationId,
          userId: req.user?.sub ?? "",
          role: req.user?.role ?? "readonly",
          moduleKey,
          scopePath,
          requestRoute: req.path,
        }, forcedToolNames);

    const mergedContextText = [
      retrieval.contextText,
      forcedToolContext.contextText ? `Forced tool context:\n${forcedToolContext.contextText}` : "",
      forcedToolContext.warnings.length > 0 ? `Forced tool warnings:\n${forcedToolContext.warnings.map((w) => `- ${w}`).join("\n")}` : "",
      workspaceNoteContent
        ? [
            `Workspace note: ${workspaceNoteTitle} (v${workspaceNoteVersion})`,
            workspaceNoteIsSourceOfTruth
              ? "Treat this note as the source of truth for in-progress work."
              : "Use this note as additional context.",
            workspaceNoteContent,
            "If the user asks to update this note, prefer suggested actions: workspace.notes.replace / workspace.notes.append / workspace.notes.prepend.",
          ].join("\n")
        : "",
    ].filter(Boolean).join("\n\n");

    const modelContextText = buildModelContextForIntent(mergedContextText, userIntent);
    const combinedRecordsUsed = [...retrieval.recordsUsed, ...forcedToolContext.recordsUsed];

    const agenticPreparation = await buildAgenticPreparation({
      organizationId,
      enabled: Boolean(setting?.enabled),
      config,
      mode,
      userIntent,
      responseContract,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
      contextText: modelContextText,
    });

    const agenticToolPass = mode === "agentic"
      ? (taggedDonorFocus
          ? {
              notes: ["Agentic read-tool planning skipped because tagged donor focus mode is active."],
              toolsUsed: ["agentic.tools.skipped.taggedDonorFocus"],
            }
          : await buildAgenticToolPass({
              organizationId,
              enabled: Boolean(setting?.enabled),
              config,
              moduleKey,
              scopePath,
              userQuery: latestUserMessage,
              contextText: modelContextText,
              userId: req.user?.sub ?? "",
              role: req.user?.role ?? "readonly",
            }))
      : { notes: [] as string[], toolsUsed: [] as string[] };

    const agenticNotes = [...thoughtStack.summaryLines, ...agenticPreparation.stageSummaries, ...agenticToolPass.notes];
    const agenticToolsUsed = [...agenticPreparation.toolsUsed, ...agenticToolPass.toolsUsed];

    const fyMeta = extractFiscalYearFromContext(mergedContextText);
    const resolvedFyLabelSync = fyMeta.fiscalYearLabel
      ?? (clientReportingYearMode === "fiscal" && clientFiscalYear ? `FY${clientFiscalYear}` : undefined);
    const resolvedCalendarYearSync = fyMeta.calendarYear ?? clientFiscalYear ?? new Date().getFullYear();
    const yearModeNoteSync = clientReportingYearMode === "fiscal" && clientFiscalYear
      ? `The user has locked Steward to fiscal year mode: FY${clientFiscalYear}${clientFiscalYearStart ? ` (starts month ${clientFiscalYearStart})` : ""}. Answer all year-related questions using this fiscal year context unless the user asks for calendar year explicitly.`
      : `The user is in calendar year mode (${resolvedCalendarYearSync}).`;
    const runtimeSystemPrompt = buildRuntimeSystemPrompt({
      mode,
      userIntent,
      responseContract,
      moduleKey,
      scopePath,
      contextText: modelContextText + `\n\n${yearModeNoteSync}`,
      agenticNotes,
      fiscalYearLabel: resolvedFyLabelSync,
      calendarYear: resolvedCalendarYearSync,
    });

    const toolsUsed = [
      ...retrieval.toolsUsed,
      ...forcedToolContext.toolsUsed,
      ...(thoughtStackEnabled ? ["thoughtstack.assess"] : ["thoughtstack.disabled.beta"]),
      ...agenticToolsUsed,
      ...(explicitSavedMemory ? ["memory.saveExplicit"] : []),
    ];
    const responseMaxTokens = recommendedReplyMaxTokens(config, userIntent);
    let provider = agenticPreparation.stageSummaries.length > 0 ? "ollama-agentic" : "ollama";
    let completion: { content: string; model: string };

    if (userIntent === "draft_email") {
      const emailPipeline = await runDraftEmailPipeline({
        organizationId,
        enabled: Boolean(setting?.enabled),
        config,
        mode,
        userQuery: latestUserMessage,
        contextText: modelContextText,
        reasoningModel: agenticPreparation.reasoningModel,
      });
      completion = {
        content: emailPipeline.content,
        model: emailPipeline.model,
      };
      provider = "ollama-email-pipeline";
      toolsUsed.push(...emailPipeline.toolsUsed);
    } else {
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
          () => runStewardAiChat(
            config,
            [
              { role: "system", content: runtimeSystemPrompt },
              ...normalizedMessages,
            ],
            {
              maxTokens: responseMaxTokens,
            }
          )
        );
      } catch (chatError) {
        const message = chatError instanceof Error ? chatError.message : "";
        if (!/empty assistant response/i.test(message)) {
          throw chatError;
        }

        try {
          completion = await runRescueCompletion({
            config,
            mode,
            userQuery: latestUserMessage,
            contextText: modelContextText,
            normalizedMessages,
          });
          provider = "ollama-recovery";
          toolsUsed.push("fallback.recoveryCompletion");
        } catch {
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
      }
    }

    if (isLikelyTruncatedReply(completion.content)) {
      try {
        const continuation = await continueTruncatedReply({
          organizationId,
          enabled: Boolean(setting?.enabled),
          config,
          runtimeSystemPrompt,
          normalizedMessages,
          userIntent,
          partialReply: completion.content,
        });

        if (continuation) {
          completion = {
            content: continuation.mergedContent,
            model: continuation.model || completion.model,
          };
          toolsUsed.push("fallback.continueReply");
        }
      } catch {
        // Keep current completion if continuation recovery fails.
      }
    }

    const parsedStructured = normalizeStewardStructuredResponse(completion.content, {
      debug: false,
    });

    const templatedReply = formatReplyByMode({
      mode,
      userIntent,
      reply: parsedStructured.replyMarkdown || completion.content,
      toolsUsed,
      recordsUsed: combinedRecordsUsed,
    });
    const thoughtStackEvidence: StewardEvidencePayload[] = [
      { label: `ThoughtStack state: ${thoughtStack.state}` },
      { label: `ThoughtStack workflow: ${thoughtStack.selectedWorkflow}` },
      { label: `ThoughtStack risk: ${thoughtStack.riskLevel}` },
    ];
    const verificationEvidence = extractVerificationEvidence(agenticToolPass.notes);
    const structured: StewardStructuredResponsePayload = withDedicatedSaveDraftLetterAction({
      ...parsedStructured,
      replyMarkdown: templatedReply,
      evidence: [
        ...thoughtStackEvidence,
        ...verificationEvidence,
        ...parsedStructured.evidence,
      ].slice(0, 16),
    });

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
        thoughtStackState: thoughtStack.state,
        thoughtStackRiskLevel: thoughtStack.riskLevel,
        thoughtStackConfidence: thoughtStack.confidence,
        thoughtStackWorkflow: thoughtStack.selectedWorkflow,
        thoughtStackMissingDetails: thoughtStack.missingDetails,
        thoughtStackRequiresConfirmation: thoughtStack.requiresConfirmation,
        thoughtStackDryRunRecommended: thoughtStack.dryRunRecommended,
        thoughtStackEnabled,
        chatMode: mode,
        userIntent,
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
        recordsUsed: combinedRecordsUsed,
        moduleKey,
        scopePath,
      },
    });
  } catch (error) {
    console.error("[steward-ai/chat] Unhandled error:", error);
    res.status(502).json({
      error: {
        code: "AI_CHAT_FAILED",
        message: error instanceof Error ? error.message : "Steward AI request failed.",
      },
    });
  }
});

export default router;
