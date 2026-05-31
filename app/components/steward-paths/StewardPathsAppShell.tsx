"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import CrmBrandLockup from "@/app/components/layout/CrmBrandLockup";
import OyamaAdvancedIcon from "@/app/components/ui/OyamaAdvancedIcon";

interface StewardPathsAppShellProps {
  children: React.ReactNode;
}

interface StewardNavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

const STEWARD_SIDEBAR_COLLAPSED_STORAGE_KEY = "oyamacrm.sidebar.steward-paths.collapsed";

const STEWARD_NAV_ITEMS: StewardNavItem[] = [
  {
    id: "library",
    label: "Path Library",
    href: "/steward-paths/library",
    icon: <OyamaAdvancedIcon name="path-library" size={16} className="h-4 w-4" />,
  },
  {
    id: "builder",
    label: "Builder",
    href: "/steward-paths/builder",
    icon: <OyamaAdvancedIcon name="builder" size={16} className="h-4 w-4" />,
  },
  {
    id: "enrollments",
    label: "Enrollments",
    href: "/steward-paths/enrollments",
    icon: <OyamaAdvancedIcon name="enrollments" size={16} className="h-4 w-4" />,
  },
  {
    id: "activity",
    label: "Activity",
    href: "/steward-paths/activity",
    icon: <OyamaAdvancedIcon name="activity" size={16} className="h-4 w-4" />,
  },
  {
    id: "analytics",
    label: "Analytics",
    href: "/steward-paths/analytics",
    icon: <OyamaAdvancedIcon name="analytics" size={16} className="h-4 w-4" />,
  },
  {
    id: "settings",
    label: "Settings",
    href: "/steward-paths/settings",
    icon: <OyamaAdvancedIcon name="settings" size={16} className="h-4 w-4" />,
  },
];

