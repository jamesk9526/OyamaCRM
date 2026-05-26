// Status badge for report readiness labels.

import type { ReportStatus } from "@/app/components/reports-app/report-types";

export default function ReportStatusBadge({ status }: { status: ReportStatus }) {
  const classes = status === "Working"
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : status === "Partial"
      ? "border-amber-200 bg-amber-50 text-amber-700"
      : "border-slate-200 bg-slate-50 text-slate-600";

  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${classes}`}>
      {status}
    </span>
  );
}
