/**
 * Designation (fund) management routes for OyamaCRM.
 * Designations represent named funds or programs that donations are earmarked for
 * (e.g., General Fund, Building Fund, Scholarship Fund).
 * Currently supports read and create; update/delete can be added as needed.
 *
 * Routes:
 *   GET  /api/designations      — all designations with donation counts
 *   GET  /api/designations/:id  — single designation with recent donations
 *   POST /api/designations      — create a new designation
 *
 * @module routes/designations
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

// All designation routes require authentication.
router.use(requireAuth);

// Designation access follows donation read/write permissions.
router.use((req, res, next) => {
  if (req.method === "GET") {
    return requirePermission("view:donations")(req, res, next);
  }
  if (req.method === "POST" || req.method === "PUT" || req.method === "PATCH" || req.method === "DELETE") {
    return requirePermission("edit:donations")(req, res, next);
  }
  return next();
});

/** GET /api/designations — List all designations sorted by name, including the number of linked donations. */
router.get("/", async (_req, res) => {
  const designations = await prisma.designation.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { donations: true } } },
  });
  res.json(designations);
});

/** GET /api/designations/:id — Fetch a single designation with its 20 most recent donations. */
router.get("/:id", async (req, res) => {
  const designation = await prisma.designation.findUnique({
    where: { id: req.params.id },
    include: { donations: { orderBy: { date: "desc" }, take: 20 } },
  });
  if (!designation) return res.status(404).json({ error: { code: "NOT_FOUND", message: "Designation not found" } });
  res.json(designation);
});

/** POST /api/designations — Create a new designation fund. Defaults `active` to true if not supplied. */
router.post("/", async (req, res) => {
  const { name, description, active } = req.body;
  const designation = await prisma.designation.create({
    data: { name, description, active: active ?? true },
  });
  res.status(201).json(designation);
});

export default router;
