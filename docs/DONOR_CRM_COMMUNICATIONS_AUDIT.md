# DonorCRM Communications Audit

Last updated: 2026-05-16

## Audit Goal

Confirm the real implementation state of DonorCRM communications-related workflows before making integration changes.

## Audit Scope

- Communications workspace
- Email campaigns
- Email drafts
- Email builder
- Letters and printables integration
- Steward paths email/letter orchestration
- Tasks and timeline write-backs
- Donation acknowledgment relationship
- Dashboard and report linkage
- Sidebar and topbar discoverability

## Findings

| Area | Status | Persistence | Evidence | Notes |
|---|---|---|---|---|
| Communications campaign workspace | Partially Working | API-backed | app/communications/page.tsx, app/components/communications/CampaignWorkspace.tsx, server/src/routes/email-campaigns.ts | `/communications` opens directly to the campaign library. Campaign CRUD, project preview cards, embedded build workspace, scheduling, send, and delivery events exist; segment/log UX depth is still evolving. |
| Email campaign send safety | Working | API-backed | server/src/routes/email-campaigns.ts | Recipient filtering excludes doNotEmail/emailOptOut and validates SMTP/send constraints. |
| Campaign recipient timeline logging | Working | API-backed | server/src/routes/email-campaigns.ts | Send flow writes per-recipient Activity entries when constituent email matches. |
| Email Builder integration | Partially Working | API-backed | app/components/email-builder/EmailBuilderApp.tsx | Builder persists template/body from `/communications/[campaignId]?mode=build`, includes a mockup-inspired three-panel studio shell, donor-focused tile block library, lighter preview canvas, compact inspector tabs, workflow stage cues, grouped personalization fields, review checklist, CRM Branding Settings enforcement, and now preserves H1/H2/H3 plus email-safe rich-text formatting on generated output; advanced versioning and legacy-template migration are still incomplete. |
| Letters and printables | Partially Working | API-backed | server/src/routes/letters.ts, app/components/letters/* | Template CRUD, generated letters, status updates, and email-draft bridge are real; PDF and batch remain partial. |
| Letter to communication draft bridge | Working | API-backed | POST /api/letters/generated/:id/create-email-draft | Creates linked EmailCampaign draft and updates GeneratedLetter state. |
| Steward path draft emails | Partially Working | API-backed | server/src/routes/steward-paths.ts | Draft listing and status updates are real; broader orchestration UI depth is still partial. |
| Steward path generate letter step | Working | API-backed | server/src/services/steward-paths-sequence-engine.ts | Sequence steps call shared letter-generation service and can create linked tasks. |
| Donation acknowledgment linkage | Partially Working | API-backed | server/src/routes/donations.ts, app/components/donations/DonationTable.tsx | New mark-thanked endpoint and quick action added; broader cross-tool acknowledgment automation still partial. |
| Activity timeline visibility | Working | API-backed | server/src/routes/letters.ts, server/src/routes/tasks.ts, server/src/routes/email-campaigns.ts | Key communication events write Activity rows for constituent timeline history. |
| Dashboard communication attention | Partially Working | API-backed | app/components/dashboard/StewardshipAttentionWidget.tsx | Unthanked/lapsed metrics exist; additional communication queue widgets are still in progress. |
| Topbar search / sidebar discoverability | Working | API-backed/static index | app/components/layout/TopBar.tsx, app/components/layout/sidebar-configs.tsx, server/src/routes/search.ts | Core communication tools are discoverable and linked. |

## Duplication Risk Check

No second disconnected systems were introduced in this pass.

- Communications remains the campaign lifecycle home.
- Email Builder remains editor-only and is embedded in the campaign workspace; direct `/email-builder` access is compatibility-only.
- Letters remain print/mail/PDF in the separate Letters & Printables workspace and are not surfaced as a Communications tab.
- Steward paths call existing tools rather than introducing alternate channels.

## Gaps

- Unified communication log filtering/export is still shallow.
- Full visual steward path builder remains partial.
- Fully centralized acknowledgment orchestration is not complete.
- Advanced email builder revision history and merge validation are not complete.

## Confidence Notes

- Persistence and route behavior were confirmed directly in API route code and UI call sites.
- Areas marked Partially Working have real persistence but incomplete workflow depth or UX controls.
