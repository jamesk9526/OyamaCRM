// Shared types and constants for the cross-CRM feedback modal and Watchdog ticketing flows.

/** All feedback ticket categories supported by the guided submission modal. */
export const FEEDBACK_TYPES = [
  "bug_report",
  "feature_request",
  "feature_change",
  "confusing_ui",
  "data_issue",
  "general_feedback",
] as const;

/** Queue priority levels used for Watchdog triage sorting. */
export const FEEDBACK_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

/** Feature-value importance levels used in product planning workflows. */
export const FEATURE_IMPORTANCE_LEVELS = ["low", "helpful", "important", "urgent"] as const;

/** Topbar module keys that can be attached to one feedback ticket as source scope. */
export const FEEDBACK_CRM_SCOPES = ["donor", "compassion", "events", "watchdog", "webmaster", "hrm", "reportit", "other", "unknown"] as const;

/** Feedback type value union. */
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];

/** Queue priority value union. */
export type FeedbackPriority = (typeof FEEDBACK_PRIORITIES)[number];

/** Feature importance value union. */
export type FeatureImportance = (typeof FEATURE_IMPORTANCE_LEVELS)[number];

/** CRM scope value union. */
export type FeedbackCrmScope = (typeof FEEDBACK_CRM_SCOPES)[number];

/** Privacy-safe page and environment details sent with one feedback ticket. */
export interface FeedbackContextPayload {
  crmScope: FeedbackCrmScope;
  pageUrl: string;
  routePath: string;
  pageTitle: string;
  browserInfo: string;
  deviceInfo: string;
  appVersion: string;
  environment: string;
}

/** Guided form state for one feedback submission draft. */
export interface FeedbackFormState {
  type: FeedbackType;
  priority: FeedbackPriority;
  importance: FeatureImportance | "";
  whatTryingToDo: string;
  whatHappened: string;
  expectedResult: string;
  extraComments: string;
  featureTitle: string;
  featureProblem: string;
  featureAudience: string;
  featureRequestedChange: string;
}

/** Submission payload shape accepted by POST /api/feedback/submit. */
export interface FeedbackSubmitPayload {
  type: FeedbackType;
  priority?: FeedbackPriority;
  importance?: FeatureImportance;
  whatTryingToDo?: string;
  whatHappened?: string;
  expectedResult?: string;
  extraComments?: string;
  featureTitle?: string;
  featureProblem?: string;
  featureAudience?: string;
  featureRequestedChange?: string;
  context: FeedbackContextPayload;
}

/** API response shape returned after ticket creation. */
export interface FeedbackSubmitResponse {
  ticket: {
    id: string;
    ticketNumber: string;
    type: FeedbackType;
    status: string;
    priority: FeedbackPriority;
    crmScope: string;
    createdAt: string;
  };
}

/** Default form values used when opening the modal for a new submission. */
export const DEFAULT_FEEDBACK_FORM_STATE: FeedbackFormState = {
  type: "bug_report",
  priority: "normal",
  importance: "",
  whatTryingToDo: "",
  whatHappened: "",
  expectedResult: "",
  extraComments: "",
  featureTitle: "",
  featureProblem: "",
  featureAudience: "",
  featureRequestedChange: "",
};
