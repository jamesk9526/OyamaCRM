/**
 * Meeting management routes for OyamaCRM Donor CRM.
 * Meetings represent scheduled interactions between staff and constituents
 * (donors, board members, sponsors, church partners, volunteers, etc.).
 * Creating/completing/canceling a meeting also writes a timeline Activity entry
 * so the constituent's history stays current.
 *
 * Routes:
 *   GET    /api/meetings           — paginated list with filters
 *   POST   /api/meetings           — schedule a new meeting
 *   GET    /api/meetings/upcoming  — quick list of upcoming meetings (dashboard)
 *   GET    /api/meetings/:id       — single meeting detail
 *   PATCH  /api/meetings/:id       — update meeting fields
 *   POST   /api/meetings/:id/complete  — mark completed + record outcome
 *   POST   /api/meetings/:id/cancel   — cancel a meeting
 *   POST   /api/meetings/:id/no-show  — mark as no-show
 *   DELETE /api/meetings/:id       — permanently delete (owner, assignee or admin)
 *
 * @module routes/meetings
 */
import { Router, type Request, type Response } from "express";
import { MeetingType, MeetingStatus, MeetingLocationType, type Meeting, type Prisma } from "@prisma/client";
import { requireRole } from "../middleware/requireRole.js";
import { loadMeetingSettings, validateMeetingSettings, MEETING_SETTINGS_KEY, MeetingInputError } from "../services/meeting-settings.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

// All meeting routes require an authenticated session.
router.use(requireAuth);

/** Access predicate for meeting visibility/editing. */
function canAccessMeeting(meeting: { createdById: string | null; assignedStaffId: string | null }, userId: string, role: string | undefined): boolean {
  if (role === "admin") return true;
  return meeting.createdById === userId || meeting.assignedStaffId === userId;
}

class MeetingError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
function fail(status: number, message: string): never { throw new MeetingError(status, message); }
const includes = {
  constituent: { select: { id: true, firstName: true, lastName: true } },
  assignedStaff: { select: { id: true, firstName: true, lastName: true } },
};
function handler(work: (req: Request, res: Response) => Promise<unknown>) {
  return async (req: Request, res: Response) => {
    try { await work(req, res); }
    catch (error) {
      if (error instanceof MeetingError || error instanceof MeetingInputError) {
        res.status(error instanceof MeetingError ? error.status : 400).json({ error: { code: "VALIDATION", message: error.message } });
      } else {
        console.error("[meetings] Operation failed");
        res.status(500).json({ error: { code: "INTERNAL", message: "Meeting operation failed. Please retry." } });
      }
    }
  };
}
router.get("/settings", handler(async (req, res) => {
  res.json({ ...await loadMeetingSettings(req.user!.orgId), canManage: req.user!.role === "admin" });
}));
router.put("/settings", requireRole("admin"), handler(async (req, res) => {
  const config = validateMeetingSettings(req.body);
  await prisma.$transaction(async tx => {
    await tx.pluginSetting.upsert({ where: { organizationId_pluginKey: { organizationId: req.user!.orgId, pluginKey: MEETING_SETTINGS_KEY } },
      create: { organizationId: req.user!.orgId, pluginKey: MEETING_SETTINGS_KEY, enabled: true, config }, update: { config } });
    await tx.auditLog.create({ data: { organizationId: req.user!.orgId, userId: req.user!.sub, action: "MEETING_SETTINGS_UPDATED", entity: "PluginSetting", metadata: { fields: Object.keys(config) } } });
  });
  res.json({ ...config, canManage: true });
}));

// ─── List / Search ────────────────────────────────────────────────────────────

/**
 * GET /api/meetings
 * Returns a paginated list of meetings.
 * Query params: status, constituentId, assignedStaffId, page, limit, upcoming, followUpNeeded (boolean)
 */
