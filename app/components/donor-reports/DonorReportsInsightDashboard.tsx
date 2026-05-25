// DonorReportsInsightDashboard — executive reporting cockpit with live Recharts charts.
"use client";

import {
  AreaChart, Area,
  BarChart, Bar,
  PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip as ReTooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface ReportsSummarySnapshot {
  ytdAmount: number;
  ytdCount: number;
  monthAmount: number;
  weekAmount: number;
  activeCampaigns: number;
  pendingTasks: number;
  overdueTasks: number;
  newDonorsThisMonth: number;
}

interface MonthlyTrendRow {
  month: number;
  amount: number;
}

interface TopDonorRow {
  firstName: string;
  lastName: string;
  totalLifetimeGiving: number;
  lastGiftDate: string | null;
}

interface RetentionSnapshot {
  rate: number;
  retained: number;
  total: number;
}

interface CampaignPerformanceRow {
  id: string;
  name: string;
  raised: number;
  goal: number | null;
  giftCount: number;
  uniqueDonors: number;
}

interface AcquisitionRow {
  month: number;
  newCount: number;
  returningCount: number;
}

interface PaymentBreakdownRow {
  paymentMethod: string;
  count: number;
  amount: number;
}

interface GivingTierRow {
  count: number;
  amount: number;
}

interface DonorSegmentsSnapshot {
  ACTIVE: number;
  LAPSED: number;
  NEW: number;
  MAJOR_DONOR: number;
  PROSPECT: number;
  DECEASED: number;
  OTHER: number;
}

interface DonorReportsInsightDashboardProps {
  loading: boolean;
  error: string | null;
  year: number;
  dateBasis: "calendar" | "fiscal";
  summary: ReportsSummarySnapshot | null;
  trendRows: MonthlyTrendRow[];
  topDonors: TopDonorRow[];
  retention: RetentionSnapshot | null;
  segments: DonorSegmentsSnapshot | null;
  acquisitionRows: AcquisitionRow[];
  campaignRows: CampaignPerformanceRow[];
  paymentRows: PaymentBreakdownRow[];
  givingTierRows: Record<string, GivingTierRow> | null;
  onRefresh: () => void;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Chart colour palettes
const SEGMENT_COLORS: Record<string, string> = {
  ACTIVE: "#16a34a",
  NEW: "#0ea5e9",
  LAPSED: "#f59e0b",
  MAJOR_DONOR: "#7c3aed",
  PROSPECT: "#64748b",
  OTHER: "#94a3b8",
};
const PAYMENT_COLORS = ["#16a34a", "#0ea5e9", "#7c3aed", "#f59e0b", "#64748b", "#94a3b8", "#e11d48"];
const TIER_COLORS: Record<string, string> = { micro: "#86efac", small: "#4ade80", mid: "#16a34a", major: "#14532d" };
const TIER_LABELS: Record<string, string> = { micro: "Micro", small: "Small", mid: "Mid-Level", major: "Major" };

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatShortDate(value: string | null): string {
  if (!value) return "No gift date";
  return new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

// ── Custom recharts tooltips ──────────────────────────────────────────────────
type ChartPayloadItem = {
  color?: string;
  name?: string | number;
  value?: number | string | readonly (number | string)[];
};

type ChartTTProps = {
  active?: boolean;
  payload?: readonly ChartPayloadItem[];
  label?: string | number;
  currency?: boolean;
};

function ChartTooltip({ active, payload, label, currency = false }: ChartTTProps) {
  if (!active || !payload?.length) return null;

  const getNumericValue = (value: ChartPayloadItem["value"]) => {
    if (Array.isArray(value)) return Number(value[0] ?? 0);
    return Number(value ?? 0);
  };

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      {label != null && <p className="mb-1 font-semibold text-slate-700">{String(label)}</p>}
      {payload.map((item, i) => (
        <p key={i} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: String(item.color ?? "#374151") }} />
          <span className="text-slate-600">{item.name}:</span>
          <span className="font-semibold text-slate-900">
            {currency ? formatCurrency(getNumericValue(item.value)) : getNumericValue(item.value).toLocaleString()}
          </span>
        </p>
      ))}
    </div>
  );
}

type PiePayloadItem = ChartPayloadItem & {
  payload?: {
    pct?: number;
  };
};

type PieTTProps = {
  active?: boolean;
  payload?: readonly PiePayloadItem[];
};

