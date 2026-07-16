// OyamaHRM layout provides the teal-themed shell for all /hrm routes.
"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import HrmSidebar from "@/app/components/layout/HrmSidebar";
import MobileSidebarDrawer from "@/app/components/layout/MobileSidebarDrawer";
import ErrorBoundary from "@/app/components/ErrorBoundary";

/**
 * HrmLayout wraps all /hrm routes in the module shell and applies baseline access rules.
 * TODO: enforce granular HRM workspace permissions when permission keys are finalized.
 */
export default function HrmLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [shellScrolled, setShellScrolled] = useState(false);
  const scrollFrameRef = useRef<number | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
      return;
    }

    // Placeholder permission gate: report viewers cannot open HRM workspace.
    if (!loading && user?.role === "report_viewer") {
      router.replace("/");
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

  const contentTopPaddingClass = "pt-14 xl:pt-20";

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-teal-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role === "report_viewer") {
    return (
      <div className="flex flex-col h-screen bg-white">
        <TopBar scrolled={shellScrolled} />
        <main data-crm-scroll-root="true" className={`flex-1 flex items-center justify-center bg-teal-50/40 p-6 ${contentTopPaddingClass}`}>
          <section className="w-full max-w-xl rounded-xl border border-teal-300 bg-white p-6 text-center shadow-sm">
            <h1 className="text-lg font-semibold text-teal-900">OyamaHRM Access Restricted</h1>
            <p className="mt-2 text-sm text-teal-800">
              Your current role does not include HRM workspace access. Contact an administrator for HRM permission assignment.
            </p>
            <button
              type="button"
              onClick={() => router.push("/")}
              className="mt-4 inline-flex items-center px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700"
            >
              Back To Dashboard
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-[100dvh] min-h-[100svh] flex-col bg-white">
      <TopBar scrolled={shellScrolled} />
      <div className={`relative flex min-h-0 min-w-0 flex-1 overflow-hidden ${contentTopPaddingClass}`}>
        <div className="hidden h-full lg:block">
          <HrmSidebar />
        </div>

        <MobileSidebarDrawer
          open={mobileNavOpen}
          title="OyamaHRM navigation"
          onClose={() => setMobileNavOpen(false)}
          widthClassName="w-[min(19rem,92vw)]"
        >
          <HrmSidebar forceExpanded />
        </MobileSidebarDrawer>

        <main data-crm-scroll-root="true" className="min-h-0 min-w-0 flex-1 overscroll-contain overflow-x-hidden overflow-y-auto bg-teal-50/30 p-3 sm:p-4 lg:p-4 min-[1440px]:p-5 2xl:p-6">
          <ErrorBoundary>
            <div className="min-w-0 max-w-full">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
