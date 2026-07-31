"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import TopBar from "./TopBar";
import DonorMegaMenu from "./DonorMegaMenu";
import { useAuth } from "@/app/components/auth/AuthProvider";
import { apiFetch } from "@/app/lib/auth-client";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  patchWorkspaceSettings,
  fetchWorkspaceSettings,
  type WorkspaceSettings,
  type DonorNavigationLayout,
} from "@/app/lib/workspace-settings";
import type { CSSProperties } from "react";

type DonorAppearanceTheme = "light-green" | "blue" | "violet" | "slate";
type DonorAppearanceDensity = "comfortable" | "compact";

interface DonorAppearanceSettings {
  theme: DonorAppearanceTheme;
  density: DonorAppearanceDensity;
}

const DEFAULT_DONOR_APPEARANCE: DonorAppearanceSettings = {
  theme: "light-green",
  density: "comfortable",
};

// Each theme keeps the same enterprise command-bar layout. Only the colors
// change, so a personal preference never makes navigation unfamiliar.
const DONOR_APPEARANCE_CHROME: Record<DonorAppearanceTheme, {
  dark: string;
  mid: string;
  base: string;
  border: string;
  shadowRgb: string;
  light: string;
  soft: string;
}> = {
  "light-green": { dark: "#0b1b27", mid: "#102b35", base: "#176b57", light: "#9be1b7", soft: "#eaf7ee", border: "rgba(111, 215, 169, 0.28)", shadowRgb: "7, 37, 45" },
  blue: { dark: "#0b1b31", mid: "#123d64", base: "#0f6cbd", light: "#9ccdf5", soft: "#eaf4fd", border: "rgba(119, 191, 255, 0.30)", shadowRgb: "7, 29, 58" },
  violet: { dark: "#17112e", mid: "#342163", base: "#6f42c1", light: "#c7a9fb", soft: "#f1ebff", border: "rgba(195, 161, 255, 0.30)", shadowRgb: "26, 16, 54" },
  slate: { dark: "#111827", mid: "#263447", base: "#475569", light: "#cbd5e1", soft: "#edf2f7", border: "rgba(203, 213, 225, 0.28)", shadowRgb: "15, 23, 42" },
};

// Module routes render their own shells — bypass AppShell wrapper.
// /steward-ai-workspace uses its own standalone PWA layout.
const PUBLIC_PATHS = ["/login", "/email-builder", "/setup", "/unsubscribe", "/preferences", "/compassion", "/watchdog", "/webmaster", "/apps", "/trivia", "/steward-ai-workspace", "/tablelink"];
const SHELL_BYPASS_PATHS = ["/events", "/oyama-letters", "/oyama-email", "/steward-paths"];
const RESERVED_ROOT_PUBLIC_EVENT_SEGMENTS = new Set([
  "api",
  "apps",
  "automations",
  "board",
  "campaigns",
  "communications",
  "compassion",
  "constituents",
  "contacts-manager",
  "custom-fields",
  "data-tools",
  "designations",
  "donations",
  "email-builder",
  "events",
  "features",
  "grants",
  "help",
  "help-content",
  "icons",
  "letters-printables",
  "letters",
  "livecom",
  "oyama-letters",
  "oyama-email",
  "login",
  "meetings",
  "modules",
  "offline",
  "ogentic",
  "password",
  "payments",
  "preferences",
  "quickbooks-sync",
  "reports",
  "settings",
  "setup",
  "steward-ai-workspace",
  "steward-paths",
  "steward-signals",
  "tasks",
  "unsubscribe",
  "volunteers",
  "watchdog",
  "webmaster",
  "workspace",
  "page-builder",
  "templates",
  "tickets",
  "guests",
  "tables",
  "hosts",
  "sponsors",
  "orders",
  "emails",
  "follow-up",
  "fundraising",
  "files",
  "check-in",
]);

function isRootPublicEventSlugPath(pathname: string): boolean {
  const segments = pathname.split("/").filter(Boolean);
  if (segments.length !== 1) return false;
  return !RESERVED_ROOT_PUBLIC_EVENT_SEGMENTS.has(segments[0].toLowerCase());
}

