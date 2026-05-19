# Production Readiness Checklist

Last updated: 2026-05-18 (v1.1.0 — help search engine improvements, EventSTUDIO polish, 35+ new help articles, full feature inventory, route-context expansions)

This file is the release-gate source of truth for production readiness.

## Status Definitions

Use only these status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

## Production Pass Phase 1/2 Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Central partial implementation audit established | Working | `docs/status/PARTIAL_IMPLEMENTATION_AUDIT.md` |
| CRM-wide readiness matrix established | Working | `docs/status/PRODUCTION_READINESS_MATRIX.md` |
| Events sidebar now avoids known dead event-scoped routes | Working | `app/components/layout/sidebar-configs.tsx` |
| EventSTUDIO sidebar scoping and page-builder production readiness | Working | `app/components/layout/sidebar-configs.tsx`, `app/components/events/page-builder/*`, `server/src/routes/events.ts`, `tests/smoke/events-crud.test.ts` |
| EventSTUDIO ticketing, guest provisioning, and TableLink public tests | Working | `server/src/routes/events.ts`, `tests/smoke/events-crud.test.ts`, `tests/api/events-tablelink-public.api.test.ts`, `tests/e2e/events-public-page-builder.e2e.mjs` |
| Compassion primary sidebar no longer exposes placeholder Tasks route | Working | `app/components/layout/sidebar-configs.tsx`, `app/compassion/tasks/page.tsx` |
| Settings landing page no longer links to placeholder Events settings card | Working | `app/settings/page.tsx`, `app/settings/events/page.tsx` |
| Campaign and communications route-level browser dialogs replaced with modal UX | Working | `app/campaigns/page.tsx`, `app/campaigns/[id]/page.tsx`, `app/communications/page.tsx` |
| Webmaster starter dashboard no longer routes to missing template/import/media/theme pages | Working | `app/components/webmaster/WebmasterStarterDashboard.tsx`, `app/webmaster/[workspace]/page.tsx` |
| Cross-module partial features still pending closure (placeholder routes, TODO permission enforcement, partial export pathways) | Partially Working | `docs/status/PARTIAL_IMPLEMENTATION_AUDIT.md` |

Notes:

- This snapshot records phase 1 (audit) and phase 2 (matrix) completion plus initial phase 4 navigation cleanup actions.
- Release-gate status remains tied to command evidence lanes and unresolved partial-feature items.

## User Friendliness Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Staff role workflow audit document | Working | `docs/status/USER_FRIENDLINESS_AUDIT.md` |
| Dashboard Start Here guided actions | Working | `app/page.tsx` |
| Dashboard plain-language focus cards | Working | `app/page.tsx` |
| Dashboard Start Here and Today's Focus movable widget behavior | Working | `app/page.tsx` |
| Dashboard actionable insights card | Working | `app/page.tsx`, `app/components/dashboard/ActionableInsightsWidget.tsx` |
| Dashboard AI widget set (runtime controls, opportunities, compact chat) | Working | `app/page.tsx`, `app/components/dashboard/AiInsightsWidget.tsx`, `app/components/dashboard/AiOpportunityWidget.tsx`, `app/components/dashboard/AiChatWidget.tsx` |
| Shared contextual help tip component | Working | `app/components/ui/WorkspaceHelpTip.tsx` |
| User-facing guide baseline | Working | `docs/howto/USER_GUIDE.md` |
| CRM language guide baseline | Working | `docs/ui/CRM_LANGUAGE_GUIDE.md` |

Notes:

- This snapshot represents the first user-friendliness implementation wave and does not indicate full completion of all 20 user-friendliness phases.
- Remaining user-friendliness phases should continue in iterative module-specific passes with test-backed validation.

