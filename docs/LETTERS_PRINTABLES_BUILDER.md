# Letters & Printables Builder

Date: May 19, 2026

## Current Status

The Donor CRM Letters & Printables template editor has been redesigned into a focused document workspace. The route remains `app/letters-printables/templates/[templateId]/page.tsx`, and the primary client component remains `LetterTemplateEditor`.

## Structure

- Top header: breadcrumb, editable title, save status, `Preview`, `Save Draft`, `Publish`, and More Options.
- Main tabs: `Compose`, `Test Recipients`, and `History`.
- Left panel: click-to-insert content blocks only.
- Center canvas: a centered white letter sheet with organization header/footer/signature rendering.
- Right panel: `Insert`, `Format`, `Page`, and `Settings`.
- Bottom status bar: words, characters, read time, save state, and merge health.

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

Publish is confirmation-gated. The publish button opens a confirmation modal before the user reaches generation workflows. No email, print queue, mail queue, or send action happens automatically.

## Typography

The Format tab exposes print-safe font families and letter-friendly font sizes. Font family, font size, line height, color, alignment, and inline marks are applied through TipTap commands and serialized into the editor HTML for selected text.

## Testing

Focused source smoke coverage lives in `tests/smoke/letter-builder-ui-source.test.ts`. Core merge and print-layout unit tests remain in `tests/unit/letters-merge.test.ts` and `tests/unit/letters-print-layout.test.ts`.

Recommended verification:

```bash
pnpm typecheck:web
pnpm exec vitest run tests/smoke/letter-builder-ui-source.test.ts
pnpm exec vitest run tests/unit/letters-merge.test.ts tests/unit/letters-print-layout.test.ts
```
