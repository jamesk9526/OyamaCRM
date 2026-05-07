/**
 * Role-based access control middleware factory for OyamaCRM.
 * Produces Express middleware that restricts a route to users whose role
 * matches one of the provided allowed roles.
 * Must be used **after** `requireAuth` so that `req.user` is already populated.
 * @module middleware/requireRole
 */
import { Request, Response, NextFunction } from "express";

/**
 * Creates an Express middleware that enforces role-based access control.
 * The resulting middleware checks `req.user.role` (set by `requireAuth`) against
 * the supplied list of allowed roles.
 *
 * Responds with:
 * - `401 UNAUTHORIZED` — if `req.user` is absent (should not happen when chained after `requireAuth`)
 * - `403 FORBIDDEN`    — if the user's role is not in the allowed list
 *
 * @param roles - One or more role strings that are permitted (e.g. `"admin"`, `"staff"`)
 * @returns Express middleware function
 *
 * @example
 * // Only admins may access this route
 * router.delete("/:id", requireAuth, requireRole("admin"), handler);
 */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: { code: "FORBIDDEN", message: `Requires role: ${roles.join(" or ")}` } });
      return;
    }
    next();
  };
}
