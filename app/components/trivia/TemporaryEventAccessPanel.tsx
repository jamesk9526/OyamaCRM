"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type Role = "host" | "checkin" | "scorekeeper";
interface Pass { id: string; label: string; role: Role; expiresAt: string; revokedAt: string | null; activeSessions: number; code?: string; }

/** Producer-only pass manager. Codes are one-time visible and revocable. */
export default function TemporaryEventAccessPanel({ eventId }: { eventId: string }) {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [role, setRole] = useState<Role>("host");
  const [label, setLabel] = useState("");
  const [latestCode, setLatestCode] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  const load = useCallback(async () => {
    try { const result = await apiFetch<{ passes: Pass[] }>(`/api/apps/trivia/events/${eventId}/access-passes`); setPasses(result.passes ?? []); }
    catch { setMessage("Could not load temporary sign-ins. Confirm server sync is available."); }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    try {
      const result = await apiFetch<{ pass: Pass }>(`/api/apps/trivia/events/${eventId}/access-passes`, { method: "POST", body: JSON.stringify({ role, label, durationHours: 12 }) });
      setLatestCode(result.pass.code ?? null); setLabel(""); setMessage("Temporary sign-in created. Share the code once, then keep it private."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not create the temporary sign-in."); }
  }
  async function revoke(id: string) {
    try { await apiFetch(`/api/apps/trivia/events/${eventId}/access-passes/${id}`, { method: "DELETE" }); setMessage("Temporary sign-in revoked."); await load(); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Could not revoke the temporary sign-in."); }
  }

  return <section className="space-y-3 border border-slate-700 bg-slate-900/70 p-4"><div><p className="text-[11px] uppercase tracking-[0.14em] text-cyan-200">Event staff access</p><h2 className="mt-1 text-lg font-semibold text-white">Temporary sign-ins and remote controllers</h2><p className="mt-1 text-sm text-slate-300">Create a 12-hour, revocable code for a host, scorekeeper, or check-in volunteer. It grants only that event role, never CRM access.</p></div><div className="grid gap-2 sm:grid-cols-[150px_1fr_auto]"><select value={role} onChange={(event) => setRole(event.target.value as Role)} className="border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"><option value="host">Host remote</option><option value="scorekeeper">Scorekeeper</option><option value="checkin">Check-in desk</option></select><input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Volunteer name or device" className="border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" /><button type="button" onClick={() => void create()} className="bg-cyan-600 px-3 py-2 text-sm font-semibold text-white hover:bg-cyan-500">Create code</button></div>{latestCode ? <div className="border border-amber-400/50 bg-amber-500/15 px-3 py-2"><p className="text-xs text-amber-100">Share this one-time code securely. It is not shown again after you leave this panel.</p><p className="mt-1 font-mono text-2xl font-bold tracking-[0.2em] text-white">{latestCode}</p><p className="mt-1 text-xs text-amber-100">Remote link: /apps/trivia/remote/{eventId}</p></div> : null}{message ? <p className="text-xs text-cyan-100">{message}</p> : null}<div className="space-y-2">{passes.map((pass) => <div key={pass.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-700 bg-slate-950 px-3 py-2 text-sm"><div><p className="font-semibold text-white">{pass.label}</p><p className="text-xs text-slate-400">{pass.role} · expires {new Date(pass.expiresAt).toLocaleString()} · {pass.activeSessions} connected device(s)</p></div>{pass.revokedAt ? <span className="text-xs text-slate-500">Revoked</span> : <button type="button" onClick={() => void revoke(pass.id)} className="border border-rose-500/60 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/20">Revoke</button>}</div>)}</div></section>;
}
