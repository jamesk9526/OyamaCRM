# Production Readiness Checklist

Last updated: 2026-05-12 (evening validation pass)

This file is the release-gate source of truth for production readiness.

## Status Definitions

Use only these status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

## Current Gate Decision

Status: Broken

Recommendation: Do not mark OyamaCRM production-ready yet.

## Latest Validation Run (2026-05-12)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| pnpm test:smoke | 147 passed, 0 failed | Working | 13 test files passed; warning noise from express-rate-limit trust-proxy validation appeared but did not fail tests |
| pnpm test:e2e | Passed (last known) | Working | Latest documented UI production smoke route sweep passed |
| pnpm build | Passed | Working | Next.js build completed and generated all routes |
| pnpm typecheck | Failed | Broken | TS2345 errors in tests/smoke/hrm-api-smoke.test.ts at lines 20 and 25 |
| pnpm lint | Inconclusive in full-repo mode | Partially Working | Lint run is dominated by REFERANCE_SOFTWARE artifact scanning and did not complete in bounded run window |

## Partial Implementations Completed In This Pass

1. Integrations settings upgraded from placeholder to live API-backed diagnostics.
   - Route: app/settings/integrations/page.tsx
   - New component: app/components/settings/integrations/IntegrationsSettingsPage.tsx
   - Live checks: QuickBooks, Site Embeds, Steward AI config, SMTP readiness
2. System status source-of-truth refreshed and standardized.
   - Source data: app/lib/system-status.ts
   - Labels aligned to release statuses: Working, Partially Working, Demo Only, Broken, Not Implemented
3. Production checklist UI now provides explicit done vs not-done tracking.
   - Component: app/components/settings/ProductionReadinessChecklist.tsx
   - Added summary counters and separate Done / Not Done sections
4. Donor CRM Letters & Printables workspace now has live API + UI foundation.
   - Routes: app/letters-printables/* and server/src/routes/letters.ts
   - Timeline + communications integration: generated letters log Activity events and can create linked EmailCampaign drafts
   - Current status: Partially Working (single-letter workflows are live; PDF export and batch generation are explicit partial endpoints)
5. Shared CRM sidebar navigation architecture implemented for core modules.
   - Shared renderer: app/components/layout/CrmSidebar.tsx
   - Config map: app/components/layout/sidebar-configs.tsx
   - Module wrappers: Donor, Compassion, Events, HRM, Watchdog now use grouped config metadata and icon-only collapsed mode
   - Persisted state keys: oyamacrm.sidebar.<module>.collapsed
   - Current status: Partially Working (role-aware visibility is active; front-end fine-grained permission overrides are still TODO)

## Done Now Checklist

| Item | Status |
|---|---|
| Authentication is stable | Working |
| Bulk sends respect opt-outs | Working |
| Public endpoints are rate-limited | Working |
| Version/build metadata is visible in app settings | Working |

## Not Done Yet Checklist (High Impact)

| Item | Status | Notes |
|---|---|---|
| Workspace permissions are enforced | Not Implemented | Module-level workspace policy checks are not consistently enforced |
| Tests cover critical workflows | Partially Working | Smoke and e2e pass, but broader regression depth still needs expansion |
| Lint/type/build pipelines are green | Broken | Build is green, but typecheck fails in HRM smoke typing and lint scope is not stabilized |
| Payment/webhook endpoints are idempotent | Not Implemented | Provider webhooks are not implemented yet |
| Backup/restore process is documented | Not Implemented | Recovery runbook is still missing |
| RBAC is enforced server-side | Partially Working | Coverage exists but not complete for all sensitive endpoints |
| Mobile readiness gate is passing | Partially Working | Shared shells and major data surfaces now have mobile treatments; remaining routes and a clean mobile e2e pass are still required |

## Release Gate Exit Criteria

1. Fix typecheck failure in tests/smoke/hrm-api-smoke.test.ts (unknown to typed argument mismatch at lines 20 and 25).
2. Stabilize lint scope so full lint run completes in bounded CI time (exclude or isolate reference software artifact trees).
3. Keep release checks green on re-run: pnpm test:smoke, pnpm test:e2e, pnpm build, pnpm typecheck, and stabilized lint.
4. Finish workspace-level permission enforcement across donor, compassion, events, and apps scopes.
5. Add idempotent payment/webhook integration coverage.
6. Add and validate backup/restore runbook documentation.
