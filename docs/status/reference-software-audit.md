# Reference Software Audit — Galasoft

_Last updated: 2025-05-09_
_Reference project: `REFERANCE_SOFTWARE/GalaSoft/`_

---

## Summary

Galasoft is a React + Node.js event management application reviewed as a **functional reference only** for building OyamaCRM's Events CRM. No Galasoft code, styling, branding, or architecture was copied into OyamaCRM.

---

## What Was Reviewed

| File / Folder | Relevance |
|---|---|
| `backend/schema.sql` | Complete DB schema — guest, table, ticket, sponsor, order models |
| `pages/CheckInDashboard.tsx` | Multi-tab check-in UI (scan, search, tables, nickname) |
| `pages/Dashboard.tsx` | Event command-center KPIs |
| `pages/EventOps/` | Table management, seating, sponsor tools |
| `pages/GuestReg/` | Registration flow, payment capture |
| `pages/Seating/` | Visual floor plan editor |
| `backend/services/registrationService.js` | Order → guest auto-provision logic |
| `components/` | Card, modal, badge patterns (reviewed for feature ideas only) |

---

## Useful Findings

### Guest Model Fields
Galasoft's guest record includes fields that our initial EventGuest model was missing:
- `checkin_code` (unique QR/scan code per guest)
- `payment_status` (PAID / PENDING / COMP / SPONSORED)
- `rsvp_status` (PENDING / CONFIRMED / DECLINED / WAITLIST)
- `meal_preference` (dietary restriction / entree choice)
- `seat_number` (individual seat within a table)
- `party_name` (group name for households / couples)

**Action taken:** Added all these fields to OyamaCRM's `EventGuest` model in Prisma schema.

### Table Model Fields
Galasoft's table record includes:
- `table_number` (integer sequence per event)
- `shape` ("round" | "rectangle" | "banquet")
- `x` / `y` coordinates (for visual seating chart)
- `is_sponsored` (boolean)
- `host_guest_id` (FK to lead sponsor/host guest)

**Action taken:** Added `tableNumber`, `shape`, `xPosition`, `yPosition`, `isSponsored`, `hostName` to OyamaCRM's `EventTable` model.

### Ticket Type Enhancements
Galasoft treats "table of 8" as a ticket type with `seats_included = 8`. Purchasing one table ticket creates 8 guest records.

**Action taken:** Added `isTable`, `seatsIncluded`, `minPerOrder`, `maxPerOrder` to OyamaCRM's `TicketType` model.

### Check-In Tabs
Galasoft's check-in has 4 separate tabs:
1. **Scan** — camera reads QR code, matches `checkin_code`
2. **Search** — search by name/email/phone
3. **Tables** — browse by table, see all guests per table, bulk check-in
4. **Nickname** — search by preferred name / party name

**Action planned:** OyamaCRM check-in has Search tab (working). Scan (by code input or camera) and Tables tabs are planned for Phase 2.

### Registration Service Pattern
`registrationService.js` auto-creates guest records when an order is confirmed:
```
order.confirmed → for each orderItem (ticketType) → create N guests → assign to order
```

**Action planned:** OyamaCRM should adopt this pattern in the order confirmation flow (Phase 2).

### Sponsorship Packages
Galasoft has: package name, price, included seats, logo placement, public recognition flag, early access flag.

**Action planned:** EventSponsor model exists in OyamaCRM; package/level builder is Phase 3.

---

## Ignored

- All Galasoft CSS / Tailwind styles (their visual identity)
- Galasoft React Router structure (different from Next.js App Router)
- Galasoft Vite/PHP backend (not relevant to our Node.js/Express stack)
- Galasoft Playwright e2e test files (caused pre-existing TS errors due to missing `@playwright/test`)
- Galasoft component library (their custom UI primitives)
- Galasoft branding and color palette

---

## Pre-Existing Galasoft TS Errors

Running `tsc --noEmit` from the OyamaCRM root picks up `.ts` / `.tsx` files inside `REFERANCE_SOFTWARE/GalaSoft/vite-project/e2e/`. These produce errors because the Galasoft project never installed `@playwright/test`. These errors:
- Are **not caused by OyamaCRM** code
- Are **pre-existing** in the Galasoft reference folder
- Do **not affect** OyamaCRM build or tests
- Should be **ignored** when evaluating OyamaCRM TypeScript health

To confirm OyamaCRM TypeScript is clean, run:
```
tsc --noEmit --project tsconfig.json
```
from the repo root (which excludes `REFERANCE_SOFTWARE`).

---

## Impact on OyamaCRM

| Area | Change Made | Source Insight |
|---|---|---|
| `prisma/schema.prisma` | 2 new enums, 12+ new fields across 3 models | Galasoft DB schema |
| `server/src/routes/events.ts` | checkin code auto-generation, by-code lookup endpoint | Galasoft check-in service |
| `app/events/tickets/page.tsx` | isTable, seatsIncluded, min/max per order | Galasoft ticket type model |
| `app/events/tables/page.tsx` | tableNumber, shape badge, isSponsored, hostName | Galasoft table model |
| `app/events/check-in/page.tsx` | Search + guest cards foundation; scan tab planned | Galasoft check-in tabs |
| `AGENTS.md` | Reference Software Folder Rules section | Galasoft audit process |
| `docs/plans/events-crm-plan.md` | Full Events CRM plan | Galasoft feature analysis |
| `docs/status/events-crm-status.md` | Feature status matrix | Galasoft feature scope |
