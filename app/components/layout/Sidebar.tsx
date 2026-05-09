/**
 * Sidebar navigation component.
 * Compact, icon-driven nav with SVG icons, active-route highlighting, and section labels.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";

/** Single navigation item definition */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

/** Group of related navigation items */
interface NavSection {
  label?: string;
  items: NavItem[];
}

/** Helper: wraps an SVG path string in a standard icon element */
const Ico = ({ d, children, size = 18 }: { d?: string; children?: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

/** Centralized nav structure — add new routes here */
const NAV_SECTIONS: NavSection[] = [
  {
    items: [
      { label: "Dashboard", href: "/", icon: <Ico d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
      { label: "Constituents", href: "/constituents", icon: <Ico d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
      { label: "Donations", href: "/donations", icon: <Ico d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { label: "Campaigns", href: "/campaigns", icon: <Ico d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" /> },
      { label: "Grants", href: "/grants", icon: <Ico><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></Ico> },
      { label: "Reports", href: "/reports", icon: <Ico d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
    ],
  },
  {
    label: "Engagement",
    items: [
      { label: "Tasks", href: "/tasks", icon: <Ico d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
      { label: "Communications", href: "/communications", icon: <Ico d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
      { label: "Automations", href: "/automations", icon: <Ico><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" /></Ico> },
      { label: "Events", href: "/events", icon: <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
      { label: "Volunteers", href: "/volunteers", icon: <Ico d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /> },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Data Tools", href: "/data-tools", icon: <Ico d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /> },
      { label: "Custom Fields", href: "/custom-fields", icon: <Ico><path d="M4 6h16M4 10h16M4 14h10M4 18h6" /><circle cx="18" cy="16" r="3" /><path d="M18 13v3M18 19v.01" /></Ico> },
      { label: "Settings", href: "/settings", icon: <Ico d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
    ],
  },
];

/** Sidebar: compact nav with SVG icons, active highlighting, and section headers. */
export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-52 shrink-0 bg-white border-r border-gray-200 flex flex-col overflow-y-auto select-none">
      {NAV_SECTIONS.map((section, si) => (
        <div key={si} className={si === 0 ? "pt-3 pb-1" : "pb-1"}>
          {/* Section label — only shown for Engagement and System */}
          {section.label && (
            <p className="px-4 pt-3 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {section.label}
            </p>
          )}
          <nav>
            {section.items.map((item) => {
              // Dashboard uses exact match; all others use prefix match
              const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`mx-2 mb-0.5 flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] font-medium transition-colors ${
                    active
                      ? "bg-green-600 text-white shadow-sm"
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  {/* Icon inherits text color from parent */}
                  <span className={`shrink-0 ${active ? "opacity-100" : "opacity-50"}`}>
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </aside>
  );
}
