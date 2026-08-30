/**
 * Events CRM root layout — wraps all /events/* routes with the event-first studio shell.
 *
 * EventsStudioShell provides one event switcher and one canonical navigation rail.
 *
 * TODO: Enforce Events module access permission here.
 *       Currently only authentication is checked (401 redirect).
 *       Implement a permission check against the user's `modules` array or a role guard
 *       so users without the Events module license can't access these routes at all.
 *       Pattern: import { requireModule } from "@/app/lib/permissions"; requireModule("events");
 *
 * Page-level requests remain scoped to the data each workflow requires.
 */
"use client";

import { Suspense } from "react";
import EventsStudioShell from "@/app/components/events/EventsStudioShell";

/** EventsLayout keeps every route in one focused, responsive EventSTUDIO frame. */
export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-slate-100">
          <div className="h-9 w-9 animate-spin rounded-full border-2 border-violet-600 border-t-transparent" />
        </div>
      }
    >
      <EventsStudioShell>{children}</EventsStudioShell>
    </Suspense>
  );
}
