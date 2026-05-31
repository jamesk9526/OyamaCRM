/** Site embeds routes for DonorCRM admin configuration, public loader delivery, and LiveCom website ingestion. */
import { randomUUID } from "node:crypto";
import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { createNotification } from "../services/notifications.js";
import {
  SITE_EMBEDS_PLUGIN_KEY,
  SITE_EMBED_REGISTRY,
  buildDefaultSiteEmbedSiteConfig,
  buildSiteEmbedLoaderScript,
  buildSiteEmbedSnippets,
  createSiteEmbedToken,
  getActiveWidgetKeys,
  isDomainAllowedForSite,
  normalizeAllowedDomains,
  normalizeDomainCandidate,
  parseSiteEmbedsConfig,
  toPublicSiteEmbedConfig,
  type SiteEmbedsConfig,
  type SiteEmbedsPublicConfig,
  type SiteEmbedSiteConfig,
  type SiteEmbedWidgetKey,
  type SiteEmbedWidgetSettings,
} from "../services/site-embeds.js";
import { readPaymentGatewayRuntimeConfig } from "../services/payment-gateway-settings.js";

const router = Router();
const BRANDING_PLUGIN_KEY = "organization-branding";

interface SiteEmbedBrandingDefaults {
  organizationDisplayName: string;
  logoUrl: string;
  logoSquareUrl: string;
  primaryColor: string;
  accentColor: string;
  tagline: string;
}

/** Applies permissive CORS headers for public no-auth embed endpoints used on external websites. */
function applyPublicEmbedCorsHeaders(res: import("express").Response): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

/** Handles CORS preflight for embed routes installed on non-CRM public websites. */
router.options(["/loader.js", "/public/ping", "/public/livecom", "/public/livecom-thread", "/public/widget-data", "/public/widget-submit", "/public/donation-checkout", "/public/donation-checkout-embedded", "/public/stripe-webhook"], (_req, res) => {
  applyPublicEmbedCorsHeaders(res);
  res.status(204).end();
});

/** Ensures CORS headers are present for public embed traffic before auth middleware is applied. */
router.use((req, res, next) => {
  if (req.path === "/loader.js" || req.path.startsWith("/public/")) {
    applyPublicEmbedCorsHeaders(res);
  }
  next();
});

/** Resolves API base URL used for generated snippets and public-loader callbacks. */
function resolveApiBaseUrl(req: import("express").Request): string {
  const explicit = String(process.env.NEXT_PUBLIC_API_URL ?? "").trim();
  if (explicit) {
    return explicit.replace(/\/$/, "");
  }

  const protocol = req.protocol || "http";
  const host = req.get("host") || "localhost:4000";
  return `${protocol}://${host}`;
}

/** Gets one string value from query/body and trims it safely. */
function readStringInput(req: import("express").Request, key: string): string {
  const queryValue = (req.query as Record<string, unknown>)[key];
  const bodyValue = (req.body as Record<string, unknown> | undefined)?.[key];
  const value = bodyValue ?? queryValue;
  return String(value ?? "").trim();
}

/** Extracts one observed domain from request query/body headers for domain allow-list checks. */
function resolveObservedDomain(req: import("express").Request): string {
  const explicit = normalizeDomainCandidate(readStringInput(req, "domain"));
  if (explicit) return explicit;

  const originHost = normalizeDomainCandidate(req.get("origin"));
  if (originHost) return originHost;

  const refererHost = normalizeDomainCandidate(req.get("referer"));
  if (refererHost) return refererHost;

  return "";
}

/** Creates a safe default return URL for checkout redirects when embed pages do not provide custom links. */
function buildDefaultReturnUrl(domain: string, path = "/"): string {
  const host = normalizeDomainCandidate(domain) || "localhost";
  return `https://${host}${path}`;
}

/** Validates one user-provided return URL and keeps redirects pinned to the requesting website domain. */
function resolveReturnUrl(candidate: string, observedDomain: string, fallbackPath: string): string {
  const fallback = buildDefaultReturnUrl(observedDomain, fallbackPath);
  const value = candidate.trim();
  if (!value) return fallback;

  try {
    const parsed = new URL(value);
    if (normalizeDomainCandidate(parsed.hostname) !== normalizeDomainCandidate(observedDomain)) {
      return fallback;
    }
    return parsed.toString();
  } catch {
    return fallback;
  }
}

/** Reads branding defaults from PluginSetting config for automatic embed theming fallbacks. */
function readBrandingDefaults(value: unknown): SiteEmbedBrandingDefaults {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const readText = (key: string) => String(input[key] ?? "").trim();
  const readHex = (key: string) => {
    const candidate = String(input[key] ?? "").trim();
    return /^#[0-9a-fA-F]{6}$/.test(candidate) ? candidate : "";
  };

  return {
    organizationDisplayName: readText("organizationDisplayName"),
    logoUrl: readText("logoUrl"),
    logoSquareUrl: readText("logoSquareUrl"),
    primaryColor: readHex("primaryColor"),
    accentColor: readHex("accentColor"),
    tagline: readText("tagline"),
  };
}

