# AI access and CRM workspace verification

Verified locally on 2026-11-05 with synthetic CRM records. The final catalog contains 50 resource families, 235 capabilities and 106 typed write actions, alongside the 13 existing letter, artwork and reporting tools. The catalog is generated from the server registry. [Catalog](capability-catalog.json)

## Automated checks

The focused suite passed 62 tests across the AI access HTTP/MCP handlers, OAuth compatibility, real database workflows and website publishing readiness. The database suite follows normal authenticated HTTP and MCP entry points and uses the native CRM handlers. Mail delivery uses a stubbed provider. [Test output](focused-tests.log)

```powershell
$env:AI_ACCESS_MYSQL_TEST_URL='mysql://root@127.0.0.1:33427/oyama_ai_test_migrations'
$env:DATABASE_URL=$env:AI_ACCESS_MYSQL_TEST_URL
pnpm exec vitest run tests/api/ai-access.test.ts tests/api/chatgpt-connection.test.ts tests/integration/ai-access-mysql.test.ts tests/unit/webmaster-publish-readiness.test.ts
```

The focused tests cover organization isolation, closed records, field-safe search, consent expansion and reductions, organization/role/user/connection precedence, CRM permission denials, stale policy saves, idempotency, concurrent worker claims, stale approvals and disconnect. Database cases also cover donor context, address and task changes, tags and relationships, chronological activity, gift correction, lapsed outreach, event registration, grants, volunteering, custom fields, imports, exports, Studio revisions, website publication, interrupted jobs and partial/cancelled batches. The running-batch test verifies that remaining items stop and completed outcomes persist.

Repository and server type checks, API compilation and targeted lint passed. The production web build used a 2 GiB Node heap. Two existing unused-function warnings remain in `server/src/routes/email-campaigns.ts` when that complete file is included in lint. The separate seeded full-server email workflow suite timed out in its startup hook and is excluded from the 62 passing tests.

## Database persistence

The isolated server was MariaDB 10.4.32 on loopback port 33427. Its data directory was inside the workspace under `.next/ai-access-db-20261105`. Both AI access migrations were applied among 56 SQL-bearing repository migrations. An unrelated empty local migration directory was omitted from the temporary migration copy used for this test. Production database credentials and records were outside this setup.

A queued synthetic task survived a full database shutdown and restart. Two worker calls then claimed it, producing one successful operation and exactly one task. A separate stale fixture was rejected after its related record changed. The interrupted-worker regression test retains an `INTERRUPTED` outcome across subsequent scans and confirms that the provider call is not repeated. [Restart result](restart-result.json)

## Browser and visual checks

The browser fixture uses synthetic API responses and the compiled production application. It verifies consent identity and errors, login return, keyboard copy, public-route setup feedback, field restrictions, preset differences, effective-access explanations, approval, batch cancellation, legacy controls and disconnect. Desktop, tablet and phone checks report no uncaught page errors or horizontal document overflow. [Browser results](browser-checks.json)

The prior integration screen remains the connection entry point. The new access manager uses the application's navy text, blue actions, light surfaces and Settings navigation. Phone controls stack vertically, and approval values appear in separate before/proposed panels. The existing release banner was dismissed through its normal button when capturing the final workspace views. The letter-editor screenshot supplied earlier does not serve as a reference for this Settings screen.

| View | Earlier or entry view | Final view |
| --- | --- | --- |
| Connection setup | [Earlier integration](before-setup-desktop.png) | [Workspace connection entry](setup-ready-desktop.png) |
| Access manager | [Integration controls](before-settings-desktop.png) | [Desktop capability matrix](ai-access-matrix-desktop.png) |
| Mobile settings | [Earlier mobile controls](before-settings-phone.png) | [Phone access workspace](ai-access-phone.png), [field controls](ai-access-fields-phone.png) |
| Financial approval | New workspace | [Phone approval](ai-approval-phone.png) |
| Bulk progress | New workspace | [Phone batch progress](batch-progress-phone.png) |

## Deployment and acceptance still required

- Deploy the API and web together, apply migrations on the installation's MySQL version, generate Prisma and restart workers.
- Review unassigned legacy household, tag and designation ownership before exposing those records.
- Refresh ChatGPT metadata and reconnect for expanded scopes or automatic execution. Existing `letters.write` consent remains limited to its original draft tools.
- Complete all six acceptance conversations through the real ChatGPT connection and compare their records and financial results with CRM.
- Verify actual email delivery and optional paid image generation with the installation's providers and current organization policy.
- Exercise the remaining individual action variants on staging. The local suite covers each major family and checks declared native endpoints, while the catalog contains more actions than the individual database scenarios.

AI-created Steward enrollments start paused. Automatic triggers and external-delivery paths use the native review workflow. Imports currently create new constituents and skip existing matches. Analytics calculate at most 50,000 historical gifts before directing larger histories to the established report library. These limits are exposed in the tool responses and setup guide.

## Allow all and Settings follow-up

Added an administrator Allow all preview at organization, role and user policy levels. Applying it makes current capabilities automatic and removes restrictions at the selected level; organization ceilings, CRM permissions, integration controls and renewed consent remain enforced. Connections can only narrow access. AI access and connection setup now copy the same policy-derived scope list. Removed the obsolete read-only scope hint from the unauthenticated MCP challenge.

The Settings subagent consolidated navigation into six shared categories, added searchable overview cards and fixed active-route matching. Inspected desktop overview and phone scope-copy screenshots: readable spacing, wrapped content and accessible copy controls. Browser assertions cover search/reset, navigation, policy preview/save and clipboard contents on both setup screens.

Validation: 44 focused API tests passed, web/server type checks and targeted lint passed, and the production Next build passed. The final copied-state reset is a small subsequent UI adjustment. The synthetic browser fixture completed without page errors; it does not certify live policy persistence or real ChatGPT authorization. See browser-checks.json, settings-overview-desktop.png, settings-overview-phone.png, settings-categories-phone.png and allow-all-scopes-phone.png.

Public production probes returned 200 for OAuth discovery, resource discovery and health, and the expected unauthenticated 401 for MCP. Supplied PM2 logs show successful API starts and sanitizer warnings without a crash trace; the earlier 502 cause remains unconfirmed. These local changes have not been deployed. Real ChatGPT reconnection and expanded-consent acceptance remain required.
