// Security and permission monitoring dashboard for Watchdog.
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchWatchdogSecuritySummary } from "@/app/components/watchdog/ops/api";
import StatusChip from "@/app/components/watchdog/ops/StatusChip";
import WatchdogPageHeader from "@/app/components/watchdog/ops/WatchdogPageHeader";
import type { WatchdogSecuritySummary } from "@/app/components/watchdog/ops/types";

/** Renders permission risk, boundary warnings, and security check summaries. */
export default function WatchdogSecurityPage() {
  const [data, setData] = useState<WatchdogSecuritySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWatchdogSecuritySummary();
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load security dashboard.");
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
        title="Security Review"
        description="Permission risk visibility, boundary checks, and credential risk telemetry."
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
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading security summary...</div>
      ) : null}

      {!loading && data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Permission Risks</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.permissionRisks}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Failed Logins (24h)</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.recentFailedLogins}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Suspicious Access</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.suspiciousAccess}</p>
            </article>
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Secrets Needing Rotation</p>
              <p className="mt-2 text-2xl font-semibold text-slate-900">{data.summary.secretsNeedingRotation}</p>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Security Checks</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Check</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2">Detail</th>
                  </tr>
                </thead>
                <tbody>
                  {data.checks.map((check) => (
                    <tr key={check.key} className="border-b border-slate-100">
                      <td className="py-2 pr-3 text-slate-900">{check.label}</td>
                      <td className="py-2 pr-3"><StatusChip status={check.status} /></td>
                      <td className="py-2 text-slate-700">{check.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">Boundary & Encryption Signals</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Backup Encryption</p>
                <div className="mt-1"><StatusChip status={data.summary.backupEncryptionStatus} /></div>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Vault State</p>
                <div className="mt-1"><StatusChip status={data.summary.vaultState} /></div>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Workspace Boundary Warnings</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{data.summary.workspaceBoundaryWarnings}</p>
              </article>
              <article className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Donor/Client Privacy Warnings</p>
                <p className="mt-1 text-lg font-semibold text-slate-900">{data.summary.privacyBoundaryWarnings}</p>
              </article>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
