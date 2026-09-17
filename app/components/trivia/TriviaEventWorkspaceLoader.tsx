"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTriviaModuleState } from "@/app/apps/trivia/hooks/useTriviaModuleState";
import TriviaOverviewWorkspace from "@/app/components/trivia/ops/TriviaOverviewWorkspace";
import TriviaPrintablesWorkspace from "@/app/components/trivia/ops/TriviaPrintablesWorkspace";
import TriviaCheckInWorkspace from "@/app/components/trivia/ops/TriviaCheckInWorkspace";
import TriviaJudgeWorkspace from "@/app/components/trivia/ops/TriviaJudgeWorkspace";
import TriviaScoreboardWorkspace from "@/app/components/trivia/ops/TriviaScoreboardWorkspace";
import TriviaRecoveryWorkspace from "@/app/components/trivia/ops/TriviaRecoveryWorkspace";
import { findTriviaEventForRoute } from "@/app/apps/trivia/lib/trivia-selectors";

type View = "overview" | "printables" | "check-in" | "judge" | "scoreboard" | "recovery";

/** Shared route bridge so every sidebar operations link resolves to its functional workspace. */
export default function TriviaEventWorkspaceLoader({ eventId, view }: { eventId: string; view: View }) {
  const api = useTriviaModuleState();
  const apiRef = useRef(api);
  const [loadError, setLoadError] = useState<string | null>(null);
  useEffect(() => { apiRef.current = api; });
  const event = useMemo(() => findTriviaEventForRoute(api.state.events, eventId), [api.state.events, eventId]);
  const live = event ? api.state.liveByEventId[event.id] : null;
  const scoreHistory = event ? api.state.scoreHistoryByEventId[event.id] ?? [] : [];
  const resolvedEventId = event?.id;
  useEffect(() => {
    if (!resolvedEventId || view !== "recovery") return;
    let active = true;
    setLoadError(null);
    void Promise.all([apiRef.current.loadEventSnapshots(resolvedEventId), apiRef.current.loadEventAudit(resolvedEventId)])
      .catch((error: unknown) => { if (active) setLoadError(error instanceof Error ? error.message : "Unable to load recovery history."); });
    return () => { active = false; };
  }, [resolvedEventId, view, api.syncMode]);
  if (!event || !live) return <section className="rounded-xl border border-slate-200 bg-white p-5 text-sm" role="status">
    {api.connectionStatus === "reconnecting" ? "Loading trivia event…" : api.syncError ?? "Trivia event unavailable. Open the event overview to check its configuration."}
    {api.connectionStatus !== "reconnecting" ? <button type="button" className="ml-3 font-semibold text-blue-700 underline" onClick={() => void api.refreshFromServer()}>Retry</button> : null}
  </section>;
  if (view === "overview") return <TriviaOverviewWorkspace event={event} live={live} scoreHistory={scoreHistory} onRefreshFromServer={api.refreshFromServer} />;
  if (view === "printables") return <TriviaPrintablesWorkspace event={event} live={live} scoreHistory={scoreHistory} />;
  if (view === "check-in") return <TriviaCheckInWorkspace event={event} live={live} scoreHistory={scoreHistory} onAddWalkInTeam={(name, players) => api.addTeam(event.id, { name, players })} onUpdateTeam={(teamId, updates) => api.updateTeam(event.id, teamId, updates)} onRemoveTeam={(teamId) => api.removeTeam(event.id, teamId)} />;
  if (view === "judge") return <TriviaJudgeWorkspace event={event} live={live} scoreHistory={scoreHistory} onApplyScore={(payload) => api.applyScoreAction(event.id, payload)} />;
  if (view === "scoreboard") return <TriviaScoreboardWorkspace event={event} live={live} scoreHistory={scoreHistory} onUndoLast={() => api.undoLastScoreAction(event.id)} onUndoAction={(actionId) => api.undoScoreActionById(event.id, actionId)} />;
  return <>{loadError ? <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</p> : null}<TriviaRecoveryWorkspace event={event} live={live} scoreHistory={scoreHistory} syncMode={api.syncMode} connectionStatus={api.connectionStatus} lastSyncedAt={api.lastSyncedAt} syncError={api.syncError} snapshots={api.snapshotsByEventId[event.id] ?? []} auditEntries={api.auditByEventId[event.id] ?? []} onSetSyncMode={api.setSyncMode} onRefreshFromServer={api.refreshFromServer} onCreateSnapshot={(label) => api.createEventSnapshot(event.id, label)} onLoadSnapshots={() => api.loadEventSnapshots(event.id)} onRecoverSnapshot={(snapshotId) => api.recoverEventSnapshot(event.id, snapshotId)} onLoadAudit={() => api.loadEventAudit(event.id)} onExportState={api.exportStatePackage} onImportJson={api.importEventsFromJson} /></>;
}
