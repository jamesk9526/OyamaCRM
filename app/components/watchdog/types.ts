// Shared type contracts for the OyamaWatchdog frontend module.

export interface WatchdogStatusData {
  watchdog: {
    configured: boolean;
    encryptionConfigured: boolean;
    health: {
      configured: boolean;
      connected: boolean;
      encryptionReady: boolean;
      message: string;
    };
  };
  totals: {
    totalAuditEvents: number;
    highSeverityEvents24h: number;
    recentAuthFailures: number;
  };
}

export interface WatchdogSecurityFeedItem {
  id: string;
  source: "audit" | "watchdog";
  severity: "low" | "medium" | "high" | "critical";
  incidentStatus: "new" | "acknowledged" | "escalated" | "resolved";
  incidentUpdatedAt: string | null;
  eventType: string;
  sourceModule: string;
  message: string;
  createdAt: string;
  payload?: Record<string, unknown> | null;
}

export interface WatchdogVaultItem {
  id: string;
  name: string;
  category: string;
  username: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
  lastAccessedAt: string | null;
  password?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

export interface WatchdogBackupItem {
  id: string;
  label: string;
  organizationId: string;
  sourceVersion: string;
  primaryTableCount: number;
  primaryRowCount: number;
  watchdogTableCount: number;
  watchdogRowCount: number;
  checksumSha256: string;
  createdBy: string;
  createdAt: string;
  restoredAt: string | null;
}

export interface WatchdogFeedbackTicketItem {
  id: string;
  ticketNumber: string;
  type: "bug_report" | "feature_request" | "feature_change" | "confusing_ui" | "data_issue" | "general_feedback";
  status: "new" | "in_review" | "in_progress" | "waiting_on_user" | "resolved" | "closed";
  priority: "low" | "normal" | "high" | "urgent";
  crmScope: "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "hrm" | "reportit" | "other" | "unknown";
  pageUrl: string;
  routePath: string | null;
  pageTitle: string | null;
  submittedByDisplayName: string | null;
  assignedDeveloperDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
}

export interface WatchdogFeedbackSummaryData {
  totals: {
    total: number;
    unresolved: number;
    unassigned: number;
    urgent: number;
    high: number;
    openOver72h: number;
  };
}
