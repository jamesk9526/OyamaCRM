/**
 * EmailPreview — HTML preview modal
 *
 * Renders the generated email HTML in a sandboxed iframe and provides
 * a "Copy HTML" button.  Opened by the top-bar Preview button.
 */

'use client';

import { useEffect, useRef } from 'react';
import { generateEmailHtml } from '@/app/lib/email-builder-utils';
import type { EmailTemplate } from '@/app/lib/email-builder-types';

interface Props {
  template: EmailTemplate;
  onClose:  () => void;
}

/**
 * Full-screen modal showing the rendered email HTML in an iframe.
 * Closes on Escape key or backdrop click.
 */
export default function EmailPreview({ template, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const html      = generateEmailHtml(template);

  /* Write generated HTML directly into the iframe document */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [html]);

  /* Close on Escape key */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const copyHtml = () => {
    navigator.clipboard.writeText(html).catch(() => {/* ignore */});
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal panel — stop click propagation so backdrop close doesn't fire */}
      <div
        className="relative bg-white rounded-xl shadow-2xl flex flex-col"
        style={{ width: '90vw', height: '90vh', maxWidth: 900 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
          <h2 className="text-sm font-semibold text-gray-800">Email Preview</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={copyHtml}
              className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-md transition-colors"
            >
              Copy HTML
            </button>
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-md transition-colors"
            >
              ✕ Close
            </button>
          </div>
        </div>

        {/* Tab bar — Desktop / Mobile toggles */}
        <div className="flex gap-1 px-5 py-2 border-b border-gray-100 bg-gray-50 shrink-0 text-xs font-medium text-gray-500">
          <span>Desktop preview (600 px)</span>
        </div>

        {/* iframe */}
        <div className="flex-1 overflow-auto bg-gray-100 p-4">
          <iframe
            ref={iframeRef}
            title="Email preview"
            sandbox="allow-same-origin"
            className="w-full h-full bg-white rounded shadow-md border border-gray-200"
            style={{ minHeight: 400 }}
          />
        </div>

        {/* Source code section */}
        <details className="shrink-0 border-t border-gray-200">
          <summary className="px-5 py-2 text-xs font-semibold text-gray-500 cursor-pointer hover:bg-gray-50 select-none">
            View HTML Source
          </summary>
          <pre className="overflow-auto max-h-48 px-5 py-3 text-xs font-mono text-gray-700 bg-gray-50">
            {html}
          </pre>
        </details>
      </div>
    </div>
  );
}
