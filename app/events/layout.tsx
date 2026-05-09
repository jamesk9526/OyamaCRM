// Events CRM nested layout — provides the amber-themed Events shell for all /events/* routes.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import EventsSidebar from "@/app/components/layout/EventsSidebar";
import ErrorBoundary from "@/app/components/ErrorBoundary";

// TODO: enforce Events workspace permission — currently only checks authentication, not module access

/**
 * EventsLayout wraps all /events/* pages with the amber-themed Events CRM shell.
 * This layout is rendered instead of AppShell because AppShell bypasses /events paths.
 */
export default function EventsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-amber-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <EventsSidebar />
        <main className="flex-1 overflow-auto bg-amber-50/30 p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
