# DonorCRM Letters And Printables

Last updated: 2026-05-12

## Purpose

Document the current Letters and Printables implementation, including integration with communications, steward paths, tasks, and activity timeline.

## Workspace Role

Letters and Printables is the print/mail/PDF channel workspace in the Donor Engagement System.

It should:

- Manage letter templates
- Generate donor-specific letter records
- Track print/mail fulfillment status
- Bridge to communications draft creation when an email version is needed

## Current Status

Status: Partially Working

Reason:

- Core template and generation flows are persisted and integrated.
- Letter-to-email draft bridge is persisted and linked.
- PDF export and batch generation are still partial/in-development.

## Implemented Routes

- /letters-printables
- /letters-printables/templates
- /letters-printables/generate
- /letters-printables/generated
- /letters-printables/signatures
- /letters-printables/branding

## Implemented API Surfaces

Base: /api/letters

- GET /dashboard
- GET /merge-fields
- Template CRUD endpoints
- POST /generated/preview
- POST /generated
- GET /generated
- PATCH /generated/:id/status
- POST /generated/:id/create-email-draft
- POST /generated/:id/export-pdf (partial)

## Integration Points

### Communications integration

- Generated letter records can create linked EmailCampaign drafts.
- GeneratedLetter keeps emailCampaignId linkage where created.

### Steward paths integration

- Sequence engine generate-letter step uses shared letter execution service.
- Generated letters can carry steward enrollment and step-run linkage.

### Tasks integration

- Letter-generated follow-up tasks can be linked by source task IDs.

### Activity timeline integration

- Generation and status updates create timeline Activity entries for linked constituents.

## Shared Status Mapping

Letters currently expose states like:

- GENERATED
- PRINTED
- MAILED
- EMAIL_DRAFT_CREATED
- EMAIL_SENT
- ARCHIVED

User-facing language should map to:

- Generated
- Printed
- Mailed
- Draft
- Sent
- Archived

## Operational Guidance

Use this sequence for donor thank-you fulfillment:

1. Generate letter from donor/donation context.
2. Mark printed when physically printed.
3. Mark mailed when fulfillment completes.
4. If email channel is required, create linked email draft.
5. Continue review/send in Communications.

## Known Limits

- True server-side PDF pipeline is not complete.
- Batch generation/fulfillment queues are not fully complete.
- Full queue analytics in dashboard/report views are still partial.

## Next Improvements

1. Complete PDF export pipeline.
2. Add batch generate/print/mail queue controls.
3. Expand dashboard/report cards for print/mail backlog and SLA tracking.
