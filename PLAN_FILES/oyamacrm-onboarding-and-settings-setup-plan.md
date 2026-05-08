# OyamaCRM Onboarding and Settings Setup Plan

## Purpose

This document defines the browser-based first-run onboarding system for OyamaCRM and the improved Settings workspace. The goal is to make a fresh install feel polished, minimal, and powerful. When the application is first opened, the user should be guided through setup in the browser, and the setup flow should bootstrap the organization, branding, first admin user, workspaces, roles, permission scopes, and default CRM settings.

This setup must support both:

- **OyamaCRM** — the donor and nonprofit CRM workspace
- **OyamaCRM-Compassion** — the client-services CRM workspace

The onboarding system should be simple enough for a nontechnical ministry or nonprofit staff member, but strong enough to create the correct database foundation for real production use.

---

# 1. First-Run Setup Principle

OyamaCRM should detect whether setup has been completed before showing normal login or dashboard screens.

## Audit update — 2026-05-08

- [x] Setup status API exists — verified in `server/src/routes/setup.ts`.
- [x] Login redirects to `/setup` when setup is incomplete — verified in `app/login/page.tsx`.
- [x] Browser-based setup wizard exists — verified in `app/setup/page.tsx`.
- [~] Settings workspace foundation exists — `app/settings/layout.tsx`, `app/components/settings/SettingsSidebar.tsx`.
- [~] Settings → System and Settings → System Status now provide version and readiness visibility.
- [ ] Users, roles/scopes, workspace access management, and most settings tabs are still not implemented beyond placeholders.

Expected behavior:

```text
App boots
↓
Server checks setup status
↓
If setup is incomplete → redirect to /setup
↓
If setup is complete → continue to login or dashboard
```

The setup flow must run in the browser and should not require the user to manually seed the database from the command line.

---

# 2. Setup Detection

## Required API Endpoint

```text
GET /api/setup/status
```

Example response before setup:

```json
{
  "success": true,
  "data": {
    "setupCompleted": false,
    "setupCompletedAt": null
  },
  "meta": {}
}
```

Example response after setup:

```json
{
  "success": true,
  "data": {
    "setupCompleted": true,
    "setupCompletedAt": "2026-05-07T12:00:00.000Z"
  },
  "meta": {}
}
```

## Suggested Table

```sql
CREATE TABLE system_settings (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  setting_key VARCHAR(191) NOT NULL UNIQUE,
  setting_value JSON NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);
```

Required setting keys:

```text
setup_completed
setup_completed_at
setup_version
```

---

# 3. Setup Route Structure

## Main Route

```text
/setup
```

The MVP can use one route with internal wizard steps.

Optional future routes:

```text
/setup/welcome
/setup/organization
/setup/branding
/setup/workspaces
/setup/admin-user
/setup/defaults
/setup/review
/setup/complete
```

## Setup Route Protection

Before setup is completed:

- `/setup` is available.
- Normal app routes redirect to `/setup`.

After setup is completed:

- `/setup` is not publicly available.
- Setup API endpoints reject public access.
- Only Super Admin recovery mode can re-open setup-like configuration.

---

# 4. Setup Wizard UI

The setup wizard should feel calm, minimal, and professional.

Recommended layout:

```text
Centered card or two-column layout
Soft light background
Small OyamaCRM logo/title
Progress indicator
One step at a time
Clear Back and Continue buttons
Final Review and Complete Setup button
```

Progress steps:

```text
1. Welcome
2. Organization
3. Branding
4. Workspaces
5. Admin User
6. Defaults
7. Review
```

Avoid overwhelming the user with too many settings. Advanced configuration belongs in Settings after setup.

---

# 5. Step 1 — Welcome

Purpose: introduce what setup will do.

Suggested copy:

```text
Welcome to OyamaCRM.

This setup will prepare your organization profile, create your first admin user, configure your workspaces, and get your CRM ready for daily use.

You can update these settings later from the Settings panel.
```

Fields: none.

Primary button:

```text
Get Started
```

---

# 6. Step 2 — Organization Information

Collect the core organization record.

## Fields

Required:

```text
Organization Name
Organization Type
Primary Contact Name
Primary Contact Email
Primary Phone
Timezone
```

Optional but recommended:

```text
Website
Address Line 1
Address Line 2
City
State
ZIP / Postal Code
Country
```

