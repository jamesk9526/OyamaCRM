# Letters and Email Output Audit — 2026-07-15

## Outcome

The canonical OyamaLetters and OyamaEmail workspaces remain the correct owners for outbound document and email workflows. This pass fixed the highest-impact formatting defect: lists could be authored but their markers and numbering were not reliably carried through previews, PDF output, sent email HTML, or plain-text email fallback.

## Audit Scope

- OyamaLetters canvas authoring, shared browser print view, server PDF parsing, layout, and proof rendering
- OyamaEmail Tiptap authoring, canonical server HTML renderer, two-column rich text, and plain-text fallback
- Existing readiness claims, partial-implementation records, and output-format regression coverage

## Findings and Disposition

| Finding | Before | Status | Fix or next action |
|---|---|---|---|
| Letter list markers in canvas and print preview | Tailwind/browser resets could hide `<ul>` and `<ol>` markers. | Working | Added explicit disc/decimal markers, padding, and item spacing in canvas, mini preview, and shared `LetterPage`. |
| Ordered-list PDF semantics | Every `<li>` rendered as a bullet; `<ol start>` was lost. | Working | PDF blocks now retain ordered state, index, and starting number. |
| Nested and wrapped PDF list layout | Nested depth was flattened and wrapped text was prefixed as one string. | Working | Added nested depth and a dedicated hanging-indent renderer; continuation lines align under item text. |
| Email builder list markers | Tiptap stored semantic lists, but editor CSS did not restore list styles. | Working | Added explicit list styles and list-item display in the canonical builder. |
| Sent email list reliability | Canonical server output depended on client CSS defaults. | Working | Added inline email-safe styles for paragraphs, headings, lists, list items, quotes, and links; columns use the same formatter. |
| Plain-text email lists | Tags were stripped, allowing items to collapse without markers. | Working | Added bullet/number markers, ordered starting-number support, newlines, and nested indentation. |
| Letter-to-email plain-text handoff | The HTML body survived, but its derived text treated every item as an unordered bullet. | Working | Letter plain-text conversion now retains unordered/ordered markers, starting numbers, and nested indentation. |
| Canvas page counter | UI always claimed `Page 1 of 1`. | Working | Replaced with truthful `Canvas preview`; final pagination is reviewed in generated PDF output. |
| PDF API status documentation | Partial audit still claimed the live endpoint returned HTTP 501. | Working | Updated PI-013 to match the active single/batch PDF endpoints and test evidence. |
| Exact browser-to-PDF typography | jsPDF still normalizes content into layout blocks. | Partially Working | Keep generated PDF proof as the final review gate; add inline text-run support or a Chromium renderer in a future fidelity phase. |
| Inbox-client rendering matrix | Server output is email-safe but not automatically screenshot-tested in Gmail/Outlook variants. | Partially Working | Add an inbox-client preview/test integration before claiming cross-client pixel parity. |
| Deferred explicit email audiences | Temporary/manual/list audiences cannot be safely queued or scheduled. | Partially Working | Persist an immutable audience snapshot before enabling deferred delivery; current immediate review/send gate remains correct. |
| Rich HTML sanitization | Event handlers/scripts are stripped with local normalization, not a full allowlist sanitizer. | Partially Working | Adopt a maintained server-side allowlist sanitizer and add hostile-markup tests in a separate security hardening pass. |

## Validation Evidence

- Focused Vitest and source-contract regression run: 4 files, 41 tests passed.
- Full Vitest run: 74/75 files and 645/646 tests passed under parallel load. The same pre-existing Compassion public-scheduling capacity test returned 404 instead of 409; it passed 8/8 immediately when run alone.
- `pnpm typecheck`: web and server passed.
- Targeted ESLint: 0 errors; 25 existing warnings in large workspace components.
- Render proof: one-page Letter PDF rendered to a 1224 × 1584 PNG with PyMuPDF and visually inspected. Bullet visibility, nested indentation, ordered numbering (`3`, `4`), wrapped hanging indent, header, body, signature text, and footer were clean.
- Poppler was not available in this environment, so PyMuPDF was used for the raster proof.

## Release Judgment

List and bullet formatting is `Working` for the audited authoring and output paths. Overall Letter browser/PDF fidelity and cross-client email pixel parity remain `Partially Working` for the reasons above; these limitations should stay visible in readiness documentation.
