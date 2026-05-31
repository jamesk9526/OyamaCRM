/** SettingsSidebar renders dedicated Settings navigation links. */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CrmBrandLockup from "@/app/components/layout/CrmBrandLockup";
import OyamaDonorPackIcon from "@/app/components/ui/OyamaDonorPackIcon";

interface SettingsNavItem {
  label: string;
  href: string;
  iconSlug: "donor-dashboard" | "documentation" | "constituents" | "fund-designation" | "users" | "system-status" | "field-mapping" | "event-fundraising" | "steward-ai" | "integrations" | "quickbooks-queue" | "communications" | "giving-trends" | "reports" | "help";
}

const SETTINGS_NAV: SettingsNavItem[] = [
  { label: "Overview", href: "/settings", iconSlug: "donor-dashboard" },
  { label: "Desktop App", href: "/settings/desktop-app", iconSlug: "documentation" },
  { label: "Organization", href: "/settings/organization", iconSlug: "constituents" },
  { label: "Branding", href: "/settings/branding", iconSlug: "fund-designation" },
  { label: "Users", href: "/settings/users", iconSlug: "users" },
  { label: "Roles & Scopes", href: "/settings/roles", iconSlug: "system-status" },
  { label: "CRM Modules", href: "/settings/modules", iconSlug: "field-mapping" },
  { label: "Events CRM", href: "/settings/events", iconSlug: "event-fundraising" },
  { label: "AI Assistant", href: "/settings/ai", iconSlug: "steward-ai" },
  { label: "Integrations", href: "/settings/integrations", iconSlug: "integrations" },
  { label: "Payments", href: "/settings/payments", iconSlug: "quickbooks-queue" },
  { label: "Site Embeds", href: "/settings/site-embeds", iconSlug: "communications" },
  { label: "Security & Audit", href: "/settings/security", iconSlug: "system-status" },
  { label: "System Updates", href: "/settings/system-updates", iconSlug: "giving-trends" },
  { label: "System Status", href: "/settings/system-status", iconSlug: "reports" },
  { label: "About", href: "/settings/about", iconSlug: "help" },
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
              <OyamaDonorPackIcon slug={item.iconSlug} size={16} alt="" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
