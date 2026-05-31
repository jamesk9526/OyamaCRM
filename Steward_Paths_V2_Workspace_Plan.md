# Steward Paths V2 — One-Direction Path Library Workspace Plan

**Project:** OyamaCRM  
**Workspace:** Steward Paths V2  
**Core rule:** The Path Library is the main screen. Users browse or create paths first, then build, configure, validate, publish, enroll donors, and let the paths run automatically.

---

## 1. Product Goal

Steward Paths V2 should become its own dedicated automation workspace inside OyamaCRM. It should not feel like a tab inside the Donor CRM, and it should not reuse the old Steward Paths UI. It should follow the same improved workspace pattern as OyamaLetters and OyamaEmail: one focused tool, one clean sidebar, one progressive user flow, and one clear next step at every stage.

The system should begin with a **Path Library** as the main screen. The user should first see all available stewardship paths, including drafts, active paths, paused paths, errored paths, and archived paths. From there, the user can create a new path, open an existing path, duplicate a path, publish a draft, pause an active path, review errors, or view analytics.

The main user flow should be:

```txt
Path Library
→ Create or Select Path
→ Build Path on Canvas
→ Configure Triggers and Actions
→ Review and Validate
→ Publish Path
→ Enroll Donors
→ Run Automatically
→ Monitor Activity
→ Analyze Results
```

This must be a real functional system. **Every visible UI item must either work, be connected to real backend data, or be clearly disabled with an honest “not implemented yet” state.** No fake buttons, fake stats, fake paths, fake donors, fake automation activity, or fake analytics should remain in production UI.

---

## 2. Required Workspace Structure

Create a clean new Steward Paths V2 workspace.

Recommended routes:

```txt
/steward-paths
/steward-paths/library
/steward-paths/new
/steward-paths/[pathId]
/steward-paths/[pathId]/builder
/steward-paths/[pathId]/review
/steward-paths/[pathId]/publish
/steward-paths/[pathId]/enrollments
/steward-paths/[pathId]/activity
/steward-paths/[pathId]/analytics
/steward-paths/settings
```

The canonical main route should open the Path Library:

```txt
/steward-paths → /steward-paths/library
```

The workspace sidebar should be dedicated only to Steward Paths:

```txt
OYAMA STEWARD PATHS

Path Library
Builder
Enrollments
Activity
Analytics
Settings

Need help?
Steward Paths Guide

Back to CRM
```

Do not show the full Donor CRM sidebar inside this workspace. This should feel like a focused automation tool.

---

## 3. Main Screen: Path Library

The Path Library is the main screen and should be the first screen users see.

The Path Library should show all real saved paths. It should support:

```txt
Search
Status filters
Path category filters
Sort options
Create Path button
Import Path button
Template starter cards
Path list/table
Recent path activity
Path health summary
```

### Path Status Filters

Include status filters:

```txt
All
Draft
Needs Review
Published
Active
Paused
Errored
Archived
```

### Path Category Filters

Include category filters:

```txt
All Types
New Donor Welcome
Donation Follow-Up
Lapsed Donor Recovery
Event Follow-Up
Major Donor Stewardship
Monthly Donor Care
Volunteer Follow-Up
Campaign Follow-Up
Custom
```

### Path Card / Row Data

Each path card or row should show:

```txt
Path name
Short description
Path type/category
Status badge
Trigger type
Enrolled donors
Active donors
Completed donors
Errored enrollments
Last run time
Last updated time
Owner
Next recommended action
```

### Path Actions

Each path should have actions based on status:

```txt
Open
Edit Builder
Review & Validate
Publish
Enroll Donors
Pause
Resume
Duplicate
Archive
View Activity
View Analytics
```

Do not show an action if it cannot actually run. Disable it with a real reason.

Example:

```txt
Publish disabled: Path has validation blockers.
Enroll Donors disabled: Path must be published first.
Resume disabled: Path has unresolved errors.
```

---

## 4. Creating a New Path

The user should create a path from the Path Library.

New path options:

```txt
Start from Scratch
Use a Template
Import Path JSON
Duplicate Existing Path
```

The Create Path wizard should ask:

```txt
Path Name
Path Purpose
Path Category
Owner
Starting Trigger
Description
```

After creating the path, route the user directly into the Builder:

```txt
/steward-paths/[pathId]/builder
```

---

## 5. Path Builder Canvas

The builder should be a visual automation canvas, not a form-only editor.

Layout:

