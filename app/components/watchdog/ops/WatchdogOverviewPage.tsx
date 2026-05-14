// Main power-user dashboard for OyamaWatchdog operations CRM.
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { fetchWatchdogOverview } from "@/app/components/watchdog/ops/api";
import StatusChip from "@/app/components/watchdog/ops/StatusChip";
import WatchdogPageHeader from "@/app/components/watchdog/ops/WatchdogPageHeader";
import type { WatchdogOverviewResponse } from "@/app/components/watchdog/ops/types";

/** Renders the central Watchdog command dashboard with actionable operations summary. */
export default function WatchdogOverviewPage() {
  const [data, setData] = useState<WatchdogOverviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchWatchdogOverview();
      setData(response);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load Watchdog overview.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void load();
    }, 0);
    return () => {
      window.clearTimeout(handle);
    };
  }, [load]);

  const cards = data ? [
    { label: "System Health", value: data.overview.systemHealth, tone: "status" as const },
    { label: "Backup Verification", value: String(data.overview.backupVerificationStatus), tone: "text" as const },
    { label: "Restore Readiness", value: `${data.overview.restoreReadinessScore}%`, tone: "text" as const },
    { label: "Open Incidents", value: String(data.overview.openIncidents), tone: "number" as const },
    { label: "Failed Jobs", value: String(data.overview.failedJobs), tone: "number" as const },
    { label: "Security Warnings", value: String(data.overview.securityWarnings), tone: "number" as const },
    { label: "Vault Health", value: data.overview.vaultHealth, tone: "status" as const },
    { label: "Permission Risks", value: String(data.overview.permissionRiskWarnings), tone: "number" as const },
    { label: "Database Status", value: data.overview.databaseStatus, tone: "status" as const },
    { label: "Storage Status", value: data.overview.storageStatus, tone: "status" as const },
    { label: "Environment Status", value: data.overview.environmentStatus, tone: "status" as const },
    { label: "Background Jobs", value: data.overview.backgroundJobStatus, tone: "status" as const },
  ] : [];

  return (
    <div className="space-y-5">
      <WatchdogPageHeader
        title="Operations Command Center"
        description="Central backup, restore, security, and reliability workspace for the full Oyama platform."
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
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600">Loading operations telemetry...</div>
      ) : null}

      {!loading && data ? (
        <>
          {data.overview.externalStoreWarning ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              External store warning: {data.overview.externalStoreWarning}
            </div>
          ) : null}

          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {cards.map((card) => (
              <article key={card.label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{card.label}</p>
                <div className="mt-2">
                  {card.tone === "status" ? (
                    <StatusChip status={card.value} />
                  ) : (
                    <p className="text-2xl font-semibold text-slate-900">{card.value}</p>
                  )}
                </div>
                {card.label === "Restore Readiness" ? (
                  <p className="mt-2 text-xs text-slate-500">Higher score means safer restore execution readiness.</p>
                ) : null}
              </article>
            ))}
          </section>

          <section className="grid gap-4 xl:grid-cols-[1.15fr_1fr]">
            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-sm font-semibold text-slate-900">What Needs Attention Now</h2>
                <Link href="/watchdog/security" className="text-xs font-medium text-indigo-700 hover:text-indigo-900">
                  Open Security
                </Link>
              </div>
              {data.attentionItems.length === 0 ? (
                <p className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  No urgent items right now.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {data.attentionItems.map((item) => (
                    <li key={`${item.title}-${item.actionHref}`} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                          item.severity === "critical"
                            ? "bg-rose-100 text-rose-700"
                            : item.severity === "high"
                              ? "bg-amber-100 text-amber-700"
                              : item.severity === "medium"
                                ? "bg-blue-100 text-blue-700"
                                : "bg-slate-200 text-slate-700"
                        }`}>
                          {item.severity}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-700">{item.detail}</p>
                      <Link href={item.actionHref} className="mt-2 inline-flex text-xs font-medium text-indigo-700 hover:text-indigo-900">
                        Go to action
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </article>

            <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Recovery Anchors</h2>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="text-slate-500">Last successful backup</dt>
                  <dd className="text-slate-900">
                    {data.overview.lastSuccessfulBackup
                      ? `${new Date(data.overview.lastSuccessfulBackup.createdAt).toLocaleString()} (${data.overview.lastSuccessfulBackup.label})`
                      : "No backup recorded"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Next scheduled backup policy</dt>
                  <dd className="text-slate-900">
                    {data.overview.nextScheduledBackup
                      ? `${data.overview.nextScheduledBackup.policyName} (${data.overview.nextScheduledBackup.cronExpression})`
                      : "No enabled schedule"}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Backup verification status</dt>
                  <dd className="text-slate-900">{data.overview.backupVerificationStatus}</dd>
                </div>
              </dl>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/watchdog/backups" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50">
                  Open Backups
                </Link>
                <Link href="/watchdog/restore" className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-medium text-indigo-700 hover:bg-indigo-100">
                  Open Restore Center
                </Link>
              </div>
            </article>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-slate-900">Recent Audit Events</h2>
              <Link href="/watchdog/audit" className="text-xs font-medium text-indigo-700 hover:text-indigo-900">
                Open Audit Log
              </Link>
            </div>
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-2 pr-3">Time</th>
                    <th className="py-2 pr-3">Severity</th>
                    <th className="py-2 pr-3">Module</th>
                    <th className="py-2 pr-3">Action</th>
                    <th className="py-2">Actor</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recentAuditEvents.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-4 text-slate-500">No audit events yet.</td>
                    </tr>
                  ) : (
                    data.recentAuditEvents.map((event) => (
                      <tr key={event.id} className="border-b border-slate-100">
                        <td className="py-2 pr-3 text-slate-700">{new Date(event.createdAt).toLocaleString()}</td>
                        <td className="py-2 pr-3">
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${
                            event.severity === "critical"
                              ? "bg-rose-100 text-rose-700"
                              : event.severity === "high"
                                ? "bg-amber-100 text-amber-700"
                                : event.severity === "medium"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-slate-100 text-slate-700"
                          }`}>
                            {event.severity}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-slate-700">{event.module}</td>
                        <td className="py-2 pr-3 text-slate-900">{event.action}</td>
                        <td className="py-2 text-slate-700">{event.userId ?? "system"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
