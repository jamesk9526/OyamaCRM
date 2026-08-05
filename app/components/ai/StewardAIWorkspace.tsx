/** StewardAIWorkspace — route shell for the focused Copilot chat workspace. */
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import StewardCopilotWorkspace from "@/app/components/ai/StewardCopilotWorkspace";

type ModuleKey = "donor" | "events" | "watchdog" | "webmaster" | "all";
type ChatMode = "ask" | "analyze" | "draft" | "agentic" | "action" | "help";

function resolveModuleKey(raw: string | null): ModuleKey {
  if (raw === "events" || raw === "watchdog" || raw === "webmaster" || raw === "all") return raw;
  return "donor";
}

function resolveMode(raw: string | null): ChatMode | undefined {
  return raw === "ask" || raw === "analyze" || raw === "draft" || raw === "agentic" || raw === "action" || raw === "help" ? raw : undefined;
}

/** Reads launcher context and passes it to the dedicated Steward workspace. */
export default function StewardAIWorkspace() {
  const searchParams = useSearchParams();
  const initialModule = useMemo(() => resolveModuleKey(searchParams.get("module")), [searchParams]);
  const initialThreadId = useMemo(() => searchParams.get("thread") || undefined, [searchParams]);
  const initialPrompt = useMemo(() => searchParams.get("prompt") || undefined, [searchParams]);
  const initialMode = useMemo(() => resolveMode(searchParams.get("mode")), [searchParams]);
  const initialScopePath = useMemo(() => {
    const scope = searchParams.get("scope");
    return scope?.startsWith("/") ? scope : "/";
  }, [searchParams]);

  return <div className="h-[calc(100dvh-7rem)] min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
    <StewardCopilotWorkspace initialModule={initialModule} initialThreadId={initialThreadId} initialScopePath={initialScopePath} initialPrompt={initialPrompt} initialMode={initialMode} />
  </div>;
}
