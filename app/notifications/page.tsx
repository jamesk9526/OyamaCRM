"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import { apiFetch } from "@/app/lib/auth-client";

type Notice = { id: string; title: string; message: string; href: string; createdAt: string; priority: "low" | "medium" | "high"; status: "unread" | "read" | "dismissed"; module: string; actionLabel: string | null };
type Filter = "active" | "unread" | "all";

export default function NotificationsPage() {
  const [items, setItems] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [filter, setFilter] = useState<Filter>("active");
  const [module, setModule] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { const data = await apiFetch<{ items: Notice[]; unreadCount: number }>(`/api/notifications?status=${filter}&module=${module}`); setItems(data.items ?? []); setUnread(data.unreadCount ?? 0); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Notifications could not be loaded."); }
    finally { setLoading(false); }
  }, [filter, module]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 30000);
    return () => window.clearInterval(timer);
  }, [load]);
  const modules = useMemo(() => Array.from(new Set(items.map((item) => item.module))).sort(), [items]);
  async function action(id: string, verb: "read" | "dismiss" | "snooze") { await apiFetch(`/api/notifications/${id}/${verb}`, { method: "PATCH", body: JSON.stringify(verb === "snooze" ? { until: new Date(Date.now() + 3600000).toISOString() } : {}) }); await load(); }
  async function open(item: Notice) { if (item.status === "unread") await action(item.id, "read"); window.location.assign(item.href); }
  return <EnterprisePageShell><main className="mx-auto max-w-6xl space-y-5 p-5"><header className="rounded-xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-[.12em] text-[#0f6cbd]">Work stream</p><div className="mt-1 flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-2xl font-semibold text-slate-950">Notifications</h1><p className="mt-1 text-sm text-slate-600">Live, user-scoped alerts from CRM work. {unread} unread.</p></div><div className="flex gap-2"><button onClick={() => void apiFetch("/api/notifications/mark-all-read", { method: "POST", body: JSON.stringify({ module }) }).then(load)} className="rounded-[3px] border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Mark all read</button><button onClick={() => void load()} className="rounded-[3px] bg-[#0f6cbd] px-3 py-2 text-sm font-semibold text-white">Refresh</button></div></div></header><div className="flex flex-wrap gap-2"><select value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="rounded-[3px] border border-slate-300 bg-white px-3 py-2 text-sm"><option value="active">Active</option><option value="unread">Unread</option><option value="all">All</option></select><select value={module} onChange={(e) => setModule(e.target.value)} className="rounded-[3px] border border-slate-300 bg-white px-3 py-2 text-sm"><option value="all">All workspaces</option>{modules.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>{error ? <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}<section className="overflow-hidden rounded-xl border border-slate-200 bg-white">{loading ? <p className="p-6 text-sm text-slate-500">Loading notifications…</p> : !items.length ? <p className="p-8 text-center text-sm text-slate-500">You are all caught up.</p> : items.map((item) => <article key={item.id} className={`flex flex-col gap-3 border-b border-slate-100 p-4 last:border-0 sm:flex-row sm:items-start ${item.status === "unread" ? "bg-[#f4f9ff]" : ""}`}><span className={`mt-1 h-2.5 w-2.5 rounded-full ${item.priority === "high" ? "bg-red-500" : item.priority === "medium" ? "bg-amber-500" : "bg-[#0f6cbd]"}`} /><div className="min-w-0 flex-1"><button onClick={() => void open(item)} className="text-left"><h2 className="font-semibold text-slate-900">{item.title}</h2><p className="mt-1 text-sm text-slate-600">{item.message}</p></button><p className="mt-2 text-xs text-slate-400">{item.module} · {new Date(item.createdAt).toLocaleString()}</p></div><div className="flex shrink-0 gap-2 text-xs font-semibold"><button onClick={() => void open(item)} className="text-[#0f6cbd]">{item.actionLabel || "Open"}</button><button onClick={() => void action(item.id, "snooze")} className="text-slate-600">Snooze</button><button onClick={() => void action(item.id, "dismiss")} className="text-red-700">Dismiss</button></div></article>)}</section><Link href="/tasks" className="text-sm font-semibold text-[#0f6cbd]">Open tasks →</Link></main></EnterprisePageShell>;
}
