# Production launch and updates

This is the canonical SSH deployment guide for the CloudPanel/MySQL/PM2 installation. Run routine deployment as the site user, not root. Never paste passwords, tokens, or `.env.production` contents into support output.

## Routine deployment

Commit and push the intended release and its lockfile first. Take a database backup using the site's established backup procedure before applying migrations. The script applies **all pending migrations** to `DATABASE_URL`; it does not automatically reverse them after a failed build.

From the SSH console:

```bash
cd /home/partnertpccccrm/htdocs/www.crm.partnertpcc.com
bash scripts/deploy/production.sh
```

The script checks for server-side Git changes, pulls fast-forward only, exports `.env.production` before database/build commands, installs locked dependencies including build tools, applies migrations, generates Prisma Client, installs user-owned Chromium, verifies PDF generation, builds all three targets, and starts/reloads every configured PM2 process. It stops on the first failure and saves the PM2 list after reload. This is an in-place build, not an atomic or zero-downtime deployment; a failed build can require rebuilding the previous release.

For manual deployment, use the exact commands in [production.sh](../../scripts/deploy/production.sh). Do not add `--` before PM2's `--env` options; use `pnpm exec pm2`. `startOrReload` includes newly added workers without a second restart.

## First-time Chromium system dependencies

Run once as root/admin when provisioning the server. A browser download does not install Linux shared libraries. On this installation, Node belongs to the site user's NVM installation, so root's default PATH may not find it.

From a root console, substitute the installed Node version if it changes:

```bash
cd /home/partnertpccccrm/htdocs/www.crm.partnertpcc.com
env PATH="/home/partnertpccccrm/.nvm/versions/node/v22.22.2/bin:$PATH" \
  ./node_modules/.bin/playwright install-deps chromium
```

Run browser downloads, builds, and PM2 as `partnertpccccrm`. No permanent sudo grant is needed if the administrator installs the system packages. CloudPanel can restrict sudo even for members of the sudo group; `sudo -l` displays the effective policy. Do not change a site user's UID to 0.

## Environment and storage

- `.env.production` must contain the intended MySQL `DATABASE_URL` and deployment settings. Prisma may print that `.env` was loaded; explicitly exported production values must be set before running it.
- `PORT` defaults to 3650, `API_PORT` to 4000, and `LETTERS_PORT` to 3001 in `ecosystem.config.cjs`.
- Set `LETTERS_ARTIFACT_ROOT` to an absolute persistent private directory writable by the site user. The default is `.private/letter-artifacts` under the working directory. Keep it outside public uploads, retain it across releases, and include it in backup/recovery procedures.
- The API and `oyama-letter-production` worker must use the same database and artifact directory. Chromium is installed for the account running the worker.

## Letters activation

Deployment does not enable the new builder. A signed-in account with `letters.manage_branding` can send:

```http
PUT /api/letters/production/config
Authorization: Bearer <current-access-token>
Content-Type: application/json

{"enabled":true}
```

Read `GET /api/letters/production/config` to check the flag. Send `{"enabled":false}` to disable it. The flag is scoped to the authenticated organization, not a global environment variable. Refresh the browser after changing it.

The new workflow is **in progress**: basic builder/revision/proof integration exists, while complete approvals/batch UI, autosave/recovery, authenticated concurrency coverage, and visual/physical-print certification remain incomplete. Enable only for controlled testing until those gates pass. Disabling the flag is not a database rollback and does not convert structured templates back to legacy templates.

## Verify the launch

```bash
pnpm exec pm2 status
pnpm exec pm2 logs oyama-letter-production --lines 30 --nostream
curl -fsS -o /dev/null http://127.0.0.1:3650/
curl -fsS -o /dev/null http://127.0.0.1:3001/
```

Check the configured public URL and API health route for your installation as well. PM2 online status proves process startup, not database access or PDF correctness. In the browser, sign in, open a template, save an edit, choose a recipient, render a proof, and verify download/reopen. Review a long multi-page Letter document, A4 document, explicit break, table, and signature. Confirm the worker is not repeatedly restarting. Physical label alignment still requires an actual-size printer check.

## Troubleshooting

| Output | Action |
| --- | --- |
| `ERR_PNPM_OUTDATED_LOCKFILE` | Correct and commit the lockfile in development, push, then pull again. Keep frozen installation on the server. |
| `node: not found` from root | Use the site user's actual Node directory in PATH for the administrator-only dependency installation. |
| sudo permission denied | Have the administrator install system dependencies from their root console. |
| Missing `libatk-1.0.so.0` or other shared library | Run `playwright install-deps chromium` as administrator; downloading Chromium again will not fix system libraries. |
| Prisma major-update notice | Informational; do not upgrade Prisma during routine deployment. |
| Ignored Electron build scripts | Desktop dependency notice; not evidence of a web/PDF build failure. |
| Proof remains queued | Check worker logs, database connectivity, artifact permissions, and environment consistency. |
| SSH exits after an error | A shell running `set -e` may exit; the script runs as a child process so its failure should return to the SSH prompt. |

## Recovery

Stop on the actual error; do not continue into PM2 reloads after a failed build. Review logs and retain the database/artifact backups. Reverting application code does not undo migrations. Restore an earlier release only after checking schema compatibility; never run a reset or destructive migration as an automatic rollback.
