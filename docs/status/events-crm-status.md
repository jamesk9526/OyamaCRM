# Events CRM — Feature Status

_Last updated: 2026-05-18_

## 2026-05-18 Slice C — Public Page Completion & Builder Gap Pass

This pass closes the biggest public-page workflow gap: the published page form now posts through a Next app-origin proxy, supports editing every attendee/seat before submit, and returns an order summary plus check-in codes after completion. Payment collection remains intentionally unfinished, so paid ticket orders are still reservations marked for staff follow-up.

| Surface | Status | Evidence | Notes |
|---|---|---|---|
| Public event page registration section | Working | `app/components/events/public/PublicEventRegistrationForm.tsx`, `EventPageBuilderPreview.tsx` registration-form section | Captures ticket quantity, per-seat attendee names/contact/preferences, consent, estimated total, and displays order status + check-in codes. |
| Public registration app proxy | Working | `app/api/events/public/page/[pageSlug]/register/route.ts` | Browser form submissions stay same-origin and are proxied to `POST /api/events/public/page/:pageSlug/register`. |
| Public registration API | Working | `POST /api/events/public/page/:pageSlug/register` in `server/src/routes/events.ts` | Validates published slug, public active event, active ticket type, deadline, event capacity, ticket capacity, consent, and primary attendee email. |
| Order + guest write-back | Working | Creates `EventOrder`, `EventOrderItem`, `EventGuest`, `Activity`; smoke coverage in `tests/smoke/events-crud.test.ts` | Multi-seat submissions create one check-in row per attendee/seat. |
| Payment collection | Not Implemented | — | Paid tickets are saved as `PENDING` / `DUE`; UI says staff will follow up. Stripe/real payment remains explicitly out of scope. |
| QR camera scanning | Not Implemented | — | Existing check-in code lookup remains text/code based. |

## 2026-05-18 Slice B Start — Public Registration → Check-In Code

This pass starts the ticketing → public registration → check-in lifecycle without adding payment processing. Published event pages can now accept a public registration, create or link the primary registrant as a constituent, create an `EventOrder`, create `EventGuest` check-in rows, and return check-in codes for event-night lookup.

| Surface | Status | Evidence | Notes |
|---|---|---|---|
| Public event page registration section | Working | `app/components/events/public/PublicEventRegistrationForm.tsx`, `EventPageBuilderPreview.tsx` registration-form section | Captures ticket quantity, per-seat attendee info, contact info, consent, dietary/accessibility notes, and displays returned check-in codes. |
| Public registration API | Partially Working | `POST /api/events/public/page/:pageSlug/register` in `server/src/routes/events.ts` | Validates published slug, public active event, active ticket type, deadline, event capacity, ticket capacity, consent, and primary attendee email. |
| Order + guest write-back | Partially Working | Creates `EventOrder`, `EventOrderItem`, `EventGuest`, `Activity`; added smoke coverage in `tests/smoke/events-crud.test.ts` | Uses existing `EventOrder` model, so a primary constituent is required/created. Additional table seats receive placeholder guest names until a full attendee-details step is built. |
| Payment collection | Not Implemented | — | Paid tickets are saved as `PENDING` / `DUE`; UI says staff will follow up. Stripe/real payment remains explicitly out of scope. |
| Public multi-attendee editor | Working | `app/components/events/public/PublicEventRegistrationForm.tsx`, `tests/smoke/events-crud.test.ts` | Public form now renders one editable attendee panel per reserved seat. |
| QR camera scanning | Not Implemented | — | Existing check-in code lookup remains text/code based. |

## 2026-05-18 Slice A — Lifecycle Hardening & Honest Status Sweep

This pass focuses on the **event-first workspace model**: making sure every legacy global tool route redirects to the event selector when no event is chosen, every event-scoped tool advertises its real state, and every "Partially Working" feature carries a popup + banner warning with an explicit removal condition.

### Route status

Status labels are restricted to: **Working / Partially Working / Demo Only / Broken / Not Implemented**.

