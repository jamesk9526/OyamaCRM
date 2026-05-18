# Help App

The Help App is an internal CRM-scoped training and documentation workspace built into OyamaCRM.

It provides searchable guides, walkthrough steps, image-backed instructions, and contextual route-aware suggestions so staff can learn workflows without leaving the CRM.

## What It Includes

- Shared Help workspace route at `/help`
- Article detail route at `/help/[slug]`
- CRM-aware scope behavior for:
  - Donor CRM
  - Events CRM
  - Compassion CRM
  - Global cross-platform guidance
- Contextual route suggestions (35+ route → tag mappings)
- Search by title, summary, body, tags, category, scope, and walkthrough text
- Metadata filters for category, role, difficulty, and tags
- Feature readiness messaging in articles
- Feature readiness boost in search ranking (Working articles surface above Partially Working for equal score)
- Typo tolerance (Levenshtein edit distance ≤1 for 4–7 char tokens, ≤2 for 8+ char tokens)
- 60+ nonprofit-domain query synonym expansions
- 60 published help articles covering all major CRM modules
- Basic feedback control (`Was this helpful?`)
- Help Agent planner (`/api/help-agent/plan`) with runnable route actions from natural-language requests

## CRM Scoping Behavior

Help scope is carried via query parameter:

- `scope=donor`
- `scope=events`
- `scope=compassion`
- `scope=global`

Scope resolution logic is centralized in:
- `app/help-content/scope.ts`

TopBar Help uses current module and pathname to build contextual links.

When searching in a CRM scope:
1. Scoped articles are prioritized first.
2. Global articles are included as secondary matches.
3. Out-of-scope CRM content is excluded by default.

## Entry Points

Help links are available in:
- TopBar (all module shells)
- Donor sidebar system section
- Events sidebar global tools section
- Compassion sidebar system section

Contextual `Need help?` links are currently included in:
- Site Embeds workspace
- Compassion appointments workspace
- All routes with route-context mappings (35+ routes)

## Content Model

Core model lives in:
- `app/help-content/types.ts`

Primary article shape:

```ts
export interface HelpArticle {
  id: string;
  title: string;
  slug: string;
  crmScope: "donor" | "events" | "compassion" | "global";
  category: string;
  summary: string;
  body: string;
  tags: string[];
  estimatedReadTime?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  role?: "admin" | "staff" | "volunteer" | "all";
  images?: HelpImage[];
  walkthroughSteps?: HelpWalkthroughStep[];
  relatedArticles?: string[];
  lastUpdated: string;
  lastReviewed?: string;
  status: "draft" | "published" | "needs-review";
  featureReadiness?: "Working" | "Partially Working" | "Demo Only" | "Broken" | "Not Implemented";
}
```

## Where Content Lives

First-pass file-based content lives in:
- `app/help-content/articles.ts`

Route-context mappings live in:
- `app/help-content/route-help-map.ts`

Search and ranking logic lives in:
- `app/help-content/search.ts`

This file-based approach is intentionally simple and safe for initial rollout.

## How To Add New Articles

1. Open `app/help-content/articles.ts`.
2. Add a new `HelpArticle` object to `HELP_ARTICLES`.
3. Set `status: "published"` when ready.
4. Add tags and category carefully for search relevance.
5. Add walkthrough steps with explicit `order` values.
6. Add `relatedArticles` IDs for cross-navigation.
7. Set `featureReadiness` where relevant.

## How To Add Images

1. Add image assets under `public/` for stable runtime URLs.
2. Add entries to `images` array in article object.
3. Provide meaningful `alt` text.
4. Optionally include `caption` for UI clarity.

## How To Add Walkthrough Steps

1. Add `walkthroughSteps` to the article.
2. Use `order` values starting at `1`.
3. Add optional `imageUrl` for visual aid.
4. Add optional `targetRoute` for direct navigation.
5. Keep each instruction short and action-oriented.

