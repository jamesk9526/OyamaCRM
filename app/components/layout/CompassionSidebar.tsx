// Blue-themed sidebar navigation for the Compassion CRM module.
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
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

/** Helper: wraps an SVG path string in a standard-sized icon element */
const Ico = ({ d, children, size = 18 }: { d?: string; children?: React.ReactNode; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    {d ? <path d={d} /> : children}
  </svg>
);

/** Heart-pulse icon used in the Compassion CRM logo area */
const HeartPulseIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
    <path d="M17.5 5.5C16 4 13.5 4 12 6c-1.5-2-4-2-5.5-.5C5 7 5 9.5 7 11.5L12 17l5-5.5c2-2 2-4.5.5-6z" />
  </svg>
);

/** Centralized Compassion CRM nav — add new routes here */
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Client Management",
    items: [
      { label: "Dashboard",    href: "/compassion/dashboard",    icon: <Ico d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /> },
      { label: "Clients",      href: "/compassion/clients",      icon: <Ico d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /> },
      { label: "Families",     href: "/compassion/families",     icon: <Ico d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" /> },
      { label: "Cases",        href: "/compassion/cases",        icon: <Ico d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /> },
      { label: "Assessments",  href: "/compassion/assessments",  icon: <Ico d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /> },
      { label: "Care Plans",   href: "/compassion/care-plans",   icon: <Ico d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /> },
    ],
  },
  {
    label: "Engagement",
    items: [
      { label: "Appointments", href: "/compassion/appointments", icon: <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /> },
      { label: "Activities",   href: "/compassion/activities",   icon: <Ico d="M13 10V3L4 14h7v7l9-11h-7z" /> },
      { label: "Communications", href: "/compassion/communications", icon: <Ico d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /> },
      { label: "Tasks",        href: "/compassion/tasks",        icon: <Ico d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /> },
      { label: "Follow Ups",   href: "/compassion/follow-ups",   icon: <Ico d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" /> },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports",    href: "/compassion/reports",    icon: <Ico d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /> },
      { label: "Dashboards", href: "/compassion/dashboards", icon: <Ico d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" /> },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Data Tools",     href: "/compassion/data-tools",         icon: <Ico d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" /> },
      { label: "Import Clients", href: "/compassion/import/clients",     icon: <Ico d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /> },
      { label: "Settings",       href: "/compassion/settings",           icon: <Ico d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" /> },
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
  const [open, setOpen] = useState(hasActive || section.label === "Client Management");

  return (
    <div className="mb-1">
      {section.label && (
        <button
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-blue-300 uppercase tracking-widest hover:text-blue-500 transition-colors"
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
            const active = item.href === "/compassion/dashboard"
              ? pathname === "/compassion/dashboard"
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group mx-2 flex items-center gap-2.5 pl-2.5 pr-3 py-1.5 rounded-lg text-[13px] font-medium transition-all border-l-2 ${
                  active
                    ? "border-blue-600 text-blue-700 bg-blue-50 font-semibold"
                    : "border-transparent text-gray-600 hover:bg-blue-50/60 hover:text-blue-900"
                }`}
              >
                <span className={`shrink-0 transition-colors ${active ? "text-blue-600" : "text-gray-400 group-hover:text-blue-500"}`}>
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
  const { user } = useAuth();

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-blue-100 flex flex-col h-full select-none">
      {/* ── Brand / Logo ── */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-blue-100">
        <span className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white shrink-0">
          <HeartPulseIcon />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-gray-900 leading-tight">OyamaCRM</p>
          <p className="text-[10px] font-medium text-blue-600 leading-tight">Compassion CRM</p>
        </div>
      </div>

      {/* ── Navigation sections (scrollable) ── */}
      <div className="flex-1 overflow-y-auto py-2">
        {NAV_SECTIONS.map((section, si) => (
          <CompassionSection key={si} section={section} pathname={pathname} />
        ))}
      </div>

      {/* ── Footer: org info ── */}
      <div className="border-t border-blue-100 px-3 py-2.5">
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
