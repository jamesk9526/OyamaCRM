/**
 * Payment gateway settings service.
 * Persists Stripe and PayPal configuration in PluginSetting JSON with encrypted secrets.
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { decryptCredential, encryptCredential, isCredentialEncrypted } from "./credential-encryption.js";

export const PAYMENTS_PLUGIN_KEY = "payments_gateway";

export type GatewayMode = "sandbox" | "production";

export interface StripeCredentialSetConfig {
  publishableKey: string;
  secretKeyEncrypted: string;
  webhookSecretEncrypted: string;
}

export interface StripeGatewayConfig {
  enabled: boolean;
  mode: GatewayMode;
  environments: Record<GatewayMode, StripeCredentialSetConfig>;
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
    environments: Record<GatewayMode, {
      publishableKey: string;
      hasSecretKey: boolean;
      hasWebhookSecret: boolean;
    }>;
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
    environments: Record<GatewayMode, {
      publishableKey: string;
      secretKey: string;
      webhookSecret: string;
    }>;
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
    version: 2,
    currency: "USD",
    stripe: {
      enabled: false,
      mode: "sandbox",
      environments: {
        sandbox: { publishableKey: "", secretKeyEncrypted: "", webhookSecretEncrypted: "" },
        production: { publishableKey: "", secretKeyEncrypted: "", webhookSecretEncrypted: "" },
      },
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

export function normalizeStoredPaymentGatewayConfig(raw: unknown): PaymentGatewayConfig {
  const defaults = defaultConfig();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const input = raw as Record<string, unknown>;
  const stripe = (input.stripe ?? {}) as Record<string, unknown>;
  const paypal = (input.paypal ?? {}) as Record<string, unknown>;
  const stripeMode = normalizeMode(stripe.mode);
  const storedEnvironments = (stripe.environments ?? {}) as Record<string, unknown>;
  const normalizeStripeEnvironment = (mode: GatewayMode): StripeCredentialSetConfig => {
    const environment = (storedEnvironments[mode] ?? {}) as Record<string, unknown>;
    const isLegacyActiveEnvironment = !stripe.environments && mode === stripeMode;
    return {
      publishableKey: String(environment.publishableKey ?? (isLegacyActiveEnvironment ? stripe.publishableKey : "") ?? "").trim(),
      secretKeyEncrypted: String(environment.secretKeyEncrypted ?? (isLegacyActiveEnvironment ? stripe.secretKeyEncrypted : "") ?? "").trim(),
      webhookSecretEncrypted: String(environment.webhookSecretEncrypted ?? (isLegacyActiveEnvironment ? stripe.webhookSecretEncrypted : "") ?? "").trim(),
    };
  };

  return {
    version: 2,
    currency: normalizeCurrency(input.currency),
    stripe: {
      enabled: typeof stripe.enabled === "boolean" ? stripe.enabled : defaults.stripe.enabled,
      mode: stripeMode,
      environments: {
        sandbox: normalizeStripeEnvironment("sandbox"),
        production: normalizeStripeEnvironment("production"),
      },
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
  return normalizeStoredPaymentGatewayConfig(row?.config);
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
  const stripeEnvironments = {
    sandbox: {
      publishableKey: config.stripe.environments.sandbox.publishableKey,
      secretKey: decryptValue(config.stripe.environments.sandbox.secretKeyEncrypted),
      webhookSecret: decryptValue(config.stripe.environments.sandbox.webhookSecretEncrypted),
    },
    production: {
      publishableKey: config.stripe.environments.production.publishableKey,
      secretKey: decryptValue(config.stripe.environments.production.secretKeyEncrypted),
      webhookSecret: decryptValue(config.stripe.environments.production.webhookSecretEncrypted),
    },
  };
  const activeStripe = stripeEnvironments[config.stripe.mode];

  return {
    currency: config.currency,
    stripe: {
      enabled: config.stripe.enabled,
      mode: config.stripe.mode,
      ...activeStripe,
      environments: stripeEnvironments,
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
  const stripeEnvironments = {
    sandbox: {
      publishableKey: config.stripe.environments.sandbox.publishableKey,
      hasSecretKey: Boolean(decryptValue(config.stripe.environments.sandbox.secretKeyEncrypted)),
      hasWebhookSecret: Boolean(decryptValue(config.stripe.environments.sandbox.webhookSecretEncrypted)),
    },
    production: {
      publishableKey: config.stripe.environments.production.publishableKey,
      hasSecretKey: Boolean(decryptValue(config.stripe.environments.production.secretKeyEncrypted)),
      hasWebhookSecret: Boolean(decryptValue(config.stripe.environments.production.webhookSecretEncrypted)),
    },
  };
  const activeStripe = stripeEnvironments[config.stripe.mode];

  return {
    currency: config.currency,
    stripe: {
      enabled: config.stripe.enabled,
      mode: config.stripe.mode,
      ...activeStripe,
      environments: stripeEnvironments,
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
    clearCredentials?: boolean;
    clearAllCredentials?: boolean;
    environments?: Partial<Record<GatewayMode, {
      publishableKey?: string;
      secretKey?: string;
      webhookSecret?: string;
      clearCredentials?: boolean;
    }>>;
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
  const stripeMode = input.stripe?.mode ? normalizeMode(input.stripe.mode) : current.stripe.mode;
  const buildNextStripeEnvironment = (mode: GatewayMode): StripeCredentialSetConfig => {
    const currentEnvironment = current.stripe.environments[mode];
    const environmentInput = input.stripe?.environments?.[mode];
    const isLegacyTarget = mode === stripeMode;
    const environmentSecret = typeof environmentInput?.secretKey === "string" ? environmentInput.secretKey.trim() : isLegacyTarget ? stripeSecret : "";
    const environmentWebhookSecret = typeof environmentInput?.webhookSecret === "string" ? environmentInput.webhookSecret.trim() : isLegacyTarget ? stripeWebhookSecret : "";
    const clearEnvironment = environmentInput?.clearCredentials === true || (isLegacyTarget && input.stripe?.clearCredentials === true);
    return {
      publishableKey: typeof environmentInput?.publishableKey === "string"
        ? environmentInput.publishableKey.trim()
        : isLegacyTarget && typeof input.stripe?.publishableKey === "string"
          ? input.stripe.publishableKey.trim()
          : currentEnvironment.publishableKey,
      secretKeyEncrypted: environmentSecret ? encryptCredential(environmentSecret) : clearEnvironment ? "" : currentEnvironment.secretKeyEncrypted,
      webhookSecretEncrypted: environmentWebhookSecret ? encryptCredential(environmentWebhookSecret) : clearEnvironment ? "" : currentEnvironment.webhookSecretEncrypted,
    };
  };
  const clearedEnvironment: StripeCredentialSetConfig = { publishableKey: "", secretKeyEncrypted: "", webhookSecretEncrypted: "" };

  const next: PaymentGatewayConfig = {
    version: 2,
    currency: input.currency ? normalizeCurrency(input.currency) : current.currency,
    stripe: {
      enabled: typeof input.stripe?.enabled === "boolean" ? input.stripe.enabled : current.stripe.enabled,
      mode: stripeMode,
      environments: input.stripe?.clearAllCredentials
        ? { sandbox: clearedEnvironment, production: clearedEnvironment }
        : {
          sandbox: buildNextStripeEnvironment("sandbox"),
          production: buildNextStripeEnvironment("production"),
        },
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
