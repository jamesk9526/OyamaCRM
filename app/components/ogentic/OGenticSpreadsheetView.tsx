/** OGenticSpreadsheetView renders a compact spreadsheet-style preview for table artifacts. */

import type { OGenticArtifact } from "@/app/modules/ogentic/types/ogentic.types";

interface OGenticSpreadsheetViewProps {
  artifact: OGenticArtifact;
}

/** OGenticSpreadsheetView shows a placeholder table shell until backend spreadsheet data is wired. */
export default function OGenticSpreadsheetView({ artifact }: OGenticSpreadsheetViewProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold text-slate-800">{artifact.title}</p>
      <p className="text-[11px] text-slate-500 mt-1">Spreadsheet preview</p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-[11px] border border-slate-200 rounded-md overflow-hidden">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-2 py-1 text-left">Column A</th>
              <th className="px-2 py-1 text-left">Column B</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-slate-200">
              <td className="px-2 py-1 text-slate-500">Awaiting data wiring</td>
              <td className="px-2 py-1 text-slate-500">{artifact.status}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </article>
  );
}
