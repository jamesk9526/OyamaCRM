// Reusable snippet card with copy controls for the Site Embed admin install experience.
"use client";

import { useMemo, useState } from "react";

interface EmbedSnippetCardProps {
  /** Card heading shown above the snippet block. */
  title: string;
  /** Plain-language install guidance shown under the heading. */
  description: string;
  /** Generated snippet text rendered in a copy-friendly code block. */
  code: string;
}

/**
 * EmbedSnippetCard renders one generated embed snippet with one-click copy behavior.
 * The copy state auto-resets so admins can copy multiple snippets in sequence.
 */
export default function EmbedSnippetCard({ title, description, code }: EmbedSnippetCardProps) {
  const [copied, setCopied] = useState(false);
  const lineCount = useMemo(() => code.split("\n").length, [code]);

  /** Copies the snippet to clipboard and sets a temporary success state. */
  async function copySnippet() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
      window.alert("Could not copy snippet. Please copy it manually.");
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
          <p className="mt-1 text-xs text-gray-500">{description}</p>
          <p className="mt-2 text-[11px] font-medium text-gray-400">{lineCount} lines generated</p>
        </div>
        <button
          type="button"
          onClick={() => void copySnippet()}
          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <pre className="mt-3 max-h-64 overflow-auto rounded-lg border border-gray-200 bg-gray-50 p-3 text-[11px] leading-5 text-gray-700">
        <code>{code}</code>
      </pre>
    </section>
  );
}
