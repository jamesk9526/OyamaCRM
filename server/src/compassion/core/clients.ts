import type {
CompassionClientStatus
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import { Router } from "express";
import { careTransaction } from "../core-policy.js";
import { prisma } from "../database.js";
import { hasCareCapability,logAudit,requireCare,resolveOrganizationId } from "../security.js";
import { CLIENT_ACTIVITY_ENTRY_TYPES,getValidCompassionStaff,hasValidLegacyStaffUser,isAllowedClientActivityEntryType,normalizeActivityMetadata,normalizeOptionalId,resolveStaffReference } from './shared.js';
const router = Router();


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
 *   page/pageSize — metadata pagination; pageSize is capped at 250
 *   limit         — legacy non-metadata limit
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
      page = "1",
      pageSize,
      includeMeta,
      limit = "50",
    } = req.query as Record<string, string>;

    const normalizedSearch = (search ?? "").trim().replace(/\s+/g, " ");
    const searchTokens = normalizedSearch
      .split(" ")
      .map((token) => token.trim())
      .filter(Boolean)
      .slice(0, 6);

    const shouldIncludeMeta = includeMeta === "1" || includeMeta === "true";

    const parsedPage = Math.max(1, Number.parseInt(page, 10) || 1);
    const maxPageSize = shouldIncludeMeta ? 250 : 5000;
    const parsedPageSize = Math.min(
      maxPageSize,
      Math.max(1, Number.parseInt(pageSize ?? limit, 10) || 50),
    );

    const intakeFloor =
      intakeWithinDays && /^\d+$/.test(intakeWithinDays)
        ? new Date(Date.now() - Number(intakeWithinDays) * 24 * 60 * 60 * 1000)
        : undefined;

    const andClauses: Array<Record<string, unknown>> = [];

    if (staffId) {
      andClauses.push({
        OR: [
          { assignedCompassionStaffId: staffId },
          { assignedStaffId: staffId },
        ],
      });
    }

    if (assigned === "true") {
      andClauses.push({
        OR: [
          { assignedCompassionStaffId: { not: null } },
          { assignedStaffId: { not: null } },
        ],
      });
    }

    if (assigned === "false") {
      andClauses.push({
        AND: [
          { assignedCompassionStaffId: null },
          { assignedStaffId: null },
        ],
      });
    }

    if (missingContact === "true") {
      andClauses.push({
        AND: [
          { OR: [{ email: null }, { email: "" }] },
          { OR: [{ phone: null }, { phone: "" }] },
        ],
      });
    }

    if (normalizedSearch) {
      andClauses.push({
        OR: [
          { firstName: { contains: normalizedSearch } },
          { lastName: { contains: normalizedSearch } },
          { preferredName: { contains: normalizedSearch } },
          { email: { contains: normalizedSearch } },
          { phone: { contains: normalizedSearch } },
          { referralSource: { contains: normalizedSearch } },
          { assignedCompassionStaff: { is: { firstName: { contains: normalizedSearch } } } },
          { assignedCompassionStaff: { is: { lastName: { contains: normalizedSearch } } } },
        ],
      });

      for (const token of searchTokens) {
        andClauses.push({
          OR: [
            { firstName: { contains: token } },
            { lastName: { contains: token } },
            { preferredName: { contains: token } },
            { email: { contains: token } },
            { phone: { contains: token } },
            { referralSource: { contains: token } },
            { assignedCompassionStaff: { is: { firstName: { contains: token } } } },
            { assignedCompassionStaff: { is: { lastName: { contains: token } } } },
          ],
        });
      }
    }

    const where = {
      organizationId,
      ...(status && { clientStatus: status as CompassionClientStatus }),
      ...(intakeFloor && { intakeDate: { gte: intakeFloor } }),
      ...(andClauses.length > 0 ? { AND: andClauses } : {}),
    };

    const [clients, totalCount] = await Promise.all([
      prisma.compassionClient.findMany({
        where,
        skip: shouldIncludeMeta ? ((parsedPage - 1) * parsedPageSize) : undefined,
        take: shouldIncludeMeta ? parsedPageSize : parsedPageSize,
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
          assignedCompassionStaffId: true,
          assignedStaffId: true,
          assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          assignedStaff: { select: { firstName: true, lastName: true } },
          _count: { select: { cases: true, appointments: true } },
        },
      }),
      shouldIncludeMeta ? prisma.compassionClient.count({ where }) : Promise.resolve(0),
    ]);

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
    }).map((client) => {
      return {
        ...client,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: client.assignedCompassionStaff,
          assignedStaff: client.assignedStaff
            ? { id: client.assignedStaffId ?? "", firstName: client.assignedStaff.firstName, lastName: client.assignedStaff.lastName }
            : null,
        }),
      };
    });

    if (!shouldIncludeMeta) {
      res.json(safe);
      return;
    }

    const totalPages = Math.max(1, Math.ceil(totalCount / parsedPageSize));

    res.json({
      items: safe,
      totalCount,
      page: parsedPage,
      pageSize: parsedPageSize,
      totalPages,
      hasNextPage: parsedPage < totalPages,
      hasPreviousPage: parsedPage > 1,
    });
  } catch {
    console.error("[compassion] GET /clients error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load clients" } });
  }
});


