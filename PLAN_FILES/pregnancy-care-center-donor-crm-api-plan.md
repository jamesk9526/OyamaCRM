# Pregnancy Care Center Donor CRM  
## Bloomerang-Inspired Feature Plan and Improved API Architecture

Prepared as a development planning document for a custom donor-focused CRM inspired by the clean, practical workflow of Bloomerang, but tailored specifically for The Pregnancy Care Center.

---

## 1. Product Vision

The goal is to build a custom donor CRM that helps the center manage relationships, gifts, follow-up, campaigns, communications, events, and stewardship without becoming a generic sales CRM.

This system should feel like a daily ministry operations dashboard. It should answer:

- Who gave?
- Who needs thanked?
- Who needs followed up with?
- Which donors are becoming more engaged?
- Which donors have lapsed?
- Which campaigns are working?
- What should staff do next today?
- What letters, emails, receipts, and reports need to be generated?

The CRM should be built around **stewardship**, not sales.

---

## 2. Visual Direction Based on the Bloomerang Dashboard

The reference dashboard should guide the first version of the UI.

### Visual Style

- Clean light interface
- White and soft gray background
- Green as the primary accent color
- Left sidebar navigation
- Top search bar for constituents
- Prominent “New Constituent” button
- Card-based dashboard widgets
- Minimal clutter
- Clear task list
- Large fundraising and retention numbers
- Calm, professional nonprofit feel

### Main Navigation

Recommended first navigation structure:

1. Home
2. Constituents
3. Groups
4. Donations
5. Campaigns
6. Communications
7. Tasks
8. Events
9. Reports
10. Data Tools
11. Settings

### Dashboard Cards

The home dashboard should include:

- Revenue Progress
- Donor Retention
- Tasks Due Soon
- Gifts This Week
- New Donors
- Lapsed Donors
- Monthly Giving Progress
- Campaign Performance
- Recent Donations
- Receipts Needing Print
- Follow-ups Due
- Event Registration Snapshot

The dashboard should not only show information. It should push staff toward the next right action.

---

## 3. Core Modules

## 3.1 Constituents

A constituent can be an individual, household, church, business, foundation, or other organization.

### Constituent Types

- Individual
- Household
- Church
- Business
- Foundation
- Civic group
- Anonymous donor
- Unknown/imported record

### Constituent Profile Should Include

- Name
- Type
- Primary email
- Secondary email
- Phone
- Mobile phone
- Mailing address
- Household relationships
- Organization relationships
- Tags
- Groups
- Communication preferences
- Giving summary
- Donor status
- Engagement score
- Assigned staff member
- Notes
- Timeline
- Tasks
- Documents
- Receipts
- Event attendance
- Volunteer activity, if applicable

### Timeline Events

The donor profile should show a chronological timeline of:

- Gifts
- Pledges
- Receipts
- Emails sent
- Letters generated
- Calls
- Meetings
- Notes
- Event attendance
- Volunteer activity
- Tasks completed
- Tags added or removed
- Data imports
- Staff changes

The timeline is one of the most important features because it shows the relationship history at a glance.

---

## 3.2 Donations

The donation module should be simple, fast, and accurate.

### Gift Types

- Check
- Cash
- Credit card
- ACH
- Online donation
- In-kind gift
- Stock or asset gift, optional future feature
- Pledge payment
- Event payment
- Sponsorship payment

### Donation Fields

- Donor ID
- Amount
- Gift date
- Received date
- Payment method
- Check number
- Transaction ID
- Campaign
- Fund
- Appeal
- Source
- Soft credit
- Tribute or memorial gift
- Restricted/unrestricted status
- Tax-deductible amount
- Receipt status
- Thank-you status
- Notes
- Created by
- Created at
- Updated at

### Immediate Workflow After Gift Entry

When a gift is entered, the system should automatically:

1. Save the gift.
2. Update the donor’s giving history.
3. Add a timeline event.
4. Generate a receipt record.
5. Determine whether to send email or create a printable letter.
6. Create or schedule a thank-you task if staff action is needed.
7. Trigger the donor TouchStone rules.
8. Update dashboard metrics.
9. Recalculate donor status and giving summaries.

---

## 3.3 Funds, Campaigns, and Appeals

These should be separate concepts.

### Fund

Where the money is designated.

Examples:

- General Fund
- Ultrasound Services
- Client Services
- Building Fund
- Gala Fund
- Sanctity of Human Life
- Baby Bottle Campaign
- Restricted Client Assistance

### Campaign

A larger fundraising effort.

Examples:

- 2026 Love at First Beat Gala
- 2026 Sanctity of Human Life
- 2026 Giving Tuesday
- Monthly Partner Drive
- Year-End Giving Campaign

### Appeal

The specific message, channel, or ask.

Examples:

- January SOHL Email
- Facebook Ad
- Church Presentation
- Direct Mail Letter
- Gala Invitation
- Board Member Ask
- Website Donation Form

This separation allows better reporting later.

---

## 3.4 Tasks

Tasks should be built into the heart of the system.

### Task Types

- Thank-you call
- Print receipt
- Mail thank-you letter
- Send follow-up email
- Invite to monthly giving
- Schedule meeting
- Gala table follow-up
- Sponsorship follow-up
- Pledge reminder
- Lapsed donor follow-up
- Board report preparation
- Data cleanup
- Prayer/support note

### Task Fields

