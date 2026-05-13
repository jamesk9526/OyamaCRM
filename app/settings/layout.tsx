/** Settings layout provides dedicated settings sidebar navigation. */
"use client";

import type React from "react";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import SettingsSidebar from "@/app/components/settings/SettingsSidebar";

/** SettingsLayout wraps all settings pages in a sidebar/content shell. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  return (
    <div className="flex gap-3 md:gap-5 items-start relative">
      <div className="hidden md:block">
        <SettingsSidebar />
      </div>

      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <button
            aria-label="Close settings navigation"
            onClick={() => setMobileNavOpen(false)}
            className="absolute inset-0 bg-black/35"
          />
          <div className="absolute inset-y-0 left-0 w-64 max-w-[86vw] p-3">
            <SettingsSidebar />
          </div>
        </div>
      )}

      <section className="flex-1 min-w-0">
        <div className="md:hidden mb-3">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Settings Menu
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
