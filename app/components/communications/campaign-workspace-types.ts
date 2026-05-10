/** Shared type definitions for the Communications campaign workspace UI. */

/** Detailed email campaign record returned by GET /api/email-campaigns/:id. */
export interface WorkspaceCampaign {
  id: string;
  name: string;
  subject: string;
  status: string;
  previewText?: string | null;
  fromName: string;
  fromEmail: string;
  replyToEmail?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  audienceFilter?: string | null;
  totalRecipients: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  sentAt?: string | null;
  scheduledAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Preview payload returned by POST /api/email-campaigns/:id/preview. */
export interface WorkspacePreview {
  id: string;
  subject: string;
  previewText?: string | null;
  fromName: string;
  fromEmail: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  status: string;
  scheduledAt?: string | null;
}

/** Audience preview summary from POST /api/email-campaigns/audience-preview. */
export interface AudienceSummary {
  totalMatched: number;
  validEmail: number;
  missingEmail: number;
  optedOut: number;
  duplicateEmails: number;
  suppressionCount: number;
  finalSendCount: number;
}

/** Send-log row returned by GET /api/email-campaigns/:id/send-log. */
export interface CampaignSendLogEntry {
  id: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

/** Saved recipient list row returned by /api/email-campaigns/lists. */
export interface SavedRecipientList {
  id: string;
  name: string;
  description?: string | null;
  createdById?: string | null;
  recipientsCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Individual per-recipient delivery event row. */
export interface DeliveryEventRow {
  id: string;
  organizationId: string;
  campaignId: string;
  recipientEmail: string;
  eventType: "QUEUED" | "DELIVERED" | "OPENED" | "CLICKED" | "BOUNCED";
  eventAt: string;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

/** Aggregated delivery event summary + recent rows for campaign analytics. */
export interface DeliveryEventsResponse {
  summary: {
    queued: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
  };
  events: DeliveryEventRow[];
}
