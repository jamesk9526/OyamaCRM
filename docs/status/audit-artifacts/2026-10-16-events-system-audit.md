# Event registration, inventory, and reporting audit — October 16, 2026

Scope: source inspection of staff/public registration, orders, ticket inventory,
table services, and reporting. Separate agents cover check-in/guest management
and TriviaNight. This artifact does not claim a full production audit.

## Fixed and reproduced with isolated regressions

- **Duplicate staff order ticket rows bypassed ticket capacity.** Two rows of
  three tickets each passed a five-ticket capacity because each row was checked
  separately. `normalizeEventOrderItems` now combines rows before validation,
  pricing, inventory reservation, and guest provisioning.
- **Staff order inventory could oversell concurrently.** Capacity counts were
  read outside the order transaction, and available inventory was decremented
  without a lower-bound condition. Counts now run in a serializable transaction;
  inventory reservation uses a conditional decrement. Inventory conflicts and
  serialization collisions return HTTP 409 with actionable messages.
- **Reporting trusted stale seat statuses.** An empty seat left CONFIRMED or
  CHECKED_IN inflated table completion; a confirmed guest linked to an EMPTY
  seat was missed. Reporting now counts actual seat-linked guests whose RSVP is
  confirmed or who are checked in. Table-only associations do not count as
  completed numbered seats.
- **Seat synchronization missed gaps and could duplicate numbers after a
  capacity change.** It inferred new seat numbers from row count even when an
  occupied high-number seat had been retained during a shrink. Synchronization
  now fills missing numbers in `1..capacity` and removes only empty seats above
  capacity. Assigned seats retain their identifiers, guest links, and numbers.

Validation: all seven manual-order regressions, both reporting regressions, and
four seat-synchronization regressions pass (13 total). Three synchronization
tests failed against the old algorithm. The reporting tests failed on the old
calculation; the initial five order tests failed on the old route. Focused ESLint
and server typecheck pass. Tests use
mocked persistence; no production records, payments, or communications were
created. Real MySQL concurrent transaction behavior remains untested here.

## Verified source gaps left for focused follow-up

1. **Cancellation/refund does not release inventory or seating.**
   `PATCH /api/events/orders/:orderId` updates the order and guest RSVP/payment
   state, but does not restore ticket availability, remove seat associations, or
   clear seat status. Public/staff ticket-unit queries include cancelled/refunded
   order items, and event capacity queries count all guests. A cancelled order
   therefore continues consuming registration capacity. Resolving this safely
   requires an explicit policy for cancellation, refund, reinstatement, and
   repeat requests, with transactional lifecycle tests.
2. **Staff table-ticket orders do not provision a table.** Public registration
   creates a table and numbered seats for a table ticket; staff order creation
   provisions guests without a table even though it loads `isTable`. This is a
   verified workflow difference, not a claim that automatic table creation is
   always desired. Provide an explicit staff table-assignment step or define the
   intended provisioning policy before changing this behavior.

## Review boundaries

- Public registration already uses serializable persistence, a conditional
  availability decrement, request replay handling, and signed-payment follow-up;
  this audit did not replace those paths.
- Public/staff organization and event checks were inspected on the sampled
  registration/order paths. No full authorization or penetration test was run.
- Live browser registration, payment-provider callbacks, email delivery,
  production data reconciliation, and deployment are outside this verification.
