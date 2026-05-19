/** StewardChatPanel renders Steward as a docked CRM chat shell or full AI workspace. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import {
  type ReportingYearMode,
  getFiscalYearForDate,
  getStoredReportingYearMode,
  setStoredReportingYearMode,
  getFiscalYearEndMonth,
} from "@/app/lib/fiscal-year";
import StewardResponseRenderer from "@/app/components/ai/StewardResponseRenderer";
import { StewardThinkingPanel } from "@/app/components/ai/StewardThinkingPanel";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import type { StewardStructuredResponse } from "@/app/components/ai/steward-artifact-types";
import { executeStewardSuggestedAction } from "@/app/components/ai/steward-action-executor";

type ModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "oshareview" | "hrm" | "password";
type ChatMode = "ask" | "analyze" | "draft" | "free" | "agentic" | "writing" | "llm" | "action" | "help";
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
  moduleKey?: string;
  runtimeMode?: "local" | "remote" | "unknown";
  /** Human-readable pipeline progress steps. */
  progressSteps?: string[];
  /** Reasoning tokens from DeepSeek or other thinking-capable models. */
  thinkingContent?: string;
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
/** Progress update sent during pipeline stages (retrieval, planning, drafting). */
interface StewardChatStreamProgress { type: "progress"; message: string; }
/** Reasoning token from DeepSeek or other thinking-capable models. */
interface StewardChatStreamThinking { type: "thinking"; delta: string; }

type StewardChatStreamEvent =
  | StewardChatStreamChunk
  | StewardChatStreamDone
  | StewardChatStreamError
  | StewardChatStreamProgress
  | StewardChatStreamThinking;

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
        responseMode: ["ask", "analyze", "draft", "free", "agentic", "writing", "llm", "action", "help"].includes(String(candidate.responseMode))
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
  { key: "ask", label: "Ask & Retrieve" },
  { key: "analyze", label: "Analyze Trends" },
  { key: "draft", label: "Draft Outreach" },
  { key: "free", label: "Pure Mode" },
  { key: "agentic", label: "Agentic Mode" },
  { key: "llm", label: "LLM Deep" },
  { key: "action", label: "Action Plan" },
  { key: "help", label: "Workflow Help" },
];

