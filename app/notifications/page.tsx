"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, RefreshCcw } from "lucide-react";
import EnterprisePageShell from "@/app/components/layout/EnterprisePageShell";
import CRMPageHeader from "@/app/components/ui/crm/CRMPageHeader";
import NotificationList from "@/app/components/notifications/NotificationList";
import { useNotificationFeed } from "@/app/components/notifications/useNotificationFeed";
import { changeNotification, markNotificationsRead, safeNotificationHref, type NotificationAction, type NotificationItem } from "@/app/components/notifications/notification-client";

export default function NotificationsPage() {
  const router = useRouter(); const [status, setStatus] = useState("active"); const [module, setModule] = useState("all"); const [page, setPage] = useState(1);
  const feed = useNotificationFeed({ module, status, page, pageSize: 25 });
  const [busy, setBusy] = useState<string | null>(null); const [error, setError] = useState<string | null>(null);
  useEffect(() => { if (feed.totalPages && page > feed.totalPages) setPage(feed.totalPages); }, [feed.totalPages, page]);
  async function run(id: string, work: () => Promise<unknown>) { setBusy(id); setError(null); try { await work(); } catch (reason) { setError(reason instanceof Error ? reason.message : "The notification could not be updated. Try again."); } finally { setBusy(null); } }
  const action = (item: NotificationItem, verb: NotificationAction) => { void run(item.id, () => changeNotification(item.id, verb, verb === "snooze" ? new Date(Date.now() + 3600000).toISOString() : undefined)); };
  const open = (item: NotificationItem) => { void run(item.id, async () => { if (item.status === "unread" && (!item.expiresAt || new Date(item.expiresAt) > new Date())) await changeNotification(item.id, "read"); router.push(safeNotificationHref(item.href)); }); };
  return <EnterprisePageShell><div className="mx-auto max-w-6xl space-y-5 py-6">
    <CRMPageHeader breadcrumb="Your work" title="Notifications" description="Assignments, reminders, and workspace updates in one private inbox." primaryAction={<button className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--crm-accent)] px-4 text-sm font-semibold text-white disabled:opacity-50" disabled={busy !== null || !feed.unreadCount} onClick={() => void run("all", () => markNotificationsRead(module))}><CheckCheck size={16} />Mark all read</button>} secondaryActions={<button className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700" disabled={feed.loading} onClick={() => void feed.refresh()}><RefreshCcw size={15} />Refresh</button>} />
    <div className="flex flex-wrap items-end gap-4 rounded-xl border border-slate-200 bg-white p-4">
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Show<select aria-label="Show" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="active">Active notifications</option><option value="unread">Unread</option><option value="snoozed">Snoozed</option><option value="all">All history</option></select></label>
      <label className="grid gap-1.5 text-xs font-semibold text-slate-600">Workspace<select aria-label="Workspace" className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800" value={module} onChange={(event) => { setModule(event.target.value); setPage(1); }}><option value="all">All workspaces</option>{[...new Set([...(feed.modules ?? []), ...feed.items.map((row) => row.module), ...(module === "all" ? [] : [module])])].sort().map((name) => <option key={name} value={name}>{name}</option>)}</select></label>
      <p className="ml-auto pb-2 text-xs text-slate-500" role="status">{feed.unreadCount} unread{feed.total !== undefined ? ` · ${feed.total} matching notifications` : ""}</p>
    </div>
    {(error || feed.error) && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><span>{error || feed.error}</span><button className="font-semibold underline" onClick={() => { setError(null); void feed.refresh(); }}>Retry</button></div>}
    <section aria-label="Notification inbox" aria-busy={feed.loading} className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {feed.loading && !feed.items.length ? <p role="status" className="p-8 text-center text-sm text-slate-500">Loading your notifications…</p> : feed.error && !feed.items.length ? <p className="p-8 text-center text-sm text-slate-500">Your inbox could not be loaded. Retry to check for updates.</p> : !feed.items.length ? <div className="p-10 text-center"><Bell size={28} className="mx-auto text-slate-400" /><h2 className="mt-3 font-semibold text-slate-800">{status === "snoozed" ? "No snoozed notifications" : status === "unread" ? "You’re all caught up" : "No matching notifications"}</h2><p className="mt-2 text-sm text-slate-500">Task assignments and scheduled reminders appear here when there is work to review.</p></div> : <NotificationList items={feed.items} busy={busy} onOpen={open} onAction={action} />}
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 text-sm"><Link className="font-semibold text-[var(--crm-accent)] hover:underline" href="/tasks">Open Tasks →</Link><div className="flex items-center gap-3"><button className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 disabled:opacity-40" disabled={page <= 1 || feed.loading} onClick={() => setPage((value) => value - 1)}>Previous</button><span className="text-xs text-slate-500">Page {page} of {feed.totalPages ?? 1}</span><button className="min-h-9 rounded-lg border border-slate-300 bg-white px-3 disabled:opacity-40" disabled={page >= (feed.totalPages ?? 1) || feed.loading} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
    <Link href="/settings/notification-email" className="text-sm font-semibold text-[var(--crm-accent)] hover:underline">Administrator email preferences →</Link>
    <p className="text-xs leading-5 text-slate-500">In-app updates refresh while Oyama is open. Administrators can opt into email delivery for their own new alerts in Settings. SMS and device push are not sent.</p>
  </div></EnterprisePageShell>;
}
