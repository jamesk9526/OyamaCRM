# EventSTUDIO TableLink + Check-In Implementation Status

Source plan: docs/oyamacrm-event-studio-tablelink-checkin-agent-instructions.md
Last updated: 2026-05-18 (Phase 9 completed)

## Phase Status

- Phase 1 - Audit and planning: Done
- Phase 2 - Backend models and migrations: Done
- Phase 3 - Backend services: Done
- Phase 4 - API routes: Done
- Phase 5 - Admin Event Studio UI: Done
- Phase 6 - Public TableLink portal: Done
- Phase 7 - Guest self-entry flow: Done
- Phase 8 - Check-In Studio redesign: Done
- Phase 9 - Reporting and exports: Done
- Phase 10 - Testing and documentation: Not Started

## Phase 1 Deliverables (Completed)

### Current architecture notes

- Current event backend is route-heavy in server/src/routes/events.ts with minimal service-layer separation.
- Existing models include Event, EventGuest, EventTable, EventOrder, EventOrderItem, EventSponsor, and legacy EventAttendance in prisma/schema.prisma.
- Existing check-in flow uses guest-level checkedIn/checkedInAt and checkinCode lookup, but does not create auditable per-action records.
- Existing public registration route supports event signup at public page slug endpoints, but there is no TableLink host portal or guest invite token workflow.
- Existing auth and permission middleware is present for authenticated staff operations; public magic-link host access is not implemented.

### Model mapping notes (exists vs needed)

Exists:

- EventTable base fields (name, capacity, hostName, layout fields)
- EventGuest base fields (status, tableId, checkedIn, checkedInAt, checkinCode)

Needed for plan:

- EventTable enhancements: tableUid, publicCode, status enum, host-access token metadata
- New models: EventTableSeat, EventGuestInvite, EventTableAccessToken, EventCheckInRecord, EventCheckInException, EventEmailLog

### Integration points selected

- Use existing logAudit utilities for auditable actions.
- Use existing organization scoping patterns in events routes and organization resolver utilities.
- Reuse existing event public slug and page-builder/public route conventions for TableLink public flows.
- Introduce service-layer modules under server/src/services to reduce logic density in events route handlers.

### Risks and unknowns

- Existing events.ts route file is large and highly coupled; phased extraction into services must avoid behavior regressions.
- Prisma migration impact must be additive-first and preserve existing demo/event workflows.
- Public tokenized flows require secure hashing/expiration and rate limiting strategy alignment.
- Check-in redesign must preserve current checkinCode compatibility while introducing EventCheckInRecord source-of-truth.
- Email provider path for event-specific notifications needs concrete provider wiring and delivery observability plan.

## Phase 2 Ready Checklist

- [x] Add Prisma fields to EventTable for tableUid/publicCode/status/access-token lifecycle
- [x] Add new Prisma models for seats/invites/access/check-in records/exceptions/email logs
- [x] Add required enums and indexes (event-scoped query performance)
- [x] Add migration with additive-only strategy
- [x] Update seed support for new required model shape
- [x] Run pnpm db:generate and validate Prisma client output
- [x] Document schema changes and migration notes in this status file

## Phase 2 Schema/Migration Changes (Implemented)

### Updated files

- `prisma/schema.prisma`
- `prisma/migrations/20260518201000_add_event_tablelink_checkin_models/migration.sql`

### New enums added

- `EventTableStatus`
- `EventTableSeatStatus`
- `EventGuestSource`
- `EventGuestInviteStatus`
- `EventTableAccessTokenStatus`
- `EventCheckInMethod`
- `EventCheckInStatus`
- `EventCheckInExceptionIssueType`
- `EventCheckInExceptionStatus`
- `EventEmailLogType`
- `EventEmailLogStatus`

### Existing models extended

- `EventTable`: `tableUid`, `publicCode`, `status`, `sponsorName`, `hostEmail`, `hostPhone`, `accessTokenHash`, `accessTokenExpiresAt`
- `EventGuest`: `seatId`, `source`, `qrTokenHash`, `qrTokenExpiresAt`
- `Event`: relations to new seats/invites/access/check-in/exception/email models

