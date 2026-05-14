"use client";

import { useMemo, useState } from "react";
import type { TriviaCheckInStatus, TriviaEvent, TriviaLiveState, TriviaScoreAction, TriviaTeam } from "@/app/apps/trivia/lib/trivia-types";
import { getCheckInSummary } from "@/app/apps/trivia/lib/trivia-selectors";
import TriviaEventOpsHeader from "@/app/components/trivia/ops/TriviaEventOpsHeader";

interface TriviaCheckInWorkspaceProps {
  event: TriviaEvent;
  scoreHistory: TriviaScoreAction[];
  live: TriviaLiveState;
  onAddWalkInTeam: (name: string, players: string[]) => void;
  onUpdateTeam: (teamId: string, updates: Partial<TriviaTeam>) => void;
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
        return byName || byCaptain || byTable;
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
          placeholder="Search by team, captain, or table"
          className="w-full rounded-md border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
        />
      </div>

      <div className="space-y-2">
        {filteredTeams.map((team) => {
          const selected = team.checkInStatus ?? (team.active ? "expected" : "inactive");
          return (
            <article key={team.id} className="rounded-xl border border-slate-700 bg-slate-900/65 p-3 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-white">{team.name}</p>
                  <p className="text-xs text-slate-300">Players: {team.playerCount ?? team.players.length} • Table {team.tableNumber || "--"}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleStatus(team, "checked_in")}
                  className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                >
                  Quick Check-In
                </button>
              </div>

              <div className="grid gap-1 sm:grid-cols-5">
                {CHECK_IN_STATUSES.map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatus(team, status)}
                    className={`rounded-md border px-2 py-1 text-xs capitalize ${checkInButtonTone(status, selected)}`}
                  >
                    {status.replace("_", " ")}
                  </button>
                ))}
              </div>

              <div className="grid gap-2 md:grid-cols-4">
                <input
                  value={team.tableNumber ?? ""}
                  onChange={(eventInput) => onUpdateTeam(team.id, { tableNumber: eventInput.target.value })}
                  placeholder="Table #"
                  className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white"
                />
                <input
                  value={team.captainName ?? ""}
                  onChange={(eventInput) => onUpdateTeam(team.id, { captainName: eventInput.target.value })}
                  placeholder="Captain"
                  className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white"
                />
                <input
                  value={String(team.playerCount ?? team.players.length)}
                  onChange={(eventInput) => onUpdateTeam(team.id, { playerCount: Number.parseInt(eventInput.target.value, 10) || 0 })}
                  placeholder="Players"
                  className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white"
                />
                <input
                  value={team.contactPhone ?? ""}
                  onChange={(eventInput) => onUpdateTeam(team.id, { contactPhone: eventInput.target.value })}
                  placeholder="Contact phone"
                  className="rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white"
                />
              </div>

              <textarea
                value={team.notes ?? ""}
                onChange={(eventInput) => onUpdateTeam(team.id, { notes: eventInput.target.value })}
                rows={2}
                placeholder="Check-in notes"
                className="w-full rounded-md border border-slate-600 bg-slate-950 px-2 py-1.5 text-xs text-white"
              />
            </article>
          );
        })}
      </div>
    </section>
  );
}
