"use client";
import { useState, useEffect, useCallback } from "react";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import QBSyncQueueTable, { type QBSyncItem } from "@/app/components/quickbooks/QBSyncQueueTable";
import QuickBooksSettings from "@/app/components/quickbooks/QuickBooksSettings";
import QuickBooksActivity from "@/app/components/quickbooks/QuickBooksActivity";
import QuickBooksWidget from "@/app/components/quickbooks/QuickBooksWidget";
import { apiFetch } from "@/app/lib/auth-client";
const filters = [{ label: "Pending review", value: "PENDING" }, { label: "Failures", value: "FAILED" }, { label: "Sent history", value: "SYNCED" }, { label: "All gifts", value: "" }];
export default function QBSyncPage() {
  const { qbEnabled, qbConnected, loading, refresh } = usePlugins();
  const [tab, setTab] = useState("queue");
  const [filter, setFilter] = useState("PENDING");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<QBSyncItem[]>([]);
  const [total, setTotal] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const load = useCallback(async () => {
    setFetching(true); setError(null);
    try { const result = await apiFetch<{ items: QBSyncItem[]; total: number }>(`/api/quickbooks/sync-queue?${new URLSearchParams({ status: filter, page: String(page), limit: "50" })}`); setItems(result.items); setTotal(result.total); }
    catch (err) { setError(err instanceof Error ? err.message : "Could not load donations."); }
    finally { setFetching(false); }
  }, [filter, page]);
  useEffect(() => { if (!loading) void load(); }, [loading, load]);
  useEffect(() => { const outcome = new URLSearchParams(window.location.search).get("qb"); if (outcome === "connected") { setNotice("QuickBooks connected. Review your donations before sending."); void refresh(); } else if (outcome === "error") setError(new URLSearchParams(window.location.search).get("reason") === "company" ? "Reconnect the original QuickBooks company to preserve sent history." : "QuickBooks authorization was canceled or failed. Open Connection & settings and try again."); }, [refresh]);
  function reload() { void load(); setVersion(value => value + 1); }
  async function sendAll() {
    if (!confirm("Send all pending donations to QuickBooks? Review the pending queue before continuing.")) return;
    setBusy(true); setError(null);
    try { const result = await apiFetch<{ synced: number; failed: number }>("/api/quickbooks/sync-queue/sync-all", { method: "POST" }); setNotice(`${result.synced} gifts sent; ${result.failed} failed.`); reload(); }
    catch (err) { setError(err instanceof Error ? err.message : "Sending failed."); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <header className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-blue-700">Accounting workspace</p><h1 className="mt-1 text-2xl font-semibold text-slate-900">QuickBooks</h1><p className="mt-1 text-sm text-slate-600">Review donations, send sales receipts, and manage your connection.</p></div><button className="rounded-lg border bg-white px-4 py-2 text-sm font-medium" disabled={busy || fetching} onClick={() => { reload(); void refresh(); }}>Refresh</button></header>
    <QuickBooksWidget refreshVersion={version} />
    <nav aria-label="QuickBooks workspace" className="flex flex-wrap gap-2">{[{ id: "queue", label: "Donation sync" }, { id: "activity", label: "Activity log" }, { id: "settings", label: "Connection & settings" }].map(item => <button key={item.id} aria-pressed={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === item.id ? "bg-blue-700 text-white" : "border bg-white text-slate-700"}`}>{item.label}</button>)}</nav>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">{notice}</p>}
    {tab === "settings" ? <QuickBooksSettings embedded /> : tab === "activity" ? <QuickBooksActivity key={version} /> : <>
      {!qbConnected || !qbEnabled ? <div className="rounded-xl border bg-white p-5"><p className="text-sm text-slate-600">Connect and enable QuickBooks to send donations.</p><button className="mt-3 font-semibold text-blue-700" onClick={() => setTab("settings")}>Set up QuickBooks</button></div> : null}
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex flex-wrap gap-2" aria-label="Donation status">{filters.map(item => <button key={item.value} aria-pressed={filter === item.value} className={`rounded-lg px-3 py-2 text-sm ${filter === item.value ? "bg-blue-100 font-semibold text-blue-900" : "text-slate-600"}`} onClick={() => { setFilter(item.value); setPage(1); }}>{item.label}</button>)}</div><button className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !qbConnected || !qbEnabled} onClick={sendAll}>{busy ? "Sending…" : "Review complete · Send pending"}</button></div>
      {fetching ? <p className="py-8 text-center text-sm text-slate-500">Loading donations…</p> : <QBSyncQueueTable items={items} onRefresh={reload} syncingAll={busy || !qbConnected || !qbEnabled} />}
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-slate-600"><span>{total} gifts · Page {page} of {Math.max(1, Math.ceil(total / 50))}</span><div className="flex gap-3"><button disabled={page <= 1 || fetching} className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => setPage(value => value - 1)}>Previous</button><button disabled={page * 50 >= total || fetching} className="rounded border px-3 py-2 disabled:opacity-40" onClick={() => setPage(value => value + 1)}>Next</button></div></div>
    </>}
  </div>;
}
