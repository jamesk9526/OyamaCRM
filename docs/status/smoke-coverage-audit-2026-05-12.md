# OyamaCRM Smoke Coverage Audit (2026-05-12)

Last updated: 2026-05-13
Evidence file: `docs/status/audit-artifacts/2026-05-12/pnpm-test-smoke.log`

## Status

Smoke coverage lane: Working

Result summary:

- Test files: 13 passed
- Tests: 151 passed
- Failures: 0
- Command exit code: 0

## Smoke Suite Map

| Smoke File | Test Count | Status |
|---|---:|---|
| `tests/smoke/livecom-workflow.test.ts` | 5 | Working |
| `tests/smoke/hrm-api-smoke.test.ts` | 11 | Working |
| `tests/smoke/site-embeds-smoke.test.ts` | 7 | Working |
| `tests/smoke/events-crud.test.ts` | 13 | Working |
| `tests/smoke/critical-hardening.test.ts` | 6 | Working |
| `tests/smoke/reports-smoke.test.ts` | 37 | Working |
| `tests/smoke/compassion-appointments-workspace.test.ts` | 6 | Working |
| `tests/smoke/grants-crud.test.ts` | 21 | Working |
| `tests/smoke/compassion-public-scheduling-smoke.test.ts` | 8 | Working |
| `tests/smoke/feedback-ticketing-smoke.test.ts` | 3 | Working |
| `tests/smoke/routes-workflow.test.ts` | 15 | Working |
| `tests/smoke/api-smoke.test.ts` | 8 | Working |
| `tests/smoke/donations-crud.test.ts` | 11 | Working |

## Warning Signal (Did Not Fail Lane)

Repeated warning during smoke run:

- `ERR_ERL_PERMISSIVE_TRUST_PROXY`

Interpretation:

- The suite still passed.
- The warning should be treated as a deployment policy/security configuration review item, not ignored as noise.

## Confidence Statement

Smoke coverage confirms broad API workflow viability for this environment at the route and core flow level.

It does not replace E2E journey validation, which remains Broken in this audit pass.

## Recommended Follow-Up

1. Keep smoke lane as mandatory pre-merge gate.
2. Add explicit environment-aware handling or assertions for trust-proxy/rate-limit config to reduce repeated warning noise.
3. Pair smoke pass with restored E2E pass before any production-ready claim.
