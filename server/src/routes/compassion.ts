/**
 * Compassion CRM API routes for OyamaCRM.
 * Provides CRUD operations for clients, cases, appointments, services,
 * and follow-ups used by the client-care module. All data is scoped by
 * organizationId and protected by requireAuth.
 *
 * Routes:
 *   GET  /api/compassion/dashboard-summary   — aggregated metrics for dashboard
 *   GET  /api/compassion/clients             — list clients
 *   POST /api/compassion/clients             — create client
 *   GET  /api/compassion/clients/:id         — client profile with relations
 *   PUT  /api/compassion/clients/:id         — update client
 *   DEL  /api/compassion/clients/:id         — delete client (admin)
 *   GET  /api/compassion/cases               — list cases
 *   POST /api/compassion/cases               — create case
 *   GET  /api/compassion/cases/:id           — case detail with relations
 *   PUT  /api/compassion/cases/:id           — update case
 *   DEL  /api/compassion/cases/:id           — delete case (admin)
 *   GET  /api/compassion/appointments        — list appointments
 *   POST /api/compassion/appointments        — create appointment
 *   GET  /api/compassion/appointments/:id    — appointment detail
 *   PATCH /api/compassion/appointments/:id   — update appointment
 *   DEL  /api/compassion/appointments/:id    — delete appointment
 *   GET  /api/compassion/follow-ups          — list follow-ups
 *   POST /api/compassion/follow-ups          — create follow-up
 *   PATCH /api/compassion/follow-ups/:id     — update follow-up
 *   DEL  /api/compassion/follow-ups/:id      — delete follow-up
 *   GET  /api/compassion/services            — list services
 *   POST /api/compassion/services            — create service
 *   DEL  /api/compassion/services/:id        — delete service (admin)
 *
 * @module routes/compassion
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import type {
  CompassionClientStatus,
  CompassionCaseStatus,
  CompassionCaseType,
  CompassionAppointmentType,
  CompassionAppointmentStatus,
  CompassionServiceType,
  CompassionFollowUpStatus,
  CompassionPriority,
} from "@prisma/client";

const router = Router();

// All Compassion CRM routes require a valid JWT — client care data is sensitive.
router.use(requireAuth);

// ─── Dashboard Summary ─────────────────────────────────────────────────────────

/**
 * GET /api/compassion/dashboard-summary
 * Returns aggregated metrics scoped to the authenticated org:
 * client counts, case counts, today's appointments, pending follow-ups,
 * caseload-by-status chart data, cases-by-status chart data,
 * recent activity, today's schedule, and upcoming follow-ups.
 */
