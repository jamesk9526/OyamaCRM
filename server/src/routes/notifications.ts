/** Durable user/tenant-scoped inbox, reversible read/snooze actions, and a live change stream. */
import { Router, type Request, type Response } from "express";
import type { Prisma } from "@prisma/client";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { isSchemaDriftError, migrationRequiredMessage } from "../lib/prisma-runtime-errors.js";
import { requireAuth } from "../middleware/requireAuth.js";

import { requireRole } from "../middleware/requireRole.js";
import { validNotificationSubject } from "../services/notification-email.js";

const router = Router();
router.use(requireAuth);
router.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
const select = { id: true, sourceType: true, title: true, message: true, href: true, createdAt: true, severity: true, status: true, module: true, actionLabel: true, snoozedUntil: true, expiresAt: true } as const;
type Notice = Prisma.NotificationGetPayload<{ select: typeof select }>;
const apiItem = (item: Notice) => ({ id: item.id, type: item.sourceType, title: item.title, message: item.message, href: item.href,
  createdAt: item.createdAt.toISOString(), priority: ["HIGH", "CRITICAL"].includes(item.severity) ? "high" : item.severity === "MEDIUM" ? "medium" : "low",
  status: item.status === "READ" ? "read" : ["DISMISSED", "ARCHIVED"].includes(item.status) ? "dismissed" : "unread", module: item.module,
  actionLabel: item.actionLabel, snoozedUntil: item.snoozedUntil?.toISOString() ?? null, expiresAt: item.expiresAt?.toISOString() ?? null });
const unexpired = (now: Date): Prisma.NotificationWhereInput => ({ OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] });
const awake = (now: Date): Prisma.NotificationWhereInput => ({ OR: [{ snoozedUntil: null }, { snoozedUntil: { lte: now } }] });
function moduleScope(value: unknown) {
  const workspace = String(value ?? "all").toLowerCase();
  if (!/^[a-z][a-z0-9-]{0,39}$/.test(workspace)) throw Object.assign(new Error("Invalid workspace filter."), { status: 400 });
  return workspace === "all" ? {} : { module: workspace };
}
async function identity(req: Request) {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId || !req.user?.sub) throw Object.assign(new Error("An authenticated organization is required."), { status: 403 });
  return { organizationId, userId: req.user.sub, archivedAt: null };
}
function fail(res: Response, error: unknown, fallback = "Notifications could not be updated.") {
  if (isSchemaDriftError(error) || ["P2021", "P2022"].includes(String((error as { code?: unknown })?.code))) return res.status(503).json({ error: { code: "MIGRATION_REQUIRED", message: migrationRequiredMessage("Notifications") } });
  const known = error as { status?: number; message?: string };
  return res.status(known.status ?? 500).json({ error: { code: known.status === 400 ? "BAD_REQUEST" : "NOTIFICATION_ERROR", message: known.status ? known.message : fallback } });
}
function route(work: (req: Request, res: Response) => Promise<unknown>) {
  return (req: Request, res: Response) => { void work(req, res).catch((error) => { if (!res.headersSent) fail(res, error); }); };
}

router.get("/email-settings", requireRole("admin"), route(async (req, res) => {
  const scope = await identity(req);
  const user = await prisma.user.findFirst({ where: { id: scope.userId, organizationId: scope.organizationId, active: true, role: "admin" } });
  if (!user) throw Object.assign(new Error("An active administrator account is required."), { status: 403 });
  const subscription = await prisma.notificationEmailSubscription.findFirst({ where: { userId: scope.userId, organizationId: scope.organizationId } });
  const deliveries = subscription ? await prisma.notificationEmailDelivery.findMany({ where: { subscriptionId: subscription.id }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, status: true, createdAt: true, completedAt: true, notification: { select: { title: true } } } }) : [];
  res.json({ enabled: subscription?.enabled ?? false, subjectTemplate: subscription?.subjectTemplate ?? "[OyamaCRM] {title}", minimumSeverity: subscription?.minimumSeverity ?? "ALL", deliveries });
}));
router.put("/email-settings", requireRole("admin"), route(async (req, res) => {
  const scope = await identity(req);
  const { enabled, subjectTemplate, minimumSeverity } = req.body ?? {};
  if (typeof enabled !== "boolean" || !validNotificationSubject(subjectTemplate) || !["ALL", "HIGH"].includes(minimumSeverity)) throw Object.assign(new Error("Choose a valid subject (up to 180 characters) and severity. Supported tokens: {title}, {module}, {severity}."), { status: 400 });
  const user = await prisma.user.findFirst({ where: { id: scope.userId, organizationId: scope.organizationId, active: true, role: "admin" } });
  if (!user) throw Object.assign(new Error("An active administrator account is required."), { status: 403 });
  const existing = await prisma.notificationEmailSubscription.findUnique({ where: { userId: scope.userId } });
  if (existing && existing.organizationId !== scope.organizationId) throw Object.assign(new Error("Subscription organization mismatch."), { status: 403 });
  const data = { enabled, subjectTemplate: subjectTemplate.trim(), minimumSeverity, ...(!existing?.enabled && enabled ? { enabledAt: new Date() } : {}) };
  await prisma.notificationEmailSubscription.upsert({ where: { userId: scope.userId }, create: { organizationId: scope.organizationId, userId: scope.userId, ...data }, update: data });
  res.json({ saved: true });
}));

