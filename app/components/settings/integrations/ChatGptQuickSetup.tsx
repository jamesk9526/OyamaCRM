"use client";
import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { checkChatGptDiscovery, type ChatGptDiscoveryCheck } from "@/app/lib/chatgpt-discovery";
export type ChatGptSetupState = { revision: number; saved: boolean; source: string; origin: string; enabled: boolean; locked: boolean; verifiedCallback: string | null; verifiedClientId: string | null; automaticClientRegistration: boolean };
function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false), [error, setError] = useState(false);
  return <div className="min-w-0 rounded-lg border border-slate-200 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">{label}</span><button type="button" className="min-h-9 rounded-md border border-slate-300 px-3 text-xs font-medium focus-visible:outline-2 focus-visible:outline-blue-700" aria-label={`Copy ${label}`} onClick={async () => { try { await navigator.clipboard.writeText(value); setCopied(true); setError(false); } catch { setError(true); } }}>{copied ? "Copied" : "Copy"}</button></div><pre className="mt-2 whitespace-pre-wrap break-all text-xs text-slate-700">{value}</pre>{error && <p role="alert" className="mt-2 text-xs text-red-700">Select and copy the value above.</p>}</div>;
}
export default function ChatGptQuickSetup({ setup, origin, clientId, canManage, enabled, onReload }: { setup: ChatGptSetupState; origin: string; clientId: string; canManage: boolean; enabled: boolean; onReload: () => Promise<void> }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [checks, setChecks] = useState<ChatGptDiscoveryCheck[]>([]);
  const ready = checks.length > 0 && checks.every(check => check.ok);
  const scopes = "letters.read\nletters.write\nreports.read";
  async function prepare(save: boolean) {
    setBusy(true); setError(""); setChecks([]);
    try {
      if (save) { await apiFetch("/api/chatgpt/setup", { method: "PUT", body: JSON.stringify({ origin, enabled: true, revision: setup.revision }) }); await onReload(); }
      setChecks(await checkChatGptDiscovery(origin));
    } catch (e) { setError(e instanceof Error ? e.message : "Unable to prepare the connection."); }
    finally { setBusy(false); }
  }
  return <div className="mt-5 space-y-4" aria-label="ChatGPT connection setup">
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold">1. Prepare OyamaCRM</h3>
      <p className="mt-2 text-sm text-slate-600">Enable the tool server for this organization and check its public OAuth routes. The domain is filled in automatically. No API key or environment-file editing is needed.</p>
      {setup.locked && <p role="alert" className="mt-2 text-sm text-amber-900">A server operator has locked setup with CHATGPT_FORCE_DISABLED. They must remove that lock before you can enable ChatGPT.</p>}
      <div className="mt-3 flex flex-wrap gap-2">{canManage && !enabled && <button type="button" disabled={busy || setup.locked} className="min-h-11 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50" onClick={() => void prepare(true)}>{busy ? "Preparing…" : "Enable ChatGPT & check"}</button>}<button type="button" disabled={busy} className="min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50" onClick={() => void prepare(false)}>{busy ? "Checking…" : "Check connection"}</button></div>
      {!canManage && !enabled && <p className="mt-2 text-sm text-slate-600">An organization administrator can enable this connection.</p>}
      {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" className="underline" onClick={() => void onReload()}>Reload setup</button></p>}
      {checks.length > 0 && <ul className="mt-3 space-y-2" aria-label="Connection checks">{checks.map(check => <li key={check.name} className={`rounded-lg border p-3 text-sm ${check.ok ? "border-green-200 bg-green-50 text-green-950" : "border-amber-200 bg-amber-50 text-amber-950"}`}><strong>{check.ok ? "Passed" : "Needs attention"} · {check.name}</strong><p className="mt-1">{check.detail}</p></li>)}</ul>}
      {ready && <p role="status" className="mt-3 text-sm font-medium text-green-800">Server checks passed. Continue in ChatGPT to connect your account.</p>}
      <p className="mt-2 text-xs text-slate-600">These checks use public routes from your browser. A completed ChatGPT sign-in confirms ChatGPT can reach the server too.</p>
    </div>
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold">2. Add the URL in ChatGPT</h3>
      <ol className="mt-2 list-decimal space-y-2 pl-5 text-sm text-slate-700"><li>Open <a href="https://chatgpt.com/plugins" target="_blank" rel="noreferrer" className="font-medium text-blue-700 underline">ChatGPT Plugins</a>. Use the <strong>+ / Add menu at the top right</strong>, then <strong>Add custom MCP server</strong>.</li><li>Name it <strong>OyamaCRM</strong>, paste the MCP URL above and choose <strong>OAuth</strong>. Retry discovery if the form was opened before you enabled the server.</li><li>Under OAuth advanced settings, choose <strong>Client Identifier Metadata Document (CIMD)</strong> and token authentication <strong>none</strong>. The server verifies ChatGPT’s client and exact callback automatically. Leave the client secret blank.</li><li>If Default scopes is shown, copy the scopes below, one per line. Leave Base scopes empty. PKCE uses <strong>S256</strong>; OIDC stays off.</li></ol>
      <div className="mt-3"><CopyField label="Default scopes" value={scopes}/></div>
    </div>
    <div className="rounded-lg border border-slate-200 p-4">
      <h3 className="font-semibold">3. Approve your account</h3><p className="mt-2 text-sm text-slate-600">Create the connector, sign in to this OyamaCRM installation and choose <strong>Allow connection</strong>. Then start a ChatGPT conversation and select OyamaCRM with <strong>@</strong>. This last approval is yours; the CRM never signs into ChatGPT for you.</p>
      {setup.verifiedCallback && <p className="mt-3 break-all text-sm text-slate-700"><strong>Last authorized callback:</strong> {setup.verifiedCallback}</p>}
      <p className="mt-2 text-sm text-slate-600">Try “Find our appeal letters” or “Run campaign performance for this year.” New drafts require draft access in the MCP controls below.</p>
    </div>
    <details className="rounded-lg border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">Manual OAuth fields and troubleshooting</summary><p className="mt-3 text-sm text-slate-600">Use these only if ChatGPT cannot populate its advanced form. CIMD is supported; DCR and OIDC are not enabled. Do not add a client secret, Registration URL or OIDC URLs.</p><div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2">
      <CopyField label="Auth URL" value={`${origin}/api/chatgpt/oauth/authorize`}/><CopyField label="Token URL" value={`${origin}/api/chatgpt/oauth/token`}/><CopyField label="Authorization server base" value={origin}/><CopyField label="Resource" value={`${origin}/api/chatgpt/mcp`}/><CopyField label="OAuth discovery URL" value={`${origin}/.well-known/oauth-authorization-server`}/><CopyField label="Client metadata URL" value="https://chatgpt.com/oauth/client.json"/><CopyField label="Token endpoint auth method" value="none"/><CopyField label="PKCE" value="S256"/>
    </div><dl className="mt-3 grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm"><dt>Client registration</dt><dd>CIMD (automatic)</dd><dt>Callback URL</dt><dd className="[overflow-wrap:anywhere]">{setup.verifiedCallback || "Verified automatically when ChatGPT connects"}</dd><dt>Client secret</dt><dd>Leave blank</dd><dt>Registration URL / DCR</dt><dd>Leave blank · Not enabled</dd><dt>Base scopes</dt><dd>Leave blank</dd><dt>OIDC enabled</dt><dd>Off</dd><dt>OIDC configuration URL</dt><dd>Leave blank</dd><dt>OIDC userinfo endpoint</dt><dd>Leave blank</dd><dt>OIDC scopes supported</dt><dd>None</dd></dl><p className="mt-3 text-sm text-slate-600">For the older User-Defined OAuth Client method, client ID is <code className="break-all">{clientId}</code>. It still needs an explicitly configured callback allowlist. CIMD captures the verified callback automatically and is the recommended setup.</p><p className="mt-2 text-sm text-slate-600">If discovery fails, run Check connection above. A missing public route needs a proxy/deployment fix; entering fields manually cannot make an unreachable tool server work.</p></details>
  </div>;
}
