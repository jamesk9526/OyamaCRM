# Production Readiness Checklist

Last updated: 2026-05-12

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

## Latest Validation Run (2026-05-11)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| pnpm test:smoke | 143 passed, 0 failed | Working | Tests executed across 13 smoke files |
| pnpm test:e2e | Passed | Working | UI production smoke route sweep passed with exit code 0 |
| pnpm build | Failed | Broken | Type error at app/compassion/settings/page.tsx:601 (AppointmentWidgetConfig cast) |

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
| Lint/type/build pipelines are green | Broken | Production build currently fails in Compassion settings typing |
| Payment/webhook endpoints are idempotent | Not Implemented | Provider webhooks are not implemented yet |
| Backup/restore process is documented | Not Implemented | Recovery runbook is still missing |
| RBAC is enforced server-side | Partially Working | Coverage exists but not complete for all sensitive endpoints |
| Mobile readiness gate is passing | Partially Working | Shared shells and major data surfaces now have mobile treatments; remaining routes and a clean mobile e2e pass are still required |

## Release Gate Exit Criteria

1. Fix build failure in app/compassion/settings/page.tsx type conversion logic.
2. Keep release checks green on re-run: pnpm test:smoke, pnpm test:e2e, pnpm build.
3. Finish workspace-level permission enforcement across donor, compassion, events, and apps scopes.
4. Add idempotent payment/webhook integration coverage.
5. Add and validate backup/restore runbook documentation.