- Title
- Description
- Due date
- Status
- Priority
- Task type
- Assigned user
- Related constituent
- Related donation
- Related campaign
- Related event
- Completed at
- Completion notes

### Task Views

- My Tasks
- All Tasks
- Due Soon
- Overdue
- Completed
- Tasks by Donor
- Tasks by Campaign
- Tasks by Event
- Tasks Assigned to Staff

The dashboard should show the most urgent tasks and allow quick completion.

---

## 3.5 Communications

The communications module should support both email and printable letters.

### Communication Types

- Email
- Printed letter
- SMS/text message
- Phone call
- Internal note
- Newsletter
- Event invitation
- Receipt
- Thank-you
- Monthly donor invitation

### Email Tools

- Email templates
- Donor merge fields
- Segmented sends
- Preview before send
- Test email
- Scheduled send
- Open/click tracking if available
- Automatic logging to timeline
- Manual approval before bulk send

### Letter Tools

Many donors do not use email, so printed letters are essential.

The system should include:

- Printable thank-you letters
- Printable receipts
- Mail merge fields
- Batch PDF generation
- Envelope export
- Labels export
- Print queue
- Mark as printed
- Mark as mailed

### Merge Fields

Recommended merge fields:

- Donor first name
- Donor full name
- Household name
- Gift amount
- Gift date
- Fund name
- Campaign name
- Appeal name
- Receipt number
- Year-to-date giving
- Last gift amount
- Staff signature
- Center name
- Center address
- Donation link

---

## 3.6 Donor TouchStones and Automation

Automation should be rules-based and easy to understand.

### First Critical Workflow

The center’s most important early workflow:

1. A check or gift is entered.
2. An immediate thank-you email or printable letter is created.
3. Seven days later, the donor receives more information about the center.
4. The donor is invited to become a monthly partner.
5. Ongoing weekly or biweekly email communication continues, depending on list membership and preferences.

### TouchStone Builder V1

The first version does not need a complex visual automation builder. It can be rule-based.

Example TouchStone rule:

```text
When: donation.created
If: donor has email AND donor has not opted out
Then: send thank-you email immediately

When: donation.created
If: donor has no email
Then: create printable thank-you letter task

When: donation.created + 7 days
If: donor is not monthly donor
Then: send monthly giving invitation email or create letter task
```

### TouchStone Trigger Types

- Donation created
- First donation
- Large donation
- Recurring gift started
- Recurring gift failed
- Donor became lapsed
- Donor attended event
- Donor registered for event
- Pledge created
- Pledge overdue
- Task completed
- Tag added
- Group membership added

### TouchStone Actions

- Send email
- Create letter
- Create task
- Add tag
- Add to group
- Remove from group
- Notify staff
- Create follow-up reminder
- Update donor status

---

## 3.7 Groups and Segments

Groups are manually or automatically maintained lists.

### Static Groups

A staff member manually adds donors.

Examples:

- Board Members
- Gala Committee
- Church Partners
- Major Donor Prospects
- Business Sponsors
- Past Table Hosts

### Dynamic Segments

The system automatically includes people based on rules.

Examples:

- First-time donors this year
- Donors who gave last year but not this year
- Donors who gave over $500 in the last 12 months
- Donors without email addresses
- Monthly donors
- Gala attendees who have not donated since the event
- Donors who gave to SOHL
- Donors with receipts needing print

### Segment Builder V1

Initial filter fields:

- Gift date range
- Gift amount range
- Total giving
- Last gift date
- Campaign
- Fund
- Appeal
- Tags
- Donor type
- Has email
- Has phone
- Communication preference
- Event attendance
- Assigned staff
- Donor status

---

## 3.8 Reports

Reports should be simple, printable, and board-friendly.

### Essential Reports

- Revenue progress
- Donations by date
- Donations by campaign
- Donations by fund
- Donations by appeal
- Donor retention
- Lapsed donors
- New donors
- Monthly donor report
- Year-end giving
- Receipt report
- Outstanding pledges
- Event income
- Sponsorship income
- Major donor activity
- Board summary report

### Report Output Options

- View in browser
- Export CSV
- Export PDF
- Print
- Save report settings
- Schedule report email, future feature

### Board Report

A board report generator should include:

- Total raised this month
- Total raised year to date
- Donor retention
- New donors
- Lapsed donors
- Recurring donors
- Campaign performance
- Major events
- Top-level stewardship activity
- Charts
- Plain-English summary

---

## 3.9 Events and Gala Tools

The event system should be designed around the actual Love at First Beat Gala workflow.

### Event Features

- Event creation
- Ticket types
- Table purchases
- Sponsorship packages
- Guest registration
- Table host management
- Guest self-registration links
- Seating chart
- Check-in mode
- Payment tracking
- Meal notes, if needed
- Guest notes
- Event emails
- Event receipts
- Sponsor tracking
- Event report

### Table Management

Each table should support:

- Table number
- Table host
- Seats available
- Guests assigned
- Payment status
- Sponsorship connection
- Notes
- Check-in status
- Public/private registration link

### Check-In Mode

The check-in screen should be mobile-ready and fast.

Features:

- Search by name
- Search by table
- Search by ticket
- Filter checked in / not checked in
- Add walk-in guest
- Edit guest details
- Assign table
- Mark paid
- Mark comped
- Mark checked in
- View guest notes

### Event Income Categories

- Ticket sales
- Table sales
- Sponsorships
- Auction income
- Fish race income
- Donations
- Pledges
- Other event income

