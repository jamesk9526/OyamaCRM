/**
 * DonorDashboardVisualRefresh renders the default DonorCRM home dashboard in a calm,
 * screenshot-inspired SaaS layout while preserving live CRM data boundaries.
 */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import CRMMetricCard from "@/app/components/ui/crm/CRMMetricCard";
import GivingTrendChart from "@/app/components/dashboard/GivingTrendChart";
import RecentDonationsWidget from "@/app/components/dashboard/RecentDonationsWidget";
import DonorRetention from "@/app/components/dashboard/DonorRetention";
import MonthlyDonationsWidget from "@/app/components/dashboard/MonthlyDonationsWidget";
import { apiFetch } from "@/app/lib/auth-client";
import StewardContextButton from "@/app/components/ai/StewardContextButton";

interface DonorDashboardVisualRefreshProps {
  greeting: string;
  name: string;
  loading: boolean;
  dataThroughLabel: string;
  totalConstituents: number;
  ytdAmount: number;
  ytdCount: number;
  weekAmount: number;
  weekCount: number;
  monthAmount: number;
  monthTrend: number | null;
  revenueGoal: number;
  retentionRate: number;
  retentionRetained: number;
  retentionTotal: number;
  pendingTasks: number;
  overdueTasks: number;
  activeCampaigns: number;
  newDonorsThisMonth: number;
  reportingYearMode: "calendar" | "fiscal";
  includeGrants: boolean;
  onRefresh: () => void;
  onCustomize: () => void;
}

interface CampaignSummary {
  id: string;
  name: string;
  goal: number | string | null;
  totalRaised?: number | string | null;
  active: boolean;
}

interface TaskPreview {
  id: string;
  title: string;
  type?: string;
  taskType?: string;
  dueDate: string | null;
  constituent: { firstName: string; lastName: string } | null;
}

interface QuickAction {
  label: string;
  href: string;
  icon: DashboardIconName;
  badge?: string;
}