router.get("/dashboard-summary", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    // Build today's date range in UTC
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    // Build this-week date range
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    // Run all aggregate queries in parallel for performance
    const [
      totalClients,
      activeClients,
      activeCases,
      appointmentsToday,
      pendingFollowUps,
      overdueFollowUps,
      followUpsThisWeek,
      caseloadGroups,
      casesGroups,
      recentActivity,
      todaysAppointments,
      upcomingFollowUps,
    ] = await Promise.all([
      // Total clients
      prisma.compassionClient.count({ where: { organizationId } }),

      // Active clients
      prisma.compassionClient.count({
        where: { organizationId, clientStatus: "ACTIVE" },
      }),

      // Active cases (OPEN or IN_PROGRESS)
      prisma.compassionCase.count({
        where: { organizationId, caseStatus: { in: ["OPEN", "IN_PROGRESS"] } },
      }),

      // Appointments scheduled today
      prisma.compassionAppointment.count({
        where: {
          organizationId,
          startTime: { gte: todayStart, lte: todayEnd },
          status: "SCHEDULED",
        },
      }),

      // Follow-ups pending (PENDING or IN_PROGRESS)
      prisma.compassionFollowUp.count({
        where: {
          organizationId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),

      // Overdue follow-ups (due before now, not completed)
      prisma.compassionFollowUp.count({
        where: {
          organizationId,
          dueDate: { lt: now },
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),

      // Follow-ups due this week
      prisma.compassionFollowUp.count({
        where: {
          organizationId,
          dueDate: { gte: todayStart, lte: weekEnd },
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
      }),

      // Client status distribution for donut chart
      prisma.compassionClient.groupBy({
        by: ["clientStatus"],
        where: { organizationId },
        _count: { clientStatus: true },
      }),

      // Case status distribution for donut chart
      prisma.compassionCase.groupBy({
        by: ["caseStatus"],
        where: { organizationId },
        _count: { caseStatus: true },
      }),

      // Last 10 activity events
      prisma.compassionActivity.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          client: { select: { firstName: true, lastName: true } },
          performedBy: { select: { firstName: true, lastName: true } },
        },
      }),

      // Today's appointments
      prisma.compassionAppointment.findMany({
        where: {
          organizationId,
          startTime: { gte: todayStart, lte: todayEnd },
        },
        orderBy: { startTime: "asc" },
        take: 10,
        include: {
          client: { select: { firstName: true, lastName: true } },
          assignedStaff: { select: { firstName: true, lastName: true } },
        },
      }),

      // Next 5 upcoming follow-ups
      prisma.compassionFollowUp.findMany({
        where: {
          organizationId,
          status: { in: ["PENDING", "IN_PROGRESS"] },
        },
        orderBy: { dueDate: "asc" },
        take: 5,
        include: {
          client: { select: { firstName: true, lastName: true } },
          assignedStaff: { select: { firstName: true, lastName: true } },
        },
      }),
    ]);

    // Map client status groups to chart-friendly format with brand colors
    const statusColors: Record<string, string> = {
      ACTIVE: "#2563eb",
      INACTIVE: "#93c5fd",
      GRADUATED: "#6ee7b7",
      ARCHIVED: "#e2e8f0",
      PENDING: "#f59e0b",
    };
    const caseloadByStatus = caseloadGroups.map((g) => ({
      label: g.clientStatus.charAt(0) + g.clientStatus.slice(1).toLowerCase(),
      value: g._count.clientStatus,
      color: statusColors[g.clientStatus] ?? "#e2e8f0",
    }));

    // Map case status groups to chart-friendly format
    const caseStatusColors: Record<string, string> = {
      OPEN: "#2563eb",
      IN_PROGRESS: "#7c3aed",
      PENDING: "#f59e0b",
      CLOSED: "#e2e8f0",
      ARCHIVED: "#9ca3af",
    };
    const casesByStatus = casesGroups.map((g) => ({
      label: g.caseStatus === "IN_PROGRESS" ? "In Progress"
           : g.caseStatus.charAt(0) + g.caseStatus.slice(1).toLowerCase(),
      value: g._count.caseStatus,
      color: caseStatusColors[g.caseStatus] ?? "#e2e8f0",
    }));

    res.json({
      totalClients,
      activeClients,
      activeCases,
      appointmentsToday,
      tasksDue: pendingFollowUps,
      overdueFollowUps,
      followUpsThisWeek,
      caseloadByStatus,
      casesByStatus,
      recentActivity,
      todaysAppointments,
      upcomingFollowUps,
    });
  } catch (err) {
    console.error("[compassion] dashboard-summary error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load dashboard summary" } });
  }
});

// ─── Clients ───────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/clients
 * List clients for the authenticated org.
 *
 * Query params:
 *   search        — full-text-ish match against firstName/lastName/preferredName/email/phone/referralSource
 *   status        — filter by clientStatus enum
 *   staffId       — filter by exact assignedStaffId
 *   assigned      — "true" → only assigned, "false" → only unassigned
 *   missingContact — "true" → only clients with no email AND no phone
 *   intakeWithinDays — number; only clients whose intakeDate is within the last N days
 *   limit         — defaults to 50
 *
 * Defense-in-depth: rows whose firstName or lastName contains a comma are filtered out
 * after the DB query so legacy garbage rows from older imports never surface in the UI.
 */
router.get("/clients", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      search,
      status,
      staffId,
      assigned,
      missingContact,
      intakeWithinDays,
      limit = "50",
    } = req.query as Record<string, string>;

    const intakeFloor =
      intakeWithinDays && /^\d+$/.test(intakeWithinDays)
        ? new Date(Date.now() - Number(intakeWithinDays) * 24 * 60 * 60 * 1000)
        : undefined;

    const where = {
      organizationId,
      ...(status && { clientStatus: status as CompassionClientStatus }),
      ...(staffId && { assignedStaffId: staffId }),
      ...(assigned === "true" && { NOT: [{ assignedStaffId: null }] }),
      ...(assigned === "false" && { assignedStaffId: null }),
      ...(missingContact === "true" && {
        AND: [
          { OR: [{ email: null }, { email: "" }] },
          { OR: [{ phone: null }, { phone: "" }] },
        ],
      }),
      ...(intakeFloor && { intakeDate: { gte: intakeFloor } }),
      ...(search && {
        OR: [
          { firstName: { contains: search } },
          { lastName: { contains: search } },
          { preferredName: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { referralSource: { contains: search } },
        ],
      }),
    };

    const parsedLimit = Math.min(Math.max(parseInt(limit) || 50, 1), 200);

    const clients = await prisma.compassionClient.findMany({
      where,
      take: parsedLimit,
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        email: true,
        phone: true,
        clientStatus: true,
        intakeDate: true,
        assignedStaffId: true,
        assignedStaff: { select: { firstName: true, lastName: true } },
        _count: { select: { cases: true, appointments: true } },
      },
    });

    // Defensive filter: never return rows whose name field contains comma-separated metadata.
    // This protects users from legacy bad imports that pre-date the importer hardening.
    const safe = clients.filter((c) => {
      const fn = (c.firstName ?? "").trim();
      const ln = (c.lastName ?? "").trim();
      // Comma in a name almost always means metadata leaked in (e.g. "Text,Aurora,False,...").
      if (fn.includes(",") || ln.includes(",")) return false;
      // Em-dash separator from eKYROS report exports.
      if (/\s—\s/.test(fn) || /\s—\s/.test(ln)) return false;
      return true;
    });

    res.json(safe);
  } catch (err) {
    console.error("[compassion] GET /clients error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load clients" } });
  }
});

