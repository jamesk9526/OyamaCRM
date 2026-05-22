/**
 * Durable notification routes for TopBar and work-engine deep links.
 * Supports read/dismiss/snooze actions and unread badge counts.
 */
import { Router } from "express";
import type { NotificationSeverity, NotificationStatus } from "@prisma/client";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { isSchemaDriftError, migrationRequiredMessage } from "../lib/prisma-runtime-errors.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

interface NotificationApiItem {
  id: string;
  type: string;
  title: string;
  message: string;
  href: string;
  createdAt: string;
  priority: "low" | "medium" | "high";
  status: "unread" | "read" | "dismissed";
  module: string;
  actionLabel: string | null;
  snoozedUntil: string | null;
}

function normalizePriority(severity: NotificationSeverity): NotificationApiItem["priority"] {
  if (severity === "CRITICAL" || severity === "HIGH") return "high";
  if (severity === "MEDIUM") return "medium";
  return "low";
}

function normalizeStatus(status: NotificationStatus): NotificationApiItem["status"] {
  if (status === "READ") return "read";
  if (status === "DISMISSED" || status === "ARCHIVED") return "dismissed";
  return "unread";
}

function toApiItem(item: {
  id: string;
  sourceType: string;
  title: string;
  message: string;
  href: string;
  createdAt: Date;
  severity: NotificationSeverity;
  status: NotificationStatus;
  module: string;
  actionLabel: string | null;
  snoozedUntil: Date | null;
}): NotificationApiItem {
  return {
    id: item.id,
    type: item.sourceType,
    title: item.title,
    message: item.message,
    href: item.href,
    createdAt: item.createdAt.toISOString(),
    priority: normalizePriority(item.severity),
    status: normalizeStatus(item.status),
    module: item.module,
    actionLabel: item.actionLabel,
    snoozedUntil: item.snoozedUntil ? item.snoozedUntil.toISOString() : null,
  };
}

async function buildNotificationStreamSignature(args: { organizationId: string; userId: string }) {
  const now = new Date();
  const [latestActive, unreadCount, activeCount] = await Promise.all([
    prisma.notification.findFirst({
      where: {
        organizationId: args.organizationId,
        userId: args.userId,
        archivedAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true, status: true },
    }),
    prisma.notification.count({
      where: {
        organizationId: args.organizationId,
        userId: args.userId,
        status: "UNREAD",
        archivedAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
    }),
    prisma.notification.count({
      where: {
        organizationId: args.organizationId,
        userId: args.userId,
        archivedAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
      },
    }),
  ]);

  return JSON.stringify({
    latestId: latestActive?.id ?? null,
    latestCreatedAt: latestActive?.createdAt.toISOString() ?? null,
    latestStatus: latestActive?.status ?? null,
    unreadCount,
    activeCount,
  });
}

/** GET /api/notifications?module=donor&status=active|all|unread */
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const organizationId = await resolveOrganizationId({ req });
    if (!userId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }
    if (!organizationId) {
      res.json({ items: [], unreadCount: 0 });
      return;
    }

    const moduleFilter = String(req.query.module ?? "donor").toLowerCase();
    const statusFilter = String(req.query.status ?? "active").toLowerCase();
    const now = new Date();

    const where = {
      organizationId,
      userId,
      ...(moduleFilter === "all" ? {} : { module: moduleFilter }),
      ...(statusFilter === "all" ? {} : statusFilter === "unread" ? { status: "UNREAD" as NotificationStatus } : { status: { in: ["UNREAD", "READ"] as NotificationStatus[] } }),
      OR: [
        { snoozedUntil: null },
        { snoozedUntil: { lte: now } },
      ],
      archivedAt: null,
    };

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 40,
        select: {
          id: true,
          sourceType: true,
          title: true,
          message: true,
          href: true,
          createdAt: true,
          severity: true,
          status: true,
          module: true,
          actionLabel: true,
          snoozedUntil: true,
        },
      }),
      prisma.notification.count({
        where: {
          organizationId,
          userId,
          status: "UNREAD",
          OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
          archivedAt: null,
          ...(moduleFilter === "all" ? {} : { module: moduleFilter }),
        },
      }),
    ]);

    res.json({
      items: items.map(toApiItem),
      unreadCount,
    });
  } catch (err) {
    if (isSchemaDriftError(err)) {
      res.status(503).json({
        error: {
          code: "MIGRATION_REQUIRED",
          message: migrationRequiredMessage("Notifications"),
        },
      });
      return;
    }

    console.error("[notifications] GET / error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load notifications" } });
  }
});

/** GET /api/notifications/unread-count?module=donor */
router.get("/unread-count", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const organizationId = await resolveOrganizationId({ req });
    if (!userId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }
    if (!organizationId) {
      res.json({ unreadCount: 0 });
      return;
    }

    const moduleFilter = String(req.query.module ?? "donor").toLowerCase();
    const now = new Date();

    const unreadCount = await prisma.notification.count({
      where: {
        organizationId,
        userId,
        status: "UNREAD",
        archivedAt: null,
        OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }],
        ...(moduleFilter === "all" ? {} : { module: moduleFilter }),
      },
    });

    res.json({ unreadCount });
  } catch (err) {
    if (isSchemaDriftError(err)) {
      res.status(503).json({
        error: {
          code: "MIGRATION_REQUIRED",
          message: migrationRequiredMessage("Notifications"),
        },
      });
      return;
    }

    console.error("[notifications] GET /unread-count error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load unread count" } });
  }
});

