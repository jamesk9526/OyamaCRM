/** OGenticDraftCard renders draft-style artifacts such as email and letter outputs. */

import type { OGenticArtifact } from "@/app/modules/ogentic/types/ogentic.types";

interface OGenticDraftCardProps {
  artifact: OGenticArtifact;
}

/** OGenticDraftCard displays lightweight metadata for a draft artifact item. */
export default function OGenticDraftCard({ artifact }: OGenticDraftCardProps) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white px-3 py-2">
      <p className="text-xs font-semibold text-slate-800">{artifact.title}</p>
      <p className="text-[11px] text-slate-500 mt-1">Draft type: {artifact.type.replace("_", " ")}</p>
      <p className="text-[11px] text-slate-500">Status: {artifact.status}</p>
    </article>
  );
}
