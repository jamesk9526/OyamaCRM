# Trivia host controls audit — 2026-10-16

Scope: Trivia host console, score controls, winner selection, local live-state transitions, and validated transitions in the temporary host remote/server action path. No deployment, production data access, email, or public publishing occurred.

## Fixed

- A tied leaderboard no longer silently awards the winner to the first team in array order. The host previews the unique active leader and must resolve a tie before announcing the winner. Inactive teams are excluded from automatic and persisted winner display.
- Standard/partial quick scoring in the host and dedicated score panel uses the active question's configured points, falling back to the game default only without an active question.
- The host can expand a private answer, accepted-answer, and host-note reference without revealing anything to the audience.
- Confirmations expire when the active event, round, question, or display changes, preventing a confirmation reviewed against an old question from immediately revealing a new answer.
- Round switching is disabled while disconnected. Question-dependent projector controls are disabled for empty rounds.
- Mark Live reports checkpoint failures and shows busy/live states instead of allowing duplicate requests or an unhandled rejected promise.
- State actions reject missing rounds, noninteger question indexes, nonfinite scores, prohibited partial credit, nonfinite timer values, and negative reset durations. Expired and untimed timers cannot be started.
- Temporary host remotes now apply validated server transitions: revealing answers/leaderboards or blanking pauses countdown and updates the corresponding flags; a round change loads that round's first-question timer; advancing clears old winner state; expired/untimed timers cannot start; empty rounds cannot reveal nonexistent answers. Existing host-role authorization, persistence, and audit paths are preserved.

## Validation

- Five reproduced failures before fixes: tied winner, inactive persisted winner, invalid round/index, expired timer restart, and invalid/disallowed scoring. The focused winner/state files now pass all eight tests.
- `pnpm exec vitest run tests/unit/trivia-sequential-actions.test.ts tests/unit/trivia-host-winner.test.ts tests/unit/trivia-remote-host.test.ts tests/unit/trivia-route-resolution.test.ts tests/unit/trivia-question-entry.test.ts tests/unit/trivia-game-import.test.ts tests/smoke/trivia-event-night-source.test.ts`: **34 passed**.
- Changed TypeScript/TSX files and test files passed targeted ESLint; `pnpm typecheck` passed for both web and server.
- `E2E_BROWSER_CHANNEL=msedge node tests/e2e/trivia-host-controls-fixture.e2e.mjs`: passed using the actual React host component with deterministic local sample state. Covered tied/unique winner, private notes, invalidated confirmation after external question change, guarded answer reveal, failed checkpoint feedback, emergency hold, empty round, disconnected round selection, desktop/mobile layout, and no page errors. Browser checks use local fixture state and do not verify production API persistence.
- Screenshots: [desktop](2026-10-16-trivia-host/desktop.png), [mobile](2026-10-16-trivia-host/mobile.png). The fixture includes labeled test controls above the real host component.
- Corrected one pre-existing source smoke expectation: HEAD's bulk-entry heading is `Have a prepared question list?`, while HEAD's test expected obsolete copy. Workflow, content-limit, and permission assertions were retained.
- Vitest required a writable temp directory under ignored `node_modules/.cache/trivia-host`; temporary root files were removed after path validation.

## Remaining architectural gaps

- Countdown authority remains in the mounted full host component's interval. A standalone temporary remote starts/pauses state but does not own a countdown loop; closing or suspending the host window may stop or delay countdown. Multiple mounted host consoles can also compete. A server-authoritative timer deadline and single transition owner need a dedicated change with multi-device integration coverage.
- Full-state server synchronization remains susceptible to concurrent staff/remote edits because clients save complete snapshots rather than per-action revisions. This audit did not replace that persistence architecture.
- Live deployment/database verification, real projector pop-out behavior, remote pass lifecycle, recovery persistence, and concurrent staff operation were not exercised against a server in this pass.