## Organization Type Options

```text
Pregnancy Care Center
Nonprofit
Church / Ministry
Community Resource Center
Medical / Care Organization
Other
```

## Suggested Table

```sql
CREATE TABLE organizations (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(191) NOT NULL,
  organization_type VARCHAR(100) NULL,
  primary_contact_name VARCHAR(191) NULL,
  primary_contact_email VARCHAR(191) NULL,
  primary_phone VARCHAR(50) NULL,
  website VARCHAR(255) NULL,
  address_line_1 VARCHAR(191) NULL,
  address_line_2 VARCHAR(191) NULL,
  city VARCHAR(100) NULL,
  state VARCHAR(100) NULL,
  postal_code VARCHAR(50) NULL,
  country VARCHAR(100) NULL,
  timezone VARCHAR(100) NOT NULL DEFAULT 'America/Chicago',
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);
```

---

# 7. Step 3 — Branding

Collect simple branding information.

## Fields

```text
Logo Upload
Primary Color
Accent Color
Organization Short Name
Public Display Name
Default Email From Name
Default Email From Address
```

## Default Visual Direction

```text
Theme: light
Primary color: soft green
Accent color: teal or warm gold
```

Branding should be used by:

- Main dashboard
- Login screen
- Email templates
- Printed templates
- Public scheduling pages
- Embeddable scheduling widgets
- Donation forms
- Client scheduling forms

## Suggested Table

```sql
CREATE TABLE organization_branding (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT NOT NULL,
  logo_url TEXT NULL,
  primary_color VARCHAR(20) NULL,
  accent_color VARCHAR(20) NULL,
  short_name VARCHAR(100) NULL,
  public_display_name VARCHAR(191) NULL,
  default_from_name VARCHAR(191) NULL,
  default_from_email VARCHAR(191) NULL,
  theme_mode VARCHAR(50) DEFAULT 'light',
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);
```

---

# 8. Step 4 — Workspace Selection

The setup wizard should ask which workspaces to enable.

## Options

```text
OyamaCRM — Donor & nonprofit CRM
OyamaCRM-Compassion — Client-care CRM
```

Default:

```text
Both enabled
```

## Explanation Copy

```text
OyamaCRM manages donors, gifts, campaigns, receipts, communications, events, volunteers, and fundraising reports.

OyamaCRM-Compassion manages clients, appointments, client files, intake forms, services, referrals, resources, and care follow-up.
```

## Required Behavior

When setup is completed:

- Create workspace records.
- Enable selected workspaces.
- Seed default workspace-specific permissions.
- Prepare workspace-aware navigation.
- Assign the first Super Admin to all enabled workspaces.

## Suggested Table

```sql
CREATE TABLE workspaces (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT NOT NULL,
  workspace_key VARCHAR(100) NOT NULL,
  display_name VARCHAR(191) NOT NULL,
  description TEXT NULL,
  is_enabled BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);
```

Default records:

```text
DONOR / oyamacrm / OyamaCRM
COMPASSION / oyamacrm_compassion / OyamaCRM-Compassion
```

---

# 9. Step 5 — First Admin User

The setup wizard must create the first Super Admin user.

## Fields

```text
First Name
Last Name
Email
Password
Confirm Password
Phone
Job Title
```

## Required Rules

- Hash password securely.
- Do not store plain text passwords.
- Require strong password.
- First admin receives Super Admin role.
- First admin receives all enabled workspaces.
- First admin receives all permission scopes.

## Suggested Table

```sql
CREATE TABLE users (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  organization_id BIGINT NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(191) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  phone VARCHAR(50) NULL,
  job_title VARCHAR(100) NULL,
  status VARCHAR(50) DEFAULT 'active',
  last_login_at TIMESTAMP NULL,
  created_at TIMESTAMP NULL,
  updated_at TIMESTAMP NULL
);
```

---

# 10. Step 6 — Defaults

Keep this step simple. The goal is not to make the user configure every part of the CRM. The goal is to seed practical defaults.

## Default Donor Settings

Seed:

```text
Prospect
Active Donor
Monthly Donor
Lapsed Donor
Major Donor
Church Partner
Business Partner
Archived
Do Not Contact
```

Seed default gift/payment methods:

```text
Check
Cash
Credit Card
ACH
Online Donation
In-Kind
Event Payment
Sponsorship Payment
```

