# OyamaCRM Production Readiness Audit — 2026-05-08

## Executive Summary

OyamaCRM is a **meaningful internal MVP** with real donor CRM foundations, but it is **not yet production-ready**. Core donor workflows such as authentication, onboarding, constituent CRUD, donation entry, campaigns, tasks, and basic reporting are present in code and have usable UI + API paths. However, route-level RBAC remains incomplete, many settings/admin surfaces are placeholders, communications are still missing media/merge-field/history depth, and the planned Compassion workspace has not started.

## Audit Date

- **Audit Date:** 2026-05-08
- **Repo Branch:** `copilot/improve-test-coverage-and-plan`
- **Git Commit (baseline before this audit patch):** `a7e4b31`
- **App Version:** `0.1.0`

## Overall Readiness Score

**52%** — meaningful internal MVP with notable production, security, and operational gaps.

## Major Working Features

- Authentication and refresh-token rotation — `server/src/routes/auth.ts`, `server/src/lib/auth.ts`
- First-run setup enforcement — `server/src/routes/setup.ts`, `app/login/page.tsx`, `app/setup/page.tsx`
- Constituents CRUD and detail flow — `app/constituents/*`, `server/src/routes/constituents.ts`
- Donations CRUD — `app/donations/*`, `server/src/routes/donations.ts`
- Campaigns CRUD — `app/campaigns/page.tsx`, `server/src/routes/campaigns.ts`
- Tasks create/list/complete/delete — `app/tasks/page.tsx`, `server/src/routes/tasks.ts`
- Core reports endpoints — `server/src/routes/reports.ts`
- Settings foundation + organization settings form — `app/settings/layout.tsx`, `app/settings/organization/page.tsx`, `server/src/routes/settings.ts`

## Major Partial Features

- Communications/email builder — `app/email-builder/*`, `app/communications/page.tsx`, `server/src/routes/email-campaigns.ts`
- Dashboard and reports UX — `app/page.tsx`, `app/reports/page.tsx`, `server/src/routes/reports.ts`
- Automations — `app/automations/page.tsx`, `server/src/routes/automations.ts`
- Events — `app/events/page.tsx`, `server/src/routes/events.ts`
- Audit logging — `server/src/lib/audit.ts`, `prisma/schema.prisma`
- Settings workspace overall — most tabs remain placeholders under `app/settings/*`

## Major Missing Features

- Workspace-scoped donor/compassion separation — planned in `PLAN_FILES/phase-09-compassion-workspace.md`
- User management UI and permission scope model — `app/settings/users/page.tsx`, `app/settings/roles/page.tsx`
- Media library, uploads, attachments, hosted video/email workflow
- Communication timeline logging and provider-backed tracking
- Export pipelines and permission-gated exports
- Queue/job processing and retry monitoring
- Backup/restore documentation and operational runbook

## Security Concerns

- **High — Route-level RBAC is incomplete.** `requireAuth`/`requireRole` exist, but most feature routes are mounted without them. Evidence: `server/src/index.ts`, `server/src/middleware/requireAuth.ts`, `server/src/middleware/requireRole.ts`.
- **High — Workspace isolation is not implemented.** Compassion workspace rules are fully planned but absent from schema/routes. Evidence: `PLAN_FILES/phase-09-compassion-workspace.md`, absence of `/compassion/*` route group and workspace-aware middleware.
- **Medium — API response shapes are inconsistent.** Some routes return `{ data }`, others raw records or mixed error payloads. Evidence: `server/src/routes/auth.ts`, `server/src/routes/settings.ts`, `server/src/routes/email-campaigns.ts`.
- **Medium — Audit coverage is incomplete.** Sensitive write actions exist without universal audit logging, and there is no audit viewer UI. Evidence: `server/src/lib/audit.ts`, `app/settings/audit/page.tsx`.
- **Medium — Smoke tests and runtime API access depend on `DATABASE_URL` without documented operational fallback.** Evidence: `prisma/schema.prisma`, `tests/smoke/*`.
- **Low — Error logging is verbose and unstructured.** Global error handler logs stack traces directly. Evidence: `server/src/index.ts`.

## Data / Database Concerns

- Prisma schema is substantial and usable, but **no migrations directory** was found.
- Seed script exists, but smoke coverage depends on an external MySQL database and configured `DATABASE_URL`.
- Planned compassion/client data models do not exist yet.

## API Concerns

- Health endpoint existed but needed version/build enrichment and API-prefixed parity.
- Mixed response envelopes make frontend integration less predictable.
- Many routes do not appear to enforce permissions beyond implicit access.

## Frontend Concerns

- Numerous routes are **placeholder-only**: users, roles, audit, security, forms, integrations, scheduling, workspaces, donor, compassion, reports UX, volunteers, data tools.
- Some dashboard/list pages currently fail repo-wide lint rules due new React hook purity checks.
- System/version visibility was previously missing.

## Documentation Concerns

- Planning files were ahead of implementation in several areas and needed status notes.
- No `.env.example` existed before this audit pass.
- README local-development guidance did not mention the current install/test constraints.

## Testing Gaps

- Unit tests cover selected utilities well.
- Smoke tests exist but currently fail locally without `DATABASE_URL`.
- No component tests with React Testing Library.
- No E2E happy-path test for login → constituent → donation → stewardship flow.
- No permission/RBAC-specific tests.

## Production Deployment Gaps

