// Events CRM nested layout — renders the dedicated dark Events studio shell for all /events/* routes.
"use client";

import { Suspense } from "react";
import EventsStudioShell from "@/app/components/events/EventsStudioShell";

// TODO: enforce Events workspace permission — currently only checks authentication, not module access

/** EventsLayout isolates Events CRM from the standard Donor/Compassion workspace chrome. */
export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[#080a22] text-white">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-400 border-t-transparent" />
        </div>
      }
    >
      <EventsStudioShell>{children}</EventsStudioShell>
    </Suspense>
  );
}
