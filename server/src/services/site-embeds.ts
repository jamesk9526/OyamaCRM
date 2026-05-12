/** Site embed registry, config parsing, snippet generation, and loader script builders for DonorCRM website embeds. */
import { randomUUID } from "crypto";

/** Plugin key used for storing site-embed settings in PluginSetting.config JSON. */
export const SITE_EMBEDS_PLUGIN_KEY = "site_embeds";

/** Supported embeddable widget keys for the DonorCRM public website integration layer. */
export type SiteEmbedWidgetKey =
  | "livecom"
  | "campaign_meter"
  | "donation_widget"
  | "event_card"
  | "volunteer_signup"
  | "newsletter_signup"
  | "impact_counter"
  | "cta_block";

/** Supported button positions for the LiveCom floating launcher. */
export type LiveComButtonPosition = "bottom-right" | "bottom-left";

/** Public-safe registry entry describing one embeddable type. */
export interface SiteEmbedRegistryEntry {
  /** Stable key used in config maps and loader decisions. */
  key: SiteEmbedWidgetKey;
  /** Human-friendly display name shown in admin UI. */
  name: string;
  /** Plain-language summary for nonprofit admins. */
  description: string;
  /** High-level widget classification used for future grouping/filtering. */
  type: "floating" | "inline" | "hybrid";
  /** Script usage guidance displayed in install instructions. */
  scriptRequirements: string;
  /** Whether the current release has a full working implementation. */
  implemented: boolean;
}

/** Public-safe LiveCom widget settings stored per connected website. */
export interface LiveComWidgetSettings {
  /** True when the floating LiveCom launcher should render on the public website. */
  enabled: boolean;
  /** The visible button label shown to website visitors. */
  buttonLabel: string;
  /** The side of the viewport where the launcher is anchored. */
  buttonPosition: LiveComButtonPosition;
  /** One-line greeting shown in the launcher panel header. */
  greetingMessage: string;
}

/** Per-widget state map for one connected public site. */
export interface SiteEmbedWidgetSettings {
  /** LiveCom floating messenger settings (first fully working use case). */
  liveCom: LiveComWidgetSettings;
  /** Placeholder state for campaign progress meters. */
  campaign_meter: { enabled: boolean };
  /** Placeholder state for donation widget blocks. */
  donation_widget: { enabled: boolean };
  /** Placeholder state for event and fundraising cards. */
  event_card: { enabled: boolean };
  /** Placeholder state for volunteer sign-up blocks. */
  volunteer_signup: { enabled: boolean };
  /** Placeholder state for newsletter sign-up blocks. */
  newsletter_signup: { enabled: boolean };
  /** Placeholder state for impact counters. */
  impact_counter: { enabled: boolean };
  /** Placeholder state for reusable CTA blocks. */
  cta_block: { enabled: boolean };
}

/** Last recorded connection-test result for one configured public site. */
export interface SiteEmbedConnectionTestResult {
  /** True when the last connection test passed all checks. */
  ok: boolean;
  /** Plain-language result summary shown to admins. */
  message: string;
  /** ISO timestamp for when this test result was recorded. */
  checkedAt: string;
  /** Domain observed during the test when available. */
  observedDomain?: string;
  /** Active widget keys observed during the test when available. */
  activeWidgets?: string[];
  /** Structured issues found during the test (missing config, stale ping, etc.). */
  issues?: string[];
}

/** Last successful script load observation from a public website runtime ping. */
export interface SiteEmbedScriptLoadStatus {
  /** ISO timestamp when the embed loader most recently pinged successfully. */
  loadedAt: string;
  /** Public domain that reported the successful loader ping. */
  domain: string;
  /** Loader reason marker to distinguish init, manual test, or heartbeat pings. */
  reason: string;
  /** Widget keys that were active on the reporting page. */
  activeWidgets: string[];
}

/** Configuration for one externally connected public website. */
export interface SiteEmbedSiteConfig {
  /** Internal unique ID for this site connection record. */
  id: string;
  /** Human-readable site name for admin display. */
  name: string;
  /** Public-facing site identifier used in snippets and diagnostics. */
  publicSiteId: string;
  /** Primary allowed domain for this connection (no protocol). */
  primaryDomain: string;
  /** Additional allowed domains and subdomains for script execution. */
  allowedDomains: string[];
  /** Public embed token used by scripts instead of private credentials. */
  embedToken: string;
  /** True when this site connection is allowed to serve embed configuration. */
  active: boolean;
  /** Per-widget configuration and enabled/disabled states. */
  widgets: SiteEmbedWidgetSettings;
  /** Last connection-test summary for this site. */
  lastConnectionTestResult: SiteEmbedConnectionTestResult | null;
  /** Last successful script-load ping for this site. */
  lastSuccessfulScriptLoad: SiteEmbedScriptLoadStatus | null;
}

/** Top-level persisted config blob for the site-embed plugin. */
export interface SiteEmbedsConfig {
  /** Schema version used for future migrations. */
  version: number;
  /** Connected public websites for the current organization. */
  sites: SiteEmbedSiteConfig[];
}

/** Public-safe config payload used by loader script generation and no-auth APIs. */
export interface SiteEmbedsPublicConfig {
  /** Connected site ID that the token resolves to. */
  siteId: string;
  /** Public site identifier displayed in diagnostics. */
  publicSiteId: string;
  /** Active state for the site connection itself. */
  active: boolean;
  /** Sanitized allowed domain list for this site connection. */
  allowedDomains: string[];
  /** Public-safe widget state map. */
  widgets: SiteEmbedWidgetSettings;
}

