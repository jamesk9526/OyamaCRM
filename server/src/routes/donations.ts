/**
 * Donation management routes for OyamaCRM.
 * Provides paginated listing and CRUD operations for donation records.
 * Supports filtering by constituent, campaign, designation, status, and date range,
 * as well as full-text search across the linked constituent's name and email.
 *
 * Routes:
 *   GET  /api/donations      — paginated list with filters
 *   GET  /api/donations/:id  — single donation with related pledge
 *   POST /api/donations      — record a new donation
 *   PUT  /api/donations/:id  — update a donation
 *
 * @module routes/donations
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

/**
 * Standard relations to include on every donation response.
 * Provides a summary of the linked constituent, campaign, and designation
 * without fetching their full records.
 */
const INCLUDE = {
  constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
  campaign:    { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
};

/** GET /api/donations — Paginated donation list with optional filters for constituent, campaign, date range, and status. */
router.get("/", async (req, res) => {
  const { constituentId, campaignId, designationId, status, from, to, search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: Record<string, unknown> = {
    ...(constituentId && { constituentId }),
    ...(campaignId    && { campaignId }),
    ...(designationId && { designationId }),
    ...(status        && { status }),
    // Build date range filter only when at least one bound is supplied
    ...((from || to)  && {
      date: {
        ...(from && { gte: new Date(from) }),
        ...(to   && { lte: new Date(to) }),
      },
    }),
    // Search is applied as a filter on the related constituent record
    ...(search && {
      constituent: {
        OR: [
          { firstName: { contains: search } },
          { lastName:  { contains: search } },
          { email:     { contains: search } },
        ],
      },
    }),
  };

  // Run the list query and count in parallel to avoid two sequential round-trips
  const [items, total] = await Promise.all([
    prisma.donation.findMany({ where, skip, take: parseInt(limit), orderBy: { date: "desc" }, include: INCLUDE }),
    prisma.donation.count({ where }),
  ]);

  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

/** GET /api/donations/:id — Fetch a single donation including its linked pledge if present. */
router.get("/:id", async (req, res) => {
  const donation = await prisma.donation.findUnique({
    where: { id: req.params.id },
    include: { ...INCLUDE, pledge: true },
  });
  if (!donation) return res.status(404).json({ error: "Donation not found" });
  res.json(donation);
});

/** POST /api/donations — Record a new donation. Defaults: paymentMethod=ONLINE, status=COMPLETED, taxDeductible=true. */
router.post("/", async (req, res) => {
  const {
    constituentId, campaignId, designationId, pledgeId,
    amount, date, paymentMethod, checkNumber, isRecurring,
    frequency, status, taxDeductible, notes,
  } = req.body;

  const donation = await prisma.donation.create({
    data: {
      constituentId,
      campaignId:    campaignId    || undefined,
      designationId: designationId || undefined,
      pledgeId:      pledgeId      || undefined,
      amount,
      date:          date ? new Date(date) : new Date(),
      paymentMethod: paymentMethod || "ONLINE",
      checkNumber:   checkNumber   || undefined,
      isRecurring:   isRecurring   ?? false,
      frequency:     frequency     || undefined,
      status:        status        || "COMPLETED",
      taxDeductible: taxDeductible ?? true,
      notes:         notes         || undefined,
    },
    include: INCLUDE,
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituentId,
      donationId: donation.id,
      type: "DONATION",
      description: `Donation recorded: $${Number(donation.amount).toFixed(2)}`,
      metadata: { source: "api/donations:create" },
    },
  });

  res.status(201).json(donation);
});

/** PUT /api/donations/:id — Update mutable fields on an existing donation (amount, date, status, etc.). */
router.put("/:id", async (req, res) => {
  const {
    campaignId, designationId, amount, date, paymentMethod,
    checkNumber, isRecurring, frequency, status, taxDeductible, notes,
  } = req.body;

  const donation = await prisma.donation.update({
    where: { id: req.params.id },
    data: {
      campaignId:    campaignId    || undefined,
      designationId: designationId || undefined,
      amount:        amount        || undefined,
      date:          date ? new Date(date) : undefined,
      paymentMethod: paymentMethod || undefined,
      checkNumber:   checkNumber   || undefined,
      isRecurring,
      frequency:     frequency     || undefined,
      status:        status        || undefined,
      taxDeductible,
      notes:         notes         || undefined,
    },
  });

  await prisma.activity.create({
    data: {
      constituentId: donation.constituentId,
      donationId: donation.id,
      type: "NOTE",
      description: "Donation record updated",
      metadata: { source: "api/donations:update" },
    },
  });

  res.json(donation);
});

export default router;
