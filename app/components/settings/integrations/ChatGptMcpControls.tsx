"use client";
import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import type { McpPolicy } from "@/server/src/chatgpt/policy";
export default function ChatGptMcpControls({ policy, revision, canManage, imageGenerationConfigured, onSaved, onReload }: { policy: McpPolicy; revision: number; canManage: boolean; imageGenerationConfigured?: boolean; onSaved: () => Promise<void>; onReload: () => Promise<void> }) {
  const [draft, setDraft] = useState(policy), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const switches: { key: "enabled" | "allowLetterRead" | "allowLetterDrafts" | "allowReports" | "allowDateBasisOverride"; label: string; detail: string }[] = [
    { key: "enabled", label: "Allow MCP access", detail: "Pause to block new account links, token renewal and subsequent tool requests for this organization. Requests already in progress may finish." },
    { key: "allowLetterRead", label: "Read letters", detail: "Search donor letters and Studio images, and preview merge fields with sample data." },
    { key: "allowLetterDrafts", label: "Create letter drafts", detail: "Create drafts, configure your own ChatGPT drafts, and import approved images. Connected sessions need letters.write." },
    { key: "allowReports", label: "Read aggregate reports", detail: "Allow giving and CRM performance reports with financial definitions and source dates." },
    { key: "allowDateBasisOverride", label: "Allow a different calendar per request", detail: "When off, requests for a different calendar are rejected. Explicit from/through date ranges are still honored as entered." },
  ];
  return <form className="mt-5 border-t border-slate-200 pt-5" onSubmit={async event => { event.preventDefault(); setBusy(true); setError(""); try { await apiFetch("/api/chatgpt/settings", { method: "PUT", body: JSON.stringify({ revision, policy: draft }) }); await onSaved(); } catch (e) { setError(e instanceof Error ? e.message : "Unable to save MCP controls."); } finally { setBusy(false); } }}>
    <h3 className="font-semibold">Organization MCP controls</h3>
    <p className="mt-1 text-sm text-slate-600">Applies to every ChatGPT connection for this organization on this installation. Existing user permissions remain required.</p>
    {!canManage && <p className="mt-2 text-sm text-slate-600">An organization administrator can change these controls.</p>}
    <fieldset disabled={!canManage || busy} className="mt-4 space-y-4 disabled:opacity-70">
      <legend className="sr-only">ChatGPT access and reporting policy</legend>
      {switches.slice(0, 4).map(item => <label key={item.key} className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-blue-700" checked={draft[item.key]} onChange={e => setDraft({ ...draft, [item.key]: e.target.checked })}/><span><span className="block text-sm font-medium">{item.label}</span><span className="mt-1 block text-sm text-slate-600">{item.detail}</span></span></label>)}
      <label className="flex min-h-11 items-start gap-3">
        <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-blue-700" checked={draft.allowImageGeneration === true} disabled={!imageGenerationConfigured && !draft.allowImageGeneration} onChange={e => setDraft({ ...draft, allowImageGeneration: e.target.checked })}/>
        <span><span className="block text-sm font-medium">Generate AI letter images</span><span className="mt-1 block text-sm text-slate-600">Requires letter draft access. Artwork uses the installation’s OpenAI API billing and saves to the Studio image library.</span>
          {!imageGenerationConfigured && <span className="mt-1 block text-sm text-amber-900">Image provider setup is required on the API server. You can still use existing Studio images and import ChatGPT attachments.</span>}
        </span>
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-medium">Reporting calendar<select value={draft.defaultDateBasis} onChange={e => setDraft({ ...draft, defaultDateBasis: e.target.value as McpPolicy["defaultDateBasis"] })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="calendar">Calendar year · January–December</option><option value="fiscal">Fiscal year · Organization fiscal start</option></select></label>
        <label className="text-sm font-medium">Maximum report rows<input type="number" min={10} max={500} step={1} required value={draft.maxReportRows} onChange={e => setDraft({ ...draft, maxReportRows: e.target.valueAsNumber })} className="mt-1 block min-h-11 w-full rounded-lg border border-slate-300 px-3"/><span className="mt-1 block font-normal text-slate-600">10–500 rows. Totals include every matching gift.</span></label>
      </div>
      <label className="flex min-h-11 items-start gap-3"><input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-blue-700" checked={draft.allowDateBasisOverride} onChange={e => setDraft({ ...draft, allowDateBasisOverride: e.target.checked })}/><span><span className="block text-sm font-medium">{switches[4].label}</span><span className="mt-1 block text-sm text-slate-600">{switches[4].detail}</span></span></label>
      {canManage && <button className="min-h-11 rounded-lg bg-blue-700 px-4 font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 disabled:opacity-50" type="submit">{busy ? "Saving…" : "Save MCP controls"}</button>}
    </fieldset>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error} <button type="button" className="underline" onClick={() => void onReload()}>Reload controls</button></p>}
    <p className="mt-3 text-xs text-slate-600">Always enforced: tenant and ownership checks, financial definitions, audit logs, short-lived scoped credentials and review before release. MCP cannot send communications, change gifts, run arbitrary SQL or access clinical records.</p>
  </form>;
}
