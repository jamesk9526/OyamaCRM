# OyamaCRM design and engineering guide

## Primary design target

The user-supplied light blue DonorCRM reference is the authoritative visual target. Match its composition and proportions, not merely its palette. Implement the reference directly when older design conventions conflict with it.

- White/light-blue top bar with compact branding, centered search and right-aligned account/actions.
- Slim light sidebar with navy labels, line icons, blue selected state and grouped secondary tools.
- Horizontal donor tabs directly below the top bar.
- Full-width illustrated mountain/cloud/tree banner with a translucent greeting panel and actions on the right.
- Four summary cards immediately below the banner; giving trend and distribution charts next; compact operational cards below.
- Navy typography, vivid blue links/actions, pale blue-gray canvas, 8–10px card corners, quiet borders and subtle shadows.
- Avoid large blank gaps, duplicate navigation, stacked welcome banners and oversized promotional panels above dashboard data.
- Keep shared donor styling consistent across browse pages, detail pages, forms, reports and settings. Keep public documents and unrelated applications scoped separately.

## Implementation

Make normal in-scope changes without requesting permission. Refactor components and remove obsolete style rules when needed to match the reference. Preserve working routes and permission checks. Use real CRM data, meaningful loading/error/empty states and working actions; never copy the reference's sample numbers or invent controls. Keep existing capabilities discoverable in secondary sections when rearranging the dashboard.

Use reusable components in app/components and feature logic with its module. Preserve unrelated user changes. Keep tenant and user authorization enforced server-side. Keep outbound communications and high-impact writes reviewable and validated.

## Verification

Compare rendered desktop and mobile screens against the reference. Check density, alignment, text contrast, wrapping, navigation, and real interactions. Run focused type/lint/test checks. Report actual evidence and unresolved gaps honestly; do not claim pixel equivalence without a visual comparison.

Update docs/status/features.md and docs/status/production-readiness-checklist.md for material behavior changes. Store visual evidence under docs/status/audit-artifacts. Keep root Markdown limited to README.md, LICENSE.md and AGENTS.md. No destructive git operations without explicit authorization.
