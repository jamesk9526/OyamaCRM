"use client";

import { useMemo, useState } from "react";
import type { TriviaTeam } from "@/app/apps/trivia/lib/trivia-types";

export function RemoteTeamEditor({ team, busy, onAction }: { team: TriviaTeam; busy: boolean; onAction: (name: string, payload?: Record<string, unknown>) => Promise<boolean> }) {
  const savedDraft = {
    name: team.name, tableNumber: team.tableNumber ?? "", tableHostName: team.tableHostName ?? team.captainName ?? "",
    contactEmail: team.contactEmail ?? "", contactPhone: team.contactPhone ?? "", players: team.players.join("\n"),
    notes: team.notes ?? "",
  };
  const [editing, setEditing] = useState<typeof savedDraft | null>(null);
  const [notice, setNotice] = useState("");
  const draft = editing ?? savedDraft;
  const setDraft = (update: (current: typeof savedDraft) => typeof savedDraft) => { setEditing(update(draft)); setNotice(""); };
  const arrived = team.checkInStatus === "checked_in" || team.checkInStatus === "late";
  const inputClass = "min-h-12 w-full rounded-lg border border-[#4b3975] bg-[#0d0a16] px-3 text-base text-white outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-500/20";
  return (
    <article className="space-y-3 rounded-xl border border-[#4b3975] bg-[#211833] p-3 sm:p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div><p className="font-semibold text-white">{team.name}</p><p className="text-xs text-[#c9bee8]">Table {team.tableNumber || "unassigned"} · {team.players.length || team.playerCount || 0} guests · {String(team.paymentStatus ?? "not required").replaceAll("_", " ")}</p></div>
        <button disabled={busy || arrived} onClick={() => onAction("check_in", { teamId: team.id })} className="min-h-12 w-full touch-manipulation rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 sm:w-auto">{arrived ? "Checked in" : "Check in table"}</button>
      </div>
      <details className="rounded-lg border border-[#4b3975] p-3"><summary className="min-h-11 cursor-pointer py-2 font-semibold">Edit table and guests{editing ? " · unsaved changes" : ""}</summary>
      <form className="mt-3 space-y-3" onSubmit={async (event) => { event.preventDefault(); const players = draft.players.split("\n").map((name) => name.trim()).filter(Boolean); if (players.length > 30) { setNotice("Enter at most 30 guest names per team."); return; } const ok = await onAction("update_team", { teamId: team.id, ...draft, players }); if (ok) { setEditing(null); setNotice("Table and guests saved."); } else setNotice("Not saved. Your changes are kept here; check the connection or error above and retry."); }}>
      <fieldset disabled={busy} className="space-y-3 disabled:opacity-60">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-xs text-[#d9cffa]">Team name<input required maxLength={100} className={`${inputClass} mt-1`} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} /></label>
        <label className="text-xs text-[#d9cffa]">Table number<input required inputMode="numeric" pattern="[0-9]{1,4}" className={`${inputClass} mt-1`} value={draft.tableNumber} onChange={(event) => setDraft((current) => ({ ...current, tableNumber: event.target.value.replace(/\D/g, "").slice(0, 4) }))} /></label>
        <label className="text-xs text-[#d9cffa]">Table host<input className={`${inputClass} mt-1`} value={draft.tableHostName} onChange={(event) => setDraft((current) => ({ ...current, tableHostName: event.target.value }))} /></label>
        <p className="text-sm text-[#d9cffa]">Payment: {String(team.paymentStatus ?? "not_required").replaceAll("_", " ")}. Manage payments in Events.</p>
        <label className="text-xs text-[#d9cffa]">Email<input type="email" maxLength={160} className={`${inputClass} mt-1`} value={draft.contactEmail} onChange={(event) => setDraft((current) => ({ ...current, contactEmail: event.target.value }))} /></label>
        <label className="text-xs text-[#d9cffa]">Phone<input type="tel" maxLength={40} className={`${inputClass} mt-1`} value={draft.contactPhone} onChange={(event) => setDraft((current) => ({ ...current, contactPhone: event.target.value }))} /></label>
      </div>
      <label className="block text-xs text-[#d9cffa]">Guest names, one per line<textarea className="mt-1 min-h-28 w-full rounded-lg border border-[#4b3975] bg-[#0d0a16] p-3 text-base text-white outline-none focus:border-cyan-400" value={draft.players} onChange={(event) => setDraft((current) => ({ ...current, players: event.target.value }))} /></label>
      <label className="block text-xs text-[#d9cffa]">Operations notes<textarea className="mt-1 min-h-20 w-full rounded-lg border border-[#4b3975] bg-[#0d0a16] p-3 text-base text-white outline-none focus:border-cyan-400" value={draft.notes} onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))} /></label>
      <button type="submit" disabled={busy || !draft.name.trim() || !draft.tableNumber || Number(draft.tableNumber) < 1} className="min-h-14 w-full touch-manipulation rounded-lg bg-[#7654c5] text-sm font-semibold text-white hover:bg-[#8b6bd3] disabled:opacity-50">Save table and guests</button>
      {editing ? <button type="button" onClick={() => { setEditing(null); setNotice(""); }} className="min-h-12 w-full rounded-lg border border-[#8067b7]">Discard unsaved changes</button> : null}
      </fieldset><p role="status" className="text-sm text-cyan-100">{notice}</p></form></details>
    </article>
  );
}

