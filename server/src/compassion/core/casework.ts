import type {
CompassionCaseStatus,
CompassionCaseType,
CompassionFollowUpStatus,
CompassionPriority,
CompassionServiceType
} from "@prisma/client";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { hasActiveCaseworkAccount,OPEN_CARE_TASK_STATUSES } from "../care-team.js";
import { careTransaction } from "../core-policy.js";
import { prisma } from "../database.js";
import { hasCareCapability,logAudit,requireCare,resolveOrganizationId } from "../security.js";
import { computeFamilyKey,getValidCompassionStaff,hasValidLegacyStaffUser,normalizeOptionalId,resolveStaffReference } from './shared.js';
const router = Router();


// ─── Families ────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/families
 * Returns household-style family groupings inferred from address/phone/name data.
 */
router.get("/families", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { search, minMembers = "2", limit = "100" } = req.query as Record<string, string>;
    const min = Math.max(parseInt(minMembers || "2", 10) || 2, 1);
    const take = Math.min(Math.max(parseInt(limit || "100", 10) || 100, 1), 250);

    const clients = await prisma.compassionClient.findMany({
      where: {
        organizationId,
        ...(search
          ? {
              OR: [
                { firstName: { contains: search } },
                { lastName: { contains: search } },
                { addressLine1: { contains: search } },
                { city: { contains: search } },
                { phone: { contains: search } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        preferredName: true,
        phone: true,
        email: true,
        addressLine1: true,
        city: true,
        state: true,
        zip: true,
        clientStatus: true,
        intakeDate: true,
      },
    });

    const grouped = new Map<string, typeof clients>();
    for (const client of clients) {
      const key = computeFamilyKey(client);
      const list = grouped.get(key) ?? [];
      list.push(client);
      grouped.set(key, list);
    }

    const families = Array.from(grouped.entries())
      .filter(([, members]) => members.length >= min)
      .map(([key, members]) => {
        const familyName = `${members[0].lastName || members[0].firstName} Family`;
        const location = [members[0].addressLine1, members[0].city, members[0].state, members[0].zip]
          .filter(Boolean)
          .join(", ");
        const activeMembers = members.filter((m) => m.clientStatus === "ACTIVE").length;

        return {
          id: key,
          familyName,
          familyKey: key,
          memberCount: members.length,
          activeMembers,
          location,
          members: members.map((member) => ({
            id: member.id,
            firstName: member.firstName,
            lastName: member.lastName,
            preferredName: member.preferredName,
            clientStatus: member.clientStatus,
            phone: member.phone,
            email: member.email,
            intakeDate: member.intakeDate,
          })),
        };
      })
      .sort((a, b) => b.memberCount - a.memberCount || a.familyName.localeCompare(b.familyName));

    res.json({
      totalFamilies: families.length,
      totalClientsGrouped: families.reduce((sum, family) => sum + family.memberCount, 0),
      families,
    });
  } catch {
    console.error("[compassion] GET /families error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load families" } });
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
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        _count: { select: { appointments: true, followUps: true } },
      },
    });

    res.json(cases.map((item) => ({
      ...item,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: item.assignedCompassionStaff,
        assignedStaff: item.assignedStaff,
      }),
    })));
  } catch {
    console.error("[compassion] GET /cases error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load cases" } });
  }
});


/**
 * POST /api/compassion/cases
 * Create a new case. Auto-generates a CASE-YYYY-NNN case number.
 * Body: { clientId, caseType?, priority?, summary?, assignedStaffId? }
 */
