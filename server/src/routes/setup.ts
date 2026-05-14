/**
 * Setup routes for first-run onboarding and bootstrap.
 * Exposes status + completion endpoints that prepare organization, settings, and first admin user.
 *
 * @module routes/setup
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { upsertEnvironmentFileValues } from "../lib/env-file.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resetWatchdogStoreConnections } from "../services/watchdog-store.js";
import { resetWatchdogOpsStoreConnections } from "../services/watchdog-ops-store.js";

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
    defaultWorkspace?: "donor" | "compassion";
  };
  defaults?: {
    fiscalYearStart?: number;
    currency?: string;
    timezone?: string;
    smtpHost?: string;
    smtpPort?: number;
    smtpFromName?: string;
    smtpFromEmail?: string;
  };
  goals?: {
    annualRevenueGoal?: number | null;
    donorRetentionGoal?: number | null;
    averageGiftGoal?: number | null;
  };
  teamUsers?: Array<{
    firstName: string;
    lastName: string;
    email: string;
    role?: string;
    password: string;
  }>;
  environment?: {
    databaseUrl?: string;
    watchdogDatabaseUrl?: string;
    watchdogEncryptionKey?: string;
    jwtSecret?: string;
    nextPublicApiUrl?: string;
  };
}

const ADMIN_ROLE = "admin";
const DEFAULT_TEAM_ROLE = "staff";
const DEFAULT_TIMEZONE = "America/Chicago";
const DEFAULT_CURRENCY = "USD";
const DEFAULT_FISCAL_YEAR_START = 1;
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
    const timezone = body?.defaults?.timezone?.trim() || body?.organization?.timezone?.trim() || DEFAULT_TIMEZONE;
    const fiscalYearStart = body?.defaults?.fiscalYearStart ?? DEFAULT_FISCAL_YEAR_START;
    const currency = body?.defaults?.currency?.trim() || DEFAULT_CURRENCY;
    const adminFirstName = body?.adminUser?.firstName?.trim();
    const adminLastName = body?.adminUser?.lastName?.trim();
    const adminEmail = body?.adminUser?.email?.trim().toLowerCase();
    const adminPassword = body?.adminUser?.password ?? "";
    const smtpHost = body?.defaults?.smtpHost?.trim() ?? "";
    const smtpPort = body?.defaults?.smtpPort ?? 587;
    const smtpFromName = body?.defaults?.smtpFromName?.trim() || orgName;
    const smtpFromEmail = body?.defaults?.smtpFromEmail?.trim() || body?.organization?.primaryContactEmail?.trim() || "";
    const teamUsersInput = Array.isArray(body?.teamUsers) ? body.teamUsers : [];
    const environmentInput = body?.environment;
    const environmentUpdates: Record<string, string> = {};

    if (environmentInput?.databaseUrl?.trim()) {
      environmentUpdates.DATABASE_URL = environmentInput.databaseUrl.trim();
    }
    if (environmentInput?.watchdogDatabaseUrl?.trim()) {
      environmentUpdates.WATCHDOG_DATABASE_URL = environmentInput.watchdogDatabaseUrl.trim();
    }
    if (environmentInput?.watchdogEncryptionKey?.trim()) {
      environmentUpdates.WATCHDOG_ENCRYPTION_KEY = environmentInput.watchdogEncryptionKey.trim();
    }
    if (environmentInput?.jwtSecret?.trim()) {
      environmentUpdates.JWT_SECRET = environmentInput.jwtSecret.trim();
    }
    if (environmentInput?.nextPublicApiUrl?.trim()) {
      environmentUpdates.NEXT_PUBLIC_API_URL = environmentInput.nextPublicApiUrl.trim();
    }

    const allowedTeamRoles = new Set(["manager", "staff", "readonly", "report_viewer"]);
    const normalizedTeamUsers = teamUsersInput.map((user) => ({
      firstName: user.firstName?.trim() ?? "",
      lastName: user.lastName?.trim() ?? "",
      email: user.email?.trim().toLowerCase() ?? "",
      role: allowedTeamRoles.has(user.role ?? "") ? user.role! : DEFAULT_TEAM_ROLE,
      password: user.password ?? "",
    }));

    if (!orgName || !adminFirstName || !adminLastName || !adminEmail || !adminPassword) {
      return res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "organization.name, adminUser fields, and adminUser.password are required.",
        },
      });
    }

    const supportedValuesOf = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf;
    const supportedTimezones = typeof supportedValuesOf === "function" ? supportedValuesOf("timeZone") : [];
    if (supportedTimezones.length > 0 && !supportedTimezones.includes(timezone)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_TIMEZONE",
          message: "Timezone must be a valid IANA timezone string.",
        },
      });
    }

    if (fiscalYearStart < 1 || fiscalYearStart > 12) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_FISCAL_YEAR_START",
          message: "fiscalYearStart must be between 1 and 12.",
        },
      });
    }

    if (!currency) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_CURRENCY",
          message: "currency is required when defaults are provided.",
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

    const teamEmailSet = new Set<string>();
    for (const user of normalizedTeamUsers) {
      if (!user.firstName || !user.lastName || !user.email || user.password.length < 8) {
        return res.status(400).json({
          success: false,
          error: {
            code: "TEAM_USER_VALIDATION_FAILED",
            message: "Each team user requires firstName, lastName, email, and password (min 8 chars).",
          },
        });
      }
      if (user.email === adminEmail) {
        return res.status(400).json({
          success: false,
          error: {
            code: "TEAM_USER_EMAIL_CONFLICT",
            message: "Team user email cannot match the admin email.",
          },
        });
      }
      if (teamEmailSet.has(user.email)) {
        return res.status(400).json({
          success: false,
          error: {
            code: "TEAM_USER_DUPLICATE_EMAIL",
            message: "Team user emails must be unique.",
          },
        });
      }
      teamEmailSet.add(user.email);
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

    const existingTeamUsers = normalizedTeamUsers.length
      ? await prisma.user.findMany({
          where: { email: { in: normalizedTeamUsers.map((u) => u.email) } },
          select: { email: true },
        })
      : [];

    if (existingTeamUsers.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: "TEAM_EMAIL_ALREADY_EXISTS",
          message: `A user already exists with email ${existingTeamUsers[0].email}.`,
        },
      });
    }

    const passwordHash = await bcrypt.hash(adminPassword, BCRYPT_ROUNDS);
    const teamPasswordHashes = await Promise.all(normalizedTeamUsers.map((user) => bcrypt.hash(user.password, BCRYPT_ROUNDS)));

    if (Object.keys(environmentUpdates).length > 0) {
      await upsertEnvironmentFileValues(environmentUpdates);

      for (const [key, value] of Object.entries(environmentUpdates)) {
        process.env[key] = value;
      }

      if (environmentUpdates.WATCHDOG_DATABASE_URL || environmentUpdates.WATCHDOG_ENCRYPTION_KEY) {
        await Promise.all([
          resetWatchdogStoreConnections(),
          resetWatchdogOpsStoreConnections(),
        ]);
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const organization = await tx.organization.create({
        data: { name: orgName },
      });

      await tx.organizationSettings.create({
        data: {
          organizationId: organization.id,
          timezone,
          currency,
          fiscalYearStart,
          donorWorkspaceEnabled: body?.workspaces?.oyamacrm ?? true,
          compassionWorkspaceEnabled: body?.workspaces?.oyamacrmCompassion ?? true,
          showModuleSwitcher: true,
          defaultWorkspace: body?.workspaces?.defaultWorkspace === "compassion" ? "compassion" : "donor",
          smtpSecure: false,
          smtpHost,
          smtpPort,
          smtpFromName,
          smtpFromEmail,
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

      const createdTeamUsers = normalizedTeamUsers.length > 0
        ? await Promise.all(
            normalizedTeamUsers.map((user, index) => tx.user.create({
              data: {
                organizationId: organization.id,
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                active: true,
                passwordHash: teamPasswordHashes[index],
              },
            })),
          )
        : [];

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
            fiscalYearStart,
            currency,
            branding: body?.branding ?? null,
            workspaces: body?.workspaces ?? null,
            goals: body?.goals ?? null,
            teamUsersCreated: createdTeamUsers.length,
            environmentUpdated: Object.keys(environmentUpdates),
          },
        },
      });

      return { organization, adminUser, createdTeamUsers };
    });

    return res.status(201).json({
      success: true,
      data: {
        setupCompleted: true,
        organizationId: result.organization.id,
        adminUserId: result.adminUser.id,
        teamUsersCreated: result.createdTeamUsers.length,
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
            donorWorkspaceEnabled: (data.settings.donorWorkspaceEnabled as boolean) ?? true,
            compassionWorkspaceEnabled: (data.settings.compassionWorkspaceEnabled as boolean) ?? true,
            showModuleSwitcher: (data.settings.showModuleSwitcher as boolean) ?? true,
            defaultWorkspace: (data.settings.defaultWorkspace as string) === "compassion" ? "compassion" : "donor",
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
