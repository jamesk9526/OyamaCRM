/** OGenticChatPanel renders the primary agentic conversation workspace and composer controls. */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import StewardMessageRenderer from "@/app/components/ai/StewardMessageRenderer";
import { useOGenticChat } from "@/app/modules/ogentic/hooks/useOGenticChat";
import { runOGenticAgent } from "@/app/modules/ogentic/services/ogenticAgentService";
import type { OGenticExecutionContext } from "@/app/modules/ogentic/types/ogentic.types";
import type { StewardToOGenticHandoff } from "@/app/modules/ogentic/types/ogentic.types";

interface OGenticChatPanelProps {
  handoff: StewardToOGenticHandoff | null;
  onCreateDraftArtifact: (title: string, content: unknown) => void;
}

interface WorkspaceMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt: string;
  model?: string;
  provider?: string;
  toolsUsed?: string[];
}

const SCOPE_OPTIONS: Array<{ id: string; label: string }> = [
  { id: "donor", label: "Donor CRM" },
  { id: "events", label: "Events CRM" },
  { id: "compassion", label: "Compassion CRM" },
  { id: "communications", label: "Communications" },
  { id: "reports", label: "Reports" },
];

/** Converts UI scope IDs into OGentic execution scope values. */
function toExecutionScopes(scopes: string[]): OGenticExecutionContext["moduleScope"] {
  const normalized: OGenticExecutionContext["moduleScope"] = [];

  if (scopes.includes("donor") || scopes.includes("reports")) {
    normalized.push("donor");
  }
  if (scopes.includes("events")) {
    normalized.push("event");
  }
  if (scopes.includes("compassion")) {
    normalized.push("client");
  }
  if (scopes.includes("communications")) {
    normalized.push("communication");
  }

  return normalized.length > 0 ? normalized : ["donor"];
}

