/** OGenticSidebar renders the left workspace navigation for chats, drafts, reports, and analyses. */

import type { OGenticArtifact } from "@/app/modules/ogentic/types/ogentic.types";

interface OGenticSidebarProps {
  recentChats: string[];
  artifacts: OGenticArtifact[];
  onNewChat: () => void;
}

/** OGenticSidebar provides navigational anchors for key control-center workspace sections. */
export default function OGenticSidebar({ recentChats, artifacts, onNewChat }: OGenticSidebarProps) {
  const draftCount = artifacts.filter((artifact) => artifact.type === "email_draft" || artifact.type === "letter_draft").length;
  const reportCount = artifacts.filter((artifact) => artifact.type === "report").length;
  const spreadsheetCount = artifacts.filter((artifact) => artifact.type === "spreadsheet").length;
  const analysisCount = artifacts.filter((artifact) => artifact.type === "analysis").length;

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-900">OGentic</h2>
        <button
          onClick={onNewChat}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-100"
        >
          New Chat
        </button>
      </div>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Recent Chats</p>
        <div className="mt-2 space-y-1.5">
          {recentChats.map((chat) => (
            <p key={chat} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs text-slate-700">{chat}</p>
          ))}
        </div>
      </section>

      <section>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Artifacts</p>
        <div className="mt-2 space-y-1.5 text-xs text-slate-700">
          <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">Saved drafts: {draftCount}</p>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">Saved reports: {reportCount}</p>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">Saved spreadsheets: {spreadsheetCount}</p>
          <p className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-2">Analysis runs: {analysisCount}</p>
        </div>
      </section>
    </aside>
  );
}
