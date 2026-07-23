/** Workspaces settings page manages module enablement and startup defaults. */
"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  getDonorAccentTheme,
  normalizeWorkspaceSettings,
  saveWorkspaceSettings,
  type WorkspaceSettings,
  type DonorAccentTone,
  type WorkspaceKey,
} from "@/app/lib/workspace-settings";
import { apiFetch } from "@/app/lib/auth-client";

/** WorkspacesSettingsPage provides a complete workspace-controls surface for admins. */
export default function WorkspacesSettingsPage() {
  const [settings, setSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [loaded, setLoaded] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSettings() {
      try {
        const payload = await apiFetch<WorkspaceSettings>("/api/settings/workspaces");
        if (!active) return;
        setSettings(normalizeWorkspaceSettings(payload));
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load workspace settings");
      } finally {
        if (active) setLoaded(true);
      }
    }

    void loadSettings();
    return () => {
      active = false;
    };
  }, []);

  /** Updates one workspace setting field. */
  function setField<K extends keyof WorkspaceSettings>(key: K, value: WorkspaceSettings[K]) {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
    setError(null);
  }

  /** Persists workspace settings for the whole organization through the backend API. */
  async function handleSaveWorkspaceSettings() {
    setSaving(true);
    setError(null);
    try {
      const savedSettings = await saveWorkspaceSettings(settings);
      setSettings(savedSettings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3650);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save workspace settings");
      setSaved(false);
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-7 w-48 bg-gray-200 rounded" />
        <div className="h-32 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  const blockedState = !settings.donorEnabled && !settings.compassionEnabled;

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Workspaces</h1>
        <p className="text-sm text-gray-500 mt-0.5">Control module availability, startup behavior, and donor shell style for DonorCRM and Compassion CRM.</p>
      </div>

      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        Workspace settings are saved organization-wide and applied across login routing, module availability, and TopBar switcher visibility.
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {saved && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          Workspace settings saved.
        </div>
      )}

      {blockedState && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          At least one workspace must remain enabled.
        </div>
      )}

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Workspace Enablement</h2>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-700">Enable DonorCRM</span>
          <input
            type="checkbox"
            checked={settings.donorEnabled}
            onChange={(e) => setField("donorEnabled", e.target.checked)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-700">Enable Compassion CRM</span>
          <input
            type="checkbox"
            checked={settings.compassionEnabled}
            onChange={(e) => setField("compassionEnabled", e.target.checked)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
        </label>

        <label className="flex items-center justify-between gap-3">
          <span className="text-sm text-gray-700">Show module switcher in TopBar</span>
          <input
            type="checkbox"
            checked={settings.showModuleSwitcher}
            onChange={(e) => setField("showModuleSwitcher", e.target.checked)}
            className="rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
        </label>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Startup Defaults</h2>
        <label className="text-sm text-gray-700 block">
          Default workspace after login
          <select
            value={settings.defaultWorkspace}
            onChange={(e) => setField("defaultWorkspace", e.target.value as WorkspaceKey)}
            className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="donor">DonorCRM</option>
            <option value="compassion">Compassion CRM</option>
          </select>
        </label>
      </section>

      <section className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">DonorCRM v1.3 Shell</h2>

        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3 text-sm leading-6 text-indigo-950">
          <p className="font-semibold">Full-width navigation is enabled</p>
          <p className="mt-1 text-xs">The Donor CRM uses a consistent top bar with workspace navigation, advanced search, quick actions, tools, notifications, and account controls. It no longer uses a desktop sidebar.</p>
        </div>

        <label className="text-sm text-gray-700 block">
          Accent color
          <select
            value={settings.donorAccentTone}
            onChange={(e) => setField("donorAccentTone", e.target.value as DonorAccentTone)}
            className="mt-1 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="green">Green</option>
            <option value="blue">Blue</option>
            <option value="teal">Teal</option>
            <option value="amber">Amber</option>
          </select>
        </label>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
          <p className="font-semibold text-slate-800">Preview</p>
          <div className="mt-2 flex items-center gap-2">
            <span className={`inline-flex h-2.5 w-8 rounded-full ${getDonorAccentTheme(settings.donorAccentTone).topBarAccentLine}`} />
            <span>Layout: Full-width navigation</span>
          </div>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSaveWorkspaceSettings}
          disabled={blockedState || saving}
          className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Workspace Settings"}
        </button>
      </div>
    </div>
  );
}
