# OyamaCRM + OyamaCRM-Compassion Agent Implementation Plan

## Project Names

- **Main CRM:** OyamaCRM
- **Client Services Workspace:** OyamaCRM-Compassion

## Core Product Description

OyamaCRM is the main nonprofit CRM workspace. It should manage donors, gifts, pledges, campaigns, receipts, newsletters, fundraising workflows, events, volunteers, board reporting, and donor relationship stewardship. It should feel clean, simple, and friendly like Bloomerang and Neon One, but be custom-built around the real workflows of a nonprofit pregnancy care center rather than a generic sales CRM.

OyamaCRM-Compassion is a new client-services CRM workspace built inside the larger OyamaCRM platform. It should feel like a separate CRM, not just a module or tab. This workspace will manage clients, client files, appointments, case notes, client services, referrals, material assistance, education support, forms, scheduling pages, and follow-up care. It should learn from eKYROS-style pregnancy center management while being easier to use, more modern, and more customizable.

The most important architecture principle is **separation without duplication**. Staff should log into one platform, then switch between OyamaCRM and OyamaCRM-Compassion using a clear workspace switcher. Donor data and client data must stay separated. Shared tools such as users, permissions, notifications, templates, calendars, audit logs, and AI support can live in the platform core, but client records need their own security, privacy rules, dashboards, reports, and workflows.

OyamaCRM-Compassion must also include a large-scale scheduling system. This should go far beyond a basic calendar. It needs internal staff scheduling, appointment types, rooms, service availability, public booking pages, website embeds, customizable scheduling forms, email/SMS reminders, cancellation and no-show tracking, and flexible scheduling pages that can be embedded into public websites.

---

# 1. Platform Structure

The platform should be organized as one system with two major workspaces.

```text
OyamaCRM Platform
│
├── OyamaCRM
│   ├── Donors
│   ├── Giving
│   ├── Campaigns
│   ├── Letters & Receipts
│   ├── Email / Newsletters
│   ├── Events
│   ├── Volunteers
│   └── Donor Reporting
│
├── OyamaCRM-Compassion
│   ├── Clients
│   ├── Client Files
│   ├── Appointments
│   ├── Intake Forms
│   ├── Case Notes
│   ├── Services Provided
│   ├── Material Assistance
│   ├── Education / Resources
│   ├── Scheduling Pages
│   └── Client Reporting
│
└── Shared Platform Core
    ├── Users
    ├── Roles & Permissions
    ├── Notifications
    ├── Calendar Engine
    ├── Template Engine
    ├── Audit Logs
    ├── AI Assistant
    └── Settings
```

## Workspace Switcher Requirement

Add a clear workspace switcher in the app shell.

Example:

```text
[ OyamaCRM: Donors ]      [ OyamaCRM-Compassion: Clients ]
```

The workspace switcher should:

- Make it obvious which workspace the user is currently inside.
- Prevent accidental crossover between donor records and client records.
- Preserve permission boundaries between the two workspaces.
- Use shared login but separate navigation, dashboards, and data models.

---

# 2. Product Rule: This Is Not a Sales CRM

The client side must not be designed like a sales pipeline.

Use this product rule:

> OyamaCRM-Compassion is not a sales CRM. It is a compassion-focused client care system.

The system should be designed around client care, follow-up, services, appointments, records, and outcomes.

---

# 3. Main Client Journey

OyamaCRM-Compassion should support the full client-care journey.

```text
First Contact
↓
Intake Form
↓
Appointment Scheduled
↓
Client Visit
↓
Pregnancy Test / Ultrasound / Consultation / Resource Help / Education
↓
Case Notes and Follow-Up
↓
Referrals and Material Assistance
↓
Ongoing Care History
↓
Reporting and Outcomes
```

---

# 4. OyamaCRM-Compassion Core Navigation

Suggested left navigation:

```text
Dashboard
Clients
Appointments
Schedule Pages
Forms
Files
Resources
Tasks
Reports
Settings
```

Each section should feel focused and uncluttered.

---

# 5. Client Management

## 5.1 Client List

