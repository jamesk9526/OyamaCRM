# Events CRM — Master Plan

_Last updated: 2025-05-09_

---

## Executive Summary

The Events CRM is a first-class module inside OyamaCRM that gives nonprofits a full event-management platform alongside DonorCRM and Compassion CRM. It covers the entire event lifecycle: create event → configure ticket types → collect registrations → manage guests and seating → run check-in on event night → report results → sync activity to constituent timelines.

The module uses an **amber accent** (amber-600) to distinguish it visually from DonorCRM (green-600) and Compassion CRM (blue-600).

---

## Galasoft Reference Audit

Galasoft was reviewed as a functional reference. Key concepts borrowed (conceptually, not visually):

| Feature | Galasoft Approach | OyamaCRM Adaptation |
|---|---|---|
| Guest model | ticket_type, payment_status, rsvp_status, checkin_code, meal_preference, seat_number, party_name | Added all these fields to EventGuest in Phase 1 |
| Check-in modes | QR scan, code entry, search, table browse, name/nickname tabs | Check-in page already has search; QR scan tab planned in Phase 2 |
| Ticket types | individual, table-of-N, comp, sponsored | TicketType now has isTable, seatsIncluded, ticketCategory |
| Table model | table_number, shape, x/y position for visual chart, host | EventTable now has tableNumber, shape, xPosition, yPosition, hostName, isSponsored |
| Registration service | transactional, auto seat assignment within tables | Planned for order → guest auto-creation flow |
| Table invites | tokenized link for table host to invite their guests | Planned Phase 3 (invitation tokens) |
| Sponsorships | packages with included seat counts | EventSponsor model exists; seating integration Phase 3 |
| Notifications | outbox with retry (queued email/SMS) | Existing email campaign system; event-specific notifications Phase 3 |

**Ignored from Galasoft:** visual theme, CSS, PHP backend, React Router patterns, Vite config, Playwright e2e structure.

---

## Architecture

### Module Identity
- Routes: `/events/*`
- Shell: `EventsLayout` + `EventsSidebar` (amber theme)
- Module switcher: shows Events CRM alongside DonorCRM and Compassion CRM in TopBar

### Event-Scoped Workspace (Planned)
Currently all event tools are global (no `[eventId]` in the URL). Phase 2 will add:
```
/events/[eventId]/overview
/events/[eventId]/tickets
/events/[eventId]/orders
/events/[eventId]/guests
/events/[eventId]/tables
/events/[eventId]/seating
/events/[eventId]/check-in
/events/[eventId]/sponsors
/events/[eventId]/communications
/events/[eventId]/tasks
/events/[eventId]/reports
/events/[eventId]/settings
```

### Shared Person Layer
Guests may or may not be linked to Constituent records:
- `EventGuest.constituentId` links to an existing constituent
- Unlinked guests are independent (walk-ins, plus-ones, etc.)
- Staff can link/unlink guests to constituents post-hoc
- Event registrations create Activity records on constituent timelines when linked

---

## Data Model (Current)

### Event
Full model with: name, description, type, status (DRAFT/OPEN/CLOSED/CANCELLED/COMPLETED), visibility, location, dates, capacity, revenueGoal, owner, active.

### TicketType
Per-event ticket definitions: name, description, price, capacity, available, sortOrder, active.
**New fields:** `isTable` (table ticket), `seatsIncluded` (guests per ticket), `minPerOrder`, `maxPerOrder`.

### EventOrder
Purchase record linking a Constituent to an Event with line items and payment tracking.

### EventGuest
Attendee record for a specific event.
**New fields:** `checkinCode` (unique QR/code), `paymentStatus` (PAID/DUE/PENDING_CHECK/COMP/SPONSORED), `rsvpStatus` (PENDING/CONFIRMED/DECLINED/WAITLIST), `mealPreference`, `seatNumber`, `partyName`.

