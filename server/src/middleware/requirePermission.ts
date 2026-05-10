/** Fine-grained permission middleware with explicit override support via UserPermission rows. */
import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { hasDefaultPermission, isPermissionKey, type PermissionKey } from "../lib/permissions.js";

/**
 * Enforces one permission key for the current request user.
 * Explicit UserPermission deny always blocks; explicit grant always allows; missing override falls back to role defaults.
 */
export function requirePermission(permission: PermissionKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.sub;
    const role = req.user?.role;

    if (!userId || !role) {
      res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } });
      return;
    }

    if (!isPermissionKey(permission)) {
      res.status(403).json({
        error: {
          code: "PERMISSION_DENIED",
          message: `Permission denied: ${permission}`,
        },
      });
      return;
    }

    try {
      const override = await prisma.userPermission.findUnique({
        where: {
          userId_permission: {
            userId,
            permission,
          },
        },
        select: { granted: true },
      });

      if (override && !override.granted) {
        res.status(403).json({
          error: {
            code: "PERMISSION_DENIED",
            message: `Permission denied: ${permission}`,
          },
        });
        return;
      }

      if (override && override.granted) {
        next();
        return;
      }

      if (!hasDefaultPermission(role, permission)) {
        res.status(403).json({
          error: {
            code: "PERMISSION_DENIED",
            message: `Permission denied: ${permission}`,
          },
        });
        return;
      }

      next();
    } catch (error) {
      console.error("[authz] permission check failed", error);
      res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Failed to verify permissions" } });
    }
  };
}
