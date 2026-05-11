/**
 * Grant Management routes for OyamaCRM.
 * Covers the full lifecycle: funder tracking, pipeline status, grant writing sections,
 * and activity timeline.
 *
 * Routes:
 *   -- Grant Funders --
 *   GET   /api/grants/funders            — list all funders for the org
 *   POST  /api/grants/funders            — create a new funder (manager+)
 *   PATCH /api/grants/funders/:id        — update funder details (manager+)
 *   DELETE /api/grants/funders/:id       — delete a funder (admin only)
 *
 *   -- Grants --
 *   GET   /api/grants                    — list all grants with funder + assignee
 *   GET   /api/grants/stats              — summary counts and amounts by status
 *   POST  /api/grants                    — create a new grant (manager+)
 *   GET   /api/grants/:id                — single grant with sections + recent activity
 *   PATCH /api/grants/:id                — update grant fields (staff+)
 *   DELETE /api/grants/:id               — delete grant (manager+)
 *
 *   -- Writing Sections --
 *   GET   /api/grants/:id/sections       — list all writing sections for a grant
 *   PATCH /api/grants/:id/sections/:key  — update a single section's content / completion
 *
 *   -- Activity / Notes --
 *   GET   /api/grants/:id/activity       — list activity timeline for a grant
 *   POST  /api/grants/:id/activity       — add a note or activity entry
 *
 * @module routes/grants
 */
import { Router } from "express";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import type { GrantStatus } from "@prisma/client";

const router = Router();

// All grant routes require authentication.
router.use(requireAuth);

// ─── Default writing sections seeded on every new grant ──────────────────────

/** Standard grant proposal sections auto-created with every new grant. */
const DEFAULT_SECTIONS = [
  { key: "executive_summary",  title: "Executive Summary",  wordLimit: 500,  sortOrder: 0 },
  { key: "need_statement",     title: "Need Statement",     wordLimit: 750,  sortOrder: 1 },
  { key: "program_description",title: "Program Description",wordLimit: 1500, sortOrder: 2 },
  { key: "goals_objectives",   title: "Goals & Objectives", wordLimit: 500,  sortOrder: 3 },
  { key: "evaluation_plan",    title: "Evaluation Plan",    wordLimit: 750,  sortOrder: 4 },
  { key: "budget_narrative",   title: "Budget Narrative",   wordLimit: 1000, sortOrder: 5 },
  { key: "org_background",     title: "Organization Background", wordLimit: 500, sortOrder: 6 },
  { key: "sustainability_plan",title: "Sustainability Plan",wordLimit: 500,  sortOrder: 7 },
  { key: "loi_narrative",      title: "Letter of Intent (LOI)", wordLimit: 1000, sortOrder: 8 },
];

/**
 * Legacy + canonical status aliases normalized into current GrantStatus enum values.
 * This prevents runtime Prisma validation errors from older clients while keeping DB values canonical.
 */
const GRANT_STATUS_ALIASES: Record<string, GrantStatus> = {
  IDEA: "IDEA",
  PROSPECTING: "RESEARCH",
  RESEARCH: "RESEARCH",
  LOI_DRAFT: "LOI_DRAFT",
  LOI_SUBMITTED: "LOI_SUBMITTED",
  PROPOSAL_DRAFT: "PROPOSAL_DRAFT",
  SUBMITTED: "PROPOSAL_SUBMITTED",
  PROPOSAL_SUBMITTED: "PROPOSAL_SUBMITTED",
  UNDER_REVIEW: "UNDER_REVIEW",
  IN_REVIEW: "UNDER_REVIEW",
  AWARDED: "AWARDED",
  REJECTED: "REJECTED",
  DECLINED: "REJECTED",
  WITHDRAWN: "WITHDRAWN",
  CLOSED: "CLOSED",
};

/** Normalizes inbound status values to supported GrantStatus values. */
function parseGrantStatus(value: unknown): GrantStatus | null {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (!normalized) return null;
  return GRANT_STATUS_ALIASES[normalized] ?? null;
}

// ─── Funder routes ────────────────────────────────────────────────────────────

/** GET /api/grants/funders — List all funders for the org, sorted by name. */
router.get("/funders", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.json([]); return; }

  const funders = await prisma.grantFunder.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { grants: true } } },
  });

  res.json(funders);
});

