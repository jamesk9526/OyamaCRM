# OyamaWebMaster Data Safety

Last updated: 2026-05-14

## Safety Goals

- Prevent accidental site deletion and destructive overwrites.
- Preserve an auditable lifecycle for major site operations.
- Keep source CRM data boundaries intact.

## Implemented Safeguards

1. Soft archive lifecycle
- `POST /api/webmaster/sites/:siteId/archive`
- Sets `site_status=ARCHIVED` and `archived_at` timestamp.
- Leaves site/pages intact.

2. Restore lifecycle
- `POST /api/webmaster/sites/:siteId/restore`
- Moves archived sites back into draft workflow.

3. Safe duplicate workflow
- `POST /api/webmaster/sites/:siteId/duplicate`
- Clones site metadata and pages into a new draft site.
- Never mutates source site/pages.

4. Additive schema upgrades
- Store bootstrapping uses additive column checks in `ensureWebmasterSchema`.
- Existing environments are not forced through destructive migrations.

5. Audit logging
- Site create/update/archive/restore/duplicate actions log audit events.

6. Immutable publish snapshots and rollback history
- Publish and rollback flows persist immutable version snapshots in `webmaster_publish_versions`.
- Rollback actions are confirmation-gated and produce auditable version history.

## Risk Areas Still Open

- No formal backup snapshot API before high-risk changes.
- External deployment target rollback adapters are not implemented.
- No retention policy automation for temporary sites.

## Required Next Steps

1. Add snapshot export before archive/major metadata changes.
2. Add restore validation checks for linked module dependencies.
3. Add deployment-target rollback adapters and recovery checks for off-platform publish failures.
4. Add data retention and expiration worker for temporary sites.
5. Add monitoring for failed lifecycle operations.

## Operational Guidance

- Use archive instead of deletion.
- Duplicate before broad redesign work.
- Treat `connected_module` references as pointers, not data replication.
