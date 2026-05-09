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
 *   DELETE /api/meetings/:id       — permanently delete (admin only)
 *
 * @module routes/meetings
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// All meeting routes require an authenticated session.
router.use(requireAuth);

// ─── List / Search ────────────────────────────────────────────────────────────

/**
 * GET /api/meetings
 * Returns a paginated list of meetings.
 * Query params: status, constituentId, assignedStaffId, page, limit, upcoming (boolean)
 */
router.get("/", async (req, res) => {
  try {
    const {
      status,
      constituentId,
      assignedStaffId,
      page = "1",
      limit = "25",
      upcoming,
    } = req.query as Record<string, string>;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Build where clause from query params
    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (constituentId) where.constituentId = constituentId;
    if (assignedStaffId) where.assignedStaffId = assignedStaffId;

    // If "upcoming" is requested, filter to meetings starting in the future
    if (upcoming === "true") {
      where.startTime = { gte: new Date() };
      where.status = "SCHEDULED";
    }

    const [items, total] = await Promise.all([
      prisma.meeting.findMany({
        where,
        skip,
        take: parseInt(limit),
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

    res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
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
    const { assignedStaffId } = req.query as Record<string, string>;

    const where: Record<string, unknown> = {
      status: "SCHEDULED",
      startTime: { gte: new Date() },
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
        status: "SCHEDULED",
        startTime: { gte: todayStart, lt: tomorrowStart },
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
    const meeting = await prisma.meeting.findUnique({
      where: { id: req.params.id },
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

// ─── Create ───────────────────────────────────────────────────────────────────

/**
 * POST /api/meetings
 * Schedule a new meeting. Automatically creates a MEETING_SCHEDULED timeline activity
 * on the linked constituent record when a constituentId is provided.
 *
 * Body shape: { title, type, startTime, endTime?, timezone?, locationType?, location?,
 *               meetingUrl?, purpose?, notes?, constituentId?, assignedStaffId? }
 */
router.post("/", async (req, res) => {
  try {
    const user = (req as unknown as { user?: { id: string; organizationId: string } }).user;
    if (!user) return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });

    const {
      title,
      type,
      startTime,
      endTime,
      timezone,
      locationType,
      location,
      meetingUrl,
      purpose,
      notes,
      privateNotes,
      constituentId,
      assignedStaffId,
    } = req.body;

    if (!title || !startTime) {
      return res.status(400).json({ error: { code: "VALIDATION", message: "title and startTime are required" } });
    }

    // Create meeting and optionally the timeline activity in a transaction
    const meeting = await prisma.$transaction(async (tx) => {
      const created = await tx.meeting.create({
        data: {
          organizationId: user.organizationId,
          title,
          type: type || "OTHER",
          status: "SCHEDULED",
          startTime: new Date(startTime),
          endTime: endTime ? new Date(endTime) : undefined,
          timezone: timezone || "America/Chicago",
          locationType: locationType || "IN_PERSON",
          location: location || null,
          meetingUrl: meetingUrl || null,
          purpose: purpose || null,
          notes: notes || null,
          privateNotes: privateNotes || null,
          constituentId: constituentId || null,
          assignedStaffId: assignedStaffId || null,
          createdById: user.id,
        },
        include: {
          constituent: { select: { id: true, firstName: true, lastName: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      // Write MEETING_SCHEDULED timeline activity if we have a constituent
      if (constituentId) {
        const displayName = created.constituent
          ? `${created.constituent.firstName} ${created.constituent.lastName}`
          : "constituent";
        await tx.activity.create({
          data: {
            constituentId,
            meetingId: created.id,
            userId: user.id,
            type: "MEETING_SCHEDULED",
            description: `Meeting scheduled: "${title}" on ${new Date(startTime).toLocaleDateString()}.`,
            metadata: { meetingId: created.id, type, locationType, location },
          },
        });
      }

      return created;
    });

    res.status(201).json(meeting);
  } catch (err) {
    console.error("POST /api/meetings error:", err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to create meeting" } });
  }
});

// ─── Update ───────────────────────────────────────────────────────────────────

/**
 * PATCH /api/meetings/:id
 * Update editable meeting fields (title, time, location, notes, purpose, outcome, etc.).
 * Status changes should use the dedicated action routes (/complete, /cancel, /no-show).
 */
router.patch("/:id", async (req, res) => {
  try {
    const {
      title,
      type,
      startTime,
      endTime,
      timezone,
      locationType,
      location,
      meetingUrl,
      purpose,
      notes,
      privateNotes,
      outcome,
      followUpNeeded,
      assignedStaffId,
      constituentId,
      status,
    } = req.body;

    const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Meeting not found" } });
    }

    const updated = await prisma.meeting.update({
      where: { id: req.params.id },
      data: {
        ...(title !== undefined && { title }),
        ...(type !== undefined && { type }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: new Date(endTime) }),
        ...(timezone !== undefined && { timezone }),
        ...(locationType !== undefined && { locationType }),
        ...(location !== undefined && { location }),
        ...(meetingUrl !== undefined && { meetingUrl }),
        ...(purpose !== undefined && { purpose }),
        ...(notes !== undefined && { notes }),
        ...(privateNotes !== undefined && { privateNotes }),
        ...(outcome !== undefined && { outcome }),
        ...(followUpNeeded !== undefined && { followUpNeeded }),
        ...(assignedStaffId !== undefined && { assignedStaffId }),
        ...(constituentId !== undefined && { constituentId }),
        ...(status !== undefined && { status }),
      },
      include: {
        constituent: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(updated);
  } catch (err) {
    console.error("PATCH /api/meetings/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to update meeting" } });
  }
});

// ─── Complete ─────────────────────────────────────────────────────────────────

/**
 * POST /api/meetings/:id/complete
 * Mark a meeting as completed.
 * Body may include: { outcome, notes, followUpNeeded }
 * Creates a MEETING_COMPLETED timeline activity on the constituent.
 */
router.post("/:id/complete", async (req, res) => {
  try {
    const user = (req as unknown as { user?: { id: string } }).user;
    const { outcome, notes, followUpNeeded } = req.body;

    const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Meeting not found" } });
    }

    const meeting = await prisma.$transaction(async (tx) => {
      const updated = await tx.meeting.update({
        where: { id: req.params.id },
        data: {
          status: "COMPLETED",
          completedAt: new Date(),
          ...(outcome !== undefined && { outcome }),
          ...(notes !== undefined && { notes }),
          ...(followUpNeeded !== undefined && { followUpNeeded }),
        },
        include: {
          constituent: { select: { id: true, firstName: true, lastName: true } },
          assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (existing.constituentId) {
        await tx.activity.create({
          data: {
            constituentId: existing.constituentId,
            meetingId: existing.id,
            userId: user?.id,
            type: "MEETING_COMPLETED",
            description: `Meeting completed: "${existing.title}".${outcome ? ` Outcome: ${outcome}` : ""}`,
            metadata: { meetingId: existing.id, outcome, followUpNeeded },
          },
        });
      }

      return updated;
    });

    res.json(meeting);
  } catch (err) {
    console.error("POST /api/meetings/:id/complete error:", err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to complete meeting" } });
  }
});

// ─── Cancel ───────────────────────────────────────────────────────────────────

/**
 * POST /api/meetings/:id/cancel
 * Cancel a meeting.
 * Creates a MEETING_CANCELED timeline activity on the constituent.
 */
router.post("/:id/cancel", async (req, res) => {
  try {
    const user = (req as unknown as { user?: { id: string } }).user;

    const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Meeting not found" } });
    }

    const meeting = await prisma.$transaction(async (tx) => {
      const updated = await tx.meeting.update({
        where: { id: req.params.id },
        data: { status: "CANCELED", canceledAt: new Date() },
      });

      if (existing.constituentId) {
        await tx.activity.create({
          data: {
            constituentId: existing.constituentId,
            meetingId: existing.id,
            userId: user?.id,
            type: "MEETING_CANCELED",
            description: `Meeting canceled: "${existing.title}".`,
            metadata: { meetingId: existing.id },
          },
        });
      }

      return updated;
    });

    res.json(meeting);
  } catch (err) {
    console.error("POST /api/meetings/:id/cancel error:", err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to cancel meeting" } });
  }
});

// ─── No-Show ──────────────────────────────────────────────────────────────────

/**
 * POST /api/meetings/:id/no-show
 * Mark a meeting as no-show (constituent did not attend).
 */
router.post("/:id/no-show", async (req, res) => {
  try {
    const existing = await prisma.meeting.findUnique({ where: { id: req.params.id } });
    if (!existing) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Meeting not found" } });
    }

    const meeting = await prisma.meeting.update({
      where: { id: req.params.id },
      data: { status: "NO_SHOW" },
    });

    res.json(meeting);
  } catch (err) {
    console.error("POST /api/meetings/:id/no-show error:", err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to update meeting" } });
  }
});

// ─── Delete ───────────────────────────────────────────────────────────────────

/**
 * DELETE /api/meetings/:id
 * Permanently delete a meeting record. Admin only.
 */
router.delete("/:id", requireRole("admin"), async (req, res) => {
  try {
    const id = String(req.params.id);
    const existing = await prisma.meeting.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: { code: "NOT_FOUND", message: "Meeting not found" } });
    }

    await prisma.meeting.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/meetings/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL", message: "Failed to delete meeting" } });
  }
});

export default router;
