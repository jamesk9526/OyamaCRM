<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

<!-- BEGIN:modular-architecture-rules -->
# Keep the App Modular — Always

Every feature, section, or UI concept must live in its own file/component. Never build monolithic pages. Follow these rules on every change:

- **Components**: Place in `app/components/`. Organize by type:
  - `app/components/layout/` — structural shell pieces (TopBar, Sidebar, AppShell, etc.)
  - `app/components/ui/` — shared, reusable primitives (buttons, cards, badges, inputs, etc.)
  - `app/components/<feature>/` — feature-specific components (e.g. `contacts/ContactCard.tsx`)
- **Pages**: `app/<route>/page.tsx` should be thin — import and compose components, do not inline large JSX blocks.
- **"use client" boundary**: Keep Server Components as the default. Only add `"use client"` to the smallest component that actually needs it (event handlers, state, browser APIs, `usePathname`, etc.).
- **No global side-effects in components**: Data fetching belongs in Server Components or Route Handlers, not scattered through client components.
- **Theme**: White background, green-600 (`#16a34a`) accents, gray-50 content areas. Do not introduce dark mode unless explicitly requested.
- **Layout**: All pages share `AppShell` (TopBar + Sidebar + main). Add new sidebar items in `app/components/layout/Sidebar.tsx`.
<!-- END:modular-architecture-rules -->

<!-- BEGIN:code-style-rules -->
# Code Style — Always Comment Your Code

**Every file must be well-commented.** This is non-negotiable for maintainability.

- **File header**: Every file gets a one-line comment describing its purpose.
- **Functions/components**: JSDoc-style `/** ... */` comment on every exported function and React component explaining what it does, its props, and any non-obvious behavior.
- **Complex logic**: Inline `//` comments explaining *why*, not just *what*, for any non-trivial block of code.
- **API routes**: Comment every route with its method, path, description, and expected request/response shape.
- **Hooks/effects**: Comment every `useEffect` with what it watches and what side effect it performs.
- **Type definitions**: Comment every interface/type field that isn't self-explanatory.

Example style:
```ts
/**
 * Computes the donor retention rate for a given fiscal year.
 * Retention = donors who gave last year AND this year / total donors last year.
 */
export function computeRetentionRate(lastYear: number, retained: number): number {
  if (lastYear === 0) return 0;
  return Math.round((retained / lastYear) * 100);
}
```
<!-- END:code-style-rules -->

<!-- BEGIN:nonprofit-crm-domain -->
# Nonprofit CRM Domain Context

**OyamaCRM** is a nonprofit-focused donor management and fundraising platform inspired by Bloomerang and NeonCRM. The system helps nonprofits manage constituents (donors, volunteers, members), track donations, run campaigns, and measure fundraising performance.

## Core Terminology

Use nonprofit-specific language consistently:

- **Constituents** — not "contacts" or "customers". Encompasses donors, volunteers, members, prospects, sponsors, board members
- **Donations** — not "payments" or "transactions". One-time gifts, recurring gifts, pledges, in-kind donations
- **Campaigns** — fundraising initiatives with goals and timelines (annual fund, capital campaign, giving days, etc.)
- **Designations** — funds or programs donations are earmarked for (general fund, building fund, scholarship fund, etc.)
- **Donor Retention** — percentage of donors who give again year-over-year (critical nonprofit metric)
- **Engagement Score** — measure of constituent interaction (donations, event attendance, volunteer hours, email opens)
- **Major Gifts** — large donations requiring special stewardship (threshold varies by org)
- **Stewardship** — nurturing donor relationships through thank-yous, updates, and recognition

## Key Features to Build

### 1. Constituent Management
- Full constituent profiles with contact info, giving history, engagement timeline, custom fields
- Household relationships (spouses, family members who give together)
- Soft credits (attributing donations to influencers like board members)
- Wealth screening indicators (capacity to give)
- Communication preferences (email, mail, phone, text)
- Tags and custom segments

### 2. Donation Tracking
- One-time and recurring donation processing
- Pledge management (commitments to give over time)
- In-kind donation tracking (goods/services)
- Donation forms and online giving pages
- Payment methods: credit card, ACH, check, wire, stock
- Batch entry for offline gifts (checks received in mail)
- Receipt generation and tax reporting (501(c)(3) compliance)

