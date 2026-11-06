/**
 * QuickBooks integration routes for OyamaCRM (DonorCRM only).
 * Provides plugin management, OAuth connect/disconnect flow, and manual sync queue operations.
 *
 * Sync operations are queue-based:
 *   - Completed donations entered after the first successful connection are queued automatically
 *   - Staff review and edit queue items before syncing
 *   - Syncing runs daily or can be triggered manually per-item or for all pending items
 *   - Earlier donations require the explicit admin-only historical sync action
 *
 * Routes:
 *   GET  /api/quickbooks/status           — connection status + plugin state
 *   PUT  /api/quickbooks/plugin           — enable or disable the plugin
 *   GET  /api/quickbooks/auth-uri         — get OAuth authorization URL
 *   GET  /api/quickbooks/runtime-config   — get runtime OAuth credential status
 *   PUT  /api/quickbooks/runtime-config   — save runtime OAuth credentials
 *   GET  /api/quickbooks/callback         — handle OAuth callback (redirect target)
 *   POST /api/quickbooks/disconnect       — revoke tokens / disconnect
 *
 *   GET    /api/quickbooks/sync-queue         — list queue items (paginated, filterable)
 *   POST   /api/quickbooks/sync-queue         — add a donation to the sync queue
 *   GET    /api/quickbooks/sync-queue/:id     — get a single queue item
 *   PUT    /api/quickbooks/sync-queue/:id     — update a queue item (edit before sync)
 *   DELETE /api/quickbooks/sync-queue/:id     — remove item from queue (mark SKIPPED)
 *   POST   /api/quickbooks/sync-queue/:id/sync     — manually sync one item
 *   POST   /api/quickbooks/sync-queue/sync-all     — sync all PENDING items
 *
 * @module routes/quickbooks
 */
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { Prisma } from "@prisma/client";
import { logAudit } from "../lib/audit.js";
import {
  isQBConfigured,
  getQBRuntimeStatus,
  saveQBPluginCredentials,
  buildAuthUri,
  handleOAuthCallback,
  revokeTokens,
  pushDonationToQB,
  type QBDonationPayload,
} from "../services/quickbooksService.js";

const router = Router();

// All QuickBooks routes require authentication
router.use((req, res, next) => req.path === "/callback" && req.method === "GET" ? next() : requireAuth(req, res, next));
router.use((req, res, next) => req.path === "/callback" ? next() : requireRole("staff")(req, res, next));

// ─── Helper: get org QB plugin setting ───────────────────────────────────────

/**
 * Fetches the PluginSetting row for "quickbooks" for the current org.
 * Returns null if no row exists yet.
 */
async function getQBPlugin(organizationId: string) {
  return prisma.pluginSetting.findUnique({
    where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
  });
}

/**
 * Resolves the organization ID from the request, throwing a 500-friendly error if missing.
 * Wraps the shared resolveOrganizationId helper.
 */
async function resolveOrg(req: import("express").Request): Promise<string> {
  const orgId = await resolveOrganizationId({ req });
  if (!orgId) throw new Error("Could not determine organization.");
  return orgId;
}

function configRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

const PRE_CONNECTION_EXCLUSION = "Excluded from normal sync because the donation predates the QuickBooks connection.";

function connectionCutoff(plugin: { config: unknown; updatedAt: Date }): Date | null {
  const config = configRecord(plugin.config);
  const raw = config.qbConnectedAt;
  if (typeof raw === "string" && !Number.isNaN(new Date(raw).getTime())) return new Date(raw);
  // Legacy connected installations did not persist qbConnectedAt. updatedAt is
  // intentionally conservative: it cannot pull older history without consent.
  if (config.access_token) return plugin.updatedAt;
  return null;
}

