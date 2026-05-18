# OyamaCRM Event Studio Page Builder Audit & Build Plan

**Repo audited:** `jamesk9526/OyamaCRM`  
**Date:** 2026-05-18  
**Scope:** Current Events CRM / Event Studio public page builder, registration interaction, TableLink readiness, public page rendering, backend persistence, check-in readiness, UI changes, and removal of new-tab preview mode.

---

## 1. Executive Summary

The current Event Page Builder is a good early shell, but it is still mostly a **section-order preview tool**, not yet a production-grade event registration/page system.

The repo already has:

- An event-scoped builder entrypoint.
- A builder shell inside Events CRM.
- A left section rail, center preview, and right inspector.
- Basic event data loading from Events CRM APIs.
- A public root-slug event page route.
- Basic backend slug/status storage using plugin settings.
- Existing Prisma models for `Event`, `TicketType`, `EventOrder`, `EventGuest`, and `EventTable`.

However, the current builder still needs major work before it can support full public registration, table management, guest self-entry, payments, TableLink, and Check-In Studio.

The biggest architectural issue is this:

> The builder UI and the public page renderer are not yet using the same saved page schema.

The builder lets staff reorder and toggle sections in local state, but the public page does not render that customized section state. The public page currently renders a hardcoded event page from event/ticket/sponsor/report data.

The next development pass should convert this from a preview shell into a real **Event Public Experience Builder** backed by persistent page JSON, registration-flow JSON, publish/version history, and backend services.

---

## 2. Files Audited

The audit focused on these current repo files:

```txt
app/events/page-builder/page.tsx
app/events/[eventId]/event-page/page.tsx
app/components/events/EventsPageBuilderLanding.tsx
app/components/events/page-builder/EventPageBuilderShell.tsx
app/components/events/page-builder/EventPageBuilderTopBar.tsx
app/components/events/page-builder/EventPageBuilderSectionRail.tsx
app/components/events/page-builder/EventPageBuilderPreview.tsx
app/components/events/page-builder/EventPageBuilderInspector.tsx
app/components/events/page-builder/section-config.ts
app/components/events/page-builder/types.ts
app/[publicEventSlug]/page.tsx
app/components/events/public/PublicEventPage.tsx
app/api/events/public/page/[pageSlug]/route.ts
server/src/routes/events.ts
prisma/schema.prisma
```

---

## 3. Current State: What Is Working

### 3.1 Event-scoped entry flow exists

The builder is correctly moving in the right direction by forcing the user into an event-scoped workflow.

Current flow:

```txt
/events/page-builder
  -> choose event
/events/[eventId]/event-page
  -> scoped builder shell
```

This matches the desired Event Studio architecture: select an event first, then use tools inside that event context.

### 3.2 Builder shell loads real event data

The builder shell loads:

```txt
/api/events/:eventId
/api/events/:eventId/ticket-types
/api/events/:eventId/sponsors
/api/events/:eventId/report
/api/events
/api/events/:eventId/page-builder-config
```

This is good because the builder is already grounded in real Events CRM data.

### 3.3 UI has the correct basic builder shape

The current UI has the right general structure:

```txt
Top controls
Left section rail
Center preview
Right inspector
```

That should stay, but it needs to become more enterprise-grade and more functional.

### 3.4 Basic public page slug storage exists

The backend stores page slug/status metadata under the plugin key:

```txt
events-page-builder
```

This is useful as a temporary bridge, but it should not remain the final page storage system.

### 3.5 Public root-slug route exists

The repo has:

```txt
app/[publicEventSlug]/page.tsx
```

This allows public event pages to live at clean root-level slugs like:

```txt
/love-at-first-beat-2026
```

This is good for clean sharing, but the route should be hardened so it does not conflict with app routes, public portals, or future public page types.

### 3.6 Existing Event CRM models provide a useful foundation

The Prisma schema already includes:

```txt
Event
TicketType
EventOrder
EventOrderItem
EventGuest
EventTable
EventSponsor
EventAttendance legacy model
```

This means the feature does not need to start from nothing. The next work should extend this foundation rather than inventing a disconnected system.

---

## 4. Current Gaps and Problems

## 4.1 Publish is not reliable yet

The builder has a `handlePublishToggle()` function that changes React state locally:

```ts
function handlePublishToggle() {
  if (pageStatus === "Published") {
    setPageStatus("Draft");
    return;
  }

  setPageStatus("Published");
  setLastPublishedAt(new Date().toISOString());
}
```

Problem:

- It does not call the backend.
- It does not persist the published status.
- It does not persist a page snapshot.
- It does not create a version.
- It does not separate draft JSON from published JSON.

Required fix:

```txt
Replace local publish toggle with backend publish action.
```

New flow:

```txt
Click Publish
  -> validate publish checklist
  -> POST /api/events/:eventId/pages/:pageId/publish
  -> create EventPageVersion
  -> copy draftJson to publishedJson
  -> set status = PUBLISHED
  -> set publishedAt
  -> return updated page
```

---

## 4.2 Section state is not persisted

Current section state is created with:

```ts
createDefaultEventPageSectionState()
```

Then managed only in React state.

Problem:

- If the user refreshes, changes are lost.
- Section order is not saved.
- Enabled/hidden status is not saved.
- Lock-to-event-data state is not saved.
- The public renderer does not use the builder's section state.

Required fix:

```txt
Persist section configuration inside EventPage.draftJson.
```

Recommended structure:

```ts
EventPageJson {
  version: 1;
  theme: EventPageTheme;
  layout: EventPageLayout;
  sections: EventPageSectionInstance[];
  registrationFlow?: RegistrationFlowConfig;
}
```

Section instance:

```ts
EventPageSectionInstance {
  id: string;
  type: string;
  enabled: boolean;
  lockToEventData: boolean;
  sortOrder: number;
  settings: Record<string, unknown>;
  contentOverrides?: Record<string, unknown>;
  visibilityRules?: VisibilityRule[];
}
```

---

## 4.3 Builder and public renderer are disconnected

The current public event page renders a hardcoded page layout. It does not render:

- The builder section order.
- Hidden/visible section state.
- Design overrides.
- Custom copy.
- Registration flow settings.
- Page theme.
- SEO metadata.
- Draft vs published JSON.

Current public route fetches event/ticket/sponsor/report payload and renders a fixed layout.

Required fix:

```txt
Create a shared EventPageRenderer used by both the builder preview and the public page.
```

Target architecture:

```txt
EventPageBuilderPreview
  -> EventPageRenderer(mode="builder-preview", pageJson=draftJson)

PublicEventPage
  -> EventPageRenderer(mode="public", pageJson=publishedJson)
```

This ensures what staff build is what the public sees.

---

## 4.4 Public Draft pages appear accessible

The public page payload currently resolves a slug and returns page data even when the page status is Draft. The frontend then displays a draft warning.

Problem:

- Draft pages should not be publicly visible to normal visitors.
- Draft preview should require an authenticated preview path or a signed preview token.
- Public published pages should only show `Published` pages.

Required fix:

```txt
Public anonymous request:
  show only PUBLISHED pages

Authenticated CRM preview:
  show DRAFT or PUBLISHED via preview token/session
```

Suggested routes:

```txt
Public:
GET /api/public/events/pages/:slug

Authenticated preview:
GET /api/events/:eventId/pages/:pageId/preview
GET /events/:eventId/event-page/preview
```

---

## 4.5 New-tab preview mode should be removed

Current builder preview behavior uses:

```ts
window.open(draftPreviewUrl, "_blank", "noopener,noreferrer");
```

Problem:

- It breaks the builder workflow.
- Staff lose context by jumping into a new tab.
- It hides whether the preview is draft, live, mobile, or published.
- It makes the builder feel less enterprise and less like a controlled studio.

Required fix:

```txt
Remove new-tab mode as the primary preview behavior.
```

Replace it with:

```txt
Inline Preview Mode
Preview Drawer
Device Preview Toggle
Public URL Copy Button
Optional "Open Live Page" link only for already published pages
```

Recommended UI:

```txt
Top Bar:
[Back to Event] [Page: Main Landing] [Draft Saved] [Desktop | Tablet | Mobile] [Preview] [Publish]

Preview button behavior:
- Opens an in-app preview drawer or full-screen modal.
- Does not open a new browser tab.
- Shows draft preview using the same renderer.
```

Only keep external opening as a secondary action:

```txt
Open Live Page
```

This button should only appear when status is `PUBLISHED`.

---

## 4.6 The builder is section-first but not yet block/flow-ready

Current sections are fixed:

```txt
hero
event-details
registration-form
table-host-signup
sponsorship-levels
donation-goal
progress-meter
speaker-program
schedule
faq
map-location
sponsor-logos
share-buttons
footer
```

This is a good start, but it is not enough for full registration interaction.

Needed:

- Page sections.
- Blocks inside sections.
- Registration flow steps.
- Field mapping.
- Payment configuration.
- TableLink configuration.
- Conditional visibility.
- Publish readiness checks.

Recommended design:

```txt
Page
  -> Sections
      -> Blocks
Registration Flow
  -> Steps
      -> Fields
      -> Backend actions
```

Do not treat registration as a static page section. Registration is an interactive flow with backend side effects.

