# Hostinger Deploy README

Last updated: 2026-05-11

This guide is the production deployment runbook for OyamaCRM on a Hostinger VPS.

## Scope

- Target: Ubuntu-based Hostinger VPS
- App path used in examples: `~/htdocs/www.crm.partnertpcc.com`
- Process manager: PM2
- Package manager: pnpm
- DB migrations: Prisma migrate deploy (production-safe)

## 1) Prerequisites

Install or verify:

- Node.js 20+
- pnpm 10+
- PM2
- MySQL/Percona connectivity from server

Quick checks:

```bash
node -v
pnpm -v
pm2 -v
```

## 2) Environment Variables

Create a production `.env` in the app directory with required values for:

- DATABASE_URL
- JWT_SECRET
- REFRESH_SECRET
- NEXT_PUBLIC_API_URL
- FRONTEND_ORIGIN
- QB_CLIENT_ID / QB_CLIENT_SECRET if QuickBooks is enabled

Important:

- Keep `.env` server-local.
- Do not commit production secrets.

## 3) Correct First-Time Checkout

If starting fresh:

```bash
cd ~/htdocs
git clone https://github.com/jamesk9526/OyamaCRM.git www.crm.partnertpcc.com
cd www.crm.partnertpcc.com
git checkout main
git pull --ff-only
```

## 4) Fix: "No commits yet on master" / No Tracking

If `git pull` fails and `git status` shows:

- `No commits yet on master`
- many untracked files

then the folder is not attached to repository history.

### Safe recovery (recommended)

```bash
cd ~/htdocs
mv www.crm.partnertpcc.com www.crm.partnertpcc.com.bak.$(date +%F-%H%M)
git clone https://github.com/jamesk9526/OyamaCRM.git www.crm.partnertpcc.com
cd www.crm.partnertpcc.com
git checkout main
git pull --ff-only
```

Copy only production-only files (for example `.env`) from backup after clone.

### In-place recovery (destructive for untracked files)

```bash
cd ~/htdocs/www.crm.partnertpcc.com
[ -f .env ] && cp .env ~/htdocs/.env.backup.$(date +%F-%H%M%S)
git fetch origin main
git clean -fd
git checkout -B main origin/main
git branch --set-upstream-to=origin/main main
git pull --ff-only
```

## 5) Standard Update Flow

Use this on each deploy:

```bash
cd ~/htdocs/www.crm.partnertpcc.com
git fetch origin
git checkout main
git pull --ff-only
pnpm install --frozen-lockfile
pnpm prisma migrate deploy
pnpm build
pm2 restart ecosystem.config.cjs --env production
pm2 save
```

## 6) Prisma Build/Typecheck Recovery

If build fails with enum export errors from `@prisma/client` (example: missing `ActivityType`):

```bash
cd ~/htdocs/www.crm.partnertpcc.com
pnpm install --frozen-lockfile
rm -rf node_modules/.prisma
pnpm prisma generate
pnpm build
```

If still broken, do a full reinstall:

```bash
rm -rf node_modules
pnpm install
pnpm prisma generate
pnpm build
```

## 7) Migration Safety Rules

Production rules:

- Use `pnpm prisma migrate deploy` in production.
- Do not use `prisma migrate dev` on VPS.
- Do not use `db push` in production.

If a migration fails because a table already exists from prior manual changes, resolve and continue:

```bash
pnpm prisma migrate resolve --applied <migration_name>
pnpm prisma migrate deploy
```

## 8) Verify Deployed Version

```bash
git status -sb
git log -1 --oneline
pm2 status
pm2 logs --lines 80
```

Expected:

- branch is `main`
- working tree clean
- app process online in PM2
- no startup stack traces in logs

## 9) Quick Rollback

Rollback to previous commit:

```bash
cd ~/htdocs/www.crm.partnertpcc.com
git log --oneline -n 10
git checkout <previous_commit_sha>
pnpm install --frozen-lockfile
pnpm prisma migrate deploy
pnpm build
pm2 restart ecosystem.config.cjs --env production
```

After incident is resolved, return to `main` and redeploy.

## 10) Troubleshooting Checklist

- Git cannot pull: confirm branch/history state with `git status -sb` and `git log -1`.
- Typecheck fails after pull: regenerate Prisma client.
- Migration error on Linux DB: validate table name casing in migration SQL.
- PM2 app offline: inspect `pm2 logs` first, then verify `.env` and DB connectivity.

## 11) Fix 502 Bad Gateway (Nginx/Hostinger)

If Nginx shows `502 Bad Gateway`, it usually means proxy upstream is not reachable.

For OyamaCRM, expected upstreams are:

- Next.js web app on `127.0.0.1:3650`
- Express API on `127.0.0.1:4000`

### A) Quick diagnosis

Run:

```bash
cd ~/htdocs/www.crm.partnertpcc.com
pm2 status
pm2 logs oyama-crm-web --lines 80
pm2 logs oyama-crm-api --lines 80
ss -ltnp | grep -E ':3650|:4000' || true
curl -I http://127.0.0.1:3650 || true
curl -I http://127.0.0.1:4000/health || true
```

Interpretation:

- If nothing is listening on `3650`, Nginx to web will return 502.
- If API is down on `4000`, API calls fail even if web loads.

### B) Start/restart services

```bash
cd ~/htdocs/www.crm.partnertpcc.com
pnpm install --frozen-lockfile
pnpm build
pnpm build:server
pnpm pm2:restart
pnpm pm2:status
```

### C) Hostinger `{{app_port}}` alignment

Your Hostinger template uses:

```nginx
proxy_pass http://127.0.0.1:{{app_port}}/;
```

Make sure `{{app_port}}` resolves to `3650` for the website upstream.

### D) Recommended Nginx routing for OyamaCRM

OyamaCRM runs web and API separately, so route `/api` to `4000` and everything else to `3650`.

```nginx
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
	proxy_pass http://127.0.0.1:3650/;
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
```

After Nginx change, reload Nginx from Hostinger panel or server shell, then verify:

```bash
curl -I https://www.crm.partnertpcc.com
curl -I https://www.crm.partnertpcc.com/api/health
```

### E) If 502 persists

- Verify PM2 process names match ecosystem config: `oyama-crm-web`, `oyama-crm-api`.
- Confirm no port conflicts on `3650`/`4000`.
- Confirm `NEXT_PUBLIC_API_URL` and `FRONTEND_ORIGIN` are set correctly in `.env`.
