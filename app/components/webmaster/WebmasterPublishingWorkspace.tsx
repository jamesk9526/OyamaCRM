/** Publishing command center for Webmaster readiness and release operations. */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/app/lib/auth-client";
import { getReadinessBadgeClass } from "@/app/components/webmaster/editor/editor-utils";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";
import type {
  PublishDraftDeltaItem,
  PublishReadinessData,
  WebmasterPublishVersion,
  WebmasterSite,
} from "@/app/components/webmaster/editor/types";

type BusyAction = "publish" | "rollback" | null;
type ConfirmAction = "publish" | "rollback" | null;

/** Returns change badge styling for draft delta rows. */
function getDraftDeltaBadgeClass(changeType: PublishDraftDeltaItem["changeType"]): string {
  if (changeType === "NEW") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (changeType === "UPDATED") return "border-blue-200 bg-blue-50 text-blue-700";
  return "border-rose-200 bg-rose-50 text-rose-700";
}

/** Publishing workspace replaces generic publish warning with concrete readiness workflow. */
export default function WebmasterPublishingWorkspace() {
  const searchParams = useSearchParams();
  const [sites, setSites] = useState<WebmasterSite[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedRollbackVersionId, setSelectedRollbackVersionId] = useState("");
  const [readiness, setReadiness] = useState<PublishReadinessData | null>(null);
  const [publishVersions, setPublishVersions] = useState<WebmasterPublishVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState<BusyAction>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [confirmText, setConfirmText] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const selectedSite = useMemo(
    () => sites.find((site) => site.id === selectedSiteId) ?? null,
    [sites, selectedSiteId],
  );

  const selectedRollbackVersion = useMemo(
    () => publishVersions.find((version) => version.id === selectedRollbackVersionId) ?? null,
    [publishVersions, selectedRollbackVersionId],
  );

  const expectedConfirmationToken = selectedSite?.slug ?? "";
  const isConfirmationValid = confirmText.trim().toLowerCase() === expectedConfirmationToken.toLowerCase();

  const loadSites = useCallback(async () => {
    const response = await apiFetch<{ items: WebmasterSite[] }>("/api/webmaster/sites");
    return Array.isArray(response.items) ? response.items : [];
  }, []);

  const loadReadiness = useCallback(async (siteId: string) => {
    if (!siteId) {
      setReadiness(null);
      return;
    }
    const response = await apiFetch<PublishReadinessData>(`/api/webmaster/sites/${siteId}/publish-readiness`);
    setReadiness(response);
  }, []);

  const loadPublishVersions = useCallback(async (siteId: string) => {
    if (!siteId) {
      setPublishVersions([]);
      setSelectedRollbackVersionId("");
      return;
    }
    const response = await apiFetch<{ items: WebmasterPublishVersion[] }>(`/api/webmaster/sites/${siteId}/publish-versions`);
    const items = Array.isArray(response.items) ? response.items : [];
    setPublishVersions(items);
    setSelectedRollbackVersionId((current) => current || items[0]?.id || "");
  }, []);

  useEffect(() => {
    let active = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const nextSites = await loadSites();
        if (!active) return;
        setSites(nextSites);

        const querySiteId = searchParams.get("siteId") ?? "";
        const initialSiteId = querySiteId && nextSites.some((site) => site.id === querySiteId)
          ? querySiteId
          : (nextSites[0]?.id ?? "");

        setSelectedSiteId(initialSiteId);
        await loadReadiness(initialSiteId);
        await loadPublishVersions(initialSiteId);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Failed to load publishing workspace.");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [loadPublishVersions, loadReadiness, loadSites, searchParams]);

  async function handleSiteChange(siteId: string) {
    setSelectedSiteId(siteId);
    setConfirmAction(null);
    setConfirmText("");
    setActionNote("");
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      await loadReadiness(siteId);
      await loadPublishVersions(siteId);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load readiness.");
    } finally {
      setLoading(false);
    }
  }

  function openActionConfirmation(action: Exclude<ConfirmAction, null>) {
    if (!selectedSiteId || busyAction) return;
    if (action === "rollback" && !selectedRollbackVersionId) return;

    setConfirmAction(action);
    setConfirmText("");
    setActionNote("");
    setError(null);
    setNotice(null);
  }

  /** Executes publish or rollback after explicit in-app typed confirmation. */
  async function executeConfirmedAction() {
    if (!selectedSiteId || !confirmAction || busyAction) return;
    if (!isConfirmationValid) return;

    setBusyAction(confirmAction);
    setError(null);
    setNotice(null);

    const trimmedNote = actionNote.trim();

    try {
      if (confirmAction === "publish") {
        await apiFetch(`/api/webmaster/sites/${selectedSiteId}/publish`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirm: true,
            note: trimmedNote || undefined,
          }),
        });
      }

      if (confirmAction === "rollback") {
        await apiFetch(`/api/webmaster/sites/${selectedSiteId}/rollback`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            confirm: true,
            versionId: selectedRollbackVersionId,
            note: trimmedNote || undefined,
          }),
        });
      }

      await loadReadiness(selectedSiteId);
      await loadPublishVersions(selectedSiteId);
      setNotice(confirmAction === "publish"
        ? "Publish completed. A new immutable version snapshot was created."
        : "Rollback completed and tracked as a new publish version record.");
      setConfirmAction(null);
      setConfirmText("");
      setActionNote("");
    } catch (requestError) {
      setError(requestError instanceof Error
        ? requestError.message
        : (confirmAction === "publish" ? "Publish failed." : "Rollback failed."));
    } finally {
      setBusyAction(null);
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

      {notice ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>
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
              <h2 className="text-sm font-semibold text-slate-900">Draft Delta Inspector</h2>
              <p className="mt-1 text-xs text-slate-600">
                Review the exact page-level delta against the most recent published snapshot before publishing.
              </p>

              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-700">New</p>
                  <p className="mt-1 text-lg font-semibold text-emerald-800">{readiness.draftDeltaSummary.newPages}</p>
                </div>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-700">Updated</p>
                  <p className="mt-1 text-lg font-semibold text-blue-800">{readiness.draftDeltaSummary.updatedPages}</p>
                </div>
                <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Removed</p>
                  <p className="mt-1 text-lg font-semibold text-rose-800">{readiness.draftDeltaSummary.removedPages}</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-600">Unchanged</p>
                  <p className="mt-1 text-lg font-semibold text-slate-700">{readiness.draftDeltaSummary.unchangedPages}</p>
                </div>
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-indigo-700">Total Delta</p>
                  <p className="mt-1 text-lg font-semibold text-indigo-800">{readiness.draftDeltaSummary.totalDraftCandidates}</p>
                </div>
              </div>

              <div className="mt-3 space-y-2">
                {readiness.draftDeltaItems.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-3 py-4 text-xs text-slate-500">
                    No draft deltas detected since the last publish snapshot.
                  </p>
                ) : (
                  readiness.draftDeltaItems.map((item) => (
                    <div key={`${item.changeType}-${item.id}`} className="rounded-lg border border-slate-200 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{item.title}</p>
                          <p className="text-[11px] text-slate-500">{item.path}</p>
                        </div>
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${getDraftDeltaBadgeClass(item.changeType)}`}>
                          {item.changeType}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                        <span>Current: {item.currentStatus || "Removed"}</span>
                        <span>Previous: {item.previousStatus || "None"}</span>
                        <span>
                          Updated: {item.updatedAt ? new Date(item.updatedAt).toLocaleString() : "Not available"}
                        </span>
                        {item.changeType !== "REMOVED" && selectedSite ? (
                          <Link
                            href={`/webmaster/editor?siteId=${selectedSite.id}&pageId=${item.id}`}
                            className="rounded border border-slate-300 px-2 py-0.5 text-[11px] text-slate-700 hover:bg-slate-50"
                          >
                            Open in Editor
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 p-4">
              <h2 className="text-sm font-semibold text-slate-900">Preflight Blocker Details</h2>
              <p className="mt-1 text-xs text-slate-600">Resolve these blockers before publish execution can proceed.</p>

              {readiness.pagesMissingSeo.length === 0 && readiness.pagesWithInvalidPath.length === 0 ? (
                <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                  No SEO or path blockers were detected.
                </p>
              ) : (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Missing SEO Fields</p>
                    <div className="mt-2 space-y-2">
                      {readiness.pagesMissingSeo.length === 0 ? (
                        <p className="text-xs text-amber-700">None</p>
                      ) : (
                        readiness.pagesMissingSeo.map((page) => (
                          <div key={`seo-${page.id}`} className="rounded border border-amber-200 bg-white px-2 py-1.5">
                            <p className="text-xs font-semibold text-slate-900">{page.title}</p>
                            <p className="text-[11px] text-slate-500">{page.path}</p>
                            {selectedSite ? (
                              <Link
                                href={`/webmaster/editor?siteId=${selectedSite.id}&pageId=${page.id}`}
                                className="mt-1 inline-flex rounded border border-amber-300 px-2 py-0.5 text-[11px] text-amber-800 hover:bg-amber-100"
                              >
                                Fix in Editor
                              </Link>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-lg border border-rose-200 bg-rose-50 p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-rose-800">Invalid Page Paths</p>
                    <div className="mt-2 space-y-2">
                      {readiness.pagesWithInvalidPath.length === 0 ? (
                        <p className="text-xs text-rose-700">None</p>
                      ) : (
                        readiness.pagesWithInvalidPath.map((page) => (
                          <div key={`path-${page.id}`} className="rounded border border-rose-200 bg-white px-2 py-1.5">
                            <p className="text-xs font-semibold text-slate-900">{page.title}</p>
                            <p className="text-[11px] text-slate-500">{page.path}</p>
                            {selectedSite ? (
                              <Link
                                href={`/webmaster/editor?siteId=${selectedSite.id}&pageId=${page.id}`}
                                className="mt-1 inline-flex rounded border border-rose-300 px-2 py-0.5 text-[11px] text-rose-800 hover:bg-rose-100"
                              >
                                Fix in Editor
                              </Link>
                            ) : null}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                  onClick={() => openActionConfirmation("publish")}
                  disabled={!readiness.preflightPassed || busyAction !== null}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-600"
                  title={!readiness.preflightPassed ? "Fix preflight blockers before publishing." : "Publish now"}
                >
                  {busyAction === "publish" ? "Publishing..." : "Publish Site"}
                </button>
              </div>

              <div className="mt-4 rounded-lg border border-slate-200 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rollback</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={selectedRollbackVersionId}
                    onChange={(event) => setSelectedRollbackVersionId(event.target.value)}
                    disabled={publishVersions.length === 0}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-700"
                  >
                    {publishVersions.length === 0 ? (
                      <option value="">No published versions yet</option>
                    ) : (
                      publishVersions.map((version) => (
                        <option key={version.id} value={version.id}>
                          {version.versionLabel} - {new Date(version.createdAt).toLocaleString()}
                        </option>
                      ))
                    )}
                  </select>
                  <button
                    type="button"
                    onClick={() => openActionConfirmation("rollback")}
                    disabled={!selectedRollbackVersionId || busyAction !== null}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {busyAction === "rollback" ? "Rolling back..." : "Rollback to Selected Version"}
                  </button>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  Rollback restores the selected snapshot and writes a new rollback version entry for audit history.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </section>

      {confirmAction && selectedSite && (
        <WorkspaceSetupModal
          title={confirmAction === "publish" ? "Confirm Publish" : "Confirm Rollback"}
          subtitle={confirmAction === "publish"
            ? "Publishing creates an immutable snapshot and marks current draft pages as published."
            : "Rollback restores the selected published snapshot and records a new rollback version."}
          onClose={() => {
            if (busyAction) return;
            setConfirmAction(null);
            setConfirmText("");
            setActionNote("");
          }}
          maxWidthClassName="max-w-2xl"
        >
          <div className="px-6 pb-6 pt-14 space-y-4">
            <p className="text-sm text-slate-700">
              Site: <span className="font-semibold text-slate-900">{selectedSite.name}</span>
            </p>

            {confirmAction === "rollback" && selectedRollbackVersion ? (
              <p className="text-sm text-slate-700">
                Target version: <span className="font-semibold text-slate-900">{selectedRollbackVersion.versionLabel}</span>
              </p>
            ) : null}

            <label className="block text-sm font-medium text-slate-700">
              Confirmation Token
              <p className="mt-1 text-xs font-normal text-slate-500">
                Type <span className="font-semibold text-slate-700">{expectedConfirmationToken}</span> to confirm this action.
              </p>
              <input
                value={confirmText}
                onChange={(event) => setConfirmText(event.target.value)}
                placeholder={expectedConfirmationToken}
                className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>

            <label className="block text-sm font-medium text-slate-700">
              Change Note
              <textarea
                value={actionNote}
                onChange={(event) => setActionNote(event.target.value)}
                rows={3}
                placeholder={confirmAction === "publish"
                  ? "Optional publish note for audit history"
                  : "Optional rollback reason for audit history"}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-800"
              />
            </label>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  if (busyAction) return;
                  setConfirmAction(null);
                  setConfirmText("");
                  setActionNote("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void executeConfirmedAction()}
                disabled={!isConfirmationValid || busyAction !== null}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {busyAction === confirmAction
                  ? (confirmAction === "publish" ? "Publishing..." : "Rolling back...")
                  : (confirmAction === "publish" ? "Confirm Publish" : "Confirm Rollback")}
              </button>
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
  );
}
