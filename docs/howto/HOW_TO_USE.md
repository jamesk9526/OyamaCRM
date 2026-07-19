# OyamaCRM Office How-To Guide (Current Reality)

Last updated: 2026-07-19

## Purpose

This guide is for office staff who need practical daily steps in the current application state.
It focuses on what works today, what is partially ready, and what should be avoided until fixes are shipped.

For release-manager and super-admin deployment procedures, use:

- `docs/howto/HOW_TO_PUBLISH_UPDATES.md`

## Current Release Gate Snapshot

Current readiness gate: Broken

Most recent full audit evidence shows:

- Working: typecheck, smoke tests, full test run, coverage run, web/server builds, Linux migration casing verification
- Broken: lint, all three E2E lanes, Prisma client generation (`pnpm db:generate`)

Use the dated audit docs for details:

- `docs/status/readiness-audit-2026-05-12.md`
- `docs/status/testing-coverage-audit-2026-05-12.md`
- `docs/status/e2e-coverage-audit-2026-05-12.md`
- `docs/status/smoke-coverage-audit-2026-05-12.md`
- `docs/status/build-and-typecheck-audit-2026-05-12.md`

## Quick Start

1. Open the app and sign in with your assigned staff account.
2. Use the module switcher in the top bar to choose DonorCRM, Compassion CRM, Events CRM, or a dedicated workspace.
3. Stay inside one module for the full task whenever possible (for cleaner activity history).
4. Use the ribbon directly below the top bar for page-specific actions. The tabs and commands change by page, so Dashboard tools, list tools, profile tools, gifts tools, and Steward Paths tools are intentionally different.
5. On screens narrower than `1024px`, use the navigation-menu button in the top bar. The module navigation opens as a drawer and closes with the close button, by tapping outside it, or by pressing Escape.

### Workspace operating guidance

1. Use the canonical workspace for the job (for example, `/oyama-email`, `/oyama-letters`, `/steward-paths`).
2. Follow one direction through the workflow: list/overview -> build/edit -> review -> publish/activate -> history.
3. Avoid legacy paths when a canonical route exists; old links redirect where compatibility is retained.
4. If a screen shows in-development messaging, treat it as non-production and use the closest Working workflow instead.

## DonorCRM Browser QA Baseline (2026-05-13)

This release includes a full browser-driven DonorCRM route pass with fresh screenshots and viewport checks.

- Module guide: `docs/modules/donor-crm/README.md`
- Browser QA report: `docs/modules/donor-crm/browser-qa-report.md`
- Screenshot index: `docs/screenshots/donor-crm/README.md`
- Route metrics artifact: `docs/modules/donor-crm/browser-qa-metrics-2026-05-13.json`

## Daily Workflow: DonorCRM

### Add and work a constituent

1. Go to Constituents.
2. Search for the person first to avoid duplicates.
3. If not found, create the constituent profile.
4. Open the profile and confirm contact details.
5. Add notes for important context (stewardship, preferences, reminders).

### Record a donation and stewardship follow-up

1. Go to Donations.
2. Use the compact Donations ribbon for New Gift, range controls, gift actions, receipts, batches, data tools, reports, and view controls. Commands that need a selected gift remain disabled until a row is selected.
3. Add the donation with the correct date, amount, and campaign/designation.
4. Use `Complete Loop` to run the first-pass stewardship workflow in one action:
	- Create or reuse donation email draft
	- Create or reuse follow-up call task
	- Start or reuse steward path enrollment
5. Use row quick actions to:
	- Generate Letter
	- Create Email Draft
	- Create Call Task
	- Start Path
	- Mark Thanked
6. For batch acknowledgments, select multiple donations or use `Select Visible Monthly Donors`, then choose:
	- `Create Letters for Selected Donors` to open OyamaLetters with a temporary donor list for template selection and review.
	- `Create Email for Selected Donors` to open OyamaEmail with a temporary email segment for template selection, audience review, and send confirmation.
7. Open OyamaEmail for campaign and draft review/scheduling.
8. Open Tasks for assignment and completion tracking.

### Campaign operations

