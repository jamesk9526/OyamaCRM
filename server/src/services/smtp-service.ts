/** Shared SMTP resolution and email send helpers for organization-scoped workflows. */
import nodemailer from "nodemailer";
import { prisma } from "../lib/prisma.js";

export interface ResolvedSmtpSettings {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFromName: string | null;
  smtpFromEmail: string | null;
}

/** Parses environment booleans used for SMTP secure mode defaults. */
function parseEnvBool(value: string | undefined): boolean {
  return /^(1|true|yes|on)$/i.test((value ?? "").trim());
}

/** Resolves environment-level SMTP defaults. */
function getEnvSmtpDefaults(): ResolvedSmtpSettings {
  const envPortRaw = (process.env.SMTP_PORT ?? "").trim();
  const envPortParsed = envPortRaw ? Number.parseInt(envPortRaw, 10) : NaN;
  return {
    smtpHost: process.env.SMTP_HOST?.trim() || null,
    smtpPort: Number.isFinite(envPortParsed) ? envPortParsed : 587,
    smtpSecure: parseEnvBool(process.env.SMTP_SECURE),
    smtpUser: process.env.SMTP_USER?.trim() || null,
    smtpPass: process.env.SMTP_PASS?.trim() || null,
    smtpFromName: process.env.SMTP_FROM_NAME?.trim() || null,
    smtpFromEmail: process.env.SMTP_FROM_EMAIL?.trim() || null,
  };
}

/** Resolves effective SMTP settings for one organization using DB values with env fallback. */
export async function resolveOrganizationSmtpSettings(organizationId: string): Promise<ResolvedSmtpSettings> {
  const [organization, settings] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
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

  const env = getEnvSmtpDefaults();

  return {
    smtpHost: settings?.smtpHost?.trim() || env.smtpHost,
    smtpPort: settings?.smtpPort ?? env.smtpPort,
    smtpSecure: settings?.smtpSecure ?? env.smtpSecure,
    smtpUser: settings?.smtpUser?.trim() || env.smtpUser,
    smtpPass: settings?.smtpPass?.trim() || env.smtpPass,
    smtpFromName: settings?.smtpFromName?.trim() || env.smtpFromName || organization?.name || "OyamaCRM",
    smtpFromEmail: settings?.smtpFromEmail?.trim() || env.smtpFromEmail,
  };
}

/** Returns one validation error string when SMTP is incomplete, otherwise null. */
export function getSmtpConfigurationIssue(settings: ResolvedSmtpSettings): string | null {
  if (!settings.smtpHost) return "SMTP host is required.";
  if (!settings.smtpPort) return "SMTP port is required.";
  if (!settings.smtpFromEmail) return "SMTP from email is required.";
  return null;
}

/** Creates one Nodemailer transport for resolved SMTP settings. */
export function createSmtpTransport(settings: ResolvedSmtpSettings) {
  return nodemailer.createTransport({
    host: settings.smtpHost ?? undefined,
    port: settings.smtpPort ?? undefined,
    secure: settings.smtpSecure,
    auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPass ?? "" } : undefined,
  });
}

/** Sends one organization email using resolved SMTP settings and validates transport readiness. */
export async function sendOrganizationEmail(input: {
  organizationId: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromNameOverride?: string;
}): Promise<void> {
  const settings = await resolveOrganizationSmtpSettings(input.organizationId);
  const issue = getSmtpConfigurationIssue(settings);
  if (issue) {
    throw new Error(`SMTP_NOT_CONFIGURED: ${issue}`);
  }

  const transporter = createSmtpTransport(settings);
  await transporter.verify();

  await transporter.sendMail({
    from: `"${input.fromNameOverride || settings.smtpFromName || "OyamaCRM"}" <${settings.smtpFromEmail}>`,
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html ?? `<p>${input.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
  });
}
