/**
 * DonorMegaMenu — fixed horizontal mega-navigation bar for DonorCRM.
 * Replaces the left sidebar with a top-mounted nav strip at top-14 (below TopBar).
 * Each section header opens a wide dropdown panel with organized columns.
 */
"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { usePlugins } from "@/app/components/plugins/PluginProvider";

// ── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  id: string;
  label: string;
  href: string;
  description?: string;
  badge?: string;
}

interface NavSection {
  id: string;
  label: string;
  /** Direct link — renders as a simple link, no dropdown. */
  href?: string;
  /** Dropdown columns. Each inner array is one column. */
  columns?: NavItem[][];
  /** If true, section is shown only when QB Sync plugin is enabled. */
  requiresQb?: boolean;
}

// ── Nav data ─────────────────────────────────────────────────────────────────

const BASE_NAV_SECTIONS: NavSection[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/",
  },
  {
    id: "core-crm",
    label: "Core CRM",
    columns: [
      [
        {
          id: "constituents",
          label: "Constituents",
          href: "/constituents",
          description: "Donors, volunteers, and all supporters",
        },
        {
          id: "donations",
          label: "Donations",
          href: "/donations",
          description: "Gifts, giving history, and activity",
        },
      ],
      [
        {
          id: "tasks",
          label: "Tasks",
          href: "/tasks",
          description: "Follow-up tasks and stewardship",
        },
        {
          id: "communications",
          label: "Communications",
          href: "/communications",
          description: "Email projects and outreach work",
        },
      ],
    ],
  },
  {
    id: "fundraising",
    label: "Fundraising",
    columns: [
      [
        {
          id: "campaigns",
          label: "Campaigns",
          href: "/campaigns",
          description: "Fundraising campaigns and appeals",
        },
        {
          id: "grants",
          label: "Grants",
          href: "/grants",
          description: "Grant opportunities and deadlines",
        },
        {
          id: "payments",
          label: "Payments",
          href: "/payments",
          description: "Payment records and transactions",
        },
      ],
    ],
  },
  {
    id: "outreach",
    label: "Outreach",
    columns: [
      [
        {
          id: "letters",
          label: "Letters & Printables",
          href: "/letters-printables",
          description: "Thank-you letters and mail pieces",
        },
        {
          id: "contacts-manager",
          label: "Contacts Manager",
          href: "/contacts-manager",
          description: "Reusable audiences for campaigns",
        },
        {
          id: "livecom",
          label: "LiveCom",
          href: "/livecom/inbox",
          description: "Live donor chat and inbox",
        },
      ],
      [
        {
          id: "meetings",
          label: "Meetings",
          href: "/meetings",
          description: "Donor meetings and touchpoints",
        },
        {
          id: "steward-paths",
          label: "Steward Paths",
          href: "/steward-paths",
          description: "Engagement sequences and workflows",
        },
        {
          id: "volunteers",
          label: "Volunteers",
          href: "/volunteers",
          description: "Volunteer relationships",
        },
      ],
    ],
  },
  {
    id: "insights",
    label: "Insights",
    columns: [
      [
        {
          id: "agent-steward",
          label: "AGENTSteward AI",
          href: "/steward-ai-workspace",
          description: "AI-powered CRM assistant",
          badge: "AI",
        },
        {
          id: "steward-signals",
          label: "Steward Signals",
          href: "/steward-signals",
          description: "Donor signals and opportunities",
        },
        {
          id: "reports",
          label: "Reports",
          href: "/reports/donor-crm",
          description: "Giving, retention, and analytics",
        },
      ],
    ],
  },
  {
    id: "admin",
    label: "Admin",
    columns: [
      [
        {
          id: "settings",
          label: "Settings",
          href: "/settings",
          description: "Workspace and CRM configuration",
        },
        {
          id: "imports",
          label: "Imports",
          href: "/data-tools/import",
          description: "Import constituents and records",
        },
      ],
      [
        {
          id: "data-tools",
          label: "Data Tools",
          href: "/data-tools",
          description: "Quality checks, exports, and merge",
        },
        {
          id: "custom-fields",
          label: "Custom Fields",
          href: "/custom-fields",
          description: "Organization-specific fields",
        },
        {
          id: "help",
          label: "Help",
          href: "/help?scope=donor&scopePath=/",
          description: "Help guides and walkthroughs",
        },
      ],
    ],
  },
];

const QB_SYNC_ITEM: NavItem = {
  id: "qb-sync",
  label: "QB Sync",
  href: "/quickbooks-sync",
  description: "Queue and sync donations to QuickBooks",
};

// ── Helper icons ─────────────────────────────────────────────────────────────

