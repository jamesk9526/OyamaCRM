/**
 * Setup routes for first-run onboarding and bootstrap.
 * Exposes status + completion endpoints that prepare organization, settings, and first admin user.
 *
 * @module routes/setup
 */
import { Router, Request, Response } from "express";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";

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

export default router;
