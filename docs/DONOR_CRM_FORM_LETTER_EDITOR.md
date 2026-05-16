# DonorCRM Printable Document Studio

## Overview

The printable editor now uses a document-studio layout for print-body authoring. The route feels like a compact document editor: project controls, paper canvas, merge tools, preview context, and publish actions are in one workspace.

## Where It Is Used

- Template editor route: `/letters-printables/templates/[templateId]`
- New template route: `/letters-printables/templates/new`

## Key Features

- Rich formatting: headings, bold, italic, underline, lists, alignment.
- Links and inline image insertion.
- Local image upload through the letters media endpoint.
- Table insertion and row/column controls.
- Page-break markers using `<hr data-page-break="true" />`.
- Optional raw HTML mode for advanced edits.
- Merge token insertion at cursor from the merge-field panel.
- Inline merge suggestions when the author types `{{`.
- Styled content block inserts for donor address, gift table, callout, and signature sections.
- Print-ready 8.5x11 paper canvas with organization branding preview.
- Searchable constituent and donation lookup for merged preview context.
- Header and footer preset creation from the studio, with organization branding still sourced from Branding Settings.
- Full-screen editing in a new browser tab via `?fullscreen=1`.

## Integration Notes

- The editor syncs with the existing `printBody` template field and keeps `printLayoutJson` compatible for existing records.
- Preview renders merged HTML in the same paper shell used by the authoring canvas.
- Publish saves first, then opens the existing generation/routing workflow.

## Status

Status: Working

The editor lane is operational for day-to-day template authoring.
