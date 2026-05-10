// OyamaWebMaster layout provides a dedicated module shell for website-creator tooling.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import WebmasterSidebar from "@/app/components/layout/WebmasterSidebar";
import ErrorBoundary from "@/app/components/ErrorBoundary";

/** WebmasterLayout wraps all /webmaster routes in a distinct shell. */
export default function WebmasterLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

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
      <div className="flex flex-1 overflow-hidden">
        <WebmasterSidebar />
        <main className="flex-1 overflow-auto bg-indigo-50/40 p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