---

## 3.10 Data Tools

Data tools should be powerful but safe.

### Import Tools

- Import constituents from CSV
- Import donations from CSV
- Import event guests from CSV
- Import tags/groups
- Preview before import
- Field mapping
- Duplicate detection
- Import history
- Rollback import, if possible

### Export Tools

- Export donors
- Export donations
- Export groups
- Export reports
- Export receipts
- Export letters
- Export event registrations

### Data Cleanup

- Duplicate finder
- Missing email report
- Missing address report
- Invalid phone report
- Donors without giving history
- Gifts without campaign
- Gifts without fund
- Unsent receipts
- Unassigned tasks

---

## 4. Improved API Architecture

## 4.1 Architecture Goals

The API should be designed for:

- Reliability
- Security
- Auditability
- Fast dashboard loading
- Easy future mobile app support
- Easy public website integration
- Clean separation between frontend and backend
- Long-term maintainability
- Strong donor privacy
- Safe automation
- Data portability

Recommended stack:

- Frontend: Next.js + TypeScript
- Backend: Node.js + TypeScript
- Database: MySQL
- ORM: Prisma or Drizzle
- Auth: Secure session-based auth or JWT with refresh tokens
- Queue: BullMQ or similar Redis-backed job queue
- Email: SMTP provider or transactional email service
- SMS: Twilio, optional
- File storage: Local secure storage first, S3-compatible storage later
- Deployment: Node cluster mode behind Nginx
- Process manager: PM2
- AI: Local model service or API provider behind an internal AI abstraction layer

---

## 4.2 API Design Style

Use a versioned REST API first.

Base path:

```text
/api/v1
```

Why REST first?

- Easier to debug
- Easier for Copilot/Claude to understand
- Easier to document
- Easier to integrate with forms, websites, and future mobile apps
- Works well for CRM-style resources

GraphQL can be considered later, but it is not needed for the first version.

---

## 4.3 API Principles

Every API endpoint should follow these rules:

1. Require authentication unless explicitly public.
2. Enforce role-based permission checks.
3. Validate all input with schemas.
4. Return consistent error shapes.
5. Write audit logs for important changes.
6. Never expose private system details in errors.
7. Support pagination on list endpoints.
8. Support filtering and sorting where useful.
9. Use idempotency keys for payment and donation creation.
10. Use background jobs for slow actions.
11. Keep public donation endpoints separated from staff-only endpoints.
12. Log automation actions to the donor timeline.

---

## 4.4 Standard Response Shapes

### Success Response

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "One or more fields are invalid.",
    "details": []
  }
}
```

### Paginated Response

```json
{
  "success": true,
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 25,
    "total": 240,
    "totalPages": 10
  }
}
```

---

## 4.5 Authentication API

### Endpoints

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
POST /api/v1/auth/refresh
GET  /api/v1/auth/me
POST /api/v1/auth/forgot-password
POST /api/v1/auth/reset-password
POST /api/v1/auth/change-password
```

### User Session Object

```json
{
  "id": "user_123",
  "name": "Rachel",
  "email": "rachel@example.org",
  "roles": ["admin"],
  "permissions": [
    "constituents.read",
    "donations.create",
    "reports.read"
  ]
}
```

---

## 4.6 Role and Permission API

### Core Roles

- Admin
- Director
- Development Staff
- Finance
- Event Staff
- Volunteer Coordinator
- Read Only
- Board Viewer, optional

### Permission Examples

```text
constituents.read
constituents.create
constituents.update
constituents.delete
donations.read
donations.create
donations.update
donations.delete
communications.send
reports.read
events.manage
settings.manage
automation.manage
```

### Endpoints

```text
GET    /api/v1/roles
POST   /api/v1/roles
GET    /api/v1/roles/:id
PATCH  /api/v1/roles/:id
DELETE /api/v1/roles/:id

GET    /api/v1/permissions
```

---

## 4.7 Constituents API

### Endpoints

```text
GET    /api/v1/constituents
POST   /api/v1/constituents
GET    /api/v1/constituents/:id
PATCH  /api/v1/constituents/:id
DELETE /api/v1/constituents/:id

GET    /api/v1/constituents/:id/timeline
GET    /api/v1/constituents/:id/donations
GET    /api/v1/constituents/:id/tasks
GET    /api/v1/constituents/:id/communications
GET    /api/v1/constituents/:id/events
GET    /api/v1/constituents/:id/summary

POST   /api/v1/constituents/:id/notes
POST   /api/v1/constituents/:id/tags
DELETE /api/v1/constituents/:id/tags/:tagId
```

### List Filters

```text
?search=
&type=
?tag=
?group=
?donorStatus=
?hasEmail=
?hasAddress=
?lastGiftBefore=
?lastGiftAfter=
?assignedTo=
?page=
?pageSize=
?sort=
```

### Constituent Create Payload

```json
{
  "type": "individual",
  "firstName": "John",
  "lastName": "Smith",
  "email": "john@example.com",
  "phone": "417-000-0000",
  "address": {
    "line1": "123 Main St",
    "line2": "",
    "city": "Aurora",
    "state": "MO",
    "postalCode": "65605",
    "country": "US"
  },
  "tags": ["church-partner"],
  "communicationPreference": "email"
}
```

---

## 4.8 Households and Relationships API

### Endpoints

