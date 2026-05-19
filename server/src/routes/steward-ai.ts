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
import { searchStewardHelpGuides } from "../services/steward-help-knowledge.js";
import { fmtDate } from "../services/steward-donor-context.js";
import {
  buildFileContext,
  buildUserMemoryContext,
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
  mode?: "ask" | "analyze" | "draft" | "free" | "agentic" | "writing" | "llm" | "action" | "help";
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

interface AiMemoryPayload {
  title?: string;
  content?: string;
  category?: string;
  source?: string;
  confidence?: number;
  active?: boolean;
  workspaceScope?: string | null;
}

interface AiContextFilePayload {
  fileName?: string;
  displayName?: string;
  mimeType?: string;
  fileType?: string;
  sizeBytes?: number;
  workspaceScope?: string | null;
  description?: string | null;
  tags?: string[] | string;
  extractedText?: string | null;
}

type StewardChatMode = NonNullable<StewardAiChatPayload["mode"]>;
type StewardResponseIntent = "draft_email" | "how_to" | "action_plan" | "analysis" | "summary" | "general";
type GuidePathState =
  | "Ready to Act"
  | "Needs Clarification"
  | "Needs Confirmation"
  | "Needs Guided Setup"
  | "Cannot Safely Answer Yet";

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
  userIntent: StewardResponseIntent;
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
  "communications.build_full_email_workspace",
  "tasks.create_follow_up_task",
  "letters.create_letter_draft",
  "letters.build_full_letter_draft",
  "guidepath.choose",
  "thoughtstack.continue",
  "thoughtstack.review_first",
  "thoughtstack.provide_details",
  "thoughtstack.cancel",
]);

function buildGuidePathChoice(label: string, prompt: string): StewardSuggestedActionPayload {
  return {
    label,
    actionType: "guidepath.choose",
    requiresConfirmation: false,
    payload: { prompt },
  };
}

function buildGuidePathOpenReportChoice(label: string, path: string): StewardSuggestedActionPayload {
  return {
    label,
    actionType: "open_report",
    requiresConfirmation: false,
    payload: { path },
  };
}

function buildThoughtStackChoice(actionType: "thoughtstack.continue" | "thoughtstack.review_first" | "thoughtstack.provide_details" | "thoughtstack.cancel", label: string, prompt: string): StewardSuggestedActionPayload {
  return {
    label,
    actionType,
    requiresConfirmation: actionType === "thoughtstack.continue",
    payload: { prompt },
  };
}

interface GuidePathSignals {
  asksReport: boolean;
  hasTimeRange: boolean;
  hasReportFocus: boolean;
  asksCrossModule: boolean;
  hasAudience: boolean;
  hasTone: boolean;
  hasCrmContext: boolean;
}

function extractGuidePathSignals(text: string): GuidePathSignals {
  const normalized = text.toLowerCase();
  return {
    asksReport: /(report|dashboard|summary|kpi|metrics|board report|analysis)/.test(normalized),
    hasTimeRange: /(today|this\s+week|last\s+week|this\s+month|last\s+month|this\s+quarter|last\s+quarter|year(?:\s|-)?to(?:\s|-)?date|ytd|fiscal|fiscle|calendar|between|from\s+.+\s+to|q[1-4]|fy\s?\d{2,4}|custom\s+(date\s+)?range)/.test(normalized),
    hasReportFocus: /(financial|revenue|donor|engagement|campaign|attendance|clients?|events?|board)/.test(normalized),
    asksCrossModule: /(all\s+of\s+the\s+above|cross\s*-?\s*module|org(?:anization)?\s*-?\s*wide|across\s+all\s+modules)/.test(normalized),
    hasAudience: /(all active|monthly|lapsed|attendees?|guests?|segment|group|campaign|recipients?|these donors|this list)/.test(normalized),
    hasTone: /(warm|formal|direct|celebratory|board-ready|ministry|tone)/.test(normalized),
    hasCrmContext: /(donor|constituent|campaign|gift|donation|client|case|event|attendance|task|steward|segment)/.test(normalized),
  };
}

function inferModuleReportFocus(moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>): string {
  if (moduleKey === "events") return "attendance and operations";
  if (moduleKey === "compassion") return "client engagement and outcomes";
  if (moduleKey === "watchdog") return "security and operations";
  if (moduleKey === "webmaster") return "campaign and web performance";
  return "donor engagement and fundraising";
}

function reportWorkspacePathForModule(moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>): string {
  if (moduleKey === "events") return "/reports?tab=events&module=events";
  if (moduleKey === "compassion") return "/reports?tab=compassion&module=compassion";
  if (moduleKey === "watchdog") return "/reports?tab=operations&module=watchdog";
  if (moduleKey === "webmaster") return "/reports?tab=webmaster&module=webmaster";
  return "/reports?tab=donor-crm&module=donor";
}

/**
 * GuidePath decision engine: asks only the minimum follow-up when intent is risky or underspecified.
 * Returns null when Steward has enough context to proceed normally.
 */
