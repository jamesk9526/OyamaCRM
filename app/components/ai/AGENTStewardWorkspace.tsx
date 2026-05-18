/**
 * AGENTStewardWorkspace — full-page ChatGPT-style CRM assistant workspace.
 * Clean, light-mode, conversation-first layout with a left sidebar for
 * thread history, a wide central message area, and a bottom composer.
 * CRM scope is always visible and manually selectable.
 */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import { getFiscalYearForDate, getFiscalYearEndMonth } from "@/app/lib/fiscal-year";
import StewardResponseRenderer from "@/app/components/ai/StewardResponseRenderer";
import { StewardThinkingPanel } from "@/app/components/ai/StewardThinkingPanel";
import StewardAvatarIcon from "@/app/components/ui/StewardAvatarIcon";
import type { StewardStructuredResponse } from "@/app/components/ai/steward-artifact-types";
import { executeStewardSuggestedAction } from "@/app/components/ai/steward-action-executor";
import DonorMentionPicker, { type MentionedDonor } from "@/app/components/ai/DonorMentionPicker";
import EmailBuilderApp from "@/app/components/email-builder/EmailBuilderApp";
import LetterTemplateEditor from "@/app/components/letters/LetterTemplateEditor";
import WorkspaceSetupModal from "@/app/components/ui/WorkspaceSetupModal";

// ─── Types ────────────────────────────────────────────────────────────────────

type ModuleKey =
  | "donor"
  | "compassion"
  | "events"
  | "watchdog"
  | "webmaster"
  | "hrm"
  | "all";

type ChatMode = "ask" | "analyze" | "draft" | "action" | "help";
type RenderMode = "markdown" | "html";

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
  /** Human-readable pipeline progress steps (retrieval, planning, drafting). */
  progressSteps?: string[];
  /** Reasoning tokens from DeepSeek or other thinking-capable models. */
  thinkingContent?: string;
}

interface ChatThread {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  moduleKey: ModuleKey;
  messages: UiMessage[];
}

interface AiConfigPayload {
  enabled: boolean;
  mode: "local" | "remote";
  endpointUrl: string;
  model: string;
  chatHeadEnabled: boolean;
}

interface StewardChatStreamChunk { type: "chunk"; delta: string; }
interface StewardChatStreamDone {
  type: "done"; reply: string;
  structured?: StewardStructuredResponse;
  model: string; mode: ChatMode;
  runtimeMode?: "local" | "remote";
  provider: string;
  toolsUsed: string[];
  recordsUsed?: string[];
  moduleKey?: string;
  scopePath?: string;
}
interface StewardChatStreamError { type: "error"; message: string; }

type SpeechRecognitionAlternativeLike = { transcript: string };
type SpeechRecognitionResultLike = ArrayLike<SpeechRecognitionAlternativeLike>;
type SpeechRecognitionEventLike = { results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
};
type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;
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

// ─── Scope config ─────────────────────────────────────────────────────────────

const SCOPE_OPTIONS: Array<{ key: ModuleKey; label: string; description: string; color: string }> = [
  { key: "donor",      label: "Donor CRM",      description: "Donors, donations, campaigns, grants, stewardship", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { key: "compassion", label: "Compassion CRM",  description: "Client care, cases, appointments, services",       color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "events",     label: "Events CRM",      description: "Events, guests, tables, check-in, tickets",        color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "hrm",        label: "HRM",             description: "Staff, scheduling, HR records",                    color: "bg-purple-50 text-purple-700 border-purple-200" },
  { key: "webmaster",  label: "Webmaster",        description: "Sites, pages, publishing, CMS",                   color: "bg-rose-50 text-rose-700 border-rose-200" },
  { key: "watchdog",   label: "Watchdog",         description: "Security events, alerts, audit logs",             color: "bg-slate-50 text-slate-700 border-slate-200" },
  { key: "all",        label: "All CRM Data",     description: "All modules where you have permission",           color: "bg-slate-900 text-white border-slate-900" },
];

const SCOPE_COLOR: Record<ModuleKey, string> = {
  donor:      "bg-emerald-50 text-emerald-700 border-emerald-200",
  compassion: "bg-blue-50 text-blue-700 border-blue-200",
  events:     "bg-amber-50 text-amber-700 border-amber-200",
  hrm:        "bg-purple-50 text-purple-700 border-purple-200",
  webmaster:  "bg-rose-50 text-rose-700 border-rose-200",
  watchdog:   "bg-slate-50 text-slate-700 border-slate-200",
  all:        "bg-slate-900 text-white border-slate-900",
};

type AddContextActionKey =
  | "attach_file"
  | "upload_csv"
  | "add_crm_record"
  | "add_donor_list"
  | "add_campaign"
  | "add_report_context";

const ADD_CONTEXT_MENU_ITEMS: Array<{ key: AddContextActionKey; label: string; icon: string }> = [
  {
    key: "attach_file",
    label: "Attach file",
    icon: "M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13",
  },
  {
    key: "upload_csv",
    label: "Upload CSV",
    icon: "M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z",
  },
  {
    key: "add_crm_record",
    label: "Add CRM record",
    icon: "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  },
  {
    key: "add_donor_list",
    label: "Add donor list",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0",
  },
  {
    key: "add_campaign",
    label: "Add campaign",
    icon: "M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z",
  },
  {
    key: "add_report_context",
    label: "Add report context",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
  },
];

// ─── Starter prompts ──────────────────────────────────────────────────────────

const STARTER_PROMPTS: Record<ModuleKey, string[]> = {
  donor: [
    "What donor follow-up tasks should I create this week?",
    "Draft a thank-you note for our top 5 donors this year.",
    "Summarize donor engagement risks from current records.",
    "Which donors are at risk of lapsing?",
    "Show me giving trends for the last 3 years.",
  ],
  compassion: [
    "Summarize this client's context from visible page details.",
    "What client follow-ups should happen this week?",
    "Draft a client-safe appointment reminder.",
    "Which cases need urgent attention?",
  ],
  events: [
    "Summarize event operations status.",
    "What check-in risks should staff watch today?",
    "Draft a post-event thank-you message.",
    "Show me ticket sales breakdown.",
  ],
  hrm: [
    "Summarize internal staffing priorities for today.",
    "Draft an internal announcement for all staff.",
    "What schedule conflicts should HRM resolve this week?",
  ],
  webmaster: [
    "Propose a nonprofit website information architecture.",
    "Draft homepage copy for donor conversion.",
    "What pages should we launch first and why?",
  ],
  watchdog: [
    "Summarize high-risk security events in this view.",
    "Draft an incident response checklist for this alert.",
    "What access controls should I verify first?",
  ],
  all: [
    "What's the most important thing I should focus on today?",
    "Give me a cross-module activity summary for this week.",
    "Draft a board-ready summary of current CRM activity.",
  ],
};

const MODE_HELP: Record<ChatMode, string> = {
  ask: "Ask questions and retrieve CRM context without changing records.",
  analyze: "Compare, summarize, and find patterns across the selected scope.",
  draft: "Write email, letter, report, and follow-up copy for human review.",
  action: "Prepare CRM actions with confirmation before anything is changed.",
  help: "Explain where to go and how to use OyamaCRM workflows.",
};

const QUICK_WORKFLOWS: Array<{ label: string; mode: ChatMode; prompt: string }> = [
  { label: "Today’s priorities", mode: "analyze", prompt: "Review my donor CRM data and summarize the most important stewardship priorities for today." },
  { label: "Draft outreach", mode: "draft", prompt: "Draft a donor outreach email for the selected audience. Include subject, preview text, and a warm nonprofit tone." },
  { label: "Find a segment", mode: "analyze", prompt: "Find a useful donor segment for outreach and explain the selection criteria before suggesting next steps." },
  { label: "Create follow-up plan", mode: "action", prompt: "Create a review-first follow-up plan with tasks I can confirm before anything is written to the CRM." },
];

// ─── Storage helpers ──────────────────────────────────────────────────────────

const THREAD_LIMIT = 30;
const MSG_LIMIT    = 80;
const STORAGE_KEY  = "agent-steward-threads:v1";
const RENDER_MODE_STORAGE_KEY = "agent-steward-render-mode:v1";

function readThreads(): ChatThread[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const now = new Date().toISOString();
    return (parsed as Partial<ChatThread>[])
      .filter(Boolean)
      .map((t, i) => ({
        id:        typeof t.id === "string" ? t.id : crypto.randomUUID(),
        title:     typeof t.title === "string" && t.title.trim() ? t.title.trim() : `Chat ${i + 1}`,
        createdAt: typeof t.createdAt === "string" ? t.createdAt : now,
        updatedAt: typeof t.updatedAt === "string" ? t.updatedAt : now,
        moduleKey: (["donor","compassion","events","hrm","webmaster","watchdog","all"].includes(String(t.moduleKey))
          ? t.moduleKey : "donor") as ModuleKey,
        messages: normalizeMessages(t.messages),
      }))
      .slice(0, THREAD_LIMIT);
  } catch { return []; }
}

function writeThreads(threads: ChatThread[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(threads.slice(0, THREAD_LIMIT)));
  } catch { /* quota guard */ }
}

