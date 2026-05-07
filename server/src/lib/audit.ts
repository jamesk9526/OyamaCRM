/**
 * Audit log writer for OyamaCRM.
 * Provides a fire-and-forget helper that persists structured audit entries
 * (user actions, entity mutations, auth events) to the database.
 * Failures are swallowed so that audit logging never interrupts a request.
 * @module lib/audit
 */
import { prisma } from "../lib/prisma.js";

/**
 * Writes a single audit log entry to the database.
 * All fields except `action` are optional; supply as much context as available.
 * Errors are caught internally and logged to stderr — they will not throw.
 *
 * @param opts.action         - Short uppercase event name, e.g. "LOGIN", "CONSTITUENT_UPDATED"
 * @param opts.entity         - Prisma model name being acted upon, e.g. "User", "Donation"
 * @param opts.entityId       - Primary key of the affected record
 * @param opts.userId         - ID of the authenticated user performing the action
 * @param opts.organizationId - Org scope for multi-tenant filtering
 * @param opts.metadata       - Arbitrary JSON payload (diff, request body snapshot, etc.)
 * @param opts.ipAddress      - Client IP from `req.ip`
 * @param opts.userAgent      - Client User-Agent header value
 * @returns Resolves when the write completes (or silently if it fails)
 */
export async function logAudit(opts: {
  action: string;
  entity?: string;
  entityId?: string;
  userId?: string;
  organizationId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: opts.action,
        entity: opts.entity,
        entityId: opts.entityId,
        userId: opts.userId ?? null,
        organizationId: opts.organizationId ?? null,
        metadata: opts.metadata ? (opts.metadata as import("@prisma/client").Prisma.InputJsonValue) : undefined,
        ipAddress: opts.ipAddress ?? null,
        userAgent: opts.userAgent ?? null,
      },
    });
  } catch {
    // Audit failures must never crash the main request
    console.error("[AuditLog] Failed to write audit entry:", opts.action);
  }
}
