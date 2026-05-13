/**
 * User management routes for OyamaCRM.
 * Provides admin-only CRUD operations for managing staff accounts within an organization.
 * All routes require authentication; write operations require the "admin" role.
 *
 * Routes:
 *   GET   /api/users            — list users with optional role/active filters
 *   GET   /api/users/:id        — single user detail
 *   POST  /api/users            — create a new user account
 *   PUT   /api/users/:id        — update user name, role, or active status
 *   PATCH /api/users/:id/password — admin password reset for a user
 *
 * @module routes/users
 */
import { Router, Request, Response, type Router as ExpressRouter } from "express";
import { hashPassword } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";
import { PERMISSION_KEYS, type PermissionKey } from "../lib/permissions.js";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router: ExpressRouter = Router();

/** Returns one policy error for weak passwords, otherwise null. */
function getPasswordPolicyIssue(password: string): string | null {
  if (password.length < 10) return "Password must be at least 10 characters.";
  const hasLower = /[a-z]/.test(password);
  const hasUpper = /[A-Z]/.test(password);
  const hasDigit = /\d/.test(password);
  const hasSymbol = /[^A-Za-z0-9]/.test(password);
  const categoryCount = [hasLower, hasUpper, hasDigit, hasSymbol].filter(Boolean).length;
  if (categoryCount < 3) {
    return "Password must include at least 3 of: lowercase, uppercase, number, symbol.";
  }
  return null;
}

// All user management routes require authentication.
router.use(requireAuth);

/**
 * Safe user fields returned to the UI — omits passwordHash and sensitive internals.
 * Returns enough to populate the user list, role badges, and last-login display.
 */
const USER_SELECT = {
  id: true,
  organizationId: true,
  email: true,
  firstName: true,
  lastName: true,
  role: true,
  avatarUrl: true,
  active: true,
  lastLoginAt: true,
  createdAt: true,
  updatedAt: true,
};

/**
 * GET /api/users — List all users in the authenticated admin's organization.
 * Supports optional filtering by role and active status.
 * Admin-only.
 */
router.get("/", requireRole("admin"), async (req: Request, res: Response) => {
  const { role, active } = req.query as Record<string, string>;

  const where = {
    organizationId: req.user!.orgId,
    ...(role && { role }),
    ...(active !== undefined && { active: active === "true" }),
  };

  const users = await prisma.user.findMany({
    where,
    select: USER_SELECT,
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  res.json({ items: users, total: users.length });
});

/**
 * GET /api/users/:id — Fetch a single user record.
 * Admin-only; scope-checks that the user belongs to the caller's organization.
 */
router.get("/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const user = await prisma.user.findUnique({
    where: { id },
    select: USER_SELECT,
  });

  if (!user || user.organizationId !== req.user!.orgId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    return;
  }

  res.json(user);
});

/**
 * POST /api/users — Create a new staff user within the authenticated admin's organization.
 * Hashes the provided temporary password before storing.
 * Admin-only.
 *
 * Body: { email, firstName, lastName, role, password }
 */
router.post("/", requireRole("admin"), async (req: Request, res: Response) => {
  const { email, firstName, lastName, role = "staff", password } = req.body as {
    email: string;
    firstName: string;
    lastName: string;
    role?: string;
    password: string;
  };

  // Validate required fields
  if (!email || !firstName || !lastName || !password) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "email, firstName, lastName, and password are required" },
    });
    return;
  }

  // Prevent duplicate emails
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: { code: "CONFLICT", message: "A user with that email already exists" } });
    return;
  }

  const passwordIssue = getPasswordPolicyIssue(password);
  if (passwordIssue) {
    res.status(400).json({
      error: { code: "WEAK_PASSWORD", message: passwordIssue },
    });
    return;
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: {
      organizationId: req.user!.orgId,
      email,
      firstName,
      lastName,
      role,
      passwordHash,
    },
    select: USER_SELECT,
  });

  logAudit({
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    userId: req.user!.sub,
    organizationId: req.user!.orgId,
    metadata: { email, role },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.status(201).json(user);
});

/**
 * PUT /api/users/:id — Update a user's name, role, or active status.
 * Prevents admins from deactivating or demoting themselves.
 * Admin-only.
 *
 * Body: { firstName?, lastName?, role?, active? }
 */
