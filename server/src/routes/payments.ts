/**
 * Payments settings and diagnostics routes.
 * DonorCRM-only admin APIs for Stripe and PayPal gateway configuration.
 */
import { Router } from "express";
import { normalizePublicApiRootUrl } from "../lib/public-api-url.js";
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

function stripeKeyMatchesMode(value: string, mode: GatewayMode, kind: "publishable" | "secret"): boolean {
  if (kind === "publishable") return value.startsWith(expectedStripePrefix(mode, kind));
  const environment = mode === "production" ? "live" : "test";
  return value.startsWith(`sk_${environment}_`) || value.startsWith(`rk_${environment}_`);
}

function resolveWebhookUrl(req: import("express").Request): string {
  const explicit = normalizePublicApiRootUrl(process.env.NEXT_PUBLIC_API_URL);
  const baseUrl = explicit || normalizePublicApiRootUrl(`${req.protocol || "http"}://${req.get("host") || "localhost:4000"}`);
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
    const stripeEnvironmentsBody = (stripeBody.environments ?? {}) as Record<string, unknown>;

    for (const mode of ["sandbox", "production"] as const) {
      const environment = (stripeEnvironmentsBody[mode] ?? {}) as Record<string, unknown>;
      const environmentPublishableKey = typeof environment.publishableKey === "string" ? environment.publishableKey.trim() : "";
      const environmentSecretKey = typeof environment.secretKey === "string" ? environment.secretKey.trim() : "";
      if (environmentPublishableKey && !stripeKeyMatchesMode(environmentPublishableKey, mode, "publishable")) {
        return res.status(400).json({ error: { code: "STRIPE_MODE_MISMATCH", message: `Stripe ${mode} credentials require a ${expectedStripePrefix(mode, "publishable")} publishable key.` } });
      }
      if (environmentSecretKey && !stripeKeyMatchesMode(environmentSecretKey, mode, "secret")) {
        const environmentName = mode === "production" ? "live" : "test";
        return res.status(400).json({ error: { code: "STRIPE_MODE_MISMATCH", message: `Stripe ${mode} credentials require an sk_${environmentName}_ or rk_${environmentName}_ server key.` } });
      }
    }

    if (stripeMode && publishableKey && !stripeKeyMatchesMode(publishableKey, stripeMode, "publishable")) {
      return res.status(400).json({ error: { code: "STRIPE_MODE_MISMATCH", message: `Stripe ${stripeMode} mode requires a ${expectedStripePrefix(stripeMode, "publishable")} publishable key.` } });
    }
    if (stripeMode && secretKey && !stripeKeyMatchesMode(secretKey, stripeMode, "secret")) {
      const environment = stripeMode === "production" ? "live" : "test";
      return res.status(400).json({ error: { code: "STRIPE_MODE_MISMATCH", message: `Stripe ${stripeMode} mode requires an sk_${environment}_ or rk_${environment}_ server key.` } });
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
        clearAllCredentials: (body.stripe as Record<string, unknown> | undefined)?.clearAllCredentials === true,
        environments: Object.fromEntries((["sandbox", "production"] as const).map((mode) => {
          const environment = (stripeEnvironmentsBody[mode] ?? {}) as Record<string, unknown>;
          return [mode, {
            publishableKey: typeof environment.publishableKey === "string" ? String(environment.publishableKey) : undefined,
            secretKey: typeof environment.secretKey === "string" ? String(environment.secretKey) : undefined,
            webhookSecret: typeof environment.webhookSecret === "string" ? String(environment.webhookSecret) : undefined,
            clearCredentials: environment.clearCredentials === true,
          }];
        })) as Partial<Record<GatewayMode, { publishableKey?: string; secretKey?: string; webhookSecret?: string; clearCredentials?: boolean }>>,
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
    const stripeEnvironments = {
      sandbox: {
        checkoutReady: Boolean(settings.stripe.environments.sandbox.publishableKey && runtime.stripe.environments.sandbox.secretKey),
        webhookReady: Boolean(settings.stripe.environments.sandbox.publishableKey && runtime.stripe.environments.sandbox.secretKey && runtime.stripe.environments.sandbox.webhookSecret),
      },
      production: {
        checkoutReady: Boolean(settings.stripe.environments.production.publishableKey && runtime.stripe.environments.production.secretKey),
        webhookReady: Boolean(settings.stripe.environments.production.publishableKey && runtime.stripe.environments.production.secretKey && runtime.stripe.environments.production.webhookSecret),
      },
    };
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
    if (runtime.stripe.secretKey && !stripeKeyMatchesMode(runtime.stripe.secretKey, settings.stripe.mode, "secret")) {
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
        stripeEnvironments,
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
    const requestedMode = sanitizeMode((req.body as Record<string, unknown> | undefined)?.mode);
    const credentials = runtime.stripe.environments[requestedMode];
    if (!credentials.secretKey) {
      return res.status(409).json({ error: { code: "STRIPE_NOT_CONFIGURED", message: `Save Stripe ${requestedMode === "sandbox" ? "test" : "live"} credentials before testing this connection.` } });
    }

    const response = await fetch("https://api.stripe.com/v1/account", {
      headers: { Authorization: `Bearer ${credentials.secretKey}` },
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
      metadata: { accountId: payload.id, chargesEnabled: payload.charges_enabled, mode: requestedMode },
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
        mode: requestedMode,
        webhookUrl: resolveWebhookUrl(req),
      },
    });
  } catch (error) {
    console.error("[Payments] Stripe connection test failed:", error);
    return res.status(502).json({ error: { code: "STRIPE_CONNECTION_FAILED", message: "Could not reach Stripe. Try again shortly." } });
  }
});

