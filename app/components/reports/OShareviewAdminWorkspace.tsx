// OShareviewAdminWorkspace provides admin-level cross-module reporting for OShareview.
"use client";

import { useEffect, useMemo, useState } from "react";

import { apiFetch } from "@/app/lib/auth-client";
import type { ReportsToolId } from "@/app/components/reports/ReportsModuleToolbar";

type AdminRiskKind = "donor" | "client";

interface AdminMonthlyTrendPoint {
  month: number;
  label: string;
  newConstituents: number;
  newClients: number;
  donations: number;
  casesOpened: number;
  appointmentsCompleted: number;
}

interface AdminRiskRow {
  kind: AdminRiskKind;
  id: string;
  name: string;
  email: string | null;
  status: string;
  missingContact: boolean;
  duplicateEmail: boolean;
  valueAmount: number;
  lastActivity: string | null;
  notes: string;
}

interface AdminAlert {
  id: string;
  level: "info" | "warning" | "critical";
  title: string;
  value: string;
  detail: string;
}

interface AdminSummaryResponse {
  generatedAt: string;
  year: number;
  donorTotals: {
    totalConstituents: number;
    activeDonors: number;
    lapsedDonors: number;
    majorDonors: number;
    newDonorsThisYear: number;
    missingContact: number;
    duplicateEmailCount: number;
    totalGiftVolume: number;
    averageGift: number;
  };
  compassionTotals: {
    totalClients: number;
    activeClients: number;
    pendingClients: number;
    inactiveClients: number;
    archivedClients: number;
    unassignedClients: number;
    openCases: number;
    closedCasesThisYear: number;
    appointmentsScheduled: number;
    appointmentsCompleted: number;
    missingContact: number;
    duplicateEmailCount: number;
  };
  linkage: {
    linkedClients: number;
    unlinkedClients: number;
    linkedConstituents: number;
  };
  monthlyTrend: AdminMonthlyTrendPoint[];
  alerts: AdminAlert[];
  riskRows: AdminRiskRow[];
}

interface OShareviewAdminWorkspaceProps {
  year: number;
  allYears: boolean;
  tool: ReportsToolId;
  filterText: string;
  minAmount: number;
  fromDate?: string;
  toDate?: string;
  canViewAdmin: boolean;
}