function buildGuidePathClarification(options: {
  mode: StewardChatMode;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  userQuery: string;
  recentUserQuery?: string;
}): { state: Exclude<GuidePathState, "Ready to Act">; structured: StewardStructuredResponsePayload } | null {
  const q = options.userQuery.trim();
  if (!q) return null;
  const normalized = q.toLowerCase();
  const recentUserQuery = options.recentUserQuery?.trim() || q;
  const latestSignals = extractGuidePathSignals(q);
  const recentSignals = extractGuidePathSignals(recentUserQuery);
  const isGuidedContinuation = /(continue|apply|selection|choose|use\s+.+\s+as\s+the\s+report\s+timeframe|focus\s+this\s+report)/.test(normalized);
  const moduleFocusHint = inferModuleReportFocus(options.moduleKey);
  const implicitModuleFocus = options.moduleKey !== "oshareview" && !recentSignals.asksCrossModule;
  const quickReportPath = reportWorkspacePathForModule(options.moduleKey);

  const asksReport = latestSignals.asksReport || (isGuidedContinuation && recentSignals.asksReport);
  const hasTimeRange = latestSignals.hasTimeRange || recentSignals.hasTimeRange;
  const hasReportFocus = latestSignals.hasReportFocus || recentSignals.hasReportFocus || implicitModuleFocus;

  if (asksReport && (!hasTimeRange || !hasReportFocus)) {
    const missing = !hasTimeRange ? "time period" : "report focus";
    const question = !hasTimeRange
      ? "What time period should this report cover?"
      : "What should this report focus on?";
    const choices = !hasTimeRange
      ? [
          buildGuidePathChoice("This month", "Use this month as the report timeframe and continue."),
          buildGuidePathChoice("Last month", "Use last month as the report timeframe and continue."),
          buildGuidePathChoice("This quarter", "Use this quarter as the report timeframe and continue."),
          buildGuidePathChoice("Year to date", "Use year-to-date as the report timeframe and continue."),
          buildGuidePathChoice("Custom range", "I want a custom date range for this report."),
          buildGuidePathOpenReportChoice("Open report workspace", quickReportPath),
        ]
      : [
          buildGuidePathChoice("Financial totals", "Focus this report on financial totals and continue."),
          buildGuidePathChoice("Donor engagement", "Focus this report on donor engagement and continue."),
          buildGuidePathChoice("Campaign performance", "Focus this report on campaign performance and continue."),
          buildGuidePathChoice("Attendance/operations", "Focus this report on attendance and operations and continue."),
          buildGuidePathChoice("All of the above", "Include financial totals, engagement, and campaign performance in one board report."),
          buildGuidePathChoice("Use current CRM context", `Use the current ${moduleFocusHint} focus and continue.`),
          buildGuidePathOpenReportChoice("Open report workspace", quickReportPath),
        ];

    return {
      state: "Needs Guided Setup",
      structured: {
        version: 1,
        replyMarkdown: [
          "**GuidePath: Needs Guided Setup**",
          `I can build this report, but one detail is missing: **${missing}**.`,
          "",
          question,
          "Choose one option below to continue.",
        ].join("\n"),
        artifacts: [],
        suggestedActions: choices,
        evidence: [
          { label: "GuidePath classified request as Needs Guided Setup" },
          { label: `CRM context: ${options.moduleKey} workspace` },
        ],
      },
    };
  }

  const asksComms = /(send|email|message|notify|thank.?you|appeal|reminder)/.test(normalized);
  const hasAudience = latestSignals.hasAudience || recentSignals.hasAudience;
  const hasTone = latestSignals.hasTone || recentSignals.hasTone;

  if (asksComms && (!hasAudience || !hasTone)) {
    const question = !hasAudience
      ? "Which audience should this message apply to?"
      : "Which tone should Steward use for this message?";
    const choices = !hasAudience
      ? [
          buildGuidePathChoice("All active donors", "Use all active donors as the audience and continue."),
          buildGuidePathChoice("Monthly donors only", "Use monthly donors only as the audience and continue."),
          buildGuidePathChoice("Lapsed donors", "Use lapsed donors as the audience and continue."),
          buildGuidePathChoice("Event attendees", "Use event attendees as the audience and continue."),
          buildGuidePathChoice("Choose manually", "I want to choose the audience manually before continuing."),
        ]
      : [
          buildGuidePathChoice("Warm and personal", "Use a warm and personal tone and continue."),
          buildGuidePathChoice("Formal and board-ready", "Use a formal board-ready tone and continue."),
          buildGuidePathChoice("Short and direct", "Use a short and direct tone and continue."),
          buildGuidePathChoice("Ministry-centered", "Use a ministry-centered tone and continue."),
          buildGuidePathChoice("Include donation history: Yes", "Include donation history in this message and continue."),
          buildGuidePathChoice("Include donation history: No", "Do not include donation history in this message and continue."),
        ];

    return {
      state: "Needs Clarification",
      structured: {
        version: 1,
        replyMarkdown: [
          "**GuidePath: Needs Clarification**",
          "I can do that, but I need one detail first.",
          "",
          question,
          "Choose an option below to continue quickly.",
        ].join("\n"),
        artifacts: [],
        suggestedActions: choices,
        evidence: [{ label: "GuidePath classified request as Needs Clarification" }],
      },
    };
  }

  const riskyMutation = /(delete|remove|erase|bulk\s+update|merge\s+records|trigger\s+automation|send\s+now|enroll\s+all|auto-?send)/.test(normalized);
  if (riskyMutation) {
    return {
      state: "Needs Confirmation",
      structured: {
        version: 1,
        replyMarkdown: [
          "**GuidePath: Needs Confirmation**",
          "This action may affect real CRM data or outbound communication.",
          "I can proceed once you confirm the exact intent.",
          "",
          "Choose one option:",
        ].join("\n"),
        artifacts: [],
        suggestedActions: [
          buildGuidePathChoice("Continue", "Confirmed. Continue with this action exactly as requested."),
          buildGuidePathChoice("Save as Draft", "Do not execute live changes. Prepare this as a draft instead."),
          buildGuidePathChoice("Edit First", "I want to edit scope/recipients before continuing."),
          buildGuidePathChoice("Cancel", "Cancel this action."),
        ],
        evidence: [{ label: "GuidePath classified request as Needs Confirmation" }],
      },
    };
  }

  const tooVague = /(do it|run it|make it|fix this|send this|use that)/.test(normalized)
    && normalized.length < 40
    && !recentSignals.hasCrmContext;
  if (tooVague) {
    return {
      state: "Cannot Safely Answer Yet",
      structured: {
        version: 1,
        replyMarkdown: [
          "**GuidePath: Cannot Safely Answer Yet**",
          "I may guess wrong because the request is too ambiguous.",
          "Tell me what this should apply to so I can proceed safely.",
        ].join("\n"),
        artifacts: [],
        suggestedActions: [
          buildGuidePathChoice("Donor CRM", "Apply this request to Donor CRM context."),
          buildGuidePathChoice("Events CRM", "Apply this request to Events CRM context."),
          buildGuidePathChoice("Compassion CRM", "Apply this request to Compassion CRM context."),
          buildGuidePathChoice("Describe manually", "I will describe exactly what this should apply to."),
        ],
        evidence: [{ label: "GuidePath classified request as Cannot Safely Answer Yet" }],
      },
    };
  }

  return null;
}

type ThoughtStackRiskLevel = "low" | "medium" | "high";
type ThoughtStackConfidence = "low" | "medium" | "high";

interface ThoughtStackToolContract {
  toolName: string;
  riskLevel: ThoughtStackRiskLevel;
  requiresConfirmation: boolean;
  supportsDryRun: boolean;
  requiredFields: string[];
  verificationChecks: string[];
}

interface ThoughtStackAssessment {
  state: GuidePathState;
  confidence: ThoughtStackConfidence;
  riskLevel: ThoughtStackRiskLevel;
  requiresConfirmation: boolean;
  dryRunRecommended: boolean;
  selectedWorkflow: string;
  missingDetails: string[];
  summaryLines: string[];
  toolContract?: ThoughtStackToolContract;
  structured?: StewardStructuredResponsePayload;
}

function hasExplicitConfirmation(userQuery: string): boolean {
  return /(\b(confirm|confirmed|approve|approved|continue|proceed|send now|run now|yes, continue)\b)/i.test(userQuery);
}

function buildThoughtStackToolContract(userQuery: string): ThoughtStackToolContract | undefined {
  const normalized = userQuery.toLowerCase();

  if (/(send|email|text|sms|newsletter|appeal|follow-?up|blast)/.test(normalized)) {
    return {
      toolName: "communications.sendDonorEmail",
      riskLevel: "high",
      requiresConfirmation: true,
      supportsDryRun: true,
      requiredFields: ["recipientSegment", "templateOrMessage", "deliveryTiming", "channel"],
      verificationChecks: ["preparedCount", "sentCount", "failedCount", "skippedCount"],
    };
  }

  if (/(import|csv|upload|spreadsheet|batch\s+entry)/.test(normalized)) {
    return {
      toolName: "data.importCsv",
      riskLevel: "high",
      requiresConfirmation: true,
      supportsDryRun: true,
      requiredFields: ["fileSource", "fieldMap", "duplicateStrategy"],
      verificationChecks: ["rowsRead", "createdCount", "updatedCount", "duplicateCount", "failedCount"],
    };
  }

  if (/(merge|dedupe|deduplicate|delete|remove|erase|publish|automation|bulk\s+update)/.test(normalized)) {
    return {
      toolName: "records.mutate",
      riskLevel: "high",
      requiresConfirmation: true,
      supportsDryRun: true,
      requiredFields: ["targetScope", "changePlan", "rollbackPlan"],
      verificationChecks: ["affectedCount", "successCount", "failureCount"],
    };
  }

  if (/(report|dashboard|summary|analy[sz]e|trend|retention|kpi|forecast|top donor)/.test(normalized)) {
    return {
      toolName: "reports.readInsights",
      riskLevel: "low",
      requiresConfirmation: false,
      supportsDryRun: false,
      requiredFields: ["timeRange", "focusArea"],
      verificationChecks: ["recordsExamined", "sourcesUsed"],
    };
  }

  return undefined;
}

