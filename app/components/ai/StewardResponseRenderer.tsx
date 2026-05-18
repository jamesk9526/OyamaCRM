/**
 * StewardResponseRenderer — renders a Steward AI assistant message cleanly.
 * Main message: markdown answer + artifact cards only.
 * Metadata (tools, records, evidence, confidence) hidden in "About this answer" panel.
 * Action bar: Copy, Regenerate, About, contextual suggested-action buttons.
 */
"use client";

import { useState, useCallback } from "react";
import StewardMessageRenderer from "@/app/components/ai/StewardMessageRenderer";
import EmailDraftArtifactCard from "@/app/components/ai/artifacts/EmailDraftArtifactCard";
import EnhancedDonorListArtifactCard from "@/app/components/ai/artifacts/EnhancedDonorListArtifactCard";
import ReportSummaryArtifactCard from "@/app/components/ai/artifacts/ReportSummaryArtifactCard";
import TaskListArtifactCard from "@/app/components/ai/artifacts/TaskListArtifactCard";
import CallScriptArtifactCard from "@/app/components/ai/artifacts/CallScriptArtifactCard";
import CsvRowsArtifactCard from "@/app/components/ai/artifacts/CsvRowsArtifactCard";
import ReportCardArtifactCard from "@/app/components/ai/artifacts/ReportCardArtifactCard";
import EnhancedChartArtifactCard from "@/app/components/ai/artifacts/EnhancedChartArtifactCard";
import type {
  StewardArtifact,
  StewardStructuredResponse,
  StewardSuggestedAction,
} from "@/app/components/ai/steward-artifact-types";

// ─── Human-readable tool name map ─────────────────────────────────────────────
const TOOL_LABELS: Record<string, string> = {
  "donor.getDailyBrief": "Daily donor brief",
  "donor.getThankYousNeeded": "Thank-you queue",
  "donor.getLapseRisks": "Lapse risk analysis",
  "donor.getTopOpportunities": "Top donor opportunities",
  "donor.getProfileDecisionPacket": "Donor decision packet",
  "donor.getFullProfile": "Full donor profile",
  "donor.getDonationHistory": "Donation history",
  "donor.getGiftSummaryByYear": "Gift summary by year",
  "campaigns.listActive": "Active campaigns",
  "tasks.listOverdue": "Overdue tasks",
  "reports.getOShareviewDonorSummary": "OShareview board summary",
  "reports.runSummary": "KPI summary report",
  "reports.runGivingByMonth": "Monthly giving breakdown",
  "reports.runDonorRetention": "Donor retention report",
  "reports.runLybunt": "LYBUNT re-engagement list",
  "reports.runGivingByDesignation": "Giving by designation/fund",
  "reports.runGivingByCampaign": "Giving by campaign",
  "reports.runDonorTiers": "Donor tier breakdown",
  "reports.runNewDonors": "New donor acquisition",
  "reports.runYearOverYear": "Year-over-year comparison",
  "reports.runChartData": "Giving chart data",
  "knowledge.searchCrmRecords": "CRM record search",
  "knowledge.searchDonorActivities": "Donor activity search",
  "knowledge.getDonorsBySegment": "Segment donor filter",
  "knowledge.searchGrants": "Grant record search",
  "agentic.plan": "Multi-stage planning",
  "agentic.reason": "AI reasoning pass",
  "fiscal.context": "Fiscal year context",
  "tasks.createFollowUpTask": "Create follow-up task",
  "communications.createEmailDraft": "Create email draft",
};

const MODULE_LABELS: Record<string, string> = {
  donor: "Donor CRM",
  compassion: "Compassion CRM",
  events: "Events CRM",
  hrm: "HRM",
  webmaster: "Webmaster",
  watchdog: "Watchdog",
  oshareview: "OShareview",
  all: "All CRM Data",
};

function friendlyToolName(raw: string): string {
  return TOOL_LABELS[raw] ?? raw.replace(/\./g, " › ").replace(/_/g, " ");
}

function friendlyModuleName(raw?: string): string {
  if (!raw) return "Donor CRM";
  return MODULE_LABELS[raw] ?? raw;
}

