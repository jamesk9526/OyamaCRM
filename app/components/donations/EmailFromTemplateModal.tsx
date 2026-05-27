"use client";

/**
 * EmailFromTemplateModal
 * Two-step workflow for sending a personalized template email to one donor from a donation row.
 *
 * Step 1 — Template Library: Lists DRAFT email campaigns; user picks one.
 * Step 2 — Edit & Preview: Split panel with block editor (left) and live iframe preview (right).
 *           Donation merge tokens are pre-applied. Edit individual block fields inline.
 */

import { useEffect, useRef, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { formatCurrency } from "@/app/components/donations/donation-utils";
import { generateEmailHtml } from "@/app/lib/email-builder-utils";
import type { EmailTemplate as EmailBuilderTemplate, EmailBlock } from "@/app/lib/email-builder-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  purpose: string;
  updatedAt: string;
}

interface PreviewPayload {
  templateId: string;
  templateName: string;
  toEmail: string;
  toName: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  resolvedTemplateJson?: string | null;
}

interface SendFromTemplateResponse {
  success: boolean;
  sentTo: string;
  campaignId?: string;
  sendSummary?: {
    status?: string;
    totalRecipients?: number;
    delivered?: number;
    opened?: number;
    clicked?: number;
    bounced?: number;
    sentAt?: string | null;
  };
}

interface DonationContext {
  donationId: string;
  donorName: string;
  donorEmail: string | null | undefined;
  amount: string;
  date: string;
}

interface Props {
  donation: DonationContext;
  onClose: () => void;
}

interface SlashBlockOption {
  key: string;
  label: string;
  html: string;
}

const FALLBACK_BLOCK_OPTIONS: SlashBlockOption[] = [
  { key: "heading", label: "Heading", html: '<h2 style="font-size:24px;font-weight:700;color:#0f172a;margin:8px 0;">New section heading</h2>' },
  { key: "paragraph", label: "Paragraph", html: '<p style="font-size:16px;line-height:1.6;color:#334155;margin:10px 0;">Write your message here...</p>' },
  { key: "button", label: "Button", html: '<p style="margin:16px 0;"><a href="#" style="display:inline-block;background:#16a34a;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:600;">Primary action</a></p>' },
  { key: "divider", label: "Divider", html: '<hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;" />' },
  { key: "image", label: "Image", html: '<p style="margin:16px 0;"><img src="https://placehold.co/640x240" alt="Campaign image" style="display:block;max-width:100%;height:auto;border-radius:10px;" /></p>' },
  { key: "logo", label: "Logo", html: '<p style="margin:10px 0;"><img src="https://placehold.co/220x60?text=Your+Logo" alt="Organization logo" style="display:block;max-width:220px;height:auto;" /></p>' },
  { key: "header", label: "Header", html: '<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin:12px 0;"><p style="margin:0;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:#1d4ed8;font-weight:700;">Update</p><h3 style="margin:6px 0 0 0;font-size:20px;color:#1e293b;">Email header section</h3></div>' },
  { key: "footer", label: "Footer", html: '<div style="border-top:1px solid #e2e8f0;padding-top:12px;margin-top:18px;"><p style="margin:0;font-size:12px;color:#64748b;">You are receiving this email because you are part of our community.</p><p style="margin:6px 0 0 0;font-size:12px;color:#64748b;">Organization Name • Address • City, State ZIP</p></div>' },
];

// ---------------------------------------------------------------------------
// Purpose badge helpers
// ---------------------------------------------------------------------------

const PURPOSE_LABELS: Record<string, string> = {
  NEWSLETTER: "Newsletter",
  APPEAL: "Appeal",
  THANK_YOU: "Thank You",
  EVENT: "Event",
  ANNOUNCEMENT: "Announcement",
  STEWARD: "Stewardship",
  GENERAL: "General",
};

const PURPOSE_COLORS: Record<string, string> = {
  THANK_YOU: "bg-green-100 text-green-700",
  APPEAL: "bg-amber-100 text-amber-700",
  NEWSLETTER: "bg-blue-100 text-blue-700",
  EVENT: "bg-purple-100 text-purple-700",
  STEWARD: "bg-teal-100 text-teal-700",
  ANNOUNCEMENT: "bg-gray-100 text-gray-600",
  GENERAL: "bg-gray-100 text-gray-600",
};

