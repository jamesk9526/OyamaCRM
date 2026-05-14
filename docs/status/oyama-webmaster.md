# OyamaWebMaster Status

Last updated: 2026-05-14

## Purpose

OyamaWebMaster is the website creation module for nonprofit teams to plan, build, and publish branded web experiences connected to OyamaCRM data.

## Current Scope (Implemented)

- Dedicated module route and shell:
  - `app/webmaster/layout.tsx`
  - `app/webmaster/page.tsx`
  - `app/webmaster/builder/page.tsx`
  - `app/webmaster/editor/page.tsx`
  - `app/webmaster/preview/[siteId]/[pageId]/page.tsx`
  - `app/webmaster/publishing/page.tsx`
  - `app/webmaster/[workspace]/page.tsx`
  - `app/components/layout/WebmasterSidebar.tsx`
- Website-builder dashboard:
  - `app/components/webmaster/WebmasterStarterDashboard.tsx`
- Builder shell with section-first editing + save/load flow:
  - `app/components/webmaster/WebmasterBuilderShell.tsx`
- Full visual editor workspace with page-first canvas:
  - `app/components/webmaster/editor/WebmasterEditorWorkspace.tsx`
  - `app/components/webmaster/editor/WebmasterEditorCanvas.tsx`
  - `app/components/webmaster/editor/WebmasterEditorTopBar.tsx`
  - `app/components/webmaster/editor/WebmasterEditorLeftRail.tsx`
  - `app/components/webmaster/editor/WebmasterEditorInspector.tsx`
- Shared rendering pipeline for editor + preview:
  - `app/components/webmaster/rendering/WebmasterPageRenderer.tsx`
  - `app/components/webmaster/rendering/WebmasterSectionRenderer.tsx`
  - `app/components/webmaster/rendering/WebmasterBlockRenderer.tsx`
- Draft preview route surface:
  - `app/components/webmaster/WebmasterDraftPreviewPage.tsx`
- Publishing command-center workspace:
  - `app/components/webmaster/WebmasterPublishingWorkspace.tsx`
- Explicit in-development warning workflows:
  - `app/components/webmaster/FeatureDevelopmentDialog.tsx`
  - `app/components/webmaster/WebmasterWorkspacePlaceholder.tsx`
- Persisted models:
  - `prisma/schema.prisma` models `WebmasterSite` and `WebmasterPage`
- Persisted API routes:
  - `server/src/routes/webmaster.ts`
  - mounted at `/api/webmaster`
  - includes `GET /api/webmaster/sites/:siteId/publish-readiness`
- Canonical builder schema + modular boundaries:
  - `app/modules/webmaster/schema.ts`
  - `app/modules/webmaster/section-registry.ts`
  - `app/modules/webmaster/*`
- Implementation tracking:
  - `docs/IMPLEMENTATION_STATUS.md`
- Module discovery links integrated in launcher/navigation.

This now includes a real dashboard, a full-tab visual editor workspace, a draft preview route, and a publish-readiness workspace. Publish execution and rollback execution remain not implemented.

## Planned Functional Areas

- Nonprofit template library
- Drag-and-drop page/section builder
- Content blocks for campaigns, donations, and newsletters
- Domain and DNS management workflow
- Publishing approvals and rollback history
- SEO controls (meta, sitemap, redirects)

## Constraints

- Publish execution worker is not implemented.
- Rollback execution is not implemented.
- Hosting/deploy adapters are not implemented.

## Initial Product Boundaries

- Keep module isolated from DonorCRM and Compassion data unless explicitly linked.
- Respect role-based permissions before exposing publish actions.
- Start with one dashboard-oriented workflow, then progressively add builder capabilities.

## Next Steps

1. Add immutable publish version persistence and history timeline.
2. Wire publish execution adapters and queued deployment execution.
3. Implement rollback execution with audit-backed safety checks.
4. Expand template/CMS/forms/assets workspaces to production depth.
5. Add export pipeline (`oyama-site.json`, static ZIP, assets, sitemap, robots).

## Status Snapshot

- Visual Editor Workspace: Partially Working
- Draft Preview Route: Working
- Publishing Readiness Workspace: Working
- Publish Execution: Not Implemented
- Rollback Execution: Not Implemented
