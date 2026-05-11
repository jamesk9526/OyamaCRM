// Apps home page describes platform app boundaries and available standalone apps.

import Link from "next/link";

/**
 * AppsHomePage introduces standalone apps and clarifies they do not expose CRM data by default.
 */
export default function AppsHomePage() {
  return (
    <section className="max-w-3xl space-y-4">
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Apps Workspace</h1>
        <p className="text-sm text-slate-600 mt-1">
          Apps are not CRM modules. They run in a basic shell and do not inherit CRM search, AI controls,
          or CRM data access without explicit integration work.
        </p>
      </header>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-800">Available app</h2>
        <div className="mt-3">
          <Link
            href="/apps/trivia"
            className="inline-flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Open Trivia Software
          </Link>
        </div>
      </div>
    </section>
  );
}
