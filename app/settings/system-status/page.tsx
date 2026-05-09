/** System Status & Feature Readiness page for audit-backed production-readiness reporting. */

import Link from "next/link";
import FeatureReadinessTable from "@/app/components/settings/FeatureReadinessTable";
import ProductionReadinessChecklist from "@/app/components/settings/ProductionReadinessChecklist";
import SystemStatusOverview from "@/app/components/settings/SystemStatusOverview";
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
          Evidence-based readiness view for what is working, partially working, placeholder-only, or still not started.
        </p>
        <p className="mt-1 text-xs text-gray-500">
          Need row-level real-vs-demo evidence?{" "}
          <Link href="/settings/project-status" className="text-green-700 hover:underline">
            Open Project Status Audit
          </Link>
          .
        </p>
      </div>

      <SystemStatusOverview
        buildInfo={buildInfo}
        readinessScore={OVERALL_READINESS_SCORE}
        counts={counts}
        sections={SYSTEM_STATUS_SECTIONS}
      />

      <FeatureReadinessTable items={FEATURE_READINESS} />
      <ProductionReadinessChecklist items={PRODUCTION_READINESS_CHECKLIST} />
    </div>
  );
}
