# OyamaEmail Workspace — Full Implementation Plan

**Project:** OyamaCRM  
**New tool:** OyamaEmail  
**Purpose:** Create a dedicated email communications workspace that mirrors the successful OyamaLetters pattern while removing old duplicate email-builder paths, fake UI, and unclear communication workflows.

---

## 1. Executive Summary

OyamaEmail should become its own full workspace, not just another tab inside the current Communications page.

The current `/communications` area already contains useful pieces: email campaigns, drafts, templates, segments, send queue, communication log, and settings. The problem is that all of those things are crowded into one general-purpose communications hub, while the actual builder is still tied to an older `EmailBuilderApp` flow. OyamaLetters has already shown the better direction: give the tool its own dedicated workspace, its own sidebar, its own templates, its own publish workflow, its own generation/send wizard, and its own queue/results area.

The new structure should be:

```txt
OyamaLetters = print / PDF / mail studio
OyamaEmail   = email / newsletter / send studio
Communications = high-level engagement dashboard that watches both
```

This plan is written for Copilot/agents to implement carefully. The goal is **not** to create another pretty mockup with fake cards. The goal is a real, API-backed, working workspace using live CRM data, live templates, real send validation, real recipient eligibility, real unsubscribe/suppression rules, real send logs, and real analytics.

---

## 2. Visual Direction From the Five Generated Mockups

Use the five generated images as the visual reference for the new workspace. The workspace should feel like a polished, dedicated product inside OyamaCRM.

Reference files generated in this session:

```txt
Image 1 — Template Library
/mnt/data/a_high_resolution_screenshot_of_a_web_application.png

Image 2 — Email Builder
/mnt/data/a_wide_clean_high_res_screenshot_ui_mockup_of.png

Image 3 — Publish & Compliance
/mnt/data/a_clean_saas_web_app_ui_screenshot_desktop_with.png

Image 4 — Send Email Wizard / Audience Step
/mnt/data/a_clean_user_interface_screenshot_of_an_email_camp.png

Image 5 — Review & Validate Step
/mnt/data/a_clean_web_app_dashboard_screenshot_full_screen.png
```

### Required visual rules

The sidebar must be **email-only**, not the full CRM sidebar. It should include:

```txt
Templates
Send Email
Campaigns
Audience
Queue
Analytics
Settings
Help Center
Back to CRM
```

The bottom of the sidebar must include a clear **Back to CRM** button. This is important because OyamaEmail is a dedicated workspace, but users must always be able to return to the broader CRM.

The color system should match the images:

```txt
Primary sidebar: deep forest green / emerald gradient
Main background: soft white / very light slate
Cards: white with subtle border and soft shadow
Primary actions: dark green filled buttons
Secondary actions: white buttons with slate border
Status success: green pills/checks
Warning: amber/orange
Danger: red
Info: light blue
```

The layout should avoid crowded dashboard clutter. Each workspace page should have one clear purpose.

---

## 3. Single Organized User Workflow

The user should experience one clear path:

```txt
1. Choose or create an email template
2. Build the email
3. Publish and pass compliance
4. Select audience
5. Configure send details
6. Review and validate
7. Send now, schedule, or save draft
8. View results and analytics
```

### Workspace Step 1: Template Library

Route:

```txt
/oyama-email
/oyama-email/templates
```

User goal: choose a template or create a blank email.

The library should show real saved templates, not demo data.

Template cards should show:

```txt
Template name
Category
Status: Draft / Published / Archived
Last updated
Created by / last edited by
Used count
Merge field count
Compliance status
Mobile-ready status
Preview thumbnail if available
```

Template categories:

```txt
All Templates
Newsletter
Thank You
Appeals
Events
Receipts / Acknowledgments
Monthly Donor
Lapsed Donor
Steward Path
Blank Email
```

Actions per template:

```txt
Use Template
Edit
Duplicate
Rename
Publish
Archive
Delete
View usage
```

Primary CTA:

```txt
+ New Email Template
```

No fake template cards should remain. If no templates exist, show a real empty state with:

```txt
Create Blank Email
Import Existing Campaign as Template
Seed Starter Templates
```

Starter templates may be seeded from actual code/data, but they must be real persisted records once shown.

---

### Workspace Step 2: Email Builder

Route:

```txt
/oyama-email/templates/[templateId]/builder
```

User goal: build the email content.

The builder should follow Image 2:

```txt
Left panel: content blocks and merge fields
Center: email canvas
Right panel: email settings
Top: Save Draft, Send Test Email, Next: Publish & Compliance
```

Required builder sections:

Left panel:

```txt
Add Content
- Text
- Image
- Button
- Divider
- Spacer
- Columns
- Social Links
- Video
- Donation Button
- Event Button
- HTML Block

Merge Fields
- Donor Fields
- Gift Fields
- Organization Fields
- Event Fields
- Steward Path Fields
- Other Fields
```

Center canvas:

```txt
Desktop preview
Mobile preview
Editable email blocks
Drag / move / duplicate / delete controls
Logo / header
Hero block
Body copy
CTA button
Signature block
Footer / compliance block
```

Right inspector:

```txt
Subject Line
Preview Text
From Name
From Email
Reply-To Email
Preference Category
Background Color
Branding & Footer
Add Unsubscribe Link toggle
Add Physical Address toggle
Enable Plain Text Version toggle
```

Critical requirement: the builder must save real data to the API. It cannot just manipulate local UI state.

---

### Workspace Step 3: Publish & Compliance

Route:

```txt
/oyama-email/templates/[templateId]/publish
```

User goal: confirm the template is safe and ready to use.

Publish should be a required gate before production sending, just like OyamaLetters should require published/active templates for generation.

Compliance checks must include:

```txt
Subject line exists
Subject line is not deceptive
Preview text exists
From name exists
From email exists
Reply-to email exists
Sending domain appears valid
Preference category selected
Unsubscribe link present where required
One-click unsubscribe header support ready for marketing/subscribed mail
Physical address present where required
Plain-text version generated
Merge fields valid
Fallback rules configured for required merge fields
Mobile preview checked
Test email sent successfully or acknowledged as not yet sent
Suppression checks available
No fake recipient data in preview
```

The screen should match Image 3:

```txt
Left: Compliance Checklist
Middle: Email Preview
Right: Publish Summary and Before You Publish list
```

Publish result should create a real snapshot/history record:

```txt
Template ID
Template version
Published by
Published at
Previous status
Next status
Compliance warnings
Compliance blockers
HTML snapshot
Plain-text snapshot
Merge fields used
Branding/footer snapshot
```

If the template fails blockers, the Publish button must be disabled and the user must see actionable fixes.

---

### Workspace Step 4: Send Email Wizard — Audience

Route:

```txt
/oyama-email/send
/oyama-email/send?templateId=...
```

User goal: select recipients.

The wizard should follow Image 4:

```txt
1 Template
2 Audience
3 Details
4 Review
5 Send
```

Audience sources:

```txt
Individual recipients
Saved search / list
Segments / tags
Campaign donors
Event attendees
Monthly donors
Lapsed donors
Steward Path enrollment
Manual pasted emails
Imported CSV, later phase
```

Audience summary must show:

```txt
Total selected
Valid emails
Missing email
Unsubscribed
Do not email
Suppressed
Duplicates removed
Hard bounced
Invalid format
```

This must use real CRM data and the real suppression/subscription system.

Do not show counts from fake arrays. If an API is missing, implement the API first.

---

### Workspace Step 5: Send Email Wizard — Details

User goal: configure send details.

Fields:

```txt
Campaign name
Subject line
Preview text
From name
From email
Reply-to email
Preference category
Purpose: marketing / transactional / stewardship / event / receipt
Send mode: send now / schedule / save draft / require approval
Schedule date/time
Timezone
Internal notes
Owner/reviewer
```

Validation:

```txt
If marketing/subscribed email, enforce unsubscribe and physical address.
If transactional/relationship email, still require truthful sender/header data.
If schedule time is in the past, block.
If SMTP settings are missing, block.
If sending domain is unauthenticated or unverified, warn/block based on policy.
```

---

### Workspace Step 6: Review & Validate

This is Image 5.

User goal: final confirmation before sending.

Layout:

```txt
Left: Email preview
Middle: Validation summary and recipient validation
Right: Email & Send Settings and send options
```

Validation summary must show:

```txt
Total selected
Valid email recipients
Missing email
Unsubscribed
Do not email
Suppressed
Hard bounced
Duplicates removed
Missing merge data
```

Send options:

```txt
Send now
Schedule send
Save as draft campaign
Require approval
```

One primary action:

```txt
Next: Confirm & Send
```

or, when on the final step:

```txt
Send Now
Schedule Campaign
Save Draft
Create Approval Task
```

---

### Workspace Step 7: Campaign Results & Analytics

Route:

```txt
/oyama-email/campaigns/[campaignId]
/oyama-email/analytics
```

User goal: see what happened after sending.

Analytics should show:

```txt
Recipients
Queued
Sent
Delivered
Opened
Clicked
Bounced
Unsubscribed
Failed
Suppressed
Spam complaints, if available
```

Tabs:

```txt
Overview
Recipients
Activity Feed
Links
Bounces
Unsubscribes
Devices
Geo Activity
```

The existing email-campaign delivery-event backend should be preserved and surfaced here.

---

## 4. Repo Research Findings

### Current Communications UI

The existing `/communications/page.tsx` is a broad donor email outreach hub. It contains tabs for overview, email campaigns, email drafts, templates, segments, send queue, communication log, and settings. That confirms Communications is acting as too many things at once.

Relevant current files:

```txt
app/communications/page.tsx
app/components/communications/CampaignWorkspace.tsx
app/components/email-builder/EmailBuilderApp.tsx
app/components/communications/EmailProjectLibrary.tsx
app/components/communications/NewCampaignModal.tsx
app/components/communications/CommunicationsSegmentsPanel.tsx
app/components/communications/CommunicationsSettingsPanel.tsx
app/components/communications/CommunicationsTemplatesPanel.tsx
server/src/routes/email-campaigns.ts
```

### Current Campaign Workspace

`CampaignWorkspace.tsx` has modes:

```txt
overview
build
send
activity
```

The current build mode embeds `EmailBuilderApp`. This should become legacy. The new builder should live inside OyamaEmail.

### Current Email API

`server/src/routes/email-campaigns.ts` already handles important lifecycle concerns:

```txt
Campaign list/detail
Stats
Create draft/scheduled campaign
Update campaign
Send campaign
Delete campaign
Delivery webhooks
SMTP-backed sending
Delivery/open/click/bounce metrics
Compliance/suppression utilities
```

This backend should **not** be deleted. It should be reorganized and wrapped by the new OyamaEmail API surface.

### Existing compliance/deliverability considerations

The current email backend imports services such as:

```txt
email-compliance.js
smtp-service.js
```

This is useful and should become the lower-level engine behind OyamaEmail.

---

## 5. External Compliance / Deliverability Research

OyamaEmail should include compliance checks because email is not just design; it is delivery, consent, suppression, and sender reputation.

### CAN-SPAM considerations

The FTC explains that CAN-SPAM covers commercial email, requires accurate header information, non-deceptive subject lines, a valid physical postal address, a clear opt-out mechanism, honoring opt-outs within 10 business days, and monitoring vendors/third parties acting on your behalf.

Official source:

```txt
https://www.ftc.gov/business-guidance/resources/can-spam-act-compliance-guide-business
```

### Gmail sender requirements

Google’s sender guidelines require all senders to use SPF or DKIM for Gmail-bound mail, use TLS, keep spam rates below 0.3%, avoid Gmail From header impersonation, and follow message-format standards. Bulk senders must also use SPF, DKIM, and DMARC, and marketing/subscribed messages must support one-click unsubscribe and include a visible unsubscribe link.

Official source:

```txt
https://support.google.com/a/answer/81126?hl=en
```

### Yahoo sender requirements

Yahoo’s sender requirements similarly call for SPF or DKIM for all senders, low spam complaint rates, valid forward and reverse DNS, and RFC-compliant mail. Bulk senders are expected to implement SPF, DKIM, DMARC, easy unsubscribe/list-unsubscribe support, visible unsubscribe links, and to honor unsubscribes quickly.

Official source:

```txt
https://senders.yahooinc.com/best-practices/
```

### Implementation impact

The new OyamaEmail publish/send workflow should include checks for:

```txt
SPF/DKIM/DMARC configuration status, if detectable
From-domain alignment
Unsubscribe link
List-Unsubscribe headers
List-Unsubscribe-Post header support
Physical address
Preference category
Suppression checks
Bounce suppression
Spam complaint rate tracking, if provider data exists
Plain text version
Message-ID generation
No deceptive subject/from display
```

Some domain-authentication checks may be manual at first. If DNS lookup tooling is not implemented yet, show a real setting/status record, not fake pass/fail badges.

---

## 6. Recommended Repo Setup

### New frontend structure

Create a dedicated workspace parallel to OyamaLetters:

```txt
app/oyama-email/page.tsx
app/oyama-email/templates/page.tsx
app/oyama-email/templates/new/page.tsx
app/oyama-email/templates/[templateId]/builder/page.tsx
app/oyama-email/templates/[templateId]/publish/page.tsx
app/oyama-email/send/page.tsx
app/oyama-email/campaigns/page.tsx
app/oyama-email/campaigns/[campaignId]/page.tsx
app/oyama-email/queue/page.tsx
app/oyama-email/analytics/page.tsx
app/oyama-email/settings/page.tsx
```

Create components:

```txt
app/components/oyama-email/OyamaEmailWorkspace.tsx
app/components/oyama-email/OyamaEmailSidebar.tsx
app/components/oyama-email/OyamaEmailTopBar.tsx
app/components/oyama-email/EmailTemplateLibrary.tsx
app/components/oyama-email/EmailTemplateCard.tsx
app/components/oyama-email/EmailBuilderWorkspace.tsx
app/components/oyama-email/EmailCanvas.tsx
app/components/oyama-email/EmailBlockPalette.tsx
app/components/oyama-email/EmailInspector.tsx
app/components/oyama-email/EmailComplianceWorkspace.tsx
app/components/oyama-email/EmailSendWizard.tsx
app/components/oyama-email/EmailAudienceSelector.tsx
app/components/oyama-email/EmailReviewValidate.tsx
app/components/oyama-email/EmailCampaignResults.tsx
app/components/oyama-email/EmailAnalyticsDashboard.tsx
app/components/oyama-email/EmailSettingsWorkspace.tsx
app/components/oyama-email/types.ts
```

