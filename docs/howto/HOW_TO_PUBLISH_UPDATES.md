# OyamaCRM How To Publish Updates

Last updated: 2026-05-15

## Purpose

This runbook explains how to publish safe, intentional OyamaCRM updates using tagged GitHub releases and an admin-triggered server update flow.

This guide is for maintainers and super admins. Do not use this process for day-to-day office operations.

## Scope

- Web/server deployment model: Next.js web + API process manager (PM2)
- Release source: GitHub tags and GitHub Releases
- Update execution: admin-triggered backend job (not direct shell from browser)
- Safety model: backup -> update -> migrate -> restart -> smoke test -> rollback if needed

## Core Rules

1. Only super admins can trigger updates.
2. Only approved semver tags are installable (example: `v0.4.3`).
3. Never run arbitrary shell commands from UI input.
4. Never update production from `main` directly.
5. Always create a database backup before migration.
6. Always keep one known-good rollback target.
7. Log every update attempt with actor, version, status, and timestamps.
8. Keep secrets server-side only (GitHub token, DB credentials).

## Recommended Product Surface

Route suggestion:

- `Settings -> System -> Updates`

Suggested sections:

- Current version
- Latest available release
- Release notes
- Update status
- Backup status
- Migration status
- Smoke test status
- Rollback action
- Update history

## Architecture (Safe Update Manager)

### UI Layer

- Super-admin-only page at `Settings -> System -> Updates`
- Button: `Install Update`
- Button: `Rollback`
- Read-only status timeline

### API Layer

Protected endpoints (examples):

- `GET /api/system-updates/status`
- `GET /api/system-updates/releases`
- `POST /api/system-updates/install`
- `POST /api/system-updates/rollback`
- `GET /api/system-updates/history`

Security requirements:

- Role check: super admin only
- CSRF/session protection
- Version allow-list validation (`^v[0-9]+\.[0-9]+\.[0-9]+(?:-[A-Za-z0-9.-]+)?$`)
- Server-side command templates only (no freeform command fields)

### Worker/Script Layer

The update endpoint should enqueue a server-side job that:

1. Enables maintenance mode.
2. Creates DB backup and app backup.
3. Downloads approved release artifact.
4. Installs dependencies in release directory.
5. Builds web/server artifacts.
6. Runs migrations.
7. Performs atomic release switch.
8. Restarts PM2 processes.
9. Runs smoke test.
10. Clears maintenance mode.
11. Marks update success in history.

If any step fails, rollback to previous release and record failure details.

## Publishing Flow (Maintainer)

### Windows GUI publisher option (Tkinter)

Use the desktop tool when you want guided version bump + package creation:

- Launcher: `easy_prep_tools/launch_release_publish_gui.bat`
- GUI script: `easy_prep_tools/release_publish_gui.py`

What it does:

1. Reads current version from `package.json`.
2. Auto-computes the next version (patch/minor/major/prerelease).
3. Updates `package.json`.
4. Optionally runs typecheck/build validation commands.
5. Creates a release zip and manifest under `release_packages/`.

Environment-file safety:

- The zip **always excludes** `.env` and `.env.*` files.
- The zip excludes `server/.data/*` runtime state.
- This prevents package uploads from overwriting server-side secret env files.

### 1) Prepare release branch and tag

1. Ensure required checks pass in CI.
2. Merge to release target branch.
3. Bump version in `package.json`.
4. Create annotated tag:

```bash
git tag -a v0.4.3 -m "OyamaCRM v0.4.3"
git push origin v0.4.3
```

### 2) Create GitHub Release

1. Open repository Releases.
2. Draft a release from tag `v0.4.3`.
3. Add release notes:
- Added/fixed areas
- Migration notes
- Backward compatibility notes
- Rollback caveats
4. Attach build artifact(s) if you publish artifacts.
5. Mark as latest stable release.

### 3) Verify release metadata consumed by updater

Updater should parse:

- version/tag
- publish date
- release notes body
- artifact URL or tarball URL
- checksum (recommended)

## Install Update Flow (Super Admin)

From `Settings -> System -> Updates`:

1. Confirm current version and latest stable release.
2. Confirm latest backup timestamp.
3. Click `Install Update`.
4. Confirm modal with version and impact warning.
5. Monitor status timeline until complete.

Expected status sequence:

- queued
- maintenance_enabled
- backup_complete
- release_downloaded
- dependencies_installed
- build_complete
- migrations_complete
- process_restarted
- smoke_passed
- completed

## Rollback Flow (Super Admin)

Use rollback when install fails or smoke checks fail.

1. Open `Settings -> System -> Updates`.
2. Select last known-good release.
3. Click `Rollback`.
4. Confirm rollback modal.
5. Verify app health and key workflows.

Expected rollback sequence:

- maintenance_enabled
- previous_release_restored
- database_restored (if needed)
- process_restarted
- smoke_passed
- rollback_completed

## Example Linux Update Script (Concept)

Use this as a baseline and harden for your environment.