```txt
Left Panel: Add Node Library
Center: Canvas Builder
Right Panel: Node Settings
Top Bar: Path Name, Status, Save State, Version, Validate, Test, Publish
```

### Node Categories

The node library should be organized into clear categories.

#### Triggers

```txt
Start Trigger
Donor Segment
Gift Received
First-Time Donor
Lapsed Donor
Major Gift
Monthly Donor
Event Attended
Email Opened
Link Clicked
Manual Enrollment
Tag Added
Status Changed
```

#### Actions

```txt
Send Email
Generate Letter
Create Task
Update Donor Record
Add Tag
Remove Tag
Notify Staff
Assign Owner
Create Note
Create Call Reminder
Add to Campaign
Move to Segment
```

#### Flow Control

```txt
Wait / Delay
If / Then Branch
Condition Check
Split Path
Merge Path
Limit Frequency
Check Enrollment Status
```

#### Exit

```txt
Exit Goal
Stop Path
Remove Enrollment
Mark Complete
```

### Canvas Behavior

The canvas must support:

```txt
Drag-and-drop nodes
Connect nodes visually
Add node between existing nodes
Branch yes/no paths
Zoom in/out
Fit to screen
Mini map
Undo/redo
Delete selected node
Copy/paste node
Autosave
Manual save
Validation warnings
```

Every canvas action must save into real path JSON.

---

## 6. Node Settings Panel

When the user selects a node, the right panel should show that node’s settings.

Examples:

### Send Email Node

```txt
Email Template
Subject override, optional
From name
From email
Reply-to
Send timing
Track opens/clicks
Fallback if email is missing
Advanced settings
```

### Generate Letter Node

```txt
Letter template
Delivery method
Print queue setting
Mail queue setting
Merge field validation
Fallback if address is missing
```

### Create Task Node

```txt
Task title
Task description
Assign to
Due date rule
Priority
Related donor
Completion requirement
```

### Wait / Delay Node

```txt
Delay type
Duration
Specific date
Business days only
Skip weekends
Time zone
```

### If / Then Branch Node

```txt
Condition type
Field or event to check
Operator
Value
Yes branch
No branch
Fallback behavior
```

---

## 7. Automatic Path Running

After a path is published and donors are enrolled, it should run automatically.

Automatic execution requires:

```txt
Published path version
Enabled path status
Valid trigger
Eligible donor enrollment
Background worker or scheduled job
Event listener for trigger events
Activity logging
Retry/error handling
```

The backend should execute paths from real events, not fake UI state.

Examples:

```txt
When a first gift is recorded → enroll donor into New Donor Welcome Path
When a donor becomes lapsed → enroll donor into Lapsed Donor Recovery Path
When an event attendee is added → enroll donor into Event Follow-Up Path
When an email is opened → continue branch logic
When a wait period ends → run the next node
```

### Execution States

Each enrollment should have a state:

```txt
Waiting
Running
Paused
Completed
Errored
Exited
Cancelled
```

Each node execution should have a state:

```txt
Pending
Ready
Running
Completed
Skipped
Failed
Waiting
Cancelled
```

---

## 8. Review & Validate Step

Before publishing, the path must pass validation.

Validation should detect:

```txt
No start trigger
Disconnected nodes
Dead-end path
Missing email template
Missing letter template
Missing task owner
Invalid wait/delay
Invalid branch condition
Missing segment/filter
Missing permissions
Disabled email sending
Disabled letter generation
Missing merge fields
Missing fallback values
Circular loop
Duplicate action risk
Unreachable node
Exit goal missing
```

Validation output should be organized as:

```txt
Blockers — must fix before publishing
Warnings — should review before publishing
Recommendations — optional improvements
```

The user should not be able to publish with blockers.

---

## 9. Publishing

Publishing should create a versioned snapshot.

A published path should save:

```txt
Path ID
Version number
Published by
Published at
Path JSON snapshot
Trigger rules
Node settings
Validation result
Template references
Merge field references
Permission requirements
```

Editing a published path should create a new draft version. Existing running enrollments should continue using the version they started with unless the user intentionally migrates them.

Statuses:

```txt
Draft
Needs Review
Published
Active
Paused
Errored
Archived
```

---

## 10. Enrolling Donors

After publishing, the user can enroll donors.

Enrollment sources:

```txt
Saved Lists
Segments
Tags
Donor Status
Campaign Donors
Event Attendees
First-Time Donors
Lapsed Donors
Monthly Donors
Major Donors
Manual Selection
Imported CSV, later phase
```

Enrollment validation must show:

