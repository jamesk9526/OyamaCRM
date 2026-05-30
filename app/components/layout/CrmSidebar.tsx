// Shared configurable CRM sidebar with collapsible icon-only mode and accessible tooltips.
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type React from "react";
import type { DonorAccentTone } from "@/app/lib/workspace-settings";
import type { DashboardChromeTint } from "@/app/lib/dashboard-image-tint";

export type SidebarItemKind =
  | "workspace"
  | "core_record"
  | "daily_tool"
  | "communication_tool"
  | "insight"
  | "people"
  | "system";

export type SidebarItemBadge = "App" | "Tool" | "New" | "Beta" | "Partial" | "Planned" | "AI" | "Live";

/** One navigation item in a CRM sidebar group. */
export interface CrmSidebarItem {
  id: string;
  label: string;
  secondaryLabel?: string;
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
  accent: string;
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
  donorAccentTone?: DonorAccentTone;
  donorChromeTint?: DashboardChromeTint;
  footerAction?: {
    label: string;
    ariaLabel?: string;
    onClick: () => void;
  };
  brandHeader?: React.ReactNode;
  brandHeaderCollapsed?: React.ReactNode;
}

const DONOR_ACCENT_OVERRIDES: Record<DonorAccentTone, { iconActive: string; accent: string; focusRing: string; buttonTone: string }> = {
  green: {
    iconActive: "text-emerald-200",
    accent: "bg-emerald-500",
    focusRing: "focus-visible:ring-emerald-400",
    buttonTone: "border-emerald-800/70 bg-emerald-900/35 text-emerald-100 hover:border-emerald-600/70 hover:bg-emerald-800/45",
  },
  blue: {
    iconActive: "text-blue-200",
    accent: "bg-blue-500",
    focusRing: "focus-visible:ring-blue-400",
    buttonTone: "border-blue-900/60 bg-blue-950/55 text-blue-100 hover:border-blue-700 hover:bg-blue-900/65",
  },
  teal: {
    iconActive: "text-teal-200",
    accent: "bg-teal-500",
    focusRing: "focus-visible:ring-teal-400",
    buttonTone: "border-teal-900/60 bg-teal-950/55 text-teal-100 hover:border-teal-700 hover:bg-teal-900/65",
  },
  amber: {
    iconActive: "text-amber-200",
    accent: "bg-amber-500",
    focusRing: "focus-visible:ring-amber-400",
    buttonTone: "border-amber-900/60 bg-amber-950/55 text-amber-100 hover:border-amber-700 hover:bg-amber-900/65",
  },
};

