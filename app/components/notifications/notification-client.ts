import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";

export interface NotificationItem {
  id: string; type: string; title: string; message: string; href: string; createdAt: string;
  priority: "low" | "medium" | "high"; status: "unread" | "read" | "dismissed"; module: string;
  actionLabel: string | null; snoozedUntil?: string | null; expiresAt?: string | null;
}
export interface NotificationFeed { items: NotificationItem[]; unreadCount: number; total?: number; page?: number; totalPages?: number; modules?: string[] }
export type NotificationAction = "read" | "unread" | "dismiss" | "snooze" | "unsnooze";
export function safeNotificationHref(href: string) {
  return href.startsWith("/") && !href.startsWith("//") && !/[\\\x00-\x20]/.test(href) ? href : "/notifications";
}
export function notifyInboxChanged() { window.dispatchEvent(new Event("notifications:updated")); }
export async function changeNotification(id: string, action: NotificationAction, until?: string) {
  await apiFetch(`/api/notifications/${encodeURIComponent(id)}/${action}`, { method: "PATCH", body: JSON.stringify(until ? { until } : {}) });
  notifyInboxChanged();
}
export async function markNotificationsRead(module: string) {
  await apiFetch("/api/notifications/mark-all-read", { method: "POST", body: JSON.stringify({ module }) }); notifyInboxChanged();
}

/** One authenticated stream per browser tab, shared by the header and full inbox. */
const listeners = new Set<() => void>();
let controller: AbortController | null = null;
let retry: ReturnType<typeof setTimeout> | undefined;
let polling: ReturnType<typeof setInterval> | undefined;
const broadcast = () => { for (const listener of listeners) listener(); };
const refreshWhenVisible = () => { if (document.visibilityState === "visible") broadcast(); };
export function subscribeToNotifications(listener: () => void) {
  listeners.add(listener);
  if (!controller) {
    controller = new AbortController(); const active = controller; let attempts = 0;
    const connect = async () => {
      try {
        const response = await apiFetchResponse("/api/notifications/sse", { headers: { Accept: "text/event-stream" }, signal: active.signal });
        if (!response.ok || !response.body || !response.headers.get("content-type")?.includes("text/event-stream")) throw new Error("Stream unavailable");
        attempts = 0; const reader = response.body.getReader(); const decoder = new TextDecoder(); let pending = "";
        try {
          while (!active.signal.aborted) {
            const { value, done } = await reader.read(); if (done) break;
            pending += decoder.decode(value, { stream: true });
            const events = pending.replace(/\r\n/g, "\n").split("\n\n"); pending = events.pop() ?? "";
            for (const event of events) if (/^event: (ready|changed)$/m.test(event)) broadcast();
          }
        } finally { reader.releaseLock(); }
      } catch { /* Polling remains available while the stream reconnects. */ }
      finally {
        if (!active.signal.aborted) retry = setTimeout(() => { void connect(); }, Math.min(60000, 5000 * 2 ** Math.min(attempts++, 4)));
      }
    };
    void connect();
    polling = setInterval(broadcast, 30000);
    window.addEventListener("notifications:updated", broadcast);
    window.addEventListener("tasks:updated", broadcast);
    window.addEventListener("focus", broadcast);
    window.addEventListener("online", broadcast);
    document.addEventListener("visibilitychange", refreshWhenVisible);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      controller?.abort(); controller = null; clearTimeout(retry); clearInterval(polling);
      window.removeEventListener("notifications:updated", broadcast); window.removeEventListener("tasks:updated", broadcast); window.removeEventListener("focus", broadcast);
      window.removeEventListener("online", broadcast);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    }
  };
}
