/** OyamaEmail Builder — polished mockup-matched UI with ribbon tabs, preview modal, icon block library. */
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Color from "@tiptap/extension-color";
import TiptapLink from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Underline from "@tiptap/extension-underline";
import StarterKit from "@tiptap/starter-kit";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { apiFetch, apiFetchResponse } from "@/app/lib/auth-client";
import { DEFAULT_BRANDING_SETTINGS, fetchBrandingSettings, formatBrandingAddress, type BrandingSettings } from "@/app/lib/branding-settings";
import { InfoTooltip, WorkspaceHint } from "@/app/components/workspace/WorkspaceHelp";

// ─── Types ────────────────────────────────────────────────────────────────────

type BuilderBlockType =
  | "header"
  | "text"
  | "image"
  | "button"
  | "divider"
  | "spacer"
  | "columns"
  | "social"
  | "video"
  | "fileLink"
  | "donationButton"
  | "eventButton"
  | "aiSmart"
  | "html";

interface BuilderBlock {
  id: string;
  type: BuilderBlockType;
  headerTitle?: string;
  headerSubtitle?: string;
  headerBackgroundColor?: string;
  logoUrl?: string;
  logoWidth?: number;
  align?: "left" | "center" | "right";
  paddingY?: number;
  content?: string;
  src?: string;
  alt?: string;
  imageWidthPercent?: number;
  imageLinkUrl?: string;
  label?: string;
  href?: string;
  color?: string;
  textColor?: string;
  thickness?: number;
  height?: number;
  leftHtml?: string;
  rightHtml?: string;
  links?: Array<{ label: string; url: string }>;
  socialMode?: "follow" | "share";
  socialLayout?: "row" | "column";
  socialIconStyle?: "pill" | "outline" | "plain";
  socialTrackingLabel?: string;
  socialShowLabels?: boolean;
  thumbnailUrl?: string;
  videoUrl?: string;
  videoTitle?: string;
  videoCtaLabel?: string;
  videoAlt?: string;
  videoFallbackText?: string;
  videoTrackingLabel?: string;
  caption?: string;
  fileLabel?: string;
  fileUrl?: string;
  fileDescription?: string;
  fileTrackingLabel?: string;
  html?: string;
  aiSmart?: boolean;
  aiSmartPrompt?: string;
  aiSmartTone?: "warm" | "urgent" | "celebratory" | "informative";
  aiSmartObjective?: AiSmartObjective;
}

interface BuilderTemplateDocument {
  version: number;
  contentWidth: number;
  backgroundColor: string;
  fontFamily: string;
  baseFontSize: number;
  lineHeight: number;
  textColor: string;
  linkColor: string;
  blocks: BuilderBlock[];
}

interface BuilderTemplateSettings {
  includeUnsubscribeLink: boolean;
  includePhysicalAddress: boolean;
  enablePlainTextVersion: boolean;
  physicalAddress: string;
  footerBrandingText: string;
  plainTextOverride?: string;
}

interface BuilderTemplateResponse {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  purpose: string;
  preferenceCategory: string;
  template: BuilderTemplateDocument;
  settings: BuilderTemplateSettings;
  renderedHtml: string;
  renderedText: string;
  mergeFieldsUsed: string[];
}

interface SaveConflictPayload {
  error?: {
    code?: string;
    message?: string;
  };
  conflict?: {
    id?: string;
    name?: string;
    updatedAt?: string;
  };
}

interface SaveConflictState {
  code: "TEMPLATE_STALE_VERSION" | "TEMPLATE_NAME_CONFLICT";
  message: string;
  templateId: string;
  templateName: string;
  updatedAt: string | null;
}

interface SaveTemplateOptions {
  forceOverwrite?: boolean;
  confirmOverwrite?: boolean;
  overwriteTemplateId?: string;
}

interface MergeFieldGroup {
  key: string;
  label: string;
  available: boolean;
  fields: Array<{ token: string; description: string }>;
}

interface MergeFieldResponse {
  groups: MergeFieldGroup[];
}

interface PreviewResponse {
  id: string;
  subject: string;
  previewText: string;
  html: string;
  text: string;
  mergeFieldsUsed: string[];
  warnings?: string[];
  recipient: {
    id?: string;
    email: string;
    firstName: string;
    lastName: string;
    fullName: string;
  } | null;
}

interface SendTestResponse {
  success: boolean;
  toEmail: string;
  warnings?: string[];
  unsupportedMergeTokens?: string[];
}

interface PreviewRecipientOption {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  displayName?: string | null;
  organizationName?: string | null;
  email?: string | null;
}

interface MergeLinePreviewItem {
  constituentId: string;
  recipientName: string;
  renderedLine: string;
  warnings?: string[];
}

interface MergeLinePreviewResponse {
  items: MergeLinePreviewItem[];
}

interface AuthMeResponse {
  data?: {
    firstName?: string;
    lastName?: string;
    email?: string;
  };
}

interface GlobalSettingsResponse {
  smtpFromName?: string;
  smtpFromEmail?: string;
}

type WritingTarget = "subject" | "previewText" | "selectedBlock" | "newBlock";
type WritingTone = "warm" | "urgent" | "celebratory" | "informative";
type PreviewPanelMode = "visual" | "split" | "text";
type PreviewViewport = "desktop" | "tablet" | "mobile";
type AiSmartObjective = "fundraising" | "update" | "event" | "volunteer";

type ActiveTab = "edit" | "mobilePreview";

type InsertTarget =
  | { scope: "template"; field: "subject" | "previewText" | "fromName" | "physicalAddress" | "footerBrandingText" }
  | { scope: "block"; blockId: string; field: string }
  | null;

interface BuilderDraft {
  name: string;
  subject: string;
  previewText: string;
  fromName: string;
  fromEmail: string;
  replyToEmail: string;
  purpose: string;
  preferenceCategory: string;
  template: BuilderTemplateDocument;
  settings: BuilderTemplateSettings;
  aiSmartObjective?: AiSmartObjective;
}

const DEFAULT_TEMPLATE: BuilderTemplateDocument = {
  version: 1,
  contentWidth: 600,
  backgroundColor: "#f3f7f5",
  fontFamily: "Arial, Helvetica, sans-serif",
  baseFontSize: 16,
  lineHeight: 1.6,
  textColor: "#1f2937",
  linkColor: "#0f5c3c",
  blocks: [
    {
      id: "block_1",
      type: "text",
      content: "",
    },
  ],
};

const DEFAULT_SETTINGS: BuilderTemplateSettings = {
  includeUnsubscribeLink: true,
  includePhysicalAddress: true,
  enablePlainTextVersion: true,
  physicalAddress: "",
  footerBrandingText: "",
  plainTextOverride: "",
};

const DEFAULT_DRAFT: BuilderDraft = {
  name: "Untitled Email Template",
  subject: "",
  previewText: "",
  fromName: "Oyama Ministries",
  fromEmail: "",
  replyToEmail: "",
  purpose: "MARKETING",
  preferenceCategory: "GENERAL_UPDATES",
  template: DEFAULT_TEMPLATE,
  settings: DEFAULT_SETTINGS,
};

function draftFromBranding(branding?: BrandingSettings): BuilderDraft {
  const source = branding || DEFAULT_BRANDING_SETTINGS;
  const address = formatBrandingAddress(source);
  const orgName = source.organizationDisplayName || source.legalOrganizationName || DEFAULT_DRAFT.fromName;
  return {
    ...DEFAULT_DRAFT,
    fromName: orgName,
    fromEmail: source.contactEmail || DEFAULT_DRAFT.fromEmail,
    replyToEmail: source.contactEmail || DEFAULT_DRAFT.replyToEmail,
    template: {
      ...DEFAULT_TEMPLATE,
      backgroundColor: source.emailBackgroundColor || DEFAULT_TEMPLATE.backgroundColor,
      fontFamily: source.emailFontFamily || DEFAULT_TEMPLATE.fontFamily,
      contentWidth: source.emailContentWidth || DEFAULT_TEMPLATE.contentWidth,
    },
    settings: {
      ...DEFAULT_SETTINGS,
      physicalAddress: address,
      footerBrandingText: source.footerLegalText || source.organizationDisplayName || source.legalOrganizationName || "",
    },
  };
}

function composeFromName(userDisplayName: string, orgName: string): string {
  const trimmedUser = userDisplayName.trim();
  const trimmedOrg = orgName.trim();
  if (trimmedUser && trimmedOrg) return `${trimmedUser} - ${trimmedOrg}`;
  return trimmedOrg || trimmedUser || "Oyama Ministries";
}

const BLOCK_CHOICES: Array<{ type: BuilderBlockType; label: string }> = [
  { type: "header", label: "Header" },
  { type: "text", label: "Text" },
  { type: "image", label: "Image" },
  { type: "button", label: "Button" },
  { type: "divider", label: "Divider" },
  { type: "spacer", label: "Spacer" },
  { type: "columns", label: "Columns" },
  { type: "social", label: "Social Links" },
  { type: "video", label: "Video Thumbnail" },
  { type: "fileLink", label: "File Link" },
  { type: "donationButton", label: "Donation Button" },
  { type: "eventButton", label: "Event Button" },
  { type: "aiSmart", label: "AI Smart Block" },
  { type: "html", label: "HTML Block" },
];

const PURPOSE_OPTIONS = [
  { value: "MARKETING", label: "Marketing" },
  { value: "TRANSACTIONAL", label: "Transactional" },
  { value: "STEWARDSHIP", label: "Stewardship" },
  { value: "EVENT_PROMOTION", label: "Event" },
  { value: "RECEIPT", label: "Receipt" },
];

const PREFERENCE_OPTIONS = [
  { value: "GENERAL_UPDATES", label: "General Updates" },
  { value: "FUNDRAISING", label: "Fundraising" },
  { value: "EVENTS", label: "Events" },
  { value: "RECEIPTS", label: "Receipts" },
  { value: "STEWARDSHIP", label: "Stewardship" },
];

const FONT_FAMILY_OPTIONS = [
  { value: "Arial, Helvetica, sans-serif", label: "Arial" },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: "Helvetica Neue" },
  { value: "Georgia, 'Times New Roman', serif", label: "Georgia" },
  { value: "Tahoma, Geneva, sans-serif", label: "Tahoma" },
  { value: "Verdana, Geneva, sans-serif", label: "Verdana" },
  { value: "'Trebuchet MS', Helvetica, sans-serif", label: "Trebuchet" },
];

const PREMADE_SECTION_CHOICES = [
  {
    id: "brandHeader",
    label: "Branded Header",
    description: "Logo + organization identity",
  },
  {
    id: "heroCta",
    label: "Hero + CTA",
    description: "Headline, copy, and button",
  },
  {
    id: "storyTwoCol",
    label: "Two-Column Story",
    description: "Impact narrative layout",
  },
  {
    id: "impactStory",
    label: "Donor Impact Story",
    description: "Photo-ready narrative section",
  },
  {
    id: "givingCallout",
    label: "Giving Callout",
    description: "Giving ask with urgency",
  },
  {
    id: "eventRegistration",
    label: "Event Registration",
    description: "Event details and sign-up button",
  },
  {
    id: "countdownCallout",
    label: "Countdown / Date",
    description: "Date highlight card",
  },
  {
    id: "quoteTestimonial",
    label: "Quote / Testimonial",
    description: "Supporter quote block",
  },
  {
    id: "staffSignature",
    label: "Staff Signature",
    description: "Personal close with signature",
  },
  {
    id: "contactCard",
    label: "Contact Card",
    description: "Email and phone section",
  },
  {
    id: "locationAddress",
    label: "Location / Address",
    description: "Address + map link",
  },
  {
    id: "receiptSummary",
    label: "Receipt Summary",
    description: "Donation receipt facts",
  },
  {
    id: "donationSummary",
    label: "Donation Summary",
    description: "Last gift + YTD recap",
  },
  {
    id: "recentGiftAck",
    label: "Recent Gift Acknowledgment",
    description: "Thank-you for latest gift",
  },
  {
    id: "ministryUpdate",
    label: "Ministry Update",
    description: "Program progress section",
  },
  {
    id: "prayerRequest",
    label: "Prayer Request",
    description: "Prayer update and response",
  },
  {
    id: "sponsorHighlight",
    label: "Sponsor Highlight",
    description: "Feature sponsor impact",
  },
  {
    id: "legalFooter",
    label: "Footer / Compliance",
    description: "Legal and preference links",
  },
  {
    id: "unsubscribePrefs",
    label: "Unsubscribe / Preferences",
    description: "Preference actions section",
  },
  {
    id: "socialShare",
    label: "Social Share",
    description: "Share campaign links",
  },
  {
    id: "fileDownload",
    label: "File Download",
    description: "PDF or OneDrive download CTA",
  },
  {
    id: "socialFooter",
    label: "Social Footer",
    description: "Follow links + spacing",
  },
] as const;

type PremadeSectionId = typeof PREMADE_SECTION_CHOICES[number]["id"];

function createId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `block_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function escapeInlineHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeWriterOutputHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return trimmed
    .split(/\n{2,}/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => `<p>${part.replace(/\n/g, "<br/>")}</p>`)
    .join("");
}

function normalizeSmartHref(raw: string): string {
  let value = raw.trim();
  if (!value) return "#";
  try {
    value = decodeURIComponent(value);
  } catch {
    // keep original when URI decoding fails
  }

  const mergeToken = value.match(/\{\{\s*[a-zA-Z0-9_.]+\s*\}\}/)?.[0];
  if (mergeToken) {
    return mergeToken.replace(/\s+/g, "");
  }

  if (/^(https?:\/\/|mailto:|tel:|#|\/)/i.test(value)) {
    return value;
  }

  return "#";
}

function markdownInlineToHtml(raw: string): string {
  let value = escapeInlineHtml(raw);
  value = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label: string, href: string) => {
    const safeHref = normalizeSmartHref(href);
    return `<a href="${escapeInlineHtml(safeHref)}">${label}</a>`;
  });
  value = value.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  value = value.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return value;
}

function normalizeAiSmartOutputHtml(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "<p></p>";
  const withoutFence = trimmed
    .replace(/^```[a-zA-Z]*\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  if (/<[a-z][\s\S]*>/i.test(withoutFence)) {
    return withoutFence;
  }

  const lines = withoutFence.replace(/\r\n/g, "\n").split("\n");
  const htmlParts: string[] = [];
  const listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    htmlParts.push(`<ul>${listItems.map((item) => `<li>${item}</li>`).join("")}</ul>`);
    listItems.length = 0;
  };

  lines.forEach((line) => {
    const text = line.trim();
    if (!text) {
      flushList();
      return;
    }

    const bullet = text.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      listItems.push(markdownInlineToHtml(bullet[1]));
      return;
    }

    flushList();
    const heading = text.match(/^\*\*([^*]+)\*\*$/);
    if (heading) {
      htmlParts.push(`<h3>${markdownInlineToHtml(heading[1])}</h3>`);
      return;
    }

    htmlParts.push(`<p>${markdownInlineToHtml(text)}</p>`);
  });

  flushList();
  return htmlParts.join("") || "<p></p>";
}

function normalizeEditableSmartHtml(value: string): string {
  const cleaned = value
    .replace(/\u00a0/g, " ")
    .replace(/<div><br\s*\/?><\/div>/gi, "<p></p>")
    .replace(/<div>/gi, "<p>")
    .replace(/<\/div>/gi, "</p>")
    .trim();
  return cleaned || "<p></p>";
}

function summarizePreviewDelta(previousText: string, nextText: string): string | null {
  const prev = previousText.trim();
  const next = nextText.trim();
  if (!prev && !next) return null;
  if (!prev && next) return "Preview created from latest template changes.";
  if (prev && !next) return "Preview cleared.";
  if (prev === next) return "No visible content changes since last refresh.";

  const prevWords = prev.split(/\s+/).filter(Boolean).length;
  const nextWords = next.split(/\s+/).filter(Boolean).length;
  const deltaWords = nextWords - prevWords;
  const prevLines = prev.split(/\n+/).filter(Boolean).length;
  const nextLines = next.split(/\n+/).filter(Boolean).length;
  const deltaLines = nextLines - prevLines;

  const wordPart = deltaWords === 0
    ? "word count unchanged"
    : `${deltaWords > 0 ? "+" : ""}${deltaWords} words`;
  const linePart = deltaLines === 0
    ? "line count unchanged"
    : `${deltaLines > 0 ? "+" : ""}${deltaLines} lines`;
  return `Preview changed (${wordPart}, ${linePart}).`;
}

function createHeaderBlock(branding?: BrandingSettings): BuilderBlock {
  const safeBranding = branding || DEFAULT_BRANDING_SETTINGS;
  return {
    id: createId(),
    type: "header",
    headerTitle: safeBranding.organizationDisplayName || safeBranding.legalOrganizationName || "Your Organization",
    headerSubtitle: safeBranding.tagline || "Serving with compassion",
    headerBackgroundColor: safeBranding.primaryColor || "#0f5c3c",
    logoUrl: safeBranding.logoUrl || safeBranding.logoSquareUrl || "",
    logoWidth: 140,
    align: "center",
    paddingY: 20,
  };
}

function createBlock(type: BuilderBlockType): BuilderBlock {
  if (type === "header") {
    return createHeaderBlock();
  }

  if (type === "text") {
    return {
      id: createId(),
      type,
      content: "",
    };
  }

  if (type === "image") {
    return {
      id: createId(),
      type,
      src: "",
      alt: "",
      imageWidthPercent: 100,
      align: "center",
      caption: "",
      imageLinkUrl: "",
    };
  }

  if (type === "button" || type === "donationButton" || type === "eventButton") {
    return {
      id: createId(),
      type,
      label: type === "donationButton" ? "Donate Now" : type === "eventButton" ? "View Event" : "Learn More",
      href: "https://",
      color: "#0f5c3c",
      textColor: "#ffffff",
    };
  }

  if (type === "divider") {
    return {
      id: createId(),
      type,
      color: "#d7e0dc",
      thickness: 1,
    };
  }

  if (type === "spacer") {
    return {
      id: createId(),
      type,
      height: 24,
    };
  }

  if (type === "columns") {
    return {
      id: createId(),
      type,
      leftHtml: "<p>Left column</p>",
      rightHtml: "<p>Right column</p>",
    };
  }

  if (type === "social") {
    return {
      id: createId(),
      type,
      socialMode: "follow",
      socialLayout: "row",
      socialIconStyle: "pill",
      socialTrackingLabel: "",
      socialShowLabels: true,
      links: [
        { label: "Facebook", url: "https://facebook.com" },
        { label: "Instagram", url: "https://instagram.com" },
      ],
    };
  }

  if (type === "video") {
    return {
      id: createId(),
      type,
      thumbnailUrl: "",
      videoUrl: "",
      videoTitle: "",
      videoCtaLabel: "Watch Video",
      videoAlt: "Video thumbnail",
      videoFallbackText: "If the preview image is blocked, use this link to watch.",
      videoTrackingLabel: "",
      caption: "",
    };
  }

  if (type === "fileLink") {
    return {
      id: createId(),
      type,
      fileLabel: "Download Resource",
      fileUrl: "",
      fileDescription: "",
      fileTrackingLabel: "",
    };
  }

  if (type === "aiSmart") {
    return {
      id: createId(),
      type: "html",
      html: "<p>Describe what you want, then generate optimized HTML with Steward AI.</p>",
      aiSmart: true,
      aiSmartPrompt: "",
      aiSmartTone: "warm",
      aiSmartObjective: "fundraising",
    };
  }

  return {
    id: createId(),
    type: "html",
    html: "<p>Custom HTML block</p>",
  };
}

function blockDisplayLabel(block: BuilderBlock): string {
  if (block.type === "html" && block.aiSmart) return "AI Smart Block";
  return BLOCK_CHOICES.find((choice) => choice.type === block.type)?.label || "Block";
}

function formatLastSaved(value: string | null): string {
  if (!value) return "Not saved yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not saved yet";
  return `Last saved ${date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`;
}

function buildCopyTemplateName(name: string): string {
  const trimmed = name.trim() || "Untitled Email Template";
  if (/\(copy\)$/i.test(trimmed)) {
    return `${trimmed} ${new Date().getHours()}${new Date().getMinutes().toString().padStart(2, "0")}`;
  }
  return `${trimmed} (Copy)`;
}

async function saveTemplateRequest(endpoint: string, method: "POST" | "PUT", payload: Record<string, unknown>): Promise<BuilderTemplateResponse> {
  const response = await apiFetchResponse(endpoint, {
    method,
    body: JSON.stringify(payload),
  });

  const raw = await response.text();
  let parsed: unknown = {};
  if (raw.trim()) {
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      parsed = {};
    }
  }

  if (!response.ok) {
    const body = (parsed && typeof parsed === "object" ? parsed : {}) as SaveConflictPayload;
    const code = String(body.error?.code || "");
    const message = body.error?.message || `API error ${response.status}`;
    if (response.status === 409 && (code === "TEMPLATE_STALE_VERSION" || code === "TEMPLATE_NAME_CONFLICT")) {
      const conflict = body.conflict || {};
      const error = new Error(message) as Error & {
        conflict?: SaveConflictState;
      };
      error.conflict = {
        code,
        message,
        templateId: String(conflict.id || ""),
        templateName: String(conflict.name || ""),
        updatedAt: typeof conflict.updatedAt === "string" ? conflict.updatedAt : null,
      } as SaveConflictState;
      throw error;
    }
    throw new Error(message);
  }

  return parsed as BuilderTemplateResponse;
}

function appendToken(current: string, token: string): string {
  if (!current.trim()) return token;
  const join = /[\s>}]$/.test(current) ? "" : " ";
  return `${current}${join}${token}`;
}