const VARIANT_STYLES: Record<CrmSidebarVariant, SidebarVariantStyles> = {
  donor: {
    aside: "bg-[linear-gradient(180deg,#063229_0%,#042a23_36%,#03231d_100%)] border-r border-[#0a2318] shadow-[4px_0_12px_rgba(2,18,14,0.35)]",
    navSurface: "",
    heading: "text-emerald-100/58",
    headingMuted: "hover:text-emerald-50",
    itemActive: "text-emerald-50 bg-emerald-500/18 font-semibold ring-1 ring-emerald-300/18 shadow-[0_4px_10px_rgba(0,0,0,0.16)]",
    itemInactive: "text-emerald-100/86 hover:bg-emerald-500/10 hover:text-white",
    iconActive: "text-emerald-200",
    iconInactive: "text-emerald-200/64 group-hover:text-emerald-100",
    badge: "bg-emerald-200/14 text-emerald-100 ring-1 ring-emerald-200/18",
    sectionBorder: "border-transparent",
    sectionHover: "hover:bg-emerald-900/16",
    footer: "border-t border-emerald-900/60 bg-[#0b281d]",
    footerText: "text-emerald-200/80",
    collapseButton: "border-emerald-800/70 bg-emerald-950/30 text-emerald-200 hover:bg-emerald-900/55 hover:text-white",
    tooltip: "border-emerald-800/60 bg-emerald-950 text-emerald-50 shadow-xl",
    tooltipSubtitle: "text-emerald-200/80",
    divider: "bg-emerald-500/26",
    accent: "bg-emerald-500",
  },
  compassion: {
    aside: "bg-white border-r border-slate-200",
    navSurface: "",
    heading: "text-blue-400",
    headingMuted: "hover:text-blue-600",
    itemActive: "text-slate-900 bg-blue-50 font-semibold",
    itemInactive: "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    iconActive: "text-blue-600",
    iconInactive: "text-slate-400 group-hover:text-slate-600",
    badge: "bg-slate-100 text-slate-600",
    sectionBorder: "border-transparent",
    sectionHover: "",
    footer: "border-t border-slate-200 bg-white",
    footerText: "text-blue-500",
    collapseButton: "border-blue-200 bg-white text-blue-600 hover:text-blue-800 hover:bg-blue-50",
    tooltip: "border-blue-200 bg-white text-blue-900 shadow-xl",
    tooltipSubtitle: "text-blue-600",
    divider: "bg-blue-200",
    accent: "bg-blue-600",
  },
  events: {
    aside: "bg-white border-r border-gray-200",
    navSurface: "",
    heading: "text-violet-500",
    headingMuted: "hover:text-violet-700",
    itemActive: "text-slate-900 bg-violet-50 font-semibold",
    itemInactive: "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    iconActive: "text-violet-600",
    iconInactive: "text-slate-400 group-hover:text-slate-600",
    badge: "bg-slate-100 text-slate-600",
    sectionBorder: "border-transparent",
    sectionHover: "",
    footer: "border-t border-gray-100 bg-white",
    footerText: "text-gray-400",
    collapseButton: "border-violet-200 bg-white text-violet-700 hover:text-violet-900 hover:bg-violet-50",
    tooltip: "border-violet-200 bg-white text-violet-900 shadow-xl",
    tooltipSubtitle: "text-violet-700",
    divider: "bg-violet-200",
    accent: "bg-violet-500",
  },
  hrm: {
    aside: "bg-white border-r border-teal-100",
    navSurface: "",
    heading: "text-teal-500",
    headingMuted: "hover:text-teal-700",
    itemActive: "text-slate-900 bg-teal-50 font-semibold",
    itemInactive: "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    iconActive: "text-teal-600",
    iconInactive: "text-slate-400 group-hover:text-slate-600",
    badge: "bg-slate-100 text-slate-600",
    sectionBorder: "border-transparent",
    sectionHover: "",
    footer: "border-t border-teal-100 bg-white",
    footerText: "text-gray-500",
    collapseButton: "border-teal-200 bg-white text-teal-700 hover:text-teal-900 hover:bg-teal-50",
    tooltip: "border-teal-200 bg-white text-teal-900 shadow-xl",
    tooltipSubtitle: "text-teal-700",
    divider: "bg-teal-200",
    accent: "bg-teal-600",
  },
  watchdog: {
    aside: "bg-white border-r border-slate-200",
    navSurface: "",
    heading: "text-slate-500",
    headingMuted: "hover:text-slate-700",
    itemActive: "text-slate-900 bg-slate-100 font-semibold",
    itemInactive: "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
    iconActive: "text-slate-700",
    iconInactive: "text-slate-400 group-hover:text-slate-600",
    badge: "bg-slate-200 text-slate-700",
    sectionBorder: "border-transparent",
    sectionHover: "",
    footer: "border-t border-slate-200 bg-white",
    footerText: "text-slate-500",
    collapseButton: "border-slate-300 bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50",
    tooltip: "border-slate-300 bg-white text-slate-900 shadow-xl",
    tooltipSubtitle: "text-slate-600",
    divider: "bg-slate-300",
    accent: "bg-slate-600",
  },
};

