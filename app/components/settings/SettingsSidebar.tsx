/** SettingsSidebar renders dedicated Settings navigation links. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";

interface SettingsNavItem {
  label: string;
  href: string;
  icon: "growth-analytics" | "contact-checklist" | "client-profile-sync" | "constituent-search" | "task-checklist" | "client-support-chat" | "reporting-dashboard" | "goal-target" | "momentum-growth" | "donor-gift" | "relationship-partnership" | "messaging-chat";
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { label: "Overview", href: "/settings", icon: "growth-analytics" },
  { label: "Organization", href: "/settings/organization", icon: "constituent-search" },
  { label: "Branding", href: "/settings/branding", icon: "donor-gift" },
  { label: "Users", href: "/settings/users", icon: "relationship-partnership" },
  { label: "Roles & Scopes", href: "/settings/roles", icon: "goal-target" },
  { label: "CRM Modules", href: "/settings/modules", icon: "task-checklist" },
  { label: "Events CRM", href: "/settings/events", icon: "contact-checklist" },
  { label: "AI Assistant", href: "/settings/ai", icon: "client-support-chat" },
  { label: "Integrations", href: "/settings/integrations", icon: "client-profile-sync" },
  { label: "Plugins", href: "/settings/plugins", icon: "messaging-chat" },
  { label: "Security", href: "/settings/security", icon: "goal-target" },
  { label: "Audit Logs", href: "/settings/audit", icon: "reporting-dashboard" },
  { label: "System Status", href: "/settings/system-status", icon: "momentum-growth" },
  { label: "Project Status", href: "/settings/project-status", icon: "reporting-dashboard" },
];

/** SettingsSidebar highlights the current settings route and groups config pages. */
export default function SettingsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-white border border-gray-200 rounded-lg p-3 h-fit">
      <h2 className="px-2 pb-2 text-xs font-bold text-gray-500 uppercase tracking-widest border-b border-gray-100">
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
