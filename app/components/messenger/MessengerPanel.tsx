/**
 * MessengerPanel — slide-in staff chat panel that renders from the TopBar.
 *
 * Features:
 *  - Thread list with unread badges and last message preview
 *  - Single-thread view with message bubbles and auto-scroll
 *  - "New message" user picker to start a DM
 *  - Real-time updates via SSE (/api/messenger/sse)
 *  - Polled unread count badge on the TopBar icon
 */
"use client";

import {
  useEffect,
  useRef,
  useState,
  useCallback,
  type KeyboardEvent,
} from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";

// ─── Types ────────────────────────────────────────────────────────────────────

interface MsgUser {
  id: string;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  email: string;
}

interface MsgMessage {
  id: string;
  body: string;
  senderId: string;
  sender: { id: string; firstName: string; lastName: string; avatarUrl?: string | null };
  createdAt: string;
}

interface MsgThread {
  id: string;
  type: string;
  name: string | null;
  updatedAt: string;
  participants: Array<{ userId: string; user: MsgUser; lastReadAt: string | null }>;
  otherParticipants: MsgUser[];
  lastMessage: {
    id: string;
    body: string;
    senderId: string;
    senderName: string;
    createdAt: string;
  } | null;
  lastReadAt: string | null;
  unreadCount: number;
}

// ─── Avatar helper ────────────────────────────────────────────────────────────