function normalizeMessages(raw: unknown): UiMessage[] {
  if (!Array.isArray(raw)) return [];
  return (raw as Partial<UiMessage>[])
    .filter((m) => m && typeof m === "object")
    .map((m): UiMessage => {
      const role: UiMessage["role"] = m.role === "assistant" ? "assistant" : "user";
      const responseMode: ChatMode | undefined = ["ask", "analyze", "draft", "action", "help"].includes(String(m.responseMode))
        ? (m.responseMode as ChatMode)
        : undefined;
      const runtimeMode: UiMessage["runtimeMode"] = m.runtimeMode === "local" || m.runtimeMode === "remote" || m.runtimeMode === "unknown"
        ? m.runtimeMode
        : undefined;

      return {
        id: typeof m.id === "string" ? m.id : crypto.randomUUID(),
        role,
        content: typeof m.content === "string" ? m.content : "",
        createdAt: typeof m.createdAt === "string" ? m.createdAt : new Date().toISOString(),
        structured: m.structured as StewardStructuredResponse | undefined,
        toolsUsed: Array.isArray(m.toolsUsed) ? (m.toolsUsed as string[]) : undefined,
        recordsUsed: Array.isArray(m.recordsUsed) ? (m.recordsUsed as string[]) : undefined,
        provider: typeof m.provider === "string" ? m.provider : undefined,
        responseMode,
        moduleKey: typeof m.moduleKey === "string" ? m.moduleKey : undefined,
        runtimeMode,
        progressSteps: Array.isArray(m.progressSteps) ? (m.progressSteps as string[]) : undefined,
        thinkingContent: typeof m.thinkingContent === "string" ? m.thinkingContent : undefined,
      };
    })
    .filter((m) => m.content.trim() || m.role === "assistant")
    .slice(-MSG_LIMIT);
}

function inferTitle(msgs: UiMessage[], fallback: string): string {
  const first = msgs.find((m) => m.role === "user" && m.content.trim());
  if (!first) return fallback;
  const t = first.content.replace(/\s+/g, " ").trim();
  return t.length > 48 ? `${t.slice(0, 48)}…` : t;
}

