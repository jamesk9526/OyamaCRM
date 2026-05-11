// Local search and ranking helpers for CRM-scoped Help App content discovery.

import { HELP_ARTICLES } from "@/app/help-content/articles";
import { getRouteHelpContext } from "@/app/help-content/route-help-map";
import type { HelpArticle, HelpCrmScope, HelpDifficulty, HelpRole, HelpSearchResult } from "@/app/help-content/types";

/** Filter payload used by Help App search/list controls. */
export interface HelpSearchFilters {
  /** Optional category filter. */
  category?: string;
  /** Optional role filter. */
  role?: HelpRole | "any";
  /** Optional difficulty filter. */
  difficulty?: HelpDifficulty | "any";
  /** Optional tag filter. */
  tag?: string;
  /** Optional status filter for admin review workflows. */
  status?: "published" | "draft" | "needs-review" | "any";
}

/** Normalizes text into searchable lowercase tokens. */
function normalizeForSearch(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9\s-]/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Escapes regex metacharacters for safe dynamic pattern construction. */
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Returns normalized unique query tokens in stable order. */
function tokenize(value: string): string[] {
  const normalized = normalizeForSearch(value);
  if (!normalized) return [];
  return Array.from(new Set(normalized.split(" ").map((token) => token.trim()).filter(Boolean)));
}

/** Expands common nonprofit CRM query terms into related search tokens. */
function expandQueryTokens(tokens: string[]): string[] {
  const expansions: Record<string, string[]> = {
    donor: ["constituent", "fundraising", "gift"],
    constituent: ["donor", "profile"],
    gift: ["donation", "donor"],
    donation: ["gift", "giving"],
    livecom: ["website", "chat", "inbox"],
    volunteer: ["events", "tasks"],
    appointment: ["schedule", "calendar"],
    checkin: ["check", "guest", "arrival"],
    check: ["checkin"],
    import: ["csv", "mapping", "duplicates"],
    embeds: ["website", "snippet", "header", "footer"],
  };

  const expanded = new Set(tokens);
  for (const token of tokens) {
    const related = expansions[token];
    if (!related) continue;
    for (const candidate of related) {
      expanded.add(candidate);
    }
  }
  return Array.from(expanded);
}

/** Computes Levenshtein edit distance for short typo tolerance. */
function levenshteinDistance(left: string, right: string): number {
  if (left === right) return 0;
  if (!left.length) return right.length;
  if (!right.length) return left.length;

  const rows = left.length + 1;
  const cols = right.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let col = 0; col < cols; col += 1) matrix[0][col] = col;

  for (let row = 1; row < rows; row += 1) {
    for (let col = 1; col < cols; col += 1) {
      const cost = left[row - 1] === right[col - 1] ? 0 : 1;
      matrix[row][col] = Math.min(
        matrix[row - 1][col] + 1,
        matrix[row][col - 1] + 1,
        matrix[row - 1][col - 1] + cost
      );
    }
  }

  return matrix[rows - 1][cols - 1];
}

/** Checks if one token matches exactly, by prefix, or with bounded typo distance. */
function tokenMatches(candidate: string, queryToken: string): boolean {
  if (candidate === queryToken) return true;
  if (candidate.startsWith(queryToken) || queryToken.startsWith(candidate)) return true;
  if (candidate.includes(queryToken) || queryToken.includes(candidate)) return true;

  // Restrict edit-distance checks to medium/long tokens to avoid noisy matches.
  if (queryToken.length < 4 || candidate.length < 4) return false;
  const maxDistance = queryToken.length >= 8 ? 2 : 1;
  return levenshteinDistance(candidate, queryToken) <= maxDistance;
}

/** Returns true when article belongs to selected scope or is globally shared. */
function isScopeVisible(article: HelpArticle, scope: HelpCrmScope): boolean {
  if (scope === "global") return article.crmScope === "global";
  return article.crmScope === scope || article.crmScope === "global";
}

/** Builds one weighted index string used for cheap client-side full-text matching. */
function buildArticleIndex(article: HelpArticle): string {
  const walkthroughText = (article.walkthroughSteps ?? [])
    .map((step) => `${step.title} ${step.instruction}`)
    .join(" ");

  return normalizeForSearch([
    article.title,
    article.summary,
    article.body,
    article.category,
    article.crmScope,
    article.tags.join(" "),
    walkthroughText,
  ].join(" "));
}

