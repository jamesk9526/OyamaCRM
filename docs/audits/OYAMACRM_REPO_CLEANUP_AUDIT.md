# OyamaCRM Repo Cleanup Audit

Date: 2026-05-31
Scope: Repo-wide cleanup audit focused on safe modularization and UI truthfulness (no route deletions in this pass).

## Executive Summary

OyamaCRM currently has strong coverage breadth but is blocked by release-gate failures and accumulated UI/code clutter.
The immediate release blocker is now lint, with dependency and unused-code cleanup still pending.

This audit captures:

- current validation gate outcomes,
- high-confidence cleanup targets,
- non-working UI reduction priorities,
- and governance rules to prevent new legacy drift.

## Validation Matrix (Current Run)

| Gate | Command | Status | Evidence |
|---|---|---|---|
| Lint | `pnpm lint` | Failed | `166 problems (28 errors, 138 warnings)`; key blockers include `react-hooks/rules-of-hooks`, `@next/next/no-html-link-for-pages`, `react-hooks/refs`, `@typescript-eslint/no-explicit-any`, `@typescript-eslint/ban-ts-comment`. |
| Typecheck | `pnpm typecheck` | Passed | Web and server typechecks pass after fixing `WorkspaceAction` tone typing in OyamaEmail top bar. |
| Tests | `pnpm test` | Passed | `66 passed (66)` files; `570 passed (570)` tests after aligning source-guard assertions with canonical dashboard/tasks primitives. |
| Build | `pnpm build` | Passed | Next.js production build compiles and generates all routes successfully. |
| Dependency scan | `npx depcheck` | Failed (non-zero due findings) | Unused deps: TipTap table/text-style/color/image/placeholder set; unused dev deps: `@rolldown/binding-win32-x64-msvc`, `@tailwindcss/postcss`, `tailwindcss`; missing deps: `@swc/core`, `esbuild`. |
| Unused code scan | `npx knip` | Failed (non-zero due findings) | Unused files: `148`; unused exports: `110`; unused exported types: `214`; duplicate exports: `1`; unused deps: `9`; unlisted deps: `postcss` in two config files. |

## Key Findings

1. Release gate is currently Broken.
- Typecheck, tests, and build are now green.
- Lint remains red and is the current primary blocker for release readiness.

2. Test expectations are drifting from current UI architecture.
- Source-guard assertions were realigned to current canonical dashboard/tasks markers.
- This reduces false-negative test failures while preserving non-breaking guard intent.

3. UI clutter is still present in partially wired surfaces.
- Session evidence shows placeholder and in-development surfaces are still visible across several workspaces.
- Functional-only UI policy is not consistently enforced yet.

4. Documentation sprawl is increasing legacy drag.
- Root-level plan markdown files and duplicate/overlapping audits reduce discoverability and increase drift risk.

5. Unused code/dependency backlog is large and needs staged cleanup.
- Knip findings include likely true positives and known false-positive classes (desktop entrypoints, dynamic runtime wiring).
- Cleanup must be tiered by risk.

## Priority Cleanup Backlog

### P0 (Release Gate Recovery)

1. Triage lint errors by category, starting with:
- `react-hooks/rules-of-hooks`,
- `@next/next/no-html-link-for-pages`,
- `react-hooks/refs`,
- `@typescript-eslint/ban-ts-comment`,
- `@typescript-eslint/no-explicit-any`.
2. Run a lint-focused narrow pass on highest-impact files:
- `app/components/layout/TopBar.tsx`,
- `app/components/ai/AGENTStewardWorkspace.tsx`,
- `app/components/events/EventsWorkspaceSelectorPage.tsx`,
- `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx`.
3. Re-run `pnpm lint` and keep a dated error-count trend in audit notes.

### P1 (UI Clutter and Truthfulness)

1. Remove or hide non-working controls unless they route to clear in-development status.
2. Require command wiring checks before rendering ribbon actions.
3. Standardize placeholder messaging to approved status labels only.

### P2 (Repo Hygiene)

1. Stage markdown consolidation and archival (see `DELETABLE_MARKDOWN_FILES.md`).
2. Stage dependency and unused-file cleanup in risk-based batches (see `UNUSED_CODE_CANDIDATES.md`).
3. Add source-guard tests around canonical route ownership for major workspaces.

## Already Completed in This Session

1. Top bar and ribbon modularization improvements were applied in safe, additive form.
2. Event workspace ribbon duplication was reduced via shared `EventScopedRibbonButton` usage.
3. Contextual ribbon now filters out non-wired commands and removes dead disabled affordances.
4. OyamaEmail `WorkspaceAction` tone type mismatch was fixed (`secondary` -> `default`), unblocking typecheck/build.
5. `tests/smoke/crm-visual-refresh-source.test.ts` was updated to assert current canonical dashboard/tasks primitives; full test suite now passes.

## Constraints For This Cleanup Cycle

1. No route deletions in modularization-only passes.
2. No hidden breaking changes to canonical workflows.
3. All deletions/merges require reference scan and rollback plan.
4. Update status docs and governance docs in the same PR as cleanup changes.
