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
import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
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

interface MessengerImageUploadPayload {
  dataUrl?: string;
  fileName?: string;
  mimeType?: string;
  autoDelete?: boolean;
}

interface MessengerAttachmentMeta {
  url: string;
  filePath: string;
  expiresAt: string | null;
}

const MESSENGER_UPLOAD_ROOT = path.join(process.cwd(), "public", "uploads", "messenger");
const MESSENGER_MAX_IMAGE_BYTES = 5 * 1024 * 1024;

function sanitizeUploadName(name: string | undefined): string {
  const base = String(name || "image").replace(/\.[^.]+$/, "");
  return base.replace(/[^a-z0-9_-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "image";
}

function extensionForMime(mimeType: string): string | null {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/jpeg") return "jpg";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/gif") return "gif";
  return null;
}

function parseImageDataUrl(dataUrl: string, claimedMimeType?: string): { buffer: Buffer; mimeType: string; extension: string } | null {
  const match = /^data:(image\/(?:png|jpeg|webp|gif));base64,([a-z0-9+/=]+)$/i.exec(dataUrl.trim());
  if (!match) return null;
  const mimeType = claimedMimeType?.startsWith("image/") ? claimedMimeType : match[1];
  const extension = extensionForMime(mimeType);
  if (!extension) return null;
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.byteLength <= 0 || buffer.byteLength > MESSENGER_MAX_IMAGE_BYTES) return null;
  return { buffer, mimeType, extension };
}

async function cleanupExpiredMessengerUploads() {
  async function walk(dir: string): Promise<string[]> {
    const entries = await fs.readdir(dir, { withFileTypes: true }).catch(() => []);
    const files = await Promise.all(entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(fullPath);
      return [fullPath];
    }));
    return files.flat();
  }

  const metaFiles = (await walk(MESSENGER_UPLOAD_ROOT)).filter((file) => file.endsWith(".meta.json"));
  await Promise.all(metaFiles.map(async (metaPath) => {
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, "utf8")) as MessengerAttachmentMeta;
      if (!meta.expiresAt || new Date(meta.expiresAt).getTime() > Date.now()) return;
      await fs.rm(meta.filePath, { force: true });
      await fs.rm(metaPath, { force: true });
    } catch {
      // Ignore malformed cleanup metadata; upload delivery should not fail because cleanup did.
    }
  }));
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

// ─── POST /attachments ───────────────────────────────────────────────────────
// Stores one image attachment for a message. Optional 2-day expiry is enforced
// by cleanup metadata and removed on future uploads.

router.post("/attachments", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await resolveOrganizationId({ req });
    if (!orgId) return res.status(400).json({ error: "Organization not found" });
    if (!(await isMessengerEnabled(orgId))) {
      return res.status(403).json({ error: "Messenger is disabled for this organization." });
    }

    const payload = req.body as MessengerImageUploadPayload;
    if (!payload.dataUrl) return res.status(400).json({ error: "dataUrl is required" });

    const parsed = parseImageDataUrl(payload.dataUrl, payload.mimeType);
    if (!parsed) {
      return res.status(400).json({ error: "Only PNG, JPEG, WebP, or GIF images up to 5 MB are supported." });
    }

    void cleanupExpiredMessengerUploads();

    const safeOrgId = orgId.replace(/[^a-z0-9_-]+/gi, "_");
    const uploadDir = path.join(MESSENGER_UPLOAD_ROOT, safeOrgId);
    await fs.mkdir(uploadDir, { recursive: true });

    const id = randomUUID();
    const safeBase = sanitizeUploadName(payload.fileName);
    const filename = `${Date.now()}-${id}-${safeBase}.${parsed.extension}`;
    const filePath = path.join(uploadDir, filename);
    await fs.writeFile(filePath, parsed.buffer);

    const expiresAt = payload.autoDelete ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString() : null;
    const url = `/uploads/messenger/${safeOrgId}/${filename}`;
    const meta: MessengerAttachmentMeta = { url, filePath, expiresAt };
    await fs.writeFile(`${filePath}.meta.json`, JSON.stringify(meta, null, 2));

    return res.status(201).json({
      attachment: {
        kind: "image",
        url,
        name: payload.fileName || filename,
        mimeType: parsed.mimeType,
        expiresAt,
        autoDelete: Boolean(payload.autoDelete),
      },
    });
  } catch (err) {
    console.error("[messenger] POST /attachments error", err);
    return res.status(500).json({ error: "Internal server error" });
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
              updatedAt: lastMessage.updatedAt,
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

    const threadId = Array.isArray(req.params.threadId)
      ? String(req.params.threadId[0] || "")
      : String(req.params.threadId || "");
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

    const threadId = Array.isArray(req.params.threadId)
      ? String(req.params.threadId[0] || "")
      : String(req.params.threadId || "");
    const { body } = req.body as { body?: string };

    if (!body?.trim()) return res.status(400).json({ error: "Message body is required" });
    if (body.length > 8000) return res.status(400).json({ error: "Message too long (max 8000 chars)" });

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
        updatedAt: message.updatedAt,
      },
    });

    return res.status(201).json({ message });
  } catch (err) {
    console.error("[messenger] POST /threads/:threadId/messages error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /threads/:threadId/messages/:messageId ───────────────────────────
// Allows the sender to edit their own message body while preserving the same row.

router.patch("/threads/:threadId/messages/:messageId", requireAuth, async (req: Request, res: Response) => {
  try {
    const orgId = await resolveOrganizationId({ req });
    if (!orgId) return res.status(400).json({ error: "Organization not found" });

    const threadId = Array.isArray(req.params.threadId)
      ? String(req.params.threadId[0] || "")
      : String(req.params.threadId || "");
    const messageId = Array.isArray(req.params.messageId)
      ? String(req.params.messageId[0] || "")
      : String(req.params.messageId || "");
    const { body } = req.body as { body?: string };

    if (!body?.trim()) return res.status(400).json({ error: "Message body is required" });
    if (body.length > 8000) return res.status(400).json({ error: "Message too long (max 8000 chars)" });

    const participant = await prisma.crmThreadParticipant.findUnique({
      where: { threadId_userId: { threadId, userId: getAuthUserId(req) } },
    });
    if (!participant) return res.status(403).json({ error: "Not a participant of this thread" });

    const existing = await prisma.crmMessage.findFirst({
      where: { id: messageId, threadId, deletedAt: null },
      select: { id: true, senderId: true },
    });
    if (!existing) return res.status(404).json({ error: "Message not found" });
    if (existing.senderId !== getAuthUserId(req)) return res.status(403).json({ error: "Only the sender can edit this message" });

    const message = await prisma.crmMessage.update({
      where: { id: messageId },
      data: { body: body.trim() },
      include: {
        sender: { select: { id: true, firstName: true, lastName: true, avatarUrl: true } },
      },
    });

    await prisma.crmThread.update({
      where: { id: threadId },
      data: { updatedAt: new Date() },
    });

    broadcastToOrg(orgId, "message:update", {
      threadId,
      message: {
        id: message.id,
        body: message.body,
        senderId: message.senderId,
        sender: message.sender,
        createdAt: message.createdAt,
        updatedAt: message.updatedAt,
      },
    });

    return res.json({ message });
  } catch (err) {
    console.error("[messenger] PATCH /threads/:threadId/messages/:messageId error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ─── PATCH /threads/:threadId/read ───────────────────────────────────────────

router.patch("/threads/:threadId/read", requireAuth, async (req: Request, res: Response) => {
  try {
    const threadId = Array.isArray(req.params.threadId)
      ? String(req.params.threadId[0] || "")
      : String(req.params.threadId || "");
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