### Shared components to extract

Extract shared pieces so OyamaLetters and OyamaEmail feel consistent:

```txt
app/components/workspace/WorkspaceSidebarShell.tsx
app/components/workspace/WorkspaceTopBar.tsx
app/components/workspace/WorkspaceStepper.tsx
app/components/workspace/WorkspaceStatusPill.tsx
app/components/workspace/WorkspaceCard.tsx
app/components/workspace/AudienceSelector.tsx
app/components/workspace/MergeFieldPicker.tsx
app/components/workspace/ComplianceChecklist.tsx
```

Do not over-abstract too early. Extract only pieces used by both tools.

---

## 7. API / Backend Reorganization

### Should OyamaEmail get its own API?

Yes.

Do **not** delete `server/src/routes/email-campaigns.ts` immediately. It is currently the delivery and campaign engine. But create a dedicated API namespace for OyamaEmail so the UI does not have to talk directly to old, broad campaign endpoints forever.

New API routes:

```txt
/api/oyama-email/templates
/api/oyama-email/templates/:id
/api/oyama-email/templates/:id/publish
/api/oyama-email/templates/:id/publish-history
/api/oyama-email/templates/:id/preview
/api/oyama-email/templates/:id/send-test

/api/oyama-email/audience/resolve
/api/oyama-email/audience/validate

/api/oyama-email/send/validate
/api/oyama-email/send/create-draft
/api/oyama-email/send/schedule
/api/oyama-email/send/send-now

/api/oyama-email/campaigns
/api/oyama-email/campaigns/:id
/api/oyama-email/campaigns/:id/results
/api/oyama-email/campaigns/:id/recipients
/api/oyama-email/campaigns/:id/events

/api/oyama-email/settings
/api/oyama-email/domain-status
```

### Backend file organization

Create:

```txt
server/src/routes/oyama-email.ts

server/src/services/oyama-email/email-template-service.ts
server/src/services/oyama-email/email-render-service.ts
server/src/services/oyama-email/email-publish-service.ts
server/src/services/oyama-email/email-audience-service.ts
server/src/services/oyama-email/email-recipient-validation-service.ts
server/src/services/oyama-email/email-send-orchestration-service.ts
server/src/services/oyama-email/email-domain-status-service.ts
server/src/services/oyama-email/email-analytics-service.ts
```

Keep existing lower-level services:

```txt
server/src/routes/email-campaigns.ts
server/src/services/email-compliance.ts
server/src/services/smtp-service.ts
```

But refactor them so `oyama-email` calls into shared services instead of duplicating logic.

### Route mounting

In the server route registration file, mount:

```ts
app.use("/api/oyama-email", oyamaEmailRoutes);
```

Keep:

```ts
app.use("/api/email-campaigns", emailCampaignRoutes);
```

But begin treating `/api/email-campaigns` as a lower-level legacy-compatible API.

### Monorepo-like module boundary

This does not need to become a separate package on day one, but it should be organized like a module with a clean boundary:

```txt
Frontend feature module:
app/components/oyama-email
app/oyama-email

Backend feature module:
server/src/routes/oyama-email.ts
server/src/services/oyama-email/*

Shared contracts:
app/components/oyama-email/types.ts
server/src/services/oyama-email/types.ts
```

Later, if the repo moves toward a stronger monorepo, this can become:

```txt
packages/email-core
packages/ui-workspace
apps/web
apps/api
```

Do not jump to packages yet unless the current repo already supports it. Start with a clean internal module boundary.

---

## 8. Data Model Plan

The current `EmailCampaign` model is campaign-run oriented. It contains campaign body fields and `templateJson`, but a dedicated template library needs first-class template records.

Add or confirm these models:

```prisma
model EmailTemplate {
  id                 String   @id @default(cuid())
  organizationId     String
  name               String
  category           EmailTemplateCategory @default(GENERAL)
  status             EmailTemplateStatus @default(DRAFT)
  description        String?  @db.Text

  subject            String?
  previewText        String?
  fromName           String?
  fromEmail          String?
  replyToEmail       String?
  preferenceCategory EmailCategory?
  purpose            EmailPurpose @default(MARKETING)

  bodyHtml           String?  @db.LongText
  bodyText           String?  @db.LongText
  templateJson       Json?
  builderVersion     String   @default("oyama-email-v1")

  brandingJson       Json?
  mergeFieldsUsed    Json?
  complianceJson     Json?

  createdByUserId    String
  updatedByUserId    String?
  publishedAt        DateTime?
  archivedAt         DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  versions           EmailTemplateVersion[]
  campaigns          EmailCampaign[]

  @@index([organizationId, status])
  @@index([organizationId, category])
  @@index([organizationId, updatedAt])
}

model EmailTemplateVersion {
  id             String   @id @default(cuid())
  organizationId String
  templateId     String
  versionNumber  Int
  status         String
  snapshotJson   Json
  publishedById  String?
  publishedAt    DateTime?
  createdAt      DateTime @default(now())

  template       EmailTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@unique([templateId, versionNumber])
  @@index([organizationId, templateId])
}

model EmailCampaign {
  // Keep existing fields.
  // Add:
  emailTemplateId String?
  templateVersionId String?
}
```

