# OyamaCRM Agent Audit and Next-Step Plan

## Purpose

This document reviews the existing OyamaCRM planning files and identifies what appears to be missing, what should be corrected before new feature work accelerates, and what the agents should do next. It is intended to become the next planning handoff after the current master plan, donor CRM API plan, phase packets, and OyamaCRM-Compassion plan.

## Source Files Reviewed

- `pregnancy-care-center-donor-crm-api-plan(2).md`
- `master-plan.md`
- `oyamacrm-compassion-agent-plan(2).md`
- `phase-01-foundation-and-auth.md`
- `phase-02-constituents-and-timeline.md`
- `phase-03-donations-funds-campaigns.md`
- `phase-04-receipts-tasks-communications.md`
- `phase-05-dashboard-and-reports.md`
- `phase-06-groups-segments-automation.md`
- `phase-07-events-and-gala.md`
- `phase-08-security-integrations-ai-ops.md`
- `phase-09-compassion-workspace.md`

---

# 1. High-Level Finding

The existing plan is strong. It already covers the main donor CRM, the client-services Compassion workspace, donor profiles, donations, campaigns, tasks, communications, events, reports, automation, AI, security, public scheduling pages, embeds, resources, files, forms, and workspace separation.

The biggest missing piece is that the software does not yet have a dedicated **first-run onboarding and browser-based bootstrap phase**. The phase packets assume a running system with seeded data, users, permissions, and workspaces, but the setup experience needs to become a first-class feature. The setup flow should create the organization, the first admin, default roles, workspace access, branding, default settings, and starter data before normal login begins.

The second major gap is the **Settings workspace**. Settings should not remain scattered across individual features. It needs its own sidebar, tabs, and permission-protected pages for organization setup, branding, users, roles/scopes, workspaces, donor defaults, Compassion defaults, scheduling, forms, email/SMS, integrations, security, import/export, audit logs, and system diagnostics.

The third major gap is that the current master plan shows several foundation items still pending or partial: route-level RBAC is only partial, the API response envelope is mixed, audit logs exist but are not generalized, and production startup docs are still pending. Those foundation items should be completed before Compassion data, client files, public embeds, and AI tools are allowed to scale.

---

# 2. What Is Already Covered Well

## Donor CRM Planning

The donor CRM plan already covers:

- Donor/constituent management
- Gifts and donation entry
- Funds, campaigns, and appeals
- Tasks and follow-up
- Receipts and thank-you workflows
- Email and printed letters
- Groups and segments
- Reports
- Events and gala tools
- Imports, exports, and data cleanup
- API structure
- Background jobs
- AI abstraction
- Security principles
- Dashboard caching
- Donor status rules

Agents should not rewrite this from scratch. They should build on the current phase structure and only patch gaps.

## Compassion Workspace Planning

The Compassion plan already covers:

- Separate client workspace
- Client records
- Client files
- Client notes
- Client timelines
- Appointments
- Internal scheduling
- Public scheduling pages
- Website embeds
- Form builder
- Resources and referrals
- Follow-up tasks
- Permission separation
- Audit logs
- AI safety
- Board-safe reports

Agents should treat `phase-09-compassion-workspace.md` as the executable Compassion packet.

## Master Plan Structure

The master plan already works as the central checklist. It includes shipped, pending, and partial items. This should continue to be the single source of truth, but it needs one new phase inserted near the beginning: **Phase 00 — Setup, Onboarding, Settings, and Workspace Bootstrap**.

---

# 3. Missing or Underdeveloped Areas

## 3.1 Missing Phase 00: Browser-Based Onboarding and Bootstrap

Add a new phase before Phase 01 or between Phase 01 and Phase C0.

Recommended title:

```text
Phase 00 — First-Run Setup, Onboarding, Settings, and Workspace Bootstrap
```

This phase should include:

- Setup detection
- `/setup` route
- Organization setup
- Branding setup
- First admin user creation
- Workspace enabling
- Default roles and scopes
- Default donor settings
- Default Compassion settings
- Default scheduling settings
- Setup completion lock
- Recovery/setup reset behavior for Super Admin only

## 3.2 Settings Area Is Not Yet Its Own Workspace

The existing plans mention settings, but they do not fully define the Settings UI as a dedicated area.

Required Settings layout:

```text
/settings
  Organization
  Branding
  Users
  Roles & Scopes
  Workspaces
  Donor CRM
  Compassion CRM
  Scheduling
  Forms
  Email & Messaging
  Integrations
  Security
  Data Import / Export
  Audit Logs
  System
```

The Settings sidebar should be separate from the main app sidebar. When the user enters Settings, the main content area should switch to a settings-focused navigation model.

## 3.3 User Management Needs To Be a Core Feature Now

The plan has roles and permissions, but the app needs a user-management interface now.

Required user tools:

- Add user
- Edit user
- Disable user
- Reset password
- Send invitation
- Require password reset
- Assign role
- Assign workspace access
- Assign custom permission scopes
- View last login
- View account status
- View effective permissions

