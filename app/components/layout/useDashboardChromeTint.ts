/**
 * Loads dashboard appearance and derives a Donor CRM chrome tint from the selected header image.
 */
"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { deriveDashboardChromeTint, extractDashboardImageTint, type DashboardChromeTint } from "@/app/lib/dashboard-image-tint";
import type { DashboardAppearanceSettings } from "@/app/features/donor-dashboard/types";

function readPersonalHeaderImageUrl(userId: string | undefined): string {
  if (!userId || typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(`oyama_dashboard_prefs_${userId}`);
    if (!raw) return "";
    const parsed = JSON.parse(raw) as { headerImageUrl?: string };
    return typeof parsed.headerImageUrl === "string" ? parsed.headerImageUrl : "";
  } catch {
    return "";
  }
}

export function useDashboardChromeTint(userId: string | undefined): DashboardChromeTint {
  const [tint, setTint] = useState<DashboardChromeTint>(() => deriveDashboardChromeTint("#047857"));

  useEffect(() => {
    let active = true;

    async function loadTint() {
      try {
        const appearance = await apiFetch<DashboardAppearanceSettings>("/api/settings/dashboard-appearance");
        if (!active) return;
        const selectedImage = readPersonalHeaderImageUrl(userId) || appearance.headerImageUrl;
        const imageTint = selectedImage ? await extractDashboardImageTint(selectedImage) : null;
        if (!active) return;
        setTint(imageTint ?? deriveDashboardChromeTint(appearance.overlayColor));
      } catch {
        if (active) setTint(deriveDashboardChromeTint("#047857"));
      }
    }

    void loadTint();
    return () => {
      active = false;
    };
  }, [userId]);

  return tint;
}
