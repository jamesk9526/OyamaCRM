"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { McpPolicy } from "@/server/src/chatgpt/policy";
import ChatGptMcpControls from "./ChatGptMcpControls";
import ChatGptQuickSetup, { type ChatGptSetupState } from "./ChatGptQuickSetup";

type Setup = { setup?: ChatGptSetupState; enabled: boolean; installationEnabled: boolean; policy: McpPolicy; policyRevision: number; canManagePolicy: boolean; imageGenerationConfigured?: boolean; mcpUrl: string; clientId: string; redirectUris: string[]; scopes: string[]; connections: { id: string; scopes: string; createdAt: string; lastUsedAt: string | null }[] };
export default function ChatGptConnection() {
  const [data, setData] = useState<Setup | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [instanceOrigin, setInstanceOrigin] = useState(""), [copied, setCopied] = useState(false);
  const load = useCallback(async () => { setInstanceOrigin(window.location.origin); try { setError(""); setData(await apiFetch<Setup>("/api/chatgpt/connections")); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load ChatGPT connections."); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <section aria-labelledby="chatgpt-heading" className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
    <h2 id="chatgpt-heading" className="text-lg font-semibold">ChatGPT · Letters and reporting</h2>
    <p className="mt-2 text-sm text-slate-600">Connect OyamaCRM to ChatGPT to draft letters with your branding and merge fields, add Studio images and run aggregate reports.</p>
    {instanceOrigin && <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <label htmlFor="instance-mcp-url" className="block text-sm font-semibold">This installation’s MCP URL</label>
      <div className="mt-2 flex flex-wrap gap-2"><input id="instance-mcp-url" readOnly value={`${instanceOrigin}/api/chatgpt/mcp`} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm" onFocus={event => event.target.select()}/><button type="button" className="min-h-11 rounded-lg border border-blue-300 bg-white px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-blue-700" onClick={async () => { try { await navigator.clipboard.writeText(`${instanceOrigin}/api/chatgpt/mcp`); setCopied(true); } catch { setError("Copy is unavailable. Select and copy the MCP URL field."); } }}>{copied ? "Copied" : "Copy MCP URL"}</button></div>
      <p className="mt-2 text-xs text-slate-600">Generated from this installation’s domain. Each nonprofit uses its own address.</p>
      {instanceOrigin.startsWith("http:") && <p className="mt-2 text-sm text-amber-900">This is a local or HTTP address. ChatGPT needs the deployed HTTPS address, or a supported development tunnel.</p>}
    </div>}
    {error && <div role="alert" className="mt-3 text-sm text-red-700">{error} <button className="underline" onClick={() => void load()}>Retry</button></div>}
    {!data && !error && <p role="status" className="mt-3">Loading connection settings…</p>}
    {data && <>
      <p className="mt-3 text-sm font-medium">{data.enabled ? "Ready to connect in ChatGPT" : data.installationEnabled ? "MCP access is paused for this organization" : "Server setup required"}</p>
      {!data.installationEnabled && <p className="mt-2 text-sm text-slate-600">Use Enable ChatGPT & check below. Setup is saved for this organization and takes effect immediately.</p>}
      {data.installationEnabled && data.mcpUrl !== `${instanceOrigin}/api/chatgpt/mcp` && <p role="alert" className="mt-2 text-sm text-amber-900">The configured OAuth address differs from this domain. Open the configured domain or have the server operator correct its trusted public address before connecting.</p>}
      <ChatGptQuickSetup setup={data.setup || { revision: 0, saved: false, source: "environment", origin: instanceOrigin, enabled: data.installationEnabled, locked: false, verifiedCallback: null, verifiedClientId: null, automaticClientRegistration: false }} origin={instanceOrigin} clientId={data.clientId} canManage={data.canManagePolicy} enabled={data.installationEnabled} onReload={load}/>
      {notice && <p role="status" className="mt-3 text-sm text-green-800">{notice}</p>}
      <ChatGptMcpControls key={data.policyRevision} policy={data.policy} revision={data.policyRevision} canManage={data.canManagePolicy} imageGenerationConfigured={data.imageGenerationConfigured} onReload={load} onSaved={async () => { await load(); setNotice("MCP controls saved. Refresh OyamaCRM in ChatGPT to see the available tools."); }}/>
      <h3 className="mt-5 font-semibold">Your connected sessions</h3>
      {!data.connections.length && <p className="mt-2 text-sm text-slate-600">No active ChatGPT connections for your account.</p>}
      <ul className="mt-2 space-y-3">{data.connections.map(connection => <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"><div><p className="font-medium">ChatGPT · {new Date(connection.createdAt).toLocaleDateString()}</p><p className="break-all text-slate-600">{connection.scopes}</p><p className="text-slate-600">{connection.lastUsedAt ? `Last used ${new Date(connection.lastUsedAt).toLocaleString()}` : "Not used yet"}</p></div><button disabled={busy} className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50" onClick={async () => { setBusy(true); try { await apiFetch(`/api/chatgpt/connections/${connection.id}`, { method: "DELETE" }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to disconnect."); } finally { setBusy(false); } }}>Disconnect</button></li>)}</ul>
    </>}
  </section>;
}
