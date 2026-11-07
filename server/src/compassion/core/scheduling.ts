import type {
CompassionAppointmentStatus,
CompassionAppointmentType
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { careTransaction } from "../core-policy.js";
import { prisma } from "../database.js";
import { logAudit,resolveOrganizationId } from "../security.js";
import { addMinutes,DEFAULT_APPOINTMENT_DURATION_MINUTES,findAppointmentConflicts,getValidCompassionStaff,hasValidLegacyStaffUser,mapAppointmentForWorkspace,normalizeOptionalId,resolveAppointmentWindow } from './shared.js';
const router = Router();


/**
 * GET /api/compassion/appointments
 * List appointments for calendar/list workspace.
 * Supports filters: clientId, caseId, status, appointmentType, assignedStaffId,
 * dateFrom, dateTo, location, search plus sorting.
 */
router.get("/appointments", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const {
      clientId,
      caseId,
      status,
      appointmentType,
      assignedStaffId,
      dateFrom,
      dateTo,
      location,
      search,
      sortBy = "startTime",
      sortOrder = "asc",
      limit = "250",
    } = req.query as Record<string, string>;

    const parsedLimit = Math.min(1000, Math.max(1, Number.parseInt(limit, 10) || 250));
    const normalizedSearch = (search ?? "").trim();

    const whereClauses: Array<Record<string, unknown>> = [];
    if (assignedStaffId) {
      whereClauses.push({
        OR: [
          { assignedCompassionStaffId: assignedStaffId },
          { assignedStaffId },
        ],
      });
    }

    if (normalizedSearch) {
      whereClauses.push({
        OR: [
          { notes: { contains: normalizedSearch } },
          { location: { contains: normalizedSearch } },
          { client: { firstName: { contains: normalizedSearch } } },
          { client: { lastName: { contains: normalizedSearch } } },
          { client: { email: { contains: normalizedSearch } } },
          { client: { phone: { contains: normalizedSearch } } },
          { assignedCompassionStaff: { is: { firstName: { contains: normalizedSearch } } } },
          { assignedCompassionStaff: { is: { lastName: { contains: normalizedSearch } } } },
        ],
      });
    }

    const where = {
      organizationId,
      ...(clientId && { clientId }),
      ...(caseId && { caseId }),
      ...(status && { status: status as CompassionAppointmentStatus }),
      ...(appointmentType && { appointmentType: appointmentType as CompassionAppointmentType }),
      ...(location && { location: { contains: location.trim() } }),
      ...(dateFrom || dateTo
        ? {
            startTime: {
              ...(dateFrom && { gte: new Date(dateFrom) }),
              ...(dateTo && {
                lte: (() => {
                  const endOfDay = new Date(dateTo);
                  endOfDay.setHours(23, 59, 59, 999);
                  return endOfDay;
                })(),
              }),
            },
          }
        : {}),
      ...(whereClauses.length > 0 ? { AND: whereClauses } : {}),
    };

    const orderBy: Prisma.CompassionAppointmentOrderByWithRelationInput =
      sortBy === "status"
        ? { status: sortOrder === "desc" ? "desc" : "asc" }
        : sortBy === "client"
          ? { client: { lastName: sortOrder === "desc" ? "desc" : "asc" } }
          : sortBy === "staff"
            ? { assignedCompassionStaff: { lastName: sortOrder === "desc" ? "desc" : "asc" } }
            : sortBy === "location"
              ? { location: sortOrder === "desc" ? "desc" : "asc" }
        : sortBy === "createdAt"
          ? { createdAt: sortOrder === "desc" ? "desc" : "asc" }
          : sortBy === "appointmentType"
            ? { appointmentType: sortOrder === "desc" ? "desc" : "asc" }
            : { startTime: sortOrder === "desc" ? "desc" : "asc" };

    const appointments = await prisma.compassionAppointment.findMany({
      where,
      take: parsedLimit,
      orderBy,
      include: {
        client: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            intakeDate: true,
          },
        },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        case: { select: { id: true, caseNumber: true } },
      },
    });

    const clientIds = [...new Set(appointments.map((appointment) => appointment.client.id))];
    const [firstByClient, noShowByClient] = await Promise.all([
      clientIds.length > 0
        ? prisma.compassionAppointment.groupBy({
            by: ["clientId"],
            where: { organizationId, clientId: { in: clientIds } },
            _min: { startTime: true },
          })
        : Promise.resolve([]),
      clientIds.length > 0
        ? prisma.compassionAppointment.groupBy({
            by: ["clientId"],
            where: { organizationId, clientId: { in: clientIds }, status: "NO_SHOW" },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const firstAppointmentByClient = new Map(firstByClient.map((row) => [row.clientId, row._min.startTime?.getTime() ?? Number.NaN]));
    const noShowCountByClient = new Map(noShowByClient.map((row) => [row.clientId, row._count._all]));

    const shaped = appointments.map((appointment) => mapAppointmentForWorkspace(appointment, firstAppointmentByClient, noShowCountByClient));

    res.json(shaped);
  } catch {
    console.error("[compassion] GET /appointments error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load appointments" } });
  }
});