Create a searchable, filterable client list.

Required features:

- Search by name, phone, email, client ID, tag, service type, or appointment status.
- Filter by active, inactive, new, overdue follow-up, appointment date, service type, assigned staff, and location.
- Quick actions:
  - Add note
  - Schedule appointment
  - Upload file
  - Create task
  - Add referral
  - View timeline

## 5.2 Client Profile

Each client should have a secure profile.

Required profile sections:

| Section | Purpose |
|---|---|
| Overview | Basic contact information and summary |
| Timeline | Chronological history of appointments, notes, files, tasks, and services |
| Appointments | Upcoming and past appointments |
| Services | Pregnancy tests, ultrasounds, consultations, education, material assistance, etc. |
| Notes | Staff notes, case notes, care summaries, and private notes |
| Forms | Intake, consent, assessment, and custom form submissions |
| Files | Uploaded documents, PDFs, images, scans, signed forms |
| Referrals | Housing, GED/HiSET, jobs, nutrition, diapers, clothing, counseling, etc. |
| Tasks | Follow-up tasks and staff assignments |
| Communication | Email/SMS/call history when available |
| Permissions / Audit | Who has accessed or changed the record |

## 5.3 Client Timeline

The timeline should be one of the main features.

Timeline events should include:

- Client created
- Form submitted
- Appointment requested
- Appointment confirmed
- Appointment checked in
- Appointment completed
- No-show
- Canceled
- Rescheduled
- Note added
- File uploaded
- Service provided
- Referral made
- Task created
- Task completed
- Follow-up sent
- Staff assignment changed

Timeline should support filtering by event type.

---

# 6. Client File System

Create a secure file cabinet for every client.

## 6.1 File Uploads

Supported file types should include:

- PDF
- Images
- Word documents
- Scanned forms
- Signed forms
- Other admin-approved document types

## 6.2 File Categories

Default categories:

```text
Intake
Consent
Medical / Ultrasound
Education
Referrals
Material Assistance
Case Notes
Staff Documents
Other
```

## 6.3 File Features

Required features:

- Upload files to client profile.
- Assign file category.
- Add staff-only notes to files.
- View file metadata.
- Replace file with version history.
- Download based on permission.
- Delete/archive based on permission.
- Log every file view, upload, download, replacement, and deletion.

## 6.4 Privacy Rule

Client files must not appear in:

- Donor search
- Donor reports
- Donor exports
- Donor timelines
- Fundraising dashboards

---

# 7. Scheduling System

The scheduling engine is a major feature and should be built as a reusable system.

## 7.1 Internal Scheduling

Required internal scheduling tools:

- Appointment types
- Staff availability
- Room availability
- Equipment availability if needed
- Ultrasound availability
- Material assistance appointments
- Walk-ins
- Blocked time
- Recurring schedules
- Holiday closures
- Multi-location scheduling
- Appointment status tracking
- Rescheduling
- Cancellations
- No-show tracking
- Check-in flow

## 7.2 Appointment Statuses

Use these default statuses:

```text
Requested
Confirmed
Checked In
In Progress
Completed
No-Show
Cancelled
Rescheduled
Needs Follow-Up
```

## 7.3 Appointment Type Model

Each appointment type should support:

- Name
- Description
- Duration
- Location
- Eligible staff
- Eligible rooms
- Required forms
- Public/private visibility
- Buffer time before appointment
- Buffer time after appointment
- Maximum bookings per day
- Cancellation rules
- Reschedule rules
- Reminder rules
- Follow-up workflow
- Internal notes

Examples:

```text
Pregnancy Test
Ultrasound Consultation
Options Consultation
Material Assistance
Parenting Class
Follow-Up Appointment
Resource Referral Appointment
```

## 7.4 Calendar Views

Required views:

- Day view
- Week view
- Month view
- Staff view
- Room view
- Location view
- Appointment type view
- My appointments
- Check-in view

---

# 8. Public Scheduling Pages

Create a scheduling page builder.

## 8.1 Scheduling Page Settings

Each public scheduling page should include:

