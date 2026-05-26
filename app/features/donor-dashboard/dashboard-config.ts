/**
 * Default Donor Dashboard configuration and stable hero action registry.
 */

import type { DashboardAppearanceSettings, DashboardHeroActionId } from "./types";

export const DASHBOARD_APPEARANCE_DEFAULTS: DashboardAppearanceSettings = {
  headerImageUrl: "",
  headerImagePosition: "center",
  overlayStrength: 62,
  overlayColor: "#052e24",
  showQuoteCard: false,
  quoteText: "",
  quoteAuthor: "",
  heroTitleMode: "greeting",
  customHeroText: "",
  greetingStyle: "warm",
  primaryActions: ["record-gift", "view-reports", "open-tasks"],
  heroHeight: "standard",
  density: "comfortable",
  defaultPeriod: "fiscal-ytd",
  defaultCampaignId: "",
  showStewardSuggestions: true,
  showRecentDonorMovement: true,
  showCampaignImpactCards: true,
  showProjectsAndInitiatives: true,
};

export const DASHBOARD_HERO_ACTIONS: Record<DashboardHeroActionId, { label: string; href: string; primary?: boolean }> = {
  "record-gift": { label: "Record Gift", href: "/donations?recordGift=1", primary: true },
  "view-reports": { label: "View Reports", href: "/reports" },
  "open-tasks": { label: "Open Tasks", href: "/tasks" },
};

export function normalizeDashboardAppearanceSettings(input: Partial<DashboardAppearanceSettings> | null | undefined): DashboardAppearanceSettings {
  const raw = input ?? {};
  const allowedActions = new Set<DashboardHeroActionId>(["record-gift", "view-reports", "open-tasks"]);
  const primaryActions = Array.isArray(raw.primaryActions)
    ? raw.primaryActions.filter((action): action is DashboardHeroActionId => allowedActions.has(action as DashboardHeroActionId))
    : DASHBOARD_APPEARANCE_DEFAULTS.primaryActions;

  return {
    ...DASHBOARD_APPEARANCE_DEFAULTS,
    ...raw,
    overlayStrength: Math.min(90, Math.max(0, Number(raw.overlayStrength ?? DASHBOARD_APPEARANCE_DEFAULTS.overlayStrength))),
    overlayColor: /^#[0-9a-fA-F]{6}$/.test(String(raw.overlayColor ?? "")) ? String(raw.overlayColor) : DASHBOARD_APPEARANCE_DEFAULTS.overlayColor,
    primaryActions: primaryActions.length > 0 ? primaryActions : DASHBOARD_APPEARANCE_DEFAULTS.primaryActions,
  };
}
