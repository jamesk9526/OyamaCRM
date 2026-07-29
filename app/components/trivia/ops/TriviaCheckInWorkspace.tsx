"use client";

import { useEffect, useMemo, useState } from "react";
import type { TriviaCheckInStatus, TriviaEvent, TriviaLiveState, TriviaScoreAction, TriviaTeam } from "@/app/apps/trivia/lib/trivia-types";
import { getCheckInSummary } from "@/app/apps/trivia/lib/trivia-selectors";
import TriviaEventOpsHeader from "@/app/components/trivia/ops/TriviaEventOpsHeader";

interface TriviaCheckInWorkspaceProps {
  event: TriviaEvent;
  scoreHistory: TriviaScoreAction[];
  live: TriviaLiveState;
  onAddWalkInTeam: (name: string, players: string[]) => void;
  onUpdateTeam: (teamId: string, updates: Partial<TriviaTeam>) => { ok: boolean; error?: string };
  onRemoveTeam: (teamId: string) => void;
}

const CHECK_IN_STATUSES: TriviaCheckInStatus[] = ["expected", "checked_in", "late", "inactive", "dropped"];

function checkInButtonTone(status: TriviaCheckInStatus, selected: TriviaCheckInStatus): string {
  if (status !== selected) return "border-slate-600 bg-slate-900 text-slate-200 hover:bg-slate-800";
  if (status === "checked_in") return "border-emerald-400/60 bg-emerald-500/20 text-emerald-100";
  if (status === "late") return "border-amber-400/60 bg-amber-500/20 text-amber-100";
  if (status === "inactive" || status === "dropped") return "border-rose-400/60 bg-rose-500/20 text-rose-100";
  return "border-cyan-400/60 bg-cyan-500/20 text-cyan-100";
}

/** Dedicated front-desk check-in operations panel for event-night team intake. */
export default function TriviaCheckInWorkspace({
  event,
  live,
  scoreHistory,
  onAddWalkInTeam,
  onUpdateTeam,
  onRemoveTeam,
}: TriviaCheckInWorkspaceProps) {
  const [search, setSearch] = useState("");
  const [walkInName, setWalkInName] = useState("");
  const [walkInPlayers, setWalkInPlayers] = useState("2");

  const summary = useMemo(() => getCheckInSummary(event.teams), [event.teams]);

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [...event.teams].sort((a, b) => a.sortOrder - b.sortOrder);

    return [...event.teams]
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .filter((team) => {
        const byName = team.name.toLowerCase().includes(query);
        const byCaptain = (team.captainName ?? "").toLowerCase().includes(query);
        const byTable = (team.tableNumber ?? "").toLowerCase().includes(query);
        const byCode = (team.registrationCode ?? "").includes(query);
        const byEmail = (team.contactEmail ?? "").toLowerCase().includes(query);
        const byMember = team.players.some((player) => player.toLowerCase().includes(query));
        return byName || byCaptain || byTable || byCode || byEmail || byMember;
      });
  }, [event.teams, search]);

  function handleAddWalkIn() {
    const name = walkInName.trim();
    if (!name) return;

    const count = Number.parseInt(walkInPlayers, 10);
    const safeCount = Number.isFinite(count) && count > 0 ? count : 2;
    const players = Array.from({ length: safeCount }, (_, index) => `Player ${index + 1}`);

    onAddWalkInTeam(name, players);
    setWalkInName("");
    setWalkInPlayers("2");
  }

  function handleStatus(team: TriviaTeam, status: TriviaCheckInStatus) {
    onUpdateTeam(team.id, {
      checkInStatus: status,
      active: status !== "inactive" && status !== "dropped",
      checkedInAt: status === "checked_in" || status === "late" ? team.checkedInAt ?? new Date().toISOString() : team.checkedInAt ?? null,
    });
  }

  function mergeDuplicateTeams() {
    const grouped = new Map<string, TriviaTeam[]>();
    event.teams.forEach((team) => {
      const key = team.name.trim().toLowerCase();
      const current = grouped.get(key) ?? [];
      current.push(team);
      grouped.set(key, current);
    });

    grouped.forEach((teams) => {
      if (teams.length < 2) return;
      const [primary, ...duplicates] = teams;
      const mergedPlayers = Array.from(new Set([...(primary.players ?? []), ...duplicates.flatMap((team) => team.players ?? [])]));

      onUpdateTeam(primary.id, {
        players: mergedPlayers,
        playerCount: mergedPlayers.length,
        notes: [primary.notes, ...duplicates.map((team) => team.notes)].filter(Boolean).join(" | "),
      });

      duplicates.forEach((team) => onRemoveTeam(team.id));
    });
  }

  return (
    <section className="space-y-4">
      <TriviaEventOpsHeader event={event} live={live} scoreHistory={scoreHistory} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <div className="rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-cyan-200">Expected</p>
          <p className="text-xl font-semibold text-white mt-1">{summary.expected}</p>
        </div>
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/15 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-emerald-200">Checked In</p>
          <p className="text-xl font-semibold text-white mt-1">{summary.checkedIn}</p>
        </div>
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/15 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-amber-200">Late</p>
          <p className="text-xl font-semibold text-white mt-1">{summary.late}</p>
        </div>
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-rose-200">Inactive/Dropped</p>
          <p className="text-xl font-semibold text-white mt-1">{summary.inactive + summary.dropped}</p>
        </div>
        <div className="rounded-lg border border-slate-600 bg-slate-800/60 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-300">Active Teams</p>
          <p className="text-xl font-semibold text-white mt-1">{summary.activeTeams}</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-white">Front Desk Controls</h2>
          <button
            type="button"
            onClick={mergeDuplicateTeams}
            className="rounded-md border border-slate-500 bg-slate-800 px-2.5 py-1 text-xs text-slate-100 hover:bg-slate-700"
          >
            Merge Duplicate Teams
          </button>
        </div>

        <div className="grid gap-2 md:grid-cols-3">
          <input
            value={walkInName}
            onChange={(eventInput) => setWalkInName(eventInput.target.value)}
            placeholder="Walk-in team name"
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <input
            value={walkInPlayers}
            onChange={(eventInput) => setWalkInPlayers(eventInput.target.value)}
            placeholder="Player count"
            className="rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
          />
          <button
            type="button"
            onClick={handleAddWalkIn}
            className="rounded-md bg-fuchsia-600 px-3 py-2 text-sm font-semibold text-white hover:bg-fuchsia-500"
          >
            Add Walk-In Team
          </button>
        </div>

        <input
          value={search}
          onChange={(eventInput) => setSearch(eventInput.target.value)}
          placeholder="Search team, table host, guest, email, table, or four-digit code"
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </div>

      <div className="space-y-2">
        {filteredTeams.map((team) => <CheckInTeamCard key={team.id} team={team} onUpdateTeam={onUpdateTeam} onSetStatus={(status) => handleStatus(team, status)} />)}
      </div>
    </section>
  );
}

