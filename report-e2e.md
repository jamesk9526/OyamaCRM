# Test Execution Report (E2E, Smoke, and Other Lanes)

Date: 2026-05-13
Workspace: OyamaCRM

## Summary

- Commands run: 13
- Passed: 6
- Failed: 7

## Command Results

| Command | Status | Notes |
|---|---|---|
| `pnpm test:smoke` | PASS | 14 files, 159 tests passed. |
| `pnpm test:smoke:routes` | FAIL | Route smoke failures; several authenticated routes redirected to `/login` (for example `/watchdog/backups`, `/watchdog/restore`, `/webmaster`, `/apps`, `/apps/trivia`). |
| `pnpm test:smoke:critical` | PASS | 6 tests passed. |
| `pnpm test:smoke:livecom` | PASS | 5 tests passed. |
| `pnpm test:e2e` | PASS | Production smoke routes passed. |
| `pnpm test:e2e:auth` | FAIL | Login email input not visible. |
| `pnpm test:e2e:watchdog` | FAIL | Authenticated watchdog route redirected to login: `/watchdog`. |
| `pnpm test:e2e:setup-watchdog` | FAIL | Auth login failed with `429 Too many requests` (rate limiting). |
| `pnpm test:e2e:mobile` | FAIL | Mobile audit login failed with `429 Too many requests` (rate limiting). |
| `pnpm test:e2e:livecom` | FAIL | Timed out waiting for login redirect (did not leave `/login` within 45s). |
| `pnpm test:unit` | FAIL | 253 passed, 1 failed (`tests/unit/navigation-boundaries.test.ts`: expected `reportit`, got `oshareview`). |
| `pnpm test:api` | PASS | 8 tests passed. |
| `pnpm test` | FAIL | 421 passed, 2 failed: `navigation-boundaries.test.ts` mismatch (`reportit` vs `oshareview`) and one smoke assertion in `tests/smoke/donations-crud.test.ts`. |

## Key Failure Themes

1. Authentication/session setup instability in E2E lanes
- Multiple E2E flows fail due to login visibility/redirect issues.
- Rate limiting (`429`) blocked setup-watchdog and mobile E2E login paths.

2. Route smoke expectations vs auth behavior
- Route smoke checks expected direct route availability but got `/login` redirects.

3. Test expectation drift after module-key rename
- `reportit` to `oshareview` rename breaks unit assertion in navigation-boundaries test.

4. One smoke assertion failure in full `pnpm test`
- A donation loop artifact expectation did not include the expected task ID.

## Notes

- `TopBar.tsx` parse error was fixed first so tests could execute.
- This report records run results exactly as observed; no failing tests were changed in this run.
