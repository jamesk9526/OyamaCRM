/**
 * Payment gateway settings service.
 * Persists Stripe and PayPal configuration in PluginSetting JSON with encrypted secrets.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { decryptCredential, encryptCredential, isCredentialEncrypted } from "./credential-encryption.js";

export const PAYMENTS_PLUGIN_KEY = "payments_gateway";

export type GatewayMode = "sandbox" | "production";

export interface StripeGatewayConfig {
  enabled: boolean;
  mode: GatewayMode;
  publishableKey: string;
  secretKeyEncrypted: string;
  webhookSecretEncrypted: string;
}

export interface PayPalGatewayConfig {
  enabled: boolean;
  mode: GatewayMode;
  clientId: string;
  clientSecretEncrypted: string;
  webhookId: string;
}

export interface PaymentGatewayConfig {
  version: number;
  currency: string;
  stripe: StripeGatewayConfig;
  paypal: PayPalGatewayConfig;
}

export interface PaymentGatewayPublicSettings {
  currency: string;
  stripe: {
    enabled: boolean;
    mode: GatewayMode;
    publishableKey: string;
    hasSecretKey: boolean;
    hasWebhookSecret: boolean;
  };
  paypal: {
    enabled: boolean;
    mode: GatewayMode;
    clientId: string;
    hasClientSecret: boolean;
    webhookId: string;
  };
}

export interface PaymentGatewayRuntimeConfig {
  currency: string;
  stripe: {
    enabled: boolean;
    mode: GatewayMode;
    publishableKey: string;
    secretKey: string;
    webhookSecret: string;
  };
  paypal: {
    enabled: boolean;
    mode: GatewayMode;
    clientId: string;
    clientSecret: string;
    webhookId: string;
  };
}

function defaultConfig(): PaymentGatewayConfig {
  return {
    version: 1,
    currency: "USD",
    stripe: {
      enabled: false,
      mode: "sandbox",
      publishableKey: "",
      secretKeyEncrypted: "",
      webhookSecretEncrypted: "",
    },
    paypal: {
      enabled: false,
      mode: "sandbox",
      clientId: "",
      clientSecretEncrypted: "",
      webhookId: "",
    },
  };
}

function normalizeMode(value: unknown): GatewayMode {
  return value === "production" ? "production" : "sandbox";
}

function normalizeCurrency(value: unknown): string {
  const normalized = String(value ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return "USD";
  return normalized;
}

function normalizeStoredConfig(raw: unknown): PaymentGatewayConfig {
  const defaults = defaultConfig();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const input = raw as Record<string, unknown>;
  const stripe = (input.stripe ?? {}) as Record<string, unknown>;
  const paypal = (input.paypal ?? {}) as Record<string, unknown>;

  return {
    version: Number.isFinite(Number(input.version)) ? Number(input.version) : defaults.version,
    currency: normalizeCurrency(input.currency),
    stripe: {
      enabled: typeof stripe.enabled === "boolean" ? stripe.enabled : defaults.stripe.enabled,
      mode: normalizeMode(stripe.mode),
      publishableKey: String(stripe.publishableKey ?? "").trim(),
      secretKeyEncrypted: String(stripe.secretKeyEncrypted ?? "").trim(),
      webhookSecretEncrypted: String(stripe.webhookSecretEncrypted ?? "").trim(),
    },
    paypal: {
      enabled: typeof paypal.enabled === "boolean" ? paypal.enabled : defaults.paypal.enabled,
      mode: normalizeMode(paypal.mode),
      clientId: String(paypal.clientId ?? "").trim(),
      clientSecretEncrypted: String(paypal.clientSecretEncrypted ?? "").trim(),
      webhookId: String(paypal.webhookId ?? "").trim(),
    },
  };
}

async function getSettingsRow(organizationId: string) {
  return prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: PAYMENTS_PLUGIN_KEY,
      },
    },
  });
}

export async function readPaymentGatewayConfig(organizationId: string): Promise<PaymentGatewayConfig> {
  const row = await getSettingsRow(organizationId);
  return normalizeStoredConfig(row?.config);
}

function decryptValue(value: string): string {
  if (!value.trim()) return "";
  if (!isCredentialEncrypted(value)) return value;
  try {
    return decryptCredential(value);
  } catch {
    return "";
  }
}

export async function readPaymentGatewayRuntimeConfig(organizationId: string): Promise<PaymentGatewayRuntimeConfig> {
  const config = await readPaymentGatewayConfig(organizationId);

  return {
    currency: config.currency,
    stripe: {
      enabled: config.stripe.enabled,
      mode: config.stripe.mode,
      publishableKey: config.stripe.publishableKey,
      secretKey: decryptValue(config.stripe.secretKeyEncrypted),
      webhookSecret: decryptValue(config.stripe.webhookSecretEncrypted),
    },
    paypal: {
      enabled: config.paypal.enabled,
      mode: config.paypal.mode,
      clientId: config.paypal.clientId,
      clientSecret: decryptValue(config.paypal.clientSecretEncrypted),
      webhookId: config.paypal.webhookId,
    },
  };
}

export async function readPaymentGatewayPublicSettings(organizationId: string): Promise<PaymentGatewayPublicSettings> {
  const config = await readPaymentGatewayConfig(organizationId);

  return {
    currency: config.currency,
    stripe: {
      enabled: config.stripe.enabled,
      mode: config.stripe.mode,
      publishableKey: config.stripe.publishableKey,
      hasSecretKey: Boolean(decryptValue(config.stripe.secretKeyEncrypted)),
      hasWebhookSecret: Boolean(decryptValue(config.stripe.webhookSecretEncrypted)),
    },
    paypal: {
      enabled: config.paypal.enabled,
      mode: config.paypal.mode,
      clientId: config.paypal.clientId,
      hasClientSecret: Boolean(decryptValue(config.paypal.clientSecretEncrypted)),
      webhookId: config.paypal.webhookId,
    },
  };
}

export interface PaymentGatewaySettingsUpdateInput {
  currency?: string;
  stripe?: {
    enabled?: boolean;
    mode?: GatewayMode;
    publishableKey?: string;
    secretKey?: string;
    webhookSecret?: string;
  };
  paypal?: {
    enabled?: boolean;
    mode?: GatewayMode;
    clientId?: string;
    clientSecret?: string;
    webhookId?: string;
  };
}

export async function savePaymentGatewaySettings(
  organizationId: string,
  input: PaymentGatewaySettingsUpdateInput,
): Promise<PaymentGatewayPublicSettings> {
  const current = await readPaymentGatewayConfig(organizationId);

  const stripeSecret = typeof input.stripe?.secretKey === "string"
    ? input.stripe.secretKey.trim()
    : "";
  const stripeWebhookSecret = typeof input.stripe?.webhookSecret === "string"
    ? input.stripe.webhookSecret.trim()
    : "";
  const paypalClientSecret = typeof input.paypal?.clientSecret === "string"
    ? input.paypal.clientSecret.trim()
    : "";

  const next: PaymentGatewayConfig = {
    version: 1,
    currency: input.currency ? normalizeCurrency(input.currency) : current.currency,
    stripe: {
      enabled: typeof input.stripe?.enabled === "boolean" ? input.stripe.enabled : current.stripe.enabled,
      mode: input.stripe?.mode ? normalizeMode(input.stripe.mode) : current.stripe.mode,
      publishableKey: typeof input.stripe?.publishableKey === "string"
        ? input.stripe.publishableKey.trim()
        : current.stripe.publishableKey,
      secretKeyEncrypted: stripeSecret
        ? encryptCredential(stripeSecret)
        : current.stripe.secretKeyEncrypted,
      webhookSecretEncrypted: stripeWebhookSecret
        ? encryptCredential(stripeWebhookSecret)
        : current.stripe.webhookSecretEncrypted,
    },
    paypal: {
      enabled: typeof input.paypal?.enabled === "boolean" ? input.paypal.enabled : current.paypal.enabled,
      mode: input.paypal?.mode ? normalizeMode(input.paypal.mode) : current.paypal.mode,
      clientId: typeof input.paypal?.clientId === "string"
        ? input.paypal.clientId.trim()
        : current.paypal.clientId,
      clientSecretEncrypted: paypalClientSecret
        ? encryptCredential(paypalClientSecret)
        : current.paypal.clientSecretEncrypted,
      webhookId: typeof input.paypal?.webhookId === "string"
        ? input.paypal.webhookId.trim()
        : current.paypal.webhookId,
    },
  };

  await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: PAYMENTS_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: PAYMENTS_PLUGIN_KEY,
      enabled: next.stripe.enabled || next.paypal.enabled,
      config: next as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled: next.stripe.enabled || next.paypal.enabled,
      config: next as unknown as Prisma.InputJsonValue,
    },
  });

  return readPaymentGatewayPublicSettings(organizationId);
}
