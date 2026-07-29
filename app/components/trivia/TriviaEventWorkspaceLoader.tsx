"use client";

import { useEffect, useMemo } from "react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import TriviaOverviewWorkspace from "@/app/components/trivia/ops/TriviaOverviewWorkspace";
import TriviaPrintablesWorkspace from "@/app/components/trivia/ops/TriviaPrintablesWorkspace";
import TriviaCheckInWorkspace from "@/app/components/trivia/ops/TriviaCheckInWorkspace";
import TriviaJudgeWorkspace from "@/app/components/trivia/ops/TriviaJudgeWorkspace";
import TriviaScoreboardWorkspace from "@/app/components/trivia/ops/TriviaScoreboardWorkspace";
import TriviaRecoveryWorkspace from "@/app/components/trivia/ops/TriviaRecoveryWorkspace";

type View = "overview" | "printables" | "check-in" | "judge" | "scoreboard" | "recovery";

/** Shared route bridge so every sidebar operations link resolves to its functional workspace. */
export default function TriviaEventWorkspaceLoader({ eventId, view }: { eventId: string; view: View }) {
  const api = useTriviaModuleState();
  const event = useMemo(() => api.state.events.find((item) => item.id === eventId) ?? null, [api.state.events, eventId]);
  const live = event ? api.state.liveByEventId[event.id] : null;
  const scoreHistory = event ? api.state.scoreHistoryByEventId[event.id] ?? [] : [];
  useEffect(() => { if (event && view === "recovery") { void api.loadEventSnapshots(event.id); void api.loadEventAudit(event.id); } }, [api, event, view]);
  if (!event || !live) return <section className="border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-800">Event not found. Open an event from the Trivia events list.</section>;
  if (view === "overview") return <TriviaOverviewWorkspace event={event} live={live} scoreHistory={scoreHistory} />;
  if (view === "printables") return <TriviaPrintablesWorkspace event={event} live={live} scoreHistory={scoreHistory} />;
  if (view === "check-in") return <TriviaCheckInWorkspace event={event} live={live} scoreHistory={scoreHistory} onAddWalkInTeam={(name, players) => api.addTeam(event.id, { name, players })} onUpdateTeam={(teamId, updates) => api.updateTeam(event.id, teamId, updates)} onRemoveTeam={(teamId) => api.removeTeam(event.id, teamId)} />;
  if (view === "judge") return <TriviaJudgeWorkspace event={event} live={live} scoreHistory={scoreHistory} onApplyScore={(payload) => api.applyScoreAction(event.id, payload)} />;
  if (view === "scoreboard") return <TriviaScoreboardWorkspace event={event} live={live} scoreHistory={scoreHistory} onUndoLast={() => api.undoLastScoreAction(event.id)} onUndoAction={(actionId) => api.undoScoreActionById(event.id, actionId)} />;
  return <TriviaRecoveryWorkspace event={event} live={live} scoreHistory={scoreHistory} syncMode={api.syncMode} connectionStatus={api.connectionStatus} lastSyncedAt={api.lastSyncedAt} syncError={api.syncError} snapshots={api.snapshotsByEventId[event.id] ?? []} auditEntries={api.auditByEventId[event.id] ?? []} onSetSyncMode={api.setSyncMode} onRefreshFromServer={api.refreshFromServer} onCreateSnapshot={(label) => api.createEventSnapshot(event.id, label)} onLoadSnapshots={() => api.loadEventSnapshots(event.id)} onRecoverSnapshot={(snapshotId) => api.recoverEventSnapshot(event.id, snapshotId)} onLoadAudit={() => api.loadEventAudit(event.id)} onExportState={api.exportStatePackage} onImportJson={api.importEventsFromJson} />;
}