### New models added

- `EventTableSeat`
- `EventGuestInvite`
- `EventTableAccessToken`
- `EventCheckInRecord`
- `EventCheckInException`
- `EventEmailLog`

### Migration strategy notes

- Migration is additive-only (no destructive drops).
- Existing `EventTable` rows are backfilled for `tableUid` before unique index creation.
- New models are event-scoped and include event-focused indexes for reporting and runtime query paths.

## Phase 2 Validation Notes

- `pnpm prisma validate`: successful
- `pnpm db:generate`: successful after clearing Windows file locks by stopping active Node processes in the workspace

## Phase 3 Service Layer Progress

Implemented service modules:

- `server/src/services/event-table-service.ts`
- `server/src/services/event-seat-service.ts`
- `server/src/services/tablelink-access-service.ts`
- `server/src/services/guest-invite-service.ts`
- `server/src/services/event-guest-service.ts`
- `server/src/services/event-email-service.ts`
- `server/src/services/checkin-service.ts`
- `server/src/services/checkin-exception-service.ts`
- `server/src/services/event-reporting-service.ts`

Validation:

- `pnpm typecheck:server`: successful

Route integration completed:

- `server/src/routes/events.ts` now uses service-layer handlers for:
	- Table creation (`createEventTable`)
	- Auditable check-in / reverse-check-in (`createCheckInRecord`, `reverseCheckIn`)
	- Live check-in counts (`getCheckInLiveCounts`)
	- Exception queue create/list/resolve/dismiss (`checkin-exception-service`)
	- Event email log listing (`listEventEmailLogs`)
	- Table deletion cleanup updated for new TableLink dependencies (seats/invites/access tokens)

Runtime fix completed during this phase:

- Applied pending migration `20260518201000_add_event_tablelink_checkin_models` to remove missing-column API failures for `EventTable.tableUid` and `EventGuest.seatId`.

Deferred to later phases:

- Additional service-level tests for new modules.
- Full audit hook coverage expansion for every service write path.

## Phase 4 API Route Progress (Completed)

New or updated route coverage in `server/src/routes/events.ts`:

- Seat routes:
	- `POST /api/events/:eventId/tables/:tableId/seats/sync`
	- `GET /api/events/:eventId/tables/:tableId/seats`
	- `PATCH /api/events/:eventId/seats/:seatId`
	- `POST /api/events/:eventId/seats/:seatId/assign-guest`
	- `POST /api/events/:eventId/seats/:seatId/clear`
	- `POST /api/events/:eventId/seats/move-guest`

- TableLink access routes:
	- `POST /api/events/:eventId/tablelink/request-access`
	- `POST /api/events/:eventId/tablelink/verify-token`
	- `GET /api/events/:eventId/tablelink/:tableUid`
	- `PATCH /api/events/:eventId/tablelink/:tableUid`
	- `POST /api/events/:eventId/tablelink/:tableUid/revoke-access`

- Guest invite routes:
	- `POST /api/events/:eventId/tablelink/:tableUid/invite-guest`
	- `POST /api/events/:eventId/tablelink/invites/:token/opened`
	- `GET /api/events/:eventId/tablelink/invites/:token`
	- `POST /api/events/:eventId/tablelink/invites/:token/complete`
	- `POST /api/events/:eventId/tablelink/invites/:inviteId/resend`
	- `POST /api/events/:eventId/tablelink/invites/:inviteId/cancel`

- Check-in routes:
	- `GET /api/events/:eventId/checkin/search`
	- `POST /api/events/:eventId/checkin/verify-token`
	- `POST /api/events/:eventId/checkin/guest/:guestId`
	- `POST /api/events/:eventId/checkin/guest/:guestId/reverse`
	- `POST /api/events/:eventId/checkin/table/:tableId/bulk`
	- `POST /api/events/:eventId/checkin/walk-in`
	- `POST /api/events/:eventId/checkin/replacement`
	- `GET /api/events/:eventId/checkin/live-counts`

