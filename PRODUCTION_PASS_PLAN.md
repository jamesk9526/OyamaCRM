```md id="g7h2kq"
# OyamaCRM Large Refactor, Fix, Finish, AI Readiness, and Enterprise UX Pass

Autopilot is enabled. Work through this plan phase by phase and continue until the CRM is production-ready, not partially implemented. This is not a polish-only pass. This is a full refactor, completion, cleanup, and readiness pass across the CRM.

The goal is to turn OyamaCRM into a professional, enterprise-level nonprofit CRM experience that feels like a blend of Microsoft 365, HubSpot, and a modern AI-assisted operations platform.

The CRM should feel:

- Clean
- Fast
- Trustworthy
- Enterprise-ready
- Easy for nontechnical staff
- Consistent across modules
- Fully wired to real data
- Free of fake/demo-only features
- Ready for AI assistance without depending on AI as the source of truth

---

## Core Rule

Do not leave visible CRM features in a partial state.

For every partial implementation, choose one of these paths:

1. Finish it fully.
2. Remove it from the visible UI.
3. Move it to documented backlog with no active user-facing route pretending it works.

Do not keep fake buttons, demo panels, incomplete wizards, visual-only workflows, or placeholder AI features in the production UI.

---

# Phase 1 — Full Partial Implementation Audit

Search the entire repo for all incomplete, fake, placeholder, partial, demo, or broken work.

Search terms:

- `TODO`
- `FIXME`
- `partial`
- `Partially Working`
- `demo`
- `placeholder`
- `mock`
- `fake`
- `not implemented`
- `coming soon`
- `stub`
- `temporary`
- `legacy`
- `deprecated`
- `WIP`
- `needs API`
- `needs wiring`
- `hardcoded`
- `sample data`
- `test data`
- `static data`
- `unavailable`
- `disabled`
- `alert(`
- `window.prompt`
- `window.confirm`
- `console.log`
- `any`
- `eslint-disable`
- `ts-ignore`

Create or update a central audit file:

`docs/status/PARTIAL_IMPLEMENTATION_AUDIT.md`

For each issue, document:

- Feature/module
- File path
- Current status
- What is broken or partial
- Whether it should be finished, removed, merged, or moved to backlog
- Required API/database work
- Required UI work
- Required tests
- Final resolution

Do not stop at documenting. After the audit, start fixing the issues.

---

# Phase 2 — Production Readiness Matrix

Update the CRM-wide readiness matrix.

Create or update:

`docs/status/PRODUCTION_READINESS_MATRIX.md`

Use these exact status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented
- Removed From UI
- Backlog

Track every major system:

- Donor Dashboard
- Donor Records
- Constituents
- Donations
- Campaigns
- Communications
- Email Builder
- Letters & Printables
- Tasks
- Notifications
- Steward Paths
- Steward AI
- Reports
- Grants
- Events CRM
- Compassion CRM
- Appointments
- HRM
- Watchdog
- Webmaster
- Settings
- Imports
- Exports
- User/role permissions
- Organization settings
- Audit/activity timelines
- Calendar views
- Search
- Data quality tools

A feature may only be marked Working if:

- UI is wired
- API works
- database persistence works
- permissions are respected
- errors are handled
- navigation is clear
- tests exist or are updated
- documentation matches the current behavior

---

# Phase 3 — Enterprise UI System Pass

Refactor the UI into one consistent enterprise design language.

The CRM should feel like Microsoft 365 plus HubSpot:

## Microsoft 365 influence

- Compact ribbon controls
- Clear breadcrumbs
- Professional workspace density
- Consistent command groups
- Calendar/task productivity patterns
- Strong table/grid design
- Predictable navigation

## HubSpot influence

- Friendly CRM object pages
- Clean cards
- Activity timelines
- Guided workflows
- Pipeline/board views
- Clear empty states
- Strong search/filter experiences
- One obvious next step

## Required Global UI Rules

Every major workspace must use:

1. Global TopBar
2. Global Sidebar
3. Compact breadcrumb bar
4. Ribbon toolbar for main controls
5. Main workspace content
6. Optional contextual drawer/inspector

Remove:

- large page billboard cards
- repeated title/subtitle headers
- permanent right-rail navigation controls
- scattered action buttons
- duplicate tab systems
- visual-only panels
- fake dashboard cards
- wasted vertical space

Create or standardize these shared components:

- `WorkspaceBreadcrumbBar`
- `WorkspaceRibbon`
- `WorkspaceRibbonGroup`
- `WorkspaceRibbonButton`
- `WorkspaceRibbonDropdown`
- `WorkspaceViewSwitcher`
- `WorkspaceSearchBox`
- `WorkspaceStatusBadge`
- `WorkspaceInspectorDrawer`
- `WorkspaceEmptyState`
- `WorkspaceLoadingState`
- `WorkspaceErrorState`
- `EnterpriseDataTable`
- `EnterpriseCardGrid`
- `EnterpriseCommandMenu`

Do not create one-off layouts for every page. Build shared layout primitives and migrate workspaces to them.

---

# Phase 4 — Navigation and Information Architecture Cleanup

Audit the global sidebar, topbar, workspace navigation, and route structure.

The CRM should have one clear way to reach each tool.

Remove or merge:

- duplicate pages
- old route aliases
- hidden legacy workspaces
- confusing alternate flows
- duplicated builders
- old dashboards that no longer match the current product
- demo-only navigation entries
- deprecated modules

Every navigation item must answer:

- What does this page do?
- Is it functional?
- Who uses it?
- Is there another page that does the same thing?
- Should it remain visible?
- Should it be moved under Settings, Tools, Admin, or Backlog?

Preferred structure:

- Dashboard
- Donors
- Donations
- Campaigns
- Communications
- Letters & Printables
- Tasks
- Calendar
- Reports
- Steward
- Events
- Compassion
- HRM
- Settings
- Admin Tools

Do not keep navigation clutter just because a route exists.

---

# Phase 5 — Guided Workflow Completion

Every guided workflow must work end to end.

Audit all guided flows and wizard flows.

Required standard:

- every step saves
- every step validates
- users can go back and forward
- current progress is clear
- errors are useful
- final review screen is meaningful
- completion creates real records
- activity/audit logging happens where appropriate
- there are no fake or visual-only steps

Priority guided flows:

## Communications

`Choose Type -> Choose Audience -> Choose Preset -> Edit -> Review -> Schedule/Send`

Must be fully functional.

## Letters & Printables

`Template Library -> Choose Template -> Choose Recipient(s) -> Preview Merge -> Generate -> Print/Mail/Email Draft`

Must be fully functional.

## Tasks

`Purpose -> Context -> Template -> Assignment -> Schedule -> Review`

Must be fully functional.

## Imports

`Upload -> Map Fields -> Validate -> Review Changes -> Import -> Results`

Must be fully functional.

## Steward Paths

`Choose Trigger -> Choose Audience/Target -> Build Steps -> Safety Review -> Test Run -> Activate`

Must be fully functional.

Remove or hide any guided workflow that cannot be finished.

---

# Phase 6 — Tasks, Notifications, and Calendar Finish Pass

Tasks and notifications must become production-ready work-management tools.

## Tasks must support:

- create
- edit
- assign
- reassign
- start
- complete
- snooze
- reschedule
- delete/archive
- log outcome
- create follow-up
- link to constituent/campaign/donation/letter/meeting/path
- activity timeline entry
- checklist items
- reminders
- priority
- filters
- board view
- list view
- calendar view
- completed/archive view

## Notifications must support:

- durable notification records
- unread count
- mark read
- mark all read
- dismiss
- snooze
- deep links
- priority/severity
- source module/source record
- refresh after task actions
- topbar bell integration

## Calendar must support:

- personal task calendar
- month/week/day/agenda views
- drag and drop rescheduling
- click to open task drawer
- create task from calendar
- unscheduled task tray
- filters by assignee/type/status/priority
- notification refresh after reschedule

Do not ship a fake calendar. Drag and drop must update the real task record.

---

# Phase 7 — Steward AI Readiness Pass

Steward AI must be ready as a safe, enterprise-grade AI layer.

AI should assist the CRM, not become the source of truth.

## AI Source-of-Truth Rule

The CRM database is the source of truth.

Steward may:

- summarize
- analyze
- recommend
- draft
- explain
- create suggested tasks
- prepare lists
- generate reports
- help users navigate
- identify risks/opportunities

Steward must not silently:

- send emails
- delete records
- merge records
- export sensitive data
- alter gift records
- mark donations acknowledged
- enroll donors into workflows
- change communication preferences
- update critical statuses

High-impact actions require explicit confirmation.

## AI Readiness Requirements

Audit and finish:

- Steward runtime status
- local AI/Ollama configuration
- remote/local API configuration
- model health check
- fallback deterministic mode
- clear AI availability indicator
- prompt safety
- permission checks
- RAG/source grounding
- CRM evidence display
- action confirmation flow
- audit logging for AI-assisted actions
- AI-generated draft labeling
- error handling when AI is unavailable

## AI UI Requirements

Add clear UI states:

- AI Connected
- AI Thinking
- AI Running Task
- AI Offline
- AI Fallback Mode
- AI Error
- Local Model Unavailable
- Remote Endpoint Unavailable

Users should always understand whether they are seeing:

- deterministic CRM logic
- AI-enhanced recommendation
- saved CRM data
- draft content needing review

## Steward Assistant UX

Steward should feel integrated, not bolted on.

It should support:

- topbar access
- workspace-aware context
- selected-record context
- suggested next actions
- safe draft generation
- task suggestions
- donor analysis
- campaign analysis
- report summaries
- evidence/citations from CRM records
- confirmation before action

---

# Phase 8 — Donor CRM Enterprise Finish Pass

Make the Donor CRM feel complete and professional.

Audit and improve:

- dashboard widgets
- donor record pages
- giving history
- activity timeline
- communication history
- notes
- tasks
- campaigns
- donor segmentation
- lapsed donor tools
- first-time donor tools
- monthly donor tools
- major donor tools
- donor search
- donor filters
- import/export
- reporting
- stewardship recommendations

Every donor record should feel like a real CRM object page.

Suggested donor record layout:

1. Breadcrumb
2. Compact record header
3. Ribbon actions
4. Left/main profile sections
5. Activity timeline
6. Giving summary
7. Tasks/follow-ups
8. Communication history
9. Notes
10. Steward insights

Remove fake donor intelligence panels unless they are backed by real data or deterministic calculations.

---

# Phase 9 — Communications and Email Builder Finish Pass

Communications must become a polished campaign workspace.

Finish:

- campaign library
- draft management
- audience selection
- segment selection
- template selection
- email builder
- merge fields
- saved sections
- brand presets
- test send
- review checklist
- schedule/send
- communication log
- unsubscribe/suppression handling
- send status
- campaign analytics if visible

Email Builder must support:

- real campaign context
- autosave or clear save behavior
- block editing
- preview
- personalization
- review validation
- plain text preview
- test send
- schedule/send handoff
- version/revision handling if visible
- no fake AI generation buttons

---

# Phase 10 — Reports and Analytics Finish Pass

Reports should feel useful and trustworthy.

Audit all reports.

Every visible report must have:

- real data source
- date range controls
- filters
- export if advertised
- loading state
- empty state
- error state
- explanation of metrics
- no fake demo data

Priority reports:

- donor retention
- lapsed donors
- campaign performance
- giving by date range
- first-time donors
- monthly donors
- major donors
- task completion
- communication activity
- event giving
- stewardship activity

If a chart is not wired to real data, remove it or finish it.

---

# Phase 11 — Compassion CRM and Appointments Finish Pass

Compassion CRM should become functional, not demo-only.

Audit:

- client records
- appointment scheduling
- appointment calendar
- appointment list
- staff assignment
- services
- follow-ups
- notes
- resource referrals
- office management
- HRM availability integration
- separation from donor data

Appointments must support:

- create
- edit
- reschedule
- cancel
- assign staff
- calendar view
- list view
- full-screen calendar
- drag and drop rescheduling
- reminders/follow-ups if visible
- status tracking

Data boundaries are critical. Compassion data must not cross-contaminate donor data.

---

# Phase 12 — Events CRM Finish Pass

Events CRM should have a clear event-scoped model.

Before event-specific tools are active, users should select an event.

Required structure:

1. Events dashboard
2. Select event
3. Event-scoped workspace
4. Event tools
5. Cross-event reports
6. Event page builder

Finish or clean up:

- event list
- event dashboard
- guest management
- tickets
- tables
- seating chart
- check-in
- event communications
- event reports
- event page builder
- template-based event pages
- drag/drop event page editing if visible

Do not let event-specific tools operate without clear event scope.

---

# Phase 13 — Settings, Admin, Permissions, and Onboarding

Enterprise software needs strong settings and admin structure.

Audit and finish:

- organization settings
- user management
- roles/scopes
- permissions
- module visibility
- AI settings
- email settings
- branding settings
- notification settings
- task settings
- import/export settings
- data retention settings
- audit log settings
- onboarding flow

Settings should be clear and grouped.

Suggested settings structure:

- Organization
- Users & Roles
- Permissions
- Branding
- Communications
- Tasks & Notifications
- Steward AI
- Imports & Data
- Integrations
- Security
- Audit Logs
- Developer/Admin

Remove settings that do nothing.

---

# Phase 14 — Data Quality, Import, Export, and Safety

Make data tools trustworthy.

Finish:

- CSV import
- field mapping
- validation
- duplicate detection
- merge preview
- import summary
- rollback strategy if possible
- error report
- export tools
- data quality dashboard

Import workflows must not blindly corrupt data.

Required import steps:

`Upload -> Field Mapping -> Validation -> Duplicate Review -> Import Preview -> Confirm Import -> Results`

Do not keep an import button visible unless the full flow works safely.

---

# Phase 15 — Error Handling and Empty States

Every major workspace needs enterprise-grade states.

Add or standardize:

- loading skeletons
- empty states
- error states
- permission denied states
- offline/unavailable states
- AI unavailable states
- no results states
- filtered empty states
- save success states
- validation error states

Avoid raw errors, blank screens, silent failures, and console-only failures.

Every failed action should tell the user:

- what failed
- why it may have failed
- what to do next
- whether data was saved

---

# Phase 16 — Performance and Responsiveness

Audit performance.

Fix:

- slow pages
- repeated API calls
- unnecessary client rendering
- oversized components
- unpaginated tables
- expensive filters
- repeated calculations
- large bundles
- unnecessary rerenders
- missing loading states

Large CRM tables need:

- pagination or virtualization
- search
- filters
- sort
- clear empty states
- export only when safe and functional

The app should feel fast even with large donor data.

---

# Phase 17 — Accessibility and Staff Usability

Improve usability for real nonprofit staff.

Audit:

- keyboard navigation
- focus states
- color contrast
- button labels
- form labels
- required field markers
- error messages
- screen reader labels
- modal focus trapping
- table accessibility
- calendar accessibility
- tooltips/help text

Use plain language.

Avoid overly technical UI labels.

Every workflow should be understandable to office staff without developer help.

---

# Phase 18 — Legacy Code and Duplication Cleanup

After finishing features, clean the repo.

Remove:

- unused components
- duplicate components
- old workspace layouts
- old right rail systems
- fake demo data
- unused routes
- dead API routes
- stale docs
- old screenshots
- unused CSS
- unused helpers
- duplicate service logic
- old builder versions
- temporary compatibility code

Be careful with database migrations and existing data.

If something cannot be safely removed, mark it clearly and document why.

---

# Phase 19 — Testing Pass

Add and run tests for every major completed system.

Required test areas:

- tasks API
- notifications API
- task calendar drag/drop
- communications guided flow
- letters guided flow
- Steward Paths workflow
- donor record actions
- imports
- permissions
- AI runtime status
- fallback AI behavior
- topbar notifications
- ribbon layout smoke tests
- navigation smoke tests

Run:

- typecheck
- lint
- unit tests
- integration/API tests
- E2E tests
- smoke tests
- browser walkthroughs

Fix failures caused by this work.

Do not mark complete without recording test results.

---

# Phase 20 — Documentation and Final Readiness

Update all docs to reflect the current app.

Update:

- `README.md`
- `AGENTS.md`
- all module-specific agent files
- `docs/howto/HOW_TO_USE.md`
- `docs/status/features.md`
- `docs/status/production-readiness-checklist.md`
- `docs/status/PRODUCTION_READINESS_MATRIX.md`
- `docs/status/PARTIAL_IMPLEMENTATION_AUDIT.md`
- Communications docs
- Letters docs
- Tasks docs
- Notifications docs
- Steward AI docs
- Events docs
- Compassion docs
- Import docs
- Workspace layout docs

Docs must be honest.

Remove outdated screenshots and regenerate current screenshots after the UI refactor.

Create a final report:

`docs/status/FINAL_REFACTOR_COMPLETION_REPORT.md`

Include:

- phases completed
- files changed
- features finished
- features removed
- features moved to backlog
- tests run
- remaining known issues
- production-readiness status
- next recommended improvements

---

# Final Acceptance Criteria

This plan is complete only when:

1. No visible feature is fake or misleading.
2. Partial implementations are finished, removed, or moved out of user-facing navigation.
3. Major workspaces use compact breadcrumb + ribbon layouts.
4. The CRM has a consistent Microsoft 365 + HubSpot enterprise feel.
5. Communications guided flow works end to end.
6. Letters guided flow works end to end.
7. Tasks, notifications, and calendar are production-ready.
8. Steward AI has clear runtime states, safe action rules, and fallback behavior.
9. Data tools are safe and validated.
10. Navigation is deduplicated.
11. Legacy code is cleaned.
12. Error/loading/empty states are professional.
13. Permissions and data boundaries are preserved.
14. Tests pass or remaining issues are documented honestly.
15. Documentation reflects the actual working app.

Keep iterating until the CRM is no longer in a partial-completion state.
```