```bash
#!/usr/bin/env bash
set -euo pipefail

APP_ROOT="/var/www/oyama-crm"
RELEASES_DIR="/var/www/oyama-releases"
BACKUP_DIR="/var/backups/oyama"
CURRENT_LINK="$APP_ROOT/current"
VERSION="$1"
TIMESTAMP="$(date +%F-%H%M%S)"
NEW_RELEASE_DIR="$RELEASES_DIR/$VERSION"
PREV_RELEASE_DIR="$(readlink -f "$CURRENT_LINK")"

if [[ ! "$VERSION" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[A-Za-z0-9.-]+)?$ ]]; then
  echo "Invalid version tag: $VERSION"
  exit 1
fi

mkdir -p "$RELEASES_DIR" "$BACKUP_DIR"

echo "[1/10] Enable maintenance mode"
touch "$APP_ROOT/maintenance.flag"

cleanup() {
  rm -f "$APP_ROOT/maintenance.flag"
}
trap cleanup EXIT

rollback() {
  echo "Rollback started"
  ln -sfn "$PREV_RELEASE_DIR" "$CURRENT_LINK"
  pm2 restart oyama-crm-web oyama-crm-api
  echo "Rollback completed"
}

echo "[2/10] Backup database"
pg_dump oyama_crm > "$BACKUP_DIR/db-$TIMESTAMP.sql"

echo "[3/10] Backup release pointer"
echo "$PREV_RELEASE_DIR" > "$BACKUP_DIR/prev-release-$TIMESTAMP.txt"

echo "[4/10] Download release"
mkdir -p "$NEW_RELEASE_DIR"
cd "$NEW_RELEASE_DIR"
# Example: replace with authenticated artifact download
# curl -L -H "Authorization: Bearer $GITHUB_TOKEN" "$ASSET_URL" -o release.tgz
# tar -xzf release.tgz --strip-components=1

echo "[5/10] Install dependencies"
pnpm install --frozen-lockfile

echo "[6/10] Build"
pnpm build
pnpm build:server

echo "[7/10] Run migrations"
pnpm prisma migrate deploy

echo "[8/10] Switch current symlink atomically"
ln -sfn "$NEW_RELEASE_DIR" "$CURRENT_LINK"

echo "[9/10] Restart process manager"
pm2 restart oyama-crm-web oyama-crm-api --update-env

echo "[10/10] Smoke test"
curl -fsS http://127.0.0.1:3650 >/dev/null
curl -fsS http://127.0.0.1:4000/health >/dev/null || {
  echo "Smoke test failed"
  rollback
  exit 1
}

echo "Update complete: $VERSION"
```

## Backend Safety Checklist

- Use idempotent job IDs for update requests.
- Prevent concurrent updates with a lock.
- Timeout long-running steps with explicit failure.
- Persist per-step logs and exit codes.
- Persist actor identity (`updatedBy`).
- Send alert on failed update or rollback.
- Keep at least N backups and retention policy.
- Add signed artifact verification (checksum/signature).

## CI/CD Guardrails Before Tagging

Run and archive command evidence before release tags:

```bash
pnpm lint
pnpm typecheck
pnpm typecheck:web
pnpm typecheck:server
pnpm test:smoke
pnpm test:e2e
pnpm test:e2e:mobile
pnpm test:e2e:livecom
pnpm test
pnpm test:coverage
pnpm build
pnpm build:server
pnpm db:generate
pnpm db:verify:linux-casing
```

If a required lane is failing, do not publish a stable release tag.

## Suggested Data Model For Update History

Store update and rollback history with fields similar to:

- `id`
- `requestedVersion`
- `installedVersion`
- `previousVersion`
- `status` (`QUEUED`, `RUNNING`, `FAILED`, `ROLLED_BACK`, `COMPLETED`)
- `requestedByUserId`
- `startedAt`
- `finishedAt`
- `failureStep`
- `failureMessage`
- `logPath`

## Desktop/Electron Note

For Electron distributions, use signed installer auto-updates from GitHub Releases.
Do not pull source and build on end-user machines.

## Quick Operator Playbook

### Publish a new stable update

1. Verify CI lanes pass.
2. Tag release (`vX.Y.Z`) and publish GitHub Release.
3. Confirm release appears in `System -> Updates`.
4. Trigger install as super admin.
5. Confirm smoke checks and monitor logs.

### Deploy zip without touching server env files

When extracting or syncing release artifacts on the server, preserve server env files:

```bash
# Example rsync pattern (source already excludes env files, keep guard anyway)
rsync -a --delete --exclude='.env' --exclude='.env.*' /path/to/release/ /var/www/oyama-crm/current/
```

If using unzip into a target directory, keep env files outside the extracted release directory and reference them via process manager environment configuration.

### Failed update

1. Keep maintenance mode enabled.
2. Trigger rollback to last known-good release.
3. Verify app + API health checks.
4. Record incident and root cause.
5. Re-publish only after fix and clean validation.

## Related Docs

- `docs/HOSTINGER_DEPLOY_README.md`
- `docs/operations/PRODUCTION_BUILD_MANAGER.md`
- `docs/status/production-readiness-checklist.md`
- `docs/howto/HOW_TO_USE.md`