Enums:

```prisma
enum EmailTemplateStatus {
  DRAFT
  PUBLISHED
  ARCHIVED
}

enum EmailTemplateCategory {
  NEWSLETTER
  THANK_YOU
  APPEAL
  EVENT
  RECEIPT
  MONTHLY_DONOR
  LAPSED_DONOR
  STEWARD_PATH
  GENERAL
}
```

If the current Prisma schema already has similar models, reuse them instead of duplicating.

---

## 9. Migration Strategy

### Phase 1 — Introduce OyamaEmail without deleting old code

1. Create `/oyama-email` routes.
2. Build the dedicated workspace shell.
3. Wire Template Library to real API.
4. Keep `/communications` working.
5. Add cross-links:
   - Communications → Open OyamaEmail
   - CampaignWorkspace Build → Edit in OyamaEmail
   - Old Email Builder → Legacy notice or redirect

### Phase 2 — Move builder and send workflow

1. Move useful pieces from `EmailBuilderApp` into `EmailBuilderWorkspace`.
2. Replace embedded builder in `CampaignWorkspace`.
3. Build publish/compliance endpoint.
4. Build send wizard.
5. Send wizard creates/updates real `EmailCampaign` records.

### Phase 3 — Strip old UI

After the new workspace is tested:

1. Remove or archive old standalone `/email-builder` route.
2. Remove old embedded Build mode from `CampaignWorkspace`.
3. Remove duplicate template UI from `/communications` if OyamaEmail owns templates.
4. Remove fake/demo/email project cards.
5. Keep `/communications` as dashboard only.

### Phase 4 — Hardening

1. Add e2e tests.
2. Add smoke tests that fail on fake UI text.
3. Add readiness docs.
4. Add HOW_TO_USE docs.
5. Add screenshots from real local app.

---

## 10. Old Code Cleanup Plan

### Keep

Keep these until replaced fully:

```txt
server/src/routes/email-campaigns.ts
server/src/services/email-compliance.ts
server/src/services/smtp-service.ts
EmailCampaign Prisma model
EmailRecipientList models
EmailSubscription models
EmailSuppression models
EmailSendRecipient models
EmailDeliveryEvent models
```

These are real infrastructure and should not be deleted.

### Move / refactor

Move useful editor logic from:

```txt
app/components/email-builder/EmailBuilderApp.tsx
```

into:

```txt
app/components/oyama-email/EmailBuilderWorkspace.tsx
app/components/oyama-email/EmailCanvas.tsx
app/components/oyama-email/EmailBlockPalette.tsx
app/components/oyama-email/EmailInspector.tsx
```

### Deprecate / remove after replacement

Audit and remove or repurpose:

```txt
app/components/communications/CommunicationsTemplatesPanel.tsx
app/components/communications/EmailProjectLibrary.tsx
app/components/communications/NewCampaignModal.tsx
app/components/communications/CampaignWorkspace.tsx build mode
/email-builder route
```

Do not delete blindly. First search for imports and route usage, then replace callers.

### Communications page after cleanup

`/communications` should become:

```txt
Engagement Dashboard
- Recent emails
- Recent letters
- Scheduled sends
- Pending drafts
- Pending approvals
- Communication log
- Performance summary
- Shortcuts to OyamaEmail and OyamaLetters
```

It should not be where users build email content.

---

## 11. Known Bug / Risk Register and Fixes

### Bug 1 — Communications has too many responsibilities

**Problem:** The current Communications page mixes campaigns, drafts, templates, segments, queue, logs, and settings.

**Fix:** Make Communications a dashboard. Move authoring and sending into OyamaEmail.

---

### Bug 2 — Old builder is embedded inside CampaignWorkspace

**Problem:** `CampaignWorkspace` has a `build` mode that embeds `EmailBuilderApp`.

**Fix:** Replace Build mode with a link to:

```txt
/oyama-email/templates/[templateId]/builder
```

or:

```txt
/oyama-email/campaigns/[campaignId]/builder
```

During transition, show a legacy notice:

```txt
This campaign was built with the legacy email builder. Open in OyamaEmail to continue editing.
```

---

### Bug 3 — Campaign and template concepts are mixed

**Problem:** `EmailCampaign` currently stores body/template data. This makes template library and campaign sends blur together.

**Fix:** Add first-class `EmailTemplate` and `EmailTemplateVersion` models. Campaigns should reference a template/version snapshot when created from a template.

---

### Bug 4 — Possible fake/demo UI risk

**Problem:** Past CRM modules have had cards and mock UI before backend completion. OyamaEmail must not repeat that.

