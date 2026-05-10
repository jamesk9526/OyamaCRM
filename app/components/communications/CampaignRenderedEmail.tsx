/** Rendered email panel for the campaign workspace. */
"use client";

import type { WorkspacePreview } from "@/app/components/communications/campaign-workspace-types";

interface Props {
  preview: WorkspacePreview | null;
  loading: boolean;
}

/** CampaignRenderedEmail displays campaign metadata and the rendered HTML body in an iframe. */
export default function CampaignRenderedEmail({ preview, loading }: Props) {
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

  const fallbackHtml = `<html><body style="font-family:Arial,sans-serif;padding:24px;color:#334155;"><pre style="white-space:pre-wrap;">${
    (preview.bodyText ?? "No email body content yet.")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
  }</pre></body></html>`;

  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <div className="border-b border-gray-100 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Rendered Email</h2>
        <p className="mt-0.5 text-xs text-gray-500">Review final output exactly as recipients will receive it.</p>
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
        <iframe
          title="Campaign rendered email"
          sandbox="allow-same-origin"
          srcDoc={preview.bodyHtml || fallbackHtml}
          className="h-[520px] w-full rounded-lg border border-gray-200 bg-white"
        />
      </div>
    </section>
  );
}
