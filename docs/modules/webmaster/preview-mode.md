# OyamaWebMaster Preview Mode

Last updated: 2026-05-14

## Preview Routes

- /webmaster/preview/[siteId]/[pageId]
- /webmaster/preview/[siteId]/[pageId]?draft=1

## Preview UX

- Preview renders draft page output without editor chrome.
- Device toggles are available for desktop/tablet/mobile widths.
- Draft badge appears when draft=1 is used.

## Live Draft Refresh

Current mechanism:

- Editor posts a BroadcastChannel message after Save Draft.
- Preview listens on webmaster-preview channel.
- Matching site/page preview reloads draft content automatically.

This supports a basic "edit in one tab, preview in another" workflow.

## Safety

- Preview route does not expose editor controls.
- Preview does not depend on publish execution.
- Preview reads saved draft content.

## Current Status

- Draft preview route rendering: Working
- Save-to-preview update signal: Working
- Public unauthenticated preview publishing: Not Implemented
