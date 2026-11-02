# Letters UI and typed deletion — 2026-11-02

Implemented locally; not deployed. Browser records, credentials and deletion responses in this directory are synthetic fixtures. No live CRM letters were removed.

## Behavior

- Letters has a scoped light shell, 208px navigation rail, concise breadcrumbs and a compact workflow indicator. Email keeps the shared product bar's existing default appearance.
- The template library opens to all accessible templates. Search matches names, categories and descriptions; ownership, status, category and authoring filters compose locally over the organization's existing unpaginated template response. Library totals remain independent of the filtered result. Name/recent-use ordering, list/grid views, visible filter state, reset, error recovery, import and export remain available.
- The standard ribbon editor has mobile Write/Blocks/Settings panels; contextual inspector commands reveal Settings. The structured builder has a compact block palette, horizontally scrollable mobile formatting, clearer save state and adaptive proof layout. Document HTML, renderer and print styles were not changed.
- `/oyama-letters/generated` lists recipient letters with a search over explicitly loaded records and a Load older letters action. The existing generated-list endpoint accepts a bounded offset and uses a stable timestamp/ID ordering.
- Template and generated-letter trash controls share one keyboard-accessible dialog. The user must type exactly `delete`; other text cannot enable removal. Cancel/Escape never dispatch deletion. Failures remain visible in the dialog, and successful removal updates the list and restores focus to search.
- `DELETE /api/letters/templates/:id/permanent` removes unused templates. Generated-letter references and linked Steward Paths block removal. The older `DELETE /api/letters/templates/:id` archive contract is preserved.
- `DELETE /api/letters/generated/:id` removes the selected generated record and its embedded queue state. Contact activity, linked email campaigns, frozen proofs, revision snapshots and production manifests have independent lifecycles and are retained. Delivery timestamps/references are recorded in the deletion audit entry. Previously downloaded, printed or sent copies cannot be recalled.
- Both removal endpoints require the existing `letters.archive` permission, authenticated organization context and `{ "confirmation": "delete" }`. Tenant-scoped removal and audit writes share a serializable transaction. Concurrent changes return a conflict; failed audit writes fail the transaction.
- AGENTS.md now treats the donor reference as a scoped dashboard direction and explicitly permits routine task-specific changes to layout, spacing, density, typography, radii and navigation. Accessibility, permissions, real data, print independence and visual verification remain required.

## Verification

| Check | Evidence |
| --- | --- |
| Web and server TypeScript | `pnpm typecheck` passed. |
| Focused lint | ESLint passed with zero errors; 22 existing warnings remain in the large legacy workspace and letters route. New deletion/list components and route have no lint warnings. |
| Deletion and print-layout unit suites | `pnpm exec vitest run tests/unit/letter-deletion-route.test.ts tests/unit/letters-print-layout.test.ts tests/unit/letters-pdf-layout.test.ts`: 3 suites, 73 tests passed. |
| Library and deletion browser flow | `node tests/e2e/letters-workspace-ui.e2e.mjs` passed with no page errors. Covers filters, sorting, views, read retry, permission-hidden controls, typed text/cancel/reset/retry/success, template-use conflict, generated deletion/paging, focus trap/restoration and mobile panel switching. See [browser results](browser-results.json). |
| Editor and PDF browser regression | `node tests/e2e/letters-builder-fixture.e2e.mjs` passed with separate `QA_ARTIFACT_DIR`. Covers editing, revisions, A4 settings, save conflicts, proof failures, stale action disabling, page navigation and downloaded bytes equal to the original PDF fixture. See [editor results](builder-interactions/browser-results.json). |
| Responsive output | No page overflow at 320/390/768px in the library and mobile editors, or at the structured fixture's 390/768/1280/1600px widths. The 2400px structured fixture asserts writing/proof geometry side by side. |

## Visual evidence

Reviewed before/after library and structured-editor images, plus desktop/mobile standard editor, generated-letter list and typed-confirmation dialogs. The original DonorCRM reference image was unavailable; this is a comparison against the previous Letters UI and the requested task, not a claim of pixel equivalence.

- [Previous library](before-library-desktop.png) and [updated library](library-desktop.png)
- [Grid library](library-grid-desktop.png), [mobile library](library-390.png) and [320px library](library-320.png)
- [Previous structured editor](before-builder-desktop.png) and [updated structured editor](builder-desktop.png)
- [Mobile structured editor](builder-mobile.png), [320px editor](builder-320.png) and [wide proof layout](builder-interactions/wide-side-by-side-proof.png)
- [Standard editor desktop](ribbon-desktop.png) and [mobile](ribbon-mobile.png)
- [Generated letters desktop](generated-desktop.png) and [mobile](generated-mobile.png)
- [Template confirmation](delete-confirmation-desktop.png) and [generated-letter confirmation on mobile](delete-confirmation-mobile.png)

## Limits

Database operations were tested with mocked Prisma transactions and real permission middleware, not against a live MySQL database. Actual transaction rollback/concurrency, deployed permissions and historical records still need staging integration verification. This pass did not run a full production build, send mail, migrate data, deploy, or certify physical printing. Generated-letter search covers loaded pages; the UI labels that scope explicitly.

Windows sandbox restrictions initially prevented local browser access and Vitest cache renames; the final checks ran with approved local execution. The development server also intermittently truncated scripts, so the browser fixtures buffer and syntax-check dev assets before delivery. One concurrent browser run lost in-memory proof state during development reload activity; the final PDF regression ran separately and passed. These checks do not certify development hot reload under concurrent cold page compilation.
