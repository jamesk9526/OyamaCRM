"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import { getConstituentDisplayName } from "@/app/components/constituents/constituent-utils";
import { resolveAudienceListConstituents } from "@/app/components/letters/mail-merge-audience";
import {
  getLabelEligibility,
  isLabelSuppressed,
  unavailableLabelReasonSummary,
} from "@/app/components/letters/mail-merge-label-eligibility";

interface LabelConstituent {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string | null;
  organizationName?: string | null;
  entityKind?: string | null;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  doNotMail?: boolean | null;
  doNotContact?: boolean | null;
}

interface AudienceListSummary {
  id: string;
  name: string;
  description?: string | null;
  recipientsCount: number;
}

interface AudienceListDetail {
  id: string;
  name: string;
  recipients: Array<{ constituentId?: string | null; email?: string | null }>;
}

function displayName(row: LabelConstituent): string {
  return getConstituentDisplayName(row) || "Unnamed constituent";
}

function formattedAddress(row: LabelConstituent): string[] {
  const cityState = [row.city?.trim(), row.state?.trim()].filter(Boolean).join(", ");
  const locality = [cityState, row.zip?.trim()].filter(Boolean).join(" ");
  const country = row.country?.trim();
  return [row.addressLine1, row.addressLine2, locality, country && !["US", "USA"].includes(country.toUpperCase()) ? country : null]
    .map((value) => value?.trim())
    .filter((value): value is string => Boolean(value));
}

function responseFileName(response: Response): string {
  const disposition = response.headers.get("content-disposition") ?? "";
  return disposition.match(/filename="([^"]+)"/i)?.[1] ?? `avery_5160_labels_${new Date().toISOString().slice(0, 10)}.pdf`;
}

