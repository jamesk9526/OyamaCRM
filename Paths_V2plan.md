```md
Redesign and rebuild Steward Paths as its own dedicated workspace using the same one-direction workspace method we used for OyamaLetters and OyamaEmail. Do not keep the old Steward Paths UI structure, old page layout, old component styling, or legacy design rules for this space. Treat this as a clean new tool workspace inside OyamaCRM. The goal is a focused automation/workflow builder for donor stewardship paths, not a tab inside another CRM screen. Build a new route structure such as `/steward-paths`, `/steward-paths/templates`, `/steward-paths/new`, `/steward-paths/[pathId]/builder`, `/steward-paths/[pathId]/review`, `/steward-paths/[pathId]/enrollments`, `/steward-paths/[pathId]/activity`, `/steward-paths/[pathId]/analytics`, and `/steward-paths/settings`.

Create a new Steward Paths workspace shell with its own sidebar, top bar, and progressive workflow. The sidebar should be dedicated only to Steward Paths and should include Dashboard, Path Library, Builder, Enrollments, Activity, Analytics, Settings, and Back to CRM. Do not reuse old crowded CRM navigation inside this workspace. The user flow should be: **Path Library → Create/Select Path → Build Automation Canvas → Configure Triggers → Configure Actions → Review & Validate → Publish Path → Enroll Donors → Monitor Activity → View Analytics**. Every screen should have one clear purpose and one main next action. The design should match the newer Oyama workspace direction: clean white content area, deep green sidebar, rounded cards, soft shadows, clear status badges, and professional enterprise SaaS spacing.

The core of the new workspace should be a visual Steward Path Builder. It should support nodes such as Start Trigger, Donor Segment Trigger, Gift Received, First-Time Donor, Lapsed Donor, Major Gift, Event Attended, Email Opened, Link Clicked, Task Created, Send Email, Generate Letter, Create Steward Task, Wait/Delay, If/Then Condition, Branch, Add Tag, Remove Tag, Update Donor Status, Notify Staff, Assign Owner, Stop Path, and Exit Goal. Make this a real working automation canvas, not a fake mockup. Nodes must save to real structured JSON, validate against backend rules, and be executable by the Steward Path engine. Do not hard-code fake nodes, fake stats, fake donors, fake path activity, or fake completion rates.

Create a clean backend/API boundary for Steward Paths. Audit the current Steward Paths code, existing automation code, donor segmentation code, task code, email/letter integration, and any old path UI. Keep useful backend logic only if it is real and working, but move it behind a cleaner Steward Paths API namespace. Create or refine endpoints like `/api/steward-paths`, `/api/steward-paths/:id`, `/api/steward-paths/:id/validate`, `/api/steward-paths/:id/publish`, `/api/steward-paths/:id/enrollments`, `/api/steward-paths/:id/activity`, `/api/steward-paths/:id/analytics`, `/api/steward-paths/:id/run-test`, `/api/steward-paths/templates`, and `/api/steward-paths/settings`. The builder must save real data, publish real path versions, and enroll real donors only after validation passes.

The Path Library should show real saved paths with status tags: Draft, Needs Review, Published, Active, Paused, Error, Archived. Cards should show path name, purpose, trigger type, enrolled donors, active donors, completed donors, error count, last run, owner, and last updated date. Add filters for All, Draft, Active, Paused, Errors, Archived, Donation Follow-up, New Donor Welcome, Lapsed Donor Recovery, Event Follow-up, Major Donor Stewardship, and Custom. A path should not show as active unless the backend confirms it is published and enabled.

The Review & Validate step must be strict. Validate missing trigger, disconnected nodes, impossible branches, missing email template, missing letter template, missing task owner, invalid delay, invalid segment, missing permissions, disabled email sending, disabled letter generation, missing merge fields, circular path loops, and actions that would create duplicate tasks/emails/letters. The user should see blockers, warnings, and recommendations before publishing. Publishing should create a versioned snapshot so future edits do not change already-running enrollments.

The Enrollment workspace should let users enroll donors from real sources: saved lists, donor segments, tags, donor status, first-time donors, lapsed donors, monthly donors, major donors, campaign donors, event attendees, or manual selection. Before enrollment, show validation counts: total matched, eligible, already enrolled, suppressed, missing email, missing address, do-not-contact, missing required data, and final enrollment count. No donor should be enrolled from fake data. The backend must re-run validation before enrollment so the frontend cannot bypass rules.

The Activity workspace should show a clear timeline for each path and each donor enrollment. Track events like donor enrolled, trigger matched, email drafted/sent, letter generated, task created, wait started, wait completed, branch selected, condition failed, action skipped, action completed, error occurred, staff notified, donor exited, and path completed. Every activity row must have timestamp, donor, node, action, result, error if any, and source. The user should always understand what happened and why.

The Analytics workspace should show real path performance: enrolled donors, active enrollments, completed enrollments, paused enrollments, failed enrollments, average completion time, task completion rate, email open/click rate when connected to OyamaEmail, letter generation count when connected to OyamaLetters, donations influenced, donor retention movement, lapsed donors re-engaged, and top-performing paths. Do not fake analytics. If a metric cannot be tracked yet, show a real “Not tracked yet” diagnostic and what backend event is needed.

Clean up old Steward Paths code after the new workspace is functional. Search the repo for all old Steward Paths pages, components, routes, links, mock data, and legacy design helpers. Remove or redirect old UI routes into the new workspace. Do not leave two ways to build or manage a path. Keep only one canonical user flow. Delete dead components only after verifying no imports remain. Update navigation so Steward Paths opens this new workspace, not the old embedded UI.

Testing is required. Add unit tests for path validation, node schema validation, branch logic, trigger matching, enrollment eligibility, version snapshots, and activity logging. Add API tests for create path, update path, validate path, publish path, enroll donors, pause path, resume path, archive path, and run test. Add Playwright tests for creating a new path, adding nodes, connecting nodes, validating blockers, publishing, enrolling donors, viewing activity, and seeing analytics. Add a source guard test that fails if production Steward Paths UI contains fake/demo/mock path data. The finished system must be real, clean, one-direction, and production-ready.
```


Here is the simplest user flow diagram for Steward Paths:

Path Library
    ↓
Choose a Template
or Create New Path
    ↓
Name the Path
and Pick a Goal
    ↓
Build the Path
on the Canvas
    ↓
Configure Each Step
Trigger → Action → Wait → Branch → Exit
    ↓
Review & Validate
Fix any blockers
    ↓
Publish Path
Creates a locked version
    ↓
Enroll Donors
Choose segment, list, tag, or manual donors
    ↓
Path Runs Automatically
Emails, letters, tasks, waits, branches
    ↓
Monitor Activity
See what happened and why
    ↓
View Analytics
See results, errors, and completion rates

Even simpler:

Library
  ↓
Create / Pick Path
  ↓
Build
  ↓
Validate
  ↓
Publish
  ↓
Enroll Donors
  ↓
Run Automatically
  ↓
Activity + Analytics

This matches the main Steward Paths V2 flow: Path Library → Create or Select Path → Build Path on Canvas → Configure Triggers and Actions → Review & Validate → Publish Path → Enroll Donors → Run Automatically → Monitor Activity → Analyze Results.