/**
 * Organization settings routes for OyamaCRM.
 * Merges Organization + OrganizationSettings into one payload for the UI and
 * exposes the guarded destructive reset flow used by Settings → Security.
 *
 * @module routes/settings
 */
import { Router, Request, Response } from "express";
import nodemailer from "nodemailer";
import { REFRESH_COOKIE } from "../lib/auth.js";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import {
  clearResetVerificationCode,
  createResetVerificationCode,
  verifyResetVerificationCode,
} from "../lib/reset-verification.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import {
  getAuthSecuritySettingsForOrganization,
  saveAuthSecuritySettingsForOrganization,
} from "../services/auth-security.js";
import { resetCrmInstallation } from "../services/reset-crm.js";

const router = Router();

/** Serializes current org+settings+users for a recovery snapshot. */
async function buildSnapshot(): Promise<string> {
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
  return JSON.stringify({ organization, settings, users, capturedAt: new Date().toISOString() });
}

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

type WorkspaceDefault = "donor" | "compassion";

interface WorkspaceSettingsPayload {
  donorEnabled?: boolean;
  compassionEnabled?: boolean;
  showModuleSwitcher?: boolean;
  defaultWorkspace?: WorkspaceDefault;
}

interface AuthSecurityPayload {
  emailMfaEnabled?: boolean;
  passwordResetEnabled?: boolean;
  mfaCodeTtlMinutes?: number;
  passwordResetTtlMinutes?: number;
}

interface BrandingSettingsPayload {
  primaryColor?: string;
  accentColor?: string;
  emailBackgroundColor?: string;
  emailFontFamily?: string;
  emailContentWidth?: number;
  logoUrl?: string;
  logoSquareUrl?: string;
  organizationDisplayName?: string;
  legalOrganizationName?: string;
  tagline?: string;
  missionStatement?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  streetAddress1?: string;
  streetAddress2?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
  locationName?: string;
  taxId?: string;
  footerLegalText?: string;
  socialFacebook?: string;
  socialInstagram?: string;
  socialLinkedIn?: string;
  socialYoutube?: string;
  socialX?: string;
}

interface ResetPayload {
  /** The 10-digit code currently displayed to the user. */
  verificationCode?: string;
  /** The second confirmation field, which must equal RESET exactly. */
  confirmationText?: string;
}

interface SmtpTestPayload {
  toEmail?: string;
  smtpHost?: string | null;
  smtpPort?: number | null;
  smtpSecure?: boolean;
  smtpUser?: string | null;
  smtpPass?: string | null;
  smtpFromName?: string | null;
  smtpFromEmail?: string | null;
}

/** Practical email format validation for SMTP test-send endpoint. */
function isValidEmail(value: string): boolean {
  const email = value.trim();
  return /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/.test(email);
}

/** Reads SMTP defaults from environment for deployments that configure SMTP outside DB settings. */
function getEnvSmtpDefaults() {
  const envPort = Number.parseInt((process.env.SMTP_PORT ?? "").trim(), 10);
  return {
    smtpHost: (process.env.SMTP_HOST ?? "").trim(),
    smtpPort: Number.isFinite(envPort) ? envPort : 587,
    smtpSecure: /^(1|true|yes|on)$/i.test((process.env.SMTP_SECURE ?? "").trim()),
    smtpUser: (process.env.SMTP_USER ?? "").trim(),
    smtpPass: process.env.SMTP_PASS ?? "",
    smtpFromName: (process.env.SMTP_FROM_NAME ?? "").trim(),
    smtpFromEmail: (process.env.SMTP_FROM_EMAIL ?? "").trim(),
  };
}

/** Picks DB value when configured, otherwise falls back to env-level defaults. */
function valueOrEnv(value: string | null | undefined, envValue: string): string {
  const trimmed = (value ?? "").trim();
  return trimmed || envValue;
}

const BRANDING_PLUGIN_KEY = "organization-branding";

