/**
 * Sidebar: primary navigation for DonorCRM and OyamaREPORTIT CRM.
 * Contains grouped navigation sections and quick organizational context.
 * Uses semantic SVG icons and a polished card-like active state.
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type React from "react";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import { useAuth } from "@/app/components/auth/AuthProvider";

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

/** Helper: wraps SVG paths in a consistent 18px icon frame. */
const Ico = ({ d, children, className }: { d?: string; children?: React.ReactNode; className?: string }) => (
  <svg
    width={18}
    height={18}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    {d ? <path d={d} /> : children}
  </svg>
);

/** Sidebar icon set tuned for nonprofit CRM workflows. */
const ICONS = {
  dashboard: <Ico d="M3 13h8V3H3v10zm10 8h8V3h-8v18zM3 21h8v-6H3v6z" />,
  constituents: <Ico d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2m20 0v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75M9 11a4 4 0 100-8 4 4 0 000 8z" />,
  donations: <Ico d="M12 2v20m7-15H9a3 3 0 100 6h6a3 3 0 110 6H5" />,
  campaigns: <Ico d="M12 3l2.8 5.7L21 9.6l-4.5 4.4 1 6.2L12 17l-5.5 3.2 1-6.2L3 9.6l6.2-.9L12 3z" />,
  grants: <Ico d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.6a1 1 0 01.7.3l5.4 5.4a1 1 0 01.3.7V19a2 2 0 01-2 2z" />,
  payments: <Ico><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></Ico>,
  reports: <Ico d="M4 19h16M7 15V9m5 6V5m5 10v-3" />,
  tasks: <Ico d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />,
  meetings: <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  communications: <Ico d="M4 6h16v12H4zM4 7l8 6 8-6" />,
  letters: <Ico d="M8 2h8l4 4v16H4V2h4zm1 9h6m-6 4h6m-6 4h4" />,
  livecom: <Ico d="M4 12a8 8 0 1116 0v5a2 2 0 01-2 2h-3v-6h5M4 13h5v6H6a2 2 0 01-2-2v-4z" />,
  stewardPaths: <Ico d="M5 7h5M14 7h5M7.5 7a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0zM5 17h5m4 0h5m-7-10v10m-2.5 0a2.5 2.5 0 105 0 2.5 2.5 0 00-5 0z" />,
  signals: <Ico d="M3 12h4l2 5 4-10 2 5h6" />,
  volunteers: <Ico d="M16 11c1.7 0 3-1.6 3-3.5S17.7 4 16 4s-3 1.6-3 3.5 1.3 3.5 3 3.5zM8 11c1.7 0 3-1.6 3-3.5S9.7 4 8 4 5 5.6 5 7.5 6.3 11 8 11zm0 2c-2.8 0-5 1.8-5 4v3h10v-3c0-2.2-2.2-4-5-4zm8 0c-.9 0-1.8.2-2.6.6 1 .9 1.6 2.1 1.6 3.4v3h6v-3c0-2.2-2.2-4-5-4z" />,
  dataTools: <Ico d="M12 3C7 3 3 4.8 3 7v10c0 2.2 4 4 9 4s9-1.8 9-4V7c0-2.2-4-4-9-4zm0 0c5 0 9 1.8 9 4s-4 4-9 4-9-1.8-9-4 4-4 9-4zm-9 9c0 2.2 4 4 9 4s9-1.8 9-4" />,
  customFields: <Ico><path d="M4 6h16M4 10h10M4 14h16M4 18h8" /><circle cx="16" cy="10" r="2" /><circle cx="14" cy="18" r="2" /></Ico>,
  settings: <Ico d="M10.3 4.3c.4-1.8 2.9-1.8 3.4 0 .2.8.9 1.3 1.7 1.3.3 0 .6-.1.9-.2 1.5-.9 3.3.8 2.4 2.4-.5.8-.2 1.9.7 2.3 1.8.4 1.8 2.9 0 3.4-.8.2-1.3.9-1.3 1.7 0 .3.1.6.2.9.9 1.5-.8 3.3-2.4 2.4-.8-.5-1.9-.2-2.3.7-.4 1.8-2.9 1.8-3.4 0-.2-.8-.9-1.3-1.7-1.3-.3 0-.6.1-.9.2-1.5.9-3.3-.8-2.4-2.4.5-.8.2-1.9-.7-2.3-1.8-.4-1.8-2.9 0-3.4.8-.2 1.3-.9 1.3-1.7 0-.3-.1-.6-.2-.9-.9-1.5.8-3.3 2.4-2.4.8.5 1.9.2 2.3-.7zM12 15a3 3 0 100-6 3 3 0 000 6z" />,
  help: <Ico d="M9.1 9a3 3 0 115.8 1c0 2-3 2.3-3 4m.1 4h.1M22 12A10 10 0 112 12a10 10 0 0120 0z" />,
  watchdog: <Ico d="M12 2l8 4v6c0 5.5-3.5 9.74-8 10-4.5-.26-8-4.5-8-10V6l8-4zm0 7v4m0 4h.01" />,
  webmaster: <Ico d="M2 12h20M12 2a15 15 0 010 20M12 2a15 15 0 000 20M4.9 4.9a15 15 0 0014.2 14.2M19.1 4.9A15 15 0 014.9 19.1" />,
  events: <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
  compassion: <Ico d="M12 21s-7-4.6-7-10.5A4.5 4.5 0 0112 7a4.5 4.5 0 017 3.5C19 16.4 12 21 12 21z" />,
};

