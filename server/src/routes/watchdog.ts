/**
 * OyamaWatchdog routes.
 * Admin-only security monitor + encrypted password-vault APIs.
 */
import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { logAudit } from "../lib/audit.js";
import { getAppInfo } from "../lib/app-info.js";
import { CrmBackupBundle, exportFullCrmBackup, restoreFullCrmBackup } from "../services/crm-backup.js";
import {
  createWatchdogCrmBackup,
  createWatchdogVaultEntry,
  getWatchdogCrmBackup,
  getWatchdogSecurityEventById,
  getWatchdogHealth,
  getWatchdogVaultEntry,
  isWatchdogDbConfigured,
  isWatchdogEncryptionConfigured,
  listWatchdogCrmBackups,
  listWatchdogIncidentStates,
  listWatchdogSecurityEvents,
  listWatchdogVaultEntries,
  markWatchdogCrmBackupRestored,
  recordWatchdogSecurityEvent,
  upsertWatchdogIncidentState,
} from "../services/watchdog-store.js";

const router = Router();

const WATCHDOG_PERMISSION_KEYS = [
  "watchdog:view_dashboard",
  "watchdog:view_logs",
  "watchdog:vault:read",
  "watchdog:vault:read_secret",
  "watchdog:vault:write",
  "watchdog:vault:delete",
  "watchdog:incident:acknowledge",
  "watchdog:incident:escalate",
  "watchdog:incident:resolve",
  "watchdog:manage",
  "watchdog.tickets.view",
  "watchdog.tickets.manage",
  "watchdog.tickets.assign",
  "watchdog.tickets.resolve",
  "watchdog.tickets.delete",
] as const;

type WatchdogPermissionKey = (typeof WATCHDOG_PERMISSION_KEYS)[number];

// Highest-admin module: all routes require admin role; fine-grain permissions can still deny specific actions.
router.use(requireAuth, requireRole("admin"));

/**
 * Resolves fine-grained permission state for one admin user and one Watchdog permission key.
 * Missing overrides default to allowed for admins; explicit denied rows block access.
 */
async function resolveWatchdogPermission(userId: string, permission: WatchdogPermissionKey): Promise<boolean> {
  const override = await prisma.userPermission.findUnique({
    where: {
      userId_permission: {
        userId,
        permission,
      },
    },
    select: { granted: true },
  });

  if (!override) return true;
  return Boolean(override.granted);
}

/** Middleware factory to enforce one Watchdog fine-grained permission key. */
function requireWatchdogPermission(permission: WatchdogPermissionKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.sub;
    if (!userId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }

    const allowed = await resolveWatchdogPermission(userId, permission);
    if (!allowed) {
      res.status(403).json({
        error: {
          code: "WATCHDOG_PERMISSION_DENIED",
          message: `Permission denied: ${permission}`,
        },
      });
      return;
    }

    next();
  };
}

/** Maps audit actions to security severity. */
function severityFromAction(action: string): "low" | "medium" | "high" | "critical" {
  const normalized = action.toUpperCase();
  if (normalized.includes("RESET") || normalized.includes("DELETE") || normalized.includes("FORBIDDEN")) return "high";
  if (normalized.includes("LOGIN_FAILED") || normalized.includes("TOKEN_EXPIRED") || normalized.includes("UNAUTHORIZED")) return "critical";
  if (normalized.includes("UPDATE") || normalized.includes("PASSWORD")) return "medium";
  return "low";
}

/** Tries to infer source module from an audit action/entity pair. */
function sourceModuleFromAudit(action: string, entity: string | null): string {
  const a = action.toUpperCase();
  const e = (entity ?? "").toUpperCase();

  if (a.includes("COMPASSION") || e.includes("COMPASSION") || e.includes("CLIENT") || e.includes("CASE")) return "compassion";
  if (a.includes("EVENT") || e.includes("EVENT") || e.includes("GUEST") || e.includes("TICKET")) return "events";
  if (a.includes("WATCHDOG") || e.includes("WATCHDOG")) return "watchdog";
  if (a.includes("WEBMASTER") || e.includes("WEBMASTER")) return "webmaster";
  return "donor";
}

