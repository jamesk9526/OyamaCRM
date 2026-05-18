/**
 * RequireEventSelectionNotice renders a small purple notice shown while a legacy
 * global Events tool route is redirecting to the event selector at /events/events.
 *
 * Used by the legacy /events/<tool> routes (guests, tables, check-in, sponsors,
 * fundraising, communications, settings, hosts, follow-up, tickets, orders) when
 * they are accessed without a selected event. The event-scoped wrappers under
 * /events/[eventId]/<tool> populate useParams().eventId so they bypass this.
 */
"use client";

interface RequireEventSelectionNoticeProps {
  /** Short label describing which Events tool the user was trying to open. */
  tool: string;
}

/** RequireEventSelectionNotice renders the in-flight redirect message. */
export default function RequireEventSelectionNotice({ tool }: RequireEventSelectionNoticeProps) {
  return (
    <div className="p-6">
      <section
        role="status"
        aria-live="polite"
        className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900"
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-violet-700">
          Event selection required
        </p>
        <p className="mt-1 font-semibold text-violet-950">
          Select an event before opening {tool}.
        </p>
        <p className="mt-1 text-xs text-violet-800">
          Redirecting to the event selector at <span className="font-mono">/events/events</span>...
        </p>
      </section>
    </div>
  );
}
