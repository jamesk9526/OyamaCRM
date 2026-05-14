# Full App Test Audit

Date: 2026-05-13

Status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

## Current Testing Stack

- Test runner: Vitest (`tests/**/*.test.ts`)
- API assertions: supertest against `server/src/index.ts`
- Browser automation: Playwright via Node scripts (`tests/e2e/*.mjs`)
- Coverage: V8 via Vitest (`pnpm test:coverage`)
- Existing scripts: smoke, e2e, mobile e2e, livecom e2e
- CI workflow files: Not Implemented (no `.github/workflows/*` found)

## Coverage Audit Matrix

| Area | Current Coverage | Missing Coverage | Test Type Needed | Priority |
|---|---|---|---|---|
| Authentication | Partially Working (`tests/api/auth.api.test.ts`, `tests/e2e/auth.e2e.mjs`, existing smoke auth login) | MFA challenge paths, logout redirect assertions, role matrix breadth | API, E2E | High |
| Donor CRM | Partially Working (donations, grants, reports smoke + unit helpers) | Route-level UI smoke across all donor pages, deeper campaign/communications workflows | Smoke, E2E, API | High |
| Compassion CRM | Partially Working (`tests/smoke/compassion-*`) | Client profile/tabs E2E, privacy boundary negative tests | Smoke, E2E, API | High |
| Events CRM | Partially Working (`tests/smoke/events-crud.test.ts`) | Scoped event workspace E2E and table/check-in UX flows | Smoke, E2E, API | High |
| HRM | Partially Working (`tests/smoke/hrm-api-smoke.test.ts`) | HRM route-load browser smoke and mobile checks | Smoke, E2E, Mobile | Medium |
| Watchdog | Partially Working (`tests/smoke/watchdog-ops-smoke.test.ts`, `tests/api/watchdog.api.test.ts`, `tests/e2e/watchdog.e2e.mjs`) | Break-glass permission override scenario matrix, restore success path E2E | API, E2E, Regression | High |
| WebMaster | Demo Only (limited smoke/readiness references) | Site manager lifecycle E2E + API safety coverage | Smoke, E2E, API | High |
| Standalone apps (`/apps/*`) | Not Implemented for dedicated tests | App-shell and boundary checks for all standalone apps | Smoke, E2E, Mobile | Medium |
| Communications | Partially Working (reports/donations link assertions) | Queue/send guard and draft-first regression assertions | E2E, API, Regression | High |
| Letters & Printables | Partially Working (unit merge/layout coverage) | Queue/state transition API tests and UI E2E | API, E2E | High |
| Steward Paths | Partially Working (unit engine/status tests) | Builder UI interaction E2E and API contract tests | E2E, API | High |
| Reports/Dashboards | Partially Working (reports smoke + some browser checks) | Empty-state chart resilience + export guard checks in browser | Smoke, E2E, Mobile | Medium |
| Imports/Exports | Partially Working (compassion import validator units) | CSV upload + map + dry-run E2E/API tests across donor importer | E2E, API, Regression | High |
| Permissions/Admin/Settings | Partially Working (selected route guards) | Full forbidden matrix per module and sensitive actions | API, Smoke, Regression | High |
| Mobile behavior | Broken/Partially Working (mobile audit existed but auth path mismatch) | Main route-by-route mobile assertions per module + tap target checks | Mobile E2E | High |
| Regression safety lanes | Partially Working (`tests/regression/e2e-contracts.test.ts`) | Privacy boundary, opt-out, duplicate-handoff, destructive guard matrices | Regression | High |

## Existing Reliability Gaps Found

1. E2E defaults were inconsistent (`localhost:3650` vs active local stack); updated to default `localhost:3000`.
2. Mobile audit authenticated against web base path instead of API base; updated to use `E2E_API_BASE_URL` fallback `localhost:4000`.
3. Test scripts did not expose dedicated `unit`, `api`, and `regression` lanes; scripts were added.
4. Fixture storage was sparse; `tests/fixtures/` now has CSV and Watchdog fixture baselines.

## Current Overall Status

- Unit lane: Working
- API lane: Partially Working
- Smoke lane: Partially Working
- E2E lane: Partially Working
- Mobile lane: Partially Working
- Regression lane: Partially Working