## Responsive UI Compact-Laptop Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Compact desktop shell breakpoints (`<1024` drawer, `1024-1439` compact, `>=1440` full workspace rail) | Working | `app/components/layout/AppShell.tsx`, `app/components/layout/TopBar.tsx`, `app/components/layout/CrmSidebar.tsx`, `app/components/workspace/WorkspaceFrame.tsx` |
| Shared compact-laptop overflow protections (`min-w-0`, contained main overflow, bounded rail height) | Working | `app/components/layout/AppShell.tsx`, `app/components/layout/AppProductShell.tsx`, `app/components/workspace/WorkspaceControlRail.tsx` |
| Responsive browser audit automation | Working | `scripts/qa/responsive-ui-pass.mjs`, `package.json` |
| Dated screenshot capture workflow for responsive UI | Working | `docs/screenshots/responsive-ui/README.md` |

Notes:

- Small laptop readiness is now part of the layout acceptance bar and should be validated at `1366x768` and `1280x720` for new CRM workspaces.
- Full release-gate status still depends on the command evidence lanes below.

## CRM Header Cleanup Stage 1 Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Canonical compact breadcrumb bar for workspace pages | Working | `app/components/layout/WorkspaceBreadcrumbBar.tsx` |
| Shared ribbon frame + wizard compact header migration | Working | `app/components/workspace-ribbon/WorkspaceRibbonFrame.tsx`, `app/components/workspace-ribbon/WorkspaceWizard.tsx` |
| High-traffic workspace header migrations (Tasks, Grants, Settings, Data Tools, Steward Paths, Constituents, Campaigns, Donations, Volunteers, Meetings, QuickBooks Sync, Reports, Donation create/edit routes, Compassion Clients/Cases/Follow-ups, Events Guests/Orders/Check-In/Tickets/Tables/Sponsors/Overview) | Partially Working | `app/tasks/page.tsx`, `app/grants/page.tsx`, `app/settings/page.tsx`, `app/data-tools/page.tsx`, `app/components/steward-paths/StewardPathsWorkspacePage.tsx`, `app/constituents/page.tsx`, `app/campaigns/page.tsx`, `app/donations/page.tsx`, `app/volunteers/page.tsx`, `app/meetings/page.tsx`, `app/quickbooks-sync/page.tsx`, `app/reports/page.tsx`, `app/donations/new/page.tsx`, `app/donations/[id]/edit/page.tsx`, `app/compassion/clients/page.tsx`, `app/compassion/cases/page.tsx`, `app/compassion/follow-ups/page.tsx`, `app/events/guests/page.tsx`, `app/events/orders/page.tsx`, `app/events/check-in/page.tsx`, `app/events/tickets/page.tsx`, `app/events/tables/page.tsx`, `app/events/sponsors/page.tsx`, `app/events/[eventId]/overview/page.tsx` |
| Shared module-aware breadcrumb/ribbon accent support | Working | `app/components/layout/WorkspaceBreadcrumbBar.tsx`, `app/components/workspace-ribbon/WorkspaceRibbonButton.tsx` |
| CRM-wide legacy header removal completion | Not Implemented | `docs/status/refactor-ui-autopilot-log.md` |

Notes:

- Detailed phase log and changed-file inventory: `docs/status/refactor-ui-autopilot-log.md`.
- This snapshot confirms stage-level stability, not full release-gate completion.

## Tasks + Notifications Work Engine Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Durable notification state model (`unread/read/dismissed/snoozed`) | Working | `prisma/schema.prisma`, `server/src/routes/notifications.ts`, `server/src/services/notifications.ts` |
| TopBar notification actions and unread polling | Partially Working | `app/components/layout/TopBar.tsx` |
| Task lifecycle endpoints (`start`, `complete`, `snooze`, `archive`) | Working | `server/src/routes/tasks.ts` |
| Full task command-center UX (board/calendar/wizard/details drawer) | Partially Working | `app/tasks/page.tsx`, `app/components/tasks/*` |

Notes:

- This pass establishes durable API and state plumbing first; the full UI command-center rebuild remains an active follow-up.
- Keep status labels aligned to command evidence and do not treat this snapshot as a substitute for full gate runs.

