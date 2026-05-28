move oyama letters into its own workspace that we use the workspace switcher for and let these mockups drive the design regurdless of design rules in this repo.   I looked at the repo. The right move is to turn the existing **Letters & Printables** area into a stronger standalone **OyamaLetters** workspace, because the README already lists a letters workflow inside DonorCRM communications, and the app structure already has `app/components/letters/` for the current letter workspace. ([GitHub](https://github.com/jamesk9526/OyamaCRM)) ([GitHub](https://github.com/jamesk9526/OyamaCRM))

The repo is Next.js 16, TypeScript, Tailwind CSS 4, Node/Express, MySQL, and Prisma, so this should be built as a real module that fits the current app shell, ribbon workflow, status docs, and test setup. ([GitHub](https://github.com/jamesk9526/OyamaCRM))

Here is the Copilot/agent instruction I would use:

```
# Build OyamaLetters — New Letter Template, Canvas Builder, Publish, and Generate Workspace

Audit the existing OyamaCRM repo first, especially `app/components/letters`, `app/components/communications`, the Email Builder, Contacts Manager audience flow, Steward Paths letter step type, server routes, Prisma schema, and the current Letters & Printables implementation. Do not create a disconnected demo. Replace or upgrade the current Letters & Printables workflow into a full first-class module called **OyamaLetters**, while preserving existing permissions, routing conventions, shell layout, shared UI primitives, status labels, and test patterns.

OyamaLetters must follow this exact user flow:

1. **Template Library**
2. **Canvas Letter Builder**
3. **Publish Workspace**
4. **Generate Canvas / Batch Output Workspace**

The user should not begin inside a blank editor. They should begin inside a professional editable template library, select or duplicate a template, move into a Microsoft Word-like canvas editor, then publish that template by configuring merge fields and PDF preview behavior, and finally move into a generation workspace where real recipient batches are generated, reviewed, exported, printed, mailed, or queued.

## Primary Goal

Create a new OyamaLetters experience that feels like a clean Microsoft Word / Canva-style letter builder inside OyamaCRM, but with nonprofit CRM data, donor merge fields, stewardship workflows, print queue controls, PDF preview, and batch generation.

This module should feel polished, calm, modern, and production-minded. It should use the OyamaCRM visual language: clean light workspace, green DonorCRM accent, ribbon-first commands, compact breadcrumb bar, cards, panels, soft borders, and strong empty/loading/error states.

## Required Workflow

### 1. Template Library

Create an editable and modifiable **OyamaLetters Template Library**.

This should be the default landing screen for OyamaLetters.

Features required:

- Template grid/list toggle.
- Categories:
  - Thank-you letters
  - Tax acknowledgment letters
  - Monthly donor letters
  - Pledge reminders
  - Campaign letters
  - Event follow-up letters
  - Client/resource letters if appropriate
  - Blank letter
- Template cards showing:
  - Template name
  - Category
  - Last edited date
  - Status: Draft / Published / Archived
  - Usage count
  - Preview thumbnail
  - Merge field count
- Actions:
  - Use template
  - Edit template
  - Duplicate
  - Rename
  - Archive
  - Delete only with confirmation
- Search and filters.
- “Create New Template” button.
- “Import Template” placeholder only if not implemented yet; if partial, mark clearly as partial in AGENTS.md and status docs.

When a user selects a template, they should be moved into the builder with that template loaded. The template library is not just a static picker; it must support editing, saving, duplicating, publishing, and version tracking.

### 2. Canvas Letter Builder

After a template is selected, open the **Canvas Builder**.

This should feel like Microsoft Word inside OyamaCRM, not like a form. Use a centered white page on a soft gray workspace background.

Required layout:

- Top ribbon with grouped tools:
  - File: Save, Save As, Duplicate, Rename
  - Insert: Merge Field, Signature, Logo, Image, Table, Page Break
  - Format: Font, Size, Bold, Italic, Underline, Alignment, Line Spacing
  - Layout: Margins, Page Size, Header/Footer, Letterhead
  - Review: Required Fields, Missing Tokens, Preview
  - Publish: Move to Publish Workspace
- Main canvas:
  - True page-like editor
  - 8.5x11 letter page by default
  - Optional margin guides
  - Header/footer support
  - Page break support
  - Print-safe width
- Right inspector:
  - Template settings
  - Merge field list
  - Selected block settings
  - Letter metadata
  - Validation warnings
- Left optional panel:
  - Saved sections/snippets
  - Letterhead blocks
  - Signature blocks
  - Reusable paragraphs
  - Donor acknowledgment language snippets

The builder must save a structured document model, not just unstructured HTML. Use a schema that can support rendering to HTML and PDF. At minimum store:

- `id`
- `name`
- `description`
- `category`
- `status`
- `pageSize`
- `margins`
- `contentJson`
- `contentHtml`
- `mergeFields`
- `requiredMergeFields`
- `createdBy`
- `updatedBy`
- `createdAt`
- `updatedAt`
- `publishedAt`
- `version`

The editor should support merge tokens such as:

- `{{constituent.firstName}}`
- `{{constituent.lastName}}`
- `{{constituent.fullName}}`
- `{{constituent.addressLine1}}`
- `{{constituent.city}}`
- `{{constituent.state}}`
- `{{constituent.postalCode}}`
- `{{donation.amount}}`
- `{{donation.date}}`
- `{{donation.designation}}`
- `{{campaign.name}}`
- `{{organization.name}}`
- `{{organization.address}}`
- `{{currentDate}}`

Add a merge field picker that inserts tokens at the cursor. It must include descriptions so staff understand what each field means.

### 3. Publish Workspace

After the user finishes editing the template, they should enter a **Publish Workspace**.

This is where the template is validated and prepared for real generation.

Required publish steps:

1. Template summary
2. Merge field handling
3. Missing data behavior
4. Recipient/source compatibility
5. PDF preview
6. Publish confirmation

Merge field handling must let the user choose:

- Required field
- Optional field
- Fallback text
- Hide line if empty
- Block generation if missing
- Highlight missing value in preview
- Use organization default if available

Example:

For `{{constituent.firstName}}`, allow fallback to “Friend”.
For address fields, allow “block generation if missing mailing address.”
For donation amount, allow “required for tax acknowledgment templates.”

The publish workspace should show:

- All detected merge fields
- Which entity each field comes from
- Required/optional status
- Fallback behavior
- Validation result
- Sample data preview
- PDF preview panel

Publishing should not generate letters yet. It only locks or marks a template as ready to generate. If the user edits a published template later, create a new draft version or require republishing.

### 4. Generate Canvas / Batch Output Workspace

After publishing, move to a **Generate Canvas** workspace.

This is where staff select recipients and create actual letter outputs.

Required generation flow:

1. Choose published template
2. Select recipients/audience
3. Choose data source
4. Preview merged letters
5. Generate PDFs
6. Send to print queue, mail queue, download, or save batch

Recipient sources:

- Individual constituent
- Saved Contacts Manager audience list
- Campaign donors
- Donation date range
- Donor segment/tag
- Manually selected constituents
- Future: event guests/sponsors where appropriate

Generation workspace should show:

- Recipient count
- Suppressed count
- Missing address count
- Missing required merge field count
- Preview selected recipient
- Previous/next recipient preview
- PDF preview
- Batch validation panel
- “Generate batch” action
- “Save as draft batch”
- “Send to print queue”
- “Download PDF”
- “Download ZIP of individual PDFs”
- “Create linked email draft” if existing letter-to-email handoff supports it

The generated batch should create real records with status lifecycle:

- Draft
- Needs Review
- Approved
- Generated
- Printed
- Mailed
- Archived
- Failed

Tie this into the existing print/mail queue system instead of creating a second queue.

## Data Model / Backend Requirements

Audit existing Prisma models before adding anything new. Reuse existing letter, queue, constituent, contact/audience, donation, campaign, and task models where possible. Add new models only where needed.

Suggested entities if missing:

- `LetterTemplate`
- `LetterTemplateVersion`
- `LetterMergeFieldRule`
- `LetterBatch`
- `LetterBatchRecipient`
- `GeneratedLetter`
- `LetterPdfExport`
- `LetterQueueItem`

Each generated letter must be traceable to:

- Template version
- Recipient
- Batch
- User who generated it
- Date generated
- Merge data snapshot
- PDF path/export reference if applicable
- Print/mail queue status

Do not make generated letters depend on live donor data after generation. Store a merge snapshot so old letters can be reproduced accurately.

## UI Requirements

Create a clean route structure, likely:

- `/letters`
- `/letters/templates`
- `/letters/templates/new`
- `/letters/templates/[id]/builder`
- `/letters/templates/[id]/publish`
- `/letters/generate`
- `/letters/batches`
- `/letters/batches/[id]`
- `/letters/queue`
- `/letters/settings`

Use the existing AppShell and DonorCRM navigation. Add OyamaLetters as a clear communication tool, but do not break the existing Communications workspace.

The top of the module should have a simple process indicator:

`Template Library → Canvas Builder → Publish → Generate`

The current active stage should be obvious. Users should always know where they are and what comes next.

## PDF Preview and Export

Implement a print-faithful preview. Use the existing PDF generation approach if already present. If PDF generation is partial, improve it rather than replacing it blindly.

Requirements:

- Preview one recipient.
- Preview missing merge fields.
- Show page boundaries.
- Support 8.5x11 letters.
- Support margins.
- Support headers/footers.
- Support page breaks.
- Generate single PDF.
- Generate batch PDF.
- Generate individual PDFs per recipient if feasible.
- Do not silently fail; show validation errors.

## Merge Field Validation

Build a central merge field registry.

Each merge field should include:

- Token
- Label
- Description
- Source entity
- Data path
- Type
- Example value
- Whether it can be required
- Whether it supports fallback text
- Whether it is safe for bulk generation

Create validation helpers:

- Detect tokens in template.
- Compare tokens to registry.
- Warn on unknown token.
- Warn when required data source is missing.
- Warn when selected audience cannot supply the field.
- Block publish or generation when required fields are missing.

## Steward Paths Integration

The repo already has Steward Paths with letter step support. Make OyamaLetters compatible with it.

A Steward Path letter step should be able to select:

- Published letter template
- Recipient source
- Delay timing
- Queue destination
- Review requirement
- Assigned staff user/task

Do not fully rebuild Steward Paths unless needed. Add integration points cleanly.

## Permissions

Respect existing permissions. Add or reuse permissions:

- `letters.view`
- `letters.create`
- `letters.edit`
- `letters.publish`
- `letters.generate`
- `letters.manage_print_queue`
- `letters.manage_mail_queue`
- `letters.delete`

Users without publish permission should be able to draft but not publish. Users without generate permission should not be able to create batches.

## Documentation and Status

Update:

- `AGENTS.md`
- `FEATURES.md`
- `docs/status/features.md`
- `docs/status/production-readiness-checklist.md`
- `docs/howto/HOW_TO_USE.md`
- Any donor CRM module documentation
- Help app articles if the help content system supports it

Clearly mark anything incomplete as:

- Working
- Partially Working
- Demo Only
- Not Implemented

Do not leave fake “working” claims. If something is only UI, mark it Demo Only or Partially Working.

## Testing

Add or update tests:

- Unit tests for merge field parser.
- Unit tests for merge field validation.
- Unit tests for fallback behavior.
- API tests for template CRUD.
- API tests for publish validation.
- API tests for batch generation.
- Smoke tests for `/letters`.
- Playwright test for:
  1. Open template library
  2. Create or select template
  3. Edit in canvas builder
  4. Insert merge field
  5. Publish template
  6. Select recipients
  7. Preview merged PDF
  8. Generate batch
  9. Confirm queue item exists

Run:

```bash
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm test:api
pnpm test:smoke
pnpm test:e2e
pnpm build
```
If any script name differs, inspect `package.json` and use the repo’s actual scripts.

## Visual Direction
OyamaLetters should feel like:

- Microsoft Word document canvas
- Canva-style template library
- OyamaCRM ribbon workspace
- Clean nonprofit office software
- Calm, professional, light theme
- Not cluttered
- Not a demo page
- Not a plain form builder

Design priorities:

- The page should feel printable.
- The canvas should feel real.
- Merge fields should be easy for non-technical staff.
- Staff should understand the difference between template editing, publishing, and generation.
- The workflow should be linear and hard to misuse.

## Acceptance Criteria
The work is complete only when:

- `/letters` opens a real OyamaLetters workspace.
- The first screen is a template library.
- A template can be selected and opened in a page-like builder.
- Merge fields can be inserted into the letter.
- The template can be validated and published.
- Published templates can be used to generate recipient-specific letters.
- Preview shows merged data.
- Missing data is clearly handled.
- Generated letters can enter the print/mail queue.
- Feature status docs are updated honestly.
- Tests are added or updated.
- No existing Communications, Email Builder, Contacts Manager, Steward Paths, or print queue behavior is broken.

```
The big architectural point: **Template Library is for reusable documents, Builder is for editing the document, Publish is for merge rules and validation, Generate is for real recipients and output.** That separation will keep staff from confusing “editing a template” with “generating donor letters.”
::contentReference[oaicite:3]{index=3}
```