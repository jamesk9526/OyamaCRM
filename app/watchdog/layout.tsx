// OyamaWatchdog layout provides a dedicated dark security CRM shell.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
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

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    if (user.role !== "admin") {
      router.replace("/");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-[#05080f] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (user.role !== "admin") {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-[#05080f]">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <WatchdogSidebar />
        <main className="flex-1 overflow-auto bg-[#0b1220] text-gray-100 p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
