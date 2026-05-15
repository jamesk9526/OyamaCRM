# OyamaCRM Full CRM UX Refactor Plan — Microsoft 365 + HubSpot Direction

You are working in the OyamaCRM repo. This is a large, multi-phase CRM-wide refactor. Do not stop after one page or one phase. Iterate through every relevant module until the full plan is complete, tested, documented, and cleaned up.

The goal is to overhaul the CRM so it feels like a professional blend of Microsoft 365 and HubSpot: clean, dense but readable, workspace-first, ribbon-driven, fast to navigate, and free of bulky page headers, duplicate routes, dead UI, demo-only tools, and confusing workflows.

## Primary UX Problem

Many pages waste vertical space with large top cards such as:

“Saved Visual Paths  
Canonical Steward Paths workspace for build, run, and governance operations.  
New Visual Path  
Refresh  
31 total paths · 1 active”

This pattern must be removed across the CRM.

Replace these bulky page-header panels with a simple, elegant, single-line breadcrumb and compact workspace command area.

---

# New Global Page Layout Standard

Every CRM workspace should follow this layout:

1. Global TopBar
2. Global Sidebar
3. Single-line breadcrumb row
4. Optional compact ribbon toolbar
5. Main workspace content

Do not use large title cards at the top of pages unless the page is a true dashboard landing page and the card contains meaningful live metrics.

## New Breadcrumb Standard

Create a shared component:

`app/components/layout/WorkspaceBreadcrumbBar.tsx`

It should support:

- Breadcrumb path
- Current page title
- Optional small status badge
- Optional compact metadata
- Optional primary action
- Optional secondary actions inside a compact overflow menu

Example visual direction:

`Donor CRM > Steward Paths > Saved Visual Paths   |   31 paths · 1 active   [New Path] [...]`

It should be one line on desktop and compact/responsive on mobile.

Do not repeat large subtitles like “Canonical workspace for...” at the top of every page. Move those descriptions into tooltips, help drawers, empty states, or documentation.

---

# Ribbon-First Workspace Rule

Create or complete a shared ribbon system:

`app/components/workspace-ribbon/`

Recommended components:

- `WorkspaceRibbonFrame.tsx`
- `WorkspaceBreadcrumbBar.tsx`
- `WorkspaceRibbon.tsx`
- `WorkspaceRibbonGroup.tsx`
- `WorkspaceRibbonButton.tsx`
- `WorkspaceRibbonDropdown.tsx`
- `WorkspaceViewSwitcher.tsx`
- `WorkspaceSearchBox.tsx`
- `WorkspaceStatusBadge.tsx`
- `WorkspaceOverflowMenu.tsx`
- `WorkspaceInspectorDrawer.tsx`
- `WorkspaceWizard.tsx`
- `WorkspaceStepIndicator.tsx`
- `WorkspaceProjectLibrary.tsx`

The ribbon should replace page-level tabs, big header actions, and permanent right-hand rails.

Right-side panels are allowed only for:

- Selected item inspector
- Live preview
- Steward assistant panel
- Temporary details drawer
- Visual builder properties panel

Do not use right-side panels for normal navigation, quick actions, or “where do I go next?” controls.

---

# Phase 1 — CRM-Wide Header Cleanup

Search the entire repo for bulky page-header patterns.

Audit these patterns:

- Large rounded top cards
- `h1` + subtitle + action buttons inside a bordered card
- top page panels with counts
- duplicated title/subtitle blocks
- “Refresh” buttons sitting in page headers
- large workspace intro cards
- `space-y-*` pages where the first child is a title/action card

Search terms:

- `text-xl font-semibold`
- `text-2xl font-semibold`
- `rounded-xl border`
- `Refresh`
- `New Visual Path`
- `Canonical`
- `workspace for`
- `total paths`
- `active`
- `Create New`
- `New Task`
- `New Campaign`
- `New Template`
- `p-4 md:p-6`
- `items-center justify-between`
- `h1`

Replace those page-top blocks with the new breadcrumb bar and compact ribbon.

The page should feel like a software workspace, not a marketing landing page.

---

# Phase 2 — Microsoft 365 + HubSpot Visual System

Refactor the CRM UI style toward:

## Microsoft 365 traits

