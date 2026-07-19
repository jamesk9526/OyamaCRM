# OyamaCRM

OyamaCRM is a nonprofit operations platform with dedicated DonorCRM, Compassion CRM, Events CRM, OyamaEmail, OyamaLetters, and Steward Paths workspaces.

## Development

Requirements: Node.js 20+, pnpm 10+, and a configured MySQL database.

```bash
pnpm install
Copy-Item .env.example .env.local
pnpm db:migrate
pnpm dev:all
```

The web app runs at `http://localhost:3000`; the API runs at `http://localhost:4000`.

Useful commands:

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm build:server
```

## Documentation

- [Project plan and architecture](docs/MASTER_PLAN.md)
- [Current feature status](docs/status/features.md)
- [Production readiness](docs/status/production-readiness-checklist.md)
- [Staff operating guide](docs/howto/HOW_TO_USE.md)
- [DonorCRM module guide](docs/modules/donor-crm/README.md)
- [Email workspace](docs/DONOR_CRM_EMAIL_BUILDER.md)
- [Letters workspace](docs/DONOR_CRM_LETTERS_PRINTABLES.md)
- [Steward Paths](docs/modules/donor-crm/steward-paths.md)

## License

See [LICENSE.md](LICENSE.md).
