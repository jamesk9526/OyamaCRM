import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/designations
router.get("/", async (_req, res) => {
  const designations = await prisma.designation.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { donations: true } } },
  });
  res.json(designations);
});

// GET /api/designations/:id
router.get("/:id", async (req, res) => {
  const designation = await prisma.designation.findUnique({
    where: { id: req.params.id },
    include: { donations: { orderBy: { date: "desc" }, take: 20 } },
  });
  if (!designation) return res.status(404).json({ error: "Designation not found" });
  res.json(designation);
});

// POST /api/designations
router.post("/", async (req, res) => {
  const { name, description, active } = req.body;
  const designation = await prisma.designation.create({
    data: { name, description, active: active ?? true },
  });
  res.status(201).json(designation);
});

export default router;
