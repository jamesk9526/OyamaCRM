# Letter builder verification — 2026-11-02

## Implemented and repaired

Modular mockup-inspired builder kit, structured editor controls, CRM token insertion, image uploads, layout persistence and recipient selection are connected behind the existing organization flag. Legacy conversion preserves its original revision. The shell waits for flag resolution before mounting an editor, preventing an unnecessary legacy editor mount. The proof request sequence now invalidates a request if the recipient changes while saving. Empty proof panels are hidden, paper/recipient fields have explicit accessible names, and the mobile command header keeps its document title readable.

Browser testing found PDF.js failed at runtime when bundled by the dev webpack pipeline (`Object.defineProperty called on non-object`). The viewer now loads pinned browser modules and worker directly from generated local public assets. `scripts/prepare-letter-pdf-viewer.mjs` prepares both app public directories during web/Letters development and builds. No remote CDN is used.

## Actual verification

- Web and server TypeScript checks passed.
- Targeted lint passed with no warnings for the builder, UI kit and proof viewer.
- 78 tests passed in seven focused renderer/document/merge/print suites.
- `pnpm install --frozen-lockfile --ignore-scripts` passed.
- `node tests/e2e/letters-builder-fixture.e2e.mjs` passed against the actual Next app and actual builder components with synthetic, intercepted API responses; it changed no live CRM records.
- Browser checks: text insertion, revision saves, A4 setting persistence, save-conflict draft retention, visible render failure, successful six-page PDF viewing, page-two navigation, and 390/768/1280/1600-pixel overflow checks. No browser page errors in the passing run.
- Chromium produced six-page Letter and six-page A4 PDFs. PyMuPDF extraction found all 70 numbered paragraphs and the final explicit-page marker. All pages contained text. Page widths were asserted against Letter/A4 dimensions.
- All 12 PDF pages were rasterized and visually reviewed via `pdf-contact-sheet.png`; no page-edge clipping was apparent at contact-sheet scale. Desktop and phone screenshots were inspected against the supplied mockup composition. This establishes a visual review, not pixel equivalence.

## Limits

The local MySQL/API services were not listening. Browser API responses are fixtures, not proof of database-backed authorization, tenant isolation, worker concurrency, automation idempotency, production saves, batch approval, or matching-label correctness. Complete approval/generation integration and autosave/recovery remain outstanding. No production deployment, live organization activation, or physical-printer test occurred. Intermittent dev chunk parse failures occurred during recompilation; a settled final run passed without page errors.

## Reproduction

Start `pnpm dev:web`, then run the focused Vitest suite to create the PDF fixtures before the browser fixture. Screenshots, original PDFs, extracted-check results, rasterized pages and browser results are in this directory. The upgrade remains under its organization feature flag.


## Second interaction and screenshot round

Fixed Text/Heading palette insertion so new text begins in a separate block instead of merging into the preceding heading. Toolbar active states and font/style selections now subscribe to editor selection updates; the browser test verifies keyboard Bold updates aria-pressed. Added refresh/close warning for unsaved changes, removed the inaccurate QR label from the image-only button, and scroll completed proofs into view while respecting reduced-motion preferences.

Expanded browser fixture passes on an isolated Next dev instance (port 3019, `.tmp/letters-qa-next` build directory). Screenshot capture asserts both kit and toolbar styles have loaded. Dev overlay chrome is hidden only for screenshot capture. Fresh captures: `round-two-review-desktop.png`, `round-two-settings-mobile.png`, `round-two-block-search-mobile.png`, and `round-two-proof-mobile.png`. The phone settings/proof screenshots were visually inspected. Synthetic APIs and real PDF viewer are used; no live writes occurred. Targeted lint and web TypeScript pass; six focused print/pagination tests pass again.

For isolated reproduction, set NEXT_DIST_DIR=.tmp/letters-qa-next when starting Next on port 3019 and E2E_WEB_BASE_URL=http://localhost:3019 when running the browser fixture. Restore any auto-added temporary Next type paths before committing tsconfig.json. Normal production builds retain the default .next directory.


## Canonical controls and PDF correctness pass (subagent review)

Three subagents separately audited formatting/insertion ownership, PDF viewer lifecycle/actions, and server rendering. Integrated results:

- Insertion is owned by the palette; formatting by the compact icon toolbar; paper/margins by the extracted Document settings component; branding links to its existing organization home; PDF tools live in the viewer. Removed duplicate Preview action from the recipient card.
- Old proof bytes retain their rendered revision/recipient label; saved edits and failed refreshes cannot make them current. Download/print disable for stale or rendering states. Viewer document state resets on PDF URL replacement.
- Missing/unsafe frozen images fail explicitly, signature markers survive sanitation to avoid duplicate automatic signatures, and header/footer visibility, reserved-margin fit and printable-width checks have focused regression coverage. Renderer version bumped to v2.1.
- 85 tests pass in eight focused suites. Web/server TypeScript and targeted lint pass. Browser fixture passes save/conflict, proof replacement/failure, stale-action disablement, canonical Preview count, and SHA-256 equality of downloaded PDF bytes with the original. Screenshot evidence: `canonical-review-desktop.png`, `canonical-settings-mobile.png`, `canonical-block-search-mobile.png`, `canonical-proof-mobile.png`. Desktop/mobile settings images were visually inspected.
- This pass does not establish live database authorization/concurrency, automation idempotency, batch approvals, all legacy settings migration, full recipient/custom header-column composition, unsupported-glyph coverage, or physical printing.
