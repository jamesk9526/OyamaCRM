# Responsive UI Audit

Last updated: 2026-05-14

## Purpose

This audit defines the acceptance bar for compact desktop and small laptop layouts across OyamaCRM.

Target widths:

- `1024x768`
- `1180x720`
- `1280x720`
- `1280x800`
- `1366x768`
- `1440x900`
- `1536x864`
- `768x1024`
- `390x844`

## What This Audit Checks

- No page-level horizontal overflow
- TopBar height remains intentional on compact desktop widths
- Sidebar collapses to compact behavior between `1024px` and `1439px`
- Workspace rails collapse behind a trigger below `1440px`
- Tables use contained horizontal scrolling instead of forcing page overflow
- Primary route surfaces remain reachable on laptop and tablet viewports

## Automation

Run:

```bash
pnpm test:e2e:responsive
```

Outputs:

- `docs/status/responsive-ui-audit.json`
- `docs/status/responsive-ui-audit.md`
- `docs/screenshots/responsive-ui/2026-05-14/*`

## Primary Routes

The current automated pass targets:

- `/`
- `/constituents`
- `/constituents/[id]`
- `/donations`
- `/communications`
- `/letters-printables`
- `/steward-signals`
- `/steward-paths`
- `/steward-paths/builder`
- `/reports`
- `/settings/system-status`
- `/webmaster/editor`
- `/webmaster/publishing`
- `/apps/trivia`

## Required Screenshot Set

The responsive screenshot pack should include:

- `dashboard-1366x768.png`
- `reports-1366x768.png`
- `communications-1280x720.png`
- `steward-signals-1366x768.png`
- `steward-paths-builder-1280x720.png`
- `webmaster-editor-1366x768.png`

## Current Pass Scope

The 2026-05-14 compact-laptop pass standardized shared shell behavior first:

- Drawer navigation below `1024px`
- Icon-only CRM sidebars for `1024px` through `1439px`
- Compact TopBar behavior for smaller desktop widths
- Workspace rails collapsing behind a drawer below `1440px`
- Shared shell `min-w-0` and contained overflow protections

Page-specific density and table refinements should continue to build on that shared shell baseline rather than reintroducing one-off layout patterns.