function CheckInTeamCard({
  team,
  onUpdateTeam,
  onSetStatus,
}: {
  team: TriviaTeam;
  onUpdateTeam: (teamId: string, updates: Partial<TriviaTeam>) => { ok: boolean; error?: string };
  onSetStatus: (status: TriviaCheckInStatus) => void;
}) {
  const [draft, setDraft] = useState({
    name: team.name,
    tableNumber: team.tableNumber ?? "",
    tableHostName: team.tableHostName ?? team.captainName ?? "",
    contactEmail: team.contactEmail ?? "",
    contactPhone: team.contactPhone ?? "",
    members: team.players.join("\n"),
    paymentStatus: team.paymentStatus ?? "not_required",
    amountDue: String(team.amountDue ?? 0),
    payerName: team.payerName ?? "",
    payerEmail: team.payerEmail ?? "",
    notes: team.notes ?? "",
  });
  const [feedback, setFeedback] = useState("");
  useEffect(() => {
    setDraft({
      name: team.name, tableNumber: team.tableNumber ?? "", tableHostName: team.tableHostName ?? team.captainName ?? "",
      contactEmail: team.contactEmail ?? "", contactPhone: team.contactPhone ?? "", members: team.players.join("\n"),
      paymentStatus: team.paymentStatus ?? "not_required", amountDue: String(team.amountDue ?? 0),
      payerName: team.payerName ?? "", payerEmail: team.payerEmail ?? "", notes: team.notes ?? "",
    });
  }, [team]);
  const selected = team.checkInStatus ?? (team.active ? "expected" : "inactive");
  const input = "rounded-md border border-slate-600 bg-slate-950 px-2 py-2 text-xs text-white outline-none focus:border-cyan-400";

  function save() {
    const players = draft.members.split("\n").map((name) => name.trim()).filter(Boolean);
    const result = onUpdateTeam(team.id, {
      name: draft.name.trim() || team.name,
      tableNumber: draft.tableNumber,
      tableHostName: draft.tableHostName,
      captainName: draft.tableHostName,
      contactEmail: draft.contactEmail,
      contactPhone: draft.contactPhone,
      players,
      playerCount: players.length,
      paymentStatus: draft.paymentStatus as TriviaTeam["paymentStatus"],
      amountDue: Math.max(0, Number(draft.amountDue) || 0),
      payerName: draft.payerName,
      payerEmail: draft.payerEmail,
      notes: draft.notes,
    });
    setFeedback(result.ok ? `Table ${draft.tableNumber} and ${players.length} member${players.length === 1 ? "" : "s"} saved.` : result.error ?? "Could not save this table.");
  }

  return (
    <article className="space-y-3 rounded-xl border border-slate-700 bg-slate-900/65 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><p className="text-sm font-semibold text-white">Table {team.tableNumber} · {team.name}</p><p className="text-xs text-slate-300">{team.players.length} named member{team.players.length === 1 ? "" : "s"} · Host {team.tableHostName || team.captainName || "--"} · RSVP code {team.registrationCode || "--"}</p></div>
        <button type="button" onClick={() => onSetStatus("checked_in")} className="rounded-md bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500">{selected === "checked_in" ? "Checked in" : "Quick check-in"}</button>
      </div>
      <div className="grid gap-1 sm:grid-cols-5">{CHECK_IN_STATUSES.map((status) => <button key={status} type="button" onClick={() => onSetStatus(status)} className={`rounded-md border px-2 py-1.5 text-xs capitalize ${checkInButtonTone(status, selected)}`}>{status.replace("_", " ")}</button>)}</div>
      <div className="grid gap-2 md:grid-cols-4">
        <label className="text-xs text-slate-300">Table number<input inputMode="numeric" pattern="[0-9]*" value={draft.tableNumber} onChange={(e) => setDraft((current) => ({ ...current, tableNumber: e.target.value.replace(/\D/g, "").slice(0, 4) }))} className={`${input} mt-1 w-full font-mono font-semibold`} /></label>
        <label className="text-xs text-slate-300">Team name<input value={draft.name} onChange={(e) => setDraft((current) => ({ ...current, name: e.target.value }))} className={`${input} mt-1 w-full`} /></label>
        <label className="text-xs text-slate-300">Table host<input value={draft.tableHostName} onChange={(e) => setDraft((current) => ({ ...current, tableHostName: e.target.value }))} className={`${input} mt-1 w-full`} /></label>
        <label className="text-xs text-slate-300">Contact email<input type="email" value={draft.contactEmail} onChange={(e) => setDraft((current) => ({ ...current, contactEmail: e.target.value }))} className={`${input} mt-1 w-full`} /></label>
        <label className="text-xs text-slate-300">Contact phone<input value={draft.contactPhone} onChange={(e) => setDraft((current) => ({ ...current, contactPhone: e.target.value }))} className={`${input} mt-1 w-full`} /></label>
        <label className="text-xs text-slate-300">Payment status<select value={draft.paymentStatus} onChange={(e) => setDraft((current) => ({ ...current, paymentStatus: e.target.value as NonNullable<TriviaTeam["paymentStatus"]> }))} className={`${input} mt-1 w-full`}><option value="not_required">Not required</option><option value="pending">Pending</option><option value="partial">Partial</option><option value="paid">Paid</option><option value="waived">Waived</option></select></label>
        <label className="text-xs text-slate-300">Amount due<input type="number" min={0} step="0.01" value={draft.amountDue} onChange={(e) => setDraft((current) => ({ ...current, amountDue: e.target.value }))} className={`${input} mt-1 w-full`} /></label>
        <label className="text-xs text-slate-300">Payer name<input value={draft.payerName} onChange={(e) => setDraft((current) => ({ ...current, payerName: e.target.value }))} className={`${input} mt-1 w-full`} /></label>
        <label className="text-xs text-slate-300 md:col-span-2">Payer email<input type="email" value={draft.payerEmail} onChange={(e) => setDraft((current) => ({ ...current, payerEmail: e.target.value }))} className={`${input} mt-1 w-full`} /></label>
        <label className="text-xs text-slate-300 md:col-span-2">Internal notes<input value={draft.notes} onChange={(e) => setDraft((current) => ({ ...current, notes: e.target.value }))} className={`${input} mt-1 w-full`} /></label>
      </div>
      <label className="block text-xs text-slate-300">Table members — one person per line<textarea value={draft.members} onChange={(e) => setDraft((current) => ({ ...current, members: e.target.value }))} rows={Math.max(3, Math.min(8, draft.members.split("\n").length + 1))} className="mt-1 w-full rounded-md border border-slate-600 bg-slate-950 p-3 text-sm text-white outline-none focus:border-cyan-400" placeholder="First and last name" /></label>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className={`text-xs ${feedback.includes("already") || feedback.includes("must") || feedback.includes("Could not") ? "text-rose-200" : "text-emerald-200"}`} aria-live="polite">{feedback}</p><button type="button" onClick={save} className="rounded-md bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500">Save table and members</button></div>
    </article>
  );
}
