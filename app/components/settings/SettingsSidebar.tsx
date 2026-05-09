/** SettingsSidebar renders dedicated Settings navigation links. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

interface SettingsNavItem {
  label: string;
  href: string;
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { label: "Overview", href: "/settings" },
  { label: "Organization", href: "/settings/organization" },
  { label: "Branding", href: "/settings/branding" },
  { label: "Users", href: "/settings/users" },
  { label: "Roles & Scopes", href: "/settings/roles" },
  { label: "Workspaces", href: "/settings/workspaces" },
  { label: "CRM Modules", href: "/settings/modules" },
  { label: "Donor CRM", href: "/settings/donor" },
  { label: "Compassion CRM", href: "/settings/compassion" },
  { label: "Meetings", href: "/settings/meetings" },
  { label: "Tasks", href: "/settings/tasks" },
  { label: "Scheduling", href: "/settings/scheduling" },
  { label: "Forms", href: "/settings/forms" },
  { label: "Email & Messaging", href: "/settings/email" },
  { label: "Integrations", href: "/settings/integrations" },
  { label: "Plugins", href: "/settings/plugins" },
  { label: "Security", href: "/settings/security" },
  { label: "Import / Export", href: "/settings/import-export" },
  { label: "Audit Logs", href: "/settings/audit" },
  { label: "System", href: "/settings/system" },
  { label: "System Status", href: "/settings/system-status" },
  { label: "Project Status", href: "/settings/project-status" },
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
              className={`block px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                active
                  ? "bg-green-50 text-green-700 border border-green-200"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
