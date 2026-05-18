/** Steward Signals page shell for donor analytics and AI-guided stewardship placeholders. */
"use client";

import Link from "next/link";
import { useState } from "react";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonFrame from "@/app/components/workspace-ribbon/WorkspaceRibbonFrame";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import OpportunityEnginePlaceholderTable from "@/app/components/steward/OpportunityEnginePlaceholderTable";
import OpportunityEngineCompactPanel from "@/app/components/steward/OpportunityEngineCompactPanel";
import StewardSignalsSummaryCards from "@/app/components/steward/StewardSignalsSummaryCards";
import StewardLapseRadarPanel from "@/app/components/steward/StewardLapseRadarPanel";
import StewardTaskSuggestionsTable from "@/app/components/steward/StewardTaskSuggestionsTable";
import DailyStewardThoughtCard from "@/app/components/steward/DailyStewardThoughtCard";
import GrowthIdeasPanel from "@/app/components/steward/GrowthIdeasPanel";
import StewardTodaysFocusPanel from "@/app/components/steward/StewardTodaysFocusPanel";
import StewardSignalsWorkspaceNav, { type StewardWorkspaceSection } from "@/app/components/steward/StewardSignalsWorkspaceNav";
import StewardDonorResearchWorkspace from "@/app/components/steward/StewardDonorResearchWorkspace";
import StewardSignalsAiSidePanel from "@/app/components/steward/StewardSignalsAiSidePanel";
import { apiFetch } from "@/app/lib/auth-client";

/**
 * StewardSignalsPage provides a UI-first foundation for:
 * - Generosity scoring
 * - Lapse Radar
 * - Opportunity Engine
 * - Steward AI recommendations
 *
 * The current version ships live summary and queue APIs while keeping AI actions
 * explicitly confirm-first and read-first for safe stewardship operations.
 */
