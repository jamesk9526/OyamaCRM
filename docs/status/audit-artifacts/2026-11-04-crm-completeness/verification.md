# CRM completeness and reliability audit — 2026-11-04

This pass inventories the CRM and fixes verified workflow defects. It does **not** certify every screen, provider, or database workflow as production-ready. The repository contains 308 application page files, 54 files in the main server routes directory, and ten launcher applications. Subagents reviewed navigation, backend authorization/data validation, clinical/automation behavior, and remaining module workflows; the final changes received a separate regression review.

## Implemented corrections

| Area | Before | Result |
| --- | --- | --- |
| Create Studio | Format switching restored a block but could move the caret to its beginning. | Stable block-relative bookmarks preserve text offsets, backward selections, and selected nodes. Both canvases remain mounted after first opening, retaining their editor histories. A shortened channel customization clamps the selection safely. |
| Organization settings | Settings could target the oldest installation organization; reads included the SMTP password. | Authenticated organization scope is authoritative; missing organization context fails closed. SMTP passwords are never returned, configured state is explicit, and an unchanged blank field preserves the credential. |
| Security/workspace settings | A failed initial read still enabled saving default values. | Controls and handlers require a successful read. Load retry and save failures are explicit; entered changes survive a failed save. Obsolete workspace appearance instructions were corrected. |
| Meetings | Defaults only simulated saving, scheduling ignored them, and the form could submit twice. | Tenant-scoped audited settings persist. New meetings use default duration; timeline preferences and optional follow-up tasks are implemented. One form submission creates one request. |
| Meeting lifecycle | Related records were insufficiently validated and PATCH could bypass lifecycle actions. | Staff/tenant relationships and inputs are validated. Completion/cancellation/no-show use revision-checked transactions; repeated successful actions do not create duplicate follow-ups. Bodyless action requests remain supported. Completion outcomes remain in timeline evidence. |
| Meeting follow-up | The view queried only the legacy status and omitted completed meetings flagged for follow-up. | The filter includes flagged, noncanceled meetings and legacy follow-up records under the same tenant/personal visibility predicate. Failed completion retains the outcome for retry. |
| Grants | Invalid dates, amounts, booleans and foreign/inactive/clinical assignees could reach writes. | Create/update reject them before persistence or assignment notification. Zero amounts and explicit clearing remain supported. |
| Volunteers | Only the first 100 records appeared as the total; Add Volunteer opened a donor form. | Server pagination, accurate totals, search request ordering, load retry, and distinct empty/error states. Volunteer creation starts with VOLUNTEER; ordinary constituent creation retains DONOR. |
| Payments | An admin-only provider health failure discarded the successful staff ledger request. | Ledger and gateway diagnostics load independently. Staff can browse the ledger without requesting admin diagnostics. Admin failures show unavailable state and retry. Server pagination/name-email search and an explicitly labeled current-page receipt/method filter preserve access to records beyond the first 100. |
| Quick Gift | Failed campaign/fund lookups silently became empty choices; saving could omit intended attribution. | Independent lookup errors and retries preserve entered values and successful choices. The button and submit handler require loaded choices. Amount parsing rejects nonfinite/partial values and the initial gift date uses the local calendar day. |
| Event workspace selector | Summary failure could discard the list or imply zero totals. | List and summary recover independently, unavailable counts stay explicit, filters work, and failed lists cannot masquerade as empty data. This component is at `/events/workspace`; the separate canonical `/events` registry remains intact. |
| Scheduled email | A full first batch of paused/failing campaigns could starve later due campaigns. | Deterministic schedule/ID traversal advances across batches, revisits earlier entries after a sweep, and retains its position after a scan failure. |
| Compassion conversations | Conversations longer than 250 messages returned the oldest 250. | Staff and client portal return the newest 250 in chronological order, with tenant/client boundaries, encryption and read auditing retained. |

The shared setup-modal viewport correction and its final browser acceptance are recorded below when verified. Existing clinical work, approved outputs and financial history are preserved. No schema migration was added by this audit; meeting defaults use the existing tenant PluginSetting record.

## Coverage inventory

“Source” means code and existing test contracts were inspected; it does not mean a fresh authenticated end-to-end run. The database-independent test results below cover multiple modules, but mocks cannot establish database locking or real provider behavior.

| Application / module | Coverage in this pass | Further verification |
| --- | --- | --- |
| Donor CRM — contacts, groups, imports, closure | Route/navigation inventory; constituent giving/browse/dashboard API tests; broad identity/import/merge unit coverage. | Deployed role-specific CRUD, large imports and reconciliation against a disposable database. |
| Giving / fundraising / payments | Ledger and Quick Gift corrections; financial/date unit suites, donation follow-up API and matched-label permission regression. | Provider sandbox, finance reconciliation, full reporting and organization-currency display. |
| Volunteers | Production-browser pagination/search/race/error/retry/new-type checks and desktop/phone evidence. | Representative organization data and role-specific acceptance. |
| Tasks / meetings | Meeting defaults/lifecycle API tests and browser interaction; task workflow/overdue API tests. Tasks owns work tracking; no separate Projects application exists. | Actual MySQL contention and deployed notifications. |
| Reports | Report authorization/source review; custom report and donor metric API tests; broad report/money/period unit suites. | Database-backed financial comparisons and export review. |
| oyamaCreate | Selection correction; shared/customized Email editing, Trash, desktop/tablet/phone browser checks; Studio, release and Trash API tests; image/media/PDF checks. | Existing Create migration/concurrency gates, live inbox clients, physical printing and organization rollout. |
| Compassion | Latest-message fix and isolated mocked recent-history/ultrasound API tests; existing boundary/encryption tests. | Full disposable clinical-database workflow and deployed access checks. No clinical records were written. |
| EventSTUDIO | Workspace selector and registry browser checks; event creation API and broad event unit suites. | Database-backed reporting, provider sandbox and deployed public registration/check-in/seating. |
| Steward Paths / Copilot | Source inventory, playbook/pairing/feedback API tests and broad prompt/action/eligibility unit tests. | Live model grounding, external actions and multiprocess worker claiming. |
| Webmaster | Source inventory of editor/publishing/rollback and existing readiness/editor unit contracts. | Deployed publishing, form matching, permissions and public-route acceptance. |
| Watchdog / Password / Trivia | Launcher/routes and test inventory; existing related unit suites included in broad run. | Fresh authenticated browser/security workflows and representative staff devices. |

