// Blue-themed sidebar navigation for the Compassion CRM module.
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";

/** Single navigation item definition */
interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
}

/** Group of related navigation items with an optional heading */
interface NavSection {
  label?: string;
  items: NavItem[];
}

/** Helper: wraps an SVG path in a consistent icon frame. */
const Ico = ({ d, children, size = 18 }: { d?: string; children?: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

/** Compassion-specific icon set focused on care workflows. */
const ICONS = {
  dashboard: <Ico d="M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z" />,
  clients: <Ico d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m20 0v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8M9 11a4 4 0 100-8 4 4 0 000 8z" />,
  cases: <Ico d="M4 7h16M8 3h8l2 4H6l2-4zm-2 4h12v13H6V7zm3 4h6m-6 4h4" />,
  appointments: <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  tasks: <Ico d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  followUps: <Ico d="M3 12h4l2 5 4-10 2 5h6" />,
  reports: <Ico d="M4 19h16M7 15V9m5 6V5m5 10v-3" />,
  dataTools: <Ico d="M12 3C7 3 3 4.8 3 7v10c0 2.2 4 4 9 4s9-1.8 9-4V7c0-2.2-4-4-9-4zm0 8c-5 0-9-1.8-9-4m18 4c0 2.2-4 4-9 4s-9-1.8-9-4" />,
  settings: <Ico d="M10.3 4.3c.4-1.8 2.9-1.8 3.4 0 .2.8.9 1.3 1.7 1.3.3 0 .6-.1.9-.2 1.5-.9 3.3.8 2.4 2.4-.5.8-.2 1.9.7 2.3 1.8.4 1.8 2.9 0 3.4-.8.2-1.3.9-1.3 1.7 0 .3.1.6.2.9.9 1.5-.8 3.3-2.4 2.4-.8-.5-1.9-.2-2.3.7-.4 1.8-2.9 1.8-3.4 0-.2-.8-.9-1.3-1.7-1.3-.3 0-.6.1-.9.2-1.5.9-3.3-.8-2.4-2.4.5-.8.2-1.9-.7-2.3-1.8-.4-1.8-2.9 0-3.4.8-.2 1.3-.9 1.3-1.7 0-.3-.1-.6-.2-.9-.9-1.5.8-3.3 2.4-2.4.8.5 1.9.2 2.3-.7zM12 15a3 3 0 100-6 3 3 0 000 6z" />,
  help: <Ico d="M9.1 9a3 3 0 115.8 1c0 2-3 2.3-3 4m.1 4h.1M22 12A10 10 0 112 12a10 10 0 0120 0z" />,
};

/** Centralized Compassion CRM nav — add new routes here */
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Care Workspace",
    items: [
      { label: "Dashboard",    href: "/compassion/dashboard",    icon: ICONS.dashboard },
      { label: "Clients",      href: "/compassion/clients",      icon: ICONS.clients },
      { label: "Cases",        href: "/compassion/cases",        icon: ICONS.cases },
      { label: "Appointments", href: "/compassion/appointments", icon: ICONS.appointments },
      { label: "Tasks",        href: "/compassion/tasks",        icon: ICONS.tasks },
      { label: "Follow Ups",   href: "/compassion/follow-ups",   icon: ICONS.followUps },
      { label: "Reports",      href: "/compassion/reports",      icon: ICONS.reports },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Data Tools",     href: "/compassion/data-tools",         icon: ICONS.dataTools },
      { label: "Settings",       href: "/compassion/settings",           icon: ICONS.settings },
      { label: "Help",           href: "/help?scope=compassion&scopePath=/compassion/dashboard", icon: ICONS.help },
    ],
  },
];

/** Collapsible nav section for CompassionSidebar */
function CompassionSection({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string;
}) {
  const hasActive = section.items.some((item) =>
    item.href === "/compassion/dashboard"
      ? pathname === "/compassion/dashboard"
      : pathname.startsWith(item.href)
  );
  const [open, setOpen] = useState(hasActive || section.label === "Care Workspace");

  return (
    <div className="mb-2 rounded-xl border border-transparent hover:border-blue-200/80 hover:bg-white/60 transition-colors px-1 py-1">
      {section.label && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-[0.16em] hover:text-blue-600 transition-colors"
        >
          <span>{section.label}</span>
          <svg className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-0" : "-rotate-90"}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      )}
      {open && (
        <nav className="space-y-1 pb-0.5">
          {section.items.map((item) => {
            const active = item.href === "/compassion/dashboard"
              ? pathname === "/compassion/dashboard"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group mx-1.5 flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  active
                    ? "text-blue-800 bg-blue-50 ring-1 ring-blue-200 shadow-sm font-semibold"
                    : "text-gray-600 hover:bg-white hover:ring-1 hover:ring-blue-200 hover:text-blue-900"
                }`}
              >
                <span className={`shrink-0 rounded-lg p-1 transition-colors ${active ? "text-blue-600 bg-white/80" : "text-gray-400 bg-blue-50 group-hover:bg-blue-100 group-hover:text-blue-600"}`}>
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
 * CompassionSidebar: blue-accented navigation sidebar for the Compassion CRM module.
 * Uses left-border active state with blue tint for a modern, non-heavy look.
 */
export default function CompassionSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 shrink-0 bg-gradient-to-b from-white to-blue-50/30 border-r border-blue-100 shadow-[inset_-1px_0_0_rgba(59,130,246,0.12)] flex flex-col h-full select-none">
      {/* ── Navigation sections (scrollable) ── */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5">
        {NAV_SECTIONS.map((section, si) => (
          <CompassionSection key={si} section={section} pathname={pathname} />
        ))}
      </div>

      {/* ── Footer: org info ── */}
      <div className="border-t border-blue-100 px-4 py-3 bg-white/70">
        <div className="flex items-center gap-2 text-xs text-blue-500">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          <span className="truncate">Oyama Organization</span>
        </div>
      </div>
    </aside>
  );
}