/** POST /api/grants/funders — Create a new grant funder. Requires manager+ role. */
router.post("/funders", requireRole("manager"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.status(400).json({ error: { message: "No organization found" } }); return; }

  const { name, type, website, contactName, contactEmail, contactPhone, address, notes } = req.body;
  if (!name) { res.status(400).json({ error: { message: "name is required" } }); return; }

  const funder = await prisma.grantFunder.create({
    data: { organizationId, name, type, website, contactName, contactEmail, contactPhone, address, notes },
  });

  await logAudit({ action: "CREATE", entity: "GrantFunder", entityId: funder.id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.status(201).json(funder);
});

/** PATCH /api/grants/funders/:id — Update funder fields. Requires manager+ role. */
router.patch("/funders/:id", requireRole("manager"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const allowed = ["name","type","website","contactName","contactEmail","contactPhone","address","notes","active"];
  const data: Record<string, unknown> = {};
  for (const k of allowed) if (k in req.body) data[k] = req.body[k];

  const funder = await prisma.grantFunder.updateMany({
    where: { id, organizationId: organizationId ?? "" },
    data,
  });
  if (!funder.count) { res.status(404).json({ error: { message: "Funder not found" } }); return; }

  await logAudit({ action: "UPDATE", entity: "GrantFunder", entityId: id, userId: (req as { user?: { sub?: string } }).user?.sub });
  const updated = await prisma.grantFunder.findUnique({ where: { id } });
  res.json({ ...(updated ?? {}), updated: funder.count });
});

/** DELETE /api/grants/funders/:id — Remove a funder (admin only). */
router.delete("/funders/:id", requireRole("admin"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const result = await prisma.grantFunder.deleteMany({
    where: { id, organizationId: organizationId ?? "" },
  });
  if (!result.count) { res.status(404).json({ error: { message: "Funder not found" } }); return; }
  await logAudit({ action: "DELETE", entity: "GrantFunder", entityId: id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.json({ success: true });
});

// ─── Grant stats ──────────────────────────────────────────────────────────────

/**
 * GET /api/grants/stats — Aggregated pipeline stats: count/amount by status,
 * total requested, total awarded, and upcoming deadline count.
 */
router.get("/stats", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.json({ byStatus: {}, totalRequested: 0, totalAwarded: 0, upcomingDeadlines: 0 });
    return;
  }

  const grants = await prisma.grant.findMany({
    where: { organizationId },
    select: { status: true, amountRequested: true, amountAwarded: true, applicationDeadline: true },
  });

  const byStatus: Record<string, { count: number; totalRequested: number }> = {};
  let totalRequested = 0;
  let totalAwarded = 0;
  const in30days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  let upcomingDeadlines = 0;

  for (const g of grants) {
    const s = g.status;
    if (!byStatus[s]) byStatus[s] = { count: 0, totalRequested: 0 };
    byStatus[s].count++;
    const amt = Number(g.amountRequested ?? 0);
    byStatus[s].totalRequested += amt;
    totalRequested += amt;
    totalAwarded += Number(g.amountAwarded ?? 0);
    if (g.applicationDeadline && g.applicationDeadline <= in30days && g.applicationDeadline >= new Date()) {
      upcomingDeadlines++;
    }
  }

  res.json({ byStatus, totalRequested, totalAwarded, total: grants.length, upcomingDeadlines });
});

// ─── Grant list ───────────────────────────────────────────────────────────────

/**
 * GET /api/grants — List all grants for the org.
 * Supports ?status=IDEA&assigneeId=xxx filters.
 */
router.get("/", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.json([]); return; }

  const where: Record<string, unknown> = { organizationId };
  if (req.query.status) {
    const parsedStatus = parseGrantStatus(String(req.query.status));
    if (!parsedStatus) {
      res.status(400).json({ error: { message: "Invalid grant status filter" } });
      return;
    }
    where.status = parsedStatus;
  }
  if (req.query.assigneeId) where.assigneeId = String(req.query.assigneeId);

  const grants = await prisma.grant.findMany({
    where,
    orderBy: [{ applicationDeadline: "asc" }, { createdAt: "desc" }],
    include: {
      funder: { select: { id: true, name: true, type: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
      _count: { select: { sections: true, activities: true } },
    },
  });

  res.json(grants);
});

/** POST /api/grants — Create a new grant and seed default writing sections. Requires manager+. */
router.post("/", requireRole("manager"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) { res.status(400).json({ error: { message: "No organization found" } }); return; }

  const { funderId, title, programArea, status, amountRequested, requiresLOI,
          loiDeadline, applicationDeadline, assigneeId, notes, internalNotes } = req.body;

  if (!funderId || !title) {
    res.status(400).json({ error: { message: "funderId and title are required" } });
    return;
  }

  const funder = await prisma.grantFunder.findFirst({
    where: { id: String(funderId), organizationId },
    select: { id: true },
  });
  if (!funder) {
    res.status(404).json({ error: { message: "Funder not found" } });
    return;
  }

  const parsedStatus = parseGrantStatus(status);
  if (status !== undefined && parsedStatus === null) {
    res.status(400).json({ error: { message: "Invalid grant status" } });
    return;
  }

  const grant = await prisma.grant.create({
    data: {
      organizationId,
      funderId,
      title,
      programArea,
      status: parsedStatus ?? "IDEA",
      amountRequested: amountRequested ? Number(amountRequested) : undefined,
      requiresLOI: requiresLOI ?? false,
      loiDeadline: loiDeadline ? new Date(loiDeadline) : undefined,
      applicationDeadline: applicationDeadline ? new Date(applicationDeadline) : undefined,
      assigneeId: assigneeId ?? null,
      notes,
      internalNotes,
      // Seed all default writing sections
      sections: {
        create: DEFAULT_SECTIONS,
      },
    },
    include: {
      funder: { select: { id: true, name: true, type: true } },
      sections: true,
    },
  });

  // Record creation as the first activity
  await prisma.grantActivity.create({
    data: {
      grantId: grant.id,
      userId: (req as { user?: { sub?: string } }).user?.sub ?? null,
      type: "STATUS_CHANGE",
      description: `Grant created with status: ${grant.status}`,
    },
  });

  await logAudit({ action: "CREATE", entity: "Grant", entityId: grant.id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.status(201).json(grant);
});

/** GET /api/grants/:id — Full grant detail with sections and recent activity. */
router.get("/:id", async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });

  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    include: {
      funder: true,
      assignee: { select: { id: true, firstName: true, lastName: true, email: true } },
      sections: { orderBy: { sortOrder: "asc" } },
      activities: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
  });

  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }
  res.json(grant);
});

