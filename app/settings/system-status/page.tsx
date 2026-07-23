/** System Status page combines readiness, production checklist, and project audit evidence. */
import FeatureReadinessTable from "@/app/components/settings/FeatureReadinessTable";
import ProductionReadinessChecklist from "@/app/components/settings/ProductionReadinessChecklist";
import SystemStatusOverview from "@/app/components/settings/SystemStatusOverview";
import { PROJECT_STATUS_AUDIT_DATE, PROJECT_STATUS_ITEMS } from "@/app/lib/project-status-audit";
import {
  FEATURE_READINESS,
  getFeatureStatusCounts,
  getPublicBuildInfo,
  OVERALL_READINESS_SCORE,
  PRODUCTION_READINESS_CHECKLIST,
  SYSTEM_STATUS_SECTIONS,
} from "@/app/lib/system-status";

/** SystemStatusPage presents the audit matrix and production checklist for admins. */
export default function SystemStatusPage() {
  const buildInfo = getPublicBuildInfo();
  const counts = getFeatureStatusCounts();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">System Status &amp; Feature Readiness</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Evidence-based readiness, production checklist, and real-data audit view for what is working, partially working, demo-only, broken, or not implemented.
        </p>
        <p className="mt-1 text-xs text-gray-500">Feature rows include Copilot-ready implementation prompts for non-Working items.</p>
      </div>

      <SystemStatusOverview
        buildInfo={buildInfo}
        readinessScore={OVERALL_READINESS_SCORE}
        counts={counts}
        sections={SYSTEM_STATUS_SECTIONS}
      />

      <FeatureReadinessTable items={FEATURE_READINESS} />
      <ProductionReadinessChecklist items={PRODUCTION_READINESS_CHECKLIST} />

      <section id="project-status" className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Project Status Audit</h2>
          <p className="mt-0.5 text-sm text-gray-500">Real Data vs Demo Data audit matrix for OyamaCRM v1.3 modules and platform surfaces.</p>
          <p className="text-xs text-gray-400 mt-1">Last deep audit: {PROJECT_STATUS_AUDIT_DATE}</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="md:hidden divide-y divide-gray-100">
            {PROJECT_STATUS_ITEMS.map((row) => (
              <article key={`${row.area}-${row.feature}`} className="px-3 py-3">
                <p className="text-xs text-gray-500">{row.area}</p>
                <p className="mt-0.5 text-sm font-semibold text-gray-900">{row.feature}</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">{row.status}</span>
                  <span className="text-xs text-gray-600">{row.dataSource}</span>
                </div>
                <p className="mt-2 text-xs text-gray-700"><span className="font-medium">Notes:</span> {row.notes}</p>
                <p className="mt-1 text-xs text-gray-700"><span className="font-medium">Next:</span> {row.nextStep}</p>
              </article>
            ))}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-[1200px] w-full text-sm">
              <thead className="bg-gray-50">
                <tr className="text-left text-gray-600">
                  <th className="px-3 py-2 font-semibold">Area</th>
                  <th className="px-3 py-2 font-semibold">Feature</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">Data Source</th>
                  <th className="px-3 py-2 font-semibold">Notes</th>
                  <th className="px-3 py-2 font-semibold">Next Step</th>
                </tr>
              </thead>
              <tbody>
                {PROJECT_STATUS_ITEMS.map((row) => (
                  <tr key={`${row.area}-${row.feature}`} className="border-t border-gray-100 align-top">
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.area}</td>
                    <td className="px-3 py-2 text-gray-900">{row.feature}</td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">{row.status}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.dataSource}</td>
                    <td className="px-3 py-2 text-gray-700">{row.notes}</td>
                    <td className="px-3 py-2 text-gray-700">{row.nextStep}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
