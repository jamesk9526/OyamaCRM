# Compassion CRM — Implementation Audit

> Last updated: 2025-01-09

## Overview

Compassion CRM is the client/case-management module of OyamaCRM. It shares authentication, organization scoping, and the Next.js shell with DonorCRM but uses **blue** (`#2563eb`) accent colors and lives under `app/compassion/` (pages) and the `/api/compassion/` API prefix.

---

## Database Models (Prisma)

| Model | Status | Notes |
|---|---|---|
| `CompassionClient` | ✅ Done | Intake date, status, DOB, referral source, assigned staff |
| `CompassionCase` | ✅ Done | Auto-generated `CASE-YYYY-NNN` case number, caseType, caseStatus |
| `CompassionAppointment` | ✅ Done | Uses `startTime` field (not `scheduledAt`) |
| `CompassionService` | ✅ Done | Delivered service log linked to client + case |
| `CompassionFollowUp` | ✅ Done | Uses `status` field (not `followUpStatus`); requires `title` |
| `CompassionActivity` | ✅ Done | Audit timeline for all CRM actions |

### Enums

| Enum | Values |
|---|---|
| `CompassionClientStatus` | `ACTIVE`, `INACTIVE`, `GRADUATED`, `ARCHIVED`, `PENDING` |
| `CompassionCaseStatus` | `OPEN`, `IN_PROGRESS`, `PENDING`, `CLOSED`, `ARCHIVED` |
| `CompassionCaseType` | `PREGNANCY_SUPPORT`, `PARENTING`, `MATERIAL_ASSISTANCE`, `HOUSING`, `EDUCATION`, `EMPLOYMENT`, `COUNSELING`, `RESOURCE_REFERRAL`, `FOLLOW_UP`, `OTHER` |
| `CompassionAppointmentType` | `INTAKE`, `PREGNANCY_TEST`, `ULTRASOUND`, `PARENTING_CLASS`, `MATERIAL_ASSISTANCE`, `RESOURCE_REFERRAL`, `FOLLOW_UP`, `MENTORING`, `CASE_REVIEW`, `HOME_VISIT`, `OTHER` |
| `CompassionAppointmentStatus` | `SCHEDULED`, `COMPLETED`, `CANCELLED`, `NO_SHOW`, `RESCHEDULED` |
| `CompassionServiceType` | `PREGNANCY_TEST`, `ULTRASOUND`, `DIAPERS`, `CLOTHING`, `FORMULA`, `PARENTING_CLASS`, `HOUSING_REFERRAL`, `EDUCATION_REFERRAL`, `JOB_REFERRAL`, `NUTRITION_SUPPORT`, `COUNSELING`, `TRANSPORTATION_RESOURCE`, `OTHER` |
| `CompassionFollowUpStatus` | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `OVERDUE` |
| `CompassionPriority` | `LOW`, `MEDIUM`, `HIGH`, `URGENT` |

---

## API Endpoints

All routes require JWT authentication (`requireAuth`) and are scoped to the authenticated user's organization.

