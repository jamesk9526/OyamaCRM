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

  const filteredUsers = orgUsers.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      u.firstName.toLowerCase().includes(q) ||
      u.lastName.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  // ── Render ─────────────────────────────────────────────────────────────────

  if (!open) return null;

  return (
    <>
      {/* Backdrop (mobile) */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="fixed right-2 top-[3.75rem] z-50 flex h-[calc(100vh-4.25rem)] w-[calc(100vw-1rem)] max-w-[380px] flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl"
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-white px-4 py-3">
          {activeThreadId ? (
            <button
              type="button"
              onClick={() => { setActiveThreadId(null); setMessages([]); setComposing(""); }}
              className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 hover:text-gray-950"
            >
              <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              {activeThread
                ? activeThread.otherParticipants.map((p) => `${p.firstName} ${p.lastName}`).join(", ") || activeThread.name || "Thread"
                : "Back"}
            </button>
          ) : (
            <span className="text-sm font-semibold text-gray-900">Messages</span>
          )}
          <div className="flex items-center gap-1">
            {!activeThreadId && (
              <button
                type="button"
                title="New message"
                onClick={() => void openNewDm()}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" />
                </svg>
              </button>
            )}
            <button
              type="button"
              title="Close"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Plugin disabled notice ─────────────────────────────────── */}
        {enabled === false && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-gray-500">
            <svg className="w-8 h-8 text-gray-300" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            <p className="font-medium text-gray-700">Messenger is disabled</p>
            <p className="text-xs text-gray-400">An admin can enable it in Settings → Integrations.</p>
          </div>
        )}

        {/* ── New DM picker ───────────────────────────────────────────── */}
        {enabled !== false && showNewDm && !activeThreadId && (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="border-b border-gray-100 px-4 py-2.5">
              <input
                autoFocus
                type="text"
                placeholder="Search people…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {filteredUsers.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-gray-400">No users found.</p>
              )}
              {filteredUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => void startDm(u.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  <UserAvatar user={u} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{u.firstName} {u.lastName}</p>
                    <p className="truncate text-xs text-gray-400">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="border-t border-gray-100 px-4 py-2.5">
              <button
                type="button"
                onClick={() => { setShowNewDm(false); setUserSearch(""); }}
                className="text-xs font-medium text-gray-500 hover:text-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* ── Thread list ─────────────────────────────────────────────── */}
        {enabled !== false && !showNewDm && !activeThreadId && (
          <div className="flex-1 overflow-y-auto">
            {threads.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-2 py-12 px-6 text-center">
                <svg className="w-9 h-9 text-gray-200" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h8M8 14h5M6 19l-1.5-1.5A2.12 2.12 0 0 1 4 16V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H8l-2 2Z" />
                </svg>
                <p className="text-sm font-medium text-gray-500">No conversations yet</p>
                <button
                  type="button"
                  onClick={() => void openNewDm()}
                  className="mt-1 rounded-lg bg-slate-900 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  Start a conversation
                </button>
              </div>
            )}
            {threads.map((thread) => {
              const otherUser = thread.otherParticipants[0];
              const displayName = thread.name
                ?? thread.otherParticipants.map((p) => `${p.firstName} ${p.lastName}`).join(", ")
                ?? "Thread";
              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => setActiveThreadId(thread.id)}
                  className="flex w-full items-center gap-3 border-b border-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
                >
                  {otherUser ? (
                    <UserAvatar user={otherUser} size={40} />
                  ) : (
                    <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gray-200 text-sm font-semibold text-gray-500">
                      G
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`truncate text-sm ${thread.unreadCount > 0 ? "font-semibold text-gray-900" : "font-medium text-gray-700"}`}>
                        {displayName}
                      </p>
                      <span className="shrink-0 text-[11px] text-gray-400">
                        {thread.lastMessage ? relativeTime(thread.lastMessage.createdAt) : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      <p className="truncate text-xs text-gray-400">
                        {thread.lastMessage
                          ? `${thread.lastMessage.senderId === user?.id ? "You: " : ""}${thread.lastMessage.body}`
                          : "No messages yet"}
                      </p>
                      {thread.unreadCount > 0 && (
                        <span className="flex h-4 min-w-[16px] shrink-0 items-center justify-center rounded-full bg-slate-800 px-1 text-[10px] font-bold text-white">
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
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {messagesLoading && (
                <p className="text-center text-xs text-gray-400 py-4">Loading messages…</p>
              )}
              {!messagesLoading && messages.length === 0 && (
                <p className="text-center text-xs text-gray-400 py-4">No messages yet. Say hello!</p>
              )}
              {messages.map((msg) => {
                const isMe = msg.senderId === user?.id;
                return (
                  <div key={msg.id} className={`flex items-end gap-2 ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                    {!isMe && (
                      <UserAvatar user={msg.sender} size={26} />
                    )}
                    <div className={`group max-w-[75%]`}>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                          isMe
                            ? "rounded-br-sm bg-slate-900 text-white"
                            : "rounded-bl-sm bg-gray-100 text-gray-900"
                        }`}
                      >
                        {msg.body}
                      </div>
                      <p className={`mt-0.5 text-[10px] text-gray-400 ${isMe ? "text-right" : "text-left"}`}>
                        {relativeTime(msg.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Compose bar */}
            <div className="border-t border-gray-100 bg-white px-3 py-2.5">
              <div className="flex items-end gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 focus-within:border-slate-400 focus-within:ring-1 focus-within:ring-slate-200 transition-all">
                <textarea
                  ref={composeRef}
                  rows={1}
                  value={composing}
                  onChange={(e) => setComposing(e.target.value)}
                  onKeyDown={handleComposeKeyDown}
                  placeholder="Message… (Enter to send)"
                  className="flex-1 resize-none bg-transparent text-sm text-gray-900 placeholder-gray-400 outline-none"
                  style={{ maxHeight: 120 }}
                  onInput={(e) => {
                    const el = e.currentTarget;
                    el.style.height = "auto";
                    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
                  }}
                />
                <button
                  type="button"
                  disabled={!composing.trim() || sending}
                  onClick={() => void sendMessage()}
                  className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white transition-opacity disabled:opacity-40 hover:bg-slate-700"
                >
                  <svg className="w-3.5 h-3.5 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z" />
                  </svg>
                </button>
              </div>
              <p className="mt-1.5 text-right text-[10px] text-gray-400">Shift+Enter for new line</p>
            </div>
          </>
        )}
      </div>
    </>
  );
}
