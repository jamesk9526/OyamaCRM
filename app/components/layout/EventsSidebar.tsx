// Amber-themed sidebar navigation for the Events CRM module.
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";

/** Single events navigation item definition. */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

/** Group of related event navigation items. */
interface NavSection {
  label?: string;
  items: NavItem[];
}

/** Shared icon wrapper used by the Events sidebar. */
const Ico = ({ d, children, size = 18 }: { d?: string; children?: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

/** Calendar-star icon used in the Events CRM brand header. */
const CalendarStarIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <path d="m12 14 1 2 2.2.3-1.6 1.5.4 2.2-2-1.1-2 1.1.4-2.2-1.6-1.5L11 16l1-2z" />
  </svg>
);

/** Centralized Events CRM nav — add new routes here. */
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Command Center",
    items: [
      { label: "Dashboard", href: "/events", icon: <Ico d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /> },
      { label: "Events", href: "/events/events", icon: <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
      { label: "Setup", href: "/events/setup", icon: <Ico d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
      { label: "Tickets", href: "/events/tickets", icon: <Ico d="M3 8a2 2 0 012-2h14a2 2 0 012 2v2a2 2 0 010 4v2a2 2 0 01-2 2H5a2 2 0 01-2-2v-2a2 2 0 010-4V8z" /> },
      { label: "Orders", href: "/events/orders", icon: <Ico d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2" /> },
      { label: "Guests", href: "/events/guests", icon: <Ico d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
      { label: "Tables", href: "/events/tables", icon: <Ico><circle cx="12" cy="12" r="5" /><circle cx="12" cy="4" r="1.5" /><circle cx="20" cy="12" r="1.5" /><circle cx="12" cy="20" r="1.5" /><circle cx="4" cy="12" r="1.5" /></Ico> },
      { label: "Check-In", href: "/events/check-in", icon: <Ico d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
    ],
  },
  {
    label: "Revenue & Follow-Up",
    items: [
      { label: "Sponsors", href: "/events/sponsors", icon: <Ico d="M4 6h16M4 12h16M4 18h10" /> },
      { label: "Fundraising", href: "/events/fundraising", icon: <Ico d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { label: "Communications", href: "/events/communications", icon: <Ico d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
      { label: "Reports", href: "/events/reports", icon: <Ico d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Tasks", href: "/events/tasks", icon: <Ico d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
      { label: "Volunteers", href: "/events/volunteers", icon: <Ico d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /> },
      { label: "Files", href: "/events/files", icon: <Ico d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /> },
      { label: "Settings", href: "/events/settings", icon: <Ico d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
    ],
  },
];

/** Collapsible nav section for the Events module sidebar. */
function EventsSection({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string;
}) {
  const hasActive = section.items.some((item) =>
    item.href === "/events" ? pathname === "/events" : pathname.startsWith(item.href)
  );
  const [open, setOpen] = useState(hasActive || section.label === "Command Center");

  return (
    <div className="mb-1">
      {section.label && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-amber-400 uppercase tracking-widest hover:text-amber-600 transition-colors"
        >
          <span>{section.label}</span>
          <svg className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      {open && (
        <nav className="space-y-0.5">
          {section.items.map((item) => {
            const active = item.href === "/events"
              ? pathname === "/events"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group mx-2 flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border-l-2 ${
                  active
                    ? "border-amber-600 text-amber-700 bg-amber-50 font-semibold"
                    : "border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <span className={`shrink-0 transition-colors ${active ? "text-amber-600" : "text-gray-400 group-hover:text-gray-600"}`}>
                  {item.icon}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

/**
 * EventsSidebar renders the dedicated navigation for the Events CRM module.
 * It mirrors the Donor/Compassion shell pattern with an amber accent.
 */
export default function EventsSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full select-none">
      <div className="px-3 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-600 flex items-center justify-center shrink-0 text-white">
            <CalendarStarIcon />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-gray-900 leading-tight">OyamaCRM</p>
            <p className="text-[10px] font-medium leading-tight text-amber-600">Events CRM</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-0">
        {NAV_SECTIONS.map((section) => (
          <EventsSection key={section.label} section={section} pathname={pathname} />
        ))}
      </div>

      <div className="border-t border-gray-100 px-3 py-2.5">
        <div className="flex items-center gap-2 text-xs text-gray-400">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="truncate">Events Command Center</span>
        </div>
      </div>
    </aside>
  );
}
