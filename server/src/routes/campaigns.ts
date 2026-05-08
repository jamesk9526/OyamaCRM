/**
 * Fundraising campaign routes for OyamaCRM.
 * Provides campaign listing and management. List responses include a computed
 * `totalRaised` field aggregated from COMPLETED donations for each campaign.
 *
 * Routes:
 *   GET   /api/campaigns      — all campaigns with donation counts and totalRaised
 *   GET   /api/campaigns/:id  — single campaign with recent donations
 *   POST  /api/campaigns      — create a new campaign
 *   PATCH /api/campaigns/:id  — update campaign fields
 *
 * @module routes/campaigns
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

/** GET /api/campaigns — List all campaigns with donation counts and aggregated totalRaised amounts. */
router.get("/", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const campaigns = await prisma.campaign.findMany({
    where: { organizationId },
    orderBy: { startDate: "desc" },
    include: {
      _count: { select: { donations: true } },
    },
  });

  // Aggregate totalRaised per campaign using a groupBy instead of N+1 queries
  const sums = await prisma.donation.groupBy({
    by: ["campaignId"],
    where: {
      status: "COMPLETED",
      campaignId: { not: null },
      campaign: { organizationId },
    },
    _sum: { amount: true },
  });
  // Build a lookup map so each campaign can be decorated in O(1)
  const sumMap = new Map(sums.map((s) => [s.campaignId, Number(s._sum.amount ?? 0)]));

  const result = campaigns.map((c) => ({
    ...c,
    totalRaised: sumMap.get(c.id) ?? 0,
  }));

  res.json(result);
});

/** GET /api/campaigns/:id — Fetch a single campaign with its 20 most recent donations. */
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

/** POST /api/campaigns — Create a new fundraising campaign. */
router.post("/", async (req, res) => {
  const organizationId = await resolveOrganizationId({
    req,
    requestedOrganizationId: req.body?.organizationId,
  });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const campaign = await prisma.campaign.create({
    data: {
      ...req.body,
      organizationId,
    },
  });
  res.status(201).json(campaign);
});

/** PATCH /api/campaigns/:id — Partially update campaign fields (name, goal, active status, dates, etc.). */
router.patch("/:id", async (req, res) => {
  const campaign = await prisma.campaign.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(campaign);
});

export default router;
