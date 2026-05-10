/** StewardChatPanel is the right-side AI workspace for chat, tools, and safe action prompts. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import StewardMessageRenderer from "@/app/components/ai/StewardMessageRenderer";

type ModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster";
type ChatMode = "ask" | "analyze" | "draft" | "action" | "help";
type StewardChatDisplayMode = "dock" | "workspace";

export interface StewardTraceSnapshot {
  id: string;
  createdAt: string;
  moduleKey: ModuleKey;
  scopePath: string;
  mode: ChatMode;
  runtimeMode: "local" | "remote" | "unknown";
  provider: string;
  model: string;
  toolsUsed: string[];
  recordsUsed: string[];
}

interface StewardChatPanelProps {
  open: boolean;
  onClose: () => void;
  moduleKey: ModuleKey;
  scopePath: string;
  displayMode?: StewardChatDisplayMode;
  onTraceUpdate?: (trace: StewardTraceSnapshot) => void;
}

interface AiConfigPayload {
  enabled: boolean;
  mode: "local" | "remote";
  endpointUrl: string;
  model: string;
}

interface UiMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  toolsUsed?: string[];
  recordsUsed?: string[];
  provider?: string;
  responseMode?: ChatMode;
  runtimeMode?: "local" | "remote" | "unknown";
}

interface StewardChatStreamChunk {
  type: "chunk";
  delta: string;
}

interface StewardChatStreamDone {
  type: "done";
  reply: string;
  model: string;
  mode: ChatMode;
  runtimeMode?: "local" | "remote";
  provider: string;
  toolsUsed: string[];
  recordsUsed?: string[];
  moduleKey?: ModuleKey;
  scopePath?: string;
}

interface StewardChatStreamError {
  type: "error";
  message: string;
}

type StewardChatStreamEvent = StewardChatStreamChunk | StewardChatStreamDone | StewardChatStreamError;

const CHAT_HISTORY_LIMIT = 60;
const CHAT_THREAD_LIMIT = 20;

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: UiMessage[];
}

/** Returns legacy localStorage key used by the previous single-thread chat history model. */
function legacyChatStorageKey(moduleKey: ModuleKey): string {
  return `steward-chat-history:v1:${moduleKey}`;
}

/** Returns localStorage key for multi-thread Steward chat history persistence. */
function chatThreadsStorageKey(moduleKey: ModuleKey): string {
  return `steward-chat-threads:v1:${moduleKey}`;
}

/** Normalizes stored message payloads into trusted UiMessage records. */
function normalizeStoredMessages(messages: unknown): UiMessage[] {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) => message && typeof message === "object")
    .map((message) => {
      const candidate = message as Partial<UiMessage>;
      return {
        id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : crypto.randomUUID(),
        role: candidate.role === "assistant" ? "assistant" : "user",
        content: typeof candidate.content === "string" ? candidate.content : "",
        createdAt: typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
          ? candidate.createdAt
          : new Date().toISOString(),
        toolsUsed: Array.isArray(candidate.toolsUsed)
          ? candidate.toolsUsed.filter((item): item is string => typeof item === "string")
          : undefined,
        recordsUsed: Array.isArray(candidate.recordsUsed)
          ? candidate.recordsUsed.filter((item): item is string => typeof item === "string")
          : undefined,
        provider: typeof candidate.provider === "string" ? candidate.provider : undefined,
        responseMode: ["ask", "analyze", "draft", "action", "help"].includes(String(candidate.responseMode))
          ? candidate.responseMode as ChatMode
          : undefined,
        runtimeMode: candidate.runtimeMode === "local" || candidate.runtimeMode === "remote" || candidate.runtimeMode === "unknown"
          ? candidate.runtimeMode
          : undefined,
      };
    })
    .filter((message) => message.content.trim().length > 0 || message.role === "assistant")
    .slice(-CHAT_HISTORY_LIMIT);
}

/** Infers a thread title from the first user prompt, with a stable fallback. */
function inferThreadTitle(messages: UiMessage[], fallbackTitle: string): string {
  const firstUserPrompt = messages.find((message) => message.role === "user" && message.content.trim().length > 0);
  if (!firstUserPrompt) return fallbackTitle;

  const normalized = firstUserPrompt.content.replace(/\s+/g, " ").trim();
  if (!normalized) return fallbackTitle;
  return normalized.length > 40 ? `${normalized.slice(0, 40)}...` : normalized;
}

