"use client";

import Link from "next/link";
import { findWebmasterModuleStatus } from "@/app/modules/webmaster/module-status";

const TITLES: Record<string, string> = {
  templates: "Templates",
  cms: "CMS Collections",
  assets: "Assets",
  forms: "Forms",
  settings: "Site Settings",
  sites: "Sites",
  theme: "Brand Kit",
  publishing: "Publishing",
  seo: "SEO",
};

interface WebmasterWorkspacePlaceholderProps {
  workspace: string;
}

/** Placeholder page for visible but incomplete workspaces with explicit dev warning copy. */
export default function WebmasterWorkspacePlaceholder({ workspace }: WebmasterWorkspacePlaceholderProps) {
  const title = TITLES[workspace] ?? "Workspace";
  const status = findWebmasterModuleStatus(workspace);

  return (
    <div className="max-w-3xl space-y-4">
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">Still Being Developed</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-700">
          This workspace is visible so your team can track progress, but advanced workflows here are not fully implemented yet.
          Actions in this screen are informational only until status reaches Working.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-2">
        <p className="text-sm"><span className="font-semibold text-slate-900">Status:</span> <span className="text-slate-700">{status?.status ?? "Not Started"}</span></p>
        <p className="text-sm text-slate-700">{status?.note ?? "Implementation details for this workspace are still being defined."}</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="text-sm font-semibold text-slate-900">Available Right Now</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-700 list-disc pl-5">
          <li>Manage websites and pages from the dashboard.</li>
          <li>Open the visual builder shell and save section-first page content.</li>
          <li>Track module readiness in docs/IMPLEMENTATION_STATUS.md.</li>
        </ul>
        <div className="mt-4">
          <Link href="/webmaster" className="inline-flex px-4 py-2 text-sm rounded-lg bg-slate-900 text-white hover:bg-slate-800">
            Back to Webmaster Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
