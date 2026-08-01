/**
 * StewardCopilotWorkspace — focused, Copilot-style command surface for Steward AI.
 * Keeps the existing permissioned streaming API and artifact renderer while removing
 * the previous feature-heavy standalone chat workspace.
 */
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetchResponse } from "@/app/lib/auth-client";
import StewardResponseRenderer from "@/app/components/ai/StewardResponseRenderer";
import { StewardThinkingPanel, type ActiveTool } from "@/app/components/ai/StewardThinkingPanel";
import type { StewardStructuredResponse } from "@/app/components/ai/steward-artifact-types";

type ModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "all";
type ChatMode = "ask" | "analyze" | "draft" | "agentic" | "action" | "help";

interface CopilotMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  structured?: StewardStructuredResponse;
  toolsUsed?: string[];
  recordsUsed?: string[];
  provider?: string;
  progressSteps?: string[];
  activeTools?: ActiveTool[];
  progressPercent?: number;
  progressStage?: string;
}

interface CopilotThread {
  id: string;
  title: string;
  updatedAt: string;
  moduleKey: ModuleKey;
  messages: CopilotMessage[];
}

interface StreamChunk { type: "chunk"; delta: string; }
interface StreamProgress { type: "progress"; message: string; stage?: string; percent?: number; }
interface StreamTool { type: "tool"; name: string; label: string; status: "start" | "done"; }
interface StreamDone {
  type: "done";
  reply: string;
  structured?: StewardStructuredResponse;
  model: string;
  provider: string;
  toolsUsed: string[];
  recordsUsed?: string[];
}
interface StreamError { type: "error"; message: string; }
type StreamEvent = StreamChunk | StreamProgress | StreamTool | StreamDone | StreamError;

const STORAGE_KEY = "oyama.steward-copilot.threads.v1";

const MODULES: Array<{ value: ModuleKey; label: string; description: string }> = [
  { value: "donor", label: "Donor CRM", description: "Donors, gifts, campaigns, and stewardship" },
  { value: "compassion", label: "Compassion CRM", description: "Client care and follow-up" },
  { value: "events", label: "Events CRM", description: "Guests, registration, and operations" },
  { value: "watchdog", label: "Watchdog", description: "Security and audit activity" },
  { value: "webmaster", label: "Webmaster", description: "Website operations and planning" },
  { value: "all", label: "All workspaces", description: "Use Donor CRM data for cross-workspace planning" },
];

const MODE_OPTIONS: Array<{ value: ChatMode; label: string; description: string }> = [
  { value: "ask", label: "Ask", description: "Grounded answer using live CRM context" },
  { value: "analyze", label: "Analyze", description: "Find trends, risks, and performance drivers" },
  { value: "draft", label: "Draft", description: "Create review-ready outreach or content" },
  { value: "agentic", label: "Research", description: "Use the smallest relevant set of read tools" },
  { value: "action", label: "Plan", description: "Propose a safe, confirm-first action plan" },
  { value: "help", label: "Help", description: "Explain a CRM workflow step by step" },
];

const STARTERS: Array<{ label: string; prompt: string; mode: ChatMode }> = [
  { label: "Daily priorities", prompt: "What are the most important stewardship priorities for today?", mode: "ask" },
  { label: "Retention risks", prompt: "Analyze current donor retention risks and recommend the highest-value next actions.", mode: "analyze" },
  { label: "Thank-you draft", prompt: "Draft a warm, review-ready thank-you email for a recent donor.", mode: "draft" },
  { label: "Build a path", prompt: "Help me plan a safe Steward Path for new donor follow-up.", mode: "action" },
];

function newThread(moduleKey: ModuleKey): CopilotThread {
  return {
    id: crypto.randomUUID(),
    title: "New conversation",
    updatedAt: new Date().toISOString(),
    moduleKey,
    messages: [],
  };
}

function titleFromPrompt(prompt: string): string {
  const clean = prompt.replace(/\s+/g, " ").trim();
  return clean.length > 46 ? `${clean.slice(0, 46).trim()}…` : clean || "New conversation";
}

function formatThreadTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const age = Date.now() - date.getTime();
  if (age < 86_400_000) return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function safeStoredThreads(raw: string | null): CopilotThread[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((thread): thread is CopilotThread => Boolean(thread) && typeof thread.id === "string" && Array.isArray(thread.messages));
  } catch {
    return [];
  }
}

