# Phone presentation remote verification — October 17, 2026

The remote supports automatic entry from an event-specific link/QR without CRM login, labeled icon controls, round/question dialogs, private answers and notes, manual reveals, winner selection, emergency blanking, and reconnect. Question timers have been retired from host, projector, and builder interfaces. Legacy timer storage fields remain compatible; server timer start/reset is rejected and old timer screens show the question.

## Executed checks

- `node node_modules/vitest/vitest.mjs run tests/unit/trivia tests/smoke/trivia-event-night-source.test.ts`: 69 checks passed across 11 files.
- `node tests/e2e/trivia-phone-remote-fixture.e2e.mjs`: real browser passed at 320px/390px; access code fallback and direct link automatic entry, URL code cleanup, private host notes, question navigation, guarded reveal, round dialog/Escape, expected revision submission, emergency hold, disconnect. No page errors or horizontal overflow.
- `node tests/e2e/trivia-table-remote-fixture.e2e.mjs`: real browser passed at 390px; polling preserves dirty drafts, failed saves/walk-ins retain data, successful walk-ins clear, guest search, check-in/confirmed undo, late arrivals, empty/no-match states. No page errors or overflow.
- Changed-file ESLint: no errors; existing image-element warnings in projector and question builder remain.
- Web and server TypeScript checks passed. Both canonical status files record the changes and rehearsal requirement.

The browser fixtures run real React components with local deterministic data, not the production database or venue network. Rehearse with two real phones, the actual event roster, venue Wi-Fi, projector, and audio/video playback before the event. Server snapshot role-redaction assertions were also executed: host-only question fields remain absent for check-in, scorekeeper, and table-manager roles.

[Phone screenshot](mobile.png)
