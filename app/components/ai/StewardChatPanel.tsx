/** StewardChatPanel is the right-side AI workspace for chat, tools, and safe action prompts. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type ModuleKey = "donor" | "compassion" | "events";
type ChatMode = "ask" | "analyze" | "draft" | "action" | "help";

interface StewardChatPanelProps {
  open: boolean;
  onClose: () => void;
  moduleKey: ModuleKey;
  scopePath: string;
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
}

interface StewardChatResponse {
  reply: string;
  model: string;
  mode: string;
  provider: string;
  toolsUsed: string[];
}

const CHAT_HISTORY_LIMIT = 60;

/** Returns localStorage key for module-specific chat history persistence. */
function chatStorageKey(moduleKey: ModuleKey): string {
  return `steward-chat-history:v1:${moduleKey}`;
}

/** Safely parses persisted message history from localStorage. */
function readStoredMessages(moduleKey: ModuleKey): UiMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(chatStorageKey(moduleKey));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as UiMessage[];
    return Array.isArray(parsed)
      ? parsed
          .filter((message) => message && typeof message.content === "string" && typeof message.role === "string")
          .map((message) => ({
            id: String(message.id ?? crypto.randomUUID()),
            role: message.role === "assistant" ? "assistant" : "user",
            content: message.content,
            createdAt: typeof message.createdAt === "string" && message.createdAt.length > 0
              ? message.createdAt
              : new Date().toISOString(),
            toolsUsed: Array.isArray(message.toolsUsed)
              ? message.toolsUsed.filter((item) => typeof item === "string")
              : undefined,
          }))
          .slice(-CHAT_HISTORY_LIMIT)
      : [];
  } catch {
    return [];
  }
}

/** Saves bounded message history to localStorage for the current module. */
function writeStoredMessages(moduleKey: ModuleKey, messages: UiMessage[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(chatStorageKey(moduleKey), JSON.stringify(messages.slice(-CHAT_HISTORY_LIMIT)));
}

const MODE_BUTTONS: Array<{ key: ChatMode; label: string }> = [
  { key: "ask", label: "Ask" },
  { key: "analyze", label: "Analyze" },
  { key: "draft", label: "Draft" },
  { key: "action", label: "Action" },
  { key: "help", label: "Help" },
];

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

  return [
    "Summarize what I should focus on today.",
    "Identify likely lapsed-donor follow-ups.",
    "Draft a donor stewardship check-in email.",
  ];
}