| Route | Status | Backing API | Notes |
|---|---|---|---|
| `/events` (event-first selector) | Working | `/api/events/dashboard-summary`, `/api/events` | First EventSTUDIO entry now uses the selector surface before staff open scoped event tools. |
| `/events/events` (registry / selector) | Working | `/api/events`, `POST /api/events` | Lists real events; create modal hits real API. |
| `/events/[eventId]/overview` | Working | `/api/events/[id]`, `/guests`, `/orders`, `/tables`, `/sponsors`, `/report` | All command-center cards backed by real per-event data via `Promise.all`. |
| `/events/[eventId]/guests` | Working | `/api/events/[id]/guests` | Scoped by `useParams().eventId`; CRUD + check-in toggle wired. |
| `/events/[eventId]/tables` | Working | `/api/events/[id]/tables` | Table-list, floor-plan, and guest-placement views; create/edit/delete wired. |
| `/events/[eventId]/check-in` | Working | `/api/events/[id]/guests`, `POST /api/events/guests/[id]/check-in`, `/api/events/guests/by-code/[code]` | Search + code lookup + check-in toggle live. |
| `/events/[eventId]/sponsors` | Working | `/api/events/[id]/sponsors` | List + add/edit modal wired; sponsor↔table linking not yet implemented. |
| `/events/[eventId]/tickets` | Working | `/api/events/[id]/ticket-types` | Full CRUD for ticket types including table tickets. |
| `/events/[eventId]/orders` | Working | `/api/events/[id]/orders`, `POST /api/events/orders` | Staff manual orders + status update. Order → auto-create guests is **Not Implemented**. |
| `/events/[eventId]/hosts` | Partially Working | `/api/events/[id]/tables` | Coverage view live; host portal links / invites / audit not implemented. |
| `/events/[eventId]/event-page` | Working | `/api/events/[id]/page-builder-config`, `/api/events/public/page/[slug]`, `POST /api/events/public/page/[slug]/register` | Section editor, autosave, in-app preview, publish/unpublish, explicit payment policy, deployment history, and public multi-attendee registration with check-in codes are wired. QR camera scanning remains a Check-In workspace enhancement, not a page-builder blocker. |
| `/events/[eventId]/communications` (alias `/emails`) | Partially Working | `/api/events/[id]/guests` + central email API | Audience preview + workspace routing live; send execution depends on central comms orchestration. |
| `/events/[eventId]/fundraising` (alias `/donations`) | Partially Working | `/api/events/[id]/orders` | Revenue-vs-goal view exists; pledge tracking and donor-link round-trip not implemented. |
| `/events/[eventId]/follow-up` | Partially Working | `/api/events/[id]/report` | Reads real attendance/revenue; thank-you status not surfaced. |
| `/events/[eventId]/reports` | Working | `/api/events/[id]/report`, `/api/events/[id]/reporting/snapshot`, `/api/events/[id]/reporting/export/:reportType` | Wraps the reports component with scoped event detail, Phase 9 TableLink/check-in reporting slices, and CSV exports. |
| `/events/[eventId]/settings` | Partially Working | `/api/events/manager-integrations` | Donor-CRM integration import works; per-event settings save/load not implemented. |
| `/events/[eventId]/tasks` | Demo Only | — | Scaffolded with zeroed metrics; no task persistence. |
| `/events/[eventId]/volunteers` | Demo Only | — | Scaffolded with zeroed metrics; no volunteer persistence. |
| `/events/[eventId]/files` | Demo Only | — | Scaffolded with zeroed metrics; no file upload backend. |
| `/events/reports` | Working | `/api/events/reports/summary`, `/api/events/[id]/report`, `/api/events/[id]/reporting/snapshot`, `/api/events/[id]/reporting/export/:reportType` | Intentional global cross-event reporting surface with per-event detail and Phase 9 CSV exports. |
| `/events/page-builder` | Working | — | Compatibility entrypoint that redirects `?eventId=` query links to `/events/[eventId]/event-page`. |
| `/events/templates` | Partially Working | `/api/events/templates` | Template draft cloning works; metadata bundle cloning not implemented. |

### Legacy global tool routes — redirect to selector

Per the event-first workspace model (`AGENTS.md` `events-crm-boundary-rules`), the following legacy routes now redirect to `/events/events` when no event is selected. The event-scoped wrappers under `/events/[eventId]/*` continue to work because `useParams().eventId` is populated by the URL.

