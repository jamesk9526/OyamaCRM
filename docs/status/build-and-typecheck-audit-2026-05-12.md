# OyamaCRM Build And Typecheck Audit (2026-05-12)

Last updated: 2026-05-13
Evidence folder: `docs/status/audit-artifacts/2026-05-12`

## Status

Build and typecheck lane: Partially Working

Reason:

- Web/server typecheck and build commands are Working.
- Prisma client generation is Broken in this run.

## Command Results

| Command | Exit Code | Status | Notes |
|---|---:|---|---|
| `pnpm typecheck` | 0 | Working | Combined web + server typecheck pass. |
| `pnpm typecheck:web` | 0 | Working | `tsc --noEmit` pass. |
| `pnpm typecheck:server` | 0 | Working | `tsc --project server/tsconfig.json --noEmit` pass. |
| `pnpm build` | 0 | Working | Next.js production build completed. |
| `pnpm build:server` | 0 | Working | Server TypeScript compilation completed. |
| `pnpm db:generate` | 1 | Broken | Prisma engine DLL rename `EPERM` on Windows. |
| `pnpm db:verify:linux-casing` | 0 | Working | Migration casing check passed. |

## Build Output Highlights

From `pnpm build`:

- Next.js `16.2.5` build completed successfully.
- Optimized production bundle compiled.
- TypeScript stage completed.
- Static generation completed for 116 routes.
- Dynamic and static route maps were emitted as expected.

Evidence: `docs/status/audit-artifacts/2026-05-12/pnpm-build.log`

## Prisma Generation Failure Detail

From `pnpm db:generate`:

- Error: `EPERM: operation not permitted, rename ...query_engine-windows.dll.node.tmp* -> ...query_engine-windows.dll.node`

Likely cause in this environment:

- Windows file lock on Prisma engine DLL by an active process or scanner.

Evidence: `docs/status/audit-artifacts/2026-05-12/pnpm-db-generate.log`

## Recommended Recovery For Next Run

1. Stop processes that may hold Prisma engine files (API/dev servers, watchers, background node processes).
2. Remove stale `query_engine-windows.dll.node.tmp*` files under `.prisma/client`.
3. Re-run `pnpm db:generate`.
4. Re-run `pnpm typecheck` and `pnpm build` to confirm no follow-on impact.
