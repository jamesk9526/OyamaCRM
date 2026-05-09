/** Steward Signals page shell for donor analytics and AI-guided stewardship placeholders. */
"use client";

import Link from "next/link";
import OpportunityEnginePlaceholderTable from "@/app/components/steward/OpportunityEnginePlaceholderTable";
import StewardSignalsSummaryCards from "@/app/components/steward/StewardSignalsSummaryCards";
import StewardLapseRadarPanel from "@/app/components/steward/StewardLapseRadarPanel";

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
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Steward Signals</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Donor stewardship intelligence powered by explainable signals, not black-box scoring.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 transition-colors">
            Recalculate Signals
          </button>
          <Link
            href="/automations"
            className="px-3 py-2 text-sm font-semibold rounded-lg bg-green-600 text-white hover:bg-green-700 transition-colors"
          >
            Open Steward Paths
          </Link>
        </div>
      </header>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-semibold text-amber-900">In Development Notice</p>
        <p className="text-xs text-amber-800 mt-1 leading-relaxed">
          Steward Signals now reads live summary and opportunity queue data. AI-assisted write actions remain guarded
          by explicit confirmation before any task creation, draft generation, or dismissal state change.
        </p>
      </div>

      <StewardSignalsSummaryCards />

      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Opportunity Engine</h2>
          <span className="text-xs px-2 py-1 rounded-full bg-green-50 text-green-700 border border-green-200">
            Live Queue
          </span>
        </div>
        <p className="text-sm text-gray-500">
          The Opportunity Engine will recommend the right donor follow-up, channel, and timing based on giving signals,
          engagement patterns, unresolved stewardship tasks, and custom donor signal fields where configured.
        </p>

        <OpportunityEnginePlaceholderTable />
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <StewardLapseRadarPanel />

        <article className="bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-sm font-semibold text-gray-900">Steward AI Feature Notes</h3>
          <ul className="mt-3 space-y-2 text-sm text-gray-600">
            <li>Ask Mode: explain donor score changes and recent signal events in plain language.</li>
            <li>Analyze Mode: summarize at-risk, lapsing, and high-opportunity donor cohorts.</li>
            <li>Draft Mode: draft thank-you emails, reconnect letters, and follow-up scripts.</li>
            <li>Action Mode: generate task/email drafts only after explicit staff confirmation.</li>
          </ul>
        </article>

        <article className="bg-white rounded-xl border border-gray-200 p-4 lg:col-span-2">
          <h3 className="text-sm font-semibold text-gray-900">Planned Donor Profile Widget</h3>
          <p className="text-sm text-gray-500 mt-2">
            The donor profile now includes a read-only Steward Signals widget shell with a live API contract.
            Next phase will add richer signal drill-down and inline workflow orchestration.
          </p>
          <div className="mt-3 text-xs text-gray-500 rounded-lg border border-gray-200 bg-gray-50 p-3">
            UI Note: Widget remains read-only until score recalculation + guarded action orchestration are finalized.
          </div>
        </article>
      </section>
    </div>
  );
}