| Legacy global route | Behavior | Implementation |
|---|---|---|
| `/events/guests` | Redirects to `/events/events` | client `useRouter().replace` + `<RequireEventSelectionNotice />` |
| `/events/tables` | Redirects to `/events/events` | client redirect |
| `/events/check-in` | Redirects to `/events/events` | client redirect |
| `/events/sponsors` | Redirects to `/events/events` | client redirect |
| `/events/fundraising` | Redirects to `/events/events` | client redirect |
| `/events/communications` | Redirects to `/events/events` | client redirect |
| `/events/settings` | Redirects to `/events/events` | client redirect |
| `/events/hosts` | Redirects to `/events/events` | client redirect |
| `/events/follow-up` | Redirects to `/events/events` | client redirect |
| `/events/tickets` | Redirects to `/events/events` | client redirect |
| `/events/orders` | Redirects to `/events/events` | client redirect |
| `/events/tasks` | Server `redirect()` to `/events/events` | server component |
| `/events/volunteers` | Server `redirect()` to `/events/events` | server component |
| `/events/files` | Server `redirect()` to `/events/events` | server component |
| `/events/donations` | Server `redirect()` to `/events/events` | server component (was shim to fundraising) |
| `/events/emails` | Server `redirect()` to `/events/events` | server component (was shim to communications) |

Intentional globals (per `events-crm-boundary-rules`) are **not** redirected: `/events`, `/events/events`, `/events/reports`, `/events/page-builder`, `/events/templates`, `/events/workspace`.

### Warning popups — removal conditions

Each `FeatureStatusWarning` in the Events workspace must carry an explicit condition for when it can be removed:

| Surface | Warning text | Removal condition |
|---|---|---|
| `EventPageBuilderShell` | Removed | Removal criteria met: the builder now has an explicit registration payment policy, deployment history, and smoke coverage for publish-to-registration. |
| `/events/[eventId]/settings` | "Event settings is partially wired" | A per-event settings model exists, save/load round-trip is wired to the API, and a smoke test covers update + reload. |
| `/events/[eventId]/hosts` (existing) | "Table Host Manager is partially working" | Host invite links, resend controls, host portal, and audit events for host actions are implemented and covered by tests. |
| `/events/[eventId]/follow-up` (existing) | "Post-event follow-up is partially wired" | Thank-you status, donor-link round-trip, and follow-up task creation are persisted and reflected in reports. |
| `/events/[eventId]/communications` (existing) | "Event email sending is partially wired" | Scheduling + execution route through central comms with audit + suppression honored; one happy-path send test exists. |
| `/events/[eventId]/fundraising` (existing) | "Event fundraising workflows are partial" | Pledge model + donor-link round-trip + revenue reconciliation tests exist. |
| `/events/[eventId]/tasks` / `volunteers` / `files` (via `EventsWorkspacePage`) | "This Events tool is still being wired" | A real persistence model exists for the tool, and at least one CRUD smoke test is present. |

### Data isolation guarantee

`tests/smoke/events-data-isolation.test.ts` exercises the API contract that the Events CRM relies on: guests, tables, and check-in totals returned for Event A must not appear in Event B. This is the safety net that lets multiple events be live in the same org without cross-event data bleed.

---

## 2026-05-18 Fundraising Command Center Pass

Events CRM is now being shaped around a FundEasy / Attendance-style nonprofit fundraising event workflow without copying FundEasy branding, UI, code, or proprietary design.

