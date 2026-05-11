/**
 * Reports & Analytics page — comprehensive fundraising analytics with tabbed sections.
 * Tabs: Overview | Donors | Giving | Campaigns | Retention
 * All charts are pure CSS/SVG/Tailwind (no external chart library).
 */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import ReportsModuleToolbar, {
  getDefaultReportsTool,
  type ReportsToolId,
  type ReportsWorkspaceModule,
} from "@/app/components/reports/ReportsModuleToolbar";
import { apiFetch } from "@/app/lib/auth-client";

// ─── Constants ─────────────────────────────────────────────────────────────────

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: 5 }, (_, i) => CURRENT_YEAR - i);

type TabId = "overview" | "donors" | "giving" | "campaigns" | "retention";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "donors", label: "Donors" },
  { id: "giving", label: "Giving" },
  { id: "campaigns", label: "Campaigns" },
  { id: "retention", label: "Retention" },
];

/** Resolves a safe report tab id from URL query input. */
function parseTabId(rawTab: string | null): TabId {
  if (!rawTab) return "overview";
  const match = TABS.find((tab) => tab.id === rawTab);
  return match ? match.id : "overview";
}

/** Resolves a safe reports workspace module id from URL query input. */
function parseReportsModule(rawModule: string | null): ReportsWorkspaceModule {
  if (!rawModule) return "donor";
  const validModules: ReportsWorkspaceModule[] = ["donor", "events", "compassion", "ogentic"];
  return validModules.includes(rawModule as ReportsWorkspaceModule) ? (rawModule as ReportsWorkspaceModule) : "donor";
}

// ─── Type Definitions ──────────────────────────────────────────────────────────

/** Shape from GET /api/reports/summary */
interface Summary {
  totalConstituents: number;
  ytdAmount: number;
  ytdCount: number;
  /** YTD awarded grant total — always returned; add to ytdAmount when includeGrants=true */
  ytdGrantAmount: number;
  weekAmount: number;
  weekCount: number;
  weekAvg: number;
  activeCampaigns: number;
  activeGoalTotal: number;
  pendingTasks: number;
  overdueTasks: number;
}

/** Inner summary object from GET /api/reports/board-summary */
interface BoardSummary {
  ytdRevenue: number;
  ytdGoal: number;
  /** YTD awarded grant revenue — always returned; add when includeGrants=true */
  ytdGrantRevenue: number;
  donorRetentionRate: number;
  totalDonors: number;
  newDonorsYtd: number;
  totalGiftsYtd: number;
  averageGift: number;
  majorGiftCount: number;
}

/** Full response from GET /api/reports/board-summary */
interface BoardSummaryResponse {
  summary: BoardSummary;
  monthlyTrend: { label: string; amount: number }[];
}

/** Monthly giving data point from GET /api/reports/giving-by-month */
interface MonthlyDatum {
  month: number;
  amount: number;
  /** Awarded grant amount for this month — may be 0 */
  grantAmount?: number;
}

/** Donor retention data from GET /api/reports/donor-retention */
interface Retention {
  total: number;
  retained: number;
  rate: number;
  year: number;
}

/** Top donor row from GET /api/reports/top-donors */
interface TopDonor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  totalLifetimeGiving: number | string;
  lastGiftDate?: string | null;
  donorStatus: string;
}

/** LYBUNT / SYBUNT donor row from GET /api/reports/lybunt or /sybunt */
interface LybuntDonor {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  lastGiftDate?: string | null;
  lastGiftAmount?: number | string | null;
  totalLifetimeGiving: number | string;
  donorStatus: string;
}

/** Year-over-year comparison data point from GET /api/reports/year-comparison */
interface YearComparisonDatum {
  month: number;
  thisYear: number;
  lastYear: number;
}

/** Campaign performance record from GET /api/reports/campaign-performance */
interface CampaignPerformance {
  id: string;
  name: string;
  goal: number | null;
  active: boolean;
  startDate: string;
  endDate: string | null;
  raised: number;
  giftCount: number;
  uniqueDonors: number;
  avgGift: number;
}

/** Individual tier stats for giving-by-tier */
interface TierData {
  count: number;
  amount: number;
}

/** Response from GET /api/reports/giving-by-tier */
interface GivingByTier {
  micro: TierData;
  small: TierData;
  mid: TierData;
  major: TierData;
}

/** Payment method breakdown item from GET /api/reports/payment-breakdown */
interface PaymentBreakdownItem {
  paymentMethod: string;
  count: number;
  amount: number;
}

/** Donor segment counts from GET /api/reports/donor-segments */
interface DonorSegments {
  ACTIVE: number;
  LAPSED: number;
  NEW: number;
  MAJOR_DONOR: number;
  PROSPECT: number;
  DECEASED: number;
  OTHER: number;
}

/** New vs returning data point from GET /api/reports/new-vs-returning */
interface NewVsReturningDatum {
  month: number;
  newCount: number;
  returningCount: number;
}

/** Events CRM reporting summary payload from GET /api/events/reports/summary. */
interface EventsSummaryReport {
  totalEvents: number;
  totalRevenue: number;
  totalAttendees: number;
  topEvents: Array<{
    id: string;
    name: string;
    type: string;
    startDate: string;
    revenue: number;
    guests: number;
    checkedIn: number;
  }>;
}

/** Compassion CRM reporting summary payload from GET /api/compassion/reports/summary. */
interface CompassionSummaryReport {
  generatedAt: string;
  kpis: {
    totalClients: number;
    activeCases: number;
    newClientsThisMonth: number;
    appointmentsThisMonth: number;
    completedAppointmentsThisMonth: number;
    completionRate: number;
  };
  casesByType: Array<{ label: string; value: number }>;
  casesByStatus: Array<{ label: string; value: number }>;
  appointmentsByType: Array<{ label: string; value: number }>;
}

// ─── Helper Functions ──────────────────────────────────────────────────────────

/** Format a number as a compact US dollar integer string (no decimals). */
function fmtCurrency(n: number): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Format an ISO date string to a readable short form, or return "—". */
function fmtDate(s: string | null | undefined): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Tailwind classes for a donor status badge. */
function statusBadgeClass(s: string): string {
  switch (s) {
    case "ACTIVE": return "bg-green-50 text-green-700";
    case "MAJOR_DONOR": return "bg-amber-50 text-amber-700";
    case "LAPSED": return "bg-red-50 text-red-600";
    case "NEW": return "bg-blue-50 text-blue-700";
    case "DECEASED": return "bg-gray-100 text-gray-500";
    default: return "bg-gray-100 text-gray-500";
  }
}

/** Human-readable label for a donor status enum value. */
function statusLabel(s: string): string {
  if (s === "MAJOR_DONOR") return "Major Donor";
  return s.charAt(0) + s.slice(1).toLowerCase();
}

/**
 * Export an array of plain objects to a CSV file download.
 * Creates a temporary anchor element to trigger the browser file-save dialog.
 */
