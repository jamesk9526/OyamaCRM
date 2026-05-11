// Article detail route for rendering one Help App guide by slug.

import Link from "next/link";
import HelpArticleView from "@/app/components/help/HelpArticleView";
import HelpFeedbackBar from "@/app/components/help/HelpFeedbackBar";
import {
  findHelpArticleBySlug,
  getRelatedHelpArticles,
  parseHelpScope,
} from "@/app/help-content";

interface HelpArticlePageProps {
  /** Dynamic route params from app/help/[slug]. */
  params: Promise<{ slug: string }>;
  /** Query params carrying current scope context. */
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * HelpArticlePage renders one published help guide or a missing-guide fallback state.
 */
export default async function HelpArticlePage({ params, searchParams }: HelpArticlePageProps) {
  const resolvedParams = await params;
  const queryParams = (await searchParams) ?? {};
  const rawScope = Array.isArray(queryParams.scope) ? queryParams.scope[0] : queryParams.scope;

  const scope = parseHelpScope(rawScope);
  const article = findHelpArticleBySlug(resolvedParams.slug);

  if (!article) {
    return (
      <div className="space-y-4 rounded-xl border border-red-200 bg-red-50 p-5">
        <h1 className="text-lg font-semibold text-red-900">Help Guide Not Found</h1>
        <p className="text-sm text-red-800">The requested help article is missing or unpublished.</p>
        <Link href={`/help?scope=${scope}`} className="inline-flex rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 hover:bg-red-100">
          Back To Help
        </Link>
      </div>
    );
  }

  const related = getRelatedHelpArticles(article);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <Link href={`/help?scope=${scope}`} className="inline-flex rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
          Back To Help
        </Link>
      </div>

      <HelpArticleView article={article} related={related} scope={scope} />
      <HelpFeedbackBar />
    </div>
  );
}
