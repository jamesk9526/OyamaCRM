/** SystemStatusBadge renders a consistent color-coded badge for audit readiness states. */

import type { FeatureStatus } from "@/app/lib/system-status";

const BADGE_STYLES: Record<FeatureStatus, string> = {
  Working: "bg-green-50 text-green-700 border-green-200",
  Partial: "bg-amber-50 text-amber-700 border-amber-200",
  Placeholder: "bg-sky-50 text-sky-700 border-sky-200",
  "Not Started": "bg-gray-100 text-gray-700 border-gray-200",
  "Needs Review": "bg-purple-50 text-purple-700 border-purple-200",
};

/**
 * SystemStatusBadge displays the current audit status for a feature or checklist row.
 */
export default function SystemStatusBadge({ status }: { status: FeatureStatus }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${BADGE_STYLES[status]}`}>
      {status}
    </span>
  );
}
