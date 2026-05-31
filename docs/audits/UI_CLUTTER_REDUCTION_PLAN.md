# UI Clutter Reduction Plan

Date: 2026-05-31
Scope: Remove or neutralize non-working UI affordances while preserving route compatibility.

## Goal

Ensure every visible control in major workspaces is either:

1. fully wired and functional,
2. intentionally disabled with clear reason and recovery path,
3. or hidden until implementation is ready.

No fake controls, fake counters, or dead links presented as production behavior.

## Current Evidence

1. Non-working ribbon commands have existed in contextual toolbars and workspace surfaces.
2. Placeholder/in-development surfaces remain in multiple modules.
3. Test/source expectation drift indicates UI contracts are changing without synchronized guard updates.

## Completed During This Session

1. Contextual ribbon now filters unwired commands.
2. Disabled dead "more commands" affordance removed from contextual ribbon.
3. Top bar centering and overlap cleanup continued in donor workspace layout paths.

## Phase Plan

### Phase 1: Command Truth Matrix

For each workspace command surface (TopBar mounts, ribbons, command bars):

1. Create a command matrix with columns:
- command id,
- UI location,
- handler present,
- route/API dependency,
- status (`Working`, `Partially Working`, `Demo Only`, `Broken`, `Not Implemented`).
2. Hide any command with no handler and no planned destination in current release.

### Phase 2: Placeholder and Dead-link Reduction

1. Replace generic placeholders with explicit status cards and next-step guidance.
2. Remove links to missing workspace pages.
3. Route unfinished workspace actions to a single clear "in development" explainer state.

### Phase 3: Page-level Cleanup Targets

1. Compassion placeholder-heavy pages.
2. Event pages with partial status surfaces and stale command expectations.
3. Webmaster and Watchdog secondary panels that present scaffolded controls.

### Phase 4: Source-of-Truth Alignment

1. Update source-guard tests for intentional UI contract changes.
2. Update status docs when visible commands change behavior.
3. Add regression checks for command wiring in key workspaces.

## Quality Gates For Each UI Cleanup Slice

1. `pnpm typecheck`
2. `pnpm test`
3. target smoke/spec update for changed UI contracts
4. manual browser pass on compact desktop (`1280x720`, `1366x768`) and mobile (`390x844`)

## Exit Criteria

1. No known dead buttons in TopBar and contextual ribbons.
2. No known links to non-existent routes from primary navigation.
3. Placeholder pages clearly marked and not advertised as complete workflows.
4. Test expectations aligned with intended canonical UI contract.
