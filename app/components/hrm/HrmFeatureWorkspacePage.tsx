// Shared scaffold surface for first-pass OyamaHRM feature pages.

import Link from "next/link";
import FeatureStatusWarning from "@/app/components/ui/FeatureStatusWarning";

interface HrmFeatureWorkspacePageProps {
  title: string;
  description: string;
  statusNote: string;
  highlights: string[];
  nextActions?: Array<{ label: string; href: string }>;
}

/** HrmFeatureWorkspacePage renders a reusable in-development shell for HRM feature routes. */
export default function HrmFeatureWorkspacePage({
  title,
  description,
  statusNote,
  highlights,
  nextActions = [],
}: HrmFeatureWorkspacePageProps) {
  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">OyamaHRM Workspace</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600 max-w-3xl">{description}</p>
      </header>

      <FeatureStatusWarning
        status="In Development"
        title={`${title} Is In Active Build`}
        description={statusNote}
      />

      <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Current Highlights</h2>
        <ul className="mt-2 space-y-1 text-sm text-gray-700">
          {highlights.map((item) => (
            <li key={item} className="rounded-md bg-gray-50 border border-gray-100 px-3 py-2">{item}</li>
          ))}
        </ul>
      </article>

      {nextActions.length > 0 ? (
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Next Actions</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {nextActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="rounded-lg border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100"
              >
                {action.label}
              </Link>
            ))}
          </div>
        </article>
      ) : null}
    </section>
  );
}