/**
 * POST /api/compassion/clients
 * Create a new client record. Automatically logs a CLIENT_CREATED activity.
 * Body: { firstName, lastName, preferredName?, email?, phone?, dateOfBirth?,
 *          intakeDate?, referralSource?, assignedStaffId?, notes? }
 */
router.post("/clients", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      firstName,
      lastName,
      preferredName,
      email,
      phone,
      addressLine1,
      addressLine2,
      city,
      state,
      zip,
      dateOfBirth,
      intakeDate,
      referralSource,
      assignedStaffId,
      privateNotes,
      clientStatus,
    } = req.body;

    const client = await prisma.compassionClient.create({
      data: {
        organizationId,
        firstName,
        lastName,
        preferredName: preferredName ?? null,
        email: email ?? null,
        phone: phone ?? null,
        addressLine1: addressLine1 ?? null,
        addressLine2: addressLine2 ?? null,
        city: city ?? null,
        state: state ?? null,
        zip: zip ?? null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        intakeDate: intakeDate ? new Date(intakeDate) : new Date(),
        referralSource: referralSource ?? null,
        assignedStaffId: assignedStaffId ?? null,
        privateNotes: privateNotes ?? null,
        clientStatus: clientStatus ?? "ACTIVE",
      },
    });

    // Log creation activity
    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId: client.id,
        activityType: "CLIENT_CREATED",
        description: `Client record created for ${client.firstName} ${client.lastName}`,
        performedById: req.user?.sub ?? null,
        metadata: { source: "api/compassion/clients:create", referralSource },
      },
    });

    // Audit log for compliance
    await logAudit({
      action: "COMPASSION_CLIENT_CREATED",
      entity: "CompassionClient",
      entityId: client.id,
      userId: req.user?.sub,
      organizationId,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.status(201).json(client);
  } catch (err) {
    console.error("[compassion] POST /clients error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create client" } });
  }
});

/**
 * GET /api/compassion/clients/:id
 * Full client profile including cases, appointments, services, follow-ups, and activity.
 */
router.get("/clients/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const client = await prisma.compassionClient.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        cases: {
          orderBy: { openedAt: "desc" },
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        appointments: {
          orderBy: { startTime: "desc" },
          take: 20,
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
          },
        },
        services: {
          orderBy: { serviceDate: "desc" },
          take: 20,
        },
        followUps: {
          orderBy: { dueDate: "asc" },
          where: { status: { not: "COMPLETED" } },
        },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: {
            performedBy: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });

    if (!client) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    res.json(client);
  } catch (err) {
    console.error("[compassion] GET /clients/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load client" } });
  }
});

/**
 * PUT /api/compassion/clients/:id
 * Update a client record. Accepts any subset of client fields.
 */
router.put("/clients/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const {
      firstName, lastName, preferredName, email, phone,
      addressLine1, addressLine2, city, state, zip,
      dateOfBirth, intakeDate, referralSource, assignedStaffId,
      privateNotes, clientStatus,
    } = req.body;

    const client = await prisma.compassionClient.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(firstName !== undefined && { firstName }),
        ...(lastName !== undefined && { lastName }),
        ...(preferredName !== undefined && { preferredName }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(addressLine1 !== undefined && { addressLine1 }),
        ...(addressLine2 !== undefined && { addressLine2 }),
        ...(city !== undefined && { city }),
        ...(state !== undefined && { state }),
        ...(zip !== undefined && { zip }),
        ...(dateOfBirth !== undefined && { dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null }),
        ...(intakeDate !== undefined && { intakeDate: new Date(intakeDate) }),
        ...(referralSource !== undefined && { referralSource }),
        ...(assignedStaffId !== undefined && { assignedStaffId }),
        ...(privateNotes !== undefined && { privateNotes }),
        ...(clientStatus !== undefined && { clientStatus: clientStatus as CompassionClientStatus }),
      },
    });

    if (client.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_CLIENT_UPDATED",
      entity: "CompassionClient",
      entityId: req.params.id as string,
      userId: req.user?.sub,
      organizationId: organizationId ?? undefined,
      ipAddress: req.ip,
    });

    res.json({ id: req.params.id, updated: true });
  } catch (err) {
    console.error("[compassion] PUT /clients/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update client" } });
  }
});

