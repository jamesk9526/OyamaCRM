/** StewardChatPanel renders Steward as a docked CRM chat shell or full AI workspace. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import StewardResponseRenderer from "@/app/components/ai/StewardResponseRenderer";
import type { StewardStructuredResponse } from "@/app/components/ai/steward-artifact-types";
import { executeStewardSuggestedAction } from "@/app/components/ai/steward-action-executor";

type ModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "oshareview" | "hrm" | "password";
type ChatMode = "ask" | "analyze" | "draft" | "action" | "help";
export type StewardPanelMode = "collapsed" | "dock-right" | "popout" | "maximized";
type StewardChatDisplayMode = "dock" | "dock-right" | "popout" | "maximized" | "workspace";

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
  onDisplayModeChange?: (mode: StewardPanelMode) => void;
  onTraceUpdate?: (trace: StewardTraceSnapshot) => void;
}

interface AiConfigPayload {
  enabled: boolean;
  mode: "local" | "remote";
  endpointUrl: string;
  model: string;
  chatHeadEnabled: boolean;
}

interface UiMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  structured?: StewardStructuredResponse;
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
  structured?: StewardStructuredResponse;
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

function normalizeStructuredResponse(raw: unknown): StewardStructuredResponse | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;

  const candidate = raw as Partial<StewardStructuredResponse>;
  if (candidate.version !== 1) return undefined;
  if (typeof candidate.replyMarkdown !== "string") return undefined;
  if (!Array.isArray(candidate.artifacts)) return undefined;
  if (!Array.isArray(candidate.suggestedActions)) return undefined;
  if (!Array.isArray(candidate.evidence)) return undefined;

  return {
    version: 1,
    replyMarkdown: candidate.replyMarkdown,
    artifacts: candidate.artifacts,
    suggestedActions: candidate.suggestedActions,
    evidence: candidate.evidence,
    parseWarning: typeof candidate.parseWarning === "string" ? candidate.parseWarning : undefined,
  };
}

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
    .map((message): UiMessage => {
      const candidate = message as Partial<UiMessage>;
      return {
        id: typeof candidate.id === "string" && candidate.id.length > 0 ? candidate.id : crypto.randomUUID(),
        role: candidate.role === "assistant" ? "assistant" : "user",
        content: typeof candidate.content === "string" ? candidate.content : "",
        createdAt: typeof candidate.createdAt === "string" && candidate.createdAt.length > 0
          ? candidate.createdAt
          : new Date().toISOString(),
        structured: normalizeStructuredResponse((candidate as { structured?: unknown }).structured),
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

  if (moduleKey === "oshareview") {
    return [
      "Summarize the most important reporting KPI changes.",
      "Which report tab should I review first this week?",
      "Draft a board-ready reporting summary.",
    ];
  }

  if (moduleKey === "hrm") {
    return [
      "Summarize internal staffing priorities for today.",
      "Draft an internal announcement for all staff locations.",
      "What schedule conflicts should HRM resolve this week?",
    ];
  }

  if (moduleKey === "password") {
    return [
      "Summarize vault entries that need sharing cleanup.",
      "Draft secure credential rotation reminders for staff.",
      "What password-sharing risks should we address first?",
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

/** Returns true when two message lists are structurally equivalent for persistence purposes. */
function areMessagesEquivalent(left: UiMessage[], right: UiMessage[]): boolean {
  if (left.length !== right.length) return false;

  return left.every((message, index) => {
    const next = right[index];
    return message.id === next.id
      && message.role === next.role
      && message.content === next.content
      && message.createdAt === next.createdAt
      && JSON.stringify(message.structured ?? null) === JSON.stringify(next.structured ?? null)
      && message.toolsUsed === next.toolsUsed
      && message.provider === next.provider
      && message.responseMode === next.responseMode
      && message.runtimeMode === next.runtimeMode;
  });
}

