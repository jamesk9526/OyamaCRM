// Compassion CRM nested layout — provides the blue-themed CompassionShell for all /compassion/* routes.
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import CompassionSidebar from "@/app/components/layout/CompassionSidebar";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { DEFAULT_WORKSPACE_SETTINGS, fetchWorkspaceSettings, type WorkspaceSettings } from "@/app/lib/workspace-settings";

// TODO: enforce Compassion workspace permission — currently only checks authentication, not module access

/**
 * CompassionLayout: wraps all /compassion/* pages with the blue-themed shell.
 * This layout is rendered INSTEAD of AppShell (AppShell treats /compassion as a public path).
 * Structure: TopBar + CompassionSidebar + blue-tinted main content area.
 */
export default function CompassionLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicWidgetRoute = pathname.startsWith("/compassion/public");
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>(DEFAULT_WORKSPACE_SETTINGS);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (isPublicWidgetRoute || loading || !user) return;
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
  }, [isPublicWidgetRoute, loading, user]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (isPublicWidgetRoute) return;
    if (!loading && !user) {
      router.replace("/login");
    }
    if (!loading && user && !workspaceSettings.compassionEnabled) {
      router.replace("/");
    }
  }, [isPublicWidgetRoute, loading, user, router, workspaceSettings.compassionEnabled]);

  // Close mobile drawer when users navigate between Compassion routes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (isPublicWidgetRoute) {
    return <>{children}</>;
  }

  // Loading state — prevent flash of unauthenticated content
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* TopBar is module-aware and will render blue accents for /compassion paths */}
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative">
        <div className="hidden md:block">
          <CompassionSidebar />
        </div>

        {mobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <button
              aria-label="Close Compassion navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute inset-0 bg-black/35"
            />
            <div className="absolute inset-y-0 left-0 w-64 max-w-[86vw] shadow-2xl">
              <CompassionSidebar forceExpanded />
            </div>
          </div>
        )}

        {/* Blue-tinted content area distinguishes Compassion CRM visually */}
        <main className="flex-1 overflow-auto bg-blue-50/30 p-3 sm:p-4 md:p-6">
          <div className="md:hidden mb-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm font-medium text-blue-700 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Menu
            </button>
          </div>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
