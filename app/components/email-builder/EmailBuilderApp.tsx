/**
 * EmailBuilderApp — root client component for the email builder.
 *
 * Manages global state:
 *  - EmailTemplate (blocks + settings)
 *  - Selected block ID
 *  - Save / preview / loading states
 *
 * Orchestrates all three panels (BlockPalette, EmailCanvas, BlockEditor)
 * inside a single DndContext so drag operations can cross panel boundaries.
 */

'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragStartEvent, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import type { AiButtonBlock, AiTextBlock, EmailBlock, EmailTemplate, BlockType } from '@/app/lib/email-builder-types';
import {
  createDefaultBlock,
  createDefaultTemplate,
  createTemplateFromPreset,
  generateEmailHtml,
  generatePlainText,
  type TemplatePreset,
} from '@/app/lib/email-builder-utils';

import BlockPalette  from './BlockPalette';
import EmailCanvas   from './EmailCanvas';
import BlockEditor   from './BlockEditor';
import EmailPreview  from './EmailPreview';
import { apiFetch } from "@/app/lib/auth-client";
import { useAuth } from "@/app/components/auth/AuthProvider";
import {
  DEFAULT_BRANDING_SETTINGS,
  fetchBrandingSettings,
  formatBrandingAddress,
  type BrandingSettings,
} from "@/app/lib/branding-settings";

const MERGE_TOKEN_GROUPS = {
  Donor: [
    "{{firstName}}",
    "{{lastName}}",
    "{{fullName}}",
    "{{preferredName}}",
    "{{householdGreeting}}",
    "{{email}}",
  ],
  Giving: [
    "{{lastGiftAmount}}",
    "{{lastGiftDate}}",
    "{{totalYtdGiving}}",
    "{{totalLifetimeGiving}}",
    "{{giftCount}}",
    "{{firstGiftDate}}",
  ],
  Campaign: [
    "{{campaignName}}",
    "{{campaignGoal}}",
    "{{campaignRaised}}",
    "{{campaignProgressPercent}}",
    "{{campaignsSupported}}",
  ],
  Organization: [
    "{{organizationName}}",
    "{{organizationPhone}}",
    "{{organizationWebsite}}",
    "{{addressBlock}}",
    "{{organizationTaxId}}",
  ],
  Staff: [
    "{{staffName}}",
    "{{staffTitle}}",
    "{{staffEmail}}",
    "{{signatureName}}",
  ],
  Compliance: [
    "{{unsubscribeUrl}}",
    "{{managePreferencesUrl}}",
  ],
} as const;

const EMAIL_BUILDER_MERGE_TOKEN_CATALOG = new Set<string>([
  ...Object.values(MERGE_TOKEN_GROUPS).flat(),
  "{{receiptNumber}}",
  "{{currentYear}}",
  "{{currentDate}}",
  "{{donationUrl}}",
  "{{donationAmount}}",
  "{{organizationAddress}}",
]);

interface MergeTokenValidationResult {
  unknownTokens: string[];
  malformedBraceCount: number;
}

/** Normalizes merge token text to canonical {{tokenName}} shape for validation checks. */
function canonicalizeMergeToken(token: string): string {
  return `{{${token.replace(/\{\{|\}\}/g, "").trim()}}}`;
}

/** Recursively collects string values from one object so merge token scans include nested block data. */
function collectStringValues(value: unknown, acc: string[]): void {
  if (typeof value === "string") {
    acc.push(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectStringValues(entry, acc));
    return;
  }
  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((entry) => collectStringValues(entry, acc));
  }
}

/** Validates merge tokens used in template blocks and flags unknown or malformed placeholders. */
function validateTemplateMergeTokens(template: EmailTemplate): MergeTokenValidationResult {
  const allStrings: string[] = [];
  collectStringValues(template.blocks, allStrings);

  const unknown = new Set<string>();
  let malformedBraceCount = 0;

  allStrings.forEach((text) => {
    const openCount = (text.match(/\{\{/g) ?? []).length;
    const closeCount = (text.match(/\}\}/g) ?? []).length;
    if (openCount !== closeCount) {
      malformedBraceCount += Math.abs(openCount - closeCount);
    }

    const matches = text.match(/\{\{[^{}]+\}\}/g) ?? [];
    matches.forEach((token) => {
      const canonical = canonicalizeMergeToken(token);
      if (!EMAIL_BUILDER_MERGE_TOKEN_CATALOG.has(canonical)) {
        unknown.add(canonical);
      }
    });
  });

  return {
    unknownTokens: Array.from(unknown).sort(),
    malformedBraceCount,
  };
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  /** Campaign ID from the `?campaign=` query param. */
  campaignId?: string;
  /** Route to return to after editing (e.g., campaign workspace). */
  returnTo?: string;
  /** Renders the builder inside a larger campaign workspace instead of as a full-screen route. */
  embedded?: boolean;
  /** Optional callback fired after a successful draft save. */
  onSaved?: () => void | Promise<void>;
}

interface CommunicationsAiTemplateResponse {
  template: {
    backgroundColor?: string;
    contentWidth?: number;
    fontFamily?: string;
    blocks?: Array<Record<string, unknown>>;
  };
  sourceModel: string;
}

interface CommunicationsAiBlockResponse {
  block: Record<string, unknown>;
  sourceModel: string;
}

type SidebarTab = 'block' | 'campaign' | 'personalize' | 'review' | 'ai';
type CampaignPurpose = 'MARKETING' | 'FUNDRAISING' | 'NEWSLETTER' | 'EVENT_PROMOTION' | 'RECEIPT' | 'THANK_YOU' | 'TRANSACTIONAL' | 'ADMINISTRATIVE' | 'PERSONAL';

const PURPOSE_OPTIONS: Array<{ value: CampaignPurpose; label: string }> = [
  { value: 'MARKETING', label: 'Marketing' },
  { value: 'FUNDRAISING', label: 'Fundraising Appeal' },
  { value: 'NEWSLETTER', label: 'Newsletter' },
  { value: 'EVENT_PROMOTION', label: 'Event Promotion' },
  { value: 'RECEIPT', label: 'Donation Receipt' },
  { value: 'THANK_YOU', label: 'Thank You' },
  { value: 'TRANSACTIONAL', label: 'Transactional' },
  { value: 'ADMINISTRATIVE', label: 'Administrative Notice' },
  { value: 'PERSONAL', label: 'Personal Staff Email' },
];

const COMPLIANCE_REQUIRED_PURPOSES = new Set<CampaignPurpose>(['MARKETING', 'FUNDRAISING', 'NEWSLETTER', 'EVENT_PROMOTION']);

