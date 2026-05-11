// Core typed models for the CRM-scoped Help App content system.

/** CRM scopes supported by the Help App for module-aware content prioritization. */
export type HelpCrmScope = "donor" | "events" | "compassion" | "global";

/** Difficulty labels shown in guide cards and article metadata panels. */
export type HelpDifficulty = "beginner" | "intermediate" | "advanced";

/** Role targeting labels used for onboarding and role-aware filtering. */
export type HelpRole = "admin" | "staff" | "volunteer" | "all";

/** Publishing lifecycle state for each help article. */
export type HelpStatus = "draft" | "published" | "needs-review";

/** Feature readiness labels aligned with platform production-readiness standards. */
export type HelpFeatureReadiness = "Working" | "Partially Working" | "Demo Only" | "Broken" | "Not Implemented";

/** Image metadata used in inline guide sections and walkthrough steps. */
export interface HelpImage {
  /** Stable image identifier for rendering keys and future analytics hooks. */
  id: string;
  /** Public URL path for the help image asset. */
  url: string;
  /** Accessible alt text for screen readers and fallback rendering. */
  alt: string;
  /** Optional caption shown below an image preview. */
  caption?: string;
}

/** Step metadata for image-backed walkthrough sequences. */
export interface HelpWalkthroughStep {
  /** Stable walkthrough step identifier. */
  id: string;
  /** Short title displayed in ordered walkthrough navigation. */
  title: string;
  /** Human-readable instruction for completing this step. */
  instruction: string;
  /** Optional visual aid for the current step. */
  imageUrl?: string;
  /** Optional route target for direct navigation during guided setup. */
  targetRoute?: string;
  /** Optional future selector hook for interactive tours. */
  targetElement?: string;
  /** Explicit ordering index for deterministic rendering. */
  order: number;
}

/** Structured Help App article model used for search, filtering, and rendering. */
export interface HelpArticle {
  /** Stable article identifier. */
  id: string;
  /** Display title shown in list and detail views. */
  title: string;
  /** Route-safe slug used for article detail pages. */
  slug: string;
  /** CRM scope determining contextual priority and visibility. */
  crmScope: HelpCrmScope;
  /** Category name used by filters and section grouping. */
  category: string;
  /** Short summary displayed in cards and search results. */
  summary: string;
  /** Main rich text body content rendered in the article view. */
  body: string;
  /** Keywords used for search and contextual route mapping. */
  tags: string[];
  /** Optional estimated read time shown in metadata chips. */
  estimatedReadTime?: string;
  /** Optional audience difficulty marker. */
  difficulty?: HelpDifficulty;
  /** Optional role target marker. */
  role?: HelpRole;
  /** Optional image gallery attached to the article. */
  images?: HelpImage[];
  /** Optional ordered walkthrough steps for procedural guidance. */
  walkthroughSteps?: HelpWalkthroughStep[];
  /** Optional related article IDs for cross-linking. */
  relatedArticles?: string[];
  /** Last updated ISO date string shown in search metadata. */
  lastUpdated: string;
  /** Optional last reviewed ISO date string for governance tracking. */
  lastReviewed?: string;
  /** Publishing lifecycle status used by filters and admin workflows. */
  status: HelpStatus;
  /** Optional feature readiness marker shown in contextual warnings. */
  featureReadiness?: HelpFeatureReadiness;
}

/** Search result model surfaced in Help App list panels. */
export interface HelpSearchResult {
  /** Full article payload for detail navigation and rendering. */
  article: HelpArticle;
  /** Weighted score from the local search engine. */
  score: number;
  /** Optional explanation snippets from search matching. */
  matchedBy: string[];
}
