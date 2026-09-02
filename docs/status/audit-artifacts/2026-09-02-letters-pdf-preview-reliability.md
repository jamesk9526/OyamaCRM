# Letters PDF Preview Reliability Audit — 2026-09-02

## Scope

Audited the OyamaLetters Canvas Builder, live server PDF modal, Publish Review navigation and embedded preview, server PDF typography/pagination, merged salutation handling, automatic signature placement, loading/error states, and narrow-screen reachability.

## Findings and repairs

- The PDF font parser tested the substring `serif` before `sans-serif`. Arial/Helvetica canvas content therefore became Times in the server PDF, changing line wrapping and vertical pagination. Sans-serif families now resolve to Helvetica first.
- Automatic signatures were preceded by a fill spacer that consumed all remaining body height. The sign-off now follows the letter body with a compact normal spacer.
- Recipient-address deduplication is regression-tested to preserve the merged salutation immediately following the address.
- Publish Review previously requested its embedded sample once before the template loaded and again after it loaded. The preview now waits for the template and cancels any replaced request.
- Builder and Publish Review PDF requests are single-flight, abort on teardown, and time out after 45 seconds. A failed builder preview is visible outside the unopened modal.
- Sample-PDF responses now carry `x-request-id`; structured errors, server logs, and audit metadata use the same reference. Client diagnostics no longer log raw print-body HTML.

## Validation evidence

- `pnpm exec vitest run tests/unit/letters-pdf-layout.test.ts tests/unit/letters-merge.test.ts tests/smoke/letter-builder-ui-source.test.ts tests/smoke/letters-printables-generate-source.test.ts` — 68/68 passed.
- `pnpm typecheck` — web and server passed.
- `pnpm lint` — 0 errors; 107 pre-existing repository warnings.
- `git diff --check` — passed (line-ending notices only).
- Browser regression against the existing local Letters template:
  - Canvas Preview returned the server PDF and opened the live modal.
  - Publish Review navigation completed and the embedded server PDF loaded as a blob URL with no visible error.
  - Desktop layout retained the primary review actions and PDF panel.
  - 390 × 844 layout retained Back to Canvas, Validate, Open Sample Server PDF, Publish & Continue, review tabs, and the Saved Template Preview without overlap.

## Remaining boundary

The Letters workspace remains partially working overall because exact mixed inline typography and external print-vendor/storage handoff depth are still broader product follow-ups. The repaired preview and base-layout path is production-safe within the verified scope above.
