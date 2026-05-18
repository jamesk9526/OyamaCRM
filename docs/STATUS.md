# OyamaCRM Status

_Last updated: 2026-05-18_

## Events CRM

The Events CRM is now oriented around a FundEasy / Attendance-style nonprofit fundraising event command center. FundEasy is used only as a functional workflow reference; OyamaCRM must not copy its branding, UI, code, or proprietary design.

| Area | Status | Notes |
|---|---|---|
| Event-first entry | Working | `/events` and `/events/workspace` now use the same event selector and journey hub. |
| Event-scoped routes | Working | Core scoped tools route through `/events/[eventId]/...` so guests, tables, sponsors, registration, check-in, and reports stay tied to one event. |
| Active event switcher | Working | Event-scoped pages show an active-event selector above the workspace content. |
| Guests / registrants | Working | API-backed guest list remains available at `/events/[eventId]/guests`. |
| Tables / seating list | Working | Structured table management remains available at `/events/[eventId]/tables`; visual seating layout needs a later dedicated build. |
| Sponsors | Working | Event-scoped sponsor manager remains available. |
| Registration | Working | Current ticket type manager is used as the registration setup surface. |
| Live check-in | Working | Core check-in route is event-scoped; dedicated volunteer/tablet mode is not complete. |
| Table hosts | Not Implemented | Host portal links, host guest manager, resend controls, permissions, and audit coverage are still required. |
| Event page builder | Partially Working | Page builder entry exists; event-record sync and fundraising templates are incomplete. |
| Event emails | Partially Working | Scaffold route exists; segmented drafts, scheduling, and sending are incomplete. |
| Donations / pledges | Partially Working | Scaffold route exists; pledge workflows, recurring giving prospects, and donor follow-up conversion are incomplete. |
| Post-event follow-up | Not Implemented | Thank-you task creation, monthly donor prospecting, and Steward summaries need dedicated implementation. |

Canonical next build order: table host data model and staff UI, guest/table reassignment improvements, dedicated live check-in mode, event page templates, event email segments, event donations/pledges, and post-event follow-up dashboard.