router.get("/", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const organizationId = req.user?.orgId;
    const role = req.user?.role;
    if (!userId || !organizationId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }

    const {
      status,
      constituentId,
      assignedStaffId,
      scope = "personal",
      page = "1",
      limit = "25",
      upcoming,
      followUpNeeded,
    } = req.query as Record<string, string>;

    const parsedPage = Math.max(parseInt(page) || 1, 1);
    const parsedLimit = Math.min(Math.max(parseInt(limit) || 25, 1), 100);
    const skip = (parsedPage - 1) * parsedLimit;
    const personalScope = !(scope === "all" && role === "admin");

    // Build where clause from query params
    const where: Record<string, unknown> = {
      organizationId,
      ...(personalScope
        ? {
            OR: [{ createdById: userId }, { assignedStaffId: userId }],
          }
        : {}),
    };
    if (status && !Object.values(MeetingStatus).includes(status as MeetingStatus)) { res.status(400).json({ error: { code: "VALIDATION", message: "Choose a supported meeting status." } }); return; }
    if (status) where.status = status;
    if (constituentId) where.constituentId = constituentId;
    if (assignedStaffId) where.assignedStaffId = assignedStaffId;
    // Follow-up is independent of lifecycle status: completion can create the
    // next-step task while leaving the meeting itself correctly completed.
    // Retain legacy records that used NEEDS_FOLLOW_UP as their lifecycle status.
    if (followUpNeeded === "true") where.AND = [{ OR: [
      { followUpNeeded: true, status: { not: "CANCELED" } },
      { status: "NEEDS_FOLLOW_UP" },
    ] }];

    // If "upcoming" is requested, filter to meetings starting in the future
    if (upcoming === "true") {
      where.startTime = { gte: new Date() };
      where.status = "SCHEDULED";
    }

    const [items, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        skip,
        take: parsedLimit,
        orderBy: { startTime: "asc" },
        include: {
          constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true } },
          createdBy: { select: { id: true, firstName: true, lastName: true } },
          tasks: { select: { id: true, title: true, status: true } },
        },
      }),
      prisma.meeting.count({ where }),
    ]);

    res.json({ items, total, page: parsedPage, limit: parsedLimit });
  } catch (err) {
    console.error("GET /api/meetings error:", err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to load meetings" } });
  }
});

// ─── Upcoming Dashboard Feed ──────────────────────────────────────────────────

/**
 * GET /api/meetings/upcoming
 * Returns up to 10 upcoming scheduled meetings for the dashboard widget.
 * Supports optional ?assignedStaffId filter.
 */
router.get("/upcoming", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const organizationId = req.user?.orgId;
    const role = req.user?.role;
    if (!userId || !organizationId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }

    const { assignedStaffId } = req.query as Record<string, string>;
    const scope = (req.query.scope as string) ?? "personal";
    const personalScope = !(scope === "all" && role === "admin");

    const where: Record<string, unknown> = {
      organizationId,
      status: "SCHEDULED",
      startTime: { gte: new Date() },
      ...(personalScope
        ? {
            OR: [{ createdById: userId }, { assignedStaffId: userId }],
          }
        : {}),
    };
    if (assignedStaffId) where.assignedStaffId = assignedStaffId;

    const items = await prisma.meeting.findMany({
      where,
      take: 10,
      orderBy: { startTime: "asc" },
      include: {
        constituent: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Count meetings happening today
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const tomorrowStart = new Date(todayStart);
    tomorrowStart.setDate(tomorrowStart.getDate() + 1);

    const todayCount = await prisma.meeting.count({
      where: {
        organizationId,
        ...(assignedStaffId ? { assignedStaffId } : {}),
        status: "SCHEDULED",
        startTime: { gte: todayStart, lt: tomorrowStart },
        ...(personalScope
          ? {
              OR: [{ createdById: userId }, { assignedStaffId: userId }],
            }
          : {}),
      },
    });

    res.json({ items, todayCount, total: items.length });
  } catch (err) {
    console.error("GET /api/meetings/upcoming error:", err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to load upcoming meetings" } });
  }
});

// ─── Single Meeting ───────────────────────────────────────────────────────────

/**
 * GET /api/meetings/:id
 * Returns a full meeting record with related constituent, staff, and tasks.
 */
router.get("/:id", async (req, res) => {
  try {
    const userId = req.user?.sub;
    const organizationId = req.user?.orgId;
    const role = req.user?.role;
    if (!userId || !organizationId) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }

    const meeting = await prisma.meeting.findFirst({
      where: {
        id: req.params.id,
        organizationId,
        OR: role === "admin" ? undefined : [{ createdById: userId }, { assignedStaffId: userId }],
      },
      include: {
        constituent: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true, email: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
        tasks: {
          select: { id: true, title: true, status: true, dueDate: true, assigneeId: true },
          orderBy: { dueDate: "asc" },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });

    if (!meeting) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Meeting not found" } });
    }

    res.json(meeting);
  } catch (err) {
    console.error("GET /api/meetings/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to load meeting" } });
  }
});

