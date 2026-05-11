/** OGenticReportCard renders report-style artifact summaries in the OGentic artifact rail. */

import type { OGenticArtifact } from "@/app/modules/ogentic/types/ogentic.types";

interface OGenticReportCardProps {
  artifact: OGenticArtifact;
}

/** OGenticReportCard displays report metadata and generation status. */
export default function OGenticReportCard({ artifact }: OGenticReportCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold text-slate-800">{artifact.title}</p>
      <p className="text-[11px] text-slate-500 mt-1">Report artifact</p>
      <p className="text-[11px] text-slate-500">Updated: {new Date(artifact.updatedAt).toLocaleString()}</p>
    </article>
  );
}
