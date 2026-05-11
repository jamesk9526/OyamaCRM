// OyamaHRM layout provides the teal-themed shell for all /hrm routes.
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import TopBar from "@/app/components/layout/TopBar";
import HrmSidebar from "@/app/components/layout/HrmSidebar";
import ErrorBoundary from "@/app/components/ErrorBoundary";

/**
 * HrmLayout wraps all /hrm routes in the module shell and applies baseline access rules.
 * TODO: enforce granular HRM workspace permissions when permission keys are finalized.
 */
export default function HrmLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

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
        <TopBar />
        <main className="flex-1 flex items-center justify-center bg-teal-50/40 p-6">
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
    <div className="flex flex-col h-screen bg-white">
      <TopBar />
      <div className="flex flex-1 overflow-hidden">
        <HrmSidebar />
        <main className="flex-1 overflow-auto bg-teal-50/30 p-6">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}
