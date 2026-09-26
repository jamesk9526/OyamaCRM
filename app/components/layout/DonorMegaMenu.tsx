/** Daily Donor CRM navigation. Desktop and mobile use the same route catalog. */
"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { ChevronDown, Search, X } from "lucide-react";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import type { CrmSidebarItem } from "./CrmSidebar";
import { buildDonorDailyNavigation, isDonorNavigationItemVisible, resolveDonorNavigationActiveItem } from "./sidebar-configs";
import { useDialogFocus } from "@/app/components/ui/useDialogFocus";
import type { DonorAccentTone } from "@/app/lib/workspace-settings";

interface DonorMegaMenuProps {
  donorAccentTone?: DonorAccentTone;
  chromeTint?: { dark: string; mid: string; base: string; border: string };
  scrolled?: boolean;
}

export default function DonorMegaMenu({ chromeTint }: DonorMegaMenuProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const { qbEnabled } = usePlugins();
  const [mobileOpen, setMobileOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const groups = useMemo(() => buildDonorDailyNavigation({ qbEnabled }).map((group) => ({
    ...group,
    items: group.items.filter((item) => isDonorNavigationItemVisible(item, user)),
  })).filter((group) => group.items.length), [qbEnabled, user]);
  const activeItem = resolveDonorNavigationActiveItem(groups, pathname);

  useDialogFocus(dialogRef, mobileOpen, () => setMobileOpen(false));
  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const toggle = () => setMobileOpen((current) => !current);
    window.addEventListener("crm:toggle-donor-nav", toggle);
    return () => window.removeEventListener("crm:toggle-donor-nav", toggle);
  }, []);
  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 768px)");
    const closeOnDesktop = () => { if (desktop.matches) setMobileOpen(false); };
    desktop.addEventListener("change", closeOnDesktop);
    return () => desktop.removeEventListener("change", closeOnDesktop);
  }, []);

  function navigation(mobile: boolean) {
    const itemLink = (item: CrmSidebarItem) => (
      <Link key={item.id} href={item.href} aria-current={activeItem === item.id ? "page" : undefined}
        onClick={() => setMobileOpen(false)}
        className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 ${activeItem === item.id ? "bg-white/15 font-semibold text-white ring-1 ring-white/20" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}>
        <span className="h-[18px] w-[18px] shrink-0" aria-hidden="true">{item.icon}</span>
        <span>{item.label}</span>
      </Link>
    );
    return (
      <nav aria-label={mobile ? "Mobile Donor CRM" : "Donor CRM"} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
        {groups.map((group) => group.collapsible ? (
          <details key={`${group.id}-${pathname}`} open={group.items.some((item) => item.id === activeItem)} className="group border-t border-white/10 pt-2">
            <summary tabIndex={0} className="flex min-h-11 cursor-pointer list-none items-center justify-between rounded-lg px-3 text-xs font-semibold text-slate-300 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 [&::-webkit-details-marker]:hidden">
              {group.label}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-1 space-y-1">{group.items.map(itemLink)}</div>
          </details>
        ) : (
          <div key={group.id} className="space-y-1">
            <p className="px-3 pb-2 pt-1 text-xs font-semibold text-slate-300">{group.label}</p>
            {group.items.map(itemLink)}
          </div>
        ))}
      </nav>
    );
  }

  const railStyle = { backgroundColor: chromeTint?.dark ?? "#242424", borderColor: chromeTint?.border ?? "#424242" };
  return (
    <>
      <aside style={railStyle} className="fixed bottom-0 left-0 top-14 z-[19] hidden w-64 flex-col border-r md:flex">
        {navigation(false)}
        <button type="button" onClick={() => window.dispatchEvent(new Event("crm:focus-topbar-search"))}
          className="m-3 flex min-h-11 items-center gap-3 rounded-lg border border-white/20 px-3 text-sm text-slate-200 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
          <Search className="h-4 w-4" aria-hidden="true" />Search CRM
        </button>
      </aside>
      {mobileOpen ? (
        <div className="fixed inset-0 z-[65] md:hidden">
          <div className="absolute inset-0 bg-slate-950/45" onClick={() => setMobileOpen(false)} />
          <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="Donor CRM navigation" tabIndex={-1}
            style={railStyle} className="relative flex h-full w-[min(320px,90vw)] flex-col border-r pb-[env(safe-area-inset-bottom)] text-white">
            <div className="flex min-h-14 items-center justify-between border-b border-white/15 px-4">
              <span className="text-sm font-semibold">Donor CRM</span>
              <button type="button" data-modal-autofocus onClick={() => setMobileOpen(false)} aria-label="Close navigation"
                className="flex h-11 w-11 items-center justify-center rounded-lg hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            {navigation(true)}
          </div>
        </div>
      ) : null}
    </>
  );
}
