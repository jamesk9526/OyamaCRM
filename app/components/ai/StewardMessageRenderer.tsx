/** StewardMessageRenderer renders assistant output with GitHub-style markdown support. */
"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface StewardMessageRendererProps {
  content: string;
}

/** StewardMessageRenderer renders formatted assistant output for better readability. */
export default function StewardMessageRenderer({ content }: StewardMessageRendererProps) {
  return (
    <div className="prose prose-invert max-w-none text-sm leading-relaxed text-[#c9d1d9]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-base font-semibold text-[#f0f6fc] mt-2 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-sm font-semibold text-[#f0f6fc] mt-2 mb-1.5">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold text-[#f0f6fc] mt-2 mb-1.5">{children}</h3>,
          p: ({ children }) => <p className="my-1.5 text-[#c9d1d9]">{children}</p>,
          a: ({ href, children }) => (
            <a href={href} className="text-[#58a6ff] hover:text-[#79c0ff] underline" target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-[#f0f6fc]">{children}</strong>,
          em: ({ children }) => <em className="text-[#8b949e]">{children}</em>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-1.5 marker:text-[#8b949e]">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5 marker:text-[#8b949e]">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#30363d] pl-3 italic text-[#8b949e] my-2">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-[#30363d] my-3" />,
          table: ({ children }) => (
            <div className="overflow-x-auto chat-scroll-smooth my-2 rounded-md border border-[#30363d]">
              <table className="w-full text-xs">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#161b22]">{children}</thead>,
          th: ({ children }) => <th className="text-left px-2 py-1 border-b border-[#30363d] text-[#f0f6fc]">{children}</th>,
          td: ({ children }) => <td className="px-2 py-1 border-b border-[#21262d] text-[#c9d1d9]">{children}</td>,
          code: ({ className, children }) => {
            const languageMatch = /language-([\w-]+)/.exec(className || "");
            const raw = String(children ?? "");
            const isBlock = Boolean(languageMatch) || raw.includes("\n");

            if (!isBlock) {
              return (
                <code className="rounded bg-[#161b22] border border-[#30363d] px-1 py-0.5 text-[12px] text-[#e6edf3]">
                  {children}
                </code>
              );
            }

            return (
              <div className="rounded-md border border-[#30363d] bg-[#161b22] overflow-hidden my-2">
                {languageMatch && (
                  <div className="px-2.5 py-1 text-[11px] uppercase tracking-wide text-[#8b949e] border-b border-[#30363d] bg-[#0d1117]">
                    {languageMatch[1]}
                  </div>
                )}
                <pre className="px-3 py-2 text-xs text-[#c9d1d9] overflow-x-auto chat-scroll-smooth">
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