/** Adds one completed CRM donation to the one-way QB queue exactly once. */
export async function ensureDonationQueuedForQuickBooks(
  organizationId: string,
  donationId: string,
  options: { includePastHistory?: boolean } = {},
) {
  const plugin = await getQBPlugin(organizationId);
  if (!plugin?.enabled) return { item: null, created: false, reason: "disabled" as const };
  const cutoff = connectionCutoff(plugin);
  if (!cutoff && !options.includePastHistory) return { item: null, created: false, reason: "not-connected" as const };

  const donation = await prisma.donation.findFirst({
    where: { id: donationId, status: "COMPLETED", constituent: { organizationId } },
    include: {
      constituent: { select: { firstName: true, lastName: true } },
      campaign: { select: { name: true } },
      designation: { select: { name: true } },
    },
  });
  if (!donation) return { item: null, created: false, reason: "not-eligible" as const };
  if (!options.includePastHistory && cutoff && donation.createdAt < cutoff) {
    return { item: null, created: false, reason: "before-connection" as const };
  }

  const existing = await prisma.qBSyncQueueItem.findFirst({ where: { organizationId, donationId } });
  if (options.includePastHistory && existing?.status === "SKIPPED" && existing.errorMessage === PRE_CONNECTION_EXCLUSION) {
    const item = await prisma.qBSyncQueueItem.update({
      where: { id: existing.id },
      data: { status: "PENDING", errorMessage: null },
    });
    return { item, created: false, reason: "restored-history" as const };
  }
  if (existing) return { item: existing, created: false, reason: "exists" as const };

  const memo = [donation.campaign?.name, donation.designation?.name].filter(Boolean).join(" — ") || "Donation";
  try {
    const item = await prisma.qBSyncQueueItem.create({
      data: {
        organizationId,
        donationId,
        customerName: `${donation.constituent.firstName} ${donation.constituent.lastName}`.trim() || "Donor",
        memo,
        amount: donation.amount,
      },
    });
    return { item, created: true, reason: "created" as const };
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const item = await prisma.qBSyncQueueItem.findFirst({ where: { organizationId, donationId } });
      return { item, created: false, reason: "exists" as const };
    }
    throw error;
  }
}

/** Queues completed gifts after the connection cutoff, unless history is explicitly requested. */
export async function queueEligibleQuickBooksDonations(
  organizationId: string,
  options: { includePastHistory?: boolean } = {},
): Promise<number> {
  const plugin = await getQBPlugin(organizationId);
  if (!plugin?.enabled) return 0;
  const cutoff = connectionCutoff(plugin);
  if (!cutoff && !options.includePastHistory) return 0;
  const donations = await prisma.donation.findMany({
    where: {
      status: "COMPLETED",
      ...(!options.includePastHistory && cutoff ? { createdAt: { gte: cutoff } } : {}),
      constituent: { organizationId },
      ...(options.includePastHistory ? {} : { qbSyncQueueItems: { none: {} } }),
    },
    select: { id: true },
    orderBy: { createdAt: "asc" },
  });
  let created = 0;
  for (const donation of donations) {
    const result = await ensureDonationQueuedForQuickBooks(organizationId, donation.id, options);
    if (result.created || result.reason === "restored-history") created += 1;
  }
  return created;
}

/** Excludes legacy pre-connection queue rows without deleting their audit trail. */
async function excludePreConnectionQueueItems(organizationId: string): Promise<number> {
  const plugin = await getQBPlugin(organizationId);
  if (!plugin) return 0;
  const cutoff = connectionCutoff(plugin);
  if (!cutoff) return 0;
  const rows = await prisma.qBSyncQueueItem.findMany({
    where: {
      organizationId,
      status: { in: ["PENDING", "FAILED"] },
      donation: { is: { createdAt: { lt: cutoff } } },
    },
    select: { id: true },
  });
  if (rows.length === 0) return 0;
  const result = await prisma.qBSyncQueueItem.updateMany({
    where: { id: { in: rows.map((row) => row.id) } },
    data: { status: "SKIPPED", errorMessage: PRE_CONNECTION_EXCLUSION },
  });
  return result.count;
}

// ─── Status ──────────────────────────────────────────────────────────────────

/**
 * GET /api/quickbooks/status
 * Returns whether the plugin is configured (env vars present), enabled, and connected (has tokens).
 * Response: { configured, enabled, connected, realmId, environment }
 */
router.get("/status", async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const plugin = await getQBPlugin(organizationId);
    const runtime = await getQBRuntimeStatus(organizationId);
    const configured = await isQBConfigured(organizationId);
    const config = plugin?.config as Record<string, unknown> | null;
    const [pending, failed, lastSent, organization] = await Promise.all([
      prisma.qBSyncQueueItem.count({ where: { organizationId, status: "PENDING" } }),
      prisma.qBSyncQueueItem.count({ where: { organizationId, status: "FAILED" } }),
      prisma.qBSyncQueueItem.findFirst({ where: { organizationId, status: "SYNCED" }, orderBy: { syncedAt: "desc" }, select: { syncedAt: true } }),
      prisma.organization.findUnique({ where: { id: organizationId }, select: { settings: { select: { timezone: true } } } }),
    ]);

    res.json({
      data: {
        configured,
        summary: { pending, failed, lastSuccessfulSync: lastSent?.syncedAt ?? null },
        timezone: organization?.settings?.timezone ?? "America/Chicago",
        enabled: plugin?.enabled ?? false,
        connected: !!(config?.access_token),
        realmId: config?.realmId ?? null,
        environment: runtime.environment,
        runtimeSource: runtime.source,
        redirectUri: runtime.redirectUri,
        clientIdPreview: runtime.clientIdPreview,
        autoQueue: config?.qbAutoQueue !== false,
        dailySyncEnabled: config?.qbSendingMode === "daily",
        dailySyncHour: Number(config?.qbDailySyncHour ?? 23),
        lastDailySyncDate: typeof config?.qbLastDailySyncDate === "string" ? config.qbLastDailySyncDate : null,
        connectedAt: typeof config?.qbConnectedAt === "string" ? config.qbConnectedAt : null,
      },
    });
  } catch (err) {
    console.error("[QB] status error:", err);
    res.status(500).json({ error: { code: "QB_STATUS_ERROR", message: "Failed to retrieve QB status." } });
  }
});