/** Safe defaults for organization-wide branding settings consumed across modules. */
function getDefaultBrandingSettings() {
  return {
    primaryColor: "#16a34a",
    accentColor: "#0f766e",
    emailBackgroundColor: "#f5f5f5",
    emailFontFamily: "Arial, Helvetica, sans-serif",
    emailContentWidth: 600,
    logoUrl: "",
    logoSquareUrl: "",
    organizationDisplayName: "",
    legalOrganizationName: "",
    tagline: "",
    missionStatement: "",
    contactEmail: "",
    contactPhone: "",
    websiteUrl: "",
    streetAddress1: "",
    streetAddress2: "",
    city: "",
    stateProvince: "",
    postalCode: "",
    country: "",
    locationName: "",
    taxId: "",
    footerLegalText: "",
    socialFacebook: "",
    socialInstagram: "",
    socialLinkedIn: "",
    socialYoutube: "",
    socialX: "",
  };
}

/** Ensures branding payload is normalized and bounded before persistence/use. */
function normalizeBrandingPayload(input: unknown) {
  const defaults = getDefaultBrandingSettings();
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

  const sanitizeString = (value: unknown, fallback = "") => String(value ?? fallback).trim();
  const sanitizeHex = (value: unknown, fallback: string) => {
    const next = sanitizeString(value, fallback);
    return /^#[0-9a-fA-F]{6}$/.test(next) ? next : fallback;
  };
  const sanitizeWidth = (value: unknown, fallback: number) => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(760, Math.max(420, parsed));
  };

  return {
    primaryColor: sanitizeHex(raw.primaryColor, defaults.primaryColor),
    accentColor: sanitizeHex(raw.accentColor, defaults.accentColor),
    emailBackgroundColor: sanitizeHex(raw.emailBackgroundColor, defaults.emailBackgroundColor),
    emailFontFamily: sanitizeString(raw.emailFontFamily, defaults.emailFontFamily),
    emailContentWidth: sanitizeWidth(raw.emailContentWidth, defaults.emailContentWidth),
    logoUrl: sanitizeString(raw.logoUrl),
    logoSquareUrl: sanitizeString(raw.logoSquareUrl),
    organizationDisplayName: sanitizeString(raw.organizationDisplayName),
    legalOrganizationName: sanitizeString(raw.legalOrganizationName),
    tagline: sanitizeString(raw.tagline),
    missionStatement: sanitizeString(raw.missionStatement),
    contactEmail: sanitizeString(raw.contactEmail),
    contactPhone: sanitizeString(raw.contactPhone),
    websiteUrl: sanitizeString(raw.websiteUrl),
    streetAddress1: sanitizeString(raw.streetAddress1),
    streetAddress2: sanitizeString(raw.streetAddress2),
    city: sanitizeString(raw.city),
    stateProvince: sanitizeString(raw.stateProvince),
    postalCode: sanitizeString(raw.postalCode),
    country: sanitizeString(raw.country),
    locationName: sanitizeString(raw.locationName),
    taxId: sanitizeString(raw.taxId),
    footerLegalText: sanitizeString(raw.footerLegalText),
    socialFacebook: sanitizeString(raw.socialFacebook),
    socialInstagram: sanitizeString(raw.socialInstagram),
    socialLinkedIn: sanitizeString(raw.socialLinkedIn),
    socialYoutube: sanitizeString(raw.socialYoutube),
    socialX: sanitizeString(raw.socialX),
  };
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

/** Resolves organizationId from auth context first, then falls back to the oldest installation org. */
async function resolveSettingsOrganizationId(req: Request): Promise<string | null> {
  const userOrgId = req.user?.orgId?.trim();
  if (userOrgId) return userOrgId;
  const org = await getActiveOrganization();
  return org?.id ?? null;
}

/** Normalizes workspace settings and enforces at least one enabled workspace. */
function normalizeWorkspacePayload(input: WorkspaceSettingsPayload) {
  const donorEnabled = input.donorEnabled ?? true;
  const compassionEnabled = input.compassionEnabled ?? true;
  const showModuleSwitcher = input.showModuleSwitcher ?? true;
  const requestedDefault: WorkspaceDefault = input.defaultWorkspace === "compassion" ? "compassion" : "donor";

  if (!donorEnabled && !compassionEnabled) {
    return {
      ok: false as const,
      error: { code: "WORKSPACE_REQUIRED", message: "At least one workspace must remain enabled." },
    };
  }

  const defaultWorkspace: WorkspaceDefault = requestedDefault === "donor"
    ? (donorEnabled ? "donor" : "compassion")
    : (compassionEnabled ? "compassion" : "donor");

  return {
    ok: true as const,
    value: {
      donorEnabled,
      compassionEnabled,
      showModuleSwitcher,
      defaultWorkspace,
    },
  };
}