/** GET /api/notifications/sse — lightweight change stream for TopBar notification refreshes. */
router.get("/sse", async (req, res) => {
  const userId = req.user?.sub;
  const organizationId = await resolveOrganizationId({ req });
  if (!userId) {
    res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
    return;
  }
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  let closed = false;
  let lastSignature = await buildNotificationStreamSignature({ organizationId, userId });
  res.write(`event: ready\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  const poll = async () => {
    if (closed) return;
    try {
      const nextSignature = await buildNotificationStreamSignature({ organizationId, userId });
      if (nextSignature !== lastSignature) {
        lastSignature = nextSignature;
        res.write(`event: changed\ndata: ${nextSignature}\n\n`);
      } else {
        res.write(`event: ping\ndata: {}\n\n`);
      }
    } catch (err) {
      res.write(`event: error\ndata: ${JSON.stringify({ message: err instanceof Error ? err.message : "Notification stream failed" })}\n\n`);
    }
  };

  const interval = setInterval(() => {
    void poll();
  }, 15000);

  req.on("close", () => {
    closed = true;
    clearInterval(interval);
    res.end();
  });
});

/** POST /api/notifications/mark-all-read */
router.post("/mark-all-read", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const organizationId = await resolveOrganizationId({ req });
    if (!userId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }
    if (!organizationId) {
      res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
      return;
    }

    const moduleFilter = String(req.body?.module ?? req.query.module ?? "all").toLowerCase();

    const result = await prisma.notification.updateMany({
      where: {
        organizationId,
        userId,
        status: "UNREAD",
        archivedAt: null,
        ...(moduleFilter === "all" ? {} : { module: moduleFilter }),
      },
      data: {
        status: "READ",
        readAt: new Date(),
      },
    });

    res.json({ updated: result.count });
  } catch (err) {
    if (isSchemaDriftError(err)) {
      res.status(503).json({
        error: {
          code: "MIGRATION_REQUIRED",
          message: migrationRequiredMessage("Notifications"),
        },
      });
      return;
    }

    console.error("[notifications] POST /mark-all-read error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to mark notifications read" } });
  }
});

/** PATCH /api/notifications/:id/read */
router.patch("/:id/read", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const organizationId = await resolveOrganizationId({ req });
    if (!userId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }
    if (!organizationId) {
      res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
      return;
    }

    const id = req.params.id;
    const updated = await prisma.notification.updateMany({
      where: { id, organizationId, userId, archivedAt: null },
      data: { status: "READ", readAt: new Date() },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    if (isSchemaDriftError(err)) {
      res.status(503).json({
        error: {
          code: "MIGRATION_REQUIRED",
          message: migrationRequiredMessage("Notifications"),
        },
      });
      return;
    }

    console.error("[notifications] PATCH /:id/read error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update notification" } });
  }
});

/** PATCH /api/notifications/:id/dismiss */
router.patch("/:id/dismiss", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const organizationId = await resolveOrganizationId({ req });
    if (!userId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }
    if (!organizationId) {
      res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
      return;
    }

    const id = req.params.id;
    const updated = await prisma.notification.updateMany({
      where: { id, organizationId, userId, archivedAt: null },
      data: {
        status: "DISMISSED",
        dismissedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
      return;
    }

    res.json({ ok: true });
  } catch (err) {
    if (isSchemaDriftError(err)) {
      res.status(503).json({
        error: {
          code: "MIGRATION_REQUIRED",
          message: migrationRequiredMessage("Notifications"),
        },
      });
      return;
    }

    console.error("[notifications] PATCH /:id/dismiss error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to dismiss notification" } });
  }
});

/** PATCH /api/notifications/:id/snooze */
router.patch("/:id/snooze", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const organizationId = await resolveOrganizationId({ req });
    if (!userId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }
    if (!organizationId) {
      res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
      return;
    }

    const id = req.params.id;
    const untilRaw = req.body?.until;
    const until = typeof untilRaw === "string" || untilRaw instanceof Date
      ? new Date(untilRaw)
      : new Date(Date.now() + 60 * 60 * 1000);

    if (Number.isNaN(until.getTime())) {
      res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invalid snooze date" } });
      return;
    }

    const updated = await prisma.notification.updateMany({
      where: { id, organizationId, userId, archivedAt: null },
      data: {
        snoozedUntil: until,
        status: "READ",
        readAt: new Date(),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification not found" } });
      return;
    }

    res.json({ ok: true, snoozedUntil: until.toISOString() });
  } catch (err) {
    if (isSchemaDriftError(err)) {
      res.status(503).json({
        error: {
          code: "MIGRATION_REQUIRED",
          message: migrationRequiredMessage("Notifications"),
        },
      });
      return;
    }

    console.error("[notifications] PATCH /:id/snooze error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to snooze notification" } });
  }
});

export default router;
