/**
 * DonorMegaMenu — compact DonorCRM workspace navigation below the global TopBar.
 * Each section opens a light mega panel with canonical donor workflows grouped by intent.
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

/** Minimal line icon used to keep the navigation compact without extra dependencies. */
function NavGlyph({ id }: { id: string }) {
  const pathById: Record<string, string> = {
    dashboard: "M4 13h6V5H4v8Zm10 6h6V5h-6v14ZM4 19h6v-4H4v4Z",
    "core-crm": "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm8 1a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM4 20a5 5 0 0 1 10 0M12 20a5 5 0 0 1 8-4",
    fundraising: "M12 3v18M7 7.5h7a3 3 0 0 1 0 6h-4a3 3 0 0 0 0 6h7",
    outreach: "M4 6h16v12H4V6Zm0 0 8 7 8-7",
    insights: "M5 19V5m0 14h14M9 15l3-4 3 2 4-6",
    admin: "M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Zm0-5v3m0 12v3M4.9 4.9 7 7m10 10 2.1 2.1M3 12h3m12 0h3M4.9 19.1 7 17m10-10 2.1-2.1",
  };
  const path = pathById[id] ?? "M5 12h14M12 5l7 7-7 7";
  return (
    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={1.9} viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d={path} />
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
  const portalMinWidth = portalColCount > 1 ? 560 : 320;
  const portalLeft = dropdownAnchor
    ? Math.max(8, Math.min(dropdownAnchor.left, window.innerWidth - portalMinWidth - 8))
    : 0;

  return (
    <>
    <nav
      aria-label="DonorCRM primary navigation"
      className={`fixed left-0 right-0 z-[19] hidden h-12 items-center gap-1 border-b border-slate-800/80 bg-slate-950/96 px-3 shadow-[0_12px_30px_rgba(2,6,23,0.28)] backdrop-blur-md transition-[top] duration-200 md:flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${scrolled ? "top-10" : "top-14"}`}
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
              className={`relative flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150 ${
                active
                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              <NavGlyph id={section.id} />
              {section.label}
            </Link>
          );
        }

        /* ── Dropdown section ── */
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
              className={`relative my-1.5 flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150 ${
                active || open
                  ? "bg-emerald-500/15 text-emerald-200 ring-1 ring-emerald-400/25"
                  : "text-slate-300 hover:bg-white/8 hover:text-white"
              }`}
            >
              <NavGlyph id={section.id} />
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
            top: dropdownAnchor.bottom + 8,
            left: portalLeft,
            minWidth: portalMinWidth,
            maxWidth: "calc(100vw - 16px)",
            zIndex: 49,
          }}
          className="overflow-hidden rounded-2xl border border-slate-700/80 bg-slate-950 shadow-[0_28px_80px_rgba(2,6,23,0.42)]"
        >
          {/* Panel header */}
          <div className="border-b border-slate-800 bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.18),transparent_34%),linear-gradient(90deg,#020617,#0f172a)] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-400/20 bg-emerald-400/10 text-emerald-200 shadow-sm">
                <NavGlyph id={activeSectionForPortal.id} />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{activeSectionForPortal.label}</p>
                <p className="text-xs text-slate-400">Open the canonical donor workspace or workflow.</p>
              </div>
            </div>
          </div>
          {/* Item columns */}
          <div className={`grid gap-2 p-3 ${portalColCount > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {activeSectionForPortal.columns.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-1">
                {col.map((item) => {
                  const itemActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href.split("?")[0] + "/");
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => { setOpenSection(null); setDropdownAnchor(null); }}
                      className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        itemActive
                          ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-200"
                          : "border-transparent text-slate-300 hover:border-slate-700 hover:bg-white/8 hover:text-white"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${itemActive ? "bg-emerald-400/15 text-emerald-200" : "bg-white/8 text-slate-400 group-hover:bg-white/10 group-hover:text-emerald-200"}`}>
                        <NavGlyph id={activeSectionForPortal.id} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium leading-tight ${itemActive ? "text-emerald-100" : ""}`}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className="rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200">
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