/**
 * DELETE /api/compassion/clients/:id
 * Permanently delete a client record. Admin only.
 */
router.delete("/clients/:id", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const deleted = await prisma.compassionClient.deleteMany({
      where: { id: req.params.id as string, organizationId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_CLIENT_DELETED",
      entity: "CompassionClient",
      entityId: req.params.id as string,
      userId: req.user?.sub,
      organizationId: organizationId ?? undefined,
      ipAddress: req.ip,
    });

    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /clients/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete client" } });
  }
});

// ─── Cases ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/cases
 * List cases for the authenticated org.
 * Supports query params: clientId, status, limit.
 */
router.get("/cases", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, status, limit = "50" } = req.query as Record<string, string>;

    const cases = await prisma.compassionCase.findMany({
      where: {
        organizationId,
        ...(clientId && { clientId }),
        ...(status && { caseStatus: status as CompassionCaseStatus }),
      },
      take: parseInt(limit),
      orderBy: { openedAt: "desc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { appointments: true, followUps: true } },
      },
    });

    res.json(cases);
  } catch (err) {
    console.error("[compassion] GET /cases error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load cases" } });
  }
});

/**
 * POST /api/compassion/cases
 * Create a new case. Auto-generates a CASE-YYYY-NNN case number.
 * Body: { clientId, caseType?, priority?, summary?, assignedStaffId? }
 */
router.post("/cases", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, caseType, priority, summary, assignedStaffId, privateNotes } = req.body;

    if (!clientId) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId is required" } });
      return;
    }

    // Auto-generate case number: CASE-YYYY-NNN
    const count = await prisma.compassionCase.count({ where: { organizationId } });
    const year = new Date().getFullYear();
    const caseNumber = `CASE-${year}-${String(count + 1).padStart(3, "0")}`;

    const compassionCase = await prisma.compassionCase.create({
      data: {
        organizationId,
        clientId,
        caseNumber,
        caseType: (caseType ?? "OTHER") as CompassionCaseType,
        priority: (priority ?? "MEDIUM") as CompassionPriority,
        summary: summary ?? null,
        assignedStaffId: assignedStaffId ?? null,
        privateNotes: privateNotes ?? null,
        caseStatus: "OPEN",
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    // Log activity on the client record
    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId,
        caseId: compassionCase.id,
        activityType: "CASE_OPENED",
        description: `Case ${caseNumber} opened`,
        performedById: req.user?.sub ?? null,
        metadata: { caseType, priority },
      },
    });

    await logAudit({
      action: "COMPASSION_CASE_CREATED",
      entity: "CompassionCase",
      entityId: compassionCase.id,
      userId: req.user?.sub,
      organizationId,
      ipAddress: req.ip,
    });

    res.status(201).json(compassionCase);
  } catch (err) {
    console.error("[compassion] POST /cases error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create case" } });
  }
});

/**
 * GET /api/compassion/cases/:id
 * Full case detail with appointments, services, follow-ups, and activity.
 */
router.get("/cases/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const compassionCase = await prisma.compassionCase.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        appointments: {
          orderBy: { startTime: "desc" },
          include: {
            assignedStaff: { select: { firstName: true, lastName: true } },
          },
        },
        services: { orderBy: { serviceDate: "desc" } },
        followUps: { orderBy: { dueDate: "asc" } },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 20,
          include: { performedBy: { select: { firstName: true, lastName: true } } },
        },
      },
    });

    if (!compassionCase) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Case not found" } });
      return;
    }

    res.json(compassionCase);
  } catch (err) {
    console.error("[compassion] GET /cases/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load case" } });
  }
});

/**
 * PUT /api/compassion/cases/:id
 * Update a case (status, type, priority, notes, assignee).
 */
router.put("/cases/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const { caseStatus, caseType, priority, summary, assignedStaffId, closedAt, privateNotes } = req.body;

    const updated = await prisma.compassionCase.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(caseStatus !== undefined && { caseStatus: caseStatus as CompassionCaseStatus }),
        ...(caseType !== undefined && { caseType: caseType as CompassionCaseType }),
        ...(priority !== undefined && { priority: priority as CompassionPriority }),
        ...(summary !== undefined && { summary }),
        ...(assignedStaffId !== undefined && { assignedStaffId }),
        ...(closedAt !== undefined && { closedAt: closedAt ? new Date(closedAt) : null }),
        ...(privateNotes !== undefined && { privateNotes }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Case not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_CASE_UPDATED",
      entity: "CompassionCase",
      entityId: req.params.id as string,
      userId: req.user?.sub,
      organizationId: organizationId ?? undefined,
    });

    res.json({ id: req.params.id, updated: true });
  } catch (err) {
    console.error("[compassion] PUT /cases/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update case" } });
  }
});

