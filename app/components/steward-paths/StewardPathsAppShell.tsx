"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import CrmBrandLockup from "@/app/components/layout/CrmBrandLockup";
import OyamaAdvancedIcon from "@/app/components/ui/OyamaAdvancedIcon";
import OyamaDonorPackIcon from "@/app/components/ui/OyamaDonorPackIcon";

interface StewardPathsAppShellProps {
  children: React.ReactNode;
}

interface StewardNavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
}

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
    id: "livecom",
    label: "LiveCom",
    href: "/steward-paths/livecom",
    icon: <OyamaDonorPackIcon slug="communications" size={16} className="h-4 w-4 rounded-full" alt="" />,
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

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-[100dvh] min-h-[100svh] overflow-hidden bg-[#f4f6f8]">
      <aside className="hidden h-full w-72 shrink-0 flex-col bg-gradient-to-b from-[#024637] via-[#033b31] to-[#042d27] text-emerald-50 lg:flex">
        <div className="border-b border-emerald-200/15 px-5 py-5">
          <CrmBrandLockup moduleLabel="Steward Paths CRM" tone="light" className="w-full" />
        </div>

        <div className="px-5 pb-2 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-100/70">Steward Paths</p>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3">
          {STEWARD_NAV_ITEMS.map((item) => {
            const active = isPathActive(pathname, item);
            return (
              <Link
                key={item.id}
                href={item.href}
                className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? "bg-emerald-400/20 text-white"
                    : "text-emerald-100/85 hover:bg-emerald-300/10 hover:text-white"
                }`}
              >
                <span className="shrink-0">{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-2 border-t border-emerald-200/15 p-3">
          <Link
            href="/help?scope=donor&scopePath=/steward-paths"
            className="block rounded-xl border border-emerald-200/20 bg-emerald-200/10 px-3 py-2.5 text-sm text-emerald-50 hover:bg-emerald-200/15"
          >
            <span className="block font-semibold">Need Help?</span>
            <span className="block text-xs text-emerald-100/85">Steward Paths Guide</span>
          </Link>
          <Link
            href="/"
            className="block rounded-xl border border-emerald-200/20 px-3 py-2.5 text-sm font-semibold text-emerald-50 hover:bg-emerald-200/10"
          >
            Back to CRM
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
            <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[86vw] flex-col bg-gradient-to-b from-[#024637] via-[#033b31] to-[#042d27] p-3 text-emerald-50 shadow-2xl">
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
                          ? "bg-emerald-400/20 text-white"
                          : "text-emerald-100/85 hover:bg-emerald-300/10 hover:text-white"
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