| Surface | Release status | Notes |
|---|---|---|
| `/events` module root | Working | Events module home now renders the event-first selector; `/events/events` remains the all-events registry/create page. |
| TopBar overlap in Events shell | Working | Events sidebar and main content now include the fixed TopBar offset. |
| Event-scoped event lock | Working | `/events/[eventId]/*` pages lock to the selected event; switching events requires returning to `/events/events`. |
| Sidebar grouping (V2) | Working | Sidebar now follows: Events -> Selected Event -> Event Command Center -> Event Settings. |
| Events sidebar selected-event tools | Working | Sidebar links now point to canonical `/events/[eventId]/...` routes instead of legacy global query routes. |
| Event command center overview | Working | `/events/[eventId]/overview` now uses a polished purple command-center layout with selected-event header, at-a-glance cards, readiness lanes, and API-backed status sections. |
| Seating workspace views | Working | Tables workspace now provides Floor Plan View, Table List View, and Guest Placement View in event-scoped context. |
| Manager integrations import | Partially Working | Admin-only Events manager integration import endpoint snapshots donor payment/email settings for event operations. |
| Donor-safe follow-up export | Partially Working | Event-scoped follow-up export endpoint supports JSON/CSV queue outputs for post-event workflows. |
| Table Host Manager | Partially Working | Host coverage workspace is available, but host portal links, permissions, guest-list persistence, staff resend controls, and audit coverage are still incomplete. |
| Event Page Builder | Working | Public page composition, publish readiness, payment policy, deployment history, and registration are wired. |
| Emails, Donations/Pledges, Follow-Up | Partially Working / Not Implemented | These are visible with status labels in the command center; current readiness is documented in `docs/status/features.md` and `docs/status/production-readiness-checklist.md`. |
| In-development warning popups | Working | Partially implemented Events tools now show popup + banner warnings so unfinished behavior is visible to staff and reviewers. |

## 2026-05-10 Production Readiness Overrides

For release gating, this document defers to:
`docs/status/production-readiness-checklist.md`

Use these status labels for release decisions:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

Critical overrides from the latest full testing and browser pass:

| Surface | Release status | Why |
|---|---|---|
| Event-scoped guests route (`/events/[eventId]/guests`) | Working | Current code uses guarded event access and authenticated API helpers. |
| Events reports page (`/events/reports`) | Working | Current reports content uses the authenticated request helper. |
| Event workspace selector (`/events`, `/events/workspace`) | Working | Event-first selector model is present at both the module root and compatibility selector route. |
| Event-scoped tool set overall | Partially Working | Core tools exist but several pages remain scaffold/demo-level or unstable under non-happy-path data. |

---

## Status Key

| Status | Meaning |
|---|---|
| ✅ Production Ready | Feature works, tested, no known issues |
| 🟡 Working | Feature works but may lack polish or edge case handling |
| 🔶 Partial | Some parts work, others are stubs or placeholders |
| 🔴 Not Started | Feature does not exist |
| 🚧 In Progress | Actively being built |

---

## Module Shell & Navigation

| Feature | Status | Notes |
|---|---|---|
| Events CRM layout (violet + navy theme) | ✅ Production Ready | `app/events/layout.tsx` |
| EventsSidebar with collapsible sections | ✅ Production Ready | `app/components/layout/EventsSidebar.tsx` |
| Module switcher in TopBar | ✅ Production Ready | TopBar AppsDrawer shows Events CRM |
| Events in AppsDrawer | ✅ Production Ready | `app/components/layout/AppsDrawer.tsx` |

---

## Global vs Event-Scoped Tools

| Feature | Status | Notes |
|---|---|---|
| Event workspace selector (`/events`, `/events/workspace`) | 🟡 Working | Module root and compatibility route both render the selector; `/events/events` remains available for all-events registry management. |
| Scoped workspace routes (`/events/[eventId]/[tool]`) | ✅ Production Ready | Event operations remain tied to selected event context |
| Global tools section in Events sidebar | ✅ Production Ready | Reports, templates, and event registry remain global while event-page editing moved into selected-event command center scope |
| Global page builder route (`/events/page-builder`) | 🟡 Working | Compatibility selector that redirects `eventId` query links to `/events/[eventId]/event-page` |
| Global template route (`/events/templates`) | 🔶 Partial | Template draft cloning works; metadata bundle cloning not yet implemented |

---

## Global Events Dashboard

| Feature | Status | Notes |
|---|---|---|
| Module root selector page | 🟡 Working | `app/events/page.tsx` → `EventsWorkspaceSelectorPage.tsx` |
| Live KPI cards (total/active/upcoming events, guests, revenue) | ✅ Production Ready | Fetches from `/api/events/dashboard-summary` |
| Upcoming events list | 🟡 Working | Shows next 3 upcoming events with date/type |
| Event registry list | 🟡 Working | `app/events/events/page.tsx` |
| Create new event modal | 🟡 Working | `NewEventModal.tsx` — creates via API |
| Search & filter events | 🔶 Partial | Basic filter in EventsRegistryPage; no status filter |
| Event status badges | 🔶 Partial | Active/inactive shown; DRAFT/OPEN/CLOSED not surfaced |

