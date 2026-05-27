# Printable Template Builder

Last updated: May 27, 2026

## Canonical Journey

Donor CRM -> Communications -> Letters & Printables -> Select Template -> Compose -> Preview -> Save Draft or Publish -> Generate Printables.

Builder route:

- `/letters-printables/templates/[templateId]`

Generation route:

- `/letters-printables/generate`

## Implemented Builder Blocks

- Text blocks
- Headings
- Divider lines
- Spacer blocks
- Merge fields
- Header presets
- Footer presets
- Signature blocks
- Uploaded editor/signature images through `/api/letters/media`

## Generation Integration

The Generate Printables workspace reads persisted templates and resolves fields server-side. It does not use fake preview data.

Template cards show:

- Template name
- Type/category
- Last edited date
- Created by
- Draft/Active/Archived status

## Partial

- Donation tables and receipt summary blocks are still represented by template HTML rather than first-class structured blocks.
- Avery label presets are listed as a product requirement but need a dedicated renderer.
- Drag-to-insert is not implemented; click/copy/insert is the supported workflow.
- Template-level page setup exists through presets, but advanced PDF settings do not fully alter server PDF output yet.
