# OyamaLetters to OyamaEmail Handoff — 2026-07-13

## Outcome

Generated letters now expose a functional, draft-first handoff into the canonical OyamaEmail campaign workspace. The action is recipient-specific, does not send email, and opens the existing linked campaign when repeated.

## Safety and Data Behavior

- Requires the existing `letters.create_email_draft` server permission.
- Requires a constituent email address.
- Creates an `EmailCampaign` in `DRAFT` status with an individual recipient filter.
- Preserves rich HTML in `bodyHtml` and derives clean plain text for `bodyText` and preview copy.
- Reuses `GeneratedLetter.emailCampaignId` on subsequent requests instead of creating another campaign.
- Keeps `EMAIL_DRAFT_CREATED` letters visible in print and mail queues so email preparation does not interrupt physical delivery work.
- Routes to `/oyama-email/campaigns/:id`; legacy `/communications/:id` is no longer emitted by the Letters API.
- Stores the source generated-letter, template, and constituent identifiers in normalized campaign workflow metadata.
- Preserves source metadata through later campaign edits and exposes `Return to Source Letter` in OyamaEmail.

## Validation

| Check | Result |
|---|---|
| Targeted ESLint | Passed with no errors; existing Letters warnings remain |
| `pnpm typecheck` | Passed |
| Focused Vitest run | 3 files passed; 24 tests passed |
| Full Vitest run | 75 files passed; 638 tests passed |
| Production build | Passed; 198 application routes generated |

The API smoke test verifies initial draft creation, canonical redirect, rich HTML preservation, plain-text derivation, reuse of the same campaign on a repeated request, and source-metadata survival after a campaign update and reload.