Seed default donor task types:

```text
Thank-you call
Print receipt
Mail thank-you letter
Send follow-up email
Invite to monthly giving
Schedule meeting
Pledge reminder
Lapsed donor follow-up
Data cleanup
```

## Default Compassion Settings

Seed client statuses:

```text
New
Active
Needs Follow-Up
Scheduled
Completed
Inactive
Archived
```

Seed appointment statuses:

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

Seed file categories:

```text
Intake
Consent
Appointment
Ultrasound
Pregnancy Test
Material Assistance
Education
Referral
Case Notes
Other
```

Seed service types:

```text
Pregnancy Test
Ultrasound
Options Consultation
Parenting Class
Material Assistance
Diapers
Clothing
Nutrition Support
Housing Resource
GED / HiSET Resource
Job Resource
Referral
Follow-Up
```

Seed resource categories:

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

## Default Scheduling Settings

Collect or seed:

```text
Timezone
Main location
Default office hours
Default appointment duration
Default reminder timing
Cancellation window
No-show follow-up task rule
```

Advanced scheduling setup belongs in Settings.

---

# 11. Step 7 — Review and Complete Setup

Show a final review page.

Review sections:

```text
Organization
Branding
Enabled Workspaces
Admin User
Default Roles
Default Settings
```

Button:

```text
Complete Setup
```

On submit, call:

```text
POST /api/setup/complete
```

---

# 12. Setup Completion Payload Example

```json
{
  "organization": {
    "name": "The Pregnancy Care Center",
    "organizationType": "Pregnancy Care Center",
    "primaryContactName": "Director Name",
    "primaryContactEmail": "contact@example.com",
    "primaryPhone": "417-000-0000",
    "website": "https://www.example.com",
    "addressLine1": "123 Main Street",
    "city": "Aurora",
    "state": "MO",
    "postalCode": "65605",
    "country": "United States",
    "timezone": "America/Chicago"
  },
  "branding": {
    "primaryColor": "#2F7D5A",
    "accentColor": "#4CA6A8",
    "themeMode": "light",
    "publicDisplayName": "The Pregnancy Care Center",
    "defaultFromName": "The Pregnancy Care Center",
    "defaultFromEmail": "contact@example.com"
  },
  "workspaces": {
    "oyamacrm": true,
    "oyamacrmCompassion": true
  },
  "adminUser": {
    "firstName": "Admin",
    "lastName": "User",
    "email": "admin@example.com",
    "password": "secure-password",
    "phone": "417-000-0000",
    "jobTitle": "Administrator"
  }
}
```

---

# 13. Setup Complete Behavior

When setup completes:

```text
Create organization record
Create branding record
Create workspace records
Create first admin user
Create default roles
Create default permissions
Assign admin to Super Admin
Assign admin to all enabled workspaces
Seed default donor settings
Seed default Compassion settings
Seed default scheduling settings
Write setup audit log
Mark setup_completed = true
Mark setup_completed_at
Redirect to login or dashboard
```

Suggested final message:

```text
Your OyamaCRM workspace is ready.

You can now begin adding donors, clients, appointments, users, and scheduling pages. You can change these settings at any time from the Settings panel.
```

---

# 14. Roles and Permission Scopes

## Default Roles

```text
Super Admin
Director
Donor CRM Manager
Client Services Manager
Scheduler
Advocate
Medical Staff
Volunteer
Board Viewer
Read Only
```

## Permission Categories

```text
settings
users
roles
workspaces
donor
gifts
campaigns
communications
reports
compassion
compassion.clients
compassion.files
compassion.notes
compassion.appointments
compassion.scheduling
compassion.forms
compassion.resources
compassion.reports
security
integrations
system
```

## Example Permission Keys

```text
settings.view
settings.manage
users.view
users.create
users.edit
users.disable
roles.view
roles.manage
workspaces.view
workspaces.manage

donor.view
donor.create
donor.edit
donor.delete
donor.export

gifts.view
gifts.create
gifts.edit
gifts.delete

campaigns.view
campaigns.manage
communications.manage
reports.donor.view
reports.donor.export

compassion.view
compassion.clients.view
compassion.clients.create
compassion.clients.edit
compassion.clients.archive
compassion.files.view
compassion.files.upload
compassion.files.download
compassion.files.delete
compassion.notes.view
compassion.notes.create
compassion.notes.edit
compassion.notes.delete
compassion.appointments.view
compassion.appointments.create
compassion.appointments.edit
compassion.appointments.cancel
compassion.scheduling.manage
compassion.forms.manage
compassion.resources.manage
compassion.reports.view
compassion.reports.export

security.manage
integrations.manage
system.audit.view
system.health.view
```

