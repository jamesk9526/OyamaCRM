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
}

/** Full widget state map for one connected website. */
export interface SiteWidgetSettings {
  /** LiveCom floating messenger state and appearance settings. */
  liveCom: LiveComWidgetSettings;
  /** Placeholder state for campaign-meter embeddable blocks. */
  campaign_meter: { enabled: boolean };
  /** Placeholder state for donation-widget embeddable blocks. */
  donation_widget: { enabled: boolean };
  /** Placeholder state for event-card embeddable blocks. */
  event_card: { enabled: boolean };
  /** Placeholder state for volunteer-signup embeddable blocks. */
  volunteer_signup: { enabled: boolean };
  /** Placeholder state for newsletter-signup embeddable blocks. */
  newsletter_signup: { enabled: boolean };
  /** Placeholder state for impact-counter embeddable blocks. */
  impact_counter: { enabled: boolean };
  /** Placeholder state for CTA-block embeddable blocks. */
  cta_block: { enabled: boolean };
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
