// OyamaWebMaster layout provides a dedicated module shell for website-creator tooling.
"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import WebmasterSidebar from "@/app/components/layout/WebmasterSidebar";
import MobileSidebarDrawer from "@/app/components/layout/MobileSidebarDrawer";
import ErrorBoundary from "@/app/components/ErrorBoundary";

/** WebmasterLayout wraps all /webmaster routes in a distinct shell. */
export default function WebmasterLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
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
      <div className="min-h-screen bg-indigo-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <TopBar />
      <div className="relative flex min-w-0 flex-1 overflow-hidden">
        <div className="hidden lg:block">
          <WebmasterSidebar />
        </div>

        <MobileSidebarDrawer
          open={mobileNavOpen}
          title="OyamaWebMaster navigation"
          onClose={() => setMobileNavOpen(false)}
          widthClassName="w-[min(19rem,92vw)]"
        >
          <WebmasterSidebar />
        </MobileSidebarDrawer>

        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto bg-indigo-50/40 p-3 sm:p-4 lg:p-4 min-[1440px]:p-5 2xl:p-6">
          <ErrorBoundary>
            <div className="min-w-0 max-w-full">{children}</div>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
