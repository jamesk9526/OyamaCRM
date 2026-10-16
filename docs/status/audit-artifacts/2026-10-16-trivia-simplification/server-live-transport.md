# Trivia live transport audit — October 16, 2026

The authenticated host and projector now use an event-scoped live read and validated host commands. Existing organization and view/edit permission middleware still gates both routes. Temporary host commands reuse the same command service after the existing access-pass authorization.

## Evidence and changes

- Previous `GET /state` hydrated configurations for every organization, including rounds, teams, score history, snapshots, audits, and temporary access sessions. It could refresh the event roster and invoke broad persistence. Live GET now reads only the requested organization's event configuration, game content, teams, and score history, with no roster synchronization or writes.
- Previous live PATCH accepted arbitrary fields, hydrated the entire store, and called `persistStore`. That path iterated events and deleted/recreated rounds/questions, teams, score actions, snapshots, audits, and access passes. A host command now updates one configuration and inserts one audit in a transaction. It never deletes/recreates game records.
- GET returns an ETag derived from event content, scores/history, and stored live state. An unchanged request with `If-None-Match` returns HTTP 304. Countdown seconds do not alter the revision.
- Host commands validate stage, round, question index, winner team, status, and timer duration. Clients cannot replace arbitrary live JSON through this route. Missing or foreign events return 404 instead of fabricated default live state.
- A supplied stale revision returns 409 with authoritative state. A conditional configuration update also detects a competing storage write between reading and saving. The transaction does not insert a success audit when that update loses the race.
- Running timers store an absolute deadline. Pause freezes the remaining deadline duration; resume creates a new deadline. Expired deadlines resolve to zero without a timer tick write. Leaving a timed stage stops the timer.
- Legacy event-route aliases resolve within the organization and return the canonical event identity. Raw event responses include durable timestamps and baseline scoring/display settings. Repeated Start on an already running deadline is idempotent and performs no write or audit insertion.
- Whole-module saves reconcile newer server live state and condition live JSON updates on storage timestamps so a stale builder/score snapshot cannot overwrite a newer host command. Recovery stamps restored live state and pauses its timer for a deliberate restart.

## Validation

- `pnpm exec vitest run tests/unit/trivia-live-route.test.ts tests/unit/trivia-remote-host.test.ts tests/smoke/trivia-event-night-source.test.ts`: **33 passed**.
- `pnpm typecheck:server`: passed.
- Focused ESLint on the modified server services/routes and unit tests: passed.
- API tests use mocked Prisma storage and exercise actual Express middleware/routes through local loopback. No production database was changed. Initial sandbox-only attempts failed because filesystem cache renames and local loopback were restricted; the successful run used the repository temporary directory and approved loopback access.

## Remaining limits

The legacy builder, bulk scoring, imports, and temporary-session authentication/read paths still hydrate/persist broad module state. This change removes that path from normal host/projector synchronization and temporary host command writes; it is not a rewrite of every Trivia persistence operation. Broad content saves can still conflict with one another. Production request latency and database contention have not been measured; the write/query reductions above are code-path evidence and mocked call assertions, not production benchmark claims.