export function TableManagerRemote({ teams, busy, onAction }: { teams: TriviaTeam[]; busy: boolean; onAction: (name: string, payload?: Record<string, unknown>) => Promise<boolean> }) {
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [notice, setNotice] = useState("");
  const emptyTeam = { name: "", tableHostName: "", tableNumber: "", contactEmail: "", contactPhone: "", players: "" };
  const [newTeam, setNewTeam] = useState(emptyTeam);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...teams].sort((a, b) => Number(a.tableNumber || 99999) - Number(b.tableNumber || 99999) || a.sortOrder - b.sortOrder)
      .filter((team) => !query || [team.name, team.tableHostName, team.captainName, team.tableNumber, team.registrationCode, ...team.players].some((value) => String(value ?? "").toLowerCase().includes(query)));
  }, [search, teams]);
  const field = "mt-1 min-h-12 w-full rounded-lg border border-[#8067b7] bg-[#0d0a16] px-3 text-base text-white outline-none focus:border-cyan-400";
  return <section className="space-y-3 rounded-xl border border-[#4b3975] bg-[#161126] p-3 sm:p-4">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-semibold">Tables, guests, and check-in</h2><p className="text-sm text-[#d9cffa]">{teams.filter(isArrived).length} / {teams.length} teams checked in</p></div><button type="button" disabled={busy} onClick={() => { setShowNew(!showNew); setNotice(""); }} className="min-h-12 rounded-lg bg-cyan-600 px-4 font-semibold disabled:opacity-50">{showNew ? "Close walk-in form" : "+ Walk-in team"}</button></div>
    {showNew ? <form className="space-y-3 rounded-xl border border-cyan-500/40 bg-cyan-500/10 p-3" onSubmit={async (event) => {
      event.preventDefault();
      const players = newTeam.players.split("\n").map((name) => name.trim()).filter(Boolean);
      if (players.length > 30) { setNotice("Enter at most 30 guest names per team."); return; }
      if (newTeam.tableNumber && (Number(newTeam.tableNumber) < 1 || teams.some((team) => Number(team.tableNumber) === Number(newTeam.tableNumber)))) { setNotice("Choose an unused table number from 1 to 9999, or leave it blank for automatic assignment."); return; }
      const saved = await onAction("add_team", { ...newTeam, players });
      if (!saved) { setNotice("Team not added. Your entries are kept; check the error above and retry."); return; }
      setNewTeam(emptyTeam); setShowNew(false); setSearch(""); setNotice("Walk-in team added. Check in the new table when it arrives.");
    }}>
      <h3 className="font-semibold">Add walk-in team</h3><p className="text-sm text-[#d9cffa]">A blank table number gets the next available table. Add guest names now or edit them later.</p>
      <fieldset disabled={busy} className="grid gap-3 sm:grid-cols-2 disabled:opacity-60">
        <label className="text-sm">Team name<input required maxLength={100} className={field} value={newTeam.name} onChange={(event) => setNewTeam({ ...newTeam, name: event.target.value })} /></label>
        <label className="text-sm">Table host<input maxLength={100} className={field} value={newTeam.tableHostName} onChange={(event) => setNewTeam({ ...newTeam, tableHostName: event.target.value })} /></label>
        <label className="text-sm">Table number (optional)<input inputMode="numeric" pattern="[0-9]{1,4}" className={field} value={newTeam.tableNumber} onChange={(event) => setNewTeam({ ...newTeam, tableNumber: event.target.value.replace(/\D/g, "").slice(0, 4) })} /></label>
        <label className="text-sm">Contact email<input type="email" maxLength={160} className={field} value={newTeam.contactEmail} onChange={(event) => setNewTeam({ ...newTeam, contactEmail: event.target.value })} /></label>
        <label className="text-sm">Contact phone<input type="tel" maxLength={40} className={field} value={newTeam.contactPhone} onChange={(event) => setNewTeam({ ...newTeam, contactPhone: event.target.value })} /></label>
        <label className="text-sm sm:col-span-2">Guest names, one per line<textarea className={`${field} min-h-28 py-3`} value={newTeam.players} onChange={(event) => setNewTeam({ ...newTeam, players: event.target.value })} /></label>
        <button type="submit" disabled={busy || !newTeam.name.trim()} className="min-h-14 rounded-lg bg-[#7654c5] font-semibold sm:col-span-2 disabled:opacity-50">{busy ? "Saving…" : "Add walk-in team"}</button>
      </fieldset>
    </form> : null}
    <p role="status" className="text-sm text-cyan-100">{notice}</p>
    <label className="block text-sm font-semibold">Find a table<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Team, host, guest, table, or code" className={field} /></label>
    <div className="space-y-3">{filtered.map((team) => <RemoteTeamEditor key={team.id} team={team} busy={busy} onAction={onAction} />)}</div>
    {!filtered.length ? <p className="py-6 text-center text-sm text-[#d9cffa]">{teams.length ? "No matching tables. Try a guest name, host, table number, or code." : "No teams registered yet. Add a walk-in team to begin."}</p> : null}
  </section>;
}


