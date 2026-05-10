/** Shared workspace settings helpers for module enablement and startup routing. */
import { apiFetch } from "@/app/lib/auth-client";

/** Allowed default workspace values persisted by the backend. */
export type WorkspaceKey = "donor" | "compassion";

/** Organization-wide workspace controls consumed by admin/settings and runtime shells. */
export interface WorkspaceSettings {
  donorEnabled: boolean;
  compassionEnabled: boolean;
  showModuleSwitcher: boolean;
  defaultWorkspace: WorkspaceKey;
}

/** Safe defaults used when settings are unavailable or malformed. */
export const DEFAULT_WORKSPACE_SETTINGS: WorkspaceSettings = {
  donorEnabled: true,
  compassionEnabled: true,
  showModuleSwitcher: true,
  defaultWorkspace: "donor",
};

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

  // Ensure impossible states still produce a usable runtime configuration.
  if (!donorEnabled && !compassionEnabled) {
    return {
      donorEnabled: true,
      compassionEnabled: false,
      showModuleSwitcher,
      defaultWorkspace: "donor",
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
