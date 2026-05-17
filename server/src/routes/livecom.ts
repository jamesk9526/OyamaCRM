/**
 * LiveCom routes for donor-facing inbound interaction tracking.
 *
 * This module persists LiveCom interactions as standard Constituent Activity records,
 * which automatically makes those interactions visible in each constituent timeline.
 *
 * Routes:
 *   GET   /api/livecom/interactions        — list tracked LiveCom interactions
 *   POST  /api/livecom/interactions        — create a tracked interaction + timeline entry
 *   PATCH /api/livecom/interactions/:id    — update tracked interaction metadata/state
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import type { ActivityType, Prisma } from "@prisma/client";

const router = Router();

const LIVE_COM_SOURCE = "livecom";
const LIVE_COM_CHANNELS = ["WEB_CHAT", "CONTACT_FORM", "SURVEY"] as const;
const LIVE_COM_STATUSES = ["NEW", "OPEN", "IN_PROGRESS", "WAITING_ON_DONOR", "RESOLVED", "ARCHIVED", "SPAM"] as const;
const LIVE_COM_PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

type LiveComChannel = (typeof LIVE_COM_CHANNELS)[number];
type LiveComStatus = (typeof LIVE_COM_STATUSES)[number];
type LiveComPriority = (typeof LIVE_COM_PRIORITIES)[number];

interface LiveComInteractionRecord {
  id: string;
  constituentId: string | null;
  donorName: string;
  channel: LiveComChannel;
  status: LiveComStatus;
  priority: LiveComPriority;
  owner: string;
  eventLabel: string;
  detail: string;
  messagePreview: string;
  occurredAt: string;
}

interface LiveComConversationMessage {
  id: string;
  role: "visitor" | "staff" | "note" | "system";
  body: string;
  authorName: string;
  createdAt: string;
}

interface LiveComConversationRecord {
  id: string;
  visitorSessionId: string | null;
  constituentId: string | null;
  visitorName: string;
  visitorEmail: string | null;
  visitorPhone: string | null;
  sourceSiteId: string | null;
  publicSiteId: string | null;
  sourceWebsite: string;
  pageUrl: string;
  status: LiveComStatus;
  priority: LiveComPriority;
  owner: string;
  assignedTo: string;
  unread: boolean;
  archivedAt: string | null;
  resolvedAt: string | null;
  archiveReason: string | null;
  linkedDonorName: string | null;
  lastMessagePreview: string;
  startedAt: string;
  updatedAt: string;
  messages: LiveComConversationMessage[];
}

interface LiveComInteractionPayload {
  constituentId?: string;
  channel?: string;
  status?: string;
  priority?: string;
  owner?: string;
  eventLabel?: string;
  detail?: string;
  messagePreview?: string;
  metadata?: Record<string, unknown>;
}

router.use(requireAuth);

router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:communications")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PATCH") {
    return requirePermission("edit:communications")(req, res, next);
  }
  return next();
});

/**
 * GET /api/livecom/conversations
 * Lists grouped LiveCom conversations with status, unread, source website, and latest-message context.
 *
 * Query: { limit?: number, status?: LiveComStatus | "ALL" | "UNREAD", search?: string }
 */
router.get("/conversations", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const { limit = "80", status = "ALL", search = "" } = req.query as Record<string, string>;
  const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 80, 1), 250);
  const statusFilter = String(status || "ALL").toUpperCase();
  const searchFilter = String(search || "").trim().toLowerCase();
  const conversations = await loadLiveComConversations(organizationId, parsedLimit);

  const filtered = conversations.filter((conversation) => {
    if (statusFilter === "UNREAD" && !conversation.unread) return false;
    if (statusFilter !== "ALL" && statusFilter !== "UNREAD" && conversation.status !== statusFilter) return false;
    if (searchFilter) {
      const haystack = [
        conversation.visitorName,
        conversation.visitorEmail,
        conversation.sourceWebsite,
        conversation.pageUrl,
        conversation.status,
        conversation.lastMessagePreview,
        ...conversation.messages.map((message) => message.body),
      ].join(" ").toLowerCase();
      if (!haystack.includes(searchFilter)) return false;
    }
    return true;
  });

  res.json(filtered.slice(0, parsedLimit));
});

