/** StewardMessageRenderer renders assistant output with GitHub-style markdown support. */
"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StewardMessageRendererProps {
  content: string;
  tone?: "dark" | "light";
}

/** Resolves assistant links to in-app routes when they point to the current CRM origin. */
function resolveInternalHref(href?: string): string | null {
  if (!href) return null;
  if (href.startsWith("/")) return href;
  if (href.startsWith("#")) return href;
  if (typeof window === "undefined") return null;

  try {
    const parsed = new URL(href, window.location.origin);
    if (parsed.origin !== window.location.origin) return null;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/** StewardMessageRenderer renders formatted assistant output for better readability. */
export default function StewardMessageRenderer({ content, tone = "dark" }: StewardMessageRendererProps) {
  const isLight = tone === "light";
  const textClass = isLight ? "text-slate-700" : "text-[#c9d1d9]";
  const headingClass = isLight ? "text-slate-900" : "text-[#f0f6fc]";
  const subtleClass = isLight ? "text-slate-500" : "text-[#8b949e]";
  const borderClass = isLight ? "border-slate-200" : "border-[#30363d]";
  const surfaceClass = isLight ? "bg-slate-100" : "bg-[#161b22]";
  const surfaceDeepClass = isLight ? "bg-slate-50" : "bg-[#0d1117]";
  const linkClass = isLight ? "text-emerald-700 hover:text-emerald-800" : "text-[#58a6ff] hover:text-[#79c0ff]";

  return (
    <div className={`max-w-none text-sm leading-relaxed ${textClass}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className={`text-base font-semibold mt-2 mb-2 ${headingClass}`}>{children}</h1>,
          h2: ({ children }) => <h2 className={`text-sm font-semibold mt-2 mb-1.5 ${headingClass}`}>{children}</h2>,
          h3: ({ children }) => <h3 className={`text-sm font-semibold mt-2 mb-1.5 ${headingClass}`}>{children}</h3>,
          p: ({ children }) => <p className={`my-1.5 ${textClass}`}>{children}</p>,
          a: ({ href, children }) => {
            const internalHref = resolveInternalHref(href);

            if (internalHref) {
              return (
                <Link href={internalHref} className={`${linkClass} underline font-medium`}>
                  {children}
                </Link>
              );
            }

            return (
              <a href={href} className={`${linkClass} underline`} target="_blank" rel="noreferrer">
                {children}
              </a>
            );
          },
          strong: ({ children }) => <strong className={`font-semibold ${headingClass}`}>{children}</strong>,
          em: ({ children }) => <em className={subtleClass}>{children}</em>,
          ul: ({ children }) => (
            <ul className={`list-disc pl-5 my-1.5 ${isLight ? "marker:text-slate-500" : "marker:text-[#8b949e]"}`}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={`list-decimal pl-5 my-1.5 ${isLight ? "marker:text-slate-500" : "marker:text-[#8b949e]"}`}>
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className={`border-l-2 pl-3 italic my-2 ${subtleClass} ${borderClass}`}>
              {children}
            </blockquote>
          ),
          hr: () => <hr className={`my-3 ${borderClass}`} />,
          table: ({ children }) => (
            <div className={`overflow-x-auto chat-scroll-smooth my-2 rounded-md border ${borderClass}`}>
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className={surfaceClass}>{children}</thead>,
          th: ({ children }) => <th className={`text-left px-2 py-1 border-b ${borderClass} ${headingClass}`}>{children}</th>,
          td: ({ children }) => <td className={`px-2 py-1 border-b ${borderClass} ${textClass}`}>{children}</td>,
          code: ({ className, children }) => {
            const languageMatch = /language-([\w-]+)/.exec(className || "");
            const raw = String(children ?? "");
            const isBlock = Boolean(languageMatch) || raw.includes("\n");

            if (!isBlock) {
              return (
                <code className={`rounded border px-1 py-0.5 text-[12px] ${surfaceClass} ${borderClass} ${headingClass}`}>
                  {children}
                </code>
              );
            }

            return (
              <div className={`rounded-md border overflow-hidden my-2 ${borderClass} ${surfaceClass}`}>
                {languageMatch && (
                  <div className={`px-2.5 py-1 text-[11px] uppercase tracking-wide border-b ${subtleClass} ${borderClass} ${surfaceDeepClass}`}>
                    {languageMatch[1]}
                  </div>
                )}
                <pre className={`px-3 py-2 text-xs overflow-x-auto chat-scroll-smooth ${textClass}`}>
                  <code>{raw}</code>
                </pre>
              </div>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
