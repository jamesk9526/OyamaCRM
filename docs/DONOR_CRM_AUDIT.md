# DonorCRM Audit

Last updated: 2026-05-14

This audit is DonorCRM-only and is intended to guide safe, staged improvements without breaking existing routes, APIs, or workflows.

Status labels used in this document:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

| Area | Status | Evidence | Risks | Next Step |
|---|---|---|---|---|
| Dashboard command center | Partially Working | [app/page.tsx](app/page.tsx), [server/src/routes/reports.ts](server/src/routes/reports.ts) | KPI coverage is strong but action-first stewardship triage is still maturing. | Keep command-center widgets API-backed and action-oriented. |
| Constituents list | Working | [app/constituents/page.tsx](app/constituents/page.tsx), [server/src/routes/constituents.ts](server/src/routes/constituents.ts) | Deep dedupe handling and saved segments are limited. | Add non-destructive duplicate review improvements in Data Tools. |
| Constituent profile | Working | [app/constituents/[id]/page.tsx](app/constituents/[id]/page.tsx), [server/src/routes/constituents.ts](server/src/routes/constituents.ts) | Some stewardship context (owner/next best action) can be clearer. | Expand profile workspace actions without changing route contracts. |
| Donations list/entry | Working | [app/donations/page.tsx](app/donations/page.tsx), [app/donations/new/page.tsx](app/donations/new/page.tsx), [server/src/routes/donations.ts](server/src/routes/donations.ts) | Acknowledgment workflow is distributed across fields and linked tools. | Continue unifying thank-you status visibility using existing fields. |
| Campaigns | Working | [app/campaigns/page.tsx](app/campaigns/page.tsx), [app/campaigns/[id]/page.tsx](app/campaigns/[id]/page.tsx), [server/src/routes/campaigns.ts](server/src/routes/campaigns.ts) | Cross-campaign comparison/reporting depth is still limited. | Extend campaign insights in reports without schema renames. |
| Grants | Working | [app/grants/page.tsx](app/grants/page.tsx), [server/src/routes/grants.ts](server/src/routes/grants.ts), [tests/smoke/grants-crud.test.ts](tests/smoke/grants-crud.test.ts) | Status and workflow complexity can introduce operator mistakes. | Keep strict status validation and add clearer UX hints. |
| Payments | Partially Working | [app/payments/page.tsx](app/payments/page.tsx) | Processor onboarding and webhook operations are intentionally hidden. | Keep ledger stable; ship processor APIs before re-enabling advanced tabs. |
| Tasks | Working | [app/tasks/page.tsx](app/tasks/page.tsx), [server/src/routes/tasks.ts](server/src/routes/tasks.ts) | Segment-driven bulk creation is still limited. | Add bulk creation previews and guardrails. |
| Meetings | Working | [app/meetings/page.tsx](app/meetings/page.tsx), [server/src/routes/meetings.ts](server/src/routes/meetings.ts) | Timeline/report joins need deeper surfacing in reports UI. | Add report slices for meetings + stewardship outcomes. |
| Communications | Partially Working | [app/communications/page.tsx](app/communications/page.tsx), [server/src/routes/email-campaigns.ts](server/src/routes/email-campaigns.ts) | Delivery telemetry is partially simulated depending on provider setup. | Expand provider/webhook-backed delivery evidence. |
| Letters and Printables | Partially Working | [app/letters-printables/page.tsx](app/letters-printables/page.tsx), [server/src/routes/letters.ts](server/src/routes/letters.ts), [server/src/services/letters-execution.ts](server/src/services/letters-execution.ts) | PDF export and batch generation are still partial. | Prioritize polished single-letter workflow; keep partial features labeled. |
| LiveCom | Working | [app/livecom/page.tsx](app/livecom/page.tsx), [server/src/routes/livecom.ts](server/src/routes/livecom.ts), [tests/smoke/livecom-workflow.test.ts](tests/smoke/livecom-workflow.test.ts) | Queue and assignment workflow can still be expanded. | Add stronger owner/SLA filtering and escalation views. |
| Steward Paths (legacy + sequence) | Partially Working | [app/automations/page.tsx](app/automations/page.tsx), [server/src/routes/automations.ts](server/src/routes/automations.ts), [server/src/routes/steward-paths.ts](server/src/routes/steward-paths.ts) | Builder depth, branching, and long-window diagnostics are incomplete. | Continue donor-first sequence hardening with draft-first email rules. |
| Steward Signals | Partially Working | [app/steward-signals/page.tsx](app/steward-signals/page.tsx), [app/steward-signals/email-draft-studio/page.tsx](app/steward-signals/email-draft-studio/page.tsx), [app/components/steward/StewardSignalsPage.tsx](app/components/steward/StewardSignalsPage.tsx), [app/components/steward/StewardDonorResearchWorkspace.tsx](app/components/steward/StewardDonorResearchWorkspace.tsx), [app/components/steward/StewardTodaysFocusPanel.tsx](app/components/steward/StewardTodaysFocusPanel.tsx), [server/src/routes/steward-signals.ts](server/src/routes/steward-signals.ts), [server/src/services/steward-intelligence-engine.ts](server/src/services/steward-intelligence-engine.ts) | Steward Signals now operates as a dashboard-first donor intelligence workspace with Today Focus, expanded KPI layer, card-first opportunities, research mode, and cohort builder. Signal data now requires live Steward AI runtime (no rules/demo fallback); segment/export automation and some one-click handoff flows remain partially wired. | Keep suggestion language explicit, maintain confirm-first task/draft actions, and continue test coverage for research/cohort/report handoff routes before moving to Working status. |
| Volunteers | Partially Working | [app/volunteers/page.tsx](app/volunteers/page.tsx) | Uses direct fetch pattern instead of shared authenticated client helper. | Migrate to shared fetch helper to reduce auth drift risk. |
| Reports | Working | [app/reports/page.tsx](app/reports/page.tsx), [server/src/routes/reports.ts](server/src/routes/reports.ts), [tests/smoke/reports-smoke.test.ts](tests/smoke/reports-smoke.test.ts) | Some report workflows need clearer definitions and scheduling depth. | Add report definitions and recurring delivery. |
| Data Tools | Partially Working | [app/data-tools/page.tsx](app/data-tools/page.tsx), [app/data-tools/import/page.tsx](app/data-tools/import/page.tsx) | Merge operations and deeper data-quality checks are not fully centralized. | Expand data quality checks and keep merge changes explicit and review-first. |
| Custom Fields | Working | [app/custom-fields/page.tsx](app/custom-fields/page.tsx), [server/src/routes/custom-fields.ts](server/src/routes/custom-fields.ts) | Over-customization can create inconsistent data entry standards. | Add stricter field governance guidance in office docs. |
| Sidebar navigation | Working | [app/components/layout/sidebar-configs.tsx](app/components/layout/sidebar-configs.tsx), [app/components/layout/Sidebar.tsx](app/components/layout/Sidebar.tsx), [tests/unit/crm-sidebar-navigation.test.ts](tests/unit/crm-sidebar-navigation.test.ts) | Group changes can confuse users if docs and help are not synced. | Keep donor IA changes mirrored in docs and tests. |
| Topbar donor context | Partially Working | [app/components/layout/TopBar.tsx](app/components/layout/TopBar.tsx) | Context can feel implicit without module identity reinforcement. | Keep module identity visible while preserving existing search/switcher behavior. |

## Do Not Touch Yet (Without Deeper Dependency Audit)

- Donor route names and deep links currently used by tests and help docs.
- Donation and constituent schema field names used across API routes and reports.
- Shared auth/session behavior in topbar/search and `apiFetch` usage patterns.
- Existing smoke/e2e paths until equivalent coverage is in place.

## Suggested Safe Sequence

1. Dashboard command-center improvements with real data only.
2. Donation acknowledgment clarity using existing donation fields.
3. Single-letter workflow polish before batch/PDF expansion.
4. Steward Paths donor-first sequence hardening.
5. Documentation and test alignment on every change.
