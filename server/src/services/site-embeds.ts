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

/** Supported icon styles for the LiveCom chathead button. */
export type LiveComIconStyle = "chat" | "spark" | "heart" | "hand";

/** Supported public embed visual modes for site-wide widget surfaces. */
export type SiteEmbedThemeMode = "light" | "soft" | "transparent";

/** Supported density choices for public embed controls and cards. */
export type SiteEmbedDensity = "comfortable" | "compact";

/** Supported corner radius styles for public embed cards and controls. */
export type SiteEmbedCornerRadius = "square" | "soft" | "rounded";

/** Supported card chrome styles for inline public embeds. */
export type SiteEmbedCardStyle = "flat" | "bordered" | "elevated";

/** Supported button treatments for public embed CTAs. */
export type SiteEmbedButtonStyle = "solid" | "soft" | "outline";

/** Supported hosted font stack choices for public embed widgets. */
export type SiteEmbedFontFamily = "system" | "serif" | "rounded";

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
  /** Brand color used for the circular chathead launcher and panel accents. */
  chatheadColor: string;
  /** Icon glyph style rendered inside the chathead. */
  iconStyle: LiveComIconStyle;
  /** Organization name shown in the panel header. */
  orgName: string;
  /** Short tagline shown under the org name in the panel header. */
  orgSubtitle: string;
  /** URL to org avatar/logo displayed in panel header (leave blank to hide). */
  avatarUrl: string;
  /** Width of the chat panel in pixels (280–480). */
  panelWidth: number;
  /** Response time hint shown under the panel header. */
  responseTimeText: string;
  /** Placeholder text inside the message textarea. */
  messagePlaceholder: string;
  /** Show "Powered by OyamaCRM" footer in the panel. */
  showBranding: boolean;
}

/** Donation widget settings with Stripe checkout support. */
export interface DonationWidgetSettings {
  enabled: boolean;
  /** Mission headline shown at top of widget. */
  headline: string;
  /** Short supporting copy below headline. */
  supportingCopy: string;
  /** Preset gift amounts shown as quick-select buttons. */
  suggestedAmounts: number[];
  /** Minimum allowed gift amount in cents. */
  minimumAmountCents: number;
  /** Whether monthly/recurring giving option is shown. */
  enableMonthlyGiving: boolean;
  /** Default gift designation. */
  defaultDesignation: string;
  /** All allowed gift designations (comma-separated or array). */
  allowedDesignations: string[];
  /** Accent color for amount buttons and CTA. Falls back to site accent. */
  accentColor: string;
  /** Trust line shown near the CTA button. */
  trustLine: string;
  /** Success message shown after payment completes. */
  successMessage: string;
  /** Failure/cancel message shown when payment is not completed. */
  failureMessage: string;
  /** Whether to use Stripe test mode for this widget. */
  stripeTestMode: boolean;
}

/** Campaign meter widget settings. */
export interface CampaignMeterSettings {
  enabled: boolean;
  /** Campaign ID to display (empty = use first active campaign). */
  campaignId: string;
  /** CTA button label. */
  ctaLabel: string;
  /** CTA button href. */
  ctaHref: string;
  /** Accent color for the filled progress bar. */
  accentColor: string;
}

/** Event card widget settings. */
export interface EventCardSettings {
  enabled: boolean;
  /** Event ID to display (empty = use next upcoming event). */
  eventId: string;
  /** Show fundraising progress bar if event has a goal. */
  showFundraisingProgress: boolean;
  /** Accent color for the card actions. */
  accentColor: string;
}

/** Volunteer sign-up widget settings. */
export interface VolunteerSignupSettings {
  enabled: boolean;
  /** Headline copy. */
  headline: string;
  /** Short supporting copy. */
  supportingCopy: string;
  /** Interest area options. */
  interestAreas: string[];
  /** Success message after form submit. */
  successMessage: string;
  /** Accent color for submit button. */
  accentColor: string;
}

/** Newsletter sign-up widget settings. */
export interface NewsletterSignupSettings {
  enabled: boolean;
  /** Headline copy. */
  headline: string;
  /** Short supporting copy. */
  supportingCopy: string;
  /** Consent/legal line shown under the form. */
  consentLine: string;
  /** Success message after sign-up. */
  successMessage: string;
  /** Accent color for sign-up button. */
  accentColor: string;
}

/** Impact counter widget settings. */
export interface ImpactCounterSettings {
  enabled: boolean;
  /** JSON array of { label, value } stat objects (stored as string). */
  statsJson: string;
  /** Small disclaimer shown below stats. */
  disclaimer: string;
  /** Accent color for stat numbers. */
  accentColor: string;
}

/** Custom CTA block widget settings. */
export interface CtaBlockSettings {
  enabled: boolean;
  /** Headline copy. */
  headline: string;
  /** Body copy. */
  bodyCopy: string;
  /** Primary button label. */
  primaryButtonLabel: string;
  /** Primary button href. */
  primaryButtonHref: string;
  /** Optional secondary button label. */
  secondaryButtonLabel: string;
  /** Optional secondary button href. */
  secondaryButtonHref: string;
  /** Layout style: card | banner | minimal. */
  layout: "card" | "banner" | "minimal";
  /** Accent color for the primary button. */
  accentColor: string;
}

/** Site-wide appearance settings shared by all public embeds for one connected website. */
export interface SiteEmbedAppearanceSettings {
  /** Site-level accent color used when a widget does not override its own accent. */
  accentColor: string;
  /** Card/background color for light and soft embed modes. */
  backgroundColor: string;
  /** Primary readable text color for public widgets. */
  textColor: string;
  /** Secondary readable text color for helper copy. */
  mutedTextColor: string;
  /** Border color for cards, fields, and low-emphasis controls. */
  borderColor: string;
  /** Overall surface mode for inline widgets. */
  themeMode: SiteEmbedThemeMode;
  /** Compactness level for shared padding and control sizing. */
  density: SiteEmbedDensity;
  /** Corner treatment applied consistently across embed cards and controls. */
  cornerRadius: SiteEmbedCornerRadius;
  /** Inline card chrome treatment. */
  cardStyle: SiteEmbedCardStyle;
  /** CTA button treatment for shared button helpers. */
  buttonStyle: SiteEmbedButtonStyle;
  /** Font stack choice for widgets without requiring external font loading. */
  fontFamily: SiteEmbedFontFamily;
}

/** Per-widget state map for one connected public site. */
export interface SiteEmbedWidgetSettings {
  /** LiveCom floating messenger settings. */
  liveCom: LiveComWidgetSettings;
  /** Donation widget with Stripe checkout settings. */
  donation_widget: DonationWidgetSettings;
  /** Campaign progress meter settings. */
  campaign_meter: CampaignMeterSettings;
  /** Event and fundraising card settings. */
  event_card: EventCardSettings;
  /** Volunteer sign-up form settings. */
  volunteer_signup: VolunteerSignupSettings;
  /** Newsletter sign-up form settings. */
  newsletter_signup: NewsletterSignupSettings;
  /** Impact counter block settings. */
  impact_counter: ImpactCounterSettings;
  /** Custom CTA block settings. */
  cta_block: CtaBlockSettings;
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
  /** Site-wide visual defaults used by every public widget. */
  appearance: SiteEmbedAppearanceSettings;
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
  /** Public-safe visual defaults used by loader-rendered widgets. */
  appearance: SiteEmbedAppearanceSettings;
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
      chatheadColor: "#16a34a",
      iconStyle: "chat",
      orgName: "",
      orgSubtitle: "",
      avatarUrl: "",
      panelWidth: 340,
      responseTimeText: "Typically replies within a few hours",
      messagePlaceholder: "How can we help you today?",
      showBranding: true,
    },
    donation_widget: {
      enabled: false,
      headline: "Support Our Mission",
      supportingCopy: "Your generosity helps provide free, compassionate care and practical support to families in our community.",
      suggestedAmounts: [25, 50, 100, 250, 500],
      minimumAmountCents: 500,
      enableMonthlyGiving: true,
      defaultDesignation: "General Fund",
      allowedDesignations: ["General Fund", "Client Services", "Events", "Material Resources"],
      accentColor: "",
      trustLine: "Your information is sent securely.",
      successMessage: "Thank you for your gift! Your generosity makes a real difference.",
      failureMessage: "Your gift was not completed. No payment was recorded. You can try again or contact us directly.",
      stripeTestMode: true,
    },
    campaign_meter: {
      enabled: false,
      campaignId: "",
      ctaLabel: "Give to this Campaign",
      ctaHref: "",
      accentColor: "",
    },
    event_card: {
      enabled: false,
      eventId: "",
      showFundraisingProgress: true,
      accentColor: "",
    },
    volunteer_signup: {
      enabled: false,
      headline: "Interested in Volunteering?",
      supportingCopy: "Tell us a little about yourself and how you would like to help. Our team will follow up with next steps.",
      interestAreas: ["Client support", "Events", "Office help", "Donor support", "Prayer team", "Other"],
      successMessage: "Thank you. Your interest has been sent to our team.",
      accentColor: "",
    },
    newsletter_signup: {
      enabled: false,
      headline: "Stay Connected",
      supportingCopy: "Receive updates, stories, and ways to support the mission.",
      consentLine: "We'll only send updates from our organization.",
      successMessage: "You're signed up!",
      accentColor: "",
    },
    impact_counter: {
      enabled: false,
      statsJson: JSON.stringify([
        { label: "Client visits", value: "1,250+" },
        { label: "Pregnancy tests", value: "840+" },
        { label: "Ultrasounds", value: "320+" },
        { label: "Resources shared", value: "2,100+" },
      ]),
      disclaimer: "Impact numbers are updated periodically.",
      accentColor: "",
    },
    cta_block: {
      enabled: false,
      headline: "Support Our Mission",
      bodyCopy: "Your generosity helps power life-changing work.",
      primaryButtonLabel: "Donate Today",
      primaryButtonHref: "/donate",
      secondaryButtonLabel: "",
      secondaryButtonHref: "",
      layout: "card",
      accentColor: "",
    },
  };
}

