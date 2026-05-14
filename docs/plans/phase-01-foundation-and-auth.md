# Phase 01 — Foundation and Auth

## Goal

Finish the remaining platform-level blockers so later features sit on stable API, auth, and audit conventions.

## Already in place

- Login, refresh, logout, and current-user flows
- First-run setup enforcement
- Health/version diagnostics
- Base `requireAuth` / `requireRole` middleware

## Remaining scope

- API response-envelope standardization
- Broader route-level RBAC
- Generalized audit coverage
- CI and operator-quality guardrails

## Remaining implementation steps

1. Standardize all remaining routes to `{ success, data, meta, error }`.
2. Apply route-level RBAC to sensitive settings, exports, and destructive workflows.
3. Replace scattered audit writes with shared audit helpers/services where needed.
4. Add CI automation for lint, tests, and smoke checks.

## Exit criteria

- API contracts are consistent across remaining routes.
- High-risk actions are protected server-side by auth + role checks.
- Audit coverage is broad enough for production-sensitive actions.
