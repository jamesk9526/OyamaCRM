# LiveCom Messenger Audit

Last updated: 2026-05-17

## Architecture

LiveCom stores public website conversations as `Activity` rows with `metadata.source = "livecom"`.

- Public widget script: `server/src/services/site-embeds.ts`
- Public message routes: `server/src/routes/site-embeds.ts`
- CRM inbox routes: `server/src/routes/livecom.ts`
- CRM inbox UI: `app/components/livecom/LiveComInboxTool.tsx`
- Local embed test route: `/livecom/embed-test`

The shared conversation keys are:

- `conversationId`
- `visitorSessionId`
- site metadata in `publicEmbed.siteId` and `publicEmbed.publicSiteId`

## Audit Findings

- CRM staff replies were persisted but did not always include public embed site metadata, so the visitor widget could miss them.
- The public widget polled, but fetch failures cleared or stale-rendered the thread instead of showing reconnecting state.
- The public panel could scroll as a whole; composer/header needed stronger containment.
- Resolve/archive lifecycle changes could create repeated system messages.
- Public thread loading could expose lifecycle system events that belong only in CRM context.
- CRM composer and public composer behavior was inconsistent.
- Disabled future CRM actions were styled like active buttons.

## Improvements Implemented

- Public thread polling now uses short polling every 3 seconds with `cache: "no-store"` and server `Cache-Control: no-store`.
- Staff replies preserve site/session metadata so the public widget can reliably receive replies without page refresh.
- Public widget keeps the existing thread visible during reconnects and shows a reconnecting status.
- Public widget header, message history, and composer are flex-contained; only message history scrolls.
- Public widget send behavior supports optimistic bubbles, sending state, failed-send status, and retry.
- Public thread hides internal notes and lifecycle system events.
- CRM inbox uses contained scroll regions for list, thread, and details.
- CRM composer stays fixed at the bottom of the messenger pane.
- Enter sends; Shift+Enter creates a newline.
- CRM replies are optimistic with sending/failed states.
- Archive/resolve duplicate updates are ignored when no lifecycle fields changed.
- Archived conversations can be reopened by setting status back to `OPEN`.
- Local test page added at `/livecom/embed-test`.

## Manual Test Flow

1. Open `/settings/site-embeds`.
2. Confirm LiveCom is enabled for the selected site.
3. Copy the selected site embed token.
4. Open `/livecom/embed-test`.
5. Paste the token and mount the widget.
6. Open the floating LiveCom launcher and send a visitor message.
7. Open `/livecom/inbox` in another tab.
8. Confirm the conversation appears in the inbox.
9. Reply from the CRM inbox.
10. Return to the embed test tab and confirm the reply appears without refreshing.
11. Archive the conversation in CRM.
12. Confirm the public widget does not show archive/resolve system text.
13. Reopen the conversation and confirm it returns to `Open`.

## Automated Coverage

Targeted smoke coverage lives in:

- `tests/smoke/site-embeds-smoke.test.ts`
- `tests/smoke/livecom-workflow.test.ts`
- `tests/e2e/livecom-ui-smoke.mjs`

Run targeted checks:

```bash
pnpm exec vitest run tests/smoke/site-embeds-smoke.test.ts tests/smoke/livecom-workflow.test.ts
pnpm test:e2e:livecom
```

## Remaining Follow-Up

- Replace short polling with SSE or WebSockets if LiveCom volume grows.
- Wire Create Donor, Link Existing Donor, Create Follow-up Task, and Add Tag buttons to backend actions.
- Add assignment dropdown backed by real user records.
- Add configurable LiveCom retention policy UI.
