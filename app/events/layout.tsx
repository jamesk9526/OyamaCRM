// Events CRM layout — renders the new journey-based EventsShell with sidebar navigation.
"use client";

import { Suspense } from "react";
import EventsShell from "@/app/components/events/EventsShell";

// TODO: enforce Events workspace permission — currently only checks authentication, not module access

/** EventsLayout wraps all /events/* routes with the new production-polished EventsShell. */
export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-slate-100">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        </div>
      }
    >
      <EventsShell>{children}</EventsShell>
    </Suspense>
  );
}