1. Go to Campaigns.
2. Open campaign details from the campaign card.
3. Update campaign status, dates, and goals as needed.
4. Review recent donation activity under that campaign.

### OyamaLetters workflow

1. Open OyamaLetters from the workspace switcher or go to `/oyama-letters`.
2. Start in Template Library, then open a template to enter the Canvas Builder.
3. Use the builder ribbon and side panels for letter layout, merge-field placement, snippets, signatures, formatting, tables, page breaks, and margin controls.
4. Use Publish Workspace to review detected merge fields and publish the saved template. Validation notes are informational and do not block publishing. Publishing logs grouped browser-console diagnostics, including the full composed letter HTML and validation notes.
5. Use Generate Letters to search real constituents, attach real donation context when needed, preview merged output, and generate a letter or batch. When launched from a Campaign or event-aware workflow, the batch preserves that campaign/event context alongside recipient, organization, staff, and year merge fields.
6. Use Print & Mail Queue for live print/mail queue rows and Settings for signature links and workflow policy controls.
7. Use `Export` on a template card to download a JSON backup. Use `Import Template` in the library to restore that file as a new draft for testing or backup recovery; import does not overwrite or publish the original template.
8. Set the shared Communication Header + Footer in `/settings/branding`; that one header and one footer apply to every OyamaLetters output and every OyamaEmail render.
9. Current status: Working for the refreshed workspace routes. The UI uses live API data and empty states; it does not ship placeholder recipient/template data.

### OyamaEmail workflow (canonical)

Use OyamaEmail as the donor email command center:

1. Open `/oyama-email` for campaign planning and execution.
2. Follow the one-direction route pattern:
	- Templates -> Builder -> Publish
	- Campaigns -> Audience -> Review -> Queue/Send -> Analytics
3. To email a selected donation group, select donations on the Donations page and choose `Create Email for Selected Donors`. The campaign wizard loads those emails as a temporary segment and still requires the normal audience review checkbox before sending.
4. Use persisted segment audiences before scheduling or queueing sends. Temporary/manual/list recipient selections are reviewable and sendable immediately, but are not stored on the campaign record for later scheduled sends yet.
5. Use Template Library only for reusable content. Drafted/sent email records appear in Email Queue with their current status.
6. In the builder, use `Show Me How It Will Look to the Recipient` to open the server-rendered recipient preview. After saving, open Publish, resolve every required compliance check, use `Send Test Email` to send a proof only to the supplied reviewer address, then choose `Mark Ready`. Audience review and live sending remain in the campaign workflow.
7. Image blocks, story images, staff signatures, headshots, and contact-card images can use an uploaded image or a hosted URL. Uploading from a new draft saves that draft first, then attaches the image to the template. Email uploads support PNG, JPG, WEBP, and GIF up to 5 MB.
8. Use `Export` on a template card to download a JSON backup. Use `Import Template` in the library to restore that file as a new draft for testing or backup recovery; the current organization's sender settings are used on import.
9. Generated OyamaLetters records with an email recipient offer `Create Email Draft`. The handoff opens a linked, reviewable OyamaEmail campaign, preserves rich HTML, and reuses the existing campaign on repeat clicks. It never sends automatically. Use the campaign’s `Return to Source Letter` action to reopen the originating letter context.
10. Marking a template Ready requires the required review checks to pass; diagnostics remain available in the browser console for troubleshooting.
11. Use Email Queue and Analytics to verify delivery outcomes and failed-recipient truth.
12. Legacy `/communications/*` email routes should be treated as compatibility redirects into OyamaEmail routes.

### Steward Paths builder workflow

Use this when staff need to design or edit stewardship sequences:

1. Open Steward Paths Builder (`/steward-paths/builder`).
2. Set the workflow name and keep the Actions tab selected for map editing.
3. Add nodes from the left palette using click-add or connector + buttons.
4. For branching, select the branch node and edit lanes/conditions in the right inspector.
5. Use Save Draft to persist linear-safe paths.
6. Use Test Enrollment after saving to validate constituent enrollment flow.
7. Only activate when the builder reports workflow support as Working.

