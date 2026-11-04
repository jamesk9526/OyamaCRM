# oyamaCreate verification — 2026-11-03

Implementation was verified locally on Windows using the production Next.js bundle. Browser APIs, addresses, names, consent records and provider responses are explicitly synthetic fixtures. Browser checks exercise the real React components and request contracts; they do not prove a deployed database or provider account is configured.

## Visual comparison

The reference is the [latest Letters library](../2026-11-02-letters-ui/library-desktop.png). Create retains its slim white sidebar, light blue canvas, navy type, quiet borders and blue actions. Its campaign overview, channel tabs and review controls intentionally replace the Letters-only composition. Native layout tools mount inside the selected campaign. Application styles are scoped so they do not resize native toolbars or restyle authored email/PDF/public output. No pixel equivalence is claimed.

Compare the [previous Communications page](before-communications-1440.png) with the [transition notice](after-communications-transition-1440.png). The notice explicitly says all communications tools will move to oyamaCreate and links to `/oyama-create`. `/communications` remains available during the transition, as requested. The live production host was not deployed or authenticated during this work; this comparison uses local fixture captures.

Reviewed desktop, tablet and phone captures:

- [Desktop home](after-home-1440.png), [tablet home](after-home-768.png), [phone home](after-home-390.png).
- [Desktop shared editor](after-shared-editor-1440.png), [tablet shared editor](after-shared-editor-768.png), [phone shared editor](after-shared-editor-390.png).
- [Customized letter](after-letter-review-1440.png), [email preview](after-email-preview-1440.png), [structured letter layout](after-native-letter-1440.png), [native email desktop](after-native-email-1440.png), [native email tablet](after-native-email-768.png), [native email phone](after-native-email-390.png).
- [Audience/review plan and channel dates](after-review-plan-1440.png), [calendar](after-calendar-1440.png), [calendar continuation notice](after-calendar-continuation-1440.png), [held release confirmation](after-release-review-1440.png), [legacy library](after-import-library-1440.png), [delivery](after-delivery-1440.png), [results](after-results-1440.png), [connection settings](after-settings-1440.png), [public form](after-public-page-1440.png), [new campaign](after-new-campaign-1440.png).

Density, alignment, wrapping, format switching and phone navigation were inspected. The responsive checks assert no document overflow at 1440, 768 and 390 pixels. Mobile navigation opens and closes with Escape. Representative helper text, selected navigation and primary actions measure 4.70–6.00:1 contrast; keyboard focus has a visible outline. See [contrast measurements](contrast.json). These checks are not a complete accessibility audit of every inherited editor control.

## Functional and build checks

| Check | Actual result |
| --- | --- |
| Focused Vitest run | 171 tests passed across thirteen files; three opt-in MySQL tests skipped in a fourteenth file. |
| Create API/domain regression coverage | Shared/customized copy, revision conflicts, immutable imports, canonical email ownership, frozen releases, explicit channel strategies, individual channel dates, date clearing on duplication, paged calendar (including 501/1,002 content fixtures), server-side search, scheduling/cancellation, ambiguous outcomes, retries, opt-outs, duplicate callbacks and partial channel failures. |
| Public content checks | Recipient merge syntax rejected; consent submissions held before contact changes; existing giving/event processing retained. |
| Production browser acceptance | 19 checks passed with zero console errors or warnings. See [machine-readable checks and intercepted writes](ui-checks.json). No live CRM/provider writes. |
| Web/API TypeScript | Passed; production web build also completed its TypeScript validation. |
| API build | `pnpm build:server` passed. |
| Production web build | `NEXT_DIST_DIR=.next/create-production pnpm build` passed, including 224 static pages and the dynamic Create/public campaign routes. |
| Targeted ESLint | Zero errors. New Create files are clean. The inherited email builder retains three existing `next/no-img-element` warnings in block previews. |
| Prisma schema | `pnpm exec prisma validate` and client generation passed. The Create migration is additive and defaults organization rollout to disabled. |
| Migration/backfill on MySQL | Not run: localhost refused the read-only connection probe (`ECONNREFUSED`); no disposable MySQL URL was configured. |

The browser harness is `tests/e2e/oyama-create.e2e.mjs`. It creates an appeal, chooses both email and letters plus a shared audience, adds content, saves shared edits, protects customized letter copy, opens previews, saves a separate channel date, loads the channel calendar through an explicit continuation notice, verifies server search, checks review/release separation, imports historical content, visits delivery/results/settings, submits a synthetic public form, and exercises the native email block library, undo/redo and return to campaign review. It intercepts all API traffic; the live-release confirmation is cancelled.

To repeat the browser check against a local production server:

```powershell
$env:NEXT_DIST_DIR='.next/create-production'
pnpm build
pnpm exec next start --port 3213
# In a second terminal, with the repository's Playwright Chromium installed:
$env:CREATE_UI_WEB='http://localhost:3213'
node --import tsx tests/e2e/oyama-create.e2e.mjs
```

## Print evidence

The [seven-page synthetic proof](synthetic-multipage-proof.pdf) comes from the real frozen letter renderer, using embedded repository fonts and synthetic recipient/branding data. [Renderer metadata](print-proof-check.json) records seven pages and no result warnings. Existing sanitizer diagnostics about `allowedTags: false` are still emitted on renderer stdout; this work did not remove those inherited diagnostics.

The pagination regression inspects generated PDF bytes in memory. It no longer rewrites historical tracked proof files during automated tests.

The browser rasterizes the proof through the actual PDF viewer. Full page rasters are stored as `proof-page-1.png` through `proof-page-7.png`; [page one](proof-page-1.png), [page four](proof-page-4.png), and [page seven](proof-page-7.png) show the opening, continuation and final-page layout. UI captures show [page one](after-pdf-page-1-1440.png) and [page two](after-pdf-page-2-1440.png). Opening a proof does not mark it printed or mailed. Physical printer, label stock and real recipient proofs still need organization-specific validation.

## Release limits

The organization flag remains disabled by default. No live migration/backfill, email/SMS send, social post, public publication, payment or clinical write occurred. Existing uncommitted Compassion work was preserved.

Before enabling live delivery:

1. Apply and verify the migration/backfill in isolated MySQL. Run `CREATE_MYSQL_TEST_URL` tests against an empty `oyama_create_test_*` schema; the harness refuses existing tables and never uses `DATABASE_URL`.
2. Verify the organization's existing email transport, print worker/storage and actual recipient outputs.
3. Configure Azure sender/Event Grid and Meta account grants; pass connection readiness and reviewed account/sandbox integration.
4. Complete deployed authenticated acceptance. Provider acceptance and confirmed delivery remain separate outcomes, and unknown outcomes require reconciliation before retry.

Navigation rollback disables the organization flag or uses `?legacy=1`; it does not delete campaigns, releases, sent content or financial history. See [implementation and rollout notes](../../../plans/oyama-create-implementation.md).
