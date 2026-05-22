// LiveCom Inbox tool: messenger-style conversation queue, thread, reply composer, and CRM context.
"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import StewardContextButton from "@/app/components/ai/StewardContextButton";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";
import { apiFetch } from "@/app/lib/auth-client";
import type { LiveComConversation, LiveComConversationStatus, LiveComInboxFilter } from "@/app/components/livecom/livecom-types";

const FILTERS: Array<{ id: LiveComInboxFilter; label: string }> = [
  { id: "ALL", label: "All" },
  { id: "UNREAD", label: "Unread" },
  { id: "NEW", label: "New" },
  { id: "OPEN", label: "Open" },
  { id: "WAITING_ON_DONOR", label: "Waiting" },
  { id: "RESOLVED", label: "Resolved" },
  { id: "ARCHIVED", label: "Archived" },
  { id: "SPAM", label: "Spam" },
];

const SAVED_REPLIES = [
  {
    label: "Donation Question",
    body: "Thank you for reaching out. You can give securely through our donation page, and we would be happy to answer any questions.",
  },
  {
    label: "Monthly Giving",
    body: "Monthly giving is a wonderful way to provide steady support. You can choose the monthly option on our giving form.",
  },
  {
    label: "Event Question",
    body: "Thanks for asking about our event. You can view event details and registration on our events page.",
  },
  {
    label: "Volunteer Interest",
    body: "We are grateful you are interested in volunteering. We can send you the next steps and connect you with the right person.",
  },
];

