/**
 * Maintenance mode guard for API routes.
 * Blocks non-admin traffic when System Update Manager enables maintenance mode.
 */
import type { NextFunction, Request, Response } from "express";
import { verifyAccessToken } from "../lib/auth.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { getSystemUpdateStatus } from "../services/system-updates.js";

const BYPASS_PREFIXES = ["/health", "/auth", "/system-updates"];

function shouldBypass(pathname: string): boolean {
  return BYPASS_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  const token = header.slice(7).trim();
  return token || null;
}

function isAdminToken(token: string | null): { isAdmin: boolean; orgId: string | null } {
  if (!token) return { isAdmin: false, orgId: null };

  try {
    const payload = verifyAccessToken(token);
    return {
      isAdmin: payload.role === "admin",
      orgId: payload.orgId ?? null,
    };
  } catch {
    return { isAdmin: false, orgId: null };
  }
}

/** Enforces maintenance mode for all API routes except explicit bypass paths. */
export async function maintenanceModeGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (String(process.env.SYSTEM_UPDATE_MAINTENANCE_GUARD_ENABLED ?? "true").toLowerCase() === "false") {
    next();
    return;
  }

  if (shouldBypass(req.path)) {
    next();
    return;
  }

  const tokenState = isAdminToken(readBearerToken(req));
  if (tokenState.isAdmin) {
    next();
    return;
  }

  const organizationId = await resolveOrganizationId({ requestedOrganizationId: tokenState.orgId });
  if (!organizationId) {
    next();
    return;
  }

  const status = await getSystemUpdateStatus({ organizationId });
  if (!status.maintenanceMode) {
    next();
    return;
  }

  res.status(503).json({
    error: {
      code: "MAINTENANCE_MODE",
      message: "OyamaCRM is temporarily in maintenance mode for a system update.",
    },
  });
}
