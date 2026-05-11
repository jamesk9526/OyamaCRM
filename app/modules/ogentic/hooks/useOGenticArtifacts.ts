/** useOGenticArtifacts provides local artifact state for OGentic development scaffolding. */
"use client";

import { useEffect, useState } from "react";
import {
  createLocalOGenticArtifact,
  readLocalOGenticArtifacts,
  writeLocalOGenticArtifacts,
} from "@/app/modules/ogentic/services/ogenticArtifactService";
import type { OGenticArtifact } from "@/app/modules/ogentic/types/ogentic.types";

/** useOGenticArtifacts manages artifact list state with local-only persistence. */
export function useOGenticArtifacts() {
  const [artifacts, setArtifacts] = useState<OGenticArtifact[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setArtifacts(readLocalOGenticArtifacts());
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    writeLocalOGenticArtifacts(artifacts);
  }, [artifacts]);

  /** Adds an artifact placeholder entry and returns the created artifact id. */
  function addArtifact(type: OGenticArtifact["type"], title: string, content: unknown) {
    const created = createLocalOGenticArtifact(type, title, content);
    setArtifacts((current) => [created, ...current]);
    return created.id;
  }

  return {
    artifacts,
    addArtifact,
  };
}