const isArrived = (team: TriviaTeam) => team.checkInStatus === "checked_in" || team.checkInStatus === "late";

export function TriviaCheckInRemote({ teams, busy, onAction }: { teams: TriviaTeam[]; busy: boolean; onAction: (name: string, payload?: Record<string, unknown>) => Promise<boolean> }) {
  const [search, setSearch] = useState("");
  const [waitingOnly, setWaitingOnly] = useState(false);
  const [undoTeam, setUndoTeam] = useState<string | null>(null);
  const query = search.trim().toLowerCase();
  const filtered = [...teams].sort((a, b) => Number(a.tableNumber || 99999) - Number(b.tableNumber || 99999) || a.sortOrder - b.sortOrder)
    .filter((team) => (!waitingOnly || !isArrived(team)) && (!query || [team.name, team.tableNumber, team.registrationCode, team.tableHostName, team.captainName, ...team.players].some((value) => String(value ?? "").toLowerCase().includes(query))));
  return <section className="space-y-3 rounded-xl border border-[#4b3975] bg-[#161126] p-3 sm:p-4">
    <h2 className="text-lg font-semibold">Check in teams</h2>
    <p role="status" className="text-sm text-cyan-100">{teams.filter(isArrived).length} of {teams.length} teams arrived</p>
    <label className="block text-sm font-semibold">Find a table<input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Team, host, guest, table, or code" className="mt-2 min-h-12 w-full rounded-lg border border-[#8067b7] bg-[#0d0a16] px-3 text-base" /></label>
    <button type="button" aria-pressed={waitingOnly} onClick={() => setWaitingOnly(!waitingOnly)} className="min-h-12 w-full rounded-lg border border-[#8067b7] px-3">{waitingOnly ? "Showing waiting teams · show all" : "Show only teams still waiting"}</button>
    <div className="space-y-3">{filtered.map((team) => <article key={team.id} className="space-y-3 rounded-xl border border-[#4b3975] bg-[#211833] p-3">
      <div className="flex items-start justify-between gap-3"><h3 className="break-words font-semibold">{team.name}</h3><span className="shrink-0 rounded-lg bg-[#0d0a16] px-3 py-2 text-lg font-bold">Table {team.tableNumber || "—"}</span></div>
      <p className="text-sm text-[#d9cffa]">{team.playerCount ?? team.players.length} guests · code {team.registrationCode || "—"}{team.tableHostName || team.captainName ? ` · Host: ${team.tableHostName || team.captainName}` : ""}</p>
      {team.players.length ? <p className="break-words text-sm text-[#d9cffa]">{team.players.join(" · ")}</p> : null}
      {isArrived(team) ? <div className="space-y-2"><p className="font-semibold text-emerald-200">✓ Arrived{team.checkInStatus === "late" ? " · late arrival" : ""}</p><button type="button" disabled={busy} onClick={async () => { if (undoTeam !== team.id) { setUndoTeam(team.id); return; } if (await onAction("check_in", { teamId: team.id, status: "expected" })) setUndoTeam(null); }} className="min-h-12 w-full rounded-lg border border-[#8067b7] px-3 text-sm disabled:opacity-50">{undoTeam === team.id ? "Confirm undo check-in" : "Undo accidental check-in"}</button>{undoTeam === team.id ? <button type="button" onClick={() => setUndoTeam(null)} className="min-h-11 w-full text-sm">Keep checked in</button> : null}</div> : <button type="button" disabled={busy} onClick={() => void onAction("check_in", { teamId: team.id })} className="min-h-14 w-full touch-manipulation rounded-xl bg-emerald-600 px-4 font-semibold disabled:opacity-50">Check in table</button>}
    </article>)}</div>
    {!filtered.length ? <p className="py-6 text-center text-sm text-[#d9cffa]">{!teams.length ? "No teams registered yet. Ask the table manager to add walk-in teams." : query ? "No matching teams. Try a team name, guest, table number, or code." : "All teams are checked in."}</p> : null}
  </section>;
}
