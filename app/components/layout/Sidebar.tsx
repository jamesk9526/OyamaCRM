/**
 * Sidebar: primary navigation for DonorCRM and OyamaREPORTIT CRM.
 * Contains brand logo at top, grouped nav sections, and bottom quick links.
 * Active state uses a left border + tinted background (no filled green pill).
 */
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type React from "react";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import { useAuth } from "@/app/components/auth/AuthProvider";
import OyamaGradientIcon from "@/app/components/ui/OyamaGradientIcon";

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
        icon: <OyamaGradientIcon name="growth-analytics" />,
      },
      {
        label: "Constituents",
        href: "/constituents",
        icon: <OyamaGradientIcon name="constituent-search" />,
      },
      {
        label: "Donations",
        href: "/donations",
        icon: <OyamaGradientIcon name="donor-gift" />,
      },
      {
        label: "Campaigns",
        href: "/campaigns",
        icon: <OyamaGradientIcon name="goal-target" />,
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
        icon: <OyamaGradientIcon name="reporting-dashboard" />,
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
        icon: <OyamaGradientIcon name="task-checklist" />,
      },
      {
        label: "Meetings",
        href: "/meetings",
        icon: <Ico d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />,
      },
      {
        label: "Communications",
        href: "/communications",
        icon: <OyamaGradientIcon name="messaging-chat" />,
      },
      {
        label: "Letters & Printables",
        href: "/letters-printables",
        icon: <OyamaGradientIcon name="reporting-dashboard" />,
      },
      {
        label: "LiveCom",
        href: "/livecom",
        icon: <OyamaGradientIcon name="client-support-chat" />,
        badge: "NEW",
      },
      {
        label: "Steward Paths",
        href: "/automations",
        icon: <OyamaGradientIcon name="client-profile-sync" />,
      },
      {
        label: "Steward Signals",
        href: "/steward-signals",
        icon: <OyamaGradientIcon name="momentum-growth" />,
      },
      {
        label: "Volunteers",
        href: "/volunteers",
        icon: <OyamaGradientIcon name="relationship-partnership" />,
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
        icon: <OyamaGradientIcon name="contact-checklist" />,
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
      {
        label: "Help",
        href: "/help?scope=donor&scopePath=/",
        icon: <OyamaGradientIcon name="messaging-chat" />,
      },
      {
        label: "OyamaWatchdog",
        href: "/watchdog",
        icon: <Ico d="M12 2l8 4v6c0 5.5-3.5 9.74-8 10-4.5-.26-8-4.5-8-10V6l8-4zm0 7v4m0 4h.01" />,
      },
      {
        label: "OyamaWebMaster",
        href: "/webmaster",
        icon: <Ico d="M8 21h12a2 2 0 002-2V7l-6-6H8a2 2 0 00-2 2v2m0 6l3 3m0 0l3-3m-3 3V3M3 7h5" />,
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
        icon: <OyamaGradientIcon name="reporting-dashboard" />,
      },
      {
        label: "Donor Insights",
        href: "/reports?tab=donors",
        icon: <OyamaGradientIcon name="constituent-search" />,
      },
      {
        label: "Giving Trends",
        href: "/reports?tab=giving",
        icon: <OyamaGradientIcon name="momentum-growth" />,
      },
      {
        label: "Campaign Performance",
        href: "/reports?tab=campaigns",
        icon: <OyamaGradientIcon name="growth-analytics" />,
      },
      {
        label: "Retention",
        href: "/reports?tab=retention",
        icon: <OyamaGradientIcon name="goal-target" />,
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
        icon: <OyamaGradientIcon name="donor-gift" />,
      },
      {
        label: "Events CRM",
        href: "/events",
        icon: <OyamaGradientIcon name="task-checklist" />,
      },
      {
        label: "Compassion CRM",
        href: "/compassion/dashboard",
        icon: <OyamaGradientIcon name="client-support-chat" />,
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
    ? "border-blue-600 text-blue-700 bg-blue-50"
    : isReportit
        ? "border-cyan-600 text-cyan-700 bg-cyan-50"
      : "border-green-600 text-green-700 bg-green-50";
  const accentIcon = isCompassion ? "text-blue-600" : isReportit ? "text-cyan-600" : "text-green-600";

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
            const hrefPath = item.href.split("?")[0];
            const active = hrefPath === "/" ? pathname === "/" : pathname.startsWith(hrefPath);
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
      <Ico>
        {/* Intuit-style refresh/sync icon */}
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </Ico>
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
    <aside className="w-56 shrink-0 bg-white border-r border-gray-200 flex flex-col h-full select-none">

      {/* ── Navigation sections (scrollable) ── */}
      <div className="flex-1 overflow-y-auto py-2 px-0">
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
