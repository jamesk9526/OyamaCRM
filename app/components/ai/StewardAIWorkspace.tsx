/** StewardAIWorkspace — route shell for the focused Copilot chat workspace. */
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import StewardCopilotWorkspace from "@/app/components/ai/StewardCopilotWorkspace";

type ModuleKey = "donor" | "events" | "watchdog" | "webmaster" | "all";

function resolveModuleKey(raw: string | null): ModuleKey {
  if (raw === "events")     return "events";
  if (raw === "watchdog")   return "watchdog";
  if (raw === "webmaster")  return "webmaster";
  if (raw === "all")        return "all";
  return "donor";
}

/** StewardAIWorkspace provides the Copilot workspace via URL module param. */
export default function StewardAIWorkspace() {
  const searchParams = useSearchParams();
  const initialModule = useMemo(() => resolveModuleKey(searchParams.get("module")), [searchParams]);
  const initialThreadId = useMemo(() => searchParams.get("thread") || undefined, [searchParams]);
  const initialScopePath = useMemo(() => {
    const scope = searchParams.get("scope");
    return scope?.startsWith("/") ? scope : "/";
  }, [searchParams]);

  return (
    <div className="h-[calc(100dvh-7rem)] min-h-[560px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <StewardCopilotWorkspace initialModule={initialModule} initialThreadId={initialThreadId} initialScopePath={initialScopePath} />
    </div>
  );
}
