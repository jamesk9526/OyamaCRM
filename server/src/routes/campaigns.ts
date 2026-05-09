/**
 * Campaign management routes for OyamaCRM.
 * Campaigns represent fundraising initiatives with goals and timelines.
 *
 * Routes:
 *   GET    /api/campaigns      — paginated list with optional status/category filters
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
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

// All campaign routes require authentication.
router.use(requireAuth);

/** GET /api/campaigns — List campaigns with optional filters and pagination. */
router.get("/", async (req, res) => {
	const {
		page = "1",
		limit = "25",
		active,
		category,
		q,
	} = req.query as Record<string, string>;

	const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

	const where = {
		...(active !== undefined ? { active: active === "true" } : {}),
		...(category ? { category: category as CampaignCategory } : {}),
		...(q
			? {
					OR: [
						{ name: { contains: q } },
						{ description: { contains: q } },
					],
				}
			: {}),
	};

	const [items, total] = await Promise.all([
		prisma.campaign.findMany({
			where,
			skip,
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
		}),
		prisma.campaign.count({ where }),
	]);

	res.json({ items, total, page: parseInt(page, 10), limit: parseInt(limit, 10) });
});

/** GET /api/campaigns/:id — Fetch one campaign and include recent donations and pledges. */
router.get("/:id", async (req, res) => {
	const campaign = await prisma.campaign.findUnique({
		where: { id: req.params.id },
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

	return res.json(campaign);
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

	const created = await prisma.campaign.create({
		data: {
			name,
			description,
			category,
			goal: goal !== undefined && goal !== null && goal !== "" ? Number(goal) : undefined,
			startDate: new Date(startDate),
			endDate: endDate ? new Date(endDate) : null,
			active: active ?? true,
			// Keep backward compatibility for existing clients that still send organizationId.
			// TODO: replace with resolved organization from auth context in all callers.
			organizationId: organizationId ?? req.user?.organizationId ?? "",
		},
	});

	return res.status(201).json(created);
});

/** PATCH /api/campaigns/:id — Update mutable campaign fields. */
router.patch("/:id", async (req, res) => {
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
		where: { id: req.params.id },
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
	await prisma.campaign.delete({ where: { id: req.params.id } });
	res.status(204).send();
});

export default router;
