/** OGentic types define the agentic control-center contract for tools, artifacts, and handoffs. */

export type OGenticModuleId = "ogentic";

export type OGenticToolCategory =
  | "donor"
  | "event"
  | "client"
  | "communication"
  | "reporting"
  | "spreadsheet"
  | "task"
  | "analysis"
  | "import"
  | "export"
  | "system";

export type OGenticRiskLevel = "safe" | "review_required" | "sensitive" | "destructive";

export type OGenticArtifactType =
  | "email_draft"
  | "letter_draft"
  | "donor_list"
  | "spreadsheet"
  | "report"
  | "task_plan"
  | "segment"
  | "analysis"
  | "note"
  | "export";

export interface OGenticExecutionContext {
  moduleScope: Array<"donor" | "event" | "client" | "communication" | "reporting">;
  userId?: string;
  organizationId?: string;
  sourceRoute?: string;
}

export interface OGenticTool {
  id: string;
  name: string;
  description: string;
  category: OGenticToolCategory;
  riskLevel: OGenticRiskLevel;
  requiresApproval: boolean;
  isStub: boolean;
  inputSchema: unknown;
  outputSchema: unknown;
  execute: (input: unknown, context: OGenticExecutionContext) => Promise<unknown>;
}

export interface OGenticArtifact {
  id: string;
  type: OGenticArtifactType;
  title: string;
  status: "draft" | "review" | "approved" | "saved" | "archived";
  sourceChatId?: string;
  relatedModule?: "donor" | "event" | "client" | "communication" | "reporting";
  relatedRecordIds?: string[];
  content: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface OGenticEmailDraft {
  id: string;
  title: string;
  subject: string;
  body: string;
  audienceType: "single_donor" | "segment" | "event_attendees" | "custom";
  relatedDonorIds?: string[];
  relatedSegmentId?: string;
  relatedEventId?: string;
  purpose: "thank_you" | "monthly_giving" | "lapsed_follow_up" | "event_follow_up" | "campaign" | "newsletter" | "custom";
  status: "draft" | "ready_for_review" | "approved" | "sent" | "archived";
  createdBy: "user" | "steward_ai";
  createdAt: string;
  updatedAt: string;
}

export interface OGenticSpreadsheet {
  id: string;
  title: string;
  description?: string;
  columns: Array<{
    key: string;
    label: string;
    type: "text" | "number" | "date" | "currency" | "status" | "boolean";
  }>;
  rows: Array<Record<string, unknown>>;
  source: {
    toolId: string;
    input: unknown;
  };
  createdAt: string;
  updatedAt: string;
}

export interface StewardToOGenticHandoff {
  prompt: string;
  sourceRoute: string;
  contextType?: "donor" | "event" | "client" | "report" | "communication";
  contextIds?: string[];
  createdAt: string;
}
