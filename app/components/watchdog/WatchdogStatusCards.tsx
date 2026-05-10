// KPI cards for OyamaWatchdog dashboard readiness and risk telemetry.

import { WatchdogStatusData } from "@/app/components/watchdog/types";

/** WatchdogStatusCards renders top-level module and security-status metrics. */
export default function WatchdogStatusCards({ data }: { data: WatchdogStatusData | null }) {
  const cards = [
    {
      label: "External Watchdog DB",
      value: data?.watchdog.health.connected ? "Connected" : "Not Connected",
      tone: data?.watchdog.health.connected ? "text-emerald-300" : "text-amber-300",
      helper: data?.watchdog.health.message ?? "Waiting for health check...",
    },
    {
      label: "Encryption Key",
      value: data?.watchdog.encryptionConfigured ? "Loaded" : "Missing",
      tone: data?.watchdog.encryptionConfigured ? "text-emerald-300" : "text-red-300",
      helper: "AES-256-GCM for stored vault secrets",
    },
    {
      label: "High Severity (24h)",
      value: String(data?.totals.highSeverityEvents24h ?? 0),
      tone: "text-amber-200",
      helper: "DELETE, RESET, UNAUTHORIZED, and auth-failure patterns",
    },
    {
      label: "Auth Failures (24h)",
      value: String(data?.totals.recentAuthFailures ?? 0),
      tone: "text-red-300",
      helper: "Potential brute-force or expired-token churn",
    },
  ];

  return (
    <section className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-xl border border-slate-700 bg-slate-900/70 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-400">{card.label}</p>
          <p className={`text-2xl font-semibold mt-1 ${card.tone}`}>{card.value}</p>
          <p className="text-xs text-slate-500 mt-1">{card.helper}</p>
        </div>
      ))}
    </section>
  );
}
