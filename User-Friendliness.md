```md id="u3m8na"
# OyamaCRM User-Friendliness and Staff Experience Improvement Plan

Autopilot is enabled. Work through this plan until OyamaCRM feels clear, approachable, and usable for real nonprofit staff, not just developers or power users.

The goal is to make the CRM easier to understand, easier to navigate, harder to misuse, and more helpful during daily work.

This pass focuses on user experience, staff confidence, onboarding, clarity, guidance, and reducing confusion.

---

## Core Goal

Every page should answer these questions immediately:

1. Where am I?
2. What is this page for?
3. What should I do next?
4. What information matters most?
5. What actions are safe to take?
6. What happens if I click this button?
7. How do I recover if I make a mistake?

If a page does not answer those questions clearly, refactor it.

---

# Phase 1 — Staff Workflow Audit

Audit the CRM from the perspective of a real staff member.

Test the app as these users:

- Executive Director
- Development Director
- Office Admin
- Donor Relations Staff
- Event Coordinator
- Client Services Staff
- Volunteer
- Board Member / read-only reviewer

For each role, document:

- What they need to do daily
- What they need to do weekly
- What they should not access
- Which pages are confusing
- Which pages have too many choices
- Which workflows need guided help
- Which features should be hidden from that role

Create or update:

`docs/status/USER_FRIENDLINESS_AUDIT.md`

---

# Phase 2 — Simplify the Dashboard Experience

The main dashboard should not feel like a technical control panel.

It should show:

- Today’s most important work
- Urgent tasks
- Recent donations
- Donor follow-ups
- Campaign progress
- Notifications needing attention
- Steward suggestions
- Quick links to common actions

Recommended dashboard sections:

- Today’s Work
- Needs Attention
- Recent Giving
- Follow-Up Queue
- Campaign Snapshot
- Steward Recommendations
- Quick Actions

Avoid overwhelming users with too many charts or fake analytics.

Every dashboard widget should have:

- plain-language title
- one clear purpose
- real data
- click-through action
- empty state
- explanation tooltip

---

# Phase 3 — Create a “Start Here” Experience

Add a clear starting point for users who do not know where to go.

Create a workspace or dashboard section called:

`Start Here`

It should include guided action cards:

- Add a donor
- Record a donation
- Send a thank-you
- Create a task
- View today’s follow-ups
- Create a campaign
- Generate letters
- Check notifications
- Ask Steward
- Import data
- Review reports

Each action card should explain what it does in one sentence.

Example:

“Send a Thank-You — Create an email or printable letter for a donor gift.”

This should be friendly and practical, not technical.

---

# Phase 4 — Add Helpful Empty States

Empty pages should teach the user what to do next.

Do not show blank tables.

Every empty state should include:

- short title
- plain-language explanation
- primary action
- secondary help link if needed
- optional example

Example:

“No tasks due today  
You’re caught up for today. You can create a new task, view upcoming work, or check overdue follow-ups.”

Add strong empty states for:

- donors
- donations
- campaigns
- communications
- letters
- tasks
- calendar
- notifications
- reports
- imports
- Steward Paths
- Compassion appointments
- Events

---

# Phase 5 — Add Contextual Help Without Clutter

Users should not need documentation open in another window.

Add small contextual help patterns:

- info icons
- “What is this?” links
- short helper text
- expandable help panels
- inline examples
- setup checklists
- Steward help prompts

Do not overload the UI with paragraphs.

Use simple helper text like:

- “A segment is a saved group of donors.”
- “A task is planned work. An activity is something that already happened.”
- “Review must be completed before scheduling a campaign.”
- “Drag a task to another date to reschedule it.”

Create a shared component:

`WorkspaceHelpTip`

Use it consistently.

---

# Phase 6 — Improve Forms for Real Staff

Forms should be clear, forgiving, and hard to misuse.

Audit all forms:

- donor creation
- donation entry
- task creation
- campaign creation
- email builder
- letter generation
- event creation
- appointment scheduling
- import mapping
- settings

Every form should have:

- clear labels
- required markers
- helpful placeholders
- inline validation
- save/cancel buttons in predictable places
- confirmation for risky actions
- success message after save
- useful error messages
- no technical error text

Use plain language.

Bad:

“Invalid payload.”

Good:

“Please choose a donor before saving this donation.”

---

# Phase 7 — Add User-Friendly Confirmation Flows

Important actions should be safe and clear.

Add confirmation screens or dialogs for:

- sending emails
- scheduling campaigns
- deleting records
- merging records
- importing data
- exporting donor lists
- marking donations acknowledged
- completing bulk actions
- archiving workflows
- activating Steward Paths
- changing permissions
- running AI-assisted actions

Each confirmation should show:

- what will happen
- how many records are affected
- whether it can be undone
- who will be notified
- final confirm button

Avoid vague buttons like:

- Confirm
- Submit
- OK

Use specific buttons like:

- Send Campaign
- Archive Task
- Import 214 Donors
- Mark 18 Letters as Mailed

---

# Phase 8 — Improve Search and Filtering

Users should be able to find things quickly.

Add or improve global and workspace search.

Search should work for:

- donors
- households
- donations
- campaigns
- tasks
- communications
- letters
- events
- appointments
- reports
- settings

Every major list should support:

- search
- filter
- sort
- saved views where useful
- clear filters button
- result count
- empty filtered state

Examples:

- “Showing 14 overdue tasks”
- “No donors match these filters”
- “Clear filters”

Do not make users dig through long lists manually.

---

# Phase 9 — Improve Record Pages

Donor/client/event records should feel like complete object pages.

Every record page should have:

- breadcrumb
- compact record header
- ribbon actions
- key details summary
- activity timeline
- related tasks
- notes
- communication history
- linked records
- safe edit flow
- Steward summary when available

For donor records, show:

- contact info
- giving summary
- last gift
- lifetime giving
- donor status
- communication preferences
- recent activity
- open tasks
- suggested next action

Make the most important facts visible without scrolling too far.

---

# Phase 10 — Improve Language Across the CRM

Audit all labels, buttons, helper text, empty states, and errors.

Replace technical language with staff-friendly language.

Examples:

- “Constituent” may be correct, but “Donor” may be clearer in donor-focused areas.
- “Mutation failed” should become “The update could not be saved.”
- “Entity” should become “record.”
- “Payload” should become “information.”
- “Execute” should become “Run” or “Start.”
- “Artifact” should become “draft,” “report,” or “file.”

Create or update:

`docs/ui/CRM_LANGUAGE_GUIDE.md`

Include preferred terms for:

- donor
- client
- task
- activity
- communication
- campaign
- letter
- notification
- Steward
- workflow
- report
- import
- export

---

# Phase 11 — Add Setup Checklists

New users need guidance.

Create setup checklists for:

## Organization Setup

- Add organization details
- Add logo and branding
- Configure email settings
- Add users
- Set roles and permissions
- Configure notifications
- Configure Steward AI
- Import donor data

## Donor CRM Setup

- Import donors
- Review duplicate records
- Set campaign categories
- Create thank-you templates
- Create task templates
- Configure communication preferences

## Communications Setup

- Set sender info
- Add email branding
- Create templates
- Test sending
- Configure unsubscribe/suppression rules

## Steward AI Setup

- Choose local or remote AI
- Test connection
- Confirm model
- Enable fallback mode
- Review safety settings

Each checklist item should deep-link to the correct settings page.

---

# Phase 12 — Add “Recently Viewed” and “Favorites”

Make the CRM easier to navigate during real daily work.

Add:

- recently viewed donors
- recently viewed campaigns
- recently viewed tasks
- recently viewed reports
- favorite records
- favorite reports
- favorite workspaces

These can appear in:

- dashboard
- global search
- command menu
- sidebar quick section

This makes the app feel more enterprise and more personal.

---

# Phase 13 — Add a Global Command Menu

Add a keyboard-friendly command menu similar to Microsoft 365, HubSpot, or modern SaaS tools.

Shortcut:

`Ctrl + K`

The command menu should allow users to:

- search donors
- open pages
- create a task
- add a donation
- open reports
- open settings
- ask Steward
- start a campaign
- generate letters
- view today’s work
- open calendar

This improves speed for power users without making the interface harder for normal staff.

---

# Phase 14 — Improve Notifications for Humans

Notifications should be useful, not noisy.

Group notifications by:

- Tasks
- Donors
- Campaigns
- Letters
- Events
- Appointments
- System
- Steward

Add notification controls:

- mark read
- dismiss
- snooze
- open related record
- notification preferences

Notification wording should be specific.

Bad:

“Task updated.”

Good:

“Call Sarah Miller is overdue by 2 days.”

Bad:

“Campaign alert.”

Good:

“Spring Appeal is scheduled to send tomorrow at 9:00 AM.”

---

# Phase 15 — Add Gentle Steward Guidance

Steward should help users without taking over the CRM.

Add optional Steward guidance in key places:

- donor records
- campaign review
- task planning
- communications review
- reports
- imports
- dashboard

Examples:

- “This donor has not been contacted since their last gift.”
- “Three donors in this segment are missing email addresses.”
- “This campaign has not been test-sent yet.”
- “You have 8 overdue follow-ups.”
- “This import has 14 likely duplicate records.”

Steward suggestions should always show:

- evidence
- confidence level
- next action
- review reminder

Do not make Steward feel magical or uncontrolled.

---

# Phase 16 — Add Better Undo, Archive, and Recovery Patterns

Users need confidence that mistakes can be corrected.

Where possible, prefer archive over permanent delete.

Add recovery patterns:

- undo toast after simple actions
- archive instead of delete
- restore archived records where appropriate
- confirmation before destructive actions
- activity log for major changes
- audit trail for sensitive changes

Examples:

- “Task archived. Undo”
- “Campaign draft deleted. Restore”
- “Donor record merged. View merge details”

---

# Phase 17 — Improve Mobile and Tablet Usability

Audit responsive behavior.

The CRM does not need to be perfect on a phone for every advanced workflow, but it should be usable for common actions.

Mobile/tablet priority:

- dashboard
- tasks
- calendar
- donor lookup
- donor record summary
- notes
- notifications
- simple follow-up completion
- event check-in
- appointment schedule

Avoid layouts that break on smaller screens.

Ribbons should collapse into grouped menus on mobile.

---

# Phase 18 — Add User Preference Settings

Let users personalize the CRM slightly.

Add preferences for:

- default landing page
- default task view
- default calendar view
- notification preferences
- compact vs comfortable density
- favorite workspaces
- Steward panel behavior
- recently viewed visibility
- table page size

Store preferences per user.

This makes the app feel more mature and enterprise-ready.

---

# Phase 19 — Improve Training and Help Docs

Create user-facing help docs, not just developer docs.

Create:

`docs/howto/USER_GUIDE.md`

Include:

- Getting started
- Dashboard overview
- Adding donors
- Recording gifts
- Creating tasks
- Using the calendar
- Sending communications
- Generating letters
- Using Steward
- Managing notifications
- Running reports
- Importing data
- Troubleshooting

Keep the tone simple and staff-friendly.

Also add short “How this page works” sections inside the app where useful.

---

# Phase 20 — Final User-Friendliness Acceptance Checklist

The pass is complete only when:

- New users know where to start.
- Common actions are easy to find.
- Every major page has clear next steps.
- Empty states are helpful.
- Errors are understandable.
- Forms are easier to complete.
- Search and filters work consistently.
- Notifications are useful and not noisy.
- Steward guidance is helpful and safe.
- Records show the most important information first.
- Risky actions have clear confirmations.
- Users can recover from common mistakes.
- Mobile/tablet layouts do not break core workflows.
- Documentation helps real staff, not just developers.
- The CRM feels polished, calm, and trustworthy.

Do not mark this complete until the CRM feels usable by a normal nonprofit staff member without developer guidance.
```
