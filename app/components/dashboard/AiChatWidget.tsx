"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ChatMessage {
  id: string;
  role: "assistant" | "user";
  content: string;
}

interface StewardChatResponse {
  reply: string;
  model?: string;
  provider?: string;
}

interface AiChatWidgetProps {
  dashboardEnabled: boolean;
  onEnableDashboardAi: () => void;
}

/** AiChatWidget provides a compact ask-and-reply Steward chat inside the dashboard. */
export default function AiChatWidget({ dashboardEnabled, onEnableDashboardAi }: AiChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "Ask Steward for a quick donor insight, follow-up recommendation, or campaign suggestion.",
    },
  ]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<string | null>(null);

  const workspaceHref = useMemo(() => {
    const params = new URLSearchParams({ module: "donor", scope: "/" });
    return `/steward-ai-workspace?${params.toString()}`;
  }, []);

  async function sendMessage() {
    const prompt = draft.trim();
    if (!prompt || sending) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: prompt,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft("");
    setSending(true);
    setError(null);
    setMeta(null);

    try {
      const response = await apiFetch<StewardChatResponse>("/api/steward-ai/chat", {
        method: "POST",
        body: JSON.stringify({
          messages: nextMessages.map((message) => ({ role: message.role, content: message.content })),
          mode: "ask",
          moduleKey: "donor",
          scopePath: "/",
        }),
      });

      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: response.reply || "Steward did not return a response.",
        },
      ]);

      const provider = response.provider ? `Provider: ${response.provider}` : null;
      const model = response.model ? `Model: ${response.model}` : null;
      setMeta([provider, model].filter(Boolean).join(" · ") || null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Steward chat request failed.");
    } finally {
      setSending(false);
    }
  }

  if (!dashboardEnabled) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
        <p className="text-xs font-semibold text-gray-700">Dashboard AI chat is disabled.</p>
        <p className="text-xs text-gray-600 mt-1">Enable AI widgets to use the compact Steward chat card.</p>
        <button
          type="button"
          onClick={onEnableDashboardAi}
          className="mt-2 px-3 py-1.5 text-xs font-semibold rounded-md border border-green-200 bg-green-50 text-green-700"
        >
          Enable AI widgets
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
        {messages.slice(-6).map((message) => (
          <div
            key={message.id}
            className={`rounded-lg border px-2.5 py-2 text-xs ${message.role === "assistant" ? "border-green-200 bg-green-50 text-green-900" : "border-gray-200 bg-gray-50 text-gray-800"}`}
          >
            <p className="font-semibold uppercase tracking-wide text-[10px] opacity-80">{message.role === "assistant" ? "Steward" : "You"}</p>
            <p className="mt-1 whitespace-pre-wrap">{message.content}</p>
          </div>
        ))}
      </div>

      {error ? (
        <p className="text-xs text-red-600">{error}</p>
      ) : null}
      {meta ? (
        <p className="text-[11px] text-gray-500">{meta}</p>
      ) : null}

      <div className="flex items-center gap-2">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void sendMessage();
            }
          }}
          placeholder="Ask Steward a quick question"
          className="flex-1 rounded-md border border-gray-300 px-2.5 py-1.5 text-xs"
        />
        <button
          type="button"
          onClick={() => void sendMessage()}
          disabled={sending || !draft.trim()}
          className="px-3 py-1.5 text-xs font-semibold rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-60"
        >
          {sending ? "Sending..." : "Ask"}
        </button>
      </div>

      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => {
            setMessages([
              {
                id: crypto.randomUUID(),
                role: "assistant",
                content: "Ask Steward for a quick donor insight, follow-up recommendation, or campaign suggestion.",
              },
            ]);
            setError(null);
            setMeta(null);
          }}
          className="text-[11px] font-semibold text-gray-500 hover:text-gray-700"
        >
          Clear chat
        </button>

        <Link href={workspaceHref} className="text-[11px] font-semibold text-green-700 hover:underline">
          Open full AI workspace
        </Link>
      </div>
    </div>
  );
}
