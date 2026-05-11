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
- Contextual route suggestions (for example site embeds, events seating, compassion appointments)
- Search by title, summary, body, tags, category, scope, and walkthrough text
- Metadata filters for category, role, difficulty, and tags
- Feature readiness messaging in articles
- Basic feedback control (`Was this helpful?`)

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
- weighted title/tag/summary/body matches
- tokenized keyword bonus
- scope boost for current CRM

Future upgrade path:
- server-side full-text search
- semantic retrieval
- Steward AI grounded RAG

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