/**
 * DELETE /api/compassion/cases/:id
 * Permanently delete a case. Admin only.
 */
router.delete("/cases/:id", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const deleted = await prisma.compassionCase.deleteMany({
      where: { id: req.params.id as string, organizationId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Case not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_CASE_DELETED",
      entity: "CompassionCase",
      entityId: req.params.id as string,
      userId: req.user?.sub,
      organizationId: organizationId ?? undefined,
    });

    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /cases/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete case" } });
  }
});

// ─── Appointments ──────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/appointments
 * List appointments. Supports filters: clientId, caseId, status, dateFrom, dateTo.
 */
router.get("/appointments", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, caseId, status, dateFrom, dateTo, limit = "50" } = req.query as Record<string, string>;

    const appointments = await prisma.compassionAppointment.findMany({
      where: {
        organizationId,
        ...(clientId && { clientId }),
        ...(caseId && { caseId }),
        ...(status && { status: status as CompassionAppointmentStatus }),
        ...(dateFrom || dateTo
          ? {
              startTime: {
                ...(dateFrom && { gte: new Date(dateFrom) }),
                ...(dateTo && { lte: new Date(dateTo) }),
              },
            }
          : {}),
      },
      take: parseInt(limit),
      orderBy: { startTime: "desc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        case: { select: { id: true, caseNumber: true } },
      },
    });

    res.json(appointments);
  } catch (err) {
    console.error("[compassion] GET /appointments error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load appointments" } });
  }
});

/**
 * POST /api/compassion/appointments
 * Create a new appointment.
 * Body: { clientId, caseId?, appointmentType?, status?, startTime, endTime?,
 *          location?, assignedStaffId?, notes? }
 */
router.post("/appointments", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      clientId, caseId, appointmentType, status, startTime, endTime,
      timezone, location, assignedStaffId, notes, followUpNeeded,
    } = req.body;

    if (!clientId || !startTime) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId and startTime are required" } });
      return;
    }

    const appointment = await prisma.compassionAppointment.create({
      data: {
        organizationId,
        clientId,
        caseId: caseId ?? null,
        appointmentType: (appointmentType ?? "OTHER") as CompassionAppointmentType,
        status: (status ?? "SCHEDULED") as CompassionAppointmentStatus,
        startTime: new Date(startTime),
        endTime: endTime ? new Date(endTime) : null,
        timezone: timezone ?? "America/Chicago",
        location: location ?? null,
        assignedStaffId: assignedStaffId ?? null,
        notes: notes ?? null,
        followUpNeeded: followUpNeeded ?? false,
      },
    });

    // Log activity
    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId,
        caseId: caseId ?? null,
        appointmentId: appointment.id,
        activityType: "APPOINTMENT_SCHEDULED",
        description: `Appointment scheduled for ${new Date(startTime).toLocaleDateString()}`,
        performedById: req.user?.sub ?? null,
      },
    });

    res.status(201).json(appointment);
  } catch (err) {
    console.error("[compassion] POST /appointments error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create appointment" } });
  }
});

/**
 * GET /api/compassion/appointments/:id
 * Full appointment detail.
 */
router.get("/appointments/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const appointment = await prisma.compassionAppointment.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        case: { select: { id: true, caseNumber: true, caseType: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        followUps: true,
      },
    });

    if (!appointment) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Appointment not found" } });
      return;
    }

    res.json(appointment);
  } catch (err) {
    console.error("[compassion] GET /appointments/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load appointment" } });
  }
});

/**
 * PATCH /api/compassion/appointments/:id
 * Partially update an appointment (status, outcome, notes, etc.).
 */
router.patch("/appointments/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const {
      status, outcome, notes, startTime, endTime,
      location, assignedStaffId, followUpNeeded, appointmentType,
    } = req.body;

    const updated = await prisma.compassionAppointment.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(status !== undefined && { status: status as CompassionAppointmentStatus }),
        ...(outcome !== undefined && { outcome }),
        ...(notes !== undefined && { notes }),
        ...(startTime !== undefined && { startTime: new Date(startTime) }),
        ...(endTime !== undefined && { endTime: endTime ? new Date(endTime) : null }),
        ...(location !== undefined && { location }),
        ...(assignedStaffId !== undefined && { assignedStaffId }),
        ...(followUpNeeded !== undefined && { followUpNeeded }),
        ...(appointmentType !== undefined && { appointmentType: appointmentType as CompassionAppointmentType }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Appointment not found" } });
      return;
    }

    res.json({ id: req.params.id, updated: true });
  } catch (err) {
    console.error("[compassion] PATCH /appointments/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update appointment" } });
  }
});

/**
 * DELETE /api/compassion/appointments/:id
 * Delete an appointment.
 */
