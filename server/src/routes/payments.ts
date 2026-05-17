/**
 * Payments settings and diagnostics routes.
 * DonorCRM-only admin APIs for Stripe and PayPal gateway configuration.
 */
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
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

    const stripeReady = settings.stripe.enabled
      && Boolean(settings.stripe.publishableKey)
      && Boolean(runtime.stripe.secretKey);
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
        paypalReady,
        currency: settings.currency,
        activeProvider: stripeReady ? "stripe" : paypalReady ? "paypal" : null,
        issues,
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

export default router;