// ─── Plugin enable / disable ─────────────────────────────────────────────────

/**
 * PUT /api/quickbooks/plugin
 * Body: { enabled: boolean }
 * Enables or disables the QuickBooks plugin. Requires admin role.
 */
router.get("/activity", async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const items = await prisma.auditLog.findMany({ where: { organizationId, action: { startsWith: "QB_" } }, orderBy: { createdAt: "desc" }, take: 100, select: { id: true, action: true, createdAt: true, entityId: true, metadata: true, user: { select: { firstName: true, lastName: true } } } });
    return res.json({ data: { items } });
  } catch { return res.status(500).json({ error: { message: "Could not load QuickBooks activity." } }); }
});

router.put("/settings", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    if (!["manual", "daily"].includes(req.body?.sendingMode)) return res.status(400).json({ error: { message: "Choose manual or daily sending." } });
    const plugin = await getQBPlugin(organizationId);
    const config = configRecord(plugin?.config);
    await prisma.pluginSetting.upsert({
      where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
      create: { organizationId, pluginKey: "quickbooks", enabled: false, config: { qbSendingMode: req.body.sendingMode } },
      update: { config: { ...config, qbSendingMode: req.body.sendingMode, qbDailySyncEnabled: req.body.sendingMode === "daily" } as Prisma.InputJsonValue },
    });
    await logAudit({ action: "QB_SETTINGS_UPDATED", entity: "PluginSetting", entityId: organizationId, organizationId, userId: req.user?.sub, metadata: { sendingMode: req.body.sendingMode } });
    return res.json({ data: { sendingMode: req.body.sendingMode } });
  } catch { return res.status(500).json({ error: { message: "Could not save QuickBooks sending settings." } }); }
});

router.put("/plugin", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const { enabled } = req.body as { enabled: boolean };

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "enabled must be a boolean." } });
    }

    const existingPlugin = await getQBPlugin(organizationId);
    const existingConfig = configRecord(existingPlugin?.config);
    const nextConfig = enabled ? {
      ...existingConfig,
      qbSyncEnabledAt: existingConfig.qbSyncEnabledAt ?? new Date().toISOString(),
      qbAutoQueue: true,
      qbDailySyncEnabled: existingConfig.qbSendingMode === "daily",
      qbDailySyncHour: existingConfig.qbDailySyncHour ?? 23,
    } : existingConfig;
    const plugin = await prisma.pluginSetting.upsert({
      where: { organizationId_pluginKey: { organizationId, pluginKey: "quickbooks" } },
      create: { organizationId, pluginKey: "quickbooks", enabled, config: nextConfig as Prisma.InputJsonValue },
      update: { enabled, config: nextConfig as Prisma.InputJsonValue },
    });

    await logAudit({
      action: enabled ? "PLUGIN_ENABLED" : "PLUGIN_DISABLED",
      entity: "PluginSetting",
      entityId: plugin.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { pluginKey: "quickbooks", enabled },
    });

    return res.json({ data: { enabled: plugin.enabled } });
  } catch (err) {
    console.error("[QB] plugin toggle error:", err);
    return res.status(500).json({ error: { code: "QB_PLUGIN_ERROR", message: "Failed to update plugin setting." } });
  }
});

/**
 * GET /api/quickbooks/runtime-config
 * Returns runtime credential metadata for plugin-level OAuth configuration.
 */
router.get("/runtime-config", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const runtime = await getQBRuntimeStatus(organizationId);
    return res.json({ data: runtime });
  } catch (err) {
    console.error("[QB] runtime-config GET error:", err);
    return res.status(500).json({
      error: { code: "QB_RUNTIME_CONFIG_ERROR", message: "Failed to retrieve QuickBooks runtime config." },
    });
  }
});

