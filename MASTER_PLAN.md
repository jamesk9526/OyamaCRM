# OyamaCRM Master Plan and Reality Audit

_Last deep audit: 2026-05-09_

## 1. Project Vision

OyamaCRM is a modular nonprofit platform with three CRM workspaces:
- **DonorCRM** (green): fundraising, stewardship, donations, campaigns, communications.
- **Compassion CRM** (blue): client care, cases, appointments, service outcomes.
- **Events CRM** (amber): event operations, registration, guests, check-in, and donor follow-up.

The platform also supports **standalone apps** (under `/apps/*`) that are not CRM modules.

The platform goal is a complete stewardship loop: add constituent/client records, track activity, execute outreach, and report outcomes with reliable role-based access controls.

## 2. Current App Structure

- `app/` — Next.js app routes and module UIs.
- `server/src/routes/` — Express API routes.
- `prisma/schema.prisma` + migrations — shared relational data model.
- `docs/status/` — evidence-backed status and gap documents.
- `app/settings/system-status` and `app/settings/project-status` — in-app readiness surfaces.
- TopBar app drawer is now reserved for future standalone app launches (starts empty); CRM switching remains in the module switcher.
- Standalone apps use a basic shell that intentionally excludes CRM top-search and CRM AI assistant controls.

## 2.1 Reality Check From Full Production Pass (2026-05-10)

The latest full validation pass (tests + smoke + e2e + lint + typecheck + build + browser audit) found production-blocking failures. Use `docs/status/production-readiness-checklist.md` as the release gate source.

Immediate blockers:

1. Grants smoke regressions from status/response-contract drift.
2. Compassion workflow smoke regression where newly created clients are not reliably returned in immediate list assertions.
3. Events reports route uses unauthenticated data calls and fails under protected APIs.
4. Event-scoped guests route crashes on unsafe payload assumptions.
5. Lint/typecheck/build lanes are not passing.

Planning rule for next implementation cycle:

1. Fix all Broken release-lane items first (PR-001 through PR-008 in checklist).
2. Keep Demo Only and Not Implemented surfaces visibly labeled in UI.
3. Re-run full matrix and only then move to expansion work.

## 3. Donor CRM Plan/Status

**Current status:** mostly **Working** with real APIs for core CRUD/reporting.

Working now:
- Constituents, donations, campaigns, tasks, reports, users, audit logs.
- Dashboard metrics and donor retention reporting.
- Import tools for constituents and donations.

Still partial:
- Communications telemetry depth (delivery/open/click/unsubscribe lifecycle).
- Merge workflow backend finalize endpoint.
- Automation execution engine (current run flow is mostly operational scaffolding).

## 4. Compassion CRM Plan/Status

**Current status:** **Mixed (working core + partial advanced workflows)**.

Working now:
- Blue module shell, navigation, and auth-gated route group.
- Core client/case/appointment dashboard and CRUD routes.
- Public scheduling page with server-generated slot availability and submit-time slot validation.
- Embeddable scheduling via iframe and script snippets.

Missing:
- Existing-client matcher + staff triage queue for public appointment submissions.
- Rate limiting/anti-abuse controls for public scheduling endpoints.
- Full implementation of all in-development client profile tabs.
- Workspace-specific permission enforcement.

## 5. Events CRM Plan/Status

**Current status:** **Partial** (mixed real and scaffolded surfaces).

Working now:
- Event CRUD, orders, guests, tables, check-in, reports, and event activity sync into donor timeline.
- Event-first workspace selector and scoped routing.
- Explicit global tools outside selected-event scope (reports, page builder, templates, registry).

UI-only areas:
- Tickets, sponsors, communications, tasks, volunteers, files, settings, and parts of fundraising/public pages still use static scaffold cards.

Next target:
- Ticket type CRUD + public registration pages + sponsor management as first expansion block.

## 6. Constituent Database Plan/Status

Constituent and donor entities are real and operational in Prisma/Express flows.

Planned expansion:
- Shared person linking between donor and Compassion records with explicit permission boundaries.
- Timeline unification for donations, events, communications, tasks, imports, and client interactions where policy allows.

## 7. Import/Export/Data-Mapping Plan/Status

Working now:
- CSV upload, field detection, mapping, validation, dry-run, and import for constituents and donations.

Partial/missing:
- Merge finalize backend endpoint.
- Import history, rollback, and richer error report artifacts.
- Broader coverage for clients, guests, sponsors, events, and communication list imports.

## 8. Communication/Email/Newsletter Builder Plan/Status

Working now:
- Campaign records and editor content persistence.

Missing/partial:
- Provider-backed delivery/open/click metrics.
- Media uploads (image/video blocks) production pipeline.
- Complete merge fields, scheduled sends, and profile-level communication history depth.
- Unsubscribe workflow hardening and timeline wiring.

## 9. Dashboard/Reporting Plan/Status

Working now:
- Donor summary metrics, retention, top donors, and event report summaries.

Partial:
- Uneven loading/error/empty-state handling.
- Limited export/report scheduling capabilities.
- Missing advanced custom report builder and cross-module KPI normalization.

## 10. Authentication/Permissions Plan/Status

Working now:
- JWT auth, route-level auth middleware, admin checks on sensitive actions, users CRUD, and audit log viewer.