router.get("/", route(async (req, res) => {
  const scope = await identity(req); const now = new Date(); const workspace = moduleScope(req.query.module ?? "donor");
  const status = String(req.query.status ?? "active").toLowerCase();
  if (!["active", "unread", "snoozed", "all"].includes(status)) throw Object.assign(new Error("Choose active, unread, snoozed, or all notifications."), { status: 400 });
  const page = Number(req.query.page ?? 1); const pageSize = Number(req.query.pageSize ?? 40);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw Object.assign(new Error("Invalid notification page."), { status: 400 });
  const where: Prisma.NotificationWhereInput = { ...scope, ...workspace,
    ...(status === "all" ? {} : { status: status === "unread" ? "UNREAD" : { in: ["UNREAD", "READ"] }, AND: [unexpired(now), status === "snoozed" ? { snoozedUntil: { gt: now } } : awake(now)] }) };
  const [items, total, unreadCount, modules] = await Promise.all([
    prisma.notification.findMany({ where, select, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
    prisma.notification.count({ where }),
    prisma.notification.count({ where: { ...scope, ...workspace, status: "UNREAD", AND: [unexpired(now), awake(now)] } }),
    prisma.notification.findMany({ where: scope, select: { module: true }, distinct: ["module"], orderBy: { module: "asc" } }),
  ]);
  res.json({ items: items.map(apiItem), unreadCount, total, page, pageSize, totalPages: Math.max(1, Math.ceil(total / pageSize)), modules: modules.map((row) => row.module) });
}));

router.get("/unread-count", route(async (req, res) => {
  const scope = await identity(req); const now = new Date();
  const unreadCount = await prisma.notification.count({ where: { ...scope, ...moduleScope(req.query.module ?? "donor"), status: "UNREAD", AND: [unexpired(now), awake(now)] } });
  res.json({ unreadCount });
}));

router.post("/mark-all-read", route(async (req, res) => {
  const scope = await identity(req); const now = new Date();
  const result = await prisma.notification.updateMany({ where: { ...scope, ...moduleScope(req.body?.module ?? req.query.module), status: "UNREAD", AND: [unexpired(now), awake(now)] }, data: { status: "READ", readAt: now } });
  res.json({ updated: result.count });
}));

router.patch("/:id/:action", route(async (req, res) => {
  const scope = await identity(req); const now = new Date(); const action = String(req.params.action);
  if (!["read", "unread", "dismiss", "snooze", "unsnooze"].includes(action)) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification action not found." } });
  let data: Prisma.NotificationUpdateManyMutationInput;
  if (action === "snooze") {
    const until = new Date(req.body?.until ?? now.getTime() + 3600000);
    if (!Number.isFinite(until.getTime()) || until <= now || until.getTime() - now.getTime() > 30 * 86400000) throw Object.assign(new Error("Choose a future snooze time within 30 days."), { status: 400 });
    // Keep UNREAD while asleep so the badge returns when the snooze ends.
    data = { snoozedUntil: until, status: "UNREAD", readAt: null };
  } else if (action === "dismiss") data = { status: "DISMISSED", dismissedAt: now, snoozedUntil: null };
  else if (action === "read") data = { status: "READ", readAt: now };
  else data = { status: "UNREAD", readAt: null, ...(action === "unsnooze" ? { snoozedUntil: null } : {}) };
  const result = await prisma.notification.updateMany({ where: { ...scope, id: String(req.params.id), status: { in: ["UNREAD", "READ"] }, AND: [unexpired(now)] }, data });
  if (!result.count) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Notification is unavailable or already dismissed." } });
  res.json({ ok: true, ...(action === "snooze" ? { snoozedUntil: data.snoozedUntil } : {}) });
}));

/** Stream only change metadata; no notification content leaves a user's scoped list. */
router.get("/sse", async (req, res) => {
  let closed = false; let polling = false; let timer: NodeJS.Timeout | undefined;
  try {
    const scope = await identity(req); const workspace = moduleScope(req.query.module);
    const signature = async () => {
      const now = new Date(); const where: Prisma.NotificationWhereInput = { ...scope, ...workspace, status: { in: ["UNREAD", "READ"] }, AND: [unexpired(now), awake(now)] };
      const [items, count, unread] = await Promise.all([
        prisma.notification.findMany({ where, select: { id: true, status: true, snoozedUntil: true, readAt: true }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 40 }),
        prisma.notification.count({ where }), prisma.notification.count({ where: { ...where, status: "UNREAD" } }),
      ]);
      return JSON.stringify({ items, count, unread });
    };
    let previous = await signature();
    res.setHeader("Content-Type", "text/event-stream"); res.setHeader("Cache-Control", "no-cache, no-transform"); res.setHeader("Connection", "keep-alive"); res.setHeader("X-Accel-Buffering", "no"); res.flushHeaders?.();
    res.write("event: ready\ndata: {}\n\n");
    const close = () => { closed = true; if (timer) clearInterval(timer); if (!res.writableEnded) res.end(); };
    res.on("close", close);
    timer = setInterval(() => {
      if (closed || polling) return; polling = true;
      void (async () => {
        try {
          const account = await prisma.user.findFirst({ where: { id: scope.userId, organizationId: scope.organizationId, active: true }, select: { id: true } });
          const expiresAt = (req.user as { exp?: unknown } | undefined)?.exp;
          if (!account || (typeof expiresAt === "number" && expiresAt * 1000 <= Date.now())) { close(); return; }
          const next = await signature(); if (closed) return;
          res.write(next !== previous ? "event: changed\ndata: {}\n\n" : ": keepalive\n\n"); previous = next;
        } catch { if (!closed) res.write("event: unavailable\ndata: {}\n\n"); }
        finally { polling = false; }
      })();
    }, 15000);
    timer.unref?.();
  } catch (error) { if (!res.headersSent) fail(res, error, "Notification stream unavailable."); else if (!res.writableEnded) res.end(); }
});

export default router;
