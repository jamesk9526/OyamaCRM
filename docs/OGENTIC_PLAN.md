# OGentic Plan

Last updated: 2026-05-10

## Purpose
OGentic is the agentic CRM control center for cross-module analysis, drafting, reporting, and guided action.
It sits above Donor CRM, Events CRM, Compassion CRM, Communications, and Reporting without replacing them.

## StewardAI Relationship
- StewardAI: quick contextual assistant from the top bar.
- OGentic: larger workspace for deeper multi-step workflows and artifact-based outputs.
- Handoff: Steward can pass prompt + route context into OGentic.

## Workspace Layout
- Left rail: chats, drafts, reports, spreadsheets, analyses.
- Main area: large conversation workspace, suggested prompts, message history, composer controls.
- Right rail: tool registry and artifact previews.

## Tool Categories
- donor
- event
- client
- communication
- reporting
- spreadsheet
- task
- analysis
- import/export
- system

## Artifact Types
- email_draft
- letter_draft
- donor_list
- spreadsheet
- report
- task_plan
- segment
- analysis
- note
- export

## Safety Rules
- safe: no approval required (summaries, draft generation, read operations).
- review_required: user confirmation required before save-like actions.
- sensitive: explicit confirmation and permission checks required.
- destructive: blocked in initial implementation.

## Initial Phases
1. Steward layout and panel modes.
2. OGentic route and workspace shell.
3. Tool registry scaffolding with risk metadata.
4. Local artifact scaffolding and warning banners.
5. Backend persistence wiring.
6. Real donor/event/reporting tool integrations.

## Roadmap
- Persist OGentic chats, messages, artifacts, and tool calls server-side.
- Add approval workflows for review_required and sensitive actions.
- Connect real donor analysis and reporting pipelines.
- Add spreadsheet save/export flows.
- Add role-aware action execution and audit logging.
