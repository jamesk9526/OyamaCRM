/** Searchable, grouped navigation for the Settings workspace. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings2, X } from "lucide-react";
import { useMemo, useState } from "react";
import OyamaDonorPackIcon from "@/app/components/ui/OyamaDonorPackIcon";

import { SETTINGS_NAV } from "./settings-navigation";

export default function SettingsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SETTINGS_NAV;
    return SETTINGS_NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => normalized.split(/\s+/).every(term => `${group.label} ${item.label} ${item.description}`.toLowerCase().includes(term))),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <aside className="oyama-settings-sidebar flex max-h-[calc(100vh-7rem)] w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Settings navigation">
      <div className="border-b border-slate-200 bg-blue-50/60 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-blue-700 text-white shadow-sm"><Settings2 size={20} aria-hidden="true" /></span>
          <div><p className="text-sm font-semibold text-slate-950">Settings</p><p className="text-xs text-slate-500">Manage OyamaCRM</p></div>
        </div>
        <label className="relative mt-4 block">
          <span className="sr-only">Search settings</span>
          <Search className="pointer-events-none absolute left-3 top-3.5 text-slate-600" size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-12 text-sm text-slate-900 outline-none placeholder:text-slate-600 focus:border-blue-600 focus:ring-2 focus:ring-blue-100" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear settings search" className="absolute right-0 top-0 grid h-11 w-11 place-items-center rounded-lg text-slate-600 hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-blue-700"><X size={16} /></button> : null}
        </label>
      </div>
      <nav className="overflow-y-auto p-3">
        {groups.length ? groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <h2 className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-600">{group.label}</h2>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === "/settings" ? pathname === item.href : (pathname === item.href || pathname.startsWith(`${item.href}/`));
                return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 min-h-12 rounded-lg px-2.5 py-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700 ${active ? "bg-blue-50 font-semibold text-blue-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                  <OyamaDonorPackIcon slug={item.iconSlug} size={17} alt="" />
                  <span className="min-w-0"><span className="block truncate">{item.label}</span><span className={`block text-[11px] leading-4 font-normal ${active ? "text-blue-700" : "text-slate-600"}`}>{item.description}</span></span>
                </Link>;
              })}
            </div>
          </div>
        )) : <div className="px-2 py-8 text-center"><p className="text-sm font-medium text-slate-700">No settings found</p><p className="mt-1 text-xs text-slate-500">Try a broader search.</p></div>}
      </nav>
    </aside>
  );
}