## Contextual Route Help

Route mapping rules are defined in:
- `app/help-content/route-help-map.ts`

To add a new route mapping:
1. Add a `routePrefix` rule.
2. Set the CRM scope.
3. Add relevant tags.
4. Optionally set `prioritizeSlugs` for pinned guides.

Currently mapped routes (v1.1.0):
- `/data-tools`, `/data-tools/import`
- `/settings`, `/settings/site-embeds`, `/settings/organization`, `/settings/plugins`, `/settings/integrations`, `/settings/security`
- `/livecom`, `/constituents`, `/donations`, `/donations/new`, `/campaigns`
- `/communications`, `/letters-printables`, `/tasks`, `/grants`, `/reports`
- `/steward-paths`, `/contacts-manager`, `/quickbooks-sync`, `/volunteers`
- `/events/tables`, `/events/check-in`, `/events/guests`, `/events/sponsors`, `/events/tickets`
- `/events/workspace`, `/events/reports`, `/events/page-builder`, `/events`
- `/compassion/appointments`, `/compassion/import/clients`, `/compassion/clients`
- `/compassion/cases`, `/compassion/follow-ups`, `/compassion/reports`, `/compassion`
- `/setup`, `/webmaster`

## Search Design

Current search is local client-side and indexes:
- title
- summary
- body
- tags
- category
- crmScope
- walkthrough step titles/instructions

Ranking includes:
- weighted phrase match in title/summary/tags/body/walkthrough (up to 16 pts per exact title prefix)
- tokenized keyword bonus with per-field weights
- scope boost for current CRM (+6 for scoped, +2 for global)
- feature readiness quality boost (+2 for Working, +1 for Partially Working)
- coverage bonus when all search tokens match (up to 7 pts)
- fuzzy expansion hits (synonyms, typo corrections, domain expansions)

### Query Synonym Expansions (v1.1.0)

The search engine expands 60+ nonprofit-domain terms automatically:

| Input | Expanded tokens |
|---|---|
| `donor` | constituent, fundraising, gift, giving |
| `email` | campaign, communications, outreach, smtp |
| `import` | csv, mapping, duplicates, upload |
| `steward` | stewardship, paths, sequence, engagement |
| `grant` | grants, funding, research, deadline |
| `report` | reports, analytics, export, retention |
| `appointment` | schedule, calendar, compassion |
| (+ 50+ more domain terms) | — |

Future upgrade path:
- server-side full-text search
- semantic retrieval
- Steward AI grounded RAG

## Help Agent Planner

Help Search now includes a lightweight Help Agent panel that accepts plain-language tasks and returns:

- Scope-aware route suggestions using a curated route catalog
- Confidence labels (`high`, `medium`, `low`)
- Guided step list
- Runnable actions (`open_route`, `open_help_article`, `open_help_search`)

Planner backend:
- `server/src/routes/help-agent.ts`
- `server/src/services/help-agent.ts`

Current safety constraints:
- deterministic catalog/ranking logic (no freeform tool execution)
- authenticated API route (`requireAuth`)
- UI blocks non-local action targets (must start with `/`)

Current UX constraints:
- only route navigation/help actions are executable
- destructive operations are intentionally out of scope for this first pass

## Steward AI Integration Path

The Help App is structured to become a trusted documentation source for Steward AI.

Future integration ideas:
- `Ask Steward` from article pages
- route-aware suggested guides from Steward context
- grounded responses that cite Help App articles

Safety note:
- keep first-pass help deterministic and article-backed
- do not auto-generate high-risk operational instructions without review

## Feature Readiness Labels

Help content supports production-readiness labels:
- Working
- Partially Working
- Demo Only
- Broken
- Not Implemented

Use these to set correct expectations when a feature is still evolving.

## Published Articles (v1.1.0)

