# DonorCRM Letters And Printables

Last updated: 2026-06-13

## Purpose

Document the current Letters and Printables implementation, including integration with communications, steward paths, tasks, and activity timeline.

## Workspace Role

Letters and Printables is the print/mail/PDF channel workspace in the Donor Engagement System. The current product direction is a single printable-project manager, closer to an Adobe Express-style workflow than a multi-page admin console.

It should:

- Manage letter templates
- Generate donor-specific letter records
- Track print/mail fulfillment status
- Bridge to communications draft creation when an email version is needed
- Keep organization identity, logo, address, and colors sourced from Organization Settings and Branding Settings

## Current UX Workflow

1. Open `/letters-printables`.
2. Select an existing printable project or create a new one.
3. Edit the project in the document studio at `/letters-printables/templates/[templateId]`.
4. Use the Word-style paper canvas to write content, insert styled content blocks, and type `{{` for inline merge-field suggestions.
5. Configure the single Communication Header + Footer in Branding Settings. Organization logo, name, address, colors, and identity always come from Organization Settings and Branding Settings.
6. Search for a constituent and optional donation in the preview context instead of pasting IDs.
7. Run print preview, then publish/generate and route to PDF export, print queue, or mail queue.

The old template-library route now opens the same project manager for compatibility. Print queue, mail queue, and generated-output routes remain available as production views, but the primary user entry point is the project manager.
The old batch exporter route redirects into the unified generator at `/letters-printables/generate?mode=batch`.
The Communications aliases `/communications/letters-printables` and `/communications/letters-printables/generate` redirect to the canonical Letters & Printables routes.

## Current Status

Status: Partially Working

Reason:

- Core printable project/template and generation flows are persisted and integrated.
- `/letters-printables` now opens a project manager with large cards, small cards, and list views.
- The editor route now opens a document-studio layout with a paper canvas, compact ribbon, left project/tools panel, right preview context, inline merge suggestions, and publish controls.
- The document studio supports active-block left/center/right/justify alignment, saved-section alignment before insertion, and an inspector table builder for rows, columns, header rows, width, padding, border style, and cell alignment.
- Header and footer chrome is global from Branding Settings; the editor focuses on letter body content, merge fields, layout, and signatures.
- Editor images can be uploaded to `/api/letters/media` and inserted into the printable canvas.
- The editor can be opened in a full-screen new tab with `?fullscreen=1`.
- Branding Settings now includes editable header/footer preset tools and uploaded handwritten signature images for rendered letters.
- Constituent and donation preview context uses searchable API lookups.
- Single-letter and batch generation now share `/letters-printables/generate`, with document type selection, template cards, real constituent search, saved audience list matching, report-result handoff IDs, campaign donors, date-range donors, segment search, dry-run checks, merged HTML preview, actual PDF blob preview, PDF download/open, and mark-printed actions.
- Letter-to-email draft bridge is persisted and linked.
- PDF export and batch generation are working through the existing `GeneratedLetter` model. Server-rendered PDFs preserve common editor formatting including line height, white-space blocks, images, active-block alignment, table header rows, multiline table cells, and basic cell alignment. Chromium-grade PDF fidelity, Avery label grids, ZIP export, cover pages, and TOC generation are still partial/in-development.

## Implemented Routes

- /letters-printables
- /letters-printables/templates (compatibility route to the project manager)
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

- Chromium-grade PDF fidelity is not complete, though the server-side PDF path is active for generated letters and preserves current builder formatting controls.
- Batch generation/fulfillment queue depth still needs operational expansion beyond the current production workflow.
- Full queue analytics in dashboard/report views are still partial.

## Next Improvements

1. Expand PDF fidelity for complex page layouts beyond the current supported editor controls.
2. Expand batch print/mail queue operations and vendor handoff depth.
3. Expand dashboard/report cards for print/mail backlog and SLA tracking.
