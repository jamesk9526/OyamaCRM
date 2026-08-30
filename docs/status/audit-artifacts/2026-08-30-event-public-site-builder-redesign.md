# Event Public Site Builder Redesign Audit — 2026-08-30

## Scope

The pass covered the event-first launcher, event-scoped builder shell, command bar, section structure panel, property inspector, responsive preview canvas, full-screen preview, published public-page frame, autosave state, site slug, payment policy, launch readiness, and publish/unpublish actions.

## Problems found

- The interface mixed Fluent, violet card-dashboard, and browser-mockup styles.
- Section visibility was duplicated in the structure rail and inspector.
- Hidden sections remained mixed into the active page order while also appearing in an Add Section library.
- The top bar exposed two similarly weighted previews even though the event page was already visible in the canvas.
- Status/readiness information used a large collection of chips and cards that reduced working space.
- Preview chrome nested the public page inside several decorative frames.
- The published route displayed the public page inside a CRM-like centered card instead of as a real edge-to-edge website.
- Move-up/down acted on hidden section positions, which could make a visible move appear to do nothing.

## Completed redesign

- Rebuilt the editor as a high-density industrial workspace with a graphite command deck, steel structure/properties panels, a neutral live canvas, consistent square controls, restrained color, and visible focus states.
- Made Structure the only place for ordering and visibility. Hidden blocks now live only in the searchable section library; Properties owns content, data binding, design, and advanced values.
- Reworked visible section movement to skip hidden section positions, preserving predictable ordering.
- Consolidated page identity, autosave/deploy state, full preview, registration test, launch checks, slug, payment policy, and publish/unpublish into one command deck.
- Added event-context back navigation and a live-site action that appears only when the page is actually published.
- Rebuilt mobile navigation around canonical Structure, Canvas, and Properties panels.
- Added Escape handling and a clear close control to the full-screen preview.
- Rebuilt the event-first launcher with loading, error/retry, and empty states.
- Removed the centered application frame from published event pages so the shared event document renders edge to edge.

## Preserved behavior

Existing section data, section types, shared preview/public rendering, global branding, autosave, page slug persistence, payment policy, registration preview, guarded publishing, deployment history, and public registration remain on their existing server contracts.

## Validation

- `pnpm typecheck:web` — passed.
- `pnpm build` — passed; all 188 static pages generated and the public event/builder routes compiled.
- `tests/unit/navigation-boundaries.test.ts` — 7/7 passed.
- `git diff --check` — passed.
- Focused ESLint could not start because the local pnpm installation is missing `hasown/index.js` under `es-abstract`; no lint result is claimed.
- The database-backed Events smoke suite could not run meaningfully because MySQL was unavailable at `localhost:3306`; its failures were connection/cascade failures, not builder assertions.

## Release note

The production build and source-level checks are green. Before a public launch, rerun the Events smoke suite with the configured MySQL service available and exercise publish/registration against the intended environment.