router.delete("/appointments/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const deleted = await prisma.compassionAppointment.deleteMany({
      where: { id: req.params.id as string, organizationId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Appointment not found" } });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /appointments/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete appointment" } });
  }
});

// ─── Follow-ups ────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/follow-ups
 * List follow-ups. Supports filters: clientId, status, assignedStaffId.
 */
router.get("/follow-ups", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, status, assignedStaffId, limit = "50" } = req.query as Record<string, string>;

    const followUps = await prisma.compassionFollowUp.findMany({
      where: {
        organizationId,
        ...(clientId && { clientId }),
        ...(status && { status: status as CompassionFollowUpStatus }),
        ...(assignedStaffId && { assignedStaffId }),
      },
      take: parseInt(limit),
      orderBy: { dueDate: "asc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        case: { select: { id: true, caseNumber: true } },
      },
    });

    res.json(followUps);
  } catch (err) {
    console.error("[compassion] GET /follow-ups error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load follow-ups" } });
  }
});

/**
 * POST /api/compassion/follow-ups
 * Create a new follow-up item.
 * Body: { clientId, caseId?, appointmentId?, title, dueDate, priority?, assignedStaffId?, notes? }
 */
router.post("/follow-ups", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, caseId, appointmentId, title, dueDate, priority, assignedStaffId, notes } = req.body;

    if (!clientId || !title || !dueDate) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId, title, and dueDate are required" } });
      return;
    }

    const followUp = await prisma.compassionFollowUp.create({
      data: {
        organizationId,
        clientId,
        caseId: caseId ?? null,
        appointmentId: appointmentId ?? null,
        title,
        dueDate: new Date(dueDate),
        priority: (priority ?? "MEDIUM") as CompassionPriority,
        assignedStaffId: assignedStaffId ?? null,
        notes: notes ?? null,
        status: "PENDING",
      },
    });

    res.status(201).json(followUp);
  } catch (err) {
    console.error("[compassion] POST /follow-ups error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create follow-up" } });
  }
});

/**
 * PATCH /api/compassion/follow-ups/:id
 * Partially update a follow-up (mark complete, change assignee, update notes).
 */
router.patch("/follow-ups/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const { status, title, dueDate, priority, assignedStaffId, notes } = req.body;

    const updated = await prisma.compassionFollowUp.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(status !== undefined && { status: status as CompassionFollowUpStatus }),
        ...(title !== undefined && { title }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(priority !== undefined && { priority: priority as CompassionPriority }),
        ...(assignedStaffId !== undefined && { assignedStaffId }),
        ...(notes !== undefined && { notes }),
        // Auto-set completedAt when marking complete
        ...(status === "COMPLETED" && { completedAt: new Date() }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Follow-up not found" } });
      return;
    }

    res.json({ id: req.params.id, updated: true });
  } catch (err) {
    console.error("[compassion] PATCH /follow-ups/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update follow-up" } });
  }
});

/**
 * DELETE /api/compassion/follow-ups/:id
 * Delete a follow-up.
 */
router.delete("/follow-ups/:id", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const deleted = await prisma.compassionFollowUp.deleteMany({
      where: { id: req.params.id as string, organizationId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Follow-up not found" } });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /follow-ups/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete follow-up" } });
  }
});

// ─── Services ──────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/services
 * List services delivered. Supports filters: clientId, caseId, serviceType.
 */
router.get("/services", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, caseId, serviceType, limit = "50" } = req.query as Record<string, string>;

    const services = await prisma.compassionService.findMany({
      where: {
        organizationId,
        ...(clientId && { clientId }),
        ...(caseId && { caseId }),
        ...(serviceType && { serviceType: serviceType as CompassionServiceType }),
      },
      take: parseInt(limit),
      orderBy: { serviceDate: "desc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        providedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(services);
  } catch (err) {
    console.error("[compassion] GET /services error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load services" } });
  }
});

/**
 * POST /api/compassion/services
 * Record a service delivered to a client.
 * Body: { clientId, caseId?, serviceType, serviceDate?, quantity?, notes?, providedById? }
 */
router.post("/services", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({
      req,
      requestedOrganizationId: req.body.organizationId,
    });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, caseId, serviceType, serviceDate, quantity, notes, providedById } = req.body;

    if (!clientId || !serviceType) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId and serviceType are required" } });
      return;
    }

    const service = await prisma.compassionService.create({
      data: {
        organizationId,
        clientId,
        caseId: caseId ?? null,
        serviceType: serviceType as CompassionServiceType,
        serviceDate: serviceDate ? new Date(serviceDate) : new Date(),
        quantity: quantity ?? null,
        notes: notes ?? null,
        providedById: providedById ?? req.user?.sub ?? null,
      },
    });

    res.status(201).json(service);
  } catch (err) {
    console.error("[compassion] POST /services error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create service record" } });
  }
});

