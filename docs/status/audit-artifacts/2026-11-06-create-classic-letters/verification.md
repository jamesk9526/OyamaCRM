# Create v5 classic Letters pilot verification

The browser fixture uses synthetic records and intercepted CRM requests. The print fixtures use fictional recipients and the repository renderers. The database checks ran against a new loopback MariaDB schema.

## Visual review

| Viewport | Evidence |
|---|---|
| 1600 × 950 | [Desktop](desktop.png), [split PDF proof](desktop-proof.png) |
| 1280 × 780 | [Laptop](laptop.png) |
| 900 × 720 | [Compact](compact.png) |
| 430 × 790 | [Mobile](mobile.png), [properties overlay](mobile-properties.png) |

Compared with the v5 references, the pinned chrome, rail, dock widths, ribbon hierarchy, and overlay breakpoints follow the supplied workspace. The latest Letter screenshots supply the continuous paper, native rulers, recipient letterhead, and beside-the-canvas proof. The Pages navigator populates from the PDF after a proof is rendered. [Browser assertions](browser-checks.json)

The continuous classic writing surface and native font controls are intentional departures from the earlier Studio paper mockup. Physical page boundaries come from the PDF. The split proof screenshot displays an intercepted synthetic PDF so its page count and viewer interactions can be exercised independently of CRM data. Actual renderer comparisons are recorded below. Screenshots precede the final commit-phase editor handle and conversion filtering fixes.

## Print and data checks

- The short US Letter, three-page Legal household letter with a giving table, and A4 organization letter matched the classic renderer page for page. All five raster comparisons were pixel-identical on this host. Re-rendering the same frozen inputs produced identical PDF bytes. [Geometry and checksums](print-checks.json) [Raster results](raster-comparison.json) [Household letter](household-table-production.pdf)
- The Avery fixture kept three recipients in order, starting at slot 29 and continuing onto a second sheet. [Label PDF](labels-start-29.pdf)
- Eleven isolated MariaDB checks passed, including migration, a single working copy per content piece, guarded revision contention, and unchanged legacy template rows.
- The main focused run passed 303 tests in 21 files. It covers private working copies, direct Studio Letter write rejection, rollback, stale conversion previews, personalized-field handling, and sensitive proof denial. The final review run passed 31 tests in four files, including four additional cases for safe organization fields, recipient CRM blocks, saved shared copy, accepted original snapshots, and the latest Studio body. These run counts overlap. [Test summaries](checks.json)
- Web and server type checks passed after the final behavior changes. ESLint passed on every changed TypeScript and React file. The web production build and server emit completed in the main run. [Successful build](web-build.log) [Final rebuild attempt](final-build.log)

## Verification limits

- A full local migration-chain attempt in a new disposable schema stopped with Prisma P3015 at the existing empty `prisma/migrations/20260813190000_add_client_crm_addon` directory. The new additive migration passed the separate eleven-test migration and contention suite. The existing directory was retained.
- The database-backed merge-alias and email workflow suites require a seeded disposable CRM schema. Their initial local run could not reach a CRM database. Automatic approval review then rejected the isolated database rerun because the approval service usage limit had been reached. This prevented the additional check from executing.
- A later HTTP API rerun was denied loopback access by the sandbox with `EACCES`. The earlier 303-test run used permitted loopback access. The saved-shared-copy, accepted-source and Studio migration cases were verified directly with the repository memory database and no network.
- The final production rebuild stopped with sandbox `EPERM` while creating the generated `communications/[campaignId]` directory. Final web and server type checks and scoped ESLint passed. The earlier complete production build succeeded before the final review changes. The final build remains a staging check.
- Three source-text smoke assertions fail on strings already absent from `HEAD` before these changes. They expect `Click the page to write`, `/settings/branding#communication-header-footer`, and `Send To Letters Workspace`. The other ten assertions in that suite pass. These source checks were retained.
- The updated standalone desktop/phone browser fixture still needs its final rerun after the API rerun was blocked. The primary four-size Create browser fixture passed before the final review changes. Representative CRM letters, migrated advanced print packs, connected ChatGPT updates, physical printing and configured delivery providers require staging acceptance.

## Rollout

Apply the additive migration on staging and deploy compatible API and worker versions. The classic Letters pilot starts disabled. Saved classic drafts remain on the classic canvas after the flag is turned off. Current v5 digital editors and the standalone workspaces remain available.

Default rollout requires representative real-letter comparisons, physical printer and Avery alignment, separate provider acceptance, and the remaining API/browser checks above. The pilot default stays disabled.
