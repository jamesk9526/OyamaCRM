# OyamaCRM Status

_Last updated: 2026-05-18_

## Events CRM

The Events CRM is now oriented around a FundEasy / Attendance-style nonprofit fundraising event command center. FundEasy is used only as a functional workflow reference; OyamaCRM must not copy its branding, UI, code, or proprietary design.

| Area | Status | Notes |
|---|---|---|
| Event-first entry | Working | `/events/events` is the single sidebar entry for creating/selecting events; `/events/workspace` remains a compatibility route. |
| Event-scoped routes | Working | Core scoped tools route through `/events/[eventId]/...` so guests, tables, sponsors, registration, check-in, and reports stay tied to one event. |
| Event command center overview | Working | `/events/[eventId]/overview` now uses a polished purple command-center layout with selected-event header, at-a-glance KPIs, readiness checks, and operations sections. |
| Event lock behavior | Working | Event-scoped pages lock to the selected event; users switch only by returning to `/events/events`. |
| Guests / registrants | Working | API-backed guest list remains available at `/events/[eventId]/guests`. |
| Tables / seating list | Working | Structured table management is available at `/events/[eventId]/tables` with Floor Plan, Table List, and Guest Placement views. |
| Sponsors | Working | Event-scoped sponsor manager is available with event lock behavior in scoped routes. |
| Registration | Working | Current ticket type manager is used as the registration setup surface. |
| Live check-in | Working | Core check-in route is event-scoped with a simplified dark operations UI; dedicated volunteer/tablet mode is not complete. |
| Table hosts | Partially Working | Host workspace route exists, but host portal links, resend controls, permissions, and audit coverage are still required. |
| Event page builder | Partially Working | Canonical route is `/events/[eventId]/event-page`; compatibility selector remains at `/events/page-builder`; editor layout, drag/drop section ordering, hero settings, publish status, and section config persistence are working. Full public renderer parity is still pending. |
| Event emails | Partially Working | Scaffold route exists; segmented drafts, scheduling, and sending are incomplete. |
| Donations / pledges | Partially Working | Scaffold route exists; pledge workflows, recurring giving prospects, and donor follow-up conversion are incomplete. |
| Post-event follow-up | Partially Working | Follow-up queue UI and donor-safe export endpoint are available; orchestration and automation still need implementation. |
| Manager integrations | Partially Working | Admin-only import endpoint can snapshot donor payment/email settings into Events manager integrations. |
| Partial-feature warning popups | Working | Events partial tools now show explicit in-development popup + banner warnings to prevent false production expectations. |

### Events CRM Studio Redesign

| Area | Status | Notes |
|---|---|---|
| Dedicated Events shell | Working | `/events/*` now uses a dark studio-style Events shell instead of the shared CRM TopBar/Sidebar chrome. This is scoped to Events CRM only. |
| Event-scoped chrome | Working | `/events/[eventId]/*` inherits the studio header/sidebar and no longer adds the extra standard selected-event context bar. |
| Event Page Builder UI | Working | The scoped builder now has a left section rail, central public-page canvas, and right settings inspector modeled after a page-building workspace. |
| Drag/drop sections | Working | Section ordering supports HTML5 drag/drop plus fallback move buttons. Visibility can be toggled from the rail or inspector. |
| Builder persistence | Working | Page slug, publish status, section order, visibility, hero content, and hero design settings are saved through `/api/events/:eventId/page-builder-config`. |
| Public page config API | Working | Public event page payloads include saved section config, and draft pages return `NOT_PUBLISHED` instead of being publicly exposed. |
| Full public renderer parity | Working | The CRM builder preview and public page route now use the same saved section config/document renderer path for section order, visibility, and hero design. |
| Workspace switcher | Working | The Events studio top bar includes a workspace selector with links back to Donor CRM, Compassion CRM, Steward AI, HRM, Webmaster, and Watchdog. |

Canonical next build order: table host data model and staff UI, guest/table reassignment improvements, dedicated live check-in mode, full public page renderer parity with builder sections, event page templates, event email segments, event donations/pledges, and post-event follow-up dashboard.

## Steward AI Memory And Context

Steward AI now has a user-controlled memory and context-library foundation. Memories and uploaded context files are scoped to the authenticated user and organization; no global/shared AI memory is used.

| Area | Status | Notes |
|---|---|---|
| Session context | Working | Current chat messages remain temporary runtime context. |
| User memories | Working | Per-user memories can be created by explicit chat requests, the dedicated memory tool endpoint, or manual entry in AI Settings. |
| Memory controls | Working | AI Settings includes memory search/filtering, active/inactive toggles, manual add, delete, and clear controls plus a master memory toggle. |
| Memory rules | Working | Runtime prompt now separates session context, saved memories, uploaded files, and CRM tool data; only durable/reusable facts should become memories. |
| File context library | Working | AI Settings supports file registration, text extraction from browser-readable text files, tagging, workspace scope, activation, re-indexing, and deletion. |
| File retrieval | Working | Steward retrieval can search active indexed chunks for the current user and scoped workspace before answering. |
| CRM tool context | Working | Existing approved Steward CRM tools remain the source of truth for live CRM data. The AI is instructed not to guess from memory when live data or files should be retrieved. |
| Binary/PDF/image extraction | Partially Working | Files can be tracked and managed, but production PDF parsing, spreadsheet parsing, OCR, antivirus scanning, object storage, and vector embeddings are not yet implemented. Current indexing relies on supplied/extracted text. |

Canonical next build order: add server-side PDF/spreadsheet/image text extraction, file object storage, malware scanning, vector embeddings, relevance scoring improvements, and permission-aware CRM/file retrieval policies per module.
