# Oyama Trivia Add-on Plan

Last updated: 2026-05-10

## 1. Scope and product boundary

Oyama Trivia is a standalone Oyama add-on app.

- It is not DonorCRM.
- It is not Compassion CRM.
- It is not Events CRM.
- It must not rely on CRM entities, CRM route shells, CRM top search, or CRM AI controls.
- It uses separate route space, separate state models, and separate storage namespace.

Current implementation route base: /apps/trivia

## 2. Architecture summary

Frontend stack:

- Next.js app router
- TypeScript
- Tailwind CSS
- Dedicated dark-mode shell for trivia host workflows

State/storage strategy:

- Standalone trivia state container: TriviaModuleState
- Dedicated storage namespace key: oyama.trivia.module.state.v1
- Browser-local persistence with cross-window sync via:
  - custom window event
  - storage event
  - BroadcastChannel

This enables true host + projector operation in separate windows with live updates.

## 3. Route structure

Implemented routes:

- /apps/trivia: trivia dashboard
- /apps/trivia/events: event list
- /apps/trivia/events/new: create event
- /apps/trivia/events/[eventId]/builder: teams, rounds, questions, import/export
- /apps/trivia/events/[eventId]/host: live host controls
- /apps/trivia/events/[eventId]/scores: focused scorekeeping
- /apps/trivia/events/[eventId]/answer-key: private answer key and host notes
- /apps/trivia/display/[eventId]: projector-safe audience display

Boundary behavior:

- /apps/trivia routes run in TriviaAppShell (dark, host-focused)
- /apps/trivia/display/[eventId] bypasses shell and renders projector-only view

## 4. Core data models

Primary models:

- TriviaEvent
- TriviaRound
- TriviaQuestion
- TriviaTeam
- TriviaLiveState
- TriviaModuleState

Key design choices:

- Event setup data is separate from live runtime state
- Host display stage is explicit (question, answer, leaderboard, break, winner)
- Timer and current position are part of live state so projector is synchronized

## 5. Host and display behavior

Host panel capabilities:

1. Select active round
2. Previous/next question navigation
3. Start/pause/reset timer
4. Reveal answer
5. Show leaderboard
6. Set break screen
7. Show winner screen
8. Pop out projector display
9. Real-time score adjustments

Projector display behavior:

- Only audience-safe content is shown
- No answer-key notes
- No admin controls
- No hidden setup tools
- No private scoring adjustments

## 6. Feature status checklist

Status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Notes |
|---|---|---|
| Standalone route boundary | Working | Under /apps/trivia, separate from CRM shells |
| Dark trivia shell with animation accents | Working | Dedicated shell in TriviaAppShell |
| Event creation | Working | Persisted creation in standalone trivia namespace |
| Event list and navigation shortcuts | Working | Builder, host, scores, answer key, projector links |
| Team manager | Working | Add teams with player list |
| Round builder | Working | Add rounds to event |
| Question builder | Working | Add questions/options/answers/time/points/notes |
| Answer key manager | Working | Private route with answers and notes |
| Live host control panel | Working | Stage controls, timer controls, question flow |
| Pop-out projector button | Working | Opens dedicated display window |
| Projector display route | Working | Audience-safe stage rendering |
| Scorekeeping panel | Working | Add/subtract/bonus scoring actions |
| Leaderboard display | Working | Host-triggered stage + sorted scores |
| Winner screen | Working | Host-triggered final screen |
| Import/export foundation | Working | JSON import and copy-export |
| Printable host sheets | Not Implemented | Explicit in-progress notice in builder |
| Printable answer keys | Not Implemented | Explicit in-progress notice in builder |

## 7. Milestones

Milestone A (completed):

- Standalone shell and route foundation
- Live event state/actions
- Host + display synchronization
- Event setup and score operations

Milestone B (next):

- Server-backed persistence option (API + DB namespace for trivia)
- Multi-host session locking and presence indicators
- Rich import validation and per-event merge mode

Milestone C (next):

- Printable host sheets
- Printable answer-key packets
- Event archive/export package builder

## 8. Guardrails

- Do not import CRM models into trivia domain.
- Do not mount CRM top search or CRM AI assistant inside trivia shell.
- Keep route naming and UX language app-first (tool/module language), not CRM-first.
- For unfinished features, always render explicit Feature in progress messaging.
