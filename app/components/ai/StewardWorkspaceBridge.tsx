/** Routes contextual Steward events to the dedicated workspace without a floating launcher. */
"use client";

import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { STEWARD_OPEN_EVENT, type StewardOpenPromptDetail } from "@/app/lib/steward-context";

type StewardModuleKey = "donor" | "events" | "watchdog" | "webmaster" | "all";


function normalizeStewardModule(moduleKey?: string): StewardModuleKey {
  const valid = new Set<StewardModuleKey>(["donor", "events", "watchdog", "webmaster", "all"]);
  return moduleKey && valid.has(moduleKey as StewardModuleKey) ? moduleKey as StewardModuleKey : "donor";
}

/** Builds a workspace URL while retaining the page context that prompted the request. */
function stewardWorkspaceHref(moduleKey: StewardModuleKey, scopePath: string, detail?: StewardOpenPromptDetail | null) {
  const params = new URLSearchParams({ module: moduleKey, scope: scopePath });
  if (detail?.prompt?.trim()) params.set("prompt", detail.prompt.trim());
  if (detail?.mode) params.set("mode", detail.mode);
  return `/steward-ai-workspace?${params.toString()}`;
}

/** Nonvisual bridge preserving existing inline contextual actions. */
export default function StewardWorkspaceBridge({ moduleKey }: {moduleKey?: string}) {
  const router = useRouter();
  const openWorkspace = useCallback((detail?: StewardOpenPromptDetail | null) => {
    const resolvedModule = normalizeStewardModule(detail?.moduleKey ?? moduleKey);
    const currentScope = `${window.location.pathname}${window.location.search}`;
    router.push(stewardWorkspaceHref(resolvedModule, currentScope || "/", detail));
  }, [moduleKey, router]);

  useEffect(() => {
    const handleOpenWithPrompt = (event: Event) => {
      const detail = (event as CustomEvent<StewardOpenPromptDetail>).detail;
      if (detail?.prompt) openWorkspace(detail);
    };
    window.addEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
    return () => window.removeEventListener(STEWARD_OPEN_EVENT, handleOpenWithPrompt);
  }, [openWorkspace]);

  return null;
}
