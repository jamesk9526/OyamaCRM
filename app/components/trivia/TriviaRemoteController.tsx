"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE } from "@/app/lib/auth-client";
import type { TriviaEvent, TriviaLiveState } from "@/app/apps/trivia/lib/trivia-types";

import TriviaPhoneHost from "./TriviaPhoneHost";
import { TableManagerRemote, TriviaCheckInRemote } from "./TriviaTableRemote";

type RemoteRole = "host" | "checkin" | "scorekeeper" | "table_manager";
interface RemoteSession { role: RemoteRole; label: string; expiresAt: string; revision?: string; event: TriviaEvent & { live: TriviaLiveState }; }

const TOKEN_KEY_PREFIX = "oyama.trivia.remote-access.v2";

function roleLabel(role: RemoteRole): string {
  if (role === "table_manager") return "Tables & guests";
  if (role === "checkin") return "Check-in";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

/** Phone-sized, event-scoped controller. Four-digit codes never grant CRM access. */
export default function TriviaRemoteController({ eventId: initialEventId }: { eventId?: string }) {
  const searchParams = useSearchParams();
  const linkCode = (searchParams.get("code") ?? "").replace(/\D/g, "").slice(0, 4);
  const [eventId, setEventId] = useState(initialEventId ?? "");
  const [code, setCode] = useState(linkCode);
  const [token, setToken] = useState("");
  const [session, setSession] = useState<RemoteSession | null>(null);
  const [message, setMessage] = useState(linkCode ? "Connecting from your secure event link…" : "Enter the four-digit code supplied by the producer.");
  const [busy, setBusy] = useState(false);
  const [online, setOnline] = useState(true);
  const [lastRefreshAt, setLastRefreshAt] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const autoClaimed = useRef(false);
  const requestEpoch = useRef(0);
  const actionInFlight = useRef(false);
  const sessionReadInFlight = useRef(false);

  const loadSession = useCallback(async (accessToken: string, targetEventId = eventId) => {
    if (!targetEventId || actionInFlight.current || sessionReadInFlight.current) return;
    sessionReadInFlight.current = true;
    try {
      const epoch = ++requestEpoch.current;
      const response = await fetch(`${API_BASE}/api/apps/trivia/public/events/${encodeURIComponent(targetEventId)}/session`, { headers: { "x-trivia-access": accessToken } });
      const body = await response.json().catch(() => ({}));
      if (epoch !== requestEpoch.current) return;
      if (response.status === 401 || response.status === 403) {
        window.localStorage.removeItem(`${TOKEN_KEY_PREFIX}:${targetEventId}`);
        setSession(null); setToken(""); setOnline(window.navigator.onLine);
        throw new Error("Access expired or was revoked. Enter a new event code.");
      }
      if (!response.ok) throw new Error(body?.error?.message ?? "This temporary sign-in is no longer valid.");
      setSession(body as RemoteSession);
      setOnline(true);
      setLastRefreshAt(new Date().toISOString());
      setMessage("Connected. Controls update the shared event state.");
    } finally { sessionReadInFlight.current = false; }
  }, [eventId]);

  useEffect(() => {
    if (!initialEventId) return;
    const saved = window.localStorage.getItem(`${TOKEN_KEY_PREFIX}:${initialEventId}`);
    if (!saved) return;
    setEventId(initialEventId);
    setToken(saved);
    void loadSession(saved, initialEventId).catch((error) => {
      window.localStorage.removeItem(`${TOKEN_KEY_PREFIX}:${initialEventId}`);
      setToken("");
      setMessage(error instanceof Error ? error.message : "Temporary sign-in expired.");
    });
  }, [initialEventId, loadSession]);

  useEffect(() => {
    if (!token || !eventId) return;
    const interval = window.setInterval(() => void loadSession(token, eventId).catch((error) => {
      if (!window.localStorage.getItem(`${TOKEN_KEY_PREFIX}:${eventId}`)) {
        setOnline(window.navigator.onLine);
        setMessage(error instanceof Error ? error.message : "Enter a new event code.");
        return;
      }
      setOnline(false);
      setMessage("Connection interrupted. Controls are paused until the shared event reconnects.");
    }), 3000);
    return () => window.clearInterval(interval);
  }, [eventId, loadSession, token]);

  useEffect(() => {
    const handleOnline = () => {
      if (token && eventId) void loadSession(token, eventId).catch(() => setOnline(false));
      else setOnline(true);
    };
    const handleOffline = () => {
      setOnline(false);
      setMessage("This phone is offline. No control will be sent until it reconnects.");
    };
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    setOnline(window.navigator.onLine);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [eventId, loadSession, token]);

  useEffect(() => {
    if (!pendingAction) return;
    const timeoutId = window.setTimeout(() => setPendingAction(null), 5_000);
    return () => window.clearTimeout(timeoutId);
  }, [pendingAction]);

  const claimAccess = useCallback(async (enteredCode: string) => {
    const normalizedCode = enteredCode.replace(/\D/g, "").slice(0, 4);
    if (normalizedCode.length !== 4) { setMessage("Enter all four digits."); return; }
    setBusy(true);
    try {
      const endpoint = initialEventId
        ? `${API_BASE}/api/apps/trivia/public/events/${encodeURIComponent(initialEventId)}/claim`
        : `${API_BASE}/api/apps/trivia/public/claim`;
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: normalizedCode }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message ?? "Unable to start temporary sign-in.");
      const resolvedEventId = String(body.eventId ?? initialEventId ?? "");
      if (!resolvedEventId) throw new Error("The event for this code could not be found.");
      window.localStorage.setItem(`${TOKEN_KEY_PREFIX}:${resolvedEventId}`, body.accessToken);
      setEventId(resolvedEventId);
      setToken(body.accessToken);
      await loadSession(body.accessToken, resolvedEventId);
      setCode("");
      if (window.location.search) window.history.replaceState({}, "", `/apps/trivia/remote/${encodeURIComponent(resolvedEventId)}`);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to start temporary sign-in."); }
    finally { setBusy(false); }
  }, [initialEventId, loadSession]);

  useEffect(() => {
    if (!linkCode || autoClaimed.current || session || token) return;
    autoClaimed.current = true;
    void claimAccess(linkCode);
  }, [claimAccess, linkCode, session, token]);

  async function submitCode(event: FormEvent) {
    event.preventDefault();
    await claimAccess(code);
  }

  useEffect(() => { setPendingAction(null); }, [session?.event.live.activeRoundId, session?.event.live.activeQuestionIndex, session?.event.live.stage, session?.revision]);

  function disconnect() {
    ++requestEpoch.current;
    window.localStorage.removeItem(`${TOKEN_KEY_PREFIX}:${eventId}`);
    setSession(null); setToken(""); setPendingAction(null);
    setMessage("Enter an event code to reconnect.");
  }

  async function action(actionName: string, payload: Record<string, unknown> = {}) {
    if (!token || !eventId || !online || actionInFlight.current) return false;
    actionInFlight.current = true;
    ++requestEpoch.current;
    setPendingAction(null);
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/apps/trivia/public/events/${encodeURIComponent(eventId)}/actions`, { method: "POST", headers: { "Content-Type": "application/json", "x-trivia-access": token }, body: JSON.stringify({ action: actionName, payload, expectedRevision: session?.revision }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        actionInFlight.current = false;
        if (response.status === 409) await loadSession(token, eventId);
        if (response.status === 401 || response.status === 403) disconnect();
        throw new Error(body?.error?.message ?? "Action was not accepted. Refresh and try again.");
      }
      setSession((current) => current ? { ...current, event: body.event, revision: body.revision ?? current.revision } : current);
      setLastRefreshAt(new Date().toISOString());
      setMessage("Saved to the shared event.");
      return true;
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action was not accepted."); return false; }
    finally { actionInFlight.current = false; setBusy(false); }
  }

  function guardedAction(actionName: string, payload: Record<string, unknown> = {}) {
    const key = `${actionName}:${JSON.stringify(payload)}`;
    if (pendingAction !== key) {
      setPendingAction(key);
      setMessage("Tap the highlighted control again within five seconds to confirm.");
      return;
    }
    setPendingAction(null);
    void action(actionName, payload);
  }

  if (!session) return (
    <main className="min-h-[100dvh] bg-[#0d0a16] p-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-white sm:flex sm:items-center sm:justify-center sm:p-5">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[#4b3975] bg-[#161126] shadow-[0_18px_48px_rgba(0,0,0,0.35)] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="bg-[#211833] p-5 text-white sm:p-7"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-lg font-bold text-[#07111f]">T</span><p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Oyama Trivia</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Event-night remote</h1><p className="mt-3 text-sm leading-6 text-[#e9e2ff]">Scan your event QR or open the shared link for instant access—no CRM login required. Use the four-digit backup code below if needed.</p><div className="mt-5 border-l-2 border-cyan-400 pl-3 text-xs text-[#d9cffa]">Event-scoped · expires automatically · revocable by the producer</div></aside>
        <section className="p-5 sm:p-7"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">Temporary sign-in</p><h2 className="mt-2 text-2xl font-semibold text-white">Enter your event code</h2><p className="mt-2 min-h-10 text-sm text-[#d9cffa]" aria-live="polite">{message}</p><form onSubmit={submitCode} className="mt-5 space-y-4"><label className="block text-sm font-semibold text-[#e9e2ff]">Four-digit code<input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoComplete="one-time-code" autoFocus className="mt-2 h-16 w-full rounded-xl border border-[#8067b7] bg-[#0d0a16] px-3 text-center font-mono text-3xl font-bold tracking-[0.35em] text-white outline-none placeholder:text-[#665a87] focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/30" placeholder="0000" /></label><button disabled={busy || code.length !== 4 || !online} className="min-h-14 w-full touch-manipulation rounded-xl bg-[#7654c5] font-semibold text-white hover:bg-[#8b6bd3] disabled:opacity-50">{busy ? "Connecting…" : online ? "Connect to event" : "Waiting for connection"}</button></form><p className="mt-5 break-all text-xs text-[#b9adda]">Easy address: {typeof window !== "undefined" ? `${window.location.host}/apps/trivia/remote` : "/apps/trivia/remote"}</p></section>
      </div>
    </main>
  );

  const { event } = session;
  const live = event.live;
  const mutedAction = "min-h-14 touch-manipulation rounded-xl border border-[#8067b7] bg-[#211833] px-3 text-sm font-semibold text-white hover:bg-[#302247] disabled:opacity-50";
  const primaryAction = "min-h-14 touch-manipulation rounded-xl bg-[#7654c5] px-3 text-sm font-semibold text-white hover:bg-[#8b6bd3] disabled:opacity-50";
  return (
    <main className="min-h-[100dvh] bg-[#0d0a16] p-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] text-white sm:p-5">
      <div className={`mx-auto space-y-3 ${session.role === "table_manager" ? "max-w-3xl" : "max-w-xl"}`}>
        <header className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-30 rounded-xl border border-[#4b3975] bg-[#161126]/95 p-4 shadow-xl backdrop-blur">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-200">{roleLabel(session.role)} remote</p><h1 className="mt-1 truncate text-xl font-semibold">{event.name}</h1></div>
            <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${online ? "border-emerald-400/35 bg-emerald-500/10 text-emerald-100" : "border-rose-400/40 bg-rose-500/15 text-rose-100"}`}>{online ? "● Connected" : "● Offline"}</span>
          </div>
          <button type="button" onClick={disconnect} disabled={busy} className="mt-2 min-h-11 rounded-lg border border-[#8067b7] px-3 text-xs font-semibold">Disconnect / change code</button>
          <p className="mt-2 text-xs text-[#d9cffa]">{live.lastHostAction} · expires {new Date(session.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{lastRefreshAt ? ` · updated ${new Date(lastRefreshAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : ""}</p>
        </header>
        <p className={`rounded-lg border px-3 py-2 text-sm ${online ? "border-[#4b3975] text-[#d9cffa]" : "border-rose-400/40 bg-rose-500/10 text-rose-100"}`} aria-live="polite">{message}</p>
        {session.role === "host" ? (
          <TriviaPhoneHost event={event} disabled={busy || !online} pendingAction={pendingAction} action={action} guardedAction={guardedAction} />
        ) : session.role === "scorekeeper" ? (
          <section className="rounded-xl border border-[#4b3975] bg-[#161126] p-3 sm:p-4">
            <p className="text-sm font-semibold">Score teams</p><p className="mt-1 text-xs text-[#d9cffa]">Adjustments save immediately and are included in the event audit trail.</p>
            <div className="mt-3 space-y-2">{[...event.teams].sort((a, b) => b.score - a.score).map((team) => <div key={team.id} className="grid gap-3 rounded-xl border border-[#4b3975] bg-[#211833] p-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold">{team.name}</p><p className="text-sm text-[#d9cffa]">{team.score} points</p></div><div className="grid grid-cols-3 gap-2"><button disabled={busy || !online} onClick={() => void action("score_adjust", { teamId: team.id, delta: -1 })} className={mutedAction}>−1</button><button disabled={busy || !online} onClick={() => void action("score_adjust", { teamId: team.id, delta: 1 })} className={primaryAction}>+1</button><button disabled={busy || !online} onClick={() => void action("score_adjust", { teamId: team.id, delta: 5 })} className={mutedAction}>+5</button></div></div>)}</div>
          </section>
        ) : session.role === "checkin" ? (
          <TriviaCheckInRemote teams={event.teams} busy={busy || !online} onAction={action} />
        ) : <TableManagerRemote teams={event.teams} busy={busy || !online} onAction={action} />}
      </div>
    </main>
  );
}