- PM2 config exists (`ecosystem.config.cjs`) but lacks a fuller ops runbook.
- No backup/restore documentation found.
- No queue/process monitoring strategy found.
- No documented deployment checklist for env vars, Prisma migration, seeding, rollback, or recovery.

## Recommended Next Sprint

1. Finish route-level RBAC and scope enforcement across all write/sensitive routes.
2. Build Users + Roles & Scopes settings pages with real backend APIs.
3. Standardize API response envelope across Express routes.
4. Add audit coverage/viewer for auth, settings, users, exports, and communications.
5. Expand communications with media uploads, merge fields, and per-constituent history.
6. Add timeline logging for email sends/tests/schedules and receipt events.
7. Implement export/report permission gating.
8. Add environment/runbook docs including backup/restore.
9. Add component tests and an end-to-end donor stewardship happy path.
10. Start Compassion Phase C0 only after RBAC/workspace boundaries are real.

## Detailed Feature Matrix

| Feature | Workspace | Status | Evidence | Missing | Next Action |
|---|---|---|---|---|---|
| Auth & Setup | Core | Working | `server/src/routes/auth.ts`, `server/src/routes/setup.ts`, `app/login/page.tsx`, `app/setup/page.tsx` | Broad route-level permission checks | Adopt permission middleware across feature routes |
| Settings Workspace | Core | Partial | `app/settings/layout.tsx`, `app/components/settings/SettingsSidebar.tsx`, `app/settings/organization/page.tsx` | Most tabs are placeholders | Implement users, roles, audit, security, integrations |
| Constituents | OyamaCRM | Working | `app/constituents/*`, `server/src/routes/constituents.ts` | Import/dedupe/custom fields | Build import + dedupe wizard |
| Donations | OyamaCRM | Working | `app/donations/*`, `server/src/routes/donations.ts` | Receipts, refunds, pledges UI | Add receipt/ack workflow |
| Campaigns | OyamaCRM | Working | `app/campaigns/page.tsx`, `server/src/routes/campaigns.ts` | Drill-down analytics | Add campaign detail/reporting views |
| Tasks | OyamaCRM | Partial | `app/tasks/page.tsx`, `server/src/routes/tasks.ts` | Inline edit, templates, bulk operations | Add stewardship templates and inline edit |
| Email Builder | OyamaCRM | Partial | `app/email-builder/*`, `server/src/routes/email-campaigns.ts` | Media uploads, merge fields, history, stats depth | Implement communication center upgrade |
| Communications Dashboard | OyamaCRM | Partial | `app/communications/page.tsx`, `app/components/communications/NewCampaignModal.tsx` | Sent/failed detail, timeline wiring, permissions | Add campaign detail + communication history |
| Reports | OyamaCRM | Partial | `server/src/routes/reports.ts`, `app/reports/page.tsx` | Exports, freshness, richer UI | Add export endpoints and report UI |
| Automations | OyamaCRM | Partial | `server/src/routes/automations.ts`, `app/automations/page.tsx` | No execution engine | Build automation runner/history |
| Events | OyamaCRM | Partial | `server/src/routes/events.ts`, `app/events/page.tsx` | Registration, gala flows, seating | Build registration/ticketing |
| User Management | Core | Placeholder | `app/settings/users/page.tsx`, `prisma/schema.prisma` (`User`) | All real user admin flows | Add APIs and UI for users/scopes |
| Audit Viewer | Core | Placeholder | `app/settings/audit/page.tsx`, `prisma/schema.prisma` (`AuditLog`) | Viewer UI and broader event coverage | Build audit list/filter page |
| Integrations | Core | Placeholder | `app/settings/integrations/page.tsx` | Provider connections/webhooks | Add provider abstractions |
| Compassion Workspace | Compassion | Not Started | Planning only in `PLAN_FILES/phase-09-compassion-workspace.md` | All workspace features | Start with workspace switcher and scoped middleware |

## File Evidence

- Frontend routes: `app/`
- Settings placeholders: `app/settings/*.tsx`
- API routes: `server/src/routes/*.ts`
- Health/boot: `server/src/index.ts`
- Schema and seed: `prisma/schema.prisma`, `prisma/seed.ts`
- Tests: `tests/unit/*`, `tests/smoke/*`
- Planning docs: `PLAN_FILES/*.md`

## Production Readiness Checklist

- [x] Authentication is stable
- [~] RBAC is enforced server-side
- [ ] Workspace permissions are enforced
- [~] API response envelope is consistent
- [~] Input validation exists on all write endpoints
- [~] Audit logs cover sensitive actions
- [~] Database migrations are clean
- [~] Seed data is reliable
- [~] Error handling is consistent
- [~] Frontend loading/error states exist
- [ ] No placeholder buttons remain in core flows
- [~] Sensitive data is protected
- [ ] Client/donor data separation is enforced
- [~] Email sending has approval safeguards
- [x] Bulk sends respect opt-outs
- [ ] File uploads are permission-gated
- [x] Public endpoints are rate-limited
- [ ] Payment/webhook endpoints are idempotent
- [ ] Background jobs have retry/failure handling
- [~] Reports are permission-gated
- [ ] Exports are permission-gated
- [~] Tests cover critical workflows
- [~] Deployment scripts are documented
- [~] Environment variables are documented
- [ ] Backup/restore process is documented
- [x] Version info is visible in the app
