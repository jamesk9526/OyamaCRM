# Oyama Letters — Standalone Workspace

`apps/letters` is a standalone Next.js application that hosts the **Oyama
Letters production center** as its own deployable surface, separated from the
main OyamaCRM donor application.

It is the first workspace in the OyamaCRM pnpm monorepo (`pnpm-workspace.yaml`
at the repo root) and is intended as the template for splitting additional
modules (events, compassion, etc.) into independent apps over time.

## What ships here

The Letters app surfaces the same production-center experience that lives at
`/oyama-letters` inside the main CRM, but as a standalone site running on its
own port:

| Route                              | Purpose                                       |
| ---------------------------------- | --------------------------------------------- |
| `/`                                | Production-center home / project manager      |
| `/generate`                        | Record merge, PDF preview, print/email queue  |
| `/templates`                       | Template library                              |
| `/templates/new`                   | New template builder                          |
| `/templates/[templateId]`          | Edit an existing template                     |

All UI components live under `components/letters/` and are copies of the
canonical sources under `app/components/letters/` in the root project. Imports
have been rewritten to use the workspace-local `@/*` alias (which points at
`apps/letters/*`).

## How it talks to the donor CRM

The Letters app **does not run its own Express server**. Instead, every
`/api/*` request is rewritten to the main OyamaCRM API (`next.config.ts`),
which is where all of the following continue to live:

- Donor CRM data (`Constituent`, `Donation`, `Organization`, `User`)
- Letter persistence (`LetterTemplate`, `GeneratedLetter`, print/mail queues)
- Branding presets, signature blocks, merge-field execution

This satisfies the design goal of "Letters is its own app that uses donor CRM
data" without requiring a database split. The Letters team can develop, build,
and deploy this workspace independently as long as it can reach the API.

Override the backend by setting either of these environment variables before
`pnpm dev` / `pnpm build`:

```
OYAMA_API_URL=https://crm.example.com
# or
NEXT_PUBLIC_API_URL=https://crm.example.com
```

The default is `http://localhost:4000`, matching the main repo's
`pnpm dev:api` server.

## Running locally

From the repo root:

```bash
# 1. start the shared API server (port 4000)
pnpm dev:api

# 2. in another shell, start the Letters workspace (port 3001)
pnpm --filter @oyama/letters dev
```

Then open <http://localhost:3001>.

You can still run the original CRM (which also exposes `/oyama-letters`) on
port 3000 at the same time — both UIs talk to the same API and the same
database.

## Roadmap (follow-up PRs)

1. **Move the server route**: relocate `server/src/routes/letters.ts` and the
   `letters-merge` / `letters-execution` services into
   `apps/letters/server/` and have this workspace run its own Express
   instance pointing at the shared Prisma database.
2. **Shared package**: extract `packages/shared` with the Prisma client and
   shared TypeScript types so each app imports from `@oyama/shared` instead
   of having its own copies of `auth-client`, `branding-settings`, etc.
3. **Tailwind**: wire Tailwind into this workspace (the components use
   Tailwind utility classes today; standalone they render unstyled until
   Tailwind is configured here).
4. **Remove duplicate** `/oyama-letters` routes and components from the main
   app once the standalone workspace is the canonical home.
