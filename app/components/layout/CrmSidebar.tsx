// Shared configurable CRM sidebar with collapsible icon-only mode and accessible tooltips.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type React from "react";

export type SidebarItemKind =
  | "workspace"
  | "core_record"
  | "daily_tool"
  | "communication_tool"
  | "insight"
  | "people"
  | "system";

export type SidebarItemBadge = "App" | "Tool" | "New" | "Beta" | "Partial" | "Planned";

/** One navigation item in a CRM sidebar group. */
export interface CrmSidebarItem {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  kind?: SidebarItemKind;
  badge?: SidebarItemBadge;
  description?: string;
  permissions?: string[];
  allowedRoles?: string[];
  hiddenForRoles?: string[];
  children?: CrmSidebarItem[];
  exact?: boolean;
  activePath?: string;
  activeHash?: string;
}

/** Group of related sidebar items with optional collapsible behavior. */
export interface CrmSidebarGroup {
  id: string;
  label: string;
  description?: string;
  defaultOpen?: boolean;
  collapsible?: boolean;
  items: CrmSidebarItem[];
}

export type CrmSidebarVariant = "donor" | "compassion" | "events" | "hrm" | "watchdog";

interface SidebarVariantStyles {
  aside: string;
  navSurface: string;
  heading: string;
  headingMuted: string;
  itemActive: string;
  itemInactive: string;
  iconActive: string;
  iconInactive: string;
  badge: string;
  sectionBorder: string;
  sectionHover: string;
  footer: string;
  footerText: string;
  collapseButton: string;
  tooltip: string;
  tooltipSubtitle: string;
  divider: string;
}

interface CrmSidebarProps {
  groups: CrmSidebarGroup[];
  variant: CrmSidebarVariant;
  storageKey: string;
  userRole?: string | null;
  forceExpanded?: boolean;
  expandedWidthClass?: string;
  collapsedWidthClass?: string;
  organizationLabel?: string;
}