function exportCSV(data: Record<string, unknown>[], filename: string): void {
  if (data.length === 0) {
    console.log("No data to export for current view.");
    return;
  }
  const keys = Object.keys(data[0]);
  const header = keys.join(",");
  const rows = data.map((row) =>
    keys
      .map((k) => {
        const v = row[k];
        if (v === null || v === undefined) return "";
        const s = String(v);
        // Wrap fields that contain commas, quotes, or newlines in double-quotes
        return s.includes(",") || s.includes('"') || s.includes("\n")
          ? `"${s.replace(/"/g, '""')}"`
          : s;
      })
      .join(",")
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Sub-Components ────────────────────────────────────────────────────────────

/** Animated loading skeleton placeholder. */
function Sk({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />;
}

/**
 * Simple single-series bar chart using CSS flex layout.
 * No SVG — each bar is a div with percentage height.
 */
function BarChart({
  data,
  height = 160,
}: {
  data: MonthlyDatum[];
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.amount), 1);
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d) => {
        const pct = max > 0 ? Math.max(4, (d.amount / max) * 100) : 4;
        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
            <div
              className="w-full bg-green-500 rounded-t hover:bg-green-600 transition-colors cursor-default"
              style={{ height: `${pct}%` }}
              title={`${MONTHS_SHORT[d.month - 1]}: $${fmtCurrency(d.amount)}`}
            />
            <span className="text-[9px] text-gray-400">{MONTHS_SHORT[d.month - 1]}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Donut chart rendered as an SVG circle with strokeDasharray.
 * rate: 0–100. The circle circumference is normalised to 100.
 */
function DonutChart({ rate, size = 96 }: { rate: number; size?: number }) {
  const clamp = Math.max(0, Math.min(100, rate));
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} className="-rotate-90">
      <circle cx="18" cy="18" r="15.915" fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="18"
        cy="18"
        r="15.915"
        fill="none"
        stroke="#16a34a"
        strokeWidth="3"
        strokeDasharray={`${clamp} ${100 - clamp}`}
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * SVG grouped bar chart for year-over-year revenue comparison.
 * thisYear bars are green; lastYear bars are gray.
 * Each month group contains two side-by-side rect elements.
 */
function YoYChart({
  data,
  thisYear,
  lastYear,
}: {
  data: YearComparisonDatum[];
  thisYear: number;
  lastYear: number;
}) {
  const max = Math.max(...data.flatMap((d) => [d.thisYear, d.lastYear]), 1);
  const W = 700;
  const H = 200;
  const PAD_L = 48;
  const PAD_B = 28;
  const PAD_T = 10;
  const chartW = W - PAD_L - 10;
  const chartH = H - PAD_B - PAD_T;
  const groupW = chartW / 12;
  const barW = Math.floor(groupW * 0.34);
  const gap = Math.floor(groupW * 0.04);

  return (
    <div>
      {/* Legend */}
      <div className="flex gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-500" />
          {thisYear}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-gray-300" />
          {lastYear}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 220 }}>
        {/* Horizontal grid lines at 0%, 50%, 100% */}
        {[0, 0.5, 1].map((pct) => {
          const y = PAD_T + chartH - pct * chartH;
          const val = Math.round(max * pct);
          return (
            <g key={pct}>
              <line x1={PAD_L} y1={y} x2={W - 10} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
              <text x={PAD_L - 4} y={y + 3} textAnchor="end" fontSize="8" fill="#9ca3af">
                {val >= 1000 ? `$${Math.round(val / 1000)}k` : `$${val}`}
              </text>
            </g>
          );
        })}

        {/* Month groups with two bars each */}
        {data.map((d, i) => {
          const x0 = PAD_L + i * groupW + (groupW - barW * 2 - gap) / 2;
          const thisH = max > 0 ? (d.thisYear / max) * chartH : 0;
          const lastH = max > 0 ? (d.lastYear / max) * chartH : 0;
          const thisY = PAD_T + chartH - thisH;
          const lastY = PAD_T + chartH - lastH;
          const labelX = PAD_L + (i + 0.5) * groupW;
          return (
            <g key={d.month}>
              {thisH > 0 && (
                <rect x={x0} y={thisY} width={barW} height={thisH} fill="#22c55e" rx="1">
                  <title>
                    {MONTHS_SHORT[d.month - 1]} {thisYear}: ${fmtCurrency(d.thisYear)}
                  </title>
                </rect>
              )}
              {lastH > 0 && (
                <rect x={x0 + barW + gap} y={lastY} width={barW} height={lastH} fill="#d1d5db" rx="1">
                  <title>
                    {MONTHS_SHORT[d.month - 1]} {lastYear}: ${fmtCurrency(d.lastYear)}
                  </title>
                </rect>
              )}
              <text x={labelX} y={H - 6} textAnchor="middle" fontSize="8" fill="#9ca3af">
                {MONTHS_SHORT[d.month - 1]}
              </text>
            </g>
          );
        })}

        {/* Baseline */}
        <line
          x1={PAD_L}
          y1={PAD_T + chartH}
          x2={W - 10}
          y2={PAD_T + chartH}
          stroke="#e5e7eb"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}

/**
 * Stacked bar chart for new vs returning donors by month.
 * New donors are blue (top); returning donors are green (bottom).
 */
function NewVsReturningChart({ data }: { data: NewVsReturningDatum[] }) {
  const max = Math.max(...data.map((d) => d.newCount + d.returningCount), 1);
  const H = 140;
  return (
    <div>
      <div className="flex gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-400" />
          New donors
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 rounded-sm bg-green-400" />
          Returning
        </span>
      </div>
      <div className="flex items-end gap-1" style={{ height: H }}>
        {data.map((d) => {
          const total = d.newCount + d.returningCount;
          const totalPct = max > 0 ? Math.max(4, (total / max) * 100) : 4;
          const newPct = total > 0 ? (d.newCount / total) * 100 : 0;
          const retPct = total > 0 ? (d.returningCount / total) * 100 : 100;
          return (
            <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
              <div
                className="w-full flex flex-col-reverse overflow-hidden rounded-t"
                style={{ height: `${totalPct}%` }}
                title={`${MONTHS_SHORT[d.month - 1]}: ${d.newCount} new, ${d.returningCount} returning`}
              >
                {/* Returning (green) stacks on bottom, new (blue) on top */}
                <div className="bg-green-400 flex-none" style={{ height: `${retPct}%` }} />
                <div className="bg-blue-400 flex-none" style={{ height: `${newPct}%` }} />
              </div>
              <span className="text-[9px] text-gray-400">{MONTHS_SHORT[d.month - 1]}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Reusable table for LYBUNT and SYBUNT donor lists.
 * Includes a "View Profile" link to the constituent detail page.
 */
function LybuntTable({ donors, loading }: { donors: LybuntDonor[]; loading: boolean }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50">
            {["Name", "Last Gift Date", "Last Gift", "Lifetime Giving", "Status", ""].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {loading ? (
            Array.from({ length: 4 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 6 }).map((__, j) => (
                  <td key={j} className="px-4 py-3">
                    <Sk className="h-4 w-20" />
                  </td>
                ))}
              </tr>
            ))
          ) : donors.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                No donors in this segment.
              </td>
            </tr>
          ) : (
            donors.map((d) => (
              <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-medium text-gray-900">
                  {d.firstName} {d.lastName}
                </td>
                <td className="px-4 py-3 text-gray-500">{fmtDate(d.lastGiftDate)}</td>
                <td className="px-4 py-3 text-gray-700">
                  {d.lastGiftAmount != null ? `$${fmtCurrency(Number(d.lastGiftAmount))}` : "—"}
                </td>
                <td className="px-4 py-3 font-semibold text-gray-800">
                  ${fmtCurrency(Number(d.totalLifetimeGiving))}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(d.donorStatus)}`}
                  >
                    {statusLabel(d.donorStatus)}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/constituents/${d.id}`}
                    className="text-green-600 hover:text-green-700 text-xs font-medium"
                  >
                    View →
                  </Link>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Page Component ───────────────────────────────────────────────────────

/**
 * Reports & Analytics page.
 *
 * Loads overview data on mount and whenever the year selector changes.
 * Other tabs load their data lazily the first time they are activated.
 * Uses a ref-based "loaded" tracker (keyed by "tab:year") to prevent
 * duplicate fetches without needing a dependency array for every loader.
 */
export default function ReportsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── Global UI state ───────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState<ReportsWorkspaceModule>(() => parseReportsModule(searchParams.get("module")));
  const [activeTool, setActiveTool] = useState<ReportsToolId>(() => getDefaultReportsTool(parseReportsModule(searchParams.get("module"))));
  const [activeTab, setActiveTab] = useState<TabId>(() => parseTabId(searchParams.get("tab")));
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [allYears, setAllYears] = useState(false);

  /**
   * Whether to include awarded grants in YTD revenue figures.
   * Persisted to localStorage so the preference survives page reloads.
   */
  const [includeGrants, setIncludeGrants] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("reports-include-grants") === "true";
  });

  function toggleGrants() {
    setIncludeGrants((v) => {
      const next = !v;
      localStorage.setItem("reports-include-grants", next ? "true" : "false");
      return next;
    });
  }

  // ── Overview tab data ─────────────────────────────────────────────────────
  const [summary, setSummary] = useState<Summary | null>(null);
  const [boardSummary, setBoardSummary] = useState<BoardSummary | null>(null);
  const [monthly, setMonthly] = useState<MonthlyDatum[]>([]);
  const [retention, setRetention] = useState<Retention | null>(null);
  const [topDonors, setTopDonors] = useState<TopDonor[]>([]);
  const [donorSegments, setDonorSegments] = useState<DonorSegments | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(false);

  // ── Donors tab data ───────────────────────────────────────────────────────
  const [lybunt, setLybunt] = useState<LybuntDonor[]>([]);
  const [sybunt, setSybunt] = useState<LybuntDonor[]>([]);
  const [newVsReturning, setNewVsReturning] = useState<NewVsReturningDatum[]>([]);
  const [showSybunt, setShowSybunt] = useState(false);
  const [loadingDonors, setLoadingDonors] = useState(false);

  // ── Giving tab data ───────────────────────────────────────────────────────
  const [yearComparison, setYearComparison] = useState<YearComparisonDatum[]>([]);
  const [givingByTier, setGivingByTier] = useState<GivingByTier | null>(null);
  const [paymentBreakdown, setPaymentBreakdown] = useState<PaymentBreakdownItem[]>([]);
  const [loadingGiving, setLoadingGiving] = useState(false);

  // ── Campaigns tab data ────────────────────────────────────────────────────
  const [campaigns, setCampaigns] = useState<CampaignPerformance[]>([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);

  // ── Retention tab ─────────────────────────────────────────────────────────
  const [loadingRetention, setLoadingRetention] = useState(false);

  // ── Cross-module reporting data (inside OyamaREPORTIT) ───────────────────
  const [eventsSummary, setEventsSummary] = useState<EventsSummaryReport | null>(null);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);

  const [compassionSummary, setCompassionSummary] = useState<CompassionSummaryReport | null>(null);
  const [compassionLoading, setCompassionLoading] = useState(false);
  const [compassionError, setCompassionError] = useState<string | null>(null);

  const [ogenticArtifactsCount, setOGenticArtifactsCount] = useState({ drafts: 0, reports: 0, analyses: 0 });

  /**
   * Tracks which "tab:scope" combos have already been fetched.
   * Scope key includes both selected year and all-years mode.
   */
  const loadedRef = useRef<Record<string, boolean>>({});

  function scopeQueryString(y: number): string {
    const params = new URLSearchParams();
    if (allYears) {
      params.set("scope", "ALL_YEARS");
      params.set("year", String(y));
    } else {
      params.set("year", String(y));
    }
    return params.toString();
  }

  function scopeCacheKey(y: number): string {
    return `${y}:${allYears ? "ALL_YEARS" : "YEAR"}`;
  }

  function isLoaded(tab: string, key: string): boolean {
    return !!loadedRef.current[`${tab}:${key}`];
  }
  function markLoaded(tab: string, key: string): void {
    loadedRef.current[`${tab}:${key}`] = true;
  }

  // ── Data loaders ──────────────────────────────────────────────────────────

  /** Fetch all data needed by the Overview tab in a single parallel batch. */
  async function loadOverview(y: number) {
    const scope = scopeQueryString(y);
    const key = scopeCacheKey(y);
    if (isLoaded("overview", key)) return;
    markLoaded("overview", key);
    setLoadingOverview(true);
    try {
      const [s, bs, m, r, td, ds] = await Promise.all([
        apiFetch<Summary>(`/api/reports/summary?${scope}`),
        apiFetch<BoardSummaryResponse>(`/api/reports/board-summary?${scope}`),
        apiFetch<MonthlyDatum[]>(`/api/reports/giving-by-month?${scope}`),
        apiFetch<Retention>(`/api/reports/donor-retention?year=${y}`),
        apiFetch<TopDonor[]>(`/api/reports/top-donors?limit=5&${scope}`),
        apiFetch<DonorSegments>("/api/reports/donor-segments"),
      ]);
      setSummary(s);
      setBoardSummary(bs.summary);
      setMonthly(Array.isArray(m) ? m : []);
      setRetention(r);
      setTopDonors(Array.isArray(td) ? td : []);
      setDonorSegments(ds);
    } catch (err) {
      console.error("Failed to load overview data:", err);
    } finally {
      setLoadingOverview(false);
    }
  }

  /** Fetch LYBUNT, SYBUNT, and new-vs-returning data for the Donors tab. */
  async function loadDonors(y: number) {
    const key = scopeCacheKey(y);
    if (isLoaded("donors", key)) return;
    markLoaded("donors", key);
    setLoadingDonors(true);
    try {
      const [l, sy, nvr] = await Promise.all([
        apiFetch<LybuntDonor[]>(`/api/reports/lybunt?year=${y}`),
        apiFetch<LybuntDonor[]>(`/api/reports/sybunt?year=${y}`),
        apiFetch<NewVsReturningDatum[]>(`/api/reports/new-vs-returning?year=${y}`),
      ]);
      setLybunt(Array.isArray(l) ? l : []);
      setSybunt(Array.isArray(sy) ? sy : []);
      setNewVsReturning(Array.isArray(nvr) ? nvr : []);
    } catch (err) {
      console.error("Failed to load donors data:", err);
    } finally {
      setLoadingDonors(false);
    }
  }

  /** Fetch YoY comparison, tier breakdown, and payment breakdown for the Giving tab. */
  async function loadGiving(y: number) {
    const scope = scopeQueryString(y);
    const key = scopeCacheKey(y);
    if (isLoaded("giving", key)) return;
    markLoaded("giving", key);
    setLoadingGiving(true);
    try {
      const [yc, tier, pay] = await Promise.all([
        apiFetch<YearComparisonDatum[]>(`/api/reports/year-comparison?year=${y}`),
        apiFetch<GivingByTier>(`/api/reports/giving-by-tier?${scope}`),
        apiFetch<PaymentBreakdownItem[]>(`/api/reports/payment-breakdown?${scope}`),
      ]);
      setYearComparison(Array.isArray(yc) ? yc : []);
      setGivingByTier(tier);
      setPaymentBreakdown(Array.isArray(pay) ? pay : []);
    } catch (err) {
      console.error("Failed to load giving data:", err);
    } finally {
      setLoadingGiving(false);
    }
  }

  /** Fetch campaign performance data for the selected report scope. */
  async function loadCampaigns(y: number) {
    const scope = scopeQueryString(y);
    const key = scopeCacheKey(y);
    if (isLoaded("campaigns", key)) return;
    markLoaded("campaigns", key);
    setLoadingCampaigns(true);
    try {
      const data = await apiFetch<CampaignPerformance[]>(`/api/reports/campaign-performance?${scope}`);
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load campaign data:", err);
    } finally {
      setLoadingCampaigns(false);
    }
  }

  /**
   * Retention tab shares retention data from overview and LYBUNT from donors tab.
   * Kick off donors load if not already loaded so the count is available.
   */
  async function loadRetention(y: number) {
    const key = scopeCacheKey(y);
    if (isLoaded("retention", key)) return;
    markLoaded("retention", key);
    setLoadingRetention(true);
    try {
      await loadDonors(y);
    } finally {
      setLoadingRetention(false);
    }
  }

  /** Fetches Events CRM report summary for in-page reporting tools. */
  async function loadEventsModuleSummary() {
    if (eventsSummary || eventsLoading) return;
    setEventsLoading(true);
    setEventsError(null);
    try {
      const data = await apiFetch<EventsSummaryReport>("/api/events/reports/summary");
      setEventsSummary(data);
    } catch (err) {
      setEventsError(err instanceof Error ? err.message : "Failed to load Events reports");
    } finally {
      setEventsLoading(false);
    }
  }

  /** Fetches Compassion CRM report summary for in-page reporting tools. */
  async function loadCompassionModuleSummary() {
    if (compassionSummary || compassionLoading) return;
    setCompassionLoading(true);
    setCompassionError(null);
    try {
      const data = await apiFetch<CompassionSummaryReport>("/api/compassion/reports/summary");
      setCompassionSummary(data);
    } catch (err) {
      setCompassionError(err instanceof Error ? err.message : "Failed to load Compassion reports");
    } finally {
      setCompassionLoading(false);
    }
  }

  // ── Effects ───────────────────────────────────────────────────────────────

  /**
   * When year/scope changes, clear report caches and reload overview.
   */
  useEffect(() => {
    loadedRef.current = {};
    const timer = window.setTimeout(() => {
      void loadOverview(year);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, allYears]);

  /** Load tab-specific data the first time each non-overview tab is opened. */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      switch (activeTab) {
        case "donors":
          void loadDonors(year);
          break;
        case "giving":
          void loadGiving(year);
          break;
        case "campaigns":
          void loadCampaigns(year);
          break;
        case "retention":
          void loadRetention(year);
          break;
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, year, allYears]);

  /** Syncs active tab when users deep-link to /reports?tab=... from module navigation. */
  useEffect(() => {
    const nextTab = parseTabId(searchParams.get("tab"));
    if (nextTab === activeTab) return;

    const timer = window.setTimeout(() => {
      setActiveTab(nextTab);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchParams, activeTab]);

  /** Syncs active module when users deep-link to /reports?module=... from module navigation. */
  useEffect(() => {
    const nextModule = parseReportsModule(searchParams.get("module"));
    if (nextModule === activeModule) return;

    const timer = window.setTimeout(() => {
      setActiveModule(nextModule);
      setActiveTool(getDefaultReportsTool(nextModule));
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchParams, activeModule]);

  /** Ensures active tool selection always matches the selected module context. */
  useEffect(() => {
    const expectedPrefix = `${activeModule}-`;
    if (activeTool.startsWith(expectedPrefix)) return;

    const timer = window.setTimeout(() => {
      setActiveTool(getDefaultReportsTool(activeModule));
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [activeModule, activeTool]);

  /** Loads module-specific report data so all reporting tools run inside OyamaREPORTIT CRM. */
  useEffect(() => {
    if (activeModule === "events") {
      const timer = window.setTimeout(() => {
        void loadEventsModuleSummary();
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }

    if (activeModule === "compassion") {
      const timer = window.setTimeout(() => {
        void loadCompassionModuleSummary();
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }

    if (activeModule === "ogentic") {
      const timer = window.setTimeout(() => {
        try {
          const raw = window.localStorage.getItem("ogentic-artifacts:v1");
          const parsed = raw ? JSON.parse(raw) : [];
          const artifacts = Array.isArray(parsed) ? parsed : [];
          setOGenticArtifactsCount({
            drafts: artifacts.filter((artifact: { type?: string }) => artifact.type === "email_draft" || artifact.type === "letter_draft").length,
            reports: artifacts.filter((artifact: { type?: string }) => artifact.type === "report").length,
            analyses: artifacts.filter((artifact: { type?: string }) => artifact.type === "analysis").length,
          });
        } catch {
          setOGenticArtifactsCount({ drafts: 0, reports: 0, analyses: 0 });
        }
      }, 0);
      return () => {
        window.clearTimeout(timer);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModule]);

  /** Updates local state and URL query so sidebar report links map to the visible tab. */
  function handleTabChange(tabId: TabId) {
    setActiveTab(tabId);

    const params = new URLSearchParams(searchParams.toString());
    if (tabId === "overview") {
      params.delete("tab");
    } else {
      params.set("tab", tabId);
    }

    const query = params.toString();
    router.replace(query ? `/reports?${query}` : "/reports");
  }

  /** Updates module tab state and URL query for module-scoped report tool routing. */
  function handleModuleChange(moduleId: ReportsWorkspaceModule) {
    setActiveModule(moduleId);
    setActiveTool(getDefaultReportsTool(moduleId));

    const params = new URLSearchParams(searchParams.toString());
    if (moduleId === "donor") {
      params.delete("module");
    } else {
      params.set("module", moduleId);
    }

    const query = params.toString();
    router.replace(query ? `/reports?${query}` : "/reports");
  }

  /** Updates active in-page reporting tool. Donor tools map directly to donor analytics tabs. */
  function handleToolChange(toolId: ReportsToolId) {
    setActiveTool(toolId);

    if (toolId === "donor-overview") {
      handleTabChange("overview");
      return;
    }
    if (toolId === "donor-donors") {
      handleTabChange("donors");
      return;
    }
    if (toolId === "donor-giving") {
      handleTabChange("giving");
      return;
    }
    if (toolId === "donor-campaigns") {
      handleTabChange("campaigns");
      return;
    }
    if (toolId === "donor-retention") {
      handleTabChange("retention");
    }
  }

  const scopeLabel = allYears ? "All years" : `${year}`;

  // ── Export ────────────────────────────────────────────────────────────────

  /** Export the primary data for the currently active tab as a CSV download. */
  function handleExport() {
    if (activeModule === "events") {
      exportCSV(
        (eventsSummary?.topEvents ?? []).map((event) => ({
          Event: event.name,
          Type: event.type,
          Revenue: event.revenue,
          Guests: event.guests,
          CheckedIn: event.checkedIn,
        })),
        "events-reporting.csv"
      );
      return;
    }

    if (activeModule === "compassion") {
      exportCSV(
        (compassionSummary?.appointmentsByType ?? []).map((row) => ({
          AppointmentType: row.label,
          Count: row.value,
        })),
        "compassion-reporting.csv"
      );
      return;
    }

    if (activeModule === "ogentic") {
      exportCSV(
        [
          {
            Drafts: ogenticArtifactsCount.drafts,
            Reports: ogenticArtifactsCount.reports,
            Analyses: ogenticArtifactsCount.analyses,
          },
        ],
        "ogentic-reporting-queue.csv"
      );
      return;
    }

    switch (activeTab) {
      case "overview":
        exportCSV(
          topDonors.map((d) => ({
            Name: `${d.firstName} ${d.lastName}`,
            Email: d.email ?? "",
            LifetimeGiving: Number(d.totalLifetimeGiving),
            LastGiftDate: d.lastGiftDate ?? "",
            Status: d.donorStatus,
          })),
          "top-donors.csv"
        );
        break;
      case "donors":
        exportCSV(
          lybunt.map((d) => ({
            Name: `${d.firstName} ${d.lastName}`,
            Email: d.email ?? "",
            LastGiftDate: d.lastGiftDate ?? "",
            LastGiftAmount: Number(d.lastGiftAmount ?? 0),
            LifetimeGiving: Number(d.totalLifetimeGiving),
            Status: d.donorStatus,
          })),
          "lybunt.csv"
        );
        break;
      case "giving":
        exportCSV(
          yearComparison.map((d) => ({
            Month: MONTHS_SHORT[d.month - 1],
            [`${year}`]: d.thisYear,
            [`${year - 1}`]: d.lastYear,
          })),
          "year-comparison.csv"
        );
        break;
      case "campaigns":
        exportCSV(
          campaigns.map((c) => ({
            Campaign: c.name,
            Active: c.active ? "Yes" : "No",
            Goal: c.goal ?? "",
            Raised: c.raised,
            Gifts: c.giftCount,
            Donors: c.uniqueDonors,
            AvgGift: c.avgGift,
          })),
          "campaign-performance.csv"
        );
        break;
      case "retention":
        exportCSV(
          lybunt.map((d) => ({
            Name: `${d.firstName} ${d.lastName}`,
            Email: d.email ?? "",
            LastGiftDate: d.lastGiftDate ?? "",
            LastGiftAmount: Number(d.lastGiftAmount ?? 0),
            LifetimeGiving: Number(d.totalLifetimeGiving),
          })),
          "lybunt-retention.csv"
        );
        break;
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  /** Total number of constituents across all segments (for percentage bars). */
  const segmentTotal = donorSegments
    ? Object.values(donorSegments).reduce((a, b) => a + b, 0)
    : 0;

  /** Maximum payment amount (for scaling horizontal payment-method bars). */
  const maxPayment =
    paymentBreakdown.length > 0 ? Math.max(...paymentBreakdown.map((p) => p.amount)) : 1;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Reports &amp; Analytics</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            OyamaREPORTIT CRM for donor, events, compassion, and OGentic reporting workflows
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Include Grants toggle — applies to all revenue figures across all tabs */}
          <button
            onClick={toggleGrants}
            title={includeGrants ? "Grants included in revenue totals — click to exclude" : "Click to include awarded grants in revenue totals"}
            className={`flex items-center gap-2 text-xs font-medium rounded-full px-3 py-1.5 border transition-colors ${
              includeGrants
                ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                : "bg-gray-50 border-gray-200 text-gray-500 hover:text-gray-700"
            }`}
          >
            {/* Mini toggle pill */}
            <span className={`w-7 h-3.5 rounded-full relative transition-colors ${includeGrants ? "bg-emerald-400" : "bg-gray-300"}`}>
              <span className={`absolute top-0.5 w-2.5 h-2.5 bg-white rounded-full shadow transition-all ${includeGrants ? "left-4" : "left-0.5"}`} />
            </span>
            Incl. Grants
          </button>

          {/* Global year selector — affects all year-dependent charts and tables */}
          <select
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10))}
            disabled={allYears}
            className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            {YEAR_OPTIONS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <label className="inline-flex items-center gap-2 text-xs text-gray-600 whitespace-nowrap">
            <input
              type="checkbox"
              checked={allYears}
              onChange={(e) => setAllYears(e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Include all years
          </label>

          {/* Export CSV — exports primary data for the active tab */}
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-1.5 rounded-md bg-green-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-green-700 transition-colors"
          >
            ↓ Export CSV
          </button>
        </div>
      </div>

      <ReportsModuleToolbar
        activeModule={activeModule}
        activeTool={activeTool}
        onModuleChange={handleModuleChange}
        onToolChange={handleToolChange}
      />

      {activeModule === "donor" ? (
        <>
          <p className="text-xs text-gray-500 -mt-3">
            {!allYears
              ? `Report totals are scoped to ${year}.`
              : "Report totals are scoped to all years. Retention and LYBUNT/SYBUNT remain year-based."}
          </p>

          {/* ── Tab Navigation ── */}
          <div className="flex border-b border-gray-200">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? "border-green-600 text-green-700"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

      {/* ══════════════════════════════════════════════════════════════════════
          OVERVIEW TAB
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* 8 KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              {
                label: allYears ? "Total Revenue (All years)" : `Revenue (${year})`,
                value: summary
                  ? `$${fmtCurrency(summary.ytdAmount + (includeGrants ? (summary.ytdGrantAmount ?? 0) : 0))}`
                  : null,
                note: includeGrants && (summary?.ytdGrantAmount ?? 0) > 0
                  ? `incl. $${fmtCurrency(summary!.ytdGrantAmount)} grants`
                  : undefined,
              },
              {
                label: "Total Constituents",
                value: summary?.totalConstituents?.toLocaleString() ?? null,
              },
              {
                label: "Donor Retention",
                value: retention ? `${retention.rate}%` : null,
              },
              {
                label: allYears ? "Campaigns (All years)" : `Campaigns (${year})`,
                value: summary?.activeCampaigns?.toLocaleString() ?? null,
              },
              {
                label: allYears ? "Total Gifts (All years)" : `Total Gifts (${year})`,
                value: summary?.ytdCount?.toLocaleString() ?? null,
              },
              {
                label: "Average Gift",
                value:
                  summary && summary.ytdCount > 0
                    ? `$${fmtCurrency(summary.ytdAmount / summary.ytdCount)}`
                    : null,
              },
              {
                label: allYears ? "New Donors (All years)" : `New Donors (${year})`,
                value: boardSummary?.newDonorsYtd?.toLocaleString() ?? null,
              },
              {
                label: allYears ? "Major Gifts (All years)" : `Major Gifts (≥$1k, ${year})`,
                value: boardSummary?.majorGiftCount?.toLocaleString() ?? null,
              },
            ].map((card) => (
              <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-4">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                  {card.label}
                </p>
                {loadingOverview ? (
                  <Sk className="h-8 w-24 mt-2" />
                ) : (
                  <>
                    <p className="text-2xl font-bold mt-1 text-gray-900">{card.value ?? "—"}</p>
                    {/* Grant note shown under YTD Revenue when toggle is on */}
                    {"note" in card && card.note && (
                      <p className="text-[11px] text-emerald-600 font-medium mt-0.5">{card.note}</p>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Monthly giving bar chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-gray-900">Monthly Giving — {scopeLabel}</h2>
              {/* Grants-included badge mirrors the global toggle state */}
              {includeGrants && (
                <span className="text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full px-2 py-0.5">
                  + Grants included
                </span>
              )}
            </div>
            {loadingOverview ? (
              <div className="flex items-end gap-1 h-52">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gray-200 animate-pulse rounded-t"
                    style={{ height: `${30 + (i % 4) * 15}%` }}
                  />
                ))}
              </div>
            ) : (
              <BarChart
                data={monthly.map((d) => ({
                  month: d.month,
                  amount: d.amount + (includeGrants ? (d.grantAmount ?? 0) : 0),
                }))}
                height={200}
              />
            )}
          </div>

          {/* 2-column row: Top Donors + Donor Segments */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top 5 donors */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Top 5 Donors</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    {["Name", "Lifetime", "Last Gift", "Status"].map((h) => (
                      <th
                        key={h}
                        className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingOverview
                    ? Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i}>
                          {Array.from({ length: 4 }).map((__, j) => (
                            <td key={j} className="px-4 py-2.5">
                              <Sk className="h-4 w-16" />
                            </td>
                          ))}
                        </tr>
                      ))
                    : topDonors.map((d) => (
                        <tr key={d.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-4 py-2.5">
                            <Link
                              href={`/constituents/${d.id}`}
                              className="font-medium text-gray-900 hover:text-green-600"
                            >
                              {d.firstName} {d.lastName}
                            </Link>
                          </td>
                          <td className="px-4 py-2.5 font-semibold text-gray-800">
                            ${fmtCurrency(Number(d.totalLifetimeGiving))}
                          </td>
                          <td className="px-4 py-2.5 text-gray-500 text-xs">
                            {fmtDate(d.lastGiftDate)}
                          </td>
                          <td className="px-4 py-2.5">
                            <span
                              className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${statusBadgeClass(d.donorStatus)}`}
                            >
                              {statusLabel(d.donorStatus)}
                            </span>
                          </td>
                        </tr>
                      ))}
                  {!loadingOverview && topDonors.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">
                        No donor data yet.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Donor segment percentage bars */}
            <div className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Donor Segments</h2>
              {loadingOverview ? (
                <div className="space-y-3">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Sk key={i} className="h-6 w-full" />
                  ))}
                </div>
              ) : donorSegments ? (
                <div className="space-y-3">
                  {(
                    [
                      { key: "ACTIVE", label: "Active", color: "bg-green-500" },
                      { key: "NEW", label: "New", color: "bg-blue-500" },
                      { key: "LAPSED", label: "Lapsed", color: "bg-red-400" },
                      { key: "MAJOR_DONOR", label: "Major Donor", color: "bg-amber-500" },
                      { key: "DECEASED", label: "Deceased", color: "bg-gray-400" },
                    ] as { key: keyof DonorSegments; label: string; color: string }[]
                  ).map(({ key, label, color }) => {
                    const count = donorSegments[key] ?? 0;
                    const pct = segmentTotal > 0 ? (count / segmentTotal) * 100 : 0;
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex justify-between text-xs text-gray-600">
                          <span>{label}</span>
                          <span className="font-medium">
                            {count.toLocaleString()} ({Math.round(pct)}%)
                          </span>
                        </div>
                        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${color} rounded-full`}
                            style={{ width: `${Math.min(100, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center mt-8">No segment data.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          DONORS TAB
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "donors" && (
        <div className="space-y-6">
          {/* Segment cards with percentage bars */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">Constituent Segments</h2>
            {loadingOverview ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Sk key={i} className="h-6 w-full" />
                ))}
              </div>
            ) : donorSegments ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {(
                  [
                    {
                      key: "ACTIVE",
                      label: "Active",
                      barColor: "bg-green-500",
                      textColor: "text-green-700",
                      bgColor: "bg-green-50",
                    },
                    {
                      key: "NEW",
                      label: "New",
                      barColor: "bg-blue-500",
                      textColor: "text-blue-700",
                      bgColor: "bg-blue-50",
                    },
                    {
                      key: "LAPSED",
                      label: "Lapsed",
                      barColor: "bg-red-400",
                      textColor: "text-red-600",
                      bgColor: "bg-red-50",
                    },
                    {
                      key: "MAJOR_DONOR",
                      label: "Major Donor",
                      barColor: "bg-amber-500",
                      textColor: "text-amber-700",
                      bgColor: "bg-amber-50",
                    },
                    {
                      key: "DECEASED",
                      label: "Deceased",
                      barColor: "bg-gray-400",
                      textColor: "text-gray-600",
                      bgColor: "bg-gray-100",
                    },
                  ] as {
                    key: keyof DonorSegments;
                    label: string;
                    barColor: string;
                    textColor: string;
                    bgColor: string;
                  }[]
                ).map(({ key, label, barColor, textColor, bgColor }) => {
                  const count = donorSegments[key] ?? 0;
                  const pct = segmentTotal > 0 ? (count / segmentTotal) * 100 : 0;
                  return (
                    <div key={key} className={`rounded-lg border border-gray-100 p-4 ${bgColor}`}>
                      <p className={`text-xs font-semibold uppercase tracking-wide ${textColor}`}>
                        {label}
                      </p>
                      <p className="text-2xl font-bold text-gray-900 mt-1">
                        {count.toLocaleString()}
                      </p>
                      <div className="mt-2 w-full h-1.5 bg-white bg-opacity-60 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${barColor} rounded-full`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{Math.round(pct)}% of total</p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No segment data available.</p>
            )}
          </div>

          {/* LYBUNT section */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  LYBUNT — Last Year But Not This Year
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Donors who gave in {year - 1} but have not yet given in {year}
                </p>
              </div>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
                {loadingDonors ? "…" : lybunt.length} donors
              </span>
            </div>
            <LybuntTable donors={lybunt} loading={loadingDonors} />
          </div>

          {/* SYBUNT section (collapsible) */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">
                  SYBUNT — Some Year But Not This Year
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Donors who gave before {year - 1} but not in {year - 1} or {year}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                  {loadingDonors ? "…" : sybunt.length} donors
                </span>
                <button
                  onClick={() => setShowSybunt((v) => !v)}
                  className="text-xs font-medium text-green-600 hover:text-green-700"
                >
                  {showSybunt ? "Hide" : "Show"} SYBUNT
                </button>
              </div>
            </div>
            {showSybunt && <LybuntTable donors={sybunt} loading={loadingDonors} />}
          </div>

          {/* New vs Returning stacked bar chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              New vs. Returning Donors — {year}
            </h2>
            {loadingDonors ? (
              <div className="flex items-end gap-1" style={{ height: 140 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gray-200 animate-pulse rounded-t"
                    style={{ height: `${30 + (i % 3) * 20}%` }}
                  />
                ))}
              </div>
            ) : newVsReturning.some((d) => d.newCount + d.returningCount > 0) ? (
              <NewVsReturningChart data={newVsReturning} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-10">
                No donor data for {year}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          GIVING TAB
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "giving" && (
        <div className="space-y-6">
          {/* Year-over-year comparison SVG chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-1">
              Year-over-Year Giving — {year} vs. {year - 1}
            </h2>
            {loadingGiving ? (
              <div className="flex items-end gap-1 mt-4" style={{ height: 200 }}>
                {Array.from({ length: 12 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-gray-200 animate-pulse rounded-t"
                    style={{ height: `${20 + (i % 5) * 12}%` }}
                  />
                ))}
              </div>
            ) : yearComparison.length > 0 ? (
              <YoYChart data={yearComparison} thisYear={year} lastYear={year - 1} />
            ) : (
              <p className="text-sm text-gray-400 text-center py-12">
                No comparison data available.
              </p>
            )}
          </div>

          {/* Giving by Tier — 4 cards with colored left border */}
          <div>
            <h2 className="text-sm font-semibold text-gray-900 mb-3">
              Giving by Tier — {scopeLabel}
            </h2>
            {loadingGiving ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Sk key={i} className="h-24" />
                ))}
              </div>
            ) : givingByTier ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {(
                  [
                    {
                      key: "micro",
                      label: "Micro",
                      sublabel: "Under $50",
                      border: "border-l-gray-400",
                      badge: "bg-gray-100 text-gray-600",
                    },
                    {
                      key: "small",
                      label: "Small",
                      sublabel: "$50 – $249",
                      border: "border-l-blue-400",
                      badge: "bg-blue-50 text-blue-700",
                    },
                    {
                      key: "mid",
                      label: "Mid",
                      sublabel: "$250 – $999",
                      border: "border-l-green-500",
                      badge: "bg-green-50 text-green-700",
                    },
                    {
                      key: "major",
                      label: "Major",
                      sublabel: "$1,000+",
                      border: "border-l-amber-500",
                      badge: "bg-amber-50 text-amber-700",
                    },
                  ] as {
                    key: keyof GivingByTier;
                    label: string;
                    sublabel: string;
                    border: string;
                    badge: string;
                  }[]
                ).map(({ key, label, sublabel, border, badge }) => {
                  const tier = givingByTier[key];
                  return (
                    <div
                      key={key}
                      className={`bg-white rounded-lg border border-gray-200 border-l-4 ${border} p-4`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${badge}`}>
                          {label}
                        </span>
                        <span className="text-xs text-gray-400">{sublabel}</span>
                      </div>
                      <p className="text-2xl font-bold text-gray-900">
                        {tier.count.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-500 font-medium mt-0.5">
                        ${fmtCurrency(tier.amount)} raised
                      </p>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No tier data available.</p>
            )}
          </div>

          {/* Payment Method breakdown — horizontal CSS bars */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="text-sm font-semibold text-gray-900 mb-4">
              Payment Methods — {scopeLabel}
            </h2>
            {loadingGiving ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Sk key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : paymentBreakdown.length > 0 ? (
              <div className="space-y-3">
                {paymentBreakdown.map((p) => {
                  const pct = maxPayment > 0 ? (p.amount / maxPayment) * 100 : 0;
                  const label = p.paymentMethod
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase());
                  return (
                    <div key={p.paymentMethod} className="space-y-1">
                      <div className="flex justify-between text-sm text-gray-700">
                        <span className="font-medium">{label}</span>
                        <span className="text-gray-500">
                          ${fmtCurrency(p.amount)} &middot; {p.count} gift
                          {p.count !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full"
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                No payment data for {year}.
              </p>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          CAMPAIGNS TAB
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Campaign Performance — {scopeLabel}</h2>
            <span className="text-xs text-gray-500">
              {loadingCampaigns
                ? "Loading…"
                : `${campaigns.length} campaign${campaigns.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {loadingCampaigns ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Sk key={i} className="h-36 w-full" />
              ))}
            </div>
          ) : campaigns.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-sm">
                No campaigns found. Create your first campaign to see performance data here.
              </p>
            </div>
          ) : (
            campaigns.map((c) => {
              const goalPct =
                c.goal && c.goal > 0 ? Math.min(100, (c.raised / c.goal) * 100) : null;
              return (
                <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-5">
                  {/* Campaign header */}
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900">{c.name}</h3>
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                            c.active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500"
                          }`}
                        >
                          {c.active ? "Active" : "Inactive"}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(c.startDate).toLocaleDateString("en-US", {
                          month: "short",
                          year: "numeric",
                        })}
                        {c.endDate
                          ? ` – ${new Date(c.endDate).toLocaleDateString("en-US", {
                              month: "short",
                              year: "numeric",
                            })}`
                          : " – Ongoing"}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-bold text-gray-900">
                        ${fmtCurrency(c.raised)}
                      </p>
                      {c.goal && (
                        <p className="text-xs text-gray-500">
                          of ${fmtCurrency(c.goal)} goal
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Goal progress bar (only when a goal is set) */}
                  {goalPct !== null && (
                    <div className="mb-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>{Math.round(goalPct)}% of goal reached</span>
                        <span>${fmtCurrency(c.raised)} raised</span>
                      </div>
                      <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-green-500 rounded-full transition-all"
                          style={{ width: `${goalPct}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Stats row */}
                  <div className="flex flex-wrap gap-6 pt-3 border-t border-gray-100 text-sm">
                    <div>
                      <span className="text-gray-500">Gifts</span>
                      <span className="ml-2 font-semibold text-gray-800">
                        {c.giftCount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Donors</span>
                      <span className="ml-2 font-semibold text-gray-800">
                        {c.uniqueDonors.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Avg Gift</span>
                      <span className="ml-2 font-semibold text-gray-800">
                        ${fmtCurrency(c.avgGift)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════════
          RETENTION TAB
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTab === "retention" && (
        <div className="space-y-6">
          {/* Large retention rate display */}
          <div className="bg-white rounded-lg border border-gray-200 p-8">
            <h2 className="text-sm font-semibold text-gray-900 mb-6">
              Donor Retention Rate — {retention?.year ?? year}
            </h2>
            {loadingOverview || loadingRetention ? (
              <div className="flex flex-col items-center gap-4">
                <Sk className="h-36 w-36 rounded-full" />
                <Sk className="h-6 w-40" />
              </div>
            ) : retention ? (
              <div className="flex flex-col items-center text-center gap-3">
                <DonutChart rate={retention.rate} size={140} />
                <p className="text-5xl font-bold text-green-600">{retention.rate}%</p>
                <p className="text-base text-gray-600">
                  of last year&apos;s donors gave again this year
                </p>
                <div className="flex gap-8 mt-2 text-sm text-gray-500">
                  <div>
                    <strong className="text-gray-800 text-lg">{retention.retained}</strong>
                    <span className="block text-xs">retained</span>
                  </div>
                  <div>
                    <strong className="text-gray-800 text-lg">{retention.total}</strong>
                    <span className="block text-xs">donors last year</span>
                  </div>
                  <div>
                    <strong className="text-gray-800 text-lg">
                      {retention.total - retention.retained}
                    </strong>
                    <span className="block text-xs">lapsed</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-center text-gray-400 text-sm">
                No retention data available. Start recording gifts to see retention trends.
              </p>
            )}
          </div>

          {/* Reactivation opportunities (LYBUNT count + link) */}
          <div className="bg-white rounded-lg border border-gray-200 p-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">
                  Reactivation Opportunities (LYBUNT)
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Donors who gave in {year - 1} but not yet in {year} — prime candidates for
                  outreach
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-amber-600">
                  {loadingDonors ? "…" : lybunt.length}
                </span>
                <button
                  onClick={() => setActiveTab("donors")}
                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  View List →
                </button>
              </div>
            </div>
          </div>

          {/* Multi-year trend placeholder */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <svg
              className="w-12 h-12 mx-auto mb-3 text-gray-200"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              />
            </svg>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">
              Retention Trend (Multi-Year)
            </h3>
            <p className="text-sm text-gray-400">
              Historical retention trend will appear here as multiple years of giving data are
              recorded.
            </p>
          </div>
        </div>
      )}
        </>
      ) : (
        <div className="space-y-4">
          {activeModule === "events" && (
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900">Events CRM Reporting</h2>
              {eventsLoading ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Sk className="h-16" />
                  <Sk className="h-16" />
                  <Sk className="h-16" />
                </div>
              ) : eventsError ? (
                <p className="mt-3 text-sm text-red-600">{eventsError}</p>
              ) : !eventsSummary ? (
                <p className="mt-3 text-sm text-gray-500">No events report data available.</p>
              ) : (
                <>
                  {activeTool === "events-summary" && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Events</p>
                        <p className="text-xl font-semibold text-gray-900 mt-1">{eventsSummary.totalEvents}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Revenue</p>
                        <p className="text-xl font-semibold text-gray-900 mt-1">${fmtCurrency(eventsSummary.totalRevenue)}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Attendees</p>
                        <p className="text-xl font-semibold text-gray-900 mt-1">{eventsSummary.totalAttendees.toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {activeTool === "events-top-events" && (
                    <div className="mt-3 overflow-x-auto rounded-lg border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase tracking-wide">Event</th>
                            <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase tracking-wide">Revenue</th>
                            <th className="px-3 py-2 text-left text-xs text-gray-500 uppercase tracking-wide">Guests</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eventsSummary.topEvents.slice(0, 6).map((event) => (
                            <tr key={event.id} className="border-b border-gray-100">
                              <td className="px-3 py-2 text-gray-800">{event.name}</td>
                              <td className="px-3 py-2 text-gray-700">${fmtCurrency(event.revenue)}</td>
                              <td className="px-3 py-2 text-gray-700">{event.guests}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {activeTool === "events-attendance" && (
                    <div className="mt-3 space-y-2">
                      {eventsSummary.topEvents.slice(0, 5).map((event) => {
                        const pct = event.guests > 0 ? Math.round((event.checkedIn / event.guests) * 100) : 0;
                        return (
                          <div key={`${event.id}-attendance`} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                            <div className="flex items-center justify-between text-xs text-gray-600">
                              <span className="font-medium text-gray-800">{event.name}</span>
                              <span>{event.checkedIn}/{event.guests} checked in</span>
                            </div>
                            <div className="mt-1.5 h-2 rounded-full bg-gray-200 overflow-hidden">
                              <div className="h-2 bg-amber-500 rounded-full" style={{ width: `${Math.min(100, pct)}%` }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {activeModule === "compassion" && (
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900">Compassion CRM Reporting</h2>
              {compassionLoading ? (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Sk className="h-16" />
                  <Sk className="h-16" />
                  <Sk className="h-16" />
                </div>
              ) : compassionError ? (
                <p className="mt-3 text-sm text-red-600">{compassionError}</p>
              ) : !compassionSummary ? (
                <p className="mt-3 text-sm text-gray-500">No compassion report data available.</p>
              ) : (
                <>
                  {activeTool === "compassion-kpis" && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Total Clients</p>
                        <p className="text-xl font-semibold text-gray-900 mt-1">{compassionSummary.kpis.totalClients}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Active Cases</p>
                        <p className="text-xl font-semibold text-gray-900 mt-1">{compassionSummary.kpis.activeCases}</p>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-[11px] uppercase tracking-wide text-gray-500">Completion Rate</p>
                        <p className="text-xl font-semibold text-gray-900 mt-1">{Math.round(compassionSummary.kpis.completionRate)}%</p>
                      </div>
                    </div>
                  )}

                  {activeTool === "compassion-cases" && (
                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-xs font-semibold text-gray-800">Cases by Type</p>
                        <div className="mt-2 space-y-1.5 text-xs text-gray-600">
                          {compassionSummary.casesByType.slice(0, 6).map((row) => (
                            <div key={`type-${row.label}`} className="flex justify-between">
                              <span>{row.label}</span>
                              <span className="font-medium">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                        <p className="text-xs font-semibold text-gray-800">Cases by Status</p>
                        <div className="mt-2 space-y-1.5 text-xs text-gray-600">
                          {compassionSummary.casesByStatus.slice(0, 6).map((row) => (
                            <div key={`status-${row.label}`} className="flex justify-between">
                              <span>{row.label}</span>
                              <span className="font-medium">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTool === "compassion-appointments" && (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-xs font-semibold text-gray-800">Appointments by Type</p>
                      <div className="mt-2 space-y-1.5 text-xs text-gray-600">
                        {compassionSummary.appointmentsByType.slice(0, 8).map((row) => (
                          <div key={`appt-${row.label}`} className="flex justify-between">
                            <span>{row.label}</span>
                            <span className="font-medium">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </section>
          )}

          {activeModule === "ogentic" && (
            <section className="bg-white rounded-lg border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900">OGentic Reporting</h2>
              {activeTool === "ogentic-queue" && (
                <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Drafts</p>
                    <p className="text-xl font-semibold text-gray-900 mt-1">{ogenticArtifactsCount.drafts}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Reports</p>
                    <p className="text-xl font-semibold text-gray-900 mt-1">{ogenticArtifactsCount.reports}</p>
                  </div>
                  <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500">Analyses</p>
                    <p className="text-xl font-semibold text-gray-900 mt-1">{ogenticArtifactsCount.analyses}</p>
                  </div>
                </div>
              )}

              {activeTool === "ogentic-drafts" && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                  Draft review tools are now centered in OyamaREPORTIT CRM. Use this view to validate report drafts before sharing.
                </div>
              )}

              {activeTool === "ogentic-board-pack" && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                  Board pack assembly is in progress. This tool will combine donor, events, and compassion report slices into one export.
                </div>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}