/** Computes weighted search score based on exact and partial field matches. */
function computeScore(article: HelpArticle, query: string): { score: number; matchedBy: string[] } {
  const phrase = normalizeForSearch(query);
  if (!phrase) return { score: 0, matchedBy: [] };

  const matchedBy: string[] = [];
  let score = 0;

  const title = normalizeForSearch(article.title);
  const summary = normalizeForSearch(article.summary);
  const body = normalizeForSearch(article.body);
  const tags = article.tags.map((tag) => normalizeForSearch(tag));
  const category = normalizeForSearch(article.category);
  const walkthrough = (article.walkthroughSteps ?? [])
    .map((step) => normalizeForSearch(`${step.title} ${step.instruction}`))
    .join(" ");

  const phrasePattern = new RegExp(`\\b${escapeRegExp(phrase)}\\b`);

  if (title.startsWith(phrase)) {
    score += 16;
    matchedBy.push("Title");
  } else if (title.includes(phrase)) {
    score += 13;
    matchedBy.push("Title");
  }
  if (phrasePattern.test(summary) || summary.includes(phrase)) {
    score += 9;
    matchedBy.push("Summary");
  }
  if (tags.some((tag) => tag === phrase)) {
    score += 11;
    matchedBy.push("Tags");
  } else if (tags.some((tag) => tag.includes(phrase))) {
    score += 8;
    matchedBy.push("Tags");
  }
  if (category.includes(phrase)) {
    score += 6;
    matchedBy.push("Category");
  }
  if (walkthrough.includes(phrase)) {
    score += 7;
    matchedBy.push("Walkthrough");
  }
  if (body.includes(phrase)) {
    score += 5;
    matchedBy.push("Body");
  }

  const searchTokens = expandQueryTokens(tokenize(phrase));
  const titleTokens = tokenize(title);
  const summaryTokens = tokenize(summary);
  const categoryTokens = tokenize(category);
  const walkthroughTokens = tokenize(walkthrough);
  const bodyTokens = tokenize(body);
  const tagTokens = Array.from(new Set(tags.flatMap((tag) => tokenize(tag))));

  let tokenHits = 0;
  let fuzzyHits = 0;

  for (const token of searchTokens) {
    let matched = false;

    if (titleTokens.some((candidate) => tokenMatches(candidate, token))) {
      score += 4;
      tokenHits += 1;
      matched = true;
      if (!matchedBy.includes("Title")) matchedBy.push("Title");
    } else if (tagTokens.some((candidate) => tokenMatches(candidate, token))) {
      score += 3.5;
      tokenHits += 1;
      matched = true;
      if (!matchedBy.includes("Tags")) matchedBy.push("Tags");
    } else if (summaryTokens.some((candidate) => tokenMatches(candidate, token))) {
      score += 2.5;
      tokenHits += 1;
      matched = true;
      if (!matchedBy.includes("Summary")) matchedBy.push("Summary");
    } else if (categoryTokens.some((candidate) => tokenMatches(candidate, token))) {
      score += 2;
      tokenHits += 1;
      matched = true;
      if (!matchedBy.includes("Category")) matchedBy.push("Category");
    } else if (walkthroughTokens.some((candidate) => tokenMatches(candidate, token))) {
      score += 2;
      tokenHits += 1;
      matched = true;
      if (!matchedBy.includes("Walkthrough")) matchedBy.push("Walkthrough");
    } else if (bodyTokens.some((candidate) => tokenMatches(candidate, token))) {
      score += 1.5;
      tokenHits += 1;
      matched = true;
      if (!matchedBy.includes("Body")) matchedBy.push("Body");
    }

    if (matched && !tokenize(phrase).includes(token)) {
      fuzzyHits += 1;
    }
  }

  if (searchTokens.length > 0) {
    const coverage = tokenHits / searchTokens.length;
    score += coverage * 7;
    if (tokenHits > 0 && !matchedBy.includes("Keywords")) {
      matchedBy.push("Keywords");
    }
  }

  if (fuzzyHits > 0) {
    score += Math.min(fuzzyHits, 3);
    matchedBy.push("Fuzzy Keywords");
  }

  return { score, matchedBy: Array.from(new Set(matchedBy)) };
}

