// Sidebar for the OyamaWebMaster module.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import CrmBrandLockup from "@/app/components/layout/CrmBrandLockup";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";

const NAV_ITEMS = [
  { href: "/webmaster", label: "Dashboard", icon: "growth-analytics" as const },
  { href: "/webmaster/editor", label: "Editor", icon: "reporting-dashboard" as const },
  { href: "/webmaster/publishing", label: "Publishing", icon: "task-checklist" as const },
  { href: "/webmaster/templates", label: "Templates", icon: "contact-checklist" as const },
  { href: "/webmaster/cms", label: "CMS Collections", icon: "constituent-search" as const },
  { href: "/webmaster/assets", label: "Assets", icon: "donor-gift" as const },
  { href: "/webmaster/forms", label: "Forms", icon: "task-checklist" as const },
  { href: "/webmaster/settings", label: "Site Settings", icon: "client-profile-sync" as const },
];

/** WebmasterSidebar renders navigation for the modular website-builder workspace. */
export default function WebmasterSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-indigo-100 flex flex-col h-full select-none">
      <div className="px-4 py-4 border-b border-indigo-100">
        <CrmBrandLockup moduleLabel="Webmaster CRM" className="w-full" />
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <OyamaGradientIcon name={item.icon} size={16} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-indigo-100 px-4 py-3">
        <p className="text-[11px] text-gray-500">Live visual editor with draft preview and publish-readiness workflow.</p>
      </div>
    </aside>
  );
}