/**
 * POST /api/compassion/appointments
 * Create a new appointment.
 * Body: { clientId, caseId?, appointmentType?, status?, startTime, endTime?, durationMinutes?,
 *          location?, assignedStaffId?, notes?, followUpNeeded?, allowConflict? }
 */
router.post("/appointments", careTransaction(async (req, res) => {
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
      appointmentType,
      status,
      startTime,
      endTime,
      durationMinutes,
      timezone,
      location,
      assignedCompassionStaffId,
      assignedStaffId,
      notes,
      followUpNeeded,
    } = req.body as Record<string, unknown>;

    if (!clientId || !startTime) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "clientId and startTime are required" } });
      return;
    }

    const timeWindow = resolveAppointmentWindow({ startTime, endTime, durationMinutes });
    if (!timeWindow) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid appointment time window" } });
      return;
    }

    const normalizedAssignedCompassionStaffId = normalizeOptionalId(assignedCompassionStaffId);
    let normalizedAssignedStaffId = normalizeOptionalId(assignedStaffId);
    const normalizedLocation = String(location ?? "").trim() || null;

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
      if (!compassionStaff.supportsScheduling) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member is not available for scheduling" } });
        return;
      }
      normalizedAssignedStaffId = normalizedAssignedStaffId ?? compassionStaff.linkedUserId ?? null;
    }

    const client = await prisma.compassionClient.findFirst({
      where: { id: String(clientId), organizationId },
      select: { id: true },
    });
    if (!client) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Client not found in this organization" } });
      return;
    }

    if (caseId) {
      const compassionCase = await prisma.compassionCase.findFirst({
        where: { id: String(caseId), organizationId, clientId: client.id },
        select: { id: true },
      });
      if (!compassionCase) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Case not found for this client" } });
        return;
      }
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    const conflicts = await findAppointmentConflicts({
      organizationId,
      start: timeWindow.start,
      end: timeWindow.end,
      clientId: client.id,
      assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
      assignedStaffId: normalizedAssignedStaffId,
      location: normalizedLocation,
    });
    if (conflicts.length > 0) {
      res.status(409).json({
        error: {
          code: "APPOINTMENT_CONFLICT",
          message: "Appointment conflicts with an existing booking.",
        },
        conflicts,
      });
      return;
    }

    const appointment = await prisma.compassionAppointment.create({
      data: {
        organizationId,
        clientId: client.id,
        caseId: caseId ? String(caseId) : null,
        appointmentType: (String(appointmentType ?? "OTHER") || "OTHER") as CompassionAppointmentType,
        status: (String(status ?? "SCHEDULED") || "SCHEDULED") as CompassionAppointmentStatus,
        startTime: timeWindow.start,
        endTime: timeWindow.end,
        timezone: String(timezone ?? "America/Chicago"),
        location: normalizedLocation,
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
        notes: notes ? String(notes) : null,
        followUpNeeded: Boolean(followUpNeeded),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, intakeDate: true } },
        case: { select: { id: true, caseNumber: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      },
    });

    // Log activity
    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId: client.id,
        caseId: caseId ? String(caseId) : null,
        appointmentId: appointment.id,
        activityType: "APPOINTMENT_SCHEDULED",
        description: `Appointment scheduled for ${timeWindow.start.toLocaleDateString()}`,
        performedById: req.user?.sub ?? null,
        metadata: {
          source: "internal-scheduler",
          durationMinutes: timeWindow.durationMinutes,
          assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
          assignedStaffId: normalizedAssignedStaffId,
          location: normalizedLocation,
        },
      },
    });

    await logAudit({
      action: "COMPASSION_APPOINTMENT_CREATED",
      entity: "CompassionAppointment",
      entityId: appointment.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        clientId: client.id,
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
        location: normalizedLocation,
      },
    });

    const firstByClient = new Map([[appointment.client.id, appointment.startTime.getTime()]]);
    const noShowByClient = new Map([[appointment.client.id, 0]]);
    res.status(201).json(mapAppointmentForWorkspace(appointment, firstByClient, noShowByClient));
  } catch {
    console.error("[compassion] POST /appointments error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create appointment" } });
  }
}));


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
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, intakeDate: true } },
        case: { select: { id: true, caseNumber: true, caseType: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        followUps: true,
      },
    });

    if (!appointment) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Appointment not found" } });
      return;
    }

    const firstByClient = new Map([[appointment.client.id, appointment.startTime.getTime()]]);
    const noShowByClient = new Map([[appointment.client.id, 0]]);
    res.json(mapAppointmentForWorkspace(appointment, firstByClient, noShowByClient));
  } catch {
    console.error("[compassion] GET /appointments/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load appointment" } });
  }
});


