/** Settings overview organized around common staff and administrator goals. */
import Link from "next/link";
import { ArrowRight, Building2, CircleUserRound, PlugZap, ShieldCheck, Sparkles, UsersRound, Wrench } from "lucide-react";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";

const PRIMARY_ACTIONS = [
  { title: "My profile", description: "Update your contact details, job information, and timezone.", href: "/settings/profile", icon: CircleUserRound, tone: "blue" },
  { title: "Organization", description: "Manage nonprofit identity, fiscal year, regional, and email defaults.", href: "/settings/organization", icon: Building2, tone: "emerald" },
  { title: "Team access", description: "Invite staff, manage accounts, and review role permissions.", href: "/settings/users", icon: UsersRound, tone: "violet" },
  { title: "Integrations", description: "Review connected services, payments, email, and website tools.", href: "/settings/integrations", icon: PlugZap, tone: "amber" },
] as const;

const GROUPS = [
  { title: "Personalize", description: "Control how OyamaCRM looks for you and your team.", icon: Sparkles, links: [["My appearance", "/settings/appearance"], ["Dashboard appearance", "/settings/dashboard-appearance"], ["Branding", "/settings/branding"]] },
  { title: "Configure workspaces", description: "Choose the modules and tools your organization uses.", icon: Wrench, links: [["CRM modules", "/settings/modules"], ["Events CRM", "/settings/events"], ["AI assistant", "/settings/ai"], ["Site embeds", "/settings/site-embeds"]] },
  { title: "Protect your data", description: "Review access controls and move organizational data safely.", icon: ShieldCheck, links: [["Security & audit", "/settings/security"], ["Roles & scopes", "/settings/roles"], ["Import & export", "/settings/import-export"]] },
] as const;

const TONES = { blue: "bg-blue-50 text-blue-700", emerald: "bg-emerald-50 text-emerald-700", violet: "bg-violet-50 text-violet-700", amber: "bg-amber-50 text-amber-700" };

export default function SettingsOverviewPage() {
  return <div className="space-y-6">
    <WorkspaceBreadcrumbBar items={[{ label: "Donor CRM", href: "/" }, { label: "Settings" }]} metadata="Organization and account controls" />

    <header className="overflow-hidden rounded-2xl border border-slate-200 bg-[linear-gradient(120deg,#ecfdf5,#ffffff_48%,#eff6ff)] px-5 py-7 shadow-sm sm:px-7">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">Settings center</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">What would you like to manage?</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Update your own preferences or manage organization-wide configuration. Changes that affect other staff are clearly identified on their settings page.</p>
    </header>

    <section aria-labelledby="common-settings-heading">
      <div className="mb-3 flex items-end justify-between gap-4"><div><h2 id="common-settings-heading" className="text-base font-semibold text-slate-950">Common settings</h2><p className="mt-0.5 text-sm text-slate-500">The places administrators and staff use most often.</p></div></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {PRIMARY_ACTIONS.map((item) => { const Icon = item.icon; return <Link key={item.href} href={item.href} className="group rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500">
          <span className={`grid h-10 w-10 place-items-center rounded-xl ${TONES[item.tone]}`}><Icon size={20} aria-hidden="true" /></span>
          <h3 className="mt-4 flex items-center justify-between gap-2 text-sm font-semibold text-slate-950">{item.title}<ArrowRight size={16} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" aria-hidden="true" /></h3>
          <p className="mt-1.5 text-sm leading-5 text-slate-500">{item.description}</p>
        </Link>; })}
      </div>
    </section>

    <section aria-labelledby="all-settings-heading">
      <h2 id="all-settings-heading" className="text-base font-semibold text-slate-950">More settings</h2>
      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        {GROUPS.map((group) => { const Icon = group.icon; return <article key={group.title} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon size={18} aria-hidden="true" /></span><div><h3 className="text-sm font-semibold text-slate-950">{group.title}</h3><p className="mt-1 text-xs leading-5 text-slate-500">{group.description}</p></div></div>
          <div className="mt-4 divide-y divide-slate-100 border-t border-slate-100">{group.links.map(([label, href]) => <Link key={href} href={href} className="group flex items-center justify-between py-2.5 text-sm font-medium text-slate-700 hover:text-emerald-700">{label}<ArrowRight size={15} className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-emerald-600" aria-hidden="true" /></Link>)}</div>
        </article>; })}
      </div>
    </section>

    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div><p className="font-semibold text-slate-800">Looking for technical controls?</p><p className="mt-0.5 text-slate-500">System updates, health checks, desktop downloads, and version details are under System in the settings menu.</p></div>
      <Link href="/settings/system" className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800">Open system details <ArrowRight size={16} aria-hidden="true" /></Link>
    </div>
  </div>;
}
