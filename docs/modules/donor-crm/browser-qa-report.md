# DonorCRM Browser QA Report

Date: 2026-05-13

Scope: DonorCRM-only browser-driven QA and production polish pass.

## QA Method

- Manual browser interaction on live app routes (staff-style click-through).
- Automated multi-viewport route pass via scripts/qa/donor-browser-pass.mjs.
- Screenshots captured to docs/screenshots/donor-crm/2026-05-13.
- Route metrics captured to docs/modules/donor-crm/browser-qa-metrics-2026-05-13.json.

Viewports exercised:

- Desktop: 1440 x 900
- Laptop: 1280 x 800
- Tablet: 768 x 1024
- Mobile: 390 x 844

## Page Status Matrix

| Page | Desktop Status | Mobile Status | Data Status | Issues Found | Fixes Made | Screenshots |
|---|---|---|---|---|---|---|
| Dashboard | Working | Working | Working | Repeated image aspect-ratio warning in console | None in this pass | docs/screenshots/donor-crm/2026-05-13/donor-dashboard-desktop.png, docs/screenshots/donor-crm/2026-05-13/donor-dashboard-mobile.png |
| Constituents list | Working | Working | Working | None blocking; occasional transient 401 noise while auth refresh rotates | None in this pass | docs/screenshots/donor-crm/2026-05-13/constituents-list-desktop.png, docs/screenshots/donor-crm/2026-05-13/constituents-list-mobile.png |
| Constituent profile | Working | Working | Working | React hook order crash was reproducible at start of pass when opening profile route | Fixed hook ordering in app/constituents/[id]/page.tsx by moving useMemo hooks before early returns; improved mobile quick-action layout with full-width stack behavior | docs/screenshots/donor-crm/2026-05-13/constituent-profile-desktop.png |
| Donations list + quick actions | Working | Working | Working | None blocking in route; complete-loop dialog interruption expected | No code change in this pass (feature already implemented) | docs/screenshots/donor-crm/2026-05-13/donations-list-desktop.png, docs/screenshots/donor-crm/2026-05-13/donations-list-mobile.png |
| Donation entry form | Working | Partially Working | Working | Mobile not deeply form-submitted in this pass | None in this pass | docs/screenshots/donor-crm/2026-05-13/donation-form-desktop.png |
| Campaigns list | Working | Working | Working | None blocking | None in this pass | docs/screenshots/donor-crm/2026-05-13/campaigns-list-desktop.png, docs/screenshots/donor-crm/2026-05-13/campaigns-list-mobile.png |
| Campaign detail/edit | Working | Partially Working | Working | Mobile edit flow not deeply exercised | None in this pass | docs/screenshots/donor-crm/2026-05-13/campaign-detail-desktop.png |
| Grants workspace | Working | Partially Working | Working | No blocking issue found in route load pass | None in this pass | docs/screenshots/donor-crm/2026-05-13/grants-workspace-desktop.png |
| Tasks workspace | Working | Partially Working | Working | No blocking issue found in route load pass | None in this pass | docs/screenshots/donor-crm/2026-05-13/tasks-workspace-desktop.png |
| Meetings workspace | Working | Partially Working | Working | No blocking issue found in route load pass | None in this pass | docs/screenshots/donor-crm/2026-05-13/meetings-workspace-desktop.png |
| Communications workspace | Working | Working | Working | No blocking issue found; workspace-control pattern is active | None in this pass | docs/screenshots/donor-crm/2026-05-13/communications-workspace-desktop.png, docs/screenshots/donor-crm/2026-05-13/communications-workspace-mobile.png |
| Email Builder | Working | Partially Working | Partially Working | Mobile authoring not fully audited; desktop flow reachable | None in this pass | docs/screenshots/donor-crm/2026-05-13/email-builder-desktop.png |
| Letters and Printables | Working | Working | Partially Working | PDF/export depth still partial in current product state | None in this pass | docs/screenshots/donor-crm/2026-05-13/letters-printables-desktop.png, docs/screenshots/donor-crm/2026-05-13/letters-printables-mobile.png |
| Steward Paths / Automations | Working | Working | Working | None blocking in this pass | Verified Edit in Builder and Open in Builder flows | docs/screenshots/donor-crm/2026-05-13/steward-paths-automations-desktop.png, docs/screenshots/donor-crm/2026-05-13/steward-paths-automations-mobile.png, docs/screenshots/donor-crm/2026-05-13/steward-paths-builder-desktop.png |
| Steward Signals | Partially Working | Partially Working | Partially Working | Widget language shows read-only shell and loading placeholders for deeper orchestration | None in this pass | docs/screenshots/donor-crm/2026-05-13/steward-signals-desktop.png |
| Reports | Working | Working | Working | No blocking issue found in route load pass | None in this pass | docs/screenshots/donor-crm/2026-05-13/reports-desktop.png, docs/screenshots/donor-crm/2026-05-13/reports-mobile.png |
| Data Tools + Importer | Working | Working | Working | Merge flow remains demo-only by design | None in this pass | docs/screenshots/donor-crm/2026-05-13/data-tools-desktop.png, docs/screenshots/donor-crm/2026-05-13/data-tools-import-desktop.png, docs/screenshots/donor-crm/2026-05-13/data-tools-import-mobile.png |
| Volunteers | Working | Partially Working | Partially Working | Known auth-client consistency debt still exists in product baseline | None in this pass | docs/screenshots/donor-crm/2026-05-13/volunteers-desktop.png |
| Custom Fields | Working | Partially Working | Working | No blocking issue found in route load pass | None in this pass | docs/screenshots/donor-crm/2026-05-13/custom-fields-desktop.png |
| Payments | Working | Partially Working | Partially Working | Donor-facing payment depth still limited | None in this pass | docs/screenshots/donor-crm/2026-05-13/payments-desktop.png |
| Donor Settings/Status pages | Working | Working | Working | No blocking issue found in route load pass | None in this pass | docs/screenshots/donor-crm/2026-05-13/settings-desktop.png, docs/screenshots/donor-crm/2026-05-13/settings-mobile.png, docs/screenshots/donor-crm/2026-05-13/settings-plugins-desktop.png |

