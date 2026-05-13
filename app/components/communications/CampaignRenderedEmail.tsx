/** Rendered email panel for the campaign workspace. */
"use client";

import { useMemo, useState } from "react";

import type { WorkspacePreview } from "@/app/components/communications/campaign-workspace-types";

interface Props {
  preview: WorkspacePreview | null;
  loading: boolean;
}

type PreviewMode = "DESKTOP" | "TABLET" | "MOBILE" | "TEXT" | "HTML";

const PREVIEW_MODE_OPTIONS: Array<{ mode: PreviewMode; label: string }> = [
  { mode: "DESKTOP", label: "Desktop" },
  { mode: "TABLET", label: "Tablet" },
  { mode: "MOBILE", label: "Mobile" },
  { mode: "TEXT", label: "Text" },
  { mode: "HTML", label: "HTML" },
];

const PREVIEW_VIEWPORT_WIDTH: Record<Extract<PreviewMode, "DESKTOP" | "TABLET" | "MOBILE">, string> = {
  DESKTOP: "100%",
  TABLET: "820px",
  MOBILE: "390px",
};

/** Escapes HTML for safe source-code display in preformatted blocks. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** CampaignRenderedEmail displays campaign metadata and the rendered HTML body in an iframe. */
export default function CampaignRenderedEmail({ preview, loading }: Props) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>("DESKTOP");

  if (loading) {
    return <div className="h-96 rounded-xl border border-gray-200 bg-white animate-pulse" />;
  }

  if (!preview) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500">
        Preview is unavailable for this campaign right now.
      </div>
    );
  }

  const fallbackHtml = `<html><body style="font-family:Arial,sans-serif;padding:24px;color:#334155;"><pre style="white-space:pre-wrap;">${escapeHtml(
    preview.bodyText ?? "No email body content yet.",
  )}</pre></body></html>`;

  const htmlContent = preview.bodyHtml || fallbackHtml;
  const selectedViewportWidth =
    previewMode === "DESKTOP" || previewMode === "TABLET" || previewMode === "MOBILE"
      ? PREVIEW_VIEWPORT_WIDTH[previewMode]
      : "100%";

  const textContent = useMemo(() => {
    if (preview.bodyText?.trim()) return preview.bodyText;
    if (preview.bodyHtml?.trim()) {
      return preview.bodyHtml
        .replace(/<style[\s\S]*?<\/style>/gi, "")
        .replace(/<script[\s\S]*?<\/script>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    return "No plain-text body content yet.";
  }, [preview.bodyHtml, preview.bodyText]);

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Rendered Email</h2>
        <p className="mt-0.5 text-xs text-gray-500">Review final output exactly as recipients will receive it.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 px-5 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Preview Surface</p>
        <div className="flex flex-wrap gap-2">
          {PREVIEW_MODE_OPTIONS.map((option) => (
            <button
              key={option.mode}
              type="button"
              onClick={() => setPreviewMode(option.mode)}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                previewMode === option.mode
                  ? "border-green-500 bg-green-50 text-green-700"
                  : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 border-b border-gray-100 px-5 py-4 text-xs text-gray-600 sm:grid-cols-2">
        <p>
          <span className="font-semibold text-gray-700">Subject:</span> {preview.subject || "(No subject)"}
        </p>
        <p>
          <span className="font-semibold text-gray-700">From:</span> {preview.fromName} &lt;{preview.fromEmail}&gt;
        </p>
        <p className="sm:col-span-2">
          <span className="font-semibold text-gray-700">Preview text:</span> {preview.previewText || "-"}
        </p>
      </div>

      <div className="bg-gray-50 p-4">
        {(previewMode === "DESKTOP" || previewMode === "TABLET" || previewMode === "MOBILE") && (
          <div className="flex justify-center">
            <iframe
              title={`Campaign rendered email ${previewMode.toLowerCase()} preview`}
              sandbox="allow-same-origin"
              srcDoc={htmlContent}
              className="h-[520px] rounded-lg border border-gray-200 bg-white"
              style={{ width: selectedViewportWidth, maxWidth: "100%" }}
            />
          </div>
        )}

        {previewMode === "TEXT" && (
          <pre className="h-[520px] overflow-auto rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-700 whitespace-pre-wrap">
            {textContent}
          </pre>
        )}

        {previewMode === "HTML" && (
          <pre className="h-[520px] overflow-auto rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-700 whitespace-pre-wrap">
            {escapeHtml(htmlContent)}
          </pre>
        )}
      </div>
    </section>
  );
}
