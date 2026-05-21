"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import DonorMegaMenu from "./DonorMegaMenu";
import MobileSidebarDrawer from "./MobileSidebarDrawer";
import { useAuth } from "@/app/components/auth/AuthProvider";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import {
  DEFAULT_WORKSPACE_SETTINGS,
  patchWorkspaceSettings,
  fetchWorkspaceSettings,
  type WorkspaceSettings,
  type DonorNavigationLayout,
} from "@/app/lib/workspace-settings";

// Module routes render their own shells — bypass AppShell wrapper.
// /steward-ai-workspace uses its own standalone PWA layout.
const PUBLIC_PATHS = ["/login", "/email-builder", "/setup", "/unsubscribe", "/preferences", "/compassion", "/watchdog", "/webmaster", "/hrm", "/apps", "/steward-ai-workspace", "/tablelink"];
const SHELL_BYPASS_PATHS = ["/events"];
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
  "donations",
  "email-builder",
  "events",
  "features",
  "grants",
  "help",
  "help-content",
  "hrm",
  "icons",
  "letters-printables",
  "livecom",
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
  const isOShareview = pathname.startsWith("/reports") && !pathname.startsWith("/reports/donor-crm");
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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dockInsetPx, setDockInsetPx] = useState(0);

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

    // ShareviewUsers should open OShareview dashboards and avoid full CRM surfaces by default.
    if (user?.role === "shareview_user" && !isOShareview && !isPublic) {
      router.replace("/reports");
      return;
    }

    // Prevent non-report_viewer users from accidentally landing on the board route
    if (user && user.role !== "report_viewer" && isBoard) {
      router.replace("/");
      return;
    }

    // Redirect away from donor routes if DonorCRM is disabled at workspace settings level.
    if (user && !isPublic && !isBoard && !isOShareview && !workspaceSettings.donorEnabled && workspaceSettings.compassionEnabled) {
      router.replace("/compassion/dashboard");
    }
  }, [loading, user, isPublic, isBoard, isOShareview, router, workspaceSettings]);

  // Close mobile navigation drawer whenever route changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Open mobile navigation from the TopBar hamburger button.
  useEffect(() => {
    function handleOpenNav() { setMobileNavOpen(true); }
    window.addEventListener("crm:open-mobile-nav", handleOpenNav);
    return () => window.removeEventListener("crm:open-mobile-nav", handleOpenNav);
  }, []);

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

  // Public pages — no shell
  if (isPublic) return <>{children}</>;

  // Loading splash — prevent flash of unauthenticated content
  if (loading || !user) {
    return (
      <div className="min-h-[100dvh] crm-page-surface flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Module routes that render their own shell (Events CRM, etc.)
  if (isShellBypass) return <>{children}</>;

  const donorShellVisible = !isOShareview && !isBoard;
  const donorMegaMenuEnabled = donorShellVisible && workspaceSettings.donorNavigationLayout === "mega";
  const donorSidebarDesktopEnabled = donorShellVisible && workspaceSettings.donorNavigationLayout === "sidebar";
  const contentTopPaddingClass = donorMegaMenuEnabled ? "pt-[6.5rem]" : "pt-14";

  return (
    <div
      className="flex h-[100dvh] min-h-[100svh] flex-col crm-page-surface transition-[padding] duration-300"
      style={dockInsetPx > 0 ? { paddingRight: `${dockInsetPx}px` } : undefined}
    >
      <TopBar />
      {donorMegaMenuEnabled ? <DonorMegaMenu donorAccentTone={workspaceSettings.donorAccentTone} /> : null}
      <div className={`relative flex min-w-0 flex-1 overflow-hidden ${contentTopPaddingClass}`}>
        {donorSidebarDesktopEnabled ? (
          <div className="hidden md:flex h-full">
            <Sidebar
              donorAccentTone={workspaceSettings.donorAccentTone}
              onSwitchToMegaMenu={() => void updateDonorLayout("mega")}
            />
          </div>
        ) : null}
        {/* Mobile sidebar drawer kept for small-screen access */}
        {!isOShareview ? (
          <MobileSidebarDrawer
            open={mobileNavOpen}
            title="DonorCRM navigation"
            onClose={() => setMobileNavOpen(false)}
          >
            <Sidebar forceExpanded donorAccentTone={workspaceSettings.donorAccentTone} />
          </MobileSidebarDrawer>
        ) : null}

        {/* ErrorBoundary catches page-level render errors without crashing the whole shell */}
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto crm-page-surface p-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] sm:p-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-4 lg:pb-4 min-[1440px]:p-5 2xl:p-6">

          <ErrorBoundary>
            <div className="min-w-0 max-w-full">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
