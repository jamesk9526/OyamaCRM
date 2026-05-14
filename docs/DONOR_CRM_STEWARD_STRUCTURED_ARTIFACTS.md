# DonorCRM Steward Structured Artifacts

Purpose: define the structured response path used by Steward AI for donor/report tasks so the UI can render practical artifacts instead of plain text only.

## Scope

Structured artifacts are enabled for:

- DonorCRM (`moduleKey = donor`)
- OShareview reporting (`moduleKey = oshareview`)

Structured artifacts are intentionally disabled for:

- Compassion CRM
- Events CRM
- Watchdog
- Webmaster

## Transport Contract

Backend routes:

- `POST /api/steward-ai/chat`
- `POST /api/steward-ai/chat/stream`

Done payload now includes:

- `reply` (templated markdown reply)
- `structured` (normalized structured response)

`structured` shape:

- `version: 1`
- `replyMarkdown: string`
- `artifacts: StewardArtifact[]`
- `suggestedActions: StewardSuggestedAction[]`
- `evidence: StewardEvidenceItem[]`
- `parseWarning?: string`

## Model Output Pattern

Runtime system prompt instructs donor/report modules to optionally append:

```text
```steward-artifacts
{...json...}
```
```

The server parser extracts this block, sanitizes it, and never throws on invalid JSON.

## Supported Artifact Types

- `email_draft`
- `donor_list`
- `report_summary`
- `task_list`
- `call_script`
- `csv_rows`

Each artifact is sanitized with bounded field lengths, bounded list sizes, and allowlisted fields.

## UI Rendering

Renderer entry point:

- `app/components/ai/StewardResponseRenderer.tsx`

Artifact cards:

- `app/components/ai/artifacts/EmailDraftArtifactCard.tsx`
- `app/components/ai/artifacts/DonorListArtifactCard.tsx`
- `app/components/ai/artifacts/ReportSummaryArtifactCard.tsx`
- `app/components/ai/artifacts/TaskListArtifactCard.tsx`
- `app/components/ai/artifacts/CallScriptArtifactCard.tsx`
- `app/components/ai/artifacts/CsvRowsArtifactCard.tsx`

Chat integration:

- `app/components/ai/StewardChatPanel.tsx`

## Safety Behavior

- Invalid or malformed `steward-artifacts` JSON falls back to plain markdown.
- Unsupported artifact types are dropped.
- Suggested actions are allowlisted and default to confirmation-required.
- Evidence and rows are capped to prevent oversized UI payloads.

## Current Status

- Structured parse and transport: Working
- Artifact card rendering in chat panel: Working
- Action execution wiring from suggested actions: Not Implemented
- Dedicated parser unit tests in server lane: Partially Working (covered indirectly via route behavior only)