## Standalone Bridge + Structured Artifacts Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Standalone bridge desktop shell and controls | Working | `OyamaBridgeDesktopServer/main.js`, `OyamaBridgeDesktopServer/renderer.js` |
| Bridge proxy health/auth/CORS/log behavior | Working | `OyamaBridgeDesktopServer/bridge-server.js`, `OyamaBridgeDesktopServer/tests/bridge-server.test.js` |
| Startup launch + hidden + autostart persistence | Working | `OyamaBridgeDesktopServer/main.js` |
| Steward donor/report structured parse + transport (`structured`) | Working | `server/src/routes/steward-ai.ts` |
| Chat artifact rendering cards and response renderer | Working | `app/components/ai/StewardResponseRenderer.tsx`, `app/components/ai/artifacts/*`, `app/components/ai/StewardChatPanel.tsx` |
| Structured suggested-action execution endpoints and UI binding | Not Implemented | `app/components/ai/StewardResponseRenderer.tsx` |

Notes:

- This snapshot is feature-level evidence only and does not replace full release-gate validation lanes.
- Full production-readiness gate remains governed by lint/typecheck/test/build/db command evidence below.

## Documentation Governance Alignment (2026-05-13)

| Item | Status | Evidence |
|---|---|---|
| Canonical master plan moved under docs | Working | `docs/MASTER_PLAN.md` |
| Legacy plan packet location cleanup | Working | `docs/plans/*`, `docs/backlog/master-plan-backlog.md` |
| Office guide moved under docs hierarchy | Working | `docs/howto/HOW_TO_USE.md` |
| Full markdown inventory and disposition audit | Working | `docs/audits/markdown-documentation-audit.md` |

## Full-App Testing Expansion Snapshot (2026-05-13)

| Item | Status | Evidence |
|---|---|---|
| Testing audit baseline created | Working | `docs/testing/full-app-test-audit.md` |
| E2E local runbook created | Working | `docs/testing/e2e-local-runbook.md` |
| Test coverage map created | Working | `docs/testing/test-coverage-map.md` |
| Dedicated lane scripts for `unit` / `api` / `regression` / `ci` | Working | `package.json` |
| E2E base URL mismatch (3650 vs 3000) corrected in scripts | Working | `tests/e2e/ui-production-smoke.mjs`, `tests/e2e/livecom-ui-smoke.mjs` |
| Mobile E2E auth endpoint mismatch corrected | Working | `tests/e2e/mobile-readiness-audit.mjs` |
| Fresh E2E run against live local stack (`pnpm test:e2e`) | Working | Local validation run, 2026-05-13 |
| Fresh mobile audit run (`pnpm test:e2e:mobile`) | Partially Working | Local validation run, 2026-05-13 (`75` warns, `0` fails) |
| API lane breadth across all modules | Partially Working | `tests/api/*` |
| Full CRM workflow E2E coverage depth | Partially Working | `tests/e2e/*` |

Reference docs for this pass:

- `docs/audits/full-app-testing-audit.md`
- `docs/audits/full-app-testing-validation.md`

## Donor Engagement Unified System Refactor (2026-05-13)

