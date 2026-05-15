// OyamaWatchdog layout provides a dedicated operations CRM shell.
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import WatchdogSidebar from "@/app/components/layout/WatchdogSidebar";
import ErrorBoundary from "@/app/components/ErrorBoundary";

/**
 * WatchdogLayout wraps all /watchdog routes in an operations shell.
 * This module is restricted to admin users only.
 */
export default function WatchdogLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  // Open mobile navigation from the TopBar hamburger button.
  useEffect(() => {
    function handleOpenNav() { setMobileNavOpen(true); }
    window.addEventListener("crm:open-mobile-nav", handleOpenNav);
    return () => window.removeEventListener("crm:open-mobile-nav", handleOpenNav);
  }, []);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-slate-700 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex flex-col h-screen bg-slate-100">
        <TopBar />
        <main className="flex-1 flex items-center justify-center bg-slate-50 p-6">
          <section className="w-full max-w-xl rounded-xl border border-rose-200 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-slate-900">OyamaWatchdog Access Restricted</h1>
            <p className="mt-2 text-sm text-slate-700">
              OyamaWatchdog is limited to admin users. Your account can view DonorCRM but cannot open security command tools.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
            >
              Back To Dashboard
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-100">
      <TopBar />
      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        <div className="hidden lg:block">
          <WatchdogSidebar />
        </div>

        {mobileNavOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              aria-label="Close Watchdog navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute inset-0 bg-black/45"
            />
            <div className="absolute inset-y-0 left-0 w-64 max-w-[86vw] shadow-2xl">
              <WatchdogSidebar forceExpanded />
            </div>
          </div>
        )}

        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-slate-50 p-3 text-slate-900 sm:p-4 lg:p-4 min-[1440px]:p-5 2xl:p-6">
          <ErrorBoundary>
            <div className="min-w-0 max-w-full">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
