/** Settings layout provides dedicated settings sidebar navigation. */
import type React from "react";
import SettingsSidebar from "@/app/components/settings/SettingsSidebar";

/** SettingsLayout wraps all settings pages in a sidebar/content shell. */
export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-5 items-start">
      <SettingsSidebar />
      <section className="flex-1 min-w-0">{children}</section>
    </div>
  );
}
