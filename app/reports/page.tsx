/**
 * Reports & Analytics page — comprehensive fundraising analytics with tabbed sections.
 * Tabs: Overview | Donors | Giving | Campaigns | Retention
 * All charts are pure CSS/SVG/Tailwind (no external chart library).
 */
"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import ReportsModuleToolbar, {
  getDefaultReportsTool,
  type ReportsToolId,
  type ReportsWorkspaceModule,
} from "@/app/components/reports/ReportsModuleToolbar";
import OShareviewNotesPanel from "@/app/components/reports/OShareviewNotesPanel";
import OShareviewBlueprintsPanel, {
  type OShareviewReportBlueprint,
  type ReportTabId,
} from "@/app/components/reports/OShareviewBlueprintsPanel";
import OShareviewCoveragePanel from "@/app/components/reports/OShareviewCoveragePanel";
import OShareviewAdminWorkspace from "@/app/components/reports/OShareviewAdminWorkspace";
import DonorPacketReportTool from "@/app/components/reports/DonorPacketReportTool";
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
  const validModules: ReportsWorkspaceModule[] = ["donor", "events", "compassion", "ogentic", "admin"];
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
  freshness?: {
    generatedAt: string;
    dataThrough: string;
  };
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

/** Multi-year retention point (same shape as yearly retention payload). */
type RetentionTrendPoint = Retention;

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

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface ReportPacketPayload {
  title: string;
  subtitle: string;
  rows: Array<Record<string, unknown>>;
  generatedAt: string;
}

function normalizeDownloadName(title: string): string {
  return `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "report-packet"}.pdf`;
}

function toNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[^0-9.-]+/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function pickRowLabel(row: Record<string, unknown>, fallback: string): string {
  const text = Object.values(row).find((value) => typeof value === "string" && value.trim().length > 0);
  if (!text) return fallback;
  return String(text).slice(0, 42);
}

function pickRowValue(row: Record<string, unknown>): number | null {
  const priorityKeys = ["Revenue", "Raised", "LifetimeGiving", "Amount", "Count", "Donors", "Gifts"];
  for (const key of priorityKeys) {
    if (!(key in row)) continue;
    const numeric = toNumeric(row[key]);
    if (numeric !== null) return numeric;
  }

  for (const value of Object.values(row)) {
    const numeric = toNumeric(value);
    if (numeric !== null) return numeric;
  }

  return null;
}

