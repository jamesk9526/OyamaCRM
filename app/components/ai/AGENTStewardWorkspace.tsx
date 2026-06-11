/**
 * AGENTStewardWorkspace — full-page modern CRM assistant workspace.
 * Light material, conversation-first layout with a left sidebar for
 * thread history, a wide central message area, and a bottom composer.
 * CRM scope is always visible and manually selectable.
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import { getFiscalYearForDate, getFiscalYearEndMonth } from "@/app/lib/fiscal-year";
import StewardResponseRenderer from "@/app/components/ai/StewardResponseRenderer";
import { StewardThinkingPanel } from "@/app/components/ai/StewardThinkingPanel";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import type {
  StewardEmailDraftArtifact,
  StewardChartArtifact,
  StewardReportCardArtifact,
  StewardStructuredResponse,
} from "@/app/components/ai/steward-artifact-types";
import { executeStewardSuggestedAction } from "@/app/components/ai/steward-action-executor";
import DonorMentionPicker, { type MentionedDonor } from "@/app/components/ai/DonorMentionPicker";
import StewardSaveTemplateModal, { type StewardTemplateDraft } from "@/app/components/ai/StewardSaveTemplateModal";
import EmailBuilderApp from "@/app/components/email-builder/EmailBuilderApp";
import OyamaLettersWorkspace from "@/app/components/letters/OyamaLettersWorkspace";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModuleKey =
  | "donor"
  | "compassion"
  | "events"
  | "watchdog"
  | "webmaster"
  | "hrm"
  | "all";

type ChatMode = "ask" | "analyze" | "draft" | "free" | "agentic" | "writing" | "llm" | "action" | "help";
type RenderMode = "markdown" | "html";

interface UiMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  structured?: StewardStructuredResponse;
  toolsUsed?: string[];
  recordsUsed?: string[];
  provider?: string;
  responseMode?: ChatMode;
  moduleKey?: string;
  runtimeMode?: "local" | "remote" | "unknown";
  /** Human-readable pipeline progress steps (retrieval, planning, drafting). */
  progressSteps?: string[];
  /** Reasoning tokens from DeepSeek or other thinking-capable models. */
  thinkingContent?: string;
  /** Live tool feed — populated from "tool" stream events during generation. */
  activeTools?: ActiveTool[];
  /** Pipeline percent from server progress events. */
  progressPercent?: number;
  /** Pipeline stage from server progress events. */
  progressStage?: string;
  /** Whether ThoughtStack beta was enabled for this specific request. */
  thoughtStackEnabled?: boolean;
}

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  moduleKey: ModuleKey;
  messages: UiMessage[];
}

interface AiConfigPayload {
  enabled: boolean;
  mode: "local" | "remote";
  endpointUrl: string;
  model: string;
  chatHeadEnabled: boolean;
}

interface StewardChatStreamChunk { type: "chunk"; delta: string; }
interface StewardChatStreamDone {
  type: "done"; reply: string;
  structured?: StewardStructuredResponse;
  model: string; mode: ChatMode;
  runtimeMode?: "local" | "remote";
  provider: string;
  toolsUsed: string[];
  recordsUsed?: string[];
  moduleKey?: string;
  scopePath?: string;
}
interface StewardChatStreamError { type: "error"; message: string; }

type ReportGuideTemplateId = "board_pack" | "campaign_pivot" | "retention_risk_plan";
type ReportLayoutHint = "compact" | "balanced" | "detailed";

interface ReportGuideTemplate {
  id: ReportGuideTemplateId;
  label: string;
  description: string;
  defaultPrompt: string;
  layoutHint: ReportLayoutHint;
  defaultFilters: string[];
}

interface StewardReportRefineResponsePayload {
  data: {
    reply: string;
    structured: StewardStructuredResponse;
    guideTemplate: ReportGuideTemplateId;
    layoutHint: ReportLayoutHint;
    appliedFilters: string[];
    revisionLabel: string;
    guideTemplates: ReportGuideTemplate[];
  };
}

interface ReportArtifactRevision {
  id: string;
  version: number;
  createdAt: string;
  label: string;
  prompt: string;
  guideTemplate: ReportGuideTemplateId;
  layoutHint: ReportLayoutHint;
  appliedFilters: string[];
  structured?: StewardStructuredResponse;
  replyContent?: string;
}

interface WorkspaceNoteState {
  text: string;
  version: number;
  sourceOfTruth: boolean;
}

