/**
 * Deterministic dashboard calculations shared by Donor Dashboard components.
 */

import type { DonorDashboardSummary, RetentionData, StewardSuggestion } from "../types";

export function toDashboardNumber(value: number | string | null | undefined): number {
  const next = Number(value ?? 0);
  return Number.isFinite(next) ? next : 0;
}

export function formatDashboardCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDashboardCompactCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 1 : 2)}M`;
  if (value >= 1_000) return `$${Math.round(value / 1_000).toLocaleString()}K`;
  return formatDashboardCurrency(value);
}

/**
 * Builds deterministic stewardship alerts from real summary/retention values.
 * No AI or generated insight is used here; each alert maps to a visible CRM filter.
 */
export function buildStewardshipSuggestions(
  summary: DonorDashboardSummary | null,
  retention: RetentionData | null,
): StewardSuggestion[] {
  const suggestions: StewardSuggestion[] = [];
  if (!summary) return suggestions;

  if ((summary.overdueTasks ?? 0) > 0) {
    suggestions.push({
      id: "overdue_tasks",
      type: "pending_task",
      title: `${summary.overdueTasks} Overdue Task${summary.overdueTasks === 1 ? "" : "s"}`,
      description: "Open stewardship tasks past their due date.",
      action: { label: "View Tasks", href: "/tasks?queue=overdue" },
      count: summary.overdueTasks,
      urgency: "high",
    });
  }

  if (retention && retention.total > 0 && retention.rate < 60) {
    suggestions.push({
      id: "retention_low",
      type: "retention",
      title: "Retention Needs Attention",
      description: `${Math.max(0, retention.total - retention.retained).toLocaleString()} prior-period donors have not given again in the current period.`,
      action: { label: "Open Lapsed Report", href: "/reports?report=lapsed-donor-report" },
      count: Math.max(0, retention.total - retention.retained),
      urgency: "high",
    });
  }

  if (summary.newDonorsThisMonth > 0) {
    suggestions.push({
      id: "welcome_new_donors",
      type: "welcome",
      title: `${summary.newDonorsThisMonth} First-Time Donor${summary.newDonorsThisMonth === 1 ? "" : "s"}`,
      description: "New donors should receive a welcome or thank-you follow-up.",
      action: { label: "Open Segment", href: "/reports?report=new-donor" },
      count: summary.newDonorsThisMonth,
      urgency: "medium",
    });
  }

  if ((summary.pendingTasks ?? 0) > 0) {
    suggestions.push({
      id: "pending_tasks",
      type: "pending_task",
      title: `${summary.pendingTasks} Pending Task${summary.pendingTasks === 1 ? "" : "s"}`,
      description: "Open donor follow-ups waiting in the task queue.",
      action: { label: "Open Tasks", href: "/tasks" },
      count: summary.pendingTasks,
      urgency: "low",
    });
  }

  return suggestions;
}