/** OGenticChatPanel provides a large ChatGPT-style shell for multi-step cross-module workflows. */
export default function OGenticChatPanel({ handoff, onCreateDraftArtifact }: OGenticChatPanelProps) {
  const [messages, setMessages] = useState<WorkspaceMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Welcome to OGentic. Ask for cross-module analysis, planning, and draft generation.",
      createdAt: new Date().toISOString(),
    },
  ]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftOnly, setDraftOnly] = useState(true);
  const [selectedScopes, setSelectedScopes] = useState<string[]>(["donor", "events", "reports"]);
  const messagesBottomRef = useRef<HTMLDivElement | null>(null);
  const handoffAppliedRef = useRef(false);
  const { draft, setDraft, canSubmit, chatTitle, startNewChat } = useOGenticChat(handoff?.prompt ?? "");

  const suggestedPrompts = useMemo(
    () => [
      "Analyze donor opportunities this week",
      "Find lapsed donors with next steps",
      "Draft thank-you outreach for last week's gifts",
      "Summarize campaign performance and action items",
    ],
    []
  );

  /** Keeps the conversation pinned to the newest assistant/user message. */
  useEffect(() => {
    messagesBottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  /** Applies a one-time Steward handoff prompt once OGentic has loaded the handoff payload. */
  useEffect(() => {
    if (!handoff || handoffAppliedRef.current) return;
    if (handoff.prompt.trim().length > 0) {
      setDraft(handoff.prompt);
    }
    handoffAppliedRef.current = true;
  }, [handoff, setDraft]);

  /** Sends the current prompt to OGentic's live agent endpoint and appends the response. */
  async function handleSubmit() {
    if (!canSubmit || sending) return;

    const submitted = draft.trim();
    const assistantMessageId = crypto.randomUUID();
    const userMessage: WorkspaceMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: submitted,
      createdAt: new Date().toISOString(),
    };

    const requestHistory = [...messages, userMessage].map((message) => ({
      role: message.role,
      content: message.content,
    }));

    setError(null);
    setSending(true);
    setMessages((current) => [
      ...current,
      userMessage,
      {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        createdAt: new Date().toISOString(),
      },
    ]);
    setDraft("");

    try {
      const response = await runOGenticAgent(
        {
          prompt: submitted,
          draftOnly,
          scopes: selectedScopes,
          messages: requestHistory,
        },
        {
          moduleScope: toExecutionScopes(selectedScopes),
          sourceRoute: handoff?.sourceRoute ?? "/ogentic",
        }
      );

      setMessages((current) =>
        current.map((message) => {
          if (message.id !== assistantMessageId) return message;
          return {
            ...message,
            content: response.reply,
            model: response.model,
            provider: response.provider,
            toolsUsed: response.toolsUsed,
          };
        })
      );

      const artifactTitle = submitted.length > 56 ? `${submitted.slice(0, 56)}...` : submitted;
      onCreateDraftArtifact(`OGentic: ${artifactTitle}`, {
        prompt: submitted,
        draftOnly,
        selectedScopes,
        response,
      });
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : "OGentic request failed.";
      setError(message);
      setMessages((current) =>
        current.map((item) => {
          if (item.id !== assistantMessageId) return item;
          return {
            ...item,
            content: `I could not complete that request: ${message}`,
          };
        })
      );
    } finally {
      setSending(false);
    }
  }

  /** Starts a new workspace chat shell and clears current message state. */
  function handleNewChat() {
    startNewChat();
    setError(null);
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "New OGentic workspace chat started. Ask a cross-module question to begin.",
        createdAt: new Date().toISOString(),
      },
    ]);
  }

  /** Sends prompts on Enter while preserving Shift+Enter for multiline drafts. */
  function handleComposerKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    void handleSubmit();
  }

  return (
    <section className="h-full min-h-0 flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <header className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="mx-auto w-full max-w-4xl flex items-center justify-between gap-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900">{chatTitle}</h1>
            <p className="text-xs text-slate-500 mt-1">Lightweight agentic workspace with live CRM-backed AI responses</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
              Live AI
            </span>
            <button
              onClick={handleNewChat}
              className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              New Chat
            </button>
          </div>
        </div>

        {handoff && (
          <div className="mx-auto mt-3 w-full max-w-4xl rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Handoff loaded from {handoff.sourceRoute}. Prompt is ready in the composer.
          </div>
        )}

        <div className="mx-auto mt-3 flex w-full max-w-4xl flex-wrap gap-2">
          {suggestedPrompts.map((prompt) => (
            <button
              key={prompt}
              onClick={() => setDraft(prompt)}
              className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs text-slate-700 hover:bg-slate-100"
            >
              {prompt}
            </button>
          ))}
        </div>
      </header>

      <div className="flex-1 min-h-0 overflow-y-auto bg-slate-50/70">
        <div className="mx-auto w-full max-w-4xl space-y-5 px-4 py-5">
          {messages.map((message) => (
            <article key={message.id} className={message.role === "assistant" ? "max-w-none" : "ml-auto max-w-2xl"}>
              <div
                className={`rounded-2xl border px-4 py-3 shadow-sm ${
                  message.role === "assistant"
                    ? "border-slate-200 bg-white text-slate-800"
                    : "border-slate-900 bg-slate-900 text-white"
                }`}
              >
                {message.role === "assistant" ? (
                  message.content.trim().length > 0 ? (
                    <StewardMessageRenderer content={message.content} tone="light" />
                  ) : (
                    <div className="inline-flex items-center gap-1 text-slate-500">
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:120ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-pulse [animation-delay:240ms]" />
                    </div>
                  )
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                )}
              </div>

              <div className={`mt-1.5 flex items-center gap-2 text-[11px] text-slate-500 ${message.role === "assistant" ? "justify-start" : "justify-end"}`}>
                <span>{new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                {message.model && <span>Model: {message.model}</span>}
                {message.provider && <span>Provider: {message.provider}</span>}
              </div>

              {message.role === "assistant" && message.toolsUsed && message.toolsUsed.length > 0 && (
                <details className="mt-1.5">
                  <summary className="cursor-pointer text-[11px] text-slate-500">Tools used</summary>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {message.toolsUsed.map((tool) => (
                      <span key={`${message.id}-${tool}`} className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {tool}
                      </span>
                    ))}
                  </div>
                </details>
              )}
            </article>
          ))}
          <div ref={messagesBottomRef} />
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white px-4 py-4">
        <div className="mx-auto w-full max-w-4xl space-y-3">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <details className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <summary className="cursor-pointer font-medium text-slate-700">Context and safety</summary>
            <div className="mt-2 space-y-2">
              <div className="flex flex-wrap items-center gap-3">
                {SCOPE_OPTIONS.map((scope) => (
                  <label key={scope.id} className="inline-flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={selectedScopes.includes(scope.id)}
                      onChange={(event) => {
                        setSelectedScopes((current) => {
                          if (event.target.checked) {
                            return [...current, scope.id];
                          }
                          return current.filter((entry) => entry !== scope.id);
                        });
                      }}
                    />
                    {scope.label}
                  </label>
                ))}
              </div>
              <label className="inline-flex items-center gap-2">
                <input type="checkbox" checked={draftOnly} onChange={(event) => setDraftOnly(event.target.checked)} />
                Draft only (avoid direct write actions)
              </label>
            </div>
          </details>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleComposerKeyDown}
              placeholder="Message OGentic..."
              rows={3}
              disabled={sending}
              className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100"
            />

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-slate-500">
                {sending ? "OGentic is thinking..." : "Enter sends. Shift+Enter adds a new line."}
              </p>
              <button
                onClick={() => void handleSubmit()}
                disabled={!canSubmit || sending}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </div>
          </div>
        </div>
      </footer>
    </section>
  );
}
