/**
 * EmailPreview — HTML preview modal
 *
 * Renders the generated email HTML in a sandboxed iframe and provides
 * a "Copy HTML" button.  Opened by the top-bar Preview button.
 */

'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { apiFetch } from '@/app/lib/auth-client';
import { generateEmailHtml } from '@/app/lib/email-builder-utils';
import type { EmailTemplate } from '@/app/lib/email-builder-types';

interface Props {
  template: EmailTemplate;
  campaignId?: string | null;
  isDirty?: boolean;
  onClose:  () => void;
}

interface CampaignPreviewPayload {
  subject: string;
  previewText: string | null;
  bodyHtml: string;
  previewMode?: 'audience-sample' | 'manual-email' | 'template-only';
  previewRecipient?: {
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
  } | null;
}

/**
 * Full-screen modal showing the rendered email HTML in an iframe.
 * Closes on Escape key or backdrop click.
 */
export default function EmailPreview({ template, campaignId, isDirty = false, onClose }: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const localHtml = generateEmailHtml(template);
  const [remotePreview, setRemotePreview] = useState<CampaignPreviewPayload | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    if (!campaignId) {
      setRemotePreview(null);
      setPreviewError(null);
      setLoadingPreview(false);
      return;
    }

    let cancelled = false;
    setLoadingPreview(true);
    setPreviewError(null);

    apiFetch<CampaignPreviewPayload>(`/api/email-campaigns/${campaignId}/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((payload) => {
        if (!cancelled) {
          setRemotePreview(payload);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setRemotePreview(null);
          setPreviewError(error instanceof Error ? error.message : 'Failed to load donor preview.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingPreview(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId]);

  const activeHtml = useMemo(() => {
    if (!isDirty && remotePreview?.bodyHtml) {
      return remotePreview.bodyHtml;
    }
    return localHtml;
  }, [isDirty, localHtml, remotePreview]);

  const previewMessage = useMemo(() => {
    if (loadingPreview) {
      return {
        tone: 'border-sky-200 bg-sky-50 text-sky-700',
        text: 'Loading saved donor preview sample.',
      };
    }

    if (previewError) {
      return {
        tone: 'border-amber-200 bg-amber-50 text-amber-700',
        text: previewError,
      };
    }

    if (!campaignId) {
      return {
        tone: 'border-slate-200 bg-slate-50 text-slate-600',
        text: 'Save this draft to unlock donor-personalized preview.',
      };
    }

    if (remotePreview?.previewMode === 'audience-sample' && remotePreview.previewRecipient) {
      const recipientLabel = remotePreview.previewRecipient.fullName || remotePreview.previewRecipient.email;
      if (isDirty) {
        return {
          tone: 'border-amber-200 bg-amber-50 text-amber-700',
          text: `Showing local unsaved preview. Save draft to refresh the donor preview sample for ${recipientLabel}.`,
        };
      }

      return {
        tone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        text: `Showing saved donor preview sample for ${recipientLabel}.`,
      };
    }

    if (remotePreview?.previewMode === 'manual-email' && remotePreview.previewRecipient) {
      const recipientLabel = remotePreview.previewRecipient.fullName || remotePreview.previewRecipient.email;
      return {
        tone: 'border-sky-200 bg-sky-50 text-sky-700',
        text: `Showing donor preview for ${recipientLabel}.`,
      };
    }

    return {
      tone: 'border-slate-200 bg-slate-50 text-slate-600',
      text: isDirty
        ? 'No eligible donor sample is available yet. This is a local unsaved preview.'
        : 'No eligible donor sample is available yet. This is a template-only preview.',
    };
  }, [campaignId, isDirty, loadingPreview, previewError, remotePreview]);

  /* Write generated HTML directly into the iframe document */
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(activeHtml);
    doc.close();
  }, [activeHtml]);

  /* Close on Escape key */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const copyHtml = () => {
    navigator.clipboard.writeText(activeHtml).catch(() => {/* ignore */});
  };

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
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

        <div className={`mx-5 mt-4 rounded-lg border px-3 py-2 text-xs ${previewMessage.tone}`}>
          {previewMessage.text}
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
            {activeHtml}
          </pre>
        </details>
      </div>
    </div>
  );
}