// Meeting mutations validate relationships before writes and use explicit lifecycle actions.
const textFields = ["title", "location", "meetingUrl", "purpose", "notes", "privateNotes", "outcome", "constituentId", "assignedStaffId"] as const;
function fields(body: Record<string, unknown>, creating = false) {
  if (!body || typeof body !== "object" || Array.isArray(body)) fail(400, "Enter meeting details as an object.");
  const data: Record<string, unknown> = {};
  if ("status" in body) fail(400, "Use the complete, cancel or no-show action to change meeting status.");
  for (const key of textFields) {
    if (body[key] === undefined) continue;
    if (body[key] === null && key !== "title") { data[key] = null; continue; }
    if (typeof body[key] !== "string") fail(400, `Enter valid ${key}.`);
    const value = (body[key] as string).trim();
    if (value.length > (["notes", "privateNotes", "outcome", "purpose"].includes(key) ? 10000 : key === "meetingUrl" ? 2000 : 191)) fail(400, `${key} is too long.`);
    if (key === "title" && !value) fail(400, "Enter a meeting title.");
    data[key] = value || null;
  }
  if (creating && !data.title) fail(400, "Enter a meeting title.");
  for (const key of ["startTime", "endTime"] as const) {
    if (body[key] === undefined) continue;
    if (key === "endTime" && body[key] === null) { data[key] = null; continue; }
    if (typeof body[key] !== "string" || !Number.isFinite(Date.parse(body[key] as string))) fail(400, "Enter valid meeting dates.");
    data[key] = new Date(body[key] as string);
  }
  if (creating && !data.startTime) fail(400, "Enter the meeting start time.");
  if (body.type !== undefined) {
    if (!Object.values(MeetingType).includes(body.type as MeetingType)) fail(400, "Choose a supported meeting type.");
    data.type = body.type;
  }
  if (body.locationType !== undefined) {
    if (!Object.values(MeetingLocationType).includes(body.locationType as MeetingLocationType)) fail(400, "Choose a supported meeting location type.");
    data.locationType = body.locationType;
  }
  if (body.timezone !== undefined) {
    if (typeof body.timezone !== "string" || body.timezone.length > 100) fail(400, "Choose a valid timezone.");
    try { new Intl.DateTimeFormat("en-US", { timeZone: body.timezone as string }).format(); } catch { fail(400, "Choose a valid timezone."); }
    data.timezone = body.timezone;
  }
  if (body.followUpNeeded !== undefined) {
    if (typeof body.followUpNeeded !== "boolean") fail(400, "Choose a valid follow-up setting.");
    data.followUpNeeded = body.followUpNeeded;
  }
  if (data.meetingUrl) {
    let url: URL;
    try { url = new URL(data.meetingUrl as string); } catch { fail(400, "Enter a complete meeting URL."); }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) fail(400, "Use an HTTP or HTTPS meeting URL.");
  }
  return data;
}
function validTimes(startTime: Date, endTime: Date | null | undefined) {
  if (endTime && endTime <= startTime) fail(400, "Meeting end time must follow its start time.");
}
async function relationships(organizationId: string, data: { constituentId?: string | null; assignedStaffId?: string | null }, tx: Prisma.TransactionClient = prisma) {
  if (data.constituentId && !await tx.constituent.findFirst({ where: { id: data.constituentId, organizationId }, select: { id: true } })) fail(400, "Choose a constituent from this organization.");
  if (data.assignedStaffId && !await tx.user.findFirst({ where: { id: data.assignedStaffId, organizationId, active: true, role: { not: "compassion_user" } }, select: { id: true } })) fail(400, "Choose an active staff member from this organization.");
}
async function accessible(req: Request) {
  const meeting = await prisma.meeting.findFirst({ where: { id: String(req.params.id), organizationId: req.user!.orgId } });
  if (!meeting) fail(404, "Meeting not found.");
  if (!canAccessMeeting(meeting, req.user!.sub, req.user!.role)) fail(403, "You do not have access to this meeting.");
  return meeting;
}
const openStatuses: MeetingStatus[] = ["SCHEDULED", "RESCHEDULED", "NEEDS_FOLLOW_UP"];
async function timeline(tx: Prisma.TransactionClient, meeting: Meeting, userId: string, type: "MEETING_SCHEDULED" | "MEETING_COMPLETED" | "MEETING_CANCELED", description: string) {
  const completion = type === "MEETING_COMPLETED";
  if (meeting.constituentId) await tx.activity.create({ data: {
    constituentId: meeting.constituentId, meetingId: meeting.id, userId, type,
    description: `${description}${completion && meeting.outcome ? ` Outcome: ${meeting.outcome}` : ""}`,
    metadata: { meetingId: meeting.id,
      ...(completion ? { outcome: meeting.outcome, followUpNeeded: meeting.followUpNeeded } : {}),
      ...(type === "MEETING_SCHEDULED" ? { type: meeting.type, locationType: meeting.locationType, location: meeting.location } : {}),
    },
  } });
}