/**
 * DELETE /api/compassion/services/:id
 * Delete a service record. Admin only.
 */
router.delete("/services/:id", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const deleted = await prisma.compassionService.deleteMany({
      where: { id: req.params.id as string, organizationId },
    });
    if (deleted.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Service record not found" } });
      return;
    }
    res.status(204).send();
  } catch (err) {
    console.error("[compassion] DELETE /services/:id error:", err);
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete service record" } });
  }
});

// ─── Client Import ────────────────────────────────────────────────────────────

/**
 * POST /api/compassion/clients/import
 * Batch-import CompassionClient records from a mapped CSV.
 *
 * Body:
 *   records              - Array of mapped row objects (CRM field keys to string values)
 *   mode                 - "create_only" | "upsert" | "update_only"
 *   dryRun               - When true, tallies what would happen without writing data
 *   matchExternalSourceId - When true, match on DirID stored in privateNotes as [EXT:xxx]
 *   matchEmail           - When true, match on email address
 *
 * Response: { created, updated, skipped, errors, dryRun, errorMessages }
 *
 * Safety guarantees:
 * - SSN is stripped server-side even if somehow included in the payload.
 * - This endpoint only creates/updates CompassionClient records.
 * - It does NOT create or modify Constituent (Donor CRM) records.
 * - It does NOT modify EventGuest or any other module records.
 * - All records are scoped to the authenticated organization.
 */