/**
 * POST /api/compassion/clients
 * Create a new client record. Automatically logs a CLIENT_CREATED activity.
 * Body: { firstName, lastName, preferredName?, email?, phone?, dateOfBirth?,
 *          intakeDate?, referralSource?, assignedStaffId?, notes? }
 */
router.post("/clients", careTransaction(async (req, res) => {
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
      assignedCompassionStaffId,
      assignedStaffId,
      privateNotes,
      clientStatus,
    } = req.body;

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
      if (!compassionStaff.supportsScheduling) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member is not available for scheduling" } });
        return;
      }
      normalizedAssignedStaffId = normalizedAssignedStaffId ?? compassionStaff.linkedUserId ?? null;
    }

    if (!await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

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
        assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
        assignedStaffId: normalizedAssignedStaffId,
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
        metadata: {
          source: "api/compassion/clients:create",
          referralSource,
          assignedCompassionStaffId: normalizedAssignedCompassionStaffId,
          assignedStaffId: normalizedAssignedStaffId,
        },
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
  } catch {
    console.error("[compassion] POST /clients error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create client" } });
  }
}));


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
        assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
        cases: {
          orderBy: { openedAt: "desc" },
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
        appointments: {
          orderBy: { startTime: "desc" },
          take: 20,
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
        },
        services: {
          orderBy: { serviceDate: "desc" },
          take: 20,
        },
        followUps: {
          orderBy: { dueDate: "asc" },
          where: { status: { not: "COMPLETED" } },
          include: {
            assignedStaff: { select: { id: true, firstName: true, lastName: true } },
            assignedCompassionStaff: { select: { id: true, firstName: true, lastName: true, displayName: true } },
          },
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

    const { constituentId: legacyIdentity, ...clientRecord } = client;
    void legacyIdentity;
    const clinicalAccess = hasCareCapability(String(res.locals.careRole), "clinical");
    res.json({
      ...clientRecord,
      services: client.services.filter((service) => clinicalAccess || !["PREGNANCY_TEST", "ULTRASOUND"].includes(service.serviceType)),
      activities: client.activities.filter((activity) => clinicalAccess || !["CLIENT_DOCUMENT", "CLIENT_ASSESSMENT"].includes(activity.activityType)),
      assignedStaff: resolveStaffReference({
        assignedCompassionStaff: client.assignedCompassionStaff,
        assignedStaff: client.assignedStaff,
      }),
      cases: client.cases.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
      appointments: client.appointments.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
      followUps: client.followUps.map((item) => ({
        ...item,
        assignedStaff: resolveStaffReference({
          assignedCompassionStaff: item.assignedCompassionStaff,
          assignedStaff: item.assignedStaff,
        }),
      })),
    });
  } catch {
    console.error("[compassion] GET /clients/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load client" } });
  }
});


/**
 * GET /api/compassion/clients/:id/activity-entries
 * Returns client-scoped custom activity entries (notes, assessments, documents, communication, portal events).
 */
