// TriviaAppShell provides a dark, animated standalone shell for the Oyama Trivia add-on.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface TriviaAppShellProps {
  /** Main content region for trivia routes. */
  children: React.ReactNode;
}

const TRIVIA_NAV_ITEMS = [
  { label: "Dashboard", href: "/apps/trivia" },
  { label: "Events", href: "/apps/trivia/events" },
  { label: "Create Event", href: "/apps/trivia/events/new" },
];

/**
 * TriviaAppShell creates a high-contrast, host-friendly workspace for live game operations.
 * It intentionally excludes CRM shell features and keeps controls focused for event hosts.
 */
export default function TriviaAppShell({ children }: TriviaAppShellProps) {
  const pathname = usePathname();

  return (
    <div className="relative min-h-screen h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="pointer-events-none absolute -top-20 -left-20 h-64 w-64 rounded-full bg-emerald-500/20 blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-28 -right-24 h-72 w-72 rounded-full bg-cyan-500/15 blur-3xl animate-pulse" />

      <header className="relative z-10 h-14 border-b border-white/10 bg-black/35 backdrop-blur px-4 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <span className="h-8 w-8 rounded-lg bg-emerald-500 text-black font-bold flex items-center justify-center">T</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">Oyama Trivia</p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-emerald-300 truncate">Standalone Add-on Module</p>
          </div>
        </div>
        <Link href="/apps" className="text-xs text-slate-300 hover:text-white border border-white/20 rounded-lg px-3 py-1.5">
          Apps Home
        </Link>
      </header>

      <div className="relative z-10 flex h-[calc(100%-3.5rem)]">
        <aside className="w-60 shrink-0 border-r border-white/10 bg-black/30 backdrop-blur">
          <div className="px-3 py-2 border-b border-white/10">
            <p className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Trivia Navigation</p>
          </div>
          <nav className="p-2 space-y-1">
            {TRIVIA_NAV_ITEMS.map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`block rounded-lg px-3 py-2 text-sm transition-colors border ${
                    active
                      ? "border-emerald-400/70 bg-emerald-500/20 text-emerald-100"
                      : "border-transparent text-slate-300 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <div className="px-3 py-3 border-t border-white/10 mt-auto">
            <p className="text-xs text-slate-400">No CRM search bar or AI controls in this shell.</p>
          </div>
        </aside>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
