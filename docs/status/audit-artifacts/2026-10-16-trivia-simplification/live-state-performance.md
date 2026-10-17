# Trivia host and projector live-state follow-up — October 16, 2026

The host now follows a guided sequence: show the selected question, start or resume its timer, reveal the answer, and advance. Less common stage, round-jump, recovery, and winner controls remain available in disclosures. The host preview names the active round and question number, shows the exact question and choices selected for the projector, distinguishes the next question, and only includes the public answer after reveal.

The host question card now has compact Previous/Next buttons with boundary states and guarded skip/revisit actions. Removing a timer sets the active live timer to zero, stops its deadline, and makes both the host preview and projector treat the question as untimed; the configured timer can be restored in place and is reset from the question configuration when moving to another question.

Projector routes now subscribe to one event instead of loading the full Trivia module. Host controls use validated, revision-checked event commands. Successful commands update another open same-origin screen immediately through `BroadcastChannel`; conditional event reads retry once per second when no message arrives. Timer displays derive from the saved absolute deadline, so the projector continues counting if the host closes and timer ticks do not write to the server. Projector transitions use short opacity/small movement animations without the previous blur filter or long leaderboard delay.

## Verification

For the compact-navigation and timer-removal follow-up, 17 focused host-flow and server-command tests passed, the source contract suite passed, and web/server typechecks passed. ESLint reported zero errors and one existing question-media image warning; the updated host browser fixture passed syntax validation but could not run because Playwright Chromium is absent and Edge exited during automation startup in this environment.

- 48 focused timer, host-flow, live-client, sequential-state, source-contract, and table occupancy tests passed.
- 10 mocked live API route tests passed, including stale command conflicts, event and organization scoping, legacy aliases, timer expiry without writes, and idempotent timer start.
- 13 mocked event TableLink route tests passed, including authenticated table-detail guests and table rename boundaries.
- Real Edge host controls verified keyboard use, stage and timer sequence, public answer preview, stale confirmation, retry and emergency states, and a 320-pixel layout with no overflow or page errors.
- A two-window Edge fixture measured the question update on the projector 239 ms after the host action. After the host window closed, the projector countdown continued. The fixture observed six event-only reads, two host writes, no full-module request, and no page errors. This is one local mocked run, not a production latency benchmark.
- Web and server TypeScript checks passed. Changed-file ESLint reported zero errors and one existing `no-img-element` warning for question media.

## Limits

Prisma route tests use mocked storage. MySQL locking/contention, production network latency, and deployment behavior were not measured. Builder/import and scorekeeping still use the existing broader module persistence path; the one-event host/projector refresh and live controls avoid it.