---

## 4.7 Inspector is too limited

Current inspector only supports:

```txt
Show Section
Lock To Event Data
Connected Fields display
```

Needed inspector panels:

```txt
Content
Layout
Style
Data Binding
Registration Behavior
Visibility Rules
SEO
Advanced
```

Examples:

For `Ticket Selector`:

```txt
Ticket types to show
Individual/table/sponsor filters
Quantity limits
Sold-out behavior
Require guest info now?
Allow partial guest info?
Payment required?
CTA label
Success action
```

For `TableLink Login`:

```txt
Require TableKey
Require host email
Magic link expiration
Allow host self-request?
Send email template
Rate limit policy
```

For `Guest Info Form`:

```txt
Fields
Required fields
Meal choice source
Custom questions
Self-entry token rules
Confirmation email trigger
```

---

## 4.8 Left rail needs better organization

Current left rail is a list of all sections with arrow controls.

Problems:

- It does not feel like a professional builder library.
- It does not separate page structure from reusable blocks.
- It has no grouped block library.
- Arrow-only movement is okay short term, but it should not be the final UX.
- There is no “Add Section,” “Duplicate,” “Delete,” or “Section Template” flow.

Required UI redesign:

```txt
Left Panel Tabs:
1. Outline
2. Sections
3. Blocks
4. Data
```

Outline tab:

```txt
Current page section order
Drag/drop reorder
Hide/show
Duplicate
Delete
```

Sections tab:

```txt
Hero
Event Details
Ticket Registration
Table Purchase
Sponsor Packages
Donation Goal
FAQ
Map
Footer
```

Blocks tab:

```txt
Text
Image
Button
Countdown
Ticket Selector
Guest Form
Payment Summary
TableLink Login
Confirmation Summary
QR Code
```

Data tab:

```txt
Event fields
Ticket types
Sponsor records
Donation progress
Table data
Guest fields
Merge fields
```

---

## 4.9 Current public page has no registration interaction

The current public page shows tickets, but it does not let users:

- Select tickets.
- Buy a table.
- Register guests.
- Make a payment.
- Create EventOrder records.
- Create EventGuest records.
- Start a sponsor registration.
- Add a donation.
- Receive a confirmation.
- Get a QR code.
- Use TableLink.

Required work:

```txt
Add real backend registration flow.
```

Minimum MVP interaction:

```txt
1. Select ticket/table/sponsor package
2. Enter purchaser info
3. Add known guests or skip unknown guests
4. Add optional donation
5. Checkout with Stripe
6. Stripe webhook confirms order
7. Backend creates guests/tables/seats/invites
8. Confirmation page renders real registration data
9. Confirmation email is logged and sent
```

---

## 4.10 Current EventTable model is not strong enough for TableLink

Current `EventTable` supports:

```txt
id
eventId
name
capacity
notes
tableNumber
isSponsored
hostName
xPosition
yPosition
shape
```

Needed additions:

```txt
tableUid
publicCode
hostEmail
hostPhone
status
lockedAt
lockedById
accessTokenHash or separate TableLinkAccessToken model
```

Better:

Create separate models:

```txt
EventTableSeat
EventTableHostAccess
EventGuestInvite
```

Do not overload `EventTable` with all access/invite logic.

---

## 4.11 Current EventGuest check-in is too simple

Current `EventGuest` has:

```txt
checkedIn Boolean
checkedInAt DateTime?
checkinCode String?
```

Problem:

- No audit trail.
- No check-in method.
- No user/device record.
- No duplicate attempt tracking.
- No reversal history.
- No exception queue.
- No table check-in workflow.
- No distinction between QR scan, manual search, table check-in, walk-in, or replacement.

Required fix:

```txt
Add EventCheckInRecord.
```

Example:

```ts
EventCheckInRecord {
  id: string;
  eventId: string;
  guestId?: string;
  tableId?: string;
  seatId?: string;
  method: "qr_scan" | "name_search" | "table_search" | "manual" | "bulk_table" | "walk_in";
  status: "checked_in" | "reversed" | "duplicate_attempt" | "needs_review";
  checkedInByUserId?: string;
  checkInDeviceId?: string;
  checkedInAt: Date;
  notes?: string;
}
```

Keep `EventGuest.checkedIn` as a denormalized convenience field if desired, but the check-in record should become the source of truth.

---

## 4.12 Route naming should be cleaned up

Current public URL builder creates:

```txt
/{pageSlug}
```

Recommended final public URL patterns:

```txt
/events/:eventSlug
/events/:eventSlug/register
/events/:eventSlug/sponsor
/events/:eventSlug/table
/events/:eventSlug/invite/:token
/events/:eventSlug/confirmation/:registrationId
```