- Compact command ribbons
- Clean breadcrumb hierarchy
- Dense but readable data grids
- Clear module navigation
- Command groups instead of scattered buttons
- Contextual actions near the current workspace

## HubSpot traits

- Friendly CRM cards
- Clear object records
- Pipeline/board views
- Activity timelines
- Clean empty states
- Guided setup flows
- Strong search/filter UX
- One obvious next action

## Visual Rules

Use:

- White background
- Soft gray workspace canvas
- Thin borders
- Small badges
- Consistent command buttons
- Compact toolbars
- Clean table density
- Rounded but not oversized cards
- Less vertical padding above content

Avoid:

- Giant hero headers
- Redundant subtitles
- Multiple competing action areas
- Random right sidebars
- Separate ways to do the same thing
- Demo cards pretending to be features
- Long pages full of disconnected panels

---

# Phase 3 — One-Way Workflow Cleanup

Every major tool must have one clear way to complete a task.

Audit and deduplicate workflows across:

- Tasks
- Communications
- Letters & Printables
- Steward Paths
- Donor records
- Constituents
- Donations
- Campaigns
- Reports
- Grants
- Events
- Compassion CRM
- HRM
- Watchdog
- Webmaster
- Settings
- Data Tools
- Imports

For every tool, answer:

1. What is the main user goal?
2. Where does the user start?
3. What is the correct path?
4. Are there duplicate paths?
5. Are there old pages still accessible?
6. Are there nonfunctional buttons?
7. Are there demo-only areas?
8. Is this tool production-ready?
9. Should it be fixed, merged, hidden, or removed?

Remove duplicate and nonfunctional UI. Do not leave dead routes in navigation.

If a feature is not functional and not worth finishing now, remove it from the UI and clean the dead code where safe.

If a feature is required but incomplete, finish it instead of leaving a warning.

Do not keep fake functionality.

---

# Phase 4 — Guided Flow Completion

All guided steps must actually work. Do not leave wizard steps as visual placeholders.

The Communications project flow must be fully functional:

`Choose Type -> Choose Audience -> Choose Preset -> Edit -> Review -> Schedule/Send`

Each step must have real settings, persistence, validation, and navigation.

## Communications Requirements

### Choose Type

Must support real communication types:

- Email Campaign
- Newsletter
- Thank-You Email
- Appeal
- Event Invitation
- Donor Update
- Letter/Print handoff
- Steward Path generated draft

### Choose Audience

Must allow:

- All donors
- Saved segment
- Campaign donors
- Lapsed donors
- First-time donors
- Monthly donors
- Major donors
- Custom filtered list
- Manual selected constituents

Must respect:

- doNotEmail
- emailOptOut
- doNotContact
- invalid/missing emails
- suppressed/bounced/unsubscribed records

### Choose Preset

Must load:

- Built-in templates
- Organization templates
- User-created presets
- Saved sections
- Brand defaults
- Recent drafts

### Edit

Must open the real editor with the selected campaign/draft context.

### Review

Must validate:

- subject
- from name
- from email
- audience count
- unsubscribe compliance
- missing merge fields
- broken personalization
- suppressed recipients
- empty content
- test-send status

### Schedule/Send

Must support:

- Save as draft
- Schedule
- Send test
- Queue for sending
- Cancel scheduled send
- Send now only with confirmation

If any step cannot work, implement it or remove it from the flow.

---

# Phase 5 — Letters & Printables Completion

Letters & Printables must follow:

`Template Library -> Choose Template -> Choose Recipient(s) -> Preview Merge -> Generate -> Print/Mail/Email Draft`

Everything must work.

Required areas:

- Template library
- Preset library
- Header presets
- Footer presets
- Signature presets
- Branding presets
- Recipient selection
- Merge field validation
- Preview
- Generate
- Generated letters
- Print queue
- Mail queue
- PDF/export if advertised
- Email draft handoff if advertised

If PDF export is partial, either finish it or remove the visible button until it works.

Do not keep fake print/mail production flows.

---

# Phase 6 — Steward Paths Cleanup

Steward Paths should be a professional automation/workflow workspace.

Remove the bulky “Saved Visual Paths” header card.

Use breadcrumb:

`Donor CRM > Steward Paths > Saved Visual Paths`

Use ribbon groups:

