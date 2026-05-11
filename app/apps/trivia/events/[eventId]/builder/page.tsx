// Builder route for teams, rounds, questions, and import/export foundations.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import TriviaEventHeader from "@/app/components/trivia/TriviaEventHeader";
import TeamManagerPanel from "@/app/components/trivia/TeamManagerPanel";
import RoundQuestionBuilderPanel from "@/app/components/trivia/RoundQuestionBuilderPanel";
import FeatureInProgressNotice from "@/app/components/trivia/FeatureInProgressNotice";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

/**
 * TriviaEventBuilderPage is the operational setup workspace for event content and teams.
 */
export default function TriviaEventBuilderPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const { state, addTeam, updateTeam, reorderTeam, removeTeam, addRound, addQuestion, updateEventSettings, importEventsFromJson } = useTriviaModuleState();
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState("");

  const event = useMemo(() => state.events.find((item) => item.id === eventId) ?? null, [state.events, eventId]);

  if (!event) {
    return (
      <section className="rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
        Event not found. Go to the events list and create or select an event.
      </section>
    );
  }

  function handleExport() {
    const payload = JSON.stringify([event], null, 2);
    navigator.clipboard.writeText(payload).then(() => {
      setImportMessage("Event JSON copied. You can save this as a trivia pack file.");
    }).catch(() => {
      setImportMessage("Copy failed. Select and copy manually from browser tools.");
    });
  }

  function handleImport() {
    const result = importEventsFromJson(importText);
    setImportMessage(result.message);
  }

  return (
    <section className="space-y-4">
      <TriviaEventHeader
        event={event}
        actions={(
          <>
            <Link href={`/apps/trivia/events/${event.id}/host`} className="rounded-lg bg-emerald-600 hover:bg-emerald-500 px-3 py-2 text-xs font-semibold text-black">
              Open Host Panel
            </Link>
            <Link href={`/apps/trivia/display/${event.id}`} target="_blank" className="rounded-lg bg-cyan-700 hover:bg-cyan-600 px-3 py-2 text-xs text-white">
              Open Display
            </Link>
          </>
        )}
      />

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <TeamManagerPanel
          teams={event.teams}
          onAddTeam={(name, players, color, icon) => addTeam(event.id, { name, players, color, icon })}
          onUpdateTeam={(teamId, updates) => updateTeam(event.id, teamId, updates)}
          onReorderTeam={(teamId, direction) => reorderTeam(event.id, teamId, direction)}
          onRemoveTeam={(teamId) => removeTeam(event.id, teamId)}
        />

        <RoundQuestionBuilderPanel
          rounds={event.rounds}
          onAddRound={(title, description, roundType) => addRound(event.id, { title, description, roundType })}
          onAddQuestion={(roundId, payload) => addQuestion(event.id, roundId, payload)}
        />
      </div>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-white">Scoring and Display Rules</h2>
        <p className="text-sm text-slate-300">These event settings define host scoring behavior and projector defaults.</p>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <label className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            Default points
            <input
              type="number"
              min={1}
              value={event.scoringRules.defaultQuestionPoints}
              onChange={(inputEvent) =>
                updateEventSettings(event.id, {
                  defaultQuestionPoints: Number(inputEvent.target.value) || event.scoringRules.defaultQuestionPoints,
                  allowPartialCredit: event.scoringRules.allowPartialCredit,
                  allowNegativeScores: event.scoringRules.allowNegativeScores,
                  finalWagerEnabled: event.scoringRules.finalWagerEnabled,
                  tieBreakerMode: event.scoringRules.tieBreakerMode,
                  highContrast: event.displaySettings.highContrast,
                  showTeamColors: event.displaySettings.showTeamColors,
                  showTimerOnQuestion: event.displaySettings.showTimerOnQuestion,
                })
              }
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
            />
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={event.scoringRules.allowPartialCredit}
              onChange={(inputEvent) =>
                updateEventSettings(event.id, {
                  defaultQuestionPoints: event.scoringRules.defaultQuestionPoints,
                  allowPartialCredit: inputEvent.target.checked,
                  allowNegativeScores: event.scoringRules.allowNegativeScores,
                  finalWagerEnabled: event.scoringRules.finalWagerEnabled,
                  tieBreakerMode: event.scoringRules.tieBreakerMode,
                  highContrast: event.displaySettings.highContrast,
                  showTeamColors: event.displaySettings.showTeamColors,
                  showTimerOnQuestion: event.displaySettings.showTimerOnQuestion,
                })
              }
            />
            Allow partial credit
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={event.scoringRules.allowNegativeScores}
              onChange={(inputEvent) =>
                updateEventSettings(event.id, {
                  defaultQuestionPoints: event.scoringRules.defaultQuestionPoints,
                  allowPartialCredit: event.scoringRules.allowPartialCredit,
                  allowNegativeScores: inputEvent.target.checked,
                  finalWagerEnabled: event.scoringRules.finalWagerEnabled,
                  tieBreakerMode: event.scoringRules.tieBreakerMode,
                  highContrast: event.displaySettings.highContrast,
                  showTeamColors: event.displaySettings.showTeamColors,
                  showTimerOnQuestion: event.displaySettings.showTimerOnQuestion,
                })
              }
            />
            Allow negative scores
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={event.scoringRules.finalWagerEnabled}
              onChange={(inputEvent) =>
                updateEventSettings(event.id, {
                  defaultQuestionPoints: event.scoringRules.defaultQuestionPoints,
                  allowPartialCredit: event.scoringRules.allowPartialCredit,
                  allowNegativeScores: event.scoringRules.allowNegativeScores,
                  finalWagerEnabled: inputEvent.target.checked,
                  tieBreakerMode: event.scoringRules.tieBreakerMode,
                  highContrast: event.displaySettings.highContrast,
                  showTeamColors: event.displaySettings.showTeamColors,
                  showTimerOnQuestion: event.displaySettings.showTimerOnQuestion,
                })
              }
            />
            Enable final wager mode
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <label className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            Tie breaker mode
            <select
              value={event.scoringRules.tieBreakerMode}
              onChange={(inputEvent) =>
                updateEventSettings(event.id, {
                  defaultQuestionPoints: event.scoringRules.defaultQuestionPoints,
                  allowPartialCredit: event.scoringRules.allowPartialCredit,
                  allowNegativeScores: event.scoringRules.allowNegativeScores,
                  finalWagerEnabled: event.scoringRules.finalWagerEnabled,
                  tieBreakerMode: inputEvent.target.value as "single_question" | "sudden_death",
                  highContrast: event.displaySettings.highContrast,
                  showTeamColors: event.displaySettings.showTeamColors,
                  showTimerOnQuestion: event.displaySettings.showTimerOnQuestion,
                })
              }
              className="mt-1 w-full rounded border border-slate-600 bg-slate-900 px-2 py-1 text-sm text-white"
            >
              <option value="single_question">Single question</option>
              <option value="sudden_death">Sudden death</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={event.displaySettings.highContrast}
              onChange={(inputEvent) =>
                updateEventSettings(event.id, {
                  defaultQuestionPoints: event.scoringRules.defaultQuestionPoints,
                  allowPartialCredit: event.scoringRules.allowPartialCredit,
                  allowNegativeScores: event.scoringRules.allowNegativeScores,
                  finalWagerEnabled: event.scoringRules.finalWagerEnabled,
                  tieBreakerMode: event.scoringRules.tieBreakerMode,
                  highContrast: inputEvent.target.checked,
                  showTeamColors: event.displaySettings.showTeamColors,
                  showTimerOnQuestion: event.displaySettings.showTimerOnQuestion,
                })
              }
            />
            High contrast projector
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={event.displaySettings.showTeamColors}
              onChange={(inputEvent) =>
                updateEventSettings(event.id, {
                  defaultQuestionPoints: event.scoringRules.defaultQuestionPoints,
                  allowPartialCredit: event.scoringRules.allowPartialCredit,
                  allowNegativeScores: event.scoringRules.allowNegativeScores,
                  finalWagerEnabled: event.scoringRules.finalWagerEnabled,
                  tieBreakerMode: event.scoringRules.tieBreakerMode,
                  highContrast: event.displaySettings.highContrast,
                  showTeamColors: inputEvent.target.checked,
                  showTimerOnQuestion: event.displaySettings.showTimerOnQuestion,
                })
              }
            />
            Show team colors
          </label>
          <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-200">
            <input
              type="checkbox"
              checked={event.displaySettings.showTimerOnQuestion}
              onChange={(inputEvent) =>
                updateEventSettings(event.id, {
                  defaultQuestionPoints: event.scoringRules.defaultQuestionPoints,
                  allowPartialCredit: event.scoringRules.allowPartialCredit,
                  allowNegativeScores: event.scoringRules.allowNegativeScores,
                  finalWagerEnabled: event.scoringRules.finalWagerEnabled,
                  tieBreakerMode: event.scoringRules.tieBreakerMode,
                  highContrast: event.displaySettings.highContrast,
                  showTeamColors: event.displaySettings.showTeamColors,
                  showTimerOnQuestion: inputEvent.target.checked,
                })
              }
            />
            Show timer on questions
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-3">
        <h2 className="text-lg font-semibold text-white">Import and Export Foundation</h2>
        <p className="text-sm text-slate-300">Import/export for trivia packs is operational with JSON payloads.</p>
        <div className="flex flex-wrap gap-2">
          <button onClick={handleExport} className="rounded-lg bg-slate-700 hover:bg-slate-600 px-3 py-2 text-xs text-white">Copy Event JSON</button>
          <button onClick={handleImport} className="rounded-lg bg-cyan-700 hover:bg-cyan-600 px-3 py-2 text-xs text-white">Import JSON Payload</button>
        </div>
        <textarea
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Paste JSON array of trivia events for import"
          className="w-full min-h-[130px] rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-xs text-white"
        />
        {importMessage ? <p className="text-xs text-cyan-200">{importMessage}</p> : null}
      </section>

      <section className="rounded-2xl border border-slate-700 bg-slate-900/70 p-4 space-y-2">
        <h2 className="text-lg font-semibold text-white">Live Event Flow Checklist</h2>
        <p className="text-sm text-slate-300">Use this sequence before and during each live run.</p>
        <ol className="list-decimal pl-5 text-xs text-slate-200 space-y-1">
          <li>Create or open event workspace.</li>
          <li>Add and verify teams (names, colors, active status).</li>
          <li>Add rounds with round type tags.</li>
          <li>Add questions and scoring answers.</li>
          <li>Populate audience reveal answers and reveal text.</li>
          <li>Review accepted alternate answers for each question.</li>
          <li>Set time limits and point values.</li>
          <li>Set scoring and display rules.</li>
          <li>Open host panel in one window.</li>
          <li>Pop out projector display.</li>
          <li>Run welcome screen then round intro.</li>
          <li>Cycle question and timer stages.</li>
          <li>Reveal answer and explanation.</li>
          <li>Apply score actions and verify history.</li>
          <li>Show leaderboard between rounds.</li>
          <li>Run final question or tiebreaker when needed.</li>
          <li>Show winner screen and mark event completed.</li>
        </ol>
      </section>

      <FeatureInProgressNotice
        label="Printable host sheets and printable answer keys"
        detail="These exports are planned in the next implementation milestone."
      />
    </section>
  );
}