/**
 * PUT /api/quickbooks/runtime-config
 * Saves org-level OAuth client credentials used when env vars are unavailable.
 */
router.put("/runtime-config", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const body = req.body as {
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
      environment?: "sandbox" | "production";
    };

    const clientId = String(body.clientId ?? "").trim();
    const clientSecret = String(body.clientSecret ?? "").trim();
    const redirectUri = String(body.redirectUri ?? "").trim();
    const environment = body.environment === "production" ? "production" : "sandbox";

    if (!clientId || !clientSecret) {
      return res.status(400).json({
        error: {
          code: "INVALID_INPUT",
          message: "clientId and clientSecret are required.",
        },
      });
    }

    await saveQBPluginCredentials({
      organizationId,
      clientId,
      clientSecret,
      redirectUri,
      environment,
    });

    await logAudit({
      action: "QB_RUNTIME_CONFIG_SAVED",
      entity: "PluginSetting",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        pluginKey: "quickbooks",
        environment,
        redirectUri,
      },
    });

    const runtime = await getQBRuntimeStatus(organizationId);
    return res.json({ data: runtime });
  } catch (err) {
    console.error("[QB] runtime-config PUT error:", err);
    return res.status(500).json({
      error: { code: "QB_RUNTIME_CONFIG_ERROR", message: "Failed to save QuickBooks runtime config." },
    });
  }
});

// ─── OAuth Flow ───────────────────────────────────────────────────────────────

/**
 * GET /api/quickbooks/auth-uri
 * Returns the QB OAuth authorization URL for the frontend to redirect the user to.
 */
router.get("/auth-uri", requireRole("staff"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    if (!(await isQBConfigured(organizationId))) {
      return res.status(503).json({
        error: {
          code: "QB_NOT_CONFIGURED",
          message: "Ask your administrator to configure QB_CLIENT_ID, QB_CLIENT_SECRET and QB_REDIRECT_URI on the server.",
        },
      });
    }
    const authUri = await buildAuthUri(organizationId);
    return res.json({ data: { authUri } });
  } catch (err) {
    console.error("[QB] auth-uri error:", err);
    return res.status(500).json({ error: { code: "QB_AUTH_URI_ERROR", message: "Failed to generate auth URI." } });
  }
});

/**
 * GET /api/quickbooks/callback
 * Handles the OAuth redirect from Intuit. The organizationId is in the state param.
 * On success, redirects the user to the QuickBooks workspace.
 */
router.get("/callback", async (req, res) => {
  try {
    const state = req.query.state as string;
    if (!state) return res.status(400).send("Missing state parameter");

    const organizationIdFromState = state.split(".", 1)[0];
    const runtime = await getQBRuntimeStatus(organizationIdFromState);
    const callbackUrl = `${runtime.redirectUri.split("?")[0]}?${new URLSearchParams(req.query as Record<string, string>)}`;

    await handleOAuthCallback(callbackUrl, state);
    const organizationId = state.split(".", 1)[0];
    const excludedPreConnection = await excludePreConnectionQueueItems(organizationId);

    await logAudit({
      action: "QB_CONNECTED",
      entity: "PluginSetting",
      entityId: organizationId,
      organizationId,
      metadata: { pluginKey: "quickbooks", excludedPreConnection },
    });

    const frontendOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
    return res.redirect(`${frontendOrigin}/quickbooks-sync?qb=connected`);
  } catch (err) {
    console.error("[QB] callback failed:", err instanceof Error ? err.name : "AuthorizationError");
    const frontendOrigin = process.env.NEXT_PUBLIC_APP_URL ?? process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";
    const reason = err instanceof Error && err.message.includes("original QuickBooks company") ? "company" : err instanceof Error && err.message.includes("canceled") ? "canceled" : "authorization";
    return res.redirect(`${frontendOrigin}/quickbooks-sync?qb=error&reason=${reason}`);
  }
});

/**
 * POST /api/quickbooks/disconnect
 * Revokes QB tokens and removes them from the DB. Plugin stays "enabled".
 */
router.post("/disconnect", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    await revokeTokens(organizationId);

    await logAudit({
      action: "QB_DISCONNECTED",
      entity: "PluginSetting",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: { pluginKey: "quickbooks" },
    });

    return res.json({ data: { message: "QuickBooks disconnected." } });
  } catch (err) {
    console.error("[QB] disconnect error:", err);
    return res.status(500).json({ error: { code: "QB_DISCONNECT_ERROR", message: "Failed to disconnect." } });
  }
});

