# Oyama Trivia Add-on README

## What this is

Oyama Trivia is a standalone add-on app for running live, in-person trivia events.

It is separate from CRM modules and does not use CRM search/AI shell controls.

## Route entry points

- Dashboard: /apps/trivia
- Events list: /apps/trivia/events
- New event: /apps/trivia/events/new
- Event builder: /apps/trivia/events/[eventId]/builder
- Host controls: /apps/trivia/events/[eventId]/host
- Score panel: /apps/trivia/events/[eventId]/scores
- Answer key (private): /apps/trivia/events/[eventId]/answer-key
- Projector display: /apps/trivia/display/[eventId]

## How to run a live event

1. Create event
- Open /apps/trivia/events/new
- Enter event name, venue, host, and start time
- Submit to open the builder

2. Configure teams and game content
- In builder, add teams and player names
- Add rounds
- Add questions with options, answer, points, timer, and host notes

3. Open host controls
- Open /apps/trivia/events/[eventId]/host
- Click Mark Live
- Choose round and navigate questions

4. Open projector display
- From host panel, click Pop Out Projector Display
- This opens /apps/trivia/display/[eventId] in a new window
- Keep this window on projector/TV output

5. Run game actions live
- Start/pause/reset timers
- Reveal answers
- Show leaderboard
- Switch to break screen
- Show final winner screen

6. Score teams
- Use host panel scoring section or /scores route
- Apply +5, +10, bonus, and -5 adjustments

## Import/export foundation

Current JSON import/export foundation:

- In builder, Copy Event JSON exports current event to clipboard
- Paste JSON payload into import box and run import

## Privacy and projector safety

Projector route only shows audience-safe content:

- current question
- timer
- answer reveal stage
- leaderboard stage
- break stage
- winner stage

Projector route does not show:

- host notes
- private answer key route
- scoring buttons
- setup/editor controls

## Smoke test checklist

Use this sequence for each release:

1. Create a new event and verify it appears in /events.
2. Add at least 2 teams and verify teams appear in host and scores routes.
3. Add at least 1 round and 2 questions.
4. Open host panel and switch rounds/questions.
5. Start timer and verify countdown decrements.
6. Pause timer and verify countdown stops.
7. Reset timer and verify it returns to default question time.
8. Open projector pop-out and verify question/timer sync from host actions.
9. Trigger Reveal Answer and verify projector updates.
10. Adjust team scores and verify leaderboard order changes.
11. Trigger Winner screen and verify top team is shown.
12. Verify answer key route includes host notes and answers.
13. Verify display route never shows host notes or admin controls.
14. Copy-export JSON and validate payload structure.
15. Import JSON and verify event list updates.

## Known in-progress items

- Printable host sheets
- Printable answer key packets

These items should always show explicit Feature in progress messaging in the UI.
