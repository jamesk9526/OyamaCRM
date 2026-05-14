# DonorCRM Steward Paths

Last updated: 2026-05-13

## Purpose

Steward Paths is the DonorCRM orchestration workspace for sequenced donor follow-up. It creates and advances tasks, letters, and communication drafts while keeping draft-first and review-first safety defaults.

## Canonical Routes

- `/steward-paths` — saved visual paths list with operations
- `/steward-paths/builder` — create a new visual path
- `/steward-paths/builder/:id` — edit an existing path
- `/steward-paths/:id` — detail route (currently redirects to history)
- `/steward-paths/:id/history` — path timeline and run history

Legacy route behavior:

- `/automations` is deprecated and redirects to `/steward-paths?deprecated=automations`.

## Saved Visual Path Operations

Each saved path card exposes:

- Enable/Disable (`ACTIVE` <-> `PAUSED`)
- Share (`private` / `organization` / `admins`)
- Edit workflow
- Test run (safe enrollment creation)
- Duplicate
- Archive
- View run history

## API Endpoints Used By Canonical Workspace

Template and action endpoints:

- `GET /api/steward-paths/templates`
- `GET /api/steward-paths/templates/:id`
- `POST /api/steward-paths/templates`
- `PATCH /api/steward-paths/templates/:id`
- `DELETE /api/steward-paths/templates/:id`
- `PATCH /api/steward-paths/templates/:id/share`
- `POST /api/steward-paths/templates/:id/duplicate`
- `POST /api/steward-paths/templates/:id/test-run`
- `GET /api/steward-paths/templates/:id/history`

Step endpoints:

- `POST /api/steward-paths/templates/:id/steps`
- `PATCH /api/steward-paths/templates/:id/steps/:stepId`
- `DELETE /api/steward-paths/templates/:id/steps/:stepId`
- `POST /api/steward-paths/templates/:id/steps/reorder`

Migration endpoint:

- `POST /api/steward-paths/migrations/automations`

## Legacy Migration Notes

A compatibility migration utility imports `Automation` + `AutomationAction` records into `StewardPath` + `StewardPathStep` templates and marks migration metadata in `triggerConfig._migration`.

Current mapping highlights:

- `DONATION_RECEIVED` -> `DONATION_RECEIVED`
- `CONSTITUENT_CREATED` -> `CONSTITUENT_CREATED`
- `TASK_DUE` -> `TASK_DUE`
- `PLEDGE_CREATED` -> `PLEDGE_CREATED`
- `EMAIL_OPENED` -> `EMAIL_OPENED`
- `EVENT_REGISTERED` -> `EVENT_REGISTERED`
- `SEND_EMAIL` -> `DRAFT_EMAIL`
- `CREATE_TASK` -> `CREATE_TASK`
- `UPDATE_FIELD` -> `STATUS_CHANGE`
- `ADD_TAG` / `REMOVE_TAG` -> `STATUS_CHANGE` (migration metadata retained)
- `ASSIGN_USER` -> `MANUAL_ACTION` fallback

## Current Parity Status

- Working: canonical list routing, builder-by-id route, history route, share/duplicate/test-run/archive operations, migration endpoint.
- Partially Working: inspector parity for linked campaign/template selectors and open-in-email-builder shortcuts.

## Safety Defaults

- Email actions remain draft-first and review-first by default.
- Test run endpoint creates a safe test enrollment event and does not auto-send outbound email.
- Archive is the default destructive action for templates.
