# Steward Paths Engagement Sequences

This document defines the new sequence-based Steward Paths engine that runs alongside the legacy trigger/action automations.

## Scope

The sequence engine adds deterministic engagement workflows with explicit enrollment state:

- Template authoring (`StewardPath`, `StewardPathStep`)
- Enrollment tracking (`StewardPathEnrollment`)
- Per-step execution tracking (`StewardPathStepRun`)
- Full timeline events (`StewardPathTimelineEvent`)
- Email draft/review workflow (`StewardPathEmailDraft`)

Legacy `Automation` workflows remain available at `/api/automations` while teams migrate.

## Data Model

Prisma models and enums were added for:

- `StewardPathStatus`, `StewardPathCrmScope`, `StewardPathTarget`, `StewardPathStepType`
- `StewardPathEnrollmentStatus`, `StewardPathStepRunStatus`
- `StewardPathTimelineEventType`, `StewardPathEmailDraftStatus`
- `StewardPath`, `StewardPathStep`, `StewardPathEnrollment`, `StewardPathStepRun`, `StewardPathTimelineEvent`, `StewardPathEmailDraft`

Migration: `prisma/migrations/20260512110000_add_steward_paths_engagement_sequences/migration.sql`

## API Endpoints

Base path: `/api/steward-paths`

### Templates

- `GET /templates` — list templates
- `GET /templates/:id` — template detail with steps
- `POST /templates` — create template
- `PATCH /templates/:id` — update template metadata/status
- `DELETE /templates/:id` — archive template

### Steps

- `POST /templates/:id/steps` — create step
- `PATCH /templates/:id/steps/:stepId` — update step
- `POST /templates/:id/steps/reorder` — reorder steps
- `DELETE /templates/:id/steps/:stepId` — archive step

### Enrollments

- `GET /enrollments` — list enrollments
- `POST /templates/:id/enrollments` — manual enrollment
- `PATCH /enrollments/:id/status` — pause/resume/cancel/complete status update
- `POST /enrollments/:id/complete-current-step` — complete manual-action step
- `GET /enrollments/:id/timeline` — fetch timeline entries

### Email Drafts

- `GET /email-drafts` — list drafts
- `PATCH /email-drafts/:id` — edit draft and/or status

### Processing

- `POST /process-due` — process due steps on demand

## Worker Integration

`server/src/services/steward-paths-worker.ts` now runs three poll passes:

- Existing `TASK_DUE` trigger scans
- Existing pledge timeline trigger scans
- New sequence due-step processing via `processDueStewardPathEnrollments`

## Permissions

New permission keys:

- `steward_paths.view`
- `steward_paths.create`
- `steward_paths.edit`
- `steward_paths.activate`
- `steward_paths.archive`
- `steward_paths.enroll`
- `steward_paths.pause`
- `steward_paths.manage_all`
- `steward_paths.process_due_steps`
- `steward_paths.email_auto_send`

These are registered in `server/src/lib/permissions.ts` and surfaced in the settings user management permission matrix.

## Safety Rules

- Email flow is draft-first by default. `SEND_EMAIL` currently routes through draft behavior.
- Enrollment/step transitions are written to timeline events for auditability.
- Worker processing marks failed enrollments and captures failure messages.

## Generate Letter Step

`GENERATE_LETTER` is now a supported sequence step type.

Required config:

- `templateId` (letter template to generate)

Optional config:

- `year` (merge context year)
- `taskMode`: `none` | `create_and_continue` | `create_and_wait_for_completion`
- `taskTitleTemplate`
- `taskDescriptionTemplate`
- `dueOffsetAmount`
- `dueOffsetUnit`: `hours` | `days` | `weeks`
- `priority`
- `taskType`

Execution behavior:

- The step generates a `GeneratedLetter` via shared execution service logic.
- The generated letter is linked to steward context using `stewardPathEnrollmentId` and `stewardPathStepRunId`.
- If `taskMode` creates a task, the task is linked to the generated letter and steward context.
- If `taskMode = create_and_wait_for_completion`, the step run remains `RUNNING` and repolls until the linked task is completed.

## Current Limits

- Conditional branching is placeholder-only (`BRANCH_PLACEHOLDER` is skipped).
- `STATUS_CHANGE` step is placeholder-only and currently skipped.
- Auto-send email behavior is not enabled in this pass.

## Next Build Steps

- Add dedicated UI for sequence builder and enrollment monitoring.
- Implement non-placeholder branch/status-change execution.
- Add per-step retries/backoff and dead-letter handling.
- Add explicit integration tests for paused/resumed and draft approval workflows.
