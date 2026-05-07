"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import TopBar from "./TopBar";
import Sidebar from "./Sidebar";
import { useAuth } from "@/app/components/auth/AuthProvider";
import ErrorBoundary from "@/app/components/ErrorBoundary";

const PUBLIC_PATHS = ["/login", "/email-builder", "/setup"];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  useEffect(() => {
    if (!loading && !user && !isPublic) {
      router.replace("/login");
    }
  }, [loading, user, isPublic, router]);

  // Login page — no shell
  if (isPublic) return <>{children}</>;

  // Loading splash — prevent flash of unauthenticated content
  if (loading || !user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-white">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        {/* ErrorBoundary catches page-level render errors without crashing the whole shell */}
        <main className="flex-1 overflow-auto bg-gray-50 p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
