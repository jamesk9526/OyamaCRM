/**
 * Sidebar: primary navigation for DonorCRM and Compassion CRM.
 * Contains brand logo at top, grouped nav sections, and bottom quick links.
 * Active state uses a left border + tinted background (no filled green pill).
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type React from "react";

/** Single navigation item */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: string;
}

/** Collapsible group of related nav items */
interface NavSection {
  label: string;
  icon?: React.ReactNode;
  items: NavItem[];
  defaultOpen?: boolean;
}

/** Helper: wraps an SVG path in a standard 18px icon */
const Ico = ({ d, children }: { d?: string; children?: React.ReactNode }) => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

/** All DonorCRM nav sections — each section is independently collapsible */
const DONOR_SECTIONS: NavSection[] = [
  {
    label: "Fundraising",
    defaultOpen: true,
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: <Ico d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />,
      },
      {
        label: "Constituents",
        href: "/constituents",
        icon: <Ico d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />,
      },
      {
        label: "Donations",
        href: "/donations",
        icon: <Ico d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
      },
      {
        label: "Campaigns",
        href: "/campaigns",
        icon: <Ico d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />,
      },
      {
        label: "Grants",
        href: "/grants",
        icon: <Ico><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></Ico>,
      },
      {
        label: "Payments",
        href: "/payments",
        icon: <Ico><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></Ico>,
      },
      {
        label: "Reports",
        href: "/reports",
        icon: <Ico d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />,
      },
    ],
  },
  {
    label: "Engagement",
    defaultOpen: true,
    items: [
      {
        label: "Tasks",
        href: "/tasks",
        icon: <Ico d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />,
      },
      {
        label: "Communications",
        href: "/communications",
        icon: <Ico d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />,
      },
      {
        label: "Automations",
        href: "/automations",
        icon: <Ico><circle cx="12" cy="12" r="3" /><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14" /></Ico>,
      },
      {
        label: "Events",
        href: "/events",
        icon: <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
      },
      {
        label: "Volunteers",
        href: "/volunteers",
        icon: <Ico d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />,
      },
    ],
  },
  {
    label: "System",
    defaultOpen: false,
    items: [
      {
        label: "Data Tools",
        href: "/data-tools",
        icon: <Ico d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />,
      },
      {
        label: "Custom Fields",
        href: "/custom-fields",
        icon: <Ico><path d="M4 6h16M4 10h16M4 14h10M4 18h6" /><circle cx="18" cy="16" r="3" /><path d="M18 13v3M18 19v.01" /></Ico>,
      },
      {
        label: "Settings",
        href: "/settings",
        icon: <Ico d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />,
      },
    ],
  },
];

/** Collapsible nav section with animated expand/collapse chevron */
function SidebarSection({
  section,
  pathname,
  isCompassion,
}: {
  section: NavSection;
  pathname: string;
  isCompassion: boolean;
}) {
  const [open, setOpen] = useState(section.defaultOpen ?? true);

  // Auto-open if any item in this section is active
  const hasActive = section.items.some((item) =>
    item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
  );

  const accentColor = isCompassion ? "border-blue-600 text-blue-700 bg-blue-50" : "border-green-600 text-green-700 bg-green-50";
  const accentIcon = isCompassion ? "text-blue-600" : "text-green-600";

  return (
    <div className="mb-1">
      {/* Section header — click to toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-gray-600 transition-colors"
      >
        <span>{section.label}</span>
        <svg
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Nav items */}
      {open && (
        <nav className="space-y-0.5">
          {section.items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group mx-2 flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border-l-2 ${
                  active
                    ? `border-l-2 ${accentColor} font-semibold`
                    : "border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span className={`shrink-0 transition-colors ${active ? accentIcon : "text-gray-400 group-hover:text-gray-600"}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/**
 * Main Sidebar component.
 * Renders brand logo + collapsible nav sections for the active module.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const isCompassion = pathname.startsWith("/compassion");

  const brandBg = isCompassion ? "bg-blue-600" : "bg-green-600";
  const brandHover = isCompassion ? "hover:bg-blue-700" : "hover:bg-green-700";

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full select-none">

      {/* ── Brand / Logo ── */}
      <div className="px-3 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          {/* Logo mark */}
          <div className={`w-8 h-8 rounded-lg ${brandBg} flex items-center justify-center shrink-0`}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight">OyamaCRM</p>
            <p className={`text-[10px] font-medium leading-tight ${isCompassion ? "text-blue-600" : "text-green-600"}`}>
              {isCompassion ? "Compassion CRM" : "DonorCRM"}
            </p>
          </div>
        </div>
      </div>

      {/* ── Navigation sections (scrollable) ── */}
      <div className="flex-1 overflow-y-auto py-2 px-0">
        {DONOR_SECTIONS.map((section) => (
          <SidebarSection
            key={section.label}
            section={section}
            pathname={pathname}
            isCompassion={isCompassion}
          />
        ))}
      </div>

      {/* ── Footer: org info or quick help ── */}
      <div className="border-t border-gray-100 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="truncate">Oyama Organisation</span>
        </div>
      </div>
    </aside>
  );
}