```text
GET    /api/v1/households
POST   /api/v1/households
GET    /api/v1/households/:id
PATCH  /api/v1/households/:id
DELETE /api/v1/households/:id

POST   /api/v1/households/:id/members
DELETE /api/v1/households/:id/members/:constituentId

GET    /api/v1/relationships
POST   /api/v1/relationships
PATCH  /api/v1/relationships/:id
DELETE /api/v1/relationships/:id
```

### Relationship Types

- Spouse
- Family member
- Employee
- Employer
- Church member
- Board member
- Table host
- Sponsor contact
- Pastor
- Friend/referrer
- Other

---

## 4.9 Donations API

### Endpoints

```text
GET    /api/v1/donations
POST   /api/v1/donations
GET    /api/v1/donations/:id
PATCH  /api/v1/donations/:id
DELETE /api/v1/donations/:id

POST   /api/v1/donations/:id/receipt
POST   /api/v1/donations/:id/thank-you
POST   /api/v1/donations/:id/refund
POST   /api/v1/donations/:id/void
```

### Donation Create Payload

```json
{
  "constituentId": "con_123",
  "amount": 250.00,
  "giftDate": "2026-05-07",
  "paymentMethod": "check",
  "checkNumber": "1024",
  "fundId": "fund_general",
  "campaignId": "camp_sohl_2026",
  "appealId": "appeal_email_january",
  "notes": "Given after church presentation.",
  "receiptPreference": "auto"
}
```

### Donation Creation Should Trigger

- Gift saved
- Constituent summary recalculated
- Timeline event created
- Receipt record created
- Thank-you workflow started
- Dashboard cache refreshed
- Audit log created

---

## 4.10 Recurring Giving API

### Endpoints

```text
GET    /api/v1/recurring-gifts
POST   /api/v1/recurring-gifts
GET    /api/v1/recurring-gifts/:id
PATCH  /api/v1/recurring-gifts/:id
DELETE /api/v1/recurring-gifts/:id

POST   /api/v1/recurring-gifts/:id/pause
POST   /api/v1/recurring-gifts/:id/resume
POST   /api/v1/recurring-gifts/:id/cancel
```

### Recurring Gift Fields

- Constituent ID
- Amount
- Frequency
- Start date
- Next charge date
- Payment method
- Fund
- Campaign
- Status
- Failure count
- Last successful gift
- Notes

---

## 4.11 Pledges API

### Endpoints

```text
GET    /api/v1/pledges
POST   /api/v1/pledges
GET    /api/v1/pledges/:id
PATCH  /api/v1/pledges/:id
DELETE /api/v1/pledges/:id

POST   /api/v1/pledges/:id/payments
GET    /api/v1/pledges/:id/payments
POST   /api/v1/pledges/:id/reminder
```

### Pledge Statuses

- Active
- Fulfilled
- Partially fulfilled
- Overdue
- Cancelled
- Written off

---

## 4.12 Funds, Campaigns, and Appeals API

### Endpoints

```text
GET    /api/v1/funds
POST   /api/v1/funds
GET    /api/v1/funds/:id
PATCH  /api/v1/funds/:id
DELETE /api/v1/funds/:id

GET    /api/v1/campaigns
POST   /api/v1/campaigns
GET    /api/v1/campaigns/:id
PATCH  /api/v1/campaigns/:id
DELETE /api/v1/campaigns/:id

GET    /api/v1/appeals
POST   /api/v1/appeals
GET    /api/v1/appeals/:id
PATCH  /api/v1/appeals/:id
DELETE /api/v1/appeals/:id
```

### Campaign Summary Endpoint

```text
GET /api/v1/campaigns/:id/summary
```

Should return:

- Total raised
- Goal
- Percentage of goal
- Number of donors
- Number of gifts
- Average gift
- New donors
- Returning donors
- Related appeals
- Recent gifts

---

## 4.13 Tasks API

### Endpoints

```text
GET    /api/v1/tasks
POST   /api/v1/tasks
GET    /api/v1/tasks/:id
PATCH  /api/v1/tasks/:id
DELETE /api/v1/tasks/:id

POST   /api/v1/tasks/:id/complete
POST   /api/v1/tasks/:id/reopen
POST   /api/v1/tasks/bulk-complete
```

### Task Filters

```text
?assignedTo=
?status=
?priority=
?type=
?dueBefore=
?dueAfter=
?constituentId=
?campaignId=
?eventId=
```

---

## 4.14 Communications API

### Templates

```text
GET    /api/v1/communication-templates
POST   /api/v1/communication-templates
GET    /api/v1/communication-templates/:id
PATCH  /api/v1/communication-templates/:id
DELETE /api/v1/communication-templates/:id
POST   /api/v1/communication-templates/:id/preview
```

### Emails

```text
POST   /api/v1/emails/preview
POST   /api/v1/emails/send
POST   /api/v1/emails/schedule
GET    /api/v1/emails
GET    /api/v1/emails/:id
```

### Letters

```text
POST   /api/v1/letters/preview
POST   /api/v1/letters/generate
POST   /api/v1/letters/batch-generate
GET    /api/v1/letters
GET    /api/v1/letters/:id
POST   /api/v1/letters/:id/mark-printed
POST   /api/v1/letters/:id/mark-mailed
```

### Communication Logs

```text
GET    /api/v1/communications
POST   /api/v1/communications/log
GET    /api/v1/communications/:id
```

---

## 4.15 Receipts API

### Endpoints

