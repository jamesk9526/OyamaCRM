"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import { API_BASE } from "@/app/lib/auth-client";
import type { TriviaDisplayStage, TriviaEvent, TriviaLiveState, TriviaTeam, TriviaTeamPaymentStatus } from "@/app/apps/trivia/lib/trivia-types";

type RemoteRole = "host" | "checkin" | "scorekeeper" | "table_manager";
interface RemoteSession { role: RemoteRole; label: string; expiresAt: string; event: TriviaEvent & { live: TriviaLiveState }; }

const TOKEN_KEY_PREFIX = "oyama.trivia.remote-access.v2";
const STAGES: Array<{ stage: TriviaDisplayStage; label: string }> = [
  { stage: "welcome", label: "Welcome" }, { stage: "round_intro", label: "Round intro" }, { stage: "question", label: "Show question" },
  { stage: "answer", label: "Reveal answer" }, { stage: "leaderboard", label: "Leaderboard" }, { stage: "break", label: "Break" }, { stage: "blank", label: "Blank screen" },
];

function roleLabel(role: RemoteRole): string {
  if (role === "table_manager") return "Tables & guests";
  if (role === "checkin") return "Check-in";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function RemoteTeamEditor({ team, busy, onAction }: { team: TriviaTeam; busy: boolean; onAction: (name: string, payload?: Record<string, unknown>) => Promise<void> }) {
  const [draft, setDraft] = useState({
    name: team.name,
    tableNumber: team.tableNumber ?? "",
    tableHostName: team.tableHostName ?? team.captainName ?? "",
    contactEmail: team.contactEmail ?? "",
    contactPhone: team.contactPhone ?? "",
    players: team.players.join("\n"),
    paymentStatus: team.paymentStatus ?? "not_required",
    notes: team.notes ?? "",
  });
  useEffect(() => {
    setDraft({
      name: team.name, tableNumber: team.tableNumber ?? "", tableHostName: team.tableHostName ?? team.captainName ?? "",
      contactEmail: team.contactEmail ?? "", contactPhone: team.contactPhone ?? "", players: team.players.join("\n"),
      paymentStatus: team.paymentStatus ?? "not_required", notes: team.notes ?? "",
    });
  }, [team]);
  const inputClass = "min-h-12 w-full rounded-lg border border-[#4b3975] bg-[#0d0a16] px-3 text-base text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20";
  return (
    <article className="space-y-3 rounded-xl border border-[#4b3975] bg-[#211833] p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="font-semibold text-white">{team.name}</p><p className="text-xs text-[#c9bee8]">Table {team.tableNumber || "unassigned"} · {team.players.length || team.playerCount || 0} guests · {String(team.paymentStatus ?? "not required").replaceAll("_", " ")}</p></div>
        <button disabled={busy || team.checkInStatus === "checked_in"} onClick={() => onAction("check_in", { teamId: team.id })} className="min-h-12 w-full touch-manipulation rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto">{team.checkInStatus === "checked_in" ? "Checked in" : "Check in table"}</button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-[#d9cffa]">Team name<input className={`${inputClass} mt-1`} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
        <label className="text-xs text-[#d9cffa]">Table number<input inputMode="numeric" pattern="[0-9]*" className={`${inputClass} mt-1`} value={draft.tableNumber} onChange={(event) => setDraft((current) => ({ ...current, tableNumber: event.target.value.replace(/\D/g, "").slice(0, 4) }))} /></label>
        <label className="text-xs text-[#d9cffa]">Table host<input className={`${inputClass} mt-1`} value={draft.tableHostName} onChange={(event) => setDraft((current) => ({ ...current, tableHostName: event.target.value }))} /></label>
        <label className="text-xs text-[#d9cffa]">Payment status<select className={`${inputClass} mt-1`} value={draft.paymentStatus} onChange={(event) => setDraft((current) => ({ ...current, paymentStatus: event.target.value as TriviaTeamPaymentStatus }))}><option value="not_required">Not required</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option><option value="waived">Waived</option></select></label>
        <label className="text-xs text-[#d9cffa]">Email<input type="email" className={`${inputClass} mt-1`} value={draft.contactEmail} onChange={(event) => setDraft((current) => ({ ...current, contactEmail: event.target.value }))} /></label>
        <label className="text-xs text-[#d9cffa]">Phone<input className={`${inputClass} mt-1`} value={draft.contactPhone} onChange={(event) => setDraft((current) => ({ ...current, contactPhone: event.target.value }))} /></label>
      </div>
      <label className="block text-xs text-[#d9cffa]">Guest names, one per line<textarea className="mt-1 min-h-28 w-full rounded-lg border border-[#4b3975] bg-[#0d0a16] p-3 text-base text-white outline-none focus:border-cyan-400" value={draft.players} onChange={(event) => setDraft((current) => ({ ...current, players: event.target.value }))} /></label>
      <label className="block text-xs text-[#d9cffa]">Operations notes<textarea className="mt-1 min-h-20 w-full rounded-lg border border-[#4b3975] bg-[#0d0a16] p-3 text-base text-white outline-none focus:border-cyan-400" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
      <button disabled={busy || !draft.name.trim()} onClick={() => onAction("update_team", { teamId: team.id, ...draft, players: draft.players.split("\n").map((name) => name.trim()).filter(Boolean) })} className="min-h-14 w-full touch-manipulation rounded-lg bg-[#7654c5] text-sm font-semibold text-white hover:bg-[#8b6bd3] disabled:opacity-50">Save table and guests</button>
    </article>
  );
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

  const loadSession = useCallback(async (accessToken: string, targetEventId = eventId) => {
    if (!targetEventId) return;
    const response = await fetch(`${API_BASE}/api/apps/trivia/public/events/${encodeURIComponent(targetEventId)}/session`, { headers: { "x-trivia-access": accessToken } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body?.error?.message ?? "This temporary sign-in is no longer valid.");
    setSession(body as RemoteSession);
    setOnline(true);
    setLastRefreshAt(new Date().toISOString());
    setMessage("Connected. Controls update the shared event state.");
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
    const interval = window.setInterval(() => void loadSession(token, eventId).catch(() => {
      setOnline(false);
      setMessage("Connection interrupted. Controls are paused until the shared event reconnects.");
    }), 3000);
    return () => window.clearInterval(interval);
  }, [eventId, loadSession, token]);

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true);
      if (token && eventId) void loadSession(token, eventId).catch(() => setOnline(false));
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

  async function action(actionName: string, payload: Record<string, unknown> = {}) {
    if (!token || !eventId || !online) return;
    setBusy(true);
    try {
      const response = await fetch(`${API_BASE}/api/apps/trivia/public/events/${encodeURIComponent(eventId)}/actions`, { method: "POST", headers: { "Content-Type": "application/json", "x-trivia-access": token }, body: JSON.stringify({ action: actionName, payload }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error?.message ?? "Action was not accepted.");
      setSession((current) => current ? { ...current, event: body.event } : current);
      setLastRefreshAt(new Date().toISOString());
      setMessage("Saved to the shared event.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Action was not accepted."); }
    finally { setBusy(false); }
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

  async function emergencyHold() {
    await action("timer_pause");
    await action("set_stage", { stage: "blank" });
    setMessage("Emergency hold active. Timer paused and projector blanked.");
  }

  if (!session) return (
    <main className="min-h-[100dvh] bg-[#0d0a16] p-3 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))] text-white sm:flex sm:items-center sm:justify-center sm:p-5">
      <div className="grid w-full max-w-4xl overflow-hidden rounded-2xl border border-[#4b3975] bg-[#161126] shadow-[0_18px_48px_rgba(0,0,0,0.35)] md:grid-cols-[0.9fr_1.1fr]">
        <aside className="bg-[#211833] p-5 text-white sm:p-7"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400 text-lg font-bold text-[#07111f]">T</span><p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">Oyama Trivia</p><h1 className="mt-2 text-2xl font-semibold sm:text-3xl">Event-night remote</h1><p className="mt-3 text-sm leading-6 text-[#e9e2ff]">Open this page on any phone. Enter the four-digit event code to get only the controls assigned to that volunteer.</p><div className="mt-5 border-l-2 border-cyan-400 pl-3 text-xs text-[#d9cffa]">Event-scoped · expires automatically · revocable by the producer</div></aside>
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
          <p className="mt-2 text-xs text-[#d9cffa]">{live.lastHostAction} · expires {new Date(session.expiresAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{lastRefreshAt ? ` · updated ${new Date(lastRefreshAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" })}` : ""}</p>
        </header>
        <p className={`rounded-lg border px-3 py-2 text-sm ${online ? "border-[#4b3975] text-[#d9cffa]" : "border-rose-400/40 bg-rose-500/10 text-rose-100"}`} aria-live="polite">{message}</p>
        {session.role === "host" ? (
          <>
            <section className="rounded-xl border border-[#4b3975] bg-[#161126] p-3 sm:p-4">
              <p className="text-sm font-semibold">Now showing</p>
              <p className="mt-1 text-lg capitalize">{String(live.stage).replaceAll("_", " ")}</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                {STAGES.map((item) => {
                  const key = `set_stage:${JSON.stringify({ stage: item.stage })}`;
                  const guarded = item.stage === "answer" || item.stage === "leaderboard";
                  return <button key={item.stage} disabled={busy || !online} onClick={() => guarded ? guardedAction("set_stage", { stage: item.stage }) : void action("set_stage", { stage: item.stage })} className={live.stage === item.stage || pendingAction === key ? primaryAction : mutedAction}>{pendingAction === key ? `Confirm ${item.label}` : item.label}</button>;
                })}
              </div>
            </section>
            <section className="grid grid-cols-2 gap-2">
              <button disabled={busy || !online} onClick={() => guardedAction("previous_question")} className={pendingAction === "previous_question:{}" ? primaryAction : mutedAction}>{pendingAction === "previous_question:{}" ? "Confirm previous" : "← Previous"}</button>
              <button disabled={busy || !online} onClick={() => guardedAction("next_question")} className={pendingAction === "next_question:{}" ? primaryAction : mutedAction}>{pendingAction === "next_question:{}" ? "Confirm next" : "Next question →"}</button>
              <button disabled={busy || !online} onClick={() => void action(live.timerRunning ? "timer_pause" : "timer_start")} className={mutedAction}>{live.timerRunning ? "Pause timer" : "Start timer"}</button>
              <button disabled={busy || !online} onClick={() => guardedAction("timer_reset")} className={pendingAction === "timer_reset:{}" ? primaryAction : mutedAction}>{pendingAction === "timer_reset:{}" ? "Confirm reset" : `Reset ${live.timerRemainingSec}s`}</button>
              <button disabled={busy || !online} onClick={() => void emergencyHold()} className="col-span-2 min-h-14 touch-manipulation rounded-xl bg-rose-600 px-3 text-sm font-semibold text-white disabled:opacity-50">Emergency hold · pause and blank</button>
            </section>
          </>
        ) : session.role === "scorekeeper" ? (
          <section className="rounded-xl border border-[#4b3975] bg-[#161126] p-3 sm:p-4">
            <p className="text-sm font-semibold">Score teams</p><p className="mt-1 text-xs text-[#d9cffa]">Adjustments save immediately and are included in the event audit trail.</p>
            <div className="mt-3 space-y-2">{[...event.teams].sort((a, b) => b.score - a.score).map((team) => <div key={team.id} className="grid gap-3 rounded-xl border border-[#4b3975] bg-[#211833] p-3 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="font-semibold">{team.name}</p><p className="text-sm text-[#d9cffa]">{team.score} points</p></div><div className="grid grid-cols-3 gap-2"><button disabled={busy || !online} onClick={() => void action("score_adjust", { teamId: team.id, delta: -1 })} className={mutedAction}>−1</button><button disabled={busy || !online} onClick={() => void action("score_adjust", { teamId: team.id, delta: 1 })} className={primaryAction}>+1</button><button disabled={busy || !online} onClick={() => void action("score_adjust", { teamId: team.id, delta: 5 })} className={mutedAction}>+5</button></div></div>)}</div>
          </section>
        ) : session.role === "checkin" ? (
          <section className="rounded-xl border border-[#4b3975] bg-[#161126] p-3 sm:p-4">
            <p className="text-sm font-semibold">Check in teams</p>
            <div className="mt-3 space-y-2">{[...event.teams].sort((a, b) => a.sortOrder - b.sortOrder).map((team) => <div key={team.id} className="flex flex-col gap-3 rounded-xl border border-[#4b3975] bg-[#211833] p-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">{team.name}</p><p className="text-xs text-[#d9cffa]">Table {team.tableNumber || "—"} · {team.playerCount ?? team.players.length} members · code {team.registrationCode || "—"}</p>{team.players.length ? <p className="mt-2 text-xs leading-5 text-[#e9e2ff]">{team.players.join(" · ")}</p> : null}</div><button disabled={busy || !online || team.checkInStatus === "checked_in"} onClick={() => void action("check_in", { teamId: team.id })} className="min-h-14 w-full touch-manipulation rounded-xl bg-[#7654c5] px-4 text-sm font-semibold text-white hover:bg-[#8b6bd3] disabled:opacity-50 sm:w-auto">{team.checkInStatus === "checked_in" ? "Arrived" : "Check in table"}</button></div>)}</div>
          </section>
        ) : <TableManagerRemote teams={event.teams} busy={busy || !online} onAction={action} />}
      </div>
    </main>
  );
}

function TableManagerRemote({ teams, busy, onAction }: { teams: TriviaTeam[]; busy: boolean; onAction: (name: string, payload?: Record<string, unknown>) => Promise<void> }) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [newTeam, setNewTeam] = useState({ name: "", tableHostName: "", tableNumber: "", contactEmail: "", contactPhone: "", players: "" });
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...teams].sort((a, b) => a.sortOrder - b.sortOrder).filter((team) => !query || [team.name, team.tableHostName, team.tableNumber, team.registrationCode].some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [search, teams]);
  const walkInField = "min-h-12 rounded-lg border border-[#4b3975] bg-[#0d0a16] px-3 text-base text-white outline-none focus:border-cyan-400";
  return (
    <section className="space-y-3 rounded-xl border border-[#4b3975] bg-[#161126] p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold">Tables, guests, and check-in</p><p className="text-xs text-[#d9cffa]">{teams.length} registered teams</p></div><button onClick={() => setShowNew((current) => !current)} className="min-h-12 w-full touch-manipulation rounded-lg bg-cyan-600 px-4 text-sm font-semibold text-white sm:w-auto">{showNew ? "Cancel" : "+ Walk-in team"}</button></div>
      {showNew ? <div className="grid gap-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3 sm:grid-cols-2"><input className={walkInField} placeholder="Team name" value={newTeam.name} onChange={(event) => setNewTeam((current) => ({ ...current, name: event.target.value }))} /><input className={walkInField} placeholder="Table host" value={newTeam.tableHostName} onChange={(event) => setNewTeam((current) => ({ ...current, tableHostName: event.target.value }))} /><input inputMode="numeric" pattern="[0-9]*" className={walkInField} placeholder="Table number (auto if blank)" value={newTeam.tableNumber} onChange={(event) => setNewTeam((current) => ({ ...current, tableNumber: event.target.value.replace(/\D/g, "").slice(0, 4) }))} /><input type="email" className={walkInField} placeholder="Contact email" value={newTeam.contactEmail} onChange={(event) => setNewTeam((current) => ({ ...current, contactEmail: event.target.value }))} /><textarea className="min-h-28 rounded-lg border border-[#4b3975] bg-[#0d0a16] p-3 text-base text-white sm:col-span-2" placeholder="Guest names, one per line" value={newTeam.players} onChange={(event) => setNewTeam((current) => ({ ...current, players: event.target.value }))} /><button disabled={busy || !newTeam.name.trim()} onClick={async () => { await onAction("add_team", { ...newTeam, players: newTeam.players.split("\n").map((name) => name.trim()).filter(Boolean) }); setNewTeam({ name: "", tableHostName: "", tableNumber: "", contactEmail: "", contactPhone: "", players: "" }); setShowNew(false); }} className="min-h-14 touch-manipulation rounded-lg bg-[#7654c5] text-sm font-semibold sm:col-span-2 disabled:opacity-50">Add walk-in team</button></div> : null}
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search team, host, table, or check-in code" className="min-h-12 w-full rounded-lg border border-[#4b3975] bg-[#0d0a16] px-3 text-base text-white outline-none focus:border-cyan-400" />
      <div className="space-y-3">{filtered.map((team) => <RemoteTeamEditor key={team.id} team={team} busy={busy} onAction={onAction} />)}</div>
      {filtered.length === 0 ? <p className="py-8 text-center text-sm text-[#d9cffa]">No matching teams.</p> : null}
    </section>
  );
}