const STEWARD_READY_MESSAGE = "Steward is ready with CRM retrieval and multi-stage reasoning tools. Choose a mode for retrieval, analysis, drafting, deep reasoning, or confirm-first action planning.";
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
    "What donor follow-up task should I create next?",
    "Draft a thank-you note using confirmed CRM gift details.",
    "Summarize donor engagement risks from current records.",
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
  const [conversationsOpen, setConversationsOpen] = useState(false);
  const [activeAssistantMessageId, setActiveAssistantMessageId] = useState<string | null>(null);
  const [reportingYearMode, setReportingYearModeState] = useState<ReportingYearMode>("calendar");
  const [fiscalYearStart, setFiscalYearStart] = useState<number>(1);
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

  /** Sync FY mode from localStorage on mount and listen for TopBar changes. */
  useEffect(() => {
    setReportingYearModeState(getStoredReportingYearMode());
    function onModeChange(event: Event) {
      const detail = (event as CustomEvent<{ mode: ReportingYearMode }>).detail;
      if (detail?.mode) setReportingYearModeState(detail.mode);
    }
    window.addEventListener("reporting-year-mode:changed", onModeChange);
    return () => window.removeEventListener("reporting-year-mode:changed", onModeChange);
  }, []);

  /** Load org fiscal year start from settings. */
  useEffect(() => {
    let active = true;
    apiFetch<{ fiscalYearStart?: number }>("/api/settings")
      .then((data) => { if (active && typeof data.fiscalYearStart === "number") setFiscalYearStart(data.fiscalYearStart); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  /** Toggle FY mode and persist to localStorage (kept in sync with TopBar). */
  const toggleReportingYearMode = useCallback(() => {
    setReportingYearModeState((current) => {
      const next: ReportingYearMode = current === "fiscal" ? "calendar" : "fiscal";
      setStoredReportingYearMode(next);
      return next;
    });
  }, []);

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
    if (!threadsHydrated || !activeThreadId) return;

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

    if (action.actionType === "guidepath.choose") {
      const payload = action.payload as Record<string, unknown> | undefined;
      const prompt = typeof payload?.prompt === "string" && payload.prompt.trim().length > 0
        ? payload.prompt.trim()
        : action.label;
      const sent = await sendMessage(prompt);
      if (!sent) {
        setActionStatus({ tone: "error", message: "GuidePath continuation is waiting for the current response to finish. Try again in a second." });
        return;
      }
      setActionStatus({ tone: "success", message: "GuidePath selection applied. Continuing with your request." });
      return;
    }

    if (action.actionType.startsWith("thoughtstack.")) {
      const payload = action.payload as Record<string, unknown> | undefined;
      const prompt = typeof payload?.prompt === "string" && payload.prompt.trim().length > 0
        ? payload.prompt.trim()
        : action.label;
      const sent = await sendMessage(prompt);
      if (!sent) {
        setActionStatus({ tone: "error", message: "ThoughtStack continuation is waiting for the current response to finish. Try again in a second." });
        return;
      }

      const thoughtStackMessage = action.actionType === "thoughtstack.review_first"
        ? "ThoughtStack set this request to review-first. Generating a dry-run style preview."
        : action.actionType === "thoughtstack.cancel"
          ? "ThoughtStack canceled this request."
          : action.actionType === "thoughtstack.provide_details"
            ? "ThoughtStack is waiting for your details."
            : "ThoughtStack confirmation applied. Continuing execution flow.";

      setActionStatus({ tone: "success", message: thoughtStackMessage });
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
  async function sendMessage(content?: string, options: SendMessageOptions = {}): Promise<boolean> {
    const text = (content ?? draft).trim();
    if (!text || sending) return false;

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

      const currentFiscalYear = getFiscalYearForDate(new Date(), fiscalYearStart);
      const payload = {
        messages: payloadMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        mode,
        moduleKey,
        scopePath,
        reportingYearMode,
        fiscalYear: currentFiscalYear,
        fiscalYearStart,
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

          if (event.type === "progress") {
            setMessages((current) => current.map((message) => (
              message.id === assistantMessageId
                ? { ...message, progressSteps: [...(message.progressSteps ?? []), event.message] }
                : message
            )));
            continue;
          }

          if (event.type === "thinking") {
            setMessages((current) => current.map((message) => (
              message.id === assistantMessageId
                ? { ...message, thinkingContent: (message.thinkingContent ?? "") + event.delta }
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
      return true;
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
      return false;
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
        <StewardAvatarIcon size={38} alt="Steward" className="ring-2 ring-white/70" />
      </button>
    );
  }

  if (!open && !isWorkspaceMode && aiConfig?.chatHeadEnabled === false) {
    return null;
  }

  const rootClassName = isWorkspaceMode
    ? "h-full min-h-0 max-h-full"
    : isMaximizedMode
      ? "fixed z-[92] top-[max(3.5rem,env(safe-area-inset-top))] bottom-0 left-0 right-0 sm:top-16 sm:bottom-3 sm:left-[15rem] sm:right-4 pointer-events-none"
      : isPopoutMode
        ? "fixed z-[92] top-[max(3.5rem,env(safe-area-inset-top))] bottom-0 left-0 right-0 sm:top-14 sm:bottom-6 sm:left-auto sm:right-6 sm:w-[860px] pointer-events-none"
        : "fixed z-[90] top-[max(3.4rem,env(safe-area-inset-top))] bottom-[max(0.4rem,env(safe-area-inset-bottom))] left-1.5 right-1.5 sm:top-14 sm:bottom-3 sm:left-[15rem] sm:right-5 pointer-events-none flex items-end justify-end";

  const panelClassName = isWorkspaceMode
    ? "h-full rounded-2xl border border-slate-200 bg-white shadow-sm flex flex-col overflow-hidden"
    : `pointer-events-auto border border-emerald-200 ring-1 ring-emerald-100 bg-white shadow-[0_22px_48px_rgba(15,23,42,0.14)] flex flex-col overflow-hidden transition-[height,width] duration-200 ${isMaximizedMode || isPopoutMode ? "rounded-none sm:rounded-[22px] w-full max-w-none h-full" : "rounded-[18px] sm:rounded-[22px] w-full max-w-[760px] h-[min(84dvh,760px)] sm:h-[min(78vh,760px)] max-h-full"}`;
  const panelStyle = isWorkspaceMode
    ? undefined
    : isMaximizedMode
        ? undefined
        : {
            maxHeight: isPopoutMode ? "calc(100vh - 5rem)" : "calc(100vh - 4.25rem)",
          };

  return (
    <div className={rootClassName}>
      <aside className={panelClassName} style={panelStyle}>
        <header className="px-3 border-b border-slate-100 bg-white py-2">
          {/* Top row: avatar + title + window controls */}
          <div className="flex items-center gap-2">
            {/* Steward avatar mark */}
            <StewardAvatarIcon size={24} alt="Steward" />
            <div className="min-w-0 flex-1">
              <h2 className="text-xs font-semibold leading-tight text-slate-900">Steward</h2>
            </div>

            {/* Window control buttons — icon-only */}
            <div className="flex items-center gap-0.5">
              {/* Chat history toggle (dock mode) */}
              {!isWorkspaceMode && (
                <button
                  type="button"
                  onClick={() => setConversationsOpen((v) => !v)}
                  className={`h-6 w-6 flex items-center justify-center rounded-lg border transition-colors ${conversationsOpen ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
                  title="Chat history"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
                </button>
              )}
              {/* Open full AGENTSteward workspace */}
              {!isWorkspaceMode && (
                <Link
                  href={workspaceHref}
                  className="h-6 w-6 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  title="Open AGENTSteward workspace"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </Link>
              )}
              {/* Popout */}
              {!isWorkspaceMode && !isPopoutMode && (
                <button
                  type="button"
                  onClick={() => onDisplayModeChange?.("popout")}
                  className="h-6 w-6 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  title="Popout"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5M20 8V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5M20 16v4m0 0h-4m4 0l-5-5" /></svg>
                </button>
              )}
              {/* Restore to dock from popout */}
              {!isWorkspaceMode && isPopoutMode && (
                <button
                  type="button"
                  onClick={() => onDisplayModeChange?.("dock-right")}
                  className="h-6 w-6 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  title="Return to dock"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
                </button>
              )}
              {/* Maximize */}
              {!isWorkspaceMode && !isMaximizedMode && (
                <button
                  type="button"
                  onClick={() => onDisplayModeChange?.("maximized")}
                  className="h-6 w-6 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  title="Maximize"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" /></svg>
                </button>
              )}
              {/* Restore from maximize */}
              {!isWorkspaceMode && isMaximizedMode && (
                <button
                  type="button"
                  onClick={() => onDisplayModeChange?.("dock-right")}
                  className="h-6 w-6 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors"
                  title="Return to dock"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M15 9h4.5M15 9V4.5M15 9l5.25-5.25M9 15H4.5M9 15v4.5M9 15l-5.25 5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" /></svg>
                </button>
              )}
              {/* Minimize / close */}
              {!isWorkspaceMode && (
                <button
                  type="button"
                  onClick={onClose}
                  className="h-6 w-6 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                  title="Close Steward"
                >
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              )}
              {/* Workspace exit */}
              {isWorkspaceMode && (
                <Link href="/" className="h-6 w-6 flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors" title="Exit workspace">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                </Link>
              )}
            </div>
          </div>

          {/* Second row: status pills */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            <span className={`h-5 inline-flex items-center gap-1 px-2 rounded-full border text-[10px] font-medium ${aiConfig?.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
              <span className={`h-1 w-1 rounded-full ${aiConfig?.enabled ? "bg-emerald-500" : "bg-amber-400"}`} />
              {aiConfig?.enabled ? (modelUsed || (aiConfig.mode === "local" ? "Local AI" : "Remote AI")) : "Needs Setup"}
            </span>
            <span className="h-5 inline-flex items-center px-2 rounded-full border border-slate-200 bg-white text-[10px] text-slate-600 font-medium capitalize">{moduleKey}</span>
            <button onClick={clearHistory} className="h-5 px-2 rounded-full border border-slate-200 bg-white text-[10px] text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">Clear</button>
            <button onClick={exportHistory} className="h-5 px-2 rounded-full border border-slate-200 bg-white text-[10px] text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">Export</button>
            <Link href="/settings/ai" className="h-5 inline-flex items-center px-2 rounded-full border border-slate-200 bg-white text-[10px] text-slate-500 hover:bg-slate-50 hover:text-slate-700 transition-colors">
              Settings
            </Link>
          </div>
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
                <div className={`flex-1 overflow-y-auto chat-scroll-smooth px-3 sm:px-4 pt-2.5 sm:pt-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] sm:pb-4 ${isWorkspaceMode ? "bg-slate-50/70" : "bg-slate-50/80"}`}>
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
                          <>
                          {sending && activeAssistantMessageId === message.id && (() => {
                            const effectiveMode: ChatMode = message.responseMode ?? mode;
                            const thoughtStackActive = effectiveMode !== "free";
                            return (
                              <div className="mb-1 inline-flex items-center gap-1.5">
                                <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${thoughtStackActive ? "border-cyan-300/45 bg-cyan-400/10 text-cyan-700" : "border-slate-300 bg-slate-100 text-slate-600"}`}>
                                  ThoughtStack {thoughtStackActive ? "on" : "off"}
                                </span>
                              </div>
                            );
                          })()}
                          {/* Thinking panel: progress steps + reasoning tokens (shown while streaming or after) */}
                          {(sending && activeAssistantMessageId === message.id
                            ? (message.progressSteps?.length || message.thinkingContent || !message.content.trim())
                            : (message.progressSteps?.length || message.thinkingContent)
                          ) && (
                            <StewardThinkingPanel
                              progressSteps={message.progressSteps ?? []}
                              thinkingContent={message.thinkingContent ?? ""}
                              isActive={sending && activeAssistantMessageId === message.id}
                              compact={true}
                            />
                          )}
                          {sending && activeAssistantMessageId === message.id && !message.content.trim() ? (
                            /* Dots shown only when progress panel isn't already showing */
                            !message.progressSteps?.length ? (
                            <div className={`inline-flex items-center gap-1 ${isWorkspaceMode ? "text-slate-500" : "text-slate-500"}`}>
                              <span className={`h-1.5 w-1.5 rounded-full animate-pulse ${isWorkspaceMode ? "bg-slate-500" : "bg-slate-500"}`} />
                              <span className={`h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:120ms] ${isWorkspaceMode ? "bg-slate-500" : "bg-slate-500"}`} />
                              <span className={`h-1.5 w-1.5 rounded-full animate-pulse [animation-delay:240ms] ${isWorkspaceMode ? "bg-slate-500" : "bg-slate-500"}`} />
                            </div>
                            ) : null
                          ) : (
                            <StewardResponseRenderer
                              content={message.content}
                              structured={message.structured}
                              tone="light"
                              compact={true}
                              toolsUsed={message.toolsUsed}
                              recordsUsed={message.recordsUsed}
                              provider={message.provider}
                              moduleKey={message.moduleKey}
                              generatedAt={message.createdAt}
                              onSuggestedAction={async (action) => {
                                const actionIndex = message.structured?.suggestedActions.findIndex((candidate) => (
                                  candidate.label === action.label && candidate.actionType === action.actionType
                                )) ?? -1;
                                if (actionIndex >= 0) {
                                  await runSuggestedAction(message.id, actionIndex);
                                }
                              }}
                              onRegenerate={aiConfig?.enabled ? () => { void regenerateAssistantMessage(message.id); } : undefined}
                              onAskReportQuestion={(prompt) => {
                                const contextTitle = (message.structured?.artifacts?.find((artifact) => artifact.type === "report_card") as { title?: string } | undefined)?.title || "report artifact";
                                void sendMessage(`Report artifact follow-up (${contextTitle}): ${prompt}`);
                              }}
                            />
                          )}
                          </>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                        )}
                      </div>
                      <div className={`mt-1 text-[11px] flex items-center gap-2 ${isWorkspaceMode ? "text-[#8b949e]" : "text-slate-500"} ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                        <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                  ))}
                  <div ref={messagesBottomRef} />
                  </div>
                </div>

                <footer className="border-t border-slate-200 bg-white/95 px-2.5 sm:px-3 pt-2.5 sm:pt-3 pb-[max(0.6rem,env(safe-area-inset-bottom))] sm:pb-3">
                  <div className={`mx-auto rounded-2xl border p-2.5 sm:p-3 shadow-[0_14px_24px_rgba(15,23,42,0.08)] ${isWorkspaceMode ? "max-w-4xl border-slate-200 bg-white" : "max-w-[680px] border-slate-200 bg-white"}`}>
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

                        {/* Fiscal year mode toggle — locks Steward context to FY vs calendar year */}
                        {moduleKey === "donor" || moduleKey === "oshareview" ? (
                          <button
                            type="button"
                            onClick={toggleReportingYearMode}
                            title={
                              reportingYearMode === "fiscal"
                                ? `Fiscal year mode on — FY${getFiscalYearForDate(new Date(), fiscalYearStart)} (month ${fiscalYearStart}–${getFiscalYearEndMonth(fiscalYearStart)}). Click for calendar year.`
                                : `Calendar year mode — ${new Date().getFullYear()}. Click for fiscal year mode.`
                            }
                            className={`h-8 inline-flex items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-all ${
                              reportingYearMode === "fiscal"
                                ? "border-emerald-500/60 bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25"
                                : "border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-slate-100"
                            }`}
                          >
                            <span className={`flex h-3.5 w-3.5 items-center justify-center rounded border text-[9px] font-bold leading-none ${
                              reportingYearMode === "fiscal"
                                ? "border-emerald-500/60 bg-emerald-600/20 text-emerald-700"
                                : "border-slate-300 bg-slate-100 text-slate-500"
                            }`}>
                              {reportingYearMode === "fiscal" ? "FY" : "CY"}
                            </span>
                            <span>
                              {reportingYearMode === "fiscal"
                                ? `FY${getFiscalYearForDate(new Date(), fiscalYearStart)}`
                                : String(new Date().getFullYear())}
                            </span>
                          </button>
                        ) : null}
                      </div>
                      <p className="text-[11px] text-slate-500">Confirm-first for write actions.</p>
                    </div>

                    {filteredPromptChips.length > 0 && (
                      <div className="mt-2 hidden sm:flex flex-wrap items-center gap-1.5">
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

                    <div className="mt-2 flex items-end gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-sm focus-within:border-slate-300 focus-within:shadow-md transition-all">
                      <input
                        ref={composerInputRef}
                        type="text"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        onKeyDown={handleComposerKeyDown}
                        placeholder={aiConfig?.enabled ? "Ask Steward…" : "Enable Steward AI in Settings."}
                        disabled={!aiConfig?.enabled || sending}
                        className="h-8 flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                      />
                      {sending ? (
                        <button
                          type="button"
                          onClick={stopGeneration}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 transition-colors"
                          title="Stop generation"
                        >
                          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void sendMessage()}
                          disabled={!aiConfig?.enabled || sending || draft.trim().length === 0}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                          title="Send (Enter)"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                </footer>
              </section>
            </div>
          </>
      </aside>
    </div>
  );
}
