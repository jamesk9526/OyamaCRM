# Letter print fidelity — 2026-09-08

## Findings and changes

- The builder counted manual breaks as planned pages and showed a fixed-height sheet with a scrollable body. This did not measure the server PDF's automatic pagination. Page counts now come from the actual PDF, and are invalidated after draft or recipient changes. The exact PDF is available inside the editor, with optional refresh after edits.
- The editable surface is now continuous, with fit-to-width and zoom controls. A4 uses its own width. This removes hidden overflow but does not make arbitrary editable HTML a paginated PDF layout engine.
- Editor margins previously allowed 2.5 inches while the renderer capped them at 1.5 inches. Both now clamp to 0.125–1.5 inches, with editable fractional values committed on blur.
- PDF parsing previously interpreted values such as `18px` line height as a unitless multiplier, which was then capped at 2.5. Pixel, point, percent, and em values now normalize against font size.
- Signature/fill estimates now use the text's font family, style, and explicit size. Table cells are measured in the font used to draw them.
- Figure alignment is retained; oversized images are bounded to the printable page area.
- Print actions in the builder, generator, and queue now open the original PDF rather than printing an HTML wrapper around an iframe.
- The expanded editor proof uses a native modal dialog for keyboard focus containment and Escape dismissal.

## Verification

- Focused letter renderer/layout/document/branding/source tests and direct-PDF-print regression tests.
- Web and server TypeScript checks; targeted ESLint (existing warning baseline retained).
- Isolated browser fixture using the actual `OyamaLettersWorkspace` component and production `renderGeneratedLetterPdf`, with synthetic recipients and in-memory template persistence. No live CRM data was changed by fixture interactions.
- Observed initial one-page PDF count, stale status after changes, automatic proof refresh, and eight-page output after entering long text. The editor body expanded to its full content height without an internal clipped region.
- Changed paper to A4 and left margin to 0.125 inches; confirmed the committed field value and resized canvas.
- Exercised fixture Save and expanded preview open/close. Inspected widths of 390, 768, 1280, and 1920 pixels; document scroll width stayed within the viewport.
- Generated and rasterized Letter, A4, explicit-break, long-flow, and CSS-line-height fixtures with PyMuPDF (Poppler was not installed). Inspected all 12 pages via a contact sheet and the one-page letter at full resolution. Counts were 1, 1, 2, 6, and 2 respectively. No page-edge clipping was visible.

## Remaining limitations

The live application login could not complete because local MySQL at `localhost:3306` was unavailable. Actual authenticated saves, recipient merging, batch generation, and print-queue state transitions require a database-backed regression pass. Synthetic fixture saves do not establish those behaviors.

The editable HTML canvas remains a continuous writing surface, not an exact paginated representation. The PDF proof is print-faithful for the recipient and draft used in that render. Different merged names, addresses, gifts, or externally updated branding can change pagination; refresh the proof and review batch outputs. No physical printer test was performed.
