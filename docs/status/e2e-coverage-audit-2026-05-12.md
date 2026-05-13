# OyamaCRM E2E Coverage Audit (2026-05-12)

Last updated: 2026-05-13
Evidence folder: `docs/status/audit-artifacts/2026-05-12`

## Status

E2E coverage lane: Broken

All three E2E scripts failed before full journey assertions could execute.

## Command Results

| Command | Status | Failure Point |
|---|---|---|
| `pnpm test:e2e` | Broken | `ERR_CONNECTION_REFUSED` at `http://localhost:3650/login` |
| `pnpm test:e2e:mobile` | Broken | Login request to `http://localhost:3000/api/auth/login` returned 404 |
| `pnpm test:e2e:livecom` | Broken | `ERR_CONNECTION_REFUSED` at `http://localhost:3650/login` |

## Effective Journey Coverage

- `ui-production-smoke.mjs`: blocked at first login page navigation.
- `livecom-ui-smoke.mjs`: blocked at first login page navigation.
- `mobile-readiness-audit.mjs`: blocked at auth endpoint mismatch (404 response body was Next not-found HTML).

Practical outcome: E2E did not reach post-auth path coverage with confidence in this run.

## Root Cause Signals

1. Environment/port contract mismatch:
   - Two scripts expect app availability at `localhost:3650`.
2. Auth endpoint contract mismatch for mobile audit:
   - Script expects `/api/auth/login` on `localhost:3000`, but endpoint did not resolve in this runtime.
3. Because failures happened immediately, route-level and workflow-level E2E assertions did not execute.

## Required Fixes Before Re-Audit

1. Define one canonical E2E base URL contract and apply it consistently across all E2E scripts.
2. Confirm the login API path used by E2E scripts matches current runtime architecture (Next/Express proxy behavior).
3. Add preflight checks in each E2E script:
   - app reachable
   - login endpoint reachable
   - expected HTTP status before browser flow starts
4. Re-run all three E2E commands and publish updated dated artifacts.

## Evidence Files

- `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e.log`
- `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e-mobile.log`
- `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e-livecom.log`
