/**
 * System Update Manager routes.
 * Admins can view status/history; super-admins can trigger install/rollback/maintenance actions.
 */
import { Router, type Request } from "express";
import { logAudit } from "../lib/audit.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  getConfiguredSuperAdminEmails,
  getSystemUpdateStatus,
  listSystemUpdateHistory,
  listSystemUpdateReleases,
  requestSystemUpdateInstall,
  requestSystemUpdateRollback,
  setSystemMaintenanceMode,
  type UpdateChannel,
} from "../services/system-updates.js";

const router = Router();

router.use(requireAuth, requireRole("admin"));

function parseChannel(raw: unknown): UpdateChannel | undefined {
  if (raw === "stable") return "stable";
  if (raw === "beta") return "beta";
  return undefined;
}

function isSuperAdminRequest(req: Request): boolean {
  const allowSet = getConfiguredSuperAdminEmails();
  if (allowSet.size === 0) return true;
  const email = String(req.user?.email ?? "").trim().toLowerCase();
  return allowSet.has(email);
}

async function requireOrganizationId(req: Request): Promise<string> {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    throw new Error("No organization found for this request.");
  }
  return organizationId;
}

function ensureSuperAdmin(req: Request, organizationId: string): { ok: true } | { ok: false; status: number; body: Record<string, unknown> } {
  if (!isSuperAdminRequest(req)) {
    void logAudit({
      action: "SYSTEM_UPDATE_FORBIDDEN",
      entity: "SystemUpdate",
      userId: req.user?.sub,
      organizationId,
      metadata: {
        reason: "SUPER_ADMIN_REQUIRED",
        email: req.user?.email ?? null,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return {
      ok: false,
      status: 403,
      body: {
        error: {
          code: "FORBIDDEN",
          message: "Super admin access is required for update actions.",
        },
      },
    };
  }

  return { ok: true };
}

router.get("/status", async (req, res) => {
  try {
    const organizationId = await requireOrganizationId(req);
    const status = await getSystemUpdateStatus({ organizationId });
    res.json(status);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load update status";
    res.status(400).json({ error: { code: "SYSTEM_UPDATES_STATUS_FAILED", message } });
  }
});

router.get("/releases", async (req, res) => {
  try {
    const organizationId = await requireOrganizationId(req);
    const channel = parseChannel(req.query.channel);
    const refresh = String(req.query.refresh ?? "").toLowerCase() === "true";
    const payload = await listSystemUpdateReleases({ organizationId, channel, refresh });
    res.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to fetch release list";
    res.status(400).json({ error: { code: "SYSTEM_UPDATES_RELEASES_FAILED", message } });
  }
});

router.get("/history", async (req, res) => {
  try {
    const organizationId = await requireOrganizationId(req);
    const limitRaw = Number.parseInt(String(req.query.limit ?? "20"), 10);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
    const history = await listSystemUpdateHistory({ organizationId, limit });
    res.json({ items: history });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load update history";
    res.status(400).json({ error: { code: "SYSTEM_UPDATES_HISTORY_FAILED", message } });
  }
});

router.post("/install", async (req, res) => {
  try {
    const organizationId = await requireOrganizationId(req);
    const superAdmin = ensureSuperAdmin(req, organizationId);
    if (!superAdmin.ok) {
      res.status(superAdmin.status).json(superAdmin.body);
      return;
    }

    const requestedVersion = typeof req.body?.version === "string" ? req.body.version.trim() : undefined;
    const channel = parseChannel(req.body?.channel);

    const result = await requestSystemUpdateInstall({
      organizationId,
      actor: {
        userId: String(req.user?.sub ?? ""),
        email: String(req.user?.email ?? ""),
      },
      requestedVersion,
      channel,
    });

    await logAudit({
      action: "SYSTEM_UPDATE_INSTALL_REQUESTED",
      entity: "SystemUpdate",
      entityId: result.runId,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        version: result.requestedVersion,
        channel: channel ?? null,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(202).json({
      accepted: true,
      runId: result.runId,
      version: result.requestedVersion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Install request failed";
    res.status(400).json({ error: { code: "SYSTEM_UPDATES_INSTALL_FAILED", message } });
  }
});

router.post("/rollback", async (req, res) => {
  try {
    const organizationId = await requireOrganizationId(req);
    const superAdmin = ensureSuperAdmin(req, organizationId);
    if (!superAdmin.ok) {
      res.status(superAdmin.status).json(superAdmin.body);
      return;
    }

    const requestedVersion = typeof req.body?.version === "string" ? req.body.version.trim() : undefined;

    const result = await requestSystemUpdateRollback({
      organizationId,
      actor: {
        userId: String(req.user?.sub ?? ""),
        email: String(req.user?.email ?? ""),
      },
      requestedVersion,
    });

    await logAudit({
      action: "SYSTEM_UPDATE_ROLLBACK_REQUESTED",
      entity: "SystemUpdate",
      entityId: result.runId,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        version: result.requestedVersion,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(202).json({
      accepted: true,
      runId: result.runId,
      version: result.requestedVersion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Rollback request failed";
    res.status(400).json({ error: { code: "SYSTEM_UPDATES_ROLLBACK_FAILED", message } });
  }
});

router.post("/maintenance", async (req, res) => {
  try {
    const organizationId = await requireOrganizationId(req);
    const superAdmin = ensureSuperAdmin(req, organizationId);
    if (!superAdmin.ok) {
      res.status(superAdmin.status).json(superAdmin.body);
      return;
    }

    const enabled = req.body?.enabled === true;
    await setSystemMaintenanceMode({ organizationId, enabled });

    await logAudit({
      action: enabled ? "SYSTEM_UPDATE_MAINTENANCE_ENABLED" : "SYSTEM_UPDATE_MAINTENANCE_DISABLED",
      entity: "SystemUpdate",
      userId: req.user?.sub,
      organizationId,
      metadata: {
        enabled,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({ enabled });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to update maintenance mode";
    res.status(400).json({ error: { code: "SYSTEM_UPDATES_MAINTENANCE_FAILED", message } });
  }
});

export default router;
