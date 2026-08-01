"use client";

import { useState } from "react";
import { stewardPathsApi } from "@/app/lib/steward-paths-api";

interface ProcessDueResult {
  scanned?: number;
  processed?: number;
  completed?: number;
  failed?: number;
  skipped?: number;
  [key: string]: unknown;
}

export default function StewardPathsSettingsPage() {
  const [busyAction, setBusyAction] = useState<"process" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<ProcessDueResult | null>(null);

  async function runProcessDue(): Promise<void> {
    setBusyAction("process");
    setError(null);
    setNotice(null);
    try {
      const result = await stewardPathsApi.runDueSteps<ProcessDueResult>();
      setProcessResult(result ?? null);
      setNotice("Due-step processor run completed.");
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Failed to run due-step processor.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f4f6f8] p-4 md:p-6 lg:p-7">
      <div className="mx-auto w-full max-w-[1100px] space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Operational controls for safe Steward Paths processing.</p>
        </header>

        {notice ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{notice}</div> : null}
        {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</div> : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Runtime Processing</h2>
          <p className="mt-1 text-sm text-slate-600">Manually process due enrollment steps using the same guarded server path used by worker scans.</p>
          <button
            type="button"
            onClick={() => void runProcessDue()}
            disabled={busyAction !== null}
            className="mt-3 inline-flex h-10 items-center rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
          >
            {busyAction === "process" ? "Running Processor..." : "Run Due-Step Processor"}
          </button>
          {processResult ? (
            <pre className="mt-3 overflow-x-auto rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">{JSON.stringify(processResult, null, 2)}</pre>
          ) : null}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Safety Defaults</h2>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            <li>Email actions remain draft-first and review-first by default.</li>
            <li>Activation decisions should pass through the Review queue before production use.</li>
            <li>Use Enrollments and Activity pages for audit-friendly verification after status changes.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
