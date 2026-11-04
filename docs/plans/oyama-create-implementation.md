# oyamaCreate implementation and rollout

Updated 2026-11-03. Preserve the pending Compassion work. Clinical charts, documents, memberships, and clinical merge contexts are not connected to Create.

## Workspace and records

`/oyama-create` contains Home, Campaigns, Library, Audiences, Calendar, Delivery, Results, and Settings. Each campaign has an objective, owner, dates, saved audiences, multiple content pieces, revisioned shared copy, customized channel versions, review history and delivery results. Financial `Campaign` and existing event records retain their IDs and authority. Journeys remain in Steward Paths; paid advertising is excluded.

The scoped light blue shell follows the 2026-11-02 Letters reference. Authored email HTML, PDF typography, and public content remain independent. Native email/letter editors mount within campaigns, preserving their rich controls. Email canvas, inspector and searchable insertion tools are reusable components; document undo/redo and existing native autosave remain available. Shared drafts save with revision checks, and conflicting local changes remain in the editor. Customized paragraphs and changed native layouts require explicit review. Managed identities survive structured letter editing and are remapped during duplication.

Within Create, the native email editor replaces its companion/publish navigation with Save & review, which flushes pending edits and returns to the selected campaign format. The standalone legacy editor retains its original controls.

Each format can set its own delivery date in addition to the content piece's shared date. The effective date appears in approval review and the channel calendar and is frozen into delivery jobs. Editing it supersedes approval; duplicating content into a new campaign clears previous dates. Campaign/library search sends its query to the server before the recent-results limit.

`GET /api/oyama-create/calendar` returns `items`, `hasMore` and `nextCursor`; send the cursor as `after` to continue. Requests scan bounded stable-ID batches and evaluate permissions and effective dates before counting results. The calendar retains loaded entries and visibly offers continuation when more content remains, including when the first portion contains only undated or inaccessible content.

The additive migration `20261103140000_oyama_create` installs the Create campaign/content/revision/variant/release/delivery/connection/consent/webhook/publication/lead tables. `OrganizationSettings.oyamaCreateEnabled` defaults to false. Existing recipient lists supply shared audiences. All authenticated resource access is organization scoped. Private imported emails retain source read/manage ownership restrictions. Separate permissions cover SMS publishing, social publishing and connection management. Provider credentials require the configured encryption key and are not returned by connection lists.

At the user's explicit request, `/communications` remains a transition page with **“Communications is moving to oyamaCreate”** and an Explore link. Other eligible legacy links map into Create when the organization flag is enabled. `?legacy=1` provides navigation rollback.

## Backfill and compatibility

Import binds original source IDs without rewriting sent content, generated PDFs or original delivery history. Historical executions remain historical; duplicate them to create fresh drafts. Only verified companion source IDs are grouped. Names are never used to infer a relationship. Generated letters and history remain linked through original templates.

The resumable backfill inventories by default and requires an active administrator in the selected organization:

```powershell
pnpm create:backfill --organization ORG_ID --user ADMIN_USER_ID
pnpm create:backfill --organization ORG_ID --user ADMIN_USER_ID --apply
```

Review the inventory before applying it. Rerunning skips existing bindings. Existing email and letter APIs remain available, and legacy edits invalidate affected pending Create approvals.

## Review and execution

Email/letter campaigns require EMAIL_FIRST, LETTER_FIRST or BOTH. Fallback identifies eligible alternate recipients during review; provider failures never silently switch channels. Review shows overlap, exclusions and final counts. Email-only entries cannot become postal or SMS contacts. SMS requires separately recorded consent.

Approval freezes content revisions, rendered email output, print branding/assets/fonts, recipient delivery details, schedules and strategy. A unique constraint permits one release per campaign revision. Dispatch requires a separate explicit release action. Edits supersede approval and cancel pending jobs. The worker uses durable records, unique keys and conditional claims. It owns its DRAFT email execution records, so the existing scheduled-email worker cannot dispatch them twice. Ambiguous outcomes require reconciliation before retrying. Current contact eligibility is checked again before dispatch.

Print preparation uses the existing frozen renderer. `/oyama-create/print-production` supplies ordered batches, page manifests, 500-letter parts, Avery 5160 labels and explicit print events. Exact PDF checksum approval precedes new printing or combined-PDF export. Opening or downloading a PDF never marks it printed or mailed. Mailing remains a separate authorized queue confirmation. Superseded artifacts remain available for history.

Web pages publish under `/campaign-pages/[slug]` using Webmaster sites, pages and publication versions. Historical versions can be explicitly restored. Public output rejects recipient merge syntax. Forms retain the exact consent wording and enter a review/match queue; existing contact details and suppressions are retained. Same-host hosted-giving links carry a publication ID, validated against its organization and frozen financial attribution before reusing existing checkout processing. Event links use existing registration processing.

Azure SMS verifies sender capability and authenticated Event Grid subscription validation. Callbacks verify the resource topic and static webhook key and deduplicate event IDs. STOP/START events maintain separate SMS consent. UUID repeatability IDs, current eligibility checks and delivery reports distinguish accepted and delivered outcomes. Meta discovers Pages with content rights and checks publishing grants. Instagram separates media creation, preparation polling and publishing. Available post insights load on request; unavailable metrics are labeled accordingly.

Official contracts: [Azure SMS REST](https://learn.microsoft.com/en-us/rest/api/communication/sms/sms/send?view=rest-communication-sms-2021-03-07), [HMAC](https://learn.microsoft.com/en-us/azure/communication-services/tutorials/hmac-header-tutorial), [Event Grid SMS events](https://learn.microsoft.com/en-us/azure/event-grid/communication-services-telephony-sms-events), [Meta publishing SDK](https://github.com/meta/facebook-nodejs-business-sdk/blob/main/src/objects/ig-user.js).

## Rollout and rollback

1. Validate the additive migration and contention checks in isolated MySQL before deployment.
2. Apply the migration using the repository's deployment migration workflow; regenerate Prisma; build/restart web/API and the letter-production worker.
3. Inventory/backfill the chosen organization. Review ambiguous content separately.
4. Verify email transport, branding, PDF output, Azure sender/Event Grid and Meta account readiness. Provider account/app permissions are external prerequisites.
5. Enable the organization flag from Create Settings. A live campaign still requires frozen approval and explicit release.

Disable the organization flag to stop new pending Create dispatch and restore legacy route behavior. In-flight provider requests cannot be recalled. Keep all campaigns, releases, native bindings and delivery history; do not reverse the migration or delete data for navigation rollback.

## Verification limits

Local MySQL refused connections. No live migration or backfill ran. The opt-in MySQL test requires an empty disposable `oyama_create_test_*` schema via `CREATE_MYSQL_TEST_URL`, refuses existing tables, and never reads `DATABASE_URL`. It covers additive schema installation, disabled rollout default, concurrent release uniqueness and conditional job claims. Run these checks before enabling live delivery.

No real send, social post, public publication, payment or clinical write occurred. Browser APIs and the seven-page production-renderer proof use explicitly synthetic data. Actual evidence and remaining checks are recorded under `docs/status/audit-artifacts/2026-11-03-oyama-create`.