// ─── Sync Queue CRUD ──────────────────────────────────────────────────────────

/**
 * GET /api/quickbooks/sync-queue
 * Paginated list of sync queue items. Query: status, page, limit.
 */
router.get("/sync-queue", async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const { status, page = "1", limit = "50" } = req.query as Record<string, string>;
    if (!/^\d+$/.test(page) || !/^\d+$/.test(limit) || Number(page) < 1 || Number(limit) < 1 || Number(limit) > 100 || (status && !["PENDING", "SYNCED", "FAILED", "SKIPPED"].includes(status))) return res.status(400).json({ error: { message: "Invalid queue filters or pagination." } });
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where: Prisma.QBSyncQueueItemWhereInput = status
      ? { organizationId, status: status as "PENDING" | "SYNCED" | "FAILED" | "SKIPPED" }
      : { organizationId, status: { in: ["PENDING", "SYNCED", "FAILED"] } };

    const [items, total] = await Promise.all([
      prisma.qBSyncQueueItem.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: parseInt(limit),
        include: {
          donation: {
            select: {
              id: true, amount: true, date: true, paymentMethod: true,
              constituent: { select: { id: true, firstName: true, lastName: true } },
              campaign: { select: { id: true, name: true } },
              designation: { select: { id: true, name: true } },
            },
          },
        },
      }),
      prisma.qBSyncQueueItem.count({ where }),
    ]);

    return res.json({ data: { items, total, page: parseInt(page), limit: parseInt(limit) } });
  } catch (err) {
    console.error("[QB] sync-queue GET error:", err);
    return res.status(500).json({ error: { code: "QB_QUEUE_ERROR", message: "Failed to retrieve sync queue." } });
  }
});

/**
 * POST /api/quickbooks/sync-queue
 * Adds a donation to the QB sync queue.
 * Body: { donationId, customerName?, memo?, qbAccount?, amount? }
 */
router.post("/sync-queue", async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);

    const plugin = await getQBPlugin(organizationId);
    if (!plugin?.enabled) {
      return res.status(403).json({ error: { code: "QB_NOT_ENABLED", message: "QuickBooks plugin is not enabled." } });
    }

    const { donationId, customerName, memo, qbAccount, amount } = req.body as {
      donationId: string;
      customerName?: string;
      memo?: string;
      qbAccount?: string;
      amount?: number;
    };

    if (!donationId) {
      return res.status(400).json({ error: { code: "INVALID_INPUT", message: "donationId is required." } });
    }

    const donation = await prisma.donation.findFirst({
      where: { id: donationId, constituent: { organizationId } },
      include: {
        constituent: { select: { firstName: true, lastName: true } },
        campaign: { select: { name: true } },
        designation: { select: { name: true } },
      },
    });

    if (!donation) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Donation not found." } });
    }
    const cutoff = connectionCutoff(plugin);
    if (!cutoff) {
      return res.status(403).json({ error: { code: "QB_NOT_CONNECTED", message: "Connect QuickBooks before adding donations to its queue." } });
    }
    if (donation.createdAt < cutoff) {
      return res.status(409).json({
        error: {
          code: "QB_HISTORY_CONFIRMATION_REQUIRED",
          message: "This donation predates the QuickBooks connection. An admin must use Sync all past history in the QuickBooks workspace.",
        },
      });
    }

    // A donation remains linked to one immutable queue identity even after a
    // skip or failure. This prevents later retries from creating a second QB row.
    const existing = await prisma.qBSyncQueueItem.findFirst({
      where: { organizationId, donationId },
    });
    if (existing) {
      return res.status(409).json({
        error: { code: "ALREADY_QUEUED", message: "This donation is already in the sync queue." },
      });
    }

    const defaultMemo = [donation.campaign?.name, donation.designation?.name]
      .filter(Boolean).join(" — ") || "Donation";

    const item = await prisma.qBSyncQueueItem.create({
      data: {
        organizationId,
        donationId,
        customerName: customerName ?? `${donation.constituent.firstName} ${donation.constituent.lastName}`,
        memo: memo ?? defaultMemo,
        qbAccount: qbAccount ?? null,
        amount: amount != null ? amount : donation.amount,
      },
    });

    return res.status(201).json({ data: item });
  } catch (err) {
    console.error("[QB] sync-queue POST error:", err);
    return res.status(500).json({ error: { code: "QB_QUEUE_ERROR", message: "Failed to add to queue." } });
  }
});

/**
 * GET /api/quickbooks/sync-queue/:id
 * Returns a single sync queue item.
 */
