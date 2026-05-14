// Shared type contracts for the OyamaWatchdog operations workspace.

export type WorkingStatus = "Working" | "Partially Working" | "Broken" | "Not Implemented";

export interface WatchdogOverviewResponse {
  overview: {
    systemHealth: WorkingStatus;
    lastSuccessfulBackup: WatchdogBackupRecord | null;
    nextScheduledBackup: WatchdogBackupPolicy | null;
    backupVerificationStatus: string;
    restoreReadinessScore: number;
    openIncidents: number;
    failedJobs: number;
    securityWarnings: number;
    vaultHealth: WorkingStatus;
    permissionRiskWarnings: number;
    backgroundJobStatus: WorkingStatus;
    databaseStatus: WorkingStatus;
    storageStatus: WorkingStatus;
    environmentStatus: WorkingStatus;
    externalStoreWarning: string | null;
  };
  attentionItems: Array<{
    title: string;
    severity: "low" | "medium" | "high" | "critical";
    actionHref: string;
    detail: string;
  }>;
  recentAuditEvents: WatchdogAuditItem[];
  settings: Record<string, unknown>;
}

export interface WatchdogBackupRecord {
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

export interface WatchdogBackupPolicy {
  id: string;
  organizationId: string;
  policyName: string;
  backupScope: string;
  moduleScope: string | null;
  cronExpression: string;
  retentionDays: number;
  storageTarget: string;
  encrypted: boolean;
  enabled: boolean;
  notes: string | null;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface WatchdogBackupVerification {
  id: number;
  organizationId: string;
  backupId: string;
  status: "QUEUED" | "RUNNING" | "VERIFIED" | "FAILED";
  checksumMatches: boolean | null;
  details: Record<string, unknown> | null;
  errorMessage: string | null;
  verifiedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WatchdogRestorePoint extends WatchdogBackupRecord {
  verification: WatchdogBackupVerification | null;
  verificationStatus: string;
  blockedReason: string | null;
}

export interface WatchdogRestoreDryRun {
  id: string;
  organizationId: string;
  backupId: string;
  status: "DRY_RUN_RUNNING" | "DRY_RUN_PASSED" | "DRY_RUN_FAILED";
  riskLevel: "low" | "medium" | "high" | "critical";
  overwriteSummary: Record<string, unknown> | null;
  warnings: string[];
  requestedBy: string;
  createdAt: string;
}

export interface WatchdogRestoreJob {
  id: string;
  organizationId: string;
  backupId: string;
  dryRunId: string;
  status: "DRAFT" | "AWAITING_APPROVAL" | "RUNNING" | "VERIFYING" | "COMPLETED" | "FAILED" | "CANCELED";
  riskLevel: "low" | "medium" | "high" | "critical";
  breakGlassUsed: boolean;
  preRestoreBackupId: string | null;
  requestedBy: string;
  reason: string | null;
  report: Record<string, unknown> | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface WatchdogVaultAccessEvent {
  id: number;
  organizationId: string;
  vaultEntryId: string;
  accessType: "reveal" | "copy" | "rotate" | "export";
  accessedBy: string;
  reason: string | null;
  createdAt: string;
}

export interface WatchdogSecuritySummary {
  summary: {
    permissionRisks: number;
    adminAccounts: number;
    usersWithoutMfa: number | null;
    recentFailedLogins: number;
    suspiciousAccess: number;
    secretsNeedingRotation: number;
    publicEndpoints: number | null;
    rateLimitStatus: WorkingStatus;
    webhookSignatureStatus: WorkingStatus;
    backupEncryptionStatus: WorkingStatus;
    workspaceBoundaryWarnings: number;
    privacyBoundaryWarnings: number;
    recentVaultSensitiveAccessEvents: number;
    vaultState: WorkingStatus;
  };
  checks: Array<{
    key: string;
    label: string;
    status: WorkingStatus;
    detail: string;
  }>;
}

export interface WatchdogHealthResponse {
  checks: Array<{
    key: string;
    label: string;
    status: WorkingStatus;
    detail: string;
    checkedAt: string;
  }>;
  summary: {
    healthy: number;
    partial: number;
    broken: number;
    notImplemented: number;
  };
}

export interface WatchdogAuditItem {
  id: string;
  action: string;
  entity: string | null;
  entityId: string | null;
  userId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  severity: "low" | "medium" | "high" | "critical";
  module: string;
}

export interface WatchdogAuditResponse {
  items: WatchdogAuditItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface WatchdogRunbook {
  id: string;
  title: string;
  purpose: string;
  whenToUse: string;
  requiredPermissions: string[];
  steps: string[];
  warnings: string[];
  verificationChecklist: string[];
  relatedVaultCategories: string[];
  relatedBackupPolicies: string[];
  lastReviewedDate: string;
}

export interface WatchdogRunbooksResponse {
  items: WatchdogRunbook[];
  status: WorkingStatus;
  note: string;
}

export interface WatchdogDatabaseConfig {
  databaseUrlConfigured: boolean;
  watchdogDatabaseUrlMasked: string | null;
  watchdogDatabaseConfigured: boolean;
  watchdogEncryptionConfigured: boolean;
  jwtSecretConfigured: boolean;
  nextPublicApiUrl: string | null;
}

export interface WatchdogDatabaseConfigResponse {
  config: WatchdogDatabaseConfig;
  environment: "production" | "non-production";
  warnings: {
    environmentMessage: string;
    permissionMessage: string;
  };
  watchdogHealth: {
    configured: boolean;
    connected: boolean;
    encryptionReady: boolean;
    message: string;
  };
  confirmationText: string;
}
