# Production Readiness Checklist

Last updated: 2026-05-10

This is the centralized readiness source of truth requested for release gating.

## Status Definitions

Use only these status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

## Documentation & Screenshots Status

| Component | Status | Notes |
|---|---|---|
| README.md | Updated | Refreshed with 19 current screenshots and module descriptions |
| README_SCREENSHOTS/ | Refreshed | All 19 screenshots updated 2026-05-10, organized by module |
| Static website HTML | Updated | Screenshot references updated to match new filenames |
| Static website assets | Refreshed | Fresh screenshots copied to easy_prep_tools/Static_site_demo_website/assets/screenshots/ |
| Module feature lists | Current | DonorCRM, Compassion CRM, Events CRM, Watchdog, WebMaster, OyamaHRM documented |
| Defect documentation | Current | Known issues tracked in Defect Ledger below |

## UI Audit Summary (2026-05-10)

**Overall Status:** Most modules are visually complete and functional.

**Issues Found During Visual Audit:**
1. Compassion CRM root route (/compassion) returns 404 – should redirect to /compassion/clients or /compassion/dashboard
2. Events module shows operational workflow status indicators properly (ACTIVE/LIVE features visible)
3. WebMaster module dashboard appears clean with New Website creation workflow available
4. DonorCRM dashboard, constituents, donations, campaigns, grants, tasks all render correctly
5. Communications, steward signals, volunteers modules functional
6. Reports and data import tools functional
7. Watchdog security feed displays properly
8. Settings module accessible

**No critical visual bugs or layout issues identified in this refresh.**

## Validation Run Summary (Latest Full Pass)

| Validation | Result | Status |
|---|---|---|
| pnpm db:verify:demo | Pass | Working |
| pnpm test | 244 passed, 10 failed (2 files failed) | Broken |
| pnpm test:smoke | 94 passed, 10 failed (2 files failed) | Broken |
| pnpm test:coverage | 244 passed, 10 failed (2 files failed) | Broken |
| pnpm test:e2e | Fails on protected route redirect check (/events/workspace) | Broken |
| pnpm lint . | Fails with RangeError: Invalid string length | Broken |
| pnpm exec eslint app server tests prisma scripts --format stylish | 85 problems (66 errors, 19 warnings) | Broken |
| pnpm exec tsc --noEmit --project tsconfig.json | 6 errors | Broken |
| pnpm exec tsc --noEmit --project server/tsconfig.json | 13 errors | Broken |
| pnpm build | Fails (setup route parse error) | Broken |
| pnpm build:server | 40 errors in 27 files | Broken |

## Module and Workflow Readiness

