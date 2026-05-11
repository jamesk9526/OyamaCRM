// Apps layout applies a basic non-CRM shell for all standalone app routes under /apps.
"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/app/components/auth/AuthProvider";
import AppProductShell from "@/app/components/layout/AppProductShell";

const APP_NAV_ITEMS = [
  { label: "App Home", href: "/apps" },
  { label: "Trivia Software", href: "/apps/trivia" },
];

/**
 * AppsLayout is the shared shell for standalone apps that are not CRM modules.
 * It intentionally avoids CRM TopBar behavior (global search and AI assistant controls).
 */
export default function AppsLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Trivia uses its own dark shell; bypass the generic /apps shell wrapper for these routes.
  if (pathname.startsWith("/apps/trivia")) {
    return <>{children}</>;
  }

  return (
    <AppProductShell
      appName="Oyama Apps"
      appSubtitle="Standalone tools that are separate from CRM modules"
      navItems={APP_NAV_ITEMS}
    >
      {children}
    </AppProductShell>
  );
}