const VARIANT_STYLES: Record<CrmSidebarVariant, SidebarVariantStyles> = {
  donor: {
    aside: "bg-gradient-to-b from-white to-gray-50 border-r border-gray-200/80 shadow-[inset_-1px_0_0_rgba(148,163,184,0.15)]",
    navSurface: "",
    heading: "text-gray-500",
    headingMuted: "hover:text-gray-700",
    itemActive: "text-green-800 bg-green-50 ring-1 ring-green-200 shadow-sm font-semibold",
    itemInactive: "text-gray-600 hover:bg-white hover:ring-1 hover:ring-gray-200 hover:text-gray-900",
    iconActive: "text-green-600 bg-white/80",
    iconInactive: "text-gray-400 bg-gray-100 group-hover:text-gray-600 group-hover:bg-gray-200",
    badge: "bg-green-100 text-green-700",
    sectionBorder: "border-transparent",
    sectionHover: "hover:border-gray-200/80 hover:bg-white/50",
    footer: "border-t border-gray-200/70 bg-white/70",
    footerText: "text-gray-500",
    collapseButton: "border-gray-200 bg-white text-gray-600 hover:text-gray-900 hover:bg-gray-50",
    tooltip: "border-gray-200 bg-white text-gray-900 shadow-xl",
    tooltipSubtitle: "text-gray-500",
    divider: "bg-gray-200",
  },
  compassion: {
    aside: "bg-gradient-to-b from-white to-blue-50/30 border-r border-blue-100 shadow-[inset_-1px_0_0_rgba(59,130,246,0.12)]",
    navSurface: "",
    heading: "text-blue-400",
    headingMuted: "hover:text-blue-600",
    itemActive: "text-blue-800 bg-blue-50 ring-1 ring-blue-200 shadow-sm font-semibold",
    itemInactive: "text-gray-600 hover:bg-white hover:ring-1 hover:ring-blue-200 hover:text-blue-900",
    iconActive: "text-blue-600 bg-white/80",
    iconInactive: "text-gray-400 bg-blue-50 group-hover:bg-blue-100 group-hover:text-blue-600",
    badge: "bg-blue-100 text-blue-700",
    sectionBorder: "border-transparent",
    sectionHover: "hover:border-blue-200/80 hover:bg-white/60",
    footer: "border-t border-blue-100 bg-white/70",
    footerText: "text-blue-500",
    collapseButton: "border-blue-200 bg-white text-blue-600 hover:text-blue-800 hover:bg-blue-50",
    tooltip: "border-blue-200 bg-white text-blue-900 shadow-xl",
    tooltipSubtitle: "text-blue-600",
    divider: "bg-blue-200",
  },
  events: {
    aside: "bg-white border-r border-gray-200",
    navSurface: "",
    heading: "text-amber-400",
    headingMuted: "hover:text-amber-600",
    itemActive: "text-amber-700 bg-amber-50 ring-1 ring-amber-200 shadow-sm font-semibold",
    itemInactive: "text-gray-600 hover:bg-gray-100 hover:text-gray-900",
    iconActive: "text-amber-600 bg-white",
    iconInactive: "text-gray-400 bg-amber-50 group-hover:bg-amber-100 group-hover:text-amber-600",
    badge: "bg-amber-100 text-amber-700",
    sectionBorder: "border-transparent",
    sectionHover: "hover:border-amber-200/70 hover:bg-amber-50/40",
    footer: "border-t border-gray-100 bg-white",
    footerText: "text-gray-400",
    collapseButton: "border-amber-200 bg-white text-amber-700 hover:text-amber-900 hover:bg-amber-50",
    tooltip: "border-amber-200 bg-white text-amber-900 shadow-xl",
    tooltipSubtitle: "text-amber-700",
    divider: "bg-amber-200",
  },
  hrm: {
    aside: "bg-white border-r border-teal-100",
    navSurface: "",
    heading: "text-teal-500",
    headingMuted: "hover:text-teal-700",
    itemActive: "text-teal-700 bg-teal-50 ring-1 ring-teal-200 shadow-sm font-semibold",
    itemInactive: "text-gray-600 hover:bg-gray-50 hover:text-gray-900",
    iconActive: "text-teal-600 bg-white",
    iconInactive: "text-gray-400 bg-teal-50 group-hover:bg-teal-100 group-hover:text-teal-600",
    badge: "bg-teal-100 text-teal-700",
    sectionBorder: "border-transparent",
    sectionHover: "hover:border-teal-200/70 hover:bg-teal-50/40",
    footer: "border-t border-teal-100 bg-white",
    footerText: "text-gray-500",
    collapseButton: "border-teal-200 bg-white text-teal-700 hover:text-teal-900 hover:bg-teal-50",
    tooltip: "border-teal-200 bg-white text-teal-900 shadow-xl",
    tooltipSubtitle: "text-teal-700",
    divider: "bg-teal-200",
  },
  watchdog: {
    aside: "bg-gradient-to-b from-slate-100 to-white border-r border-slate-200 shadow-[inset_-1px_0_0_rgba(71,85,105,0.12)]",
    navSurface: "",
    heading: "text-slate-500",
    headingMuted: "hover:text-slate-700",
    itemActive: "text-slate-900 bg-slate-100 ring-1 ring-slate-300 shadow-sm font-semibold",
    itemInactive: "text-slate-600 hover:bg-white hover:ring-1 hover:ring-slate-200 hover:text-slate-900",
    iconActive: "text-slate-700 bg-white",
    iconInactive: "text-slate-400 bg-slate-100 group-hover:bg-slate-200 group-hover:text-slate-600",
    badge: "bg-slate-200 text-slate-700",
    sectionBorder: "border-transparent",
    sectionHover: "hover:border-slate-200 hover:bg-white/80",
    footer: "border-t border-slate-200 bg-white/80",
    footerText: "text-slate-500",
    collapseButton: "border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50",
    tooltip: "border-slate-300 bg-white text-slate-900 shadow-xl",
    tooltipSubtitle: "text-slate-600",
    divider: "bg-slate-300",
  },
};

