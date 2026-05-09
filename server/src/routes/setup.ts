/**
 * Setup routes for first-run onboarding and bootstrap.
 * Exposes status + completion endpoints that prepare organization, settings, and first admin user.
 *
 * @module routes/setup
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";

const router = Router();

interface SetupCompletePayload {
  organization: {
    name: string;
    organizationType?: string;
    primaryContactEmail?: string;
    timezone?: string;
  };
  adminUser: {
    firstName: string;
    lastName: string;
    email: string;
    password: string;
  };
  branding?: {
    primaryColor?: string;
    accentColor?: string;
  };
  workspaces?: {
    oyamacrm?: boolean;
    oyamacrmCompassion?: boolean;
  };
}

const ADMIN_ROLE = "admin";
const DEFAULT_TIMEZONE = "America/Chicago";
const BCRYPT_ROUNDS = Number.parseInt(process.env.BCRYPT_ROUNDS ?? "12", 10) || 12;

/**
 * Evaluates whether bootstrap setup should be treated as complete.
 * Setup is complete when at least one organization and one user exist.
 */
async function getSetupState() {
  const [organizationCount, userCount] = await Promise.all([
    prisma.organization.count(),
    prisma.user.count(),
  ]);

  const setupCompleted = organizationCount > 0 && userCount > 0;
  return { setupCompleted, organizationCount, userCount };
}

/**
 * GET /api/setup/status
 * Description: Returns first-run setup state for UI redirect logic.
 * Request: none
 * Response: { success, data: { setupCompleted, setupCompletedAt }, meta }
 */
router.get("/status", async (_req: Request, res: Response) => {
  try {
    const state = await getSetupState();
    const setupAudit = state.setupCompleted
      ? await prisma.auditLog.findFirst({
          where: { action: "SETUP_COMPLETED" },
          orderBy: { createdAt: "desc" },
          select: { createdAt: true },
        })
      : null;

    return res.json({
      success: true,
      data: {
        setupCompleted: state.setupCompleted,
        setupCompletedAt: setupAudit?.createdAt?.toISOString() ?? null,
      },
      meta: {
        organizations: state.organizationCount,
        users: state.userCount,
      },
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: {
        code: "SETUP_STATUS_FAILED",
        message: "Failed to determine setup status.",
      },
    });
  }
});

/**
 * POST /api/setup/complete
 * Description: Completes initial setup by creating the first organization, org settings, and admin user.
 * Request: { organization, adminUser }
 * Response: { success, data: { setupCompleted, organizationId, adminUserId }, meta }
 */
router.post("/complete", async (req: Request, res: Response) => {
  try {
    const state = await getSetupState();
    if (state.setupCompleted) {
      return res.status(409).json({
        success: false,
        error: {
          code: "SETUP_ALREADY_COMPLETED",
          message: "Setup has already been completed for this installation.",
        },
      });
    }

    const body = req.body as SetupCompletePayload;
    const orgName = body?.organization?.name?.trim();
    const timezone = body?.organization?.timezone?.trim() || DEFAULT_TIMEZONE;
    const adminFirstName = body?.adminUser?.firstName?.trim();
    const adminLastName = body?.adminUser?.lastName?.trim();
    const adminEmail = body?.adminUser?.email?.trim().toLowerCase();
    const adminPassword = body?.adminUser?.password ?? "";

    if (!orgName || !adminFirstName || !adminLastName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "organization.name, adminUser fields, and adminUser.password are required.",
        },
      });
    }

    if (!Intl.supportedValuesOf("timeZone").includes(timezone)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_TIMEZONE",
          message: "Timezone must be a valid IANA timezone string.",
        },
      });
    }

    if (!body?.workspaces?.oyamacrm && !body?.workspaces?.oyamacrmCompassion) {
      return res.status(400).json({
        success: false,
        error: {
          code: "WORKSPACE_REQUIRED",
          message: "At least one workspace must be enabled.",
        },
      });
    }

    if (adminPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: {
          code: "WEAK_PASSWORD",
          message: "Admin password must be at least 8 characters.",
        },
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        error: {
          code: "EMAIL_ALREADY_EXISTS",
          message: "A user with that email already exists.",
        },
      });
    }

    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: orgName },
      });

      await tx.organizationSettings.create({
        data: {
          organizationId: organization.id,
          timezone,
          currency: "USD",
          fiscalYearStart: 1,
          smtpSecure: false,
          smtpPort: 587,
          smtpFromName: orgName,
          smtpFromEmail: body?.organization?.primaryContactEmail?.trim() || "",
        },
      });

      const adminUser = await tx.user.create({
        data: {
          organizationId: organization.id,
          firstName: adminFirstName,
          lastName: adminLastName,
          email: adminEmail,
          role: ADMIN_ROLE,
          active: true,
          passwordHash,
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          userId: adminUser.id,
          action: "SETUP_COMPLETED",
          entity: "Organization",
          entityId: organization.id,
          metadata: {
            organizationType: body?.organization?.organizationType ?? null,
            timezone,
            branding: body?.branding ?? null,
            workspaces: body?.workspaces ?? null,
          },
        },
      });

      return { organization, adminUser };
    });

    return res.status(201).json({
      success: true,
      data: {
        setupCompleted: true,
        organizationId: result.organization.id,
        adminUserId: result.adminUser.id,
      },
      meta: {},
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: {
        code: "SETUP_COMPLETE_FAILED",
        message: "Failed to complete setup.",
      },
    });
  }
});

