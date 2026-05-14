# OyamaWebMaster Publishing Architecture

Last updated: 2026-05-14

## Objective

Provide a review-first publishing layer for all CRM-connected website experiences without bypassing module permissions or data boundaries.

## Architecture Layers

1. Builder Layer
- Section-first editor and page persistence.
- Draft-first by default.

2. Site Manager Layer
- Site metadata, lifecycle status, and launch readiness.
- Archive/restore/duplicate safety controls.

3. Preflight Layer
- Required checks before publish:
  - at least one page exists
  - home page exists (`/`)
  - no required SEO fields missing for target pages
  - page paths pass validation
  - domain/target profile present when required
  - no archived-site publish attempt

4. Publish Layer (Partially Working)
- Publish request creates immutable version record.
- Draft pages are promoted to published status in CRM-owned storage.
- External deployment target adapters are still pending.

5. Rollback Layer (Partially Working)
- Restore previously published version by ID.
- Preserve full audit trail of rollback actions.
- Restored pages are persisted in CRM-owned storage; external host rollback adapters are still pending.

## Versioning Model

Implemented table: `webmaster_publish_versions`

- `id`
- `organization_id`
- `site_id`
- `version_label`
- `note`
- `rollback_from_version_id`
- `snapshot_json`
- `created_by_id`
- `created_at`

`webmaster_sites.published_version_id` should reference the active published version.

## Deployment Targets (Planned)

- Static artifact export
- Managed hosting target
- CRM-embedded hosted routes

Each target should be configured per organization and validated before publish.

## Current Implementation Status

- Site manager metadata and lifecycle APIs: Working
- Visual editor and draft preview routes: Partially Working
- Preflight endpoint (`GET /api/webmaster/sites/:siteId/publish-readiness`): Working
- Publishing workspace UI (`/webmaster/publishing`): Working
- Publish execution APIs (`POST /api/webmaster/sites/:siteId/publish`): Working
- Rollback APIs (`POST /api/webmaster/sites/:siteId/rollback`): Working
- External deployment adapters: Not Implemented

## Current Route Surfaces

- `/webmaster/editor` and `/webmaster/editor?siteId=...&pageId=...`
- `/webmaster/preview/[siteId]/[pageId]?draft=1`
- `/webmaster/publishing`

Builder compatibility routes currently redirect to editor:

- `/webmaster/builder`
- `/webmaster/page-builder`
