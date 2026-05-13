# OyamaCRM Testing Coverage Audit (2026-05-12)

Last updated: 2026-05-13
Primary evidence: `docs/status/audit-artifacts/2026-05-12/pnpm-test.log`, `docs/status/audit-artifacts/2026-05-12/pnpm-test-coverage.log`

## Status

Overall testing coverage lane: Partially Working

Reason:

- Unit + smoke + coverage command passes are Working.
- E2E journey coverage is Broken (covered separately in `docs/status/e2e-coverage-audit-2026-05-12.md`).

## Test Execution Summary

| Command | Status | Result |
|---|---|---|
| `pnpm test` | Working | 30 files, 337 passed, 0 failed |
| `pnpm test:coverage` | Working | 30 files, 337 passed, 0 failed; coverage emitted |
| `pnpm test:smoke` | Working | 13 files, 151 passed, 0 failed |

## Coverage Totals (V8)

From `pnpm test:coverage`:

- Statements: 32.06%
- Branches: 25.37%
- Functions: 38.8%
- Lines: 32.72%

## Coverage Distribution Highlights

### Stronger-Covered Areas

- `app/lib/auth-client.ts`: 92.18% statements
- `server/src/routes/livecom.ts`: 80.74% statements
- `server/src/routes/reports.ts`: 73.66% statements
- `server/src/routes/grants.ts`: 67.07% statements

### Weaker-Covered Areas

- `server/src/routes/steward-ai.ts`: 3.51% statements
- `server/src/routes/steward-signals.ts`: 3.47% statements
- `server/src/routes/watchdog.ts`: 6.66% statements
- `server/src/routes/webmaster.ts`: 6.73% statements
- `server/src/routes/meetings.ts`: 6.01% statements
- `server/src/routes/quickbooks.ts`: 7.69% statements

## Test Surface Observed

The current suite emphasizes:

- Donor workflows (constituents, donations, grants, reports)
- Route smoke stability and key API paths
- Core auth/client utilities

The current suite under-covers:

- Advanced AI/steward route branches
- Watchdog and WebMaster deep flows
- More error and permission branch paths across larger route files

## Gate Interpretation

Testing is not yet releasable as a complete lane because end-to-end user journey checks are not passing in this environment.

## Recommended Follow-Up

1. Restore E2E baseline first (base URL, login endpoint contract, and boot process).
2. Add focused route tests for lowest-covered critical modules (`steward-ai`, `steward-signals`, `watchdog`, `webmaster`).
3. Add branch-path tests for permission denials, empty states, and retry/error handling in large API route modules.
4. Re-run `pnpm test:coverage` and track trend deltas in this dated file format.
