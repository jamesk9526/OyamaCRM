"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Search, X } from "lucide-react";
import WorkspaceBreadcrumbBar from "@/app/components/layout/WorkspaceBreadcrumbBar";
import OyamaDonorPackIcon from "@/app/components/ui/OyamaDonorPackIcon";
import { SETTINGS_NAV } from "@/app/components/settings/settings-navigation";

const SHORTCUTS = [
  { title: "AI access", description: "Set what ChatGPT can read and change.", href: "/settings/ai-access" },
  { title: "Team access", description: "Manage accounts, roles and staff permissions.", href: "/settings/users" },
  { title: "Organization", description: "Update nonprofit identity and regional defaults.", href: "/settings/organization" },
  { title: "Integrations", description: "Connect ChatGPT and other services.", href: "/settings/integrations" },
];

export default function SettingsOverviewPage() {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return SETTINGS_NAV.map(group => ({ ...group, items: group.items.filter(item => item.href !== "/settings" && terms.every(term => `${group.label} ${item.label} ${item.description}`.toLowerCase().includes(term))) })).filter(group => group.items.length);
  }, [query]);

  return <div className="space-y-5 text-slate-900">
    <WorkspaceBreadcrumbBar items={[{ label: "Donor CRM", href: "/" }, { label: "Settings" }]} metadata="Account and organization controls" />
    <header className="rounded-xl border border-blue-200 bg-blue-50/60 p-5">
      <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Find account preferences, organization controls and connected tools in one place.</p>
      <label className="relative mt-4 block max-w-2xl">
        <span className="sr-only">Find a setting</span>
        <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-3.5 text-slate-500" />
        <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search settings, permissions, payments…" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-12 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700" />
        {query && <button type="button" aria-label="Clear overview search" onClick={() => setQuery("")} className="absolute right-1 top-1 grid h-9 w-9 place-items-center rounded-md text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-blue-700"><X size={18} /></button>}
      </label>
    </header>
    {!query.trim() && <section aria-label="Frequently used settings" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {SHORTCUTS.map(item => <Link key={item.href} href={item.href} className="group rounded-xl border border-slate-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
        <span className="flex items-center justify-between gap-2 text-sm font-semibold">{item.title}<ArrowRight size={16} aria-hidden="true" className="text-blue-700" /></span>
        <p className="mt-2 text-sm leading-5 text-slate-600">{item.description}</p>
      </Link>)}
    </section>}
    <section aria-label="Settings categories">
      <p role="status" className="mb-3 text-sm text-slate-600">{query.trim() ? `${groups.reduce((count, group) => count + group.items.length, 0)} matching settings` : "Browse by category"}</p>
      {groups.length ? <div className="grid items-start gap-4 xl:grid-cols-2">
        {groups.map(group => <section key={group.label} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5" aria-label={group.label}>
          <h2 className="font-semibold">{group.label}</h2>
          <p className="mt-1 text-sm text-slate-600">{group.description}</p>
          <ul className="mt-4 divide-y divide-slate-100 border-t border-slate-100">
            {group.items.map(item => <li key={item.href}><Link href={item.href} className="group flex min-h-16 items-center gap-3 rounded-md py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 hover:bg-blue-50/50">
              <OyamaDonorPackIcon slug={item.iconSlug} size={19} alt="" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-900">{item.label}</span><span className="mt-0.5 block text-xs leading-5 text-slate-600">{item.description}</span></span>
              <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-slate-400 group-hover:text-blue-700" />
            </Link></li>)}
          </ul>
        </section>)}
      </div> : <div className="rounded-xl border border-slate-200 bg-white p-8 text-center"><h2 className="font-semibold">No matching settings</h2><p className="mt-2 text-sm text-slate-600">Try a different word or clear your search to browse the categories.</p><button type="button" onClick={() => setQuery("")} className="mt-4 min-h-11 rounded-lg border border-slate-300 px-4 text-sm font-medium focus-visible:outline-2 focus-visible:outline-blue-700">Show all settings</button></div>}
    </section>
    <Link href="/settings/system" className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-blue-700 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-blue-700">Open system details <ArrowRight size={16} aria-hidden="true" /></Link>
  </div>;
}
