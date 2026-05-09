# Source-of-Truth Audit - 2026-05-09

## Scope

This audit validates source-of-truth behavior across all three modules:

- DonorCRM
- Compassion CRM
- Events CRM

Focus areas:

- Metrics correctness (ledger-backed vs proxy values)
- Query scoping (organization/client/event boundaries)
- Navigation scoping for event workspace tooling
- Known gaps that can still cause trust or data-leak risk

## Findings (by severity)

### High

1. Events workspace tools were accessible globally without requiring event context
- Impact: users could open event tool pages without selecting an event, increasing risk of cross-event mistakes and ambiguous context.
- Status: Fixed.
- Changes:
  - `app/components/layout/EventsSidebar.tsx`
    - Added a two-layer navigation model:
      - `BASE_NAV_SECTIONS` always visible (Dashboard, Events, Setup)
      - Event workspace sections only rendered when an active event context exists.
    - Event tool links are now route-scoped under `/events/{eventId}/...`.
  - `app/components/events/EventsRegistryPage.tsx`
    - Added explicit "Open Event Workspace" action to route users into scoped context (`/events/{eventId}`).
  - Added event workspace route wrappers for tools:
    - `/events/[eventId]/check-in`
    - `/events/[eventId]/tickets`
    - `/events/[eventId]/orders`
    - `/events/[eventId]/guests`
    - `/events/[eventId]/tables`
    - `/events/[eventId]/sponsors`
    - `/events/[eventId]/fundraising`
    - `/events/[eventId]/communications`
    - `/events/[eventId]/reports`
    - `/events/[eventId]/tasks`
    - `/events/[eventId]/volunteers`
    - `/events/[eventId]/files`
    - `/events/[eventId]/settings`
- Validation:
  - On `/events/check-in`, sidebar shows only Command Center section.
  - On `/events/evt_gala_2025/overview`, sidebar shows Event Workspace tools with event-route links.

### Medium

2. Event overview quick actions dropped event context
- Impact: from event overview, quick actions linked to generic routes (`/events/check-in`, `/events/guests`, etc.) and could lose active event selection.
- Status: Fixed.
- Changes:
  - `app/events/[eventId]/overview/page.tsx`
    - Updated quick action links to include event scope (`?eventId=${eventId}`).

3. Event overview revenue used proxy logic instead of order ledger
- Impact: metric trust risk from approximation/proxy values rather than authoritative order records.
- Status: Fixed.
- Changes:
  - `app/events/[eventId]/overview/page.tsx`
    - Added orders fetch from `/api/events/${eventId}/orders`.
    - Revenue now computed from confirmed orders only:
      - `sum(order.totalAmount where order.status === "CONFIRMED")`.
    - KPI card now shows computed Revenue.

4. Check-in code lookups were not event-constrained in workspace mode
- Impact: staff could scan a valid guest code and potentially resolve a record outside the intended active event workflow.
- Status: Fixed.
- Changes:
  - `server/src/routes/events.ts`
    - `GET /api/events/guests/by-code/:code` now accepts optional `eventId` query and enforces org-owned event validation + event-bound lookup when supplied.
  - `app/events/check-in/page.tsx`
    - Scan requests now pass the selected workspace event context to by-code lookup.

5. GalaSoft-inspired check-in table mode was missing
- Impact: slower door operations for table-based check-in workflows.
- Status: Fixed.
- Changes:
  - `app/events/check-in/page.tsx`
    - Added third check-in mode tab: `Tables`.
    - Added grouped table browse for rapid event-night check-in flow while preserving OyamaCRM UI style.

### Low

4. Compassion workspace permission enforcement remains TODO
- Impact: route-level auth exists, but dedicated module/workspace permission gates are still not fully enforced; this is a governance risk rather than an immediate data integrity bug.
- Status: Open.
- Evidence:
  - `app/compassion/layout.tsx` includes `// TODO: enforce Compassion workspace permission`.
  - Compassion API routes are organization-scoped and authenticated, which mitigates broad leakage.
- Next step:
  - Add explicit workspace permission middleware and role checks for Compassion entry routes and APIs.

## Module-by-Module Source of Truth Status

### DonorCRM

Current source of truth: Donation ledger (`Donation` records) with completed-status filtering for raised/revenue metrics.

Confirmed status:
- `server/src/lib/donationScope.ts` centralizes canonical donation filters.
- `server/src/routes/donations.ts` and `server/src/routes/reports.ts` use shared scope for consistency.
- `server/src/routes/campaigns.ts` now computes `totalRaised` from completed donations and enforces organization scoping.

Residual risks:
- None identified in this pass that require immediate code changes.

### Compassion CRM

Current source of truth: Compassion domain models (`CompassionClient`, `CompassionCase`, `CompassionAppointment`, etc.) scoped by organization.

Confirmed status:
- `server/src/routes/compassion.ts` consistently resolves `organizationId` and scopes list/dashboard queries.
- Client-import validation source of truth remains centralized in `app/compassion/import/clients/clientImportValidator.ts`, with defense-in-depth filtering on server route.

Residual risks:
- Workspace-level authorization enforcement is still pending (noted above).

### Events CRM

Current source of truth:
- Event revenue = confirmed order ledger (`eventOrder` with `status=CONFIRMED`).
- Event operations data = event-scoped endpoints under `/api/events/:eventId/...`.

Confirmed status:
- `server/src/routes/events.ts` dashboard summary uses confirmed orders for total revenue.
- Event mutation endpoints include organization ownership checks.
- Sidebar and overview flow now preserve event context and show tools only after entering event workspace.

Residual risks:
- Some workspace routes are still scaffolds/UI-only and should display clear in-development messaging until backend is complete.

## Validation Performed

- Diagnostics:
  - Checked for errors in changed files:
    - `server/src/routes/campaigns.ts`
    - `server/src/routes/events.ts`
    - `app/components/layout/EventsSidebar.tsx`
    - `app/components/events/EventsRegistryPage.tsx`
    - `app/events/[eventId]/overview/page.tsx`
  - No file diagnostics reported for those targets.
- Runtime checks:
  - Started API (`pnpm dev:api`) and validated route behavior in browser snapshots.
  - Verified pre-event and in-event sidebar behavior and event-scoped link targets.

## Recommended Next Hardening Pass

1. Implement explicit Compassion workspace permission checks end-to-end.
2. Add a small integration test suite for event-context navigation:
   - no workspace tools without event context
   - workspace tools visible after entering `/events/{eventId}`
   - quick actions preserve `eventId`.
3. Add metric contract tests for event overview revenue to ensure it matches confirmed order totals.
