// Live data adapter for Oyama Reports. It never fabricates report rows.

import { apiFetch } from "@/app/lib/auth-client";
import type {
  ChartPoint,
  ReportDefinition,
  ReportFilters,
  ReportKpis,
  ReportRunResult,
  ReportTableRow,
} from "@/app/components/reports-app/report-types";

export const DEFAULT_REPORT_FILTERS: ReportFilters = {
  dateFrom: "2026-01-01",
  dateTo: "2026-05-26",
  amountMin: 0,
  amountMax: 9999999,
  donorType: "All",
  designation: "All",
  campaign: "All",
  event: "All",
  paymentType: "All",
  recurringStatus: "All",
  givingCapacity: "All",
  organization: "All",
  household: "All",
  donorTags: "",
  followUpStatus: "All",
};

interface DonationsListResponse {
  items: Array<Record<string, unknown>>;
  total: number;
}

function toNumber(value: unknown): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function shortDate(value: unknown): string {
  if (!value) return "";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toISOString().slice(0, 10);
}

function labelMonth(value: unknown): string {
  const month = Number(value);
  if (!Number.isFinite(month) || month < 1 || month > 12) return String(value ?? "");
  return new Date(2026, month - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

function appendFilters(path: string, filters: ReportFilters, limit = 500): string {
  const params = new URLSearchParams();
  params.set("limit", String(limit));
  if (filters.dateFrom) params.set("fromDate", filters.dateFrom);
  if (filters.dateTo) params.set("toDate", filters.dateTo);
  const query = params.toString();
  return query ? `${path}${path.includes("?") ? "&" : "?"}${query}` : path;
}

function appendDonationFilters(path: string, filters: ReportFilters): string {
  const params = new URLSearchParams();
  params.set("limit", "500");
  params.set("status", "COMPLETED");
  if (filters.dateFrom) params.set("from", filters.dateFrom);
  if (filters.dateTo) params.set("to", filters.dateTo);
  const query = params.toString();
  return `${path}?${query}`;
}

function rowMatchesUiFilters(row: ReportTableRow, filters: ReportFilters): boolean {
  const amount = toNumber(row.Amount ?? row.Raised ?? row.Total ?? row.Value);
  if (amount < filters.amountMin || amount > filters.amountMax) return false;
  if (filters.paymentType !== "All" && row["Payment Type"] !== filters.paymentType) return false;
  if (filters.designation !== "All" && row.Designation !== filters.designation) return false;
  if (filters.campaign !== "All" && row.Campaign !== filters.campaign) return false;
  if (filters.donorType !== "All" && row["Donor Type"] !== filters.donorType) return false;
  return true;
}

function normalizeDonationRows(items: Array<Record<string, unknown>>): ReportTableRow[] {
  return items.map((item, index) => {
    const constituent = asRecord(item.constituent);
    const campaign = asRecord(item.campaign);
    const designation = asRecord(item.designation);
    const donorName = [constituent.firstName, constituent.lastName].filter(Boolean).join(" ").trim() || "Unknown constituent";
    return {
      "File ID": String(item.id ?? index + 1).slice(0, 8),
      "Donor Name": donorName,
      Amount: toNumber(item.amount),
      Date: shortDate(item.date),
      "Payment Type": String(item.paymentMethod ?? "Unspecified"),
      Designation: String(designation.name ?? "General Fund"),
      Campaign: String(campaign.name ?? "Unassigned"),
      "Donor Type": "Constituent",
      Status: String(item.status ?? "COMPLETED"),
    };
  });
}

function normalizeRowsFromEndpoint(reportId: string, payload: unknown): ReportTableRow[] {
  if (Array.isArray(payload)) {
    return payload.map((entry, index): ReportTableRow => {
      const row = asRecord(entry);
      if ("month" in row && ("amount" in row || "thisYear" in row || "newCount" in row)) {
        return {
          Month: labelMonth(row.month),
          Amount: "amount" in row ? toNumber(row.amount) : null,
          "This Year": "thisYear" in row ? toNumber(row.thisYear) : null,
          "Last Year": "lastYear" in row ? toNumber(row.lastYear) : null,
          "New Donors": "newCount" in row ? toNumber(row.newCount) : null,
          "Returning Donors": "returningCount" in row ? toNumber(row.returningCount) : null,
        };
      }
      if ("firstName" in row || "lastName" in row) {
        return {
          Rank: index + 1,
          "Donor Name": [row.firstName, row.lastName].filter(Boolean).join(" ").trim(),
          Email: typeof row.email === "string" ? row.email : null,
          "Lifetime Giving": toNumber(row.totalLifetimeGiving),
          "Last Gift": shortDate(row.lastGiftDate),
          Status: typeof row.donorStatus === "string" ? row.donorStatus : null,
        };
      }
      if ("paymentMethod" in row) {
        return {
          "Payment Type": String(row.paymentMethod ?? "Unspecified"),
          Count: toNumber(row.count),
          Amount: toNumber(row.amount),
        };
      }
      if ("name" in row && ("raised" in row || "giftCount" in row)) {
        return {
          Campaign: String(row.name ?? "Campaign"),
          Raised: toNumber(row.raised),
          Goal: row.goal === null ? null : toNumber(row.goal),
          Gifts: toNumber(row.giftCount),
          Donors: toNumber(row.uniqueDonors),
          "Average Gift": toNumber(row.avgGift),
        };
      }
      return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "object" ? JSON.stringify(value) : String(value ?? "")]));
    });
  }

  const objectPayload = asRecord(payload);
  if (reportId === "board-summary" && objectPayload.summary) {
    const summary = asRecord(objectPayload.summary);
    return Object.entries(summary).map(([key, value]) => ({
      Metric: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
      Value: toNumber(value),
    }));
  }

  return Object.entries(objectPayload)
    .filter(([, value]) => typeof value !== "object" || value === null)
    .map(([key, value]) => ({
      Metric: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()),
      Value: typeof value === "number" ? value : String(value ?? ""),
    }));
}