router.post("/cases", careTransaction(async (req, res) => {
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
      clientId,
      caseType,
      priority,
      summary,
      assignedStaffId,
      assignedCompassionStaffId,
      privateNotes,
    } = req.body;

    if (!clientId) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId is required" } });
      return;
    }

    // Auto-generate case number: CASE-YYYY-NNN
    const year = new Date().getFullYear();
    const caseNumber = `CASE-${year}-${randomUUID().slice(0, 8).toUpperCase()}`;

    const normalizedAssignedCompassionStaffId = normalizeOptionalId(assignedCompassionStaffId);
    let normalizedAssignedStaffId = normalizeOptionalId(assignedStaffId);

    if (normalizedAssignedCompassionStaffId) {
      const compassionStaff = await getValidCompassionStaff({
        organizationId,
        compassionStaffId: normalizedAssignedCompassionStaffId,
        requireActive: true,
      });
      if (!compassionStaff) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
        return;
      }
      normalizedAssignedStaffId = normalizedAssignedStaffId ?? compassionStaff.linkedUserId ?? null;
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const compassionCase = await prisma.compassionCase.create({
      data: {
        organizationId,
        clientId,
        caseNumber,
        caseType: (caseType ?? "OTHER") as CompassionCaseType,
        priority: (priority ?? "MEDIUM") as CompassionPriority,
        summary: summary ?? null,
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
        privateNotes: privateNotes ?? null,
        caseStatus: "OPEN",
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
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

    res.status(201).json({
      ...compassionCase,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: compassionCase.assignedCompassionStaff,
        assignedStaff: compassionCase.assignedStaff,
      }),
    });
  } catch {
    console.error("[compassion] POST /cases error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create case" } });
  }
}));


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
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        appointments: {
          orderBy: { startTime: "desc" },
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
        services: { orderBy: { serviceDate: "desc" } },
        followUps: {
          orderBy: { dueDate: "asc" },
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
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

    res.json({
      ...compassionCase,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: compassionCase.assignedCompassionStaff,
        assignedStaff: compassionCase.assignedStaff,
      }),
      appointments: compassionCase.appointments.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
      followUps: compassionCase.followUps.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
    });
  } catch {
    console.error("[compassion] GET /cases/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load case" } });
  }
});


/**
 * PUT /api/compassion/cases/:id
 * Update a case (status, type, priority, notes, assignee).
 */
router.put("/cases/:id", careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const {
      caseStatus,
      caseType,
      priority,
      summary,
      assignedStaffId,
      assignedCompassionStaffId,
      closedAt,
      privateNotes,
    } = req.body;

    const compassionStaffProvided = assignedCompassionStaffId !== undefined;
    const legacyStaffProvided = assignedStaffId !== undefined;
    const normalizedAssignedCompassionStaffId = compassionStaffProvided
      ? normalizeOptionalId(assignedCompassionStaffId)
      : undefined;
    let normalizedAssignedStaffId = legacyStaffProvided
      ? normalizeOptionalId(assignedStaffId)
      : undefined;

    if (compassionStaffProvided) {
      if (normalizedAssignedCompassionStaffId) {
        const compassionStaff = await getValidCompassionStaff({
          organizationId,
          compassionStaffId: normalizedAssignedCompassionStaffId,
          requireActive: true,
        });
        if (!compassionStaff) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
          return;
        }
        if (!legacyStaffProvided) {
          normalizedAssignedStaffId = compassionStaff.linkedUserId ?? null;
        }
      } else if (!legacyStaffProvided) {
        normalizedAssignedStaffId = null;
      }
    }

    if ((legacyStaffProvided || compassionStaffProvided)
      && !await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId ?? null })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const updated = await prisma.compassionCase.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(caseStatus !== undefined && { caseStatus: caseStatus as CompassionCaseStatus }),
        ...(caseType !== undefined && { caseType: caseType as CompassionCaseType }),
        ...(priority !== undefined && { priority: priority as CompassionPriority }),
        ...(summary !== undefined && { summary }),
        ...(compassionStaffProvided && { assignedCompassionStaffId: normalizedAssignedCompassionStaffId ?? null }),
        ...((legacyStaffProvided || compassionStaffProvided) && { assignedStaffId: normalizedAssignedStaffId ?? null }),
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
  } catch {
    console.error("[compassion] PUT /cases/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update case" } });
  }
}));


/**
 * DELETE /api/compassion/cases/:id
 * Permanently delete a case. Admin only.
 */
