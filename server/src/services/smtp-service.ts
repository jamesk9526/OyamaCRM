/** Shared SMTP resolution and email send helpers for organization-scoped workflows. */
import nodemailer from "nodemailer";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { decryptCredential } from "./credential-encryption.js";

const EMAIL_PROVIDER_PLUGIN_KEY = "email-provider";

type EmailProviderType = "standard_smtp" | "microsoft_365_smtp" | "microsoft_graph";

interface MicrosoftGraphTokenResponse {
  token_type?: string;
  scope?: string;
  expires_in?: number;
  access_token?: string;
  refresh_token?: string;
}

interface EmailProviderInternalSettings {
  provider: EmailProviderType;
  microsoftTenantId: string;
  microsoftClientId: string;
  microsoftClientSecret: string;
  microsoftMailbox: string;
  microsoftScope: string;
  graphConnected: boolean;
  graphAccessToken: string;
  graphRefreshToken: string;
  graphTokenType: string;
  graphTokenExpiresAt: string;
  graphLastConnectedAt: string;
  smtpHostOverride: string;
  smtpPortOverride: number;
  smtpSecureOverride: boolean;
}

interface SendEmailPayload {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromNameOverride?: string;
}

export interface OrganizationSendResult {
  acceptedAt: Date;
  providerResponse: string;
  providerMessageId: string | null;
}

export interface OrganizationEmailSender {
  mode: EmailProviderType;
  send(payload: SendEmailPayload): Promise<OrganizationSendResult>;
}

export interface ResolvedSmtpSettings {
  smtpHost: string | null;
  smtpPort: number | null;
  smtpSecure: boolean;
  smtpUser: string | null;
  smtpPass: string | null;
  smtpFromName: string | null;
  smtpFromEmail: string | null;
}

/** Provider defaults preserve legacy SMTP behavior when no provider config exists. */
function getDefaultEmailProviderSettings(): EmailProviderInternalSettings {
  return {
    provider: "standard_smtp",
    microsoftTenantId: "",
    microsoftClientId: "",
    microsoftClientSecret: "",
    microsoftMailbox: "",
    microsoftScope: "Mail.Send offline_access User.Read",
    graphConnected: false,
    graphAccessToken: "",
    graphRefreshToken: "",
    graphTokenType: "Bearer",
    graphTokenExpiresAt: "",
    graphLastConnectedAt: "",
    smtpHostOverride: "",
    smtpPortOverride: 587,
    smtpSecureOverride: false,
  };
}

/** Parses provider plugin config and keeps only supported transport fields. */
function normalizeEmailProviderInternalSettings(input: unknown): EmailProviderInternalSettings {
  const defaults = getDefaultEmailProviderSettings();
  const raw = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};

  const providerRaw = String(raw.provider ?? defaults.provider).trim();
  const provider: EmailProviderType = providerRaw === "microsoft_365_smtp"
    ? "microsoft_365_smtp"
    : providerRaw === "microsoft_graph"
      ? "microsoft_graph"
      : "standard_smtp";

  const smtpPortCandidate = Number.parseInt(String(raw.smtpPortOverride ?? defaults.smtpPortOverride), 10);

  return {
    provider,
    microsoftTenantId: String(raw.microsoftTenantId ?? "").trim().slice(0, 160),
    microsoftClientId: String(raw.microsoftClientId ?? "").trim().slice(0, 220),
    microsoftClientSecret: String(raw.microsoftClientSecret ?? "").trim().slice(0, 4000),
    microsoftMailbox: String(raw.microsoftMailbox ?? "").trim().slice(0, 220),
    microsoftScope: String(raw.microsoftScope ?? defaults.microsoftScope).trim().slice(0, 300),
    graphConnected: Boolean(raw.graphConnected),
    graphAccessToken: String(raw.graphAccessToken ?? "").trim().slice(0, 8000),
    graphRefreshToken: String(raw.graphRefreshToken ?? "").trim().slice(0, 8000),
    graphTokenType: String(raw.graphTokenType ?? "Bearer").trim().slice(0, 40) || "Bearer",
    graphTokenExpiresAt: String(raw.graphTokenExpiresAt ?? "").trim(),
    graphLastConnectedAt: String(raw.graphLastConnectedAt ?? "").trim(),
    smtpHostOverride: String(raw.smtpHostOverride ?? "").trim().slice(0, 220),
    smtpPortOverride: Number.isFinite(smtpPortCandidate) ? Math.min(Math.max(smtpPortCandidate, 1), 65535) : defaults.smtpPortOverride,
    smtpSecureOverride: Boolean(raw.smtpSecureOverride),
  };
}