**Fix:** Every visible count/card/list should either:
1. Load from a real API, or
2. Show a real empty state, or
3. Be hidden until implemented.

Add a test that searches for forbidden strings:

```txt
fake
mock
demo data
placeholder only
coming soon
sample recipients
```

Allow those words only in docs/tests, not production UI.

---

### Bug 5 — Send route comments mention simulated sending

**Problem:** The email route comments include wording about campaign send being simulated while also mentioning SMTP-backed sending. This is confusing and may reflect stale behavior.

**Fix:** Audit `POST /api/email-campaigns/:id/send`. Confirm it uses `createOrganizationEmailSender` and writes real send logs. If it still simulates delivery, rename it clearly to demo mode or replace it with real SMTP send behavior.

---

### Bug 6 — Compliance checks must not be UI-only

**Problem:** If compliance is only a checklist in React, users may bypass it by calling send APIs directly.

**Fix:** Enforce compliance in the API:
- publishing endpoint
- send validation endpoint
- schedule/send-now endpoints

---

### Bug 7 — Unsubscribe and suppression must be applied before send

**Problem:** Email should never send to unsubscribed/suppressed/do-not-email recipients.

**Fix:** Audience validation service must run immediately before queueing/sending. Do not rely only on earlier wizard counts.

---

### Bug 8 — Old routes may create two paths for same action

**Problem:** If `/communications`, `/email-builder`, and `/oyama-email` all remain equally visible, users will be confused.

**Fix:** Use a transition map:
- `/email-builder` → redirect or legacy notice
- `/communications/:id?mode=build` → redirect to OyamaEmail builder
- New campaign button → OyamaEmail template/send wizard
- Communications templates tab → OyamaEmail templates

---

### Bug 9 — Missing deliverability setup

**Problem:** Email can look correct but still fail due to missing SPF/DKIM/DMARC, physical address, or unsubscribe headers.

**Fix:** Add settings/status page:
```txt
Sending domain
SPF status
DKIM status
DMARC status
PTR/manual note
List-Unsubscribe support
Physical address
Default preference category
SMTP status
Test send status
```

Manual status is acceptable at first if live DNS lookup is not implemented. Do not fake “pass.”

---

### Bug 10 — No full e2e send workflow test

**Problem:** Source-string tests do not prove a user can build, publish, select recipients, and send.

**Fix:** Add Playwright tests for the full workflow.

---

## 12. No Fake Data / No Fake UI Rule

Every agent must follow this rule:

```txt
If a screen cannot be backed by live API data yet, do not present it as finished.
```

Acceptable patterns:

```txt
Real data loaded from API
Real empty state
Disabled control with explicit "Not implemented yet" marker
Feature flag hidden control
Development-only fixture inside tests
```

Not acceptable:

```txt
Fake recipients
Fake stats
Fake analytics
Fake delivery events
Fake template cards
Fake queue rows
Fake success statuses
Fake "sent" messages
Hard-coded names as if they are CRM data
```

Add visible warnings for partial features:

```txt
This feature is still being developed and is not production-ready.
```

Log these partials in `AGENTS.md` or the current repo’s agent tracking file, with removal tasks.

---

## 13. Implementation Checklist

### Step A — Audit

- [ ] Search for all `/communications` links.
- [ ] Search for all `/email-builder` links.
- [ ] Search for `EmailBuilderApp` imports.
- [ ] Search for fake/mock/demo data in email-related UI.
- [ ] Search for old template/campaign duplication.
- [ ] Confirm SMTP send path is real.
- [ ] Confirm unsubscribe/suppression logic is enforced at send time.
- [ ] Confirm delivery event webhooks update campaign stats.

### Step B — Create workspace shell

- [ ] Create `/oyama-email`.
- [ ] Create `OyamaEmailWorkspace`.
- [ ] Create email-only sidebar.
- [ ] Add Back to CRM button.
- [ ] Match generated image style.
- [ ] Add routes for templates, builder, publish, send, campaigns, queue, analytics, settings.

### Step C — Backend API

- [ ] Add `/api/oyama-email` route file.
- [ ] Add template service.
- [ ] Add render service.
- [ ] Add publish/compliance service.
- [ ] Add audience resolve service.
- [ ] Add audience validation service.
- [ ] Add send orchestration service.
- [ ] Add analytics service.
- [ ] Keep `/api/email-campaigns` working.

### Step D — Data model

- [ ] Add `EmailTemplate`.
- [ ] Add `EmailTemplateVersion`.
- [ ] Add template reference fields to `EmailCampaign`.
- [ ] Create migration.
- [ ] Create seed utility for starter templates, if needed.

### Step E — UI screens

- [ ] Template Library.
- [ ] Builder.
- [ ] Publish & Compliance.
- [ ] Send Wizard.
- [ ] Review & Validate.
- [ ] Campaign Results.
- [ ] Analytics.
- [ ] Settings.

