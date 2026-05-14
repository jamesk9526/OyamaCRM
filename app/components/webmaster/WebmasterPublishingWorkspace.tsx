/** Publishing command center for Webmaster readiness and release operations. */
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import { getReadinessBadgeClass } from "@/app/components/webmaster/editor/editor-utils";
import type { PublishReadinessData, WebmasterSite } from "@/app/components/webmaster/editor/types";

/** Publishing workspace replaces generic publish warning with concrete readiness workflow. */
export default function WebmasterPublishingWorkspace() {
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<WebmasterSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [readiness, setReadiness] = useState<PublishReadinessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );

  async function loadSites() {
    const response = await apiFetch<{ items: WebmasterSite[] }>("/api/webmaster/sites");
    return Array.isArray(response.items) ? response.items : [];
  }

  async function loadReadiness(siteId: string) {
    if (!siteId) {
      setReadiness(null);
      return;
    }
    const response = await apiFetch<{ data: PublishReadinessData }>(`/api/webmaster/sites/${siteId}/publish-readiness`);
    setReadiness(response.data);
  }

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const nextSites = await loadSites();
        setSites(nextSites);

        const querySiteId = searchParams.get("siteId") ?? "";
        const initialSiteId = querySiteId && nextSites.some((site) => site.id === querySiteId)
          ? querySiteId
          : (nextSites[0]?.id ?? "");

        setSelectedSiteId(initialSiteId);
        await loadReadiness(initialSiteId);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load publishing workspace.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId);
    setLoading(true);
    setError(null);
    try {
      await loadReadiness(siteId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load readiness.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-6xl space-y-4">
      <header className="rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Webmaster Publishing</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Review Publish Readiness</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use this workspace to validate readiness, inspect draft deltas, and prepare publishing safely.
        </p>
      </header>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Site</label>
          <select
            value={selectedSiteId}
            onChange={(event) => void handleSiteChange(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
          >
            {sites.map((site) => (
              <option key={site.id} value={site.id}>{site.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleSiteChange(selectedSiteId)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="mt-4 text-sm text-slate-500">Loading publish readiness...</div>
        ) : null}

        {readiness && selectedSite ? (
          <div className="mt-4 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-slate-900">{selectedSite.name}</p>
                <p className="text-xs text-slate-500">{readiness.summary}</p>
              </div>
              <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getReadinessBadgeClass(readiness.status)}`}>
                {readiness.status}
              </span>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900">Publish Readiness</h2>
                <p className="mt-2 text-xs text-slate-600">Preflight passed: {readiness.preflightPassed ? "Yes" : "No"}</p>
                <p className="mt-1 text-xs text-slate-600">Draft changes since last publish: {readiness.draftChangesSinceLastPublish}</p>
                <p className="mt-1 text-xs text-slate-600">Missing SEO pages: {readiness.pagesMissingSeo.length}</p>
                <p className="mt-1 text-xs text-slate-600">Invalid path pages: {readiness.pagesWithInvalidPath.length}</p>
              </div>

              <div className="rounded-xl border border-slate-200 p-4">
                <h2 className="text-sm font-semibold text-slate-900">Publish Target</h2>
                <p className="mt-2 text-xs text-slate-600">Domain: {selectedSite.domain || "Not configured"}</p>
                <p className="mt-1 text-xs text-slate-600">Last published version: {readiness.lastPublishedVersionId || "None"}</p>
                <p className="mt-1 text-xs text-slate-600">Last published at: {readiness.lastPublishedAt ? new Date(readiness.lastPublishedAt).toLocaleString() : "Never"}</p>
                <p className="mt-1 text-xs text-slate-600">Publish execution: {readiness.publishExecutionStatus}</p>
                <p className="mt-1 text-xs text-slate-600">Rollback status: {readiness.rollbackStatus}</p>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">Readiness Checklist</h2>
              <div className="mt-3 space-y-2">
                {readiness.checks.map((check) => (
                  <div key={check.id} className="rounded-lg border border-slate-200 px-3 py-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-semibold text-slate-800">{check.label}</p>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getReadinessBadgeClass(check.status)}`}>
                        {check.status}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">{check.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">Preview and Publish Actions</h2>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {readiness.previewLink ? (
                  <Link
                    href={readiness.previewLink}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    Open Draft Preview
                  </Link>
                ) : null}
                <button
                  type="button"
                  disabled
                  className="rounded-lg bg-slate-300 px-3 py-2 text-xs font-semibold text-slate-600"
                  title="Publish execution is not implemented yet"
                >
                  Publish Site (Not Implemented)
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