/** Generated install snippets for one connected public site. */
export interface SiteEmbedSnippetBundle {
  /** Script tag meant for the website <head> section. */
  headSnippet: string;
  /** Script block meant for placement before </body>. */
  footerSnippet: string;
  /** Optional inline placeholder embeds for future block widgets. */
  embedBlocks: Record<string, string>;
}

/** Registry of embeddable widgets for current and future DonorCRM website integrations. */
export const SITE_EMBED_REGISTRY: SiteEmbedRegistryEntry[] = [
  {
    key: "livecom",
    name: "LiveCom Messenger",
    description: "Floating chat button that captures donor conversations into DonorCRM communication workflows.",
    type: "floating",
    scriptRequirements: "Requires head loader script and body boot snippet.",
    implemented: true,
  },
  {
    key: "campaign_meter",
    name: "Campaign Progress Meter",
    description: "Inline fundraising progress meter for active campaigns.",
    type: "inline",
    scriptRequirements: "Requires head loader script and a campaign-meter embed block.",
    implemented: true,
  },
  {
    key: "donation_widget",
    name: "Donation Widget",
    description: "Inline giving widget block for public donation pages.",
    type: "inline",
    scriptRequirements: "Requires head loader script and a donation-widget embed block.",
    implemented: true,
  },
  {
    key: "event_card",
    name: "Event & Fundraising Card",
    description: "Embeddable event registration and fundraiser summary card.",
    type: "inline",
    scriptRequirements: "Requires head loader script and an event-card embed block.",
    implemented: true,
  },
  {
    key: "volunteer_signup",
    name: "Volunteer Sign-up",
    description: "Public volunteer interest form card connected to DonorCRM audiences.",
    type: "inline",
    scriptRequirements: "Requires head loader script and a volunteer-signup embed block.",
    implemented: true,
  },
  {
    key: "newsletter_signup",
    name: "Newsletter Sign-up",
    description: "Email signup block tied to DonorCRM communication segments.",
    type: "inline",
    scriptRequirements: "Requires head loader script and a newsletter-signup embed block.",
    implemented: true,
  },
  {
    key: "impact_counter",
    name: "Impact Counter",
    description: "Public-safe impact metrics counter block for donor engagement pages.",
    type: "inline",
    scriptRequirements: "Requires head loader script and an impact-counter embed block.",
    implemented: true,
  },
  {
    key: "cta_block",
    name: "Custom CTA Block",
    description: "Reusable call-to-action block for fundraising and stewardship prompts.",
    type: "hybrid",
    scriptRequirements: "Requires head loader script and a CTA embed block.",
    implemented: true,
  },
];

/** Generates a random public token for embed script usage. */
export function createSiteEmbedToken(): string {
  return randomUUID().replace(/-/g, "");
}

/** Generates a stable internal ID for one site connection entry. */
export function createSiteEmbedConnectionId(): string {
  return `site_${randomUUID().replace(/-/g, "")}`;
}

/** Builds default widget settings for one site connection. */
export function buildDefaultSiteEmbedWidgetSettings(): SiteEmbedWidgetSettings {
  return {
    liveCom: {
      enabled: true,
      buttonLabel: "Chat with us",
      buttonPosition: "bottom-right",
      greetingMessage: "Hi there! We can help with giving, events, and donor support.",
    },
    campaign_meter: { enabled: false },
    donation_widget: { enabled: false },
    event_card: { enabled: false },
    volunteer_signup: { enabled: false },
    newsletter_signup: { enabled: false },
    impact_counter: { enabled: false },
    cta_block: { enabled: false },
  };
}

/** Builds one default site-connection record for first-time setup. */
export function buildDefaultSiteEmbedSiteConfig(): SiteEmbedSiteConfig {
  return {
    id: createSiteEmbedConnectionId(),
    name: "Primary Public Website",
    publicSiteId: `pub_${Date.now().toString(36)}`,
    primaryDomain: "",
    allowedDomains: [],
    embedToken: createSiteEmbedToken(),
    active: true,
    widgets: buildDefaultSiteEmbedWidgetSettings(),
    lastConnectionTestResult: null,
    lastSuccessfulScriptLoad: null,
  };
}

/** Builds default plugin config when no persisted value exists. */
export function buildDefaultSiteEmbedsConfig(): SiteEmbedsConfig {
  return {
    version: 1,
    sites: [buildDefaultSiteEmbedSiteConfig()],
  };
}

