// Events CRM nested layout — provides the amber-themed Events shell for all /events/* routes.
"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import EventsSidebar from "@/app/components/layout/EventsSidebar";
import ErrorBoundary from "@/app/components/ErrorBoundary";
import { resolveLegacyGlobalEventsRedirect } from "@/app/lib/events-route-boundaries";

// TODO: enforce Events workspace permission — currently only checks authentication, not module access

/**
 * EventsLayout wraps all /events/* pages with the amber-themed Events CRM shell.
 * This layout is rendered instead of AppShell because AppShell bypasses /events paths.
 */
export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-amber-50 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <EventsLayoutContent>{children}</EventsLayoutContent>
    </Suspense>
  );
}

function EventsLayoutContent({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (loading || !user) return;

    const redirectTarget = resolveLegacyGlobalEventsRedirect(pathname, searchParams);
    if (redirectTarget) {
      router.replace(redirectTarget);
    }
  }, [loading, user, pathname, searchParams, router]);

  const redirectTarget = resolveLegacyGlobalEventsRedirect(pathname, searchParams);

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
            {redirectTarget ? (
              <section className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900">
                Redirecting to event-first workspace flow...
              </section>
            ) : (
              children
            )}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
