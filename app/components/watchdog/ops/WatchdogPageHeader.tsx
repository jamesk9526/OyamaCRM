// Shared header for Watchdog operations pages.

import type React from "react";

interface WatchdogPageHeaderProps {
  title: string;
  description: string;
  actions?: React.ReactNode;
}

/** Renders a consistent page title bar across Watchdog operations routes. */
export default function WatchdogPageHeader({ title, description, actions }: WatchdogPageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-600">{description}</p>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