/** Renders LiveCom Inbox as a dedicated Messenger-style workspace tool. */
export default function LiveComInboxTool() {
  const routeSearchParams = useSearchParams();
  const [filter, setFilter] = useState<LiveComInboxFilter>("ALL");
  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<LiveComConversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [noteMode, setNoteMode] = useState(false);
  const [archiveReason, setArchiveReason] = useState("Resolved");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>("default");
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const didHydrateMessagesRef = useRef(false);
  const threadScrollRef = useRef<HTMLDivElement | null>(null);

  const requestedConversationId = routeSearchParams.get("conversationId");

  const playIncomingSound = useCallback(() => {
    if (!soundEnabled) return;
    try {
      const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) return;
      const audioContext = new AudioContextCtor();
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 720;
      gain.gain.value = 0.04;
      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      oscillator.start();
      oscillator.stop(audioContext.currentTime + 0.16);
    } catch {
      // Browsers can block audio until the user interacts with the page.
    }
  }, [soundEnabled]);

  const requestDesktopNotifications = useCallback(async () => {
    if (!("Notification" in window)) {
      setLiveNotice("This browser does not support desktop notifications.");
      return;
    }

    const permission = await Notification.requestPermission();
    setNotificationPermission(permission);
    setLiveNotice(permission === "granted" ? "LiveCom desktop notifications are on." : "Desktop notifications were not enabled.");
  }, []);

  const notifyIncomingMessage = useCallback((conversation: LiveComConversation) => {
    const visitorName = conversation.visitorName || "Website Visitor";
    setLiveNotice(`New LiveCom message from ${visitorName}`);
    playIncomingSound();
    if ("Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible") {
      new Notification(`LiveCom message from ${visitorName}`, {
        body: conversation.lastMessagePreview || "New website chat message",
        tag: `livecom-${conversation.id}`,
      });
    }
  }, [playIncomingSound]);

  const loadConversations = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "120");
      params.set("status", filter);
      if (search.trim()) params.set("search", search.trim());
      const rows = await apiFetch<LiveComConversation[]>(`/api/livecom/conversations?${params.toString()}`);
      const nextRows = Array.isArray(rows) ? rows : [];
      const previousMessageIds = knownMessageIdsRef.current;
      const nextMessageIds = new Set<string>();
      let incomingConversation: LiveComConversation | null = null;

      for (const conversation of nextRows) {
        for (const message of conversation.messages) {
          nextMessageIds.add(message.id);
          if (
            didHydrateMessagesRef.current
            && !incomingConversation
            && message.role === "visitor"
            && !previousMessageIds.has(message.id)
          ) {
            incomingConversation = conversation;
          }
        }
      }

      knownMessageIdsRef.current = nextMessageIds;
      if (didHydrateMessagesRef.current && incomingConversation) {
        notifyIncomingMessage(incomingConversation);
      }
      didHydrateMessagesRef.current = true;

      setConversations(nextRows);
      setSelectedId((current) => {
        if (current) return current;
        if (requestedConversationId && nextRows.some((row) => row.id === requestedConversationId)) return requestedConversationId;
        return nextRows[0]?.id ?? null;
      });
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load LiveCom conversations.");
      setConversations([]);
    } finally {
      if (!options?.silent) setLoading(false);
    }
  }, [filter, notifyIncomingMessage, requestedConversationId, search]);

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if ("Notification" in window) {
      setNotificationPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadConversations({ silent: true });
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadConversations]);

  const selected = useMemo(
    () => conversations.find((conversation) => conversation.id === selectedId) ?? conversations[0] ?? null,
    [conversations, selectedId],
  );

  const unreadCount = conversations.filter((conversation) => conversation.unread).length;
  const activeCount = conversations.filter((conversation) => !["RESOLVED", "ARCHIVED", "SPAM"].includes(conversation.status)).length;
  const hasSelectedConversation = Boolean(selected);

  function applySavedReply(label: string) {
    const selectedReply = SAVED_REPLIES.find((reply) => reply.label === label);
    if (!selectedReply) return;
    setReplyBody(selectedReply.body);
    setNoteMode(false);
  }

  function buildStewardDraftPrompt(style: "reply" | "warmer" | "shorter") {
    if (!selected) return "";
    const recentMessages = selected.messages
      .slice(-8)
      .map((message) => `${message.role}: ${message.body}`)
      .join("\n");
    const currentDraft = replyBody.trim()
      ? `\nCurrent staff draft to improve:\n${replyBody.trim()}`
      : "";
    const styleInstruction = style === "warmer"
      ? "Make the reply warmer, more empathetic, and still concise."
      : style === "shorter"
        ? "Make the reply shorter and clearer while preserving the next step."
        : "Draft a clear, friendly public reply staff can send in this LiveCom messenger.";

    return [
      "You are Steward writing inside the LiveCom Inbox.",
      styleInstruction,
      "Use nonprofit donor-care language. Do not invent private donor facts.",
      "Return only the message body, ready to paste into the reply composer.",
      "",
      `Visitor: ${selected.visitorName || "Website Visitor"}`,
      `Email: ${selected.visitorEmail || "not collected"}`,
      `Source page: ${selected.pageUrl || "unknown"}`,
      "",
      "Recent conversation:",
      recentMessages || "No messages available.",
      currentDraft,
    ].join("\n");
  }

  async function sendReply() {
    if (!selected || !replyBody.trim()) return;
    const conversationId = selected.id;
    const outgoingBody = replyBody.trim();
    const outgoingRole = noteMode ? "note" : "staff";
    const tempMessageId = `pending-${Date.now()}`;
    const optimisticMessage: LiveComConversation["messages"][number] = {
      id: tempMessageId,
      role: outgoingRole,
      body: outgoingBody,
      authorName: "You",
      createdAt: new Date().toISOString(),
      deliveryState: "sending",
    };
    setSaving(true);
    setReplyBody("");
    setConversations((current) => current.map((item) => item.id === conversationId
      ? {
          ...item,
          messages: [...item.messages, optimisticMessage],
          lastMessagePreview: outgoingBody,
          updatedAt: optimisticMessage.createdAt,
        }
      : item));
    try {
      const updated = await apiFetch<LiveComConversation>(`/api/livecom/conversations/${conversationId}/messages`, {
        method: "POST",
        body: JSON.stringify({
          role: outgoingRole,
          body: outgoingBody,
          status: outgoingRole === "note" ? selected.status : "WAITING_ON_DONOR",
        }),
      });
      setConversations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setError(null);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "Failed to send this LiveCom reply.");
      setReplyBody(outgoingBody);
      setConversations((current) => current.map((item) => item.id === conversationId
        ? {
            ...item,
            messages: item.messages.map((message) => message.id === tempMessageId ? { ...message, deliveryState: "failed" } : message),
          }
        : item));
    } finally {
      setSaving(false);
    }
  }

  function handleReplyKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendReply();
    }
  }

  async function updateConversation(status: LiveComConversationStatus, reason?: string) {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await apiFetch<LiveComConversation>(`/api/livecom/conversations/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          owner: selected.owner,
          assignedTo: selected.assignedTo,
          archiveReason: reason,
        }),
      });
      setConversations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setError(null);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "Failed to update this conversation.");
    } finally {
      setSaving(false);
    }
  }

  async function assignConversation(owner: string) {
    if (!selected) return;
    const updated = await apiFetch<LiveComConversation>(`/api/livecom/conversations/${selected.id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: selected.status === "NEW" ? "OPEN" : selected.status, owner, assignedTo: owner }),
    });
    setConversations((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  useEffect(() => {
    if (!selected?.id || !selected.unread) return;

    const selectedConversationId = selected.id;
    apiFetch<LiveComConversation>(`/api/livecom/conversations/${selectedConversationId}/read`, { method: "POST" })
      .then((updated) => {
        setConversations((current) => current.map((item) => item.id === selectedConversationId ? { ...item, ...updated, unread: false } : item));
      })
      .catch(() => {
        // Staff can still reply even if the read receipt fails.
      });
  }, [selected?.id, selected?.unread]);

  useEffect(() => {
    const node = threadScrollRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [selected?.id, selected?.messages.length]);

  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">Inbox</h2>
          <p className="mt-0.5 text-sm text-gray-500">Reply to website messages with a simple Messenger-style workflow.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <span className="rounded-md bg-green-100 px-2.5 py-2 text-center text-xs font-semibold text-green-700 sm:rounded-full sm:py-1">{unreadCount} unread</span>
          <span className="rounded-md bg-slate-100 px-2.5 py-2 text-center text-xs font-semibold text-slate-700 sm:rounded-full sm:py-1">{activeCount} active</span>
        </div>
      </div>

      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Inbox">
          <WorkspaceRibbonButton label="Refresh" onClick={() => void loadConversations()} disabled={loading} />
          <WorkspaceRibbonButton label="All" onClick={() => setFilter("ALL")} active={filter === "ALL"} />
          <WorkspaceRibbonButton label="Unread" onClick={() => setFilter("UNREAD")} active={filter === "UNREAD"} />
          <WorkspaceRibbonButton label="Clear" onClick={() => { setFilter("ALL"); setSearch(""); }} disabled={filter === "ALL" && !search.trim()} />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Queues">
          <WorkspaceRibbonButton label="New" onClick={() => setFilter("NEW")} active={filter === "NEW"} />
          <WorkspaceRibbonButton label="Open" onClick={() => setFilter("OPEN")} active={filter === "OPEN"} />
          <WorkspaceRibbonButton label="Waiting" onClick={() => setFilter("WAITING_ON_DONOR")} active={filter === "WAITING_ON_DONOR"} />
          <WorkspaceRibbonButton label="Archived" onClick={() => setFilter("ARCHIVED")} active={filter === "ARCHIVED"} />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Conversation">
          <WorkspaceRibbonButton label="Public Reply" onClick={() => setNoteMode(false)} active={!noteMode} disabled={!hasSelectedConversation} />
          <WorkspaceRibbonButton label="Internal Note" onClick={() => setNoteMode(true)} active={noteMode} disabled={!hasSelectedConversation} accentTone="amber" />
          <WorkspaceRibbonButton label="Resolve" onClick={() => void updateConversation("RESOLVED")} disabled={!hasSelectedConversation || saving} />
          <WorkspaceRibbonButton label="Archive" onClick={() => void updateConversation("ARCHIVED", archiveReason)} disabled={!hasSelectedConversation || saving} />
          <WorkspaceRibbonButton label="Reopen" onClick={() => void updateConversation("OPEN")} disabled={!hasSelectedConversation || saving || selected?.status === "OPEN"} />
          <WorkspaceRibbonButton label="Spam" onClick={() => void updateConversation("SPAM", "Spam")} disabled={!hasSelectedConversation || saving} variant="danger" />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Notifications">
          <WorkspaceRibbonButton
            label={notificationPermission === "granted" ? "Desktop On" : "Desktop Alerts"}
            onClick={() => void requestDesktopNotifications()}
            active={notificationPermission === "granted"}
          />
          <WorkspaceRibbonButton
            label={soundEnabled ? "Sound On" : "Sound Off"}
            onClick={() => setSoundEnabled((current) => !current)}
            active={soundEnabled}
          />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="Saved Replies">
          <WorkspaceRibbonButton label="Donation" onClick={() => applySavedReply("Donation Question")} disabled={!hasSelectedConversation} />
          <WorkspaceRibbonButton label="Monthly" onClick={() => applySavedReply("Monthly Giving")} disabled={!hasSelectedConversation} />
          <WorkspaceRibbonButton label="Event" onClick={() => applySavedReply("Event Question")} disabled={!hasSelectedConversation} />
          <WorkspaceRibbonButton label="Volunteer" onClick={() => applySavedReply("Volunteer Interest")} disabled={!hasSelectedConversation} />
        </WorkspaceRibbonGroup>
        <WorkspaceRibbonGroup label="LiveCom">
          <WorkspaceRibbonButton label="Widget Setup" href="/settings/site-embeds" />
          <WorkspaceRibbonButton label="Embed Test" href="/livecom/embed-test" />
          <WorkspaceRibbonButton label="Open Donor" href={selected?.constituentId ? `/constituents/${selected.constituentId}` : undefined} disabled={!selected?.constituentId} />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      {liveNotice && (
        <div className="flex flex-col gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800 sm:flex-row sm:items-center sm:justify-between">
          <span>{liveNotice}</span>
          <button type="button" onClick={() => setLiveNotice(null)} className="self-start rounded-md px-2 py-1 text-xs font-semibold text-green-700 hover:bg-green-100 sm:self-auto">
            Dismiss
          </button>
        </div>
      )}

      {error && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <section className="grid min-h-0 min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ring-1 ring-gray-100 xl:h-[calc(100dvh-300px)] xl:min-h-[560px] xl:max-h-[820px] xl:grid-cols-[300px_minmax(0,1fr)] 2xl:grid-cols-[320px_minmax(0,1fr)_300px]">
        <aside className="flex min-h-0 min-w-0 flex-col border-b border-gray-200 bg-white xl:border-b-0 xl:border-r">
          <div className="shrink-0 space-y-3 border-b border-gray-200 bg-gradient-to-b from-gray-50 to-white p-3 sm:p-4 xl:p-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search Messenger"
              className="h-10 w-full rounded-full border border-gray-300 bg-white px-4 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
            />
            <div className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
              {FILTERS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`min-h-8 shrink-0 rounded-full px-3 py-1 text-xs font-medium ${filter === item.id ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto">
            {loading && <p className="p-4 text-sm text-gray-500">Loading conversations...</p>}
            {!loading && conversations.length === 0 && <p className="p-4 text-sm text-gray-500">No conversations match this view.</p>}
            {conversations.map((conversation) => (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setSelectedId(conversation.id)}
                className={`grid min-h-[92px] w-full grid-cols-[42px_minmax(0,1fr)] gap-3 border-b border-gray-100 px-3 py-3 text-left transition-colors hover:bg-gray-50 sm:px-4 xl:px-3 ${selected?.id === conversation.id ? "bg-green-50 shadow-[inset_3px_0_0_#16a34a]" : "bg-white"}`}
              >
                <Avatar name={conversation.visitorName || "Website Visitor"} unread={conversation.unread} />
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-gray-900">{conversation.visitorName || "Website Visitor"}</p>
                    <span className="shrink-0 text-[11px] text-gray-500">{formatRelativeTime(conversation.updatedAt)}</span>
                  </div>
                  <p className="mt-0.5 line-clamp-2 text-xs text-gray-600">{conversation.lastMessagePreview}</p>
                  <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1">
                    <StatusBadge status={conversation.status} />
                    <span className="max-w-full truncate rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-600">{conversation.assignedTo || "Unassigned"}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className="flex min-h-[560px] min-w-0 flex-col overflow-hidden bg-white xl:min-h-0">
          {selected ? (
            <>
              <div className="shrink-0 border-b border-gray-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={selected.visitorName || "Website Visitor"} unread={selected.unread} />
                    <div className="min-w-0">
                      <h2 className="truncate text-sm font-semibold text-gray-900">{selected.visitorName || "Website Visitor"}</h2>
                      <p className="mt-0.5 truncate text-xs text-gray-500">{selected.sourceWebsite || "Website"} · {selected.pageUrl || "LiveCom conversation"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 sm:flex">
                    <StatusBadge status={selected.status} />
                    <button type="button" onClick={() => void updateConversation(selected.status === "RESOLVED" ? "OPEN" : "RESOLVED")} className="min-h-9 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      {selected.status === "RESOLVED" ? "Reopen" : "Resolve"}
                    </button>
                    <button type="button" onClick={() => void updateConversation(selected.status === "ARCHIVED" ? "OPEN" : "ARCHIVED", archiveReason)} className="min-h-9 rounded-full border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">
                      {selected.status === "ARCHIVED" ? "Reopen" : "Archive"}
                    </button>
                  </div>
                </div>
              </div>

              <div
                ref={threadScrollRef}
                className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-white via-gray-50 to-white px-3 py-4 sm:px-5"
              >
                {selected.messages.map((message) => (
                  <MessageBubble key={message.id} message={message} />
                ))}
              </div>

              <div className="shrink-0 border-t border-gray-200 bg-white p-3 shadow-[0_-8px_24px_rgba(15,23,42,0.04)] sm:p-4">
                <div className="mb-2 grid gap-2 sm:flex sm:flex-wrap sm:items-center">
                  <div className="grid grid-cols-2 gap-1 rounded-full bg-gray-100 p-1 sm:w-auto">
                    <button type="button" onClick={() => setNoteMode(false)} className={`min-h-8 rounded-full px-3 py-1 text-xs font-medium ${!noteMode ? "bg-white text-green-700 shadow-sm" : "text-gray-600 hover:bg-white"}`}>Public Reply</button>
                    <button type="button" onClick={() => setNoteMode(true)} className={`min-h-8 rounded-full px-3 py-1 text-xs font-medium ${noteMode ? "bg-white text-amber-700 shadow-sm" : "text-gray-600 hover:bg-white"}`}>Internal Note</button>
                  </div>
                  <select
                    onChange={(event) => {
                      const selectedReply = SAVED_REPLIES.find((reply) => reply.label === event.target.value);
                      if (selectedReply) setReplyBody(selectedReply.body);
                      event.target.value = "";
                    }}
                    className="h-9 min-w-0 rounded-full border border-gray-300 px-3 text-xs text-gray-700 sm:min-w-36"
                    defaultValue=""
                  >
                    <option value="">Saved replies</option>
                    {SAVED_REPLIES.map((reply) => <option key={reply.label} value={reply.label}>{reply.label}</option>)}
                  </select>
                  <select value={archiveReason} onChange={(event) => setArchiveReason(event.target.value)} className="h-9 min-w-0 rounded-full border border-gray-300 px-3 text-xs text-gray-700 sm:min-w-32">
                    <option>Resolved</option>
                    <option>Duplicate</option>
                    <option>Spam</option>
                    <option>No response</option>
                    <option>Not relevant</option>
                    <option>Other</option>
                  </select>
                  <div className="flex min-w-0 flex-wrap items-center gap-1">
                    <StewardContextButton
                      label="Draft Reply"
                      prompt={buildStewardDraftPrompt("reply")}
                      moduleKey="donor"
                      mode="draft"
                      variant="mini"
                      disabled={!selected}
                    />
                    <StewardContextButton
                      label="Warmer"
                      prompt={buildStewardDraftPrompt("warmer")}
                      moduleKey="donor"
                      mode="draft"
                      variant="mini"
                      disabled={!selected}
                    />
                    <StewardContextButton
                      label="Shorten"
                      prompt={buildStewardDraftPrompt("shorter")}
                      moduleKey="donor"
                      mode="draft"
                      variant="mini"
                      disabled={!selected}
                    />
                  </div>
                </div>
                <div className="flex items-end gap-2 rounded-2xl bg-gray-100 p-2">
                  <textarea
                    value={replyBody}
                    onChange={(event) => setReplyBody(event.target.value)}
                    onKeyDown={handleReplyKeyDown}
                    placeholder={noteMode ? "Add an internal note..." : "Aa"}
                    className="max-h-28 min-h-12 flex-1 resize-none border-0 bg-transparent px-2 py-2 text-sm outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => void sendReply()}
                    disabled={saving || !replyBody.trim()}
                    className="min-h-10 rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving ? "Sending..." : noteMode ? "Note" : "Send"}
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-gray-400">Enter sends. Shift+Enter adds a new line.</p>
              </div>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-gray-500">Select a conversation.</div>
          )}
        </main>

        <aside className="min-h-0 min-w-0 overflow-y-auto border-t border-gray-200 bg-gradient-to-b from-gray-50 to-white p-3 sm:p-4 xl:hidden 2xl:col-span-1 2xl:block 2xl:border-l 2xl:border-t-0">
          <h2 className="text-sm font-semibold text-gray-900">Contact Details</h2>
          {selected ? (
            <div className="mt-3 grid gap-3 lg:grid-cols-2 2xl:block 2xl:space-y-4">
              <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
                <div className="flex items-center gap-3">
                  <Avatar name={selected.visitorName || "Website Visitor"} unread={false} />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-gray-900">{selected.visitorName || "Unknown"}</p>
                    <p className="truncate text-sm text-gray-600">{selected.visitorEmail || "Email not collected"}</p>
                  </div>
                </div>
                <p className="mt-3 text-sm text-gray-600">{selected.visitorPhone || "Phone not collected"}</p>
              </div>
              <div className="grid gap-2">
                {selected.constituentId ? (
                  <Link href={`/constituents/${selected.constituentId}`} className="min-h-10 rounded-md bg-green-600 px-3 py-2 text-center text-sm font-semibold text-white hover:bg-green-700">
                    Open Linked Donor
                  </Link>
                ) : (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 text-sm text-amber-900">
                    <p className="font-semibold">Donor linking is still in progress.</p>
                    <p className="mt-1 text-xs text-amber-800">
                      This conversation is not linked to a donor yet. Use the conversation context for replies today; donor-link, follow-up task, and tag actions are being finished before they return here.
                    </p>
                  </div>
                )}
              </div>
              <label className="block text-xs font-medium text-gray-600">
                Assigned to
                <input
                  value={selected.assignedTo || ""}
                  onChange={(event) => {
                    const value = event.target.value;
                    setConversations((current) => current.map((item) => item.id === selected.id ? { ...item, assignedTo: value, owner: value } : item));
                  }}
                  onBlur={(event) => void assignConversation(event.target.value.trim() || "Unassigned")}
                  className="mt-1 h-10 w-full rounded-md border border-gray-300 bg-white px-2 text-sm outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100"
                />
              </label>
              <div className="rounded-md bg-white p-3 text-xs text-gray-600 ring-1 ring-gray-200">
                <p><span className="font-semibold">Started:</span> {formatDateTime(selected.startedAt)}</p>
                <p><span className="font-semibold">Last message:</span> {formatDateTime(selected.updatedAt)}</p>
                {selected.resolvedAt && <p><span className="font-semibold">Resolved:</span> {formatDateTime(selected.resolvedAt)}</p>}
                {selected.archivedAt && <p><span className="font-semibold">Archived:</span> {formatDateTime(selected.archivedAt)}</p>}
                {selected.archiveReason && <p><span className="font-semibold">Archive reason:</span> {selected.archiveReason}</p>}
                <p><span className="font-semibold">Assigned:</span> {selected.assignedTo || "Unassigned"}</p>
                <p><span className="font-semibold">Source:</span> {selected.sourceWebsite}</p>
              </div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-gray-500">No conversation selected.</p>
          )}
        </aside>
      </section>
    </div>
  );
}

function Avatar({ name, unread }: { name: string; unread: boolean }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "WV";
  return (
    <span className="relative inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-700 text-xs font-bold text-white shadow-sm">
      {initials}
      {unread && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-green-400" />}
    </span>
  );
}

function MessageBubble({ message }: { message: LiveComConversation["messages"][number] }) {
  if (message.role === "system") {
    return <p className="text-center text-xs text-gray-500">{message.body}</p>;
  }
  const isVisitor = message.role === "visitor";
  const isNote = message.role === "note";
  return (
    <div className={`flex ${isVisitor ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[92%] rounded-2xl px-3 py-2 text-sm shadow-sm sm:max-w-[78%] ${
        isNote
          ? "bg-amber-50 text-amber-900 ring-1 ring-amber-200"
          : isVisitor
            ? "bg-gray-100 text-gray-900"
            : "bg-green-600 text-white"
      }`}>
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <p className={`mt-1 text-[10px] ${isVisitor || isNote ? "text-gray-500" : "text-green-100"}`}>
          {message.authorName} · {formatRelativeTime(message.createdAt)}
          {message.deliveryState === "sending" ? " · Sending" : ""}
          {message.deliveryState === "failed" ? " · Failed, press Send to retry" : ""}
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: LiveComConversationStatus }) {
  const label = status.replace(/_/g, " ").toLowerCase();
  const tone = status === "NEW"
    ? "bg-green-100 text-green-700"
    : status === "OPEN"
      ? "bg-blue-100 text-blue-700"
      : status === "WAITING_ON_DONOR"
        ? "bg-amber-100 text-amber-700"
        : status === "ARCHIVED" || status === "SPAM"
          ? "bg-slate-200 text-slate-700"
          : "bg-gray-100 text-gray-700";
  return <span className={`inline-flex min-h-6 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${tone}`}>{label}</span>;
}

function formatRelativeTime(value: string): string {
  const elapsedMs = Date.now() - new Date(value).getTime();
  const elapsedMinutes = Math.max(1, Math.floor(elapsedMs / 60000));
  if (elapsedMinutes < 60) return `${elapsedMinutes} min`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `${elapsedHours} hr`;
  return `${Math.floor(elapsedHours / 24)} d`;
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}
