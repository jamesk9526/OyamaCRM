# OyamaCRM Office How-To Guide (Current Reality)

Last updated: 2026-05-12

## Purpose

This guide is for office staff who need practical daily steps in the current application state.
It focuses on what works today, what is partially ready, and what should be avoided until fixes are shipped.

## Quick Start

1. Open the app and sign in with your assigned staff account.
2. Use the module switcher in the top bar to choose DonorCRM, Compassion CRM, or Events CRM.
3. Stay inside one module for the full task whenever possible (for cleaner activity history).

## Daily Workflow: DonorCRM

### Add and work a constituent

1. Go to Constituents.
2. Search for the person first to avoid duplicates.
3. If not found, create the constituent profile.
4. Open the profile and confirm contact details.
5. Add notes for important context (stewardship, preferences, reminders).

### Record a donation and stewardship follow-up

1. Go to Donations.
2. Add the donation with the correct date, amount, and campaign/designation.
3. Open Tasks.
4. Create a follow-up task (thank-you call, receipt check, impact update).
5. Assign due date and owner.

### Campaign operations

1. Go to Campaigns.
2. Open campaign details from the campaign card.
3. Update campaign status, dates, and goals as needed.
4. Review recent donation activity under that campaign.

### Letters and printables workflow

1. Go to Letters & Printables.
2. Create or open a template in Templates.
3. Use Generate to produce a constituent-specific letter from a template.
4. In Generated, mark status as Printed or Mailed as fulfillment happens.
5. If an email version is needed, use Create Email Draft and continue in Communications.

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

## Important Incomplete or Risky Areas

Use this section as an operations safety list.

| Area | Current state | Office guidance |
|---|---|---|
| Events reports page | Partially Working | If reports fail to load, use event overview and dashboard metrics temporarily. |
| Event-scoped guests route | Broken in some datasets | If page crashes, return to workspace selector and use another tool until fix ships. |
| Grants create/update smoke paths | Partially Working | Prefer grant statuses from configured enum (for example IDEA, RESEARCH). Avoid unverified custom status labels. |
| Compassion full-name search | Partially Working | If full-name search misses records, search by last name or first name separately. |
| Compassion appointment matcher queue | Not Implemented | Public bookings sync to the staff calendar now, but manual triage is still required until matcher/review queue ships. |
| Letters PDF export + batch generation | Partially Working | Use single-letter generation and browser print/PDF until full export and batch pipeline ships. |
| Some module tabs and tools | Not Implemented | Follow in-app in-development warnings and do not rely on those tabs for live operations. |

## What To Use For Live Operations Right Now

1. Donor core workflows: constituents, donations, campaigns, tasks.
2. Donor communication workflows: letters template creation, single-letter generation, and email draft handoff.
3. Compassion core workflows: clients, cases, appointments, public slot-based scheduling.
4. Events core workflows: event registry, check-in, tables, guests with caution on known crash path.

## If You Hit an Error

1. Capture the page and action that failed.
2. Record exact time and user account.
3. Record whether the issue blocks data entry or only display/reporting.
4. Report to the CRM admin team with reproduction steps.
5. Continue in an alternate working path when available (for example fallback searches, dashboard-level reporting, alternate module page).

## Source Of Truth For Readiness

Use docs/status/production-readiness-checklist.md for current release readiness and status labels.