- Library: Saved Paths, Templates, Archived
- Create: New Path, Duplicate, Import
- Run: Test Run, Enable, Pause
- Governance: Share, Permissions, History
- View: Cards, Table, Active Only, Archived
- Help: How Paths Work

The Steward Paths list should not start with a large header card. It should start with the breadcrumb and ribbon, then immediately show useful content.

Remove deprecated automation UI from normal navigation if Steward Paths is now canonical.

If legacy `/automations` is deprecated, either redirect it cleanly or remove it from the visible CRM.

---

# Phase 7 — Tasks System Overhaul

Tasks must become a true work-management system, not just a table.

Create a task command center with:

- My Work Today
- Overdue
- Due Soon
- Assigned to Me
- Assigned by Me
- Team Queue
- Follow-Ups
- Thank-Yous
- Calls
- Emails
- Meetings
- Steward Path Tasks
- Letter/Print/Mail Tasks
- Completed
- Archived

Use breadcrumb:

`Donor CRM > Tasks > My Work`

Use ribbon groups:

- Work Queues: My Today, Overdue, Due Soon, Team, Completed
- Create: New Task, From Template, Steward Suggested
- Assignment: Assign, Reassign, Bulk Assign
- Schedule: Due Date, Reminder, Snooze
- Actions: Start, Complete, Log Outcome, Follow-Up
- View: Board, List, Calendar, Archive
- Settings: Templates, Notification Rules

Task creation should be wizard-based:

`Purpose -> Context -> Template -> Assignment -> Schedule -> Review`

Task details should open in a drawer or full detail page with:

- Status
- Priority
- Type
- Assignee
- Creator
- Due date
- Reminder
- Linked constituent
- Linked campaign/donation/letter/meeting/path
- Notes
- Checklist
- Activity timeline
- Complete/start/snooze/reassign/log outcome actions

Completing a task must allow logging the outcome.

Tasks are planned work. Activities are what happened. Completion should write a meaningful activity when linked to a constituent.

---

# Phase 8 — Notifications Must Actually Work

Notifications must become durable, not just a temporary generated feed.

Add or complete a real notification system with:

- user-specific unread count
- read status
- dismissed status
- snooze
- deep links
- source object
- priority
- module
- timestamp
- action metadata

Required actions:

- Mark read
- Mark all read
- Dismiss
- Snooze
- Refresh
- Open target record

The TopBar bell must:

- show accurate unread count
- refresh after task changes
- refresh after notification actions
- deep-link correctly
- gracefully handle API failures
- never show fake unread counts

Notifications should be created for:

- task assigned
- task due soon
- task overdue
- meeting upcoming
- Steward Path task generated
- letter needs review
- print/mail queue action needed
- Compassion follow-up due
- Watchdog alert
- Webmaster review item

---

# Phase 9 — Personal Task Calendar

Add a true personal calendar view for tasks.

This is the final functional phase after the main cleanup.

Route:

`/tasks/calendar`

or as a view inside `/tasks`:

`/tasks?view=calendar`

Calendar must be real and interactive.

Required views:

- Month
- Week
- Day
- Agenda

Required features:

- Drag and drop task to reschedule
- Resize or quick-change due date where appropriate
- Click task to open details drawer
- Create task by clicking a date/time
- Filter by assignee
- Filter by type
- Filter by priority
- Filter by status
- Show overdue tasks
- Show unscheduled tasks in a side tray or ribbon dropdown
- Move unscheduled task onto calendar
- Sync with task dueDate/reminderAt fields
- Refresh notifications after reschedule
- Log activity when due date changes
- Respect user permissions

Calendar should feel like Outlook/Microsoft 365, not a simple list.

Recommended library options:

- FullCalendar
- React Big Calendar
- Custom lightweight calendar only if drag/drop is solid

Do not ship a fake calendar. It must actually update task dates through the API.

---

# Phase 10 — Repo Cleanup and Legacy Removal

After the UI and workflow refactor, clean the repo.

Search for and remove:

- unused components
- unused routes
- old right-rail control components no longer used
- duplicate workflow pages
- fake demo components
- dead buttons
- old screenshots
- stale docs
- old visual path/automation pages
- unused imports
- unused API routes
- duplicate helpers
- duplicate status labels
- orphaned CSS/classes
- unreferenced test files
- outdated README claims

Do not remove database fields casually if data may exist. For schema cleanup, create clear migrations and document the risk.