function PieTooltip({ active, payload }: PieTTProps) {
  if (!active || !payload?.length) return null;
  const item = payload[0];
  const pct = item.payload?.pct;
  const value = Array.isArray(item.value) ? Number(item.value[0] ?? 0) : Number(item.value ?? 0);
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-800">{item.name}</p>
      <p className="text-slate-600">
        {value.toLocaleString()}{pct != null ? ` · ${formatPercent(pct)}` : ""}
      </p>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Sk({ h = "h-5" }: { h?: string }) {
  return <div className={`${h} animate-pulse rounded bg-slate-100`} />;
}

/** Executive reporting cockpit — live API-backed Recharts charts and metrics. */
export default function DonorReportsInsightDashboard({
  loading,
  error,
  year,
  dateBasis,
  summary,
  trendRows,
  topDonors,
  retention,
  segments,
  acquisitionRows,
  campaignRows,
  paymentRows,
  givingTierRows,
  onRefresh,
}: DonorReportsInsightDashboardProps) {
  // ── Derived chart datasets ──────────────────────────────────────────────────
  const trendData = trendRows.map((r) => ({ label: MONTHS[r.month - 1] ?? r.month, Amount: r.amount }));

  const acqData = acquisitionRows.map((r) => ({
    label: MONTHS[r.month - 1] ?? r.month,
    New: r.newCount,
    Returning: r.returningCount,
  }));

  const segPieRaw = segments
    ? Object.entries(segments)
        .filter(([k, v]) => k !== "DECEASED" && v > 0)
        .map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v, color: SEGMENT_COLORS[k] ?? "#94a3b8" }))
    : [];
  const totalSeg = segPieRaw.reduce((s, d) => s + d.value, 0);
  const segPie = segPieRaw.map((d) => ({ ...d, pct: totalSeg > 0 ? (d.value / totalSeg) * 100 : 0 }));

  const payPieRaw = paymentRows.map((r, i) => ({
    name: r.paymentMethod,
    value: r.amount,
    color: PAYMENT_COLORS[i % PAYMENT_COLORS.length],
  }));
  const totalPay = payPieRaw.reduce((s, d) => s + d.value, 0);
  const payPie = payPieRaw.map((d) => ({ ...d, pct: totalPay > 0 ? (d.value / totalPay) * 100 : 0 }));

  const tierBar = givingTierRows
    ? Object.entries(givingTierRows).map(([k, v]) => ({
        name: TIER_LABELS[k] ?? k,
        Amount: v.amount,
        Gifts: v.count,
        color: TIER_COLORS[k] ?? "#16a34a",
      }))
    : [];

  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-gradient-to-r from-white via-emerald-50/35 to-slate-50 px-4 py-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-500">Live Reporting Dashboard</p>
          <h2 className="text-sm font-semibold text-slate-950">Executive Snapshot · {year}</h2>
          <p className="text-xs text-slate-500">
            {dateBasis === "fiscal" ? "Fiscal basis" : "Calendar basis"} · Real-time charts
          </p>
        </div>
        <button
          type="button"
          onClick={onRefresh}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-700"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8 8 0 0 0 4.582 9M20 20v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2" />
          </svg>
          Refresh
        </button>
      </div>

      {error ? (
        <div className="px-4 py-4 text-sm text-rose-700">{error}</div>
      ) : (
        <div className="space-y-3 p-3">

          {/* ── Row 1: Core Metrics · Monthly Area Chart · Top Donors ──────── */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1.2fr)_minmax(16rem,0.85fr)]">

            {/* Core Metrics tiles */}
            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Core Metrics</p>
              {loading || !summary ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {Array.from({ length: 6 }).map((_, i) => <Sk key={i} h="h-14" />)}
                </div>
              ) : (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {[
                    { label: "YTD Raised",   val: formatCurrency(summary.ytdAmount) },
                    { label: "YTD Gifts",    val: summary.ytdCount.toLocaleString() },
                    { label: "This Month",   val: formatCurrency(summary.monthAmount) },
                    { label: "This Week",    val: formatCurrency(summary.weekAmount) },
                    { label: "Campaigns",    val: summary.activeCampaigns.toString() },
                    {
                      label: "Open Tasks",
                      val: summary.pendingTasks.toLocaleString(),
                      sub: summary.overdueTasks > 0 ? `${summary.overdueTasks} overdue` : undefined,
                      alert: summary.overdueTasks > 0,
                    },
                  ].map(({ label, val, sub, alert }) => (
                    <div key={label} className="rounded-md border border-slate-200 bg-white px-2.5 py-2">
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
                      <p className="mt-0.5 text-base font-bold text-slate-900">{val}</p>
                      {sub && <p className={`text-[11px] ${alert ? "text-rose-600" : "text-slate-500"}`}>{sub}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Monthly Giving Trend — AreaChart */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Monthly Giving Trend</p>
              {loading ? (
                <div className="mt-3 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Sk key={i} />)}</div>
              ) : trendData.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No trend data for this selection.</p>
              ) : (
                <div className="mt-2 h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor="#16a34a" stopOpacity={0.2} />
                          <stop offset="95%" stopColor="#16a34a" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <ReTooltip content={(props) => <ChartTooltip {...props} currency />} />
                      <Area
                        type="monotone"
                        dataKey="Amount"
                        stroke="#16a34a"
                        strokeWidth={2}
                        fill="url(#trendGrad)"
                        dot={false}
                        activeDot={{ r: 4, fill: "#16a34a" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Top Donors + Retention badge */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Top Donors</p>
                {retention && (
                  <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Retention {retention.rate.toFixed(1)}%
                  </span>
                )}
              </div>
              <div className="mt-3 space-y-2">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <Sk key={i} h="h-9" />)
                  : topDonors.length === 0
                  ? <p className="text-xs text-slate-500">No top donor records.</p>
                  : topDonors.slice(0, 5).map((donor, i) => (
                      <div key={`${donor.firstName}-${donor.lastName}-${i}`} className="rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <span className="truncate font-semibold text-slate-900">{donor.firstName} {donor.lastName}</span>
                          <span className="font-semibold text-emerald-700">{formatCurrency(donor.totalLifetimeGiving)}</span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-slate-500">Last gift: {formatShortDate(donor.lastGiftDate)}</p>
                      </div>
                    ))
                }
              </div>
              {retention && (
                <p className="mt-3 text-[11px] text-slate-500">
                  {retention.retained.toLocaleString()} retained of {retention.total.toLocaleString()} prior-year donors.
                </p>
              )}
            </div>
          </div>

          {/* ── Row 2: New vs Returning · Segments Pie · Top Campaigns · Payment Pie ── */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-2 2xl:grid-cols-4">

            {/* New vs Returning — Stacked BarChart */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">New vs Returning Donors</p>
              {loading ? (
                <div className="mt-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Sk key={i} />)}</div>
              ) : acqData.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No acquisition data.</p>
              ) : (
                <div className="mt-2 h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={acqData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                      <YAxis hide />
                      <ReTooltip content={(props) => <ChartTooltip {...props} />} />
                      <Legend wrapperStyle={{ fontSize: "10px" }} iconSize={8} />
                      <Bar dataKey="New"       stackId="a" fill="#16a34a" />
                      <Bar dataKey="Returning" stackId="a" fill="#0ea5e9" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>

            {/* Donor Segments — Donut PieChart */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Donor Segments</p>
              {loading || !segments ? (
                <div className="mt-3 space-y-2">{Array.from({ length: 5 }).map((_, i) => <Sk key={i} h="h-7" />)}</div>
              ) : segPie.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No segment data.</p>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-40 w-40 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={segPie} cx="50%" cy="50%" innerRadius="52%" outerRadius="78%" paddingAngle={2} dataKey="value">
                          {segPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <ReTooltip content={(props) => <PieTooltip {...props} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {segPie.map((d) => (
                      <div key={d.name} className="flex items-center justify-between gap-1.5 text-[11px]">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: d.color }} />
                          <span className="truncate text-slate-700">{d.name}</span>
                        </div>
                        <span className="font-semibold text-slate-900">{d.value.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Top Campaigns — progress cards */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Top Campaigns</p>
              <div className="mt-3 space-y-2">
                {loading
                  ? Array.from({ length: 4 }).map((_, i) => <Sk key={i} h="h-10" />)
                  : campaignRows.length === 0
                  ? <p className="text-xs text-slate-500">No campaign data yet.</p>
                  : campaignRows.slice(0, 5).map((campaign) => {
                      const progress = campaign.goal && campaign.goal > 0
                        ? Math.min(100, Math.round((campaign.raised / campaign.goal) * 100))
                        : 0;
                      return (
                        <div key={campaign.id} className="rounded-md border border-slate-100 bg-slate-50/60 px-2.5 py-2">
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <span className="truncate font-semibold text-slate-900">{campaign.name}</span>
                            <span className="font-semibold text-emerald-700">{formatCurrency(campaign.raised)}</span>
                          </div>
                          {campaign.goal && campaign.goal > 0 && (
                            <>
                              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-emerald-100">
                                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progress}%` }} />
                              </div>
                              <p className="mt-0.5 text-[11px] text-slate-500">{progress}% of {formatCurrency(campaign.goal)} goal</p>
                            </>
                          )}
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {campaign.giftCount.toLocaleString()} gifts · {campaign.uniqueDonors.toLocaleString()} donors
                          </p>
                        </div>
                      );
                    })
                }
              </div>
            </div>

            {/* Payment Mix — Donut PieChart */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Payment Mix</p>
              {loading ? (
                <div className="mt-3 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Sk key={i} h="h-7" />)}</div>
              ) : payPie.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No payment data available.</p>
              ) : (
                <div className="mt-2 flex items-center gap-3">
                  <div className="h-36 w-36 flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={payPie} cx="50%" cy="50%" innerRadius="48%" outerRadius="76%" paddingAngle={2} dataKey="value">
                          {payPie.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Pie>
                        <ReTooltip content={(props) => <PieTooltip {...props} />} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    {payPie.map((d, i) => (
                      <div key={i} className="flex items-center justify-between gap-1.5 text-[11px]">
                        <div className="flex min-w-0 items-center gap-1.5">
                          <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: d.color }} />
                          <span className="truncate text-slate-700">{d.name}</span>
                        </div>
                        <span className="font-semibold text-slate-900">{formatPercent(d.pct)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Row 3 NEW: Giving Tier Bar · New Donors Bar · Retention Gauge ─── */}
          <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">

            {/* Giving by Tier — BarChart with per-bar colour */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Giving by Tier (Raised)</p>
              {loading || !givingTierRows ? (
                <div className="mt-3 space-y-2">{Array.from({ length: 3 }).map((_, i) => <Sk key={i} />)}</div>
              ) : tierBar.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No tier data yet.</p>
              ) : (
                <>
                  <div className="mt-2 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={tierBar} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="name" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                        <YAxis hide />
                        <ReTooltip content={(props) => <ChartTooltip {...props} currency />} />
                        <Bar dataKey="Amount" name="Amount" radius={[4, 4, 0, 0]}>
                          {tierBar.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-1.5">
                    {Object.entries(givingTierRows).map(([key, val]) => (
                      <div key={key} className="flex items-center gap-1.5 text-[11px]">
                        <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: TIER_COLORS[key] ?? "#16a34a" }} />
                        <span className="text-slate-600">{TIER_LABELS[key] ?? key}:</span>
                        <span className="font-semibold text-slate-800">{val.count} gifts</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* New Donors by Month — BarChart */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">New Donors by Month</p>
              {loading ? (
                <div className="mt-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Sk key={i} />)}</div>
              ) : acqData.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">No data available.</p>
              ) : (
                <>
                  <div className="mt-2 h-44">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={acqData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="30%">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                        <YAxis hide />
                        <ReTooltip content={(props) => <ChartTooltip {...props} />} />
                        <Bar dataKey="New" name="New Donors" fill="#16a34a" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  {summary && (
                    <p className="mt-2 text-[11px] text-slate-500">
                      <span className="font-semibold text-emerald-700">{summary.newDonorsThisMonth}</span> new donors this month.
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Retention Gauge — Donut + stats */}
            <div className="rounded-lg border border-slate-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-slate-500">Retention Overview</p>
              {loading || !retention ? (
                <div className="mt-3 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Sk key={i} h="h-8" />)}</div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex items-center gap-4">
                    <div className="h-28 w-28 flex-shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={[
                              { name: "Retained", value: retention.rate },
                              { name: "Lost",     value: Math.max(0, 100 - retention.rate) },
                            ]}
                            cx="50%" cy="50%"
                            innerRadius="58%" outerRadius="80%"
                            startAngle={90} endAngle={-270}
                            paddingAngle={0}
                            dataKey="value"
                          >
                            <Cell fill="#16a34a" />
                            <Cell fill="#e2e8f0" />
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div>
                      <p className="text-3xl font-bold text-emerald-700">{retention.rate.toFixed(0)}%</p>
                      <p className="text-xs font-semibold text-slate-700">Donor Retention</p>
                      <p className="mt-0.5 text-[11px] text-slate-500">{retention.retained.toLocaleString()} retained</p>
                      <p className="text-[11px] text-slate-500">{retention.total.toLocaleString()} prior-year</p>
                    </div>
                  </div>
                  {summary && (
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { label: "Active Campaigns", val: summary.activeCampaigns.toString(), alert: false },
                        { label: "Overdue Tasks",    val: summary.overdueTasks.toString(), alert: summary.overdueTasks > 0 },
                      ].map(({ label, val, alert }) => (
                        <div key={label} className="rounded-md border border-slate-100 bg-slate-50 px-2.5 py-2">
                          <p className="text-[11px] text-slate-500">{label}</p>
                          <p className={`text-lg font-semibold ${alert ? "text-rose-600" : "text-slate-900"}`}>{val}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

        </div>
      )}
    </section>
  );
}
