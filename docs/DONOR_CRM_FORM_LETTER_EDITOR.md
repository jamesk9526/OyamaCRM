# DonorCRM Form Letter Editor

## Overview

The letters template editor now uses a TipTap-based rich editor for print-body and email-body authoring.

## Where It Is Used

- Template editor route: `/letters-printables/templates/[templateId]`
- New template route: `/letters-printables/templates/new`

## Key Features

- Rich formatting: headings, bold, italic, underline, lists, alignment.
- Links and inline image insertion.
- Table insertion and row/column controls.
- Page-break markers using `<hr data-page-break="true" />`.
- Optional raw HTML mode for advanced edits.
- Merge token insertion at cursor from merge-field panel.
- Print-ready in-editor preview shell for 8.5x11 layout checks.

## Integration Notes

- The editor syncs with existing `printBody` and `emailBody` template fields.
- Visual print builder mode remains available behind feature flag and stays backward-compatible.
- Preview tab now renders merged HTML rather than plain-text blocks.

## Status

Status: Working

The editor lane is operational for day-to-day template authoring.
