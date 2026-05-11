// Compassion settings staff page route that hosts the staff directory manager.

import CompassionStaffDirectoryManager from "@/app/components/compassion/settings/CompassionStaffDirectoryManager";

/**
 * CompassionStaffSettingsPage renders the staff directory and optional account management UI.
 * TODO: enforce Compassion workspace permission
 */
export default function CompassionStaffSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Compassion Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage staff profiles, scheduling visibility, and optional linked accounts.</p>
        </div>
        <a
          href="/compassion/settings"
          className="text-sm text-blue-600 hover:text-blue-700 underline"
        >
          Back to Compassion Settings
        </a>
      </div>

      <CompassionStaffDirectoryManager />
    </div>
  );
}