/** Overlays branding defaults into widget settings when widget values are blank or legacy defaults. */
function applyBrandingDefaultsToPublicConfig(config: SiteEmbedsPublicConfig, branding: SiteEmbedBrandingDefaults): SiteEmbedsPublicConfig {
  const orgName = branding.organizationDisplayName;
  const logoUrl = branding.logoSquareUrl || branding.logoUrl;
  const brandColor = branding.primaryColor || branding.accentColor;
  const appearance = {
    ...config.appearance,
    accentColor: (config.appearance.accentColor === "#16a34a" || !/^#[0-9a-fA-F]{6}$/.test(String(config.appearance.accentColor || "").trim()))
      ? (brandColor || config.appearance.accentColor)
      : config.appearance.accentColor,
  };

  const widgets = {
    ...config.widgets,
    liveCom: {
      ...config.widgets.liveCom,
      orgName: config.widgets.liveCom.orgName || orgName,
      orgSubtitle: config.widgets.liveCom.orgSubtitle || branding.tagline,
      avatarUrl: config.widgets.liveCom.avatarUrl || logoUrl,
      chatheadColor: (config.widgets.liveCom.chatheadColor === "#16a34a" || !/^#[0-9a-fA-F]{6}$/.test(String(config.widgets.liveCom.chatheadColor || "").trim()))
        ? (appearance.accentColor || config.widgets.liveCom.chatheadColor)
        : config.widgets.liveCom.chatheadColor,
    },
    donation_widget: {
      ...config.widgets.donation_widget,
      accentColor: config.widgets.donation_widget.accentColor || brandColor,
    },
    campaign_meter: {
      ...config.widgets.campaign_meter,
      accentColor: config.widgets.campaign_meter.accentColor || brandColor,
    },
    event_card: {
      ...config.widgets.event_card,
      accentColor: config.widgets.event_card.accentColor || brandColor,
    },
    volunteer_signup: {
      ...config.widgets.volunteer_signup,
      accentColor: config.widgets.volunteer_signup.accentColor || brandColor,
    },
    newsletter_signup: {
      ...config.widgets.newsletter_signup,
      accentColor: config.widgets.newsletter_signup.accentColor || brandColor,
    },
    impact_counter: {
      ...config.widgets.impact_counter,
      accentColor: config.widgets.impact_counter.accentColor || brandColor,
    },
    cta_block: {
      ...config.widgets.cta_block,
      accentColor: config.widgets.cta_block.accentColor || brandColor,
    },
  };

  return {
    ...config,
    appearance,
    widgets,
  };
}

/** Converts dollars to integer cents with floor rounding for provider API compatibility. */
function toMinorUnits(amount: number): number {
  return Math.max(0, Math.round(amount * 100));
}

/** Creates one Stripe Checkout Session via direct API call and returns hosted checkout URL. */
async function createStripeCheckoutSession(args: {
  secretKey: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  donorName: string;
  donorEmail: string;
  campaignId: string;
  designation: string;
  idempotencyKey: string;
}) {
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("success_url", args.successUrl);
  params.set("cancel_url", args.cancelUrl);
  params.set("line_items[0][quantity]", "1");
  params.set("line_items[0][price_data][currency]", args.currency.toLowerCase());
  params.set("line_items[0][price_data][unit_amount]", String(toMinorUnits(args.amount)));
  params.set("line_items[0][price_data][product_data][name]", "Donation");
  params.set("line_items[0][price_data][product_data][description]", args.designation || "General Fund");
  if (args.donorEmail) {
    params.set("customer_email", args.donorEmail);
  }
  params.set("metadata[platform]", "oyamacrm_site_embeds");
  params.set("metadata[campaignId]", args.campaignId || "");
  params.set("metadata[designation]", args.designation || "");
  params.set("metadata[donorName]", args.donorName || "Website Visitor");

  const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${args.secretKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Idempotency-Key": args.idempotencyKey,
    },
    body: params.toString(),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(String((payload as { error?: { message?: string } }).error?.message ?? "Stripe checkout failed"));
  }

  const parsed = payload as { id?: string; url?: string };
  if (!parsed.id || !parsed.url) {
    throw new Error("Stripe did not return a checkout URL.");
  }

  return {
    provider: "stripe" as const,
    checkoutId: parsed.id,
    checkoutUrl: parsed.url,
  };
}

/** Creates one PayPal order and returns the approval URL for redirect-based checkout. */
async function createPayPalCheckoutOrder(args: {
  mode: "sandbox" | "production";
  clientId: string;
  clientSecret: string;
  amount: number;
  currency: string;
  successUrl: string;
  cancelUrl: string;
  donorName: string;
  campaignId: string;
  designation: string;
}) {
  const baseUrl = args.mode === "production"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

  const authToken = Buffer.from(`${args.clientId}:${args.clientSecret}`).toString("base64");
  const tokenResponse = await fetch(`${baseUrl}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${authToken}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  const tokenPayload = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !String((tokenPayload as { access_token?: string }).access_token ?? "")) {
    throw new Error("PayPal access token request failed.");
  }

  const accessToken = String((tokenPayload as { access_token?: string }).access_token);
  const orderResponse = await fetch(`${baseUrl}/v2/checkout/orders`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          amount: {
            currency_code: args.currency.toUpperCase(),
            value: args.amount.toFixed(2),
          },
          description: args.designation || "Donation",
          custom_id: args.campaignId || undefined,
        },
      ],
      payer: {
        name: args.donorName ? { given_name: args.donorName.slice(0, 80) } : undefined,
      },
      application_context: {
        return_url: args.successUrl,
        cancel_url: args.cancelUrl,
        brand_name: "OyamaCRM Donation",
        user_action: "PAY_NOW",
      },
    }),
  });

  const orderPayload = await orderResponse.json().catch(() => ({}));
  if (!orderResponse.ok) {
    throw new Error("PayPal order creation failed.");
  }

  const order = orderPayload as { id?: string; links?: Array<{ rel?: string; href?: string }> };
  const approvalUrl = order.links?.find((link) => link.rel === "approve")?.href;
  if (!order.id || !approvalUrl) {
    throw new Error("PayPal did not return an approval URL.");
  }

  return {
    provider: "paypal" as const,
    checkoutId: order.id,
    checkoutUrl: approvalUrl,
  };
}

/** Finds one site record by public embed token across enabled site-embed plugin rows. */
async function findSiteByToken(token: string) {
  if (!token.trim()) return null;

  const rows = await prisma.pluginSetting.findMany({
    where: {
      pluginKey: SITE_EMBEDS_PLUGIN_KEY,
      enabled: true,
    },
    select: {
      id: true,
      organizationId: true,
      config: true,
    },
  });

  for (const row of rows) {
    const parsed = parseSiteEmbedsConfig(row.config);
    const matchedSite = parsed.sites.find((site) => site.embedToken === token);
    if (matchedSite) {
      return {
        pluginId: row.id,
        organizationId: row.organizationId,
        config: parsed,
        site: matchedSite,
      };
    }
  }

  return null;
}

/** Loads org-scoped plugin config or returns defaults when no config row exists yet. */
async function loadOrganizationConfig(organizationId: string): Promise<SiteEmbedsConfig> {
  const row = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: SITE_EMBEDS_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  return parseSiteEmbedsConfig(row?.config);
}

/** Persists one org-scoped site-embed config in PluginSetting JSON storage. */
async function saveOrganizationConfig(organizationId: string, config: SiteEmbedsConfig, enabled = true) {
  return prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: SITE_EMBEDS_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: SITE_EMBEDS_PLUGIN_KEY,
      enabled,
      config: config as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled,
      config: config as unknown as Prisma.InputJsonValue,
    },
  });
}

/** Selects one site by ID, or defaults to the first configured site. */
function pickSite(config: SiteEmbedsConfig, requestedSiteId: string): SiteEmbedSiteConfig {
  return config.sites.find((site) => site.id === requestedSiteId) ?? config.sites[0];
}

/** Replaces one site in config immutably and returns the next config object. */
function replaceSite(config: SiteEmbedsConfig, nextSite: SiteEmbedSiteConfig): SiteEmbedsConfig {
  return {
    ...config,
    sites: config.sites.map((site) => (site.id === nextSite.id ? nextSite : site)),
  };
}

/** Merges a partial widgets payload into existing widget settings. */
function mergeWidgetSettings(current: SiteEmbedWidgetSettings, incoming: unknown): SiteEmbedWidgetSettings {
  if (!incoming || typeof incoming !== "object") return current;

  const partial = incoming as Record<string, unknown>;

  const liveComCandidate = partial.liveCom ?? partial.livecom;
  const nextLiveCom = liveComCandidate && typeof liveComCandidate === "object"
    ? ({ ...current.liveCom, ...(liveComCandidate as Record<string, unknown>) } as typeof current.liveCom)
    : current.liveCom;

  // Ensure liveCom fields are safe-typed
  const mergedLiveCom: typeof current.liveCom = {
    ...current.liveCom,
    ...nextLiveCom,
    enabled: typeof nextLiveCom.enabled === "boolean" ? nextLiveCom.enabled : current.liveCom.enabled,
    buttonPosition: nextLiveCom.buttonPosition === "bottom-left" ? "bottom-left" : "bottom-right",
    iconStyle: nextLiveCom.iconStyle === "spark" ? "spark"
      : nextLiveCom.iconStyle === "heart" ? "heart"
        : nextLiveCom.iconStyle === "hand" ? "hand"
          : "chat",
    chatheadColor: /^#[0-9a-fA-F]{6}$/.test(String(nextLiveCom.chatheadColor ?? "").trim())
      ? String(nextLiveCom.chatheadColor)
      : current.liveCom.chatheadColor,
    panelWidth: (() => {
      const w = Number(nextLiveCom.panelWidth ?? current.liveCom.panelWidth ?? 340);
      return Number.isFinite(w) && w >= 280 && w <= 480 ? Math.round(w) : (current.liveCom.panelWidth ?? 340);
    })(),
  };

  return {
    liveCom: mergedLiveCom,
    donation_widget: ({ ...current.donation_widget, ...(typeof partial.donation_widget === "object" && partial.donation_widget ? partial.donation_widget : {}) } as unknown as typeof current.donation_widget),
    campaign_meter: ({ ...current.campaign_meter, ...(typeof partial.campaign_meter === "object" && partial.campaign_meter ? partial.campaign_meter : {}) } as unknown as typeof current.campaign_meter),
    event_card: ({ ...current.event_card, ...(typeof partial.event_card === "object" && partial.event_card ? partial.event_card : {}) } as unknown as typeof current.event_card),
    volunteer_signup: ({ ...current.volunteer_signup, ...(typeof partial.volunteer_signup === "object" && partial.volunteer_signup ? partial.volunteer_signup : {}) } as unknown as typeof current.volunteer_signup),
    newsletter_signup: ({ ...current.newsletter_signup, ...(typeof partial.newsletter_signup === "object" && partial.newsletter_signup ? partial.newsletter_signup : {}) } as unknown as typeof current.newsletter_signup),
    impact_counter: ({ ...current.impact_counter, ...(typeof partial.impact_counter === "object" && partial.impact_counter ? partial.impact_counter : {}) } as unknown as typeof current.impact_counter),
    cta_block: ({ ...current.cta_block, ...(typeof partial.cta_block === "object" && partial.cta_block ? partial.cta_block : {}) } as unknown as typeof current.cta_block),
  };
}

/** Merges a partial site-wide appearance payload before service-level normalization runs on save/load. */
function mergeAppearanceSettings(current: SiteEmbedSiteConfig["appearance"], incoming: unknown): SiteEmbedSiteConfig["appearance"] {
  if (!incoming || typeof incoming !== "object") return current;
  return {
    ...current,
    ...(incoming as Partial<SiteEmbedSiteConfig["appearance"]>),
  };
}

/** Returns one JS response with warning output when loader generation cannot proceed. */
function sendLoaderWarning(res: import("express").Response, status: number, message: string) {
  res.status(status);
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.send(`console.warn(${JSON.stringify(`[OyamaCRM Embed] ${message}`)});`);
}

/**
 * GET /api/site-embeds/loader.js
 * Public script endpoint serving the website embed loader with only public-safe config.
 */
router.get("/loader.js", async (req, res) => {
  const token = readStringInput(req, "token");
  if (!token) {
    sendLoaderWarning(res, 400, "Missing embed token.");
    return;
  }

  const hit = await findSiteByToken(token);
  if (!hit || !hit.site.active) {
    sendLoaderWarning(res, 404, "Embed configuration is missing or inactive.");
    return;
  }

  const observedDomain = resolveObservedDomain(req);
  if (!isDomainAllowedForSite(hit.site, observedDomain)) {
    sendLoaderWarning(res, 403, "Domain is not allowed for this site embed token.");
    return;
  }

  const brandingSetting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId: hit.organizationId,
        pluginKey: BRANDING_PLUGIN_KEY,
      },
    },
    select: { config: true },
  });

  const brandingDefaults = readBrandingDefaults(brandingSetting?.config);
  const publicConfig = applyBrandingDefaultsToPublicConfig(toPublicSiteEmbedConfig(hit.site), brandingDefaults);

  const script = buildSiteEmbedLoaderScript({
    apiBaseUrl: resolveApiBaseUrl(req),
    token,
    publicConfig,
  });

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  res.setHeader("Pragma", "no-cache");
  res.send(script);
});

/**
 * GET/POST /api/site-embeds/public/ping
 * Public diagnostics ping used by embed scripts to report successful loads.
 */
async function handlePublicPing(req: import("express").Request, res: import("express").Response) {
  const token = readStringInput(req, "token");
  if (!token) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "token is required" } });
    return;
  }

  const hit = await findSiteByToken(token);
  if (!hit || !hit.site.active) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Embed site connection not found" } });
    return;
  }

  const observedDomain = resolveObservedDomain(req);
  if (!isDomainAllowedForSite(hit.site, observedDomain)) {
    res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Domain is not allowed for this embed token" } });
    return;
  }

  const widgetsRaw = readStringInput(req, "widgets");
  const activeWidgets = widgetsRaw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const reason = readStringInput(req, "reason") || "public_loader_ping";
  const nowIso = new Date().toISOString();

  const nextSite: SiteEmbedSiteConfig = {
    ...hit.site,
    lastSuccessfulScriptLoad: {
      loadedAt: nowIso,
      domain: observedDomain,
      reason,
      activeWidgets,
    },
  };

  const nextConfig = replaceSite(hit.config, nextSite);
  await saveOrganizationConfig(hit.organizationId, nextConfig, true);

  res.json({
    data: {
      ok: true,
      observedDomain,
      loadedAt: nowIso,
      activeWidgets,
    },
  });
}

router.get("/public/ping", handlePublicPing);
router.post("/public/ping", handlePublicPing);

type PublicWidgetKey = Exclude<SiteEmbedWidgetKey, "livecom">;

const PUBLIC_WIDGET_KEYS: PublicWidgetKey[] = [
  "campaign_meter",
  "donation_widget",
  "event_card",
  "volunteer_signup",
  "newsletter_signup",
  "impact_counter",
  "cta_block",
];

/** Normalizes public widget key input and supports dash/underscore formats. */
function normalizePublicWidgetKey(value: string): PublicWidgetKey | null {
  const normalized = value.trim().toLowerCase().replace(/-/g, "_") as PublicWidgetKey;
  return PUBLIC_WIDGET_KEYS.includes(normalized) ? normalized : null;
}

/** Returns true when the selected site has one widget enabled for public rendering/submission. */
function isPublicWidgetEnabled(site: SiteEmbedSiteConfig, widgetKey: PublicWidgetKey): boolean {
  const candidates = [
    site.widgets?.[widgetKey],
    (site.widgets as unknown as Record<string, unknown>)?.[widgetKey.replace(/_/g, "-")],
    (site.widgets as unknown as Record<string, unknown>)?.[widgetKey.replace(/_([a-z])/g, (_m, g1: string) => g1.toUpperCase())],
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      const enabled = (candidate as Record<string, unknown>).enabled;
      if (typeof enabled === "boolean") return enabled;
      if (typeof enabled === "string") return enabled.toLowerCase() === "true";
    }
    if (typeof candidate === "boolean") return candidate;
    if (typeof candidate === "string") return candidate.toLowerCase() === "true";
  }

  return false;
}

/** Builds a campaign meter payload using one selected campaign or fallback active campaign. */
async function buildCampaignMeterPayload(organizationId: string, requestedCampaignId: string) {
  const selected = requestedCampaignId
    ? await prisma.campaign.findFirst({
      where: { id: requestedCampaignId, organizationId },
      select: { id: true, name: true, goal: true, startDate: true, endDate: true },
    })
    : await prisma.campaign.findFirst({
      where: { organizationId, active: true },
      orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      select: { id: true, name: true, goal: true, startDate: true, endDate: true },
    });

  if (!selected) {
    return { campaign: null };
  }

  const raisedAggregate = await prisma.donation.aggregate({
    where: {
      campaignId: selected.id,
      status: "COMPLETED",
      constituent: { organizationId },
    },
    _sum: { amount: true },
    _count: { _all: true },
  });

  const goal = Number(selected.goal ?? 0);
  const raised = Number(raisedAggregate._sum.amount ?? 0);
  const progressPercent = goal > 0 ? Math.round((raised / goal) * 1000) / 10 : 0;

  return {
    campaign: {
      id: selected.id,
      name: selected.name,
      goal,
      raised,
      progressPercent,
      donationCount: Number(raisedAggregate._count._all ?? 0),
      startDate: selected.startDate.toISOString(),
      endDate: selected.endDate ? selected.endDate.toISOString() : null,
    },
  };
}

/** Builds a featured-event payload using one selected event or fallback upcoming public event. */
async function buildEventCardPayload(organizationId: string, requestedEventId: string) {
  const selected = requestedEventId
    ? await prisma.event.findFirst({
      where: { id: requestedEventId, organizationId },
      select: {
        id: true,
        name: true,
        startDate: true,
        location: true,
        city: true,
        state: true,
        virtualUrl: true,
        revenueGoal: true,
      },
    })
    : await prisma.event.findFirst({
      where: { organizationId, active: true, visibility: "PUBLIC" },
      orderBy: [{ startDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true,
        name: true,
        startDate: true,
        location: true,
        city: true,
        state: true,
        virtualUrl: true,
        revenueGoal: true,
      },
    });

  if (!selected) {
    return { event: null };
  }

  const [guestCount, orderAggregate] = await Promise.all([
    prisma.eventGuest.count({ where: { eventId: selected.id } }),
    prisma.eventOrder.aggregate({
      where: { eventId: selected.id, status: "CONFIRMED" },
      _sum: { totalAmount: true },
    }),
  ]);

  const locationParts = [selected.location, selected.city, selected.state].filter(Boolean);

  return {
    event: {
      id: selected.id,
      name: selected.name,
      startDateLabel: selected.startDate.toLocaleDateString(),
      locationLabel: locationParts.length > 0 ? locationParts.join(", ") : "Online / TBD",
      guestCount,
      revenueRaised: Number(orderAggregate._sum.totalAmount ?? 0),
      revenueGoal: Number(selected.revenueGoal ?? 0),
      eventUrl: selected.virtualUrl || "",
    },
  };
}

/** Builds one public-safe impact-metrics payload for website counters. */
async function buildImpactCounterPayload(organizationId: string) {
  const [constituentCount, donationAggregate, volunteerHoursAggregate, activeCampaigns] = await Promise.all([
    prisma.constituent.count({ where: { organizationId } }),
    prisma.donation.aggregate({
      where: { status: "COMPLETED", constituent: { organizationId } },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    prisma.volunteerHour.aggregate({
      where: { constituent: { organizationId } },
      _sum: { hours: true },
    }),
    prisma.campaign.count({ where: { organizationId, active: true } }),
  ]);

  return {
    metrics: {
      constituentCount,
      completedDonationCount: Number(donationAggregate._count._all ?? 0),
      completedDonationAmount: Number(donationAggregate._sum.amount ?? 0),
      volunteerHours: Number(volunteerHoursAggregate._sum.hours ?? 0),
      activeCampaignCount: activeCampaigns,
    },
  };
}

/** GET /api/site-embeds/public/widget-data returns public-safe tokenized payloads for inline widgets. */
router.get("/public/widget-data", async (req, res) => {
  const token = readStringInput(req, "token");
  const widgetKey = normalizePublicWidgetKey(readStringInput(req, "widget"));

  if (!token) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "token is required" } });
    return;
  }

  if (!widgetKey) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "widget is required" } });
    return;
  }

  const hit = await findSiteByToken(token);
  if (!hit || !hit.site.active) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Embed site connection not found" } });
    return;
  }

  const observedDomain = resolveObservedDomain(req);
  if (!isDomainAllowedForSite(hit.site, observedDomain)) {
    res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Domain is not allowed for this embed token" } });
    return;
  }

  if (!isPublicWidgetEnabled(hit.site, widgetKey)) {
    res.status(409).json({ error: { code: "WIDGET_INACTIVE", message: "Widget is disabled for this site" } });
    return;
  }

  const requestedCampaignId = readStringInput(req, "campaignId");
  const requestedEventId = readStringInput(req, "eventId");

  const payload = widgetKey === "campaign_meter"
    ? await buildCampaignMeterPayload(hit.organizationId, requestedCampaignId)
    : widgetKey === "event_card"
      ? await buildEventCardPayload(hit.organizationId, requestedEventId)
      : widgetKey === "impact_counter"
        ? await buildImpactCounterPayload(hit.organizationId)
        : widgetKey === "donation_widget"
          ? {
            campaignId: requestedCampaignId,
            designation: readStringInput(req, "designation") || "General Fund",
            message: "Submit your donation interest and our team can follow up securely.",
          }
          : widgetKey === "cta_block"
            ? {
              headline: readStringInput(req, "headline") || "Support Our Mission",
              body: readStringInput(req, "body") || "Your generosity helps power life-changing nonprofit work.",
              buttonLabel: readStringInput(req, "buttonLabel") || "Take Action",
              buttonHref: readStringInput(req, "buttonHref") || "/donate",
            }
            : {
              message: "Capture supporter interest directly from your public website.",
            };

  res.json({
    data: {
      widget: widgetKey,
      ...payload,
    },
  });
});

/** POST /api/site-embeds/public/widget-submit captures widget submissions into DonorCRM activity logs. */
router.post("/public/widget-submit", async (req, res) => {
  const token = readStringInput(req, "token");
  const widgetKey = normalizePublicWidgetKey(readStringInput(req, "widget"));
  const displayName = readStringInput(req, "name");
  const email = readStringInput(req, "email").toLowerCase();
  const phone = readStringInput(req, "phone");
  const message = readStringInput(req, "message");
  const amountRaw = readStringInput(req, "amount");
  const pageUrl = readStringInput(req, "pageUrl");
  const campaignId = readStringInput(req, "campaignId");
  const eventId = readStringInput(req, "eventId");
  const designation = readStringInput(req, "designation");

  if (!token) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "token is required" } });
    return;
  }

  if (!widgetKey) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "widget is required" } });
    return;
  }

  if (widgetKey === "newsletter_signup" && !email) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "email is required for newsletter sign-up" } });
    return;
  }

  const hit = await findSiteByToken(token);
  if (!hit || !hit.site.active) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Embed site connection not found" } });
    return;
  }

  const observedDomain = resolveObservedDomain(req);
  if (!isDomainAllowedForSite(hit.site, observedDomain)) {
    res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Domain is not allowed for this embed token" } });
    return;
  }

  if (!isPublicWidgetEnabled(hit.site, widgetKey)) {
    res.status(409).json({ error: { code: "WIDGET_INACTIVE", message: "Widget is disabled for this site" } });
    return;
  }

  const parsedName = splitDisplayName(displayName);
  let constituent = email
    ? await prisma.constituent.findFirst({
      where: { organizationId: hit.organizationId, email },
      select: { id: true, firstName: true, lastName: true },
    })
    : null;

  if (!constituent && (email || displayName || message || widgetKey !== "cta_block")) {
    const constituentType = widgetKey === "volunteer_signup"
      ? "VOLUNTEER"
      : widgetKey === "donation_widget"
        ? "DONOR"
        : "PROSPECT";

    constituent = await prisma.constituent.create({
      data: {
        organizationId: hit.organizationId,
        type: constituentType,
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        email: email || null,
        phone: phone || null,
        notes: [
          `Created from Site Embed ${widgetKey} submission.`,
          observedDomain ? `Domain: ${observedDomain}` : "",
          pageUrl ? `Page URL: ${pageUrl}` : "",
        ].filter(Boolean).join("\n"),
      },
      select: { id: true, firstName: true, lastName: true },
    });
  }

  const amount = Number(amountRaw || 0);
  const activityDescription =
    widgetKey === "donation_widget"
      ? `Donation widget submission${amount > 0 ? ` (${amount.toFixed(2)})` : ""}`
      : widgetKey === "volunteer_signup"
        ? "Volunteer sign-up submission"
        : widgetKey === "newsletter_signup"
          ? "Newsletter sign-up submission"
          : widgetKey === "event_card"
            ? "Event interest submission"
            : widgetKey === "cta_block"
              ? "CTA interaction"
              : "Widget submission";

  const activity = await prisma.activity.create({
    data: {
      constituentId: constituent?.id ?? null,
      type: "NOTE",
      description: message || activityDescription,
      metadata: {
        source: "site_embeds_widget",
        channel: "WEB_WIDGET",
        widget: widgetKey,
        pageUrl,
        domain: observedDomain,
        amount: Number.isFinite(amount) && amount > 0 ? amount : null,
        campaignId: campaignId || null,
        eventId: eventId || null,
        designation: designation || null,
      },
    },
    select: { id: true, createdAt: true },
  });

  const nowIso = new Date().toISOString();
  const nextSite: SiteEmbedSiteConfig = {
    ...hit.site,
    lastSuccessfulScriptLoad: {
      loadedAt: nowIso,
      domain: observedDomain,
      reason: `${widgetKey}_submit`,
      activeWidgets: getActiveWidgetKeys(hit.site),
    },
  };

  await saveOrganizationConfig(hit.organizationId, replaceSite(hit.config, nextSite), true);

  await logAudit({
    action: "SITE_EMBED_WIDGET_SUBMISSION_RECEIVED",
    entity: "Activity",
    entityId: activity.id,
    organizationId: hit.organizationId,
    metadata: {
      source: "site_embeds",
      siteId: hit.site.id,
      publicSiteId: hit.site.publicSiteId,
      widget: widgetKey,
      domain: observedDomain,
    },
  });

  res.status(201).json({
    data: {
      queued: true,
      interactionId: activity.id,
      widget: widgetKey,
      receivedAt: activity.createdAt.toISOString(),
    },
  });
});

/**
 * POST /api/site-embeds/public/donation-checkout
 * Creates a tokenized Stripe Checkout session or PayPal order for embedded donation widgets.
 */
router.post("/public/donation-checkout", async (req, res) => {
  const token = readStringInput(req, "token");
  const displayName = readStringInput(req, "name");
  const email = readStringInput(req, "email").toLowerCase();
  const message = readStringInput(req, "message");
  const amountRaw = readStringInput(req, "amount");
  const campaignId = readStringInput(req, "campaignId");
  const designation = readStringInput(req, "designation") || "General Fund";
  const providerPreference = readStringInput(req, "provider").toLowerCase();
  const successUrlInput = readStringInput(req, "successUrl");
  const cancelUrlInput = readStringInput(req, "cancelUrl");

  if (!token) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "token is required" } });
    return;
  }

  const amount = Number(amountRaw);
  if (!Number.isFinite(amount) || amount <= 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid donation amount is required" } });
    return;
  }

  const hit = await findSiteByToken(token);
  if (!hit || !hit.site.active) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Embed site connection not found" } });
    return;
  }

  const observedDomain = resolveObservedDomain(req);
  if (!isDomainAllowedForSite(hit.site, observedDomain)) {
    res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Domain is not allowed for this embed token" } });
    return;
  }

  if (!isPublicWidgetEnabled(hit.site, "donation_widget")) {
    res.status(409).json({ error: { code: "WIDGET_INACTIVE", message: "Donation widget is disabled for this site" } });
    return;
  }

  const runtime = await readPaymentGatewayRuntimeConfig(hit.organizationId);
  const successUrl = resolveReturnUrl(successUrlInput, observedDomain, "/?donation=success");
  const cancelUrl = resolveReturnUrl(cancelUrlInput, observedDomain, "/?donation=canceled");

  const parsedName = splitDisplayName(displayName);
  let constituent = email
    ? await prisma.constituent.findFirst({
      where: { organizationId: hit.organizationId, email },
      select: { id: true },
    })
    : null;

  if (!constituent) {
    constituent = await prisma.constituent.create({
      data: {
        organizationId: hit.organizationId,
        type: "DONOR",
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        email: email || null,
        notes: [
          "Created from site-embed donation checkout.",
          observedDomain ? `Domain: ${observedDomain}` : "",
        ].filter(Boolean).join("\n"),
      },
      select: { id: true },
    });
  }

  const idempotencyKey = [
    token,
    constituent.id,
    designation,
    amount.toFixed(2),
    new Date().toISOString().slice(0, 16),
  ].join(":");

  try {
    const useStripe = providerPreference === "stripe"
      || (providerPreference !== "paypal" && runtime.stripe.enabled && Boolean(runtime.stripe.secretKey));

    const checkout = useStripe && runtime.stripe.enabled && runtime.stripe.secretKey
      ? await createStripeCheckoutSession({
        secretKey: runtime.stripe.secretKey,
        amount,
        currency: runtime.currency,
        successUrl,
        cancelUrl,
        donorName: displayName,
        donorEmail: email,
        campaignId,
        designation,
        idempotencyKey,
      })
      : runtime.paypal.enabled && runtime.paypal.clientId && runtime.paypal.clientSecret
        ? await createPayPalCheckoutOrder({
          mode: runtime.paypal.mode,
          clientId: runtime.paypal.clientId,
          clientSecret: runtime.paypal.clientSecret,
          amount,
          currency: runtime.currency,
          successUrl,
          cancelUrl,
          donorName: displayName,
          campaignId,
          designation,
        })
        : null;

    if (!checkout) {
      res.status(503).json({
        error: {
          code: "PAYMENT_PROVIDER_NOT_CONFIGURED",
          message: "No enabled payment provider is configured for this donation widget.",
        },
      });
      return;
    }

    const activity = await prisma.activity.create({
      data: {
        constituentId: constituent.id,
        type: "DONATION",
        description: `Checkout started via ${checkout.provider} donation widget`,
        metadata: {
          source: "site_embeds_widget",
          widget: "donation_widget",
          provider: checkout.provider,
          checkoutId: checkout.checkoutId,
          amount,
          currency: runtime.currency,
          campaignId: campaignId || null,
          designation,
          domain: observedDomain,
          message: message || null,
        },
      },
      select: { id: true },
    });

    await logAudit({
      action: "SITE_EMBED_DONATION_CHECKOUT_CREATED",
      entity: "Activity",
      entityId: activity.id,
      organizationId: hit.organizationId,
      metadata: {
        provider: checkout.provider,
        checkoutId: checkout.checkoutId,
        siteId: hit.site.id,
        domain: observedDomain,
        amount,
      },
    });

    res.status(201).json({
      data: {
        provider: checkout.provider,
        checkoutId: checkout.checkoutId,
        checkoutUrl: checkout.checkoutUrl,
      },
    });
  } catch (error) {
    console.error("[SiteEmbeds] donation checkout error:", error);
    res.status(502).json({
      error: {
        code: "PAYMENT_CHECKOUT_FAILED",
        message: error instanceof Error ? error.message : "Failed to start donation checkout.",
      },
    });
  }
});

/** Splits a display-name into first/last names while preserving nonprofit CRM defaults. */
function splitDisplayName(input: string): { firstName: string; lastName: string } {
  const value = input.trim();
  if (!value) {
    return { firstName: "Website", lastName: "Visitor" };
  }

  const parts = value.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: "Visitor" };
  }

  return {
    firstName: parts.slice(0, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

function normalizePhoneDigits(input: string): string {
  return input.replace(/\D/g, "").replace(/^1(?=\d{10}$)/, "");
}

async function findExistingLiveComConstituent(args: {
  organizationId: string;
  email?: string;
  phone?: string;
  existingConstituentId?: string | null;
}) {
  const { organizationId, email = "", phone = "", existingConstituentId = null } = args;

  if (existingConstituentId) {
    const existingConversationConstituent = await prisma.constituent.findFirst({
      where: { id: existingConstituentId, organizationId },
      select: { id: true, firstName: true, lastName: true },
    });
    if (existingConversationConstituent) {
      return { constituent: existingConversationConstituent, matchMethod: "existing_conversation" as const };
    }
  }

  if (email) {
    const emailMatch = await prisma.constituent.findFirst({
      where: { organizationId, email },
      select: { id: true, firstName: true, lastName: true },
    });
    if (emailMatch) {
      return { constituent: emailMatch, matchMethod: "email" as const };
    }
  }

  const phoneDigits = normalizePhoneDigits(phone);
  if (phoneDigits.length >= 7) {
    const lastFour = phoneDigits.slice(-4);
    const phoneCandidates = await prisma.constituent.findMany({
      where: {
        organizationId,
        OR: [
          { phone: { contains: lastFour } },
          { mobile: { contains: lastFour } },
          { phone2: { contains: lastFour } },
        ],
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        phone: true,
        mobile: true,
        phone2: true,
      },
      take: 25,
    });

    const phoneMatch = phoneCandidates.find((candidate) => [candidate.phone, candidate.mobile, candidate.phone2]
      .some((value) => normalizePhoneDigits(value ?? "") === phoneDigits));

    if (phoneMatch) {
      return {
        constituent: {
          id: phoneMatch.id,
          firstName: phoneMatch.firstName,
          lastName: phoneMatch.lastName,
        },
        matchMethod: "phone" as const,
      };
    }
  }

  return { constituent: null, matchMethod: "created_new" as const };
}

/** Safely reads JSON metadata objects from activity rows. */
function readActivityMetadata(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Creates durable staff notifications for new public LiveCom visitor messages. */
async function notifyLiveComStaff(args: {
  organizationId: string;
  conversationId: string;
  interactionId: string;
  visitorName: string;
  message: string;
  siteName: string;
}) {
  try {
    const users = await prisma.user.findMany({
      where: {
        organizationId: args.organizationId,
        active: true,
        role: { not: "readonly" },
      },
      select: { id: true },
      take: 100,
    });

    await Promise.all(users.map((user) => createNotification({
      organizationId: args.organizationId,
      userId: user.id,
      module: "donor",
      sourceType: "livecom-message",
      sourceId: args.interactionId,
      title: `LiveCom message from ${args.visitorName || "Website Visitor"}`,
      message: `${args.siteName || "Website"}: ${args.message.slice(0, 180)}`,
      href: `/livecom/inbox?conversationId=${encodeURIComponent(args.conversationId)}`,
      severity: "HIGH",
      actionLabel: "Open LiveCom",
      metadata: {
        conversationId: args.conversationId,
        visitorName: args.visitorName,
        source: "site_embeds",
      },
    })));
  } catch (notificationError) {
    // Public chat delivery must not fail just because durable staff notifications are unavailable.
    console.warn("[SiteEmbeds] LiveCom staff notification failed:", notificationError);
  }
}

/** Reads a public LiveCom conversation thread that belongs to one site/session pair. */
async function loadPublicLiveComThread(args: {
  organizationId: string;
  siteId: string;
  conversationId: string;
  visitorSessionId: string;
}) {
  if (!args.conversationId || !args.visitorSessionId) return null;

  const rows = await prisma.activity.findMany({
    where: {
      constituent: { organizationId: args.organizationId },
    },
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: {
      constituent: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  const conversationRows = rows
    .filter((row) => {
      const metadata = readActivityMetadata(row.metadata);
      const publicEmbed = readActivityMetadata(metadata.publicEmbed as Prisma.JsonValue | null);
      const role = String(metadata.messageRole || "visitor");
      const publicRole = role === "visitor" || role === "staff";
      return metadata.source === "livecom"
        && metadata.conversationId === args.conversationId
        && metadata.visitorSessionId === args.visitorSessionId
        && publicRole
        && (publicEmbed.siteId === args.siteId || role === "staff");
    })
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  const messages = conversationRows
    .map((row) => {
      const metadata = readActivityMetadata(row.metadata);
      const role = String(metadata.messageRole || "visitor");
      return {
        id: row.id,
        role: role === "staff" ? role : "visitor",
        body: row.description,
        authorName: String(metadata.authorName || (role === "staff" ? "Team" : "You")),
        createdAt: row.createdAt.toISOString(),
      };
    });

  if (messages.length === 0) return null;

  const latest = conversationRows[conversationRows.length - 1];
  const metadata = readActivityMetadata(latest?.metadata ?? null);
  const constituent = latest?.constituent;
  const visitorName = String(metadata.visitorName || `${constituent?.firstName ?? ""} ${constituent?.lastName ?? ""}`.trim() || "Website Visitor");

  return {
    id: args.conversationId,
    visitorName,
    visitorEmail: String(metadata.visitorEmail || constituent?.email || ""),
    status: String(metadata.status || "OPEN"),
    messages,
  };
}

/**
 * POST /api/site-embeds/public/donation-checkout-embedded
 * Creates a Stripe Embedded Checkout session and returns the clientSecret + publishableKey.
 * The frontend uses these to mount Stripe's embedded checkout UI inside the donation widget.
 */
router.post("/public/donation-checkout-embedded", async (req, res) => {
  const body = (req.body ?? {}) as Record<string, unknown>;
  const token = String(body.token ?? "").trim();
  const amountRaw = Number(body.amount);
  const giftType = String(body.giftType ?? "one-time").toLowerCase() as "one-time" | "monthly";
  const designation = String(body.designation ?? "General Fund").trim();
  const donorName = String(body.name ?? "").trim();
  const donorEmail = String(body.email ?? "").trim().toLowerCase();
  const donorPhone = String(body.phone ?? "").trim();

  if (!token) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "token is required" } });
    return;
  }
  if (!Number.isFinite(amountRaw) || amountRaw <= 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A valid amount is required" } });
    return;
  }

  const hit = await findSiteByToken(token);
  if (!hit || !hit.site.active) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Embed site connection not found" } });
    return;
  }

  const observedDomain = resolveObservedDomain(req);
  if (!isDomainAllowedForSite(hit.site, observedDomain)) {
    res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Domain is not allowed for this embed token" } });
    return;
  }

  if (!isPublicWidgetEnabled(hit.site, "donation_widget")) {
    res.status(409).json({ error: { code: "WIDGET_INACTIVE", message: "Donation widget is disabled for this site" } });
    return;
  }

  const runtime = await readPaymentGatewayRuntimeConfig(hit.organizationId);
  if (!runtime.stripe.enabled || !runtime.stripe.secretKey || !runtime.stripe.publishableKey) {
    res.status(503).json({ error: { code: "PAYMENT_NOT_CONFIGURED", message: "Stripe is not configured for this organization." } });
    return;
  }

  try {
    const amountCents = Math.round(amountRaw * 100);
    const currency = runtime.currency.toLowerCase();
    const returnUrl = `${resolveApiBaseUrl(req)}/api/site-embeds/public/donation-return?token=${encodeURIComponent(token)}`;

    let sessionBody: URLSearchParams;
    if (giftType === "monthly") {
      // Subscription checkout
      sessionBody = new URLSearchParams();
      sessionBody.set("mode", "subscription");
      sessionBody.set("ui_mode", "embedded");
      sessionBody.set("return_url", returnUrl);
      sessionBody.set("line_items[0][quantity]", "1");
      sessionBody.set("line_items[0][price_data][currency]", currency);
      sessionBody.set("line_items[0][price_data][recurring][interval]", "month");
      sessionBody.set("line_items[0][price_data][unit_amount]", String(amountCents));
      sessionBody.set("line_items[0][price_data][product_data][name]", `Monthly Gift – ${designation}`);
      sessionBody.set("metadata[platform]", "oyamacrm");
      sessionBody.set("metadata[giftType]", "monthly");
      sessionBody.set("metadata[designation]", designation);
      sessionBody.set("metadata[siteToken]", token);
      sessionBody.set("metadata[donorName]", donorName);
      if (donorEmail) sessionBody.set("customer_email", donorEmail);
    } else {
      // One-time payment checkout
      sessionBody = new URLSearchParams();
      sessionBody.set("mode", "payment");
      sessionBody.set("ui_mode", "embedded");
      sessionBody.set("return_url", returnUrl);
      sessionBody.set("line_items[0][quantity]", "1");
      sessionBody.set("line_items[0][price_data][currency]", currency);
      sessionBody.set("line_items[0][price_data][unit_amount]", String(amountCents));
      sessionBody.set("line_items[0][price_data][product_data][name]", `Gift – ${designation}`);
      sessionBody.set("payment_intent_data[metadata][platform]", "oyamacrm");
      sessionBody.set("payment_intent_data[metadata][designation]", designation);
      sessionBody.set("payment_intent_data[metadata][siteToken]", token);
      sessionBody.set("payment_intent_data[metadata][donorName]", donorName);
      sessionBody.set("metadata[platform]", "oyamacrm");
      sessionBody.set("metadata[giftType]", "one-time");
      sessionBody.set("metadata[designation]", designation);
      sessionBody.set("metadata[siteToken]", token);
      sessionBody.set("metadata[donorName]", donorName);
      if (donorEmail) sessionBody.set("customer_email", donorEmail);
    }

    const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${runtime.stripe.secretKey}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: sessionBody.toString(),
    });

    const stripePayload = await stripeRes.json().catch(() => ({})) as { id?: string; client_secret?: string; error?: { message?: string } };
    if (!stripeRes.ok) {
      throw new Error(stripePayload.error?.message ?? "Stripe session creation failed");
    }
    if (!stripePayload.client_secret) {
      throw new Error("Stripe did not return a client_secret for embedded checkout.");
    }

    // Create pending donor record
    const parsedName = splitDisplayName(donorName);
    let constituent = donorEmail
      ? await prisma.constituent.findFirst({ where: { organizationId: hit.organizationId, email: donorEmail }, select: { id: true } })
      : null;
    if (!constituent) {
      constituent = await prisma.constituent.create({
        data: {
          organizationId: hit.organizationId,
          type: "DONOR",
          firstName: parsedName.firstName,
          lastName: parsedName.lastName,
          email: donorEmail || null,
          phone: donorPhone || null,
        },
        select: { id: true },
      });
    }

    await prisma.activity.create({
      data: {
        constituentId: constituent.id,
        type: "DONATION",
        description: `Embedded Stripe Checkout started – ${giftType} gift of $${amountRaw.toFixed(2)} to ${designation}`,
        metadata: {
          source: "site_embeds_widget",
          widget: "donation_widget_embedded",
          provider: "stripe",
          checkoutSessionId: stripePayload.id ?? "",
          amount: amountRaw,
          currency,
          giftType,
          designation,
          domain: observedDomain,
          status: "pending",
        },
      },
    });

    res.status(200).json({
      data: {
        clientSecret: stripePayload.client_secret,
        publishableKey: runtime.stripe.publishableKey,
        sessionId: stripePayload.id ?? "",
        giftType,
        amount: amountRaw,
        currency,
        designation,
      },
    });
  } catch (error) {
    console.error("[SiteEmbeds] embedded checkout error:", error);
    res.status(502).json({
      error: {
        code: "PAYMENT_CHECKOUT_FAILED",
        message: error instanceof Error ? error.message : "Failed to start embedded checkout.",
      },
    });
  }
});

/**
 * GET /api/site-embeds/public/donation-return
 * Return URL after Stripe Embedded Checkout completes. Widgets use this to show a thank-you state.
 */
router.get("/public/donation-return", (_req, res) => {
  // Stripe appends ?payment_intent=... or ?payment_intent_client_secret=... to this URL.
  // The embedded widget reads these from postMessage/window.location. This endpoint just confirms the session.
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>
  // Notify parent frame that Stripe checkout completed.
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ oyama_stripe_return: true, search: window.location.search }, '*');
  }
</script></body></html>`);
});

