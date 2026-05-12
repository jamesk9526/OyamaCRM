# Hostinger Deploy Template

Last updated: 2026-05-12

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
				proxy_pass http://127.0.0.1:4000/;
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

## 4) Standard Deploy Flow

		cd ~/htdocs/<APP_DIRECTORY>
		git fetch origin
		git checkout main
		git pull --ff-only
		pnpm install --frozen-lockfile
		pnpm prisma migrate deploy
		pnpm build
		pnpm build:server

Load env and start/restart PM2:

		set -a
		source .env.production
		set +a
		pnpm pm2:start -- --env production --update-env
		pnpm pm2:restart -- --env production --update-env
		pnpm pm2:save

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
