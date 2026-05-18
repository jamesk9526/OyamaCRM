# OyamaCRM Status

_Last updated: 2026-05-18_

## Events CRM

The Events CRM is now oriented around a FundEasy / Attendance-style nonprofit fundraising event command center. FundEasy is used only as a functional workflow reference; OyamaCRM must not copy its branding, UI, code, or proprietary design.

| Area | Status | Notes |
|---|---|---|
| Event-first entry | Working | `/events/events` is the single sidebar entry for creating/selecting events; `/events/workspace` remains a compatibility route. |
| Event-scoped routes | Working | Core scoped tools route through `/events/[eventId]/...` so guests, tables, sponsors, registration, check-in, and reports stay tied to one event. |
| Event command center overview | Working | `/events/[eventId]/overview` now uses a polished purple command-center layout with selected-event header, at-a-glance KPIs, readiness checks, and operations sections. |
| Event lock behavior | Working | Event-scoped pages lock to the selected event; users switch only by returning to `/events/events`. |
| Guests / registrants | Working | API-backed guest list remains available at `/events/[eventId]/guests`. |
| Tables / seating list | Working | Structured table management is available at `/events/[eventId]/tables` with Floor Plan, Table List, and Guest Placement views. |
| Sponsors | Working | Event-scoped sponsor manager is available with event lock behavior in scoped routes. |
| Registration | Working | Current ticket type manager is used as the registration setup surface. |
| Live check-in | Working | Core check-in route is event-scoped with a simplified dark operations UI; dedicated volunteer/tablet mode is not complete. |
| Table hosts | Partially Working | Host workspace route exists, but host portal links, resend controls, permissions, and audit coverage are still required. |
| Event page builder | Partially Working | Canonical route is `/events/[eventId]/event-page`; compatibility selector remains at `/events/page-builder`; source-sync and publishing persistence are incomplete. |
| Event emails | Partially Working | Scaffold route exists; segmented drafts, scheduling, and sending are incomplete. |
| Donations / pledges | Partially Working | Scaffold route exists; pledge workflows, recurring giving prospects, and donor follow-up conversion are incomplete. |
| Post-event follow-up | Partially Working | Follow-up queue UI and donor-safe export endpoint are available; orchestration and automation still need implementation. |
| Manager integrations | Partially Working | Admin-only import endpoint can snapshot donor payment/email settings into Events manager integrations. |
| Partial-feature warning popups | Working | Events partial tools now show explicit in-development popup + banner warnings to prevent false production expectations. |

Canonical next build order: table host data model and staff UI, guest/table reassignment improvements, dedicated live check-in mode, event page templates, event email segments, event donations/pledges, and post-event follow-up dashboard.