router.put("/:id", requireRole("admin"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { firstName, lastName, role, active } = req.body as {
    firstName?: string;
    lastName?: string;
    role?: string;
    active?: boolean;
  };

  // Load and scope-check the target user
  const target = await prisma.user.findUnique({ where: { id }, select: { organizationId: true } });
  if (!target || target.organizationId !== req.user!.orgId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    return;
  }

  // Prevent self-demotion or self-deactivation
  if (id === req.user!.sub) {
    if (active === false) {
      res.status(400).json({ error: { code: "SELF_ACTION", message: "You cannot deactivate your own account" } });
      return;
    }
    if (role && role !== "admin") {
      res.status(400).json({ error: { code: "SELF_ACTION", message: "You cannot demote your own admin role" } });
      return;
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(firstName !== undefined && { firstName }),
      ...(lastName !== undefined && { lastName }),
      ...(role !== undefined && { role }),
      ...(active !== undefined && { active }),
    },
    select: USER_SELECT,
  });

  logAudit({
    action: "USER_UPDATED",
    entity: "User",
    entityId: id,
    userId: req.user!.sub,
    organizationId: req.user!.orgId,
    metadata: { fields: Object.keys(req.body), role: user.role, active: user.active },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json(user);
});

/**
 * PATCH /api/users/:id/password — Admin-initiated password reset for a user.
 * Hashes the new password and clears all existing refresh tokens to force re-login.
 * Admin-only.
 *
 * Body: { password }
 */
router.patch("/:id/password", requireRole("admin"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { password } = req.body as { password: string };

  const passwordIssue = !password ? "Password is required." : getPasswordPolicyIssue(password);
  if (passwordIssue) {
    res.status(400).json({
      error: { code: "WEAK_PASSWORD", message: passwordIssue },
    });
    return;
  }

  // Scope-check the target user
  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, organizationId: true },
  });
  if (!target || target.organizationId !== req.user!.orgId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    return;
  }

  const passwordHash = await hashPassword(password);

  // Update password and revoke all refresh tokens so the user must log in again with the new password
  await prisma.$transaction([
    prisma.user.update({ where: { id }, data: { passwordHash } }),
    prisma.refreshToken.deleteMany({ where: { userId: id } }),
  ]);

  logAudit({
    action: "USER_PASSWORD_RESET",
    entity: "User",
    entityId: id,
    userId: req.user!.sub,
    organizationId: req.user!.orgId,
    metadata: { resetBy: req.user!.sub },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({ success: true });
});

// ─── Fine-grained Permission Overrides ────────────────────────────────────────

/**
 * GET /api/users/:id/permissions
 * Returns all explicit permission overrides for a specific user.
 * Admin-only. Returns { permissions: Array<{ permission, granted }> }
 */
router.get("/:id/permissions", requireRole("admin"), async (req: Request, res: Response) => {
  const id = req.params.id as string;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!target || target.organizationId !== req.user!.orgId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    return;
  }

  const perms = await prisma.userPermission.findMany({
    where: { userId: id },
    select: { permission: true, granted: true, updatedAt: true },
    orderBy: { permission: "asc" },
  });

  res.json({ permissions: perms });
});

/**
 * PUT /api/users/:id/permissions
 * Upserts the full set of fine-grained permission overrides for a user.
 * Send only the permissions you want to explicitly set; omitted permissions revert to role defaults.
 * Admin-only.
 *
 * Body: { permissions: Array<{ permission: string, granted: boolean }> }
 */
router.put("/:id/permissions", requireRole("admin"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const { permissions } = req.body as {
    permissions: Array<{ permission: string; granted: boolean }>;
  };

  if (!Array.isArray(permissions)) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "permissions must be an array" } });
    return;
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!target || target.organizationId !== req.user!.orgId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    return;
  }

  // Validate permission keys
  const validKeys = new Set(PERMISSION_KEYS);
  const invalid = permissions.filter((p) => !validKeys.has(p.permission as PermissionKey));
  if (invalid.length > 0) {
    res.status(400).json({
      error: {
        code: "INVALID_PERMISSION_KEY",
        message: `Invalid permission keys: ${invalid.map((p) => p.permission).join(", ")}`,
      },
    });
    return;
  }

  // Upsert all provided permissions in a transaction
  await prisma.$transaction(
    permissions.map((p) =>
      prisma.userPermission.upsert({
        where: { userId_permission: { userId: id, permission: p.permission } },
        create: { userId: id, permission: p.permission, granted: p.granted },
        update: { granted: p.granted },
      })
    )
  );

  logAudit({
    action: "USER_PERMISSIONS_UPDATED",
    entity: "User",
    entityId: id,
    userId: req.user!.sub,
    organizationId: req.user!.orgId,
    metadata: { permissionCount: permissions.length },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  // Return updated permissions
  const updated = await prisma.userPermission.findMany({
    where: { userId: id },
    select: { permission: true, granted: true, updatedAt: true },
    orderBy: { permission: "asc" },
  });

  res.json({ permissions: updated });
});

/**
 * DELETE /api/users/:id/permissions/:permission
 * Removes an explicit permission override, reverting to role default.
 * Admin-only.
 */
router.delete("/:id/permissions/:permission", requireRole("admin"), async (req: Request, res: Response) => {
  const id = req.params.id as string;
  const perm = req.params.permission as string;

  const target = await prisma.user.findUnique({
    where: { id },
    select: { organizationId: true },
  });

  if (!target || target.organizationId !== req.user!.orgId) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found" } });
    return;
  }

  await prisma.userPermission.deleteMany({
    where: { userId: id, permission: perm },
  });

  res.json({ success: true });
});

export default router;
