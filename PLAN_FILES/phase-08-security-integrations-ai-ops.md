# Phase 08 — Security, Integrations, AI, Operations

## Goal

Harden the system for real donor data, external integrations, and reliable long-term operation.

## Scope

- Security/privacy controls and audit completeness
- Public API boundaries and payment integration
- Imports/exports/files/jobs reliability
- AI drafting with approval workflow and provider abstraction

## Manageable steps

1. Enforce RBAC on sensitive actions and exports.
2. Finalize audit log coverage for high-risk events.
3. Add public API protections (rate limit, validation, anti-bot).
4. Finalize payment/webhook idempotent processing.
5. Implement import pipeline, rollback, and duplicate handling.
6. Implement private file handling + signed access.
7. Add background jobs visibility, retries, and dead-letter handling.
8. Add AI provider abstraction with strict draft/approval semantics.
9. Add runbooks for backup/restore and incident response.

## Exit criteria

- Production security controls are enforceable and auditable.
- External integrations are reliable and recoverable.
- AI outputs are controlled, reviewable, and non-autonomous.

## Audit snapshot — 2026-05-08

- [x] Password hashing, JWT auth, refresh rotation, and rate limiting are working — `server/src/lib/auth.ts`, `server/src/routes/auth.ts`, `server/src/index.ts`.
- [x] Health/version diagnostics exist — `/health`, `/api/health`, and Settings → System / System Status.
- [~] RBAC, audit coverage, and deployment hardening are partial — middleware exists, but broad enforcement and viewer UI do not.
- [ ] Integrations, AI provider abstraction, queue/jobs, and backup/restore documentation are not started in usable code.
