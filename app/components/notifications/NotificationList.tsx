"use client";
import type { NotificationAction, NotificationItem } from "./notification-client";

/** The page and both header layouts use the same available actions and states. */
export default function NotificationList({ items, busy, onOpen, onAction, compact = false }: {
  items: NotificationItem[]; busy: string | null; onOpen: (item: NotificationItem) => void; onAction: (item: NotificationItem, action: NotificationAction) => void; compact?: boolean;
}) {
  return <ul className="crm-notification-list divide-y divide-slate-100">{items.map((item) => {
    const sleeping = !!item.snoozedUntil && new Date(item.snoozedUntil) > new Date();
    const expired = !!item.expiresAt && new Date(item.expiresAt) <= new Date(); const inactive = item.status === "dismissed" || expired;
    return <li key={item.id} aria-busy={busy === item.id} data-unread={item.status === "unread" && !sleeping && !inactive} className={`${compact ? "p-4" : "p-5"} ${item.status === "unread" && !sleeping && !inactive ? "bg-[var(--crm-accent-soft,#eff6fc)]" : "bg-white"}`}>
      <div className="flex items-start gap-3"><span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${item.priority === "high" ? "bg-amber-500" : "bg-[var(--crm-accent,#0f6cbd)]"}`} aria-hidden="true" />
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><button disabled={busy !== null} className="break-words text-left text-sm font-semibold text-slate-900 hover:underline disabled:opacity-50" onClick={() => onOpen(item)}>{item.title}</button><span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{expired ? "Expired" : sleeping ? "Snoozed" : item.status}</span></div>
          <p className={`mt-1 break-words text-slate-600 ${compact ? "text-xs" : "text-sm"}`}>{item.message}</p>
          <p className="mt-2 text-[11px] text-slate-500">{item.priority === "high" ? "High priority · " : ""}{item.module} · {new Date(item.createdAt).toLocaleString()}{sleeping && ` · Returns ${new Date(item.snoozedUntil!).toLocaleString()}`}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold">
            <button disabled={busy !== null} className="min-h-8 text-[var(--crm-accent,#0f6cbd)] disabled:opacity-50" onClick={() => onOpen(item)}>{item.actionLabel || "Open"}</button>
            {!inactive && <><button disabled={busy !== null} className="min-h-8 text-slate-600 disabled:opacity-50" onClick={() => onAction(item, item.status === "unread" ? "read" : "unread")}>{item.status === "unread" ? "Mark read" : "Mark unread"}</button><button disabled={busy !== null} className="min-h-8 text-slate-600 disabled:opacity-50" onClick={() => onAction(item, sleeping ? "unsnooze" : "snooze")}>{sleeping ? "Unsnooze" : "Snooze 1h"}</button><button disabled={busy !== null} className="min-h-8 text-red-700 disabled:opacity-50" onClick={() => onAction(item, "dismiss")}>Dismiss</button></>}
          </div>
        </div>
      </div>
    </li>;
  })}</ul>;
}
