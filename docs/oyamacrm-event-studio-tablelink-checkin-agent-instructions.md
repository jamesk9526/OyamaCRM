# OyamaCRM Event Studio — TableLink + Check-In Studio Backend Plan

**Document purpose:**  
This file gives coding agents a complete implementation plan for redesigning the OyamaCRM Event CRM / Event Studio table management, public table portal, guest invitation flow, and event-day check-in system.

**Primary goal:**  
Build a production-ready backend-backed system where event tables have secure universal IDs, table hosts can manage their own table from a public portal, guests can fill in their own information over time, and event staff can check guests in quickly and accurately on event day.

## Implementation Progress (Agent-Maintained)

Tracking file: `docs/status/events-tablelink-checkin-implementation.md`

- Phase 1 - Audit and planning: Done (2026-05-18)
- Phase 2 - Backend models and migrations: Done (2026-05-18)
- Phase 3 - Backend services: Done (2026-05-18)
- Phase 4 - API routes: Done (2026-05-18)
- Phase 5 - Admin Event Studio UI: Done (2026-05-18)
- Phase 6 - Public TableLink portal: Done (2026-05-18)
- Phase 7 - Guest self-entry flow: Done (2026-05-18)
- Phase 8 - Check-In Studio redesign: Done (2026-05-18)
- Phase 9 - Reporting and exports: Done (2026-05-18)
- Phase 10 - Testing and documentation: Not Started

Execution rule for agents:

- Complete one phase at a time.
- After each completed phase, ask the user if they want to continue to the next phase.
- Resume from the next unfinished phase when the user says continue.

---

## 1. Product Names and Concepts

Use two connected product concepts:

### TableLink

**TableLink** is the public-facing table management system.

It allows table hosts, sponsors, or assigned contacts to manage their table without needing a full OyamaCRM user account.

TableLink should support:

- Secure table access
- Public table login
- Host magic links
- Guest invitations
- Seat-by-seat roster management
- Partial guest entry
- Guest self-entry
- Table completion tracking
- Final table submission
- Admin locking before the event

### Check-In Studio

**Check-In Studio** is the event-day attendance system inside Event Studio.

It should support:

- QR scanning
- Fast name search
- Table search
- Table roster check-in
- Walk-ins
- Replacement guests
- Exception handling
- Live attendance counts
- Audit history
- Post-event reports

---

## 2. Core Architecture Rule

This must be a real backend-backed feature, not a front-end-only UI.

The system should follow this ownership model:

```txt
Event owns tables.
Tables own seats.
Seats may hold guests or invites.
Guests may check in.
Every check-in creates a permanent check-in record.
```

Do not rely on a simple `checkedIn: true` field as the source of truth.  
Check-in must create auditable records.

---

## 3. Identifier Strategy

Each table needs multiple identifiers with different purposes.

### Required table identifiers

```ts
internalId: string;      // private database primary key
eventId: string;         // parent event scope
tableUid: string;        // stable universal ID, UUID or ULID
publicCode: string;      // short human-friendly TableKey
accessTokenHash?: string; // hashed magic-link access token
```

### Important rules

- Never expose raw database IDs publicly.
- `tableUid` should be stable and never change.
- `publicCode` should be short enough for humans to type.
- Access must not depend only on the public code.
- Magic-link tokens must be securely generated, hashed in the database, and expire.
- Public code identifies a table; token/email verification grants access.

### Recommended public naming

Public-facing name:

```txt
TableLink
```

Technical table code name:

```txt
TableKey
```

Example public code:

```txt
TBL-LAFB26-7XQ9
```

Example internal wording:

```txt
Each event table receives a secure TableKey. Table hosts use TableLink to manage their guest roster, send invitations, and keep their table updated without needing full CRM access.
```

---

## 4. Event Studio Placement

Inside Event Studio, the event flow should remain scoped to a selected event.

Recommended navigation:

```txt
Event Studio
  Overview
  Tickets
  Tables
  Guests
  Seating Chart
  Check-In Studio
  Public Pages
  Emails
  Reports
  Settings
```

The table and check-in system should not operate globally unless in a reporting/admin view.  
Most table, guest, invite, and check-in operations must be scoped to the selected event.

---

## 5. Backend Data Models

The exact ORM syntax can match the current project stack, but the data structure should follow this model.

---

### 5.1 EventTable

Represents a table assigned to an event.

