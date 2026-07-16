"use client";
// Compassion CRM — Client Import page.
// Route: /compassion/import/clients

import CompassionClientImportWizard from "./CompassionClientImportWizard";
import Link from "next/link";

/**
 * CompassionClientImportPage: thin wrapper that renders the 5-step client import wizard.
 * All import logic lives in CompassionClientImportWizard.
 */
export default function CompassionClientImportPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Import Clients</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Upload a CSV file, map fields, and import client records into Compassion CRM safely.
          </p>
        </div>
        <Link
          href="/compassion/data-tools"
          className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
        >
          ← Back to Data Tools
        </Link>
      </div>
      <CompassionClientImportWizard />
    </div>
  );
}
