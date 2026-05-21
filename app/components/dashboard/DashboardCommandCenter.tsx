/**
 * DashboardCommandCenter renders a high-signal dashboard hero with quick-launch tools,
 * a next-best-action card, and compact fundraising health metrics for donor staff.
 */
"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface DashboardCommandCenterProps {
  greeting: string;
  name: string;
  loading: boolean;
  dataThroughLabel: string;
  ytdAmount: number;
  weekAmount: number;
  weekCount: number;
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

const PRIMARY_QUICK_TOOLS = QUICK_TOOLS.slice(0, 4);
const SECONDARY_QUICK_TOOLS = QUICK_TOOLS.slice(4);

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

type KpiTone = "green" | "blue" | "purple" | "orange" | "slate";

const kpiToneClassName: Record<KpiTone, { bubble: string; trend: string }> = {
  green: { bubble: "bg-emerald-50 text-emerald-700 ring-emerald-100", trend: "text-emerald-600" },
  blue: { bubble: "bg-sky-50 text-sky-700 ring-sky-100", trend: "text-sky-600" },
  purple: { bubble: "bg-violet-50 text-violet-700 ring-violet-100", trend: "text-violet-600" },
  orange: { bubble: "bg-orange-50 text-orange-700 ring-orange-100", trend: "text-orange-600" },
  slate: { bubble: "bg-slate-50 text-slate-700 ring-slate-100", trend: "text-slate-600" },
};

function MiniIcon({ kind }: { kind: "gift" | "month" | "retention" | "tasks" | "campaign" | "action" }) {
  const pathByKind = {
    gift: "M12 3v18M7 7.5h7a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h7",
    month: "M4.5 6.5h15v12h-15v-12ZM8 4v4M16 4v4M4.5 10.5h15",
    retention: "M5 12a7 7 0 0 1 12-4.9M19 12a7 7 0 0 1-12 4.9M17 7h1V4M7 17H6v3",
    tasks: "M9 11l2 2 4-4M5 5h14v14H5V5Z",
    campaign: "M5 19V5m0 14h14M9 15l3-4 3 2 4-6",
    action: "M13 5l7 7-7 7M5 12h14",
  };
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={pathByKind[kind]} />
    </svg>
  );
}

function KpiCard({
  label,
  value,
  helper,
  tone,
  icon,
  loading,
}: {
  label: string;
  value: string;
  helper: string;
  tone: KpiTone;
  icon: "gift" | "month" | "retention" | "tasks" | "campaign";
  loading: boolean;
}) {
  const toneClass = kpiToneClassName[tone];
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.035)] transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_14px_34px_rgba(5,150,105,0.08)]">
      <div className="flex items-start gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ring-1 ${toneClass.bubble}`}>
          <MiniIcon kind={icon} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-slate-600">{label}</p>
          {loading ? (
            <div className="mt-2 h-7 w-24 animate-pulse rounded bg-slate-100" />
          ) : (
            <p className="mt-1 truncate text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
          )}
          <p className={`mt-2 text-xs font-medium ${toneClass.trend}`}>{loading ? "Updating..." : helper}</p>
        </div>
      </div>
    </div>
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
  weekAmount,
  weekCount,
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
    <section className="space-y-4 px-0 py-0">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="mt-0 text-3xl font-semibold tracking-tight text-slate-950 sm:text-[2rem]">
            {greeting}, {name}.
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-[15px]">
            Here&apos;s what&apos;s happening with your ministry today.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200/80 bg-white px-4 py-3 shadow-[0_10px_28px_rgba(15,23,42,0.035)] transition-all duration-200 hover:border-emerald-200">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Data snapshot</p>
          <p className="mt-1 max-w-[220px] truncate text-xs font-medium text-slate-600" title={dataThroughLabel}>
            {loading ? "Updating..." : dataThroughLabel.replace("Data through ", "").replace("Refreshed ", "")}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Total Giving (YTD)"
          value={formatCurrency(ytdAmount)}
          helper={`${revenuePercent}% of goal`}
          tone="green"
          icon="gift"
          loading={loading}
        />
        <KpiCard
          label="This Month"
          value={formatCurrency(monthAmount)}
          helper={monthTrend != null ? `${monthTrend >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(monthTrend))}% vs last month` : "No prior month yet"}
          tone="blue"
          icon="month"
          loading={loading}
        />
        <KpiCard
          label="New Donors"
          value={newDonorsThisMonth.toLocaleString()}
          helper="This reporting window"
          tone="purple"
          icon="campaign"
          loading={loading}
        />
        <KpiCard
          label="Open Tasks"
          value={pendingTasks.toLocaleString()}
          helper={overdueTasks > 0 ? `${overdueTasks} due today or overdue` : "Queue is current"}
          tone={overdueTasks > 0 ? "orange" : "slate"}
          icon="tasks"
          loading={loading}
        />
        <KpiCard
          label="Retention Rate"
          value={`${retentionRate}%`}
          helper="Donor repeat rate"
          tone="green"
          icon="retention"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.035)] transition-all duration-200 hover:border-emerald-200 hover:shadow-[0_14px_34px_rgba(5,150,105,0.08)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Revenue pace</p>
              <p className="mt-1 text-xs text-slate-500">
                {loading ? "Loading revenue snapshot" : `${formatCurrency(ytdAmount)} of ${formatCurrency(revenueGoal)} goal`}
              </p>
            </div>
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {paceLabel}
            </span>
          </div>
          <div className="mt-4 flex items-end gap-3">
            <p className="text-4xl font-semibold tracking-tight text-slate-950">{loading ? "..." : `${revenuePercent}%`}</p>
            <p className="pb-1 text-xs font-medium text-slate-500">funded</p>
          </div>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,#059669_0%,#16a34a_65%,#86efac_100%)] transition-all duration-500"
              style={{ width: `${revenuePercent}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">This week</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{loading ? "--" : formatCurrency(weekAmount)}</p>
              <p className="text-[11px] text-slate-500">{loading ? "--" : `${weekCount} gift${weekCount === 1 ? "" : "s"}`}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Week avg gift</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{weekCount > 0 ? formatCurrency(weekAmount / weekCount) : "$0"}</p>
              <p className="text-[11px] text-slate-500">Completed donations</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Campaigns</p>
              <p className="mt-1 text-sm font-semibold text-slate-950">{loading ? "--" : activeCampaigns}</p>
              <p className="text-[11px] text-slate-500">Active fundraising work</p>
            </div>
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.035)] transition-all duration-200 hover:border-emerald-200 hover:shadow-[0_14px_34px_rgba(5,150,105,0.08)]">
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
                <p className="text-sm font-semibold text-slate-950">Quick actions</p>
                <p className="text-xs text-slate-500">Open the workspaces you are most likely to need today.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PRIMARY_QUICK_TOOLS.map((tool) => (
                <Link
                  key={tool.title}
                  href={tool.href}
                  className="group flex min-h-16 items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/50 hover:shadow-[0_10px_24px_rgba(5,150,105,0.08)]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-100 group-hover:bg-white group-hover:text-emerald-700">
                    <MiniIcon kind="action" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-semibold text-slate-900">{tool.title}</span>
                    <span className="mt-0.5 block line-clamp-1 text-[11px] text-slate-500">{tool.description}</span>
                  </span>
                </Link>
              ))}
            </div>

            {SECONDARY_QUICK_TOOLS.length > 0 ? (
              <div className="flex flex-wrap gap-2 pt-1">
                {SECONDARY_QUICK_TOOLS.map((tool) => (
                  <Link
                    key={tool.title}
                    href={tool.href}
                    className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
                  >
                    {tool.title}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
