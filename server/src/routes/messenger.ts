/**
 * CRM Messenger routes — staff-to-staff direct messaging within OyamaCRM.
 *
 * Routes:
 *   GET  /api/messenger/enabled             — check if messenger plugin is on for the org
 *   GET  /api/messenger/users               — list other org users to start a DM with
 *   GET  /api/messenger/threads             — list threads the caller is a participant of
 *   POST /api/messenger/threads             — get or create a DM thread with another user
 *   GET  /api/messenger/threads/:threadId/messages — paginated messages for a thread
 *   POST /api/messenger/threads/:threadId/messages — send a message
 *   PATCH /api/messenger/threads/:threadId/read    — mark all messages as read
 *   GET  /api/messenger/unread-count        — total unread message count across all threads
 *   GET  /api/messenger/sse                 — SSE stream; pushes "message" events in real time
 */
import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { resolveOrganizationId } from "../lib/organization.js";

const router = Router();

// ─── In-process SSE subscriber registry ─────────────────────────────────────
// Maps orgId → Set of { userId, res } so we can fan-out new messages to all
// connected clients in the same org.

interface SseSubscriber {
  userId: string;
  res: Response;
}

const sseSubscribers = new Map<string, Set<SseSubscriber>>();

function addSseSubscriber(orgId: string, subscriber: SseSubscriber) {
  if (!sseSubscribers.has(orgId)) {
    sseSubscribers.set(orgId, new Set());
  }
  sseSubscribers.get(orgId)!.add(subscriber);
}

function removeSseSubscriber(orgId: string, subscriber: SseSubscriber) {
  sseSubscribers.get(orgId)?.delete(subscriber);
}

