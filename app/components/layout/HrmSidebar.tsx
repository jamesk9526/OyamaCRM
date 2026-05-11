// Teal-themed sidebar navigation for the OyamaHRM module.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";

interface HrmNavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: HrmNavItem[] = [
  {
    label: "Dashboard",
    href: "/hrm",
    icon: (
      <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6v-9h-6v9zm0-11h6V4h-6v5z" />
      </svg>
    ),
  },
  {
    label: "People",
    href: "/hrm/people",
    icon: (
      <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
        <circle cx="9.5" cy="7" r="3" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M20 19v-1a4 4 0 0 0-3-3.87" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M14 4.13a3 3 0 0 1 0 5.74" />
      </svg>
    ),
  },
  {
    label: "Scheduling",
    href: "/hrm/scheduling",
    icon: (
      <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path strokeLinecap="round" d="M8 3v4M16 3v4M3 10h18" />
      </svg>
    ),
  },
  {
    label: "Locations",
    href: "/hrm/locations",
    icon: (
      <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.5 7-11a7 7 0 0 0-14 0c0 5.5 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    ),
  },
  {
    label: "Messages",
    href: "/hrm/messages",
    icon: (
      <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a8 8 0 0 1-8 8H7l-4 3V7a8 8 0 0 1 8-8h2a8 8 0 0 1 8 8v5z" />
      </svg>
    ),
  },
  {
    label: "Settings",
    href: "/hrm/settings",
    icon: (
      <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 3.8c.3-1.1 1.8-1.1 2.1 0l.2.9a2 2 0 0 0 3 .9l.8-.5c1-.6 2.1.5 1.5 1.5l-.5.8a2 2 0 0 0 .9 3l.9.2c1.1.3 1.1 1.8 0 2.1l-.9.2a2 2 0 0 0-.9 3l.5.8c.6 1-.5 2.1-1.5 1.5l-.8-.5a2 2 0 0 0-3 .9l-.2.9c-.3 1.1-1.8 1.1-2.1 0l-.2-.9a2 2 0 0 0-3-.9l-.8.5c-1 .6-2.1-.5-1.5-1.5l.5-.8a2 2 0 0 0-.9-3l-.9-.2c-1.1-.3-1.1-1.8 0-2.1l.9-.2a2 2 0 0 0 .9-3l-.5-.8c-.6-1 .5-2.1 1.5-1.5l.8.5a2 2 0 0 0 3-.9l.2-.9z" />
        <circle cx="12" cy="12" r="2.8" />
      </svg>
    ),
  },
  {
    label: "Help",
    href: "/help?scope=global&scopePath=/hrm",
    icon: (
      <svg className="w-[17px] h-[17px]" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.8 9a2.2 2.2 0 1 1 3.3 1.9c-.8.5-1.1.9-1.1 1.7" />
        <path strokeLinecap="round" d="M12 17h.01" />
      </svg>
    ),
  },
];

/** HrmSidebar renders left navigation for the OyamaHRM workspace shell. */
export default function HrmSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-teal-100 flex flex-col h-full select-none">
      <div className="px-4 py-4 border-b border-teal-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-600 flex items-center justify-center text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5h16v14H4z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 3v4M16 3v4M8 13h8M8 17h5" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-900">OyamaHRM</p>
            <p className="text-[11px] text-teal-600">HRM Workspace</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/hrm"
            ? pathname === "/hrm"
            : pathname === item.href || pathname.startsWith(`${item.href}/`);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                isActive ? "bg-teal-50 text-teal-700" : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <span className={isActive ? "text-teal-600" : "text-gray-400"}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-teal-100 px-4 py-3">
        <p className="text-[11px] text-gray-500">
          Internal staff operations workspace for people records, schedules, locations, and interoffice coordination.
        </p>
      </div>
    </aside>
  );
}
