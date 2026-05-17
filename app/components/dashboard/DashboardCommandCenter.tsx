/**
 * DashboardCommandCenter renders a high-signal dashboard hero with quick-launch tools,
 * a next-best-action card, and compact fundraising health metrics for donor staff.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import StatCard from "@/app/components/dashboard/StatCard";
import { apiFetch } from "@/app/lib/auth-client";

interface DashboardCommandCenterProps {
  greeting: string;
  name: string;
  loading: boolean;
  dataThroughLabel: string;
  ytdAmount: number;
  monthAmount: number;
  revenueGoal: number;
  retentionRate: number;
  pendingTasks: number;
  overdueTasks: number;
  activeCampaigns: number;
  newDonorsThisMonth: number;
  monthTrend: number | null;
  reportingYearMode: "calendar" | "fiscal";
}

interface QuickTool {
  title: string;
  description: string;
  href: string;
}

interface PriorityAction {
  eyebrow: string;
  title: string;
  description: string;
  href: string;
  cta: string;
  toneClassName: string;
  actionType?: "DRAFT_THANK_YOU_NEW_DONORS";
}

interface NextMoveDraftResponse {
  message: string;
  counts: {
    cohort: number;
    emailable: number;
    lettersNeeded: number;
    suppressed: number;
    generatedLetters?: number;
  };
  communications?: {
    campaignId: string;
    recipientListId: string | null;
    redirectTo: string | null;
  } | null;
  letters?: {
    templateId: string;
    generatedCount: number;
    redirectTo: string | null;
  } | null;
  warnings?: {
    lettersPermissionMissing?: boolean;
  };
}

const QUICK_TOOLS: QuickTool[] = [
  {
    title: "Log a gift",
    description: "Capture a donation and keep revenue current.",
    href: "/donations/new",
  },
  {
    title: "Review tasks",
    description: "Clear follow-ups and steward work queues.",
    href: "/tasks",
  },
  {
    title: "Thank donors",
    description: "Open letters and acknowledgements quickly.",
    href: "/letters-printables/generate",
  },
  {
    title: "Campaigns",
    description: "Check active fundraising initiatives.",
    href: "/campaigns",
  },
  {
    title: "Steward signals",
    description: "See donor risks and recommended next steps.",
    href: "/steward-signals",
  },
  {
    title: "Reports",
    description: "Open donor reporting and trend views.",
    href: "/reports/donor-crm",
  },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function getPriorityAction(params: {
  overdueTasks: number;
  pendingTasks: number;
  newDonorsThisMonth: number;
  activeCampaigns: number;
  revenuePercent: number;
}): PriorityAction {
  const { overdueTasks, pendingTasks, newDonorsThisMonth, activeCampaigns, revenuePercent } = params;

  // Prioritize the one action most likely to unblock staff work right now.
  if (overdueTasks > 0) {
    return {
      eyebrow: "Needs attention",
      title: `Clear ${overdueTasks} overdue follow-up${overdueTasks === 1 ? "" : "s"}`,
      description: "Overdue donor work should be resolved before adding more activity to the queue.",
      href: "/tasks",
      cta: "Open Tasks",
      toneClassName: "border-amber-200 bg-amber-50 text-amber-900",
    };
  }

  if (newDonorsThisMonth > 0) {
    return {
      eyebrow: "Best next move",
      title: `Welcome ${newDonorsThisMonth} new donor${newDonorsThisMonth === 1 ? "" : "s"}`,
      description: "Recent donors are the highest-value stewardship opportunity on the board right now.",
      href: "/letters-printables/generate",
      cta: "Draft Thank-You",
      toneClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
      actionType: "DRAFT_THANK_YOU_NEW_DONORS",
    };
  }

  if (activeCampaigns > 0 && revenuePercent < 60) {
    return {
      eyebrow: "Pipeline watch",
      title: "Boost campaign momentum",
      description: "Active campaigns are open, but pace is still behind target. Review asks, follow-ups, and appeals.",
      href: "/campaigns",
      cta: "Open Campaigns",
      toneClassName: "border-sky-200 bg-sky-50 text-sky-900",
    };
  }

  if (pendingTasks > 0) {
    return {
      eyebrow: "Queue ready",
      title: `Work ${pendingTasks} open task${pendingTasks === 1 ? "" : "s"}`,
      description: "Nothing is overdue, so this is a good time to move the next donor actions forward.",
      href: "/tasks",
      cta: "Work Queue",
      toneClassName: "border-slate-200 bg-slate-50 text-slate-900",
    };
  }

  return {
    eyebrow: "Growth lane",
    title: "Review steward signals",
    description: "The queue is relatively clear. Use donor signals and reports to choose the next growth move.",
    href: "/steward-signals",
    cta: "Open Signals",
    toneClassName: "border-emerald-200 bg-emerald-50 text-emerald-900",
  };
}

function getPaceLabel(revenuePercent: number): string {
  if (revenuePercent >= 90) return "Ahead of target";
  if (revenuePercent >= 65) return "Healthy pace";
  if (revenuePercent >= 40) return "Building momentum";
  return "Needs lift";
}

function QuickToolLink({ tool }: { tool: QuickTool }) {
  return (
    <Link
      href={tool.href}
      className="group rounded-2xl border border-slate-200 bg-white px-3 py-3 transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/70 hover:shadow-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-900">{tool.title}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{tool.description}</p>
        </div>
        <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500 transition-colors group-hover:border-emerald-200 group-hover:bg-emerald-100 group-hover:text-emerald-700">
          Open
        </span>
      </div>
    </Link>
  );
}

/**
 * Presents a compact command layer above the dashboard widgets so staff can orient,
 * assess urgency, and jump directly into the right donor workflow.
 */
