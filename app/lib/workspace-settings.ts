/** Shared workspace settings helpers for module enablement and startup routing. */
import { apiFetch } from "@/app/lib/auth-client";

/** Allowed default workspace values persisted by the backend. */
export type WorkspaceKey = "donor" | "compassion";

/** Donor shell navigation modes supported by AppShell. */
export type DonorNavigationLayout = "mega" | "sidebar";

/** Accent options available for donor shell chrome controls. */
export type DonorAccentTone = "green" | "blue" | "teal" | "amber";

export interface DonorAccentTheme {
  navActive: string;
  navRing: string;
  navText: string;
  navTextStrong: string;
  iconTint: string;
  iconTintSoft: string;
  iconBorder: string;
  topBarAccentLine: string;
  sidebarAccent: string;
  sidebarIconActive: string;
}

/** Organization-wide workspace controls consumed by admin/settings and runtime shells. */
export interface WorkspaceSettings {
  donorEnabled: boolean;
  compassionEnabled: boolean;
  showModuleSwitcher: boolean;
  defaultWorkspace: WorkspaceKey;
  donorNavigationLayout: DonorNavigationLayout;
  donorAccentTone: DonorAccentTone;
}

/** Safe defaults used when settings are unavailable or malformed. */
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  donorEnabled: true,
  compassionEnabled: true,
  showModuleSwitcher: true,
  defaultWorkspace: "donor",
  donorNavigationLayout: "mega",
  donorAccentTone: "green",
};

const DONOR_ACCENT_THEMES: Record<DonorAccentTone, DonorAccentTheme> = {
  green: {
    navActive: "bg-emerald-500/15",
    navRing: "ring-1 ring-emerald-400/25 border-emerald-400/30",
    navText: "text-emerald-200",
    navTextStrong: "text-emerald-100",
    iconTint: "text-emerald-200",
    iconTintSoft: "bg-emerald-400/10",
    iconBorder: "border-emerald-400/20",
    topBarAccentLine: "bg-green-600",
    sidebarAccent: "bg-emerald-500",
    sidebarIconActive: "text-emerald-400",
  },
  blue: {
    navActive: "bg-blue-500/15",
    navRing: "ring-1 ring-blue-400/25 border-blue-400/30",
    navText: "text-blue-200",
    navTextStrong: "text-blue-100",
    iconTint: "text-blue-200",
    iconTintSoft: "bg-blue-400/10",
    iconBorder: "border-blue-400/20",
    topBarAccentLine: "bg-blue-600",
    sidebarAccent: "bg-blue-500",
    sidebarIconActive: "text-blue-400",
  },
  teal: {
    navActive: "bg-teal-500/15",
    navRing: "ring-1 ring-teal-400/25 border-teal-400/30",
    navText: "text-teal-200",
    navTextStrong: "text-teal-100",
    iconTint: "text-teal-200",
    iconTintSoft: "bg-teal-400/10",
    iconBorder: "border-teal-400/20",
    topBarAccentLine: "bg-teal-500",
    sidebarAccent: "bg-teal-500",
    sidebarIconActive: "text-teal-400",
  },
  amber: {
    navActive: "bg-amber-500/15",
    navRing: "ring-1 ring-amber-400/30 border-amber-400/30",
    navText: "text-amber-200",
    navTextStrong: "text-amber-100",
    iconTint: "text-amber-200",
    iconTintSoft: "bg-amber-400/10",
    iconBorder: "border-amber-400/20",
    topBarAccentLine: "bg-amber-500",
    sidebarAccent: "bg-amber-500",
    sidebarIconActive: "text-amber-400",
  },
};

/** Returns resolved donor accent theme classes for shell controls. */
export function getDonorAccentTheme(tone: DonorAccentTone): DonorAccentTheme {
  return DONOR_ACCENT_THEMES[tone] ?? DONOR_ACCENT_THEMES.green;
}

/** Returns a normalized workspace settings object from unknown API payloads. */
export function normalizeWorkspaceSettings(input: unknown): WorkspaceSettings {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }
  const raw = input as Record<string, unknown>;
  const donorEnabled = typeof raw.donorEnabled === "boolean" ? raw.donorEnabled : DEFAULT_WORKSPACE_SETTINGS.donorEnabled;
  const compassionEnabled = typeof raw.compassionEnabled === "boolean" ? raw.compassionEnabled : DEFAULT_WORKSPACE_SETTINGS.compassionEnabled;
  const showModuleSwitcher = typeof raw.showModuleSwitcher === "boolean"
    ? raw.showModuleSwitcher
    : DEFAULT_WORKSPACE_SETTINGS.showModuleSwitcher;
  const defaultWorkspace = raw.defaultWorkspace === "compassion" ? "compassion" : "donor";
  const donorNavigationLayout = raw.donorNavigationLayout === "sidebar" ? "sidebar" : "mega";
  const donorAccentTone = raw.donorAccentTone === "blue"
    || raw.donorAccentTone === "teal"
    || raw.donorAccentTone === "amber"
    || raw.donorAccentTone === "green"
    ? raw.donorAccentTone
    : "green";

  // Ensure impossible states still produce a usable runtime configuration.
  if (!donorEnabled && !compassionEnabled) {
    return {
      donorEnabled: true,
      compassionEnabled: false,
      showModuleSwitcher,
      defaultWorkspace: "donor",
      donorNavigationLayout,
      donorAccentTone,
    };
  }

  const safeDefault = defaultWorkspace === "donor"
    ? (donorEnabled ? "donor" : "compassion")
    : (compassionEnabled ? "compassion" : "donor");

  return {
    donorEnabled,
    compassionEnabled,
    showModuleSwitcher,
    defaultWorkspace: safeDefault,
    donorNavigationLayout,
    donorAccentTone,
  };
}

/** Loads workspace settings for the current authenticated organization with safe fallback. */
export async function fetchWorkspaceSettings(): Promise<WorkspaceSettings> {
  try {
    const payload = await apiFetch<WorkspaceSettings>("/api/settings/workspaces");
    return normalizeWorkspaceSettings(payload);
  } catch {
    return { ...DEFAULT_WORKSPACE_SETTINGS };
  }
}

/** Saves a complete workspace settings payload and returns normalized settings from the backend. */
export async function saveWorkspaceSettings(settings: WorkspaceSettings): Promise<WorkspaceSettings> {
  const payload = await apiFetch<WorkspaceSettings>("/api/settings/workspaces", {
    method: "PUT",
    body: JSON.stringify(settings),
  });
  return normalizeWorkspaceSettings(payload);
}

/** Patches workspace settings by merging current remote state with partial updates. */
export async function patchWorkspaceSettings(partial: Partial<WorkspaceSettings>): Promise<WorkspaceSettings> {
  const current = await fetchWorkspaceSettings();
  return saveWorkspaceSettings({ ...current, ...partial });
}

/** Computes the preferred landing route after login based on enabled/default workspace settings. */
export function resolveWorkspaceLandingPath(settings: WorkspaceSettings): string {
  if (settings.defaultWorkspace === "compassion" && settings.compassionEnabled) {
    return "/compassion/dashboard";
  }
  if (settings.donorEnabled) {
    return "/";
  }
  if (settings.compassionEnabled) {
    return "/compassion/dashboard";
  }
  return "/";
}