router.post("/", requireRole("staff"), handler(async (req, res) => {
  const data = fields(req.body, true) as Prisma.MeetingUncheckedCreateInput;
  const settings = await loadMeetingSettings(req.user!.orgId);
  const startTime = data.startTime as Date;
  const endTime = data.endTime === undefined ? new Date(startTime.getTime() + settings.defaultDuration * 60000) : data.endTime as Date | null;
  validTimes(startTime, endTime);
  const meeting = await prisma.$transaction(async tx => {
    await relationships(req.user!.orgId, data, tx);
    const created = await tx.meeting.create({ data: { ...data, startTime, endTime, organizationId: req.user!.orgId, createdById: req.user!.sub, status: "SCHEDULED" }, include: includes });
    if (settings.autoTimeline) await timeline(tx, created, req.user!.sub, "MEETING_SCHEDULED", `Meeting scheduled: "${created.title}" on ${created.startTime.toLocaleDateString()}.`);
    return created;
  });
  res.status(201).json(meeting);
}));
router.patch("/:id", requireRole("staff"), handler(async (req, res) => {
  const data = fields(req.body) as Prisma.MeetingUncheckedUpdateInput;
  const existing = await accessible(req);
  validTimes(data.startTime as Date || existing.startTime, data.endTime === undefined ? existing.endTime : data.endTime as Date | null);
  const meeting = await prisma.$transaction(async tx => {
    await relationships(req.user!.orgId, data as { constituentId?: string | null; assignedStaffId?: string | null }, tx);
    const changed = await tx.meeting.updateMany({ where: { id: existing.id, organizationId: req.user!.orgId, updatedAt: existing.updatedAt }, data });
    if (!changed.count) fail(409, "The meeting changed. Reload before saving.");
    return tx.meeting.findFirst({ where: { id: existing.id, organizationId: req.user!.orgId }, include: includes });
  });
  res.json(meeting);
}));

for (const action of ["complete", "cancel", "no-show"] as const) {
  router.post(`/:id/${action}`, requireRole("staff"), handler(async (req, res) => {
    const data = fields(req.body === undefined ? {} : req.body) as Prisma.MeetingUncheckedUpdateInput;
    const allowed = new Set(["outcome", "notes", "followUpNeeded"]);
    if (Object.keys(data).some(key => !allowed.has(key))) fail(400, "Edit meeting details before changing its status.");
    const existing = await accessible(req);
    const target: MeetingStatus = action === "complete" ? "COMPLETED" : action === "cancel" ? "CANCELED" : "NO_SHOW";
    if (existing.status === target) { res.json(existing); return; }
    if (!openStatuses.includes(existing.status)) fail(409, "This meeting is already closed. Reload its current status.");
    const settings = await loadMeetingSettings(req.user!.orgId);
    const now = new Date();
    const meeting = await prisma.$transaction(async tx => {
      await relationships(req.user!.orgId, existing, tx);
      const changed = await tx.meeting.updateMany({ where: { id: existing.id, organizationId: req.user!.orgId, status: { in: openStatuses }, updatedAt: existing.updatedAt }, data: { ...data, status: target, ...(action === "complete" ? { completedAt: now, ...(settings.autoFollowUp ? { followUpNeeded: true } : {}) } : action === "cancel" ? { canceledAt: now } : {}) } });
      if (!changed.count) fail(409, "The meeting changed. Reload before continuing.");
      const updated = await tx.meeting.findFirstOrThrow({ where: { id: existing.id, organizationId: req.user!.orgId }, include: includes });
      if (settings.autoTimeline && action !== "no-show") await timeline(tx, updated, req.user!.sub, action === "complete" ? "MEETING_COMPLETED" : "MEETING_CANCELED", `Meeting ${action === "complete" ? "completed" : "canceled"}: "${updated.title}".`);
      if (action === "complete" && settings.autoFollowUp) {
        const assigneeId = updated.assignedStaffId || req.user!.sub;
        await relationships(req.user!.orgId, { assignedStaffId: assigneeId }, tx);
        await tx.task.create({ data: { organizationId: req.user!.orgId, constituentId: updated.constituentId, assigneeId, createdById: req.user!.sub, meetingId: updated.id, title: `Follow up: ${updated.title}`.slice(0, 191), description: settings.followUpMessage, dueDate: new Date(now.getTime() + settings.followUpDays * 86400000), type: "FOLLOW_UP", status: "PENDING", sourceModule: "meetings", sourceType: "MEETING_COMPLETED", sourceId: updated.id } });
      }
      return updated;
    });
    res.json(meeting);
  }));
}
router.delete("/:id", requireRole("staff"), handler(async (req, res) => {
  const existing = await accessible(req);
  await prisma.meeting.delete({ where: { id: existing.id } });
  res.json({ success: true });
}));
export default router;
