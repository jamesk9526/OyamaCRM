import Link from "next/link";

/** Central launcher that links OShareview reporting into every CRM workspace surface. */
export default function OShareviewCoveragePanel() {
  return (
    <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-gray-900">CRM Reporting Coverage</h3>
      <p className="mt-0.5 text-xs text-gray-500">Open module-specific reports from one place, then standardize exports in OShareview.</p>

      <div className="mt-3 grid grid-cols-1 gap-2">
        <Link href="/reports?module=donor" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100">
          DonorCRM Reporting Workspace
        </Link>
        <Link href="/reports?module=events" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100">
          Events Reporting in OShareview
        </Link>
        <Link href="/reports?module=compassion" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100">
          Compassion Reporting in OShareview
        </Link>
        <Link href="/reports?module=ogentic" className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100">
          OGentic Reporting Queue
        </Link>
        <Link href="/reports?module=admin" className="rounded-lg border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs text-cyan-800 hover:bg-cyan-100">
          Administrative Reporting Workspace
        </Link>
      </div>

      <div className="mt-3 rounded-lg border border-green-100 bg-green-50 p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-green-700">Source Workspaces</p>
        <div className="mt-2 grid grid-cols-1 gap-1.5">
          <Link href="/events/reports" className="text-xs text-green-800 underline-offset-2 hover:underline">Events Source Reports</Link>
          <Link href="/compassion/reports" className="text-xs text-green-800 underline-offset-2 hover:underline">Compassion Source Reports</Link>
          <Link href="/reports" className="text-xs text-green-800 underline-offset-2 hover:underline">OShareview Consolidated Reporting</Link>
        </div>
      </div>
    </aside>
  );
}
