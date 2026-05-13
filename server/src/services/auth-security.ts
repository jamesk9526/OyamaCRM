/** Auth security settings helpers for password reset and email-based MFA policy. */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";

const AUTH_SECURITY_PLUGIN_KEY = "auth-security-settings";

export interface AuthSecuritySettings {
  [key: string]: unknown;
  emailMfaEnabled: boolean;
  passwordResetEnabled: boolean;
  mfaCodeTtlMinutes: number;
  passwordResetTtlMinutes: number;
}

/** Returns default auth security policy with optional env override for MFA enablement. */
export function getDefaultAuthSecuritySettings(): AuthSecuritySettings {
  const envMfaRequired = /^(1|true|yes|on)$/i.test((process.env.AUTH_EMAIL_MFA_REQUIRED ?? "").trim());
  return {
    emailMfaEnabled: envMfaRequired,
    passwordResetEnabled: true,
    mfaCodeTtlMinutes: 10,
    passwordResetTtlMinutes: 30,
  };
}

/** Normalizes unknown settings payloads into safe persisted values. */
export function normalizeAuthSecuritySettings(input: unknown): AuthSecuritySettings {
  const defaults = getDefaultAuthSecuritySettings();
  const raw = input && typeof input === "object" && !Array.isArray(input)
    ? (input as Record<string, unknown>)
    : {};

  const toInt = (value: unknown, fallback: number, min: number, max: number): number => {
    const parsed = Number.parseInt(String(value ?? ""), 10);
    if (!Number.isFinite(parsed)) return fallback;
    return Math.min(max, Math.max(min, parsed));
  };

  return {
    emailMfaEnabled: typeof raw.emailMfaEnabled === "boolean" ? raw.emailMfaEnabled : defaults.emailMfaEnabled,
    passwordResetEnabled: typeof raw.passwordResetEnabled === "boolean" ? raw.passwordResetEnabled : defaults.passwordResetEnabled,
    mfaCodeTtlMinutes: toInt(raw.mfaCodeTtlMinutes, defaults.mfaCodeTtlMinutes, 3, 30),
    passwordResetTtlMinutes: toInt(raw.passwordResetTtlMinutes, defaults.passwordResetTtlMinutes, 10, 120),
  };
}

/** Loads merged auth security settings for one organization. */
export async function getAuthSecuritySettingsForOrganization(organizationId: string): Promise<AuthSecuritySettings> {
  const row = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: AUTH_SECURITY_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  return normalizeAuthSecuritySettings(row?.config);
}

/** Upserts auth security settings for one organization and returns normalized state. */
export async function saveAuthSecuritySettingsForOrganization(
  organizationId: string,
  input: unknown,
): Promise<AuthSecuritySettings> {
  const normalized = normalizeAuthSecuritySettings(input);

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: AUTH_SECURITY_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: AUTH_SECURITY_PLUGIN_KEY,
      enabled: true,
      config: normalized as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: true,
      config: normalized as unknown as Prisma.InputJsonValue,
    },
  });

  return normalized;
}
