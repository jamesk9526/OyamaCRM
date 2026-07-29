"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type Role = "host" | "checkin" | "scorekeeper" | "table_manager";
interface Pass { id: string; label: string; role: Role; expiresAt: string; revokedAt: string | null; activeSessions: number; code?: string; }

function roleName(role: Role): string {
  if (role === "table_manager") return "Tables & guest manager";
  if (role === "checkin") return "Check-in desk";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Producer-only pass manager with four-digit codes, complete URLs, QR sharing, and revocation. */
export default function TemporaryEventAccessPanel({ eventId }: { eventId: string }) {
  const [passes, setPasses] = useState<Pass[]>([]);
  const [role, setRole] = useState<Role>("host");
  const [label, setLabel] = useState("");
  const [latestCode, setLatestCode] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);
  const easyUrl = origin ? `${origin}/apps/trivia/remote` : "/apps/trivia/remote";
  const directUrl = latestCode ? `${easyUrl}?code=${latestCode}` : "";
  const qrUrl = useMemo(() => latestCode && easyUrl ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=12&data=${encodeURIComponent(easyUrl)}` : "", [easyUrl, latestCode]);

  const load = useCallback(async () => {
    try {
      const result = await apiFetch<{ passes: Pass[] }>(`/api/apps/trivia/events/${eventId}/access-passes`);
      setPasses(result.passes ?? []);
    } catch {
      setMessage("Could not load temporary sign-ins. Confirm server sync is available.");
    }
  }, [eventId]);
  useEffect(() => { void load(); }, [load]);

  async function create() {
    try {
      const result = await apiFetch<{ pass: Pass }>(`/api/apps/trivia/events/${eventId}/access-passes`, {
        method: "POST",
        body: JSON.stringify({ role, label, durationHours: 12 }),
      });
      setLatestCode(result.pass.code ?? null);
      setLabel("");
      setMessage("Remote created. Share the link, QR code, or four-digit code before leaving this panel.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not create the temporary sign-in.");
    }
  }

  async function revoke(id: string) {
    try {
      await apiFetch(`/api/apps/trivia/events/${eventId}/access-passes/${id}`, { method: "DELETE" });
      setMessage("Temporary sign-in revoked on every connected device.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not revoke the temporary sign-in.");
    }
  }

  async function copy(value: string, success: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(success);
    } catch {
      setMessage("Copy was blocked by this browser. Select the URL and copy it manually.");
    }
  }

  return (
    <section className="space-y-4 border border-slate-700 bg-slate-900/70 p-4">
      <div>
        <p className="text-[11px] uppercase tracking-[0.14em] text-cyan-200">Event staff access</p>
        <h2 className="mt-1 text-lg font-semibold text-white">Temporary sign-ins and remote controllers</h2>
        <p className="mt-1 text-sm text-slate-300">Each remote receives a unique four-digit code, a complete share link, and a QR code. Access expires after 12 hours and never grants CRM permissions.</p>
      </div>

      <div className="grid gap-2 lg:grid-cols-[220px_1fr_auto]">
        <select value={role} onChange={(event) => setRole(event.target.value as Role)} className="border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white">
          <option value="host">Host remote</option>
          <option value="scorekeeper">Scorekeeper remote</option>
          <option value="checkin">Quick check-in remote</option>
          <option value="table_manager">Tables & guest manager</option>
        </select>
        <input value={label} onChange={(event) => setLabel(event.target.value)} placeholder="Volunteer name or device" className="border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white" />
        <button type="button" onClick={() => void create()} className="bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500">Create remote</button>
      </div>

      <div className="border border-slate-700 bg-slate-950/70 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-300">Easy code-entry address</p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input readOnly value={easyUrl} className="min-w-0 flex-1 border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-cyan-100" />
          <button type="button" onClick={() => void copy(easyUrl, "Easy remote address copied.")} className="border border-slate-600 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">Copy address</button>
        </div>
        <p className="mt-2 text-xs text-slate-400">Volunteers can type this address on any phone and enter their four-digit code.</p>
      </div>

      {latestCode ? (
        <div className="grid gap-4 border border-amber-400/50 bg-amber-500/10 p-4 md:grid-cols-[1fr_220px]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-100">New {roleName(role)} remote</p>
            <p className="mt-3 font-mono text-5xl font-bold tracking-[0.28em] text-white">{latestCode}</p>
            <p className="mt-3 text-xs text-amber-100">The direct link includes the code and connects automatically. The code is hidden after this panel is closed.</p>
            <label className="mt-4 block text-xs font-semibold text-slate-200">Complete remote URL<input readOnly value={directUrl} className="mt-1 w-full border border-amber-400/30 bg-slate-950 px-3 py-2 text-xs text-white" /></label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy(directUrl, "Complete remote link copied.")} className="bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300">Copy full link</button>
              <button type="button" onClick={() => void copy(latestCode, "Four-digit code copied.")} className="border border-amber-300/60 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-500/20">Copy code</button>
              <a href={directUrl} target="_blank" rel="noopener noreferrer" className="border border-cyan-400/60 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10">Test remote ↗</a>
            </div>
          </div>
          <div className="bg-white p-2 text-center">
            {/* The QR contains only the public entry address; the temporary code is never sent to the QR image service. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={`QR code for ${roleName(role)} remote`} width={204} height={204} className="mx-auto h-[204px] w-[204px]" />
            <p className="mt-1 text-xs font-semibold text-slate-800">Scan, then enter {latestCode}</p>
          </div>
        </div>
      ) : null}

      {message ? <p className="text-xs text-cyan-100" aria-live="polite">{message}</p> : null}
      <div className="space-y-2">
        {passes.map((pass) => (
          <div key={pass.id} className="flex flex-wrap items-center justify-between gap-2 border border-slate-700 bg-slate-950 px-3 py-2 text-sm">
            <div><p className="font-semibold text-white">{pass.label}</p><p className="text-xs text-slate-400">{roleName(pass.role)} · expires {new Date(pass.expiresAt).toLocaleString()} · {pass.activeSessions} connected device(s)</p></div>
            {pass.revokedAt ? <span className="text-xs text-slate-500">Revoked</span> : <button type="button" onClick={() => void revoke(pass.id)} className="border border-rose-500/60 px-2.5 py-1 text-xs font-semibold text-rose-100 hover:bg-rose-500/20">Revoke</button>}
          </div>
        ))}
      </div>
    </section>
  );
}