/**
 * POST /api/site-embeds/public/stripe-webhook
 * Receives Stripe webhook events for donation processing.
 * Validates signature and records completed payments in DonorCRM.
 */
router.post("/public/stripe-webhook", async (req, res) => {
  const signature = String(req.headers["stripe-signature"] ?? "");

  // We need raw body for signature verification — if rawBody is present use it.
  const rawBody: Buffer | string = (req as unknown as { rawBody?: Buffer }).rawBody ?? req.body;
  const rawBodyStr = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : JSON.stringify(rawBody);

  if (!signature) {
    res.status(400).json({ error: "Missing stripe-signature header" });
    return;
  }

  // Parse the event payload directly (signature verification requires stripe SDK or manual HMAC)
  // We parse first to extract the organization from metadata, then verify with org-specific secret.
  let event: { type?: string; data?: { object?: Record<string, unknown> }; id?: string };
  try {
    event = typeof rawBody === "string"
      ? JSON.parse(rawBody)
      : Buffer.isBuffer(rawBody)
        ? JSON.parse(rawBody.toString("utf8"))
        : (rawBody as typeof event);
  } catch {
    res.status(400).json({ error: "Invalid JSON payload" });
    return;
  }

  const session = (event?.data?.object ?? {}) as Record<string, unknown> & {
    metadata?: Record<string, unknown>;
    customer_details?: Record<string, unknown>;
  };
  const sessionMeta = (session.metadata ?? {}) as Record<string, unknown>;
  const siteToken = String(sessionMeta["siteToken"] ?? "");

  const hit = siteToken ? await findSiteByToken(siteToken) : null;
  if (!hit) {
    // Unknown site token - acknowledge but take no action
    res.status(200).json({ received: true, action: "skipped_unknown_token" });
    return;
  }

  // Verify webhook signature if secret is configured
  const runtime = await readPaymentGatewayRuntimeConfig(hit.organizationId);
  if (runtime.stripe.webhookSecret) {
    const { createHmac } = await import("crypto");
    const parts = signature.split(",").reduce<Record<string, string>>((acc, p) => {
      const [k, v] = p.split("=");
      if (k && v) acc[k] = v;
      return acc;
    }, {});
    const timestamp = parts["t"];
    const sigV1 = parts["v1"];
    if (!timestamp || !sigV1) {
      res.status(400).json({ error: "Malformed stripe-signature header" });
      return;
    }
    const expected = createHmac("sha256", runtime.stripe.webhookSecret)
      .update(`${timestamp}.${rawBodyStr}`)
      .digest("hex");
    if (expected !== sigV1) {
      res.status(400).json({ error: "Webhook signature verification failed" });
      return;
    }
  }

  // Process supported event types
  try {
    if (event.type === "checkout.session.completed") {
      const amountTotal = Number(session.amount_total ?? 0) / 100;
      const currency = String(session.currency ?? "usd").toUpperCase();
      const meta = (session.metadata ?? {}) as Record<string, unknown>;
      const custDetails = (session.customer_details ?? {}) as Record<string, unknown>;
      const designation = String(meta["designation"] ?? "General Fund");
      const giftType = String(meta["giftType"] ?? "one-time");
      const donorEmail = String(session["customer_email"] ?? custDetails["email"] ?? "").toLowerCase();
      const donorName = String(meta["donorName"] ?? "Website Donor").trim();
      const sessionId = String(session.id ?? "");

      const parsedName = splitDisplayName(donorName);
      let constituent = donorEmail
        ? await prisma.constituent.findFirst({ where: { organizationId: hit.organizationId, email: donorEmail }, select: { id: true } })
        : null;
      if (!constituent) {
        constituent = await prisma.constituent.create({
          data: {
            organizationId: hit.organizationId,
            type: "DONOR",
            firstName: parsedName.firstName,
            lastName: parsedName.lastName,
            email: donorEmail || null,
          },
          select: { id: true },
        });
      }

      await prisma.activity.create({
        data: {
          constituentId: constituent.id,
          type: "DONATION",
          description: `${giftType === "monthly" ? "Monthly gift" : "One-time gift"} of $${amountTotal.toFixed(2)} ${currency} – ${designation}`,
          metadata: {
            source: "stripe_webhook",
            widget: "donation_widget",
            provider: "stripe",
            checkoutSessionId: sessionId,
            paymentIntentId: String(session.payment_intent ?? ""),
            subscriptionId: String(session.subscription ?? ""),
            amount: amountTotal,
            currency,
            giftType,
            designation,
            status: "completed",
            paidAt: new Date().toISOString(),
          },
        },
      });

      await logAudit({
        action: "STRIPE_DONATION_COMPLETED",
        entity: "Activity",
        entityId: sessionId,
        organizationId: hit.organizationId,
        metadata: { amount: amountTotal, currency, designation, giftType },
      });
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("[SiteEmbeds] webhook processing error:", error);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});

/**
 * GET /api/site-embeds/public/livecom-thread
 * Returns a returning visitor's messenger thread for the same token/site/session.
 */
router.get("/public/livecom-thread", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  const token = readStringInput(req, "token");
  const conversationId = readStringInput(req, "conversationId");
  const visitorSessionId = readStringInput(req, "visitorSessionId");

  if (!token) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "token is required" } });
    return;
  }

  const hit = await findSiteByToken(token);
  if (!hit || !hit.site.active) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Embed site connection not found" } });
    return;
  }

  const observedDomain = resolveObservedDomain(req);
  if (!isDomainAllowedForSite(hit.site, observedDomain)) {
    res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Domain is not allowed for this embed token" } });
    return;
  }

  const thread = await loadPublicLiveComThread({
    organizationId: hit.organizationId,
    siteId: hit.site.id,
    conversationId,
    visitorSessionId,
  });

  res.json({ data: { conversation: thread } });
});