---

## Ticket Types

| Feature | Status | Notes |
|---|---|---|
| Ticket type CRUD UI | ✅ Production Ready | `app/events/tickets/page.tsx` — full create/edit/delete |
| Event selector to scope ticket types | ✅ Production Ready | Dropdown at top of page |
| Individual ticket type | ✅ Production Ready | isTable=false |
| Table ticket type | ✅ Production Ready | isTable=true, seatsIncluded field |
| Min/max per order | ✅ Production Ready | Fields in create/edit form |
| Capacity tracking | 🟡 Working | Shows sold vs capacity; available not auto-decremented |
| Sold count | 🟡 Working | `_count.guests + _count.orderItems` from API |
| Active/inactive toggle | ✅ Production Ready | Toggle button in ticket type card |
| Soft delete (inactive if has orders) | ✅ Production Ready | API handles soft vs hard delete |

---

## Event Orders

| Feature | Status | Notes |
|---|---|---|
| Order list page | 🔶 Partial | `app/events/orders/page.tsx` — basic list exists |
| Create manual order | 🟡 Working | `NewOrderModal.tsx` — constituent + ticket items |
| Order status update | 🟡 Working | PATCH `/api/events/orders/:orderId` |
| Activity logged to constituent timeline | ✅ Production Ready | Auto-logged on order creation |
| Order → auto-create guests | 🔴 Not Started | TODO: when order confirmed, provision guest records |

---

## Guest Management

| Feature | Status | Notes |
|---|---|---|
| Guest list page | 🟡 Working | `app/events/guests/page.tsx` — search, filters, check-in |
| Add guest manually | 🟡 Working | `NewGuestModal.tsx` |
| Constituent linking | 🟡 Working | Can link guest to existing constituent |
| Check-in toggle in guest list | 🟡 Working | PATCH via API |
| Dietary restrictions display | 🟡 Working | Shown in guest list and check-in card |
| Payment status field | 🔶 Partial | Field exists in DB; not surfaced in UI yet |
| RSVP status field | 🔶 Partial | Field exists in DB; not surfaced in UI yet |
| Meal preference field | 🔶 Partial | Field exists in DB; not surfaced in UI yet |
| Check-in code (auto-generated) | ✅ Production Ready | `checkinCode` generated on guest create |
| Party name grouping | 🔶 Partial | Field in DB; no grouping UI yet |
| Seat number within table | 🔶 Partial | Field in DB; not auto-assigned in UI |

---

## Check-In

| Feature | Status | Notes |
|---|---|---|
| Check-in page | 🟡 Working | `app/events/check-in/page.tsx` |
| Event selector / lock behavior | ✅ Production Ready | Global route keeps selector; event-scoped routes lock to selected event and link back to `/events/events` for switching |
| Search by name/email/phone/table | ✅ Production Ready | Filters applied client-side |
| Large volunteer-friendly guest cards | ✅ Production Ready | GuestCheckInCard component |
| Check-in toggle | ✅ Production Ready | POST `/api/events/guests/:id/check-in` |
| Auto-refresh (10s) | 🟡 Working | Optional toggle |
| Progress metrics | 🟡 Working | Checked in / not checked in / total / payment issues |
| QR code scan tab | 🔴 Not Started | Needs camera API or barcode scanner input |
| Check-in by code lookup | ✅ Production Ready | `GET /api/events/guests/by-code/:code` API exists |
| Table browse tab | 🔴 Not Started | Browse guests by table for table-side check-in |
| Walk-in registration | 🔴 Not Started | Add new guest during check-in |

---

## Tables & Seating

| Feature | Status | Notes |
|---|---|---|
| Tables list page | 🟡 Working | `app/events/tables/page.tsx` |
| Create table with number/shape/host | ✅ Production Ready | tableNumber, shape, hostName, isSponsored |
| Edit table | ✅ Production Ready | All fields editable |
| Delete table (unassigns guests) | ✅ Production Ready | API unassigns guests before delete |
| See guests per table | 🟡 Working | Guest count shown; guest names in expanded view |
| Assign guest to table | 🔶 Partial | Can set tableId on guest; no drag-and-drop UI |
| Visual seating chart | 🔴 Not Started | Drag-and-drop floor plan with x/y positions |
| Table capacity warnings | 🔶 Partial | Shown but not enforced |
| Sponsored table badge | ✅ Production Ready | isSponsored displayed in UI |

