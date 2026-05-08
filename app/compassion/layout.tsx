// Compassion CRM nested layout — provides the blue-themed CompassionShell for all /compassion/* routes.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import CompassionSidebar from "@/app/components/layout/CompassionSidebar";
import ErrorBoundary from "@/app/components/ErrorBoundary";

// TODO: enforce Compassion workspace permission — currently only checks authentication, not module access

/**
 * CompassionLayout: wraps all /compassion/* pages with the blue-themed shell.
 * This layout is rendered INSTEAD of AppShell (AppShell treats /compassion as a public path).
 * Structure: TopBar + CompassionSidebar + blue-tinted main content area.
 */
export default function CompassionLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  // Redirect unauthenticated users to login
  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

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
      <div className="flex flex-1 overflow-hidden">
        <CompassionSidebar />
        {/* Blue-tinted content area distinguishes Compassion CRM visually */}
        <main className="flex-1 overflow-auto bg-blue-50/30 p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