function PurposeBadge({ purpose }: { purpose: string }) {
  const label = PURPOSE_LABELS[purpose] ?? purpose;
  const color = PURPOSE_COLORS[purpose] ?? "bg-gray-100 text-gray-600";
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Block editor helpers
// ---------------------------------------------------------------------------

const BLOCK_META: Record<string, { label: string; icon: string }> = {
  heading: { label: "Heading", icon: "📰" },
  text: { label: "Text", icon: "📝" },
  aiText: { label: "AI Text", icon: "✨" },
  quote: { label: "Quote", icon: "💬" },
  button: { label: "Button", icon: "🔘" },
  aiButton: { label: "AI Button", icon: "🔘" },
  callout: { label: "Callout", icon: "📢" },
  image: { label: "Image", icon: "🖼️" },
  video: { label: "Video", icon: "🎬" },
  divider: { label: "Divider", icon: "—" },
  spacer: { label: "Spacer", icon: "↕" },
  social: { label: "Social Links", icon: "🔗" },
  impactStat: { label: "Impact Stat", icon: "📊" },
  impactStory: { label: "Impact Story", icon: "📖" },
  impactGrid: { label: "Impact Grid", icon: "⚡" },
  progress: { label: "Progress", icon: "📈" },
  donationCta: { label: "Donation CTA", icon: "💚" },
  donationReceipt: { label: "Donation Receipt", icon: "🧾" },
  givingSummary: { label: "Giving Summary", icon: "📋" },
  monthlyDonorInvitation: { label: "Monthly Donor Invite", icon: "🔄" },
  donorThankYou: { label: "Thank You", icon: "🙏" },
  lapsedDonorReengagement: { label: "Lapsed Donor", icon: "💫" },
  firstTimeDonorWelcome: { label: "Welcome", icon: "👋" },
  staffSignature: { label: "Staff Signature", icon: "✍️" },
  footerCompliance: { label: "Footer", icon: "📄" },
  customHtml: { label: "Custom HTML", icon: "🔧" },
  columns: { label: "Columns", icon: "⬜" },
  timeline: { label: "Timeline", icon: "📅" },
  featureList: { label: "Feature List", icon: "✅" },
};

/** Renders editable fields for a single email block. */
function BlockEditCard({
  block,
  index,
  onChange,
}: {
  block: EmailBlock;
  index: number;
  onChange: (updated: EmailBlock) => void;
}) {
  const meta = BLOCK_META[block.type] ?? { label: block.type, icon: "📦" };
  const inputCls = "w-full rounded border border-gray-200 bg-white px-2 py-1 text-xs focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-100";
  const labelCls = "block text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-0.5";

  function field(label: string, value: string, onFieldChange: (v: string) => void, multiline = false) {
    return (
      <div key={label}>
        <label className={labelCls}>{label}</label>
        {multiline ? (
          <textarea
            value={value}
            onChange={(e) => onFieldChange(e.target.value)}
            className={`${inputCls} min-h-[56px] resize-y font-mono text-[11px] leading-relaxed`}
            spellCheck={false}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onFieldChange(e.target.value)}
            className={inputCls}
          />
        )}
      </div>
    );
  }

  let editableFields: React.ReactNode = null;

  if (block.type === "heading") {
    editableFields = (
      <div className="space-y-1.5">
        {field("Title", block.title, (v) => onChange({ ...block, title: v }))}
        {block.subtitle !== undefined && field("Subtitle", block.subtitle, (v) => onChange({ ...block, subtitle: v }))}
        {block.eyebrow !== undefined && field("Eyebrow", block.eyebrow, (v) => onChange({ ...block, eyebrow: v }))}
      </div>
    );
  } else if (block.type === "text" || block.type === "aiText") {
    editableFields = (
      <div className="space-y-1.5">
        {field("Content (HTML)", block.content, (v) => onChange({ ...block, content: v }), true)}
      </div>
    );
  } else if (block.type === "quote") {
    editableFields = (
      <div className="space-y-1.5">
        {field("Quote", block.quote, (v) => onChange({ ...block, quote: v }), true)}
        {field("Attribution", block.attribution, (v) => onChange({ ...block, attribution: v }))}
      </div>
    );
  } else if (block.type === "button" || block.type === "aiButton") {
    editableFields = (
      <div className="space-y-1.5">
        {field("Label", block.label, (v) => onChange({ ...block, label: v }))}
        {field("URL", block.href, (v) => onChange({ ...block, href: v }))}
      </div>
    );
  } else if (block.type === "callout") {
    editableFields = (
      <div className="space-y-1.5">
        {field("Title", block.title, (v) => onChange({ ...block, title: v }))}
        {field("Body", block.body, (v) => onChange({ ...block, body: v }), true)}
      </div>
    );
  } else if (block.type === "impactStat") {
    editableFields = (
      <div className="space-y-1.5">
        {field("Value", block.value, (v) => onChange({ ...block, value: v }))}
        {field("Label", block.label, (v) => onChange({ ...block, label: v }))}
      </div>
    );
  } else if (block.type === "donorThankYou") {
    editableFields = (
      <div className="space-y-1.5">
        {field("Headline", block.headline, (v) => onChange({ ...block, headline: v }))}
        {field("Thank You Message", block.thankYouMessage, (v) => onChange({ ...block, thankYouMessage: v }), true)}
      </div>
    );
  } else if (block.type === "donationCta") {
    editableFields = (
      <div className="space-y-1.5">
        {field("Headline", block.headline, (v) => onChange({ ...block, headline: v }))}
        {field("Appeal Text", block.appealText, (v) => onChange({ ...block, appealText: v }), true)}
        {field("Button Label", block.buttonLabel, (v) => onChange({ ...block, buttonLabel: v }))}
        {field("Button URL", block.buttonUrl, (v) => onChange({ ...block, buttonUrl: v }))}
      </div>
    );
  } else if (block.type === "customHtml") {
    editableFields = (
      <div className="space-y-1.5">
        {field("HTML", block.html, (v) => onChange({ ...block, html: v }), true)}
      </div>
    );
  } else if (block.type === "impactStory") {
    editableFields = (
      <div className="space-y-1.5">
        {field("Headline", block.headline, (v) => onChange({ ...block, headline: v }))}
        {field("Story", block.story, (v) => onChange({ ...block, story: v }), true)}
      </div>
    );
  }

  const hasEditableFields = editableFields !== null;

  return (
    <div className={`border-b border-gray-100 px-3 py-2.5 last:border-b-0 ${hasEditableFields ? "" : "opacity-60"}`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="text-base leading-none">{meta.icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{index + 1}. {meta.label}</span>
        {!hasEditableFields && (
          <span className="ml-auto text-[9px] text-gray-400 italic">visual block</span>
        )}
      </div>
      {editableFields}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EmailFromTemplateModal
// ---------------------------------------------------------------------------

export default function EmailFromTemplateModal({ donation, onClose }: Props) {
  // Step 1: library — Step 2: compose (split-panel block editor + live preview)
  const [step, setStep] = useState<"library" | "compose">("library");

  // Template list
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(true);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [templateSearch, setTemplateSearch] = useState("");

  // Compose state
  const [preview, setPreview] = useState<PreviewPayload | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [bodyHtml, setBodyHtml] = useState(""); // fallback when no templateJson
  const [emailTemplate, setEmailTemplate] = useState<EmailBuilderTemplate | null>(null);

  // Send state
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [sentCampaignId, setSentCampaignId] = useState<string | null>(null);
  const [sendSummaryText, setSendSummaryText] = useState<string>("");

  // Fallback WYSIWYG editor state (used when templateJson is unavailable)
  const [showSlashMenu, setShowSlashMenu] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");

  const richEditorRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Focus trap on mount
  const containerRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.focus();
  }, []);

  // Load templates on open
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setTemplatesLoading(true);
      setTemplatesError(null);
      try {
        const data = await apiFetch<{ templates: EmailTemplate[] }>(
          `/api/donations/${donation.donationId}/email-templates`,
        );
        if (!cancelled) setTemplates(data.templates ?? []);
      } catch (err) {
        if (!cancelled) setTemplatesError(err instanceof Error ? err.message : "Failed to load templates.");
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [donation.donationId]);

  // Keep WYSIWYG editor in sync when fallback HTML loads or changes externally.
  useEffect(() => {
    if (emailTemplate) return;
    const editor = richEditorRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;
    if (editor.innerHTML !== bodyHtml) {
      editor.innerHTML = bodyHtml;
    }
  }, [bodyHtml, emailTemplate]);

  // Write live preview to iframe whenever emailTemplate changes
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe || !emailTemplate) return;
    const html = generateEmailHtml(emailTemplate);
    const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
    if (!doc) return;
    doc.open();
    doc.write(html);
    doc.close();
  }, [emailTemplate]);

  const filteredTemplates = templates.filter(
    (t) =>
      t.name.toLowerCase().includes(templateSearch.toLowerCase()) ||
      t.subject.toLowerCase().includes(templateSearch.toLowerCase()),
  );

  async function handleSelectTemplate(templateId: string) {
    setPreviewLoading(true);
    setSendError(null);
    try {
      const data = await apiFetch<PreviewPayload>(
        `/api/donations/${donation.donationId}/email-template-preview`,
        { method: "POST", body: JSON.stringify({ templateId }) },
      );
      setPreview(data);
      setSubject(data.subject);
      setBodyHtml(data.bodyHtml);
      // Parse block structure for the visual editor
      if (data.resolvedTemplateJson) {
        try {
          setEmailTemplate(JSON.parse(data.resolvedTemplateJson) as EmailBuilderTemplate);
        } catch {
          setEmailTemplate(null);
        }
      } else {
        setEmailTemplate(null);
      }
      setStep("compose");
    } catch (err) {
      setTemplatesError(err instanceof Error ? err.message : "Failed to load template preview.");
    } finally {
      setPreviewLoading(false);
    }
  }

  /** Update a single block in the email template (triggers live preview re-render). */
  function updateBlock(blockId: string, updated: EmailBlock) {
    setEmailTemplate((prev) => {
      if (!prev) return prev;
      return { ...prev, blocks: prev.blocks.map((b) => (b.id === blockId ? updated : b)) };
    });
  }

  function applyInlineFormat(command: string) {
    if (!richEditorRef.current) return;
    richEditorRef.current.focus();
    document.execCommand(command, false);
    setBodyHtml(richEditorRef.current.innerHTML);
  }

  function applyLink() {
    if (!richEditorRef.current) return;
    const href = window.prompt("Enter link URL", "https://");
    if (!href) return;
    richEditorRef.current.focus();
    document.execCommand("createLink", false, href);
    setBodyHtml(richEditorRef.current.innerHTML);
  }

  function insertHtmlSnippet(html: string) {
    if (!richEditorRef.current) return;
    richEditorRef.current.focus();
    document.execCommand("insertHTML", false, html);
    setBodyHtml(richEditorRef.current.innerHTML);
    setShowSlashMenu(false);
    setSlashQuery("");
  }

  function insertImageByPrompt(isLogo = false) {
    const url = window.prompt(isLogo ? "Paste logo URL" : "Paste image URL", "https://");
    if (!url) return;
    const maxW = isLogo ? "220px" : "100%";
    const alt = isLogo ? "Organization logo" : "Email image";
    insertHtmlSnippet(`<p style="margin:12px 0;"><img src="${url}" alt="${alt}" style="display:block;max-width:${maxW};height:auto;border-radius:8px;" /></p>`);
  }

  function filteredSlashBlocks() {
    const q = slashQuery.trim().toLowerCase();
    if (!q) return FALLBACK_BLOCK_OPTIONS;
    return FALLBACK_BLOCK_OPTIONS.filter((item) => item.label.toLowerCase().includes(q));
  }

  async function handleSend() {
    if (!preview) return;
    setSending(true);
    setSendError(null);
    // Use block-generated HTML when available, fall back to server-rendered bodyHtml
    const finalHtml = emailTemplate ? generateEmailHtml(emailTemplate) : bodyHtml;
    try {
      const payload = await apiFetch<SendFromTemplateResponse>(`/api/donations/${donation.donationId}/send-from-template`, {
        method: "POST",
        body: JSON.stringify({ templateId: preview.templateId, subject, bodyHtml: finalHtml }),
      });
      setSentCampaignId(payload.campaignId ?? null);
      const queuedCount = Number(payload.sendSummary?.totalRecipients ?? 0);
      const deliveredCount = Number(payload.sendSummary?.delivered ?? 0);
      if (queuedCount > 0 || deliveredCount > 0) {
        setSendSummaryText(`Queue logged for ${queuedCount || deliveredCount} recipient${(queuedCount || deliveredCount) === 1 ? "" : "s"}; delivered ${deliveredCount}.`);
      } else {
        setSendSummaryText("Send completed and activity was logged.");
      }
      setSent(true);
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Failed to send email.");
    } finally {
      setSending(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-12 overflow-y-auto">
      <div
        ref={containerRef}
        tabIndex={-1}
        className={`relative w-full ${step === "compose" ? "max-w-6xl" : "max-w-3xl"} rounded-xl bg-white shadow-2xl ring-1 ring-gray-200 outline-none`}
        onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
      >
        {/* ── Header ─────────────────────────────────────────────────── */}
        <div className="flex items-start justify-between gap-3 rounded-t-xl bg-gradient-to-r from-blue-700 to-blue-500 px-6 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-blue-100">
              {step === "library" ? "Step 1 of 2" : "Step 2 of 2"}
            </p>
            <h2 className="mt-0.5 text-lg font-bold text-white truncate">
              {step === "library" ? "Email From Template" : "Edit & Preview"}
            </h2>
            <p className="mt-0.5 text-sm text-blue-100 truncate">
              {step === "library"
                ? `Sending to ${donation.donorName}${donation.donorEmail ? ` · ${donation.donorEmail}` : ""}`
                : `To: ${preview?.toName} · ${preview?.toEmail}`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-1.5 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── Donation context strip ──────────────────────────────────── */}
        <div className="flex items-center gap-4 bg-blue-50 border-b border-blue-100 px-6 py-2 text-xs text-blue-800">
          <span>
            <span className="font-semibold">Gift:</span> {formatCurrency(donation.amount)}
          </span>
          <span className="text-blue-300">·</span>
          <span>
            <span className="font-semibold">Date:</span>{" "}
            {new Date(donation.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
          </span>
          <span className="text-blue-300">·</span>
          <span>
            <span className="font-semibold">Donor:</span> {donation.donorName}
          </span>
        </div>

        {/* ── Body ───────────────────────────────────────────────────── */}
        <div className="p-6">

          {/* ── Step 1: Template Library ──────────────────────────────── */}
          {step === "library" && (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <svg className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Search templates…"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-gray-50 pl-9 pr-4 py-2 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />
              </div>

              {/* Error */}
              {templatesError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {templatesError}
                </div>
              )}

              {/* Loading */}
              {templatesLoading && (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
                  ))}
                </div>
              )}

              {/* Template list */}
              {!templatesLoading && !templatesError && (
                <>
                  {filteredTemplates.length === 0 ? (
                    <div className="rounded-lg bg-gray-50 border border-dashed border-gray-300 py-10 text-center text-sm text-gray-500">
                      {templateSearch
                        ? "No templates match your search."
                        : "No DRAFT email templates found. Create one in Communications first."}
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {filteredTemplates.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => void handleSelectTemplate(t.id)}
                          disabled={previewLoading}
                          className="w-full text-left rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-blue-400 hover:bg-blue-50 transition-colors disabled:opacity-60 group"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-gray-900 truncate group-hover:text-blue-700">
                                {t.name}
                              </p>
                              <p className="mt-0.5 text-xs text-gray-500 truncate">{t.subject}</p>
                            </div>
                            <div className="shrink-0 flex items-center gap-2">
                              <PurposeBadge purpose={t.purpose} />
                              <svg className="h-4 w-4 text-gray-400 group-hover:text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  <p className="text-right text-xs text-gray-400">
                    {filteredTemplates.length} template{filteredTemplates.length !== 1 ? "s" : ""} available
                  </p>
                </>
              )}

              {previewLoading && (
                <div className="text-center py-4 text-sm text-blue-600">Loading template…</div>
              )}
            </div>
          )}

          {/* ── Step 2: Block Editor + Live Preview (split panel) ──────── */}
          {step === "compose" && preview && (
            <div className="space-y-3">
              {/* Top meta row */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-gray-500">
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Template: <span className="font-medium text-gray-700">{preview.templateName}</span>
                </div>
                <span className="text-gray-300">·</span>
                <div className="text-xs text-gray-500">
                  To: <span className="font-medium text-gray-700">{preview.toName}</span>
                  {preview.toEmail && <span className="text-gray-400"> &lt;{preview.toEmail}&gt;</span>}
                </div>
              </div>

              {/* Subject */}
              <div className="flex items-center gap-2">
                <label className="shrink-0 text-xs font-semibold text-gray-500 uppercase tracking-wide w-14">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="Email subject…"
                />
              </div>

              {/* Split panel */}
              <div className="flex flex-col gap-3 h-auto lg:flex-row lg:h-[520px]">

                {/* ── Left: Block editor ─────────────────────────────── */}
                <div className="w-full min-w-0 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden lg:w-[42%] lg:min-h-0 lg:h-full">
                  <div className="bg-gray-50 border-b border-gray-200 px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      ✏️ Content Blocks
                    </span>
                    {emailTemplate && (
                      <span className="text-[10px] text-gray-400">
                        {emailTemplate.blocks.length} block{emailTemplate.blocks.length !== 1 ? "s" : ""}
                      </span>
                    )}
                  </div>

                  {emailTemplate ? (
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
                      {emailTemplate.blocks.map((block, i) => (
                        <BlockEditCard
                          key={block.id}
                          block={block}
                          index={i}
                          onChange={(updated) => updateBlock(block.id, updated)}
                        />
                      ))}
                    </div>
                  ) : (
                    /* Fallback: mini visual editor when no templateJson */
                    <div className="relative flex-1 flex flex-col p-2 gap-2 min-h-[320px] lg:min-h-0">
                      <p className="px-1 text-[11px] text-gray-500">
                        Type <span className="font-semibold">/</span> to add blocks. Toolbar formatting is available, no raw HTML needed.
                      </p>

                      <div className="flex flex-wrap items-center gap-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-1">
                        <button type="button" onClick={() => applyInlineFormat("bold")} className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-100">B</button>
                        <button type="button" onClick={() => applyInlineFormat("italic")} className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] italic text-gray-700 hover:bg-gray-100">I</button>
                        <button type="button" onClick={() => applyInlineFormat("underline")} className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] underline text-gray-700 hover:bg-gray-100">U</button>
                        <button type="button" onClick={() => applyInlineFormat("insertUnorderedList")} className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100">List</button>
                        <button type="button" onClick={applyLink} className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100">Link</button>
                        <button type="button" onClick={() => insertImageByPrompt(false)} className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100">Image</button>
                        <button type="button" onClick={() => insertImageByPrompt(true)} className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100">Logo</button>
                        <button type="button" onClick={() => insertHtmlSnippet(FALLBACK_BLOCK_OPTIONS.find((b) => b.key === "header")?.html ?? "")} className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100">Header</button>
                        <button type="button" onClick={() => insertHtmlSnippet(FALLBACK_BLOCK_OPTIONS.find((b) => b.key === "footer")?.html ?? "")} className="rounded border border-gray-200 bg-white px-2 py-1 text-[11px] text-gray-700 hover:bg-gray-100">Footer</button>
                      </div>

                      <div
                        ref={richEditorRef}
                        contentEditable
                        suppressContentEditableWarning
                        onInput={(e) => setBodyHtml((e.target as HTMLDivElement).innerHTML)}
                        onKeyDown={(e) => {
                          if (e.key === "/") {
                            e.preventDefault();
                            setShowSlashMenu(true);
                            setSlashQuery("");
                            return;
                          }
                          if (showSlashMenu && e.key === "Escape") {
                            setShowSlashMenu(false);
                            setSlashQuery("");
                          }
                        }}
                        className="flex-1 overflow-y-auto rounded border border-gray-200 bg-white px-3 py-2 text-sm leading-relaxed text-gray-800 focus:border-blue-400 focus:outline-none"
                        style={{ minHeight: "220px" }}
                      />

                      {showSlashMenu && (
                        <div className="absolute left-3 right-3 top-20 z-20 rounded-lg border border-gray-200 bg-white shadow-xl">
                          <div className="border-b border-gray-100 px-3 py-2">
                            <input
                              type="text"
                              value={slashQuery}
                              onChange={(e) => setSlashQuery(e.target.value)}
                              placeholder="Search blocks (heading, image, footer...)"
                              className="w-full rounded border border-gray-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
                            />
                          </div>
                          <div className="max-h-44 overflow-y-auto p-1">
                            {filteredSlashBlocks().map((item) => (
                              <button
                                key={item.key}
                                type="button"
                                onClick={() => insertHtmlSnippet(item.html)}
                                className="flex w-full items-center justify-between rounded px-2.5 py-1.5 text-left text-xs text-gray-700 hover:bg-blue-50"
                              >
                                <span>{item.label}</span>
                                <span className="text-[10px] text-gray-400">Insert</span>
                              </button>
                            ))}
                            {filteredSlashBlocks().length === 0 && (
                              <p className="px-2 py-2 text-xs text-gray-400">No matching blocks.</p>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* ── Right: Live preview ────────────────────────────── */}
                <div className="flex-1 min-w-0 flex flex-col rounded-lg border border-gray-200 bg-white overflow-hidden min-h-[320px] lg:min-h-0 lg:h-full">
                  <div className="bg-gray-50 border-b border-gray-200 px-3 py-1.5 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      👁 Live Preview
                    </span>
                    <span className="text-[10px] text-gray-400 italic">updates as you edit</span>
                  </div>

                  {emailTemplate ? (
                    <iframe
                      ref={iframeRef}
                      title="Email preview"
                      className="flex-1 w-full border-0"
                      sandbox="allow-same-origin"
                    />
                  ) : (
                    /* Fallback preview for raw-HTML templates */
                    <div
                      className="flex-1 overflow-y-auto p-5 prose prose-sm max-w-none text-gray-800 text-[13px]"
                      // eslint-disable-next-line react/no-danger
                      dangerouslySetInnerHTML={{ __html: bodyHtml }}
                    />
                  )}
                </div>
              </div>

              {/* Send error */}
              {sendError && (
                <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  {sendError}
                </div>
              )}
            </div>
          )}

          {/* ── Sent success ─────────────────────────────────────────── */}
          {sent && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-gray-900">Email Sent And Logged</p>
                <p className="text-sm text-gray-500 mt-0.5">
                  Delivered to {preview?.toEmail}
                </p>
                {sendSummaryText ? (
                  <p className="text-xs text-gray-500 mt-1">{sendSummaryText}</p>
                ) : null}
                {sentCampaignId ? (
                  <a
                    href={`/communications/${sentCampaignId}?mode=activity`}
                    className="mt-2 inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                  >
                    Open Send Activity Log
                  </a>
                ) : null}
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ─────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4 rounded-b-xl">
          <div className="flex items-center gap-2">
            {step === "compose" && !sent && (
              <button
                onClick={() => { setStep("library"); setSendError(null); }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              {sent ? "Close" : "Cancel"}
            </button>
            {step === "compose" && !sent && (
              <button
                onClick={() => void handleSend()}
                disabled={sending || !subject.trim() || (!emailTemplate && !bodyHtml.trim())}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
              >
                {sending ? (
                  <>
                    <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Sending…
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                    Send + Log Email
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
