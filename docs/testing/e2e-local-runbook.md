# E2E Local Runbook

## Prerequisites

1. Install dependencies: `pnpm install`
2. Seed local database with demo users: `pnpm db:seed:small`
3. Start API and web servers (separate terminal): `pnpm dev:all`

Default local contracts used by scripts:

- Web base URL: `http://localhost:3000`
- API base URL: `http://localhost:4000`

Override with env vars when needed:

- `E2E_WEB_BASE_URL`
- `E2E_API_BASE_URL`

## Core Commands

- All local lanes: `pnpm test:all`
- Unit only: `pnpm test:unit`
- API only: `pnpm test:api`
- Smoke only: `pnpm test:smoke`
- Route smoke only: `pnpm test:smoke:routes`
- E2E only: `pnpm test:e2e`
- E2E auth only: `pnpm test:e2e:auth`
- E2E watchdog only: `pnpm test:e2e:watchdog`
- Mobile E2E only: `pnpm test:e2e:mobile`
- Regression only: `pnpm test:regression`
- Coverage: `pnpm test:coverage`
- Debug one lane with headed browser: `set PWDEBUG=1&& pnpm test:e2e:auth`

## Failure Artifacts

Current script-based Playwright lanes write JSON outputs to:

- `tests/e2e/artifacts/mobile-readiness-report.json`

When upgrading to Playwright test-runner, enable:

- trace on first retry
- screenshot on failure
- video on retry/failure
- HTML report output

## Stability Checklist

1. Confirm no stale Next dev process is holding port 3000.
2. Confirm API server is running and healthy (`/health`).
3. Use seeded admin account `admin@hopefoundation.org` / `admin123!` for local E2E.
4. Keep tests isolated and avoid order dependence.
5. Prefer API setup + UI assertions for repeatability.
