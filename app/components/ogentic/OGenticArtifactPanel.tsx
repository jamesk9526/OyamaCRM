/** OGenticArtifactPanel renders draft/report/spreadsheet artifacts produced in the OGentic workspace. */

import OGenticDraftCard from "@/app/components/ogentic/OGenticDraftCard";
import OGenticReportCard from "@/app/components/ogentic/OGenticReportCard";
import OGenticSpreadsheetView from "@/app/components/ogentic/OGenticSpreadsheetView";
import type { OGenticArtifact } from "@/app/modules/ogentic/types/ogentic.types";

interface OGenticArtifactPanelProps {
  artifacts: OGenticArtifact[];
}

/** OGenticArtifactPanel shows saved artifacts so outputs live beyond a single chat message. */
export default function OGenticArtifactPanel({ artifacts }: OGenticArtifactPanelProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3 min-h-0 flex flex-col">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Artifacts</h2>
        <p className="text-xs text-slate-500 mt-1">Draft-only in this phase. Persistence is local-only for now.</p>
      </div>

      {artifacts.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-500">
          No artifacts yet. Generate a draft, report, or spreadsheet from OGentic prompts.
        </p>
      ) : (
        <div className="space-y-2 flex-1 min-h-0 overflow-y-auto pr-1">
          {artifacts.map((artifact) => {
            if (artifact.type === "report") {
              return <OGenticReportCard key={artifact.id} artifact={artifact} />;
            }
            if (artifact.type === "spreadsheet") {
              return <OGenticSpreadsheetView key={artifact.id} artifact={artifact} />;
            }
            return <OGenticDraftCard key={artifact.id} artifact={artifact} />;
          })}
        </div>
      )}
    </section>
  );
}
