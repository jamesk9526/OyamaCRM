"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetch } from "@/app/lib/auth-client";

type RecurringHealth = { activeRecurringDonors: number; recurringRevenueLast30Days: number; upcomingCount: number; missedCount: number };

export default function RecurringGivingHealthWidget() {
  const [health, setHealth] = useState<RecurringHealth | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiFetch<{ result: RecurringHealth }>("/api/steward-ai/tools/execute", {
      method: "POST",
      body: JSON.stringify({ tool: "donor.getRecurringGivingHealth", moduleKey: "donor", scopePath: "/", input: { limit: 3, windowDays: 30 } }),
    }).then((data) => { if (!cancelled) setHealth(data.result); })
      .catch(() => { if (!cancelled) setError(true); });
    return () => { cancelled = true; };
  }, []);
  if (!health && !error) return <div className="h-32 animate-pulse rounded-lg bg-gray-50" />;
  if (!health) return <p className="flex h-32 items-center justify-center text-sm text-gray-400">Recurring-giving health could not be loaded.</p>;
  return <div className="space-y-3">
    <div className="grid grid-cols-2 gap-2"><Metric label="Active donors" value={health.activeRecurringDonors} /><Metric label="30-day revenue" value={`$${health.recurringRevenueLast30Days.toLocaleString()}`} /><Metric label="Upcoming" value={health.upcomingCount} /><Metric label="Needs review" value={health.missedCount} alert={health.missedCount > 0} /></div>
    <p className="text-[11px] text-gray-400">Live CRM payment-plan data, refreshed on load.</p>
    <Link href="/reports" className="inline-flex text-xs font-semibold text-emerald-700 hover:text-emerald-800">Open giving reports →</Link>
  </div>;
}

function Metric({ label, value, alert = false }: { label: string; value: string | number; alert?: boolean }) {
  return <div className="rounded-lg bg-gray-50 px-2.5 py-2"><p className={`text-base font-bold ${alert ? "text-amber-600" : "text-gray-800"}`}>{value}</p><p className="text-[10px] font-medium text-gray-500">{label}</p></div>;
}
