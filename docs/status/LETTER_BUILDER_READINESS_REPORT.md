# Letter Builder Readiness Report

Date: June 4, 2026

## Completed

- Rebuilt the editor chrome into a focused document workspace.
- Removed the stacked workspace ribbon and editor toolbar rows.
- Added one top action bar with `Preview`, `Save Draft`, `Publish`, and More Options.
- Added a left insert panel focused on block insertion.
- Added right sidebar tabs for Insert, Format, Page, and Settings.
- Added a floating command bar and slash command menu.
- Added TipTap font family, font size, and line-height commands.
- Kept merge-field insertion, unsupported-field detection, and legacy token normalization visible.
- Moved preview context into the right Settings tab under Test Preview.
- Added a bottom status bar for words, characters, read time, save status, and merge health.
- Added confirmation gating before publish handoff.
- Added source smoke coverage for required builder test IDs and controls.
- Added the unified `/oyama-letters/generate` production center with document type, template, real audience selection, merged HTML preview, generated PDF blob preview, and generation history.
- Renamed the staff-facing workspace to OyamaLetters and deprecated the old `/letters-printables` home route.
- Added inline PDF streaming support through `?preview=1` on single and batch PDF export endpoints.
- Added missing merge-field highlighting and fallback/filter parsing to the server merge engine.
- Added single through double line-height formatting options to the canonical canvas builder and preserved line-height metadata in server PDF rendering.
- Added explicit blank-line, half-inch, one-inch, and push-to-bottom layout controls.
- Preserved intentional blank paragraphs and spacer blocks in PDF output, rendered dividers consistently, and reduced aggressive blank-line cleanup.
- Made signature blocks optional for publish preflight and donation-to-letter template handoff.
- Added a modal signature visual builder with draw/upload modes, saved-signature thumbnails, and live rendered preview.
- Added uploaded signature-image rendering to server-generated PDFs and prevented duplicate signature output.
- Added server-backed letter image uploads plus canvas selection and width controls that persist into PDFs.
- Added Donations multi-select handoff to OyamaLetters as a temporary unique-donor list, including a visible monthly-donor selection shortcut.

## Partially Ready

- Version history is represented as a workflow entry but is not a full version browser.
- Duplicate Template and Archive Template are present in More Options, but need backend persistence workflows before being marked complete.
- Typography controls serialize inline styles for selected text. A future migration should add document-level typography defaults to the template schema.
- OyamaLetters Generate Center uses the existing jsPDF server renderer. Chromium/PDF.js fidelity is still a follow-up.
- The server PDF renderer preserves supported spacing and line height, but arbitrary browser-only CSS is still outside its fidelity contract.
- Label presets and ZIP exports are not production-complete.

## Not Ready For Removal Of Warnings

- Any UI that implies backend version history, duplication, or archival should remain clearly secondary until persistence and audit events are wired.
- No automatic send, queue, or publish action should be added without confirmation and audit coverage.

## Verification

Passed locally:

```bash
pnpm typecheck
pnpm exec vitest run tests/unit/letters-pdf-layout.test.ts tests/unit/letters-print-layout.test.ts tests/unit/letters-merge.test.ts tests/smoke/letter-builder-ui-source.test.ts
```

Targeted tests to run:

```bash
pnpm exec vitest run tests/smoke/letter-builder-ui-source.test.ts
pnpm exec vitest run tests/unit/letters-merge.test.ts tests/unit/letters-print-layout.test.ts tests/unit/letters-pdf-layout.test.ts tests/smoke/letters-printables-generate-source.test.ts
pnpm test:e2e
npm run build
```
