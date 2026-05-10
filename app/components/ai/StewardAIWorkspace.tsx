/** StewardAIWorkspace renders a full-page AI workspace for users who want an expanded Steward experience. */
"use client";

import { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import StewardChatPanel, { type StewardTraceSnapshot } from "@/app/components/ai/StewardChatPanel";

type ModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster";

/** Resolves module query string into a safe module key with donor fallback. */
function resolveModuleKey(raw: string | null): ModuleKey {
  if (raw === "compassion") return "compassion";
  if (raw === "events") return "events";
  if (raw === "watchdog") return "watchdog";
  if (raw === "webmaster") return "webmaster";
  return "donor";
}

/** StewardAIWorkspace provides a full-page environment with docked chat and context summary. */
export default function StewardAIWorkspace() {
  const searchParams = useSearchParams();
  const [traceLog, setTraceLog] = useState<StewardTraceSnapshot[]>([]);

  const moduleKey = useMemo(() => resolveModuleKey(searchParams.get("module")), [searchParams]);
  const scopePath = useMemo(
    () => searchParams.get("scope") || "/steward-ai-workspace",
    [searchParams]
  );

  const latestTrace = traceLog[0] ?? null;

  /** Captures a bounded trace timeline for the analyst context panel. */
  function handleTraceUpdate(trace: StewardTraceSnapshot) {
    setTraceLog((current) => [trace, ...current.filter((item) => item.id !== trace.id)].slice(0, 30));
  }

  return (
    <div className="space-y-5 h-full">
      <header className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-green-50 px-5 py-4">
        <h1 className="text-xl font-semibold text-slate-900">StewardAIWorkspace</h1>
        <p className="text-sm text-slate-600 mt-1">
          Dedicated AI workspace for Ask, Analyze, Draft, Action, and Help workflows across your CRM.
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

      <div className="grid grid-cols-1 xl:grid-cols-[300px_minmax(0,1fr)] gap-4 h-full">
        <aside className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
          <section>
            <h2 className="text-sm font-semibold text-slate-900">Current Scope</h2>
            <p className="text-xs text-slate-500 mt-1">Steward is currently constrained to this workspace context.</p>
            <div className="mt-3 space-y-2 text-xs text-slate-700">
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                <span className="font-medium">Module:</span> {moduleKey}
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 break-all">
                <span className="font-medium">Scope:</span> {scopePath}
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Records Used</h3>
            <p className="text-xs text-slate-500 mt-1">Latest retrieved records for analyst validation.</p>
            <div className="mt-2 space-y-1.5">
              {latestTrace?.recordsUsed && latestTrace.recordsUsed.length > 0 ? (
                latestTrace.recordsUsed.slice(0, 10).map((record) => (
                  <p key={record} className="text-xs text-slate-700 rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
                    {record}
                  </p>
                ))
              ) : (
                <p className="text-xs text-slate-500 rounded-md border border-dashed border-slate-300 px-2 py-2">
                  No records traced yet. Ask Steward a question to populate context.
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold text-slate-900">Tool Trace</h3>
            <p className="text-xs text-slate-500 mt-1">Recent tool and model usage for auditability.</p>
            <div className="mt-2 space-y-2 max-h-[320px] overflow-y-auto pr-1">
              {traceLog.length > 0 ? (
                traceLog.map((trace) => (
                  <article key={trace.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <p className="text-[11px] text-slate-500">
                      {new Date(trace.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {trace.mode.toUpperCase()}
                    </p>
                    <p className="text-xs font-medium text-slate-700 mt-1">
                      {trace.provider} · {trace.model}
                    </p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {trace.toolsUsed.slice(0, 4).map((tool) => (
                        <span key={`${trace.id}-${tool}`} className="rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                          {tool}
                        </span>
                      ))}
                    </div>
                  </article>
                ))
              ) : (
                <p className="text-xs text-slate-500 rounded-md border border-dashed border-slate-300 px-2 py-2">
                  Tool trace appears after the first assistant response.
                </p>
              )}
            </div>
          </section>
        </aside>

        <StewardChatPanel
          open
          onClose={() => undefined}
          moduleKey={moduleKey}
          scopePath={scopePath}
          displayMode="workspace"
          onTraceUpdate={handleTraceUpdate}
        />
      </div>
    </div>
  );
}
