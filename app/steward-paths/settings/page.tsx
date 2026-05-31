"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ProcessDueResult {
  scanned?: number;
  processed?: number;
  completed?: number;
  failed?: number;
  skipped?: number;
  [key: string]: unknown;
}

interface MigrationResult {
  importedCount: number;
  imported: Array<{ legacyAutomationId: string; stewardPathId: string }>;
}

export default function StewardPathsSettingsPage() {
  const [busyAction, setBusyAction] = useState<"process" | "migrate" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [processResult, setProcessResult] = useState<ProcessDueResult | null>(null);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  async function runProcessDue(): Promise<void> {
    setBusyAction("process");
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<ProcessDueResult>("/api/steward-paths/process-due", {
        method: "POST",
        body: JSON.stringify({ limit: 150 }),
      });
      setProcessResult(result ?? null);
      setNotice("Due-step processor run completed.");
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "Failed to run due-step processor.");
    } finally {
      setBusyAction(null);
    }
  }

  async function runLegacyMigration(): Promise<void> {
    setBusyAction("migrate");
    setError(null);
    setNotice(null);
    try {
      const result = await apiFetch<MigrationResult>("/api/steward-paths/migrations/automations", {
        method: "POST",
      });
      setMigrationResult(result ?? null);
      setNotice("Legacy automations migration completed.");
    } catch (migrationError) {
      setError(migrationError instanceof Error ? migrationError.message : "Failed to run legacy migration.");
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-[#f4f6f8] p-4 md:p-6 lg:p-7">
      <div className="mx-auto w-full max-w-[1100px] space-y-4">
        <header className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Settings</h1>
          <p className="mt-1 text-sm text-slate-600">Operational controls for Steward Paths processing and legacy migration utilities.</p>
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
          <h2 className="text-sm font-semibold text-slate-900">Legacy Migration</h2>
          <p className="mt-1 text-sm text-slate-600">Import legacy automations into Steward Paths templates using the compatibility migration endpoint.</p>
          <button
            type="button"
            onClick={() => void runLegacyMigration()}
            disabled={busyAction !== null}
            className="mt-3 inline-flex h-10 items-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            {busyAction === "migrate" ? "Migrating..." : "Run Legacy Automations Migration"}
          </button>
          {migrationResult ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-900">Imported Templates: {migrationResult.importedCount}</p>
              {migrationResult.imported.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs text-slate-600">
                  {migrationResult.imported.slice(0, 10).map((item) => (
                    <li key={`${item.legacyAutomationId}-${item.stewardPathId}`}>
                      Legacy {item.legacyAutomationId}{" -> "}New {item.stewardPathId}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
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
