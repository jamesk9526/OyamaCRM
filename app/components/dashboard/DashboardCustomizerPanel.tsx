/**
 * DashboardCustomizerPanel — right-side drawer for personalizing the Donor CRM dashboard.
 * Allows each user to set their own hero header image and toggle which widgets are visible.
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { DashboardPreferences } from "./useDashboardPreferences";

interface WidgetDef {
  key: keyof Pick<
    DashboardPreferences,
    | "showImpactBand"
    | "showStewardSuggestions"
    | "showMovementFeed"
    | "showGivingTrend"
    | "showDesignationChart"
    | "showCampaignCards"
    | "showRetentionSnapshot"
    | "showMyDueTasks"
  >;
  label: string;
  description: string;
  iconPath: string;
}

const WIDGETS: WidgetDef[] = [
  {
    key: "showImpactBand",
    label: "Impact Summary Band",
    description: "6-metric floating card below the hero",
    iconPath: "M4 6h16M4 10h16M4 14h10",
  },
  {
    key: "showStewardSuggestions",
    label: "Steward Intelligence",
    description: "Smart stewardship action nudges",
    iconPath: "M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  },
  {
    key: "showMovementFeed",
    label: "Donor Movement Feed",
    description: "Recent gifts and activity timeline",
    iconPath: "M4 6h16M4 10h16M4 14h8",
  },
  {
    key: "showGivingTrend",
    label: "Giving Trend Chart",
    description: "Giving over time area chart",
    iconPath: "M4 13h3l2-6 4 12 2-6h5",
  },
  {
    key: "showDesignationChart",
    label: "Giving by Designation",
    description: "Fund breakdown donut chart",
    iconPath: "M11 3.055A9.001 9.001 0 1 0 20.945 13H11V3.055z",
  },
  {
    key: "showCampaignCards",
    label: "Campaign Impact Cards",
    description: "Active campaign progress cards",
    iconPath: "M3 3v18h18M7 16l4-4 4 4 4-4",
  },
  {
    key: "showRetentionSnapshot",
    label: "Retention Snapshot",
    description: "Circular gauge showing donor retention rate",
    iconPath: "M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm0 4v8l5 3",
  },
  {
    key: "showMyDueTasks",
    label: "My Due Tasks",
    description: "Compact list of your most urgent pending tasks",
    iconPath: "M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9l2 2 4-4",
  },
];

interface DashboardCustomizerPanelProps {
  open: boolean;
  onClose: () => void;
  prefs: DashboardPreferences;
  onUpdate: (updates: Partial<DashboardPreferences>) => void;
  onReset: () => void;
  /** Whether the current user has admin role (enables server-side image upload). */
  isAdmin: boolean;
  /** Org-level default header image URL (shown when user has no override). */
  orgHeaderImageUrl?: string;
}

