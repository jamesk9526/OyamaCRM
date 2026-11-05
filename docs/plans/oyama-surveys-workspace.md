# OyamaSurveys implementation

Updated 2026-11-05.

## Approved experience

The Guided Studio workspace serves donors and Compassion clients. The workflow moves through Library, Build, Preview and Publish, Share, and Responses. Creators select anonymous or CRM-linked collection before first publication. Public forms use pages and sections with conditional follow-ups. Client survey content and answers require Compassion access.

The builder supports short and long text, single and multiple choice, yes/no, numbers, 1–5 ratings, and 0–10 NPS. Sections and questions can be reordered. Questions can depend on earlier choice or numeric answers. The server validates the same visibility and answer rules used in the respondent UI.

## Routes and authorization

| Surface | Route |
| --- | --- |
| Survey library | `/surveys` |
| Client survey library | `/surveys?audience=CLIENT` |
| Survey studio | `/surveys/[id]` with `audience=CLIENT` for client surveys |
| Record response history | `/surveys/records/DONOR/[contactId]` and `/surveys/records/CLIENT/[contactId]` |
| Public form | `/s/respond#d.[token]` or `/s/respond#c.[token]` |
| Donor staff API | `/api/surveys` |
| Client staff API | `/api/compassion/surveys` |
| Donor public API | `/api/public/surveys` |
| Client public API | `/api/compassion-public/surveys` |

Client routes and their delivery worker run in the existing independent Compassion service. Donor routes and their worker run in the platform service. Each service limits access to its own survey audience. Shared implementation uses the care connection pool with query logging disabled.

The six donor permissions cover view, edit, publication, sending, response reading, and export. Role defaults permit staff editing and response reading, with managers publishing, sending, and exporting. Client surveys require active Compassion casework access. Editing and response reading use casework, sending uses messages, publication uses manage, and exports additionally use export. Explicit donor permission overrides apply through User Management.

## Storage and delivery behavior

The additive survey migration creates seven tables for surveys, revisions, templates, distributions, invitations, responses, and delivery jobs. Tenant-scoped composite foreign keys connect dependent records. Published definitions are immutable. Old links keep their revision after a new publication.

Anonymous collection uses a shared random link and stores answers without a contact or invitation reference. Submission keys are independent random values hashed for retry deduplication. Anonymous reminders go to all originally invited recipients and explain that completed respondents can disregard them. Rate limiting uses process memory.

Linked collection stores only invitation token hashes and attaches answers to the appropriate donor or client record. Invitations expire after 30 days beyond the scheduled invitation or reminder, or at the survey closing date. Staff may revoke links. Client answers use the existing Compassion encryption key and authenticated encryption.

Bearer tokens live in the URL fragment and are passed to the public API in POST bodies, keeping them out of request URLs and referrers. Public responses have no-store and no-referrer headers. Survey error handlers redact underlying SQL and input details from logs and error responses.

Email batches support up to 500 distinct CRM recipients and up to ten saved donor lists. Review lists exact eligible recipients and exclusions, sender, content, identity policy, closing date, and the optional reminder. Email-only list entries are excluded. Donor sends enforce existing email eligibility rules and preference links. Client sends require safe email contact. Message and sender review is bound to a server-computed fingerprint, and request keys reject changed-payload retries.

Workers claim jobs atomically, recheck permission and contact eligibility, and send through the existing organization transport. Reminder timing accounts for delayed acceptance of the original email. Failed or interrupted attempts appear in history. Unknown provider acceptance requires operator review and is not automatically retried. An already-running provider operation can complete while a survey is being closed.

## Operations

Apply `prisma/migrations/20261105190000_add_survey_workspace/migration.sql` through the installation's reviewed migration release, then generate Prisma and deploy the web, platform API, and Compassion API together. Review pending migrations before using a command that deploys all pending migrations.

Both APIs require the same stable survey-link signing configuration. `SURVEY_LINK_SECRET` is optional and falls back to `JWT_SECRET`. Set the HTTPS public browser origin in `NEXT_PUBLIC_APP_URL`. Client publication requires `COMPASSION_ENCRYPTION_KEY`. Organization SMTP or Microsoft Graph sender configuration must identify the actual sender before distribution is queued.

Queue health appears in the platform and Compassion health responses. Use the workspace delivery history to inspect queued, sent, skipped, failed, and unknown outcomes.

## Verification

See [survey verification](../status/audit-artifacts/2026-11-05-surveys/verification.md) for actual results and outstanding deployment checks.
