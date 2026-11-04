# oyamaCreate Studio verification

All records, recipients, giving facts, provider outcomes, images and response codes in this folder are **synthetic acceptance fixtures**. No real messages, payments, publications, print jobs, clinical changes or production database migrations were executed.

## Behavior delivered

- Letter-first Studio inside a campaign, with one logical ProseMirror document, searchable block insertion, formatting, contextual inspectors, assets, reusable sections, rich paste, undo/redo, revision recovery and optimistic autosave.
- Derived editable page boundaries, page outline and zoom. Letter/A4/Legal, orientation, margins, page breaks, first/continuation regions, keep rules, repeated table headings and overflow diagnostics. The final Chromium PDF remains authoritative for print approval.
- Writing, image, table, column/group, signature, address/salutation, conditional, giving/ask, receipt, giving history, pledge, progress, QR and response-choice blocks; nine reviewable fundraising presets.
- Letter/reply-slip/#10/#9/DL envelope pieces, frozen assets/fonts/recipient snapshots, per-piece production status, exact-PDF approval, separate exports and a recipient manifest. Opening/exporting a PDF records no print/mail event.
- Sensitive-data markers travel with frozen Studio PDFs and generated records. Exact-PDF/export paths enforce the sensitive-merge permission; legacy generated-body lists mask restricted content and legacy actions cannot reconstruct it to bypass that boundary.
- Responsive/plain-text email adaptation and a rich editor for protected email customizations. Source changes require review. Sender/purpose/reply-to settings and explicit single-recipient test authorization reuse existing transports; provider acceptance remains distinct from delivery.
- Brand Hub drafts, immutable publication, preserved legacy IDs/assets/signatures/presets, channel profiles, reviewed adoption by existing designs/public outputs, and guarded legacy writes after brand publication. Giving/widget appearance controls open the central Brand Hub after cutover. Webmaster's Brand Kit entry now opens Create. Event/giving/widget/Create campaign pages consume pinned published branding.
- Hosted giving prefills validate allowed amounts, frequency and designation in the UI and checkout service. Opaque response codes supply tenant-scoped campaign attribution, without returning recipient identity/history.
- Optional formats per content piece allow a dedicated public page alongside a private letter/email appeal. Rich donor-specific Studio output cannot silently fall through the old plain public-copy renderer.

## Automated evidence

- Focused isolated unit/API/print regression set: **216 passing**, **6 opt-in MySQL checks skipped** when `CREATE_MYSQL_TEST_URL` is absent. Tests cover tenant ownership, sensitive giving permission, actual selected gifts, draft contention, legacy preservation, rich email protection, reviewed tests, publication impact/adoption, response destinations and multi-piece status.
- `studio-browser-checks.json`: production-mode Tiptap workflows with synthetic HTTP persistence, saved letter edits, protected rich email edits, 1/2/5/20-page typing/selection/paste/undo/redo/reflow, every catalog block saved/reopened, desktop/tablet/phone and Brand Hub navigation. The browser fixtures never authorize a real provider call.
- `proof-checks.json`: production Chromium renderer, exact 1/2/5/20-page fixtures, a long table with a six-row merged group, signature, reply slip and two envelopes. An oversized unbreakable group is rejected with an actionable error.
- `raster-checks.json`: **38 rasterized pages across 8 PDF files**; all 60 gift-table row labels retained; signature appears once (typed signature plus printed name); the printed QR decodes to the configured destination and opaque attribution code.
- Server type/build and web production build have passed; Prisma validates the additive schema. Targeted Studio/module lint has zero errors and warnings; the larger touched legacy route files have zero errors and five existing warnings. Final command outcomes are recorded in `checks.json` and the feature/readiness documents.

## Visual inspection

Compared the prior shared-copy layout in `../2026-11-03-oyama-create/after-shared-editor-1440.png` with `studio-1600.png` and `studio-email-desktop.png`. The newer Studio makes the physical letter the editing surface and moves tools/inspector alongside it. This is an intentional task-specific departure from the donor dashboard composition. No separate user-supplied screenshot file was available in this turn; inspection used the accepted plan and AGENTS.md guidance.

Inspected `studio-900.png`, `studio-390.png`, Brand Hub signatures and the proof contact sheets. The app retains navy text, blue actions, white controls and a pale-blue canvas. Phone tools use focused Write/Blocks/Settings/Proof panels and a fitted page with manual zoom. Authored typography, margins and brand colors remain document settings.

## Remaining environment verification

- No disposable MySQL service is configured. The six explicit Studio/Create migration and contention tests require an **empty** schema named `oyama_create_test_*`; they never use `DATABASE_URL`. An attempted existing `letters-merge-aliases.api.test.ts` run failed because localhost:3306 was unavailable. This is not counted as a passing check.
- Deployed authenticated acceptance, real inbox rendering, provider credentials/readiness, physical printers/envelope windows/offsets, and a backup/rollback rehearsal require the deployment environment.
- CSS fragmentation is the editable preview engine. Cross-platform input-method composition and complex printer/font combinations still need representative staff/device verification before enabling Studio as the organization default. Final PDF review remains required.
- DOCX import/export remains deferred as agreed. Existing channel builders retain their advanced content and operational functions. Rich Studio Web/SMS/Social projections require explicit adaptations; private donor data is never automatically published.

## Rollout and rollback

Apply `20261103200000_create_studio` after the existing Create migration in a backed-up deployment. Verify workers/storage, run the disposable MySQL suite and inspect recipient proofs. In **Create → Library → Brand**, save, preview and publish the initial migrated brand. In **Create → Settings**, review the two Studio/Brand Hub flags. Both default off; the independent live-delivery flag remains required.

Turning Studio's default off restores the prior editor for unconverted content. Existing structured drafts retain Studio and their history. Turning Brand Hub navigation off restores legacy navigation; published-brand write review stays enforced. All frozen releases, sent content and generated PDFs remain retained. Rollback is a flag change, never a data deletion.
