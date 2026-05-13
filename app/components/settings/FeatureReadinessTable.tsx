/** FeatureReadinessTable renders the audit-backed feature matrix for the system status center. */

import type { FeatureReadinessItem } from "@/app/lib/system-status";
import SystemStatusBadge from "@/app/components/settings/SystemStatusBadge";

/**
 * FeatureReadinessTable gives admins an honest snapshot of what is working, partial, or missing.
 */
export default function FeatureReadinessTable({ items }: { items: FeatureReadinessItem[] }) {
  const actionableCount = items.filter((item) => item.status !== "Working").length;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Feature Readiness Matrix</h2>
        <p className="mt-1 text-sm text-gray-500">
          Features are labeled Working, Partially Working, Demo Only, Broken, or Not Implemented only when evidence supports that claim.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Actionable backlog rows ({actionableCount}) now include priority, success criteria, and a ready-to-run Copilot prompt.
        </p>
      </div>

      <div className="md:hidden divide-y divide-gray-100">
        {items.map((item) => (
          <article key={`${item.workspace}-${item.feature}`} className="px-4 py-3">
            <p className="text-xs text-gray-500">{item.workspace}</p>
            <p className="mt-0.5 text-sm font-semibold text-gray-900">{item.feature}</p>
            <div className="mt-1.5">
              <SystemStatusBadge status={item.status} />
            </div>
            <div className="mt-2 space-y-1 text-xs text-gray-700">
              <p><span className="font-medium">Last Verified:</span> {item.lastVerified}</p>
              <p><span className="font-medium">Working:</span> {item.workingPieces}</p>
              <p><span className="font-medium">Missing:</span> {item.missingPieces}</p>
              <p><span className="font-medium">Next:</span> {item.nextAction}</p>
              {item.priority ? <p><span className="font-medium">Priority:</span> {item.priority}</p> : null}
              {item.successCriteria ? <p><span className="font-medium">Done When:</span> {item.successCriteria}</p> : null}
              {item.copilotPrompt ? (
                <details className="mt-1 rounded-md border border-gray-200 bg-gray-50 p-2">
                  <summary className="cursor-pointer font-medium text-gray-700">Copilot Prompt</summary>
                  <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-gray-700">{item.copilotPrompt}</pre>
                </details>
              ) : null}
              <p className="font-mono text-gray-600"><span className="font-medium font-sans">Plan:</span> {item.linkedPlanFile}</p>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Feature", "Workspace", "Status", "Last Verified", "Working Pieces", "Missing Pieces", "Action Pack", "Linked Plan File"].map((label) => (
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
                <td className="px-4 py-4 text-gray-700">
                  <p><span className="font-medium">Next:</span> {item.nextAction}</p>
                  {item.priority ? <p className="mt-1"><span className="font-medium">Priority:</span> {item.priority}</p> : null}
                  {item.successCriteria ? <p className="mt-1"><span className="font-medium">Done When:</span> {item.successCriteria}</p> : null}
                  {item.copilotPrompt ? (
                    <details className="mt-2 rounded-md border border-gray-200 bg-gray-50 p-2">
                      <summary className="cursor-pointer text-xs font-semibold text-gray-700">Copilot Prompt</summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] text-gray-700">{item.copilotPrompt}</pre>
                    </details>
                  ) : null}
                </td>
                <td className="px-4 py-4 font-mono text-xs text-gray-600">{item.linkedPlanFile}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