| Area | Workflow | Status | Evidence |
|---|---|---|---|
| Platform | Authentication login/logout and protected shell | Working | app/login/page.tsx, server/src/routes/auth.ts |
| Platform | User management and audit log settings surfaces | Working | app/settings/users/page.tsx, app/settings/audit/page.tsx |
| Platform | Full lint/type/build pipeline | Broken | validation matrix above |
| DonorCRM | Constituents create/list/profile core flows | Working | app/constituents/page.tsx, app/constituents/[id]/page.tsx |
| DonorCRM | Donations create/list/import core flows | Working | app/donations/page.tsx, server/src/routes/donations.ts |
| DonorCRM | Campaign detail edit/delete flow | Working | app/campaigns/[id]/page.tsx |
| DonorCRM | Grants smoke-backed workflow stability | Broken | tests/smoke/grants-crud.test.ts |
| DonorCRM | Communications telemetry depth | Partially Working | app/communications/page.tsx, server/src/routes/email-campaigns.ts |
| Compassion CRM | Client CRUD + dashboard summary + basic cases | Partially Working | server/src/routes/compassion.ts, app/compassion/clients/page.tsx |
| Compassion CRM | Office appointment scheduling hub (calendar + list) | Working | app/compassion/appointments/page.tsx, app/components/compassion/appointments/*, server/src/routes/compassion.ts |
| Compassion CRM | Public scheduling slot generation and submit-time validation | Working | server/src/routes/compassion-public.ts |
| Compassion CRM | Full-name search reliability | Partially Working | server/src/routes/compassion.ts |
| Compassion CRM | Client profile extended care tabs | Partially Working | app/compassion/clients/[id]/page.tsx, app/components/compassion/client-workspace/*, server/src/routes/compassion.ts |
| Events CRM | Event workspace selector model | Working | app/events/workspace/page.tsx |
| Events CRM | Event-scoped guests route runtime stability | Broken | app/events/guests/page.tsx |
| Events CRM | Event reports page data loading | Broken | app/events/reports/EventReportsContent.tsx |
| Events CRM | Ticket/sponsor/communications/tasks/volunteers/files/settings completeness | Demo Only | app/events/[eventId]/* scaffold pages and workspace stubs |
| Events CRM | QR check-in and walk-in registration flows | Not Implemented | docs/status/events-crm-status.md |
| Watchdog | Cross-CRM feedback submission and ticket triage workspace | Partially Working | app/components/feedback/*, app/watchdog/feedback-tickets/page.tsx, server/src/routes/feedback.ts, server/src/routes/watchdog-feedback-tickets.ts |
| OyamaHRM | Module shell, dashboard, sidebar, and starter routes | Partially Working | app/hrm/layout.tsx, app/hrm/page.tsx, app/components/layout/HrmSidebar.tsx |
| OyamaHRM | Backend HRM entities and cross-module assignment integration | Not Implemented | docs/OYAMA_HRM.md |
| Data Tools | Import mapper + dry-run foundation | Partially Working | app/data-tools/import/* |
| Data Tools | Merge finalization backend and safe conflict resolution | Not Implemented | app/data-tools/merge/MergeWorkflow.tsx |

## Defect Ledger (Severity, Repro, Expected vs Actual, Recommendation)

| ID | Severity | Title | Reproduction | Expected | Actual | Fix Recommendation | Evidence |
|---|---|---|---|---|---|---|---|
| PR-001 | High | Grants create uses invalid status in smoke flow | Run pnpm test:smoke and inspect grants suite create step | Grant create should accept test payload or tests should match supported statuses | Create grant returns 500 when status PROSPECTING is sent | Align test fixture with GrantStatus enum, or add mapping layer for legacy status names | tests/smoke/grants-crud.test.ts:96, prisma/schema.prisma:1181, server/src/routes/grants.ts:207 |
| PR-002 | Medium | Grants funder update response-shape mismatch | Run grants smoke suite | API response contract should match test expectation | Test expects res.body.updated count but route returns updated entity object | Standardize PATCH /funders/:id response shape and update tests accordingly | tests/smoke/grants-crud.test.ts:68, server/src/routes/grants.ts:91 |
| PR-003 | High | Compassion workflow smoke: newly created client not reliably listed | Run routes workflow smoke suite | Newly created client should appear in immediate list response | Assertion fails on include check in clients list step | Investigate list filtering/order/race; add deterministic query by created ID and test helper retry | tests/smoke/routes-workflow.test.ts:167, tests/smoke/routes-workflow.test.ts:173 |
| PR-004 | Critical | Event-scoped guests page runtime crash | Open /events/<eventId>/guests with authenticated session | Guests page should render list or empty state | Runtime TypeError reading guest.event.id when event is undefined | Guard nullable guest.event in filter and normalize API payload shape | app/events/guests/page.tsx:93 |
| PR-005 | High | Events reports page performs unauthenticated API calls | Open /events/reports while authenticated | Reports should load via authenticated request helper | Raw fetch calls receive 401 and page can fail to load report content | Replace raw fetch with apiFetch and add non-200 handling before JSON parse | app/events/reports/EventReportsContent.tsx:83, app/events/reports/EventReportsContent.tsx:95, app/events/reports/EventReportsContent.tsx:108 |
| PR-006 | High | E2E production smoke fails on events workspace auth state | Run pnpm test:e2e | Browser smoke should stay authenticated through route checks | Script throws protected route redirected to login: /events/workspace | Harden login wait/assertions in script and verify session persistence before route loop | tests/e2e/ui-production-smoke.mjs:80, tests/e2e/ui-production-smoke.mjs:117 |
| PR-007 | Medium | Full-repo lint command crashes | Run pnpm lint . | Lint command should complete with actionable errors | Process crashes with RangeError: Invalid string length | Scope lint command to app/server/tests/prisma/scripts or exclude heavy reference artifacts | package.json scripts and command matrix |
| PR-008 | High | Frontend production build fails on setup route parse | Run pnpm build | Frontend should compile successfully | Build fails with parse error in setup page path | Fix JSX/TS parsing issue in setup route and remove stale/generated compile artifacts from typecheck scope | app/setup/page.tsx |

## Release Gate Decision

Current recommendation: Do not mark production-ready.

**Recent work (2026-05-10):**
- ✅ Completed visual documentation refresh with 19 fresh screenshots of all major modules
- ✅ Updated README.md with current feature descriptions and screenshot gallery
- ✅ Updated static website with refreshed screenshots and current project status
- ⚠️ UI audit identified 1 minor routing issue (/compassion root route 404)
- ❌ Code validation pipeline remains broken (test, lint, build failures)

Minimum gate to clear before production claim:

1. Resolve all Broken items in Defect Ledger PR-001 through PR-008.
2. Fix Compassion CRM root route to redirect properly or provide default dashboard view.
3. Reach Working or Partially Working for test, lint, typecheck, and build lanes.
4. Keep Demo Only surfaces visibly marked as in development in UI.
5. Re-run full validation matrix and update this file with fresh counts.