| Setting | Example |
|---|---|
| Page Title | Schedule a Free Pregnancy Test |
| Page Description | Short explanation of the service |
| Appointment Type | Pregnancy test, consultation, material assistance, class |
| Location | Main center, satellite location, phone, online |
| Staff Rules | Any eligible staff or selected staff |
| Room Rules | Any eligible room or selected room |
| Intake Form | Attach a custom form |
| Confirmation Message | Custom message after booking |
| Reminder Rules | Email/SMS reminder settings |
| Visibility | Public, private link, internal only |
| Design | Logo, colors, button style, welcome text |

## 8.2 Public Page Requirements

Public scheduling pages must be:

- Mobile-friendly
- Fast-loading
- Accessible
- Customizable
- Secure
- Spam-resistant
- Easy to embed
- Easy to duplicate
- Easy to deactivate

## 8.3 Booking Flow

Recommended booking flow:

```text
Choose Service
↓
Choose Location
↓
Choose Date / Time
↓
Complete Intake Form
↓
Review Information
↓
Confirm Appointment
↓
Confirmation Page
↓
Email/SMS Confirmation
↓
Internal Staff Notification
```

---

# 9. Embeddable Website Schedules

The system must generate embed codes for websites.

## 9.1 Embed Types

Support these embed types:

```text
Inline Embed
Popup Button
Floating Button
Direct Link
Single Appointment Type Embed
Multiple Appointment Type Embed
Location-Specific Embed
```

## 9.2 Example Embed Code

```html
<script src="https://crm.example.com/embed/scheduler.js"></script>
<div data-oyama-scheduler="pregnancy-test"></div>
```

## 9.3 Embed Customization

Embeds should support:

- Custom colors
- Custom fonts
- Custom button text
- Custom logo
- Rounded or square design
- Full page mode
- Compact mode
- Mobile mode
- Language/text customization
- Pre-filled fields
- UTM tracking
- Conversion events
- Analytics hooks

## 9.4 Example Public Website Pages

The center should be able to create pages like:

```text
/schedule-pregnancy-test
/schedule-ultrasound
/schedule-consultation
/schedule-material-assistance
/schedule-parenting-class
```

Each page can have:

- Different text
- Different schedule
- Different intake form
- Different confirmation workflow
- Different follow-up tasks

---

# 10. Form Builder

OyamaCRM-Compassion needs a form builder connected to both scheduling and client records.

## 10.1 Form Types

Default form types:

```text
Client Intake Form
Appointment Request Form
Consent Form
Material Assistance Form
Education/Class Registration Form
Follow-Up Form
Staff Assessment Form
Referral Form
```

## 10.2 Field Types

Supported field types:

```text
Short Text
Long Text
Phone
Email
Date
Dropdown
Checkbox
Radio Buttons
Yes/No
Signature
File Upload
Private Staff-Only Field
Conditional Section
```

## 10.3 Conditional Logic

Forms should support conditional logic.

Example:

```text
If client selects "I need housing help"
→ Show housing-related questions
→ Create a housing referral task
→ Tag client as "Housing Resource Needed"
```

## 10.4 Form Submission Rules

Form submissions should be able to:

- Create a new client.
- Match an existing client.
- Attach to an appointment.
- Attach to a client profile.
- Trigger a staff notification.
- Trigger a task.
- Trigger a referral workflow.
- Trigger a confirmation email/SMS.

---

# 11. Resource and Referral Management

Build a resource directory for client support.

## 11.1 Resource Categories

Default categories:

```text
Housing
GED / HiSET
Jobs
Nutrition
Diapers
Clothing
Transportation
Food Assistance
Church Connections
Parenting Classes
Medical Referrals
Counseling Referrals
Community Aid
Other
```

## 11.2 Resource Record Fields

Each resource should include:

- Name
- Category
- Contact person
- Phone
- Email
- Website
- Address
- Eligibility rules
- Notes
- Internal quality notes
- Last verified date
- Active/inactive status

## 11.3 Client Referral Flow

Staff should be able to attach a resource to a client.

Example:

```text
Client → Referral → Housing Resource → Follow up in 7 days
```