const SIDEBAR_SCROLLBAR_CLASS = "[scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden";

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
  donorAccentTone = "green",
  donorChromeTint,
  footerAction,
  brandHeader,
  brandHeaderCollapsed,
}: CrmSidebarProps) {
  const pathname = usePathname();
  const donorAccent = DONOR_ACCENT_OVERRIDES[donorAccentTone];
  const styles = variant === "donor"
    ? {
      ...VARIANT_STYLES.donor,
      iconActive: donorAccent.iconActive,
      accent: donorAccent.accent,
    }
    : VARIANT_STYLES[variant];
  const isDonorChrome = variant === "donor";
  const donorTintStyle = isDonorChrome && donorChromeTint
    ? {
      borderColor: donorChromeTint.border,
    }
    : undefined;
  const focusRingClass = variant === "donor" ? donorAccent.focusRing : "focus-visible:ring-green-500";
  const [hash, setHash] = useState("");
  const [collapsed, setCollapsed] = useState(false);
  const [compactDesktop, setCompactDesktop] = useState(false);
  const [compactExpanded, setCompactExpanded] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const [groupOpenState, setGroupOpenState] = useState<Record<string, boolean>>(() => getInitialGroupOpenState(groups));
  const groupStorageKey = `${storageKey}.groups`;

  useEffect(() => {
    if (typeof window === "undefined") return;

    const stored = window.localStorage.getItem(storageKey);
    if (stored === "1" || stored === "true") {
      setCollapsed(true);
    }
    const storedGroups = window.localStorage.getItem(groupStorageKey);
    if (storedGroups) {
      try {
        const parsed = JSON.parse(storedGroups) as unknown;
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          setGroupOpenState((current) => ({
            ...current,
            ...(parsed as Record<string, boolean>),
          }));
        }
      } catch {
        window.localStorage.removeItem(groupStorageKey);
      }
    }

    setIsHydrated(true);
  }, [groupStorageKey, storageKey]);

  useEffect(() => {
    if (!isHydrated || forceExpanded || typeof window === "undefined") return;

    window.localStorage.setItem(storageKey, collapsed ? "true" : "false");
  }, [collapsed, forceExpanded, isHydrated, storageKey]);

  useEffect(() => {
    if (!isHydrated || typeof window === "undefined") return;

    window.localStorage.setItem(groupStorageKey, JSON.stringify(groupOpenState));
  }, [groupOpenState, groupStorageKey, isHydrated]);

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
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(min-width: 1024px) and (max-width: 1439px)");
    const updateCompactDesktop = () => {
      setCompactDesktop(mediaQuery.matches);
      if (!mediaQuery.matches) {
        setCompactExpanded(false);
      }
    };

    updateCompactDesktop();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", updateCompactDesktop);
      return () => mediaQuery.removeEventListener("change", updateCompactDesktop);
    }

    mediaQuery.addListener(updateCompactDesktop);
    return () => mediaQuery.removeListener(updateCompactDesktop);
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

  const isCollapsed = forceExpanded ? false : compactDesktop ? !compactExpanded : collapsed;
  const hasBrandHeader = Boolean(brandHeader || brandHeaderCollapsed);
  const donorCompact = variant === "donor";

  const toggleSidebar = () => {
    if (compactDesktop) {
      setCompactExpanded((current) => !current);
      return;
    }

    setCollapsed((current) => !current);
  };

  const visibleGroups = useMemo(() => {
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => isSidebarItemVisible(item, userRole)),
      }))
      .filter((group) => group.items.length > 0);
  }, [groups, userRole]);

  const activeGroupIds = useMemo(() => {
    return visibleGroups
      .filter((group) => group.items.some((item) => isSidebarItemActive(item, pathname, hash)))
      .map((group) => group.id);
  }, [hash, pathname, visibleGroups]);

  useEffect(() => {
    if (activeGroupIds.length === 0) return;

    setGroupOpenState((current) => {
      let changed = false;
      const nextState = { ...current };

      activeGroupIds.forEach((groupId) => {
        if (nextState[groupId] === false) {
          nextState[groupId] = true;
          changed = true;
        }
      });

      return changed ? nextState : current;
    });
  }, [activeGroupIds]);

  return (
    <aside
      className={`${styles.aside} group/sidebar relative ${isCollapsed ? collapsedWidthClass : expandedWidthClass} shrink-0 flex flex-col h-full select-none transition-[width] duration-200 ease-out`}
      data-sidebar-collapsed={isCollapsed ? "true" : "false"}
      style={donorTintStyle}
    >
      {hasBrandHeader ? (
        <div className={`shrink-0 border-b ${variant === "donor" ? "border-emerald-900/65 bg-[#0b281d]" : "border-slate-200 bg-white"} ${donorCompact ? "px-2.5 py-2" : "px-3 py-3"}`}>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              {isCollapsed ? brandHeaderCollapsed : brandHeader}
            </div>
            {!forceExpanded ? (
              <button
                type="button"
                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                aria-expanded={!isCollapsed}
                onClick={toggleSidebar}
                className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border shadow-sm transition-all hover:-translate-y-px ${styles.collapseButton}`}
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
            ) : null}
          </div>
        </div>
      ) : null}
      <div className={`flex-1 overflow-y-auto ${donorCompact ? "px-2 py-2" : "px-3 py-6"} ${SIDEBAR_SCROLLBAR_CLASS} ${styles.navSurface}`}>
        {!forceExpanded && !hasBrandHeader ? (
          <div className={`mb-2 flex ${donorCompact ? "h-8" : "h-9"} items-center ${isCollapsed ? "justify-center" : "justify-end"}`}>
            <button
              type="button"
              aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isCollapsed}
              onClick={toggleSidebar}
              className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border shadow-sm transition-all hover:-translate-y-px ${styles.collapseButton}`}
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
          const groupIsOpen = isCollapsed ? true : group.collapsible ? (groupOpenState[group.id] ?? true) : true;
          const groupActive = activeGroupIds.includes(group.id);

          return (
            <div
              key={group.id}
              className={`mb-1.5 rounded-xl ${isDonorChrome ? "px-0 py-0" : "border px-0.5 py-0.5"} transition-colors ${isDonorChrome ? "bg-transparent" : "bg-white/75"} ${groupActive && !isCollapsed ? (isDonorChrome ? "" : "border-emerald-200") : `${styles.sectionBorder} ${styles.sectionHover}`}`}
            >
              {isCollapsed ? (
                <div className="group/section relative px-2 py-1.5" aria-hidden="true">
                  <div className={`mx-auto h-px w-7 ${styles.divider}`} />
                  <span className={`pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden -translate-y-1/2 whitespace-nowrap rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] shadow-lg group-hover/section:block ${styles.tooltip}`}>
                    {group.label}
                  </span>
                </div>
              ) : (
                  <div className="px-1.5 py-0.5">
                  {group.collapsible ? (
                    <button
                      type="button"
                      onClick={() => {
                        setGroupOpenState((current) => ({
                          ...current,
                          [group.id]: !(current[group.id] ?? true),
                        }));
                      }}
                      className={`w-full flex items-center justify-between px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors ${groupActive ? (isDonorChrome ? "text-emerald-100" : "text-slate-600") : styles.heading} ${styles.headingMuted}`}
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
                    <p className={`px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${styles.heading}`}>
                      {group.label}
                    </p>
                  )}
                </div>
              )}

              {groupIsOpen && (
                <nav className="space-y-0 pb-0.5" aria-label={group.label}>
                  {group.items.map((item) => {
                    const active = isSidebarItemActive(item, pathname, hash);

                    return (
                      <Link
                        key={item.id}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        aria-label={isCollapsed ? item.label : undefined}
                        className={`group relative mx-0.5 flex items-center ${isCollapsed ? "min-h-8 justify-center rounded-xl px-1.5 py-1" : donorCompact ? "min-h-7 justify-start rounded-lg px-2 py-1" : "min-h-9 justify-start rounded-lg px-2.5 py-2"} gap-2 text-[12px] font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${focusRingClass} ${active ? styles.itemActive : styles.itemInactive} ${isCollapsed ? "hover:shadow-sm" : ""}`}
                        title={isCollapsed ? item.label : undefined}
                      >
                        <span
                          className={`shrink-0 rounded-lg p-1 transition-colors ${active ? styles.iconActive : styles.iconInactive} ${isCollapsed && active ? (isDonorChrome ? "bg-emerald-500/22" : "bg-white/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]") : ""}`}
                          aria-hidden="true"
                        >
                          {item.icon}
                        </span>
                        {isCollapsed && item.badge ? (
                          <span className={`absolute right-2 top-2 h-1.5 w-1.5 rounded-full ${styles.accent}`} aria-hidden="true" />
                        ) : null}

                        {!isCollapsed ? (
                          <>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate">{item.label}</span>
                              {item.secondaryLabel ? (
                                <span className="block truncate text-[10px] font-medium text-slate-500">
                                  {item.secondaryLabel}
                                </span>
                              ) : null}
                            </span>
                            {item.badge ? (
                              <span className={`ml-auto rounded-md px-1.5 py-0.5 text-[9px] font-semibold ${styles.badge}`}>
                                {item.badge}
                              </span>
                            ) : null}
                          </>
                        ) : null}

                        {isCollapsed ? (
                          <span
                            role="tooltip"
                            className={`pointer-events-none absolute left-full top-1/2 z-50 ml-2 hidden min-w-[220px] -translate-y-1/2 rounded-xl border px-3 py-2 text-left shadow-2xl group-hover:block group-focus-visible:block ${styles.tooltip}`}
                          >
                            <span className="flex items-center gap-2 text-xs font-semibold">
                              <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg ${active ? styles.itemActive : "bg-slate-50"}`}>{item.icon}</span>
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

      <div className={`${donorCompact ? "px-3 py-2.5" : "px-4 py-3"} ${styles.footer}`}>
        {footerAction ? (
          <button
            type="button"
            onClick={footerAction.onClick}
            aria-label={footerAction.ariaLabel ?? footerAction.label}
            className={`mb-2.5 flex w-full items-center justify-center rounded-lg border px-2.5 py-2 text-xs font-semibold transition-colors ${variant === "donor" ? donorAccent.buttonTone : "border-slate-300 bg-slate-100 text-slate-700 hover:bg-slate-200"}`}
          >
            {!isCollapsed ? footerAction.label : (
              <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        ) : null}
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