---

# 15. Workspace Access Logic

A user must have both:

```text
Workspace access
Permission scope
```

Example:

```ts
function canAccess(user, workspace, permission) {
  return user.workspaces.includes(workspace)
    && user.permissions.includes(permission);
}
```

Important rule:

```text
A user should not automatically receive Compassion/client access just because they have donor CRM access.
```

---

# 16. Settings Workspace

After setup, all configuration should live in `/settings`.

## Settings Route Structure

```text
/settings
/settings/organization
/settings/branding
/settings/users
/settings/roles
/settings/workspaces
/settings/donor
/settings/compassion
/settings/scheduling
/settings/forms
/settings/email
/settings/integrations
/settings/security
/settings/import-export
/settings/audit
/settings/system
```

## Settings Layout

```text
Main App Shell
└── Settings Workspace
    ├── Settings Sidebar
    │   ├── Organization
    │   ├── Branding
    │   ├── Users
    │   ├── Roles & Scopes
    │   ├── Workspaces
    │   ├── Donor CRM
    │   ├── Compassion CRM
    │   ├── Scheduling
    │   ├── Forms
    │   ├── Email & Messaging
    │   ├── Integrations
    │   ├── Security
    │   ├── Data Import / Export
    │   ├── Audit Logs
    │   └── System
    └── Settings Content Panel
```

The Settings sidebar is not the same as the main app sidebar. It is a secondary navigation area specifically for configuration.

---

# 17. Settings Tabs

## Organization

Manage:

```text
Organization name
Organization type
Primary contact
Phone
Website
Address
Timezone
Fiscal year start
Default currency
```

## Branding

Manage:

```text
Logo
Primary color
Accent color
Theme preference
Public display name
Email header logo
Scheduling-page branding
Embed widget branding
```

## Users

Manage:

```text
View users
Add new user
Edit user
Disable user
Reset password
Send invite
Assign roles
Assign workspace access
Assign custom scopes
View last login
View account status
View effective permissions
```

## Roles & Scopes

Manage:

```text
View roles
Create custom role
Edit role permissions
Duplicate role
Disable custom role
View permission matrix
```

## Workspaces

Manage:

```text
Enable or disable OyamaCRM
Enable or disable OyamaCRM-Compassion
Default workspace after login
Workspace display names
Workspace descriptions
Workspace access rules
```

## Donor CRM

Manage:

```text
Donor statuses
Gift categories
Campaign defaults
Receipt templates
Donor tags
Communication preferences
Default donor thresholds
```

## Compassion CRM

Manage:

```text
Client statuses
Service types
Visit types
File categories
Note categories
Referral categories
Material assistance categories
Client privacy settings
```

## Scheduling

Manage:

```text
Appointment types
Locations
Rooms
Staff availability
Office hours
Holiday closures
Reminder rules
Cancellation rules
No-show rules
Public scheduling pages
Embed widget defaults
```

## Forms

Manage:

```text
Intake forms
Consent forms
Appointment request forms
Material assistance forms
Staff-only forms
Published forms
Form templates
Conditional logic
```

## Email & Messaging

Manage:

```text
SMTP settings
Default from name
Default from email
Email templates
SMS provider settings
Reminder templates
Confirmation templates
Follow-up templates
```

## Integrations

Manage:

```text
Payment provider
Email provider
SMS provider
Calendar sync
Accounting export
Website embeds
AI provider
Local GPU endpoint
```

## Security

Manage:

```text
Password policy
Two-factor authentication
Session timeout
Allowed login domains
IP restrictions if needed
Failed login lockout
Sensitive client-data access rules
```

## Data Import / Export

Manage:

```text
Import donors
Import clients
Import gifts
Import appointments
Export reports
Export donor data
Export client data with permission
Backup tools
```

## Audit Logs

Show:

```text
User login history
Settings changes
Client record views
File downloads
Role changes
Export activity
Deleted records
Failed access attempts
AI access events
```

