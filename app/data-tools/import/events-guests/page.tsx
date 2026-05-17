/** Guided Events CRM guest roster CSV import page. */

import Link from "next/link";
import EventGuestImportWizard from "@/app/components/data-tools/EventGuestImportWizard";

/** Renders the event guest importer selected from the unified Data Tools import workflow. */
export default function EventGuestImportPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Import Event Guests</h1>
          <p className="mt-1 text-sm text-gray-500">Import guest roster CSVs into a selected Events CRM event.</p>
        </div>
        <Link href="/data-tools/import" className="text-sm font-semibold text-gray-600 hover:text-gray-900">
          Back to Guided Import
        </Link>
      </div>
      <EventGuestImportWizard />
    </div>
  );
}
