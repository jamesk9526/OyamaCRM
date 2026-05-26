/**
 * DonorMegaMenu — compact DonorCRM workspace navigation below the global TopBar.
 * Each section opens a dark mega panel with canonical donor workflows grouped by intent.
 */
"use client";

import Link from "next/link";
import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import { type DonorAccentTone } from "@/app/lib/workspace-settings";

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

interface RibbonTab {
  id: string;
  label: string;
  href: string;
  match: string[];
}

interface RibbonCommand {
  id: string;
  label: string;
  href: string;
  icon: string;
  tone: "green" | "blue" | "purple" | "orange" | "teal" | "amber" | "slate";
  badge?: string;
}

interface RibbonCommandGroup {
  label: string;
  commands: RibbonCommand[];
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
        {
          id: "designations",
          label: "Designations",
          href: "/designations",
          description: "Fund options used in donation entry",
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
          href: "/reports",
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

const RIBBON_TABS: RibbonTab[] = [
  { id: "home", label: "Home", href: "/", match: ["/"] },
  { id: "constituents", label: "Constituents", href: "/constituents", match: ["/constituents", "/contacts-manager", "/volunteers"] },
  { id: "giving", label: "Giving", href: "/donations", match: ["/donations", "/campaigns", "/grants", "/payments", "/designations", "/quickbooks-sync"] },
  { id: "outreach", label: "Outreach", href: "/communications", match: ["/communications", "/email-builder", "/letters-printables", "/livecom", "/meetings", "/steward-paths"] },
  { id: "reports", label: "Reports", href: "/reports", match: ["/reports", "/steward-signals", "/steward-ai-workspace"] },
  { id: "data", label: "Data", href: "/data-tools", match: ["/data-tools", "/custom-fields"] },
  { id: "tools", label: "Tools", href: "/settings", match: ["/settings", "/help", "/steward-paths", "/automations"] },
  { id: "view", label: "View", href: "/preferences", match: ["/preferences"] },
];

const HOME_RIBBON_GROUPS: RibbonCommandGroup[] = [
  {
    label: "Create",
    commands: [
      { id: "add-constituent", label: "Add Constituent", href: "/constituents/new", icon: "person-add", tone: "green" },
      { id: "record-donation", label: "Record Donation", href: "/donations?recordGift=1", icon: "gift", tone: "green" },
      { id: "create-task", label: "Create Task", href: "/tasks", icon: "task", tone: "purple" },
    ],
  },
  {
    label: "Communicate",
    commands: [
      { id: "send-email", label: "Send Email", href: "/communications", icon: "mail", tone: "blue" },
      { id: "create-letter", label: "Create Letter", href: "/letters-printables", icon: "document", tone: "blue" },
      { id: "add-campaign", label: "Add to Campaign", href: "/campaigns", icon: "megaphone", tone: "blue" },
    ],
  },
  {
    label: "Data & Import",
    commands: [
      { id: "import-data", label: "Import Data", href: "/data-tools/import", icon: "import", tone: "orange" },
      { id: "data-quality", label: "Data Quality", href: "/data-tools", icon: "database", tone: "orange" },
      { id: "dedupe", label: "Deduplicate Manager", href: "/contacts-manager", icon: "people-check", tone: "orange" },
    ],
  },
  {
    label: "Analyze",
    commands: [
      { id: "view-reports", label: "View Reports", href: "/reports", icon: "bar-chart", tone: "teal" },
      { id: "dashboard-analytics", label: "Dashboard Analytics", href: "/", icon: "pie-chart", tone: "teal" },
      { id: "giving-trends", label: "Giving Trends", href: "/reports", icon: "line-chart", tone: "teal" },
    ],
  },
  {
    label: "Manage",
    commands: [
      { id: "steward-paths", label: "Steward Paths", href: "/steward-paths", icon: "path", tone: "purple" },
      { id: "designations", label: "Designations", href: "/designations", icon: "tag", tone: "purple" },
      { id: "settings", label: "Settings", href: "/settings", icon: "settings", tone: "purple" },
    ],
  },
  {
    label: "Quick Actions",
    commands: [
      { id: "favorites", label: "Favorites", href: "/preferences", icon: "star", tone: "amber" },
      { id: "help", label: "More", href: "/help?scope=donor&scopePath=/", icon: "more", tone: "slate" },
    ],
  },
];

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

interface DonorMegaMenuProps {
  donorAccentTone?: DonorAccentTone;
  scrolled?: boolean;
}

interface LightAccentTheme {
  navActive: string;
  navRing: string;
  navText: string;
  navTextStrong: string;
  iconTint: string;
  iconTintSoft: string;
  iconBorder: string;
  badge: string;
}

const LIGHT_ACCENT_THEMES: Record<DonorAccentTone, LightAccentTheme> = {
  green: {
    navActive: "bg-emerald-50",
    navRing: "ring-1 ring-emerald-200/80 border-emerald-200",
    navText: "text-emerald-800",
    navTextStrong: "text-emerald-950",
    iconTint: "text-emerald-700",
    iconTintSoft: "bg-emerald-50",
    iconBorder: "border-emerald-200",
    badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
  },
  blue: {
    navActive: "bg-blue-50",
    navRing: "ring-1 ring-blue-200/80 border-blue-200",
    navText: "text-blue-800",
    navTextStrong: "text-blue-950",
    iconTint: "text-blue-700",
    iconTintSoft: "bg-blue-50",
    iconBorder: "border-blue-200",
    badge: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  },
  teal: {
    navActive: "bg-teal-50",
    navRing: "ring-1 ring-teal-200/80 border-teal-200",
    navText: "text-teal-800",
    navTextStrong: "text-teal-950",
    iconTint: "text-teal-700",
    iconTintSoft: "bg-teal-50",
    iconBorder: "border-teal-200",
    badge: "bg-teal-50 text-teal-700 ring-1 ring-teal-100",
  },
  amber: {
    navActive: "bg-amber-50",
    navRing: "ring-1 ring-amber-200/80 border-amber-200",
    navText: "text-amber-800",
    navTextStrong: "text-amber-950",
    iconTint: "text-amber-700",
    iconTintSoft: "bg-amber-50",
    iconBorder: "border-amber-200",
    badge: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
  },
};

export default function DonorMegaMenu({ donorAccentTone = "green", scrolled = false }: DonorMegaMenuProps) {
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [mobileSectionId, setMobileSectionId] = useState<string | null>(null);
  const [dropdownAnchor, setDropdownAnchor] = useState<DOMRect | null>(null);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const { qbEnabled } = usePlugins();
  const accentTheme = LIGHT_ACCENT_THEMES[donorAccentTone] ?? LIGHT_ACCENT_THEMES.green;

  // Build the full nav sections, injecting QB Sync into Fundraising when enabled.
  const navSections: NavSection[] = useMemo(() => BASE_NAV_SECTIONS.map((section) => {
    if (section.id === "fundraising" && qbEnabled) {
      return {
        ...section,
        columns: section.columns
          ? [[...section.columns[0], QB_SYNC_ITEM], ...(section.columns.slice(1))]
          : [[QB_SYNC_ITEM]],
      };
    }
    return section;
  }), [qbEnabled]);

  // Track client mount for portal rendering.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Close on route change.
  useEffect(() => {
    setOpenSection(null);
    setMobileSectionId(null);
    setDropdownAnchor(null);
  }, [pathname]);

  // Production polish: close transient panels when the viewport changes or Escape is pressed.
  useEffect(() => {
    if (!openSection) return;

    function closeDropdown() {
      setOpenSection(null);
      setDropdownAnchor(null);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeDropdown();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", closeDropdown);
    document.addEventListener("scroll", closeDropdown, true);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", closeDropdown);
      document.removeEventListener("scroll", closeDropdown, true);
    };
  }, [openSection]);

  // Keep the mobile mega menu modal stable and dismissible on small screens.
  useEffect(() => {
    if (!mobileSectionId) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileSectionId(null);
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [mobileSectionId]);

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
  const activeMobileSection = mobileSectionId ? navSections.find((s) => s.id === mobileSectionId) : null;
  const portalColCount = activeSectionForPortal?.columns?.length ?? 1;
  const portalMinWidth = portalColCount > 1 ? 560 : 320;
  const portalLeft = dropdownAnchor
    ? Math.max(8, Math.min(dropdownAnchor.left, window.innerWidth - portalMinWidth - 8))
    : 0;
  const portalId = activeSectionForPortal ? `donor-mega-menu-${activeSectionForPortal.id}` : undefined;

  return (
    <>
    <nav
      aria-label="DonorCRM mobile workspace navigation"
      className="fixed left-0 right-0 top-16 z-[19] flex h-12 items-center gap-1 overflow-x-auto border-b border-slate-200/80 bg-white/95 px-2 shadow-[0_10px_24px_rgba(15,23,42,0.055)] backdrop-blur-xl transition-[top] duration-200 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden"
    >
      {navSections.map((section) => {
        const active = isSectionActive(section);

        if (section.href) {
          return (
            <Link
              key={section.id}
              href={section.href}
              className={`flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
                active
                  ? `${accentTheme.navActive} ${accentTheme.navText} ${accentTheme.navRing}`
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
              }`}
            >
              <NavGlyph id={section.id} />
              <span>{section.label}</span>
            </Link>
          );
        }

        return (
          <button
            key={section.id}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={mobileSectionId === section.id}
            onClick={() => setMobileSectionId(section.id)}
            className={`flex h-9 shrink-0 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition-colors ${
              active || mobileSectionId === section.id
                ? `${accentTheme.navActive} ${accentTheme.navText} ${accentTheme.navRing}`
                : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
            }`}
          >
            <NavGlyph id={section.id} />
            <span>{section.label}</span>
            <ChevronDown open={mobileSectionId === section.id} />
          </button>
        );
      })}
    </nav>

    <nav
      aria-label="DonorCRM primary navigation"
      className={`fixed left-0 right-0 top-16 z-[19] hidden h-12 items-center gap-1 overflow-x-auto border-b border-slate-200/80 bg-white/92 px-3 shadow-[0_10px_26px_rgba(15,23,42,0.055)] backdrop-blur-xl transition-[top] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden ${scrolled ? "xl:top-24" : "xl:top-32"}`}
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
                  ? `${accentTheme.navActive} ${accentTheme.navText} ${accentTheme.navRing}`
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
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
              aria-haspopup="menu"
              aria-controls={open ? `donor-mega-menu-${section.id}` : undefined}
              className={`relative my-1.5 flex h-9 shrink-0 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition-colors duration-150 ${
                active || open
                  ? `${accentTheme.navActive} ${accentTheme.navText} ${accentTheme.navRing}`
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
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
      <button
        type="button"
        onClick={() => {
          window.dispatchEvent(new CustomEvent("crm:set-donor-shell-layout", { detail: { layout: "sidebar" } }));
          setOpenSection(null);
          setDropdownAnchor(null);
        }}
        className={`ml-auto flex h-8 shrink-0 items-center gap-2 rounded-lg border bg-white px-3 text-xs font-semibold shadow-sm transition-colors ${accentTheme.iconBorder} ${accentTheme.iconTintSoft} ${accentTheme.iconTint} hover:bg-slate-50`}
        title="Switch to sidebar navigation"
        aria-label="Switch to sidebar navigation"
      >
        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h4v12H4V6Zm6 0h10M10 12h10M10 18h10" />
        </svg>
        <span>Use Sidebar</span>
      </button>
    </nav>

    {activeMobileSection?.columns ? (
      <div className="fixed inset-0 z-[50] md:hidden" role="dialog" aria-modal="true" aria-label={`${activeMobileSection.label} navigation`}>
        <button
          type="button"
          aria-label={`Close ${activeMobileSection.label} navigation`}
          onClick={() => setMobileSectionId(null)}
          className="absolute inset-0 bg-slate-950/25 backdrop-blur-[2px]"
        />
        <div className="absolute inset-x-2 bottom-2 flex max-h-[82dvh] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.22)] pb-[max(0.5rem,env(safe-area-inset-bottom))]">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.09),transparent_34%),linear-gradient(90deg,#ffffff,#f8fafc)] px-4 py-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm ${accentTheme.iconBorder} ${accentTheme.iconTintSoft} ${accentTheme.iconTint}`}>
                <NavGlyph id={activeMobileSection.id} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-950">{activeMobileSection.label}</p>
                <p className="truncate text-xs text-slate-500">Choose a donor workspace or workflow.</p>
              </div>
            </div>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setMobileSectionId(null)}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {activeMobileSection.columns.flat().map((item) => {
              const itemActive =
                pathname === item.href ||
                pathname.startsWith(item.href.split("?")[0] + "/");
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={() => setMobileSectionId(null)}
                  className={`group flex items-start gap-3 rounded-xl border px-3 py-3 transition-colors ${
                    itemActive
                      ? `${accentTheme.navRing} ${accentTheme.navActive} ${accentTheme.navText}`
                      : "border-slate-100 text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
                  }`}
                >
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${itemActive ? `${accentTheme.iconTintSoft} ${accentTheme.iconTint}` : "bg-slate-50 text-slate-400 group-hover:bg-white"}`}>
                    <NavGlyph id={activeMobileSection.id} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`flex items-center gap-1.5 text-sm font-semibold leading-tight ${itemActive ? accentTheme.navTextStrong : ""}`}>
                      <span className="truncate">{item.label}</span>
                      {item.badge ? (
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${accentTheme.badge}`}>
                          {item.badge}
                        </span>
                      ) : null}
                    </span>
                    {item.description ? (
                      <span className="mt-0.5 block text-xs leading-snug text-slate-500">{item.description}</span>
                    ) : null}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    ) : null}

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
          id={portalId}
          role="menu"
          aria-label={`${activeSectionForPortal.label} navigation`}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_28px_80px_rgba(15,23,42,0.18)]"
        >
          {/* Panel header */}
          <div className="border-b border-slate-100 bg-[radial-gradient(circle_at_15%_0%,rgba(16,185,129,0.09),transparent_34%),linear-gradient(90deg,#ffffff,#f8fafc)] px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={`flex h-9 w-9 items-center justify-center rounded-xl border shadow-sm ${accentTheme.iconBorder} ${accentTheme.iconTintSoft} ${accentTheme.iconTint}`}>
                <NavGlyph id={activeSectionForPortal.id} />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-950">{activeSectionForPortal.label}</p>
                <p className="text-xs text-slate-500">Open the canonical donor workspace or workflow.</p>
              </div>
            </div>
          </div>
          {/* Item columns */}
          <div className={`grid gap-2 p-3 ${portalColCount > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {activeSectionForPortal.columns.map((col, colIdx) => (
              <div key={colIdx} className="flex flex-col gap-1" role="presentation">
                {col.map((item) => {
                  const itemActive =
                    pathname === item.href ||
                    pathname.startsWith(item.href.split("?")[0] + "/");
                  return (
                    <Link
                      key={item.id}
                      href={item.href}
                      onClick={() => { setOpenSection(null); setDropdownAnchor(null); }}
                      role="menuitem"
                      className={`group flex items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors ${
                        itemActive
                          ? `${accentTheme.navRing} ${accentTheme.navActive} ${accentTheme.navText}`
                          : "border-transparent text-slate-700 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-950"
                      }`}
                    >
                      <span className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${itemActive ? `${accentTheme.iconTintSoft} ${accentTheme.iconTint}` : "bg-slate-50 text-slate-400 group-hover:bg-white"}`}>
                        <NavGlyph id={activeSectionForPortal.id} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className={`text-sm font-medium leading-tight ${itemActive ? accentTheme.navTextStrong : ""}`}>
                            {item.label}
                          </span>
                          {item.badge && (
                            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${accentTheme.badge}`}>
                              {item.badge}
                            </span>
                          )}
                        </div>
                        {item.description && (
                          <p className="mt-0.5 text-xs leading-snug text-slate-500">{item.description}</p>
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