function findThoughtStackMissingDetails(userQuery: string, contract?: ThoughtStackToolContract): string[] {
  if (!contract) return [];

  const normalized = userQuery.toLowerCase();
  const missing: string[] = [];

  if (contract.toolName === "communications.sendDonorEmail") {
    if (!/(all\s+active|monthly|lapsed|attendees?|guests?|segment|group|list|recipients?)/.test(normalized)) {
      missing.push("recipient segment");
    }
    if (!/(template|subject|message|thank\s?you|appeal|invitation|follow-?up)/.test(normalized)) {
      missing.push("message template or subject");
    }
    if (!/(send\s+now|schedule|scheduled|draft|tomorrow|today|next\s+week)/.test(normalized)) {
      missing.push("delivery timing (send now, schedule, or draft)");
    }
  }

  if (contract.toolName === "data.importCsv") {
    if (!/(csv|file|upload|sheet|spreadsheet)/.test(normalized)) {
      missing.push("data file source");
    }
    if (!/(map|mapping|field|columns?)/.test(normalized)) {
      missing.push("field mapping plan");
    }
    if (!/(duplicate|merge|skip|overwrite)/.test(normalized)) {
      missing.push("duplicate handling strategy");
    }
  }

  if (contract.toolName === "reports.readInsights") {
    if (!/(today|this week|last week|this month|last month|this quarter|last quarter|year to date|ytd|fiscal|calendar|between|q[1-4]|fy\s?\d{4})/.test(normalized)) {
      missing.push("time range");
    }
    if (!/(financial|revenue|donor|engagement|campaign|attendance|board|operations)/.test(normalized)) {
      missing.push("report focus");
    }
  }

  return missing.slice(0, 3);
}

function buildThoughtStackAssessment(options: {
  mode: StewardChatMode;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  userIntent: StewardResponseIntent;
  userQuery: string;
}): ThoughtStackAssessment {
  if (options.mode === "free") {
    return {
      state: "Ready to Act",
      confidence: "medium",
      riskLevel: "low",
      requiresConfirmation: false,
      dryRunRecommended: false,
      selectedWorkflow: "pure.no-tools",
      missingDetails: [],
      summaryLines: [
        "ThoughtStack intent layer: direct no-tools response requested.",
        "ThoughtStack tool layer: no CRM tool selected.",
        "ThoughtStack safety layer: low risk, response-only action.",
      ],
    };
  }

  const contract = buildThoughtStackToolContract(options.userQuery);
  const missingDetails = findThoughtStackMissingDetails(options.userQuery, contract);
  const riskLevel = contract?.riskLevel ?? "low";
  const requiresConfirmation = Boolean(contract?.requiresConfirmation);
  const dryRunRecommended = Boolean(contract?.supportsDryRun) || riskLevel === "high";
  const confidence: ThoughtStackConfidence = missingDetails.length === 0 ? "high" : missingDetails.length === 1 ? "medium" : "low";
  const selectedWorkflow = contract?.toolName ?? `response.${options.userIntent}`;

  if (missingDetails.length > 0) {
    const detailList = missingDetails.map((detail, index) => `${index + 1}. ${detail}`).join("\n");
    return {
      state: "Needs Clarification",
      confidence,
      riskLevel,
      requiresConfirmation,
      dryRunRecommended,
      selectedWorkflow,
      missingDetails,
      toolContract: contract,
      summaryLines: [
        `ThoughtStack intent layer: ${options.userIntent}.`,
        `ThoughtStack tool layer: proposed workflow ${selectedWorkflow}.`,
        `ThoughtStack clarification layer: missing ${missingDetails.length} required detail(s).`,
      ],
      structured: {
        version: 1,
        replyMarkdown: [
          "**ThoughtStack: Needs Clarification**",
          "I can continue safely once these details are confirmed:",
          "",
          detailList,
          "",
          "Choose one option:",
        ].join("\n"),
        artifacts: [],
        suggestedActions: [
          buildThoughtStackChoice("thoughtstack.review_first", "Review First", "Show a dry-run preview first and do not execute live changes."),
          buildThoughtStackChoice("thoughtstack.provide_details", "I will provide details", "I will provide the missing details now so you can continue."),
          buildThoughtStackChoice("thoughtstack.cancel", "Cancel", "Cancel this request for now."),
        ],
        evidence: [
          { label: "ThoughtStack classified request as Needs Clarification" },
          ...(contract ? [{ label: `Proposed contract: ${contract.toolName}` }] : []),
        ],
      },
    };
  }

  if (requiresConfirmation && !hasExplicitConfirmation(options.userQuery)) {
    return {
      state: "Needs Confirmation",
      confidence,
      riskLevel,
      requiresConfirmation,
      dryRunRecommended,
      selectedWorkflow,
      missingDetails,
      toolContract: contract,
      summaryLines: [
        `ThoughtStack safety layer: ${riskLevel} risk action detected.`,
        "ThoughtStack confirmation layer: explicit user confirmation required before execution.",
        dryRunRecommended ? "ThoughtStack dry-run layer: preview recommended before commit." : "",
      ].filter(Boolean),
      structured: {
        version: 1,
        replyMarkdown: [
          "**ThoughtStack: Needs Confirmation**",
          "This request can change CRM data or send outbound communication.",
          "I can proceed after confirmation, or prepare a review-first preview.",
          "",
          "Choose one option:",
        ].join("\n"),
        artifacts: [],
        suggestedActions: [
          buildThoughtStackChoice("thoughtstack.continue", "Continue", "Confirmed. Continue with this workflow."),
          buildThoughtStackChoice("thoughtstack.review_first", "Review First", "Run a dry-run preview only. Do not execute live changes."),
          buildThoughtStackChoice("thoughtstack.cancel", "Cancel", "Cancel this request."),
        ],
        evidence: [
          { label: "ThoughtStack classified request as Needs Confirmation" },
          ...(contract ? [{ label: `Proposed contract: ${contract.toolName}` }] : []),
        ],
      },
    };
  }

  return {
    state: "Ready to Act",
    confidence,
    riskLevel,
    requiresConfirmation,
    dryRunRecommended,
    selectedWorkflow,
    missingDetails,
    toolContract: contract,
    summaryLines: [
      `ThoughtStack intent layer: ${options.userIntent}.`,
      `ThoughtStack tool layer: ${selectedWorkflow}.`,
      `ThoughtStack safety layer: ${riskLevel} risk (${requiresConfirmation ? "confirmation required" : "no confirmation required"}).`,
      dryRunRecommended ? "ThoughtStack execution layer: dry-run-first path is recommended." : "",
      "ThoughtStack verification layer: execution results must be verified before reporting completion.",
    ].filter(Boolean),
  };
}

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

function scopeFromModuleKey(moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>): string {
  if (moduleKey === "oshareview") return "donor";
  return moduleKey;
}

