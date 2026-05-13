# Production Readiness Checklist

Last updated: 2026-05-13 (2026-05-12 artifact run refresh)

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
| `pnpm lint` | 42 problems (13 errors, 29 warnings) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-lint.log` |
| `pnpm typecheck` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-typecheck.log` |
| `pnpm typecheck:web` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-typecheck-web.log` |
| `pnpm typecheck:server` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-typecheck-server.log` |
| `pnpm test:smoke` | 151 passed, 0 failed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-test-smoke.log` |
| `pnpm test:e2e` | Failed (`ERR_CONNECTION_REFUSED` at `localhost:3650/login`) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e.log` |
| `pnpm test:e2e:mobile` | Failed (404 at `/api/auth/login` on `localhost:3000`) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e-mobile.log` |
| `pnpm test:e2e:livecom` | Failed (`ERR_CONNECTION_REFUSED` at `localhost:3650/login`) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e-livecom.log` |
| `pnpm test` | 337 passed, 0 failed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-test.log` |
| `pnpm test:coverage` | Passed with coverage report | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-test-coverage.log` |
| `pnpm build` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-build.log` |
| `pnpm build:server` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-build-server.log` |
| `pnpm db:generate` | Failed (Windows Prisma DLL rename `EPERM`) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-db-generate.log` |
| `pnpm db:verify:linux-casing` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-db-verify-linux-casing.log` |

Detailed dated reports:

- `docs/status/readiness-audit-2026-05-12.md`
- `docs/status/testing-coverage-audit-2026-05-12.md`
- `docs/status/e2e-coverage-audit-2026-05-12.md`
- `docs/status/smoke-coverage-audit-2026-05-12.md`
- `docs/status/build-and-typecheck-audit-2026-05-12.md`

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
6. DonorCRM stabilization and command-center hardening pass (safe-scope updates).
   - Dashboard: added API-backed stewardship attention widget in `app/components/dashboard/StewardshipAttentionWidget.tsx` and wired in `app/page.tsx`
   - Donor context: removed the prior TopBar identity badge in `app/components/layout/TopBar.tsx` to reduce header clutter while preserving module switcher context
   - Donor IA polish: normalized donor sidebar group label to `People` in `app/components/layout/sidebar-configs.tsx`
   - Documentation: added/updated donor audit and command-center docs (`docs/DONOR_CRM_AUDIT.md`, `docs/DONOR_CRM_STEWARDSHIP_COMMAND_CENTER.md`, `docs/DONOR_CRM_SIDEBAR_NAVIGATION.md`)
7. Donor engagement system integration pass (letters + communications + email builder + steward paths).
   - Communications hub expanded into tabbed donor engagement workspace in `app/communications/page.tsx`
   - Donation quick actions and persisted `Mark Thanked` API flow added via `app/components/donations/DonationTable.tsx`, `app/donations/page.tsx`, and `server/src/routes/donations.ts`
   - Email builder metadata + test-send controls added in `app/components/email-builder/EmailBuilderApp.tsx`
   - Email builder campaign-studio updates added: donor block library categories/search, workflow stages, review checklist tab, grouped merge-field picker, and donor-specific stewardship/compliance blocks
   - Constituent and campaign quick-action linkage added in `app/constituents/[id]/page.tsx` and `app/campaigns/[id]/page.tsx`
   - Steward paths visual language improvements added in `app/automations/page.tsx`
   - Donor engagement architecture/audit docs added: `docs/DONOR_ENGAGEMENT_SYSTEM.md`, `docs/DONOR_CRM_COMMUNICATIONS_AUDIT.md`, `docs/DONOR_CRM_EMAIL_BUILDER.md`, `docs/DONOR_CRM_LETTERS_PRINTABLES.md`
8. Donor grants research workspace pass (grant-first case-file workflow with donation handoff boundary).
   - Grants workspace reframed away from pipeline semantics in `app/grants/page.tsx` and `app/grants/[id]/page.tsx`
   - New case-item UI and APIs for reminders, writing tasks, resources, and requirements: `app/components/grants/GrantCaseItemPanel.tsx`, `server/src/routes/grants.ts`
   - Grant-specific permission keys added and enforced in `server/src/lib/permissions.ts` and grants routes
   - Donations handoff flow for received awards added in `app/donations/new/page.tsx` (no automatic donation creation from grants)
   - Grants audit/workspace docs added: `docs/DONOR_CRM_GRANTS_AUDIT.md`, `docs/DONOR_CRM_GRANTS_RESEARCH_WORKSPACE.md`

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
| Tests cover critical workflows | Partially Working | Smoke is passing (151/151), but current e2e run failed due local service availability mismatch (`localhost:3650`) |
| Lint/type/build pipelines are green | Broken | Typecheck and builds are green, but lint is currently red (13 errors) |
| Prisma client generation is reliable | Broken | `pnpm db:generate` failed on Windows with Prisma engine rename `EPERM` |
| Payment/webhook endpoints are idempotent | Not Implemented | Provider webhooks are not implemented yet |
| Backup/restore process is documented | Not Implemented | Recovery runbook is still missing |
| RBAC is enforced server-side | Partially Working | Coverage exists but not complete for all sensitive endpoints |
| Mobile readiness gate is passing | Broken | `pnpm test:e2e:mobile` failed in this run due auth endpoint mismatch |

## Release Gate Exit Criteria

1. Fix lint errors so `pnpm lint` returns Working.
2. Stabilize E2E runtime contracts (base URL, login route, ports) so all three E2E commands return Working.
3. Resolve Windows Prisma engine lock behavior so `pnpm db:generate` returns Working.
4. Keep release checks green on re-run: lint, all typecheck commands, smoke, all E2E commands, test, coverage, build, build:server, db:generate, and db:verify:linux-casing.
5. Finish workspace-level permission enforcement across donor, compassion, events, and apps scopes.
6. Add idempotent payment/webhook integration coverage.
7. Add and validate backup/restore runbook documentation.