/** Toggle switch component. */
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={`Toggle ${label}`}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-1 ${checked ? "bg-emerald-600" : "bg-slate-200"}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? "translate-x-5" : "translate-x-0.5"}`}
      />
    </button>
  );
}

/** DashboardCustomizerPanel — slide-over right drawer. */
export default function DashboardCustomizerPanel({
  open,
  onClose,
  prefs,
  onUpdate,
  onReset,
  isAdmin,
  orgHeaderImageUrl,
}: DashboardCustomizerPanelProps) {
  const [urlInput, setUrlInput] = useState(prefs.headerImageUrl);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Sync urlInput when prefs change (e.g., after reset)
  useEffect(() => {
    setUrlInput(prefs.headerImageUrl);
  }, [prefs.headerImageUrl]);

  // Trap focus & close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  function applyUrl() {
    onUpdate({ headerImageUrl: urlInput.trim() });
    setUploadError(null);
  }

  async function handleFileUpload(file: File) {
    if (!file.type.startsWith("image/")) { setUploadError("Please select a valid image file."); return; }
    if (file.size > 3 * 1024 * 1024) { setUploadError("Image must be under 3 MB."); return; }
    setUploading(true);
    setUploadError(null);
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
      const res = await apiFetch<{ success: boolean; url: string; error?: string }>(
        "/api/settings/dashboard-appearance/header-upload",
        { method: "POST", body: JSON.stringify({ fileName: file.name, mimeType: file.type, dataBase64 }) },
      );
      if (res?.url) {
        const url = res.url;
        onUpdate({ headerImageUrl: url });
        setUrlInput(url);
      } else {
        setUploadError(res?.error ?? "Upload failed.");
      }
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Preview image: user override → org default → null (gradient) */
  const previewUrl = prefs.headerImageUrl || orgHeaderImageUrl || null;
  const allEnabled = WIDGETS.every((w) => prefs[w.key]);
  const enabledCount = WIDGETS.filter((w) => prefs[w.key]).length;

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-[2px] transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-hidden="true"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Customize Dashboard"
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-sm flex-col bg-white shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Panel header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Customize Dashboard</h2>
            <p className="mt-0.5 text-xs text-slate-400">{enabledCount} of {WIDGETS.length} widgets visible</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close customizer"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-7">

          {/* ── Header Image ───────────────────────────── */}
          <section>
            <h3 className="mb-3 text-sm font-bold text-slate-800">Hero Header Image</h3>

            {/* Preview */}
            <div className="mb-3 overflow-hidden rounded-xl">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={previewUrl} alt="Header preview" className="h-28 w-full object-cover" />
              ) : (
                <div
                  className="flex h-28 w-full items-center justify-center"
                  style={{ background: "linear-gradient(135deg, #052E24 0%, #065f46 38%, #047857 65%, #059669 100%)" }}
                >
                  <p className="text-xs font-semibold text-white/50">Default gradient</p>
                </div>
              )}
            </div>

            {/* URL input */}
            <div className="flex gap-2">
              <input
                type="url"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="https://example.com/photo.jpg"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onKeyDown={(e) => { if (e.key === "Enter") applyUrl(); }}
              />
              <button
                type="button"
                onClick={applyUrl}
                className="shrink-0 rounded-lg bg-emerald-700 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition"
              >
                Apply
              </button>
            </div>

            {/* File upload (admin only) */}
            {isAdmin && (
              <div className="mt-2">
                <label className="cursor-pointer">
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif"
                    className="sr-only"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }}
                  />
                  <span className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition ${uploading ? "opacity-60 pointer-events-none" : "cursor-pointer"}`}>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M16 8l-4-4-4 4M12 4v12" />
                    </svg>
                    {uploading ? "Uploading…" : "Upload image"}
                  </span>
                </label>
                <p className="mt-1 text-[10px] text-slate-400">JPEG / PNG / WebP · max 3 MB</p>
              </div>
            )}

            {uploadError && (
              <p className="mt-1.5 text-xs font-semibold text-rose-600">{uploadError}</p>
            )}

            {/* Remove override */}
            {prefs.headerImageUrl && (
              <button
                type="button"
                onClick={() => { onUpdate({ headerImageUrl: "" }); setUrlInput(""); }}
                className="mt-2 text-xs font-semibold text-slate-400 hover:text-rose-600 transition"
              >
                Remove my image override
              </button>
            )}
          </section>

          {/* ── Widgets ────────────────────────────────── */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Dashboard Widgets</h3>
              <button
                type="button"
                onClick={() => {
                  const updates: Partial<DashboardPreferences> = {};
                  WIDGETS.forEach((w) => { (updates as Record<string, boolean>)[w.key] = !allEnabled; });
                  onUpdate(updates);
                }}
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 transition"
              >
                {allEnabled ? "Disable all" : "Enable all"}
              </button>
            </div>

            <div className="space-y-2">
              {WIDGETS.map((widget) => (
                <div
                  key={widget.key}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                      <svg className="h-3.5 w-3.5 text-emerald-700" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d={widget.iconPath} />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{widget.label}</p>
                      <p className="text-[11px] text-slate-400">{widget.description}</p>
                    </div>
                  </div>
                  <Toggle
                    checked={prefs[widget.key]}
                    onChange={(v) => onUpdate({ [widget.key]: v })}
                    label={widget.label}
                  />
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 px-5 py-4 flex items-center justify-between">
          <button
            type="button"
            onClick={onReset}
            className="text-xs font-semibold text-slate-400 hover:text-rose-600 transition"
          >
            Reset to defaults
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-emerald-700 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-800 transition"
          >
            Done
          </button>
        </div>
      </div>
    </>
  );
}