export default function StewardCopilotWorkspace({ initialModule = "donor", initialThreadId }: { initialModule?: ModuleKey; initialThreadId?: string }) {
  const [threads, setThreads] = useState<CopilotThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(initialThreadId ?? null);
  const [moduleKey, setModuleKey] = useState<ModuleKey>(initialModule);
  const [mode, setMode] = useState<ChatMode>("ask");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [modelLabel, setModelLabel] = useState("Steward runtime");
  const [hydrated, setHydrated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const restored = safeStoredThreads(window.sessionStorage.getItem(STORAGE_KEY));
    setThreads(restored);
    const requested = initialThreadId && restored.some((thread) => thread.id === initialThreadId) ? initialThreadId : restored[0]?.id ?? null;
    setActiveThreadId(requested);
    setHydrated(true);
  }, [initialThreadId]);

  useEffect(() => {
    if (!hydrated) return;
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, 30)));
  }, [hydrated, threads]);

  const activeThread = useMemo(() => threads.find((thread) => thread.id === activeThreadId) ?? null, [activeThreadId, threads]);
  const activeMessages = activeThread?.messages ?? [];
  const activeModule = MODULES.find((item) => item.value === moduleKey) ?? MODULES[0];
  const activeMode = MODE_OPTIONS.find((item) => item.value === mode) ?? MODE_OPTIONS[0];

  useEffect(() => {
    if (!scrollRef.current) return;
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [activeMessages, sending]);

  const updateActiveThread = useCallback((updater: (thread: CopilotThread) => CopilotThread) => {
    setThreads((current) => current.map((thread) => thread.id === activeThreadId ? updater(thread) : thread));
  }, [activeThreadId]);

  const startNewThread = useCallback((nextModule = moduleKey) => {
    const thread = newThread(nextModule);
    setThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
    setModuleKey(nextModule);
    setDraft("");
    setError(null);
    setSidebarOpen(false);
    window.setTimeout(() => composerRef.current?.focus(), 0);
  }, [moduleKey]);

  const ensureThread = useCallback((): CopilotThread => {
    if (activeThread) return activeThread;
    const thread = newThread(moduleKey);
    setThreads((current) => [thread, ...current]);
    setActiveThreadId(thread.id);
    return thread;
  }, [activeThread, moduleKey]);

  const stopGeneration = useCallback(() => abortRef.current?.abort(), []);

  const send = useCallback(async (promptOverride?: string, modeOverride?: ChatMode) => {
    const prompt = (promptOverride ?? draft).trim();
    if (!prompt || sending) return;

    const thread = ensureThread();
    const selectedMode = modeOverride ?? mode;
    const userMessage: CopilotMessage = { id: crypto.randomUUID(), role: "user", content: prompt, createdAt: new Date().toISOString() };
    const assistantId = crypto.randomUUID();
    const assistantMessage: CopilotMessage = { id: assistantId, role: "assistant", content: "", createdAt: new Date().toISOString(), progressSteps: [], activeTools: [] };
    const priorMessages = thread.messages;
    const nextMessages = [...priorMessages, userMessage, assistantMessage];

    setThreads((current) => current.map((candidate) => candidate.id === thread.id ? {
      ...candidate,
      title: candidate.messages.length === 0 ? titleFromPrompt(prompt) : candidate.title,
      updatedAt: new Date().toISOString(),
      messages: nextMessages,
    } : candidate));
    setActiveThreadId(thread.id);
    setDraft("");
    setSending(true);
    setError(null);

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const response = await apiFetchResponse("/api/steward-ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          messages: [...priorMessages, userMessage].map((message) => ({ role: message.role, content: message.content })),
          mode: selectedMode,
          moduleKey: moduleKey === "all" ? "donor" : moduleKey,
          scopePath: "/steward-ai-workspace",
        }),
        signal: controller.signal,
      });
      if (!response.ok || !response.body) {
        const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? `Steward request failed (${response.status}).`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let streamed = "";
      let completed: StreamDone | null = null;

      const patchAssistant = (patch: (message: CopilotMessage) => CopilotMessage) => {
        setThreads((current) => current.map((candidate) => candidate.id !== thread.id ? candidate : {
          ...candidate,
          updatedAt: new Date().toISOString(),
          messages: candidate.messages.map((message) => message.id === assistantId ? patch(message) : message),
        }));
      };

      const consume = (event: StreamEvent) => {
        if (event.type === "chunk") {
          streamed += event.delta;
          patchAssistant((message) => ({ ...message, content: message.content + event.delta }));
          return;
        }
        if (event.type === "progress") {
          patchAssistant((message) => ({
            ...message,
            progressSteps: [...(message.progressSteps ?? []), event.message],
            progressPercent: typeof event.percent === "number" ? event.percent : message.progressPercent,
            progressStage: event.stage ?? message.progressStage,
          }));
          return;
        }
        if (event.type === "tool") {
          patchAssistant((message) => {
            const tools = message.activeTools ?? [];
            return event.status === "start"
              ? { ...message, activeTools: [...tools, { name: event.name, label: event.label, status: "active" }] }
              : { ...message, activeTools: tools.map((tool) => tool.name === event.name ? { ...tool, status: "done" } : tool) };
          });
          return;
        }
        if (event.type === "done") completed = event;
        if (event.type === "error") throw new Error(event.message || "Steward could not complete the request.");
      };

      while (!completed) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let lineEnd = buffer.indexOf("\n");
        while (lineEnd >= 0) {
          const line = buffer.slice(0, lineEnd).trim();
          buffer = buffer.slice(lineEnd + 1);
          lineEnd = buffer.indexOf("\n");
          if (line) consume(JSON.parse(line) as StreamEvent);
          if (completed) break;
        }
      }
      if (!completed && buffer.trim()) consume(JSON.parse(buffer.trim()) as StreamEvent);
      if (!completed) throw new Error("Steward response ended before completion.");
      const completedResult = completed as StreamDone;

      setModelLabel(completedResult.model || "Steward runtime");
      patchAssistant((message) => ({
        ...message,
        content: completedResult.reply || streamed || message.content,
        structured: completedResult.structured,
        toolsUsed: completedResult.toolsUsed,
        recordsUsed: completedResult.recordsUsed,
        provider: completedResult.provider,
        activeTools: (message.activeTools ?? []).map((tool) => ({ ...tool, status: "done" })),
      }));
    } catch (requestError) {
      const aborted = requestError instanceof Error && requestError.name === "AbortError";
      setThreads((current) => current.map((candidate) => candidate.id !== thread.id ? candidate : {
        ...candidate,
        messages: candidate.messages.filter((message) => message.id !== assistantId || message.content.trim().length > 0),
      }));
      if (!aborted) setError(requestError instanceof Error ? requestError.message : "Steward could not complete the request.");
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }, [draft, ensureThread, mode, moduleKey, sending, updateActiveThread]);

  function clearCurrentThread() {
    if (!activeThread || sending) return;
    updateActiveThread((thread) => ({ ...thread, title: "New conversation", messages: [], updatedAt: new Date().toISOString() }));
    setError(null);
  }

  function removeThread(threadId: string) {
    if (sending && threadId === activeThreadId) return;
    setThreads((current) => current.filter((thread) => thread.id !== threadId));
    if (threadId === activeThreadId) setActiveThreadId(null);
  }

  return (
    <div className="flex h-full min-h-0 bg-[#f7f8fa] text-slate-950">
      {sidebarOpen ? <button aria-label="Close conversations" type="button" onClick={() => setSidebarOpen(false)} className="fixed inset-0 z-30 bg-slate-950/30 lg:hidden" /> : null}
      <aside className={`fixed inset-y-0 left-0 z-40 flex w-[290px] flex-col border-r border-slate-200 bg-white shadow-xl transition-transform lg:static lg:translate-x-0 lg:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0f6cbd] text-lg font-black text-white shadow-sm">✦</div>
          <div className="min-w-0"><p className="text-sm font-bold tracking-tight">Steward Copilot</p><p className="text-[11px] text-slate-500">OyamaCRM intelligence</p></div>
          <button type="button" onClick={() => setSidebarOpen(false)} className="ml-auto lg:hidden" aria-label="Close conversations">×</button>
        </div>
        <div className="p-3">
          <button type="button" onClick={() => startNewThread()} className="flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-[#0f6cbd] px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#115ea3]"><span className="text-base">+</span> New conversation</button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-400">Recent conversations</p>
          {threads.length === 0 ? <p className="px-2 py-3 text-xs leading-5 text-slate-500">Start a conversation to keep the context available for this session.</p> : null}
          {threads.map((thread) => (
            <div key={thread.id} className={`group mb-1 flex items-center gap-2 rounded-lg px-2 py-2 ${thread.id === activeThreadId ? "bg-[#eff6fc] text-[#0f548c]" : "hover:bg-slate-50"}`}>
              <button type="button" onClick={() => { setActiveThreadId(thread.id); setModuleKey(thread.moduleKey); setSidebarOpen(false); }} className="min-w-0 flex-1 text-left">
                <p className="truncate text-xs font-semibold">{thread.title}</p><p className="mt-0.5 text-[10px] text-slate-500">{formatThreadTime(thread.updatedAt)} · {MODULES.find((item) => item.value === thread.moduleKey)?.label}</p>
              </button>
              <button type="button" onClick={() => removeThread(thread.id)} aria-label={`Remove ${thread.title}`} className="hidden rounded p-1 text-slate-400 hover:bg-white hover:text-rose-600 group-hover:block">×</button>
            </div>
          ))}
        </div>
        <div className="border-t border-slate-200 p-3 text-xs text-slate-600"><Link href="/settings/ai" className="block rounded-lg px-2 py-2 hover:bg-slate-50">AI settings</Link><Link href="/" className="block rounded-lg px-2 py-2 hover:bg-slate-50">Back to CRM</Link></div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 sm:px-5">
          <button type="button" onClick={() => setSidebarOpen(true)} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 lg:hidden" aria-label="Open conversations">☰</button>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{activeThread?.title ?? "New conversation"}</p><p className="truncate text-xs text-slate-500">{activeModule.description}</p></div>
          <span className="hidden rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex"><span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />Ready</span>
          <button type="button" onClick={clearCurrentThread} disabled={!activeThread || activeMessages.length === 0 || sending} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40">Clear</button>
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-4xl flex-col px-4 py-8 sm:px-8">
            {activeMessages.length === 0 ? (
              <div className="flex min-h-[56vh] flex-col justify-center">
                <div className="max-w-2xl"><span className="inline-flex rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-[#0f548c]">Grounded in your CRM</span><h1 className="mt-5 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">What can I help move forward?</h1><p className="mt-3 max-w-xl text-base leading-7 text-slate-600">Ask for an answer, analysis, draft, or action plan. Steward uses live permissioned CRM context and keeps every consequential action review-first.</p></div>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">{STARTERS.map((starter) => <button key={starter.label} type="button" onClick={() => { setMode(starter.mode); void send(starter.prompt, starter.mode); }} className="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[#7ab8e7] hover:shadow-md"><p className="text-sm font-semibold text-slate-900">{starter.label}</p><p className="mt-1 text-xs leading-5 text-slate-500">{starter.prompt}</p></button>)}</div>
              </div>
            ) : activeMessages.map((message) => (
              <article key={message.id} className={`mb-7 ${message.role === "user" ? "ml-auto max-w-2xl" : "max-w-none"}`}>
                {message.role === "user" ? <div className="rounded-2xl rounded-br-sm bg-[#0f6cbd] px-4 py-3 text-sm leading-6 text-white shadow-sm">{message.content}</div> : (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm sm:px-5">
                    {sending && message.content.length === 0 ? <StewardThinkingPanel progressSteps={message.progressSteps ?? []} thinkingContent="" isActive activeTools={message.activeTools} progressPercent={message.progressPercent} progressStage={message.progressStage} /> : null}
                    {message.content ? <StewardResponseRenderer content={message.content} structured={message.structured} toolsUsed={message.toolsUsed} recordsUsed={message.recordsUsed} provider={message.provider} moduleKey={moduleKey} generatedAt={message.createdAt} onCopy={() => void navigator.clipboard?.writeText(message.content)} onAskReportQuestion={(prompt) => { setDraft(prompt); composerRef.current?.focus(); }} /> : null}
                  </div>
                )}
              </article>
            ))}
            {error ? <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div> : null}
          </div>
        </div>

        <div className="shrink-0 border-t border-slate-200 bg-white px-3 py-3 sm:px-6 sm:py-4">
          <div className="mx-auto max-w-4xl">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="copilot-module">Workspace scope</label><select id="copilot-module" value={moduleKey} onChange={(event) => setModuleKey(event.target.value as ModuleKey)} disabled={sending} className="h-7 rounded-full border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-700"><>{MODULES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</></select>
              <label className="sr-only" htmlFor="copilot-mode">Copilot mode</label><select id="copilot-mode" value={mode} onChange={(event) => setMode(event.target.value as ChatMode)} disabled={sending} className="h-7 rounded-full border border-slate-200 bg-slate-50 px-2 text-[11px] font-semibold text-slate-700"><>{MODE_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</></select>
              <span className="hidden text-[11px] text-slate-400 sm:inline">{activeMode.description}</span>
            </div>
            <div className="flex items-end gap-2 rounded-2xl border border-slate-300 bg-white p-2 shadow-[0_8px_24px_rgba(15,23,42,0.08)] focus-within:border-[#0f6cbd] focus-within:ring-4 focus-within:ring-blue-100">
              <textarea ref={composerRef} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send(); } }} placeholder="Ask Copilot about donors, work, reports, or a next step…" rows={1} disabled={sending} className="max-h-32 min-h-11 flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 outline-none placeholder:text-slate-400" />
              {sending ? <button type="button" onClick={stopGeneration} className="inline-flex h-10 items-center rounded-xl bg-slate-900 px-3 text-xs font-bold text-white">Stop</button> : <button type="button" onClick={() => void send()} disabled={!draft.trim()} className="inline-flex h-10 items-center rounded-xl bg-[#0f6cbd] px-4 text-xs font-bold text-white transition hover:bg-[#115ea3] disabled:cursor-not-allowed disabled:opacity-40">Send <span className="ml-1">↑</span></button>}
            </div>
            <p className="mt-2 text-center text-[11px] text-slate-400">Enter to send · Shift + Enter for a new line · {modelLabel}</p>
          </div>
        </div>
      </main>
    </div>
  );
}
