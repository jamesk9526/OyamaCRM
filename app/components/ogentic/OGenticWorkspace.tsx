/** OGenticWorkspace composes the full agentic CRM control-center shell for cross-module work. */
"use client";

import OGenticArtifactPanel from "@/app/components/ogentic/OGenticArtifactPanel";
import OGenticChatPanel from "@/app/components/ogentic/OGenticChatPanel";
import OGenticToolPanel from "@/app/components/ogentic/OGenticToolPanel";
import { useOGenticArtifacts } from "@/app/modules/ogentic/hooks/useOGenticArtifacts";
import { useOGenticWorkspace } from "@/app/modules/ogentic/hooks/useOGenticWorkspace";

/** OGenticWorkspace renders the left-nav, central chat, and right tool/context rails. */
export default function OGenticWorkspace() {
  const { handoff } = useOGenticWorkspace();
  const { artifacts, addArtifact } = useOGenticArtifacts();

  return (
    <div className="h-full min-h-0 flex flex-col gap-4">
      <header className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-slate-50 px-5 py-4">
        <h1 className="text-xl font-semibold text-slate-900">OGentic</h1>
        <p className="mt-1 text-sm text-slate-600">Cross-module AI workspace for analysis, planning, and draft generation.</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
          <span className="rounded-full border border-emerald-200 bg-emerald-100/70 px-2.5 py-1 font-medium">Live AI responses enabled</span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">Steward handoff ready</span>
          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 font-medium">Artifacts saved locally</span>
        </div>
      </header>

      <div className="flex-1 min-h-0 grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_300px] gap-4">
        <OGenticChatPanel
          handoff={handoff}
          onCreateDraftArtifact={(title, content) => {
            addArtifact("analysis", title, content);
          }}
        />

        <div className="hidden 2xl:flex 2xl:flex-col gap-4 min-h-0">
          <OGenticToolPanel />
          <OGenticArtifactPanel artifacts={artifacts} />
        </div>
      </div>
    </div>
  );
}
