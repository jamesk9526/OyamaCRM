"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import MobileSidebarDrawer from "./MobileSidebarDrawer";
import { useAuth } from "@/app/components/auth/AuthProvider";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { DEFAULT_WORKSPACE_SETTINGS, fetchWorkspaceSettings, type WorkspaceSettings } from "@/app/lib/workspace-settings";

// Module routes render their own shells — bypass AppShell wrapper.
// /steward-ai-workspace uses its own standalone PWA layout.
const PUBLIC_PATHS = ["/login", "/email-builder", "/setup", "/unsubscribe", "/preferences", "/compassion", "/events", "/watchdog", "/webmaster", "/hrm", "/apps", "/steward-ai-workspace"];

// Routes that board-report roles may access (board dashboard + its own sub-routes)
const BOARD_PATHS = ["/board"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isBoard = BOARD_PATHS.some((p) => pathname.startsWith(p));
  const isOShareview = pathname.startsWith("/reports") && !pathname.startsWith("/reports/donor-crm");
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    let active = true;

    async function loadWorkspaceSettings() {
      const settings = await fetchWorkspaceSettings();
      if (!active) return;
      setWorkspaceSettings(settings);
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

  // Public pages — no shell
  if (isPublic) return <>{children}</>;

  // Loading splash — prevent flash of unauthenticated content
  if (loading || !user) {
    return (
      <div className="min-h-[100dvh] bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] min-h-[100svh] bg-white">
      <TopBar />
      <div className="relative flex min-w-0 flex-1 overflow-hidden pt-14">
        {!isOShareview && (
          <div className="hidden lg:block">
            <Sidebar />
          </div>
        )}

        {!isOShareview ? (
          <MobileSidebarDrawer
            open={mobileNavOpen}
            title="DonorCRM navigation"
            onClose={() => setMobileNavOpen(false)}
          >
            <Sidebar forceExpanded />
          </MobileSidebarDrawer>
        ) : null}

        {/* ErrorBoundary catches page-level render errors without crashing the whole shell */}
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-gray-50 p-3 pb-[max(0.9rem,env(safe-area-inset-bottom))] sm:p-4 sm:pb-[max(1rem,env(safe-area-inset-bottom))] lg:p-4 lg:pb-4 min-[1440px]:p-5 2xl:p-6">

          <ErrorBoundary>
            <div className="min-w-0 max-w-full">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