router.delete("/cases/:id", requireCare("manage"), careTransaction(async (req, res) => {
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
  } catch {
    console.error("[compassion] DELETE /cases/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete case" } });
  }
}));


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

    const { clientId, chartId, status, priority, assignedStaffId, limit = "50" } = req.query as Record<string, string>;

    if (status && !["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED", "OVERDUE", "OPEN"].includes(status)) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid follow-up status." } }); return;
    }
    if (priority && !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a valid follow-up priority." } }); return;
    }
    const take = Number(limit);
    if (!Number.isSafeInteger(take) || take < 1 || take > 500) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose a follow-up limit between 1 and 500." } }); return;
    }

    const whereClauses: Array<Record<string, unknown>> = [];
    if (assignedStaffId) {
      whereClauses.push({
        OR: [
          { assignedCompassionStaffId: assignedStaffId },
          { assignedStaffId },
        ],
      });
    }

    const followUps = await prisma.compassionFollowUp.findMany({
      where: {
        organizationId,
        ...(clientId && { clientId }),
        ...(chartId && { chartId }),
        ...(status === "OVERDUE" ? { OR: [{ status: "OVERDUE" }, { status: { in: ["PENDING", "IN_PROGRESS"] as CompassionFollowUpStatus[] }, dueDate: { lt: new Date() } }] } : status === "OPEN" ? { status: { in: [...OPEN_CARE_TASK_STATUSES] } } : status ? { status: status as CompassionFollowUpStatus } : {}),
        ...(priority && { priority: priority as CompassionPriority }),
        ...(whereClauses.length > 0 ? { AND: whereClauses } : {}),
      },
      take,
      orderBy: { dueDate: "asc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        case: { select: { id: true, caseNumber: true } },
      },
    });

    res.json(followUps.map((item) => ({
      ...item,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: item.assignedCompassionStaff,
        assignedStaff: item.assignedStaff,
      }),
    })));
  } catch {
    console.error("[compassion] GET /follow-ups error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load follow-ups" } });
  }
});


/**
 * POST /api/compassion/follow-ups
 * Create a new follow-up item.
 * Body: { clientId, caseId?, appointmentId?, title, dueDate, priority?, assignedStaffId?, notes? }
 */
router.post("/follow-ups", careTransaction(async (req, res) => {
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
      clientId,
      caseId,
      appointmentId,
      visitId,
      title,
      dueDate,
      priority,
      assignedStaffId,
      assignedCompassionStaffId,
      notes,
    } = req.body;

    if (!clientId || !title || !dueDate) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId, title, and dueDate are required" } });
      return;
    }

    if (typeof title !== "string" || !title.trim() || title.length > 191 || typeof dueDate !== "string" || !Number.isFinite(Date.parse(dueDate)) || (priority && !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority))) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter a title, valid due date, and supported priority." } }); return;
    }
    if (!await prisma.compassionClient.findFirst({ where: { id: String(clientId), organizationId }, select: { id: true } })
      || (caseId && !await prisma.compassionCase.findFirst({ where: { id: String(caseId), clientId: String(clientId), organizationId }, select: { id: true } }))
      || (appointmentId && !await prisma.compassionAppointment.findFirst({ where: { id: String(appointmentId), clientId: String(clientId), organizationId }, select: { id: true } }))) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Select a client and related records in this care workspace." } }); return;
    }

    if (visitId && !await prisma.compassionVisit.findFirst({ where: { id: String(visitId), organizationId, clientId: String(clientId), ...(caseId ? { caseId: String(caseId) } : {}) } })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Choose this client’s visit." } }); return;
    }
    const normalizedAssignedCompassionStaffId = normalizeOptionalId(assignedCompassionStaffId);
    let normalizedAssignedStaffId = normalizeOptionalId(assignedStaffId);

    if (normalizedAssignedCompassionStaffId) {
      const compassionStaff = await getValidCompassionStaff({
        organizationId,
        compassionStaffId: normalizedAssignedCompassionStaffId,
        requireActive: true,
      });
      if (!compassionStaff) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
        return;
      }
      normalizedAssignedStaffId = normalizedAssignedStaffId ?? compassionStaff.linkedUserId ?? null;
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const followUp = await prisma.compassionFollowUp.create({
      data: {
        organizationId,
        clientId,
        caseId: caseId ?? null,
        appointmentId: appointmentId ?? null,
        visitId: visitId ?? null,
        title: title.trim(),
        dueDate: new Date(dueDate),
        priority: (priority ?? "MEDIUM") as CompassionPriority,
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
        notes: notes ?? null,
        status: "PENDING",
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        case: { select: { id: true, caseNumber: true } },
      },
    });

    res.status(201).json({
      ...followUp,
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: followUp.assignedCompassionStaff,
        assignedStaff: followUp.assignedStaff,
      }),
    });
  } catch {
    console.error("[compassion] POST /follow-ups error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create follow-up" } });
  }
}));


