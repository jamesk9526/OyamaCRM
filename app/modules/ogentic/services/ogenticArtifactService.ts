/** OGentic artifact service handles local-only draft persistence for development scaffolding. */

import type { OGenticArtifact } from "@/app/modules/ogentic/types/ogentic.types";

const OGENTIC_ARTIFACT_STORAGE_KEY = "ogentic-artifacts:v1";

/** Reads locally persisted OGentic artifacts from browser storage. */
export function readLocalOGenticArtifacts(): OGenticArtifact[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(OGENTIC_ARTIFACT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed as OGenticArtifact[] : [];
  } catch {
    return [];
  }
}

/** Writes OGentic artifacts to local browser storage for development-only persistence. */
export function writeLocalOGenticArtifacts(artifacts: OGenticArtifact[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OGENTIC_ARTIFACT_STORAGE_KEY, JSON.stringify(artifacts));
}

/** Creates a new local artifact shell entry. // TODO: backend API needed */
export function createLocalOGenticArtifact(type: OGenticArtifact["type"], title: string, content: unknown): OGenticArtifact {
  const timestamp = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    type,
    title,
    status: "draft",
    content,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}
