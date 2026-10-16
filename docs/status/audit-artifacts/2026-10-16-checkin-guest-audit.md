# Check-in and guest management audit — 2026-10-16

Scope: staff check-in search/scan, duplicate attendance, reversals, walk-in and replacement registration, exception queue boundaries, and guest invitation completion. No production data was changed.

## Fixed

- Attendance records were written before the guest/seat transaction. A later failure could leave attendance recorded while the guest was not checked in. All three writes now share one transaction.
- Two desks could both pass the active-record check. A conditional guest update now claims the attendance transition before recording success; subsequent attempts are audited as duplicates. The same protection covers legacy/imported guests already marked checked in.
- Imported or legacy checked-in guests without an attendance record could not be reversed. Reversal now clears their checked-in state and creates a reversed audit record preserving their arrival timestamp. Reversal also closes all prior active records rather than only the latest record.
- Walk-ins selecting a table previously received only a table reference. Registration now selects an actual open seat, synchronizes missing seat rows, checks capacity, and saves guest/seat together. Invalid or occupied seats and foreign-event tables are rejected before guest creation. A concurrent claim on the seat returns a recoverable seating conflict. Replacement registration uses the same lifecycle through the route integration.
- Exception resolve/dismiss now require matching event and organization. Exception creation verifies optional guest/table/seat references belong to the event and that an explicit seat belongs to the claimed table.
- Check-in UI now displays failed searches, refreshes, and exception actions, shows failed rows from partial bulk check-in, prevents repeated walk-in/replacement clicks during submission, and refreshes guest/table attendance alongside live counters.
- Shared route integration validates table bulk-check-in membership and removes duplicate requested guest IDs.

## Validation

- `pnpm exec vitest run tests/unit/event-checkin-service.test.ts tests/unit/event-checkin-exceptions.test.ts tests/unit/event-guest-lifecycle.test.ts`: 25 tests passed.
- Focused ESLint: zero errors; the check-in page retains two existing hook dependency warnings.
- `pnpm typecheck:server`: passed, including the final exception creation validation.
- Web typecheck initially reported a concurrently edited trivia test type error; final combined verification is reported by the coordinating task.
- Local mocked service tests verify the failure paths and transaction boundaries; actual simultaneous database requests and check-in browser flows were not exercised in this sub-audit.

## Remaining gaps

- `guest-invite-service.ts` creates or updates a guest before the transaction that completes the invite. Concurrent token submissions can create duplicate/orphan guests; failure completing the invite can leave the guest saved. Invite completion should claim the token and save the guest, seat, and completion record atomically with retry/idempotency coverage.
- Invites without a preferred seat currently attach a table reference without choosing an actual seat. This should use the same capacity-aware placement contract as staff registration.
- Walk-in/replacement guest creation and attendance recording remain separate route operations. The attendance service itself is atomic, but a later check-in failure can leave a registered unchecked guest. A future combined transaction or idempotent registration request should cover this boundary.
- Replacement registration creates an additional attendee; it does not identify and cancel an original guest. The current screen has no original-attendee selector. A complete substitution workflow requires a deliberate product/data decision.
- Guest creation still uses the existing random check-in code generator and has no general request idempotency key. Database uniqueness protects codes and seat assignment; a network retry after a successful registration can create another unassigned guest.