/** Returns true when the item should be shown for the current role. */
export function isSidebarItemVisible(item: CrmSidebarItem, userRole?: string | null): boolean {
  if (item.allowedRoles && item.allowedRoles.length > 0) {
    if (!userRole || !item.allowedRoles.includes(userRole)) {
      return false;
    }
  }

  if (item.hiddenForRoles && item.hiddenForRoles.length > 0 && userRole) {
    if (item.hiddenForRoles.includes(userRole)) {
      return false;
    }
  }

  // TODO: wire front-end checks against persisted user permission overrides when available.
  return true;
}

/** Determines whether a sidebar item is active for the current route context. */
export function isSidebarItemActive(item: CrmSidebarItem, pathname: string, hash: string): boolean {
  const activePath = item.activePath ?? item.href.split("?")[0].split("#")[0];

  if (item.activeHash !== undefined) {
    return pathname === activePath && hash === item.activeHash;
  }

  if (item.exact || activePath === "/") {
    return pathname === activePath;
  }

  return pathname === activePath || pathname.startsWith(`${activePath}/`);
}

/** Builds default open/closed state for each sidebar group. */
function getInitialGroupOpenState(groups: CrmSidebarGroup[]): Record<string, boolean> {
  const state: Record<string, boolean> = {};

  groups.forEach((group) => {
    if (group.collapsible) {
      state[group.id] = group.defaultOpen ?? true;
    }
  });

  return state;
}