```text
GET    /api/v1/receipts
POST   /api/v1/receipts
GET    /api/v1/receipts/:id
PATCH  /api/v1/receipts/:id
DELETE /api/v1/receipts/:id

POST   /api/v1/receipts/:id/send-email
POST   /api/v1/receipts/:id/generate-pdf
POST   /api/v1/receipts/:id/mark-printed
POST   /api/v1/receipts/:id/mark-mailed

POST   /api/v1/receipts/batch-generate
POST   /api/v1/receipts/batch-print
POST   /api/v1/receipts/year-end
```

### Receipt Statuses

- Draft
- Ready
- Emailed
- Printed
- Mailed
- Failed
- Voided

---

## 4.16 Groups and Segments API

### Static Groups

```text
GET    /api/v1/groups
POST   /api/v1/groups
GET    /api/v1/groups/:id
PATCH  /api/v1/groups/:id
DELETE /api/v1/groups/:id

POST   /api/v1/groups/:id/members
DELETE /api/v1/groups/:id/members/:constituentId
GET    /api/v1/groups/:id/members
```

### Dynamic Segments

```text
GET    /api/v1/segments
POST   /api/v1/segments
GET    /api/v1/segments/:id
PATCH  /api/v1/segments/:id
DELETE /api/v1/segments/:id

POST   /api/v1/segments/:id/preview
GET    /api/v1/segments/:id/members
```

### Segment Definition Example

```json
{
  "name": "Lapsed Donors",
  "rules": {
    "all": [
      {
        "field": "lastGiftDate",
        "operator": "before",
        "value": "2025-01-01"
      },
      {
        "field": "totalGivingLifetime",
        "operator": "greaterThan",
        "value": 0
      }
    ]
  }
}
```

---

## 4.17 Events API

### Events

```text
GET    /api/v1/events
POST   /api/v1/events
GET    /api/v1/events/:id
PATCH  /api/v1/events/:id
DELETE /api/v1/events/:id
GET    /api/v1/events/:id/summary
```

### Tickets and Registrations

```text
GET    /api/v1/events/:id/ticket-types
POST   /api/v1/events/:id/ticket-types

GET    /api/v1/events/:id/registrations
POST   /api/v1/events/:id/registrations
GET    /api/v1/events/:id/registrations/:registrationId
PATCH  /api/v1/events/:id/registrations/:registrationId
DELETE /api/v1/events/:id/registrations/:registrationId
```

### Tables and Seating

```text
GET    /api/v1/events/:id/tables
POST   /api/v1/events/:id/tables
PATCH  /api/v1/events/:id/tables/:tableId
DELETE /api/v1/events/:id/tables/:tableId

POST   /api/v1/events/:id/tables/:tableId/assign-guest
POST   /api/v1/events/:id/tables/:tableId/remove-guest
POST   /api/v1/events/:id/tables/:tableId/generate-host-link
```

### Check-In

```text
GET    /api/v1/events/:id/check-in/search
POST   /api/v1/events/:id/check-in/:registrationId
POST   /api/v1/events/:id/check-out/:registrationId
POST   /api/v1/events/:id/walk-ins
```

---

## 4.18 Reports API

### Endpoints

```text
GET  /api/v1/reports/dashboard
GET  /api/v1/reports/revenue
GET  /api/v1/reports/retention
GET  /api/v1/reports/lapsed-donors
GET  /api/v1/reports/new-donors
GET  /api/v1/reports/monthly-giving
GET  /api/v1/reports/campaigns
GET  /api/v1/reports/funds
GET  /api/v1/reports/appeals
GET  /api/v1/reports/events
GET  /api/v1/reports/board-summary
POST /api/v1/reports/export
```

### Dashboard API

```text
GET /api/v1/reports/dashboard?range=year-to-date
```

Should return all home dashboard widgets in one optimized request:

```json
{
  "revenueProgress": {
    "goal": 200000,
    "raised": 14220,
    "percentage": 7
  },
  "donorRetention": {
    "percentage": 62,
    "retained": 124,
    "total": 200
  },
  "tasks": {
    "dueSoon": [],
    "overdue": []
  },
  "recentDonations": [],
  "monthlyGiving": {},
  "campaigns": []
}
```

This avoids loading the dashboard through many separate API calls.

---

## 4.19 Automation API

### Endpoints

```text
GET    /api/v1/automations
POST   /api/v1/automations
GET    /api/v1/automations/:id
PATCH  /api/v1/automations/:id
DELETE /api/v1/automations/:id

POST   /api/v1/automations/:id/enable
POST   /api/v1/automations/:id/disable
POST   /api/v1/automations/:id/test
GET    /api/v1/automation-runs
GET    /api/v1/automation-runs/:id
```

### Automation Safety Rules

- Automations should be disabled by default until reviewed.
- Bulk sends should require confirmation.
- Every automation run should be logged.
- Failed automation steps should be retryable.
- Staff should be able to see why a donor received a message.
- Automations should respect opt-outs and communication preferences.
- Automations should never permanently delete data.

### Automation Run Log

Each run should record:

- Automation ID
- Trigger event
- Constituent ID
- Actions attempted
- Actions completed
- Actions failed
- Error message
- Started at
- Completed at
- Created timeline entries

---

## 4.20 Public Website API

The public website should not use the full internal CRM API. It should use a limited public API.

### Public Endpoints

```text
POST /api/v1/public/donations
POST /api/v1/public/event-registrations
POST /api/v1/public/newsletter-signup
POST /api/v1/public/contact
GET  /api/v1/public/events/:slug
GET  /api/v1/public/campaigns/:slug
```

