// Dedicated visual authoring route for a single Trivia event.
"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import TeamManagerPanel from "@/app/components/trivia/TeamManagerPanel";
import TriviaGameMap from "@/app/components/trivia/TriviaGameMap";
import TriviaGameTemplateLibrary from "@/app/components/trivia/TriviaGameTemplateLibrary";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";

/** Keeps the authoring experience visual while moving secondary setup out of the game canvas. */
export default function TriviaEventBuilderPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const {
    state, addTeam, updateTeam, reorderTeam, removeTeam, addRound, addQuestion, updateQuestion, duplicateQuestion, removeQuestion, updateRound, removeRound, updateWelcomeScreen,
    reorderRound, moveQuestion, applyGameTemplate, importEventsFromJson,
  } = useTriviaModuleState();
  const [importText, setImportText] = useState("");
  const [importMessage, setImportMessage] = useState("");
  const event = useMemo(() => state.events.find((item) => item.id === eventId) ?? null, [eventId, state.events]);

  if (!event) return <section className="border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">Event not found. Return to the event list to choose or create a trivia event.</section>;

  function copyEventPackage() {
    navigator.clipboard.writeText(JSON.stringify([event], null, 2))
      .then(() => setImportMessage("Event JSON copied. Save it as a game backup."))
      .catch(() => setImportMessage("Copy failed. Select and copy the event data manually."));
  }

  return (
    <section className="trivia-builder-page space-y-5">
      <TriviaGameMap
        event={event}
        onAddRound={(title, description, roundType) => addRound(event.id, { title, description, roundType })}
        onAddQuestion={(roundId, question) => addQuestion(event.id, roundId, question)}
        onUpdateQuestion={(roundId, questionId, updates) => updateQuestion(event.id, roundId, questionId, updates)}
        onDuplicateQuestion={(roundId, questionId) => duplicateQuestion(event.id, roundId, questionId)}
        onRemoveQuestion={(roundId, questionId) => removeQuestion(event.id, roundId, questionId)}
        onUpdateRound={(roundId, updates) => updateRound(event.id, roundId, updates)}
        onRemoveRound={(roundId) => removeRound(event.id, roundId)}
        onUpdateWelcome={(updates) => updateWelcomeScreen(event.id, updates)}
        onReorderRound={(roundId, targetRoundId) => reorderRound(event.id, roundId, targetRoundId)}
        onMoveQuestion={(questionId, sourceRoundId, targetRoundId, targetIndex) => moveQuestion(event.id, questionId, sourceRoundId, targetRoundId, targetIndex)}
      />

      <details className="trivia-builder-advanced">
        <summary><span><strong>Event setup and backups</strong><small>Templates, team roster, and a portable game backup.</small></span><span>⌄</span></summary>
        <div className="grid gap-5 p-5 xl:grid-cols-2">
          <TriviaGameTemplateLibrary event={event} onApply={(template) => applyGameTemplate(event.id, template)} />
          <TeamManagerPanel
            teams={event.teams}
            onAddTeam={(name, players, color, icon) => addTeam(event.id, { name, players, color, icon })}
            onUpdateTeam={(teamId, updates) => updateTeam(event.id, teamId, updates)}
            onReorderTeam={(teamId, direction) => reorderTeam(event.id, teamId, direction)}
            onRemoveTeam={(teamId) => removeTeam(event.id, teamId)}
          />
          <div className="trivia-builder-backup xl:col-span-2"><div><p>Data tools</p><h2>Bring a game plan with you</h2><span>Copy a single-event backup, or import a prepared JSON game package.</span></div><div className="flex flex-wrap gap-2"><button type="button" onClick={copyEventPackage}>Copy event JSON</button><button type="button" onClick={() => setImportMessage(importEventsFromJson(importText).message)}>Import JSON</button></div><textarea value={importText} onChange={(input) => setImportText(input.target.value)} placeholder="Paste a trivia event JSON package to import" />{importMessage ? <p>{importMessage}</p> : null}</div>
        </div>
      </details>
    </section>
  );
}