/** Shared CRM sidebar renderer used by Donor, Compassion, Events, HRM, and Watchdog modules. */
export default function CrmSidebar({
  groups,
  variant,
  storageKey,
  userRole,
  forceExpanded = false,
  expandedWidthClass = "w-64",
  collapsedWidthClass = "w-20",
  organizationLabel = "Oyama Organization",
}: CrmSidebarProps) {
  const pathname = usePathname();
  const styles = VARIANT_STYLES[variant];
  const [hash, setHash] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [groupOpenState, setGroupOpenState] = useState<Record<string, boolean>>(() => getInitialGroupOpenState(groups));

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(storageKey);
    if (stored === "1" || stored === "true") {
      setCollapsed(true);
    }
    setIsHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!isHydrated || forceExpanded || typeof window === "undefined") return;

    window.localStorage.setItem(storageKey, collapsed ? "true" : "false");
  }, [collapsed, forceExpanded, isHydrated, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateHash = () => setHash(window.location.hash || "");
    updateHash();
    window.addEventListener("hashchange", updateHash);

    return () => {
      window.removeEventListener("hashchange", updateHash);
    };
  }, []);

  useEffect(() => {
    setGroupOpenState((current) => {
      const nextState = { ...current };

      groups.forEach((group) => {
        if (!group.collapsible) return;
        if (typeof nextState[group.id] !== "boolean") {
          nextState[group.id] = group.defaultOpen ?? true;
        }
      });

      return nextState;
    });
  }, [groups]);

  const isCollapsed = forceExpanded ? false : collapsed;

  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => isSidebarItemVisible(item, userRole)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, userRole]);

  return (
    <aside
      className={`${styles.aside} ${isCollapsed ? collapsedWidthClass : expandedWidthClass} shrink-0 flex flex-col h-full select-none transition-[width] duration-200 ease-out`}
      data-sidebar-collapsed={isCollapsed ? "true" : "false"}
    >
      <div className={`flex-1 overflow-y-auto py-3 px-2.5 ${styles.navSurface}`}>
        {!forceExpanded ? (
          <div className={`mb-2 flex ${isCollapsed ? "justify-center" : "justify-end"}`}>
            <button
              type="button"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
              onClick={() => setCollapsed((current) => !current)}
              className={`inline-flex items-center justify-center rounded-lg border w-8 h-8 transition-colors ${styles.collapseButton}`}
            >
              {isCollapsed ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              )}
            </button>
          </div>
        ) : null}

        {visibleGroups.map((group, index) => {
          const groupIsOpen = group.collapsible ? (groupOpenState[group.id] ?? true) : true;

          return (
            <div
              key={group.id}
              className={`mb-2 rounded-xl border px-1 py-1 transition-colors ${styles.sectionBorder} ${styles.sectionHover}`}
            >
              {isCollapsed ? (
                <div className="px-2 py-1.5" aria-hidden="true">
                  <div className={`h-px w-full ${styles.divider}`} />
                </div>
              ) : (
                <div className="px-2 py-0.5">
                  {group.collapsible ? (
                    <button
                      type="button"
                      onClick={() => {
                        setGroupOpenState((current) => ({
                          ...current,
                          [group.id]: !(current[group.id] ?? true),
                        }));
                      }}
                      className={`w-full flex items-center justify-between px-1 py-1 text-[10px] font-bold uppercase tracking-[0.16em] transition-colors ${styles.heading} ${styles.headingMuted}`}
                    >
                      <span>{group.label}</span>
                      <svg
                        className={`w-3 h-3 transition-transform duration-200 ${groupIsOpen ? "rotate-0" : "-rotate-90"}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  ) : (
                    <p className={`px-1 py-1 text-[10px] font-bold uppercase tracking-[0.16em] ${styles.heading}`}>
                      {group.label}
                    </p>
                  )}
                </div>
              )}

              {groupIsOpen && (
                <nav className="space-y-1 pb-0.5" aria-label={group.label}>
                  {group.items.map((item) => {
                    const active = isSidebarItemActive(item, pathname, hash);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        aria-label={isCollapsed ? item.label : undefined}
                        className={`group relative mx-1.5 flex items-center ${isCollapsed ? "justify-center" : "justify-start"} gap-2.5 rounded-xl px-2.5 py-2 text-[13px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-500 ${active ? styles.itemActive : styles.itemInactive}`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <span
                          className={`shrink-0 rounded-lg p-1 transition-colors ${active ? styles.iconActive : styles.iconInactive}`}
                          aria-hidden="true"
                        >
                          {item.icon}
                        </span>

                        {!isCollapsed ? (
                          <>
                            <span className="truncate">{item.label}</span>
                            {item.badge ? (
                              <span className={`ml-auto rounded-full px-1.5 py-0.5 text-[10px] font-bold ${styles.badge}`}>
                                {item.badge}
                              </span>
                            ) : null}
                          </>
                        ) : null}

                        {isCollapsed ? (
                          <span
                            role="tooltip"
                            className={`pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden min-w-[200px] -translate-y-1/2 rounded-lg border px-3 py-2 text-left shadow-lg group-hover:block group-focus-visible:block ${styles.tooltip}`}
                          >
                            <span className="flex items-center gap-2 text-xs font-semibold">
                              <span>{item.label}</span>
                              {item.badge ? (
                                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${styles.badge}`}>
                                  {item.badge}
                                </span>
                              ) : null}
                            </span>
                            {item.description ? (
                              <span className={`mt-1 block text-[11px] leading-relaxed ${styles.tooltipSubtitle}`}>
                                {item.description}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </Link>
                    );
                  })}
                </nav>
              )}

              {isCollapsed && index === visibleGroups.length - 1 ? (
                <span className="sr-only">Sidebar is in icon-only mode</span>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className={`px-4 py-3 ${styles.footer}`}>
        <div className={`flex items-center gap-2 text-xs ${styles.footerText}`}>
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.75}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
          {!isCollapsed ? <span className="truncate">{organizationLabel}</span> : <span className="sr-only">{organizationLabel}</span>}
        </div>
      </div>
    </aside>
  );
}
