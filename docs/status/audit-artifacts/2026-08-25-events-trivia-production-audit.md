# Events + Trivia production audit — 2026-08-25

## Scope

Static code and workflow audit of Event Studio navigation, event creation and ownership, public registration, tables and check-in, Trivia authoring, host controls, scorekeeping, projector displays, recovery, temporary remotes, API authorization, persistence, and release coverage.

## Outcome

The system has a coherent event-scoped route model and the primary trivia-night stations exist. This pass fixed the highest-confidence UI and boundary defects that could be addressed without staging infrastructure. Production rollout still requires migration verification, real multi-device rehearsal, and a concurrency follow-up described below.

| Surface | Result | Evidence / action |
|---|---|---|
| Event navigation | Fixed | One collapsible desktop right rail and mobile right drawer in `EventsStudioShell`; current event, status, date, location, active page, and event switcher remain visible. |
| Theme coherence | Fixed | Unified Event Trivia routes now share a scoped light/indigo admin theme. Legacy dark panels, dark inputs, neon actions, and low-contrast status labels are normalized across all staff workspaces; projector and phone remote remain intentionally dark. |
| Event/Trivia boundary | Working | Event owns registration, guests, tables, payments, and check-in; Trivia remains a conditional event mode and owns game content/live presentation. |
| Question authoring | Fixed | Existing visual single-question editor retained; prominent paste panel adds up to 200 pipe/tab-delimited questions atomically into a selected round. |
| Authoring validation | Hardened | Required question/answer checks, bounded points/timers, text truncation, alternate/choice limits, 500-question round ceiling, 100-round and 1,000-team server ceilings. |
| Authenticated API authorization | Fixed | Trivia reads require `view:events`; mutations require `edit:events`. Organization scoping remains enforced by authenticated org id. |
| Public registration | Working with rollout QA required | Rate limiting, capacity handling, confirmation workflow, unique table allocation, and payment choices are present. Requires staging payment/email rehearsal. |
| Temporary event-night access | Working with rehearsal required | Expiring, revocable, hashed access passes and role-limited actions are present. Requires multi-phone expiry/revocation rehearsal. |
| Check-in and tables | Working with rehearsal required | Search, scan, table management, walk-ins, replacements, exceptions, live counts, and reverse check-in are implemented. |
| Host/projector | Working with rehearsal required | Host guardrails, emergency hold, snapshots, reconnect indicators, timer states, answer reveal, leaderboard, and chrome-free projector routes are present. |
| Scoring/recovery | Working with known concurrency risk | Score history, undo, snapshots, audit, and recovery exist. Simultaneous stations still synchronize a full module state in parts of the client. |
| Canonical identity | Fixed | New integrated Trivia events initialize live and score records using the durable Event id; route selection also supports canonical and retained legacy ids. |
| Persistence | Relational; rollout gate open | Event-scoped Prisma models and one-time legacy import exist. Migration/count verification has not been run against staging in this environment. |

## Remaining production gates

1. Apply `20260824150000_unify_event_trivia_mode` to a staging copy and compare Event, round, question, team, score, snapshot, audit, and access-pass counts before and after import.
2. Run a two-browser/two-phone rehearsal with concurrent host, scorekeeper, check-in, and projector activity. Whole-module `PUT /state` synchronization can still produce last-writer behavior for simultaneous authoring and operational changes; move those paths to event-versioned or operation-specific mutations before advertising multi-author editing.
3. Exercise Stripe, transactional email, public registration capacity, duplicate submissions, temporary-code expiry/revocation, offline/reconnect, snapshot recovery, and projector refresh on production-like configuration.
4. Complete keyboard-only, 200% zoom, screen-reader landmark, 390px phone, tablet, desktop, and projector checks. The source-level accessibility structure is present, but visual/browser verification was not available in this local checkout.
5. Keep the repository-wide CI baseline caveats separate from this feature: the known test environment database configuration and stale system-version expectation must be repaired before the full release gate can be considered green.

## Verification added in this pass

- Parser unit tests cover pipe input, spreadsheet tabs, defaults, alternates, incomplete rows, and unsafe numeric values.
- Source regression tests cover the right-hand navigation, conditional Trivia route, atomic question action, permission middleware, and persistence ceilings.
- `git diff --check` is required before handoff; lint, typecheck, focused unit tests, and the source smoke suite should run in CI where dependencies and the database test environment are available.