/** GET /api/settings/workspaces — Return module enablement and startup defaults for the current organization. */
router.get("/workspaces", requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = await resolveSettingsOrganizationId(req);
    if (!organizationId) {
      const defaults = normalizeWorkspacePayload({});
      return res.json(defaults.ok ? defaults.value : {});
    }

    const settings = await prisma.organizationSettings.findUnique({
      where: { organizationId },
      select: {
        donorWorkspaceEnabled: true,
        compassionWorkspaceEnabled: true,
        showModuleSwitcher: true,
        defaultWorkspace: true,
      },
    });

    const normalized = normalizeWorkspacePayload({
      donorEnabled: settings?.donorWorkspaceEnabled,
      compassionEnabled: settings?.compassionWorkspaceEnabled,
      showModuleSwitcher: settings?.showModuleSwitcher,
      defaultWorkspace: settings?.defaultWorkspace === "compassion" ? "compassion" : "donor",
    });

    return res.json(normalized.ok ? normalized.value : {});
  } catch {
    return res.status(500).json({ error: { code: "WORKSPACE_SETTINGS_READ_FAILED", message: "Failed to load workspace settings" } });
  }
});

/** PUT /api/settings/workspaces — Persist module enablement and startup defaults. Admin-only. */
router.put("/workspaces", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const organizationId = await resolveSettingsOrganizationId(req);
    if (!organizationId) {
      return res.status(404).json({ error: { code: "SETTINGS_NOT_READY", message: "No organization has been configured yet." } });
    }

    const body = req.body as WorkspaceSettingsPayload;
    const normalized = normalizeWorkspacePayload(body);
    if (!normalized.ok) {
      return res.status(400).json({ error: normalized.error });
    }

    const saved = await prisma.organizationSettings.upsert({
      where: { organizationId },
      create: {
        organizationId,
        donorWorkspaceEnabled: normalized.value.donorEnabled,
        compassionWorkspaceEnabled: normalized.value.compassionEnabled,
        showModuleSwitcher: normalized.value.showModuleSwitcher,
        defaultWorkspace: normalized.value.defaultWorkspace,
      },
      update: {
        donorWorkspaceEnabled: normalized.value.donorEnabled,
        compassionWorkspaceEnabled: normalized.value.compassionEnabled,
        showModuleSwitcher: normalized.value.showModuleSwitcher,
        defaultWorkspace: normalized.value.defaultWorkspace,
      },
      select: {
        donorWorkspaceEnabled: true,
        compassionWorkspaceEnabled: true,
        showModuleSwitcher: true,
        defaultWorkspace: true,
      },
    });

    logAudit({
      action: "WORKSPACE_SETTINGS_UPDATED",
      entity: "OrganizationSettings",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: normalized.value,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json({
      donorEnabled: saved.donorWorkspaceEnabled,
      compassionEnabled: saved.compassionWorkspaceEnabled,
      showModuleSwitcher: saved.showModuleSwitcher,
      defaultWorkspace: saved.defaultWorkspace === "compassion" ? "compassion" : "donor",
    });
  } catch {
    return res.status(500).json({ error: { code: "WORKSPACE_SETTINGS_WRITE_FAILED", message: "Failed to save workspace settings" } });
  }
});

/** GET /api/settings/security/auth — Returns auth policy settings (MFA + password reset). */
router.get("/security/auth", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const organizationId = await resolveSettingsOrganizationId(req);
  if (!organizationId) {
    return res.status(404).json({ error: { code: "SETTINGS_NOT_READY", message: "No organization configured." } });
  }

  const settings = await getAuthSecuritySettingsForOrganization(organizationId);
  return res.json(settings);
});

