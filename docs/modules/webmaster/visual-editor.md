# OyamaWebMaster Visual Editor

Last updated: 2026-05-14

## Goal

Provide a full-page visual website editor that feels like editing the final website, not editing raw content cards.

## Routes

- /webmaster/editor
- /webmaster/editor?siteId=...&pageId=...

Legacy compatibility:

- /webmaster/builder redirects to /webmaster/editor
- /webmaster/page-builder redirects to /webmaster/editor

## Layout

The editor uses a four-zone workspace:

- Top bar: site/page selectors, Save Draft, Preview Page, Open Publish Setup, device controls, undo/redo, status badges.
- Left rail: Pages, Add Section, Layers, Assets, Theme, Forms, SEO, Settings.
- Center canvas: live page renderer that mirrors visitor output.
- Right inspector: page/section/block settings for content and style edits.

## Visual Behavior

- Sections render as full website sections.
- Block outlines appear mainly on selection/edit state.
- Add-section controls appear between sections and at page end.
- Section move/duplicate/delete controls are exposed in a contextual mini-toolbar.
- Inline editing starts with text and button label editing in-canvas.

## Shared Renderer

Both editor and preview use:

- app/components/webmaster/rendering/WebmasterPageRenderer.tsx
- app/components/webmaster/rendering/WebmasterSectionRenderer.tsx
- app/components/webmaster/rendering/WebmasterBlockRenderer.tsx

This keeps draft edit output and preview output aligned.

## Current Status

- Visual editor workspace shell: Partially Working
- Inline text/button edit: Partially Working
- Advanced style/layout inspector matrix: Partially Working
- Asset/theme/forms rails: Partially Working
