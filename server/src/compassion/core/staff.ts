import { Router } from "express";
import { hashPassword } from "../../lib/auth.js";
import { careTransaction } from "../core-policy.js";
import { prisma } from "../database.js";
import { logAudit,requireCare,resolveOrganizationId } from "../security.js";
import { mapCompassionStaffRow,normalizeOptionalId } from './shared.js';
const router = Router();


// ─── Compassion Staff Directory ─────────────────────────────────────────────

/**
 * GET /api/compassion/staff
 * Lists Compassion staff directory records for the authenticated organization.
 * Query params: active=true|false (optional), search, limit.
 */
router.get("/staff", async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const { active, search, limit = "200" } = req.query as Record<string, string>;
    const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 200, 1), 500);
    const activeFilter = active === "true" ? true : active === "false" ? false : undefined;
    const normalizedSearch = (search ?? "").trim();

    const staff = await prisma.compassionStaff.findMany({
      where: {
        organizationId,
        ...(activeFilter !== undefined ? { isActive: activeFilter } : {}),
        ...(normalizedSearch
          ? {
              OR: [
                { firstName: { contains: normalizedSearch } },
                { lastName: { contains: normalizedSearch } },
                { displayName: { contains: normalizedSearch } },
                { title: { contains: normalizedSearch } },
                { email: { contains: normalizedSearch } },
              ],
            }
          : {}),
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      take: parsedLimit,
      include: {
        linkedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
    });

    res.json(staff.map((item) => mapCompassionStaffRow(item)));
  } catch {
    console.error("[compassion] GET /staff error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load compassion staff" } });
  }
});


/**
 * GET /api/compassion/staff/user-options
 * Lists active platform users in-org so a Compassion staff record can link to an existing account.
 */
router.get("/staff/user-options", requireCare("manage"), async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const users = await prisma.user.findMany({
      where: {
        organizationId,
        active: true,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
    });

    res.json(users);
  } catch {
    console.error("[compassion] GET /staff/user-options error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to load user options" } });
  }
});


/**
 * POST /api/compassion/staff
 * Creates a Compassion staff directory entry. Accounts remain optional via linkedUserId.
 */
router.post("/staff", requireCare("manage"), careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const firstName = String(req.body?.firstName ?? "").trim();
    const lastName = String(req.body?.lastName ?? "").trim();
    const displayName = String(req.body?.displayName ?? "").trim() || null;
    const title = String(req.body?.title ?? "").trim() || null;
    const email = String(req.body?.email ?? "").trim() || null;
    const phone = String(req.body?.phone ?? "").trim() || null;
    const notes = String(req.body?.notes ?? "").trim() || null;
    const linkedUserId = normalizeOptionalId(req.body?.linkedUserId);

    if (!firstName || !lastName) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "firstName and lastName are required" } });
      return;
    }

    if (linkedUserId) {
      const linkedUser = await prisma.user.findFirst({
        where: { id: linkedUserId, organizationId },
        select: { id: true },
      });
      if (!linkedUser) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "linkedUserId is not valid for this organization" } });
        return;
      }
    }

    const created = await prisma.compassionStaff.create({
      data: {
        organizationId,
        firstName,
        lastName,
        displayName,
        title,
        email,
        phone,
        notes,
        linkedUserId,
        isActive: req.body?.isActive !== undefined ? Boolean(req.body.isActive) : true,
        supportsScheduling: req.body?.supportsScheduling !== undefined
          ? Boolean(req.body.supportsScheduling)
          : true,
      },
      include: {
        linkedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
    });

    await logAudit({
      action: "COMPASSION_STAFF_CREATED",
      entity: "CompassionStaff",
      entityId: created.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        linkedUserId: created.linkedUserId,
        supportsScheduling: created.supportsScheduling,
      },
    });

    res.status(201).json(mapCompassionStaffRow(created));
  } catch {
    console.error("[compassion] POST /staff error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create compassion staff" } });
  }
}));


/**
 * PATCH /api/compassion/staff/:id
 * Updates Compassion staff profile fields and optional linked account reference.
 */
