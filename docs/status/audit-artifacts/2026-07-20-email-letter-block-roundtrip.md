# Email and Letter Block Round-Trip — 2026-07-20

## Implemented

- Replaced the Email builder's legacy `leftHtml` / `rightHtml`-only columns with two persisted block stacks.
- Added all Email block types to column insertion, including images, CTAs, video thumbnails, social links, file links, HTML, and nested grids.
- Updated the server renderer to render structured child blocks for preview, proof, and campaign send output while accepting legacy HTML columns for existing templates.
- Added a draft-only Email → Letter companion endpoint. The generated Letter includes print/email fallback content and stores the complete email document/settings in a round-trip envelope.
- Added a Letter → Email companion endpoint. It restores the original structured email document when one is present; otherwise it creates a reusable reviewable Email template from the Letter body.

## Safeguards

- Companion actions create drafts only; no email is sent and no letter is published or queued.
- Source documents remain organization-scoped and the cross-workspace routes require their existing communications and Letter permissions.
- Nested grid rendering is capped at three levels to keep HTML reliable across inbox clients.

## Validation

- `pnpm exec vitest run tests/unit/oyama-email-render-service.test.ts tests/smoke/oyama-email-workspace-source.test.ts tests/smoke/letter-builder-ui-source.test.ts` — passed 31/31.
- `pnpm typecheck` — passed for web and server.
