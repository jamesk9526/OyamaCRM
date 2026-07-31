"use client";

import { useEffect, useState } from "react";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import { apiFetch } from "@/app/lib/auth-client";

type Theme = "light-green" | "blue" | "violet" | "slate";
type Density = "comfortable" | "compact";

interface AppearanceSettings {
  theme: Theme;
  density: Density;
}

const DEFAULTS: AppearanceSettings = { theme: "light-green", density: "comfortable" };

const THEMES: Array<{ id: Theme; name: string; description: string; colors: [string, string, string] }> = [
  { id: "light-green", name: "Light green", description: "Default: a neutral workspace canvas with green-accented command bars.", colors: ["#0b1b27", "#176b57", "#f5f7f6"] },
  { id: "blue", name: "Blue", description: "A clear blue command bar with a cool workspace canvas.", colors: ["#0b1b31", "#0f6cbd", "#f2f8fd"] },
  { id: "violet", name: "Violet", description: "A focused purple shell with a light lavender canvas.", colors: ["#17112e", "#6f42c1", "#f8f5ff"] },
  { id: "slate", name: "Slate", description: "A restrained neutral theme for dense fundraising work.", colors: ["#111827", "#475569", "#f7f9fb"] },
];

function normalize(value: Partial<AppearanceSettings> | null | undefined): AppearanceSettings {
  return {
    theme: value?.theme === "blue" || value?.theme === "violet" || value?.theme === "slate" || value?.theme === "light-green"
      ? value.theme
      : DEFAULTS.theme,
    density: value?.density === "compact" ? "compact" : "comfortable",
  };
}

/** Individual DonorCRM appearance settings. This never changes another user's workspace. */
export default function DonorAppearancePage() {
  const [settings, setSettings] = useState<AppearanceSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void apiFetch<Partial<AppearanceSettings>>("/api/settings/donor-appearance")
      .then((response) => {
        if (!active) return;
        const next = normalize(response);
        setSettings(next);
        window.dispatchEvent(new CustomEvent("crm:donor-appearance", { detail: next }));
      })
      .catch(() => {
        if (active) setError("Your saved appearance could not be loaded. The light-green default is shown.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  /** Applies a local preview immediately; persistence still happens only on Save. */
  function preview(next: AppearanceSettings) {
    setSettings(next);
    window.dispatchEvent(new CustomEvent("crm:donor-appearance", { detail: next }));
    setMessage(null);
    setError(null);
  }

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await apiFetch<{ settings: AppearanceSettings }>("/api/settings/donor-appearance", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      const next = normalize(response.settings);
      setSettings(next);
      window.dispatchEvent(new CustomEvent("crm:donor-appearance", { detail: next }));
      setMessage("Your DonorCRM appearance has been saved.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save your appearance settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 pb-8">
      <WorkspaceBreadcrumbBar items={[{ label: "Donor CRM", href: "/" }, { label: "My appearance" }]} metadata="Personal preference" />
      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Appearance">
          <WorkspaceRibbonButton label="Save appearance" onClick={() => void save()} />
          <WorkspaceRibbonButton label="Dashboard appearance" href="/settings/dashboard-appearance" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="crm-page-header-surface border p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f6cbd]">Personal DonorCRM preference</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Choose your workspace appearance</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          This changes only your DonorCRM navigation bars, workspace canvas, and information density. It does not change organization branding, public pages, or another user&apos;s screen.
        </p>
      </section>

      {message ? <div className="border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</div> : null}
      {error ? <div className="border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{error}</div> : null}

      <section className="crm-shell-surface p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Command-bar color</h2>
            <p className="mt-1 text-sm text-slate-600">All themes keep the same dark enterprise bars and blue primary actions.</p>
          </div>
          <span className="text-xs font-medium text-slate-500">{loading ? "Loading saved choice…" : "Saved per user"}</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {THEMES.map((theme) => {
            const selected = settings.theme === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                aria-pressed={selected}
                onClick={() => preview({ ...settings, theme: theme.id })}
                className={`border p-3 text-left transition-colors ${selected ? "border-[#0f6cbd] bg-[#eff6fc] ring-1 ring-[#0f6cbd]" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"}`}
              >
                <span className="flex h-16 overflow-hidden border border-black/10" aria-hidden="true">
                  <span className="w-1/3" style={{ background: theme.colors[0] }} />
                  <span className="w-1/3" style={{ background: theme.colors[1] }} />
                  <span className="w-1/3" style={{ background: theme.colors[2] }} />
                </span>
                <span className="mt-3 block text-sm font-semibold text-slate-900">{theme.name}</span>
                <span className="mt-1 block min-h-10 text-xs leading-5 text-slate-600">{theme.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="crm-shell-surface p-4">
        <h2 className="text-base font-semibold text-slate-900">Information density</h2>
        <p className="mt-1 text-sm text-slate-600">Choose a little more breathing room or a denser working view. Your navigation remains the same.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {([
            ["comfortable", "Comfortable", "Default spacing for everyday donor work."],
            ["compact", "Compact", "Tighter controls and tables for high-volume work."],
          ] as Array<[Density, string, string]>).map(([density, name, description]) => (
            <button
              key={density}
              type="button"
              aria-pressed={settings.density === density}
              onClick={() => preview({ ...settings, density })}
              className={`border p-3 text-left ${settings.density === density ? "border-[#0f6cbd] bg-[#eff6fc] ring-1 ring-[#0f6cbd]" : "border-slate-200 bg-white hover:border-slate-300"}`}
            >
              <span className="block text-sm font-semibold text-slate-900">{name}</span>
              <span className="mt-1 block text-xs text-slate-600">{description}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="flex justify-end">
        <button type="button" onClick={() => void save()} disabled={saving || loading} className="bg-[#0f6cbd] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-60">
          {saving ? "Saving…" : "Save appearance"}
        </button>
      </div>
    </div>
  );
}
