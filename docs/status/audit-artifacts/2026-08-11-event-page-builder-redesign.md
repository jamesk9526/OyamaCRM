# Event Page Builder Redesign Audit — 2026-08-11

## Scope and baseline

The existing event page builder had a sound autosave/publish path and a shared preview/public renderer, but its workspace was desktop-heavy, the published theme hard-coded violet, global branding was not loaded, and several persisted content structures had no usable editor. Schedule, FAQ, and gallery blocks therefore behaved more like placeholders than complete production blocks.

The audit covered the builder shell, top command bar, block rail, inspector, shared document renderer, public event route, server sanitization, branding source, persistence tests, responsive behavior, dialogs, accessibility labels, loading/error feedback, and publish-readiness logic.

## Completed work

- Reworked the builder into a compact Fluent-style workspace with a searchable block library and responsive panel tabs.
- Loaded global branding once for the editor and once for public event payloads, with safe organization-facing fields only.
- Applied global name, logo, colors, tagline, mission, contact, address, legal, website, and social data to the shared preview/public document.
- Added Organization Banner, Highlights, Testimonial, Contact Organizer, and Accessibility blocks.
- Added real structured editors for schedule rows, FAQ entries, gallery URLs, highlight cards, and quote attribution.
- Added section surfaces, content widths, inherited/overridden accent colors, and functional custom background colors.
- Preserved existing page configurations by merging newly available blocks as disabled defaults; new pages start with a simpler Hero → Details → Registration → Footer flow.
- Kept existing autosave, preview, readiness, publish, deployment-history, slug, and payment-policy workflows intact.

## Validation

- `pnpm typecheck` — passed web and server TypeScript checks.
- Focused ESLint for the changed builder, public page, and server branding files — zero errors (four existing-style `img` optimization advisories only).
- `pnpm exec vitest run tests/smoke/events-crud.test.ts` — 48/48 passed.
- Live in-app browser: opened a real event-scoped builder, confirmed new blocks and primary commands, exercised responsive Sections/Preview/Settings navigation at 390×844, confirmed no document horizontal overflow, and opened/closed the preview dialog.
- `git diff --check` — passed.

## Operational boundary

Publishing remains intentionally gated by the existing readiness checks. Paid registration continues to follow the product's current payment-policy behavior; this redesign does not claim a new online payment integration.
