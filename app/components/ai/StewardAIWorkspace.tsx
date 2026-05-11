/** StewardAIWorkspace renders a full-page AI workspace for users who want an expanded Steward experience. */
"use client";

import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import StewardChatPanel from "@/app/components/ai/StewardChatPanel";

type ModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "hrm";

/** Resolves module query string into a safe module key with donor fallback. */
function resolveModuleKey(raw: string | null): ModuleKey {
  if (raw === "compassion") return "compassion";
  if (raw === "events") return "events";
  if (raw === "watchdog") return "watchdog";
  if (raw === "webmaster") return "webmaster";
  if (raw === "hrm") return "hrm";
  return "donor";
}

/** StewardAIWorkspace provides a full-page environment with docked chat and context summary. */
export default function StewardAIWorkspace() {
  const searchParams = useSearchParams();

  const moduleKey = useMemo(() => resolveModuleKey(searchParams.get("module")), [searchParams]);
  const scopePath = useMemo(
    () => searchParams.get("scope") || "/steward-ai-workspace",
    [searchParams]
  );

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      <header className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-green-50 px-5 py-4">
        <h1 className="text-xl font-semibold text-slate-900">StewardAIWorkspace</h1>
        <p className="mt-1 text-sm text-slate-600">
          Expanded Steward workspace for Ask, Analyze, Draft, Action, and Help workflows across your CRM.
        </p>
        <p className="mt-1 text-xs text-slate-500">
          Steward is the primary AI workspace for quick guidance and deep multi-step CRM workflows.
        </p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-emerald-200 bg-emerald-100/70 px-2.5 py-1 font-medium">
            Module: {moduleKey}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">
            Scope: {scopePath}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">
            Mode-aware retrieval enabled
          </span>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <StewardChatPanel
          open
          onClose={() => undefined}
          moduleKey={moduleKey}
          scopePath={scopePath}
          displayMode="workspace"
        />
      </div>
    </div>
  );
}