Phase 1 (audit + docs), Phase 2 (UI relabeling, shared status vocabulary), and Phase 3 partial (shared service contract foundation + unit tests) have landed. Phase 4 visual builder work has landed with branch-aware persistence/export and true drag-and-drop behavior.

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
| Steward Paths visual builder canvas (palette/map/inspector) at `/steward-paths/builder` | Working | `app/steward-paths/builder/page.tsx`, `app/components/steward-paths/*` |
| Visual builder persistence (save/load) | Working | `app/components/steward-paths/StewardPathBuilderPage.tsx`, `app/components/steward-paths/workflow-transformers.ts` (branch-aware save/load and export are active) |
| `STATUS_CHANGE` step execution | Working | `server/src/services/steward-paths-sequence-engine.ts` `processStatusChangeStep`/`buildStatusChangeUpdate`; 16 unit tests in `tests/unit/steward-paths-status-change.test.ts` |
| `BRANCH_PLACEHOLDER` step execution (eq/neq/gt/gte/lt/lte/in/not_in) | Working | `server/src/services/steward-paths-sequence-engine.ts` `processBranchStep`; algorithm mirrored from `app/lib/engagement-orchestration.ts` (covered by `tests/unit/engagement-orchestration.test.ts`) |
| New Phase-5 step types (wait-until-date, weekday/time, after-last-gift, tag mutations, manual command operations, retry/notify/stop flows) | Working | `server/src/services/steward-paths-sequence-engine.ts` and `app/components/steward-paths/workflow-transformers.ts` now map and execute these step families |
| Auto-send email step | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` `processSendEmailStep` intentionally routes through draft-first behavior |
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

## Targeted Validation Run (2026-05-13)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| `pnpm lint` | Failed with existing repo-wide lint errors/warnings (including React compiler memoization and hook-order violations in untouched files) | Broken | Local run in current pass (see `docs/audits/full-crm-cleanup-validation.md`) |
| `pnpm typecheck:web` | Passed | Working | Local run in current pass |
| `pnpm test:smoke` | 152 passed, 0 failed | Working | Local run in current pass |
| `pnpm vitest --run tests/unit/steward-paths-workflow-builder.test.ts tests/unit/engagement-orchestration.test.ts` | 27 passed, 0 failed | Working | Local run in current pass |
| `pnpm build` | Passed | Working | Local run in current pass |

## Donor Browser QA Validation Run (2026-05-13)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| `pnpm lint` | Failed with 49 problems (16 errors, 33 warnings) | Broken | Local run in current pass |
| `pnpm typecheck` | Passed | Working | Local run in current pass |
| `pnpm vitest --run tests/smoke/donations-crud.test.ts` | 13 passed, 0 failed | Working | Local run in current pass |
| `pnpm build` | Passed | Working | Local run in current pass |
| `pnpm test:e2e` | Failed (`ERR_CONNECTION_REFUSED` at `http://localhost:3650/login`) | Broken | Local run in current pass |
| `pnpm test:e2e:mobile` | Failed (mobile audit login 404 on `/api/auth/login`) | Broken | Local run in current pass |
| `pnpm test:e2e:livecom` | Failed (`ERR_CONNECTION_REFUSED` at `http://localhost:3650/login`) | Broken | Local run in current pass |

## Full-App Testing Validation Run (2026-05-13)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| `pnpm lint` | Failed with 50 problems (16 errors, 34 warnings) | Broken | Local run in current pass |
| `pnpm typecheck` | Passed | Working | Local run in current pass |
| `pnpm test:unit` | 250 passed, 0 failed | Working | Local run in current pass |
| `pnpm test:api` | 7 passed, 0 failed | Working | Local run in current pass |
| `pnpm test:regression` | 2 passed, 0 failed | Working | Local run in current pass |
| `pnpm test:smoke` | 159 passed, 0 failed | Working | Local run in current pass |
| `pnpm test` | 418 passed, 0 failed | Working | Local run in current pass |
| `pnpm test:coverage` | Passed with v8 coverage output | Working | Local run in current pass |
| `pnpm test:e2e` | Passed | Working | Local run in current pass (with `pnpm dev:all` active) |
| `pnpm test:e2e:livecom` | Passed | Working | Local run in current pass (with `pnpm dev:all` active) |
| `pnpm test:e2e:mobile` | Completed with 75 warnings, 0 failures | Partially Working | Local run in current pass (with `pnpm dev:all` active) |
| `pnpm build` | Passed | Working | Local run in current pass |

## Steward Paths Canonicalization Validation Run (2026-05-13)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| `/steward-paths` canonical saved visual paths workspace | Manual browser QA passed | Working | Local browser QA + screenshot evidence in current pass |
| `/automations` compatibility redirect to canonical route | Manual browser QA passed (`/steward-paths?deprecated=automations`) | Working | Local browser QA + screenshot evidence in current pass |
| `/steward-paths/builder/:id` template-edit route | Manual browser QA passed | Working | Local browser QA + screenshot evidence in current pass |
| `/steward-paths/:id/history` route | Manual browser QA passed (timeline event rendered) | Working | Local browser QA + screenshot evidence in current pass |
| `pnpm typecheck` | Passed | Working | Local run in current pass |
| `pnpm test:unit -- --run tests/unit/steward-paths-adapters.test.ts tests/unit/crm-sidebar-navigation.test.ts` | Passed (254 tests) | Working | Local run in current pass |
| `pnpm test:api -- --run tests/api/steward-paths.api.test.ts` | Passed (8 tests) | Working | Local run in current pass |
| `pnpm test:smoke` | Passed (159 tests) | Working | Local run in current pass |
| `pnpm test:e2e` | Passed | Working | Local run in current pass |
| `pnpm build` | Passed | Working | Local run in current pass |
| `pnpm lint` | Failed with existing repo-wide issues (16 errors, 35 warnings) | Broken | Local run in current pass |

