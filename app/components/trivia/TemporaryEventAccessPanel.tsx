"use client";

import { useCallback, useEffect, useState } from "react";
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
  const directUrl = latestCode ? `${easyUrl}/${encodeURIComponent(eventId)}?code=${latestCode}` : "";
  const [qrUrl, setQrUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    setQrUrl("");
    if (directUrl && origin) {
      void import("qrcode").then(({ toDataURL }) => toDataURL(directUrl, { width: 240, margin: 3 }))
        .then((url) => { if (!cancelled) setQrUrl(url); })
        .catch(() => { if (!cancelled) setMessage("QR could not be generated. Use Copy full link instead."); });
    }
    return () => { cancelled = true; };
  }, [directUrl, origin]);

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
        <p className="mt-1 text-sm text-slate-300">Scan the event QR or tap the complete share link to connect automatically. No CRM login or code typing is required. Each remote also has a four-digit backup code. Access expires after 12 hours and never grants CRM permissions.</p>
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
            <p className="mt-3 text-xs text-amber-100">Share this link or QR for instant phone access—no login and no typing. Access expires automatically and can be revoked.</p>
            <label className="mt-4 block text-xs font-semibold text-slate-200">Complete remote URL<input readOnly value={directUrl} className="mt-1 w-full border border-amber-400/30 bg-slate-950 px-3 py-2 text-xs text-white" /></label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void copy(directUrl, "Complete remote link copied.")} className="bg-amber-400 px-3 py-2 text-xs font-semibold text-slate-950 hover:bg-amber-300">Copy full link</button>
              <button type="button" onClick={() => void copy(latestCode, "Four-digit code copied.")} className="border border-amber-300/60 px-3 py-2 text-xs font-semibold text-amber-50 hover:bg-amber-500/20">Copy code</button>
              <a href={directUrl} target="_blank" rel="noopener noreferrer" className="border border-cyan-400/60 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/10">Test remote ↗</a>
            </div>
          </div>
          <div className="bg-white p-2 text-center">
            {/* Generate the complete event link locally so access is never sent to a QR service. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qrUrl ? <img src={qrUrl} alt={`QR code for ${roleName(role)} remote`} width={204} height={204} className="mx-auto h-[204px] w-[204px]" /> : <p className="flex h-[204px] items-center justify-center text-sm text-slate-800">Preparing QR… use the full link if unavailable.</p>}
            <p className="mt-1 text-xs font-semibold text-slate-800">Scan to open · no login or typing</p>
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
