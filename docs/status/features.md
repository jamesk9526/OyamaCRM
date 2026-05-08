# OyamaCRM Feature Status

_Last updated: 2025-07-14_

## Master Feature Table

| Feature | Module | Status | Notes |
|---------|--------|--------|-------|
| Dashboard | DonorCRM | **Working** | Live metrics from API; donor retention, revenue charts |
| Constituent Management | DonorCRM | **Working** | CRUD, search, filter, household panel |
| Donation Tracking | DonorCRM | **Working** | Create, list, filter by status/date |
| Campaigns | DonorCRM | **Working** | Campaign cards, progress tracking |
| Tasks | DonorCRM | **Working** | Assignment, due dates, status toggle |
| Communications | DonorCRM | **Working** | Email builder, campaign management |
| Automations | DonorCRM | **Placeholder** | UI shell only; no trigger/action engine |
| Events | DonorCRM | **Placeholder** | UI shell only; no registration backend |
| Volunteers | DonorCRM | **Placeholder** | UI shell only; no hour tracking |
| Reports | DonorCRM | **Partial** | Static charts; no custom report builder |
| Settings | DonorCRM | **Partial** | System health, feature readiness table |
| **Export (CSV)** | DonorCRM | **Working** | Constituents + Donations; live data |
| **Import Wizard** | DonorCRM | **Partial** | Client-side CSV parse, map, validate, dedup; no backend POST |
| **Merge Workflow** | DonorCRM | **Partial** | Client-side dedup detection + side-by-side UI; no backend POST |
| Data Quality Metrics | DonorCRM | **Working** | Missing email, duplicate email, missing phone |
| **Module Switcher** | Both | **Working** | TopBar pill switches between DonorCRM and Compassion CRM |
| **Compassion CRM Shell** | Compassion | **Working** | Blue layout, sidebar, auth-gated |
| **Compassion Dashboard** | Compassion | **Working** | Static placeholder data; charts, schedule, tasks, alerts |
| Clients | Compassion | **Placeholder** | Route + placeholder page; no CRUD |
| Families | Compassion | **Placeholder** | Route + placeholder page; no CRUD |
| Cases | Compassion | **Placeholder** | Route + placeholder page; no CRUD |
| Assessments | Compassion | **Placeholder** | Route + placeholder page; no CRUD |
| Care Plans | Compassion | **Placeholder** | Route + placeholder page; no CRUD |
| Appointments | Compassion | **Placeholder** | Route + placeholder page; no scheduling |
| Activities | Compassion | **Placeholder** | Route + placeholder page; no logging |
| Communications | Compassion | **Placeholder** | Route + placeholder page |
| Tasks | Compassion | **Placeholder** | Route + placeholder page |
| Follow Ups | Compassion | **Placeholder** | Route + placeholder page |
| Reports | Compassion | **Placeholder** | Route + placeholder page |
| Dashboards | Compassion | **Placeholder** | Route + placeholder page |
| Data Tools | Compassion | **Placeholder** | Route + placeholder page; DonorCRM tools not yet ported |
| Settings | Compassion | **Placeholder** | Route + placeholder page |
| Compassion Permissions | Compassion | **Not Started** | Role/workspace permission checks pending |
| Authentication | Both | **Working** | JWT + refresh token; login/logout |
| Email Builder | DonorCRM | **Working** | Block-based drag-and-drop email composer |
| Global Search | Both | **Working** | ⌘K search; constituent + campaign results |
| AI Assistant | Both | **Not Started** | Button present; no backend |

## Status Legend

- **Working** — Feature is functional end-to-end with live data
- **Partial** — Core UI built; missing backend wiring or significant features
- **Placeholder** — Route and page shell exist; no real functionality
- **Not Started** — Only planned; no code exists