// ─── Recovery Snapshots ───────────────────────────────────────────────────────

/**
 * Serializes the current organization state into a SetupSnapshot for recovery.
 * Captures: organization, settings, all active users (excluding password hashes).
 * Returns the created snapshot record.
 */
async function createSnapshot(label: string): Promise<{ id: string; label: string; createdAt: Date }> {
  const [organization, settings, users] = await Promise.all([
    prisma.organization.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.organizationSettings.findFirst(),
    prisma.user.findMany({
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, active: true, lastLoginAt: true, createdAt: true,
      },
    }),
  ]);

  const snapshotData = JSON.stringify({ organization, settings, users, capturedAt: new Date().toISOString() });

  return prisma.setupSnapshot.create({
    data: { label, snapshotData },
    select: { id: true, label: true, createdAt: true },
  });
}

/**
 * POST /api/setup/snapshot
 * Description: Creates a manual recovery snapshot of the current organization state.
 * Requires: authenticated admin user.
 * Request: { label? } — optional description for the snapshot
 * Response: { success, data: { snapshot } }
 */
router.post("/snapshot", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const label = (req.body?.label as string | undefined)?.trim() || `Manual snapshot — ${new Date().toLocaleString()}`;
    const snapshot = await createSnapshot(label);

    return res.status(201).json({
      success: true,
      data: { snapshot },
    });
  } catch (err) {
    console.error("[setup/snapshot] Failed:", err);
    return res.status(500).json({
      success: false,
      error: { code: "SNAPSHOT_FAILED", message: "Failed to create recovery snapshot." },
    });
  }
});

/**
 * GET /api/setup/snapshots
 * Description: Lists all available recovery snapshots, newest first.
 * Requires: authenticated admin user.
 * Response: { success, data: { snapshots } }
 */
router.get("/snapshots", requireAuth, requireRole("admin"), async (_req: Request, res: Response) => {
  try {
    const snapshots = await prisma.setupSnapshot.findMany({
      select: { id: true, label: true, createdAt: true, restoredAt: true },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    return res.json({ success: true, data: { snapshots } });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: "SNAPSHOTS_FETCH_FAILED", message: "Failed to fetch recovery snapshots." },
    });
  }
});

/**
 * POST /api/setup/restore/:id
 * Description: Restores the CRM state from a saved snapshot.
 * Recreates the organization, settings, and users from the snapshot data.
 * Requires: authenticated admin user. The current org must already be reset/empty.
 * Response: { success, data: { restoredAt } }
 */
router.post("/restore/:id", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const snapshotId = req.params.id as string;
    const snapshot = await prisma.setupSnapshot.findUnique({ where: { id: snapshotId } });

    if (!snapshot) {
      return res.status(404).json({
        success: false,
        error: { code: "SNAPSHOT_NOT_FOUND", message: "Recovery snapshot not found." },
      });
    }

    const data = JSON.parse(snapshot.snapshotData) as {
      organization: { name: string; createdAt: string } | null;
      settings: Record<string, unknown> | null;
      users: Array<{ email: string; firstName: string; lastName: string; role: string; active: boolean }>;
    };

    if (!data.organization) {
      return res.status(400).json({
        success: false,
        error: { code: "EMPTY_SNAPSHOT", message: "Snapshot contains no organization data." },
      });
    }

    // Only allow restore when DB has no organization (post-reset state)
    const existingOrgCount = await prisma.organization.count();
    if (existingOrgCount > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: "RESTORE_CONFLICT",
          message: "Cannot restore while an organization already exists. Reset the CRM first.",
        },
      });
    }

    await prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: data.organization!.name },
      });

      if (data.settings) {
        await tx.organizationSettings.create({
          data: {
            organizationId: org.id,
            timezone: (data.settings.timezone as string) || "America/Chicago",
            currency: (data.settings.currency as string) || "USD",
            fiscalYearStart: (data.settings.fiscalYearStart as number) || 1,
            smtpSecure: (data.settings.smtpSecure as boolean) || false,
            smtpPort: (data.settings.smtpPort as number) || 587,
            smtpFromName: (data.settings.smtpFromName as string) || org.name,
            smtpFromEmail: (data.settings.smtpFromEmail as string) || "",
          },
        });
      }

      // Restore users with a placeholder password hash — they must reset via admin
      const PLACEHOLDER_HASH = await bcrypt.hash("TempRestore2026!", 10);
      for (const u of data.users ?? []) {
        await tx.user.create({
          data: {
            organizationId: org.id,
            email: u.email,
            firstName: u.firstName,
            lastName: u.lastName,
            role: u.role,
            active: u.active,
            passwordHash: PLACEHOLDER_HASH,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          organizationId: org.id,
          action: "SETUP_RESTORED",
          entity: "Organization",
          entityId: org.id,
          metadata: { snapshotId, restoredUserCount: data.users?.length ?? 0 },
        },
      });
    });

    // Mark snapshot as restored
    await prisma.setupSnapshot.update({
      where: { id: snapshotId },
      data: { restoredAt: new Date() },
    });

    return res.json({
      success: true,
      data: { restoredAt: new Date().toISOString() },
    });
  } catch (err) {
    console.error("[setup/restore] Failed:", err);
    return res.status(500).json({
      success: false,
      error: { code: "RESTORE_FAILED", message: "Failed to restore from snapshot." },
    });
  }
});

export default router;
