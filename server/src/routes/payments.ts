/**
 * Payments settings and diagnostics routes.
 * DonorCRM-only admin APIs for Stripe and PayPal gateway configuration.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { prisma } from "../lib/prisma.js";
import {
  readPaymentGatewayPublicSettings,
  readPaymentGatewayRuntimeConfig,
  savePaymentGatewaySettings,
  type GatewayMode,
} from "../services/payment-gateway-settings.js";

const router = Router();

router.use(requireAuth);

async function resolveOrg(req: import("express").Request): Promise<string> {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    throw new Error("Could not determine organization");
  }
  return organizationId;
}

function sanitizeMode(value: unknown): GatewayMode {
  return value === "production" ? "production" : "sandbox";
}

function sanitizeCurrency(value: unknown): string {
  const normalized = String(value ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) return "USD";
  return normalized;
}

function expectedStripePrefix(mode: GatewayMode, kind: "publishable" | "secret"): string {
  return `${kind === "publishable" ? "pk" : "sk"}_${mode === "production" ? "live" : "test"}_`;
}

function resolveWebhookUrl(req: import("express").Request): string {
  const explicit = String(process.env.NEXT_PUBLIC_API_URL ?? "").trim().replace(/\/$/, "");
  const baseUrl = explicit || `${req.protocol || "http"}://${req.get("host") || "localhost:4000"}`;
  return `${baseUrl}/api/site-embeds/public/stripe-webhook`;
}

/**
 * GET /api/payments/settings
 * Returns non-secret payment gateway settings for the current organization.
 */
router.get("/settings", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const settings = await readPaymentGatewayPublicSettings(organizationId);
    return res.json({ data: settings });
  } catch (error) {
    console.error("[Payments] settings GET failed:", error);
    return res.status(500).json({
      error: {
        code: "PAYMENTS_SETTINGS_READ_FAILED",
        message: "Failed to load payment settings.",
      },
    });
  }
});

/**
 * PUT /api/payments/settings
 * Persists Stripe/PayPal gateway settings with encrypted secret storage.
 */
router.put("/settings", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const stripeBody = (body.stripe ?? {}) as Record<string, unknown>;
    const stripeMode = typeof stripeBody.mode === "string" ? sanitizeMode(stripeBody.mode) : undefined;
    const publishableKey = typeof stripeBody.publishableKey === "string" ? String(stripeBody.publishableKey).trim() : undefined;
    const secretKey = typeof stripeBody.secretKey === "string" ? String(stripeBody.secretKey).trim() : undefined;

    if (stripeMode && publishableKey && !publishableKey.startsWith(expectedStripePrefix(stripeMode, "publishable"))) {
      return res.status(400).json({ error: { code: "STRIPE_MODE_MISMATCH", message: `Stripe ${stripeMode} mode requires a ${expectedStripePrefix(stripeMode, "publishable")} publishable key.` } });
    }
    if (stripeMode && secretKey && !secretKey.startsWith(expectedStripePrefix(stripeMode, "secret"))) {
      return res.status(400).json({ error: { code: "STRIPE_MODE_MISMATCH", message: `Stripe ${stripeMode} mode requires a ${expectedStripePrefix(stripeMode, "secret")} secret key.` } });
    }

    const updated = await savePaymentGatewaySettings(organizationId, {
      currency: sanitizeCurrency(body.currency),
      stripe: {
        enabled: typeof (body.stripe as Record<string, unknown> | undefined)?.enabled === "boolean"
          ? Boolean((body.stripe as Record<string, unknown>).enabled)
          : undefined,
        mode: typeof (body.stripe as Record<string, unknown> | undefined)?.mode === "string"
          ? sanitizeMode((body.stripe as Record<string, unknown>).mode)
          : undefined,
        publishableKey: typeof (body.stripe as Record<string, unknown> | undefined)?.publishableKey === "string"
          ? String((body.stripe as Record<string, unknown>).publishableKey)
          : undefined,
        secretKey: typeof (body.stripe as Record<string, unknown> | undefined)?.secretKey === "string"
          ? String((body.stripe as Record<string, unknown>).secretKey)
          : undefined,
        webhookSecret: typeof (body.stripe as Record<string, unknown> | undefined)?.webhookSecret === "string"
          ? String((body.stripe as Record<string, unknown>).webhookSecret)
          : undefined,
        clearCredentials: (body.stripe as Record<string, unknown> | undefined)?.clearCredentials === true,
      },
      paypal: {
        enabled: typeof (body.paypal as Record<string, unknown> | undefined)?.enabled === "boolean"
          ? Boolean((body.paypal as Record<string, unknown>).enabled)
          : undefined,
        mode: typeof (body.paypal as Record<string, unknown> | undefined)?.mode === "string"
          ? sanitizeMode((body.paypal as Record<string, unknown>).mode)
          : undefined,
        clientId: typeof (body.paypal as Record<string, unknown> | undefined)?.clientId === "string"
          ? String((body.paypal as Record<string, unknown>).clientId)
          : undefined,
        clientSecret: typeof (body.paypal as Record<string, unknown> | undefined)?.clientSecret === "string"
          ? String((body.paypal as Record<string, unknown>).clientSecret)
          : undefined,
        webhookId: typeof (body.paypal as Record<string, unknown> | undefined)?.webhookId === "string"
          ? String((body.paypal as Record<string, unknown>).webhookId)
          : undefined,
      },
    });

    await logAudit({
      action: "PAYMENTS_SETTINGS_UPDATED",
      entity: "PluginSetting",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        stripeEnabled: updated.stripe.enabled,
        stripeMode: updated.stripe.mode,
        paypalEnabled: updated.paypal.enabled,
        paypalMode: updated.paypal.mode,
        currency: updated.currency,
      },
    });

    return res.json({ data: updated });
  } catch (error) {
    console.error("[Payments] settings PUT failed:", error);
    return res.status(500).json({
      error: {
        code: "PAYMENTS_SETTINGS_SAVE_FAILED",
        message: "Failed to save payment settings.",
      },
    });
  }
});

