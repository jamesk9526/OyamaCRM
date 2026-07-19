"use client";
/**
 * GivingTrendChart — SVG line chart showing monthly donation totals for the active reporting year.
 * Fetches /api/reports/giving-by-month and reorders fiscal-year months by org settings.
 * When includeGrants=true, stacks awarded grant amounts on top of each bar in a lighter shade.
 * Renders 12 bars with hover tooltips and month labels.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { getFiscalYearForDate, normalizeFiscalYearStart } from "@/app/lib/fiscal-year";

interface MonthData {
  month: number;       // 1-12
  amount: number;      // donation total
  grantAmount: number; // awarded grant total (may be 0)
}

interface TrendPoint {
  month: number;
  label: string;
  current: number;
  previous: number;
}

interface FiscalSettingsResponse {
  fiscalYearStart?: number;
}

interface GivingTrendChartProps {
  /**
   * When true, grant amounts are stacked onto each bar and counted in the YTD total.
   * This matches the "Include Grants" toggle on the dashboard.
   */
  includeGrants?: boolean;
  /** Applies the global reporting-year mode selected in the TopBar. */
  dateBasis?: "calendar" | "fiscal";
}

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Exact currency formatting for trend tooltips (no K/M shorthand). */
function formatCurrencyExact(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
}

