# Letter Builder UI Audit

Date: May 27, 2026

## Scope

Audited `app/components/letters/LetterTemplateEditor.tsx` and `app/components/letters/FormLetterRichEditor.tsx` for duplicate controls, confusing tool placement, and production-readiness gaps in the Donor CRM Letters & Printables builder.

## Control Inventory

| Tool name | Current location before redesign | What it does | Decision | Reason | New location | Status |
|---|---|---|---|---|---|---|
| Save | Header, workspace ribbon | Persists template | Merge | Duplicate save paths created uncertainty | Single top action `Save Draft` | Done |
| Publish | Header, workspace ribbon, publish panel | Opens generation workflows | Move and gate | Publishing should require confirmation | Single top action `Publish` with confirmation modal | Done |
| Print Preview | Header, ribbon, preview areas | Runs merge preview and print modal | Merge | Repeated preview entry points | Single top action `Preview`, PDF/Print Test in More | Done |
| Convert to Email Draft | Header and publish card | Creates Communications draft | Move | Useful but secondary to print-letter creation | More Options menu | Done |
| Home/Insert/Mailings/Review tabs | Page toolbar | Swapped ribbon groups | Remove | Duplicated editor tabs and inflated the top area | Replaced by `Compose`, `Test Recipients`, `History` | Done |
| Editor Home/Insert/Layout/Table/Review tabs | Inside TipTap editor | Formatting and insertion | Remove | Created nested toolbar rows | Floating command bar, slash menu, side panels | Done |
| Icon ribbon | Inside TipTap editor | Formatting, table, media, blocks | Move | Useful commands but too visually dense | Floating command bar and right Format tab | Done |
| Subject | Left project panel | Template subject | Move | Metadata should not compete with writing | Right Settings tab | Done |
| Category | Left project panel | Template classification | Move | Metadata should not live in insert rail | Right Settings tab | Done |
| Status | Left project panel | Draft/active/archive state | Move | Metadata should be in settings | Right Settings tab | Done |
| Internal notes | Left project panel | Staff-only notes | Move | Secondary configuration | Right Settings tab | Done |
| Header preset | Left project panel | Letterhead preset | Move | Page setup concern | Right Page tab | Done |
| Footer preset | Left project panel | Footer preset | Move | Page setup concern | Right Page tab | Done |
| Signature preset | Left project panel | Signer block | Move | Page setup concern | Right Page tab | Done |
| Merge fields | Left project panel | Inserts variables | Move | Left panel should be block insertion first | Right Insert tab and compact variable insert button | Done |
| Merge health | Right sidebar | Shows unsupported fields | Keep | Important production guardrail | Right sidebar status card and bottom status | Done |
| Preview context | Right sidebar and preview panel | Selects constituent/gift/year | Move | Should be collapsible/secondary | Right Settings tab, `Test Preview` section | Done |
| Font family | Missing/limited | Applies print-safe typeface | Add | Required for production letter typography | Right Format tab, TipTap `FontFamily` extension | Done |
| Font size | Missing/limited | Applies print font size | Add | Required for print fidelity | Right Format tab, TipTap `FontSize` extension | Done |
| Slash commands | Missing | Inserts blocks/tokens from `/` | Add | Reduces visible toolbar clutter | Editor inline command menu | Done |
| AI Write | Not focused in builder | Drafting assistance | Add as controlled prompt | Should not dominate or auto-apply actions | Floating command bar and `/ai-write` | Done |
| OyamaLetters Generate Center | Separate single/batch page | Select real records, preview merge, generate PDF | Replace | Letter, receipt, label, and batch workflows need one production center | `/oyama-letters/generate` three-column workspace | Done |
| PDF Preview | Download-first PDF export | Streams generated PDF bytes | Move into workspace | Staff need to inspect final generated PDF before download/print | Center `PDF Preview` mode using generated blob | Done |
| Missing merge fields | Silent blanks for supported empty fields | Highlights missing values | Add guardrail | Prevents accidental blank donor-facing letters | Merge status rail and highlighted preview marks | Done |

## Remaining Production Risks

- Version history is exposed as a planned workflow surface, not a fully wired version browser.
- Duplicate Template and Archive Template need backend persistence hardening before being considered complete production workflows.
- Font controls persist through inline TipTap HTML for edited selections; a future schema field should store document-level typography defaults.
- Drag-to-insert is not implemented. Click-to-insert is the supported first pass.
- PDF rendering uses the existing jsPDF/plain-text renderer. Chromium-grade HTML/CSS PDF fidelity remains a production risk.
- Avery label grids, ZIP export, cover pages, table of contents, and Create Task handoff need follow-up implementation before they should be considered complete.

## Approved Journey

Donor CRM -> Communications -> Letters & Printables -> Select Template -> Compose -> Preview -> Save Draft or Publish.

Contextual links from donor, gift, campaign, or Steward workflows should open this same builder with preview context prefilled rather than creating a separate mini editor.

Generated output should open `/oyama-letters/generate` for production actions. `/letters-printables`, `/letters-printables/generate`, `/communications/letters-printables`, and `/communications/letters-printables/generate` are compatibility redirects to the canonical routes.

## 2026-07-15 Output Formatting Addendum

- Canvas, mini-preview, and shared print-page list styles now explicitly restore bullet and decimal markers after CSS resets.
- The server PDF parser distinguishes unordered and ordered lists, honors ordered starting values, carries nested depth, and renders wrapped items with hanging indentation.
- Plain-text handoffs retain bullet/number markers and nested indentation, including Letter-to-OyamaEmail draft copy.
- The fixed `Page 1 of 1` canvas label was removed because generated PDF proof is the authoritative pagination surface.
- Exact mixed inline typography remains a jsPDF fidelity limitation and is tracked as `Partially Working` in the dated output audit.

Evidence: `docs/status/audit-artifacts/2026-07-15-letters-email-output-audit.md`.

## 2026-07-16 Production-Readiness Addendum

- Block quotes are preserved as a distinct PDF block, rendered with an italic treatment, readable indentation, and a restrained left rule.
- Repeated letter header/footer chrome is explicitly reset for every rendered page and was checked in a two-page raster proof.
- Final generated output intentionally remains free of operational `Page X of Y` labels; the letter itself is the recipient-facing artifact, while pagination is reviewed in the PDF preview.

Evidence: `docs/status/audit-artifacts/2026-07-16-letters-email-production-readiness-pass.md`.
