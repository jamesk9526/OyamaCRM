// OyamaWatchdog layout provides a dedicated operations CRM shell.
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import WatchdogSidebar from "@/app/components/layout/WatchdogSidebar";
import MobileSidebarDrawer from "@/app/components/layout/MobileSidebarDrawer";
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
  const [shellScrolled, setShellScrolled] = useState(false);
  const scrollFrameRef = useRef<number | null>(null);

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

  useEffect(() => {
    let latestScrollTop = 0;

    function handleScroll(event: Event) {
      const target = event.target as Element | null;
      if (!(target instanceof HTMLElement) || !target.closest('[data-crm-scroll-root="true"]')) return;
      if (typeof target.scrollTop === "number") {
        latestScrollTop = target.scrollTop;
        if (scrollFrameRef.current !== null) return;
        scrollFrameRef.current = window.requestAnimationFrame(() => {
          scrollFrameRef.current = null;
          setShellScrolled((current) => (current ? latestScrollTop > 8 : latestScrollTop > 42));
        });
      }
    }

    document.addEventListener("scroll", handleScroll, true);
    return () => {
      document.removeEventListener("scroll", handleScroll, true);
      if (scrollFrameRef.current !== null) {
        window.cancelAnimationFrame(scrollFrameRef.current);
        scrollFrameRef.current = null;
      }
    };
  }, []);

  const contentTopPaddingClass = shellScrolled ? "pt-16 xl:pt-20" : "pt-16 xl:pt-28";

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
        <TopBar scrolled={shellScrolled} />
        <main data-crm-scroll-root="true" className={`flex-1 flex items-center justify-center bg-slate-50 p-6 ${contentTopPaddingClass}`}>
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
      <TopBar scrolled={shellScrolled} />
      <div className={`relative flex min-w-0 flex-1 overflow-hidden transition-[padding] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${contentTopPaddingClass}`}>
        <div className="hidden lg:block">
          <WatchdogSidebar />
        </div>

        <MobileSidebarDrawer
          open={mobileNavOpen}
          title="OyamaWatchdog navigation"
          onClose={() => setMobileNavOpen(false)}
        >
          <WatchdogSidebar forceExpanded />
        </MobileSidebarDrawer>

        <main data-crm-scroll-root="true" className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-slate-50 p-3 text-slate-900 sm:p-4 lg:p-4 min-[1440px]:p-5 2xl:p-6">
          <ErrorBoundary>
            <div className="min-w-0 max-w-full">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