Notes:

- New canonical Steward Paths functionality validated end-to-end.
- Release gate remains blocked by unresolved repo-wide lint failures outside this feature pass.

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
11. Donor stewardship vertical-loop completion slice (donation -> acknowledgment workflow handoff).
   - Added one-click `Complete Loop` donation action in `app/components/donations/DonationTable.tsx` and `app/donations/page.tsx`.
   - Added orchestration endpoint `POST /api/donations/:id/quick-actions/stewardship-loop` in `server/src/routes/donations.ts`.
   - Endpoint executes/reuses draft email, follow-up task, and steward path enrollment with timeline/audit writeback.
   - Added smoke coverage in `tests/smoke/donations-crud.test.ts` for both loop execution and cross-workspace artifact visibility (`email campaigns`, `tasks`, `steward-path enrollments`, `constituent timeline`).
12. Donor browser-driven QA and documentation polish pass.
   - Added reproducible route+viewport QA script `scripts/qa/donor-browser-pass.mjs`.
   - Added DonorCRM QA report and module guide (`docs/modules/donor-crm/browser-qa-report.md`, `docs/modules/donor-crm/README.md`).
   - Added screenshot index and refreshed dated screenshot pack (`docs/screenshots/donor-crm/README.md`, `docs/screenshots/donor-crm/2026-05-13/*`).
13. OShareview reporting expansion pass (scope switcher, admin operations, filter depth).
   - Replaced chip-heavy report scope controls with a compact dropdown switcher in `app/components/reports/ReportsModuleToolbar.tsx`.
   - Added admin reporting workspace and API-backed operational dataset via `app/components/reports/OShareviewAdminWorkspace.tsx` and `GET /api/reports/admin-summary` in `server/src/routes/reports.ts`.
   - Added global filter controls and filter-aware exports plus printable packet generation in `app/reports/page.tsx`.
   - Fixed a constituent profile runtime hook-order crash and improved mobile quick-action stacking in `app/constituents/[id]/page.tsx`.
14. Steward AI bridge pairing automation pass (CRM URL/key pairing + desktop import).
   - Added bridge readiness and pairing key APIs in `server/src/routes/steward-ai.ts` (`GET /api/steward-ai/bridge/readiness`, `POST /api/steward-ai/bridge/pairing-key`).
   - Added CRM AI settings pairing controls in `app/components/settings/ai/BridgePairingPanel.tsx` and mounted in `app/components/settings/ai/AISettingsPage.tsx`.
   - Added desktop bridge pairing URL/token/key import flow in `Desktopapp/shell.html`, `Desktopapp/shell.js`, and `Desktopapp/styles.css`.
15. OyamaWebMaster visual editor, draft preview, and publish readiness workspace pass.
   - Added new editor route and workspace shell in `app/webmaster/editor/page.tsx` and `app/components/webmaster/editor/*` with top bar, left rail, live canvas, and inspector.
   - Added shared rendering pipeline for editor and preview in `app/components/webmaster/rendering/*`.
   - Added real draft preview route in `app/webmaster/preview/[siteId]/[pageId]/page.tsx` and `app/components/webmaster/WebmasterDraftPreviewPage.tsx`.
   - Added publish readiness endpoint `GET /api/webmaster/sites/:siteId/publish-readiness` plus publishing workspace `app/webmaster/publishing/page.tsx` and `app/components/webmaster/WebmasterPublishingWorkspace.tsx`.
   - Publish execution and rollback execution are Working with immutable publish version snapshots and confirmation-gated actions; external deployment target adapters remain Not Implemented.

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