router.patch("/staff/:id", requireCare("manage"), careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const staffId = String(req.params.id || "").trim();
    if (!staffId) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid staff id" } });
      return;
    }

    const linkedUserIdProvided = req.body?.linkedUserId !== undefined;
    const linkedUserId = linkedUserIdProvided ? normalizeOptionalId(req.body?.linkedUserId) : undefined;

    if (linkedUserIdProvided && linkedUserId) {
      const linkedUser = await prisma.user.findFirst({
        where: { id: linkedUserId, organizationId },
        select: { id: true },
      });
      if (!linkedUser) {
        res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "linkedUserId is not valid for this organization" } });
        return;
      }
    }

    const updated = await prisma.compassionStaff.updateMany({
      where: { id: staffId, organizationId },
      data: {
        ...(req.body?.firstName !== undefined && { firstName: String(req.body.firstName ?? "").trim() }),
        ...(req.body?.lastName !== undefined && { lastName: String(req.body.lastName ?? "").trim() }),
        ...(req.body?.displayName !== undefined && { displayName: String(req.body.displayName ?? "").trim() || null }),
        ...(req.body?.title !== undefined && { title: String(req.body.title ?? "").trim() || null }),
        ...(req.body?.email !== undefined && { email: String(req.body.email ?? "").trim() || null }),
        ...(req.body?.phone !== undefined && { phone: String(req.body.phone ?? "").trim() || null }),
        ...(req.body?.notes !== undefined && { notes: String(req.body.notes ?? "").trim() || null }),
        ...(req.body?.isActive !== undefined && { isActive: Boolean(req.body.isActive) }),
        ...(req.body?.supportsScheduling !== undefined && { supportsScheduling: Boolean(req.body.supportsScheduling) }),
        ...(linkedUserIdProvided && { linkedUserId: linkedUserId ?? null }),
      },
    });

    if (updated.count === 0) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Compassion staff not found" } });
      return;
    }

    const staff = await prisma.compassionStaff.findFirst({
      where: { id: staffId, organizationId },
      include: {
        linkedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
    });

    if (!staff) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Compassion staff not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_STAFF_UPDATED",
      entity: "CompassionStaff",
      entityId: staff.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        linkedUserId: staff.linkedUserId,
        supportsScheduling: staff.supportsScheduling,
        isActive: staff.isActive,
      },
    });

    res.json(mapCompassionStaffRow(staff));
  } catch {
    console.error("[compassion] PATCH /staff/:id error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to update compassion staff" } });
  }
}));


/**
 * POST /api/compassion/staff/:id/create-account
 * Creates an optional linked platform account for a Compassion staff profile.
 * Default role is report_viewer so account access can be limited to Compassion when linked.
 */
router.post("/staff/:id/create-account", requireCare("manage"), careTransaction(async (req, res) => {
  try {
    const organizationId = await resolveOrganizationId({ req });
    if (!organizationId) {
      res.status(400).json({ error: { code: "NO_ORG", message: "No organization found" } });
      return;
    }

    const staffId = String(req.params.id ?? "").trim();
    if (!staffId) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid staff id" } });
      return;
    }

    const staff = await prisma.compassionStaff.findFirst({
      where: { id: staffId, organizationId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        linkedUserId: true,
      },
    });

    if (!staff) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Compassion staff not found" } });
      return;
    }

    if (staff.linkedUserId) {
      res.status(409).json({ error: { code: "CONFLICT", message: "This staff profile already has a linked account" } });
      return;
    }

    const email = String(req.body?.email ?? "").trim().toLowerCase();
    const password = String(req.body?.password ?? "");
    const role = "compassion_user";

    if (!email || !password) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "email and password are required" } });
      return;
    }

    if (password.length < 10 || Buffer.byteLength(password, "utf8") > 72 || [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter((pattern) => pattern.test(password)).length < 3 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Use a valid email and a password of 10-72 bytes with at least 3 character categories." } });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      res.status(409).json({ error: { code: "CONFLICT", message: "A user with that email already exists" } });
      return;
    }

    const passwordHash = await hashPassword(password);
    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          organizationId,
          email,
          firstName: String(req.body?.firstName ?? "").trim() || staff.firstName,
          lastName: String(req.body?.lastName ?? "").trim() || staff.lastName,
          role,
          active: true,
          passwordHash,
        },
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          role: true,
          active: true,
        },
      });

      await tx.compassionStaff.update({
        where: { id: staff.id },
        data: { linkedUserId: user.id },
      });

      await tx.compassionMembership.create({ data: { organizationId, userId: user.id, role: "RECEPTION" } });
      return user;
    });

    const refreshedStaff = await prisma.compassionStaff.findFirst({
      where: { id: staff.id, organizationId },
      include: {
        linkedUser: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
            active: true,
          },
        },
      },
    });

    if (!refreshedStaff) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Compassion staff not found" } });
      return;
    }

    await logAudit({
      action: "COMPASSION_STAFF_ACCOUNT_CREATED",
      entity: "CompassionStaff",
      entityId: refreshedStaff.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        linkedUserId: refreshedStaff.linkedUserId,
        createdRole: createdUser.role,
      },
    });

    res.status(201).json({
      staff: mapCompassionStaffRow(refreshedStaff),
      account: createdUser,
    });
  } catch {
    console.error("[compassion] POST /staff/:id/create-account error:");
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to create linked staff account" } });
  }
}));
export const staffRoutes = router;
