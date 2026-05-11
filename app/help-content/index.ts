// Public exports for Help App content, search, and scoping utilities.

export { HELP_ARTICLES } from "@/app/help-content/articles";
export {
  getContextualHelpSuggestions,
  getHelpFilterMetadata,
  getRelatedHelpArticles,
  findHelpArticleBySlug,
  searchHelpArticles,
  type HelpSearchFilters,
} from "@/app/help-content/search";
export { buildHelpHref, mapModuleKeyToHelpScope, parseHelpScope } from "@/app/help-content/scope";
export { getRouteHelpContext, HELP_ROUTE_CONTEXT_RULES, type HelpRouteContextRule } from "@/app/help-content/route-help-map";
export type {
  HelpArticle,
  HelpCrmScope,
  HelpDifficulty,
  HelpFeatureReadiness,
  HelpImage,
  HelpRole,
  HelpSearchResult,
  HelpStatus,
  HelpWalkthroughStep,
} from "@/app/help-content/types";