Optional root vanity slug can remain:

```txt
/:publicEventSlug
```

But the canonical route should be under `/events/:eventSlug` to avoid conflicts and make the system easier to maintain.

Recommended rule:

```txt
Canonical public event URL = /events/:eventSlug
Root vanity URL = optional redirect/alias
```

---

## 5. Recommended New Product Structure

Rename the builder area internally from simple “Event Page Builder” to:

```txt
Public Experience
```

Inside Event Studio:

```txt
Event Studio
  Overview
  Registration
  Tables
  Guests
  Seating
  Check-In Studio
  Emails
  Reports
  Public Experience
    Pages
    Registration Flow
    TableLink
    Emails
    Public Settings
```

This makes it clear that this is not just a webpage editor. It controls the full external event experience.

---

## 6. Target Architecture

## 6.1 Data model

Add these new models:

```prisma
model EventPage {
  id             String   @id @default(cuid())
  organizationId String
  eventId        String
  title          String
  slug           String
  type           String
  status         String   @default("DRAFT")
  draftJson      Json?
  publishedJson  Json?
  seoTitle       String?
  seoDescription String?
  ogImageUrl     String?
  publishedAt    DateTime?
  createdById    String?
  updatedById    String?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@unique([organizationId, slug])
  @@index([eventId, status])
}

model EventPageVersion {
  id             String   @id @default(cuid())
  organizationId String
  eventId        String
  pageId         String
  versionNumber  Int
  snapshotJson   Json
  createdById    String?
  createdAt      DateTime @default(now())
  notes          String?

  @@unique([pageId, versionNumber])
  @@index([eventId, createdAt])
}

model EventRegistration {
  id             String   @id @default(cuid())
  organizationId String
  eventId        String
  orderId        String?
  purchaserEmail String?
  purchaserName  String?
  status         String   @default("DRAFT")
  source         String   @default("public_page")
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([eventId, status])
}

model EventTableSeat {
  id        String @id @default(cuid())
  eventId   String
  tableId   String
  guestId   String?
  inviteId  String?
  seatNumber Int
  status    String @default("EMPTY")

  @@unique([tableId, seatNumber])
  @@index([eventId, tableId, status])
}

model EventGuestInvite {
  id             String   @id @default(cuid())
  eventId        String
  tableId        String?
  seatId         String?
  guestId        String?
  inviteEmail    String?
  invitePhone    String?
  tokenHash      String   @unique
  status         String   @default("CREATED")
  expiresAt      DateTime?
  completedAt    DateTime?
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  @@index([eventId, status])
}

model EventCheckInRecord {
  id                 String   @id @default(cuid())
  eventId             String
  guestId             String?
  tableId             String?
  seatId              String?
  method              String
  status              String
  checkedInByUserId   String?
  checkInDeviceId     String?
  checkedInAt         DateTime @default(now())
  notes               String?

  @@index([eventId, checkedInAt])
  @@index([eventId, guestId])
}

model EventEmailLog {
  id             String   @id @default(cuid())
  organizationId String
  eventId        String
  tableId        String?
  guestId        String?
  inviteId       String?
  type           String
  recipientEmail String
  status         String   @default("QUEUED")
  providerId     String?
  errorMessage   String?
  sentAt         DateTime?
  createdAt      DateTime @default(now())

  @@index([eventId, type, status])
}
```

Also extend `EventTable`:

```prisma
tableUid    String? @unique
publicCode  String?
hostEmail   String?
hostPhone   String?
status      String  @default("OPEN")
lockedAt    DateTime?
```

Do not expose raw internal table IDs publicly.

---

## 6.2 Page JSON schema

```ts
type EventPageJson = {
  version: 1;
  theme: {
    primaryColor?: string;
    accentColor?: string;
    fontMode?: "system" | "serif" | "modern";
    cornerRadius?: "soft" | "rounded" | "square";
  };
  layout: {
    maxWidth?: "narrow" | "standard" | "wide";
    spacing?: "compact" | "comfortable" | "spacious";
  };
  sections: EventPageSectionInstance[];
  registrationFlow?: RegistrationFlowConfig;
};

type EventPageSectionInstance = {
  id: string;
  type: string;
  label: string;
  enabled: boolean;
  lockToEventData: boolean;
  sortOrder: number;
  settings: Record<string, unknown>;
  contentOverrides?: Record<string, unknown>;
  visibilityRules?: VisibilityRule[];
};
```

---

## 6.3 Registration flow schema

