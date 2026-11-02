#!/usr/bin/env bash
# Run as the application/PM2 user from the repository. Never source this script.
set -Ee -o pipefail
trap 'echo "Deployment stopped at line $LINENO. Services may still be running the previous build; review the error before retrying." >&2' ERR
cd "$(dirname "${BASH_SOURCE[0]}")/../.."
test -f .env.production
if [ -n "$(git status --porcelain)" ]; then
  echo "Resolve repository changes before deployment; nothing has been pulled." >&2
  git status --short
  exit 1
fi
git pull --ff-only
set -a
source .env.production
set +a
pnpm install --frozen-lockfile --prod=false
pnpm prisma migrate deploy
pnpm prisma generate
pnpm exec playwright install chromium
node <<'NODE'
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent('<h1>Deployment PDF check</h1>');
    const pdf = await page.pdf({ format: 'Letter' });
    console.log(`Chromium PDF check passed: ${pdf.length} bytes`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
NODE
pnpm build
pnpm build:server
pnpm build:letters
test -f dist/server/workers/letters-production.js
pnpm exec pm2 startOrReload ecosystem.config.cjs --env production --update-env
pnpm exec pm2 save
pnpm exec pm2 status
pnpm exec pm2 logs oyama-letter-production --lines 30 --nostream
echo "Build/reload commands completed. Check HTTP health and a real letter proof as described in docs/operations/LAUNCH.md."
