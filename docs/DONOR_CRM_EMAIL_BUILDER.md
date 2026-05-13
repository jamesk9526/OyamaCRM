# DonorCRM Email Builder

Last updated: 2026-05-13

## Purpose

Document the current Email Builder implementation, workflow relationship to Communications, and known limits.

## Position In Engagement System

- Communications owns campaign lifecycle and send operations.
- Email Builder is the visual authoring/editor layer for one campaign draft.
- Builder should be launched from communications context, not treated as a disconnected product.

## Current UX Model

### Top-level structure

- Top bar with return path, save state, readiness label, and workflow stages:
  - Audience
  - Design
  - Personalize
  - Review
  - Schedule
- Draft-first status and save feedback in the top bar
- Three-panel body:
  - Block Library (search + donor-focused collapsible categories)
  - Canvas (desktop/mobile toggle + width label + block action toolbar)
  - Right-side inspector tabs (Block/Campaign/Personalize/Review/AI)

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
| AI full-template and block generation | Partially Working | Generates draft structures; quality and governance depend on prompting and review. |
| Saved sections library | Not Implemented | No persisted saved-sections registry yet. |
| Version history and restore | Not Implemented | No revision timeline yet. |
| Merge field validation before send | Partially Working | Merge tokens are available; strict pre-send validation is not fully centralized yet. |

## Safety Constraints

- Draft-first behavior is preserved.
- Broad sends still require explicit send/schedule actions in campaign workflows.
- Test-send path is available for review before production send.

## Known Limits

- Merge token handling is still mixed across template conventions.
- Full responsive mode controls and advanced section libraries are still pending.
- Provider-side render/lint and inbox previews are not integrated.

## Next Improvements

1. Add strict merge-field validation with actionable warnings before send.
2. Add reusable saved-sections library.
3. Add revision history with restore.
4. Add richer mobile-preview controls and consistency checks.
