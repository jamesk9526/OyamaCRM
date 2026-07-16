# PDF Generation

Last updated: July 15, 2026

## Current Pipeline

1. User selects a real template and real CRM record source in `/letters-printables/generate`.
2. Server resolves merge fields with `resolveLetterMergeContext`.
3. Server stores generated output in `GeneratedLetter`.
4. Server renders PDF bytes through the existing jsPDF renderer in `server/src/routes/letters.ts`.
5. Browser receives the PDF blob and renders it in an iframe for in-browser preview.
6. User can download, open/print, or mark generated documents printed.

Endpoints:

- `POST /api/letters/generated/:id/export-pdf?preview=1`
- `POST /api/letters/generated/export-pdf-batch?preview=1`

Both stream real `application/pdf` bytes. `preview=1` sets `Content-Disposition: inline`.

## Stored Metadata

PDF export status is stored in `GeneratedLetter.metadataJson.pdfExport`:

- `lastStatus`
- `lastError`
- `lastExportedAt`
- `updatedByUserId`

## Limitations

- Current server renderer is jsPDF, not Playwright/Chromium.
- The block parser preserves headings, paragraphs, spacing, dividers, semantic bullet/numbered lists, nested list indentation, basic tables, alignment, uploaded images, and signatures.
- Exact browser CSS and mixed inline typography such as bold/italic/color runs are not fully preserved because jsPDF receives normalized layout blocks rather than a browser render tree.
- Advanced tables, Avery labels, cover pages, and table of contents need a dedicated layout implementation or Chromium renderer before they can be considered production-complete.
- Browser preview uses native PDF rendering, not PDF.js/react-pdf.

## Next Tasks

- Add Playwright/Chromium PDF rendering with jsPDF fallback.
- Persist generated PDF files and populate `GeneratedLetter.pdfUrl`.
- Add Avery label layout renderer.
- Add page count extraction and persisted `recipientCount/pageCount` metadata.
