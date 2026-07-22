# Production Readiness Checklist

Last updated: 2026-07-22 (OyamaEmail image delivery and compact letters update)

This file is the release-gate source of truth for production readiness.

## 2026-07-22 OyamaEmail Image Delivery Snapshot

| Release gate | Status | Evidence |
|---|---|---|
| Top-level and structured-column image blocks upload through the organization-scoped campaign media endpoint | Working | Recursive block updates and shared upload wiring in `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx`; source contract coverage passed. |
| Organization logos and uploaded images use absolute public URLs in recipient HTML | Working | Public-origin enrichment in `server/src/services/organization-branding.ts`; shared render-time URL resolution in `server/src/services/oyama-email/email-render-service.ts`; renderer coverage passed. |
| Production public origin is configured and documented for self-hosted delivery | Working | `.env.production` points `NEXT_PUBLIC_APP_URL` / `FRONTEND_ORIGIN` at the public CRM host; `.env.example` and `docs/HOSTINGER_DEPLOY_README.md` document the requirement. |
| Live Gmail/Outlook inbox image verification | Partially Working | Automated rendering confirms absolute image URLs; repeat one real proof send after deployment/restart to verify remote inbox access and any receiver-side image-proxy policy. |

Validation: focused Email renderer/source/API suite passed 34/34; web and server typechecks passed; targeted ESLint completed with 0 errors.

## 2026-07-22 Compact Letter Layout and Reviewed Validation Override

| Release gate | Status | Evidence |
|---|---|---|
| Browser preview and server PDF use a compact donor-address letter format | Working | `app/components/letters/LetterPage.tsx`, `app/lib/letters/letter-document.ts`, `server/src/routes/letters.ts` |
| The organization address is absent from the top header; recipient address is top-right with the date | Working | Shared browser preview plus `renderGeneratedLetterPdf` chrome rendering |
| Staff can explicitly acknowledge reviewable generation validation notes | Working | `acknowledgeValidationOverride` is sent by the Generate workspace, recorded in generated-letter metadata and audit history |
| Mailing safety remains server enforced | Working | `SUPPRESSED_DO_NOT_MAIL` and a missing mail-queue address remain non-bypassable in `canAcknowledgeGenerationValidation` |

Validation: focused Letter document/PDF/source suite passed 41/41; `pnpm typecheck` passed; targeted ESLint completed with 0 errors and 20 existing warnings in the large Letters workspace.

## 2026-07-20 Donor Campaign Workspace Audit

| Release gate | Status | Evidence |
|---|---|---|
| Campaign list presents portfolio scope, health, and goal progress in the shared donor visual system | Working | `app/campaigns/page.tsx`, `app/components/campaigns/CampaignCard.tsx` |
| Campaign create, scoped API loads, active/inactive filtering, detail/edit navigation, confirmed delete, and Steward analysis remain wired | Working | `app/campaigns/page.tsx`, `app/components/campaigns/CampaignCard.tsx` |
| Dashboard, campaign, Letter, and Email UI source contracts remain green | Working | Focused smoke suite passed 27/27. |
| Web and server type safety after the donor UI pass | Working | `pnpm typecheck` passed. |
| Live responsive visual walkthrough | Partially Working | In-app browser target was unavailable; repeat a live desktop/tablet/mobile check before release. |

Detailed evidence: `docs/status/audit-artifacts/2026-07-20-donor-campaign-workspace-audit.md`.

## 2026-07-20 Email/Letter Block Round-Trip Snapshot

| Release gate | Status | Evidence |
|---|---|---|
| Email columns preserve structured child blocks instead of degrading to HTML strings | Working | `server/src/services/oyama-email/email-render-service.ts`, renderer suite coverage |
| Nested email column blocks render in preview, proof, and send output | Working | Text/image/button/file-link column coverage passed in `tests/unit/oyama-email-render-service.test.ts` |
| Email and Letter template companions are draft-first and reviewable | Working | `POST /api/oyama-email/templates/:id/create-letter-template`, `POST /api/letters/templates/:id/create-oyama-email-template` |
| Email-originated Letter companion restores the original structured email document on return | Working | Private `oyama-communication-roundtrip-v1` template envelope; source contract coverage passed. |

Validation: focused Email/Letter source and renderer suite passed 31/31; web and server typechecks passed.

## 2026-07-19 Letters/Email Workflow and Documentation Snapshot

| Release gate | Status | Evidence |
|---|---|---|
| Letters generation uses a clear Setup → Recipients → Preview → Generate primary path | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `tests/smoke/letter-builder-ui-source.test.ts` |
| Preview and generation retain advanced capabilities without presenting duplicate primary actions | Working | `app/components/letters/OyamaLettersWorkspace.tsx` |
| Letter preview can advance to Generate without requiring an existing generated letter | Working | Removed circular `canOpenFinalStep` gate; covered by `tests/smoke/letter-builder-ui-source.test.ts` |
| OyamaEmail rendering, merge preview, and campaign API workflow | Working | Focused email suite passed 40/40 across five files, including render, merge-preview, and campaign-workflow API coverage. |
| Canonical in-app Docs & Walkthroughs routes exist for both systems | Working | `/oyama-letters/docs`, `/oyama-email/docs`; compatibility redirect retained at `/oyama-letters/how-to` |
| Email preview has one canonical entry point for visual, responsive-width, and plain-text checks | Working | `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx`, `tests/smoke/oyama-email-workspace-source.test.ts` |
| Letter generation mode defaults correctly from the recipient count | Working | Single for one recipient, Batch for multiple; explicit route/staff choice remains supported. |
| Live browser walkthrough | Partially Working | The in-app browser surface was unavailable; source tests, API tests, lint, typecheck, and production build are the available regression evidence. |

Detailed evidence: `docs/status/audit-artifacts/2026-07-19-letters-email-workflow-simplification.md`.

## 2026-07-19 Dashboard and Communication Studio Visual Snapshot

| Release gate | Status | Evidence |
|---|---|---|
| Dashboard sidebar, metrics, live charts, action cards, and customization controls use one responsive visual language | Working | `app/components/layout/CrmSidebar.tsx`, `app/components/dashboard/NaturalisticDonorDashboard.tsx`, `app/components/dashboard/GivingTrendChart.tsx`, `app/components/dashboard/DashboardLayoutModal.tsx` |
| Letter canvas preserves working edit, merge, preview, PDF, recovery, and publish paths while exposing live readiness | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `tests/smoke/letter-builder-ui-source.test.ts` |
| Email builder preserves block, preview, autosave, compliance, proof, and publish paths while exposing live readiness | Working | `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx`, `tests/smoke/oyama-email-workspace-source.test.ts` |
| Browser viewport and real inbox-client visual matrix | Partially Working | In-app browser access was unavailable. Repeat live desktop/tablet/mobile inspection and Gmail/Outlook rendering checks before the next production release. |

Validation evidence is recorded in `docs/status/audit-artifacts/2026-07-19-donor-dashboard-and-builder-visual-modernization.md`.

## 2026-07-19 Donor System Hardening Snapshot

