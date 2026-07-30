import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";

const formLettersUrl = process.env.NEXT_PUBLIC_FORM_LETTERS_URL?.trim() || "http://localhost:8090";

/** Parallel feature hub: workspaces here never replace live CRM tools without an explicit cutover. */
export default function OyamaBetaFeaturesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 py-4">
      <WorkspaceBreadcrumbBar items={[{ label: "Donor CRM", href: "/" }, { label: "OYAMA-BETAFeatures" }]} statusLabel="Beta" metadata="Parallel replacement workspaces" accentTone="blue" />
      <section className="overflow-hidden rounded-xl border border-indigo-200 bg-white shadow-sm">
        <div className="border-b border-indigo-100 bg-[linear-gradient(135deg,#f5f3ff,#eef6ff)] px-6 py-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-700">Parallel workspaces</p><h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">OYAMA-BETAFeatures</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">Try replacement workflows here while the current CRM tools remain the live system of record. Beta actions still use your existing CRM permissions and audit trails.</p></div>
        <div className="grid gap-4 p-6 md:grid-cols-2"><article className="rounded-xl border border-slate-200 bg-slate-50 p-5"><p className="text-xs font-bold uppercase tracking-wide text-emerald-700">PHP · letter and email</p><h2 className="mt-1 text-lg font-semibold text-slate-950">Form Letters</h2><p className="mt-2 text-sm leading-6 text-slate-600">Search live donor records, create printable merged letters, generate CRM letter drafts, and create reviewable email drafts. It does not send email directly.</p><a href={formLettersUrl} className="mt-4 inline-flex rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800">Open Form Letters</a><p className="mt-3 text-xs leading-5 text-slate-500">Configure <code className="rounded bg-white px-1 py-0.5">NEXT_PUBLIC_FORM_LETTERS_URL</code> to the PHP app URL. Local default: http://localhost:8090.</p></article></div>
      </section>
    </div>
  );
}
