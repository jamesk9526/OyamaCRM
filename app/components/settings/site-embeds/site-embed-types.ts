// Shared types and small helpers for the DonorCRM Site Embed settings workspace.

/** One embeddable registry entry returned by the backend embed-registry API. */
export interface SiteEmbedRegistryEntry {
  /** Stable machine key for config wiring and future widget registration. */
  key: string;
  /** Human-friendly embeddable name for admin UI cards. */
  name: string;
  /** Plain-language summary shown to nonprofit admins. */
  description: string;
  /** Widget presentation style category. */
  type: "floating" | "inline" | "hybrid";
  /** Install requirements shown in setup guidance. */
  scriptRequirements: string;
  /** True when this embeddable is fully implemented in the current release. */
  implemented: boolean;
}

/** LiveCom floating-widget settings exposed to admin controls. */
export interface LiveComWidgetSettings {
  /** Enables or disables the floating messenger button on the connected website. */
  enabled: boolean;
  /** Text label shown in the floating button. */
  buttonLabel: string;
  /** Launcher anchor position for website viewport placement. */
  buttonPosition: "bottom-right" | "bottom-left";
  /** Greeting copy shown in the expanded message panel. */
  greetingMessage: string;
  /** Hex brand color used for chathead icon and panel accents. */
  chatheadColor: string;
  /** Icon style shown inside the floating chathead. */
  iconStyle: "chat" | "spark" | "heart" | "hand";
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

/** Donation widget settings – Stripe Embedded Checkout. */
export interface DonationWidgetSettings {
  enabled: boolean;
  headline: string;
  supportingCopy: string;
  suggestedAmounts: number[];
  minimumAmountCents: number;
  enableMonthlyGiving: boolean;
  defaultDesignation: string;
  allowedDesignations: string[];
  accentColor: string;
  trustLine: string;
  successMessage: string;
  failureMessage: string;
  stripeTestMode: boolean;
}

/** Campaign progress meter widget settings. */
export interface CampaignMeterSettings {
  enabled: boolean;
  campaignId: string;
  ctaLabel: string;
  ctaHref: string;
  accentColor: string;
}

/** Event card widget settings. */
export interface EventCardSettings {
  enabled: boolean;
  eventId: string;
  showFundraisingProgress: boolean;
  accentColor: string;
}

/** Volunteer sign-up form widget settings. */
export interface VolunteerSignupSettings {
  enabled: boolean;
  headline: string;
  supportingCopy: string;
  interestAreas: string[];
  successMessage: string;
  accentColor: string;
}

/** Newsletter sign-up form widget settings. */
export interface NewsletterSignupSettings {
  enabled: boolean;
  headline: string;
  supportingCopy: string;
  consentLine: string;
  successMessage: string;
  accentColor: string;
}

/** Impact counter stat grid widget settings. */
export interface ImpactCounterSettings {
  enabled: boolean;
  statsJson: string;
  disclaimer: string;
  accentColor: string;
}

/** CTA block widget settings. */
export interface CtaBlockSettings {
  enabled: boolean;
  headline: string;
  bodyCopy: string;
  primaryButtonLabel: string;
  primaryButtonHref: string;
  secondaryButtonLabel: string;
  secondaryButtonHref: string;
  layout: "card" | "banner" | "minimal";
  accentColor: string;
}

/** Site-wide appearance settings shared by all public widgets for one connected website. */
export interface SiteEmbedAppearanceSettings {
  /** Site-level accent used when widget-specific accent fields are blank. */
  accentColor: string;
  /** Card/background color for light and soft modes. */
  backgroundColor: string;
  /** Primary text color rendered by public widgets. */
  textColor: string;
  /** Secondary helper-copy text color rendered by public widgets. */
  mutedTextColor: string;
  /** Border color for cards, fields, and low-emphasis controls. */
  borderColor: string;
  /** Overall embed surface mode. */
  themeMode: "light" | "soft" | "transparent";
  /** Controls padding density for shared widget helpers. */
  density: "comfortable" | "compact";
  /** Shared corner treatment for public cards and controls. */
  cornerRadius: "square" | "soft" | "rounded";
  /** Inline card chrome style. */
  cardStyle: "flat" | "bordered" | "elevated";
  /** Shared CTA button treatment. */
  buttonStyle: "solid" | "soft" | "outline";
  /** Hosted font stack choice. */
  fontFamily: "system" | "serif" | "rounded";
}

/** Full widget state map for one connected website. */
export interface SiteWidgetSettings {
  /** LiveCom floating messenger state and appearance settings. */
  liveCom: LiveComWidgetSettings;
  donation_widget: DonationWidgetSettings;
  campaign_meter: CampaignMeterSettings;
  event_card: EventCardSettings;
  volunteer_signup: VolunteerSignupSettings;
  newsletter_signup: NewsletterSignupSettings;
  impact_counter: ImpactCounterSettings;
  cta_block: CtaBlockSettings;
}

/** Last connection-test payload for one configured site. */
export interface SiteConnectionTestResult {
  /** True when the latest test passed configuration and status checks. */
  ok: boolean;
  /** Human-readable test summary message. */
  message: string;
  /** ISO timestamp for when this result was captured. */
  checkedAt: string;
  /** Last observed public domain from script ping data. */
  observedDomain?: string;
  /** Active widget keys reported during connection checks. */
  activeWidgets?: string[];
  /** Validation issues detected during test execution. */
  issues?: string[];
}

/** Last successful script-load ping tracked for one site connection. */
export interface SiteScriptLoadStatus {
  /** ISO timestamp for the latest loader ping. */
  loadedAt: string;
  /** Domain where the loader ping originated. */
  domain: string;
  /** Ping reason marker (boot, open, message, etc.). */
  reason: string;
  /** Widget keys that were active when the ping occurred. */
  activeWidgets: string[];
}

/** One externally connected website configuration record. */
export interface SiteEmbedSiteConfig {
  /** Internal connection ID used by backend routes. */
  id: string;
  /** Human-friendly display name for admins. */
  name: string;
  /** Public site identifier included in generated snippets. */
  publicSiteId: string;
  /** Primary domain associated with this site connection. */
  primaryDomain: string;
  /** Additional allow-listed domains/subdomains for script execution. */
  allowedDomains: string[];
  /** Public embed token used in header/footer snippets. */
  embedToken: string;
  /** Active/inactive flag for script serving and public endpoints. */
  active: boolean;
  /** Site-wide visual defaults used by every public widget. */
  appearance: SiteEmbedAppearanceSettings;
  /** Per-widget state and settings map. */
  widgets: SiteWidgetSettings;
  /** Last test result shown in the status panel. */
  lastConnectionTestResult: SiteConnectionTestResult | null;
  /** Last successful script load ping shown in the status panel. */
  lastSuccessfulScriptLoad: SiteScriptLoadStatus | null;
}

/** Generated snippet set for one selected site connection. */
export interface SiteEmbedSnippetBundle {
  /** Script snippet intended for website <head>. */
  headSnippet: string;
  /** Script snippet intended for placement before </body>. */
  footerSnippet: string;
  /** Optional inline block snippets for future embeddables. */
  embedBlocks: Record<string, string>;
}

/** API payload returned by GET /api/site-embeds/config. */
export interface SiteEmbedsConfigPayload {
  /** Full embeddable registry for current/future widget architecture. */
  registry: SiteEmbedRegistryEntry[];
  /** All connected sites for the current organization. */
  sites: SiteEmbedSiteConfig[];
  /** Currently selected site ID for edit/view actions. */
  selectedSiteId: string;
  /** Generated snippets for the selected site. */
  snippets: SiteEmbedSnippetBundle;
  /** API base URL used in generated script tags. */
  apiBaseUrl: string;
}

/** Converts an array of domains into textarea-friendly line-separated text. */
export function domainsToTextareaValue(domains: string[]): string {
  return domains.join("\n");
}

/** Parses textarea input into normalized unique domains. */
export function parseDomainsFromTextarea(value: string): string[] {
  const normalized = value
    .split(/[\n,]/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  return Array.from(new Set(normalized));
}
