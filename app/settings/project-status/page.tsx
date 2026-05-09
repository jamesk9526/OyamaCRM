/** Settings project status page rendering the evidence-backed audit matrix. */
import { PROJECT_STATUS_AUDIT_DATE, PROJECT_STATUS_ITEMS } from "@/app/lib/project-status-audit";

/** ProjectStatusPage shows real-data vs demo-data readiness with actionable next steps. */
export default function ProjectStatusPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Project Status Audit</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Real Data vs Demo Data audit matrix for OyamaCRM modules and platform surfaces.
        </p>
        <p className="text-xs text-gray-400 mt-1">Last deep audit: {PROJECT_STATUS_AUDIT_DATE}</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left text-gray-600">
                <th className="px-3 py-2 font-semibold">Area</th>
                <th className="px-3 py-2 font-semibold">Feature</th>
                <th className="px-3 py-2 font-semibold">Status</th>
                <th className="px-3 py-2 font-semibold">Data Source</th>
                <th className="px-3 py-2 font-semibold">Notes</th>
                <th className="px-3 py-2 font-semibold">Next Step</th>
              </tr>
            </thead>
            <tbody>
              {PROJECT_STATUS_ITEMS.map((row) => (
                <tr key={`${row.area}-${row.feature}`} className="border-t border-gray-100 align-top">
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.area}</td>
                  <td className="px-3 py-2 text-gray-900">{row.feature}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-700">
                      {row.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{row.dataSource}</td>
                  <td className="px-3 py-2 text-gray-700">{row.notes}</td>
                  <td className="px-3 py-2 text-gray-700">{row.nextStep}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
