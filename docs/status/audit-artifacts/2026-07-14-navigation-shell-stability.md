# Navigation Shell Stability Pass

Date: 2026-07-14

Status: Partially Working

## Scope

Shared DonorCRM, Compassion CRM, HRM, Watchdog, and Webmaster navigation shells: sidebar behavior, fixed TopBar footprint, internal scroll roots, and mobile navigation drawer accessibility.

## Audit findings

- The root DonorCRM shell exposed its permanent sidebar at the `md` breakpoint (`768px`), while the documented shared contract and all module shells use a drawer below `1024px`.
- Sidebar collapse state and the compact-desktop media query initialized after the first render, causing the content width and donor TopBar inset to visibly change.
- Non-donor headers changed height from `98px` to `72px` while scrolling and their shells changed top padding at the same time. Mega navigation also moved down the screen while scrolling.
- The shared mobile drawer handled Escape and scroll locking but did not keep keyboard focus inside the dialog or close itself on resize to desktop.

## Changes

- Standardized permanent sidebar visibility at `lg` (`1024px`) and retained drawer navigation below that breakpoint.
- Applied persisted navigation and compact-sidebar state in browser layout effects before paint.
- Reserved stable TopBar and Donor mega-navigation space, removed shell padding transitions, added `min-h-0` flex safeguards, and reserved scrollbar gutter on CRM scroll roots.
- Upgraded the mobile drawer with modal labelling, focus entry/restoration, Tab containment, a 44px close target, and desktop-breakpoint auto-close behavior.
- Added cumulative layout-shift collection to `scripts/qa/responsive-ui-pass.mjs` for the next live viewport audit.

## Validation

- `pnpm exec vitest run tests/smoke/crm-visual-refresh-source.test.ts`: 9/9 passed.
- `pnpm typecheck`: web and server passed.
- `pnpm build`: passed; 198 routes generated.
- Focused ESLint: 0 errors; 2 existing unused-constant warnings in `app/components/layout/DonorMegaMenu.tsx`.
- `git diff --check`: passed.

## Outstanding verification

The in-app browser surface was unavailable and no local web/API server was listening, so a live Playwright viewport/CLS audit was not run in this session. Run `pnpm test:e2e:responsive` against a local authenticated web/API pair before changing this status to `Working`.
