/** SystemStatusOverview renders the high-level status cards and readiness counts for the audit center. */

import type { PublicBuildInfo, SystemStatusSection } from "@/app/lib/system-status";
import SystemStatusBadge from "@/app/components/settings/SystemStatusBadge";

/**
 * SystemStatusOverview gives admins a concise, honest readout of major system areas and audit totals.
 */
export default function SystemStatusOverview({
  buildInfo,
  readinessScore,
  counts,
  sections,
}: {
  buildInfo: PublicBuildInfo;
  readinessScore: number;
  counts: Record<string, number>;
  sections: SystemStatusSection[];
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Overall Readiness</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">{readinessScore}%</p>
          <p className="mt-1 text-sm text-gray-500">Production-ready internal release with targeted production hardening still in progress.</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Application Version</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{buildInfo.version}</p>
          <p className="mt-1 text-sm text-gray-500">Release channel: {buildInfo.releaseChannel}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Last Audit Date</p>
          <p className="mt-2 text-2xl font-bold text-gray-900">{buildInfo.lastAuditDate}</p>
          <p className="mt-1 text-sm text-gray-500">Environment: {buildInfo.environment}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Status Counts</p>
          <div className="mt-2 space-y-1 text-sm text-gray-700">
            <p>Working: <span className="font-semibold">{counts.Working ?? 0}</span></p>
            <p>Partially Working: <span className="font-semibold">{counts["Partially Working"] ?? 0}</span></p>
            <p>Demo Only: <span className="font-semibold">{counts["Demo Only"] ?? 0}</span></p>
            <p>Broken: <span className="font-semibold">{counts.Broken ?? 0}</span></p>
            <p>Not Implemented: <span className="font-semibold">{counts["Not Implemented"] ?? 0}</span></p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => (
          <div key={section.title} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold text-gray-900">{section.title}</h2>
              <SystemStatusBadge status={section.status} />
            </div>
            <p className="mt-3 text-sm text-gray-600">{section.summary}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