### Step F — Remove old duplicate UI

- [ ] Replace Communications build path.
- [ ] Replace old new-campaign flow.
- [ ] Redirect or deprecate `/email-builder`.
- [ ] Remove duplicated template UI.
- [ ] Keep Communications as dashboard only.

### Step G — Testing

- [ ] Unit tests for email template validation.
- [ ] Unit tests for merge field rendering.
- [ ] Unit tests for compliance blockers.
- [ ] Unit tests for recipient eligibility.
- [ ] API tests for publish.
- [ ] API tests for send validation.
- [ ] API tests for send now.
- [ ] API tests for schedule.
- [ ] Playwright test for full flow.
- [ ] Smoke test to prevent fake data in production UI.

### Step H — Bug & Gap Hardening

- [ ] Builder UX: block inspector is discoverable and opens in a modal with live selected-block preview.
- [ ] API safety: send/schedule endpoints are idempotent (retry-safe) and protected against double-submit.
- [ ] State safety: publish/send actions enforce valid status transitions (draft -> published -> campaign send states).
- [ ] Snapshot integrity: send operations persist immutable recipient + template-version snapshot used for that send.
- [ ] Time safety: scheduling stores timezone-aware timestamps and blocks ambiguous/invalid local times.
- [ ] Access control: template/campaign routes enforce org ownership + permission checks server-side.
- [ ] Accessibility: builder/editor modals support keyboard close, focus trap, visible focus states, and labels.
- [ ] Observability: publish/send failures write structured audit and error events with correlation IDs.

---

## 14. Suggested Copilot Prompt

```md
Build OyamaEmail as a dedicated email communications workspace modeled after OyamaLetters. Do not create fake UI, fake recipients, fake template cards, fake analytics, or demo-only screens. Every visible list, count, campaign, recipient, queue row, and metric must come from a live API, a real empty state, or be clearly disabled as not implemented.

Start by auditing the current email/communications system:
- app/communications/page.tsx
- app/components/communications/CampaignWorkspace.tsx
- app/components/email-builder/EmailBuilderApp.tsx
- app/components/communications/EmailProjectLibrary.tsx
- app/components/communications/NewCampaignModal.tsx
- app/components/communications/CommunicationsTemplatesPanel.tsx
- app/components/communications/CommunicationsSegmentsPanel.tsx
- app/components/communications/CommunicationsSettingsPanel.tsx
- server/src/routes/email-campaigns.ts
- server/src/services/email-compliance.ts
- server/src/services/smtp-service.ts
- Prisma email campaign/subscription/suppression/send-recipient/delivery models

Create a new dedicated workspace:
- /oyama-email
- /oyama-email/templates
- /oyama-email/templates/new
- /oyama-email/templates/[templateId]/builder
- /oyama-email/templates/[templateId]/publish
- /oyama-email/send
- /oyama-email/campaigns
- /oyama-email/campaigns/[campaignId]
- /oyama-email/queue
- /oyama-email/analytics
- /oyama-email/settings

Match the five visual references generated for OyamaEmail. The sidebar must be email-only and include:
Templates, Send Email, Campaigns, Audience, Queue, Analytics, Settings, Help Center, and a bottom Back to CRM button.

Implement a single organized user workflow:
1. Template Library
2. Email Builder
3. Publish & Compliance
4. Send Wizard - Audience
5. Send Details
6. Review & Validate
7. Confirm Send / Schedule / Save Draft
8. Results & Analytics

Create a dedicated API namespace:
- /api/oyama-email/templates
- /api/oyama-email/templates/:id
- /api/oyama-email/templates/:id/publish
- /api/oyama-email/templates/:id/publish-history
- /api/oyama-email/templates/:id/preview
- /api/oyama-email/templates/:id/send-test
- /api/oyama-email/audience/resolve
- /api/oyama-email/audience/validate
- /api/oyama-email/send/validate
- /api/oyama-email/send/create-draft
- /api/oyama-email/send/schedule
- /api/oyama-email/send/send-now
- /api/oyama-email/campaigns
- /api/oyama-email/campaigns/:id/results
- /api/oyama-email/settings
- /api/oyama-email/domain-status

Preserve the existing email-campaign backend for delivery, SMTP, suppression, unsubscribe, scheduling, delivery events, opens/clicks/bounces, and stats. Refactor it behind OyamaEmail rather than deleting it.

Add first-class email templates if they do not already exist:
- EmailTemplate
- EmailTemplateVersion
- Link EmailCampaign to template/version snapshot

Publish/compliance must validate:
- subject line
- preview text
- from name/email
- reply-to
- preference category
- unsubscribe link
- one-click unsubscribe capability
- physical address
- plain text version
- merge fields
- fallback rules
- mobile preview
- test email status
- suppression/eligibility readiness
- SMTP/domain setup

External requirements to keep in mind:
- CAN-SPAM: truthful headers, non-deceptive subject, physical address, opt-out, honor opt-outs.
- Gmail/Yahoo bulk sender rules: SPF/DKIM/DMARC, low spam complaint rate, one-click unsubscribe/list-unsubscribe for marketing/subscribed messages, visible unsubscribe link, RFC-compliant messages.

Clean up old code after the new workspace works:
- Replace CampaignWorkspace build mode with OyamaEmail builder link.
- Redirect/deprecate /email-builder.
- Remove duplicate template UI from Communications.
- Make /communications a dashboard only.
- Delete dead components only after verifying no imports remain.

Testing:
- Add Playwright tests that create/select a template, edit, publish, choose multiple real recipients, validate, send test, schedule/send, and view analytics.
- Add source guard tests that fail if production email UI contains fake/mock/demo data strings.
- Add API tests for publish validation, recipient eligibility, suppression, unsubscribe, send now, schedule, and delivery event updates.
```