function isPathActive(pathname: string, item: StewardNavItem): boolean {
  if (item.id === "library") {
    if (pathname === "/steward-paths") return true;
    if (pathname === "/steward-paths/library") return true;
    if (pathname === "/steward-paths/library/") return true;
    if (pathname === "/steward-paths/") return true;
    return false;
  }

  if (item.id === "builder") {
    if (pathname.includes("/playground")) return true;
  }

  if (item.id === "activity") {
    if (pathname.includes("/history")) return true;
  }

  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function StewardPathsAppShell({ children }: StewardPathsAppShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [desktopNavCollapsed, setDesktopNavCollapsed] = useState(false);
  const [desktopNavHydrated, setDesktopNavHydrated] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const persisted = window.localStorage.getItem(STEWARD_SIDEBAR_COLLAPSED_STORAGE_KEY);
    if (persisted === "1" || persisted === "0") {
      setDesktopNavCollapsed(persisted === "1");
    }
    setDesktopNavHydrated(true);
  }, []);

  useEffect(() => {
    if (!desktopNavHydrated || typeof window === "undefined") return;
    window.localStorage.setItem(STEWARD_SIDEBAR_COLLAPSED_STORAGE_KEY, desktopNavCollapsed ? "1" : "0");
  }, [desktopNavCollapsed, desktopNavHydrated]);

  return (
    <div className="flex h-[100dvh] min-h-[100svh] overflow-hidden bg-[#f5f7fa]">
      <aside
        className={`hidden h-full shrink-0 flex-col bg-[radial-gradient(circle_at_20%_0%,#07583a_0,#043d2f_42%,#02251f_100%)] text-emerald-50 transition-[width] duration-200 ease-out lg:flex ${desktopNavCollapsed ? "w-[76px]" : "w-[244px]"}`}
        data-sidebar-collapsed={desktopNavCollapsed ? "true" : "false"}
      >
        <div className={`border-b border-white/10 ${desktopNavCollapsed ? "px-2 py-4" : "px-4 py-5"}`}>
          <div className={`flex ${desktopNavCollapsed ? "flex-col items-center gap-2" : "items-start justify-between gap-3"}`}>
            <CrmBrandLockup
              moduleLabel={desktopNavCollapsed ? "Steward Paths" : "Steward Paths"}
              tone="light"
              compact={desktopNavCollapsed}
              className={desktopNavCollapsed ? "w-full" : "w-full"}
            />
            <button
              type="button"
              aria-label={desktopNavCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!desktopNavCollapsed}
              onClick={() => setDesktopNavCollapsed((prev) => !prev)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/20 bg-white/10 text-emerald-100 transition hover:bg-white/15 hover:text-white"
            >
              {desktopNavCollapsed ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m9 6 6 6-6 6" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m15 6-6 6 6 6" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {!desktopNavCollapsed ? (
          <div className="px-5 pb-2 pt-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-100/75">Steward Paths</p>
          </div>
        ) : null}

        <nav className={`flex-1 space-y-1.5 overflow-y-auto ${desktopNavCollapsed ? "px-2" : "px-3"}`}>
          {STEWARD_NAV_ITEMS.map((item) => {
            const active = isPathActive(pathname, item);
            return (
              <Link
                key={item.id}
                href={item.href}
                title={desktopNavCollapsed ? item.label : undefined}
                aria-label={desktopNavCollapsed ? item.label : undefined}
                className={`flex h-11 items-center rounded-xl text-sm font-semibold transition ${
                  desktopNavCollapsed ? "justify-center px-2 py-2.5" : "gap-2.5 px-3 py-2.5"
                } ${
                  active
                    ? "bg-emerald-500/55 text-white shadow-inner"
                    : "text-emerald-50/90 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                {!desktopNavCollapsed ? <span>{item.label}</span> : null}
              </Link>
            );
          })}
        </nav>

        <div className={`space-y-3 border-t border-white/10 ${desktopNavCollapsed ? "p-2" : "p-3"}`}>
          <Link
            href="/help?scope=donor&scopePath=/steward-paths"
            title={desktopNavCollapsed ? "Steward Paths Guide" : undefined}
            aria-label={desktopNavCollapsed ? "Steward Paths Guide" : undefined}
            className={`block rounded-xl border border-white/15 bg-white/[0.08] text-emerald-50 hover:bg-white/[0.12] ${desktopNavCollapsed ? "px-2 py-2 text-center" : "px-3 py-3 text-sm"}`}
          >
            {!desktopNavCollapsed ? (
              <>
                <span className="block font-semibold">Need Help?</span>
                <span className="block text-xs text-emerald-100/85">Steward Paths Guide</span>
              </>
            ) : (
              <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.09 9a3 3 0 1 1 5.82 1c0 2-3 3-3 3" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 17h.01" />
              </svg>
            )}
          </Link>
          <Link
            href="/"
            title={desktopNavCollapsed ? "Back to CRM" : undefined}
            aria-label={desktopNavCollapsed ? "Back to CRM" : undefined}
            className={`block rounded-xl border border-white/15 font-semibold text-emerald-50 hover:bg-white/10 ${desktopNavCollapsed ? "px-2 py-2 text-center" : "px-3 py-3 text-sm"}`}
          >
            {!desktopNavCollapsed ? (
              "Back to CRM"
            ) : (
              <svg className="mx-auto h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            )}
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-300 text-slate-700"
            aria-label="Open navigation"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <p className="text-sm font-semibold text-slate-900">Steward Paths</p>
          <Link href="/" className="text-xs font-semibold text-emerald-700">Back to CRM</Link>
        </header>

        {mobileNavOpen ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Close navigation"
              className="absolute inset-0 bg-slate-950/45"
              onClick={() => setMobileNavOpen(false)}
            />
            <aside className="absolute inset-y-0 left-0 flex w-[244px] max-w-[86vw] flex-col bg-[radial-gradient(circle_at_20%_0%,#07583a_0,#043d2f_42%,#02251f_100%)] p-3 text-emerald-50 shadow-2xl">
              <div className="px-2 pb-3 pt-1">
                <CrmBrandLockup moduleLabel="Steward Paths CRM" tone="light" className="w-full" />
              </div>
              <nav className="flex-1 space-y-1 overflow-y-auto">
                {STEWARD_NAV_ITEMS.map((item) => {
                  const active = isPathActive(pathname, item);
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                        active
                          ? "bg-emerald-500/55 text-white"
                          : "text-emerald-100/85 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="shrink-0">{item.icon}</span>
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </nav>
              <Link
                href="/"
                className="mt-2 rounded-xl border border-emerald-200/20 px-3 py-2.5 text-sm font-semibold text-emerald-50"
              >
                Back to CRM
              </Link>
            </aside>
          </div>
        ) : null}

        <main className="min-h-0 flex-1 overflow-hidden">
          <div className="h-full min-w-0 max-w-full overflow-hidden">{children}</div>
        </main>
      </div>
    </div>
  );
}