/** Builds default site-wide appearance settings for a connected public website. */
export function buildDefaultSiteEmbedAppearanceSettings(): SiteEmbedAppearanceSettings {
  return {
    accentColor: "#16a34a",
    backgroundColor: "#ffffff",
    textColor: "#111827",
    mutedTextColor: "#6b7280",
    borderColor: "#e5e7eb",
    themeMode: "light",
    density: "comfortable",
    cornerRadius: "soft",
    cardStyle: "elevated",
    buttonStyle: "solid",
    fontFamily: "system",
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
    appearance: buildDefaultSiteEmbedAppearanceSettings(),
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
  // No domain restrictions configured → allow all (admin hasn't locked it down yet).
  if (candidates.length === 0) return true;

  // If the request does not expose a usable domain, only allow explicit "*" config.
  if (!normalizedDomain) {
    return candidates.includes("*");
  }

  return candidates.some((allowed) => matchesAllowedDomain(normalizedDomain, allowed));
}

/** Returns true when a string is a six-character hex color accepted by embed theming. */
function isSixDigitHexColor(value: unknown): value is string {
  return /^#[0-9a-fA-F]{6}$/.test(String(value ?? "").trim());
}

/** Normalizes site-wide appearance settings and prevents unsafe style values from persisting. */
function normalizeSiteEmbedAppearanceSettings(value: unknown): SiteEmbedAppearanceSettings {
  const defaults = buildDefaultSiteEmbedAppearanceSettings();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const input = value as Record<string, unknown>;
  const themeModeRaw = String(input.themeMode ?? defaults.themeMode).trim().toLowerCase();
  const densityRaw = String(input.density ?? defaults.density).trim().toLowerCase();
  const cornerRaw = String(input.cornerRadius ?? defaults.cornerRadius).trim().toLowerCase();
  const cardStyleRaw = String(input.cardStyle ?? defaults.cardStyle).trim().toLowerCase();
  const buttonStyleRaw = String(input.buttonStyle ?? defaults.buttonStyle).trim().toLowerCase();
  const fontRaw = String(input.fontFamily ?? defaults.fontFamily).trim().toLowerCase();

  return {
    accentColor: isSixDigitHexColor(input.accentColor) ? String(input.accentColor).trim() : defaults.accentColor,
    backgroundColor: isSixDigitHexColor(input.backgroundColor) ? String(input.backgroundColor).trim() : defaults.backgroundColor,
    textColor: isSixDigitHexColor(input.textColor) ? String(input.textColor).trim() : defaults.textColor,
    mutedTextColor: isSixDigitHexColor(input.mutedTextColor) ? String(input.mutedTextColor).trim() : defaults.mutedTextColor,
    borderColor: isSixDigitHexColor(input.borderColor) ? String(input.borderColor).trim() : defaults.borderColor,
    themeMode: themeModeRaw === "soft" ? "soft" : themeModeRaw === "transparent" ? "transparent" : "light",
    density: densityRaw === "compact" ? "compact" : "comfortable",
    cornerRadius: cornerRaw === "square" ? "square" : cornerRaw === "rounded" ? "rounded" : "soft",
    cardStyle: cardStyleRaw === "flat" ? "flat" : cardStyleRaw === "bordered" ? "bordered" : "elevated",
    buttonStyle: buttonStyleRaw === "soft" ? "soft" : buttonStyleRaw === "outline" ? "outline" : "solid",
    fontFamily: fontRaw === "serif" ? "serif" : fontRaw === "rounded" ? "rounded" : "system",
  };
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
  const requestedIconStyle = String(input.iconStyle ?? defaults.iconStyle).trim().toLowerCase();
  const iconStyle: LiveComIconStyle = requestedIconStyle === "spark"
    ? "spark"
    : requestedIconStyle === "heart"
      ? "heart"
      : requestedIconStyle === "hand"
        ? "hand"
        : "chat";
  const requestedColor = String(input.chatheadColor ?? defaults.chatheadColor).trim();
  const chatheadColor = isSixDigitHexColor(requestedColor) ? requestedColor : defaults.chatheadColor;
  const requestedWidth = Number(input.panelWidth ?? defaults.panelWidth);
  const panelWidth = Number.isFinite(requestedWidth) && requestedWidth >= 280 && requestedWidth <= 480
    ? Math.round(requestedWidth)
    : defaults.panelWidth;

  return {
    enabled: typeof input.enabled === "boolean" ? input.enabled : defaults.enabled,
    buttonLabel: String(input.buttonLabel ?? defaults.buttonLabel).trim() || defaults.buttonLabel,
    buttonPosition,
    greetingMessage: String(input.greetingMessage ?? defaults.greetingMessage).trim() || defaults.greetingMessage,
    chatheadColor,
    iconStyle,
    orgName: String(input.orgName ?? defaults.orgName).trim(),
    orgSubtitle: String(input.orgSubtitle ?? defaults.orgSubtitle).trim(),
    avatarUrl: String(input.avatarUrl ?? defaults.avatarUrl).trim(),
    panelWidth,
    responseTimeText: String(input.responseTimeText ?? defaults.responseTimeText).trim(),
    messagePlaceholder: String(input.messagePlaceholder ?? defaults.messagePlaceholder).trim() || defaults.messagePlaceholder,
    showBranding: typeof input.showBranding === "boolean" ? input.showBranding : defaults.showBranding,
  };
}

/** Normalizes one site widget-map payload into the full widget settings shape. */
function normalizeSiteWidgetSettings(value: unknown): SiteEmbedWidgetSettings {
  const defaults = buildDefaultSiteEmbedWidgetSettings();
  if (!value || typeof value !== "object") {
    return defaults;
  }

  const input = value as Record<string, unknown>;

  const readBool = (obj: Record<string, unknown>, key: string, fallback: boolean): boolean => {
    const v = obj[key];
    if (typeof v === "boolean") return v;
    if (typeof v === "string") return v.toLowerCase() === "true";
    return fallback;
  };

  const readStr = (obj: Record<string, unknown>, key: string, fallback: string): string => {
    const v = obj[key];
    return typeof v === "string" ? v : fallback;
  };

  const readNum = (obj: Record<string, unknown>, key: string, fallback: number): number => {
    const v = Number(obj[key]);
    return Number.isFinite(v) ? v : fallback;
  };

  const normWidget = <T>(key: string, def: T, merge: (raw: Record<string, unknown>, def: T) => T): T => {
    const raw = input[key];
    if (!raw || typeof raw !== "object") return def;
    const enabled = (raw as Record<string, unknown>).enabled;
    const enabledVal = typeof enabled === "boolean" ? enabled : typeof enabled === "string" ? enabled === "true" : (def as { enabled: boolean }).enabled;
    return merge(raw as Record<string, unknown>, { ...def, enabled: enabledVal });
  };

  const normDonation = (raw: Record<string, unknown>, def: DonationWidgetSettings): DonationWidgetSettings => ({
    enabled: readBool(raw, "enabled", def.enabled),
    headline: readStr(raw, "headline", def.headline),
    supportingCopy: readStr(raw, "supportingCopy", def.supportingCopy),
    suggestedAmounts: Array.isArray(raw.suggestedAmounts)
      ? (raw.suggestedAmounts as unknown[]).map(Number).filter((n) => Number.isFinite(n) && n > 0)
      : def.suggestedAmounts,
    minimumAmountCents: readNum(raw, "minimumAmountCents", def.minimumAmountCents),
    enableMonthlyGiving: readBool(raw, "enableMonthlyGiving", def.enableMonthlyGiving),
    defaultDesignation: readStr(raw, "defaultDesignation", def.defaultDesignation),
    allowedDesignations: Array.isArray(raw.allowedDesignations)
      ? (raw.allowedDesignations as unknown[]).map(String)
      : typeof raw.allowedDesignations === "string"
        ? raw.allowedDesignations.split(",").map((s) => s.trim()).filter(Boolean)
        : def.allowedDesignations,
    accentColor: isSixDigitHexColor(raw.accentColor) ? String(raw.accentColor).trim() : def.accentColor,
    trustLine: readStr(raw, "trustLine", def.trustLine),
    successMessage: readStr(raw, "successMessage", def.successMessage),
    failureMessage: readStr(raw, "failureMessage", def.failureMessage),
    stripeTestMode: readBool(raw, "stripeTestMode", def.stripeTestMode),
  });

  const normCampaignMeter = (raw: Record<string, unknown>, def: CampaignMeterSettings): CampaignMeterSettings => ({
    enabled: readBool(raw, "enabled", def.enabled),
    campaignId: readStr(raw, "campaignId", def.campaignId),
    ctaLabel: readStr(raw, "ctaLabel", def.ctaLabel),
    ctaHref: readStr(raw, "ctaHref", def.ctaHref),
    accentColor: isSixDigitHexColor(raw.accentColor) ? String(raw.accentColor).trim() : def.accentColor,
  });

  const normEventCard = (raw: Record<string, unknown>, def: EventCardSettings): EventCardSettings => ({
    enabled: readBool(raw, "enabled", def.enabled),
    eventId: readStr(raw, "eventId", def.eventId),
    showFundraisingProgress: readBool(raw, "showFundraisingProgress", def.showFundraisingProgress),
    accentColor: isSixDigitHexColor(raw.accentColor) ? String(raw.accentColor).trim() : def.accentColor,
  });

  const normVolunteer = (raw: Record<string, unknown>, def: VolunteerSignupSettings): VolunteerSignupSettings => ({
    enabled: readBool(raw, "enabled", def.enabled),
    headline: readStr(raw, "headline", def.headline),
    supportingCopy: readStr(raw, "supportingCopy", def.supportingCopy),
    interestAreas: Array.isArray(raw.interestAreas)
      ? (raw.interestAreas as unknown[]).map((item) => String(item).trim()).filter(Boolean)
      : typeof raw.interestAreas === "string"
        ? raw.interestAreas.split(",").map((item) => item.trim()).filter(Boolean)
        : def.interestAreas,
    successMessage: readStr(raw, "successMessage", def.successMessage),
    accentColor: isSixDigitHexColor(raw.accentColor) ? String(raw.accentColor).trim() : def.accentColor,
  });

  const normNewsletter = (raw: Record<string, unknown>, def: NewsletterSignupSettings): NewsletterSignupSettings => ({
    enabled: readBool(raw, "enabled", def.enabled),
    headline: readStr(raw, "headline", def.headline),
    supportingCopy: readStr(raw, "supportingCopy", def.supportingCopy),
    consentLine: readStr(raw, "consentLine", def.consentLine),
    successMessage: readStr(raw, "successMessage", def.successMessage),
    accentColor: isSixDigitHexColor(raw.accentColor) ? String(raw.accentColor).trim() : def.accentColor,
  });

  const normImpact = (raw: Record<string, unknown>, def: ImpactCounterSettings): ImpactCounterSettings => ({
    enabled: readBool(raw, "enabled", def.enabled),
    statsJson: readStr(raw, "statsJson", def.statsJson),
    disclaimer: readStr(raw, "disclaimer", def.disclaimer),
    accentColor: isSixDigitHexColor(raw.accentColor) ? String(raw.accentColor).trim() : def.accentColor,
  });

  const normCta = (raw: Record<string, unknown>, def: CtaBlockSettings): CtaBlockSettings => {
    const layoutRaw = String(raw.layout ?? def.layout).toLowerCase();
    const layout: CtaBlockSettings["layout"] = layoutRaw === "banner" ? "banner" : layoutRaw === "minimal" ? "minimal" : "card";
    return {
      enabled: readBool(raw, "enabled", def.enabled),
      headline: readStr(raw, "headline", def.headline),
      bodyCopy: readStr(raw, "bodyCopy", def.bodyCopy),
      primaryButtonLabel: readStr(raw, "primaryButtonLabel", def.primaryButtonLabel),
      primaryButtonHref: readStr(raw, "primaryButtonHref", def.primaryButtonHref),
      secondaryButtonLabel: readStr(raw, "secondaryButtonLabel", def.secondaryButtonLabel),
      secondaryButtonHref: readStr(raw, "secondaryButtonHref", def.secondaryButtonHref),
      layout,
      accentColor: isSixDigitHexColor(raw.accentColor) ? String(raw.accentColor).trim() : def.accentColor,
    };
  };

  return {
    liveCom: normalizeLiveComWidgetSettings(input.liveCom),
    donation_widget: normWidget("donation_widget", defaults.donation_widget, normDonation),
    campaign_meter: normWidget("campaign_meter", defaults.campaign_meter, normCampaignMeter),
    event_card: normWidget("event_card", defaults.event_card, normEventCard),
    volunteer_signup: normWidget("volunteer_signup", defaults.volunteer_signup, normVolunteer),
    newsletter_signup: normWidget("newsletter_signup", defaults.newsletter_signup, normNewsletter),
    impact_counter: normWidget("impact_counter", defaults.impact_counter, normImpact),
    cta_block: normWidget("cta_block", defaults.cta_block, normCta),
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
    appearance: normalizeSiteEmbedAppearanceSettings(input.appearance),
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
    appearance: normalizeSiteEmbedAppearanceSettings(site.appearance),
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

/** Builds the public loader script that injects LiveCom, donation widget, and all inline embed widgets. */
export function buildSiteEmbedLoaderScript(args: {
  apiBaseUrl: string;
  token: string;
  publicConfig: SiteEmbedsPublicConfig;
}): string {
  const apiBaseUrl = String(args.apiBaseUrl).replace(/\/$/, "");
  const token = jsStringLiteral(args.token);
  const publicConfigJson = JSON.stringify(args.publicConfig).replace(/</g, "\\u003c");

  return `/* OyamaCRM Site Embed Loader */
(function () {
  var runtime = {
    apiBaseUrl: '${jsStringLiteral(apiBaseUrl)}',
    token: '${token}',
    publicConfig: ${publicConfigJson}
  };
  if (!runtime.token || !runtime.publicConfig || !runtime.publicConfig.active) return;

  window.OyamaCRMEmbeds = window.OyamaCRMEmbeds || {};

  var _APPEARANCE = runtime.publicConfig.appearance || {};
  var _FONT = fontStack(_APPEARANCE.fontFamily);

  // ── Utilities ─────────────────────────────────────────────────

  function fontStack(choice) {
    choice = String(choice || 'system').toLowerCase();
    if (choice === 'serif') return "Georgia,'Times New Roman',serif";
    if (choice === 'rounded') return "'Segoe UI Rounded','Aptos Rounded',system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
    return "system-ui,-apple-system,'Segoe UI',Helvetica,Arial,sans-serif";
  }

  function safeHex(value, fallback) {
    var c = String(value || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c : fallback;
  }

  function themeColor(key, fallback) {
    return safeHex(_APPEARANCE[key], fallback);
  }

  function themeAccent() {
    return themeColor('accentColor', '#16a34a');
  }

  function themeRadius(kind) {
    var style = String(_APPEARANCE.cornerRadius || 'soft').toLowerCase();
    var base = style === 'square' ? 6 : style === 'rounded' ? 18 : 12;
    if (kind === 'control') return Math.max(4, base - 3) + 'px';
    if (kind === 'pill') return '9999px';
    return base + 'px';
  }

  function themePadding(defaultPadding, compactPadding) {
    return String(_APPEARANCE.density || 'comfortable') === 'compact' ? compactPadding : defaultPadding;
  }

  function applyTextTheme(node) {
    node.style.color = themeColor('textColor', '#111827');
    node.style.fontFamily = _FONT;
    return node;
  }

  function ping(reason) {
    try {
      var u = runtime.apiBaseUrl + '/api/site-embeds/public/ping' +
        '?token=' + encodeURIComponent(runtime.token) +
        '&domain=' + encodeURIComponent(window.location.hostname || '') +
        '&reason=' + encodeURIComponent(reason || 'loader') +
        '&pageUrl=' + encodeURIComponent(window.location.href || '');
      (new Image()).src = u;
    } catch (_) {}
  }

  function isWidgetEnabled(key) {
    var w = runtime.publicConfig.widgets || {};
    var camel = key.replace(/_([a-z])/g, function (_, g) { return g.toUpperCase(); });
    var candidates = [w[key], w[camel]];
    if (key === 'livecom') {
      candidates.push(w.liveCom, w.livecom);
    }
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c && typeof c === 'object') return c.enabled === true || String(c.enabled) === 'true';
    }
    return false;
  }

  function getCfg(key) {
    var w = runtime.publicConfig.widgets || {};
    var camel = key.replace(/_([a-z])/g, function (_, g) { return g.toUpperCase(); });
    if (key === 'livecom') {
      return w[key] || w[camel] || w.liveCom || w.livecom || {};
    }
    return w[key] || w[camel] || {};
  }

  function accentColor(cfg, fallback) {
    var c = String((cfg && cfg.accentColor) || '').trim();
    return /^#[0-9a-fA-F]{6}$/.test(c) ? c : (fallback || themeAccent());
  }

  function formatMoney(n) {
    n = Number(n || 0);
    if (!isFinite(n)) n = 0;
    try { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n); }
    catch (_) { return '$' + n.toFixed(0); }
  }

  function el(tag, styles, props) {
    var e = document.createElement(tag);
    if (styles) {
      var ks = Object.keys(styles);
      for (var i = 0; i < ks.length; i++) e.style[ks[i]] = styles[ks[i]];
    }
    if (props) {
      var ps = Object.keys(props);
      for (var j = 0; j < ps.length; j++) {
        var k = ps[j], v = String(props[k]);
        if (k === 'text') e.textContent = v;
        else if (k === 'html') e.innerHTML = v;
        else e.setAttribute(k, v);
      }
    }
    return e;
  }

  function ap(parent) {
    for (var i = 1; i < arguments.length; i++) {
      if (arguments[i] != null) parent.appendChild(arguments[i]);
    }
    return parent;
  }

  function cardBase(node) {
    var mode = String(_APPEARANCE.themeMode || 'light').toLowerCase();
    var cardStyle = String(_APPEARANCE.cardStyle || 'elevated').toLowerCase();
    node.style.fontFamily = _FONT;
    node.style.color = themeColor('textColor', '#111827');
    node.style.background = mode === 'transparent' ? 'transparent' : themeColor('backgroundColor', mode === 'soft' ? '#f8fafc' : '#ffffff');
    node.style.border = cardStyle === 'flat' || mode === 'transparent' ? 'none' : ('1px solid ' + themeColor('borderColor', '#e5e7eb'));
    node.style.borderRadius = themeRadius('card');
    node.style.boxShadow = cardStyle === 'elevated' && mode !== 'transparent' ? '0 4px 24px rgba(15,23,42,0.08)' : 'none';
    node.style.overflow = 'hidden';
    node.style.boxSizing = 'border-box';
    node.style.width = '100%';
    node.style.maxWidth = '100%';
    node.style.minWidth = '0';
    node.innerHTML = '';
  }

  function isNarrowViewport() {
    try {
      return !!(window.matchMedia && window.matchMedia('(max-width: 520px)').matches);
    } catch (_) {
      return (window.innerWidth || 999) <= 520;
    }
  }

  function responsivePadding(desktopValue, mobileValue) {
    return isNarrowViewport() ? mobileValue : desktopValue;
  }

  function mkInput(placeholder, type, extraCss) {
    var inp = el('input', {
      width: '100%', boxSizing: 'border-box', padding: themePadding('10px 12px', '8px 10px'),
      border: '1.5px solid ' + themeColor('borderColor', '#d1d5db'), borderRadius: themeRadius('control'), fontSize: '14px',
      fontFamily: _FONT, background: '#fafafa', color: themeColor('textColor', '#111827'),
      outline: 'none', display: 'block', minHeight: '44px', maxWidth: '100%'
    }, { type: type || 'text', placeholder: placeholder || '' });
    if (extraCss) {
      var ks = Object.keys(extraCss);
      for (var i = 0; i < ks.length; i++) inp.style[ks[i]] = extraCss[ks[i]];
    }
    inp.addEventListener('focus', function () { inp.style.borderColor = themeAccent(); inp.style.background = '#fff'; });
    inp.addEventListener('blur', function () { inp.style.borderColor = themeColor('borderColor', '#d1d5db'); inp.style.background = '#fafafa'; });
    return inp;
  }

  function mkBtn(label, bg, color, borderColor) {
    var requestedBg = bg || themeAccent();
    var requestedColor = color || '#ffffff';
    var style = String(_APPEARANCE.buttonStyle || 'solid').toLowerCase();
    var finalBg = requestedBg;
    var finalColor = requestedColor;
    var finalBorder = borderColor ? ('1.5px solid ' + borderColor) : 'none';
    if (!borderColor && requestedColor === '#ffffff') {
      if (style === 'outline') {
        finalBg = 'transparent';
        finalColor = requestedBg;
        finalBorder = '1.5px solid ' + requestedBg;
      } else if (style === 'soft') {
        finalBg = requestedBg + '18';
        finalColor = requestedBg;
        finalBorder = '1.5px solid ' + requestedBg + '44';
      }
    }
    var b = el('button', {
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      padding: themePadding('10px 18px', '8px 14px'), border: finalBorder,
      borderRadius: themeRadius('control'), background: finalBg, color: finalColor,
      fontSize: '14px', fontWeight: '600', cursor: 'pointer', fontFamily: _FONT,
      minHeight: '44px', boxSizing: 'border-box', maxWidth: '100%', textAlign: 'center'
    }, { type: 'button', text: label });
    b.addEventListener('mouseover', function () { b.style.opacity = '0.85'; });
    b.addEventListener('mouseout', function () { b.style.opacity = '1'; });
    return b;
  }

  function mkSelect(options, extraCss) {
    var sel = el('select', {
      width: '100%', boxSizing: 'border-box', padding: themePadding('10px 12px', '8px 10px'),
      border: '1.5px solid ' + themeColor('borderColor', '#d1d5db'), borderRadius: themeRadius('control'), fontSize: '14px',
      fontFamily: _FONT, background: '#fafafa', color: themeColor('textColor', '#111827'), outline: 'none',
      minHeight: '44px', maxWidth: '100%'
    });
    if (extraCss) {
      var ks = Object.keys(extraCss);
      for (var i = 0; i < ks.length; i++) sel.style[ks[i]] = extraCss[ks[i]];
    }
    for (var j = 0; j < options.length; j++) {
      var opt = document.createElement('option');
      opt.value = options[j].value;
      opt.textContent = options[j].label;
      sel.appendChild(opt);
    }
    return sel;
  }

  function accentBar(col) {
    return el('div', { height: '4px', background: col, borderRadius: themeRadius('pill'), marginBottom: themePadding('18px', '12px') });
  }

  function loadStripe(pubKey, cb) {
    if (window.Stripe) { cb(window.Stripe(pubKey)); return; }
    var s = document.createElement('script');
    s.src = 'https://js.stripe.com/v3/';
    s.onload = function () { cb(window.Stripe ? window.Stripe(pubKey) : null); };
    s.onerror = function () { cb(null); };
    document.head.appendChild(s);
  }

  // ── Donation Widget ────────────────────────────────────────────

  function renderDonationWidget(node) {
    var cfg = getCfg('donation_widget');
    var col = accentColor(cfg);
    var colLight = col + '18'; // 10% opacity tint for backgrounds
    var colBorder = col + '44';
    cardBase(node);
    node.style.maxWidth = '560px';
    node.style.marginLeft = 'auto';
    node.style.marginRight = 'auto';

    var suggested = Array.isArray(cfg.suggestedAmounts) && cfg.suggestedAmounts.length
      ? cfg.suggestedAmounts : [25, 50, 100, 250, 500];
    var allowMonthly = cfg.enableMonthlyGiving !== false;
    var designations = Array.isArray(cfg.allowedDesignations) && cfg.allowedDesignations.length
      ? cfg.allowedDesignations : [(cfg.defaultDesignation || 'General Fund')];
    var desigHint = String(cfg.defaultDesignation || "Your gift will be used where it's needed most.");
    var selAmount = suggested[1] || suggested[0] || 50;
    var customAmt = null;
    var showCustom = false;
    var giftType = 'one-time';
    var designation = designations[0] || 'General Fund';

    // ── Outer scroll container
    var wrap = el('div', { padding: responsivePadding('28px 28px 20px', '18px 14px 16px'), boxSizing: 'border-box' });

    // ── Hero header
    var iconCircle = el('div', {
      width: '52px', height: '52px', borderRadius: '50%', background: colLight,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 14px', fontSize: '24px'
    }, { html: '<svg viewBox="0 0 24 24" width="26" height="26" fill="' + col + '"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A5.98 5.98 0 0116.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>' });
    var heroTitle = el('h3', {
      margin: '0 0 8px', fontSize: 'clamp(21px, 6vw, 26px)', fontWeight: '800', color: '#1a1a2e',
      textAlign: 'center', lineHeight: '1.2', fontFamily: _FONT, letterSpacing: '0'
    }, { text: String(cfg.headline || 'Support Our Mission') });
    var heroSub = el('p', {
      margin: '0 0 24px', fontSize: '15px', color: '#6b7280', textAlign: 'center',
      lineHeight: '1.6', fontFamily: _FONT, maxWidth: '380px', marginLeft: 'auto', marginRight: 'auto'
    }, { text: String(cfg.supportingCopy || 'Your generosity helps power life-changing work in our community.') });
    ap(wrap, iconCircle, heroTitle, heroSub);

    // ── Helpers to build section labels
    function sectionLabel(num, text) {
      var row = el('div', { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', marginTop: '4px' });
      var badge = el('span', {
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        width: '22px', height: '22px', borderRadius: '50%', background: col,
        color: '#fff', fontSize: '12px', fontWeight: '700', flexShrink: '0', fontFamily: _FONT
      }, { text: String(num) });
      var lbl = el('span', { fontSize: '14px', fontWeight: '700', color: '#111827', fontFamily: _FONT }, { text: text });
      ap(row, badge, lbl);
      return row;
    }

    // ── Section 1: Amount
    ap(wrap, sectionLabel(1, 'Choose Gift Amount'));

    var amtRow = el('div', { display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' });
    var amtBtns = [];
    var maxAmts = Math.min(5, suggested.length);
    for (var ai = 0; ai < maxAmts; ai++) {
      (function (amt) {
        var b = el('button', {
          flex: '1 1 96px', minWidth: isNarrowViewport() ? 'calc(50% - 6px)' : '60px', padding: '11px 8px',
          border: '1.5px solid #e5e7eb', borderRadius: '10px',
          background: '#ffffff', color: '#374151', fontSize: '15px', fontWeight: '600',
          cursor: 'pointer', fontFamily: _FONT, transition: 'all .15s ease', minHeight: '44px', boxSizing: 'border-box'
        }, { type: 'button', text: formatMoney(amt) });
        amtBtns.push({ b: b, amt: amt });
        b.addEventListener('click', function () {
          selAmount = amt; customAmt = null; showCustom = false;
          customWrap.style.display = 'none'; syncAmts();
        });
        amtRow.appendChild(b);
      })(suggested[ai]);
    }
    // Custom button
    var customBtn = el('button', {
      flex: '1 1 96px', minWidth: isNarrowViewport() ? 'calc(50% - 6px)' : '72px', padding: '11px 8px',
      border: '1.5px solid #e5e7eb', borderRadius: '10px',
      background: '#ffffff', color: '#374151', fontSize: '15px', fontWeight: '600',
      cursor: 'pointer', fontFamily: _FONT, transition: 'all .15s ease', minHeight: '44px', boxSizing: 'border-box'
    }, { type: 'button', text: 'Custom' });
    amtRow.appendChild(customBtn);
    ap(wrap, amtRow);

    // Custom amount input row
    var customWrap = el('div', { display: 'none', marginBottom: '14px' });
    var customPrefix = el('div', {
      position: 'relative', display: 'flex', alignItems: 'center'
    });
    var customDollar = el('span', {
      position: 'absolute', left: '12px', fontSize: '15px', color: '#6b7280',
      fontWeight: '600', fontFamily: _FONT, userSelect: 'none'
    }, { text: '$' });
    var customInp = el('input', {
      width: '100%', boxSizing: 'border-box', paddingLeft: '28px', paddingRight: '12px',
      paddingTop: '11px', paddingBottom: '11px',
      border: '1.5px solid ' + col, borderRadius: '10px', fontSize: '15px',
      fontFamily: _FONT, background: '#fff', color: '#111827', outline: 'none', minHeight: '44px'
    }, { type: 'number', placeholder: 'Enter amount', min: '1', step: '1' });
    customInp.addEventListener('input', function () {
      var v = parseFloat(customInp.value);
      customAmt = v > 0 ? v : null;
      selAmount = null;
      syncAmts();
    });
    ap(customPrefix, customDollar, customInp);
    ap(customWrap, customPrefix);
    ap(wrap, customWrap);

    customBtn.addEventListener('click', function () {
      selAmount = null; customAmt = null; showCustom = true;
      customWrap.style.display = 'block';
      customInp.focus();
      syncAmts();
    });

    function syncAmts() {
      for (var i = 0; i < amtBtns.length; i++) {
        var active = !showCustom && !customAmt && selAmount === amtBtns[i].amt;
        amtBtns[i].b.style.background = active ? col : '#ffffff';
        amtBtns[i].b.style.color = active ? '#ffffff' : '#374151';
        amtBtns[i].b.style.borderColor = active ? col : '#e5e7eb';
        amtBtns[i].b.style.boxShadow = active ? ('0 0 0 3px ' + col + '28') : 'none';
        amtBtns[i].b.style.fontWeight = active ? '700' : '600';
      }
      customBtn.style.background = showCustom ? colLight : '#ffffff';
      customBtn.style.color = showCustom ? col : '#374151';
      customBtn.style.borderColor = showCustom ? col : '#e5e7eb';
      customBtn.style.fontWeight = showCustom ? '700' : '600';
    }
    syncAmts();

    // ── Section 2: Gift Type
    if (allowMonthly) {
      ap(wrap, sectionLabel(2, 'Gift Type'));

      var giftRow = el('div', { display: 'flex', flexDirection: isNarrowViewport() ? 'column' : 'row', flexWrap: 'wrap', gap: '10px', marginBottom: '12px' });

      function makeGiftCard(value, iconSvg, title, subtitle) {
        var card = el('div', {
          flex: '1 1 190px', width: '100%', padding: '14px', border: '1.5px solid #e5e7eb', borderRadius: '12px',
          cursor: 'pointer', background: '#fff', transition: 'all .15s ease', display: 'flex',
          alignItems: 'flex-start', gap: '10px', boxSizing: 'border-box'
        });
        var radio = el('div', {
          width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #d1d5db',
          flexShrink: '0', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all .15s ease', boxSizing: 'border-box'
        });
        var radioInner = el('div', { width: '8px', height: '8px', borderRadius: '50%', background: 'transparent', transition: 'all .15s ease' });
        radio.appendChild(radioInner);
        var iconWrap = el('div', { flexShrink: '0', marginTop: '1px' }, { html: iconSvg });
        var textWrap = el('div', { flex: '1', minWidth: '0' });
        var cardTitle = el('div', { fontSize: '14px', fontWeight: '700', color: '#111827', lineHeight: '1.2', marginBottom: '3px', fontFamily: _FONT }, { text: title });
        var cardSub = el('div', { fontSize: '12px', color: '#6b7280', lineHeight: '1.4', fontFamily: _FONT }, { text: subtitle });
        ap(textWrap, cardTitle, cardSub);
        ap(card, radio, iconWrap, textWrap);

        card._radio = radio;
        card._radioInner = radioInner;
        card._value = value;
        return card;
      }

      var otCard = makeGiftCard('one-time',
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="' + col + '"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A5.98 5.98 0 0116.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>',
        'One-time Gift', 'Make a one-time impact today.');
      var moCard = makeGiftCard('monthly',
        '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="' + col + '" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>',
        'Monthly Gift', 'Sustain this mission all year long.');

      function setGiftType(v) {
        giftType = v;
        var cards = [otCard, moCard];
        for (var ci = 0; ci < cards.length; ci++) {
          var active = cards[ci]._value === v;
          cards[ci].style.borderColor = active ? col : '#e5e7eb';
          cards[ci].style.background = active ? colLight : '#ffffff';
          cards[ci]._radio.style.borderColor = active ? col : '#d1d5db';
          cards[ci]._radioInner.style.background = active ? col : 'transparent';
        }
        if (monthlyBanner) monthlyBanner.style.display = v === 'monthly' ? 'flex' : 'none';
      }

      otCard.addEventListener('click', function () { setGiftType('one-time'); });
      moCard.addEventListener('click', function () { setGiftType('monthly'); });
      ap(giftRow, otCard, moCard);
      ap(wrap, giftRow);

      // Monthly nudge banner
      var monthlyBanner = el('div', {
        display: 'none', alignItems: 'center', gap: '8px', padding: '10px 14px',
        background: colLight, borderRadius: '10px', marginBottom: '14px'
      });
      ap(monthlyBanner,
        el('span', { fontSize: '16px', flexShrink: '0' }, { text: '\uD83D\uDC9C' }),
        el('span', { fontSize: '13px', color: col, fontWeight: '500', lineHeight: '1.4', fontFamily: _FONT },
          { text: 'Make this a monthly gift and help provide steady support all year.' })
      );
      ap(wrap, monthlyBanner);
      setGiftType('one-time');
    }

    // ── Section 3: Designation
    var desigSection = null;
    var desigSelect = null;
    var desigHintEl = null;
    var sectionNum = allowMonthly ? 3 : 2;
    ap(wrap, sectionLabel(sectionNum, 'Designation'));
    var opts = [];
    for (var di = 0; di < designations.length; di++) opts.push({ value: designations[di], label: designations[di] });
    desigSelect = mkSelect(opts, { marginBottom: '6px', padding: '11px 14px', borderRadius: '10px', fontSize: '14px' });
    desigSelect.addEventListener('change', function () { designation = desigSelect.value; });
    desigHintEl = el('p', { margin: '0 0 16px', fontSize: '13px', color: '#6b7280', fontFamily: _FONT }, { text: desigHint });
    ap(wrap, desigSelect, desigHintEl);

    // ── Section 4: Donor Info
    sectionNum = allowMonthly ? 4 : 3;
    ap(wrap, sectionLabel(sectionNum, 'Your Information'));

    // 2-column field grid with icon prefix
    var fieldGrid = el('div', { display: 'grid', gridTemplateColumns: isNarrowViewport() ? '1fr' : 'repeat(auto-fit,minmax(180px,1fr))', gap: '10px', marginBottom: '10px' });

    function iconField(icon, placeholder, type) {
      var wrap2 = el('div', { position: 'relative', display: 'flex', alignItems: 'center' });
      var iconEl = el('span', {
        position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)',
        color: '#9ca3af', display: 'flex', pointerEvents: 'none', lineHeight: '1'
      }, { html: icon });
      var inp = el('input', {
        width: '100%', boxSizing: 'border-box', paddingLeft: '34px', paddingRight: '10px',
        paddingTop: '10px', paddingBottom: '10px', border: '1.5px solid #e5e7eb',
        borderRadius: '10px', fontSize: '14px', fontFamily: _FONT, background: '#fafafa',
        color: '#111827', outline: 'none', minHeight: '44px'
      }, { type: type || 'text', placeholder: placeholder });
      inp.addEventListener('focus', function () { inp.style.borderColor = col; inp.style.background = '#fff'; });
      inp.addEventListener('blur', function () { inp.style.borderColor = '#e5e7eb'; inp.style.background = '#fafafa'; });
      ap(wrap2, iconEl, inp);
      wrap2._inp = inp;
      return wrap2;
    }

    var personSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>';
    var emailSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 7l10 7 10-7"/></svg>';
    var phoneSvg = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2A19.79 19.79 0 0 1 11.61 19a19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 3.09 4.18 2 2 0 0 1 5.07 2h3a2 2 0 0 1 2 1.72c.127.96.36 1.903.7 2.81a2 2 0 0 1-.45 2.11l-1.27 1.27a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.34 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>';

    var firstField = iconField(personSvg, 'First Name', 'text');
    var lastField = iconField(personSvg, 'Last Name', 'text');
    var emailField = iconField(emailSvg, 'Email Address', 'email');
    var phoneField = iconField(phoneSvg, 'Phone (optional)', 'tel');
    ap(fieldGrid, firstField, lastField, emailField, phoneField);
    ap(wrap, fieldGrid);

    var privacyLine = el('p', {
      margin: '0 0 16px', fontSize: '12px', color: '#9ca3af', textAlign: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', flexWrap: 'wrap', fontFamily: _FONT
    }, { html: '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg> We respect your privacy and will never share your information.' });
    ap(wrap, privacyLine);

    // ── Stripe checkout mount (hidden until payment starts)
    var stripeMount = el('div', { display: 'none', marginBottom: '12px' });
    ap(wrap, stripeMount);

    // ── Status / error message
    var statusEl = el('p', { margin: '0 0 10px', fontSize: '13px', minHeight: '18px', color: '#6b7280', fontFamily: _FONT, textAlign: 'center' }, { text: '' });
    ap(wrap, statusEl);

    // ── CTA Button
    var ctaBtn = el('button', {
      width: '100%', padding: '15px 20px', border: 'none', borderRadius: '12px',
      background: col, color: '#ffffff', fontSize: '16px', fontWeight: '700',
      cursor: 'pointer', fontFamily: _FONT, display: 'flex', alignItems: 'center',
      justifyContent: 'center', gap: '10px', letterSpacing: '0',
      boxShadow: '0 4px 16px ' + col + '44', transition: 'opacity .15s ease, transform .15s ease',
      minHeight: '48px', boxSizing: 'border-box'
    }, { type: 'button',
      html: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
            '<span>Continue to Secure Payment</span>' +
            '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" style="flex-shrink:0"><path d="M5 12h14M12 5l7 7-7 7"/></svg>'
    });
    ctaBtn.addEventListener('mouseover', function () { ctaBtn.style.opacity = '0.88'; ctaBtn.style.transform = 'translateY(-1px)'; });
    ctaBtn.addEventListener('mouseout', function () { ctaBtn.style.opacity = '1'; ctaBtn.style.transform = 'translateY(0)'; });
    ap(wrap, ctaBtn);

    // ── Stripe trust footer
    var stripeFooter = el('p', {
      margin: '12px 0 0', fontSize: '12px', color: '#9ca3af', textAlign: 'center',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', flexWrap: 'wrap', fontFamily: _FONT
    }, { html: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>' +
          '<span>Your payment is secure and encrypted by Stripe.</span>' +
          '<svg viewBox="0 0 60 25" width="36" height="15" style="flex-shrink:0"><path d="M0 0h60v25H0z" fill="none"/><text x="0" y="19" font-family="Arial,sans-serif" font-size="18" font-weight="900" fill="#635bff">stripe</text></svg>'
    });
    ap(wrap, stripeFooter);
    node.appendChild(wrap);

    // ── Submit handler
    ctaBtn.addEventListener('click', function () {
      var amt = customAmt || selAmount;
      if (!amt || amt <= 0) { statusEl.textContent = 'Please select or enter a donation amount.'; statusEl.style.color = '#dc2626'; return; }
      var email = String(emailField._inp.value || '').trim();
      if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { statusEl.textContent = 'Please enter a valid email address.'; statusEl.style.color = '#dc2626'; return; }
      statusEl.textContent = 'Preparing secure checkout\u2026'; statusEl.style.color = '#6b7280';
      ctaBtn.disabled = true; ctaBtn.style.opacity = '0.6';
      var fullName = (String(firstField._inp.value || '').trim() + ' ' + String(lastField._inp.value || '').trim()).trim();
      var body = new URLSearchParams();
      body.set('token', runtime.token); body.set('amount', String(amt));
      body.set('giftType', giftType); body.set('designation', designation);
      body.set('name', fullName || 'Website Donor'); body.set('email', email);
      body.set('phone', String(phoneField._inp.value || '').trim());
      body.set('domain', window.location.hostname); body.set('pageUrl', window.location.href);
      fetch(runtime.apiBaseUrl + '/api/site-embeds/public/donation-checkout-embedded', {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString()
      }).then(function (r) {
        return r.json().then(function (p) {
          if (!r.ok) throw new Error((p.error && p.error.message) || 'Checkout setup failed.');
          return p.data;
        });
      }).then(function (data) {
        statusEl.textContent = '';
        // Hide form elements, show Stripe mount
        wrap.style.padding = '0';
        iconCircle.style.display = 'none'; heroTitle.style.display = 'none'; heroSub.style.display = 'none';
        var hideSiblings = wrap.children;
        for (var hi = 0; hi < hideSiblings.length; hi++) {
          if (hideSiblings[hi] !== stripeMount && hideSiblings[hi] !== statusEl) {
            hideSiblings[hi].style.display = 'none';
          }
        }
        stripeMount.style.display = 'block'; stripeMount.style.padding = '4px';
        var mountDiv = el('div', { minHeight: '320px' });
        var loadMsg = el('p', { textAlign: 'center', color: '#6b7280', fontSize: '14px', padding: '32px 0', fontFamily: _FONT }, { text: 'Loading secure payment form\u2026' });
        stripeMount.innerHTML = '';
        ap(stripeMount, mountDiv, loadMsg);
        loadStripe(data.publishableKey, function (stripe) {
          if (!stripe) { statusEl.textContent = 'Payment provider unavailable. Please try again.'; statusEl.style.color = '#dc2626'; return; }
          stripe.initEmbeddedCheckout({ clientSecret: data.clientSecret }).then(function (checkout) {
            loadMsg.style.display = 'none';
            checkout.mount(mountDiv);
            ping('donation_widget_checkout_mounted');
          }).catch(function (err) {
            statusEl.textContent = (err && err.message) ? err.message : 'Failed to load payment form.';
            statusEl.style.color = '#dc2626';
          });
        });
      }).catch(function (err) {
        statusEl.textContent = (err && err.message) ? err.message : 'Something went wrong. Please try again.';
        statusEl.style.color = '#dc2626';
        ctaBtn.disabled = false; ctaBtn.style.opacity = '1';
      });
    });
  }

  // ── Campaign Meter ─────────────────────────────────────────────

  function renderCampaignMeter(node) {
    var cfg = getCfg('campaign_meter');
    var col = accentColor(cfg);
    cardBase(node);
    var wrap = el('div', { padding: responsivePadding('22px', '16px') });
    var titleEl = el('h3', { margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#111827', fontFamily: _FONT }, { text: 'Loading\u2026' });
    var subtitleEl = el('p', { margin: '0 0 16px 0', fontSize: '13px', color: '#6b7280', fontFamily: _FONT }, { text: '' });
    var track = el('div', { background: '#f3f4f6', borderRadius: '9999px', height: '10px', overflow: 'hidden', marginBottom: '12px' });
    var fill = el('div', { height: '100%', borderRadius: '9999px', background: col, width: '0%', transition: 'width 1.2s ease' });
    track.appendChild(fill);
    var statsRow = el('div', { display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' });
    var raisedDiv = el('div');
    var goalDiv = el('div', { textAlign: isNarrowViewport() ? 'left' : 'right' });
    ap(raisedDiv,
      el('div', { fontSize: 'clamp(17px, 5vw, 20px)', fontWeight: '700', color: '#111827', fontFamily: _FONT }, { text: '\u2014' }),
      el('div', { fontSize: '11px', color: '#9ca3af', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: _FONT }, { text: 'Raised' })
    );
    ap(goalDiv,
      el('div', { fontSize: 'clamp(17px, 5vw, 20px)', fontWeight: '700', color: '#111827', textAlign: isNarrowViewport() ? 'left' : 'right', fontFamily: _FONT }, { text: '\u2014' }),
      el('div', { fontSize: '11px', color: '#9ca3af', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.05em', fontFamily: _FONT }, { text: 'Goal' })
    );
    ap(statsRow, raisedDiv, goalDiv);
    ap(wrap, titleEl, subtitleEl, track, statsRow);
    if (cfg.ctaLabel && cfg.ctaHref) {
      var ctaHref = String(cfg.ctaHref);
      var ctaB = mkBtn(String(cfg.ctaLabel), col, '#ffffff');
      ctaB.style.width = '100%';
      ctaB.addEventListener('click', function () { window.open(ctaHref, '_blank', 'noopener'); ping('campaign_meter_cta_click'); });
      ap(wrap, ctaB);
    }
    node.appendChild(wrap);
    var cId = String(node.getAttribute('data-oyama-campaign-id') || node.getAttribute('data-campaign-id') || '');
    var qs = 'token=' + encodeURIComponent(runtime.token) + '&widget=campaign_meter&domain=' + encodeURIComponent(window.location.hostname);
    if (cId) qs += '&campaignId=' + encodeURIComponent(cId);
    fetch(runtime.apiBaseUrl + '/api/site-embeds/public/widget-data?' + qs, { mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (p) {
        var d = p && p.data && p.data.campaign ? p.data.campaign : null;
        if (!d) { titleEl.textContent = 'No Active Campaign'; return; }
        titleEl.textContent = String(d.name || 'Active Campaign');
        if (d.description) subtitleEl.textContent = String(d.description).slice(0, 120);
        var pct = Math.min(100, Math.max(0, Math.round(Number(d.progressPercent || 0))));
        setTimeout(function () { fill.style.width = pct + '%'; }, 120);
        raisedDiv.firstChild.textContent = formatMoney(d.raised || 0);
        goalDiv.firstChild.textContent = formatMoney(d.goal || 0);
      })
      .catch(function () { titleEl.textContent = 'Campaign Unavailable'; });
  }

  // ── Event Card ─────────────────────────────────────────────────

  function renderEventCard(node) {
    var cfg = getCfg('event_card');
    var col = accentColor(cfg);
    cardBase(node);
    var eId = String(node.getAttribute('data-oyama-event-id') || node.getAttribute('data-event-id') || '');
    var qs = 'token=' + encodeURIComponent(runtime.token) + '&widget=event_card&domain=' + encodeURIComponent(window.location.hostname);
    if (eId) qs += '&eventId=' + encodeURIComponent(eId);
    var banner = el('div', { background: 'linear-gradient(135deg,' + col + ' 0%,' + col + 'bb 100%)', padding: responsivePadding('22px 20px 18px', '18px 16px 16px') });
    var titleEl = el('h3', { margin: '0 0 6px 0', fontSize: '18px', fontWeight: '700', lineHeight: '1.3', color: '#ffffff', fontFamily: _FONT }, { text: 'Loading event\u2026' });
    var dateEl = el('p', { margin: '0', fontSize: '13px', color: 'rgba(255,255,255,0.9)', fontFamily: _FONT }, { text: '' });
    ap(banner, titleEl, dateEl);
    var body = el('div', { padding: responsivePadding('18px 20px', '16px') });
    var descEl = el('p', { margin: '0 0 14px 0', fontSize: '14px', color: '#374151', lineHeight: '1.6', fontFamily: _FONT }, { text: '' });
    var progressWrap = el('div', { display: 'none', marginBottom: '14px' });
    var pLabel = el('p', { margin: '0 0 6px 0', fontSize: '12px', fontWeight: '600', color: '#6b7280', fontFamily: _FONT }, { text: 'Fundraising Progress' });
    var pTrack = el('div', { background: '#f3f4f6', borderRadius: '9999px', height: '8px', overflow: 'hidden' });
    var pFill = el('div', { height: '100%', background: col, borderRadius: '9999px', width: '0%', transition: 'width 1s ease' });
    pTrack.appendChild(pFill);
    ap(progressWrap, pLabel, pTrack);
    var btnRow = el('div', { display: 'flex', flexDirection: isNarrowViewport() ? 'column' : 'row', gap: '8px' });
    var regBtn = mkBtn('Register', col, '#ffffff');
    regBtn.style.flex = '1';
    ap(btnRow, regBtn);
    ap(body, descEl, progressWrap, btnRow);
    ap(node, banner, body);
    fetch(runtime.apiBaseUrl + '/api/site-embeds/public/widget-data?' + qs, { mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (p) {
        var d = p && p.data && p.data.event ? p.data.event : null;
        if (!d) { titleEl.textContent = 'Event Unavailable'; return; }
        titleEl.textContent = String(d.name || 'Upcoming Event');
        dateEl.textContent = String(d.startDateLabel || '') + (d.location ? ' \u00B7 ' + String(d.location) : '');
        if (d.description) descEl.textContent = String(d.description).slice(0, 200);
        if (cfg.showFundraisingProgress && d.raised != null) {
          progressWrap.style.display = 'block';
          setTimeout(function () { pFill.style.width = Math.min(100, Number(d.progressPercent || 0)) + '%'; }, 100);
        }
        if (d.registrationUrl) {
          regBtn.addEventListener('click', function () { window.open(String(d.registrationUrl), '_blank', 'noopener'); ping('event_card_register'); });
        }
      })
      .catch(function () { titleEl.textContent = 'Event Unavailable'; });
  }

  // ── Volunteer Signup ───────────────────────────────────────────

  function renderVolunteerSignup(node) {
    var cfg = getCfg('volunteer_signup');
    var col = accentColor(cfg);
    cardBase(node);
    var areas = Array.isArray(cfg.interestAreas) && cfg.interestAreas.length
      ? cfg.interestAreas : ['General', 'Events', 'Admin & Office', 'Outreach', 'Youth Programs'];
    var successMsg = String(cfg.successMessage || "Thank you! We'll be in touch about volunteer opportunities.");
    var wrap = el('div', { padding: responsivePadding('24px', '16px') });
    ap(wrap, accentBar(col),
      el('h3', { margin: '0 0 6px 0', fontSize: '19px', fontWeight: '700', color: '#111827', fontFamily: _FONT },
        { text: String(cfg.headline || 'Get Involved \u2014 Volunteer With Us') }),
      el('p', { margin: '0 0 18px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.5', fontFamily: _FONT },
        { text: String(cfg.supportingCopy || "Your time makes a real difference. Tell us how you'd like to help.") })
    );
    var nameInp = mkInput('Full name', 'text', { marginBottom: '8px' });
    var emailInp = mkInput('Email address', 'email', { marginBottom: '8px' });
    var phoneInp = mkInput('Phone (optional)', 'tel', { marginBottom: '8px' });
    ap(wrap, el('label', { display: 'block', fontSize: '12px', fontWeight: '600', color: '#374151', marginBottom: '4px', fontFamily: _FONT }, { text: 'Area of Interest' }));
    var areaOpts = [];
    for (var ai = 0; ai < areas.length; ai++) areaOpts.push({ value: areas[ai], label: areas[ai] });
    var areaSelect = mkSelect(areaOpts, { marginBottom: '14px' });
    ap(wrap, nameInp, emailInp, phoneInp, areaSelect);
    var statusEl = el('p', { margin: '0 0 8px 0', fontSize: '13px', minHeight: '18px', color: '#6b7280', fontFamily: _FONT }, { text: '' });
    var submitBtn = mkBtn('Submit Interest', col, '#ffffff');
    submitBtn.style.width = '100%'; submitBtn.style.padding = '12px 18px';
    ap(wrap, statusEl, submitBtn);
    node.appendChild(wrap);
    submitBtn.addEventListener('click', function () {
      var name = String(nameInp.value || '').trim();
      var email = String(emailInp.value || '').trim();
      if (!name || !email) { statusEl.textContent = 'Please fill in your name and email.'; statusEl.style.color = '#dc2626'; return; }
      statusEl.textContent = 'Submitting\u2026'; statusEl.style.color = '#6b7280'; submitBtn.disabled = true;
      var params = new URLSearchParams();
      params.set('token', runtime.token); params.set('widget', 'volunteer_signup');
      params.set('name', name); params.set('email', email);
      params.set('phone', String(phoneInp.value || '').trim()); params.set('interest', String(areaSelect.value || ''));
      params.set('domain', window.location.hostname); params.set('pageUrl', window.location.href);
      fetch(runtime.apiBaseUrl + '/api/site-embeds/public/widget-submit', {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString()
      }).then(function () {
        wrap.innerHTML = '';
        ap(wrap,
          el('div', { textAlign: 'center', padding: '20px 0', fontSize: '40px', fontFamily: _FONT }, { text: '\uD83D\uDE4C' }),
          el('p', { textAlign: 'center', fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0', fontFamily: _FONT }, { text: 'Thank You!' }),
          el('p', { textAlign: 'center', fontSize: '14px', color: '#6b7280', margin: '0', lineHeight: '1.5', fontFamily: _FONT }, { text: successMsg })
        );
        ping('volunteer_signup_submit');
      }).catch(function () { statusEl.textContent = 'Submission failed. Please try again.'; statusEl.style.color = '#dc2626'; submitBtn.disabled = false; });
    });
  }

  // ── Newsletter Signup ──────────────────────────────────────────

  function renderNewsletterSignup(node) {
    var cfg = getCfg('newsletter_signup');
    var col = accentColor(cfg);
    cardBase(node);
    var consentLine = String(cfg.consentLine || 'I agree to receive email updates. Unsubscribe anytime.');
    var successMsg = String(cfg.successMessage || "You're subscribed! Welcome to our community.");
    var wrap = el('div', { padding: responsivePadding('24px', '16px') });
    ap(wrap, accentBar(col),
      el('h3', { margin: '0 0 6px 0', fontSize: '19px', fontWeight: '700', color: '#111827', fontFamily: _FONT },
        { text: String(cfg.headline || 'Stay Connected') }),
      el('p', { margin: '0 0 16px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.5', fontFamily: _FONT },
        { text: String(cfg.supportingCopy || 'Get updates on our impact, events, and ways to support our mission.') })
    );
    var nameInp = mkInput('First name', 'text', { marginBottom: '8px' });
    var emailInp = mkInput('Email address', 'email', { marginBottom: '12px' });
    var consentRow = el('div', { display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '14px' });
    var cbId = 'oyama-nl-cb-' + Math.random().toString(36).slice(2);
    var checkbox = el('input', { marginTop: '3px', flexShrink: '0', cursor: 'pointer' }, { type: 'checkbox', id: cbId });
    var cbLabel = el('label', { fontSize: '12px', color: '#6b7280', lineHeight: '1.5', cursor: 'pointer', fontFamily: _FONT }, { for: cbId, text: consentLine });
    ap(consentRow, checkbox, cbLabel);
    ap(wrap, nameInp, emailInp, consentRow);
    var statusEl = el('p', { margin: '0 0 8px 0', fontSize: '13px', minHeight: '18px', color: '#6b7280', fontFamily: _FONT }, { text: '' });
    var submitBtn = mkBtn('Subscribe', col, '#ffffff');
    submitBtn.style.width = '100%'; submitBtn.style.padding = '12px 18px';
    ap(wrap, statusEl, submitBtn);
    node.appendChild(wrap);
    submitBtn.addEventListener('click', function () {
      var email = String(emailInp.value || '').trim();
      if (!email || !/^[^@]+@[^@]+\.[^@]+$/.test(email)) { statusEl.textContent = 'Please enter a valid email address.'; statusEl.style.color = '#dc2626'; return; }
      if (!checkbox.checked) { statusEl.textContent = 'Please check the consent box to continue.'; statusEl.style.color = '#dc2626'; return; }
      statusEl.textContent = 'Subscribing\u2026'; statusEl.style.color = '#6b7280'; submitBtn.disabled = true;
      var params = new URLSearchParams();
      params.set('token', runtime.token); params.set('widget', 'newsletter_signup');
      params.set('name', String(nameInp.value || '').trim()); params.set('email', email);
      params.set('domain', window.location.hostname); params.set('pageUrl', window.location.href);
      fetch(runtime.apiBaseUrl + '/api/site-embeds/public/widget-submit', {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: params.toString()
      }).then(function () {
        wrap.innerHTML = '';
        ap(wrap,
          el('div', { textAlign: 'center', padding: '20px 0', fontSize: '36px', fontFamily: _FONT }, { text: '\uD83D\uDCEC' }),
          el('p', { textAlign: 'center', fontSize: '16px', fontWeight: '600', color: '#111827', margin: '0 0 8px 0', fontFamily: _FONT }, { text: "You're In!" }),
          el('p', { textAlign: 'center', fontSize: '14px', color: '#6b7280', margin: '0', lineHeight: '1.5', fontFamily: _FONT }, { text: successMsg })
        );
        ping('newsletter_signup_submit');
      }).catch(function () { statusEl.textContent = 'Subscription failed. Please try again.'; statusEl.style.color = '#dc2626'; submitBtn.disabled = false; });
    });
  }

  // ── Impact Counter ─────────────────────────────────────────────

  function renderImpactCounter(node) {
    var cfg = getCfg('impact_counter');
    var col = accentColor(cfg);
    cardBase(node);
    var bar = el('div', { height: '4px', background: col });
    var wrap = el('div', { padding: responsivePadding('24px', '16px') });
    function renderStats(stats) {
      wrap.innerHTML = '';
      var cols = isNarrowViewport() ? 'repeat(auto-fit,minmax(120px,1fr))' : (stats.length <= 2 ? 'repeat(' + stats.length + ',1fr)' : 'repeat(3,1fr)');
      var grid = el('div', { display: 'grid', gridTemplateColumns: cols, gap: '16px' });
      for (var i = 0; i < stats.length; i++) {
        var cell = el('div', { textAlign: 'center', padding: '4px' });
        ap(cell,
          el('div', { fontSize: 'clamp(22px, 7vw, 28px)', fontWeight: '800', color: col, lineHeight: '1.1', letterSpacing: '0', fontFamily: _FONT }, { text: String(stats[i].value || '\u2014') }),
          el('div', { fontSize: '11px', fontWeight: '600', color: '#6b7280', marginTop: '4px', textTransform: 'uppercase', letterSpacing: '0.04em', fontFamily: _FONT }, { text: String(stats[i].label || '') })
        );
        grid.appendChild(cell);
      }
      ap(wrap, grid);
      if (cfg.disclaimer) ap(wrap, el('p', { margin: '12px 0 0 0', fontSize: '11px', color: '#9ca3af', textAlign: 'center', fontFamily: _FONT }, { text: String(cfg.disclaimer) }));
    }
    ap(node, bar, wrap);
    if (cfg.statsJson) {
      try { renderStats(JSON.parse(String(cfg.statsJson))); return; } catch (_) {}
    }
    var qs = 'token=' + encodeURIComponent(runtime.token) + '&widget=impact_counter&domain=' + encodeURIComponent(window.location.hostname);
    fetch(runtime.apiBaseUrl + '/api/site-embeds/public/widget-data?' + qs, { mode: 'cors', credentials: 'omit' })
      .then(function (r) { return r.json(); })
      .then(function (p) {
        var m = p && p.data && p.data.metrics ? p.data.metrics : {};
        renderStats([
          { value: String(m.constituentCount || 0), label: 'Community Members' },
          { value: String(m.completedDonationCount || 0), label: 'Gifts Received' },
          { value: formatMoney(m.completedDonationAmount || 0), label: 'Total Raised' }
        ]);
      })
      .catch(function () {
        wrap.innerHTML = '';
        ap(wrap, el('p', { fontSize: '13px', color: '#9ca3af', textAlign: 'center', fontFamily: _FONT }, { text: 'Impact data unavailable.' }));
      });
  }

  // ── CTA Block ──────────────────────────────────────────────────

  function renderCtaBlock(node) {
    var cfg = getCfg('cta_block');
    var col = accentColor(cfg);
    var layout = String(cfg.layout || 'card').toLowerCase();
    cardBase(node);
    var headline = String(cfg.headline || 'Support Our Mission');
    var bodyCopy = String(cfg.bodyCopy || 'Your generosity helps power life-changing work in our community.');
    var priLabel = String(cfg.primaryButtonLabel || 'Donate Today');
    var priHref = String(cfg.primaryButtonHref || '#');
    var secLabel = String(cfg.secondaryButtonLabel || '');
    var secHref = String(cfg.secondaryButtonHref || '');
    if (layout === 'banner') {
      node.style.background = col; node.style.border = 'none';
      var bWrap = el('div', { padding: responsivePadding('24px 28px', '18px 16px'), display: 'flex', alignItems: isNarrowViewport() ? 'stretch' : 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', flexDirection: isNarrowViewport() ? 'column' : 'row' });
      var bText = el('div', { flex: '1', minWidth: '0' });
      ap(bText,
        el('h3', { margin: '0 0 4px 0', fontSize: '18px', fontWeight: '700', color: '#ffffff', fontFamily: _FONT }, { text: headline }),
        el('p', { margin: '0', fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: '1.5', fontFamily: _FONT }, { text: bodyCopy })
      );
      var bBtn = mkBtn(priLabel, '#ffffff', col);
      bBtn.style.flexShrink = '0';
      bBtn.style.width = isNarrowViewport() ? '100%' : 'auto';
      bBtn.addEventListener('click', function () { window.open(priHref, '_blank', 'noopener'); ping('cta_block_primary'); });
      ap(bWrap, bText, bBtn);
      node.appendChild(bWrap);
    } else if (layout === 'minimal') {
      node.style.border = 'none'; node.style.boxShadow = 'none'; node.style.background = 'transparent';
      var mWrap = el('div', { padding: responsivePadding('8px 0', '6px 0'), textAlign: 'center' });
      ap(mWrap,
        el('h3', { margin: '0 0 6px 0', fontSize: '17px', fontWeight: '700', color: '#111827', fontFamily: _FONT }, { text: headline }),
        el('p', { margin: '0 0 14px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.5', fontFamily: _FONT }, { text: bodyCopy })
      );
      var mBtn = mkBtn(priLabel, col, '#ffffff');
      mBtn.style.width = isNarrowViewport() ? '100%' : 'auto';
      mBtn.addEventListener('click', function () { window.open(priHref, '_blank', 'noopener'); ping('cta_block_primary'); });
      ap(mWrap, mBtn);
      node.appendChild(mWrap);
    } else {
      var cWrap = el('div', { padding: responsivePadding('24px', '16px') });
      ap(cWrap, accentBar(col),
        el('h3', { margin: '0 0 8px 0', fontSize: '19px', fontWeight: '700', color: '#111827', lineHeight: '1.3', fontFamily: _FONT }, { text: headline }),
        el('p', { margin: '0 0 18px 0', fontSize: '14px', color: '#6b7280', lineHeight: '1.6', fontFamily: _FONT }, { text: bodyCopy })
      );
      var cBtnRow = el('div', { display: 'flex', flexDirection: isNarrowViewport() ? 'column' : 'row', gap: '8px', flexWrap: 'wrap' });
      var cPriBtn = mkBtn(priLabel, col, '#ffffff');
      cPriBtn.style.flex = '1';
      cPriBtn.style.width = '100%';
      cPriBtn.addEventListener('click', function () { window.open(priHref, '_blank', 'noopener'); ping('cta_block_primary'); });
      ap(cBtnRow, cPriBtn);
      if (secLabel && secHref) {
        var cSecBtn = mkBtn(secLabel, 'transparent', col, col);
        cSecBtn.style.flex = '1';
        cSecBtn.style.width = '100%';
        cSecBtn.addEventListener('click', function () { window.open(secHref, '_blank', 'noopener'); ping('cta_block_secondary'); });
        ap(cBtnRow, cSecBtn);
      }
      ap(cWrap, cBtnRow);
      node.appendChild(cWrap);
    }
  }

  // ── LiveCom Chat Widget ────────────────────────────────────────

  function ensureLiveCom() {
    if (!isWidgetEnabled('livecom')) return;
    if (document.getElementById('oyama-livecom-launcher')) return;
    var cfg = getCfg('livecom');
    var col = /^#[0-9a-fA-F]{6}$/.test(String(cfg.chatheadColor || '').trim()) ? String(cfg.chatheadColor) : themeAccent();
    var iconStyle = String(cfg.iconStyle || 'chat').toLowerCase();
    var isLeft = cfg.buttonPosition === 'bottom-left';
    var panelW = Math.min(480, Math.max(280, Number(cfg.panelWidth) || 340));
    var orgName = String(cfg.orgName || 'Connect With Us');
    var orgSub = String(cfg.orgSubtitle || '');
    var avatarUrl = String(cfg.avatarUrl || '');
    var respTime = String(cfg.responseTimeText || 'We respond within a few hours.');
    var msgPh = String(cfg.messagePlaceholder || 'How can we help today?');
    var btnLabel = String(cfg.buttonLabel || '');
    var greeting = String(cfg.greetingMessage || "Send us a message and we'll follow up soon.");
    var showBranding = cfg.showBranding !== false;
    var compactChat = isNarrowViewport();
    var edgeOffset = compactChat ? '12px' : '22px';
    var sessionKey = 'oyama.livecom.session.' + runtime.token;
    var conversationKey = 'oyama.livecom.conversation.' + runtime.token;
    var identityDismissedKey = 'oyama.livecom.identityDismissed.' + runtime.token;
    var visitorSessionId = '';
    var conversationId = '';
    var identityDismissed = false;
    var lastThreadSignature = '';
    var knownPublicMessageIds = {};
    var publicThreadHydrated = false;
    var visitorUnreadCount = 0;
    var launcherBadge = null;
    var threadPollTimer = null;
    var threadLoading = false;
    var lastThreadHadError = false;
    try {
      visitorSessionId = localStorage.getItem(sessionKey) || '';
      if (!visitorSessionId) {
        visitorSessionId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem(sessionKey, visitorSessionId);
      }
      conversationId = localStorage.getItem(conversationKey) || '';
      identityDismissed = localStorage.getItem(identityDismissedKey) === 'true';
    } catch (_) {
      visitorSessionId = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    }

    var wrapper = el('div', {
      position: 'fixed', zIndex: '2147483650', fontFamily: _FONT, bottom: 'max(' + edgeOffset + ', env(safe-area-inset-bottom))',
      maxWidth: compactChat ? 'calc(100vw - 24px)' : 'none'
    }, { id: 'oyama-livecom-launcher' });
    wrapper.style[isLeft ? 'left' : 'right'] = edgeOffset;

    var panel = el('div', {
      display: 'none', width: compactChat ? 'calc(100vw - 24px)' : (panelW + 'px'), maxWidth: 'calc(100vw - 24px)',
      background: themeColor('backgroundColor', '#ffffff'), border: '1px solid ' + themeColor('borderColor', '#e5e7eb'), borderRadius: themeRadius('card'),
      boxShadow: '0 20px 60px rgba(15,23,42,0.18), 0 4px 12px rgba(15,23,42,0.06)',
      marginBottom: compactChat ? '10px' : '12px', overflow: 'hidden',
      height: compactChat ? 'min(620px, calc(100dvh - 92px))' : 'min(640px, calc(100vh - 120px))',
      maxHeight: compactChat ? 'calc(100dvh - 92px)' : 'calc(100vh - 120px)', opacity: '0',
      flexDirection: 'column',
      transition: 'opacity .18s ease, transform .2s cubic-bezier(0.34,1.56,0.64,1)',
      transformOrigin: isLeft ? 'bottom left' : 'bottom right',
      transform: 'scale(0.92)'
    });

    var hdr = el('div', { background: col, padding: responsivePadding('14px 18px', '12px 14px'), display: 'flex', alignItems: 'center', gap: '12px', flexShrink: '0' });
    if (avatarUrl) {
      ap(hdr, el('img', { width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', flexShrink: '0', border: '2px solid rgba(255,255,255,.3)' }, { src: avatarUrl, alt: orgName }));
    } else {
      ap(hdr, el('div', { width: '40px', height: '40px', borderRadius: '50%', flexShrink: '0', background: 'rgba(255,255,255,.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }, { html: '\uD83D\uDCAC' }));
    }
    var hdrText = el('div', { flex: '1', minWidth: '0' });
    ap(hdrText, el('div', { fontSize: '15px', fontWeight: '800', color: '#ffffff', fontFamily: _FONT }, { text: 'LiveCom' }));
    ap(hdrText, el('div', { fontSize: '12px', color: 'rgba(255,255,255,.86)', marginTop: '2px', fontFamily: _FONT }, { text: 'Connected with ' + orgName }));
    if (orgSub) ap(hdrText, el('div', { fontSize: '11px', color: 'rgba(255,255,255,.75)', marginTop: '1px', fontFamily: _FONT }, { text: orgSub }));
    var closeBtn = el('button', {
      background: 'none', border: 'none', color: 'rgba(255,255,255,.8)', cursor: 'pointer',
      padding: '4px', fontSize: '20px', lineHeight: '1', borderRadius: '6px', fontFamily: _FONT,
      minWidth: '36px', minHeight: '36px'
    }, { type: 'button', 'aria-label': 'Close', html: '\u00D7' });
    ap(hdr, hdrText, closeBtn);

    var rBar = el('div', { background: '#f9fafb', padding: responsivePadding('7px 18px', '7px 14px'), borderBottom: '1px solid ' + themeColor('borderColor', '#f3f4f6'), display: 'flex', alignItems: 'center', gap: '6px', flexShrink: '0' });
    var dot = el('span', { display: 'inline-block', width: '7px', height: '7px', borderRadius: '50%', background: '#22c55e', flexShrink: '0' });
    var rText = el('span', { flex: '1', minWidth: '0', fontSize: '12px', color: themeColor('mutedTextColor', '#6b7280'), fontFamily: _FONT }, { text: respTime });
    var notifyBtn = el('button', {
      display: ('Notification' in window && Notification.permission !== 'granted') ? 'inline-flex' : 'none',
      alignItems: 'center', border: '1px solid ' + themeColor('borderColor', '#e5e7eb'), borderRadius: '999px',
      background: '#ffffff', color: themeColor('mutedTextColor', '#6b7280'), cursor: 'pointer',
      padding: '4px 8px', fontSize: '11px', fontWeight: '700', fontFamily: _FONT, whiteSpace: 'nowrap'
    }, { type: 'button', text: 'Notify me' });
    notifyBtn.addEventListener('click', function () {
      if (!('Notification' in window)) return;
      Notification.requestPermission().then(function (permission) {
        notifyBtn.style.display = permission === 'granted' ? 'none' : 'inline-flex';
        lcStatus.textContent = permission === 'granted' ? 'Notifications are on.' : 'Notifications were not enabled.';
      }).catch(function () {});
    });
    ap(rBar, dot, rText, notifyBtn);

    var pBody = el('div', { padding: '0', display: 'flex', flexDirection: 'column', flex: '1', minHeight: '0', overflow: 'hidden' });
    var thread = el('div', {
      flex: '1', minHeight: '0', overflowY: 'auto', padding: responsivePadding('16px 16px 12px', '14px 12px 10px'),
      background: 'linear-gradient(180deg,#ffffff 0%,#f9fafb 100%)'
    });
    var identityBox = el('div', {
      display: 'none', margin: '0 12px 10px', padding: '10px', border: '1px solid ' + themeColor('borderColor', '#e5e7eb'),
      borderRadius: themeRadius('control'), background: '#ffffff'
    });
    var identityPromptRow = el('div', { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' });
    var identityPromptText = el('p', { margin: '0', fontSize: '12px', color: themeColor('mutedTextColor', '#6b7280'), lineHeight: '1.4', fontFamily: _FONT }, { text: "Before we continue, what's the best email in case we miss you?" });
    var dismissIdentityBtn = el('button', {
      border: 'none', background: 'transparent', color: themeColor('mutedTextColor', '#6b7280'), cursor: 'pointer',
      fontSize: '16px', lineHeight: '1', padding: '0 2px', borderRadius: '4px', fontFamily: _FONT
    }, { type: 'button', 'aria-label': 'Dismiss contact info prompt', html: '\u00D7' });
    dismissIdentityBtn.addEventListener('click', function () {
      identityDismissed = true;
      identityBox.style.display = 'none';
      try { localStorage.setItem(identityDismissedKey, 'true'); } catch (_) {}
    });
    ap(identityPromptRow, identityPromptText, dismissIdentityBtn);
    ap(identityBox, identityPromptRow);
    var lcNameInp = mkInput('Name', 'text', { marginBottom: '8px', fontSize: '13px', padding: '9px 12px' });
    var lcEmailInp = mkInput('Email', 'email', { marginBottom: '0', fontSize: '13px', padding: '9px 12px' });
    ap(identityBox, lcNameInp, lcEmailInp);
    var composer = el('div', { borderTop: '1px solid ' + themeColor('borderColor', '#e5e7eb'), padding: responsivePadding('12px 14px', '10px 12px'), background: '#ffffff', flexShrink: '0' });
    var composerRow = el('div', { display: 'flex', alignItems: 'flex-end', gap: '8px' });
    var msgArea = el('textarea', {
      flex: '1', width: '100%', boxSizing: 'border-box', padding: '10px 12px',
      border: '1.5px solid ' + themeColor('borderColor', '#d1d5db'), borderRadius: themeRadius('control'), fontSize: '13px', fontFamily: _FONT,
      background: '#fafafa', color: themeColor('textColor', '#111827'), resize: 'none', outline: 'none',
      minHeight: '42px', maxHeight: '110px'
    }, { placeholder: msgPh || 'Write a message...', rows: '1' });
    msgArea.addEventListener('focus', function () { msgArea.style.borderColor = col; msgArea.style.background = '#fff'; });
    msgArea.addEventListener('blur', function () { msgArea.style.borderColor = themeColor('borderColor', '#d1d5db'); msgArea.style.background = '#fafafa'; });
    var sendBtn = mkBtn('Send', col, '#ffffff');
    sendBtn.style.padding = '10px 13px'; sendBtn.style.minWidth = '58px'; sendBtn.style.height = '42px';
    sendBtn.innerHTML = '<span>Send</span>';
    ap(composerRow, msgArea, sendBtn);
    var lcStatus = el('div', { fontSize: '12px', color: themeColor('mutedTextColor', '#6b7280'), minHeight: '16px', marginTop: '6px', fontFamily: _FONT }, { text: '' });
    var sendHint = el('div', { fontSize: '11px', color: '#9ca3af', marginTop: '2px', fontFamily: _FONT }, { text: 'Enter sends. Shift+Enter adds a new line.' });
    ap(composer, composerRow, lcStatus, sendHint);
    ap(pBody, thread, identityBox, composer);

    function scrollThread() {
      setTimeout(function () { thread.scrollTop = thread.scrollHeight; }, 0);
    }
    function addBubble(role, body, createdAt, state) {
      var isVisitor = role === 'visitor';
      var isSystem = role === 'system';
      var row = el('div', {
        display: 'flex', justifyContent: isSystem ? 'center' : (isVisitor ? 'flex-end' : 'flex-start'),
        marginBottom: '9px'
      });
      var bubble = el('div', {
        maxWidth: isSystem ? '92%' : '78%', padding: isSystem ? '4px 8px' : '9px 11px',
        borderRadius: isSystem ? '999px' : (isVisitor ? '14px 14px 4px 14px' : '14px 14px 14px 4px'),
        background: isSystem ? '#eef2f7' : (isVisitor ? col : '#ffffff'),
        border: isSystem || isVisitor ? 'none' : '1px solid ' + themeColor('borderColor', '#e5e7eb'),
        color: isVisitor ? '#ffffff' : themeColor('textColor', '#111827'),
        boxShadow: isSystem ? 'none' : '0 1px 4px rgba(15,23,42,0.08)',
        fontSize: isSystem ? '11px' : '13px', lineHeight: '1.45', fontFamily: _FONT,
        overflowWrap: 'anywhere'
      }, { text: body });
      if (createdAt && !isSystem) {
        bubble.title = new Date(createdAt).toLocaleString();
      }
      if (state) {
        var meta = el('div', {
          marginTop: '4px', fontSize: '10px',
          color: isVisitor ? 'rgba(255,255,255,.78)' : themeColor('mutedTextColor', '#6b7280'),
          fontFamily: _FONT
        }, { text: state });
        bubble.appendChild(meta);
      }
      ap(row, bubble);
      ap(thread, row);
      scrollThread();
      return row;
    }
    function renderThread(messages) {
      thread.innerHTML = '';
      if (messages && messages.length) {
        addBubble('system', 'Welcome back. Continue your conversation with our team.');
        for (var mi = 0; mi < messages.length; mi++) {
          addBubble(messages[mi].role, messages[mi].body, messages[mi].createdAt);
        }
      } else {
        addBubble('staff', greeting || 'Hi there! How can we help today?');
      }
    }
    function updateLauncherBadge() {
      if (!launcherBadge) return;
      launcherBadge.textContent = String(visitorUnreadCount);
      launcherBadge.style.display = visitorUnreadCount > 0 ? 'inline-flex' : 'none';
    }
    function notifyVisitorReply(conversation) {
      visitorUnreadCount += 1;
      updateLauncherBadge();
      var latest = conversation && conversation.messages ? conversation.messages[conversation.messages.length - 1] : null;
      if (!isOpen) {
        lcStatus.textContent = 'New reply from our team.';
      }
      if ('Notification' in window && Notification.permission === 'granted' && (!isOpen || document.visibilityState !== 'visible')) {
        try {
          new Notification('LiveCom reply from our team', {
            body: latest && latest.body ? String(latest.body).slice(0, 120) : 'Open the messenger to continue the conversation.',
            tag: 'oyama-livecom-' + conversationId
          });
        } catch (_) {}
      }
    }
    function mergeThread(conversation) {
      var messages = conversation && conversation.messages ? conversation.messages : [];
      var signature = messages.map(function (message) { return message.id; }).join('|');
      var newStaffMessage = false;
      for (var i = 0; i < messages.length; i++) {
        var item = messages[i];
        if (publicThreadHydrated && item.role === 'staff' && !knownPublicMessageIds[item.id]) {
          newStaffMessage = true;
        }
        knownPublicMessageIds[item.id] = true;
      }
      publicThreadHydrated = true;
      if (signature !== lastThreadSignature) {
        lastThreadSignature = signature;
        if (conversation && conversation.visitorName && conversation.visitorName !== 'Website Visitor') lcNameInp.value = conversation.visitorName;
        if (conversation && conversation.visitorEmail) lcEmailInp.value = conversation.visitorEmail;
        renderThread(messages);
      }
      if (newStaffMessage) notifyVisitorReply(conversation);
    }
    function showIdentityIfNeeded() {
      if (identityBox.style.display !== 'none') return;
      if (identityDismissed) return;
      if (String(lcEmailInp.value || '').trim()) return;
      identityBox.style.display = 'block';
    }
    function loadThread() {
      if (threadLoading) return;
      if (!conversationId) { renderThread([]); return; }
      threadLoading = true;
      var qs = '?token=' + encodeURIComponent(runtime.token) +
        '&conversationId=' + encodeURIComponent(conversationId) +
        '&visitorSessionId=' + encodeURIComponent(visitorSessionId) +
        '&domain=' + encodeURIComponent(window.location.hostname) +
        '&_=' + Date.now();
      fetch(runtime.apiBaseUrl + '/api/site-embeds/public/livecom-thread' + qs, { mode: 'cors', credentials: 'omit', cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('Thread refresh failed');
          return r.json();
        })
        .then(function (p) {
          threadLoading = false;
          if (lastThreadHadError) {
            lcStatus.textContent = '';
            rText.textContent = respTime;
          }
          lastThreadHadError = false;
          var c = p && p.data ? p.data.conversation : null;
          if (c && c.messages) {
            mergeThread(c);
          } else {
            renderThread([]);
          }
        }).catch(function () {
          threadLoading = false;
          lastThreadHadError = true;
          rText.textContent = 'Reconnecting...';
          lcStatus.textContent = 'Connection interrupted. We are retrying.';
          lcStatus.style.color = themeColor('mutedTextColor', '#6b7280');
        });
    }
    loadThread();
    threadPollTimer = setInterval(function () {
      if (conversationId) loadThread();
    }, 3000);

    if (showBranding) {
      var bFoot = el('div', { padding: '8px 18px', borderTop: '1px solid ' + themeColor('borderColor', '#f3f4f6'), textAlign: 'center', fontSize: '11px', color: '#d1d5db', flexShrink: '0' },
        { html: 'Powered by <a href="https://oyamacrm.com" target="_blank" rel="noopener" style="color:#d1d5db;text-decoration:none;font-weight:600">OyamaCRM v1.3</a>' });
      ap(panel, hdr, rBar, pBody, bFoot);
    } else {
      ap(panel, hdr, rBar, pBody);
    }

    function sendCurrentMessage() {
      var msg = String(msgArea.value || '').trim();
      if (!msg) { lcStatus.textContent = 'Please enter a message.'; lcStatus.style.color = '#dc2626'; return; }
      var failedMessage = msg;
      addBubble('visitor', msg, new Date().toISOString(), 'Sending...');
      msgArea.value = '';
      showIdentityIfNeeded();
      lcStatus.textContent = 'Sending\u2026'; lcStatus.style.color = themeColor('mutedTextColor', '#6b7280'); sendBtn.disabled = true;
      var payload = new URLSearchParams();
      payload.set('token', runtime.token); payload.set('name', String(lcNameInp.value || '').trim());
      payload.set('email', String(lcEmailInp.value || '').trim()); payload.set('message', msg);
      payload.set('visitorSessionId', visitorSessionId);
      if (conversationId) payload.set('conversationId', conversationId);
      payload.set('domain', window.location.hostname); payload.set('pageUrl', window.location.href);
      payload.set('referrerUrl', document.referrer || '');
      fetch(runtime.apiBaseUrl + '/api/site-embeds/public/livecom', {
        method: 'POST', mode: 'cors', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: payload.toString()
      }).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (p) {
          if (!r.ok) {
            var msg = (p && p.error && p.error.message) ? String(p.error.message) : 'Failed to send. Please try again.';
            throw new Error(msg);
          }
          return p;
        });
      }).then(function (p) {
        if (p && p.data && p.data.conversationId) {
          conversationId = String(p.data.conversationId);
          try { localStorage.setItem(conversationKey, conversationId); } catch (_) {}
        }
        if (p && p.data && p.data.conversation) {
          mergeThread(p.data.conversation);
        }
        lcStatus.textContent = 'Thanks - your message has been sent to our team.';
        lcStatus.style.color = themeColor('mutedTextColor', '#6b7280');
        sendBtn.disabled = false;
        msgArea.focus();
        ping('livecom_message_sent');
      }).catch(function (err) {
        lcStatus.textContent = (err && err.message) ? String(err.message) : 'Failed to send. Please try again.';
        lcStatus.style.color = '#dc2626';
        sendBtn.disabled = false;
        var retryRow = el('div', { display: 'flex', justifyContent: 'flex-end', margin: '-2px 0 8px' });
        var retryBtn = el('button', {
          border: '1px solid #fecaca', background: '#fef2f2', color: '#b91c1c', borderRadius: '999px',
          padding: '5px 9px', cursor: 'pointer', fontSize: '11px', fontWeight: '700', fontFamily: _FONT
        }, { type: 'button', text: 'Retry failed message' });
        retryBtn.addEventListener('click', function () {
          retryRow.parentNode && retryRow.parentNode.removeChild(retryRow);
          msgArea.value = failedMessage;
          sendCurrentMessage();
        });
        ap(retryRow, retryBtn);
        ap(thread, retryRow);
        scrollThread();
      });
    }
    sendBtn.addEventListener('click', function () {
      sendCurrentMessage();
    });
    msgArea.addEventListener('keydown', function (event) {
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        sendCurrentMessage();
      }
    });

    var launcherWrap = el('div', { display: 'flex', alignItems: 'center', gap: compactChat ? '6px' : '8px', maxWidth: '100%' });
    launcherWrap.style.justifyContent = isLeft ? 'flex-start' : 'flex-end';
    var launcher = el('button', {
      border: 'none', borderRadius: '9999px', height: compactChat ? '52px' : '56px', width: compactChat ? '52px' : '56px',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      background: col, color: '#ffffff', cursor: 'pointer',
      boxShadow: '0 8px 24px rgba(15,23,42,0.25)',
      transition: 'transform .18s ease, box-shadow .18s ease'
    }, { type: 'button', 'aria-label': btnLabel || 'Chat with us' });
    launcher.addEventListener('mouseover', function () { launcher.style.transform = 'scale(1.07)'; launcher.style.boxShadow = '0 12px 30px rgba(15,23,42,0.32)'; });
    launcher.addEventListener('mouseout', function () { launcher.style.transform = 'scale(1)'; launcher.style.boxShadow = '0 8px 24px rgba(15,23,42,0.25)'; });

    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', '22'); svg.setAttribute('height', '22'); svg.setAttribute('aria-hidden', 'true');
    var ip = document.createElementNS(ns, 'path');
    if (iconStyle === 'heart') {
      svg.setAttribute('fill', 'currentColor');
      ip.setAttribute('d', 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A5.98 5.98 0 0116.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z');
    } else if (iconStyle === 'spark') {
      svg.setAttribute('fill', 'currentColor');
      ip.setAttribute('d', 'M12 2l1.8 4.7L18 8.5l-4.2 1.8L12 15l-1.8-4.7L6 8.5l4.2-1.8L12 2zm6 10l1 2.6 2.6 1L19 16.6 18 19l-1-2.4-2.4-1 2.4-1L18 12zM6 12l1 2.6 2.6 1L7 16.6 6 19l-1-2.4-2.4-1 2.4-1L6 12z');
    } else if (iconStyle === 'hand') {
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
      ip.setAttribute('d', 'M18 11V6a2 2 0 0 0-4 0v5');
      var hp2 = document.createElementNS(ns, 'path'); hp2.setAttribute('d', 'M14 10V4a2 2 0 0 0-4 0v6');
      var hp3 = document.createElementNS(ns, 'path'); hp3.setAttribute('d', 'M10 10.5V6a2 2 0 0 0-4 0v8');
      var hp4 = document.createElementNS(ns, 'path'); hp4.setAttribute('d', 'M6 14v1a6 6 0 0 0 12 0v-3');
      svg.appendChild(hp2); svg.appendChild(hp3); svg.appendChild(hp4);
    } else {
      svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor'); svg.setAttribute('stroke-width', '2');
      ip.setAttribute('d', 'M4 5h16v10H7l-3 3V5');
      var cl1 = document.createElementNS(ns, 'path'); cl1.setAttribute('d', 'M8 9h8');
      var cl2 = document.createElementNS(ns, 'path'); cl2.setAttribute('d', 'M8 12h5');
      svg.appendChild(cl1); svg.appendChild(cl2);
    }
    svg.appendChild(ip);
    launcher.appendChild(svg);
    launcherBadge = el('span', {
      position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px',
      borderRadius: '999px', background: '#dc2626', color: '#ffffff', display: 'none',
      alignItems: 'center', justifyContent: 'center', padding: '0 5px', fontSize: '11px',
      fontWeight: '800', border: '2px solid #ffffff', boxSizing: 'border-box', fontFamily: _FONT
    }, { text: '0' });
    launcher.style.position = 'relative';
    launcher.appendChild(launcherBadge);

    if (btnLabel && !compactChat) {
      var lPill = el('span', {
        background: themeColor('backgroundColor', '#ffffff'), border: '1px solid ' + themeColor('borderColor', '#e5e7eb'), borderRadius: '9999px',
        padding: '6px 12px', fontSize: '13px', fontWeight: '600', color: themeColor('textColor', '#1f2937'),
        boxShadow: '0 3px 10px rgba(15,23,42,0.08)', fontFamily: _FONT, whiteSpace: 'nowrap'
      }, { text: btnLabel });
      lPill.style.order = isLeft ? '1' : '0';
      ap(launcherWrap, lPill);
    }
    launcher.style.order = isLeft ? '0' : '1';
    ap(launcherWrap, launcher);

    var isOpen = false;
    function togglePanel(open) {
      isOpen = open;
      if (open) {
        visitorUnreadCount = 0;
        updateLauncherBadge();
        panel.style.display = 'flex';
        if (conversationId) loadThread();
        setTimeout(function () { panel.style.opacity = '1'; panel.style.transform = 'scale(1)'; }, 10);
      } else {
        panel.style.opacity = '0'; panel.style.transform = 'scale(0.92)';
        setTimeout(function () { if (!isOpen) panel.style.display = 'none'; }, 200);
      }
      ping(open ? 'livecom_opened' : 'livecom_closed');
    }
    launcher.addEventListener('click', function () { togglePanel(!isOpen); });
    closeBtn.addEventListener('click', function () { togglePanel(false); });

    ap(wrapper, panel, launcherWrap);
    document.body.appendChild(wrapper);
    window.OyamaCRMEmbeds.openLiveCom = function () { togglePanel(true); };
    window.OyamaCRMEmbeds.closeLiveCom = function () { togglePanel(false); };
  }

  // ── Inline widget rendering ────────────────────────────────────

  function renderInlineEmbeds() {
    var nodes = document.querySelectorAll('[data-oyama-embed]');
    var keyMap = {
      'campaign-meter': 'campaign_meter', 'donation-widget': 'donation_widget',
      'event-card': 'event_card', 'volunteer-signup': 'volunteer_signup',
      'newsletter-signup': 'newsletter_signup', 'impact-counter': 'impact_counter',
      'cta-block': 'cta_block'
    };
    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];
      if (node.getAttribute('data-oyama-mounted') === 'true') continue;
      var embedType = String(node.getAttribute('data-oyama-embed') || '').trim();
      var wk = keyMap[embedType] || '';
      if (!wk) continue;
      node.setAttribute('data-oyama-mounted', 'true');
      if (!isWidgetEnabled(wk)) {
        node.style.padding = '16px'; node.style.border = '1px dashed #e5e7eb';
        node.style.borderRadius = '10px'; node.style.fontFamily = _FONT;
        node.style.fontSize = '13px'; node.style.color = '#9ca3af';
        node.style.width = '100%'; node.style.boxSizing = 'border-box';
        node.textContent = 'Widget disabled. Enable in DonorCRM Site Embeds settings.';
        continue;
      }
      (function (n, k) {
        if (k === 'donation_widget') renderDonationWidget(n);
        else if (k === 'campaign_meter') renderCampaignMeter(n);
        else if (k === 'event_card') renderEventCard(n);
        else if (k === 'volunteer_signup') renderVolunteerSignup(n);
        else if (k === 'newsletter_signup') renderNewsletterSignup(n);
        else if (k === 'impact_counter') renderImpactCounter(n);
        else if (k === 'cta_block') renderCtaBlock(n);
        ping(k + '_rendered');
      })(node, wk);
    }
  }

  // ── Boot ──────────────────────────────────────────────────────

  window.OyamaCRMEmbeds.boot = function () {
    ensureLiveCom();
    renderInlineEmbeds();
    ping('loader_boot');
  };

  window.OyamaCRMEmbeds.refreshInlineEmbeds = function () { renderInlineEmbeds(); };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.OyamaCRMEmbeds.boot(); });
  } else {
    window.OyamaCRMEmbeds.boot();
  }
})();`;
}
