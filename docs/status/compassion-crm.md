# Compassion CRM Status

_Last deep audit: 2026-05-11_

## Summary

Compassion CRM is in a **mixed operational state**: core client/case workflows, public scheduling, office scheduling hub, and broad client-profile tab CRUD surfaces are now real; advanced tab workflows and scheduling triage workflows remain in development.

Status labels used in this document:
- Working
- Partially Working
- Demo Only
- Not Implemented

## Status Matrix

| Area | Feature | Status | Data Source | Notes | Next Step |
|---|---|---|---|---|---|
| Compassion CRM | Module shell + blue navigation | Working | Real API Data | `app/compassion/layout.tsx` + auth/module shell are live. | Add workspace permission checks beyond auth gate. |
| Compassion CRM | Dashboard summary metrics | Working | Real API Data | Dashboard loads `/api/compassion/dashboard-summary`. | Expand outcome metrics and add richer alerting widgets. |
| Compassion CRM | Clients list/search + importer hardening | Working | Real API Data | Import validator, defensive filters, delimiter handling, and list filters are implemented. | Add import history + rollback workflows. |
| Compassion CRM | Client profile workspace tabs | Partially Working | Real API Data | Grouped tab UX plus full note/follow-up/service edit flows are live. Most tab-level warnings were removed; targeted warnings remain for Documents and Portal advanced workflows. | Add happy-path tests, document upload storage, and role-aware workflow hardening for sensitive tabs. |
| Compassion CRM | Case and appointment CRUD | Working | Real API Data | Core case/appointment endpoints and pages are wired. | Add deeper workflow actions, assignment automation, and SLA tooling. |
| Compassion CRM | Appointment scheduling hub (calendar + list workspace) | Working | Real API Data | `/compassion/appointments` now provides day/week/month/agenda calendar, list view, drag/resize rescheduling, conflict-safe updates, quick status actions, and full-screen scheduling mode backed by `/api/compassion/appointments`. | Add existing-client matcher/review queue for public submissions and add anti-abuse/rate-limiting for public endpoints. |
| Compassion CRM | Public scheduling page + slot engine | Working | Real API Data | Public booking is token-based and slot-driven; submit-time slot validation is enforced. | Add rate limiting and abuse monitoring. |
| Compassion CRM | Embeddable scheduling widget | Working | Real API Data | Iframe + script snippet support in settings; shared backend validation rules. | Add signed configuration/versioning and widget lifecycle events. |
| Compassion CRM | Existing-client matcher + staff review queue | Not Implemented | Unknown / Needs Verification | Public submissions are not yet triaged through a dedicated review queue. | Build matcher scoring + queue UI + assignment flow. |
| Compassion CRM | Reports and advanced outcomes | Partially Working | Mixed Real/Demo Data | Foundational reporting exists, but deeper care outcomes remain limited. | Add cohort/outcome reporting and export schedules. |
| Compassion CRM | Permission boundaries | Partially Working | Unknown / Needs Verification | TODO permission notes still exist on module routes. | Implement module-aware RBAC middleware and tests. |

## Real Data vs Demo Data Audit

- Real and operational:
	- Dashboard summary API and UI
	- Client/case/appointment core CRUD
	- Import validation + list hardening
	- Client profile tab CRUD activation (notes/follow-ups/documents/medical/service logs/communication/portal)
	- Follow-up and service-entry inline edit workflows on client profile tabs
	- Public scheduling slots + submit-time validation
	- Embeddable scheduling snippets
- Mixed / partial:
	- Advanced workflows inside newly activated profile tabs (document upload pipeline, deep permission controls, broad test coverage)
	- Portal event ingestion automation beyond manual log entry
	- Reporting depth
	- Permission boundaries
- Not yet implemented:
	- Existing-client matcher + staff review queue for public scheduling

## Production-Readiness Gaps

1. Add rate limiting and anti-abuse controls for public scheduling endpoints.
2. Add existing-client matcher and staff triage queue before final appointment conversion workflows.
3. Add happy-path test coverage for newly activated client tab workflows (activity-entry CRUD, follow-up transitions, service-log writes).
4. Build secure document upload storage and retrieval flow for the documents tab (beyond metadata logging).
5. Replace TODO permission placeholders with enforceable Compassion module RBAC checks and tab-level access constraints.
