# OyamaCRM Readiness Audit (2026-05-12)

Last updated: 2026-05-13
Artifact folder: `docs/status/audit-artifacts/2026-05-12`
Execution window (UTC): 2026-05-13T04:18:36Z to 2026-05-13T04:20:48Z

## Status Labels

This audit uses only:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

## Executive Gate Decision

Overall release gate: Broken

Reason:

- Lint failed with 13 errors.
- All three E2E lanes failed before meaningful browser assertions.
- `pnpm db:generate` failed on Windows with a Prisma engine DLL rename `EPERM` error.

## Command Matrix

| Command | Exit Code | Status | Evidence Summary |
|---|---:|---|---|
| `pnpm lint` | 1 | Broken | 42 problems total (13 errors, 29 warnings). |
| `pnpm typecheck` | 0 | Working | Web + server typecheck pass. |
| `pnpm typecheck:web` | 0 | Working | `tsc --noEmit` pass. |
| `pnpm typecheck:server` | 0 | Working | `tsc --project server/tsconfig.json --noEmit` pass. |
| `pnpm test:smoke` | 0 | Working | 13 files, 151 passed, 0 failed. |
| `pnpm test:e2e` | 1 | Broken | `ERR_CONNECTION_REFUSED` at `http://localhost:3650/login`. |
| `pnpm test:e2e:mobile` | 1 | Broken | Login call to `http://localhost:3000/api/auth/login` returned 404. |
| `pnpm test:e2e:livecom` | 1 | Broken | `ERR_CONNECTION_REFUSED` at `http://localhost:3650/login`. |
| `pnpm test` | 0 | Working | 30 files, 337 passed, 0 failed. |
| `pnpm test:coverage` | 0 | Working | Coverage generated; all tests passed in coverage run. |
| `pnpm build` | 0 | Working | Next.js build passed; static generation completed. |
| `pnpm build:server` | 0 | Working | Server TypeScript build passed. |
| `pnpm db:generate` | 1 | Broken | Prisma engine rename `EPERM` on `query_engine-windows.dll.node`. |
| `pnpm db:verify:linux-casing` | 0 | Working | Migration casing verification passed. |

Source: `docs/status/audit-artifacts/2026-05-12/command-summary.jsonl`

## Key Failures

### 1) Lint Lane (Broken)

`pnpm lint` reported 13 errors and failed the gate. High-signal examples:

- `@typescript-eslint/no-explicit-any` in multiple route files (`server/src/routes/events.ts`, `server/src/routes/meetings.ts`, `server/src/routes/steward-ai.ts`, `server/src/routes/watchdog.ts`).
- `react-hooks/preserve-manual-memoization` in `app/components/layout/TopBar.tsx`.
- `react-hooks/set-state-in-effect` in `app/components/settings/integrations/IntegrationsSettingsPage.tsx`.
- `@typescript-eslint/no-unused-vars` in `app/components/settings/tabs/IntegrationsTab.tsx`.

Evidence: `docs/status/audit-artifacts/2026-05-12/pnpm-lint.log`

### 2) E2E Lanes (Broken)

All three E2E scripts failed before deeper journey validation:

- `test:e2e`: app URL `http://localhost:3650/login` not reachable.
- `test:e2e:livecom`: same unreachable `localhost:3650` login.
- `test:e2e:mobile`: login endpoint expectation mismatch (`/api/auth/login` on `localhost:3000` returned 404).

Evidence:

- `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e.log`
- `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e-livecom.log`
- `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e-mobile.log`

### 3) Prisma Client Generation (Broken)

`pnpm db:generate` failed with Windows filesystem lock behavior:

- `EPERM: operation not permitted, rename ...query_engine-windows.dll.node.tmp* -> ...query_engine-windows.dll.node`

Evidence: `docs/status/audit-artifacts/2026-05-12/pnpm-db-generate.log`

## Passing Evidence

- Typecheck lane is green (`pnpm typecheck`, web, and server).
- Build lanes are green (`pnpm build`, `pnpm build:server`).
- Smoke lane is green (151/151).
- Full test lane is green (337/337).
- Coverage lane is green and produced report (`All files: 32.06% statements, 25.37% branches, 38.8% functions, 32.72% lines`).

## Non-Gating Warning Observed

Smoke and full test runs repeatedly logged:

- `ERR_ERL_PERMISSIVE_TRUST_PROXY` (express-rate-limit validation warning)

The warning did not fail tests, but it is operationally significant and should be explicitly handled per environment policy.

## Linked Dated Audits

- `docs/status/testing-coverage-audit-2026-05-12.md`
- `docs/status/e2e-coverage-audit-2026-05-12.md`
- `docs/status/smoke-coverage-audit-2026-05-12.md`
- `docs/status/build-and-typecheck-audit-2026-05-12.md`

## Recommended Next Sprint (Release Blocking Sequence)

1. Fix lint errors to return `pnpm lint` to Working.
2. Standardize E2E runtime contract (base URL/ports/auth endpoint) and rerun all three E2E lanes.
3. Resolve Windows Prisma engine lock condition so `pnpm db:generate` is reliable in local and CI contexts.
4. Re-run the full 14-command audit and replace this report only after all blockers are retested.
