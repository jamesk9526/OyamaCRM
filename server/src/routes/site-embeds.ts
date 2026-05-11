/** Site embeds routes for DonorCRM admin configuration, public loader delivery, and LiveCom website ingestion. */
import { Router } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { logAudit } from "../lib/audit.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
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
  type SiteEmbedSiteConfig,
  type SiteEmbedWidgetKey,
  type SiteEmbedWidgetSettings,
} from "../services/site-embeds.js";

const router = Router();

/** Applies permissive CORS headers for public no-auth embed endpoints used on external websites. */
function applyPublicEmbedCorsHeaders(res: import("express").Response): void {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type,Accept");
}

/** Handles CORS preflight for embed routes installed on non-CRM public websites. */
router.options(["/loader.js", "/public/ping", "/public/livecom", "/public/widget-data", "/public/widget-submit"], (_req, res) => {
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
  const nextLiveCom = partial.liveCom && typeof partial.liveCom === "object"
    ? {
      ...current.liveCom,
      ...partial.liveCom as Record<string, unknown>,
    }
    : current.liveCom;

  const enabledFlag = (key: keyof Omit<SiteEmbedWidgetSettings, "liveCom">) => {
    const candidate = partial[key];
    if (!candidate || typeof candidate !== "object") return current[key];
    const enabled = (candidate as Record<string, unknown>).enabled;
    return {
      enabled: typeof enabled === "boolean" ? enabled : current[key].enabled,
    };
  };

  return {
    liveCom: {
      enabled: typeof nextLiveCom.enabled === "boolean" ? nextLiveCom.enabled : current.liveCom.enabled,
      buttonLabel: String(nextLiveCom.buttonLabel ?? current.liveCom.buttonLabel).trim() || current.liveCom.buttonLabel,
      buttonPosition: nextLiveCom.buttonPosition === "bottom-left" ? "bottom-left" : "bottom-right",
      greetingMessage: String(nextLiveCom.greetingMessage ?? current.liveCom.greetingMessage).trim() || current.liveCom.greetingMessage,
    },
    campaign_meter: enabledFlag("campaign_meter"),
    donation_widget: enabledFlag("donation_widget"),
    event_card: enabledFlag("event_card"),
    volunteer_signup: enabledFlag("volunteer_signup"),
    newsletter_signup: enabledFlag("newsletter_signup"),
    impact_counter: enabledFlag("impact_counter"),
    cta_block: enabledFlag("cta_block"),
  };
}

/** Returns one JS response with warning output when loader generation cannot proceed. */
function sendLoaderWarning(res: import("express").Response, status: number, message: string) {
  res.status(status);
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=30");
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

  const script = buildSiteEmbedLoaderScript({
    apiBaseUrl: resolveApiBaseUrl(req),
    token,
    publicConfig: toPublicSiteEmbedConfig(hit.site),
  });

  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
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
  return Boolean(site.widgets[widgetKey]?.enabled);
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

/**
 * POST /api/site-embeds/public/livecom
 * Public LiveCom ingestion endpoint that creates a tracked interaction for DonorCRM inbox workflows.
 */
router.post("/public/livecom", async (req, res) => {
  const token = readStringInput(req, "token");
  const message = readStringInput(req, "message");
  const displayName = readStringInput(req, "name");
  const email = readStringInput(req, "email").toLowerCase();
  const pageUrl = readStringInput(req, "pageUrl");

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

  if (!hit.site.widgets.liveCom.enabled) {
    res.status(409).json({ error: { code: "LIVECOM_INACTIVE", message: "LiveCom widget is disabled for this site" } });
    return;
  }

  const observedDomain = resolveObservedDomain(req);
  if (!isDomainAllowedForSite(hit.site, observedDomain)) {
    res.status(403).json({ error: { code: "DOMAIN_NOT_ALLOWED", message: "Domain is not allowed for this embed token" } });
    return;
  }

  const parsedName = splitDisplayName(displayName);

  let constituent = email
    ? await prisma.constituent.findFirst({
      where: {
        organizationId: hit.organizationId,
        email,
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
      },
    })
    : null;

  if (!constituent) {
    constituent = await prisma.constituent.create({
      data: {
        organizationId: hit.organizationId,
        type: "PROSPECT",
        firstName: parsedName.firstName,
        lastName: parsedName.lastName,
        email: email || null,
        notes: [
          "Created from Site Embed LiveCom public message.",
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
  }

  const donorName = `${constituent.firstName} ${constituent.lastName}`.trim();

  const activity = await prisma.activity.create({
    data: {
      constituentId: constituent.id,
      type: "NOTE",
      description: message,
      metadata: {
        source: "livecom",
        channel: "WEB_CHAT",
        status: "NEW",
        priority: "MEDIUM",
        owner: "Website Inbox",
        eventLabel: "Website Chat Message",
        messagePreview: message.slice(0, 140),
        donorName,
        publicEmbed: {
          siteId: hit.site.id,
          publicSiteId: hit.site.publicSiteId,
          domain: observedDomain,
          pageUrl,
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
    },
  });

  res.status(201).json({
    data: {
      queued: true,
      interactionId: activity.id,
      receivedAt: activity.createdAt.toISOString(),
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
