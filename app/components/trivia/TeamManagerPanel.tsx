// TeamManagerPanel supports real team and player creation for trivia events.
"use client";

import { useState } from "react";
import type { TriviaTeam } from "@/app/apps/trivia/lib/trivia-types";

interface TeamManagerPanelProps {
  /** Existing event teams to render and review. */
  teams: TriviaTeam[];
  /** Callback for creating a team in persisted trivia state. */
  onAddTeam: (name: string, players: string[], color: string, icon: string) => void;
  /** Callback for updating team metadata in persisted trivia state. */
  onUpdateTeam: (teamId: string, updates: Partial<TriviaTeam>) => void;
  /** Callback for moving team display order. */
  onReorderTeam: (teamId: string, direction: -1 | 1) => void;
  /** Callback for removing a team from the event. */
  onRemoveTeam: (teamId: string) => void;
}

const COLOR_OPTIONS = ["#34d399", "#38bdf8", "#f59e0b", "#f472b6", "#a78bfa", "#fb7185", "#22c55e", "#f97316"];
const ICON_OPTIONS = ["star", "bolt", "brain", "crown", "rocket", "shield", "spark", "target"];

/**
 * TeamManagerPanel gives hosts full team administration controls for live operations.
 * It supports search, inline edits, ordering, status toggles, and visual identity fields.
 */
export default function TeamManagerPanel({ teams, onAddTeam, onUpdateTeam, onReorderTeam, onRemoveTeam }: TeamManagerPanelProps) {
  const [name, setName] = useState("");
  const [playersText, setPlayersText] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [color, setColor] = useState(COLOR_OPTIONS[0]);
  const [icon, setIcon] = useState(ICON_OPTIONS[0]);

  const orderedTeams = [...teams].sort((a, b) => a.sortOrder - b.sortOrder);
  const filteredTeams = orderedTeams.filter((team) => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return true;
    const inName = team.name.toLowerCase().includes(query);
    const inPlayers = team.players.join(" ").toLowerCase().includes(query);
    return inName || inPlayers;
  });

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;

    const players = playersText
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    onAddTeam(name.trim(), players, color, icon);
    setName("");
    setPlayersText("");
    setColor(COLOR_OPTIONS[0]);
    setIcon(ICON_OPTIONS[0]);
  }

  return (
    <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4">
      <h2 className="text-lg font-semibold text-white">Team and Player Manager</h2>
      <p className="text-sm text-slate-300 mt-1">Manage team identity, ordering, and active status for accurate live scoring and leaderboard display.</p>

      <form onSubmit={handleSubmit} className="mt-4 grid grid-cols-1 md:grid-cols-6 gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Team name"
          className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white md:col-span-2"
        />
        <input
          value={playersText}
          onChange={(e) => setPlayersText(e.target.value)}
          placeholder="Players (comma separated)"
          className="rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white md:col-span-2"
        />
        <select value={color} onChange={(e) => setColor(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-xs text-white">
          {COLOR_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <select value={icon} onChange={(e) => setIcon(e.target.value)} className="rounded-lg border border-slate-600 bg-slate-950 px-2 py-2 text-xs text-white">
          {ICON_OPTIONS.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>
        <button className="md:col-span-6 rounded-lg bg-emerald-500 hover:bg-emerald-400 px-3 py-2 text-sm font-semibold text-black" type="submit">
          Add Team
        </button>
      </form>

      <input
        value={searchTerm}
        onChange={(event) => setSearchTerm(event.target.value)}
        placeholder="Search teams by name or player"
        className="mt-3 w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm text-white"
      />

      <div className="mt-4 space-y-2">
        {filteredTeams.map((team, visibleIndex) => (
          <article key={team.id} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-3 space-y-2">
            <div className="flex flex-wrap gap-2 items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <span className="h-3 w-3 rounded-full" style={{ backgroundColor: team.color }} />
                <input
                  value={team.name}
                  onChange={(event) => onUpdateTeam(team.id, { name: event.target.value })}
                  className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white min-w-[180px]"
                />
                <span className="rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-[0.15em] text-slate-300">
                  {team.active ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onReorderTeam(team.id, -1)}
                  className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-40"
                  disabled={team.sortOrder === 0}
                >
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => onReorderTeam(team.id, 1)}
                  className="rounded border border-slate-600 bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-40"
                  disabled={team.sortOrder === orderedTeams.length - 1}
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateTeam(team.id, { active: !team.active })}
                  className="rounded border border-amber-500/60 bg-amber-500/20 px-2 py-1 text-xs text-amber-100"
                >
                  {team.active ? "Set Inactive" : "Set Active"}
                </button>
                <button
                  type="button"
                  onClick={() => onRemoveTeam(team.id)}
                  className="rounded border border-rose-500/60 bg-rose-500/20 px-2 py-1 text-xs text-rose-100"
                >
                  Remove
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <input
                value={team.players.join(", ")}
                onChange={(event) => {
                  const players = event.target.value
                    .split(",")
                    .map((item) => item.trim())
                    .filter(Boolean);
                  onUpdateTeam(team.id, { players });
                }}
                placeholder="Players"
                className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white md:col-span-2"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={team.color}
                  onChange={(event) => onUpdateTeam(team.id, { color: event.target.value })}
                  className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white"
                >
                  {COLOR_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
                <select
                  value={team.icon}
                  onChange={(event) => onUpdateTeam(team.id, { icon: event.target.value })}
                  className="rounded border border-slate-600 bg-slate-900 px-2 py-1.5 text-xs text-white"
                >
                  {ICON_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <p className="text-[11px] text-slate-400">Display order #{team.sortOrder + 1} in event roster. Filter position {visibleIndex + 1}.</p>
          </article>
        ))}
        {filteredTeams.length === 0 ? <p className="text-sm text-slate-400">No teams match the current search.</p> : null}
      </div>
    </section>
  );
}
