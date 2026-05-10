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
