// Amber-themed sidebar navigation for the Events CRM module.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type React from "react";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";

/** Single events navigation item definition. */
interface NavItem {
  label: string;
  href: string;
  activePath?: string;
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

/** Global Events CRM navigation visible before selecting an event. */
const BASE_NAV_SECTIONS: NavSection[] = [
  {
    label: "Command Center",
    items: [
      { label: "Dashboard", href: "/events", icon: <OyamaGradientIcon name="growth-analytics" /> },
      { label: "Events", href: "/events/events", icon: <OyamaGradientIcon name="task-checklist" /> },
      { label: "Workspace Selector", href: "/events/workspace", icon: <OyamaGradientIcon name="constituent-search" /> },
      { label: "Setup", href: "/events/setup", icon: <OyamaGradientIcon name="client-profile-sync" /> },
    ],
  },
  {
    label: "Global Tools",
    items: [
      { label: "Global Reports", href: "/events/reports", icon: <OyamaGradientIcon name="reporting-dashboard" /> },
      { label: "Event Page Builder", href: "/events/page-builder", icon: <OyamaGradientIcon name="growth-analytics" /> },
      { label: "Event Templates", href: "/events/templates", icon: <OyamaGradientIcon name="contact-checklist" /> },
      { label: "Overall Management", href: "/events/events", icon: <OyamaGradientIcon name="goal-target" /> },
    ],
  },
];

/** Build event-scoped tool links once an event is selected. */
function getWorkspaceSections(eventId: string): NavSection[] {
  return [
    {
      label: "Event Workspace",
      items: [
        { label: "Overview", href: `/events/${eventId}/overview`, activePath: `/events/${eventId}`, icon: <OyamaGradientIcon name="growth-analytics" /> },
        { label: "Tickets", href: `/events/${eventId}/tickets`, activePath: `/events/${eventId}/tickets`, icon: <OyamaGradientIcon name="donor-gift" /> },
        { label: "Orders", href: `/events/${eventId}/orders`, activePath: `/events/${eventId}/orders`, icon: <OyamaGradientIcon name="contact-checklist" /> },
        { label: "Guests", href: `/events/${eventId}/guests`, activePath: `/events/${eventId}/guests`, icon: <OyamaGradientIcon name="constituent-search" /> },
        { label: "Tables", href: `/events/${eventId}/tables`, activePath: `/events/${eventId}/tables`, icon: <OyamaGradientIcon name="relationship-partnership" /> },
        { label: "Check-In", href: `/events/${eventId}/check-in`, activePath: `/events/${eventId}/check-in`, icon: <OyamaGradientIcon name="client-profile-sync" /> },
      ],
    },
    {
      label: "Revenue & Follow-Up",
      items: [
        { label: "Sponsors", href: `/events/${eventId}/sponsors`, activePath: `/events/${eventId}/sponsors`, icon: <OyamaGradientIcon name="relationship-partnership" /> },
        { label: "Fundraising", href: `/events/${eventId}/fundraising`, activePath: `/events/${eventId}/fundraising`, icon: <OyamaGradientIcon name="momentum-growth" /> },
        { label: "Communications", href: `/events/${eventId}/communications`, activePath: `/events/${eventId}/communications`, icon: <OyamaGradientIcon name="messaging-chat" /> },
        { label: "Reports", href: `/events/${eventId}/reports`, activePath: `/events/${eventId}/reports`, icon: <OyamaGradientIcon name="reporting-dashboard" /> },
      ],
    },
    {
      label: "Operations",
      items: [
        { label: "Tasks", href: `/events/${eventId}/tasks`, activePath: `/events/${eventId}/tasks`, icon: <OyamaGradientIcon name="task-checklist" /> },
        { label: "Volunteers", href: `/events/${eventId}/volunteers`, activePath: `/events/${eventId}/volunteers`, icon: <OyamaGradientIcon name="relationship-partnership" /> },
        { label: "Files", href: `/events/${eventId}/files`, activePath: `/events/${eventId}/files`, icon: <OyamaGradientIcon name="contact-checklist" /> },
        { label: "Settings", href: `/events/${eventId}/settings`, activePath: `/events/${eventId}/settings`, icon: <OyamaGradientIcon name="client-profile-sync" /> },
      ],
    },
  ];
}

/** Collapsible nav section for the Events module sidebar. */
function EventsSection({
  section,
  pathname,
}: {
  section: NavSection;
  pathname: string;
}) {
  const hasActive = section.items.some((item) =>
    (item.activePath ?? item.href) === "/events"
      ? pathname === "/events"
      : pathname.startsWith(item.activePath ?? item.href)
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
            const activePath = item.activePath ?? item.href;
            const active = activePath === "/events"
              ? pathname === "/events"
              : pathname.startsWith(activePath);
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
  const searchParams = useSearchParams();

  const activeEventId = useMemo(() => {
    const explicit = searchParams.get("eventId");
    if (explicit) return explicit;

    const parts = pathname.split("/").filter(Boolean);
    const third = parts[1];
    const reserved = new Set([
      "events",
      "workspace",
      "setup",
      "page-builder",
      "templates",
      "tickets",
      "orders",
      "guests",
      "tables",
      "check-in",
      "sponsors",
      "fundraising",
      "communications",
      "reports",
      "tasks",
      "volunteers",
      "files",
      "settings",
      "page",
    ]);
    if (third && !reserved.has(third)) return third;
    return null;
  }, [pathname, searchParams]);

  const sections = useMemo(() => {
    if (!activeEventId) return BASE_NAV_SECTIONS;
    return [...BASE_NAV_SECTIONS, ...getWorkspaceSections(activeEventId)];
  }, [activeEventId]);

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
        {sections.map((section) => (
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
