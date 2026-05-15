/** WorkspaceHelpTip adds compact contextual help without cluttering page layouts. */
"use client";

import Link from "next/link";

interface WorkspaceHelpTipProps {
  title: string;
  summary: string;
  body: string;
  example?: string;
  href?: string;
  hrefLabel?: string;
}

/**
 * WorkspaceHelpTip keeps short helper guidance near page controls.
 * Uses a native details/summary interaction so users can expand guidance only when needed.
 */
export default function WorkspaceHelpTip({
  title,
  summary,
  body,
  example,
  href,
  hrefLabel = "Learn more",
}: WorkspaceHelpTipProps) {
  return (
    <details className="group rounded-lg border border-gray-200 bg-white px-3 py-2 max-w-sm">
      <summary className="list-none cursor-pointer flex items-center gap-2 text-xs font-semibold text-gray-700">
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-gray-300 bg-gray-50 text-gray-500">
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 22a10 10 0 100-20 10 10 0 000 20z" />
          </svg>
        </span>
        <span>{summary}</span>
        <span className="ml-auto text-[10px] text-gray-400 group-open:hidden">What is this?</span>
      </summary>

      <div className="mt-2 space-y-2 border-t border-gray-100 pt-2">
        <p className="text-xs font-semibold text-gray-800">{title}</p>
        <p className="text-xs text-gray-600 leading-relaxed">{body}</p>
        {example ? (
          <p className="text-xs text-gray-500">
            <span className="font-semibold text-gray-700">Example:</span> {example}
          </p>
        ) : null}
        {href ? (
          <Link href={href} className="inline-flex text-xs font-semibold text-green-700 hover:text-green-800 hover:underline">
            {hrefLabel}
          </Link>
        ) : null}
      </div>
    </details>
  );
}
