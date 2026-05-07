import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();

// GET /api/tasks
router.get("/", async (req, res) => {
  const { assigneeId, status, constituentId, page = "1", limit = "25" } = req.query as Record<string, string>;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const where = {
    ...(assigneeId && { assigneeId }),
    ...(status && { status: status as never }),
    ...(constituentId && { constituentId }),
  };

  const [items, total] = await Promise.all([
    prisma.task.findMany({
      where,
      skip,
      take: parseInt(limit),
      orderBy: { dueDate: "asc" },
      include: {
        constituent: { select: { id: true, firstName: true, lastName: true } },
        assignee: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    prisma.task.count({ where }),
  ]);

  res.json({ items, total, page: parseInt(page), limit: parseInt(limit) });
});

// POST /api/tasks
router.post("/", async (req, res) => {
  const task = await prisma.task.create({
    data: req.body,
    include: { constituent: true, assignee: true },
  });
  res.status(201).json(task);
});

// PATCH /api/tasks/:id
router.patch("/:id", async (req, res) => {
  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: req.body,
  });
  res.json(task);
});

// DELETE /api/tasks/:id
router.delete("/:id", async (req, res) => {
  await prisma.task.delete({ where: { id: req.params.id } });
  res.status(204).send();
});

export default router;
