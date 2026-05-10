/**
 * Household management routes for OyamaCRM.
 * Households group related constituents (families, couples) under a single record
 * with a designated head constituent. Members are regular constituents linked by
 * `householdId`; the head is linked by `headConstituentId` on the Household model.
 *
 * Routes:
 *   GET    /api/households/:id                       — household with head and members
 *   GET    /api/households/by-head/:constituentId    — lookup household by head constituent
 *   POST   /api/households/:id/members               — add a constituent to a household
 *   DELETE /api/households/:id/members/:constituentId — remove a member from a household
 *   PUT    /api/households/:id                       — update household address/name
 *
 * @module routes/households
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

// All household routes require authentication.
router.use(requireAuth);

// Household operations are constituent operations for permission purposes.
router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:constituents")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
    return requirePermission("edit:constituents")(req, res, next);
  }
  return next();
});

/**
 * Field set used when returning household members.
 * Provides enough information to display a member row without fetching the full profile.
 */
const MEMBER_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  prefix: true,
  email: true,
  phone: true,
  type: true,
  donorStatus: true,
  isPrimaryContact: true,
  totalLifetimeGiving: true,
};

/** GET /api/households/:id — Fetch a household with its head constituent and all members. */
router.get("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const household = await prisma.household.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { head: { organizationId } },
        { members: { some: { organizationId } } },
      ],
    },
    include: {
      head: { select: { id: true, firstName: true, lastName: true, prefix: true } },
      members: { select: MEMBER_SELECT, orderBy: { lastName: "asc" } },
    },
  });

  if (!household) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Household not found" } });
    return;
  }
  res.json(household);
});

/** GET /api/households/by-head/:constituentId — Find the household for which this constituent is the head. */
router.get("/by-head/:constituentId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const household = await prisma.household.findFirst({
    where: {
      headConstituentId: req.params.constituentId,
      head: { organizationId },
    },
    include: {
      members: { select: MEMBER_SELECT, orderBy: { lastName: "asc" } },
    },
  });

  if (!household) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "No household found for this constituent" } });
    return;
  }
  res.json(household);
});

/** POST /api/households/:id/members — Add an existing constituent to this household as a member. */
router.post("/:id/members", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const { constituentId } = req.body as { constituentId: string };
  if (!constituentId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "constituentId is required" } });
    return;
  }

  // Verify household exists
  const household = await prisma.household.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { head: { organizationId } },
        { members: { some: { organizationId } } },
      ],
    },
  });
  if (!household) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Household not found" } });
    return;
  }

  const member = await prisma.constituent.findFirst({
    where: { id: constituentId, organizationId },
    select: { id: true },
  });
  if (!member) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid constituentId for your organization" } });
    return;
  }

  // Prevent adding the head constituent as a regular member
  if (household.headConstituentId === constituentId) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Cannot add the household head as a member" } });
    return;
  }

  const updated = await prisma.constituent.update({
    where: { id: constituentId },
    data: { householdId: req.params.id },
    select: MEMBER_SELECT,
  });

  res.json(updated);
});

/** DELETE /api/households/:id/members/:constituentId — Remove a constituent from this household (sets householdId to null). */
router.delete("/:id/members/:constituentId", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const constituent = await prisma.constituent.findFirst({
    where: { id: req.params.constituentId, organizationId },
    select: { householdId: true },
  });

  if (!constituent || constituent.householdId !== req.params.id) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Member not found in this household" } });
    return;
  }

  await prisma.constituent.update({
    where: { id: req.params.constituentId },
    data: { householdId: null },
  });

  res.status(204).send();
});

/** PUT /api/households/:id — Update household name and/or address fields. */
router.put("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const { name, addressLine1, addressLine2, city, state, zip, country } = req.body;

  const existing = await prisma.household.findFirst({
    where: {
      id: req.params.id,
      OR: [
        { head: { organizationId } },
        { members: { some: { organizationId } } },
      ],
    },
    select: { id: true },
  });
  if (!existing) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Household not found" } });
    return;
  }

  const household = await prisma.household.update({
    where: { id: req.params.id },
    data: { name, addressLine1, addressLine2, city, state, zip, country },
  });

  res.json(household);
});

export default router;
