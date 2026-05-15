# OyamaWebMaster Rebuild Plan

Last updated: 2026-05-14

## Goal

Rebuild OyamaWebMaster as a real website command center inside OyamaCRM with safe lifecycle controls, modular site types, and publish readiness workflows.

## Scope Boundaries

- OyamaWebMaster remains a publishing and web-experience workspace.
- Donor, client, and event source records remain in their module systems of record.
- Cross-module links are metadata references, not ownership transfer.

## Delivery Phases

### Phase 1: Site Manager Foundation (Working)

- Persisted site manager fields added to `webmaster_sites` via additive schema checks:
  - `site_type`, `site_purpose`, `owner_id`, `connected_module`, `connected_record_id`
  - `launch_status`, `seo_health_score`, `publishing_target`
  - `launch_date`, `expires_at`, `archived_at`, `last_published_at`, `published_version_id`
- New API lifecycle routes:
  - `PATCH /api/webmaster/sites/:siteId`
  - `POST /api/webmaster/sites/:siteId/archive`
  - `POST /api/webmaster/sites/:siteId/restore`
  - `POST /api/webmaster/sites/:siteId/duplicate`
- Site list filter support:
  - `q`, `status`, `type`, `module`, `ownerId`
- Dashboard upgraded to a site-manager pattern with:
  - type tabs, search, lifecycle actions, and metadata visibility.

### Phase 2: Publishing Layer (Partially Working)

- Keep publish action review-first and explicit.
- Add pre-publish checks (missing SEO, missing domain, unpublished pages).
- Keep immutable version snapshot creation and rollback flows confirmation-gated.
- Add deployment target profile records and output adapters for external publishing.

### Phase 3: CRM Integration Layer (Partially Working)

- Add UI-level binding workflow for pages tied to module entities.
- Add permission-aware content blocks for donation/event/client resources.
- Add clear boundaries when content is embedded from another module.

### Phase 4: Safety and Recovery (Partially Working)

- Add backup/export snapshots before destructive changes.
- Add archive retention policy and reminder workflow.
- Add durable restore checks with dependency validation.

## Current Status

- Site manager metadata model: Working
- Archive/restore/duplicate lifecycle: Working
- Visual editor and page persistence: Partially Working
- Draft preview route: Working
- Publish readiness command center: Working
- Publish execution workflow: Working
- Rollback execution workflow: Working
- Template, CMS, assets/forms/settings/theme workspace depth: Partially Working
- External deployment target pipeline: Not Implemented

## Required Follow-up

1. Add deployment target profile persistence and management UI.
2. Add publish queue APIs and worker execution model for external adapters.
3. Expand preflight checks and launch readiness scoring detail.
4. Add environment-specific deployment target settings UI.
5. Add explicit backup and restore workflows in the dashboard.

## 2026-05-14 Implementation Snapshot

- `/webmaster/editor` is now the primary visual editor workspace route.
- `/webmaster/builder` and `/webmaster/page-builder` are compatibility redirects.
- `/webmaster/preview/[siteId]/[pageId]` is a real draft preview route.
- `/webmaster/publishing` is now a real readiness workspace.
- `GET /api/webmaster/sites/:siteId/publish-readiness` is implemented for preflight checks.
- Publish execution and rollback execution are implemented with immutable version snapshots and explicit confirmation.
- External deployment target adapters remain Not Implemented.