User access must be checked with both workspace and permission scope.

Example rule:

```ts
canAccess(user, "COMPASSION", "compassion.clients.view")
```

## 3.4 API Envelope Standardization Is Blocking

The master plan states that the API response envelope is mixed. Agents should standardize all API responses before building many new routes.

Standard shape:

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

Error shape:

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

Paginated shape:

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

## 3.5 RBAC Is Still Partial

The master plan marks role/permission middleware as partial. This must be finished before client files, medical-style data, exports, or AI summaries are built.

Agents should create:

- `requireAuth`
- `requirePermission(permissionKey)`
- `requireWorkspace(workspaceKey)`
- `requireWorkspacePermission(workspaceKey, permissionKey)`
- `getEffectivePermissions(userId)`
- `canAccessWorkspace(userId, workspaceKey)`

No sensitive route should rely on frontend hiding only.

## 3.6 Audit Logging Needs To Be Generalized

The existing plan has audit logs, but write-side hooks are only on some routes. Compassion requires read and write audit logs, especially for client profiles and files.

Agents should build a central `AuditService` and use it from every sensitive route.

Required audit event categories:

- Auth
- Settings
- User management
- Role changes
- Donor record changes
- Gift changes
- Client record reads
- Client record changes
- Client file view/download/upload/delete
- Exports
- AI access
- Public booking submissions
- Payment/webhook activity

## 3.7 Setup Needs To Seed Default Data

The current plan has seed scripts, but first-run setup needs application-aware seed logic.

Seed during setup:

- Core organization
- Branding
- Workspaces
- First admin user
- Default roles
- Default permission scopes
- Default donor statuses
- Default client statuses
- Default appointment statuses
- Default file categories
- Default service types
- Default resource categories
- Default email templates
- Default scheduling rules
- Default dashboard cards

## 3.8 Scheduling Needs Setup-Time Defaults

Compassion scheduling is planned, but onboarding should collect minimal scheduling defaults.

Setup should allow:

- Main location
- Office hours
- Timezone
- Default appointment duration
- Whether public scheduling should be enabled
- Default reminder method
- Optional staff availability starter rules

Do not make this setup too complicated. The first-run wizard can collect the basics, and Settings can handle advanced scheduling later.

## 3.9 Public Website and Embed Security Needs Explicit Rules

Public scheduling pages and embeds need more explicit security rules.

Add:

- Rate limiting
- Honeypot field
- Optional CAPTCHA hook
- Allowed domains list for embeds
- UTM tracking support
- Public token/slug validation
- No private data returned to public pages
- Public forms must not expose internal IDs unnecessarily
- Staff notification queue after public booking

## 3.10 Data Retention and Archival Need More Detail

The plan says to use soft deletes, but the system needs retention and archive settings.

Add Settings pages for:

- Donor retention rules
- Client record archival rules
- File retention rules
- Audit log retention rules
- Export logs
- Backup retention

Compassion records should support archive/restore, not hard delete by default.

## 3.11 Import/Dedupe Is Important Earlier Than It Looks

The donor API plan includes imports, and the master plan has CSV import pending. This should be treated as an early foundation feature because the center may already have donor/client lists.

Minimum import system:

- CSV upload
- Field mapping
- Preview
- Duplicate detection
- Import history
- Rollback if possible
- Audit entry

Do donor import first. Client import can come later after Compassion records are stable.

## 3.12 Tests, CI, and E2E Should Move Up

The master plan already lists tests and CI gaps. Agents should not wait until the end.

Add now:

- CI pipeline for `pnpm lint && pnpm test`
- API route tests for RBAC-protected routes
- Setup wizard happy-path test
- E2E test: setup → login → create donor → add gift
- E2E test later: setup → enable Compassion → create client → schedule appointment

## 3.13 Production Runbooks Are Missing

Before the app handles real data, agents should create:

- Top-level README quickstart
- `.env.example`
- PM2 startup docs
- Backup/restore runbook
- Incident response notes
- Database migration instructions
- Seed/reset instructions
- Local GPU/AI provider setup notes, if enabled

---

# 4. Recommended New Master Plan Insert

Add this to `master-plan.md` before the current Phase 01 or immediately after Phase 01.

```md
### Phase 00 — First-Run Setup, Onboarding, Settings, and Workspace Bootstrap

- [ ] Setup status endpoint: `GET /api/setup/status`
- [ ] Setup wizard route: `/setup`
- [ ] Redirect unconfigured installs to setup wizard
- [ ] Organization setup form
- [ ] Branding setup form
- [ ] Workspace selection: OyamaCRM and OyamaCRM-Compassion
- [ ] First Super Admin user creation
- [ ] Default roles and permission scopes seeded
- [ ] Settings shell with dedicated settings sidebar
- [ ] Users settings page: add/edit/disable/reset/invite
- [ ] Roles & Scopes settings page: view/edit permission matrix
- [ ] Workspace access checks enforced server-side
- [ ] Setup completion lock: prevent public setup after completion
- [ ] Audit events for setup and user/role changes
- [ ] Setup happy-path test
```

