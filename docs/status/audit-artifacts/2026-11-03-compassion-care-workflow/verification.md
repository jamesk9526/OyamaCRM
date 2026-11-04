# Compassion ultrasound and connected care verification — 2026-11-03

## Implemented behavior

- Dedicated clinical-only ultrasound worklist with client-name search, 25-record pagination, draft/review/signed queues and totals, appointment links, supporting-file counts, and associated care tasks.
- Client-scoped examination creation, clinician-entered structured details, optional measurements and care-plan dates, author-only editing and attachments, protected image/PDF/MP4 preview and download.
- Existing encrypted charts remain the source of truth. Submission requires completed clinical fields and supporting scans. Physicians can return unsigned review charts with encrypted feedback, or explicitly attest and sign. Signed reports and their print layout are preserved; amendments create new versions.
- Chart-linked follow-ups have a general care-task title; findings remain encrypted. Creation/reassignment checks active casework-capable accounts, and open-task duplication is rejected on creation and reopening. Existing persisted `OVERDUE` tasks and `IN_PROGRESS` tasks remain visible and completable; reopening clears completion timestamps.
- Client profiles expose ultrasound history, Today exposes clinical handoffs, clinical charting links to the dedicated workspace, and scheduling handoffs prefill the client and ultrasound visit type.
- Leaving unsaved documentation through workspace controls or application links prompts before discarding it. Refresh/close uses the native unload guard; cancelable browser-history navigation is also guarded and exercised in Chromium. Changing the client confirms and clears unsaved findings. The chosen client is loaded independently of directory search results, including beyond the first 100 matches.

## Verification

| Check | Evidence / result |
| --- | --- |
| Focused tests | 33 tests in four files passed: ultrasound validation (15), synthetic HTTP workflow (7), existing care security (6), and scheduling utilities (5). Amendment assertions also pass in the HTTP suite. |
| HTTP boundary | Actual Express middleware, JWT authorization, route validation, encryption, and signature/report handlers; explicitly synthetic in-memory persistence. Includes tenant rejection, non-clinical denial, stale-save rejection, draft ownership, supporting scans, correction/resubmission/signing, amendment preservation, pagination, assignment, duplicate reopening, and overdue/completion behavior. |
| Prisma | `pnpm exec prisma generate` and `pnpm exec prisma validate` passed. |
| Type checks | `pnpm typecheck` and the final server typecheck passed. The production build also ran the web TypeScript check. |
| Lint | Targeted ESLint over changed care components, routes, tests, and migration runner passed with no warnings/errors. |
| Production build | Final `NEXT_DIST_DIR=.next/compassion-care-build pnpm build` passed. |
| Rendered interactions | Ten acceptance checks passed against the isolated final production app, with zero browser runtime errors or console warnings. See `ui-checks.json` for exact checks, contrast measurements, and mutation paths. Includes history cancellation, client-change reset, amendment cancellation/creation, and confirmation that the signed original is preserved. |
| Responsive | Worklists and examination details inspected at 1440, 768, and 390 CSS pixels, with page-width overflow assertions. Mobile navigation and Escape dismissal exercised. |
| Accessibility | Measured contrast for representative worklist text, filters, supporting metadata, and primary actions is at least 4.5:1. Keyboard Tab navigation displays a visible focus ring. Stable accessible field names are checked with populated as well as empty notes. |
| Print | Existing signed-report rendering inspected under print media; application sidebar is hidden. See `signed-report-print.png`. No report template or print styling was changed. |

Commands (PowerShell):

```powershell
pnpm exec vitest run tests/unit/compassion-ultrasound.test.ts tests/unit/compassion-security.test.ts tests/unit/compassion-appointments-utils.test.ts tests/api/compassion-ultrasound-workflow.test.ts
pnpm typecheck
pnpm exec prisma validate
$env:NEXT_DIST_DIR='.next/compassion-care-build'; pnpm build
$env:COMPASSION_UI_WEB='http://127.0.0.1:6370'; node tests/e2e/compassion-care-workflow.e2e.mjs
```

## Visual comparison and evidence

Desktop baseline images show the original generic clinical workspace, client profile, and Today screen. Their corresponding after views show the dedicated examination workflow, client ultrasound history, and clinical handoffs. The existing teal/navy Compassion treatment is retained; the worklist and examination panel use task-specific layouts. No new ultrasound-specific reference was supplied, so this was checked against the task and repository guidance, not claimed as a reference match.

All screenshots, names, counts, examination content, uploads, and browser sessions in this directory are **synthetic QA fixtures**. The scan is a tiny test PNG, not a diagnostic ultrasound. After views at 390px and 768px verify current responsive behavior. A mobile before view could not be captured reliably during an initial development-bundle loading failure; no mobile before/after equivalence is claimed. Final interaction checks use the production build, which avoids those development reload failures.

Browser-history prompts use the cancelable `navigate` event where supported; native unload protection covers full-document exits. Some history traversals are intentionally not cancelable, as described by the [HTML navigation API standard](https://html.spec.whatwg.org/dev/nav-history-apis.html). The exercised browser and scope are recorded above; this is not a cross-browser compatibility claim.

## Database and deployment limits

The configured database is local MySQL at `localhost:3306`. A read-only connectivity check failed because the service was unavailable. No migration or live clinical write was performed. The HTTP persistence boundary and browser API responses are synthetic, so passing tests do **not** establish MySQL transaction/concurrency behavior, migration application, or live deployment.

Before starting the updated API against the intended database:

```powershell
pnpm compassion:migrate
pnpm db:generate
pnpm build:server
```

Then restart the Compassion API through the installation's normal process manager. The scoped migration runner includes the new `20261103100000_compassion_chart_follow_ups` migration alongside the existing care migrations and does not deploy unrelated pending donor migrations. The new migration adds a nullable `CompassionFollowUp.chartId` and tenant/chart index; it does not rewrite existing charts or care data.

Repeat database-backed persistence and concurrency verification after migration. Existing clinical-template/cutover requirements remain unchanged. Scanner/provider connections and a DICOM viewer are outside this implementation.