For code removal, use this rule:

- If it is unused and not part of a planned feature: delete it.
- If it is duplicate and another path is canonical: remove or redirect it.
- If it is partial and visible to users: finish it or remove it.
- If it is important but incomplete: move it out of navigation and document it as backlog.
- If tests rely on dead code: update the tests to the new canonical path.

---

# Phase 11 — Documentation Cleanup

Update documentation after each phase.

Required docs:

- `AGENTS.md`
- `README.md`
- `docs/howto/HOW_TO_USE.md`
- `docs/status/features.md`
- `docs/status/production-readiness-checklist.md`
- Donor CRM audit docs
- Communications docs
- Letters & Printables docs
- Tasks docs
- Notifications docs
- Steward Paths docs
- Workspace layout docs

Documentation must describe the current app, not old plans.

Remove stale claims.

Do not mark anything as Working unless it is actually wired, tested, and usable.

Use only these status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

---

# Phase 12 — AGENTS.md Rule Update

Update `AGENTS.md` so future agents follow the new UX direction.

Add this rule:

## Ribbon-First Workspace Rule

All major CRM workspaces must use the ribbon-first layout. The global sidebar remains for module navigation, but each tool workspace should use a compact breadcrumb and ribbon toolbar for local actions.

Avoid large page header cards, duplicate title/subtitle panels, permanent right-side control rails, and scattered action buttons.

Right-side panels are only allowed for selected-item inspectors, live previews, Steward assistant panels, or temporary detail drawers.

Tool-heavy workspaces should be project-manager-first:

1. Library/dashboard
2. Guided wizard
3. Editor/detail workspace
4. Review/complete step

This applies especially to:

- Tasks
- Communications
- Letters & Printables
- Steward Paths
- Grants
- Events
- Reports
- Data Tools
- Compassion Appointments
- Webmaster

Agents may make coordinated multi-file changes when improving core UX systems. Do not be overly restrictive when a workflow is broken or confusing. Preserve privacy, permissions, audit behavior, and data boundaries, but allow meaningful refactors when they simplify the product and remove duplication.

---

# Phase 13 — Testing and Acceptance

Run and fix:

- typecheck
- lint
- unit tests
- API tests
- smoke tests
- E2E tests
- browser walkthroughs for all changed workflows

Required manual/browser checks:

- Every major page has compact breadcrumb instead of bulky header card.
- Ribbon appears where local actions are needed.
- No permanent right rail is used for normal navigation.
- Communications guided flow works start to finish.
- Letters guided flow works start to finish.
- Tasks can be created, assigned, completed, snoozed, and rescheduled.
- Notifications read/dismiss/snooze work.
- TopBar unread count works.
- Personal task calendar drag/drop rescheduling works.
- No visible demo-only or nonfunctional buttons remain.
- Old duplicate routes are removed, redirected, or hidden.
- Documentation matches reality.

---

# Final Definition of Done

This refactor is not complete until:

1. Bulky page-top title cards are removed CRM-wide.
2. Every major workspace uses breadcrumb + ribbon.
3. Communications wizard works fully.
4. Letters wizard works fully.
5. Tasks are a true work-management system.
6. Notifications are durable and functional.
7. Personal task calendar works with drag/drop rescheduling.
8. Dead UI and legacy code are removed.
9. Duplicate workflows are eliminated.
10. Documentation is cleaned and current.
11. All tests pass or remaining failures are documented honestly.
12. The CRM feels like professional Microsoft 365 + HubSpot-style software, not a collection of unfinished pages.

Keep iterating phase by phase until all phases are complete.


## Phase 14 — Review and Update All Agent Instruction Files

Review every agent instruction file in the repo and update them so all future agents follow the new OyamaCRM product direction.

Search for all files with names like:

- `AGENTS.md`
- `agents.md`
- `AGENT.md`
- `agent.md`
- `.agents.md`
- module-specific agent files
- any docs that contain agent rules, Copilot rules, contributor rules, or implementation instructions

Do not only update the root `AGENTS.md`. Search the full repo and update every relevant agent guidance file.

The goal is to make all agent instructions consistent with the new CRM direction:

