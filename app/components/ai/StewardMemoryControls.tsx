"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
type Memory = { id: string; title: string; content: string; updatedAt: string };
export default function StewardMemoryControls() {
  const [items, setItems] = useState<Memory[]>([]);
  const [enabled, setEnabled] = useState(false);
  const [content, setContent] = useState("");
  const [status, setStatus] = useState("Loading memory controls…");
  const [busy, setBusy] = useState(false);
  async function load() {
    const [memories, preference] = await Promise.all([apiFetch<Memory[]>("/api/steward-ai/memories"), apiFetch<{ memoryEnabled: boolean }>("/api/steward-ai/memory/preferences")]);
    if (!Array.isArray(memories) || typeof preference.memoryEnabled !== "boolean") throw new Error("Invalid memory response.");
    setItems(memories); setEnabled(preference.memoryEnabled); setStatus("");
  }
  useEffect(() => { void load().catch(() => setStatus("Memory controls could not load. Reopen to retry.")); }, []);
  async function run(operation: () => Promise<unknown>) { if (busy) return; setBusy(true); try { await operation(); await load(); } catch { setStatus("Memory change was not confirmed. Retry before relying on it."); } finally { setBusy(false); } }
  return <section className="steward-chat-card"><h4>Steward’s saved memory</h4><p>Save durable preferences deliberately. Current CRM records take precedence over memories and compacted chat history.</p><label><input type="checkbox" checked={enabled} disabled={busy} onChange={event => { const checked = event.target.checked; void run(() => apiFetch("/api/steward-ai/memory/preferences", { method: "PUT", body: JSON.stringify({ memoryEnabled: checked }) })); }} />Use my saved memories</label><form onSubmit={event => { event.preventDefault(); if (content.trim().length < 3) return; void run(async () => { await apiFetch("/api/steward-ai/memories", { method: "POST", body: JSON.stringify({ content: content.trim(), category: "preference", source: "manual", workspaceScope: "global" }) }); setContent(""); }); }}><label>Preference to remember<textarea aria-label="Preference to remember" maxLength={2400} value={content} onChange={event => setContent(event.target.value)} /></label><button disabled={busy || content.trim().length < 3}>Save memory</button></form>{status ? <p role="status">{status}</p> : null}{items.map(item => <div key={item.id} className="steward-memory-item"><strong>{item.title}</strong><p>{item.content}</p><small>Updated {new Date(item.updatedAt).toLocaleDateString()}</small><button disabled={busy} onClick={() => { if (window.confirm("Delete this saved memory?")) void run(() => apiFetch(`/api/steward-ai/memories/${encodeURIComponent(item.id)}`, { method: "DELETE" })); }}>Forget</button></div>)}</section>;
}