```ts
type RegistrationFlowConfig = {
  id: string;
  mode: "ticket" | "table" | "sponsor" | "rsvp" | "mixed";
  paymentRequired: boolean;
  allowPartialGuestInfo: boolean;
  allowGuestSelfEntry: boolean;
  createTableLinkOnPurchase: boolean;
  sendConfirmationEmail: boolean;
  generateQrCodes: boolean;
  steps: RegistrationStepConfig[];
};

type RegistrationStepConfig = {
  id: string;
  type:
    | "choose_registration_type"
    | "select_tickets"
    | "select_table"
    | "select_sponsor_package"
    | "purchaser_info"
    | "guest_info"
    | "meal_choices"
    | "custom_questions"
    | "donation_addon"
    | "payment"
    | "confirmation";
  title: string;
  settings: Record<string, unknown>;
};
```

---

## 7. UI Redesign Plan

## 7.1 Builder top bar

Replace the current top controls with a cleaner enterprise command bar:

```txt
[Back to Event]  Public Experience / Page Builder
Page: Main Landing v
Status: Draft Saved  Last saved: 2:41 PM
[Desktop] [Tablet] [Mobile]
[Preview] [Publish]
```

Remove duplicate Preview/Publish actions from multiple places. Keep one primary command area.

### Buttons

```txt
Save Draft
Preview
Publish
Copy Public URL
Open Live Page
```

Rules:

- `Preview` opens in-app modal/drawer.
- `Open Live Page` appears only when published.
- `Publish` runs backend validation first.
- `Copy Public URL` copies the published URL or draft preview link depending on mode.

---

## 7.2 Remove new-tab mode

Replace:

```ts
window.open(draftPreviewUrl, "_blank", "noopener,noreferrer")
```

With state:

```ts
const [previewMode, setPreviewMode] = useState<"inline" | "fullscreen" | null>(null);
```

Preview UX:

```txt
Click Preview
  -> opens full-screen in-app preview
  -> uses EventPageRenderer with draftJson
  -> top preview bar: Desktop | Tablet | Mobile | Close Preview
```

Optional secondary action:

```txt
Open Published Page
```

This should use a normal link only if status is `PUBLISHED`.

---

## 7.3 Left panel redesign

Current:

```txt
Page Sections list with arrow controls
```

New:

```txt
Left Panel
  Outline
  Sections
  Blocks
  Data
```

### Outline

Shows the current page structure:

```txt
Hero
Event Details
Ticket Registration
Table Purchase
Donation Add-on
FAQ
Footer
```

Actions per section:

```txt
Select
Drag
Hide/show
Duplicate
Delete
Move up/down fallback
```

### Sections

Prebuilt event sections:

```txt
Fundraising Hero
Mission Story
Event Details
Ticket Registration
Table Purchase
Sponsor Packages
Donation Goal
Guest FAQ
Location / Map
Sponsor Wall
Footer
```

### Blocks

Smaller elements:

```txt
Text
Image
Button
Countdown
Ticket Selector
Guest Form
Meal Choice
Donation Amount
Stripe Summary
TableLink Login
QR Code
Confirmation Summary
```

### Data

Event data bindings:

```txt
event.name
event.startDate
event.location
ticketTypes
sponsors
report.revenue.total
tables
guest fields
merge fields
```

---

## 7.4 Center canvas redesign

The center preview should feel like a real public page canvas.

Add:

```txt
Canvas width toggle
Section hover controls
Inline add-section button
Selected section border
Empty state per missing data
Mobile preview frame
```

For selected sections:

```txt
[Move] [Duplicate] [Hide] [Delete] [Settings]
```

The preview should always be generated from `draftJson`, never from separate hardcoded JSX.

---

## 7.5 Right inspector redesign

Tabs:

```txt
Content
Data
Design
Behavior
Advanced
```

### Content tab

Copy, headings, labels, button text, helper text.

### Data tab

Source of truth toggles:

```txt
Use event name
Use custom headline
Use event ticket types
Show only selected ticket types
```

### Design tab

Spacing, background, layout, alignment, cards, image placement.

### Behavior tab

For interactive blocks:

```txt
Required?
Payment required?
Allow partial guest entry?
Create TableLink?
Send confirmation email?
Generate QR?
```

### Advanced tab

Conditional visibility, CSS class/token, analytics name, accessibility label.

---

## 7.6 Publish checklist panel

Add a right/bottom panel before publishing:

```txt
Publish Readiness
  ✓ Event date set
  ✓ Location set
  ✓ At least one ticket/table/sponsor option configured
  ✓ Stripe configured if paid registration enabled
  ✓ Confirmation email enabled
  ✓ Public URL is unique
  ✓ Registration flow tested
  ✓ Mobile preview checked
```

Block publish if critical items fail.

---