/** Dedicated recipient review and Avery 5160 PDF merge tool. */
export default function MailMergeLabelsWorkspace() {
  const [constituents, setConstituents] = useState<LabelConstituent[]>([]);
  const [lists, setLists] = useState<AudienceListSummary[]>([]);
  const [selectedListId, setSelectedListId] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [startPosition, setStartPosition] = useState(1);
  const [showGuides, setShowGuides] = useState(false);
  const [ignoreSuppressions, setIgnoreSuppressions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      apiFetch<LabelConstituent[]>("/api/constituents?limit=all"),
      apiFetch<AudienceListSummary[]>("/api/email-campaigns/lists").catch(() => []),
    ]).then(([rows, listRows]) => {
      if (!active) return;
      setConstituents(rows);
      setLists(listRows);
    }).catch((requestError) => {
      if (active) setError(requestError instanceof Error ? requestError.message : "Unable to load label recipients.");
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, []);

  const normalizedSearch = search.trim().toLowerCase();
  const visibleRows = useMemo(() => constituents.filter((row) => !normalizedSearch || [displayName(row), row.email, ...formattedAddress(row)].some((value) => value?.toLowerCase().includes(normalizedSearch))), [constituents, normalizedSearch]);
  const selectedRows = useMemo(() => constituents.filter((row) => selectedIds.has(row.id)), [constituents, selectedIds]);
  const suppressedSelectedRows = useMemo(() => selectedRows.filter(isLabelSuppressed), [selectedRows]);
  const printableSelectedRows = useMemo(() => selectedRows.filter((row) => getLabelEligibility(row, ignoreSuppressions).ready), [ignoreSuppressions, selectedRows]);
  const unavailableSummary = useMemo(() => unavailableLabelReasonSummary(selectedRows, ignoreSuppressions), [ignoreSuppressions, selectedRows]);
  const allVisibleSelected = visibleRows.length > 0 && visibleRows.every((row) => selectedIds.has(row.id));
  const previewSlots = Array.from({ length: 30 }, (_, slot) => slot < startPosition - 1 ? null : printableSelectedRows[slot - (startPosition - 1)] ?? null);
  const pageCount = printableSelectedRows.length ? Math.ceil((startPosition - 1 + printableSelectedRows.length) / 30) : 0;

  function toggleRecipient(id: string) {
    const row = constituents.find((item) => item.id === id);
    if (!row) return;
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleVisible() {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const row of visibleRows) {
        if (allVisibleSelected) next.delete(row.id); else next.add(row.id);
      }
      return next;
    });
  }

  function toggleSuppressionOverride() {
    if (ignoreSuppressions) {
      setIgnoreSuppressions(false);
      setNotice("Mail suppressions are being respected again. Suppressed recipients will not appear in the label PDF.");
      return;
    }
    if (!suppressedSelectedRows.length) return;
    const confirmed = window.confirm(
      `Include ${suppressedSelectedRows.length} selected recipient${suppressedSelectedRows.length === 1 ? "" : "s"} marked Do Not Mail or Do Not Contact in this label PDF? This does not change their CRM preferences.`,
    );
    if (!confirmed) return;
    setIgnoreSuppressions(true);
    setNotice(`Label-only suppression override enabled for ${suppressedSelectedRows.length} selected recipient${suppressedSelectedRows.length === 1 ? "" : "s"}. Their CRM preferences remain unchanged.`);
  }

  async function loadAudienceList() {
    if (!selectedListId) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const list = await apiFetch<AudienceListDetail>(`/api/email-campaigns/lists/${encodeURIComponent(selectedListId)}`);
      const resolved = resolveAudienceListConstituents(constituents, list.recipients);
      const resolvedIds = new Set(resolved.constituentIds);
      const matches = constituents.filter((row) => resolvedIds.has(row.id));
      const ready = matches.filter((row) => getLabelEligibility(row).ready);
      setIgnoreSuppressions(false);
      setSelectedIds(new Set(matches.map((row) => row.id)));
      const skipped = matches.length - ready.length;
      const unmatched = resolved.unmatchedMemberCount;
      const skippedReasons = unavailableLabelReasonSummary(matches);
      setNotice(`${list.name} loaded: ${matches.length} audience member${matches.length === 1 ? "" : "s"} selected, ${ready.length} label-ready${skipped ? `, ${skipped} unavailable (${skippedReasons})` : ""}${unmatched ? `, ${unmatched} list member${unmatched === 1 ? "" : "s"} not matched to a constituent` : ""}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to load this audience list.");
    } finally {
      setWorking(false);
    }
  }

  async function downloadLabels() {
    if (!printableSelectedRows.length) return;
    setWorking(true);
    setError(null);
    setNotice(null);
    try {
      const response = await apiFetchResponse("/api/letters/labels/avery-5160.pdf", {
        method: "POST",
        body: JSON.stringify({ constituentIds: printableSelectedRows.map((row) => row.id), startPosition, showGuides, ignoreSuppressions }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error?.message ?? "Unable to create the Avery 5160 PDF.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = responseFileName(response);
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      const overrideNote = ignoreSuppressions && suppressedSelectedRows.length ? ` ${suppressedSelectedRows.length} mail suppression${suppressedSelectedRows.length === 1 ? " was" : "s were"} overridden for this PDF only.` : "";
      setNotice(`Avery 5160 PDF created with ${printableSelectedRows.length} label${printableSelectedRows.length === 1 ? "" : "s"} across ${pageCount} sheet${pageCount === 1 ? "" : "s"}.${overrideNote}`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to create the Avery 5160 PDF.");
    } finally {
      setWorking(false);
    }
  }

  if (loading) return <div className="flex min-h-[520px] items-center justify-center text-sm font-semibold text-slate-500">Loading mailing-label recipients...</div>;

  return (
    <main className="min-w-0 flex-1 overflow-x-hidden p-3 sm:p-5 xl:p-6">
      <div className="mx-auto max-w-[1600px] space-y-4">
        <header className="flex flex-col justify-between gap-3 border-b border-slate-300 pb-4 lg:flex-row lg:items-end">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0f6cbd]">Mail merge tool</p><h1 className="mt-1 text-2xl font-semibold text-slate-950">Avery 5160 mailing labels</h1><p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">Create production-sized 30-up address-label sheets from constituents or a saved Contacts Manager audience list.</p></div>
          <div className="flex flex-wrap gap-2"><Link href="/contacts-manager/lists" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Manage audience lists</Link><button type="button" onClick={() => void downloadLabels()} disabled={working || printableSelectedRows.length === 0} className="rounded-md bg-[#0f6cbd] px-4 py-2 text-sm font-semibold text-white hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-50">{working ? "Preparing..." : `Download label PDF (${printableSelectedRows.length} of ${selectedRows.length} selected)`}</button></div>
        </header>

        {error ? <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p> : null}
        {notice ? <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">{notice}</p> : null}

        <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_470px]">
          <div className="min-w-0 space-y-3">
            <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm">
              <h2 className="font-semibold text-slate-950">1. Choose recipients</h2>
              <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
                <label className="min-w-0 flex-1 text-xs font-semibold text-slate-700">Contacts Manager audience list<select value={selectedListId} onChange={(event) => setSelectedListId(event.target.value)} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal"><option value="">Choose a saved list...</option>{lists.map((list) => <option key={list.id} value={list.id}>{list.name} ({list.recipientsCount})</option>)}</select></label>
                <button type="button" onClick={() => void loadAudienceList()} disabled={!selectedListId || working} className="rounded-md border border-[#0f6cbd] bg-[#eff6fc] px-4 py-2 text-sm font-semibold text-[#0f548c] hover:bg-[#dceefa] disabled:opacity-50">Load audience list</button>
                <button type="button" onClick={() => setSelectedIds(new Set(constituents.map((row) => row.id)))} disabled={!constituents.length} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">Select all contacts</button>
                <button type="button" onClick={() => setSelectedIds(new Set())} disabled={!selectedIds.size} className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Clear</button>
              </div>
            </div>

            <div className="overflow-hidden rounded-lg border border-slate-300 bg-white shadow-sm">
              <div className="flex flex-col gap-2 border-b border-slate-200 bg-slate-50 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div className="min-w-0"><h2 className="font-semibold text-slate-950">Recipient review</h2><p className="text-xs text-slate-600">{selectedRows.length} selected · {printableSelectedRows.length} label-ready · {selectedRows.length - printableSelectedRows.length} selected but unavailable</p>{unavailableSummary ? <p className="mt-1 max-w-3xl text-xs font-medium leading-5 text-amber-800"><span className="font-semibold">Unavailable reasons:</span> {unavailableSummary}</p> : null}</div><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email, or address" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-sm" /></div>
              {suppressedSelectedRows.length ? <div className={`flex flex-col gap-3 border-b px-3 py-3 sm:flex-row sm:items-center sm:justify-between ${ignoreSuppressions ? "border-amber-300 bg-amber-50" : "border-red-200 bg-red-50"}`}><div><p className={`text-sm font-semibold ${ignoreSuppressions ? "text-amber-950" : "text-red-900"}`}>{ignoreSuppressions ? "Mail suppressions are ignored for this PDF" : `${suppressedSelectedRows.length} selected recipient${suppressedSelectedRows.length === 1 ? " has" : "s have"} mail suppressions`}</p><p className={`mt-0.5 text-xs leading-5 ${ignoreSuppressions ? "text-amber-800" : "text-red-800"}`}>{ignoreSuppressions ? "These labels will be included. Constituent preferences are not changed, and the override is recorded in the audit log." : "They are excluded by default. You can deliberately include them in this label PDF without changing their CRM preferences."}</p></div><button type="button" aria-pressed={ignoreSuppressions} onClick={toggleSuppressionOverride} className={`shrink-0 rounded-md border px-3 py-2 text-sm font-semibold ${ignoreSuppressions ? "border-slate-400 bg-white text-slate-800 hover:bg-slate-50" : "border-red-700 bg-red-700 text-white hover:bg-red-800"}`}>{ignoreSuppressions ? "Respect suppressions" : "Ignore suppressions for labels"}</button></div> : null}
              <div className="max-h-[620px] overflow-auto">
                <table className="min-w-[760px] w-full border-collapse text-sm"><thead className="sticky top-0 z-10 bg-[#5d5d5d] text-left text-xs text-white"><tr><th className="w-12 px-3 py-2"><input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} aria-label="Select all visible recipients" /></th><th className="px-3 py-2">Recipient</th><th className="px-3 py-2">Mailing address</th><th className="px-3 py-2">Readiness / reason</th></tr></thead><tbody>{visibleRows.map((row) => { const status = getLabelEligibility(row, ignoreSuppressions); const isPreferenceSuppression = status.kind === "do-not-contact" || status.kind === "do-not-mail" || status.kind === "all-contact-and-mail"; return <tr key={row.id} className="border-t border-slate-200 hover:bg-slate-50"><td className="px-3 py-2"><input type="checkbox" checked={selectedIds.has(row.id)} onChange={() => toggleRecipient(row.id)} aria-label={`Include ${displayName(row)}`} /></td><td className="px-3 py-2"><p className="font-medium text-slate-900">{displayName(row)}</p><p className="text-xs text-slate-500">{row.email || "No email"}</p></td><td className="px-3 py-2 text-slate-700">{formattedAddress(row).length ? formattedAddress(row).join(" · ") : "No address"}</td><td className={`px-3 py-2 text-xs font-semibold ${status.kind === "ready" ? "text-emerald-700" : isPreferenceSuppression ? "text-red-700" : "text-amber-700"}`}>{status.reason}</td></tr>; })}{!visibleRows.length ? <tr><td colSpan={4} className="px-4 py-12 text-center text-sm text-slate-500">No matching constituents.</td></tr> : null}</tbody></table>
              </div>
            </div>
          </div>

          <aside className="space-y-3">
            <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"><h2 className="font-semibold text-slate-950">2. Sheet setup</h2><label className="mt-3 block text-xs font-semibold text-slate-700">First label position<select value={startPosition} onChange={(event) => setStartPosition(Number(event.target.value))} className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-normal">{Array.from({ length: 30 }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1}{index === 0 ? " — new sheet" : ` — skip ${index}`}</option>)}</select></label><label className="mt-3 flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={showGuides} onChange={(event) => setShowGuides(event.target.checked)} className="mt-0.5" /><span><span className="font-semibold">Print alignment guides</span><span className="block text-xs text-slate-500">Use plain paper for a test print. Turn guides off before printing on labels.</span></span></label><div className="mt-3 grid grid-cols-3 gap-2 text-center"><div className="rounded bg-slate-50 px-2 py-2"><p className="text-xs text-slate-500">Labels</p><p className="font-semibold tabular-nums">{printableSelectedRows.length}</p></div><div className="rounded bg-slate-50 px-2 py-2"><p className="text-xs text-slate-500">Sheets</p><p className="font-semibold tabular-nums">{pageCount}</p></div><div className="rounded bg-slate-50 px-2 py-2"><p className="text-xs text-slate-500">Start</p><p className="font-semibold tabular-nums">{startPosition}</p></div></div></div>

            <div className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"><div className="flex items-center justify-between"><div><h2 className="font-semibold text-slate-950">First-sheet preview</h2><p className="text-xs text-slate-500">Avery 5160 · US Letter · 30 labels</p></div><span className="text-xs font-semibold text-slate-600">Not to print</span></div><div className="mx-auto mt-3 grid aspect-[8.5/11] w-full max-w-[410px] grid-cols-3 grid-rows-10 gap-x-[1.47%] bg-white px-[2.2%] py-[4.55%] shadow-[0_1px_8px_rgba(15,23,42,0.18)]">{previewSlots.map((row, index) => <div key={index} className={`min-h-0 overflow-hidden px-[5%] py-[3%] text-[5px] leading-[1.18] text-slate-700 ${showGuides ? "border border-slate-300" : ""}`}>{row ? <><p className="truncate font-bold">{displayName(row)}</p>{formattedAddress(row).map((line) => <p key={line} className="truncate">{line}</p>)}</> : null}</div>)}</div><p className="mt-3 text-xs leading-5 text-slate-500">Print the downloaded PDF at <strong>Actual size / 100%</strong>. Disable Fit, Shrink, or Scale-to-page options.</p></div>
          </aside>
        </section>
      </div>
    </main>
  );
}
