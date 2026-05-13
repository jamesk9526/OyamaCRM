# Donor CRM Email System Audit

Status: Partially Working
Date: 2026-05-13

## Scope Reviewed
- Communications campaign send and audience preview flow
- Public unsubscribe and preferences links
- Donor profile subscription management endpoints
- Email builder review/readiness behavior

## What Is Working
- Shared compliance data model exists for subscription, preferences, suppression, consent events, unsubscribe tokens, and campaign recipient eligibility snapshots.
- Campaign send now evaluates recipients against do-not-contact flags, suppressions, global status, and category preferences before sending.
- Campaign send writes per-recipient eligibility records (`EmailSendRecipient`) for auditability.
- Campaign send now issues per-recipient unsubscribe/preference tokens and injects tokenized links into sent content.
- Public endpoints are live for:
  - `GET /api/email/preferences/:token`
  - `POST /api/email/preferences/:token`
  - `POST /api/email/unsubscribe/:token`
- Public pages are live at:
  - `/preferences/[token]`
  - `/unsubscribe/[token]`
- Donor profile can load and update subscription + category settings via:
  - `GET /api/email/subscriptions/by-constituent/:constituentId`
  - `PUT /api/email/subscriptions/by-constituent/:constituentId`
  - `POST /api/email/subscriptions/token`

## What Is Partially Working
- Compliance readiness checks use content heuristics (unsubscribe/preferences controls) and do not yet validate mailing-address boilerplate from a dedicated org-address configuration source.
- Cross-tool UI adoption is in progress. Communications send path and donor profile are integrated, but not every outbound email producer has purpose/category UI surfaced yet.

## Risks
- Prisma client regeneration and migration application are required for runtime parity with new schema.
- Legacy campaigns without modern footer merge tokens may fail readiness checks until updated.

## Recommended Next Pass
1. Add migration and apply in all environments.
2. Expand purpose/category controls into every workflow that creates campaign records.
3. Add integration tests for tokenized links in real send payloads.
4. Add suppression ingestion bridge for bounce/complaint webhooks.