/** Maps external store failures to a consistent API response envelope. */
function watchdogStoreUnavailable(res: Response, error: unknown): void {
  const message = error instanceof Error ? error.message : "Watchdog external store is unavailable.";
  res.status(503).json({
    error: {
      code: "WATCHDOG_STORE_UNAVAILABLE",
      message,
    },
  });
}

/** Lightweight shape guard for full backup import payloads. */
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

/**
 * GET /api/watchdog/permissions
 * Returns all Watchdog fine-grained permission states for the authenticated admin.
 */
router.get("/permissions", async (req, res) => {
  const userId = req.user!.sub;

  const permissions = await Promise.all(
    WATCHDOG_PERMISSION_KEYS.map(async (permission) => {
      const override = await prisma.userPermission.findUnique({
        where: { userId_permission: { userId, permission } },
        select: { granted: true },
      });
      return {
        permission,
        granted: override ? Boolean(override.granted) : true,
        source: override ? "explicit" : "default-admin",
      };
    }),
  );

  res.json({ permissions });
});

/**
 * GET /api/watchdog/status
 * Returns OyamaWatchdog readiness, DB health, and high-level security counters.
 */
router.get("/status", requireWatchdogPermission("watchdog:view_dashboard"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [health, totalAuditEvents, highSeverityEvents24h, recentAuthFailures] = await Promise.all([
    getWatchdogHealth(),
    prisma.auditLog.count({ where: { organizationId } }),
    prisma.auditLog.count({
      where: {
        organizationId,
        createdAt: { gte: twentyFourHoursAgo },
        OR: [
          { action: { contains: "DELETE" } },
          { action: { contains: "RESET" } },
          { action: { contains: "UNAUTHORIZED" } },
          { action: { contains: "FORBIDDEN" } },
          { action: { contains: "LOGIN_FAILED" } },
        ],
      },
    }),
    prisma.auditLog.count({
      where: {
        organizationId,
        createdAt: { gte: twentyFourHoursAgo },
        OR: [
          { action: { contains: "LOGIN_FAILED" } },
          { action: { contains: "TOKEN_EXPIRED" } },
          { action: { contains: "UNAUTHORIZED" } },
        ],
      },
    }),
  ]);

  res.json({
    watchdog: {
      configured: isWatchdogDbConfigured(),
      encryptionConfigured: isWatchdogEncryptionConfigured(),
      health,
    },
    totals: {
      totalAuditEvents,
      highSeverityEvents24h,
      recentAuthFailures,
    },
  });
});

/**
 * GET /api/watchdog/backups
 * Lists full CRM backups captured through Watchdog.
 */
router.get("/backups", requireWatchdogPermission("watchdog:manage"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const limit = Math.min(Math.max(Number(req.query.limit ?? 25), 1), 100);

  try {
    const items = await listWatchdogCrmBackups({ organizationId, limit });
    res.json({ items });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
  }
});

/**
 * POST /api/watchdog/backups/export
 * Exports full CRM backup as SQL + JSON and persists it in Watchdog storage.
 */