/**
 * PATCH /api/compassion/appointments/:id
 * Partially update an appointment (status, outcome, notes, etc.).
 */
router.patch("/appointments/:id", careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const existing = await prisma.compassionAppointment.findFirst({
      where: { id: req.params.id as string, organizationId },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, intakeDate: true } },
      },
    });

    if (!existing) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Appointment not found" } });
      return;
    }

    const {
      status,
      outcome,
      notes,
      startTime,
      endTime,
      durationMinutes,
      location,
      assignedCompassionStaffId,
      assignedStaffId,
      followUpNeeded,
      appointmentType,
      caseId,
    } = req.body as Record<string, unknown>;

    const nextClientId = existing.clientId;
    const assignedCompassionStaffProvided = assignedCompassionStaffId !== undefined;
    const assignedStaffProvided = assignedStaffId !== undefined;

    const nextAssignedCompassionStaffId = assignedCompassionStaffProvided
      ? normalizeOptionalId(assignedCompassionStaffId)
      : existing.assignedCompassionStaffId;
    let nextAssignedStaffId = assignedStaffProvided
      ? normalizeOptionalId(assignedStaffId)
      : existing.assignedStaffId;

    if (assignedCompassionStaffProvided) {
      if (nextAssignedCompassionStaffId) {
        const compassionStaff = await getValidCompassionStaff({
          organizationId,
          compassionStaffId: nextAssignedCompassionStaffId,
          requireActive: true,
        });
        if (!compassionStaff) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member not found" } });
          return;
        }
        if (!compassionStaff.supportsScheduling) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member is not available for scheduling" } });
          return;
        }
        if (!assignedStaffProvided) {
          nextAssignedStaffId = compassionStaff.linkedUserId ?? null;
        }
      } else if (!assignedStaffProvided) {
        nextAssignedStaffId = null;
      }
    }

    const nextLocation = location !== undefined
      ? (String(location ?? "").trim() || null)
      : existing.location;
    const nextCaseId = caseId !== undefined
      ? (String(caseId ?? "").trim() || null)
      : existing.caseId;

    if (nextCaseId) {
      const linkedCase = await prisma.compassionCase.findFirst({
        where: { id: nextCaseId, organizationId, clientId: nextClientId },
        select: { id: true },
      });
      if (!linkedCase) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Case not found for this client" } });
        return;
      }
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: nextAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

    let nextStart = existing.startTime;
    let nextEnd = existing.endTime ?? addMinutes(existing.startTime, DEFAULT_APPOINTMENT_DURATION_MINUTES);

    const startTimeProvided = startTime !== undefined;
    const endTimeProvided = endTime !== undefined;
    const durationProvided = durationMinutes !== undefined;

    if (startTimeProvided || endTimeProvided || durationProvided) {
      if (startTimeProvided && !endTimeProvided && !durationProvided) {
        const shiftedStart = new Date(String(startTime));
        if (Number.isNaN(shiftedStart.getTime())) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid startTime" } });
          return;
        }
        const currentDuration = Math.max(5, Math.round((nextEnd.getTime() - existing.startTime.getTime()) / 60_000));
        nextStart = shiftedStart;
        nextEnd = addMinutes(shiftedStart, currentDuration);
      } else {
        const effectiveEndInput = endTimeProvided
          ? endTime
          : (durationProvided ? undefined : existing.endTime?.toISOString());
        const resolvedWindow = resolveAppointmentWindow({
          startTime: startTimeProvided ? startTime : existing.startTime.toISOString(),
          endTime: effectiveEndInput,
          durationMinutes: durationProvided ? durationMinutes : undefined,
        });
        if (!resolvedWindow) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid appointment time window" } });
          return;
        }
        nextStart = resolvedWindow.start;
        nextEnd = resolvedWindow.end;
      }

    }

      const conflicts = await findAppointmentConflicts({
        organizationId,
        start: nextStart,
        end: nextEnd,
        clientId: nextClientId,
        assignedCompassionStaffId: nextAssignedCompassionStaffId,
        assignedStaffId: nextAssignedStaffId,
        location: nextLocation,
        excludeAppointmentId: existing.id,
      });
      if (!["CANCELLED", "NO_SHOW", "COMPLETED"].includes(String(status ?? existing.status)) && conflicts.length > 0) {
        res.status(409).json({
          error: {
            code: "APPOINTMENT_CONFLICT",
            message: "Appointment conflicts with an existing booking.",
          },
          conflicts,
        });
        return;
      }


    let nextStatus = status !== undefined
      ? (String(status) as CompassionAppointmentStatus)
      : existing.status;

    if (status === undefined && (startTimeProvided || endTimeProvided || durationProvided)) {
      if (existing.status === "SCHEDULED") nextStatus = "RESCHEDULED";
    }

    const updated = await prisma.compassionAppointment.update({
      where: { id: existing.id },
      data: {
        status: nextStatus,
        ...(outcome !== undefined && { outcome: outcome ? String(outcome) : null }),
        ...(notes !== undefined && { notes: notes ? String(notes) : null }),
        ...(startTimeProvided || endTimeProvided || durationProvided ? { startTime: nextStart, endTime: nextEnd } : {}),
        ...(location !== undefined && { location: nextLocation }),
        ...(assignedCompassionStaffProvided && { assignedCompassionStaffId: nextAssignedCompassionStaffId }),
        ...((assignedStaffProvided || assignedCompassionStaffProvided) && { assignedStaffId: nextAssignedStaffId }),
        ...(followUpNeeded !== undefined && { followUpNeeded: Boolean(followUpNeeded) }),
        ...(appointmentType !== undefined && { appointmentType: String(appointmentType) as CompassionAppointmentType }),
        ...(caseId !== undefined && { caseId: nextCaseId }),
      },
      include: {
        client: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, intakeDate: true } },
        case: { select: { id: true, caseNumber: true } },
        assignedStaff: { select: { id: true, firstName: true, lastName: true } },
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
      },
    });

    const statusChanged = nextStatus !== existing.status;
    const timeChanged = updated.startTime.getTime() !== existing.startTime.getTime()
      || (updated.endTime?.getTime() ?? 0) !== (existing.endTime?.getTime() ?? 0);

    if (statusChanged || timeChanged || notes !== undefined || outcome !== undefined) {
      await prisma.compassionActivity.create({
        data: {
          organizationId,
          clientId: updated.clientId,
          caseId: updated.caseId,
          appointmentId: updated.id,
          activityType: statusChanged ? "APPOINTMENT_STATUS_UPDATED" : (timeChanged ? "APPOINTMENT_RESCHEDULED" : "APPOINTMENT_UPDATED"),
          description: statusChanged
            ? `Appointment status changed to ${nextStatus}`
            : (timeChanged
              ? `Appointment moved to ${updated.startTime.toLocaleString()}`
              : "Appointment details updated"),
          performedById: req.user?.sub ?? null,
          metadata: {
            previousStatus: existing.status,
            newStatus: nextStatus,
            previousStartTime: existing.startTime,
            newStartTime: updated.startTime,
          },
        },
      });
    }

    await logAudit({
      action: "COMPASSION_APPOINTMENT_UPDATED",
      entity: "CompassionAppointment",
      entityId: updated.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        status: updated.status,
        startTime: updated.startTime,
        endTime: updated.endTime,
        assignedCompassionStaffId: updated.assignedCompassionStaffId,
        assignedStaffId: updated.assignedStaffId,
      },
    });

    const firstByClient = new Map([[updated.client.id, updated.startTime.getTime()]]);
    const noShowByClient = new Map([[updated.client.id, updated.status === "NO_SHOW" ? 1 : 0]]);
    res.json(mapAppointmentForWorkspace(updated, firstByClient, noShowByClient));
  } catch {
    console.error("[compassion] PATCH /appointments/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update appointment" } });
  }
}));


/**
 * DELETE /api/compassion/appointments/:id
 * Delete an appointment.
 */
router.delete("/appointments/:id", careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const appointment = await prisma.compassionAppointment.findFirst({
      where: { id: req.params.id as string, organizationId },
      select: { id: true, clientId: true, caseId: true },
    });
    if (!appointment) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Appointment not found" } });
      return;
    }

    await prisma.compassionAppointment.delete({ where: { id: appointment.id } });

    await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId: appointment.clientId,
        caseId: appointment.caseId,
        appointmentId: appointment.id,
        activityType: "APPOINTMENT_DELETED",
        description: "Appointment deleted",
        performedById: req.user?.sub ?? null,
      },
    });

    await logAudit({
      action: "COMPASSION_APPOINTMENT_DELETED",
      entity: "CompassionAppointment",
      entityId: appointment.id,
      userId: req.user?.sub,
      organizationId,
    });

    res.status(204).send();
  } catch {
    console.error("[compassion] DELETE /appointments/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete appointment" } });
  }
}));
export const schedulingRoutes = router;