---

## Sponsors

| Feature | Status | Notes |
|---|---|---|
| Sponsors page | 🔶 Partial | `app/events/sponsors/page.tsx` — exists as workspace stub |
| Sponsor list (real data) | 🔴 Not Started | API exists (`/api/events/:eventId/sponsors`) but UI not wired |
| Add sponsor | 🔴 Not Started | Need create form + API |
| Sponsor packages | 🔴 Not Started | No package/level builder UI |
| Sponsored table assignment | 🔴 Not Started | Link EventSponsor to EventTable |

---

## Fundraising (Event Donations)

| Feature | Status | Notes |
|---|---|---|
| Fundraising page | 🔶 Partial | `app/events/fundraising/page.tsx` — workspace stub |
| Event-linked donations | 🔴 Not Started | Donation model has eventId but no event-specific donation UI |
| Revenue vs goal tracking | 🔶 Partial | revenueGoal on Event model; total from EventOrders in dashboard |

---

## Communications

| Feature | Status | Notes |
|---|---|---|
| Event communications page | 🔶 Partial | `app/events/communications/page.tsx` — workspace stub |
| Event email sending | 🔴 Not Started | No event-specific email campaign workflow |
| RSVP confirmation emails | 🔴 Not Started | |
| Event reminders | 🔴 Not Started | |
| Post-event thank-you emails | 🔴 Not Started | |

---

## Tasks

| Feature | Status | Notes |
|---|---|---|
| Event tasks page | 🔶 Partial | `app/events/tasks/page.tsx` — workspace stub |
| Event-linked tasks in global task system | 🔴 Not Started | Task model has no eventId |

---

## Reports

| Feature | Status | Notes |
|---|---|---|
| Event reports page | 🟡 Working | `app/events/reports/page.tsx` and `EventReportsContent.tsx` use live APIs |
| Guest list export | 🔴 Not Started | Phase 9 adds event reporting exports, but not a full raw guest-list export. |
| Seating report | 🟡 Working | Table completion reporting and CSV export are available from the event report detail view. |
| Check-in report | 🟡 Working | Attendance, walk-in, replacement, no-show, and exception snapshots are available with CSV export. |
| Payment/revenue report | 🟡 Working | Revenue totals and top events are available in summary and event-detail report views |
| Global event reports | 🟡 Working | `/api/events/reports/summary` powers all-events overview |
| Event-specific reports | 🟡 Working | `/api/events/:eventId/report`, `/api/events/:eventId/reporting/snapshot`, and `/api/events/:eventId/reporting/export/:reportType` power per-event deep dive, TableLink/check-in report slices, and CSV exports |

---

## 2026-05-18 EventSTUDIO Page Builder Production Polish

| Feature | Status | Notes |
|---|---|---|
| EventSTUDIO sidebar scoping | ✅ Production Ready | Home/global pages no longer render event-scoped Reports, Event Page, or Settings groups from `?eventId=` query state; scoped tools appear only under `/events/[eventId]/*`. |
| Publish readiness workflow | ✅ Production Ready | Builder header now exposes slug, hero, visitor action, and autosave readiness before staff can publish. |
| New public page blocks | ✅ Production Ready | Auction Preview, Live Appeal, and Volunteer Callout blocks render in preview/published pages and persist through the server section sanitizer. |
| Payment policy and deployment history | ✅ Production Ready | Builder config stores explicit offline/no-payment policy plus publish/unpublish deployment history in the Events page-builder plugin setting. |
| In-app preview | ✅ Production Ready | The top-bar preview opens a fullscreen in-app renderer using the same document component as the public page; no new-tab preview behavior remains. |
| EventSTUDIO naming | ✅ Production Ready | Primary switcher/sidebar/entry surfaces now use EventSTUDIO product naming. |

## Event Page Builder

