# OyamaLetters Batch Merge Context Fix

Date: 2026-07-14

Status: Working

## Reported behavior

Merge fields worked when generating one letter but campaign and event values were blank or caused validation skips during batch generation.

## Root cause

The single-letter API passed `campaignId`, `eventId`, and `year` into the canonical merge resolver and stored-letter generator. The batch API only used `campaignId` to optionally filter the donation audience, then omitted campaign and event IDs from both its preview/validation merge call and its stored-generation call.

## Fix

- Batch generation now forwards campaign and event context to both merge validation and persisted letter generation.
- The Generate workspace preserves `campaignId`, `eventId`, and an optional `year` query context in preview, PDF preview, single generation, and batch generation payloads.
- Batch audit metadata records both contextual IDs.

## Validation

- `pnpm exec vitest run tests/api/letters-merge-aliases.api.test.ts`: 5/5 passed.
- Regression coverage proves batch output includes recipient, campaign, event, organization, and explicit year values and persists the campaign/event relationships.
- `pnpm exec vitest run tests/smoke/letters-printables-generate-source.test.ts`: 6/6 passed.
- `pnpm typecheck`: passed for web and server.
- Focused ESLint: zero errors; 18 existing warnings in the letters workspace.
