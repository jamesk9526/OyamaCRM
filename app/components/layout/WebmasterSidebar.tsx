// Sidebar for the OyamaWebMaster module.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/webmaster", label: "Dashboard" },
  { href: "/webmaster/builder", label: "Builder" },
  { href: "/webmaster/templates", label: "Templates" },
  { href: "/webmaster/cms", label: "CMS Collections" },
  { href: "/webmaster/assets", label: "Assets" },
  { href: "/webmaster/forms", label: "Forms" },
  { href: "/webmaster/settings", label: "Site Settings" },
];

/** WebmasterSidebar renders navigation for the modular website-builder workspace. */
export default function WebmasterSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-indigo-100 flex flex-col h-full select-none">
      <div className="px-4 py-4 border-b border-indigo-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21h12a2 2 0 002-2V7l-6-6H8a2 2 0 00-2 2v2m0 6l3 3m0 0l3-3m-3 3V3M3 7h5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">OyamaWebMaster</p>
            <p className="text-[11px] text-indigo-600">Website Builder Workspace</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-indigo-50 text-indigo-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-indigo-100 px-4 py-3">
        <p className="text-[11px] text-gray-500">Section-first builder with save, preview, export, and publishing workflows.</p>
      </div>
    </aside>
  );
}