/** GET /api/livecom/conversations/:id returns one full LiveCom conversation thread. */
router.get("/conversations/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const conversationId = String(req.params.id || "").trim();
  const conversations = await loadLiveComConversations(organizationId, 250);
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    return;
  }

  res.json(conversation);
});

/**
 * POST /api/livecom/conversations/:id/messages
 * Adds a staff reply, internal note, or system event to a LiveCom conversation.
 *
 * Body: { body: string, role?: "staff" | "note", status?: LiveComStatus }
 */
router.post("/conversations/:id/messages", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const conversationId = String(req.params.id || "").trim();
  const body = normalizeOptionalString((req.body as Record<string, unknown>).body);
  const roleInput = normalizeOptionalString((req.body as Record<string, unknown>).role);
  const role: "staff" | "note" = roleInput === "note" ? "note" : "staff";
  if (!conversationId || !body) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "conversation id and body are required" } });
    return;
  }

  const conversations = await loadLiveComConversations(organizationId, 250);
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation || !conversation.constituentId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    return;
  }

  const nextStatus = role === "staff"
    ? normalizeStatus((req.body as Record<string, unknown>).status, "WAITING_ON_DONOR")
    : conversation.status;
  const authorName = staffDisplayName(req);

  const created = await prisma.activity.create({
    data: {
      constituentId: conversation.constituentId,
      type: "NOTE",
      description: body,
      userId: req.user?.sub ?? undefined,
      metadata: {
        source: LIVE_COM_SOURCE,
        channel: "WEB_CHAT",
        conversationId,
        messageRole: role,
        status: nextStatus,
        priority: conversation.priority,
        owner: conversation.owner,
        assignedTo: conversation.assignedTo,
        authorName,
        eventLabel: role === "note" ? "Internal Note Added" : "Staff Reply Sent",
        messagePreview: body.slice(0, 140),
        visitorName: conversation.visitorName,
        visitorSessionId: conversation.visitorSessionId,
        visitorEmail: conversation.visitorEmail,
        visitorPhone: conversation.visitorPhone,
        publicEmbed: {
          siteId: conversation.sourceSiteId,
          publicSiteId: conversation.publicSiteId,
          domain: conversation.sourceWebsite,
          pageUrl: conversation.pageUrl,
        },
      } as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    action: role === "note" ? "LIVECOM_INTERNAL_NOTE_CREATED" : "LIVECOM_STAFF_REPLY_CREATED",
    entity: "Activity",
    entityId: created.id,
    userId: req.user?.sub,
    organizationId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    metadata: { conversationId, role, status: nextStatus },
  });

  const refreshed = (await loadLiveComConversations(organizationId, 250)).find((item) => item.id === conversationId);
  res.status(201).json(refreshed ?? conversation);
});

/**
 * POST /api/livecom/conversations/:id/read
 * Marks visitor messages in a LiveCom conversation as read by staff.
 */
router.post("/conversations/:id/read", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const conversationId = String(req.params.id || "").trim();
  if (!conversationId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "conversation id is required" } });
    return;
  }

  const rows = await prisma.activity.findMany({
    where: {
      constituent: { organizationId },
    },
    select: {
      id: true,
      metadata: true,
    },
    take: 500,
  });

  const visitorRows = rows.filter((row) => {
    const metadata = readLiveComMetadata(row);
    return normalizeOptionalString(metadata.conversationId) === conversationId
      && normalizeOptionalString(metadata.messageRole) === "visitor"
      && metadata.readByStaff !== true;
  });

  await Promise.all(visitorRows.map((row) => {
    const metadata = readLiveComMetadata(row);
    return prisma.activity.update({
      where: { id: row.id },
      data: {
        metadata: {
          ...metadata,
          readByStaff: true,
          readByStaffAt: new Date().toISOString(),
          readByStaffUserId: req.user?.sub ?? null,
        } as Prisma.InputJsonValue,
      },
    });
  }));

  const refreshed = (await loadLiveComConversations(organizationId, 250)).find((item) => item.id === conversationId);
  res.json(refreshed ?? { id: conversationId, unread: false });
});