/** Reads legacy single-thread messages so existing users keep their chat history after migration. */
function readLegacyStoredMessages(moduleKey: ModuleKey): UiMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(legacyChatStorageKey(moduleKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return normalizeStoredMessages(parsed);
  } catch {
    return [];
  }
}

/** Safely parses persisted multi-thread chat history from localStorage with legacy migration fallback. */
function readStoredThreads(moduleKey: ModuleKey): ChatThread[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(chatThreadsStorageKey(moduleKey));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        const now = new Date().toISOString();
        return parsed
          .filter((thread) => thread && typeof thread === "object")
          .map((thread, index) => {
            const candidate = thread as Partial<ChatThread>;
            const fallbackTitle = `Chat ${index + 1}`;
            const normalizedMessages = normalizeStoredMessages(candidate.messages);

            return {
              id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : crypto.randomUUID(),
              title: typeof candidate.title === "string" && candidate.title.trim().length > 0
                ? candidate.title
                : inferThreadTitle(normalizedMessages, fallbackTitle),
              createdAt: typeof candidate.createdAt === "string" && candidate.createdAt.length > 0 ? candidate.createdAt : now,
              updatedAt: typeof candidate.updatedAt === "string" && candidate.updatedAt.length > 0 ? candidate.updatedAt : now,
              messages: normalizedMessages,
            };
          })
          .slice(0, CHAT_THREAD_LIMIT);
      }
    }
  } catch {
    // Falls through to legacy migration path.
  }

  const legacyMessages = readLegacyStoredMessages(moduleKey);
  if (legacyMessages.length === 0) return [];

  const now = new Date().toISOString();
  return [
    {
      id: crypto.randomUUID(),
      title: inferThreadTitle(legacyMessages, "Chat 1"),
      createdAt: now,
      updatedAt: now,
      messages: legacyMessages,
    },
  ];
}

/** Persists bounded multi-thread chat history to localStorage for the current module. */
function writeStoredThreads(moduleKey: ModuleKey, threads: ChatThread[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chatThreadsStorageKey(moduleKey), JSON.stringify(threads.slice(0, CHAT_THREAD_LIMIT)));
}

const MODE_BUTTONS: Array<{ key: ChatMode; label: string }> = [
  { key: "ask", label: "Ask" },
  { key: "analyze", label: "Analyze" },
  { key: "draft", label: "Draft" },
  { key: "action", label: "Action" },
  { key: "help", label: "Help" },
];

const STEWARD_READY_MESSAGE = "Steward is ready with CRM retrieval tools. Ask, analyze, draft, or action with explicit confirmation for writes.";
const STEWARD_DISABLED_MESSAGE = "Steward AI is not enabled yet. Open Settings > AI Assistant to configure local or remote Ollama.";

/** Returns starter prompts based on current CRM module context. */
function promptsForModule(moduleKey: ModuleKey): string[] {
  if (moduleKey === "compassion") {
    return [
      "Summarize this client context from visible page details.",
      "What follow-ups should happen this week?",
      "Draft a client-safe appointment reminder.",
    ];
  }

  if (moduleKey === "events") {
    return [
      "Summarize event operations status.",
      "What check-in risks should staff watch today?",
      "Draft a post-event thank-you message.",
    ];
  }

  if (moduleKey === "watchdog") {
    return [
      "Summarize high-risk security events in this view.",
      "Draft an incident response checklist for this alert.",
      "What access controls should I verify first?",
    ];
  }

  if (moduleKey === "webmaster") {
    return [
      "Propose a nonprofit website information architecture.",
      "Draft homepage copy for donor conversion.",
      "What pages should we launch first and why?",
    ];
  }

  return [
    "Summarize what I should focus on today.",
    "Identify likely lapsed-donor follow-ups.",
    "Draft a donor stewardship check-in email.",
  ];
}

