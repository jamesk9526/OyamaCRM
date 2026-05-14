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

export type StewardArtifact =
  | StewardEmailDraftArtifact
  | StewardDonorListArtifact
  | StewardReportSummaryArtifact
  | StewardTaskListArtifact
  | StewardCallScriptArtifact
  | StewardCsvRowsArtifact;

export interface StewardStructuredResponse {
  version: 1;
  replyMarkdown: string;
  artifacts: StewardArtifact[];
  suggestedActions: StewardSuggestedAction[];
  evidence: StewardEvidenceItem[];
  parseWarning?: string;
}