## System

Show:

```text
App version
Database status
Queue status
Email status
Storage status
AI service status
Scheduler service status
Background jobs
Environment mode
```

---

# 18. Add New User Flow

Route:

```text
/settings/users/new
```

Or modal from:

```text
Settings → Users → Add User
```

## Basic Info

```text
First Name
Last Name
Email
Phone
Job Title
```

## Workspace Access

Checkboxes:

```text
OyamaCRM
OyamaCRM-Compassion
Settings
Reports
```

## Role Assignment

Dropdown or multi-select:

```text
Super Admin
Director
Donor CRM Manager
Client Services Manager
Scheduler
Advocate
Medical Staff
Volunteer
Board Viewer
Read Only
Custom Role
```

## Advanced Permission Scope Override

Options:

```text
Use role defaults
Customize permissions for this user
```

If customized, show permission matrix grouped by category.

## Account Setup

Options:

```text
Send invitation email
Set temporary password
Require password reset on first login
Require two-factor setup
```

## Save Behavior

When a user is created:

```text
Create user record
Assign organization_id
Assign selected roles
Assign workspace access
Assign permission overrides if any
Send invitation email if enabled
Write audit log entry
```

---

# 19. Backend Endpoints

## Setup

```text
GET  /api/setup/status
POST /api/setup/complete
```

Optional step-saving endpoints:

```text
POST /api/setup/organization
POST /api/setup/branding
POST /api/setup/workspaces
POST /api/setup/admin-user
POST /api/setup/defaults
```

## Settings

```text
GET  /api/settings/organization
PUT  /api/settings/organization
GET  /api/settings/branding
PUT  /api/settings/branding
GET  /api/settings/workspaces
PUT  /api/settings/workspaces
GET  /api/settings/system
```

## Users

```text
GET    /api/users
POST   /api/users
GET    /api/users/:id
PATCH  /api/users/:id
POST   /api/users/:id/disable
POST   /api/users/:id/invite
POST   /api/users/:id/reset-password
GET    /api/users/:id/effective-permissions
```

## Roles and Permissions

```text
GET    /api/roles
POST   /api/roles
GET    /api/roles/:id
PATCH  /api/roles/:id
DELETE /api/roles/:id
GET    /api/permissions
GET    /api/permission-categories
```

---

# 20. Permission Middleware Requirements

Create middleware:

```text
requireAuth
requirePermission
requireWorkspace
requireWorkspacePermission
```

Example route protection:

```text
GET /api/settings/organization
requires settings.view

PUT /api/settings/organization
requires settings.manage

GET /api/users
requires users.view

POST /api/users
requires users.create

PATCH /api/users/:id
requires users.edit

GET /api/compassion/clients
requires COMPASSION workspace + compassion.clients.view

GET /api/compassion/client-files/:id
requires COMPASSION workspace + compassion.files.view
```

---

# 21. Audit Requirements

Write audit logs for:

```text
Setup completed
Organization settings changed
Branding changed
Workspace enabled/disabled
User created
User edited
User disabled
Password reset sent
Role assigned
Role removed
Permission override changed
Security setting changed
Integration setting changed
```

Audit log fields:

```text
User ID
Workspace
Action type
Entity type
Entity ID
Timestamp
IP address if available
Browser/user agent if available
Before/after data when appropriate
Reason/comment when appropriate
```

---

# 22. Recovery and Safety Rules

## Do Not Allow Public Setup Twice

Once setup is complete, the public setup wizard must not be available.

## Super Admin Recovery Mode

Create a future-safe path for Super Admins to adjust bootstrap-level settings from the Settings workspace.

Possible route:

```text
/settings/system/recovery
```

This should require:

```text
Super Admin role
Recent password confirmation
Optional 2FA confirmation
Audit log entry
```

## Do Not Delete First Admin Accidentally

Prevent disabling or deleting the last active Super Admin.

## Do Not Disable All Workspaces

At least one workspace must remain enabled.

## Do Not Remove Own Critical Access Accidentally

Warn before a Super Admin removes their own Super Admin role, Settings access, or active workspace access.

---

# 23. Frontend Components

Suggested components:

```text
SetupWizard
SetupProgress
SetupStepWelcome
SetupStepOrganization
SetupStepBranding
SetupStepWorkspaces
SetupStepAdminUser
SetupStepDefaults
SetupStepReview

SettingsLayout
SettingsSidebar
SettingsSectionHeader
SettingsCard

UserTable
UserForm
UserInviteModal
WorkspaceAccessSelector
RoleSelector
PermissionMatrix
EffectivePermissionsPanel

OrganizationSettingsForm
BrandingSettingsForm
WorkspaceSettingsForm
SecuritySettingsForm
SystemStatusPanel
```

---

# 24. Backend Services

Suggested services:

```text
SetupService
SettingsService
OrganizationService
BrandingService
WorkspaceService
UserService
RoleService
PermissionService
AuditService
SeedDefaultsService
SecurityService
```

Setup completion should use a transaction where possible.

Pseudo-flow:

```ts
await db.transaction(async (tx) => {
  const org = await OrganizationService.create(tx, payload.organization);
  await BrandingService.create(tx, org.id, payload.branding);
  const workspaces = await WorkspaceService.seed(tx, org.id, payload.workspaces);
  await PermissionService.seedDefaults(tx);
  const roles = await RoleService.seedDefaults(tx, org.id);
  const admin = await UserService.createFirstAdmin(tx, org.id, payload.adminUser);
  await UserService.assignRole(tx, admin.id, roles.superAdmin.id);
  await UserService.assignWorkspaces(tx, admin.id, workspaces.enabled);
  await SeedDefaultsService.seedOrganizationDefaults(tx, org.id, workspaces.enabled);
  await SettingsService.set(tx, "setup_completed", true);
  await SettingsService.set(tx, "setup_completed_at", new Date().toISOString());
  await AuditService.log(tx, { action: "setup.completed", entityType: "organization", entityId: org.id });
});
```

---

# 25. Acceptance Criteria

This feature is complete when:

```text
A fresh install automatically opens the setup wizard.
The setup wizard collects organization information.
The setup wizard collects basic branding.
The setup wizard enables OyamaCRM and/or OyamaCRM-Compassion.
The setup wizard creates the first Super Admin user.
The setup wizard creates default roles and permissions.
The setup wizard seeds default donor, client, and scheduling settings.
The setup wizard stores setup_completed.
After setup, users are sent to login or dashboard.
The public setup wizard cannot run a second time.
The Settings area has its own sidebar of tabs.
The Users settings page can add, edit, disable, and view users.
Users can be assigned roles.
Users can be assigned workspace access.
Users can be assigned permission scopes.
The backend enforces permission scopes.
Sensitive Compassion data is not visible to users without permission.
All setup, user, role, and settings changes are written to audit logs.
The UI remains minimal, clean, calm, and easy to understand.
```

---

# 26. Agent Task List

## Task 1: Add Setup Status Check

Build `GET /api/setup/status` and redirect logic for unconfigured installs.

## Task 2: Build Setup Wizard UI

Build `/setup` with the seven setup steps.

## Task 3: Build Setup Completion Endpoint

Build `POST /api/setup/complete` with validation and transactional creation.

## Task 4: Add Organization and Branding Storage

Create or update schema for organization and branding records.

## Task 5: Add Workspace Seed Logic

Seed OyamaCRM and OyamaCRM-Compassion workspaces.

## Task 6: Add Role and Permission Seed Logic

Create default roles and permission scopes.

## Task 7: Create First Admin Flow

Allow setup to create the first Super Admin.

## Task 8: Build Settings Layout

Create `/settings` with its own internal sidebar.

## Task 9: Build Users Settings Page

Add user table, add/edit forms, disable, invite, reset password placeholder, workspace access, and role assignment.

## Task 10: Build Roles & Scopes Page

Add permission matrix and role editor foundation.

## Task 11: Add Audit Logs

Track setup completion, user creation, role changes, and settings changes.

## Task 12: Add Tests

Add setup wizard happy-path test and basic permission tests.

---

# 27. Final Instruction to Agents

Build the first-run onboarding and settings system as a foundation feature before continuing deeper Compassion work. The setup wizard should bootstrap the entire application in the browser, including organization information, branding, workspaces, first admin user, default roles, permission scopes, and starter defaults. The Settings area should become a dedicated workspace with its own sidebar and organized tabs. User management must include role assignment, workspace access, and permission scopes. OyamaCRM and OyamaCRM-Compassion must remain separated by workspace, permissions, and audit logs.
