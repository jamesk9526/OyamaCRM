// Compassion settings staff page route that hosts the staff directory manager.

import CompassionStaffDirectoryManager from "@/app/components/compassion/settings/CompassionStaffDirectoryManager";
import Link from "next/link";

/**
 * CompassionStaffSettingsPage renders the staff directory and optional account management UI.
 * Access enforcement is handled by CompassionLayout and /api/compassion middleware.
 */
export default function CompassionStaffSettingsPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Compassion Staff</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage staff profiles, scheduling visibility, and optional linked accounts.</p>
        </div>
        <Link
          href="/compassion/settings"
          className="text-sm text-blue-600 hover:text-blue-700 underline"
        >
          Back to Compassion Settings
        </Link>
      </div>

      <CompassionStaffDirectoryManager />
    </div>
  );
}
