"use client";
import Link from "next/link";
import NotificationList from "./NotificationList";
import type { NotificationAction, NotificationItem } from "./notification-client";

export default function NotificationPanel({ items, loading, error, busy, unreadCount, onRefresh, onReadAll, onOpen, onAction, onNavigate }: {
  items: NotificationItem[]; loading: boolean; error: string | null; busy: string | null; unreadCount: number;
  onRefresh: () => void; onReadAll: () => void; onOpen: (item: NotificationItem) => void;
  onAction: (item: NotificationItem, action: NotificationAction) => void; onNavigate: () => void;
}) {
  return <section aria-label="Notification panel" className="flex max-h-[70vh] flex-col bg-white">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-slate-900">Notifications</h2><Link href="/notifications" onClick={onNavigate} className="min-h-8 content-center text-xs font-semibold text-[var(--crm-accent,#0f6cbd)]">View all →</Link></div>
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-4 py-2 text-xs"><span className="text-slate-500">{unreadCount} unread</span><div className="flex gap-4"><button disabled={busy !== null || !unreadCount} onClick={onReadAll} className="min-h-8 font-semibold text-slate-600 disabled:opacity-40">Mark all read</button><button disabled={loading} onClick={onRefresh} className="min-h-8 font-semibold text-slate-600 disabled:opacity-40">Refresh</button></div></div>
    {error && <div role="alert" className="shrink-0 border-b border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">{error} <button onClick={onRefresh} className="font-semibold underline">Retry</button></div>}
    <div className="min-h-0 overflow-y-auto" aria-busy={loading}>{loading && !items.length ? <p role="status" className="p-6 text-sm text-slate-500">Loading notifications…</p> : !items.length ? <p className="p-6 text-sm text-slate-500">{error ? "Notifications are unavailable. Try again." : "You’re all caught up."}</p> : <NotificationList compact items={items} busy={busy} onOpen={onOpen} onAction={onAction} />}</div>
  </section>;
}