// ─── Props ─────────────────────────────────────────────────────────────────────
interface StewardResponseRendererProps {
  content: string;
  structured?: StewardStructuredResponse;
  tone?: "dark" | "light";
  renderMode?: "markdown" | "html";
  /** Compact layout for docked panel */
  compact?: boolean;
  /** Metadata for About this answer panel */
  toolsUsed?: string[];
  recordsUsed?: string[];
  provider?: string;
  moduleKey?: string;
  generatedAt?: string;
  /** Callbacks */
  onSuggestedAction?: (action: StewardSuggestedAction) => void | Promise<void>;
  onCopy?: () => void;
  onRegenerate?: () => void;
}

// ─── Artifact card dispatcher ─────────────────────────────────────────────────
function renderArtifact(artifact: StewardArtifact): React.ReactElement | null {
  if (artifact.type === "email_draft") return <EmailDraftArtifactCard artifact={artifact} />;
  if (artifact.type === "donor_list") return <EnhancedDonorListArtifactCard artifact={artifact} />;
  if (artifact.type === "report_summary") return <ReportSummaryArtifactCard artifact={artifact} />;
  if (artifact.type === "task_list") return <TaskListArtifactCard artifact={artifact} />;
  if (artifact.type === "call_script") return <CallScriptArtifactCard artifact={artifact} />;
  if (artifact.type === "csv_rows") return <CsvRowsArtifactCard artifact={artifact} />;
  if (artifact.type === "report_card") return <ReportCardArtifactCard artifact={artifact} />;
  if (artifact.type === "chart") return <EnhancedChartArtifactCard artifact={artifact} />;
  return null;
}

