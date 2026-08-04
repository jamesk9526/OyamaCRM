/** Searchable, grouped navigation for the Settings workspace. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Search, Settings2, X } from "lucide-react";
import { useMemo, useState } from "react";
import OyamaDonorPackIcon from "@/app/components/ui/OyamaDonorPackIcon";

type IconSlug = "donor-dashboard" | "documentation" | "constituents" | "fund-designation" | "users" | "system-status" | "field-mapping" | "event-fundraising" | "steward-ai" | "integrations" | "quickbooks-queue" | "communications" | "giving-trends" | "reports" | "help";

interface SettingsNavItem {
  label: string;
  href: string;
  description: string;
  iconSlug: IconSlug;
}

interface SettingsNavGroup {
  label: string;
  items: SettingsNavItem[];
}

const SETTINGS_NAV: SettingsNavGroup[] = [
  {
    label: "Account",
    items: [
      { label: "Overview", href: "/settings", description: "Settings home", iconSlug: "donor-dashboard" },
      { label: "My Profile", href: "/settings/profile", description: "Personal details and activity", iconSlug: "users" },
      { label: "My Appearance", href: "/settings/appearance", description: "Personal workspace display", iconSlug: "fund-designation" },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Organization", href: "/settings/organization", description: "Identity, region, and email", iconSlug: "constituents" },
      { label: "Branding", href: "/settings/branding", description: "Logos and public colors", iconSlug: "fund-designation" },
      { label: "Users", href: "/settings/users", description: "Team accounts and access", iconSlug: "users" },
      { label: "Roles & Scopes", href: "/settings/roles", description: "Permission reference", iconSlug: "system-status" },
      { label: "Security & Audit", href: "/settings/security", description: "Authentication and recovery", iconSlug: "system-status" },
    ],
  },
  {
    label: "Workspace",
    items: [
      { label: "CRM Modules", href: "/settings/modules", description: "Module access and readiness", iconSlug: "field-mapping" },
      { label: "Events CRM", href: "/settings/events", description: "Event workspace defaults", iconSlug: "event-fundraising" },
      { label: "AI Assistant", href: "/settings/ai", description: "Steward AI connections", iconSlug: "steward-ai" },
      { label: "Dashboard", href: "/settings/dashboard-appearance", description: "Shared dashboard layout", iconSlug: "donor-dashboard" },
      { label: "Integrations", href: "/settings/integrations", description: "Connected services", iconSlug: "integrations" },
      { label: "Giving Payments", href: "/integrations/stripe", description: "Stripe and PayPal", iconSlug: "quickbooks-queue" },
      { label: "Site Embeds", href: "/settings/site-embeds", description: "Website forms and widgets", iconSlug: "communications" },
      { label: "Import & Export", href: "/settings/import-export", description: "Move and back up data", iconSlug: "documentation" },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Desktop App", href: "/settings/desktop-app", description: "Windows application", iconSlug: "documentation" },
      { label: "System Updates", href: "/settings/system-updates", description: "Release management", iconSlug: "giving-trends" },
      { label: "System Status", href: "/settings/system-status", description: "Health and readiness", iconSlug: "reports" },
      { label: "About", href: "/settings/about", description: "Version and support", iconSlug: "help" },
    ],
  },
];

export default function SettingsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return SETTINGS_NAV;
    return SETTINGS_NAV.map((group) => ({
      ...group,
      items: group.items.filter((item) => `${item.label} ${item.description}`.toLowerCase().includes(normalized)),
    })).filter((group) => group.items.length > 0);
  }, [query]);

  return (
    <aside className="flex max-h-[calc(100vh-7rem)] w-72 shrink-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Settings navigation">
      <div className="border-b border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-blue-50 p-4">
        <div className="flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm"><Settings2 size={20} aria-hidden="true" /></span>
          <div><p className="text-sm font-semibold text-slate-950">Settings</p><p className="text-xs text-slate-500">Manage OyamaCRM</p></div>
        </div>
        <label className="relative mt-4 block">
          <span className="sr-only">Search settings</span>
          <Search className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={16} aria-hidden="true" />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search settings" className="h-9 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-8 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Clear settings search" className="absolute right-2 top-2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button> : null}
        </label>
      </div>
      <nav className="overflow-y-auto p-3">
        {groups.length ? groups.map((group) => (
          <div key={group.label} className="mb-4 last:mb-0">
            <h2 className="mb-1 px-2 text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">{group.label}</h2>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = item.href === "/settings" ? pathname === item.href : pathname.startsWith(item.href);
                return <Link key={item.href} href={item.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={`group flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${active ? "bg-emerald-50 font-semibold text-emerald-800" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}>
                  <OyamaDonorPackIcon slug={item.iconSlug} size={17} alt="" />
                  <span className="min-w-0"><span className="block truncate">{item.label}</span><span className={`block truncate text-[11px] font-normal ${active ? "text-emerald-600" : "text-slate-400"}`}>{item.description}</span></span>
                </Link>;
              })}
            </div>
          </div>
        )) : <div className="px-2 py-8 text-center"><p className="text-sm font-medium text-slate-700">No settings found</p><p className="mt-1 text-xs text-slate-500">Try a broader search.</p></div>}
      </nav>
    </aside>
  );
}
