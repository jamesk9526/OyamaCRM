# Events CRM Reporting and Donor Sync Status

_Last deep audit: 2026-05-09_

## Summary

Event reporting and donor timeline synchronization are now real and DB-backed, but the broader Events CRM module is still mixed (partly operational, partly scaffold UI).

## Status Matrix

| Area | Feature | Status | Data Source | Notes | Next Step |
|---|---|---|---|---|---|
| Events CRM | Event report endpoints | Working | Real API Data | `GET /api/events/reports/summary` and `GET /api/events/:eventId/report` are implemented in `server/src/routes/events.ts`. | Add sponsor/ticket-level report dimensions and export endpoints. |
| Events CRM | Reports UI | Working | Real API Data | `app/events/reports/EventReportsContent.tsx` consumes live report APIs and event list data. | Add date-range presets and CSV/PDF export UX. |
| Events CRM | Donor timeline sync | Working | Real Database Data | Event order creation, guest creation, and check-in write `Activity` entries (EVENT_REGISTRATION / EVENT_ATTENDANCE). | Surface event activity filters directly on constituent timeline UI. |
| Events CRM | Event operational pages (orders/guests/tables/check-in) | Working | Real API Data | `/events/orders`, `/events/guests`, `/events/tables`, `/events/check-in` are wired to event routes. | Add duplicate-guest merge and bulk correction workflows. |
| Events CRM | Ticket/sponsor/public registration modules | UI Only | Static Demo UI | Tickets/sponsors and several module pages still use static `EventsWorkspacePage` scaffolds. | Implement ticket type CRUD, sponsor CRUD, and public registration page generation. |

## Real Data vs Demo Data Audit

- **Real:** event CRUD, reports, orders, guest operations, table assignments, check-in, and activity sync.
- **Demo/UI-only:** ticket management, sponsor management, communications/tasks/volunteer/file/settings event submodules.
- **Missing:** public ticket storefront/checkout and complete event communications pipeline.
