"use client";
import { useEffect, useState } from "react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";
import Link from "next/link";

export default function ConnectChatGptPage() {
  const { user, loading } = useAuth();
  const [params, setParams] = useState<Record<string, string> | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [preview, setPreview] = useState<{ proof?: string; capabilities: { key: string; title: string; mode: string; read?: boolean }[] } | null>(null);
  useEffect(() => { setParams(Object.fromEntries(new URLSearchParams(window.location.search))); }, []);
  const scopes = (params?.scope || "").split(" ").filter(Boolean);
  const valid = params?.response_type === "code" && scopes.length > 0 && scopes.length < 500 && scopes.every(s => /^[A-Za-z0-9_.-]{1,200}$/.test(s));
  const requestedScopes = scopes.join(" ");
  useEffect(() => {
    if (!user || !valid) return;
    let active = true;
    void apiFetch<NonNullable<typeof preview>>(`/api/chatgpt/access/consent?${new URLSearchParams({ scopes: requestedScopes })}`).then(value => { if (active) setPreview(value); }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : "Unable to inspect requested access."); });
    return () => { active = false; };
  }, [user, valid, requestedScopes]);
  async function decide(approved: boolean) {
    setBusy(true); setError("");
    try { const result = await apiFetch<{ redirectUrl: string }>("/api/chatgpt/oauth/consent", { method: "POST", body: JSON.stringify({ ...params, approved, consentProof: preview?.proof }) }); window.location.assign(result.redirectUrl); }
    catch (e) { setError(e instanceof Error ? e.message : "Unable to authorize the connection."); setBusy(false); }
  }
  return <main className="flex min-h-dvh items-center justify-center bg-slate-50 px-4 py-10 text-slate-900"><section aria-labelledby="connect-title" className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
    <p className="text-sm font-semibold text-blue-700">OyamaCRM + ChatGPT</p><h1 id="connect-title" className="mt-2 text-2xl font-semibold">Connect your CRM account</h1>
    {loading || !params ? <p className="mt-5" role="status">Checking your account…</p> : !valid ? <p className="mt-5" role="alert">This connection request is incomplete. Return to ChatGPT and start the connection again.</p> : !user ? <><p className="mt-4 text-slate-600">Sign in to OyamaCRM with your existing account. Your password stays with OyamaCRM, including any required verification.</p><Link className="mt-6 inline-flex min-h-11 items-center rounded-lg bg-blue-700 px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" href="/login" onClick={() => sessionStorage.setItem("oyama-chatgpt-return", window.location.pathname + window.location.search)}>Sign in to OyamaCRM</Link></> : <>
      <p className="mt-4 break-all text-sm text-slate-600">Connecting as <strong>{user.email}</strong> in your current organization.</p>
      <p className="mt-4 font-medium">Allow ChatGPT to:</p>{preview ? <ul className="mt-2 max-h-80 list-disc space-y-2 overflow-y-auto pl-5 text-sm">{preview.capabilities.map(capability => <li key={capability.key}>{capability.title}<span className="ml-1 text-slate-600">· {capability.mode === "approval" ? "CRM approval required" : capability.read ? "Read" : "Automatic"}</span></li>)}</ul> : <p role="status" className="mt-3 text-sm text-slate-600">Checking requested permissions…</p>}
      <p className="mt-4 text-sm text-slate-600">Content you request will be shared with ChatGPT. Your CRM permissions still apply. You can revoke access in Settings → Integrations. Letter drafts require review in Create before release.</p>
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3"><button disabled={busy || !preview} onClick={() => void decide(true)} className="min-h-11 rounded-lg bg-blue-700 px-5 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50">{busy ? "Connecting…" : "Allow connection"}</button><button disabled={busy} onClick={() => void decide(false)} className="min-h-11 rounded-lg border border-slate-300 px-5 font-medium focus-visible:outline-2 focus-visible:outline-blue-700 disabled:opacity-50">Cancel</button></div>
    </>}
  </section></main>;
}
