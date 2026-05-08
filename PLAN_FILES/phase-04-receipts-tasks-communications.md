# Phase 04 — Receipts, Tasks, Communications

## Goal

Ship stewardship follow-through after gift entry: acknowledgment, tasking, communication logs.

## Scope

- Receipt record lifecycle
- Task engine for thank-you/follow-up work
- Email/letter templates and communication history
- Print queue baseline

## Manageable steps

1. Define receipt statuses and generation triggers.
2. Build task workflows for due/overdue/completed handling.
3. Add communication template storage + merge fields.
4. Implement communication log timeline entries.
5. Add thank-you workflow automation v1 (manual-safe).
6. Add print queue for offline letters/receipts.
7. Add clear safety checks for opt-outs and approvals.

## Exit criteria

- Gift entry can produce receipt + communication records.
- Staff can run thank-you/follow-up operations from task queues.
- Communication history is visible per constituent.

## Audit snapshot — 2026-05-08

- [x] Task list/create/complete/delete workflows are working — verified in `app/tasks/page.tsx` and `server/src/routes/tasks.ts`.
- [x] Email builder MVP exists — verified in `app/email-builder/*`, `app/lib/email-builder-utils.ts`, and related unit tests.
- [~] Communication workflows are partial — `server/src/routes/email-campaigns.ts` supports preview, audience preview, send test, schedule, cancel, and send.
- [~] Communication dashboard exists, but it is not yet a full communication center — `app/communications/page.tsx`.
- [ ] Media uploads, attachments, merge fields, communication timeline logging, and provider-backed delivery/open/click tracking are not implemented.
