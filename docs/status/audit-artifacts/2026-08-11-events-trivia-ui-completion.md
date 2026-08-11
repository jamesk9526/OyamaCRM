# EventSTUDIO and Trivia UI Completion — 2026-08-11

## Scope and findings

The pass reviewed the mounted EventSTUDIO and Trivia shells, route structure, event discovery, planning/night-of navigation, status and destructive actions, empty/loading states, responsive behavior, focus treatment, and the boundary between EventSTUDIO registration data and Trivia game operations.

The underlying workflows were already substantial. The main product defects were presentation and task selection: EventSTUDIO used a separate purple studio treatment, Trivia mixed dark navy, purple, and remapped white components, mobile navigation exposed long horizontal or fixed rails, the EventSTUDIO root duplicated the event library, the registry exposed a dead Import Event List control, and Trivia presented six equal-weight event actions before a producer could simply resume work.

## Implemented

- Rebuilt both admin shells on one light Fluent/Segoe system with compact command bars, neutral canvases, predictable blue/purple product accents, visible focus, desktop rail collapse, mobile modal navigation, and event-preserving switchers.
- Preserved the dark, high-contrast Trivia visual builder and audience projector surfaces because those are presentation tools rather than CRM administration.
- Made `/events/events` the canonical EventSTUDIO entry and redirected `/events` to it; retained `/events/workspace` as a compatibility selector.
- Rebuilt the Events registry around Upcoming, All, and Archived views, search, templates, event creation, live metrics, and one Open workspace action. Removed the nonfunctional import button and stale static workflow-coverage claims.
- Rebuilt Trivia home around Build → Register → Run → Score and a recent-event resume list.
- Added search and status views to the Trivia event library. Reduced the default action set to one context-aware Open/Resume action; builder, projector, lifecycle, and guarded delete actions remain in a secondary menu.
- Replaced the Trivia overview's unrelated colored card wall with one grouped task list while retaining check-in, host, scoring, judging, scoreboard, projector, answer key, print, and recovery routes.

## Validation

- `pnpm typecheck:web` — passed.
- Focused ESLint for all changed TypeScript/TSX files — passed.
- `tests/smoke/trivia-event-night-source.test.ts` — 11/11 passed.
- Browser desktop checks covered the EventSTUDIO registry and Trivia home with no console errors.
- Browser checks at 390×844 confirmed no horizontal document overflow in either product, reachable primary actions, and working modal navigation.

## Remaining release boundaries

- Verified online Event ticket payment remains Not Implemented; paid reservations must stay labeled pending/offline-follow-up.
- Trivia storage remains the existing organization-scoped JSON service and still needs a relational migration before multi-instance hosting.
- Database-backed registration/TableLink integration coverage should continue to run whenever the local MySQL service is available.
