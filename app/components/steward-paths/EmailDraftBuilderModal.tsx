/**
 * EmailDraftBuilderModal embeds the Communications email builder for a workflow email-draft node.
 */
// NOTE: Keep this modal custom; it embeds the full email builder and campaign draft persistence.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmailBuilderApp from "@/app/components/email-builder/EmailBuilderApp";
import type { EmailBlock, EmailTemplate, TextBlock, ButtonBlock } from "@/app/lib/email-builder-types";
import { apiFetch } from "@/app/lib/auth-client";
import {
  createDefaultBlock,
  generateEmailHtml,
  generatePlainText,
} from "@/app/lib/email-builder-utils";
import type { WorkflowNode } from "./workflow-types";

interface EmailDraftBuilderModalProps {
  node: WorkflowNode;
  startFresh?: boolean;
  onChange: (next: WorkflowNode) => void;
  onClose: () => void;
}

interface CreatedCampaign {
  id: string;
  name: string;
  subject: string;
  status: string;
}

interface CampaignPreviewResponse {
  subject?: string | null;
  previewText?: string | null;
  bodyHtml?: string | null;
  status?: string | null;
}

interface CampaignRecordResponse {
  id: string;
}

/** Reads a string config value without leaking unknown values into form state. */
function readString(config: Record<string, unknown>, key: string): string {
  const value = config[key];
  return typeof value === "string" ? value : "";
}

/** Escapes user-authored node text before it becomes starter email HTML. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Converts plain multiline text into basic email-builder paragraph HTML. */
function textToParagraphHtml(value: string): string {
  const paragraphs = value
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (paragraphs.length === 0) {
    return "<p>Hello {{firstName}},</p><p>Thank you for your generosity. Your support helps move this mission forward.</p>";
  }

  return paragraphs
    .map((part) => `<p>${escapeHtml(part).replace(/\n/g, "<br />")}</p>`)
    .join("");
}

/** Creates the first saved campaign draft from node settings so the embedded builder can save/test-send normally. */
function buildStarterTemplate(node: WorkflowNode): EmailTemplate {
  const bodyTemplate = readString(node.config, "bodyTemplate");
  const ctaLabel = readString(node.config, "ctaLabel");
  const ctaUrl = readString(node.config, "ctaUrl");
  const includeUnsubscribeLink = node.config.includeUnsubscribeLink !== false;
  const textBlock = {
    ...createDefaultBlock("text"),
    content: textToParagraphHtml(bodyTemplate),
  } as TextBlock;
  const blocks: EmailBlock[] = [textBlock];

  if (ctaLabel.trim()) {
    blocks.push({
      ...createDefaultBlock("button"),
      label: ctaLabel.trim(),
      href: ctaUrl.trim() || "https://",
    } as ButtonBlock);
  }

  if (includeUnsubscribeLink) {
    blocks.push(createDefaultBlock("footerCompliance"));
  }

  return {
    backgroundColor: "#f5f5f5",
    contentWidth: 600,
    fontFamily: "Arial, Helvetica, sans-serif",
    blocks,
  };
}

