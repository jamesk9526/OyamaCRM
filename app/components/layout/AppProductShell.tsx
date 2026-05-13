// AppProductShell renders a basic non-CRM shell for standalone product apps.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

interface AppProductNavItem {
  /** Navigation label shown in the app sidebar. */
  label: string;
  /** Route target for this app-only navigation item. */
  href: string;
}

interface AppProductShellProps {
  /** Public-facing app title in the top strip. */
  appName: string;
  /** Small helper subtitle for context about this app. */
  appSubtitle: string;
  /** App-only navigation links. */
  navItems: AppProductNavItem[];
  /** Main app content region. */
  children: React.ReactNode;
}

/**
 * AppProductShell intentionally excludes CRM TopBar features such as global search and AI controls.
 * Use this shell for standalone apps that should look platform-native without becoming CRM modules.
 */
export default function AppProductShell({ appName, appSubtitle, navItems, children }: AppProductShellProps) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex flex-col h-screen bg-white">
      <header className="h-14 shrink-0 w-full flex items-center justify-between px-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700/70">
        <div className="flex items-center gap-3 min-w-0">
          <span className="w-8 h-8 rounded-lg bg-emerald-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
            A
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white truncate">{appName}</p>
            <p className="text-[10px] text-slate-300 truncate">{appSubtitle}</p>
          </div>
        </div>
        <Link
          href="/"
          className="text-xs font-medium text-slate-200 hover:text-white border border-white/20 rounded-lg px-2.5 py-1.5"
        >
          Back to CRM
        </Link>
      </header>

      <div className="flex flex-1 overflow-hidden">
        <aside className="hidden md:flex w-56 shrink-0 bg-white border-r border-slate-200 flex-col h-full">
          <div className="px-3 py-2 border-b border-slate-100">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">App Navigation</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
            {navItems.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "text-slate-600 border border-transparent hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-3 py-2 border-t border-slate-100">
            <p className="text-[11px] text-slate-500">Standalone app shell</p>
          </div>
        </aside>

        {mobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <button
              aria-label="Close app navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute inset-0 bg-black/35"
            />
            <aside className="absolute inset-y-0 left-0 w-56 max-w-[86vw] bg-white border-r border-slate-200 flex flex-col h-full shadow-2xl">
              <div className="px-3 py-2 border-b border-slate-100">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">App Navigation</p>
              </div>
              <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
                {navItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                        active
                          ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                          : "text-slate-600 border border-transparent hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
              <div className="px-3 py-2 border-t border-slate-100">
                <p className="text-[11px] text-slate-500">Standalone app shell</p>
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-auto bg-slate-50 p-3 sm:p-4 md:p-6">
          <div className="md:hidden mb-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Menu
            </button>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