/** Push a JSON event to all connected SSE clients in an org. */
function broadcastToOrg(orgId: string, eventName: string, data: unknown) {
  const subscribers = sseSubscribers.get(orgId);
  if (!subscribers) return;
  const payload = `event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const sub of subscribers) {
    try {
      sub.res.write(payload);
    } catch {
      // Client disconnected; will be cleaned up on close event.
    }
  }
}

function getAuthUserId(req: Request): string {
  const subject = req.user?.sub;
  if (Array.isArray(subject)) return String(subject[0] || "");
  return String(subject || "");
}

// ─── Helper: check if messenger plugin is enabled for the org ────────────────

async function isMessengerEnabled(orgId: string): Promise<boolean> {
  const setting = await prisma.pluginSetting.findUnique({
    where: { organizationId_pluginKey: { organizationId: orgId, pluginKey: "messenger" } },
    select: { enabled: true },
  });
  // Messenger is enabled by default when no explicit setting row exists yet.
  return setting === null ? true : setting.enabled;
}

// ─── GET /enabled ─────────────────────────────────────────────────────────────

router.get("/enabled", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await resolveOrganizationId({ req });
    if (!orgId) return res.status(400).json({ error: "Organization not found" });
    const enabled = await isMessengerEnabled(orgId);
    return res.json({ enabled });
  } catch (err) {
    console.error("[messenger] GET /enabled error", err);
    return res.status(500).json({ error: "Internal server error" });

  // ─── PUT /plugin ──────────────────────────────────────────────────────────────
  // Admin endpoint to enable or disable the messenger integration.

  router.put("/plugin", requireAuth, async (req: Request, res: Response) => {
    try {
      const orgId = await resolveOrganizationId({ req });
      if (!orgId) return res.status(400).json({ error: "Organization not found" });

      // Require admin or manager role.
      const userRole = req.user?.role ?? "";
      if (!["admin", "manager", "super_admin"].includes(userRole)) {
        return res.status(403).json({ error: "Admin role required to change Messenger settings." });
      }

      const { enabled } = req.body as { enabled?: boolean };
      if (typeof enabled !== "boolean") {
        return res.status(400).json({ error: "enabled (boolean) is required" });
      }

      await prisma.pluginSetting.upsert({
        where: { organizationId_pluginKey: { organizationId: orgId, pluginKey: "messenger" } },
        create: { organizationId: orgId, pluginKey: "messenger", enabled },
        update: { enabled },
      });

      return res.json({ enabled });
    } catch (err) {
      console.error("[messenger] PUT /plugin error", err);
      return res.status(500).json({ error: "Internal server error" });
    }
  });
  }
});

// ─── GET /users ───────────────────────────────────────────────────────────────

router.get("/users", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await resolveOrganizationId({ req });
    if (!orgId) return res.status(400).json({ error: "Organization not found" });
    if (!(await isMessengerEnabled(orgId))) {
      return res.status(403).json({ error: "Messenger is disabled for this organization." });
    }

    const users = await prisma.user.findMany({
      where: { organizationId: orgId, active: true, id: { not: getAuthUserId(req) } },
      select: { id: true, firstName: true, lastName: true, email: true, avatarUrl: true, role: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    });

    return res.json({ users });
  } catch (err) {
    console.error("[messenger] GET /users error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /threads ─────────────────────────────────────────────────────────────

router.get("/threads", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await resolveOrganizationId({ req });
    if (!orgId) return res.status(400).json({ error: "Organization not found" });
    if (!(await isMessengerEnabled(orgId))) {
      return res.status(403).json({ error: "Messenger is disabled for this organization." });
    }

    // Find all threads this user participates in, with latest message + participant info.
    const participations = await prisma.crmThreadParticipant.findMany({
      where: { userId: getAuthUserId(req) },
      include: {
        thread: {
          include: {
            participants: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
              },
            },
            messages: {
              where: { deletedAt: null },
              orderBy: { createdAt: "desc" },
              take: 1,
              include: {
                sender: { select: { id: true, firstName: true, lastName: true } },
              },
            },
          },
        },
      },
      orderBy: { thread: { updatedAt: "desc" } },
    });

    const threads = participations.map((p) => {
      const myParticipant = p.thread.participants.find((tp) => tp.userId === getAuthUserId(req));
      const lastReadAt = myParticipant?.lastReadAt ?? null;
      const lastMessage = p.thread.messages[0] ?? null;

      // Count unread: messages after lastReadAt not sent by me.
      // We'll calculate this in the query below for accuracy.
      const otherParticipants = p.thread.participants.filter((tp) => tp.userId !== getAuthUserId(req));

      return {
        id: p.thread.id,
        type: p.thread.type,
        name: p.thread.name,
        updatedAt: p.thread.updatedAt,
        participants: p.thread.participants.map((tp) => ({
          userId: tp.userId,
          user: tp.user,
          lastReadAt: tp.lastReadAt,
        })),
        otherParticipants: otherParticipants.map((tp) => tp.user),
        lastMessage: lastMessage
          ? {
              id: lastMessage.id,
              body: lastMessage.body,
              senderId: lastMessage.senderId,
              senderName: `${lastMessage.sender.firstName} ${lastMessage.sender.lastName}`,
              createdAt: lastMessage.createdAt,
            }
          : null,
        lastReadAt,
        // Unread count computed separately
        unreadCount: 0,
      };
    });

    // Fetch unread counts in bulk for all threads.
    const threadIds = threads.map((t) => t.id);
    if (threadIds.length > 0) {
      const unreadCounts = await Promise.all(
        threads.map(async (t) => {
          const count = await prisma.crmMessage.count({
            where: {
              threadId: t.id,
              senderId: { not: getAuthUserId(req) },
              deletedAt: null,
              createdAt: t.lastReadAt ? { gt: t.lastReadAt } : undefined,
            },
          });
          return { threadId: t.id, count };
        })
      );
      for (const { threadId, count } of unreadCounts) {
        const thread = threads.find((t) => t.id === threadId);
        if (thread) thread.unreadCount = count;
      }
    }

    return res.json({ threads });
  } catch (err) {
    console.error("[messenger] GET /threads error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /threads ────────────────────────────────────────────────────────────
// Get or create a DM thread with another user.

router.post("/threads", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await resolveOrganizationId({ req });
    if (!orgId) return res.status(400).json({ error: "Organization not found" });
    if (!(await isMessengerEnabled(orgId))) {
      return res.status(403).json({ error: "Messenger is disabled for this organization." });
    }

    const { recipientId } = req.body as { recipientId?: string };
    if (!recipientId) return res.status(400).json({ error: "recipientId is required" });

    // Verify recipient is in same org and active.
    const recipient = await prisma.user.findFirst({
      where: { id: recipientId, organizationId: orgId, active: true },
      select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true },
    });
    if (!recipient) return res.status(404).json({ error: "Recipient not found in organization" });

    const myId = getAuthUserId(req);

    // Check if a DIRECT thread already exists between these two users in this org.
    const existing = await prisma.crmThread.findFirst({
      where: {
        organizationId: orgId,
        type: "DIRECT",
        participants: {
          every: { userId: { in: [myId, recipientId] } },
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
          },
        },
      },
    });

    // Because Prisma's `every` can match threads with a subset, we verify count = 2.
    const validExisting =
      existing && existing.participants.length === 2 ? existing : null;

    if (validExisting) {
      return res.json({ thread: validExisting, created: false });
    }

    // Create new thread.
    const thread = await prisma.crmThread.create({
      data: {
        organizationId: orgId,
        type: "DIRECT",
        participants: {
          create: [{ userId: myId }, { userId: recipientId }],
        },
      },
      include: {
        participants: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, avatarUrl: true, email: true } },
          },
        },
      },
    });

    return res.status(201).json({ thread, created: true });
  } catch (err) {
    console.error("[messenger] POST /threads error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /threads/:threadId/messages ─────────────────────────────────────────

router.get("/threads/:threadId/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await resolveOrganizationId({ req });
    if (!orgId) return res.status(400).json({ error: "Organization not found" });

    const { threadId } = req.params;
    const cursor = req.query.before as string | undefined;
    const limit = Math.min(Number(req.query.limit ?? 40), 100);

    // Verify caller is a participant.
    const participant = await prisma.crmThreadParticipant.findUnique({
      where: { threadId_userId: { threadId, userId: getAuthUserId(req) } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant of this thread" });

    const messages = await prisma.crmMessage.findMany({
      where: {
        threadId,
        deletedAt: null,
        ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // Return oldest-first for rendering.
    return res.json({ messages: messages.reverse() });
  } catch (err) {
    console.error("[messenger] GET /threads/:threadId/messages error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── POST /threads/:threadId/messages ────────────────────────────────────────

router.post("/threads/:threadId/messages", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await resolveOrganizationId({ req });
    if (!orgId) return res.status(400).json({ error: "Organization not found" });
    if (!(await isMessengerEnabled(orgId))) {
      return res.status(403).json({ error: "Messenger is disabled for this organization." });
    }

    const { threadId } = req.params;
    const { body } = req.body as { body?: string };

    if (!body?.trim()) return res.status(400).json({ error: "Message body is required" });
    if (body.length > 4000) return res.status(400).json({ error: "Message too long (max 4000 chars)" });

    // Verify caller is a participant.
    const participant = await prisma.crmThreadParticipant.findUnique({
      where: { threadId_userId: { threadId, userId: getAuthUserId(req) } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant of this thread" });

    const message = await prisma.crmMessage.create({
      data: { threadId, senderId: getAuthUserId(req), body: body.trim() },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    // Bump thread updatedAt so thread list re-sorts correctly.
    await prisma.crmThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    // Mark sender as read immediately.
    await prisma.crmThreadParticipant.update({
      where: { threadId_userId: { threadId, userId: getAuthUserId(req) } },
      data: { lastReadAt: new Date() },
    });

    // Broadcast to all SSE subscribers in this org.
    broadcastToOrg(orgId, "message", {
      threadId,
      message: {
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        sender: message.sender,
        createdAt: message.createdAt,
      },
    });

    return res.status(201).json({ message });
  } catch (err) {
    console.error("[messenger] POST /threads/:threadId/messages error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /threads/:threadId/read ───────────────────────────────────────────

router.patch("/threads/:threadId/read", requireAuth, async (req: Request, res: Response) => {
  try {
    const { threadId } = req.params;
    const participant = await prisma.crmThreadParticipant.findUnique({
      where: { threadId_userId: { threadId, userId: getAuthUserId(req) } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant of this thread" });

    await prisma.crmThreadParticipant.update({
      where: { threadId_userId: { threadId, userId: getAuthUserId(req) } },
      data: { lastReadAt: new Date() },
    });

    return res.json({ ok: true });
  } catch (err) {
    console.error("[messenger] PATCH /threads/:threadId/read error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── GET /unread-count ────────────────────────────────────────────────────────

router.get("/unread-count", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await resolveOrganizationId({ req });
    if (!orgId) return res.json({ count: 0 });
    if (!(await isMessengerEnabled(orgId))) return res.json({ count: 0 });

    const myId = getAuthUserId(req);

    const participations = await prisma.crmThreadParticipant.findMany({
      where: { userId: myId },
      select: { threadId: true, lastReadAt: true },
    });

    let total = 0;
    await Promise.all(
      participations.map(async (p) => {
        const count = await prisma.crmMessage.count({
          where: {
            threadId: p.threadId,
            senderId: { not: myId },
            deletedAt: null,
            createdAt: p.lastReadAt ? { gt: p.lastReadAt } : undefined,
          },
        });
        total += count;
      })
    );

    return res.json({ count: total });
  } catch (err) {
    console.error("[messenger] GET /unread-count error", err);
    return res.json({ count: 0 });
  }
});

// ─── GET /sse ─────────────────────────────────────────────────────────────────
// Server-Sent Events stream for real-time message delivery.

router.get("/sse", requireAuth, async (req: Request, res: Response) => {
  const orgId = await resolveOrganizationId({ req });
  if (!orgId) {
    res.status(400).end();
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Send a heartbeat immediately so the client knows the connection is alive.
  res.write(": heartbeat\n\n");

  const subscriber: SseSubscriber = { userId: getAuthUserId(req), res };
  addSseSubscriber(orgId, subscriber);

  // Heartbeat every 25 s to prevent proxy timeouts.
  const heartbeat = setInterval(() => {
    try {
      res.write(": heartbeat\n\n");
    } catch {
      clearInterval(heartbeat);
    }
  }, 25000);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseSubscriber(orgId, subscriber);
  });
});

export default router;