Still needed:
- Granular role matrix editor (current roles/scopes page is placeholder).
- Workspace-aware authorization boundaries (especially Compassion module).
- Stronger permission tests and policy validation coverage.

## 11. Real Data vs Placeholder Data Audit Summary

- **Real and operational:** donor CRUD flows, reports endpoints, event operational APIs (orders/guests/tables/check-in/reporting), users/audit APIs.
- **Mixed real/demo:** communications metrics, automation execution, portions of Events module pages.
- **Placeholder/UI-only:** most Compassion operational routes, payment portal tabs, and multiple settings sections.
- **Not started:** blog tooling, generic website embed system, broad public widget/embed pipeline.

## 12. Production Readiness Checklist

- [x] Auth routes and session flows operational.
- [x] Core donor CRUD operational with real data.
- [x] Audit logging and viewer available.
- [~] Standardized API behavior across all routes (improving but not fully uniform).
- [~] Events module fully production-complete (core real, many scaffolds remain).
- [ ] Compassion module operational with real data.
- [ ] Roles/scopes editor and full workspace-aware permission model.
- [ ] Import history + rollback + merge finalize endpoints.
- [ ] Payment provider integrations replacing mock payment portal data.
- [ ] End-to-end tests for critical daily workflows.

## 13. Known Issues

1. Some pages look complete while still using static demo data.
2. Several settings routes are placeholders and not persistent.
3. Merge workflow is not fully server-backed.
4. Compassion routes are mostly placeholders.
5. Payment portal is mock/simulated only.
6. Events module has real operations but still includes scaffold-only sections.

## 14. Next Important TODOs

### Priority 1 — Production Blocking

1. Complete workspace-aware authorization boundaries (especially Compassion).
2. Replace remaining placeholder/demo data in active operational dashboards.
3. Finish merge backend endpoint + import rollback/history.
4. Replace payment portal mock tabs with real `/api/payments/*` integrations.

### Priority 2 — Core CRM Completion

1. Build Compassion schema/API/UI for clients, cases, appointments, and reports.
2. Finish Donor communication telemetry and profile history wiring.
3. Complete role matrix editor with persisted scopes and policy enforcement.
4. Standardize loading/error/empty state handling across core pages.

### Priority 3 — Important Growth Tools

1. **Blog Builder Tool (major planned feature):**
   - Blog post editor, draft/publish, categories/tags, featured image, SEO fields, slug/permalink, author, publish date, revisions.
   - Public blog feed + single post pages.
   - Embed options (iframe/script), embed-safe styles, RSS and sitemap support where practical.
2. **Website Embed System:**
   - Embeddable donation form, newsletter signup, blog feed, event ticket widget, volunteer form, contact form, resource lists, appointment request.
   - Output options: iframe embed code, script embed code, hosted public link.
   - Mobile-friendly and brandable output.
3. **Events Manager CRM Expansion:**
   - Ticket types, public ticket pages, sponsors, seating charts, QR check-in, walk-ins, badges, communications, post-event donor follow-up.
4. **Import/Data Mapping Expansion:**
   - Saved templates, duplicate merge options, import history, rollback/safe review, error report improvements across donors/clients/guests/sponsors/events/donations/communications.
5. **Email and Newsletter Builder Expansion:**
   - Rich templates, drag/drop blocks, media blocks, CTA blocks, merge fields, segmented sends, test/scheduled sends, unsubscribe handling, delivery/open/click metrics.
6. **Constituent Timeline Expansion:**
   - Unified timeline for donations, event attendance/orders, sponsorships, emails, tasks, notes, imports, and approved Compassion interactions.
7. **Versioning/Release Visibility:**
   - App version/build date/changelog/release notes with feature readiness labels in-app.
8. **TopBar App Drawer Expansion:**
   - Temporarily keep TopBar app launcher button hidden while launcher rollout criteria and app list governance are finalized.
   - Re-enable only after approved app inventory, permissions review, and operator guidance are documented.
   - Keep CRM modules out of the app drawer and use it for standalone tools/apps only.
   - First app targets include Trivia Night workflows and future nonprofit mini-app experiences.
9. **Standalone App Platform Rules:**
   - Keep app routes under `/apps/*` with app-local shell/navigation.
   - Preserve CRM data isolation by default; allow access only through explicit integration and permissions.
   - Keep app UX platform-consistent while excluding CRM top-search and CRM AI controls unless explicitly required.

### Priority 4 — Nice-to-Have Improvements

1. Advanced analytics widgets and benchmark comparisons.
2. Workflow automation templates and recommendation assistant.
3. Enhanced UI polish for dashboards and settings pages.
4. Additional export and printable assets for events/campaign operations.

## 15. Agent Instructions for Future Work

> Future agents must always verify whether a feature is connected to real data before marking it complete. A good-looking UI is not considered complete unless it reads/writes real data, handles errors, and works through the intended user flow.

Required behavior:
1. Always cite evidence paths (file + route/endpoint) when marking status.
2. Never classify a scaffold route as complete.
3. Keep `docs/status/*.md` and `/settings/project-status` synchronized after major feature changes.
4. Add TODO comments near active placeholder data code.
5. Update this file when module readiness materially changes.
