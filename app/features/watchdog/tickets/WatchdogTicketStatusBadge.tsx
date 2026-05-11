// Colored status and priority badges used in Watchdog feedback ticket list/detail views.

"use client";

import type { WatchdogFeedbackPriority, WatchdogFeedbackTicketStatus } from "@/app/features/watchdog/tickets/types";

interface WatchdogTicketStatusBadgeProps {
  status: WatchdogFeedbackTicketStatus;
  priority: WatchdogFeedbackPriority;
}

/**
 * WatchdogTicketStatusBadge renders normalized visual chips for triage status and priority.
 * This keeps list and detail screens consistent when scanning queue urgency.
 */
export function WatchdogTicketStatusBadge({ status, priority }: WatchdogTicketStatusBadgeProps) {
  const statusClass =
    status === "new"
      ? "bg-slate-700/80 text-slate-100 border-slate-500/60"
      : status === "in_review"
        ? "bg-blue-700/80 text-blue-100 border-blue-500/60"
        : status === "in_progress"
          ? "bg-indigo-700/80 text-indigo-100 border-indigo-500/60"
          : status === "waiting_on_user"
            ? "bg-amber-700/80 text-amber-100 border-amber-500/60"
            : status === "resolved"
              ? "bg-emerald-700/80 text-emerald-100 border-emerald-500/60"
              : "bg-zinc-700/80 text-zinc-100 border-zinc-500/60";

  const priorityClass =
    priority === "urgent"
      ? "bg-red-700/90 text-red-50 border-red-500/60"
      : priority === "high"
        ? "bg-orange-700/80 text-orange-100 border-orange-500/60"
        : priority === "normal"
          ? "bg-sky-700/80 text-sky-100 border-sky-500/60"
          : "bg-slate-700/80 text-slate-100 border-slate-500/60";

  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${statusClass}`}>
        {status.replaceAll("_", " ")}
      </span>
      <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] ${priorityClass}`}>
        {priority}
      </span>
    </div>
  );
}