```ts
EventTable {
  id: string;                     // internal database ID
  eventId: string;                // parent event
  tableUid: string;               // stable universal table ID
  publicCode: string;             // human-friendly TableKey

  name: string;                   // "Mercy Hospital Table", "Table 14"
  tableNumber?: number;
  sponsorName?: string;

  hostName?: string;
  hostEmail?: string;
  hostPhone?: string;

  capacity: number;

  status:
    | "draft"
    | "open"
    | "submitted"
    | "locked"
    | "event_day"
    | "archived";

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

#### EventTable requirements

- A table must belong to one event.
- A table should be able to exist without guests.
- The table name can change without changing `tableUid`.
- Capacity should create or sync seat slots.
- Admins should be able to lock a table before event day.
- Locked tables should prevent host edits unless an admin overrides.

---

### 5.2 EventTableSeat

Represents a numbered seat at a table.

```ts
EventTableSeat {
  id: string;
  eventId: string;
  tableId: string;

  seatNumber: number;

  guestId?: string;
  inviteId?: string;

  status:
    | "empty"
    | "reserved"
    | "invited"
    | "confirmed"
    | "checked_in"
    | "cancelled";

  notes?: string;

  createdAt: Date;
  updatedAt: Date;
}
```

#### Seat requirements

- Tables should use numbered seat slots.
- Each seat belongs to one event and one table.
- A seat can be empty, invited, confirmed, or checked in.
- Seat status should be derived carefully from guest/invite/check-in state when possible.
- Do not allow two active guests in one seat unless the system explicitly handles overflow.

---

### 5.3 EventGuest

Represents a person connected to an event.

```ts
EventGuest {
  id: string;
  eventId: string;

  tableId?: string;
  seatId?: string;

  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;

  organizationName?: string;
  sponsorName?: string;

  mealChoice?: string;
  dietaryNotes?: string;
  accessibilityNeeds?: string;
  notes?: string;

  status:
    | "draft"
    | "invited"
    | "confirmed"
    | "arrived"
    | "no_show"
    | "cancelled"
    | "needs_review";

  source:
    | "admin"
    | "table_host"
    | "guest_self_entry"
    | "import"
    | "walk_in"
    | "replacement";

  qrTokenHash?: string;
  qrTokenExpiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

#### Guest requirements

- Guests must belong to one event.
- Guests may or may not belong to a table.
- A guest can be added manually by admin.
- A guest can be added by a table host.
- A guest can complete their own information from an invite link.
- Walk-ins and replacements must create real guest records.
- Guest source must be preserved for reporting.

---

### 5.4 EventGuestInvite

Represents an invitation sent to a guest to fill in their own information.

```ts
EventGuestInvite {
  id: string;
  eventId: string;

  tableId: string;
  seatId?: string;

  invitedByUserId?: string;
  invitedByHostEmail?: string;

  inviteEmail?: string;
  invitePhone?: string;

  tokenHash: string;

  status:
    | "created"
    | "queued"
    | "sent"
    | "opened"
    | "completed"
    | "expired"
    | "cancelled";

  openedAt?: Date;
  completedAt?: Date;
  expiresAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

#### Invite requirements

- Invites should be tied to an event.
- Invites should usually be tied to a table.
- Invites may be tied to a specific seat.
- Tokens must be hashed in storage.
- Public invite URLs should use raw tokens only in transit.
- Once completed, the invite should create or update an `EventGuest`.
- Invite status should update when opened and completed.
- Expired or cancelled invites should not allow completion.

---

### 5.5 EventTableAccessToken

Represents a host magic-link access token.

```ts
EventTableAccessToken {
  id: string;
  eventId: string;
  tableId: string;

  hostEmail: string;
  tokenHash: string;

  status:
    | "active"
    | "used"
    | "expired"
    | "revoked";

  expiresAt: Date;
  lastUsedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

#### Access token requirements

- Table hosts should not need full CRM accounts.
- Host access should use verified email and magic-link tokens.
- Tokens should expire.
- Admins should be able to regenerate/revoke host access.
- Access logs should be created when a host opens the portal.

---

### 5.6 EventCheckInRecord

Represents an auditable check-in action.

```ts
EventCheckInRecord {
  id: string;
  eventId: string;

  guestId?: string;
  tableId?: string;
  seatId?: string;

  method:
    | "qr_scan"
    | "name_search"
    | "table_search"
    | "manual"
    | "bulk_table"
    | "walk_in"
    | "replacement";

  status:
    | "checked_in"
    | "reversed"
    | "duplicate_attempt"
    | "needs_review";

  checkedInByUserId?: string;
  checkInDeviceId?: string;

  checkedInAt: Date;
  reversedAt?: Date;
  reversedByUserId?: string;

  notes?: string;
}
```

#### Check-in record requirements

- Check-in should create a record.
- Duplicate check-ins should be detected and logged or clearly blocked.
- Reversing a check-in should not erase history.
- A reversal should update or create an auditable record.
- Check-in method should be stored for reporting.
- Device ID should be supported if the app has multiple check-in stations.

---

### 5.7 EventCheckInException

Represents event-day problems that need staff review.

```ts
EventCheckInException {
  id: string;
  eventId: string;

  guestId?: string;
  tableId?: string;
  seatId?: string;

  guestName?: string;
  claimedTable?: string;
  claimedEmail?: string;
  claimedPhone?: string;

  issueType:
    | "not_found"
    | "duplicate"
    | "wrong_table"
    | "replacement"
    | "unconfirmed"
    | "no_ticket"
    | "other";

  status:
    | "open"
    | "resolved"
    | "dismissed";

  notes?: string;

  createdByUserId?: string;
  resolvedByUserId?: string;

  createdAt: Date;
  resolvedAt?: Date;
}
```

#### Exception requirements

- Volunteers should be able to send messy cases to an exception queue.
- Main check-in lines should not be slowed down by edge cases.
- Lead staff should resolve exceptions from a dedicated view.
- Resolved exceptions should preserve notes and resolution history.

---

### 5.8 EventEmailLog

Tracks event-related emails.

```ts
EventEmailLog {
  id: string;
  eventId: string;

  tableId?: string;
  guestId?: string;
  inviteId?: string;

  type:
    | "host_access"
    | "guest_invite"
    | "guest_reminder"
    | "guest_confirmation"
    | "checkin_qr"
    | "table_roster_reminder";

  recipientEmail: string;

  status:
    | "queued"
    | "sent"
    | "failed"
    | "opened";

  subject?: string;
  providerMessageId?: string;
  errorMessage?: string;

  queuedAt?: Date;
  sentAt?: Date;
  openedAt?: Date;

  createdAt: Date;
  updatedAt: Date;
}
```

#### Email log requirements

- Emails should be sent from backend services or jobs, not only from the browser.
- Every event email should create an email log.
- Email logs should appear on table and guest detail pages.
- Failed emails should be visible to admins.

---

## 6. Backend Services

Create backend services rather than putting all logic directly in API routes.

Recommended services:

```txt
eventTableService
eventSeatService
tableLinkAccessService
guestInviteService
eventGuestService
eventEmailService
checkInService
checkInExceptionService
eventReportingService
```

---

### 6.1 eventTableService

Responsibilities:

- Create table
- Update table
- Delete/archive table
- Generate `tableUid`
- Generate `publicCode`
- Assign host
- Lock/unlock table
- Sync table capacity with seats
- Fetch table with seats, guests, invites, and check-in state

---

### 6.2 eventSeatService

Responsibilities:

- Create seats when table capacity is set
- Resize table seats if capacity changes
- Assign guest to seat
- Assign invite to seat
- Clear seat
- Move guest from one seat/table to another
- Validate capacity limits
- Prevent invalid duplicate seat assignment

---

### 6.3 tableLinkAccessService

Responsibilities:

- Request host access
- Validate host email
- Create magic link token
- Hash token in database
- Send host access email
- Verify token
- Revoke token
- Regenerate access
- Log host portal activity

---

### 6.4 guestInviteService

Responsibilities:

- Create guest invite
- Generate invite token
- Hash invite token
- Queue guest invitation email
- Mark invite opened
- Complete invite
- Create or update guest from invite completion
- Expire invite
- Cancel invite
- Resend invite

---

### 6.5 eventGuestService

Responsibilities:

- Create guest manually
- Create guest from table host entry
- Create guest from invite completion
- Create walk-in guest
- Create replacement guest
- Update guest
- Assign guest to table/seat
- Remove guest from table
- Mark guest cancelled/no-show
- Generate guest QR token
- Search guests within event

---

### 6.6 eventEmailService

Responsibilities:

- Queue event emails
- Send host access emails
- Send guest invite emails
- Send confirmation emails
- Send table roster reminder emails
- Send event-day QR/check-in emails
- Log sent/failed email status
- Provide admin-visible email history

---

### 6.7 checkInService

Responsibilities:

- Verify QR token
- Preview guest before check-in
- Check in guest
- Bulk check in table guests
- Detect duplicate check-ins
- Reverse check-in
- Create check-in records
- Update guest status to arrived where appropriate
- Update seat status to checked_in where appropriate
- Return live attendance counts

---

### 6.8 checkInExceptionService

Responsibilities:

- Create exception
- List open exceptions
- Resolve exception
- Dismiss exception
- Convert exception into walk-in/replacement guest
- Preserve notes and audit history

---

### 6.9 eventReportingService

Responsibilities:

- Expected guest count
- Confirmed guest count
- Checked-in count
- No-show count
- Walk-in count
- Replacement count
- Table completion rate
- Sponsor/table attendance
- Meal counts
- Open exceptions
- Email send status
- Export-ready attendance reports

---

## 7. Backend API Routes

Adapt route names to the current Next.js architecture.  
The important part is the capability and event scoping.

---

### 7.1 Admin table routes

```txt
POST   /api/events/:eventId/tables
GET    /api/events/:eventId/tables
GET    /api/events/:eventId/tables/:tableId
PATCH  /api/events/:eventId/tables/:tableId
DELETE /api/events/:eventId/tables/:tableId
```

Required actions:

- Create table
- List event tables
- Read table detail
- Update table details
- Archive/delete table
- Assign host
- Lock/unlock table
- Regenerate TableKey if admin allows

---

### 7.2 Seat routes

```txt
POST   /api/events/:eventId/tables/:tableId/seats/sync
GET    /api/events/:eventId/tables/:tableId/seats
PATCH  /api/events/:eventId/seats/:seatId
POST   /api/events/:eventId/seats/:seatId/assign-guest
POST   /api/events/:eventId/seats/:seatId/clear
POST   /api/events/:eventId/seats/move-guest
```

Required actions:

- Sync seats to table capacity
- List seats
- Update seat
- Assign guest
- Clear seat
- Move guest

---

### 7.3 TableLink public access routes

```txt
POST   /api/events/:eventId/tablelink/request-access
POST   /api/events/:eventId/tablelink/verify-token
GET    /api/events/:eventId/tablelink/:tableUid
PATCH  /api/events/:eventId/tablelink/:tableUid
```

Required actions:

- Host enters TableKey and email
- Backend verifies host/table relationship
- Backend sends magic link
- Host opens magic link
- Backend verifies token
- Host sees only their table
- Host updates only allowed fields

---

### 7.4 Guest invite routes

```txt
POST   /api/events/:eventId/tablelink/:tableUid/invite-guest
POST   /api/events/:eventId/tablelink/invites/:token/opened
GET    /api/events/:eventId/tablelink/invites/:token
POST   /api/events/:eventId/tablelink/invites/:token/complete
POST   /api/events/:eventId/tablelink/invites/:inviteId/resend
POST   /api/events/:eventId/tablelink/invites/:inviteId/cancel
```

Required actions:

- Host invites guest
- Guest opens invite
- Guest fills own information
- Guest confirms RSVP
- Invite status updates
- Guest record is created/updated
- Email log is updated

---

### 7.5 Admin guest routes

```txt
POST   /api/events/:eventId/guests
GET    /api/events/:eventId/guests
GET    /api/events/:eventId/guests/:guestId
PATCH  /api/events/:eventId/guests/:guestId
DELETE /api/events/:eventId/guests/:guestId
POST   /api/events/:eventId/guests/:guestId/generate-qr
```

Required actions:

- Create guest
- Search/list guests
- Read guest detail
- Update guest
- Archive/delete guest
- Generate QR token

---

### 7.6 Check-In Studio routes

```txt
GET    /api/events/:eventId/checkin/search
POST   /api/events/:eventId/checkin/verify-token
POST   /api/events/:eventId/checkin/guest/:guestId
POST   /api/events/:eventId/checkin/guest/:guestId/reverse
POST   /api/events/:eventId/checkin/table/:tableId/bulk
POST   /api/events/:eventId/checkin/walk-in
POST   /api/events/:eventId/checkin/replacement
GET    /api/events/:eventId/checkin/live-counts
```

Required actions:

- Search guests/tables
- Verify QR token
- Preview scan result
- Check in guest
- Reverse check-in
- Bulk check in table
- Add walk-in
- Add replacement
- Return live attendance counts

---

### 7.7 Check-in exception routes

```txt
POST   /api/events/:eventId/checkin/exceptions
GET    /api/events/:eventId/checkin/exceptions
PATCH  /api/events/:eventId/checkin/exceptions/:exceptionId
POST   /api/events/:eventId/checkin/exceptions/:exceptionId/resolve
POST   /api/events/:eventId/checkin/exceptions/:exceptionId/dismiss
```

Required actions:

- Create exception
- List open/resolved exceptions
- Update notes
- Resolve exception
- Dismiss exception

---

### 7.8 Event email routes

```txt
POST   /api/events/:eventId/emails/host-access
POST   /api/events/:eventId/emails/guest-invite
POST   /api/events/:eventId/emails/table-reminders
POST   /api/events/:eventId/emails/checkin-qr
GET    /api/events/:eventId/emails/logs
```

Required actions:

- Send host access email
- Send guest invite
- Send reminders
- Send QR/check-in email
- View email logs

---

## 8. Public TableLink User Flow

---

### 8.1 Admin creates table

Admin opens Event Studio → Tables.

Admin creates:

```txt
Table Name: Mercy Hospital Table
Capacity: 8
Host Name: Jane Doe
Host Email: jane@example.com
Sponsor: Mercy Hospital
```

Backend creates:

- EventTable
- tableUid
- publicCode
- EventTableSeat records from capacity

Admin can click:

```txt
Send Host Access Email
Copy Table Login Link
Open Public TableLink View
Lock Table
```

---

### 8.2 Host requests access

Public page:

```txt
/events/:eventSlug/table-login
```

Host enters:

```txt
TableKey
Email
```

Backend checks:

- Does this table exist for the event?
- Does the email match host email or approved host contact?
- Is the table open?
- Is access allowed?

Then backend sends a magic link.

---

### 8.3 Host manages table

Host portal:

```txt
Manage Your Table
Event: Love at First Beat Gala 2026
Table: Mercy Hospital Table
Seats: 4 of 8 filled
Status: Open
```

Allowed actions:

- Add guest manually
- Send guest invitation
- Copy guest invite link
- Edit guest they added
- Remove guest they added
- Leave seats empty
- Return later
- Submit final table roster

Host should not be forced to fill every guest at once.

---

### 8.4 Host sends guest invite

Host clicks:

```txt
Invite Guest
```

Host enters:

```txt
Email
Optional seat assignment
Optional note
```

Backend creates:

- EventGuestInvite
- tokenHash
- EventEmailLog
- queued/sent email

Seat status becomes:

```txt
invited
```

---

### 8.5 Guest completes information

Guest opens secure invite link.

Guest form should collect configurable fields, such as:

- First name
- Last name
- Email
- Phone
- Meal choice
- Dietary notes
- Accessibility needs
- RSVP confirmation

On submit:

- Validate token
- Validate event
- Validate invite status
- Create or update EventGuest
- Link guest to table/seat
- Mark invite completed
- Mark seat confirmed
- Send guest confirmation email if enabled

---

### 8.6 Admin locks table

Before the event, admins should be able to lock host edits.

Locked table behavior:

- Host can view roster
- Host cannot edit unless allowed
- Guest invite completion may be blocked or allowed depending on event settings
- Admin can override

---

## 9. Check-In Studio User Experience

Check-In Studio should be optimized for fast event-day use.

Main tabs:

```txt
Check-In Studio
  Scan
  Search
  Tables
  Exceptions
  Walk-Ins
  Live Count
```

---

### 9.1 Scan mode

QR scan flow:

1. Volunteer scans QR code.
2. Backend verifies signed token.
3. UI previews guest.
4. Volunteer taps **Check In**.
5. Backend creates EventCheckInRecord.

The scan should not instantly check in a guest.  
It should preview first to avoid mistakes.

Preview card:

```txt
John Smith
Mercy Hospital Table · Seat 4
Confirmed
Not Checked In

[Check In]
```

Already checked-in state:

```txt
John Smith
Mercy Hospital Table · Seat 4
Already checked in at 5:42 PM

[View Details]
```

---

### 9.2 Search mode

Search should support:

- First name
- Last name
- Email
- Phone
- Table name
- Table number
- Sponsor
- Confirmation status

Search result card:

```txt
John Smith
Mercy Hospital Table · Seat 4
Confirmed · Not Checked In
[Check In]
```

If duplicate names exist, show extra info:

```txt
John Smith
Mercy Hospital Table · Seat 4 · john@example.com
John Smith
LifeBridge Table · Seat 2 · john.smith@example.com
```

---

### 9.3 Table mode

Table mode is essential for galas.

The volunteer can search or select a table and see:

```txt
Mercy Hospital Table
6 of 8 guests confirmed
2 arrived

Seat 1 — Jane Doe — Arrived
Seat 2 — Mark Doe — Confirmed
Seat 3 — Emily Carter — Confirmed
Seat 4 — Invitation Pending
Seat 5 — Empty
Seat 6 — Empty
Seat 7 — Empty
Seat 8 — Empty
```

Actions:

- Check in individual guest
- Check in all present guests
- Add replacement guest
- Assign walk-in to empty seat
- Move guest to another table
- Mark seat empty
- Send to exception queue

---

### 9.4 Exception queue

Event-day problems should not block the main line.

Create an exception when:

- Guest cannot be found
- Guest claims a table but is not listed
- Guest was invited but never completed form
- Guest brought a replacement
- Duplicate name exists
- Guest appears on wrong table
- Guest has no ticket or no RSVP

Exception queue fields:

```txt
Guest name
Claimed table
Issue type
Notes
Status
Created by
Resolved by
```

Lead staff can resolve exceptions separately.

---

### 9.5 Walk-in and replacement guest flow

Support real gala situations.

Example:

```txt
“Sarah could not come, but David came instead.”
```

Required actions:

- Replace guest
- Add walk-in
- Assign to empty seat
- Assign to table
- Check in immediately
- Mark original guest cancelled or no-show
- Preserve audit trail

Replacement guest should have:

```txt
source: "replacement"
```

Walk-in guest should have:

```txt
source: "walk_in"
```

---

## 10. Reporting Requirements

Event Studio reports should show:

- Total expected guests
- Total confirmed guests
- Total checked in
- Total no-shows
- Total walk-ins
- Total replacement guests
- Open exceptions
- Resolved exceptions
- Table completion rate
- Sponsor attendance
- Guests by source
- Meal counts
- Dietary notes list
- Accessibility notes list
- Email sent/failed counts
- Table roster completion by table
- Check-in method breakdown

---

## 11. Email Templates

Create backend-driven templates for:

### Host access email

Subject:

```txt
Manage Your Event Table
```

Body concept:

```txt
You have been assigned a table for {{eventName}}.

Use the secure link below to manage your guest list, invite guests, and update attendee information.

[Manage My Table]
```

---

### Guest invitation email

Subject:

```txt
You’re Invited to {{eventName}}
```

Body concept:

```txt
You have been invited to sit at {{tableName}} for {{eventName}}.

Please confirm your information using the secure link below.

[Confirm My Information]
```

---

### Guest confirmation email

Subject:

```txt
Your RSVP Is Confirmed
```

Body concept:

```txt
Your information has been confirmed for {{eventName}}.

Table: {{tableName}}
Seat: {{seatNumberOptional}}

Please save this email for event check-in.
```

---

### Event-day QR email

Subject:

```txt
Your Check-In Pass for {{eventName}}
```

Body concept:

```txt
Please bring this QR code with you for faster check-in.

Event: {{eventName}}
Table: {{tableName}}
```

---

### Table roster reminder email

Subject:

```txt
Please Complete Your Table Roster
```

Body concept:

```txt
Your table for {{eventName}} is not complete yet.

Current status: {{confirmedSeats}} of {{capacity}} seats confirmed.

[Manage My Table]
```

---

## 12. Security Requirements

Implement these rules:

- Do not expose raw database IDs publicly.
- Do not store raw tokens.
- Hash all public access tokens.
- Expire magic links.
- Allow admins to revoke/regenerate links.
- Scope every query by event ID.
- Scope every host action to the assigned table.
- Validate that guest invite tokens belong to the correct event/table.
- Rate-limit public access request endpoints if possible.
- Log sensitive actions.
- Do not let guests edit other guests.
- Do not let table hosts manage other tables.
- Use server-side validation for every public form.

---

## 13. Public Portal Permissions

### Admin CRM user

Can:

- Create tables
- Edit all tables
- Assign hosts
- Regenerate TableKeys/access
- View all guests
- Move guests
- Lock tables
- Override capacity
- Send all emails
- Check in guests
- Resolve exceptions
- Export reports

### Table host

Can:

- View only assigned table
- Add guests to assigned table
- Invite guests to assigned table
- Edit guests they added, if unlocked
- Remove guests they added, if unlocked
- Submit table
- View table completion status

Cannot:

- View all event guests
- View other tables
- Export full event lists
- Access admin settings
- Override locked state

### Guest

Can:

- Open personal invite link
- Fill in their own info
- Confirm RSVP
- Possibly update their own information before deadline

Cannot:

- View the full table unless explicitly allowed
- Edit other guests
- Access admin pages
- Check themselves in without staff flow unless explicitly enabled

---

## 14. Frontend Admin UI Requirements

---

### 14.1 Tables dashboard

Show:

- Table name
- Sponsor/host
- Capacity
- Confirmed seats
- Invited seats
- Empty seats
- Status
- Last updated
- Email status
- Lock state

Actions:

- Create table
- Send host access
- Copy TableLink
- View roster
- Lock/unlock
- Export table roster

---

### 14.2 Table detail page

Show:

- Table identity
- TableKey/public code
- Host info
- Sponsor info
- Capacity
- Status
- Seat roster
- Guest invites
- Email history
- Check-in status
- Notes

Actions:

- Edit table
- Add guest
- Invite guest
- Move guest
- Remove guest
- Regenerate host access
- Lock table
- Open public TableLink view

---

### 14.3 Guest detail page

Show:

- Guest name
- Contact info
- Table/seat
- Status
- Source
- Invite history
- Email history
- QR token status
- Check-in records
- Notes

Actions:

- Edit guest
- Move table/seat
- Generate QR
- Send confirmation
- Check in
- Reverse check-in
- Mark cancelled/no-show

---

### 14.4 Check-In Studio UI

Tabs:

- Scan
- Search
- Tables
- Exceptions
- Walk-Ins
- Live Count

Design should be fast, large, and volunteer-friendly.

Avoid tiny table rows as the primary event-day interface.  
Use large cards and clear state labels.

---

## 15. Public TableLink UI Requirements

The TableLink portal should feel simpler than the admin CRM.

Recommended layout:

```txt
Header:
  Event name
  Table name
  Seats filled / capacity
  Status badge

Main:
  Seat list
  Add guest button
  Invite guest button
  Copy invite link button

Footer:
  Save changes
  Submit final roster
  Contact event organizer
```

Seat states:

```txt
Empty
Invited
Confirmed
Needs Info
Submitted
Checked In
```

Host should be able to save partial progress.

---

## 16. Guest Self-Entry UI Requirements

Guest invite form should be simple.

Fields:

- First name
- Last name
- Email
- Phone
- RSVP status
- Meal choice, if enabled
- Dietary notes, if enabled
- Accessibility needs, if enabled

After completion, show:

```txt
Thank you. Your information has been confirmed.
```

If QR is enabled, show or email QR code.

Expired link state:

```txt
This invitation link has expired. Please contact your table host or event organizer.
```

Already completed state:

```txt
Your information has already been submitted.
```

---

## 17. Migration / Integration With Current Architecture

Agents must inspect the current OyamaCRM architecture before implementation.

Specifically check:

- Current Event CRM data models
- Current event scoping pattern
- Current guest/ticket records
- Current public page routes
- Current email sending service
- Current auth/session implementation
- Current admin role system
- Current table or seating chart code
- Current check-in implementation
- Current API conventions
- Current seed/demo data patterns
- Current tests and Playwright setup

Do not duplicate existing systems unnecessarily.  
Extend or migrate them cleanly.

If an existing guest/ticket/table model already exists, map this plan onto it.

---

## 18. Implementation Phases

---

### Phase 1 — Audit and planning

Tasks:

- Audit current Event CRM / Event Studio files.
- Identify existing event, ticket, guest, table, seating chart, and check-in models.
- Identify current backend route patterns.
- Identify email service or missing email service.
- Identify auth and permission patterns.
- Write notes into an implementation document.
- Update `AGENTS.md` with the active plan.

Deliverables:

- Current architecture notes
- Model mapping notes
- Implementation checklist
- Risks and unknowns list

---

### Phase 2 — Backend models and migrations

Tasks:

- Add or update database models.
- Add migrations.
- Add event-scoped indexes.
- Add unique constraints where needed.
- Add secure token hash fields.
- Add status enums.
- Add audit timestamps.

Important constraints:

- `publicCode` should be unique within an event or globally.
- `tableUid` should be globally unique.
- Seat number should be unique per table.
- Check-in records should support multiple records but only one active checked-in state per guest.
- Invite tokens should be hashed.

Deliverables:

- Database migration
- Updated ORM schema
- Seed data support
- Model documentation

---

### Phase 3 — Backend services

Tasks:

- Implement eventTableService.
- Implement eventSeatService.
- Implement tableLinkAccessService.
- Implement guestInviteService.
- Implement eventGuestService.
- Implement eventEmailService.
- Implement checkInService.
- Implement checkInExceptionService.
- Implement eventReportingService.

Deliverables:

- Backend service files
- Unit tests where possible
- Clear error handling
- Logging for important actions

---

### Phase 4 — API routes

Tasks:

- Add table routes.
- Add seat routes.
- Add TableLink routes.
- Add guest invite routes.
- Add check-in routes.
- Add exception routes.
- Add email routes.
- Add report routes if needed.

Deliverables:

- API routes
- Request validation
- Permission checks
- Event scoping checks
- Tests for critical routes

---

### Phase 5 — Admin Event Studio UI

Tasks:

- Build Tables dashboard.
- Build table detail page.
- Add seat roster UI.
- Add host access controls.
- Add guest invite controls.
- Add email history view.
- Add lock/unlock controls.
- Add reporting widgets.

Deliverables:

- Admin table management UI
- Table detail UI
- Seat roster UI
- Email/status UI
- Locking controls

---

### Phase 6 — Public TableLink portal

Tasks:

- Build table login page.
- Build access request flow.
- Build magic-link verification flow.
- Build host table management view.
- Add guest manual entry.
- Add guest invitation flow.
- Add partial save behavior.
- Add final submit behavior.
- Add locked-state behavior.

Deliverables:

- Public TableLink login
- Host portal
- Invite guest flow
- Save/resume behavior
- Mobile-friendly layout

---

### Phase 7 — Guest self-entry flow

Tasks:

- Build guest invite landing page.
- Build guest form.
- Validate invite token.
- Mark invite opened.
- Complete invite.
- Create/update guest.
- Send confirmation email.
- Handle expired/completed/cancelled invite states.

Deliverables:

- Guest self-entry form
- Invite status handling
- Confirmation behavior
- Mobile-friendly layout

---

### Phase 8 — Check-In Studio redesign

Tasks:

- Build Scan mode.
- Build Search mode.
- Build Table mode.
- Build Walk-In mode.
- Build Replacement Guest flow.
- Build Exception Queue.
- Build Live Count dashboard.
- Add duplicate check-in warnings.
- Add reverse check-in action.
- Add fast volunteer-friendly card UI.

Deliverables:

- Full Check-In Studio
- QR scan preview flow
- Search check-in
- Table check-in
- Walk-in/replacement handling
- Exception queue
- Live counts

---

### Phase 9 — Reporting and exports

Status: Done (2026-05-18)

Tasks:

- Done: Add attendance reports.
- Done: Add table completion reports.
- Done: Add meal count reports.
- Done: Add exception reports.
- Done: Add email delivery reports.
- Done: Add sponsor/table attendance reports.
- Done: Add CSV export where appropriate.

Deliverables:

- Reports dashboard
- CSV exports
- Post-event attendance summary

Implementation notes:

- Added `GET /api/events/:eventId/reporting/snapshot` and `GET /api/events/:eventId/reporting/export/:reportType`.
- Wired the reports detail UI to show Phase 9 snapshot cards, meal counts, email delivery, sponsor/table attendance, and export actions.
- Validated with `pnpm build`, `pnpm typecheck:web`, and `pnpm typecheck:server`.

---

### Phase 10 — Testing and documentation

Tasks:

- Add seed data for large test events.
- Add unit tests for services.
- Add API tests for public tokens and permissions.
- Add E2E tests for host and guest flows.
- Add E2E tests for check-in flows.
- Add tests for duplicate check-in prevention.
- Add tests for locked tables.
- Add tests for expired/cancelled tokens.
- Update HOW_TO_USE documentation.
- Update screenshots if the project uses screenshot docs.
- Update readiness reports.

Deliverables:

- Tests
- Documentation
- Updated AGENTS.md
- Updated HOW_TO_USE.md
- Updated readiness report

---

## 19. Demo Seed Data Requirements

Create demo data that reflects a real gala.

Include:

- One event
- 20+ tables
- Sponsors
- Table hosts
- Tables with mixed statuses
- Full tables
- Partially filled tables
- Empty tables
- Invited guests
- Confirmed guests
- Expired invites
- Cancelled guests
- Walk-ins
- Replacement guests
- Checked-in guests
- Duplicate name examples
- Meal choices
- Dietary notes
- Open exceptions
- Resolved exceptions
- Email logs

This is necessary for testing realistic UI states.

---

## 20. Acceptance Criteria

The feature is not complete until all of these are true.

### Backend

- Tables are stored in the backend.
- Tables have stable universal IDs.
- Public codes do not expose database IDs.
- Magic links use hashed tokens.
- Guests, seats, invites, and check-ins are event-scoped.
- Check-in creates audit records.
- Duplicate check-ins are detected.
- Walk-ins and replacements create real records.
- Public routes validate access correctly.

### Admin UI

- Admin can create and manage tables.
- Admin can assign hosts.
- Admin can send host access emails.
- Admin can manage table seats and guests.
- Admin can lock/unlock tables.
- Admin can view invite status.
- Admin can view email history.
- Admin can use Check-In Studio.
- Admin can see reports.

### Public TableLink

- Host can request access with TableKey and email.
- Host receives secure magic link.
- Host can manage only their table.
- Host can save partial roster progress.
- Host can invite guests.
- Host can submit final roster.
- Locked table behavior works.

### Guest self-entry

- Guest can open invite link.
- Guest can fill in their own information.
- Invite status updates.
- Guest record is created/updated.
- Seat status updates.
- Expired/cancelled/completed states are handled.

### Check-In Studio

- QR scan previews guest before check-in.
- Search check-in works.
- Table check-in works.
- Duplicate check-ins are blocked or warned.
- Walk-ins can be added.
- Replacement guests can be added.
- Exceptions can be created and resolved.
- Live counts update correctly.

### Reporting

- Expected guests are counted.
- Confirmed guests are counted.
- Checked-in guests are counted.
- No-shows are identifiable.
- Walk-ins are counted.
- Table completion rate is shown.
- Meal counts are available.
- Open exceptions are visible.

---

## 21. Edge Cases to Handle

Agents must explicitly handle these cases:

- Host enters wrong TableKey.
- Host enters right TableKey but wrong email.
- Host magic link expired.
- Guest invite expired.
- Guest invite already completed.
- Guest opens cancelled invite.
- Table is locked.
- Host tries to exceed table capacity.
- Host tries to edit another table.
- Guest tries to access another guest invite.
- Admin changes table capacity after guests are assigned.
- Duplicate guest name appears.
- Guest is checked in twice.
- Wrong guest is checked in and needs reversal.
- Guest claims they are at a table but is not listed.
- Guest comes as replacement for another guest.
- Walk-in arrives without table.
- Table host never finishes roster.
- Email fails to send.
- QR token is invalid.
- QR token belongs to a different event.

---

## 22. Suggested UI Wording

Use clear labels.

### Table statuses

```txt
Draft
Open
Submitted
Locked
Event Day
Archived
```

### Seat statuses

```txt
Empty
Reserved
Invited
Confirmed
Checked In
Cancelled
```

### Host buttons

```txt
Add Guest
Invite Guest
Copy Invite Link
Save Progress
Submit Final Roster
Contact Organizer
```

### Admin buttons

```txt
Create Table
Send Host Access
Copy TableLink
Regenerate Access
Lock Table
Unlock Table
Open Public View
Export Roster
```

### Check-in buttons

```txt
Check In
Already Checked In
Reverse Check-In
Add Walk-In
Replace Guest
Send to Exception Queue
Resolve Exception
```

---

## 23. Recommended Copilot / Agent Prompt

Use this prompt to start implementation:

```txt
Implement the OyamaCRM Event Studio TableLink and Check-In Studio redesign as a backend-backed production feature. First audit the current Event CRM architecture, models, routes, UI, auth, email service, check-in flow, table/seating logic, tests, and documentation. Map this plan onto the existing architecture instead of duplicating systems unnecessarily. Update AGENTS.md with the active plan, feature status, risks, and implementation checklist.

Build TableLink so every event table has a private internal database ID, eventId, stable tableUid, human-friendly public TableKey/publicCode, host contact fields, capacity, status, and numbered seats. Do not expose raw database IDs publicly. Use secure hashed magic-link tokens for host access. Table hosts should be able to request access from a public table login page, receive a secure email link, manage only their assigned table, add guests manually, invite guests by email, leave seats empty, save partial progress, return later, and submit the final roster. Guests should be able to open a secure invite link and fill in their own information without seeing or editing the entire table.

Redesign check-in into Check-In Studio with QR scan mode, fast search, table roster mode, walk-ins, replacement guests, exception queue, and live counts. QR scans should preview the guest before check-in. Check-in must create EventCheckInRecord audit records instead of only setting a checkbox. Duplicate check-ins must be detected. Reversals must preserve history. Add backend services, API routes, admin UI, public TableLink UI, guest self-entry UI, email logging, reports, seed data, tests, HOW_TO_USE documentation, and readiness updates. Keep every operation event-scoped and secure.
```

---

## 24. Final Notes for Agents

- Keep the system modular.
- Avoid hard-coding one event.
- Use event settings for optional fields like meal choice and dietary notes.
- Keep public pages simple and mobile-friendly.
- Keep admin pages powerful but understandable.
- Optimize Check-In Studio for speed and clarity.
- Use clear status badges everywhere.
- Preserve audit history.
- Do not use raw database IDs in public URLs.
- Mark incomplete features clearly in AGENTS.md until done.
- Add warnings/popups for partially implemented tabs if any UI is added before the backend is complete.