/**
 * POST /api/site-embeds/public/livecom
 * Public LiveCom messenger endpoint that appends visitor messages to a durable conversation thread.
 */
router.post("/public/livecom", async (req, res) => {
  const token = readStringInput(req, "token");
  const message = readStringInput(req, "message");
  const displayName = readStringInput(req, "name");
  const email = readStringInput(req, "email").toLowerCase();
  const phone = readStringInput(req, "phone");
  const pageUrl = readStringInput(req, "pageUrl");
  const referrerUrl = readStringInput(req, "referrerUrl");
  const requestedConversationId = readStringInput(req, "conversationId");
  const visitorSessionId = readStringInput(req, "visitorSessionId") || randomUUID();

  if (!token) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "token is required" } });
    return;
  }

  if (!message) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "message is required" } });
    return;
  }

  const hit = await findSiteByToken(token);
  if (!hit || !hit.site.active) {
    res.status(404).json({ error: { code: "NOT_FOUND", message: "Embed site connection not found" } });
    return;
  }

  const liveComEnabled = (() => {
    const widgets = hit.site.widgets as unknown as Record<string, unknown>;
    const candidates = [
      (widgets.liveCom as Record<string, unknown> | undefined)?.enabled,
      (widgets.livecom as Record<string, unknown> | undefined)?.enabled,
    ];

    for (const enabled of candidates) {
      if (typeof enabled === "boolean") return enabled;
      if (typeof enabled === "string") return enabled.toLowerCase() === "true";
    }

    return false;
  })();

  if (!liveComEnabled) {
    res.status(409).json({ error: { code: "LIVECOM_INACTIVE", message: "LiveCom widget is disabled for this site" } });
    return;
  }

  const observedDomain = resolveObservedDomain(req);
  if (!isDomainAllowedForSite(hit.site, observedDomain)) {
    res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Domain is not allowed for this embed token" } });
    return;
  }

  const parsedName = splitDisplayName(displayName);
  const conversationId = requestedConversationId || `lc_${randomUUID()}`;

  const existingThread = requestedConversationId
    ? await loadPublicLiveComThread({
      organizationId: hit.organizationId,
      siteId: hit.site.id,
      conversationId: requestedConversationId,
      visitorSessionId,
    })
    : null;

  const existingConversationActivities = requestedConversationId
    ? await prisma.activity.findMany({
      where: {
        constituent: { organizationId: hit.organizationId },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        constituent: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    })
    : [];

  const existingConversationActivity = existingConversationActivities.find((row) => {
    const metadata = readActivityMetadata(row.metadata);
    const publicEmbed = readActivityMetadata(metadata.publicEmbed as Prisma.JsonValue | null);
    return metadata.conversationId === requestedConversationId
      && metadata.visitorSessionId === visitorSessionId
      && publicEmbed.siteId === hit.site.id;
  });
  const existingConstituentId = existingConversationActivity?.constituentId ?? null;

  const matchedConstituent = await findExistingLiveComConstituent({
    organizationId: hit.organizationId,
    email,
    phone,
    existingConstituentId,
  });

  let constituent = matchedConstituent.constituent;
  let constituentMatchMethod = matchedConstituent.matchMethod;

  if (!constituent) {
    constituent = await prisma.constituent.create({
      data: {
        organizationId: hit.organizationId,
        type: "PROSPECT",
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        email: email || null,
        phone: phone || null,
        notes: [
          "Created from Site Embed LiveCom messenger conversation.",
          observedDomain ? `Domain: ${observedDomain}` : "",
          pageUrl ? `Page URL: ${pageUrl}` : "",
        ].filter(Boolean).join("\n"),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    });
    constituentMatchMethod = "created_new";
  }

  const donorName = `${constituent.firstName} ${constituent.lastName}`.trim();
  const visitorName = displayName || donorName || "Website Visitor";

  const activity = await prisma.activity.create({
    data: {
      constituentId: constituent.id,
      type: "NOTE",
      description: message,
      metadata: {
        source: "livecom",
        channel: "WEB_CHAT",
        conversationId,
        visitorSessionId,
        messageRole: "visitor",
        status: existingThread ? "OPEN" : "NEW",
        priority: "MEDIUM",
        owner: "Unassigned",
        assignedTo: "Unassigned",
        eventLabel: existingThread ? "Visitor Reply" : "Conversation Started",
        messagePreview: message.slice(0, 140),
        authorName: visitorName,
        donorName,
        visitorName,
        visitorEmail: email || null,
        visitorPhone: phone || null,
        constituentMatchMethod,
        readByStaff: false,
        publicEmbed: {
          siteId: hit.site.id,
          publicSiteId: hit.site.publicSiteId,
          domain: observedDomain,
          pageUrl,
          referrerUrl,
        },
      },
    },
    select: { id: true, createdAt: true },
  });

  const nowIso = new Date().toISOString();
  const nextSite: SiteEmbedSiteConfig = {
    ...hit.site,
    lastSuccessfulScriptLoad: {
      loadedAt: nowIso,
      domain: observedDomain,
      reason: "livecom_message_received",
      activeWidgets: getActiveWidgetKeys(hit.site),
    },
  };

  await saveOrganizationConfig(hit.organizationId, replaceSite(hit.config, nextSite), true);

  await logAudit({
    action: "LIVECOM_PUBLIC_MESSAGE_RECEIVED",
    entity: "Activity",
    entityId: activity.id,
    organizationId: hit.organizationId,
    metadata: {
      source: "site_embeds",
      siteId: hit.site.id,
      publicSiteId: hit.site.publicSiteId,
      domain: observedDomain,
      conversationId,
      constituentId: constituent.id,
      constituentMatchMethod,
    },
  });

  await notifyLiveComStaff({
    organizationId: hit.organizationId,
    conversationId,
    interactionId: activity.id,
    visitorName,
    message,
    siteName: hit.site.name || observedDomain || "Website",
  });

  res.status(201).json({
    data: {
      queued: true,
      conversationId,
      visitorSessionId,
      interactionId: activity.id,
      receivedAt: activity.createdAt.toISOString(),
      conversation: await loadPublicLiveComThread({
        organizationId: hit.organizationId,
        siteId: hit.site.id,
        conversationId,
        visitorSessionId,
      }),
    },
  });
});

