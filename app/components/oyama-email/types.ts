/** Shared contracts for OyamaEmail workspace views. */

export type OyamaEmailView =
  | "templates"
  | "builder"
  | "publish"
  | "send"
  | "campaigns"
  | "callender"
  | "audience"
  | "queue"
  | "analytics"
  | "settings";

export interface OyamaEmailWorkspaceProps {
  view?: OyamaEmailView;
  templateId?: string;
  campaignId?: string;
}

export interface OyamaEmailCampaign {
  id: string;
  name: string;
  subject?: string | null;
  previewText?: string | null;
  fromName?: string | null;
  fromEmail?: string | null;
  replyToEmail?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  status: string;
  totalRecipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  createdAt: string;
  updatedAt: string;
  scheduledAt?: string | null;
  sentAt?: string | null;
  purpose?: string | null;
  audienceFilter?: string | null;
  ownerId?: string | null;
  preparationStatus?: "NOT_STARTED" | "DRAFT" | "READY";
  sharedWithOrganization?: boolean;
  workspaceStatus?:
    | "DRAFT"
    | "NEEDS_REVIEW"
    | "READY"
    | "SCHEDULED"
    | "QUEUED"
    | "SENDING"
    | "SENT"
    | "DELIVERED"
    | "FAILED"
    | "CANCELLED"
    | "ARCHIVED";
  nextRecommendedAction?: string;
  templateSnapshot?: {
    templateId?: string | null;
    templateVersion?: string | null;
    templateName?: string | null;
  } | null;
  workflow?: {
    preparationStatus?: "NOT_STARTED" | "DRAFT" | "READY";
    needsReview?: boolean;
    archivedAt?: string | null;
    archivedById?: string | null;
    queueState?: "ACTIVE" | "PAUSED";
    lastQueueActionAt?: string | null;
    lastQueueActionById?: string | null;
  } | null;
}

export interface OyamaEmailStats {
  total: number;
  sent: number;
  scheduled: number;
  draft: number;
  totalRecipientsSent: number;
  avgOpenRate: number;
}

export interface OyamaEmailRecipientList {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface OyamaEmailConstituent {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
  doNotEmail?: boolean | null;
  doNotContact?: boolean | null;
  emailOptOut?: boolean | null;
}
