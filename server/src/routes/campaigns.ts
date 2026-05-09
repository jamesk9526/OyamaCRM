/**
 * Campaign management routes for OyamaCRM.
 * Campaigns represent fundraising initiatives with goals and timelines.
 *
 * Routes:
 *   GET    /api/campaigns      — list campaigns with optional filters
 *   GET    /api/campaigns/:id  — fetch a single campaign with donation/pledge counts
 *   POST   /api/campaigns      — create a campaign
 *   PATCH  /api/campaigns/:id  — update campaign fields
 *   DELETE /api/campaigns/:id  — delete campaign (admin only)
 *
 * @module routes/campaigns
 */
import { Router } from "express";
import type { CampaignCategory } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// All campaign routes require authentication.
router.use(requireAuth);

/** GET /api/campaigns — List campaigns with optional filters and include computed totalRaised. */
router.get("/", async (req, res) => {
  const { limit = "100", active, category, q, search } = req.query as Record<string, string>;

  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const searchText = (search ?? q ?? "").trim();

  const where = {
    organizationId,
    ...(active !== undefined ? { active: active === "true" } : {}),
    ...(category ? { category: category as CampaignCategory } : {}),
    ...(searchText
      ? {
          OR: [
            { name: { contains: searchText } },
            { description: { contains: searchText } },
          ],
        }
      : {}),
  };

  const items = await prisma.campaign.findMany({
    where,
    take: parseInt(limit, 10),
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          donations: true,
          pledges: true,
        },
      },
    },
  });

  const donationSums = await prisma.donation.groupBy({
    by: ["campaignId"],
    where: {
      campaignId: { not: null },
      status: "COMPLETED",
      campaign: { organizationId },
    },
    _sum: { amount: true },
  });

  const sumMap = new Map(donationSums.map((row) => [row.campaignId, Number(row._sum.amount ?? 0)]));

  const campaigns = items.map((item) => ({
    ...item,
    totalRaised: sumMap.get(item.id) ?? 0,
  }));

  res.json(campaigns);
});

/** GET /api/campaigns/:id — Fetch one campaign and include recent donations and pledges. */
router.get("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    return res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
  }

  const campaign = await prisma.campaign.findFirst({
    where: { id: req.params.id as string, organizationId },
    include: {
      donations: { orderBy: { date: "desc" }, take: 20 },
      pledges: { orderBy: { createdAt: "desc" }, take: 20 },
      _count: {
        select: {
          donations: true,
          pledges: true,
        },
      },
    },
  });

  if (!campaign) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
  }

  const aggregate = await prisma.donation.aggregate({
    where: { campaignId: campaign.id, status: "COMPLETED", campaign: { organizationId } },
    _sum: { amount: true },
  });

  return res.json({
    ...campaign,
    totalRaised: Number(aggregate._sum.amount ?? 0),
  });
});

/** POST /api/campaigns — Create a campaign for the authenticated user's organization. */
router.post("/", async (req, res) => {
  const {
    name,
    description,
    category,
    goal,
    startDate,
    endDate,
    active,
    organizationId,
  } = req.body as {
    name?: string;
    description?: string;
    category?: CampaignCategory;
    goal?: number | string;
    startDate?: string;
    endDate?: string | null;
    active?: boolean;
    organizationId?: string;
  };

  if (!name || !startDate) {
    return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "name and startDate are required" } });
  }

  const resolvedOrganizationId = await resolveOrganizationId({ req, requestedOrganizationId: organizationId });
  if (!resolvedOrganizationId) {
    return res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
  }

  const created = await prisma.campaign.create({
    data: {
      name,
      description,
      category,
      goal: goal !== undefined && goal !== null && goal !== "" ? Number(goal) : undefined,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : null,
      active: active ?? true,
      organizationId: resolvedOrganizationId,
    },
  });

  return res.status(201).json(created);
});

/** PATCH /api/campaigns/:id — Update mutable campaign fields. */
router.patch("/:id", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    return res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
  }

  const existing = await prisma.campaign.findFirst({
    where: { id: req.params.id as string, organizationId },
    select: { id: true },
  });
  if (!existing) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
  }

  const {
    name,
    description,
    category,
    goal,
    startDate,
    endDate,
    active,
  } = req.body as {
    name?: string;
    description?: string | null;
    category?: CampaignCategory;
    goal?: number | string | null;
    startDate?: string;
    endDate?: string | null;
    active?: boolean;
  };

  const updated = await prisma.campaign.update({
    where: { id: req.params.id as string },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(goal !== undefined ? { goal: goal === null || goal === "" ? null : Number(goal) } : {}),
      ...(startDate !== undefined ? { startDate: new Date(startDate) } : {}),
      ...(endDate !== undefined ? { endDate: endDate ? new Date(endDate) : null } : {}),
      ...(active !== undefined ? { active } : {}),
    },
  });

  return res.json(updated);
});

/** DELETE /api/campaigns/:id — Permanently delete a campaign. Admin-only. */
router.delete("/:id", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    return res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
  }

  const id = req.params.id as string;
  const deleted = await prisma.campaign.deleteMany({ where: { id, organizationId } });
  if (deleted.count === 0) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Campaign not found" } });
  }

  res.status(204).send();
});

export default router;
