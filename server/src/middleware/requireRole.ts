/**
 * Role-based access control middleware factory for OyamaCRM.
 * Produces Express middleware that restricts a route to users whose role
 * meets or exceeds the minimum required role in the hierarchy.
 * Must be used **after** `requireAuth` so that `req.user` is already populated.
 *
 * Role hierarchy (highest to lowest):
 *   admin          — full system access; user management, org settings, all deletes
 *   manager        — bulk import/export, advanced reports, all create/edit operations
 *   staff          — create and edit individual records, view all data
 *   readonly       — view-only access across the application
 *   report_viewer  — board member access: simplified dashboard + reports only; no data editing
 *
 * A higher role always satisfies a lower-role requirement. For example,
 * requireRole("staff") will pass for admin, manager, and staff users.
 *
 * @module middleware/requireRole
 */
import { Request, Response, NextFunction } from "express";

/**
 * All valid role values in priority order (highest → lowest).
 * Used for hierarchy comparison — index 0 = highest privilege.
 */
export const ROLE_HIERARCHY = ["admin", "manager", "staff", "readonly", "report_viewer"] as const;

/** Union type of all valid role strings. */
export type UserRole = typeof ROLE_HIERARCHY[number];

/**
 * Returns the numeric privilege level of a role string.
 * Lower index = higher privilege. Unknown roles get the lowest privilege (Infinity).
 *
 * @param role - The role string to rank
 * @returns Numeric index in ROLE_HIERARCHY (lower = more privileged)
 */
function roleLevel(role: string): number {
  const idx = ROLE_HIERARCHY.indexOf(role as UserRole);
  return idx === -1 ? Infinity : idx;
}

/**
 * Creates an Express middleware that enforces role-based access control
 * using a role hierarchy. The middleware checks whether `req.user.role`
 * has at least the privilege level of the most-privileged allowed role.
 *
 * Because of the hierarchy, passing `requireRole("staff")` will allow
 * admin, manager, and staff users — but block readonly users.
 *
 * Responds with:
 * - `401 UNAUTHORIZED` — if `req.user` is absent
 * - `403 FORBIDDEN`    — if the user's role is below the required level
 *
 * @param roles - One or more role strings that are permitted.
 *                The most-privileged role in the list sets the minimum bar.
 * @returns Express middleware function
 *
 * @example
 * // Only managers and admins may import bulk records
 * router.post("/import", requireAuth, requireRole("manager"), handler);
 *
 * // Any staff member (or above) may create a constituent
 * router.post("/", requireAuth, requireRole("staff"), handler);
 *
 * // Only admins may delete
 * router.delete("/:id", requireAuth, requireRole("admin"), handler);
 */
export function requireRole(...roles: string[]) {
  // Find the most-privileged (lowest index) role in the allowed list.
  // This becomes the minimum requirement threshold.
  const minLevel = Math.min(...roles.map(roleLevel));

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }

    const userLevel = roleLevel(req.user.role);

    if (userLevel > minLevel) {
      // User's role is less privileged than the minimum required
      const rolesStr = roles.join(" or ");
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: `Requires role: ${rolesStr}. Your role (${req.user.role}) does not have sufficient privileges.`,
        },
      });
      return;
    }

    next();
  };
}
