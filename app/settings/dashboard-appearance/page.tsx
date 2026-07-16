/**
 * Dashboard Appearance Settings page — admin configures the naturalistic hero
 * header image, hero text mode, and section visibility for the Donor CRM dashboard.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import { DASHBOARD_APPEARANCE_DEFAULTS, DASHBOARD_HERO_ACTIONS } from "@/app/features/donor-dashboard/dashboard-config";
import type { DashboardAppearanceSettings, DashboardHeroActionId } from "@/app/features/donor-dashboard/types";

const DEFAULTS: DashboardAppearanceSettings = DASHBOARD_APPEARANCE_DEFAULTS;

export default function DashboardAppearancePage() {
  const [form, setForm] = useState<DashboardAppearanceSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    apiFetch<DashboardAppearanceSettings>("/api/settings/dashboard-appearance")
      .then((data) => {
        setForm(data ?? DEFAULTS);
        setImagePreview(data?.headerImageUrl || null);
      })
      .catch(() => setForm(DEFAULTS))
      .finally(() => setLoading(false));
  }, []);

  function updateField<K extends keyof DashboardAppearanceSettings>(key: K, value: DashboardAppearanceSettings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccessMsg(null);
    setErrorMsg(null);
  }

  async function handleImageFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please select a valid image file.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setErrorMsg("Image must be under 3 MB.");
      return;
    }
    setUploading(true);
    setErrorMsg(null);
    try {
      const dataBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          resolve(result.split(",")[1] ?? result);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await apiFetch<{ success: boolean; url: string; error?: string }>(
        "/api/settings/dashboard-appearance/header-upload",
        {
          method: "POST",
          body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64 }),
        }
      );

      if (response?.url) {
        setForm((prev) => ({ ...prev, headerImageUrl: response.url }));
        setImagePreview(response.url);
        setSuccessMsg("Image uploaded successfully. Save settings to apply.");
      } else {
        setErrorMsg(response?.error ?? "Upload failed. Please try again.");
      }
    } catch {
      setErrorMsg("Upload failed. Please check your connection and try again.");
    } finally {
      setUploading(false);
    }
  }

  function handleRemoveImage() {
    setForm((prev) => ({ ...prev, headerImageUrl: "" }));
    setImagePreview(null);
    setSuccessMsg(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSave() {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      const response = await apiFetch<{ success: boolean; error?: string }>(
        "/api/settings/dashboard-appearance",
        {
          method: "PUT",
          body: JSON.stringify(form),
        }
      );
      if (response?.success) {
        setSuccessMsg("Dashboard appearance saved successfully.");
      } else {
        setErrorMsg(response?.error ?? "Failed to save settings.");
      }
    } catch {
      setErrorMsg("Failed to save settings. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-60 items-center justify-center text-sm font-medium text-slate-400">
        Loading appearance settings…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-8 py-6">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-bold text-slate-900">Dashboard Appearance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Customize the naturalistic hero header and section visibility on the Donor CRM dashboard.
        </p>
      </div>

      {/* Status messages */}
      {successMsg && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {successMsg}
        </div>
      )}
      {errorMsg && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Hero Image */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-slate-900">Hero Header Image</h2>
        <p className="mb-4 text-xs font-medium text-slate-400">
          Displayed as the full-width background of the dashboard hero section.
          Recommended: 2400×900px, JPEG or WebP, under 3 MB. If none is set, a forest green gradient is used.
        </p>

        {/* Current image preview */}
        {imagePreview ? (
          <div className="mb-4 overflow-hidden rounded-xl border border-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Dashboard hero preview"
              className="h-40 w-full object-cover"
            />
          </div>
        ) : (
          <div
            className="mb-4 flex h-40 w-full items-center justify-center rounded-xl border border-dashed border-slate-200"
            style={{ background: "linear-gradient(135deg, #052E24 0%, #065f46 38%, #047857 65%, #059669 100%)" }}
          >
            <p className="text-xs font-semibold text-white/60">Default gradient (no image set)</p>
          </div>
        )}

        {/* Upload controls */}
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImageFile(file);
              }}
            />
            <span className={`inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 ${uploading ? "opacity-60 pointer-events-none" : ""}`}>
              {uploading ? "Uploading…" : "Upload Image"}
            </span>
          </label>
          {imagePreview && (
            <button
              type="button"
              onClick={handleRemoveImage}
              className="rounded-lg border border-rose-100 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-100"
            >
              Remove image
            </button>
          )}
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Image position</span>
            <select
              value={form.headerImagePosition}
              onChange={(e) => updateField("headerImagePosition", e.target.value as DashboardAppearanceSettings["headerImagePosition"])}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              {["center", "top", "bottom", "left", "right"].map((position) => <option key={position} value={position}>{position}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Overlay color</span>
            <input
              type="color"
              value={form.overlayColor}
              onChange={(e) => updateField("overlayColor", e.target.value)}
              className="mt-1 h-10 w-full rounded-lg border border-slate-200 bg-slate-50 px-2"
            />
          </label>
          <label className="block sm:col-span-2">
            <span className="flex items-center justify-between text-xs font-semibold text-slate-700">
              Overlay strength
              <span className="text-slate-400">{form.overlayStrength}%</span>
            </span>
            <input
              type="range"
              min={0}
              max={90}
              value={form.overlayStrength}
              onChange={(e) => updateField("overlayStrength", Number(e.target.value))}
              className="mt-2 w-full accent-emerald-600"
            />
          </label>
        </div>
      </section>

      {/* Hero text mode */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-slate-900">Hero Subtitle</h2>
        <p className="mb-4 text-xs font-medium text-slate-400">
          Controls what appears below the greeting in the hero section.
        </p>

        <div className="space-y-3">
          {(["greeting", "mission", "custom"] as const).map((mode) => {
            const labels: Record<string, string> = {
              greeting: "Daily mission line — rotates a different mission statement each day",
              mission: "Same as greeting mode",
              custom: "Custom text — write your own subtitle",
            };
            return (
              <label key={mode} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition ${form.heroTitleMode === mode ? "border-emerald-300 bg-emerald-50" : "border-slate-100 hover:bg-slate-50"}`}>
                <input
                  type="radio"
                  name="heroTitleMode"
                  value={mode}
                  checked={form.heroTitleMode === mode}
                  onChange={() => updateField("heroTitleMode", mode)}
                  className="mt-0.5 h-4 w-4 accent-emerald-600"
                />
                <div>
                  <p className="text-sm font-semibold capitalize text-slate-900">{mode === "greeting" ? "Daily mission line" : mode}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{labels[mode]}</p>
                </div>
              </label>
            );
          })}
        </div>

        {form.heroTitleMode === "custom" && (
          <div className="mt-4">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Custom subtitle text</label>
            <textarea
              rows={2}
              maxLength={200}
              value={form.customHeroText}
              onChange={(e) => updateField("customHeroText", e.target.value)}
              placeholder="e.g. Because of your donors, lives are being changed every day."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            />
            <p className="mt-1 text-right text-[11px] text-slate-400">{form.customHeroText.length}/200</p>
          </div>
        )}
      </section>

      {/* Hero layout */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-1 text-base font-bold text-slate-900">Hero Layout</h2>
        <p className="mb-4 text-xs font-medium text-slate-400">
          Controls the dashboard header height, greeting style, quote card, and primary actions.
        </p>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Hero height</span>
            <select
              value={form.heroHeight}
              onChange={(e) => updateField("heroHeight", e.target.value as DashboardAppearanceSettings["heroHeight"])}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="compact">Compact</option>
              <option value="standard">Standard</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Greeting style</span>
            <select
              value={form.greetingStyle}
              onChange={(e) => updateField("greetingStyle", e.target.value as DashboardAppearanceSettings["greetingStyle"])}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="warm">Warm</option>
              <option value="formal">Formal</option>
              <option value="simple">Simple</option>
            </select>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-700">Dashboard density</span>
            <select
              value={form.density}
              onChange={(e) => updateField("density", e.target.value as DashboardAppearanceSettings["density"])}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
            >
              <option value="comfortable">Comfortable</option>
              <option value="compact">Compact</option>
            </select>
          </label>
        </div>

        <div className="mt-5 rounded-xl border border-slate-100 bg-slate-50 p-4">
          <label className="flex cursor-pointer items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-900">Show quote card</p>
              <p className="text-xs text-slate-400">Uses only the text configured here; no hardcoded quote is shown.</p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.showQuoteCard}
              onClick={() => updateField("showQuoteCard", !form.showQuoteCard)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 ${form.showQuoteCard ? "bg-emerald-600" : "bg-slate-200"}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${form.showQuoteCard ? "translate-x-5" : "translate-x-0.5"}`} />
            </button>
          </label>
          {form.showQuoteCard ? (
            <div className="mt-4 grid gap-3">
              <textarea
                rows={3}
                maxLength={220}
                value={form.quoteText}
                onChange={(e) => updateField("quoteText", e.target.value)}
                placeholder="Enter the quote or short mission statement to show in the hero."
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
              <input
                value={form.quoteAuthor}
                onChange={(e) => updateField("quoteAuthor", e.target.value)}
                placeholder="Quote author or source"
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
              />
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold text-slate-700">Primary dashboard actions</p>
          <div className="grid gap-2 sm:grid-cols-3">
            {(Object.keys(DASHBOARD_HERO_ACTIONS) as DashboardHeroActionId[]).map((actionId) => {
              const enabled = form.primaryActions.includes(actionId);
              return (
                <label key={actionId} className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${enabled ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-100 bg-slate-50 text-slate-600"}`}>
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => {
                      const next = e.target.checked
                        ? [...form.primaryActions, actionId]
                        : form.primaryActions.filter((id) => id !== actionId);
                      updateField("primaryActions", next.length > 0 ? next : ["record-gift"]);
                    }}
                    className="h-4 w-4 accent-emerald-600"
                  />
                  {DASHBOARD_HERO_ACTIONS[actionId].label}
                </label>
              );
            })}
          </div>
        </div>
      </section>

      {/* Section toggles */}
      <section className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-base font-bold text-slate-900">Dashboard Sections</h2>
        <div className="space-y-4">
          {([
            { key: "showStewardSuggestions", label: "Steward Intelligence", desc: "Show deterministic stewardship alert cards from tasks, retention, and donor status" },
            { key: "showMetricCards", label: "Metric Strip", desc: "Show the real-data metric cards that overlap the dashboard hero" },
            { key: "showRecentDonorMovement", label: "Recent Donor Movement", desc: "Show recent completed gifts and donor activity" },
            { key: "showThisMonthsDonors", label: "This Month's Donors", desc: "Show current-month donors with task, audience-list, and thank-you workflows" },
            { key: "showFollowUpWidgets", label: "Follow-Up Widgets", desc: "Show acknowledgment, source mix, and donor health widgets from real CRM data" },
            { key: "showExpandedWidgets", label: "Expanded Dashboard Widgets", desc: "Show top donors, recent gifts, meetings, forecast, campaign health, and workload widgets" },
            { key: "showCampaignImpactCards", label: "Campaign Impact Cards", desc: "Show visual campaign progress cards at the bottom" },
            { key: "showProjectsAndInitiatives", label: "Projects & Initiatives", desc: "Allow campaign/project progress to appear on the dashboard" },
          ] as { key: keyof DashboardAppearanceSettings; label: string; desc: string }[]).map(({ key, label, desc }) => (
            <label key={key} className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-slate-900">{label}</p>
                <p className="text-xs text-slate-400">{desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={Boolean(form[key])}
                onClick={() => updateField(key, !form[key] as DashboardAppearanceSettings[typeof key])}
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 ${form[key] ? "bg-emerald-600" : "bg-slate-200"}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${form[key] ? "translate-x-5" : "translate-x-0.5"}`} />
              </button>
            </label>
          ))}
        </div>
      </section>

      {/* Save */}
      <div className="flex items-center justify-end gap-3 pb-4">
        <Link
          href="/"
          className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition"
        >
          Preview dashboard
        </Link>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-emerald-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save appearance"}
        </button>
      </div>
    </div>
  );
}