router.post("/backups/export", requireWatchdogPermission("watchdog:manage"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as {
    label?: string;
    includeWatchdogDatabase?: boolean;
  };

  const includeWatchdogDatabase = body.includeWatchdogDatabase !== false;
  const appInfo = getAppInfo();

  let backupBundle: CrmBackupBundle;
  try {
    backupBundle = await exportFullCrmBackup({
      organizationId,
      generatedBy: userId,
      appVersion: appInfo.version,
      includeWatchdogDatabase,
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: "WATCHDOG_BACKUP_EXPORT_FAILED",
        message: error instanceof Error ? error.message : "Failed to export full CRM backup.",
      },
    });
    return;
  }

  const backupLabel = body.label?.trim() || `full-crm-backup-${new Date().toISOString()}`;
  const backupJson = JSON.stringify(backupBundle);

  let item: Awaited<ReturnType<typeof createWatchdogCrmBackup>>;
  try {
    item = await createWatchdogCrmBackup({
      organizationId,
      label: backupLabel,
      sourceVersion: backupBundle.appVersion,
      primaryTableCount: backupBundle.primaryDatabase.tableCount,
      primaryRowCount: backupBundle.primaryDatabase.rowCount,
      watchdogTableCount: backupBundle.watchdogDatabase?.tableCount ?? 0,
      watchdogRowCount: backupBundle.watchdogDatabase?.rowCount ?? 0,
      backupJson,
      createdBy: userId,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  await logAudit({
    action: "WATCHDOG_CRM_BACKUP_EXPORTED",
    entity: "WatchdogCrmBackup",
    entityId: item.id,
    userId,
    organizationId,
    metadata: {
      label: item.label,
      sourceVersion: item.sourceVersion,
      primaryTableCount: item.primaryTableCount,
      primaryRowCount: item.primaryRowCount,
      watchdogTableCount: item.watchdogTableCount,
      watchdogRowCount: item.watchdogRowCount,
    },
  });

  try {
    await recordWatchdogSecurityEvent({
      organizationId,
      severity: "medium",
      eventType: "WATCHDOG_CRM_BACKUP_EXPORTED",
      sourceModule: "watchdog",
      message: `Full CRM backup exported (${item.id})`,
      payload: {
        backupId: item.id,
        label: item.label,
        rows: item.primaryRowCount,
      },
    });
  } catch {
    // No-op: backup succeeded even if external event write fails.
  }

  res.status(201).json({
    item,
    bundleSummary: {
      generatedAt: backupBundle.generatedAt,
      sqlBytes: Buffer.byteLength(backupBundle.sqlDump, "utf8"),
      hasWatchdogDatabase: Boolean(backupBundle.watchdogDatabase),
    },
  });
});

/**
 * GET /api/watchdog/backups/:id
 * Returns full SQL + JSON backup payload for one saved backup.
 */
router.get("/backups/:id", requireWatchdogPermission("watchdog:manage"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const id = req.params.id;

  let record: Awaited<ReturnType<typeof getWatchdogCrmBackup>>;
  try {
    record = await getWatchdogCrmBackup({ organizationId, id });
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

  let backup: unknown;
  try {
    backup = JSON.parse(record.backupJson);
  } catch {
    res.status(500).json({
      error: {
        code: "WATCHDOG_BACKUP_CORRUPT",
        message: "Stored backup payload is not valid JSON.",
      },
    });
    return;
  }

  const { backupJson: _ignoredBackupJson, ...item } = record;
  res.json({ item, backup });
});

/**
 * GET /api/watchdog/backups/:id/sql
 * Returns the SQL dump text for one full backup as plain text.
 */
router.get("/backups/:id/sql", requireWatchdogPermission("watchdog:manage"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const id = req.params.id;

  let record: Awaited<ReturnType<typeof getWatchdogCrmBackup>>;
  try {
    record = await getWatchdogCrmBackup({ organizationId, id });
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

  let backup: unknown;
  try {
    backup = JSON.parse(record.backupJson);
  } catch {
    res.status(500).json({
      error: {
        code: "WATCHDOG_BACKUP_CORRUPT",
        message: "Stored backup payload is not valid JSON.",
      },
    });
    return;
  }

  if (!isCrmBackupBundle(backup)) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_BACKUP_INVALID_SHAPE",
        message: "Stored backup payload shape is invalid.",
      },
    });
    return;
  }

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename=watchdog-backup-${id}.sql`);
  res.send(backup.sqlDump);
});

/**
 * POST /api/watchdog/backups/import
 * Restores full CRM state from a Watchdog backup ID or direct backup payload.
 */
router.post("/backups/import", requireWatchdogPermission("watchdog:manage"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as {
    backupId?: string;
    backup?: unknown;
    includeWatchdogDatabase?: boolean;
  };

  const includeWatchdogDatabase = body.includeWatchdogDatabase !== false;
  let sourceBackupId: string | null = null;
  let bundle: CrmBackupBundle;

  if (body.backupId) {
    sourceBackupId = body.backupId;
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

    let parsed: unknown;
    try {
      parsed = JSON.parse(record.backupJson);
    } catch {
      res.status(500).json({
        error: {
          code: "WATCHDOG_BACKUP_CORRUPT",
          message: "Stored backup payload is not valid JSON.",
        },
      });
      return;
    }

    if (!isCrmBackupBundle(parsed)) {
      res.status(400).json({
        error: {
          code: "WATCHDOG_BACKUP_INVALID_SHAPE",
          message: "Stored backup payload shape is invalid.",
        },
      });
      return;
    }

    bundle = parsed;
  } else if (isCrmBackupBundle(body.backup)) {
    bundle = body.backup;
  } else {
    res.status(400).json({
      error: {
        code: "WATCHDOG_BACKUP_IMPORT_VALIDATION",
        message: "Provide either backupId or a valid backup payload.",
      },
    });
    return;
  }

  let report: Awaited<ReturnType<typeof restoreFullCrmBackup>>;
  try {
    report = await restoreFullCrmBackup({
      bundle,
      includeWatchdogDatabase,
    });
  } catch (error) {
    res.status(500).json({
      error: {
        code: "WATCHDOG_BACKUP_IMPORT_FAILED",
        message: error instanceof Error ? error.message : "Failed to restore full CRM backup.",
      },
    });
    return;
  }

  if (sourceBackupId) {
    try {
      await markWatchdogCrmBackupRestored({ organizationId, id: sourceBackupId });
    } catch (error) {
      watchdogStoreUnavailable(res, error);
      return;
    }
  }

  await logAudit({
    action: "WATCHDOG_CRM_BACKUP_IMPORTED",
    entity: "WatchdogCrmBackup",
    entityId: sourceBackupId ?? "direct-payload",
    userId,
    organizationId,
    metadata: {
      backupSchemaVersion: bundle.backupSchemaVersion,
      sourceBackupId,
      includeWatchdogDatabase,
      primary: report.primary,
      watchdog: report.watchdog ?? null,
    },
  });

  try {
    await recordWatchdogSecurityEvent({
      organizationId,
      severity: "high",
      eventType: "WATCHDOG_CRM_BACKUP_IMPORTED",
      sourceModule: "watchdog",
      message: `Full CRM backup imported (${sourceBackupId ?? "direct-payload"})`,
      payload: {
        sourceBackupId,
        includeWatchdogDatabase,
        primary: report.primary,
        watchdog: report.watchdog ?? null,
      },
    });
  } catch {
    // No-op: restore already succeeded.
  }

  res.json({
    success: true,
    sourceBackupId,
    report,
  });
});

/**
 * GET /api/watchdog/security-feed
 * Returns merged security feed across core audit logs and Watchdog external events.
 */
router.get("/security-feed", requireWatchdogPermission("watchdog:view_logs"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const limit = Math.min(Math.max(Number(req.query.limit ?? 40), 5), 200);

  const auditLogs = await prisma.auditLog.findMany({
    where: { organizationId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      action: true,
      entity: true,
      metadata: true,
      createdAt: true,
    },
  });

  let externalEvents: Awaited<ReturnType<typeof listWatchdogSecurityEvents>> = [];
  try {
    externalEvents = await listWatchdogSecurityEvents({ organizationId, limit });
  } catch {
    externalEvents = [];
  }

  let auditIncidentMap: Awaited<ReturnType<typeof listWatchdogIncidentStates>> = {};
  let externalIncidentMap: Awaited<ReturnType<typeof listWatchdogIncidentStates>> = {};
  try {
    [auditIncidentMap, externalIncidentMap] = await Promise.all([
      listWatchdogIncidentStates({
        organizationId,
        sourceType: "audit",
        refs: auditLogs.map((log) => log.id),
      }),
      listWatchdogIncidentStates({
        organizationId,
        sourceType: "watchdog",
        refs: externalEvents.map((event) => event.id),
      }),
    ]);
  } catch {
    auditIncidentMap = {};
    externalIncidentMap = {};
  }

  const feed = [
    ...auditLogs.map((log) => ({
      id: `audit:${log.id}`,
      source: "audit" as const,
      severity: severityFromAction(log.action),
      eventType: log.action,
      sourceModule: sourceModuleFromAudit(log.action, log.entity),
      message: log.entity ? `${log.action} on ${log.entity}` : log.action,
      incidentStatus: auditIncidentMap[log.id]?.incidentStatus ?? "new",
      incidentUpdatedAt: auditIncidentMap[log.id]?.updatedAt ?? null,
      createdAt: log.createdAt.toISOString(),
      payload: log.metadata,
    })),
    ...externalEvents.map((event) => ({
      id: `external:${event.id}`,
      source: "watchdog" as const,
      severity: event.severity,
      eventType: event.eventType,
      sourceModule: event.sourceModule,
      message: event.message,
      incidentStatus: externalIncidentMap[event.id]?.incidentStatus ?? event.incidentStatus,
      incidentUpdatedAt: externalIncidentMap[event.id]?.updatedAt ?? event.incidentUpdatedAt,
      createdAt: event.createdAt,
      payload: event.payload,
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, limit);

  res.json({ items: feed });
});

/**
 * POST /api/watchdog/security-feed/actions
 * Applies incident workflow actions (acknowledge/escalate/resolve) on one feed item.
 */
router.post("/security-feed/actions", requireWatchdogPermission("watchdog:view_logs"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as {
    source?: "audit" | "watchdog";
    eventRef?: string;
    action?: "acknowledge" | "escalate" | "resolve";
    notes?: string;
  };

  if (!body.source || !body.eventRef || !body.action) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_INCIDENT_VALIDATION",
        message: "source, eventRef, and action are required.",
      },
    });
    return;
  }

  if (body.source === "audit") {
    const auditEntry = await prisma.auditLog.findFirst({
      where: {
        id: body.eventRef,
        organizationId,
      },
      select: { id: true },
    });

    if (!auditEntry) {
      res.status(404).json({
        error: {
          code: "WATCHDOG_INCIDENT_NOT_FOUND",
          message: "Audit event not found.",
        },
      });
      return;
    }
  } else {
    let externalEvent: Awaited<ReturnType<typeof getWatchdogSecurityEventById>>;
    try {
      externalEvent = await getWatchdogSecurityEventById({
        organizationId,
        id: body.eventRef,
      });
    } catch (error) {
      watchdogStoreUnavailable(res, error);
      return;
    }

    if (!externalEvent) {
      res.status(404).json({
        error: {
          code: "WATCHDOG_INCIDENT_NOT_FOUND",
          message: "Watchdog event not found.",
        },
      });
      return;
    }
  }

  let state: Awaited<ReturnType<typeof upsertWatchdogIncidentState>>;
  try {
    state = await upsertWatchdogIncidentState({
      organizationId,
      sourceType: body.source,
      eventRef: body.eventRef,
      action: body.action,
      updatedBy: userId,
      notes: body.notes,
    });

    await recordWatchdogSecurityEvent({
      organizationId,
      severity: body.action === "escalate" ? "high" : "medium",
      eventType: `WATCHDOG_INCIDENT_${body.action.toUpperCase()}`,
      sourceModule: "watchdog",
      message: `${body.action.toUpperCase()} ${body.source} event ${body.eventRef}`,
      incidentStatus: state.incidentStatus,
      incidentUpdatedBy: userId,
      payload: {
        source: body.source,
        eventRef: body.eventRef,
        notes: body.notes ?? null,
      },
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  await logAudit({
    action: `WATCHDOG_INCIDENT_${body.action.toUpperCase()}`,
    entity: "WatchdogIncident",
    entityId: `${body.source}:${body.eventRef}`,
    userId,
    organizationId,
    metadata: {
      source: body.source,
      eventRef: body.eventRef,
      status: state.incidentStatus,
      notes: state.notes,
    },
  });

  res.json({
    item: {
      source: body.source,
      eventRef: body.eventRef,
      incidentStatus: state.incidentStatus,
      incidentUpdatedAt: state.updatedAt,
      notes: state.notes,
    },
  });
});

/**
 * POST /api/watchdog/security-events
 * Writes a manual Watchdog security event to the external Watchdog database.
 */
router.post("/security-events", requireWatchdogPermission("watchdog:manage"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as {
    severity?: "low" | "medium" | "high" | "critical";
    eventType?: string;
    sourceModule?: string;
    message?: string;
    payload?: Record<string, unknown>;
  };

  if (!body.eventType || !body.sourceModule || !body.message) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_EVENT_VALIDATION",
        message: "eventType, sourceModule, and message are required.",
      },
    });
    return;
  }

  try {
    await recordWatchdogSecurityEvent({
      organizationId,
      severity: body.severity ?? "medium",
      eventType: body.eventType,
      sourceModule: body.sourceModule,
      message: body.message,
      payload: body.payload,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  await logAudit({
    action: "WATCHDOG_EVENT_RECORDED",
    entity: "WatchdogSecurityEvent",
    entityId: body.eventType,
    userId,
    organizationId,
    metadata: {
      severity: body.severity ?? "medium",
      sourceModule: body.sourceModule,
      message: body.message,
    },
  });

  res.status(201).json({ success: true });
});

/**
 * GET /api/watchdog/vault
 * Lists vault entry metadata for the org (without secrets).
 */
router.get("/vault", requireWatchdogPermission("watchdog:vault:read"), async (req, res) => {
  const organizationId = req.user!.orgId;
  let entries: Awaited<ReturnType<typeof listWatchdogVaultEntries>>;
  try {
    entries = await listWatchdogVaultEntries(organizationId);
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }
  res.json({ items: entries });
});

/**
 * POST /api/watchdog/vault
 * Creates a new encrypted password-vault entry.
 */
router.post("/vault", requireWatchdogPermission("watchdog:vault:write"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const body = req.body as {
    name?: string;
    category?: string;
    username?: string;
    website?: string;
    password?: string;
    notes?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.name || !body.password) {
    res.status(400).json({
      error: {
        code: "WATCHDOG_VAULT_VALIDATION",
        message: "name and password are required.",
      },
    });
    return;
  }

  let created: Awaited<ReturnType<typeof createWatchdogVaultEntry>>;
  try {
    created = await createWatchdogVaultEntry({
      organizationId,
      createdBy: userId,
      name: body.name,
      category: body.category,
      username: body.username,
      website: body.website,
      password: body.password,
      notes: body.notes,
      metadata: body.metadata,
    });
  } catch (error) {
    watchdogStoreUnavailable(res, error);
    return;
  }

  await logAudit({
    action: "WATCHDOG_VAULT_ENTRY_CREATED",
    entity: "WatchdogVaultEntry",
    entityId: created.id,
    userId,
    organizationId,
    metadata: {
      name: created.name,
      category: created.category,
      username: created.username,
      website: created.website,
    },
  });

  res.status(201).json({ item: created });
});

/**
 * GET /api/watchdog/vault/:id
 * Reads one vault entry; secret reveal requires explicit permission.
 */
router.get("/vault/:id", requireWatchdogPermission("watchdog:vault:read"), async (req, res) => {
  const organizationId = req.user!.orgId;
  const userId = req.user!.sub;
  const id = req.params.id;
  const revealSecret = req.query.reveal === "true";

  if (revealSecret) {
    const allowed = await resolveWatchdogPermission(userId, "watchdog:vault:read_secret");
    if (!allowed) {
      res.status(403).json({
        error: {
          code: "WATCHDOG_SECRET_READ_DENIED",
          message: "Secret reveal requires watchdog:vault:read_secret permission.",
        },
      });
      return;
    }
  }

  let item: Awaited<ReturnType<typeof getWatchdogVaultEntry>>;
  try {
    item = await getWatchdogVaultEntry({ organizationId, id, revealSecret });
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

  await logAudit({
    action: revealSecret ? "WATCHDOG_VAULT_ENTRY_SECRET_READ" : "WATCHDOG_VAULT_ENTRY_READ",
    entity: "WatchdogVaultEntry",
    entityId: id,
    userId,
    organizationId,
    metadata: {
      revealSecret,
    },
  });

  res.json({ item });
});

export default router;