Referral records should include:

- Client
- Resource
- Date referred
- Staff member
- Reason
- Status
- Follow-up date
- Outcome notes

---

# 12. Task and Follow-Up Engine

Each client record should support care tasks.

## 12.1 Task Examples

```text
Call client tomorrow
Send appointment reminder
Prepare diaper bag
Print education material
Follow up after ultrasound
Check whether GED contact responded
Schedule parenting class
Ask director to review case
```

## 12.2 Task Views

Required views:

```text
My Tasks
Today
Overdue
By Client
By Staff Member
By Appointment
By Service Type
Needs Director Review
```

## 12.3 Task Fields

Each task should include:

- Title
- Description
- Client
- Assigned staff
- Due date
- Priority
- Status
- Related appointment
- Related referral
- Related file
- Completion notes

---

# 13. Roles and Permissions

Permissions must be strict, simple, and workspace-aware.

## 13.1 Suggested Roles

| Role | Access |
|---|---|
| Super Admin | Everything |
| Director | All client and donor data |
| Client Services Manager | Full OyamaCRM-Compassion access |
| Nurse / Medical Staff | Medical appointments and sensitive care sections |
| Advocate | Client profile, notes, services, tasks |
| Reception / Scheduler | Scheduling, check-in, limited client profile |
| Volunteer | Limited task or material-assistance access |
| Donor Staff | OyamaCRM donor side only |
| Board View | High-level reports only, no private client records |

## 13.2 Critical Permission Rule

> A user should not automatically have access to client records just because they have access to donor records.

## 13.3 Permission Types

Support permission checks for:

- View client
- Create client
- Edit client
- Delete/archive client
- View sensitive notes
- Add notes
- Edit notes
- Delete notes
- View files
- Upload files
- Download files
- Delete/archive files
- View appointments
- Create appointments
- Edit appointments
- Cancel appointments
- View reports
- Export reports
- Manage forms
- Manage scheduling pages
- Manage resources
- Manage settings

---

# 14. Privacy, Security, and Audit Controls

Because client records are sensitive, the system should include strong security controls.

## 14.1 Required Security Features

- Role-based access control
- Workspace-level permissions
- Field-level permissions where needed
- File-level permissions
- Audit logs
- Login history
- Record view history
- Export controls
- Print controls
- Two-factor authentication support
- Session timeout
- Admin alerts for suspicious activity

## 14.2 Audit Events

Log these actions:

```text
Viewed client profile
Created client profile
Edited client profile
Archived/deleted client profile
Opened file
Uploaded file
Downloaded file
Replaced file
Deleted file
Added note
Edited note
Deleted note
Created appointment
Edited appointment
Canceled appointment
Marked no-show
Exported report
Changed permissions
Changed scheduling page
Changed form
```

## 14.3 Audit Log Fields

Each audit event should store:

- User ID
- Workspace
- Action type
- Entity type
- Entity ID
- Timestamp
- IP address if available
- Browser/user agent if available
- Before/after data when appropriate
- Reason/comment when appropriate

---

# 15. AI Assistant for OyamaCRM-Compassion

The AI assistant should be helpful but carefully limited.

## 15.1 AI Features

Possible AI tools:

```text
Summarize visit notes
Draft follow-up messages
Suggest next care tasks
Prepare resource referral summaries
Identify incomplete intake forms
Help staff find resources
Generate internal reports
Summarize appointment trends
Create board-safe summaries
```

## 15.2 AI Safety Rules

Use these rules:

- AI should not automatically save generated content without staff review.
- AI-generated notes must be clearly marked until approved.
- Staff should approve AI-drafted follow-up messages before sending.
- Client data should not be used to train outside models.
- Prefer local AI where possible for sensitive internal work.
- Keep audit records when AI accesses or summarizes client data.
- AI should never override staff judgment.

---

# 16. Reporting Dashboard

OyamaCRM-Compassion needs a separate dashboard from OyamaCRM.

## 16.1 Dashboard Cards

Default cards:

