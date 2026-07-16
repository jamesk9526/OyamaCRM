# OyamaEmail Saved-Template Library Fix

Date: 2026-07-13

Status: Working

## Reported behavior

After saving an email template, the template could disappear from the Email Template Library.

## Root cause

Reusable templates and outbound campaigns share the `EmailCampaign` table. The library loaded the first 100 general campaign records and inferred which rows were templates in the browser. At the same time, template ownership was read from campaign audience metadata while the reusable-template predicate rejected any row with audience metadata. This made the default My Templates filter incompatible with canonical template records. Legacy actions could also attach campaign workflow metadata to an otherwise reusable draft, causing both the API and browser predicates to omit it.

## Fix

- Load library records from `/api/oyama-email/templates?limit=100` instead of deriving them from the general campaign feed.
- Keep template and campaign collections separate in the workspace state.
- Open the library on All Templates so ownerless legacy templates remain visible.
- Persist template owner metadata inside the stored template JSON for new and subsequently saved templates.
- Normalize a reusable draft on template save by clearing campaign-only audience, scheduling, sent, and recipient-count fields.
- Refuse to convert records that already have scheduling or delivery activity.
- Limit template-name conflict and overwrite checks to reusable template records so a campaign with the same name is not overwritten.

## Validation

- `pnpm exec vitest run tests/api/oyama-email-merge-preview.api.test.ts tests/smoke/oyama-email-workspace-source.test.ts`: 13/13 passed.
- Regression coverage verifies a draft carrying legacy campaign metadata is absent before save, normalized by template save, and returned by the canonical library afterward.
- `pnpm typecheck`: passed for web and server.
- `pnpm build`: passed; 198 routes generated.
- `pnpm lint`: passed with zero errors and 125 existing warnings.
- `pnpm test`: 638/639 passed under parallel load. The unrelated Compassion public-scheduling file failed one booking assertion with a transient 404, then passed 8/8 when run alone. Two initially timed-out API files also passed 9/9 when rerun separately.
