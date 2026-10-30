"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { subscribeToNotifications, type NotificationFeed } from "./notification-client";

export function useNotificationFeed({ module = "all", status = "active", page = 1, pageSize = 40, enabled = true, refreshVersion = 0 }: { module?: string; status?: string; page?: number; pageSize?: number; enabled?: boolean; refreshVersion?: number } = {}) {
  const [data, setData] = useState<NotificationFeed>({ items: [], unreadCount: 0 });
  const [loading, setLoading] = useState(enabled); const [error, setError] = useState<string | null>(null); const request = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++request.current; if (!enabled) return;
    setLoading(true);
    try {
      const value = await apiFetch<NotificationFeed>(`/api/notifications?${new URLSearchParams({ module, status, page: String(page), pageSize: String(pageSize) })}`);
      if (id !== request.current) return; setData(value); setError(null);
    } catch (reason) { if (id === request.current) setError(reason instanceof Error ? reason.message : "Notifications could not be loaded."); }
    finally { if (id === request.current) setLoading(false); }
  }, [enabled, module, status, page, pageSize]);
  const invalidate = useCallback(() => { request.current++; }, []);
  useEffect(() => { void refresh(); return invalidate; }, [refresh, invalidate, refreshVersion]);
  useEffect(() => enabled ? subscribeToNotifications(() => void refresh()) : undefined, [enabled, refresh]);
  return { ...data, loading, error, refresh };
}