### EventTable
Seating table for an event.
**New fields:** `tableNumber` (int), `isSponsored`, `hostName`, `xPosition`, `yPosition`, `shape`.

### EventSponsor
Sponsorship record: level, amount, benefits, logo, website. Linked to a Constituent.

---

## Delivery Phases

### Phase 1 — Foundation ✅ DONE
- Events CRM module shell (amber layout, sidebar, module switcher)
- Event list, create/edit, dashboard with real API data
- Ticket types: full CRUD UI (list, create, edit, toggle active)
- Guests: list, add, check-in toggle, constituent linking, filtering
- Tables: list, create with tableNumber/shape/isSponsored, edit, delete, guest assignment
- Check-in: event selector, search, progress metrics, guest cards, auto-refresh
- Schema: EventGuest + TicketType + EventTable extended with new fields
- API: check-in code auto-generation, `GET /api/events/guests/by-code/:code`
- Activity logging: registrations → constituent timeline

### Phase 2 — Event-Scoped Workspace
- Add `app/events/[eventId]/` routing structure
- Event workspace shell: always shows current event name in breadcrumb/header
- Event-specific sidebar that shows tools scoped to selected event
- Overview page per event (KPIs, action items, readiness score)
- Upgrade check-in with QR scan tab (browser camera API or input field)
- Visual seating chart (drag-and-drop guests onto tables)
- Order → auto-create-guests flow (when order is confirmed, guests are auto-provisioned)

### Phase 3 — Registration & Public Pages
- Table host invite tokens (unique link to register party guests)
- Self-registration flow (public event registration form)
- Event page builder (blocks: hero, ticket purchase, schedule, sponsors, FAQ, map)
- RSVP confirmation emails
- Meal count export

### Phase 4 — Reporting + DonorCRM Integration
- Event-specific reports: ticket sales, guest list, seating report, check-in report, payment report
- Global event reports: revenue across events, attendance trends, donor conversion from events
- Surface event attendance on constituent profiles (new tab: "Events")
- Segment donors by event attendance
- New constituent creation from guest list (bulk link or create)

### Phase 5 — Advanced
- Auction/fish-race/raffle module (optional add-on)
- Printable materials: name badges, table cards, guest lists, seating charts
- Walk-in registration during check-in
- Childcare tracking
- Event-specific automation rules

---

## Implementation Priorities (Now)

1. **[NOW]** Verify ticket types CRUD works end-to-end with real events
2. **[NOW]** Verify check-in code is generated and `by-code` lookup works
3. **[NEXT]** Add `app/events/[eventId]/` workspace shell with event breadcrumb
4. **[NEXT]** Add visual seating chart (Phase 2)
5. **[NEXT]** Wire sponsors page to real API
6. **[NEXT]** Wire fundraising page to event donations/pledges

---

## Known Unknowns

- How should table-ticket purchase create individual guests? (auto-provision N guests per table order vs manual entry)
- Should checkin codes be shown as QR codes in the UI? (need a QR library like `qrcode.react`)
- How should event donations differ from regular DonorCRM donations? (currently EventOrder is separate from Donation model)
- Should a constituent's event history show on their DonorCRM profile? (yes, via Activity timeline)

---

## Import Mapping TODOs

- `// TODO: add Events to import field map` in `app/data-tools/import/fieldMap.ts`
- CSV fields to map: Guest Name, Email, Phone, Table Number, Ticket Type, Checked In, Payment Status, RSVP Status, Meal Preference
- Guest import should auto-match to existing constituents by email
- Order import from other event systems (Eventbrite, Cvent, etc.) — future

---

## Next Steps

1. Build event-scoped workspace (`/events/[eventId]/`) with breadcrumb
2. QR scan tab in check-in (use checkinCode field now in DB)
3. Wire sponsors page to `/api/events/:eventId/sponsors`
4. Wire fundraising page to event-linked donations
5. Add event attendance tab to constituent profiles
6. Create global event reports page
7. Begin Phase 3 (public registration / table invite tokens)