function buildPdfViewerHtml({
  title,
  generatedAt,
  downloadName,
  rowCount,
  pdfUrl,
}: {
  title: string;
  generatedAt: string;
  downloadName: string;
  rowCount: number;
  pdfUrl: string;
}): string {
  const safeTitle = escapeHtml(title);
  const safeGeneratedAt = escapeHtml(generatedAt);
  const safeDownloadName = escapeHtml(downloadName);
  const safePdfUrl = escapeHtml(pdfUrl);

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle} - PDF Viewer</title>
    <style>
      :root { color-scheme: light; }
      body { margin: 0; font-family: "Segoe UI", Arial, sans-serif; background: #f8fafc; color: #0f172a; }
      .topbar {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 14px;
        border-bottom: 1px solid #dbeafe;
        background: linear-gradient(90deg, #ecfeff 0%, #f0fdf4 100%);
      }
      .meta { min-width: 0; }
      .title { font-size: 14px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .sub { margin-top: 2px; font-size: 11px; color: #475569; }
      .actions { display: flex; align-items: center; gap: 8px; }
      .btn {
        border: 1px solid #94a3b8;
        border-radius: 8px;
        background: #ffffff;
        padding: 7px 10px;
        font-size: 12px;
        font-weight: 600;
        color: #0f172a;
        text-decoration: none;
        cursor: pointer;
      }
      .btn.primary { border-color: #16a34a; background: #16a34a; color: #ffffff; }
      iframe {
        display: block;
        width: 100%;
        height: calc(100vh - 60px);
        border: 0;
        background: #ffffff;
      }
    </style>
  </head>
  <body>
    <header class="topbar">
      <div class="meta">
        <div class="title">${safeTitle}</div>
        <div class="sub">Generated ${safeGeneratedAt} | ${rowCount} rows</div>
      </div>
      <div class="actions">
        <a class="btn primary" href="${safePdfUrl}" download="${safeDownloadName}">Download PDF</a>
        <button class="btn" type="button" onclick="window.print()">Print</button>
      </div>
    </header>
    <iframe src="${safePdfUrl}#zoom=page-width" title="Report PDF Viewer"></iframe>
  </body>
</html>`;
}

async function buildReportPacketPdfBlob(packet: ReportPacketPayload): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "pt", format: "letter", orientation: "landscape" });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 36;
  const usableWidth = pageWidth - margin * 2;
  let y = margin;

  doc.setFillColor(236, 253, 245);
  doc.rect(0, 0, pageWidth, 96, "F");
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.setFontSize(20);
  doc.text(packet.title, margin, y + 24);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(51, 65, 85);
  doc.text(packet.subtitle, margin, y + 44, { maxWidth: usableWidth });
  doc.text(`Generated ${packet.generatedAt}`, margin, y + 62);
  y = 110;

  const values = packet.rows
    .map((row) => pickRowValue(row))
    .filter((value): value is number => value !== null);
  const totalValue = values.reduce((sum, value) => sum + value, 0);
  const avgValue = values.length > 0 ? totalValue / values.length : 0;
  const stats = [
    { label: "Rows", value: String(packet.rows.length) },
    { label: "Total Value", value: `$${fmtCurrency(totalValue)}` },
    { label: "Average", value: `$${fmtCurrency(avgValue)}` },
  ];
  const statCardWidth = (usableWidth - 16) / 3;
  stats.forEach((stat, index) => {
    const x = margin + index * (statCardWidth + 8);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(x, y, statCardWidth, 50, 6, 6, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(stat.label, x + 10, y + 18);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(stat.value, x + 10, y + 36);
  });
  y += 66;

  const chartRows = packet.rows
    .map((row, index) => ({
      label: pickRowLabel(row, `Row ${index + 1}`),
      value: pickRowValue(row) ?? 0,
    }))
    .filter((entry) => entry.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(15, 23, 42);
  doc.text("Visual Snapshot", margin, y);
  y += 8;

  const chartX = margin;
  const chartY = y;
  const chartHeight = 124;
  const barAreaWidth = usableWidth - 180;
  const chartMax = Math.max(...chartRows.map((entry) => entry.value), 1);
  doc.setDrawColor(226, 232, 240);
  doc.rect(chartX, chartY, usableWidth, chartHeight);

  if (chartRows.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("No numeric values available for charting.", chartX + 10, chartY + 20);
  } else {
    chartRows.forEach((entry, index) => {
      const rowY = chartY + 16 + index * 14;
      const barWidth = Math.max(6, Math.round((entry.value / chartMax) * barAreaWidth));
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(51, 65, 85);
      doc.text(entry.label, chartX + 8, rowY);
      doc.setFillColor(22, 163, 74);
      doc.roundedRect(chartX + 122, rowY - 8, barWidth, 8, 2, 2, "F");
      doc.setFont("helvetica", "bold");
      doc.text(`$${fmtCurrency(entry.value)}`, chartX + 126 + barWidth, rowY);
    });
  }

  y = chartY + chartHeight + 16;
  const headers = packet.rows.length > 0 ? Object.keys(packet.rows[0]).slice(0, 6) : [];

  if (headers.length === 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(100, 116, 139);
    doc.text("No rows matched the current filters.", margin, y);
    return doc.output("blob");
  }

  const drawTableHeader = () => {
    const colWidth = usableWidth / headers.length;
    doc.setFillColor(241, 245, 249);
    doc.setDrawColor(203, 213, 225);
    doc.rect(margin, y, usableWidth, 18, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    headers.forEach((header, index) => {
      doc.text(header, margin + index * colWidth + 4, y + 12, { maxWidth: colWidth - 8 });
    });
    y += 18;
  };

  drawTableHeader();

  const rowHeight = 16;
  const maxRows = 80;
  const rowsToRender = packet.rows.slice(0, maxRows);
  rowsToRender.forEach((row) => {
    if (y + rowHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      drawTableHeader();
    }
    const colWidth = usableWidth / headers.length;
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, usableWidth, rowHeight);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(51, 65, 85);
    headers.forEach((header, index) => {
      const raw = String(row[header] ?? "");
      const clipped = raw.length > 44 ? `${raw.slice(0, 41)}...` : raw;
      doc.text(clipped, margin + index * colWidth + 4, y + 11, { maxWidth: colWidth - 8 });
    });
    y += rowHeight;
  });

  return doc.output("blob");
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
 * Multi-year donor retention trend line chart.
 * X axis: year, Y axis: retention rate (0-100).
 */
function RetentionTrendChart({ data }: { data: RetentionTrendPoint[] }) {
  const W = 720;
  const H = 220;
  const PAD_L = 44;
  const PAD_R = 16;
  const PAD_T = 12;
  const PAD_B = 34;
  const chartW = W - PAD_L - PAD_R;
  const chartH = H - PAD_T - PAD_B;

  const points = data.map((point, index) => {
    const x = PAD_L + (index / Math.max(data.length - 1, 1)) * chartW;
    const y = PAD_T + ((100 - Math.max(0, Math.min(100, point.rate))) / 100) * chartH;
    return { ...point, x, y };
  });

  const linePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ maxHeight: 250 }}>
        {[0, 25, 50, 75, 100].map((value) => {
          const y = PAD_T + ((100 - value) / 100) * chartH;
          return (
            <g key={value}>
              <line x1={PAD_L} y1={y} x2={W - PAD_R} y2={y} stroke="#e5e7eb" strokeWidth="0.75" />
              <text x={PAD_L - 6} y={y + 3} textAnchor="end" fontSize="9" fill="#94a3b8">
                {value}%
              </text>
            </g>
          );
        })}

        <line
          x1={PAD_L}
          y1={PAD_T + chartH}
          x2={W - PAD_R}
          y2={PAD_T + chartH}
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {linePath ? <path d={linePath} fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" /> : null}

        {points.map((point) => (
          <g key={point.year}>
            <circle cx={point.x} cy={point.y} r="4" fill="#16a34a" stroke="#ffffff" strokeWidth="1.5">
              <title>
                {point.year}: {point.rate}% ({point.retained}/{point.total})
              </title>
            </circle>
            <text x={point.x} y={H - 8} textAnchor="middle" fontSize="9" fill="#64748b">
              {point.year}
            </text>
          </g>
        ))}
      </svg>
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
  const { user } = useAuth();

  // ── Global UI state ───────────────────────────────────────────────────────
  const [activeModule, setActiveModule] = useState<ReportsWorkspaceModule>(() => parseReportsModule(searchParams.get("module")));
  const [activeTool, setActiveTool] = useState<ReportsToolId>(() => getDefaultReportsTool(parseReportsModule(searchParams.get("module"))));
  const [activeTab, setActiveTab] = useState<TabId>(() => parseTabId(searchParams.get("tab")));
  const [year, setYear] = useState<number>(CURRENT_YEAR);
  const [allYears, setAllYears] = useState(false);
  const [recordFilterText, setRecordFilterText] = useState("");
  const [minValueFilter, setMinValueFilter] = useState<number>(0);
  const [campaignStatusFilter, setCampaignStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [donorReportsError, setDonorReportsError] = useState<string | null>(null);
  const [lastLiveRefreshAt, setLastLiveRefreshAt] = useState<Date>(new Date());

  function toErrorMessage(err: unknown, fallback: string): string {
    if (err instanceof Error && err.message.trim().length > 0) {
      return err.message;
    }
    return fallback;
  }

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
  const [retentionTrend, setRetentionTrend] = useState<RetentionTrendPoint[]>([]);
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
    setDonorReportsError(null);
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
      setDonorReportsError(toErrorMessage(err, "Failed to load overview report data."));
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
    setDonorReportsError(null);
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
      setDonorReportsError(toErrorMessage(err, "Failed to load donor report data."));
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
    setDonorReportsError(null);
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
      setDonorReportsError(toErrorMessage(err, "Failed to load giving report data."));
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
    setDonorReportsError(null);
    try {
      const data = await apiFetch<CampaignPerformance[]>(`/api/reports/campaign-performance?${scope}`);
      setCampaigns(Array.isArray(data) ? data : []);
    } catch (err) {
      setDonorReportsError(toErrorMessage(err, "Failed to load campaign report data."));
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
    setDonorReportsError(null);
    try {
      const trendStartYear = y - 4;
      const trendYears = Array.from({ length: 5 }, (_, index) => trendStartYear + index);

      const trendRows = await Promise.all(
        trendYears.map((trendYear) => apiFetch<Retention>(`/api/reports/donor-retention?year=${trendYear}`))
      );
      const orderedTrend = trendRows.sort((a, b) => a.year - b.year);
      setRetentionTrend(orderedTrend);

      const selectedYearRetention = orderedTrend.find((row) => row.year === y) ?? null;
      if (selectedYearRetention) {
        setRetention(selectedYearRetention);
      }

      await loadDonors(y);
    } catch (err) {
      setRetentionTrend([]);
      setDonorReportsError(toErrorMessage(err, "Failed to load retention report data."));
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

  /** Periodic live refresh loop for OShareview dashboard presentation. */
  useEffect(() => {
    const timer = window.setInterval(() => {
      loadedRef.current = {};
      void loadOverview(year);

      if (activeModule === "events") {
        setEventsSummary(null);
        void loadEventsModuleSummary();
      }

      if (activeModule === "compassion") {
        setCompassionSummary(null);
        void loadCompassionModuleSummary();
      }

      setLastLiveRefreshAt(new Date());
    }, 45000);

    return () => {
      window.clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, activeModule]);

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
    if (toolId === "donor-donors" || toolId === "donor-segmentation") {
      handleTabChange("donors");
      return;
    }
    if (toolId === "donor-donor-packet") {
      return;
    }
    if (toolId === "donor-giving" || toolId === "donor-payment-methods") {
      handleTabChange("giving");
      return;
    }
    if (toolId === "donor-campaigns" || toolId === "donor-pipeline") {
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
        filteredEventsTopEvents.map((event) => ({
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
        filteredCompassionAppointments.map((row) => ({
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

    if (activeModule === "admin") {
      exportCSV(
        [
          {
            Module: "Admin",
            Tool: activeTool,
            Scope: scopeLabel,
            Filter: recordFilterText.trim() || "none",
            MinValue: minValueFilter,
          },
        ],
        "admin-reporting-context.csv"
      );
      return;
    }

    switch (activeTab) {
      case "overview":
        exportCSV(
          filteredTopDonors.map((d) => ({
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
          filteredLybunt.map((d) => ({
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
          filteredCampaigns.map((c) => ({
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
          filteredLybunt.map((d) => ({
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

  /** Triggers a server-generated CSV export for permission-gated report downloads. */
  function handleServerExport() {
    const scope = new URLSearchParams({ year: String(year) });
    window.location.assign(`/api/reports/exports/giving-by-month.csv?${scope.toString()}`);
  }

  /** Uses a dedicated printable packet window for more reliable PDF generation workflows. */
  function handlePrintCurrentReport() {
    const generatedAt = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
    const scopeText = `${scopeLabel}${allYears ? "" : " scope"} | Filter: ${recordFilterText.trim() || "none"} | Min value: $${fmtCurrency(minValueFilter)}`;
    let title = "OShareview Report Packet";
    let rows: Array<Record<string, unknown>> = [];

    if (activeModule === "events") {
      title = "Events Reporting Packet";
      rows = filteredEventsTopEvents.map((event) => ({
        Event: event.name,
        Type: event.type,
        Revenue: `$${fmtCurrency(event.revenue)}`,
        Guests: event.guests,
        CheckedIn: event.checkedIn,
        AttendanceRate: `${event.guests > 0 ? Math.round((event.checkedIn / event.guests) * 100) : 0}%`,
      }));
    } else if (activeModule === "compassion") {
      title = "Compassion Reporting Packet";
      rows = filteredCompassionAppointments.map((row) => ({
        AppointmentType: row.label,
        Count: row.value,
      }));
    } else if (activeModule === "ogentic") {
      title = "OGentic Reporting Packet";
      rows = [
        {
          Drafts: ogenticArtifactsCount.drafts,
          Reports: ogenticArtifactsCount.reports,
          Analyses: ogenticArtifactsCount.analyses,
          Scope: scopeLabel,
        },
      ];
    } else if (activeModule === "admin") {
      title = "Administrative Reporting Packet";
      rows = [
        {
          Module: "Admin",
          Tool: activeTool,
          Scope: scopeLabel,
          Note: "Use Export CSV inside admin rows if this view is filtered to operational records.",
        },
      ];
    } else {
      switch (activeTab) {
        case "overview":
          title = "Top Donors Packet";
          rows = filteredTopDonors.map((donor) => ({
            Name: `${donor.firstName} ${donor.lastName}`,
            Email: donor.email ?? "",
            LifetimeGiving: `$${fmtCurrency(Number(donor.totalLifetimeGiving ?? 0))}`,
            LastGift: fmtDate(donor.lastGiftDate),
            Status: donor.donorStatus,
          }));
          break;
        case "donors":
          title = showSybunt ? "SYBUNT Packet" : "LYBUNT Packet";
          rows = (showSybunt ? filteredSybunt : filteredLybunt).map((donor) => ({
            Name: `${donor.firstName} ${donor.lastName}`,
            Email: donor.email ?? "",
            LastGiftDate: fmtDate(donor.lastGiftDate),
            LastGiftAmount: `$${fmtCurrency(Number(donor.lastGiftAmount ?? 0))}`,
            LifetimeGiving: `$${fmtCurrency(Number(donor.totalLifetimeGiving ?? 0))}`,
            Status: donor.donorStatus,
          }));
          break;
        case "giving":
          title = `Year Comparison Packet (${year})`;
          rows = yearComparison.map((row) => ({
            Month: MONTHS_SHORT[row.month - 1],
            [String(year)]: `$${fmtCurrency(row.thisYear)}`,
            [String(year - 1)]: `$${fmtCurrency(row.lastYear)}`,
          }));
          break;
        case "campaigns":
          title = "Campaign Performance Packet";
          rows = filteredCampaigns.map((campaign) => ({
            Campaign: campaign.name,
            Active: campaign.active ? "Yes" : "No",
            Raised: `$${fmtCurrency(campaign.raised)}`,
            Goal: campaign.goal ? `$${fmtCurrency(campaign.goal)}` : "",
            Gifts: campaign.giftCount,
            Donors: campaign.uniqueDonors,
            AvgGift: `$${fmtCurrency(campaign.avgGift)}`,
          }));
          break;
        case "retention":
          title = "Retention Opportunity Packet";
          rows = filteredLybunt.map((donor) => ({
            Name: `${donor.firstName} ${donor.lastName}`,
            Email: donor.email ?? "",
            LastGiftDate: fmtDate(donor.lastGiftDate),
            LifetimeGiving: `$${fmtCurrency(Number(donor.totalLifetimeGiving ?? 0))}`,
            Status: donor.donorStatus,
          }));
          break;
      }
    }

    const packet: ReportPacketPayload = {
      title,
      subtitle: scopeText,
      rows,
      generatedAt,
    };

    const loadingTitle = escapeHtml(`${title} - Preparing visual PDF...`);
    const viewerWindow = window.open("", "_blank", "noopener,noreferrer,width=1320,height=900");
    if (viewerWindow) {
      viewerWindow.document.open();
      viewerWindow.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>${loadingTitle}</title><style>body{font-family:Segoe UI,Arial,sans-serif;background:#f8fafc;color:#0f172a;margin:0;display:grid;place-items:center;height:100vh}.card{padding:24px 28px;border:1px solid #dbeafe;background:#ffffff;border-radius:12px;box-shadow:0 8px 24px rgba(15,23,42,.08)}.spinner{width:20px;height:20px;border:2px solid #bfdbfe;border-top-color:#16a34a;border-radius:999px;animation:spin 1s linear infinite;margin:0 auto 10px}@keyframes spin{to{transform:rotate(360deg)}}</style></head><body><div class="card"><div class="spinner"></div><div>Building visual report PDF...</div></div></body></html>`);
      viewerWindow.document.close();
    }

    void (async () => {
      try {
        const pdfBlob = await buildReportPacketPdfBlob(packet);
        const pdfUrl = URL.createObjectURL(pdfBlob);
        const downloadName = normalizeDownloadName(packet.title);
        const viewerHtml = buildPdfViewerHtml({
          title: packet.title,
          generatedAt: packet.generatedAt,
          downloadName,
          rowCount: packet.rows.length,
          pdfUrl,
        });

        if (viewerWindow && !viewerWindow.closed) {
          viewerWindow.document.open();
          viewerWindow.document.write(viewerHtml);
          viewerWindow.document.close();
          viewerWindow.focus();
        } else {
          // Same-tab fallback if popup opening is blocked.
          window.location.assign(pdfUrl);
        }

        window.setTimeout(() => {
          URL.revokeObjectURL(pdfUrl);
        }, 10 * 60 * 1000);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown PDF generation error.";
        if (viewerWindow && !viewerWindow.closed) {
          viewerWindow.document.open();
          viewerWindow.document.write(`<!doctype html><html><head><meta charset="utf-8" /><title>PDF Error</title><style>body{font-family:Segoe UI,Arial,sans-serif;background:#fef2f2;color:#7f1d1d;margin:0;display:grid;place-items:center;height:100vh}.card{padding:20px 22px;border:1px solid #fecaca;background:#fff1f2;border-radius:12px;max-width:580px}</style></head><body><div class="card"><strong>Unable to generate visual PDF.</strong><div style="margin-top:8px;">${escapeHtml(message)}</div></div></body></html>`);
          viewerWindow.document.close();
        } else {
          window.alert("Unable to generate visual PDF packet.");
        }
      }
    })();
  }

  function handleApplyBlueprint(blueprint: OShareviewReportBlueprint) {
    setActiveModule(blueprint.module);
    setActiveTool(blueprint.tool as ReportsToolId);
    setActiveTab(blueprint.tab as TabId);
    setYear(blueprint.year);
    setAllYears(blueprint.allYears);
    setIncludeGrants(blueprint.includeGrants);

    if (blueprint.exportMode === "server_csv") {
      window.setTimeout(() => handleServerExport(), 50);
      return;
    }
    if (blueprint.exportMode === "print") {
      window.setTimeout(() => handlePrintCurrentReport(), 50);
    }
  }

  // ── Derived values ────────────────────────────────────────────────────────

  /** Total number of constituents across all segments (for percentage bars). */
  const segmentTotal = donorSegments
    ? Object.values(donorSegments).reduce((a, b) => a + b, 0)
    : 0;

  const normalizedFilter = recordFilterText.trim().toLowerCase();

  const filteredTopDonors = topDonors.filter((donor) => {
    const fullName = `${donor.firstName} ${donor.lastName}`.toLowerCase();
    const matchesQuery =
      normalizedFilter.length === 0
      || fullName.includes(normalizedFilter)
      || (donor.email ?? "").toLowerCase().includes(normalizedFilter)
      || donor.donorStatus.toLowerCase().includes(normalizedFilter);
    const lifetimeGiving = Number(donor.totalLifetimeGiving ?? 0);
    return matchesQuery && lifetimeGiving >= minValueFilter;
  });

  const filteredLybunt = lybunt.filter((donor) => {
    const fullName = `${donor.firstName} ${donor.lastName}`.toLowerCase();
    const matchesQuery =
      normalizedFilter.length === 0
      || fullName.includes(normalizedFilter)
      || (donor.email ?? "").toLowerCase().includes(normalizedFilter)
      || donor.donorStatus.toLowerCase().includes(normalizedFilter);
    const lifetimeGiving = Number(donor.totalLifetimeGiving ?? 0);
    return matchesQuery && lifetimeGiving >= minValueFilter;
  });

  const filteredSybunt = sybunt.filter((donor) => {
    const fullName = `${donor.firstName} ${donor.lastName}`.toLowerCase();
    const matchesQuery =
      normalizedFilter.length === 0
      || fullName.includes(normalizedFilter)
      || (donor.email ?? "").toLowerCase().includes(normalizedFilter)
      || donor.donorStatus.toLowerCase().includes(normalizedFilter);
    const lifetimeGiving = Number(donor.totalLifetimeGiving ?? 0);
    return matchesQuery && lifetimeGiving >= minValueFilter;
  });

  const filteredCampaigns = campaigns.filter((campaign) => {
    const matchesQuery = normalizedFilter.length === 0 || campaign.name.toLowerCase().includes(normalizedFilter);
    const matchesStatus =
      campaignStatusFilter === "all"
      || (campaignStatusFilter === "active" && campaign.active)
      || (campaignStatusFilter === "inactive" && !campaign.active);
    return matchesQuery && matchesStatus && campaign.raised >= minValueFilter;
  });

  const filteredEventsTopEvents = (eventsSummary?.topEvents ?? []).filter((event) => {
    const matchesQuery =
      normalizedFilter.length === 0
      || event.name.toLowerCase().includes(normalizedFilter)
      || event.type.toLowerCase().includes(normalizedFilter);
    return matchesQuery && event.revenue >= minValueFilter;
  });

  const filteredCompassionCasesByType = (compassionSummary?.casesByType ?? []).filter((row) => {
    if (normalizedFilter.length === 0) return true;
    return row.label.toLowerCase().includes(normalizedFilter);
  });

  const filteredCompassionCasesByStatus = (compassionSummary?.casesByStatus ?? []).filter((row) => {
    if (normalizedFilter.length === 0) return true;
    return row.label.toLowerCase().includes(normalizedFilter);
  });

  const filteredCompassionAppointments = (compassionSummary?.appointmentsByType ?? []).filter((row) => {
    if (normalizedFilter.length === 0) return true;
    return row.label.toLowerCase().includes(normalizedFilter);
  });

  /** Maximum payment amount (for scaling horizontal payment-method bars). */
  const maxPayment =
    paymentBreakdown.length > 0 ? Math.max(...paymentBreakdown.map((p) => p.amount)) : 1;
  const canPostShareviewNotes = user?.role === "admin";
  const canManageBlueprints = user?.role === "admin";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Page Header ── */}
      <div>
          <div className="mb-1 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            OShareview Live
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Reports &amp; Analytics Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            OShareview dashboard for donor, events, compassion, and OGentic reporting workflows
          </p>
          {summary?.freshness?.dataThrough && (
            <p className="text-xs text-gray-400 mt-1">
              Data freshness: through {fmtDate(summary.freshness.dataThrough)} at {new Date(summary.freshness.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}
          <p className="text-xs text-emerald-700 mt-1">
            Auto-refreshing every 45 seconds. Last update {lastLiveRefreshAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
          </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-gray-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs uppercase tracking-wide text-gray-500">Revenue Snapshot</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">${fmtCurrency((summary?.ytdAmount ?? 0) + (includeGrants ? (summary?.ytdGrantAmount ?? 0) : 0))}</p>
          <p className="text-xs text-emerald-700">{allYears ? "All years" : `Scoped to ${year}`}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs uppercase tracking-wide text-gray-500">Donor Retention</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{retention ? `${retention.rate}%` : "-"}</p>
          <p className="text-xs text-gray-500">Returning donor strength</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs uppercase tracking-wide text-gray-500">Open Follow-ups</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{summary?.pendingTasks?.toLocaleString() ?? "-"}</p>
          <p className="text-xs text-gray-500">Overdue: {summary?.overdueTasks?.toLocaleString() ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
          <p className="text-xs uppercase tracking-wide text-gray-500">Active Campaigns</p>
          <p className="mt-1 text-2xl font-semibold text-gray-900">{summary?.activeCampaigns?.toLocaleString() ?? "-"}</p>
          <p className="text-xs text-gray-500">Goal: ${fmtCurrency(summary?.activeGoalTotal ?? 0)}</p>
        </div>
      </div>

      {activeModule === "donor" && donorReportsError && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {donorReportsError}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div>

      {activeModule === "donor" ? (
        <>
          <p className="text-xs text-gray-500 -mt-3">
            {!allYears
              ? `Report totals are scoped to ${year}.`
              : "Report totals are scoped to all years. Retention and LYBUNT/SYBUNT remain year-based."}
          </p>

      {activeTool === "donor-donor-packet" && <DonorPacketReportTool />}

      {/* ══════════════════════════════════════════════════════════════════════
          OVERVIEW TAB
          ══════════════════════════════════════════════════════════════════════ */}
      {activeTool !== "donor-donor-packet" && activeTab === "overview" && (
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
                <h2 className="text-sm font-semibold text-gray-900">Top Donors</h2>
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
                    : filteredTopDonors.slice(0, 10).map((d) => (
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
                  {!loadingOverview && filteredTopDonors.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-6 text-center text-gray-400 text-sm">
                        No donor rows match current filters.
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
      {activeTool !== "donor-donor-packet" && activeTab === "donors" && (
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
                {loadingDonors ? "…" : filteredLybunt.length} donors
              </span>
            </div>
            <LybuntTable donors={filteredLybunt} loading={loadingDonors} />
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
                  {loadingDonors ? "…" : filteredSybunt.length} donors
                </span>
                <button
                  onClick={() => setShowSybunt((v) => !v)}
                  className="text-xs font-medium text-green-600 hover:text-green-700"
                >
                  {showSybunt ? "Hide" : "Show"} SYBUNT
                </button>
              </div>
            </div>
            {showSybunt && <LybuntTable donors={filteredSybunt} loading={loadingDonors} />}
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
      {activeTool !== "donor-donor-packet" && activeTab === "giving" && (
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
      {activeTool !== "donor-donor-packet" && activeTab === "campaigns" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Campaign Performance — {scopeLabel}</h2>
            <span className="text-xs text-gray-500">
              {loadingCampaigns
                ? "Loading…"
                  : `${filteredCampaigns.length} campaign${filteredCampaigns.length !== 1 ? "s" : ""}`}
            </span>
          </div>

          {loadingCampaigns ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Sk key={i} className="h-36 w-full" />
              ))}
            </div>
          ) : filteredCampaigns.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
              <p className="text-gray-400 text-sm">
                No campaigns match the current filter set.
              </p>
            </div>
          ) : (
            filteredCampaigns.map((c) => {
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
      {activeTool !== "donor-donor-packet" && activeTab === "retention" && (
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
                  {loadingDonors ? "…" : filteredLybunt.length}
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

          {/* Multi-year retention trend */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">Retention Trend (Multi-Year)</h3>
            <p className="text-xs text-gray-500 mb-4">
              Year-over-year donor retention rate based on donors who gave in consecutive years.
            </p>

            {loadingRetention ? (
              <Sk className="h-48 w-full" />
            ) : retentionTrend.filter((row) => row.total > 0).length >= 2 ? (
              <>
                <RetentionTrendChart data={retentionTrend} />
                <p className="mt-3 text-xs text-gray-500">
                  Showing {retentionTrend[0]?.year} to {retentionTrend[retentionTrend.length - 1]?.year}.
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-400 text-center py-8">
                Historical retention trend will appear here as multiple years of giving data are recorded.
              </p>
            )}
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

                  {(activeTool === "events-top-events" || activeTool === "events-revenue") && (
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
                          {filteredEventsTopEvents.slice(0, 8).map((event) => (
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

                  {activeTool === "events-revenue" && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                      <p className="text-xs font-semibold text-emerald-900">Revenue Concentration</p>
                      <p className="mt-1 text-xs text-emerald-800">
                        Top event share: {
                          filteredEventsTopEvents.length > 0 && eventsSummary.totalRevenue > 0
                            ? `${Math.round((filteredEventsTopEvents[0].revenue / eventsSummary.totalRevenue) * 100)}%`
                            : "0%"
                        } of visible revenue.
                      </p>
                    </div>
                  )}

                  {(activeTool === "events-attendance" || activeTool === "events-operations") && (
                    <div className="mt-3 space-y-2">
                      {filteredEventsTopEvents.slice(0, 6).map((event) => {
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
                          {filteredCompassionCasesByType.slice(0, 8).map((row) => (
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
                          {filteredCompassionCasesByStatus.slice(0, 8).map((row) => (
                            <div key={`status-${row.label}`} className="flex justify-between">
                              <span>{row.label}</span>
                              <span className="font-medium">{row.value}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {(activeTool === "compassion-appointments" || activeTool === "compassion-intake" || activeTool === "compassion-outcomes") && (
                    <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
                      <p className="text-xs font-semibold text-gray-800">Appointments by Type</p>
                      <div className="mt-2 space-y-1.5 text-xs text-gray-600">
                        {filteredCompassionAppointments.slice(0, 10).map((row) => (
                          <div key={`appt-${row.label}`} className="flex justify-between">
                            <span>{row.label}</span>
                            <span className="font-medium">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTool === "compassion-intake" && (
                    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2.5 text-xs text-blue-900">
                      New clients this month: {compassionSummary.kpis.newClientsThisMonth.toLocaleString()} | Appointments this month: {compassionSummary.kpis.appointmentsThisMonth.toLocaleString()}
                    </div>
                  )}

                  {activeTool === "compassion-outcomes" && (
                    <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-xs text-emerald-900">
                      Completed appointments this month: {compassionSummary.kpis.completedAppointmentsThisMonth.toLocaleString()} | Completion rate: {Math.round(compassionSummary.kpis.completionRate)}%
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

              {activeTool === "ogentic-sources" && (
                <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5 text-sm text-gray-700">
                  Source-mix diagnostics are staged here for AI-generated drafts, analyses, and report artifact workflows.
                </div>
              )}
            </section>
          )}

          {activeModule === "admin" && (
            <OShareviewAdminWorkspace
              year={year}
              allYears={allYears}
              tool={activeTool}
              filterText={recordFilterText}
              minAmount={minValueFilter}
              canViewAdmin={user?.role === "admin"}
            />
          )}
        </div>
      )}
      </div>
      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
        <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">Reports &amp; Analytics</h2>
          <p className="mt-0.5 text-xs text-gray-500">
            OyamaREPORTIT CRM for donor, events, compassion, and OGentic reporting workflows
          </p>
          {summary?.freshness?.dataThrough && (
            <p className="mt-2 text-xs text-gray-500">
              Data freshness: through {fmtDate(summary.freshness.dataThrough)} at {new Date(summary.freshness.generatedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
            </p>
          )}

          <div className="mt-4 space-y-3 border-t border-gray-100 pt-3">
            <button
              onClick={toggleGrants}
              title={includeGrants ? "Grants included in revenue totals - click to exclude" : "Click to include awarded grants in revenue totals"}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                includeGrants
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-gray-50 border-gray-200 text-gray-600 hover:text-gray-700"
              }`}
            >
              <span>Incl. Grants</span>
              <span className={`relative h-3.5 w-7 rounded-full transition-colors ${includeGrants ? "bg-emerald-400" : "bg-gray-300"}`}>
                <span className={`absolute top-0.5 h-2.5 w-2.5 rounded-full bg-white shadow transition-all ${includeGrants ? "left-4" : "left-0.5"}`} />
              </span>
            </button>

            <select
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10))}
              disabled={allYears}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
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

            <input
              value={recordFilterText}
              onChange={(eventInput) => setRecordFilterText(eventInput.target.value)}
              placeholder="Filter records by name, status, or type"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <input
              type="number"
              min={0}
              value={Number.isFinite(minValueFilter) ? minValueFilter : 0}
              onChange={(eventInput) => setMinValueFilter(Math.max(0, Number(eventInput.target.value || 0)))}
              placeholder="Minimum value"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            />

            <select
              value={campaignStatusFilter}
              onChange={(eventInput) => setCampaignStatusFilter(eventInput.target.value as "all" | "active" | "inactive")}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="all">Campaigns: All</option>
              <option value="active">Campaigns: Active only</option>
              <option value="inactive">Campaigns: Inactive only</option>
            </select>

            <button
              onClick={handleExport}
              className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
            >
              ↓ Export CSV
            </button>
            <button
              onClick={handleServerExport}
              className="w-full rounded-md border border-green-200 bg-white px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-50 transition-colors"
            >
              Download Server CSV
            </button>
            <button
              onClick={handlePrintCurrentReport}
              className="w-full rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Generate PDF Packet
            </button>
          </div>

          <div className="mt-4">
            <ReportsModuleToolbar
              activeModule={activeModule}
              activeTool={activeTool}
              onModuleChange={handleModuleChange}
              onToolChange={handleToolChange}
            />
          </div>

          {activeModule === "donor" && (
            <div className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-2">
              <p className="px-1 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">Tabs</p>
              <div className="grid grid-cols-1 gap-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`rounded-md border px-2 py-1.5 text-left text-xs font-medium transition-colors ${
                      activeTab === tab.id
                        ? "border-green-600 bg-white text-green-700"
                        : "border-transparent bg-white/70 text-gray-600 hover:border-gray-200 hover:text-gray-800"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </aside>

        <OShareviewNotesPanel canPost={canPostShareviewNotes} />
        <OShareviewBlueprintsPanel
          canManage={canManageBlueprints}
          currentConfig={{
            module: activeModule,
            tool: activeTool,
            tab: activeTab as ReportTabId,
            year,
            allYears,
            includeGrants,
          }}
          onApply={handleApplyBlueprint}
        />
        <OShareviewCoveragePanel />
      </div>
      </div>
    </div>
  );
}
