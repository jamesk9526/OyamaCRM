// Status chip for Watchdog operations dashboards.

import type { WorkingStatus } from "@/app/components/watchdog/ops/types";

interface StatusChipProps {
  status: WorkingStatus | string;
}

/** Renders consistent status chips for Working/Partial/Broken/Not Implemented labels. */
export default function StatusChip({ status }: StatusChipProps) {
  const normalized = status.toLowerCase();
  const className = normalized === "working"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : normalized === "partially working"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : normalized === "broken"
        ? "border-rose-200 bg-rose-50 text-rose-700"
        : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${className}`}>
      {status}
    </span>
  );
}
