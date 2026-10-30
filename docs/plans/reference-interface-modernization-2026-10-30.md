# Reference interface modernization

## Contract

Use the supplied fundraising mockup as a visual reference: navy navigation (#10283F), off-white canvas (#F8FAFB), navy headings (#101F43), teal actions (#007F80), self-hosted Inter, restrained borders and shadows, and 8–12px corners. Preserve routes, permissions, business logic, integrations, existing controls, and module boundaries. The earlier task/notification and donor follow-up work remains a separate, explicitly requested functional change.

## Structure inspected

- `app/layout.tsx` loads the shared styles. `AppShell`, `TopBar`, and module sidebars own navigation and workspace chrome.
- `EnterprisePageShell`, `Card`, `ActionButton`, and the CRM primitives own reusable page, metric, table, and status presentation.
- Donor-specific browse primitives consolidate filters, pagination, and record action presentation.
- Events and Compassion have their own shells and public experiences. Settings, Watchdog, Webmaster, and Steward Paths have module-specific layout roots.

## Implementation

`app/design-system.css` owns tokens, fonts, common controls, cards, typography, tables, and modal presentation. `reference-shell.css` owns shared navigation chrome. `module-design-adapters.css` maps existing module surfaces onto those tokens. Existing appearance choices remain available. Public pages, event documents, authored website canvases, email bodies, and projector output retain their authored presentation; use `data-oyama-authored` on any additional authored canvas embedded in an internal workspace.

Shell and module presentation were delegated to subagents; root reviewed shared styles and integrated verification. No navigation catalog or route replacement is part of the visual work.

## Validation

See `docs/status/audit-artifacts/2026-10-30-reference-modernization/verification.md` for actual checks and remaining limits. Browser fixtures are synthetic and isolated from application storage. Do not interpret them as deployed production or database integration verification.
