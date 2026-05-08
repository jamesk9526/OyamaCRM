/** System settings page shows safe build/version metadata and live runtime diagnostics. */

import Link from "next/link";
import SystemHealthPanel from "@/app/components/settings/SystemHealthPanel";
import { getPublicBuildInfo } from "@/app/lib/system-status";

/** SystemSettingsPage surfaces versioning, environment, and live operational health details. */
export default function SystemSettingsPage() {
  const buildInfo = getPublicBuildInfo();

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">System</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Review version metadata, runtime diagnostics, and core service readiness.
          </p>
        </div>
        <Link
          href="/settings/system-status"
          className="inline-flex w-fit items-center rounded-lg border border-green-200 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
        >
          Open System Status &amp; Feature Readiness
        </Link>
      </div>

      <SystemHealthPanel buildInfo={buildInfo} />
    </div>
  );
}