/** StewardChatPanel renders a slide-over AI assistant with mode tools and chat history. */
export default function StewardChatPanel({ open, onClose, moduleKey, scopePath }: StewardChatPanelProps) {
  const [aiConfig, setAiConfig] = useState<AiConfigPayload | null>(null);
  const [mode, setMode] = useState<ChatMode>("ask");
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);

  const promptChips = useMemo(() => promptsForModule(moduleKey), [moduleKey]);

  /** Auto-scrolls to latest message whenever conversation changes. */
  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /** Loads persisted chat history when module changes. */
  useEffect(() => {
    const stored = readStoredMessages(moduleKey);
    if (stored.length > 0) {
      setMessages(stored);
    } else {
      setMessages([]);
    }
  }, [moduleKey]);

  /** Persists chat history as messages update. */
  useEffect(() => {
    if (messages.length === 0) return;
    writeStoredMessages(moduleKey, messages);
  }, [moduleKey, messages]);

  /** Locks page scrolling while the AI panel is open. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /** Handles keyboard close shortcuts while panel is open. */
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  /** Loads AI config each time panel opens so status is always current. */
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function loadConfig() {
      setLoadingConfig(true);
      setError(null);
      try {
        const response = await apiFetch<AiConfigPayload>("/api/steward-ai/config");
        if (cancelled) return;
        setAiConfig(response);

        if (messages.length === 0) {
          setMessages([
            {
              id: crypto.randomUUID(),
              role: "assistant",
              createdAt: new Date().toISOString(),
              content: response.enabled
                ? "Steward is ready with CRM retrieval tools. Ask, analyze, draft, or action with explicit confirmation for writes."
                : "Steward AI is not enabled yet. Open Settings > AI Assistant to configure local or remote Ollama.",
            },
          ]);
        }
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
  }, [open]);

  /** Clears local chat history for the active module and resets panel state. */
  function clearHistory() {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(chatStorageKey(moduleKey));
    }
    setMessages([]);
    setDraft("");
    setError(null);
  }

  /** Exports current conversation to a downloadable JSON file. */
  function exportHistory() {
    if (typeof window === "undefined" || messages.length === 0) return;
    const payload = {
      moduleKey,
      scopePath,
      exportedAt: new Date().toISOString(),
      messages,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `steward-chat-${moduleKey}-${Date.now()}.json`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  /** Sends a chat request to backend API and appends assistant response. */
  async function sendMessage(content?: string) {
    const text = (content ?? draft).trim();
    if (!text || sending) return;

    const nextUserMessage: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      createdAt: new Date().toISOString(),
    };

    const nextMessages = [...messages, nextUserMessage];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const payload = {
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
        mode,
        moduleKey,
        scopePath,
      };

      const response = await apiFetch<StewardChatResponse>("/api/steward-ai/chat", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setModelUsed(response.model);

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply,
          createdAt: new Date().toISOString(),
          toolsUsed: response.toolsUsed,
        },
      ]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Steward request failed.");
    } finally {
      setSending(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80]">
      <button
        aria-label="Close Steward panel backdrop"
        className="absolute inset-0 bg-black/35"
        onClick={onClose}
      />

      <aside className="absolute inset-y-0 right-0 w-full sm:w-[470px] lg:w-[560px] bg-white border-l border-gray-200 shadow-2xl flex flex-col">
        <header className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-green-50 via-white to-emerald-50">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Steward</h2>
              <p className="text-xs text-gray-600">Grounded answers with module-aware retrieval and safe action planning.</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${aiConfig?.enabled ? "border-green-200 bg-green-50 text-green-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>
                {aiConfig?.enabled ? `${aiConfig.mode === "local" ? "Local" : "Remote"} Ollama` : "Needs Setup"}
              </span>
              <button
                onClick={onClose}
                className="h-8 w-8 rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-100"
                title="Close Steward"
              >
                ×
              </button>
            </div>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-gray-600">
            <span>Module: <span className="font-medium capitalize">{moduleKey}</span></span>
            <span>{modelUsed ? `Model: ${modelUsed}` : "Model not used yet"}</span>
          </div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            {MODE_BUTTONS.map((button) => (
              <button
                key={button.key}
                onClick={() => setMode(button.key)}
                className={`px-2.5 py-1 rounded-full border text-xs font-medium ${mode === button.key ? "border-green-300 bg-green-50 text-green-700" : "border-gray-300 text-gray-600 hover:bg-white"}`}
              >
                {button.label}
              </button>
            ))}
          </div>

          <div className="mt-2 text-xs text-gray-500 flex items-center justify-between gap-2">
            <span>Scope: {scopePath}</span>
            <div className="flex items-center gap-3">
              <button onClick={clearHistory} className="text-gray-600 hover:text-gray-900">
                Clear
              </button>
              <button onClick={exportHistory} className="text-gray-600 hover:text-gray-900">
                Export
              </button>
              <Link href="/settings/ai" className="text-green-700 font-medium hover:underline">
                AI Settings
              </Link>
            </div>
          </div>
        </header>

        {!aiConfig?.enabled && !loadingConfig && (
          <div className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            Steward AI is disabled. Configure local or remote Ollama in AI Settings.
          </div>
        )}

        {error && (
          <div className="mx-4 mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
            {error}
          </div>
        )}

        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2 bg-white">
          {promptChips.map((prompt) => (
            <button
              key={prompt}
              onClick={() => {
                setDraft(prompt);
              }}
              className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-700 hover:bg-gray-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 bg-[radial-gradient(circle_at_top,_#ecfdf5,_#ffffff_45%)]">
          {messages.map((message) => (
            <div key={message.id} className={`max-w-[92%] ${message.role === "user" ? "ml-auto" : "mr-auto"}`}>
              <div
                className={`rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap shadow-sm border ${
                  message.role === "user"
                    ? "bg-green-600 text-white border-green-600"
                    : "bg-white text-gray-800 border-gray-200"
                }`}
              >
                {message.content}
              </div>
              <div className={`mt-1 text-[11px] text-gray-500 flex items-center gap-2 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              {message.role === "assistant" && message.toolsUsed && message.toolsUsed.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {message.toolsUsed.map((tool) => (
                    <span key={tool} className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                      Tool: {tool}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesBottomRef} />
        </div>

        <footer className="border-t border-gray-200 p-3 space-y-2 bg-gray-50">
          <textarea
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={aiConfig?.enabled ? "Ask Steward something about this page..." : "Enable Steward AI in Settings before chatting."}
            rows={3}
            disabled={!aiConfig?.enabled || sending}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100 disabled:text-gray-400"
          />
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] text-gray-500">
              Tools run automatically per message. Write actions remain confirm-first.
            </p>
            <button
              onClick={() => void sendMessage()}
              disabled={!aiConfig?.enabled || sending || draft.trim().length === 0}
              className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
            >
              {sending ? "Sending..." : "Send"}
            </button>
          </div>
        </footer>
      </aside>
    </div>
  );
}
