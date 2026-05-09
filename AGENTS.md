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
<!-- END:compassion-crm-rules -->
