/** StewardAIWorkspace — thin shell that mounts the full AGENTSteward chat workspace. */
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import AGENTStewardWorkspace from "@/app/components/ai/AGENTStewardWorkspace";

type ModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "hrm" | "all";

function resolveModuleKey(raw: string | null): ModuleKey {
  if (raw === "compassion") return "compassion";
  if (raw === "events")     return "events";
  if (raw === "watchdog")   return "watchdog";
  if (raw === "webmaster")  return "webmaster";
  if (raw === "hrm")        return "hrm";
  if (raw === "all")        return "all";
  return "donor";
}

/** StewardAIWorkspace provides the AGENTSteward full-page workspace via URL module param. */
export default function StewardAIWorkspace() {
  const searchParams = useSearchParams();
  const initialModule = useMemo(() => resolveModuleKey(searchParams.get("module")), [searchParams]);
  const initialThreadId = useMemo(() => searchParams.get("thread") || undefined, [searchParams]);

  return (
    <div className="h-full min-h-0 overflow-hidden">
      <AGENTStewardWorkspace initialModule={initialModule} initialThreadId={initialThreadId} />
    </div>
  );
}
