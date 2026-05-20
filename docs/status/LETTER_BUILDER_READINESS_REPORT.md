# Letter Builder Readiness Report

Date: May 19, 2026

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

## Partially Ready

- Version history is represented as a workflow entry but is not a full version browser.
- Duplicate Template and Archive Template are present in More Options, but need backend persistence workflows before being marked complete.
- Typography controls serialize inline styles for selected text. A future migration should add document-level typography defaults to the template schema.

## Not Ready For Removal Of Warnings

- Any UI that implies backend version history, duplication, or archival should remain clearly secondary until persistence and audit events are wired.
- No automatic send, queue, or publish action should be added without confirmation and audit coverage.

## Verification

Passed locally:

```bash
pnpm typecheck:web
```

Targeted tests to run:

```bash
pnpm exec vitest run tests/smoke/letter-builder-ui-source.test.ts
pnpm exec vitest run tests/unit/letters-merge.test.ts tests/unit/letters-print-layout.test.ts
pnpm test:e2e
npm run build
```