function computeKpis(rows: ReportTableRow[]): ReportKpis {
  const amounts = rows
    .map((row) => toNumber(row.Amount ?? row.Raised ?? row["Lifetime Giving"] ?? row.Value))
    .filter((value) => value > 0);
  const donorNames = new Set(rows.map((row) => String(row["Donor Name"] ?? row.Campaign ?? row.Metric ?? "")).filter(Boolean));
  const totalDonations = amounts.reduce((sum, value) => sum + value, 0);
  return {
    totalDonations,
    donorCount: donorNames.size,
    averageGift: amounts.length > 0 ? totalDonations / amounts.length : 0,
    largestGift: amounts.length > 0 ? Math.max(...amounts) : 0,
    transactions: rows.length,
    retentionRate: 0,
    firstTimeDonors: rows.filter((row) => toNumber(row["New Donors"]) > 0).reduce((sum, row) => sum + toNumber(row["New Donors"]), 0),
    lapsedDonors: rows.filter((row) => String(row.Status ?? "").toUpperCase().includes("LAPSED")).length,
    recurringDonors: rows.filter((row) => String(row["Payment Type"] ?? "").toUpperCase() === "ACH").length,
  };
}

function groupSum(rows: ReportTableRow[], labelKey: string, valueKey = "Amount"): ChartPoint[] {
  const grouped = new Map<string, { value: number; count: number }>();
  rows.forEach((row) => {
    const label = String(row[labelKey] ?? "Unassigned");
    const current = grouped.get(label) ?? { value: 0, count: 0 };
    current.value += toNumber(row[valueKey] ?? row.Raised ?? row.Value);
    current.count += 1;
    grouped.set(label, current);
  });
  return Array.from(grouped.entries())
    .map(([label, value]) => ({ label, value: Math.round(value.value * 100) / 100, count: value.count }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 8);
}

function trendFromRows(rows: ReportTableRow[]): ChartPoint[] {
  const dateRows = rows.filter((row) => row.Date);
  if (dateRows.length > 0) {
    return groupSum(dateRows, "Date").sort((left, right) => left.label.localeCompare(right.label));
  }
  if (rows.some((row) => row.Month)) {
    return rows.map((row) => ({
      label: String(row.Month),
      value: toNumber(row.Amount ?? row["This Year"] ?? row.Value),
      secondaryValue: row["Last Year"] === null ? undefined : toNumber(row["Last Year"]),
    }));
  }
  return rows.slice(0, 8).map((row, index) => ({
    label: String(row["Donor Name"] ?? row.Campaign ?? row.Metric ?? `Row ${index + 1}`),
    value: toNumber(row.Amount ?? row.Raised ?? row.Value ?? row["Lifetime Giving"]),
  }));
}

function buildResult(report: ReportDefinition, rows: ReportTableRow[]): ReportRunResult {
  return {
    report,
    rows,
    kpis: computeKpis(rows),
    trend: trendFromRows(rows),
    designationBreakdown: groupSum(rows, "Designation"),
    paymentBreakdown: groupSum(rows, "Payment Type"),
    campaignBreakdown: groupSum(rows, "Campaign", rows.some((row) => row.Raised !== undefined) ? "Raised" : "Amount"),
    yearComparison: rows.filter((row) => row.Month).map((row) => ({
      label: String(row.Month),
      value: toNumber(row["This Year"] ?? row.Amount),
      secondaryValue: toNumber(row["Last Year"]),
    })),
    generatedAt: new Date().toISOString(),
  };
}

/** Runs one report against live API data and returns normalized rows plus chart slices. */
export async function runLiveReport(report: ReportDefinition, filters: ReportFilters): Promise<ReportRunResult> {
  if (report.status === "Coming Soon" || !report.endpoint) {
    return buildResult(report, []);
  }

  if (report.id === "donations-detail" || report.id === "receipts-needed" || report.id === "event-gala-donors") {
    const data = await apiFetch<DonationsListResponse>(appendDonationFilters("/api/donations", filters));
    const rows = normalizeDonationRows(Array.isArray(data.items) ? data.items : []).filter((row) => rowMatchesUiFilters(row, filters));
    return buildResult(report, rows);
  }

  const payload = await apiFetch<unknown>(appendFilters(report.endpoint, filters, 500));
  const rows = normalizeRowsFromEndpoint(report.id, payload).filter((row) => rowMatchesUiFilters(row, filters));
  return buildResult(report, rows);
}

export function getUniqueFilterOptions(rows: ReportTableRow[], key: string): string[] {
  return ["All", ...Array.from(new Set(rows.map((row) => String(row[key] ?? "")).filter(Boolean))).sort()];
}

export function exportRowsToCsv(rows: ReportTableRow[], filename: string): void {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csvRows = rows.map((row) =>
    headers
      .map((header) => {
        const raw = String(row[header] ?? "");
        return raw.includes(",") || raw.includes("\"") || raw.includes("\n") ? `"${raw.replace(/"/g, '""')}"` : raw;
      })
      .join(","),
  );
  const blob = new Blob([[headers.join(","), ...csvRows].join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