/** Builds a new empty chat thread shell with a stable timestamp and title. */
function buildEmptyThread(title: string): ChatThread {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

/** StewardChatPanel renders either a docked panel or a full workspace chat experience. */
export default function StewardChatPanel({
  open,
  onClose,
  moduleKey,
  scopePath,
  displayMode = "dock",
  onTraceUpdate,
}: StewardChatPanelProps) {
  const [aiConfig, setAiConfig] = useState<AiConfigPayload | null>(null);
  const [mode, setMode] = useState<ChatMode>("ask");
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [threadsHydrated, setThreadsHydrated] = useState(false);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<string | null>(null);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const isWorkspaceMode = displayMode === "workspace";
  const promptChips = useMemo(() => promptsForModule(moduleKey), [moduleKey]);
  const workspaceHref = useMemo(() => {
    const params = new URLSearchParams({
      module: moduleKey,
      scope: scopePath,
    });
    return `/steward-ai-workspace?${params.toString()}`;
  }, [moduleKey, scopePath]);
  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === activeThreadId) ?? null,
    [threads, activeThreadId]
  );
  const orderedThreads = useMemo(
    () => [...threads].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [threads]
  );

  /** Auto-scrolls to latest message whenever conversation changes. */
  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /** Loads persisted thread history when module changes. */
  useEffect(() => {
    setThreadsHydrated(false);

    const stored = readStoredThreads(moduleKey);
    const initialThreads = stored.length > 0 ? stored : [buildEmptyThread("Chat 1")];
    const initialThread = initialThreads[0];

    setThreads(initialThreads);
    setActiveThreadId(initialThread.id);
    setMessages(initialThread.messages);
    setDraft("");
    setThreadsHydrated(true);
  }, [moduleKey]);

  /** Persists updated active-thread messages in local thread state. */
  useEffect(() => {
    if (!threadsHydrated || !activeThreadId) return;

    setThreads((current) => current.map((thread) => {
      if (thread.id !== activeThreadId) return thread;
      return {
        ...thread,
        title: inferThreadTitle(messages, thread.title),
        updatedAt: new Date().toISOString(),
        messages: messages.slice(-CHAT_HISTORY_LIMIT),
      };
    }));
  }, [messages, activeThreadId, threadsHydrated]);

  /** Persists multi-thread chat history whenever thread state changes. */
  useEffect(() => {
    if (!threadsHydrated) return;
    writeStoredThreads(moduleKey, threads);
  }, [moduleKey, threads, threadsHydrated]);

  /** Handles keyboard close shortcuts while panel is open. */
  useEffect(() => {
    if (!open || isWorkspaceMode) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, isWorkspaceMode]);

  /** Loads AI config each time panel opens so status is always current. */
  useEffect(() => {
    if (!open && !isWorkspaceMode) return;

    let cancelled = false;

    async function loadConfig() {
      setLoadingConfig(true);
      setError(null);
      try {
        const response = await apiFetch<AiConfigPayload>("/api/steward-ai/config");
        if (cancelled) return;
        setAiConfig(response);

        setMessages((current) => {
          const sanitized = response.enabled
            ? current.filter((message) => !(message.role === "assistant" && message.content === STEWARD_DISABLED_MESSAGE))
            : current;

          if (sanitized.length > 0) {
            return sanitized;
          }

          return [
            {
              id: crypto.randomUUID(),
              role: "assistant",
              createdAt: new Date().toISOString(),
              content: response.enabled ? STEWARD_READY_MESSAGE : STEWARD_DISABLED_MESSAGE,
            },
          ];
        });
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Failed to load Steward config.");
      } finally {
        if (!cancelled) setLoadingConfig(false);
      }
    }

    void loadConfig();
    return () => {
      cancelled = true;
    };
  }, [open, isWorkspaceMode]);

  /** Sends message on Enter while preserving Shift+Enter for multi-line drafts. */
  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    if (!sending && draft.trim()) {
      void sendMessage();
    }
  }

  /** Activates a selected chat thread and restores its conversation context. */
  function switchActiveThread(threadId: string) {
    if (!threadId || threadId === activeThreadId) return;
    const nextThread = threads.find((thread) => thread.id === threadId);
    if (!nextThread) return;

    setActiveThreadId(nextThread.id);
    setMessages(nextThread.messages);
    setDraft("");
    setError(null);
  }

  /** Creates a new empty chat thread and makes it active immediately. */
  function createNewThread() {
    if (sending) return;

    const nextNumber = threads.length + 1;
    const createdThread = buildEmptyThread(`Chat ${nextNumber}`);

    setThreads((current) => [createdThread, ...current].slice(0, CHAT_THREAD_LIMIT));
    setActiveThreadId(createdThread.id);
    setMessages([]);
    setDraft("");
    setError(null);
  }

  /** Deletes the active chat thread while preserving at least one thread shell. */
  function deleteActiveThread() {
    if (sending || !activeThreadId) return;

    if (threads.length <= 1) {
      const replacement = buildEmptyThread("Chat 1");
      setThreads([replacement]);
      setActiveThreadId(replacement.id);
      setMessages([]);
      setDraft("");
      setError(null);
      return;
    }

    const remaining = threads.filter((thread) => thread.id !== activeThreadId);
    const nextThread = remaining[0];
    if (!nextThread) return;

    setThreads(remaining);
    setActiveThreadId(nextThread.id);
    setMessages(nextThread.messages);
    setDraft("");
    setError(null);
  }

  /** Clears local chat history for the active module and resets panel state. */
  function clearHistory() {
    if (!activeThreadId) return;

    setMessages([]);
    setDraft("");
    setError(null);
  }

  /** Exports current conversation to a downloadable JSON file. */
  function exportHistory() {
    if (typeof window === "undefined" || messages.length === 0 || !activeThread) return;
    const payload = {
      moduleKey,
      scopePath,
      threadId: activeThread.id,
      threadTitle: activeThread.title,
      exportedAt: new Date().toISOString(),
      messages,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `steward-chat-${moduleKey}-${activeThread.id}-${Date.now()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /** Stops an in-flight streaming generation without clearing already streamed text. */
  function stopGeneration() {
    streamAbortRef.current?.abort();
  }

  /** Re-runs generation for a specific assistant message using its preceding user prompt and context. */
  function regenerateAssistantMessage(assistantMessageId: string) {
    if (sending) return;

    const assistantIndex = messages.findIndex((message) => message.id === assistantMessageId && message.role === "assistant");
    if (assistantIndex < 0) return;

    let userIndex = assistantIndex - 1;
    while (userIndex >= 0 && messages[userIndex].role !== "user") {
      userIndex -= 1;
    }
    if (userIndex < 0) return;

    const prompt = messages[userIndex].content;
    const historyForPayload = messages.slice(0, assistantIndex);

    void sendMessage(prompt, {
      historyOverride: historyForPayload,
      appendUserMessage: false,
      targetAssistantMessageId: assistantMessageId,
      truncateFromIndex: assistantIndex,
    });
  }

  interface SendMessageOptions {
    historyOverride?: UiMessage[];
    appendUserMessage?: boolean;
    targetAssistantMessageId?: string;
    truncateFromIndex?: number;
  }

  /** Sends a chat request to backend API and appends assistant response. */
  async function sendMessage(content?: string, options: SendMessageOptions = {}) {
    const text = (content ?? draft).trim();
    if (!text || sending) return;

    const appendUserMessage = options.appendUserMessage ?? true;
    const baseHistory = options.historyOverride ?? messages;

    const nextUserMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const payloadMessages = appendUserMessage ? [...baseHistory, nextUserMessage] : baseHistory;
    const assistantMessageId = options.targetAssistantMessageId ?? crypto.randomUUID();

    if (appendUserMessage) {
      setMessages([
        ...payloadMessages,
        {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          createdAt: new Date().toISOString(),
        },
      ]);
    } else {
      setMessages((current) => {
        const truncated = typeof options.truncateFromIndex === "number"
          ? current.slice(0, options.truncateFromIndex + 1)
          : current;

        return truncated.map((message) => {
          if (message.id !== assistantMessageId) return message;
          return {
            ...message,
            content: "",
            createdAt: new Date().toISOString(),
            toolsUsed: undefined,
            recordsUsed: undefined,
            provider: undefined,
            responseMode: undefined,
            runtimeMode: undefined,
          };
        });
      });
    }

    setDraft("");
    setSending(true);
    setActiveAssistantMessageId(assistantMessageId);
    setError(null);

    try {
      const abortController = new AbortController();
      streamAbortRef.current = abortController;

      const payload = {
        messages: payloadMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        mode,
        moduleKey,
        scopePath,
      };

      const response = await apiFetchResponse("/api/steward-ai/chat/stream", {
        method: "POST",
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const rawError = await response.text().catch(() => "");
        try {
          const parsed = JSON.parse(rawError) as { error?: { message?: string } };
          throw new Error(parsed.error?.message ?? `Steward request failed (${response.status})`);
        } catch {
          throw new Error(rawError || `Steward request failed (${response.status})`);
        }
      }

      if (!response.body) {
        throw new Error("Steward stream is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let doneEvent: StewardChatStreamDone | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        let newlineIndex = buffer.indexOf("\n");
        while (newlineIndex >= 0) {
          const line = buffer.slice(0, newlineIndex).trim();
          buffer = buffer.slice(newlineIndex + 1);
          newlineIndex = buffer.indexOf("\n");

          if (!line) continue;

          const event = JSON.parse(line) as StewardChatStreamEvent;
          if (event.type === "chunk") {
            setMessages((current) => current.map((message) => (
              message.id === assistantMessageId
                ? { ...message, content: `${message.content}${event.delta}` }
                : message
            )));
            continue;
          }

          if (event.type === "done") {
            doneEvent = event;
            break;
          }

          throw new Error(event.message || "Steward stream failed.");
        }

        if (doneEvent) break;
      }

      if (!doneEvent && buffer.trim()) {
        const trailing = JSON.parse(buffer.trim()) as StewardChatStreamEvent;
        if (trailing.type === "done") {
          doneEvent = trailing;
        } else if (trailing.type === "error") {
          throw new Error(trailing.message || "Steward stream failed.");
        } else if (trailing.type === "chunk") {
          setMessages((current) => current.map((message) => (
            message.id === assistantMessageId
              ? { ...message, content: `${message.content}${trailing.delta}` }
              : message
          )));
        }
      }

      if (!doneEvent) {
        throw new Error("Steward stream ended unexpectedly.");
      }

      setModelUsed(doneEvent.model);

      setMessages((current) => current.map((message) => {
        if (message.id !== assistantMessageId) return message;
        return {
          ...message,
          content: doneEvent.reply,
          toolsUsed: doneEvent.toolsUsed,
          recordsUsed: doneEvent.recordsUsed,
          provider: doneEvent.provider,
          responseMode: doneEvent.mode,
          runtimeMode: doneEvent.runtimeMode ?? "unknown",
        };
      }));

      onTraceUpdate?.({
        id: assistantMessageId,
        createdAt: new Date().toISOString(),
        moduleKey: doneEvent.moduleKey ?? moduleKey,
        scopePath: doneEvent.scopePath ?? scopePath,
        mode: doneEvent.mode,
        runtimeMode: doneEvent.runtimeMode ?? "unknown",
        provider: doneEvent.provider,
        model: doneEvent.model,
        toolsUsed: doneEvent.toolsUsed,
        recordsUsed: doneEvent.recordsUsed ?? [],
      });
    } catch (requestError) {
      setMessages((current) => current.filter((message) => {
        if (message.id !== assistantMessageId) return true;
        return message.content.trim().length > 0;
      }));

      const isAbortError = requestError instanceof Error
        && (requestError.name === "AbortError" || /abort/i.test(requestError.message));

      if (!isAbortError) {
        setError(requestError instanceof Error ? requestError.message : "Steward request failed.");
      }
    } finally {
      streamAbortRef.current = null;
      setSending(false);
      setActiveAssistantMessageId(null);
    }
  }

  if (!open && !isWorkspaceMode) return null;

  const rootClassName = isWorkspaceMode
    ? "h-[calc(100vh-14rem)] min-h-[620px]"
    : "fixed z-[80] top-14 right-0 bottom-0 w-full sm:w-[760px]";

  const panelClassName = isWorkspaceMode
    ? "h-full rounded-2xl border border-[#30363d] bg-[#0d1117] shadow-none flex flex-col overflow-hidden"
    : "h-full border-l border-[#30363d] bg-[#0d1117] shadow-none flex flex-col overflow-hidden";

  return (
    <div className={rootClassName}>
      <aside className={panelClassName}>
        <header className="px-4 py-3 border-b border-[#30363d] bg-[#161b22]">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-[#f0f6fc]">Steward</h2>
              <p className="text-xs text-[#8b949e]">Ask, analyze, summarize, and act across your CRM.</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${aiConfig?.enabled ? "border-[#2ea04366] bg-[#132a1b] text-[#7ee787]" : "border-[#d2992266] bg-[#2d230f] text-[#e3b341]"}`}>
                {aiConfig?.enabled ? `${aiConfig.mode === "local" ? "Local" : "Remote"} Ollama` : "Needs Setup"}
              </span>
              {!isWorkspaceMode && (
                <Link
                  href={workspaceHref}
                  className="h-7 px-2 rounded-md border border-[#30363d] bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] text-[11px] font-medium flex items-center"
                  title="Open StewardAIWorkspace"
                >
                  Workspace
                </Link>
              )}
              {!isWorkspaceMode && (
                <button
                  onClick={onClose}
                  className="h-8 w-8 rounded-lg border border-[#30363d] bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d]"
                  title="Close Steward"
                >
                  ×
                </button>
              )}
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#8b949e]">
            <span>Module: <span className="font-medium capitalize">{moduleKey}</span></span>
            <span>{modelUsed ? `Model: ${modelUsed}` : "Model not used yet"}</span>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {MODE_BUTTONS.map((button) => (
              <button
                key={button.key}
                onClick={() => setMode(button.key)}
                className={`px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${mode === button.key ? "border-[#2ea043] bg-[#238636] text-[#f0f6fc]" : "border-[#30363d] bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d]"}`}
              >
                {button.label}
              </button>
            ))}
          </div>

          <div className="mt-2 text-xs text-[#8b949e] flex items-center justify-between gap-2">
            <span>Scope: {scopePath}</span>
            <div className="flex items-center gap-3">
              <button onClick={clearHistory} className="text-[#c9d1d9] hover:text-[#f0f6fc]">
                Clear
              </button>
              <button onClick={exportHistory} className="text-[#c9d1d9] hover:text-[#f0f6fc]">
                Export
              </button>
              <Link href="/settings/ai" className="text-[#58a6ff] font-medium hover:underline">
                AI Settings
              </Link>
              {isWorkspaceMode && (
                <Link href="/" className="text-[#c9d1d9] hover:text-[#f0f6fc]">
                  Exit
                </Link>
              )}
            </div>
          </div>
        </header>

        {!aiConfig?.enabled && !loadingConfig && (
          <div className="mx-4 mt-3 rounded-lg border border-[#d2992266] bg-[#2d230f] px-3 py-2 text-xs text-[#e3b341]">
            Steward AI is disabled. Configure local or remote Ollama in AI Settings.
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 rounded-lg border border-[#f8514966] bg-[#2d1214] px-3 py-2 text-xs text-[#ffa198]">
            {error}
          </div>
        )}

        <div className="flex-1 min-h-0 flex">
          <aside className="hidden sm:flex sm:w-[230px] border-r border-[#30363d] bg-[#0d1117] flex-col">
            <div className="p-3 border-b border-[#30363d] flex items-center gap-2">
              <button
                type="button"
                onClick={createNewThread}
                disabled={sending}
                className="flex-1 h-8 rounded-md border border-[#30363d] bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] text-xs font-medium disabled:opacity-60"
              >
                New Chat
              </button>
              <button
                type="button"
                onClick={deleteActiveThread}
                disabled={sending || threads.length <= 1}
                className="h-8 px-2 rounded-md border border-[#da363366] bg-[#2d1214] text-[#ffa198] hover:bg-[#3a171b] text-xs font-medium disabled:opacity-60"
              >
                Del
              </button>
            </div>
            <div className="flex-1 overflow-y-auto chat-scroll-smooth p-2 space-y-1">
              {orderedThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => switchActiveThread(thread.id)}
                  className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${thread.id === activeThreadId ? "border-[#1f6feb] bg-[#1f6feb22]" : "border-[#30363d] bg-[#161b22] hover:bg-[#21262d]"}`}
                >
                  <p className="text-xs font-medium text-[#c9d1d9] truncate">{thread.title}</p>
                  <p className="text-[11px] text-[#8b949e] mt-0.5">
                    {new Date(thread.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
              ))}
            </div>
          </aside>

          <section className="flex-1 min-h-0 flex flex-col">
            <div className="sm:hidden p-3 border-b border-[#30363d] bg-[#0d1117] space-y-2">
              <div className="flex items-center gap-2">
                <label htmlFor="steward-chat-thread" className="text-xs text-[#8b949e] shrink-0">Chat</label>
                <select
                  id="steward-chat-thread"
                  value={activeThreadId ?? ""}
                  onChange={(event) => switchActiveThread(event.target.value)}
                  disabled={sending || orderedThreads.length === 0}
                  className="flex-1 h-8 rounded-md border border-[#30363d] bg-[#0d1117] px-2 text-xs text-[#c9d1d9] focus:outline-none focus:ring-2 focus:ring-[#1f6feb]"
                >
                  {orderedThreads.map((thread) => (
                    <option key={thread.id} value={thread.id}>{thread.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={createNewThread}
                  disabled={sending}
                  className="flex-1 h-8 rounded-md border border-[#30363d] bg-[#21262d] text-[#c9d1d9] hover:bg-[#30363d] text-xs font-medium disabled:opacity-60"
                >
                  New Chat
                </button>
                <button
                  type="button"
                  onClick={deleteActiveThread}
                  disabled={sending || threads.length <= 1}
                  className="h-8 px-3 rounded-md border border-[#da363366] bg-[#2d1214] text-[#ffa198] hover:bg-[#3a171b] text-xs font-medium disabled:opacity-60"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="px-4 py-3 border-b border-[#30363d] flex flex-wrap gap-2 bg-[#0d1117]">
              {promptChips.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => {
                    setDraft(prompt);
                  }}
                  className="rounded-full border border-[#30363d] bg-[#21262d] px-2.5 py-1 text-xs text-[#c9d1d9] hover:bg-[#30363d]"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto chat-scroll-smooth px-4 py-3 space-y-3 bg-[#0d1117]">
              {messages.map((message) => (
                <div key={message.id} className={`max-w-[92%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`}>
                  <div
                    className={`rounded-2xl px-3 py-2 text-sm shadow-sm border ${
                      message.role === "user"
                        ? "bg-[#238636] text-[#f0f6fc] border-[#2ea043]"
                        : "bg-[#161b22] text-[#c9d1d9] border-[#30363d]"
                    }`}
                  >
                    {message.role === "assistant" ? (
                      sending && activeAssistantMessageId === message.id && !message.content.trim() ? (
                        <div className="inline-flex items-center gap-1 text-[#8b949e]">
                          <span className="h-1.5 w-1.5 rounded-full bg-[#8b949e] animate-pulse" />
                          <span className="h-1.5 w-1.5 rounded-full bg-[#8b949e] animate-pulse [animation-delay:120ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-[#8b949e] animate-pulse [animation-delay:240ms]" />
                        </div>
                      ) : (
                        <StewardMessageRenderer content={message.content} />
                      )
                    ) : (
                      <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                    )}
                  </div>
                  <div className={`mt-1 text-[11px] text-[#8b949e] flex items-center gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  {message.role === "assistant" && message.toolsUsed && message.toolsUsed.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {message.toolsUsed.map((tool) => (
                        <span key={tool} className="rounded-full border border-[#30363d] bg-[#21262d] px-2 py-0.5 text-[10px] font-medium text-[#8b949e]">
                          Tool: {tool}
                        </span>
                      ))}
                    </div>
                  )}
                  {message.role === "assistant" && aiConfig?.enabled && (
                    <div className="mt-1.5 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => regenerateAssistantMessage(message.id)}
                        disabled={sending}
                        className="rounded-md border border-[#30363d] bg-[#21262d] px-2 py-1 text-[11px] font-medium text-[#c9d1d9] hover:bg-[#30363d] disabled:opacity-50"
                      >
                        Regenerate
                      </button>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesBottomRef} />
            </div>

            <footer className="border-t border-[#30363d] p-3 space-y-2 bg-[#161b22]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleComposerKeyDown}
                placeholder={aiConfig?.enabled ? "Ask Steward something about this page..." : "Enable Steward AI in Settings before chatting."}
                rows={3}
                disabled={!aiConfig?.enabled || sending}
                className="w-full rounded-xl border border-[#30363d] bg-[#0d1117] text-[#c9d1d9] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#2ea043] disabled:bg-[#0d1117] disabled:text-[#6e7681]"
              />
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-[#8b949e]">
                  Tools run automatically per message. Write actions remain confirm-first.
                </p>
                <div className="flex items-center gap-2">
                  {sending && (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="px-3 py-2 rounded-lg border border-[#f8514966] bg-[#2d1214] text-[#ffa198] text-sm font-medium hover:bg-[#3a171b]"
                    >
                      Stop
                    </button>
                  )}
                  <button
                    onClick={() => void sendMessage()}
                    disabled={!aiConfig?.enabled || sending || draft.trim().length === 0}
                    className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                  >
                    {sending ? "Sending..." : "Send"}
                  </button>
                </div>
              </div>
            </footer>
          </section>
        </div>
      </aside>
    </div>
  );
}