## 8. Backend/API Build Plan

## 8.1 Replace pluginSetting-only page storage

Current slug/status config in `pluginSetting` can remain temporarily, but final page data should move to dedicated tables.

Add routes:

```txt
GET    /api/events/:eventId/pages
POST   /api/events/:eventId/pages
GET    /api/events/:eventId/pages/:pageId
PATCH  /api/events/:eventId/pages/:pageId
POST   /api/events/:eventId/pages/:pageId/publish
POST   /api/events/:eventId/pages/:pageId/duplicate
GET    /api/events/:eventId/pages/:pageId/versions
POST   /api/events/:eventId/pages/:pageId/restore-version
```

Public:

```txt
GET /api/public/events/pages/:slug
GET /api/public/events/:eventSlug/register/config
```

---

## 8.2 Registration API

```txt
POST   /api/public/events/:eventSlug/registration/start
PATCH  /api/public/events/:eventSlug/registration/:registrationId
POST   /api/public/events/:eventSlug/registration/:registrationId/guests
POST   /api/public/events/:eventSlug/registration/:registrationId/checkout
GET    /api/public/events/:eventSlug/registration/:registrationId/status
```

Rules:

- Validate every public action on the backend.
- Never trust frontend quantity/capacity calculations.
- Use Stripe webhooks as payment truth.
- Do not create confirmed guests until order/payment rules are satisfied.
- Allow draft registrations to expire.

---

## 8.3 TableLink API

```txt
POST   /api/public/events/:eventSlug/tablelink/request-access
POST   /api/public/events/:eventSlug/tablelink/verify-token
GET    /api/public/events/:eventSlug/tablelink/:tableUid
POST   /api/public/events/:eventSlug/tablelink/:tableUid/invite-guest
PATCH  /api/public/events/:eventSlug/tablelink/:tableUid/guests/:guestId
POST   /api/public/events/:eventSlug/invites/:token/complete
```

Security:

```txt
TableKey identifies table.
Magic token grants access.
Token hash is stored, raw token is never stored.
Token expires.
Access request is rate-limited.
Host email must match table host or authorized invite.
```

---

## 8.4 Check-In Studio API

```txt
GET    /api/events/:eventId/checkin/search
POST   /api/events/:eventId/checkin/verify-token
POST   /api/events/:eventId/checkin/guest/:guestId
POST   /api/events/:eventId/checkin/table/:tableId/bulk
POST   /api/events/:eventId/checkin/walk-in
POST   /api/events/:eventId/checkin/replacement
POST   /api/events/:eventId/checkin/exceptions
POST   /api/events/:eventId/checkin/:recordId/reverse
```

Check-in must create records, not just flip a checkbox.

---

## 9. Registration Interaction Requirements

## 9.1 Individual ticket flow

```txt
Select individual ticket
Enter purchaser info
Enter attendee info
Optional donation
Stripe checkout
Webhook confirms payment
Create EventOrder
Create EventGuest records
Generate QR tokens
Send confirmation email
Show confirmation page
```

## 9.2 Table purchase flow

```txt
Select table package
Enter purchaser/host info
Choose whether to enter guests now
Allow known guests now
Allow unknown guests later
Stripe checkout
Webhook confirms payment
Create EventOrder
Create EventTable if needed
Create EventTableSeat records
Assign table host
Generate TableKey/publicCode
Send TableLink access email
Show confirmation page
```

## 9.3 Guest self-entry flow

```txt
Host sends invite
Guest opens secure token link
Guest fills out name/email/phone/meal/custom questions
Backend attaches guest to seat
Invite status becomes completed
Guest receives confirmation email / QR code
Host roster updates
```

## 9.4 Sponsor flow

```txt
Select sponsor package
Enter sponsor contact
Upload logo if required
Select included table/guests if package includes table
Stripe checkout or invoice mode
Create EventSponsor
Create EventOrder
Create EventTable/seats if included
Send sponsor confirmation
Add fulfillment checklist
```

---

## 10. Public Renderer Requirements

Create shared renderer:

```txt
app/components/events/public/EventPageRenderer.tsx
```

Inputs:

```ts
type EventPageRendererProps = {
  mode: "builder-preview" | "public" | "confirmation";
  pageJson: EventPageJson;
  eventData: EventPagePublicData;
  registrationContext?: RegistrationContext;
};
```

Renderers:

```txt
HeroSectionRenderer
EventDetailsRenderer
TicketSelectorRenderer
TablePurchaseRenderer
SponsorPackageRenderer
DonationAddOnRenderer
GuestFormRenderer
TableLinkLoginRenderer
ConfirmationRenderer
QrCodeRenderer
FaqRenderer
MapRenderer
FooterRenderer
```

