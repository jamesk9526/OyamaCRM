// Compassion CRM nested layout — provides the blue-themed CompassionShell for all /compassion/* routes.
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import CompassionSidebar from "@/app/components/layout/CompassionSidebar";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { apiFetch } from "@/app/lib/auth-client";
import { fetchWorkspaceSettings } from "@/app/lib/workspace-settings";

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
  const [accessState, setAccessState] = useState<"checking" | "allowed" | "denied">("checking");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (isPublicWidgetRoute || loading) return;
    if (!user) {
      setAccessState("checking");
      return;
    }

    let active = true;
    setAccessState("checking");

    async function loadWorkspaceAccess() {
      const settings = await fetchWorkspaceSettings();
      if (!active) return;

      if (!settings.compassionEnabled) {
        setAccessState("denied");
        router.replace("/");
        return;
      }

      try {
        await apiFetch<{ allowed: boolean }>("/api/compassion/access");
        if (!active) return;
        setAccessState("allowed");
      } catch {
        if (!active) return;
        setAccessState("denied");
        router.replace("/");
      }
    }

    void loadWorkspaceAccess();
    return () => {
      active = false;
    };
  }, [isPublicWidgetRoute, loading, user, router]);

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (isPublicWidgetRoute) return;
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [isPublicWidgetRoute, loading, user, router]);

  // Close mobile drawer when users navigate between Compassion routes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  if (isPublicWidgetRoute) {
    return <>{children}</>;
  }

  // Loading state — prevent flash of unauthenticated or unauthorized content.
  if (loading || !user || accessState === "checking") {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (accessState === "denied") {
    return (
      <div className="min-h-screen bg-blue-50 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-xl border border-blue-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-blue-900">Compassion Access Required</h1>
          <p className="mt-2 text-sm text-blue-800">
            This workspace is disabled or your account does not have permission to view client-care records.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* TopBar is module-aware and will render blue accents for /compassion paths */}
      <TopBar />
      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        <div className="hidden lg:block">
          <CompassionSidebar />
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
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
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-blue-50/30 p-3 sm:p-4 lg:p-4 min-[1440px]:p-5 2xl:p-6">
          <div className="mb-3 lg:hidden">
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
            <div className="min-w-0 max-w-full">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