function ChevronDown({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 flex-shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function DonorMegaMenu() {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { qbEnabled } = usePlugins();
  const [scrolled, setScrolled] = useState(false);

  // Build the full nav sections, injecting QB Sync into Fundraising when enabled.
  const navSections: NavSection[] = BASE_NAV_SECTIONS.map((section) => {
    if (section.id === "fundraising" && qbEnabled) {
      return {
        ...section,
        columns: section.columns
          ? [[...section.columns[0], QB_SYNC_ITEM], ...(section.columns.slice(1))]
          : [[QB_SYNC_ITEM]],
      };
    }
    return section;
  });

  // Track client mount for portal rendering.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Mirror the TopBar scroll-shrink so this bar slides up as TopBar shrinks.
  useEffect(() => {
    function handleScroll(e: Event) {
      const target = e.target as Element;
      if (typeof target?.scrollTop === "number") {
        setScrolled(target.scrollTop > 24);
      }
    }
    document.addEventListener("scroll", handleScroll, true);
    return () => document.removeEventListener("scroll", handleScroll, true);
  }, []);

  // Close on route change.
  useEffect(() => {
    setOpenSection(null);
    setDropdownAnchor(null);
  }, [pathname]);

  /**
   * Returns true if the given section contains the current pathname
   * (used to highlight the active top-nav button).
   */
  function isSectionActive(section: NavSection): boolean {
    if (section.href) {
      return pathname === section.href;
    }
    const allHrefs = section.columns?.flat().map((i) => i.href) ?? [];
    return allHrefs.some((h) => pathname === h || pathname.startsWith(h.split("?")[0] + "/"));
  }

  // Compute portal position for open dropdown.
  const activeSectionForPortal = openSection ? navSections.find((s) => s.id === openSection) : null;
  const portalColCount = activeSectionForPortal?.columns?.length ?? 1;
  const portalMinWidth = portalColCount > 1 ? 480 : 260;
  const portalLeft = dropdownAnchor
    ? Math.max(8, Math.min(dropdownAnchor.left, window.innerWidth - portalMinWidth - 8))
    : 0;

  return (
    <>
    <nav
      aria-label="DonorCRM primary navigation"
      className={`fixed left-0 right-0 z-[19] hidden md:flex h-10 items-stretch gap-0.5 border-b border-slate-700/60 bg-slate-900/98 px-2 backdrop-blur-sm transition-[top] duration-200 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${scrolled ? "top-10" : "top-14"}`}
    >
      {navSections.map((section) => {
        const active = isSectionActive(section);
        const open = openSection === section.id;

        /* ── Direct-link section ── */
        if (section.href) {
          return (
            <Link
              key={section.id}
              href={section.href}
              className={`relative flex shrink-0 items-center px-3.5 text-sm font-medium transition-colors duration-150 ${
                active
                  ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-emerald-400"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {section.label}
            </Link>
          );
        }

        /* ── Dropdown section ── */
        const colCount = section.columns?.length ?? 1;
        const dropdownWidth = colCount === 1 ? "min-w-[260px]" : "min-w-[480px]";

        return (
          <div key={section.id} className="relative flex h-full shrink-0 items-stretch">
            <button
              type="button"
              onClick={(e) => {
                if (open) {
                  setOpenSection(null);
                  setDropdownAnchor(null);
                } else {
                  setDropdownAnchor(e.currentTarget.getBoundingClientRect());
                  setOpenSection(section.id);
                }
              }}
              aria-expanded={open}
              aria-haspopup="true"
              className={`relative flex h-full shrink-0 items-center gap-1 px-3.5 text-sm font-medium transition-colors duration-150 ${
                active || open
                  ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-emerald-400"
                  : "text-slate-300 hover:text-white"
              }`}
            >
              {section.label}
              <ChevronDown open={open} />
            </button>

            {/* Dropdown panel is portaled — see below nav */}
          </div>
        );
      })}
    </nav>

    {/* Portal: dropdown panel rendered in document.body to escape overflow-x-auto clipping */}
    {mounted && activeSectionForPortal?.columns && dropdownAnchor && createPortal(
      <>
        {/* Backdrop — closes dropdown on outside click */}
        <div
          className="fixed inset-0 z-[48]"
          onClick={() => { setOpenSection(null); setDropdownAnchor(null); }}
        />
        {/* Dropdown panel */}
        <div
          style={{
            position: "fixed",
            top: dropdownAnchor.bottom + 2,
            left: portalLeft,
            minWidth: portalMinWidth,
            maxWidth: "calc(100vw - 16px)",
            zIndex: 49,
          }}
          className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
        >
          {/* Panel header */}
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400">
              {activeSectionForPortal.label}
            </p>
          </div>
          {/* Item columns */}
          <div className={`grid gap-1 p-2.5 ${portalColCount > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {activeSectionForPortal.columns.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-0.5">
                {col.map((item) => {
                  const itemActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href.split("?")[0] + "/");
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => { setOpenSection(null); setDropdownAnchor(null); }}
                      className={`group flex items-start gap-3 rounded-lg px-3 py-2.5 transition-colors ${
                        itemActive
                          ? "bg-emerald-50 text-emerald-700"
                          : "text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium leading-tight ${itemActive ? "text-emerald-700" : ""}`}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-xs leading-snug text-slate-400">{item.description}</p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </>,
      document.body
    )}
    </>
  );
}
