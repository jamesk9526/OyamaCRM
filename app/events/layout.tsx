// Events CRM nested layout — provides the amber-themed Events shell for all /events/* routes.
"use client";

import { Suspense, useEffect, useState } from "react";
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
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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

  // Close mobile drawer when route context changes.
  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

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
      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        <div className="hidden lg:block">
          <EventsSidebar />
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Close Events navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute inset-0 bg-black/35"
            />
            <div className="absolute inset-y-0 left-0 w-64 max-w-[86vw] shadow-2xl">
              <EventsSidebar forceExpanded />
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-amber-50/30 p-3 sm:p-4 lg:p-4 min-[1440px]:p-5 2xl:p-6">
          <div className="mb-3 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-amber-700 shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Menu
            </button>
          </div>
          <ErrorBoundary>
            <div className="min-w-0 max-w-full">{redirectTarget ? (
              <section className="rounded-xl border border-amber-300 bg-amber-100 px-4 py-3 text-sm text-amber-900">
                Redirecting to event-first workspace flow...
              </section>
            ) : (
              children
            )}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