/**
 * POST /api/payments/stripe/sandbox-checkout
 * Creates an isolated test-mode Embedded Checkout session for the admin preview.
 * Preview payments deliberately omit a site token, so webhooks acknowledge them
 * without creating CRM donations or affecting live giving totals.
 */
router.post("/stripe/sandbox-checkout", requireRole("admin"), async (req, res) => {
  try {
    const organizationId = await resolveOrg(req);
    const runtime = await readPaymentGatewayRuntimeConfig(organizationId);
    const sandbox = runtime.stripe.environments.sandbox;
    if (!sandbox.publishableKey || !sandbox.secretKey) {
      return res.status(409).json({ error: { code: "STRIPE_SANDBOX_NOT_CONFIGURED", message: "Save the test publishable and server keys before opening the sandbox form." } });
    }

    const requestedAmount = Number((req.body as Record<string, unknown> | undefined)?.amount ?? 10);
    const amountCents = Math.round(requestedAmount * 100);
    if (!Number.isSafeInteger(amountCents) || amountCents < 100 || amountCents > 100_000_000) {
      return res.status(400).json({ error: { code: "INVALID_TEST_AMOUNT", message: "Test amount must be between 1.00 and 1,000,000.00." } });
    }

    const baseUrl = resolveWebhookUrl(req).replace(/\/api\/site-embeds\/public\/stripe-webhook$/, "");
    const sessionBody = new URLSearchParams();
    sessionBody.set("mode", "payment");
    sessionBody.set("ui_mode", "embedded_page");
    sessionBody.set("return_url", `${baseUrl}/api/site-embeds/public/donation-return?stripe_preview=1`);
    sessionBody.set("line_items[0][quantity]", "1");
    sessionBody.set("line_items[0][price_data][currency]", runtime.currency.toLowerCase());
    sessionBody.set("line_items[0][price_data][unit_amount]", String(amountCents));
    sessionBody.set("line_items[0][price_data][product_data][name]", "OyamaCRM sandbox donation form test");
    sessionBody.set("metadata[platform]", "oyamacrm");
    sessionBody.set("metadata[oyamaSandboxPreview]", "true");
    sessionBody.set("payment_intent_data[metadata][oyamaSandboxPreview]", "true");

    const stripeResponse = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sandbox.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `oyama-sandbox-preview-${organizationId}-${Date.now()}`,
      },
      body: sessionBody.toString(),
    });
    const payload = await stripeResponse.json().catch(() => ({})) as { id?: string; client_secret?: string; error?: { message?: string } };
    if (!stripeResponse.ok || !payload.client_secret) {
      return res.status(502).json({ error: { code: "STRIPE_SANDBOX_CHECKOUT_FAILED", message: payload.error?.message ?? "Stripe could not create the sandbox checkout." } });
    }

    await logAudit({
      action: "STRIPE_SANDBOX_FORM_OPENED",
      entity: "PluginSetting",
      entityId: organizationId,
      userId: req.user?.sub,
      organizationId,
      metadata: { sessionId: payload.id, amount: amountCents / 100, currency: runtime.currency },
    });

    return res.status(201).json({
      data: {
        clientSecret: payload.client_secret,
        publishableKey: sandbox.publishableKey,
        sessionId: payload.id ?? "",
        amount: amountCents / 100,
        currency: runtime.currency,
        returnOrigin: new URL(baseUrl).origin,
      },
    });
  } catch (error) {
    console.error("[Payments] Stripe sandbox checkout failed:", error);
    return res.status(502).json({ error: { code: "STRIPE_SANDBOX_CHECKOUT_FAILED", message: "Could not open the Stripe sandbox form." } });
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
