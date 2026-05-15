/** System Updates page hosts the admin-only update manager workspace. */

import SystemUpdatesManager from "@/app/components/settings/SystemUpdatesManager";

/** SystemUpdatesPage renders release checks, install controls, rollback, and update history. */
export default function SystemUpdatesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">System Updates</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Admin-controlled release install, migration tracking, maintenance mode, and rollback controls.
        </p>
      </div>

      <SystemUpdatesManager />
    </div>
  );
}
