/** Donor Research + Cohort Builder workspace for Steward analysis flows. */
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { StewardResearchResponse } from "@/app/components/steward/steward-signals-types";

type ResearchTool = "ask" | "cohort" | "explorer";

interface StewardDonorResearchWorkspaceProps {
  initialTool?: ResearchTool;
}

interface CohortFilterState {
  recencyMaxDays: string;
  frequencyMin: string;
  lifetimeGivingMin: string;
  largestGiftMin: string;
  avgGiftMin: string;
  monthlyGivingLikelihoodMin: string;
  campaignResponsiveOnly: boolean;
  eventResponsiveOnly: boolean;
  thankYouPendingOnly: boolean;
  lapseRiskIn: Array<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL">;
}

const QUICK_PROMPTS = [
  "Which donors gave last year but not this year?",
  "Who might be ready for monthly giving?",
  "Which donors gave to events but never gave again?",
  "Which donors should get a handwritten thank-you?",
  "Find donors with rising generosity over the last 18 months.",
  "Show high-value donors with low engagement.",
];

/**
 * StewardDonorResearchWorkspace enables prompt-based donor analysis, visual cohort filtering,
 * and transparent signal explorer views with review-first outputs.
 */
export default function StewardDonorResearchWorkspace({ initialTool = "ask" }: StewardDonorResearchWorkspaceProps) {
  const [activeTool, setActiveTool] = useState<ResearchTool>(initialTool);
  const [question, setQuestion] = useState("");
  const [result, setResult] = useState<StewardResearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [filters, setFilters] = useState<CohortFilterState>({
    recencyMaxDays: "365",
    frequencyMin: "1",
    lifetimeGivingMin: "0",
    largestGiftMin: "0",
    avgGiftMin: "0",
    monthlyGivingLikelihoodMin: "50",
    campaignResponsiveOnly: false,
    eventResponsiveOnly: false,
    thankYouPendingOnly: false,
    lapseRiskIn: ["HIGH", "CRITICAL"],
  });

  async function runAsk(rawQuestion?: string) {
    const nextQuestion = (rawQuestion ?? question).trim();
    if (!nextQuestion) return;

    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch<StewardResearchResponse>("/api/steward-signals/research", {
        method: "POST",
        body: JSON.stringify({
          mode: "research",
          query: nextQuestion,
          limit: 30,
        }),
      });
      setQuestion(nextQuestion);
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Research request failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runCohortBuilder() {
    setLoading(true);
    setError(null);
    setNotice(null);

    try {
      const response = await apiFetch<StewardResearchResponse>("/api/steward-signals/research", {
        method: "POST",
        body: JSON.stringify({
          mode: "cohort",
          preset: "general-opportunity-scan",
          query: "Cohort Builder",
          limit: 40,
          filters: {
            recencyMaxDays: Number.parseInt(filters.recencyMaxDays, 10),
            frequencyMin: Number.parseInt(filters.frequencyMin, 10),
            lifetimeGivingMin: Number.parseInt(filters.lifetimeGivingMin, 10),
            largestGiftMin: Number.parseInt(filters.largestGiftMin, 10),
            avgGiftMin: Number.parseInt(filters.avgGiftMin, 10),
            monthlyGivingLikelihoodMin: Number.parseInt(filters.monthlyGivingLikelihoodMin, 10),
            campaignResponsiveOnly: filters.campaignResponsiveOnly,
            eventResponsiveOnly: filters.eventResponsiveOnly,
            thankYouPendingOnly: filters.thankYouPendingOnly,
            lapseRiskIn: filters.lapseRiskIn,
          },
        }),
      });
      setResult(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Cohort builder failed.");
    } finally {
      setLoading(false);
    }
  }

  const explorerRows = useMemo(() => {
    if (!result) return [];
    return [
      { label: "Recency", value: `${Math.round(result.donors.reduce((sum, donor) => sum + donor.recencyDays, 0) / Math.max(1, result.donors.length))} days avg` },
      { label: "Frequency", value: `${Math.round(result.donors.reduce((sum, donor) => sum + donor.giftCount, 0) / Math.max(1, result.donors.length))} gifts avg` },
      { label: "Lifetime Giving", value: `$${Math.round(result.donors.reduce((sum, donor) => sum + donor.totalLifetimeGiving, 0) / Math.max(1, result.donors.length)).toLocaleString()}` },
      { label: "Largest Gift", value: `$${Math.round(result.donors.reduce((sum, donor) => sum + donor.largestGift, 0) / Math.max(1, result.donors.length)).toLocaleString()}` },
      { label: "Campaign Response", value: `${Math.round(result.donors.reduce((sum, donor) => sum + donor.campaignResponses, 0) / Math.max(1, result.donors.length))} avg` },
      { label: "Communication Engagement", value: `${Math.round(result.donors.reduce((sum, donor) => sum + donor.communicationEngagementScore, 0) / Math.max(1, result.donors.length))}/100` },
      { label: "Lapse Risk", value: `${result.chart.lapseDistribution.map((entry) => `${entry.label}:${entry.value}`).join(" · ")}` },
      { label: "Upgrade Potential", value: `${Math.round(result.donors.reduce((sum, donor) => sum + donor.upgradeLikelihood, 0) / Math.max(1, result.donors.length))}/100` },
      { label: "Monthly Giving Likelihood", value: `${Math.round(result.donors.reduce((sum, donor) => sum + donor.monthlyGivingLikelihood, 0) / Math.max(1, result.donors.length))}/100` },
    ];
  }, [result]);

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Donor Research + Cohort Builder</h3>
          <p className="text-xs text-gray-500 mt-0.5">Research donor patterns, define cohorts, and move insights to reviewed actions.</p>
        </div>
        <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
          <button
            type="button"
            onClick={() => setActiveTool("ask")}
            className={`rounded px-2.5 py-1 text-xs font-medium ${activeTool === "ask" ? "bg-white text-green-700" : "text-gray-600"}`}
          >
            Ask About Donors
          </button>
          <button
            type="button"
            onClick={() => setActiveTool("cohort")}
            className={`rounded px-2.5 py-1 text-xs font-medium ${activeTool === "cohort" ? "bg-white text-green-700" : "text-gray-600"}`}
          >
            Cohort Builder
          </button>
          <button
            type="button"
            onClick={() => setActiveTool("explorer")}
            className={`rounded px-2.5 py-1 text-xs font-medium ${activeTool === "explorer" ? "bg-white text-green-700" : "text-gray-600"}`}
          >
            Signal Explorer
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}
      {notice && <p className="text-xs text-amber-700">{notice}</p>}

      {activeTool === "ask" && (
        <div className="space-y-3">
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ask About Donors</label>
            <div className="mt-2 flex gap-2">
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Which donors gave last year but not this year?"
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void runAsk()}
                disabled={loading}
                className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
              >
                {loading ? "Analyzing..." : "Run Analysis"}
              </button>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            {QUICK_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void runAsk(prompt)}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      )}

      {activeTool === "cohort" && (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            <FilterInput label="Recency <= days" value={filters.recencyMaxDays} onChange={(value) => setFilters((current) => ({ ...current, recencyMaxDays: value }))} />
            <FilterInput label="Frequency >= gifts" value={filters.frequencyMin} onChange={(value) => setFilters((current) => ({ ...current, frequencyMin: value }))} />
            <FilterInput label="Lifetime giving >=" value={filters.lifetimeGivingMin} onChange={(value) => setFilters((current) => ({ ...current, lifetimeGivingMin: value }))} />
            <FilterInput label="Largest gift >=" value={filters.largestGiftMin} onChange={(value) => setFilters((current) => ({ ...current, largestGiftMin: value }))} />
            <FilterInput label="Average gift >=" value={filters.avgGiftMin} onChange={(value) => setFilters((current) => ({ ...current, avgGiftMin: value }))} />
            <FilterInput label="Monthly likelihood >=" value={filters.monthlyGivingLikelihoodMin} onChange={(value) => setFilters((current) => ({ ...current, monthlyGivingLikelihoodMin: value }))} />
          </div>

          <div className="grid gap-2 sm:grid-cols-3">
            <ToggleChip label="Campaign Responsive" checked={filters.campaignResponsiveOnly} onChange={(checked) => setFilters((current) => ({ ...current, campaignResponsiveOnly: checked }))} />
            <ToggleChip label="Event Responsive" checked={filters.eventResponsiveOnly} onChange={(checked) => setFilters((current) => ({ ...current, eventResponsiveOnly: checked }))} />
            <ToggleChip label="Thank-You Pending" checked={filters.thankYouPendingOnly} onChange={(checked) => setFilters((current) => ({ ...current, thankYouPendingOnly: checked }))} />
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lapse Risk Filter</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {(["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const).map((risk) => (
                <button
                  key={risk}
                  type="button"
                  onClick={() => {
                    setFilters((current) => ({
                      ...current,
                      lapseRiskIn: current.lapseRiskIn.includes(risk)
                        ? current.lapseRiskIn.filter((item) => item !== risk)
                        : [...current.lapseRiskIn, risk],
                    }));
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${filters.lapseRiskIn.includes(risk) ? "border-green-200 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-700"}`}
                >
                  {risk}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => void runCohortBuilder()}
            disabled={loading}
            className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
          >
            {loading ? "Building Cohort..." : "Build Cohort"}
          </button>
        </div>
      )}

      {activeTool === "explorer" && (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {explorerRows.length === 0 ? (
            <p className="text-xs text-gray-500">Run Ask or Cohort Builder first to explore signal details.</p>
          ) : (
            explorerRows.map((entry) => (
              <div key={entry.label} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{entry.label}</p>
                <p className="mt-1 text-sm font-semibold text-gray-900">{entry.value}</p>
              </div>
            ))
          )}
        </div>
      )}

      {result && (
        <article className="space-y-3 rounded-xl border border-green-200 bg-green-50/40 p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Research Output</p>
              <p className="text-sm font-semibold text-gray-900 mt-1">{result.summary}</p>
              <p className="text-xs text-gray-600 mt-1">Confidence {result.confidence}% · {result.reasoning}</p>
            </div>
            <p className="text-xs text-gray-500">Analyzed {new Date(result.analyzedAt).toLocaleString()}</p>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Lapse Distribution</p>
              <div className="mt-2 space-y-1.5">
                {result.chart.lapseDistribution.map((entry) => (
                  <div key={entry.label}>
                    <div className="flex items-center justify-between text-xs text-gray-600">
                      <span>{entry.label}</span>
                      <span>{entry.value}</span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-200">
                      <div className="h-2 rounded-full bg-green-500" style={{ width: `${Math.max(5, Math.min(100, entry.value * 4))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Opportunity Bands</p>
              <div className="mt-2 space-y-1.5">
                {result.chart.opportunityBands.map((entry) => (
                  <div key={entry.label} className="flex items-center justify-between rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-gray-700">
                    <span>{entry.label}</span>
                    <span>{entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid gap-2 lg:grid-cols-2">
            {result.suggestedActions.map((action) => (
              <div key={action} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                {action}
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setNotice("Save Segment workflow is in development. Use Constituents filters as a temporary segment workflow.")}
                className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Save as Segment
              </button>
              <Link href="/reports" className="rounded-md border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50">Create Report</Link>
              <Link href="/communications" className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100">Draft Email</Link>
              <Link href="/tasks" className="rounded-md border border-green-200 bg-green-50 px-2.5 py-1 text-xs font-medium text-green-700 hover:bg-green-100">Create Tasks</Link>
            </div>

            <div className="grid gap-1">
              {result.donors.slice(0, 12).map((donor) => (
                <div key={donor.constituentId} className="rounded-md border border-gray-200 bg-white px-3 py-2 text-xs text-gray-700">
                  <p className="font-semibold text-gray-900">{donor.donorName}</p>
                  <p className="mt-0.5">{donor.why}</p>
                  <p className="mt-0.5 text-gray-500">Lifetime ${Math.round(donor.totalLifetimeGiving).toLocaleString()} · Lapse {donor.lapseRisk} · Opportunity {donor.opportunityScore}</p>
                </div>
              ))}
            </div>
          </div>

          {result.inDevelopmentNote && <p className="text-[11px] text-amber-700">{result.inDevelopmentNote}</p>}
        </article>
      )}
    </section>
  );
}

interface FilterInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
}

/** FilterInput standardizes compact numeric cohort filter controls. */
function FilterInput({ label, value, onChange }: FilterInputProps) {
  return (
    <label className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
      <span className="font-semibold uppercase tracking-wide">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded border border-gray-300 bg-white px-2 py-1 text-sm text-gray-800"
      />
    </label>
  );
}

interface ToggleChipProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** ToggleChip keeps cohort boolean filters compact and consistent. */
function ToggleChip({ label, checked, onChange }: ToggleChipProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`rounded-lg border px-3 py-2 text-xs font-medium ${checked ? "border-green-200 bg-green-50 text-green-700" : "border-gray-300 bg-white text-gray-700"}`}
    >
      {label}
    </button>
  );
}