router.get("/clients/:id/activity-entries", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const clientId = String(req.params.id || "").trim();
    const { types, limit = "100" } = req.query as Record<string, string>;

    const client = await prisma.compassionClient.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true },
    });
    if (!client) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    const requestedTypeTokens = (types ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const requestedTypes = requestedTypeTokens
      .filter((value) => isAllowedClientActivityEntryType(value));

    if (requestedTypeTokens.length > 0 && requestedTypes.length === 0) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `types must include at least one allowed value: ${CLIENT_ACTIVITY_ENTRY_TYPES.join(", ")}`,
        },
      });
      return;
    }

    const activeTypes = (requestedTypes.length > 0 ? requestedTypes : [...CLIENT_ACTIVITY_ENTRY_TYPES])
      .filter((type) => hasCareCapability(String(res.locals.careRole), "clinical") || !["CLIENT_DOCUMENT", "CLIENT_ASSESSMENT"].includes(type));

    const parsedLimit = Math.min(Math.max(Number.parseInt(limit, 10) || 100, 1), 300);

    const entries = await prisma.compassionActivity.findMany({
      where: {
        organizationId,
        clientId,
        activityType: { in: activeTypes },
      },
      orderBy: { createdAt: "desc" },
      take: parsedLimit,
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    res.json(entries);
  } catch {
    console.error("[compassion] GET /clients/:id/activity-entries error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load client activity entries" } });
  }
});


/**
 * POST /api/compassion/clients/:id/activity-entries
 * Creates a client-scoped custom activity entry.
 * Body: { activityType, description, metadata?, caseId?, appointmentId? }
 */
router.post("/clients/:id/activity-entries", careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const clientId = String(req.params.id || "").trim();
    const activityType = String(req.body?.activityType || "").trim();
    const description = String(req.body?.description || "").trim();
    const caseId = req.body?.caseId ? String(req.body.caseId).trim() : null;
    const appointmentId = req.body?.appointmentId ? String(req.body.appointmentId).trim() : null;
    const metadata = normalizeActivityMetadata(req.body?.metadata);
    const metadataInput = metadata as Prisma.InputJsonValue | undefined;

    if (!isAllowedClientActivityEntryType(activityType)) {
      res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: `activityType must be one of: ${CLIENT_ACTIVITY_ENTRY_TYPES.join(", ")}`,
        },
      });
      return;
    }

    if (!description) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "description is required" } });
      return;
    }

    const client = await prisma.compassionClient.findFirst({
      where: { id: clientId, organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (!client) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Client not found" } });
      return;
    }

    if (caseId) {
      const linkedCase = await prisma.compassionCase.findFirst({
        where: { id: caseId, organizationId, clientId },
        select: { id: true },
      });
      if (!linkedCase) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Case not found for this client" } });
        return;
      }
    }

    if (appointmentId) {
      const linkedAppointment = await prisma.compassionAppointment.findFirst({
        where: { id: appointmentId, organizationId, clientId },
        select: { id: true },
      });
      if (!linkedAppointment) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Appointment not found for this client" } });
        return;
      }
    }

    const created = await prisma.compassionActivity.create({
      data: {
        organizationId,
        clientId,
        caseId,
        appointmentId,
        activityType,
        description,
        metadata: metadataInput,
        performedById: req.user?.sub ?? null,
      },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logAudit({
      action: "COMPASSION_CLIENT_ACTIVITY_ENTRY_CREATED",
      entity: "CompassionActivity",
      entityId: created.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { clientId, activityType },
    });

    res.status(201).json(created);
  } catch {
    console.error("[compassion] POST /clients/:id/activity-entries error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create client activity entry" } });
  }
}));


/**
 * PATCH /api/compassion/clients/:id/activity-entries/:entryId
 * Updates a client-scoped custom activity entry.
 */
