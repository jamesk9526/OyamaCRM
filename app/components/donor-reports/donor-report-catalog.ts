// Donor report catalog definitions for the DonorCRM reporting workspace.

export type DonorReportCategory =
  | "Donor Intelligence"
  | "Giving"
  | "Retention"
  | "Campaigns & Funds"
  | "Stewardship"
  | "Commitments";

export interface DonorReportDefinition {
  id: string;
  title: string;
  category: DonorReportCategory;
  description: string;
  recommendedUse: string;
  inputs: string[];
  outputs: string[];
}

export const DONOR_REPORT_CATEGORIES: DonorReportCategory[] = [
  "Donor Intelligence",
  "Giving",
  "Retention",
  "Campaigns & Funds",
  "Stewardship",
  "Commitments",
];

export const DONOR_REPORTS: DonorReportDefinition[] = [
  {
    id: "donor-summary",
    title: "Donor Summary Report",
    category: "Donor Intelligence",
    description: "Profile-level rollup of giving, status, engagement, and next stewardship action.",
    recommendedUse: "Board packets, gift officer prep, and constituent review meetings.",
    inputs: ["Donor segment", "Status", "Assigned owner"],
    outputs: ["Profile PDF", "CSV", "Board summary"],
  },
  {
    id: "donation-history",
    title: "Donation History Report",
    category: "Giving",
    description: "Gift-by-gift history with dates, amounts, campaign, designation, payment method, and receipt state.",
    recommendedUse: "Donor service requests, reconciliation review, and stewardship context.",
    inputs: ["Date range", "Constituent", "Payment method"],
    outputs: ["Detail CSV", "PDF ledger"],
  },
  {
    id: "year-to-date-giving",
    title: "Year-to-Date Giving Report",
    category: "Giving",
    description: "Current fiscal-year giving totals with goal progress and prior-year comparison.",
    recommendedUse: "Weekly leadership review and fundraising progress checks.",
    inputs: ["Fiscal year", "Campaign", "Designation"],
    outputs: ["Executive PDF", "Excel"],
  },
  {
    id: "monthly-giving",
    title: "Monthly Giving Report",
    category: "Giving",
    description: "Month-by-month giving trend with gift count, average gift, and variance.",
    recommendedUse: "Cash-flow planning and seasonal fundraising analysis.",
    inputs: ["Year", "Campaign", "Gift type"],
    outputs: ["Trend CSV", "Chart PDF"],
  },
  {
    id: "donor-retention",
    title: "Donor Retention Report",
    category: "Retention",
    description: "Retained, renewed, upgraded, downgraded, and lost donor cohorts year over year.",
    recommendedUse: "Retention planning and stewardship program measurement.",
    inputs: ["Comparison year", "Donor segment", "Gift threshold"],
    outputs: ["Cohort CSV", "Retention PDF"],
  },
  {
    id: "lapsed-donor",
    title: "Lapsed Donor Report",
    category: "Retention",
    description: "Constituents who gave previously but have not renewed in the selected window.",
    recommendedUse: "Reactivation campaigns and personal outreach lists.",
    inputs: ["Lapse window", "Last gift range", "Assigned owner"],
    outputs: ["Call list", "Mail merge CSV"],
  },
  {
    id: "new-donor",
    title: "New Donor Report",
    category: "Retention",
    description: "First-time donors by date range with source, first gift, and welcome status.",
    recommendedUse: "Welcome series monitoring and acquisition channel review.",
    inputs: ["Date range", "Source", "Campaign"],
    outputs: ["CSV", "Welcome list"],
  },
  {
    id: "major-donor",
    title: "Major Donor Report",
    category: "Donor Intelligence",
    description: "Major gift donors and prospects with giving capacity, recent touchpoints, and next ask readiness.",
    recommendedUse: "Major gifts portfolio planning and leadership briefings.",
    inputs: ["Major gift threshold", "Owner", "Engagement score"],
    outputs: ["Portfolio PDF", "CSV"],
  },
  {
    id: "recurring-donor",
    title: "Recurring Donor Report",
    category: "Giving",
    description: "Recurring gift plans, active status, cadence, projected annual value, and payment health.",
    recommendedUse: "Monthly giving program management and failed payment follow-up.",
    inputs: ["Plan status", "Cadence", "Failure state"],
    outputs: ["Program CSV", "Follow-up list"],
  },
  {
    id: "campaign-performance",
    title: "Campaign Performance Report",
    category: "Campaigns & Funds",
    description: "Campaign goal progress, revenue, donors, average gift, conversion, and channel performance.",
    recommendedUse: "Campaign check-ins, post-campaign review, and board updates.",
    inputs: ["Campaign", "Date range", "Channel"],
    outputs: ["Campaign PDF", "Excel"],
  },
  {
    id: "appeal-performance",
    title: "Appeal Performance Report",
    category: "Campaigns & Funds",
    description: "Appeal response, gifts, revenue, cost, ROI, and donor segments touched.",
    recommendedUse: "Direct mail, email appeal, and annual fund performance review.",
    inputs: ["Appeal", "Audience", "Channel"],
    outputs: ["Appeal PDF", "CSV"],
  },
  {
    id: "designation-fund",
    title: "Designation/Fund Report",
    category: "Campaigns & Funds",
    description: "Giving by fund or designation with restrictions, totals, donor count, and trend.",
    recommendedUse: "Finance review, restricted fund stewardship, and program reporting.",
    inputs: ["Designation", "Date range", "Restriction type"],
    outputs: ["Finance CSV", "Fund PDF"],
  },
  {
    id: "top-donors",
    title: "Top Donors Report",
    category: "Donor Intelligence",
    description: "Ranked donors by giving amount, lifetime value, last gift date, and donor tier.",
    recommendedUse: "Leadership review and recognition planning.",
    inputs: ["Rank limit", "Date range", "Giving basis"],
    outputs: ["Ranked CSV", "PDF"],
  },
  {
    id: "first-time-donor",
    title: "First-Time Donor Report",
    category: "Retention",
    description: "First gifts and acquisition source with acknowledgement and welcome workflow state.",
    recommendedUse: "First-gift stewardship and acquisition quality checks.",
    inputs: ["Date range", "Campaign", "Acknowledgement status"],
    outputs: ["Welcome CSV", "Stewardship list"],
  },
  {
    id: "donor-engagement",
    title: "Donor Engagement Report",
    category: "Donor Intelligence",
    description: "Engagement score, touchpoints, event activity, tasks, and communication response by donor.",
    recommendedUse: "Relationship health review and portfolio prioritization.",
    inputs: ["Score range", "Activity window", "Owner"],
    outputs: ["Engagement CSV", "Portfolio PDF"],
  },
  {
    id: "stewardship-follow-up",
    title: "Stewardship Follow-Up Report",
    category: "Stewardship",
    description: "Open, overdue, and completed follow-up tasks connected to donors and donations.",
    recommendedUse: "Daily stewardship standups and gift officer accountability.",
    inputs: ["Due date", "Owner", "Priority"],
    outputs: ["Task CSV", "Follow-up queue"],
  },
  {
    id: "thank-you-letter-status",
    title: "Thank-You Letter Status Report",
    category: "Stewardship",
    description: "Acknowledgement status by gift with generated, printed, mailed, and completed states.",
    recommendedUse: "Receipt and acknowledgement compliance review.",
    inputs: ["Gift date", "Letter status", "Gift amount"],
    outputs: ["Mail merge CSV", "Status PDF"],
  },
  {
    id: "communication-history",
    title: "Communication History Report",
    category: "Stewardship",
    description: "Email, letter, call, meeting, and campaign touchpoints by donor or segment.",
    recommendedUse: "Donor service, audit review, and relationship planning.",
    inputs: ["Date range", "Channel", "Constituent"],
    outputs: ["Timeline PDF", "CSV"],
  },
  {
    id: "pledge",
    title: "Pledge Report",
    category: "Commitments",
    description: "Open pledges, paid amounts, remaining balances, schedule, and overdue installments.",
    recommendedUse: "Pledge collection and revenue forecasting.",
    inputs: ["Pledge status", "Due window", "Campaign"],
    outputs: ["Pledge CSV", "Forecast PDF"],
  },
  {
    id: "grant-tracking",
    title: "Grant Tracking Report",
    category: "Commitments",
    description: "Grant pipeline, deadlines, awarded amounts, reports due, and funder follow-up state.",
    recommendedUse: "Grant management, compliance calendar, and award forecasting.",
    inputs: ["Grant status", "Deadline window", "Funder"],
    outputs: ["Grant CSV", "Compliance PDF"],
  },
];
