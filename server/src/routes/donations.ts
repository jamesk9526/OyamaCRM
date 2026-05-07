import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

const INCLUDE = {
  constituent: { select: { id: true, firstName: true, lastName: true, email: true } },
  campaign:    { select: { id: true, name: true } },
  designation: { select: { id: true, name: true } },
};

// GET /api/donations
router.get("/", async (req, res) => {
  const { constituentId, campaignId, designationId, status, from, to, search, page = "1", limit = "50" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where: Record<string, unknown> = {
    ...(constituentId && { constituentId }),
    ...(campaignId    && { campaignId }),
    ...(designationId && { designationId }),
    ...(status        && { status }),
    ...((from || to)  && {
      date: {
        ...(from && { gte: new Date(from) }),
        ...(to   && { lte: new Date(to) }),
      },
    }),
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

  const [items, total] = await Promise.all([
    prisma.donation.findMany({ where, skip, take: parseInt(limit), orderBy: { date: "desc" }, include: INCLUDE }),
    prisma.donation.count({ where }),
  ]);

  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

// GET /api/donations/:id
router.get("/:id", async (req, res) => {
  const donation = await prisma.donation.findUnique({
    where: { id: req.params.id },
    include: { ...INCLUDE, pledge: true },
  });
  if (!donation) return res.status(404).json({ error: "Donation not found" });
  res.json(donation);
});

// POST /api/donations
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
  res.status(201).json(donation);
});

// PUT /api/donations/:id
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
  res.json(donation);
});

export default router;