/**
 * PATCH /api/compassion/follow-ups/:id
 * Partially update a follow-up (mark complete, change assignee, update notes).
 */
router.patch("/follow-ups/:id", careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const {
      status,
      title,
      dueDate,
      priority,
      assignedStaffId,
      assignedCompassionStaffId,
      notes,
    } = req.body;

    if ((status !== undefined && !["PENDING", "IN_PROGRESS", "OVERDUE", "COMPLETED", "CANCELLED"].includes(status))
      || (priority !== undefined && !["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority))
      || (dueDate !== undefined && (typeof dueDate !== "string" || !Number.isFinite(Date.parse(dueDate))))
      || (title !== undefined && (typeof title !== "string" || !title.trim() || title.length > 191))) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Enter valid follow-up details." } }); return;
    }

    const compassionStaffProvided = assignedCompassionStaffId !== undefined;
    const legacyStaffProvided = assignedStaffId !== undefined;
    const normalizedAssignedCompassionStaffId = compassionStaffProvided
      ? normalizeOptionalId(assignedCompassionStaffId)
      : undefined;
    let normalizedAssignedStaffId = legacyStaffProvided
      ? normalizeOptionalId(assignedStaffId)
      : undefined;

    if (compassionStaffProvided) {
      if (normalizedAssignedCompassionStaffId) {
        const compassionStaff = await getValidCompassionStaff({
          organizationId,
          compassionStaffId: normalizedAssignedCompassionStaffId,
          requireActive: true,
        });
        if (!compassionStaff) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
          return;
        }
        if (!legacyStaffProvided) {
          normalizedAssignedStaffId = compassionStaff.linkedUserId ?? null;
        }
      } else if (!legacyStaffProvided) {
        normalizedAssignedStaffId = null;
      }
    }

    if ((legacyStaffProvided || compassionStaffProvided)
      && !await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId ?? null })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const current = await prisma.compassionFollowUp.findFirst({ where: { id: req.params.id as string, organizationId } });
    if (!current) { res.status(404).json({ error: { code: "NOT_FOUND", message: "Follow-up not found" } }); return; }
    if (current.chartId && (legacyStaffProvided || compassionStaffProvided) && normalizedAssignedStaffId && !await hasActiveCaseworkAccount(organizationId, normalizedAssignedStaffId)) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Select an active care-team account with casework access." } }); return;
    }
    if (current.chartId && status && (OPEN_CARE_TASK_STATUSES as readonly string[]).includes(status)
      && await prisma.compassionFollowUp.findFirst({ where: { organizationId, chartId: current.chartId, id: { not: current.id }, status: { in: [...OPEN_CARE_TASK_STATUSES] } } })) {
      res.status(409).json({ error: { code: "FOLLOW_UP_EXISTS", message: "This examination already has another open care follow-up." } }); return;
    }
    const updated = await prisma.compassionFollowUp.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(status !== undefined && { status: status as CompassionFollowUpStatus }),
        ...(title !== undefined && { title }),
        ...(dueDate !== undefined && { dueDate: new Date(dueDate) }),
        ...(priority !== undefined && { priority: priority as CompassionPriority }),
        ...(compassionStaffProvided && { assignedCompassionStaffId: normalizedAssignedCompassionStaffId ?? null }),
        ...((legacyStaffProvided || compassionStaffProvided) && { assignedStaffId: normalizedAssignedStaffId ?? null }),
        ...(notes !== undefined && { notes }),
        ...(status !== undefined && { completedAt: status === "COMPLETED" ? new Date() : null }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Follow-up not found" } });
      return;
    }

    res.json({ id: req.params.id, updated: true });
  } catch {
    console.error("[compassion] PATCH /follow-ups/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update follow-up" } });
  }
}));


