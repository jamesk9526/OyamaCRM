# Event guest and seating fixes — October 16, 2026

## Verified behavior

- Floor plan, table cards, placement selectors, and summary totals count guests with an actual numbered seat. An eight-seat table with one seated guest and four legacy table-only links shows **1 seated / 7 open**. Legacy links remain visible as guests awaiting a seat; no records are deleted to correct the display.
- Clear removes the table, seat, and seat-number association. The page refreshes its roster and the guest becomes available in the unassigned dropdown. The browser fixture clears and then reseats the same guest.
- Guest List has a prominent Add Guest button and an explicit empty state. Successful registration clears roster filters so the new attendee is visible; failed loads and saves are visible with recovery controls.
- Ticket options load independently of constituent lookup permissions. New manual guests can receive a ticket; existing guests have Assign Ticket / Change Ticket actions. Ticket load retry, save failure recovery, removal, and re-assignment were exercised in the browser. The server rejects inactive, missing, or foreign-event ticket assignments.
- Ticket assignment sets the attendee's category; it does not record payment, create an order, or sell additional table/couple tickets. The form makes the Orders workflow explicit.
- Double-click a floor-plan table, then choose Rename Table. The rename request updates only the name, and server validation preserves seating, capacity, identifiers, and table number. List view also retains Edit / Rename.

## Validation

### Table-opening regression follow-up

The initial browser fixture incorrectly supplied a top-level `guests` array in TableLink details, although the actual authenticated endpoint returned only `seats[].guest`. Calling the new occupancy helper on that response crashed with `Cannot read properties of undefined (reading 'filter')`. The authenticated endpoint now includes table-linked guests and their count. The UI also reconstructs the guest list from seat relations when talking to an older backend, retaining correct numbered-seat counts. Public TableLink payloads are unchanged.

The API contract regression failed against the old endpoint and passed after the fix. All 18 focused table occupancy/API tests passed, and the browser fixture now opens, clears, and reseats tables using both complete and older table-detail responses with zero page errors.

The affected unit and isolated route suites use mocked persistence, including real Express request dispatch for ticket assignment, rename validation, and bulk check-in membership. Final combined Events/Trivia verification passed **116 tests across 18 files**. Web and server typechecks passed; changed-file lint reported zero errors and two existing check-in hook warnings.

Browser command (installed Microsoft Edge):

```powershell
$env:E2E_BROWSER_CHANNEL = 'msedge'
node tests/e2e/events-guest-operations-fixture.e2e.mjs
```

This bundles the real React pages/components and application CSS and supplies deterministic local API fixtures. It covers 1440-pixel desktop and 390-pixel mobile flows, including denied optional constituent access, with zero browser page errors and no mobile page-level horizontal overflow. The guest table scrolls horizontally within its container on small screens.

Screenshots: [guest list desktop](guest-list-desktop.png), [seat roster and floor plan](table-seating-desktop.png), [guest list mobile](guest-list-mobile.png).

No production records, communications, payments, imports, or deployments were changed. Actual MySQL persistence/concurrency, provider callbacks, and live site deployment were not verified by these fixtures.

Related audits: [check-in and guest management](../2026-10-16-checkin-guest-audit.md), [orders, reporting, and seat synchronization](../2026-10-16-events-system-audit.md).
