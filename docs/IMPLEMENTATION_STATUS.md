# OyamaWebMaster Implementation Status

Last checked: 2026-05-10

## Dashboard
Status: Working
Notes: Real dashboard actions are in place for site creation, recent websites, quick page creation, and health summaries.

## Site Creation
Status: Working
Notes: Site records are persisted via /api/webmaster/sites and surfaced in the dashboard.

## Visual Builder
Status: Partially Working
Notes: Builder shell includes top controls, add-section panel, canvas, inspector, bottom status bar, and page save/load via contentJson.
Missing: Rich inline text toolbar, advanced responsive controls, and full block editing matrix.

## Section Registry
Status: Partially Working
Notes: Canonical section manifests and starter section set (Header, Hero, Split Image/Text, Text, Card Grid, CTA, FAQ, Contact, Footer) are registered.
Missing: Settings schema validation, migrations, and export renderers.

## Templates
Status: UI Shell Only
Notes: Templates workspace entry points exist with explicit in-development warnings.
Missing: Real template CRUD, preview thumbnails, synced update controls.

## Brand Kit
Status: UI Shell Only
Notes: Brand kit workspace entry point is visible with explicit in-development warning.
Missing: Token editor, logo/favicon management, global style propagation.

## CMS
Status: UI Shell Only
Notes: CMS workspace entry point is visible with explicit in-development warning.
Missing: Collections, entries, dynamic bindings, import/export.

## Forms
Status: UI Shell Only
Notes: Forms workspace entry point is visible with explicit in-development warning.
Missing: Form builder, submission storage, routing and anti-spam settings.

## Donation Blocks
Status: Not Started
Notes: Donation provider adapter contract planning remains.

## SEO / AEO
Status: Not Started
Notes: SEO workspace placeholder exists and page-level metadata fields are editable in builder.
Missing: Automated checks, schema generation, sitemap/robots outputs.

## Static Export
Status: Not Started
Notes: Export action is visible with explicit in-development warning.
Missing: Static HTML/CSS/JS generation, ZIP packaging, oyama-site.json bundle.

## Publishing
Status: Not Started
Notes: Publishing action is visible with explicit in-development warning.
Missing: Preview builds, targets, history, rollback.

## Integrations
Status: Not Started
Notes: Integration module boundaries are scaffolded.
Missing: Donation/email/analytics adapters and connection UI.

## Preflight
Status: Not Started
Notes: Preflight module boundary is scaffolded.
Missing: Critical/warning/suggestion checks and fix actions.

## StewardAI

| Feature | Status | Notes | Next Step |
|---|---|---|---|
| Top bar launch | Working | Steward opens from the top bar AI button. | Add keyboard shortcut discovery in UI help text. |
| Panel mode controls | Partially Working | Collapsed, dock-right, popout (in-app), and maximized modes are wired in the UI shell. | Persist panel mode preference per user. |
| Thread history | Working (Local) | Multi-thread history is stored locally in browser localStorage. | Add server-side chat persistence and sync. |
| Clear conversation confirmation | Working | Clear action now asks for explicit confirmation. | Add per-thread clear option. |
| Steward to OGentic handoff | Partially Working | Prompt + source route handoff is stored in sessionStorage and read in OGentic. | Add backend handoff session model. |

## OGentic

| Feature | Status | Notes | Next Step |
|---|---|---|---|
| Route and module shell | Partially Working | /ogentic route is live with a three-column control-center layout. | Add role-aware access checks. |
| Left workspace sidebar | Partially Working | Recent chats and artifact counters are displayed. | Connect real chat metadata and saved workspace history. |
| Main chat workspace | Partially Working | Large chat shell, suggested prompts, context toggles, and draft-only control exist. | Connect real agent execution and message streaming. |
| Tool context panel | UI Shell Only | Tool registry categories and risk labels are visible from stub registry data. | Wire category tools to backend routes. |
| Artifact panel | Partially Working (Local) | Draft/report/spreadsheet artifact cards persist locally for development. | Add backend artifact storage and retrieval APIs. |
| Safety model | Partially Working | Risk levels and approval metadata exist in registry definitions. | Enforce approval gates server-side. |