/** PUT /api/settings/security/auth — Persists auth policy settings (MFA + password reset). */
router.put("/security/auth", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  const organizationId = await resolveSettingsOrganizationId(req);
  if (!organizationId) {
    return res.status(404).json({ error: { code: "SETTINGS_NOT_READY", message: "No organization configured." } });
  }

  const body = req.body as AuthSecurityPayload;
  const settings = await saveAuthSecuritySettingsForOrganization(organizationId, body);

  await logAudit({
    action: "AUTH_SECURITY_SETTINGS_UPDATED",
    entity: "PluginSetting",
    entityId: organizationId,
    userId: req.user?.sub,
    organizationId,
    metadata: settings,
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  return res.json(settings);
});

/** GET /api/settings/branding — Returns organization branding defaults used by Email Builder and related tools. */
router.get("/branding", requireAuth, async (req: Request, res: Response) => {
  try {
    const organizationId = await resolveSettingsOrganizationId(req);
    if (!organizationId) {
      return res.json(getDefaultBrandingSettings());
    }

    const [organization, setting] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      prisma.pluginSetting.findUnique({
        where: {
          organizationId_pluginKey: {
            organizationId,
            pluginKey: BRANDING_PLUGIN_KEY,
          },
        },
      }),
    ]);

    const normalized = normalizeBrandingPayload(setting?.config ?? {});
    const displayName = normalized.organizationDisplayName || organization?.name || "";

    return res.json({
      ...normalized,
      organizationDisplayName: displayName,
      legalOrganizationName: normalized.legalOrganizationName || displayName,
    });
  } catch {
    return res.status(500).json({ error: { code: "BRANDING_SETTINGS_READ_FAILED", message: "Failed to load branding settings" } });
  }
});

/** PUT /api/settings/branding — Persists organization branding defaults for downstream consumers. Admin-only. */
router.put("/branding", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const organizationId = await resolveSettingsOrganizationId(req);
    if (!organizationId) {
      return res.status(404).json({ error: { code: "SETTINGS_NOT_READY", message: "No organization has been configured yet." } });
    }

    const normalized = normalizeBrandingPayload(req.body as BrandingSettingsPayload);

    await prisma.pluginSetting.upsert({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: BRANDING_PLUGIN_KEY,
        },
      },
      create: {
        organizationId,
        pluginKey: BRANDING_PLUGIN_KEY,
        enabled: true,
        config: normalized,
      },
      update: {
        enabled: true,
        config: normalized,
      },
    });

    await logAudit({
      action: "BRANDING_SETTINGS_UPDATED",
      entity: "PluginSetting",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        fields: Object.keys(normalized),
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json(normalized);
  } catch {
    return res.status(500).json({ error: { code: "BRANDING_SETTINGS_WRITE_FAILED", message: "Failed to save branding settings" } });
  }
});