router.get("/sync-queue/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const item = await prisma.qBSyncQueueItem.findFirst({
      where: { id: req.params.id, organizationId },
      include: {
        donation: {
          select: {
            id: true, amount: true, date: true, paymentMethod: true,
            constituent: { select: { firstName: true, lastName: true } },
            campaign: { select: { name: true } },
            designation: { select: { name: true } },
          },
        },
      },
    });
    if (!item) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Queue item not found." } });
    return res.json({ data: item });
  } catch (err) {
    console.error("[QB] sync-queue GET:id error:", err);
    return res.status(500).json({ error: { code: "QB_QUEUE_ERROR", message: "Failed to retrieve queue item." } });
  }
});

/**
 * PUT /api/quickbooks/sync-queue/:id
 * Edits a PENDING or FAILED queue item's customerName, memo, qbAccount, or amount.
 * Editing a FAILED item resets it to PENDING.
 */
router.put("/sync-queue/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    return await withQuickBooksCompanyLock(organizationId, async () => {
    const { customerName, memo, qbAccount, amount } = req.body as {
      customerName?: string;
      memo?: string;
      qbAccount?: string;
      amount?: number;
    };

    const existing = await prisma.qBSyncQueueItem.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Queue item not found." } });
    if (!["PENDING", "FAILED"].includes(existing.status)) {
      return res.status(400).json({ error: { code: "INVALID_STATE", message: "Only PENDING or FAILED items can be edited." } });
    }

    if ((amount !== undefined && (typeof amount !== "number" || !Number.isFinite(amount) || amount <= 0)) || [customerName, memo, qbAccount].some(value => value !== undefined && (typeof value !== "string" || value.length > 2000))) return res.status(400).json({ error: { message: "Use a positive amount and valid text fields." } });
    if (existing.attemptCount > 0 && amount !== undefined && Number(existing.amount) !== amount) return res.status(409).json({ error: { message: "An attempted gift's amount cannot change. Retry first to reconcile its QuickBooks receipt." } });
    const updated = await prisma.qBSyncQueueItem.updateMany({
      where: { id: req.params.id, organizationId, updatedAt: existing.updatedAt, status: { in: ["PENDING", "FAILED"] } },
      data: {
        ...(customerName !== undefined && { customerName }),
        ...(memo !== undefined && { memo }),
        ...(qbAccount !== undefined && { qbAccount }),
        ...(amount !== undefined && { amount }),
        ...(existing.status === "FAILED" && { status: "PENDING", errorMessage: null }),
      },
    });
    if (updated.count !== 1) return res.status(409).json({ error: { message: "This gift changed. Refresh before editing." } });
    return res.json({ data: { updated: true } });
    });
  } catch (err) {
    console.error("[QB] sync-queue PUT error:", err);
    return res.status(500).json({ error: { code: "QB_QUEUE_ERROR", message: "Failed to update queue item." } });
  }
});

/**
 * DELETE /api/quickbooks/sync-queue/:id
 * Soft-deletes a queue item by marking it SKIPPED. SYNCED items cannot be removed.
 */
router.delete("/sync-queue/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    return await withQuickBooksCompanyLock(organizationId, async () => {
    const existing = await prisma.qBSyncQueueItem.findFirst({
      where: { id: req.params.id, organizationId },
    });
    if (!existing) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Queue item not found." } });
    if (existing.status === "SYNCED") {
      return res.status(400).json({ error: { code: "INVALID_STATE", message: "Cannot remove an already-synced item." } });
    }

    const removed = await prisma.qBSyncQueueItem.updateMany({
      where: { id: req.params.id, organizationId, updatedAt: existing.updatedAt, status: { not: "SYNCED" } },
      data: { status: "SKIPPED" },
    });
    if (removed.count !== 1) return res.status(409).json({ error: { message: "This gift changed. Refresh before removing." } });
    return res.json({ data: { message: "Item removed from queue." } });
    });
  } catch (err) {
    console.error("[QB] sync-queue DELETE error:", err);
    return res.status(500).json({ error: { code: "QB_QUEUE_ERROR", message: "Failed to remove queue item." } });
  }
});

// ─── Sync Operations ──────────────────────────────────────────────────────────

/**
 * Attempts to sync one QBSyncQueueItem to QuickBooks.
 * Updates item status, syncedAt, errorMessage, and attemptCount in DB.
 */
