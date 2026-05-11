// Detailed Help App article presentation with walkthrough, images, and related links.

import Image from "next/image";
import Link from "next/link";
import HelpScopeBadge from "@/app/components/help/HelpScopeBadge";
import type { HelpArticle, HelpCrmScope } from "@/app/help-content";

interface HelpArticleViewProps {
  /** The article currently being displayed in detail mode. */
  article: HelpArticle;
  /** Related published articles used for cross-navigation. */
  related: HelpArticle[];
  /** Current scope value for preserving user context in links. */
  scope: HelpCrmScope;
}

/**
 * HelpArticleView renders one complete guide including metadata, images, and walkthrough steps.
 */
export default function HelpArticleView({ article, related, scope }: HelpArticleViewProps) {
  const readinessTone = article.featureReadiness === "Working"
    ? "border-green-200 bg-green-50 text-green-800"
    : "border-amber-200 bg-amber-50 text-amber-900";

  const params = new URLSearchParams();
  params.set("scope", scope);

  return (
    <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <HelpScopeBadge scope={article.crmScope} />
          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{article.category}</span>
          {article.estimatedReadTime ? (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold text-gray-600">{article.estimatedReadTime}</span>
          ) : null}
        </div>
        <h1 className="text-xl font-semibold text-gray-900">{article.title}</h1>
        <p className="text-sm text-gray-600">{article.summary}</p>
      </header>

      {article.featureReadiness ? (
        <p className={`rounded-lg border px-3 py-2 text-xs font-medium ${readinessTone}`}>
          Feature status: {article.featureReadiness}.
          {article.featureReadiness !== "Working" ? " Some workflows may still be in development." : ""}
        </p>
      ) : null}

      <article className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm leading-6 text-gray-700">
        {article.body}
      </article>

      {article.walkthroughSteps && article.walkthroughSteps.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Step-By-Step Walkthrough</h2>
          <ol className="space-y-2">
            {[...article.walkthroughSteps]
              .sort((left, right) => left.order - right.order)
              .map((step) => (
                <li key={step.id} className="rounded-lg border border-gray-200 bg-white p-3 text-sm text-gray-700">
                  <p className="font-semibold text-gray-900">{step.order}. {step.title}</p>
                  <p className="mt-1">{step.instruction}</p>
                  {step.imageUrl ? (
                    <Image
                      src={step.imageUrl}
                      alt={`Walkthrough step: ${step.title}`}
                      width={720}
                      height={400}
                      className="mt-2 h-auto w-full rounded-lg border border-gray-200"
                    />
                  ) : null}
                  {step.targetRoute ? (
                    <Link
                      href={step.targetRoute}
                      className="mt-2 inline-flex rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                    >
                      Open {step.targetRoute}
                    </Link>
                  ) : null}
                </li>
              ))}
          </ol>
        </section>
      ) : null}

      {article.images && article.images.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Images</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {article.images.map((image) => (
              <figure key={image.id} className="rounded-lg border border-gray-200 bg-white p-2">
                <Image src={image.url} alt={image.alt} width={640} height={360} className="h-auto w-full rounded-md border border-gray-100" />
                {image.caption ? <figcaption className="mt-1 text-xs text-gray-500">{image.caption}</figcaption> : null}
              </figure>
            ))}
          </div>
        </section>
      ) : null}

      {related.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold text-gray-900">Related Guides</h2>
          <div className="grid gap-2 md:grid-cols-2">
            {related.map((relatedArticle) => (
              <Link
                key={relatedArticle.id}
                href={`/help/${relatedArticle.slug}?${params.toString()}`}
                className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100"
              >
                {relatedArticle.title}
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <footer className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
        <p>Last updated: {article.lastUpdated}</p>
        <p>Need this updated? Share feedback below so documentation can be reviewed.</p>
      </footer>
    </section>
  );
}