const DEFAULT_REPORT_GUIDE_TEMPLATES: ReportGuideTemplate[] = [
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

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike>;
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;
/** Progress update sent during pipeline stages (retrieval, planning, drafting). */
interface StewardChatStreamProgress { type: "progress"; message: string; stage?: string; percent?: number; }
/** Reasoning token from DeepSeek or other thinking-capable models. */
interface StewardChatStreamThinking { type: "thinking"; delta: string; }
/** Live tool lifecycle event — name/label/status of a CRM tool being run. */
interface StewardChatStreamTool { type: "tool"; name: string; label: string; status: "start" | "done"; }

interface StewardToolOption {
  name: string;
  kind: "read" | "write";
  description: string;
  allowed: boolean;
}

function splitToolWords(value: string): string[] {
  return value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
}

function toolSearchKeywords(tool: StewardToolOption): string[] {
  const parts = tool.name.split(".");
  const namespace = parts[0] ?? "";
  const action = parts[1] ?? "";
  const keywords = new Set<string>([
    namespace.toLowerCase(),
    action.toLowerCase(),
    ...splitToolWords(tool.name),
    ...splitToolWords(tool.description),
  ]);

  if (namespace === "reports") {
    ["report", "analytics", "kpi", "board", "dashboard", "ytd", "summary"].forEach((k) => keywords.add(k));
  }
  if (namespace === "donor") {
    ["donor", "constituent", "retention", "giving", "profile", "stewardship"].forEach((k) => keywords.add(k));
  }
  if (namespace === "campaigns") {
    ["campaign", "fundraising", "goal", "progress"].forEach((k) => keywords.add(k));
  }
  if (namespace === "tasks") {
    ["task", "todo", "followup", "action"].forEach((k) => keywords.add(k));
  }
  if (namespace === "communications") {
    ["email", "draft", "outreach", "message"].forEach((k) => keywords.add(k));
  }
  if (namespace === "letters" || namespace === "branding") {
    ["letter", "brand", "template", "html", "css"].forEach((k) => keywords.add(k));
  }

  return [...keywords];
}

function scoreToolMatch(tool: StewardToolOption, query: string): number {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return 1;

  const name = tool.name.toLowerCase();
  const description = tool.description.toLowerCase();
  const keywords = toolSearchKeywords(tool);
  const terms = normalizedQuery.split(/[\s._-]+/).filter(Boolean);
  if (terms.length === 0) return 1;

  let score = 0;
  for (const term of terms) {
    const inName = name.includes(term);
    const inDescription = description.includes(term);
    const inKeywords = keywords.some((keyword) => keyword.includes(term));
    if (!inName && !inDescription && !inKeywords) {
      return -1;
    }

    if (name === term) score += 120;
    else if (name.startsWith(term)) score += 80;
    else if (inName) score += 55;
    else if (inKeywords) score += 35;
    else if (inDescription) score += 20;
  }

  if (name.startsWith(normalizedQuery)) score += 40;
  if (name.includes(`.${normalizedQuery}`)) score += 28;
  return score;
}

interface StewardToolsListPayload {
  data: {
    moduleKey: string;
    scopePath: string;
    tools: StewardToolOption[];
  };
}

/** A single entry in the live tool feed shown in the thinking panel. */
export interface ActiveTool {
  name: string;
  label: string;
  /** "active" while running, "done" once complete. */
  status: "active" | "done";
}

type StewardChatStreamEvent =
  | StewardChatStreamChunk
  | StewardChatStreamDone
  | StewardChatStreamError
  | StewardChatStreamProgress
  | StewardChatStreamThinking
  | StewardChatStreamTool;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseMetricNumeric(value: string): number | null {
  const input = (value || "").trim();
  if (!input) return null;

  const normalized = input.replace(/[,$\s]/g, "").toUpperCase();
  const match = normalized.match(/^(-?\d+(?:\.\d+)?)([KMB])?$/);
  if (!match) return null;

  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  const suffix = match[2];
  if (suffix === "K") return base * 1_000;
  if (suffix === "M") return base * 1_000_000;
  if (suffix === "B") return base * 1_000_000_000;
  return base;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}

function extractInlineForcedTools(text: string, knownToolNames: Set<string>): { cleanedText: string; tools: string[] } {
  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { cleanedText: "", tools: [] };

  const tools: string[] = [];
  const kept: string[] = [];
  for (let i = 0; i < tokens.length; i += 1) {
    const token = tokens[i];
    const isEdgeToken = i <= 1 || i >= tokens.length - 2;
    if (isEdgeToken && /^\/[a-zA-Z0-9._-]+$/.test(token)) {
      const toolName = token.slice(1);
      if (knownToolNames.has(toolName)) {
        tools.push(toolName);
        continue;
      }
    }
    kept.push(token);
  }

  return {
    cleanedText: kept.join(" ").trim(),
    tools: [...new Set(tools)],
  };
}

function createReportRevision(params: {
  version: number;
  label: string;
  prompt: string;
  guideTemplate: ReportGuideTemplateId;
  layoutHint: ReportLayoutHint;
  appliedFilters?: string[];
  structured?: StewardStructuredResponse;
  replyContent?: string;
}): ReportArtifactRevision {
  return {
    id: crypto.randomUUID(),
    version: params.version,
    createdAt: new Date().toISOString(),
    label: params.label,
    prompt: params.prompt,
    guideTemplate: params.guideTemplate,
    layoutHint: params.layoutHint,
    appliedFilters: params.appliedFilters ?? [],
    structured: params.structured,
    replyContent: params.replyContent,
  };
}

function buildReportPrintHtml(params: {
  title: string;
  fiscalYearLabel?: string;
  route: string;
  metrics: Array<{ label: string; value: string; delta?: string }>;
  evidence: Array<{ label: string; detail?: string }>;
  insights: string[];
}): string {
  const now = new Date();
  const timestamp = new Intl.DateTimeFormat("en-US", {
    dateStyle: "full",
    timeStyle: "short",
  }).format(now);

  const metricRows = params.metrics
    .map((metric) => {
      const delta = metric.delta ? `<div class=\"delta\">${escapeHtml(metric.delta)}</div>` : "";
      return `
        <div class=\"metric\">
          <div class=\"metric-label\">${escapeHtml(metric.label)}</div>
          <div class=\"metric-value\">${escapeHtml(metric.value)}</div>
          ${delta}
        </div>
      `;
    })
    .join("\n");

  const evidenceRows = params.evidence
    .slice(0, 16)
    .map((item) => `<li>${escapeHtml(item.label)}${item.detail ? ` - ${escapeHtml(item.detail)}` : ""}</li>`)
    .join("\n");

  const insightRows = params.insights
    .slice(0, 8)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("\n");

  return `<!doctype html>
<html>
<head>
  <meta charset=\"utf-8\" />
  <title>${escapeHtml(params.title)} - Printable Report</title>
  <style>
    body { font-family: "Segoe UI", Arial, sans-serif; color: #0f172a; margin: 28px; }
    h1 { margin: 0 0 4px; font-size: 24px; }
    .sub { color: #334155; margin: 0 0 16px; font-size: 13px; }
    .meta { display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 14px; font-size: 12px; color: #334155; }
    .section { margin-top: 16px; }
    .section h2 { margin: 0 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .05em; color: #0f766e; }
    .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 10px; }
    .metric { border: 1px solid #cbd5e1; border-radius: 10px; padding: 10px; }
    .metric-label { font-size: 11px; text-transform: uppercase; color: #475569; }
    .metric-value { font-size: 20px; font-weight: 700; margin-top: 4px; }
    .delta { margin-top: 4px; font-size: 11px; color: #0f766e; }
    ul { margin: 0; padding-left: 20px; }
    li { margin: 4px 0; font-size: 13px; line-height: 1.35; }
    .footer { margin-top: 20px; font-size: 11px; color: #64748b; }
    @media print { body { margin: 14mm; } }
  </style>
</head>
<body>
  <h1>${escapeHtml(params.title)}</h1>
  <p class=\"sub\">Steward AI report snapshot${params.fiscalYearLabel ? ` - ${escapeHtml(params.fiscalYearLabel)}` : ""}</p>
  <div class=\"meta\">
    <span><strong>Generated:</strong> ${escapeHtml(timestamp)}</span>
    <span><strong>Route:</strong> ${escapeHtml(params.route)}</span>
  </div>

  <section class=\"section\">
    <h2>Key Metrics</h2>
    <div class=\"metrics\">${metricRows}</div>
  </section>

  <section class=\"section\">
    <h2>Steward Insights</h2>
    <ul>${insightRows || "<li>No insights were generated for this snapshot.</li>"}</ul>
  </section>

  <section class=\"section\">
    <h2>Evidence Highlights</h2>
    <ul>${evidenceRows || "<li>No evidence highlights were attached.</li>"}</ul>
  </section>

  <p class=\"footer\">Generated from Steward Report Workspace for printable review.</p>
</body>
</html>`;
}

function buildInteractiveReportHtml(params: {
  title: string;
  fiscalYearLabel?: string;
  route: string;
  generatedAt: string;
  metrics: Array<{ label: string; value: string; delta?: string }>;
  evidence: Array<{ label: string; detail?: string }>;
  insights: string[];
  reply?: string;
}): string {
  const safeTitle = escapeHtml(params.title || "Steward Report Artifact");
  const safeRoute = escapeHtml(params.route || "/reports");
  const safeFy = escapeHtml(params.fiscalYearLabel || "Current Reporting Window");
  const safeGenerated = escapeHtml(params.generatedAt);

  const metricsHtml = params.metrics.length > 0
    ? params.metrics.map((metric) => {
      const delta = metric.delta ? `<p class="metric-delta">${escapeHtml(metric.delta)}</p>` : "";
      return `<article class="metric-card"><h4>${escapeHtml(metric.label)}</h4><p class="metric-value">${escapeHtml(metric.value)}</p>${delta}</article>`;
    }).join("\n")
    : "<p class=\"empty\">No metrics available for this snapshot.</p>";

  const evidenceHtml = params.evidence.length > 0
    ? params.evidence.slice(0, 24).map((item) => (
      `<li>${escapeHtml(item.label)}${item.detail ? ` - ${escapeHtml(item.detail)}` : ""}</li>`
    )).join("\n")
    : "<li>No evidence highlights attached.</li>";

  const insightsHtml = params.insights.length > 0
    ? params.insights.slice(0, 12).map((item) => `<li>${escapeHtml(item)}</li>`).join("\n")
    : "<li>No additional guidance generated.</li>";

  const replyHtml = params.reply
    ? `<section class="section"><h3>Steward Narrative</h3><p class="reply">${escapeHtml(params.reply).replace(/\n/g, "<br />")}</p></section>`
    : "";

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: dark; }
    body {
      margin: 0;
      background: radial-gradient(circle at top right, #123046, #050b14 45%, #030712 100%);
      color: #e2e8f0;
      font-family: "Segoe UI", "Inter", sans-serif;
      line-height: 1.45;
    }
    .wrap { max-width: 1100px; margin: 0 auto; padding: 16px; }
    .header {
      border: 1px solid rgba(148, 163, 184, 0.28);
      border-radius: 14px;
      background: rgba(15, 23, 42, 0.82);
      padding: 14px;
      backdrop-filter: blur(8px);
    }
    .eyebrow { font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #67e8f9; margin: 0 0 6px; }
    h1 { margin: 0; font-size: 21px; }
    .meta { margin-top: 8px; font-size: 12px; color: #94a3b8; display: flex; flex-wrap: wrap; gap: 10px; }
    .grid { margin-top: 14px; display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 10px; }
    .metric-card { border: 1px solid rgba(148, 163, 184, 0.24); border-radius: 12px; background: rgba(15, 23, 42, 0.85); padding: 10px; }
    .metric-card h4 { margin: 0; font-size: 11px; letter-spacing: .05em; text-transform: uppercase; color: #94a3b8; }
    .metric-value { margin: 6px 0 0; font-size: 19px; font-weight: 700; color: #f8fafc; }
    .metric-delta { margin: 4px 0 0; font-size: 11px; color: #5eead4; }
    .cols { margin-top: 14px; display: grid; grid-template-columns: 1.1fr .9fr; gap: 12px; }
    .section { border: 1px solid rgba(148, 163, 184, 0.2); border-radius: 12px; background: rgba(15, 23, 42, 0.72); padding: 12px; }
    .section h3 { margin: 0 0 8px; font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #cbd5e1; }
    .section ul { margin: 0; padding-left: 18px; }
    .section li { margin: 4px 0; font-size: 13px; color: #cbd5e1; }
    .reply { margin: 0; white-space: normal; color: #e2e8f0; font-size: 13px; }
    .toolbar { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
    .btn {
      border: 1px solid rgba(45, 212, 191, 0.38);
      border-radius: 999px;
      background: rgba(20, 184, 166, 0.15);
      color: #ccfbf1;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
    }
    .btn:hover { background: rgba(20, 184, 166, 0.28); }
    .btn.secondary {
      border-color: rgba(148, 163, 184, 0.35);
      background: rgba(15, 23, 42, 0.72);
      color: #cbd5e1;
    }
    .empty { margin: 0; color: #94a3b8; font-size: 13px; }
    @media (max-width: 860px) {
      .cols { grid-template-columns: 1fr; }
      .wrap { padding: 12px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <header class="header">
      <p class="eyebrow">Interactive Steward Artifact</p>
      <h1>${safeTitle}</h1>
      <div class="meta">
        <span><strong>Period:</strong> ${safeFy}</span>
        <span><strong>Route:</strong> ${safeRoute}</span>
        <span><strong>Built:</strong> ${safeGenerated}</span>
      </div>
      <div class="toolbar">
        <button class="btn" onclick="window.print()">Print</button>
        <button class="btn secondary" onclick="window.location.href='${safeRoute}'">Open Full Report</button>
      </div>
    </header>

    <section class="grid">${metricsHtml}</section>

    <section class="cols">
      <section class="section">
        <h3>Evidence Highlights</h3>
        <ul>${evidenceHtml}</ul>
      </section>
      <section class="section">
        <h3>Guidance</h3>
        <ul>${insightsHtml}</ul>
      </section>
    </section>

    ${replyHtml}
  </div>
</body>
</html>`;
}

// ─── Scope config ─────────────────────────────────────────────────────────────

const SCOPE_OPTIONS: Array<{ key: ModuleKey; label: string; description: string; color: string }> = [
  { key: "donor",      label: "Donor CRM",      description: "Donors, donations, campaigns, grants, stewardship", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "compassion", label: "Compassion CRM",  description: "Client care, cases, appointments, services",       color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "events",     label: "Events CRM",      description: "Events, guests, tables, check-in, tickets",        color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "hrm",        label: "HRM",             description: "Staff, scheduling, HR records",                    color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "webmaster",  label: "Webmaster",        description: "Sites, pages, publishing, CMS",                   color: "bg-rose-50 text-rose-700 border-rose-200" },
  { key: "watchdog",   label: "Watchdog",         description: "Security events, alerts, audit logs",             color: "bg-slate-50 text-slate-700 border-slate-200" },
  { key: "all",        label: "All CRM Data",     description: "All modules where you have permission",           color: "bg-slate-50 text-slate-700 border-slate-200" },
];

type AddContextActionKey =
  | "attach_file"
  | "upload_csv"
  | "add_crm_record"
  | "add_donor_list"
  | "add_campaign"
  | "add_report_context";

const ADD_CONTEXT_MENU_ITEMS: Array<{ key: AddContextActionKey; label: string; icon: string }> = [
  {
    key: "attach_file",
    label: "Attach file",
    icon: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13",
  },
  {
    key: "upload_csv",
    label: "Upload CSV",
    icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    key: "add_crm_record",
    label: "Add CRM record",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    key: "add_donor_list",
    label: "Add donor list",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0",
  },
  {
    key: "add_campaign",
    label: "Add campaign",
    icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z",
  },
  {
    key: "add_report_context",
    label: "Add report context",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
];

// ─── Starter prompts ──────────────────────────────────────────────────────────

const STARTER_PROMPTS: Record<ModuleKey, string[]> = {
  donor: [
    "What donor follow-up tasks should I create this week?",
    "Draft a thank-you note for our top 5 donors this year.",
    "Summarize donor engagement risks from current records.",
    "Which donors are at risk of lapsing?",
    "Show me giving trends for the last 3 years.",
  ],
  compassion: [
    "Summarize this client's context from visible page details.",
    "What client follow-ups should happen this week?",
    "Draft a client-safe appointment reminder.",
    "Which cases need urgent attention?",
  ],
  events: [
    "Summarize event operations status.",
    "What check-in risks should staff watch today?",
    "Draft a post-event thank-you message.",
    "Show me ticket sales breakdown.",
  ],
  hrm: [
    "Summarize internal staffing priorities for today.",
    "Draft an internal announcement for all staff.",
    "What schedule conflicts should HRM resolve this week?",
  ],
  webmaster: [
    "Propose a nonprofit website information architecture.",
    "Draft homepage copy for donor conversion.",
    "What pages should we launch first and why?",
  ],
  watchdog: [
    "Summarize high-risk security events in this view.",
    "Draft an incident response checklist for this alert.",
    "What access controls should I verify first?",
  ],
  all: [
    "What's the most important thing I should focus on today?",
    "Give me a cross-module activity summary for this week.",
    "Draft a board-ready summary of current CRM activity.",
  ],
};

const MODE_HELP: Record<ChatMode, string> = {
  ask: "Ask & retrieve: grounded CRM answers with source-aware context and no record changes.",
  analyze: "Trend & diagnostics: compare periods, surface risk/opportunity, and explain why.",
  draft: "Draft outreach fast: generate editable emails/letters/reports for human review.",
  free: "Pure mode: no CRM tools, no retrieval, and no structured artifacts. Direct answers only.",
  agentic: "Agentic mode: tool-aware reasoning that can plan and use CRM tools before answering.",
  writing: "Legacy writing mode alias. Use Pure mode instead.",
  llm: "LLM deep reasoning: broader synthesis, strategy exploration, and clarifying follow-up questions.",
  action: "Action planner: propose CRM actions as confirm-first, reviewable steps.",
  help: "Workflow guide: where to click, what order to follow, and what to do next.",
};

const QUICK_WORKFLOWS: Array<{ label: string; mode: ChatMode; prompt: string }> = [
  { label: "Today’s priorities", mode: "analyze", prompt: "Review my donor CRM data and summarize the most important stewardship priorities for today." },
  { label: "Draft outreach", mode: "draft", prompt: "Draft a donor outreach email for the selected audience. Include subject, preview text, and a warm nonprofit tone." },
  { label: "Pure mode", mode: "free", prompt: "Answer the question directly with no CRM tools, no retrieval, and no structured artifacts. Use only the user's prompt and general knowledge." },
  { label: "Agentic mode", mode: "agentic", prompt: "Use CRM tools if they help, plan the steps, and adapt the answer after the tool results arrive. Keep write actions confirm-first." },
  { label: "LLM brainstorm", mode: "llm", prompt: "Use LLM mode to brainstorm 5 donor engagement angles, then rank them by likely impact and effort." },
  { label: "Find a segment", mode: "analyze", prompt: "Find a useful donor segment for outreach and explain the selection criteria before suggesting next steps." },
  { label: "Create follow-up plan", mode: "action", prompt: "Create a review-first follow-up plan with tasks I can confirm before anything is written to the CRM." },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

const THREAD_LIMIT = 30;
const MSG_LIMIT    = 80;
const STORAGE_KEY  = "agent-steward-threads:v1";
const ACTIVE_THREAD_STORAGE_KEY = "agent-steward-active-thread:v1";
const RENDER_MODE_STORAGE_KEY = "agent-steward-render-mode:v1";
const THOUGHTSTACK_SESSION_STORAGE_KEY = "steward-thoughtstack-enabled:v1";

interface MemoryPreferencesPayload {
  memoryEnabled: boolean;
  fileContextEnabled: boolean;
  updatedAt?: string;
}

function readThreads(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = new Date().toISOString();
    return (parsed as Partial<ChatThread>[])
      .filter(Boolean)
      .map((t, i) => ({
        id:        typeof t.id === "string" ? t.id : crypto.randomUUID(),
        title:     typeof t.title === "string" && t.title.trim() ? t.title.trim() : `Chat ${i + 1}`,
        createdAt: typeof t.createdAt === "string" ? t.createdAt : now,
        updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : now,
        moduleKey: (["donor","compassion","events","hrm","webmaster","watchdog","all"].includes(String(t.moduleKey))
          ? t.moduleKey : "donor") as ModuleKey,
        messages: normalizeMessages(t.messages),
      }))
      .slice(0, THREAD_LIMIT);
  } catch { return []; }
}

function writeThreads(threads: ChatThread[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, THREAD_LIMIT)));
  } catch { /* quota guard */ }
}

function readStoredActiveThreadId(): string | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(ACTIVE_THREAD_STORAGE_KEY);
  return stored && stored.trim().length > 0 ? stored : null;
}

function writeStoredActiveThreadId(threadId: string | null) {
  if (typeof window === "undefined") return;
  if (!threadId) {
    window.localStorage.removeItem(ACTIVE_THREAD_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(ACTIVE_THREAD_STORAGE_KEY, threadId);
}

function normalizeMessages(raw: unknown): UiMessage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<UiMessage>[])
    .filter((m) => m && typeof m === "object")
    .map((m): UiMessage => {
      const role: UiMessage["role"] = m.role === "assistant" ? "assistant" : "user";
      const responseMode: ChatMode | undefined = ["ask", "analyze", "draft", "free", "agentic", "writing", "llm", "action", "help"].includes(String(m.responseMode))
        ? (m.responseMode as ChatMode)
        : undefined;
      const runtimeMode: UiMessage["runtimeMode"] = m.runtimeMode === "local" || m.runtimeMode === "remote" || m.runtimeMode === "unknown"
        ? m.runtimeMode
        : undefined;

      return {
        id: typeof m.id === "string" ? m.id : crypto.randomUUID(),
        role,
        content: typeof m.content === "string" ? m.content : "",
        createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
        structured: m.structured as StewardStructuredResponse | undefined,
        toolsUsed: Array.isArray(m.toolsUsed) ? (m.toolsUsed as string[]) : undefined,
        recordsUsed: Array.isArray(m.recordsUsed) ? (m.recordsUsed as string[]) : undefined,
        provider: typeof m.provider === "string" ? m.provider : undefined,
        responseMode,
        moduleKey: typeof m.moduleKey === "string" ? m.moduleKey : undefined,
        runtimeMode,
        progressSteps: Array.isArray(m.progressSteps) ? (m.progressSteps as string[]) : undefined,
        thinkingContent: typeof m.thinkingContent === "string" ? m.thinkingContent : undefined,
        thoughtStackEnabled: typeof m.thoughtStackEnabled === "boolean" ? m.thoughtStackEnabled : undefined,
      };
    })
    .filter((m) => m.content.trim() || m.role === "assistant")
    .slice(-MSG_LIMIT);
}

function inferTitle(msgs: UiMessage[], fallback: string): string {
  const first = msgs.find((m) => m.role === "user" && m.content.trim());
  if (!first) return fallback;
  const t = first.content.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

function newThread(moduleKey: ModuleKey, n: number): ChatThread {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: `New chat ${n}`, createdAt: now, updatedAt: now, moduleKey, messages: [] };
}

/** Normalizes common placeholder labels into canonical Email Builder merge fields. */
function normalizeEmailTemplateMergeFields(input: string): string {
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
    { pattern: /`?\[\s*contact\s*information\s*\]`?/gi, token: "{{organizationName}}" },
    { pattern: /`?\[\s*staff\s*name\s*\]`?/gi, token: "{{staffName}}" },
    { pattern: /`?\[\s*unsubscribe\s*url\s*\]`?/gi, token: "{{unsubscribeUrl}}" },
    { pattern: /`?\[\s*manage\s*preferences\s*url\s*\]`?/gi, token: "{{managePreferencesUrl}}" },
  ];

  let normalized = input;
  for (const entry of replacements) {
    normalized = normalized.replace(entry.pattern, entry.token);
  }
  return normalized;
}

/** Converts plain text into minimal HTML paragraphs for campaign draft persistence. */
function emailTextToHtml(value: string): string {
  const escaped = value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return escaped
    .split(/\n{2,}/)
    .map((block) => `<p>${block.replace(/\n/g, "<br />")}</p>`)
    .join("\n");
}

/** Normalizes common Steward placeholders into Letters & Printables merge field tokens. */
function normalizeLetterMergeFields(input: string): string {
  const replacements: Array<{ pattern: RegExp; token: string }> = [
    { pattern: /\{\{\s*preferredName\s*\}\}/gi, token: "{{donor.preferredName}}" },
    { pattern: /\{\{\s*fullName\s*\}\}/gi, token: "{{donor.fullName}}" },
    { pattern: /\{\{\s*firstName\s*\}\}/gi, token: "{{donor.firstName}}" },
    { pattern: /\{\{\s*lastGiftAmount\s*\}\}/gi, token: "{{gift.amount}}" },
    { pattern: /\{\{\s*lastGiftDate\s*\}\}/gi, token: "{{gift.date}}" },
    { pattern: /\{\{\s*campaignName\s*\}\}/gi, token: "{{gift.campaign}}" },
    { pattern: /\{\{\s*organizationName\s*\}\}/gi, token: "{{organization.name}}" },
    { pattern: /\{\{\s*staffName\s*\}\}/gi, token: "{{staff.fullName}}" },
  ];

  let normalized = input;
  for (const entry of replacements) {
    normalized = normalized.replace(entry.pattern, entry.token);
  }
  return normalized;
}

/** Minimal markdown-aware conversion to HTML for Letter editor compatibility. */
function letterContentToHtml(value: string): string {
  const source = (value || "").trim();
  if (!source) return "";

  const escapeHtml = (text: string) => text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const applyInline = (text: string) => {
    let next = escapeHtml(text);
    next = next.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    next = next.replace(/(^|\s)_([^_]+)_(?=\s|$)/g, "$1<em>$2</em>");
    next = next.replace(/(^|\s)\*([^*]+)\*(?=\s|$)/g, "$1<em>$2</em>");
    next = next.replace(/`([^`]+)`/g, "<code>$1</code>");
    return next;
  };

  const lines = source.split(/\r?\n/);
  const chunks: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let orderedListItems: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    chunks.push(`<p>${applyInline(paragraph.join(" ").trim())}</p>`);
    paragraph = [];
  };

  const flushLists = () => {
    if (listItems.length > 0) {
      chunks.push(`<ul>${listItems.map((item) => `<li>${applyInline(item)}</li>`).join("")}</ul>`);
      listItems = [];
    }
    if (orderedListItems.length > 0) {
      chunks.push(`<ol>${orderedListItems.map((item) => `<li>${applyInline(item)}</li>`).join("")}</ol>`);
      orderedListItems = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      flushParagraph();
      flushLists();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushLists();
      const level = Math.min(3, heading[1].length);
      chunks.push(`<h${level}>${applyInline(heading[2].trim())}</h${level}>`);
      continue;
    }

    const bullet = line.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      orderedListItems = [];
      listItems.push(bullet[1].trim());
      continue;
    }

    const numbered = line.match(/^\d+\.\s+(.+)$/);
    if (numbered) {
      flushParagraph();
      listItems = [];
      orderedListItems.push(numbered[1].trim());
      continue;
    }

    if (listItems.length > 0 || orderedListItems.length > 0) {
      flushLists();
    }
    paragraph.push(line);
  }

  flushParagraph();
  flushLists();
  return chunks.join("\n");
}

function parseEmailDraftText(value: string): StewardTemplateDraft | null {
  const content = (value || "").trim();
  if (!content) return null;

  const subjectMatch = content.match(/^\**\s*subject\s*:\s*(.+)$/im);
  const previewMatch = content.match(/^\**\s*preview\s*text\s*:\s*(.+)$/im);
  const bodyHeader = content.match(/^\**\s*body\s*:\s*(.*)$/im);

  let body = content;
  if (bodyHeader) {
    const headerIndex = bodyHeader.index ?? 0;
    const afterHeader = content.slice(headerIndex + bodyHeader[0].length).trim();
    body = afterHeader || bodyHeader[1]?.trim() || content;
  }

  if (!subjectMatch && !previewMatch && !bodyHeader) {
    return null;
  }

  return {
    name: "Steward Draft Template",
    subject: normalizeEmailTemplateMergeFields((subjectMatch?.[1] || "").trim()),
    previewText: normalizeEmailTemplateMergeFields((previewMatch?.[1] || "").trim()),
    bodyText: normalizeEmailTemplateMergeFields(body),
  };
}

function extractEmailDraftBlock(content: string): string | null {
  const source = (content || "").trim();
  if (!source) return null;

  const fencedBlock = source.match(/```(?:email|markdown|text)?\s*\n([\s\S]*?)```/i);
  if (fencedBlock?.[1]?.trim()) {
    return fencedBlock[1].trim();
  }

  return null;
}

/** Extracts draft email fields from a Steward assistant message. */
function extractTemplateDraftFromMessage(msg: UiMessage): StewardTemplateDraft | null {
  const content = msg.content || "";
  const fencedDraft = extractEmailDraftBlock(content);
  if (fencedDraft) {
    return parseEmailDraftText(fencedDraft);
  }

  const emailArtifact = msg.structured?.artifacts.find((artifact) => artifact.type === "email_draft") as StewardEmailDraftArtifact | undefined;
  if (emailArtifact) {
    const bodyFromArtifact = emailArtifact.bodyPlainText || emailArtifact.bodyMarkdown || emailArtifact.body || "";
    return {
      name: "Steward Draft Template",
      subject: normalizeEmailTemplateMergeFields(emailArtifact.subject || ""),
      previewText: normalizeEmailTemplateMergeFields(emailArtifact.previewText || ""),
      bodyText: normalizeEmailTemplateMergeFields(bodyFromArtifact || ""),
    };
  }

  return parseEmailDraftText(content);
}

function sanitizeLetterBody(content: string): string {
  const source = (content || "").trim();
  if (!source) return "";

  const fencedDraft = extractEmailDraftBlock(source);
  const base = normalizeLetterMergeFields(fencedDraft || source);
  return base
    .replace(/^\s*#{1,6}\s+/gm, "")
    .replace(/\n\s*\*\*What you can do next:\*\*[\s\S]*$/im, "")
    .replace(/\n\s*What you can do next\s*:?[\s\S]*$/im, "")
    .trim();
}

function buildLetterDraftFromMessage(msg: UiMessage): {
  name: string;
  printSubject: string;
  printBody: string;
  emailSubject?: string | null;
  emailBody?: string | null;
} | null {
  const emailDraft = extractTemplateDraftFromMessage(msg);
  if (emailDraft) {
    const subject = emailDraft.subject.trim() || "Steward AI Letter Draft";
    const normalizedBody = normalizeLetterMergeFields(emailDraft.bodyText.trim() || "Letter draft body");
    return {
      name: `Steward Letter: ${subject}`.slice(0, 120),
      printSubject: subject,
      printBody: letterContentToHtml(normalizedBody) || "<p>Letter draft body</p>",
      emailSubject: subject,
      emailBody: emailTextToHtml(normalizedBody),
    };
  }

  const body = sanitizeLetterBody(msg.content);
  if (!body) return null;

  const subjectCandidate = body
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0) || "Steward AI Letter Draft";

  return {
    name: `Steward Letter: ${subjectCandidate}`.slice(0, 120),
    printSubject: subjectCandidate.slice(0, 120),
    printBody: letterContentToHtml(body) || "<p>Letter draft body</p>",
    emailSubject: null,
    emailBody: null,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AGENTStewardWorkspaceProps {
  /** Initial scope from URL query parameter. */
  initialModule?: ModuleKey;
  /** Dock mode: renders inside a fixed sidebar panel, no thread list, compact header. */
  dockMode?: boolean;
  /** Called when user clicks close in dock mode. */
  onCloseDock?: () => void;
  /**
   * Contextual prompt injected from StewardContextButton.
   * When set, starts a new chat with this prompt pre-sent automatically.
   */
  externalPrompt?: { prompt: string; moduleKey?: string; mode?: string };
  /** Called after the externalPrompt has been consumed so the parent can clear it. */
  onExternalPromptConsumed?: () => void;
  /** Optional thread id to restore when opening this workspace. */
  initialThreadId?: string;
}

interface StewardEmailWorkspaceState {
  campaignId: string;
  returnTo?: string;
}

interface StewardLetterWorkspaceState {
  templateId: string;
  initialPanel?: "document" | "preview" | "publish";
}

interface StewardReportWorkspaceState {
  path: string;
  title: string;
  sourceMessageId?: string;
  structured?: StewardStructuredResponse;
  replyContent?: string;
  guideTemplate: ReportGuideTemplateId;
  layoutHint: ReportLayoutHint;
  appliedFilters: string[];
  revisions: ReportArtifactRevision[];
  activeRevisionId?: string;
  guideTemplates: ReportGuideTemplate[];
  htmlArtifact?: string;
  htmlGeneratedAt?: string;
  htmlSourceKey?: string;
}

interface StewardTemplateModalState {
  sourceMessageId: string;
  draft: StewardTemplateDraft;
  donorCandidates: MentionedDonor[];
}

// ─── Main component ───────────────────────────────────────────────────────────

/** AGENTStewardWorkspace renders the dark Steward AI chat workspace and dock content. */
export default function AGENTStewardWorkspace({ initialModule = "donor", dockMode = false, onCloseDock, externalPrompt, onExternalPromptConsumed, initialThreadId }: AGENTStewardWorkspaceProps) {
  // --- State ---
  const [threads, setThreads]           = useState<ChatThread[]>([]);
  const [activeId, setActiveId]         = useState<string | null>(null);
  const [hydrated, setHydrated]         = useState(false);
  const [messages, setMessages]         = useState<UiMessage[]>([]);
  const [draft, setDraft]               = useState("");
  const [mode, setMode]                 = useState<ChatMode>("ask");
  const [renderMode, setRenderMode]     = useState<RenderMode>("markdown");
  const [scope, setScope]               = useState<ModuleKey>(initialModule);
  const [scopeOpen, setScopeOpen]       = useState(false);       // composer Scope button
  const [addOpen, setAddOpen]           = useState(false);
  const [toolsOpen, setToolsOpen]       = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false); // hidden by default (mobile-first; JS reopens on large screens)
  const [sending, setSending]           = useState(false);
  const [aiConfig, setAiConfig]         = useState<AiConfigPayload | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [queuedContinuationPrompt, setQueuedContinuationPrompt] = useState<string | null>(null);
  const [modelUsed, setModelUsed]       = useState<string | null>(null);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  const [availableTools, setAvailableTools] = useState<StewardToolOption[]>([]);
  const [toolPickerQuery, setToolPickerQuery] = useState<string | null>(null);
  const [forcedTools, setForcedTools] = useState<string[]>([]);
  const [notePadOpen, setNotePadOpen] = useState(false);
  const [notesByThread, setNotesByThread] = useState<Record<string, WorkspaceNoteState>>({});
  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = picker closed
  const [lockedDonors, setLockedDonors] = useState<MentionedDonor[]>([]); // donors pinned to this chat
  const [reportingYearMode, setReportingYearMode] = useState<"fiscal" | "calendar">("calendar");
  const [fiscalYearStart, setFiscalYearStart]     = useState<number>(1);
  const [thoughtStackEnabled, setThoughtStackEnabled] = useState(true);
  const [thoughtStackHydrated, setThoughtStackHydrated] = useState(false);
  // iOS visual viewport height — tracks keyboard-open shrinkage on Safari
  const [viewportH, setViewportH] = useState<number | null>(null);
  const [emailWorkspace, setEmailWorkspace] = useState<StewardEmailWorkspaceState | null>(null);
  const [letterWorkspace, setLetterWorkspace] = useState<StewardLetterWorkspaceState | null>(null);
  const [reportWorkspace, setReportWorkspace] = useState<StewardReportWorkspaceState | null>(null);
  const [reportArtifactBuilding, setReportArtifactBuilding] = useState(false);
  const [reportArtifactError, setReportArtifactError] = useState<string | null>(null);
  const [reportGuideTemplate, setReportGuideTemplate] = useState<ReportGuideTemplateId>("board_pack");
  const [templateModal, setTemplateModal] = useState<StewardTemplateModalState | null>(null);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [templateSaveError, setTemplateSaveError] = useState<string | null>(null);
  const [reportQuestion, setReportQuestion] = useState("");
  const [memoryPreferences, setMemoryPreferences] = useState<MemoryPreferencesPayload | null>(null);
  const [memorySaving, setMemorySaving] = useState(false);
  const [memoryError, setMemoryError] = useState<string | null>(null);

  const bottomRef     = useRef<HTMLDivElement | null>(null);
  const textareaRef   = useRef<HTMLTextAreaElement | null>(null);
  const composerRef   = useRef<HTMLDivElement | null>(null); // anchor for mention picker
  const streamAbort   = useRef<AbortController | null>(null);
  const scopeRef      = useRef<HTMLDivElement | null>(null);
  const fileInputRef  = useRef<HTMLInputElement | null>(null);

  // --- Derived ---
  const activeThread = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);
  const scopeLabel   = SCOPE_OPTIONS.find((s) => s.key === scope)?.label ?? "Donor CRM";
  const prompts      = STARTER_PROMPTS[scope];
  const workspaceHref = useMemo(() => {
    const params = new URLSearchParams({ module: scope });
    if (activeId) {
      params.set("thread", activeId);
    }
    return `/steward-ai-workspace?${params.toString()}`;
  }, [scope, activeId]);

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!q) return sorted;
    return sorted.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, searchQuery]);

  const readableAllowedTools = useMemo(
    () => availableTools.filter((tool) => tool.allowed && tool.kind === "read"),
    [availableTools],
  );

  const filteredToolOptions = useMemo(() => {
    if (toolPickerQuery === null) return [] as StewardToolOption[];
    const q = toolPickerQuery.trim();
    if (!q) return readableAllowedTools.slice(0, 12);
    return readableAllowedTools
      .map((tool) => ({ tool, score: scoreToolMatch(tool, q) }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score || a.tool.name.localeCompare(b.tool.name))
      .map((entry) => entry.tool)
      .slice(0, 10);
  }, [toolPickerQuery, readableAllowedTools]);

  const slashToolHints = useMemo(() => {
    const namespaces = new Set<string>();
    for (const tool of readableAllowedTools) {
      const ns = tool.name.split(".")[0]?.trim();
      if (ns) namespaces.add(ns);
      if (namespaces.size >= 4) break;
    }
    const list = [...namespaces];
    return list.length > 0 ? list.map((item) => `/${item}`).join(" or ") : "/donor";
  }, [readableAllowedTools]);

  const knownToolNames = useMemo(() => new Set(availableTools.map((tool) => tool.name)), [availableTools]);
  const canSend = draft.trim().length > 0 || forcedTools.length > 0;
  const activeThreadNote = useMemo<WorkspaceNoteState>(() => {
    const fallback: WorkspaceNoteState = { text: "", version: 1, sourceOfTruth: true };
    if (!activeId) return fallback;
    return notesByThread[activeId] ?? fallback;
  }, [activeId, notesByThread]);

  // --- Hydration ---
  useEffect(() => {
    const stored = readThreads();
    const list   = stored.length > 0 ? stored : [newThread(scope, 1)];
    const preferredId = initialThreadId || readStoredActiveThreadId();
    const first = preferredId
      ? (list.find((thread) => thread.id === preferredId) ?? list[0])
      : list[0];
    setThreads(list);
    setActiveId(first.id);
    setMessages(first.messages);
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialThreadId]);

  // --- Persist on change ---
  useEffect(() => {
    if (!hydrated) return;
    writeThreads(threads);
  }, [threads, hydrated]);

  useEffect(() => {
    if (!hydrated || typeof window === "undefined") return;
    window.localStorage.setItem("steward.workspace.notes.v1", JSON.stringify(notesByThread));
  }, [hydrated, notesByThread]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("steward.workspace.notes.v1");
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, WorkspaceNoteState>;
      if (parsed && typeof parsed === "object") {
        setNotesByThread(parsed);
      }
    } catch {
      // ignore malformed local workspace notes snapshot
    }
  }, []);

  const updateActiveThreadNote = useCallback((updater: (prev: WorkspaceNoteState) => WorkspaceNoteState) => {
    if (!activeId) return;
    setNotesByThread((prev) => {
      const current = prev[activeId] ?? { text: "", version: 1, sourceOfTruth: true };
      return {
        ...prev,
        [activeId]: updater(current),
      };
    });
  }, [activeId]);

  const replaceWorkspaceNotes = useCallback((value: string) => {
    updateActiveThreadNote((prev) => ({
      ...prev,
      text: value.trim(),
      version: prev.version + 1,
    }));
    setNotePadOpen(true);
  }, [updateActiveThreadNote]);

  const appendWorkspaceNotes = useCallback((value: string) => {
    updateActiveThreadNote((prev) => ({
      ...prev,
      text: prev.text.trim() ? `${prev.text.trim()}\n${value.trim()}` : value.trim(),
      version: prev.version + 1,
    }));
    setNotePadOpen(true);
  }, [updateActiveThreadNote]);

  const prependWorkspaceNotes = useCallback((value: string) => {
    updateActiveThreadNote((prev) => ({
      ...prev,
      text: prev.text.trim() ? `${value.trim()}\n${prev.text.trim()}` : value.trim(),
      version: prev.version + 1,
    }));
    setNotePadOpen(true);
  }, [updateActiveThreadNote]);

  const clearWorkspaceNotes = useCallback(() => {
    updateActiveThreadNote((prev) => ({
      ...prev,
      text: "",
      version: prev.version + 1,
    }));
  }, [updateActiveThreadNote]);

  const setWorkspaceNoteText = useCallback((value: string) => {
    updateActiveThreadNote((prev) => ({
      ...prev,
      text: value,
    }));
  }, [updateActiveThreadNote]);

  const bumpWorkspaceNoteVersion = useCallback(() => {
    updateActiveThreadNote((prev) => ({
      ...prev,
      version: prev.version + 1,
    }));
  }, [updateActiveThreadNote]);

  const setWorkspaceNoteSourceOfTruth = useCallback((value: boolean) => {
    updateActiveThreadNote((prev) => ({
      ...prev,
      sourceOfTruth: value,
      version: prev.version + 1,
    }));
  }, [updateActiveThreadNote]);

  useEffect(() => {
    if (!hydrated) return;
    writeStoredActiveThreadId(activeId);
  }, [activeId, hydrated]);

  // --- Sync active thread title when messages change ---
  useEffect(() => {
    if (!hydrated || !activeId) return;
    const title  = inferTitle(messages, activeThread?.title ?? "New chat");
    const sliced = messages.slice(-MSG_LIMIT);
    setThreads((prev) => {
      let changed = false;
      const next = prev.map((t) => {
        if (t.id !== activeId) return t;

        const sameTitle = t.title === title;
        const sameMessages = JSON.stringify(t.messages) === JSON.stringify(sliced);
        if (sameTitle && sameMessages) {
          return t;
        }

        changed = true;
        return { ...t, title, updatedAt: new Date().toISOString(), messages: sliced };
      });

      return changed ? next : prev;
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeId, hydrated, sending]);

  // --- Auto-scroll ---
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // Sidebar intentionally stays collapsed by default across viewport sizes.

  // --- iOS visual viewport listener: keeps layout above keyboard on Safari ---
  useEffect(() => {
    if (dockMode || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setViewportH(vv.height);
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [dockMode]);

  // --- Dismiss composer dropdowns on outside click ---
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      if (!target.closest("[data-composer-dropdown]")) {
        setAddOpen(false);
        setScopeOpen(false);
        setToolsOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // --- Load AI config ---
  useEffect(() => {
    let active = true;
    apiFetch<AiConfigPayload>("/api/steward-ai/config")
      .then((cfg) => {
        if (!active) return;
        setAiConfig((current) => {
          if (
            current
            && current.enabled === cfg.enabled
            && current.mode === cfg.mode
            && current.endpointUrl === cfg.endpointUrl
            && current.model === cfg.model
            && current.chatHeadEnabled === cfg.chatHeadEnabled
          ) {
            return current;
          }
          return cfg;
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<{ data: MemoryPreferencesPayload }>("/api/steward-ai/memory/preferences")
      .then((payload) => {
        if (!active) return;
        setMemoryPreferences(payload.data);
      })
      .catch(() => {
        if (!active) return;
        setMemoryError("Could not load memory settings.");
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    const moduleKey = scope === "all" ? "donor" : "donor";
    apiFetch<StewardToolsListPayload>(`/api/steward-ai/tools?moduleKey=${encodeURIComponent(moduleKey)}&scopePath=${encodeURIComponent("/steward-ai-workspace")}`)
      .then((payload) => {
        if (!active) return;
        const list = Array.isArray(payload.data?.tools) ? payload.data.tools : [];
        setAvailableTools(list);
      })
      .catch(() => {
        if (!active) return;
        setAvailableTools([]);
      });
    return () => {
      active = false;
    };
  }, [scope]);

  const updateMemoryPreferences = useCallback(async (patch: Partial<MemoryPreferencesPayload>) => {
    if (!memoryPreferences || memorySaving) return;
    setMemorySaving(true);
    setMemoryError(null);
    const optimistic = {
      memoryEnabled: patch.memoryEnabled ?? memoryPreferences.memoryEnabled,
      fileContextEnabled: patch.fileContextEnabled ?? memoryPreferences.fileContextEnabled,
    };
    setMemoryPreferences((current) => current ? { ...current, ...optimistic } : current);

    try {
      const payload = await apiFetch<{ data: MemoryPreferencesPayload }>("/api/steward-ai/memory/preferences", {
        method: "PUT",
        body: JSON.stringify(optimistic),
      });
      setMemoryPreferences(payload.data);
    } catch (err) {
      setMemoryError(err instanceof Error ? err.message : "Unable to update memory settings.");
      setMemoryPreferences(memoryPreferences);
    } finally {
      setMemorySaving(false);
    }
  }, [memoryPreferences, memorySaving]);

  // --- Load fiscal year settings for FY mode toggle ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(RENDER_MODE_STORAGE_KEY);
    if (stored === "html" || stored === "markdown") {
      setRenderMode(stored);
    }
  }, []);

  const changeRenderMode = useCallback((next: RenderMode) => {
    setRenderMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RENDER_MODE_STORAGE_KEY, next);
    }
  }, []);

  // Keep ThoughtStack beta toggle scoped to the current browser session.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.sessionStorage.getItem(THOUGHTSTACK_SESSION_STORAGE_KEY);
    if (stored === "true" || stored === "false") {
      setThoughtStackEnabled(stored === "true");
    }
    setThoughtStackHydrated(true);
  }, []);

  useEffect(() => {
    if (!thoughtStackHydrated || typeof window === "undefined") return;
    window.sessionStorage.setItem(
      THOUGHTSTACK_SESSION_STORAGE_KEY,
      thoughtStackEnabled ? "true" : "false",
    );
  }, [thoughtStackEnabled, thoughtStackHydrated]);

  // --- Load fiscal year settings for FY mode toggle ---
  useEffect(() => {
    let active = true;
    apiFetch<{ fiscalYearStart?: number }>("/api/settings")
      .then((data) => { if (active && typeof data.fiscalYearStart === "number") setFiscalYearStart(data.fiscalYearStart); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const toggleReportingYearMode = useCallback(() => {
    setReportingYearMode((v) => (v === "fiscal" ? "calendar" : "fiscal"));
  }, []);

  // --- Auto-grow textarea ---
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  // ─── Thread management ──────────────────────────────────────────────────────

  function startNewChat() {
    if (sending) return;
    const t = newThread(scope, threads.length + 1);
    setThreads((prev) => [t, ...prev].slice(0, THREAD_LIMIT));
    setActiveId(t.id);
    setMessages([]);
    setDraft("");
    setError(null);
    setActionStatus(null);
    setForcedTools([]);
    setToolPickerQuery(null);
  }

  function switchThread(id: string) {
    if (id === activeId) return;
    const t = threads.find((x) => x.id === id);
    if (!t) return;
    setActiveId(t.id);
    setMessages(t.messages);
    setScope(t.moduleKey);
    setDraft("");
    setError(null);
    setActionStatus(null);
    setLockedDonors([]);
    setMentionQuery(null);
    setForcedTools([]);
    setToolPickerQuery(null);
  }

  function deleteThread(id: string) {
    if (typeof window !== "undefined") {
      const approved = window.confirm("Delete this chat thread? This cannot be undone.");
      if (!approved) return;
    }

    if (threads.length <= 1) {
      const replacement = newThread(scope, 1);
      setThreads([replacement]);
      setActiveId(replacement.id);
      setMessages([]);
      return;
    }
    const remaining = threads.filter((t) => t.id !== id);
    setThreads(remaining);
    if (id === activeId) {
      const next = remaining[0];
      if (next) { setActiveId(next.id); setMessages(next.messages); }
    }
  }

  function renameThread(id: string) {
    const existing = threads.find((thread) => thread.id === id);
    if (!existing) return;
    if (typeof window === "undefined") return;

    const nextTitle = window.prompt("Rename chat", existing.title)?.trim();
    if (!nextTitle) return;

    setThreads((prev) => prev.map((thread) => (
      thread.id === id
        ? { ...thread, title: nextTitle.slice(0, 120), updatedAt: new Date().toISOString() }
        : thread
    )));
  }

  function clearChat() {
    if (!activeId) return;
    if (typeof window !== "undefined" && !window.confirm("Clear this conversation?")) return;
    setMessages([]);
    setDraft("");
    setError(null);
    setActionStatus(null);
    setForcedTools([]);
    setToolPickerQuery(null);
  }

  // ─── Scope change ───────────────────────────────────────────────────────────

  function changeScope(key: ModuleKey) {
    setScope(key);
    setScopeOpen(false);
    // Update the active thread's recorded module
    if (activeId) {
      setThreads((prev) =>
        prev.map((t) => t.id === activeId ? { ...t, moduleKey: key } : t)
      );
    }
  }

  // ─── Send message ───────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // If mention picker is open, let DonorMentionPicker handle arrow/enter/escape via its own keydown listener
    if (mentionQuery !== null && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Tab")) {
      e.preventDefault();
      return;
    }
    if (mentionQuery !== null && e.key === "Escape") {
      setMentionQuery(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      if (!sending && canSend) void send();
    }
  }

  /** Called on every textarea change — detect @mention trigger. */
  function handleDraftChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setDraft(val);
    // Find the last "@" before the cursor that hasn't been closed by a space or newline
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const atIdx  = before.lastIndexOf("@");
    if (atIdx >= 0) {
      const fragment = before.slice(atIdx + 1);
      // Fragment must not contain spaces (otherwise it's a completed word, not a mention)
      if (!/\s/.test(fragment)) {
        setMentionQuery(fragment); // empty string = show all recent, typed = filter
        return;
      }
    }
    setMentionQuery(null);

    const slashMatch = before.match(/(?:^|\s)\/([a-zA-Z0-9._-]*)$/);
    if (slashMatch) {
      setToolPickerQuery(slashMatch[1] ?? "");
      return;
    }
    setToolPickerQuery(null);
  }

  function handleForcedToolSelect(toolName: string) {
    const ta = textareaRef.current;
    const cursor = ta?.selectionStart ?? draft.length;
    const before = draft.slice(0, cursor);
    const after = draft.slice(cursor);
    const cleanedBefore = before.replace(/(?:^|\s)\/[a-zA-Z0-9._-]*$/, " ");
    const normalized = `${cleanedBefore}${after}`.replace(/\s{2,}/g, " ").trimStart();

    setDraft(normalized);
    setToolPickerQuery(null);
    setForcedTools((prev) => prev.includes(toolName) ? prev : [...prev, toolName]);
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 20);
  }

  /** Inject a selected donor into the draft and lock them as context. */
  function handleMentionSelect(donor: MentionedDonor) {
    // Replace the "@<fragment>" trigger with plain text spacing and keep donor context as chips.
    const cursor = textareaRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, cursor);
    const atIdx  = before.lastIndexOf("@");
    const after  = draft.slice(cursor);
    const prefix = (atIdx >= 0 ? before.slice(0, atIdx) : before).replace(/\s+$/g, "");
    const suffix = after.replace(/^\s+/g, "");
    const spacer = prefix.length > 0 && suffix.length > 0 ? " " : "";
    const newDraft = `${prefix}${spacer}${suffix}`;
    setDraft(newDraft);
    setMentionQuery(null);
    // Lock this donor into the conversation context (deduplicated)
    setLockedDonors((prev) => prev.find((d) => d.id === donor.id) ? prev : [...prev, donor]);
    // Re-focus and move cursor to the old @ position.
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const pos = atIdx >= 0 ? Math.max(0, atIdx) : Math.max(0, prefix.length);
        ta.setSelectionRange(pos, pos);
      }
    }, 30);
  }

  function stopGeneration() {
    streamAbort.current?.abort();
  }

  /** Reads selected files and appends their name + text content (for text files) into the draft. */
  function handleFileAttach(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const isText = file.type.startsWith("text/") || /\.(csv|txt|md|json)$/i.test(file.name);
      if (isText && file.size < 100_000) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = (ev.target?.result as string ?? "").slice(0, 2000);
          setDraft((d) => {
            const prefix = d ? `${d}\n\n` : "";
            return `${prefix}[File: ${file.name}]\n\`\`\`\n${content}\n\`\`\``;
          });
          setTimeout(() => textareaRef.current?.focus(), 50);
        };
        reader.readAsText(file);
      } else {
        // For binary/large files just attach the name as context
        setDraft((d) => {
          const prefix = d ? `${d}\n` : "";
          return `${prefix}[Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`;
        });
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    });
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const openAnyFilePicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = "*/*";
    input.click();
  }, []);

  const openCsvFilePicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = ".csv,text/csv";
    input.click();
  }, []);

  const focusTextarea = useCallback(() => {
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleAddContextAction = useCallback((key: AddContextActionKey) => {
    setAddOpen(false);

    if (key === "attach_file") {
      openAnyFilePicker();
      return;
    }

    if (key === "upload_csv") {
      openCsvFilePicker();
      return;
    }

    if (key === "add_crm_record" || key === "add_donor_list") {
      setDraft((d) => (d.endsWith(" ") || d === "" ? `${d}@` : `${d} @`));
      setMentionQuery("");
      focusTextarea();
      return;
    }

    if (key === "add_campaign") {
      setDraft((d) => {
        const prefix = d ? `${d}\n` : "";
        return `${prefix}Focus on the campaign: `;
      });
      focusTextarea();
      return;
    }

    if (key === "add_report_context") {
      setDraft((d) => {
        const prefix = d ? `${d}\n` : "";
        return `${prefix}Pull the current KPI summary, YTD giving, and retention rate.`;
      });
      focusTextarea();
    }
  }, [setAddOpen, openAnyFilePicker, openCsvFilePicker, setDraft, setMentionQuery, focusTextarea]);

  const normalizeStructured = useCallback((raw: unknown): StewardStructuredResponse | undefined => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const c = raw as Partial<StewardStructuredResponse>;
    if (c.version !== 1 || typeof c.replyMarkdown !== "string") return undefined;
    if (!Array.isArray(c.artifacts) || !Array.isArray(c.suggestedActions) || !Array.isArray(c.evidence)) return undefined;
    return {
      version: 1,
      replyMarkdown: c.replyMarkdown,
      artifacts: c.artifacts,
      suggestedActions: c.suggestedActions,
      evidence: c.evidence,
      parseWarning: typeof c.parseWarning === "string" ? c.parseWarning : undefined,
    };
  }, []);

  interface SendOpts {
    historyOverride?: UiMessage[];
    appendUser?: boolean;
    targetId?: string;
    truncateAt?: number;
  }

  const send = useCallback(async (content?: string, opts: SendOpts = {}): Promise<boolean> => {
    const shouldUseComposerForcing = typeof content === "undefined";
    const rawText = (content ?? draft).trim();
    const inlineForced = extractInlineForcedTools(rawText, knownToolNames);
    const mergedForcedTools = shouldUseComposerForcing
      ? [...new Set([...forcedTools, ...inlineForced.tools])]
      : inlineForced.tools;
    const text = inlineForced.cleanedText || (mergedForcedTools.length > 0 ? "Run selected tools and summarize the findings." : "");
    if (!text || sending) return false;

    const appendUser = opts.appendUser ?? true;
    const base       = opts.historyOverride ?? messages;
    const userMsg: UiMessage = {
      id: crypto.randomUUID(), role: "user", content: text,
      createdAt: new Date().toISOString(),
    };
    const payload = appendUser ? [...base, userMsg] : base;
    const assistantId = opts.targetId ?? crypto.randomUUID();

    if (appendUser) {
      setMessages([
        ...payload,
        {
          id: assistantId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
          thoughtStackEnabled,
        },
      ]);
    } else {
      setMessages((prev) => {
        const sliced = typeof opts.truncateAt === "number" ? prev.slice(0, opts.truncateAt + 1) : prev;
        return sliced.map((m) =>
          m.id !== assistantId ? m
            : {
                ...m,
                content: "",
                structured: undefined,
                toolsUsed: undefined,
                recordsUsed: undefined,
                progressSteps: [],
                thinkingContent: "",
                activeTools: [],
                progressPercent: undefined,
                progressStage: undefined,
                provider: undefined,
                responseMode: undefined,
                runtimeMode: undefined,
                thoughtStackEnabled,
              }
        );
      });
    }

    setDraft("");
    if (shouldUseComposerForcing) {
      setForcedTools([]);
      setToolPickerQuery(null);
    }
    setSending(true);
    setActiveAssistantId(assistantId);
    setError(null);
    setActionStatus(null);

    try {
      const ac = new AbortController();
      streamAbort.current = ac;

      const resp = await apiFetchResponse("/api/steward-ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          messages: payload.map((m) => ({ role: m.role, content: m.content })),
          mode,
          moduleKey: scope === "all" ? "donor" : scope,
          scopePath: "/steward-ai-workspace",
          reportingYearMode,
          fiscalYear: getFiscalYearForDate(new Date(), fiscalYearStart),
          fiscalYearStart,
          thoughtStackEnabled,
          ...(mergedForcedTools.length > 0 ? { forcedTools: mergedForcedTools } : {}),
          ...(activeThreadNote.text.trim().length > 0
            ? {
                workspaceNotes: {
                  title: "Steward Workspace Notepad",
                  content: activeThreadNote.text,
                  version: activeThreadNote.version,
                  sourceOfTruth: activeThreadNote.sourceOfTruth,
                  liveEditable: true,
                },
              }
            : {}),
          // Inject locked donor context so the AI knows who we're talking about
          ...(lockedDonors.length > 0 && {
            donorContext: lockedDonors.map((d) => ({
              id: d.id,
              name: [d.firstName, d.lastName].filter(Boolean).join(" ") || d.email || "Unknown",
              email: d.email,
              donorStatus: d.donorStatus,
              totalLifetimeGiving: d.totalLifetimeGiving,
              lastGiftDate: d.lastGiftDate,
            })),
          }),
        }),
        signal: ac.signal,
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        try { throw new Error((JSON.parse(txt) as { error?: { message?: string } }).error?.message ?? `Error ${resp.status}`); }
        catch { throw new Error(txt || `Error ${resp.status}`); }
      }
      if (!resp.body) throw new Error("Stream unavailable.");

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf  = "";
      let done: StewardChatStreamDone | null = null;
      let streamed = "";

      while (true) {
        const { value, done: eof } = await reader.read();
        if (eof) break;
        buf += decoder.decode(value, { stream: true });
        let nl = buf.indexOf("\n");
        while (nl >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          nl  = buf.indexOf("\n");
          if (!line) continue;
          const ev = JSON.parse(line) as StewardChatStreamEvent;
          if (ev.type === "chunk") {
            streamed += ev.delta;
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: m.content + ev.delta } : m)
            );
          } else if (ev.type === "progress") {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId
                ? {
                    ...m,
                    progressSteps: [...(m.progressSteps ?? []), ev.message],
                    progressPercent: typeof ev.percent === "number" ? ev.percent : m.progressPercent,
                    progressStage: typeof ev.stage === "string" ? ev.stage : m.progressStage,
                  }
                : m)
            );
          } else if (ev.type === "thinking") {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId
                ? { ...m, thinkingContent: (m.thinkingContent ?? "") + ev.delta }
                : m)
            );
          } else if (ev.type === "tool") {
            const toolEv = ev as StewardChatStreamTool;
            setMessages((prev) =>
              prev.map((m) => {
                if (m.id !== assistantId) return m;
                const existing = m.activeTools ?? [];
                if (toolEv.status === "start") {
                  return { ...m, activeTools: [...existing, { name: toolEv.name, label: toolEv.label, status: "active" as const }] };
                }
                // "done" — mark matching tool as done
                return {
                  ...m,
                  activeTools: existing.map((t) =>
                    t.name === toolEv.name && t.status === "active" ? { ...t, status: "done" as const } : t
                  ),
                };
              })
            );
          } else if (ev.type === "done") { done = ev; break; }
          else if (ev.type === "error") throw new Error(ev.message || "Stream error");
        }
        if (done) break;
      }

      if (!done && buf.trim()) {
        const ev = JSON.parse(buf.trim()) as StewardChatStreamEvent;
        if (ev.type === "done") done = ev;
        else if (ev.type === "chunk") {
          streamed += ev.delta;
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + ev.delta } : m)
          );
        }
      }
      if (!done) throw new Error("Stream ended unexpectedly.");

      setModelUsed(done.model);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          const finalReply = done!.reply?.length ? done!.reply : streamed;
          const finalizedTools = (m.activeTools ?? []).map((tool) => ({ ...tool, status: "done" as const }));
          return {
            ...m, content: finalReply,
            structured:   done!.structured ? normalizeStructured(done!.structured) : undefined,
            toolsUsed:    done!.toolsUsed,
            recordsUsed:  done!.recordsUsed,
            provider:     done!.provider,
            responseMode: done!.mode,
            moduleKey:    done!.moduleKey,
            runtimeMode:  done!.runtimeMode ?? "unknown",
            activeTools: finalizedTools,
          };
        })
      );
      return true;
    } catch (err) {
      setMessages((prev) =>
        prev.filter((m) => m.id !== assistantId || m.content.trim().length > 0)
      );
      const isAbort = err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message));
      if (!isAbort) setError(err instanceof Error ? err.message : "Request failed.");
      return false;
    } finally {
      streamAbort.current = null;
      setSending(false);
      setActiveAssistantId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, messages, mode, scope, sending, reportingYearMode, fiscalYearStart, thoughtStackEnabled, lockedDonors, forcedTools, knownToolNames, canSend]);

  // Queue GuidePath/ThoughtStack continuation clicks while a stream is still finishing.
  useEffect(() => {
    if (sending || !queuedContinuationPrompt) return;
    const prompt = queuedContinuationPrompt;
    setQueuedContinuationPrompt(null);
    void send(prompt).then((sent) => {
      if (!sent) {
        setActionStatus({ tone: "error", message: "Unable to continue from the selected option. Please try again." });
      }
    });
  }, [queuedContinuationPrompt, sending, send]);

  // ─── Regenerate ────────────────────────────────────────────────────────────
  function regenerate(assistantMsgId: string) {
    if (sending) return;
    const aIdx = messages.findIndex((m) => m.id === assistantMsgId && m.role === "assistant");
    if (aIdx < 0) return;
    let uIdx = aIdx - 1;
    while (uIdx >= 0 && messages[uIdx].role !== "user") uIdx--;
    if (uIdx < 0) return;
    void send(messages[uIdx].content, {
      historyOverride: messages.slice(0, aIdx),
      appendUser: false,
      targetId: assistantMsgId,
      truncateAt: aIdx,
    });
  }

  // ─── Copy message ──────────────────────────────────────────────────────────
  async function copyMessage(content: string) {
    try { await navigator.clipboard.writeText(content); } catch { /* ignore */ }
  }

  /** Opens supported editor routes inside Steward so users can build/preview/edit without leaving chat. */
  function openWorkspaceFromPath(path: string): boolean {
    const [pathname, query = ""] = path.split("?");
    const params = new URLSearchParams(query);

    if (pathname === "/email-builder") {
      const campaignId = params.get("campaign")?.trim();
      if (!campaignId) return false;
      setEmailWorkspace({
        campaignId,
        returnTo: params.get("returnTo") ?? undefined,
      });
      return true;
    }

    const oyamaEmailBuilderMatch = pathname.match(/^\/oyama-email\/templates\/([^/]+)\/builder$/);
    if (oyamaEmailBuilderMatch?.[1]) {
      setEmailWorkspace({
        campaignId: decodeURIComponent(oyamaEmailBuilderMatch[1]),
        returnTo: params.get("returnTo") ?? undefined,
      });
      return true;
    }

    const letterMatch = pathname.match(/^\/oyama-letters\/templates\/([^/]+)$/);
    if (letterMatch?.[1] && params.get("embedded") === "1") {
      const panelRaw = params.get("panel");
      const initialPanel = panelRaw === "preview" || panelRaw === "publish" ? panelRaw : "document";
      setLetterWorkspace({
        templateId: decodeURIComponent(letterMatch[1]),
        initialPanel,
      });
      return true;
    }

    if (pathname.startsWith("/reports")) {
      const latestReportMessage = [...messages].reverse().find((m) => (
        m.role === "assistant"
        && Boolean(m.structured?.artifacts?.some((artifact) => artifact.type === "report_card"))
      ));
      const initialRevision = createReportRevision({
        version: 1,
        label: "Baseline",
        prompt: "Initial report artifact",
        guideTemplate: reportGuideTemplate,
        layoutHint: "balanced",
        appliedFilters: [],
        structured: latestReportMessage?.structured,
        replyContent: latestReportMessage?.content,
      });

      setReportWorkspace({
        path,
        title: "View Full Report",
        sourceMessageId: latestReportMessage?.id,
        structured: latestReportMessage?.structured,
        replyContent: latestReportMessage?.content,
        guideTemplate: reportGuideTemplate,
        layoutHint: "balanced",
        appliedFilters: [],
        revisions: [initialRevision],
        activeRevisionId: initialRevision.id,
        guideTemplates: DEFAULT_REPORT_GUIDE_TEMPLATES,
      });
      return true;
    }

    return false;
  }

  function openReportWorkspaceFromMessage(messageId: string, path: string, title = "View Full Report") {
    const source = messages.find((m) => m.id === messageId && m.role === "assistant");
    const initialRevision = createReportRevision({
      version: 1,
      label: "Baseline",
      prompt: "Initial report artifact",
      guideTemplate: reportGuideTemplate,
      layoutHint: "balanced",
      appliedFilters: [],
      structured: source?.structured,
      replyContent: source?.content,
    });
    setReportWorkspace({
      path,
      title,
      sourceMessageId: messageId,
      structured: source?.structured,
      replyContent: source?.content,
      guideTemplate: reportGuideTemplate,
      layoutHint: "balanced",
      appliedFilters: [],
      revisions: [initialRevision],
      activeRevisionId: initialRevision.id,
      guideTemplates: DEFAULT_REPORT_GUIDE_TEMPLATES,
      htmlArtifact: undefined,
      htmlGeneratedAt: undefined,
      htmlSourceKey: undefined,
    });
    setReportArtifactError(null);
  }

  // ─── Run suggested action ──────────────────────────────────────────────────
  async function runAction(messageId: string, actionIndex: number) {
    const src = messages.find((m) => m.id === messageId && m.role === "assistant");
    if (!src?.structured) return;
    const action = src.structured.suggestedActions[actionIndex];
    if (!action) return;

    if (action.actionType === "open_report") {
      const payload = action.payload as Record<string, unknown> | undefined;
      const path = typeof payload?.path === "string"
        ? payload.path
        : typeof payload?.reportPath === "string"
          ? payload.reportPath
          : "/reports?tab=overview&module=donor";
      openReportWorkspaceFromMessage(messageId, path, action.label || "View Full Report");
      setActionStatus({ tone: "success", message: "Opened in-chat report workspace." });
      return;
    }

    if (action.actionType === "guidepath.choose") {
      const payload = action.payload as Record<string, unknown> | undefined;
      const prompt = typeof payload?.prompt === "string" && payload.prompt.trim().length > 0
        ? payload.prompt.trim()
        : action.label;

      if (sending) {
        setQueuedContinuationPrompt(prompt);
        setActionStatus({ tone: "success", message: "GuidePath selection saved. Continuing as soon as the current response finishes." });
        return;
      }

      const sent = await send(prompt);
      if (!sent) {
        setQueuedContinuationPrompt(prompt);
        setActionStatus({ tone: "success", message: "GuidePath selection queued. Continuing shortly." });
        return;
      }
      setActionStatus({ tone: "success", message: "GuidePath selection applied. Continuing with your request." });
      return;
    }

    if (action.actionType.startsWith("thoughtstack.")) {
      const payload = action.payload as Record<string, unknown> | undefined;
      const prompt = typeof payload?.prompt === "string" && payload.prompt.trim().length > 0
        ? payload.prompt.trim()
        : action.label;

      if (sending) {
        setQueuedContinuationPrompt(prompt);
        setActionStatus({ tone: "success", message: "ThoughtStack selection saved. Continuing as soon as the current response finishes." });
        return;
      }

      const sent = await send(prompt);
      if (!sent) {
        setQueuedContinuationPrompt(prompt);
        setActionStatus({ tone: "success", message: "ThoughtStack selection queued. Continuing shortly." });
        return;
      }

      const thoughtStackMessage = action.actionType === "thoughtstack.review_first"
        ? "ThoughtStack set this request to review-first. Generating a dry-run style preview."
        : action.actionType === "thoughtstack.cancel"
          ? "ThoughtStack canceled this request."
          : action.actionType === "thoughtstack.provide_details"
            ? "ThoughtStack is waiting for your details."
            : "ThoughtStack confirmation applied. Continuing execution flow.";

      setActionStatus({ tone: "success", message: thoughtStackMessage });
      return;
    }

    try {
      const res = await executeStewardSuggestedAction({
        action,
        structured: src.structured,
        replyContent: src.content,
        confirm: (msg) => typeof window !== "undefined" ? window.confirm(msg) : false,
        callApi: async (path, init) => { await apiFetch(path, { method: init?.method, body: init?.body, headers: { "Content-Type": "application/json" } }); },
        navigate: (path) => {
          if (path.startsWith("/oyama-letters/templates/")) {
            const fullPath = path.includes("?") ? `${path}&fullscreen=1` : `${path}?fullscreen=1`;
            if (typeof window !== "undefined") window.location.href = fullPath;
            return;
          }
          const openedInWorkspace = openWorkspaceFromPath(path);
          if (!openedInWorkspace && typeof window !== "undefined") window.location.href = path;
        },
        copyText: async (val) => { await navigator.clipboard.writeText(val); },
        replaceWorkspaceNotes,
        appendWorkspaceNotes,
        prependWorkspaceNotes,
        clearWorkspaceNotes,
      });
      setActionStatus({ tone: res.status === "executed" ? "success" : "error", message: res.message });
    } catch (e) {
      setActionStatus({ tone: "error", message: e instanceof Error ? e.message : "Action failed." });
    }
  }

  function openSaveTemplateModal(messageId: string) {
    const source = messages.find((m) => m.id === messageId && m.role === "assistant");
    if (!source) return;

    const extracted = extractTemplateDraftFromMessage(source);
    if (!extracted) {
      setActionStatus({ tone: "error", message: "This response is not in email draft format yet. Ask Steward to draft an email first." });
      return;
    }

    setTemplateSaveError(null);
    setTemplateModal({
      sourceMessageId: messageId,
      draft: extracted,
      donorCandidates: lockedDonors.slice(0, 20),
    });
  }

  async function saveTemplateFromModal() {
    if (!templateModal) return;
    setTemplateSaving(true);
    setTemplateSaveError(null);

    const cleanedDraft: StewardTemplateDraft = {
      name: templateModal.draft.name.trim() || "Steward Draft Template",
      subject: normalizeEmailTemplateMergeFields(templateModal.draft.subject.trim()),
      previewText: normalizeEmailTemplateMergeFields(templateModal.draft.previewText.trim()),
      bodyText: normalizeEmailTemplateMergeFields(templateModal.draft.bodyText.trim()),
    };

    try {
      const created = await apiFetch<{ id: string }>("/api/email-campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: cleanedDraft.name,
          subject: cleanedDraft.subject,
          previewText: cleanedDraft.previewText,
          bodyText: cleanedDraft.bodyText,
          bodyHtml: emailTextToHtml(cleanedDraft.bodyText),
        }),
      });

      setTemplateModal(null);
      setActionStatus({ tone: "success", message: "Template saved. Opening Steward Email Workspace editor." });
      setEmailWorkspace({
        campaignId: created.id,
        returnTo: workspaceHref,
      });
    } catch (e) {
      setTemplateSaveError(e instanceof Error ? e.message : "Failed to save template.");
    } finally {
      setTemplateSaving(false);
    }
  }

  async function saveDraftLetterFromMessage(messageId: string) {
    const source = messages.find((m) => m.id === messageId && m.role === "assistant");
    if (!source) return;

    const draft = buildLetterDraftFromMessage(source);
    if (!draft) {
      setActionStatus({ tone: "error", message: "This response does not contain draftable letter content yet." });
      return;
    }

    try {
      const created = await apiFetch<{ id?: string }>("/api/letters/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          category: "GENERAL",
          status: "DRAFT",
          printSubject: draft.printSubject,
          printBody: draft.printBody,
          emailSubject: draft.emailSubject ?? null,
          emailBody: draft.emailBody ?? null,
          crmScope: "DONOR",
        }),
      });

      if (!created?.id) {
        setActionStatus({ tone: "error", message: "Letter template was created without an id." });
        return;
      }

      if (typeof window !== "undefined") {
        window.location.assign(`/oyama-letters/templates/${encodeURIComponent(created.id)}?fullscreen=1`);
      }
      setActionStatus({ tone: "success", message: "Draft letter saved and opened in Letters workspace." });
    } catch (e) {
      setActionStatus({ tone: "error", message: e instanceof Error ? e.message : "Failed to save draft letter." });
    }
  }

  const reportCardArtifact = useMemo<StewardReportCardArtifact | null>(() => {
    if (!reportWorkspace?.structured?.artifacts) return null;
    return (reportWorkspace.structured.artifacts.find((artifact) => artifact.type === "report_card") as StewardReportCardArtifact | undefined) ?? null;
  }, [reportWorkspace]);

  const reportCharts = useMemo<StewardChartArtifact[]>(() => {
    if (!reportWorkspace?.structured?.artifacts) return [];
    return reportWorkspace.structured.artifacts.filter((artifact) => artifact.type === "chart") as StewardChartArtifact[];
  }, [reportWorkspace]);

  const reportMetricBars = useMemo(() => {
    const metrics = reportCardArtifact?.metrics ?? [];
    const numeric = metrics
      .map((metric) => ({ metric, numericValue: parseMetricNumeric(metric.value) }))
      .filter((item) => typeof item.numericValue === "number") as Array<{
        metric: StewardReportCardArtifact["metrics"][number];
        numericValue: number;
      }>;

    if (numeric.length === 0) return [] as Array<{ label: string; value: string; width: number; normalized: number }>;

    const maxValue = Math.max(...numeric.map((item) => item.numericValue), 1);
    return numeric
      .sort((a, b) => b.numericValue - a.numericValue)
      .slice(0, 6)
      .map((item) => {
        const normalized = item.numericValue / maxValue;
        return {
          label: item.metric.label,
          value: item.metric.value,
          normalized,
          width: Math.max(6, Math.round(normalized * 100)),
        };
      });
  }, [reportCardArtifact]);

  const reportInsights = useMemo(() => {
    const insights: string[] = [];
    const metrics = reportCardArtifact?.metrics ?? [];
    const numericMetrics = metrics
      .map((metric) => ({ label: metric.label, value: parseMetricNumeric(metric.value), raw: metric.value }))
      .filter((item) => typeof item.value === "number") as Array<{ label: string; value: number; raw: string }>;

    if (numericMetrics.length > 1) {
      const strongest = [...numericMetrics].sort((a, b) => b.value - a.value)[0];
      const weakest = [...numericMetrics].sort((a, b) => a.value - b.value)[0];
      insights.push(`${strongest.label} is currently the strongest signal at ${strongest.raw}.`);
      insights.push(`${weakest.label} is the weakest tracked metric at ${weakest.raw}; review root causes and remediation.`);
    }

    const trendUp = metrics.filter((metric) => metric.trend === "up").length;
    const trendDown = metrics.filter((metric) => metric.trend === "down").length;
    if (trendUp || trendDown) {
      insights.push(`Trend mix: ${trendUp} improving metrics and ${trendDown} declining metrics in this snapshot.`);
    }

    const chart = reportCharts[0];
    const firstSeries = chart?.series?.[0];
    if (chart && firstSeries && firstSeries.data.length > 1) {
      const seriesMax = Math.max(...firstSeries.data);
      const seriesMin = Math.min(...firstSeries.data);
      const spread = seriesMax - seriesMin;
      const spreadPct = seriesMin > 0 ? Math.round((spread / seriesMin) * 100) : null;
      insights.push(
        spreadPct !== null
          ? `${firstSeries.name} variance is ${formatCompact(spread)} (${spreadPct}% spread across reported periods).`
          : `${firstSeries.name} variance is ${formatCompact(spread)} across reported periods.`
      );
    }

    if (reportWorkspace?.structured?.evidence?.length) {
      insights.push(`Evidence pack includes ${reportWorkspace.structured.evidence.length} supporting highlights.`);
    }

    return insights.slice(0, 6);
  }, [reportCardArtifact, reportCharts, reportWorkspace]);

  const printReportWorkspace = useCallback(() => {
    if (!reportWorkspace) return;

    const metrics = reportCardArtifact?.metrics ?? [];
    const evidence = reportWorkspace.structured?.evidence ?? [];
    const printHtml = buildReportPrintHtml({
      title: reportCardArtifact?.title || reportWorkspace.title,
      fiscalYearLabel: reportCardArtifact?.fiscalYearLabel,
      route: reportWorkspace.path,
      metrics,
      evidence,
      insights: reportInsights,
    });

    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=1024,height=768");
    if (!printWindow) {
      setActionStatus({ tone: "error", message: "Unable to open print preview. Please allow pop-ups and try again." });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }, [reportWorkspace, reportCardArtifact, reportInsights]);

  const askStewardFromReport = useCallback(async () => {
    if (!reportWorkspace) return;
    const prompt = reportQuestion.trim();
    if (!prompt || reportArtifactBuilding) return;

    setReportArtifactBuilding(true);
    setReportArtifactError(null);

    try {
      const response = await apiFetch<StewardReportRefineResponsePayload>("/api/steward-ai/report-artifact/refine", {
        method: "POST",
        body: JSON.stringify({
          path: reportWorkspace.path,
          title: reportWorkspace.title,
          prompt,
          guideTemplate: reportGuideTemplate,
          layoutHint: reportWorkspace.layoutHint,
          filters: reportWorkspace.appliedFilters,
          structured: reportWorkspace.structured,
          replyContent: reportWorkspace.replyContent,
        }),
      });

      setReportWorkspace((prev) => {
        if (!prev) return prev;
        const nextVersion = prev.revisions.length + 1;
        const revision = createReportRevision({
          version: nextVersion,
          label: response.data.revisionLabel,
          prompt,
          guideTemplate: response.data.guideTemplate,
          layoutHint: response.data.layoutHint,
          appliedFilters: response.data.appliedFilters,
          structured: response.data.structured,
          replyContent: response.data.reply,
        });
        return {
          ...prev,
          structured: response.data.structured,
          replyContent: response.data.reply,
          guideTemplate: response.data.guideTemplate,
          layoutHint: response.data.layoutHint,
          appliedFilters: response.data.appliedFilters,
          guideTemplates: response.data.guideTemplates?.length > 0 ? response.data.guideTemplates : prev.guideTemplates,
          revisions: [...prev.revisions, revision],
          activeRevisionId: revision.id,
          htmlArtifact: undefined,
          htmlGeneratedAt: undefined,
          htmlSourceKey: undefined,
        };
      });
      setReportGuideTemplate(response.data.guideTemplate);
      setReportQuestion("");
      setActionStatus({ tone: "success", message: "Report artifact refined and revision saved." });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to refresh report artifact.";
      setReportArtifactError(message);
      setActionStatus({ tone: "error", message });
    } finally {
      setReportArtifactBuilding(false);
    }
  }, [
    reportWorkspace,
    reportQuestion,
    reportArtifactBuilding,
    reportGuideTemplate,
  ]);

  const rollbackReportRevision = useCallback((revisionId: string) => {
    setReportWorkspace((prev) => {
      if (!prev) return prev;
      const revision = prev.revisions.find((item) => item.id === revisionId);
      if (!revision) return prev;
      return {
        ...prev,
        structured: revision.structured,
        replyContent: revision.replyContent,
        guideTemplate: revision.guideTemplate,
        layoutHint: revision.layoutHint,
        appliedFilters: revision.appliedFilters,
        activeRevisionId: revision.id,
        htmlArtifact: undefined,
        htmlGeneratedAt: undefined,
        htmlSourceKey: undefined,
      };
    });
    setReportGuideTemplate((prev) => {
      const workspace = reportWorkspace;
      const revision = workspace?.revisions.find((item) => item.id === revisionId);
      return revision?.guideTemplate ?? prev;
    });
    setActionStatus({ tone: "success", message: "Report revision restored." });
  }, [reportWorkspace]);

  useEffect(() => {
    if (!reportWorkspace) return;
    const metrics = reportCardArtifact?.metrics ?? [];
    const evidence = reportWorkspace.structured?.evidence ?? [];
    const hasContent = metrics.length > 0 || evidence.length > 0 || reportInsights.length > 0 || Boolean(reportWorkspace.replyContent?.trim());
    if (!hasContent) return;

    const sourceKey = JSON.stringify({
      path: reportWorkspace.path,
      title: reportCardArtifact?.title || reportWorkspace.title,
      fy: reportCardArtifact?.fiscalYearLabel || "",
      metrics,
      evidence,
      insights: reportInsights,
      reply: reportWorkspace.replyContent || "",
    });
    if (reportWorkspace.htmlSourceKey === sourceKey && reportWorkspace.htmlArtifact) {
      return;
    }

    setReportArtifactBuilding(true);
    const timer = window.setTimeout(() => {
      const stamp = new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date());

      const htmlArtifact = buildInteractiveReportHtml({
        title: reportCardArtifact?.title || reportWorkspace.title,
        fiscalYearLabel: reportCardArtifact?.fiscalYearLabel,
        route: reportWorkspace.path,
        generatedAt: stamp,
        metrics,
        evidence,
        insights: reportInsights,
        reply: reportWorkspace.replyContent,
      });

      setReportWorkspace((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          htmlArtifact,
          htmlGeneratedAt: stamp,
          htmlSourceKey: sourceKey,
        };
      });
      setReportArtifactBuilding(false);
    }, 120);

    return () => {
      window.clearTimeout(timer);
    };
  }, [reportWorkspace, reportCardArtifact, reportInsights]);

  // ─── External prompt (from StewardContextButton) ────────────────────────────
  // When a contextual button outside the dock fires a prompt, start a fresh chat
  // and auto-send the message so the user immediately sees a response.
  const externalPromptRef = useRef<typeof externalPrompt>(null);
  useEffect(() => {
    if (!externalPrompt?.prompt) return;
    if (externalPromptRef.current === externalPrompt) return; // already consumed
    externalPromptRef.current = externalPrompt;

    // Don't fire while a response is already streaming
    if (sending) return;

    // Start a new thread so the context is clean
    startNewChat();

    // Small delay to allow the new thread state to flush before sending
    const timer = setTimeout(() => {
      void send(externalPrompt.prompt);
      onExternalPromptConsumed?.();
    }, 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const isEmptyChat = messages.length === 0;

  return (
    <div
      className={`steward-ai-light flex ${dockMode ? "h-full" : "h-[100dvh]"} min-h-0 overflow-hidden bg-slate-50 text-slate-900`}
      data-empty={isEmptyChat ? "true" : "false"}
      data-dock={dockMode ? "true" : "false"}
      style={viewportH && !dockMode ? { height: `${viewportH}px` } : undefined}
    >

      {/* ── Mobile sidebar overlay backdrop — only in full workspace mode ── */}
      {!dockMode && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/25 backdrop-blur-[1px] sm:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Left sidebar — hidden entirely in dock mode ───────────────────── */}
      {!dockMode && <aside
        id="steward-sidebar"
        data-expanded={sidebarOpen ? "true" : "false"}
        className={`
          steward-chroma-sidebar
          fixed inset-y-0 left-0 z-40 flex flex-col
          w-72 sm:w-64 bg-slate-50 border-r border-slate-100
          transition-transform duration-300 ease-out
          sm:static sm:z-auto sm:shrink-0
          ${sidebarOpen ? "translate-x-0 shadow-xl sm:w-64 sm:shadow-none animate-sidebar-slide-in" : "-translate-x-full sm:translate-x-0 sm:w-14 sm:overflow-visible"}
        `}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-4 pb-3">
          {/* Logo mark */}
          <div className="flex items-center gap-2 min-w-0">
            <StewardAvatarIcon size={32} alt="Steward" />
            <span className="steward-rail-collapsible text-sm font-semibold text-slate-900 truncate">Steward</span>
          </div>
          {/* Collapse button — touch-friendly */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="steward-rail-collapsible flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>

        {/* Collapsed icon rail */}
        <div className={`${sidebarOpen ? "hidden" : "hidden sm:flex"} flex-1 min-h-0 w-full flex-col items-center gap-2.5 px-1.5 pb-3`}>
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Open sidebar"
            aria-label="Open sidebar"
          >
            <svg className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>

          <button
            type="button"
            onClick={startNewChat}
            disabled={sending}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
            title="New chat"
            aria-label="New chat"
          >
            <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" /></svg>
          </button>

          <div className="mt-1.5 flex min-h-0 w-full flex-1 flex-col items-center gap-1.5 overflow-y-auto px-0.5">
            {filteredThreads.slice(0, 14).map((t) => (
              <button
                key={`collapsed-${t.id}`}
                type="button"
                onClick={() => switchThread(t.id)}
                className={`relative flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${t.id === activeId ? "bg-white text-slate-800 ring-1 ring-emerald-100" : "text-slate-400 hover:bg-white hover:text-slate-600"}`}
                title={t.title}
                aria-label={`Open chat ${t.title}`}
              >
                <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 8h10M7 12h7m-9 8l-1-3a9 9 0 1116 0l-1 3-3-1a9 9 0 01-8 0l-3 1z" /></svg>
                {t.id === activeId && <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />}
              </button>
            ))}
          </div>

          <Link
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setNotePadOpen((value) => !value);
            }}
            className="mb-1 flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-600 transition-colors"
            title={notePadOpen ? "Hide workspace notes" : "Open workspace notes"}
            aria-label={notePadOpen ? "Hide workspace notes" : "Open workspace notes"}
          >
            <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </Link>

          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-600 transition-colors"
            title="Back to CRM"
            aria-label="Back to CRM"
          >
            <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7 7-7M3 12h18" /></svg>
          </Link>

          <Link
            href="/settings"
            className="mt-auto mb-1 flex h-10 w-10 items-center justify-center rounded-xl text-slate-400 hover:bg-white hover:text-slate-600 transition-colors"
            title="AI Settings"
            aria-label="AI Settings"
          >
            <svg className="h-[17px] w-[17px]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
          </Link>
        </div>

        {/* New chat */}
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={startNewChat}
            disabled={sending}
            className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-150"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" /></svg>
            <span className="steward-rail-collapsible">New chat</span>
          </button>
        </div>

        {/* Search */}
        <div className="steward-rail-collapsible px-3 pb-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 transition-colors duration-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></svg>
            <input
              type="text"
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-300 focus:ring-1 focus:ring-emerald-100 transition-all duration-150"
            />
          </div>
        </div>

        {/* Thread list */}
        <div className="steward-rail-collapsible flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {filteredThreads.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-slate-400">No chats yet</p>
          ) : filteredThreads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1.5 rounded-lg px-2 py-3 sm:py-1.5 cursor-pointer transition-all duration-150 touch-manipulation ${
                t.id === activeId
                  ? "bg-white shadow-sm border border-slate-200 text-slate-900 ring-1 ring-emerald-100"
                  : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
              }`}
              onClick={() => { switchThread(t.id); if (window.innerWidth < 640) setSidebarOpen(false); }}
            >
              {/* Scope dot */}
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                t.moduleKey === "compassion" ? "bg-blue-400" :
                t.moduleKey === "events"     ? "bg-amber-400" :
                t.moduleKey === "hrm"        ? "bg-purple-400" :
                t.moduleKey === "webmaster"  ? "bg-rose-400" :
                t.moduleKey === "watchdog"   ? "bg-slate-400" :
                t.moduleKey === "all"        ? "bg-slate-700" : "bg-emerald-500"
              }`} />
              <span className="min-w-0 flex-1 truncate text-xs">{t.title}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); renameThread(t.id); }}
                className="flex h-8 w-8 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded text-slate-300 hover:text-slate-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                title="Rename chat"
              >
                <svg className="h-3.5 w-3.5 sm:h-3 sm:w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536M9 13l6.768-6.768a2.5 2.5 0 113.536 3.536L12.536 16.536a4 4 0 01-1.768 1.036L7 19l1.428-3.768A4 4 0 019 13z" /></svg>
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                className="flex h-8 w-8 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded text-slate-300 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                title="Delete chat"
              >
                <svg className="h-3.5 w-3.5 sm:h-3 sm:w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>

        {/* Bottom sidebar actions */}
        <div className="steward-rail-collapsible border-t border-slate-100 px-3 py-3 space-y-1">
          <div className="mb-3 rounded-xl border border-slate-200 bg-white p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Current context</p>
            <div className="mt-2 space-y-2 text-xs">
              <div>
                <p className="font-semibold text-slate-900">{scopeLabel}</p>
                <p className="mt-0.5 leading-4 text-slate-500">{MODE_HELP[mode]}</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  disabled={memorySaving || !memoryPreferences}
                  onClick={() => void updateMemoryPreferences({ memoryEnabled: !Boolean(memoryPreferences?.memoryEnabled) })}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${memoryPreferences?.memoryEnabled ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-300 bg-white text-slate-600"}`}
                >
                  {memoryPreferences?.memoryEnabled ? "Memory on" : "Memory off"}
                </button>
                <button
                  type="button"
                  disabled={memorySaving || !memoryPreferences}
                  onClick={() => void updateMemoryPreferences({ fileContextEnabled: !Boolean(memoryPreferences?.fileContextEnabled) })}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition-colors ${memoryPreferences?.fileContextEnabled ? "border-blue-300 bg-blue-50 text-blue-700" : "border-slate-300 bg-white text-slate-600"}`}
                >
                  {memoryPreferences?.fileContextEnabled ? "Files on" : "Files off"}
                </button>
              </div>
              {memorySaving && <p className="text-[10px] text-slate-400">Saving memory settings...</p>}
              {memoryError && <p className="text-[10px] text-red-600">{memoryError}</p>}
            </div>
          </div>
          <Link
            href="#"
            onClick={(event) => {
              event.preventDefault();
              setNotePadOpen((value) => !value);
            }}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
            Workspace Notes
          </Link>
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
            AI Settings
          </Link>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7 7-7M3 12h18" /></svg>
            Back to CRM
          </Link>
          <button
            type="button"
            onClick={clearChat}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Clear chat
          </button>
        </div>
      </aside>}

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className={`steward-chroma-main relative flex min-w-0 flex-1 flex-col overflow-hidden ${notePadOpen ? "pr-0 lg:pr-[50%]" : ""}`}>

        {/* Top bar inside the workspace — full mode vs compact dock mode */}
        {dockMode ? (
          /* ── Dock-mode header: close + identity + expand ─── */
          <div className="steward-chroma-header flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-2 min-h-[60px]">
            {/* Close dock */}
            <button
              type="button"
              onClick={onCloseDock}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Close dock"
              aria-label="Close Steward dock"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            <div className="flex min-w-0 items-center gap-2">
              <StewardAvatarIcon size={36} alt="Steward" className="ring-emerald-200" />
              <span className="truncate text-xs font-semibold text-slate-900">Steward</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.45)]" />
            </div>

            {/* Expand to full workspace */}
            <a href={workspaceHref} target="_blank" rel="noopener noreferrer"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
              title="Open full workspace">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
        ) : (
          <div className="steward-chroma-header flex min-h-[60px] shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:hidden">
            <button
              type="button"
              onClick={() => setSidebarOpen((value) => !value)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
              title={sidebarOpen ? "Close menu" : "Open menu"}
              aria-label={sidebarOpen ? "Close menu" : "Open menu"}
              aria-expanded={sidebarOpen}
              aria-controls="steward-sidebar"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={sidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
              </svg>
            </button>
            <div className="flex min-w-0 items-center gap-2">
              <StewardAvatarIcon size={36} alt="Steward" className="ring-emerald-200" />
              <span className="truncate text-xs font-semibold text-slate-900">Steward Workspace</span>
            </div>
          </div>
        )}
        {/* end dockMode ? dock-header : full-header */}

        {/* ── Conversation ────────────────────────────────────────────────── */}
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-12 bg-gradient-to-b from-slate-50/95 via-slate-50/50 to-transparent" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 bg-gradient-to-t from-slate-50/95 to-transparent" />
          <div className="steward-chroma-scroll chat-scroll-smooth h-full overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
            <div className="mx-auto w-full max-w-4xl px-2 py-4 sm:px-4 sm:py-6">

            {/* Empty state with starter prompts */}
            {isEmptyChat ? (
              <div className="steward-empty-state flex min-h-[62vh] flex-col items-center justify-center gap-7 px-2 text-center">
                <h2 className="text-xl font-semibold text-slate-900 sm:text-2xl">Ready when you are.</h2>

                <div ref={composerRef} className="steward-hero-composer relative w-full max-w-[820px] rounded-3xl border border-slate-200 bg-white px-2 py-2 shadow-[0_16px_42px_rgba(15,23,42,0.12)] sm:rounded-full sm:px-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => handleFileAttach(e.target.files)}
                  />

                  {mentionQuery !== null && (
                    <div className="relative">
                      <DonorMentionPicker
                        query={mentionQuery}
                        onSelect={handleMentionSelect}
                        onDismiss={() => setMentionQuery(null)}
                        anchorRef={composerRef}
                      />
                    </div>
                  )}

                  {toolPickerQuery !== null && mentionQuery === null && (
                    <div className="mb-1 rounded-lg border border-emerald-200 bg-white p-1.5 text-left shadow-sm">
                      <p className="px-1 text-[10px] font-medium text-emerald-700">Slash tools: type after / to search available tools, then pick one</p>
                      <div className="mt-1 max-h-36 overflow-y-auto space-y-1">
                        {filteredToolOptions.length > 0 ? filteredToolOptions.map((tool) => (
                          <button
                            key={tool.name}
                            type="button"
                            onClick={() => handleForcedToolSelect(tool.name)}
                            className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-left text-[11px] text-slate-600 hover:border-emerald-200 hover:bg-emerald-50"
                          >
                            <span className="font-semibold text-emerald-700">/{tool.name}</span>
                            <span className="ml-1 text-slate-500">{tool.description}</span>
                          </button>
                        )) : (
                          <p className="px-1 py-1 text-[11px] text-slate-500">No matching available tools. Try {slashToolHints}</p>
                        )}
                      </div>
                    </div>
                  )}

                  {lockedDonors.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 px-0.5 pt-0.5">
                      <span className="shrink-0 text-[10px] font-medium text-slate-400">Focused on</span>
                      {lockedDonors.map((d) => {
                        const name = [d.firstName, d.lastName].filter(Boolean).join(" ") || d.email || "Unknown";
                        return (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                          >
                            <span className="text-emerald-500 text-[10px]">@</span>
                            {name}
                            <button
                              type="button"
                              onClick={() => setLockedDonors((prev) => prev.filter((x) => x.id !== d.id))}
                              className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                              aria-label={`Remove ${name} from context`}
                            >
                              <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {forcedTools.length > 0 && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 px-0.5 pt-0.5 text-left">
                      <span className="shrink-0 text-[10px] font-medium text-emerald-700">Forced tools</span>
                      {forcedTools.map((tool) => (
                        <span key={tool} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          /{tool}
                          <button
                            type="button"
                            onClick={() => setForcedTools((prev) => prev.filter((t) => t !== tool))}
                            className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                            aria-label={`Remove forced tool ${tool}`}
                          >
                            <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex min-h-10 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
                    <div className="relative shrink-0" data-composer-dropdown>
                      <button
                        type="button"
                        onClick={() => { setAddOpen((v) => !v); setToolsOpen(false); setScopeOpen(false); }}
                        className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:h-9 sm:w-9"
                        title="Add context or files"
                        aria-expanded={addOpen}
                      >
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                      </button>
                      {addOpen && (
                        <div className="absolute bottom-full left-0 z-50 mb-3 w-[calc(100vw-2rem)] max-w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-dropdown-slide-down sm:w-52">
                          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 animate-fade-in">Add context</div>
                          {ADD_CONTEXT_MENU_ITEMS.map(({ key, label, icon }) => (
                            <button
                              key={label}
                              type="button"
                              onClick={() => handleAddContextAction(key)}
                              className="flex w-full items-center gap-2.5 px-3 py-3 text-sm text-slate-700 transition-all duration-150 hover:bg-slate-50 active:bg-slate-100 sm:py-2"
                            >
                              <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
                              {label}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    <textarea
                      ref={textareaRef}
                      value={draft}
                      onChange={handleDraftChange}
                      onKeyDown={handleKeyDown}
                      placeholder="Ask anything (type @ to mention a donor)"
                      rows={1}
                      disabled={sending}
                      className="steward-chroma-textarea min-h-8 min-w-[120px] flex-1 resize-none bg-transparent py-1 text-sm text-slate-900 placeholder-slate-400 outline-none sm:min-w-0"
                      style={{ maxHeight: "120px" }}
                    />

                    <div className={`relative ${dockMode ? "hidden" : "hidden sm:block"}`}>
                      <select
                        value={mode}
                        onChange={(event) => setMode(event.target.value as ChatMode)}
                        className="h-7 appearance-none rounded-full border border-slate-200 bg-white py-0 pl-2.5 pr-7 text-[10px] font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                        title="Chat mode"
                      >
                        <option value="ask" className="bg-white text-slate-900">Ask & Retrieve</option>
                        <option value="analyze" className="bg-white text-slate-900">Analyze Trends</option>
                        <option value="draft" className="bg-white text-slate-900">Draft Outreach</option>
                        <option value="free" className="bg-white text-slate-900">Pure Mode</option>
                        <option value="agentic" className="bg-white text-slate-900">Agentic Mode</option>
                        <option value="llm" className="bg-white text-slate-900">LLM Deep Reasoning</option>
                        <option value="action" className="bg-white text-slate-900">Action Planner</option>
                        <option value="help" className="bg-white text-slate-900">Workflow Help</option>
                      </select>
                      <svg
                        className="pointer-events-none absolute right-2 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-slate-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth={2.25}
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>

                    <button
                      type="button"
                      onClick={() => setThoughtStackEnabled((value) => !value)}
                      className={`${dockMode ? "hidden" : "hidden sm:inline-flex"} h-7 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold transition-colors ${
                        thoughtStackEnabled
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                      }`}
                      title={thoughtStackEnabled ? "ThoughtStack beta is enabled. Click to disable for direct chat responses." : "ThoughtStack beta is disabled. Click to enable reliability gating."}
                    >
                      <span className="rounded border border-current/25 px-1 py-[1px] text-[8px] font-bold uppercase tracking-wide">BETA</span>
                      {thoughtStackEnabled ? "ThoughtStack On" : "ThoughtStack Off"}
                    </button>

                    <button
                      type="button"
                      disabled={sending}
                      onClick={() => {
                        if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
                        const speechWindow = window as Window & {
                          SpeechRecognition?: SpeechRecognitionConstructorLike;
                          webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
                        };
                        const SR = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
                        if (!SR) return;
                        const recog = new SR();
                        recog.lang = "en-US";
                        recog.interimResults = false;
                        recog.onresult = (ev: SpeechRecognitionEventLike) => {
                          const text = ev.results[0]?.[0]?.transcript ?? "";
                          if (text) setDraft((d) => (d ? `${d} ${text}` : text));
                        };
                        recog.start();
                      }}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 sm:h-9 sm:w-9"
                      title="Voice input"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" /></svg>
                    </button>

                    {sending ? (
                      <button
                        type="button"
                        onClick={stopGeneration}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-950 transition-transform active:scale-95 sm:h-10 sm:w-10"
                        title="Stop generation"
                      >
                        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => void send()}
                        disabled={!canSend}
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 sm:w-10"
                        title="Send"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" /></svg>
                      </button>
                    )}
                  </div>

                  {dockMode && (
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-1.5">
                      <div className="relative shrink-0">
                        <select
                          value={mode}
                          onChange={(event) => setMode(event.target.value as ChatMode)}
                          className="h-6 max-w-[170px] appearance-none rounded-full border border-slate-200 bg-white py-0 pl-2 pr-6 text-[10px] font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                          title="Chat mode"
                        >
                          <option value="ask" className="bg-white text-slate-900">Ask & Retrieve</option>
                          <option value="analyze" className="bg-white text-slate-900">Analyze Trends</option>
                          <option value="draft" className="bg-white text-slate-900">Draft Outreach</option>
                          <option value="free" className="bg-white text-slate-900">Pure Mode</option>
                          <option value="agentic" className="bg-white text-slate-900">Agentic Mode</option>
                          <option value="llm" className="bg-white text-slate-900">LLM Deep Reasoning</option>
                          <option value="action" className="bg-white text-slate-900">Action Planner</option>
                          <option value="help" className="bg-white text-slate-900">Workflow Help</option>
                        </select>
                        <svg
                          className="pointer-events-none absolute right-1.5 top-1/2 h-2 w-2 -translate-y-1/2 text-slate-400"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.25}
                          viewBox="0 0 24 24"
                          aria-hidden="true"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>

                      <button
                        type="button"
                        onClick={() => setThoughtStackEnabled((value) => !value)}
                        className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold transition-colors ${
                          thoughtStackEnabled
                            ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                        }`}
                        title={thoughtStackEnabled ? "ThoughtStack beta is enabled. Click to disable for direct chat responses." : "ThoughtStack beta is disabled. Click to enable reliability gating."}
                      >
                        <span className="rounded border border-current/25 px-1 py-[1px] text-[8px] font-bold uppercase tracking-wide">BETA</span>
                        {thoughtStackEnabled ? "ThoughtStack On" : "ThoughtStack Off"}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, i) => (
                  <MessageRow
                    key={msg.id}
                    msg={msg}
                    activeMode={mode}
                    renderMode={renderMode}
                    isStreaming={msg.id === activeAssistantId}
                    onRegenerate={() => regenerate(msg.id)}
                    onCopy={() => void copyMessage(msg.content)}
                    onSaveTemplate={() => openSaveTemplateModal(msg.id)}
                    onSaveDraftLetter={() => void saveDraftLetterFromMessage(msg.id)}
                    onRunAction={(idx) => void runAction(msg.id, idx)}
                    onOpenReport={(path, label) => openReportWorkspaceFromMessage(msg.id, path, label)}
                    onAskReportQuestion={(prompt) => {
                      const cardArtifact = msg.structured?.artifacts?.find((artifact) => artifact.type === "report_card") as StewardReportCardArtifact | undefined;
                      const contextTitle = cardArtifact?.title || "report artifact";
                      void send(`Report artifact follow-up (${contextTitle}): ${prompt}`);
                    }}
                    isLast={i === messages.length - 1}
                  />
                ))}
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4M12 16h.01" /></svg>
                <div className="min-w-0 flex-1">
                  {error}
                  <button onClick={() => setError(null)} className="ml-2 text-xs text-red-600 underline hover:no-underline">Dismiss</button>
                </div>
              </div>
            )}

            {/* Action status */}
            {actionStatus && (
              <div className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${
                actionStatus.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}>
                {actionStatus.message}
                <button onClick={() => setActionStatus(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

              <div ref={bottomRef} className="h-6" />
            </div>
          </div>
        </div>

        {/* ── Composer ─────────────────────────────────────────────────────
             Safe-area padding handles iOS home-indicator area.
        ──────────────────────────────────────────────────────────────────── */}
        {(!isEmptyChat || dockMode) && (
        <div className="steward-chroma-composer-wrap shrink-0 bg-white px-3 pt-3 sm:px-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-3xl">
            <div ref={composerRef} className="steward-hero-composer relative w-full rounded-2xl border border-slate-200 bg-white px-2 pt-2 pb-1.5 shadow-[0_14px_32px_rgba(15,23,42,0.10)] sm:px-3">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileAttach(e.target.files)}
              />

              {mentionQuery !== null && (
                <div className="relative">
                  <DonorMentionPicker
                    query={mentionQuery}
                    onSelect={handleMentionSelect}
                    onDismiss={() => setMentionQuery(null)}
                    anchorRef={composerRef}
                  />
                </div>
              )}

              {toolPickerQuery !== null && mentionQuery === null && (
                <div className="mb-1 rounded-lg border border-emerald-200 bg-white p-1.5 text-left shadow-sm">
                  <p className="px-1 text-[10px] font-medium text-emerald-700">Slash tools: type after / to search available tools, then pick one</p>
                  <div className="mt-1 max-h-36 overflow-y-auto space-y-1">
                    {filteredToolOptions.length > 0 ? filteredToolOptions.map((tool) => (
                      <button
                        key={tool.name}
                        type="button"
                        onClick={() => handleForcedToolSelect(tool.name)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-left text-[11px] text-slate-600 hover:border-emerald-200 hover:bg-emerald-50"
                      >
                        <span className="font-semibold text-emerald-700">/{tool.name}</span>
                        <span className="ml-1 text-slate-500">{tool.description}</span>
                      </button>
                    )) : (
                      <p className="px-1 py-1 text-[11px] text-slate-500">No matching available tools. Try {slashToolHints}</p>
                    )}
                  </div>
                </div>
              )}

              {lockedDonors.length > 0 && (
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5 px-0.5 pt-0.5">
                  <span className="shrink-0 text-[10px] font-medium text-slate-400">Focused on</span>
                  {lockedDonors.map((d) => {
                    const name = [d.firstName, d.lastName].filter(Boolean).join(" ") || d.email || "Unknown";
                    return (
                      <span
                        key={d.id}
                        className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
                      >
                        <span className="text-emerald-500 text-[10px]">@</span>
                        {name}
                        <button
                          type="button"
                          onClick={() => setLockedDonors((prev) => prev.filter((x) => x.id !== d.id))}
                          className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                          aria-label={`Remove ${name} from context`}
                        >
                          <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}

              {forcedTools.length > 0 && (
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5 px-0.5 pt-0.5 text-left">
                  <span className="shrink-0 text-[10px] font-medium text-emerald-700">Forced tools</span>
                  {forcedTools.map((tool) => (
                    <span key={tool} className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                      /{tool}
                      <button
                        type="button"
                        onClick={() => setForcedTools((prev) => prev.filter((t) => t !== tool))}
                        className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full text-emerald-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700"
                        aria-label={`Remove forced tool ${tool}`}
                      >
                        <svg className="h-2.5 w-2.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="flex min-h-10 flex-wrap items-center gap-1.5 sm:flex-nowrap sm:gap-2">
                <div className="relative shrink-0" data-composer-dropdown>
                  <button
                    type="button"
                    onClick={() => { setAddOpen((v) => !v); setToolsOpen(false); setScopeOpen(false); }}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:h-9 sm:w-9"
                    title="Add context or files"
                    aria-expanded={addOpen}
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                  </button>
                  {addOpen && (
                    <div className="absolute bottom-full left-0 z-50 mb-3 w-[calc(100vw-2rem)] max-w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-dropdown-slide-down sm:w-52">
                      <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 animate-fade-in">Add context</div>
                      {ADD_CONTEXT_MENU_ITEMS.map(({ key, label, icon }) => (
                        <button
                          key={label}
                          type="button"
                          onClick={() => handleAddContextAction(key)}
                          className="flex w-full items-center gap-2.5 px-3 py-3 text-sm text-slate-700 transition-all duration-150 hover:bg-slate-50 active:bg-slate-100 sm:py-2"
                        >
                          <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask anything (type @ to mention a donor)"
                  rows={1}
                  disabled={sending}
                  className="steward-chroma-textarea min-h-8 min-w-[120px] flex-1 resize-none bg-transparent py-1 text-sm text-slate-900 placeholder-slate-400 outline-none sm:min-w-0"
                  style={{ maxHeight: "120px" }}
                />

                <button
                  type="button"
                  disabled={sending}
                  onClick={() => {
                    if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
                    const speechWindow = window as Window & {
                      SpeechRecognition?: SpeechRecognitionConstructorLike;
                      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
                    };
                    const SR = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
                    if (!SR) return;
                    const recog = new SR();
                    recog.lang = "en-US";
                    recog.interimResults = false;
                    recog.onresult = (ev: SpeechRecognitionEventLike) => {
                      const text = ev.results[0]?.[0]?.transcript ?? "";
                      if (text) setDraft((d) => (d ? `${d} ${text}` : text));
                    };
                    recog.start();
                  }}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40 sm:h-9 sm:w-9"
                  title="Voice input"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" /></svg>
                </button>

                {sending ? (
                  <button
                    type="button"
                    onClick={stopGeneration}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-950 transition-transform active:scale-95 sm:h-10 sm:w-10"
                    title="Stop generation"
                  >
                    <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void send()}
                    disabled={!canSend}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-45 sm:h-10 sm:w-10"
                    title="Send"
                  >
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" /></svg>
                  </button>
                )}
              </div>

              {/* ── Mode & ThoughtStack controls row ── */}
              <div className="mt-0.5 flex flex-wrap items-center gap-1.5 border-t border-slate-100 pt-1.5 pb-0.5 sm:gap-2">
                <div className="relative shrink-0">
                  <select
                    value={mode}
                    onChange={(event) => setMode(event.target.value as ChatMode)}
                    className="h-6 max-w-[190px] appearance-none rounded-full border border-slate-200 bg-white py-0 pl-2.5 pr-6 text-[10px] font-semibold text-slate-700 outline-none transition-colors hover:border-slate-300 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                    title="Chat mode"
                  >
                    <option value="ask" className="bg-white text-slate-900">Ask & Retrieve</option>
                    <option value="analyze" className="bg-white text-slate-900">Analyze Trends</option>
                    <option value="draft" className="bg-white text-slate-900">Draft Outreach</option>
                    <option value="free" className="bg-white text-slate-900">Pure Mode</option>
                    <option value="agentic" className="bg-white text-slate-900">Agentic Mode</option>
                    <option value="llm" className="bg-white text-slate-900">LLM Deep Reasoning</option>
                    <option value="action" className="bg-white text-slate-900">Action Planner</option>
                    <option value="help" className="bg-white text-slate-900">Workflow Help</option>
                  </select>
                  <svg className="pointer-events-none absolute right-1.5 top-1/2 h-2 w-2 -translate-y-1/2 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2.25} viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                <button
                  type="button"
                  onClick={() => setThoughtStackEnabled((value) => !value)}
                  className={`inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[10px] font-semibold transition-colors ${
                    thoughtStackEnabled
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                  title={thoughtStackEnabled ? "ThoughtStack beta is enabled. Click to disable for direct chat responses." : "ThoughtStack beta is disabled. Click to enable reliability gating."}
                >
                  <span className="rounded border border-current/25 px-1 py-[1px] text-[8px] font-bold uppercase tracking-wide">BETA</span>
                  {thoughtStackEnabled ? "ThoughtStack On" : "ThoughtStack Off"}
                </button>
              </div>
            </div>

            <p className="mt-1.5 text-center text-[10px] text-slate-400 hidden sm:block">
              AGENTSteward may make mistakes. Human review required before sending or changing CRM records.
            </p>
          </div>
        </div>
        )}

        {notePadOpen && (
          <aside className={`absolute bottom-0 right-0 ${dockMode ? "top-[52px]" : "top-0"} z-20 w-full border-l border-slate-200 bg-white/95 backdrop-blur lg:w-1/2`}>
            <div className="flex h-full flex-col">
              <div className="flex items-center gap-2 border-b border-slate-200 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">Workspace Notepad</p>
                  <p className="text-[11px] text-slate-500">Attached to every prompt in this thread</p>
                </div>
                <span className="rounded-full border border-slate-300 bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">v{activeThreadNote.version}</span>
                <button
                  type="button"
                  onClick={() => setNotePadOpen(false)}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  title="Close workspace notes"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>

              <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                <button
                  type="button"
                  onClick={() => setWorkspaceNoteSourceOfTruth(!activeThreadNote.sourceOfTruth)}
                  className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                    activeThreadNote.sourceOfTruth
                      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                      : "border-slate-300 bg-white text-slate-600"
                  }`}
                >
                  {activeThreadNote.sourceOfTruth ? "Source of truth: on" : "Source of truth: off"}
                </button>
                <button
                  type="button"
                  onClick={clearWorkspaceNotes}
                  className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Clear notes
                </button>
              </div>

              <div className="min-h-0 flex-1 px-3 py-3">
                <textarea
                  value={activeThreadNote.text}
                  onChange={(event) => setWorkspaceNoteText(event.target.value)}
                  onBlur={bumpWorkspaceNoteVersion}
                  placeholder="Capture working context, constraints, and decisions here. Steward will treat this as attached context for each message."
                  className="h-full w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-colors placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>
            </div>
          </aside>
        )}
      </div>

      <StewardSaveTemplateModal
        open={Boolean(templateModal)}
        draft={templateModal?.draft ?? { name: "", subject: "", previewText: "", bodyText: "" }}
        donorCandidates={templateModal?.donorCandidates ?? []}
        saving={templateSaving}
        error={templateSaveError}
        onChange={(next) => setTemplateModal((prev) => (prev ? { ...prev, draft: next } : prev))}
        onClose={() => {
          if (templateSaving) return;
          setTemplateModal(null);
          setTemplateSaveError(null);
        }}
        onSave={saveTemplateFromModal}
      />

      {emailWorkspace && (
        <WorkspaceSetupModal
          title="Steward Email Workspace"
          subtitle="Build, preview, and revise this draft without leaving AGENTSteward."
          onClose={() => setEmailWorkspace(null)}
          maxWidthClassName="max-w-[96vw]"
          appearance="light"
          openInNewTabHref={`/oyama-email/templates/${encodeURIComponent(emailWorkspace.campaignId)}/builder`}
          openInNewTabLabel="Open full screen"
        >
          <div className="px-4 pb-4 pt-12">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>Use Preview in the builder header, then ask Steward for edits and run the next build action.</span>
              <a
                href={`/oyama-email/templates/${encodeURIComponent(emailWorkspace.campaignId)}/builder`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Open full page
              </a>
            </div>
            <EmailBuilderApp
              campaignId={emailWorkspace.campaignId}
              returnTo={emailWorkspace.returnTo}
              embedded
              onSaved={async () => {
                setActionStatus({ tone: "success", message: "Email draft saved from AGENTSteward workspace." });
              }}
            />
          </div>
        </WorkspaceSetupModal>
      )}

      {letterWorkspace && (
        <WorkspaceSetupModal
          title="Steward Letter Workspace"
          subtitle="Build, preview, and revise this letter draft directly in AGENTSteward."
          onClose={() => setLetterWorkspace(null)}
          maxWidthClassName="max-w-[96vw]"
          appearance="light"
          openInNewTabHref={`/oyama-letters/templates/${encodeURIComponent(letterWorkspace.templateId)}?fullscreen=1`}
          openInNewTabLabel="Open full screen"
        >
          <div className="px-4 pb-4 pt-12">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span>Switch to Preview inside the letter editor and continue revisions from chat prompts.</span>
              <a
                href={`/oyama-letters/templates/${encodeURIComponent(letterWorkspace.templateId)}?fullscreen=1`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
              >
                Open full page
              </a>
            </div>
            <div className="h-[82vh] min-h-[640px] overflow-hidden rounded-xl border border-slate-200 bg-white">
              <OyamaLettersWorkspace
                view="builder"
                templateId={letterWorkspace.templateId}
              />
            </div>
          </div>
        </WorkspaceSetupModal>
      )}

      {reportWorkspace && (
        <WorkspaceSetupModal
          title="Steward Report Workspace"
          subtitle="Review deeper report details and ask Steward follow-up questions without leaving chat."
          onClose={() => setReportWorkspace(null)}
          maxWidthClassName="max-w-[96vw]"
          appearance="light"
          openInNewTabHref={reportWorkspace.path}
          openInNewTabLabel="Open full screen"
        >
          <div className="h-[calc(100dvh-8.5rem)] overflow-y-auto bg-slate-50 px-3 pb-4 pt-10 sm:h-[calc(100dvh-7.5rem)] sm:px-4 sm:pt-12">
            <div className="mb-3 flex flex-col items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:gap-3">
              <span className="w-full truncate text-slate-600">Report route: {reportWorkspace.path}</span>
              <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
                <button
                  type="button"
                  onClick={printReportWorkspace}
                  className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200 hover:bg-emerald-500/20"
                >
                  Print paper report
                </button>
                <a
                  href={reportWorkspace.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  Open full page
                </a>
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(320px,1fr)]">
              <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <h3 className="text-sm font-semibold text-slate-900 sm:text-base">{reportCardArtifact?.title || reportWorkspace.title}</h3>
                  {reportCardArtifact?.fiscalYearLabel && (
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {reportCardArtifact.fiscalYearLabel}
                    </span>
                  )}
                </div>

                {reportCardArtifact?.metrics && reportCardArtifact.metrics.length > 0 ? (
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {reportCardArtifact.metrics.map((metric, idx) => (
                      <div key={`${metric.label}-${idx}`} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{metric.label}</p>
                        <p className="mt-1 text-lg font-semibold text-slate-900">{metric.value}</p>
                        {metric.delta && <p className="text-xs text-slate-500">{metric.delta}</p>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No report metrics were attached to this response.</p>
                )}

                {reportMetricBars.length > 0 && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Metric weight distribution</p>
                    <div className="space-y-2">
                      {reportMetricBars.map((item) => (
                        <div key={item.label}>
                          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-600">
                            <span className="truncate pr-2">{item.label}</span>
                            <span className="font-semibold text-slate-900">{item.value}</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded bg-slate-200">
                            <div
                              className="h-full rounded bg-gradient-to-r from-emerald-500 to-green-400"
                              style={{ width: `${item.width}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reportCharts.length > 0 && (
                  <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Chart snapshot</p>
                    <div className="space-y-2">
                      {reportCharts.slice(0, 1).map((chart) => {
                        const series = chart.series?.[0];
                        if (!series || series.data.length === 0) {
                          return <p key={chart.title || chart.chartType} className="text-xs text-slate-500">No chart series data available.</p>;
                        }

                        const maxValue = Math.max(...series.data, 1);
                        return (
                          <div key={chart.title || chart.chartType}>
                            <p className="mb-1 text-xs font-medium text-slate-700">{chart.title || series.name}</p>
                            <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-3">
                              {series.data.slice(0, 9).map((value, idx) => (
                                <div key={`${series.name}-${idx}`} className="rounded border border-slate-200 bg-white px-2 py-1.5">
                                  <p className="truncate text-[10px] uppercase tracking-wide text-slate-500">{chart.labels[idx] || `P${idx + 1}`}</p>
                                  <div className="mt-1 flex items-center gap-2">
                                    <div className="h-1.5 flex-1 overflow-hidden rounded bg-slate-200">
                                      <div
                                        className="h-full rounded bg-emerald-500"
                                        style={{ width: `${Math.max(8, Math.round((value / maxValue) * 100))}%` }}
                                      />
                                    </div>
                                    <span className="font-semibold text-slate-800">{chart.yAxisPrefix || ""}{formatCompact(value)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {reportWorkspace.structured?.evidence && reportWorkspace.structured.evidence.length > 0 && (
                  <div className="mt-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Evidence highlights</p>
                    <ul className="space-y-1 text-sm text-slate-700">
                      {reportWorkspace.structured.evidence.slice(0, 12).map((item, idx) => (
                        <li key={`${item.label}-${idx}`} className="rounded border border-slate-200 bg-slate-50 px-2 py-1">
                          {item.label}{item.detail ? ` - ${item.detail}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-3 xl:sticky xl:top-0 xl:self-start">
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-3 sm:p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Interactive HTML artifact</p>
                    {reportWorkspace.htmlGeneratedAt && (
                      <span className="text-[10px] text-slate-400">Built {reportWorkspace.htmlGeneratedAt}</span>
                    )}
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">
                    The report artifact is rebuilt in the background as an interactive HTML packet whenever metrics or evidence change.
                  </p>
                  {reportArtifactBuilding && (
                    <p className="mt-2 text-[11px] text-sky-700">Building artifact in background...</p>
                  )}
                  {reportArtifactError && (
                    <p className="mt-2 text-[11px] text-rose-700">{reportArtifactError}</p>
                  )}
                  {reportWorkspace.htmlArtifact ? (
                    <div className="mt-3 overflow-hidden rounded-lg border border-slate-200 bg-white">
                      <iframe
                        title="Interactive report artifact"
                        srcDoc={reportWorkspace.htmlArtifact}
                        className="h-72 w-full border-0"
                        sandbox="allow-same-origin allow-scripts"
                      />
                    </div>
                  ) : (
                    <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-white/80 px-3 py-2 text-xs text-slate-500">
                      Artifact preview will appear after the first background build completes.
                    </div>
                  )}
                </div>

                {reportInsights.length > 0 && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">CRM intelligence snapshot</p>
                    <ul className="space-y-1.5 text-sm text-slate-700">
                      {reportInsights.map((item, idx) => (
                        <li key={`${item}-${idx}`} className="rounded border border-emerald-200 bg-white/80 px-2 py-1">{item}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-700">Printable paper version</p>
                  <p className="text-xs leading-5 text-slate-600">
                    Generate a print-optimized report packet with KPI tiles, stewardship insights, and evidence highlights.
                    Use this for board packets, staff briefings, and physical review meetings.
                  </p>
                  <button
                    type="button"
                    onClick={printReportWorkspace}
                    className="mt-3 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Open print layout
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Deterministic guide templates</p>
                  <div className="space-y-2">
                    {reportWorkspace.guideTemplates.map((template) => {
                      const active = reportGuideTemplate === template.id;
                      return (
                        <button
                          key={template.id}
                          type="button"
                          onClick={() => {
                            setReportGuideTemplate(template.id);
                            setReportQuestion(template.defaultPrompt);
                          }}
                          className={`w-full rounded-lg border px-2.5 py-2 text-left transition-colors ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
                        >
                          <p className={`text-xs font-semibold ${active ? "text-emerald-700" : "text-slate-900"}`}>{template.label}</p>
                          <p className="mt-1 text-[11px] leading-4 text-slate-400">{template.description}</p>
                          <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">Layout: {template.layoutHint}</p>
                        </button>
                      );
                    })}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                      Active template: {reportGuideTemplate}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] text-slate-600">
                      Layout: {reportWorkspace.layoutHint}
                    </span>
                  </div>
                  {reportWorkspace.appliedFilters.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {reportWorkspace.appliedFilters.map((filter) => (
                        <span key={filter} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">
                          {filter}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Revision history</p>
                  <div className="space-y-2">
                    {reportWorkspace.revisions.slice().reverse().map((revision) => {
                      const active = reportWorkspace.activeRevisionId === revision.id;
                      return (
                        <div key={revision.id} className={`rounded-lg border px-2.5 py-2 ${active ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-slate-50"}`}>
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-slate-900">v{revision.version} - {revision.label}</p>
                            <button
                              type="button"
                              onClick={() => rollbackReportRevision(revision.id)}
                              disabled={active}
                              className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              Restore
                            </button>
                          </div>
                          <p className="mt-1 text-[11px] text-slate-400">{new Date(revision.createdAt).toLocaleString()}</p>
                          <p className="mt-1 text-[11px] text-slate-600">{revision.prompt}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Prompt shortcuts</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      "Explain the top 3 drivers behind this report.",
                      "Find the biggest risk in this report and propose mitigation.",
                      "Show weekly, monthly, and fiscal comparisons from this report.",
                      "Recommend 5 donor actions based on these metrics.",
                      "Build a board-ready executive summary from this report.",
                    ].map((toolPrompt) => (
                      <button
                        key={toolPrompt}
                        type="button"
                        onClick={() => setReportQuestion(toolPrompt)}
                        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50 sm:w-auto"
                      >
                        {toolPrompt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:p-4">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Ask LLM about this report</p>
                  <textarea
                    value={reportQuestion}
                    onChange={(event) => setReportQuestion(event.target.value)}
                    placeholder="Ask for trends, risks, recommendations, or forecast insights..."
                    className="min-h-28 w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                  <div className="mt-2 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <button
                      type="button"
                      onClick={() => setReportQuestion("")}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                    <button
                      type="button"
                      onClick={() => void askStewardFromReport()}
                      disabled={!reportQuestion.trim() || reportArtifactBuilding}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {reportArtifactBuilding ? "Rebuilding..." : "Rebuild Artifact"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
  );
}

// ─── MessageRow sub-component ─────────────────────────────────────────────────

interface MessageRowProps {
  msg: UiMessage;
  activeMode: ChatMode;
  renderMode: RenderMode;
  isStreaming: boolean;
  isLast: boolean;
  onRegenerate: () => void;
  onCopy: () => void;
  onSaveTemplate: () => void;
  onSaveDraftLetter: () => void;
  onRunAction: (idx: number) => void;
  onOpenReport: (path: string, label?: string) => void;
  onAskReportQuestion: (prompt: string) => void;
}

function MessageRow({ msg, activeMode, renderMode, isStreaming, isLast, onRegenerate, onCopy, onSaveTemplate, onSaveDraftLetter, onRunAction, onOpenReport, onAskReportQuestion }: MessageRowProps) {
  if (msg.role === "user") {
    return (
      <div className="steward-message-row steward-message-row-user flex justify-end animate-slide-up-fade-in">
        <div className="steward-message-user max-w-[85%] sm:max-w-[80%] rounded-2xl rounded-br-sm bg-emerald-600 px-4 py-3 text-sm text-white shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  const hasEmailArtifact = Boolean(msg.structured?.artifacts?.some((artifact) => artifact.type === "email_draft"));
  const hasEmailLikeBody = /(^|\n)\s*subject\s*:/i.test(msg.content) && /(^|\n)\s*body\s*:/i.test(msg.content);
  const hasLetterLikeBody = hasEmailLikeBody
    || /dear\s+\{\{?/i.test(msg.content)
    || /warm\s+regards|sincerely|gratefully|with\s+appreciation/i.test(msg.content);
  const canSaveAsTemplate = hasEmailArtifact || hasEmailLikeBody || msg.responseMode === "draft" || msg.responseMode === "free" || msg.responseMode === "agentic" || msg.responseMode === "writing";
  const canSaveAsDraftLetter = hasLetterLikeBody || canSaveAsTemplate;
  const effectiveMode: ChatMode = msg.responseMode ?? activeMode;
  const thoughtStackActive = effectiveMode === "free" ? false : (msg.thoughtStackEnabled ?? true);
  const [thinkingPulseTicks, setThinkingPulseTicks] = useState(0);

  useEffect(() => {
    if (!isStreaming) {
      setThinkingPulseTicks(0);
      return;
    }
    const timer = window.setInterval(() => setThinkingPulseTicks((v) => v + 1), 1200);
    return () => window.clearInterval(timer);
  }, [isStreaming]);

  const thinkingElapsedLabel = `${thinkingPulseTicks * 1.2}`;

  return (
    <div className="steward-message-row steward-message-row-assistant group flex flex-col gap-2 animate-slide-up-fade-in">
      {/* Avatar + name row */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <StewardAvatarIcon size={24} alt="Steward" />
          {isStreaming && <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin-slow" />}
        </div>
        <span className="text-xs font-semibold text-slate-700">Steward</span>
        {msg.runtimeMode && (
          <span className="text-[10px] text-slate-400 animate-fade-in">
            {msg.runtimeMode === "local" ? "local AI" : msg.runtimeMode === "remote" ? "remote AI" : ""}
          </span>
        )}
        {isStreaming && (
          <span className="steward-live-thinking inline-flex items-center gap-1.5 text-[10px] text-emerald-600 animate-fade-in">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Thinking
            <span className="steward-thinking-dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </span>
        )}
        {isStreaming && (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500 shadow-sm" title="Live activity heartbeat to show the model is still working.">
            Active {thinkingElapsedLabel}s
          </span>
        )}
        {isStreaming && (
          <span
            className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${thoughtStackActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500"}`}
            title={thoughtStackActive ? "ThoughtStack reliability layer is active for this response." : "ThoughtStack reliability layer is bypassed in Pure mode."}
          >
            ThoughtStack {thoughtStackActive ? "on" : "off"}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="pl-8">
        {isStreaming && (
          <StewardThinkingPanel
            progressSteps={msg.progressSteps ?? []}
            thinkingContent={msg.thinkingContent ?? ""}
            isActive={isStreaming}
            compact
            tone="light"
            activeTools={msg.activeTools ?? []}
            progressPercent={msg.progressPercent}
            progressStage={msg.progressStage}
          />
        )}
        {isStreaming && !msg.content ? (
          <span className="steward-stream-placeholder inline-flex items-center gap-1.5 text-slate-400">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-emerald-500" style={{ animationDelay: "300ms" }} />
          </span>
        ) : (
          <StewardResponseRenderer
            content={msg.content}
            structured={msg.structured}
            tone="light"
            renderMode={renderMode}
            toolsUsed={msg.toolsUsed}
            recordsUsed={msg.recordsUsed}
            provider={msg.provider}
            moduleKey={msg.moduleKey ?? undefined}
            generatedAt={msg.createdAt}
            onSuggestedAction={(action) => {
              const idx = msg.structured?.suggestedActions.findIndex(
                (a) => a.label === action.label && a.actionType === action.actionType
              ) ?? -1;
              if (idx >= 0) onRunAction(idx);
            }}
            onOpenReport={(path, label) => onOpenReport(path, label)}
            onAskReportQuestion={(prompt) => onAskReportQuestion(prompt)}
            onCopy={!isStreaming && (isLast || true) ? onCopy : undefined}
            onRegenerate={!isStreaming ? onRegenerate : undefined}
            onSaveTemplate={!isStreaming && canSaveAsTemplate ? onSaveTemplate : undefined}
            onSaveLetterDraft={!isStreaming && canSaveAsDraftLetter ? onSaveDraftLetter : undefined}
          />
        )}
      </div>
    </div>
  );
}

