// Dark themed sidebar for the OyamaWatchdog security module.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  label: string;
  href: string;
  description: string;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Security Dashboard", href: "/watchdog", description: "Cross-CRM security monitor" },
  { label: "Password Vault", href: "/watchdog#vault", description: "Encrypted credential storage" },
  { label: "Security Feed", href: "/watchdog#feed", description: "High-risk events and alerts" },
  { label: "Access Matrix", href: "/watchdog#access", description: "Fine-grained Watchdog controls" },
];

/** WatchdogSidebar renders navigation for the dark OyamaWatchdog module shell. */
export default function WatchdogSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-[#0a0f19] border-r border-[#1f2937] flex flex-col h-full select-none">
      <div className="px-4 py-4 border-b border-[#1f2937]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-600/90 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 2l8 4v6c0 5.5-3.5 9.74-8 10-4.5-.26-8-4.5-8-10V6l8-4zm0 7v4m0 4h.01" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-100">OyamaWatchdog</p>
            <p className="text-[11px] text-red-300">Highest Admin Security CRM</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === "/watchdog" && item.href.startsWith("/watchdog");
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`mx-2 block rounded-lg px-3 py-2 border transition-colors ${
                active
                  ? "border-red-500/40 bg-red-500/10 text-red-200"
                  : "border-transparent text-gray-300 hover:text-gray-100 hover:bg-gray-800/60"
              }`}
            >
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{item.description}</p>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[#1f2937] px-4 py-3">
        <p className="text-[11px] text-gray-400">Security telemetry across Donor, Compassion, Events, WebMaster.</p>
      </div>
    </aside>
  );
}
