# Letters & Printables Workspace

## Summary

The Donor CRM Letters & Printables workspace at `/letters-printables` supports template authoring, single and batch generation, print queue operations, mail queue operations, and letter-to-email draft handoff.

## Scope

This workspace is Donor CRM-only and uses the green DonorCRM shell.

Implemented routes:

- `/letters-printables`
- `/letters-printables/templates`
- `/letters-printables/templates/new`
- `/letters-printables/templates/[templateId]`
- `/letters-printables/generate`
- `/letters-printables/batches`
- `/letters-printables/print-queue`
- `/letters-printables/mail-queue`
- `/letters-printables/generated`
- `/letters-printables/signatures`
- `/letters-printables/branding`
- `/letters-printables/settings`

## Backend API

Letters API base: `/api/letters`

Implemented endpoints:

- `GET /dashboard`
- `GET /merge-fields`
- `GET /templates`
- `GET /templates/:id`
- `POST /templates`
- `PATCH /templates/:id`
- `POST /templates/:id/duplicate`
- `DELETE /templates/:id`
- `GET /header-presets`
- `POST /header-presets`
- `PATCH /header-presets/:id`
- `GET /footer-presets`
- `POST /footer-presets`
- `PATCH /footer-presets/:id`
- `GET /signatures`
- `POST /signatures`
- `PATCH /signatures/:id`
- `GET /generated`
- `GET /constituents/:id/generated`
- `POST /generated/preview`
- `POST /generated`
- `PATCH /generated/:id/status`
- `POST /generated/:id/create-email-draft`
- `GET /generated/queue/print`
- `GET /generated/queue/mail`
- `POST /generated/queue/print/actions`
- `POST /generated/queue/mail/actions`
- `POST /generated/batch`
- `POST /generated/:id/export-pdf` (returns explicit partial-implementation notice)

`GET /generated` supports trace-aware filters for unified workflow navigation:

- `sourceTaskId`
- `stewardPathEnrollmentId`
- `stewardPathStepRunId`

## Communication History Integration

When letters are generated or moved through key queue/status actions, constituent timeline activity events are recorded.

When an email draft is created from a generated letter, a linked `EmailCampaign` draft is created for Communications workflows.

## Permission Keys

Letters permissions include:

- `letters.view`
- `letters.create`
- `letters.edit`
- `letters.archive`
- `letters.generate`
- `letters.generate_batch`
- `letters.manage_print_queue`
- `letters.manage_mail_queue`
- `letters.manage_signatures`
- `letters.manage_branding`
- `letters.create_email_draft`
- `letters.export_pdf`
- `letters.view_sensitive_merge_data`
- `letters.manage_all`

Sensitive merge groups (gift and year fields) are filtered unless `letters.view_sensitive_merge_data` is granted.

## Current Status

Status: Partially Working

Working now:

- Template CRUD and duplication/archive
- TipTap-based rich form-letter editor in template text modes (print and email)
- Inline merge token insertion at editor cursor
- Single-letter merge preview and generation
- Batch generation with dry-run, skip reasons, household dedupe option, and optional queue handoff
- Print queue list and bulk actions (approve, queue, mark printed, move to mail queue, cancel, archive)
- Mail queue list and bulk actions (queue for mail, mark mailed, mark returned, address issue, reprint, archive)
- Signature/header/footer preset CRUD (create/update/list)
- Constituent-profile letter history panel
- Email draft creation from generated letter
- Timeline and audit logging for key letter and queue events
- Shared letter execution service reused by letters API and steward-path letter steps

Partially implemented:

- Server-side PDF rendering/export pipeline (`POST /generated/:id/export-pdf`) is still explicit partial status
- Workflow settings persistence APIs are not yet wired (settings page is guidance-only)

## Notes

Feature flag:

- `NEXT_PUBLIC_FEATURE_LETTERS_VISUAL_BUILDER=true` enables visual print layout mode in the template editor.
- When disabled, the TipTap text authoring path remains available.

## Next Steps

1. Implement server-side PDF rendering and file storage/delivery with retry/error tracking.
2. Add queue policy persistence (approval rules, SLA defaults, and assignment metadata).
3. Expand queue-focused tests across API and e2e operations for print and mail transitions.
