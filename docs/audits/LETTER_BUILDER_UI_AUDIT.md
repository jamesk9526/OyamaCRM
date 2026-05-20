# Letter Builder UI Audit

Date: May 19, 2026

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

## Remaining Production Risks

- Version history is exposed as a planned workflow surface, not a fully wired version browser.
- Duplicate Template and Archive Template need backend persistence hardening before being considered complete production workflows.
- Font controls persist through inline TipTap HTML for edited selections; a future schema field should store document-level typography defaults.
- Drag-to-insert is not implemented. Click-to-insert is the supported first pass.

## Approved Journey

Donor CRM -> Communications -> Letters & Printables -> Select Template -> Compose -> Preview -> Save Draft or Publish.

Contextual links from donor, gift, campaign, or Steward workflows should open this same builder with preview context prefilled rather than creating a separate mini editor.
