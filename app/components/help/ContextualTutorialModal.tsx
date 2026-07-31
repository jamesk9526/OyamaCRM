"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import {
  getContextualHelpSuggestions,
  searchHelpArticles,
  type HelpArticle,
  type HelpCrmScope,
} from "@/app/help-content";

interface ContextualTutorialModalProps {
  open: boolean;
  onClose: () => void;
  pathname: string;
  scope: HelpCrmScope;
  helpHref: string;
}

function TutorialMedia({ article }: { article: HelpArticle }) {
  const media = article.tutorialMedia?.[0];
  const image = article.images?.[0];

  if (media?.type === "video") {
    return <video controls className="max-h-72 w-full rounded border border-slate-200 bg-slate-950" src={media.url}>{media.label}</video>;
  }
  if (media?.type === "audio") {
    return (
      <div className="rounded border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-xs font-semibold text-slate-700">{media.label}</p>
        <audio controls className="w-full" src={media.url}>{media.label}</audio>
      </div>
    );
  }
  if (media?.type === "screenshot" || image) {
    const screenshot = media?.type === "screenshot"
      ? { url: media.url, alt: media.alt ?? media.label, caption: media.label }
      : image;
    if (screenshot) {
      return (
        <figure className="overflow-hidden rounded border border-slate-200 bg-slate-50">
          <Image src={screenshot.url} alt={screenshot.alt} width={720} height={405} className="h-auto max-h-72 w-full object-contain" />
          {screenshot.caption ? <figcaption className="border-t border-slate-200 px-3 py-2 text-xs text-slate-500">{screenshot.caption}</figcaption> : null}
        </figure>
      );
    }
  }

  return null;
}

/** Displays the most relevant current-page guides without leaving the active workspace. */
export default function ContextualTutorialModal({ open, onClose, pathname, scope, helpHref }: ContextualTutorialModalProps) {
  const titleId = useId();
  const suggestions = useMemo(() => {
    const contextual = getContextualHelpSuggestions({ pathname, scope, limit: 4 });
    return contextual.length ? contextual : searchHelpArticles({ query: "", scope, limit: 4 }).map((result) => result.article);
  }, [pathname, scope]);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const selected = suggestions.find((article) => article.slug === selectedSlug) ?? suggestions[0] ?? null;

  useEffect(() => {
    if (open) setSelectedSlug(suggestions[0]?.slug ?? null);
  }, [open, suggestions]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 p-3 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl flex-col overflow-hidden rounded-lg border border-slate-300 bg-white shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#0f6cbd]">Page tutorial</p>
            <h2 id={titleId} className="mt-0.5 text-lg font-semibold text-slate-950">Help for this workspace</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close page tutorial" className="grid h-8 w-8 shrink-0 place-items-center rounded border border-slate-300 text-lg leading-none text-slate-600 hover:bg-slate-100 hover:text-slate-950">×</button>
        </header>

        {selected ? (
          <div className="grid min-h-0 flex-1 md:grid-cols-[13rem_minmax(0,1fr)]">
            <nav aria-label="Page tutorials" className="max-h-48 overflow-y-auto border-b border-slate-200 bg-slate-50 p-2 md:max-h-none md:border-b-0 md:border-r">
              {suggestions.map((article) => (
                <button
                  key={article.id}
                  type="button"
                  onClick={() => setSelectedSlug(article.slug)}
                  className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${article.slug === selected.slug ? "bg-[#eff6fc] font-semibold text-[#0f6cbd]" : "text-slate-700 hover:bg-white hover:text-slate-950"}`}
                >
                  {article.title}
                </button>
              ))}
            </nav>
            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">{selected.category}</span>
                {selected.estimatedReadTime ? <span className="text-xs text-slate-500">{selected.estimatedReadTime}</span> : null}
              </div>
              <h3 className="mt-2 text-xl font-semibold text-slate-950">{selected.title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selected.summary}</p>
              <div className="mt-4"><TutorialMedia article={selected} /></div>
              {selected.walkthroughSteps?.length ? (
                <ol className="mt-4 space-y-2">
                  {[...selected.walkthroughSteps].sort((left, right) => left.order - right.order).map((step) => (
                    <li key={step.id} className="flex gap-3 text-sm text-slate-700">
                      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#0f6cbd] text-[11px] font-bold text-white">{step.order}</span>
                      <span><strong className="text-slate-900">{step.title}.</strong> {step.instruction}</span>
                    </li>
                  ))}
                </ol>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="p-5 text-sm text-slate-600">No page-specific tutorial is published yet.</div>
        )}

        <footer className="flex justify-end border-t border-slate-200 bg-slate-50 px-4 py-3 sm:px-5">
          <Link href={helpHref} onClick={onClose} className="rounded border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100">Open Help Search</Link>
        </footer>
      </section>
    </div>
  );
}