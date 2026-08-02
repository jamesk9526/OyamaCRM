# DonorCRM Steward Paths

Last updated: 2026-08-01

## Purpose

Steward Paths is the DonorCRM orchestration workspace for sequenced donor follow-up. It creates and advances tasks, letters, and communication drafts while keeping draft-first and review-first safety defaults.

## Workspace standard (current direction)

Steward Paths is a dedicated workspace and should not be implemented as scattered mini-flows across unrelated pages.

Required workflow direction:

1. Path list and status triage
2. Builder/editing workspace
3. Validation and safety review
4. Activation/publish actions
5. Run history and activity analysis

Legacy duplicate operations should be redirected into canonical Steward Paths routes as parity is confirmed.

## Canonical Routes

- `/steward-paths` — redirects to the canonical Path Library
- `/steward-paths/builder` — create a new visual path
- `/steward-paths/builder/:id` — edit an existing path
- `/steward-paths/enrollments` — live enrollment queue and status operations
- `/steward-paths/review` — review queue for draft/paused workflows and activation decisions
- `/steward-paths/activity` — recent path activity with direct timeline jump links
- `/steward-paths/analytics` — path/enrollment metrics and distribution analytics
- `/steward-paths/settings` — guarded due-step processing controls
- `/steward-paths/:id` — detail route (currently redirects to history)
- `/steward-paths/:id/history` — path timeline and run history
- `/steward-paths/:id/playground` — isolated, new-tab path simulator with donor and team inbox previews

Legacy route behavior:

- `/automations` is deprecated and redirects to `/steward-paths/library`.
- `/steward-paths/:id/builder` is deprecated and redirects to `/steward-paths/builder/:id`.

## Playground sandbox

The builder opens Playground in a separate tab. It is an in-memory simulation only: it can use a selected CRM donor for realistic rule evaluation or a synthetic donor profile for exploration, but it never creates an enrollment, timeline event, task, donor update, or outbound email. Donor and team inboxes render the path's configured simulated outputs and label every item as sandbox-only.

## Saved Visual Path Operations

Each saved path card exposes:

- Enable/Disable (`ACTIVE` <-> `PAUSED`)
- Share (`private` / `organization` / `admins`)
- Edit workflow
- Test run (safe enrollment creation)
- Duplicate
- Archive
- View run history

## Library usability defaults

- The Path Library opens on operational paths so archived history does not bury current work. Staff can switch to All records or Archived at any time.
- Large result sets are paginated in the browser, with each path card showing only the workflow signals needed for triage: trigger, active steps, enrollments, active donors, and issues.

## Enrollment Entry Points

- CRM-created constituents automatically enter matching active `CONSTITUENT_CREATED` paths. New donor records also match active `FIRST_TIME_DONOR` paths.
- Public Site Embed and LiveCom-created constituents use the same enrollment service, so site-originated people enter the same active onboarding paths as CRM-created people.
- Completed donation entry matches active `DONATION_RECEIVED` paths; the constituent's first completed gift additionally matches active `FIRST_TIME_DONOR` paths.
- The constituent profile shows active or paused paths, the current step, next scheduled execution, and an ordered preview of any selected active path. Staff with `steward_paths.enroll` can add a path or explicitly replace active paths; replacement cancels prior active or paused enrollments with timeline and constituent activity evidence.
- Shared enrollment behavior is owned by `server/src/services/steward-path-enrollment-service.ts` to deduplicate each constituent/path pair and maintain a consistent timeline across CRM, public-site, donation, and profile entry points.

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

## Current Parity Status

- Working: dedicated Microsoft-style Steward Paths shell at `/steward-paths/*`, typed client boundary in `app/lib/steward-paths-api.ts`, canonical list routing, builder-by-id route, enrollments route, review queue route, activity route, analytics route, settings route, history route, and share/duplicate/test-run/archive operations.
- Partially Working: inspector parity for linked campaign/template selectors and open-in-email-builder shortcuts.

## V2 guardrails

- Keep the builder and runtime workflow one-direction and deterministic.
- Every canvas connector opens the same searchable Add Step picker and preserves its exact insertion target, including branch lanes. A stale target must fail closed instead of appending a block somewhere else.
- Drafts may be saved while incomplete. Activation requires one root-first trigger, complete block configuration, and valid branch structure with at least two lanes and exactly one fallback lane.
- The Path Library includes working starter blueprints for new-donor welcome, lapsed-donor recovery, and event follow-up; selecting one prefills the creation workflow for staff review.
- Do not expose fake metrics, fake run history, or non-functional activation controls.
- Activation remains review-first and must respect communication preferences and permission boundaries.
- Route ownership remains in `/steward-paths/*`; legacy `/automations` behavior is compatibility-only.

## Safety Defaults

- Email actions remain draft-first and review-first by default.
- Test run endpoint creates a safe test enrollment event and does not auto-send outbound email.
- Archive is the default destructive action for templates.

## Steward AI contract

- Steward treats messages, retrieved CRM records, memories, uploaded files, and tool results as untrusted evidence. Instructions embedded inside that data cannot override system, permission, or confirmation rules.
- In a `/steward-paths/*` scope, Steward uses path vocabulary and the same activation invariants as the builder. It must not invent template IDs, campaign IDs, execution results, or activation readiness.
- The agentic planner may choose only permission-allowed read tools, uses their published input contracts, avoids overlapping calls, and never fabricates an identifier to satisfy a required tool input.
- Sending, publishing, activating, enrolling, and due-step processing remain server-validated actions. The assistant may draft or recommend them but cannot claim completion without a successful action result.

## OyamaLetters Execution Contract

- Letter nodes only offer `ACTIVE` OyamaLetters templates for selection; the server also enforces active status at generation time.
- A generated letter is linked to its enrollment and step run, then creates a reviewable mail task by default. The path waits for that task to be completed unless staff explicitly select a different handoff mode.
- Delays are scheduled and resumed by the Steward Paths worker. Background execution uses the path creator as its actor fallback when no enrollment or path owner is assigned.
- Postal generation is blocked when the constituent has `doNotMail` or `doNotContact` set, or when the postal address is incomplete. The failed step is recorded in the enrollment timeline rather than producing a letter.

## OyamaEmail Execution Contract

- Email nodes select an OyamaEmail campaign as a reusable source. When the path reaches the node, its recipient receives a path-owned draft that retains the source campaign ID and uses the selected campaign content when no node-level copy overrides it.
- The Review workspace exposes pending path email drafts. Approval does not advance the path; reviewers must use the provider-backed Send action to complete delivery or explicitly skip the draft.
- Sending creates a new one-recipient delivery campaign, then invokes the standard OyamaEmail sender with that constituent's email as the explicit audience. The source campaign and its broader audience are never sent by a path.
- Email drafting and sending are blocked for missing email addresses, `doNotContact`, `doNotEmail`, and `emailOptOut`. Provider failures mark the draft failed and retain the failure in path timeline history.
- `20260801090000_add_steward_path_email_campaign_links` adds source and delivery campaign IDs to `StewardPathEmailDraft` for durable audit linkage.