export default function StewardSignalsPage() {
  const [activeSection, setActiveSection] = useState<StewardWorkspaceSection>("overview");
  const [analyzedAt, setAnalyzedAt] = useState<string | null>(null);
  const [rebuilding, setRebuilding] = useState(false);
  const [rebuildNotice, setRebuildNotice] = useState<string | null>(null);
  const [rebuildError, setRebuildError] = useState<string | null>(null);

  async function handleRecalculateSignals() {
    setRebuilding(true);
    setRebuildNotice(null);
    setRebuildError(null);

    try {
      const response = await apiFetch<{ data?: { reason?: string } }>("/api/steward-signals/index/rebuild", {
        method: "POST",
      });

      const reason = response?.data?.reason ?? "Signals rebuild completed.";
      setRebuildNotice(reason);
      window.dispatchEvent(new CustomEvent("steward-signals:analysis-rebuilt"));
    } catch (error) {
      setRebuildError(error instanceof Error ? error.message : "Failed to rebuild Steward Signals index.");
    } finally {
      setRebuilding(false);
    }
  }

  function renderSectionWorkspace() {
    if (activeSection === "overview") {
      return (
        <div className="space-y-6 lg:space-y-7">
          <section className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <DailyStewardThoughtCard />
            <GrowthIdeasPanel />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 lg:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">Opportunity Engine</h2>
              <span className="rounded-full border border-green-200 bg-green-50 px-2.5 py-0.5 text-[11px] font-medium text-green-700">
                Card-first Intelligence View
              </span>
            </div>
            <OpportunityEngineCompactPanel />
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-5 lg:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-gray-900">Suggested Action Board</h2>
              <span className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[11px] font-medium text-gray-700">
                Grouped by Stewardship Purpose
              </span>
            </div>
            <StewardTaskSuggestionsTable />
          </section>

          <StewardLapseRadarPanel />
        </div>
      );
    }

    if (activeSection === "opportunities") {
      return (
        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Opportunity Engine</h2>
          <OpportunityEnginePlaceholderTable />
        </section>
      );
    }

    if (activeSection === "lapse-radar") {
      return <StewardLapseRadarPanel />;
    }

    if (activeSection === "growth-ideas") {
      return <GrowthIdeasPanel />;
    }

    if (activeSection === "donor-research") {
      return <StewardDonorResearchWorkspace initialTool="ask" />;
    }

    if (activeSection === "cohort-builder") {
      return <StewardDonorResearchWorkspace initialTool="cohort" />;
    }

    if (activeSection === "suggested-actions") {
      return (
        <section className="rounded-xl border border-gray-200 bg-white p-5 lg:p-6">
          <h2 className="mb-4 text-base font-semibold text-gray-900">Suggested Action Board</h2>
          <StewardTaskSuggestionsTable />
        </section>
      );
    }

    return (
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 lg:p-6">
        <h2 className="text-base font-semibold text-gray-900">Steward Reports + Export</h2>
        <p className="text-sm text-gray-600">
          Save signal findings as reports, reviewed task batches, and communication planning inputs.
        </p>
        <div className="flex flex-wrap gap-2.5">
          <Link href="/reports" className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Create Report</Link>
          <Link href="/communications" className="rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">Create Communication Audience</Link>
          <Link href="/tasks" className="rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-100">Create Follow-Up Tasks</Link>
          <Link href="/letters-printables" className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100">Draft Letter</Link>
        </div>
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Save analyses as reports, draft outreach, and follow-up tasks directly from this workspace.
        </p>
      </section>
    );
  }

  return (
    <WorkspaceRibbonFrame
      title="Steward Signals Dashboard"
      description="Donor intelligence command center for understanding donor behavior, prioritizing follow-up, and taking review-first stewardship actions."
      breadcrumbItems={[
        { label: "Donor CRM", href: "/" },
        { label: "Steward Signals", href: "/steward-signals" },
        { label: "Dashboard" },
      ]}
      statusLabel="Working"
      metadata={analyzedAt ? `Last analyzed ${new Date(analyzedAt).toLocaleString()}` : "Live donor signals"}
      primaryAction={(
        <button
          type="button"
          onClick={() => void handleRecalculateSignals()}
          disabled={rebuilding}
          className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {rebuilding ? "Recalculating..." : "Recalculate Signals"}
        </button>
      )}
      ribbon={(
        <WorkspaceRibbon>
          <WorkspaceRibbonGroup label="Workspace">
            <WorkspaceRibbonButton label="Overview" onClick={() => setActiveSection("overview")} active={activeSection === "overview"} />
            <WorkspaceRibbonButton label="Opportunities" onClick={() => setActiveSection("opportunities")} active={activeSection === "opportunities"} />
            <WorkspaceRibbonButton label="Lapse Radar" onClick={() => setActiveSection("lapse-radar")} active={activeSection === "lapse-radar"} />
            <WorkspaceRibbonButton label="Growth Ideas" onClick={() => setActiveSection("growth-ideas")} active={activeSection === "growth-ideas"} />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Research">
            <WorkspaceRibbonButton label="Ask Steward" onClick={() => setActiveSection("donor-research")} active={activeSection === "donor-research"} />
            <WorkspaceRibbonButton label="Cohort Builder" onClick={() => setActiveSection("cohort-builder")} active={activeSection === "cohort-builder"} />
            <WorkspaceRibbonButton label="Suggested Actions" onClick={() => setActiveSection("suggested-actions")} active={activeSection === "suggested-actions"} />
            <WorkspaceRibbonButton label="Reports" onClick={() => setActiveSection("reports")} active={activeSection === "reports"} />
          </WorkspaceRibbonGroup>

          <WorkspaceRibbonGroup label="Actions">
            <WorkspaceRibbonButton label="Create Report" href="/reports" />
            <WorkspaceRibbonButton label="Draft Email" href="/steward-signals/email-draft-studio" accentTone="blue" />
            <WorkspaceRibbonButton label="Open Steward Paths" href="/steward-paths" />
          </WorkspaceRibbonGroup>
        </WorkspaceRibbon>
      )}
    >
      <div className="min-w-0 max-w-full space-y-6 lg:space-y-7">
        {rebuildNotice && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm text-green-700">
            {rebuildNotice}
          </div>
        )}

        {rebuildError && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {rebuildError}
          </div>
        )}

        <StewardTodaysFocusPanel onAnalyzedAtChange={setAnalyzedAt} />
        <StewardSignalsSummaryCards onSummaryLoaded={(summary) => setAnalyzedAt(summary.updatedAt)} />

        <StewardSignalsWorkspaceNav activeSection={activeSection} onChange={setActiveSection} />

        <section className="grid grid-cols-1 gap-6 lg:gap-7 2xl:grid-cols-[minmax(0,1fr),340px]">
          <div className="min-w-0">
            {renderSectionWorkspace()}
          </div>

          <div className="min-w-0">
            <StewardSignalsAiSidePanel analyzedAt={analyzedAt} />
          </div>
        </section>
      </div>
    </WorkspaceRibbonFrame>
  );
}