/** Normalizes Graph scopes while ensuring send + refresh scopes are always present. */
function resolveMicrosoftScopes(rawScope: string): string {
  const defaults = ["Mail.Send", "offline_access", "User.Read"];
  const provided = rawScope
    .split(/\s+/)
    .map((scope) => scope.trim())
    .filter(Boolean);

  const merged = new Set<string>([...provided, ...defaults]);
  return Array.from(merged).join(" ");
}

/** Resolves Graph token endpoint from the configured tenant. */
function microsoftTokenEndpoint(tenantId: string): string {
  const tenant = tenantId.trim() || "common";
  return `https://login.microsoftonline.com/${encodeURIComponent(tenant)}/oauth2/v2.0/token`;
}

/** Returns true when the currently persisted token should be refreshed. */
function shouldRefreshMicrosoftToken(expiresAtIso: string): boolean {
  if (!expiresAtIso) return true;
  const expiresAt = Date.parse(expiresAtIso);
  if (!Number.isFinite(expiresAt)) return true;
  return Date.now() >= expiresAt;
}

/** Applies token exchange/refresh fields onto internal provider config. */
function applyMicrosoftTokenPayload(
  provider: EmailProviderInternalSettings,
  token: MicrosoftGraphTokenResponse
): EmailProviderInternalSettings {
  const expiresInSeconds = Number(token.expires_in ?? 3600);
  const expiresAt = new Date(Date.now() + Math.max(60, expiresInSeconds - 30) * 1000).toISOString();

  return {
    ...provider,
    graphConnected: true,
    graphAccessToken: String(token.access_token ?? provider.graphAccessToken ?? "").trim(),
    graphRefreshToken: String(token.refresh_token ?? provider.graphRefreshToken ?? "").trim(),
    graphTokenType: String(token.token_type ?? provider.graphTokenType ?? "Bearer").trim() || "Bearer",
    graphTokenExpiresAt: expiresAt,
    graphLastConnectedAt: new Date().toISOString(),
  };
}

/** Refreshes Graph access token using persisted refresh token and app credentials. */
async function refreshMicrosoftAccessToken(provider: EmailProviderInternalSettings): Promise<MicrosoftGraphTokenResponse> {
  const params = new URLSearchParams();
  params.set("client_id", provider.microsoftClientId);
  params.set("client_secret", provider.microsoftClientSecret);
  params.set("grant_type", "refresh_token");
  params.set("refresh_token", provider.graphRefreshToken);
  params.set("scope", resolveMicrosoftScopes(provider.microsoftScope));

  const response = await fetch(microsoftTokenEndpoint(provider.microsoftTenantId), {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });

  const rawText = await response.text();
  if (!response.ok) {
    throw new Error(`Microsoft token refresh failed (${response.status}): ${rawText.slice(0, 240)}`);
  }

  return JSON.parse(rawText) as MicrosoftGraphTokenResponse;
}