/** Full-screen modal that links a workflow email step to a real campaign draft. */
export default function EmailDraftBuilderModal({ node, startFresh = false, onChange, onClose }: EmailDraftBuilderModalProps) {
  const [campaignId, setCampaignId] = useState(() => (startFresh ? "" : readString(node.config, "campaignId")));
  const [campaignStatus, setCampaignStatus] = useState(() => readString(node.config, "campaignStatus") || "DRAFT");
  const [lastSavedAt, setLastSavedAt] = useState(() => readString(node.config, "emailBuilderSavedAt"));
  const [previewHtml, setPreviewHtml] = useState(() => generateEmailHtml(buildStarterTemplate(node)));
  const [previewSubject, setPreviewSubject] = useState(() => readString(node.config, "subjectTemplate") || node.title || "Steward Path Email Draft");
  const [previewIsUnsaved, setPreviewIsUnsaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(() => Boolean((startFresh ? "" : readString(node.config, "campaignId")).trim()));
  const nodeRef = useRef(node);
  const onChangeRef = useRef(onChange);

  const starterTemplate = useMemo(() => buildStarterTemplate(node), [node]);

  useEffect(() => {
    nodeRef.current = node;
  }, [node]);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const updateNodeCampaign = useCallback((partial: Record<string, unknown>) => {
    const currentNode = nodeRef.current;
    onChangeRef.current({
      ...currentNode,
      config: {
        ...currentNode.config,
        ...partial,
      },
    });
  }, []);

  const refreshPreview = useCallback(async (id: string) => {
    try {
      const preview = await apiFetch<CampaignPreviewResponse>(`/api/email-campaigns/${id}/preview`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const currentNode = nodeRef.current;
      setPreviewSubject(preview.subject || readString(currentNode.config, "subjectTemplate") || currentNode.title);
      setCampaignStatus(preview.status || "DRAFT");
      if (preview.bodyHtml) {
        setPreviewHtml(preview.bodyHtml);
      }
      setPreviewIsUnsaved(false);
      updateNodeCampaign({
        campaignStatus: preview.status || "DRAFT",
      });
    } catch {
      setPreviewHtml(generateEmailHtml(buildStarterTemplate(nodeRef.current)));
    }
  }, [updateNodeCampaign]);

  /** Creates one fresh persisted campaign draft from current node settings. */
  const createDraftCampaign = useCallback(async () => {
    const currentNode = nodeRef.current;
    const nextStarterTemplate = buildStarterTemplate(currentNode);
    const subject = readString(currentNode.config, "subjectTemplate") || currentNode.title || "Steward Path Email Draft";
    const templateJson = JSON.stringify(nextStarterTemplate);
    const created = await apiFetch<CreatedCampaign>("/api/email-campaigns", {
      method: "POST",
      body: JSON.stringify({
        name: `${currentNode.title || "Steward Path"} Draft`,
        subject,
        previewText: readString(currentNode.config, "preheaderText") || undefined,
        bodyHtml: generateEmailHtml(nextStarterTemplate),
        bodyText: generatePlainText(nextStarterTemplate),
        templateJson,
        purpose: "THANK_YOU",
        preparationStatus: "DRAFT",
        sharedWithOrganization: true,
      }),
    });

    return created;
  }, []);

  /** Returns true when an existing linked campaign should be recreated for this node. */
  const shouldRecreateCampaign = useCallback((id: string, error: unknown): boolean => {
    const trimmedId = id.trim();
    if (!trimmedId) return true;
    if (trimmedId.toLowerCase().startsWith("demo_")) return true;

    const message = error instanceof Error ? error.message : String(error);
    if (/not found/i.test(message)) return true;
    if (/\b404\b/.test(message)) return true;
    if (/invalid/i.test(message) && /campaign/i.test(message)) return true;
    return false;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function ensureCampaign() {
      const linkedCampaignId = campaignId.trim();
      const isDemoLinkedCampaign = linkedCampaignId.toLowerCase().startsWith("demo_");

      if (linkedCampaignId && !isDemoLinkedCampaign) {
        setCreating(true);
        setError(null);
        try {
          await apiFetch<CampaignRecordResponse>(`/api/email-campaigns/${linkedCampaignId}`);
          await refreshPreview(linkedCampaignId);
          if (!cancelled) setCreating(false);
          return;
        } catch (err) {
          if (!shouldRecreateCampaign(linkedCampaignId, err)) {
            if (!cancelled) {
              setError(err instanceof Error ? err.message : "Failed to load linked campaign.");
              setCreating(false);
            }
            return;
          }
        }
      }

      setCreating(true);
      setError(null);
      try {
        const created = await createDraftCampaign();

        if (cancelled) return;
        const savedAt = new Date().toISOString();
        const currentNode = nodeRef.current;
        setCampaignId(created.id);
        setCampaignStatus(created.status || "DRAFT");
        setLastSavedAt(savedAt);
        setPreviewSubject(
          created.subject
            || readString(currentNode.config, "subjectTemplate")
            || currentNode.title
            || "Steward Path Email Draft",
        );
        setPreviewIsUnsaved(false);
        updateNodeCampaign({
          campaignId: created.id,
          campaignName: created.name,
          campaignStatus: created.status || "DRAFT",
          emailBuilderSavedAt: savedAt,
          emailBuilderSource: "steward-path",
        });
        await refreshPreview(created.id);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to create email draft.");
      } finally {
        if (!cancelled) setCreating(false);
      }
    }

    void ensureCampaign();
    return () => {
      cancelled = true;
    };
  }, [campaignId, createDraftCampaign, refreshPreview, shouldRecreateCampaign, updateNodeCampaign]);

  const handleSaved = useCallback(async () => {
    if (!campaignId) return;
    const savedAt = new Date().toISOString();
    setLastSavedAt(savedAt);
    updateNodeCampaign({
      campaignId,
      campaignStatus: "DRAFT",
      emailBuilderSavedAt: savedAt,
      emailBuilderSource: "steward-path",
    });
    await refreshPreview(campaignId);
  }, [campaignId, refreshPreview, updateNodeCampaign]);

  const handleDraftChange = useCallback((draft: {
    subject: string;
    previewText: string;
    bodyHtml: string;
    dirty: boolean;
  }) => {
    setPreviewSubject(draft.subject || "Email Campaign");
    setPreviewHtml(draft.bodyHtml);
    setPreviewIsUnsaved(draft.dirty);
  }, []);

  const attemptClose = useCallback(() => {
    if (!previewIsUnsaved) {
      onClose();
      return;
    }

    const confirmed = window.confirm("You have unsaved email builder changes. Close and lose unsaved edits?");
    if (!confirmed) return;
    onClose();
  }, [onClose, previewIsUnsaved]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      attemptClose();
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [attemptClose]);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) attemptClose();
      }}
    >
      <div className="flex h-[94vh] w-[96vw] max-w-[1720px] flex-col overflow-hidden rounded-2xl border border-slate-700 bg-slate-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950 px-5 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white">Email Draft Builder</p>
            <p className="truncate text-xs text-slate-400">
              {previewSubject} · {campaignId ? `Campaign ${campaignId}` : "Creating draft campaign"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-200">
              {previewIsUnsaved ? "Unsaved changes" : lastSavedAt ? `Saved ${new Date(lastSavedAt).toLocaleTimeString()}` : campaignStatus}
            </span>
            <button
              type="button"
              onClick={attemptClose}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-900"
            >
              Close
            </button>
          </div>
        </div>

        {error ? (
          <div className="m-4 space-y-3 rounded-xl border border-rose-400/40 bg-rose-950/40 p-4 text-sm text-rose-100">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => {
                setError(null);
                setCreating(true);
                setCampaignId("");
              }}
              className="rounded-md border border-rose-300/60 bg-rose-900/40 px-3 py-1.5 text-xs font-semibold text-rose-100 hover:bg-rose-900/70"
            >
              Retry with a fresh draft campaign
            </button>
          </div>
        ) : null}

        {error ? null : creating || !campaignId ? (
          <div className="flex flex-1 items-center justify-center text-sm text-slate-300">
            <span className="mr-3 h-5 w-5 animate-spin rounded-full border-2 border-emerald-400 border-t-transparent" />
            Creating review-required draft...
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_390px] divide-x divide-slate-800">
            <div className="min-w-0 overflow-hidden bg-white">
              <EmailBuilderApp
                campaignId={campaignId}
                embedded
                initialTemplate={starterTemplate}
                initialCampaignName={readString(node.config, "campaignName") || `${node.title || "Steward Path"} Draft`}
                initialSubject={previewSubject}
                initialPreviewText={readString(node.config, "preheaderText")}
                onSaved={handleSaved}
                onDraftChange={handleDraftChange}
              />
            </div>
            <aside className="flex min-h-0 flex-col bg-slate-950">
              <div className="border-b border-slate-800 px-4 py-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Live Preview</p>
                <p className="mt-1 truncate text-sm font-semibold text-white">{previewSubject}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {previewIsUnsaved ? "Showing unsaved builder changes." : "Preview is synced with the saved draft."}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-hidden bg-slate-900 p-3">
                <iframe
                  title="Steward path email draft preview"
                  srcDoc={previewHtml}
                  className="h-full w-full rounded-xl border border-slate-700 bg-white"
                />
              </div>
            </aside>
          </div>
        )}
      </div>
    </div>
  );
}