/** All DonorCRM nav sections — each section is independently collapsible */
const DONOR_SECTIONS: NavSection[] = [
  {
    label: "Fundraising",
    defaultOpen: true,
    items: [
      {
        label: "Dashboard",
        href: "/",
        icon: ICONS.dashboard,
      },
      {
        label: "Constituents",
        href: "/constituents",
        icon: ICONS.constituents,
      },
      {
        label: "Donations",
        href: "/donations",
        icon: ICONS.donations,
      },
      {
        label: "Campaigns",
        href: "/campaigns",
        icon: ICONS.campaigns,
      },
      {
        label: "Grants",
        href: "/grants",
        icon: ICONS.grants,
      },
      {
        label: "Payments",
        href: "/payments",
        icon: ICONS.payments,
      },
      {
        label: "Reports",
        href: "/reports",
        icon: ICONS.reports,
      },
    ].filter((item) => item.href !== "/reports"),
  },
  {
    label: "Engagement",
    defaultOpen: true,
    items: [
      {
        label: "Tasks",
        href: "/tasks",
        icon: ICONS.tasks,
      },
      {
        label: "Meetings",
        href: "/meetings",
        icon: ICONS.meetings,
      },
      {
        label: "Communications",
        href: "/communications",
        icon: ICONS.communications,
      },
      {
        label: "Letters & Printables",
        href: "/letters-printables",
        icon: ICONS.letters,
      },
      {
        label: "LiveCom",
        href: "/livecom",
        icon: ICONS.livecom,
        badge: "NEW",
      },
      {
        label: "Steward Paths",
        href: "/automations",
        icon: ICONS.stewardPaths,
      },
      {
        label: "Steward Signals",
        href: "/steward-signals",
        icon: ICONS.signals,
      },
      {
        label: "Volunteers",
        href: "/volunteers",
        icon: ICONS.volunteers,
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
        icon: ICONS.dataTools,
      },
      {
        label: "Custom Fields",
        href: "/custom-fields",
        icon: ICONS.customFields,
      },
      {
        label: "Settings",
        href: "/settings",
        icon: ICONS.settings,
      },
      {
        label: "Help",
        href: "/help?scope=donor&scopePath=/",
        icon: ICONS.help,
      },
      {
        label: "OyamaWatchdog",
        href: "/watchdog",
        icon: ICONS.watchdog,
      },
      {
        label: "OyamaWebMaster",
        href: "/webmaster",
        icon: ICONS.webmaster,
      },
    ],
  },
];

/** OyamaREPORTIT module sections — centralized reporting workspace navigation. */
const REPORTIT_SECTIONS: NavSection[] = [
  {
    label: "Report Center",
    defaultOpen: true,
    items: [
      {
        label: "Overview",
        href: "/reports",
        icon: ICONS.reports,
      },
      {
        label: "Donor Insights",
        href: "/reports?tab=donors",
        icon: ICONS.constituents,
      },
      {
        label: "Giving Trends",
        href: "/reports?tab=giving",
        icon: ICONS.signals,
      },
      {
        label: "Campaign Performance",
        href: "/reports?tab=campaigns",
        icon: ICONS.campaigns,
      },
      {
        label: "Retention",
        href: "/reports?tab=retention",
        icon: ICONS.donations,
      },
    ],
  },
  {
    label: "Context Sources",
    defaultOpen: false,
    items: [
      {
        label: "Donor CRM",
        href: "/",
        icon: ICONS.donations,
      },
      {
        label: "Events CRM",
        href: "/events",
        icon: ICONS.events,
      },
      {
        label: "Compassion CRM",
        href: "/compassion/dashboard",
        icon: ICONS.compassion,
      },
    ],
  },
];

