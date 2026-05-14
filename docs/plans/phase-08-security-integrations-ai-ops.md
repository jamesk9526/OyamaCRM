# Phase 08 — Security, Integrations, AI, Operations

## Goal

Finish the hardening and provider integrations needed for production-grade donor data handling.

## Already in place

- bcrypt + JWT auth
- Refresh-token rotation
- Rate limiting
- Health/version diagnostics

## Remaining scope

- CSRF hardening review
- Two-factor auth
- Audit log viewer UI
- Sensitive-field protection
- Payment/email integrations
- Import/export reliability
- Private files / signed access
- Background job visibility
- AI approval workflow

## Remaining implementation steps

1. Review CSRF posture and add missing protections.
2. Build TOTP-based two-factor auth.
3. Build the audit log viewer UI.
4. Add field-level protection for sensitive notes/files where needed.
5. Add payment and email provider integrations with robust webhook handling.
6. Add job/queue visibility, retries, and dead-letter handling.
7. Add AI provider abstraction with human approval before send/save.

## Exit criteria

- Production-sensitive features are enforceable, auditable, and recoverable.
