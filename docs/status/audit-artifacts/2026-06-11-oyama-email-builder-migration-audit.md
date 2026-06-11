# OyamaEmail Builder Migration Audit - 2026-06-11

## Scope

- Canonical OyamaEmail template builder route and editor.
- Server rendering path used by template preview, test send, and publish/send handoff.
- Legacy template JSON conversion and `/email-builder` direct-route compatibility.

## Findings And Actions

| Area | Status | Evidence |
|---|---|---|
| Starter-template overwrite bug | Working | `server/src/routes/oyama-email.ts`, `tests/api/oyama-email-merge-preview.api.test.ts` |
| Tiptap editor migration in canonical builder | Working | `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx`, `pnpm typecheck` |
| Saved plain-text override | Working | `app/components/oyama-email/OyamaEmailBuilderWorkspace.tsx`, `server/src/services/oyama-email/email-render-service.ts`, `tests/unit/oyama-email-render-service.test.ts` |
| Legacy block conversion into OyamaEmail renderer | Working | `server/src/services/oyama-email/email-render-service.ts`, `tests/unit/oyama-email-render-service.test.ts` |
| Direct legacy builder route consolidation | Partially Working | `app/email-builder/page.tsx` redirects to OyamaEmail; high-traffic links now open `/oyama-email/templates/*/builder` |

## Guardrail Details

- Existing templates with malformed, empty, or missing `templateJson` recover from persisted `bodyHtml/bodyText` instead of returning the default starter document.
- Server PUT requests that attempt to save the starter template over existing non-starter content are rejected with `TEMPLATE_DEFAULT_GUARD`.
- Legacy tokens such as `{{eventDate}}`, `{{eventTime}}`, `{{eventLocation}}`, and `{{donor.preferredName}}` resolve through the canonical merge-field catalog.

## Remaining Risks

- Embedded legacy `EmailBuilderApp` imports still exist in Steward and Communications surfaces. Direct links now open OyamaEmail, but full component removal needs a separate parity pass.
- AI route names still include `/communications-ai/email-builder/*` for compatibility with existing builder-writing calls.
- Full email-client visual QA was not run in a browser in this pass; renderer unit and API coverage were added for conversion and data-loss risks.

## Validation

- `pnpm exec vitest run tests/api/oyama-email-merge-preview.api.test.ts`
- `pnpm exec vitest run tests/api/oyama-email-merge-preview.api.test.ts tests/unit/oyama-email-render-service.test.ts`
- `pnpm typecheck`
