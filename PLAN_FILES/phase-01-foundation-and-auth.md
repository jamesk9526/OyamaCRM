# Phase 01 — Foundation and Auth

## Goal

Stabilize platform foundations so all later features ship on consistent architecture.

## Scope

- Environment/config standards
- Auth and role/permission baseline
- API versioning and error shape
- Core audit/event hooks
- Dev workflow and seed reliability

## Manageable steps

1. Standardize `.env` contract for web/api/db and local/prod parity.
2. Finalize auth flow (login/session/token), guard middleware, and role checks.
3. Lock API response envelope + error format + pagination conventions.
4. Add base audit logging + internal event publisher scaffolding.
5. Ensure Prisma migrate/generate/seed scripts are stable with pnpm.
6. Add base health/readiness checks and PM2 process assumptions.
7. Document conventions in AGENTS.md and developer notes.

## Exit criteria

- Users can authenticate and access controlled routes by role.
- API contracts are stable and documented.
- Audit/event scaffolding exists for key entities.
- Local setup is deterministic with one start path.

## Audit snapshot — 2026-05-08

- [x] Auth flow works in code — verified in `server/src/routes/auth.ts` and `app/lib/auth-client.ts`.
- [x] First-run setup enforcement exists — verified in `server/src/routes/setup.ts`, `app/login/page.tsx`, and `app/setup/page.tsx`.
- [~] Role/permission middleware exists but is not broadly applied — `server/src/middleware/requireAuth.ts`, `server/src/middleware/requireRole.ts`.
- [~] Health/version diagnostics now exist at `/api/health` and Settings → System, but backup/restore and deployment runbooks are still missing.
- [ ] API response envelope standardization is incomplete — mixed raw payloads and `{ data }` responses remain across routes.
