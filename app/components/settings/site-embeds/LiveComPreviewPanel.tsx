// Visual preview for LiveCom floating widget behavior on desktop and mobile viewport mockups.
"use client";

import { useMemo, useState } from "react";
import type { LiveComWidgetSettings } from "@/app/components/settings/site-embeds/site-embed-types";

interface LiveComPreviewPanelProps {
  /** Current LiveCom widget settings reflected in the preview canvas. */
  settings: LiveComWidgetSettings;
}

/**
 * LiveComPreviewPanel renders a lightweight in-product mock preview for launcher placement and messaging copy.
 * The preview intentionally avoids fake backend data and only mirrors current form settings.
 */
export default function LiveComPreviewPanel({ settings }: LiveComPreviewPanelProps) {
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");

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
                <button className="rounded-full bg-green-600 px-3 py-2 text-[11px] font-semibold text-white shadow-lg">
                  {settings.buttonLabel || "Live Support"}
                </button>
              </div>
              <div className={`absolute bottom-16 ${launcherPositionClass} w-48 rounded-lg border border-gray-200 bg-white p-3 shadow-md`}>
                <p className="text-[11px] font-semibold text-gray-800">LiveCom</p>
                <p className="mt-1 text-[11px] text-gray-600">
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