/** Safely converts unknown values to bounded numbers used in block hydration. */
function toBoundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Hydrates one API-generated block draft into a strongly typed EmailBlock with a fresh id. */
function hydrateGeneratedBlock(raw: Record<string, unknown>): EmailBlock {
  const candidateType = String(raw.type ?? "text");
  const allowedTypes: BlockType[] = [
    "heading",
    "text",
    "quote",
    "impactStat",
    "impactStory",
    "impactGrid",
    "callout",
    "progress",
    "featureList",
    "donorThankYou",
    "donationReceipt",
    "givingSummary",
    "donationCta",
    "monthlyDonorInvitation",
    "lapsedDonorReengagement",
    "firstTimeDonorWelcome",
    "staffSignature",
    "footerCompliance",
    "image",
    "video",
    "button",
    "aiText",
    "aiButton",
    "divider",
    "spacer",
    "social",
    "columns",
    "customHtml",
  ];
  const type = allowedTypes.includes(candidateType as BlockType) ? (candidateType as BlockType) : "text";
  const base = createDefaultBlock(type);

  if (type === "quote") {
    return {
      ...base,
      type,
      quote: String(raw.quote ?? "Your support made this possible."),
      attribution: String(raw.attribution ?? "Community Member"),
      align: raw.align === "center" || raw.align === "right" ? raw.align : "left",
      accentColor: String(raw.accentColor ?? "#16a34a"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "heading") {
    return {
      ...base,
      type,
      eyebrow: raw.eyebrow ? String(raw.eyebrow) : undefined,
      title: String(raw.title ?? "Campaign Update"),
      subtitle: raw.subtitle ? String(raw.subtitle) : undefined,
      align: raw.align === "center" || raw.align === "right" ? raw.align : "left",
      textColor: String(raw.textColor ?? "#111827"),
      padding: toBoundedNumber(raw.padding, 18, 0, 100),
    } as EmailBlock;
  }

  if (type === "impactStat") {
    return {
      ...base,
      type,
      value: String(raw.value ?? "0"),
      label: String(raw.label ?? "Impact"),
      sublabel: raw.sublabel ? String(raw.sublabel) : undefined,
      bgColor: String(raw.bgColor ?? "#ecfdf3"),
      textColor: String(raw.textColor ?? "#14532d"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "callout") {
    return {
      ...base,
      type,
      title: String(raw.title ?? "Impact Highlight"),
      body: String(raw.body ?? "Share one concise impact story here."),
      bgColor: String(raw.bgColor ?? "#eff6ff"),
      borderColor: String(raw.borderColor ?? "#2563eb"),
      textColor: String(raw.textColor ?? "#1e3a8a"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "progress") {
    return {
      ...base,
      type,
      label: String(raw.label ?? "Campaign Progress"),
      current: toBoundedNumber(raw.current, 0, 0, 100000000),
      goal: Math.max(1, toBoundedNumber(raw.goal, 100, 1, 100000000)),
      barColor: String(raw.barColor ?? "#16a34a"),
      trackColor: String(raw.trackColor ?? "#d1fae5"),
      textColor: String(raw.textColor ?? "#14532d"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "featureList") {
    const items = Array.isArray(raw.items)
      ? raw.items.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
      : [];
    return {
      ...base,
      type,
      title: raw.title ? String(raw.title) : undefined,
      items: items.length > 0 ? items : ["Program support", "Community care", "Sustained impact"],
      dollarFraming: raw.dollarFraming ? String(raw.dollarFraming) : undefined,
      bulletColor: String(raw.bulletColor ?? "#16a34a"),
      textColor: String(raw.textColor ?? "#1f2937"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "donorThankYou") {
    return {
      ...base,
      type,
      headline: String(raw.headline ?? "Thank you for your generosity"),
      thankYouMessage: String(raw.thankYouMessage ?? "Your support makes this mission possible."),
      giftAmountToken: String(raw.giftAmountToken ?? "{{lastGiftAmount}}"),
      giftDateToken: String(raw.giftDateToken ?? "{{lastGiftDate}}"),
      campaignToken: String(raw.campaignToken ?? "{{campaignName}}"),
      staffSignature: String(raw.staffSignature ?? "{{staffName}}"),
      bgColor: String(raw.bgColor ?? "#ecfdf3"),
      textColor: String(raw.textColor ?? "#14532d"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "donationCta") {
    const suggestedAmounts = Array.isArray(raw.suggestedAmounts)
      ? raw.suggestedAmounts.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : [];
    return {
      ...base,
      type,
      headline: String(raw.headline ?? "Keep this work going"),
      appealText: String(raw.appealText ?? raw.content ?? "Your next gift helps continue this momentum."),
      buttonLabel: String(raw.buttonLabel ?? "Give Today"),
      buttonUrl: String(raw.buttonUrl ?? raw.href ?? "https://"),
      suggestedAmounts: suggestedAmounts.length > 0 ? suggestedAmounts : ["$25", "$50", "$100"],
      bgColor: String(raw.bgColor ?? "#ecfdf3"),
      textColor: String(raw.textColor ?? "#14532d"),
      buttonColor: String(raw.buttonColor ?? "#16a34a"),
      buttonTextColor: String(raw.buttonTextColor ?? "#ffffff"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "staffSignature") {
    return {
      ...base,
      type,
      nameToken: String(raw.nameToken ?? "{{staffName}}"),
      titleToken: String(raw.titleToken ?? "{{staffTitle}}"),
      phoneToken: String(raw.phoneToken ?? "{{organizationPhone}}"),
      emailToken: String(raw.emailToken ?? "{{staffEmail}}"),
      organizationToken: String(raw.organizationToken ?? "{{organizationName}}"),
      signatureImageUrl: raw.signatureImageUrl ? String(raw.signatureImageUrl) : undefined,
      headshotUrl: raw.headshotUrl ? String(raw.headshotUrl) : undefined,
      textColor: String(raw.textColor ?? "#1f2937"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "footerCompliance") {
    return {
      ...base,
      type,
      organizationNameToken: String(raw.organizationNameToken ?? "{{organizationName}}"),
      addressToken: String(raw.addressToken ?? "{{addressBlock}}"),
      phoneToken: String(raw.phoneToken ?? "{{organizationPhone}}"),
      websiteToken: String(raw.websiteToken ?? "{{organizationWebsite}}"),
      unsubscribeToken: String(raw.unsubscribeToken ?? "{{unsubscribeUrl}}"),
      managePreferencesToken: String(raw.managePreferencesToken ?? "{{managePreferencesUrl}}"),
      taxIdToken: raw.taxIdToken ? String(raw.taxIdToken) : undefined,
      bgColor: String(raw.bgColor ?? "#f9fafb"),
      textColor: String(raw.textColor ?? "#4b5563"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "button") {
    return {
      ...base,
      type,
      label: String(raw.label ?? "Learn More"),
      href: String(raw.href ?? "https://"),
      bgColor: String(raw.bgColor ?? "#16a34a"),
      textColor: String(raw.textColor ?? "#ffffff"),
      align: raw.align === "left" || raw.align === "right" ? raw.align : "center",
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
      borderRadius: toBoundedNumber(raw.borderRadius, 6, 0, 40),
    } as EmailBlock;
  }

  if (type === "aiText") {
    return {
      ...base,
      type,
      prompt: String(raw.prompt ?? "Generate donor update copy."),
      content: String(raw.content ?? "<p>Generated content.</p>"),
      tone: raw.tone === "urgent" || raw.tone === "celebratory" || raw.tone === "informative" ? raw.tone : "warm",
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "aiButton") {
    return {
      ...base,
      type,
      prompt: String(raw.prompt ?? "Generate donor CTA."),
      label: String(raw.label ?? "Take Action"),
      href: String(raw.href ?? "https://"),
      bgColor: String(raw.bgColor ?? "#16a34a"),
      textColor: String(raw.textColor ?? "#ffffff"),
      align: raw.align === "left" || raw.align === "right" ? raw.align : "center",
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
      borderRadius: toBoundedNumber(raw.borderRadius, 6, 0, 40),
    } as EmailBlock;
  }

  if (type === "divider") {
    return {
      ...base,
      type,
      color: String(raw.color ?? "#e5e7eb"),
      thickness: toBoundedNumber(raw.thickness, 1, 1, 12),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "spacer") {
    return {
      ...base,
      type,
      height: toBoundedNumber(raw.height, 28, 4, 200),
    } as EmailBlock;
  }

  if (type === "social") {
    const links = Array.isArray(raw.links)
      ? raw.links
        .map((link) => ({
          platform: String((link as { platform?: unknown })?.platform ?? ""),
          url: String((link as { url?: unknown })?.url ?? "").trim(),
        }))
        .filter((link) =>
          ["facebook", "twitter", "instagram", "linkedin", "youtube"].includes(link.platform)
          && link.url,
        )
      : [];
    return {
      ...base,
      type,
      links: links.length > 0
        ? links.map((link) => ({ platform: link.platform as "facebook" | "twitter" | "instagram" | "linkedin" | "youtube", url: link.url }))
        : base.type === "social"
          ? base.links
          : [
            { platform: "facebook", url: "https://facebook.com" },
            { platform: "instagram", url: "https://instagram.com" },
            { platform: "linkedin", url: "https://linkedin.com" },
          ],
      align: raw.align === "left" || raw.align === "right" ? raw.align : "center",
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  if (type === "customHtml") {
    return {
      ...base,
      type,
      html: String(raw.html ?? raw.content ?? "<div>Custom HTML</div>"),
      padding: toBoundedNumber(raw.padding, 16, 0, 100),
    } as EmailBlock;
  }

  return {
    ...base,
    type: "text",
    content: String(raw.content ?? "<p>Generated content.</p>"),
    fontSize: toBoundedNumber(raw.fontSize, 16, 10, 32),
    color: String(raw.color ?? "#333333"),
    align: raw.align === "center" || raw.align === "right" ? raw.align : "left",
    padding: toBoundedNumber(raw.padding, 16, 0, 100),
  } as EmailBlock;
}

// ─── DragOverlay ghost ────────────────────────────────────────────────────────

/**
 * Lightweight overlay rendered while a drag is in progress.
 * Shown instead of the original element to give a "ghost" effect.
 */
function DragGhost({ label }: { label: string }) {
  return (
    <div
      className="bg-white border-2 border-green-500 rounded-lg px-4 py-2 shadow-xl text-sm font-medium text-gray-700 opacity-90 pointer-events-none"
    >
      + {label}
    </div>
  );
}

/** Applies branding defaults to template-level style settings used across the email canvas. */
function applyBrandingToTemplate(template: EmailTemplate, branding: BrandingSettings): EmailTemplate {
  return {
    ...template,
    backgroundColor: branding.emailBackgroundColor || template.backgroundColor,
    contentWidth: branding.emailContentWidth || template.contentWidth,
    fontFamily: branding.emailFontFamily || template.fontFamily,
  };
}

/** Applies branding accents to newly created blocks so the palette starts on-brand. */
function applyBrandingToBlock(block: EmailBlock, branding: BrandingSettings): EmailBlock {
  switch (block.type) {
    case 'button':
      return { ...block, bgColor: branding.primaryColor || block.bgColor };
    case 'aiButton':
      return { ...block, bgColor: branding.primaryColor || block.bgColor };
    case 'quote':
      return { ...block, accentColor: branding.primaryColor || block.accentColor };
    case 'impactGrid':
      return { ...block, accentColor: branding.primaryColor || block.accentColor };
    case 'impactStory':
      return { ...block, ctaColor: branding.primaryColor || block.ctaColor };
    case 'progress':
      return { ...block, barColor: branding.primaryColor || block.barColor };
    case 'callout':
      return { ...block, borderColor: branding.accentColor || block.borderColor };
    case 'givingSummary':
      return { ...block, accentColor: branding.primaryColor || block.accentColor };
    case 'donationCta':
      return { ...block, buttonColor: branding.primaryColor || block.buttonColor };
    case 'monthlyDonorInvitation':
      return { ...block, buttonColor: branding.primaryColor || block.buttonColor };
    case 'lapsedDonorReengagement':
      return { ...block, buttonColor: branding.primaryColor || block.buttonColor };
    case 'firstTimeDonorWelcome':
      return { ...block, buttonColor: branding.primaryColor || block.buttonColor };
    case 'featureList':
      return { ...block, bulletColor: branding.primaryColor || block.bulletColor };
    case 'timeline':
      return { ...block, accentColor: branding.primaryColor || block.accentColor };
    case 'social': {
      const links = [...block.links];
      if (branding.socialFacebook) {
        const idx = links.findIndex((link) => link.platform === 'facebook');
        if (idx >= 0) links[idx] = { ...links[idx], url: branding.socialFacebook };
      }
      if (branding.socialInstagram) {
        const idx = links.findIndex((link) => link.platform === 'instagram');
        if (idx >= 0) links[idx] = { ...links[idx], url: branding.socialInstagram };
      }
      if (branding.socialLinkedIn) {
        const idx = links.findIndex((link) => link.platform === 'linkedin');
        if (idx >= 0) links[idx] = { ...links[idx], url: branding.socialLinkedIn };
      }
      if (branding.socialYoutube) {
        const idx = links.findIndex((link) => link.platform === 'youtube');
        if (idx >= 0) links[idx] = { ...links[idx], url: branding.socialYoutube };
      }
      return { ...block, links };
    }
    case 'image':
      if (block.src.trim()) return block;
      if (!branding.logoUrl.trim()) return block;
      return { ...block, src: branding.logoUrl, alt: `${branding.organizationDisplayName || 'Organization'} logo` };
    default:
      return block;
  }
}

/** Reconciles a whole template with current CRM Branding Settings before rendering or saving. */
function enforceBrandingOnTemplate(template: EmailTemplate, branding: BrandingSettings): EmailTemplate {
  return applyBrandingToTemplate({
    ...template,
    blocks: template.blocks.map((block) => applyBrandingToBlock(block, branding)),
  }, branding);
}

// ─── EmailBuilderApp ──────────────────────────────────────────────────────────

export default function EmailBuilderApp({ campaignId, returnTo, embedded = false, onSaved }: Props) {
  // ── Template state ─────────────────────────────────────────────────────────
  const [template, setTemplate] = useState<EmailTemplate>(createDefaultTemplate);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [showPreview,    setShowPreview]     = useState(false);
  const [saving,         setSaving]          = useState(false);
  const [saveError,      setSaveError]       = useState<string | null>(null);
  const [saveSuccess,    setSaveSuccess]     = useState(false);
  const [campaignName,   setCampaignName]    = useState('Email Campaign');
  const [subjectLine,    setSubjectLine]     = useState('');
  const [previewText,    setPreviewText]     = useState('');
  const [campaignPurpose, setCampaignPurpose] = useState<CampaignPurpose>('MARKETING');
  const [preset,         setPreset]          = useState<TemplatePreset>('blank');
  const [dirty,          setDirty]           = useState(false);
  const [copiedToken,    setCopiedToken]     = useState<string | null>(null);
  const [aiBrief,        setAiBrief]         = useState('Draft a donor stewardship email highlighting recent impact and one clear next step.');
  const [aiAudience,     setAiAudience]      = useState('Active Donors');
  const [aiTone,         setAiTone]          = useState<'warm' | 'informative' | 'celebratory' | 'urgent'>('warm');
  const [aiBusy,         setAiBusy]          = useState(false);
  const [aiError,        setAiError]         = useState<string | null>(null);
  const [aiModelUsed,    setAiModelUsed]     = useState<string | null>(null);
  const [aiGeneratingBlockId, setAiGeneratingBlockId] = useState<string | null>(null);
  const [mediaUploading, setMediaUploading] = useState(false);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [testEmail, setTestEmail] = useState('');
  const [sendingTest, setSendingTest] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('block');
  const [branding, setBranding] = useState<BrandingSettings>(DEFAULT_BRANDING_SETTINGS);
  const dirtyRef = useRef(false);
  const mediaInputRef = useRef<HTMLInputElement | null>(null);

  /** Marks the template as having unsaved local edits and updates the dirty ref synchronously. */
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
    setDirty(true);
  }, []);

  // ── Drag state (for DragOverlay label) ────────────────────────────────────
  const [activeLabel, setActiveLabel] = useState<string | null>(null);

  // ── Load campaign from API ─────────────────────────────────────────────────
  const { user, loading: authLoading } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);
  /* Start in loading state when a campaignId is present so the first render
     shows the spinner without a synchronous setState call in the effect. */
  const [loading,   setLoading]   = useState(Boolean(campaignId));

  /** Loads organization branding defaults once auth is ready so builder defaults stay consistent. */
  useEffect(() => {
    if (authLoading) return;

    fetchBrandingSettings()
      .then((payload) => {
        setBranding(payload);
        setTemplate((current) => {
          // Only auto-apply branding if the local template still appears untouched.
          const isUntouchedDefault =
            current.blocks.length === 1 &&
            current.blocks[0]?.type === 'text' &&
            current.backgroundColor === '#f5f5f5' &&
            current.contentWidth === 600;
          if (!isUntouchedDefault) return current;
          return applyBrandingToTemplate(current, payload);
        });
      })
      .catch(() => {
        // Keep builder resilient when branding settings fail to load.
      });
  }, [authLoading]);

  // Wait for auth to finish refreshing before fetching — avoids the race where
  // the in-memory access token is still null when this effect fires on page load.
  useEffect(() => {
    if (!campaignId) return;
    if (authLoading) return; // token not ready yet
    apiFetch<{ name?: string; subject?: string; previewText?: string; purpose?: CampaignPurpose; templateJson?: string }>(`/api/email-campaigns/${campaignId}`)
      .then((data) => {
        if (data.name)     setCampaignName(data.name);
        setSubjectLine(data.subject ?? '');
        setPreviewText(data.previewText ?? '');
        setCampaignPurpose(data.purpose ?? 'MARKETING');
        // Avoid clobbering in-progress local edits if the initial load resolves late.
        if (!dirtyRef.current && data.templateJson) {
          try {
            setTemplate(JSON.parse(data.templateJson) as EmailTemplate);
            setPreset('blank');
          } catch {
            /* ignore parse errors */
          }
        }
        if (!dirtyRef.current) {
          setDirty(false);
        }
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setLoadError(`Failed to load campaign: ${msg}`);
      })
      .finally(() => setLoading(false));
  }, [campaignId, authLoading]);

  /** Seeds the test-send target from signed-in user email when available. */
  useEffect(() => {
    if (!user?.email) return;
    if (testEmail.trim()) return;
    setTestEmail(user.email);
  }, [user?.email, testEmail]);

  /** Opens the block tab automatically whenever a block is selected. */
  useEffect(() => {
    if (selectedId) {
      setActiveSidebarTab('block');
    }
  }, [selectedId]);

  // ── Block helpers ──────────────────────────────────────────────────────────

  /** Immutably replace a block identified by id with a merged partial. */
  const updateBlock = useCallback((id: string, partial: Partial<EmailBlock>) => {
    setTemplate((prev) => ({
      ...prev,
      blocks: prev.blocks.map((b) =>
        b.id === id ? ({ ...b, ...partial } as EmailBlock) : b
      ),
    }));
    markDirty();
  }, [markDirty]);

  /** Remove a block by id. Also clears selection if that block was selected. */
  const deleteBlock = useCallback((id: string) => {
    setTemplate((prev) => ({ ...prev, blocks: prev.blocks.filter((b) => b.id !== id) }));
    setSelectedId((prev) => (prev === id ? null : prev));
    markDirty();
  }, [markDirty]);

  /** Update top-level template properties (background, font, width). */
  const updateTemplate = useCallback((partial: Partial<EmailTemplate>) => {
    setTemplate((prev) => ({ ...prev, ...partial }));
    markDirty();
  }, [markDirty]);

  /** Commits inline canvas text edits back into selected text-capable blocks. */
  const updateInlineBlockContent = useCallback((id: string, content: string) => {
    const target = template.blocks.find((block) => block.id === id);
    if (!target) return;
    if (target.type !== 'text' && target.type !== 'aiText') return;
    updateBlock(id, { content } as Partial<EmailBlock>);
  }, [template.blocks, updateBlock]);

  // ── DnD sensors ───────────────────────────────────────────────────────────

  const sensors = useSensors(
    useSensor(PointerSensor, {
      /* Require an 8 px drag before activating — prevents accidental drags on click */
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // ── DnD handlers ──────────────────────────────────────────────────────────

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const origin = active.data.current?.origin as string | undefined;
    if (origin === 'palette') {
      const blockType = active.data.current?.blockType as BlockType;
      setActiveLabel(blockType);
    } else {
      /* Canvas block — find its type for the overlay label */
      const block = template.blocks.find((b) => b.id === String(active.id));
      setActiveLabel(block?.type ?? null);
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveLabel(null);

    if (!over) return;

    const origin      = active.data.current?.origin as string | undefined;
    const overId      = String(over.id);
    const overIsBlock = template.blocks.some((b) => b.id === overId);

    if (origin === 'palette') {
      /* ── Drop from palette: create a new block ── */
      const blockType = active.data.current?.blockType as BlockType;
      const newBlock  = applyBrandingToBlock(createDefaultBlock(blockType), branding);

      setTemplate((prev) => {
        const blocks = [...prev.blocks];
        if (!overIsBlock) {
          /* Dropped on the canvas background — append */
          blocks.push(newBlock);
        } else {
          /* Dropped on an existing block — insert after it */
          const overIndex = blocks.findIndex((b) => b.id === overId);
          blocks.splice(overIndex + 1, 0, newBlock);
        }
        return { ...prev, blocks };
      });
      setSelectedId(newBlock.id);
      markDirty();

    } else if (origin === 'canvas') {
      /* ── Canvas reorder ── */
      const activeId = String(active.id);
      if (activeId !== overId && overIsBlock) {
        setTemplate((prev) => {
          const oldIndex = prev.blocks.findIndex((b) => b.id === activeId);
          const newIndex = prev.blocks.findIndex((b) => b.id === overId);
          if (oldIndex === -1 || newIndex === -1) return prev;
          return { ...prev, blocks: arrayMove(prev.blocks, oldIndex, newIndex) };
        });
        markDirty();
      }
    }
  };

  /** Duplicates a block and inserts the copy directly below the original. */
  const duplicateBlockById = useCallback((targetId: string) => {
    setTemplate((prev) => {
      const index = prev.blocks.findIndex((b) => b.id === targetId);
      if (index === -1) return prev;
      const block = prev.blocks[index];
      const copy = createDefaultBlock(block.type);
      const duplicated = { ...block, id: copy.id } as EmailBlock;
      const blocks = [...prev.blocks];
      blocks.splice(index + 1, 0, duplicated);
      return { ...prev, blocks };
    });
    setSelectedId((prev) => (prev === targetId ? prev : targetId));
    markDirty();
  }, [markDirty]);

  /** Duplicates the currently selected block and inserts it below the original. */
  const duplicateSelectedBlock = () => {
    if (!selectedId) return;
    duplicateBlockById(selectedId);
  };

  /** Moves a block up or down by one position in the canvas. */
  const moveBlock = useCallback((targetId: string, direction: 'up' | 'down') => {
    setTemplate((prev) => {
      const currentIndex = prev.blocks.findIndex((block) => block.id === targetId);
      if (currentIndex === -1) return prev;
      const offset = direction === 'up' ? -1 : 1;
      const nextIndex = currentIndex + offset;
      if (nextIndex < 0 || nextIndex >= prev.blocks.length) return prev;
      return { ...prev, blocks: arrayMove(prev.blocks, currentIndex, nextIndex) };
    });
    markDirty();
  }, [markDirty]);

  /** Replaces the current canvas with a starter preset template. */
  const applyPreset = () => {
    const next = enforceBrandingOnTemplate(createTemplateFromPreset(preset), branding);
    setTemplate(next);
    setSelectedId(next.blocks[0]?.id ?? null);
    markDirty();
  };

  /** Generates a full email template draft from Communications AI and optionally saves it immediately as draft. */
  const generateFullTemplateWithAi = useCallback(async (options?: { saveDraft?: boolean }) => {
    if (aiBusy) return;

    setAiBusy(true);
    setAiError(null);
    try {
      const response = await apiFetch<CommunicationsAiTemplateResponse>("/api/communications-ai/email-builder/generate-template", {
        method: "POST",
        body: JSON.stringify({
          goal: aiBrief,
          audience: aiAudience,
          tone: aiTone,
          campaignName,
        }),
      });

      const draftTemplate = response.template;
      let generatedBlocks = Array.isArray(draftTemplate.blocks)
        ? draftTemplate.blocks.map((block) => applyBrandingToBlock(hydrateGeneratedBlock(block), branding)).slice(0, 24)
        : [];

      // Ensure compliance-friendly drafts include footerCompliance for review-first workflows.
      if (!generatedBlocks.some((block) => block.type === 'footerCompliance')) {
        generatedBlocks = [
          ...generatedBlocks,
          applyBrandingToBlock(createDefaultBlock('footerCompliance'), branding),
        ];
      }

      if (generatedBlocks.length === 0) {
        throw new Error("AI returned no blocks. Try a more specific brief.");
      }

      const nextTemplate = enforceBrandingOnTemplate({
        backgroundColor: String(draftTemplate.backgroundColor ?? "#f5f5f5"),
        contentWidth: toBoundedNumber(draftTemplate.contentWidth, 600, 420, 760),
        fontFamily: String(draftTemplate.fontFamily ?? "Arial, Helvetica, sans-serif"),
        blocks: generatedBlocks,
      }, branding);

      setTemplate(nextTemplate);
      setSelectedId(generatedBlocks[0]?.id ?? null);
      setAiModelUsed(response.sourceModel);

      if (options?.saveDraft && campaignId) {
        const bodyHtml = generateEmailHtml(nextTemplate);
        const bodyText = generatePlainText(nextTemplate);
        await apiFetch(`/api/email-campaigns/${campaignId}`, {
          method: 'PUT',
          body: JSON.stringify({
            name: campaignName.trim() || 'Email Campaign',
            subject: subjectLine.trim() || campaignName.trim() || 'Email Campaign',
            previewText: previewText.trim() || undefined,
            bodyHtml,
            bodyText,
            purpose: campaignPurpose,
            templateJson: JSON.stringify(nextTemplate),
            preparationStatus: 'DRAFT',
          }),
        });
        await onSaved?.();
        dirtyRef.current = false;
        setDirty(false);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3650);
      } else {
        markDirty();
      }
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI template generation failed.");
    } finally {
      setAiBusy(false);
    }
  }, [
    aiAudience,
    aiBrief,
    aiBusy,
    aiTone,
    branding,
    campaignId,
    campaignName,
    campaignPurpose,
    markDirty,
    onSaved,
    previewText,
    subjectLine,
  ]);

  /** Regenerates one selected AI block payload based on the block's own stored prompt. */
  const generateSelectedAiBlock = useCallback(async (blockId: string) => {
    const selected = template.blocks.find((block) => block.id === blockId);
    if (!selected) return;
    if (selected.type !== "aiText" && selected.type !== "aiButton") return;

    const blockPrompt = selected.prompt.trim();
    if (!blockPrompt) {
      setAiError("Add an AI prompt before generating this block.");
      return;
    }

    setAiError(null);
    setAiGeneratingBlockId(blockId);
    try {
      const response = await apiFetch<CommunicationsAiBlockResponse>("/api/communications-ai/email-builder/generate-block", {
        method: "POST",
        body: JSON.stringify({
          blockKind: selected.type,
          prompt: blockPrompt,
          tone: selected.type === "aiText" ? selected.tone : aiTone,
        }),
      });

      const hydrated = hydrateGeneratedBlock(response.block);
      if (hydrated.type === "aiText") {
        const partial: Partial<AiTextBlock> = {
          prompt: hydrated.prompt,
          content: hydrated.content,
          tone: hydrated.tone,
          padding: hydrated.padding,
        };
        updateBlock(blockId, partial as Partial<EmailBlock>);
      } else if (hydrated.type === "aiButton") {
        const partial: Partial<AiButtonBlock> = {
          prompt: hydrated.prompt,
          label: hydrated.label,
          href: hydrated.href,
          bgColor: hydrated.bgColor,
          textColor: hydrated.textColor,
          align: hydrated.align,
          borderRadius: hydrated.borderRadius,
          padding: hydrated.padding,
        };
        updateBlock(blockId, partial as Partial<EmailBlock>);
      }

      setAiModelUsed(response.sourceModel);
    } catch (error) {
      setAiError(error instanceof Error ? error.message : "AI block generation failed.");
    } finally {
      setAiGeneratingBlockId(null);
    }
  }, [aiTone, template.blocks, updateBlock]);

  // ── Save ───────────────────────────────────────────────────────────────────

  /** Copies one merge token so staff can quickly personalize content blocks. */
  const copyMergeToken = useCallback(async (token: string) => {
    try {
      if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(token);
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(null), 1800);
      }
    } catch {
      // Ignore clipboard failures in browsers that disallow async clipboard calls.
    }
  }, []);

  const handleSave = async () => {
    if (!campaignId) {
      setSaveError('No campaign ID — open this editor with ?campaign=ID');
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const brandedTemplate = enforceBrandingOnTemplate(template, branding);
      const bodyHtml = generateEmailHtml(brandedTemplate);
      const bodyText = generatePlainText(brandedTemplate);
      await apiFetch(`/api/email-campaigns/${campaignId}`, {
        method:      'PUT',
        body:        JSON.stringify({
          name: campaignName.trim() || 'Email Campaign',
          subject: subjectLine.trim() || campaignName.trim() || 'Email Campaign',
          previewText: previewText.trim() || undefined,
          bodyHtml,
          bodyText,
          purpose: campaignPurpose,
          templateJson: JSON.stringify(brandedTemplate),
          preparationStatus: 'DRAFT',
        }),
      });
      await onSaved?.();
      setTemplate(brandedTemplate);
      setSaveSuccess(true);
      dirtyRef.current = false;
      setDirty(false);
      setTimeout(() => setSaveSuccess(false), 3650);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  /** Sends one test email to validate content before scheduling or sending broadly. */
  const handleSendTest = async () => {
    if (!campaignId) {
      setSaveError('No campaign ID — open this editor with ?campaign=ID');
      return;
    }

    const toEmail = testEmail.trim().toLowerCase();
    if (!toEmail) {
      setSaveError('Enter a test email address before sending a test.');
      return;
    }

    setSendingTest(true);
    setSaveError(null);
    setTestStatus(null);
    try {
      await apiFetch(`/api/email-campaigns/${campaignId}/send-test`, {
        method: 'POST',
        body: JSON.stringify({ toEmail }),
      });
      setTestStatus(`Test sent to ${toEmail}`);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSendingTest(false);
    }
  };

  /** Uploads one media file to the campaign media endpoint and inserts an image block with that URL. */
  const handleMediaFilePicked = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!campaignId) {
      setMediaError("Open this editor from a campaign before uploading media.");
      return;
    }

    setMediaUploading(true);
    setMediaError(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(new Error("Failed to read selected file"));
        reader.readAsDataURL(file);
      });

      const media = await apiFetch<{ url: string }>(`/api/email-campaigns/${campaignId}/media`, {
        method: "POST",
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          dataBase64: base64,
        }),
      });

      const imageBlock = createDefaultBlock("image");
      const nextImageBlock: EmailBlock = {
        id: imageBlock.id,
        type: "image",
        src: media.url,
        alt: file.name,
        width: 100,
        align: "center",
        padding: 16,
      };

      setTemplate((prev) => ({ ...prev, blocks: [...prev.blocks, nextImageBlock] }));
      setSelectedId(nextImageBlock.id);
      markDirty();
    } catch (error) {
      setMediaError(error instanceof Error ? error.message : "Media upload failed.");
    } finally {
      event.target.value = "";
      setMediaUploading(false);
    }
  }, [campaignId, markDirty]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedBlock = template.blocks.find((b) => b.id === selectedId) ?? null;
  const campaignWorkspaceHref = campaignId ? `/communications/${campaignId}` : "/communications";
  const safeReturnHref = returnTo && returnTo.startsWith("/") ? returnTo : campaignWorkspaceHref;
  const returnLabel = safeReturnHref.startsWith("/communications/") ? "Campaign Workspace" : "Communications";
  const plainTextFallback = useMemo(() => generatePlainText(template), [template]);
  const hasFooterCompliance = template.blocks.some((block) => block.type === 'footerCompliance');
  const hasUnsubscribeToken = template.blocks.some((block) => {
    if (block.type === 'footerCompliance') return block.unsubscribeToken.trim().length > 0;
    if (block.type === 'text' || block.type === 'aiText') {
      return block.content.includes('{{unsubscribeUrl}}') || block.content.includes('{{managePreferencesUrl}}');
    }
    return false;
  });
  const hasMissingImageAlt = template.blocks.some((block) => block.type === 'image' && !block.alt.trim());
  const hasButtonMissingUrl = template.blocks.some((block) => {
    if (block.type === 'button') return !block.href.trim();
    if (block.type === 'donationCta') return !block.buttonUrl.trim();
    if (block.type === 'monthlyDonorInvitation') return !block.ctaUrl.trim();
    if (block.type === 'lapsedDonorReengagement') return !block.ctaUrl.trim();
    if (block.type === 'firstTimeDonorWelcome') return !block.ctaUrl.trim();
    if (block.type === 'impactStory') return !!block.ctaLabel && !block.ctaUrl;
    return false;
  });
  const mergeTokenValidation = useMemo(() => validateTemplateMergeTokens(template), [template]);
  const requiresCompliance = COMPLIANCE_REQUIRED_PURPOSES.has(campaignPurpose);
  const reviewChecks = [
    { label: 'Subject line added', pass: subjectLine.trim().length > 0 },
    { label: 'Preview text added', pass: previewText.trim().length > 0 },
    {
      label: 'Merge tokens are recognized and well-formed',
      pass: mergeTokenValidation.unknownTokens.length === 0 && mergeTokenValidation.malformedBraceCount === 0,
    },
    ...(requiresCompliance
      ? [
        { label: 'Footer compliance block present', pass: hasFooterCompliance },
        { label: 'Unsubscribe or manage preferences present', pass: hasUnsubscribeToken },
      ]
      : []),
    { label: 'Images include alt text', pass: !hasMissingImageAlt },
    { label: 'Buttons include URLs', pass: !hasButtonMissingUrl },
    { label: 'Test email sent in this session', pass: Boolean(testStatus) },
  ];
  const reviewPassCount = reviewChecks.filter((item) => item.pass).length;
  const readinessLabel =
    reviewPassCount === reviewChecks.length
      ? 'Ready to Send'
      : reviewPassCount >= Math.ceil(reviewChecks.length / 2)
        ? 'Needs Review'
        : 'Draft';

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className={`${embedded ? "h-[620px] rounded-xl border border-gray-200" : "h-screen"} flex items-center justify-center bg-gray-50`}>
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-green-600 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-gray-500">Loading campaign…</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className={`${embedded ? "h-[620px] rounded-xl border border-gray-200" : "h-screen"} flex items-center justify-center bg-gray-50`}>
        <div className="bg-white rounded-xl border border-red-200 shadow p-8 max-w-md text-center space-y-4">
          <div className="text-3xl">⚠️</div>
          <h1 className="text-lg font-semibold text-gray-800">Could not load campaign</h1>
          <p className="text-sm text-red-600">{loadError}</p>
          <p className="text-sm text-gray-500">
            You can still use the editor — changes cannot be saved without a valid campaign ID.
          </p>
          <button
            onClick={() => setLoadError(null)}
            className="mt-2 px-4 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"
          >
            Continue anyway
          </button>
        </div>
      </div>
    );
  }

  return (
    <DndContext
      id="email-builder-dnd"
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div
        className={[
          embedded
            ? "h-[calc(100vh-220px)] min-h-[620px] rounded-xl border border-gray-200"
            : "h-screen",
          "min-w-0 flex flex-col bg-white overflow-hidden",
        ].join(" ")}
      >

        {/* ── Top Bar ── */}
        <header className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-200 bg-white shadow-sm z-30">
          {/* Left: back link + campaign name */}
          <div className="flex items-center gap-3">
            <a
              href={safeReturnHref}
              target="_self"
              className="text-xs text-gray-500 hover:text-green-600 transition-colors flex items-center gap-1"
              title={`Back to ${returnLabel}`}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              {returnLabel}
            </a>
            <span className="text-gray-200">|</span>
            <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
              {campaignName}
            </span>
            {campaignId && (
              <span className="text-xs text-gray-400 font-mono">#{campaignId}</span>
            )}
            {campaignId && (
              <a
                href={campaignWorkspaceHref}
                target="_self"
                className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-medium text-gray-600 hover:bg-gray-50"
              >
                Campaign Workspace
              </a>
            )}
          </div>

          <div className="hidden lg:flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1">
            {['Audience', 'Design', 'Personalize', 'Review', 'Schedule'].map((step, index) => (
              <div key={step} className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-gray-600">{step}</span>
                {index < 4 && <span className="text-gray-300">→</span>}
              </div>
            ))}
          </div>

          {/* Right: status + actions */}
          <div className="flex items-center gap-3">
            {/* Save status messages */}
            {saveSuccess && (
              <span className="text-xs text-green-600 font-medium">✓ Saved to Draft</span>
            )}
            {saveError && (
              <span
                className="text-xs text-red-500 max-w-xs truncate cursor-help"
                title={saveError}
              >
                ⚠ {saveError}
              </span>
            )}
            {testStatus && (
              <span className="text-xs text-green-700 max-w-xs truncate" title={testStatus}>
                {testStatus}
              </span>
            )}
            {mediaError && (
              <span className="text-xs text-red-500 max-w-xs truncate" title={mediaError}>
                ⚠ {mediaError}
              </span>
            )}

            <span className="text-xs text-gray-400">
              {template.blocks.length} block{template.blocks.length !== 1 ? 's' : ''}
            </span>
            <span className={`text-xs font-medium ${dirty ? "text-amber-600" : "text-gray-400"}`}>
              {dirty ? "Unsaved changes" : "Saved"}
            </span>
            <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">
              Status: Draft-first
            </span>
            <span
              className={[
                'rounded-md px-2 py-1 text-[11px] font-semibold',
                readinessLabel === 'Ready to Send'
                  ? 'border border-green-200 bg-green-50 text-green-700'
                  : readinessLabel === 'Needs Review'
                    ? 'border border-amber-200 bg-amber-50 text-amber-700'
                    : 'border border-gray-200 bg-gray-100 text-gray-600',
              ].join(' ')}
            >
              {readinessLabel}
            </span>

            {/* Preview */}
            <button
              onClick={() => setShowPreview(true)}
              className="text-sm px-3 py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Preview
            </button>

            {/* Save */}
            <button
              onClick={handleSave}
              disabled={saving || !campaignId || authLoading || loading}
              className={[
                'text-sm px-4 py-1.5 rounded-lg font-medium transition-colors',
                saving
                  ? 'bg-green-400 text-white cursor-wait'
                  : 'bg-green-600 hover:bg-green-700 text-white',
              ].join(' ')}
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </header>

        {/* ── Three-panel body ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: block palette */}
          <BlockPalette />

          {/* Center: email canvas */}
          <EmailCanvas
            template={template}
            selectedId={selectedId}
            onSelectBlock={setSelectedId}
            onDeleteBlock={deleteBlock}
            onMoveBlock={moveBlock}
            onDuplicateBlock={duplicateBlockById}
            onInlineContentChange={updateInlineBlockContent}
          />

          {/* Right: tabbed sidebar */}
          <aside className="w-[360px] shrink-0 border-l border-gray-200 bg-white flex flex-col overflow-hidden">
            <div className="border-b border-gray-200 px-3 py-2">
              <div className="grid grid-cols-5 gap-1 rounded-lg bg-gray-100 p-1">
                {([
                  { key: 'block', label: 'Block' },
                  { key: 'campaign', label: 'Campaign' },
                  { key: 'personalize', label: 'Personalize' },
                  { key: 'review', label: 'Review' },
                  { key: 'ai', label: 'AI' },
                ] as Array<{ key: SidebarTab; label: string }>).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveSidebarTab(tab.key)}
                    className={[
                      'rounded-md px-2 py-1.5 text-xs font-semibold transition-colors',
                      activeSidebarTab === tab.key
                        ? 'bg-white text-green-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-800',
                    ].join(' ')}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {activeSidebarTab === 'block' && (
              <BlockEditor
                embedded
                selectedBlock={selectedBlock}
                template={template}
                onUpdateBlock={updateBlock}
                onUpdateTemplate={updateTemplate}
                onGenerateAiBlock={(id) => {
                  void generateSelectedAiBlock(id);
                }}
                aiGeneratingBlockId={aiGeneratingBlockId}
              />
            )}

            {activeSidebarTab === 'campaign' && (
              <div className="flex-1 overflow-y-auto space-y-4 p-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign Workspace</p>
                  <input
                    value={campaignName}
                    onChange={(event) => {
                      setCampaignName(event.target.value);
                      markDirty();
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="Campaign name"
                  />
                  <input
                    value={subjectLine}
                    onChange={(event) => {
                      setSubjectLine(event.target.value);
                      markDirty();
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="Subject line"
                  />
                  <input
                    value={previewText}
                    onChange={(event) => {
                      setPreviewText(event.target.value);
                      markDirty();
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="Preview text"
                  />
                  <select
                    value={campaignPurpose}
                    onChange={(event) => {
                      setCampaignPurpose(event.target.value as CampaignPurpose);
                      markDirty();
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    {PURPOSE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Layout Actions</p>
                  <select
                    value={preset}
                    onChange={(event) => setPreset(event.target.value as TemplatePreset)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  >
                    <option value="blank">Blank</option>
                    <option value="newsletter">Newsletter</option>
                    <option value="appeal">Donation Appeal</option>
                    <option value="event">Event Invite</option>
                  </select>
                  <button
                    type="button"
                    onClick={applyPreset}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Apply preset
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTemplate((current) => enforceBrandingOnTemplate(current, branding));
                      markDirty();
                    }}
                    className="w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 hover:bg-green-100"
                  >
                    Apply current CRM branding
                  </button>
                  <button
                    type="button"
                    onClick={duplicateSelectedBlock}
                    disabled={!selectedId}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    Duplicate block
                  </button>
                  <input
                    ref={mediaInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(event) => {
                      void handleMediaFilePicked(event);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => mediaInputRef.current?.click()}
                    disabled={mediaUploading || !campaignId}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {mediaUploading ? 'Uploading image...' : 'Upload Image'}
                  </button>
                </div>

                <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Branding Defaults</p>
                  <p className="text-sm font-semibold text-gray-800">{branding.organizationDisplayName || 'Organization branding not configured'}</p>
                  {branding.tagline && <p className="text-xs text-gray-600">{branding.tagline}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <span className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: branding.primaryColor }} />
                    <span className="text-xs text-gray-600">Primary {branding.primaryColor}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 rounded-full border border-gray-200" style={{ backgroundColor: branding.accentColor }} />
                    <span className="text-xs text-gray-600">Accent {branding.accentColor}</span>
                  </div>
                  {branding.contactEmail && <p className="text-xs text-gray-600">Email: {branding.contactEmail}</p>}
                  {branding.contactPhone && <p className="text-xs text-gray-600">Phone: {branding.contactPhone}</p>}
                  {formatBrandingAddress(branding) && <p className="text-xs text-gray-600">Address: {formatBrandingAddress(branding)}</p>}
                  <a
                    href="/settings/branding"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block text-[11px] text-green-700 hover:underline"
                  >
                    Change in Branding Settings →
                  </a>
                </div>

                <div className="space-y-2 rounded-lg border border-gray-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Test Send</p>
                  <input
                    value={testEmail}
                    onChange={(event) => setTestEmail(event.target.value)}
                    className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                    placeholder="Send test to"
                  />
                  <button
                    type="button"
                    onClick={() => void handleSendTest()}
                    disabled={sendingTest || !campaignId || authLoading || loading}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {sendingTest ? 'Sending test...' : 'Send Test'}
                  </button>
                  <p className="text-xs text-gray-500">
                    Draft-first safety: save writes this campaign to DRAFT, and broad sends require explicit review.
                  </p>
                  <p className="text-xs text-gray-400" title={plainTextFallback}>
                    Plain-text fallback: {plainTextFallback || 'No plain-text content yet.'}
                  </p>
                </div>
              </div>
            )}

            {activeSidebarTab === 'personalize' && (
              <div className="flex-1 overflow-y-auto space-y-4 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Merge Field Library</p>
                  <p className="mt-1 text-xs text-gray-500">
                    Click any field to copy it, then paste into block content.
                  </p>
                </div>
                <div className="space-y-3">
                  {Object.entries(MERGE_TOKEN_GROUPS).map(([group, tokens]) => (
                    <div key={group} className="space-y-2 rounded-lg border border-gray-200 p-3">
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">{group}</p>
                      <div className="grid grid-cols-2 gap-2">
                        {tokens.map((token) => (
                          <button
                            key={token}
                            type="button"
                            onClick={() => void copyMergeToken(token)}
                            className="rounded-lg border border-gray-200 bg-white px-2 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                          >
                            {token.replace(/[{}]/g, '')}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                {copiedToken && (
                  <p className="text-xs font-medium text-green-700">Copied {copiedToken}</p>
                )}
              </div>
            )}

            {activeSidebarTab === 'review' && (
              <div className="flex-1 overflow-y-auto space-y-4 p-4">
                <div className="rounded-lg border border-gray-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign Readiness</p>
                  <p className="mt-1 text-sm font-semibold text-gray-800">
                    {reviewPassCount}/{reviewChecks.length} checks complete
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Complete these checks before scheduling or broad send.
                  </p>
                </div>

                <div className="space-y-2 rounded-lg border border-gray-200 bg-white p-3">
                  {reviewChecks.map((check) => (
                    <div key={check.label} className="flex items-center gap-2 text-sm">
                      <span className={check.pass ? 'text-green-600' : 'text-amber-600'}>{check.pass ? '✓' : '•'}</span>
                      <span className={check.pass ? 'text-gray-700' : 'text-gray-500'}>{check.label}</span>
                    </div>
                  ))}
                </div>

                {(mergeTokenValidation.unknownTokens.length > 0 || mergeTokenValidation.malformedBraceCount > 0) && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
                    {mergeTokenValidation.malformedBraceCount > 0 && (
                      <p>Malformed merge braces detected: {mergeTokenValidation.malformedBraceCount}</p>
                    )}
                    {mergeTokenValidation.unknownTokens.length > 0 && (
                      <p title={mergeTokenValidation.unknownTokens.join(', ')}>
                        Unknown merge tokens: {mergeTokenValidation.unknownTokens.slice(0, 3).join(', ')}
                        {mergeTokenValidation.unknownTokens.length > 3 ? '...' : ''}
                      </p>
                    )}
                  </div>
                )}

                {requiresCompliance && !hasFooterCompliance && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                    Add the Footer Compliance block from the Block Library to satisfy unsubscribe and contact requirements.
                  </div>
                )}
              </div>
            )}

            {activeSidebarTab === 'ai' && (
              <div className="flex-1 overflow-y-auto space-y-4 p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Communications AI</p>
                  <p className="mt-1 text-xs text-gray-500">Generate complete donor emails and AI blocks from a brief.</p>
                  {aiModelUsed && (
                    <p className="mt-1 text-xs text-gray-400">Model: {aiModelUsed}</p>
                  )}
                </div>

                <textarea
                  value={aiBrief}
                  onChange={(event) => setAiBrief(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  rows={4}
                  placeholder="Describe the email goal, key message, and action you want donors to take."
                />
                <input
                  value={aiAudience}
                  onChange={(event) => setAiAudience(event.target.value)}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                  placeholder="Audience"
                />
                <select
                  value={aiTone}
                  onChange={(event) => setAiTone(event.target.value as 'warm' | 'informative' | 'celebratory' | 'urgent')}
                  className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <option value="warm">Warm Tone</option>
                  <option value="informative">Informative Tone</option>
                  <option value="celebratory">Celebratory Tone</option>
                  <option value="urgent">Urgent Tone</option>
                </select>
                <div className="grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void generateFullTemplateWithAi()}
                    disabled={aiBusy || loading || authLoading || !user || !aiBrief.trim()}
                    className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                  >
                    {aiBusy ? 'Generating...' : 'Generate Draft'}
                  </button>
                  <button
                    type="button"
                    onClick={() => void generateFullTemplateWithAi({ saveDraft: true })}
                    disabled={aiBusy || loading || authLoading || !user || !campaignId || !aiBrief.trim()}
                    className="w-full rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 disabled:opacity-60"
                  >
                    {aiBusy ? 'Generating...' : 'Generate + Save Draft'}
                  </button>
                </div>

                {!authLoading && !user && (
                  <p className="text-xs text-amber-700">Sign in again to use Communications AI generation.</p>
                )}
                {aiError && <p className="text-xs text-red-600">{aiError}</p>}
              </div>
            )}
          </aside>
        </div>
      </div>

      {/* Drag overlay — ghost shown while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeLabel ? <DragGhost label={activeLabel} /> : null}
      </DragOverlay>

      {/* Preview modal */}
      {showPreview && (
        <EmailPreview
          template={template}
          onClose={() => setShowPreview(false)}
        />
      )}
    </DndContext>
  );
}