1. The CRM should feel like a professional blend of Microsoft 365 and HubSpot.
2. Major workspaces should use compact breadcrumb + ribbon layouts.
3. Bulky page-header cards should be removed.
4. Permanent right-side rails should not be used for normal navigation.
5. Guided workflows must be real, wired, tested, and functional.
6. Nonfunctional CRM features should be completed or removed from the UI.
7. Legacy/demo-only/dead code should be cleaned up.
8. Every tool should have one clear canonical workflow.
9. Documentation must describe the current working app, not old plans.
10. Agents should be allowed to make meaningful multi-file refactors when needed.

Add or update a rule like this in every relevant agent file:

### Current Product Direction

OyamaCRM is being refactored into a polished, professional CRM experience inspired by Microsoft 365 and HubSpot. Future work should favor compact workspace layouts, clear breadcrumbs, ribbon-style toolbars, clean data views, guided workflows, and one obvious path for each action.

Avoid large page-top title cards, redundant subtitles, scattered buttons, permanent right-side control rails, duplicate workflows, fake demo features, and unfinished UI that appears functional but is not wired.

Major workspaces should follow this structure:

1. Global TopBar
2. Global Sidebar
3. Single-line breadcrumb bar
4. Compact ribbon toolbar when actions are needed
5. Main workspace content

Right-side panels are allowed only for selected-item inspectors, live previews, Steward assistant panels, temporary details drawers, or visual-builder property panels. Do not use right-side rails for normal navigation or general page controls.

All guided flows must be real. For example, Communications must fully support:

`Choose Type -> Choose Audience -> Choose Preset -> Edit -> Review -> Schedule/Send`

Each step must include the needed settings, persistence, validation, and functionality. If a feature or step is not functional, finish it or remove it from the visible CRM until it is ready.

Agents may make coordinated multi-file changes when improving core UX systems, removing duplication, finishing incomplete workflows, or cleaning legacy code. Do not be overly restrictive when the current architecture blocks a better product. Preserve privacy, permissions, audit logs, data boundaries, and source-of-truth rules, but allow meaningful refactors that make the CRM cleaner, simpler, and more usable.

When updating agent files, remove or soften older rules that prevent reasonable refactoring. Keep safety, privacy, data integrity, and permission boundaries strict. Relax rules that make agents afraid to improve architecture, clean dead code, remove duplicate routes, or standardize the UI.

After updating all agent files, document what changed:

- Which agent files were found
- Which files were updated
- Which outdated rules were removed or softened
- Which new ribbon/breadcrumb/workflow rules were added
- Any remaining agent files that need manual review

Do not mark this phase complete until all agent instruction files are consistent with the new CRM-wide direction.

## Autopilot Execution Rule — Continue Until Production Ready

Autopilot is enabled for this project. Do not stop after completing only one file, one page, one component, or one phase. Continue working phase by phase until the CRM is no longer in a partial-completion state and the affected systems are production-ready.

When given a multi-phase plan, follow this execution pattern:

1. Read the full plan first.
2. Identify all affected files, routes, components, API endpoints, database models, tests, and documentation.
3. Start with Phase 1.
4. Complete the phase as fully as possible.
5. Run the relevant checks.
6. Fix issues created by the phase.
7. Update documentation/status files.
8. Move immediately to the next phase.
9. Repeat until every phase is completed.
10. Only stop when the system is working, tested, documented, and cleaned up.

Do not ask for permission to continue from one phase to the next. The instruction is to keep going.

Do not leave work in a state where the UI appears complete but the functionality is not wired. If a feature is visible in the CRM, it must be functional, connected to real data, validated, and tested. If it cannot be completed in this pass, remove it from the visible UI and document it as backlog.

Production-ready means:

- The feature is wired to real data.
- The UI works end to end.
- Forms save correctly.
- Buttons perform real actions.
- Navigation is clear.
- Duplicate paths are removed.
- Dead code is cleaned up.
- Partial/demo-only UI is removed or completed.
- Permissions and data boundaries are respected.
- Errors are handled clearly.
- Tests are added or updated.
- Typecheck/lint/tests pass, or remaining failures are documented with exact reasons.
- Documentation matches the current working app.

Do not mark a phase complete if anything important is still fake, partial, broken, duplicated, or only visually implemented.

Use this rule for all major systems:

- Tasks
- Notifications
- Communications
- Letters & Printables
- Steward Paths
- Donor records
- Campaigns
- Reports
- Events
- Compassion CRM
- HRM
- Settings
- Data import/export
- Workspace layout and ribbons
- Documentation
- Agent instruction files