| Release gate | Status | Evidence |
|---|---|---|
| Dashboard pending-acknowledgment count represents the full filtered dataset | Working | `app/features/donor-dashboard/services/dashboard-client-service.ts`, `app/components/dashboard/NaturalisticDonorDashboard.tsx`, `server/src/routes/donations.ts` |
| Dashboard acknowledgment actions open a real, clearable donation queue | Working | `app/components/dashboard/NaturalisticDonorDashboard.tsx`, `app/donations/page.tsx` |
| Letter print route preserves the staff-selected test recipient with organization/mail eligibility validation | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `app/components/letters/LetterPrintRoute.tsx`, `app/oyama-letters/templates/[templateId]/print/page.tsx`, `server/src/routes/letters.ts` |
| Letters and Email editors avoid browser-native prompt/alert UX | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx` |
| Cross-module workspace permission enforcement | Not Implemented | Existing release blocker; this pass retained route-level donor communication permissions but did not complete module-wide policy enforcement. |

Validation for this pass: focused unit/source suite 84/84; database-backed donor/Letters/Email API and source suite 60/60; `pnpm typecheck` passed; targeted ESLint completed with 0 errors and 23 pre-existing warnings; `pnpm build` passed and generated 198 routes.

## 2026-07-16 Letters and Email Production-Readiness Snapshot

| Item | Status | Evidence |
|---|---|---|
| Reusable email template review gate | Working | `app/components/oyama-email/OyamaEmailWorkspace.tsx`, `tests/smoke/oyama-email-workspace-source.test.ts` |
| Proof email uses a clear in-workspace recipient dialog | Working | `app/components/oyama-email/OyamaEmailWorkspace.tsx`, `tests/smoke/oyama-email-workspace-source.test.ts` |
| Two-page letter PDF headers, footers, lists, and quotes | Working | `server/src/routes/letters.ts`, `tests/unit/letters-pdf-layout.test.ts`, rendered proof recorded in `docs/status/audit-artifacts/2026-07-16-letters-email-production-readiness-pass.md` |
| Exact mixed inline typography and client-inbox screenshot matrix | Partially Working | The PDF block renderer supports paragraphs, headings, lists, images, tables, and quotes, but does not reproduce every rich-text inline treatment; automated Gmail/Outlook screenshot verification is not configured. |
| Letter chrome and generated-letter email handoff | Working | Selected/default header, footer, and signature paths are covered in `server/src/routes/letters.ts`; centered footer and signature PDF proof is recorded in `docs/status/audit-artifacts/2026-07-16-letters-email-production-readiness-pass.md`; the linked email-draft handoff is covered by `tests/smoke/api-smoke.test.ts`. |

Validation for this pass: focused Letters/Email suite passed 52/52, TypeScript typecheck passed, targeted ESLint passed with 0 errors, and a centered-header/footer/signature PDF proof was rendered and visually inspected. The full suite result is recorded with the final validation evidence in the dated audit artifact.

## 2026-07-16 Donor Dashboard Responsive Layout Snapshot

| Item | Status | Evidence |
|---|---|---|
| Compact desktop and mobile Donor Dashboard layout | Working | `app/components/dashboard/NaturalisticDonorDashboard.tsx`, `app/page.tsx`, `app/components/dashboard/DashboardWidget.tsx`, `tests/smoke/crm-visual-refresh-source.test.ts` |
| Dashboard responsive governance and office guidance | Working | `docs/architecture/workspace-layout-system.md`, `docs/DONOR_DASHBOARD.md`, `docs/howto/HOW_TO_USE.md` |
| Browser screenshot verification in this environment | Partially Working | In-app browser was unavailable; focused source contracts, targeted ESLint, and web/server typechecks passed. Repeat live viewport inspection at `1280x720`, `1366x768`, tablet, and phone widths when browser access is restored. |

## 2026-07-15 Letters and Email Output Formatting Snapshot

| Item | Status | Evidence |
|---|---|---|
| Letter bullets and numbered lists remain visible in editor, shared print view, and server PDF output | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `app/components/letters/LetterPage.tsx`, `server/src/routes/letters.ts`, `tests/unit/letters-pdf-layout.test.ts` |
| Letter PDFs preserve ordered starting numbers, nested list depth, and hanging indentation | Working | `server/src/routes/letters.ts`, `tests/unit/letters-pdf-layout.test.ts`, `docs/status/audit-artifacts/2026-07-15-letters-email-output-audit.md` |
| OyamaEmail lists render with inline client-safe styles and meaningful plain-text markers | Working | `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx`, `server/src/services/oyama-email/email-render-service.ts`, `tests/unit/oyama-email-render-service.test.ts` |
| Exact LetterPage-to-jsPDF typography parity | Partially Working | The server renderer still flattens mixed inline font treatments; use generated PDF preview as the final review surface. |
| Cross-client Gmail/Outlook rendering matrix | Partially Working | Canonical renderer now inlines list styles, but automated inbox-client screenshot testing is not configured. |

Validation for this pass: focused formatting/source contracts passed 41/41; web and server typechecks passed; targeted ESLint reported 0 errors. The full parallel suite passed 645/646, with the known Compassion scheduling capacity test passing 8/8 when isolated.

## 2026-07-13 Validation Snapshot

| Validation | Result | Status |
|---|---|---|
| `pnpm lint` | Passed with 0 errors and 125 warnings | Working |
| `pnpm typecheck` | Web and server typechecks passed | Working |
| `pnpm test` | 74/75 files and 638/639 tests passed under parallel load; the one Compassion scheduling failure passes 8/8 when isolated | Partially Working |
| `pnpm build` | Production build passed; 198 routes generated | Working |

Lint, typecheck, and build gates are green. The combined test lane remains partially working because a Compassion public-scheduling test intermittently receives a 404 under parallel suite load even though that file passes 8/8 in isolation. Other release risks include incomplete workspace permission enforcement, payment/webhook idempotency, export/upload authorization consistency, backup/restore documentation, and the non-blocking lint-warning backlog.

## 2026-07-14 Navigation Shell Stability Pass

| Item | Status | Evidence |
|---|---|---|
| Shared sidebar/topbar responsive shell | Partially Working | `app/components/layout/AppShell.tsx`, `app/components/layout/TopBar.tsx`, `app/components/layout/CrmSidebar.tsx`, `app/components/layout/MobileSidebarDrawer.tsx`; source smoke 9/9, `pnpm typecheck` passed, `pnpm build` passed (198 routes), focused ESLint had 0 errors (2 existing warnings in `DonorMegaMenu.tsx`) |
| Live visual viewport audit | Partially Working | Browser-backed verification is still required. The in-app browser surface was unavailable in this session and no local web/API server was listening for the Playwright responsive audit. |

## Design and Workflow Governance Gate (required)

Before a major workspace feature can be considered `Working` for release claims, it must satisfy all of the following:

1. Dedicated workspace ownership
   - Major workflow uses a canonical route family and does not depend on duplicate parallel legacy pages.
2. One-direction progression
   - Primary staff path is clear: list/overview -> build/edit -> review/validate -> publish/activate -> history/activity.
3. Functional-only UI
   - No fake data, dead controls, or placeholder behavior presented as complete production behavior.
4. Legacy transition truthfulness
   - Compatibility redirects may exist, but docs and UI clearly identify canonical routes.
5. Evidence-backed status
   - Validation artifacts exist for changed scope (typecheck/build/tests and route-level behavior checks where applicable).

If any item above is not met, status must remain `Partially Working`, `Demo Only`, `Broken`, or `Not Implemented`.

## Steward Paths Dedicated Workspace Phase 1 Snapshot (2026-05-30)

| Item | Status | Evidence |
|---|---|---|
| `/steward-paths/*` uses a dedicated workspace shell instead of DonorCRM page chrome | Working | `app/components/layout/AppShell.tsx`, `app/steward-paths/layout.tsx`, `app/components/steward-paths/StewardPathsAppShell.tsx` |
| Stage routes are explicit and map to live surfaces (Library, Builder, Enrollments, Review, Activity, Analytics, Settings) | Working | `app/steward-paths/page.tsx`, `app/steward-paths/builder/page.tsx`, `app/steward-paths/enrollments/page.tsx`, `app/steward-paths/review/page.tsx`, `app/steward-paths/activity/page.tsx`, `app/steward-paths/analytics/page.tsx`, `app/steward-paths/settings/page.tsx` |
| Review queue stage supports real activation/pause actions on live templates API | Working | `app/steward-paths/review/page.tsx`, `server/src/routes/steward-paths.ts` |
| Activity stage is live-data based and links to template-specific history timelines | Working | `app/steward-paths/activity/page.tsx`, `app/steward-paths/[id]/history/page.tsx` |
| Enrollments stage uses live enrollment APIs with pause/resume/cancel/manual-step actions | Working | `app/steward-paths/enrollments/page.tsx`, `server/src/routes/steward-paths.ts` |
| Analytics stage uses live template/enrollment distributions without placeholder metrics | Working | `app/steward-paths/analytics/page.tsx`, `server/src/routes/steward-paths.ts` |
| Settings stage exposes real process-due and legacy migration operations | Working | `app/steward-paths/settings/page.tsx`, `server/src/routes/steward-paths.ts` |
| Campaign follow-up shortcut points to canonical Steward Paths builder flow | Working | `app/campaigns/[id]/page.tsx` |
| Legacy `/automations` route remains compatibility-only redirect | Working | `app/automations/page.tsx` |

## DonorCRM Audit Refresh Snapshot (2026-06-09)

| Item | Status | Evidence |
|---|---|---|
| Fresh donor route/API audit artifact recorded and linked | Working | `docs/status/audit-artifacts/2026-06-09-donor-crm-phase2-audit.md`, `docs/DONOR_CRM_AUDIT.md` |
| Donor audit status for Letters and Printables matches current live behavior | Working | `docs/DONOR_CRM_AUDIT.md`, `server/src/routes/letters.ts`, `tests/unit/letters-pdf-layout.test.ts`, `tests/smoke/letter-builder-ui-source.test.ts` |
| Volunteers workspace no longer carries fetch-helper drift risk | Working | `app/volunteers/page.tsx` uses shared `apiFetch` for `/api/constituents?type=VOLUNTEER` |
| Donations temporary handoff still includes one browser confirm flow | Partially Working | `app/donations/page.tsx` (`window.confirm` in temporary handoff path) |
| Donor settings route remains placeholder-backed | Partially Working | `app/settings/donor/page.tsx`, `app/components/settings/SettingsPlaceholderPage.tsx` |

## OyamaLetters Standalone Workspace Snapshot (2026-05-28)

| Item | Status | Evidence |
|---|---|---|
| `/oyama-letters` opens a dedicated Letter & Document Studio shell outside the DonorCRM page chrome | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `app/components/layout/AppShell.tsx` |
| Template Library, Canvas Builder, Publish Workspace, Generate Letters, queue, and settings routes use live letters APIs | Working | `app/oyama-letters/page.tsx`, `app/oyama-letters/templates/[templateId]/page.tsx`, `app/oyama-letters/templates/[templateId]/publish/page.tsx`, `app/oyama-letters/generate/page.tsx`, `app/oyama-letters/queue/page.tsx`, `app/oyama-letters/settings/page.tsx` |
| Generate Letters multi-recipient batch flow validates, generates, opens PDFs, routes print queue metadata, and preserves recipient/campaign/event/year merge context | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `server/src/routes/letters.ts`, `tests/api/letters-merge-aliases.api.test.ts`, `tests/smoke/letters-printables-generate-source.test.ts`, `tests/e2e/oyama-letters-batch.e2e.mjs` |
| Canvas Builder block, format, and layout controls update real template content, including line height, common font family/size, dividers, preserved white space, push-to-bottom layout, active-block justification, inspector-built tables, and intentional page breaks | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `server/src/routes/letters.ts`, `tests/smoke/letter-builder-ui-source.test.ts`, `tests/unit/letters-pdf-layout.test.ts` |
| Letter PDF pagination defaults to one page and requires a user-inserted Page Break for each additional page; canvas warns about overflow | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `server/src/routes/letters.ts`, `tests/unit/letters-pdf-layout.test.ts`, `tests/smoke/letters-printables-generate-source.test.ts` |
| Shared branded letter document preview and print output use one typed client model | Partially Working | `app/lib/letters/letter-document.ts`, `app/components/letters/LetterPage.tsx`, `app/components/letters/LetterPrintRoute.tsx`, `app/oyama-letters/templates/[templateId]/print/page.tsx`, `tests/unit/letter-document.test.ts`, `tests/smoke/letter-builder-ui-source.test.ts` |
| Uploaded letter images resize and uploaded signature images render in server PDFs | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `app/components/letters/LetterSignaturesManager.tsx`, `server/src/routes/letters.ts`, `tests/unit/letters-pdf-layout.test.ts` |
| Letter sample PDF preview remains available without a live sample recipient | Working | `server/src/routes/letters.ts`, `tests/smoke/letters-printables-generate-source.test.ts` |
| Selected donations hand off to OyamaLetters as a temporary unique-donor list | Working | `app/donations/page.tsx`, `app/components/letters/OyamaLettersWorkspace.tsx`, `tests/smoke/letter-builder-ui-source.test.ts` |
| Generated letters create or reopen a linked, reviewable OyamaEmail draft with a durable return path, without sending or leaving the print/mail queue | Working | `app/components/letters/OyamaLettersWorkspace.tsx`, `app/components/oyama-email/OyamaEmailWorkspace.tsx`, `server/src/routes/letters.ts`, `server/src/routes/email-campaigns.ts`, `tests/smoke/api-smoke.test.ts`, `tests/smoke/letter-builder-ui-source.test.ts`, `tests/smoke/oyama-email-workspace-source.test.ts` |
| Branding Defaults owns one global communication header and one global communication footer for all letter output | Working | `app/settings/branding/page.tsx`, `app/components/letters/OyamaLettersWorkspace.tsx`, `server/src/routes/letters.ts`, `server/src/routes/settings.ts` |
| Existing live letters backend is bound into the refreshed shell UI | Working | `server/src/routes/letters.ts`, `app/components/letters/OyamaLettersWorkspace.tsx` |
| Workspace switcher exposes OyamaLetters as its own entry | Working | `app/components/layout/TopBar.tsx`, `app/lib/navigation-boundaries.ts` |

Notes:

- This pass prioritizes the OyamaLetters workspace while using only live CRM/letters API data and explicit empty states.
- 2026-06-13 shared preview/print update: `LetterDocument` now normalizes branding, recipient, sender, footer, and layout data for client preview and the dedicated print route. Server PDF generation remains on the existing jsPDF path until the next parity pass.
- 2026-06-13 PDF hardening update: template sample PDF preview falls back to a synthetic preview recipient when no live sample recipient is available, and publish validation notes are advisory rather than blocking.
- 2026-06-13 PDF runtime fix: linked jsPDF's Node PNG dependency chain (`fast-png`, `iobuffer`, `pako`) and verified `pnpm test:e2e:letters` through batch PDF and individual PDF export.
- 2026-06-09 formatting update: paragraph alignment now includes full justification and applies to selected/current blocks; saved sections carry chosen justification; table insertion uses an in-app builder and server PDFs preserve header rows, multiline cells, and basic cell alignment.
- 2026-07-16 pagination and formatting update: server PDF output now fails safely on accidental overflow rather than silently creating a page. Staff must insert Page Break to request page two; the builder constrains its canvas and shows overflow. Common font family and size settings now have server-rendered equivalents.
- Validation evidence on 2026-05-28: `pnpm typecheck`, `pnpm typecheck:letters`, targeted ESLint for touched letters routes/components, focused Vitest source contracts, HTTP route sweep, and escalated `npm run build`. A later build rerun was declined after additional builder/settings changes; targeted typecheck, ESLint, Vitest, and route checks passed for those changes.

## OyamaEmail Standalone Workspace Snapshot (2026-05-29)

| Item | Status | Evidence |
|---|---|---|
| `/oyama-email` has a dedicated standalone workspace shell and does not reuse legacy communications email UI | Working | `app/components/oyama-email/OyamaEmailWorkspace.tsx`, `app/components/oyama-email/types.ts`, `app/oyama-email/page.tsx` |
| Template, builder, publish, send, campaigns, callender, audience, queue, analytics, and settings routes are wired | Working | `app/oyama-email/templates/page.tsx`, `app/oyama-email/templates/new/page.tsx`, `app/oyama-email/templates/[templateId]/builder/page.tsx`, `app/oyama-email/templates/[templateId]/publish/page.tsx`, `app/oyama-email/send/page.tsx`, `app/oyama-email/campaigns/page.tsx`, `app/oyama-email/callender/page.tsx`, `app/oyama-email/campaigns/[campaignId]/page.tsx`, `app/oyama-email/audience/page.tsx`, `app/oyama-email/queue/page.tsx`, `app/oyama-email/analytics/page.tsx`, `app/oyama-email/settings/page.tsx` |
| Legacy communications email entry routes redirect into OyamaEmail routes | Working | `app/communications/page.tsx`, `app/communications/new/page.tsx`, `app/communications/new/type/page.tsx`, `app/communications/new/audience/page.tsx`, `app/communications/new/preset/page.tsx`, `app/communications/new/editor/page.tsx`, `app/communications/new/review/page.tsx`, `app/communications/new/send/page.tsx`, `app/communications/log/page.tsx`, `app/communications/library/templates/page.tsx`, `app/communications/library/segments/page.tsx`, `app/communications/library/campaigns/page.tsx`, `app/communications/[campaignId]/page.tsx`, `app/communications/[campaignId]/review/page.tsx`, `app/communications/[campaignId]/schedule/page.tsx` |
| Campaigns workspace supports board + calendar planning, drag/reschedule, and status-driven command-center actions backed by API endpoints | Working | `app/components/oyama-email/OyamaEmailWorkspace.tsx`, `server/src/routes/email-campaigns.ts`, `tests/api/email-campaign-workflow.api.test.ts`, `tests/smoke/oyama-email-workspace-source.test.ts` |
| Email Queue is a dedicated sidebar workspace for drafted and sent email records; Template Library uses its canonical reusable-template feed and retains templates after save | Working | `app/components/oyama-email/OyamaEmailWorkspace.tsx`, `app/oyama-email/queue/page.tsx`, `server/src/routes/oyama-email.ts`, `tests/api/oyama-email-merge-preview.api.test.ts`, `tests/smoke/oyama-email-workspace-source.test.ts` |
| Send lifecycle uses provider-accepted events (no simulated bounce fallback), exposes failed-recipient truth in queue/progress summaries, and has webhook idempotency coverage | Working | `server/src/routes/email-campaigns.ts`, `app/components/oyama-email/OyamaEmailWorkspace.tsx`, `tests/api/email-campaign-workflow.api.test.ts` |
| Builder no longer silently loads/saves the starter template over malformed existing templates | Working | `server/src/routes/oyama-email.ts`, `tests/api/oyama-email-merge-preview.api.test.ts` |
| Canonical builder uses Tiptap rich editing plus saved plain-text override | Working | `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx`, `server/src/services/oyama-email/email-render-service.ts`, `tests/unit/oyama-email-render-service.test.ts` |
| Recipient preview renders through the server email renderer with global communication header/footer chrome | Working | `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx`, `server/src/routes/oyama-email.ts`, `server/src/services/oyama-email/email-render-service.ts`, `tests/unit/oyama-email-render-service.test.ts` |
| Legacy `/email-builder` direct route and high-traffic links point into OyamaEmail | Partially Working | `app/email-builder/page.tsx`, `app/campaigns/[id]/page.tsx`, `server/src/routes/donations.ts`, `server/src/services/steward-tool-registry.ts`, `app/components/communications/CampaignWorkspace.tsx` |
| Donation multi-select temporary email segment handoff | Partially Working | `app/donations/page.tsx`, `app/components/oyama-email/OyamaEmailWorkspace.tsx`, `tests/smoke/oyama-email-workspace-source.test.ts` |
| Sidebar navigation enters OyamaEmail as the primary donor email tool | Working | `app/components/layout/sidebar-configs.tsx` |

Notes:

- Temporary donation email segments support template selection, audience validation, and confirmed immediate send from the campaign wizard.
- Queue/schedule is intentionally disabled for explicit temporary/manual/list audiences because those recipient selections are not yet persisted on the campaign record. Persisted segment audiences remain the scheduled-send path.
- 2026-06-11 builder migration update: direct legacy route access redirects to `/oyama-email/templates/*/builder`; malformed or empty stored template JSON recovers from persisted body fields; starter-template overwrite attempts are blocked server-side. Remaining embedded legacy builder imports in Steward and Communications need a dedicated parity cleanup pass before claiming full legacy removal.

## Status Definitions

Use only these status labels:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

## Donor Desktop Sidebar Snapshot (2026-05-26)

| Item | Status | Evidence |
|---|---|---|
| Donor dashboard uses live focus queues, working workflow launch actions, visible refresh, and shared DonorCRM theme surfaces | Working | `app/page.tsx`, `app/components/dashboard/NaturalisticDonorDashboard.tsx`, `app/components/ui/crm/*`, `app/globals.css`, `tests/smoke/crm-visual-refresh-source.test.ts` |
| DonorCRM high-traffic workspace commands use grouped Explorer-style ribbons | Working | `app/components/ui/crm/CRMActionBar.tsx`, `app/constituents/page.tsx`, `app/donations/page.tsx`, `app/meetings/page.tsx`, `app/tasks/page.tsx`, `tests/smoke/crm-visual-refresh-source.test.ts` |
| Donor sidebar visually matches the dark green/teal top bar brand chrome on desktop | Working | `app/components/layout/CrmSidebar.tsx` |
| Donor sidebar grouping exposes separate Home and Core CRM groups while keeping supporting tools in lower collapsible groups | Working | `app/components/layout/sidebar-configs.tsx`, `tests/smoke/crm-visual-refresh-source.test.ts` |

## Production Pass Phase 1/2 Snapshot (2026-05-14)

## Oyama Reports App Snapshot (2026-05-26)

| Item | Status | Evidence |
|---|---|---|
| Canonical `/reports` app replaces legacy reporting workspace | Partially Working | `app/reports/page.tsx`, `app/components/reports-app/ReportsApp.tsx`, `app/reports/donor-crm/page.tsx` redirect |
| Prebuilt report registry with visible card statuses | Working | `app/components/reports-app/report-registry.ts` uses card labels `Working`, `Partial`, and `Coming Soon` |
| Live-data-only report runner | Working | `app/components/reports-app/report-data-adapter.ts` calls `/api/donations` and `/api/reports/*`; no seed/demo rows are used |
| Recharts dashboard, KPI cards, and data grid | Partially Working | `app/components/reports-app/ReportCharts.tsx`, `app/components/reports-app/ReportResultsWorkspace.tsx`; depends on endpoint coverage per report |
| Report Builder Lite | Partially Working | `app/components/reports-app/ReportBuilderLite.tsx`; browser-session saved view only until backend persistence is implemented |
| CSV/PDF/export and letter-list handoff | Partially Working | CSV exports loaded rows client-side; PDF uses browser print placeholder; letter-list persistence route still needed |

| Item | Status | Evidence |
|---|---|---|
| Central partial implementation audit established | Working | `docs/status/PARTIAL_IMPLEMENTATION_AUDIT.md` |
| CRM-wide readiness matrix established | Working | `docs/status/PRODUCTION_READINESS_MATRIX.md` |
| Events sidebar now avoids known dead event-scoped routes | Working | `app/components/layout/sidebar-configs.tsx` |
| EventSTUDIO sidebar scoping and page-builder production readiness | Working | `app/components/layout/sidebar-configs.tsx`, `app/components/events/page-builder/*`, `server/src/routes/events.ts`, `tests/smoke/events-crud.test.ts` |
| EventSTUDIO ticketing, guest provisioning, and TableLink public tests | Working | `server/src/routes/events.ts`, `tests/smoke/events-crud.test.ts`, `tests/api/events-tablelink-public.api.test.ts`, `tests/e2e/events-public-page-builder.e2e.mjs` |
| Compassion primary sidebar no longer exposes placeholder Tasks route | Working | `app/components/layout/sidebar-configs.tsx`, `app/compassion/tasks/page.tsx` |
| Settings landing page no longer links to placeholder Events settings card | Working | `app/settings/page.tsx`, `app/settings/events/page.tsx` |
| Campaign and communications route-level browser dialogs replaced with modal UX | Working | `app/campaigns/page.tsx`, `app/campaigns/[id]/page.tsx`, `app/communications/page.tsx` |
| Webmaster starter dashboard no longer routes to missing template/import/media/theme pages | Working | `app/components/webmaster/WebmasterStarterDashboard.tsx`, `app/webmaster/[workspace]/page.tsx` |
| Cross-module partial features still pending closure (placeholder routes, TODO permission enforcement, partial export pathways) | Partially Working | `docs/status/PARTIAL_IMPLEMENTATION_AUDIT.md` |

Notes:

- This snapshot records phase 1 (audit) and phase 2 (matrix) completion plus initial phase 4 navigation cleanup actions.
- Release-gate status remains tied to command evidence lanes and unresolved partial-feature items.

## User Friendliness Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Staff role workflow audit document | Working | `docs/status/USER_FRIENDLINESS_AUDIT.md` |
| Dashboard Start Here guided actions | Working | `app/page.tsx` |
| Dashboard plain-language focus cards | Working | `app/page.tsx` |
| Dashboard Start Here and Today's Focus movable widget behavior | Working | `app/page.tsx` |
| Dashboard actionable insights card | Working | `app/page.tsx`, `app/components/dashboard/ActionableInsightsWidget.tsx` |
| Dashboard AI widget set (runtime controls, opportunities, compact chat) | Working | `app/page.tsx`, `app/components/dashboard/AiInsightsWidget.tsx`, `app/components/dashboard/AiOpportunityWidget.tsx`, `app/components/dashboard/AiChatWidget.tsx` |
| Shared contextual help tip component | Working | `app/components/ui/WorkspaceHelpTip.tsx` |
| User-facing guide baseline | Working | `docs/howto/HOW_TO_USE.md` |
| CRM language guide baseline | Working | `docs/ui/CRM_LANGUAGE_GUIDE.md` |

Notes:

- This snapshot represents the first user-friendliness implementation wave and does not indicate full completion of all 20 user-friendliness phases.
- Remaining user-friendliness phases should continue in iterative module-specific passes with test-backed validation.

## Responsive UI Compact-Laptop Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Compact desktop shell breakpoints (`<1024` drawer, `1024-1439` compact, `>=1440` full workspace rail) | Working | `app/components/layout/AppShell.tsx`, `app/components/layout/TopBar.tsx`, `app/components/layout/CrmSidebar.tsx`, `app/components/workspace/WorkspaceFrame.tsx` |
| Shared compact-laptop overflow protections (`min-w-0`, contained main overflow, bounded rail height) | Working | `app/components/layout/AppShell.tsx`, `app/components/layout/AppProductShell.tsx`, `app/components/workspace/WorkspaceControlRail.tsx` |
| Responsive browser audit automation | Working | `scripts/qa/responsive-ui-pass.mjs`, `package.json` |
| Dated screenshot capture workflow for responsive UI | Working | `docs/screenshots/responsive-ui/README.md` |

Notes:

- Small laptop readiness is now part of the layout acceptance bar and should be validated at `1366x768` and `1280x720` for new CRM workspaces.
- Full release-gate status still depends on the command evidence lanes below.

## CRM Header Cleanup Stage 1 Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Canonical compact breadcrumb bar for workspace pages | Working | `app/components/layout/WorkspaceBreadcrumbBar.tsx` |
| Shared ribbon frame + wizard compact header migration | Working | `app/components/workspace-ribbon/WorkspaceRibbonFrame.tsx`, `app/components/workspace-ribbon/WorkspaceWizard.tsx` |
| Steward Paths header migration and canonical workspace | Working | `app/steward-paths/page.tsx`, `app/components/steward-paths/StewardPathsWorkspacePage.tsx`, `app/steward-paths/builder/page.tsx` |
| High-traffic workspace header migrations (Tasks, Grants, Settings, Data Tools, Constituents, Campaigns, Donations, Volunteers, Meetings, QuickBooks Sync, Reports, Donation create/edit routes, Compassion Clients/Cases/Follow-ups, Events Guests/Orders/Check-In/Tickets/Tables/Sponsors/Overview) | Partially Working | `app/tasks/page.tsx`, `app/grants/page.tsx`, `app/settings/page.tsx`, `app/data-tools/page.tsx`, `app/constituents/page.tsx`, `app/campaigns/page.tsx`, `app/donations/page.tsx`, `app/volunteers/page.tsx`, `app/meetings/page.tsx`, `app/quickbooks-sync/page.tsx`, `app/reports/page.tsx`, `app/donations/new/page.tsx`, `app/donations/[id]/edit/page.tsx`, `app/compassion/clients/page.tsx`, `app/compassion/cases/page.tsx`, `app/compassion/follow-ups/page.tsx`, `app/events/guests/page.tsx`, `app/events/orders/page.tsx`, `app/events/check-in/page.tsx`, `app/events/tickets/page.tsx`, `app/events/tables/page.tsx`, `app/events/sponsors/page.tsx`, `app/events/[eventId]/overview/page.tsx` |
| Shared module-aware breadcrumb/ribbon accent support | Working | `app/components/layout/WorkspaceBreadcrumbBar.tsx`, `app/components/workspace-ribbon/WorkspaceRibbonButton.tsx` |
| CRM-wide legacy header removal completion | Not Implemented | `docs/status/refactor-ui-autopilot-log.md` |

Notes:

- Detailed phase log and changed-file inventory: `docs/status/refactor-ui-autopilot-log.md`.
- This snapshot confirms stage-level stability, not full release-gate completion.

## Tasks + Notifications Work Engine Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Durable notification state model (`unread/read/dismissed/snoozed`) | Working | `prisma/schema.prisma`, `server/src/routes/notifications.ts`, `server/src/services/notifications.ts` |
| TopBar notification actions and unread polling | Partially Working | `app/components/layout/TopBar.tsx` |
| Task lifecycle endpoints (`start`, `complete`, `snooze`, `archive`) | Working | `server/src/routes/tasks.ts` |
| Full task command-center UX (board/calendar/wizard/details drawer) | Partially Working | `app/tasks/page.tsx`, `app/components/tasks/*` |

Notes:

- This pass establishes durable API and state plumbing first; the full UI command-center rebuild remains an active follow-up.
- Keep status labels aligned to command evidence and do not treat this snapshot as a substitute for full gate runs.

## Standalone Bridge + Structured Artifacts Snapshot (2026-05-14)

| Item | Status | Evidence |
|---|---|---|
| Standalone bridge desktop shell and controls | Working | `OyamaBridgeDesktopServer/main.js`, `OyamaBridgeDesktopServer/renderer.js` |
| Bridge proxy health/auth/CORS/log behavior | Working | `OyamaBridgeDesktopServer/bridge-server.js`, `OyamaBridgeDesktopServer/tests/bridge-server.test.js` |
| Startup launch + hidden + autostart persistence | Working | `OyamaBridgeDesktopServer/main.js` |
| Steward donor/report structured parse + transport (`structured`) | Working | `server/src/routes/steward-ai.ts` |
| Chat artifact rendering cards and response renderer | Working | `app/components/ai/StewardResponseRenderer.tsx`, `app/components/ai/artifacts/*`, `app/components/ai/StewardChatPanel.tsx` |
| Structured suggested-action execution endpoints and UI binding | Not Implemented | `app/components/ai/StewardResponseRenderer.tsx` |

Notes:

- This snapshot is feature-level evidence only and does not replace full release-gate validation lanes.
- Full production-readiness gate remains governed by lint/typecheck/test/build/db command evidence below.

## Documentation Governance Alignment (2026-05-13)

| Item | Status | Evidence |
|---|---|---|
| Canonical master plan moved under docs | Working | `docs/MASTER_PLAN.md` |
| Legacy plan packet location cleanup | Working | `docs/plans/*`, `docs/backlog/master-plan-backlog.md` |
| Office guide moved under docs hierarchy | Working | `docs/howto/HOW_TO_USE.md` |
| Full markdown inventory and disposition audit | Working | `docs/audits/markdown-documentation-audit.md` |

## Full-App Testing Expansion Snapshot (2026-05-13)

| Item | Status | Evidence |
|---|---|---|
| Testing audit baseline created | Working | `docs/testing/full-app-test-audit.md` |
| E2E local runbook created | Working | `docs/testing/e2e-local-runbook.md` |
| Test coverage map created | Working | `docs/testing/test-coverage-map.md` |
| Dedicated lane scripts for `unit` / `api` / `regression` / `ci` | Working | `package.json` |
| E2E base URL mismatch (3650 vs 3000) corrected in scripts | Working | `tests/e2e/ui-production-smoke.mjs`, `tests/e2e/livecom-ui-smoke.mjs` |
| Mobile E2E auth endpoint mismatch corrected | Working | `tests/e2e/mobile-readiness-audit.mjs` |
| Fresh E2E run against live local stack (`pnpm test:e2e`) | Working | Local validation run, 2026-05-13 |
| Fresh mobile audit run (`pnpm test:e2e:mobile`) | Partially Working | Local validation run, 2026-05-13 (`75` warns, `0` fails) |
| API lane breadth across all modules | Partially Working | `tests/api/*` |
| Full CRM workflow E2E coverage depth | Partially Working | `tests/e2e/*` |

Reference docs for this pass:

- `docs/audits/full-app-testing-audit.md`
- `docs/audits/full-app-testing-validation.md`

## Donor Engagement Unified System Refactor (2026-05-13)

Phase 1 (audit + docs), Phase 2 (UI relabeling, shared status vocabulary), and Phase 3 partial (shared service contract foundation + unit tests) have landed. Phase 4 visual builder work has landed with branch-aware persistence/export and true drag-and-drop behavior.

| Item | Status | Evidence |
|---|---|---|
| Incremental workspace refactor permission in AGENTS.md | Working | `AGENTS.md` `incremental-workspace-refactor-rules` |
| Unified donor engagement refactor plan | Working | `docs/DONOR_ENGAGEMENT_UNIFIED_SYSTEM_REFACTOR.md` |
| Shared engagement status vocabulary helpers | Working | `app/lib/engagement-status.ts` + 10 unit tests in `tests/unit/engagement-status.test.ts` |
| Shared engagement orchestration helpers (delay math, comm-pref checks, branch evaluation) | Working | `app/lib/engagement-orchestration.ts` + 17 unit tests in `tests/unit/engagement-orchestration.test.ts` |
| Communications "Letters" tab → discovery card linking to Letters & Printables | Working | `app/communications/page.tsx` |
| Steward Paths shared status legend with tone palette | Working | `app/automations/page.tsx` |
| Steward Paths `SEND_EMAIL` UI label updated to "Create review-required email" | Working | `app/automations/page.tsx`, `app/components/automations/NewAutomationModal.tsx`, `app/components/automations/AutomationWorkflowEditorModal.tsx` |
| Canonical `/steward-paths` URL (redirect wrapper) | Working | `app/steward-paths/page.tsx` |
| Steward Paths visual builder canvas (palette/map/inspector) at `/steward-paths/builder` | Working | `app/steward-paths/builder/page.tsx`, `app/components/steward-paths/*` |
| Visual builder persistence (save/load) | Working | `app/components/steward-paths/StewardPathBuilderPage.tsx`, `app/components/steward-paths/workflow-transformers.ts` (branch-aware save/load and export are active) |
| `STATUS_CHANGE` step execution | Working | `server/src/services/steward-paths-sequence-engine.ts` `processStatusChangeStep`/`buildStatusChangeUpdate`; 16 unit tests in `tests/unit/steward-paths-status-change.test.ts` |
| `BRANCH_PLACEHOLDER` step execution (eq/neq/gt/gte/lt/lte/in/not_in) | Working | `server/src/services/steward-paths-sequence-engine.ts` `processBranchStep`; algorithm mirrored from `app/lib/engagement-orchestration.ts` (covered by `tests/unit/engagement-orchestration.test.ts`) |
| New Phase-5 step types (wait-until-date, weekday/time, after-last-gift, tag mutations, manual command operations, retry/notify/stop flows) | Working | `server/src/services/steward-paths-sequence-engine.ts` and `app/components/steward-paths/workflow-transformers.ts` now map and execute these step families |
| Auto-send email step | Not Implemented | `server/src/services/steward-paths-sequence-engine.ts` `processSendEmailStep` intentionally routes through draft-first behavior |
| Sequence engine cutover to shared helpers | Not Implemented | Engine still uses private `addDuration`; planned with the visual builder cutover so parity tests ship together |
| Legacy `stewardPathsEngine.ts` retirement | Not Implemented | Legacy and sequence engines coexist intentionally until parity is confirmed in Phase 3 cutover |

This refactor must follow the new `incremental-workspace-refactor-rules` in `AGENTS.md`: no destructive migration in a single pass, public route compatibility preserved (redirects/wrappers when routes move), draft-first / review-first / opt-out / audit defaults preserved, and no working feature removed until the replacement has equal or better behavior.

## Current Gate Decision

Status: Broken

Recommendation: Do not mark OyamaCRM production-ready yet.

## Migration Incident (2026-05-13)

| Item | Result | Status | Evidence |
|---|---|---|---|
| Prisma migration `20260513144533_add_email_campaign_purpose_and_compliance_models` | Failed with `P3018` / MySQL `1146` because migration referenced lowercase `emailcampaign` while existing table is `EmailCampaign` | Broken | `prisma/migrations/20260513144533_add_email_campaign_purpose_and_compliance_models/migration.sql` |
| Migration fix | Updated migration to alter `EmailCampaign` with exact casing and added dependency note to prior create-table migration (`20260509022557_add_constituent_external_id`) | Working | `prisma/migrations/20260513144533_add_email_campaign_purpose_and_compliance_models/migration.sql` |

Notes:

- No duplicate EmailCampaign table was created.
- If `EmailCampaign` does not exist in an environment, migration order is broken and prior migrations must be applied first.
- Linux/MySQL deployments must preserve exact Prisma-generated table name casing.

## Latest Validation Run (2026-05-12)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| `pnpm lint` | 42 problems (13 errors, 29 warnings) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-lint.log` |
| `pnpm typecheck` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-typecheck.log` |
| `pnpm typecheck:web` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-typecheck-web.log` |
| `pnpm typecheck:server` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-typecheck-server.log` |
| `pnpm test:smoke` | 151 passed, 0 failed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-test-smoke.log` |
| `pnpm test:e2e` | Failed (`ERR_CONNECTION_REFUSED` at `localhost:3650/login`) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e.log` |
| `pnpm test:e2e:mobile` | Failed (404 at `/api/auth/login` on `localhost:3000`) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e-mobile.log` |
| `pnpm test:e2e:livecom` | Failed (`ERR_CONNECTION_REFUSED` at `localhost:3650/login`) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-test-e2e-livecom.log` |
| `pnpm test` | 337 passed, 0 failed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-test.log` |
| `pnpm test:coverage` | Passed with coverage report | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-test-coverage.log` |
| `pnpm build` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-build.log` |
| `pnpm build:server` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-build-server.log` |
| `pnpm db:generate` | Failed (Windows Prisma DLL rename `EPERM`) | Broken | `docs/status/audit-artifacts/2026-05-12/pnpm-db-generate.log` |
| `pnpm db:verify:linux-casing` | Passed | Working | `docs/status/audit-artifacts/2026-05-12/pnpm-db-verify-linux-casing.log` |

Detailed dated reports:

- `docs/status/readiness-audit-2026-05-12.md`
- `docs/status/testing-coverage-audit-2026-05-12.md`
- `docs/status/e2e-coverage-audit-2026-05-12.md`
- `docs/status/smoke-coverage-audit-2026-05-12.md`
- `docs/status/build-and-typecheck-audit-2026-05-12.md`

## Targeted Validation Run (2026-05-13)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| `pnpm lint` | Failed with existing repo-wide lint errors/warnings (including React compiler memoization and hook-order violations in untouched files) | Broken | Local run in current pass (see `docs/audits/full-crm-cleanup-validation.md`) |
| `pnpm typecheck:web` | Passed | Working | Local run in current pass |
| `pnpm test:smoke` | 152 passed, 0 failed | Working | Local run in current pass |
| `pnpm vitest --run tests/unit/steward-paths-workflow-builder.test.ts tests/unit/engagement-orchestration.test.ts` | 27 passed, 0 failed | Working | Local run in current pass |
| `pnpm build` | Passed | Working | Local run in current pass |

## Donor Browser QA Validation Run (2026-05-13)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| `pnpm lint` | Failed with 49 problems (16 errors, 33 warnings) | Broken | Local run in current pass |
| `pnpm typecheck` | Passed | Working | Local run in current pass |
| `pnpm vitest --run tests/smoke/donations-crud.test.ts` | 13 passed, 0 failed | Working | Local run in current pass |
| `pnpm build` | Passed | Working | Local run in current pass |
| `pnpm test:e2e` | Failed (`ERR_CONNECTION_REFUSED` at `http://localhost:3650/login`) | Broken | Local run in current pass |
| `pnpm test:e2e:mobile` | Failed (mobile audit login 404 on `/api/auth/login`) | Broken | Local run in current pass |
| `pnpm test:e2e:livecom` | Failed (`ERR_CONNECTION_REFUSED` at `http://localhost:3650/login`) | Broken | Local run in current pass |

## Full-App Testing Validation Run (2026-05-13)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| `pnpm lint` | Failed with 50 problems (16 errors, 34 warnings) | Broken | Local run in current pass |
| `pnpm typecheck` | Passed | Working | Local run in current pass |
| `pnpm test:unit` | 250 passed, 0 failed | Working | Local run in current pass |
| `pnpm test:api` | 7 passed, 0 failed | Working | Local run in current pass |
| `pnpm test:regression` | 2 passed, 0 failed | Working | Local run in current pass |
| `pnpm test:smoke` | 159 passed, 0 failed | Working | Local run in current pass |
| `pnpm test` | 418 passed, 0 failed | Working | Local run in current pass |
| `pnpm test:coverage` | Passed with v8 coverage output | Working | Local run in current pass |
| `pnpm test:e2e` | Passed | Working | Local run in current pass (with `pnpm dev:all` active) |
| `pnpm test:e2e:livecom` | Passed | Working | Local run in current pass (with `pnpm dev:all` active) |
| `pnpm test:e2e:mobile` | Completed with 75 warnings, 0 failures | Partially Working | Local run in current pass (with `pnpm dev:all` active) |
| `pnpm build` | Passed | Working | Local run in current pass |

## Steward Paths Canonicalization Validation Run (2026-05-13)

| Validation | Result | Status | Evidence |
|---|---|---|---|
| `/steward-paths` canonical saved visual paths workspace | Manual browser QA passed | Working | Local browser QA + screenshot evidence in current pass |
| `/automations` compatibility redirect to canonical route | Manual browser QA passed (`/steward-paths?deprecated=automations`) | Working | Local browser QA + screenshot evidence in current pass |
| `/steward-paths/builder/:id` template-edit route | Manual browser QA passed | Working | Local browser QA + screenshot evidence in current pass |
| `/steward-paths/:id/history` route | Manual browser QA passed (timeline event rendered) | Working | Local browser QA + screenshot evidence in current pass |
| `pnpm typecheck` | Passed | Working | Local run in current pass |
| `pnpm test:unit -- --run tests/unit/steward-paths-adapters.test.ts tests/unit/crm-sidebar-navigation.test.ts` | Passed (254 tests) | Working | Local run in current pass |
| `pnpm test:api -- --run tests/api/steward-paths.api.test.ts` | Passed (8 tests) | Working | Local run in current pass |
| `pnpm test:smoke` | Passed (159 tests) | Working | Local run in current pass |
| `pnpm test:e2e` | Passed | Working | Local run in current pass |
| `pnpm build` | Passed | Working | Local run in current pass |
| `pnpm lint` | Failed with existing repo-wide issues (16 errors, 35 warnings) | Broken | Local run in current pass |

Notes:

- New canonical Steward Paths functionality validated end-to-end.
- Release gate remains blocked by unresolved repo-wide lint failures outside this feature pass.

## Partial Implementations Completed In This Pass

1. Integrations settings upgraded from placeholder to live API-backed diagnostics.
   - Route: app/settings/integrations/page.tsx
   - New component: app/components/settings/integrations/IntegrationsSettingsPage.tsx
   - Live checks: QuickBooks, Site Embeds, Steward AI config, SMTP readiness
2. System status source-of-truth refreshed and standardized.
   - Source data: app/lib/system-status.ts
   - Labels aligned to release statuses: Working, Partially Working, Demo Only, Broken, Not Implemented
3. Production checklist UI now provides explicit done vs not-done tracking.
   - Component: app/components/settings/ProductionReadinessChecklist.tsx
   - Added summary counters and separate Done / Not Done sections
4. Donor CRM Letters & Printables workspace now has live API + UI foundation.
   - Routes: app/letters-printables/* and server/src/routes/letters.ts
   - Timeline + communications integration: generated letters and queue actions log Activity events and can create linked EmailCampaign drafts
   - Current status: Partially Working (template authoring, single generation, batch generation, print queue, and mail queue are live; server-side PDF export remains partial)
5. Shared CRM sidebar navigation architecture implemented for core modules.
   - Shared renderer: app/components/layout/CrmSidebar.tsx
   - Config map: app/components/layout/sidebar-configs.tsx
   - Module wrappers: Donor, Compassion, Events, HRM, Watchdog now use grouped config metadata and icon-only collapsed mode
   - Persisted state keys: oyamacrm.sidebar.<module>.collapsed
   - Current status: Partially Working (role-aware visibility is active; front-end fine-grained permission overrides are still TODO)
6. DonorCRM stabilization and command-center hardening pass (safe-scope updates).
   - Dashboard: added API-backed stewardship attention widget in `app/components/dashboard/StewardshipAttentionWidget.tsx` and wired in `app/page.tsx`
   - Donor context: removed the prior TopBar identity badge in `app/components/layout/TopBar.tsx` to reduce header clutter while preserving module switcher context
   - Donor IA polish: normalized donor sidebar group label to `People` in `app/components/layout/sidebar-configs.tsx`
   - Documentation: added/updated donor audit and command-center docs (`docs/DONOR_CRM_AUDIT.md`, `docs/DONOR_CRM_STEWARDSHIP_COMMAND_CENTER.md`, `docs/DONOR_CRM_SIDEBAR_NAVIGATION.md`)
7. Donor engagement system integration pass (letters + communications + email builder + steward paths).
   - Communications hub expanded into tabbed donor engagement workspace in `app/communications/page.tsx`
   - Donation quick actions and persisted `Mark Thanked` API flow added via `app/components/donations/DonationTable.tsx`, `app/donations/page.tsx`, and `server/src/routes/donations.ts`
   - Email builder metadata + test-send controls added in `app/components/email-builder/EmailBuilderApp.tsx`
   - Email builder campaign-studio updates added: donor block library categories/search, workflow stages, review checklist tab, grouped merge-field picker, and donor-specific stewardship/compliance blocks
   - Constituent and campaign quick-action linkage added in `app/constituents/[id]/page.tsx` and `app/campaigns/[id]/page.tsx`
   - Steward paths visual language improvements added in `app/automations/page.tsx`
   - Donor engagement architecture/audit docs added: `docs/DONOR_ENGAGEMENT_SYSTEM.md`, `docs/DONOR_CRM_COMMUNICATIONS_AUDIT.md`, `docs/DONOR_CRM_EMAIL_BUILDER.md`, `docs/DONOR_CRM_LETTERS_PRINTABLES.md`
8. Donor grants research workspace pass (grant-first case-file workflow with donation handoff boundary).
   - Grants workspace reframed away from pipeline semantics in `app/grants/page.tsx` and `app/grants/[id]/page.tsx`
   - New case-item UI and APIs for reminders, writing tasks, resources, and requirements: `app/components/grants/GrantCaseItemPanel.tsx`, `server/src/routes/grants.ts`
   - Grant-specific permission keys added and enforced in `server/src/lib/permissions.ts` and grants routes
   - Donations handoff flow for received awards added in `app/donations/new/page.tsx` (no automatic donation creation from grants)
   - Grants audit/workspace docs added: `docs/DONOR_CRM_GRANTS_AUDIT.md`, `docs/DONOR_CRM_GRANTS_RESEARCH_WORKSPACE.md`
9. OyamaWebMaster command-center foundation pass (safe lifecycle and site metadata model).
   - Store schema evolved additively in `server/src/services/webmaster-store.ts` with site manager metadata fields and launch/publish tracking columns
   - Site lifecycle APIs added in `server/src/routes/webmaster.ts`: site update, archive, restore, duplicate
   - Dashboard upgraded in `app/components/webmaster/WebmasterStarterDashboard.tsx` with site-type filters, search, and lifecycle actions
   - Architecture docs added: `docs/OYAMA_WEBMASTER_REBUILD_PLAN.md`, `docs/OYAMA_WEBMASTER_SITE_TYPES.md`, `docs/OYAMA_WEBMASTER_PUBLISHING_ARCHITECTURE.md`, `docs/OYAMA_WEBMASTER_CRM_INTEGRATION.md`, `docs/OYAMA_WEBMASTER_DATA_SAFETY.md`
10. Donor engagement production-hardening pass for letters and email builder.
   - Letters workflow policy persistence added via `GET/PUT /api/letters/workflow-settings` in `server/src/routes/letters.ts`.
   - Letters workflow settings UI is API-backed in `app/components/letters/OyamaLettersWorkspace.tsx`.
   - Email builder review gate now validates merge-token integrity (unknown tokens + malformed braces) in `app/components/email-builder/EmailBuilderApp.tsx`.
   - Email builder rich-text hardening now preserves H1/H2/H3 plus list/quote/link formatting in `app/components/email-builder/RichTextEditor.tsx`, `app/lib/email-builder-utils.ts`, and preview blocks.
11. Donor stewardship vertical-loop completion slice (donation -> acknowledgment workflow handoff).
   - Added one-click `Complete Loop` donation action in `app/components/donations/DonationTable.tsx` and `app/donations/page.tsx`.
   - Added orchestration endpoint `POST /api/donations/:id/quick-actions/stewardship-loop` in `server/src/routes/donations.ts`.
   - Endpoint executes/reuses draft email, follow-up task, and steward path enrollment with timeline/audit writeback.
   - Added smoke coverage in `tests/smoke/donations-crud.test.ts` for both loop execution and cross-workspace artifact visibility (`email campaigns`, `tasks`, `steward-path enrollments`, `constituent timeline`).
12. Donor browser-driven QA and documentation polish pass.
   - Added reproducible route+viewport QA script `scripts/qa/donor-browser-pass.mjs`.
   - Added DonorCRM QA report and module guide (`docs/modules/donor-crm/browser-qa-report.md`, `docs/modules/donor-crm/README.md`).
   - Added screenshot index and refreshed dated screenshot pack (`docs/screenshots/donor-crm/README.md`, `docs/screenshots/donor-crm/2026-05-13/*`).
13. OShareview reporting expansion pass (scope switcher, admin operations, filter depth).
   - Replaced chip-heavy report scope controls with a compact dropdown switcher in `app/components/reports/ReportsModuleToolbar.tsx`.
   - Added admin reporting workspace and API-backed operational dataset via `app/components/reports/OShareviewAdminWorkspace.tsx` and `GET /api/reports/admin-summary` in `server/src/routes/reports.ts`.
   - Added global filter controls and filter-aware exports plus printable packet generation in `app/reports/page.tsx`.
   - Fixed a constituent profile runtime hook-order crash and improved mobile quick-action stacking in `app/constituents/[id]/page.tsx`.
14. Steward AI bridge pairing automation pass (CRM URL/key pairing + desktop import).
   - Added bridge readiness and pairing key APIs in `server/src/routes/steward-ai.ts` (`GET /api/steward-ai/bridge/readiness`, `POST /api/steward-ai/bridge/pairing-key`).
   - Added CRM AI settings pairing controls in `app/components/settings/ai/BridgePairingPanel.tsx` and mounted in `app/components/settings/ai/AISettingsPage.tsx`.
   - Added desktop bridge pairing URL/token/key import flow in `Desktopapp/shell.html`, `Desktopapp/shell.js`, and `Desktopapp/styles.css`.
15. OyamaWebMaster visual editor, draft preview, and publish readiness workspace pass.
   - Added new editor route and workspace shell in `app/webmaster/editor/page.tsx` and `app/components/webmaster/editor/*` with top bar, left rail, live canvas, and inspector.
   - Added shared rendering pipeline for editor and preview in `app/components/webmaster/rendering/*`.
   - Added real draft preview route in `app/webmaster/preview/[siteId]/[pageId]/page.tsx` and `app/components/webmaster/WebmasterDraftPreviewPage.tsx`.
   - Added publish readiness endpoint `GET /api/webmaster/sites/:siteId/publish-readiness` plus publishing workspace `app/webmaster/publishing/page.tsx` and `app/components/webmaster/WebmasterPublishingWorkspace.tsx`.
   - Publish execution and rollback execution are Working with immutable publish version snapshots and confirmation-gated actions; external deployment target adapters remain Not Implemented.

## Done Now Checklist

| Item | Status |
|---|---|
| Authentication is stable | Working |
| Bulk sends respect opt-outs | Working |
| Public endpoints are rate-limited | Working |
| Version/build metadata is visible in app settings | Working |

## Not Done Yet Checklist (High Impact)

| Item | Status | Notes |
|---|---|---|
| Workspace permissions are enforced | Not Implemented | Module-level workspace policy checks are not consistently enforced |
| Tests cover critical workflows | Partially Working | Smoke is passing (151/151), but current e2e run failed due local service availability mismatch (`localhost:3650`) |
| Lint/type/build pipelines are green | Partially Working | Validated 2026-07-13: lint and typecheck pass, production build generates 198 routes, and 125 lint warnings remain. Full tests pass 638/639 under parallel load; the isolated failing file passes 8/8. |
| Prisma client generation is reliable | Broken | `pnpm db:generate` failed on Windows with Prisma engine rename `EPERM` |
| Payment/webhook endpoints are idempotent | Not Implemented | Provider webhooks are not implemented yet |
| Backup/restore process is documented | Not Implemented | Recovery runbook is still missing |
| RBAC is enforced server-side | Partially Working | Coverage exists but not complete for all sensitive endpoints |
| Mobile readiness gate is passing | Broken | `pnpm test:e2e:mobile` failed in this run due auth endpoint mismatch |

## Release Gate Exit Criteria

1. Keep `pnpm lint` at zero errors and reduce the remaining warning backlog without hiding actionable rules.
2. Stabilize E2E runtime contracts (base URL, login route, ports) so all three E2E commands return Working.
3. Resolve Windows Prisma engine lock behavior so `pnpm db:generate` returns Working.
4. Keep release checks green on re-run: lint, all typecheck commands, smoke, all E2E commands, test, coverage, build, build:server, db:generate, and db:verify:linux-casing.
5. Finish workspace-level permission enforcement across donor, compassion, events, and apps scopes.
6. Add idempotent payment/webhook integration coverage.
7. Add and validate backup/restore runbook documentation.

## v1.1.0 Help & Documentation Expansion Snapshot (2026-05-18)

| Item | Status | Evidence |
|---|---|---|
| Help search query synonym expansion (60+ rules) | Working | `app/help-content/search.ts` `expandQueryTokens` |
| Feature readiness boost in search ranking | Working | `app/help-content/search.ts` `featureReadinessBoost` |
| Route-context mappings expanded (35+ routes) | Working | `app/help-content/route-help-map.ts` |
| New help articles: Campaigns | Working | `app/help-content/articles.ts` `help-donor-campaigns` |
| New help articles: Constituent profile & timeline | Working | `app/help-content/articles.ts` `help-donor-view-constituent-profile` |
| New help articles: Steward Paths setup | Working | `app/help-content/articles.ts` `help-donor-steward-paths-setup` |
| New help articles: Contacts Manager audience lists | Working | `app/help-content/articles.ts` `help-donor-contacts-manager` |
| New help articles: Pledge management | Working | `app/help-content/articles.ts` `help-donor-pledges` |
| New help articles: Donor retention analysis | Working | `app/help-content/articles.ts` `help-donor-retention-analysis` |
| New help articles: Volunteers | Working | `app/help-content/articles.ts` `help-donor-volunteers` |
| New help articles: Dashboard metrics | Working | `app/help-content/articles.ts` `help-donor-dashboard-metrics` |
| New help articles: Email builder | Working | `app/help-content/articles.ts` `help-donor-email-builder` |
| New help articles: Donation import | Working | `app/help-content/articles.ts` `help-donor-import-donations` |
| New help articles: Events sponsors | Working | `app/help-content/articles.ts` `help-events-sponsors` |
| New help articles: Event ticket types | Working | `app/help-content/articles.ts` `help-events-tickets` |
| New help articles: Event overview dashboard | Working | `app/help-content/articles.ts` `help-events-overview-dashboard` |
| New help articles: Compassion assessments | Working | `app/help-content/articles.ts` `help-compassion-assessments` |
| New help articles: Compassion referrals | Working | `app/help-content/articles.ts` `help-compassion-referrals` |
| New help articles: Compassion reports | Working | `app/help-content/articles.ts` `help-compassion-reports` |
| New help articles: Material assistance | Working | `app/help-content/articles.ts` `help-compassion-material-assistance` |
| New help articles: System settings overview | Working | `app/help-content/articles.ts` `help-global-system-settings` |
| New help articles: Organization settings | Working | `app/help-content/articles.ts` `help-global-org-settings` |
| New help articles: Audit log review | Working | `app/help-content/articles.ts` `help-global-audit-log` |
| New help articles: User management | Working | `app/help-content/articles.ts` `help-global-user-management` |
| New help articles: Data export | Working | `app/help-content/articles.ts` `help-global-data-export` |
| New help articles: Security & privacy | Working | `app/help-content/articles.ts` `help-global-security-privacy` |
| New help articles: Notifications & reminders | Working | `app/help-content/articles.ts` `help-global-notifications` |
| New help articles: Setup wizard | Working | `app/help-content/articles.ts` `help-global-setup-wizard` |
| New help articles: Webmaster basics | Working | `app/help-content/articles.ts` `help-global-webmaster` |
| New help articles: Connectivity troubleshooting | Working | `app/help-content/articles.ts` `help-global-troubleshoot-connectivity` |
| New help articles: Module switching | Working | `app/help-content/articles.ts` `help-global-module-switching` |
| Total published help articles | Working | 60 articles covering all major CRM modules and workflows |
| FEATURES.md root-level feature inventory | Working | `FEATURES.md` — complete feature list with status labels |
| Version bumped to 1.1.0 | Working | `package.json` |
| HelpWorkspace quick search expanded | Working | `app/components/help/HelpWorkspace.tsx` — 10 quick searches |
| Help Agent example prompts expanded | Working | `app/components/help/HelpWorkspace.tsx` — 5 starter prompts |
