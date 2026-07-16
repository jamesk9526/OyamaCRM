# Letters and Email Production-Readiness Pass

Date: 2026-07-16

## Scope

Canonical OyamaEmail and OyamaLetters workflows, with emphasis on one-direction outbound review and recipient-facing letter PDF output.

## Findings and fixes

| Finding | Change | Status |
|---|---|---|
| Template Ready status could be set while required publish checks still failed. | The Publish action now blocks Ready status until required compliance checks pass and explains the required sequence. | Working |
| Test email used a native browser prompt without explaining its delivery scope. | Replaced it with an accessible in-workspace proof-send dialog that makes clear it sends only to the entered address. | Working |
| Block quotes were flattened into regular paragraphs in generated letters. | PDF parsing/rendering now preserves quotes as indented italic blocks with a subtle rule. | Working |
| Repeated header/footer text could disappear visually on a continuation page. | The PDF chrome renderer resets its text color immediately before each header/footer draw; a two-page proof was rendered and inspected. | Working |
| PDF output could choose the newest branding upload rather than the selected branding logo. | The PDF renderer now uses only `logoUrl`/`logoSquareUrl` from Branding Settings. Logo upload now selects and persists that asset immediately, without silently saving unrelated form edits. | Working |
| PDF output loaded template header/footer relations but ignored them. | Sample, production preview, individual export, and batch export now use the selected active preset, with the active organization default as a fallback. Shared Communication Header/Footer HTML is used when configured. | Working |
| Footer format differed between letter preview and recipient PDF. | PDF footer text is centered on every page, and appended signature blocks now receive deliberate spacing from the letter body. | Working |
| A duplicate automatic signature could add a blank second page when the body already ended with the signer name and title. | Signature detection now recognizes combined name/title lines and does not append a second image or text signature. | Working |
| PDF rendering silently created continuation pages for ordinary overflow. | Letter output now permits one page by default and returns a clear `LETTER_ONE_PAGE_LIMIT_EXCEEDED` response unless staff insert an intentional Page Break. Batch exports apply the same rule to every letter. | Working |
| Canvas could grow beyond its paper boundary without warning. | The canvas is fixed to its paper height, scrolls content inside that boundary, shows an overflow warning, and displays the number of author-requested pages. The server PDF remains the final pagination proof. | Working |
| Font family and size controls had no server-PDF equivalent. | The PDF parser now maps common serif/sans/monospace families and 8–28 pt font sizes for paragraphs, headings, quotes, and lists. | Working |

## Canonical staff paths

- Reusable email: Template Library -> Builder -> Save Draft -> Publish review -> Send proof -> Mark Ready.
- Live email: Campaign -> Audience -> Details -> Review -> Send -> Queue/history.
- Letters: Template Library -> Canvas Builder -> Publish review -> Generate Letters -> PDF review -> Print/Mail queue.

## Validation evidence

- Focused PDF-layout suite: 22 tests passed.
- `pnpm typecheck`: passed for web and server.
- `pnpm lint`: passed with existing repository warnings only; no errors.
- `pnpm build`: passed.
- `pnpm build:letters` and `pnpm build:server`: passed.
- Rendered PDF proof: a two-page sample with nested bullets, ordered-list starting numbers, a block quote, continuation-page chrome, and footer was rasterized and visually inspected.
- Composition proof: header, recipient/date block, subject, body, and footer were rasterized after the layout correction.
- Chrome proof: selected header/footer preset, centered footer, and appended signature rendered and were visually inspected.
- One-page proof: the supplied first-gift content was rendered to one PDF page, rasterized, and visually inspected; the closing appears once and the footer is centered.
- Full suite: 74/75 files and 648/649 tests passed under parallel load. The sole failure was the pre-existing Compassion public-scheduling test receiving a 404 rather than its expected conflict response; that same file passed 8/8 when rerun in isolation.

## Remaining gaps

- Exact mixed inline rich-text typography (mixed bold/italic/underline/color runs inside one line) is still not equivalent between the browser canvas and jsPDF block renderer.
- Automated screenshot verification in Gmail and Outlook is not configured. These are tracked as `Partially Working`; they do not bypass the implemented send-review or PDF-output gates.
