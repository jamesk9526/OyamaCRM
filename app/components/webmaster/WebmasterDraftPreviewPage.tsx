/** Draft preview route renderer for Webmaster pages without editor chrome. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import WebmasterPageRenderer from "@/app/components/webmaster/rendering/WebmasterPageRenderer";
import { getDeviceCanvasClass, parseBuilderDocument } from "@/app/components/webmaster/editor/editor-utils";
import type { DeviceMode, WebmasterPage, WebmasterSite } from "@/app/components/webmaster/editor/types";

interface WebmasterDraftPreviewPageProps {
  siteId: string;
  pageId: string;
  draftMode: boolean;
}

/** Draft preview surface reuses the same visual renderer as editor canvas for consistency. */
export default function WebmasterDraftPreviewPage({ siteId, pageId, draftMode }: WebmasterDraftPreviewPageProps) {
  const [site, setSite] = useState<WebmasterSite | null>(null);
  const [page, setPage] = useState<WebmasterPage | null>(null);
  const [device, setDevice] = useState<DeviceMode>("desktop");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const sites = await apiFetch<{ items: WebmasterSite[] }>("/api/webmaster/sites");
      const foundSite = (sites.items ?? []).find((entry) => entry.id === siteId) ?? null;
      setSite(foundSite);

      const pages = await apiFetch<{ items: WebmasterPage[] }>(`/api/webmaster/sites/${siteId}/pages`);
      const foundPage = (pages.items ?? []).find((entry) => entry.id === pageId) ?? null;
      setPage(foundPage);

      if (!foundSite || !foundPage) {
        setError("Preview target not found.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load draft preview.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, pageId]);

  useEffect(() => {
    const channel = new BroadcastChannel("webmaster-preview");
    const onMessage = (event: MessageEvent) => {
      const payload = event.data as { type?: string; siteId?: string; pageId?: string };
      if (payload?.type !== "webmaster-draft-saved") return;
      if (payload.siteId !== siteId || payload.pageId !== pageId) return;
      void load();
    };

    channel.addEventListener("message", onMessage);
    return () => {
      channel.removeEventListener("message", onMessage);
      channel.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [siteId, pageId]);

  const document = useMemo(() => parseBuilderDocument(page?.contentJson ?? null), [page?.contentJson]);

  if (loading) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
      </div>
    );
  }

  if (error || !site || !page) {
    return (
      <div className="mx-auto mt-10 max-w-2xl rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error ?? "Preview target not available."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2">
        <div>
          <p className="text-xs text-slate-500">{site.name}</p>
          <h1 className="text-sm font-semibold text-slate-900">{page.title}</h1>
        </div>
        <div className="flex items-center gap-2">
          {(["desktop", "tablet", "mobile"] as const).map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setDevice(entry)}
              className={`rounded-lg border px-2.5 py-1 text-xs ${device === entry ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}
            >
              {entry}
            </button>
          ))}
          {draftMode ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">
              Draft Preview
            </span>
          ) : null}
        </div>
      </div>

      <div className={`mx-auto ${getDeviceCanvasClass(device)}`}>
        <WebmasterPageRenderer
          siteName={site.name}
          pageTitle={page.title}
          document={document}
          mode="preview"
        />
      </div>
    </div>
  );
}
