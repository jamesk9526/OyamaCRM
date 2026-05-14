# OyamaCRM Remaining Implementation Backlog

> Canonical reality/status audit is now maintained in `docs/MASTER_PLAN.md`.
> Keep this file focused on execution backlog items and keep status claims synchronized with:
> - `docs/MASTER_PLAN.md`
> - `docs/status/features.md`
> - `/settings/project-status`

> **Active source of truth.** This file is the consolidated backlog for work
> that still needs to be implemented. Shipped work has been removed from the
> active checklist so the planning set stays focused on what is left.
>
> Use this file first, then open the linked phase packet when you need deeper
> scope, constraints, or exit criteria.

---

## How to use this backlog

1. Start with the earliest phase that still has unchecked work.
2. Implement in vertical slices: schema → API → UI → tests → docs.
3. Update this file first when new remaining work is discovered.
4. Keep phase packets aligned with the remaining items listed here.

Legend: `[ ]` pending · `[~]` partial / in progress

---

## Phase 00 — Setup, Settings, and Workspace Bootstrap

Packet: [`phase-00-setup-onboarding-settings.md`](../plans/phase-00-setup-onboarding-settings.md)

- [ ] Finish **Users** management in Settings (add/edit/disable/invite/reset password).
- [ ] Finish **Roles & Scopes** management with a real permission matrix editor.
- [ ] Finish **Workspaces** settings so donor and Compassion access can be toggled intentionally.
- [ ] Keep the TopBar app drawer dedicated to standalone apps (starts empty), with CRM module switching handled only by the module switcher.
- [~] Keep TopBar app drawer trigger temporarily hidden while standalone app launch criteria are finalized; continue using direct `/apps/*` routes until re-enabled.
- [ ] Keep standalone app routes under `/apps/*` on a basic shell that excludes CRM top search and CRM AI by default.
- [ ] Maintain app-to-CRM isolation by default and require explicit permission-scoped integrations for any shared data.
- [ ] Remove remaining hard-coded seeded-org assumptions (`org_demo`) from live routes and UI flows.
- [ ] Apply admin / RBAC guards consistently to sensitive settings and setup-recovery surfaces.
- [ ] Add backup, restore, and recovery runbooks for operators.

## Phase 01 — Foundation and Auth

Packet: [`phase-01-foundation-and-auth.md`](../plans/phase-01-foundation-and-auth.md)

- [ ] Standardize the API response envelope across remaining routes to `{ success, data, meta, error }`.
- [ ] Expand route-level RBAC beyond auth-only middleware on sensitive CRUD, export, and settings endpoints.
- [ ] Generalize audit logging so high-risk routes write consistently without per-route duplication.
- [ ] Add CI / quality automation for lint, unit tests, and smoke paths.

## Phase 02 — Constituents and Timeline

Packet: [`phase-02-constituents-and-timeline.md`](../plans/phase-02-constituents-and-timeline.md)

- [ ] Add soft-credit / influencer relationship modeling.
- [ ] Add custom fields per constituent.
- [ ] Build tag management UI and bulk tag application.
- [ ] Build saved segments / smart lists.
- [ ] Finish CSV import + dedupe workflow.
- [ ] Add bulk edit for filtered constituent sets.
- [ ] Surface wealth-screening / capacity indicators.

## Phase 03 — Donations, Funds, Campaigns

Packet: [`phase-03-donations-funds-campaigns.md`](../plans/phase-03-donations-funds-campaigns.md)

- [ ] Build usable pledge management and payment-application workflows.
- [ ] Generate receipts / acknowledgments (PDF + email).
- [ ] Add soft-credit attribution at the donation level.
- [ ] Add in-kind valuation workflow.
- [ ] Add stock / wire confirmation handling.
- [ ] Add refund / chargeback handling with linked activity.

## Phase 04 — Receipts, Tasks, Communications

Packet: [`phase-04-receipts-tasks-communications.md`](../plans/phase-04-receipts-tasks-communications.md)

