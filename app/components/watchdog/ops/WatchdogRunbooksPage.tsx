// Recovery runbooks dashboard for Watchdog operators.
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWatchdogRunbooks } from "@/app/components/watchdog/ops/api";
import StatusChip from "@/app/components/watchdog/ops/StatusChip";
import WatchdogPageHeader from "@/app/components/watchdog/ops/WatchdogPageHeader";
import type { WatchdogRunbooksResponse } from "@/app/components/watchdog/ops/types";

/** Renders operational runbook catalog with safety guidance and verification checklists. */
export default function WatchdogRunbooksPage() {
  const [data, setData] = useState<WatchdogRunbooksResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWatchdogRunbooks();
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load runbooks.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [load]);

  return (
    <div className="space-y-5">
      <WatchdogPageHeader
        title="Runbooks"
        description="Human-readable recovery instructions for backup, restore, privacy incidents, and emergency operations."
        actions={(
          <button
            type="button"
            onClick={() => void load()}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        )}
      />

      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading runbooks...</div>
      ) : null}

      {!loading && data ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Runbook Catalog</h2>
              <StatusChip status={data.status} />
            </div>
            <p className="mt-2 text-sm text-slate-700">{data.note}</p>
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            {data.items.map((runbook) => (
              <article key={runbook.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-slate-900">{runbook.title}</h3>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">{runbook.lastReviewedDate}</span>
                </div>
                <p className="mt-2 text-sm text-slate-700"><span className="font-semibold">Purpose:</span> {runbook.purpose}</p>
                <p className="mt-1 text-sm text-slate-700"><span className="font-semibold">When To Use:</span> {runbook.whenToUse}</p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Required Permissions</p>
                    <ul className="mt-1 space-y-1 text-xs text-slate-700">
                      {runbook.requiredPermissions.map((permission) => (
                        <li key={permission}>- {permission}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Warnings</p>
                    <ul className="mt-1 space-y-1 text-xs text-amber-800">
                      {runbook.warnings.map((warning) => (
                        <li key={warning}>- {warning}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Steps</p>
                  <ol className="mt-1 list-decimal space-y-1 pl-4 text-sm text-slate-700">
                    {runbook.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                </div>

                <div className="mt-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Verification Checklist</p>
                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                    {runbook.verificationChecklist.map((item) => (
                      <li key={item}>- {item}</li>
                    ))}
                  </ul>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Related Vault Categories</p>
                    <p className="mt-1 text-xs text-slate-700">{runbook.relatedVaultCategories.join(", ")}</p>
                  </div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Related Backup Policies</p>
                    <p className="mt-1 text-xs text-slate-700">{runbook.relatedBackupPolicies.join(", ")}</p>
                  </div>
                </div>
              </article>
            ))}
          </section>
        </>
      ) : null}
    </div>
  );
}