/** PATCH /api/grants/:id — Update grant fields. Status changes are logged as activities. */
router.patch("/:id", async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const existing = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { status: true },
  });
  if (!existing) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const allowed = [
    "title","funderId","programArea","status","amountRequested","amountAwarded",
    "requiresLOI","loiDeadline","loiSubmittedAt","applicationDeadline","submittedAt",
    "awardedAt","rejectedAt","grantPeriodStart","grantPeriodEnd",
    "reportingDeadline","reportingSubmittedAt","assigneeId","notes","internalNotes",
  ];
  const data: Record<string, unknown> = {};

  if ("funderId" in req.body) {
    const nextFunderId = String(req.body.funderId ?? "").trim();
    if (nextFunderId) {
      const funder = await prisma.grantFunder.findFirst({
        where: { id: nextFunderId, organizationId: organizationId ?? "" },
        select: { id: true },
      });
      if (!funder) {
        res.status(404).json({ error: { message: "Funder not found" } });
        return;
      }
      data.funderId = nextFunderId;
    } else {
      res.status(400).json({ error: { message: "funderId cannot be empty" } });
      return;
    }
  }

  if ("status" in req.body) {
    const parsedStatus = parseGrantStatus(req.body.status);
    if (String(req.body.status ?? "").trim() && !parsedStatus) {
      res.status(400).json({ error: { message: "Invalid grant status" } });
      return;
    }
    if (parsedStatus) {
      data.status = parsedStatus;
    }
  }

  for (const k of allowed) {
    if (k === "status" || k === "funderId") continue;
    if (k in req.body) {
      if (["loiDeadline","loiSubmittedAt","applicationDeadline","submittedAt",
           "awardedAt","rejectedAt","grantPeriodStart","grantPeriodEnd",
           "reportingDeadline","reportingSubmittedAt"].includes(k)) {
        data[k] = req.body[k] ? new Date(req.body[k]) : null;
      } else {
        data[k] = req.body[k];
      }
    }
  }

  const updated = await prisma.grant.update({
    where: { id },
    data,
    include: {
      funder: { select: { id: true, name: true, type: true } },
      assignee: { select: { id: true, firstName: true, lastName: true } },
    },
  });

  // Log status change as a timeline activity
  if (req.body.status && req.body.status !== existing.status) {
    const nextStatus = (data.status as GrantStatus | undefined) ?? existing.status;
    await prisma.grantActivity.create({
      data: {
        grantId: id,
        userId: (req as { user?: { sub?: string } }).user?.sub ?? null,
        type: "STATUS_CHANGE",
        description: `Status changed from ${existing.status} to ${nextStatus}`,
        metadata: { from: existing.status, to: nextStatus },
      },
    });
  }

  await logAudit({ action: "UPDATE", entity: "Grant", entityId: id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.json(updated);
});

