/** ProductionReadinessChecklist renders the audit-driven production hardening checklist. */

import type { ReadinessChecklistItem } from "@/app/lib/system-status";
import SystemStatusBadge from "@/app/components/settings/SystemStatusBadge";

/**
 * ProductionReadinessChecklist summarizes operational gaps that still block a production-ready release.
 */
export default function ProductionReadinessChecklist({ items }: { items: ReadinessChecklistItem[] }) {
  const doneItems = items.filter((item) => item.status === "Working");
  const notDoneItems = items.filter((item) => item.status !== "Working");

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Production Readiness Checklist</h2>
        <p className="mt-1 text-sm text-gray-500">
          This checklist tracks the operational and security capabilities needed before calling OyamaCRM v1.3 production-ready.
        </p>
      </div>
      <div className="grid gap-3 border-b border-gray-200 bg-gray-50 px-5 py-4 sm:grid-cols-2">
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-green-700">Done Now</p>
          <p className="mt-1 text-2xl font-bold text-green-800">{doneItems.length}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Not Done Yet</p>
          <p className="mt-1 text-2xl font-bold text-amber-800">{notDoneItems.length}</p>
        </div>
      </div>

      <div className="border-b border-gray-200 px-5 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Done</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {doneItems.map((item) => (
          <li key={item.item} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">{item.item}</p>
              <p className="text-sm text-gray-600">{item.note}</p>
            </div>
            <div className="shrink-0">
              <SystemStatusBadge status={item.status} />
            </div>
          </li>
        ))}
      </ul>

      <div className="border-y border-gray-200 px-5 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Not Done</h3>
      </div>
      <ul className="divide-y divide-gray-100">
        {notDoneItems.map((item) => (
          <li key={item.item} className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium text-gray-900">{item.item}</p>
              <p className="text-sm text-gray-600">{item.note}</p>
            </div>
            <div className="shrink-0">
              <SystemStatusBadge status={item.status} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