/** Normalizes one domain value into host-only lowercase form. */
export function normalizeDomainCandidate(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (!raw) return "";

  try {
    const parsed = raw.includes("://") ? new URL(raw) : new URL(`https://${raw}`);
    return parsed.hostname.trim().toLowerCase();
  } catch {
    const withoutProtocol = raw.replace(/^https?:\/\//, "");
    const withoutPath = withoutProtocol.split("/")[0] ?? "";
    const withoutPort = withoutPath.split(":")[0] ?? "";
    return withoutPort.trim().toLowerCase();
  }
}

/** Normalizes freeform allowed-domain input into a deduplicated host list. */
export function normalizeAllowedDomains(input: unknown): string[] {
  const values = Array.isArray(input)
    ? input
    : typeof input === "string"
      ? input.split(/[\n,]/)
      : [];

  const normalized = values
    .map((value) => normalizeDomainCandidate(value))
    .filter((value) => value.length > 0);

  return Array.from(new Set(normalized));
}

/** Returns true when a domain matches one allowed-domain pattern. */
function matchesAllowedDomain(candidate: string, allowed: string): boolean {
  const cleanAllowed = allowed.trim().toLowerCase();
  if (!cleanAllowed) return false;

  // Explicit wildcard allows all domains for this token when the admin opts in.
  if (cleanAllowed === "*") {
    return true;
  }

  if (cleanAllowed.startsWith("*.")) {
    const suffix = cleanAllowed.slice(2);
    return candidate === suffix || candidate.endsWith(`.${suffix}`);
  }

  return candidate === cleanAllowed;
}

/** Returns true when the candidate domain is allowed for one site connection. */
export function isDomainAllowedForSite(site: SiteEmbedSiteConfig, domain: string): boolean {
  const normalizedDomain = normalizeDomainCandidate(domain);
  const candidates = normalizeAllowedDomains([site.primaryDomain, ...site.allowedDomains]);
  if (candidates.length === 0) return false;

  // If the request does not expose a usable domain, only allow explicit "*" config.
  if (!normalizedDomain) {
    return candidates.includes("*");
  }

  return candidates.some((allowed) => matchesAllowedDomain(normalizedDomain, allowed));
}

/** Normalizes one potentially-partial LiveCom widget payload against defaults. */
function normalizeLiveComWidgetSettings(value: unknown): LiveComWidgetSettings {
  const defaults = buildDefaultSiteEmbedWidgetSettings().liveCom;
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const input = value as Record<string, unknown>;
  const requestedPosition = String(input.buttonPosition ?? defaults.buttonPosition);
  const buttonPosition: LiveComButtonPosition = requestedPosition === "bottom-left" ? "bottom-left" : "bottom-right";

  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : defaults.enabled,
    buttonLabel: String(input.buttonLabel ?? defaults.buttonLabel).trim() || defaults.buttonLabel,
    buttonPosition,
    greetingMessage: String(input.greetingMessage ?? defaults.greetingMessage).trim() || defaults.greetingMessage,
  };
}

/** Normalizes one site widget-map payload into the full widget settings shape. */
function normalizeSiteWidgetSettings(value: unknown): SiteEmbedWidgetSettings {
  const defaults = buildDefaultSiteEmbedWidgetSettings();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const input = value as Record<string, unknown>;
  const readEnabled = (key: Exclude<SiteEmbedWidgetKey, "livecom">) => {
    const widget = input[key];
    if (!widget || typeof widget !== "object") return defaults[key];
    const enabled = (widget as Record<string, unknown>).enabled;
    return { enabled: typeof enabled === "boolean" ? enabled : defaults[key].enabled };
  };

  return {
    liveCom: normalizeLiveComWidgetSettings(input.liveCom),
    campaign_meter: readEnabled("campaign_meter"),
    donation_widget: readEnabled("donation_widget"),
    event_card: readEnabled("event_card"),
    volunteer_signup: readEnabled("volunteer_signup"),
    newsletter_signup: readEnabled("newsletter_signup"),
    impact_counter: readEnabled("impact_counter"),
    cta_block: readEnabled("cta_block"),
  };
}

/** Normalizes one connection-test result payload and drops invalid values. */
function normalizeConnectionTestResult(value: unknown): SiteEmbedConnectionTestResult | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;

  const checkedAt = String(input.checkedAt ?? "").trim();
  if (!checkedAt) return null;

  const issues = Array.isArray(input.issues)
    ? input.issues.map((item) => String(item).trim()).filter(Boolean)
    : [];
  const activeWidgets = Array.isArray(input.activeWidgets)
    ? input.activeWidgets.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    ok: Boolean(input.ok),
    message: String(input.message ?? "Connection test completed.").trim() || "Connection test completed.",
    checkedAt,
    observedDomain: normalizeDomainCandidate(input.observedDomain),
    activeWidgets,
    issues,
  };
}

/** Normalizes one script-load status payload and drops invalid values. */
function normalizeScriptLoadStatus(value: unknown): SiteEmbedScriptLoadStatus | null {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const loadedAt = String(input.loadedAt ?? "").trim();
  if (!loadedAt) return null;

  const activeWidgets = Array.isArray(input.activeWidgets)
    ? input.activeWidgets.map((item) => String(item).trim()).filter(Boolean)
    : [];

  return {
    loadedAt,
    domain: normalizeDomainCandidate(input.domain),
    reason: String(input.reason ?? "unknown").trim() || "unknown",
    activeWidgets,
  };
}

/** Normalizes one site-config payload and fills all required defaults. */
function normalizeSiteConfig(value: unknown): SiteEmbedSiteConfig {
  const defaults = buildDefaultSiteEmbedSiteConfig();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const input = value as Record<string, unknown>;
  const primaryDomain = normalizeDomainCandidate(input.primaryDomain);
  const allowedDomains = normalizeAllowedDomains(input.allowedDomains);

  return {
    id: String(input.id ?? defaults.id).trim() || defaults.id,
    name: String(input.name ?? defaults.name).trim() || defaults.name,
    publicSiteId: String(input.publicSiteId ?? defaults.publicSiteId).trim() || defaults.publicSiteId,
    primaryDomain,
    allowedDomains,
    embedToken: String(input.embedToken ?? defaults.embedToken).trim() || defaults.embedToken,
    active: typeof input.active === "boolean" ? input.active : defaults.active,
    widgets: normalizeSiteWidgetSettings(input.widgets),
    lastConnectionTestResult: normalizeConnectionTestResult(input.lastConnectionTestResult),
    lastSuccessfulScriptLoad: normalizeScriptLoadStatus(input.lastSuccessfulScriptLoad),
  };
}

