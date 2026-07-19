# Letters and Email Workflow Simplification

Date: 2026-07-19

## Changes

- Reduced the normal Letters generation path from five visible stages to four: Setup, Recipients, Preview, and Generate.
- Preserved gift/donation context as an optional editor reachable from Setup instead of requiring it for every run.
- Recipient selection now proceeds directly to live merge and production PDF preview.
- Fixed a circular UI gate that required existing generated output before the Preview header could advance to Generate.
- Reduced preview to one primary Open Full PDF Preview action. Download and refresh remain under More Preview Options.
- Reduced generation to one primary Generate action, one mode-aware PDF action, and Continue to Queue. Validation, refresh, reopen, and new-run tools remain under Advanced Generation Tools.
- Added canonical Docs & Walkthroughs routes and sidebar tabs for OyamaLetters and OyamaEmail.
- Retained `/oyama-letters/how-to` as a compatibility redirect.
- Consolidated Email authoring into two primary modes: Design and Recipient Preview. Mobile/desktop widths and plain-text output are contained within the recipient preview rather than presented as competing top-level modes.
- Moved the editable plain-text override to the Compliance panel and added direct Docs access to the full-screen Email builder.
- Made Letters choose Single or Batch from the recipient count by default while preserving explicit route and staff overrides.

## Email verification

The focused email regression lane covers the canonical renderer, recipient merge preview, campaign workflow API, and workspace routes. It passed 40/40 tests across five files. These tests exercise opt-out/suppression-aware workflow behavior, preview rendering, template/workspace wiring, and campaign transitions without performing an uncontrolled production send.

## Validation

- Focused Letters/Email render, API, and source suite: 40/40 passed after the follow-up consolidation.
- Web and server TypeScript checks: passed.
- Targeted ESLint: 0 errors; 33 existing non-blocking warnings across the large Letters and Email workspaces.
- Production build: passed with all 200 routes generated, including both canonical docs routes.

## Visual QA limitation

The embedded in-app browser was unavailable, so live click-through and viewport screenshots could not be completed. Browser visual sign-off remains a separate release follow-up and is not claimed as complete.
