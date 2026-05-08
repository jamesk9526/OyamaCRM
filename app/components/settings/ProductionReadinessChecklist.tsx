/** ProductionReadinessChecklist renders the audit-driven production hardening checklist. */

import type { ReadinessChecklistItem } from "@/app/lib/system-status";
import SystemStatusBadge from "@/app/components/settings/SystemStatusBadge";

/**
 * ProductionReadinessChecklist summarizes operational gaps that still block a production-ready release.
 */
export default function ProductionReadinessChecklist({ items }: { items: ReadinessChecklistItem[] }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="border-b border-gray-200 px-5 py-4">
        <h2 className="text-sm font-semibold text-gray-900">Production Readiness Checklist</h2>
        <p className="mt-1 text-sm text-gray-500">
          This checklist tracks the operational and security capabilities needed before calling OyamaCRM production-ready.
        </p>
      </div>
      <ul className="divide-y divide-gray-100">
        {items.map((item) => (
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
