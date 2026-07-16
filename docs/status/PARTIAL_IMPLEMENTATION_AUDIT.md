# Partial Implementation Audit

Last updated: 2026-05-14 (production pass phase 1/2)

This audit tracks incomplete, demo-only, or partially wired behavior discovered during the production pass. Every item is assigned one of the required paths:

1. Finish it fully.
2. Remove it from visible UI.
3. Move it to backlog with no active user-facing route pretending it works.

Status labels used in this file:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented
- Removed From UI
- Backlog

| ID | Feature/Module | File path | Current status | What is partial or broken | Decision | Required API/DB work | Required UI work | Required tests | Final resolution |
|---|---|---|---|---|---|---|---|---|---|
| PI-001 | Events sidebar event-scoped links | app/components/layout/sidebar-configs.tsx | Removed From UI | Event workspace linked to non-existent routes (`/events/[eventId]/fundraising`, `/communications`, `/reports`, `/tasks`, `/volunteers`, `/files`, `/settings`). | Remove it from visible UI | None for this fix | Keep only working event links and map scoped tools to existing routes using `?eventId=` | Sidebar navigation regression test for Events module | Completed in this pass: dead links removed from sidebar groups and working links remapped. |
| PI-002 | Compassion sidebar Tasks entry | app/components/layout/sidebar-configs.tsx, app/compassion/tasks/page.tsx | Removed From UI | Sidebar exposed a placeholder route with a "coming soon" page. | Remove it from visible UI | None for this fix | Remove Tasks sidebar item until real workspace ships | Sidebar config snapshot test for Compassion groups | Completed in this pass: Tasks entry removed from Compassion sidebar. |
| PI-003 | Settings overview card to placeholder Events settings | app/settings/page.tsx, app/settings/events/page.tsx | Removed From UI | Main settings card linked to a placeholder-only settings surface. | Remove it from visible UI | None for this fix | Remove card from settings overview grid until route is production-ready | Settings overview card list test | Completed in this pass: Events CRM card removed from settings overview. |
| PI-004 | Compassion Tasks workspace | app/compassion/tasks/page.tsx | Not Implemented | Route is a placeholder with `ComingSoonBadge` and no working task workflow. | Backlog | Define compassion-task schema/API or align to shared task service with module scoping | Replace placeholder with working list/board/calendar and detail drawer | Route-level happy-path tests + permission tests | Kept off primary nav in this pass; remains backlog until fully implemented. |
| PI-005 | Compassion Activities workspace | app/compassion/activities/page.tsx | Not Implemented | Placeholder-only route. | Backlog | Activity persistence and retrieval API for compassion activities | Implement timeline/activity UI or hide route from discoverable navigation | API + UI tests for activity creation/listing | Route remains non-primary and tracked for backlog completion. |
| PI-006 | Compassion Communications workspace | app/compassion/communications/page.tsx | Not Implemented | Placeholder-only route. | Backlog | Compassion-specific communication APIs/settings persistence | Build module-safe communication workspace or keep hidden | Module boundary tests + permission tests | Route tracked as backlog and should remain non-promoted until functional. |
| PI-007 | Compassion Care Plans workspace | app/compassion/care-plans/page.tsx | Not Implemented | Placeholder-only route. | Backlog | Care-plan models, APIs, audit events | Implement care-plan workspace and client-scoped records | Care-plan CRUD + audit tests | Route tracked in backlog; no production promotion. |
| PI-008 | Compassion Assessments workspace | app/compassion/assessments/page.tsx | Not Implemented | Placeholder-only route. | Backlog | Assessment models and persistence APIs | Implement assessment workflows and validation | Assessment CRUD + validation tests | Route tracked in backlog; no production promotion. |
| PI-009 | Compassion Dashboards workspace | app/compassion/dashboards/page.tsx | Not Implemented | Placeholder-only route. | Backlog | Metrics APIs and scoped aggregation endpoints | Replace placeholder with real dashboard widgets/charts | Dashboard data-contract and render tests | Route tracked in backlog; no production promotion. |
| PI-010 | Compassion client profile tab notices | app/compassion/clients/[id]/page.tsx | Partially Working | Some tabs are available but explicitly show in-development notices. | Finish | Complete missing tab data endpoints and write operations | Remove in-development notices once tabs are fully wired and validated | Tab-by-tab client workspace tests | Open item: keep notices visible until each tab meets production criteria. |
| PI-011 | Compassion communication settings persistence | app/compassion/settings/page.tsx | Partially Working | Communications settings section is explicitly marked "in development" with TODO backend API note. | Finish | Add backend persistence routes for module-specific sender/consent/template preferences | Replace static notice with fully wired form states | API tests + settings save/load UI tests | Open item: remains partial until API and persistence are live. |
| PI-012 | Compassion Data Tools secondary cards | app/compassion/data-tools/page.tsx | Partially Working | Import History and Export Clients cards are shown as "Coming Soon". | Finish | Add import-history and export endpoints with audit logging | Enable card actions and remove disabled styling | Data-tools workflow tests (import history listing, export result) | Open item: currently visible as intentional in-development cards; must be completed or hidden. |
| PI-013 | Letters PDF export API | server/src/routes/letters.ts | Working | Single and batch export endpoints stream real PDF bytes through the server renderer; workspace previews open the returned blobs. | Maintain | Keep renderer and browser preview contracts aligned as fidelity expands | Preserve explicit export errors and review-first PDF preview | `tests/smoke/api-smoke.test.ts`, `tests/e2e/oyama-letters-batch.e2e.mjs`, `tests/unit/letters-pdf-layout.test.ts` | Resolved: the stale HTTP 501 claim was removed on 2026-07-15. |
| PI-014 | Browser-native prompt/confirm/alert usage | app/reports/page.tsx, app/components/**/*.tsx | Partially Working | Native dialogs still exist in multiple component workflows, but campaigns and communications route-level delete/clone actions were migrated to in-app modal UX in this pass. | Finish | None required globally; route-specific mutations should return typed errors for modal consumption | Continue replacing native dialogs with shared confirmation/input modal patterns in remaining high-traffic workflows | UI tests for confirm/submit/cancel behavior in critical flows | In progress: campaign and communications pages are migrated; remaining surfaces still open. |
| PI-015 | Webmaster dynamic workspace placeholders | app/webmaster/[workspace]/page.tsx, app/components/webmaster/WebmasterStarterDashboard.tsx | Demo Only | Dynamic routes resolve to placeholder screens for multiple Webmaster workspaces. Starter dashboard previously linked directly to non-existent workspace routes. | Backlog | Add real workspace APIs per area (templates/cms/assets/forms/settings/sites/theme/publishing/seo) | Replace placeholder route handler with real workspace pages as each area is delivered | Route-level integration tests for each workspace | In progress: starter dashboard dead links now route through explicit in-development notices instead of navigating to missing routes. |
| PI-016 | Compassion permission enforcement TODOs | app/compassion/layout.tsx, app/compassion/clients/page.tsx, app/compassion/cases/page.tsx, app/compassion/follow-ups/page.tsx, app/compassion/reports/page.tsx, app/compassion/settings/page.tsx, app/compassion/settings/staff/page.tsx, app/compassion/appointments/page.tsx | Partially Working | Multiple routes include TODOs indicating module-permission checks are not fully enforced. | Finish | Add server/session-backed module permission checks and denial handling | Apply consistent permission gates and access-denied UX across Compassion routes | Permission matrix tests (authorized vs unauthorized route access) | Open item: required for production privacy posture and module isolation. |

## Pass Notes (2026-05-14)

- Completed immediate remove-from-UI actions for broken/placeholder navigation surfaces (PI-001, PI-002, PI-003).
- Completed route-level dialog hardening in campaigns and communications by replacing browser-native prompt/confirm flows with modal-based UX (PI-014 partial).
- Removed direct Webmaster dashboard links to missing template/import/media/brand routes and replaced them with explicit in-development notices (PI-015 partial).
- Remaining items are now tracked with explicit ownership direction (Finish vs Backlog).
- No item in this file should be promoted to Working without UI wiring, API persistence, permission checks, and test coverage evidence.
