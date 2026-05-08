/**
 * Constituent (contact) management routes for OyamaCRM.
 * Provides CRUD operations for the core nonprofit constituent record —
 * donors, volunteers, members, and prospects.
 * Includes automatic Household record creation when a constituent of type
 * HOUSEHOLD is created or updated.
 *
 * Routes:
 *   GET    /api/constituents       — list/search constituents
 *   GET    /api/constituents/:id   — full constituent profile with donations, tasks, tags, household
 *   POST   /api/constituents       — create a new constituent
 *   PUT    /api/constituents/:id   — update an existing constituent
 *   DELETE /api/constituents/:id   — delete a constituent
 *
 * @module routes/constituents
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * Minimal field set returned in list responses and household member arrays.
 * Keeps payload size small when full profile data is not needed.
 */
const CONSTITUENT_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  city: true,
  state: true,
  type: true,
  donorStatus: true,
  totalLifetimeGiving: true,
  totalYtdGiving: true,
  lastGiftDate: true,
  lastGiftAmount: true,
  giftCount: true,
  engagementScore: true,
  tags: { include: { tag: { select: { name: true, color: true } } } },
};

/**
 * Compact field set used when a constituent appears as a household member.
 * Avoids over-fetching nested data in relationship views.
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

/** GET /api/constituents — List constituents with optional search, type, and status filters. */
router.get("/", async (req, res) => {
  const { search, type, status, limit = "50" } = req.query as Record<string, string>;

  const where = {
    ...(search && {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
        { email: { contains: search } },
        { phone: { contains: search } },
      ],
    }),
    ...(type && { type: type as never }),
    ...(status && { donorStatus: status as never }),
  };

  const items = await prisma.constituent.findMany({
    where,
    take: Math.min(parseInt(limit), 500),
    orderBy: { lastName: "asc" },
    select: CONSTITUENT_SELECT,
  });

  res.json(items);
});

/** GET /api/constituents/:id — Full constituent profile including donation history, tasks, tags, and household. */
router.get("/:id", async (req, res) => {
  const constituent = await prisma.constituent.findUnique({
    where: { id: req.params.id },
    include: {
      donations: {
        orderBy: { date: "desc" },
        take: 50,
        include: {
          campaign: { select: { name: true } },
          designation: { select: { name: true } },
        },
      },
      tasks: {
        orderBy: { dueDate: "asc" },
        include: { assignee: { select: { firstName: true, lastName: true } } },
      },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { firstName: true, lastName: true } } },
      },
      tags: { include: { tag: { select: { name: true, color: true } } } },
      // Household where this constituent is the head
      headOf: {
        include: {
          members: {
            select: MEMBER_SELECT,
            orderBy: { lastName: "asc" },
          },
        },
      },
      // Household this constituent belongs to (as a member)
      household: {
        include: {
          head: { select: { id: true, firstName: true, lastName: true, prefix: true } },
        },
      },
    },
  });

  if (!constituent) {
    res.status(404).json({ error: "Constituent not found" });
    return;
  }
  res.json(constituent);
});

/** POST /api/constituents — Create a new constituent. Auto-creates a Household record for HOUSEHOLD type. */
router.post("/", async (req, res) => {
  const {
    firstName, lastName, prefix, email, email2, phone, phone2, mobile,
    addressLine1, addressLine2, city, state, zip, country,
    type, donorStatus, employer, occupation, notes,
    doNotEmail, doNotCall, doNotMail, organizationId,
  } = req.body;

  const resolvedOrganizationId = await resolveOrganizationId({
    req,
    requestedOrganizationId: organizationId,
  });
  if (!resolvedOrganizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const constituent = await prisma.constituent.create({
    data: {
      firstName, lastName, prefix, email, email2, phone, phone2, mobile,
      addressLine1, addressLine2, city, state, zip,
      country: country ?? "US",
      type: type ?? "DONOR",
      donorStatus: donorStatus ?? "NEW",
      employer, occupation, notes,
      doNotEmail: doNotEmail ?? false,
      doNotCall: doNotCall ?? false,
      doNotMail: doNotMail ?? false,
      organizationId: resolvedOrganizationId,
    },
  });

  // Auto-create a Household record when type is HOUSEHOLD
  if ((type ?? "DONOR") === "HOUSEHOLD") {
    await prisma.household.create({
      data: {
        name: `${lastName} Household`,
        headConstituentId: constituent.id,
        addressLine1: addressLine1 ?? null,
        addressLine2: addressLine2 ?? null,
        city: city ?? null,
        state: state ?? null,
        zip: zip ?? null,
        country: country ?? "US",
      },
    });
  }

  await prisma.activity.create({
    data: {
      constituentId: constituent.id,
      type: "NOTE",
      description: "Constituent profile created",
      metadata: { source: "api/constituents:create", type: constituent.type },
    },
  });

  res.status(201).json(constituent);
});

/** PUT /api/constituents/:id — Update constituent fields. Ensures a Household record exists if switching to HOUSEHOLD type. */
router.put("/:id", async (req, res) => {
  const {
    firstName, lastName, prefix, email, email2, phone, phone2, mobile,
    addressLine1, addressLine2, city, state, zip, country,
    type, donorStatus, employer, occupation, notes,
    doNotEmail, doNotCall, doNotMail,
  } = req.body;

  const constituent = await prisma.constituent.update({
    where: { id: req.params.id },
    data: {
      firstName, lastName, prefix, email, email2, phone, phone2, mobile,
      addressLine1, addressLine2, city, state, zip, country,
      type, donorStatus, employer, occupation, notes,
      doNotEmail, doNotCall, doNotMail,
    },
  });

  // If switching to HOUSEHOLD type, ensure a Household record exists
  if (type === "HOUSEHOLD") {
    const existing = await prisma.household.findUnique({
      where: { headConstituentId: req.params.id },
    });
    if (!existing) {
      await prisma.household.create({
        data: {
          name: `${lastName} Household`,
          headConstituentId: req.params.id,
          addressLine1: addressLine1 ?? null,
          addressLine2: addressLine2 ?? null,
          city: city ?? null,
          state: state ?? null,
          zip: zip ?? null,
          country: country ?? "US",
        },
      });
    }
  }

  await prisma.activity.create({
    data: {
      constituentId: constituent.id,
      type: "NOTE",
      description: "Constituent profile updated",
      metadata: { source: "api/constituents:update" },
    },
  });

  res.json(constituent);
});

/** DELETE /api/constituents/:id — Permanently delete a constituent record. */
router.delete("/:id", async (req, res) => {
  await prisma.constituent.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