/** Applies non-query filters to one article collection. */
function applyFilters(articles: HelpArticle[], filters?: HelpSearchFilters): HelpArticle[] {
  if (!filters) return articles;

  return articles.filter((article) => {
    if (filters.category && filters.category !== "all" && article.category !== filters.category) return false;
    if (filters.role && filters.role !== "any" && article.role && article.role !== "all" && article.role !== filters.role) return false;
    if (filters.difficulty && filters.difficulty !== "any" && article.difficulty !== filters.difficulty) return false;
    if (filters.tag && filters.tag !== "all" && !article.tags.includes(filters.tag)) return false;
    if (filters.status && filters.status !== "any" && article.status !== filters.status) return false;
    return true;
  });
}

/** Returns scoped help search results with module-first ordering and scoring. */
export function searchHelpArticles(args: {
  query: string;
  scope: HelpCrmScope;
  filters?: HelpSearchFilters;
  limit?: number;
}): HelpSearchResult[] {
  const scoped = HELP_ARTICLES.filter((article) => isScopeVisible(article, args.scope));
  const filtered = applyFilters(scoped, args.filters)
    .filter((article) => article.status === "published" || args.filters?.status === "draft" || args.filters?.status === "needs-review");

  const query = args.query.trim();
  if (!query) {
    return filtered
      .map((article) => ({ article, score: article.crmScope === args.scope ? 2 : 1, matchedBy: [] }))
      .sort((left, right) => {
        const scopeDiff = Number(right.article.crmScope === args.scope) - Number(left.article.crmScope === args.scope);
        if (scopeDiff !== 0) return scopeDiff;
        return right.article.lastUpdated.localeCompare(left.article.lastUpdated);
      })
      .slice(0, args.limit ?? 50);
  }

  return filtered
    .map((article) => {
      const computed = computeScore(article, query);
      const scopeBoost = article.crmScope === args.scope ? 6 : 2;
      return {
        article,
        score: computed.score + scopeBoost,
        matchedBy: computed.matchedBy,
      };
    })
    .filter((result) => result.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      const scopeDiff = Number(right.article.crmScope === args.scope) - Number(left.article.crmScope === args.scope);
      if (scopeDiff !== 0) return scopeDiff;
      return right.article.lastUpdated.localeCompare(left.article.lastUpdated);
    })
    .slice(0, args.limit ?? 50);
}

/** Returns contextual suggestions for the current route path and module scope. */
export function getContextualHelpSuggestions(args: {
  pathname: string;
  scope: HelpCrmScope;
  limit?: number;
}): HelpArticle[] {
  const context = getRouteHelpContext(args.pathname);
  if (!context) return [];

  const scoped = HELP_ARTICLES.filter((article) => isScopeVisible(article, args.scope));
  const matchedByTags = scoped.filter((article) => article.tags.some((tag) => context.tags.includes(tag)));

  const prioritized = context.prioritizeSlugs
    ? context.prioritizeSlugs
      .map((slug) => matchedByTags.find((article) => article.slug === slug))
      .filter((article): article is HelpArticle => Boolean(article))
    : [];

  const remainder = matchedByTags.filter((article) => !prioritized.some((prioritizedArticle) => prioritizedArticle.id === article.id));

  return [...prioritized, ...remainder].slice(0, args.limit ?? 6);
}

/** Returns helper metadata lists for category and tag filter controls. */
export function getHelpFilterMetadata(scope: HelpCrmScope): {
  categories: string[];
  tags: string[];
} {
  const scoped = HELP_ARTICLES.filter((article) => isScopeVisible(article, scope));
  const categories = Array.from(new Set(scoped.map((article) => article.category))).sort((left, right) => left.localeCompare(right));
  const tags = Array.from(new Set(scoped.flatMap((article) => article.tags))).sort((left, right) => left.localeCompare(right));

  return { categories, tags };
}

/** Resolves one article by slug from published content. */
export function findHelpArticleBySlug(slug: string): HelpArticle | null {
  return HELP_ARTICLES.find((article) => article.slug === slug && article.status === "published") ?? null;
}

/** Resolves related article payloads from one source article. */
export function getRelatedHelpArticles(article: HelpArticle): HelpArticle[] {
  const ids = article.relatedArticles ?? [];
  return ids
    .map((id) => HELP_ARTICLES.find((candidate) => candidate.id === id && candidate.status === "published"))
    .filter((item): item is HelpArticle => Boolean(item));
}