function UserAvatar({ user, size = 32 }: { user: { firstName: string; lastName: string; avatarUrl?: string | null }; size?: number }) {
  const initials = `${user.firstName[0] ?? ""}${user.lastName[0] ?? ""}`.toUpperCase();
  if (user.avatarUrl) {
    return (
      <img
        src={user.avatarUrl}
        alt={`${user.firstName} ${user.lastName}`}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  const colors = ["bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-pink-500", "bg-teal-500"];
  const colorIndex = (user.firstName.charCodeAt(0) + user.lastName.charCodeAt(0)) % colors.length;
  return (
    <span
      className={`rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0 ${colors[colorIndex]}`}
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

// ─── Relative time ────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

// ─── MessengerPanel ───────────────────────────────────────────────────────────

export interface MessengerPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
}

export default function MessengerPanel({ open, onClose, onUnreadChange }: MessengerPanelProps) {
  const { user } = useAuth();
  const [threads, setThreads] = useState<MsgThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MsgMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [composing, setComposing] = useState("");
  const [sending, setSending] = useState(false);
  const [showNewDm, setShowNewDm] = useState(false);
  const [orgUsers, setOrgUsers] = useState<MsgUser[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const composeRef = useRef<HTMLTextAreaElement>(null);
  const sseRef = useRef<EventSource | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // ── Check plugin enabled ──────────────────────────────────────────────────

  useEffect(() => {
    apiFetch<{ enabled: boolean }>("/api/messenger/enabled")
      .then((d) => setEnabled(d.enabled))
      .catch(() => setEnabled(false));
  }, []);

  // ── Load thread list ──────────────────────────────────────────────────────

  const loadThreads = useCallback(async () => {
    try {
      const data = await apiFetch<{ threads: MsgThread[] }>("/api/messenger/threads");
      setThreads(data.threads ?? []);
      const totalUnread = (data.threads ?? []).reduce((s, t) => s + t.unreadCount, 0);
      onUnreadChange?.(totalUnread);
    } catch {
      // Keep existing state on error.
    }
  }, [onUnreadChange]);

  useEffect(() => {
    if (open && enabled) {
      void loadThreads();
    }
  }, [open, enabled, loadThreads]);

  // ── SSE connection ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !enabled) return;

    // Build SSE URL with credentials via cookie; use native EventSource.
    const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
    const es = new EventSource(`${apiBase}/api/messenger/sse`, { withCredentials: true });
    sseRef.current = es;

    es.addEventListener("message", (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data as string) as { threadId: string; message: MsgMessage };
        // Append to active thread if it matches.
        setActiveThreadId((current) => {
          if (current === payload.threadId) {
            setMessages((prev) => [...prev, payload.message]);
            // Mark read immediately since we're looking at this thread.
            void apiFetch(`/api/messenger/threads/${payload.threadId}/read`, { method: "PATCH" });
          }
          return current;
        });
        // Reload thread list to update badges.
        void loadThreads();
      } catch {
        // ignore malformed events
      }
    });

    return () => {
      es.close();
      sseRef.current = null;
    };
  }, [open, enabled, loadThreads]);

  // ── Load messages for active thread ──────────────────────────────────────

  useEffect(() => {
    if (!activeThreadId) return;
    setMessagesLoading(true);

    apiFetch<{ messages: MsgMessage[] }>(`/api/messenger/threads/${activeThreadId}/messages`)
      .then((d) => {
        setMessages(d.messages ?? []);
        // Mark as read.
        return apiFetch(`/api/messenger/threads/${activeThreadId}/read`, { method: "PATCH" });
      })
      .then(() => loadThreads())
      .catch(() => {})
      .finally(() => setMessagesLoading(false));
  }, [activeThreadId, loadThreads]);

  // ── Auto-scroll to bottom on new messages ────────────────────────────────

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Focus compose on thread open ─────────────────────────────────────────

  useEffect(() => {
    if (activeThreadId) {
      setTimeout(() => composeRef.current?.focus(), 80);
    }
  }, [activeThreadId]);

  // ── Close on outside click ────────────────────────────────────────────────

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e: PointerEvent) => {
      if (!panelRef.current?.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open, onClose]);

  // ── Send message ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    if (!composing.trim() || !activeThreadId || sending) return;
    const body = composing.trim();
    setComposing("");
    setSending(true);
    try {
      const { message } = await apiFetch<{ message: MsgMessage }>(
        `/api/messenger/threads/${activeThreadId}/messages`,
        { method: "POST", body: JSON.stringify({ body }) }
      );
      setMessages((prev) => [...prev, message]);
      void loadThreads();
    } catch {
      setComposing(body); // restore on failure
    } finally {
      setSending(false);
    }
  }, [composing, activeThreadId, sending, loadThreads]);

  const handleComposeKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  // ── Start new DM ──────────────────────────────────────────────────────────

  const openNewDm = useCallback(async () => {
    try {
      const { users } = await apiFetch<{ users: MsgUser[] }>("/api/messenger/users");
      setOrgUsers(users ?? []);
    } catch {
      setOrgUsers([]);
    }
    setShowNewDm(true);
    setUserSearch("");
  }, []);

  const startDm = useCallback(async (recipientId: string) => {
    try {
      const { thread } = await apiFetch<{ thread: MsgThread; created: boolean }>(
        "/api/messenger/threads",
        { method: "POST", body: JSON.stringify({ recipientId }) }
      );
      setShowNewDm(false);
      setUserSearch("");
      await loadThreads();
      setActiveThreadId(thread.id);
    } catch {
      // ignore
    }
  }, [loadThreads]);

  // ── Derived: active thread object ─────────────────────────────────────────

  const activeThread = threads.find((t) => t.id === activeThreadId) ?? null;
  const activeOtherUser = activeThread?.otherParticipants[0] ?? null;

  const filteredUsers = orgUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  const totalUnread = threads.reduce((s, t) => s + t.unreadCount, 0);

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!open) return null;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-2 top-[3.75rem] z-50 flex h-[calc(100dvh-4.25rem)] w-[calc(100vw-1rem)] max-w-[420px] flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_24px_60px_rgba(2,6,23,0.18)]"
        style={{ animation: "msgPanelIn 0.18s cubic-bezier(0.22,1,0.36,1)" }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        {activeThreadId ? (
          /* Thread view header */
          <div className="flex items-center gap-3 border-b border-slate-100 bg-white px-3 py-3">
            <button
              type="button"
              onClick={() => { setActiveThreadId(null); setMessages([]); setComposing(""); }}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {activeOtherUser && (
              <div className="relative flex-shrink-0">
                <UserAvatar user={activeOtherUser} size={36} />
                <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900">
                {activeThread?.otherParticipants.map((p) => `${p.firstName} ${p.lastName}`).join(", ") || activeThread?.name || "Thread"}
              </p>
              <p className="text-[11px] font-medium text-emerald-500">Active now</p>
            </div>
            <button
              type="button"
              title="Close"
              onClick={onClose}
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        ) : (
          /* Thread list header */
          <div className="flex items-center justify-between border-b border-slate-100 bg-white px-4 py-3.5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-white">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M6 19l-1.5-1.5A2.12 2.12 0 0 1 4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-2 2Z" />
                </svg>
              </div>
              <span className="text-[15px] font-bold text-slate-900">Messages</span>
              {totalUnread > 0 && (
                <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-bold text-white">
                  {Math.min(totalUnread, 99)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                title="New message"
                onClick={() => void openNewDm()}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </button>
              <button
                type="button"
                title="Close"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

        {/* ── Plugin disabled notice ─────────────────────────────────── */}
        {enabled === false && (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
              <svg className="w-7 h-7 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-slate-800">Messenger is disabled</p>
              <p className="mt-1 text-xs text-slate-500">An admin can enable it in Settings → Integrations.</p>
            </div>
          </div>
        )}

        {/* ── New DM picker ───────────────────────────────────────────── */}
        {enabled !== false && showNewDm && !activeThreadId && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-2.5">
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 focus-within:border-violet-400 focus-within:ring-2 focus-within:ring-violet-100 transition-all">
                <svg className="w-4 h-4 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  autoFocus
                  type="text"
                  placeholder="Search people…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="flex-1 bg-transparent text-sm text-slate-900 outline-none placeholder-slate-400"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredUsers.length === 0 && (
                <p className="px-4 py-8 text-center text-sm text-slate-400">No people found.</p>
              )}
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => void startDm(u.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-slate-50 active:bg-slate-100"
                >
                  <div className="relative flex-shrink-0">
                    <UserAvatar user={u} size={40} />
                    <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{u.firstName} {u.lastName}</p>
                    <p className="truncate text-xs text-slate-400">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-slate-100 px-4 py-2.5">
              <button
                type="button"
                onClick={() => { setShowNewDm(false); setUserSearch(""); }}
                className="text-xs font-medium text-slate-500 hover:text-slate-800"
              >
                ← Back to messages
              </button>
            </div>
          </div>
        )}

        {/* ── Thread list ─────────────────────────────────────────────── */}
        {enabled !== false && !showNewDm && !activeThreadId && (
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-50">
                  <svg className="w-8 h-8 text-violet-400" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M6 19l-1.5-1.5A2.12 2.12 0 0 1 4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-2 2Z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">No conversations yet</p>
                  <p className="mt-1 text-xs text-slate-500">Start messaging your teammates</p>
                </div>
                <button
                  type="button"
                  onClick={() => void openNewDm()}
                  className="mt-1 rounded-xl bg-violet-600 px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-violet-700"
                >
                  New Message
                </button>
              </div>
            )}
            {threads.map((thread) => {
              const otherUser = thread.otherParticipants[0];
              const displayName = thread.name
                ?? thread.otherParticipants.map((p) => `${p.firstName} ${p.lastName}`).join(", ")
                ?? "Thread";
              const hasUnread = thread.unreadCount > 0;
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-slate-50 active:bg-slate-100 ${hasUnread ? "bg-violet-50/40" : ""}`}
                >
                  <div className="relative flex-shrink-0">
                    {otherUser ? (
                      <UserAvatar user={otherUser} size={44} />
                    ) : (
                      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">G</span>
                    )}
                    <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className={`truncate text-sm ${hasUnread ? "font-bold text-slate-900" : "font-medium text-slate-700"}`}>
                        {displayName}
                      </p>
                      <span className="flex-shrink-0 text-[11px] text-slate-400">
                        {thread.lastMessage ? relativeTime(thread.lastMessage.createdAt) : ""}
                      </span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between gap-2">
                      <p className={`truncate text-xs ${hasUnread ? "font-medium text-slate-700" : "text-slate-400"}`}>
                        {thread.lastMessage
                          ? `${thread.lastMessage.senderId === user?.id ? "You: " : ""}${thread.lastMessage.body}`
                          : "No messages yet"}
                      </p>
                      {hasUnread && (
                        <span className="flex h-5 min-w-[20px] flex-shrink-0 items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold text-white">
                          {Math.min(thread.unreadCount, 99)}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* ── Active thread: messages + compose ───────────────────────── */}
        {enabled !== false && activeThreadId && (
          <>
            <div className="flex-1 overflow-y-auto bg-slate-50/50 px-4 py-4 space-y-1">
              {messagesLoading && (
                <div className="flex items-center justify-center py-8">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
                </div>
              )}
              {!messagesLoading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  {activeOtherUser && <UserAvatar user={activeOtherUser} size={48} />}
                  <p className="text-sm font-semibold text-slate-800">
                    {activeOtherUser ? `${activeOtherUser.firstName} ${activeOtherUser.lastName}` : ""}
                  </p>
                  <p className="text-xs text-slate-400">No messages yet — say hello!</p>
                </div>
              )}
              {messages.map((msg, idx) => {
                const isMe = msg.senderId === user?.id;
                const prevMsg = messages[idx - 1];
                const showAvatar = !isMe && (!prevMsg || prevMsg.senderId !== msg.senderId);
                const showTimestamp = !messages[idx + 1] || new Date(messages[idx + 1].createdAt).getTime() - new Date(msg.createdAt).getTime() > 60000 * 5;
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    {/* Avatar placeholder to maintain alignment for grouped messages */}
                    {!isMe && (
                      showAvatar
                        ? <div className="flex-shrink-0 self-end"><UserAvatar user={msg.sender} size={28} /></div>
                        : <div className="w-7 flex-shrink-0" />
                    )}
                    <div className={`flex flex-col max-w-[72%] ${isMe ? "items-end" : "items-start"}`}>
                      <div
                        className={`px-3.5 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          isMe
                            ? "rounded-2xl rounded-br-sm bg-blue-600 text-white shadow-sm"
                            : "rounded-2xl rounded-bl-sm bg-white text-slate-900 shadow-sm border border-slate-200/80"
                        }`}
                      >
                        {msg.body}
                      </div>
                      {showTimestamp && (
                        <p className={`mt-1 text-[10px] text-slate-400 ${isMe ? "text-right" : "text-left"}`}>
                          {relativeTime(msg.createdAt)}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose bar */}
            <div className="border-t border-slate-100 bg-white px-3 py-3">
              <div className="flex items-end gap-2">
                <div className="flex flex-1 items-end gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
                  <textarea
                    ref={composeRef}
                    rows={1}
                    value={composing}
                    onChange={(e) => setComposing(e.target.value)}
                    onKeyDown={handleComposeKeyDown}
                    placeholder="Aa"
                    className="flex-1 resize-none bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                    style={{ maxHeight: 120 }}
                    onInput={(e) => {
                      const el = e.currentTarget;
                      el.style.height = "auto";
                      el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={!composing.trim() || sending}
                  onClick={() => void sendMessage()}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:shadow-none"
                >
                  <svg className="w-4 h-4 translate-x-px" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Panel slide-in keyframe (inline style tag scoped to this component) */}
      <style>{`@keyframes msgPanelIn { from { opacity: 0; transform: translateY(6px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }`}</style>
    </>
  );
}
