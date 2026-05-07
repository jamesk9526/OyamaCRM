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


