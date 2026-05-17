// Visual preview for LiveCom floating widget behavior on desktop and mobile viewport mockups.
"use client";

import { useMemo, useState } from "react";
import type { LiveComWidgetSettings, SiteEmbedAppearanceSettings } from "@/app/components/settings/site-embeds/site-embed-types";

interface LiveComPreviewPanelProps {
  /** Current LiveCom widget settings reflected in the preview canvas. */
  settings: LiveComWidgetSettings;
  /** Site-wide appearance settings reflected in the preview canvas. */
  appearance?: SiteEmbedAppearanceSettings;
}

/**
 * LiveComPreviewPanel renders a lightweight in-product mock preview for launcher placement and messaging copy.
 * The preview intentionally avoids fake backend data and only mirrors current form settings.
 */
export default function LiveComPreviewPanel({ settings, appearance }: LiveComPreviewPanelProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const safeColor = /^#[0-9a-fA-F]{6}$/.test(settings.chatheadColor)
    ? settings.chatheadColor
    : /^#[0-9a-fA-F]{6}$/.test(appearance?.accentColor ?? "")
      ? appearance?.accentColor ?? "#16a34a"
      : "#16a34a";
  const surfaceColor = appearance?.themeMode === "transparent" ? "transparent" : appearance?.backgroundColor || "#ffffff";
  const borderColor = appearance?.borderColor || "#e5e7eb";
  const textColor = appearance?.textColor || "#111827";
  const mutedTextColor = appearance?.mutedTextColor || "#6b7280";
  const cardRadius = appearance?.cornerRadius === "rounded" ? "rounded-2xl" : appearance?.cornerRadius === "square" ? "rounded-md" : "rounded-xl";
  const cardShadow = appearance?.cardStyle === "elevated" ? "shadow-md" : "";

  const launcherPositionClass = useMemo(() => {
    if (settings.buttonPosition === "bottom-left") {
      return "left-3";
    }
    return "right-3";
  }, [settings.buttonPosition]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Widget Preview</h2>
          <p className="mt-1 text-xs text-gray-500">
            Preview launcher placement and greeting copy for desktop and mobile before deploying snippets.
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-gray-200 bg-gray-50 p-1 text-xs">
          <button
            type="button"
            onClick={() => setDevice("desktop")}
            className={`rounded-md px-2 py-1 font-semibold ${device === "desktop" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            Desktop
          </button>
          <button
            type="button"
            onClick={() => setDevice("mobile")}
            className={`rounded-md px-2 py-1 font-semibold ${device === "mobile" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
          >
            Mobile
          </button>
        </div>
      </div>

      <div className="flex justify-center rounded-xl border border-gray-200 bg-gray-50 p-4">
        <div className={`relative overflow-hidden rounded-xl border border-gray-300 bg-gradient-to-b from-white to-gray-100 ${device === "mobile" ? "h-[380px] w-[210px]" : "h-[320px] w-full max-w-[520px]"}`}>
          <div className="p-4 text-[11px] text-gray-500">
            <p className="font-semibold text-gray-600">Public Website Canvas</p>
            <p className="mt-1">This preview simulates embed placement and button behavior only.</p>
          </div>

          {settings.enabled ? (
            <>
              <div className={`absolute bottom-3 ${launcherPositionClass}`}>
                <div className="flex items-center gap-2">
                  <button
                    className="flex h-12 w-12 items-center justify-center rounded-full text-white shadow-lg"
                    style={{ background: safeColor }}
                    aria-label={settings.buttonLabel || "Live Support"}
                  >
                    <LiveComIcon iconStyle={settings.iconStyle} />
                  </button>
                  <span className="rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-gray-700 shadow-sm">
                    {settings.buttonLabel || "Live Support"}
                  </span>
                </div>
              </div>
              <div
                className={`absolute bottom-16 ${launcherPositionClass} w-48 border p-3 ${cardRadius} ${cardShadow}`}
                style={{ background: surfaceColor, borderColor }}
              >
                <p className="text-[11px] font-semibold" style={{ color: textColor }}>LiveCom</p>
                <p className="mt-1 text-[11px]" style={{ color: mutedTextColor }}>
                  {settings.greetingMessage || "How can we help today?"}
                </p>
              </div>
            </>
          ) : (
            <div className="absolute bottom-3 right-3 rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-500">
              Widget disabled
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

/** Renders one simple white icon for chathead preview. */
function LiveComIcon({ iconStyle }: { iconStyle: LiveComWidgetSettings["iconStyle"] }) {
  if (iconStyle === "heart") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09A5.98 5.98 0 0116.5 3C19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    );
  }

  if (iconStyle === "spark") {
    return (
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden="true">
        <path d="M12 2l1.8 4.7L18 8.5l-4.2 1.8L12 15l-1.8-4.7L6 8.5l4.2-1.8L12 2zm6 10l1 2.6 2.6 1L19 16.6 18 19l-1-2.4-2.4-1 2.4-1L18 12zM6 12l1 2.6 2.6 1L7 16.6 6 19l-1-2.4-2.4-1 2.4-1L6 12z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M4 5h16v10H7l-3 3V5z" />
      <path d="M8 9h8" />
      <path d="M8 12h5" />
    </svg>
  );
}
