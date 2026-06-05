# Letters & Printables Builder

Date: June 4, 2026

## Current Status

The canonical template editor is the dedicated OyamaLetters canvas workspace at `/oyama-letters/templates/[templateId]/builder`. The primary client component is `app/components/letters/OyamaLettersWorkspace.tsx`.

## Structure

- Top bar: file, insert, format, layout, review, view, and AI ribbons plus save, publish, preview, and live PDF actions.
- Left panel: template information, policy, reusable blocks, signatures, snippets, and merge fields.
- Center canvas: a centered editable letter sheet with organization header/footer rendering.
- Right inspector: document settings, merge fields, branding blocks, preflight, and block settings.
- Bottom status bar: page size, words, edit/preview state, and zoom.

## Variables

Variables use the current token format such as `{{donor.firstName}}`, `{{gift.amount}}`, and `{{organization.name}}`.

Supported insertion paths:

- Right Insert tab variable groups.
- Left panel `Variable` button.
- Typing `{{` in the editor.
- Slash commands such as `/donor-name`, `/gift-amount`, and `/organization-name`.

Legacy tokens remain detectable. The builder shows unsupported tokens and keeps the `Normalize Legacy Tokens` action available in merge health.

## Preview

Preview uses the saved template plus optional constituent, gift, and year context. The top `Preview` button opens a print-focused modal. The right Settings tab contains the `Test Preview` controls for selecting merge context and running preview.

## Publishing

Publish is confirmation-gated. Header and footer presets remain required for publishing. Signature blocks are optional; when selected, they must exist and be active. No email, print queue, mail queue, or send action happens automatically.

## Typography

The Format ribbon exposes print-safe font families, letter-friendly font sizes, and line-height options from single through double spacing. Formatting is serialized into the editor HTML and the server PDF parser preserves supported line-height metadata.

## Layout And PDF Whitespace

The Layout ribbon includes visible dividers, blank-line space, half-inch space, one-inch space, and `Push to Bottom`. Explicit spacer blocks and intentional blank paragraphs are preserved by the server PDF parser. `Push to Bottom` positions the remaining body and optional signature against the printable bottom area.

PDF plain-text cleanup limits extreme runs of blank lines but no longer collapses normal intentional multi-line spacing.

## Images And Signatures

Letter body images are uploaded to Letters media storage before insertion. Select an image in the canvas, then use `Block Settings -> Selected Image Size` to set its width from 10% through 100%. The selected width is preserved in generated PDFs.

Reusable signatures are managed in a modal visual builder from Branding Signatures. The builder supports drawing or uploading PNG, JPG, and WEBP signature images with a live rendered preview. Uploaded signature images render in server-generated PDFs. Selecting a signature preset attaches it to the template and renders it once at the end of the generated letter.

## Donation Selection Handoff

The Donations ledger supports selecting multiple donation rows and sending the unique donors to OyamaLetters as a session-scoped temporary recipient list. `Select Visible Monthly Donors` selects visible monthly recurring gifts. `Create Letters for Selected Donors` opens the canonical batch generation workspace, where staff choose the template and review recipients before generation.

## Testing

Focused source smoke coverage lives in `tests/smoke/letter-builder-ui-source.test.ts`. Core merge and print-layout tests live in `tests/unit/letters-merge.test.ts`, `tests/unit/letters-print-layout.test.ts`, and `tests/unit/letters-pdf-layout.test.ts`.

Recommended verification:

```bash
pnpm typecheck
pnpm exec vitest run tests/smoke/letter-builder-ui-source.test.ts
pnpm exec vitest run tests/unit/letters-merge.test.ts tests/unit/letters-print-layout.test.ts tests/unit/letters-pdf-layout.test.ts
```
