// Shared data contracts for the LiveCom donor interaction workspace.

export type LiveComChannel = "WEB_CHAT" | "CONTACT_FORM" | "SURVEY";

export type LiveComConversationStatus = "NEW" | "OPEN" | "IN_PROGRESS" | "WAITING_ON_DONOR" | "RESOLVED" | "ARCHIVED" | "SPAM";

export type LiveComPriority = "LOW" | "MEDIUM" | "HIGH";

export type LiveComInboxFilter = "ALL" | "UNREAD" | "NEW" | "OPEN" | "ACTIVE" | "WAITING" | "WAITING_ON_DONOR" | "RESOLVED" | "ARCHIVED" | "SPAM";

export type LiveComMessageRole = "visitor" | "staff" | "note" | "system";

/** One message bubble in a persisted LiveCom conversation thread. */
export interface LiveComConversationMessage {
  id: string;
  role: LiveComMessageRole;
  body: string;
  authorName: string;
  createdAt: string;
  deliveryState?: "sending" | "failed" | "sent";
}

/**
 * Lightweight constituent option used by the interaction capture form.
 */
export interface LiveComConstituentOption {
  id: string;
  firstName: string;
  lastName: string;
  email?: string | null;
}

/**
 * Represents one donor-facing inbound conversation stream.
 */
export interface LiveComConversation {
  id: string;
  visitorSessionId?: string | null;
  constituentId: string | null;
  visitorName: string;
  visitorEmail: string | null;
  visitorPhone: string | null;
  sourceSiteId?: string | null;
  publicSiteId?: string | null;
  sourceWebsite: string;
  pageUrl: string;
  status: LiveComConversationStatus;
  priority: LiveComPriority;
  unread: boolean;
  owner: string;
  assignedTo: string;
  archivedAt: string | null;
  resolvedAt?: string | null;
  archiveReason: string | null;
  linkedDonorName: string | null;
  lastMessagePreview: string;
  startedAt: string;
  updatedAt: string;
  messages: LiveComConversationMessage[];
  /** Legacy table-panel alias retained while older LiveCom panels are phased out. */
  donorName?: string;
  /** Legacy channel field retained for older intake panels. */
  channel?: LiveComChannel;
  /** Legacy preview field retained for older intake panels. */
  messagePreview?: string;
  /** Legacy received timestamp retained for older intake panels. */
  receivedAt?: string;
}

export type LiveComSurveyStatus = "DRAFT" | "LIVE" | "PAUSED";

/**
 * Tracks survey programs distributed through LiveCom channels.
 */
export interface LiveComSurvey {
  id: string;
  name: string;
  channel: "POST_CHAT" | "CAMPAIGN_FOLLOW_UP" | "WEBSITE_FORM";
  status: LiveComSurveyStatus;
  responses: number;
  responseRate: number;
  updatedAt: string;
}

/**
 * Tracks public website forms routed into the donor follow-up queue.
 */
export interface LiveComContactForm {
  id: string;
  name: string;
  sourcePath: string;
  newSubmissions: number;
  averageResponseMinutes: number;
  spamBlockedToday: number;
}

/**
 * Represents a donor interaction event from any inbound LiveCom channel.
 */
export interface LiveComInteractionEvent {
  id: string;
  occurredAt: string;
  channel: LiveComChannel;
  donorName: string;
  eventLabel: string;
  detail: string;
}

/**
 * Canonical tracked LiveCom interaction row returned by /api/livecom/interactions.
 */
export interface LiveComTrackedInteraction {
  id: string;
  constituentId: string | null;
  donorName: string;
  channel: LiveComChannel;
  status: LiveComConversationStatus;
  priority: LiveComPriority;
  owner: string;
  eventLabel: string;
  detail: string;
  messagePreview: string;
  occurredAt: string;
}

/**
 * Payload contract used when creating one tracked LiveCom interaction.
 */
export interface LiveComCreateInteractionInput {
  constituentId: string;
  detail: string;
  channel?: LiveComChannel;
  status?: LiveComConversationStatus;
  priority?: LiveComPriority;
  owner?: string;
  eventLabel?: string;
  messagePreview?: string;
}

/**
 * Payload contract used when updating one tracked LiveCom interaction.
 */
export interface LiveComUpdateInteractionInput {
  status?: LiveComConversationStatus;
  priority?: LiveComPriority;
  owner?: string;
  eventLabel?: string;
  detail?: string;
  messagePreview?: string;
}