```txt
Total matched
Eligible
Already enrolled
Suppressed
Do not contact
Missing email
Missing address
Missing required data
Missing template requirements
Final enrollment count
```

Enrollment must be backend-validated immediately before final enrollment.

No fake donor counts. No fake donor rows.

---

## 11. Activity Workspace

Every path should have a clear Activity workspace.

Activity rows should show:

```txt
Timestamp
Donor
Path
Version
Node
Action
Result
Status
Message
Error details, if any
Source
```

Example events:

```txt
Donor enrolled
Trigger matched
Email queued
Email sent
Email opened
Letter generated
Task created
Wait started
Wait completed
Branch selected
Action skipped
Action completed
Error occurred
Staff notified
Goal completed
Donor exited
Path completed
```

The activity log must make it easy to understand what happened and why.

---

## 12. Analytics Workspace

Analytics should use real path execution data.

Metrics:

```txt
Total enrolled
Currently active
Completed
Paused
Errored
Exited
Average completion time
Completion rate
Email open rate
Email click rate
Tasks created
Tasks completed
Letters generated
Donations influenced
Lapsed donors re-engaged
Major donor follow-ups completed
```

If a metric cannot be tracked yet, show a real diagnostic:

```txt
Not tracked yet — requires donation attribution events.
Not tracked yet — requires OyamaEmail event connection.
Not tracked yet — requires OyamaLetters generation events.
```

Never fake analytics.

---

## 13. Functional UI Rule

This rule must be added to the Copilot command and followed strictly:

```txt
Every UI element must be functional, connected to real data, or clearly disabled with a reason.
```

Not allowed:

```txt
Fake path cards
Fake node stats
Fake donors
Fake enrollments
Fake path activity
Fake analytics
Fake successful publish
Fake automatic run
Fake task creation
Fake email sending
Fake letter generation
Fake validation pass
Buttons that look clickable but do nothing
```

Allowed:

```txt
Real data from API
Real empty states
Real loading states
Real error states
Disabled buttons with reasons
Development-only fixtures inside tests
Seeded starter templates stored in the database
```

---

## 14. Backend/API Plan

Create or refine a dedicated API boundary:

```txt
GET    /api/steward-paths
POST   /api/steward-paths
GET    /api/steward-paths/:id
PUT    /api/steward-paths/:id
DELETE /api/steward-paths/:id

POST   /api/steward-paths/:id/validate
POST   /api/steward-paths/:id/publish
POST   /api/steward-paths/:id/test-run
POST   /api/steward-paths/:id/pause
POST   /api/steward-paths/:id/resume
POST   /api/steward-paths/:id/archive

GET    /api/steward-paths/:id/enrollments
POST   /api/steward-paths/:id/enrollments/preview
POST   /api/steward-paths/:id/enrollments
POST   /api/steward-paths/:id/enrollments/:enrollmentId/pause
POST   /api/steward-paths/:id/enrollments/:enrollmentId/resume
POST   /api/steward-paths/:id/enrollments/:enrollmentId/cancel

GET    /api/steward-paths/:id/activity
GET    /api/steward-paths/:id/analytics
GET    /api/steward-paths/templates
GET    /api/steward-paths/settings
PUT    /api/steward-paths/settings
```

Suggested services:

```txt
server/src/services/steward-paths/path-service.ts
server/src/services/steward-paths/path-validation-service.ts
server/src/services/steward-paths/path-publish-service.ts
server/src/services/steward-paths/path-enrollment-service.ts
server/src/services/steward-paths/path-execution-service.ts
server/src/services/steward-paths/path-activity-service.ts
server/src/services/steward-paths/path-analytics-service.ts
server/src/services/steward-paths/path-trigger-service.ts
```

---

## 15. Legacy Cleanup

Copilot must audit old Steward Paths code and remove or redirect legacy UI.

Steps:

```txt
Search all Steward Paths routes
Search all Steward Paths components
Search all old automation/path UI
Search all fake/mock/demo path data
Search all navigation links to old UI
Create redirects to new workspace
Remove dead imports
Delete old UI components after replacement
Update docs
Update tests
```

Do not leave two competing ways to build paths.

One canonical path management flow only:

```txt
Path Library → Builder → Validate → Publish → Enroll → Run → Activity/Analytics
```

---

## 16. Testing Requirements

Add tests for:

```txt
Create path
Open Path Library
Search/filter paths
Create blank path
Use path template
Add nodes
Connect nodes
Configure node
Save path
Autosave path
Validate path
Block publish with blockers
Publish valid path
Create version snapshot
Preview enrollments
Enroll donors
Run trigger
Execute node
Wait/delay resumes
Branch logic works
Send email action calls real email integration
Generate letter action calls real letter integration
Create task action creates real task
Activity log records every step
Analytics show real data
Pause/resume path
Archive path
No fake UI source guard
```

Playwright tests should verify the full user flow:

```txt
Path Library
→ Create Path
→ Build Canvas
→ Validate
→ Publish
→ Enroll Donors
→ Activity
→ Analytics
```

---

## 17. Copilot Command

```md
Rebuild Steward Paths as a new V2 dedicated workspace with the Path Library as the main screen. Do not use the old Steward Paths UI, old component structure, old layout, or legacy design rules. This is a clean new tool workspace inside OyamaCRM, following the same one-direction workspace method used for OyamaLetters and OyamaEmail.

The canonical user flow must be:
Path Library → Create or Select Path → Build Path on Canvas → Configure Triggers and Actions → Review & Validate → Publish Path → Enroll Donors → Run Automatically → Monitor Activity → Analyze Results.

The main route `/steward-paths` should open the Path Library. The Path Library must show real saved paths with status filters for Draft, Needs Review, Published, Active, Paused, Errored, and Archived. Users should create paths from the library, select templates, duplicate existing paths, or import path JSON. Each path card/row must show real status, trigger type, enrolled donors, active donors, completed donors, error count, last run, owner, and next action.

Build a visual automation canvas with a left node library, center canvas, and right node settings panel. Node categories should include Triggers, Actions, Flow Control, and Exit. Support nodes such as Start Trigger, Donor Segment, Gift Received, First-Time Donor, Lapsed Donor, Event Attended, Send Email, Generate Letter, Create Task, Update Donor, Wait/Delay, If/Then Branch, Add Tag, Remove Tag, Exit Goal, and Stop Path. Nodes must save to real structured JSON and must be validated by the backend.

Published paths must run automatically from real triggers, scheduled jobs, or event listeners. Do not fake automation. A published path should enroll eligible donors, execute nodes, wait, branch, create tasks, send emails, generate letters, and log activity through real backend services. Every enrollment and node execution must have clear states such as Waiting, Running, Completed, Skipped, Failed, Paused, Exited, or Cancelled.

Every UI item must be functional, connected to real data, or clearly disabled with a reason. No fake path cards, fake stats, fake donors, fake enrollments, fake activity, fake analytics, fake validation pass, fake publish, fake automatic runs, or dead buttons. If a feature is not implemented, disable it and explain what is missing.

Add strict validation before publishing: missing trigger, disconnected nodes, dead ends, missing templates, invalid delays, invalid branches, missing task owner, missing merge fields, disabled integrations, circular loops, duplicate action risks, unreachable nodes, and missing exit goals. Publishing must create a versioned snapshot so running enrollments are not changed by later edits.

Add real donor enrollment from saved lists, segments, tags, donor status, campaign donors, event attendees, first-time donors, lapsed donors, monthly donors, major donors, and manual selection. Before enrollment, show real backend validation counts: total matched, eligible, already enrolled, suppressed, do-not-contact, missing email, missing address, missing required data, and final enrollment count.

Add Activity and Analytics workspaces. Activity must show real timeline events for every path and donor enrollment. Analytics must show real performance metrics from path execution, OyamaEmail, OyamaLetters, tasks, and donation events where available. If a metric is not trackable yet, show “Not tracked yet” with the missing dependency.

Clean up legacy Steward Paths code. Search the repo for old pages, components, mock data, routes, and links. Redirect old routes into the new workspace. Delete old UI only after verifying imports are gone. Update navigation so there is only one canonical Steward Paths flow.

Add unit, API, and Playwright tests covering the full flow from Path Library to Builder to Validate to Publish to Enroll to Automatic Run to Activity and Analytics. Add a source guard test that fails if production Steward Paths UI contains fake/mock/demo path data.
```

---

## 18. Acceptance Criteria

Steward Paths V2 is complete when:

```txt
/steward-paths opens the Path Library
Path Library shows real paths
Users can create a path from scratch
Users can use a path template
Users can build a path visually
Nodes save to real JSON
Validation blocks bad paths
Publish creates version snapshots
Donors can be enrolled from real sources
Published paths run automatically
Activity logs every real event
Analytics use real execution data
All UI items work or are clearly disabled
Old Steward Paths UI is removed or redirected
Tests cover the full workflow
No fake UI remains
```