function publicMemory(row: {
  id: string;
  title: string;
  content: string;
  category: string;
  source: string;
  confidence: number;
  active: boolean;
  workspaceScope: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function publicContextFile(row: {
  id: string;
  fileName: string;
  displayName: string;
  mimeType: string;
  fileType: string;
  sizeBytes: number;
  workspaceScope: string | null;
  description: string | null;
  tags: Prisma.JsonValue;
  indexingStatus: string;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  indexedAt: Date | null;
  _count?: { chunks: number };
}) {
  return {
    id: row.id,
    fileName: row.fileName,
    displayName: row.displayName,
    mimeType: row.mimeType,
    fileType: row.fileType,
    sizeBytes: row.sizeBytes,
    workspaceScope: row.workspaceScope,
    description: row.description,
    tags: Array.isArray(row.tags) ? row.tags : [],
    indexingStatus: row.indexingStatus,
    active: row.active,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    indexedAt: row.indexedAt?.toISOString() ?? null,
    chunkCount: row._count?.chunks ?? 0,
  };
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

/** Runs the dedicated draft email pipeline: draft -> thinking review -> strict formatting. */
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

  const draftPrompt = [
    "You are Steward's first-pass email writer.",
    "Write the donor email draft naturally and do not include tool names, JSON, or artifact blocks.",
    "Do not add markdown emphasis around field labels.",
    "Use merge fields for personalization: {{preferredName}}, {{fullName}}, {{lastGiftAmount}}, {{lastGiftDate}}, {{campaignName}}, {{organizationName}}, {{staffName}}, {{unsubscribeUrl}}, {{managePreferencesUrl}}.",
    "Output sections in this order: Subject, Preview Text, Body.",
    "User request:",
    options.userQuery || "(empty query)",
    "CRM context:",
    options.contextText || "No retrieval context available.",
  ].join("\n\n");

  const firstPass = await withStewardAiTask(
    {
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: options.config,
      label: "Writing first-pass email draft",
      status: "running_task",
      fallbackOnError: true,
    },
    () => runStewardAiChat(
      options.config,
      [{ role: "system", content: draftPrompt }],
      {
        model: options.config.model,
        temperature: 0.35,
        maxTokens: 1400,
      }
    )
  );
  toolsUsed.push("email.pipeline.draft");

  const reviewPrompt = [
    "You are Steward's email quality reviewer (thinking pass).",
    "Do not write a full replacement email.",
    "Return exactly three sections:",
    "1) Missing information",
    "2) Tone and clarity issues",
    "3) Formatting risks",
    "Keep each section under 4 bullets.",
    "User request:",
    options.userQuery || "(empty query)",
    "Draft to review:",
    firstPass.content,
  ].join("\n\n");

  const reviewPass = await withStewardAiTask(
    {
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: options.config,
      label: "Running email thinking review",
      status: "thinking",
      fallbackOnError: true,
    },
    () => runStewardAiChat(
      options.config,
      [{ role: "system", content: reviewPrompt }],
      {
        model: options.reasoningModel,
        temperature: 0.1,
        maxTokens: 700,
      }
    )
  );
  toolsUsed.push("email.pipeline.review");

  const formatterPrompt = [
    "You are Steward's email formatter.",
    "Reformat the draft into strict output with exactly these headers:",
    "Subject:",
    "Preview Text:",
    "Body:",
    "Do not include markdown bold markers around headers.",
    "Do not include any additional sections.",
    "Preserve merge fields and ensure placeholders use canonical tokens.",
    "Original draft:",
    firstPass.content,
    "Reviewer notes:",
    reviewPass.content,
  ].join("\n\n");

  const formatPass = await withStewardAiTask(
    {
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: options.config,
      label: "Formatting email output",
      status: "running_task",
      fallbackOnError: true,
    },
    () => runStewardAiChat(
      options.config,
      [{ role: "system", content: formatterPrompt }],
      {
        model: options.reasoningModel,
        temperature: 0.05,
        maxTokens: 1200,
      }
    )
  );
  toolsUsed.push("email.pipeline.format");

  const parsed = parseDraftEmailParts(formatPass.content || firstPass.content);
  return {
    content: serializeDraftEmailParts(parsed),
    model: formatPass.model || firstPass.model,
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
  const clarificationQuestions = isDraftAsk
    ? [
        "Who should this message be addressed to (full donor name)?",
        "What specific gift or impact should be acknowledged?",
        "Which tone do you want (warm, formal, celebratory, concise)?",
      ]
    : [
        "What exact outcome do you want from this response?",
        "Do you want a summary, analysis, or an executable action plan?",
        "Should I optimize for quick decisions or deeper diagnostics?",
      ];

  return [
    "The AI model did not return a response, but here is what the CRM currently shows for your question:",
    options.userQuery ? `> ${options.userQuery}` : "",
    contextLines.map((line) => `- ${line.replace(/^-\s*/, "")}`).join("\n"),
    "**Recovery mode:** I can continue now if you answer these quick questions:",
    clarificationQuestions.map((question, idx) => `${idx + 1}. ${question}`).join("\n"),
    "**What you can do next:** Answer the questions above for an immediate recovery response, or re-ask once AI connectivity is restored.",
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
    "If required details are missing, ask at most 3 concise clarification questions.",
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

/** Detects the user's primary requested deliverable so prompts can enforce a tighter response contract. */
function detectStewardIntent(userQuery: string, mode: StewardChatMode): StewardResponseIntent {
  const q = userQuery.toLowerCase();

  if (mode === "draft" || mode === "writing" || /(draft|write|compose|create)\s+.*\b(email|letter|message)\b/.test(q)) {
    return "draft_email";
  }
  if (mode === "help" || /(how\s+do\s+i|how\s+to|where\s+is|steps?\s+to|walk\s+me\s+through)/.test(q)) {
    return "how_to";
  }
  if (mode === "action" || /(plan|next\s+step|what\s+should\s+we\s+do|execute|workflow|follow\s*up)/.test(q)) {
    return "action_plan";
  }
  if (mode === "analyze" || /(analy[sz]e|why|trend|compare|risk|retention|kpi|forecast)/.test(q)) {
    return "analysis";
  }
  if (/(summarize|summary|recap|brief|tl;dr)/.test(q)) {
    return "summary";
  }
  return "general";
}

/** Returns strict output rules that match the user's requested deliverable. */
function buildIntentResponseContract(intent: StewardResponseIntent): string {
  if (intent === "draft_email") {
    return [
      "Response contract: output a real, sendable draft email.",
      "Format exactly as:",
      "Subject: <single line>",
      "Preview Text: <single line>",
      "Body:",
      "<email body in natural paragraphs>",
      "Do not wrap Subject/Preview Text/Body labels in markdown bold or special characters.",
      "Use Email Builder merge fields when personal or gift data is needed: {{preferredName}}, {{fullName}}, {{lastGiftAmount}}, {{lastGiftDate}}, {{campaignName}}, {{organizationName}}, {{staffName}}, {{unsubscribeUrl}}, {{managePreferencesUrl}}.",
      "Do not output donor data tables, tool traces, record dumps, JSON, or bullet lists of raw CRM fields.",
      "Use only facts needed for the draft and keep placeholders explicit only when data is missing.",
    ].join("\n");
  }

  if (intent === "how_to") {
    return [
      "Response contract: output concise procedural guidance.",
      "Use numbered steps in execution order.",
      "Keep to one workflow path unless the user asked for alternatives.",
    ].join("\n");
  }

  if (intent === "action_plan") {
    return [
      "Response contract: output an actionable plan.",
      "Use: 1) Immediate next action, 2) This week plan, 3) Risks/checks.",
      "Do not claim any action is already executed.",
    ].join("\n");
  }

  if (intent === "analysis") {
    return [
      "Response contract: output an evidence-backed analysis.",
      "Use concise findings and include only the most decision-relevant metrics.",
      "Avoid listing raw records unless explicitly requested.",
    ].join("\n");
  }

  if (intent === "summary") {
    return [
      "Response contract: output a concise summary.",
      "Keep to a short paragraph plus up to 3 bullets for key takeaways.",
    ].join("\n");
  }

  return "Response contract: answer directly and match the user's requested format and scope.";
}

/** Reduces noisy retrieval lines for model prompts while retaining decision-critical facts. */
function buildModelContextForIntent(contextText: string, intent: StewardResponseIntent): string {
  const lines = contextText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (intent !== "draft_email") {
    return lines.slice(0, 220).join("\n");
  }

  const keepPatterns = [
    /^Donor scope path:/i,
    /^Fiscal year context:/i,
    /^Current fiscal year:/i,
    /^Calendar year:/i,
    /^Focused donor profile:/i,
    /^@Mentioned donor:/i,
    /^Status:/i,
    /^Preferred channel:/i,
    /^Lapse risk:/i,
    /^Best next step:/i,
    /^Communication preference flags:/i,
    /^Do not/i,
  ];

  const bannedPatterns = [
    /^- Top donor:/i,
    /^- Opportunity:/i,
    /^- Lapse signal:/i,
    /^- LYBUNT:/i,
    /^Top donors by lifetime giving:/i,
    /^Monthly giving \(/i,
    /^KPI report \(/i,
  ];

  const filtered = lines
    .filter((line) => keepPatterns.some((pattern) => pattern.test(line)) || !bannedPatterns.some((pattern) => pattern.test(line)))
    .filter((line) => !bannedPatterns.some((pattern) => pattern.test(line)))
    .slice(0, 80);

  return filtered.join("\n");
}

/** Builds the planner stage prompt for agentic multi-stage preparation. */
function buildPlannerPrompt(options: {
  mode: StewardChatMode;
  userIntent: StewardResponseIntent;
  responseContract: string;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  contextText: string;
}): string {
  return [
    "You are Steward's planning engine. Produce concise planning notes only.",
    "Do not answer the user yet.",
    `Mode: ${options.mode}`,
    `Intent: ${options.userIntent}`,
    `Module: ${options.moduleKey}`,
    `Scope: ${options.scopePath}`,
    "Required response contract:",
    options.responseContract,
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
  userIntent: StewardResponseIntent;
  responseContract: string;
  userQuery: string;
  contextText: string;
  plannerNotes: string;
}): string {
  return [
    "You are Steward's reasoning verifier.",
    "Do not answer the user directly.",
    `Mode: ${options.mode}`,
    `Intent: ${options.userIntent}`,
    "Required response contract:",
    options.responseContract,
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

/** Builds the composer stage prompt that converts planning notes into a concrete answer blueprint. */
function buildComposerPrompt(options: {
  mode: StewardChatMode;
  userIntent: StewardResponseIntent;
  responseContract: string;
  userQuery: string;
  contextText: string;
  plannerNotes: string;
  reasoningNotes: string;
}): string {
  return [
    "You are Steward's response composer.",
    "Do not answer the user directly.",
    `Mode: ${options.mode}`,
    `Intent: ${options.userIntent}`,
    "Required response contract:",
    options.responseContract,
    "Return exactly two sections:",
    "1) Must-include points",
    "2) Response shape checklist",
    "Each section: max 6 bullets, no filler.",
    "User query:",
    options.userQuery || "(empty query)",
    "Planner notes:",
    options.plannerNotes || "(none)",
    "Reasoning notes:",
    options.reasoningNotes || "(none)",
    "Retrieved context:",
    options.contextText || "No retrieval context available.",
  ].join("\n\n");
}

/** Builds a final meta-reflection prompt to stress-test instruction fidelity before answer generation. */
function buildMetaReflectionPrompt(options: {
  userIntent: StewardResponseIntent;
  responseContract: string;
  userQuery: string;
  plannerNotes: string;
  reasoningNotes: string;
  composerNotes: string;
}): string {
  return [
    "You are Steward's meta-reflection validator.",
    "Do not answer the user directly.",
    `Intent: ${options.userIntent}`,
    "Required response contract:",
    options.responseContract,
    "Return exactly three sections:",
    "1) Instruction-following risks",
    "2) Data accuracy checks",
    "3) Final guardrails",
    "Each section max 5 bullets.",
    "User query:",
    options.userQuery || "(empty query)",
    "Planner notes:",
    options.plannerNotes || "(none)",
    "Reasoning notes:",
    options.reasoningNotes || "(none)",
    "Composer notes:",
    options.composerNotes || "(none)",
  ].join("\n\n");
}

/** Builds a second-order meta reflection prompt to harden instruction-following under uncertainty. */
function buildMetaMetaReflectionPrompt(options: {
  userIntent: StewardResponseIntent;
  responseContract: string;
  userQuery: string;
  metaNotes: string;
}): string {
  return [
    "You are Steward's second-pass meta validator (meta-meta).",
    "Do not answer the user directly.",
    `Intent: ${options.userIntent}`,
    "Required response contract:",
    options.responseContract,
    "Return exactly three sections:",
    "1) Hidden failure modes",
    "2) Ambiguity you must surface",
    "3) Recovery strategy if model output is sparse",
    "Each section max 4 bullets.",
    "User query:",
    options.userQuery || "(empty query)",
    "Meta notes from prior pass:",
    options.metaNotes || "(none)",
  ].join("\n\n");
}

/** Runs agentic planning + reasoning stages when enabled and returns summary artifacts. */
async function buildAgenticPreparation(options: {
  organizationId: string;
  enabled: boolean;
  config: ReturnType<typeof parseStewardAiConfig>;
  mode: StewardChatMode;
  userIntent: StewardResponseIntent;
  responseContract: string;
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
      userIntent: options.userIntent,
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
              userIntent: options.userIntent,
              responseContract: options.responseContract,
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
              userIntent: options.userIntent,
              responseContract: options.responseContract,
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

    const composerResult = await withStewardAiTask(
      {
        organizationId: options.organizationId,
        enabled: options.enabled,
        config: options.config,
        label: "Composing response blueprint",
        status: "thinking",
        fallbackOnError: true,
      },
      () => runStewardAiChat(
        options.config,
        [
          {
            role: "system",
            content: buildComposerPrompt({
              mode: options.mode,
              userIntent: options.userIntent,
              responseContract: options.responseContract,
              userQuery: options.userQuery,
              contextText: options.contextText,
              plannerNotes: plannerResult.content,
              reasoningNotes: reasoningResult.content,
            }),
          },
        ],
        {
          model: reasoningModel,
          temperature: 0.1,
          maxTokens: 700,
        }
      )
    );

    stageSummaries.push(`Composer Notes:\n${composerResult.content}`);
    toolsUsed.push("agentic.compose");

    const metaResult = await withStewardAiTask(
      {
        organizationId: options.organizationId,
        enabled: options.enabled,
        config: options.config,
        label: "Running meta instruction-check",
        status: "thinking",
        fallbackOnError: true,
      },
      () => runStewardAiChat(
        options.config,
        [
          {
            role: "system",
            content: buildMetaReflectionPrompt({
              userIntent: options.userIntent,
              responseContract: options.responseContract,
              userQuery: options.userQuery,
              plannerNotes: plannerResult.content,
              reasoningNotes: reasoningResult.content,
              composerNotes: composerResult.content,
            }),
          },
        ],
        {
          model: reasoningModel,
          temperature: 0.05,
          maxTokens: 700,
        }
      )
    );

    stageSummaries.push(`Meta Notes:\n${metaResult.content}`);
    toolsUsed.push("agentic.meta");

    const metaMetaResult = await withStewardAiTask(
      {
        organizationId: options.organizationId,
        enabled: options.enabled,
        config: options.config,
        label: "Running meta-meta resilience check",
        status: "thinking",
        fallbackOnError: true,
      },
      () => runStewardAiChat(
        options.config,
        [
          {
            role: "system",
            content: buildMetaMetaReflectionPrompt({
              userIntent: options.userIntent,
              responseContract: options.responseContract,
              userQuery: options.userQuery,
              metaNotes: metaResult.content,
            }),
          },
        ],
        {
          model: reasoningModel,
          temperature: 0.05,
          maxTokens: 600,
        }
      )
    );

    stageSummaries.push(`Meta-Meta Notes:\n${metaMetaResult.content}`);
    toolsUsed.push("agentic.meta2");

    return {
      reasoningModel,
      stageSummaries,
      toolsUsed,
      userIntent: options.userIntent,
    };
  } catch {
    // Graceful fallback keeps chat responsive when the configured thinking model is unavailable.
    return {
      reasoningModel: options.config.model,
      stageSummaries,
      toolsUsed,
      userIntent: options.userIntent,
    };
  }
}

interface AgenticToolRequest {
  tool: string;
  reason: string;
  input?: Record<string, unknown>;
}

interface AgenticToolPassResult {
  notes: string[];
  toolsUsed: string[];
}

function summarizeToolVerification(result: unknown): string {
  if (Array.isArray(result)) {
    return `Verification: result returned ${result.length} row(s).`;
  }

  if (!result || typeof result !== "object") {
    return "Verification: result payload was present but not object-shaped.";
  }

  const payload = result as Record<string, unknown>;
  const numericChecks = [
    "rowsRead",
    "createdCount",
    "updatedCount",
    "duplicateCount",
    "failedCount",
    "sentCount",
    "skippedCount",
    "affectedCount",
    "successCount",
    "total",
  ]
    .map((key) => ({ key, value: payload[key] }))
    .filter((entry) => typeof entry.value === "number" && Number.isFinite(entry.value as number))
    .slice(0, 5);

  if (numericChecks.length > 0) {
    return `Verification: ${numericChecks.map((entry) => `${entry.key}=${String(entry.value)}`).join(", ")}.`;
  }

  const keys = Object.keys(payload).slice(0, 6);
  return keys.length > 0
    ? `Verification: result keys present (${keys.join(", ")}).`
    : "Verification: empty result object returned.";
}

function extractVerificationEvidence(notes: string[]): StewardEvidencePayload[] {
  const items: StewardEvidencePayload[] = [];

  for (const note of notes) {
    const lines = String(note || "").split("\n");
    for (const line of lines) {
      if (!line.startsWith("Verification:")) continue;
      items.push({ label: asSafeText(line, "", 220) });
      if (items.length >= 6) return items;
    }
  }

  return items;
}

function parseAgenticToolRequestPlan(raw: string): AgenticToolRequest[] {
  const content = String(raw || "").trim();
  if (!content) return [];

  const fencedJson = content.match(/```(?:json|steward-artifacts)?\s*\n([\s\S]*?)```/i)?.[1] ?? content;

  try {
    const parsed = JSON.parse(fencedJson) as { toolRequests?: unknown } | unknown;
    const toolRequests = (parsed && typeof parsed === "object" && !Array.isArray(parsed))
      ? (parsed as { toolRequests?: unknown }).toolRequests
      : undefined;
    if (!Array.isArray(toolRequests)) return [];

    return toolRequests
      .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === "object" && !Array.isArray(entry))
      .map((entry) => ({
        tool: asSafeText(entry.tool, "", 120),
        reason: asSafeText(entry.reason, "", 240),
        input: entry.input && typeof entry.input === "object" && !Array.isArray(entry.input)
          ? (entry.input as Record<string, unknown>)
          : undefined,
      }))
      .filter((entry) => Boolean(entry.tool));
  } catch {
    return [];
  }
}

async function buildAgenticToolPass(options: {
  organizationId: string;
  enabled: boolean;
  config: ReturnType<typeof parseStewardAiConfig>;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  contextText: string;
  userId: string;
  role: string;
}): Promise<AgenticToolPassResult> {
  const context: StewardToolExecutionContext = {
    organizationId: options.organizationId,
    userId: options.userId,
    role: options.role,
    moduleKey: options.moduleKey === "oshareview" ? "oshareview" : "donor",
    scopePath: options.scopePath,
    requestRoute: "/api/steward-ai/chat",
  };

  const availableTools = (await listStewardTools(context)).filter((tool) => tool.allowed && tool.kind === "read");
  if (availableTools.length === 0) {
    return { notes: ["No safe read tools were available for this request."], toolsUsed: [] };
  }

  const toolCatalog = availableTools
    .map((tool) => `- ${tool.name}: ${tool.description}`)
    .join("\n");

  const plannerPrompt = [
    "You are Steward's agentic tool planner.",
    "Decide whether one or more safe read tools would improve the answer.",
    "Use only the tool names listed below.",
    "Do not request write tools.",
    "Return exactly one JSON object shaped as {\"toolRequests\":[{\"tool\":\"...\",\"reason\":\"...\",\"input\":{...}}]}.",
    "If no tools are needed, return {\"toolRequests\":[]}.",
    "User query:",
    options.userQuery || "(empty query)",
    "Context:",
    options.contextText || "(none)",
    "Available tools:",
    toolCatalog,
  ].join("\n\n");

  const plannerResult = await withStewardAiTask(
    {
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: options.config,
      label: "Planning tool-assisted answer",
      status: "thinking",
      fallbackOnError: true,
    },
    () => runStewardAiChat(
      options.config,
      [{ role: "system", content: plannerPrompt }],
      {
        model: options.config.reasoningMode === "thinking" ? resolveThinkingModel(options.config) : options.config.model,
        temperature: 0.1,
        maxTokens: 700,
      }
    )
  );

  const plannedRequests = parseAgenticToolRequestPlan(plannerResult.content).slice(0, 4);
  if (plannedRequests.length === 0) {
    return {
      notes: ["Agentic planner decided not to use any tools."],
      toolsUsed: ["agentic.tools.none"],
    };
  }

  const notes: string[] = [`Tool planner selected ${plannedRequests.length} read tool${plannedRequests.length === 1 ? "" : "s"}.`];
  const toolsUsed: string[] = ["agentic.tools.plan"];

  for (const request of plannedRequests) {
    const toolDefinition = availableTools.find((tool) => tool.name === request.tool);
    if (!toolDefinition) {
      notes.push(`Skipped unavailable tool: ${request.tool}.`);
      continue;
    }

    try {
      const execution = await executeStewardTool(context, toolDefinition.name, request.input, { confirm: false });
      toolsUsed.push(`agentic.tool.${toolDefinition.name}`);
      const verificationSummary = summarizeToolVerification(execution.result);
      notes.push([
        `Tool result: ${toolDefinition.name}`,
        request.reason ? `Reason: ${request.reason}` : "",
        verificationSummary,
        `Summary: ${JSON.stringify(execution.result).slice(0, 1200)}`,
      ].filter(Boolean).join("\n"));
    } catch (error) {
      notes.push(`Tool failed: ${toolDefinition.name} — ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }

  return { notes, toolsUsed };
}

/** Creates a runtime instruction block tailored to mode/module/context. */
function buildRuntimeSystemPrompt(options: {
  mode: NonNullable<StewardAiChatPayload["mode"]>;
  userIntent: StewardResponseIntent;
  responseContract: string;
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
  const modeSpecificPolicy = options.mode === "free"
    ? "Pure mode policy: do not use CRM tools, retrieval context, or structured artifacts. Answer directly from the user's prompt and general knowledge only."
    : options.mode === "agentic"
      ? "Agentic mode policy: if CRM evidence would improve the answer, expect tool-backed reasoning first and adapt the final answer after tool results arrive. Prefer the minimum number of read tools needed, and never auto-execute write tools without confirmation."
      : options.mode === "writing"
        ? "Legacy writing-mode alias: behave like Pure mode with a stronger emphasis on polished prose and draft quality. Do not use tools."
        : options.mode === "llm"
          ? "LLM mode policy: allow broader brainstorming and synthesis while staying grounded in retrieved CRM context; when context is missing, explicitly label uncertainty."
          : "";

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
    `Detected user intent: ${options.userIntent}.`,
    `Current scope path: ${options.scopePath}.`,
    options.fiscalYearLabel
      ? `Current fiscal year: ${options.fiscalYearLabel}. Calendar year: ${options.calendarYear ?? new Date().getFullYear()}.`
      : `Calendar year: ${options.calendarYear ?? new Date().getFullYear()}.`,
    actionPolicy,
    modeSpecificPolicy,
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
    "9. Follow the user request format first. If they asked for a draft email, output the draft email itself, not an analysis of donor records.",
    "10. Never dump raw CRM record lines into the final answer unless the user explicitly asked for a record list.",
    "11. For numeric questions, do not estimate. Use deterministic values from context and show exact formulas when relevant.",
    "12. When a full email or letter build is requested, include one suggested action using actionType 'communications.build_full_email_workspace' or 'letters.build_full_letter_draft' with payload fields (goal/audience/tone/campaignName or name/subject/category).",
    "13. Treat context as four layers: current session messages, saved user memories, uploaded file context, and live CRM tool data.",
    "14. Do not guess from memory when the user asks about a donor, event, client, report, or uploaded document; use retrieved CRM/file context as the source of truth and name missing context clearly.",
    "15. Only durable facts should become saved memories: stable preferences, organization facts, writing style, recurring workflows, project names, CRM settings, and long-term event details. Never save every chat message or short-term tasks.",
    "16. Sensitive personal data should not be saved as memory unless the user explicitly asks and it clearly improves future work.",
    "Required response contract:",
    options.responseContract,
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
  mode: StewardChatMode;
  scopePath: string;
  userQuery: string;
  userId: string;
  role: string;
  mentionedConstituentIds?: string[];
}): Promise<StewardContextResult> {
  const tokens = tokenizeQuery(params.userQuery);
  const taggedDonorFocus =
    (params.moduleKey === "donor" || params.moduleKey === "oshareview")
    && (params.mentionedConstituentIds?.length ?? 0) > 0;

  let base: StewardContextResult;

  if (params.moduleKey === "compassion") {
    base = await buildCompassionContext({
      organizationId: params.organizationId,
      tokens,
      scopePath: params.scopePath,
    });
  } else if (params.moduleKey === "events") {
    base = await buildEventsContext({
      organizationId: params.organizationId,
      tokens,
      scopePath: params.scopePath,
    });
  } else if (params.moduleKey === "watchdog") {
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

    base = {
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
  } else if (params.moduleKey === "webmaster") {
    base = {
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
  } else {
    base = await buildDonorContext({
      organizationId: params.organizationId,
      scopePath: params.scopePath,
      userId: params.userId,
      role: params.role,
      moduleKey: params.moduleKey === "oshareview" ? "oshareview" : "donor",
      userQuery: params.userQuery,
      mentionedConstituentIds: params.mentionedConstituentIds,
    });
  }

  if (!taggedDonorFocus) {
    const workspaceScope = scopeFromModuleKey(params.moduleKey);
    const [memoryContext, fileContext] = await Promise.all([
      buildUserMemoryContext({
        organizationId: params.organizationId,
        userId: params.userId,
        userQuery: params.userQuery,
        workspaceScope,
        limit: 8,
      }),
      buildFileContext({
        organizationId: params.organizationId,
        userId: params.userId,
        userQuery: params.userQuery,
        workspaceScope,
        limit: 6,
      }),
    ]);

    base = {
      contextText: [
        base.contextText,
        "Context layer policy: session context is temporary; saved memories are user-specific; uploaded file context is user-managed; CRM data remains live tool context.",
        memoryContext.contextText,
        fileContext.contextText,
      ].join("\n"),
      toolsUsed: [...base.toolsUsed, ...memoryContext.toolsUsed, ...fileContext.toolsUsed],
      recordsUsed: [...base.recordsUsed, ...memoryContext.recordsUsed, ...fileContext.recordsUsed],
    };
  } else {
    base = {
      ...base,
      contextText: [
        base.contextText,
        "Tagged donor focus policy: memory and file layers are skipped so answers stay grounded only in tagged donor profile data.",
      ].join("\n"),
      toolsUsed: [...base.toolsUsed, "context.taggedDonorFocus"],
    };
  }

  if (params.mode !== "help") {
    return base;
  }

  const helpScope = params.moduleKey === "compassion"
    ? "compassion"
    : params.moduleKey === "events"
      ? "events"
      : "donor";
  const guideMatches = searchStewardHelpGuides({
    scope: helpScope,
    query: params.userQuery,
    limit: 6,
  });

  if (guideMatches.length === 0) {
    return {
      ...base,
      toolsUsed: [...base.toolsUsed, "help.guides"],
      contextText: [
        base.contextText,
        `Help scope: ${helpScope}`,
        "No direct help guides matched this query. Use /help search with broader terms.",
      ].join("\n"),
      recordsUsed: [...base.recordsUsed, `Help scope: ${helpScope}`],
    };
  }

  const helpLines = [
    `Help scope: ${helpScope}`,
    `Matched help guides: ${guideMatches.length}`,
    ...guideMatches.map((guide) => `- ${guide.title} (/help/${guide.slug}?scope=${guide.scope})`),
  ];

  return {
    ...base,
    toolsUsed: [...base.toolsUsed, "help.guides"],
    contextText: [base.contextText, ...helpLines].join("\n"),
    recordsUsed: [
      ...base.recordsUsed,
      ...guideMatches.map((guide) => `${guide.title} (/help/${guide.slug})`),
    ],
  };
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
  const userIntent = detectStewardIntent(latestUserMessage, mode);
  const responseContract = buildIntentResponseContract(userIntent);
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

  /** Sends a human-readable progress update to the client during pipeline stages. */
  function writeProgress(message: string): void {
    res.write(`${JSON.stringify({ type: "progress", message })}\n`);
  }

  /** Sends a thinking/reasoning delta to the client (DeepSeek reasoning tokens). */
  function writeThinking(delta: string): void {
    res.write(`${JSON.stringify({ type: "thinking", delta })}\n`);
  }

  const guidePath = buildGuidePathClarification({
    mode,
    moduleKey,
    userQuery: latestUserMessage,
    recentUserQuery: normalizedMessages
      .filter((message) => message.role === "user")
      .slice(-4)
      .map((message) => message.content)
      .join("\n"),
  });

  if (guidePath) {
    const toolsUsed = ["guidepath.classifier", ...(explicitSavedMemory ? ["memory.saveExplicit"] : [])];
    res.write(`${JSON.stringify({ type: "chunk", delta: guidePath.structured.replyMarkdown })}\n`);
    res.write(`${JSON.stringify({
      type: "done",
      reply: guidePath.structured.replyMarkdown,
      structured: guidePath.structured,
      model: config.model,
      mode,
      runtimeMode: config.mode,
      provider: "guidepath",
      toolsUsed,
      recordsUsed: [],
      moduleKey,
      scopePath,
    })}\n`);
    res.end();
    return;
  }

  const thoughtStack = buildThoughtStackAssessment({
    mode,
    moduleKey,
    userIntent,
    userQuery: latestUserMessage,
  });

  if (thoughtStack.state !== "Ready to Act" && thoughtStack.structured) {
    const toolsUsed = ["thoughtstack.assess", ...(explicitSavedMemory ? ["memory.saveExplicit"] : [])];
    res.write(`${JSON.stringify({ type: "chunk", delta: thoughtStack.structured.replyMarkdown })}\n`);
    res.write(`${JSON.stringify({
      type: "done",
      reply: thoughtStack.structured.replyMarkdown,
      structured: thoughtStack.structured,
      model: config.model,
      mode,
      runtimeMode: config.mode,
      provider: "thoughtstack",
      toolsUsed,
      recordsUsed: [],
      moduleKey,
      scopePath,
    })}\n`);
    res.end();
    return;
  }

  try {
    if (!taggedDonorFocus && mode !== "llm" && moduleKey === "donor" && isTopDonorQuestion(latestUserMessage)) {
      writeProgress("Looking up top donor records…");
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
      res.end();
      return;
    }

    if (!taggedDonorFocus && mode !== "llm" && moduleKey === "donor" && isReportQuestion(latestUserMessage)) {
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
          writeProgress(retrievalProgressMessages[moduleKey] ?? "Reviewing CRM records…");

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
    const modelContextText = buildModelContextForIntent(retrieval.contextText, userIntent);

    if (mode !== "free" && retrieval.toolsUsed.length > 1) {
      writeProgress(`Checking ${retrieval.toolsUsed.length} data sources…`);
    }

    // ── Stage 2: Agentic multi-stage reasoning ──────────────────────────────
    if (config.agenticMultiStage && mode !== "free") {
      writeProgress("Planning how to answer your question…");
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
      "thoughtstack.assess",
      ...agenticToolsUsed,
      ...(explicitSavedMemory ? ["memory.saveExplicit"] : []),
    ];
    let provider = agenticPreparation.stageSummaries.length > 0 ? "ollama-agentic" : "ollama";
    let completion: { content: string; model: string };

    writeProgress("Drafting a response…");

    if (userIntent === "draft_email") {
      writeProgress("Writing first-pass email draft…");
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

        writeProgress("Primary model returned empty output; attempting recovery generation…");
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

    const parsedStructured = normalizeStewardStructuredResponse(completion.content, {
      debug: false,
    });

    const templatedReply = formatReplyByMode({
      mode,
      userIntent,
      reply: parsedStructured.replyMarkdown || completion.content,
      toolsUsed,
      recordsUsed: retrieval.recordsUsed,
    });
    const thoughtStackEvidence: StewardEvidencePayload[] = [
      { label: `ThoughtStack state: ${thoughtStack.state}` },
      { label: `ThoughtStack workflow: ${thoughtStack.selectedWorkflow}` },
      { label: `ThoughtStack risk: ${thoughtStack.riskLevel}` },
    ];
    const verificationEvidence = extractVerificationEvidence(agenticToolPass.notes);
    const structured: StewardStructuredResponsePayload = {
      ...parsedStructured,
      replyMarkdown: templatedReply,
      evidence: [
        ...thoughtStackEvidence,
        ...verificationEvidence,
        ...parsedStructured.evidence,
      ].slice(0, 16),
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
        thoughtStackState: thoughtStack.state,
        thoughtStackRiskLevel: thoughtStack.riskLevel,
        thoughtStackConfidence: thoughtStack.confidence,
        thoughtStackWorkflow: thoughtStack.selectedWorkflow,
        thoughtStackMissingDetails: thoughtStack.missingDetails,
        thoughtStackRequiresConfirmation: thoughtStack.requiresConfirmation,
        thoughtStackDryRunRecommended: thoughtStack.dryRunRecommended,
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
  const userIntent = detectStewardIntent(latestUserMessage, mode);
  const responseContract = buildIntentResponseContract(userIntent);
  const clientReportingYearMode = payload.reportingYearMode === "fiscal" ? "fiscal" : "calendar";
  const clientFiscalYear = typeof payload.fiscalYear === "number" ? payload.fiscalYear : undefined;
  const clientFiscalYearStart = typeof payload.fiscalYearStart === "number" ? payload.fiscalYearStart : undefined;

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

  const guidePath = buildGuidePathClarification({
    mode,
    moduleKey,
    userQuery: latestUserMessage,
    recentUserQuery: normalizedMessages
      .filter((message) => message.role === "user")
      .slice(-4)
      .map((message) => message.content)
      .join("\n"),
  });

  if (guidePath) {
    const toolsUsed = ["guidepath.classifier", ...(explicitSavedMemory ? ["memory.saveExplicit"] : [])];
    res.json({
      data: {
        reply: guidePath.structured.replyMarkdown,
        structured: guidePath.structured,
        model: config.model,
        mode,
        runtimeMode: config.mode,
        provider: "guidepath",
        toolsUsed,
        recordsUsed: [],
        moduleKey,
        scopePath,
      },
    });
    return;
  }

  const thoughtStack = buildThoughtStackAssessment({
    mode,
    moduleKey,
    userIntent,
    userQuery: latestUserMessage,
  });

  if (thoughtStack.state !== "Ready to Act" && thoughtStack.structured) {
    const toolsUsed = ["thoughtstack.assess", ...(explicitSavedMemory ? ["memory.saveExplicit"] : [])];
    res.json({
      data: {
        reply: thoughtStack.structured.replyMarkdown,
        structured: thoughtStack.structured,
        model: config.model,
        mode,
        runtimeMode: config.mode,
        provider: "thoughtstack",
        toolsUsed,
        recordsUsed: [],
        moduleKey,
        scopePath,
      },
    });
    return;
  }

  try {
    if (!taggedDonorFocus && mode !== "llm" && moduleKey === "donor" && isTopDonorQuestion(latestUserMessage)) {
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

    if (!taggedDonorFocus && mode !== "llm" && moduleKey === "donor" && isReportQuestion(latestUserMessage)) {
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
    const modelContextText = buildModelContextForIntent(retrieval.contextText, userIntent);

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

    const fyMeta = extractFiscalYearFromContext(retrieval.contextText);
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
      "thoughtstack.assess",
      ...agenticToolsUsed,
      ...(explicitSavedMemory ? ["memory.saveExplicit"] : []),
    ];
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

    const parsedStructured = normalizeStewardStructuredResponse(completion.content, {
      debug: false,
    });

    const templatedReply = formatReplyByMode({
      mode,
      userIntent,
      reply: parsedStructured.replyMarkdown || completion.content,
      toolsUsed,
      recordsUsed: retrieval.recordsUsed,
    });
    const thoughtStackEvidence: StewardEvidencePayload[] = [
      { label: `ThoughtStack state: ${thoughtStack.state}` },
      { label: `ThoughtStack workflow: ${thoughtStack.selectedWorkflow}` },
      { label: `ThoughtStack risk: ${thoughtStack.riskLevel}` },
    ];
    const verificationEvidence = extractVerificationEvidence(agenticToolPass.notes);
    const structured: StewardStructuredResponsePayload = {
      ...parsedStructured,
      replyMarkdown: templatedReply,
      evidence: [
        ...thoughtStackEvidence,
        ...verificationEvidence,
        ...parsedStructured.evidence,
      ].slice(0, 16),
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
        thoughtStackState: thoughtStack.state,
        thoughtStackRiskLevel: thoughtStack.riskLevel,
        thoughtStackConfidence: thoughtStack.confidence,
        thoughtStackWorkflow: thoughtStack.selectedWorkflow,
        thoughtStackMissingDetails: thoughtStack.missingDetails,
        thoughtStackRequiresConfirmation: thoughtStack.requiresConfirmation,
        thoughtStackDryRunRecommended: thoughtStack.dryRunRecommended,
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