/**
 * PATCH /api/livecom/conversations/:id
 * Adds a lifecycle event for status, assignment, archive, and spam changes.
 */
router.patch("/conversations/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const conversationId = String(req.params.id || "").trim();
  const conversations = await loadLiveComConversations(organizationId, 250);
  const conversation = conversations.find((item) => item.id === conversationId);
  if (!conversation || !conversation.constituentId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Conversation not found" } });
    return;
  }

  const payload = req.body as Record<string, unknown>;
  const nextStatus = payload.status ? normalizeStatus(payload.status, conversation.status) : conversation.status;
  const assignedTo = normalizeOptionalString(payload.assignedTo) ?? normalizeOptionalString(payload.owner) ?? conversation.assignedTo;
  const owner = normalizeOptionalString(payload.owner) ?? assignedTo;
  const archiveReason = nextStatus === "OPEN"
    ? null
    : normalizeOptionalString(payload.archiveReason) ?? conversation.archiveReason;
  const hasStatusChanged = nextStatus !== conversation.status;
  const hasAssignmentChanged = assignedTo !== conversation.assignedTo || owner !== conversation.owner;
  const hasArchiveReasonChanged = archiveReason !== conversation.archiveReason;
  if (!hasStatusChanged && !hasAssignmentChanged && !hasArchiveReasonChanged) {
    res.json(conversation);
    return;
  }

  const archivedAt = nextStatus === "OPEN"
    ? null
    : nextStatus === "ARCHIVED" && !conversation.archivedAt
      ? new Date().toISOString()
      : conversation.archivedAt;
  const resolvedAt = nextStatus === "RESOLVED" && !conversation.resolvedAt ? new Date().toISOString() : conversation.resolvedAt;
  const staffName = staffDisplayName(req);
  const eventText = nextStatus === "ARCHIVED"
    ? `Conversation archived${archiveReason ? `: ${archiveReason}` : "."}`
    : nextStatus === "OPEN" && conversation.status === "ARCHIVED"
      ? "Conversation reopened."
    : nextStatus === "SPAM"
      ? "Conversation marked as spam."
      : `Conversation updated to ${nextStatus.replace(/_/g, " ").toLowerCase()}.`;

  await prisma.activity.create({
    data: {
      constituentId: conversation.constituentId,
      type: "NOTE",
      description: eventText,
      userId: req.user?.sub ?? undefined,
      metadata: {
        source: LIVE_COM_SOURCE,
        channel: "WEB_CHAT",
        conversationId,
        messageRole: "system",
        status: nextStatus,
        priority: conversation.priority,
        owner,
        assignedTo,
        authorName: staffName,
        eventLabel: "Conversation Updated",
        messagePreview: conversation.lastMessagePreview,
        visitorName: conversation.visitorName,
        visitorSessionId: conversation.visitorSessionId,
        visitorEmail: conversation.visitorEmail,
        visitorPhone: conversation.visitorPhone,
        archivedAt,
        resolvedAt,
        archiveReason,
        publicEmbed: {
          siteId: conversation.sourceSiteId,
          publicSiteId: conversation.publicSiteId,
          domain: conversation.sourceWebsite,
          pageUrl: conversation.pageUrl,
        },
      } as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    action: "LIVECOM_CONVERSATION_UPDATED",
    entity: "Activity",
    entityId: conversationId,
    userId: req.user?.sub,
    organizationId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    metadata: { conversationId, status: nextStatus, assignedTo, archiveReason },
  });

  const refreshed = (await loadLiveComConversations(organizationId, 250)).find((item) => item.id === conversationId);
  res.json(refreshed ?? conversation);
});

/** Returns true when the provided value is one of the allowed LiveCom channels. */
function isLiveComChannel(value: string): value is LiveComChannel {
  return LIVE_COM_CHANNELS.includes(value as LiveComChannel);
}

