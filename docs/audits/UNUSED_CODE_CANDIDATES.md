# Unused Code Candidates

Date: 2026-05-31
Sources: `npx depcheck`, `npx knip`

## Snapshot

From current scans:

- Knip: `148` unused files, `110` unused exports, `214` unused exported types, `1` duplicate export.
- Depcheck: unused runtime deps (TipTap extensions), unused dev deps, and missing deps (`@swc/core`, `esbuild`).
- Knip additional signals: unlisted dependency usage (`postcss`) and extra unused deps not listed by depcheck (`html2canvas`).

## Tiered Candidate List

### Tier 1: High-confidence cleanup candidates

1. Temporary and probe files:
- `.tmp-probe-widget.mjs`
- likely disposable one-off scripts not referenced by package scripts.

2. Unused dependency candidates (verify with `rg` import scan before removal):
- `@tiptap/extension-color`
- `@tiptap/extension-image`
- `@tiptap/extension-placeholder`
- `@tiptap/extension-table`
- `@tiptap/extension-table-cell`
- `@tiptap/extension-table-header`
- `@tiptap/extension-table-row`
- `@tiptap/extension-text-style`
- `html2canvas` (from knip)

3. Unused dev dependency candidates:
- `@rolldown/binding-win32-x64-msvc`
- `@types/bcryptjs`
- `@types/uuid`
- `@tailwindcss/postcss`
- `tailwindcss`

### Tier 2: Needs careful validation (possible false positives)

1. Desktop runtime entrypoints flagged as unused:
- `Desktopapp/*`
- `OyamaBridgeDesktopServer/*`

These may be runtime-launched and not imported through web app entry graphs.
Do not delete without packaging/startup verification.

2. Public assets/scripts:
- `public/sw.js`
- screenshot capture scripts under `scripts/`

May be used by manual workflows or deployment paths.

### Tier 3: Export hygiene cleanup

Knip reports large sets of unused exports/types across UI modules and server services.
Recommended approach:

1. Remove unreferenced exports in small module-focused batches.
2. Re-run typecheck/tests after each batch.
3. Keep public API exports if used by dynamic import, reflection, or cross-repo consumers.

## Configuration Findings

1. Unlisted dependency usage:
- `postcss` referenced by `postcss.config.mjs` and `apps/letters/postcss.config.mjs`.

2. Depcheck missing dependencies:
- `@swc/core` referenced in `/.swc-esbuild-check.cjs`.
- `esbuild` referenced in `/.swc-esbuild-check.cjs`.

3. Knip hints:
- Add and tune `knip.json` for root and `apps/letters` workspaces to reduce noise and increase confidence.

## Proposed Cleanup Sequence

1. Add `knip.json` and baseline ignore rules for known runtime entrypoints.
2. Remove or justify Tier 1 dependencies and temp files.
3. Resolve dependency declaration mismatches (`postcss`, `@swc/core`, `esbuild`).
4. Tackle unused exports by bounded domain slices:
- `app/components/dashboard/*`
- `app/components/watchdog/*`
- `server/src/services/*`
5. Re-run gates after each slice: `pnpm typecheck`, `pnpm test`, `pnpm lint`.

## Guardrails

1. No large delete sweeps in a single commit.
2. Keep a rollback-safe batch size.
3. Do not remove desktop/server entry files without explicit runtime verification.
4. Record each accepted removal batch in `docs/audits`.