/** Normalizes persisted plugin config and ensures at least one site record exists. */
export function parseSiteEmbedsConfig(raw: unknown): SiteEmbedsConfig {
  const defaults = buildDefaultSiteEmbedsConfig();
  if (!raw || typeof raw !== "object") {
    return defaults;
  }

  const input = raw as Record<string, unknown>;
  const sites = Array.isArray(input.sites)
    ? input.sites.map((site) => normalizeSiteConfig(site)).filter((site) => site.id.length > 0)
    : [];

  return {
    version: Number.isFinite(Number(input.version)) ? Number(input.version) : defaults.version,
    sites: sites.length > 0 ? sites : defaults.sites,
  };
}

/** Returns a public-safe config payload for loader/public APIs. */
export function toPublicSiteEmbedConfig(site: SiteEmbedSiteConfig): SiteEmbedsPublicConfig {
  return {
    siteId: site.id,
    publicSiteId: site.publicSiteId,
    active: site.active,
    allowedDomains: normalizeAllowedDomains([site.primaryDomain, ...site.allowedDomains]),
    widgets: site.widgets,
  };
}

/** Resolves active widget keys for diagnostics and script status reporting. */
export function getActiveWidgetKeys(site: SiteEmbedSiteConfig): string[] {
  const active: string[] = [];
  if (site.widgets.liveCom.enabled) active.push("livecom");
  if (site.widgets.campaign_meter.enabled) active.push("campaign_meter");
  if (site.widgets.donation_widget.enabled) active.push("donation_widget");
  if (site.widgets.event_card.enabled) active.push("event_card");
  if (site.widgets.volunteer_signup.enabled) active.push("volunteer_signup");
  if (site.widgets.newsletter_signup.enabled) active.push("newsletter_signup");
  if (site.widgets.impact_counter.enabled) active.push("impact_counter");
  if (site.widgets.cta_block.enabled) active.push("cta_block");
  return active;
}

/** Builds install-ready code snippets for one site connection. */
export function buildSiteEmbedSnippets(site: SiteEmbedSiteConfig, apiBaseUrl: string): SiteEmbedSnippetBundle {
  const safeApiBase = String(apiBaseUrl).replace(/\/$/, "");
  const safeToken = site.embedToken;

  const headSnippet = [
    "<!-- OyamaCRM Site Embed Loader (Head) -->",
    `<script src=\"${safeApiBase}/api/site-embeds/loader.js?token=${safeToken}\" data-oyama-site-id=\"${site.publicSiteId}\" defer></script>`,
  ].join("\n");

  const footerSnippet = [
    "<!-- OyamaCRM Embed Boot (Footer: before </body>) -->",
    "<script>",
    "  window.OyamaCRMEmbeds = window.OyamaCRMEmbeds || {};",
    "  if (typeof window.OyamaCRMEmbeds.boot === \"function\") {",
    "    window.OyamaCRMEmbeds.boot();",
    "  }",
    "</script>",
  ].join("\n");

  const embedBlocks: Record<string, string> = {
    campaign_meter: [
      "<!-- OyamaCRM Campaign Progress Meter Placeholder -->",
      `<div data-oyama-embed=\"campaign-meter\" data-oyama-site-token=\"${safeToken}\" data-campaign-id=\"annual-fund\"></div>`,
    ].join("\n"),
    donation_widget: [
      "<!-- OyamaCRM Donation Widget Placeholder -->",
      `<div data-oyama-embed=\"donation-widget\" data-oyama-site-token=\"${safeToken}\" data-designation=\"general-fund\"></div>`,
    ].join("\n"),
    event_card: [
      "<!-- OyamaCRM Event Card Placeholder -->",
      `<div data-oyama-embed=\"event-card\" data-oyama-site-token=\"${safeToken}\" data-event-id=\"next-event\"></div>`,
    ].join("\n"),
    volunteer_signup: [
      "<!-- OyamaCRM Volunteer Sign-up Placeholder -->",
      `<div data-oyama-embed=\"volunteer-signup\" data-oyama-site-token=\"${safeToken}\"></div>`,
    ].join("\n"),
    newsletter_signup: [
      "<!-- OyamaCRM Newsletter Sign-up Placeholder -->",
      `<div data-oyama-embed=\"newsletter-signup\" data-oyama-site-token=\"${safeToken}\"></div>`,
    ].join("\n"),
    impact_counter: [
      "<!-- OyamaCRM Impact Counter Placeholder -->",
      `<div data-oyama-embed=\"impact-counter\" data-oyama-site-token=\"${safeToken}\"></div>`,
    ].join("\n"),
    cta_block: [
      "<!-- OyamaCRM CTA Block Placeholder -->",
      `<div data-oyama-embed=\"cta-block\" data-oyama-site-token=\"${safeToken}\" data-headline=\"Support Our Mission\" data-body=\"Your generosity helps power life-changing work.\" data-button-label=\"Donate Today\" data-button-href=\"/donate\"></div>`,
    ].join("\n"),
  };

  return {
    headSnippet,
    footerSnippet,
    embedBlocks,
  };
}

/** Escapes one string for safe interpolation inside a JS single-quoted literal. */
function jsStringLiteral(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/<\//g, "<\\/");
}

