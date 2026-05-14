# Testing Guide

This folder contains cross-module testing standards, local runbooks, and coverage mapping for OyamaCRM.

## Primary Docs

- `docs/testing/full-app-test-audit.md`
- `docs/testing/e2e-local-runbook.md`
- `docs/testing/test-coverage-map.md`

## Current Test Lanes

- Unit: `pnpm test:unit`
- API: `pnpm test:api`
- Smoke: `pnpm test:smoke`
- Browser route smoke: `pnpm test:smoke:routes`
- E2E auth: `pnpm test:e2e:auth`
- E2E watchdog: `pnpm test:e2e:watchdog`
- E2E production smoke: `pnpm test:e2e`
- E2E mobile: `pnpm test:e2e:mobile`
- Regression: `pnpm test:regression`
- Coverage: `pnpm test:coverage`
- CI lane: `pnpm test:ci`

## Fixture Sources

- CSV fixtures: `tests/fixtures/import-valid.csv`, `tests/fixtures/import-invalid.csv`
- Watchdog fixtures: `tests/fixtures/watchdog-backup-manifest.json`, `tests/fixtures/vault-secret.json`
- Shared auth helpers: `tests/helpers/auth.ts`, `tests/helpers/e2e-auth.mjs`