// ─── About this answer panel ──────────────────────────────────────────────────
function AboutPanel({
  toolsUsed,
  recordsUsed,
  provider,
  moduleKey,
  generatedAt,
  evidence,
}: {
  toolsUsed?: string[];
  recordsUsed?: string[];
  provider?: string;
  moduleKey?: string;
  generatedAt?: string;
  evidence?: Array<{ label: string; detail?: string }>;
}) {
  const displayTools = (toolsUsed ?? []).filter((t) => t !== "fiscal.context");
  const dataSource = provider === "crm-data"
    ? "Live CRM data (deterministic)"
    : provider === "ollama-agentic"
      ? "Live CRM data + AI reasoning (agentic)"
      : provider === "ollama"
        ? "Live CRM data + AI model"
        : "CRM assistant";

  const timeLabel = generatedAt
    ? new Date(generatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="mt-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600 space-y-1.5">
      <p className="font-semibold text-slate-700 text-[11px] uppercase tracking-wide">About this answer</p>

      <div className="grid grid-cols-[max-content,1fr] gap-x-3 gap-y-1">
        <span className="text-slate-400 font-medium">CRM module</span>
        <span>{friendlyModuleName(moduleKey)}</span>

        <span className="text-slate-400 font-medium">Data source</span>
        <span>{dataSource}</span>

        {displayTools.length > 0 && (
          <>
            <span className="text-slate-400 font-medium">Data used</span>
            <span className="flex flex-wrap gap-1">
              {displayTools.map((t) => (
                <span key={t} className="rounded-full border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-500">
                  {friendlyToolName(t)}
                </span>
              ))}
            </span>
          </>
        )}

        {recordsUsed && recordsUsed.length > 0 && (
          <>
            <span className="text-slate-400 font-medium">Records referenced</span>
            <span>{recordsUsed.length} record{recordsUsed.length !== 1 ? "s" : ""}</span>
          </>
        )}

        {evidence && evidence.length > 0 && (
          <>
            <span className="text-slate-400 font-medium">Evidence items</span>
            <ul className="space-y-0.5 text-slate-500">
              {evidence.slice(0, 8).map((item, i) => (
                <li key={i} className="truncate max-w-[260px]">
                  {item.label}{item.detail ? ` — ${item.detail}` : ""}
                </li>
              ))}
            </ul>
          </>
        )}

        {timeLabel && (
          <>
            <span className="text-slate-400 font-medium">Generated at</span>
            <span>{timeLabel}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Suggested action pill buttons ───────────────────────────────────────────
function SuggestedActionPills({
  actions,
  onSuggestedAction,
  compact,
}: {
  actions: StewardSuggestedAction[];
  onSuggestedAction?: (action: StewardSuggestedAction) => void | Promise<void>;
  compact?: boolean;
}) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? "mt-1.5" : "mt-2"}`}>
      {actions.map((action, i) => (
        <button
          key={`${action.actionType}-${i}`}
          type="button"
          onClick={() => void onSuggestedAction?.(action)}
          className={`inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:border-emerald-300 hover:bg-emerald-100 transition-colors ${action.requiresConfirmation ? "italic" : ""}`}
          title={action.requiresConfirmation ? "Requires confirmation" : undefined}
        >
          {action.label}
          {action.requiresConfirmation && (
            <svg className="h-2.5 w-2.5 opacity-60" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Action bar ───────────────────────────────────────────────────────────────
function ActionBar({
  onCopy,
  onRegenerate,
  onAbout,
  aboutOpen,
  compact,
}: {
  onCopy?: () => void;
  onRegenerate?: () => void;
  onAbout: () => void;
  aboutOpen: boolean;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy?.();
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  const btnClass = compact
    ? "flex items-center gap-1 rounded-lg px-1.5 py-0.5 text-[10px] text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
    : "flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors";

  return (
    <div className={`flex items-center gap-0.5 ${compact ? "mt-1" : "mt-2"}`}>
      {onCopy && (
        <button type="button" onClick={handleCopy} className={btnClass} title="Copy answer">
          {copied ? (
            <svg className="h-3 w-3 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <rect x="9" y="9" width="13" height="13" rx="2" />
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
            </svg>
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      )}

      {onRegenerate && (
        <button type="button" onClick={onRegenerate} className={btnClass} title="Regenerate">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582M20 20v-5h-.582M4.582 9A8 8 0 0118 8.5M19.418 15A8 8 0 016 15.5" />
          </svg>
          Regenerate
        </button>
      )}

      <button
        type="button"
        onClick={onAbout}
        className={`${btnClass} ${aboutOpen ? "text-slate-700 bg-slate-100" : ""}`}
        title="About this answer"
      >
        <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <circle cx="12" cy="12" r="10" />
          <path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
        </svg>
        About
      </button>
    </div>
  );
}

// ─── Main renderer ────────────────────────────────────────────────────────────
export default function StewardResponseRenderer({
  content,
  structured,
  tone = "light",
  renderMode = "markdown",
  compact = false,
  toolsUsed,
  recordsUsed,
  provider,
  moduleKey,
  generatedAt,
  onSuggestedAction,
  onCopy,
  onRegenerate,
}: StewardResponseRendererProps) {
  const [aboutOpen, setAboutOpen] = useState(false);

  const handleAbout = useCallback(() => setAboutOpen((v) => !v), []);

  const hasArtifacts = Boolean(structured?.artifacts?.length);
  const hasSuggestedActions = Boolean(structured?.suggestedActions?.length);
  const hasMetadata = Boolean(
    (toolsUsed?.length) || (recordsUsed?.length) || provider || moduleKey
  );
  const markdown = structured?.replyMarkdown?.trim().length ? structured.replyMarkdown : content;

  return (
    <div className="space-y-0">
      {/* Artifact cards above the text */}
      {hasArtifacts && (
        <div className={`space-y-2 ${compact ? "mb-2" : "mb-3"}`}>
          {(structured?.artifacts ?? []).map((artifact, i) => (
            <div key={`${artifact.type}-${i}`}>{renderArtifact(artifact)}</div>
          ))}
        </div>
      )}

      {/* Main answer text */}
      <StewardMessageRenderer content={markdown} tone={tone} renderMode={renderMode} />

      {/* Parse warning (rare) */}
      {structured?.parseWarning && (
        <p className="mt-1 text-[10px] text-amber-600 italic">{structured.parseWarning}</p>
      )}

      {/* Suggested action pills */}
      {hasSuggestedActions && (
        <SuggestedActionPills
          actions={structured?.suggestedActions ?? []}
          onSuggestedAction={onSuggestedAction}
          compact={compact}
        />
      )}

      {/* Action bar */}
      {(onCopy || onRegenerate || hasMetadata) && (
        <ActionBar
          onCopy={onCopy}
          onRegenerate={onRegenerate}
          onAbout={handleAbout}
          aboutOpen={aboutOpen}
          compact={compact}
        />
      )}

      {/* About this answer panel */}
      {aboutOpen && hasMetadata && (
        <AboutPanel
          toolsUsed={toolsUsed}
          recordsUsed={recordsUsed}
          provider={provider}
          moduleKey={moduleKey}
          generatedAt={generatedAt}
          evidence={structured?.evidence}
        />
      )}
    </div>
  );
}