When you discover partial work, do not simply label it partial and move on. Either finish it, remove it from the visible CRM, or clearly move it to backlog with no active navigation path pretending it is ready.

At the end of each phase, update a running completion log with:

- Phase name
- Files changed
- Features completed
- Features removed
- Tests run
- Remaining issues
- Whether the phase is production-ready

If the phase is not production-ready, continue working until it is. Do not proceed while knowingly leaving broken work behind unless the broken item has been safely removed from the user-facing CRM and documented as backlog.

Final completion is only acceptable when:

1. All phases in the plan have been addressed.
2. No visible CRM feature is fake or misleading.
3. All guided workflows work end to end.
4. All major pages follow the new breadcrumb/ribbon layout.
5. Legacy and duplicate code has been cleaned.
6. Documentation is current.
7. Tests have been run and results recorded.
8. The CRM is in a production-ready state rather than a partial-completion state.

Continue iterating until those conditions are met.

## Workspace Main Content UI Rule — Ribbon Controls Only

Review and update all UI rules, layout docs, agent instructions, workspace components, and existing workspace pages so the main content area inside every CRM workspace follows the ribbon-first control pattern.

This rule applies to the main content area after the global TopBar and global Sidebar.

Every major workspace should be structured like this:

1. Compact breadcrumb bar
2. Ribbon toolbar for main controls
3. Main content area
4. Optional contextual drawer/inspector only when an item is selected

The ribbon at the top of the workspace is the required location for primary workspace controls.

Main controls that belong in the ribbon include:

- Create/new actions
- Refresh/sync actions
- Search
- Filters
- View switching
- Sorting
- Bulk actions
- Import/export
- Template/preset actions
- Workflow step navigation
- Assignment controls
- Schedule/date controls
- Review/validation controls
- Settings for the current tool

Do not place main workspace controls in:

- Large page header cards
- Permanent right-side rails
- Random floating panels
- Scattered buttons above tables
- Repeated action rows inside multiple cards
- Duplicate tab systems
- Oversized dashboard hero sections

Right-side panels may only be used for contextual work such as:

- Selected record details
- Selected task details
- Email/letter preview
- Steward assistant
- Builder property inspector
- Activity timeline
- Temporary review drawer

They must not be used as the primary control system for the workspace.

Audit all existing workspaces and refactor any page that violates this rule, especially:

- Tasks
- Notifications
- Communications
- Email Builder
- Letters & Printables
- Steward Paths
- Donor records
- Constituents
- Donations
- Campaigns
- Reports
- Grants
- Events
- Compassion Appointments
- HRM
- Webmaster
- Watchdog
- Settings
- Data import/export

For each workspace, move main controls into clear ribbon groups.

Recommended ribbon groups:

### General Workspace Ribbon

- Create
- View
- Search
- Filter
- Sort
- Actions
- Export
- Settings

### Task Workspace Ribbon

- Work Queues
- Create
- Assignment
- Schedule
- Actions
- View
- Settings

### Communications Ribbon

- Project
- Create
- Audience
- Design
- Review
- Send
- Settings

### Letters & Printables Ribbon

- Library
- Create
- Merge
- Preview
- Production
- Settings

### Steward Paths Ribbon

- Library
- Create
- Run
- Governance
- View
- Settings

### Records Ribbon

- Profile
- Activity
- Giving
- Communication
- Tasks
- Actions

### Import/Data Tools Ribbon

- Source
- Mapping
- Validation
- Import
- Review
- Export

Update shared layout documentation and all agent instruction files to clearly state:

“Inside CRM workspaces, the ribbon is the canonical home for main controls. Do not create new right-rail control systems, large header action cards, or scattered button groups. If a workspace needs controls, add them to the ribbon.”

If the app already has partial ribbon components, finish and standardize them. If multiple ribbon implementations exist, deduplicate them into one canonical system.

Do not mark this complete until:

- Every major workspace has been audited.
- Main controls have been moved to the ribbon.
- Large page control cards have been removed.
- Right-side rails are only contextual inspectors/previews.
- Duplicate controls have been eliminated.
- Agent/UI documentation has been updated.
- Typecheck, lint, and relevant UI smoke tests pass.