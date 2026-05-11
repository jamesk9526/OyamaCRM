// Dark themed sidebar for the OyamaWatchdog security module.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";

interface NavItem {
  label: string;
  href: string;
  description: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Security Dashboard", href: "/watchdog", description: "Cross-CRM security monitor", icon: <OyamaGradientIcon name="growth-analytics" size={16} /> },
  { label: "Feedback Tickets", href: "/watchdog/feedback-tickets", description: "Cross-CRM product feedback triage", icon: <OyamaGradientIcon name="reporting-dashboard" size={16} /> },
  { label: "Password Vault", href: "/watchdog#vault", description: "Encrypted credential storage", icon: <OyamaGradientIcon name="client-profile-sync" size={16} /> },
  { label: "Security Feed", href: "/watchdog#feed", description: "High-risk events and alerts", icon: <OyamaGradientIcon name="task-checklist" size={16} /> },
  { label: "Backup & Restore", href: "/watchdog#backup", description: "Full CRM export/import controls", icon: <OyamaGradientIcon name="contact-checklist" size={16} /> },
  { label: "Access Matrix", href: "/watchdog#access", description: "Fine-grained Watchdog controls", icon: <OyamaGradientIcon name="goal-target" size={16} /> },
];

/** WatchdogSidebar renders navigation for the dark OyamaWatchdog module shell. */
export default function WatchdogSidebar() {
  const pathname = usePathname();
  const [hash, setHash] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHash = () => setHash(window.location.hash || "");
    updateHash();
    window.addEventListener("hashchange", updateHash);
    return () => window.removeEventListener("hashchange", updateHash);
  }, []);

  function isNavItemActive(href: string): boolean {
    if (href.includes("#")) {
      const [pathOnly, hashOnly] = href.split("#");
      return pathname === pathOnly && hash === `#${hashOnly}`;
    }

    if (href === "/watchdog") {
      return pathname === "/watchdog" && !hash;
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="w-64 shrink-0 bg-[#0a0f19] border-r border-[#1f2937] flex flex-col h-full select-none">
      <div className="px-4 py-4 border-b border-[#1f2937]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-600/90 flex items-center justify-center">
            <OyamaGradientIcon name="client-profile-sync" size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-100">OyamaWatchdog</p>
            <p className="text-[11px] text-red-300">Highest Admin Security CRM</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = isNavItemActive(item.href);
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
              <div className="flex items-center gap-2">
                {item.icon}
                <p className="text-sm font-medium">{item.label}</p>
              </div>
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
