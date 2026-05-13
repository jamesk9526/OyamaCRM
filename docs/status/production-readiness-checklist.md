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

## Donor Engagement Unified System Refactor (2026-05-13)

Phase 1 (audit + docs), Phase 2 (UI relabeling, shared status vocabulary), and Phase 3 partial (shared service contract foundation + unit tests) have landed. Sequence engine cutover, visual builder, and auto-send/branching execution remain in later phases.

| Item | Status | Evidence |
|---|---|---|
| Incremental workspace refactor permission in AGENTS.md | Working | `AGENTS.md` `incremental-workspace-refactor-rules` |
| Unified donor engagement refactor plan | Working | `docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md` |
| Shared engagement status vocabulary helpers | Working | `app/lib/engagement-status.ts` + 10 unit tests in `tests/unit/engagement-status.test.ts` |
| Shared engagement orchestration helpers (delay math, comm-pref checks, branch evaluation) | Working | `app/lib/engagement-orchestration.ts` + 17 unit tests in `tests/unit/engagement-orchestration.test.ts` |
| Communications "Letters" tab → discovery card linking to Letters & Printables | Working | `app/communications/page.tsx` |
| Steward Paths shared status legend with tone palette | Working | `app/automations/page.tsx` |
| Steward Paths `SEND_EMAIL` UI label updated to "Create review-required email" | Working | `app/automations/page.tsx`, `app/components/automations/NewAutomationModal.tsx`, `app/components/automations/AutomationWorkflowEditorModal.tsx` |
| Canonical `/steward-paths` URL (redirect wrapper) | Working | `app/steward-paths/page.tsx` |
| Steward Paths visual builder skeleton (palette/canvas/inspector) at `/steward-paths/builder` | Working | `app/steward-paths/builder/page.tsx`, `app/components/steward-paths/*` |
| Visual builder persistence (save/load) | Not Implemented | Skeleton edits document in memory only; save/run buttons disabled with tooltip |
| Steward Paths real branching / status-change / auto-send | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts`; planned in Phase 5 |
| Sequence engine cutover to shared helpers | Not Implemented | Engine still uses private `addDuration`; planned with the visual builder cutover so parity tests ship together |
| Legacy `stewardPathsEngine.ts` retirement | Not Implemented | Legacy and sequence engines coexist intentionally until parity is confirmed in Phase 3 cutover |

This refactor must follow the new `incremental-workspace-refactor-rules` in `AGENTS.md`: no destructive migration in a single pass, public route compatibility preserved (redirects/wrappers when routes move), draft-first / review-first / opt-out / audit defaults preserved, and no working feature removed until the replacement has equal or better behavior.

## Current Gate Decision

Status: Broken

Recommendation: Do not mark OyamaCRM production-ready yet.

## Migration Incident (2026-05-13)

| Item | Result | Status | Evidence |
|---|---|---|---|
| Prisma migration `20260513144533_add_email_campaign_purpose_and_compliance_models` | Failed with `P3018` / MySQL `1146` because migration referenced lowercase `emailcampaign` while existing table is `EmailCampaign` | Broken | `prisma/migrations/20260513144533_add_email_campaign_purpose_and_compliance_models/migration.sql` |
| Migration fix | Updated migration to alter `EmailCampaign` with exact casing and added dependency note to prior create-table migration (`20260509022557_add_constituent_external_id`) | Working | `prisma/migrations/20260513144533_add_email_campaign_purpose_and_compliance_models/migration.sql` |

Notes:

- No duplicate EmailCampaign table was created.
- If `EmailCampaign` does not exist in an environment, migration order is broken and prior migrations must be applied first.
- Linux/MySQL deployments must preserve exact Prisma-generated table name casing.

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
   - Timeline + communications integration: generated letters and queue actions log Activity events and can create linked EmailCampaign drafts
   - Current status: Partially Working (template authoring, single generation, batch generation, print queue, and mail queue are live; server-side PDF export remains partial)
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
9. OyamaWebMaster command-center foundation pass (safe lifecycle and site metadata model).
   - Store schema evolved additively in `server/src/services/webmaster-store.ts` with site manager metadata fields and launch/publish tracking columns
   - Site lifecycle APIs added in `server/src/routes/webmaster.ts`: site update, archive, restore, duplicate
   - Dashboard upgraded in `app/components/webmaster/WebmasterStarterDashboard.tsx` with site-type filters, search, and lifecycle actions
   - Architecture docs added: `docs/OYAMA_WEBMASTER_REBUILD_PLAN.md`, `docs/OYAMA_WEBMASTER_SITE_TYPES.md`, `docs/OYAMA_WEBMASTER_PUBLISHING_ARCHITECTURE.md`, `docs/OYAMA_WEBMASTER_CRM_INTEGRATION.md`, `docs/OYAMA_WEBMASTER_DATA_SAFETY.md`
10. Donor engagement production-hardening pass for letters and email builder.
   - Letters workflow policy persistence added via `GET/PUT /api/letters/workflow-settings` in `server/src/routes/letters.ts`.
   - Letters workflow settings UI switched from static TODO guidance to API-backed controls in `app/components/letters/LetterWorkflowSettingsPage.tsx`.
   - Email builder review gate now validates merge-token integrity (unknown tokens + malformed braces) in `app/components/email-builder/EmailBuilderApp.tsx`.

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