function normalizeDateValue(value: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function buildPolyline(points: number[][]): string {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

function MonthlyGrowthChart({ rows }: { rows: AdminMonthlyTrendPoint[] }) {
  const width = 760;
  const height = 220;
  const padX = 36;
  const padY = 22;
  const chartWidth = width - padX * 2;
  const chartHeight = height - padY * 2;
  const divisor = Math.max(
    1,
    ...rows.map((row) => Math.max(row.newConstituents, row.newClients)),
  );

  const donorPoints = rows.map((row, index) => {
    const x = padX + (chartWidth * index) / Math.max(1, rows.length - 1);
    const y = height - padY - (row.newConstituents / divisor) * chartHeight;
    return [x, y] as number[];
  });

  const clientPoints = rows.map((row, index) => {
    const x = padX + (chartWidth * index) / Math.max(1, rows.length - 1);
    const y = height - padY - (row.newClients / divisor) * chartHeight;
    return [x, y] as number[];
  });

  return (
    <section className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Monthly Intake Trend</h4>
          <p className="text-xs text-slate-500">New donor constituents vs new compassion clients</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
            <span className="h-2 w-2 rounded-full bg-emerald-500" /> Donor
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Client
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = height - padY - step * chartHeight;
          return (
            <line key={step} x1={padX} x2={width - padX} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
          );
        })}

        <polyline fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={buildPolyline(donorPoints)} />
        <polyline fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={buildPolyline(clientPoints)} />

        {donorPoints.map(([x, y], index) => (
          <g key={`donor-point-${index}`}>
            <circle cx={x} cy={y} r="3" fill="#10b981" />
            <circle cx={x} cy={clientPoints[index][1]} r="3" fill="#3b82f6" />
            <text x={x} y={height - 4} textAnchor="middle" fontSize="9" fill="#64748b">
              {rows[index]?.label ?? ""}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}

function ServiceLoadChart({ rows }: { rows: AdminMonthlyTrendPoint[] }) {
  const width = 760;
  const height = 220;
  const padX = 36;
  const padY = 22;
  const chartWidth = width - padX * 2;
  const chartHeight = height - padY * 2;
  const divisor = Math.max(
    1,
    ...rows.map((row) => Math.max(row.casesOpened, row.appointmentsCompleted)),
  );

  const casePoints = rows.map((row, index) => {
    const x = padX + (chartWidth * index) / Math.max(1, rows.length - 1);
    const y = height - padY - (row.casesOpened / divisor) * chartHeight;
    return [x, y] as number[];
  });

  const appointmentPoints = rows.map((row, index) => {
    const x = padX + (chartWidth * index) / Math.max(1, rows.length - 1);
    const y = height - padY - (row.appointmentsCompleted / divisor) * chartHeight;
    return [x, y] as number[];
  });

  return (
    <section className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">Service Operations Trend</h4>
          <p className="text-xs text-slate-500">Cases opened vs completed appointments</p>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
            <span className="h-2 w-2 rounded-full bg-amber-500" /> Cases
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-fuchsia-50 px-2 py-0.5 text-fuchsia-700">
            <span className="h-2 w-2 rounded-full bg-fuchsia-500" /> Completed Appointments
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full">
        {[0, 0.25, 0.5, 0.75, 1].map((step) => {
          const y = height - padY - step * chartHeight;
          return (
            <line key={step} x1={padX} x2={width - padX} y1={y} y2={y} stroke="#e2e8f0" strokeDasharray="4 4" />
          );
        })}

        <polyline fill="none" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={buildPolyline(casePoints)} />
        <polyline fill="none" stroke="#d946ef" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" points={buildPolyline(appointmentPoints)} />

        {casePoints.map(([x, y], index) => (
          <g key={`ops-point-${index}`}>
            <circle cx={x} cy={y} r="3" fill="#f59e0b" />
            <circle cx={x} cy={appointmentPoints[index][1]} r="3" fill="#d946ef" />
            <text x={x} y={height - 4} textAnchor="middle" fontSize="9" fill="#64748b">
              {rows[index]?.label ?? ""}
            </text>
          </g>
        ))}
      </svg>
    </section>
  );
}

/**
 * Renders admin-level operational reporting with donor and compassion metrics.
 * Data is intentionally aggregate and operations-focused for privacy-safe dashboards.
 */
export default function OShareviewAdminWorkspace({ year, allYears, tool, filterText, minAmount, fromDate = "", toDate = "", canViewAdmin }: OShareviewAdminWorkspaceProps) {
  const [summary, setSummary] = useState<AdminSummaryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!canViewAdmin) {
      setSummary(null);
      setLoading(false);
      setError(null);
      return;
    }

    const controller = new AbortController();

    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ year: String(year) });
        if (allYears) {
          params.set("scope", "ALL_YEARS");
        }

        const data = await apiFetch<AdminSummaryResponse>(`/api/reports/admin-summary?${params.toString()}`, {
          signal: controller.signal,
        });
        setSummary(data);
      } catch (loadError: unknown) {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(loadError instanceof Error ? loadError.message : "Unable to load admin reporting data.");
      } finally {
        setLoading(false);
      }
    };

    load();

    return () => controller.abort();
  }, [allYears, canViewAdmin, year]);

  const filteredRows = useMemo(() => {
    const rows = summary?.riskRows ?? [];
    const query = filterText.trim().toLowerCase();
    const fromDateMs = normalizeDateValue(fromDate);
    const toDateMs = normalizeDateValue(toDate);

    return rows.filter((row) => {
      if (tool === "admin-donor-ops" && row.kind !== "donor") return false;
      if (tool === "admin-client-ops" && row.kind !== "client") return false;
      if (tool === "admin-data-quality" && !(row.missingContact || row.duplicateEmail)) return false;
      if (row.valueAmount < minAmount) return false;

      if (fromDateMs || toDateMs) {
        const lastActivityMs = normalizeDateValue(row.lastActivity);
        if (!lastActivityMs) return false;
        if (fromDateMs && lastActivityMs < fromDateMs) return false;
        if (toDateMs) {
          const inclusiveToDateMs = toDateMs + (24 * 60 * 60 * 1000) - 1;
          if (lastActivityMs > inclusiveToDateMs) return false;
        }
      }

      if (!query) return true;
      return (
        row.name.toLowerCase().includes(query) ||
        row.status.toLowerCase().includes(query) ||
        row.notes.toLowerCase().includes(query) ||
        (row.email ?? "").toLowerCase().includes(query)
      );
    });
  }, [filterText, fromDate, minAmount, summary?.riskRows, toDate, tool]);

  if (!canViewAdmin) {
    return (
      <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Admin reports are restricted to admin users. Switch to Donor, Events, Compassion, or OGentic scopes for standard reporting.
      </section>
    );
  }

  if (loading) {
    return <section className="rounded-xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-sm text-cyan-900">Loading admin reports...</section>;
  }

  if (error || !summary) {
    return (
      <section className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
        {error ?? "Admin reports are currently unavailable."}
      </section>
    );
  }

  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-xl border border-cyan-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Donor Constituents</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.donorTotals.totalConstituents.toLocaleString()}</p>
          <p className="text-xs text-slate-500">
            Active {summary.donorTotals.activeDonors.toLocaleString()} | Major {summary.donorTotals.majorDonors.toLocaleString()}
          </p>
        </article>
        <article className="rounded-xl border border-cyan-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Compassion Clients</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.compassionTotals.totalClients.toLocaleString()}</p>
          <p className="text-xs text-slate-500">
            Active {summary.compassionTotals.activeClients.toLocaleString()} | Open Cases {summary.compassionTotals.openCases.toLocaleString()}
          </p>
        </article>
        <article className="rounded-xl border border-cyan-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Linked Profiles</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{summary.linkage.linkedClients.toLocaleString()}</p>
          <p className="text-xs text-slate-500">
            Unlinked {summary.linkage.unlinkedClients.toLocaleString()} | Linked donor records {summary.linkage.linkedConstituents.toLocaleString()}
          </p>
        </article>
        <article className="rounded-xl border border-cyan-200 bg-white p-3 shadow-sm">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-cyan-700">Gift Volume</p>
          <p className="mt-1 text-2xl font-bold text-slate-900">{formatMoney(summary.donorTotals.totalGiftVolume)}</p>
          <p className="text-xs text-slate-500">Average gift {formatMoney(summary.donorTotals.averageGift)}</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <MonthlyGrowthChart rows={summary.monthlyTrend} />
        <ServiceLoadChart rows={summary.monthlyTrend} />
      </section>

      <section className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900">Administrative Alerts</h4>
          <p className="text-xs text-slate-500">Generated {formatDate(summary.generatedAt)}</p>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          {summary.alerts.map((alert) => (
            <article
              key={alert.id}
              className={`rounded-lg border px-3 py-2 text-xs ${
                alert.level === "critical"
                  ? "border-rose-200 bg-rose-50 text-rose-900"
                  : alert.level === "warning"
                  ? "border-amber-200 bg-amber-50 text-amber-900"
                  : "border-cyan-200 bg-cyan-50 text-cyan-900"
              }`}
            >
              <p className="font-semibold">{alert.title}: {alert.value}</p>
              <p className="mt-1">{alert.detail}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-cyan-100 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-slate-900">Administrative Report Rows</h4>
          <p className="text-xs text-slate-500">{filteredRows.length.toLocaleString()} rows after filters</p>
        </div>

        <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-[860px] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-600">
                <th className="px-2 py-1.5 font-semibold">Record</th>
                <th className="px-2 py-1.5 font-semibold">Type</th>
                <th className="px-2 py-1.5 font-semibold">Status</th>
                <th className="px-2 py-1.5 font-semibold">Contact</th>
                <th className="px-2 py-1.5 font-semibold">Value</th>
                <th className="px-2 py-1.5 font-semibold">Last Activity</th>
                <th className="px-2 py-1.5 font-semibold">Signals</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={`${row.kind}-${row.id}`} className="border-b border-slate-100 text-slate-700">
                  <td className="px-2 py-1.5 font-medium text-slate-900">{row.name}</td>
                  <td className="px-2 py-1.5 capitalize">{row.kind}</td>
                  <td className="px-2 py-1.5">{row.status.replaceAll("_", " ")}</td>
                  <td className="px-2 py-1.5">{row.email ?? "No email"}</td>
                  <td className="px-2 py-1.5">{formatMoney(row.valueAmount)}</td>
                  <td className="px-2 py-1.5">{formatDate(row.lastActivity)}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex flex-wrap gap-1">
                      {row.missingContact && (
                        <span className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                          Missing Contact
                        </span>
                      )}
                      {row.duplicateEmail && (
                        <span className="rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-900">
                          Duplicate Email
                        </span>
                      )}
                      {!row.missingContact && !row.duplicateEmail && (
                        <span className="rounded-full border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-900">
                          {row.notes}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