- Check-in exception routes:
	- `POST /api/events/:eventId/checkin/exceptions`
	- `GET /api/events/:eventId/checkin/exceptions`
	- `POST /api/events/:eventId/checkin/exceptions/:exceptionId/resolve`
	- `POST /api/events/:eventId/checkin/exceptions/:exceptionId/dismiss`

- Event email routes:
	- `POST /api/events/:eventId/emails/host-access`
	- `POST /api/events/:eventId/emails/guest-invite`
	- `POST /api/events/:eventId/emails/table-reminders`
	- `POST /api/events/:eventId/emails/checkin-qr`
	- `GET /api/events/:eventId/emails/logs`

Validation:

- `pnpm typecheck:server`: successful

Notes:

- Email action endpoints currently log queue entries via `EventEmailLog`; transport/provider delivery wiring remains for later phases.

## Phase 5 Admin Event Studio UI Progress (Completed)

Implemented in `app/events/tables/page.tsx`:

- Added `TableLink Studio` detail drawer launched from table cards.
- Added table lock/unlock controls wired to `PATCH /api/events/:eventId/tablelink/:tableUid`.
- Added seat sync control wired to `POST /api/events/:eventId/tables/:tableId/seats/sync`.
- Added host access token controls:
	- issue host token via `POST /api/events/:eventId/tablelink/request-access`
	- revoke active tokens via `POST /api/events/:eventId/tablelink/:tableUid/revoke-access`
- Added guest invite controls for table hosts/admin staff:
	- create invite via `POST /api/events/:eventId/tablelink/:tableUid/invite-guest`
	- invite list/status view from table detail payload
- Added seat roster assignment controls:
	- assign guest to seat via `POST /api/events/:eventId/seats/:seatId/assign-guest`
	- clear seat assignment via `POST /api/events/:eventId/seats/:seatId/clear`
- Added table-scoped email status panel by filtering `GET /api/events/:eventId/emails/logs`.

Supporting backend updates:

- `server/src/routes/events.ts` now accepts table `sponsorName`, `hostEmail`, `hostPhone`, and `status` in create/update payloads.
- TableLink PATCH lock rule now allows explicit unlock (`LOCKED -> OPEN`) while preserving lock protection for other edits.

Validation:

- `pnpm typecheck:web`: successful
- `pnpm typecheck:server`: successful

## Phase 8 Check-In Studio Redesign Progress (Completed)

Primary UI implementation:

- Rebuilt `app/events/check-in/page.tsx` as a multi-mode event-scoped Check-In Studio.

Delivered modes:

- Search mode (name/email/phone/table/code query via `GET /api/events/:eventId/checkin/search`).
- Scan mode (QR/code verification preview via `POST /api/events/:eventId/checkin/verify-token`).
- Table mode with bulk table check-in via `POST /api/events/:eventId/checkin/table/:tableId/bulk`.
- Walk-In mode via `POST /api/events/:eventId/checkin/walk-in`.
- Replacement mode via `POST /api/events/:eventId/checkin/replacement`.
- Exception Queue mode with create/resolve/dismiss actions:
	- `POST /api/events/:eventId/checkin/exceptions`
	- `POST /api/events/:eventId/checkin/exceptions/:exceptionId/resolve`
	- `POST /api/events/:eventId/checkin/exceptions/:exceptionId/dismiss`

Additional check-in behavior delivered:

- Canonical per-guest check-in endpoint usage:
	- `POST /api/events/:eventId/checkin/guest/:guestId`
- Reverse check-in support:
	- `POST /api/events/:eventId/checkin/guest/:guestId/reverse`
- Duplicate-attempt warning handling when `DUPLICATE_ATTEMPT` is returned.
- Live event-day counters from `GET /api/events/:eventId/checkin/live-counts`.
- Auto-refresh loop for live counts and exception queue updates.

Validation:

- `pnpm typecheck:web`: successful
- `pnpm typecheck:server`: successful

## Phase 9 Reporting and Exports Progress (Completed)

