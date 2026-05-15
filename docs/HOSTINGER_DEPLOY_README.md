# Hostinger Deploy Template

Last updated: 2026-05-14

This guide is a reusable deployment template for a Next.js web app + Express API running behind Nginx on Hostinger VPS.

## Scope

- Target: Ubuntu-based Hostinger VPS
- Process manager: PM2
- Package manager: pnpm
- Web upstream port: 3650
- API upstream port: 4000
- Migration mode: deploy-only for production

## 1) Prerequisites

- Node.js 20+
- pnpm 10+
- PM2 available through project scripts
- Database reachable from server

Quick checks:

		node -v
		pnpm -v
		pnpm pm2:status

## 2) Environment Template

Use a production env file with placeholder values.

		NODE_ENV=production
		RELEASE_CHANNEL=production

		PORT=3650
		API_PORT=4000

		APP_NAME=<APP_NAME>
		APP_VERSION=<APP_VERSION>
		BUILD_DATE=<YYYY-MM-DD>
		GIT_COMMIT=<SHORT_SHA>
		LAST_AUDIT_DATE=<YYYY-MM-DD>

		DATABASE_URL=mysql://<DB_USER>:<DB_PASSWORD>@localhost:3306/<DB_NAME>
		WATCHDOG_DATABASE_URL=mysql://<DB_USER_2>:<DB_PASSWORD_2>@localhost:3306/<DB_NAME_2>

		JWT_SECRET=<ROTATE_ME>
		REFRESH_SECRET=<ROTATE_ME>
		JWT_REFRESH_SECRET=<ROTATE_ME_OR_MATCH_REFRESH_SECRET>

		FRONTEND_ORIGIN=https://<APP_DOMAIN>
		NEXT_PUBLIC_APP_URL=https://<APP_DOMAIN>
		NEXT_PUBLIC_API_URL=https://<APP_DOMAIN>/api

		NEXT_PUBLIC_APP_ENV=production
		NEXT_PUBLIC_APP_NAME=<APP_NAME>
		NEXT_PUBLIC_APP_VERSION=<APP_VERSION>
		NEXT_PUBLIC_BUILD_DATE=<YYYY-MM-DD>
		NEXT_PUBLIC_GIT_COMMIT=<SHORT_SHA>
		NEXT_PUBLIC_LAST_AUDIT_DATE=<YYYY-MM-DD>
		NEXT_PUBLIC_RELEASE_CHANNEL=production

Notes:

- Do not keep localhost URLs in production values.
- Do not commit real secrets.
- Rotate any secret that was pasted into terminal/chat logs.

## 3) Nginx Template (Dual Upstream)

Use separate upstreams for web and API.

		server {
			listen 80;
			listen [::]:80;
			listen 443 quic;
			listen 443 ssl;
			listen [::]:443 quic;
			listen [::]:443 ssl;
			http2 on;
			http3 off;
			{{ssl_certificate_key}}
			{{ssl_certificate}}
			server_name <APP_DOMAIN>;
			{{root}}

			{{nginx_access_log}}
			{{nginx_error_log}}

			if ($scheme != "https") {
				rewrite ^ https://$host$request_uri permanent;
			}

			location ~ /.well-known {
				auth_basic off;
				allow all;
			}

			{{settings}}
			include /etc/nginx/global_settings;
			index index.html;

			location /api/ {
				proxy_pass http://127.0.0.1:4000;
				proxy_http_version 1.1;
				proxy_set_header X-Forwarded-Host $host;
				proxy_set_header X-Forwarded-Server $host;
				proxy_set_header X-Real-IP $remote_addr;
				proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
				proxy_set_header X-Forwarded-Proto $scheme;
				proxy_set_header Host $host;
				proxy_set_header Upgrade $http_upgrade;
				proxy_set_header Connection "Upgrade";
			}

			location / {
				proxy_pass http://127.0.0.1:{{app_port}}/;
				proxy_http_version 1.1;
				proxy_set_header X-Forwarded-Host $host;
				proxy_set_header X-Forwarded-Server $host;
				proxy_set_header X-Real-IP $remote_addr;
				proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
				proxy_set_header X-Forwarded-Proto $scheme;
				proxy_set_header Host $host;
				proxy_set_header Upgrade $http_upgrade;
				proxy_set_header Connection "Upgrade";
				proxy_pass_request_headers on;
				proxy_max_temp_file_size 0;
				proxy_connect_timeout 900;
				proxy_send_timeout 900;
				proxy_read_timeout 900;
				proxy_buffer_size 128k;
				proxy_buffers 4 256k;
				proxy_busy_buffers_size 256k;
				proxy_temp_file_write_size 256k;
			}
		}

Important:

- Set Hostinger app port variable to 3650.
- Keep API block fixed on 4000.
- Do not add a trailing slash to the API `proxy_pass` target, or Nginx will strip the `/api` prefix and backend routes will 404.

## 4) Standard Deploy Flow

		cd ~/htdocs/<APP_DIRECTORY>
		git fetch origin
		git checkout main

##### Copy and run these!!

		git pull --ff-only
		pnpm install --frozen-lockfile
		pnpm prisma migrate deploy
		pnpm prisma generate
		pnpm build
		pnpm build:server
		set -a
		source .env.production
		set +a
		pnpm pm2:start -- --env production --update-env
		pnpm pm2:restart -- --env production --update-env
		pnpm pm2 save

