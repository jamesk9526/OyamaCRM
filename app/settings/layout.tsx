/** Settings layout provides dedicated settings sidebar navigation. */
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import SettingsSidebar from "@/app/components/settings/SettingsSidebar";

/** SettingsLayout wraps all settings pages in a sidebar/content shell. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) return;
    const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setMobileNavOpen(false);
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileNavOpen]);

  return (
    <div className="relative flex items-start gap-5">
      <div className="sticky top-4 hidden lg:block">
        <SettingsSidebar />
      </div>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Settings navigation">
          <button
            aria-label="Close settings navigation"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-slate-950/45 backdrop-blur-[1px]"
          />
          <div className="absolute inset-y-0 left-0 max-w-[90vw] p-3">
            <button type="button" onClick={() => setMobileNavOpen(false)} aria-label="Close settings navigation" className="absolute right-5 top-5 z-10 rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            <SettingsSidebar onNavigate={() => setMobileNavOpen(false)} />
          </div>
        </div>
      )}

      <section className="flex-1 min-w-0">
        <div className="mb-3 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-expanded={mobileNavOpen}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <Menu size={17} aria-hidden="true" />
            Browse settings
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
