/**
 * Organization settings routes for OyamaCRM.
 * Merges Organization + OrganizationSettings into one payload for the UI.
 * Includes regional settings and SMTP transport settings.
 *
 * @module routes/settings
 */
import { Router } from "express";
import { prisma } from "../lib/prisma.js";

const router = Router();
const ORG_ID = "org_demo";

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

/** GET /api/settings — Return merged organization and settings (regional + SMTP). */
router.get("/", async (_req, res) => {
  try {
    const [org, settings] = await Promise.all([
      prisma.organization.findUnique({ where: { id: ORG_ID } }),
      prisma.organizationSettings.findUnique({ where: { organizationId: ORG_ID } }),
    ]);

    res.json({
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
    res.status(500).json({ error: { code: "SETTINGS_READ_FAILED", message: "Failed to load settings" } });
  }
});

/** PUT /api/settings — Update organization name, regional settings, and SMTP transport settings. */
router.put("/", async (req, res) => {
  try {
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
          where: { id: ORG_ID },
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
          where: { organizationId: ORG_ID },
          create: {
            organizationId: ORG_ID,
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
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: { code: "SETTINGS_WRITE_FAILED", message: "Failed to save settings" } });
  }
});

export default router;
