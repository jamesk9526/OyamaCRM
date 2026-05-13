// OyamaWatchdog layout provides a dedicated dark security CRM shell.
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import WatchdogSidebar from "@/app/components/layout/WatchdogSidebar";
import ErrorBoundary from "@/app/components/ErrorBoundary";

/**
 * WatchdogLayout wraps all /watchdog routes in a dark shell.
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

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#05080f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role !== "admin") {
    return (
      <div className="flex flex-col h-screen bg-[#05080f]">
        <TopBar />
        <main className="flex-1 flex items-center justify-center bg-[#0b1220] p-6">
          <section className="w-full max-w-xl rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
            <h1 className="text-lg font-semibold text-red-100">OyamaWatchdog Access Restricted</h1>
            <p className="mt-2 text-sm text-red-200/90">
              OyamaWatchdog is limited to admin users. Your account can view DonorCRM but cannot open security command tools.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700"
            >
              Back To Dashboard
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#05080f]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden relative">
        <div className="hidden md:block">
          <WatchdogSidebar />
        </div>

        {mobileNavOpen && (
          <div className="md:hidden fixed inset-0 z-40">
            <button
              aria-label="Close Watchdog navigation"
              onClick={() => setMobileNavOpen(false)}
              className="absolute inset-0 bg-black/45"
            />
            <div className="absolute inset-y-0 left-0 w-64 max-w-[86vw] shadow-2xl">
              <WatchdogSidebar />
            </div>
          </div>
        )}

        <main className="flex-1 overflow-auto bg-[#0b1220] text-gray-100 p-3 sm:p-4 md:p-6">
          <div className="md:hidden mb-3">
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-red-400/30 bg-[#111827] px-3 py-2 text-sm font-medium text-red-200 shadow-sm"
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
