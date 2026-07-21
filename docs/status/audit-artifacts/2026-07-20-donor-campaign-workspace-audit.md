# Donor Campaign Workspace Audit — 2026-07-20

## Scope

- Audit and visual refinement of the donor Campaigns workspace.
- Regression check of dashboard, Letters, and OyamaEmail source contracts affected by the shared donor visual system.

## Implemented

- Replaced the legacy Campaigns card-grid framing with a donor-workspace portfolio hero, current-scope signal, compact metric cards, and a clear campaign-view control panel.
- Refined campaign cards to surface status, campaign type, goal progress, remaining amount or completion state, timeline, constituent giving count, and the established action set.
- Retained server-backed campaign load/create/delete behavior, year/all-years scope, active/inactive filter, detail/edit navigation, and Steward analysis actions.

## Validation

- `pnpm exec vitest run tests/smoke/crm-visual-refresh-source.test.ts tests/smoke/letter-builder-ui-source.test.ts tests/smoke/oyama-email-workspace-source.test.ts` — passed 27/27.
- `pnpm typecheck` — passed for web and server.

## Constraint

The dedicated in-app browser target (`iab`) was unavailable in this session. No alternate browser backend was used. Perform a live desktop/tablet/mobile review before release.