/** Collapsible nav section with animated expand/collapse chevron */
function SidebarSection({
  section,
  pathname,
  isCompassion,
  isReportit,
}: {
  section: NavSection;
  pathname: string;
  isCompassion: boolean;
  isReportit: boolean;
}) {
  const [open, setOpen] = useState(section.defaultOpen ?? true);

  const accentColor = isCompassion
    ? "text-blue-800 bg-blue-50 ring-1 ring-blue-200 shadow-sm"
    : isReportit
      ? "text-cyan-800 bg-cyan-50 ring-1 ring-cyan-200 shadow-sm"
      : "text-green-800 bg-green-50 ring-1 ring-green-200 shadow-sm";
  const accentIcon = isCompassion ? "text-blue-600" : isReportit ? "text-cyan-600" : "text-green-600";

  return (
    <div className="mb-2 rounded-xl border border-transparent hover:border-gray-200/80 hover:bg-white/50 transition-colors px-1 py-1">
      {/* Section header — click to toggle */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-bold text-gray-500 uppercase tracking-[0.16em] hover:text-gray-700 transition-colors"
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
        <nav className="space-y-1 pb-0.5">
          {section.items.map((item) => {
            const hrefPath = item.href.split("?")[0];
            const active = hrefPath === "/" ? pathname === "/" : pathname.startsWith(hrefPath);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`group mx-1.5 flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium transition-all ${
                  active
                    ? `${accentColor} font-semibold`
                    : "text-gray-600 hover:bg-white hover:ring-1 hover:ring-gray-200 hover:text-gray-900"
                }`}
              >
                <span className={`shrink-0 rounded-lg p-1 transition-colors ${active ? `${accentIcon} bg-white/80` : "text-gray-400 bg-gray-100 group-hover:text-gray-600 group-hover:bg-gray-200"}`}>
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
 * When the QuickBooks plugin is enabled, injects the QB Sync nav item.
 */
export default function Sidebar() {
  const pathname = usePathname();
  const isCompassion = pathname.startsWith("/compassion");
  const isReportit = pathname.startsWith("/reports");
  const { qbEnabled } = usePlugins();
  const { user } = useAuth();

  /** QB Sync nav item — only injected when plugin is enabled */
  const qbSyncItem: NavItem = {
    label: "QB Sync",
    href: "/quickbooks-sync",
    icon: (
      <Ico d="M4 4v5h.6m14.8 2A8 8 0 004.6 9M20 20v-5h-.6m0 0A8 8 0 015 13m14.4 2H15" />
    ),
  };

  /** Build sections dynamically so we can inject QB Sync when enabled */
  const donorSections: NavSection[] = DONOR_SECTIONS.map((section) => {
    let sectionItems = section.items;

    if (section.label === "Fundraising" && qbEnabled) {
      sectionItems = [...sectionItems, qbSyncItem];
    }

    // Keep Watchdog nav hidden unless the current user is admin.
    if (section.label === "System" && user?.role !== "admin") {
      sectionItems = sectionItems.filter((item) => item.href !== "/watchdog");
    }

    return {
      ...section,
      items: sectionItems,
    };
  });

  const sections: NavSection[] = isReportit ? REPORTIT_SECTIONS : donorSections;

  return (
    <aside className="w-64 shrink-0 bg-gradient-to-b from-white to-gray-50 border-r border-gray-200/80 shadow-[inset_-1px_0_0_rgba(148,163,184,0.15)] flex flex-col h-full select-none">

      {/* ── Navigation sections (scrollable) ── */}
      <div className="flex-1 overflow-y-auto py-3 px-2.5">
        {sections.map((section) => (
          <SidebarSection
            key={section.label}
            section={section}
            pathname={pathname}
            isCompassion={isCompassion}
            isReportit={isReportit}
          />
        ))}
      </div>

      {/* ── Footer: org info or quick help ── */}
      <div className="border-t border-gray-200/70 px-4 py-3 bg-white/70">
        <div className="flex items-center gap-2 text-xs text-gray-500">
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
