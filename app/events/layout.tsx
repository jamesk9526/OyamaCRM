/**
 * Events CRM root layout — wraps all /events/* routes with EventsShell.
 *
 * EventsShell provides:
 *  - Journey-based sidebar (Plan → Fill → Fundraise → Run → Follow Up)
 *  - Top bar with event switcher and Back to DonorCRM
 *  - Global route passthrough (no sidebar for /events, /events/reports, etc.)
 *  - No-event selector dialog for deep-linked event-scoped routes
 *
 * TODO: Enforce Events module access permission here.
 *       Currently only authentication is checked (401 redirect).
 *       Implement a permission check against the user's `modules` array or a role guard
 *       so users without the Events module license can't access these routes at all.
 *       Pattern: import { requireModule } from "@/app/lib/permissions"; requireModule("events");
 *
 * TODO: Add an EventsContext provider here to share the loaded events list across child routes,
 *       eliminating the redundant /api/events fetches in EventsShell and individual tool pages.
 *       Shape: { events: EventItem[], selectedEventId: string, setSelectedEventId: fn }
 */
"use client";

import { Suspense } from "react";
import EventsShell from "@/app/components/events/EventsShell";

/** EventsLayout wraps all /events/* routes with the production-polished EventsShell. */
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