### Donor CRM
- How To Add A Constituent In Donor CRM
- Import Donor Data From CSV
- Configure Site Embeds And Header Code Injection
- Use LiveCom For Website Conversations
- Record A Donation In Donor CRM
- Set Up Recurring Gifts
- Build And Send A Donor Email Campaign
- Manage Donor Email Preferences And Unsubscribes
- Generate Letters And Manage Print Queue
- Create Stewardship Follow-Up Tasks
- Build A Donor Report And Export Results
- Use The Grants Workspace
- Queue Donations For QuickBooks Sync
- Create And Manage Fundraising Campaigns _(new in v1.1.0)_
- Navigate A Constituent Profile And Timeline _(new in v1.1.0)_
- Set Up A Steward Paths Engagement Sequence _(new in v1.1.0)_
- Build Audience Lists With Contacts Manager _(new in v1.1.0)_
- Record And Track Pledge Commitments _(new in v1.1.0)_
- Analyze Donor Retention Metrics _(new in v1.1.0)_
- Track Volunteers In Donor CRM _(new in v1.1.0)_
- Understand The Donor CRM Dashboard _(new in v1.1.0)_
- Use The Email Campaign Builder _(new in v1.1.0)_
- Import Historical Donation Data _(new in v1.1.0)_

### Events CRM
- Create And Activate An Event Workspace
- Manage Tables And Seating Assignments
- Run Event Check-In Operations
- Register Guests For An Event
- Create Event Pages In Events Page Builder
- Run Cross-Event Reports
- Manage Event Sponsors And Sponsorship Packages _(new in v1.1.0)_
- Configure Event Ticket Types _(new in v1.1.0)_
- Read The Event Overview Dashboard _(new in v1.1.0)_

### Compassion CRM
- Add A Client In Compassion CRM
- Schedule And Manage Appointments
- Import Clients Safely
- Open A New Compassion Case
- Manage Compassion Follow-Up Tasks
- Configure Public Scheduling Widget
- Complete Client Assessments _(new in v1.1.0)_
- Record Client Referrals _(new in v1.1.0)_
- Run Compassion CRM Service Reports _(new in v1.1.0)_
- Record Material Assistance In Client Profiles _(new in v1.1.0)_

### Global
- Get Started With OyamaCRM
- Understand Roles, Permissions, And Feature Readiness
- Use Steward AI With Official Help Sources
- Set Up System Email Provider
- Connect Microsoft Graph For Outbound Email
- Troubleshoot Help Search And Agent Suggestions
- Use Steward Help Mode With Guide Links
- Navigate The Settings Workspace _(new in v1.1.0)_
- Configure Organization Settings _(new in v1.1.0)_
- Review The System Audit Log _(new in v1.1.0)_
- Manage Users And Role Assignments _(new in v1.1.0)_
- Export Data From OyamaCRM _(new in v1.1.0)_
- Review Security And Privacy Settings _(new in v1.1.0)_
- Configure Notifications And Reminders _(new in v1.1.0)_
- Complete The First-Run Setup Wizard _(new in v1.1.0)_
- Use OyamaWebMaster For Website Management _(new in v1.1.0)_
- Troubleshoot Email Provider And API Connectivity _(new in v1.1.0)_
- Switch Between CRM Modules _(new in v1.1.0)_

## Testing

Unit tests for scope/search/context behavior are in:
- `tests/unit/help-content.test.ts`

Test coverage includes:
- module scope parsing
- scope-aware search ordering
- filter behavior
- contextual route mapping
- contextual suggestion retrieval

## Developer Notes

- Keep articles modular and scoped.
- Prefer small edits to `app/help-content/articles.ts` over scattered inline docs.
- If content volume grows significantly, move to structured markdown/MDX storage with a build-time index.
- If adding backend persistence later, preserve current article shape for compatibility with existing UI and tests.
- When adding new features, add a corresponding help article. Use `featureReadiness` to set correct expectations.
- When feature status changes, update the `featureReadiness` field in the relevant article.

