"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { ArrowUp, RotateCcw, Square, X, Sparkles } from "lucide-react";
import { getStoredReportingYearMode } from "@/app/lib/fiscal-year";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import { STEWARD_OPEN_EVENT, type StewardOpenPromptDetail } from "@/app/lib/steward-context";
import StewardMemoryControls from "./StewardMemoryControls";
import StewardFeedback from "./StewardFeedback";
import StewardResponseRenderer from "./StewardResponseRenderer";
import { executeStewardSuggestedAction } from "./steward-action-executor";
import type { StewardStructuredResponse } from "./steward-artifact-types";
import "./steward-chathead.css";

type Message = { id: string; role: "user" | "assistant"; content: string; structured?: StewardStructuredResponse; provider?: string; toolsUsed?: string[] };
type Playbook = { id: string; title: string; terms: string[]; steps: string; path: string };
type Tab = "chat" | "actions" | "insights";

/** One authenticated conversation surface shared by launcher, contextual actions and legacy links. */
export default function StewardChathead({ moduleKey = "donor" }: { moduleKey?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("chat");
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const thinkingRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [catalogError, setCatalogError] = useState(false);
  const [context, setContext] = useState({ moduleKey, scopePath: pathname || "/" });
  const input = useRef<HTMLTextAreaElement>(null);
  const launcher = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLElement>(null);
  const feed = useRef<HTMLDivElement>(null);
  const request = useRef<AbortController | null>(null);
  const sending = useRef(false);
  const history = useRef<Message[]>([]);
  const contextRef = useRef(context);

  useEffect(() => { history.current = messages; }, [messages]);
  useEffect(() => { contextRef.current = context; }, [context]);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => { feed.current?.scrollTo({ top: feed.current.scrollHeight }); }, [messages, progress]);
  useEffect(() => { if (open && tab === "chat") input.current?.focus(); }, [open, tab]);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setCatalogError(false);
    apiFetch<{ playbooks: Playbook[] }>("/api/steward-ai/playbooks")
      .then(data => { if (active) setPlaybooks(data.playbooks || []); })
      .catch(() => { if (active) setCatalogError(true); });
    return () => { active = false; };
  }, [open]);

  const send = useCallback(async (text: string, mode = "ask", override?: typeof context) => {
    const prompt = text.trim().slice(0, 3500);
    if (!prompt || sending.current) return;
    sending.current = true;
    const scope = override || contextRef.current;
    const prior = history.current;
    const user: Message = { id: crypto.randomUUID(), role: "user", content: prompt };
    const assistant: Message = { id: crypto.randomUUID(), role: "assistant", content: "" };
    const patch = (update: Partial<Message>) => setMessages(current => current.map(item => item.id === assistant.id ? { ...item, ...update } : item));
    setMessages([...prior, user, assistant]); setDraft(""); setBusy(true); setError(""); setTab("chat"); setProgress("Preparing your response…");
    const controller = new AbortController(); request.current = controller;
    try {
      const response = await apiFetchResponse("/api/steward-ai/chat/stream", {
        method: "POST", signal: controller.signal,
        body: JSON.stringify({ messages: [...prior, user].slice(-100).map(({ role, content }) => ({ role, content })), mode, thinkingEnabled: thinkingRef.current, reportingYearMode: getStoredReportingYearMode(), ...scope }),
      });
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error?.message || `Steward request failed (${response.status}).`);
      }
      const reader = response.body.getReader(); const decoder = new TextDecoder(); let buffer = ""; let content = ""; let complete = false;
      const consume = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line);
        if (event.type === "error") throw new Error(event.message || "Steward could not finish this response.");
        if (event.type === "chunk") { content += event.delta || ""; patch({ content }); }
        if (event.type === "progress") setProgress(event.message || "Working…");
        if (event.type === "done") { complete = true; patch({ content: event.reply || content, structured: event.structured, provider: event.provider, toolsUsed: event.toolsUsed }); }
      };
      while (true) {
        const next = await reader.read(); buffer += decoder.decode(next.value, { stream: !next.done });
        const lines = buffer.split("\n"); buffer = lines.pop() || ""; lines.forEach(consume);
        if (next.done) break;
      }
      consume(buffer);
      if (!complete) throw new Error("Response interrupted. Review the partial answer or retry.");
    } catch (reason) {
      setError(controller.signal.aborted ? "Response stopped. Any partial answer is incomplete." : reason instanceof Error ? reason.message : "Steward is unavailable. Please retry.");
    } finally { sending.current = false; setBusy(false); setProgress(""); request.current = null; }
  }, []);

  useEffect(() => {
    const handleOpen = (event: Event) => {
      const detail = (event as CustomEvent<StewardOpenPromptDetail>).detail;
      if (detail && typeof detail !== "object") return;
      const next = { moduleKey: detail?.moduleKey || moduleKey, scopePath: detail?.scopePath?.startsWith("/") && !detail.scopePath.startsWith("//") && !detail.scopePath.includes("\\") ? detail.scopePath : `${window.location.pathname}${window.location.search}` };
      if (!sending.current) { setContext(next); contextRef.current = next; }
      setOpen(true); setTab("chat");
      if (typeof detail?.prompt === "string") {
        if (sending.current) setDraft(detail.prompt.slice(0, 3500));
        else void send(detail.prompt, detail.mode || "ask", next);
      }
    };
    window.addEventListener(STEWARD_OPEN_EVENT, handleOpen);
    return () => window.removeEventListener(STEWARD_OPEN_EVENT, handleOpen);
  }, [moduleKey, send]);

  const close = () => { setOpen(false); launcher.current?.focus(); };
  const navigate = (path: string) => { if (path.startsWith("/") && !path.startsWith("//") && !path.includes("\\")) router.push(path); };
  if (!mounted) return null;
  return createPortal(<div className="steward-chathead-root">
    {open ? <section ref={panel} className="steward-chat-panel" role="dialog" aria-modal="false" aria-label="Steward AI assistant" onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); close(); }
    }}>
      <header className="steward-chat-header"><div className="steward-chat-avatar"><Sparkles aria-hidden="true" /></div><div><h2>Steward <span>AI</span></h2><p>{busy ? "Working on your request" : "Your CRM assistant"}</p></div><button type="button" disabled={busy} aria-label="New conversation" onClick={() => { history.current = []; setMessages([]); setError(""); setContext({ moduleKey, scopePath: pathname || "/" }); }}><RotateCcw size={18} /></button><button type="button" aria-label="Close Steward" onClick={close}><X size={21} /></button></header>
      <div className="steward-chat-tabs" role="tablist" aria-label="Steward views">{(["chat", "actions", "insights"] as const).map((value, index) => <button key={value} id={`steward-tab-${value}`} role="tab" aria-selected={tab === value} aria-controls={`steward-view-${value}`} tabIndex={tab === value ? 0 : -1} onKeyDown={event => { if (event.key === "ArrowRight" || event.key === "ArrowLeft") { event.preventDefault(); const next = (["chat", "actions", "insights"] as const)[(index + (event.key === "ArrowRight" ? 1 : 2)) % 3]; setTab(next); document.getElementById(`steward-tab-${next}`)?.focus(); } }} onClick={() => setTab(value)}>{value === "actions" ? "Quick actions" : value === "insights" ? "Insights" : "Chat"}</button>)}</div>
      <div className="steward-chat-context">Context: {context.moduleKey} · {context.scopePath.split("?")[0]}</div>
      <div ref={feed} className="steward-chat-body" id={`steward-view-${tab}`} role="tabpanel" aria-labelledby={`steward-tab-${tab}`}>
        {tab === "chat" ? <>
          {!messages.length ? <><p className="steward-chat-date">LET’S MOVE YOUR MISSION FORWARD</p><div className="steward-chat-bubble"><strong>Hello, I’m Steward.</strong><p>I can guide you through CRM workflows, help review giving, and prepare outreach for your approval. What would you like to explore?</p></div><div className="steward-chat-suggestions">{["Explain fiscal year", "Explain spreadsheet", "Show me reports"].map(prompt => <button key={prompt} onClick={() => void send(prompt, "help")}>{prompt}</button>)}</div></> : messages.map(message => <article key={message.id} className={`steward-chat-message ${message.role}`} aria-label={message.role === "user" ? "Your message" : "Steward response"}>{message.role === "user" ? <p>{message.content}</p> : message.content ? <StewardResponseRenderer compact content={message.content} structured={message.structured} provider={message.provider} toolsUsed={message.toolsUsed} moduleKey={context.moduleKey} onCopy={() => void navigator.clipboard.writeText(message.content)} onOpenReport={navigate} onAskReportQuestion={prompt => void send(prompt)} onSuggestedAction={async action => { try { const result = await executeStewardSuggestedAction({ action, structured: message.structured, replyContent: message.content, confirm: text => window.confirm(text), callApi: apiFetch, navigate, copyText: value => navigator.clipboard.writeText(value) }); if (result.status === "failed" || result.status === "ignored") setError(result.message); } catch (reason) { setError(reason instanceof Error ? reason.message : "Action failed."); } }} /> : busy ? <span>Preparing a response…</span> : <span>No completed response.</span>}{message.role === "assistant" && message.content && !busy ? <StewardFeedback messageId={message.id} content={message.content} provider={message.provider} /> : null}</article>)}
          {busy ? <p className="steward-chat-progress" role="status">{progress}</p> : null}
        </> : tab === "actions" ? <><StewardMemoryControls /><h3>Help without waiting for AI</h3><p className="steward-chat-muted">Reviewed workflows and workspace links. Record changes use the normal forms.</p>{catalogError ? <p role="alert">Workflow guides could not load. Close and reopen Steward to retry.</p> : !playbooks.length ? <p role="status">Loading workflows…</p> : playbooks.map(item => <div className="steward-chat-card" key={item.id}><h4>{item.title}</h4><p>{item.steps}</p><button onClick={() => navigate(item.path)}>Open workspace →</button></div>)}</> : <><h3>Explore your CRM evidence</h3><p className="steward-chat-muted">Choose a question to retrieve current, permissioned information. No insights are assumed before checking your data.</p>{[{ title: "Giving overview", prompt: "Show a giving summary report" }, { title: "Donors to review", prompt: "Who are our top donors?" }, { title: "Follow-up opportunities", prompt: "Review donor follow-up priorities" }].map(item => <div className="steward-chat-card" key={item.title}><h4>{item.title}</h4><button disabled={busy} onClick={() => void send(item.prompt)}>{item.prompt} →</button></div>)}</>}
      </div>
      {error ? <div className="steward-chat-error" role="alert">{error}</div> : null}
      <label className="steward-thinking-toggle"><input type="checkbox" checked={thinking} disabled={busy} onChange={event => { setThinking(event.target.checked); thinkingRef.current = event.target.checked; }} />Think carefully <span>Private reasoning · may take longer</span></label>
      <form className="steward-chat-composer" onSubmit={event => { event.preventDefault(); void send(draft); }}><div><textarea ref={input} rows={1} maxLength={3500} value={draft} onChange={event => setDraft(event.target.value)} aria-label="Your message to Steward" placeholder="Ask Steward anything…" onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(draft); } }} />{busy ? <button type="button" aria-label="Stop response" onClick={() => request.current?.abort()}><Square size={16} /></button> : <button aria-label="Send message" disabled={!draft.trim()}><ArrowUp size={19} /></button>}</div><p><span>Reviewed workflows + local AI</span><span>Review before acting</span></p></form>
    </section> : null}
    <button ref={launcher} className="steward-chat-launcher" type="button" aria-label={open ? "Close Steward AI chat" : "Open Steward AI chat"} aria-expanded={open} onClick={() => { if (open) close(); else { if (!messages.length) setContext({ moduleKey, scopePath: pathname || "/" }); setOpen(true); } }}><Sparkles aria-hidden="true" /><span className="steward-chat-tooltip">Need a hand? Ask Steward</span></button>
  </div>, document.body);
}
