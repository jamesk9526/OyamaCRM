"use client";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { McpPolicy } from "@/server/src/chatgpt/policy";
import ChatGptMcpControls from "./ChatGptMcpControls";

type Setup = { enabled: boolean; installationEnabled: boolean; policy: McpPolicy; policyRevision: number; canManagePolicy: boolean; mcpUrl: string; clientId: string; redirectUris: string[]; scopes: string[]; connections: { id: string; scopes: string; createdAt: string; lastUsedAt: string | null }[] };
export default function ChatGptConnection() {
  const [data, setData] = useState<Setup | null>(null), [error, setError] = useState(""), [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [instanceOrigin, setInstanceOrigin] = useState(""), [copied, setCopied] = useState(false);
  const load = useCallback(async () => { setInstanceOrigin(window.location.origin); try { setError(""); setData(await apiFetch<Setup>("/api/chatgpt/connections")); } catch (e) { setError(e instanceof Error ? e.message : "Unable to load ChatGPT connections."); } }, []);
  useEffect(() => { void load(); }, [load]);
  return <section aria-labelledby="chatgpt-heading" className="rounded-xl border border-slate-200 bg-white p-5 text-slate-900">
    <h2 id="chatgpt-heading" className="text-lg font-semibold">ChatGPT · Letters and reporting</h2>
    <p className="mt-2 text-sm text-slate-600">Connect your OyamaCRM account inside ChatGPT to find letters, save new Create drafts and run aggregate reports. AI runs in ChatGPT under your plan and workspace limits.</p>
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
      {!data.installationEnabled && <p className="mt-2 text-sm text-slate-600">An administrator must configure this installation’s public HTTPS address, enable ChatGPT and allow the exact callback URL shown in ChatGPT’s connection setup.</p>}
      {data.installationEnabled && data.mcpUrl !== `${instanceOrigin}/api/chatgpt/mcp` && <p role="alert" className="mt-2 text-sm text-amber-900">The server’s OAuth address differs from this domain. Set CHATGPT_PUBLIC_URL to this installation’s public origin before connecting, or open the correctly configured domain.</p>}
      <h3 className="mt-4 font-semibold">How to connect</h3>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm">
        <li>Have your administrator deploy the current app and run its database migrations. Use this installation’s public HTTPS domain.</li>
        <li>In ChatGPT on the web, open <a href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">Plugins</a>, select <strong>+ → Add custom MCP server</strong>, and name it “OyamaCRM”. Custom server setup must be available for your account.</li>
        <li>Choose a public MCP server connection and paste the MCP URL above. Select <strong>OAuth</strong>. Use client ID <code className="break-all">{data.clientId}</code> with public-client authentication and no client secret. If scopes are requested, use <code className="break-all">{data.scopes.join(" ")}</code>, or only <code>reports.read</code> for reporting access.</li>
        <li>Copy the <strong>exact OAuth redirect URI shown by ChatGPT</strong>. Have your administrator allow it using the server setup below and restart the API. Return to ChatGPT, review the connection details and choose <strong>Create as a plugin</strong>. Refresh or retry if the server was previously disabled.</li>
        <li>Connect your account, sign in to this OyamaCRM installation, complete any verification and choose <strong>Allow connection</strong>.</li>
        <li>In a new ChatGPT conversation, type <strong>@</strong> and select OyamaCRM. Try the example requests below. Enable draft creation in MCP controls if you want ChatGPT to save new letters.</li>
      </ol>
      {data.canManagePolicy && <details className="mt-4 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Server setup · administrator</summary><p className="mt-2 text-sm text-slate-600">Add these values to this installation’s API environment, replace the callback placeholder with ChatGPT’s exact redirect URI, then restart the API. Apply the ChatGPT database migration first. These values identify your server; they contain no passwords or API keys.</p><pre className="mt-3 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs">{`CHATGPT_ENABLED=true\nCHATGPT_PUBLIC_URL=${instanceOrigin}\nCHATGPT_CLIENT_ID=${data.clientId}\nCHATGPT_REDIRECT_URIS=<exact redirect URI from ChatGPT>`}</pre><p className="mt-3 text-sm text-slate-600">Verify public routing with:</p><pre className="mt-2 overflow-x-auto rounded-lg bg-slate-100 p-3 text-xs">{`node scripts/chatgpt-check.mjs ${instanceOrigin}`}</pre><p className="mt-2 text-sm text-slate-600">Allow the OAuth discovery paths and /api/chatgpt/* through your reverse proxy. The standard OyamaCRM web proxy already forwards them.</p></details>}
      <p className="mt-3 text-sm text-slate-600">Try: “Find our appeal letters” or “Run campaign performance for this year.” New drafts stay in Create for review.</p>
      {notice && <p role="status" className="mt-3 text-sm text-green-800">{notice}</p>}
      <ChatGptMcpControls key={data.policyRevision} policy={data.policy} revision={data.policyRevision} canManage={data.canManagePolicy} onReload={load} onSaved={async () => { await load(); setNotice("MCP controls saved. Subsequent requests use the updated policy."); }}/>
      <h3 className="mt-5 font-semibold">Your connected sessions</h3>
      {!data.connections.length && <p className="mt-2 text-sm text-slate-600">No active ChatGPT connections for your account.</p>}
      <ul className="mt-2 space-y-3">{data.connections.map(connection => <li key={connection.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm"><div><p className="font-medium">ChatGPT · {new Date(connection.createdAt).toLocaleDateString()}</p><p className="break-all text-slate-600">{connection.scopes}</p><p className="text-slate-600">{connection.lastUsedAt ? `Last used ${new Date(connection.lastUsedAt).toLocaleString()}` : "Not used yet"}</p></div><button disabled={busy} className="min-h-11 rounded-lg border border-slate-300 px-4 font-medium focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-50" onClick={async () => { setBusy(true); try { await apiFetch(`/api/chatgpt/connections/${connection.id}`, { method: "DELETE" }); await load(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to disconnect."); } finally { setBusy(false); } }}>Disconnect</button></li>)}</ul>
    </>}
  </section>;
}
