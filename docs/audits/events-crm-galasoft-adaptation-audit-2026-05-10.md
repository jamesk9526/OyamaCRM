# Events CRM Galasoft Adaptation Audit (2026-05-10)

## Scope

This audit documents how Galasoft was reviewed as a functional reference for Events CRM, what ideas were selected, what was intentionally not copied, and what has been implemented so far in OyamaCRM.

Reference software reviewed:
- REFERANCE_SOFTWARE/GalaSoft/backend/schema.sql
- REFERANCE_SOFTWARE/GalaSoft/backend/services/registrationService.js
- REFERANCE_SOFTWARE/GalaSoft/vite-project/src/pages/CheckInDashboard.tsx
- REFERANCE_SOFTWARE/GalaSoft/vite-project/src/pages/Dashboard.tsx
- REFERANCE_SOFTWARE/GalaSoft/vite-project/src/pages/EventOps/EventOpsHub.tsx
- REFERANCE_SOFTWARE/GalaSoft/vite-project/src/pages/Seating/

## Executive Summary

Galasoft is valuable as an operations workflow reference, especially for event-first check-in, guest lifecycle, ticket/table behaviors, and staffing-friendly dashboards. OyamaCRM should adapt these behaviors into its existing architecture (Next.js App Router + Express + Prisma), without copying Galasoft UI/CSS or legacy project structure.

This batch implemented practical adaptation groundwork:
- Clear global Events tools outside event scope (reports, page builder, templates, management).
- Event workspace selector now visibly separates event-scoped tools from global tools.
- New global routes for event page building and template draft generation.
- Compassion scheduling source-of-truth controls and public slot-based booking hardening (shared because event operations and care scheduling share similar office-hour constraints and workflow expectations).

## What Was Useful From Galasoft (Adapt)

1. Event-first operations model
- Why useful: Prevents data confusion between events and improves office-worker speed.
- Oyama adaptation: Event workspace selector remains the scoped gateway; global tools are now explicit and separate.

2. Check-in and roster operational patterns
- Why useful: Multi-path check-in (search, code, table) reduces line friction.
- Oyama adaptation target: Extend existing check-in pages with multiple search and queue modes.

3. Transactional registration flow
- Why useful: Prevents partial records and seat conflicts.
- Oyama adaptation target: Strengthen seat assignment and order + guest create flows with stricter transactional behavior.

4. Ticket/table distinctions and capacity semantics
- Why useful: Individual, table, comp, and sponsored paths need distinct business logic.
- Oyama adaptation target: Expand ticket and sponsorship APIs from scaffold to full CRUD and validation.

5. Live operations dashboard discipline
- Why useful: Teams need immediate readiness and bottleneck visibility.
- Oyama adaptation target: Replace static narrative cards with API-derived queue counters and health indicators.

## What Must Be Ignored (Do Not Copy)

1. Galasoft visual design and CSS patterns.
2. Galasoft file/folder architecture.
3. Legacy implementation shortcuts that bypass module boundaries.
4. Any pattern that weakens org scoping, permission boundaries, or auditability.

## Current Implementation Status Matrix

Status labels used:
- Working
- Partial
- Demo-only
- Not yet implemented

| Area | Surface | Status | Evidence | Next Step |
|---|---|---|---|---|
| Events CRM | Event registry + core CRUD | Working | `/api/events` create/list/detail/update routes are live and used by Events pages | Add validation around registration policy and owner assignment |
| Events CRM | Orders/guests/tables/check-in | Working | Existing event operations routes are API-backed | Add multi-mode check-in queues and better conflict handling |
| Events CRM | Event-first scoped workspace routing | Working | `/events/workspace` + `/events/[eventId]/[tool]` flow in place | Add route-level permission checks |
| Events CRM | Global tools outside selected event | Working | New global nav + selector links + global routes (`/events/page-builder`, `/events/templates`, `/events/events`, `/events/reports`) | Add richer global management metrics |
| Events CRM | Event template system | Partial | Template draft cloning from existing events is implemented | Clone related ticket/sponsor/message defaults in follow-up batch |
| Events CRM | Ticket/sponsor/communications/tasks/volunteers/files/settings tools | Demo-only | Many scoped tools remain static shells | Build API-backed CRUD starting with tickets + sponsors |
| Events CRM | Seating chart advanced operations | Not yet implemented | No full drag/drop seating planner yet | Implement seating map model + interaction flows |
| Compassion CRM | Public booking flow | Working | Public page uses server-calculated slots and submit-time validation | Add rate limiting and anti-abuse telemetry |
| Compassion CRM | Embeddable scheduling widget script | Working | `public/embed/compassion-schedule.js` available + settings snippet | Add signed config/versioning and event callbacks |
| Compassion CRM | Scheduling source-of-truth settings | Working | Office-managed intervals, lead time, advance window, blocks, blackout dates in settings UI + API config | Add role-gated approvals and validation previews |
| Compassion CRM | Existing-client matcher + staff review queue | Not yet implemented | Submission currently creates appointment request path without queue workflow | Add match scoring + triage queue + assignment actions |

## Changes Applied In This Batch

1. Events global tooling and navigation
- Added a "Global Tools" section to Events sidebar.
- Added global tools section in workspace selector to keep cross-event tools accessible.
- Added `/events/page-builder` global route for event page workflows.
- Added `/events/templates` global route for creating draft templates from real events.

2. Compassion scheduling hardening
- Extended widget config schema to support slot interval, appointment duration, lead window, max advance days, recurring availability blocks, and blackout dates.
- Added public slots endpoint and server-side slot generation.
- Enforced submit-time slot validation and slot conflict responses.
- Converted public booking UI from freeform datetime to date + slot selection.
- Added script-based embed option in settings and server response.

## Immediate Follow-Up Backlog

1. Events
- Build ticket type CRUD and sponsorship CRUD as first post-audit feature block.
- Add check-in operation modes inspired by Galasoft (scan/search/table tabs).
- Add queue/readiness counters for real-time operations dashboard cards.

2. Compassion scheduling
- Add per-token rate limiting and abuse monitoring.
- Add existing-client matching and staff review queue before final appointment conversion.
- Add test coverage for blackout overlap and capacity edge cases.

3. Governance
- Keep this audit and status docs synchronized with implementation changes.
- Keep AGENTS guidance aligned with event-global-vs-scoped boundaries and scheduling source-of-truth rules.
