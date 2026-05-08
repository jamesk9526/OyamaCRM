# Phase 07 — Events and Gala Operations

## Goal

Support end-to-end nonprofit event operations from setup through check-in and post-event reporting.

## Scope

- Event setup, ticketing, registrations
- Tables/seating and host workflows
- Check-in operations
- Sponsor and event revenue reporting

## Manageable steps

1. Implement event CRUD and event summary fields.
2. Add ticket type and registration workflows.
3. Add table/seating assignment and host links.
4. Implement check-in search + walk-in paths.
5. Add sponsor tracking and income categorization.
6. Add event-specific reports and exports.
7. Publish timeline/events hooks for major actions.

## Exit criteria

- Staff can run event registration and check-in reliably.
- Seating and sponsor workflows are usable in production.
- Event revenue can be reconciled through reports.

## Audit snapshot — 2026-05-08

- [x] Event schema and API list/create/update flows exist — `prisma/schema.prisma`, `server/src/routes/events.ts`.
- [~] `/events` page is partial — route exists, but registration/ticketing/check-in workflows are missing.
- [ ] Gala sponsorships, seating, auction, volunteer-hour tie-ins, and revenue rollups are not started in usable code.
