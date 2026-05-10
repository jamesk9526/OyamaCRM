# OyamaWebMaster Status

Last updated: 2026-05-10

## Purpose

OyamaWebMaster is the website creation module for nonprofit teams to plan, build, and publish branded web experiences connected to OyamaCRM data.

## Current Scope (Implemented)

- Dedicated module route and shell:
  - `app/webmaster/layout.tsx`
  - `app/webmaster/page.tsx`
  - `app/webmaster/builder/page.tsx`
  - `app/webmaster/[workspace]/page.tsx`
  - `app/components/layout/WebmasterSidebar.tsx`
- Website-builder dashboard:
  - `app/components/webmaster/WebmasterStarterDashboard.tsx`
- Builder shell with section-first editing + save/load flow:
  - `app/components/webmaster/WebmasterBuilderShell.tsx`
- Explicit in-development warning workflows:
  - `app/components/webmaster/FeatureDevelopmentDialog.tsx`
  - `app/components/webmaster/WebmasterWorkspacePlaceholder.tsx`
- Persisted models:
  - `prisma/schema.prisma` models `WebmasterSite` and `WebmasterPage`
- Persisted API routes:
  - `server/src/routes/webmaster.ts`
  - mounted at `/api/webmaster`
- Canonical builder schema + modular boundaries:
  - `app/modules/webmaster/schema.ts`
  - `app/modules/webmaster/section-registry.ts`
  - `app/modules/webmaster/*`
- Implementation tracking:
  - `docs/IMPLEMENTATION_STATUS.md`
- Module discovery links integrated in launcher/navigation.

This now includes a real dashboard and a working visual builder shell with persisted page content. Advanced publishing/export/template/CMS flows are still in progress.

## Planned Functional Areas

- Nonprofit template library
- Drag-and-drop page/section builder
- Content blocks for campaigns, donations, and newsletters
- Domain and DNS management workflow
- Publishing approvals and rollback history
- SEO controls (meta, sitemap, redirects)

## Constraints

- No production website publishing pipeline is wired yet.
- No hosting/deploy integration is wired yet.

## Initial Product Boundaries

- Keep module isolated from DonorCRM and Compassion data unless explicitly linked.
- Respect role-based permissions before exposing publish actions.
- Start with one dashboard-oriented workflow, then progressively add builder capabilities.

## Next Steps

1. Expand template library into persisted full-site/page/section templates.
2. Add export pipeline (`oyama-site.json`, static ZIP, assets, sitemap, robots).
3. Add preflight checks and SEO/AEO rule engine.
4. Add publishing targets, history, and rollback snapshots.
5. Add CMS collections/forms/integrations with permission-aware workflows.