| Method | Path | Status | Notes |
|---|---|---|---|
| `GET` | `/api/compassion/dashboard-summary` | ✅ Done | Returns `totalClients`, `activeClients`, `activeCases`, `appointmentsToday`, `tasksDue`, `overdueFollowUps`, `caseloadByStatus`, `casesByStatus`, `todaysAppointments`, `upcomingFollowUps`, `recentActivity` |
| `GET` | `/api/compassion/clients` | ✅ Done | Search by `q`, filter by `status`, `assignedStaffId` |
| `POST` | `/api/compassion/clients` | ✅ Done | Requires `firstName`, `lastName` |
| `GET` | `/api/compassion/clients/:id` | ✅ Done | Full detail with cases, appointments, follow-ups |
| `PATCH` | `/api/compassion/clients/:id` | ✅ Done | Partial update |
| `DELETE` | `/api/compassion/clients/:id` | ✅ Done | Cascade deletes child records |
| `GET` | `/api/compassion/cases` | ✅ Done | Filter by `clientId`, `status`, `caseType` |
| `POST` | `/api/compassion/cases` | ✅ Done | Auto-generates `caseNumber` as `CASE-YYYY-NNN` |
| `GET` | `/api/compassion/cases/:id` | ✅ Done | |
| `PATCH` | `/api/compassion/cases/:id` | ✅ Done | |
| `DELETE` | `/api/compassion/cases/:id` | ✅ Done | |
| `GET` | `/api/compassion/appointments` | ✅ Done | Filter by `clientId`, `caseId`, `status`, `assignedStaffId` |
| `POST` | `/api/compassion/appointments` | ✅ Done | Requires `clientId`, `startTime` |
| `GET` | `/api/compassion/appointments/:id` | ✅ Done | |
| `PATCH` | `/api/compassion/appointments/:id` | ✅ Done | |
| `DELETE` | `/api/compassion/appointments/:id` | ✅ Done | |
| `GET` | `/api/compassion/follow-ups` | ✅ Done | Filter by `clientId`, `status`, `assignedStaffId` |
| `POST` | `/api/compassion/follow-ups` | ✅ Done | Requires `clientId`, `title`, `dueDate` |
| `PATCH` | `/api/compassion/follow-ups/:id` | ✅ Done | Accepts `status`, `title`, `dueDate`, `priority`, `assignedStaffId`, `notes`; auto-sets `completedAt` |
| `DELETE` | `/api/compassion/follow-ups/:id` | ✅ Done | |
| `GET` | `/api/compassion/services` | ✅ Done | Filter by `clientId`, `caseId`, `serviceType` |
| `POST` | `/api/compassion/services` | ✅ Done | Requires `clientId`, `serviceType` |
| `DELETE` | `/api/compassion/services/:id` | ✅ Done | |

---

## Frontend Pages

| Page | Route | Status | Notes |
|---|---|---|---|
| Dashboard | `/compassion/dashboard` | ✅ Done | Real API data; donut charts use `caseloadByStatus`, `casesByStatus` |
| Clients | `/compassion/clients` | ✅ Done | Search + status filter + table + AddClientModal |
| Cases | `/compassion/cases` | ✅ Done | Status filter + table + NewCaseModal |
| Appointments | `/compassion/appointments` | ✅ Done | Status filter + table + ScheduleAppointmentModal |
| Follow-ups | `/compassion/follow-ups` | ✅ Done | Overdue banner + filters + inline Mark Complete + AddFollowUpModal |

---

## Known Field-Name Conventions

> **Important**: These conventions must be followed when writing code against the Compassion CRM API.

| Concern | Correct API field | Wrong (do not use) |
|---|---|---|
| Follow-up completion state | `status` | `followUpStatus` |
| Appointment date/time | `startTime` | `scheduledAt` |
| Dashboard pending tasks count | `tasksDue` | `pendingFollowUps` |
| Dashboard active case count | `activeCases` | `openCases` |
| Dashboard today's schedule | `todaysAppointments` | `todaySchedule` |
| Appointment type: intake | `INTAKE` | `INTAKE_APPOINTMENT` |

---

## Tests

| Test file | Coverage | Status |
|---|---|---|
| `tests/smoke/routes-workflow.test.ts` → `describe("compassion CRM smoke")` | Dashboard summary, create/list clients, open/list cases, create follow-up, schedule appointment | ✅ All 7 tests pass |

---

## Migration

- Migration: `prisma/migrations/20260509110045_add_compassion_crm_models/migration.sql`
- Applied: ✅

> **Windows EPERM note**: On Windows, `prisma generate` may show an EPERM rename warning for `query_engine-windows.dll.node` while node processes are running. If this occurs, close all running node processes before running `pnpm exec prisma generate`. The Prisma client was successfully generated during `prisma migrate dev`.

---

## What's Next

- [ ] **Client detail page** (`/compassion/clients/[id]`) — show full timeline, cases, appointments, follow-ups, and services for one client
- [ ] **Case detail page** (`/compassion/cases/[id]`) — show case notes, services delivered, linked appointments
- [ ] **Compassion reporting** — caseload by type, service delivery summary, staff workload
- [ ] **Permission enforcement** — replace `// TODO: enforce Compassion workspace permission` comments with real role checks
- [ ] **Shared-person linking** — intentional link between a DonorCRM constituent and a Compassion client (requires explicit staff action and permission gate)
