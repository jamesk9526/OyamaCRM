/**
 * SystemHealthPanel fetches live API/system health and safe settings diagnostics for the System page.
 */
"use client";

import { useEffect, useState } from "react";
import type { PublicBuildInfo, FeatureStatus } from "@/app/lib/system-status";
import SystemStatusBadge from "@/app/components/settings/SystemStatusBadge";
import { apiFetch } from "@/app/lib/auth-client";

interface HealthPayload {
  status: string;
  appName: string;
  version: string;
  buildDate: string;
  gitCommit: string;
  releaseChannel: string;
  database: string;
  environment: string;
  lastAuditDate: string;
  uptimeSec?: number;
  timestamp?: string;
}

interface EmailSettingsPayload {
  smtpHost?: string;
  smtpFromEmail?: string;
}

/**
 * SystemHealthPanel combines live API health with email/queue/AI readiness hints.
 * Queue and AI are marked from known implementation state until those services exist.
 */
export default function SystemHealthPanel({ buildInfo }: { buildInfo: PublicBuildInfo }) {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [emailReady, setEmailReady] = useState<"Working" | "Partial">("Partial");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function load() {
      try {
        const [healthResult, settingsResult] = await Promise.allSettled([
          apiFetch<HealthPayload>("/api/health"),
          apiFetch<EmailSettingsPayload>("/api/settings"),
        ]);

        if (healthResult.status === "rejected") {
          throw healthResult.reason instanceof Error
            ? healthResult.reason
            : new Error(String(healthResult.reason));
        }

        const nextHealth = healthResult.value;
        const settings = settingsResult.status === "fulfilled" ? settingsResult.value : null;

        if (!active) return;
        setHealth(nextHealth);
        setEmailReady(settings?.smtpHost && settings?.smtpFromEmail ? "Working" : "Partial");
      } catch (err) {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Unable to load runtime diagnostics.");
      }
    }

    void load();
    return () => {
      active = false;
    };
  }, []);

  const runtime = health ?? {
    status: "needs-review",
    appName: buildInfo.appName,
    version: buildInfo.version,
    buildDate: buildInfo.buildDate,
    gitCommit: buildInfo.gitCommit,
    releaseChannel: buildInfo.releaseChannel,
    database: "needs-review",
    environment: buildInfo.environment,
    lastAuditDate: buildInfo.lastAuditDate,
  };

  const cards: { label: string; value: string; status: FeatureStatus }[] = [
    { label: "API Status", value: runtime.status === "ok" ? "Online" : "Needs Review", status: runtime.status === "ok" ? "Working" : "Partial" as const },
    { label: "Database Connection", value: runtime.database === "ok" ? "Connected" : "Not Ready", status: runtime.database === "ok" ? "Working" : "Partial" as const },
    { label: "Email Provider Status", value: emailReady === "Working" ? "SMTP Configured" : "SMTP Incomplete", status: emailReady },
    { label: "Queue Status", value: "No queue worker configured", status: "Not Started" as const },
    { label: "AI Provider Status", value: "No AI provider configured", status: "Not Started" as const },
  ];

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {cards.map((card) => (
          <div key={card.label} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">{card.label}</p>
              <SystemStatusBadge status={card.status} />
            </div>
            <p className="mt-3 text-sm font-medium text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Version & Build</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">OyamaCRM Version</dt>
              <dd className="font-medium text-gray-900">{runtime.version}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Build Date</dt>
              <dd className="font-medium text-gray-900">{runtime.buildDate}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Git Commit</dt>
              <dd className="font-mono text-xs text-gray-900">{runtime.gitCommit}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Environment</dt>
              <dd className="font-medium text-gray-900">{runtime.environment}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Release Channel</dt>
              <dd className="font-medium text-gray-900">{runtime.releaseChannel}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Last Audit Date</dt>
              <dd className="font-medium text-gray-900">{runtime.lastAuditDate}</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="text-sm font-semibold text-gray-900">Runtime Diagnostics</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Application</dt>
              <dd className="font-medium text-gray-900">{runtime.appName}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">API Health Endpoint</dt>
              <dd className="font-medium text-gray-900">/api/health</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Database</dt>
              <dd className="font-medium text-gray-900">{runtime.database}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Uptime</dt>
              <dd className="font-medium text-gray-900">{runtime.uptimeSec != null ? `${runtime.uptimeSec}s` : "Unavailable"}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="text-gray-500">Last Health Check</dt>
              <dd className="font-medium text-gray-900">{runtime.timestamp ?? "Unavailable"}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}