---

## 15. Final Acceptance Criteria

The implementation is complete only when:

```txt
/oyama-email opens a dedicated workspace.
The sidebar is email-only and includes Back to CRM.
The Template Library uses live persisted templates.
The Builder saves real template content.
Publish runs real compliance validation.
Published templates create snapshots/history.
The Send Wizard selects real recipients.
Audience validation uses real suppression/subscription/do-not-email data.
The review screen shows real validation counts.
Send test works or fails with a real SMTP/config error.
Send now creates real send records.
Schedule creates a real scheduled campaign.
Campaign results use real delivery/send-log data.
Analytics are backed by the existing delivery-event system.
Communications is simplified into an overview/dashboard.
Old builder routes are redirected, deprecated, or removed.
No production UI uses fake data.
Tests cover the full workflow.
Docs and HOW_TO_USE are updated.
```

---

## 16. Short Product Definition

OyamaEmail is the dedicated email studio inside OyamaCRM. It is not a dashboard tab, not a fake template gallery, and not a disconnected builder. It is a full workflow for creating, validating, sending, and tracking donor email communication.

The user path is simple:

```txt
Template → Builder → Compliance → Audience → Review → Send → Results
```

The technical direction is simple:

```txt
New OyamaEmail UI + new /api/oyama-email namespace
Preserve existing email-campaign delivery engine
Move Communications back to being a dashboard
Strip old duplicate builder paths after migration
No fake data
```

---

## 18. Builder Hardening Delta (2026-05-29)

Implemented in the current pass:

```txt
Text blocks are edited with a rich text editor (no raw HTML shown to end users)
Block inspector is a dedicated modal with live block preview and quick block actions
Template-wide typography defaults are editable in the inspector modal (font family, size, line-height, text/link colors, content width)
Canvas supports true drag-and-drop block reordering
Subject and preview text counters added for basic email quality guidance
Server renderer now honors template typography defaults for preview/send output
```

Validation executed in this pass:

```txt
pnpm -s test:smoke:oyama-email  (pass)
pnpm -s typecheck:web           (pass)
pnpm -s typecheck:server        (pass)
```

---

## 17. Bug and Gap Fix Pass (2026-05-29)

This pass captures implementation gaps that should be treated as release blockers or explicit phased items.

### Builder UX gaps

- Block inspector discoverability was weak when embedded deep in the right panel. Require modal-based inspector with selected-block preview and direct open action from canvas selection.
- Insert-between affordance exists, but keyboard-only block insertion/editing path should be added to avoid mouse-only editing bottlenecks.
- Mobile preview must be treated as parity validation, not just visual toggle. Add checklist item requiring mobile-safe spacing and tap-target checks.

### API and workflow correctness gaps

- Publish must be server-gated and status-driven. Sending from unpublished templates should be blocked unless a documented override policy exists.
- Send now/schedule/create-draft endpoints need idempotency keys to prevent duplicate campaigns from retries or double-clicks.
- Audience validation must run twice: pre-review and immediately pre-queue (final authoritative suppression/unsubscribe check).
- Template and campaign snapshots must be immutable per send so analytics reflect exactly what was delivered.

### Compliance and deliverability gaps

- One-click unsubscribe requirements should be enforced by purpose/category policy mapping, not optional UI toggles alone.
- Domain authentication status (SPF/DKIM/DMARC) should have explicit state values (`unknown`, `passing`, `failing`, `manual`) instead of binary pass/fail badges.
- Add guardrails for deceptive sender display (From Name resembling a different organization).

### Reliability and safety gaps

- Autosave conflict handling is undefined. Add revision/version conflict strategy for concurrent editors.
- Require org-scoped ownership checks on every template/campaign read/write endpoint to avoid cross-org IDOR issues.
- Add structured audit events for publish, send-test, send-now, schedule, and approval transitions.

### Test coverage gaps

- Add Playwright coverage for modal inspector editing flow (open, edit block, close, persisted update).
- Add API tests for status transition blockers and idempotency behavior.
- Add integration tests that assert review counts match final pre-send validation counts.
