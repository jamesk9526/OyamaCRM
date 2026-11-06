# Donor survey customization and delivery verification

## Scope

Donor-only expansion: branded public surveys, custom invitation emails, full donor audience selection, survey-specific opt-outs. Client survey safe-email eligibility, identity isolation and original 500-recipient limit remain. No production email was sent or recipient preference changed.

Branding includes hosted raster logo upload (200 KB, checked signature/dimensions through existing managed-image storage), organization logo reuse, alt text, colors, fonts and submit text. Configuration lives in revision JSON; old published links remain pinned. Shared controls and application chrome keep existing styling while respondent content uses the chosen theme. Contrast handling uses white or black button text and a darker control accent when needed.

Distribution supports up to ten complete lists or all open donors, capped at 10,000 resolved recipients, with explicit errors rather than truncation. Lists are organization-scoped; duplicates, prior invitations, suppressions, missing/invalid addresses and opt-outs are reviewed. Anonymous surveys can include email-only list members; CRM-linked surveys report their exclusion. Recipient/content changes invalidate review. Idempotency hashes include the new email design and full-audience option. Writes are chunked into 500-row operations inside the transaction. Delivery remains paced by the existing durable worker.

SURVEY was added to existing email category enums. Survey links cannot change global preferences or other categories, including forged scope=all requests. The new category affects only survey invitations. Existing global opt-outs and hard blocks continue to apply. Historical tokens issued under other categories are not silently reclassified.

## Checks

- 41 tests pass across survey-definition, surveys-workspace API, survey-email-preferences API, email-compliance, communication-image-urls and letters-production-assets files.
- Real local HTTP handlers and queue processing are tested with synthetic Prisma responses and a fake email sender. Tests cover a 601-person audience, changed audience/content, retry protection, anonymous email-only list members, client isolation, theme snapshots, unsafe logo rejection, email rendering, preference category isolation and global blocks.
- Repository/web/server type checks pass. Prisma schema validation and client generation pass. Isolated Next production builds pass (228 pages/routes). Initial sandbox build was blocked by EPERM creating a generated directory; the separately isolated build with filesystem access succeeded.
- Targeted ESLint: zero errors, two native-img advisory warnings; managed logo URLs intentionally load directly.
- Browser fixture passes in production build at 1440, 1366, 1280 and 390 widths, with no page errors or horizontal overflow. New controls are exercised, and existing keyboard focus, multi-page preview, anonymous response, export and client-only library flows remain functional. The public unsubscribe and preferences browser checks assert category-only payloads and absence of global controls.

## Visual comparison

| View | Before | After |
| --- | --- | --- |
| Builder | [Original](before/builder-1366.png) | [Branding controls beside questions](after/builder-1366.png) |
| Phone respondent | [Original](before/respondent-390.png) | [Logo and selected theme](after/respondent-390.png) |
| Invitation | Original used subject/message only | [Desktop composer](after/invitation-1440.png), [phone composer and preview](after/invitation-390.png) |
| Survey opt-out | Generic global unsubscribe page | [Survey-only unsubscribe](after/survey-unsubscribe-390.png), [survey-only preferences](after/survey-preferences-390.png) |

Intentional changes: logo and theme belong to respondent content, with appearance settings grouped below survey setup. Invitation composition uses editable text with a generated branded HTML layout and text alternative. Arbitrary HTML editing is not exposed. Existing share/review/schedule/reminder/history controls remain discoverable. Synthetic images are explicitly labeled Sample organization; they are not production branding.

## Deployment and remaining acceptance

Apply `pnpm exec prisma migrate deploy` and `pnpm exec prisma generate` before starting updated API/worker code. Deploy matching web/API, rebuild the server, restart workers and retain public managed-image routes. This run did not apply the migration to real MySQL, process a live 10,000-person distribution or exercise a real SMTP provider. Verify a small authorized donor test send first, including logo loading, recipient-specific link and survey-only unsubscribe. Existing historical unsubscribe links retain their previous category; new invitations use SURVEY. No commit, push or deployment was performed.
