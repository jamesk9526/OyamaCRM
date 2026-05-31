/** SettingsSidebar renders dedicated Settings navigation links. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CrmBrandLockup from "@/app/components/layout/CrmBrandLockup";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";

interface SettingsNavItem {
  label: string;
  href: string;
  icon: "growth-analytics" | "contact-checklist" | "client-profile-sync" | "constituent-search" | "task-checklist" | "client-support-chat" | "reporting-dashboard" | "goal-target" | "momentum-growth" | "donor-gift" | "relationship-partnership" | "messaging-chat";
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { label: "Overview", href: "/settings", icon: "growth-analytics" },
  { label: "Desktop App", href: "/settings/desktop-app", icon: "messaging-chat" },
  { label: "Organization", href: "/settings/organization", icon: "constituent-search" },
  { label: "Branding", href: "/settings/branding", icon: "donor-gift" },
  { label: "Users", href: "/settings/users", icon: "relationship-partnership" },
  { label: "Roles & Scopes", href: "/settings/roles", icon: "goal-target" },
  { label: "CRM Modules", href: "/settings/modules", icon: "task-checklist" },
  { label: "Events CRM", href: "/settings/events", icon: "contact-checklist" },
  { label: "AI Assistant", href: "/settings/ai", icon: "client-support-chat" },
  { label: "Integrations", href: "/settings/integrations", icon: "client-profile-sync" },
  { label: "Payments", href: "/settings/payments", icon: "donor-gift" },
  { label: "Site Embeds", href: "/settings/site-embeds", icon: "messaging-chat" },
  { label: "Security & Audit", href: "/settings/security", icon: "goal-target" },
  { label: "System Updates", href: "/settings/system-updates", icon: "momentum-growth" },
  { label: "System Status", href: "/settings/system-status", icon: "reporting-dashboard" },
  { label: "About", href: "/settings/about", icon: "growth-analytics" },
];

/** SettingsSidebar highlights the current settings route and groups config pages. */
export default function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-white border border-gray-200 rounded-lg p-3 h-fit">
      <div className="rounded-lg border border-gray-200 bg-slate-50 p-2">
        <CrmBrandLockup moduleLabel="Settings CRM" className="w-full" />
      </div>
      <h2 className="mt-3 px-2 pb-2 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">
        Settings
      </h2>
      <nav className="pt-2 space-y-1">
        {SETTINGS_NAV.map((item) => {
          const active = item.href === "/settings" ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <OyamaGradientIcon name={item.icon} size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
