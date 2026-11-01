"use client";
import { useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
export const BRIDGE_PENDING_KEY = "oyama.bridge.pending.v2";
export default function BridgeConnectPanel({ onConnected }: { onConnected: () => void }) {
  const [key, setKey] = useState(""); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
  async function connect(value: string) {
    if (!value.trim()) return; setBusy(true); setMessage("Verifying the desktop endpoint, API key, and installed models…");
    try { await apiFetch("/api/steward-ai/bridge/connect", { method: "POST", body: JSON.stringify({ connectionKey: value }) }); setKey(""); try { sessionStorage.removeItem(BRIDGE_PENDING_KEY); } catch { /* Storage may be disabled. */ } setMessage("Connected. Desktop authentication and selected models were verified, and CRM settings were saved."); onConnected(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Connection failed. Existing settings were preserved."); }
    finally { setBusy(false); }
  }
  useEffect(() => {
    let raw: string | null; try { raw = sessionStorage.getItem(BRIDGE_PENDING_KEY); } catch { return; } if (!raw) return;
    try { sessionStorage.removeItem(BRIDGE_PENDING_KEY); } catch { /* Storage may be disabled. */ }
    try { const pending = JSON.parse(raw); if (pending.expires > Date.now() && typeof pending.key === "string") { setKey(pending.key); setMessage("Desktop handoff received. Review the endpoint and select Verify and connect. No settings have changed yet."); } } catch { setMessage("The desktop connection request could not be read. Start it again from the desktop app."); }
    // Consume each explicit desktop connection request only once.
  }, []);
  let preview = "";
  try {
    let raw = key.trim();
    if (/^https?:/.test(raw)) { const url = new URL(raw); raw = url.searchParams.get("bridgePair") || new URLSearchParams(url.hash.slice(1)).get("bridgePair") || ""; }
    const decoded = JSON.parse(raw.startsWith("{") ? raw : atob(raw.split(".")[0].replace(/-/g, "+").replace(/_/g, "/")));
    const payload = decoded.payload || decoded;
    if (typeof payload.endpoint === "string") preview = `${payload.endpoint} · ${String(payload.model || "")}`;
  } catch { /* Preview only; the server validates the actual key. */ }
  return <section className="rounded-lg border border-blue-200 bg-blue-50 p-4"><h2 className="font-semibold text-slate-900">Connect from Oyama Bridge</h2><p className="mt-1 text-sm text-slate-600">Use “Sign in and connect CRM” in the desktop app. You can also paste its connection key here. Settings are saved only after a live verification.</p><input type="password" aria-label="Desktop connection key" autoComplete="off" value={key} onChange={event => setKey(event.target.value)} className="mt-3 w-full rounded border bg-white p-2 text-xs" placeholder="Paste desktop connection key or URL" />{preview ? <p className="mt-2 break-all text-sm font-semibold text-slate-800">Desktop endpoint: {preview}</p> : null}<button type="button" disabled={busy || !key.trim()} onClick={() => void connect(key)} className="mt-2 rounded bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50">{busy ? "Connecting…" : "Verify and connect"}</button>{message ? <p role="status" className="mt-3 text-sm text-slate-700">{message}</p> : null}</section>;
}