Recommended safer variant (stop on first failure):

		set -euo pipefail
		git pull --ff-only
		pnpm install --frozen-lockfile
		pnpm prisma migrate deploy
		pnpm prisma generate
		pnpm build
		pnpm build:server
		set -a
		source .env.production
		set +a
		pnpm pm2:start -- --env production --update-env
		pnpm pm2:restart -- --env production --update-env
		pnpm pm2 save

## 5) Verification Checklist

		pnpm pm2:status
		curl -I http://127.0.0.1:3650
		curl -I http://127.0.0.1:4000/api/health
		curl -I https://<APP_DOMAIN>
		curl -I https://<APP_DOMAIN>/api/health

Expected:

- Web process online and listening on 3650
- API process online and listening on 4000
- Nginx domain routes return 200/3xx, not 502

## 6) Known Failure Patterns

### 6.1 No tracking branch / no commits yet

If repo state shows no commits and many untracked files, re-clone or reattach to origin history before pull.

### 6.2 Prisma client mismatch after pull

If typecheck fails with missing Prisma exports, regenerate client:

		rm -rf node_modules/.prisma
		pnpm prisma generate

If errors mention missing models/enums such as `letterTemplate`, `generatedLetter`, or `StewardPath*`, this always means Prisma Client was not regenerated against the latest schema. Run:

		pnpm prisma migrate deploy
		pnpm prisma generate
		pnpm build
		pnpm build:server

### 6.6 Prisma P3009 failed migration (`20260513144533_add_email_campaign_purpose_and_compliance_models`)

Symptom:

		Error: P3009
		migrate found failed migrations in the target database...
		The `20260513144533_add_email_campaign_purpose_and_compliance_models` migration ... failed

Cause:

- A previous migration SQL used lowercase `emailcampaign` while the real Prisma table is `EmailCampaign`.
- Linux/MySQL hosts can be case-sensitive for table names.

Server-safe fix (no reset):

		cd ~/htdocs/<APP_DIRECTORY>
		git fetch origin
		git checkout main
		git pull --ff-only
		pnpm install --frozen-lockfile
		pnpm prisma migrate status
		pnpm prisma migrate resolve --rolled-back 20260513144533_add_email_campaign_purpose_and_compliance_models
		pnpm prisma migrate deploy
		pnpm prisma generate
		pnpm build
		pnpm build:server

Notes:

- Do not run `pnpm prisma migrate dev` on production.
- Do not create a duplicate email campaign table (`emailcampaign` vs `EmailCampaign`).
- If deploy still fails with missing `EmailCampaign`, migration history is out of order in that environment and earlier migrations were not fully applied.

### 6.7 Runtime schema drift for Tasks/Notifications (`P2021` / `P2022`)

Symptoms in API logs:

		The table `notification` does not exist in the current database.
		The column `Task.organizationId` does not exist in the current database.

Cause:

- App code and generated Prisma client were updated, but the server database did not apply the latest migration.
- This is most visible in `/api/notifications` and `/api/tasks` and in steward worker polling.

Required migration now in repo:

- `prisma/migrations/20260514190000_add_tasks_notifications_work_engine/migration.sql`

Production-safe fix:

		cd ~/htdocs/<APP_DIRECTORY>
		git fetch origin
		git checkout main
		git pull --ff-only
		pnpm install --frozen-lockfile
		pnpm prisma migrate status
		pnpm prisma migrate deploy
		pnpm prisma generate
		pnpm build
		pnpm build:server
		pnpm pm2:restart -- --env production --update-env

Post-deploy schema validation (recommended):

		node -e 'const { PrismaClient } = require("@prisma/client"); const prisma = new PrismaClient(); (async () => { const row = await prisma.task.findFirst({ select: { id: true, organizationId: true } }); const notifCount = await prisma.notification.count(); console.log({ taskQueryOk: true, sampleTaskId: row?.id ?? null, notificationCount: notifCount }); })().catch((err) => { console.error(err); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });'

Important:

- Do not run `pnpm prisma migrate dev` on production.
- Do not run `pnpm db:push` on production to bypass drift warnings.
- Use deploy migrations only (`pnpm prisma migrate deploy`) so migration history remains consistent.

### 6.5 pnpm fetch 404 for caniuse-lite

Symptom:

		ERR_PNPM_FETCH_404 ... caniuse-lite-<version>.tgz Not Found

Cause:

- Lockfile references a non-existent caniuse-lite version.

Fix:

1. Pull latest `main` (contains corrected lockfile).
2. Retry install:

		pnpm install --frozen-lockfile

If still blocked, refresh lockfile once and commit from a trusted dev machine:

		rm -rf node_modules pnpm-lock.yaml
		pnpm install
		git add pnpm-lock.yaml
		git commit -m "fix: refresh lockfile"
		git push

### 6.3 502 Bad Gateway

Usually one of:

- Web process not listening on 3650
- Hostinger app port not set to 3650
- Missing /api upstream block to 4000

### 6.4 PM2 unstable restarts

If PM2 shows unstable restarts, ensure ecosystem config is current, then hard reset process state:

		pnpm pm2:delete
		pnpm pm2:start -- --env production --update-env
		pnpm pm2:save

## 7) Security Notes

- Never publish real database credentials or JWT secrets.
- Rotate secrets immediately if they were shared in terminal output or chat history.
