/**
 * Events routes.
 * Provides event listing and management with attendee counts.
 *
 * @module routes/events
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

/** GET /api/events — List all events with attendance counts. */
router.get("/", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json([]);
    return;
  }

  const events = await prisma.event.findMany({
    where: { organizationId },
    include: {
      _count: { select: { attendances: true, volunteerHours: true } },
    },
    orderBy: { startDate: "desc" },
  });
  res.json(events);
});

/** POST /api/events — Create a new event record. */
router.post("/", async (req, res) => {
  const { name, description, type, location, startDate, endDate, registrationGoal, revenueGoal, active } = req.body;
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured for this installation." } });
    return;
  }

  const event = await prisma.event.create({
    data: {
      organizationId,
      name,
      description: description ?? undefined,
      type: type ?? "OTHER",
      location: location ?? undefined,
      startDate: new Date(startDate),
      endDate: endDate ? new Date(endDate) : undefined,
      registrationGoal: registrationGoal ?? undefined,
      revenueGoal: revenueGoal ?? undefined,
      active: active ?? true,
    },
    include: { _count: { select: { attendances: true, volunteerHours: true } } },
  });

  res.status(201).json(event);
});

/** PATCH /api/events/:id — Update event details. */
router.patch("/:id", async (req, res) => {
  const { name, description, type, location, startDate, endDate, registrationGoal, revenueGoal, active } = req.body;

  const event = await prisma.event.update({
    where: { id: req.params.id },
    data: {
      ...(name !== undefined && { name }),
      ...(description !== undefined && { description }),
      ...(type !== undefined && { type }),
      ...(location !== undefined && { location }),
      ...(startDate !== undefined && { startDate: new Date(startDate) }),
      ...(endDate !== undefined && { endDate: endDate ? new Date(endDate) : null }),
      ...(registrationGoal !== undefined && { registrationGoal }),
      ...(revenueGoal !== undefined && { revenueGoal }),
      ...(active !== undefined && { active }),
    },
    include: { _count: { select: { attendances: true, volunteerHours: true } } },
  });

  res.json(event);
});

export default router;