/** Returns true when the provided value is one of the allowed LiveCom statuses. */
function isLiveComStatus(value: string): value is LiveComStatus {
  return LIVE_COM_STATUSES.includes(value as LiveComStatus);
}

/** Returns true when the provided value is one of the allowed LiveCom priorities. */
function isLiveComPriority(value: string): value is LiveComPriority {
  return LIVE_COM_PRIORITIES.includes(value as LiveComPriority);
}

/** Safely converts unknown metadata values into a plain object for JSON persistence. */
function normalizeMetadataObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

/** Normalizes optional strings and returns null when empty. */
function normalizeOptionalString(value: unknown): string | null {
  const normalized = String(value ?? "").trim();
  return normalized.length > 0 ? normalized : null;
}

/** Resolves a validated LiveCom channel with fallback. */
function normalizeChannel(value: unknown, fallback: LiveComChannel = "WEB_CHAT"): LiveComChannel {
  const normalized = normalizeOptionalString(value);
  if (normalized && isLiveComChannel(normalized)) return normalized;
  return fallback;
}

/** Resolves a validated LiveCom status with fallback. */
function normalizeStatus(value: unknown, fallback: LiveComStatus = "NEW"): LiveComStatus {
  const normalized = normalizeOptionalString(value);
  if (normalized && isLiveComStatus(normalized)) return normalized;
  if (normalized === "IN_PROGRESS") return "OPEN";
  return fallback;
}

/** Resolves a validated LiveCom priority with fallback. */
function normalizePriority(value: unknown, fallback: LiveComPriority = "MEDIUM"): LiveComPriority {
  const normalized = normalizeOptionalString(value);
  if (normalized && isLiveComPriority(normalized)) return normalized;
  return fallback;
}

/** Maps an inbound LiveCom channel to a durable ActivityType. */
function activityTypeForChannel(channel: LiveComChannel): ActivityType {
  if (channel === "CONTACT_FORM") return "EMAIL_RECEIVED";
  return "NOTE";
}

/** Provides default event labels when callers do not specify one. */
function defaultEventLabel(channel: LiveComChannel): string {
  if (channel === "WEB_CHAT") return "Chat Started";
  if (channel === "CONTACT_FORM") return "Contact Form Submitted";
  return "Survey Interaction";
}

