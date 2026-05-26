/**
 * useDashboardPreferences — per-user dashboard layout preferences stored in localStorage.
 * Controls which widgets are visible and allows each user to set their own header image URL.
 */
"use client";

import { useCallback, useEffect, useState } from "react";

export interface DashboardPreferences {
  /** User's personal header image override. Empty string = use org default. */
  headerImageUrl: string;
  showImpactBand: boolean;
  showStewardSuggestions: boolean;
  showMovementFeed: boolean;
  showGivingTrend: boolean;
  showDesignationChart: boolean;
  showCampaignCards: boolean;
  showRetentionSnapshot: boolean;
  showMyDueTasks: boolean;
}

export const DASHBOARD_PREF_DEFAULTS: DashboardPreferences = {
  headerImageUrl: "",
  showImpactBand: true,
  showStewardSuggestions: true,
  showMovementFeed: true,
  showGivingTrend: true,
  showDesignationChart: true,
  showCampaignCards: true,
  showRetentionSnapshot: true,
  showMyDueTasks: true,
};

function storageKey(userId: string) {
  return `oyama_dashboard_prefs_${userId}`;
}

function loadFromStorage(userId: string): DashboardPreferences {
  if (typeof window === "undefined") return DASHBOARD_PREF_DEFAULTS;
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return DASHBOARD_PREF_DEFAULTS;
    return { ...DASHBOARD_PREF_DEFAULTS, ...(JSON.parse(raw) as Partial<DashboardPreferences>) };
  } catch {
    return DASHBOARD_PREF_DEFAULTS;
  }
}

function saveToStorage(userId: string, prefs: DashboardPreferences) {
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(prefs));
  } catch { /* quota exceeded or private browsing */ }
}

export function useDashboardPreferences(userId: string | undefined) {
  const [prefs, setPrefs] = useState<DashboardPreferences>(DASHBOARD_PREF_DEFAULTS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    setPrefs(loadFromStorage(userId));
    setLoaded(true);
  }, [userId]);

  const update = useCallback(
    (updates: Partial<DashboardPreferences>) => {
      setPrefs((prev) => {
        const next = { ...prev, ...updates };
        if (userId) saveToStorage(userId, next);
        return next;
      });
    },
    [userId],
  );

  const reset = useCallback(() => {
    setPrefs(DASHBOARD_PREF_DEFAULTS);
    if (userId) saveToStorage(userId, DASHBOARD_PREF_DEFAULTS);
  }, [userId]);

  return { prefs, update, reset, loaded };
}
