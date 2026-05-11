// Blue-themed sidebar navigation for the Compassion CRM module.
"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";

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

/** Centralized Compassion CRM nav — add new routes here */
const NAV_SECTIONS: NavSection[] = [
  {
    label: "Care Workspace",
    items: [
      { label: "Dashboard",    href: "/compassion/dashboard",    icon: <OyamaGradientIcon name="growth-analytics" /> },
      { label: "Clients",      href: "/compassion/clients",      icon: <OyamaGradientIcon name="constituent-search" /> },
      { label: "Cases",        href: "/compassion/cases",        icon: <OyamaGradientIcon name="contact-checklist" /> },
      { label: "Appointments", href: "/compassion/appointments", icon: <OyamaGradientIcon name="task-checklist" /> },
      { label: "Tasks",        href: "/compassion/tasks",        icon: <OyamaGradientIcon name="task-checklist" /> },
      { label: "Follow Ups",   href: "/compassion/follow-ups",   icon: <OyamaGradientIcon name="client-profile-sync" /> },
      { label: "Reports",      href: "/compassion/reports",      icon: <OyamaGradientIcon name="reporting-dashboard" /> },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Data Tools",     href: "/compassion/data-tools",         icon: <OyamaGradientIcon name="contact-checklist" /> },
      { label: "Settings",       href: "/compassion/settings",           icon: <OyamaGradientIcon name="client-profile-sync" /> },
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

  return (
    <aside className="w-56 shrink-0 bg-white border-r border-blue-100 flex flex-col h-full select-none">
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