export default function GivingTrendChart({ includeGrants = false, dateBasis = "calendar" }: GivingTrendChartProps) {
  const [currentData, setCurrentData] = useState<MonthData[]>([]);
  const [previousData, setPreviousData] = useState<MonthData[]>([]);
  const [fiscalYearStart, setFiscalYearStart] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hoveredMonth, setHoveredMonth] = useState<number | null>(null);

  const year = new Date().getFullYear();
  const currentFiscalYear = getFiscalYearForDate(new Date(), fiscalYearStart);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    async function loadTrend() {
      try {
        const settings = dateBasis === "fiscal"
          ? await apiFetch<FiscalSettingsResponse>("/api/settings").catch(() => null)
          : null;
        const resolvedFiscalYearStart = normalizeFiscalYearStart(settings?.fiscalYearStart);
        const resolvedFiscalYear = getFiscalYearForDate(new Date(), resolvedFiscalYearStart);
        const currentQuery = dateBasis === "fiscal"
          ? `dateBasis=fiscal&year=${resolvedFiscalYear}`
          : `year=${year}`;
        const previousQuery = dateBasis === "fiscal"
          ? `dateBasis=fiscal&year=${resolvedFiscalYear - 1}`
          : `year=${year - 1}`;

        const [rows, prevRows] = await Promise.all([
          apiFetch<MonthData[]>(`/api/reports/giving-by-month?${currentQuery}`),
          apiFetch<MonthData[]>(`/api/reports/giving-by-month?${previousQuery}`),
        ]);

        if (cancelled) return;
        setFiscalYearStart(resolvedFiscalYearStart);

        const source = Array.isArray(rows) ? rows : [];
        // Ensure all 12 months are present (fill zeros), pick up the new grantAmount field.
        const filled = Array.from({ length: 12 }, (_, i) => {
          const found = source.find((row) => row.month === i + 1);
          return {
            month: i + 1,
            amount: Number(found?.amount ?? 0),
            grantAmount: Number(found?.grantAmount ?? 0),
          };
        });
        const prevSource = Array.isArray(prevRows) ? prevRows : [];
        const prevFilled = Array.from({ length: 12 }, (_, i) => {
          const found = prevSource.find((row) => row.month === i + 1);
          return {
            month: i + 1,
            amount: Number(found?.amount ?? 0),
            grantAmount: Number(found?.grantAmount ?? 0),
          };
        });

        setCurrentData(filled);
        setPreviousData(prevFilled);
      } catch (requestError) {
        if (cancelled) return;
        setCurrentData([]);
        setPreviousData([]);
        setError(requestError instanceof Error ? requestError.message : "Failed to load giving trend.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTrend();

    return () => {
      cancelled = true;
    };
  }, [dateBasis, year]);

  /** Point total = donations + grants (when includeGrants is on). */
  const monthTotal = useCallback((d: MonthData) => d.amount + (includeGrants ? d.grantAmount : 0), [includeGrants]);

  const points: TrendPoint[] = useMemo(() => {
    const monthSequence = Array.from({ length: 12 }, (_, i) => (
      dateBasis === "fiscal"
        ? ((fiscalYearStart - 1 + i) % 12) + 1
        : i + 1
    ));
    return monthSequence.map((month) => ({
      month,
      label: MONTH_LABELS[month - 1],
      current: monthTotal(currentData.find((row) => row.month === month) ?? { month, amount: 0, grantAmount: 0 }),
      previous: monthTotal(previousData.find((row) => row.month === month) ?? { month, amount: 0, grantAmount: 0 }),
    }));
  }, [currentData, previousData, dateBasis, fiscalYearStart, monthTotal]);

  const totalYTD = points.reduce((sum, p) => sum + p.current, 0);
  const maxValue = Math.max(
    1,
    ...points.map((p) => p.current),
    ...points.map((p) => p.previous),
  );

  const roundedMax = Math.ceil(maxValue / 50000) * 50000 || 50000;

  const chart = {
    width: 760,
    height: 250,
    padTop: 16,
    padRight: 14,
    padBottom: 28,
    padLeft: 52,
  };
  const plotW = chart.width - chart.padLeft - chart.padRight;
  const plotH = chart.height - chart.padTop - chart.padBottom;

  const xFor = (index: number) => chart.padLeft + (plotW / 11) * index;
  const yFor = (value: number) => chart.padTop + plotH - (value / roundedMax) * plotH;

  const currentPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)} ${yFor(p.current)}`)
    .join(" ");
  const previousPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${xFor(i)} ${yFor(p.previous)}`)
    .join(" ");

  const hovered = hoveredMonth != null ? points[hoveredMonth - 1] : null;
  const isFlatZero = points.every((p) => p.current === 0 && p.previous === 0);

  const yTicks = [1, 0.75, 0.5, 0.25, 0].map((t) => Math.round(roundedMax * t));

  function fmtCompactCurrency(value: number): string {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${Math.round(value / 1_000)}K`;
    return `$${Math.round(value)}`;
  }

  return (
    <div className="flex h-full min-h-[200px] flex-col">
      {/* Sub-header */}
      <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-100 bg-gradient-to-r from-emerald-50/70 to-white px-3 py-2.5">
        <div>
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-500">{dateBasis === "fiscal" ? "Fiscal YTD Total" : "YTD Total"}</span>
          <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-900">
            {loading ? "—" : formatCurrencyExact(totalYTD)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Grants-included badge (visual feedback mirroring the toggle on Revenue Progress) */}
          {includeGrants && (
            <span className="text-[10px] font-medium bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-full px-2 py-0.5">
              + Grants
            </span>
          )}
          <span className="text-xs font-medium text-gray-400">{dateBasis === "fiscal" ? `FY ${currentFiscalYear}` : year}</span>
        </div>
      </div>

      {/* Trend chart */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-pulse text-gray-300 text-sm">Loading chart…</div>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <p className="text-sm text-amber-700">Could not load trend data.</p>
          <p className="text-xs text-gray-500 mt-1">{error}</p>
        </div>
      ) : isFlatZero ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
          <p className="text-sm text-slate-700">No monthly giving data yet.</p>
          <p className="text-xs text-slate-500 mt-1">Record donations to populate the trend graph.</p>
        </div>
      ) : (
        <div className="relative flex-1 overflow-hidden rounded-2xl border border-slate-100 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          {hovered ? (
            <div className="absolute left-3 top-2 z-10 rounded-xl border border-slate-200 bg-white/95 px-3 py-2 text-[11px] shadow-[0_12px_28px_rgba(15,23,42,0.13)] backdrop-blur-md">
              <p className="font-semibold text-slate-800">{hovered.label}</p>
              <p className="text-emerald-700">This year: {formatCurrencyExact(hovered.current)}</p>
              <p className="text-slate-500">Prior year: {formatCurrencyExact(hovered.previous)}</p>
            </div>
          ) : null}

          <svg viewBox={`0 0 ${chart.width} ${chart.height}`} className="h-full w-full">
            <defs>
              <linearGradient id="giving-trend-area" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
              </linearGradient>
              <filter id="giving-trend-glow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="3" stdDeviation="3" floodColor="#10b981" floodOpacity="0.2" />
              </filter>
            </defs>
            {/* Grid + Y labels */}
            {yTicks.map((tick) => {
              const y = yFor(tick);
              return (
                <g key={tick}>
                  <line x1={chart.padLeft} y1={y} x2={chart.width - chart.padRight} y2={y} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={tick === 0 ? undefined : "3 5"} />
                  <text x={chart.padLeft - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                    {fmtCompactCurrency(tick)}
                  </text>
                </g>
              );
            })}

            {/* X labels */}
            {points.map((p, i) => (
              <text key={p.month} x={xFor(i)} y={chart.height - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
                {p.label}
              </text>
            ))}

            {/* Prior reporting year line */}
            <path d={previousPath} fill="none" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />

            {/* This year line */}
            <path d={`${currentPath} L${xFor(11)} ${chart.height - chart.padBottom} L${xFor(0)} ${chart.height - chart.padBottom} Z`} fill="url(#giving-trend-area)" />
            <path d={currentPath} fill="none" stroke="#059669" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" filter="url(#giving-trend-glow)" />

            {/* Hover guide + points */}
            {points.map((p, i) => {
              const cx = xFor(i);
              const cy = yFor(p.current);
              const isActive = hoveredMonth === p.month;
              return (
                <g
                  key={`point-${p.month}`}
                  onMouseEnter={() => setHoveredMonth(p.month)}
                  onMouseLeave={() => setHoveredMonth(null)}
                  style={{ cursor: "pointer" }}
                >
                  {isActive ? (
                    <line x1={cx} y1={chart.padTop} x2={cx} y2={chart.height - chart.padBottom} stroke="#d1d5db" strokeDasharray="3 3" />
                  ) : null}
                  <rect x={cx - plotW / 24} y={chart.padTop} width={plotW / 12} height={plotH} fill="transparent" />
                  <circle cx={cx} cy={cy} r={isActive ? 5 : 3.5} fill="#059669" stroke="#ffffff" strokeWidth="2" />
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {/* Grant legend — only shown when grants are stacked */}
      {includeGrants && (
        <div className="flex items-center gap-3 mt-2 pt-2 border-t border-gray-100">
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-green-400" />
            Donations
          </span>
          <span className="flex items-center gap-1.5 text-[10px] text-gray-500">
            <span className="inline-block w-2.5 h-2.5 rounded-sm bg-emerald-200" />
            Grants
          </span>
        </div>
      )}

      <div className="mt-2 flex items-center gap-3 text-[10px] text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          {dateBasis === "fiscal" ? "This fiscal year" : "This year"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0 w-4 border-t-2 border-dashed border-slate-400" />
          Prior year
        </span>
      </div>
    </div>
  );
}