### 3. Fundraising Campaigns
- Campaign creation with goals, timelines, and designations
- Progress tracking (revenue raised vs. goal)
- Multi-channel campaigns (email, social, events, direct mail)
- Peer-to-peer fundraising (constituents fundraise on your behalf)
- Matching gift tracking (corporate matching programs)

### 4. Analytics & Reporting
- **Dashboard widgets** (reference Bloomerang screenshot):
  - Revenue progress charts (circular progress, goal tracking)
  - Donor retention metrics (% retained year-over-year)
  - Totals by donor level (major gifts, mid-level, annual fund)
  - Giving trends (year-over-year comparisons, monthly/quarterly breakdowns)
  - Engagement heatmaps
- Custom report builder
- Export capabilities (CSV, Excel, PDF)
- Scheduled reports (email weekly/monthly summaries)

### 5. Task & Workflow Management
- Task assignment to team members (follow-ups, thank-yous, major gift solicitations)
- Due dates and priority levels
- Task templates for stewardship workflows (7-day thank-you, 30-day impact update, etc.)
- Reminders and notifications
- Activity logging (calls, meetings, emails sent)

### 6. Communications
- Email campaign builder (newsletters, appeals, thank-yous)
- Template library (acknowledgment letters, receipts, event invitations)
- Mail merge for physical mail
- Segmented audiences (lapsed donors, monthly givers, volunteers, etc.)
- Email tracking (opens, clicks, bounces)

### 7. Events & Volunteer Management
- Event registration and ticketing
- Attendee tracking and check-in
- Volunteer opportunity posting
- Volunteer hour logging
- Event revenue tracking (ticket sales, sponsorships, auction proceeds)

### 8. Data & Integrations
- Import/export tools (CSV, Excel)
- Deduplication and merge tools (finding and combining duplicate records)
- Integration connectors (payment processors, email platforms, accounting software)
- Audit logs (who changed what, when)

## Design Patterns from Bloomerang

Based on the provided screenshot, follow these UI patterns:

### Dashboard Layout
- **Personalized greeting**: "Good morning, [User Name]!"
- **Organization context**: "What's happening with [Org Name] today"
- **Refresh indicator**: "Data last refreshed [timestamp]" with Refresh button
- **Widget-based cards**: White cards with subtle shadows, rounded corners
- **Green accent color**: Progress bars, active states, primary buttons (green-600 #16a34a)
- **Chart types**: Circular progress (donut charts), bar charts, line graphs
- **Task cards**: Simple cards with title, assignee, due date, description preview

### Navigation
- **Icon + label sidebar**: Icons next to text labels (Home, Constituents, Groups, Reports, etc.)
- **Expandable sections**: Dropdown arrows for nested items (Communications, Payments, Data Tools)
- **Active state**: Green background for current page
- **Settings at bottom**: Settings separated from main nav

### Content Areas
- **Three-column dashboard**: Main metrics left, secondary metrics middle, tasks/activity right
- **Tab toggles**: "Revenue / Raised", "ALL / MY" task filters
- **Inline actions**: Edit icons, expand buttons on cards
- **Subtle separators**: Light gray borders, generous whitespace

## Data Model Concepts

When building database schemas or APIs, consider these nonprofit-specific relationships:

```
Constituent (1) ─── (many) Donations
Constituent (1) ─── (many) Tasks
Constituent (many) ─── (many) Campaigns [participation]
Constituent (many) ─── (many) Events [registrations]
Constituent (many) ─── (many) Tags [segments]
Constituent (1) ─── (many) Activities [timeline: emails, calls, meetings]
Household (1) ─── (many) Constituents [family relationships]
Donation (1) ─── (1) Campaign [optional: which campaign]
Donation (1) ─── (1) Designation [which fund]
Donation (1) ─── (1) PaymentMethod
```

Key fields to include:
- **Constituent**: firstName, lastName, email, phone, address, constituentType (donor/volunteer/member), primaryContact (boolean), householdId, totalLifetimeGiving, firstGiftDate, lastGiftDate, donorStatus (active/lapsed/new), engagementScore
- **Donation**: amount, date, paymentMethod, campaign, designation, recurring (boolean), frequency, pledgeId, receiptNumber, acknowledgmentSent (boolean), taxDeductible (boolean)
- **Campaign**: name, goal, startDate, endDate, category (annual fund/capital/event), active (boolean)
- **Task**: title, description, dueDate, assigneeId, constituentId, status (pending/completed), priority

## Build Order Recommendation

When implementing features, prioritize in this order:
1. Constituent database (CRUD operations, search, filtering)
2. Donation tracking (forms, batch entry, history)
3. Basic dashboard (revenue metrics, recent activity)
4. Task management (assignments, due dates)
5. Campaign tracking
6. Reporting and analytics
7. Communications tools
8. Events and volunteers

Start with the **minimum viable stewardship loop**: add constituents → record donations → assign thank-you tasks → send acknowledgments → view giving history.
<!-- END:nonprofit-crm-domain -->



<!-- BEGIN:module-rules -->
## DonorCRM and Compassion CRM Module Rules

OyamaCRM is **one platform with two modules**: DonorCRM and Compassion CRM.

- **DonorCRM** is donor, donation, campaign, communication, and fundraising focused. It uses the **green** (`#16a34a`) accent theme.
- **Compassion CRM** is client, case, appointment, service, assessment, and care-plan focused. It uses the **blue** (`#2563eb` / `blue-600`) accent theme.
- Both modules share: authentication, user roles, organization settings, audit logs, import/export infrastructure, and the same design system (layout, typography, card style, spacing).
- **Donor records and client records are distinct by default.** A shared person layer connects them only when staff intentionally links them.
- Sensitive client data must NOT appear inside DonorCRM without explicit permission. Donor giving history must NOT appear in Compassion CRM without a clear use case and proper permission.
- Compassion CRM pages live in `app/compassion/`. DonorCRM pages live in `app/` (top-level routes).
- Compassion CRM uses `CompassionShell` (blue `CompassionSidebar` + blue-accented `TopBar`). DonorCRM uses `AppShell` (green `Sidebar` + green-accented `TopBar`).
- Do NOT use donor-specific labels (Donations, Campaigns, YTD Raised, Donor Retention) inside Compassion CRM. Do NOT use client case-management labels (Cases, Care Plans, Assessments) inside DonorCRM unless explicitly linked.
- The TopBar in both modules shows a **module switcher** so users can switch between DonorCRM and Compassion CRM.
- Compassion CRM routes must be permission-aware. Add `// TODO: enforce Compassion workspace permission` comments wherever role checks are not yet implemented.
<!-- END:module-rules -->

<!-- BEGIN:standalone-app-boundary-rules -->
## Standalone App Boundary Rules

OyamaCRM supports standalone product apps under `app/apps/` that are distinct from CRM modules.

- Standalone apps are **apps, not CRMs**. Do not label them as DonorCRM/Compassion/Events workspaces.
- App routes must live under `/apps/*` and use a basic app shell (for example `AppProductShell`) instead of CRM shells.
- Default app shell behavior must exclude CRM top-search and CRM AI controls.
- Standalone apps must not read/write donor/client/case/donation CRM data unless a specific, permission-reviewed integration is implemented.
- Use explicit in-app language when data is isolated: "standalone app data" or "app workspace data".
- Keep visual consistency with platform styling (cards, spacing, typography), but avoid CRM-specific labels, nav structure, and analytics widgets unless intentionally integrated.
- Initial reference implementation: Trivia Software route at `/apps/trivia` using the basic app shell.
<!-- END:standalone-app-boundary-rules -->

<!-- BEGIN:events-crm-boundary-rules -->
## Events CRM Scope Boundary Rules

Events CRM uses an **event-first workspace model** with explicit global tools.

- Event-scoped tools must live under `/events/[eventId]/[tool]` and only operate on that selected event context.
- The selector page (`/events/workspace`) is the entry point for choosing an event before opening scoped tools.
- Global tools that intentionally operate outside selected-event scope must remain available and clearly labeled:
  - `/events/reports` (cross-event reporting)
  - `/events/page-builder` (event page creation workflows)
  - `/events/templates` (template management)
  - `/events/events` (overall event registry management)
- Never treat known static route segments (for example `workspace`, `reports`, `page-builder`, `templates`, `events`) as `eventId` values.
- Any Events tool that is not fully wired must show a clear in-development warning and must not pretend data is real.

<!-- END:events-crm-boundary-rules -->

<!-- BEGIN:reference-software-rules -->
## Reference Software Folder Rules

The `REFERANCE_SOFTWARE` folder stores external or older software projects that are useful as functional references.

These projects are **not part of the active application** unless explicitly stated. Agents may inspect them for workflows, features, data models, edge cases, and implementation ideas, but must **not blindly copy UI, CSS, branding, file structures, or outdated architecture** into the main app.

When using a reference project, agents must document:
- Which reference project was reviewed
- Which features or workflows were useful
- Which ideas should be adapted
- Which ideas should be ignored
- What should be built inside the current OyamaCRM architecture

### Galasoft Reference

**Location:** `REFERANCE_SOFTWARE/GalaSoft/`

Galasoft is being used as a functional reference for the Events CRM. Agents should study Galasoft for event-management workflows, ticketing, registration, attendee handling, reporting, event pages, and administrative tools.

**Do not copy Galasoft UI/CSS.** Only use it to understand functionality and feature ideas.

**Key functional concepts learned from Galasoft (adapt, don't copy):**
- Guest model: checkin code (unique QR/code), payment status (paid/due/comp/sponsored), RSVP status, meal preference, seat number, party name
- Table model: table number, shape (round/rectangle), position coordinates for seating chart, host name, sponsored flag
- Ticket types: individual vs table-of-N, comp, sponsored — all distinct types with different seat counts
- Check-in: multiple modes — QR scan, search by name, browse by table, name/nickname tabs
- Registration service: transactional insertions with auto seat assignment within tables
- Invitation system: tokenized table invite links for table hosts to invite their own guests
- Sponsorship: packages with included seats that auto-assign sponsored guests
- Outbox/notifications: queued email/SMS sending with retry logic

**Reference files of interest:**
- `REFERANCE_SOFTWARE/GalaSoft/backend/schema.sql` — data model reference
- `REFERANCE_SOFTWARE/GalaSoft/vite-project/src/pages/CheckInDashboard.tsx` — multi-mode check-in tabs
- `REFERANCE_SOFTWARE/GalaSoft/vite-project/src/pages/Dashboard.tsx` — live ops overview with progress bars
- `REFERANCE_SOFTWARE/GalaSoft/backend/services/registrationService.js` — transactional guest creation
- `REFERANCE_SOFTWARE/GalaSoft/vite-project/src/pages/EventOps/EventOpsHub.tsx` — event operations hub
- `REFERANCE_SOFTWARE/GalaSoft/vite-project/src/pages/Seating/` — seating chart components

**Galasoft TS errors are pre-existing** (`@playwright/test` missing, FC<{}> type issues) — do not attempt to fix them and do not count them as new errors in CI.

<!-- END:reference-software-rules -->

<!-- BEGIN:import-mapping-rules -->
## Import Mapping and Merge Workflow Rules

The import mapper must NEVER fall behind the data model. Treat field mapping, validation, duplicate detection, and merge behavior as part of the same feature.

**Rules for all agents:**
1. Whenever a new field is added to any CRM model (donor, client, case, household, donation, communication, note, task, appointment, assessment, care-plan), review `app/data-tools/import/` and update `IMPORT_FIELD_MAP` in `app/data-tools/import/fieldMap.ts` if that field should be importable.
2. Always keep `docs/status/import-tools.md` current with what works, what is missing, and what the next step is.
3. The import flow must always be: Upload CSV → Preview Data → Map Fields → Validate Required Fields → Detect Duplicates → Review Merge Suggestions → Confirm Import → Show Results → Update Data Quality.
4. Dry-run mode must be preserved and tested. Never remove it.
5. Merge workflow must never silently overwrite data. Always show the user what will change.
6. Add `// TODO: backend API needed` comments where import/merge backend endpoints are not yet wired.
<!-- END:import-mapping-rules -->

<!-- BEGIN:compassion-crm-rules -->
## Compassion CRM (Client) Rules

The Compassion CRM is **privacy-first** and contains sensitive client data (intake records, assessments, case notes, appointments). Treat every client record as its own isolated scope.

### Client-scope rules
1. Every client tool/tab must be scoped by `clientId`. Notes, appointments, documents, services, assessments, pregnancy tests, ultrasounds, material assistance, referrals, and communication logs **must** filter by the client whose profile is open.
2. Compassion CRM data must never appear in Donor CRM or Events CRM lists/reports/exports unless the user explicitly links a donor↔client through the shared person layer.
3. SSN / SIN / tax-ID columns are **always** stripped server-side, even if a payload includes them.
4. Public-facing forms (scheduling widget, intake forms) must never expose private staff-only fields, internal IDs, or other clients' data.
5. Imports must run through `app/compassion/import/clients/clientImportValidator.ts` (the single source of truth for "is this row real?"). Any new validation rule should land there, with a unit test.

### Public scheduling source-of-truth rules
- Widget scheduling policy lives in the appointment-widget config and is office-managed (interval, duration, lead time, advance window, availability blocks, blackout dates).
- Public booking UIs must never rely on freeform datetime entry as source of truth. They must consume server-generated slot availability.
- Slot generation and conflict checks must happen server-side, and submissions must be revalidated against current slot availability at submit time.
- Use `/api/compassion-public/widget/:token/slots` for slot display and `/api/compassion-public/widget/:token/appointments` for submit-time validation.
- Embeddable scheduling is supported with script embedding (`/embed/compassion-schedule.js`) and iframe embedding; both must enforce the same backend validation rules.

### Importer source of truth
- Heuristics for rejecting metadata/garbage/widget rows live in `clientImportValidator.ts` (`GARBAGE_NAME_PATTERNS`, `RESERVED_NAME_TOKENS`).
- The same heuristics are mirrored in `server/src/routes/compassion.ts` `POST /clients/import` for defense-in-depth. Keep them in sync; if you change one, change the other.
- The list endpoint `GET /api/compassion/clients` also defensively filters comma- or em-dash-named legacy rows out of responses. Keep this guard.

### "Not yet implemented" warning policy
Any tab, button, page, or feature in the Compassion CRM that is **not fully functional** must show a clear popup or banner explaining that the feature is still in development. Add an entry to the table in `CLIENT_CRM_TASKS.md` ("Not yet implemented popup tracking") with explicit criteria for removing the warning. The warning may only be removed once:
1. All listed removal criteria are met.
2. At least one happy-path test exists.
3. The criteria-met removal is mentioned in the PR description.

### Documentation
Keep these three documents current as the Compassion CRM evolves:
- `CLIENT_CRM_AUDIT.md` — current state of importer, search, profile, scheduling.
- `CLIENT_CRM_IMPORTER_PLAN.md` — the multi-batch importer plan.
- `CLIENT_CRM_TASKS.md` — live checklist; never delete completed entries.

## Compassion CRM Client-Scoped Architecture

Compassion CRM is a client-services module. Keep top-level navigation focused and avoid turning the sidebar into a list of every form type.

Primary sidebar items should remain:
- Dashboard
- Clients
- Cases
- Appointments
- Tasks
- Follow Ups
- Reports
- Data Tools
- Settings

Detailed service records must live inside the client-scoped workspace (`/compassion/clients/[clientId]`) rather than as top-level nav items. This includes:
- Care plans
- Activities and timeline entries
- Notes
- Assessments
- Medical records
- Pregnancy tests
- Sonograms
- Referrals
- Classes
- Boutique/resource usage
- Documents
- Communications
- Audit logs

The client profile is the source of truth for client-specific history.

## Compassion CRM Audit And Communication Rules

Compassion CRM may contain sensitive client-service data and requires stronger audit behavior than donor workflows.

- Any client-related view/create/update/import/merge/delete action should eventually write an audit event.
- Audit log views should be available in the client workspace and remain privacy-safe.
- Email and SMS settings are module-specific. Do not assume DonorCRM, Compassion CRM, and Events CRM share sender defaults, consent behavior, or templates.
- When communication features are not fully implemented, show clear in-development notices and add `// TODO: backend API needed` where persistence routes are missing.
<!-- END:compassion-crm-rules -->

<!-- BEGIN:quickbooks-plugin-rules -->
## QuickBooks Integration Rules

OyamaCRM integrates with QuickBooks Online via the `intuit-oauth` npm package (v4.2.3). This integration is **DonorCRM-only** — it must never appear in Compassion CRM UI.

### Architecture

| Layer | Location | Notes |
|-------|----------|-------|
| npm package | root `package.json` | `intuit-oauth` installed at workspace root |
| Server service | `server/src/services/quickbooksService.ts` | OAuth client wrapper, `pushDonationToQB()` |
| API routes | `server/src/routes/quickbooks.ts` | Registered at `/api/quickbooks` in `server/src/index.ts` |
| Plugin context | `app/components/plugins/PluginProvider.tsx` | `usePlugins()` hook |
| Layout wrapping | `app/layout.tsx` | `<PluginProvider>` wraps `<AppShell>` |
| Sidebar item | `app/components/layout/Sidebar.tsx` | "QB Sync" injected when `qbEnabled` is true |
| Settings UI | `app/components/settings/plugins/PluginsSettingsPage.tsx` | Enable/disable toggle + connect/disconnect |
| Settings page | `app/settings/plugins/page.tsx` | Thin wrapper |
| Queue page | `app/quickbooks-sync/page.tsx` | Full queue management dashboard |
| Queue table | `app/components/quickbooks/QBSyncQueueTable.tsx` | Table + inline edit |
| Status banner | `app/components/quickbooks/QBConnectionStatus.tsx` | Connection state indicator |
| Donation form | `app/components/donations/DonationForm.tsx` | "Add to QuickBooks Queue" checkbox |
| Prisma models | `prisma/schema.prisma` | `PluginSetting`, `QBSyncQueueItem`, `QBSyncStatus` |

### Non-negotiable design constraints

1. **NEVER auto-sync.** Donations must only reach QuickBooks when a staff member manually triggers a sync (individual item or "Sync All"). Remove any auto-sync logic if found.
2. **Queue is opt-in per donation.** The "Add to QuickBooks Queue" checkbox appears in DonationForm only when the plugin is enabled. Existing donations are never added automatically.
3. **SYNCED items are immutable.** Once a queue item reaches `SYNCED` status, it cannot be deleted or edited (soft-deletes are blocked server-side). This preserves the audit trail.
4. **FAILED items reset to PENDING on edit.** Editing a FAILED item resets its status and clears `errorMessage` so it can be retried cleanly.
5. **Duplicate prevention.** `POST /api/quickbooks/sync-queue` returns 409 if the donation already has a non-SKIPPED queue entry.
6. **Rate limit awareness.** `sync-all` sends items sequentially with a 400ms delay between requests (≤150 req/min).

### Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `QB_CLIENT_ID` | Yes (for OAuth) | Intuit Developer app client ID |
| `QB_CLIENT_SECRET` | Yes (for OAuth) | Intuit Developer app client secret |
| `QB_REDIRECT_URI` | Optional | Defaults to `http://localhost:4000/api/quickbooks/callback` |
| `QB_ENVIRONMENT` | Optional | `sandbox` (default) or `production` |

Without `QB_CLIENT_ID` + `QB_CLIENT_SECRET`, the plugin UI shows a "not configured" warning. OAuth buttons are disabled. The plugin may still be "enabled" in the DB but connection is impossible.

### Prisma models

**`PluginSetting`** — per-org plugin state. Unique on `(organizationId, pluginKey)`. `config` JSON stores OAuth tokens when connected. `pluginKey = "quickbooks"` is the only key currently used.

**`QBSyncQueueItem`** — one row per donation queued for sync. Fields: `customerName`, `memo`, `qbAccount`, `amount` (all editable before sync), `status` (PENDING/SYNCED/FAILED/SKIPPED), `attemptCount`, `errorMessage`, `qbEntityId`, `syncedAt`.

**`QBSyncStatus`** enum — `PENDING | SYNCED | FAILED | SKIPPED`.

### logAudit and resolveOrganizationId patterns

In QuickBooks routes, always use:
```ts
// CORRECT
const organizationId = await resolveOrganizationId({ req }); // object wrapper
await logAudit({ action: "...", organizationId, userId: req.user?.id, metadata: {} });

// WRONG — these will not compile
const organizationId = await resolveOrganizationId(req);
await logAudit(req, { action: "..." });
```

### Adding new QB features

- New QB API routes go in `server/src/routes/quickbooks.ts`
- New QB UI components go in `app/components/quickbooks/`
- QB settings UI components go in `app/components/settings/plugins/`
- QB plugin state (enabled, connected, etc.) is always read from `usePlugins()` — never fetched independently in components
- The `PluginProvider` refetches on `refresh()` — call it after any enable/disable/connect/disconnect action
<!-- END:quickbooks-plugin-rules -->

<!-- BEGIN:donorcrm-stabilization-rules -->
## DonorCRM Stabilization Rules

When a task is explicitly DonorCRM-only, follow these boundaries:

- Do not expand scope into Compassion, Events, HRM, Watchdog, WebMaster, or standalone apps unless a DonorCRM workflow already depends on a shared system.
- Use audit-first passes: document current behavior before changing route contracts, schema fields, or navigation semantics.
- Do not casually rename donor routes or Prisma donor fields used by reports, imports, and smoke tests.
- Keep donor workflows production-safe by preferring small, composable changes over broad rewrites.
- Treat dashboard, constituents, donations, campaigns, tasks, communications, letters/printables, reports, steward paths, and donor follow-up as one connected stewardship loop.
- For donor insight features (including Steward Signals), use suggestion language and require human review for outbound actions.
- Keep DonorCRM feature status tracking updated in `docs/status/features.md` and donor audit updates in `docs/DONOR_CRM_AUDIT.md`.

Status labels in donor docs and readiness summaries must stay restricted to:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented
<!-- END:donorcrm-stabilization-rules -->

<!-- BEGIN:donor-engagement-system-rules -->
## Donor Engagement System Rules

DonorCRM communications features must be implemented as one connected engagement system.

- Communications is the central outreach workspace for campaigns, send queue, and communication log views.
- Email Builder is editor-only. Launch it from communications campaign context rather than treating it as a standalone workflow.
- Letters and Printables owns print/mail/PDF workflows. Letter-to-email handoff must use the existing generated-letter to email-draft bridge.
- Letters and Printables queue operations should flow as: Needs Review -> Approved -> Queued For Print -> Printed -> Queued For Mail -> Mailed.
- Queue operations should use explicit permissions (`letters.manage_print_queue`, `letters.manage_mail_queue`) instead of broad workflow permissions.
- Steward Paths orchestrates outreach by creating or advancing tasks, letters, and drafts in existing systems. Do not create a second outreach engine.
- Tasks represent human follow-up work; Activities are the timeline source of truth for what happened.
- Use shared user-facing status language across channels when possible:
  - Draft
  - Needs Review
  - Approved
  - Scheduled
  - Sent
  - Generated
  - Printed
  - Mailed
  - Completed
  - Failed
  - Canceled
  - Archived
- Default outbound behavior is draft-first and review-first. Never auto-send by default.
- Respect communication preferences (doNotEmail, emailOptOut, doNotMail, doNotCall, doNotContact) and do not silently override.
- For donor communication claims, document persistence evidence in:
  - `docs/DONOR_ENGAGEMENT_SYSTEM.md`
  - `docs/DONOR_CRM_COMMUNICATIONS_AUDIT.md`
  - `docs/DONOR_CRM_LETTERS_PRINTABLES_PRODUCTION_PLAN.md`
  - `docs/DONOR_CRM_PRINT_QUEUE.md`
  - `docs/DONOR_CRM_FORM_LETTER_EDITOR.md`
  - `docs/status/features.md`
  - `docs/status/production-readiness-checklist.md`
<!-- END:donor-engagement-system-rules -->

<!-- BEGIN:donor-grants-workspace-rules -->
## Donor Grants Workspace Rules

DonorCRM Grants must be implemented as a grant research, writing, deadlines, reminders, and case-file workspace.

- Grant opportunities are not donation ledger records.
- Do not model grants as generic sales/deal pipeline objects in UX language.
- Prefer grant-specific language: Research, Requirements, Writing, Submission, Decision, Report, Renewal.
- The Grants workspace owns opportunity research, funder notes, requirements, reminders, writing tasks, and resources.
- Award money actually received must be recorded through Donations using a separate grant-received entry flow.
- Do not auto-create donation records when grants are created or moved to Awarded.
- If a grant page links to Donations, treat it as a handoff action only and keep financial source-of-truth in Donations.
- Grant reminders/tasks should remain clearly labeled as grant work when surfaced outside Grants.
- Do not store secrets (portal passwords/tokens) in grant notes/resources; use secure vault tooling for secrets.
- Keep documentation current when grant behavior changes:
  - `docs/DONOR_CRM_GRANTS_AUDIT.md`
  - `docs/DONOR_CRM_GRANTS_RESEARCH_WORKSPACE.md`
  - `docs/status/features.md`
  - `docs/status/production-readiness-checklist.md`
<!-- END:donor-grants-workspace-rules -->

<!-- BEGIN:production-readiness-tracking-rules -->
## Production Readiness Tracking Rules

When updating project status, audits, or release claims, use:

- `docs/status/production-readiness-checklist.md` as the single release-gate source of truth.
- `HOWTO/HOW_TO_USE.md` for office-facing operational guidance.

Status labels for release tracking must be exactly:

- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

If a route or workflow is scaffolded, unstable, or only suitable for demos, do not mark it as Working in release-readiness summaries.
<!-- END:production-readiness-tracking-rules -->

<!-- BEGIN:readiness-audit-rules -->
## Readiness Audit Rules

When running a readiness audit, treat command evidence as the source of truth and avoid inferred claims.

- Always run and record this validation set when requested for full readiness checks:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm typecheck:web`
  - `pnpm typecheck:server`
  - `pnpm test:smoke`
  - `pnpm test:e2e`
  - `pnpm test:e2e:mobile`
  - `pnpm test:e2e:livecom`
  - `pnpm test`
  - `pnpm test:coverage`
  - `pnpm build`
  - `pnpm build:server`
  - `pnpm db:generate`
  - `pnpm db:verify:linux-casing`
- Store dated command artifacts under `docs/status/audit-artifacts/YYYY-MM-DD/` and keep a machine-readable `command-summary.jsonl` with command, UTC start/end, exit code, and log path.
- Publish dated audit docs for each pass and link them from `docs/status/production-readiness-checklist.md`.
- Never claim production-ready when any required lane is Broken.
- Environment failures (for example unreachable host/port, OS file lock behavior) must be documented as real blockers unless rerun evidence proves resolution.
- Keep release-readiness labels restricted to:
  - Working
  - Partially Working
  - Demo Only
  - Broken
  - Not Implemented
- If evidence is missing for a lane, mark it as Partially Working or Broken rather than assuming Working.
<!-- END:readiness-audit-rules -->

<!-- BEGIN:donor-email-builder-rules -->
## Donor Email Builder Rules

DonorCRM Email Builder is a campaign studio, not a generic page builder.

- Keep the three-panel studio structure: Block Library, Canvas, Inspector.
- Keep draft-first behavior explicit in UI and save payloads.
- Raw HTML editing for narrative blocks must stay optional and hidden by default.
- Prefer rich-text authoring controls for text and AI text blocks.
- New donor blocks should use nonprofit stewardship language and merge-token readiness.
- Compliance footer behavior must remain visible in review workflows before broad sends.
- Status labels in builder flows must use shared language: Draft, Needs Review, Ready to Send, Scheduled, Sent.
- Do not auto-send by default; preserve explicit review/test/send actions.
<!-- END:donor-email-builder-rules -->

<!-- BEGIN:oyama-webmaster-command-center-rules -->
## OyamaWebMaster Command Center Rules

OyamaWebMaster is the platform website command center and publishing layer.

- Treat OyamaWebMaster as an app-level site manager, not a disconnected demo page builder.
- Site records must include clear lifecycle and context metadata (type, owner, module linkage, launch readiness, publish linkage).
- Site lifecycle operations must be non-destructive by default: archive, restore, duplicate first.
- Avoid hard-delete flows for site and page operations unless explicit retention policy and backup controls are present.
- Keep CRM source-of-truth boundaries intact:
  - Donor data stays owned by donor APIs/models.
  - Compassion client data stays owned by compassion APIs/models.
  - Event data stays owned by events APIs/models.
- Cross-module linkage in Webmaster should use references (`connected_module`, `connected_record_id`) rather than data copying.
- Publishing claims must stay honest:
  - If preflight validation, target deployment, or rollback history is missing, mark workflows as Partially Working or Not Implemented.
- Required Webmaster architecture docs:
  - `docs/OYAMA_WEBMASTER_REBUILD_PLAN.md`
  - `docs/OYAMA_WEBMASTER_SITE_TYPES.md`
  - `docs/OYAMA_WEBMASTER_PUBLISHING_ARCHITECTURE.md`
  - `docs/OYAMA_WEBMASTER_CRM_INTEGRATION.md`
  - `docs/OYAMA_WEBMASTER_DATA_SAFETY.md`
<!-- END:oyama-webmaster-command-center-rules -->
