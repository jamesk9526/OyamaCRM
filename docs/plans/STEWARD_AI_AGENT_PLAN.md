# Steward AI Integration Plan for Oyama CRM

We need to expand the built-in AI assistant, now named **Steward**, so it feels like a complete, deeply integrated part of Oyama instead of a simple chatbot added onto the side. The activation button for Steward already exists in the top bar, so keep that button as the primary entry point. The goal is to turn Steward into a polished, privacy-first, RAG-based analytical assistant that can connect across the Donor CRM, Client / Compassion CRM, Events CRM, scheduling tools, communication tools, reporting dashboards, importers, and admin settings.

Steward should feel calm, trustworthy, professional, and mission-minded. It should not feel flashy, gimmicky, or like a generic AI widget. The design should match the clean light CRM style we have been building: soft white backgrounds, subtle borders, gentle shadows, rounded cards, clear spacing, readable typography, and a green/accent color system that fits the rest of Oyama. Steward should feel like a careful staff assistant, not a sales chatbot.

## Core Design Feel

When the user clicks the existing Steward button in the top bar, open a refined AI workspace. This can start as a right-side drawer, modal panel, or slide-over assistant panel, but it should be designed so it can eventually expand into a full Steward workspace.

The Steward interface should include:

- A clean assistant header with the name **Steward**
- A short subtitle like: “Ask, analyze, summarize, and act across your CRM.”
- A clear indication of what Steward currently has access to
- Context awareness based on the page the user is viewing
- Suggested prompts based on the current CRM area
- A conversation area
- A source/context panel showing what data Steward used
- Safe action cards when Steward suggests a change
- Confirmation steps before any write, merge, send, delete, or import action
- A visible privacy/scope indicator

The assistant should feel like it belongs inside the app. Avoid using a floating generic chat bubble as the main experience. The top-bar button should open a professional work panel that feels like part of Oyama’s operating system.

## Steward Entry Points

Steward should be accessible globally from the top bar, but it should also understand where the user is when opened.

Examples:

- From the Donor CRM dashboard, Steward should suggest donor insights, giving trends, lapsed donor reports, and thank-you communication drafts.
- From a donor profile, Steward should focus only on that donor’s giving history, notes, communication history, and related tasks.
- From the Client / Compassion CRM, Steward must be much more privacy-sensitive and should only use data within the current client scope unless the user is in an approved admin/reporting view.
- From a client profile, Steward should summarize that client’s timeline, appointments, services, notes, documents, and follow-up needs, but never mix in another client’s information.
- From the Events CRM, Steward should help with guest lists, table assignments, registrations, sponsorships, check-in issues, event pages, and post-event reports.
- From the importer tools, Steward should help review malformed rows, duplicate records, suspicious data, skipped entries, and field mapping problems.
- From communications, Steward should help draft emails, newsletters, thank-you letters, follow-up messages, donor updates, and client-safe appointment confirmations.
- From reports, Steward should explain trends in plain English and suggest next actions.

## Steward Modes

Steward should support different modes depending on the current task.

### 1. Ask Mode

This is the standard chat mode. The user can ask natural-language questions about the current page or the broader CRM, depending on permissions.

Examples:

- “Summarize this donor.”
- “What appointments need follow-up this week?”
- “Show me clients missing contact information.”
- “Which donors gave last year but not this year?”
- “What did we raise at the last gala?”
- “Find duplicate records from the latest import.”

### 2. Analyze Mode

This mode should focus on deeper data analysis. Steward should retrieve data, summarize patterns, and present clear findings.

Examples:

- Donor retention trends
- Lapsed donor lists
- Monthly giving opportunities
- Event revenue summaries
- Client appointment follow-up gaps
- Import quality reports
- Missing data reports
- Communication engagement summaries

### 3. Draft Mode

This mode should help create written material.

Examples:

- Donor thank-you emails
- Monthly giving invitations
- Event follow-up emails
- Board report summaries
- Client-safe appointment messages
- Newsletter content
- Sponsor thank-you messages
- Import error explanations

Draft Mode should never send anything automatically. It should create drafts for review.

### 4. Action Mode

This mode should allow Steward to help perform CRM tasks, but only with clear confirmation.

Examples:

- Create a task
- Draft an email
- Start a duplicate merge review
- Create a report
- Add a note
- Prepare an import cleanup list
- Generate a follow-up checklist

Any action that changes data must require a clear user confirmation. Destructive or sensitive actions must require stronger confirmation.

### 5. Help Mode

This mode should help users understand how to use the CRM.

Examples:

- “How do I import clients?”
- “How do I create an event page?”
- “How do I embed scheduling on the website?”
- “What does this warning mean?”
- “Why was this row rejected?”

Help Mode should be context-aware and reference the actual tool/page when possible.

## RAG-Based Architecture

Steward should be built around Retrieval-Augmented Generation. It should not simply guess. Before answering CRM-specific questions, Steward should retrieve relevant data from approved sources.

Possible retrievable sources:

- Donor records
- Client records
- Event records
- Appointment history
- Communication history
- Notes
- Tasks
- Forms
- Imported files
- Import batches
- Error reports
- Documents
- Internal help docs
- Policies
- AGENTS.md
- Feature status docs
- CRM audit docs
- User-created reports
- Public-facing page content
- Scheduling settings

Steward’s answers should be grounded in retrieved context. When possible, show the sources or record references used. For example:

- “Based on this donor’s giving history…”
- “From the latest client import batch…”
- “From the event registration records…”
- “From the appointment schedule…”

Do not fake sources. If Steward does not have enough information, it should say so clearly.

## Privacy and Scope Rules

Steward must respect strict scope boundaries.

Every CRM area should define what Steward can access:

### Global Admin Scope

Used only by approved admin users. Can analyze cross-CRM data and system-wide reports.

### Donor Scope

Can access donor profile, giving history, donor notes, donor communications, and donor tasks. Should not access private client records.

### Client Scope

Highly restricted. Can only access the current client record unless the user is in an authorized client reporting/admin view. Never mix multiple client records in a normal client profile chat.

### Event Scope

Can access the current selected event, guests, tickets, tables, sponsors, check-in data, and event communications.

### Import Scope

Can access the current import batch, rejected rows, mapped fields, duplicate candidates, and validation reports.

### Communication Scope

Can access selected audiences, campaign drafts, email history, templates, and sending status based on permissions.

The Steward UI should always show the current scope clearly, such as:

> Scope: Current Client Only  
> Scope: Donor CRM  
> Scope: Selected Event  
> Scope: Import Batch  
> Scope: Admin Reporting

This is especially important for the Client / Compassion CRM.

## Local AI and Hosted API Support

Steward should be provider-flexible. It should support both local AI and hosted API modes.

### Local AI Mode

Steward can connect to a locally running model through an API endpoint. This could be powered by tools such as Ollama, LM Studio, vLLM, llama.cpp, or another local inference service. This mode should be preferred for sensitive CRM data because it keeps data under local control.

Settings needed:

- Local endpoint URL
- Model name
- Context window
- Embedding model
- RAG database settings
- Max tokens
- Temperature
- Streaming on/off
- Health check
- Test connection button

### Hosted API Mode

Steward can connect to a hosted chat API, including a self-hosted API service or a commercial provider if configured. The CRM should not be locked to one vendor.

Settings needed:

- Provider name
- API endpoint
- API key
- Model name
- Embedding provider
- Context limit
- Allowed tools
- Privacy level
- Test connection button

The AI provider should be abstracted behind a clean service layer so future providers can be added without rewriting the Steward UI.

## Suggested Steward UI Layout

When Steward opens from the top bar, use a layout like this:

### Header

- Steward logo/icon
- “Steward”
- Small status indicator: Local AI, Hosted API, Offline, or Needs Setup
- Current scope label
- Expand button
- Settings shortcut

### Prompt Suggestions

Show contextual prompt chips depending on the page.

Examples:

On donor profile:

- “Summarize this donor”
- “Draft a thank-you”
- “Find giving trends”
- “Suggest next step”

On client profile:

- “Summarize client timeline”
- “List follow-up needs”
- “Show missing information”
- “Prepare staff note”

On event dashboard:

- “Summarize registrations”
- “Find table issues”
- “Review unpaid guests”
- “Draft sponsor thank-you”

On importer:

- “Explain rejected rows”
- “Find duplicates”
- “Review field mapping”
- “Create cleanup plan”

### Conversation Area

The main area should support:

- User messages
- Steward responses
- Streaming responses
- Source cards
- Action cards
- Warnings
- Confirmation prompts
- Copy buttons
- Save-to-note or save-to-draft options where appropriate

### Context Panel

Steward should optionally show what context it is using:

- Current page
- Current record
- Retrieved records
- Documents searched
- Import batch
- Event scope
- Permission level

This panel should make the AI feel trustworthy and understandable.

### Action Cards

When Steward suggests doing something, it should show a card rather than just text.

Examples:

- “Create follow-up task”
- “Draft email”
- “Open duplicate review”
- “Generate report”
- “Attach note to client”
- “Create import error report”

Each card should have a clear review/confirm step.

## Settings Area

Add a Steward settings page inside system settings.

The settings page should include:

- Enable/disable Steward
- AI provider mode: Local AI or Hosted API
- Endpoint configuration
- Model selection
- Embedding configuration
- RAG database status
- Permissions
- Tool access
- Audit logging
- Privacy rules
- Test connection
- Rebuild index
- View retrieval logs
- Feature status

Also include warnings if Steward is not fully configured.

Example warning:

> Steward is installed but not fully configured. Connect a local AI endpoint or hosted API provider before using AI analysis.

## Data and Indexing Plan

Create a RAG indexing layer that can safely prepare searchable context.

Recommended structure:

- `steward_sources`
- `steward_documents`
- `steward_chunks`
- `steward_embeddings`
- `steward_queries`
- `steward_audit_logs`
- `steward_tool_calls`
- `steward_permissions`

The index should support:

