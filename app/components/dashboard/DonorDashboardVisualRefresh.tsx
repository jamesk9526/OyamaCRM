/**
 * DonorDashboardVisualRefresh renders the default DonorCRM home dashboard in a calm,
 * screenshot-inspired SaaS layout while preserving live CRM data boundaries.
 */
"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CRMCard from "@/app/components/ui/crm/CRMCard";
import CRMFilterBar from "@/app/components/ui/crm/CRMFilterBar";
import { apiFetch } from "@/app/lib/auth-client";
import StewardContextButton from "@/app/components/ai/StewardContextButton";

interface DonorDashboardVisualRefreshProps {
  greeting: string;
  name: string;
  loading: boolean;
  dataThroughLabel: string;
  totalConstituents: number;
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
  onRefresh: () => void;
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

interface DonationPreview {
  id: string;
  amount: number | string;
  date: string;
  paymentMethod?: string | null;
  constituent?: { id: string; firstName: string; lastName: string; email?: string | null } | null;
  campaign?: { id: string; name: string } | null;
  designation?: { id: string; name: string } | null;
}

interface DesignationBreakdownItem {
  id: string;
  name: string;
  amount: number;
  count: number;
}

interface PaymentMethodBreakdownItem {
  method: string;
  label: string;
  amount: number;
  count: number;
}

interface MonthlyDonorItem {
  donorId: string;
  profileHref: string;
  name: string;
  email: string | null;
  amount: number;
  count: number;
  lastGiftDate: string;
}

interface TrendPoint {
  label: string;
  amount: number;
}

interface LapsedDonorItem {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  lastGiftDate: string | null;
  totalLifetimeGiving: number | string | null;
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
  | "pulse"
  | "calendar"
  | "refresh"
  | "chevron"
  | "plus"
  | "average";

type DashboardRangeId = "CURRENT_WEEK" | "CURRENT_MONTH" | "YTD";

type ExpandedDashboardWidget =
  | "giving"
  | "recent"
  | "monthly-givers"
  | "designation"
  | "source"
  | "today"
  | "reports"
  | "tools"
  | "metric-giving"
  | "metric-donors"
  | "metric-new-donors"
  | "metric-average"
  | "metric-tasks"
  | "metric-retention"
  | "campaign-progress"
  | "lapsed"
  | "giving-levels";

const DASHBOARD_RANGES: Array<{ id: DashboardRangeId; label: string; comparisonLabel: string }> = [
  { id: "CURRENT_WEEK", label: "This week", comparisonLabel: "vs. prior week" },
  { id: "CURRENT_MONTH", label: "This month", comparisonLabel: "vs. prior month" },
  { id: "YTD", label: "Year to date", comparisonLabel: "vs. prior year" },
];

const DONOR_CHART_COLORS = ["#059669", "#2563eb", "#d97706", "#7c3aed", "#0e7490", "#be123c"];

const REPORT_SHORTCUTS: QuickAction[] = [
  { label: "Donations by Designation", href: "/reports?report=designation-fund", icon: "gift" },
  { label: "Monthly Giving Report", href: "/reports?report=monthly-giving", icon: "calendar" },
  { label: "Top Donors", href: "/reports?report=top-donors", icon: "constituent" },
  { label: "First Time Donors", href: "/reports?report=new-donor", icon: "steward" },
  { label: "Comprehensive Analysis", href: "/reports", icon: "chart" },
  { label: "Year Over Year", href: "/reports?report=year-to-date-giving", icon: "pulse" },
];

const QUICK_ACTIONS: QuickAction[] = [
  { label: "Add Constituent", href: "/constituents/new", icon: "constituent" },
  { label: "Record Donation", href: "/donations?recordGift=1", icon: "donation" },
  { label: "Create Task", href: "/tasks", icon: "task" },
  { label: "Send Email", href: "/communications/new/type", icon: "mail" },
  { label: "Contacts Manager", href: "/contacts-manager", icon: "constituent" },
  { label: "Create Letter", href: "/oyama-letters/generate", icon: "letter" },
  { label: "Campaigns", href: "/campaigns", icon: "gift" },
  { label: "View Reports", href: "/reports", icon: "chart" },
  { label: "Import Data", href: "/data-tools/import", icon: "import" },
  { label: "Steward Paths", href: "/steward-paths", icon: "steward" },
  { label: "Launch Steward", href: "/steward-signals", icon: "steward", badge: "AI" },
  { label: "More Tools", href: "/data-tools", icon: "more" },
];

const DASHBOARD_TOOL_ACTIONS: QuickAction[] = [
  { label: "Contacts Manager", href: "/contacts-manager", icon: "constituent" },
  { label: "Groups & Lists", href: "/contacts-manager/lists", icon: "constituent" },
  { label: "Campaigns", href: "/campaigns", icon: "gift" },
  { label: "Donations", href: "/donations", icon: "donation" },
  { label: "Letters & Printables", href: "/oyama-letters", icon: "letter" },
  { label: "Communications", href: "/communications", icon: "mail" },
  { label: "Tasks", href: "/tasks", icon: "task" },
  { label: "Reports", href: "/reports", icon: "chart" },
  { label: "Import Data", href: "/data-tools/import", icon: "import" },
  { label: "Steward Paths", href: "/steward-paths", icon: "steward" },
  { label: "Steward Signals", href: "/steward-signals", icon: "steward", badge: "AI" },
  { label: "Designations", href: "/designations", icon: "gift" },
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

function getRangeDates(rangeId: DashboardRangeId): { from?: string; to?: string } {
  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  if (rangeId === "YTD") return {};

  const fromDate = new Date(now);
  if (rangeId === "CURRENT_WEEK") {
    const day = fromDate.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    fromDate.setDate(fromDate.getDate() - diffToMonday);
  } else {
    fromDate.setDate(1);
  }
  return { from: fromDate.toISOString().slice(0, 10), to };
}

function buildDonationQuery(rangeId: DashboardRangeId, reportingYearMode: "calendar" | "fiscal", campaignId: string): string {
  const params = new URLSearchParams({ limit: "all", status: "COMPLETED", scope: "CURRENT_YEAR", dateBasis: reportingYearMode });
  const rangeDates = getRangeDates(rangeId);
  if (rangeDates.from) params.set("from", rangeDates.from);
  if (rangeDates.to) params.set("to", rangeDates.to);
  if (campaignId) params.set("campaignId", campaignId);
  return `/api/donations?${params.toString()}`;
}

function buildDesignationBreakdown(donations: DonationPreview[]): DesignationBreakdownItem[] {
  const byDesignation = new Map<string, DesignationBreakdownItem>();
  donations.forEach((donation) => {
    const designation = donation.designation;
    const id = designation?.id ?? "undesignated";
    const existing = byDesignation.get(id) ?? {
      id,
      name: designation?.name ?? "Undesignated",
      amount: 0,
      count: 0,
    };
    existing.amount += toNumber(donation.amount);
    existing.count += 1;
    byDesignation.set(id, existing);
  });

  return [...byDesignation.values()]
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5);
}

function getDonorName(donation: DonationPreview): string {
  const firstName = donation.constituent?.firstName?.trim() ?? "";
  const lastName = donation.constituent?.lastName?.trim() ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || "Unknown Donor";
}

function methodLabel(method: string | null | undefined): string {
  const map: Record<string, string> = {
    CREDIT_CARD: "Card",
    ACH: "ACH",
    CHECK: "Check",
    CASH: "Cash",
    WIRE: "Wire",
    STOCK: "Stock",
    IN_KIND: "In-kind",
    ONLINE: "Online",
    CRYPTO: "Crypto",
    OTHER: "Other",
  };
  return map[method ?? ""] ?? "Other";
}

function methodColor(method: string | null | undefined): string {
  const map: Record<string, string> = {
    CREDIT_CARD: "bg-blue-100 text-blue-700",
    ACH: "bg-green-100 text-green-700",
    CHECK: "bg-amber-100 text-amber-700",
    CASH: "bg-emerald-100 text-emerald-700",
    WIRE: "bg-purple-100 text-purple-700",
    STOCK: "bg-rose-100 text-rose-700",
    IN_KIND: "bg-cyan-100 text-cyan-700",
    ONLINE: "bg-indigo-100 text-indigo-700",
  };
  return map[method ?? ""] ?? "bg-slate-100 text-slate-600";
}

function buildPaymentMethodBreakdown(donations: DonationPreview[]): PaymentMethodBreakdownItem[] {
  const byMethod = new Map<string, PaymentMethodBreakdownItem>();
  donations.forEach((donation) => {
    const method = donation.paymentMethod ?? "OTHER";
    const existing = byMethod.get(method) ?? {
      method,
      label: methodLabel(method),
      amount: 0,
      count: 0,
    };
    existing.amount += toNumber(donation.amount);
    existing.count += 1;
    byMethod.set(method, existing);
  });

  return [...byMethod.values()].sort((a, b) => b.amount - a.amount);
}

function buildMonthlyDonorList(donations: DonationPreview[]): MonthlyDonorItem[] {
  const byDonor = new Map<string, MonthlyDonorItem>();
  donations.forEach((donation) => {
    const donorId = donation.constituent?.id ?? `gift-${donation.id}`;
    const existing = byDonor.get(donorId) ?? {
      donorId,
      profileHref: donation.constituent?.id ? `/constituents/${donation.constituent.id}` : "/donations",
      name: getDonorName(donation),
      email: donation.constituent?.email ?? null,
      amount: 0,
      count: 0,
      lastGiftDate: donation.date,
    };
    existing.amount += toNumber(donation.amount);
    existing.count += 1;
    if (new Date(donation.date).getTime() > new Date(existing.lastGiftDate).getTime()) {
      existing.lastGiftDate = donation.date;
    }
    byDonor.set(donorId, existing);
  });

  return [...byDonor.values()].sort((a, b) => b.amount - a.amount);
}

function relativeDate(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  if (diff < 0) return "Scheduled";
  const days = Math.floor(diff / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function buildTrendPoints(donations: DonationPreview[], rangeId: DashboardRangeId): TrendPoint[] {
  const now = new Date();
  const labels = rangeId === "YTD"
    ? ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    : rangeId === "CURRENT_WEEK"
      ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
      : Array.from({ length: now.getDate() }, (_, index) => String(index + 1));
  const points = labels.map((label) => ({ label, amount: 0 }));

  donations.forEach((donation) => {
    const date = new Date(donation.date);
    const index = rangeId === "YTD"
      ? date.getMonth()
      : rangeId === "CURRENT_WEEK"
        ? (date.getDay() + 6) % 7
        : date.getDate() - 1;
    if (points[index]) points[index].amount += toNumber(donation.amount);
  });

  return points;
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
    calendar: "M4.5 6.5h15v12h-15v-12ZM8 4v4M16 4v4M4.5 10.5h15",
    refresh: "M4 4v5h5M20 20v-5h-5M5.5 15A7 7 0 0 0 18 17M18.5 9A7 7 0 0 0 6 7",
    chevron: "m8 9 4 4 4-4",
    plus: "M12 5v14M5 12h14",
    average: "M5 19V5m0 14h14M9 15l2.5-4 3 2 4.5-7",
  };

  return (
    <svg className={className} fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={paths[name]} />
    </svg>
  );
}

function DashboardMetricCard({
  label,
  value,
  helper,
  icon,
  tone,
  loading,
  progressPercent,
  progressLabel,
  onExpand,
}: {
  label: string;
  value: string;
  helper: string;
  icon: DashboardIconName;
  tone: "emerald" | "blue" | "violet" | "cyan" | "orange";
  loading: boolean;
  progressPercent?: number | null;
  progressLabel?: string;
  onExpand?: () => void;
}) {
  const toneClassName = {
    emerald: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    blue: "bg-blue-50 text-blue-700 ring-blue-100",
    violet: "bg-violet-50 text-violet-700 ring-violet-100",
    cyan: "bg-cyan-50 text-cyan-700 ring-cyan-100",
    orange: "bg-orange-50 text-orange-700 ring-orange-100",
  }[tone];
  const barClassName = {
    emerald: "bg-emerald-500",
    blue: "bg-blue-500",
    violet: "bg-violet-500",
    cyan: "bg-cyan-500",
    orange: "bg-orange-500",
  }[tone];
  const boundedProgress = typeof progressPercent === "number" && Number.isFinite(progressPercent)
    ? Math.max(0, Math.min(100, progressPercent))
    : null;

  return (
    <CRMCard padding="sm" className="min-h-[6.75rem] animate-slide-up-fade-in transition-transform duration-200 hover:-translate-y-0.5">
      <div className="flex items-start gap-3">
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 ${toneClassName}`}>
          <DashboardIcon name={icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate text-xs font-semibold text-slate-500">{label}</p>
            {onExpand ? <button type="button" onClick={onExpand} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">Open</button> : null}
          </div>
          {loading ? <div className="mt-1 h-6 w-24 animate-pulse rounded bg-slate-100" /> : <p className="mt-0.5 truncate text-xl font-bold tracking-tight text-slate-950">{value}</p>}
          <p className="mt-1 truncate text-xs font-semibold text-emerald-600">{helper}</p>
        </div>
      </div>
      {boundedProgress !== null ? (
        <div className="mt-3">
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className={`h-full rounded-full ${barClassName}`} style={{ width: `${boundedProgress}%` }} />
          </div>
          {progressLabel ? <p className="mt-1 truncate text-[11px] font-medium text-slate-500">{progressLabel}</p> : null}
        </div>
      ) : (
        <div className="mt-3 h-1.5 rounded-full bg-slate-100" aria-hidden="true" />
      )}
    </CRMCard>
  );
}

function DashboardFilterSelect({
  label,
  value,
  onChange,
  children,
  disabled = false,
  title,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <label className="flex min-w-[11rem] flex-col gap-1 text-xs font-semibold text-slate-600" title={title ?? label}>
      <span>{label}</span>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800 shadow-sm outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:bg-slate-50 disabled:text-slate-400"
      >
        {children}
      </select>
    </label>
  );
}

function DashboardFilterButton({ label, onClick, active = false }: { label: string; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-md border px-3 text-sm font-semibold shadow-sm transition ${
        active
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:text-emerald-700"
      }`}
    >
      {label}
    </button>
  );
}

function DashboardCommandRibbon({
  selectedRange,
  setSelectedRange,
  selectedCampaignId,
  setSelectedCampaignId,
  campaigns,
  campaignsLoading,
  reportingYearMode,
  activeRange,
  onRefresh,
  onOpenWidget,
}: {
  selectedRange: DashboardRangeId;
  setSelectedRange: (range: DashboardRangeId) => void;
  selectedCampaignId: string;
  setSelectedCampaignId: (campaignId: string) => void;
  campaigns: CampaignSummary[];
  campaignsLoading: boolean;
  reportingYearMode: "calendar" | "fiscal";
  activeRange: { id: DashboardRangeId; label: string; comparisonLabel: string };
  onRefresh: () => void;
  onOpenWidget: (widget: ExpandedDashboardWidget) => void;
}) {
  return (
    <div aria-label="Dashboard Tools">
      <CRMFilterBar className="animate-slide-up-fade-in">
        <div className="flex min-w-0 flex-wrap items-end gap-3">
          <DashboardFilterSelect label="Range" value={selectedRange} onChange={(value) => setSelectedRange(value as DashboardRangeId)} title={activeRange.comparisonLabel}>
            {DASHBOARD_RANGES.map((range) => <option key={range.id} value={range.id}>{range.label}</option>)}
          </DashboardFilterSelect>
          <DashboardFilterSelect label="Campaign" value={selectedCampaignId} onChange={setSelectedCampaignId} disabled={campaignsLoading}>
            <option value="">All Campaigns</option>
            {campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </DashboardFilterSelect>
          <DashboardFilterButton label={reportingYearMode === "fiscal" ? "Fiscal Year" : "Calendar Year"} onClick={() => onOpenWidget("metric-giving")} active />
          <DashboardFilterButton label="Refresh" onClick={onRefresh} />
        </div>
        <div className="flex flex-wrap items-end justify-start gap-2 lg:justify-end">
          <DashboardFilterButton label="Giving Trends" onClick={() => onOpenWidget("giving")} />
          <DashboardFilterButton label="Today" onClick={() => onOpenWidget("today")} />
          <DashboardFilterButton label="Recent Gifts" onClick={() => onOpenWidget("recent")} />
          <DashboardFilterButton label="Retention" onClick={() => onOpenWidget("metric-retention")} />
        </div>
      </CRMFilterBar>
    </div>
  );
}

function OpenWidgetButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 hover:border-emerald-200 hover:text-emerald-700">
      Open
    </button>
  );
}

function DesignationBreakdownCard({ items, loading, onExpand }: { items: DesignationBreakdownItem[]; loading: boolean; onExpand?: () => void }) {
  const total = items.reduce((sum, item) => sum + item.amount, 0);
  const palette = DONOR_CHART_COLORS;
  const topDesignation = items[0] ?? null;

  return (
    <CRMCard padding="md" className="h-full min-h-[20rem] animate-slide-up-fade-in">
      <SectionHeader
        title="Giving by Designation"
        action={<div className="flex items-center gap-2"><Link href="/reports?report=designation-fund" className="text-xs font-semibold text-slate-600 hover:text-slate-900">Report</Link>{onExpand ? <OpenWidgetButton onClick={onExpand} /> : null}</div>}
      >
        Live completed gifts from the selected filters
      </SectionHeader>
      {loading ? (
        <div className="h-48 animate-pulse rounded-md bg-slate-100" />
      ) : items.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
          No designation giving found for this view.
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="grid gap-4 lg:grid-cols-[10rem_1fr] xl:grid-cols-1 2xl:grid-cols-[10rem_1fr]">
            <div className="relative mx-auto h-44 w-full min-w-0 max-w-[13rem]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={items} dataKey="amount" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={2} isAnimationActive animationDuration={700}>
                    {items.map((item, index) => <Cell key={item.id} fill={palette[index % palette.length]} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-base font-bold text-slate-950">{formatCurrency(total)}</span>
                <span className="text-[11px] font-semibold text-slate-500">Total</span>
              </div>
            </div>
            <div className="space-y-2">
              {items.map((item, index) => {
                const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
                return (
                  <Link key={item.id} href={item.id === "undesignated" ? "/donations" : `/donations?designationId=${item.id}`} className="block rounded-md px-2 py-1.5 hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: palette[index % palette.length] }} />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{item.name}</span>
                      <span className="shrink-0 text-xs font-semibold text-slate-600">{pct}%</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: palette[index % palette.length] }} />
                      </div>
                      <span className="w-20 shrink-0 text-right text-[11px] font-semibold text-slate-500">{formatCurrency(item.amount)}</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="mt-auto grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-slate-500">Top fund</span>
              <span className="mt-0.5 block truncate text-sm font-bold text-slate-900">{topDesignation?.name ?? "None"}</span>
            </div>
            <div className="rounded-md bg-emerald-50 px-3 py-2">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-emerald-700">Designations</span>
              <span className="mt-0.5 block text-sm font-bold text-slate-900">{items.length.toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}
    </CRMCard>
  );
}

function PaymentSourceBreakdownCard({ items, total, loading, onExpand }: { items: PaymentMethodBreakdownItem[]; total: number; loading: boolean; onExpand?: () => void }) {
  const topSource = items[0] ?? null;
  return (
    <CRMCard padding="md" className="h-full min-h-[20rem] animate-slide-up-fade-in">
      <SectionHeader
        title="Giving by Source"
        action={<div className="flex items-center gap-2"><Link href="/donations" className="text-xs font-semibold text-slate-600 hover:text-slate-900">Donations</Link>{onExpand ? <OpenWidgetButton onClick={onExpand} /> : null}</div>}
      >
        Completed payment methods in the selected view
      </SectionHeader>
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-9 animate-pulse rounded bg-slate-100" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
          No completed giving sources in this view.
        </div>
      ) : (
        <div className="flex h-full min-h-0 flex-col">
          <div className="mb-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Total</p>
              <p className="mt-0.5 text-sm font-bold text-slate-950">{formatCurrency(total)}</p>
            </div>
            <div className="rounded-md bg-emerald-50 px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Top source</p>
              <p className="mt-0.5 truncate text-sm font-bold text-slate-950">{topSource?.label ?? "None"}</p>
            </div>
          </div>
          <div className="mb-3 h-32 rounded-md border border-slate-100 bg-slate-50/50 p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={items.slice(0, 6)} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={false} tickLine={false} interval={0} />
                <YAxis hide />
                <Tooltip formatter={(value) => formatCurrency(Number(value))} cursor={{ fill: "rgba(16,185,129,0.08)" }} />
                <Bar dataKey="amount" radius={[4, 4, 0, 0]} isAnimationActive animationDuration={650}>
                  {items.slice(0, 6).map((item, index) => <Cell key={item.method} fill={DONOR_CHART_COLORS[index % DONOR_CHART_COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-2.5">
            {items.map((item) => {
              const pct = total > 0 ? Math.round((item.amount / total) * 100) : 0;
              return (
                <div key={item.method} className="rounded-md border border-slate-100 bg-white px-2.5 py-2">
                  <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                    <span className="inline-flex min-w-0 items-center gap-2 font-semibold text-slate-800">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${methodColor(item.method)}`}>{item.label}</span>
                      <span className="truncate text-xs font-medium text-slate-500">{item.count} gift{item.count === 1 ? "" : "s"}</span>
                    </span>
                    <span className="shrink-0 font-semibold text-slate-900">{formatCurrency(item.amount)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="mt-1 text-right text-[11px] font-semibold text-slate-500">{pct}% of filtered giving</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </CRMCard>
  );
}

function FilteredGivingTrendChart({ donations, rangeId, loading, expanded = false }: { donations: DonationPreview[]; rangeId: DashboardRangeId; loading: boolean; expanded?: boolean }) {
  const points = useMemo(() => buildTrendPoints(donations, rangeId), [donations, rangeId]);
  const total = points.reduce((sum, point) => sum + point.amount, 0);

  if (loading) {
    return <div className={`flex ${expanded ? "h-[28rem]" : "h-[13rem]"} items-center justify-center rounded-md bg-slate-50 text-sm text-slate-400`}>Loading filtered giving...</div>;
  }

  if (donations.length === 0) {
    return (
      <div className={`flex ${expanded ? "h-[28rem]" : "h-[13rem]"} flex-col items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-center`}>
        <p className="text-sm font-semibold text-slate-600">No giving in this view</p>
        <p className="mt-1 text-xs text-slate-400">Change the date range or campaign filter to broaden the dashboard.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight text-slate-950">{formatCurrency(total)}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Filtered giving total</p>
        </div>
        <p className="text-xs font-semibold text-slate-500">{donations.length.toLocaleString()} gift{donations.length === 1 ? "" : "s"}</p>
      </div>
      <div className={`relative ${expanded ? "h-[28rem]" : "h-[13rem]"} rounded-md border border-slate-100 bg-white/80 p-2`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 16, right: 18, bottom: 8, left: 0 }}>
            <defs>
              <linearGradient id="filteredGivingArea" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity={0.28} />
                <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} minTickGap={10} />
            <YAxis tickFormatter={(value) => value >= 1000 ? `$${Math.round(Number(value) / 1000)}K` : `$${Number(value)}`} tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={48} />
            <Tooltip formatter={(value) => formatCurrency(Number(value))} labelClassName="font-semibold text-slate-800" contentStyle={{ borderRadius: 8, borderColor: "#d1fae5" }} />
            <Area type="monotone" dataKey="amount" stroke="#059669" strokeWidth={3} fill="url(#filteredGivingArea)" dot={{ r: 3, fill: "#059669", strokeWidth: 0 }} activeDot={{ r: 5 }} isAnimationActive animationDuration={800} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MonthlyGiversCard({ donors, loading, onExpand }: { donors: MonthlyDonorItem[]; loading: boolean; onExpand?: () => void }) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<"amount" | "name" | "date">("amount");
  const [bulkAction, setBulkAction] = useState<"task" | "segment" | "email" | null>(null);
  const [segmentName, setSegmentName] = useState("");
  const [taskType, setTaskType] = useState("Thank-You Follow-Up");
  const [dueOffset, setDueOffset] = useState("7");
  const [actionLoading, setActionLoading] = useState(false);
  const [actionResult, setActionResult] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const items = [...donors];
    if (sortBy === "name") items.sort((a, b) => a.name.localeCompare(b.name));
    else if (sortBy === "date") items.sort((a, b) => new Date(b.lastGiftDate).getTime() - new Date(a.lastGiftDate).getTime());
    return items;
  }, [donors, sortBy]);

  const total = donors.reduce((sum, d) => sum + d.amount, 0);
  const allSelected = selectedIds.size === donors.length && donors.length > 0;
  const selectedDonors = donors.filter((d) => selectedIds.has(d.donorId));

  function toggleAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(donors.map((d) => d.donorId)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCreateTasks() {
    setActionLoading(true);
    setActionResult(null);
    const dueDateStr = new Date(Date.now() + parseInt(dueOffset, 10) * 86_400_000).toISOString().slice(0, 10);
    let created = 0;
    let failed = 0;
    for (const donor of selectedDonors) {
      try {
        await apiFetch("/api/tasks", {
          method: "POST",
          body: JSON.stringify({ title: `${taskType}: ${donor.name}`, type: "FOLLOW_UP", dueDate: dueDateStr, constituentId: donor.donorId }),
        });
        created++;
      } catch {
        failed++;
      }
    }
    setActionLoading(false);
    setBulkAction(null);
    setActionResult(`${created} task${created === 1 ? "" : "s"} created${failed > 0 ? `, ${failed} failed` : ""}.`);
  }

  async function handleTagSegment() {
    if (!segmentName.trim()) return;
    setActionLoading(true);
    setActionResult(null);
    try {
      await apiFetch("/api/constituents/tags/bulk-actions", {
        method: "POST",
        body: JSON.stringify({ action: "ADD", tagNames: [segmentName.trim()], constituentIds: [...selectedIds] }),
      });
      setActionResult(`Saved segment "${segmentName}" for ${selectedIds.size} donor${selectedIds.size === 1 ? "" : "s"}.`);
    } catch {
      setActionResult("Segment save failed. Check constituent access.");
    } finally {
      setActionLoading(false);
      setBulkAction(null);
    }
  }

  async function handleDraftEmail() {
    setActionLoading(true);
    setActionResult(null);
    const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
    try {
      const result = await apiFetch<{ id?: string }>("/api/email-campaigns", {
        method: "POST",
        body: JSON.stringify({ name: `Monthly Donor Thank You – ${monthLabel}`, subject: `Thank you for your ${monthLabel} gift!`, status: "DRAFT" }),
      });
      if (result?.id) {
        window.location.assign(`/communications/${result.id}?mode=build`);
      } else {
        setActionResult("Draft campaign created — open Communications to find it.");
      }
    } catch {
      setActionResult("Could not create draft email campaign.");
    } finally {
      setActionLoading(false);
      setBulkAction(null);
    }
  }

  return (
    <CRMCard padding="md" className="h-full min-h-[20rem]">
      <SectionHeader title="Who Gave This Month" action={onExpand ? <OpenWidgetButton onClick={onExpand} /> : undefined}>
        Monthly giving list — select donors to take action
      </SectionHeader>

      {/* Stats row */}
      <div className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-md bg-emerald-50 px-3 py-2">
          <p className="text-lg font-bold text-slate-950">{formatCurrency(total)}</p>
          <p className="text-xs text-slate-500">Total raised</p>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2">
          <p className="text-lg font-bold text-slate-950">{donors.length.toLocaleString()}</p>
          <p className="text-xs text-slate-500">Donors</p>
        </div>
        <div className={`rounded-md px-3 py-2 ${selectedIds.size > 0 ? "bg-emerald-100" : "bg-slate-50"}`}>
          <p className="text-lg font-bold text-slate-950">{selectedIds.size}</p>
          <p className="text-xs text-slate-500">Selected</p>
        </div>
      </div>

      {/* Select-all + sort controls */}
      <div className="mb-2 flex items-center gap-3">
        <label className="flex cursor-pointer select-none items-center gap-1.5 text-xs text-slate-600">
          <input type="checkbox" checked={allSelected} onChange={toggleAll} className="rounded border-slate-300 accent-emerald-600" />
          <span className="font-semibold">All</span>
        </label>
        <div className="flex-1" />
        <label className="flex items-center gap-1 text-xs text-slate-500">
          Sort:
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="ml-0.5 rounded border border-slate-200 bg-white px-1 py-0.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-400">
            <option value="amount">Amount</option>
            <option value="name">Name</option>
            <option value="date">Recent</option>
          </select>
        </label>
      </div>

      {/* Action result toast */}
      {actionResult ? (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-800">
          {actionResult}
          <button type="button" onClick={() => setActionResult(null)} className="ml-auto text-emerald-700 hover:text-emerald-900" aria-label="Dismiss">✕</button>
        </div>
      ) : null}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && bulkAction === null ? (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2">
          <span className="text-xs font-bold text-slate-700">{selectedIds.size} selected —</span>
          <button type="button" onClick={() => setBulkAction("task")} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700">Create Tasks</button>
          <button type="button" onClick={() => setBulkAction("segment")} className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:border-emerald-300 hover:text-emerald-700">Tag Segment</button>
          <button type="button" onClick={() => void handleDraftEmail()} disabled={actionLoading} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">Draft Email</button>
          <Link href={`/constituents?ids=${[...selectedIds].join(",")}`} className="ml-auto text-xs font-semibold text-blue-600 hover:text-blue-800">View profiles →</Link>
        </div>
      ) : null}

      {/* Task creation panel */}
      {bulkAction === "task" ? (
        <div className="mb-2 rounded-md border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-bold text-slate-800">Create tasks for {selectedIds.size} donor{selectedIds.size === 1 ? "" : "s"}</p>
          <div className="mb-2 flex flex-wrap gap-2">
            <label className="text-xs font-semibold text-slate-600">
              Type
              <select value={taskType} onChange={(e) => setTaskType(e.target.value)} className="ml-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-400">
                <option>Thank-You Follow-Up</option>
                <option>Impact Update</option>
                <option>Phone Call</option>
                <option>Cultivation Meeting</option>
                <option>Send Letter</option>
              </select>
            </label>
            <label className="text-xs font-semibold text-slate-600">
              Due in
              <select value={dueOffset} onChange={(e) => setDueOffset(e.target.value)} className="ml-1 rounded border border-slate-200 bg-white px-1 py-0.5 text-xs font-semibold text-slate-700 outline-none focus:border-emerald-400">
                <option value="1">1 day</option>
                <option value="3">3 days</option>
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
              </select>
            </label>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleCreateTasks()} disabled={actionLoading} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{actionLoading ? "Creating…" : "Create Tasks"}</button>
            <button type="button" onClick={() => setBulkAction(null)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      ) : null}

      {/* Segment tag panel */}
      {bulkAction === "segment" ? (
        <div className="mb-2 rounded-md border border-slate-200 bg-white p-3">
          <p className="mb-2 text-xs font-bold text-slate-800">Tag {selectedIds.size} donor{selectedIds.size === 1 ? "" : "s"} as a segment</p>
          <input
            type="text"
            value={segmentName}
            onChange={(e) => setSegmentName(e.target.value)}
            placeholder={`e.g. Monthly Donors ${new Date().toLocaleString("en-US", { month: "short", year: "numeric" })}`}
            className="mb-2 w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-800 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          />
          <div className="flex gap-2">
            <button type="button" onClick={() => void handleTagSegment()} disabled={actionLoading || !segmentName.trim()} className="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800 disabled:opacity-50">{actionLoading ? "Saving…" : "Save Segment"}</button>
            <button type="button" onClick={() => setBulkAction(null)} className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">Cancel</button>
          </div>
        </div>
      ) : null}

      {/* Donor list */}
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, index) => <div key={index} className="h-9 animate-pulse rounded bg-slate-100" />)}
        </div>
      ) : sorted.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">No completed gifts this month.</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {sorted.slice(0, 12).map((donor) => {
            const initials = donor.name.split(" ").map((w) => w[0] ?? "").slice(0, 2).join("").toUpperCase();
            const isSelected = selectedIds.has(donor.donorId);
            return (
              <div key={donor.donorId} className={`grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 py-1.5 ${isSelected ? "bg-emerald-50/60" : "hover:bg-slate-50"}`}>
                <input type="checkbox" checked={isSelected} onChange={() => toggleOne(donor.donorId)} className="cursor-pointer rounded border-slate-300 accent-emerald-600" />
                <Link href={donor.profileHref} tabIndex={-1} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[11px] font-bold text-emerald-800 ring-1 ring-emerald-200 hover:ring-emerald-400">
                  {initials || "?"}
                </Link>
                <Link href={donor.profileHref} className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">{donor.name}</span>
                  <span className="block truncate text-xs text-slate-500">{donor.count} gift{donor.count === 1 ? "" : "s"} · {donor.email ?? relativeDate(donor.lastGiftDate)}</span>
                </Link>
                <span className="text-right text-sm font-bold text-emerald-700">{formatCurrency(donor.amount)}</span>
              </div>
            );
          })}
        </div>
      )}
      {!loading && sorted.length > 12 ? (
        <p className="mt-2 text-center text-xs text-slate-400">{sorted.length - 12} more · <Link href="/donations?range=CURRENT_MONTH" className="font-semibold text-slate-600 hover:text-slate-900">view all</Link></p>
      ) : null}
    </CRMCard>
  );
}

/** Campaign progress bars for active fundraising campaigns. */
function CampaignProgressCard({ campaigns, loading, onExpand }: { campaigns: CampaignSummary[]; loading: boolean; onExpand?: () => void }) {
  const active = campaigns.filter((c) => c.active);
  return (
    <CRMCard padding="md" className="h-full min-h-[20rem] animate-slide-up-fade-in">
      <SectionHeader
        title="Campaign Progress"
        action={
          <div className="flex items-center gap-2">
            <Link href="/campaigns" className="text-xs font-semibold text-slate-500 hover:text-slate-900">All</Link>
            {onExpand ? <OpenWidgetButton onClick={onExpand} /> : null}
          </div>
        }
      >
        Active fundraising campaigns
      </SectionHeader>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-14 animate-pulse rounded bg-slate-100" />)}</div>
      ) : active.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">No active campaigns.</div>
      ) : (
        <div className="space-y-2.5">
          {active.map((campaign) => {
            const raised = toNumber(campaign.totalRaised);
            const goal = toNumber(campaign.goal);
            const pct = goal > 0 ? Math.min(100, Math.round((raised / goal) * 100)) : 0;
            const remaining = Math.max(0, goal - raised);
            return (
              <Link key={campaign.id} href={`/campaigns/${campaign.id}`} className="block rounded-md border border-slate-200 bg-white px-3 py-2.5 hover:border-emerald-200 hover:bg-emerald-50/40 transition-colors">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="truncate text-sm font-semibold text-slate-900">{campaign.name}</span>
                  <span className="shrink-0 text-xs font-bold text-emerald-700">{goal > 0 ? `${pct}%` : "–"}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>{formatCurrency(raised)} raised</span>
                  {goal > 0 ? <span>{remaining > 0 ? `${formatCurrency(remaining)} to go` : "Goal reached!"}</span> : <span>No goal set</span>}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </CRMCard>
  );
}

/** Lapsed donor alert panel — self-fetching, uses refreshNonce to re-fetch on dashboard refresh. */
function LapsedDonorsCard({ refreshNonce, onExpand }: { refreshNonce: number; onExpand?: () => void }) {
  const [lapsed, setLapsed] = useState<LapsedDonorItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void apiFetch<{ items?: LapsedDonorItem[] } | LapsedDonorItem[]>("/api/constituents?donorStatus=lapsed&limit=10&orderBy=lastGiftDate&order=desc")
      .then((data) => {
        if (!cancelled) {
          const items = Array.isArray(data) ? data : (data as { items?: LapsedDonorItem[] }).items ?? [];
          setLapsed(items);
        }
      })
      .catch(() => { if (!cancelled) setLapsed([]); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshNonce]);

  return (
    <CRMCard padding="md" className="h-full min-h-[20rem] animate-slide-up-fade-in">
      <SectionHeader
        title="Lapsed Donors"
        action={
          <div className="flex items-center gap-2">
            <Link href="/constituents?donorStatus=lapsed" className="text-xs font-semibold text-rose-600 hover:text-rose-800">View all</Link>
            {onExpand ? <OpenWidgetButton onClick={onExpand} /> : null}
          </div>
        }
      >
        Donors who haven&apos;t given recently
      </SectionHeader>
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded bg-slate-100" />)}</div>
      ) : lapsed.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-emerald-200 bg-emerald-50/40 text-xs text-emerald-700">No lapsed donors found — great retention!</div>
      ) : (
        <div className="divide-y divide-slate-100">
          {lapsed.map((donor) => {
            const name = `${donor.firstName} ${donor.lastName}`;
            const initials = [donor.firstName?.[0], donor.lastName?.[0]].filter(Boolean).join("").toUpperCase();
            return (
              <Link key={donor.id} href={`/constituents/${donor.id}`} className="grid grid-cols-[auto_1fr_auto] items-center gap-2.5 py-2 hover:bg-slate-50">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[11px] font-bold text-rose-800 ring-1 ring-rose-200">
                  {initials || "?"}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-900">{name}</span>
                  <span className="block truncate text-xs text-slate-500">Last gift: {donor.lastGiftDate ? relativeDate(donor.lastGiftDate) : "Unknown"}</span>
                </span>
                <span className="text-right">
                  <span className="block text-sm font-bold text-slate-700">{donor.totalLifetimeGiving != null ? formatCurrency(toNumber(donor.totalLifetimeGiving)) : "–"}</span>
                  <span className="block text-[10px] font-semibold text-rose-500">Lapsed</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}
      <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <Link href="/communications/new/type?segment=lapsed" className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700">Email Lapsed</Link>
        <Link href="/steward-paths?segment=lapsed" className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:border-emerald-200 hover:text-emerald-700">Steward Path</Link>
      </div>
    </CRMCard>
  );
}

/** Giving tier breakdown — Major / Mid-level / Annual Fund from the current filtered donation set. */
function GivingLevelsCard({ donations, total, loading, onExpand }: { donations: DonationPreview[]; total: number; loading: boolean; onExpand?: () => void }) {
  const levels = useMemo(() => [
    { label: "Major Gifts", threshold: 5000, color: "#7c3aed", bgClass: "bg-violet-100", textClass: "text-violet-800", count: 0, amount: 0 },
    { label: "Mid-Level",   threshold: 500,  color: "#2563eb", bgClass: "bg-blue-100",   textClass: "text-blue-800",   count: 0, amount: 0 },
    { label: "Annual Fund", threshold: 0,    color: "#059669", bgClass: "bg-emerald-100", textClass: "text-emerald-800", count: 0, amount: 0 },
  ].reduce<Array<{ label: string; threshold: number; color: string; bgClass: string; textClass: string; count: number; amount: number }>>((acc) => {
    const tiers = [...acc];
    donations.forEach((d) => {
      const a = toNumber(d.amount);
      if (a >= 5000) { tiers[0].count++; tiers[0].amount += a; }
      else if (a >= 500) { tiers[1].count++; tiers[1].amount += a; }
      else { tiers[2].count++; tiers[2].amount += a; }
    });
    return tiers;
  }, [
    { label: "Major Gifts", threshold: 5000, color: "#7c3aed", bgClass: "bg-violet-100", textClass: "text-violet-800", count: 0, amount: 0 },
    { label: "Mid-Level",   threshold: 500,  color: "#2563eb", bgClass: "bg-blue-100",   textClass: "text-blue-800",   count: 0, amount: 0 },
    { label: "Annual Fund", threshold: 0,    color: "#059669", bgClass: "bg-emerald-100", textClass: "text-emerald-800", count: 0, amount: 0 },
  ]), [donations]);

  return (
    <CRMCard padding="md" className="h-full min-h-[20rem] animate-slide-up-fade-in">
      <SectionHeader title="Giving Levels" action={onExpand ? <OpenWidgetButton onClick={onExpand} /> : undefined}>
        Gift tier breakdown for selected view
      </SectionHeader>
      {loading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded bg-slate-100" />)}</div>
      ) : donations.length === 0 ? (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">No gift data in selected view.</div>
      ) : (
        <div className="space-y-3">
          {levels.map((level) => {
            const pct = total > 0 ? Math.round((level.amount / total) * 100) : 0;
            return (
              <div key={level.label} className="rounded-md border border-slate-100 bg-white p-3">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${level.bgClass} ${level.textClass}`}>{level.count}</span>
                    <span className="text-sm font-semibold text-slate-800">{level.label}</span>
                  </div>
                  <span className="text-sm font-bold text-slate-950">{formatCurrency(level.amount)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: level.color }} />
                </div>
                <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
                  <span>{level.count} gift{level.count === 1 ? "" : "s"}</span>
                  <span>{pct}% of total</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </CRMCard>
  );
}

function DashboardToolsPanel({ onExpand }: { onExpand?: () => void }) {
  return (
    <CRMCard padding="md">
      <SectionHeader title="Dashboard Tools" action={onExpand ? <OpenWidgetButton onClick={onExpand} /> : undefined}>
        Fast access to the donor tools built so far
      </SectionHeader>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-6">
        {DASHBOARD_TOOL_ACTIONS.map((action) => (
          <Link key={action.label} href={action.href} className="group flex min-h-11 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700">
            <DashboardIcon name={action.icon} className="h-4 w-4 shrink-0 text-slate-500 group-hover:text-emerald-700" />
            <span className="min-w-0 truncate">{action.label}</span>
            {action.badge ? <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] text-emerald-700">{action.badge}</span> : null}
          </Link>
        ))}
      </div>
    </CRMCard>
  );
}

function RetentionRadialCard({ retentionRate, retained, total, loading, onExpand }: { retentionRate: number; retained: number; total: number; loading: boolean; onExpand?: () => void }) {
  const bounded = Math.max(0, Math.min(100, retentionRate));
  return (
    <CRMCard padding="md" className="h-full min-h-[20rem] animate-slide-up-fade-in bg-gradient-to-b from-white to-emerald-50/30">
      <SectionHeader title="Retention Health" action={onExpand ? <OpenWidgetButton onClick={onExpand} /> : undefined}>
        Returning donor cohort for the active reporting year
      </SectionHeader>
      <div className="grid min-h-0 gap-3 lg:grid-cols-[13rem_1fr] xl:grid-cols-1 2xl:grid-cols-[13rem_1fr]">
        <div className="relative mx-auto h-44 w-full max-w-[13rem]">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart innerRadius="66%" outerRadius="92%" data={[{ name: "Retention", value: bounded }]} startAngle={210} endAngle={-30}>
              <RadialBar dataKey="value" cornerRadius={12} fill="#059669" background={{ fill: "#d1fae5" }} isAnimationActive animationDuration={750} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold text-slate-950">{loading ? "--" : `${bounded}%`}</span>
            <span className="text-xs font-semibold text-emerald-700">Retained</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="rounded-md border border-emerald-100 bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Returning donors</p>
            <p className="mt-1 text-xl font-bold text-slate-950">{retained.toLocaleString()}</p>
          </div>
          <div className="rounded-md border border-slate-100 bg-white px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Prior cohort</p>
            <p className="mt-1 text-xl font-bold text-slate-950">{total.toLocaleString()}</p>
          </div>
          <p className="text-xs leading-5 text-slate-500">Use this as a stewardship signal: lower retention should pull staff toward lapsed donor lists, thank-you follow-up, and impact communications.</p>
        </div>
      </div>
    </CRMCard>
  );
}

function RecentActivityCard({ donations, loading, onExpand }: { donations: DonationPreview[]; loading: boolean; onExpand?: () => void }) {
  return (
    <CRMCard padding="md" className="min-h-[24rem]">
      <SectionHeader
        title="Recent Activity"
        action={<div className="flex items-center gap-2"><Link href="/donations" className="text-xs font-semibold text-slate-600 hover:text-slate-900">View all</Link>{onExpand ? <OpenWidgetButton onClick={onExpand} /> : null}</div>}
      >
        Latest filtered gifts across your organization
      </SectionHeader>
      {loading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 7 }).map((_, index) => <div key={index} className="h-10 animate-pulse rounded bg-slate-100" />)}
        </div>
      ) : donations.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 text-xs text-slate-400">
          No recent gifts match the current filters.
        </div>
      ) : (
        <div className="divide-y divide-slate-100">
          {donations.slice(0, 8).map((donation) => (
            <Link key={donation.id} href="/donations" className="grid grid-cols-[auto_1fr_auto] items-center gap-3 py-2.5 hover:bg-slate-50">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                <DashboardIcon name="donation" className="h-3.5 w-3.5" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-900">{getDonorName(donation)}</span>
                <span className="block truncate text-xs text-slate-500">{donation.campaign?.name ?? donation.designation?.name ?? "General giving"}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-sm font-bold text-emerald-700">{formatCurrency(toNumber(donation.amount))}</span>
                <span className={`mt-0.5 inline-flex rounded px-1.5 py-0.5 text-[10px] font-semibold ${methodColor(donation.paymentMethod)}`}>{methodLabel(donation.paymentMethod)}</span>
                <span className="block text-[10px] text-slate-400">{relativeDate(donation.date)}</span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </CRMCard>
  );
}

function TopReportsPanel({ onExpand }: { onExpand?: () => void }) {
  return (
    <CRMCard padding="md">
      <SectionHeader
        title="Your Top Reports"
        action={<div className="flex items-center gap-2"><Link href="/reports" className="text-xs font-semibold text-blue-600 hover:text-blue-700">View all reports</Link>{onExpand ? <OpenWidgetButton onClick={onExpand} /> : null}</div>}
      >
        Quick access to commonly used donor reports
      </SectionHeader>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {REPORT_SHORTCUTS.map((report) => (
          <Link key={report.label} href={report.href} className="group flex min-h-[4.5rem] items-center gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 transition-all hover:border-emerald-200 hover:bg-emerald-50">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 group-hover:bg-white">
              <DashboardIcon name={report.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold text-slate-900">{report.label}</span>
              <span className="block truncate text-xs text-slate-500">Open live report</span>
            </span>
          </Link>
        ))}
      </div>
    </CRMCard>
  );
}

function MetricDetail({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <CRMCard padding="lg">
      <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-3 text-5xl font-bold tracking-tight text-slate-950">{value}</p>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">{detail}</p>
    </CRMCard>
  );
}

function TodayAtAGlanceContent({
  tasks,
  tasksLoading,
  pendingTasks,
  overdueTasks,
  activeCampaigns,
  revenuePercent,
  revenueGoal,
  revenueGoalLabel,
  filteredGivingTotal,
  compact = false,
}: {
  tasks: TaskPreview[];
  tasksLoading: boolean;
  pendingTasks: number;
  overdueTasks: number;
  activeCampaigns: number;
  revenuePercent: number;
  revenueGoal: number;
  revenueGoalLabel: string;
  filteredGivingTotal: number;
  compact?: boolean;
}) {
  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="rounded-md border border-emerald-200 bg-white px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Focus</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">{overdueTasks > 0 ? "Overdue stewardship work needs attention" : "Stewardship queue is current"}</p>
        <p className="mt-1 text-xs leading-5 text-slate-500">{pendingTasks.toLocaleString()} open tasks · {overdueTasks.toLocaleString()} overdue · {activeCampaigns.toLocaleString()} campaigns</p>
      </div>
      <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue pace</p>
        <div className="mt-2 h-2 overflow-hidden rounded-sm bg-emerald-100">
          <div className="h-full rounded-sm bg-emerald-500" style={{ width: `${revenuePercent}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">{revenuePercent}% of {revenueGoalLabel} · {formatCurrency(Math.max(0, revenueGoal - filteredGivingTotal))} remaining</p>
      </div>
      <div className="rounded-md border border-slate-200 bg-white px-3 py-2">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Tasks due soon</p>
          <Link href="/tasks" className="text-xs font-semibold text-slate-600 hover:text-slate-900">View all</Link>
        </div>
        {tasksLoading ? (
          <div className="space-y-2">
            {Array.from({ length: compact ? 2 : 5 }).map((_, index) => <div key={index} className="h-8 animate-pulse rounded bg-slate-100" />)}
          </div>
        ) : tasks.length === 0 ? (
          <p className="rounded-md border border-dashed border-emerald-200 bg-emerald-50/60 px-3 py-4 text-center text-xs text-slate-500">No pending tasks due soon.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {tasks.slice(0, compact ? 3 : 8).map((task) => (
              <Link key={task.id} href="/tasks" className="grid grid-cols-[1fr_auto] items-center gap-3 py-2">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-slate-800">{task.title}</span>
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
      </div>
    </div>
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
    <div className="mb-3 flex min-w-0 items-center justify-between gap-3 border-b border-slate-200 pb-2">
      <div className="min-w-0">
        <h2 className="truncate text-sm font-semibold text-slate-950">{title}</h2>
        {children ? <div className="mt-1 text-xs text-slate-500">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
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
  onRefresh,
}: DonorDashboardVisualRefreshProps) {
  const [selectedRange, setSelectedRange] = useState<DashboardRangeId>("YTD");
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [campaigns, setCampaigns] = useState<CampaignSummary[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [tasks, setTasks] = useState<TaskPreview[]>([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [filteredDonations, setFilteredDonations] = useState<DonationPreview[]>([]);
  const [monthlyDonations, setMonthlyDonations] = useState<DonationPreview[]>([]);
  const [donationsLoading, setDonationsLoading] = useState(true);
  const [monthlyDonationsLoading, setMonthlyDonationsLoading] = useState(true);
  const [expandedWidget, setExpandedWidget] = useState<ExpandedDashboardWidget | null>(null);
  const selectedCampaign = useMemo(
    () => campaigns.find((campaign) => campaign.id === selectedCampaignId) ?? null,
    [campaigns, selectedCampaignId]
  );
  const filteredGivingTotal = filteredDonations.reduce((sum, donation) => sum + toNumber(donation.amount), 0);
  const filteredGiftCount = filteredDonations.length;
  const filteredAverageGift = filteredGiftCount > 0 ? filteredGivingTotal / filteredGiftCount : 0;
  const filteredDonorCount = new Set(filteredDonations.map((donation) => donation.constituent?.id).filter(Boolean)).size;
  const monthlyDonors = useMemo(() => buildMonthlyDonorList(monthlyDonations), [monthlyDonations]);
  const designationBreakdown = useMemo(() => buildDesignationBreakdown(filteredDonations), [filteredDonations]);
  const paymentMethodBreakdown = useMemo(() => buildPaymentMethodBreakdown(filteredDonations), [filteredDonations]);
  const selectedCampaignGoal = selectedCampaign ? toNumber(selectedCampaign.goal) : 0;
  const viewRevenueGoal = selectedCampaignGoal > 0 ? selectedCampaignGoal : revenueGoal;
  const revenuePercent = viewRevenueGoal > 0 ? Math.min(100, Math.round((filteredGivingTotal / viewRevenueGoal) * 100)) : 0;
  const revenueGoalLabel = selectedCampaignGoal > 0 ? `${selectedCampaign?.name ?? "Campaign"} goal` : "organization goal";
  const activeRange = DASHBOARD_RANGES.find((range) => range.id === selectedRange) ?? DASHBOARD_RANGES[2];
  const monthTrendLabel = monthTrend == null
    ? "vs last month unavailable"
    : `${monthTrend >= 0 ? "Up" : "Down"} ${Math.abs(Math.round(monthTrend))}% vs last month`;
  const monthTrendToneClass = monthTrend == null
    ? "text-slate-500"
    : monthTrend >= 0
      ? "text-emerald-700"
      : "text-rose-600";

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
  }, [refreshNonce]);

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
  }, [refreshNonce]);

  useEffect(() => {
    let cancelled = false;

    async function loadFilteredDonations() {
      setDonationsLoading(true);
      try {
        const data = await apiFetch<{ items?: DonationPreview[] } | DonationPreview[]>(buildDonationQuery(selectedRange, reportingYearMode, selectedCampaignId));
        const items = Array.isArray(data) ? data : data.items ?? [];
        if (!cancelled) setFilteredDonations(items);
      } catch {
        if (!cancelled) setFilteredDonations([]);
      } finally {
        if (!cancelled) setDonationsLoading(false);
      }
    }

    void loadFilteredDonations();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce, reportingYearMode, selectedCampaignId, selectedRange]);

  useEffect(() => {
    let cancelled = false;

    async function loadMonthlyDonations() {
      setMonthlyDonationsLoading(true);
      try {
        const data = await apiFetch<{ items?: DonationPreview[] } | DonationPreview[]>(buildDonationQuery("CURRENT_MONTH", reportingYearMode, selectedCampaignId));
        const items = Array.isArray(data) ? data : data.items ?? [];
        if (!cancelled) setMonthlyDonations(items);
      } catch {
        if (!cancelled) setMonthlyDonations([]);
      } finally {
        if (!cancelled) setMonthlyDonationsLoading(false);
      }
    }

    void loadMonthlyDonations();
    return () => {
      cancelled = true;
    };
  }, [refreshNonce, reportingYearMode, selectedCampaignId]);

  function handleRefresh() {
    onRefresh();
    setRefreshNonce((value) => value + 1);
  }

  function renderExpandedWidget() {
    switch (expandedWidget) {
      case "giving":
        return <FilteredGivingTrendChart donations={filteredDonations} rangeId={selectedRange} loading={donationsLoading} expanded />;
      case "recent":
        return <RecentActivityCard donations={filteredDonations} loading={donationsLoading} />;
      case "monthly-givers":
        return <MonthlyGiversCard donors={monthlyDonors} loading={monthlyDonationsLoading} />;
      case "designation":
        return <DesignationBreakdownCard items={designationBreakdown} loading={donationsLoading} />;
      case "source":
        return <PaymentSourceBreakdownCard items={paymentMethodBreakdown} total={filteredGivingTotal} loading={donationsLoading} />;
      case "today":
        return <TodayAtAGlanceContent tasks={tasks} tasksLoading={tasksLoading} pendingTasks={pendingTasks} overdueTasks={overdueTasks} activeCampaigns={activeCampaigns} revenuePercent={revenuePercent} revenueGoal={viewRevenueGoal} revenueGoalLabel={revenueGoalLabel} filteredGivingTotal={filteredGivingTotal} />;
      case "reports":
        return <TopReportsPanel />;
      case "tools":
        return <DashboardToolsPanel />;
      case "metric-giving":
        return <MetricDetail title="Filtered Giving" value={formatCurrency(filteredGivingTotal)} detail={`${filteredGiftCount.toLocaleString()} completed gifts in the selected view across all payment sources.`} />;
      case "metric-donors":
        return <MetricDetail title="Donors In View" value={filteredDonorCount.toLocaleString()} detail={`Unique donors in the filtered completed-gift dataset. ${totalConstituents.toLocaleString()} total constituents exist in this workspace.`} />;
      case "metric-new-donors":
        return <MetricDetail title="New Donors" value={newDonorsThisMonth.toLocaleString()} detail="New donors in the selected reporting year from the dashboard summary endpoint." />;
      case "metric-average":
        return <MetricDetail title="Average Gift" value={formatCurrency(filteredAverageGift)} detail="Average gift amount from the selected completed donations." />;
      case "metric-tasks":
        return <MetricDetail title="Open Tasks" value={pendingTasks.toLocaleString()} detail={`${overdueTasks.toLocaleString()} tasks are overdue across the organization queue.`} />;
      case "metric-retention":
        return <MetricDetail title="Retention Rate" value={`${retentionRate}%`} detail={`${retentionRetained.toLocaleString()} of ${retentionTotal.toLocaleString()} donors retained this reporting year.`} />;
      case "campaign-progress":
        return <CampaignProgressCard campaigns={campaigns} loading={campaignsLoading} />;
      case "lapsed":
        return <LapsedDonorsCard refreshNonce={refreshNonce} />;
      case "giving-levels":
        return <GivingLevelsCard donations={filteredDonations} total={filteredGivingTotal} loading={donationsLoading} />;
      default:
        return null;
    }
  }

  return (
    <div className="space-y-4 bg-slate-50/40 pb-6">
      <div className="animate-slide-up-fade-in rounded-md border border-slate-200 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-950">{greeting}, {name.split(" ")[0] || name}</h1>
          <p className="mt-1 text-sm font-medium text-slate-500">Here&apos;s what&apos;s happening with your mission today. {loading ? "Refreshing data..." : dataThroughLabel}</p>
        </div>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCreateMenuOpen((open) => !open)}
            className="inline-flex h-9 items-center gap-2 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800"
          >
            <DashboardIcon name="plus" className="h-4 w-4" />
            Create
            <DashboardIcon name="chevron" className="h-4 w-4" />
          </button>
          {createMenuOpen ? (
            <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-md border border-slate-200 bg-white shadow-xl">
              {QUICK_ACTIONS.slice(0, 6).map((action) => (
                <Link key={action.label} href={action.href} className="flex items-center gap-3 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-emerald-50 hover:text-emerald-700" onClick={() => setCreateMenuOpen(false)}>
                  <DashboardIcon name={action.icon} className="h-4 w-4" />
                  {action.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      </div>

      <DashboardCommandRibbon
        selectedRange={selectedRange}
        setSelectedRange={setSelectedRange}
        selectedCampaignId={selectedCampaignId}
        setSelectedCampaignId={setSelectedCampaignId}
        campaigns={campaigns}
        campaignsLoading={campaignsLoading}
        reportingYearMode={reportingYearMode}
        activeRange={activeRange}
        onRefresh={handleRefresh}
        onOpenWidget={setExpandedWidget}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <DashboardMetricCard label="Filtered Giving" value={formatCurrency(filteredGivingTotal)} helper={`${filteredGiftCount.toLocaleString()} gifts in view`} icon="donation" tone="emerald" loading={donationsLoading} progressPercent={revenuePercent} progressLabel={`${revenuePercent}% of ${revenueGoalLabel}`} onExpand={() => setExpandedWidget("metric-giving")} />
        <DashboardMetricCard label="Donors In View" value={filteredDonorCount.toLocaleString()} helper={`${totalConstituents.toLocaleString()} total constituents`} icon="constituent" tone="blue" loading={donationsLoading} progressPercent={totalConstituents > 0 ? (filteredDonorCount / totalConstituents) * 100 : null} progressLabel="of constituent file" onExpand={() => setExpandedWidget("metric-donors")} />
        <DashboardMetricCard label="New Donors" value={newDonorsThisMonth.toLocaleString()} helper="Selected reporting year" icon="gift" tone="violet" loading={loading} progressPercent={totalConstituents > 0 ? (newDonorsThisMonth / totalConstituents) * 100 : null} progressLabel="of constituent file" onExpand={() => setExpandedWidget("metric-new-donors")} />
        <DashboardMetricCard label="Avg. Gift" value={formatCurrency(filteredAverageGift)} helper="Selected filters" icon="average" tone="cyan" loading={donationsLoading} progressLabel="live average from gifts" onExpand={() => setExpandedWidget("metric-average")} />
        <DashboardMetricCard label="Open Tasks" value={pendingTasks.toLocaleString()} helper={overdueTasks > 0 ? `${overdueTasks} org tasks overdue` : "Org queue is current"} icon="task" tone="orange" loading={loading} progressPercent={pendingTasks > 0 ? (overdueTasks / pendingTasks) * 100 : 0} progressLabel="overdue share" onExpand={() => setExpandedWidget("metric-tasks")} />
        <DashboardMetricCard label="Retention Rate" value={`${retentionRate}%`} helper={`${retentionRetained.toLocaleString()} of ${retentionTotal.toLocaleString()} retained this reporting year`} icon="pulse" tone="emerald" loading={loading} progressPercent={retentionRate} progressLabel="cohort retained" onExpand={() => setExpandedWidget("metric-retention")} />
      </div>

      <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.72fr)]">
        <CRMCard padding="md" className="min-h-[18rem] animate-slide-up-fade-in">
          <SectionHeader
            title="Giving Overview"
            action={<div className="flex items-center gap-2"><span className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600">{activeRange.label}</span><OpenWidgetButton onClick={() => setExpandedWidget("giving")} /></div>}
          >
            Total giving over time
          </SectionHeader>
          <div className="mb-4">
            <p className="text-3xl font-bold tracking-tight text-slate-950">{formatCurrency(filteredGivingTotal)}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">{activeRange.label} · {selectedCampaignId ? "selected campaign" : "all campaigns"} · {revenuePercent}% of {revenueGoalLabel}</p>
          </div>
          <FilteredGivingTrendChart donations={filteredDonations} rangeId={selectedRange} loading={donationsLoading} />
          <div className="mt-3 grid grid-cols-2 gap-2 border-t border-emerald-100 pt-3 md:grid-cols-5">
            <div className="rounded-md bg-emerald-50/70 px-3 py-2">
              <p className="text-xl font-semibold text-slate-950">{formatCurrency(filteredGivingTotal)}</p>
              <p className="mt-1 text-xs text-slate-500">Selected Total</p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xl font-semibold text-slate-950">{formatCurrency(filteredAverageGift)}</p>
              <p className="mt-1 text-xs text-slate-500">Avg. Gift</p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className={`text-xl font-semibold ${monthTrendToneClass}`}>{monthTrend == null ? "-" : `${monthTrend >= 0 ? "+" : ""}${Math.round(monthTrend)}%`}</p>
              <p className="mt-1 text-xs text-slate-500">{monthTrendLabel}</p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xl font-semibold text-slate-950">{formatCurrency(monthAmount)}</p>
              <p className="mt-1 text-xs text-slate-500">Org Month Total</p>
            </div>
            <div className="rounded-md bg-slate-50 px-3 py-2">
              <p className="text-xl font-semibold text-emerald-700">{filteredGiftCount.toLocaleString()}</p>
              <p className="mt-1 text-xs text-slate-500">Filtered Gifts</p>
            </div>
          </div>
        </CRMCard>

        <RecentActivityCard donations={filteredDonations} loading={donationsLoading} onExpand={() => setExpandedWidget("recent")} />
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-2 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1fr)_minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <MonthlyGiversCard donors={monthlyDonors} loading={monthlyDonationsLoading} onExpand={() => setExpandedWidget("monthly-givers")} />

        <DesignationBreakdownCard items={designationBreakdown} loading={donationsLoading} onExpand={() => setExpandedWidget("designation")} />

        <PaymentSourceBreakdownCard items={paymentMethodBreakdown} total={filteredGivingTotal} loading={donationsLoading} onExpand={() => setExpandedWidget("source")} />

        <CRMCard padding="md" className="h-full min-h-[20rem] animate-slide-up-fade-in bg-gradient-to-b from-white to-emerald-50/35">
          <SectionHeader title="Today At A Glance" action={<OpenWidgetButton onClick={() => setExpandedWidget("today")} />}>
            Key movement and next actions
          </SectionHeader>
          <div className="space-y-2">
            <TodayAtAGlanceContent tasks={tasks} tasksLoading={tasksLoading} pendingTasks={pendingTasks} overdueTasks={overdueTasks} activeCampaigns={activeCampaigns} revenuePercent={revenuePercent} revenueGoal={viewRevenueGoal} revenueGoalLabel={revenueGoalLabel} filteredGivingTotal={filteredGivingTotal} compact />
            <StewardContextButton
              label="Ask Steward for priorities"
              prompt={`Summarize this DonorCRM dashboard. Filtered giving is $${filteredGivingTotal.toLocaleString()}, the selected view has ${filteredGiftCount} gifts and ${filteredDonorCount} donors, total constituents are ${totalConstituents}, retention is ${retentionRate}%, open tasks are ${pendingTasks}, active campaigns are ${activeCampaigns}. What should staff focus on today?`}
              moduleKey="donor"
              mode="ask"
              variant="mini"
            />
          </div>
        </CRMCard>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
        <RetentionRadialCard retentionRate={retentionRate} retained={retentionRetained} total={retentionTotal} loading={loading} onExpand={() => setExpandedWidget("metric-retention")} />
        <TopReportsPanel onExpand={() => setExpandedWidget("reports")} />
      </div>

      {/* Campaign / Lapsed / Giving-level intelligence row */}
      <div className="grid grid-cols-1 items-stretch gap-3 xl:grid-cols-3">
        <CampaignProgressCard campaigns={campaigns} loading={campaignsLoading} onExpand={() => setExpandedWidget("campaign-progress")} />
        <LapsedDonorsCard refreshNonce={refreshNonce} onExpand={() => setExpandedWidget("lapsed")} />
        <GivingLevelsCard donations={filteredDonations} total={filteredGivingTotal} loading={donationsLoading} onExpand={() => setExpandedWidget("giving-levels")} />
      </div>

      {expandedWidget ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/55 p-4" role="dialog" aria-modal="true">
          <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
              <h2 className="text-sm font-bold uppercase tracking-wide text-slate-700">Dashboard widget</h2>
              <button type="button" onClick={() => setExpandedWidget(null)} className="rounded-md border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">Close</button>
            </div>
            <div className="overflow-auto bg-slate-50 p-4">
              {renderExpandedWidget()}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
