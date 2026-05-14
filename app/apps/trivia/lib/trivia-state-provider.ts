// Trivia state provider adapters for local-only mode and server-backed mode.

import type {
  TriviaEventAuditEvent,
  TriviaEventSnapshot,
  TriviaModuleState,
} from "@/app/apps/trivia/lib/trivia-types";
import { apiFetch } from "@/app/lib/auth-client";

export type TriviaSyncMode = "local" | "server";

const TRIVIA_SYNC_MODE_KEY = "oyama.trivia.sync.mode.v1";

interface ServerStateEnvelope {
  state: TriviaModuleState;
  updatedAt: string;
}

interface SnapshotListEnvelope {
  snapshots: TriviaEventSnapshot[];
}

interface SnapshotCreateEnvelope {
  snapshot: TriviaEventSnapshot;
}

interface AuditListEnvelope {
  audit: TriviaEventAuditEvent[];
}

interface RecoverEnvelope {
  state: TriviaModuleState;
  recoveredSnapshotId: string;
}

/** Reads persisted sync mode preference for trivia state operations. */
export function readTriviaSyncMode(): TriviaSyncMode {
  if (typeof window === "undefined") return "local";
  const raw = window.localStorage.getItem(TRIVIA_SYNC_MODE_KEY);
  return raw === "server" ? "server" : "local";
}

/** Persists sync mode preference so operations pages can survive reloads. */
export function writeTriviaSyncMode(mode: TriviaSyncMode): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRIVIA_SYNC_MODE_KEY, mode);
}

/** Loads module state from server-backed trivia persistence. */
export async function loadServerTriviaState(): Promise<ServerStateEnvelope> {
  return apiFetch<ServerStateEnvelope>("/api/apps/trivia/state");
}

/** Saves full module state to server-backed trivia persistence. */
export async function saveServerTriviaState(state: TriviaModuleState): Promise<ServerStateEnvelope> {
  return apiFetch<ServerStateEnvelope>("/api/apps/trivia/state", {
    method: "PUT",
    body: JSON.stringify({ state }),
  });
}

/** Creates a server-side snapshot for one event. */
export async function createServerTriviaSnapshot(eventId: string, label?: string): Promise<TriviaEventSnapshot> {
  const result = await apiFetch<SnapshotCreateEnvelope>(`/api/apps/trivia/events/${eventId}/snapshot`, {
    method: "POST",
    body: JSON.stringify({ label: label?.trim() || undefined }),
  });
  return result.snapshot;
}

/** Lists available server-side snapshots for one event. */
export async function listServerTriviaSnapshots(eventId: string): Promise<TriviaEventSnapshot[]> {
  const result = await apiFetch<SnapshotListEnvelope>(`/api/apps/trivia/events/${eventId}/snapshots`);
  return Array.isArray(result.snapshots) ? result.snapshots : [];
}

/** Restores one event from a server-side snapshot and returns latest full state. */
export async function recoverServerTriviaSnapshot(eventId: string, snapshotId: string): Promise<RecoverEnvelope> {
  return apiFetch<RecoverEnvelope>(`/api/apps/trivia/events/${eventId}/recover`, {
    method: "POST",
    body: JSON.stringify({ snapshotId }),
  });
}

/** Returns audit entries for score/check-in/recovery activity for one event. */
export async function listServerTriviaAudit(eventId: string): Promise<TriviaEventAuditEvent[]> {
  const result = await apiFetch<AuditListEnvelope>(`/api/apps/trivia/events/${eventId}/audit`);
  return Array.isArray(result.audit) ? result.audit : [];
}