/** Creates a compact human-readable label from the authenticated staff user. */
function staffDisplayName(req: import("express").Request): string {
  const user = req.user as { firstName?: string; lastName?: string; email?: string; sub?: string } | undefined;
  const fullName = `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim();
  return fullName || user?.email || "Staff";
}

/** Reads one LiveCom metadata field from an activity row. */
function readLiveComMetadata(activity: { metadata: Prisma.JsonValue | null }): Record<string, unknown> {
  const metadata = normalizeMetadataObject(activity.metadata);
  return metadata.source === LIVE_COM_SOURCE ? metadata : {};
}

/** Returns true when a metadata role should count as a visitor unread message. */
function isUnreadVisitorMessage(metadata: Record<string, unknown>): boolean {
  return normalizeOptionalString(metadata.messageRole) === "visitor" && metadata.readByStaff !== true;
}

/** Maps grouped activity rows into one messenger-style conversation response. */
function mapActivitiesToConversation(rows: Array<{
  id: string;
  constituentId: string | null;
  description: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  constituent: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null } | null;
}>): LiveComConversationRecord | null {
  if (rows.length === 0) return null;

  const sorted = [...rows].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const first = sorted[0];
  const latest = sorted[sorted.length - 1];
  const firstMeta = readLiveComMetadata(first);
  const latestMeta = readLiveComMetadata(latest);
  const constituent = latest.constituent ?? first.constituent;
  const donorName = constituent ? `${constituent.firstName} ${constituent.lastName}`.trim() : "";
  const visitorName = normalizeOptionalString(latestMeta.visitorName)
    ?? normalizeOptionalString(firstMeta.visitorName)
    ?? donorName
    ?? "Website Visitor";
  const visitorEmail = normalizeOptionalString(latestMeta.visitorEmail)
    ?? normalizeOptionalString(firstMeta.visitorEmail)
    ?? constituent?.email
    ?? null;
  const firstPublicEmbed = normalizeMetadataObject(firstMeta.publicEmbed);
  const latestPublicEmbed = normalizeMetadataObject(latestMeta.publicEmbed);
  const publicEmbed = { ...firstPublicEmbed, ...latestPublicEmbed };
  const messages = sorted.map((row): LiveComConversationMessage => {
    const metadata = readLiveComMetadata(row);
    const roleRaw = normalizeOptionalString(metadata.messageRole);
    const role: LiveComConversationMessage["role"] = roleRaw === "staff" || roleRaw === "note" || roleRaw === "system"
      ? roleRaw
      : "visitor";
    return {
      id: row.id,
      role,
      body: row.description,
      authorName: normalizeOptionalString(metadata.authorName)
        ?? (role === "visitor" ? visitorName : "Staff"),
      createdAt: row.createdAt.toISOString(),
    };
  });

  return {
    id: normalizeOptionalString(latestMeta.conversationId) ?? latest.id,
    visitorSessionId: normalizeOptionalString(latestMeta.visitorSessionId) ?? normalizeOptionalString(firstMeta.visitorSessionId),
    constituentId: constituent?.id ?? latest.constituentId ?? first.constituentId,
    visitorName,
    visitorEmail,
    visitorPhone: normalizeOptionalString(latestMeta.visitorPhone) ?? constituent?.phone ?? null,
    sourceSiteId: normalizeOptionalString(publicEmbed.siteId),
    publicSiteId: normalizeOptionalString(publicEmbed.publicSiteId),
    sourceWebsite: normalizeOptionalString(publicEmbed.domain) ?? "Website",
    pageUrl: normalizeOptionalString(publicEmbed.pageUrl) ?? "",
    status: normalizeStatus(latestMeta.status, "NEW"),
    priority: normalizePriority(latestMeta.priority, "MEDIUM"),
    owner: normalizeOptionalString(latestMeta.owner) ?? normalizeOptionalString(latestMeta.assignedTo) ?? "Unassigned",
    assignedTo: normalizeOptionalString(latestMeta.assignedTo) ?? normalizeOptionalString(latestMeta.owner) ?? "Unassigned",
    unread: sorted.some((row) => isUnreadVisitorMessage(readLiveComMetadata(row))),
    archivedAt: normalizeOptionalString(latestMeta.archivedAt),
    resolvedAt: normalizeOptionalString(latestMeta.resolvedAt),
    archiveReason: normalizeOptionalString(latestMeta.archiveReason),
    linkedDonorName: donorName || null,
    lastMessagePreview: latest.description.slice(0, 180),
    startedAt: first.createdAt.toISOString(),
    updatedAt: latest.createdAt.toISOString(),
    messages,
  };
}

/** Loads LiveCom activity rows for an organization and groups them by conversationId. */
async function loadLiveComConversations(organizationId: string, limit: number) {
  const rows = await prisma.activity.findMany({
    where: {
      constituent: { organizationId },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(limit * 20, 300),
    include: {
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  const groups = new Map<string, typeof rows>();
  for (const row of rows) {
    const metadata = readLiveComMetadata(row);
    if (metadata.source !== LIVE_COM_SOURCE) continue;
    const conversationId = normalizeOptionalString(metadata.conversationId) ?? row.id;
    const current = groups.get(conversationId) ?? [];
    current.push(row);
    groups.set(conversationId, current);
  }

  return Array.from(groups.values())
    .map((group) => mapActivitiesToConversation(group))
    .filter((item): item is LiveComConversationRecord => Boolean(item))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

/** Infers channel fallback from historical activity type when channel metadata is missing. */
function inferChannelFromActivityType(type: ActivityType): LiveComChannel {
  if (type === "EMAIL_RECEIVED") return "CONTACT_FORM";
  return "WEB_CHAT";
}

/** Normalizes one activity row into the LiveCom API response shape. */
function mapActivityToLiveComInteraction(activity: {
  id: string;
  type: ActivityType;
  description: string;
  metadata: Prisma.JsonValue | null;
  createdAt: Date;
  constituent: { id: string; firstName: string; lastName: string } | null;
}): LiveComInteractionRecord {
  const metadata = normalizeMetadataObject(activity.metadata);
  const fallbackChannel = inferChannelFromActivityType(activity.type);
  const channel = normalizeChannel(metadata.channel, fallbackChannel);
  const status = normalizeStatus(metadata.status, "NEW");
  const priority = normalizePriority(metadata.priority, "MEDIUM");
  const owner = normalizeOptionalString(metadata.owner) ?? "Unassigned";
  const eventLabel = normalizeOptionalString(metadata.eventLabel) ?? defaultEventLabel(channel);
  const messagePreview = normalizeOptionalString(metadata.messagePreview) ?? activity.description.slice(0, 140);
  const donorNameFromConstituent = `${activity.constituent?.firstName ?? ""} ${activity.constituent?.lastName ?? ""}`.trim();
  const donorName = donorNameFromConstituent || normalizeOptionalString(metadata.donorName) || "Unknown Donor";

  return {
    id: activity.id,
    constituentId: activity.constituent?.id ?? null,
    donorName,
    channel,
    status,
    priority,
    owner,
    eventLabel,
    detail: activity.description,
    messagePreview,
    occurredAt: activity.createdAt.toISOString(),
  };
}

/**
 * GET /api/livecom/interactions
 * Lists tracked LiveCom interactions already attached to constituent timelines.
 *
 * Query: { limit?: number, status?: LiveComStatus, channel?: LiveComChannel, search?: string }
 */
router.get("/interactions", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const { limit = "120", status, channel, search } = req.query as Record<string, string>;
  const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 120, 1), 500);

  const rows = await prisma.activity.findMany({
    where: {
      constituent: {
        organizationId,
      },
    },
    orderBy: { createdAt: "desc" },
    take: Math.max(parsedLimit * 4, 120),
    include: {
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  const tracked = rows
    .filter((row) => normalizeMetadataObject(row.metadata).source === LIVE_COM_SOURCE)
    .map(mapActivityToLiveComInteraction);

  const statusFilter = normalizeOptionalString(status);
  const channelFilter = normalizeOptionalString(channel);
  const searchFilter = String(search ?? "").trim().toLowerCase();

  const filtered = tracked.filter((item) => {
    if (statusFilter && item.status !== statusFilter) return false;
    if (channelFilter && item.channel !== channelFilter) return false;
    if (searchFilter) {
      const haystack = `${item.donorName} ${item.detail} ${item.messagePreview} ${item.eventLabel}`.toLowerCase();
      if (!haystack.includes(searchFilter)) return false;
    }
    return true;
  });

  res.json(filtered.slice(0, parsedLimit));
});

/**
 * POST /api/livecom/interactions
 * Creates a LiveCom interaction and writes it into the target constituent timeline.
 *
 * Body: {
 *   constituentId: string,
 *   detail: string,
 *   channel?: LiveComChannel,
 *   status?: LiveComStatus,
 *   priority?: LiveComPriority,
 *   owner?: string,
 *   eventLabel?: string,
 *   messagePreview?: string,
 *   metadata?: object
 * }
 */
router.post("/interactions", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const payload = req.body as LiveComInteractionPayload;
  const constituentId = normalizeOptionalString(payload.constituentId);
  const detail = normalizeOptionalString(payload.detail);

  if (!constituentId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "constituentId is required" } });
    return;
  }

  if (!detail) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "detail is required" } });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: constituentId, organizationId },
    select: { id: true, firstName: true, lastName: true },
  });

  if (!constituent) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Constituent not found" } });
    return;
  }

  const channel = normalizeChannel(payload.channel, "WEB_CHAT");
  const status = normalizeStatus(payload.status, "NEW");
  const priority = normalizePriority(payload.priority, "MEDIUM");
  const owner = normalizeOptionalString(payload.owner) ?? "Unassigned";
  const eventLabel = normalizeOptionalString(payload.eventLabel) ?? defaultEventLabel(channel);
  const messagePreview = normalizeOptionalString(payload.messagePreview) ?? detail.slice(0, 140);
  const extraMetadata = normalizeMetadataObject(payload.metadata);

  const created = await prisma.activity.create({
    data: {
      constituentId: constituent.id,
      type: activityTypeForChannel(channel),
      description: detail,
      userId: req.user?.sub ?? undefined,
      metadata: {
        source: LIVE_COM_SOURCE,
        channel,
        status,
        priority,
        owner,
        eventLabel,
        messagePreview,
        donorName: `${constituent.firstName} ${constituent.lastName}`.trim(),
        ...extraMetadata,
      } as Prisma.InputJsonValue,
    },
    include: {
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await logAudit({
    action: "LIVECOM_INTERACTION_CREATED",
    entity: "Activity",
    entityId: created.id,
    userId: req.user?.sub,
    organizationId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    metadata: {
      source: LIVE_COM_SOURCE,
      channel,
      status,
      priority,
      constituentId: constituent.id,
    },
  });

  res.status(201).json(mapActivityToLiveComInteraction(created));
});

/**
 * PATCH /api/livecom/interactions/:id
 * Updates mutable LiveCom interaction metadata while keeping the timeline record in-place.
 *
 * Body: {
 *   detail?: string,
 *   channel?: LiveComChannel,
 *   status?: LiveComStatus,
 *   priority?: LiveComPriority,
 *   owner?: string,
 *   eventLabel?: string,
 *   messagePreview?: string,
 *   metadata?: object
 * }
 */
router.patch("/interactions/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const id = String(req.params.id || "").trim();
  if (!id) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "interaction id is required" } });
    return;
  }

  const existing = await prisma.activity.findFirst({
    where: {
      id,
      constituent: {
        organizationId,
      },
    },
    include: {
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Interaction not found" } });
    return;
  }

  const existingMetadata = normalizeMetadataObject(existing.metadata);
  if (existingMetadata.source !== LIVE_COM_SOURCE) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Interaction not found" } });
    return;
  }

  const payload = req.body as LiveComInteractionPayload;
  const extraMetadata = normalizeMetadataObject(payload.metadata);

  const channel = payload.channel
    ? normalizeChannel(payload.channel, inferChannelFromActivityType(existing.type))
    : normalizeChannel(existingMetadata.channel, inferChannelFromActivityType(existing.type));
  const status = payload.status
    ? normalizeStatus(payload.status, "NEW")
    : normalizeStatus(existingMetadata.status, "NEW");
  const priority = payload.priority
    ? normalizePriority(payload.priority, "MEDIUM")
    : normalizePriority(existingMetadata.priority, "MEDIUM");

  const owner = normalizeOptionalString(payload.owner)
    ?? normalizeOptionalString(existingMetadata.owner)
    ?? "Unassigned";

  const eventLabel = normalizeOptionalString(payload.eventLabel)
    ?? normalizeOptionalString(existingMetadata.eventLabel)
    ?? defaultEventLabel(channel);

  const nextDetail = normalizeOptionalString(payload.detail) ?? existing.description;

  const messagePreview = normalizeOptionalString(payload.messagePreview)
    ?? normalizeOptionalString(existingMetadata.messagePreview)
    ?? nextDetail.slice(0, 140);

  const updated = await prisma.activity.update({
    where: { id: existing.id },
    data: {
      type: activityTypeForChannel(channel),
      description: nextDetail,
      metadata: {
        ...existingMetadata,
        ...extraMetadata,
        source: LIVE_COM_SOURCE,
        channel,
        status,
        priority,
        owner,
        eventLabel,
        messagePreview,
      } as Prisma.InputJsonValue,
    },
    include: {
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await logAudit({
    action: "LIVECOM_INTERACTION_UPDATED",
    entity: "Activity",
    entityId: updated.id,
    userId: req.user?.sub,
    organizationId,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
    metadata: {
      source: LIVE_COM_SOURCE,
      channel,
      status,
      priority,
      constituentId: updated.constituent?.id ?? null,
    },
  });

  res.json(mapActivityToLiveComInteraction(updated));
});

export default router;