Backend reporting endpoints added in `server/src/routes/events.ts`:

- `GET /api/events/:eventId/reporting/snapshot`
- `GET /api/events/:eventId/reporting/export/:reportType`

Delivered report slices:

- Attendance summary, including expected, confirmed, checked-in, no-show, walk-in, replacement, and exception counts.
- Table completion reports from TableLink table capacity and confirmed guest counts.
- Meal preference and dietary restriction counts.
- Check-in exception report rows.
- Email delivery totals and recent delivery logs.
- Sponsor/table attendance report rows.

CSV exports delivered:

- `attendance`
- `table-completion`
- `meals`
- `exceptions`
- `email-delivery`
- `sponsor-table-attendance`

Frontend reporting updates:

- `app/events/reports/EventReportsContent.tsx` now loads the Phase 9 reporting snapshot alongside the existing event report.
- Added export buttons for the Phase 9 CSV report types.
- Added visible meal count, email delivery, sponsor/table attendance, and event-night operations sections to the event report detail view.

Additional build fix:

- Wrapped `app/tablelink/page.tsx` in `Suspense` so the public TableLink route can prerender while `PublicTableLinkPortal` uses `useSearchParams`.

Validation:

- `pnpm build`: successful
- `pnpm typecheck:web`: successful
- `pnpm typecheck:server`: successful

## Phase 7 Guest Self-Entry Flow Progress (Completed)

Public guest invite endpoints added in `server/src/routes/events.ts`:

- `POST /api/events/public/tablelink/invites/:token/opened`
- `GET /api/events/public/tablelink/invites/:token`
- `POST /api/events/public/tablelink/invites/:token/complete`

Guest invite behavior delivered:

- Token validation and invite lookup via hashed token.
- Invite state handling for:
	- `COMPLETED`
	- `EXPIRED`
	- `CANCELLED`
- `opened` status updates when invite links are viewed.
- Guest profile completion using `completeGuestInvite` service.
- Confirmation email queue logging via `EventEmailLog` (`GUEST_CONFIRMATION`).

Public UI delivered:

- Guest self-entry route: `app/tablelink/invite/[token]/page.tsx`
- Guest self-entry page component: `app/components/events/public/PublicTableLinkInvitePage.tsx`

Host portal integration updates:

- `app/components/events/public/PublicTableLinkPortal.tsx` now shows shareable guest invite URLs (`/tablelink/invite/{token}`) after invite creation.

Validation:

- `pnpm typecheck:web`: successful
- `pnpm typecheck:server`: successful

## Phase 6 Public TableLink Portal Progress (Completed)

Backend public TableLink endpoints added in `server/src/routes/events.ts` before `requireAuth`:

- `POST /api/events/public/tablelink/request-access`
- `POST /api/events/public/tablelink/verify-token`
- `GET /api/events/public/tablelink/:eventId/:tableUid`
- `PATCH /api/events/public/tablelink/:eventId/:tableUid`
- `POST /api/events/public/tablelink/:eventId/:tableUid/invite-guest`

Public portal UI implemented:

- `app/tablelink/page.tsx` (host sign-in / access request)
- `app/tablelink/[eventId]/[tableUid]/page.tsx` (host table workspace)
- `app/components/events/public/PublicTableLinkPortal.tsx`

Public portal capabilities delivered:

- Host access request by eventId + tableKey + host email.
- Token-scoped table workspace with seat summary and roster visibility.
- Host contact/notes update.
- Table roster submit action (`status=SUBMITTED`).
- Guest invite creation (email/phone, optional seat).
- Invite history display for recent table invites.

Event command center replacement delivered:

- `/events` now renders the EventSTUDIO project-library registry view by default via `app/components/events/EventsDashboard.tsx` -> `EventsRegistryPage`.

Additional shell/public routing support:

- Added `/tablelink` to `PUBLIC_PATHS` in `app/components/layout/AppShell.tsx` so nested public portal routes remain accessible without CRM auth.

Validation:

- `pnpm typecheck:web`: successful
- `pnpm typecheck:server`: successful