This renderer should replace duplicated hardcoded builder preview/public page JSX.

---

## 11. Migration Plan

## Phase 1: Stabilize current builder

Tasks:

- Remove new-tab preview mode.
- Add in-app preview modal/drawer.
- Persist section order/enabled state to backend.
- Add save draft button.
- Make publish call backend PATCH or new publish endpoint.
- Update status after backend response only.
- Remove duplicate Preview/Publish buttons from ribbon/top bar.

Acceptance criteria:

```txt
Refreshing page preserves section order and hidden sections.
Publish persists after refresh.
Preview stays inside builder.
UI has only one primary preview/publish command area.
```

---

## Phase 2: Add EventPage tables

Tasks:

- Add `EventPage` and `EventPageVersion` Prisma models.
- Migrate existing plugin setting slug/status into `EventPage`.
- Keep compatibility route temporarily.
- Add page list/dropdown in builder.
- Store `draftJson` and `publishedJson`.

Acceptance criteria:

```txt
Builder loads EventPage.draftJson.
Public page loads EventPage.publishedJson.
Publishing creates EventPageVersion.
Draft changes do not affect public page.
```

---

## Phase 3: Shared renderer

Tasks:

- Create `EventPageRenderer`.
- Convert builder preview to renderer.
- Convert public page to renderer.
- Move section render logic out of `EventPageBuilderPreview`.
- Support same section JSON in both places.

Acceptance criteria:

```txt
Builder preview and public page share one renderer.
Hidden sections stay hidden publicly.
Section order matches builder.
Draft preview differs safely from published page.
```

---

## Phase 4: Registration flow builder

Tasks:

- Add registration-flow tab/panel.
- Add flow steps.
- Add field mapping.
- Add partial guest entry option.
- Add TableLink creation option.
- Add confirmation email option.
- Add QR generation option.

Acceptance criteria:

```txt
Admin can configure ticket/table/sponsor/RSVP flow.
Admin can choose whether guest info is required at checkout.
Flow config persists inside page JSON or EventRegistrationFlow table.
```

---

## Phase 5: Public registration backend

Tasks:

- Add EventRegistration model.
- Add draft registration endpoint.
- Add order creation.
- Add guest creation.
- Add capacity validation.
- Add Stripe checkout and webhook handling.
- Add confirmation page/status route.

Acceptance criteria:

```txt
Public user can register.
Backend creates real EventOrder/EventGuest records.
Stripe webhook confirms payment.
Confirmation page shows real registration.
Failed payment does not confirm guests.
```

---

## Phase 6: TableLink integration

Tasks:

- Extend EventTable with stable UID/publicCode.
- Add EventTableSeat model.
- Add EventGuestInvite model.
- Add host access tokens.
- Add magic-link email.
- Add guest self-entry route.

Acceptance criteria:

```txt
Table purchase creates table and seats.
Host receives TableLink access.
Host can invite guests later.
Guest can self-complete info.
Table roster updates without full CRM login.
```

---

## Phase 7: Check-In Studio redesign

Tasks:

- Add EventCheckInRecord.
- Add QR token verification.
- Add search check-in.
- Add table roster check-in.
- Add walk-in/replacement mode.
- Add exception queue.

Acceptance criteria:

```txt
QR scan previews guest before check-in.
Checking in creates audit record.
Duplicates are detected.
Wrong guest can be reversed.
Table mode supports fast gala check-in.
```

---

## Phase 8: Tests and documentation

Tasks:

- Add smoke tests for builder page load.
- Add E2E tests for save draft/publish.
- Add E2E tests for public page render.
- Add E2E tests for ticket registration.
- Add E2E tests for table purchase with partial guest info.
- Add E2E tests for guest self-entry.
- Add E2E tests for check-in.
- Update `docs/status/events-crm-status.md`.
- Update `AGENTS.md` with this new builder architecture.

Acceptance criteria:

```txt
Tests prove the public event flow works end-to-end.
Docs clearly mark what is working, partial, UI-only, and not implemented.
AGENTS.md tells future agents where the source-of-truth builder files live.
```

---

## 12. UI Fix Checklist

### Immediate UI fixes

```txt
[ ] Remove new-tab preview as primary action.
[ ] Add in-app fullscreen preview.
[ ] Remove duplicate Preview/Publish buttons.
[ ] Add Save Draft button.
[ ] Add status pill: Unsaved / Saved / Published / Needs Review.
[ ] Add device preview toggle.
[ ] Add page dropdown.
[ ] Add public URL copy control.
[ ] Make left rail tabbed: Outline / Sections / Blocks / Data.
[ ] Add drag/drop section ordering.
[ ] Add section duplicate/delete controls.
[ ] Expand inspector with Content / Data / Design / Behavior / Advanced tabs.
[ ] Add publish checklist.
[ ] Replace purple-heavy styling with calmer enterprise Event Studio styling.
```

