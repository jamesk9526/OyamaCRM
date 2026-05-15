// Shared Steward structured response contracts for donor/report artifact rendering.

export interface StewardSuggestedAction {
  label: string;
  actionType: string;
  requiresConfirmation?: boolean;
  payload?: Record<string, unknown>;
}

export interface StewardEvidenceItem {
  label: string;
  detail?: string;
}

interface StewardArtifactBase {
  type: string;
  title?: string;
  description?: string;
}

export interface StewardEmailDraftArtifact extends StewardArtifactBase {
  type: "email_draft";
  subject: string;
  body?: string;
  previewText?: string;
  bodyMarkdown?: string;
  bodyPlainText?: string;
  bodyHtml?: string;
  audience?: string;
  warnings?: string[];
}

export interface StewardDonorListArtifact extends StewardArtifactBase {
  type: "donor_list";
  columns?: string[];
  rows: Array<Record<string, string | number | null>>;
}

export interface StewardReportSummaryArtifact extends StewardArtifactBase {
  type: "report_summary";
  headline?: string;
  keyMetrics?: string[];
  risks?: string[];
  opportunities?: string[];
  boardSummary?: string;
}

export interface StewardTaskListArtifact extends StewardArtifactBase {
  type: "task_list";
  tasks: Array<{
    title: string;
    priority?: string;
    dueDate?: string;
    donorName?: string;
  }>;
}

export interface StewardCallScriptArtifact extends StewardArtifactBase {
  type: "call_script";
  openingLine?: string;
  donorContext?: string;
  talkingPoints?: string[];
  nextStep?: string;
}

export interface StewardCsvRowsArtifact extends StewardArtifactBase {
  type: "csv_rows";
  fileName?: string;
  columns?: string[];
  rows: Array<Record<string, string | number | null>>;
}

/** A rich KPI dashboard card with optional inline bar chart and a deeplink to the full report. */
export interface StewardReportCardArtifact extends StewardArtifactBase {
  type: "report_card";
  fiscalYearLabel?: string;
  /** Individual KPI tiles shown in the card. */
  metrics: Array<{
    label: string;
    value: string;
    /** e.g. "+12% vs last year" */
    delta?: string;
    trend?: "up" | "down" | "flat";
  }>;
  /** CRM-internal route for "View Full Report" deep link, e.g. "/reports/giving-summary". */
  deepLink?: string;
  deepLinkLabel?: string;
  /** Optional sparkline / bar data embedded in the card. */
  chartData?: {
    /** Month/period labels for the x-axis. */
    labels: string[];
    /** Corresponding numeric values. */
    values: number[];
  };
}

/** Standalone inline chart rendered with pure SVG — no charting library required. */
export interface StewardChartArtifact extends StewardArtifactBase {
  type: "chart";
  /** bar = grouped bars | line = area-line | pie = pie slices | donut = ring chart | stacked_bar = stacked bars */
  chartType: "bar" | "line" | "pie" | "donut" | "stacked_bar";
  /** X-axis labels (e.g. month names). Not used for pie/donut. */
  labels: string[];
  series: Array<{
    name: string;
    /** Hex colour string, e.g. "#16a34a". */
    color?: string;
    data: number[];
  }>;
  /** Prefix applied to y-axis values or tooltip, e.g. "$". */
  yAxisPrefix?: string;
  yAxisLabel?: string;
}

export type StewardArtifact =
  | StewardEmailDraftArtifact
  | StewardDonorListArtifact
  | StewardReportSummaryArtifact
  | StewardTaskListArtifact
  | StewardCallScriptArtifact
  | StewardCsvRowsArtifact
  | StewardReportCardArtifact
  | StewardChartArtifact;

export interface StewardStructuredResponse {
  version: 1;
  replyMarkdown: string;
  artifacts: StewardArtifact[];
  suggestedActions: StewardSuggestedAction[];
  evidence: StewardEvidenceItem[];
  parseWarning?: string;
}
