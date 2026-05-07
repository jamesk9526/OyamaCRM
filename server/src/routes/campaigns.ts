import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/campaigns
router.get("/", async (_req, res) => {
  const campaigns = await prisma.campaign.findMany({
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { donations: true } },
    },
  });
  res.json(campaigns);
});

// GET /api/campaigns/:id
router.get("/:id", async (req, res) => {
  const campaign = await prisma.campaign.findUnique({
    where: { id: req.params.id },
    include: {
      donations: { orderBy: { date: "desc" }, take: 20 },
      _count: { select: { donations: true } },
    },
  });
  if (!campaign) return res.status(404).json({ error: "Campaign not found" });
  res.json(campaign);
});

// POST /api/campaigns
router.post("/", async (req, res) => {
  const campaign = await prisma.campaign.create({ data: req.body });
  res.status(201).json(campaign);
});

// PATCH /api/campaigns/:id
router.patch("/:id", async (req, res) => {
  const campaign = await prisma.campaign.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(campaign);
});

export default router;