type DashboardIconName =
  | "constituent"
  | "donation"
  | "task"
  | "mail"
  | "letter"
  | "chart"
  | "import"
  | "steward"
  | "more"
  | "gift"
  | "pulse";

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add Constituent", href: "/constituents/new", icon: "constituent" },
  { label: "Record Donation", href: "/donations?recordGift=1", icon: "donation" },
  { label: "Create Task", href: "/tasks", icon: "task" },
  { label: "Send Email", href: "/communications/new/type", icon: "mail" },
  { label: "Contacts Manager", href: "/contacts-manager", icon: "constituent" },
  { label: "Create Letter", href: "/letters-printables/generate", icon: "letter" },
  { label: "Campaigns", href: "/campaigns", icon: "gift" },
  { label: "View Reports", href: "/reports/donor-crm", icon: "chart" },
  { label: "Import Data", href: "/data-tools/import", icon: "import" },
  { label: "Steward Paths", href: "/steward-paths", icon: "steward" },
  { label: "Launch Steward", href: "/steward-signals", icon: "steward", badge: "AI" },
  { label: "More Tools", href: "/data-tools", icon: "more" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(value: string | null): string {
  if (!value) return "No due date";
  const due = new Date(value);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const normalizedDue = new Date(due);
  normalizedDue.setHours(0, 0, 0, 0);
  const diffDays = Math.round((normalizedDue.getTime() - today.getTime()) / 86_400_000);
  if (diffDays < 0) return "Overdue";
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Tomorrow";
  return due.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function toNumber(value: number | string | null | undefined): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

function DashboardIcon({ name, className = "h-5 w-5" }: { name: DashboardIconName; className?: string }) {
  const paths: Record<DashboardIconName, string> = {
    constituent: "M8.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM15.5 11.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3.75 18.5a4.75 4.75 0 0 1 9.5 0M10.75 18.5a4.75 4.75 0 0 1 9.5 0",
    donation: "M12 3v18M7 7.5h7a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h7",
    task: "M9 11l2 2 4-4M5 5h14v14H5V5z",
    mail: "M4 6h16v12H4V6zm0 0 8 7 8-7",
    letter: "M7 4.5h7l3 3v12H7v-15zm7 0v3h3M9.5 12h5M9.5 15h5",
    chart: "M5 19V5m0 14h14M9 15l3-4 3 2 4-6",
    import: "M12 3v10m0 0 4-4m-4 4-4-4M5 17v2h14v-2",
    steward: "M12 4.5l2.2 4.5 4.9.7-3.5 3.4.8 4.9L12 15.9 7.6 18l.8-4.9-3.5-3.4 4.9-.7L12 4.5z",
    more: "M5 12h.01M12 12h.01M19 12h.01",
    gift: "M20 12v7H4v-7m16 0H4m16 0V8H4v4m8-4v11M9 8a2 2 0 1 1 3-1.7M15 8a2 2 0 1 0-3-1.7",
    pulse: "M4 13h3l2-6 4 12 2-6h5",
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
    </svg>
  );
}

function SectionHeader({
  title,
  action,
  children,
}: {
  title: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-3 flex min-w-0 items-center justify-between gap-3 border-b border-emerald-100 pb-2">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
        {children ? <div className="mt-1 text-xs text-slate-500">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function DashboardRibbonCommand({ action }: { action: QuickAction }) {
  return (
    <Link
      href={action.href}
      className="group flex h-[58px] min-w-[68px] flex-col items-center justify-center gap-1 rounded-sm border border-transparent px-2 text-center text-[11px] font-semibold leading-tight text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
      title={action.label}
    >
      <DashboardIcon name={action.icon} className="h-5 w-5 text-slate-600 group-hover:text-emerald-700" />
      <span className="max-w-[5.5rem]">{action.label}</span>
    </Link>
  );
}

function DashboardRibbonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-fit flex-col border-r border-emerald-100 px-2 pb-1 pt-1 last:border-r-0">
      <div className="flex flex-wrap items-center gap-1">{children}</div>
      <span className="mt-0.5 text-center text-[9px] font-medium text-slate-500">{label}</span>
    </div>
  );
}

function TopCampaignsCard({ campaigns, loading }: { campaigns: CampaignSummary[]; loading: boolean }) {
  const topCampaigns = useMemo(() => {
    return [...campaigns]
      .sort((a, b) => toNumber(b.totalRaised) - toNumber(a.totalRaised))
      .slice(0, 5);
  }, [campaigns]);

  return (
    <CRMCard padding="md" className="min-h-[21rem]">
      <SectionHeader
        title="Top Campaigns"
        action={<Link href="/campaigns" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">View all</Link>}
      >
        Active campaigns by raised amount
      </SectionHeader>
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : topCampaigns.length === 0 ? (
        <div className="rounded-md border border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-8 text-center text-sm text-slate-500">
          No active campaigns yet.
        </div>
      ) : (
        <div className="space-y-4">
          {topCampaigns.map((campaign) => {
            const raised = toNumber(campaign.totalRaised);
            const goal = toNumber(campaign.goal);
            const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
            return (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block rounded-md px-2 py-1 transition-colors hover:bg-emerald-50">
                <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-slate-900">{campaign.name}</span>
                  <span className="shrink-0 text-xs font-medium text-slate-500">{pct}%</span>
                </div>
                <div className="mb-1 flex items-center justify-between gap-3 text-xs text-slate-500">
                  <span>{formatCurrency(raised)}</span>
                  <span>{goal > 0 ? formatCurrency(goal) : "No goal"}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-sm bg-emerald-100">
                  <div className="h-full rounded-sm bg-emerald-500" style={{ width: `${pct}%` }} />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </CRMCard>
  );
}

function TasksDueSoonCard({ tasks, loading }: { tasks: TaskPreview[]; loading: boolean }) {
  return (
    <CRMCard padding="md" className="min-h-[18rem]">
      <SectionHeader
        title="Tasks Due Soon"
        action={<Link href="/tasks" className="text-xs font-semibold text-slate-600 hover:text-slate-900">View all</Link>}
      />
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-10 animate-pulse rounded-md bg-slate-100" />
          ))}
        </div>
      ) : tasks.length === 0 ? (
        <div className="rounded-md border border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-8 text-center text-sm text-slate-500">
          No pending tasks due soon.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {tasks.slice(0, 5).map((task) => (
            <Link key={task.id} href="/tasks" className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-3">
              <span className="h-4 w-4 rounded border border-slate-300 bg-white" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-slate-900">{task.title}</span>
                <span className="block truncate text-xs text-slate-500">
                  {task.constituent ? `${task.constituent.firstName} ${task.constituent.lastName}` : task.type ?? task.taskType ?? "Follow-up"}
                </span>
              </span>
              <span className={`text-xs font-semibold ${formatShortDate(task.dueDate) === "Overdue" || formatShortDate(task.dueDate) === "Today" ? "text-red-500" : "text-slate-500"}`}>
                {formatShortDate(task.dueDate)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </CRMCard>
  );
}

/**
 * Default donor dashboard experience inspired by the user's provided CRM mockup.
 * API-backed cards avoid fake activity while keeping the layout scan-friendly.
 */
export default function DonorDashboardVisualRefresh({
  greeting,
  name,
  loading,
  dataThroughLabel,
  totalConstituents,
  ytdAmount,
  ytdCount,
  weekAmount,
  weekCount,
  monthAmount,
  monthTrend,
  revenueGoal,
  retentionRate,
  retentionRetained,
  retentionTotal,
  pendingTasks,
  overdueTasks,
  activeCampaigns,
  newDonorsThisMonth,
  reportingYearMode,
  includeGrants,
  onRefresh,
  onCustomize,
}: DonorDashboardVisualRefreshProps) {
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskPreview[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const revenuePercent = revenueGoal > 0 ? Math.min(100, Math.round((ytdAmount / revenueGoal) * 100)) : 0;
  const monthTrendLabel = monthTrend == null
    ? "vs last month unavailable"
    : `${monthTrend >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(monthTrend))}% vs last month`;

  useEffect(() => {
    let cancelled = false;

    async function loadCampaigns() {
      setCampaignsLoading(true);
      try {
        const data = await apiFetch<CampaignSummary[]>("/api/campaigns?active=true&limit=8&scope=ALL_YEARS");
        if (!cancelled) setCampaigns(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setCampaigns([]);
      } finally {
        if (!cancelled) setCampaignsLoading(false);
      }
    }

    void loadCampaigns();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadTasks() {
      setTasksLoading(true);
      try {
        const data = await apiFetch<{ items?: TaskPreview[] } | TaskPreview[]>("/api/tasks?status=PENDING&limit=8&scope=all");
        const items = Array.isArray(data) ? data : data.items ?? [];
        if (!cancelled) setTasks(items);
      } catch {
        if (!cancelled) setTasks([]);
      } finally {
        if (!cancelled) setTasksLoading(false);
      }
    }

    void loadTasks();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-md border border-emerald-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 bg-gradient-to-r from-emerald-50 via-green-50 to-emerald-100 px-3 py-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-600 text-white shadow-sm">
              <DashboardIcon name="pulse" className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-base font-semibold text-slate-950">DonorCRM Dashboard</h1>
              <p className="truncate text-xs text-slate-600">{greeting}, {name.split(" ")[0] || name} · {loading ? "Refreshing data" : dataThroughLabel}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-slate-600">
            <span className="rounded-full border border-emerald-200 bg-white/75 px-2.5 py-1">{reportingYearMode === "fiscal" ? "Fiscal mode" : "Calendar mode"}</span>
            <span className="rounded-full border border-emerald-200 bg-white/75 px-2.5 py-1">{activeCampaigns} active campaigns</span>
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-emerald-200 bg-white/85 px-3 text-emerald-800 hover:bg-white"
            >
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8 8 0 0 0 4.582 9M20 20v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        <div className="border-b border-emerald-100 bg-gradient-to-b from-white to-emerald-50/45">
          <div className="flex flex-wrap items-stretch">
            <DashboardRibbonGroup label="Create">
              {QUICK_ACTIONS.slice(0, 4).map((action) => <DashboardRibbonCommand key={action.label} action={action} />)}
            </DashboardRibbonGroup>
            <DashboardRibbonGroup label="Outreach">
              {QUICK_ACTIONS.slice(4, 8).map((action) => <DashboardRibbonCommand key={action.label} action={action} />)}
            </DashboardRibbonGroup>
            <DashboardRibbonGroup label="Tools">
              {QUICK_ACTIONS.slice(8, 11).map((action) => <DashboardRibbonCommand key={action.label} action={action} />)}
              <button
                type="button"
                onClick={onCustomize}
                className="group flex h-[58px] min-w-[68px] flex-col items-center justify-center gap-1 rounded-sm border border-transparent px-2 text-center text-[11px] font-semibold leading-tight text-slate-700 hover:border-emerald-200 hover:bg-emerald-50"
              >
                <DashboardIcon name="chart" className="h-5 w-5 text-slate-600 group-hover:text-emerald-700" />
                <span>Layout</span>
              </button>
            </DashboardRibbonGroup>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <CRMMetricCard
          label="Total Giving (YTD)"
          value={formatCurrency(ytdAmount)}
          loading={loading}
          icon={<DashboardIcon name="donation" />}
          helper={<span className="text-emerald-600">Raised from {ytdCount.toLocaleString()} gifts</span>}
          tone="green"
        />
        <CRMMetricCard
          label="Active Donors"
          value={totalConstituents.toLocaleString()}
          loading={loading}
          icon={<DashboardIcon name="constituent" />}
          helper="Constituents in this workspace"
          tone="blue"
        />
        <CRMMetricCard
          label="New Donors"
          value={newDonorsThisMonth.toLocaleString()}
          loading={loading}
          icon={<DashboardIcon name="gift" />}
          helper="This month"
          tone="purple"
        />
        <CRMMetricCard
          label="Open Tasks"
          value={pendingTasks.toLocaleString()}
          loading={loading}
          icon={<DashboardIcon name="task" />}
          helper={overdueTasks > 0 ? `${overdueTasks} due today or overdue` : "Queue is current"}
          tone={overdueTasks > 0 ? "orange" : "slate"}
        />
        <CRMMetricCard
          label="Retention Rate"
          value={`${retentionRate}%`}
          loading={loading}
          icon={<DashboardIcon name="pulse" />}
          helper={<span className="text-emerald-600">{retentionRetained.toLocaleString()} retained donors</span>}
          tone="green"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.25fr)_minmax(20rem,0.95fr)_minmax(18rem,0.82fr)]">
        <CRMCard padding="md" className="min-h-[24rem]">
          <SectionHeader
            title="Giving Overview"
            action={<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">{reportingYearMode === "fiscal" ? "Fiscal YTD" : "Year to Date"}</span>}
          >
            {formatCurrency(ytdAmount)} raised toward {formatCurrency(revenueGoal)} ({revenuePercent}%)
          </SectionHeader>
          <GivingTrendChart includeGrants={includeGrants} dateBasis={reportingYearMode} />
          <div className="mt-4 grid grid-cols-1 gap-3 border-t border-emerald-100 pt-4 sm:grid-cols-3">
            <div>
              <p className="text-xl font-semibold text-slate-950">{formatCurrency(ytdAmount)}</p>
              <p className="mt-1 text-xs text-slate-500">This Year (YTD)</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-950">{formatCurrency(monthAmount)}</p>
              <p className="mt-1 text-xs text-slate-500">This Month</p>
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-950">{formatCurrency(weekAmount)}</p>
              <p className="mt-1 text-xs text-slate-500">{weekCount} gift{weekCount === 1 ? "" : "s"} this week</p>
            </div>
          </div>
        </CRMCard>

        <CRMCard padding="md" className="min-h-[24rem]">
          <SectionHeader
            title="Recent Activity"
            action={<Link href="/donations" className="text-xs font-semibold text-slate-600 hover:text-slate-900">View all</Link>}
          >
            Live recent gifts
          </SectionHeader>
          <RecentDonationsWidget />
        </CRMCard>

        <CRMCard padding="md" className="min-h-[24rem] bg-gradient-to-b from-white to-emerald-50/35">
          <SectionHeader title="Inspector">
            Live priorities from this dashboard
          </SectionHeader>
          <div className="space-y-3">
            <div className="rounded-md border border-emerald-200 bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Focus</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{overdueTasks > 0 ? "Overdue stewardship work needs attention" : "Stewardship queue is current"}</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">{pendingTasks.toLocaleString()} open tasks · {overdueTasks.toLocaleString()} overdue</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue pace</p>
              <div className="mt-2 h-2 overflow-hidden rounded-sm bg-emerald-100">
                <div className="h-full rounded-sm bg-emerald-500" style={{ width: `${revenuePercent}%` }} />
              </div>
              <p className="mt-2 text-xs text-slate-500">{revenuePercent}% of goal · {formatCurrency(Math.max(0, revenueGoal - ytdAmount))} remaining</p>
            </div>
            <StewardContextButton
              label="Ask Steward for priorities"
              prompt={`Summarize this DonorCRM dashboard. YTD revenue is $${ytdAmount.toLocaleString()}, active donors are ${totalConstituents}, retention is ${retentionRate}%, open tasks are ${pendingTasks}, active campaigns are ${activeCampaigns}. What should staff focus on today?`}
              moduleKey="donor"
              mode="ask"
              variant="mini"
            />
          </div>
        </CRMCard>
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)_minmax(20rem,0.9fr)_minmax(20rem,0.9fr)]">
        <TopCampaignsCard campaigns={campaigns} loading={campaignsLoading} />

        <CRMCard padding="md" className="min-h-[18rem]">
          <SectionHeader
            title="Who Gave This Month"
            action={<Link href="/donations?filter=this-month" className="text-xs font-semibold text-slate-600 hover:text-slate-900">Donations</Link>}
          >
            Donor list, task, and email follow-up tools
          </SectionHeader>
          <MonthlyDonationsWidget />
        </CRMCard>

        <CRMCard padding="md" className="min-h-[18rem]">
          <SectionHeader title="Donor Retention" action={<span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">All Donors</span>}>
            {monthTrendLabel}
          </SectionHeader>
          <DonorRetention
            retained={retentionRetained}
            total={retentionTotal}
            rate={retentionRate}
            loading={loading}
          />
        </CRMCard>

        <TasksDueSoonCard tasks={tasks} loading={tasksLoading} />

        <CRMCard padding="md" className="min-h-[18rem]">
          <SectionHeader title="Quick Actions">
            Frequent donor workflow shortcuts
          </SectionHeader>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {QUICK_ACTIONS.map((action) => (
              <Link
                key={action.label}
                href={action.href}
                className="group flex min-h-12 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
              >
                <DashboardIcon name={action.icon} className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-emerald-700" />
                <span className="min-w-0 flex-1 truncate">{action.label}</span>
                {action.badge ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">{action.badge}</span> : null}
              </Link>
            ))}
          </div>
          <div className="mt-3 border-t border-emerald-100 pt-3">
            <StewardContextButton
              label="Summarize dashboard"
              prompt={`Summarize this DonorCRM dashboard. YTD revenue is $${ytdAmount.toLocaleString()}, active donors are ${totalConstituents}, retention is ${retentionRate}%, open tasks are ${pendingTasks}, active campaigns are ${activeCampaigns}. What should staff focus on today?`}
              moduleKey="donor"
              mode="ask"
              variant="mini"
            />
          </div>
        </CRMCard>
      </div>
    </div>
  );
}