### Public API Rules

- Strong rate limiting
- CAPTCHA or bot protection where needed
- Strict input validation
- No private donor data returned
- Payment actions use idempotency keys
- Public form submissions create internal review records
- Staff receives notifications when needed

---

## 4.21 Payment API

The first payment integration should be Stripe unless the center chooses another provider.

### Endpoints

```text
POST /api/v1/payments/create-intent
POST /api/v1/payments/confirm
POST /api/v1/payments/webhook
GET  /api/v1/payments/:id
POST /api/v1/payments/:id/refund
```

### Payment Rules

- Never store raw card numbers.
- Use payment provider tokens.
- Verify webhook signatures.
- Use idempotency keys.
- Match payment records to donation records.
- Mark failed payments clearly.
- Trigger receipts only after confirmed payment.
- Log payment status changes to the timeline.

---

## 4.22 AI API

AI should support staff work but should not replace staff review.

### AI Goals

- Draft thank-you emails
- Draft donor follow-up letters
- Summarize donor timeline
- Suggest next stewardship action
- Write board report summaries
- Generate campaign email drafts
- Help clean imported data
- Help create event updates
- Help create donor newsletter drafts

### AI Endpoints

```text
POST /api/v1/ai/draft-email
POST /api/v1/ai/draft-letter
POST /api/v1/ai/summarize-constituent
POST /api/v1/ai/suggest-next-action
POST /api/v1/ai/summarize-report
POST /api/v1/ai/clean-import-row
POST /api/v1/ai/generate-campaign-copy
```

### AI Safety Requirements

- AI drafts should be marked as drafts.
- Staff must approve before sending.
- AI output should be saved with version history when used.
- Sensitive donor notes should be excluded unless explicitly needed.
- AI should not invent giving history or relationship facts.
- AI summaries should link back to source records.
- Local AI should be preferred for private donor analysis when available.
- The AI provider should be abstracted so the app can switch between local AI and hosted APIs.

### AI Abstraction Layer

Create an internal service:

```text
AiProvider
```

Supported providers:

- Local model provider
- OpenAI-compatible API provider
- Future provider options

The rest of the app should not care which AI provider is being used.

---

## 4.23 Imports API

### Endpoints

```text
POST /api/v1/imports/upload
POST /api/v1/imports/:id/map-fields
POST /api/v1/imports/:id/preview
POST /api/v1/imports/:id/run
POST /api/v1/imports/:id/rollback
GET  /api/v1/imports
GET  /api/v1/imports/:id
```

### Import Flow

1. Upload CSV.
2. Detect columns.
3. Map columns to CRM fields.
4. Preview results.
5. Show duplicate warnings.
6. Show validation errors.
7. Run import in background job.
8. Create import history.
9. Allow rollback where safe.

---

## 4.24 Files and Documents API

### Use Cases

- Receipt PDFs
- Letter PDFs
- Event exports
- Donor documents
- Sponsor logos
- Import files
- Report PDFs

### Endpoints

```text
POST   /api/v1/files
GET    /api/v1/files/:id
DELETE /api/v1/files/:id
GET    /api/v1/files/:id/download
```

### File Security

- Files should be private by default.
- Use signed URLs for download.
- Log access to sensitive files.
- Restrict access by permission.
- Scan uploads where possible.
- Limit file size and file type.

---

## 4.25 Audit Log API

Every important change should be logged.

### Endpoints

```text
GET /api/v1/audit-logs
GET /api/v1/audit-logs/:id
```

### Audit Events

- Login
- Failed login
- User created
- User role changed
- Donor created
- Donor updated
- Donor deleted
- Donation created
- Donation updated
- Donation deleted
- Receipt sent
- Email sent
- Bulk email sent
- Import run
- Export run
- Automation enabled
- Automation run
- Report exported
- Settings changed

### Audit Log Fields

- User ID
- Action
- Entity type
- Entity ID
- Before value
- After value
- IP address
- User agent
- Created at

---

## 4.26 Webhooks and Internal Events

The API should use internal events so modules do not become tangled together.

### Internal Event Examples

```text
constituent.created
constituent.updated
donation.created
donation.updated
donation.deleted
receipt.created
receipt.sent
task.created
task.completed
email.sent
event.registration.created
pledge.created
pledge.overdue
recurringGift.failed
```

### Why Internal Events Matter

When `donation.created` happens, multiple things may need to happen:

- Update dashboard metrics
- Add timeline event
- Create receipt
- Trigger automation
- Recalculate donor status
- Notify staff
- Update campaign totals

Instead of writing all of that directly inside the donation controller, the app should publish an internal event and allow separate listeners to respond.

This keeps the code cleaner and easier to expand.

---

## 4.27 Background Jobs

Some actions should not happen inside normal web requests.

### Background Job Examples

- Sending emails
- Generating PDFs
- Running imports
- Exporting large reports
- Running automations
- Recalculating dashboard metrics
- Cleaning duplicates
- Processing payment webhooks
- AI generation
- Creating year-end receipts

### Job Requirements

- Retry failed jobs
- Show job status
- Log failures
- Prevent duplicate processing
- Use idempotency keys
- Allow safe re-run where appropriate

### Job API

```text
GET  /api/v1/jobs
GET  /api/v1/jobs/:id
POST /api/v1/jobs/:id/retry
POST /api/v1/jobs/:id/cancel
```