## Workflow Checks Completed

- Constituent workflow: list search/filter, profile open, quick-action visibility.
- Donation workflow: Complete Loop action run from list row; confirm dialog reported reused artifacts.
- Campaign workflow: list to detail route navigation confirmed.
- Communications workflow: workspace loaded, New Campaign action present.
- Letters and Printables workflow: generation controls visible and route stable.
- Steward Paths workflow: automations workspace loaded, builder entry actions visible.
- Reports workflow: filter controls present and route stable.
- Data Tools workflow: importer route stable with upload/import language present.

## Validation Commands and Results

| Command | Status | Result |
|---|---|---|
| pnpm lint | Broken | 49 problems (16 errors, 33 warnings) |
| pnpm typecheck | Working | Passed |
| pnpm vitest --run tests/smoke/donations-crud.test.ts | Working | 13 passed, 0 failed |
| pnpm build | Working | Passed |
| pnpm test:e2e | Broken | ERR_CONNECTION_REFUSED at http://localhost:3650/login |
| pnpm test:e2e:mobile | Broken | Mobile audit login failed with 404 on /api/auth/login |
| pnpm test:e2e:livecom | Broken | ERR_CONNECTION_REFUSED at http://localhost:3650/login |

## Fixes Made In This Pass

1. Fixed a real constituent profile crash caused by hook-order violation.
2. Added deterministic browser QA capture script for all required donor routes and viewports.
3. Refreshed and replaced donor screenshot set with dated production captures.
4. Archived stale donor screenshot files previously used in README references.

## Remaining Production UX Issues (Non-blocking for this pass)

1. Global image aspect-ratio warning persists (`/branding/oyama-logo-w384.png`) and should be normalized in layout image styling.
2. Occasional 401/CORS noise appears during auth refresh and plugin status checks; does not fully block route loads but degrades trust.
3. Mobile deep authoring workflows (Email Builder, campaign edit, advanced forms) need dedicated interaction pass beyond route-level checks.

## Broken or Partial Features Requiring Deeper Backend/Platform Work

1. E2E contract mismatch: tests target localhost:3650 while active app runs on localhost:3000.
2. Mobile E2E script expects auth endpoint contract currently returning 404 in its configured environment.
3. Merge workflow remains demo-only and not yet fully backend-authoritative.
4. Letters PDF/export remains partially implemented.
