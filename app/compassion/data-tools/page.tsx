// Compassion CRM — Data Tools hub page.
// Route: /compassion/data-tools

import Link from "next/link";

/**
 * CompassionDataToolsPage: landing page for all Compassion CRM data operations.
 * Links to import, export, and history tools. Import Clients is the primary action.
 */
export default function CompassionDataToolsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Compassion CRM Data Tools</h1>
        <p className="text-sm text-gray-500 mt-0.5">Import, export, and manage your client data.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Import Clients — primary, fully active */}
        <Link
          href="/compassion/import/clients"
          className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 hover:border-blue-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 text-xl shrink-0">
              📥
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 group-hover:text-blue-700">Import Clients</h3>
              <p className="text-sm text-gray-500 mt-1">
                Upload a CSV file to import client records from eKYROS or another system.
              </p>
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                eKYROS ready
              </span>
            </div>
          </div>
        </Link>

        {/* Import History — coming soon */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 opacity-60">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xl shrink-0">
              📋
            </div>
            <div>
              <h3 className="font-semibold text-gray-700">Import History</h3>
              <p className="text-sm text-gray-400 mt-1">
                View past imports, download error reports, and review what was changed.
              </p>
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
          </div>
        </div>

        {/* Export Clients — coming soon */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 opacity-60">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 text-xl shrink-0">
              📤
            </div>
            <div>
              <h3 className="font-semibold text-gray-700">Export Clients</h3>
              <p className="text-sm text-gray-400 mt-1">
                Download client records as a CSV file for backup or migration.
              </p>
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-medium text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                Coming Soon
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Safety notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Data Import Safety Rules</h3>
        <ul className="text-xs text-blue-800 space-y-1">
          <li>• SSN / Social Security Numbers are always blocked and will never be imported.</li>
          <li>• Compassion CRM client records are kept separate from Donor CRM donor records.</li>
          <li>• Imported clients will not appear in Donor CRM donor lists or reports.</li>
          <li>• Always preview your import before committing to avoid duplicates.</li>
          <li>• Use the dry-run mode to test your import without saving any data.</li>
        </ul>
      </div>
    </div>
  );
}
