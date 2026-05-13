# Donor CRM Email Compliance

Status: Partially Working
Date: 2026-05-13

## Shared Compliance Layer
The email system now uses shared data entities for consent and suppression decisions:
- `EmailSubscription`
- `EmailPreference`
- `EmailSuppression`
- `EmailConsentEvent`
- `EmailUnsubscribeToken`
- `EmailSendRecipient`
- `EmailDeliveryEvent`

## Purpose-Based Enforcement
Campaign purpose drives category mapping and preference checks.

Compliance-gated purposes:
- `MARKETING`
- `FUNDRAISING`
- `NEWSLETTER`
- `EVENT_PROMOTION`

Transactional/non-marketing purposes are allowed, but active suppressions and do-not-contact controls still block sends.

## Pre-Send Readiness Rules
Before schedule/send, campaigns are checked for:
- Subject present
- Valid sender email
- Valid reply-to email when provided
- Unsubscribe control present (for compliance-gated purposes)
- Manage-preferences control present (for compliance-gated purposes)

## Recipient Eligibility Rules
Recipients are excluded before queue/schedule/send when any of the following applies:
- Missing or invalid email
- Duplicate recipient email
- `doNotContact` or `doNotEmail`
- `emailOptOut` (for compliance-gated sends)
- Active suppression
- Global subscription status block (`UNSUBSCRIBED`, `SUPPRESSED`, `BOUNCED`)
- Category preference unsubscribed for the mapped purpose category

## Public Consent Endpoints
No-login tokenized endpoints:
- `GET /api/email/preferences/:token`
- `POST /api/email/preferences/:token`
- `POST /api/email/unsubscribe/:token`

Public pages:
- `/preferences/[token]`
- `/unsubscribe/[token]`

## Donor Profile Controls
Staff can review and manage one donor's settings through:
- `GET /api/email/subscriptions/by-constituent/:constituentId`
- `PUT /api/email/subscriptions/by-constituent/:constituentId`
- `POST /api/email/subscriptions/token`

## TODO
- TODO: backend API needed for ESP webhook ingestion into `EmailSuppression` and `EmailDeliveryEvent` (hard bounces, complaints, deferred retries).
- TODO: backend API needed for automated letter-to-email draft purpose/category propagation across all print/email bridge workflows.
