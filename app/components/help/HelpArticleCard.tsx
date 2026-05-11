// Search result and list card used in the Help App article browser.

import Link from "next/link";
import HelpScopeBadge from "@/app/components/help/HelpScopeBadge";
import type { HelpArticle, HelpCrmScope } from "@/app/help-content";

interface HelpArticleCardProps {
  /** Article payload to render in summary format. */
  article: HelpArticle;
  /** Current workspace scope used for deep-link query context. */
  scope: HelpCrmScope;
  /** Optional matched fields shown under search results. */
  matchedBy?: string[];
}

/**
 * HelpArticleCard displays searchable article metadata with quick navigation.
 */
export default function HelpArticleCard({ article, scope, matchedBy = [] }: HelpArticleCardProps) {
  const params = new URLSearchParams();
  params.set("scope", scope);

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-gray-900">{article.title}</h3>
        <HelpScopeBadge scope={article.crmScope} />
      </div>

      <p className="mt-1 text-xs text-gray-600">{article.summary}</p>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{article.category}</span>
        {article.estimatedReadTime ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{article.estimatedReadTime}</span>
        ) : null}
        {article.difficulty ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">{article.difficulty}</span>
        ) : null}
        {article.images && article.images.length > 0 ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">Images</span>
        ) : null}
        {article.walkthroughSteps && article.walkthroughSteps.length > 0 ? (
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-600">Walkthrough</span>
        ) : null}
      </div>

      {matchedBy.length > 0 ? (
        <p className="mt-2 text-[11px] text-gray-500">Matched by: {matchedBy.join(", ")}</p>
      ) : null}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-[11px] text-gray-500">Updated {article.lastUpdated}</p>
        <Link
          href={`/help/${article.slug}?${params.toString()}`}
          className="rounded-lg border border-green-300 bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700 hover:bg-green-100"
        >
          Open Guide
        </Link>
      </div>
    </article>
  );
}