function newThread(moduleKey: ModuleKey, n: number): ChatThread {
  const now = new Date().toISOString();
  return { id: crypto.randomUUID(), title: `New chat ${n}`, createdAt: now, updatedAt: now, moduleKey, messages: [] };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AGENTStewardWorkspaceProps {
  /** Initial scope from URL query parameter. */
  initialModule?: ModuleKey;
  /** Dock mode: renders inside a fixed sidebar panel, no thread list, compact header. */
  dockMode?: boolean;
  /** Called when user clicks close in dock mode. */
  onCloseDock?: () => void;
  /**
   * Contextual prompt injected from StewardContextButton.
   * When set, starts a new chat with this prompt pre-sent automatically.
   */
  externalPrompt?: { prompt: string; moduleKey?: string; mode?: string };
  /** Called after the externalPrompt has been consumed so the parent can clear it. */
  onExternalPromptConsumed?: () => void;
}

interface StewardEmailWorkspaceState {
  campaignId: string;
  returnTo?: string;
}

interface StewardLetterWorkspaceState {
  templateId: string;
  initialPanel?: "document" | "preview" | "publish";
}

// ─── Main component ───────────────────────────────────────────────────────────

/** AGENTStewardWorkspace — clean ChatGPT-style full-page CRM AI assistant. */
export default function AGENTStewardWorkspace({ initialModule = "donor", dockMode = false, onCloseDock, externalPrompt, onExternalPromptConsumed }: AGENTStewardWorkspaceProps) {
  // --- State ---
  const [threads, setThreads]           = useState<ChatThread[]>([]);
  const [activeId, setActiveId]         = useState<string | null>(null);
  const [hydrated, setHydrated]         = useState(false);
  const [messages, setMessages]         = useState<UiMessage[]>([]);
  const [draft, setDraft]               = useState("");
  const [mode, setMode]                 = useState<ChatMode>("ask");
  const [renderMode, setRenderMode]     = useState<RenderMode>("markdown");
  const [scope, setScope]               = useState<ModuleKey>(initialModule);
  const [scopeOpen, setScopeOpen]       = useState(false);       // composer Scope button
  const [headerScopeOpen, setHeaderScopeOpen] = useState(false); // header scope pill
  const [addOpen, setAddOpen]           = useState(false);
  const [toolsOpen, setToolsOpen]       = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(false); // hidden by default (mobile-first; JS reopens on large screens)
  const [sending, setSending]           = useState(false);
  const [aiConfig, setAiConfig]         = useState<AiConfigPayload | null>(null);
  const [error, setError]               = useState<string | null>(null);
  const [actionStatus, setActionStatus] = useState<{ tone: "success" | "error"; message: string } | null>(null);
  const [modelUsed, setModelUsed]       = useState<string | null>(null);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery]   = useState("");
  // @mention state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = picker closed
  const [lockedDonors, setLockedDonors] = useState<MentionedDonor[]>([]); // donors pinned to this chat
  const [reportingYearMode, setReportingYearMode] = useState<"fiscal" | "calendar">("calendar");
  const [fiscalYearStart, setFiscalYearStart]     = useState<number>(1);
  // iOS visual viewport height — tracks keyboard-open shrinkage on Safari
  const [viewportH, setViewportH] = useState<number | null>(null);
  const [emailWorkspace, setEmailWorkspace] = useState<StewardEmailWorkspaceState | null>(null);
  const [letterWorkspace, setLetterWorkspace] = useState<StewardLetterWorkspaceState | null>(null);

  const bottomRef     = useRef<HTMLDivElement | null>(null);
  const textareaRef   = useRef<HTMLTextAreaElement | null>(null);
  const composerRef   = useRef<HTMLDivElement | null>(null); // anchor for mention picker
  const streamAbort   = useRef<AbortController | null>(null);
  const scopeRef      = useRef<HTMLDivElement | null>(null);
  const headerScopeRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef  = useRef<HTMLInputElement | null>(null);

  // --- Derived ---
  const activeThread = useMemo(() => threads.find((t) => t.id === activeId) ?? null, [threads, activeId]);
  const scopeLabel   = SCOPE_OPTIONS.find((s) => s.key === scope)?.label ?? "Donor CRM";
  const scopeColor   = SCOPE_COLOR[scope];
  const prompts      = STARTER_PROMPTS[scope];

  const filteredThreads = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const sorted = [...threads].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!q) return sorted;
    return sorted.filter((t) => t.title.toLowerCase().includes(q));
  }, [threads, searchQuery]);

  // --- Hydration ---
  useEffect(() => {
    const stored = readThreads();
    const list   = stored.length > 0 ? stored : [newThread(scope, 1)];
    const first  = list[0];
    setThreads(list);
    setActiveId(first.id);
    setMessages(first.messages);
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Persist on change ---
  useEffect(() => {
    if (!hydrated) return;
    writeThreads(threads);
  }, [threads, hydrated]);

  // --- Sync active thread title when messages change ---
  useEffect(() => {
    if (!hydrated || !activeId || sending) return;
    const title  = inferTitle(messages, activeThread?.title ?? "New chat");
    const sliced = messages.slice(-MSG_LIMIT);
    setThreads((prev) =>
      prev.map((t) =>
        t.id !== activeId ? t
          : { ...t, title, updatedAt: new Date().toISOString(), messages: sliced }
      )
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, activeId, hydrated, sending]);

  // --- Auto-scroll ---
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  // --- Open sidebar on large screens on initial mount ---
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 640) {
      setSidebarOpen(true);
    }
  }, []);

  // --- iOS visual viewport listener: keeps layout above keyboard on Safari ---
  useEffect(() => {
    if (dockMode || typeof window === "undefined") return;
    const vv = window.visualViewport;
    if (!vv) return;
    const onResize = () => setViewportH(vv.height);
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, [dockMode]);

  // --- Dismiss composer dropdowns on outside click ---
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      const target = e.target as Element | null;
      if (!target) return;
      if (!target.closest("[data-composer-dropdown]")) {
        setAddOpen(false);
        setScopeOpen(false);
        setToolsOpen(false);
      }
      // Close header scope pill when clicking outside it
      if (headerScopeRef.current && !headerScopeRef.current.contains(target)) {
        setHeaderScopeOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  // --- Load AI config ---
  useEffect(() => {
    apiFetch<AiConfigPayload>("/api/steward-ai/config")
      .then((cfg) => setAiConfig(cfg))
      .catch(() => {});
  }, []);

  // --- Load fiscal year settings for FY mode toggle ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(RENDER_MODE_STORAGE_KEY);
    if (stored === "html" || stored === "markdown") {
      setRenderMode(stored);
    }
  }, []);

  const changeRenderMode = useCallback((next: RenderMode) => {
    setRenderMode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(RENDER_MODE_STORAGE_KEY, next);
    }
  }, []);

  // --- Load fiscal year settings for FY mode toggle ---
  useEffect(() => {
    let active = true;
    apiFetch<{ fiscalYearStart?: number }>("/api/settings")
      .then((data) => { if (active && typeof data.fiscalYearStart === "number") setFiscalYearStart(data.fiscalYearStart); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const toggleReportingYearMode = useCallback(() => {
    setReportingYearMode((v) => (v === "fiscal" ? "calendar" : "fiscal"));
  }, []);

  // --- Auto-grow textarea ---
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  // ─── Thread management ──────────────────────────────────────────────────────

  function startNewChat() {
    if (sending) return;
    const t = newThread(scope, threads.length + 1);
    setThreads((prev) => [t, ...prev].slice(0, THREAD_LIMIT));
    setActiveId(t.id);
    setMessages([]);
    setDraft("");
    setError(null);
    setActionStatus(null);
  }

  function switchThread(id: string) {
    if (id === activeId) return;
    const t = threads.find((x) => x.id === id);
    if (!t) return;
    setActiveId(t.id);
    setMessages(t.messages);
    setScope(t.moduleKey);
    setDraft("");
    setError(null);
    setActionStatus(null);
    setLockedDonors([]);
    setMentionQuery(null);
  }

  function deleteThread(id: string) {
    if (threads.length <= 1) {
      const replacement = newThread(scope, 1);
      setThreads([replacement]);
      setActiveId(replacement.id);
      setMessages([]);
      return;
    }
    const remaining = threads.filter((t) => t.id !== id);
    setThreads(remaining);
    if (id === activeId) {
      const next = remaining[0];
      if (next) { setActiveId(next.id); setMessages(next.messages); }
    }
  }

  function clearChat() {
    if (!activeId) return;
    if (typeof window !== "undefined" && !window.confirm("Clear this conversation?")) return;
    setMessages([]);
    setDraft("");
    setError(null);
    setActionStatus(null);
  }

  // ─── Scope change ───────────────────────────────────────────────────────────

  function changeScope(key: ModuleKey) {
    setScope(key);
    setScopeOpen(false);
    // Update the active thread's recorded module
    if (activeId) {
      setThreads((prev) =>
        prev.map((t) => t.id === activeId ? { ...t, moduleKey: key } : t)
      );
    }
  }

  // ─── Send message ───────────────────────────────────────────────────────────

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // If mention picker is open, let DonorMentionPicker handle arrow/enter/escape via its own keydown listener
    if (mentionQuery !== null && (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Tab")) {
      e.preventDefault();
      return;
    }
    if (mentionQuery !== null && e.key === "Escape") {
      setMentionQuery(null);
      return;
    }
    if (e.key === "Enter" && !e.shiftKey && mentionQuery === null) {
      e.preventDefault();
      if (!sending && draft.trim()) void send();
    }
  }

  /** Called on every textarea change — detect @mention trigger. */
  function handleDraftChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setDraft(val);
    // Find the last "@" before the cursor that hasn't been closed by a space or newline
    const cursor = e.target.selectionStart ?? val.length;
    const before = val.slice(0, cursor);
    const atIdx  = before.lastIndexOf("@");
    if (atIdx >= 0) {
      const fragment = before.slice(atIdx + 1);
      // Fragment must not contain spaces (otherwise it's a completed word, not a mention)
      if (!/\s/.test(fragment)) {
        setMentionQuery(fragment); // empty string = show all recent, typed = filter
        return;
      }
    }
    setMentionQuery(null);
  }

  /** Inject a selected donor into the draft and lock them as context. */
  function handleMentionSelect(donor: MentionedDonor) {
    const name = [donor.firstName, donor.lastName].filter(Boolean).join(" ") || donor.email || "Unknown";
    const mentionTag = `@[${name}](donor:${donor.id})`;
    // Replace the "@<fragment>" in the draft with the full mention tag
    const cursor = textareaRef.current?.selectionStart ?? draft.length;
    const before = draft.slice(0, cursor);
    const atIdx  = before.lastIndexOf("@");
    const after  = draft.slice(cursor);
    const newDraft = (atIdx >= 0 ? before.slice(0, atIdx) : before) + mentionTag + " " + after;
    setDraft(newDraft);
    setMentionQuery(null);
    // Lock this donor into the conversation context (deduplicated)
    setLockedDonors((prev) => prev.find((d) => d.id === donor.id) ? prev : [...prev, donor]);
    // Re-focus and move cursor to after the tag
    setTimeout(() => {
      const ta = textareaRef.current;
      if (ta) {
        ta.focus();
        const pos = (atIdx >= 0 ? before.slice(0, atIdx).length : before.length) + mentionTag.length + 1;
        ta.setSelectionRange(pos, pos);
      }
    }, 30);
  }

  function stopGeneration() {
    streamAbort.current?.abort();
  }

  /** Reads selected files and appends their name + text content (for text files) into the draft. */
  function handleFileAttach(files: FileList | null) {
    if (!files || files.length === 0) return;
    Array.from(files).forEach((file) => {
      const isText = file.type.startsWith("text/") || /\.(csv|txt|md|json)$/i.test(file.name);
      if (isText && file.size < 100_000) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const content = (ev.target?.result as string ?? "").slice(0, 2000);
          setDraft((d) => {
            const prefix = d ? `${d}\n\n` : "";
            return `${prefix}[File: ${file.name}]\n\`\`\`\n${content}\n\`\`\``;
          });
          setTimeout(() => textareaRef.current?.focus(), 50);
        };
        reader.readAsText(file);
      } else {
        // For binary/large files just attach the name as context
        setDraft((d) => {
          const prefix = d ? `${d}\n` : "";
          return `${prefix}[Attached: ${file.name} (${(file.size / 1024).toFixed(1)} KB)]`;
        });
        setTimeout(() => textareaRef.current?.focus(), 50);
      }
    });
    // Reset the input so the same file can be re-selected
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const openAnyFilePicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = "*/*";
    input.click();
  }, []);

  const openCsvFilePicker = useCallback(() => {
    const input = fileInputRef.current;
    if (!input) return;
    input.accept = ".csv,text/csv";
    input.click();
  }, []);

  const focusTextarea = useCallback(() => {
    setTimeout(() => textareaRef.current?.focus(), 50);
  }, []);

  const handleAddContextAction = useCallback((key: AddContextActionKey) => {
    setAddOpen(false);

    if (key === "attach_file") {
      openAnyFilePicker();
      return;
    }

    if (key === "upload_csv") {
      openCsvFilePicker();
      return;
    }

    if (key === "add_crm_record" || key === "add_donor_list") {
      setDraft((d) => (d.endsWith(" ") || d === "" ? `${d}@` : `${d} @`));
      setMentionQuery("");
      focusTextarea();
      return;
    }

    if (key === "add_campaign") {
      setDraft((d) => {
        const prefix = d ? `${d}\n` : "";
        return `${prefix}Focus on the campaign: `;
      });
      focusTextarea();
      return;
    }

    if (key === "add_report_context") {
      setDraft((d) => {
        const prefix = d ? `${d}\n` : "";
        return `${prefix}Pull the current KPI summary, YTD giving, and retention rate.`;
      });
      focusTextarea();
    }
  }, [setAddOpen, openAnyFilePicker, openCsvFilePicker, setDraft, setMentionQuery, focusTextarea]);

  const normalizeStructured = useCallback((raw: unknown): StewardStructuredResponse | undefined => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
    const c = raw as Partial<StewardStructuredResponse>;
    if (c.version !== 1 || typeof c.replyMarkdown !== "string") return undefined;
    if (!Array.isArray(c.artifacts) || !Array.isArray(c.suggestedActions) || !Array.isArray(c.evidence)) return undefined;
    return {
      version: 1,
      replyMarkdown: c.replyMarkdown,
      artifacts: c.artifacts,
      suggestedActions: c.suggestedActions,
      evidence: c.evidence,
      parseWarning: typeof c.parseWarning === "string" ? c.parseWarning : undefined,
    };
  }, []);

  interface SendOpts {
    historyOverride?: UiMessage[];
    appendUser?: boolean;
    targetId?: string;
    truncateAt?: number;
  }

  const send = useCallback(async (content?: string, opts: SendOpts = {}) => {
    const text = (content ?? draft).trim();
    if (!text || sending) return;

    const appendUser = opts.appendUser ?? true;
    const base       = opts.historyOverride ?? messages;
    const userMsg: UiMessage = {
      id: crypto.randomUUID(), role: "user", content: text,
      createdAt: new Date().toISOString(),
    };
    const payload = appendUser ? [...base, userMsg] : base;
    const assistantId = opts.targetId ?? crypto.randomUUID();

    if (appendUser) {
      setMessages([
        ...payload,
        { id: assistantId, role: "assistant", content: "", createdAt: new Date().toISOString() },
      ]);
    } else {
      setMessages((prev) => {
        const sliced = typeof opts.truncateAt === "number" ? prev.slice(0, opts.truncateAt + 1) : prev;
        return sliced.map((m) =>
          m.id !== assistantId ? m
            : { ...m, content: "", structured: undefined, toolsUsed: undefined, recordsUsed: undefined }
        );
      });
    }

    setDraft("");
    setSending(true);
    setActiveAssistantId(assistantId);
    setError(null);
    setActionStatus(null);

    try {
      const ac = new AbortController();
      streamAbort.current = ac;

      const resp = await apiFetchResponse("/api/steward-ai/chat/stream", {
        method: "POST",
        body: JSON.stringify({
          messages: payload.map((m) => ({ role: m.role, content: m.content })),
          mode,
          moduleKey: scope === "all" ? "donor" : scope,
          scopePath: "/steward-ai-workspace",
          fyMode: reportingYearMode,
          fiscalYear: getFiscalYearForDate(new Date(), fiscalYearStart),
          fiscalYearStart,
          // Inject locked donor context so the AI knows who we're talking about
          ...(lockedDonors.length > 0 && {
            donorContext: lockedDonors.map((d) => ({
              id: d.id,
              name: [d.firstName, d.lastName].filter(Boolean).join(" ") || d.email || "Unknown",
              email: d.email,
              donorStatus: d.donorStatus,
              totalLifetimeGiving: d.totalLifetimeGiving,
              lastGiftDate: d.lastGiftDate,
            })),
          }),
        }),
        signal: ac.signal,
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => "");
        try { throw new Error((JSON.parse(txt) as { error?: { message?: string } }).error?.message ?? `Error ${resp.status}`); }
        catch { throw new Error(txt || `Error ${resp.status}`); }
      }
      if (!resp.body) throw new Error("Stream unavailable.");

      const reader  = resp.body.getReader();
      const decoder = new TextDecoder();
      let buf  = "";
      let done: StewardChatStreamDone | null = null;
      let streamed = "";

      while (true) {
        const { value, done: eof } = await reader.read();
        if (eof) break;
        buf += decoder.decode(value, { stream: true });
        let nl = buf.indexOf("\n");
        while (nl >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          nl  = buf.indexOf("\n");
          if (!line) continue;
          const ev = JSON.parse(line) as StewardChatStreamEvent;
          if (ev.type === "chunk") {
            streamed += ev.delta;
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId ? { ...m, content: m.content + ev.delta } : m)
            );
          } else if (ev.type === "progress") {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId
                ? { ...m, progressSteps: [...(m.progressSteps ?? []), ev.message] }
                : m)
            );
          } else if (ev.type === "thinking") {
            setMessages((prev) =>
              prev.map((m) => m.id === assistantId
                ? { ...m, thinkingContent: (m.thinkingContent ?? "") + ev.delta }
                : m)
            );
          } else if (ev.type === "done") { done = ev; break; }
          else if (ev.type === "error") throw new Error(ev.message || "Stream error");
        }
        if (done) break;
      }

      if (!done && buf.trim()) {
        const ev = JSON.parse(buf.trim()) as StewardChatStreamEvent;
        if (ev.type === "done") done = ev;
        else if (ev.type === "chunk") {
          streamed += ev.delta;
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: m.content + ev.delta } : m)
          );
        }
      }
      if (!done) throw new Error("Stream ended unexpectedly.");

      setModelUsed(done.model);
      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== assistantId) return m;
          const finalReply = done!.reply?.length ? done!.reply : streamed;
          return {
            ...m, content: finalReply,
            structured:   done!.structured ? normalizeStructured(done!.structured) : undefined,
            toolsUsed:    done!.toolsUsed,
            recordsUsed:  done!.recordsUsed,
            provider:     done!.provider,
            responseMode: done!.mode,
            moduleKey:    done!.moduleKey,
            runtimeMode:  done!.runtimeMode ?? "unknown",
          };
        })
      );
    } catch (err) {
      setMessages((prev) =>
        prev.filter((m) => m.id !== assistantId || m.content.trim().length > 0)
      );
      const isAbort = err instanceof Error && (err.name === "AbortError" || /abort/i.test(err.message));
      if (!isAbort) setError(err instanceof Error ? err.message : "Request failed.");
    } finally {
      streamAbort.current = null;
      setSending(false);
      setActiveAssistantId(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, messages, mode, scope, sending]);

  // ─── Regenerate ────────────────────────────────────────────────────────────
  function regenerate(assistantMsgId: string) {
    if (sending) return;
    const aIdx = messages.findIndex((m) => m.id === assistantMsgId && m.role === "assistant");
    if (aIdx < 0) return;
    let uIdx = aIdx - 1;
    while (uIdx >= 0 && messages[uIdx].role !== "user") uIdx--;
    if (uIdx < 0) return;
    void send(messages[uIdx].content, {
      historyOverride: messages.slice(0, aIdx),
      appendUser: false,
      targetId: assistantMsgId,
      truncateAt: aIdx,
    });
  }

  // ─── Copy message ──────────────────────────────────────────────────────────
  async function copyMessage(content: string) {
    try { await navigator.clipboard.writeText(content); } catch { /* ignore */ }
  }

  /** Opens supported editor routes inside Steward so users can build/preview/edit without leaving chat. */
  function openWorkspaceFromPath(path: string): boolean {
    const [pathname, query = ""] = path.split("?");
    const params = new URLSearchParams(query);

    if (pathname === "/email-builder") {
      const campaignId = params.get("campaign")?.trim();
      if (!campaignId) return false;
      setEmailWorkspace({
        campaignId,
        returnTo: params.get("returnTo") ?? undefined,
      });
      return true;
    }

    const letterMatch = pathname.match(/^\/letters-printables\/templates\/([^/]+)$/);
    if (letterMatch?.[1]) {
      const panelRaw = params.get("panel");
      const initialPanel = panelRaw === "preview" || panelRaw === "publish" ? panelRaw : "document";
      setLetterWorkspace({
        templateId: decodeURIComponent(letterMatch[1]),
        initialPanel,
      });
      return true;
    }

    return false;
  }

  // ─── Run suggested action ──────────────────────────────────────────────────
  async function runAction(messageId: string, actionIndex: number) {
    const src = messages.find((m) => m.id === messageId && m.role === "assistant");
    if (!src?.structured) return;
    const action = src.structured.suggestedActions[actionIndex];
    if (!action) return;
    try {
      const res = await executeStewardSuggestedAction({
        action,
        structured: src.structured,
        replyContent: src.content,
        confirm: (msg) => typeof window !== "undefined" ? window.confirm(msg) : false,
        callApi: async (path, init) => { await apiFetch(path, { method: init?.method, body: init?.body, headers: { "Content-Type": "application/json" } }); },
        navigate: (path) => {
          const openedInWorkspace = openWorkspaceFromPath(path);
          if (!openedInWorkspace && typeof window !== "undefined") window.location.href = path;
        },
        copyText: async (val) => { await navigator.clipboard.writeText(val); },
      });
      setActionStatus({ tone: res.status === "executed" ? "success" : "error", message: res.message });
    } catch (e) {
      setActionStatus({ tone: "error", message: e instanceof Error ? e.message : "Action failed." });
    }
  }

  // ─── External prompt (from StewardContextButton) ────────────────────────────
  // When a contextual button outside the dock fires a prompt, start a fresh chat
  // and auto-send the message so the user immediately sees a response.
  const externalPromptRef = useRef<typeof externalPrompt>(null);
  useEffect(() => {
    if (!externalPrompt?.prompt) return;
    if (externalPromptRef.current === externalPrompt) return; // already consumed
    externalPromptRef.current = externalPrompt;

    // Don't fire while a response is already streaming
    if (sending) return;

    // Start a new thread so the context is clean
    startNewChat();

    // Small delay to allow the new thread state to flush before sending
    const timer = setTimeout(() => {
      void send(externalPrompt.prompt);
      onExternalPromptConsumed?.();
    }, 80);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPrompt]);

  // ─── Render ────────────────────────────────────────────────────────────────

  const isEmptyChat = messages.length === 0;

  return (
    <div
      className={`flex ${dockMode ? "h-full" : "h-[100dvh]"} min-h-0 overflow-hidden bg-white`}
      style={viewportH && !dockMode ? { height: `${viewportH}px` } : undefined}
    >

      {/* ── Mobile sidebar overlay backdrop — only in full workspace mode ── */}
      {!dockMode && sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 sm:hidden"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* ── Left sidebar — hidden entirely in dock mode ───────────────────── */}
      {!dockMode && <aside
        className={`
          fixed inset-y-0 left-0 z-40 flex flex-col
          w-72 sm:w-64 bg-slate-50 border-r border-slate-100
          transition-transform duration-300 ease-out
          sm:static sm:z-auto sm:shrink-0
          ${sidebarOpen ? "translate-x-0 shadow-xl sm:shadow-none animate-sidebar-slide-in" : "-translate-x-full sm:-translate-x-full sm:w-0 sm:overflow-hidden"}
        `}
      >
        <div className="flex items-center justify-between gap-2 px-3 pt-4 pb-3">
          {/* Logo mark */}
          <div className="flex items-center gap-2 min-w-0">
            <StewardAvatarIcon size={32} alt="Steward" />
            <span className="text-sm font-semibold text-slate-900 truncate">AGENTSteward</span>
          </div>
          {/* Collapse button — touch-friendly */}
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
            title="Close sidebar"
            aria-label="Close sidebar"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
        </div>

        {/* New chat */}
        <div className="px-3 pb-2">
          <button
            type="button"
            onClick={startNewChat}
            disabled={sending}
            className="flex w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 active:scale-95 transition-all duration-150"
          >
            <svg className="h-4 w-4 text-slate-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16M4 12h16" /></svg>
            New chat
          </button>
        </div>

        {/* Search */}
        <div className="px-3 pb-2">
          <div className="relative">
            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 transition-colors duration-200" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 115 11a6 6 0 0112 0z" /></svg>
            <input
              type="text"
              placeholder="Search chats…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder-slate-400 outline-none focus:border-emerald-300 focus:ring-1 focus:ring-emerald-100 transition-all duration-150"
            />
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto px-2 pb-2 space-y-0.5">
          {filteredThreads.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-slate-400">No chats yet</p>
          ) : filteredThreads.map((t) => (
            <div
              key={t.id}
              className={`group flex items-center gap-1.5 rounded-lg px-2 py-3 sm:py-1.5 cursor-pointer transition-all duration-150 touch-manipulation ${
                t.id === activeId
                  ? "bg-white shadow-sm border border-slate-200 text-slate-900 ring-1 ring-emerald-100"
                  : "text-slate-600 hover:bg-white hover:text-slate-900 hover:shadow-sm"
              }`}
              onClick={() => { switchThread(t.id); if (window.innerWidth < 640) setSidebarOpen(false); }}
            >
              {/* Scope dot */}
              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                t.moduleKey === "compassion" ? "bg-blue-400" :
                t.moduleKey === "events"     ? "bg-amber-400" :
                t.moduleKey === "hrm"        ? "bg-purple-400" :
                t.moduleKey === "webmaster"  ? "bg-rose-400" :
                t.moduleKey === "watchdog"   ? "bg-slate-400" :
                t.moduleKey === "all"        ? "bg-slate-700" : "bg-emerald-500"
              }`} />
              <span className="min-w-0 flex-1 truncate text-xs">{t.title}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteThread(t.id); }}
                className="flex h-8 w-8 sm:h-5 sm:w-5 shrink-0 items-center justify-center rounded text-slate-300 hover:text-red-400 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch-manipulation"
                title="Delete chat"
              >
                <svg className="h-3.5 w-3.5 sm:h-3 sm:w-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          ))}
        </div>

        {/* Bottom sidebar actions */}
        <div className="border-t border-slate-100 px-3 py-3 space-y-1">
          <Link
            href="/settings"
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>
            AI Settings
          </Link>
          <button
            type="button"
            onClick={clearChat}
            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-white hover:text-slate-700 transition-colors"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            Clear chat
          </button>
        </div>
      </aside>}

      {/* ── Main area ─────────────────────────────────────────────────────── */}
      <div className="relative flex min-w-0 flex-1 flex-col overflow-hidden">

        {/* Top bar inside the workspace — full mode vs compact dock mode */}
        {dockMode ? (
          /* ── Dock-mode header: close + title + scope + mode + expand ─── */
          <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-2 min-h-[52px]">
            {/* Close dock */}
            <button
              type="button"
              onClick={onCloseDock}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              title="Close dock"
              aria-label="Close Steward dock"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>

            {/* Scope pill */}
            <div className="relative" ref={headerScopeRef}>
              <button
                type="button"
                onClick={() => { setHeaderScopeOpen((v) => !v); setScopeOpen(false); setAddOpen(false); setToolsOpen(false); }}
                className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-opacity ${scopeColor} ${headerScopeOpen ? "opacity-80" : "hover:opacity-80"}`}
              >
                {scopeLabel}
                <svg className={`h-2.5 w-2.5 transition-transform ${headerScopeOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
              </button>
              {headerScopeOpen && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-dropdown-slide-down">
                  <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Working scope</p>
                  {SCOPE_OPTIONS.map((opt) => (
                    <button key={opt.key} type="button" onClick={() => { changeScope(opt.key); setHeaderScopeOpen(false); }}
                      className={`flex w-full items-start gap-3 rounded-xl px-3 py-2 text-left transition-colors ${scope === opt.key ? "bg-slate-50" : "hover:bg-slate-50"}`}>
                      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full border ${opt.key === "compassion" ? "bg-blue-400 border-blue-300" : opt.key === "events" ? "bg-amber-400 border-amber-300" : opt.key === "hrm" ? "bg-purple-400 border-purple-300" : opt.key === "webmaster" ? "bg-rose-400 border-rose-300" : opt.key === "watchdog" ? "bg-slate-400 border-slate-300" : opt.key === "all" ? "bg-slate-700 border-slate-600" : "bg-emerald-500 border-emerald-400"}`} />
                      <div className="min-w-0"><p className="text-xs font-semibold text-slate-800">{opt.label}</p><p className="text-[10px] text-slate-500">{opt.description}</p></div>
                      {scope === opt.key && <svg className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mode tabs — compact */}
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-100 bg-slate-50 p-0.5 overflow-x-auto scrollbar-none ml-1">
              {(["ask", "analyze", "draft", "action"] as ChatMode[]).map((m) => (
                <button key={m} type="button" onClick={() => setMode(m)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold capitalize transition-colors whitespace-nowrap ${mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}>
                  {m}
                </button>
              ))}
            </div>

            <div className="ml-1 flex items-center rounded-lg border border-slate-100 bg-slate-50 p-0.5">
              {(["markdown", "html"] as RenderMode[]).map((current) => (
                <button
                  key={current}
                  type="button"
                  onClick={() => changeRenderMode(current)}
                  className={`rounded-md px-2 py-1 text-[10px] font-semibold uppercase transition-colors ${
                    renderMode === current ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {current}
                </button>
              ))}
            </div>

            {/* Expand to full workspace */}
            <a href="/steward-ai-workspace" target="_blank" rel="noopener noreferrer"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-700 transition-colors shadow-sm"
              title="Open full workspace">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          </div>
        ) : (
        <div className="flex shrink-0 items-center gap-2 border-b border-slate-100 bg-white px-3 py-2 sm:px-4 sm:py-2.5 min-h-[52px]">
          {/* Hamburger — always visible, opens sidebar */}
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-50 hover:text-slate-600 transition-colors"
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
            aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>

          {/* Scope selector pill — visible on all screen sizes (replaces plain mobile title) */}
          <div className="relative" ref={headerScopeRef}>
            <button
              type="button"
              onClick={() => { setHeaderScopeOpen((v) => !v); setScopeOpen(false); setAddOpen(false); setToolsOpen(false); }}
              className={`inline-flex items-center gap-1 sm:gap-1.5 rounded-full border px-2 sm:px-3 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold transition-opacity ${scopeColor} ${headerScopeOpen ? "opacity-80" : "hover:opacity-80"}`}
            >
              <span className="sm:hidden max-w-[80px] truncate">{scopeLabel.split(" ")[0]}</span>
              <span className="hidden sm:inline">{scopeLabel}</span>
              <svg className={`h-2.5 w-2.5 sm:h-3 sm:w-3 transition-transform ${headerScopeOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {headerScopeOpen && (
              <div className="absolute left-0 top-full z-50 mt-1.5 w-72 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl animate-dropdown-slide-down">
                <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Working scope</p>
                {SCOPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => { changeScope(opt.key); setHeaderScopeOpen(false); }}
                    className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                      scope === opt.key ? "bg-slate-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full border ${
                      opt.key === "compassion" ? "bg-blue-400 border-blue-300" :
                      opt.key === "events"     ? "bg-amber-400 border-amber-300" :
                      opt.key === "hrm"        ? "bg-purple-400 border-purple-300" :
                      opt.key === "webmaster"  ? "bg-rose-400 border-rose-300" :
                      opt.key === "watchdog"   ? "bg-slate-400 border-slate-300" :
                      opt.key === "all"        ? "bg-slate-700 border-slate-600" : "bg-emerald-500 border-emerald-400"
                    }`} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{opt.label}</p>
                      <p className="text-[10px] text-slate-500 leading-4">{opt.description}</p>
                    </div>
                    {scope === opt.key && (
                      <svg className="ml-auto mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Mode selector — horizontally scrollable, no max-width cap */}
          <div className="flex items-center gap-0.5 rounded-xl border border-slate-100 bg-slate-50 p-0.5 overflow-x-auto scrollbar-none shrink min-w-0">
            {(["ask", "analyze", "draft", "action"] as ChatMode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`rounded-lg px-2.5 py-1.5 sm:py-1 text-[11px] font-semibold capitalize transition-colors whitespace-nowrap touch-manipulation ${
                  mode === m
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          <div className="hidden sm:flex items-center gap-0.5 rounded-xl border border-slate-100 bg-slate-50 p-0.5">
            {(["markdown", "html"] as RenderMode[]).map((current) => (
              <button
                key={current}
                type="button"
                onClick={() => changeRenderMode(current)}
                className={`rounded-lg px-2.5 py-1 text-[10px] font-semibold uppercase transition-colors ${
                  renderMode === current ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {current}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {/* AI status indicator — icon-only on mobile */}
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-medium ${
              aiConfig?.enabled
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-amber-200 bg-amber-50 text-amber-700"
            }`}>
              <span className={`h-1.5 w-1.5 rounded-full ${aiConfig?.enabled ? "bg-emerald-500" : "bg-amber-400"}`} />
              <span className="hidden sm:inline">
                {aiConfig?.enabled ? (modelUsed ? `${modelUsed}` : `${aiConfig.mode === "local" ? "Local" : "Remote"} AI`) : "AI not configured"}
              </span>
            </span>
            {/* Link back to CRM */}
            <Link href="/" className="flex h-9 w-9 sm:h-auto sm:w-auto items-center justify-center sm:gap-1.5 rounded-xl border border-slate-200 bg-white sm:px-3 sm:py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-800 transition-colors shadow-sm">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" /></svg>
              <span className="hidden sm:inline">Back to CRM</span>
            </Link>
          </div>
        </div>
        )} {/* end dockMode ? dock-header : full-header */}

        {!dockMode && (
          <div className="shrink-0 border-b border-slate-100 bg-slate-50/70 px-3 py-2 sm:px-4">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5 text-slate-600">
                <Link href="/" className="hover:text-emerald-700 hover:underline">Donor CRM</Link>
                <span className="text-slate-300">/</span>
                <span className="font-semibold text-slate-900">AGENTSteward</span>
                <span className={`ml-1 rounded-full border px-2 py-0.5 font-semibold ${scopeColor}`}>{scopeLabel}</span>
              </div>
              <span className="max-w-full truncate text-slate-500">{MODE_HELP[mode]}</span>
            </div>
          </div>
        )}

        {/* ── Conversation ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}>
          <div className="mx-auto max-w-3xl px-3 py-4 sm:px-4 sm:py-6">

            {/* Empty state with starter prompts */}
            {isEmptyChat ? (
              <div className="flex flex-col items-center justify-center min-h-[40vh] sm:min-h-[50vh] gap-4 sm:gap-8 text-center px-2">
                <div>
                  <div className="mx-auto mb-3 sm:mb-4 flex h-12 sm:h-14 w-12 sm:w-14 items-center justify-center rounded-2xl bg-emerald-50 shadow-lg">
                    <StewardAvatarIcon size={40} alt="Steward" className="ring-emerald-300" />
                  </div>
                  <h2 className="text-xl sm:text-2xl font-semibold text-slate-900">What can I help with?</h2>
                  <p className="mt-1.5 sm:mt-2 text-sm text-slate-500 max-w-sm mx-auto hidden sm:block">
                    Ask anything about your {scopeLabel} data, draft content, analyze trends, or plan next steps.
                  </p>
                  <p className="mt-1.5 text-xs text-slate-500 sm:hidden">{scopeLabel} · Ask, analyze, draft or take action.</p>
                </div>

                <div className="grid w-full max-w-xl gap-2 sm:grid-cols-2">
                  {QUICK_WORKFLOWS.map((workflow) => (
                    <button
                      key={workflow.label}
                      type="button"
                      onClick={() => { setMode(workflow.mode); void send(workflow.prompt); }}
                      disabled={sending}
                      className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-left text-sm text-emerald-800 shadow-sm transition-all hover:border-emerald-300 hover:bg-emerald-100"
                    >
                      <span className="block text-xs font-semibold uppercase tracking-wide text-emerald-600">{workflow.mode}</span>
                      {workflow.label}
                    </button>
                  ))}
                  {prompts.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void send(p)}
                      disabled={sending}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 min-h-[52px] sm:min-h-0 text-left text-sm text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:shadow transition-all"
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {messages.map((msg, i) => (
                  <MessageRow
                    key={msg.id}
                    msg={msg}
                    renderMode={renderMode}
                    isStreaming={msg.id === activeAssistantId}
                    onRegenerate={() => regenerate(msg.id)}
                    onCopy={() => void copyMessage(msg.content)}
                    onRunAction={(idx) => void runAction(msg.id, idx)}
                    isLast={i === messages.length - 1}
                  />
                ))}
              </div>
            )}

            {/* Error banner */}
            {error && (
              <div className="mt-4 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-500" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 8v4M12 16h.01" /></svg>
                <div className="min-w-0 flex-1">
                  {error}
                  <button onClick={() => setError(null)} className="ml-2 text-xs text-red-600 underline hover:no-underline">Dismiss</button>
                </div>
              </div>
            )}

            {/* Action status */}
            {actionStatus && (
              <div className={`mt-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm ${
                actionStatus.tone === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}>
                {actionStatus.message}
                <button onClick={() => setActionStatus(null)} className="ml-auto text-xs opacity-60 hover:opacity-100">✕</button>
              </div>
            )}

            <div ref={bottomRef} className="h-6" />
          </div>
        </div>

        {/* ── Composer ─────────────────────────────────────────────────────
             Safe-area padding handles iOS home-indicator area.
        ──────────────────────────────────────────────────────────────────── */}
        <div className="shrink-0 border-t border-slate-100 bg-white px-3 pt-3 sm:px-4" style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="mx-auto max-w-3xl">
            {/* Composer card */}
            <div ref={composerRef} className="relative rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 focus-within:shadow-lg focus-within:border-emerald-300 hover:shadow-md">
              {lockedDonors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 px-3 pt-2.5 sm:px-4">
                  {lockedDonors.map((d) => {
                    const name = [d.firstName, d.lastName].filter(Boolean).join(" ") || d.email || "Unknown";
                    return (
                      <span
                        key={d.id}
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700 animate-scale-in shadow-sm"
                      >
                        <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                        {name}
                        <button
                          type="button"
                          onClick={() => setLockedDonors((prev) => prev.filter((x) => x.id !== d.id))}
                          className="ml-0.5 text-emerald-400 hover:text-emerald-700 leading-none"
                          aria-label={`Remove ${name} from context`}
                        >×</button>
                      </span>
                    );
                  })}
                  <span className="text-[10px] text-slate-400 self-center">— locked in context</span>
                </div>
              )}

              {/* @mention picker — rendered above the textarea */}
              {mentionQuery !== null && (
                <div className="relative">
                  <DonorMentionPicker
                    query={mentionQuery}
                    onSelect={handleMentionSelect}
                    onDismiss={() => setMentionQuery(null)}
                    anchorRef={composerRef}
                  />
                </div>
              )}

              {/* Hidden file input for attach / CSV upload */}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={(e) => handleFileAttach(e.target.files)}
              />

              {/* Text input */}
              <div className="px-3 pt-3 pb-2 sm:px-4">
                <textarea
                  ref={textareaRef}
                  value={draft}
                  onChange={handleDraftChange}
                  onKeyDown={handleKeyDown}
                  placeholder={lockedDonors.length > 0
                    ? `Ask about ${[lockedDonors[0].firstName, lockedDonors[0].lastName].filter(Boolean).join(" ") || "this donor"}…`
                    : "Ask Steward anything… (type @ to mention a donor)"}
                  rows={1}
                  disabled={sending}
                  className="w-full resize-none bg-transparent text-base sm:text-sm text-slate-900 placeholder-slate-400 outline-none"
                  style={{ maxHeight: "140px" }}
                />
              </div>

              {/* Composer toolbar */}
              <div className="flex items-center justify-between gap-1.5 border-t border-slate-100 px-2 py-2 sm:px-3">
                {/* Left: Add · Scope · Tools — allow wrapping so dropdowns are not clipped */}
                <div className="flex min-w-0 flex-wrap items-center gap-1 overflow-visible sm:flex-nowrap">

                  {/* + Add */}
                  <div className="relative shrink-0" data-composer-dropdown>
                    <button
                      type="button"
                      onClick={() => { setAddOpen((v) => !v); setToolsOpen(false); setScopeOpen(false); }}
                      className={`flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-xl sm:rounded-lg border text-base font-light transition-colors ${addOpen ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700"}`}
                      title="Add context or files"
                      aria-expanded={addOpen}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
                    </button>
                    {addOpen && (
                      <div className="absolute bottom-full left-0 mb-2 z-50 w-[calc(100vw-2rem)] max-w-[240px] sm:w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-dropdown-slide-down">
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 animate-fade-in">Add context</div>
                        {ADD_CONTEXT_MENU_ITEMS.map(({ key, label, icon }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => handleAddContextAction(key)}
                            className="flex w-full items-center gap-2.5 px-3 py-3 sm:py-2 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-all duration-150"
                          >
                            <svg className="h-4 w-4 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d={icon} /></svg>
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Scope */}
                  <div className="relative shrink-0" ref={scopeRef} data-composer-dropdown>
                    <button
                      type="button"
                      onClick={() => { setScopeOpen((v) => !v); setAddOpen(false); setToolsOpen(false); setHeaderScopeOpen(false); }}
                      className={`flex h-9 sm:h-7 items-center gap-1.5 rounded-xl sm:rounded-lg border px-2.5 text-xs font-medium transition-colors ${scopeOpen ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                      aria-expanded={scopeOpen}
                    >
                      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" /></svg>
                      {scopeLabel}
                      <svg className={`h-3 w-3 transition-transform ${scopeOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {scopeOpen && (
                      <div className="absolute bottom-full left-0 mb-2 z-50 w-[calc(100vw-2rem)] max-w-[260px] sm:w-60 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-dropdown-slide-down">
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 animate-fade-in">Scope</div>
                        {SCOPE_OPTIONS.map((opt) => (
                          <button
                            key={opt.key}
                            type="button"
                            onClick={() => { setScope(opt.key); setScopeOpen(false); }}
                            className={`flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-slate-50 ${opt.key === scope ? "bg-slate-50" : ""}`}
                          >
                            <span className={`mt-0.5 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${opt.color}`}>
                              {opt.label[0]}
                            </span>
                            <div>
                              <p className={`text-xs font-semibold ${opt.key === scope ? "text-emerald-700" : "text-slate-800"}`}>{opt.label}</p>
                              <p className="text-[11px] text-slate-400">{opt.description}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Tools */}
                  <div className="relative shrink-0" data-composer-dropdown>
                    <button
                      type="button"
                      onClick={() => { setToolsOpen((v) => !v); setAddOpen(false); setScopeOpen(false); }}
                      className={`flex h-9 sm:h-7 items-center gap-1.5 rounded-xl sm:rounded-lg border px-2.5 text-xs font-medium transition-colors ${toolsOpen ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
                      aria-expanded={toolsOpen}
                    >
                      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
                      Tools
                      <svg className={`h-3 w-3 transition-transform ${toolsOpen ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
                    </button>
                    {toolsOpen && (
                      <div className="absolute bottom-full left-0 mb-2 z-50 w-[calc(100vw-2rem)] max-w-[240px] sm:w-52 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl animate-dropdown-slide-down">
                        <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400 animate-fade-in">Tools</div>
                        {[
                          { label: "Create report",        prompt: "Create a report on " },
                          { label: "Draft email",          prompt: "Draft an email to " },
                          { label: "Draft letter",         prompt: "Draft a letter to " },
                          { label: "Analyze donors",       prompt: "Analyze donor giving patterns and summarize insights." },
                          { label: "Build export",         prompt: "Build an export of " },
                          { label: "Create task",          prompt: "Create a follow-up task for " },
                          { label: "Summarize records",    prompt: "Summarize the key records and activity for " },
                          { label: "Compare campaigns",    prompt: "Compare giving performance across campaigns." },
                          { label: "Find lapsed donors",   prompt: "Find donors who gave last year but not this year." },
                        ].map(({ label, prompt }) => (
                          <button
                            key={label}
                            type="button"
                            onClick={() => {
                              setDraft(prompt);
                              setToolsOpen(false);
                              setTimeout(() => {
                                const ta = textareaRef.current;
                                if (ta) { ta.focus(); ta.setSelectionRange(prompt.length, prompt.length); }
                              }, 50);
                            }}
                            className="flex w-full items-center px-3 py-3 sm:py-2 text-sm text-slate-700 hover:bg-slate-50 active:bg-slate-100 transition-all duration-150"
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Fiscal year toggle — locks Steward to FY vs calendar year */}
                  {(scope === "donor" || scope === "all") && (
                    <button
                      type="button"
                      onClick={toggleReportingYearMode}
                      // shrink-0 keeps the FY pill from getting squished in the scrollable toolbar
                      title={
                        reportingYearMode === "fiscal"
                          ? `Fiscal year mode on — FY${getFiscalYearForDate(new Date(), fiscalYearStart)} (month ${fiscalYearStart}–${getFiscalYearEndMonth(fiscalYearStart)}). Click for calendar year.`
                          : `Calendar year mode — ${new Date().getFullYear()}. Click for fiscal year mode.`
                      }
                      className={`flex h-9 sm:h-7 shrink-0 items-center gap-1.5 rounded-xl sm:rounded-lg border px-2.5 text-xs font-semibold transition-all ${
                        reportingYearMode === "fiscal"
                          ? "border-emerald-500/60 bg-emerald-600/15 text-emerald-700 hover:bg-emerald-600/25"
                          : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-100"
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
                  )}
                </div>

                {/* Right: Mic · Send/Stop */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Mic */}
                  <button
                    type="button"
                    disabled={sending}
                    onClick={() => {
                      if (!("webkitSpeechRecognition" in window || "SpeechRecognition" in window)) return;
                      const speechWindow = window as Window & {
                        SpeechRecognition?: SpeechRecognitionConstructorLike;
                        webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
                      };
                      const SR = speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
                      if (!SR) return;
                      const recog = new SR();
                      recog.lang = "en-US";
                      recog.interimResults = false;
                      recog.onresult = (ev: SpeechRecognitionEventLike) => {
                        const text = ev.results[0]?.[0]?.transcript ?? "";
                        if (text) setDraft((d) => (d ? `${d} ${text}` : text));
                      };
                      recog.start();
                    }}
                    className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-xl sm:rounded-lg border border-slate-200 bg-white text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-40 transition-colors"
                    title="Voice input"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19 10v2a7 7 0 01-14 0v-2M12 19v4M8 23h8" /></svg>
                  </button>

                  {/* Send / Stop */}
                  {sending ? (
                    <button
                      type="button"
                      onClick={stopGeneration}
                      className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-xl sm:rounded-lg bg-slate-900 text-white hover:bg-slate-700 active:scale-95 transition-all duration-150"
                      title="Stop generation"
                    >
                      <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="1.5" /></svg>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => void send()}
                      disabled={!draft.trim()}
                      className="flex h-9 w-9 sm:h-7 sm:w-7 items-center justify-center rounded-xl sm:rounded-lg bg-emerald-600 text-white shadow-sm hover:bg-emerald-700 hover:shadow-md active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
                      title="Send (Enter)"
                    >
                      <svg className="h-4 w-4 sm:h-3.5 sm:w-3.5" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M5 12l7-7 7 7" /></svg>
                    </button>
                  )}
                </div>
              </div>
            </div>

            <p className="mt-1.5 text-center text-[10px] text-slate-400 hidden sm:block">
              AGENTSteward may make mistakes. Human review required before sending or changing CRM records.
            </p>
          </div>
        </div>
      </div>

      {emailWorkspace && (
        <WorkspaceSetupModal
          title="Steward Email Workspace"
          subtitle="Build, preview, and revise this draft without leaving AGENTSteward."
          onClose={() => setEmailWorkspace(null)}
          maxWidthClassName="max-w-[96vw]"
        >
          <div className="px-4 pb-4 pt-12">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <span>Use Preview in the builder header, then ask Steward for edits and run the next build action.</span>
              <a
                href={`/email-builder?campaign=${encodeURIComponent(emailWorkspace.campaignId)}${emailWorkspace.returnTo ? `&returnTo=${encodeURIComponent(emailWorkspace.returnTo)}` : ""}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Open full page
              </a>
            </div>
            <EmailBuilderApp
              campaignId={emailWorkspace.campaignId}
              returnTo={emailWorkspace.returnTo}
              embedded
              onSaved={async () => {
                setActionStatus({ tone: "success", message: "Email draft saved from AGENTSteward workspace." });
              }}
            />
          </div>
        </WorkspaceSetupModal>
      )}

      {letterWorkspace && (
        <WorkspaceSetupModal
          title="Steward Letter Workspace"
          subtitle="Build, preview, and revise this letter draft directly in AGENTSteward."
          onClose={() => setLetterWorkspace(null)}
          maxWidthClassName="max-w-[96vw]"
        >
          <div className="px-4 pb-4 pt-12">
            <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              <span>Switch to Preview inside the letter editor and continue revisions from chat prompts.</span>
              <a
                href={`/letters-printables/templates/${encodeURIComponent(letterWorkspace.templateId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-100"
              >
                Open full page
              </a>
            </div>
            <div className="h-[82vh] min-h-[640px] overflow-hidden rounded-xl border border-gray-200 bg-white">
              <LetterTemplateEditor
                templateId={letterWorkspace.templateId}
                initialPanel={letterWorkspace.initialPanel ?? "document"}
              />
            </div>
          </div>
        </WorkspaceSetupModal>
      )}
    </div>
  );
}

// ─── MessageRow sub-component ─────────────────────────────────────────────────

interface MessageRowProps {
  msg: UiMessage;
  renderMode: RenderMode;
  isStreaming: boolean;
  isLast: boolean;
  onRegenerate: () => void;
  onCopy: () => void;
  onRunAction: (idx: number) => void;
}

function MessageRow({ msg, renderMode, isStreaming, isLast, onRegenerate, onCopy, onRunAction }: MessageRowProps) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end animate-slide-up-fade-in">
        <div className="max-w-[85%] sm:max-w-[80%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-3 text-sm text-white shadow-sm hover:shadow-md transition-shadow duration-200">
          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  return (
    <div className="group flex flex-col gap-2 animate-slide-up-fade-in">
      {/* Avatar + name row */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <StewardAvatarIcon size={24} alt="Steward" />
          {isStreaming && <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-emerald-400 animate-spin-slow" />}
        </div>
        <span className="text-xs font-semibold text-slate-700">Steward</span>
        {msg.runtimeMode && (
          <span className="text-[10px] text-slate-400 animate-fade-in">
            {msg.runtimeMode === "local" ? "local AI" : msg.runtimeMode === "remote" ? "remote AI" : ""}
          </span>
        )}
        {isStreaming && (
          <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 animate-fade-in">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
            Thinking…
          </span>
        )}
      </div>

      {/* Content */}
      <div className="pl-8">
        {/* Thinking panel: progress steps + reasoning tokens */}
        {(isStreaming || msg.progressSteps?.length || msg.thinkingContent) && (
          <StewardThinkingPanel
            progressSteps={msg.progressSteps ?? []}
            thinkingContent={msg.thinkingContent ?? ""}
            isActive={isStreaming}
          />
        )}
        {isStreaming && !msg.content ? (
          <span className="inline-flex items-center gap-1.5 text-slate-400">
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "0ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "150ms" }} />
            <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: "300ms" }} />
          </span>
        ) : (
          <StewardResponseRenderer
            content={msg.content}
            structured={msg.structured}
            tone="light"
            renderMode={renderMode}
            toolsUsed={msg.toolsUsed}
            recordsUsed={msg.recordsUsed}
            provider={msg.provider}
            moduleKey={msg.moduleKey ?? undefined}
            generatedAt={msg.createdAt}
            onSuggestedAction={(action) => {
              const idx = msg.structured?.suggestedActions.findIndex(
                (a) => a.label === action.label && a.actionType === action.actionType
              ) ?? -1;
              if (idx >= 0) onRunAction(idx);
            }}
            onCopy={!isStreaming && (isLast || true) ? onCopy : undefined}
            onRegenerate={!isStreaming ? onRegenerate : undefined}
          />
        )}
      </div>
    </div>
  );
}