Exit criteria:

```md
- A fresh install opens `/setup` automatically.
- The wizard creates an organization, branding, workspaces, first admin, roles, and permissions.
- After setup, the app redirects to login or dashboard.
- Settings has its own sidebar and user-management tools.
- Users can be assigned workspaces and scopes.
- Backend route permissions are enforced.
- Public setup cannot run twice.
```

---

# 5. What Agents Should Do Next

## Next Step 1: Freeze Foundation Contracts

Before adding more feature screens, agents should freeze these contracts:

- API response envelope
- Error shape
- Pagination shape
- Auth middleware
- Permission middleware
- Workspace middleware
- Audit service interface
- Settings service interface

Deliverables:

- `server/src/lib/api-response.ts`
- `server/src/middleware/require-auth.ts`
- `server/src/middleware/require-permission.ts`
- `server/src/middleware/require-workspace.ts`
- `server/src/services/audit-service.ts`
- Updated route examples using the standard response shape

## Next Step 2: Build First-Run Setup Skeleton

Create:

- `/setup` page
- `GET /api/setup/status`
- `POST /api/setup/complete`
- `system_settings` table or equivalent
- `organizations` table if not already present
- `organization_branding` table
- `workspaces` table

The setup wizard can submit one full payload for MVP.

## Next Step 3: Create Default Role and Permission Seed

Create a repeatable, idempotent seed service for:

- Super Admin
- Director
- Donor CRM Manager
- Client Services Manager
- Scheduler
- Advocate
- Medical Staff
- Volunteer
- Board Viewer
- Read Only

Seed permission keys by category:

- settings
- users
- roles
- workspaces
- donor
- gifts
- campaigns
- communications
- reports
- compassion
- scheduling
- files
- forms
- resources
- security
- integrations
- system

## Next Step 4: Build Settings Shell

Create:

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

Start with:

- Organization
- Branding
- Users
- Roles & Scopes
- Workspaces

Leave other tabs as clean placeholders with TODO cards.

## Next Step 5: Build Users and Scopes UI

Create:

- User list table
- Add user form
- Edit user form
- Disable user action
- Reset password/invite action placeholder
- Workspace access selector
- Role selector
- Effective permission viewer

## Next Step 6: Update Master Plan and AGENTS.md

Agents should update:

- `master-plan.md`
- `AGENTS.md`
- `README.md`
- `.env.example`

Add the new setup phase and the rule that all future features must honor workspace + permission checks.

## Next Step 7: Begin Compassion C0 After Setup Foundation

Do not start full Compassion client records until Phase 00 foundation is in place.

Once setup and settings exist, agents should start Phase C0:

- Workspace enum
- Workspace switcher
- `/compassion` layout
- Compassion sidebar
- Workspace-aware middleware
- Workspace audit logging

---

# 6. Critical Do-Not-Miss Rules

## Data Separation

Donor records and client records must stay separate.

Do not reuse `Constituent` for clients. Compassion clients need their own models, search, files, notes, reports, and permissions.

## Server-Side Enforcement

Every route that returns sensitive data must check permissions server-side. Hiding buttons in the frontend is not enough.

## Setup Cannot Stay Public

Once setup is complete, public setup routes must be locked. Only a Super Admin recovery mode should allow reconfiguration.

## Audit Must Be Built Early

Audit logging cannot be bolted on later. Add it now for setup, user management, roles, settings, client reads, client files, exports, and AI access.

## Scheduling Logic Must Stay in Services

Do not compute availability in UI components. Build `AvailabilityService`, `AppointmentService`, `SchedulePageService`, and `BookingService`.

## AI Must Be Draft-Only

AI may draft, summarize, and suggest, but it should not auto-save notes, send messages, or alter records without staff approval.

---

# 7. Suggested Immediate Agent Prompt

Use this as the next instruction to development agents:

```text
Review the current OyamaCRM plan and add a new Phase 00 for first-run browser onboarding, settings, users, workspace access, and permission scopes. Before starting deeper Compassion work, standardize the API response envelope, finish route-level RBAC, create a reusable AuditService, and build the setup wizard that creates the organization, branding, first admin user, default roles, default permissions, and enabled workspaces. Then build the Settings shell with its own sidebar and the first working tabs: Organization, Branding, Users, Roles & Scopes, and Workspaces. All user access must be checked by both workspace and permission scope. Update master-plan.md, AGENTS.md, README.md, and .env.example when complete.
```

---

# 8. Final Recommendation

The next sprint should not begin with client records or public scheduling pages. It should begin with the foundation that makes those features safe:

1. API contract standardization
2. Complete RBAC and workspace permission checks
3. First-run onboarding
4. Settings shell
5. User management and scopes
6. Audit logging
7. Then Compassion C0 workspace foundation

This order will prevent the app from growing into disconnected screens and will make OyamaCRM feel like a polished, installable software product instead of a prototype.
