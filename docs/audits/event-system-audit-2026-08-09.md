# Event System Audit — 2026-08-09

## Scope

This audit covered EventSTUDIO navigation, event creation, public event pages and RSVP, tables/seats/TableLink, check-in, reporting, Trivia planning and night-of operations, and the Trivia ↔ EventSTUDIO boundary.

## Product research translated into design requirements

- Cvent treats registration, guest data, check-in, and diagramming as one event lifecycle. Its diagramming product synchronizes attendee data into the visual plan and supports reusable layouts. Source: [Cvent event management features](https://www.cvent.com/en/event-management-software/features), [Cvent event design](https://www.cvent.com/en/event-marketing-management/cvent-event-design-software).
- Prismm makes tables, chairs, room objects, drag/drop placement, guest assignment, collaboration, and printable floor plans one seating workflow. Source: [Prismm table and chair layouts](https://support.prismm.com/hc/en-us/articles/10241921731740-Floorplan-Layouts-Add-Tables-with-Chairs), [Prismm guest seating](https://support.prismm.com/hc/en-us/sections/12733437836444-Assign-Guest-Seating).
- OneCause and GiveSmart connect nonprofit registration, sponsorships, tables, check-in, giving, and event-night displays rather than presenting them as unrelated tools. Source: [OneCause event fundraising](https://www.onecause.com/solutions/auction-events/event-fundraising/), [GiveSmart](https://www.givesmart.com/).
- Crowdpurr emphasizes a browser-based participant flow, varied question types, live presentation, streaming, and real-time leaderboards. Source: [Crowdpurr features](https://www.crowdpurr.com/features), [Crowdpurr live trivia](https://www.crowdpurr.com/).

The resulting Oyama model is: **EventSTUDIO owns the event record, public RSVP, tables, seats, guests, and check-in; Trivia owns game content, scoring, host controls, and projector state.** A Trivia event is never created without its linked EventSTUDIO record.

## Findings and action taken

| Priority | Finding | Status after this pass | Evidence |
|---|---|---|---|
| P0 | Trivia creation and EventSTUDIO creation were separate, manual steps that could leave two rosters or no durable event record. | Fixed | `POST /api/apps/trivia/events` now creates the Event, team ticket, published RSVP configuration, Trivia record, and automatic link; `app/apps/trivia/events/new/page.tsx` uses the unified workflow. |
| P0 | The public RSVP surface worked when manually configured, but a newly created Trivia event did not automatically have a published, usable RSVP page. | Fixed for new Trivia events | Connected creation publishes a unique public page with hero, event details, registration, map, sharing, and footer sections. A free or offline-follow-up team ticket is created with server-enforced capacity. |
| P1 | EventSTUDIO's mounted shell exposed only a subset of event tools in a narrow icon rail, while an older unmounted shell contained a different journey model. Important tools were effectively hidden. | Fixed in mounted shell | `EventsStudioShell.tsx` now renders the canonical Plan → Fill → Fundraise → Run → Follow Up map, includes every scoped tool, and has an event switcher that keeps the current tool context. |
| P1 | The “Floor Plan” was a card grid and ignored the already-persisted `xPosition` / `yPosition` fields. | Fixed | `app/events/tables/page.tsx` now provides a grid-based drag surface, snapping, optimistic persistence, auto-arrange, print, shape/fill/host state, and direct TableLink access. Server coordinate validation was added. |
| P1 | Trivia list actions could set a game live, complete it, or delete it with one click. | Fixed | Live, complete, and permanent delete now require a second confirmation; readiness gaps are visible before going live. |
| P1 | Paid public RSVP does not collect or verify card payment. | Open, explicit boundary | Paid team reservations persist as pending/offline-follow-up. A hosted or embedded verified payment adapter is still required before claiming end-to-end online payment. |
| P1 | Event module authorization is authentication-only at the layout boundary. | Open | `app/events/layout.tsx` still documents the missing module-level permission gate. Server routes perform organization scoping, but workspace licensing/permission enforcement is incomplete. |
| P2 | Trivia's server store is a per-organization JSON file while EventSTUDIO data is relational. | Open | Server sync, snapshots, and audit mitigate operational risk, but multi-instance concurrency and database-grade durability need a relational migration. |
| P2 | `EventSetupWorkspace` still contains mock readiness state and dead action cards, although `/events/setup` is documented as redirected. | Open cleanup | Remove the unreachable component or rebuild it on the event overview readiness APIs to prevent future accidental reuse. |
| P2 | Two event shells (`EventsStudioShell` and legacy `EventsShell`) remain in the source tree. | Open cleanup | The mounted shell is now canonical. Remove or refactor the unused shell after confirming no imports or documentation depend on it. |

## Cross-system layout scan

The source scan covered 283 route pages plus shared workspace components. Static signals found 29 components using viewport-height shells and 135 using `overflow-hidden`; those patterns are appropriate for builders and projector views but are recurrent clipping risks when nested. Fixed-width data surfaces are concentrated in Communications, Contacts, Reports, Email, Letters, LiveCom, Steward Paths, and System Status.

Highest-risk layout families for the next visual QA lane:

| Risk | Hotspots | Required check |
|---|---|---|
| Wide tables depend on horizontal scrolling | Communications logs, Contacts Manager, Constituents, Donor Reports, Oyama Email, LiveCom, Letters, System Status | Confirm the scroll container—not the page body—owns horizontal overflow, the first identifying column remains understandable, and row actions stay reachable at 360/390px. |
| Fixed inspector/control rails | Email Builder, Password, Steward Paths, WorkspaceFrame | Confirm rails collapse or stack below the canvas before 1024px and never leave a zero-width main canvas. |
| Nested viewport shells | Events, Trivia, builders, modal workspaces | Test browser chrome/safe-area changes and 200% zoom; avoid `h-screen` children inside another fixed-height app shell. |
| Large visual canvases | Event floor plan, Steward workflow canvas, email/letter preview | Horizontal pan/scroll is intentional, but primary actions and save state must remain outside the canvas and keyboard reachable. |

This pass directly corrected the mounted EventSTUDIO shell and seating canvas. The other product families remain audit findings, not claimed fixes.

## Public RSVP acceptance criteria

The EventSTUDIO RSVP flow is considered working for free and offline-follow-up reservations when all of the following hold:

1. A published unique slug resolves without authentication.
2. The page exposes an active ticket/team option and current capacity.
3. The server revalidates event, ticket, deadline, and capacity inside the registration transaction.
4. A submission creates the order, constituent link, table when applicable, seats, named guests, and check-in codes.
5. Success remains visible even when confirmation email delivery is unavailable.
6. The linked Trivia roster refreshes from EventSTUDIO rather than creating a second public roster.

Verified online payment is not included in this claim.

## Validation in this pass

- `pnpm typecheck:web` — passed.
- `pnpm typecheck:server` — passed.
- Focused source tests — passed, including Trivia event-night controls and the new connected-creation/layout assertions.
- Database-backed Events CRUD, TableLink, reporting, and isolation tests — blocked because MySQL was unavailable at `localhost:3306`; failures occurred during setup before workflow assertions.

## Next release gates

1. Start the local MySQL service and rerun Events CRUD, isolation, TableLink, public registration, and linked Trivia integration tests.
2. Add a database-backed test proving unified creation produces one linked Event, one team ticket, one published page, and a successful public RSVP.
3. Add complete Events module authorization at the layout and server-permission boundaries.
4. Decide whether verified Stripe Event checkout is required; keep paid RSVP labeled offline-follow-up until it exists.
5. Migrate Trivia state from the JSON store to relational, versioned records before multi-instance hosting.
6. Remove the unused event shell and unreachable mock setup component after import verification.
