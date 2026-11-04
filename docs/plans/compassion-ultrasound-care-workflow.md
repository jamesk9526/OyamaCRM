# Compassion ultrasound and care workflow — 2026-11-03

## Objective and scope

Give the care team a dedicated, client-connected ultrasound workspace, using the existing encrypted chart, document, appointment, and physician-signature systems. The user selected the care-workflow focus: visits, results, physician review, and follow-up queues. Routine implementation choices are authorized by the request and AGENTS.md.

| Module | Responsibility | Depends on |
| --- | --- | --- |
| ultrasound-charting | Ultrasound worklist, structured drafts, attachments, appointment links | Existing clinical charts and scheduling |
| clinical-review | Submit, request corrections, physician sign-off, immutable signed reports | ultrasound-charting |
| care-follow-up | Explicit chart-linked care tasks, overdue/in-progress queues, client and Today handoffs | ultrasound-charting |

Build order: chart contracts and validation → review and follow-up API → dedicated UI and handoffs → rendered and database-backed verification.

## Boundaries and design

- Keep the calm teal Compassion design and reuse care cards, controls, navigation, and capability gates. No supplied ultrasound-specific visual reference is available.
- Store examination details in `CompassionChart.encryptedContent`; do not create a second ultrasound record store. Existing ultrasound charts remain accessible.
- Separate appointment status from draft/review/signed chart status. Reuse the existing conflict-aware appointment editor and resource reservations.
- Add an optional, indexed chart link to follow-ups. Generic care task titles contain no findings; clinical details stay in encrypted charts.
- Enforce organization, active membership, author-only draft editing, and physician-only sign-off/return on the server. Check linked appointments and assignees in the same organization.
- Preserve signed records and their existing printable reports. Corrections to signed charts use amendments. Return-for-correction applies only before signing.
- No automatic clinical interpretations, outbound messaging, scanner connection, or DICOM viewer is included.

## Contracts and acceptance criteria

1. `GET /ultrasounds` returns a paginated, searchable, client-filterable worklist with draft/review/signed counts, attachment counts, linked appointments and follow-ups. Only clinical members can read it.
2. Existing chart create/update/submit endpoints validate ultrasound field shapes, dates, optional measurements, appointment ownership/type, and required submission fields. Save drafts with incomplete results; require findings and at least one attachment for submission. Stale UI saves fail clearly.
3. `POST /charts/:id/return` records encrypted reviewer feedback and returns an unsigned review chart to its author. Only a physician may perform this action.
4. `POST /ultrasounds/:id/follow-ups` creates a reviewed care task with a chart link, safe generic title, due date, priority, and optional active care-account assignment. Duplicate open tasks are rejected; signed chart contents remain unchanged.
5. The ultrasound UI supports new draft, author edit, appointment selection/scheduling, protected upload/preview/download, submission, correction requests, signing, amendments, and signed-report links. Every request has loading, error/retry, empty and success states.
6. Client records and Today link into the care workflow. Follow-up queues include in-progress tasks and correct overdue filtering; completing or reopening updates completion timestamps consistently.
7. Desktop and mobile render without page overflow; keyboard focus, labels, navigation, and actual interactions are checked. Evidence is stored in `docs/status/audit-artifacts/2026-11-03-compassion-care-workflow` and synthetic fixtures are explicitly identified.

## Implementation conventions and verification

Next.js 16 / React 19 components live under `app/components/compassion`; Express/Prisma feature routes live under `server/src/compassion`. Shared ultrasound field definitions belong to the care feature. Follow existing `route("clinical", async (req, res) => ...)`, tenant scoping, `seal`/`unseal`, and structured error patterns. No new dependency is planned.

- Focused behavior tests: `pnpm exec vitest run tests/unit/compassion-ultrasound.test.ts tests/api/compassion-client-care.test.ts`
- Types: `pnpm typecheck`
- Lint: `pnpm exec eslint` with the changed TypeScript files.
- Browser: repository-style Playwright `.mjs` flow tests, desktop 1440px and mobile 390px, screenshots and request/console evidence. Chrome DevTools MCP is unavailable in this session.
- Schema: additive SQL migration only; validate and generate the Prisma client. Never reset or replace the development database.
- Update `docs/status/features.md` and `docs/status/production-readiness-checklist.md` with actual results and any remaining deployment/clinical-readiness limits.

## Tasks

- [x] Add validation tests and ultrasound contracts.
- [x] Implement scoped worklist, review feedback, and chart-linked follow-up routes.
- [x] Build dedicated ultrasound UI and connect scheduling, client profiles, and Today.
- [x] Improve follow-up filtering and completion handling.
- [x] Run focused checks, inspect desktop/mobile views, review the diff, and document evidence. MySQL migration and database-backed checks remain an explicitly documented deployment prerequisite because the local service is unavailable.