## Daily Workflow: Compassion CRM

### Client intake and case setup

1. Go to Compassion CRM -> Clients.
2. Search before creating a new client.
3. Create the client record.
4. Open the client profile and review tabs.
5. Create a case and any first follow-up tasks.

### Appointment scheduling (internal)

1. Go to Compassion CRM -> Settings.
2. Confirm appointment widget policy (locations, availability blocks, blackout dates).
3. Open Compassion CRM -> Appointments.
4. Choose Calendar, List, or Split view based on your task.
5. In Calendar view, switch between Day/Week/Month/Agenda tabs.
6. Drag appointments to new time slots to reschedule, or resize blocks to adjust duration.
7. Confirm any move/resize and resolve conflicts if a slot is already occupied.
8. Use + Schedule Appointment for new visits, and Edit on existing items for notes/status changes.
9. In List view, use filters (type, staff, status, date range, location) plus search and sort for call-list workflows.
10. Use quick actions for Complete, No-Show, and Cancel directly from the list.

### Public scheduling flow (for website use)

1. Use the configured public appointment page URL from Compassion settings.
2. Public users select an available slot (not freeform datetime).
3. Submission is validated again at submit time to prevent stale slot booking.

## Daily Workflow: Events CRM

### Event-first navigation (required)

1. Start at Events -> Workspace Selector.
2. Choose one event.
3. Choose one tool (overview, guests, tables, check-in, etc.).
4. Work from the selected event context to keep data scoped correctly.

### Check-in flow

1. Open the selected event's Check-In tool.
2. Search guest by name/email/phone.
3. Toggle check-in status at the door.
4. Monitor checked-in count and payment issue indicators.

## Daily Workflow: OyamaWebMaster

### Site manager lifecycle workflow

1. Go to OyamaWebMaster.
2. Create a site with the correct site type (Main, Landing, Event, Donation, Temporary, etc.).
3. Set domain and purpose metadata so teams know ownership and intent.
4. Use Site Manager filters to review only the sites relevant to your team.
5. Open the visual builder from the site card to edit pages.
6. Use Duplicate before major redesign work.
7. Use Archive (not deletion) for retired sites.
8. Use Restore when archived sites need to return to draft workflow.

### Safety guidance

1. Do not treat site links as data ownership transfers between modules.
2. Keep donor/client/event records in their module systems of record.
3. Wait for explicit publish target and rollback tooling before production launch claims.

## Important Incomplete or Risky Areas

Use this section as an operations safety list.

| Area | Current state | Office guidance |
|---|---|---|
| Events reports page | Partially Working | If reports fail to load, use event overview and dashboard metrics temporarily. |
| Event-scoped guests route | Broken in some datasets | If page crashes, return to workspace selector and use another tool until fix ships. |
| Grants research workspace paths | Partially Working | Use grants for research, requirements, reminders, tasks, writing, and resources. Record received grant money separately in Donations. |
| Compassion full-name search | Partially Working | If full-name search misses records, search by last name or first name separately. |
| Compassion appointment matcher queue | Not Implemented | Public bookings sync to the staff calendar now, but manual triage is still required until matcher/review queue ships. |
| OyamaEmail queued/scheduled explicit audiences | Partially Working | Temporary donation email segments, manual emails, and saved-list recipient selections can be reviewed and sent now, but queue/schedule is disabled until explicit audiences persist on campaign records. Use persisted segments for scheduled sends. |
| Steward Paths branch persistence from visual builder | Working | Branch visuals, editing, branch-aware persistence, activation checks, and runtime branch execution are supported in the canonical `/steward-paths/builder` workflow. |
| Some module tabs and tools | Not Implemented | Follow in-app in-development warnings and do not rely on those tabs for live operations. |

## DonorCRM Daily Stewardship Operations

Use DonorCRM as the daily stewardship command center:

1. Start in Dashboard and review follow-up metrics first.
2. Use the dashboard quick actions to record a gift, add a donor, create an email, create a letter, or open tasks without navigating through multiple menus.
3. Open donor profiles from high-priority queues.
4. Confirm donation acknowledgment state.
5. Generate letters and optional email drafts.
6. Create and complete follow-up tasks.