router.use(requireAuth);

/**
 * GET /api/site-embeds/config
 * Returns full admin config, embed registry, and generated snippets for one selected site.
 */
router.get("/config", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const config = await loadOrganizationConfig(organizationId);
  const requestedSiteId = readStringInput(req, "siteId");
  const selectedSite = pickSite(config, requestedSiteId);

  const snippets = buildSiteEmbedSnippets(selectedSite, resolveApiBaseUrl(req));

  res.json({
    data: {
      registry: SITE_EMBED_REGISTRY,
      sites: config.sites,
      selectedSiteId: selectedSite.id,
      snippets,
      apiBaseUrl: resolveApiBaseUrl(req),
    },
  });
});

/**
 * POST /api/site-embeds/sites
 * Creates one additional site connection record for future multi-site support.
 */
router.post("/sites", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const config = await loadOrganizationConfig(organizationId);
  const site = buildDefaultSiteEmbedSiteConfig();

  const requestedName = readStringInput(req, "name");
  const requestedPrimaryDomain = normalizeDomainCandidate(readStringInput(req, "primaryDomain"));
  const requestedAllowedDomains = normalizeAllowedDomains((req.body as Record<string, unknown> | undefined)?.allowedDomains);

  site.name = requestedName || `Public Site ${config.sites.length + 1}`;
  site.primaryDomain = requestedPrimaryDomain;
  site.allowedDomains = requestedAllowedDomains;

  const nextConfig: SiteEmbedsConfig = {
    ...config,
    sites: [...config.sites, site],
  };

  await saveOrganizationConfig(organizationId, nextConfig, true);

  await logAudit({
    action: "SITE_EMBEDS_SITE_CREATED",
    entity: "PluginSetting",
    entityId: site.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      pluginKey: SITE_EMBEDS_PLUGIN_KEY,
      siteId: site.id,
      primaryDomain: site.primaryDomain,
    },
  });

  res.status(201).json({ data: { site } });
});

