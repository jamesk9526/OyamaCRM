# Letters & Printables Workspace

## Summary

The Donor CRM now includes a dedicated Letters & Printables workspace at `/letters-printables` for building donor-facing letter templates, generating individualized letters, preparing print workflows, and creating email drafts tied to communication history.

## Scope

This workspace is Donor CRM-focused and uses the green Donor CRM shell.

Implemented routes:

- `/letters-printables`
- `/letters-printables/templates`
- `/letters-printables/templates/new`
- `/letters-printables/templates/[templateId]`
- `/letters-printables/generate`
- `/letters-printables/generated`
- `/letters-printables/signatures`
- `/letters-printables/branding`

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
- `POST /generated/:id/export-pdf` (returns partial-implementation notice)
- `POST /generated/batch` (returns partial-implementation notice)

## Communication History Integration

When a letter is generated or advanced in status, Activity timeline entries are written for the linked constituent.

When an email draft is created from a generated letter, an EmailCampaign draft is created and linked to the generated letter.

## Permission Keys

Letters permissions are managed through existing user permission overrides:

- `letters.view`
- `letters.create`
- `letters.edit`
- `letters.archive`
- `letters.generate`
- `letters.generate_batch`
- `letters.manage_signatures`
- `letters.manage_branding`
- `letters.create_email_draft`
- `letters.export_pdf`
- `letters.view_sensitive_merge_data`
- `letters.manage_all`

Sensitive merge groups (gift and year fields) are filtered out unless `letters.view_sensitive_merge_data` is granted.

## Current Status

Status: Partially Working

Working now:

- Template CRUD and duplication/archive
- Signature/header/footer preset CRUD (create/update/list)
- Single-letter merge preview + generation
- Constituent-profile letter history panel
- Email draft creation from generated letter
- Timeline + audit logging for key letter events

Partially implemented:

- PDF export endpoint currently returns an explicit partial status response
- Batch generation endpoint currently returns an explicit partial status response

## Next Steps

1. Wire server-side PDF rendering pipeline and file delivery.
2. Add true batch generation workflows with queue and progress states.
3. Expand template builder UX with richer editor controls and inline merge insertion at cursor.
4. Add focused UI tests for template editor and generated-letter state transitions.