- Chunking records and documents
- Metadata tagging
- Scope-aware retrieval
- Permission-aware retrieval
- Record-type filtering
- Reindexing
- Partial updates
- Deleted record cleanup
- Import batch indexing
- Event-specific indexing
- Client-specific strict indexing

Each chunk should know:

- Source type
- Source ID
- CRM area
- Scope ID
- Permission level
- Created date
- Updated date
- Owner/user
- Sensitivity level

## Tool Access Plan

Steward should not directly mutate CRM data without a controlled tool layer.

Possible read tools:

- Search donors
- Read donor profile
- Read giving history
- Search clients
- Read client profile
- Read current client timeline
- Search events
- Read event dashboard
- Read appointment schedule
- Read import batch
- Read communication drafts
- Read reports

Possible write tools, all requiring confirmation:

- Create task
- Draft email
- Add internal note
- Create report
- Start duplicate review
- Create appointment follow-up
- Save summary to record
- Generate downloadable import error report

Dangerous actions should require stronger confirmation or admin-only access:

- Merge records
- Delete records
- Send email
- Bulk update records
- Roll back import
- Change AI settings
- Rebuild global indexes

## Implementation Phases

### Phase 1: Steward UI Shell

Start by making Steward feel complete visually.

Tasks:

- Use the existing top-bar Steward button.
- Open a polished right-side assistant panel.
- Add Steward header, status indicator, current scope label, and close/expand controls.
- Add contextual prompt chips.
- Add empty-state design.
- Add fake/demo-safe placeholder responses only where clearly marked.
- Add “not configured” state if AI backend is unavailable.
- Add “partially implemented” warning if needed.
- Update `AGENTS.md` with what is working and what still needs completion.

### Phase 2: Provider Settings

Build the settings structure.

Tasks:

- Add Steward settings page.
- Add Local AI and Hosted API modes.
- Add endpoint/model/API key fields.
- Add test connection button.
- Add provider abstraction layer.
- Add environment variable support.
- Add clear setup warnings.
- Add backend health check.

### Phase 3: Basic Chat Connection

Connect the Steward panel to the configured provider.

Tasks:

- Add chat API route.
- Support streaming if practical.
- Support message history.
- Add error handling.
- Add loading states.
- Add provider failure states.
- Add simple system prompt.
- Add safety rules for no unauthorized data changes.

### Phase 4: Page Context Awareness

Make Steward aware of where it is in the CRM.

Tasks:

- Detect current CRM module.
- Detect current record ID where applicable.
- Pass safe page context to Steward.
- Display current scope in the UI.
- Add contextual suggested prompts.
- Prevent cross-scope leakage.

### Phase 5: RAG Foundation

Build the first retrieval layer.

Tasks:

- Create RAG tables or storage.
- Create chunking service.
- Create embedding service.
- Create retrieval service.
- Index internal help docs and CRM planning docs first.
- Add retrieval references to Steward responses.
- Add source cards in the UI.

### Phase 6: CRM-Specific RAG

Add module-specific retrieval.

Tasks:

- Donor CRM retrieval.
- Client / Compassion CRM retrieval with strict client scoping.
- Events CRM retrieval.
- Scheduling retrieval.
- Import batch retrieval.
- Communications retrieval.
- Reporting retrieval.

### Phase 7: Controlled Tool Actions

Add safe action cards.

Tasks:

- Create task action.
- Draft email action.
- Save summary to record action.
- Create report action.
- Start duplicate review action.
- Generate import cleanup report action.
- Add confirmation layer.
- Add audit logs for every AI-assisted action.

### Phase 8: Steward Workspace

Eventually allow the top-bar panel to expand into a full Steward workspace.

Possible full-page tools:

- Ask Steward
- Donor insights
- Client follow-up review
- Event analysis
- Import cleanup center
- Communication drafting center
- Reports builder
- Data quality center
- AI settings
- AI audit logs

## Important Development Rules

- Do not make Steward a generic chatbot.
- Do not allow Steward to access everything by default.
- Do not allow Steward to change data without confirmation.
- Do not allow client data to leak into donor or event tools.
- Do not allow donor data to be mixed with client data.
- Do not fake RAG results.
- Do not pretend unfinished features work.
- Add clear warning popups for incomplete or partially implemented Steward features.
- Update `AGENTS.md` with all Steward-related incomplete items.
- Add TODO comments only where genuinely needed.
- Keep the UI consistent with the rest of Oyama.
- Build in small batches and fully finish each layer before moving on.

## Recommended First Batch

Start with these 3 tasks:

1. Build the polished Steward top-bar panel UI using the existing top-bar button.
2. Add current scope display and contextual prompt suggestions.
3. Add the Steward settings page with Local AI / Hosted API configuration placeholders and clear not-yet-configured warnings.

After this first batch, move into the provider abstraction layer, chat API connection, page context awareness, and then the RAG foundation.

The final goal is for Steward to become the intelligent operating layer inside Oyama: a careful, privacy-first, RAG-based assistant that helps users understand records, clean data, prepare communications, analyze reports, and safely take action across the CRM.