/** GET /api/settings — Return merged organization and settings (regional + SMTP). Requires authentication. */
router.get("/", requireAuth, async (_req: Request, res: Response) => {
  try {
    const envSmtp = getEnvSmtpDefaults();
    const organization = await getActiveOrganization();
    const organizationId = organization?.id;

    if (!organizationId) {
      return res.json({
        orgName: "",
        fiscalYearStart: 1,
        currency: "USD",
        timezone: "America/Chicago",
        smtpHost: envSmtp.smtpHost,
        smtpPort: envSmtp.smtpPort,
        smtpSecure: envSmtp.smtpSecure,
        smtpUser: envSmtp.smtpUser,
        smtpPass: envSmtp.smtpPass,
        smtpFromName: envSmtp.smtpFromName || "OyamaCRM",
        smtpFromEmail: envSmtp.smtpFromEmail,
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
      smtpHost: valueOrEnv(settings?.smtpHost, envSmtp.smtpHost),
      smtpPort: settings?.smtpPort ?? envSmtp.smtpPort,
      smtpSecure: settings?.smtpSecure ?? envSmtp.smtpSecure,
      smtpUser: valueOrEnv(settings?.smtpUser, envSmtp.smtpUser),
      smtpPass: valueOrEnv(settings?.smtpPass, envSmtp.smtpPass),
      smtpFromName: valueOrEnv(settings?.smtpFromName, envSmtp.smtpFromName || org?.name || "OyamaCRM"),
      smtpFromEmail: valueOrEnv(settings?.smtpFromEmail, envSmtp.smtpFromEmail),
    });
  } catch {
    return res.status(500).json({ error: { code: "SETTINGS_READ_FAILED", message: "Failed to load settings" } });
  }
});

/** PUT /api/settings — Update organization name, regional settings, and SMTP transport settings. Admin-only. */
router.put("/", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
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
    logAudit({
      action: "SETTINGS_UPDATED",
      entity: "OrganizationSettings",
      entityId: organization.id,
      userId: req.user?.sub,
      organizationId: organization.id,
      metadata: { fields: Object.keys(body).filter((k) => body[k as keyof SettingsPayload] !== undefined) },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    return res.json({ success: true });
  } catch {
    return res.status(500).json({ error: { code: "SETTINGS_WRITE_FAILED", message: "Failed to save settings" } });
  }
});

/**
 * POST /api/settings/smtp/test
 * Sends a real SMTP test email using current organization settings (env fallback included).
 */
router.post("/smtp/test", requireAuth, requireRole("admin"), async (req: Request, res: Response) => {
  try {
    const organizationId = await resolveSettingsOrganizationId(req);
    if (!organizationId) {
      return res.status(404).json({ error: { code: "SETTINGS_NOT_READY", message: "No organization is configured yet." } });
    }

    const body = req.body as SmtpTestPayload;
    const toEmail = String(body.toEmail ?? "").trim().toLowerCase();
    if (!toEmail || !isValidEmail(toEmail)) {
      return res.status(400).json({ error: { code: "INVALID_EMAIL", message: "A valid recipient email is required." } });
    }

    const [organization, settings] = await Promise.all([
      prisma.organization.findUnique({ where: { id: organizationId }, select: { name: true } }),
      prisma.organizationSettings.findUnique({
        where: { organizationId },
        select: {
          smtpHost: true,
          smtpPort: true,
          smtpSecure: true,
          smtpUser: true,
          smtpPass: true,
          smtpFromName: true,
          smtpFromEmail: true,
        },
      }),
    ]);

    const envSmtp = getEnvSmtpDefaults();
    const smtpHost = valueOrEnv(body.smtpHost, valueOrEnv(settings?.smtpHost, envSmtp.smtpHost));
    const smtpPort = body.smtpPort ?? settings?.smtpPort ?? envSmtp.smtpPort;
    const smtpSecure = body.smtpSecure ?? settings?.smtpSecure ?? envSmtp.smtpSecure;
    const smtpUser = valueOrEnv(body.smtpUser, valueOrEnv(settings?.smtpUser, envSmtp.smtpUser));
    const smtpPass = valueOrEnv(body.smtpPass, valueOrEnv(settings?.smtpPass, envSmtp.smtpPass));
    const smtpFromName = valueOrEnv(
      body.smtpFromName,
      valueOrEnv(settings?.smtpFromName, envSmtp.smtpFromName || organization?.name || "OyamaCRM"),
    );
    const smtpFromEmail = valueOrEnv(body.smtpFromEmail, valueOrEnv(settings?.smtpFromEmail, envSmtp.smtpFromEmail));

    if (!smtpHost || !smtpPort || !smtpFromEmail) {
      return res.status(400).json({
        error: {
          code: "SMTP_NOT_CONFIGURED",
          message: "SMTP host, port, and from email are required before test send.",
        },
      });
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: smtpUser ? { user: smtpUser, pass: smtpPass } : undefined,
    });

    await transporter.verify();

    await transporter.sendMail({
      from: `"${smtpFromName}" <${smtpFromEmail}>`,
      to: toEmail,
      subject: `SMTP Test - ${organization?.name ?? "OyamaCRM"}`,
      text: `This is a live SMTP test from ${organization?.name ?? "OyamaCRM"}.`,
      html: `<p>This is a live SMTP test from <strong>${organization?.name ?? "OyamaCRM"}</strong>.</p>`,
    });

    logAudit({
      action: "SMTP_TEST_EMAIL_SENT",
      entity: "OrganizationSettings",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        toEmail,
        smtpHost,
        smtpPort,
        smtpSecure,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    return res.json({ success: true, message: `SMTP test email sent to ${toEmail}.` });
  } catch (error) {
    const message = error instanceof Error ? error.message : "SMTP test failed.";
    return res.status(502).json({ error: { code: "SMTP_TEST_FAILED", message } });
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

    // Auto-create a recovery snapshot before wiping data so the admin can restore if needed.
    try {
      const [org, users] = await Promise.all([
        prisma.organization.findFirst({ orderBy: { createdAt: "asc" } }),
        prisma.user.count(),
      ]);
      const label = `Pre-reset backup — ${org?.name ?? "unknown org"}, ${users} user${users !== 1 ? "s" : ""}, ${new Date().toLocaleString()}`;
      const snapshotData = await buildSnapshot();
      await prisma.setupSnapshot.create({ data: { label, snapshotData } });
    } catch (snapErr) {
      // Snapshot failure is non-fatal — log but don't block the reset
      console.error("[settings/reset] Snapshot failed (non-fatal):", snapErr);
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
