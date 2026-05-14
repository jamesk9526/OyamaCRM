# OyamaCRM

OyamaCRM is a nonprofit platform with DonorCRM, Compassion CRM, Events CRM, and supporting workspaces.

This root README is intentionally short. Canonical documentation now lives under `docs/`.

## Start Here

- Project overview: [docs/PROJECT_OVERVIEW.md](docs/PROJECT_OVERVIEW.md)
- Canonical master plan and reality audit: [docs/MASTER_PLAN.md](docs/MASTER_PLAN.md)
- Feature status matrix: [docs/status/features.md](docs/status/features.md)
- Production readiness gate: [docs/status/production-readiness-checklist.md](docs/status/production-readiness-checklist.md)
- Office operating guide: [docs/howto/HOW_TO_USE.md](docs/howto/HOW_TO_USE.md)
- DonorCRM module guide: [docs/modules/donor-crm/README.md](docs/modules/donor-crm/README.md)
- DonorCRM browser QA report: [docs/modules/donor-crm/browser-qa-report.md](docs/modules/donor-crm/browser-qa-report.md)
- DonorCRM screenshot index: [docs/screenshots/donor-crm/README.md](docs/screenshots/donor-crm/README.md)
- Documentation audit: [docs/audits/markdown-documentation-audit.md](docs/audits/markdown-documentation-audit.md)

## Documentation Structure

- `docs/MASTER_PLAN.md` is the single source of truth for high-level plan and reality status.
- `docs/status/features.md` is the feature-by-feature implementation status source.
- `docs/status/production-readiness-checklist.md` is the production release gate source.
- `docs/plans/` contains active phase plans and implementation packets.
- `docs/backlog/` contains backlog-focused planning docs.
- `docs/audits/` contains dated and historical audit artifacts.
- `docs/howto/` contains operator guidance.

## Testing

- Testing hub: [docs/testing/README.md](docs/testing/README.md)
- Full app test audit: [docs/testing/full-app-test-audit.md](docs/testing/full-app-test-audit.md)
- E2E local runbook: [docs/testing/e2e-local-runbook.md](docs/testing/e2e-local-runbook.md)
- Coverage map: [docs/testing/test-coverage-map.md](docs/testing/test-coverage-map.md)
- Validation log: [docs/audits/full-app-testing-validation.md](docs/audits/full-app-testing-validation.md)

Common commands:

- `pnpm test:unit`
- `pnpm test:api`
- `pnpm test:smoke`
- `pnpm test:smoke:routes`
- `pnpm test:e2e`
- `pnpm test:e2e:mobile`
- `pnpm test:regression`
- `pnpm test:coverage`
- `pnpm test:ci`
