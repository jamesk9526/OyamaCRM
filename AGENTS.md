# OyamaCRM Working Rules

This file is the lightweight reset.

Use judgment. These are guardrails, not handcuffs.

- Favor small, clear, reversible changes.
- Let the current user request override older style preferences when they conflict.
- If a rule here gets in the way of a safer or clearer fix, document the tradeoff and choose the safer path.

## 1. Build on what exists

- Verify unusual Next.js behavior against the local docs in `node_modules/next/dist/docs/` before relying on memory.
- Keep pages thin. Put reusable UI in `app/components/` and keep feature logic near the module that owns it.
- Default to Server Components. Add `"use client"` only where client state, handlers, or browser APIs are actually needed.
- Prefer one canonical workflow over duplicate pages, duplicate toolbars, or legacy parallel flows.

## 2. Product boundaries

- DonorCRM lives in `app/` and uses donor, donation, campaign, communication, and fundraising language.
- Compassion CRM lives in `app/compassion/` and uses client, case, appointment, service, and care-plan language.
- Donor records and client records stay separate unless staff intentionally links them through the shared person layer.
- Standalone apps live under `/apps/*` and should not masquerade as CRM modules.
- Events tools should stay event-scoped when they act on a selected event. Global event tools must be clearly labeled.
- Reference projects in `REFERANCE_SOFTWARE/` are for workflow ideas only. Do not copy stale architecture or product-specific assets blindly.

## 3. Safety and data rules

- Keep draft-first and review-first defaults for outbound communication, publishing, imports, merges, and other high-impact writes.
- Respect communication preferences and opt-outs.
- Protect Compassion CRM privacy. Sensitive client data must not leak into DonorCRM, Events, or public surfaces.
- Public scheduling and similar public flows must validate on the server.
- Meaningful create, update, import, merge, and delete actions should be audit-friendly.
- Steward and AI-assisted donor actions must use permissioned server paths, not open-ended model-generated SQL.
- Do not leave fake, placeholder, or misleading production behavior exposed as if it were complete.

## 4. Refactors are allowed

- If the current structure is confusing, refactor it incrementally instead of adding more clutter.
- Keep public routes compatible with redirects or wrappers when moving pages.
- Use additive migrations before cleanup. Do not drop working data paths in the same pass that introduces replacements.
- Do not remove a working user flow until the replacement is at least as safe and functional.

## 5. Status and docs

- Allowed status labels are exactly: `Working`, `Partially Working`, `Demo Only`, `Broken`, `Not Implemented`.
- Keep release claims honest. Missing evidence means not `Working`.
- Update relevant docs when behavior, routes, or readiness change. Default status docs:
  - `docs/status/features.md`
  - `docs/status/production-readiness-checklist.md`
  - the module-specific audit or plan for the area you changed

## 6. Plans and execution

- When executing a markdown plan, do one phase at a time, finish it end-to-end, update status, then stop for confirmation before the next phase.
- Prefer current-state evidence over older roadmap language.

## 7. Repo hygiene

- Keep the repo root clean. Do not commit scratch logs, one-off output dumps, or temporary validation files there.
- Put durable audit artifacts under `docs/status/audit-artifacts/`.
- If you add a temporary file to debug something, remove it before you finish.