/** Sends one message through Microsoft Graph sendMail API using OAuth access token. */
async function sendMicrosoftGraphMail(input: {
  provider: EmailProviderInternalSettings;
  toEmail: string;
  subject: string;
  html: string;
  accessToken: string;
}): Promise<void> {
  const mailbox = input.provider.microsoftMailbox.trim();
  const encodedMailbox = mailbox ? encodeURIComponent(mailbox) : "me";
  const endpoint = mailbox
    ? `https://graph.microsoft.com/v1.0/users/${encodedMailbox}/sendMail`
    : "https://graph.microsoft.com/v1.0/me/sendMail";

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.accessToken}`,
    },
    body: JSON.stringify({
      message: {
        subject: input.subject,
        body: {
          contentType: "HTML",
          content: input.html,
        },
        toRecipients: [{ emailAddress: { address: input.toEmail } }],
      },
      saveToSentItems: false,
    }),
  });

  if (!response.ok) {
    const rawText = await response.text();
    throw new Error(`Microsoft Graph sendMail failed (${response.status}): ${rawText.slice(0, 240)}`);
  }
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

   // Decrypt SMTP password if it's encrypted in database
   let dbPass = settings?.smtpPass?.trim() || env.smtpPass;
   if (dbPass && dbPass.includes(":")) {
     try {
       dbPass = decryptCredential(dbPass);
    } catch {
       // If decryption fails, assume it's plaintext (backward compatibility)
       console.warn("SMTP password decryption failed, treating as plaintext");
     }
   }
  return {
    smtpHost: settings?.smtpHost?.trim() || env.smtpHost,
    smtpPort: settings?.smtpPort ?? env.smtpPort,
    smtpSecure: settings?.smtpSecure ?? env.smtpSecure,
    smtpUser: settings?.smtpUser?.trim() || env.smtpUser,
    smtpPass: dbPass,
    smtpFromName: settings?.smtpFromName?.trim() || env.smtpFromName || organization?.name || "OyamaCRM v1.3",
    smtpFromEmail: settings?.smtpFromEmail?.trim() || env.smtpFromEmail,
  };
}

/** Reads per-org outbound provider configuration from plugin settings. */
async function resolveOrganizationEmailProviderSettings(organizationId: string): Promise<EmailProviderInternalSettings> {
  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: EMAIL_PROVIDER_PLUGIN_KEY,
      },
    },
    select: {
      config: true,
    },
  });

  return normalizeEmailProviderInternalSettings(setting?.config ?? {});
}

/** Returns one validation error string when SMTP is incomplete, otherwise null. */
export function getSmtpConfigurationIssue(settings: ResolvedSmtpSettings): string | null {
  if (!settings.smtpHost) return "SMTP host is required.";
  if (!settings.smtpPort) return "SMTP port is required.";
  if (!settings.smtpFromEmail) return "SMTP from email is required.";
  return null;
}

/**
 * Creates one Nodemailer transport for resolved SMTP settings.
 * For Microsoft 365 SMTP (port 587), uses STARTTLS with TLS 1.2+ requirement.
 * For SMTPS (port 465), uses secure: true.
 */
export function createSmtpTransport(settings: ResolvedSmtpSettings) {
  const isMicrosoft365 = settings.smtpHost?.toLowerCase().includes("smtp.office365.com");
  const isPort587 = settings.smtpPort === 587;

  // Microsoft 365 SMTP best practices:
  // - Port 587 (STARTTLS) is preferred for better compatibility
  // - TLS 1.2 or newer required (minVersion constraint)
  // - STARTTLS required for port 587
  // - Authenticated SMTP requires properly configured mailbox in Microsoft 365 Admin Center
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const config: Record<string, any> = {
    host: settings.smtpHost ?? undefined,
    port: settings.smtpPort ?? undefined,
    secure: settings.smtpSecure, // false for port 587 (STARTTLS), true for port 465 (implicit TLS)
    auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPass ?? "" } : undefined,
  };

  // Add TLS requirements for Microsoft 365 or when port 587 is used
  if (isMicrosoft365 || isPort587) {
    config.requireTLS = true; // Enforce TLS 1.2+
    config.tls = {
      minVersion: "TLSv1.2", // Microsoft 365 requires TLS 1.2 or newer
    };
  }

  return nodemailer.createTransport(config);
}

/** Resolves effective SMTP settings after provider-level overrides are applied. */
function resolveProviderSmtpSettings(base: ResolvedSmtpSettings, provider: EmailProviderInternalSettings): ResolvedSmtpSettings {
  if (provider.provider !== "microsoft_365_smtp") {
    return {
      ...base,
      smtpHost: provider.smtpHostOverride.trim() || base.smtpHost,
      smtpPort: provider.smtpHostOverride.trim() ? provider.smtpPortOverride : base.smtpPort,
      smtpSecure: provider.smtpHostOverride.trim() ? provider.smtpSecureOverride : base.smtpSecure,
    };
  }

  // Microsoft 365 SMTP defaults: smtp.office365.com:587 with STARTTLS (secure: false)
  // Port 587 is recommended by Microsoft for best compatibility
  // requireTLS and minVersion TLSv1.2 are enforced in createSmtpTransport()
  return {
    ...base,
    smtpHost: provider.smtpHostOverride.trim() || "smtp.office365.com",
    smtpPort: provider.smtpPortOverride || 587,
    smtpSecure: provider.smtpSecureOverride || false, // false for STARTTLS on port 587
  };
}

/** Creates one reusable outbound sender that respects selected email provider settings. */
export async function createOrganizationEmailSender(organizationId: string): Promise<OrganizationEmailSender> {
  const [smtpSettings, provider] = await Promise.all([
    resolveOrganizationSmtpSettings(organizationId),
    resolveOrganizationEmailProviderSettings(organizationId),
  ]);

  if (provider.provider === "microsoft_graph") {
    if (!provider.graphConnected || !provider.graphRefreshToken || !provider.microsoftClientId || !provider.microsoftClientSecret) {
      throw new Error("EMAIL_PROVIDER_NOT_READY: Microsoft Graph is selected but OAuth is not fully connected.");
    }

    let activeProvider = provider;
    if (shouldRefreshMicrosoftToken(activeProvider.graphTokenExpiresAt)) {
      const refreshedToken = await refreshMicrosoftAccessToken(activeProvider);
      activeProvider = applyMicrosoftTokenPayload(activeProvider, refreshedToken);

      await prisma.pluginSetting.update({
        where: {
          organizationId_pluginKey: {
            organizationId,
            pluginKey: EMAIL_PROVIDER_PLUGIN_KEY,
          },
        },
        data: {
          config: activeProvider as unknown as Prisma.InputJsonValue,
        },
      });
    }

    return {
      mode: "microsoft_graph",
      async send(payload: SendEmailPayload): Promise<OrganizationSendResult> {
        const html = payload.html ?? `<p>${payload.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`;
        await sendMicrosoftGraphMail({
          provider: activeProvider,
          toEmail: payload.to,
          subject: payload.subject,
          html,
          accessToken: activeProvider.graphAccessToken,
        });

        return {
          acceptedAt: new Date(),
          providerResponse: "Microsoft Graph accepted message (202).",
          providerMessageId: null,
        };
      },
    };
  }

  const effectiveSmtp = resolveProviderSmtpSettings(smtpSettings, provider);
  const issue = getSmtpConfigurationIssue(effectiveSmtp);
  if (issue) {
    throw new Error(`SMTP_NOT_CONFIGURED: ${issue}`);
  }

  const transporter = createSmtpTransport(effectiveSmtp);
  await transporter.verify();

  return {
    mode: provider.provider,
    async send(payload: SendEmailPayload): Promise<OrganizationSendResult> {
      const info = await transporter.sendMail({
        from: `"${payload.fromNameOverride || effectiveSmtp.smtpFromName || "OyamaCRM v1.3"}" <${effectiveSmtp.smtpFromEmail}>`,
        to: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html ?? `<p>${payload.text.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</p>`,
      });

      const providerResponse = typeof info.response === "string" && info.response.trim()
        ? info.response.trim()
        : "SMTP accepted message.";
      const providerMessageId = typeof info.messageId === "string" && info.messageId.trim()
        ? info.messageId.trim()
        : null;

      return {
        acceptedAt: new Date(),
        providerResponse,
        providerMessageId,
      };
    },
  };
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
  const sender = await createOrganizationEmailSender(input.organizationId);
  await sender.send({
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
    fromNameOverride: input.fromNameOverride,
  });
}
