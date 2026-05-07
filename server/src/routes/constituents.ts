import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

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

// GET /api/constituents
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

// GET /api/constituents/:id
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
      tags: { include: { tag: { select: { name: true, color: true } } } },
    },
  });

  if (!constituent) {
    res.status(404).json({ error: "Constituent not found" });
    return;
  }
  res.json(constituent);
});

// POST /api/constituents
router.post("/", async (req, res) => {
  // Strip unknown fields, only pick constituent columns
  const {
    firstName, lastName, prefix, email, email2, phone, phone2, mobile,
    addressLine1, addressLine2, city, state, zip, country,
    type, donorStatus, employer, occupation, notes,
    doNotEmail, doNotCall, doNotMail, organizationId,
  } = req.body;

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
      organizationId: organizationId ?? "org_demo",
    },
  });
  res.status(201).json(constituent);
});

// PUT /api/constituents/:id
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
  res.json(constituent);
});

// DELETE /api/constituents/:id
router.delete("/:id", async (req, res) => {
  await prisma.constituent.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
