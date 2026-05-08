/**
 * Organization settings routes for OyamaCRM.
 * Merges Organization + OrganizationSettings into one payload for the UI and
 * exposes the guarded destructive reset flow used by Settings → Security.
 *
 * @module routes/settings
 */
import { Router, Request, Response } from "express";
import { REFRESH_COOKIE } from "../lib/auth.js";
import { prisma } from "../lib/prisma.js";
import {
  clearResetVerificationCode,
  createResetVerificationCode,
  verifyResetVerificationCode,
} from "../lib/reset-verification.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resetCrmInstallation } from "../services/reset-crm.js";

const router = Router();

interface SettingsPayload {
  orgName?: string;
  fiscalYearStart?: number;
  currency?: string;
  timezone?: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFromName?: string | null;
  smtpFromEmail?: string | null;
}

interface ResetPayload {
  /** The 10-digit code currently displayed to the user. */
  verificationCode?: string;
  /** The second confirmation field, which must equal RESET exactly. */
  confirmationText?: string;
}

/**
 * Resolves the single active installation organization for settings surfaces.
 * The app still behaves as a single-install CRM, so the oldest org is the
 * settings target until broader tenancy work lands.
 */
async function getActiveOrganization() {
  return prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });
}

/** GET /api/settings — Return merged organization and settings (regional + SMTP). */
router.get("/", async (_req: Request, res: Response) => {
  try {
    const organization = await getActiveOrganization();
    const organizationId = organization?.id;

    if (!organizationId) {
      return res.json({
        orgName: "",
        fiscalYearStart: 1,
        currency: "USD",
        timezone: "America/Chicago",
        smtpHost: "",
        smtpPort: 587,
        smtpSecure: false,
        smtpUser: "",
        smtpPass: "",
        smtpFromName: "OyamaCRM",
        smtpFromEmail: "",
      });
    }

    const [org, settings] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId } }),
      prisma.organizationSettings.findUnique({ where: { organizationId } }),
    ]);

    return res.json({
      orgName: org?.name ?? "",
      fiscalYearStart: settings?.fiscalYearStart ?? 1,
      currency: settings?.currency ?? "USD",
      timezone: settings?.timezone ?? "America/Chicago",
      smtpHost: settings?.smtpHost ?? "",
      smtpPort: settings?.smtpPort ?? 587,
      smtpSecure: settings?.smtpSecure ?? false,
      smtpUser: settings?.smtpUser ?? "",
      smtpPass: settings?.smtpPass ?? "",
      smtpFromName: settings?.smtpFromName ?? org?.name ?? "OyamaCRM",
      smtpFromEmail: settings?.smtpFromEmail ?? "",
    });
  } catch {
    return res.status(500).json({ error: { code: "SETTINGS_READ_FAILED", message: "Failed to load settings" } });
  }
});

/** PUT /api/settings — Update organization name, regional settings, and SMTP transport settings. */
router.put("/", async (req: Request, res: Response) => {
  try {
    const organization = await getActiveOrganization();
    if (!organization) {
      return res.status(404).json({ error: { code: "SETTINGS_NOT_READY", message: "No organization has been configured yet." } });
    }

    const body = req.body as SettingsPayload;
    const {
      orgName,
      fiscalYearStart,
      currency,
      timezone,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      smtpFromName,
      smtpFromEmail,
    } = body;

    const updates: Array<Promise<unknown>> = [];

    if (orgName !== undefined) {
      updates.push(
        prisma.organization.update({
          where: { id: organization.id },
          data: { name: orgName },
        })
      );
    }

    const hasSettingsUpdates = [
      fiscalYearStart,
      currency,
      timezone,
      smtpHost,
      smtpPort,
      smtpSecure,
      smtpUser,
      smtpPass,
      smtpFromName,
      smtpFromEmail,
    ].some((v) => v !== undefined);

    if (hasSettingsUpdates) {
      updates.push(
        prisma.organizationSettings.upsert({
          where: { organizationId: organization.id },
          create: {
            organizationId: organization.id,
            fiscalYearStart: fiscalYearStart ?? 1,
            currency: currency ?? "USD",
            timezone: timezone ?? "America/Chicago",
            smtpHost: smtpHost ?? "",
            smtpPort: smtpPort ?? 587,
            smtpSecure: smtpSecure ?? false,
            smtpUser: smtpUser ?? "",
            smtpPass: smtpPass ?? "",
            smtpFromName: smtpFromName ?? "",
            smtpFromEmail: smtpFromEmail ?? "",
          },
          update: {
            ...(fiscalYearStart !== undefined && { fiscalYearStart }),
            ...(currency !== undefined && { currency }),
            ...(timezone !== undefined && { timezone }),
            ...(smtpHost !== undefined && { smtpHost }),
            ...(smtpPort !== undefined && { smtpPort }),
            ...(smtpSecure !== undefined && { smtpSecure }),
            ...(smtpUser !== undefined && { smtpUser }),
            ...(smtpPass !== undefined && { smtpPass }),
            ...(smtpFromName !== undefined && { smtpFromName }),
            ...(smtpFromEmail !== undefined && { smtpFromEmail }),
          },
        })
      );
    }

    await Promise.all(updates);
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: { code: "SETTINGS_WRITE_FAILED", message: "Failed to save settings" } });
  }
});

/**
 * GET /api/settings/reset/verification-code
 * Description: Generates the latest 10-digit confirmation code for the Settings reset flow.
 * Request: authenticated admin only
 * Response: { success, data: { code, expiresAt }, meta }
 */
router.get("/reset/verification-code", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const entry = createResetVerificationCode(req.user!.sub);

  return res.json({
    success: true,
    data: {
      code: entry.code,
      expiresAt: entry.expiresAt.toISOString(),
    },
    meta: {},
  });
});

/**
 * POST /api/settings/reset
 * Description: Clears the full CRM installation and reopens `/setup`.
 * Request: { verificationCode, confirmationText } for an authenticated admin
 * Response: { success, data: { resetCompleted, redirectTo }, meta }
 */
router.post("/reset", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const body = req.body as ResetPayload;
    const verificationCode = body.verificationCode?.trim() ?? "";
    const confirmationText = body.confirmationText?.trim() ?? "";

    if (confirmationText !== "RESET") {
      return res.status(400).json({
        success: false,
        error: {
          code: "RESET_CONFIRMATION_REQUIRED",
          message: 'Type "RESET" to confirm this destructive action.',
        },
      });
    }

    if (!verifyResetVerificationCode(req.user!.sub, verificationCode)) {
      return res.status(400).json({
        success: false,
        error: {
          code: "INVALID_RESET_CODE",
          message: "The verification code is invalid or expired. Generate a new code and try again.",
        },
      });
    }

    await resetCrmInstallation();
    clearResetVerificationCode(req.user!.sub);
    res.clearCookie(REFRESH_COOKIE, { path: "/api/auth" });

    return res.json({
      success: true,
      data: {
        resetCompleted: true,
        redirectTo: "/setup",
      },
      meta: {},
    });
  } catch {
    clearResetVerificationCode(req.user!.sub);
    return res.status(500).json({
      success: false,
      error: {
        code: "RESET_FAILED",
        message: "Failed to reset this CRM installation.",
      },
    });
  }
});

export default router;