router.patch("/clients/:id/activity-entries/:entryId", careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const clientId = String(req.params.id || "").trim();
    const entryId = String(req.params.entryId || "").trim();
    const description = req.body?.description;
    const metadata = req.body?.metadata;

    const existing = await prisma.compassionActivity.findFirst({
      where: {
        id: entryId,
        organizationId,
        clientId,
      },
      select: { id: true, activityType: true },
    });

    if (!existing || !isAllowedClientActivityEntryType(existing.activityType)) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Activity entry not found" } });
      return;
    }

    if (description === undefined && metadata === undefined) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "No updatable fields were provided" } });
      return;
    }

    if (description !== undefined && !String(description).trim()) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "description cannot be empty" } });
      return;
    }

    const normalizedMetadata = metadata !== undefined ? normalizeActivityMetadata(metadata) : undefined;
    const metadataUpdate = normalizedMetadata === undefined
      ? undefined
      : normalizedMetadata === null
        ? Prisma.JsonNull
        : (normalizedMetadata as Prisma.InputJsonValue);

    const updated = await prisma.compassionActivity.update({
      where: { id: existing.id },
      data: {
        ...(description !== undefined && { description: String(description).trim() }),
        ...(metadata !== undefined && { metadata: metadataUpdate }),
      },
      include: {
        performedBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });

    await logAudit({
      action: "COMPASSION_CLIENT_ACTIVITY_ENTRY_UPDATED",
      entity: "CompassionActivity",
      entityId: updated.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { clientId, activityType: updated.activityType },
    });

    res.json(updated);
  } catch {
    console.error("[compassion] PATCH /clients/:id/activity-entries/:entryId error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update client activity entry" } });
  }
}));


/**
 * DELETE /api/compassion/clients/:id/activity-entries/:entryId
 * Deletes a client-scoped custom activity entry.
 */
router.delete("/clients/:id/activity-entries/:entryId", careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const clientId = String(req.params.id || "").trim();
    const entryId = String(req.params.entryId || "").trim();

    const existing = await prisma.compassionActivity.findFirst({
      where: {
        id: entryId,
        organizationId,
        clientId,
      },
      select: { id: true, activityType: true },
    });

    if (!existing || !isAllowedClientActivityEntryType(existing.activityType)) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Activity entry not found" } });
      return;
    }

    await prisma.compassionActivity.delete({ where: { id: existing.id } });

    await logAudit({
      action: "COMPASSION_CLIENT_ACTIVITY_ENTRY_DELETED",
      entity: "CompassionActivity",
      entityId: existing.id,
      userId: req.user?.sub,
      organizationId,
      metadata: { clientId, activityType: existing.activityType },
    });

    res.status(204).send();
  } catch {
    console.error("[compassion] DELETE /clients/:id/activity-entries/:entryId error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete client activity entry" } });
  }
}));


/**
 * PUT /api/compassion/clients/:id
 * Update a client record. Accepts any subset of client fields.
 */
router.put("/clients/:id", careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }
    const {
      firstName, lastName, preferredName, email, phone,
      addressLine1, addressLine2, city, state, zip,
      dateOfBirth, intakeDate, referralSource, assignedStaffId, assignedCompassionStaffId,
      privateNotes, clientStatus,
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
        if (!compassionStaff.supportsScheduling) {
          res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned compassion staff member is not available for scheduling" } });
          return;
        }
        if (!legacyStaffProvided) {
          normalizedAssignedStaffId = compassionStaff.linkedUserId ?? null;
        }
      } else if (!legacyStaffProvided) {
        // Clearing Compassion staff assignment also clears the legacy user link unless explicitly provided.
        normalizedAssignedStaffId = null;
      }
    }

    if ((legacyStaffProvided || compassionStaffProvided)
      && !await hasValidLegacyStaffUser({ organizationId, assignedStaffId: normalizedAssignedStaffId ?? null })) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Assigned legacy staff account not found" } });
      return;
    }

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
        ...(compassionStaffProvided && { assignedCompassionStaffId: normalizedAssignedCompassionStaffId ?? null }),
        ...((legacyStaffProvided || compassionStaffProvided) && { assignedStaffId: normalizedAssignedStaffId ?? null }),
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
  } catch {
    console.error("[compassion] PUT /clients/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update client" } });
  }
}));


/**
 * DELETE /api/compassion/clients/:id
 * Permanently delete a client record. Admin only.
 */
router.delete("/clients/:id", requireCare("manage"), careTransaction(async (req, res) => {
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
  } catch {
    console.error("[compassion] DELETE /clients/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to delete client" } });
  }
}));


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
router.post("/clients/import", (_req, res) => {
  res.status(410).json({ error: { code: "PREVIEW_REQUIRED", message: "Use migration preview and commit to import client records." } });
});
export const clientsRoutes = router;
