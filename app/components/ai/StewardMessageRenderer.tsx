/** StewardMessageRenderer renders assistant output with GitHub-style markdown support. */
"use client";

import Link from "next/link";
import ReactMarkdown from "react-markdown";

interface StewardMessageRendererProps {
  content: string;
  tone?: "dark" | "light";
  renderMode?: "markdown" | "html";
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
export default function StewardMessageRenderer({ content, tone = "dark", renderMode = "markdown" }: StewardMessageRendererProps) {
  const isLight = tone === "light";
  const textClass = isLight ? "text-slate-700" : "text-[#c9d1d9]";
  const headingClass = isLight ? "text-slate-900" : "text-[#f0f6fc]";
  const subtleClass = isLight ? "text-slate-500" : "text-[#8b949e]";
  const borderClass = isLight ? "border-slate-200" : "border-[#30363d]";
  const surfaceClass = isLight ? "bg-slate-100" : "bg-[#161b22]";
  const surfaceDeepClass = isLight ? "bg-slate-50" : "bg-[#0d1117]";
  const linkClass = isLight ? "text-emerald-700 hover:text-emerald-800" : "text-[#58a6ff] hover:text-[#79c0ff]";

  if (renderMode === "html") {
    const html = content.trim();
    const srcDoc = `<!doctype html><html><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /><style>body{margin:0;padding:12px;font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;font-size:14px;line-height:1.55;color:#0f172a;background:#fff;}a{color:#047857;}pre{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px;overflow:auto;}code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;}img{max-width:100%;height:auto;}</style></head><body>${html}</body></html>`;
    return (
      <div className="space-y-2">
        <div className={`overflow-hidden rounded-lg border ${borderClass}`}>
          <iframe
            title="Steward HTML preview"
            srcDoc={srcDoc}
            sandbox=""
            className="h-64 w-full bg-white"
          />
        </div>
        <details className={`rounded-lg border ${borderClass} bg-white p-2`}>
          <summary className={`cursor-pointer text-xs font-semibold ${headingClass}`}>Raw HTML</summary>
          <pre className={`mt-2 overflow-x-auto rounded-md ${surfaceClass} p-2 text-xs ${textClass}`}>
            <code>{content}</code>
          </pre>
        </details>
      </div>
    );
  }

  return (
    <div className={`max-w-none text-sm leading-7 tracking-[0.01em] ${textClass} ${isLight ? "space-y-0.5" : ""}`}>
      <ReactMarkdown
        components={{
          h1: ({ children }) => <h1 className={`text-lg font-semibold mt-4 mb-2 ${headingClass}`}>{children}</h1>,
          h2: ({ children }) => <h2 className={`text-base font-semibold mt-4 mb-2 ${headingClass}`}>{children}</h2>,
          h3: ({ children }) => <h3 className={`text-sm font-semibold mt-3 mb-1.5 ${headingClass}`}>{children}</h3>,
          p: ({ children }) => <p className={`my-2 ${textClass} ${isLight ? "text-[14px]" : ""}`}>{children}</p>,
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
            <ul className={`list-disc pl-5 my-2 space-y-1 ${isLight ? "marker:text-slate-500" : "marker:text-[#8b949e]"}`}>
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className={`list-decimal pl-5 my-2 space-y-1 ${isLight ? "marker:text-slate-500" : "marker:text-[#8b949e]"}`}>
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="my-0.5 leading-6">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className={`my-3 rounded-r-xl border-l-2 px-3 py-2 italic ${subtleClass} ${borderClass} ${isLight ? "bg-slate-50" : ""}`}>
              {children}
            </blockquote>
          ),
          hr: () => <hr className={`my-3 ${borderClass}`} />,
          table: ({ children }) => (
            <div className={`overflow-x-auto chat-scroll-smooth my-3 rounded-xl border ${borderClass} ${isLight ? "bg-white" : ""}`}>
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
              <div className={`rounded-lg border overflow-hidden my-3 shadow-sm ${borderClass} ${surfaceClass}`}>
                {languageMatch && (
                  <div className={`px-2.5 py-1 text-[11px] uppercase tracking-wide border-b ${subtleClass} ${borderClass} ${surfaceDeepClass}`}>
                    {languageMatch[1]}
                  </div>
                )}
                <pre className={`px-3 py-2.5 text-xs overflow-x-auto chat-scroll-smooth leading-6 ${textClass}`}>
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