/** StewardChatPanel renders either a docked panel or a full workspace chat experience. */
export default function StewardChatPanel({
  open,
  onClose,
  moduleKey,
  scopePath,
  displayMode = "dock",
  onDisplayModeChange,
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
  const [actionStatus, setActionStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<string | null>(null);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const composerInputRef = useRef<HTMLInputElement | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);

  const isWorkspaceMode = displayMode === "workspace";
  const isPopoutMode = displayMode === "popout";
  const isMaximizedMode = displayMode === "maximized";
  const isDockMode = displayMode === "dock" || displayMode === "dock-right";
  const promptChips = useMemo(() => promptsForModule(moduleKey), [moduleKey]);
  const filteredPromptChips = useMemo(() => {
    const normalizedDraft = draft.trim().toLowerCase();
    if (!normalizedDraft) return promptChips;

    return promptChips
      .filter((prompt) => prompt.toLowerCase().includes(normalizedDraft))
      .slice(0, 3);
  }, [promptChips, draft]);
  const workspaceHref = useMemo(() => {
    const params = new URLSearchParams({
      module: moduleKey,
      scope: scopePath,
    });
    return `/steward-ai-workspace?${params.toString()}`;
  }, [moduleKey, scopePath]);
  const scopeHref = useMemo(() => (scopePath.startsWith("/") ? scopePath : null), [scopePath]);
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
    const timer = window.setTimeout(() => {
      setThreadsHydrated(false);

      const stored = readStoredThreads(moduleKey);
      const initialThreads = stored.length > 0 ? stored : [buildEmptyThread("Chat 1")];
      const initialThread = initialThreads[0];

      setThreads(initialThreads);
      setActiveThreadId(initialThread.id);
      setMessages(initialThread.messages);
      setDraft("");
      setThreadsHydrated(true);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [moduleKey]);

  /** Persists updated active-thread messages in local thread state. */
  useEffect(() => {
    if (!threadsHydrated || !activeThreadId || sending) return;

    const normalizedMessages = messages.slice(-CHAT_HISTORY_LIMIT);
    const nextTitle = inferThreadTitle(messages, activeThread?.title ?? "Chat");

    const timer = window.setTimeout(() => {
      setThreads((current) => {
        let changed = false;

        const nextThreads = current.map((thread) => {
          if (thread.id !== activeThreadId) return thread;

          const titleChanged = thread.title !== nextTitle;
          const messagesChanged = !areMessagesEquivalent(thread.messages, normalizedMessages);
          if (!titleChanged && !messagesChanged) {
            return thread;
          }

          changed = true;
          return {
            ...thread,
            title: nextTitle,
            updatedAt: new Date().toISOString(),
            messages: normalizedMessages,
          };
        });

        return changed ? nextThreads : current;
      });
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [messages, activeThread, activeThreadId, threadsHydrated, sending]);

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

  /** Loads AI config once so chat-head visibility honors settings even while panel is closed. */
  useEffect(() => {
    let cancelled = false;

    async function loadConfigForLauncher() {
      try {
        const response = await apiFetch<AiConfigPayload>("/api/steward-ai/config");
        if (cancelled) return;
        setAiConfig((current) => current ? { ...current, ...response } : response);
      } catch {
        // Silent fallback: launcher defaults to visible when config cannot be read.
      }
    }

    void loadConfigForLauncher();

    return () => {
      cancelled = true;
    };
  }, []);

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

  /** Closes the conversations drawer when the panel closes. */
  useEffect(() => {
    if (!open && !isWorkspaceMode) {
      setConversationsOpen(false);
    }
  }, [open, isWorkspaceMode]);

  /** Expands docked chat on open so the panel is immediately actionable. */
  useEffect(() => {
    if (!open || isWorkspaceMode) return;

    const timer = window.setTimeout(() => {
      setIsMinimized(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open, isWorkspaceMode]);

  /** Sends message on Enter while preserving Shift+Enter for multi-line drafts. */
  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
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
    setActionStatus(null);
    setConversationsOpen(false);
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
    setActionStatus(null);
    setConversationsOpen(false);
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
      setActionStatus(null);
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
    setActionStatus(null);
  }

  /** Clears local chat history for the active module and resets panel state. */
  function clearHistory() {
    if (typeof window !== "undefined") {
      const approved = window.confirm("Clear the current conversation only? This does not delete other chat threads.");
      if (!approved) return;
    }
    if (!activeThreadId) return;

    setMessages([]);
    setDraft("");
    setError(null);
    setActionStatus(null);
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

  /** Executes supported structured suggested actions with explicit user confirmation for write operations. */
  async function runSuggestedAction(messageId: string, actionIndex: number) {
    const sourceMessage = messages.find((message) => message.id === messageId && message.role === "assistant");
    if (!sourceMessage?.structured) {
      setActionStatus({ tone: "error", message: "This suggestion no longer has structured context to run." });
      return;
    }

    const action = sourceMessage.structured.suggestedActions[actionIndex];
    if (!action) {
      setActionStatus({ tone: "error", message: "That suggestion is no longer available." });
      return;
    }

    try {
      const result = await executeStewardSuggestedAction({
        action,
        structured: sourceMessage.structured,
        replyContent: sourceMessage.content,
        confirm: (confirmMessage) => {
          if (typeof window === "undefined") return false;
          return window.confirm(confirmMessage);
        },
        callApi: async (path, init) => {
          await apiFetch(path, {
            method: init?.method,
            body: init?.body,
            headers: { "Content-Type": "application/json" },
          });
        },
        navigate: (path) => {
          if (typeof window !== "undefined") {
            window.location.href = path;
          }
        },
        copyText: async (value) => {
          if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
            throw new Error("Clipboard is unavailable in this browser.");
          }
          await navigator.clipboard.writeText(value);
        },
      });

      if (result.status === "failed") {
        setActionStatus({ tone: "error", message: result.message });
        return;
      }

      if (result.status === "ignored") {
        setActionStatus({ tone: "error", message: result.message });
        return;
      }

      if (result.status === "cancelled") {
        setActionStatus({ tone: "success", message: result.message });
        return;
      }

      setActionStatus({ tone: "success", message: result.message });
    } catch (actionError) {
      setActionStatus({
        tone: "error",
        message: actionError instanceof Error ? actionError.message : "Suggested action failed.",
      });
    }
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
            structured: undefined,
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
    setActionStatus(null);

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
      let streamedReply = "";

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
            streamedReply += event.delta;
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
          streamedReply += trailing.delta;
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
        const finalizedReply = doneEvent.reply?.length ? doneEvent.reply : streamedReply;
        return {
          ...message,
          content: finalizedReply,
          structured: normalizeStructuredResponse(doneEvent.structured),
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

  if (!open && !isWorkspaceMode && aiConfig?.chatHeadEnabled !== false) {
    return (
      <button
        type="button"
        onClick={() => onDisplayModeChange?.("dock-right")}
        aria-label="Open Steward AI Assistant"
        title="Open Steward AI Assistant"
        className="fixed z-[96] right-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] h-14 w-14 rounded-full border border-emerald-300 bg-emerald-600 text-white shadow-[0_16px_30px_rgba(22,163,74,0.35)] flex items-center justify-center"
      >
        <svg className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l1.4 3.6L17 8l-3.6 1.4L12 13l-1.4-3.6L7 8l3.6-1.4L12 3zM6 14l.9 2.1L9 17l-2.1.9L6 20l-.9-2.1L3 17l2.1-.9L6 14zM18 13l1 2.3L21.3 16 19 17l-1 2.3-1-2.3L14.7 16l2.3-.7 1-2.3z" />
        </svg>
      </button>
    );
  }

  if (!open && !isWorkspaceMode && aiConfig?.chatHeadEnabled === false) {
    return null;
  }

  const isDockMinimized = !isWorkspaceMode && isMinimized;

  const rootClassName = isWorkspaceMode
    ? "h-full min-h-0 max-h-full"
    : isDockMinimized
      ? "fixed z-[90] bottom-4 left-2 right-2 sm:left-[15rem] sm:right-5 pointer-events-none flex items-end justify-center"
    : isMaximizedMode
      ? "fixed z-[92] top-[max(3.5rem,env(safe-area-inset-top))] bottom-0 left-0 right-0 sm:top-16 sm:bottom-3 sm:left-[15rem] sm:right-4 pointer-events-none"
      : isPopoutMode
        ? "fixed z-[92] top-[max(3.5rem,env(safe-area-inset-top))] bottom-0 left-0 right-0 sm:top-14 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[860px] pointer-events-none"
        : `fixed z-[90] top-14 bottom-3 left-2 right-2 sm:left-[15rem] sm:right-5 pointer-events-none flex items-end ${isDockMinimized ? "justify-center" : "justify-end"}`;

  const panelClassName = isWorkspaceMode
    ? "h-full rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden"
    : `pointer-events-auto border border-emerald-200 ring-1 ring-emerald-100 bg-white shadow-[0_22px_48px_rgba(15,23,42,0.14)] flex flex-col overflow-hidden transition-[height,width] duration-200 ${isMaximizedMode || isPopoutMode ? "rounded-none sm:rounded-[22px] w-full max-w-none h-full" : "rounded-[22px] w-full max-w-[760px] h-[min(78vh,760px)] max-h-full"}`;
  const panelStyle = isWorkspaceMode
    ? undefined
    : isDockMinimized
      ? undefined
      : isMaximizedMode
        ? undefined
        : {
            maxHeight: isPopoutMode ? "calc(100vh - 5rem)" : "calc(100vh - 4.25rem)",
          };

  return (
    <div className={rootClassName}>
      {isDockMinimized ? (
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className="pointer-events-auto px-5 py-2 rounded-full border border-emerald-200 bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 shadow-[0_12px_28px_rgba(22,163,74,0.28)]"
          title="Open chat"
        >
          Open Chat
        </button>
      ) : (
      <aside className={panelClassName} style={panelStyle}>
        <header className={`px-3.5 border-b border-slate-200 bg-white ${isDockMinimized ? "py-1.5" : "py-2"}`}>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold leading-tight text-slate-900">Steward</h2>
              <p className="text-[11px] leading-tight text-slate-600 truncate">Ask, analyze, summarize, and act across your CRM.</p>
            </div>
            <div className="flex items-center gap-1">
              {!isWorkspaceMode && !isPopoutMode && (
                <button
                  onClick={() => onDisplayModeChange?.("popout")}
                  className="h-7 px-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px]"
                  title="Open in-app popout"
                >
                  Pop
                </button>
              )}
              {!isWorkspaceMode && isPopoutMode && (
                <button
                  onClick={() => onDisplayModeChange?.("dock-right")}
                  className="h-7 px-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px]"
                  title="Return to dock"
                >
                  Dock
                </button>
              )}
              {!isWorkspaceMode && !isMaximizedMode && (
                <button
                  onClick={() => onDisplayModeChange?.("maximized")}
                  className="h-7 px-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px]"
                  title="Maximize Steward"
                >
                  Max
                </button>
              )}
              {!isWorkspaceMode && isMaximizedMode && (
                <button
                  onClick={() => onDisplayModeChange?.("dock-right")}
                  className="h-7 px-2 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 text-[11px]"
                  title="Return to dock"
                >
                  Dock
                </button>
              )}
              {!isWorkspaceMode && (
                <button
                  onClick={() => setIsMinimized((current) => !current)}
                  className="h-7 w-7 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  title={isDockMinimized ? "Expand Steward" : "Minimize Steward"}
                >
                  {isDockMinimized ? "[]" : "-"}
                </button>
              )}
              {!isWorkspaceMode && (
                <button
                  onClick={onClose}
                  className="h-7 w-7 rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  title="Close Steward"
                >
                  x
                </button>
              )}
            </div>
          </div>

          {!isDockMinimized && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px] text-slate-600">
              {!isWorkspaceMode && (
                <button
                  type="button"
                  onClick={() => setConversationsOpen((current) => !current)}
                  className={`h-6 px-2 rounded-full border font-medium ${conversationsOpen ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
                  title="Open conversations"
                >
                  Chats
                </button>
              )}
              <span className={`h-6 inline-flex items-center px-2 rounded-full border ${aiConfig?.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {aiConfig?.enabled ? `${aiConfig.mode === "local" ? "Local" : "Remote"} Ollama` : "Needs Setup"}
              </span>
              {!isWorkspaceMode && (
                <Link
                  href={workspaceHref}
                  className="h-6 inline-flex items-center px-2 rounded-full border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"
                  title="Open Steward AI Workspace"
                >
                  Workspace
                </Link>
              )}
              <span className="h-6 inline-flex items-center px-2 rounded-full border border-slate-200 bg-white">Module: <span className="ml-1 font-medium capitalize">{moduleKey}</span></span>
              <span className="h-6 inline-flex items-center px-2 rounded-full border border-slate-200 bg-white">{modelUsed ? `Model: ${modelUsed}` : "Model: pending"}</span>
              <span className="h-6 inline-flex items-center px-2 rounded-full border border-slate-200 bg-white max-w-[260px] truncate">
                Scope:{" "}
                {scopeHref ? (
                  <Link href={scopeHref} className="ml-1 text-emerald-700 hover:text-emerald-800 hover:underline truncate">
                    {scopePath}
                  </Link>
                ) : (
                  <span className="ml-1 truncate">{scopePath}</span>
                )}
              </span>
              <button onClick={clearHistory} className="h-6 px-2 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100">Clear</button>
              <button onClick={exportHistory} className="h-6 px-2 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100">Export</button>
              <Link href="/settings/ai" className="h-6 inline-flex items-center px-2 rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 hover:text-emerald-800">
                AI Settings
              </Link>
              {isWorkspaceMode && (
                <Link href="/" className="h-6 inline-flex items-center px-2 rounded-full border border-slate-200 bg-slate-50 hover:bg-slate-100">
                  Exit
                </Link>
              )}
            </div>
          )}
        </header>

          <>
            {!aiConfig?.enabled && !loadingConfig && (
              <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${isWorkspaceMode ? "border-amber-200 bg-amber-50 text-amber-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                Steward AI is disabled. Configure local or remote Ollama in AI Settings.
              </div>
            )}

            {error && (
              <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${isWorkspaceMode ? "border-red-200 bg-red-50 text-red-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                {error}
              </div>
            )}

            {actionStatus && (
              <div className={`mx-4 mt-3 rounded-lg border px-3 py-2 text-xs ${actionStatus.tone === "error" ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                {actionStatus.message}
              </div>
            )}

            <div className="flex-1 min-h-0 flex relative overflow-hidden">
              {!isWorkspaceMode && conversationsOpen && (
                <button
                  type="button"
                  aria-label="Close conversations"
                  onClick={() => setConversationsOpen(false)}
                  className="absolute inset-0 z-10 bg-slate-950/10 backdrop-blur-[1px]"
                />
              )}

              {!isWorkspaceMode && (
                <aside className={`absolute left-0 top-0 bottom-0 z-20 w-[238px] border-r border-slate-200 bg-white/97 shadow-[0_18px_40px_rgba(15,23,42,0.12)] transition-transform duration-200 ${conversationsOpen ? "translate-x-0" : "-translate-x-full"}`}>
                  <div className="p-3 border-b border-slate-200 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={createNewThread}
                      disabled={sending}
                      className="flex-1 h-8 rounded-md border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 text-xs font-medium disabled:opacity-60"
                    >
                      New Chat
                    </button>
                    <button
                      type="button"
                      onClick={deleteActiveThread}
                      disabled={sending || threads.length <= 1}
                      className="h-8 px-2 rounded-md border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 text-xs font-medium disabled:opacity-60"
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
                        className={`w-full text-left rounded-md border px-2.5 py-2 transition-colors ${thread.id === activeThreadId ? "border-emerald-300 bg-emerald-50" : "border-slate-200 bg-white hover:bg-slate-100"}`}
                      >
                        <p className="text-xs font-medium truncate text-slate-800">{thread.title}</p>
                        <p className="text-[11px] mt-0.5 text-slate-500">
                          {new Date(thread.updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </button>
                    ))}
                  </div>
                </aside>
              )}

              <section className="flex-1 min-h-0 flex flex-col relative">
                <div className={`flex-1 overflow-y-auto chat-scroll-smooth px-4 pt-3 pb-4 ${isWorkspaceMode ? "bg-slate-50/70" : "bg-slate-50/80"}`}>
                  <div className={isWorkspaceMode ? "mx-auto w-full max-w-4xl space-y-3" : "mx-auto w-full max-w-[580px] space-y-3"}>
                  {messages.map((message) => (
                    <div key={message.id} className={`max-w-[92%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`}>
                      <div
                        className={`rounded-2xl px-3 py-2 text-sm shadow-sm border ${
                          message.role === "user"
                            ? (isWorkspaceMode ? "bg-slate-900 text-white border-slate-900" : "bg-emerald-600 text-white border-emerald-500")
                            : (isWorkspaceMode ? "bg-white text-slate-700 border-slate-200" : "bg-white text-slate-700 border-slate-200")
                        }`}
                      >
                        {message.role === "assistant" ? (
                          sending && activeAssistantMessageId === message.id && !message.content.trim() ? (
                            <div className={`inline-flex items-center gap-1 ${isWorkspaceMode ? "text-slate-500" : "text-slate-500"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isWorkspaceMode ? "bg-slate-500" : "bg-slate-500"}`} />
                              <span className={`h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:120ms] ${isWorkspaceMode ? "bg-slate-500" : "bg-slate-500"}`} />
                              <span className={`h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:240ms] ${isWorkspaceMode ? "bg-slate-500" : "bg-slate-500"}`} />
                            </div>
                          ) : (
                            <StewardResponseRenderer
                              content={message.content}
                              structured={message.structured}
                              tone={isWorkspaceMode ? "light" : "light"}
                              onSuggestedAction={async (action) => {
                                const actionIndex = message.structured?.suggestedActions.findIndex((candidate) => (
                                  candidate.label === action.label && candidate.actionType === action.actionType
                                )) ?? -1;
                                if (actionIndex >= 0) {
                                  await runSuggestedAction(message.id, actionIndex);
                                }
                              }}
                            />
                          )
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        )}
                      </div>
                      <div className={`mt-1 text-[11px] flex items-center gap-2 ${isWorkspaceMode ? "text-[#8b949e]" : "text-slate-500"} ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                      {message.role === "assistant" && message.toolsUsed && message.toolsUsed.length > 0 && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {message.toolsUsed.map((tool) => (
                            <span key={tool} className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${isWorkspaceMode ? "border-slate-200 bg-white text-slate-500" : "border-slate-200 bg-white text-slate-500"}`}>
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
                            className={`rounded-md border px-2 py-1 text-[11px] font-medium disabled:opacity-50 ${isWorkspaceMode ? "border-slate-200 bg-white text-slate-700 hover:bg-slate-100" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100"}`}
                          >
                            Regenerate
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesBottomRef} />
                  </div>
                </div>

                <footer className="border-t border-slate-200 bg-white/95 px-3 py-3">
                  <div className={`mx-auto rounded-[20px] border p-3 shadow-[0_14px_24px_rgba(15,23,42,0.08)] ${isWorkspaceMode ? "max-w-4xl border-slate-200 bg-white" : "max-w-[680px] border-slate-200 bg-white"}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <label className="sr-only" htmlFor="steward-mode-select">Mode</label>
                        <select
                          id="steward-mode-select"
                          value={mode}
                          onChange={(event) => setMode(event.target.value as ChatMode)}
                          className="h-8 rounded-full border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        >
                          {MODE_BUTTONS.map((button) => (
                            <option key={button.key} value={button.key}>{button.label}</option>
                          ))}
                        </select>
                      </div>
                      <p className="text-[11px] text-slate-500">Confirm-first for write actions.</p>
                    </div>

                    {filteredPromptChips.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        {filteredPromptChips.map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => {
                              setDraft(prompt);
                              composerInputRef.current?.focus();
                            }}
                            className="h-6 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 text-[11px] text-emerald-700 hover:bg-emerald-100"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <input
                        ref={composerInputRef}
                        type="text"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        placeholder={aiConfig?.enabled ? "Ask Steward something about this page..." : "Enable Steward AI in Settings before chatting."}
                        disabled={!aiConfig?.enabled || sending}
                        className={`h-11 flex-1 rounded-full border px-4 text-sm focus:outline-none focus:ring-2 disabled:cursor-not-allowed ${isWorkspaceMode ? "border-slate-200 bg-slate-50 text-slate-800 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400" : "border-slate-200 bg-slate-50 text-slate-800 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-400"}`}
                      />
                      <div className="flex items-center gap-2 shrink-0">
                        {sending && (
                          <button
                            type="button"
                            onClick={stopGeneration}
                            className="px-3 py-2 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-medium hover:bg-red-100"
                          >
                            Stop
                          </button>
                        )}
                        <button
                          onClick={() => void sendMessage()}
                          disabled={!aiConfig?.enabled || sending || draft.trim().length === 0}
                          className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {sending ? "Sending..." : "Send"}
                        </button>
                      </div>
                    </div>
                  </div>
                </footer>
              </section>
            </div>
          </>
      </aside>
      )}
    </div>
  );
}
