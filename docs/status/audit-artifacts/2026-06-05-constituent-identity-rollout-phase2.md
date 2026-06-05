# Constituent Identity Rollout Phase 2 Audit

Date: 2026-06-05
Scope: Donor-facing first/last-name rendering expansion beyond the core constituents table, plus server/client helper parity coverage.

## Implemented

- Updated donor-facing render paths to use shared identity display/sort behavior:
  - `app/components/tasks/TaskTable.tsx`
  - `app/components/tasks/NewTaskModal.tsx`
  - `app/components/meetings/MeetingCard.tsx`
  - `app/components/donations/DonationTable.tsx`
  - `app/components/donations/DonationForm.tsx`
  - `app/components/events/NewGuestModal.tsx`
  - `app/components/events/NewOrderModal.tsx`
  - `app/steward-paths/enrollments/page.tsx`
  - `app/components/letters/OyamaLettersWorkspace.tsx`
- Added dedicated server-helper parity tests:
  - `tests/unit/server-constituent-identity.test.ts`

## Behavior notes

- Donor-facing recipient labels now resolve through shared constituent identity rules, including organization display names.
- Letters recipient filtering and required-name checks are identity-aware and no longer assume person-only first/last requirements for organization recipients.
- Steward enrollment labels now avoid exposing identity-helper fallback placeholders to end users.

## Validation evidence

Command:

```bash
pnpm vitest tests/unit/constituent-utils.test.ts tests/unit/server-constituent-identity.test.ts
```

Result:

- Passed: 2 files
- Passed: 23 tests
- Failed: 0

## Residual risk

- Additional donor-facing routes outside this phase's target file set may still contain direct first/last rendering and can be covered in a follow-up sweep.
