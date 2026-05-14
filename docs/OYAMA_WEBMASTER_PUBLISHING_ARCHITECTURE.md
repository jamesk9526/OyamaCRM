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

4. Publish Layer (Planned)
- Publish request creates immutable version record.
- Target adapter renders output package.
- Deployment status updates progress and errors.

5. Rollback Layer (Planned)
- Restore previously published version by ID.
- Preserve full audit trail of rollback actions.

## Versioning Model (Planned)

Suggested table: `webmaster_publish_versions`

- `id`
- `organization_id`
- `site_id`
- `version_number`
- `status` (`PENDING`, `IN_PROGRESS`, `SUCCEEDED`, `FAILED`, `ROLLED_BACK`)
- `payload_json`
- `artifact_uri`
- `published_by_id`
- `created_at`
- `completed_at`

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
- Publish execution worker: Not Implemented
- Rollback controls: Not Implemented

## Current Route Surfaces

- `/webmaster/editor` and `/webmaster/editor?siteId=...&pageId=...`
- `/webmaster/preview/[siteId]/[pageId]?draft=1`
- `/webmaster/publishing`

Builder compatibility routes currently redirect to editor:

- `/webmaster/builder`
- `/webmaster/page-builder`
