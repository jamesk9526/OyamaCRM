# DonorCRM Email Builder

Last updated: 2026-05-26

## Purpose

Document the current Email Builder implementation, workflow relationship to Communications, and known limits.

## Position In Engagement System

- Communications owns campaign lifecycle and send operations.
- Email Builder is the visual authoring/editor layer for one campaign draft.
- The canonical workflow is Communications -> Campaign Library -> select/create email project -> `/communications/[campaignId]` -> Build/Preview/Send/Activity tabs.
- `/communications` opens directly to the Campaign Library; overview/project-picker cards are not the primary entry point.
- `/email-builder?campaign=...` remains available for compatibility, but user-facing navigation should open `/communications/[campaignId]?mode=build`.
- Builder should stay inside communications context, not be treated as a disconnected product.

## Communications Project Library

- Email campaigns are shown as projects with a rendered thumbnail preview.
- Staff can switch between regular cards, small cards, and a dense list view.
- Project actions open the same campaign workspace for build, preview, send, and activity management.

## Current UX Model

### Top-level structure

- Top bar with return path, save state, readiness label, and workflow stages:
  - Audience
  - Design
  - Personalize
  - Review
  - Schedule
- Draft-first status and save feedback in the top bar
- Mockup-inspired studio chrome with a compact breadcrumb/action bar, status strip, lighter canvas workspace, tile-based block library, and simplified inspector tabs.
- Three-panel body:
  - Block Library (search + donor-focused collapsible categories + two-column draggable block tiles)
  - Canvas (light preview workspace + desktop/mobile toggle + width label + block action toolbar)
  - Right-side inspector tabs (Block/Campaign/Personalize/Review/AI) styled as compact top tabs

### Blocks currently supported

- Text
- Quote
- Impact stat
- Impact story
- Impact grid
- Campaign progress
- Impact timeline
- What Your Support Funds
- Donor Thank-You
- Donation Receipt Summary
- Giving Summary
- Donation CTA
- Monthly Donor Invitation
- Lapsed Donor Re-Engagement
- First-Time Donor Welcome
- Staff Signature
- Footer Compliance
- Image
- Video
- Button
- AI text
- AI button
- Divider
- Spacer
- Social
- Columns

## Current Feature Status

| Feature | Status | Notes |
|---|---|---|
| Drag/drop block editing | Working | DnD canvas is active and persisted in template JSON. |
| Save draft to campaign | Working | PUT /api/email-campaigns/:id persists bodyHtml/bodyText/templateJson and preparation status. |
| Subject/preview metadata editing | Working | Added metadata strip in this pass and persists via save payload. |
| Send test from builder | Working | Added send-test action in this pass using /api/email-campaigns/:id/send-test. |
| Plain-text fallback visibility | Working | Builder surfaces plain-text fallback preview generated from current template. |
| Review checklist tab | Working | Review tab now checks subject, preview text, footer presence, unsubscribe path, image alt text, button URLs, and test-send confirmation. |
| Donor-specific stewardship blocks | Working | Donor and giving block set added with editor controls, canvas rendering, and HTML/plain-text output support. |
| Block Library search and categories | Working | Block Library now supports search and nonprofit-specific collapsible categories. |
| Rich-text formatting round-trip | Working | Text and AI text blocks now preserve H1/H2/H3, lists, quotes, and links through save/output flows with email-safe inline styles in generated HTML. |
| AI full-template and block generation | Partially Working | Generates draft structures; quality and governance depend on prompting and review. |
| Saved sections library | Not Implemented | No persisted saved-sections registry yet. |
| Version history and restore | Not Implemented | No revision timeline yet. |
| Merge field validation before send | Working | Review tab now enforces recognized merge-token checks and malformed brace detection with actionable warnings. |
| Campaign workspace embedded builder | Working | `/communications/[campaignId]?mode=build` embeds EmailBuilderApp alongside Preview, Send, and Activity tabs. |
| Email project preview cards | Working | Communications campaign library supports rendered thumbnails, card view, small-card view, and list view. |
| Branding settings enforcement | Working | New campaigns seed sender identity from CRM Branding Settings; builder save applies current CRM branding to template-level settings and brandable block accents. |
| Unsaved-change protection | Working | Builder now warns on browser/tab close when unsaved edits exist (`beforeunload` guard). |
| Desktop review navigation clarity | Working | Builder header now includes a direct “Review Checklist” action to reduce route/tool confusion before send-stage handoff. |
| Mockup-inspired editor chrome | Working | Builder shell, block palette, canvas, and inspector were refreshed to better match a modern three-panel email studio while preserving save/preview/test/drag-drop behavior. |

## Safety Constraints

- Draft-first behavior is preserved.
- Broad sends still require explicit send/schedule actions in campaign workflows.
- Test-send path is available for review before production send.
- Sender identity, email layout defaults, logo usage, and brandable colors should come from Settings -> Branding.

## Known Limits

- Merge token handling is still mixed across template conventions.
- Campaigns that never stored `templateJson` still need a dedicated migration path back into fully structured blocks.
- Full responsive mode controls and advanced section libraries are still pending.
- Provider-side render/lint and inbox previews are not integrated.

## Next Improvements

1. Add reusable saved-sections library.
2. Add revision history with restore.
3. Add richer mobile-preview controls and consistency checks.
4. Add provider-side render/lint and inbox preview integration.