### Public page UI fixes

```txt
[ ] Stop rendering draft pages anonymously.
[ ] Use shared renderer.
[ ] Add registration CTA connected to backend.
[ ] Add TableLink portal entry.
[ ] Add confirmation page.
[ ] Add mobile-first public layout.
[ ] Add proper SEO metadata.
[ ] Add branded footer and contact/help block.
```

---

## 13. Backend Fix Checklist

```txt
[ ] Add EventPage model.
[ ] Add EventPageVersion model.
[ ] Add EventRegistration model.
[ ] Add EventTableSeat model.
[ ] Add EventGuestInvite model.
[ ] Add EventCheckInRecord model.
[ ] Add EventEmailLog model.
[ ] Extend EventTable with tableUid/publicCode/hostEmail/status.
[ ] Add backend publish endpoint.
[ ] Add public published-page endpoint.
[ ] Add authenticated draft-preview endpoint.
[ ] Add registration start/update/checkout endpoints.
[ ] Add Stripe webhook registration finalization.
[ ] Add TableLink access endpoints.
[ ] Add guest invite completion endpoints.
[ ] Add QR token generation/verification.
[ ] Add auditable check-in endpoints.
```

---

## 14. Recommended Agent Prompt

```txt
Audit and rebuild the OyamaCRM Event Studio Page Builder into a backend-backed Public Experience Builder. Start by inspecting the current files under app/components/events/page-builder, app/components/events/public, app/events/page-builder, app/events/[eventId]/event-page, app/[publicEventSlug]/page.tsx, server/src/routes/events.ts, and prisma/schema.prisma. Preserve the current event-scoped workflow, but remove the current new-tab preview behavior that uses window.open and replace it with an in-app preview drawer/fullscreen preview using the same shared renderer as the public page.

Refactor the builder so it no longer stores section order and enabled state only in React memory. Add persistent EventPage and EventPageVersion models with draftJson and publishedJson. Move away from pluginSetting-only storage except as a temporary compatibility layer for existing page slug/status records. Create a shared EventPageRenderer component used by both the builder preview and the public public-event route so the public page exactly matches the saved published JSON. Anonymous public visitors should only see published pages. Draft preview should require CRM auth or a signed preview token.

Redesign the builder UI into an enterprise-grade Event Studio tool: top command bar with Save Draft, Preview, Publish, device preview, page dropdown, status, and copy URL; left panel tabs for Outline, Sections, Blocks, and Data; center canvas with live page preview and inline section controls; right inspector with Content, Data, Design, Behavior, and Advanced tabs. Add a publish checklist that blocks publishing when event date, location, ticket options, payment settings, confirmation email, or registration flow configuration are missing.

Build full registration interaction into the page builder. Add a Registration Flow Builder that supports individual ticket registration, table purchase, sponsor package registration, RSVP-only registration, donation add-ons, partial guest entry, guest self-entry, confirmation emails, Stripe checkout, and QR code generation. Add backend endpoints for public registration start/update/checkout/status, Stripe webhook confirmation, table creation, TableLink access, guest invitation completion, and confirmation page rendering.

Extend the Events CRM backend for TableLink and check-in. Add tableUid/publicCode to EventTable, create EventTableSeat, EventGuestInvite, EventCheckInRecord, and EventEmailLog models, and update EventGuest check-in so check-in is auditable instead of only a boolean. Check-In Studio must support QR preview-before-check-in, name search, table search, table roster check-in, walk-ins, replacement guests, duplicate detection, reversal, and an exception queue. Update docs/status/events-crm-status.md and AGENTS.md with what is Working, Partial, UI-Only, Not Implemented, and the exact next implementation tasks.
```

---

## 15. Final Direction

The current builder should not be thrown away. It should be promoted from a partial preview shell into a real Events CRM public-experience engine.

Keep:

```txt
Event-scoped workflow
Left/center/right builder layout
Source-of-truth event data loading
Clean public slug idea
Current section catalog as the initial template
```

Replace or rebuild:

```txt
Local-only section state
Local-only publish toggle
New-tab preview mode
Hardcoded public page renderer
PluginSetting-only page storage
Simple checkedIn boolean as check-in source of truth
```

Build next:

```txt
Persistent EventPage draft/published JSON
Shared renderer
Registration flow builder
Stripe-backed checkout
TableLink guest self-entry
Auditable Check-In Studio
Publish checklist
E2E tests
```