/**
 * DELETE /api/compassion/follow-ups/:id
 * Delete a follow-up.
 */
router.delete("/follow-ups/:id", careTransaction(async (req, res) => {
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
  } catch {
    console.error("[compassion] DELETE /follow-ups/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete follow-up" } });
  }
}));


// ─── Services ──────────────────────────────────────────────────────────────────

/**
 * GET /api/compassion/services
 * List services delivered. Supports filters: clientId, caseId, serviceType, serviceTypes.
 */
router.get("/services", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { clientId, caseId, serviceType, serviceTypes, limit = "50" } = req.query as Record<string, string>;

    const requestedTypes = (serviceTypes ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean) as CompassionServiceType[];

    const services = await prisma.compassionService.findMany({
      where: {
        organizationId,
        ...(clientId && { clientId }),
        ...(caseId && { caseId }),
        ...(!hasCareCapability(String(res.locals.careRole), "clinical") ? { AND: [{ serviceType: { notIn: ["PREGNANCY_TEST", "ULTRASOUND"] as CompassionServiceType[] } }] } : {}),
        ...(requestedTypes.length > 0
          ? { serviceType: { in: requestedTypes } }
          : serviceType
            ? { serviceType: serviceType as CompassionServiceType }
            : {}),
      },
      take: parseInt(limit),
      orderBy: { serviceDate: "desc" },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        providedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(services);
  } catch {
    console.error("[compassion] GET /services error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load services" } });
  }
});


/**
 * POST /api/compassion/services
 * Record a service delivered to a client.
 * Body: { clientId, caseId?, serviceType, serviceDate?, quantity?, notes?, providedById? }
 */
router.post("/services", careTransaction(async (req, res) => {
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
  } catch {
    console.error("[compassion] POST /services error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create service record" } });
  }
}));


/**
 * PATCH /api/compassion/services/:id
 * Partially update a service record.
 * Body: { serviceType?, serviceDate?, quantity?, notes?, providedById? }
 */
router.patch("/services/:id", careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { serviceType, serviceDate, quantity, notes, providedById } = req.body;

    if (
      serviceType === undefined
      && serviceDate === undefined
      && quantity === undefined
      && notes === undefined
      && providedById === undefined
    ) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No updatable fields were provided" } });
      return;
    }

    if (quantity !== undefined && quantity !== null && quantity !== "") {
      const parsedQuantity = Number(quantity);
      if (!Number.isFinite(parsedQuantity) || parsedQuantity < 0) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "quantity must be a non-negative number" } });
        return;
      }
    }

    if (serviceDate !== undefined) {
      const parsedServiceDate = new Date(serviceDate);
      if (Number.isNaN(parsedServiceDate.getTime())) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "serviceDate must be a valid date" } });
        return;
      }
    }

    const updated = await prisma.compassionService.updateMany({
      where: { id: req.params.id as string, organizationId },
      data: {
        ...(serviceType !== undefined && { serviceType: serviceType as CompassionServiceType }),
        ...(serviceDate !== undefined && { serviceDate: new Date(serviceDate) }),
        ...(quantity !== undefined && {
          quantity:
            quantity === null || quantity === ""
              ? null
              : Number(quantity),
        }),
        ...(notes !== undefined && { notes: String(notes ?? "").trim() || null }),
        ...(providedById !== undefined && { providedById: providedById ? String(providedById) : null }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Service record not found" } });
      return;
    }

    const service = await prisma.compassionService.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true } },
        providedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    if (!service) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Service record not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_SERVICE_UPDATED",
      entity: "CompassionService",
      entityId: service.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        clientId: service.clientId,
        serviceType: service.serviceType,
      },
    });

    res.json(service);
  } catch {
    console.error("[compassion] PATCH /services/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update service record" } });
  }
}));


/**
 * DELETE /api/compassion/services/:id
 * Delete a service record. Admin only.
 */
router.delete("/services/:id", requireCare("manage"), careTransaction(async (req, res) => {
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
  } catch {
    console.error("[compassion] DELETE /services/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete service record" } });
  }
}));
export const caseworkRoutes = router;