/**
 * GET /api/payments/health
 * Returns gateway readiness diagnostics for admin troubleshooting.
 */
router.get("/health", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const settings = await readPaymentGatewayPublicSettings(organizationId);
    const runtime = await readPaymentGatewayRuntimeConfig(organizationId);

    const stripeCheckoutReady = settings.stripe.enabled
      && Boolean(settings.stripe.publishableKey)
      && Boolean(runtime.stripe.secretKey);
    const stripeWebhookReady = stripeCheckoutReady && Boolean(runtime.stripe.webhookSecret);
    const stripeReady = stripeCheckoutReady && stripeWebhookReady;
    const paypalReady = settings.paypal.enabled
      && Boolean(settings.paypal.clientId)
      && Boolean(runtime.paypal.clientSecret);

    const issues: string[] = [];
    if (settings.stripe.enabled && !settings.stripe.publishableKey) {
      issues.push("Stripe is enabled but publishable key is missing.");
    }
    if (settings.stripe.enabled && !runtime.stripe.secretKey) {
      issues.push("Stripe is enabled but secret key is missing.");
    }
    if (settings.stripe.enabled && !runtime.stripe.webhookSecret) {
      issues.push("Stripe checkout cannot automatically record donations until the webhook signing secret is configured.");
    }
    if (settings.stripe.publishableKey && !settings.stripe.publishableKey.startsWith(expectedStripePrefix(settings.stripe.mode, "publishable"))) {
      issues.push(`Stripe publishable key does not match ${settings.stripe.mode} mode.`);
    }
    if (runtime.stripe.secretKey && !runtime.stripe.secretKey.startsWith(expectedStripePrefix(settings.stripe.mode, "secret"))) {
      issues.push(`Stripe secret key does not match ${settings.stripe.mode} mode.`);
    }
    if (settings.paypal.enabled && !settings.paypal.clientId) {
      issues.push("PayPal is enabled but client ID is missing.");
    }
    if (settings.paypal.enabled && !runtime.paypal.clientSecret) {
      issues.push("PayPal is enabled but client secret is missing.");
    }
    if (!settings.stripe.enabled && !settings.paypal.enabled) {
      issues.push("No payment provider is enabled.");
    }

    return res.json({
      data: {
        stripeReady,
        stripeCheckoutReady,
        stripeWebhookReady,
        paypalReady,
        currency: settings.currency,
        activeProvider: stripeReady ? "stripe" : paypalReady ? "paypal" : null,
        issues,
        webhookUrl: resolveWebhookUrl(req),
      },
    });
  } catch (error) {
    console.error("[Payments] health GET failed:", error);
    return res.status(500).json({
      error: {
        code: "PAYMENTS_HEALTH_FAILED",
        message: "Failed to read payment health diagnostics.",
      },
    });
  }
});

/**
 * POST /api/payments/stripe/test
 * Validates the saved secret against Stripe and returns public account diagnostics.
 */
router.post("/stripe/test", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const runtime = await readPaymentGatewayRuntimeConfig(organizationId);
    if (!runtime.stripe.enabled || !runtime.stripe.secretKey) {
      return res.status(409).json({ error: { code: "STRIPE_NOT_CONFIGURED", message: "Save and enable Stripe before testing the connection." } });
    }

    const response = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${runtime.stripe.secretKey}` },
    });
    const payload = await response.json().catch(() => ({})) as {
      id?: string;
      business_profile?: { name?: string };
      charges_enabled?: boolean;
      payouts_enabled?: boolean;
      country?: string;
      default_currency?: string;
      error?: { message?: string };
    };
    if (!response.ok) {
      return res.status(502).json({ error: { code: "STRIPE_CONNECTION_FAILED", message: payload.error?.message ?? "Stripe rejected the saved credentials." } });
    }

    await logAudit({
      action: "STRIPE_CONNECTION_TESTED",
      entity: "PluginSetting",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: { accountId: payload.id, chargesEnabled: payload.charges_enabled, mode: runtime.stripe.mode },
    });

    return res.json({
      data: {
        connected: true,
        accountId: payload.id ?? "",
        displayName: payload.business_profile?.name ?? "",
        chargesEnabled: Boolean(payload.charges_enabled),
        payoutsEnabled: Boolean(payload.payouts_enabled),
        country: payload.country ?? "",
        defaultCurrency: String(payload.default_currency ?? runtime.currency).toUpperCase(),
        webhookUrl: resolveWebhookUrl(req),
      },
    });
  } catch (error) {
    console.error("[Payments] Stripe connection test failed:", error);
    return res.status(502).json({ error: { code: "STRIPE_CONNECTION_FAILED", message: "Could not reach Stripe. Try again shortly." } });
  }
});

/** GET /api/payments/stripe/events - recent verified webhook processing diagnostics. */
router.get("/stripe/events", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const rows = await prisma.paymentWebhookEvent.findMany({
      where: { organizationId, provider: "stripe" },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        externalEventId: true,
        eventType: true,
        status: true,
        donationId: true,
        errorMessage: true,
        processedAt: true,
        createdAt: true,
      },
    });
    return res.json({ data: { items: rows } });
  } catch (error) {
    console.error("[Payments] Stripe event diagnostics failed:", error);
    return res.status(500).json({ error: { code: "STRIPE_EVENTS_FAILED", message: "Failed to load Stripe webhook activity." } });
  }
});

export default router;