// Dedicated transactional row lock: released automatically on rollback or process loss.
// Token refresh and queue writes use the regular client to avoid locking themselves.
async function withQuickBooksCompanyLock<T>(organizationId: string, action: () => Promise<T>): Promise<T> {
  await prisma.$executeRaw`INSERT IGNORE INTO QuickBooksSyncMutex (organizationId) VALUES (${organizationId})`;
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT organizationId FROM QuickBooksSyncMutex WHERE organizationId = ${organizationId} FOR UPDATE`;
    return action();
  }, { timeout: 300_000, maxWait: 5000 });
}

export async function syncOneQuickBooksItem(itemId: string, organizationId: string, options: { includePastHistory?: boolean; userId?: string; background?: boolean } = {}): Promise<{ success: boolean; qbEntityId?: string; error?: string }> {
  return withQuickBooksCompanyLock(organizationId, async () => {
    const plugin = await getQBPlugin(organizationId);
    if (!plugin?.enabled || !configRecord(plugin.config).access_token) return { success: false, error: "QuickBooks is disabled or disconnected." };
    if (options.background && configRecord(plugin.config).qbSendingMode !== "daily") return { success: false, error: "Daily sending is paused." };
    const existing = await prisma.qBSyncQueueItem.findFirst({ where: { id: itemId, organizationId } });
    if (existing?.status === "SYNCED") return { success: true, qbEntityId: existing.qbEntityId ?? undefined };
    const result = await syncOneQuickBooksItemUnlocked(itemId, organizationId, options);
    await logAudit({ action: result.success ? "QB_SYNCED" : "QB_SYNC_FAILED", entity: "QBSyncQueueItem", entityId: itemId, organizationId, userId: options.userId, metadata: { source: options.userId ? "staff" : options.background ? "daily" : "system", qbEntityId: result.qbEntityId ?? null } });
    return result;
  });
}

async function syncOneQuickBooksItemUnlocked(
  itemId: string,
  organizationId: string,
  options: { includePastHistory?: boolean } = {},
): Promise<{ success: boolean; qbEntityId?: string; error?: string }> {
  const item = await prisma.qBSyncQueueItem.findFirst({
    where: { id: itemId, organizationId },
    include: {
      donation: {
        include: { constituent: { select: { firstName: true, lastName: true } } },
      },
    },
  });

  if (!item) return { success: false, error: "Queue item not found." };
  if (item.status === "SYNCED") return { success: true, qbEntityId: item.qbEntityId ?? undefined };
  if (item.status === "SKIPPED") return { success: false, error: "Item is skipped." };
  const plugin = await getQBPlugin(organizationId);
  const cutoff = plugin ? connectionCutoff(plugin) : null;
  if (!options.includePastHistory && !cutoff) {
    return { success: false, error: "QuickBooks is not connected." };
  }
  if (!options.includePastHistory && (!item.donation || item.donation.createdAt < cutoff!)) {
    await prisma.qBSyncQueueItem.update({
      where: { id: item.id },
      data: { status: "SKIPPED", errorMessage: PRE_CONNECTION_EXCLUSION },
    });
    return { success: false, error: PRE_CONNECTION_EXCLUSION };
  }

  if (!item.donation || item.donation.status !== "COMPLETED") return { success: false, error: "Only completed donations can be sent." };
  if (!Number.isFinite(Number(item.amount ?? item.donation.amount)) || Number(item.amount ?? item.donation.amount) <= 0) return { success: false, error: "Donation amount must be positive." };

  // Increment attempt count before trying
  await prisma.qBSyncQueueItem.update({
    where: { id: itemId },
    data: { attemptCount: { increment: 1 } },
  });

  try {
    const payload: QBDonationPayload = {
      donationId: item.donationId ?? item.id,
      queueItemId: item.id,
      customerName: item.customerName
        ?? `${item.donation?.constituent.firstName ?? "Unknown"} ${item.donation?.constituent.lastName ?? "Donor"}`,
      amount: Number(item.amount ?? item.donation?.amount ?? 0),
      memo: item.memo ?? undefined,
      qbAccount: item.qbAccount ?? undefined,
      date: item.donation?.date
        ? new Date(item.donation.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
    };

    const qbEntityId = await pushDonationToQB(organizationId, payload);

    await prisma.qBSyncQueueItem.update({
      where: { id: itemId },
      data: { status: "SYNCED", qbEntityId, syncedAt: new Date(), errorMessage: null },
    });

    return { success: true, qbEntityId };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await prisma.qBSyncQueueItem.update({
      where: { id: itemId },
      data: { status: "FAILED", errorMessage },
    });
    return { success: false, error: errorMessage };
  }
}

async function syncPendingQuickBooksItems(
  organizationId: string,
  options: { includePastHistory?: boolean; userId?: string } = {},
) {
  const pendingItems = await prisma.qBSyncQueueItem.findMany({
    where: { organizationId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  let synced = 0;
  let failed = 0;
  const errors: { id: string; error: string }[] = [];
  for (const item of pendingItems) {
    const result = await syncOneQuickBooksItem(item.id, organizationId, options);
    if (result.success) synced += 1;
    else {
      failed += 1;
      errors.push({ id: item.id, error: result.error ?? "Unknown error" });
    }
    if (pendingItems.length > 1) await new Promise((resolve) => setTimeout(resolve, 400));
  }
  return { synced, failed, errors, total: pendingItems.length };
}

/**
 * POST /api/quickbooks/sync-queue/sync-all
 * Syncs all PENDING items sequentially. Returns { synced, failed, errors, total }.
 * Sequential (not parallel) to respect QB rate limits (150 req/min).
 */
router.post("/sync-queue/sync-all", async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const plugin = await getQBPlugin(organizationId);

    if (!plugin?.enabled) {
      return res.status(403).json({ error: { code: "QB_NOT_ENABLED", message: "Plugin not enabled." } });
    }
    const config = plugin.config as Record<string, unknown> | null;
    if (!config?.access_token) {
      return res.status(403).json({ error: { code: "QB_NOT_CONNECTED", message: "QuickBooks not connected." } });
    }

    const queued = await queueEligibleQuickBooksDonations(organizationId);
    const result = await syncPendingQuickBooksItems(organizationId, { userId: req.user?.sub });
    if (result.total === 0) {
      return res.json({ data: { synced: 0, failed: 0, queued, total: 0, message: "No pending items to sync." } });
    }

    await logAudit({
      action: "QB_SYNC_ALL",
      entity: "QBSyncQueue",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: { synced: result.synced, failed: result.failed, total: result.total, includePastHistory: false },
    });

    return res.json({ data: { ...result, queued } });
  } catch (err) {
    console.error("[QB] sync-all error:", err);
    return res.status(500).json({ error: { code: "QB_SYNC_ERROR", message: "Sync-all failed." } });
  }
});

/** POST /api/quickbooks/sync-queue/sync-history — Explicit admin-only historical import and sync. */
router.post("/sync-queue/sync-history", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    if (req.body?.confirmPastHistory !== true) {
      return res.status(400).json({
        error: { code: "CONFIRMATION_REQUIRED", message: "Confirm that all completed donation history should be pushed to QuickBooks." },
      });
    }
    const plugin = await getQBPlugin(organizationId);
    const config = configRecord(plugin?.config);
    if (!plugin?.enabled || !config.access_token) {
      return res.status(403).json({ error: { code: "QB_NOT_CONNECTED", message: "Connect QuickBooks before syncing history." } });
    }

    const queued = await queueEligibleQuickBooksDonations(organizationId, { includePastHistory: true });
    const result = await syncPendingQuickBooksItems(organizationId, { includePastHistory: true, userId: req.user?.sub });
    await logAudit({
      action: "QB_SYNC_ALL_HISTORY",
      entity: "QBSyncQueue",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: { queued, synced: result.synced, failed: result.failed, total: result.total, confirmed: true },
    });
    return res.json({ data: { ...result, queued } });
  } catch (err) {
    console.error("[QB] sync-history error:", err);
    return res.status(500).json({ error: { code: "QB_SYNC_HISTORY_ERROR", message: "Historical QuickBooks sync failed." } });
  }
});

/**
 * POST /api/quickbooks/sync-queue/:id/sync
 * Manually syncs a single PENDING or FAILED queue item.
 */
router.post("/sync-queue/:id/sync", async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const plugin = await getQBPlugin(organizationId);

    if (!plugin?.enabled) {
      return res.status(403).json({ error: { code: "QB_NOT_ENABLED", message: "Plugin not enabled." } });
    }
    const config = plugin.config as Record<string, unknown> | null;
    if (!config?.access_token) {
      return res.status(403).json({ error: { code: "QB_NOT_CONNECTED", message: "QuickBooks not connected." } });
    }

    const result = await syncOneQuickBooksItem(req.params.id, organizationId, { userId: req.user?.sub });
    if (!result.success) {
      return res.status(422).json({ error: { code: "QB_SYNC_FAILED", message: result.error ?? "Sync failed." } });
    }

    return res.json({ data: { qbEntityId: result.qbEntityId, message: "Synced to QuickBooks." } });
  } catch (err) {
    console.error("[QB] sync:id error:", err);
    return res.status(500).json({ error: { code: "QB_SYNC_ERROR", message: "Sync failed." } });
  }
});

export default router;