/** DELETE /api/grants/:id — Remove a grant (manager+). Cascade deletes sections & activities. */
router.delete("/:id", requireRole("manager"), async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const result = await prisma.grant.deleteMany({
    where: { id, organizationId: organizationId ?? "" },
  });
  if (!result.count) { res.status(404).json({ error: { message: "Grant not found" } }); return; }
  await logAudit({ action: "DELETE", entity: "Grant", entityId: id, userId: (req as { user?: { sub?: string } }).user?.sub });
  res.json({ success: true });
});

// ─── Writing sections ─────────────────────────────────────────────────────────

/** GET /api/grants/:id/sections — List all writing sections for a grant, ordered. */
router.get("/:id/sections", async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { id: true },
  });
  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const sections = await prisma.grantSection.findMany({
    where: { grantId: id },
    orderBy: { sortOrder: "asc" },
  });
  res.json(sections);
});

/**
 * PATCH /api/grants/:id/sections/:key — Update a section's content and/or completion.
 * Creates the section if it doesn't exist (for custom sections).
 */
router.patch("/:id/sections/:key", async (req, res) => {
  const id = String(req.params.id);
  const key = String(req.params.key);
  const organizationId = await resolveOrganizationId({ req });
  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { id: true },
  });
  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const { content, completed, title, wordLimit } = req.body;
  const section = await prisma.grantSection.upsert({
    where: { grantId_key: { grantId: id, key } },
    update: {
      ...(content !== undefined && { content }),
      ...(completed !== undefined && { completed }),
      ...(title !== undefined && { title }),
      ...(wordLimit !== undefined && { wordLimit }),
    },
    create: {
      grantId: id,
      key,
      title: title ?? key.replace(/_/g, " "),
      content,
      completed: completed ?? false,
      wordLimit: wordLimit ?? null,
    },
  });
  res.json(section);
});

// ─── Activity / Notes ─────────────────────────────────────────────────────────

/** GET /api/grants/:id/activity — Fetch the activity timeline for a grant. */
router.get("/:id/activity", async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { id: true },
  });
  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const activities = await prisma.grantActivity.findMany({
    where: { grantId: id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.json(activities);
});

/** POST /api/grants/:id/activity — Add a note or activity to the grant timeline. */
router.post("/:id/activity", async (req, res) => {
  const id = String(req.params.id);
  const organizationId = await resolveOrganizationId({ req });
  const grant = await prisma.grant.findFirst({
    where: { id, organizationId: organizationId ?? "" },
    select: { id: true },
  });
  if (!grant) { res.status(404).json({ error: { message: "Grant not found" } }); return; }

  const { type } = req.body;
  const description = String(req.body.description ?? req.body.note ?? "").trim();
  if (!description) { res.status(400).json({ error: { message: "description is required" } }); return; }

  const activity = await prisma.grantActivity.create({
    data: {
      grantId: id,
      userId: (req as { user?: { sub?: string } }).user?.sub ?? null,
      type: type ?? "NOTE",
      description,
    },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
  res.status(201).json(activity);
});

export default router;
