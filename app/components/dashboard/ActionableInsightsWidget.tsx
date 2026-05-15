"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface ReportsSummary {
  overdueTasks: number;
  pendingTasks: number;
  monthAmount: number;
  activeCampaigns: number;
}

interface StewardSummary {
  highOpportunityDonors: number;
  atRiskCadenceBroken: number;
  thankYousNeeded: number;
}

interface NotificationCount {
  unreadCount: number;
}

interface InsightItem {
  id: string;
  label: string;
  value: string;
  hint: string;
  href: string;
  tone: "red" | "amber" | "blue" | "green";
}

function toneClass(tone: InsightItem["tone"]): string {
  if (tone === "red") return "bg-red-50 border-red-200 text-red-800";
  if (tone === "amber") return "bg-amber-50 border-amber-200 text-amber-800";
  if (tone === "blue") return "bg-blue-50 border-blue-200 text-blue-800";
  return "bg-green-50 border-green-200 text-green-800";
}

/** ActionableInsightsWidget surfaces quick cross-workspace insights with direct action links. */
export default function ActionableInsightsWidget() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [stewardSummary, setStewardSummary] = useState<StewardSummary | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadInsights() {
      setLoading(true);
      setError(null);
      try {
        const [reports, steward, notifications] = await Promise.all([
          apiFetch<ReportsSummary>("/api/reports/summary"),
          apiFetch<StewardSummary>("/api/steward-signals/summary"),
          apiFetch<NotificationCount>("/api/notifications/unread-count?module=donor"),
        ]);

        if (cancelled) return;
        setSummary(reports);
        setStewardSummary(steward);
        setNotificationCount(notifications.unreadCount ?? 0);
      } catch (requestError) {
        if (cancelled) return;
        setError(requestError instanceof Error ? requestError.message : "Could not load actionable insights.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadInsights();
    return () => {
      cancelled = true;
    };
  }, []);

  const items = useMemo<InsightItem[]>(() => {
    return [
      {
        id: "overdue-tasks",
        label: "Overdue tasks",
        value: String(summary?.overdueTasks ?? 0),
        hint: "Needs follow-up today",
        href: "/tasks",
        tone: "red",
      },
      {
        id: "thank-yous-needed",
        label: "Thank-yous needed",
        value: String(stewardSummary?.thankYousNeeded ?? 0),
        hint: "Acknowledgements pending",
        href: "/letters-printables/generate/template",
        tone: "amber",
      },
      {
        id: "at-risk-donors",
        label: "At-risk donors",
        value: String(stewardSummary?.atRiskCadenceBroken ?? 0),
        hint: "Cadence risk alerts",
        href: "/steward-signals",
        tone: "blue",
      },
      {
        id: "unread-notifications",
        label: "Unread notifications",
        value: String(notificationCount),
        hint: "Top bar alert queue",
        href: "/tasks",
        tone: "green",
      },
    ];
  }, [notificationCount, stewardSummary, summary]);

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3, 4].map((row) => (
          <div key={row} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
        <p className="text-xs font-semibold text-amber-800">Actionable insights unavailable</p>
        <p className="text-xs text-amber-700 mt-1">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`block rounded-lg border px-3 py-2 transition-colors hover:bg-white ${toneClass(item.tone)}`}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide">{item.label}</p>
            <p className="text-sm font-semibold">{item.value}</p>
          </div>
          <p className="text-xs opacity-85 mt-0.5">{item.hint}</p>
        </Link>
      ))}
    </div>
  );
}
