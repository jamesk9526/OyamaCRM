# oyamaCreate Studio implementation

Accepted 2026-11-03. Letter-first editable pages, donor-aware fundraising, appeal packs, responsive linked email and a versioned Brand Hub all live in oyamaCreate. Use the existing open-source editor and Chromium renderer; defer DOCX. Application appearance and Compassion clinical access remain separate.

## Delivery sequence

- [x] Versioned design contract, block registry and presets; additive persistence and permissions.
- [x] Brand drafts, immutable publication, asset/preset migration and compatibility readers.
- [x] One logical paginated editor with working block inspectors and donor preview.
- [x] Appeal-pack proofs, recipient manifests, frozen approval and print integration.
- [x] Automatic responsive email adaptation, protected rich overrides and giving attribution.
- [x] Centralized output-brand controls and reviewed public-output updates.
- [x] Focused tests, browser/PDF evidence, types/lint/build and documented rollout.
- [ ] Deployment acceptance: disposable MySQL, real staff/browser input methods, inbox/provider checks, worker/storage/printer verification and reviewed organization cutover.

## Invariants

New structured designs have one canonical document. Legacy content remains intact until explicit conversion. Draft changes supersede pending approvals. Publication and delivery are distinct explicit actions. Approved content, donor facts, images, typography and branding are frozen. Preview never marks a print artifact printed or mailed. Real sends and publishing are not development verification.

Editable pages use one ProseMirror document and browser fragmentation, with measured, bounded pagination state; automatic boundaries are view state. A current PDF is required for print approval. Oversized unbreakable content has an actionable error rather than an infinite reflow.

Brand precedence is document override, selected profile/preset, then organization default. Brand changes are drafted and published as immutable revisions. Existing designs and public outputs retain their pinned revision until an explicit reviewed update.

## Verification

Exercise every block, editor reflow/cursor/undo/paste, 1/2/5/20-page documents, donor availability and permissions, sync overrides, multi-piece proofs, QR/giving attribution, brand publication/concurrency and legacy compatibility. Capture desktop/tablet/phone and rasterized PDFs under `docs/status/audit-artifacts/2026-11-03-create-studio`. Update the required status documents with actual results and any unavailable external checks.

Implementation uses CSS fragmentation over one ProseMirror document, with derived horizontal page positions and a fitted phone preview. It uses the installed open-source editor packages and Chromium; no paid pagination package was added. Final PDF generation rejects oversized unbreakable content and validates page furniture. Print proofs are independently approved before production events.

See [verification, rollout and rollback](../status/audit-artifacts/2026-11-03-create-studio/verification.md). Public campaign pages keep the existing Webmaster publication pipeline. Rich donor appeal pieces can disable Web/SMS/Social and use a separate reviewed public content piece; unreviewed rich public projections are blocked. DOCX remains deferred.