- [ ] Add inline editing on task rows (priority, due date, assignee).
- [ ] Add reusable task templates for stewardship workflows.
- [ ] Add bulk task creation from a segment.
- [ ] Build acknowledgment letter / receipt templates.
- [ ] Add print / mail-merge export for offline sends.
- [ ] Add communication timeline logging per constituent.
- [ ] Add provider-backed delivery, bounce, open, and click tracking.
- [ ] Add SMS provider abstraction beyond placeholders.

## Phase 05 — Dashboard and Reports

Packet: [`phase-05-dashboard-and-reports.md`](../plans/phase-05-dashboard-and-reports.md)

- [ ] Add year-over-year revenue visuals.
- [ ] Add donor retention and donor-level summary cards.
- [ ] Add engagement heatmap surfaces.
- [ ] Build the custom report builder.
- [ ] Add scheduled summary emails.
- [ ] Finish CSV / Excel / PDF exports.
- [ ] Add freshness metadata and caching for expensive aggregates.

## Phase 06 — Groups, Segments, Automation

Packet: [`phase-06-groups-segments-automation.md`](../plans/phase-06-groups-segments-automation.md)

- [ ] Build static groups and group membership management.
- [ ] Build the dynamic segment rule engine and preview UI.
- [ ] Add in-place automation editing and action reordering.
- [ ] Replace manual run counters with a real execution engine.
- [ ] Add run history, retry handling, and audit traces for automations.
- [ ] Expand triggers and action library coverage.

## Phase 07 — Events and Gala Operations

Packet: [`phase-07-events-and-gala.md`](../plans/phase-07-events-and-gala.md)

- [ ] Build registration / ticketing workflows.
- [ ] Add table seating and host workflows.
- [ ] Add sponsor tracking and event revenue categorization.
- [ ] Build check-in and walk-in flows.
- [ ] Add auction workflows and post-event reporting.
- [ ] Tie volunteer-hour logging into events.

## Phase 08 — Security, Integrations, AI, Operations

Packet: [`phase-08-security-integrations-ai-ops.md`](../plans/phase-08-security-integrations-ai-ops.md)

- [ ] Complete CSRF posture review for cookie-based refresh flows.
- [ ] Add two-factor auth (TOTP).
- [ ] Build the audit log viewer UI.
- [ ] Add field-level encryption for sensitive notes/files where needed.
- [ ] Build payment processor integrations and webhook hardening.
- [ ] Build import/export reliability, rollback, and duplicate-handling tooling.
- [ ] Add private file handling + signed access patterns.
- [ ] Add queue / background job visibility, retries, and dead-letter handling.
- [ ] Add AI provider abstraction with human approval before send/save.

## Phase 09 — Compassion Workspace

Packet: [`phase-09-compassion-workspace.md`](../plans/phase-09-compassion-workspace.md)

- [~] Compassion shell, route group, and module switcher exist, but server-side workspace isolation is still missing.
- [ ] Add workspace-aware middleware and session context for Compassion routes.
- [ ] Add Compassion-side data models (`Client`, `Appointment`, `ClientFile`, `Referral`, etc.).
- [ ] Replace Compassion placeholder pages with real CRUD flows and reports.
- [ ] Enforce workspace-specific permissions and audit logging on every sensitive action.

---

## Cross-cutting quality work

- [ ] Add React component tests for interactive UI modules.
- [ ] Add route-level tests for high-risk branches and destructive flows.
- [ ] Add a CI pipeline that runs lint + tests.
- [ ] Add coverage thresholds for shared app/server utilities.
- [ ] Add an end-to-end happy path that covers setup → login → constituent → donation → follow-up.

---

## Planning hierarchy

- **Active backlog:** this file
- **Per-phase detail:** `phase-00` through `phase-09`
- **Execution workflow:** `docs/plans/phase-rollout-plan.md`
- **Archived source briefs:** the long-form legacy plan files now act as reference notes only
