# UI Refresh Readiness Report

Date: May 19, 2026

## Completed

- Shared CRM UI primitives created.
- Dashboard metric card surface refreshed through existing `StatCard`.
- Dashboard command center softened.
- Constituents page first pass completed with shared action, metric, filter, table, and badge primitives.
- Constituent tags now show a calmer max-two display with `+N more`.
- Constituents row three-dot More menu is present alongside the visible Edit action.
- Donations page first pass completed with shared action, metric, filter, and table primitives.
- Donations row three-dot quick-actions menu remains intact.
- Meetings page first pass completed with shared action, metric, filter, badge, and empty-state primitives.
- Dashboard ribbon controls replaced with a single `CRMActionBar` while preserving existing section jumps, create routes, Steward prompts, refresh, edit layout, lock, and widget controls.
- Dashboard quick action cards now use the shared `CRMQuickActionCard` pattern.
- Top bar refreshed to a light SaaS-style surface with dark controls; Steward runtime status tokens were updated for readable light-background contrast.
- Donor sidebar grouping/style refreshed with a separate Home group and Core CRM group while preserving existing destinations.
- Tasks page now uses the shared action strip and `CRMDataTable` shell without replacing task complete/delete behavior.
- Letter builder scroll containment fixed so the builder header, side panels, floating command bar, canvas, and bottom status stay inside the document workspace instead of sliding under the global top bar.
- Letter builder insert/format bars received icons.
- Plan/checklist and component-system docs created.

## Not Yet Complete

- Donations row/status styling cleanup.
- Meetings row/card styling cleanup.
- Dashboard 1366x768 and 1280x720 browser screenshot verification.
- Full e2e/build verification.

## Verification

Last known focused checks from this pass:

```bash
pnpm typecheck:web
pnpm exec vitest run tests/smoke/crm-visual-refresh-source.test.ts tests/smoke/letter-builder-ui-source.test.ts
```

Build note: a prior sandboxed `npm run build` failed because Turbopack could not read `node_modules/.pnpm/remark-gfm@4.0.1/node_modules/remark-gfm/index.js` due to Windows access denied. The elevated rerun was declined, so build remains unverified in this pass.