/** Builds the public loader script that injects the LiveCom floating launcher and tracks loader pings. */
export function buildSiteEmbedLoaderScript(args: {
  apiBaseUrl: string;
  token: string;
  publicConfig: SiteEmbedsPublicConfig;
}): string {
  const apiBaseUrl = String(args.apiBaseUrl).replace(/\/$/, "");
  const token = jsStringLiteral(args.token);
  const publicConfigJson = JSON.stringify(args.publicConfig).replace(/</g, "\\u003c");

  return [
    "/* OyamaCRM Site Embed Loader */",
    "(function () {",
    "  var runtime = {",
    `    apiBaseUrl: '${jsStringLiteral(apiBaseUrl)}',`,
    `    token: '${token}',`,
    `    publicConfig: ${publicConfigJson}`,
    "  };",
    "",
    "  if (!runtime.token || !runtime.publicConfig || !runtime.publicConfig.active) {",
    "    return;",
    "  }",
    "",
    "  if (!window.OyamaCRMEmbeds) {",
    "    window.OyamaCRMEmbeds = {};",
    "  }",
    "",
    "  function ping(reason) {",
    "    try {",
    "      var url = runtime.apiBaseUrl + '/api/site-embeds/public/ping?token=' + encodeURIComponent(runtime.token) +",
    "        '&domain=' + encodeURIComponent(window.location.hostname || '') +",
    "        '&reason=' + encodeURIComponent(reason || 'loader_ping') +",
    "        '&widgets=' + encodeURIComponent(getActiveWidgets().join(',')) +",
    "        '&pageUrl=' + encodeURIComponent(window.location.href || '');",
    "      var img = new Image();",
    "      img.src = url;",
    "    } catch (_err) {",
    "      // Best-effort ping only.",
    "    }",
    "  }",
    "",
    "  function getActiveWidgets() {",
    "    var active = [];",
    "    var widgets = runtime.publicConfig.widgets || {};",
    "    if (widgets.liveCom && widgets.liveCom.enabled) active.push('livecom');",
    "    if (widgets.campaign_meter && widgets.campaign_meter.enabled) active.push('campaign_meter');",
    "    if (widgets.donation_widget && widgets.donation_widget.enabled) active.push('donation_widget');",
    "    if (widgets.event_card && widgets.event_card.enabled) active.push('event_card');",
    "    if (widgets.volunteer_signup && widgets.volunteer_signup.enabled) active.push('volunteer_signup');",
    "    if (widgets.newsletter_signup && widgets.newsletter_signup.enabled) active.push('newsletter_signup');",
    "    if (widgets.impact_counter && widgets.impact_counter.enabled) active.push('impact_counter');",
    "    if (widgets.cta_block && widgets.cta_block.enabled) active.push('cta_block');",
    "    return active;",
    "  }",
    "",
    "  function getWidgetKeyForEmbedType(embedType) {",
    "    var map = {",
    "      'campaign-meter': 'campaign_meter',",
    "      'donation-widget': 'donation_widget',",
    "      'event-card': 'event_card',",
    "      'volunteer-signup': 'volunteer_signup',",
    "      'newsletter-signup': 'newsletter_signup',",
    "      'impact-counter': 'impact_counter',",
    "      'cta-block': 'cta_block'",
    "    };",
    "    return map[embedType] || '';",
    "  }",
    "",
    "  function renderBaseCard(node, title, body) {",
    "    node.innerHTML = '';",
    "    node.style.border = '1px solid #d1d5db';",
    "    node.style.borderRadius = '12px';",
    "    node.style.background = '#ffffff';",
    "    node.style.padding = '14px';",
    "    node.style.fontFamily = 'Segoe UI, Arial, sans-serif';",
    "    node.style.boxShadow = '0 8px 20px rgba(15, 23, 42, 0.08)';",
    "",
    "    var heading = document.createElement('h3');",
    "    heading.style.margin = '0';",
    "    heading.style.fontSize = '14px';",
    "    heading.style.fontWeight = '700';",
    "    heading.style.color = '#111827';",
    "    heading.textContent = title;",
    "",
    "    var text = document.createElement('p');",
    "    text.style.margin = '6px 0 0 0';",
    "    text.style.fontSize = '12px';",
    "    text.style.color = '#4b5563';",
    "    text.textContent = body;",
    "",
    "    node.appendChild(heading);",
    "    node.appendChild(text);",
    "  }",
    "",
    "  function formatMoney(value) {",
    "    var amount = Number(value || 0);",
    "    if (!isFinite(amount)) amount = 0;",
    "    try {",
    "      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount);",
    "    } catch (_err) {",
    "      return '$' + amount.toFixed(0);",
    "    }",
    "  }",
    "",
    "  function loadWidgetData(widgetKey, node) {",
    "    var params = new URLSearchParams();",
    "    params.set('token', runtime.token);",
    "    params.set('widget', widgetKey);",
    "    params.set('domain', String(window.location.hostname || ''));",
    "    params.set('pageUrl', String(window.location.href || ''));",
    "",
    "    var campaignId = String(node.getAttribute('data-oyama-campaign-id') || node.getAttribute('data-campaign-id') || '');",
    "    var eventId = String(node.getAttribute('data-oyama-event-id') || node.getAttribute('data-event-id') || '');",
    "    var designation = String(node.getAttribute('data-oyama-designation') || node.getAttribute('data-designation') || '');",
    "    var headline = String(node.getAttribute('data-oyama-headline') || node.getAttribute('data-headline') || '');",
    "    var body = String(node.getAttribute('data-oyama-body') || node.getAttribute('data-body') || '');",
    "    var buttonLabel = String(node.getAttribute('data-oyama-button-label') || node.getAttribute('data-button-label') || '');",
    "    var buttonHref = String(node.getAttribute('data-oyama-button-href') || node.getAttribute('data-button-href') || '');",
    "",
    "    if (campaignId) params.set('campaignId', campaignId);",
    "    if (eventId) params.set('eventId', eventId);",
    "    if (designation) params.set('designation', designation);",
    "    if (headline) params.set('headline', headline);",
    "    if (body) params.set('body', body);",
    "    if (buttonLabel) params.set('buttonLabel', buttonLabel);",
    "    if (buttonHref) params.set('buttonHref', buttonHref);",
    "",
    "    return fetch(runtime.apiBaseUrl + '/api/site-embeds/public/widget-data?' + params.toString(), {",
    "      method: 'GET',",
    "      mode: 'cors',",
    "      credentials: 'omit'",
    "    }).then(function (response) {",
    "      if (!response.ok) throw new Error('widget_data_' + response.status);",
    "      return response.json();",
    "    }).then(function (payload) {",
    "      return payload && payload.data ? payload.data : {};",
    "    });",
    "  }",
    "",
    "  function submitWidget(widgetKey, payload, statusNode) {",
    "    var params = new URLSearchParams();",
    "    params.set('token', runtime.token);",
    "    params.set('widget', widgetKey);",
    "    params.set('domain', String(window.location.hostname || ''));",
    "    params.set('pageUrl', String(window.location.href || ''));",
    "",
    "    var keys = Object.keys(payload || {});",
    "    for (var i = 0; i < keys.length; i += 1) {",
    "      var key = keys[i];",
    "      var value = payload[key];",
    "      if (value !== undefined && value !== null && String(value).trim()) {",
    "        params.set(key, String(value));",
    "      }",
    "    }",
    "",
    "    if (statusNode) statusNode.textContent = 'Submitting...';",
    "",
    "    return fetch(runtime.apiBaseUrl + '/api/site-embeds/public/widget-submit', {",
    "      method: 'POST',",
    "      mode: 'cors',",
    "      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },",
    "      body: params.toString()",
    "    }).then(function (response) {",
    "      if (!response.ok) throw new Error('widget_submit_' + response.status);",
    "      return response.json();",
    "    }).then(function () {",
    "      if (statusNode) statusNode.textContent = 'Submitted. Thank you!';",
    "      ping(widgetKey + '_submit');",
    "    }).catch(function () {",
    "      if (statusNode) statusNode.textContent = 'Submission failed. Please try again.';",
    "    });",
    "  }",
    "",
    "  function renderInlineEmbeds() {",
    "    var widgets = runtime.publicConfig.widgets || {};",
    "    var nodes = document.querySelectorAll('[data-oyama-embed]');",
    "    for (var i = 0; i < nodes.length; i += 1) {",
    "      var node = nodes[i];",
    "      if (node.getAttribute('data-oyama-mounted') === 'true') continue;",
    "",
    "      var embedType = String(node.getAttribute('data-oyama-embed') || '').trim();",
    "      var widgetKey = getWidgetKeyForEmbedType(embedType);",
    "      if (!widgetKey) continue;",
    "",
    "      if (!widgets[widgetKey] || !widgets[widgetKey].enabled) {",
    "        renderBaseCard(node, 'Embed Disabled', 'Enable this widget in DonorCRM Site Embeds settings.');",
    "        node.setAttribute('data-oyama-mounted', 'true');",
    "        continue;",
    "      }",
    "",
    "      loadWidgetData(widgetKey, node).then(function (currentNode, currentWidgetKey) {",
    "        return function (data) {",
    "          if (currentWidgetKey === 'campaign_meter') {",
    "            var campaign = data.campaign || null;",
    "            renderBaseCard(currentNode, 'Campaign Progress', campaign ? String(campaign.name || 'Active Campaign') : 'No Active Campaign');",
    "            if (campaign) {",
    "              var detail = document.createElement('p');",
    "              detail.style.margin = '8px 0 0 0';",
    "              detail.style.fontSize = '12px';",
    "              detail.style.color = '#374151';",
    "              detail.textContent = formatMoney(campaign.raised || 0) + ' raised (' + String(campaign.progressPercent || 0) + '%)';",
    "              currentNode.appendChild(detail);",
    "            }",
    "          } else if (currentWidgetKey === 'event_card') {",
    "            var eventInfo = data.event || null;",
    "            renderBaseCard(currentNode, 'Event & Fundraising', eventInfo ? String(eventInfo.name || 'Upcoming Event') : 'No Upcoming Event');",
    "            if (eventInfo) {",
    "              var eventMeta = document.createElement('p');",
    "              eventMeta.style.margin = '8px 0 0 0';",
    "              eventMeta.style.fontSize = '12px';",
    "              eventMeta.style.color = '#374151';",
    "              eventMeta.textContent = String(eventInfo.startDateLabel || 'Upcoming') + ' | Guests: ' + String(eventInfo.guestCount || 0);",
    "              currentNode.appendChild(eventMeta);",
    "            }",
    "          } else if (currentWidgetKey === 'impact_counter') {",
    "            renderBaseCard(currentNode, 'Impact Counter', 'Public-safe metrics from your DonorCRM data');",
    "            var metrics = data.metrics || {};",
    "            var impacts = document.createElement('p');",
    "            impacts.style.margin = '8px 0 0 0';",
    "            impacts.style.fontSize = '12px';",
    "            impacts.style.color = '#374151';",
    "            impacts.textContent = 'Constituents: ' + String(metrics.constituentCount || 0) + ' | Gifts: ' + String(metrics.completedDonationCount || 0) + ' | Revenue: ' + formatMoney(metrics.completedDonationAmount || 0);",
    "            currentNode.appendChild(impacts);",
    "          } else if (currentWidgetKey === 'cta_block') {",
    "            renderBaseCard(currentNode, String(data.headline || 'Support Our Mission'), String(data.body || 'Your support creates impact.'));",
    "            var cta = document.createElement('a');",
    "            cta.href = String(data.buttonHref || '/donate');",
    "            cta.target = '_blank';",
    "            cta.rel = 'noopener noreferrer';",
    "            cta.style.display = 'inline-block';",
    "            cta.style.marginTop = '10px';",
    "            cta.style.padding = '8px 12px';",
    "            cta.style.borderRadius = '8px';",
    "            cta.style.background = '#16a34a';",
    "            cta.style.color = '#ffffff';",
    "            cta.style.textDecoration = 'none';",
    "            cta.style.fontSize = '12px';",
    "            cta.style.fontWeight = '600';",
    "            cta.textContent = String(data.buttonLabel || 'Take Action');",
    "            cta.addEventListener('click', function () {",
    "              submitWidget('cta_block', { message: 'cta_clicked' }, null);",
    "            });",
    "            currentNode.appendChild(cta);",
    "          } else {",
    "            var title = currentWidgetKey === 'donation_widget' ? 'Donation Widget' : (currentWidgetKey === 'volunteer_signup' ? 'Volunteer Sign-up' : 'Newsletter Sign-up');",
    "            var subtitle = currentWidgetKey === 'donation_widget' ? 'Capture donation interest from website visitors.' : 'Collect supporter details from your public website.';",
    "            renderBaseCard(currentNode, title, subtitle);",
    "",
    "            var email = document.createElement('input');",
    "            email.type = 'email';",
    "            email.placeholder = 'Email';",
    "            email.style.width = '100%';",
    "            email.style.boxSizing = 'border-box';",
    "            email.style.padding = '8px 10px';",
    "            email.style.border = '1px solid #d1d5db';",
    "            email.style.borderRadius = '8px';",
    "            email.style.fontSize = '12px';",
    "            email.style.marginTop = '8px';",
    "",
    "            var button = document.createElement('button');",
    "            button.type = 'button';",
    "            button.style.width = '100%';",
    "            button.style.padding = '9px 12px';",
    "            button.style.border = 'none';",
    "            button.style.borderRadius = '8px';",
    "            button.style.background = '#16a34a';",
    "            button.style.color = '#ffffff';",
    "            button.style.fontSize = '12px';",
    "            button.style.fontWeight = '600';",
    "            button.style.cursor = 'pointer';",
    "            button.style.marginTop = '8px';",
    "            button.textContent = currentWidgetKey === 'donation_widget' ? 'Send Donation Interest' : 'Submit';",
    "",
    "            var status = document.createElement('p');",
    "            status.style.margin = '8px 0 0 0';",
    "            status.style.fontSize = '11px';",
    "            status.style.color = '#6b7280';",
    "            status.style.minHeight = '14px';",
    "",
    "            button.addEventListener('click', function () {",
    "              submitWidget(currentWidgetKey, { email: String(email.value || '').trim() }, status);",
    "            });",
    "",
    "            currentNode.appendChild(email);",
    "            currentNode.appendChild(button);",
    "            currentNode.appendChild(status);",
    "          }",
    "",
    "          currentNode.setAttribute('data-oyama-mounted', 'true');",
    "          ping(currentWidgetKey + '_rendered');",
    "        };",
    "      }(node, widgetKey)).catch(function (currentNode) {",
    "        return function () {",
    "          renderBaseCard(currentNode, 'Embed Unavailable', 'Widget data could not be loaded. Verify token, domain, and widget settings.');",
    "          currentNode.setAttribute('data-oyama-mounted', 'true');",
    "        };",
    "      }(node));",
    "    }",
    "  }",
    "",
    "  function ensureLiveCom() {",
    "    var widgets = runtime.publicConfig.widgets || {};",
    "    var liveCom = widgets.liveCom || {};",
    "    if (!liveCom.enabled) return;",
    "",
    "    if (document.getElementById('oyama-livecom-launcher')) {",
    "      return;",
    "    }",
    "",
    "    var wrapper = document.createElement('div');",
    "    wrapper.id = 'oyama-livecom-launcher';",
    "    wrapper.style.position = 'fixed';",
    "    wrapper.style.zIndex = '2147483650';",
    "    wrapper.style.fontFamily = 'Segoe UI, Arial, sans-serif';",
    "",
    "    var isLeft = liveCom.buttonPosition === 'bottom-left';",
    "    wrapper.style.bottom = '22px';",
    "    if (isLeft) {",
    "      wrapper.style.left = '22px';",
    "    } else {",
    "      wrapper.style.right = '22px';",
    "    }",
    "",
    "    var panel = document.createElement('div');",
    "    panel.style.display = 'none';",
    "    panel.style.width = '320px';",
    "    panel.style.maxWidth = 'calc(100vw - 24px)';",
    "    panel.style.background = '#ffffff';",
    "    panel.style.border = '1px solid #d1d5db';",
    "    panel.style.borderRadius = '14px';",
    "    panel.style.boxShadow = '0 18px 40px rgba(15, 23, 42, 0.24)';",
    "    panel.style.marginBottom = '10px';",
    "    panel.style.overflow = 'hidden';",
    "",
    "    var header = document.createElement('div');",
    "    header.style.padding = '12px 14px';",
    "    header.style.background = '#16a34a';",
    "    header.style.color = '#ffffff';",
    "    header.style.fontWeight = '600';",
    "    header.style.fontSize = '14px';",
    "    header.textContent = String(liveCom.greetingMessage || 'How can we help?');",
    "",
    "    var body = document.createElement('div');",
    "    body.style.padding = '12px';",
    "",
    "    var helper = document.createElement('p');",
    "    helper.style.margin = '0 0 8px 0';",
    "    helper.style.fontSize = '12px';",
    "    helper.style.color = '#4b5563';",
    "    helper.textContent = 'Send a message and our team can follow up from OyamaCRM LiveCom.';",
    "",
    "    var nameInput = document.createElement('input');",
    "    nameInput.placeholder = 'Your name';",
    "    nameInput.style.width = '100%';",
    "    nameInput.style.boxSizing = 'border-box';",
    "    nameInput.style.marginBottom = '8px';",
    "    nameInput.style.padding = '8px 10px';",
    "    nameInput.style.border = '1px solid #d1d5db';",
    "    nameInput.style.borderRadius = '8px';",
    "    nameInput.style.fontSize = '13px';",
    "",
    "    var emailInput = document.createElement('input');",
    "    emailInput.placeholder = 'Email (optional)';",
    "    emailInput.type = 'email';",
    "    emailInput.style.width = '100%';",
    "    emailInput.style.boxSizing = 'border-box';",
    "    emailInput.style.marginBottom = '8px';",
    "    emailInput.style.padding = '8px 10px';",
    "    emailInput.style.border = '1px solid #d1d5db';",
    "    emailInput.style.borderRadius = '8px';",
    "    emailInput.style.fontSize = '13px';",
    "",
    "    var messageInput = document.createElement('textarea');",
    "    messageInput.placeholder = 'How can we help today?';",
    "    messageInput.rows = 4;",
    "    messageInput.style.width = '100%';",
    "    messageInput.style.boxSizing = 'border-box';",
    "    messageInput.style.marginBottom = '8px';",
    "    messageInput.style.padding = '8px 10px';",
    "    messageInput.style.border = '1px solid #d1d5db';",
    "    messageInput.style.borderRadius = '8px';",
    "    messageInput.style.fontSize = '13px';",
    "    messageInput.style.resize = 'vertical';",
    "",
    "    var status = document.createElement('div');",
    "    status.style.fontSize = '12px';",
    "    status.style.color = '#475569';",
    "    status.style.minHeight = '16px';",
    "    status.style.marginBottom = '8px';",
    "",
    "    var submit = document.createElement('button');",
    "    submit.type = 'button';",
    "    submit.textContent = 'Send Message';",
    "    submit.style.width = '100%';",
    "    submit.style.padding = '9px 12px';",
    "    submit.style.border = 'none';",
    "    submit.style.borderRadius = '9px';",
    "    submit.style.background = '#16a34a';",
    "    submit.style.color = '#ffffff';",
    "    submit.style.cursor = 'pointer';",
    "    submit.style.fontWeight = '600';",
    "",
    "    submit.addEventListener('click', function () {",
    "      var message = String(messageInput.value || '').trim();",
    "      if (!message) {",
    "        status.textContent = 'Please enter a message before sending.';",
    "        return;",
    "      }",
    "",
    "      status.textContent = 'Sending message...';",
    "      var payload = new URLSearchParams();",
    "      payload.set('token', runtime.token);",
    "      payload.set('name', String(nameInput.value || '').trim());",
    "      payload.set('email', String(emailInput.value || '').trim());",
    "      payload.set('message', message);",
    "      payload.set('domain', String(window.location.hostname || ''));",
    "      payload.set('pageUrl', String(window.location.href || ''));",
    "",
    "      fetch(runtime.apiBaseUrl + '/api/site-embeds/public/livecom', {",
    "        method: 'POST',",
    "        mode: 'cors',",
    "        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },",
    "        body: payload.toString()",
    "      }).then(function () {",
    "        status.textContent = 'Message sent. Our team will follow up soon.';",
    "        messageInput.value = '';",
    "        ping('livecom_message_sent');",
    "      }).catch(function () {",
    "        status.textContent = 'Message queued. Please try again in a moment if needed.';",
    "      });",
    "    });",
    "",
    "    body.appendChild(helper);",
    "    body.appendChild(nameInput);",
    "    body.appendChild(emailInput);",
    "    body.appendChild(messageInput);",
    "    body.appendChild(status);",
    "    body.appendChild(submit);",
    "",
    "    panel.appendChild(header);",
    "    panel.appendChild(body);",
    "",
    "    var launcher = document.createElement('button');",
    "    launcher.type = 'button';",
    "    launcher.textContent = String(liveCom.buttonLabel || 'Chat with us');",
    "    launcher.style.border = 'none';",
    "    launcher.style.borderRadius = '9999px';",
    "    launcher.style.padding = '11px 16px';",
    "    launcher.style.background = '#16a34a';",
    "    launcher.style.color = '#ffffff';",
    "    launcher.style.fontWeight = '600';",
    "    launcher.style.cursor = 'pointer';",
    "    launcher.style.boxShadow = '0 12px 24px rgba(22, 163, 74, 0.35)';",
    "",
    "    launcher.addEventListener('click', function () {",
    "      var open = panel.style.display !== 'none';",
    "      panel.style.display = open ? 'none' : 'block';",
    "      ping(open ? 'livecom_closed' : 'livecom_opened');",
    "    });",
    "",
    "    wrapper.appendChild(panel);",
    "    wrapper.appendChild(launcher);",
    "    document.body.appendChild(wrapper);",
    "",
    "    window.OyamaCRMEmbeds.openLiveCom = function () {",
    "      panel.style.display = 'block';",
    "      ping('livecom_open_api');",
    "    };",
    "  }",
    "",
    "  window.OyamaCRMEmbeds.boot = function () {",
    "    ensureLiveCom();",
    "    renderInlineEmbeds();",
    "    ping('loader_boot');",
    "  };",
    "",
    "  window.OyamaCRMEmbeds.refreshInlineEmbeds = function () {",
    "    renderInlineEmbeds();",
    "  };",
    "",
    "  if (document.readyState === 'loading') {",
    "    document.addEventListener('DOMContentLoaded', function () {",
    "      window.OyamaCRMEmbeds.boot();",
    "    });",
    "  } else {",
    "    window.OyamaCRMEmbeds.boot();",
    "  }",
    "})();",
  ].join("\n");
}
