# OyamaLetters

Last updated: May 27, 2026

## Current Workspace

Canonical routes:

- `/oyama-letters`
- `/oyama-letters/generate`
- `/oyama-letters/templates`
- `/oyama-letters/templates/[templateId]`
- `/letters-printables` redirects to `/oyama-letters`
- `/letters-printables/generate` redirects to `/oyama-letters/generate`
- `/communications/letters-printables` redirects to `/oyama-letters`
- `/communications/letters-printables/generate` redirects to `/oyama-letters/generate`

`/oyama-letters/generate` is the unified OyamaLetters Generate Center. It uses real Donor CRM data only: letter templates, constituents, saved audience lists, campaigns, donations, generated letter records, and constituent activity timelines. The old "Letters & Printables" entry is deprecated.

## Implemented

- Three-column generation workspace: Template & Audience, live document preview, Merge Fields & Settings.
- Printable type selector for thank-you letters, receipts, labels/envelopes, custom letters, event packets, and board packets.
- Real template cards from `GET /api/letters/templates`.
- Real constituent search from `GET /api/constituents`.
- Saved-list matching through `GET /api/email-campaigns/lists`.
- Campaign and date-range donor batch sources through `POST /api/letters/generated/batch`.
- Merged HTML preview from `POST /api/letters/generated/preview`.
- Batch dry-run, generated document persistence, and generated-document activity logging through the existing `GeneratedLetter` model.
- Server PDF generation and inline browser PDF preview from actual PDF blobs.
- Download, print/open, and mark-printed actions for generated PDFs.

## Partial

- The server PDF renderer is the existing jsPDF renderer, not Playwright/Chromium.
- Browser PDF preview uses the browser PDF viewer in an iframe. PDF.js/react-pdf is not installed.
- Labels use the shared generation flow, but Avery grid layout rendering is not fully implemented.
- Save Draft, Save Template, Create Task, ZIP export, cover page, table of contents, and advanced PDF settings are exposed only where they have safe behavior or a clear in-progress notice.

## Data Model

Generated output is stored in `GeneratedLetter`:

- `templateId`
- `constituentId`
- `donationId`
- `campaignId`
- `eventId`
- `mergedPrintBody`
- `pdfUrl` placeholder field
- `metadataJson.pdfExport`
- `metadataJson.missingMergeFields`

This is the current generated-document record for Letters & Printables. A separate `GeneratedPrintable` table has not been added.