/**
 * PUT /api/site-embeds/config
 * Updates one selected site connection and widget settings.
 */
router.put("/config", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const config = await loadOrganizationConfig(organizationId);
  const siteId = readStringInput(req, "siteId");
  const selectedSite = pickSite(config, siteId);

  const body = (req.body as Record<string, unknown> | undefined) ?? {};

  const nextSite: SiteEmbedSiteConfig = {
    ...selectedSite,
    name: readStringInput(req, "name") || selectedSite.name,
    publicSiteId: readStringInput(req, "publicSiteId") || selectedSite.publicSiteId,
    primaryDomain: normalizeDomainCandidate(readStringInput(req, "primaryDomain") || selectedSite.primaryDomain),
    allowedDomains: normalizeAllowedDomains(body.allowedDomains ?? selectedSite.allowedDomains),
    active: typeof body.active === "boolean" ? body.active : selectedSite.active,
    appearance: mergeAppearanceSettings(selectedSite.appearance, body.appearance),
    widgets: mergeWidgetSettings(selectedSite.widgets, body.widgets),
  };

  if (!nextSite.embedToken) {
    nextSite.embedToken = createSiteEmbedToken();
  }

  const nextConfig = replaceSite(config, nextSite);
  await saveOrganizationConfig(organizationId, nextConfig, true);

  await logAudit({
    action: "SITE_EMBEDS_CONFIG_UPDATED",
    entity: "PluginSetting",
    entityId: nextSite.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      pluginKey: SITE_EMBEDS_PLUGIN_KEY,
      siteId: nextSite.id,
      active: nextSite.active,
      primaryDomain: nextSite.primaryDomain,
      allowedDomains: nextSite.allowedDomains,
      liveComEnabled: nextSite.widgets.liveCom.enabled,
    },
  });

  const snippets = buildSiteEmbedSnippets(nextSite, resolveApiBaseUrl(req));

  res.json({
    data: {
      site: nextSite,
      selectedSiteId: nextSite.id,
      snippets,
      sites: nextConfig.sites,
      registry: SITE_EMBED_REGISTRY,
    },
  });
});