## Verification results

- **986 unit tests pass across 123 files**, using `vitest run tests/unit --exclude tests/unit/event-reporting-service.test.ts`. The excluded suite requires MySQL and failed initialization because localhost:3306 is unavailable.
- **229 tests pass across 25 selected database-independent API files**, including real HTTP handlers with synthetic Prisma/provider dependencies. Results include settings tenant/secret boundaries, grants, meetings, recent clinical messages, ultrasound workflow, tasks, reports, donor metrics, notifications, Create and sensitive mailing-label denial.
- Existing source-contract expectations for current navigation, dashboard disclosure, public event responsive classes and v2 build metadata were reconciled with the implementation. An obsolete mailing-label permission mock was corrected without bypassing the real guard; a staff sensitive-output denial test was added.
- A wider API attempt also encountered the database-backed Compassion client-care suite at initialization; it could not connect to localhost:3306. It is excluded from the successful database-independent API run rather than reported as passed. Initial sandboxed Vitest attempts failed temporary-file renames; the same isolated suites passed with the runner outside that restriction.
- Web production build, server type check and server production build pass. Targeted lint on the audit files has zero errors; one pre-existing unused catch variable warning remains in the installation-reset section of settings.ts.
- Final browser results and shared-modal verification are listed below after completion. All browser CRM/auth writes are intercepted, use explicitly synthetic records, and never send real messages, gifts or settings to the CRM.

Machine-readable test summaries are in `test-summary.json`. The browser fixtures themselves document their intercepted endpoints and assertions.

## Images, signatures and proofs

The production-browser media fixture passes ten grouped checks using **real Express anonymous media routes through Next** and synthetic CRM/auth responses. Logos, transparent white artwork, signatures, asset thumbnails and story images decode visibly in Brand Hub, Letter, Email, standalone outgoing HTML and phone email. A two-page production Chromium PDF still renders after the source uploads are removed, demonstrating frozen artwork.

Both new PDF pages were rasterized with Poppler at 100 DPI and inspected: visible logo, story photo, one signature group, continuation content, footer and page numbering; no missing artwork or visible clipping. Poppler emitted missing Symbol/ArialUnicode display-font warnings; the inspected fixture content rendered correctly. See [media browser checks](../2026-11-04-create-media/browser-checks.json), [page 1](../2026-11-04-create-media/letter-images-page-1.png), [page 2](../2026-11-04-create-media/letter-images-page-2.png), and [PDF](../2026-11-04-create-media/letter-images-proof.pdf).

Create's final production browser fixture also verifies the **exact selected text** survives Letter → Email, shared edits update Letter, protected Email edits remain separate, pattern insertion/undo, responsive layouts and reviewed Trash/restore. See [Studio browser checks](../2026-11-04-create-word-studio/studio-browser-checks.json).

The original live missing-logo screenshot and read-only route diagnosis remain in the media audit. The approved Studio mockup remains the design reference; this audit preserves that workspace composition and corrects behavior. No pixel-equivalence claim is made for synthetic fixtures or unseen live organization data.

## Release limits and remaining audit work

- Deploy the API and web changes together and repeat authenticated acceptance with staff/admin roles. This pass performs no deployment, live sending, publishing, payment processing or production printing.
- Use disposable CRM and Compassion MySQL schemas for migrations, full persistence, tenant relationship reconciliation and concurrency. Existing Create/Trash migration requirements remain in force; no database-backed migration/contention result is claimed here.
- The email traversal fix does not establish multiprocess delivery exactly-once behavior. Rehearse worker claims, reconciliation, cancellation, opt-outs and callbacks against the real deployment and provider test accounts.
- Compassion currently returns the latest 250 messages without older-history pagination. Older-history navigation remains a follow-up item.
- Manual meeting end times still use the start date; an explicit after-midnight end date needs a separate control. Untouched default-duration scheduling correctly carries into the next day. Meeting follow-up flags are staff-controlled and do not automatically clear when a linked task completes. Historical invalid meeting relationships need database reconciliation.
- The existing Payments currency formatter remains USD-specific. Do not claim organization-currency parity until that wider financial display work is complete.
- The report workbook's designation lookup still falls back to an empty list on failure; main report failures do surface. Add a distinct lookup-unavailable/retry state in a later report-focused pass.
- Real Outlook/Gmail external-image rules, Azure/Meta readiness, device IME/pointer interactions, deployed public forms and physical printer output remain outside synthetic browser verification.
- Create Studio/Brand rollout continues under organization flags. Rollback restores prior navigation/editor entry points while retaining drafts, revisions, Trash and approved artifacts.

The repository advanced to commit `26f965a8` during this audit while the changes were being verified. Existing changes were retained; no reset, clean, history rewrite or migration was performed.
