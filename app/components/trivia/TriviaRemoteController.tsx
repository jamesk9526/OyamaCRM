"use client";

import { useCallback, useEffect, useState } from "react";
import { API_BASE } from "@/app/lib/auth-client";
import type { TriviaDisplayStage, TriviaEvent, TriviaLiveState } from "@/app/apps/trivia/lib/trivia-types";

type RemoteRole = "host" | "checkin" | "scorekeeper";
interface RemoteSession { role: RemoteRole; label: string; expiresAt: string; event: TriviaEvent & { live: TriviaLiveState }; }

const TOKEN_KEY_PREFIX = "oyama.trivia.remote-access.v1";
const STAGES: Array<{ stage: TriviaDisplayStage; label: string }> = [
  { stage: "welcome", label: "Welcome" }, { stage: "round_intro", label: "Round intro" }, { stage: "question", label: "Show question" },
  { stage: "answer", label: "Reveal answer" }, { stage: "leaderboard", label: "Leaderboard" }, { stage: "break", label: "Break" }, { stage: "blank", label: "Blank screen" },
];

/** Phone-sized, temporary-access controller. It never exposes CRM credentials or answer-key fields. */
export default function TriviaRemoteController({ eventId }: { eventId: string }) {
  const storageKey = `${TOKEN_KEY_PREFIX}:${eventId}`;
  const [code, setCode] = useState("");
  const [token, setToken] = useState("");
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [message, setMessage] = useState("Enter the event-night code supplied by the producer.");
  const [busy, setBusy] = useState(false);

  const loadSession = useCallback(async (accessToken: string) => {
    const response = await fetch(`${API_BASE}/api/apps/trivia/public/events/${encodeURIComponent(eventId)}/session`, { headers: { "x-trivia-access": accessToken } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message ?? "This temporary sign-in is no longer valid.");
    setSession(body as RemoteSession);
    setMessage("Connected. Controls update the shared event state.");
  }, [eventId]);

  useEffect(() => {
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return;
    setToken(saved);
    void loadSession(saved).catch((error) => { window.localStorage.removeItem(storageKey); setMessage(error instanceof Error ? error.message : "Temporary sign-in expired."); });
  }, [loadSession, storageKey]);

  useEffect(() => {
    if (!token) return;
    const interval = window.setInterval(() => void loadSession(token).catch(() => undefined), 2500);
    return () => window.clearInterval(interval);
  }, [loadSession, token]);

  async function claimAccess(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/apps/trivia/public/events/${encodeURIComponent(eventId)}/claim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message ?? "Unable to start temporary sign-in.");
      window.localStorage.setItem(storageKey, body.accessToken);
      setToken(body.accessToken);
      await loadSession(body.accessToken);
      setCode("");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start temporary sign-in."); }
    finally { setBusy(false); }
  }

  async function action(actionName: string, payload: Record<string, unknown> = {}) {
    if (!token) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/apps/trivia/public/events/${encodeURIComponent(eventId)}/actions`, { method: "POST", headers: { "Content-Type": "application/json", "x-trivia-access": token }, body: JSON.stringify({ action: actionName, payload }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message ?? "Action was not accepted.");
      setSession((current) => current ? { ...current, event: body.event } : current);
      setMessage("Action sent to the event.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action was not accepted."); }
    finally { setBusy(false); }
  }

  if (!session) return (
    <main className="min-h-screen bg-[#0d0a16] p-5 text-white sm:flex sm:items-center sm:justify-center">
      <div className="grid w-full max-w-4xl overflow-hidden border border-[#4b3975] bg-[#161126] shadow-[0_18px_48px_rgba(0,0,0,0.35)] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="bg-[#211833] p-7 text-white"><span className="flex h-10 w-10 items-center justify-center bg-[#a78bfa] text-lg font-bold text-[#161126]">T</span><p className="mt-6 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#d9cffa]">Oyama Trivia</p><h1 className="mt-2 text-3xl font-semibold">Event-night access</h1><p className="mt-3 text-sm leading-6 text-[#e9e2ff]">Use the temporary code supplied by your producer. You get only the controls needed for your role—never CRM access or private answer material.</p><div className="mt-8 border-l-2 border-[#a78bfa] pl-3 text-xs text-[#d9cffa]">Secure, event-scoped · expires automatically · revocable by the producer</div></aside>
        <section className="p-7"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">Temporary sign-in</p><h2 className="mt-2 text-2xl font-semibold text-white">Connect to this event</h2><p className="mt-2 text-sm text-[#d9cffa]">{message}</p><form onSubmit={claimAccess} className="mt-6 space-y-4"><label className="block text-sm font-semibold text-[#e9e2ff]">Access code<input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} autoCapitalize="characters" className="mt-2 h-12 w-full border border-[#8067b7] bg-[#0d0a16] px-3 font-mono text-lg tracking-[0.18em] text-white outline-none placeholder:text-[#9485b9] focus:border-[#c4b5fd] focus:ring-2 focus:ring-[#4b3975]" placeholder="A1B2C3D4" /></label><button disabled={busy || !code.trim()} className="h-12 w-full bg-[#7654c5] font-semibold text-white hover:bg-[#8b6bd3] disabled:opacity-50">{busy ? "Connecting…" : "Connect to event"}</button></form><p className="mt-5 text-xs text-[#b9adda]">Need a code? Ask the event producer or host—do not use a personal login.</p></section>
      </div>
    </main>
  );

  const { event } = session;
  const live = event.live;
  const mutedAction = "min-h-12 border border-[#8067b7] bg-[#211833] px-3 text-sm font-semibold text-white hover:bg-[#302247] disabled:opacity-50";
  const primaryAction = "min-h-12 bg-[#7654c5] px-3 text-sm font-semibold text-white hover:bg-[#8b6bd3] disabled:opacity-50";

  return (
    <main className="min-h-screen bg-[#0d0a16] p-3 text-white sm:p-5">
      <div className="mx-auto max-w-xl space-y-3">
        <header className="border border-[#4b3975] bg-[#161126] p-4"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#c4b5fd]">{session.role} controller</p><h1 className="mt-1 text-xl font-semibold">{event.name}</h1><p className="mt-1 text-sm text-[#d9cffa]">{live.lastHostAction} · expires {new Date(session.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></header>
        <p className="px-1 text-sm text-[#d9cffa]" aria-live="polite">{message}</p>
        {session.role === "host" ? <><section className="border border-[#4b3975] bg-[#161126] p-4"><p className="text-sm font-semibold">Now showing</p><p className="mt-1 text-lg capitalize">{String(live.stage).replaceAll("_", " ")}</p><div className="mt-3 grid grid-cols-2 gap-2">{STAGES.map((item) => <button key={item.stage} disabled={busy} onClick={() => void action("set_stage", { stage: item.stage })} className={live.stage === item.stage ? primaryAction : mutedAction}>{item.label}</button>)}</div></section><section className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => void action("previous_question")} className={mutedAction}>Previous</button><button disabled={busy} onClick={() => void action("next_question")} className={primaryAction}>Next question</button><button disabled={busy} onClick={() => void action(live.timerRunning ? "timer_pause" : "timer_start")} className={mutedAction}>{live.timerRunning ? "Pause timer" : "Start timer"}</button><button disabled={busy} onClick={() => void action("timer_reset")} className={mutedAction}>Reset {live.timerRemainingSec}s</button></section></> : <section className="border border-[#4b3975] bg-[#161126] p-4"><p className="text-sm font-semibold">Check in teams</p><div className="mt-3 space-y-2">{event.teams.filter((team) => team.checkInStatus !== "checked_in").sort((a, b) => a.sortOrder - b.sortOrder).map((team) => <div key={team.id} className="flex items-center justify-between gap-3 border border-[#4b3975] bg-[#211833] p-3"><div><p className="font-semibold">{team.name}</p><p className="text-xs text-[#d9cffa]">Table {team.tableNumber || "—"} · {team.playerCount ?? team.players.length} players</p></div><button disabled={busy} onClick={() => void action("check_in", { teamId: team.id })} className="min-h-11 bg-[#7654c5] px-3 text-sm font-semibold text-white hover:bg-[#8b6bd3] disabled:opacity-50">Check in</button></div>)}</div></section>}
      </div>
    </main>
  );
}
