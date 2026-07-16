// Donation Import page — hosts the 5-step DonationImportWizard.
// Accessible at /data-tools/import/donation

import DonationImportWizard from "../DonationImportWizard";
import Link from "next/link";

/**
 * DonationImportPage — page wrapper for the historical donation CSV import wizard.
 * Renders within AppShell via the root layout.
 */
export default function DonationImportPage() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-3">
        <Link
          href="/data-tools"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          ← Data Tools
        </Link>
        <span className="text-gray-300">/</span>
        <Link
          href="/data-tools/import"
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Import
        </Link>
        <span className="text-gray-300">/</span>
        <span className="text-sm text-gray-700 font-medium">Donations</span>
      </div>

      <div>
        <h1 className="text-xl font-semibold text-gray-900">Import Historical Donations</h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload a CSV of donation history from any system. The wizard maps columns, validates
          amounts and dates, links donations to existing constituents, and updates lifetime giving
          statistics automatically.
        </p>
      </div>

      {/* Supported source badges */}
      <div className="flex gap-2 flex-wrap">
        <span className="px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">Modern donor CRM export</span>
        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">Fundraising CRM export</span>
        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">eKYROS</span>
        <span className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-full">DonorPerfect</span>
        <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">Spreadsheet / Any CSV</span>
      </div>

      {/* Wizard */}
      <div className="bg-white border border-gray-200 rounded-xl p-6">
        <DonationImportWizard />
      </div>
    </div>
  );
}
