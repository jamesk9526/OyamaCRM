/**
 * Audit log routes for OyamaCRM.
 * Exposes a paginated, filterable view of the AuditLog table.
 * Used by the Settings → Audit Logs viewer and compliance exports.
 * All routes are admin-only — audit data contains sensitive user/IP information.
 *
 * Routes:
 *   GET /api/audit-logs — paginated audit log list with optional filters
 *
 * @module routes/audit-logs
 */
import { Router, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";

const router = Router();

// Audit log routes require authentication and explicit audit-log read permission.
router.use(requireAuth, requirePermission("view:audit_logs"));

/**
 * GET /api/audit-logs — Paginated, filtered audit log entries for the authenticated admin's organization.
 *
 * Query params:
 *   page       — page number (default: 1)
 *   limit      — results per page, max 100 (default: 50)
 *   action     — filter by action keyword (partial match, e.g. "LOGIN", "DELETE")
 *   entity     — filter by entity type (e.g. "Constituent", "Donation")
 *   userId     — filter by the acting user's ID
 *   from       — ISO date lower bound for createdAt
 *   to         — ISO date upper bound for createdAt
 *
 * Response: { items, total, page, limit }
 */
router.get("/", async (req: Request, res: Response) => {
  const {
    page = "1",
    limit = "50",
    action,
    entity,
    userId,
    from,
    to,
  } = req.query as Record<string, string>;

  const pageNum = Math.max(1, parseInt(page));
  const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
  const skip = (pageNum - 1) * limitNum;

  const where = {
    // Scope to the calling admin's organization
    organizationId: req.user!.orgId,
    ...(action && { action: { contains: action.toUpperCase() } }),
    ...(entity && { entity }),
    ...(userId && { userId }),
    ...((from || to) && {
      createdAt: {
        ...(from && { gte: new Date(from) }),
        ...(to && { lte: new Date(to) }),
      },
    }),
  };

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
      include: {
        // Include the acting user's name for display
        user: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  res.json({ items, total, page: pageNum, limit: limitNum });
});

export default router;