/**
 * POST /api/site-embeds/regenerate-token
 * Rotates the public embed token for one selected site connection.
 */
router.post("/regenerate-token", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const config = await loadOrganizationConfig(organizationId);
  const siteId = readStringInput(req, "siteId");
  const selectedSite = pickSite(config, siteId);

  const nextSite: SiteEmbedSiteConfig = {
    ...selectedSite,
    embedToken: createSiteEmbedToken(),
    lastConnectionTestResult: null,
    lastSuccessfulScriptLoad: null,
  };

  const nextConfig = replaceSite(config, nextSite);
  await saveOrganizationConfig(organizationId, nextConfig, true);

  await logAudit({
    action: "SITE_EMBEDS_TOKEN_REGENERATED",
    entity: "PluginSetting",
    entityId: nextSite.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      pluginKey: SITE_EMBEDS_PLUGIN_KEY,
      siteId: nextSite.id,
    },
  });

  res.json({
    data: {
      site: nextSite,
      snippets: buildSiteEmbedSnippets(nextSite, resolveApiBaseUrl(req)),
    },
  });
});

/**
 * POST /api/site-embeds/test-connection
 * Evaluates site embed health using stored ping/load status and configuration validity.
 */
router.post("/test-connection", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(403).json({ error: { code: "ORG_REQUIRED", message: "No organization configured." } });
    return;
  }

  const config = await loadOrganizationConfig(organizationId);
  const siteId = readStringInput(req, "siteId");
  const selectedSite = pickSite(config, siteId);

  const issues: string[] = [];
  const activeWidgets = getActiveWidgetKeys(selectedSite);

  if (!selectedSite.primaryDomain) {
    issues.push("Primary domain is missing.");
  }

  if (!selectedSite.active) {
    issues.push("Site connection is inactive.");
  }

  if (!selectedSite.widgets.liveCom.enabled) {
    issues.push("LiveCom widget is disabled.");
  }

  if (!selectedSite.lastSuccessfulScriptLoad) {
    issues.push("No script load ping has been received yet.");
  }

  if (selectedSite.lastSuccessfulScriptLoad?.domain && !isDomainAllowedForSite(selectedSite, selectedSite.lastSuccessfulScriptLoad.domain)) {
    issues.push("Last script ping came from a domain not in the allow-list.");
  }

  if (selectedSite.lastSuccessfulScriptLoad?.loadedAt) {
    const lastPingAt = new Date(selectedSite.lastSuccessfulScriptLoad.loadedAt).getTime();
    if (Number.isFinite(lastPingAt)) {
      const ageMinutes = Math.floor((Date.now() - lastPingAt) / 60000);
      if (ageMinutes > 60) {
        issues.push(`Last script ping is stale (${ageMinutes} minutes ago).`);
      }
    }
  }

  const nowIso = new Date().toISOString();
  const ok = issues.length === 0;

  const nextSite: SiteEmbedSiteConfig = {
    ...selectedSite,
    lastConnectionTestResult: {
      ok,
      message: ok
        ? "Connection looks healthy. Script pings are active and domains are valid."
        : "Connection test found issues. Review and fix the highlighted configuration.",
      checkedAt: nowIso,
      observedDomain: selectedSite.lastSuccessfulScriptLoad?.domain || "",
      activeWidgets,
      issues,
    },
  };

  const nextConfig = replaceSite(config, nextSite);
  await saveOrganizationConfig(organizationId, nextConfig, true);

  await logAudit({
    action: "SITE_EMBEDS_CONNECTION_TESTED",
    entity: "PluginSetting",
    entityId: nextSite.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      pluginKey: SITE_EMBEDS_PLUGIN_KEY,
      siteId: nextSite.id,
      ok,
      issues,
    },
  });

  res.json({
    data: {
      result: nextSite.lastConnectionTestResult,
      site: nextSite,
    },
  });
});

export default router;