## v1.1.0 Help & Documentation Expansion Snapshot (2026-05-18)

| Item | Status | Evidence |
|---|---|---|
| Help search query synonym expansion (60+ rules) | Working | `app/help-content/search.ts` `expandQueryTokens` |
| Feature readiness boost in search ranking | Working | `app/help-content/search.ts` `featureReadinessBoost` |
| Route-context mappings expanded (35+ routes) | Working | `app/help-content/route-help-map.ts` |
| New help articles: Campaigns | Working | `app/help-content/articles.ts` `help-donor-campaigns` |
| New help articles: Constituent profile & timeline | Working | `app/help-content/articles.ts` `help-donor-view-constituent-profile` |
| New help articles: Steward Paths setup | Working | `app/help-content/articles.ts` `help-donor-steward-paths-setup` |
| New help articles: Contacts Manager audience lists | Working | `app/help-content/articles.ts` `help-donor-contacts-manager` |
| New help articles: Pledge management | Working | `app/help-content/articles.ts` `help-donor-pledges` |
| New help articles: Donor retention analysis | Working | `app/help-content/articles.ts` `help-donor-retention-analysis` |
| New help articles: Volunteers | Working | `app/help-content/articles.ts` `help-donor-volunteers` |
| New help articles: Dashboard metrics | Working | `app/help-content/articles.ts` `help-donor-dashboard-metrics` |
| New help articles: Email builder | Working | `app/help-content/articles.ts` `help-donor-email-builder` |
| New help articles: Donation import | Working | `app/help-content/articles.ts` `help-donor-import-donations` |
| New help articles: Events sponsors | Working | `app/help-content/articles.ts` `help-events-sponsors` |
| New help articles: Event ticket types | Working | `app/help-content/articles.ts` `help-events-tickets` |
| New help articles: Event overview dashboard | Working | `app/help-content/articles.ts` `help-events-overview-dashboard` |
| New help articles: Compassion assessments | Working | `app/help-content/articles.ts` `help-compassion-assessments` |
| New help articles: Compassion referrals | Working | `app/help-content/articles.ts` `help-compassion-referrals` |
| New help articles: Compassion reports | Working | `app/help-content/articles.ts` `help-compassion-reports` |
| New help articles: Material assistance | Working | `app/help-content/articles.ts` `help-compassion-material-assistance` |
| New help articles: System settings overview | Working | `app/help-content/articles.ts` `help-global-system-settings` |
| New help articles: Organization settings | Working | `app/help-content/articles.ts` `help-global-org-settings` |
| New help articles: Audit log review | Working | `app/help-content/articles.ts` `help-global-audit-log` |
| New help articles: User management | Working | `app/help-content/articles.ts` `help-global-user-management` |
| New help articles: Data export | Working | `app/help-content/articles.ts` `help-global-data-export` |
| New help articles: Security & privacy | Working | `app/help-content/articles.ts` `help-global-security-privacy` |
| New help articles: Notifications & reminders | Working | `app/help-content/articles.ts` `help-global-notifications` |
| New help articles: Setup wizard | Working | `app/help-content/articles.ts` `help-global-setup-wizard` |
| New help articles: Webmaster basics | Working | `app/help-content/articles.ts` `help-global-webmaster` |
| New help articles: Connectivity troubleshooting | Working | `app/help-content/articles.ts` `help-global-troubleshoot-connectivity` |
| New help articles: Module switching | Working | `app/help-content/articles.ts` `help-global-module-switching` |
| Total published help articles | Working | 60 articles covering all major CRM modules and workflows |
| FEATURES.md root-level feature inventory | Working | `FEATURES.md` — complete feature list with status labels |
| Version bumped to 1.1.0 | Working | `package.json` |
| HelpWorkspace quick search expanded | Working | `app/components/help/HelpWorkspace.tsx` — 10 quick searches |
| Help Agent example prompts expanded | Working | `app/components/help/HelpWorkspace.tsx` — 5 starter prompts |
