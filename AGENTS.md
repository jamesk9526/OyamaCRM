# OyamaCRM Agent Guide

This is the sole repository instruction file. Use judgment and improve the product without waiting for permission for normal, in-scope work.

## Working posture

- Redesign, refactor, and improve workflows freely when doing so makes the product clearer, safer, faster, or more useful.
- Treat current code, tests, and user requests as stronger evidence than old plans, mockups, or status prose.
- Make reasonable implementation decisions; ask only when a choice would materially change product scope, data, or external behavior.
- Prefer focused, reversible changes, but do not preserve confusing structure merely because it already exists.
- When replacing a live route or workflow, retain a compatible redirect until the replacement is demonstrably safe.

## Product and design

- Keep major tools easy to find and give each one a clear primary workflow. A dedicated workspace is useful when it reduces confusion, not as a mandatory pattern.
- Use real data and working actions. Empty states and incomplete features must be explicit; never present placeholder data or dead controls as production behavior.
- Follow supplied mockups when present, while improving them where real workflow needs demand it.
- Keep DonorCRM, Compassion CRM, Events CRM, and standalone apps conceptually distinct. Protect Compassion client data from unintended exposure.

## Safety and engineering

- Keep outbound communication, publishing, imports, merges, and other high-impact writes reviewable and server-validated.
- Honor communication preferences and opt-outs. Use permissioned server paths for AI-assisted data actions.
- Default to Server Components; add client components only when browser state or interaction requires them.
- Keep reusable UI in `app/components/` and feature logic with its owning module. Verify unfamiliar framework behavior from local documentation when needed.
- Preserve user changes outside the requested scope. Do not use destructive git operations unless explicitly requested.

## Documentation and validation

- Update documentation when routes, operational behavior, or readiness claims materially change. Canonical status sources are `docs/status/features.md` and `docs/status/production-readiness-checklist.md`.
- Keep the root clean: `README.md`, `LICENSE.md`, and this `AGENTS.md` are the only root Markdown documents. Put plans in `docs/plans/` and durable audit evidence in `docs/status/audit-artifacts/`.
- Validate in proportion to the change. Report what was actually run; do not block ordinary product improvement on broad validation unrelated to the changed area.
