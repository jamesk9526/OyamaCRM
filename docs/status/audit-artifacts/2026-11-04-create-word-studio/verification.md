# oyamaCreate Word-style Studio and recoverable Trash

Implemented on 2026-11-04 using the approved [generated mockup](approved-builder-concept.png) as the visual reference. Generated block artwork is installed at `/images/oyama-create/block-icons.png` and used in the block gallery. The writing view uses a compact ribbon, left gallery, paper canvas, contextual inspector and light blue application background. The implementation retains campaign, recipient and appeal-pack controls, so the command area is taller than the concept. Output typography comes from the selected design and brand.

## Delivered behavior

- Focused writing view with an exit action, Home/Insert/Layout/Review ribbon, formatting, lists, indentation, spacing, links, find/replace and contextual table operations.
- Searchable visual blocks, editable fundraising patterns, live nested outline, image thumbnails and saved sections. Patterns insert at the current cursor rather than replacing the document.
- Contextual selection tools, slash and inline insertion, duplicate/remove/undo, keyboard moves and validated nested drag destinations. Images have direct captions, proportional resizing and keyboard width controls. Columns have adjustable dividers and preserve relative widths in print and email rendering.
- Fit-to-width canvas measured from available space, manual zoom, derived page thumbnails, first/continuation header and footer editing with inherited content, and stable logical document pagination.
- Direct Email editing in the common Studio layout. Shared changes flow back to Letter, protected overrides remain editable, and comparison actions retain or relink customizations. Removed shared sources retain customized email copies for review.
- Recoverable Trash for campaigns, campaign templates, assets, saved sections, signatures and brand presets. Reviewed removal and revision-checked restore preserve IDs and audit events. Pending deliveries and active defaults block removal. Historical output and image files remain available. New selections filter trashed resources, while existing selections continue to resolve.

## Verification

98 focused tests passed across Trash API, email reconciliation, editor block operations, Studio unit/API and production image suites. Seven opt-in MySQL tests were skipped because CREATE_MYSQL_TEST_URL is absent. The database test now includes the additive Trash migration and concurrent unique-entry/restore cases. Prisma schema validation passed. Web/server TypeScript checks, targeted lint and both production builds passed.

The production browser fixture uses synthetic CRM/auth responses with real React and Tiptap components. It passed direct writing and saving, pattern insertion and Undo, shared Email typing, protected email customization, switching back to Letter, desktop/tablet/phone overflow checks, and reviewed Trash/restore UI. Browser errors were empty. See [browser results](studio-browser-checks.json), [desktop letter](letter-desktop.png), [email editing](email-editing-desktop.png), [phone layout](builder-390.png), and [Trash](trash-desktop.png). API tests exercise real handlers with an in-memory synthetic database.

Production Chromium rendered 1-, 2-, 5- and 20-page fixtures, a seven-page appeal with long/merged tables, reply slip and both envelopes. An oversized group was rejected. The two-page fixture and seven-page appeal were rasterized and visually inspected. See [proof results](proof-checks.json), [appeal contact sheet](appeal-letter-contact-sheet.png) and [raster evidence](raster-checks.json).

## Release requirements and remaining verification

Deploy the additive `20261104120000_create_recoverable_trash` migration before deploying the API and web changes together. The existing organization Studio flag controls the new editor entry point. Exit writing view returns to campaign controls. Disabling Studio restores the previous entry point while retaining structured drafts. Trash records contain recovery state and should be retained during rollback.

Actual MySQL migration execution and concurrency remain unverified. The browser fixture does not cover every pointer-drag/IME/resize combination, every legacy HTML conversion, or real provider inbox rendering. Expanded acceptance of these interactions and a reviewed organization rollout remain required before claiming full production readiness. No live messages, brand publication, production printing or deployment occurred. Existing Compassion work was preserved.


## Follow-up media audit

89 focused tests passed across eight image/branding/Trash/editor suites. The media browser fixture was updated for the direct Email canvas and passed all ten checks against the production build, including real anonymous media routes, logo/signature display in Letter and Email, phone email and a frozen two-page PDF after removal of originals. Results are recorded in the adjacent 2026-11-04-create-media audit folder.

The subsequent [CRM completeness audit](../2026-11-04-crm-completeness/verification.md) corrected the editing-position gap: stable block-relative bookmarks preserve the caret offset, backward text ranges and image selection across formats, safely clamping shortened customizations. Opened Letter and Email editors retain their instances. Three focused selection tests pass, and the updated production browser fixture verifies exact selected text survives the format switch alongside shared/protected copy and responsive/Trash checks.