export default function DashboardCommandCenter({
  greeting,
  name,
  loading,
  dataThroughLabel,
  ytdAmount,
  monthAmount,
  revenueGoal,
  retentionRate,
  pendingTasks,
  overdueTasks,
  activeCampaigns,
  newDonorsThisMonth,
  monthTrend,
  reportingYearMode,
}: DashboardCommandCenterProps) {
  const revenuePercent = revenueGoal > 0 ? Math.max(0, Math.min(100, Math.round((ytdAmount / revenueGoal) * 100))) : 0;
  const paceLabel = getPaceLabel(revenuePercent);
  const priorityAction = getPriorityAction({
    overdueTasks,
    pendingTasks,
    newDonorsThisMonth,
    activeCampaigns,
    revenuePercent,
  });
  const [runningNextMove, setRunningNextMove] = useState(false);
  const [nextMoveError, setNextMoveError] = useState<string | null>(null);
  const [nextMoveResult, setNextMoveResult] = useState<NextMoveDraftResponse | null>(null);

  /** Executes the high-priority donor welcome draft pack and returns links to both workspaces. */
  async function runNewDonorDraftAction() {
    setRunningNextMove(true);
    setNextMoveError(null);
    setNextMoveResult(null);
    try {
      const query = reportingYearMode === "fiscal" ? "?dateBasis=fiscal" : "";
      const payload = await apiFetch<NextMoveDraftResponse>(`/api/reports/actions/draft-thank-you-new-donors${query}`, {
        method: "POST",
      });
      setNextMoveResult(payload);
    } catch (error) {
      setNextMoveError(error instanceof Error ? error.message : "Failed to create donor thank-you drafts.");
    } finally {
      setRunningNextMove(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(22,163,74,0.18),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.12),_transparent_24%),linear-gradient(135deg,_rgba(255,255,255,1)_0%,_rgba(240,253,244,0.85)_52%,_rgba(248,250,252,1)_100%)] px-5 py-5 shadow-sm sm:px-6 sm:py-6">
      <div className="absolute inset-y-0 right-0 w-72 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,255,255,0.55))]" aria-hidden="true" />

      <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.95fr)]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700 shadow-sm">
                Dashboard Command Center
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
                {greeting}, {name}.
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
                Focus on the work that moves fundraising forward first: clear urgency, welcome new donors, and keep campaign momentum visible.
              </p>
            </div>

            <div className="rounded-2xl border border-white/80 bg-white/85 px-4 py-3 text-right shadow-sm backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Data window</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{dataThroughLabel}</p>
              <p className="mt-1 text-xs text-slate-500">{loading ? "Updating dashboard metrics..." : `${activeCampaigns} active campaign${activeCampaigns === 1 ? "" : "s"}`}</p>
            </div>
          </div>

          <div className="rounded-[24px] border border-emerald-200/70 bg-white/80 p-4 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Revenue pace</p>
                <div className="mt-2 flex flex-wrap items-end gap-x-3 gap-y-1">
                  <p className="text-3xl font-semibold tracking-tight text-slate-950">{loading ? "..." : `${revenuePercent}%`}</p>
                  <p className="text-sm text-slate-600">
                    {loading ? "Loading revenue snapshot" : `${formatCurrency(ytdAmount)} of ${formatCurrency(revenueGoal)} goal`}
                  </p>
                </div>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                {paceLabel}
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-emerald-100">
              <div
                className="h-full rounded-full bg-[linear-gradient(90deg,_#16a34a_0%,_#22c55e_70%,_#86efac_100%)] transition-all duration-500"
                style={{ width: `${revenuePercent}%` }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1">{pendingTasks} open task{pendingTasks === 1 ? "" : "s"}</span>
              <span className={`rounded-full border px-2.5 py-1 ${overdueTasks > 0 ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {overdueTasks > 0 ? `${overdueTasks} overdue` : "No overdue follow-ups"}
              </span>
              <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">{newDonorsThisMonth} new donor{newDonorsThisMonth === 1 ? "" : "s"} this month</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="YTD Raised"
              value={ytdAmount}
              format="currency"
              loading={loading}
              note={`${revenuePercent}% of goal`}
              accent="border-green-500"
            />
            <StatCard
              label="This Month"
              value={monthAmount}
              format="currency"
              loading={loading}
              trend={monthTrend != null ? { value: monthTrend, label: "vs last month" } : undefined}
              accent="border-sky-500"
            />
            <StatCard
              label="Retention"
              value={retentionRate}
              format="percent"
              loading={loading}
              note="Donor repeat rate"
              accent="border-emerald-500"
            />
            <StatCard
              label="Open Work"
              value={pendingTasks}
              format="number"
              loading={loading}
              alert={overdueTasks > 0 ? `${overdueTasks} overdue today` : undefined}
              note={overdueTasks === 0 ? "Queue is current" : undefined}
              accent={overdueTasks > 0 ? "border-amber-500" : "border-slate-400"}
            />
          </div>
        </div>

        <aside className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className={`rounded-2xl border px-4 py-4 ${priorityAction.toneClassName}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] opacity-80">{priorityAction.eyebrow}</p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight">{priorityAction.title}</h2>
            <p className="mt-2 text-sm leading-6 opacity-85">{priorityAction.description}</p>
            {priorityAction.actionType === "DRAFT_THANK_YOU_NEW_DONORS" ? (
              <button
                type="button"
                onClick={() => void runNewDonorDraftAction()}
                disabled={runningNextMove}
                className="mt-4 inline-flex items-center rounded-full border border-current/15 bg-white/80 px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-70"
              >
                {runningNextMove ? "Building Drafts..." : priorityAction.cta}
              </button>
            ) : (
              <Link
                href={priorityAction.href}
                className="mt-4 inline-flex items-center rounded-full border border-current/15 bg-white/80 px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors hover:bg-white"
              >
                {priorityAction.cta}
              </Link>
            )}

            {nextMoveError ? (
              <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {nextMoveError}
              </p>
            ) : null}

            {nextMoveResult ? (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-white/85 px-3 py-3 text-xs text-emerald-900">
                <p className="font-semibold">{nextMoveResult.message}</p>
                <p className="mt-1 opacity-80">
                  {nextMoveResult.counts.emailable} emailable, {nextMoveResult.counts.lettersNeeded} to letters, {nextMoveResult.counts.suppressed} suppressed.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {nextMoveResult.communications?.redirectTo ? (
                    <Link
                      href={nextMoveResult.communications.redirectTo}
                      className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      Open Email Draft
                    </Link>
                  ) : null}
                  {nextMoveResult.letters?.redirectTo ? (
                    <Link
                      href={nextMoveResult.letters.redirectTo}
                      className="inline-flex items-center rounded-full border border-sky-300 bg-sky-50 px-2.5 py-1 font-semibold text-sky-700 hover:bg-sky-100"
                    >
                      Open Letter Drafts
                    </Link>
                  ) : null}
                </div>
                {nextMoveResult.warnings?.lettersPermissionMissing ? (
                  <p className="mt-2 text-[11px] text-amber-700">Letter drafts were skipped because letters permissions are missing.</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">Quick tools</p>
                <p className="text-xs text-slate-500">Jump directly into the workspaces you are most likely to need today.</p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                At a glance
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-1">
              {QUICK_TOOLS.map((tool) => (
                <QuickToolLink key={tool.title} tool={tool} />
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}