const MERGE_TOKEN_PATTERN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;
const SIMPLE_MERGE_TOKEN_PATTERN = /(^|[^{])\{\s*([a-zA-Z][a-zA-Z0-9_.]*)\s*\}(?!\})/g;
const SLASH_MERGE_TOKEN_PATTERN = /(^|[\s([>])\/\/([a-zA-Z][a-zA-Z0-9_.]*)\b/g;

function extractMergeTokenKeys(value: string): string[] {
  const set = new Set<string>();
  let match: RegExpExecArray | null;

  MERGE_TOKEN_PATTERN.lastIndex = 0;
  while ((match = MERGE_TOKEN_PATTERN.exec(value)) !== null) {
    const token = String(match[1] || "").trim();
    if (token) set.add(token);
  }

  SIMPLE_MERGE_TOKEN_PATTERN.lastIndex = 0;
  while ((match = SIMPLE_MERGE_TOKEN_PATTERN.exec(value)) !== null) {
    const token = String(match[2] || "").trim();
    if (token) set.add(token);
  }

  SLASH_MERGE_TOKEN_PATTERN.lastIndex = 0;
  while ((match = SLASH_MERGE_TOKEN_PATTERN.exec(value)) !== null) {
    const token = String(match[2] || "").trim();
    if (token) set.add(token);
  }

  return Array.from(set);
}

function extractTokensFromDocument(draft: BuilderDraft): string[] {
  return extractMergeTokenKeys([
    draft.subject,
    draft.previewText,
    JSON.stringify(draft.template.blocks),
    draft.settings.footerBrandingText,
    draft.settings.physicalAddress,
  ].join("\n"));
}

function logBuilderPreviewDiagnostics(
  stage: "recipient-preview" | "send-preview-to-self",
  payload: {
    templateId: string;
    draft: BuilderDraft;
    preview: PreviewResponse;
    requestBody: unknown;
    deltaSummary?: string | null;
    toEmail?: string;
  },
) {
  const diagnostics = {
    stage,
    loggedAt: new Date().toISOString(),
    templateId: payload.templateId,
    templateName: payload.draft.name,
    subject: payload.preview.subject || payload.draft.subject,
    previewText: payload.preview.previewText || payload.draft.previewText,
    purpose: payload.draft.purpose,
    preferenceCategory: payload.draft.preferenceCategory,
    fromName: payload.draft.fromName,
    fromEmail: payload.draft.fromEmail,
    replyToEmail: payload.draft.replyToEmail,
    recipient: payload.preview.recipient,
    requestBody: payload.requestBody,
    toEmail: payload.toEmail ?? null,
    warnings: payload.preview.warnings ?? [],
    mergeFieldsUsed: payload.preview.mergeFieldsUsed?.length ? payload.preview.mergeFieldsUsed : extractTokensFromDocument(payload.draft),
    deltaSummary: payload.deltaSummary ?? null,
    blockCount: payload.draft.template.blocks.length,
    renderedHtmlLength: payload.preview.html?.length ?? 0,
    renderedTextLength: payload.preview.text?.length ?? 0,
  };

  console.groupCollapsed(`[OyamaEmail Builder Diagnostics] ${stage}: ${payload.templateId}`);
  console.info("Summary", diagnostics);
  console.info("Entire email HTML output", payload.preview.html || "");
  console.info("Plain-text output", payload.preview.text || "");
  console.info("Builder document JSON", payload.draft.template);
  console.groupEnd();
}

function normalizeMergeTokenLabel(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{{") && trimmed.endsWith("}}")) {
    return trimmed.slice(2, -2).trim();
  }
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed.slice(1, -1).trim();
  }
  if (trimmed.startsWith("//")) {
    return trimmed.slice(2).trim();
  }
  return trimmed;
}

function mergeTokenDisplay(raw: string): string {
  const token = raw.trim();
  if (!token) return "";
  if (token.startsWith("{{") || token.startsWith("{") || token.startsWith("//")) return token;
  if (token.includes(".")) return `{{${token}}}`;
  return `{${token}}`;
}

function collectEmailMergeTextParts(draft: BuilderDraft): string[] {
  const parts: string[] = [
    draft.subject,
    draft.previewText,
    draft.fromName,
    draft.settings.physicalAddress,
    draft.settings.footerBrandingText,
    draft.settings.plainTextOverride || "",
  ];
  draft.template.blocks.forEach((block) => {
    [
      block.content,
      block.leftHtml,
      block.rightHtml,
      block.caption,
      block.headerTitle,
      block.headerSubtitle,
      block.videoTitle,
      block.fileLabel,
      block.fileDescription,
      block.html,
    ].forEach((value) => {
      if (typeof value === "string" && value.trim()) {
        parts.push(value);
      }
    });
  });
  return parts;
}

function extractLineForEmailToken(draft: BuilderDraft, token: string): string {
  const normalized = normalizeMergeTokenLabel(token);
  for (const part of collectEmailMergeTextParts(draft)) {
    const lines = stripHtml(part)
      .replace(/\r/g, "\n")
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    const match = lines.find((line) => extractMergeTokenKeys(line).some((candidate) => normalizeMergeTokenLabel(candidate) === normalized));
    if (match) return match;
  }
  return mergeTokenDisplay(token);
}

function looksLikeSafeUrl(value: string): boolean {
  const input = value.trim();
  if (!input) return false;
  return /^https?:\/\//i.test(input) || /^mailto:/i.test(input) || /^tel:/i.test(input) || /^\/(?!\/)/.test(input);
}

function preferredFieldForBlock(block: BuilderBlock): string | null {
  if (block.type === "header") return "headerTitle";
  if (block.type === "text") return "content";
  if (block.type === "html") return "html";
  if (block.type === "columns") return "leftHtml";
  if (block.type === "button" || block.type === "donationButton" || block.type === "eventButton") return "label";
  if (block.type === "image") return "alt";
  if (block.type === "video") return "videoTitle";
  if (block.type === "fileLink") return "fileLabel";
  return null;
}

function cloneBlock(block: BuilderBlock): BuilderBlock {
  const copy = JSON.parse(JSON.stringify(block)) as BuilderBlock;
  copy.id = createId();
  return copy;
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeTemplateForUi(template: BuilderTemplateDocument): BuilderTemplateDocument {
  return {
    ...template,
    fontFamily: template.fontFamily || DEFAULT_TEMPLATE.fontFamily,
    baseFontSize: clampNumber(Number(template.baseFontSize || DEFAULT_TEMPLATE.baseFontSize), 12, 22),
    lineHeight: clampNumber(Number(template.lineHeight || DEFAULT_TEMPLATE.lineHeight), 1.2, 2.2),
    textColor: template.textColor || DEFAULT_TEMPLATE.textColor,
    linkColor: template.linkColor || DEFAULT_TEMPLATE.linkColor,
  };
}

function moveBlockToIndex(blocks: BuilderBlock[], fromIndex: number, toIndex: number): BuilderBlock[] {
  const safeTo = clampNumber(toIndex, 0, Math.max(0, blocks.length - 1));
  if (fromIndex === safeTo || fromIndex < 0 || fromIndex >= blocks.length) return blocks;
  const next = [...blocks];
  const [item] = next.splice(fromIndex, 1);
  next.splice(safeTo, 0, item);
  return next;
}

async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.onload = () => {
      const result = String(reader.result || "");
      const marker = result.indexOf(",");
      if (marker < 0) {
        reject(new Error("Unsupported file encoding."));
        return;
      }
      resolve(result.slice(marker + 1));
    };
    reader.readAsDataURL(file);
  });
}

// ─── Helper components ────────────────────────────────────────────────────────

function BlockTypeIcon({ type }: { type: BuilderBlockType }) {
  const cls = "h-5 w-5";
  if (type === "header") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M3 4a2 2 0 012-2h10a2 2 0 012 2v3H3V4zm0 5h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V9zm4 2a1 1 0 000 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  );
  if (type === "text") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M4 4a1 1 0 011-1h10a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h10a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
  if (type === "image") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
    </svg>
  );
  if (type === "button") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
    </svg>
  );
  if (type === "divider") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
  if (type === "spacer") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
  if (type === "columns") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path d="M2 4a2 2 0 012-2h3a2 2 0 012 2v12a2 2 0 01-2 2H4a2 2 0 01-2-2V4zm9 0a2 2 0 012-2h3a2 2 0 012 2v12a2 2 0 01-2 2h-3a2 2 0 01-2-2V4z" />
    </svg>
  );
  if (type === "social") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
    </svg>
  );
  if (type === "video") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
    </svg>
  );
  if (type === "fileLink") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h9a2 2 0 002-2V7.414a2 2 0 00-.586-1.414L12 3.586A2 2 0 0010.586 3H4zm7 1.414L13.586 6H11V3.414zM6 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h4a1 1 0 100-2H7z" clipRule="evenodd" />
    </svg>
  );
  if (type === "donationButton") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
    </svg>
  );
  if (type === "eventButton") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
    </svg>
  );
  if (type === "aiSmart") return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M11 2a1 1 0 011 1v1.197a5.5 5.5 0 013.803 3.803H17a1 1 0 110 2h-1.197A5.5 5.5 0 0112 13.803V15a1 1 0 11-2 0v-1.197A5.5 5.5 0 016.197 10H5a1 1 0 110-2h1.197A5.5 5.5 0 0110 4.197V3a1 1 0 011-1zm0 4a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" clipRule="evenodd" />
    </svg>
  );
  // html
  return (
    <svg viewBox="0 0 20 20" className={cls} fill="currentColor">
      <path fillRule="evenodd" d="M12.316 3.051a1 1 0 01.633 1.265l-4 12a1 1 0 11-1.898-.632l4-12a1 1 0 011.265-.633zM5.707 6.293a1 1 0 010 1.414L3.414 10l2.293 2.293a1 1 0 11-1.414 1.414l-3-3a1 1 0 010-1.414l3-3a1 1 0 011.414 0zm8.586 0a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 11-1.414-1.414L16.586 10l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd" />
    </svg>
  );
}

function ToggleSwitch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <span className="text-xs font-medium text-slate-700">{label}</span>
      <button
        role="switch"
        aria-checked={checked}
        type="button"
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex h-[22px] w-10 flex-none cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200",
          checked ? "bg-emerald-500" : "bg-slate-300",
        ].join(" ")}
      >
        <span
          className={[
            "pointer-events-none inline-block h-[18px] w-[18px] transform rounded-full bg-white shadow ring-0 transition duration-200",
            checked ? "translate-x-[18px]" : "translate-x-0",
          ].join(" ")}
        />
      </button>
    </div>
  );
}