### Donor Dashboard on compact and mobile screens

1. On phones and tablets, open navigation from the top-bar menu; the desktop sidebar is intentionally replaced by the drawer below `1024px`.
2. Start with the Donor Command Center, then work from Today&apos;s Focus and Needs Attention before opening lower dashboard widgets.
3. Dashboard cards stack into a single column on small screens. Donation tables scroll inside their own card; swipe inside the table rather than trying to scroll the whole page sideways.
4. Use `Customize` to change personal dashboard widgets. The control opens the same dashboard layout workflow at every screen size.
5. Use `Refresh` when a live dashboard value needs to be reloaded. The dashboard does not invent values while data is loading or unavailable.

Donor references for staff and implementers:

- [docs/DONOR_CRM_AUDIT.md](docs/DONOR_CRM_AUDIT.md)
- [docs/DONOR_ENGAGEMENT_SYSTEM.md](docs/DONOR_ENGAGEMENT_SYSTEM.md)
- [docs/DONOR_CRM_COMMUNICATIONS_AUDIT.md](docs/DONOR_CRM_COMMUNICATIONS_AUDIT.md)
- [docs/DONOR_CRM_EMAIL_BUILDER.md](docs/DONOR_CRM_EMAIL_BUILDER.md)
- [docs/DONOR_CRM_LETTERS_PRINTABLES.md](docs/DONOR_CRM_LETTERS_PRINTABLES.md)
- [docs/DONOR_CRM_LETTERS_PRINTABLES_PRODUCTION_PLAN.md](docs/DONOR_CRM_LETTERS_PRINTABLES_PRODUCTION_PLAN.md)
- [docs/DONOR_CRM_PRINT_QUEUE.md](docs/DONOR_CRM_PRINT_QUEUE.md)
- [docs/DONOR_CRM_FORM_LETTER_EDITOR.md](docs/DONOR_CRM_FORM_LETTER_EDITOR.md)
- [docs/DONOR_CRM_GRANTS_RESEARCH_WORKSPACE.md](docs/DONOR_CRM_GRANTS_RESEARCH_WORKSPACE.md)
- [docs/DONOR_CRM_GRANTS_AUDIT.md](docs/DONOR_CRM_GRANTS_AUDIT.md)
- [docs/DONOR_CRM_STEWARDSHIP_COMMAND_CENTER.md](docs/DONOR_CRM_STEWARDSHIP_COMMAND_CENTER.md)
- [docs/DONOR_CRM_SIDEBAR_NAVIGATION.md](docs/DONOR_CRM_SIDEBAR_NAVIGATION.md)
- [docs/status/features.md](docs/status/features.md)

## What To Use For Live Operations Right Now

1. Donor core workflows: constituents, donations, campaigns, tasks.
2. Donor communication workflows: letters template creation, single and batch generation, print/mail queues, and email draft handoff.
3. Compassion core workflows: clients, cases, appointments, public slot-based scheduling.
4. Events core workflows: event registry, check-in, tables, guests with caution on known crash path.

## If You Hit an Error

1. Capture the page and action that failed.
2. Record exact time and user account.
3. Record whether the issue blocks data entry or only display/reporting.
4. Report to the CRM admin team with reproduction steps.
5. Continue in an alternate working path when available (for example fallback searches, dashboard-level reporting, alternate module page).

## Source Of Truth For Readiness

Use `docs/status/production-readiness-checklist.md` for the release-gate source of truth and current status labels.
## OyamaLetters Donation Group Handoff

From the Donations ledger, staff can select multiple gifts or select the visible monthly donors, then choose `Create Letters for Selected Donors`. OyamaLetters receives the unique donors as a temporary session list. Staff must still choose a template, review recipients, and generate the letters; the handoff does not publish, queue, or send automatically.

Signature presets are optional and are created or edited through the Branding Signatures modal visual builder. Uploaded PNG, JPG, and WEBP signatures render in generated PDFs.