---

## 5. Database Planning

## 5.1 Core Tables

Recommended MySQL tables:

```text
users
roles
permissions
user_roles
role_permissions

constituents
households
household_members
organizations
relationships
addresses
emails
phones

donations
recurring_gifts
pledges
pledge_payments
funds
campaigns
appeals
receipts

tasks
notes
timeline_events
tags
taggings
groups
group_members
segments

communication_templates
communications
email_messages
letters
sms_messages

events
event_ticket_types
event_registrations
event_tables
event_table_guests
event_sponsors
event_checkins

imports
import_rows
exports
files

automations
automation_steps
automation_runs
automation_run_logs

audit_logs
settings
webhook_events
jobs
```

---

## 5.2 Important Data Rules

### Do Not Delete Financial History Casually

Donation records should generally be voided or reversed instead of hard-deleted.

### Keep Audit Trails

Any change to a donation, receipt, or donor contact record should be tracked.

### Use Soft Deletes

Use soft deletes for most records so mistakes can be recovered.

### Separate Contact Methods

Do not store only one email or one phone directly on the constituent table if possible. Use related email and phone tables so the system can grow.

### Keep Summary Fields Cached

For speed, store calculated fields like:

- Total lifetime giving
- Total giving this year
- Last gift date
- Last gift amount
- First gift date
- Largest gift amount
- Number of gifts
- Donor status

These can be recalculated when gifts change.

---

## 6. Donor Status Model

Recommended statuses:

- New donor
- Active donor
- Monthly donor
- Major donor
- Lapsed donor
- Former donor
- Prospect
- Non-donor constituent
- Deceased
- Do not contact

### Status Rules Example

```text
New donor:
First gift within last 90 days.

Active donor:
At least one gift within last 12 months.

Lapsed donor:
Gave previously, but no gift in last 12 months.

Monthly donor:
Has active recurring gift.

Major donor:
Lifetime giving or annual giving exceeds configured threshold.

Do not contact:
Manual flag set by staff.
```

These rules should be configurable in settings.

---

## 7. Dashboard API and Caching Plan

The dashboard should feel instant.

### Strategy

- Use one dashboard summary endpoint.
- Store dashboard metric snapshots.
- Recalculate on schedule and after major events.
- Allow manual refresh.
- Show last refreshed time.
- Avoid heavy database queries on every page load.

### Dashboard Snapshot Table

```text
dashboard_snapshots
```

Fields:

- ID
- Range
- Data JSON
- Created at
- Refreshed by
- Status

### Refresh Triggers

- Donation created
- Donation updated
- Donation deleted
- Campaign updated
- Task completed
- Event registration created
- Manual refresh button
- Scheduled nightly refresh

---

## 8. Security and Privacy Plan

Because donor data is private, security must be built in from the beginning.

### Requirements

- HTTPS only
- Secure password hashing
- Multi-factor authentication, recommended
- Role-based permissions
- Audit logs
- Session timeout
- Rate limiting
- CSRF protection for session auth
- Input validation
- Output escaping
- Database backups
- Encrypted secrets
- Least-privilege database user
- File upload restrictions
- Private file storage
- No raw credit card storage
- Webhook signature verification
- Export permission restrictions

### Sensitive Actions Requiring Extra Permission

- Exporting donor lists
- Deleting donors
- Editing donations
- Sending bulk emails
- Changing automation rules
- Changing payment settings
- Viewing audit logs
- Managing users
- Running imports
- Rolling back imports

---

## 9. Integration Plan

## 9.1 Website Integration

The public website should be able to:

- Submit donations
- Register event guests
- Submit contact forms
- Add newsletter subscribers
- Show public campaign pages
- Show public event pages

The website should not have access to internal donor search, reports, or private data.

## 9.2 Email Integration

The CRM should support:

- SMTP settings
- Transactional email provider
- Email templates
- Sending logs
- Bounce handling, future feature
- Unsubscribe handling
- Staff test emails

## 9.3 SMS Integration

Twilio can be added for:

- Event reminders
- Volunteer reminders
- Appointment reminders, if needed
- Pledge reminders
- Staff alerts

SMS should require careful opt-in tracking.

## 9.4 Payment Integration

Stripe should be the first payment provider considered.

Payment integration should support:

- One-time gifts
- Recurring gifts
- Event tickets
- Sponsorships
- Refunds
- Webhooks
- Receipts

## 9.5 Accounting Export

Initial version can export CSV files for accounting.

Future version can integrate with accounting software.

Export fields should include:

- Date
- Donor
- Amount
- Fund
- Campaign
- Payment method
- Check number
- Transaction ID
- Notes

---

## 10. First Development Milestone

The first working version should be intentionally focused.

### Milestone 1: CRM Shell and Core Data

Build:

- Light dashboard layout
- Sidebar navigation
- Auth
- User roles
- Constituents
- Constituent profile
- Donations
- Funds
- Campaigns
- Appeals
- Timeline events
- Basic tasks
- Basic reports
- MySQL schema
- API versioning
- Audit logging foundation

### Milestone 1 Success Criteria

Staff can:

- Log in
- Add a donor
- Search for a donor
- Open a donor profile
- Enter a gift
- See the gift on the donor timeline
- See dashboard revenue update
- Create a task
- View basic giving reports

---

## 11. Second Development Milestone

### Milestone 2: Receipts and Thank-You Workflow

Build:

- Receipt generation
- Email thank-you templates
- Printable letter templates
- Merge fields
- Immediate thank-you automation
- Seven-day follow-up automation
- Print queue
- Communication logging
- Donor TouchStone rules V1

### Milestone 2 Success Criteria

Staff can:

- Enter a check donation
- Automatically create a receipt
- Email a thank-you
- Generate a printable thank-you letter
- Schedule a seven-day follow-up
- See all communication on the donor timeline

---

## 12. Third Development Milestone

### Milestone 3: Campaigns, Segments, and Reports

Build:

- Segment builder
- Static groups
- Campaign dashboards
- Lapsed donor report
- New donor report
- Monthly giving report
- Board summary report
- CSV exports
- PDF report export

### Milestone 3 Success Criteria

Staff can:

- Build donor lists
- Report on campaign performance
- Find lapsed donors
- Export board-ready reports
- See monthly donor growth

---

## 13. Fourth Development Milestone

### Milestone 4: Gala and Event Tools

Build:

- Event creation
- Ticket types
- Registrations
- Table hosts
- Seating chart
- Check-in mode
- Sponsor tracking
- Event income categories
- Event report

### Milestone 4 Success Criteria

Staff can:

- Create the gala event
- Sell or record tables
- Assign guests to tables
- Check guests in at the door
- Track sponsor income
- Report total event revenue

---

## 14. Fifth Development Milestone

### Milestone 5: AI and Advanced Stewardship

Build:

- AI email draft tool
- AI letter draft tool
- AI donor timeline summary
- AI board report summary
- AI next-action suggestions
- Local/provider abstraction layer
- Staff approval workflow

### Milestone 5 Success Criteria

Staff can:

- Generate a donor thank-you draft
- Summarize a donor relationship
- Draft a newsletter section
- Generate a board report summary
- Approve before anything is sent

---

## 15. Developer Notes

### Code Quality Expectations

- Use TypeScript everywhere.
- Keep API controllers thin.
- Put business logic in services.
- Use schema validation for every request.
- Add comments where logic is complex.
- Add TODO comments for unfinished areas.
- Write database migrations carefully.
- Use seed data for local development.
- Keep test data separate from real donor data.
- Avoid hard-coded campaign names.
- Make center-specific labels configurable.

### Recommended Folder Structure

```text
/apps
  /web
    /app
    /components
    /lib
    /features
  /api
    /src
      /modules
      /services
      /jobs
      /events
      /middleware
      /routes
      /schemas
      /utils

/packages
  /database
  /ui
  /types
  /config
  /email-templates
```

### Backend Module Structure

```text
/modules/constituents
  constituent.routes.ts
  constituent.controller.ts
  constituent.service.ts
  constituent.schema.ts
  constituent.repository.ts
  constituent.events.ts
```

This pattern should be repeated for donations, tasks, communications, reports, events, and automations.

---

## 16. What Makes This Better Than a Generic CRM

This CRM should not try to be everything for everyone.

It should be built specifically for nonprofit ministry stewardship:

- Donation-first workflows
- Thank-you and receipt automation
- Donor retention visibility
- Ministry-centered communication
- Board-ready reporting
- Gala and event operations
- Church and business partner tracking
- Printable letters for offline donors
- Local/private AI options
- Simple dashboard-driven daily work

The key idea is this:

> The system should not merely store donor data. It should help the center steward relationships faithfully and consistently.

---

## 17. Final Recommended Priority

Build in this order:

1. Constituents
2. Donations
3. Timeline
4. Receipts
5. Tasks
6. Dashboard
7. Email/letter templates
8. Thank-you automation
9. Reports
10. Segments/groups
11. Event/gala tools
12. AI drafting and summaries
13. Advanced integrations

This order gets the center to practical daily value as quickly as possible.

---

## 18. OyamaCRM Implementation Notes Addendum

These items are important for delivery quality and should be treated as required planning notes.

### 18.1 Multi-tenant direction

- Current implementation uses `org_demo` defaults in several places.
- Phase work should include explicit tenancy decisions (single-tenant now vs. multi-tenant ready schema).
- If multi-tenant ready, every donor, gift, task, and report query must be tenant-scoped.

### 18.2 Validation and contract discipline

- Every API write endpoint should use schema validation (Zod or equivalent).
- API responses should keep stable shapes across modules.
- Breaking response changes should be versioned.

### 18.3 Testing and quality gates

- Define minimum gates per phase: build, type-check, and critical smoke paths.
- Add contract tests for high-risk flows (gift entry, receipt generation, task creation, report exports).
- Seed data must remain compatible with schema evolution.

### 18.4 Observability and operations

- Add structured logs with request IDs and actor IDs.
- Track core metrics: API latency, job failures, webhook failures, automation failures.
- Add baseline alerting for payment failures, job dead-letter growth, and import errors.

### 18.5 Data governance and retention

- Financial records should be voided/reversed, not hard-deleted.
- Define retention for logs, exports, and uploaded files.
- Define PII handling rules and redaction policy for logs and AI prompts.

### 18.6 Accessibility and UX consistency

- Maintain white/gray background + green accent visual system.
- Keep keyboard/focus accessibility as a release requirement.
- Keep modular component boundaries; avoid page-level monoliths.

### 18.7 Release management

- Use phase checkpoints with explicit scope lock and deferred list.
- Keep migration rollback strategy documented before production deploys.
- Maintain PM2 deployment profile for web cluster + api process and document expected runtime topology.
