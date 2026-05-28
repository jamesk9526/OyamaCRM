# Oyama Letters — Standalone Workspace

`apps/letters` is a compatibility package for the former standalone Oyama
Letters application.

It is the first workspace in the OyamaCRM pnpm monorepo (`pnpm-workspace.yaml`
at the repo root) and is intended as the template for splitting additional
modules (events, compassion, etc.) into independent apps over time.

## What ships here now

The canonical, refreshed OyamaLetters workspace now lives inside the main CRM
at `/oyama-letters`. This package no longer serves a duplicate UI. Its routes
redirect to the main CRM workspace so bookmarks and old standalone links keep
working without exposing stale components.

| Route                              | Purpose                                       |
| ---------------------------------- | --------------------------------------------- |
| `/`                                | Redirect to `/oyama-letters`                  |
| `/generate`                        | Record merge, PDF preview, print/email queue  |
| `/templates`                       | Template library                              |
| `/templates/new`                   | New template builder                          |
| `/templates/[templateId]`          | Edit an existing template                     |

Set `NEXT_PUBLIC_OYAMA_CRM_URL` when the main CRM is not running at
`http://localhost:3000`.

## Running locally

From the repo root:

```bash
# 1. start the main CRM (port 3000)
pnpm dev

# 2. in another shell, start this compatibility app (port 3001)
pnpm --filter @oyama/letters dev
```

Then open <http://localhost:3001>; it will redirect to the canonical
OyamaLetters workspace.
