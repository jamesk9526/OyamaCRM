"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import { useAuth } from "@/app/components/auth/AuthProvider";
export interface QuickBooksOverview { connected: boolean; enabled: boolean; timezone: string; dailySyncEnabled: boolean; dailySyncHour: number; summary: { pending: number; failed: number; lastSuccessfulSync: string | null } }
export default function QuickBooksWidget({ refreshVersion = 0 }: { refreshVersion?: number }) {
  const { user, loading } = useAuth();
  const { qbConnected, qbEnabled, qbDailySyncEnabled } = usePlugins();
  const [data, setData] = useState<QuickBooksOverview | null>(null);
  const [error, setError] = useState(false);
  const allowed = !!user && ["admin", "manager", "staff", "super_admin"].includes(user.role);
  useEffect(() => { if (loading || !allowed) return; let active = true; apiFetch<QuickBooksOverview>("/api/quickbooks/status").then(result => { if (active) { setData(result); setError(false); } }).catch(() => { if (active) setError(true); }); return () => { active = false; }; }, [loading, allowed, refreshVersion, qbConnected, qbEnabled, qbDailySyncEnabled, user?.organizationId]);
  if (!allowed) return null;
  return <section aria-label="QuickBooks overview" className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-slate-900">QuickBooks Online</h2><Link href="/quickbooks-sync" className="text-sm font-semibold text-blue-700">Open workspace</Link></div>
    {error ? <p role="alert" className="text-sm text-red-700">QuickBooks status could not be loaded. Open the workspace to retry.</p> : !data ? <p className="text-sm text-slate-500">Loading accounting status…</p> : <><p className="text-sm text-slate-600">{data.connected ? data.enabled ? "Connected" : "Connected · Sending paused" : "Connection needed"} · {data.dailySyncEnabled ? `Daily after ${data.dailySyncHour}:00 (${data.timezone})` : "Review and send"}</p><dl className="grid grid-cols-2 sm:grid-cols-3 gap-4"><div><dt className="text-xs text-slate-500">Pending review</dt><dd className="text-2xl font-semibold text-slate-900">{data.summary.pending}</dd></div><div><dt className="text-xs text-slate-500">Failed</dt><dd className="text-2xl font-semibold text-slate-900">{data.summary.failed}</dd></div><div><dt className="text-xs text-slate-500">Last successful sync</dt><dd className="mt-1 text-sm text-slate-900">{data.summary.lastSuccessfulSync ? new Date(data.summary.lastSuccessfulSync).toLocaleString() : "No gifts sent yet"}</dd></div></dl></>}
  </section>;
}
