/** Model-readable definitions accompany financial results, not just an instruction prompt. */
import type { DonorLibraryReport } from "../services/donor-report-library.js";
import { centsToMoney, moneyToCents } from "../lib/money.js";
export function scorecardComparison(result: DonorLibraryReport, from: Date, through: Date) {
  const priorThrough = new Date(from.getTime() - 1);
  const priorFrom = new Date(priorThrough.getTime() - Math.max(86400000, through.getTime() - from.getTime() + 1) + 1);
  return {
    basis: "PREVIOUS_EQUAL_DURATION", from: priorFrom.toISOString(), through: priorThrough.toISOString(),
    metrics: (result.comparisonMatrix?.sections || []).flatMap(section => section.rows.map(row => {
      const current = row.type === "currency" ? moneyToCents(row.current) : row.current;
      const prior = row.type === "currency" ? moneyToCents(row.prior) : row.prior;
      return { label: row.label, type: row.type, current: row.current, prior: row.prior, difference: row.type === "currency" ? centsToMoney(current - prior) : current - prior, changePercent: prior ? Math.round(((current - prior) / prior) * 1000) / 10 : null };
    })),
  };
}
export const REPORT_DEFINITIONS = {
  "payment-method-summary": "Completed donation amounts grouped by recorded payment method. Share of giving is group amount / all included amounts × 100, rounded to one decimal place. This is not processor settlement or fee reconciliation.",
  "designation-performance": "Completed donation amounts grouped by designation. A designation alone does not establish a legal restriction or remaining fund balance.",
  "campaign-performance": "Completed donation amounts attributed to recorded campaigns, including an unattributed group. Does not calculate campaign costs, return on investment or progress against pledges.",
  "crm-performance-scorecard": "Current completed giving, gift count, unique donors and recurring gift count compared with the immediately preceding period of equal duration. Change = current − prior; percent = change / prior × 100. A zero prior value yields null percent, not infinity or 100%. Performance score = number of increasing metrics / four × 100. It is an operational indicator, not a financial health rating or year-over-year comparison.",
};
export function reportingContext(settings: { currency: string; timezone: string; fiscalYearStart: number } | null) {
  return {
    source: "OyamaCRM donor report library and canonical completedDonationWhere filter",
    currency: settings?.currency || "USD", currencyUnits: "Major currency units, not cents; addition is performed in integer cents and returned to two decimal places. No foreign-exchange conversion is performed.",
    organizationTimezone: settings?.timezone || "America/Chicago", serverCalendarTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    fiscalYearStartMonth: settings?.fiscalYearStart || 1,
    fiscalYearLabel: "For a non-January fiscal start, the year is the year in which the fiscal period ends.",
    dates: "Explicit YYYY-MM-DD inputs use inclusive UTC calendar days in the existing report library. Whole calendar/fiscal years use the server calendar timezone. Exact ISO boundaries are returned with every report; cite them when a cutoff matters.",
    inclusion: "Only donation records with status COMPLETED, scoped through their constituent organization and filtered by recorded donation date. Other donation statuses and unreceived pledges are excluded. Recorded IN_KIND gifts and signed amounts are included when COMPLETED. This is not cash-only reporting.",
    interpretation: [
      "Recorded giving does not establish bank cash, deposits, processor settlements, net receipts after fees/refunds, available funds, or general-ledger revenue recognition.",
      "Donation amount is not automatically the tax-deductible portion. Use the dedicated receipt/statement workflow for deductible giving.",
      "Donor counts are distinct within a group. A donor may appear in multiple groups, so do not sum group donor counts as a unique total.",
      "Percentages use the stated denominator; totals use all included records even when the displayed group rows are truncated.",
      "Live reads are not a frozen accounting close. Concurrent CRM changes may affect report comparisons. These reports are not audited financial statements.",
      "Show the report name, currency, exact period, comparison basis, notices and truncation. Do not substitute guesses for missing data or infer expenses, liabilities, restrictions or bank balances from giving totals.",
    ],
    reports: REPORT_DEFINITIONS,
  };
}