```text
Appointments Today
Upcoming Appointments
No-Shows This Week
New Clients This Month
Pregnancy Tests This Month
Ultrasound Appointments This Month
Material Assistance Visits
Resource Referrals Made
Follow-Ups Overdue
Classes Attended
Client Needs by Category
```

## 16.2 Reports

Default reports:

```text
Client Visit Report
Service Report
Appointment Report
Referral Report
Material Assistance Report
Staff Workload Report
Outcome Report
No-Show Report
Resource Needs Report
Monthly Board Summary
```

## 16.3 Board Reporting Rule

Board reports should show totals, trends, and outcomes without exposing private client records unless explicitly authorized.

---

# 17. UI and Theme Direction

The UI should be clean, light, and easy to understand.

## 17.1 OyamaCRM Main Theme

```text
Light theme
Soft green accents
Left sidebar
Top search bar
Large dashboard cards
Simple tables
Clear filters
Minimal clutter
Friendly nonprofit tone
```

## 17.2 OyamaCRM-Compassion Theme

OyamaCRM-Compassion should feel related to OyamaCRM but warmer and more care-focused.

Suggested visual identity:

```text
OyamaCRM = donor green / nonprofit admin
OyamaCRM-Compassion = soft teal, cream, and warm neutral accents
```

## 17.3 UI Principles

- Keep screens calm and simple.
- Avoid sales CRM language.
- Make actions obvious.
- Prioritize client privacy.
- Use human-readable labels.
- Make search fast.
- Make scheduling easy.
- Make follow-up tasks visible.
- Use dashboard cards for quick awareness.
- Keep reports board-friendly.

---

# 18. MySQL Database Direction

The system should use MySQL.

## 18.1 Suggested Table Groups

```text
core_users
core_roles
core_permissions
core_workspaces
core_audit_logs

donor_constituents
donor_gifts
donor_campaigns
donor_letters
donor_email_campaigns

compassion_clients
compassion_client_contacts
compassion_client_files
compassion_appointments
compassion_services
compassion_notes
compassion_forms
compassion_form_submissions
compassion_resources
compassion_referrals
compassion_tasks
compassion_schedule_pages
compassion_availability_rules
compassion_locations
compassion_rooms
```

## 18.2 Database Naming Rule

Use clear prefixes:

- `core_` for shared platform tables.
- `donor_` for OyamaCRM donor-side tables.
- `compassion_` for OyamaCRM-Compassion client-side tables.

This keeps separation obvious and prevents accidental mixing of donor and client records.

---

# 19. Recommended MVP Build Order

## Phase 1: Workspace Foundation

Build:

```text
Workspace switcher
OyamaCRM shell
OyamaCRM-Compassion shell
Role-based permissions
Separate navigation
Separate dashboards
Audit log foundation
```

Acceptance criteria:

- User can switch between workspaces.
- Client workspace has separate navigation.
- Donor data does not show in client workspace.
- Client data does not show in donor workspace.
- Permissions are checked by workspace.

---

## Phase 2: Client Records

Build:

```text
Client list
Client profile
Client timeline
Notes
Services
Basic tags
Private comments
Client search
```

Acceptance criteria:

- Staff can create and edit a client profile.
- Staff can add notes and services.
- Staff can view a client timeline.
- Staff can search and filter clients.
- Client profile access is permission-protected.

---

## Phase 3: Scheduling Core

Build:

```text
Appointment types
Staff availability
Internal calendar
Appointment booking
Appointment statuses
Check-in flow
Rescheduling
No-show tracking
```

Acceptance criteria:

- Staff can create appointment types.
- Staff can schedule a client appointment.
- Staff can manage appointment statuses.
- Staff can mark no-shows.
- Staff can view day/week/month schedule.

---

## Phase 4: Public Scheduling Pages

Build:

```text
Public booking page builder
Custom intake form attachment
Confirmation page
Email reminders
Embed code generator
Website embed widget
```

Acceptance criteria:

- Staff can create a scheduling page.
- Public user can book an appointment.
- Appointment appears in internal calendar.
- Confirmation message is sent.
- Embed code works on an external website.

---

## Phase 5: Client Files and Forms

