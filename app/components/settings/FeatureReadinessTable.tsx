/** FeatureReadinessTable renders the audit-backed feature matrix for the system status center. */

import type { FeatureReadinessItem } from "@/app/lib/system-status";
import SystemStatusBadge from "@/app/components/settings/SystemStatusBadge";

/**
 * FeatureReadinessTable gives admins an honest snapshot of what is working, partial, or missing.
 */
export default function FeatureReadinessTable({ items }: { items: FeatureReadinessItem[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Feature Readiness Matrix</h2>
        <p className="mt-1 text-sm text-gray-500">
          Features are labeled Working, Partial, Placeholder, Not Started, or Needs Review only when the code supports that claim.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Feature", "Workspace", "Status", "Last Verified", "Working Pieces", "Missing Pieces", "Next Action", "Linked Plan File"].map((label) => (
                <th key={label} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {items.map((item) => (
              <tr key={`${item.workspace}-${item.feature}`} className="align-top">
                <td className="px-4 py-4 font-medium text-gray-900">{item.feature}</td>
                <td className="px-4 py-4 text-gray-700">{item.workspace}</td>
                <td className="px-4 py-4"><SystemStatusBadge status={item.status} /></td>
                <td className="px-4 py-4 text-gray-700">{item.lastVerified}</td>
                <td className="px-4 py-4 text-gray-700">{item.workingPieces}</td>
                <td className="px-4 py-4 text-gray-700">{item.missingPieces}</td>
                <td className="px-4 py-4 text-gray-700">{item.nextAction}</td>
                <td className="px-4 py-4 font-mono text-xs text-gray-600">{item.linkedPlanFile}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
