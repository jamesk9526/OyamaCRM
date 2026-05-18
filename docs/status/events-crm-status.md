# Events CRM — Feature Status

_Last updated: 2026-05-18_

## 2026-05-18 Fundraising Command Center Pass

Events CRM is now being shaped around a FundEasy / Attendance-style nonprofit fundraising event workflow without copying FundEasy branding, UI, code, or proprietary design.

| Surface | Release status | Notes |
|---|---|---|
| `/events` module root | Working | Now uses the same event-first journey hub as `/events/workspace`. |
| TopBar overlap in Events shell | Working | Events sidebar and main content now include the fixed TopBar offset. |
| Event-scoped active event switcher | Working | `/events/[eventId]/*` pages show a compact active-event selector that preserves the current tool on switch. |
| Events sidebar selected-event tools | Working | Sidebar links now point to canonical `/events/[eventId]/...` routes instead of legacy global query routes. |
| Table Host Manager | Not Implemented | Planned major feature; must not be marked ready until host portal links, permissions, guest-list persistence, staff resend controls, and audit coverage exist. |
| Event Page Builder, Emails, Donations/Pledges, Follow-Up | Partially Working / Not Implemented | These are visible with status labels in the command center, but their incomplete state is documented in `docs/STATUS.md`. |

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
| Event workspace selector (`/events/workspace`) | Working | Event-first selector model is present and now matches `/events`. |
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
| Events CRM layout (amber theme) | ✅ Production Ready | `app/events/layout.tsx` |
| EventsSidebar with collapsible sections | ✅ Production Ready | `app/components/layout/EventsSidebar.tsx` |
| Module switcher in TopBar | ✅ Production Ready | TopBar AppsDrawer shows Events CRM |
| Events in AppsDrawer | ✅ Production Ready | `app/components/layout/AppsDrawer.tsx` |

---

## Global vs Event-Scoped Tools

| Feature | Status | Notes |
|---|---|---|
| Event workspace selector (`/events/workspace`) | ✅ Production Ready | Event-first entry for scoped tools with selected event + selected tool routing |
| Scoped workspace routes (`/events/[eventId]/[tool]`) | ✅ Production Ready | Event operations remain tied to selected event context |
| Global tools section in Events sidebar | ✅ Production Ready | Reports, page builder, templates, and event registry are explicit outside selected-event scope |
| Global page builder route (`/events/page-builder`) | 🟡 Working | Sends teams into shared website builder with event context links |
| Global template route (`/events/templates`) | 🔶 Partial | Template draft cloning works; metadata bundle cloning not yet implemented |

---

## Global Events Dashboard

| Feature | Status | Notes |
|---|---|---|
| Dashboard page | 🟡 Working | `app/events/page.tsx` → `EventsDashboard.tsx` |
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
| Event selector | ✅ Production Ready | Dropdown at top of check-in page |
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
| Guest list export | 🔴 Not Started | |
| Seating report | 🔴 Not Started | |
| Check-in report | 🔴 Not Started | |
| Payment/revenue report | 🟡 Working | Revenue totals and top events are available in summary and event-detail report views |
| Global event reports | 🟡 Working | `/api/events/reports/summary` powers all-events overview |
| Event-specific reports | 🟡 Working | `/api/events/:eventId/report` powers per-event deep dive |

---

## Event Page Builder

| Feature | Status | Notes |
|---|---|---|
| Page builder entry point | 🟡 Working | `/events/page-builder` global tool route exists |
| Template library | 🔶 Partial | `/events/templates` supports draft template creation from existing events |
| Block-based editor | 🔴 Not Started | |
| Public event registration page | 🔴 Not Started | |
| Publish/unpublish | 🔴 Not Started | |

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
| Event-specific reports endpoints | 🔴 Not Started |

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