router.post("/clients/import", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found." } });
      return;
    }

    const {
      records,
      mode = "create_only",
      dryRun = true,
      matchExternalSourceId = true,
      matchEmail = true,
    } = req.body as {
      records: Array<Record<string, string>>;
      mode: "create_only" | "upsert" | "update_only";
      dryRun: boolean;
      matchExternalSourceId: boolean;
      matchEmail: boolean;
    };

    if (!Array.isArray(records) || records.length === 0) {
      res.status(400).json({ error: { code: "NO_RECORDS", message: "No records to import." } });
      return;
    }

    // Safety: blocked sensitive fields that must never be stored
    const BLOCKED_FIELDS = new Set(["ssn", "socialSecurityNumber", "sin", "taxId"]);

    // Status normalization: eKYROS values → Prisma enum
    const statusNormalize = (raw: string): CompassionClientStatus => {
      const statusMap: Record<string, CompassionClientStatus> = {
        "active":    "ACTIVE",
        "inactive":  "INACTIVE",
        "inactiv":   "INACTIVE",
        "closed":    "ARCHIVED",
        "archived":  "ARCHIVED",
        "pending":   "PENDING",
        "graduated": "GRADUATED",
        "":          "ACTIVE",
      };
      return statusMap[(raw || "").trim().toLowerCase()] ?? "ACTIVE";
    };

    /** Parse a date string to a Date, returning undefined if invalid or empty */
    const parseDateOrUndefined = (raw: string | undefined): Date | undefined => {
      if (!raw?.trim()) return undefined;
      const d = new Date(raw.trim());
      return isNaN(d.getTime()) ? undefined : d;
    };

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const rec of records) {
      try {
        // Strip blocked sensitive fields from every incoming record
        for (const blocked of BLOCKED_FIELDS) {
          delete rec[blocked];
        }

        // Require at least a first name or last name
        const firstName = rec.firstName?.trim() || "";
        const lastName = rec.lastName?.trim() || "";
        if (!firstName && !lastName) {
          skipped++;
          continue;
        }

        // Reject metadata / report / widget rows with a stronger heuristic that mirrors
        // the client-side validator in app/compassion/import/clients/clientImportValidator.ts.
        // This is defense-in-depth: the wizard already filters these out, but a misbehaving
        // client (or curl) must not be able to inject garbage rows directly into the DB.
        //
        // ⚠ KEEP IN SYNC with GARBAGE_NAME_PATTERNS / RESERVED_NAME_TOKENS in
        // clientImportValidator.ts. The AGENTS.md "Compassion CRM Rules" section spells out
        // this requirement. If you change one heuristic, change the other and add a unit test
        // in tests/unit/compassion-client-import-validator.test.ts.
        const looksLikeGarbage = (s: string) => {
          const t = (s ?? "").trim();
          if (!t) return false;
          // Comma-separated metadata e.g. "Text,Aurora,False,Active,No,Not Applicable"
          if (/^[A-Za-z]+(?:,[^,]*){2,}/.test(t)) return true;
          // Widget / control / report tokens
          if (/^(text|true|false|null|none|n\/a|na|undefined|#?\s*row|column|label|field|widget|report|page|total|export|generated|filter|legend|header|footer)\b/i.test(t))
            return true;
          // ALL_CAPS layout artifacts
          if (/^[A-Z0-9_\-\s]{12,}$/.test(t)) return true;
          // Mostly digits / dashes / em-dashes
          if (/^[\d\s\-—–.,/]{6,}$/.test(t)) return true;
          // Contains the eKYROS em-dash separator
          if (/\s—\s/.test(t)) return true;
          // Single-token reserved placeholders
          if (/^(test|demo|sample|placeholder|tbd|tba|anonymous|unknown)$/i.test(t)) return true;
          return false;
        };
        if (looksLikeGarbage(firstName) || looksLikeGarbage(lastName)) {
          skipped++;
          continue;
        }

        // Drop obviously-invalid emails server-side too — never store junk in the email column.
        if (rec.email && !/^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]{2,}$/.test(rec.email.trim())) {
          delete rec.email;
        }

        const clientStatus = statusNormalize(rec.clientStatus ?? "");
        const intakeDate = parseDateOrUndefined(rec.sourceCreatedDate || rec.intakeDate) ?? new Date();

        const clientData = {
          organizationId,
          firstName,
          lastName,
          preferredName:  rec.preferredName?.trim()  || undefined,
          email:          rec.email?.trim()           || undefined,
          phone:          rec.phone?.trim()           || undefined,
          addressLine1:   rec.addressLine1?.trim()    || undefined,
          city:           rec.city?.trim()            || undefined,
          state:          rec.state?.toUpperCase().slice(0, 2) || undefined,
          zip:            rec.zip?.trim()             || undefined,
          dateOfBirth:    parseDateOrUndefined(rec.dateOfBirth),
          referralSource: rec.referralSource?.trim()  || undefined,
          clientStatus,
          intakeDate,
        };

        // Find potential duplicate: prefer External Source ID, fall back to email
        const existingByExtId = matchExternalSourceId && rec.externalSourceId
          ? await prisma.compassionClient.findFirst({
              where: { organizationId, privateNotes: { contains: `[EXT:${rec.externalSourceId}]` } },
              select: { id: true },
            })
          : null;

        const existingByEmail = !existingByExtId && matchEmail && clientData.email
          ? await prisma.compassionClient.findFirst({
              where: { organizationId, email: clientData.email },
              select: { id: true },
            })
          : null;

        const existing = existingByExtId ?? existingByEmail;

        if (dryRun) {
          // Dry-run: tally what would happen without writing any data
          if (existing) {
            mode === "create_only" ? skipped++ : updated++;
          } else {
            mode === "update_only" ? skipped++ : created++;
          }
          continue;
        }

        // Real import path
        if (existing) {
          if (mode === "create_only") {
            skipped++;
            continue;
          }
          // Update existing client (upsert or update_only mode)
          await prisma.compassionClient.update({
            where: { id: existing.id },
            data: {
              firstName:      clientData.firstName || undefined,
              lastName:       clientData.lastName  || undefined,
              email:          clientData.email,
              phone:          clientData.phone,
              addressLine1:   clientData.addressLine1,
              city:           clientData.city,
              state:          clientData.state,
              zip:            clientData.zip,
              clientStatus,
            },
          });
          updated++;
        } else {
          if (mode === "update_only") {
            skipped++;
            continue;
          }
          // Store external source ID in privateNotes as a structured annotation
          // TODO: add a dedicated externalSourceId field to CompassionClient schema
          const extNote = rec.externalSourceId ? `[EXT:${rec.externalSourceId}]` : undefined;
          const newClient = await prisma.compassionClient.create({
            data: { ...clientData, privateNotes: extNote },
          });

          // Log an activity for each newly created client
          await prisma.compassionActivity.create({
            data: {
              organizationId,
              clientId: newClient.id,
              activityType: "CLIENT_IMPORTED",
              description: `Client imported from CSV${rec.externalSourceId ? ` (DirID: ${rec.externalSourceId})` : ""}`,
              performedById: req.user?.sub ?? null,
            },
          });
          created++;
        }
      } catch (rowErr) {
        errors.push(`Row error: ${rowErr instanceof Error ? rowErr.message : "Unknown error"}`);
      }
    }

    await logAudit({
      action: dryRun ? "COMPASSION_CLIENT_IMPORT_DRYRUN" : "COMPASSION_CLIENT_IMPORT",
      entity: "CompassionClient",
      userId: req.user?.sub,
      organizationId,
      ipAddress: req.ip,
      metadata: {
        created,
        updated,
        skipped,
        errors: errors.length,
        dryRun,
        recordCount: records.length,
      },
    });

    res.json({
      created,
      updated,
      skipped,
      errors: errors.length,
      dryRun,
      errorMessages: errors.slice(0, 20),
    });
  } catch (err) {
    console.error("[compassion/clients/import]", err instanceof Error ? err.message : err);
    res.status(500).json({ error: { code: "IMPORT_ERROR", message: "Import failed." } });
  }
});

export default router;
