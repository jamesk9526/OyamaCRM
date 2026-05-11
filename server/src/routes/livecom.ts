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
const LIVE_COM_STATUSES = ["NEW", "IN_PROGRESS", "WAITING_ON_DONOR", "RESOLVED"] as const;
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