| Feature | Status | Notes |
|---|---|---|
| Page builder entry point | 🟡 Working | Canonical route is `/events/[eventId]/event-page`; `/events/page-builder` remains compatibility selector |
| Template library | 🔶 Partial | `/events/templates` supports draft template creation from existing events |
| Block-based editor | ✅ Production Ready | Event-scoped section rail, preview, inspector shell, autosave persistence, sanitized block content, and public-page rendering are implemented for the current block catalog |
| Public event registration page | ✅ Production Ready | Published event pages submit single- and multi-attendee registrations, create orders/guests, return check-in codes, and honor explicit offline/no-payment policy |
| Publish/unpublish | ✅ Production Ready | Publish/unpublish persists status, timestamp, readiness gating, and deployment history entries |
| Public page output actions | ✅ Production Ready | Hero, CTA, donation, TableLink, document, volunteer, and share controls render as functional links/actions in the shared public renderer |
| Ticketing + guest provisioning | ✅ Production Ready | Staff orders compute totals from stored ticket prices, consume availability, create guest shells with check-in codes, and propagate order status to guest RSVP/payment state |

---

## Settings & Configuration

| Feature | Status | Notes |
|---|---|---|
| Events settings page | 🔶 Partial | `app/events/settings/page.tsx` — workspace stub |
| Event setup checklist | 🟡 Working | `EventSetupChecklist.tsx` — shows setup progress steps |

---

## Volunteers

| Feature | Status | Notes |
|---|---|---|
| Volunteer page | 🔶 Partial | `app/events/volunteers/page.tsx` — workspace stub |
| Volunteer hour logging | 🟡 Working | VolunteerHour model + API exists globally |
| Event-scoped volunteer assignments | 🔴 Not Started | |

---

## Import / Export

| Feature | Status | Notes |
|---|---|---|
| Guest CSV import | 🔴 Not Started | TODO: add to import field map |
| Guest CSV export | 🔴 Not Started | |
| Order import | 🔴 Not Started | |
| Event field mapping | 🔴 Not Started | `// TODO: add Events to IMPORT_FIELD_MAP in fieldMap.ts` |

---

## DonorCRM Integration

| Feature | Status | Notes |
|---|---|---|
| Activity logged on order create | ✅ Production Ready | EVENT_REGISTRATION activity created |
| Activity logged on guest create (if linked) | ✅ Production Ready | EVENT_REGISTRATION activity created |
| Event attendance on constituent profile | 🔴 Not Started | No events tab on constituent detail |
| New constituent from guest record | 🔴 Not Started | |
| Event-based segmentation | 🔴 Not Started | |

---

## API Coverage

| Endpoint | Status |
|---|---|
| `GET /api/events/dashboard-summary` | ✅ Working |
| `GET /api/events` | ✅ Working |
| `GET/POST/PATCH/DELETE /api/events/:id` | ✅ Working |
| `GET/POST/PATCH/DELETE /api/events/:eventId/ticket-types` | ✅ Working |
| `GET/POST /api/events/:eventId/orders` | ✅ Working |
| `PATCH /api/events/orders/:orderId` | ✅ Working |
| `GET /api/events/guests` | ✅ Working |
| `GET/POST /api/events/:eventId/guests` | ✅ Working |
| `PATCH/DELETE /api/events/guests/:guestId` | ✅ Working |
| `POST /api/events/guests/:guestId/check-in` | ✅ Working |
| `GET /api/events/guests/by-code/:code` | ✅ Working |
| `GET/POST /api/events/:eventId/tables` | ✅ Working |
| `PATCH/DELETE /api/events/tables/:tableId` | ✅ Working |
| `GET/POST /api/events/:eventId/sponsors` | 🔶 Exists but UI not wired |
| `GET /api/events/:eventId/dashboard-summary` | 🔴 Not in API yet |
| Event-specific reports endpoints | ✅ Working |

---

## Known Issues

- Available seat count on TicketType is not auto-decremented when orders are confirmed — manual management needed
- EventGuest.seatNumber is in DB but not auto-assigned when table capacity is managed
- The `/api/events/orders` route must come BEFORE `/:eventId/orders` in Express routing or "orders" is treated as an eventId

---

## Next Implementation Targets

1. Wire sponsors page to real API (GET/POST sponsors)
2. Add QR scan input to check-in page (read code → lookup by checkin code)
3. Add payment status and RSVP status to guest list and edit modal
4. Add event-scoped workspace routing (`/events/[eventId]/`)
5. Add event attendance tab to constituent profile pages
6. Add import field map entries for event data
