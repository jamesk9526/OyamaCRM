export type ReportKey =
  | "batch-receipts"
  | "tax-deductible-giving"
  | "unacknowledged-gifts"
  | "donations"
  | "donations-by-designation"
  | "lifetime-giving"
  | "monthly-giving"
  | "comprehensive-donor-analysis"
  | "donor-files"
  | "giving-capacity-interest"
  | "donor-follow-up"
  | "donor-notes"
  | "first-time-donors"
  | "lapsed-donors"
  | "lapsed-donor-history"
  | "never-given"
  | "top-donors"
  | "payment-method-summary"
  | "designation-performance"
  | "crm-performance-scorecard"
  | "recurring-giving"
  | "campaign-performance";

export interface ReportDefinition {
  key: ReportKey;
  title: string;
  description: string;
  source: string;
  capabilities: string;
  scope: "date" | "year" | "calendar-year" | "lapse" | "none";
  group: "Gift reports" | "Donor reports";
  supportsPayment?: boolean;
  supportsDesignation?: boolean;
  supportsLimit?: boolean;
  defaultRange?: "month-to-date";
}


export const REPORTS: ReportDefinition[] = [
  { key: "batch-receipts", title: "Batch Receipts", description: "Review a receipt-ready register grouped by donor before creating receipt communications.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "tax-deductible-giving", title: "Annual Donation Statements", description: "Review each constituent's calendar-year donations and tax-deductible total, then print individual or selected statements.", source: "Completed donations", capabilities: "Grid, CSV, Statements", scope: "calendar-year", group: "Gift reports" },
  { key: "unacknowledged-gifts", title: "Unacknowledged Gifts", description: "Find completed gifts that still need a recorded thank-you, then review the donor before starting a letter or email.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "donations", title: "Donations", description: "Print or export a detailed list of completed gifts in a selected date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "donations-by-designation", title: "Donations by Designation", description: "See completed giving grouped by donor and designation.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true, defaultRange: "month-to-date" },
  { key: "lifetime-giving", title: "Lifetime Giving Report", description: "See every giving donor’s lifetime total, first, last, and largest completed gift.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "none", group: "Gift reports" },
  { key: "monthly-giving", title: "Monthly Giving Report", description: "Summarize donor giving for a month or any chosen date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Gift reports", defaultRange: "month-to-date" },
  { key: "comprehensive-donor-analysis", title: "Comprehensive Donor Analysis", description: "Compare active, new, and repeat donor giving across three reporting years.", source: "Completed donations + first-gift dates", capabilities: "Grid, CSV, Print", scope: "year", group: "Donor reports" },
  { key: "donor-files", title: "Donor Files", description: "A contact and mailing-preference directory for current donor files.", source: "Donor files", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "giving-capacity-interest", title: "Donor Files by Giving Capacity and Interest", description: "Review donor tags alongside lifetime giving. Capacity is shown only when stored as a tag.", source: "Donor tags + completed donations", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "donor-follow-up", title: "Donor Follow-up", description: "Open follow-up tasks tied to donor records, ordered for staff review.", source: "Tasks", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "donor-notes", title: "Donor Notes", description: "A report of profile notes recorded on donor files.", source: "Donor files", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "first-time-donors", title: "First Time Donors", description: "Find donors whose first completed gift falls in the selected date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Donor reports" },
  { key: "lapsed-donors", title: "Lapsed Donors (SYBUNTY)", description: "Find donors who gave in the prior year but not in the selected year.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "year", group: "Donor reports" },
  { key: "lapsed-donor-history", title: "Lapsed Donor History", description: "Find all stored lapsed donors, donors whose last gift falls in a selected year range, or donors who have not given since a selected year.", source: "All completed donation history + donor files", capabilities: "Grid, CSV, Print, Outreach, Audience list", scope: "lapse", group: "Donor reports" },
  { key: "never-given", title: "Never Given Report", description: "List donor files with no completed donation record.", source: "Donor files + completed donations", capabilities: "Grid, CSV, Print", scope: "none", group: "Donor reports" },
  { key: "top-donors", title: "Top Donors", description: "Rank donors by completed giving within a selected date range.", source: "Completed donations", capabilities: "Grid, CSV, Print", scope: "date", group: "Donor reports", supportsLimit: true },
  { key: "payment-method-summary", title: "Payment Method Summary", description: "Compare gift volume, donor count, and giving by payment method.", source: "Completed donations", capabilities: "Grid, Visual, CSV, Print", scope: "date", group: "Gift reports" },
  { key: "designation-performance", title: "Designation Performance", description: "Compare giving across funds and designations, including donor reach.", source: "Completed donations", capabilities: "Grid, Visual, CSV, Print", scope: "date", group: "Gift reports" },
  { key: "crm-performance-scorecard", title: "CRM Performance Scorecard", description: "Compare growth, donor reach, gift activity, and recurring giving to the prior equal period.", source: "Completed donations", capabilities: "Grid, Visual, Insights", scope: "date", group: "Donor reports" },
  { key: "recurring-giving", title: "Recurring Giving", description: "Review recurring gifts and the donors sustaining recurring revenue in a selected period.", source: "Completed donations", capabilities: "Grid, Visual, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
  { key: "campaign-performance", title: "Campaign Performance", description: "Rank campaign-attributed giving by revenue, gifts, and donor reach.", source: "Completed donations + campaigns", capabilities: "Grid, Visual, CSV, Print", scope: "date", group: "Gift reports", supportsPayment: true, supportsDesignation: true },
];
