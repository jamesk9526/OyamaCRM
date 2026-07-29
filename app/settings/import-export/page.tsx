import Link from "next/link";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import WorkspaceRibbon from "@/app/components/workspace-ribbon/WorkspaceRibbon";
import WorkspaceRibbonButton from "@/app/components/workspace-ribbon/WorkspaceRibbonButton";
import WorkspaceRibbonGroup from "@/app/components/workspace-ribbon/WorkspaceRibbonGroup";

/** Data operations landing page with the canonical full-backup handoff. */
export default function ImportExportSettingsPage() {
  return (
    <div className="space-y-5 pb-8">
      <WorkspaceBreadcrumbBar items={[{ label: "Donor CRM", href: "/" }, { label: "Settings", href: "/settings" }, { label: "Import & export" }]} metadata="Data operations" />
      <WorkspaceRibbon>
        <WorkspaceRibbonGroup label="Data">
          <WorkspaceRibbonButton label="Import center" href="/data-tools/import" />
          <WorkspaceRibbonButton label="Data tools" href="/data-tools" />
          <WorkspaceRibbonButton label="Full backup" href="/watchdog/backups" />
        </WorkspaceRibbonGroup>
      </WorkspaceRibbon>

      <section className="crm-page-header-surface border p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f6cbd]">Data operations</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">Import, export, and recover CRM data</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Use the import center for reviewed data intake. Administrators can create or restore the complete portable CRM backup package from Watchdog.
        </p>
      </section>

      <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
        <section className="border border-emerald-200 bg-[linear-gradient(135deg,#f0fdf4,#ffffff_58%)] p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-800">Full CRM recovery</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Portable backup ZIP</h2>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            The backup workspace creates one re-importable package with CRM records, SQL, database-stored configuration, and local images, video, documents, email assets, letter assets, and trivia media. ZIP contents are verified before a restore starts.
          </p>
          <p className="mt-3 text-xs leading-5 text-slate-600">
            Backup and restore are intentionally restricted to Watchdog administrators. Restore requires a typed confirmation and a reason, then creates a pre-restore database snapshot and retains the prior uploads directory for verification.
          </p>
          <Link href="/watchdog/backups" className="mt-4 inline-flex bg-[#0f6cbd] px-3 py-2 text-sm font-semibold text-white hover:bg-[#115ea3]">Open full backup workspace</Link>
        </section>

        <section className="crm-shell-surface p-5">
          <h2 className="text-base font-semibold text-slate-900">Everyday data work</h2>
          <div className="mt-3 space-y-2 text-sm">
            <Link href="/data-tools/import" className="block border border-slate-200 bg-white px-3 py-3 text-slate-800 hover:border-[#0f6cbd] hover:bg-[#eff6fc]"><span className="font-semibold text-[#0f6cbd]">Import center</span><span className="mt-1 block text-xs text-slate-600">Map, validate, and review donor, donation, and event files before committing them.</span></Link>
            <Link href="/data-tools" className="block border border-slate-200 bg-white px-3 py-3 text-slate-800 hover:border-[#0f6cbd] hover:bg-[#eff6fc]"><span className="font-semibold text-[#0f6cbd]">Data tools</span><span className="mt-1 block text-xs text-slate-600">Use controlled cleanup, merge, and operational data tools.</span></Link>
          </div>
        </section>
      </div>
    </div>
  );
}