export default function OyamaEmailBuilderWorkspace({ templateId }: { templateId?: string }) {
  const router = useRouter();

  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(templateId || null);
  const [draft, setDraft] = useState<BuilderDraft>(DEFAULT_DRAFT);
  const [status, setStatus] = useState("DRAFT");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const [serverPreviewHtml, setServerPreviewHtml] = useState("");
  const [serverPreviewText, setServerPreviewText] = useState("");
  const [serverPreviewWarnings, setServerPreviewWarnings] = useState<string[]>([]);
  const [previewRecipients, setPreviewRecipients] = useState<PreviewRecipientOption[]>([]);
  const [previewMode, setPreviewMode] = useState<"random" | "selected" | "email">("selected");
  const [selectedPreviewRecipientId, setSelectedPreviewRecipientId] = useState("");
  const [previewRecipientSearch, setPreviewRecipientSearch] = useState("");
  const [previewPanelMode, setPreviewPanelMode] = useState<PreviewPanelMode>("split");
  const [previewViewport, setPreviewViewport] = useState<PreviewViewport>("desktop");
  const [previewAutoRefresh, setPreviewAutoRefresh] = useState(true);
  const [previewLastUpdatedAt, setPreviewLastUpdatedAt] = useState<string | null>(null);
  const [previewDeltaSummary, setPreviewDeltaSummary] = useState<string | null>(null);
  const [sendingPreviewToSelf, setSendingPreviewToSelf] = useState(false);
  const [globalBranding, setGlobalBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const [currentUserDisplayName, setCurrentUserDisplayName] = useState("");
  const [smtpDefaults, setSmtpDefaults] = useState<{ fromEmail: string; replyToEmail: string }>({
    fromEmail: "",
    replyToEmail: "",
  });
  const [mergeFieldGroups, setMergeFieldGroups] = useState<MergeFieldGroup[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  // UI state
  const [activeTab, setActiveTab] = useState<ActiveTab>("edit");
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [plainTextModalOpen, setPlainTextModalOpen] = useState(false);
  const [testEmailDialogOpen, setTestEmailDialogOpen] = useState(false);
  const [saveConflictModal, setSaveConflictModal] = useState<SaveConflictState | null>(null);
  const [blockInspectorModalOpen, setBlockInspectorModalOpen] = useState(false);
  const [inspectorTab, setInspectorTab] = useState<"content" | "style" | "advanced">("content");
  const [blockActionMenuFor, setBlockActionMenuFor] = useState<string | null>(null);
  const [zoom, setZoom] = useState(100);
  const [editingName, setEditingName] = useState(false);
  const [mergeSearch, setMergeSearch] = useState("");
  const [mergeLinePreviewToken, setMergeLinePreviewToken] = useState<string | null>(null);
  const [mergeLinePreview, setMergeLinePreview] = useState<MergeLinePreviewResponse | null>(null);
  const [mergeLinePreviewLoading, setMergeLinePreviewLoading] = useState(false);
  const [mergeLinePreviewError, setMergeLinePreviewError] = useState<string | null>(null);
  const [collapsedMergeGroups, setCollapsedMergeGroups] = useState<Set<string>>(new Set());
  const [brandingExpanded, setBrandingExpanded] = useState(false);
  const [addContentExpanded, setAddContentExpanded] = useState(true);
  const [mergeFieldsExpanded, setMergeFieldsExpanded] = useState(true);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
  const [previewRefreshing, setPreviewRefreshing] = useState(false);
  // status
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [autosaving, setAutosaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testRecipientEmail, setTestRecipientEmail] = useState("");
  const [previewRecipientLabel, setPreviewRecipientLabel] = useState<string | null>(null);
  const [insertTarget, setInsertTarget] = useState<InsertTarget>(null);
  const [writingTarget, setWritingTarget] = useState<WritingTarget>("selectedBlock");
  const [writingPrompt, setWritingPrompt] = useState("");
  const [writingTone, setWritingTone] = useState<WritingTone>("warm");
  const [writingBusy, setWritingBusy] = useState(false);
  const [writingOutput, setWritingOutput] = useState("");
  const [writingModelUsed, setWritingModelUsed] = useState<string | null>(null);
  const [writingError, setWritingError] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState("");
  const [aiSmartBusyBlockId, setAiSmartBusyBlockId] = useState<string | null>(null);
  const [aiSmartError, setAiSmartError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef(draft);
  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  useEffect(() => {
    let cancelled = false;

    async function loadBuilder(): Promise<void> {
      setLoading(true);
      setError(null);
      let brandingSnapshot = DEFAULT_BRANDING_SETTINGS;
      let userDisplayName = "";
      let smtpFromName = "";
      let smtpFromEmail = "";

      try {
        const groups = await apiFetch<MergeFieldResponse>("/api/oyama-email/merge-fields");
        if (!cancelled) {
          setMergeFieldGroups(Array.isArray(groups?.groups) ? groups.groups : []);
        }
      } catch (requestError) {
        if (!cancelled) {
          setMergeFieldGroups([]);
          setError(requestError instanceof Error ? requestError.message : "Failed to load merge fields.");
        }
      }

      try {
        const recipients = await apiFetch<PreviewRecipientOption[]>("/api/constituents?limit=250");
        if (!cancelled) {
          setPreviewRecipients(Array.isArray(recipients) ? recipients.filter((row) => Boolean(row.email)) : []);
        }
      } catch {
        if (!cancelled) {
          setPreviewRecipients([]);
        }
      }

      try {
        const branding = await fetchBrandingSettings();
        brandingSnapshot = branding;
        if (!cancelled) {
          setGlobalBranding(branding);
        }
      } catch {
        brandingSnapshot = DEFAULT_BRANDING_SETTINGS;
        if (!cancelled) {
          setGlobalBranding(DEFAULT_BRANDING_SETTINGS);
        }
      }

      try {
        const me = await apiFetch<AuthMeResponse>("/api/auth/me");
        userDisplayName = [me?.data?.firstName || "", me?.data?.lastName || ""].join(" ").trim();
        if (!cancelled) {
          setCurrentUserDisplayName(userDisplayName);
          setCurrentUserEmail(me?.data?.email?.trim() || "");
        }
      } catch {
        userDisplayName = "";
        if (!cancelled) {
          setCurrentUserDisplayName("");
          setCurrentUserEmail("");
        }
      }

      try {
        const settings = await apiFetch<GlobalSettingsResponse>("/api/settings");
        smtpFromName = String(settings?.smtpFromName || "").trim();
        smtpFromEmail = String(settings?.smtpFromEmail || "").trim();
        if (!cancelled) {
          setSmtpDefaults({
            fromEmail: smtpFromEmail,
            replyToEmail: smtpFromEmail,
          });
        }
      } catch {
        smtpFromName = "";
        smtpFromEmail = "";
        if (!cancelled) {
          setSmtpDefaults({ fromEmail: "", replyToEmail: "" });
        }
      }

      if (!templateId) {
        if (!cancelled) {
          const nextDraft = draftFromBranding(brandingSnapshot);
          const orgName = smtpFromName
            || brandingSnapshot.organizationDisplayName
            || brandingSnapshot.legalOrganizationName
            || nextDraft.fromName;
          setActiveTemplateId(null);
          setDraft({
            ...nextDraft,
            fromName: composeFromName(userDisplayName, orgName),
            fromEmail: smtpFromEmail || nextDraft.fromEmail,
            replyToEmail: smtpFromEmail || nextDraft.replyToEmail,
          });
          setStatus("DRAFT");
          setLastSavedAt(null);
          setServerPreviewHtml("");
          setServerPreviewText("");
          setPreviewRecipientLabel(null);
          setSelectedBlockId(nextDraft.template.blocks[0]?.id ?? null);
          setDirty(false);
          setLoading(false);
        }
        return;
      }

      try {
        const template = await apiFetch<BuilderTemplateResponse>(`/api/oyama-email/templates/${templateId}`);
        if (cancelled) return;

        setActiveTemplateId(template.id);
        setDraft({
          name: template.name,
          subject: template.subject,
          previewText: template.previewText,
          fromName: template.fromName,
          fromEmail: template.fromEmail,
          replyToEmail: template.replyToEmail,
          purpose: template.purpose,
          preferenceCategory: template.preferenceCategory,
          template: normalizeTemplateForUi(template.template),
          settings: template.settings,
        });
        setStatus(template.status || "DRAFT");
        setLastSavedAt(template.updatedAt || null);
        setServerPreviewHtml(template.renderedHtml || "");
        setServerPreviewText(template.renderedText || "");
        setSelectedBlockId(template.template.blocks[0]?.id ?? null);
        setDirty(false);
      } catch (requestError) {
        if (!cancelled) {
          setError(requestError instanceof Error ? requestError.message : "Failed to load template.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadBuilder();

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const selectedBlock = useMemo(() => {
    if (!selectedBlockId) return null;
    return draft.template.blocks.find((block) => block.id === selectedBlockId) ?? null;
  }, [draft.template.blocks, selectedBlockId]);

  const selectedBlockIndex = useMemo(() => {
    if (!selectedBlockId) return -1;
    return draft.template.blocks.findIndex((block) => block.id === selectedBlockId);
  }, [draft.template.blocks, selectedBlockId]);

  const selectedPreviewRecipient = useMemo(
    () => previewRecipients.find((row) => row.id === selectedPreviewRecipientId) ?? null,
    [previewRecipients, selectedPreviewRecipientId],
  );

  const filteredPreviewRecipients = useMemo(() => {
    const query = previewRecipientSearch.trim().toLowerCase();
    if (!query) return previewRecipients;
    return previewRecipients.filter((row) => {
      const label = row.displayName
        || row.organizationName
        || [row.firstName, row.lastName].filter(Boolean).join(" ")
        || "";
      return [label, row.email || "", row.id]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [previewRecipientSearch, previewRecipients]);

  useEffect(() => {
    if (!selectedPreviewRecipientId && previewRecipients.length > 0) {
      setSelectedPreviewRecipientId(previewRecipients[0].id);
    }
  }, [previewRecipients, selectedPreviewRecipientId]);

  const templateTextStyle = useMemo<React.CSSProperties>(() => ({
    fontFamily: draft.template.fontFamily || DEFAULT_TEMPLATE.fontFamily,
    fontSize: `${clampNumber(Number(draft.template.baseFontSize || DEFAULT_TEMPLATE.baseFontSize), 12, 22)}px`,
    lineHeight: String(clampNumber(Number(draft.template.lineHeight || DEFAULT_TEMPLATE.lineHeight), 1.2, 2.2)),
    color: draft.template.textColor || DEFAULT_TEMPLATE.textColor,
  }), [draft.template]);

  useEffect(() => {
    if (!selectedBlock) {
      setBlockInspectorModalOpen(false);
      setBlockActionMenuFor(null);
    }
  }, [selectedBlock]);

  useEffect(() => {
    setBlockActionMenuFor(null);
  }, [selectedBlockId]);

  const canPublish = Boolean(activeTemplateId);
  const publishHref = activeTemplateId ? `/oyama-email/templates/${activeTemplateId}/publish` : "";

  const saveTemplate = useCallback(async (auto = false) => {
    if (saving) return;

    const payload = {
      name: draftRef.current.name,
      subject: draftRef.current.subject,
      previewText: draftRef.current.previewText,
      fromName: draftRef.current.fromName,
      fromEmail: smtpDefaults.fromEmail || draftRef.current.fromEmail,
      replyToEmail: smtpDefaults.replyToEmail || draftRef.current.replyToEmail,
      purpose: draftRef.current.purpose,
      preferenceCategory: draftRef.current.preferenceCategory,
      template: draftRef.current.template,
      settings: draftRef.current.settings,
    };

    const requestPayload: Record<string, unknown> = { ...payload };
    if (activeTemplateId && lastSavedAt) {
      requestPayload.lastKnownUpdatedAt = lastSavedAt;
    }

    setError(null);
    if (!auto) setNotice(null);

    if (auto) {
      setAutosaving(true);
    } else {
      setSaving(true);
    }

    try {
      const endpoint = activeTemplateId
        ? `/api/oyama-email/templates/${activeTemplateId}`
        : "/api/oyama-email/templates";
      const method = activeTemplateId ? "PUT" : "POST";

      const saved = await saveTemplateRequest(endpoint, method, requestPayload);

      if (saveConflictModal) {
        setSaveConflictModal(null);
      }

      setActiveTemplateId(saved.id);
      setDraft({
        name: saved.name,
        subject: saved.subject,
        previewText: saved.previewText,
        fromName: saved.fromName,
        fromEmail: saved.fromEmail,
        replyToEmail: saved.replyToEmail,
        purpose: saved.purpose,
        preferenceCategory: saved.preferenceCategory,
        template: normalizeTemplateForUi(saved.template),
        settings: saved.settings,
      });
      setStatus(saved.status || "DRAFT");
      setLastSavedAt(saved.updatedAt || null);
      setServerPreviewHtml(saved.renderedHtml || "");
      setServerPreviewText(saved.renderedText || "");
      setDirty(false);

      if (!templateId || templateId !== saved.id) {
        router.replace(`/oyama-email/templates/${saved.id}/builder`);
      }

      if (!auto) {
        setNotice("Draft saved.");
      }
      return saved.id;
    } catch (requestError) {
      const conflict = requestError instanceof Error && "conflict" in requestError
        ? (requestError as Error & { conflict?: SaveConflictState }).conflict
        : undefined;

      if (conflict) {
        if (!auto) {
          setSaveConflictModal(conflict);
        }
        if (auto) {
          setNotice("Autosave paused because this template changed. Click Save Draft to resolve the overwrite conflict.");
        }
        setError(conflict.message);
      } else {
        setError(requestError instanceof Error ? requestError.message : "Failed to save template.");
      }
      return null;
    } finally {
      setSaving(false);
      setAutosaving(false);
    }
  }, [activeTemplateId, lastSavedAt, router, saveConflictModal, saving, smtpDefaults.fromEmail, smtpDefaults.replyToEmail, templateId]);

  const resolveSaveConflict = useCallback(async (options: SaveTemplateOptions) => {
    if (saving || autosaving || !saveConflictModal) return;

    const payload: Record<string, unknown> = {
      name: draftRef.current.name,
      subject: draftRef.current.subject,
      previewText: draftRef.current.previewText,
      fromName: draftRef.current.fromName,
      fromEmail: smtpDefaults.fromEmail || draftRef.current.fromEmail,
      replyToEmail: smtpDefaults.replyToEmail || draftRef.current.replyToEmail,
      purpose: draftRef.current.purpose,
      preferenceCategory: draftRef.current.preferenceCategory,
      template: draftRef.current.template,
      settings: draftRef.current.settings,
    };

    const endpoint = activeTemplateId
      ? `/api/oyama-email/templates/${activeTemplateId}`
      : "/api/oyama-email/templates";
    const method = activeTemplateId ? "PUT" : "POST";

    if (activeTemplateId) {
      if (lastSavedAt) {
        payload.lastKnownUpdatedAt = lastSavedAt;
      }
      if (options.forceOverwrite) {
        payload.forceOverwrite = true;
      }
    } else {
      if (options.confirmOverwrite && options.overwriteTemplateId) {
        payload.confirmOverwrite = true;
        payload.overwriteTemplateId = options.overwriteTemplateId;
      }
    }

    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const saved = await saveTemplateRequest(endpoint, method, payload);
      setSaveConflictModal(null);
      setActiveTemplateId(saved.id);
      setDraft({
        name: saved.name,
        subject: saved.subject,
        previewText: saved.previewText,
        fromName: saved.fromName,
        fromEmail: saved.fromEmail,
        replyToEmail: saved.replyToEmail,
        purpose: saved.purpose,
        preferenceCategory: saved.preferenceCategory,
        template: normalizeTemplateForUi(saved.template),
        settings: saved.settings,
      });
      setStatus(saved.status || "DRAFT");
      setLastSavedAt(saved.updatedAt || null);
      setServerPreviewHtml(saved.renderedHtml || "");
      setServerPreviewText(saved.renderedText || "");
      setDirty(false);

      if (!templateId || templateId !== saved.id) {
        router.replace(`/oyama-email/templates/${saved.id}/builder`);
      }

      setNotice("Draft saved.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save template.");
    } finally {
      setSaving(false);
      setAutosaving(false);
    }
  }, [activeTemplateId, autosaving, lastSavedAt, router, saveConflictModal, saving, smtpDefaults.fromEmail, smtpDefaults.replyToEmail, templateId]);

  useEffect(() => {
    if (!dirty || loading) return;
    const handle = window.setTimeout(() => {
      void saveTemplate(true);
    }, 1800);

    return () => {
      window.clearTimeout(handle);
    };
  }, [dirty, loading, saveTemplate, draft]);

  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty && !saving && !autosaving) return;
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [autosaving, dirty, saving]);

  const setDraftField = useCallback(<K extends keyof BuilderDraft>(field: K, value: BuilderDraft[K]) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setDirty(true);
  }, []);

  const setTemplateDocument = useCallback((next: BuilderTemplateDocument) => {
    setDraft((prev) => ({ ...prev, template: next }));
    setDirty(true);
  }, []);

  const updateBlock = useCallback((blockId: string, updater: (block: BuilderBlock) => BuilderBlock) => {
    setTemplateDocument({
      ...draftRef.current.template,
      blocks: draftRef.current.template.blocks.map((block) => {
        if (block.id !== blockId) return block;
        return updater(block);
      }),
    });
  }, [setTemplateDocument]);

  const buildPreviewRequestBody = useCallback(() => {
    if (previewMode === "selected") {
      const recipientConstituentId = selectedPreviewRecipientId || previewRecipients[0]?.id;
      if (recipientConstituentId) {
        return {
          previewMode: "selected",
          recipientConstituentId,
        };
      }
    }
    if (previewMode === "email" && testRecipientEmail.trim()) {
      return {
        previewMode: "email",
        recipientEmail: testRecipientEmail.trim(),
      };
    }
    return {
      previewMode: "random",
    };
  }, [previewMode, previewRecipients, selectedPreviewRecipientId, testRecipientEmail]);

  const addBlock = useCallback((type: BuilderBlockType) => {
    const block = createBlock(type);
    setTemplateDocument({
      ...draftRef.current.template,
      blocks: [...draftRef.current.template.blocks, block],
    });
    setSelectedBlockId(block.id);
  }, [setTemplateDocument]);

  const moveBlock = useCallback((blockId: string, direction: -1 | 1) => {
    const blocks = [...draftRef.current.template.blocks];
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= blocks.length) return;

    const [item] = blocks.splice(index, 1);
    blocks.splice(nextIndex, 0, item);
    setTemplateDocument({ ...draftRef.current.template, blocks });
  }, [setTemplateDocument]);

  const duplicateBlock = useCallback((blockId: string) => {
    const blocks = [...draftRef.current.template.blocks];
    const index = blocks.findIndex((block) => block.id === blockId);
    if (index < 0) return;

    const copy = cloneBlock(blocks[index]);
    blocks.splice(index + 1, 0, copy);
    setTemplateDocument({ ...draftRef.current.template, blocks });
    setSelectedBlockId(copy.id);
  }, [setTemplateDocument]);

  const deleteBlock = useCallback((blockId: string) => {
    const blocks = draftRef.current.template.blocks.filter((block) => block.id !== blockId);
    setTemplateDocument({ ...draftRef.current.template, blocks });

    if (selectedBlockId === blockId) {
      setSelectedBlockId(blocks[0]?.id ?? null);
    }
  }, [selectedBlockId, setTemplateDocument]);

  const refreshServerPreview = useCallback(async (options?: { silent?: boolean; templateId?: string }) => {
    const previewTemplateId = options?.templateId || activeTemplateId;
    if (!previewTemplateId) {
      if (!options?.silent) {
        setError("Save this template before requesting server preview.");
      }
      return;
    }

    if (!options?.silent) {
      setError(null);
    }
    setPreviewRefreshing(true);
    try {
      const preview = await apiFetch<PreviewResponse>(`/api/oyama-email/templates/${previewTemplateId}/preview`, {
        method: "POST",
        body: JSON.stringify(buildPreviewRequestBody()),
      });
      const deltaSummary = summarizePreviewDelta(serverPreviewText, preview.text || "");
      setServerPreviewHtml(preview.html || "");
      setServerPreviewText(preview.text || "");
      setServerPreviewWarnings(Array.isArray(preview.warnings) ? preview.warnings : []);
      setPreviewRecipientLabel(preview.recipient ? (preview.recipient.fullName || preview.recipient.email) : null);
      setPreviewDeltaSummary(deltaSummary);
      setPreviewLastUpdatedAt(new Date().toISOString());
      if (!options?.silent) {
        logBuilderPreviewDiagnostics("recipient-preview", {
          templateId: previewTemplateId,
          draft: draftRef.current,
          preview,
          requestBody: buildPreviewRequestBody(),
          deltaSummary,
        });
      }
      if (!options?.silent) {
        setNotice(Array.isArray(preview.warnings) && preview.warnings.length > 0 ? "Server preview refreshed with warnings." : "Server preview refreshed.");
      }
    } catch (requestError) {
      if (!options?.silent) {
        setError(requestError instanceof Error ? requestError.message : "Failed to refresh preview.");
      }
    } finally {
      setPreviewRefreshing(false);
    }
  }, [activeTemplateId, buildPreviewRequestBody, serverPreviewText]);

  useEffect(() => {
    if (!previewModalOpen || !activeTemplateId) return;
    const handle = window.setTimeout(() => {
      void refreshServerPreview({ silent: true });
    }, 280);
    return () => {
      window.clearTimeout(handle);
    };
  }, [activeTemplateId, previewModalOpen, previewMode, selectedPreviewRecipientId, testRecipientEmail, refreshServerPreview]);

  useEffect(() => {
    if (!previewModalOpen || !activeTemplateId || !previewAutoRefresh || !lastSavedAt) return;
    const handle = window.setTimeout(() => {
      void refreshServerPreview({ silent: true });
    }, 420);
    return () => {
      window.clearTimeout(handle);
    };
  }, [activeTemplateId, lastSavedAt, previewAutoRefresh, previewModalOpen, refreshServerPreview]);

  const sendTestEmail = useCallback(async () => {
    if (!activeTemplateId) {
      setError("Save this template before sending a test email.");
      return;
    }

    const toEmail = testRecipientEmail.trim();
    if (!toEmail) {
      setError("Enter a test recipient email before sending.");
      return;
    }

    setError(null);
    setNotice(null);
    setSaving(true);

    try {
      const result = await apiFetch<SendTestResponse>(`/api/oyama-email/templates/${activeTemplateId}/send-test`, {
        method: "POST",
        body: JSON.stringify({
          toEmail,
          recipientEmail: previewMode === "email" && testRecipientEmail.trim()
            ? testRecipientEmail.trim()
            : toEmail,
        }),
      });
      setNotice(result.warnings?.length
        ? `Test email sent to ${toEmail} with ${result.warnings.length} warning${result.warnings.length === 1 ? "" : "s"}.`
        : `Test email sent to ${toEmail}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send test email.");
    } finally {
      setSaving(false);
    }
  }, [activeTemplateId, previewMode, testRecipientEmail]);

  const sendPreviewToMyself = useCallback(async () => {
    if (!activeTemplateId) {
      setError("Save this template before sending a test email.");
      return;
    }

    const currentDraft = draftRef.current;
    const toEmail = (currentUserEmail || smtpDefaults.fromEmail || currentDraft.fromEmail || currentDraft.replyToEmail).trim();
    if (!toEmail) {
      setError("Add your user email or sender email in settings first, then use Send to Myself.");
      return;
    }

    setError(null);
    setSendingPreviewToSelf(true);
    try {
      const previewBody = buildPreviewRequestBody();
      const result = await apiFetch<SendTestResponse>(`/api/oyama-email/templates/${activeTemplateId}/send-test`, {
        method: "POST",
        body: JSON.stringify({
          toEmail,
          recipientEmail: previewMode === "email" && testRecipientEmail.trim()
            ? testRecipientEmail.trim()
            : toEmail,
          recipientConstituentId: "recipientConstituentId" in previewBody ? previewBody.recipientConstituentId : undefined,
          previewMode: previewBody.previewMode,
        }),
      });
      const diagnosticsWarnings = Array.from(new Set([
        ...serverPreviewWarnings,
        ...(result.warnings ?? []),
      ]));
      logBuilderPreviewDiagnostics("send-preview-to-self", {
        templateId: activeTemplateId,
        draft: currentDraft,
        preview: {
          id: activeTemplateId,
          subject: currentDraft.subject,
          previewText: currentDraft.previewText,
          html: serverPreviewHtml,
          text: serverPreviewText,
          mergeFieldsUsed: extractTokensFromDocument(currentDraft),
          warnings: diagnosticsWarnings,
          recipient: previewRecipientLabel ? {
            email: toEmail,
            firstName: "",
            lastName: "",
            fullName: previewRecipientLabel,
          } : null,
        },
        requestBody: previewBody,
        toEmail,
      });
      setNotice(diagnosticsWarnings.length
        ? `Preview sent to ${toEmail} with ${diagnosticsWarnings.length} warning${diagnosticsWarnings.length === 1 ? "" : "s"}.`
        : `Preview sent to ${toEmail}.`);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to send preview to yourself.");
    } finally {
      setSendingPreviewToSelf(false);
    }
  }, [activeTemplateId, buildPreviewRequestBody, currentUserEmail, previewMode, serverPreviewHtml, serverPreviewText, serverPreviewWarnings, smtpDefaults.fromEmail, testRecipientEmail, previewRecipientLabel]);

  const uploadImage = useCallback(async (blockId: string, file: File) => {
    const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
    if (!allowedTypes.has(file.type.toLowerCase())) {
      setError("Choose a PNG, JPG, WEBP, or GIF image.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("Choose an image that is 5MB or smaller.");
      return;
    }

    setUploadingImage(true);
    setError(null);

    try {
      const templateIdForUpload = activeTemplateId ?? await saveTemplate(false);
      if (!templateIdForUpload) {
        throw new Error("The draft could not be saved before the image upload.");
      }
      const dataBase64 = await fileToBase64(file);
      const response = await apiFetch<{ url: string }>(`/api/email-campaigns/${templateIdForUpload}/media`, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          dataBase64,
        }),
      });

      updateBlock(blockId, (block) => {
        if (block.type === "image") {
          return {
            ...block,
            src: response.url,
            alt: block.alt || file.name,
            imageWidthPercent: block.imageWidthPercent || 100,
            align: block.align || "center",
          };
        }
        if (block.type === "video") {
          return {
            ...block,
            thumbnailUrl: response.url,
            videoAlt: block.videoAlt || file.name,
          };
        }
        return block;
      });

      setNotice("Image uploaded.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Image upload failed.");
    } finally {
      setUploadingImage(false);
    }
  }, [activeTemplateId, saveTemplate, updateBlock]);

  const insertMergeToken = useCallback((token: string) => {
    if (insertTarget?.scope === "template") {
      const field = insertTarget.field;
      if (field === "physicalAddress" || field === "footerBrandingText") {
        const current = String(draftRef.current.settings[field] ?? "");
        setDraftField("settings", {
          ...draftRef.current.settings,
          [field]: appendToken(current, token),
        });
        return;
      }

      const current = String(draftRef.current[field] ?? "");
      setDraftField(field, appendToken(current, token) as BuilderDraft[typeof field]);
      return;
    }

    if (insertTarget?.scope === "block") {
      updateBlock(insertTarget.blockId, (block) => {
        const candidate = block as BuilderBlock & Record<string, unknown>;
        const current = typeof candidate[insertTarget.field] === "string"
          ? String(candidate[insertTarget.field])
          : "";
        return {
          ...block,
          [insertTarget.field]: appendToken(current, token),
        };
      });
      return;
    }

    if (selectedBlock) {
      const preferredField = preferredFieldForBlock(selectedBlock);
      if (preferredField) {
        updateBlock(selectedBlock.id, (block) => {
          const candidate = block as BuilderBlock & Record<string, unknown>;
          const current = typeof candidate[preferredField] === "string"
            ? String(candidate[preferredField])
            : "";
          return {
            ...block,
            [preferredField]: appendToken(current, token),
          };
        });
      }
    }
  }, [insertTarget, selectedBlock, setDraftField, updateBlock]);

  const filteredMergeGroups = useMemo(() => {
    if (!mergeSearch.trim()) return mergeFieldGroups;
    const q = mergeSearch.toLowerCase();
    return mergeFieldGroups
      .map((group) => ({
        ...group,
        fields: group.fields.filter(
          (field) => field.token.toLowerCase().includes(q) || field.description.toLowerCase().includes(q)
        ),
      }))
      .filter((group) => group.fields.length > 0);
  }, [mergeFieldGroups, mergeSearch]);

  const knownMergeTokens = useMemo(() => new Set(
    mergeFieldGroups.flatMap((group) => group.fields.map((field) => normalizeMergeTokenLabel(field.token)))
  ), [mergeFieldGroups]);
  const detectedMergeTokens = useMemo(() => (
    Array.from(new Set(collectEmailMergeTextParts(draft).flatMap((part) => extractMergeTokenKeys(part))))
  ), [draft]);
  const unknownMergeTokens = useMemo(
    () => detectedMergeTokens.filter((token) => !knownMergeTokens.has(normalizeMergeTokenLabel(token))),
    [detectedMergeTokens, knownMergeTokens],
  );

  const loadMergeLinePreview = useCallback(async (token: string) => {
    const normalized = normalizeMergeTokenLabel(token);
    if (!knownMergeTokens.has(normalized)) {
      setMergeLinePreviewToken(token);
      setMergeLinePreview(null);
      setMergeLinePreviewError("Unknown merge field. Fix the token before previewing live data.");
      return;
    }

    const line = extractLineForEmailToken(draftRef.current, token);
    setMergeLinePreviewToken(token);
    setMergeLinePreviewLoading(true);
    setMergeLinePreviewError(null);
    try {
      const result = await apiFetch<MergeLinePreviewResponse>("/api/oyama-email/merge-fields/line-preview", {
        method: "POST",
        body: JSON.stringify({ line, limit: 5 }),
      });
      setMergeLinePreview(result);
    } catch (requestError) {
      setMergeLinePreview(null);
      setMergeLinePreviewError(requestError instanceof Error ? requestError.message : "Could not load live merge preview.");
    } finally {
      setMergeLinePreviewLoading(false);
    }
  }, [knownMergeTokens]);

  const builderWarnings = useMemo(() => {
    const warnings: string[] = [];

    const groupByPrefix = new Map<string, MergeFieldGroup>();
    mergeFieldGroups.forEach((group) => {
      const key = group.key.trim().toLowerCase();
      if (key) groupByPrefix.set(`${key}.`, group);
    });

    const contentParts: string[] = [
      draft.subject,
      draft.previewText,
      draft.fromName,
      draft.settings.physicalAddress,
      draft.settings.footerBrandingText,
      draft.settings.plainTextOverride || "",
    ];
    draft.template.blocks.forEach((block) => {
      [
        block.content,
        block.leftHtml,
        block.rightHtml,
        block.caption,
        block.headerTitle,
        block.headerSubtitle,
        block.videoTitle,
        block.fileLabel,
        block.fileDescription,
        block.html,
      ].forEach((value) => {
        if (typeof value === "string" && value.trim()) {
          contentParts.push(value);
        }
      });
    });

    const usedTokens = new Set(contentParts.flatMap((part) => extractMergeTokenKeys(part)));
    usedTokens.forEach((token) => {
      if (!knownMergeTokens.has(normalizeMergeTokenLabel(token))) {
        warnings.push(`Unknown merge field: ${mergeTokenDisplay(token)}`);
      }

      for (const [prefix, group] of groupByPrefix.entries()) {
        if (token.startsWith(prefix) && !group.available) {
          warnings.push(`Data warning: ${group.label} may be empty for {{ ${token} }} because that dataset is not available.`);
          break;
        }
      }
    });

    const needsComplianceControls = ["MARKETING", "FUNDRAISING", "NEWSLETTER", "EVENT_PROMOTION"].includes(draft.purpose);
    if (needsComplianceControls && !draft.settings.includeUnsubscribeLink) {
      warnings.push("Compliance warning: marketing/fundraising templates should include unsubscribe and preferences links.");
    }
    if (draft.settings.includePhysicalAddress && !draft.settings.physicalAddress.trim()) {
      warnings.push("Compliance warning: physical address is enabled but empty.");
    }

    draft.template.blocks.forEach((block, index) => {
      const position = index + 1;
      if (block.type === "image") {
        if (!block.src?.trim()) warnings.push(`Block ${position}: image source URL is missing.`);
        if (!block.alt?.trim()) warnings.push(`Block ${position}: image alt text is missing.`);
      }
      if (block.type === "video") {
        if (!block.videoUrl?.trim()) warnings.push(`Block ${position}: video URL is missing.`);
        if (!block.thumbnailUrl?.trim()) warnings.push(`Block ${position}: video thumbnail URL is missing.`);
        if (!block.videoAlt?.trim()) warnings.push(`Block ${position}: video thumbnail alt text is missing.`);
      }
      if (block.type === "button" || block.type === "donationButton" || block.type === "eventButton") {
        if (!block.href?.trim()) warnings.push(`Block ${position}: button URL is missing.`);
      }
      if (block.type === "fileLink") {
        if (!block.fileUrl?.trim()) warnings.push(`Block ${position}: file link URL is missing.`);
      }
      if (block.type === "social" && (!block.links || block.links.length === 0)) {
        warnings.push(`Block ${position}: social block has no platform links.`);
      }
    });

    const possibleUrls: string[] = [];
    draft.template.blocks.forEach((block) => {
      if (block.src) possibleUrls.push(block.src);
      if (block.href) possibleUrls.push(block.href);
      if (block.videoUrl) possibleUrls.push(block.videoUrl);
      if (block.fileUrl) possibleUrls.push(block.fileUrl);
      if (Array.isArray(block.links)) {
        block.links.forEach((link) => possibleUrls.push(link.url));
      }
    });
    possibleUrls
      .map((value) => value.trim())
      .filter(Boolean)
      .forEach((url) => {
        if (!looksLikeSafeUrl(url) && !url.includes("{{")) {
          warnings.push(`Link warning: URL may be invalid for email clients (${url.slice(0, 64)}${url.length > 64 ? "..." : ""}).`);
        }
      });

    return Array.from(new Set(warnings));
  }, [draft, knownMergeTokens, mergeFieldGroups]);

  const toggleMergeGroup = useCallback((key: string) => {
    setCollapsedMergeGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleInsertBlock = useCallback((type: BuilderBlockType, afterIndex?: number) => {
    const block = type === "header" ? createHeaderBlock(globalBranding) : createBlock(type);
    const blocks = [...draftRef.current.template.blocks];
    if (afterIndex !== undefined && afterIndex >= 0) {
      blocks.splice(afterIndex + 1, 0, block);
    } else {
      blocks.push(block);
    }
    setTemplateDocument({ ...draftRef.current.template, blocks });
    setSelectedBlockId(block.id);
    setInsertAfterIndex(null);
  }, [globalBranding, setTemplateDocument]);

  const insertBlocks = useCallback((newBlocks: BuilderBlock[], afterIndex?: number) => {
    const blocks = [...draftRef.current.template.blocks];
    if (afterIndex !== undefined && afterIndex >= 0) {
      blocks.splice(afterIndex + 1, 0, ...newBlocks);
    } else {
      blocks.push(...newBlocks);
    }
    setTemplateDocument({ ...draftRef.current.template, blocks });
    setSelectedBlockId(newBlocks[0]?.id || null);
    setInsertAfterIndex(null);
  }, [setTemplateDocument]);

  const handleInsertPremadeSection = useCallback((preset: PremadeSectionId) => {
    const address = formatBrandingAddress(globalBranding);
    const after = insertAfterIndex ?? undefined;
    const blocksForSocial = [
      ...(globalBranding.socialFacebook ? [{ label: "Facebook", url: globalBranding.socialFacebook }] : []),
      ...(globalBranding.socialInstagram ? [{ label: "Instagram", url: globalBranding.socialInstagram }] : []),
      ...(globalBranding.socialLinkedIn ? [{ label: "LinkedIn", url: globalBranding.socialLinkedIn }] : []),
      ...(globalBranding.socialYoutube ? [{ label: "YouTube", url: globalBranding.socialYoutube }] : []),
      ...(globalBranding.socialX ? [{ label: "X", url: globalBranding.socialX }] : []),
    ];

    const orgName = globalBranding.organizationDisplayName || globalBranding.legalOrganizationName || "Our Ministry";
    const website = globalBranding.websiteUrl || "https://";

    if (preset === "brandHeader") {
      insertBlocks([createHeaderBlock(globalBranding), { id: createId(), type: "spacer", height: 12 }], after);
      return;
    }

    if (preset === "heroCta") {
      insertBlocks([
        { id: createId(), type: "text", content: `<h2>${orgName}</h2><p>Share your mission impact in one short paragraph and invite supporters to take action.</p>` },
        { id: createId(), type: "button", label: "Take Action", href: website, color: globalBranding.primaryColor || "#0f5c3c", textColor: "#ffffff" },
      ], after);
      return;
    }

    if (preset === "storyTwoCol") {
      insertBlocks([{ id: createId(), type: "columns", leftHtml: "<h3>Impact Story</h3><p>Highlight one person, one family, or one program result.</p>", rightHtml: "<h3>How To Help</h3><p>Add next-step giving, volunteering, or prayer actions.</p>" }], after);
      return;
    }

    if (preset === "impactStory") {
      insertBlocks([
        { id: createId(), type: "text", content: "<h3>Impact Story</h3><p>{{ donor.firstName }} recently shared how this ministry encouraged their family in a difficult season.</p>" },
        { id: createId(), type: "image", src: "", alt: "Impact story image" },
      ], after);
      return;
    }

    if (preset === "givingCallout") {
      insertBlocks([
        { id: createId(), type: "text", content: "<h3>Will you help today?</h3><p>Your gift powers practical help and spiritual care this month.</p>" },
        { id: createId(), type: "donationButton", label: "Give Now", href: website, color: globalBranding.primaryColor || "#0f5c3c", textColor: "#ffffff" },
      ], after);
      return;
    }

    if (preset === "eventRegistration") {
      insertBlocks([
        { id: createId(), type: "text", content: "<h3>{{ event.name }}</h3><p>{{ event.startDate }} • {{ event.location }}</p>" },
        { id: createId(), type: "eventButton", label: "Register", href: website, color: globalBranding.primaryColor || "#0f5c3c", textColor: "#ffffff" },
      ], after);
      return;
    }

    if (preset === "countdownCallout") {
      insertBlocks([{ id: createId(), type: "text", content: "<h3>Only a few days left</h3><p>Campaign closes on {{ event.startDate }}. Join us now.</p>" }], after);
      return;
    }

    if (preset === "quoteTestimonial") {
      insertBlocks([{ id: createId(), type: "text", content: "<p><em>\"This ministry helped us keep going when we felt overwhelmed.\"</em></p><p><strong>- Supporter Name</strong></p>" }], after);
      return;
    }

    if (preset === "staffSignature") {
      insertBlocks([{ id: createId(), type: "text", content: "<p>With gratitude,</p><p><strong>{{ staff.name }}</strong><br/>{{ staff.email }}</p>" }], after);
      return;
    }

    if (preset === "contactCard") {
      insertBlocks([{ id: createId(), type: "text", content: `<h3>Contact Us</h3><p>Email: ${globalBranding.contactEmail || "info@example.org"}<br/>Phone: ${globalBranding.contactPhone || "(000) 000-0000"}</p>` }], after);
      return;
    }

    if (preset === "locationAddress") {
      insertBlocks([{ id: createId(), type: "text", content: `<h3>Our Location</h3><p>${address || "Add mailing address in Branding settings."}</p>` }], after);
      return;
    }

    if (preset === "receiptSummary") {
      insertBlocks([{ id: createId(), type: "text", content: "<h3>Receipt Summary</h3><p>Receipt #: {{ gift.receiptNumber }}<br/>Amount: {{ gift.amount }}<br/>Date: {{ gift.date }}</p>" }], after);
      return;
    }

    if (preset === "donationSummary") {
      insertBlocks([{ id: createId(), type: "text", content: "<h3>Your Giving Summary</h3><p>Last gift: {{ donor.lastGiftAmount }} on {{ donor.lastGiftDate }}<br/>YTD: {{ donor.totalYtdGiving }}</p>" }], after);
      return;
    }

    if (preset === "recentGiftAck") {
      insertBlocks([{ id: createId(), type: "text", content: "<h3>Thank you for your recent gift</h3><p>We received {{ gift.amount }} and are grateful for your continued support.</p>" }], after);
      return;
    }

    if (preset === "ministryUpdate") {
      insertBlocks([{ id: createId(), type: "text", content: "<h3>Ministry Update</h3><p>Share one clear update on ministry progress, milestones, and prayer needs.</p>" }], after);
      return;
    }

    if (preset === "prayerRequest") {
      insertBlocks([{ id: createId(), type: "text", content: "<h3>Prayer Request</h3><p>Please pray with us for wisdom, provision, and encouragement this week.</p>" }], after);
      return;
    }

    if (preset === "sponsorHighlight") {
      insertBlocks([{ id: createId(), type: "text", content: "<h3>Sponsor Highlight</h3><p>Feature one sponsor and the impact their support is creating.</p>" }], after);
      return;
    }

    if (preset === "legalFooter") {
      insertBlocks([{ id: createId(), type: "text", content: `<p style="font-size:12px;">${globalBranding.footerLegalText || "You are receiving this because you requested updates from our organization."}</p>` }], after);
      return;
    }

    if (preset === "unsubscribePrefs") {
      insertBlocks([{ id: createId(), type: "text", content: "<p style=\"font-size:12px;\">Manage communication settings: <a href=\"{{managePreferencesUrl}}\">Preferences</a> • <a href=\"{{unsubscribeUrl}}\">Unsubscribe</a></p>" }], after);
      return;
    }

    if (preset === "socialShare") {
      insertBlocks([{ id: createId(), type: "social", socialMode: "share", socialLayout: "row", socialIconStyle: "outline", socialTrackingLabel: "campaign-share", socialShowLabels: true, links: blocksForSocial }], after);
      return;
    }

    if (preset === "fileDownload") {
      insertBlocks([{ id: createId(), type: "fileLink", fileLabel: "Download PDF", fileUrl: website, fileDescription: "Supports OneDrive, SharePoint, and direct HTTPS links.", fileTrackingLabel: "resource-download" }], after);
      return;
    }

    insertBlocks([
      { id: createId(), type: "social", socialMode: "follow", socialLayout: "row", socialIconStyle: "pill", socialShowLabels: true, links: blocksForSocial },
      { id: createId(), type: "text", content: `<p style="font-size:12px;">${address || "Update your organization address in Branding Settings."}</p>` },
    ], after);
  }, [globalBranding, insertAfterIndex, insertBlocks]);

  const handleBlockDragStart = useCallback((event: React.DragEvent<HTMLElement>, blockId: string) => {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", blockId);
    setDraggingBlockId(blockId);
  }, []);

  const handleBlockDragOver = useCallback((event: React.DragEvent<HTMLElement>, blockId: string) => {
    event.preventDefault();
    if (draggingBlockId === blockId) return;
    setDragOverBlockId(blockId);
    event.dataTransfer.dropEffect = "move";
  }, [draggingBlockId]);

  const handleBlockDrop = useCallback((event: React.DragEvent<HTMLElement>, targetBlockId: string) => {
    event.preventDefault();
    const sourceBlockId = event.dataTransfer.getData("text/plain") || draggingBlockId;
    if (!sourceBlockId || sourceBlockId === targetBlockId) {
      setDragOverBlockId(null);
      setDraggingBlockId(null);
      return;
    }

    const blocks = [...draftRef.current.template.blocks];
    const fromIndex = blocks.findIndex((block) => block.id === sourceBlockId);
    const toIndex = blocks.findIndex((block) => block.id === targetBlockId);
    if (fromIndex < 0 || toIndex < 0) {
      setDragOverBlockId(null);
      setDraggingBlockId(null);
      return;
    }

    const reordered = moveBlockToIndex(blocks, fromIndex, toIndex);
    setTemplateDocument({ ...draftRef.current.template, blocks: reordered });
    setSelectedBlockId(sourceBlockId);
    setDragOverBlockId(null);
    setDraggingBlockId(null);
  }, [draggingBlockId, setTemplateDocument]);

  const handleBlockDragEnd = useCallback(() => {
    setDragOverBlockId(null);
    setDraggingBlockId(null);
  }, []);

  const handlePreviewOpen = useCallback(async () => {
    setPreviewModalOpen(true);
    const previewTemplateId = dirty || !activeTemplateId
      ? await saveTemplate(false)
      : activeTemplateId;
    if (previewTemplateId) {
      void refreshServerPreview({ silent: false, templateId: previewTemplateId });
    }
  }, [activeTemplateId, dirty, refreshServerPreview, saveTemplate]);

  const generateAiSmartHtml = useCallback(async (blockId: string, description: string, tone: WritingTone, instruction?: string, objective: AiSmartObjective = "fundraising") => {
    const brief = description.trim();
    if (!brief) {
      setAiSmartError("Add a Smart Block description before generating HTML.");
      return;
    }
    if (aiSmartBusyBlockId) return;

    const targetBlock = draftRef.current.template.blocks.find((block) => block.id === blockId);
    if (!targetBlock || targetBlock.type !== "html") {
      setAiSmartError("AI Smart generation only works on HTML blocks.");
      return;
    }

    setAiSmartBusyBlockId(blockId);
    setAiSmartError(null);

    try {
      const allowedMergeFields = mergeFieldGroups
        .flatMap((group) => group.fields.map((field) => field.token))
        .filter(Boolean);

      const response = await apiFetchResponse("/api/communications-ai/email-builder/write-stream", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          target: "bodyHtml",
          mode: "smartHtml",
          prompt: [
            brief,
            "",
            `Campaign objective: ${objective}.`,
            objective === "fundraising"
              ? "Optimize for donor trust, impact clarity, and one donation call-to-action."
              : objective === "event"
                ? "Optimize for event registration clarity, date/location readability, and attendance action."
                : objective === "volunteer"
                  ? "Optimize for volunteer invitation clarity, role expectations, and response action."
                  : "Optimize for mission update clarity, gratitude, and concise narrative flow.",
            "",
            instruction
              ? `Advanced instruction:\n${instruction}`
              : "Advanced instruction:\nKeep the section concise, mobile-scannable, and conversion-aware.",
            "",
            "Priorities:",
            "1) Be conversion-focused and concise.",
            "2) Keep paragraphs short for mobile scanning.",
            "3) Include one clear CTA where relevant.",
          ].join("\n"),
          tone,
          campaignName: draftRef.current.name,
          audience: draftRef.current.purpose,
          currentContent: stripHtml(targetBlock.html || ""),
          allowedMergeFields,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Steward AI Smart Block generation is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let reply = "";

      const processRawEvent = (rawEvent: string) => {
        const eventName = rawEvent.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
        const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
        if (!dataLine) return;
        const payload = JSON.parse(dataLine) as { delta?: string; reply?: string; message?: string };

        if (eventName === "delta" && payload.delta) {
          reply += payload.delta;
        } else if (eventName === "done") {
          if (typeof payload.reply === "string" && payload.reply.trim()) {
            reply = payload.reply;
          }
        } else if (eventName === "error") {
          throw new Error(payload.message || "AI Smart generation failed.");
        }
      };

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true }).replace(/\r\n/g, "\n");
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
          processRawEvent(rawEvent);
        }
      }

      buffer += decoder.decode();
      const trailingEvent = buffer.trim();
      if (trailingEvent) {
        processRawEvent(trailingEvent);
      }

      if (!reply.trim()) {
        throw new Error("AI Smart generation completed but returned no content.");
      }

      const html = normalizeAiSmartOutputHtml(reply.trim());
      updateBlock(blockId, (current) => ({
        ...current,
        type: "html",
        aiSmart: true,
        aiSmartPrompt: brief,
        aiSmartTone: tone,
        aiSmartObjective: objective,
        html,
      }));
      setNotice("AI Smart Block generated with Steward AI.");
    } catch (error) {
      setAiSmartError(error instanceof Error ? error.message : "AI Smart generation failed.");
    } finally {
      setAiSmartBusyBlockId(null);
    }
  }, [aiSmartBusyBlockId, mergeFieldGroups, updateBlock]);

  const applyWritingOutput = useCallback(() => {
    const trimmed = writingOutput.trim();
    if (!trimmed) return;

    if (writingTarget === "subject") {
      setDraftField("subject", stripHtml(trimmed).replace(/\s+/g, " ").trim());
      return;
    }

    if (writingTarget === "previewText") {
      setDraftField("previewText", stripHtml(trimmed).replace(/\s+/g, " ").trim());
      return;
    }

    const html = normalizeWriterOutputHtml(trimmed);
    if (writingTarget === "selectedBlock" && selectedBlock?.type === "text") {
      updateBlock(selectedBlock.id, (current) => ({ ...current, content: html }));
      return;
    }

    const insertedBlock = createBlock("text");
    insertedBlock.content = html;
    const blocks = [...draftRef.current.template.blocks];
    if (selectedBlockIndex >= 0) {
      blocks.splice(selectedBlockIndex + 1, 0, insertedBlock);
    } else {
      blocks.push(insertedBlock);
    }
    setTemplateDocument({ ...draftRef.current.template, blocks });
    setSelectedBlockId(insertedBlock.id);
  }, [selectedBlock, selectedBlockIndex, setDraftField, setTemplateDocument, updateBlock, writingOutput, writingTarget]);

  const runWritingStream = useCallback(async () => {
    if (writingBusy) return;
    if (!writingPrompt.trim()) {
      setWritingError("Add a writing brief before generating copy.");
      return;
    }

    setWritingBusy(true);
    setWritingError(null);
    setWritingOutput("");
    setWritingModelUsed(null);

    try {
      const response = await apiFetchResponse("/api/communications-ai/email-builder/write-stream", {
        method: "POST",
        headers: {
          Accept: "text/event-stream",
        },
        body: JSON.stringify({
          target: writingTarget === "newBlock" ? "bodyHtml" : writingTarget === "selectedBlock" ? "bodyHtml" : writingTarget,
          prompt: writingPrompt,
          tone: writingTone,
          campaignName: draft.name,
          audience: draft.purpose,
          currentContent: writingTarget === "subject"
            ? draft.subject
            : writingTarget === "previewText"
              ? draft.previewText
              : selectedBlock?.type === "text"
                ? stripHtml(selectedBlock.content || "")
                : "",
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error("Writing stream is unavailable.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        buffer += decoder.decode(chunk.value, { stream: true });
        let boundary = buffer.indexOf("\n\n");
        while (boundary >= 0) {
          const rawEvent = buffer.slice(0, boundary);
          buffer = buffer.slice(boundary + 2);
          boundary = buffer.indexOf("\n\n");
          const eventName = rawEvent.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim() || "message";
          const dataLine = rawEvent.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();
          if (!dataLine) continue;
          const payload = JSON.parse(dataLine) as { delta?: string; reply?: string; sourceModel?: string; message?: string };
          if (eventName === "delta" && payload.delta) {
            setWritingOutput((current) => current + payload.delta);
          } else if (eventName === "done") {
            if (typeof payload.reply === "string" && payload.reply.trim()) {
              setWritingOutput(payload.reply);
            }
            if (payload.sourceModel) {
              setWritingModelUsed(payload.sourceModel);
            }
          } else if (eventName === "error") {
            throw new Error(payload.message || "Writing stream failed.");
          }
        }
      }
    } catch (error) {
      setWritingError(error instanceof Error ? error.message : "Writing stream failed.");
    } finally {
      setWritingBusy(false);
    }
  }, [draft.name, draft.previewText, draft.purpose, draft.subject, selectedBlock, writingBusy, writingPrompt, writingTarget, writingTone]);

  const canvasWidth = activeTab === "mobilePreview" ? 375 : Math.min(620, Math.max(420, draft.template.contentWidth));
  const scaledStyle: React.CSSProperties | undefined = zoom !== 100 ? { transform: `scale(${zoom / 100})`, transformOrigin: "top center" } : undefined;

  if (loading) {
    return (
      <div className="flex min-h-[70vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-700 border-t-transparent" />
        <p className="text-sm font-medium text-slate-500">Loading template builder…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#f6f8fb]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-[0_1px_0_rgba(15,23,42,0.03)]">
        {/* Row 1: back + name + status + actions */}
        <div className="flex min-h-16 flex-wrap items-center gap-2 px-3 py-2 sm:gap-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.push("/oyama-email/templates")}
            className="flex-none rounded-lg p-1.5 text-slate-700 hover:bg-slate-100"
            title="Back to template library"
          >
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
          </button>
          <div className="hidden text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 lg:block">
            Templates / Builder
          </div>
          {editingName ? (
            <input
              ref={nameInputRef}
              value={draft.name}
              onChange={(e) => setDraftField("name", e.target.value)}
              onBlur={() => setEditingName(false)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") setEditingName(false); }}
              className="h-9 flex-1 rounded-lg border border-emerald-400 bg-white px-2 text-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingName(true)}
              className="min-w-0 flex-1 truncate text-left text-xl font-semibold text-slate-950 hover:text-emerald-700"
              title="Click to rename"
            >
              {draft.name || "Untitled Email Template"}
            </button>
          )}
          <span className="flex-none rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
            {status === "SENT" ? "Published" : "Draft"}
          </span>
          <span className="hidden flex-none text-xs text-slate-400 xl:block">
            {autosaving ? "Saving draft…" : dirty ? "Unsaved changes - autosave active" : formatLastSaved(lastSavedAt)}
          </span>
          <div className="ml-auto flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
            <button
              type="button"
              onClick={() => void saveTemplate(false)}
              disabled={saving || autosaving}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save Draft"}
            </button>
            <button
              type="button"
              onClick={() => setTestEmailDialogOpen(true)}
              className="h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Send Test
            </button>
            {canPublish ? (
              <Link
                href={publishHref}
                className="inline-flex h-10 items-center rounded-lg border border-emerald-800 bg-emerald-800 px-4 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 sm:px-5"
              >
                Next: Publish →
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="Save template first"
                className="h-10 rounded-lg border border-slate-200 bg-slate-100 px-4 text-sm font-semibold text-slate-400 sm:px-5"
              >
                Next: Publish →
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Ribbon tabs + zoom + device toggle */}
        <div className="flex min-h-12 flex-wrap items-end gap-2 overflow-x-auto border-t border-slate-100 px-3 sm:px-6">
          <div className="mr-2 flex min-w-max items-end gap-4 sm:mr-4 sm:gap-8">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={["h-12 border-b-2 px-1 text-sm font-semibold transition-colors",
                activeTab === "edit" ? "border-emerald-700 text-slate-950" : "border-transparent text-slate-600 hover:text-slate-900"
              ].join(" ")}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => void handlePreviewOpen()}
              className="h-12 border-b-2 border-transparent px-1 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
            >
              {previewRefreshing ? "Loading..." : "Show Me How It Will Look to the Recipient"}
            </button>
            <button
              type="button"
              onClick={() => setPlainTextModalOpen(true)}
              className="h-12 border-b-2 border-transparent px-1 text-sm font-semibold text-slate-600 transition-colors hover:text-slate-900"
            >
              Plain Text
            </button>
            <button
              type="button"
              onClick={() => setActiveTab(activeTab === "mobilePreview" ? "edit" : "mobilePreview")}
              className={["h-12 border-b-2 px-1 text-sm font-semibold transition-colors",
                activeTab === "mobilePreview" ? "border-emerald-700 text-slate-950" : "border-transparent text-slate-600 hover:text-slate-900"
              ].join(" ")}
            >
              Mobile
            </button>
          </div>
          <div className="hidden flex-1 sm:block" />
          <div className="mb-1 flex min-w-max items-center gap-2">
            <div className="flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1.5">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(50, z - 10))}
                className="h-6 w-5 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >−</button>
              <span className="w-10 text-center text-xs font-semibold text-slate-700">{zoom}%</span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(150, z + 10))}
                className="h-6 w-5 text-sm font-semibold text-slate-600 hover:text-slate-900"
              >+</button>
            </div>
            <div className="flex overflow-hidden rounded-md border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveTab("edit")}
                title="Desktop view"
                className={["flex h-7 w-8 items-center justify-center text-slate-600 transition-colors",
                  activeTab !== "mobilePreview" ? "bg-emerald-50 text-emerald-700" : "bg-white hover:bg-slate-50"
                ].join(" ")}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm2 0h10v8H5V5zm4 10a1 1 0 100 2h2a1 1 0 100-2H9z" clipRule="evenodd" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("mobilePreview")}
                title="Mobile view"
                className={["flex h-7 w-8 items-center justify-center border-l border-slate-200 text-slate-600 transition-colors",
                  activeTab === "mobilePreview" ? "bg-emerald-50 text-emerald-700" : "bg-white hover:bg-slate-50"
                ].join(" ")}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                  <path fillRule="evenodd" d="M7 2a2 2 0 00-2 2v12a2 2 0 002 2h6a2 2 0 002-2V4a2 2 0 00-2-2H7zm0 2h6v12H7V4zm3 9a1 1 0 100 2 1 1 0 000-2z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          </div>
        </div>
        {error ? <div className="border-t border-red-100 bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div> : null}
        {notice ? <div className="border-t border-emerald-100 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{notice}</div> : null}
      </header>

      {/* ── 3-col layout ─────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto bg-[radial-gradient(circle_at_top_left,_#e6f4ef_0%,_#f3f6fb_32%,_#f9fbff_100%)] p-3 lg:flex-row lg:gap-6 lg:overflow-hidden lg:p-6">
        {/* LEFT PANEL */}
        <aside className="order-1 flex max-h-[42dvh] w-full flex-none flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_22px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:order-none lg:max-h-none lg:w-[320px]">
          <div className="flex-1 overflow-y-auto px-5 py-5">
            {/* Add Content */}
            <div className="mb-4">
              <button
                type="button"
                onClick={() => setAddContentExpanded((v) => !v)}
                className="flex w-full items-center justify-between text-base font-semibold text-slate-950"
              >
                Add Content
                <svg viewBox="0 0 20 20" className={["h-4 w-4 transition-transform", addContentExpanded ? "rotate-180" : ""].join(" ")} fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {addContentExpanded ? (
                <div className="mt-3 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    {BLOCK_CHOICES.map((choice) => (
                      <button
                        key={choice.type}
                        type="button"
                        onClick={() => handleInsertBlock(choice.type, insertAfterIndex ?? undefined)}
                        className="flex min-h-[58px] items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-800"
                      >
                        <BlockTypeIcon type={choice.type} />
                        {choice.label}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
                    <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Premade Sections</p>
                    <div className="mt-2 space-y-1.5">
                      {PREMADE_SECTION_CHOICES.map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => handleInsertPremadeSection(preset.id)}
                          className="w-full rounded-lg border border-slate-200 bg-white px-2 py-2 text-left text-[11px] hover:border-emerald-300 hover:bg-emerald-50"
                        >
                          <p className="font-semibold text-slate-700">{preset.label}</p>
                          <p className="text-slate-500">{preset.description}</p>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {/* Merge Fields */}
            <div>
              <button
                type="button"
                onClick={() => setMergeFieldsExpanded((v) => !v)}
                className="flex w-full items-center justify-between text-base font-semibold text-slate-950"
              >
                Merge Fields
                <svg viewBox="0 0 20 20" className={["h-4 w-4 transition-transform", mergeFieldsExpanded ? "rotate-180" : ""].join(" ")} fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {mergeFieldsExpanded ? (
                <div className="mt-3">
                  <input
                    value={mergeSearch}
                    onChange={(e) => setMergeSearch(e.target.value)}
                    placeholder="Search fields…"
                    className="h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none"
                  />
                  <div className="mt-3 grid grid-cols-3 gap-1.5">
                    {["{first}", "{last}", "{name}", "{amount}", "{giftDate}", "{totalGiving}"].map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => insertMergeToken(token)}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-left font-mono text-[11px] font-semibold text-emerald-800 hover:bg-emerald-100"
                      >
                        {token}
                      </button>
                    ))}
                  </div>
                  <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Detected Fields</p>
                      <span className={[
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        unknownMergeTokens.length ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-800",
                      ].join(" ")}
                      >
                        {unknownMergeTokens.length ? "Review" : "Known"}
                      </span>
                    </div>
                    {detectedMergeTokens.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {detectedMergeTokens.map((token) => {
                          const known = knownMergeTokens.has(normalizeMergeTokenLabel(token));
                          const display = mergeTokenDisplay(token);
                          return (
                            <button
                              key={token}
                              type="button"
                              onMouseEnter={() => void loadMergeLinePreview(token)}
                              onFocus={() => void loadMergeLinePreview(token)}
                              className={[
                                "rounded border px-2 py-1 font-mono text-[11px] font-semibold",
                                known ? "border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100" : "border-amber-300 bg-amber-50 text-amber-800",
                              ].join(" ")}
                            >
                              {display}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-slate-500">No merge fields detected yet.</p>
                    )}
                    {mergeLinePreviewToken ? (
                      <div className="mt-3 rounded-md border border-slate-200 bg-white p-2">
                        <p className="text-[11px] font-semibold text-slate-700">Line preview for <span className="font-mono">{mergeTokenDisplay(mergeLinePreviewToken)}</span></p>
                        {mergeLinePreviewLoading ? <p className="mt-1 text-[11px] text-slate-500">Loading live examples...</p> : null}
                        {mergeLinePreviewError ? <p className="mt-1 text-[11px] text-red-700">{mergeLinePreviewError}</p> : null}
                        {!mergeLinePreviewLoading && !mergeLinePreviewError && mergeLinePreview?.items.length === 0 ? <p className="mt-1 text-[11px] text-slate-500">No constituents available for preview.</p> : null}
                        {!mergeLinePreviewLoading && mergeLinePreview?.items.length ? (
                          <div className="mt-2 space-y-2">
                            {mergeLinePreview.items.map((item) => (
                              <div key={item.constituentId} className="rounded border border-slate-100 bg-slate-50 px-2 py-1.5">
                                <p className="text-[11px] font-semibold text-slate-600">{item.recipientName}</p>
                                <p className="mt-0.5 text-xs text-slate-800">{item.renderedLine || "(blank after merge)"}</p>
                                {item.warnings?.length ? <p className="mt-1 text-[11px] text-amber-700">{item.warnings.join(" ")}</p> : null}
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                  <div className="mt-3 space-y-2">
                    {filteredMergeGroups.map((group) => {
                      const collapsed = collapsedMergeGroups.has(group.key);
                      return (
                        <div key={group.key}>
                          <button
                            type="button"
                            onClick={() => toggleMergeGroup(group.key)}
                            className="flex w-full items-center justify-between text-[11px] font-semibold text-slate-600"
                          >
                            <span>{group.label}</span>
                            <svg viewBox="0 0 20 20" className={["h-3.5 w-3.5 transition-transform", collapsed ? "" : "rotate-180"].join(" ")} fill="currentColor">
                              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                          {!collapsed ? (
                            <div className="mt-1.5 space-y-1">
                              {group.fields.map((field) => (
                                <button
                                  key={field.token}
                                  type="button"
                                  disabled={!group.available}
                                  onClick={() => insertMergeToken(field.token)}
                                  title={field.description}
                                  className="w-full truncate rounded-md border border-slate-200 bg-white px-2 py-1 text-left text-[11px] font-mono text-slate-700 hover:bg-emerald-50 hover:border-emerald-200 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                                >
                                  {field.token}
                                </button>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                    {filteredMergeGroups.length === 0 ? (
                      <p className="text-[11px] text-slate-400">No fields found.</p>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
          {/* Footer */}
          <div className="border-t border-slate-200 px-3 py-3">
            <p className="text-[11px] font-semibold text-slate-500">Need help?</p>
            <Link href="/help" className="mt-1 block text-[11px] text-emerald-700 hover:underline">View Help Center</Link>
            <Link href="/oyama-email" className="mt-0.5 block text-[11px] text-slate-500 hover:underline">← Back to Templates</Link>
          </div>
        </aside>

        {/* CANVAS */}
        <main className="order-2 flex min-h-[60dvh] flex-1 flex-col overflow-auto rounded-2xl border border-slate-200/90 bg-[linear-gradient(180deg,#f8fbff_0%,#f2f8f5_100%)] shadow-[0_20px_45px_rgba(15,23,42,0.08)] lg:order-none lg:min-h-0">
          <div
            className="mx-auto my-4 w-full px-3 sm:my-8 sm:px-6 lg:my-10 lg:px-10"
            style={{ maxWidth: activeTab === "mobilePreview" ? 480 : canvasWidth + 160 }}
          >
            <div
              style={{ ...(scaledStyle || {}), width: `min(100%, ${canvasWidth}px)`, maxWidth: "100%", margin: "0 auto" }}
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_50px_rgba(15,23,42,0.12)]"
            >
              {draft.template.blocks.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-3 px-8 py-16 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg viewBox="0 0 24 24" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                    </svg>
                  </div>
                  <p className="text-sm font-medium text-slate-500">No blocks yet</p>
                  <p className="text-xs text-slate-400">Choose a block type from the left panel.</p>
                </div>
              ) : (
                <>
                  {draft.template.blocks.map((block, index) => {
                    const isSelected = selectedBlockId === block.id;
                    return (
                      <div key={block.id}>
                        <div
                          className="group relative h-1 hover:h-7 transition-all"
                          onMouseEnter={() => setInsertAfterIndex(index - 1)}
                          onMouseLeave={() => setInsertAfterIndex(null)}
                        >
                          {insertAfterIndex === index - 1 ? (
                            <div className="absolute inset-x-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                              <div className="flex-1 border-t-2 border-dashed border-emerald-400" />
                              <span className="rounded-full bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">+ Insert</span>
                              <div className="flex-1 border-t-2 border-dashed border-emerald-400" />
                            </div>
                          ) : null}
                        </div>
                        <article
                          draggable={!isSelected}
                          onClick={() => {
                            setSelectedBlockId(block.id);
                            setBlockActionMenuFor(null);
                          }}
                          onDoubleClick={() => {
                            setSelectedBlockId(block.id);
                            setBlockInspectorModalOpen(true);
                          }}
                          onDragStart={(event) => handleBlockDragStart(event, block.id)}
                          onDragOver={(event) => handleBlockDragOver(event, block.id)}
                          onDrop={(event) => handleBlockDrop(event, block.id)}
                          onDragEnd={handleBlockDragEnd}
                          className={["relative mx-2 my-3 cursor-pointer rounded-2xl border transition-all sm:mx-5 sm:my-4",
                            isSelected ? "border-emerald-300 bg-emerald-50/30 shadow-[0_14px_26px_rgba(5,150,105,0.12)]" : "border-transparent bg-white hover:border-slate-200 hover:bg-slate-50/70",
                            dragOverBlockId === block.id ? "ring-2 ring-emerald-400 ring-inset" : "",
                            draggingBlockId === block.id ? "opacity-60" : "",
                          ].join(" ")}
                        >
                          {isSelected ? (
                            <div className="absolute right-2 top-2 z-10 flex max-w-[calc(100%-1rem)] items-center overflow-visible rounded-xl border border-slate-200 bg-white shadow-md sm:right-4 sm:top-3">
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); moveBlock(block.id, -1); }}
                                disabled={index === 0}
                                title="Move up"
                                className="flex h-9 w-9 items-center justify-center border-r border-slate-100 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); moveBlock(block.id, 1); }}
                                disabled={index === draft.template.blocks.length - 1}
                                title="Move down"
                                className="flex h-9 w-9 items-center justify-center border-r border-slate-100 text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-30"
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedBlockId(block.id);
                                  setBlockActionMenuFor((current) => (current === block.id ? null : block.id));
                                }}
                                title="Block settings"
                                className="flex h-9 w-9 items-center justify-center text-slate-600 hover:bg-slate-50"
                              >
                                <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                                  <path fillRule="evenodd" d="M11.49 3.17a1 1 0 00-1.98 0l-.066.396a1 1 0 01-1.256.8l-.389-.118a1 1 0 00-1.22.7l-.14.39a1 1 0 01-1.205.624l-.4-.1a1 1 0 00-1.145.56l-.49.98a1 1 0 00.3 1.244l.328.241a1 1 0 010 1.62l-.328.24a1 1 0 00-.3 1.245l.49.98a1 1 0 001.145.56l.4-.1a1 1 0 011.204.623l.141.39a1 1 0 001.22.7l.39-.117a1 1 0 011.255.8l.066.396a1 1 0 001.98 0l.066-.396a1 1 0 011.256-.8l.389.118a1 1 0 001.22-.7l.14-.39a1 1 0 011.205-.624l.4.1a1 1 0 001.145-.56l.49-.98a1 1 0 00-.3-1.244l-.328-.241a1 1 0 010-1.62l.328-.24a1 1 0 00.3-1.245l-.49-.98a1 1 0 00-1.145-.56l-.4.1a1 1 0 01-1.204-.623l-.141-.39a1 1 0 00-1.22-.7l-.39.117a1 1 0 01-1.255-.8l-.066-.396zM10.5 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                                </svg>
                              </button>
                              {blockActionMenuFor === block.id ? (
                                <div className="absolute right-0 top-11 z-20 min-w-[196px] rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                  <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                                    {blockDisplayLabel(block)} Settings
                                  </p>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      setSelectedBlockId(block.id);
                                      setBlockInspectorModalOpen(true);
                                      setBlockActionMenuFor(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-emerald-50"
                                  >
                                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-emerald-700" fill="currentColor">
                                      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2H3V4zm0 5h14v7a1 1 0 01-1 1H4a1 1 0 01-1-1V9zm3 2a1 1 0 100 2h4a1 1 0 100-2H6z" />
                                    </svg>
                                    Advanced Editor
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      duplicateBlock(block.id);
                                      setBlockActionMenuFor(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <svg viewBox="0 0 20 20" className="h-4 w-4 text-slate-600" fill="currentColor">
                                      <path d="M7 2a2 2 0 00-2 2v9a2 2 0 002 2h9a2 2 0 002-2V4a2 2 0 00-2-2H7z" />
                                      <path d="M3 6a2 2 0 012-2v10a2 2 0 002 2h8a2 2 0 01-2 2H5a2 2 0 01-2-2V6z" />
                                    </svg>
                                    Duplicate Block
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      deleteBlock(block.id);
                                      setBlockActionMenuFor(null);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                                      <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    Delete Block
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                          <div className="px-8 py-7" style={templateTextStyle}>
                            <CanvasBlockPreview block={block} />
                            {isSelected ? (
                              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200/70 bg-emerald-50/60 px-4 py-3 text-xs text-emerald-900">
                                <p className="font-semibold">Final Preview Mode active for this block.</p>
                                <button
                                  type="button"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setBlockInspectorModalOpen(true);
                                  }}
                                  className="inline-flex h-8 items-center rounded-md border border-emerald-300 bg-white px-3 text-xs font-semibold text-emerald-800 hover:bg-emerald-50"
                                >
                                  Open Advanced Editor
                                </button>
                              </div>
                            ) : null}
                          </div>
                        </article>
                      </div>
                    );
                  })}
                  <div
                    className="flex cursor-pointer items-center gap-2 border-t border-dashed border-slate-200 px-6 py-3 hover:bg-slate-50 transition-colors"
                    onClick={() => setAddContentExpanded(true)}
                  >
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-200 text-slate-500">
                      <svg viewBox="0 0 20 20" className="h-4 w-4" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <span className="text-xs font-medium text-slate-400">Add a block</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </main>

        {/* RIGHT PANEL */}
        <aside className="order-3 flex max-h-[46dvh] w-full flex-none flex-col overflow-hidden rounded-2xl border border-slate-200/90 bg-white/95 shadow-[0_22px_45px_rgba(15,23,42,0.08)] backdrop-blur-sm lg:order-none lg:max-h-none lg:w-[352px]">
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <p className="text-base font-semibold text-slate-950">Email Settings</p>
            {builderWarnings.length > 0 ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-900">Validation Warnings</p>
                <ul className="mt-1 space-y-1">
                  {builderWarnings.slice(0, 8).map((warning) => (
                    <li key={warning} className="text-[11px] leading-4 text-amber-900">• {warning}</li>
                  ))}
                </ul>
                {builderWarnings.length > 8 ? (
                  <p className="mt-1 text-[10px] text-amber-800">+{builderWarnings.length - 8} more warnings</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-800">
                No active validation warnings.
              </div>
            )}
            <div className="mt-4 rounded-xl border border-sky-200 bg-sky-50/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-sky-950">AI Writing Studio</p>
                    <InfoTooltip label="About AI Writing Studio" align="left">
                      Stream longer draft copy into the builder, then apply it only after review. Use subject and preview targets for inbox copy, or body targets for richer donor-facing content.
                    </InfoTooltip>
                  </div>
                  <p className="mt-1 text-[11px] text-sky-900/80">Stream longer copy for subject lines, preview text, or body content.</p>
                </div>
                {writingModelUsed ? <span className="text-[10px] font-semibold uppercase tracking-wide text-sky-700">{writingModelUsed}</span> : null}
              </div>
              <div className="mt-3">
                <WorkspaceHint title="Review Before Apply" tone="sky">
                  Streamed copy stays separate from the live template until you apply it. Generate first, inspect the output, then decide whether it belongs in the subject, preview text, or body.
                </WorkspaceHint>
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Target
                  <select value={writingTarget} onChange={(event) => setWritingTarget((event.target.value as WritingTarget) || "selectedBlock")} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-xs text-slate-800">
                    <option value="selectedBlock">Replace selected text block</option>
                    <option value="newBlock">Insert new text block</option>
                    <option value="subject">Rewrite subject line</option>
                    <option value="previewText">Rewrite preview text</option>
                  </select>
                </label>
                <label className="block text-[11px] font-semibold text-slate-700">
                  Tone
                  <select value={writingTone} onChange={(event) => setWritingTone((event.target.value as "warm" | "urgent" | "celebratory" | "informative") || "warm")} className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-xs text-slate-800">
                    <option value="warm">Warm</option>
                    <option value="informative">Informative</option>
                    <option value="celebratory">Celebratory</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
              </div>
              <label className="mt-2 block text-[11px] font-semibold text-slate-700">
                Writing Brief
                <textarea
                  value={writingPrompt}
                  onChange={(event) => setWritingPrompt(event.target.value)}
                  rows={4}
                  placeholder="Example: Write a longer donor thank-you paragraph that references monthly impact, keeps the tone human, and ends by inviting prayer."
                  className="mt-1 w-full rounded-md border border-slate-300 px-2.5 py-2 text-xs text-slate-800"
                />
              </label>
              {selectedBlock?.type === "text" && writingTarget === "selectedBlock" ? (
                <p className="mt-2 text-[11px] text-slate-600">Selected block content will be replaced with the streamed draft.</p>
              ) : null}
              {writingTarget === "selectedBlock" && selectedBlock?.type !== "text" ? (
                <p className="mt-2 text-[11px] text-amber-800">Selected block is not a text block. Switch target to “Insert new text block” or select a text block.</p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => void runWritingStream()} disabled={writingBusy} className="rounded-md border border-sky-700 bg-sky-700 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-600 disabled:opacity-60">
                  {writingBusy ? "Streaming..." : "Stream Draft"}
                </button>
                <button type="button" onClick={applyWritingOutput} disabled={!writingOutput.trim() || writingBusy} className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
                  Apply Output
                </button>
              </div>
              {writingError ? <p className="mt-2 text-[11px] text-red-700">{writingError}</p> : null}
              <div className="mt-3 rounded-lg border border-sky-100 bg-white p-2.5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-sky-800">Stream Output</p>
                <div className="mt-2 max-h-44 overflow-auto whitespace-pre-wrap text-xs leading-5 text-slate-700">
                  {writingOutput || "Streamed copy will appear here."}
                </div>
              </div>
            </div>
            <label className="mt-3 block">
              <span className="text-xs font-semibold text-slate-700">Subject Line <span className="text-red-500">*</span></span>
              <input
                value={draft.subject}
                onChange={(e) => setDraftField("subject", e.target.value)}
                onFocus={() => setInsertTarget({ scope: "template", field: "subject" })}
                placeholder="Your email subject…"
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs text-slate-800 focus:border-emerald-400 focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-slate-500">{draft.subject.length}/78 recommended</span>
            </label>
            <label className="mt-2 block">
              <span className="text-xs font-semibold text-slate-700">Preview Text</span>
              <textarea
                value={draft.previewText}
                onChange={(e) => setDraftField("previewText", e.target.value)}
                onFocus={() => setInsertTarget({ scope: "template", field: "previewText" })}
                placeholder="Short preview shown in inbox…"
                rows={2}
                className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-400 focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-slate-500">{draft.previewText.length}/120 recommended</span>
            </label>
            <label className="mt-2 block">
              <span className="text-xs font-semibold text-slate-700">From Name</span>
              <input
                value={draft.fromName}
                onChange={(e) => setDraftField("fromName", e.target.value)}
                onFocus={() => setInsertTarget({ scope: "template", field: "fromName" })}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2.5 text-xs text-slate-800 focus:border-emerald-400 focus:outline-none"
              />
              <span className="mt-1 block text-[11px] text-slate-500">Default format is User Name - Organization Name unless you customize it.</span>
            </label>
            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
              <p className="text-xs font-semibold text-slate-700">Global SMTP Sender (Read Only)</p>
              <p className="mt-1 text-[11px] text-slate-600">From Email: {smtpDefaults.fromEmail || "Not configured"}</p>
              <p className="text-[11px] text-slate-600">Reply-To: {smtpDefaults.replyToEmail || "Not configured"}</p>
              <Link href="/settings/organization" className="mt-1 inline-block text-[11px] font-semibold text-emerald-700 hover:underline">
                Update in Organization Settings
              </Link>
            </div>
            <label className="mt-2 block">
              <span className="text-xs font-semibold text-slate-700">Preference Category</span>
              <select
                value={draft.preferenceCategory}
                onChange={(e) => setDraftField("preferenceCategory", e.target.value)}
                className="mt-1 h-8 w-full rounded-lg border border-slate-200 px-2 text-xs text-slate-800 focus:border-emerald-400 focus:outline-none"
              >
                {PREFERENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>

            {/* Background Color */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold text-slate-700">Background Color</p>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  value={draft.template.backgroundColor}
                  onChange={(e) => setTemplateDocument({ ...draftRef.current.template, backgroundColor: e.target.value })}
                  className="h-8 w-10 cursor-pointer rounded border border-slate-200 bg-white p-0.5"
                />
                <input
                  value={draft.template.backgroundColor}
                  onChange={(e) => setTemplateDocument({ ...draftRef.current.template, backgroundColor: e.target.value })}
                  placeholder="#ffffff"
                  className="h-8 flex-1 rounded-lg border border-slate-200 px-2 font-mono text-xs text-slate-800 focus:border-emerald-400 focus:outline-none"
                />
              </div>
            </div>

            {/* Compliance toggles */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Compliance</p>
              <ToggleSwitch
                label="Include Unsubscribe Link"
                checked={draft.settings.includeUnsubscribeLink}
                onChange={(v) => setDraftField("settings", { ...draft.settings, includeUnsubscribeLink: v })}
              />
              <ToggleSwitch
                label="Include Physical Address"
                checked={draft.settings.includePhysicalAddress}
                onChange={(v) => setDraftField("settings", { ...draft.settings, includePhysicalAddress: v })}
              />
              <ToggleSwitch
                label="Generate Plain Text"
                checked={draft.settings.enablePlainTextVersion}
                onChange={(v) => setDraftField("settings", { ...draft.settings, enablePlainTextVersion: v })}
              />
              {draft.settings.includePhysicalAddress ? (
                <textarea
                  value={draft.settings.physicalAddress}
                  onChange={(e) => setDraftField("settings", { ...draft.settings, physicalAddress: e.target.value })}
                  onFocus={() => setInsertTarget({ scope: "template", field: "physicalAddress" })}
                  rows={2}
                  placeholder="123 Main St, City, ST 00000"
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-400 focus:outline-none"
                />
              ) : null}
            </div>

            {/* Branding & Footer */}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setBrandingExpanded((v) => !v)}
                className="flex w-full items-center justify-between text-xs font-semibold uppercase tracking-wider text-slate-500"
              >
                Branding &amp; Footer
                <svg viewBox="0 0 20 20" className={["h-4 w-4 transition-transform", brandingExpanded ? "rotate-180" : ""].join(" ")} fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 011.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
              {brandingExpanded ? (
                <textarea
                  value={draft.settings.footerBrandingText}
                  onChange={(e) => setDraftField("settings", { ...draft.settings, footerBrandingText: e.target.value })}
                  onFocus={() => setInsertTarget({ scope: "template", field: "footerBrandingText" })}
                  rows={3}
                  placeholder="Footer / branding text…"
                  className="mt-2 w-full resize-none rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-emerald-400 focus:outline-none"
                />
              ) : null}
            </div>

            {/* Block Inspector */}
            {selectedBlock ? (
              <div className="mt-4 border-t border-slate-100 pt-4">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Selected Block</p>
                  <p className="mt-1 text-xs font-medium text-slate-700">{blockDisplayLabel(selectedBlock)}</p>
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white px-3 py-2" style={templateTextStyle}>
                    <CanvasBlockPreview block={selectedBlock} />
                  </div>
                  <p className="mt-3 text-[11px] text-slate-500">Most content editing now happens inline on the canvas after you click a block.</p>
                  <button
                    type="button"
                    onClick={() => setBlockInspectorModalOpen(true)}
                    className="mt-3 inline-flex h-8 items-center rounded-md border border-emerald-600 bg-emerald-600 px-3 text-xs font-semibold text-white hover:bg-emerald-500"
                  >
                    Open Advanced Editor
                  </button>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-400">
                Click a block to inspect &amp; edit it
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* Block Inspector Modal */}
      {blockInspectorModalOpen && selectedBlock ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setBlockInspectorModalOpen(false)}
        >
          <div
            className="flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-emerald-700 px-6 py-5 text-white">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Advanced Block Settings</p>
                  <p className="text-xs text-emerald-100">Type: {blockDisplayLabel(selectedBlock)} • Position {selectedBlockIndex + 1} of {draft.template.blocks.length}</p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => moveBlock(selectedBlock.id, -1)}
                    disabled={selectedBlockIndex <= 0}
                    className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40"
                  >
                    Move Up
                  </button>
                  <button
                    type="button"
                    onClick={() => moveBlock(selectedBlock.id, 1)}
                    disabled={selectedBlockIndex < 0 || selectedBlockIndex >= draft.template.blocks.length - 1}
                    className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20 disabled:opacity-40"
                  >
                    Move Down
                  </button>
                  <button
                    type="button"
                    onClick={() => duplicateBlock(selectedBlock.id)}
                    className="rounded-md border border-white/30 bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20"
                  >
                    Duplicate
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      deleteBlock(selectedBlock.id);
                      setBlockInspectorModalOpen(false);
                    }}
                    className="rounded-md border border-red-200/70 bg-red-500/85 px-2 py-1 text-xs font-semibold text-white hover:bg-red-500"
                  >
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setBlockInspectorModalOpen(false)}
                    className="rounded p-1 text-emerald-100 hover:bg-white/20"
                  >
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setInspectorTab("content")}
                  className={["rounded-full px-3 py-1 text-xs font-semibold transition-colors", inspectorTab === "content" ? "bg-white text-emerald-800" : "bg-white/15 text-white hover:bg-white/25"].join(" ")}
                >
                  Content
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("style")}
                  className={["rounded-full px-3 py-1 text-xs font-semibold transition-colors", inspectorTab === "style" ? "bg-white text-emerald-800" : "bg-white/15 text-white hover:bg-white/25"].join(" ")}
                >
                  Style
                </button>
                <button
                  type="button"
                  onClick={() => setInspectorTab("advanced")}
                  className={["rounded-full px-3 py-1 text-xs font-semibold transition-colors", inspectorTab === "advanced" ? "bg-white text-emerald-800" : "bg-white/15 text-white hover:bg-white/25"].join(" ")}
                >
                  Advanced
                </button>
              </div>
            </div>
            <div className="grid min-h-0 flex-1 grid-cols-12">
              <div className="col-span-12 border-b border-slate-200 bg-slate-50/60 p-4 md:col-span-5 md:border-b-0 md:border-r">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Block Preview</p>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-4 shadow-sm" style={templateTextStyle}>
                  <CanvasBlockPreview block={selectedBlock} />
                </div>
                <p className="mt-3 text-[11px] text-slate-500">Tip: Drag blocks in the canvas to reorder. Double-click any block to reopen this modal.</p>
              </div>
              <div className="col-span-12 min-h-0 overflow-auto p-4 md:col-span-7">
                {inspectorTab === "content" ? (
                  <BlockInspector
                    block={selectedBlock}
                    template={draft.template}
                    branding={globalBranding}
                    mergeFieldGroups={mergeFieldGroups}
                    onChange={(patch) => updateBlock(selectedBlock.id, (current) => ({ ...current, ...patch }))}
                    onSetInsertTarget={(field) => setInsertTarget({ scope: "block", blockId: selectedBlock.id, field })}
                    onUploadImage={(file) => void uploadImage(selectedBlock.id, file)}
                    onGenerateAiSmartHtml={(description, tone, instruction, objective) => void generateAiSmartHtml(selectedBlock.id, description, tone, instruction, objective)}
                    aiSmartBusy={aiSmartBusyBlockId === selectedBlock.id}
                    aiSmartError={aiSmartBusyBlockId === selectedBlock.id ? aiSmartError : null}
                    uploadingImage={uploadingImage}
                    canUpload
                    className="mt-0"
                  />
                ) : null}

                {inspectorTab === "style" ? (
                  <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Email Typography Defaults</p>
                    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                      <p className="text-[11px] text-emerald-900">Use global branding to sync font, canvas width, sender identity, footer, and new header defaults.</p>
                      <button
                        type="button"
                        onClick={() => {
                          const next = draftFromBranding(globalBranding);
                          setTemplateDocument({
                            ...draftRef.current.template,
                            backgroundColor: next.template.backgroundColor,
                            contentWidth: next.template.contentWidth,
                            fontFamily: next.template.fontFamily,
                            textColor: draftRef.current.template.textColor,
                            linkColor: draftRef.current.template.linkColor,
                            baseFontSize: draftRef.current.template.baseFontSize,
                            lineHeight: draftRef.current.template.lineHeight,
                          });
                          if (!draftRef.current.fromName.trim()) {
                            const orgName = globalBranding.organizationDisplayName || globalBranding.legalOrganizationName || next.fromName;
                            setDraftField("fromName", composeFromName(currentUserDisplayName, orgName));
                          }
                          setDraftField("settings", {
                            ...draftRef.current.settings,
                            physicalAddress: next.settings.physicalAddress,
                            footerBrandingText: next.settings.footerBrandingText,
                          });
                        }}
                        className="h-7 rounded-md border border-emerald-600 bg-emerald-600 px-2.5 text-[11px] font-semibold text-white hover:bg-emerald-500"
                      >
                        Apply Global Branding
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs font-semibold text-slate-700">
                        Font Family
                        <select
                          value={draft.template.fontFamily}
                          onChange={(e) => setTemplateDocument({ ...draftRef.current.template, fontFamily: e.target.value })}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800"
                        >
                          {FONT_FAMILY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Base Font Size
                        <input
                          type="number"
                          min={12}
                          max={22}
                          value={draft.template.baseFontSize}
                          onChange={(e) => setTemplateDocument({ ...draftRef.current.template, baseFontSize: clampNumber(Number(e.target.value) || 16, 12, 22) })}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Line Height
                        <input
                          type="number"
                          min={1.2}
                          max={2.2}
                          step={0.1}
                          value={draft.template.lineHeight}
                          onChange={(e) => setTemplateDocument({ ...draftRef.current.template, lineHeight: clampNumber(Number(e.target.value) || 1.6, 1.2, 2.2) })}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Canvas Width
                        <input
                          type="number"
                          min={420}
                          max={760}
                          value={draft.template.contentWidth}
                          onChange={(e) => setTemplateDocument({ ...draftRef.current.template, contentWidth: clampNumber(Number(e.target.value) || 600, 420, 760) })}
                          className="mt-1 h-9 w-full rounded-lg border border-slate-300 bg-white px-2 text-xs text-slate-800"
                        />
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Body Text Color
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="color"
                            value={draft.template.textColor}
                            onChange={(e) => setTemplateDocument({ ...draftRef.current.template, textColor: e.target.value })}
                            className="h-9 w-11 rounded border border-slate-300 bg-white p-0.5"
                          />
                          <input
                            value={draft.template.textColor}
                            onChange={(e) => setTemplateDocument({ ...draftRef.current.template, textColor: e.target.value })}
                            className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs text-slate-800"
                          />
                        </div>
                      </label>
                      <label className="block text-xs font-semibold text-slate-700">
                        Link Color
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="color"
                            value={draft.template.linkColor}
                            onChange={(e) => setTemplateDocument({ ...draftRef.current.template, linkColor: e.target.value })}
                            className="h-9 w-11 rounded border border-slate-300 bg-white p-0.5"
                          />
                          <input
                            value={draft.template.linkColor}
                            onChange={(e) => setTemplateDocument({ ...draftRef.current.template, linkColor: e.target.value })}
                            className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2 font-mono text-xs text-slate-800"
                          />
                        </div>
                      </label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setTemplateDocument({ ...draftRef.current.template, ...DEFAULT_TEMPLATE, blocks: draftRef.current.template.blocks, backgroundColor: draftRef.current.template.backgroundColor })}
                      className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                    >
                      Reset Typography Defaults
                    </button>
                  </div>
                ) : null}

                {inspectorTab === "advanced" ? (
                  <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Advanced Block Info</p>
                    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
                      <p><strong>ID:</strong> {selectedBlock.id}</p>
                      <p><strong>Type:</strong> {blockDisplayLabel(selectedBlock)}</p>
                    </div>
                    <p className="text-[11px] text-slate-500">For text blocks, use the Content tab rich editor. Raw HTML is intentionally hidden for non-technical users.</p>
                    {selectedBlock.type === "html" ? (
                      <label className="block text-xs font-semibold text-slate-700">
                        HTML (Advanced)
                        <textarea
                          value={selectedBlock.html || ""}
                          onChange={(event) => updateBlock(selectedBlock.id, (current) => ({ ...current, html: event.target.value }))}
                          onFocus={() => setInsertTarget({ scope: "block", blockId: selectedBlock.id, field: "html" })}
                          rows={10}
                          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 font-mono text-xs text-slate-800"
                        />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Preview Modal */}
      {previewModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md"
          onClick={() => setPreviewModalOpen(false)}
        >
          <div
            className="mx-2 flex h-[94dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] sm:mx-4 sm:h-[92vh] sm:rounded-[28px]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-800">Recipient Email Preview</p>
                  <InfoTooltip label="About preview recipients">
                    Select a recipient to lock preview output to one donor record. Use email mode to preview with a specific email address.
                  </InfoTooltip>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void refreshServerPreview()}
                    className="rounded-md border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                  >
                    {previewRefreshing ? "Refreshing..." : "Refresh"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void sendPreviewToMyself()}
                    disabled={sendingPreviewToSelf || previewRefreshing}
                    className="rounded-md border border-emerald-700 bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
                  >
                    {sendingPreviewToSelf ? "Sending..." : "Send to Myself"}
                  </button>
                  <button type="button" onClick={() => setPreviewModalOpen(false)} title="Close preview" className="rounded p-1 text-slate-500 hover:bg-slate-100">
                    <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={previewMode}
                  onChange={(event) => setPreviewMode((event.target.value as "random" | "selected" | "email") || "selected")}
                  title="Preview recipient mode"
                  aria-label="Preview recipient mode"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  <option value="selected">Selected donor preview</option>
                  <option value="email">Use recipient email</option>
                </select>
                {previewMode === "selected" ? (
                  <>
                    <input
                      value={previewRecipientSearch}
                      onChange={(event) => setPreviewRecipientSearch(event.target.value)}
                      placeholder="Search recipient"
                      title="Search preview recipient"
                      aria-label="Search preview recipient"
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 sm:w-44"
                    />
                    <select
                      value={selectedPreviewRecipientId}
                      onChange={(event) => setSelectedPreviewRecipientId(event.target.value)}
                      title="Select preview recipient"
                      aria-label="Select preview recipient"
                      className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 sm:max-w-[280px]"
                    >
                      <option value="">Choose a donor</option>
                      {filteredPreviewRecipients.map((row) => (
                        <option key={row.id} value={row.id}>
                          {row.displayName || row.organizationName || [row.firstName, row.lastName].filter(Boolean).join(" ") || row.email || row.id}
                          {row.email ? ` (${row.email})` : ""}
                        </option>
                      ))}
                    </select>
                  </>
                ) : null}
                {previewMode === "email" ? (
                  <input
                    value={testRecipientEmail}
                    onChange={(event) => setTestRecipientEmail(event.target.value)}
                    placeholder="recipient@example.org"
                    title="Preview email address"
                    aria-label="Preview email address"
                    className="w-full rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 sm:w-52"
                  />
                ) : null}
                <select
                  value={previewPanelMode}
                  onChange={(event) => setPreviewPanelMode((event.target.value as PreviewPanelMode) || "split")}
                  title="Preview panel mode"
                  aria-label="Preview panel mode"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  <option value="visual">Visual only</option>
                  <option value="split">Visual + text</option>
                  <option value="text">Text only</option>
                </select>
                <select
                  value={previewViewport}
                  onChange={(event) => setPreviewViewport((event.target.value as PreviewViewport) || "desktop")}
                  title="Preview viewport width"
                  aria-label="Preview viewport width"
                  className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700"
                >
                  <option value="desktop">Desktop width</option>
                  <option value="tablet">Tablet width</option>
                  <option value="mobile">Mobile width</option>
                </select>
                <label className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-700">
                  <input
                    type="checkbox"
                    checked={previewAutoRefresh}
                    onChange={(event) => setPreviewAutoRefresh(event.target.checked)}
                  />
                  Auto refresh
                </label>
                {previewRecipientLabel ? <span className="text-xs text-slate-500">Recipient: {previewRecipientLabel}</span> : null}
                {previewMode === "selected" && selectedPreviewRecipientId && selectedPreviewRecipient ? (
                  <span className="text-xs text-slate-500">Selected: {selectedPreviewRecipient.displayName || [selectedPreviewRecipient.firstName, selectedPreviewRecipient.lastName].filter(Boolean).join(" ") || selectedPreviewRecipient.email || selectedPreviewRecipient.id}</span>
                ) : null}
                {previewLastUpdatedAt ? <span className="text-xs text-slate-500">Updated {formatLastSaved(previewLastUpdatedAt)}</span> : null}
                {previewDeltaSummary ? <span className="text-xs text-slate-500">{previewDeltaSummary}</span> : null}
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {serverPreviewWarnings.length > 0 ? (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">Preview Warnings</p>
                  <ul className="mt-2 space-y-1 text-xs text-amber-900">
                    {serverPreviewWarnings.map((warning) => <li key={warning}>{warning}</li>)}
                  </ul>
                </div>
              ) : null}
              {serverPreviewHtml || serverPreviewText ? (
                <div className={["grid gap-3", previewPanelMode === "split" ? "md:grid-cols-2" : "grid-cols-1"].join(" ")}>
                  {previewPanelMode !== "text" ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Rendered HTML</p>
                      <div
                        className={[
                          "mx-auto overflow-hidden rounded-lg border border-slate-200 bg-white",
                          previewViewport === "mobile"
                            ? "max-w-[390px]"
                            : previewViewport === "tablet"
                              ? "max-w-[768px]"
                              : "max-w-none",
                        ].join(" ")}
                      >
                        <iframe
                          srcDoc={serverPreviewHtml || "<p></p>"}
                          sandbox="allow-same-origin"
                          className="h-full min-h-[520px] w-full"
                          title="Email preview"
                        />
                      </div>
                    </div>
                  ) : null}
                  {previewPanelMode !== "visual" ? (
                    <div className="rounded-lg border border-slate-200 bg-white p-3">
                      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Plain Text Output</p>
                      <pre className="min-h-[520px] whitespace-pre-wrap break-words rounded border border-slate-100 bg-slate-50 p-3 font-mono text-xs text-slate-700">{serverPreviewText || "No plain-text output yet."}</pre>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="flex h-full min-h-[420px] items-center justify-center text-sm text-slate-500">
                  No server preview available yet. Save the template, then refresh preview.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {/* Plain Text Modal */}
      {plainTextModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md"
          onClick={() => setPlainTextModalOpen(false)}
        >
          <div
            className="flex h-[82vh] w-full max-w-3xl flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/90 px-5 py-3">
              <p className="text-sm font-semibold text-slate-800">Plain Text Version</p>
              <button type="button" onClick={() => setPlainTextModalOpen(false)} className="rounded p-1 text-slate-500 hover:bg-slate-100">
                <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3">
              <div>
                <p className="text-xs font-semibold text-slate-700">Saved text-only override</p>
                <p className="text-[11px] text-slate-500">Leave blank to use the generated plain-text version from the rendered email.</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setDraftField("settings", { ...draft.settings, plainTextOverride: serverPreviewText })}
                  disabled={!serverPreviewText.trim()}
                  className="h-8 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Use Generated
                </button>
                <button
                  type="button"
                  onClick={() => setDraftField("settings", { ...draft.settings, plainTextOverride: "" })}
                  className="h-8 rounded-lg border border-slate-200 px-3 text-[11px] font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Clear Override
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-4">
              <textarea
                value={draft.settings.plainTextOverride ?? ""}
                onChange={(event) => setDraftField("settings", { ...draft.settings, plainTextOverride: event.target.value })}
                placeholder={serverPreviewText || "Save and open Preview to generate a fallback plain-text version."}
                className="h-full w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-3 font-mono text-xs text-slate-700 focus:border-emerald-400 focus:outline-none"
              />
            </div>
          </div>
        </div>
      ) : null}

      {/* Send Test Email Dialog */}
      {testEmailDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md"
          onClick={() => setTestEmailDialogOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">Send Test Email</p>
              <p className="mt-0.5 text-xs text-slate-500">Send a rendered test to an email address.</p>
            </div>
            <div className="px-5 py-4">
              <label className="block text-xs font-semibold text-slate-700">
                Recipient Email
                <input
                  value={testRecipientEmail}
                  onChange={(e) => setTestRecipientEmail(e.target.value)}
                  type="email"
                  placeholder="you@example.com"
                  className="mt-1 h-9 w-full rounded-lg border border-slate-200 px-3 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none"
                />
              </label>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setTestEmailDialogOpen(false)}
                className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void sendTestEmail();
                  setTestEmailDialogOpen(false);
                }}
                disabled={!testRecipientEmail.trim() || saving}
                className="h-8 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                Send
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Save Conflict Modal */}
      {saveConflictModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-md"
          onClick={() => setSaveConflictModal(null)}
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-slate-200 bg-slate-50/90 px-5 py-4">
              <p className="text-sm font-semibold text-slate-800">Confirm Template Overwrite</p>
              <p className="mt-0.5 text-xs text-slate-500">A save conflict was detected to prevent an accidental overwrite.</p>
            </div>
            <div className="space-y-2 px-5 py-4 text-sm text-slate-700">
              <p>{saveConflictModal.message}</p>
              <p className="text-xs text-slate-500">
                Template: {saveConflictModal.templateName || "Unknown template"}
                {saveConflictModal.updatedAt ? ` • Updated ${formatLastSaved(saveConflictModal.updatedAt)}` : ""}
              </p>
              {saveConflictModal.code === "TEMPLATE_STALE_VERSION" ? (
                <p className="text-xs text-amber-700">Another session changed this template after you opened it.</p>
              ) : null}
              {saveConflictModal.code === "TEMPLATE_NAME_CONFLICT" ? (
                <p className="text-xs text-amber-700">A template with this name already exists.</p>
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-5 py-3">
              <button
                type="button"
                onClick={() => setSaveConflictModal(null)}
                className="h-8 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              {saveConflictModal.code === "TEMPLATE_NAME_CONFLICT" ? (
                <button
                  type="button"
                  onClick={() => {
                    setDraft((prev) => ({ ...prev, name: buildCopyTemplateName(prev.name) }));
                    setDirty(true);
                    setError(null);
                    setSaveConflictModal(null);
                    setNotice("Template renamed as a copy. Click Save Draft again to create a new template.");
                  }}
                  className="h-8 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Save as Copy
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  const options: SaveTemplateOptions = saveConflictModal.code === "TEMPLATE_STALE_VERSION"
                    ? { forceOverwrite: true }
                    : { confirmOverwrite: true, overwriteTemplateId: saveConflictModal.templateId };
                  void resolveSaveConflict(options);
                }}
                disabled={saving || autosaving}
                className="h-8 rounded-lg bg-emerald-700 px-4 text-xs font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                Overwrite
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function RichTextEditor({
  value,
  onChange,
  onFocus,
  placeholder,
  linkColor,
  mergeFieldGroups,
  minHeight,
}: {
  value: string;
  onChange: (next: string) => void;
  onFocus?: () => void;
  placeholder?: string;
  linkColor?: string;
  mergeFieldGroups: MergeFieldGroup[];
  minHeight?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [triggerRange, setTriggerRange] = useState<{ from: number; to: number } | null>(null);
  const [floatingToolbar, setFloatingToolbar] = useState<{ visible: boolean; x: number; y: number }>({ visible: false, x: 0, y: 0 });
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergeQuery, setMergeQuery] = useState("");
  const [textColor, setTextColor] = useState(linkColor || "#0f5c3c");
  const minEditorHeight = Math.max(120, minHeight ?? 210);

  const extensions = useMemo(() => [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      link: false,
      underline: false,
    }),
    Underline,
    TextStyle,
    Color.configure({ types: ["textStyle"] }),
    TiptapLink.configure({
      openOnClick: false,
      autolink: true,
      defaultProtocol: "https",
    }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Placeholder.configure({ placeholder: placeholder || "Write your email content..." }),
  ], [placeholder]);

  const closeInlineMenus = useCallback(() => {
    setTriggerRange(null);
    setSlashOpen(false);
    setMergeOpen(false);
  }, []);

  const updateFloatingToolbar = useCallback((nextEditor: Editor) => {
    const container = containerRef.current;
    const selection = nextEditor.state.selection;
    if (!container || selection.empty) {
      setFloatingToolbar({ visible: false, x: 0, y: 0 });
      return;
    }

    try {
      const start = nextEditor.view.coordsAtPos(selection.from);
      const end = nextEditor.view.coordsAtPos(selection.to);
      const containerRect = container.getBoundingClientRect();
      const x = ((start.left + end.right) / 2) - containerRect.left;
      const y = Math.min(start.top, end.top) - containerRect.top - 8;
      setFloatingToolbar({ visible: true, x, y });
    } catch {
      setFloatingToolbar({ visible: false, x: 0, y: 0 });
    }
  }, []);

  const detectInlineTriggers = useCallback((nextEditor: Editor) => {
    const { selection, doc } = nextEditor.state;
    if (!selection.empty) {
      closeInlineMenus();
      return;
    }

    const cursor = selection.from;
    const windowStart = Math.max(0, cursor - 96);
    const textBeforeCaret = doc.textBetween(windowStart, cursor, "\n", "\n");

    const mergeMatch = textBeforeCaret.match(/\{\{([a-zA-Z0-9_.]*)$/);
    if (mergeMatch) {
      setTriggerRange({ from: cursor - mergeMatch[0].length, to: cursor });
      setMergeQuery((mergeMatch[1] || "").trim().toLowerCase());
      setMergeOpen(true);
      setSlashOpen(false);
      return;
    }

    const slashMatch = textBeforeCaret.match(/(?:^|\s)\/([a-zA-Z]*)$/);
    if (slashMatch) {
      const leadingSpace = slashMatch[0].startsWith("/") ? 0 : 1;
      setTriggerRange({ from: cursor - slashMatch[0].length + leadingSpace, to: cursor });
      setSlashQuery((slashMatch[1] || "").trim().toLowerCase());
      setSlashOpen(true);
      setMergeOpen(false);
      return;
    }

    closeInlineMenus();
  }, [closeInlineMenus]);

  const handleEditorActivity = useCallback((nextEditor: Editor) => {
    detectInlineTriggers(nextEditor);
    updateFloatingToolbar(nextEditor);
  }, [detectInlineTriggers, updateFloatingToolbar]);

  const editor = useEditor({
    extensions,
    content: value || "",
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: "oyama-email-prosemirror",
      },
    },
    onFocus: () => {
      onFocus?.();
    },
    onUpdate: ({ editor: nextEditor }) => {
      onChange(nextEditor.getHTML());
      handleEditorActivity(nextEditor);
    },
    onSelectionUpdate: ({ editor: nextEditor }) => {
      handleEditorActivity(nextEditor);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const nextValue = value || "";
    if (nextValue === editor.getHTML()) return;
    editor.commands.setContent(nextValue, { emitUpdate: false });
  }, [editor, value]);

  const mergeOptions = useMemo(() => {
    const items = mergeFieldGroups.flatMap((group) => group.fields.map((field) => ({
      token: normalizeMergeTokenLabel(field.token),
      label: field.token,
      description: field.description,
      group: group.label,
    })));
    if (!mergeQuery) return items.slice(0, 30);
    return items
      .filter((item) => item.token.toLowerCase().includes(mergeQuery) || item.description.toLowerCase().includes(mergeQuery))
      .slice(0, 30);
  }, [mergeFieldGroups, mergeQuery]);

  const replaceTriggerWithText = useCallback((replacement: string) => {
    if (!editor || !triggerRange) return;
    editor.chain().focus().deleteRange(triggerRange).insertContent(replacement).run();
    closeInlineMenus();
  }, [closeInlineMenus, editor, triggerRange]);

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousHref = String(editor.getAttributes("link").href || "https://");
    const href = window.prompt("Enter link URL", previousHref);
    if (href === null) return;
    const trimmed = href.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    if (!looksLikeSafeUrl(trimmed) && !trimmed.includes("{{")) {
      window.alert("Use an https, mailto, tel, relative, or merge-field URL.");
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: trimmed }).run();
  }, [editor]);

  const insertButtonLink = useCallback(() => {
    if (!editor) return;
    const href = window.prompt("Button URL", "https://");
    if (!href) return;
    const trimmedHref = href.trim();
    if (!looksLikeSafeUrl(trimmedHref) && !trimmedHref.includes("{{")) {
      window.alert("Use an https, mailto, tel, relative, or merge-field URL.");
      return;
    }
    const selection = editor.state.selection;
    const selectedText = editor.state.doc.textBetween(selection.from, selection.to, " ").trim() || "Learn more";
    editor.chain().focus().insertContent(
      `<a href="${escapeInlineHtml(trimmedHref)}" style="display:inline-block;background:#0f5c3c;color:#ffffff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;">${escapeInlineHtml(selectedText)}</a>`
    ).run();
  }, [editor]);

  const slashCommands = useMemo(() => {
    const commands = [
      { id: "p", label: "Paragraph" },
      { id: "h2", label: "Heading 2" },
      { id: "h3", label: "Heading 3" },
      { id: "bold", label: "Bold" },
      { id: "italic", label: "Italic" },
      { id: "ul", label: "Bullet List" },
      { id: "ol", label: "Numbered List" },
      { id: "left", label: "Align Left" },
      { id: "center", label: "Align Center" },
      { id: "right", label: "Align Right" },
      { id: "button", label: "Insert Button Link" },
    ];

    if (!slashQuery) return commands;
    return commands.filter((command) => command.label.toLowerCase().includes(slashQuery));
  }, [slashQuery]);

  const executeSlashCommand = useCallback((commandId: string) => {
    if (commandId === "p") editor?.chain().focus().setParagraph().run();
    if (commandId === "h2") editor?.chain().focus().toggleHeading({ level: 2 }).run();
    if (commandId === "h3") editor?.chain().focus().toggleHeading({ level: 3 }).run();
    if (commandId === "bold") editor?.chain().focus().toggleBold().run();
    if (commandId === "italic") editor?.chain().focus().toggleItalic().run();
    if (commandId === "ul") editor?.chain().focus().toggleBulletList().run();
    if (commandId === "ol") editor?.chain().focus().toggleOrderedList().run();
    if (commandId === "left") editor?.chain().focus().setTextAlign("left").run();
    if (commandId === "center") editor?.chain().focus().setTextAlign("center").run();
    if (commandId === "right") editor?.chain().focus().setTextAlign("right").run();
    if (commandId === "button") insertButtonLink();
  }, [editor, insertButtonLink]);

  const toolbarButtonClass = useCallback((active = false) => [
    "rounded border px-2 py-1 text-[11px] font-semibold transition-colors",
    active
      ? "border-emerald-600 bg-emerald-50 text-emerald-800"
      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-100",
  ].join(" "), []);

  return (
    <div ref={containerRef} className="oyama-email-tiptap relative rounded-xl border border-slate-300 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().undo().run()} className={toolbarButtonClass()}>Undo</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().redo().run()} className={toolbarButtonClass()}>Redo</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()} className={toolbarButtonClass(!!editor?.isActive("bold"))}>B</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()} className={toolbarButtonClass(!!editor?.isActive("italic"))}>I</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleUnderline().run()} className={toolbarButtonClass(!!editor?.isActive("underline"))}>U</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().setParagraph().run()} className={toolbarButtonClass(!!editor?.isActive("paragraph"))}>P</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className={toolbarButtonClass(!!editor?.isActive("heading", { level: 2 }))}>H2</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className={toolbarButtonClass(!!editor?.isActive("heading", { level: 3 }))}>H3</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBulletList().run()} className={toolbarButtonClass(!!editor?.isActive("bulletList"))}>Bullets</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleOrderedList().run()} className={toolbarButtonClass(!!editor?.isActive("orderedList"))}>Numbers</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().setTextAlign("left").run()} className={toolbarButtonClass(!!editor?.isActive({ textAlign: "left" }))}>Left</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().setTextAlign("center").run()} className={toolbarButtonClass(!!editor?.isActive({ textAlign: "center" }))}>Center</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().setTextAlign("right").run()} className={toolbarButtonClass(!!editor?.isActive({ textAlign: "right" }))}>Right</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().unsetAllMarks().clearNodes().run()} className={toolbarButtonClass()}>Clear</button>
        <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={setLink} className={toolbarButtonClass(!!editor?.isActive("link"))}>Link</button>
        <input
          type="color"
          value={textColor}
          onChange={(event) => {
            const nextColor = event.target.value;
            setTextColor(nextColor);
            editor?.chain().focus().setColor(nextColor).run();
          }}
          className="h-7 w-8 rounded border border-slate-200 bg-white p-0.5"
          title="Text color"
        />
      </div>
      <EditorContent
        editor={editor}
        spellCheck
        onKeyUp={() => editor && handleEditorActivity(editor)}
        onMouseUp={() => editor && handleEditorActivity(editor)}
      />

      {floatingToolbar.visible ? (
        <div
          className="absolute z-20 flex -translate-x-1/2 -translate-y-full items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-1 shadow-lg"
          style={{ left: floatingToolbar.x, top: floatingToolbar.y }}
        >
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBold().run()} className="rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">B</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleItalic().run()} className="rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">I</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()} className="rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">H2</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleHeading({ level: 3 }).run()} className="rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">H3</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => editor?.chain().focus().toggleBulletList().run()} className="rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">•</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={setLink} className="rounded px-1.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Link</button>
          <input
            type="color"
            value={textColor}
            onChange={(event) => {
              const nextColor = event.target.value;
              setTextColor(nextColor);
              editor?.chain().focus().setColor(nextColor).run();
            }}
            className="h-6 w-7 rounded border border-slate-200 bg-white p-0.5"
          />
        </div>
      ) : null}

      {slashOpen ? (
        <div className="absolute bottom-2 left-2 z-20 w-[280px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Slash Commands</p>
          <div className="max-h-44 overflow-auto">
            {slashCommands.length > 0 ? slashCommands.map((command) => (
              <button
                key={command.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  if (editor && triggerRange) {
                    editor.chain().focus().deleteRange(triggerRange).run();
                  }
                  closeInlineMenus();
                  executeSlashCommand(command.id);
                }}
                className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-emerald-50"
              >
                <span>{command.label}</span>
                <span className="font-mono text-[10px] text-slate-400">/{command.id}</span>
              </button>
            )) : <p className="px-2 py-2 text-xs text-slate-500">No slash commands matched.</p>}
          </div>
        </div>
      ) : null}

      {mergeOpen ? (
        <div className="absolute bottom-2 right-2 z-20 w-[320px] rounded-lg border border-slate-200 bg-white p-1 shadow-lg">
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">Merge Fields</p>
          <div className="max-h-52 overflow-auto">
            {mergeOptions.length > 0 ? mergeOptions.map((option) => (
              <button
                key={`${option.group}-${option.token}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  replaceTriggerWithText(option.label);
                }}
                className="w-full rounded-md px-2 py-1.5 text-left hover:bg-emerald-50"
              >
                <p className="truncate font-mono text-xs text-slate-700">{option.label}</p>
                <p className="truncate text-[10px] text-slate-500">{option.group} - {option.description}</p>
              </button>
            )) : <p className="px-2 py-2 text-xs text-slate-500">No merge fields matched.</p>}
          </div>
        </div>
      ) : null}

      <style jsx global>{`
        .oyama-email-tiptap .oyama-email-prosemirror {
          min-height: ${minEditorHeight}px;
          padding: 12px;
          color: #1f2937;
          font-size: 14px;
          line-height: 1.6;
          outline: none;
        }
        .oyama-email-tiptap .oyama-email-prosemirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          color: #94a3b8;
          float: left;
          height: 0;
          pointer-events: none;
        }
        .oyama-email-tiptap .oyama-email-prosemirror a {
          color: ${linkColor || "#0f5c3c"};
        }
        .oyama-email-tiptap .oyama-email-prosemirror p {
          margin: 0 0 0.8em;
        }
        .oyama-email-tiptap .oyama-email-prosemirror h2 {
          margin: 0.4em 0;
          font-size: 1.7em;
          line-height: 1.2;
        }
        .oyama-email-tiptap .oyama-email-prosemirror h3 {
          margin: 0.35em 0;
          font-size: 1.35em;
          line-height: 1.25;
        }
        .oyama-email-tiptap .oyama-email-prosemirror ul,
        .oyama-email-tiptap .oyama-email-prosemirror ol {
          margin: 0 0 0.85em 1.25em;
          padding-left: 1.1em;
        }
        .oyama-email-tiptap .oyama-email-prosemirror ul {
          list-style-type: disc;
        }
        .oyama-email-tiptap .oyama-email-prosemirror ol {
          list-style-type: decimal;
        }
        .oyama-email-tiptap .oyama-email-prosemirror li {
          display: list-item;
          margin: 0 0 0.25em;
        }
      `}</style>
    </div>
  );
}

function CanvasBlockPreview({ block }: { block: BuilderBlock }) {
  if (block.type === "header") {
    const align = block.align || "center";
    return (
      <div
        className="rounded-lg px-4"
        style={{
          background: block.headerBackgroundColor || "#0f5c3c",
          paddingTop: block.paddingY || 20,
          paddingBottom: block.paddingY || 20,
          textAlign: align,
        }}
      >
        {block.logoUrl ? (
          <img
            src={block.logoUrl}
            alt="Organization logo"
            style={{ width: Math.max(60, Math.min(240, block.logoWidth || 140)), margin: align === "center" ? "0 auto" : align === "right" ? "0 0 0 auto" : "0" }}
            className="mb-3 h-auto"
          />
        ) : null}
        <p className="m-0 text-lg font-semibold text-white">{block.headerTitle || "Header title"}</p>
        {block.headerSubtitle ? <p className="m-0 mt-1 text-sm text-emerald-50">{block.headerSubtitle}</p> : null}
      </div>
    );
  }

  if (block.type === "text") {
    return <div className="text-sm" dangerouslySetInnerHTML={{ __html: block.content || "<p>Add text.</p>" }} />;
  }

  if (block.type === "image") {
    const widthPercent = clampNumber(Number(block.imageWidthPercent || 100), 20, 100);
    const align = block.align === "left" || block.align === "right" ? block.align : "center";
    const marginClass = align === "left" ? "mr-auto" : align === "right" ? "ml-auto" : "mx-auto";
    return block.src ? (
      <figure className="m-0">
        <img
          src={block.src}
          alt={block.alt || "Image block"}
          className={`${marginClass} max-h-[260px] max-w-full rounded-md object-cover`}
          style={{ width: `${widthPercent}%` }}
        />
        {block.caption ? <figcaption className="mt-2 text-center text-xs text-slate-500">{block.caption}</figcaption> : null}
      </figure>
    ) : (
      <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 px-3 py-8 text-center text-sm text-slate-500">Image source not set</div>
    );
  }

  if (block.type === "button" || block.type === "donationButton" || block.type === "eventButton") {
    return (
      <div className="text-center">
        <span className="inline-flex rounded-md px-4 py-2 text-sm font-semibold" style={{ background: block.color || "#0f5c3c", color: block.textColor || "#ffffff" }}>
          {block.label || "Button"}
        </span>
      </div>
    );
  }

  if (block.type === "divider") {
    return <hr style={{ border: 0, borderTop: `${block.thickness || 1}px solid ${block.color || "#d7e0dc"}` }} />;
  }

  if (block.type === "spacer") {
    return <div style={{ height: block.height || 24 }} />;
  }

  if (block.type === "columns") {
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-md border border-slate-200 p-2 text-sm" dangerouslySetInnerHTML={{ __html: block.leftHtml || "<p>Left column</p>" }} />
        <div className="rounded-md border border-slate-200 p-2 text-sm" dangerouslySetInnerHTML={{ __html: block.rightHtml || "<p>Right column</p>" }} />
      </div>
    );
  }

  if (block.type === "social") {
    const mode = block.socialMode || "follow";
    const layout = block.socialLayout || "row";
    const style = block.socialIconStyle || "pill";
    const badgeClass = style === "outline"
      ? "rounded-full border border-emerald-400 bg-white px-2 py-1 text-xs font-semibold text-emerald-800"
      : style === "plain"
        ? "px-1 py-1 text-xs font-semibold text-emerald-800"
        : "rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800";
    return (
      <div className={layout === "column" ? "flex flex-col items-center gap-2" : "flex flex-wrap items-center justify-center gap-2"}>
        <p className="m-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{mode === "share" ? "Share this campaign" : "Follow us"}</p>
        {(block.links || []).map((link) => (
          <span key={`${link.label}-${link.url}`} className={badgeClass}>{block.socialShowLabels === false ? "●" : link.label}</span>
        ))}
      </div>
    );
  }

  if (block.type === "video") {
    const hasThumb = Boolean(block.thumbnailUrl?.trim());
    const hasVideoUrl = Boolean(block.videoUrl?.trim());
    const isOneDrive = /onedrive\.live\.com|sharepoint\.com/i.test(block.videoUrl || "");
    return (
      <div className="space-y-2 text-center">
        {block.videoTitle ? <p className="m-0 text-sm font-semibold text-slate-800">{block.videoTitle}</p> : null}
        {hasThumb ? (
          <div className="relative">
            <img src={block.thumbnailUrl} alt={block.videoAlt || "Video thumbnail"} className="mx-auto max-h-[220px] w-full rounded-md object-cover" />
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white">▶</span>
            </span>
          </div>
        ) : (
          <div className="rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 py-8 text-sm text-amber-800">Thumbnail missing. Add a thumbnail URL or upload one before send.</div>
        )}
        <p className="text-[11px] text-slate-500">{hasVideoUrl ? (isOneDrive ? "OneDrive/SharePoint video link detected" : "Hosted video link configured") : "Video URL missing"}</p>
        {block.videoCtaLabel ? (
          <span className="inline-flex rounded-md border border-emerald-600 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white">{block.videoCtaLabel}</span>
        ) : null}
        {block.caption ? <p className="text-xs text-slate-500">{block.caption}</p> : null}
        {block.videoFallbackText ? <p className="text-[11px] text-slate-500">{block.videoFallbackText}</p> : null}
      </div>
    );
  }

  if (block.type === "fileLink") {
    const isOneDrive = /onedrive\.live\.com|sharepoint\.com/i.test(block.fileUrl || "");
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-left">
        <p className="m-0 text-sm font-semibold text-slate-800">{block.fileLabel || "Download File"}</p>
        {block.fileDescription ? <p className="m-0 mt-1 text-xs text-slate-600">{block.fileDescription}</p> : null}
        <p className="m-0 mt-1 text-[11px] text-slate-500">{isOneDrive ? "OneDrive/SharePoint link" : "Direct file link"}</p>
      </div>
    );
  }

  return (
    <div>
      {block.aiSmart ? (
        <div className="mb-2 inline-flex rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
          AI Smart HTML
        </div>
      ) : null}
      <div className="text-sm" dangerouslySetInnerHTML={{ __html: block.html || "<p>Custom HTML block</p>" }} />
    </div>
  );
}

function BlockInspector({
  block,
  template,
  branding,
  mergeFieldGroups,
  onChange,
  onSetInsertTarget,
  onUploadImage,
  onGenerateAiSmartHtml,
  aiSmartBusy,
  aiSmartError,
  uploadingImage,
  canUpload,
  className,
}: {
  block: BuilderBlock;
  template: BuilderTemplateDocument;
  branding: BrandingSettings;
  mergeFieldGroups: MergeFieldGroup[];
  onChange: (patch: Partial<BuilderBlock>) => void;
  onSetInsertTarget: (field: string) => void;
  onUploadImage: (file: File) => void;
  onGenerateAiSmartHtml: (description: string, tone: WritingTone, instruction?: string, objective?: AiSmartObjective) => void;
  aiSmartBusy: boolean;
  aiSmartError: string | null;
  uploadingImage: boolean;
  canUpload: boolean;
  className?: string;
}) {
  const visualEditorRef = useRef<HTMLDivElement>(null);
  const [smartToolInstruction, setSmartToolInstruction] = useState("");
  const [selectedMergeToken, setSelectedMergeToken] = useState("");

  const quickMergeTokens = useMemo(
    () => mergeFieldGroups.flatMap((group) => group.fields.map((field) => field.token)).slice(0, 120),
    [mergeFieldGroups],
  );

  const commitVisualHtml = useCallback(() => {
    const editor = visualEditorRef.current;
    if (!editor) return;
    onChange({ html: normalizeEditableSmartHtml(editor.innerHTML) });
  }, [onChange]);

  const runEditorCommand = useCallback((command: string, value?: string) => {
    const editor = visualEditorRef.current;
    if (!editor) return;
    editor.focus();
    document.execCommand(command, false, value);
    commitVisualHtml();
  }, [commitVisualHtml]);

  const insertSmartLink = useCallback(() => {
    const raw = window.prompt("Enter URL or merge token (example: https://..., {{donationUrl}})", "https://");
    if (!raw) return;
    runEditorCommand("createLink", normalizeSmartHref(raw));
  }, [runEditorCommand]);

  const insertSelectedMergeToken = useCallback(() => {
    const token = selectedMergeToken.trim();
    if (!token) return;
    runEditorCommand("insertText", `{{${token}}}`);
  }, [runEditorCommand, selectedMergeToken]);

  useEffect(() => {
    if (block.type !== "html" || !block.aiSmart) return;
    const editor = visualEditorRef.current;
    if (!editor) return;
    if (document.activeElement === editor) return;
    const nextHtml = block.html || "<p></p>";
    if (editor.innerHTML !== nextHtml) {
      editor.innerHTML = nextHtml;
    }
  }, [block.type, block.aiSmart, block.html]);

  useEffect(() => {
    if (!selectedMergeToken && quickMergeTokens.length > 0) {
      setSelectedMergeToken(quickMergeTokens[0]);
    }
  }, [quickMergeTokens, selectedMergeToken]);

  return (
    <div className={["space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-3", className || ""].join(" ")}>
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Selected Block: {block.type}</p>

      {block.type === "header" ? (
        <>
          <div className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-[11px] text-emerald-900">
            <p className="font-semibold">Branded Header Tools</p>
            <button
              type="button"
              onClick={() => onChange({
                headerTitle: branding.organizationDisplayName || branding.legalOrganizationName || block.headerTitle || "Your Organization",
                headerSubtitle: branding.tagline || block.headerSubtitle || "",
                headerBackgroundColor: branding.primaryColor || block.headerBackgroundColor || "#0f5c3c",
                logoUrl: branding.logoUrl || branding.logoSquareUrl || block.logoUrl || "",
              })}
              className="mt-1 inline-flex h-7 items-center rounded-md border border-emerald-600 bg-emerald-600 px-2 text-[11px] font-semibold text-white hover:bg-emerald-500"
            >
              Use Global Logo + Colors
            </button>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Header Title
            <input
              value={block.headerTitle || ""}
              onChange={(event) => onChange({ headerTitle: event.target.value })}
              onFocus={() => onSetInsertTarget("headerTitle")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Subtitle
            <input
              value={block.headerSubtitle || ""}
              onChange={(event) => onChange({ headerSubtitle: event.target.value })}
              onFocus={() => onSetInsertTarget("headerSubtitle")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Logo URL
            <input
              value={block.logoUrl || ""}
              onChange={(event) => onChange({ logoUrl: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              Logo Width
              <input
                type="number"
                min={60}
                max={260}
                value={block.logoWidth || 140}
                onChange={(event) => onChange({ logoWidth: clampNumber(Number(event.target.value) || 140, 60, 260) })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Vertical Padding
              <input
                type="number"
                min={8}
                max={56}
                value={block.paddingY || 20}
                onChange={(event) => onChange({ paddingY: clampNumber(Number(event.target.value) || 20, 8, 56) })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
              />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              Background
              <input
                type="color"
                value={block.headerBackgroundColor || "#0f5c3c"}
                onChange={(event) => onChange({ headerBackgroundColor: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white p-1"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Alignment
              <select
                value={block.align || "center"}
                onChange={(event) => onChange({ align: (event.target.value as "left" | "center" | "right") || "center" })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
        </>
      ) : null}

      {block.type === "text" ? (
        <div className="block text-xs font-semibold text-slate-700">
          Content Editor
          <div className="mt-1" style={{ fontFamily: template.fontFamily, fontSize: `${template.baseFontSize}px`, lineHeight: String(template.lineHeight), color: template.textColor }}>
            <RichTextEditor
              value={block.content || ""}
              onChange={(next) => onChange({ content: next })}
              onFocus={() => onSetInsertTarget("content")}
              placeholder="Write your message here..."
              linkColor={template.linkColor}
              mergeFieldGroups={mergeFieldGroups}
            />
          </div>
          <p className="mt-1 text-[11px] font-normal text-slate-500">Use the toolbar for formatting. Raw HTML is hidden for text blocks.</p>
        </div>
      ) : null}

      {block.type === "image" ? (
        <>
          <label className="block text-xs font-semibold text-slate-700">
            Image URL
            <input
              value={block.src || ""}
              onChange={(event) => onChange({ src: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Alt Text
            <input
              value={block.alt || ""}
              onChange={(event) => onChange({ alt: event.target.value })}
              onFocus={() => onSetInsertTarget("alt")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              Width
              <input
                type="range"
                min="20"
                max="100"
                step="5"
                value={block.imageWidthPercent || 100}
                onChange={(event) => onChange({ imageWidthPercent: clampNumber(Number(event.target.value) || 100, 20, 100) })}
                className="mt-2 w-full"
              />
              <span className="mt-1 block text-[11px] text-slate-500">{block.imageWidthPercent || 100}%</span>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Align
              <select
                value={block.align || "center"}
                onChange={(event) => onChange({ align: event.target.value as BuilderBlock["align"] })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
              >
                <option value="left">Left</option>
                <option value="center">Center</option>
                <option value="right">Right</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => onChange({ imageWidthPercent: 50 })} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">50%</button>
            <button type="button" onClick={() => onChange({ imageWidthPercent: 100 })} className="rounded-md border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">Full Width</button>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Link URL
            <input
              value={block.imageLinkUrl || ""}
              onChange={(event) => onChange({ imageLinkUrl: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Caption
            <input
              value={block.caption || ""}
              onChange={(event) => onChange({ caption: event.target.value })}
              onFocus={() => onSetInsertTarget("caption")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Upload Image
            <input
              type="file"
              accept="image/*"
              disabled={!canUpload || uploadingImage}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                onUploadImage(file);
                event.currentTarget.value = "";
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700 disabled:bg-slate-100"
            />
            {!canUpload ? <p className="mt-1 text-[11px] text-slate-500">Save this template first to enable uploads.</p> : null}
          </label>
        </>
      ) : null}

      {block.type === "button" || block.type === "donationButton" || block.type === "eventButton" ? (
        <>
          <label className="block text-xs font-semibold text-slate-700">
            Label
            <input
              value={block.label || ""}
              onChange={(event) => onChange({ label: event.target.value })}
              onFocus={() => onSetInsertTarget("label")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            URL
            <input
              value={block.href || ""}
              onChange={(event) => onChange({ href: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              Button Color
              <input
                type="color"
                value={block.color || "#0f5c3c"}
                onChange={(event) => onChange({ color: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white p-1"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Text Color
              <input
                type="color"
                value={block.textColor || "#ffffff"}
                onChange={(event) => onChange({ textColor: event.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white p-1"
              />
            </label>
          </div>
        </>
      ) : null}

      {block.type === "divider" ? (
        <div className="grid grid-cols-2 gap-2">
          <label className="block text-xs font-semibold text-slate-700">
            Color
            <input
              type="color"
              value={block.color || "#d7e0dc"}
              onChange={(event) => onChange({ color: event.target.value })}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white p-1"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Thickness
            <input
              type="number"
              value={block.thickness || 1}
              min={1}
              max={8}
              onChange={(event) => onChange({ thickness: Number(event.target.value) || 1 })}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
            />
          </label>
        </div>
      ) : null}

      {block.type === "spacer" ? (
        <label className="block text-xs font-semibold text-slate-700">
          Height
          <input
            type="number"
            value={block.height || 24}
            min={4}
            max={160}
            onChange={(event) => onChange({ height: Number(event.target.value) || 24 })}
            className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
          />
        </label>
      ) : null}

      {block.type === "columns" ? (
        <>
          <p className="text-xs font-semibold text-slate-700">Columns Editor</p>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700">Left Column</p>
              <div style={{ fontFamily: template.fontFamily, fontSize: `${template.baseFontSize}px`, lineHeight: String(template.lineHeight), color: template.textColor }}>
                <RichTextEditor
                  value={block.leftHtml || ""}
                  onChange={(next) => onChange({ leftHtml: next })}
                  onFocus={() => onSetInsertTarget("leftHtml")}
                  placeholder="Left column content..."
                  linkColor={template.linkColor}
                  mergeFieldGroups={mergeFieldGroups}
                  minHeight={160}
                />
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-700">Right Column</p>
              <div style={{ fontFamily: template.fontFamily, fontSize: `${template.baseFontSize}px`, lineHeight: String(template.lineHeight), color: template.textColor }}>
                <RichTextEditor
                  value={block.rightHtml || ""}
                  onChange={(next) => onChange({ rightHtml: next })}
                  onFocus={() => onSetInsertTarget("rightHtml")}
                  placeholder="Right column content..."
                  linkColor={template.linkColor}
                  mergeFieldGroups={mergeFieldGroups}
                  minHeight={160}
                />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-500">Formatting now renders live while you edit each column.</p>
        </>
      ) : null}

      {block.type === "social" ? (
        <>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              Mode
              <select
                value={block.socialMode || "follow"}
                onChange={(event) => onChange({ socialMode: (event.target.value as "follow" | "share") || "follow" })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
              >
                <option value="follow">Follow Us</option>
                <option value="share">Share This Campaign</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Layout
              <select
                value={block.socialLayout || "row"}
                onChange={(event) => onChange({ socialLayout: (event.target.value as "row" | "column") || "row" })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
              >
                <option value="row">Row</option>
                <option value="column">Column</option>
              </select>
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              Icon Style
              <select
                value={block.socialIconStyle || "pill"}
                onChange={(event) => onChange({ socialIconStyle: (event.target.value as "pill" | "outline" | "plain") || "pill" })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
              >
                <option value="pill">Pill</option>
                <option value="outline">Outline</option>
                <option value="plain">Plain</option>
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Show Labels
              <select
                value={block.socialShowLabels === false ? "icons" : "labels"}
                onChange={(event) => onChange({ socialShowLabels: event.target.value !== "icons" })}
                className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
              >
                <option value="labels">Labels</option>
                <option value="icons">Icons only</option>
              </select>
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Tracking Label
            <input
              value={block.socialTrackingLabel || ""}
              onChange={(event) => onChange({ socialTrackingLabel: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Social Links (one per line: Label|URL)
            <textarea
              value={(block.links || []).map((link) => `${link.label}|${link.url}`).join("\n")}
              onChange={(event) => {
                const links = event.target.value
                  .split(/\r?\n/)
                  .map((row) => row.trim())
                  .filter(Boolean)
                  .map((row) => {
                    const [label, url] = row.split("|");
                    return {
                      label: (label || "Link").trim(),
                      url: (url || "").trim(),
                    };
                  })
                  .filter((entry) => Boolean(entry.url));
                onChange({ links });
              }}
              rows={4}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-800"
            />
          </label>
        </>
      ) : null}

      {block.type === "video" ? (
        <>
          <label className="block text-xs font-semibold text-slate-700">
            Video Title
            <input
              value={block.videoTitle || ""}
              onChange={(event) => onChange({ videoTitle: event.target.value })}
              onFocus={() => onSetInsertTarget("videoTitle")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Thumbnail URL
            <input
              value={block.thumbnailUrl || ""}
              onChange={(event) => onChange({ thumbnailUrl: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Upload Thumbnail
            <input
              type="file"
              accept="image/*"
              disabled={!canUpload || uploadingImage}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                onUploadImage(file);
                event.currentTarget.value = "";
              }}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-2 py-2 text-xs text-slate-700 disabled:bg-slate-100"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Video URL (supports OneDrive / SharePoint)
            <input
              value={block.videoUrl || ""}
              onChange={(event) => onChange({ videoUrl: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              CTA Button Text
              <input
                value={block.videoCtaLabel || ""}
                onChange={(event) => onChange({ videoCtaLabel: event.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-700">
              Tracking Label
              <input
                value={block.videoTrackingLabel || ""}
                onChange={(event) => onChange({ videoTrackingLabel: event.target.value })}
                className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-700">
            Thumbnail Alt Text
            <input
              value={block.videoAlt || ""}
              onChange={(event) => onChange({ videoAlt: event.target.value })}
              onFocus={() => onSetInsertTarget("videoAlt")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Fallback Text (for blocked images)
            <textarea
              value={block.videoFallbackText || ""}
              onChange={(event) => onChange({ videoFallbackText: event.target.value })}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Caption
            <input
              value={block.caption || ""}
              onChange={(event) => onChange({ caption: event.target.value })}
              onFocus={() => onSetInsertTarget("caption")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <p className="text-[11px] text-slate-500">Auto-thumbnail extraction from uploaded video is currently disabled in this deployment. Use a hosted thumbnail or upload one manually.</p>
        </>
      ) : null}

      {block.type === "fileLink" ? (
        <>
          <label className="block text-xs font-semibold text-slate-700">
            Button Label
            <input
              value={block.fileLabel || ""}
              onChange={(event) => onChange({ fileLabel: event.target.value })}
              onFocus={() => onSetInsertTarget("fileLabel")}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            File URL (HTTPS or OneDrive)
            <input
              value={block.fileUrl || ""}
              onChange={(event) => onChange({ fileUrl: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Description
            <textarea
              value={block.fileDescription || ""}
              onChange={(event) => onChange({ fileDescription: event.target.value })}
              rows={2}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-800"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-700">
            Tracking Label
            <input
              value={block.fileTrackingLabel || ""}
              onChange={(event) => onChange({ fileTrackingLabel: event.target.value })}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-sm text-slate-800"
            />
          </label>
        </>
      ) : null}

      {block.type === "html" ? (
        <>
          {block.aiSmart ? (
            <>
              <div className="rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-2 text-[11px] text-indigo-900">
                <p className="font-semibold">AI Smart Block</p>
                <p className="mt-0.5">Generate email-safe HTML from a natural-language brief using Steward AI and approved merge fields.</p>
              </div>
              <label className="block text-xs font-semibold text-slate-700">
                Smart Description
                <textarea
                  value={block.aiSmartPrompt || ""}
                  onChange={(event) => onChange({ aiSmart: true, aiSmartPrompt: event.target.value })}
                  rows={4}
                  placeholder="Example: Write a donor update section with a short heading, 2 paragraphs, and one bullet list using {{donor.firstName}} and {{campaign.name}} where relevant."
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-800"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Tone
                  <select
                    value={block.aiSmartTone || "warm"}
                    onChange={(event) => onChange({ aiSmart: true, aiSmartTone: (event.target.value as WritingTone) || "warm" })}
                    className="mt-1 h-10 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
                  >
                    <option value="warm">Warm</option>
                    <option value="informative">Informative</option>
                    <option value="celebratory">Celebratory</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </label>
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => onGenerateAiSmartHtml(block.aiSmartPrompt || "", block.aiSmartTone || "warm", undefined, block.aiSmartObjective || "fundraising")}
                    disabled={aiSmartBusy}
                    className="h-10 w-full rounded-md border border-indigo-700 bg-indigo-700 px-3 text-xs font-semibold text-white hover:bg-indigo-600 disabled:opacity-60"
                  >
                    {aiSmartBusy ? "Generating..." : "Generate HTML"}
                  </button>
                </div>
              </div>
              <label className="block text-xs font-semibold text-slate-700">
                Objective
                <select
                  value={block.aiSmartObjective || "fundraising"}
                  onChange={(event) => onChange({ aiSmart: true, aiSmartObjective: (event.target.value as AiSmartObjective) || "fundraising" })}
                  className="mt-1 h-9 w-full rounded-md border border-slate-300 px-2 text-sm text-slate-800"
                >
                  <option value="fundraising">Fundraising</option>
                  <option value="update">Mission Update</option>
                  <option value="event">Event Registration</option>
                  <option value="volunteer">Volunteer Recruitment</option>
                </select>
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onGenerateAiSmartHtml(block.aiSmartPrompt || "", block.aiSmartTone || "warm", "Rewrite the existing block with sharper donor clarity and stronger narrative flow while keeping it concise.", block.aiSmartObjective || "fundraising")}
                  disabled={aiSmartBusy}
                  className="h-9 rounded-md border border-indigo-300 bg-white px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                >
                  Rewrite Sharper
                </button>
                <button
                  type="button"
                  onClick={() => onGenerateAiSmartHtml(block.aiSmartPrompt || "", block.aiSmartTone || "warm", "Expand this into a richer section with one short headline, 2 brief paragraphs, and a compact bullet list.", block.aiSmartObjective || "fundraising")}
                  disabled={aiSmartBusy}
                  className="h-9 rounded-md border border-indigo-300 bg-white px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                >
                  Expand Story
                </button>
                <button
                  type="button"
                  onClick={() => onGenerateAiSmartHtml(block.aiSmartPrompt || "", block.aiSmartTone || "warm", "Make this mobile-first: shorter sentences, scannable phrasing, and no heavy paragraph blocks.", block.aiSmartObjective || "fundraising")}
                  disabled={aiSmartBusy}
                  className="h-9 rounded-md border border-indigo-300 bg-white px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                >
                  Mobile Tighten
                </button>
                <button
                  type="button"
                  onClick={() => onGenerateAiSmartHtml(block.aiSmartPrompt || "", block.aiSmartTone || "warm", "Add a single high-clarity CTA button sentence that points to {{donationUrl}} or {{eventRegistrationUrl}} when context fits.", block.aiSmartObjective || "fundraising")}
                  disabled={aiSmartBusy}
                  className="h-9 rounded-md border border-indigo-300 bg-white px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                >
                  Add Strong CTA
                </button>
                <button
                  type="button"
                  onClick={() => onGenerateAiSmartHtml(block.aiSmartPrompt || "", block.aiSmartTone || "warm", "Harden this section for inbox deliverability: keep markup simple, no visual tricks, and keep links explicit and trustworthy.", block.aiSmartObjective || "fundraising")}
                  disabled={aiSmartBusy}
                  className="h-9 rounded-md border border-indigo-300 bg-white px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                >
                  Deliverability Pass
                </button>
                <button
                  type="button"
                  onClick={() => onGenerateAiSmartHtml(block.aiSmartPrompt || "", block.aiSmartTone || "warm", "Increase personalization depth using only valid merge fields and keep language relational, warm, and specific.", block.aiSmartObjective || "fundraising")}
                  disabled={aiSmartBusy}
                  className="h-9 rounded-md border border-indigo-300 bg-white px-2 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
                >
                  Personalize Deep
                </button>
              </div>
              <label className="block text-xs font-semibold text-slate-700">
                Custom AI Tool Instruction
                <textarea
                  value={smartToolInstruction}
                  onChange={(event) => setSmartToolInstruction(event.target.value)}
                  rows={2}
                  placeholder="Example: produce an A/B variant with stronger urgency and one concise metric."
                  className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-800"
                />
              </label>
              <button
                type="button"
                onClick={() => onGenerateAiSmartHtml(block.aiSmartPrompt || "", block.aiSmartTone || "warm", smartToolInstruction.trim() || undefined, block.aiSmartObjective || "fundraising")}
                disabled={aiSmartBusy}
                className="h-9 w-full rounded-md border border-indigo-700 bg-white px-3 text-xs font-semibold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
              >
                Run Custom Tool
              </button>
              <p className="text-[11px] text-slate-500">Power mode uses your current HTML as context, so regenerate to iteratively improve rather than starting from scratch.</p>
              {aiSmartError ? <p className="text-[11px] text-red-700">{aiSmartError}</p> : null}
            </>
          ) : (
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
              <p>Need AI-assisted HTML?</p>
              <button
                type="button"
                onClick={() => onChange({ aiSmart: true, aiSmartTone: "warm", aiSmartPrompt: block.aiSmartPrompt || "" })}
                className="mt-1 inline-flex h-7 items-center rounded-md border border-indigo-600 bg-indigo-600 px-2 text-[11px] font-semibold text-white hover:bg-indigo-500"
              >
                Enable AI Smart Mode
              </button>
            </div>
          )}
          <label className="block text-xs font-semibold text-slate-700">
            HTML
            <textarea
              value={block.html || ""}
              onChange={(event) => onChange({ html: event.target.value })}
              onFocus={() => onSetInsertTarget("html")}
              rows={6}
              className="mt-1 w-full rounded-md border border-slate-300 px-2 py-2 text-xs text-slate-800"
            />
          </label>
          <div className="rounded-md border border-slate-200 bg-white p-2">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">Sent-Style Visual Preview (Editable)</p>
            <div
              className="rounded border border-slate-100 p-2"
              style={{ background: template.backgroundColor || "#f3f7f5" }}
            >
              <div
                className="mx-auto rounded border border-slate-200 bg-white p-3"
                style={{
                  maxWidth: `${Math.min(640, Math.max(320, template.contentWidth || 600))}px`,
                  fontFamily: template.fontFamily,
                  fontSize: `${template.baseFontSize}px`,
                  lineHeight: String(template.lineHeight),
                  color: template.textColor,
                }}
              >
                <div className="mb-2 flex flex-wrap items-center gap-1.5 rounded border border-slate-200 bg-slate-50 px-2 py-1.5">
                  <button type="button" onClick={() => runEditorCommand("bold")} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Bold</button>
                  <button type="button" onClick={() => runEditorCommand("italic")} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Italic</button>
                  <button type="button" onClick={() => runEditorCommand("insertUnorderedList")} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Bullets</button>
                  <button type="button" onClick={() => runEditorCommand("insertOrderedList")} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Numbers</button>
                  <button type="button" onClick={() => runEditorCommand("formatBlock", "<h2>")} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">H2</button>
                  <button type="button" onClick={() => runEditorCommand("formatBlock", "<h3>")} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">H3</button>
                  <button type="button" onClick={() => runEditorCommand("formatBlock", "<p>")} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Paragraph</button>
                  <button type="button" onClick={insertSmartLink} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Link</button>
                  <button type="button" onClick={() => runEditorCommand("unlink")} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Unlink</button>
                  <button type="button" onClick={() => runEditorCommand("removeFormat")} className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-100">Clear Format</button>
                  <select
                    value={selectedMergeToken}
                    onChange={(event) => setSelectedMergeToken(event.target.value)}
                    className="ml-auto h-7 max-w-[240px] rounded border border-slate-300 bg-white px-1.5 text-[11px] text-slate-700"
                  >
                    {quickMergeTokens.map((token) => (
                      <option key={token} value={token}>{`{{${token}}}`}</option>
                    ))}
                  </select>
                  <button type="button" onClick={insertSelectedMergeToken} className="rounded border border-emerald-600 bg-emerald-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-emerald-500">Insert Merge</button>
                </div>
                <div
                  ref={visualEditorRef}
                  contentEditable
                  suppressContentEditableWarning
                  onFocus={() => onSetInsertTarget("html")}
                  onInput={(event) => onChange({ html: normalizeEditableSmartHtml(event.currentTarget.innerHTML) })}
                  className="min-h-[140px] rounded border border-transparent p-2 text-sm focus:border-emerald-300 focus:outline-none"
                  style={{ wordBreak: "break-word" }}
                  dangerouslySetInnerHTML={{ __html: block.html || "<p>Custom HTML block</p>" }}
                />
              </div>
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Direct edits in this visual surface update the block HTML automatically.</p>
          </div>
        </>
      ) : null}
    </div>
  );
}