Build:

```text
File uploads
File categories
Form builder
Form submissions
Signed forms
Client file cabinet
Permission controls
```

Acceptance criteria:

- Staff can upload files to a client profile.
- Files are categorized.
- File views and downloads are logged.
- Staff can create a custom form.
- Form submissions attach to client records.

---

## Phase 6: Resources and Referrals

Build:

```text
Resource directory
Resource categories
Attach referral to client
Follow-up tasks
Resource outcome tracking
```

Acceptance criteria:

- Staff can create resources.
- Staff can attach a resource referral to a client.
- Referral can create a follow-up task.
- Referral outcome can be tracked.

---

## Phase 7: Reporting and AI

Build:

```text
Client dashboard
Appointment reports
Service reports
Board summaries
AI note summarizer
AI follow-up draft helper
AI resource helper
```

Acceptance criteria:

- Staff can view client-side dashboard.
- Reports show totals and trends.
- Board reports avoid private details by default.
- AI outputs require review before saving or sending.

---

# 20. Developer Notes for Agents

## 20.1 Implementation Priorities

Agents should prioritize:

1. Data separation between donor records and client records.
2. Workspace-specific permissions.
3. A clean and simple client profile.
4. Scheduling as a first-class system.
5. Secure client files.
6. Embeddable public scheduling pages.
7. Audit logging from the beginning.
8. Minimal but expandable UI.
9. MySQL schema clarity.
10. Maintainability and readable code.

## 20.2 Code Quality Requirements

Agents should:

- Use clear naming.
- Keep components modular.
- Comment complex logic.
- Add TODO comments only where work is intentionally incomplete.
- Avoid hard-coding center-specific text where settings should control it.
- Keep scheduling logic separate from UI components.
- Keep permission checks server-side, not just client-side.
- Build with future multi-location support in mind.
- Avoid mixing donor and client models.
- Use reusable layout components where appropriate.

## 20.3 Suggested Technical Modules

```text
/workspaces
/auth
/permissions
/audit
/compassion/clients
/compassion/files
/compassion/appointments
/compassion/forms
/compassion/resources
/compassion/referrals
/compassion/tasks
/compassion/reports
/compassion/schedule-pages
/embeds/scheduler
```

## 20.4 Scheduling Engine Rules

Scheduling should be built with a service layer.

Do not scatter scheduling logic throughout UI components.

Suggested services:

```text
AvailabilityService
AppointmentService
SchedulePageService
BookingService
ReminderService
EmbedService
```

## 20.5 Permission Engine Rules

Permission checks should happen:

- On the server/API layer.
- Before returning client data.
- Before returning client files.
- Before exporting reports.
- Before viewing sensitive notes.
- Before changing appointments.
- Before managing scheduling pages.

Do not rely only on frontend hiding.

---

# 21. Future Nice-to-Haves

These should not block the MVP, but should be planned for.

```text
SMS reminders
Two-way texting
Automated follow-up workflows
Client portal
Digital signatures
Advanced form conditional logic
Drag-and-drop schedule builder
Waitlist management
Staff workload balancing
Multi-center support
Volunteer scheduling
Inventory tracking for diapers/clothing/material assistance
AI-generated board reports
AI resource matching
Smart duplicate detection
Bulk import/export
QuickBooks or accounting integrations
Email marketing integrations
Website analytics integration
```

---

# 22. Final Product Vision

The guiding product vision:

```text
OyamaCRM helps the center care for donors.
OyamaCRM-Compassion helps the center care for clients.

One platform.
Two separate workspaces.
Shared users and tools.
Separated data.
Simple design.
Powerful scheduling.
Secure client files.
Built for ministry, not sales.
```

Final instruction to development agents:

> Build OyamaCRM-Compassion as a full client-services CRM inside OyamaCRM, but keep it separated like a dedicated workspace with its own records, files, scheduling, permissions, dashboards, and reports. It should feel as easy as Bloomerang or Neon One, understand pregnancy-center client care like eKYROS, and include a powerful embeddable scheduling system that can create custom public booking pages for the website.
