// Shared schema for the Oyama Reports app registry, filters, and generated rows.

export type ReportStatus = "Working" | "Partial" | "Coming Soon";

export type ReportCategoryId =
  | "all"
  | "donations"
  | "donor-reports"
  | "giving-trends"
  | "receipts-letters"
  | "campaigns"
  | "events"
  | "follow-up"
  | "monthly-giving"
  | "lapsed-donors"
  | "top-donors"
  | "first-time-donors"
  | "households-orgs"
  | "custom-reports";

export type ReportOutputType = "Dashboard" | "Data Grid" | "CSV" | "PDF" | "Letter List" | "Labels" | "Board Summary";

export type ReportSourceModule = "Donor CRM" | "Events CRM" | "Communications" | "Letters" | "Cross-module";

export type ReportChartType = "line" | "bar" | "donut" | "stacked-bar" | "none";

export interface ReportCategory {
  id: ReportCategoryId;
  label: string;
  description: string;
}

export interface ReportDefinition {
  id: string;
  title: string;
  purpose: string;
  categoryId: ReportCategoryId;
  sourceModule: ReportSourceModule;
  outputs: ReportOutputType[];
  status: ReportStatus;
  lastRun: string;
  primaryChart: ReportChartType;
  quickFilters: string[];
  endpoint?: string;
}

export interface ReportFilters {
  dateFrom: string;
  dateTo: string;
  amountMin: number;
  amountMax: number;
  donorType: string;
  designation: string;
  campaign: string;
  event: string;
  paymentType: string;
  recurringStatus: string;
  givingCapacity: string;
  organization: string;
  household: string;
  donorTags: string;
  followUpStatus: string;
}

export interface DonationReportRow {
  id: string;
  fileId: string;
  donorName: string;
  donorType: string;
  amount: number;
  date: string;
  paymentType: string;
  designation: string;
  campaign: string;
  event: string;
  church: string;
  household: string;
  organization: string;
  city: string;
  state: string;
  recurring: boolean;
  firstTimeDonor: boolean;
  lapsedDonor: boolean;
  followUpStatus: "Open" | "Completed" | "Overdue" | "Not Needed";
  givingCapacity: "Emerging" | "Mid-Level" | "Major Gift" | "Unknown";
  donorTags: string[];
}

export type ReportTableRow = Record<string, string | number | boolean | null>;

export interface ReportKpis {
  totalDonations: number;
  donorCount: number;
  averageGift: number;
  largestGift: number;
  transactions: number;
  retentionRate: number;
  firstTimeDonors: number;
  lapsedDonors: number;
  recurringDonors: number;
}

export interface ChartPoint {
  label: string;
  value: number;
  secondaryValue?: number;
  count?: number;
}

export interface ReportRunResult {
  report: ReportDefinition;
  rows: ReportTableRow[];
  kpis: ReportKpis;
  trend: ChartPoint[];
  designationBreakdown: ChartPoint[];
  paymentBreakdown: ChartPoint[];
  campaignBreakdown: ChartPoint[];
  yearComparison: ChartPoint[];
  generatedAt: string;
}

export interface SavedReportView {
  id: string;
  name: string;
  reportId: string;
  createdAt: string;
  filters: ReportFilters;
}

export interface BuilderDraft {
  dataSource: string;
  fields: string[];
  filters: string[];
  grouping: string;
  sorting: string;
  chartType: ReportChartType;
  exportFormat: "CSV" | "PDF" | "Board Summary";
}
