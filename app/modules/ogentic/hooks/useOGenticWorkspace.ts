/** useOGenticWorkspace resolves module context and incoming Steward handoff payloads for OGentic. */
"use client";

import { useEffect, useState } from "react";
import type { StewardToOGenticHandoff } from "@/app/modules/ogentic/types/ogentic.types";

const OGENTIC_HANDOFF_KEY = "ogentic-handoff:v1";

/** useOGenticWorkspace loads one-shot handoff context from Steward into OGentic. */
export function useOGenticWorkspace() {
  const [handoff, setHandoff] = useState<StewardToOGenticHandoff | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const timer = window.setTimeout(() => {
      try {
        const raw = window.sessionStorage.getItem(OGENTIC_HANDOFF_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw) as StewardToOGenticHandoff;
        setHandoff(parsed);
      } catch {
        setHandoff(null);
      }
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  return {
    handoff,
  };
}
