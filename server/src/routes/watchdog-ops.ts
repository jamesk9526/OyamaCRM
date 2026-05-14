/**
 * OyamaWatchdog operations routes.
 * Central backup, restore, vault, security, health, audit, and runbook workspace APIs.
 */
import { createHash } from "crypto";
import { Router, type Request, type Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import { getAppInfo } from "../lib/app-info.js";
import { upsertEnvironmentFileValues } from "../lib/env-file.js";
import { hasDefaultPermission, type PermissionKey } from "../lib/permissions.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { requireRole } from "../middleware/requireRole.js";
import { exportFullCrmBackup, restoreFullCrmBackup, type CrmBackupBundle } from "../services/crm-backup.js";
import {
  createWatchdogCrmBackup,
  getWatchdogCrmBackup,
  getWatchdogHealth,
  getWatchdogVaultEntry,
  isWatchdogDbConfigured,
  isWatchdogEncryptionConfigured,
  listWatchdogCrmBackups,
  listWatchdogSecurityEvents,
  listWatchdogVaultEntries,
  markWatchdogCrmBackupRestored,
  recordWatchdogSecurityEvent,
  resetWatchdogStoreConnections,
  updateWatchdogVaultEntry,
} from "../services/watchdog-store.js";
import {
  createWatchdogBackupPolicy,
  createWatchdogBackupVerification,
  createWatchdogRestoreDryRun,
  createWatchdogRestoreJob,
  deleteWatchdogBackupPolicy,
  getLatestWatchdogBackupVerification,
  getWatchdogRestoreDryRun,
  getWatchdogSettings,
  listWatchdogBackupPolicies,
  listWatchdogBackupVerifications,
  listWatchdogRestoreJobs,
  listWatchdogVaultAccessEvents,
  resetWatchdogOpsStoreConnections,
  recordWatchdogVaultAccessEvent,
  updateWatchdogBackupPolicy,
  updateWatchdogBackupVerification,
  updateWatchdogRestoreJob,
  upsertWatchdogSettings,
  type WatchdogBackupScope,
} from "../services/watchdog-ops-store.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

const BACKUP_SCOPES: WatchdogBackupScope[] = [
  "FULL_PLATFORM",
  "DATABASE",
  "FILES_MEDIA",
  "CONFIGURATION",
  "ENVIRONMENT_MANIFEST",
  "MODULE",
];

const MODULE_SCOPES = ["donor", "compassion", "events", "hrm", "webmaster", "watchdog", "apps"] as const;

type RestoreRiskLevel = "low" | "medium" | "high" | "critical";

interface WatchdogRunbook {
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

const WATCHDOG_RUNBOOKS: WatchdogRunbook[] = [
  {
    id: "full-app-backup",
    title: "Full App Backup",
    purpose: "Capture a complete snapshot of the platform before risky operations.",
    whenToUse: "Before deployments, schema changes, or emergency remediation.",
    requiredPermissions: ["watchdog.backups.create"],
    steps: [
      "Open Backups and select Full Platform scope.",
      "Confirm retention target and encryption policy.",
      "Run backup and wait for verification completion.",
      "Mark snapshot as protected when used as a rollback anchor.",
    ],
    warnings: [
      "Do not proceed to production restore without a verified backup.",
      "Environment manifests must remain redacted and never include raw secret values.",
    ],
    verificationChecklist: [
      "Verification status is Verified.",
      "Checksum result is true.",
      "Audit log contains backup + verification events.",
    ],
    relatedVaultCategories: ["Backup Encryption", "Hosting", "Storage"],
    relatedBackupPolicies: ["nightly-full-platform"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "full-app-restore",
    title: "Full App Restore",
    purpose: "Recover the complete application from a known restore point.",
    whenToUse: "Critical production incidents or data corruption events.",
    requiredPermissions: ["watchdog.restore.execute"],
    steps: [
      "Select restore point and inspect its verification history.",
      "Run dry-run and review overwrite risk report.",
      "Type restore point name to confirm intent.",
      "Execute restore and monitor verification outcome.",
    ],
    warnings: [
      "Production restore is destructive and overwrites current data.",
      "Break-glass restore is only allowed when verification failed and explicit permission exists.",
    ],
    verificationChecklist: [
      "Dry run status is DRY_RUN_PASSED.",
      "Pre-restore backup is created.",
      "Restore job status is Completed.",
    ],
    relatedVaultCategories: ["Database", "Backup Encryption"],
    relatedBackupPolicies: ["nightly-full-platform"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "database-restore",
    title: "Database Restore",
    purpose: "Restore data state from a verified backup bundle.",
    whenToUse: "Migration failures, accidental deletions, or major data regression.",
    requiredPermissions: ["watchdog.restore.dry_run", "watchdog.restore.execute"],
    steps: [
      "Confirm restore point verification status.",
      "Capture pre-restore backup from Watchdog.",
      "Execute restore through Watchdog Restore Center.",
      "Validate core donor, compassion, and events workflows.",
    ],
    warnings: ["Do not run direct SQL restore outside Watchdog unless incident commander approves."],
    verificationChecklist: [
      "API health check returns Working.",
      "Critical smoke tests pass after restore.",
      "Audit trail records actor and changed scope.",
    ],
    relatedVaultCategories: ["Database"],
    relatedBackupPolicies: ["nightly-database"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "failed-migration-recovery",
    title: "Failed Migration Recovery",
    purpose: "Recover from Prisma migration failures without data loss.",
    whenToUse: "Deploy-time migration failure, schema drift, or partial migration application.",
    requiredPermissions: ["watchdog.backups.create", "watchdog.restore.execute"],
    steps: [
      "Freeze write traffic and capture incident metadata.",
      "Take immediate pre-fix full backup.",
      "Apply migration repair plan and validate typecheck/build.",
      "Restore from pre-fix backup when repair fails.",
    ],
    warnings: ["Never drop tables in the same pass as schema replacement."],
    verificationChecklist: [
      "Migration lane status is Working or Partially Working with blocker documented.",
      "Prisma generate succeeds.",
      "API starts without route-mount errors.",
    ],
    relatedVaultCategories: ["Database", "Hosting"],
    relatedBackupPolicies: ["nightly-full-platform"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "email-provider-failure",
    title: "Email Provider Failure",
    purpose: "Stabilize outbound email operations when provider credentials or service fail.",
    whenToUse: "SMTP/API provider outage, credential revocation, or repeated send failures.",
    requiredPermissions: ["watchdog.security.view", "watchdog.vault.reveal"],
    steps: [
      "Review health dashboard email readiness.",
      "Validate sender credentials in vault metadata.",
      "Rotate secret if expired or compromised.",
      "Re-run health checks and communication smoke flow.",
    ],
    warnings: ["Do not paste provider credentials into incident notes or chat logs."],
    verificationChecklist: [
      "Secrets are rotated and audited.",
      "Provider readiness check is healthy.",
      "Communications send queue recovers.",
    ],
    relatedVaultCategories: ["Email/SMTP", "OAuth/API"],
    relatedBackupPolicies: ["weekly-config"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "backup-storage-failure",
    title: "Backup Storage Failure",
    purpose: "Respond to failed backup writes or inaccessible backup storage targets.",
    whenToUse: "Backup jobs fail with storage, checksum, or external DB readiness errors.",
    requiredPermissions: ["watchdog.backups.view", "watchdog.backups.create"],
    steps: [
      "Open backup failed jobs panel.",
      "Confirm storage target availability and retention policy.",
      "Run test backup and verify checksum.",
      "Escalate when failures persist across two attempts.",
    ],
    warnings: ["Do not delete the most recent verified backup during storage incidents."],
    verificationChecklist: [
      "Backup write completes.",
      "Verification status is Verified.",
      "Alert counters return to healthy range.",
    ],
    relatedVaultCategories: ["Storage", "Backup Encryption"],
    relatedBackupPolicies: ["nightly-full-platform"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "lost-admin-access",
    title: "Lost Admin Access",
    purpose: "Recover privileged access while preserving auditability.",
    whenToUse: "All primary admin users are locked out or credentials are lost.",
    requiredPermissions: ["watchdog.admin"],
    steps: [
      "Validate incident ownership and org authorization.",
      "Use approved break-glass path to regain admin access.",
      "Reset affected credentials and rotate high-risk secrets.",
      "Review recent audit logs for suspicious changes.",
    ],
    warnings: ["Break-glass access must be audited and revoked after incident close."],
    verificationChecklist: [
      "At least two active admin users are confirmed.",
      "Break-glass grants are removed.",
      "Incident report is attached to audit trail.",
    ],
    relatedVaultCategories: ["Internal Service", "Hosting"],
    relatedBackupPolicies: ["nightly-full-platform"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "secret-rotation",
    title: "Secret Rotation",
    purpose: "Rotate credentials and keys with complete access auditing.",
    whenToUse: "Credential expiration, suspected compromise, or scheduled rotation cadence.",
    requiredPermissions: ["watchdog.vault.rotate", "watchdog.vault.edit"],
    steps: [
      "Open vault entry and confirm integration ownership.",
      "Rotate secret value and mark old value retired.",
      "Record rotation reason and related incident if applicable.",
      "Validate dependent service health checks.",
    ],
    warnings: ["Never expose rotated values in logs, screenshots, or audit metadata."],
    verificationChecklist: [
      "Vault access event recorded as rotate.",
      "Dependent integration remains healthy.",
      "Old credential is revoked upstream.",
    ],
    relatedVaultCategories: ["Database", "Email/SMTP", "OAuth/API", "Backup Encryption"],
    relatedBackupPolicies: ["weekly-config"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "failed-deploy-recovery",
    title: "Failed Deploy Recovery",
    purpose: "Restore service after failed release or unstable deployment.",
    whenToUse: "Build/deploy pipeline succeeds partially but runtime health is broken.",
    requiredPermissions: ["watchdog.view", "watchdog.restore.execute"],
    steps: [
      "Review health + audit timelines around deployment window.",
      "Capture emergency backup before rollback changes.",
      "Rollback application and restore data when required.",
      "Run post-rollback smoke checks.",
    ],
    warnings: ["Do not claim Working until validation lanes are rerun and documented."],
    verificationChecklist: [
      "Build metadata in health dashboard matches rollback target.",
      "Core smoke tests pass.",
      "Incident closure notes are recorded.",
    ],
    relatedVaultCategories: ["Hosting", "Internal Service"],
    relatedBackupPolicies: ["nightly-full-platform"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "compassion-privacy-incident",
    title: "Compassion Data Privacy Incident",
    purpose: "Contain and remediate sensitive client-data exposure incidents.",
    whenToUse: "Potential cross-module exposure of client records or confidential fields.",
    requiredPermissions: ["watchdog.security.view", "watchdog.audit.view"],
    steps: [
      "Isolate affected routes and suspend high-risk exports.",
      "Review audit events by module and actor.",
      "Validate client-scope boundaries and redact leaked fields.",
      "Document remediation and notify compliance owner.",
    ],
    warnings: ["Client privacy data must never be copied into donor or public contexts."],
    verificationChecklist: [
      "Boundary warning checks return healthy/working.",
      "No additional exposure events after mitigation.",
      "Incident timeline is complete.",
    ],
    relatedVaultCategories: ["Internal Service"],
    relatedBackupPolicies: ["nightly-full-platform"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "donor-data-recovery",
    title: "Donor Data Recovery",
    purpose: "Recover donor records, donations, and campaign artifacts from valid restore points.",
    whenToUse: "Accidental donor data deletion or severe donor workflow corruption.",
    requiredPermissions: ["watchdog.restore.execute", "watchdog.audit.view"],
    steps: [
      "Confirm impacted donor scope and timeline.",
      "Run restore dry-run and validate donor table impact.",
      "Execute restore with typed confirmation.",
      "Validate donor stewardship loop and reporting metrics.",
    ],
    warnings: ["Prefer scoped recovery whenever a full restore is not required."],
    verificationChecklist: [
      "Constituent and donation counts are reconciled.",
      "Campaign totals and reports match expected recovery window.",
      "Audit feed records all recovery steps.",
    ],
    relatedVaultCategories: ["Database"],
    relatedBackupPolicies: ["nightly-database"],
    lastReviewedDate: "2026-05-13",
  },
  {
    id: "event-day-emergency-ops",
    title: "Event Day Emergency Operations",
    purpose: "Stabilize events operations during live event disruptions.",
    whenToUse: "Check-in outages, registration delays, or event-service API failures.",
    requiredPermissions: ["watchdog.health.view", "watchdog.audit.view"],
    steps: [
      "Check event-related service health and queue status.",
      "Verify credential validity for event integrations.",
      "Run targeted backup/manifest for events context.",
      "Coordinate with event operations lead and record timeline.",
    ],
    warnings: ["Avoid destructive restore during active check-in unless incident commander approves."],
    verificationChecklist: [
      "Event check-in APIs recover.",
      "Audit entries show restoration timeline.",
      "Post-event retrospective is documented.",
    ],
    relatedVaultCategories: ["OAuth/API", "Storage"],
    relatedBackupPolicies: ["nightly-events-module"],
    lastReviewedDate: "2026-05-13",
  },
];

const DEFAULT_WATCHDOG_SETTINGS: Record<string, unknown> = {
  backupSchedules: {
    fullPlatform: "0 2 * * *",
    database: "0 */6 * * *",
    filesMedia: "0 3 * * *",
  },
  retentionRules: {
    verifiedBackupsDays: 90,
    failedJobsDays: 30,
  },
  storageTargets: [
    {
      key: "watchdog-default",
      label: "Watchdog External Store",
      status: "Working",
    },
  ],
  encryption: {
    requireEncryptedBackups: true,
    vaultRevealRequiresReason: true,
  },
  restorePolicy: {
    requireDryRun: true,
    requireTypedConfirmation: true,
    autoPreRestoreBackup: true,
  },
  notificationSettings: {
    emailOnFailedBackup: true,
    emailOnFailedRestore: true,
    emailOnCriticalSecurityAlert: true,
  },
  alertThresholds: {
    failedJobsWarning: 1,
    securityCriticalWarning: 1,
  },
  healthCheckIntervals: {
    servicesMinutes: 5,
    backupStorageMinutes: 15,
  },
  moduleCoverage: {
    donor: true,
    compassion: true,
    events: true,
    hrm: true,
    webmaster: true,
    watchdog: true,
    apps: true,
  },
};

const WATCHDOG_DATABASE_CONFIRMATION_TEXT = "I UNDERSTAND THIS WILL CHANGE DATABASE SETTINGS";

function maskConnectionString(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim();
  if (raw.length <= 10) return "********";
  return `${raw.slice(0, 5)}...${raw.slice(-4)}`;
}

function buildWatchdogDatabaseConfigView() {
  return {
    databaseUrlConfigured: Boolean(process.env.DATABASE_URL?.trim()),
    watchdogDatabaseUrlMasked: maskConnectionString(process.env.WATCHDOG_DATABASE_URL),
    watchdogDatabaseConfigured: Boolean(process.env.WATCHDOG_DATABASE_URL?.trim()),
    watchdogEncryptionConfigured: Boolean(process.env.WATCHDOG_ENCRYPTION_KEY?.trim()),
    jwtSecretConfigured: Boolean(process.env.JWT_SECRET?.trim()),
    nextPublicApiUrl: (process.env.NEXT_PUBLIC_API_URL ?? "").trim() || null,
  };
}

function buildWatchdogDatabaseWarnings(role: string | undefined): {
  environment: "production" | "non-production";
  warnings: {
    environmentMessage: string;
    permissionMessage: string;
  };
} {
  const isProduction = process.env.NODE_ENV === "production";
  return {
    environment: isProduction ? "production" : "non-production",
    warnings: {
      environmentMessage: isProduction
        ? "Production mode: changing database, JWT, or API URL values can affect live donor/client operations. Schedule updates with rollback coverage."
        : "Non-production mode: settings changes are useful for local/staging validation. Restart services if runtime behavior does not refresh immediately.",
      permissionMessage: `Current role: ${role ?? "unknown"}. This action is restricted to admins with watchdog.settings.manage permission.`,
    },
  };
}

/** Maps unsupported external-store errors to a consistent API response. */
function watchdogStoreUnavailable(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Watchdog external store is unavailable.";
  res.status(503).json({
    error: {
      code: "WATCHDOG_STORE_UNAVAILABLE",
      message,
    },
  });
}

/** Computes severity from action text for audit filtering and dashboards. */
function severityFromAction(action: string): "low" | "medium" | "high" | "critical" {
  const normalized = action.toUpperCase();
  if (normalized.includes("LOGIN_FAILED") || normalized.includes("TOKEN_EXPIRED") || normalized.includes("UNAUTHORIZED")) {
    return "critical";
  }
  if (normalized.includes("DELETE") || normalized.includes("RESET") || normalized.includes("FORBIDDEN") || normalized.includes("RESTORE")) {
    return "high";
  }
  if (normalized.includes("UPDATE") || normalized.includes("ROTATE") || normalized.includes("BACKUP")) {
    return "medium";
  }
  return "low";
}

/** Infers module from one audit action/entity pair. */
function sourceModuleFromAudit(action: string, entity: string | null): string {
  const a = action.toUpperCase();
  const e = (entity ?? "").toUpperCase();

  if (a.includes("COMPASSION") || e.includes("COMPASSION") || e.includes("CLIENT") || e.includes("CASE")) return "compassion";
  if (a.includes("EVENT") || e.includes("EVENT") || e.includes("GUEST") || e.includes("TICKET")) return "events";
  if (a.includes("WATCHDOG") || e.includes("WATCHDOG")) return "watchdog";
  if (a.includes("WEBMASTER") || e.includes("WEBMASTER")) return "webmaster";
  if (a.includes("HRM") || e.includes("HRM")) return "hrm";
  return "donor";
}

/** Validates one restore payload as a known backup bundle shape. */
function isCrmBackupBundle(payload: unknown): payload is CrmBackupBundle {
  if (!payload || typeof payload !== "object") return false;
  const asRecord = payload as Record<string, unknown>;
  return (
    asRecord.backupSchemaVersion === "1" &&
    typeof asRecord.generatedAt === "string" &&
    typeof asRecord.organizationId === "string" &&
    typeof asRecord.sqlDump === "string" &&
    typeof asRecord.primaryDatabase === "object" &&
    asRecord.primaryDatabase !== null
  );
}

/** Checks whether the current request has one fine-grained permission. */
async function hasPermission(req: Request, permission: PermissionKey): Promise<boolean> {
  const userId = req.user?.sub;
  const role = req.user?.role;
  if (!userId || !role) return false;

  const override = await prisma.userPermission.findUnique({
    where: {
      userId_permission: {
        userId,
        permission,
      },
    },
    select: { granted: true },
  });

  if (override) return Boolean(override.granted);
  return hasDefaultPermission(role, permission);
}

/** Returns true when one policy value is a valid backup scope constant. */
function isBackupScope(value: string): value is WatchdogBackupScope {
  return BACKUP_SCOPES.includes(value as WatchdogBackupScope);
}

/** Reads and validates one optional ISO timestamp query parameter. */
function parseOptionalDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Reads and validates one positive integer query parameter with bounds. */
function parseBoundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (Number.isNaN(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), min), max);
}

/** Builds a human-readable restore readiness score with deterministic penalty rules. */
function computeRestoreReadinessScore(params: {
  hasBackup: boolean;
  backupAgeHours: number | null;
  latestVerificationStatus: string | null;
  hasEnabledPolicy: boolean;
  failedJobs: number;
}): number {
  let score = 100;

  if (!params.hasBackup) score -= 45;
  if (params.backupAgeHours !== null && params.backupAgeHours > 48) score -= 20;
  if (params.latestVerificationStatus === "FAILED") score -= 30;
  if (!params.hasEnabledPolicy) score -= 15;
  if (params.failedJobs > 0) score -= Math.min(params.failedJobs * 5, 20);

  return Math.max(0, Math.min(100, score));
}

/** GET /api/watchdog/ops/overview - central operations command summary. */
router.get("/ops/overview", requirePermission("watchdog.view"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const now = Date.now();

  const [watchdogHealth, auditEvents24h, recentAuditEvents] = await Promise.all([
    getWatchdogHealth(),
    prisma.auditLog.findMany({
      where: {
        organizationId,
        createdAt: { gte: new Date(now - 24 * 60 * 60 * 1000) },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: {
        id: true,
        action: true,
        entity: true,
        userId: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      take: 12,
      select: {
        id: true,
        action: true,
        entity: true,
        userId: true,
        metadata: true,
        createdAt: true,
      },
    }),
  ]);

  let backups: Awaited<ReturnType<typeof listWatchdogCrmBackups>> = [];
  let policies: Awaited<ReturnType<typeof listWatchdogBackupPolicies>> = [];
  let restoreJobs: Awaited<ReturnType<typeof listWatchdogRestoreJobs>> = [];
  let vaultEntries: Awaited<ReturnType<typeof listWatchdogVaultEntries>> = [];
  let securityEvents: Awaited<ReturnType<typeof listWatchdogSecurityEvents>> = [];
  let latestVerification: Awaited<ReturnType<typeof getLatestWatchdogBackupVerification>> = null;
  let settings: Record<string, unknown> | null = null;
  let externalStoreWarning: string | null = null;

  try {
    [backups, policies, restoreJobs, vaultEntries, securityEvents, settings] = await Promise.all([
      listWatchdogCrmBackups({ organizationId, limit: 25 }),
      listWatchdogBackupPolicies(organizationId),
      listWatchdogRestoreJobs({ organizationId, limit: 40 }),
      listWatchdogVaultEntries(organizationId),
      listWatchdogSecurityEvents({ organizationId, limit: 120 }),
      getWatchdogSettings(organizationId),
    ]);

    if (backups[0]) {
      latestVerification = await getLatestWatchdogBackupVerification({
        organizationId,
        backupId: backups[0].id,
      });
    }
  } catch (error) {
    externalStoreWarning = error instanceof Error
      ? error.message
      : "Watchdog external store is unavailable for backup/vault/restore data.";
  }

  const failedJobs =
    restoreJobs.filter((job) => job.status === "FAILED").length +
    auditEvents24h.filter((event) => event.action.toUpperCase().includes("FAILED")).length;

  const unresolvedIncidentCount = securityEvents.filter((event) => event.incidentStatus !== "resolved").length;
  const securityWarningCount = [
    ...securityEvents.filter((event) => event.severity === "high" || event.severity === "critical"),
    ...auditEvents24h.filter((event) => severityFromAction(event.action) === "high" || severityFromAction(event.action) === "critical"),
  ].length;

  const permissionRiskWarnings = await prisma.userPermission.count({
    where: {
      permission: "watchdog.restore.break_glass",
      granted: true,
      user: {
        organizationId,
      },
    },
  });

  const lastBackup = backups[0] ?? null;
  const backupAgeHours = lastBackup
    ? Math.round((now - new Date(lastBackup.createdAt).getTime()) / (60 * 60 * 1000))
    : null;
  const hasEnabledPolicy = policies.some((policy) => policy.enabled);

  const restoreReadinessScore = computeRestoreReadinessScore({
    hasBackup: Boolean(lastBackup),
    backupAgeHours,
    latestVerificationStatus: latestVerification?.status ?? null,
    hasEnabledPolicy,
    failedJobs,
  });

  const attentionItems: Array<{ title: string; severity: "low" | "medium" | "high" | "critical"; actionHref: string; detail: string }> = [];

  if (!lastBackup) {
    attentionItems.push({
      title: "No restore point available",
      severity: "critical",
      actionHref: "/watchdog/backups",
      detail: "Run a full platform backup before any production-risk operation.",
    });
  }

  if (latestVerification?.status === "FAILED") {
    attentionItems.push({
      title: "Latest backup verification failed",
      severity: "high",
      actionHref: "/watchdog/backups",
      detail: "Re-run verification and investigate checksum mismatch before restore use.",
    });
  }

  if (!hasEnabledPolicy) {
    attentionItems.push({
      title: "No enabled backup policies",
      severity: "high",
      actionHref: "/watchdog/settings",
      detail: "Configure recurring backups to avoid manual-only reliability.",
    });
  }

  if (permissionRiskWarnings > 0) {
    attentionItems.push({
      title: "Break-glass access exists",
      severity: "medium",
      actionHref: "/watchdog/security",
      detail: `${permissionRiskWarnings} user permission override(s) can bypass failed verification restore blocks.`,
    });
  }

  if (unresolvedIncidentCount > 0) {
    attentionItems.push({
      title: "Unresolved incident activity",
      severity: unresolvedIncidentCount > 3 ? "high" : "medium",
      actionHref: "/watchdog/security",
      detail: `${unresolvedIncidentCount} incident(s) require acknowledgement or resolution in the security feed.`,
    });
  }

  res.json({
    overview: {
      systemHealth: watchdogHealth.connected ? "Working" : "Broken",
      lastSuccessfulBackup: lastBackup,
      nextScheduledBackup: hasEnabledPolicy ? policies.find((policy) => policy.enabled) ?? null : null,
      backupVerificationStatus: latestVerification?.status ?? "Not Implemented",
      restoreReadinessScore,
      openIncidents: unresolvedIncidentCount,
      failedJobs,
      securityWarnings: securityWarningCount,
      vaultHealth: watchdogHealth.encryptionReady ? "Working" : "Broken",
      permissionRiskWarnings,
      backgroundJobStatus: restoreJobs.length > 0 ? "Partially Working" : "Not Implemented",
      databaseStatus: watchdogHealth.connected ? "Working" : "Partially Working",
      storageStatus: isWatchdogDbConfigured() ? "Working" : "Broken",
      environmentStatus: isWatchdogEncryptionConfigured() ? "Working" : "Partially Working",
      externalStoreWarning,
    },
    attentionItems,
    recentAuditEvents: recentAuditEvents.map((event) => ({
      id: event.id,
      action: event.action,
      entity: event.entity,
      userId: event.userId,
      severity: severityFromAction(event.action),
      sourceModule: sourceModuleFromAudit(event.action, event.entity),
      createdAt: event.createdAt.toISOString(),
      metadata: event.metadata,
    })),
    settings: settings ?? DEFAULT_WATCHDOG_SETTINGS,
  });
});

/** GET /api/watchdog/ops/backups/coverage - scope availability and implementation status. */
router.get("/ops/backups/coverage", requirePermission("watchdog.backups.view"), async (_req, res) => {
  res.json({
    scopes: [
      {
        scope: "FULL_PLATFORM",
        label: "Full platform backup",
        status: "Working",
        implemented: true,
      },
      {
        scope: "DATABASE",
        label: "Database backup",
        status: "Working",
        implemented: true,
      },
      {
        scope: "FILES_MEDIA",
        label: "File/media backup",
        status: "Partially Working",
        implemented: false,
        reason: "Storage archive hooks are planned but not yet wired in this pass.",
      },
      {
        scope: "CONFIGURATION",
        label: "Configuration backup",
        status: "Partially Working",
        implemented: false,
        reason: "Configuration persistence export is not fully implemented yet.",
      },
      {
        scope: "ENVIRONMENT_MANIFEST",
        label: "Environment manifest backup",
        status: "Working",
        implemented: true,
      },
      {
        scope: "MODULE",
        label: "Module-specific backup",
        status: "Partially Working",
        implemented: false,
        reason: "Module selective backups are planned; full/dataset backup is currently available.",
      },
    ],
    moduleScopes: MODULE_SCOPES,
  });
});

/** GET /api/watchdog/ops/backups/policies - list backup policies. */
router.get("/ops/backups/policies", requirePermission("watchdog.backups.view"), async (req, res) => {
  const organizationId = req.user!.orgId;

  try {
    const items = await listWatchdogBackupPolicies(organizationId);
    res.json({ items });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** POST /api/watchdog/ops/backups/policies - create backup policy. */
router.post("/ops/backups/policies", requirePermission("watchdog.backups.create"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as {
    policyName?: string;
    backupScope?: string;
    moduleScope?: string | null;
    cronExpression?: string;
    retentionDays?: number;
    storageTarget?: string;
    encrypted?: boolean;
    enabled?: boolean;
    notes?: string | null;
  };

  if (!body.policyName || !body.backupScope || !body.cronExpression) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_POLICY_VALIDATION",
        message: "policyName, backupScope, and cronExpression are required.",
      },
    });
    return;
  }

  if (!isBackupScope(body.backupScope)) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_POLICY_SCOPE_INVALID",
        message: `Unsupported backupScope: ${body.backupScope}`,
      },
    });
    return;
  }

  try {
    const item = await createWatchdogBackupPolicy({
      organizationId,
      createdBy: userId,
      policyName: body.policyName.trim(),
      backupScope: body.backupScope,
      moduleScope: body.moduleScope?.trim() ? body.moduleScope.trim() : null,
      cronExpression: body.cronExpression.trim(),
      retentionDays: Math.min(Math.max(Number(body.retentionDays ?? 30), 1), 3650),
      storageTarget: body.storageTarget?.trim() || "watchdog-default",
      encrypted: body.encrypted !== false,
      enabled: body.enabled !== false,
      notes: body.notes ?? null,
    });

    await logAudit({
      action: "WATCHDOG_BACKUP_POLICY_CREATED",
      entity: "WatchdogBackupPolicy",
      entityId: item.id,
      userId,
      organizationId,
      metadata: {
        policyName: item.policyName,
        backupScope: item.backupScope,
        cronExpression: item.cronExpression,
      },
    });

    res.status(201).json({ item });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** PATCH /api/watchdog/ops/backups/policies/:id - update policy. */
router.patch("/ops/backups/policies/:id", requirePermission("watchdog.settings.manage"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const id = String(req.params.id ?? "");

  const body = req.body as {
    policyName?: string;
    backupScope?: string;
    moduleScope?: string | null;
    cronExpression?: string;
    retentionDays?: number;
    storageTarget?: string;
    encrypted?: boolean;
    enabled?: boolean;
    notes?: string | null;
  };

  if (body.backupScope && !isBackupScope(body.backupScope)) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_POLICY_SCOPE_INVALID",
        message: `Unsupported backupScope: ${body.backupScope}`,
      },
    });
    return;
  }

  const normalizedBackupScope = body.backupScope && isBackupScope(body.backupScope)
    ? body.backupScope
    : undefined;

  try {
    const item = await updateWatchdogBackupPolicy({
      organizationId,
      id,
      updatedBy: userId,
      policyName: body.policyName?.trim(),
      backupScope: normalizedBackupScope,
      moduleScope: body.moduleScope,
      cronExpression: body.cronExpression?.trim(),
      retentionDays: body.retentionDays,
      storageTarget: body.storageTarget?.trim(),
      encrypted: body.encrypted,
      enabled: body.enabled,
      notes: body.notes,
    });

    if (!item) {
      res.status(404).json({
        error: {
          code: "WATCHDOG_POLICY_NOT_FOUND",
          message: "Backup policy not found.",
        },
      });
      return;
    }

    await logAudit({
      action: "WATCHDOG_BACKUP_POLICY_UPDATED",
      entity: "WatchdogBackupPolicy",
      entityId: item.id,
      userId,
      organizationId,
      metadata: {
        policyName: item.policyName,
        backupScope: item.backupScope,
      },
    });

    res.json({ item });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** DELETE /api/watchdog/ops/backups/policies/:id - delete policy with permission guard. */
router.delete("/ops/backups/policies/:id", requirePermission("watchdog.backups.delete"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const id = String(req.params.id ?? "");

  try {
    const deleted = await deleteWatchdogBackupPolicy({ organizationId, id });
    if (!deleted) {
      res.status(404).json({
        error: {
          code: "WATCHDOG_POLICY_NOT_FOUND",
          message: "Backup policy not found.",
        },
      });
      return;
    }

    await logAudit({
      action: "WATCHDOG_BACKUP_POLICY_DELETED",
      entity: "WatchdogBackupPolicy",
      entityId: id,
      userId,
      organizationId,
    });

    res.json({ success: true });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** POST /api/watchdog/ops/backups/environment-manifest - redacted env manifest backup helper. */
router.post("/ops/backups/environment-manifest", requirePermission("watchdog.backups.create"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;

  const envKeys = Object.keys(process.env).sort();
  const entries = envKeys.map((key) => ({
    key,
    present: Boolean(process.env[key]),
    value: process.env[key] ? "***redacted***" : null,
  }));

  const manifest = {
    manifestType: "ENVIRONMENT_MANIFEST",
    generatedAt: new Date().toISOString(),
    generatedBy: userId,
    organizationId,
    entryCount: entries.length,
    entries,
  };

  await logAudit({
    action: "WATCHDOG_ENVIRONMENT_MANIFEST_CREATED",
    entity: "WatchdogBackupManifest",
    entityId: `manifest-${Date.now()}`,
    userId,
    organizationId,
    metadata: {
      manifestType: manifest.manifestType,
      entryCount: manifest.entryCount,
    },
  });

  res.status(201).json({ manifest });
});

/** GET /api/watchdog/ops/backups/verifications - list verification results. */
router.get("/ops/backups/verifications", requirePermission("watchdog.backups.view"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const backupId = typeof req.query.backupId === "string" ? req.query.backupId : undefined;

  try {
    const items = await listWatchdogBackupVerifications({ organizationId, backupId, limit: 250 });
    res.json({ items });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** POST /api/watchdog/ops/backups/verify - verify backup shape/checksum and persist status. */
router.post("/ops/backups/verify", requirePermission("watchdog.backups.create"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as { backupId?: string };

  if (!body.backupId) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_BACKUP_VERIFY_VALIDATION",
        message: "backupId is required.",
      },
    });
    return;
  }

  let record: Awaited<ReturnType<typeof getWatchdogCrmBackup>>;
  try {
    record = await getWatchdogCrmBackup({ organizationId, id: body.backupId });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  if (!record) {
    res.status(404).json({
      error: {
        code: "WATCHDOG_BACKUP_NOT_FOUND",
        message: "Backup not found.",
      },
    });
    return;
  }

  let verification: Awaited<ReturnType<typeof createWatchdogBackupVerification>>;
  try {
    verification = await createWatchdogBackupVerification({
      organizationId,
      backupId: record.id,
      status: "RUNNING",
      verifiedBy: userId,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  let finalStatus: "VERIFIED" | "FAILED" = "FAILED";
  let checksumMatches = false;
  let details: Record<string, unknown> = {
    backupId: record.id,
    schemaValid: false,
  };
  let errorMessage: string | null = null;

  try {
    const parsed = JSON.parse(record.backupJson) as unknown;
    const schemaValid = isCrmBackupBundle(parsed);
    const checksum = createHash("sha256").update(record.backupJson).digest("hex");
    checksumMatches = checksum === record.checksumSha256;

    details = {
      backupId: record.id,
      schemaValid,
      checksumMatches,
      primaryRowCount: record.primaryRowCount,
      watchdogRowCount: record.watchdogRowCount,
      hasSqlDump: schemaValid ? parsed.sqlDump.length > 0 : false,
    };

    finalStatus = schemaValid && checksumMatches ? "VERIFIED" : "FAILED";
    if (!schemaValid) {
      errorMessage = "Backup payload shape is invalid.";
    } else if (!checksumMatches) {
      errorMessage = "Checksum mismatch detected.";
    }
  } catch (error) {
    finalStatus = "FAILED";
    errorMessage = error instanceof Error ? error.message : "Backup verification failed.";
    details = {
      backupId: record.id,
      schemaValid: false,
      checksumMatches: false,
    };
  }

  let updated: Awaited<ReturnType<typeof updateWatchdogBackupVerification>>;
  try {
    updated = await updateWatchdogBackupVerification({
      organizationId,
      id: verification.id,
      status: finalStatus,
      checksumMatches,
      details,
      errorMessage,
      verifiedBy: userId,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  await logAudit({
    action: finalStatus === "VERIFIED" ? "WATCHDOG_BACKUP_VERIFIED" : "WATCHDOG_BACKUP_VERIFY_FAILED",
    entity: "WatchdogBackupVerification",
    entityId: String(verification.id),
    userId,
    organizationId,
    metadata: {
      backupId: record.id,
      finalStatus,
      checksumMatches,
      errorMessage,
    },
  });

  try {
    await recordWatchdogSecurityEvent({
      organizationId,
      severity: finalStatus === "VERIFIED" ? "low" : "high",
      eventType: finalStatus === "VERIFIED" ? "WATCHDOG_BACKUP_VERIFIED" : "WATCHDOG_BACKUP_VERIFY_FAILED",
      sourceModule: "watchdog",
      message: finalStatus === "VERIFIED"
        ? `Backup ${record.id} verified successfully.`
        : `Backup ${record.id} failed verification.`,
      payload: {
        backupId: record.id,
        verificationId: verification.id,
        checksumMatches,
        errorMessage,
      },
    });
  } catch {
    // Verification result still stands even if external event logging fails.
  }

  res.json({ item: updated ?? verification });
});

/** GET /api/watchdog/ops/restore/points - list restore points with verification linkage. */
router.get("/ops/restore/points", requirePermission("watchdog.restore.view"), async (req, res) => {
  const organizationId = req.user!.orgId;

  try {
    const [backups, verifications] = await Promise.all([
      listWatchdogCrmBackups({ organizationId, limit: 100 }),
      listWatchdogBackupVerifications({ organizationId, limit: 400 }),
    ]);

    const latestVerificationByBackup = new Map<string, Awaited<ReturnType<typeof listWatchdogBackupVerifications>>[number]>();
    verifications.forEach((verification) => {
      if (!latestVerificationByBackup.has(verification.backupId)) {
        latestVerificationByBackup.set(verification.backupId, verification);
      }
    });

    const points = backups.map((backup) => {
      const verification = latestVerificationByBackup.get(backup.id) ?? null;
      const verificationStatus = verification?.status ?? "Not Implemented";
      const blockedReason = verification?.status === "FAILED"
        ? "Verification failed. Break-glass permission is required to proceed."
        : null;

      return {
        ...backup,
        verification,
        verificationStatus,
        blockedReason,
      };
    });

    res.json({ points });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** POST /api/watchdog/ops/restore/dry-run - generate restore risk report before execution. */
router.post("/ops/restore/dry-run", requirePermission("watchdog.restore.dry_run"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as { backupId?: string };

  if (!body.backupId) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_RESTORE_DRY_RUN_VALIDATION",
        message: "backupId is required.",
      },
    });
    return;
  }

  let record: Awaited<ReturnType<typeof getWatchdogCrmBackup>>;
  try {
    record = await getWatchdogCrmBackup({ organizationId, id: body.backupId });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  if (!record) {
    res.status(404).json({
      error: {
        code: "WATCHDOG_BACKUP_NOT_FOUND",
        message: "Backup not found.",
      },
    });
    return;
  }

  const warnings: string[] = [
    "Executing restore will overwrite current primary CRM data.",
    "Pre-restore backup will be created automatically before execution.",
    "Dry-run output must be reviewed before execute is enabled.",
  ];

  let dryRunStatus: "DRY_RUN_PASSED" | "DRY_RUN_FAILED" = "DRY_RUN_PASSED";
  let riskLevel: RestoreRiskLevel = "high";
  let overwriteSummary: Record<string, unknown> = {
    backupId: record.id,
    primaryTableCount: record.primaryTableCount,
    primaryRowCount: record.primaryRowCount,
    watchdogTableCount: record.watchdogTableCount,
    watchdogRowCount: record.watchdogRowCount,
    overwriteRisk: "Restore will replace current persisted rows with backup snapshot rows.",
  };

  const latestVerification = await getLatestWatchdogBackupVerification({
    organizationId,
    backupId: record.id,
  });

  if (latestVerification?.status === "FAILED") {
    dryRunStatus = "DRY_RUN_FAILED";
    riskLevel = "critical";
    warnings.push("Latest verification failed. Restore execution is blocked unless break-glass permission is used.");
  }

  let parsedBundle: unknown = null;
  try {
    parsedBundle = JSON.parse(record.backupJson);
    if (!isCrmBackupBundle(parsedBundle)) {
      dryRunStatus = "DRY_RUN_FAILED";
      riskLevel = "critical";
      warnings.push("Backup payload shape is invalid.");
    }
  } catch {
    dryRunStatus = "DRY_RUN_FAILED";
    riskLevel = "critical";
    warnings.push("Backup payload could not be parsed.");
    overwriteSummary = {
      ...overwriteSummary,
      parseError: true,
    };
  }

  let dryRun: Awaited<ReturnType<typeof createWatchdogRestoreDryRun>>;
  try {
    dryRun = await createWatchdogRestoreDryRun({
      organizationId,
      backupId: record.id,
      status: dryRunStatus,
      riskLevel,
      overwriteSummary,
      warnings,
      requestedBy: userId,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  await logAudit({
    action: dryRunStatus === "DRY_RUN_PASSED" ? "WATCHDOG_RESTORE_DRY_RUN_PASSED" : "WATCHDOG_RESTORE_DRY_RUN_FAILED",
    entity: "WatchdogRestoreDryRun",
    entityId: dryRun.id,
    userId,
    organizationId,
    metadata: {
      backupId: record.id,
      riskLevel,
      warnings,
      verificationStatus: latestVerification?.status ?? null,
    },
  });

  res.status(201).json({ dryRun, latestVerification });
});

/** GET /api/watchdog/ops/restore/jobs - list restore execution jobs. */
router.get("/ops/restore/jobs", requirePermission("watchdog.restore.view"), async (req, res) => {
  const organizationId = req.user!.orgId;

  try {
    const items = await listWatchdogRestoreJobs({ organizationId, limit: 120 });
    res.json({ items });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** POST /api/watchdog/ops/restore/execute - guarded restore execution with mandatory confirmation flow. */
router.post("/ops/restore/execute", requirePermission("watchdog.restore.execute"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as {
    backupId?: string;
    dryRunId?: string;
    confirmationText?: string;
    reason?: string;
    breakGlass?: boolean;
    execute?: boolean;
  };

  if (!body.backupId || !body.dryRunId || !body.confirmationText || !body.reason) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_RESTORE_EXECUTE_VALIDATION",
        message: "backupId, dryRunId, confirmationText, and reason are required.",
      },
    });
    return;
  }

  if (body.execute !== true) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_RESTORE_EXECUTE_CONFIRM",
        message: "execute must be true for restore execution requests.",
      },
    });
    return;
  }

  let backupRecord: Awaited<ReturnType<typeof getWatchdogCrmBackup>>;
  try {
    backupRecord = await getWatchdogCrmBackup({ organizationId, id: body.backupId });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  if (!backupRecord) {
    res.status(404).json({
      error: {
        code: "WATCHDOG_BACKUP_NOT_FOUND",
        message: "Backup not found.",
      },
    });
    return;
  }

  const normalizedConfirmation = body.confirmationText.trim();
  if (normalizedConfirmation !== backupRecord.label && normalizedConfirmation !== backupRecord.id) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_RESTORE_CONFIRMATION_MISMATCH",
        message: "Confirmation text must match restore point label or ID.",
      },
    });
    return;
  }

  let dryRun: Awaited<ReturnType<typeof getWatchdogRestoreDryRun>>;
  try {
    dryRun = await getWatchdogRestoreDryRun({ organizationId, id: body.dryRunId });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  if (!dryRun || dryRun.backupId !== backupRecord.id) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_RESTORE_DRY_RUN_INVALID",
        message: "Dry-run record is missing or does not match selected restore point.",
      },
    });
    return;
  }

  if (dryRun.status !== "DRY_RUN_PASSED") {
    res.status(409).json({
      error: {
        code: "WATCHDOG_RESTORE_DRY_RUN_REQUIRED",
        message: "Restore execution requires a passing dry-run result.",
      },
    });
    return;
  }

  const latestVerification = await getLatestWatchdogBackupVerification({
    organizationId,
    backupId: backupRecord.id,
  });

  const breakGlassAllowed = await hasPermission(req, "watchdog.restore.break_glass");
  const breakGlassRequested = Boolean(body.breakGlass);

  if (latestVerification?.status === "FAILED" && !(breakGlassAllowed && breakGlassRequested)) {
    res.status(409).json({
      error: {
        code: "WATCHDOG_RESTORE_VERIFICATION_BLOCKED",
        message: "Backup verification failed. Break-glass permission + request is required to continue.",
      },
    });
    return;
  }

  let backupBundle: CrmBackupBundle;
  try {
    const parsed = JSON.parse(backupRecord.backupJson) as unknown;
    if (!isCrmBackupBundle(parsed)) {
      res.status(400).json({
        error: {
          code: "WATCHDOG_BACKUP_INVALID_SHAPE",
          message: "Selected backup payload shape is invalid.",
        },
      });
      return;
    }
    backupBundle = parsed;
  } catch {
    res.status(400).json({
      error: {
        code: "WATCHDOG_BACKUP_CORRUPT",
        message: "Selected backup payload cannot be parsed.",
      },
    });
    return;
  }

  let preRestoreBackupId: string | null = null;
  let restoreJob: Awaited<ReturnType<typeof createWatchdogRestoreJob>>;

  try {
    const appInfo = getAppInfo();
    const preRestoreBundle = await exportFullCrmBackup({
      organizationId,
      generatedBy: userId,
      appVersion: appInfo.version,
      includeWatchdogDatabase: true,
    });

    const preRestoreRecord = await createWatchdogCrmBackup({
      organizationId,
      label: `pre-restore-${backupRecord.id}-${new Date().toISOString()}`,
      sourceVersion: preRestoreBundle.appVersion,
      primaryTableCount: preRestoreBundle.primaryDatabase.tableCount,
      primaryRowCount: preRestoreBundle.primaryDatabase.rowCount,
      watchdogTableCount: preRestoreBundle.watchdogDatabase?.tableCount ?? 0,
      watchdogRowCount: preRestoreBundle.watchdogDatabase?.rowCount ?? 0,
      backupJson: JSON.stringify(preRestoreBundle),
      createdBy: userId,
    });

    preRestoreBackupId = preRestoreRecord.id;

    restoreJob = await createWatchdogRestoreJob({
      organizationId,
      backupId: backupRecord.id,
      dryRunId: dryRun.id,
      status: "RUNNING",
      riskLevel: dryRun.riskLevel,
      breakGlassUsed: latestVerification?.status === "FAILED" ? breakGlassRequested : false,
      preRestoreBackupId,
      requestedBy: userId,
      reason: body.reason,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  try {
    const report = await restoreFullCrmBackup({
      bundle: backupBundle,
      includeWatchdogDatabase: true,
    });

    await Promise.all([
      updateWatchdogRestoreJob({
        organizationId,
        id: restoreJob.id,
        status: "COMPLETED",
        preRestoreBackupId,
        report: report as unknown as Record<string, unknown>,
        errorMessage: null,
      }),
      markWatchdogCrmBackupRestored({ organizationId, id: backupRecord.id }),
    ]);

    await logAudit({
      action: "WATCHDOG_RESTORE_EXECUTED",
      entity: "WatchdogRestoreJob",
      entityId: restoreJob.id,
      userId,
      organizationId,
      metadata: {
        backupId: backupRecord.id,
        dryRunId: dryRun.id,
        preRestoreBackupId,
        breakGlassUsed: latestVerification?.status === "FAILED" ? breakGlassRequested : false,
        reason: body.reason,
        report,
      },
    });

    try {
      await recordWatchdogSecurityEvent({
        organizationId,
        severity: latestVerification?.status === "FAILED" ? "critical" : "high",
        eventType: "WATCHDOG_RESTORE_EXECUTED",
        sourceModule: "watchdog",
        message: `Restore executed from backup ${backupRecord.id}.`,
        payload: {
          restoreJobId: restoreJob.id,
          dryRunId: dryRun.id,
          preRestoreBackupId,
        },
      });
    } catch {
      // Restore already completed; event write failure should not roll back API response.
    }

    res.status(201).json({
      success: true,
      restoreJobId: restoreJob.id,
      preRestoreBackupId,
      report,
    });
  } catch (error) {
    await updateWatchdogRestoreJob({
      organizationId,
      id: restoreJob.id,
      status: "FAILED",
      preRestoreBackupId,
      errorMessage: error instanceof Error ? error.message : "Restore execution failed.",
    });

    await logAudit({
      action: "WATCHDOG_RESTORE_FAILED",
      entity: "WatchdogRestoreJob",
      entityId: restoreJob.id,
      userId,
      organizationId,
      metadata: {
        backupId: backupRecord.id,
        dryRunId: dryRun.id,
        preRestoreBackupId,
        reason: body.reason,
        error: error instanceof Error ? error.message : "Unknown restore error",
      },
    });

    res.status(500).json({
      error: {
        code: "WATCHDOG_RESTORE_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : "Restore execution failed.",
      },
    });
  }
});

/** GET /api/watchdog/ops/vault/access-events - list vault reveal/copy/rotate history. */
router.get("/ops/vault/access-events", requirePermission("watchdog.audit.view"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const vaultEntryId = typeof req.query.vaultEntryId === "string" ? req.query.vaultEntryId : undefined;

  try {
    const items = await listWatchdogVaultAccessEvents({
      organizationId,
      vaultEntryId,
      limit: parseBoundedNumber(req.query.limit, 150, 1, 500),
    });
    res.json({ items });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** POST /api/watchdog/ops/vault/:id/reveal - audited secret reveal operation. */
router.post("/ops/vault/:id/reveal", requirePermission("watchdog.vault.reveal"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const id = String(req.params.id ?? "");
  const body = req.body as { reason?: string };

  let item: Awaited<ReturnType<typeof getWatchdogVaultEntry>>;
  try {
    item = await getWatchdogVaultEntry({ organizationId, id, revealSecret: true });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  if (!item || !item.password) {
    res.status(404).json({
      error: {
        code: "WATCHDOG_VAULT_NOT_FOUND",
        message: "Vault entry not found.",
      },
    });
    return;
  }

  try {
    await recordWatchdogVaultAccessEvent({
      organizationId,
      vaultEntryId: id,
      accessType: "reveal",
      accessedBy: userId,
      reason: body.reason,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  await logAudit({
    action: "WATCHDOG_VAULT_SECRET_REVEALED",
    entity: "WatchdogVaultEntry",
    entityId: id,
    userId,
    organizationId,
    metadata: {
      reason: body.reason ?? null,
    },
  });

  res.json({ item });
});

/** POST /api/watchdog/ops/vault/:id/copy - audited copy-intent operation returning secret value. */
router.post("/ops/vault/:id/copy", requirePermission("watchdog.vault.copy"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const id = String(req.params.id ?? "");
  const body = req.body as { reason?: string };

  let item: Awaited<ReturnType<typeof getWatchdogVaultEntry>>;
  try {
    item = await getWatchdogVaultEntry({ organizationId, id, revealSecret: true });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  if (!item || !item.password) {
    res.status(404).json({
      error: {
        code: "WATCHDOG_VAULT_NOT_FOUND",
        message: "Vault entry not found.",
      },
    });
    return;
  }

  try {
    await recordWatchdogVaultAccessEvent({
      organizationId,
      vaultEntryId: id,
      accessType: "copy",
      accessedBy: userId,
      reason: body.reason,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  await logAudit({
    action: "WATCHDOG_VAULT_SECRET_COPIED",
    entity: "WatchdogVaultEntry",
    entityId: id,
    userId,
    organizationId,
    metadata: {
      reason: body.reason ?? null,
    },
  });

  res.json({ item });
});

/** PATCH /api/watchdog/ops/vault/:id - metadata edits + secret rotation via encrypted payload update. */
router.patch("/ops/vault/:id", requirePermission("watchdog.vault.edit"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const id = String(req.params.id ?? "");
  const body = req.body as {
    name?: string;
    category?: string;
    username?: string | null;
    website?: string | null;
    notes?: string;
    password?: string;
    metadata?: Record<string, unknown>;
  };

  let item: Awaited<ReturnType<typeof updateWatchdogVaultEntry>>;
  try {
    item = await updateWatchdogVaultEntry({
      organizationId,
      id,
      updatedBy: userId,
      name: body.name,
      category: body.category,
      username: body.username,
      website: body.website,
      notes: body.notes,
      password: body.password,
      metadata: body.metadata,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  if (!item) {
    res.status(404).json({
      error: {
        code: "WATCHDOG_VAULT_NOT_FOUND",
        message: "Vault entry not found.",
      },
    });
    return;
  }

  if (body.password) {
    try {
      await recordWatchdogVaultAccessEvent({
        organizationId,
        vaultEntryId: id,
        accessType: "rotate",
        accessedBy: userId,
        reason: "Secret rotated via Watchdog Vault workspace.",
      });
    } catch (error) {
      watchdogStoreUnavailable(res, error);
      return;
    }
  }

  await logAudit({
    action: body.password ? "WATCHDOG_VAULT_SECRET_ROTATED" : "WATCHDOG_VAULT_ENTRY_UPDATED",
    entity: "WatchdogVaultEntry",
    entityId: id,
    userId,
    organizationId,
    metadata: {
      category: item.category,
      hasSecretRotation: Boolean(body.password),
    },
  });

  res.json({ item });
});

/** GET /api/watchdog/ops/security/summary - permission and security risk dashboard data. */
router.get("/ops/security/summary", requirePermission("watchdog.security.view"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [adminAccounts, recentFailedLogins, recentAudit, breakGlassGrants, vaultAccessEvents] = await Promise.all([
    prisma.user.count({
      where: {
        organizationId,
        role: "admin",
        active: true,
      },
    }),
    prisma.auditLog.count({
      where: {
        organizationId,
        createdAt: { gte: twentyFourHoursAgo },
        action: { contains: "LOGIN_FAILED" },
      },
    }),
    prisma.auditLog.findMany({
      where: {
        organizationId,
        createdAt: { gte: twentyFourHoursAgo },
      },
      orderBy: { createdAt: "desc" },
      take: 120,
      select: {
        id: true,
        action: true,
        entity: true,
        userId: true,
        createdAt: true,
      },
    }),
    prisma.userPermission.count({
      where: {
        permission: "watchdog.restore.break_glass",
        granted: true,
        user: {
          organizationId,
        },
      },
    }),
    listWatchdogVaultAccessEvents({ organizationId, limit: 250 }),
  ]);

  let secretsNeedingRotation = 0;
  let vaultState: "Working" | "Broken" | "Partially Working" = "Working";

  try {
    const vaultEntries = await listWatchdogVaultEntries(organizationId);
    const checks = await Promise.all(
      vaultEntries.slice(0, 80).map(async (entry) => {
        const full = await getWatchdogVaultEntry({
          organizationId,
          id: entry.id,
          revealSecret: true,
        });
        const metadata = full?.metadata ?? {};
        return Boolean(
          metadata &&
          typeof metadata === "object" &&
          (metadata.needsRotation === true || metadata.status === "expired"),
        );
      }),
    );
    secretsNeedingRotation = checks.filter(Boolean).length;
  } catch {
    vaultState = "Partially Working";
  }

  const suspiciousAccess = recentAudit.filter((event) => {
    const severity = severityFromAction(event.action);
    return severity === "high" || severity === "critical";
  }).length;

  const recentCopyOrReveal = vaultAccessEvents.filter((event) => {
    return event.accessType === "copy" || event.accessType === "reveal";
  }).length;

  res.json({
    summary: {
      permissionRisks: breakGlassGrants,
      adminAccounts,
      usersWithoutMfa: null,
      recentFailedLogins,
      suspiciousAccess,
      secretsNeedingRotation,
      publicEndpoints: null,
      rateLimitStatus: "Partially Working",
      webhookSignatureStatus: "Not Implemented",
      backupEncryptionStatus: isWatchdogEncryptionConfigured() ? "Working" : "Broken",
      workspaceBoundaryWarnings: 0,
      privacyBoundaryWarnings: 0,
      recentVaultSensitiveAccessEvents: recentCopyOrReveal,
      vaultState,
    },
    checks: [
      {
        key: "permission-risks",
        label: "Permission Risks",
        status: breakGlassGrants > 0 ? "Partially Working" : "Working",
        detail: `${breakGlassGrants} break-glass grant override(s) are active.`,
      },
      {
        key: "mfa-coverage",
        label: "MFA Coverage",
        status: "Not Implemented",
        detail: "User MFA telemetry is not yet wired to Watchdog security checks.",
      },
      {
        key: "rate-limit",
        label: "Rate-limit Status",
        status: "Partially Working",
        detail: "Auth endpoints include protection, but consolidated Watchdog rate-limit analytics are not complete.",
      },
      {
        key: "privacy-boundary",
        label: "Donor/Client Privacy Boundary",
        status: "Partially Working",
        detail: "Boundary checks rely on audit review; automated violation detection is still in progress.",
      },
    ],
  });
});

/** GET /api/watchdog/ops/health - platform service readiness checks. */
router.get("/ops/health", requirePermission("watchdog.view"), async (_req, res) => {
  const checks: Array<{
    key: string;
    label: string;
    status: "Working" | "Partially Working" | "Broken" | "Not Implemented";
    detail: string;
    checkedAt: string;
  }> = [];

  const checkedAt = new Date().toISOString();

  checks.push({
    key: "web-app",
    label: "Web App Health",
    status: "Working",
    detail: "Watchdog API is reachable through authenticated route execution.",
    checkedAt,
  });

  try {
    await prisma.$queryRaw(Prisma.sql`SELECT 1`);
    checks.push({
      key: "primary-db",
      label: "Primary Database Health",
      status: "Working",
      detail: "Primary database connectivity check passed.",
      checkedAt,
    });
  } catch (error) {
    checks.push({
      key: "primary-db",
      label: "Primary Database Health",
      status: "Broken",
      detail: error instanceof Error ? error.message : "Primary database check failed.",
      checkedAt,
    });
  }

  const watchdogHealth = await getWatchdogHealth();
  checks.push({
    key: "watchdog-db",
    label: "Watchdog Store Health",
    status: watchdogHealth.connected ? "Working" : (watchdogHealth.configured ? "Partially Working" : "Broken"),
    detail: watchdogHealth.message,
    checkedAt,
  });

  checks.push({
    key: "worker-queue",
    label: "Worker/Queue Health",
    status: "Not Implemented",
    detail: "Dedicated queue health telemetry is not wired into Watchdog yet.",
    checkedAt,
  });

  checks.push({
    key: "storage",
    label: "Backup Storage Readiness",
    status: isWatchdogDbConfigured() ? "Working" : "Broken",
    detail: isWatchdogDbConfigured()
      ? "Watchdog storage connection is configured."
      : "Watchdog storage configuration is missing.",
    checkedAt,
  });

  checks.push({
    key: "email-provider",
    label: "Email Provider Readiness",
    status: process.env.SMTP_HOST ? "Partially Working" : "Not Implemented",
    detail: process.env.SMTP_HOST
      ? "SMTP host is configured; end-to-end provider diagnostics are still partial."
      : "SMTP provider settings are not configured in this environment.",
    checkedAt,
  });

  checks.push({
    key: "ai-provider",
    label: "AI Provider Readiness",
    status: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY ? "Partially Working" : "Not Implemented",
    detail: process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
      ? "At least one AI provider key is configured; active liveness probes are not yet implemented."
      : "No AI provider key detected in environment variables.",
    checkedAt,
  });

  checks.push({
    key: "prisma-migration",
    label: "Prisma/Migration Status",
    status: "Partially Working",
    detail: "Runtime migration drift detection is not implemented; use release readiness validation lanes.",
    checkedAt,
  });

  const appInfo = getAppInfo();

  checks.push({
    key: "build-metadata",
    label: "Build Metadata",
    status: "Working",
    detail: `Version ${appInfo.version} (${appInfo.environment}) built at ${appInfo.buildDate}.`,
    checkedAt,
  });

  res.json({
    checks,
    summary: {
      healthy: checks.filter((check) => check.status === "Working").length,
      partial: checks.filter((check) => check.status === "Partially Working").length,
      broken: checks.filter((check) => check.status === "Broken").length,
      notImplemented: checks.filter((check) => check.status === "Not Implemented").length,
    },
  });
});

/** GET /api/watchdog/ops/audit - consolidated filterable operations audit feed. */
router.get("/ops/audit", requirePermission("watchdog.audit.view"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const page = parseBoundedNumber(req.query.page, 1, 1, 9999);
  const limit = parseBoundedNumber(req.query.limit, 50, 1, 200);
  const dateFrom = parseOptionalDate(req.query.dateFrom);
  const dateTo = parseOptionalDate(req.query.dateTo);

  const eventType = typeof req.query.eventType === "string" ? req.query.eventType.trim() : "";
  const userFilter = typeof req.query.user === "string" ? req.query.user.trim() : "";
  const severityFilter = typeof req.query.severity === "string" ? req.query.severity.trim().toLowerCase() : "";
  const moduleFilter = typeof req.query.module === "string" ? req.query.module.trim().toLowerCase() : "";
  const entityFilter = typeof req.query.entity === "string" ? req.query.entity.trim() : "";

  const where: Prisma.AuditLogWhereInput = {
    organizationId,
    ...(eventType ? { action: { contains: eventType } } : {}),
    ...(userFilter ? { userId: userFilter } : {}),
    ...(entityFilter ? { entity: { contains: entityFilter } } : {}),
    ...(dateFrom || dateTo
      ? {
        createdAt: {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        },
      }
      : {}),
  };

  const rows = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: Math.min(limit * 4, 800),
    select: {
      id: true,
      action: true,
      entity: true,
      entityId: true,
      userId: true,
      metadata: true,
      createdAt: true,
    },
  });

  const filtered = rows
    .map((row) => {
      const severity = severityFromAction(row.action);
      const sourceModule = sourceModuleFromAudit(row.action, row.entity);
      return {
        id: row.id,
        action: row.action,
        entity: row.entity,
        entityId: row.entityId,
        userId: row.userId,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
        severity,
        module: sourceModule,
      };
    })
    .filter((entry) => {
      if (severityFilter && entry.severity !== severityFilter) return false;
      if (moduleFilter && entry.module !== moduleFilter) return false;
      return true;
    });

  const total = filtered.length;
  const start = (page - 1) * limit;
  const items = filtered.slice(start, start + limit);

  res.json({
    items,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  });
});

/** GET /api/watchdog/ops/runbooks - recovery runbook catalog. */
router.get("/ops/runbooks", requirePermission("watchdog.view"), async (_req, res) => {
  res.json({
    items: WATCHDOG_RUNBOOKS,
    status: "Partially Working",
    note: "Runbooks are fully visible in Watchdog and intended for operational execution. Template edit workflows are not implemented in this pass.",
  });
});

/** GET /api/watchdog/ops/settings - persisted watchdog policy/settings payload. */
router.get("/ops/settings", requirePermission("watchdog.view"), async (req, res) => {
  const organizationId = req.user!.orgId;

  try {
    const settings = await getWatchdogSettings(organizationId);
    res.json({ settings: settings ?? DEFAULT_WATCHDOG_SETTINGS });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** GET /api/watchdog/ops/database-config - masked DB/env settings for watchdog administrators. */
router.get("/ops/database-config", requirePermission("watchdog.settings.manage"), async (_req, res) => {
  const health = await getWatchdogHealth();
  const warningPayload = buildWatchdogDatabaseWarnings(_req.user?.role);
  res.json({
    config: buildWatchdogDatabaseConfigView(),
    ...warningPayload,
    watchdogHealth: health,
    confirmationText: WATCHDOG_DATABASE_CONFIRMATION_TEXT,
  });
});

/** PUT /api/watchdog/ops/database-config - updates DB/env settings with explicit typed confirmation. */
router.put("/ops/database-config", requirePermission("watchdog.settings.manage"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as {
    confirmationText?: string;
    databaseUrl?: string;
    watchdogDatabaseUrl?: string;
    watchdogEncryptionKey?: string;
    jwtSecret?: string;
    nextPublicApiUrl?: string;
  };

  if ((body.confirmationText ?? "").trim() !== WATCHDOG_DATABASE_CONFIRMATION_TEXT) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_DATABASE_CONFIRMATION_REQUIRED",
        message: "Confirmation text did not match the required phrase.",
      },
    });
    return;
  }

  const updates: Record<string, string> = {};
  if (body.databaseUrl?.trim()) updates.DATABASE_URL = body.databaseUrl.trim();
  if (body.watchdogDatabaseUrl?.trim()) updates.WATCHDOG_DATABASE_URL = body.watchdogDatabaseUrl.trim();
  if (body.watchdogEncryptionKey?.trim()) updates.WATCHDOG_ENCRYPTION_KEY = body.watchdogEncryptionKey.trim();
  if (body.jwtSecret?.trim()) updates.JWT_SECRET = body.jwtSecret.trim();
  if (body.nextPublicApiUrl?.trim()) updates.NEXT_PUBLIC_API_URL = body.nextPublicApiUrl.trim();

  if (Object.keys(updates).length === 0) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_DATABASE_SETTINGS_EMPTY",
        message: "At least one database or environment value is required.",
      },
    });
    return;
  }

  try {
    await upsertEnvironmentFileValues(updates);

    for (const [key, value] of Object.entries(updates)) {
      process.env[key] = value;
    }

    if (updates.WATCHDOG_DATABASE_URL || updates.WATCHDOG_ENCRYPTION_KEY) {
      await Promise.all([
        resetWatchdogStoreConnections(),
        resetWatchdogOpsStoreConnections(),
      ]);
    }

    const health = await getWatchdogHealth();
    const warningPayload = buildWatchdogDatabaseWarnings(req.user?.role);

    await logAudit({
      action: "WATCHDOG_DATABASE_SETTINGS_UPDATED",
      entity: "WatchdogSettings",
      entityId: organizationId,
      userId,
      organizationId,
      metadata: {
        updatedKeys: Object.keys(updates),
        requiresServiceRestart: Boolean(updates.DATABASE_URL || updates.JWT_SECRET || updates.NEXT_PUBLIC_API_URL),
      },
    });

    await recordWatchdogSecurityEvent({
      organizationId,
      severity: "high",
      eventType: "WATCHDOG_DATABASE_SETTINGS_UPDATED",
      sourceModule: "watchdog",
      message: "Watchdog database/environment configuration updated.",
      payload: {
        updatedKeys: Object.keys(updates),
        actorUserId: userId,
      },
    });

    res.json({
      success: true,
      updatedKeys: Object.keys(updates),
      requiresServiceRestart: Boolean(updates.DATABASE_URL || updates.JWT_SECRET || updates.NEXT_PUBLIC_API_URL),
      config: buildWatchdogDatabaseConfigView(),
      ...warningPayload,
      watchdogHealth: health,
      confirmationText: WATCHDOG_DATABASE_CONFIRMATION_TEXT,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/** PUT /api/watchdog/ops/settings - update persisted watchdog policy/settings payload. */
router.put("/ops/settings", requirePermission("watchdog.settings.manage"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as {
    settings?: Record<string, unknown>;
  };

  if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_SETTINGS_VALIDATION",
        message: "settings object is required.",
      },
    });
    return;
  }

  try {
    const settings = await upsertWatchdogSettings({
      organizationId,
      settings: body.settings,
      updatedBy: userId,
    });

    await logAudit({
      action: "WATCHDOG_SETTINGS_UPDATED",
      entity: "WatchdogSettings",
      entityId: organizationId,
      userId,
      organizationId,
      metadata: {
        keys: Object.keys(settings),
      },
    });

    res.json({ settings });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

export default router;