// Routes that board-report roles may access (board dashboard + its own sub-routes)
const BOARD_PATHS = ["/board"];
const DONOR_LAYOUT_STORAGE_KEY = "oyamacrm.shell.donor.layout";
const useBrowserLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function readStoredDonorLayout(): DonorNavigationLayout | null {
  if (typeof window === "undefined") return null;
  const stored = window.localStorage.getItem(DONOR_LAYOUT_STORAGE_KEY);
  if (stored === "mega" || stored === "sidebar") {
    return stored;
  }
  return null;
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p)) || isRootPublicEventSlugPath(pathname);
  const isShellBypass = SHELL_BYPASS_PATHS.some((p) => pathname.startsWith(p));
  const isBoard = BOARD_PATHS.some((p) => pathname.startsWith(p));
  // Reports now live inside the normal Donor CRM workspace. The limited
  // shareview role still lands on Reports, but does not receive the full donor
  // navigation rail.
  const isShareviewReports = user?.role === "shareview_user" && pathname.startsWith("/reports");
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const canPersistOrgShellSettings = user?.role === "admin" || user?.role === "super_admin";
  const updateDonorLayout = useCallback(async (layout: DonorNavigationLayout) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(DONOR_LAYOUT_STORAGE_KEY, layout);
    }

    setWorkspaceSettings((current) => ({ ...current, donorNavigationLayout: layout }));

    if (!canPersistOrgShellSettings) {
      return;
    }

    try {
      const saved = await patchWorkspaceSettings({ donorNavigationLayout: layout });
      setWorkspaceSettings((current) => ({ ...saved, donorNavigationLayout: layout, donorAccentTone: current.donorAccentTone || saved.donorAccentTone }));
    } catch {
      // Keep local preference even when organization-level persistence fails.
    }
  }, [canPersistOrgShellSettings]);

  const [dockInsetPx, setDockInsetPx] = useState(0);
  const [shellScrolled, setShellScrolled] = useState(false);
  const [routeTransitioning, setRouteTransitioning] = useState(false);
  const [displayedRoutePath, setDisplayedRoutePath] = useState(pathname);
  const [displayedRouteContent, setDisplayedRouteContent] = useState<React.ReactNode>(children);
  const [incomingRouteContent, setIncomingRouteContent] = useState<React.ReactNode | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const routeTransitionTimeoutRef = useRef<number | null>(null);
  const [donorAppearance, setDonorAppearance] = useState<DonorAppearanceSettings>(DEFAULT_DONOR_APPEARANCE);
  const donorChromeTint = DONOR_APPEARANCE_CHROME[donorAppearance.theme];

  // Apply the user's persisted navigation preference before paint; organization settings
  // still load afterward and are only used when no local preference exists.
  useBrowserLayoutEffect(() => {
    const localLayout = readStoredDonorLayout();
    if (!localLayout) return;
    setWorkspaceSettings((current) => (
      current.donorNavigationLayout === localLayout
        ? current
        : { ...current, donorNavigationLayout: localLayout }
    ));
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;

    async function loadWorkspaceSettings() {
      const settings = await fetchWorkspaceSettings();
      if (!active) return;
      const localLayout = readStoredDonorLayout();
      setWorkspaceSettings(localLayout ? { ...settings, donorNavigationLayout: localLayout } : settings);
    }

    void loadWorkspaceSettings();
    return () => {
      active = false;
    };
  }, [loading, user]);

  useEffect(() => {
    if (loading) return;
    if (!user || isPublic || isShellBypass || isBoard) {
      delete document.documentElement.dataset.donorAppearance;
      delete document.documentElement.dataset.donorDensity;
      return;
    }
    let active = true;
    const applyAppearance = (settings: DonorAppearanceSettings) => {
      if (!active) return;
      setDonorAppearance(settings);
      document.documentElement.dataset.donorAppearance = settings.theme;
      document.documentElement.dataset.donorDensity = settings.density;
    };
    const normalizeAppearance = (value: Partial<DonorAppearanceSettings> | null | undefined): DonorAppearanceSettings => ({
      theme: value?.theme === "blue" || value?.theme === "violet" || value?.theme === "slate" || value?.theme === "light-green"
        ? value.theme
        : DEFAULT_DONOR_APPEARANCE.theme,
      density: value?.density === "compact" ? "compact" : "comfortable",
    });
    void apiFetch<Partial<DonorAppearanceSettings>>("/api/settings/donor-appearance")
      .then((settings) => applyAppearance(normalizeAppearance(settings)))
      .catch(() => applyAppearance(DEFAULT_DONOR_APPEARANCE));
    const handleAppearanceChange = (event: Event) => {
      const settings = (event as CustomEvent<Partial<DonorAppearanceSettings>>).detail;
      applyAppearance(normalizeAppearance(settings));
    };
    window.addEventListener("crm:donor-appearance", handleAppearanceChange);
    return () => {
      active = false;
      window.removeEventListener("crm:donor-appearance", handleAppearanceChange);
    };
  }, [loading, user, isPublic, isShellBypass, isBoard]);

  useEffect(() => {
    if (loading) return;

    // Redirect unauthenticated visitors to login
    if (!user && !isPublic) {
      router.replace("/login");
      return;
    }

    // Redirect legacy board-only users away from full CRM to board dashboard.
    if (user?.role === "report_viewer" && !isBoard && !isPublic) {
      router.replace("/board");
      return;
    }

    // Shareview users land directly in the reporting workbook.
    if (user?.role === "shareview_user" && !isShareviewReports && !isPublic) {
      router.replace("/reports");
      return;
    }

    // Prevent non-report_viewer users from accidentally landing on the board route
    if (user && user.role !== "report_viewer" && isBoard) {
      router.replace("/");
      return;
    }

    // Redirect away from donor routes if DonorCRM is disabled at workspace settings level.
    if (user && !isPublic && !isBoard && !isShareviewReports && !workspaceSettings.donorEnabled && workspaceSettings.compassionEnabled) {
      router.replace("/compassion/dashboard");
    }
  }, [loading, user, isPublic, isBoard, isShareviewReports, router, workspaceSettings]);

  useEffect(() => {
    function handleLayoutSwitch(event: Event) {
      const detail = (event as CustomEvent<{ layout?: DonorNavigationLayout }>).detail;
      if (!detail?.layout) return;
      void updateDonorLayout(detail.layout);
    }

    window.addEventListener("crm:set-donor-shell-layout", handleLayoutSwitch);
    return () => window.removeEventListener("crm:set-donor-shell-layout", handleLayoutSwitch);
  }, [updateDonorLayout]);

  useEffect(() => {
    function handleDockState(event: Event) {
      const detail = (event as CustomEvent<{ pushLayout?: boolean; panelWidth?: number }>).detail;
      if (!detail?.pushLayout) {
        setDockInsetPx((current) => (current === 0 ? current : 0));
        return;
      }
      const nextInset = typeof detail.panelWidth === "number" ? detail.panelWidth : 420;
      setDockInsetPx((current) => (current === nextInset ? current : nextInset));
    }

    window.addEventListener("steward-dock-state", handleDockState);
    return () => window.removeEventListener("steward-dock-state", handleDockState);
  }, []);

  useEffect(() => {
    let latestScrollTop = 0;

    function handleScroll(event: Event) {
      const target = event.target as Element | null;
      if (!(target instanceof HTMLElement) || !target.closest('[data-crm-scroll-root="true"]')) return;
      if (typeof target.scrollTop === "number") {
        latestScrollTop = target.scrollTop;
        if (scrollFrameRef.current !== null) return;
        scrollFrameRef.current = window.requestAnimationFrame(() => {
          scrollFrameRef.current = null;
          setShellScrolled((current) => (current ? latestScrollTop > 8 : latestScrollTop > 42));
        });
      }
    }

    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if (prefersReducedMotion) {
        setDisplayedRouteContent(children);
        setDisplayedRoutePath(pathname);
        setIncomingRouteContent(null);
        setRouteTransitioning(false);
        return;
      }
    }

    if (pathname !== displayedRoutePath) {
      if (routeTransitionTimeoutRef.current !== null) {
        window.clearTimeout(routeTransitionTimeoutRef.current);
        routeTransitionTimeoutRef.current = null;
      }

      setIncomingRouteContent(children);
      setRouteTransitioning(true);

      routeTransitionTimeoutRef.current = window.setTimeout(() => {
        setDisplayedRouteContent(children);
        setDisplayedRoutePath(pathname);
        setIncomingRouteContent(null);
        setRouteTransitioning(false);
        routeTransitionTimeoutRef.current = null;
      }, 240);
      return;
    }

    if (!routeTransitioning) {
      setDisplayedRouteContent(children);
    }
  }, [children, displayedRoutePath, pathname, routeTransitioning]);

  useEffect(() => {
    return () => {
      if (routeTransitionTimeoutRef.current !== null) {
        window.clearTimeout(routeTransitionTimeoutRef.current);
      }
    };
  }, []);

  // Public pages — no shell
  if (isPublic) return <>{children}</>;

  // Loading splash — prevent flash of unauthenticated content
  if (loading || !user) {
    return (
      <div className="min-h-[100dvh] crm-page-surface flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#0f6cbd] border-t-transparent" />
      </div>
    );
  }

  // Module routes that render their own shell (Events CRM, etc.)
  if (isShellBypass) return <>{children}</>;

  const donorShellVisible = !isShareviewReports && !isBoard;
  // DonorCRM uses a permanent desktop rail for faster movement between records,
  // outreach, and reporting. The same information architecture collapses into
  // the mobile menu so smaller screens keep their working area.
  const donorMegaMenuEnabled = donorShellVisible;
  const contentTopPaddingClass = "pt-14";

  const shellStyle: CSSProperties = {
    "--oyama-donor-chrome-start": donorChromeTint.dark,
    "--oyama-donor-chrome-mid": donorChromeTint.mid,
    "--oyama-donor-chrome-end": donorChromeTint.base,
    "--oyama-donor-chrome-border": donorChromeTint.border,
    "--oyama-donor-chrome-shadow-rgb": donorChromeTint.shadowRgb,
    ...(dockInsetPx > 0 ? { paddingRight: `${dockInsetPx}px` } : {}),
  } as CSSProperties;

  return (
    <div
      className="crm-fonts flex h-[100dvh] min-h-[100svh] flex-col crm-page-surface"
      style={shellStyle}
      data-donor-appearance={donorAppearance.theme}
      data-donor-density={donorAppearance.density}
    >
      <TopBar
        scrolled={shellScrolled}
        donorChromeTint={donorChromeTint}
        donorSidebarOffset={false}
        donorSidebarCollapsed={false}
      />
      {donorMegaMenuEnabled ? <DonorMegaMenu donorAccentTone={workspaceSettings.donorAccentTone} chromeTint={donorChromeTint} scrolled={shellScrolled} /> : null}
      <div className={`relative flex min-h-0 min-w-0 flex-1 overflow-hidden bg-white ${donorShellVisible ? "md:pl-64" : ""}`}>
        <div className={`min-h-0 min-w-0 flex-1 overflow-hidden ${contentTopPaddingClass}`}>
          {/* ErrorBoundary catches page-level render errors without crashing the whole shell */}
          <main data-crm-scroll-root="true" className="h-full min-w-0 overscroll-contain overflow-x-hidden overflow-y-auto crm-page-surface px-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] pt-0 sm:px-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] sm:pt-0 xl:px-7 xl:pb-7 xl:pt-0 min-[1440px]:px-8 min-[1440px]:pt-0 2xl:px-9 2xl:pt-0">

            <ErrorBoundary>
              <div className="min-w-0 max-w-full">
                {routeTransitioning && incomingRouteContent ? (
                  <div className="crm-route-transition-stack">
                    <div className="crm-route-transition-pane crm-route-transition-pane-out">
                      {displayedRouteContent}
                    </div>
                    <div className="crm-route-transition-pane crm-route-transition-pane-in">
                      {incomingRouteContent}
                    </div>
                  </div>
                ) : (
                  <div className="crm-route-transition-pane">
                    {displayedRouteContent}
                  </div>
                )}
              </div>
            </ErrorBoundary>
          </main>
        </div>
      </div>
    </div>
  );
}
