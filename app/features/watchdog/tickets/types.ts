// Types for Watchdog feedback ticket triage dashboards and API responses.

export type WatchdogFeedbackTicketType =
  | "bug_report"
  | "feature_request"
  | "feature_change"
  | "confusing_ui"
  | "data_issue"
  | "general_feedback";

export type WatchdogFeedbackTicketStatus = "new" | "in_review" | "in_progress" | "waiting_on_user" | "resolved" | "closed";

export type WatchdogFeedbackPriority = "low" | "normal" | "high" | "urgent";

export type WatchdogFeedbackScope = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "hrm" | "reportit" | "other" | "unknown";

export interface WatchdogTicketUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  displayName?: string;
}

export interface WatchdogFeedbackTicket {
  id: string;
  ticketNumber: string;
  organizationId: string;
  type: WatchdogFeedbackTicketType;
  status: WatchdogFeedbackTicketStatus;
  priority: WatchdogFeedbackPriority;
  crmScope: WatchdogFeedbackScope;
  pageUrl: string;
  routePath: string | null;
  pageTitle: string | null;
  submittedByUserId: string | null;
  submittedByName: string | null;
  submittedByEmail: string | null;
  submittedByDisplayName: string | null;
  whatTryingToDo: string | null;
  whatHappened: string | null;
  expectedResult: string | null;
  extraComments: string | null;
  featureTitle: string | null;
  featureProblem: string | null;
  featureAudience: string | null;
  featureRequestedChange: string | null;
  importance: string | null;
  browserInfo: string | null;
  deviceInfo: string | null;
  appVersion: string | null;
  environment: string | null;
  assignedDeveloperId: string | null;
  assignedToPersonId: string | null;
  assignedDeveloperDisplayName: string | null;
  developerNotes: string | null;
  resolutionNotes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  submittedByUser?: WatchdogTicketUser | null;
  assignedDeveloper?: WatchdogTicketUser | null;
}

export interface WatchdogTicketSummary {
  totals: {
    total: number;
    unresolved: number;
    unassigned: number;
    urgent: number;
    high: number;
    openOver72h: number;
  };
  groups: {
    byStatus: Array<{ status: string; _count: { _all: number } }>;
    byType: Array<{ type: string; _count: { _all: number } }>;
    byScope: Array<{ crmScope: string; _count: { _all: number } }>;
    byPriority: Array<{ priority: string; _count: { _all: number } }>;
  };
}

export interface WatchdogTicketListResponse {
  items: WatchdogFeedbackTicket[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WatchdogTicketFilters {
  search: string;
  status: WatchdogFeedbackTicketStatus | "all";
  type: WatchdogFeedbackTicketType | "all";
  priority: WatchdogFeedbackPriority | "all";
  crmScope: WatchdogFeedbackScope | "all";
  assignedTo: string;
}

export const DEFAULT_TICKET_FILTERS: WatchdogTicketFilters = {
  search: "",
  status: "all",
  type: "all",
  priority: "all",
  crmScope: "all",
  assignedTo: "",
};
