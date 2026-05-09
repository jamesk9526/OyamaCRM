# Compassion CRM Status

_Last deep audit: 2026-05-09_

## Summary

Compassion CRM is currently **module-shell complete but workflow incomplete**. The shell, navigation, and visual system are in place, but core client-care entities are not yet implemented with production data models and APIs.

## Status Matrix

| Area | Feature | Status | Data Source | Notes | Next Step |
|---|---|---|---|---|---|
| Compassion CRM | Module shell + sidebar + topbar switcher | Working | Static Demo UI | `app/compassion/layout.tsx` and `CompassionSidebar.tsx` provide blue module shell and nav. | Keep shell and replace route placeholders with real pages incrementally. |
| Compassion CRM | Dashboard metrics/charts | Placeholder Data | Hardcoded Placeholder | `app/compassion/dashboard/page.tsx` explicitly uses static arrays and TODO markers for API replacement. | Build `/api/compassion/dashboard-summary` and replace static data. |
| Compassion CRM | Clients CRUD | UI Only | Static Demo UI | `/compassion/clients` route exists but is still placeholder content. | Add `Client` model + `/api/compassion/clients` routes + real table/form UI. |
| Compassion CRM | Cases + services + timelines | UI Only | Static Demo UI | `/compassion/cases`, `/compassion/activities`, `/compassion/care-plans` are placeholder flows. | Add case and activity schema with timeline events. |
| Compassion CRM | Appointments/scheduling | UI Only | Static Demo UI | `/compassion/appointments` exists as placeholder route only. | Build appointment model, availability, and scheduling endpoints. |
| Compassion CRM | Reports | UI Only | Static Demo UI | `/compassion/reports` and `/compassion/dashboards` are not connected to data. | Add care-outcome and caseload report APIs and pages. |
| Compassion CRM | Intake/import tools | Not Started | Unknown / Needs Verification | No Compassion-specific import flow is wired. | Extend import mapper for client/case datasets once schema exists. |
| Compassion CRM | Permission boundaries | Partial | Unknown / Needs Verification | Layout contains TODO for module permission enforcement. | Implement workspace-scoped RBAC checks on Compassion routes/API. |

## Real Data vs Demo Data Audit

- **Real:** module shell and auth guard baseline.
- **Demo/UI-only:** nearly all operational Compassion routes and dashboard metrics.
- **Missing:** underlying client-care models, CRUD APIs, and production user workflows.

## Production-Readiness Gaps

1. No `Client`, `Case`, `Appointment`, `Assessment`, `CarePlan` database entities.
2. No Compassion API route set under `/api/compassion/*`.
3. No workspace-permission enforcement beyond high-level auth gate.
4. No real dashboard/reporting data sources.
5. No intake/import pipeline for Compassion records.
