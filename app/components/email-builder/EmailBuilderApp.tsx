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

import type { AiButtonBlock, AiTextBlock, ColumnsBlock as ColumnsBlockData, EmailBlock, EmailTemplate, BlockType } from '@/app/lib/email-builder-types';
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
  "{{taxDeductibleAmount}}",
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

/** Returns true for synthetic/demo campaign ids that should not be used as editable campaign context. */
function isDemoCampaignId(value: string | undefined): boolean {
  if (!value) return false;
  return value.trim().toLowerCase().startsWith("demo_");
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
  /** Starter template used when an embedded campaign cannot be loaded yet. */
  initialTemplate?: EmailTemplate;
  /** Starter campaign metadata used before the API payload returns. */
  initialCampaignName?: string;
  initialSubject?: string;
  initialPreviewText?: string;
  /** Optional callback fired after a successful draft save. */
  onSaved?: () => void | Promise<void>;
  /** Optional callback for embedded hosts that need a live, unsaved preview. */
  onDraftChange?: (draft: {
    template: EmailTemplate;
    subject: string;
    previewText: string;
    bodyHtml: string;
    bodyText: string;
    dirty: boolean;
  }) => void;
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

interface CampaignSendLogEvent {
  id: string;
  action: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface SavedReusableSection {
  id: string;
  name: string;
  block: EmailBlock;
  createdAt: string;
}

type SidebarTab = 'block' | 'campaign' | 'personalize' | 'review' | 'ai';
type CampaignPurpose = 'MARKETING' | 'FUNDRAISING' | 'NEWSLETTER' | 'EVENT_PROMOTION' | 'RECEIPT' | 'THANK_YOU' | 'TRANSACTIONAL' | 'ADMINISTRATIVE' | 'PERSONAL';
type BuilderJourneyStep = 'audience' | 'design' | 'personalize' | 'review' | 'schedule';

const SIDEBAR_TABS: Array<{ key: SidebarTab; label: string; short: string }> = [
  { key: 'block', label: 'Block', short: 'B' },
  { key: 'campaign', label: 'Campaign', short: 'C' },
  { key: 'personalize', label: 'Personalize', short: 'P' },
  { key: 'review', label: 'Review', short: 'R' },
  { key: 'ai', label: 'AI', short: 'AI' },
];

const BUILDER_JOURNEY_STEPS: Array<{ key: BuilderJourneyStep; label: string }> = [
  { key: 'audience', label: 'Audience' },
  { key: 'design', label: 'Design' },
  { key: 'personalize', label: 'Personalize' },
  { key: 'review', label: 'Review' },
  { key: 'schedule', label: 'Schedule' },
];

const BUILDER_JOURNEY_ORDER: Record<BuilderJourneyStep, number> = {
  audience: 0,
  design: 1,
  personalize: 2,
  review: 3,
  schedule: 4,
};

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
const BLOCK_LIBRARY_MIN_WIDTH = 240;
const BLOCK_LIBRARY_MAX_WIDTH = 460;
const BLOCK_LIBRARY_DEFAULT_WIDTH = 304;
const REUSABLE_SECTION_STORAGE_KEY = 'emailBuilder.reusableSections.v1';

/** Converts audit action tokens into human-readable revision labels. */
function formatRevisionAction(action: string): string {
  if (action === 'EMAIL_CAMPAIGN_CREATED') return 'Campaign created';
  if (action === 'EMAIL_CAMPAIGN_UPDATED') return 'Draft updated';
  if (action === 'EMAIL_CAMPAIGN_TEST_SENT') return 'Test sent';
  if (action === 'EMAIL_CAMPAIGN_SCHEDULED') return 'Campaign scheduled';
  if (action === 'EMAIL_CAMPAIGN_CANCELLED') return 'Schedule cancelled';
  if (action === 'EMAIL_CAMPAIGN_SENT') return 'Campaign sent';
  if (action === 'EMAIL_CAMPAIGN_SEND_FAILED') return 'Send failed';
  return action.replace(/^EMAIL_CAMPAIGN_/, '').replace(/_/g, ' ').toLowerCase();
}

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
          ["facebook", "twitter", "instagram", "linkedin", "youtube", "tiktok"].includes(link.platform)
          && link.url,
        )
      : [];
    return {
      ...base,
      type,
      title: String(raw.title ?? (base.type === 'social' ? base.title : 'Stay connected')),
      intro: String(raw.intro ?? (base.type === 'social' ? base.intro : 'Follow along for stories, campaign progress, and ministry updates.')),
      links: links.length > 0
        ? links.map((link) => ({ platform: link.platform as "facebook" | "twitter" | "instagram" | "linkedin" | "youtube" | "tiktok", url: link.url }))
        : base.type === "social"
          ? base.links
          : [
            { platform: "facebook", url: "https://facebook.com" },
            { platform: "instagram", url: "https://instagram.com" },
            { platform: "linkedin", url: "https://linkedin.com" },
            { platform: "tiktok", url: "https://tiktok.com/@yourorg" },
          ],
      variant: raw.variant === 'pill' || raw.variant === 'minimal' ? raw.variant : base.type === 'social' && base.variant ? base.variant : 'card',
      colorMode: raw.colorMode === 'accent' || raw.colorMode === 'neutral' ? raw.colorMode : base.type === 'social' && base.colorMode ? base.colorMode : 'brand',
      backgroundColor: String(raw.backgroundColor ?? (base.type === 'social' ? base.backgroundColor : '#ffffff')),
      textColor: String(raw.textColor ?? (base.type === 'social' ? base.textColor : '#0f172a')),
      accentColor: String(raw.accentColor ?? (base.type === 'social' ? base.accentColor : '#2563ff')),
      borderColor: String(raw.borderColor ?? (base.type === 'social' ? base.borderColor : '#e6e9f2')),
      showLabels: typeof raw.showLabels === 'boolean' ? raw.showLabels : base.type === 'social' ? base.showLabels !== false : true,
      align: raw.align === "left" || raw.align === "right" ? raw.align : "center",
      padding: toBoundedNumber(raw.padding, base.type === 'social' ? base.padding : 20, 0, 100),
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
      return {
        ...block,
        links,
        accentColor: branding.primaryColor || block.accentColor,
        borderColor: branding.accentColor || block.borderColor,
      };
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

/** Ensures persisted/generated templates have unique ids before sortable rendering. */
function normalizeTemplateBlockIds(template: EmailTemplate): EmailTemplate {
  const seen = new Set<string>();

  const normalizeBlock = (block: EmailBlock): EmailBlock => {
    const rawId = typeof block.id === 'string' ? block.id.trim() : '';
    const id = rawId && !seen.has(rawId)
      ? rawId
      : createDefaultBlock(block.type).id;
    seen.add(id);

    if (block.type !== 'columns') {
      return { ...block, id } as EmailBlock;
    }

    return {
      ...block,
      id,
      columns: block.columns.map((column) => column.map((child) => normalizeBlock(child))),
    } as EmailBlock;
  };

  return {
    ...template,
    blocks: Array.isArray(template.blocks) ? template.blocks.map((block) => normalizeBlock(block)) : [],
  };
}

// ─── EmailBuilderApp ──────────────────────────────────────────────────────────

export default function EmailBuilderApp({
  campaignId: requestedCampaignId,
  returnTo,
  embedded = false,
  initialTemplate,
  initialCampaignName,
  initialSubject,
  initialPreviewText,
  onSaved,
  onDraftChange,
}: Props) {
  const normalizedRequestedCampaignId = typeof requestedCampaignId === "string" ? requestedCampaignId.trim() : "";
  const ignoredDemoCampaignId = isDemoCampaignId(normalizedRequestedCampaignId);
  const campaignId = normalizedRequestedCampaignId && !ignoredDemoCampaignId ? normalizedRequestedCampaignId : undefined;

  // ── Template state ─────────────────────────────────────────────────────────
  const [template, setTemplate] = useState<EmailTemplate>(() => normalizeTemplateBlockIds(initialTemplate ?? createDefaultTemplate()));

  // ── UI state ───────────────────────────────────────────────────────────────
  const [selectedId,     setSelectedId]     = useState<string | null>(null);
  const [showPreview,    setShowPreview]     = useState(false);
  const [saving,         setSaving]          = useState(false);
  const [saveError,      setSaveError]       = useState<string | null>(null);
  const [saveSuccess,    setSaveSuccess]     = useState(false);
  const [campaignName,   setCampaignName]    = useState(initialCampaignName || 'Email Campaign');
  const [subjectLine,    setSubjectLine]     = useState(initialSubject || '');
  const [previewText,    setPreviewText]     = useState(initialPreviewText || '');
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
  const [hasPersistedTestSend, setHasPersistedTestSend] = useState(false);
  const [lastPersistedTestSentAt, setLastPersistedTestSentAt] = useState<string | null>(null);
  const [revisionEvents, setRevisionEvents] = useState<CampaignSendLogEvent[]>([]);
  const [reusableSections, setReusableSections] = useState<SavedReusableSection[]>([]);
  const [activeSidebarTab, setActiveSidebarTab] = useState<SidebarTab>('block');
  const [blockLibraryWidth, setBlockLibraryWidth] = useState(BLOCK_LIBRARY_DEFAULT_WIDTH);
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
  const [loading,   setLoading]   = useState(Boolean(campaignId) && !embedded);

  /** Publishes live local builder state to embedded hosts before the draft is saved. */
  useEffect(() => {
    if (!onDraftChange) return;
    const brandedTemplate = enforceBrandingOnTemplate(template, branding);
    onDraftChange({
      template: brandedTemplate,
      subject: subjectLine.trim() || campaignName.trim() || "Email Campaign",
      previewText: previewText.trim(),
      bodyHtml: generateEmailHtml(brandedTemplate),
      bodyText: generatePlainText(brandedTemplate),
      dirty,
    });
  }, [branding, campaignName, dirty, onDraftChange, previewText, subjectLine, template]);

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
    if (!embedded) setLoading(true);
    apiFetch<{ name?: string; subject?: string; previewText?: string; purpose?: CampaignPurpose; templateJson?: string }>(`/api/email-campaigns/${campaignId}`)
      .then((data) => {
        setLoadError(null);
        if (data.name)     setCampaignName(data.name);
        setSubjectLine(data.subject ?? '');
        setPreviewText(data.previewText ?? '');
        setCampaignPurpose(data.purpose ?? 'MARKETING');
        // Avoid clobbering in-progress local edits if the initial load resolves late.
        if (!dirtyRef.current && data.templateJson) {
          try {
            setTemplate(normalizeTemplateBlockIds(JSON.parse(data.templateJson) as EmailTemplate));
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
  }, [campaignId, authLoading, embedded]);

  /** Loads persisted test-send evidence so readiness survives page reloads. */
  useEffect(() => {
    if (!campaignId) return;
    if (authLoading) return;

    let cancelled = false;
    apiFetch<CampaignSendLogEvent[]>(`/api/email-campaigns/${campaignId}/send-log?limit=100`)
      .then((rows) => {
        if (cancelled) return;
        const sendLogs = Array.isArray(rows) ? rows : [];
        setRevisionEvents(sendLogs);
        const latestTestSend = sendLogs.find((entry) => entry.action === 'EMAIL_CAMPAIGN_TEST_SENT') ?? null;
        setHasPersistedTestSend(Boolean(latestTestSend));
        setLastPersistedTestSentAt(latestTestSend?.createdAt ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setRevisionEvents([]);
        setHasPersistedTestSend(false);
        setLastPersistedTestSentAt(null);
      });

    return () => {
      cancelled = true;
    };
  }, [campaignId, authLoading, testStatus]);

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

  /** Restores saved block-library width from local storage on first mount. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedWidthRaw = window.localStorage.getItem('emailBuilder.blockLibraryWidth');
    const savedWidth = Number.parseInt(savedWidthRaw ?? '', 10);
    if (!Number.isFinite(savedWidth)) return;
    setBlockLibraryWidth(Math.min(BLOCK_LIBRARY_MAX_WIDTH, Math.max(BLOCK_LIBRARY_MIN_WIDTH, savedWidth)));
  }, []);

  /** Persists block-library width changes so staff keep their preferred layout density. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('emailBuilder.blockLibraryWidth', String(blockLibraryWidth));
  }, [blockLibraryWidth]);

  /** Loads reusable section snippets saved from prior editing sessions. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(REUSABLE_SECTION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as SavedReusableSection[];
      if (!Array.isArray(parsed)) return;
      const normalized = parsed
        .filter((item) => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.name === 'string' && item.block)
        .slice(0, 20);
      setReusableSections(normalized);
    } catch {
      // Ignore malformed local storage payloads.
    }
  }, []);

  /** Persists reusable section snippets so staff can reinsert them later. */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(REUSABLE_SECTION_STORAGE_KEY, JSON.stringify(reusableSections));
  }, [reusableSections]);

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
    const overTarget = over.data.current?.target as string | undefined;
    const overParentBlockId = over.data.current?.parentBlockId as string | undefined;
    const overColumnIndex = over.data.current?.columnIndex as number | undefined;
    const overIsColumnSlot = overTarget === 'columns-slot' && typeof overParentBlockId === 'string' && typeof overColumnIndex === 'number';

    if (overIsColumnSlot && overParentBlockId) {
      if (origin === 'palette') {
        const blockType = active.data.current?.blockType as BlockType;
        if (!blockType || blockType === 'columns') return;
        const newBlock = applyBrandingToBlock(createDefaultBlock(blockType), branding);

        setTemplate((prev) => {
          const parentIndex = prev.blocks.findIndex((b) => b.id === overParentBlockId && b.type === 'columns');
          if (parentIndex === -1) return prev;

          const blocks = [...prev.blocks];
          const parentBlock = blocks[parentIndex] as ColumnsBlockData;
          const totalColumns = parentBlock.columnCount === 3 ? 3 : 2;
          if (overColumnIndex < 0 || overColumnIndex >= totalColumns) return prev;

          const nextColumns = Array.from({ length: totalColumns }, (_, index) => [
            ...(parentBlock.columns[index] ?? []),
          ]);
          nextColumns[overColumnIndex].push(newBlock);

          blocks[parentIndex] = {
            ...parentBlock,
            columns: nextColumns,
          };

          return { ...prev, blocks };
        });

        setSelectedId(overParentBlockId);
        markDirty();
        return;
      }

      if (origin === 'canvas') {
        const activeId = String(active.id);
        if (activeId === overParentBlockId) return;

        setTemplate((prev) => {
          const activeIndex = prev.blocks.findIndex((b) => b.id === activeId);
          if (activeIndex === -1) return prev;

          const movingBlock = prev.blocks[activeIndex];
          if (movingBlock.type === 'columns') return prev;

          const parentIndex = prev.blocks.findIndex((b) => b.id === overParentBlockId && b.type === 'columns');
          if (parentIndex === -1) return prev;

          const blocks = [...prev.blocks];
          const [extractedBlock] = blocks.splice(activeIndex, 1);
          const normalizedParentIndex = activeIndex < parentIndex ? parentIndex - 1 : parentIndex;
          const parentBlock = blocks[normalizedParentIndex] as ColumnsBlockData;
          const totalColumns = parentBlock.columnCount === 3 ? 3 : 2;
          if (overColumnIndex < 0 || overColumnIndex >= totalColumns) return prev;

          const nextColumns = Array.from({ length: totalColumns }, (_, index) => [
            ...(parentBlock.columns[index] ?? []),
          ]);
          nextColumns[overColumnIndex].push(extractedBlock);

          blocks[normalizedParentIndex] = {
            ...parentBlock,
            columns: nextColumns,
          };

          return { ...prev, blocks };
        });

        setSelectedId(overParentBlockId);
        markDirty();
        return;
      }
    }

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

  /** Saves the currently selected block as a reusable section snippet for future campaigns. */
  const saveSelectedAsReusableSection = useCallback(() => {
    if (!selectedId) return;
    const selectedBlock = template.blocks.find((block) => block.id === selectedId);
    if (!selectedBlock) return;

    const nowIso = new Date().toISOString();
    const fallbackName = `${selectedBlock.type} section`;
    const nextSection: SavedReusableSection = {
      id: globalThis.crypto?.randomUUID?.() ?? `section-${Date.now()}`,
      name: fallbackName,
      block: JSON.parse(JSON.stringify(selectedBlock)) as EmailBlock,
      createdAt: nowIso,
    };

    setReusableSections((prev) => [nextSection, ...prev].slice(0, 20));
  }, [selectedId, template.blocks]);

  /** Inserts one reusable section snippet into the canvas with a fresh block id. */
  const insertReusableSection = useCallback((sectionId: string) => {
    const section = reusableSections.find((item) => item.id === sectionId);
    if (!section) return;
    const freshId = createDefaultBlock(section.block.type).id;
    const nextBlock = {
      ...(JSON.parse(JSON.stringify(section.block)) as EmailBlock),
      id: freshId,
    } as EmailBlock;

    setTemplate((prev) => ({ ...prev, blocks: [...prev.blocks, nextBlock] }));
    setSelectedId(nextBlock.id);
    markDirty();
  }, [markDirty, reusableSections]);

  /** Removes one reusable section snippet from local library storage. */
  const deleteReusableSection = useCallback((sectionId: string) => {
    setReusableSections((prev) => prev.filter((item) => item.id !== sectionId));
  }, []);

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

  /** Starts drag-resizing for the block library pane while clamping to ergonomic min/max widths. */
  const handleBlockLibraryResizeStart = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = blockLibraryWidth;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const nextWidth = startWidth + delta;
      setBlockLibraryWidth(Math.min(BLOCK_LIBRARY_MAX_WIDTH, Math.max(BLOCK_LIBRARY_MIN_WIDTH, nextWidth)));
    };

    const handleMouseUp = () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  }, [blockLibraryWidth]);

  /** Appends a new block to the end of the canvas and selects it for immediate editing. */
  const appendBlock = useCallback((type: BlockType, transform?: (block: EmailBlock) => EmailBlock) => {
    const brandedBlock = applyBrandingToBlock(createDefaultBlock(type), branding);
    const nextBlock = transform ? transform(brandedBlock) : brandedBlock;
    setTemplate((prev) => ({ ...prev, blocks: [...prev.blocks, nextBlock] }));
    setSelectedId(nextBlock.id);
    markDirty();
  }, [branding, markDirty]);

  /** Inserts a dedicated organization logo block using Branding Settings as the source of truth. */
  const addOrganizationLogoBlock = useCallback(() => {
    appendBlock('image', (block) => {
      if (block.type !== 'image') return block;
      const logoUrl = branding.logoUrl.trim();
      if (!logoUrl) {
        setMediaError('Set a logo in Branding Settings first, then add the logo block again.');
      }
      return {
        ...block,
        src: logoUrl,
        alt: `${branding.organizationDisplayName || 'Organization'} logo`,
        width: 42,
        align: 'left',
      };
    });
  }, [appendBlock, branding.logoUrl, branding.organizationDisplayName]);

  /** Adds a three-column content grid block for campaign layouts on desktop and mobile email clients. */
  const addThreeColumnGridBlock = useCallback(() => {
    appendBlock('columns', (block) => {
      if (block.type !== 'columns') return block;
      const createColumnTextBlock = (label: string): EmailBlock => ({
        id: crypto.randomUUID(),
        type: 'text',
        content: `<p><strong>${label}</strong><br/>Add one concise highlight.</p>`,
        fontSize: 14,
        color: '#333333',
        align: 'left',
        padding: 8,
      });
      return {
        ...block,
        columnCount: 3,
        columns: [
          [createColumnTextBlock('Column 1')],
          [createColumnTextBlock('Column 2')],
          [createColumnTextBlock('Column 3')],
        ],
      };
    });
  }, [appendBlock]);

  /** Replaces the current canvas with a starter preset template. */
  const applyPreset = () => {
    const next = normalizeTemplateBlockIds(enforceBrandingOnTemplate(createTemplateFromPreset(preset), branding));
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

      const nextTemplate = normalizeTemplateBlockIds(enforceBrandingOnTemplate({
        backgroundColor: String(draftTemplate.backgroundColor ?? "#f5f5f5"),
        contentWidth: toBoundedNumber(draftTemplate.contentWidth, 600, 420, 760),
        fontFamily: String(draftTemplate.fontFamily ?? "Arial, Helvetica, sans-serif"),
        blocks: generatedBlocks,
      }, branding));

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

  const handleSave = useCallback(async () => {
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
  }, [
    branding,
    campaignId,
    campaignName,
    campaignPurpose,
    onSaved,
    previewText,
    subjectLine,
    template,
  ]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        event.preventDefault();
      }
      if (!campaignId || saving || authLoading || loading) return;
      event.preventDefault();
      void handleSave();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [campaignId, saving, authLoading, loading, handleSave]);

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
      setHasPersistedTestSend(true);
      setLastPersistedTestSentAt(new Date().toISOString());
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSendingTest(false);
    }
  };

  /** Uploads a media file and returns the public URL used by email image blocks. */
  const uploadMediaFile = useCallback(async (file: File): Promise<string> => {
    if (!campaignId) {
      throw new Error('Open this editor from a campaign before uploading media.');
    }

    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ''));
      reader.onerror = () => reject(new Error('Failed to read selected file'));
      reader.readAsDataURL(file);
    });

    const media = await apiFetch<{ url: string }>(`/api/email-campaigns/${campaignId}/media`, {
      method: 'POST',
      body: JSON.stringify({
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        dataBase64: base64,
      }),
    });

    return media.url;
  }, [campaignId]);

  /** Shared uploader used by both the campaign actions panel and Image block editor controls. */
  const uploadMediaWithStatus = useCallback(async (file: File): Promise<string> => {
    setMediaUploading(true);
    setMediaError(null);
    try {
      return await uploadMediaFile(file);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Media upload failed.';
      setMediaError(message);
      throw new Error(message);
    } finally {
      setMediaUploading(false);
    }
  }, [uploadMediaFile]);

  /** Uploads one media file to the campaign media endpoint and inserts an image block with that URL. */
  const handleMediaFilePicked = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const mediaUrl = await uploadMediaWithStatus(file);

      const imageBlock = createDefaultBlock("image");
      const nextImageBlock: EmailBlock = {
        id: imageBlock.id,
        type: "image",
        src: mediaUrl,
        alt: file.name,
        width: 100,
        align: "center",
        padding: 16,
      };

      setTemplate((prev) => ({ ...prev, blocks: [...prev.blocks, nextImageBlock] }));
      setSelectedId(nextImageBlock.id);
      markDirty();
    } catch {
      // uploadMediaWithStatus already publishes a user-facing error.
    } finally {
      event.target.value = "";
    }
  }, [markDirty, uploadMediaWithStatus]);

  /** Enables direct upload from Image block controls and returns the new media URL. */
  const handleImageBlockUpload = useCallback(async (file: File): Promise<string> => {
    return uploadMediaWithStatus(file);
  }, [uploadMediaWithStatus]);

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedBlock = template.blocks.find((b) => b.id === selectedId) ?? null;
  const campaignWorkspaceHref = campaignId ? `/communications/${campaignId}` : "/communications";
  const safeReturnHref = returnTo && returnTo.startsWith("/") ? returnTo : campaignWorkspaceHref;
  const returnLabel = safeReturnHref.startsWith("/communications/") ? "Campaign Workspace" : "Communications";
  const audienceWorkspaceHref = campaignId ? `/communications/${campaignId}?mode=send#audience` : safeReturnHref;
  const scheduleWorkspaceHref = campaignId ? `/communications/${campaignId}?mode=send#schedule` : safeReturnHref;
  const reviewRouteHref = campaignId ? `/communications/${campaignId}/review` : safeReturnHref;
  const scheduleRouteHref = campaignId ? `/communications/${campaignId}/schedule` : safeReturnHref;
  const activityRouteHref = campaignId ? `/communications/${campaignId}?mode=activity` : safeReturnHref;
  const fullScreenBuilderHref = useMemo(() => {
    const params = new URLSearchParams();
    if (campaignId) params.set('campaign', campaignId);
    params.set('returnTo', safeReturnHref);
    return `/email-builder?${params.toString()}`;
  }, [campaignId, safeReturnHref]);
  const currentJourneyStep: BuilderJourneyStep =
    activeSidebarTab === 'personalize'
      ? 'personalize'
      : activeSidebarTab === 'review'
        ? 'review'
        : 'design';
  const generatedHtmlPreview = useMemo(() => generateEmailHtml(template), [template]);
  const plainTextFallback = useMemo(() => generatePlainText(template), [template]);
  const hasFooterCompliance =
    template.blocks.some((block) => block.type === 'footerCompliance')
    || generatedHtmlPreview.includes('{{unsubscribeUrl}}')
    || generatedHtmlPreview.includes('{{managePreferencesUrl}}');
  const hasUnsubscribeToken = template.blocks.some((block) => {
    if (block.type === 'footerCompliance') return block.unsubscribeToken.trim().length > 0;
    if (block.type === 'text' || block.type === 'aiText') {
      return block.content.includes('{{unsubscribeUrl}}') || block.content.includes('{{managePreferencesUrl}}');
    }
    return false;
  }) || generatedHtmlPreview.includes('{{unsubscribeUrl}}') || generatedHtmlPreview.includes('{{managePreferencesUrl}}');
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
  const hasSavedDraft = !dirty;
  const hasRouteContext = Boolean(campaignId && campaignId.trim().length > 0);
  const canSaveDraftAction = Boolean(campaignId) && !saving && !authLoading && !loading;
  const hasTestEvidence = Boolean(testStatus) || hasPersistedTestSend;
  const reviewChecks = [
    { label: 'Subject line added', pass: subjectLine.trim().length > 0 },
    { label: 'Preview text added', pass: previewText.trim().length > 0 },
    { label: 'Draft saved (no pending unsaved changes)', pass: hasSavedDraft },
    { label: 'Campaign route context available', pass: hasRouteContext },
    {
      label: 'Merge tokens are recognized and well-formed',
      pass: mergeTokenValidation.unknownTokens.length === 0 && mergeTokenValidation.malformedBraceCount === 0,
    },
    ...(requiresCompliance
      ? [
        { label: 'Footer compliance included', pass: hasFooterCompliance },
        { label: 'Unsubscribe or manage preferences included', pass: hasUnsubscribeToken },
      ]
      : []),
    { label: 'Images include alt text', pass: !hasMissingImageAlt },
    { label: 'Buttons include URLs', pass: !hasButtonMissingUrl },
    { label: 'Test email sent (session or activity log)', pass: hasTestEvidence },
  ];
  const reviewPassCount = reviewChecks.filter((item) => item.pass).length;
  const readinessPercent = Math.round((reviewPassCount / Math.max(reviewChecks.length, 1)) * 100);
  const lastTestSendLabel = lastPersistedTestSentAt
    ? new Date(lastPersistedTestSentAt).toLocaleString()
    : null;
  const readinessLabel =
    reviewPassCount === reviewChecks.length
      ? 'Ready to Send'
      : reviewPassCount >= Math.ceil(reviewChecks.length / 2)
        ? 'Needs Review'
        : 'Draft';

  /** Opens the builder in a separate popout window, with new-tab fallback when blocked. */
  const openBuilderPopout = useCallback(() => {
    if (typeof window === 'undefined') return;
    const popout = window.open(
      fullScreenBuilderHref,
      'oyamacrm-email-builder-popout',
      'popup=yes,width=1560,height=920,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes',
    );
    if (!popout) {
      window.open(fullScreenBuilderHref, '_blank', 'noopener,noreferrer');
    }
  }, [fullScreenBuilderHref]);

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

  if (loadError && !embedded) {
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
            ? "h-[calc(100vh-130px)] min-h-[600px] rounded-xl border border-slate-200"
            : "h-screen",
          "min-w-0 flex flex-col overflow-hidden bg-[#f5f7fb]",
        ].join(" ")}
      >

        {/* ── Top Bar ── */}
        {loadError && embedded ? (
          <div className="shrink-0 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            <span className="font-semibold">Campaign load issue:</span> {loadError} The editor is using the local draft blocks until the API reconnects.
          </div>
        ) : null}
        <header className="z-30 shrink-0 border-b border-slate-200 bg-white px-4 shadow-sm" style={{ paddingTop: embedded ? '8px' : '10px', paddingBottom: embedded ? '8px' : '10px' }}>
          {/* Compact single-row header in embedded mode */}
          {embedded ? (
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-xs text-slate-600">
                <span
                  className={[
                    'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                    readinessLabel === 'Ready to Send'
                      ? 'border border-blue-200 bg-blue-50 text-blue-700'
                      : readinessLabel === 'Needs Review'
                        ? 'border border-amber-200 bg-amber-50 text-amber-700'
                        : 'border border-slate-200 bg-slate-100 text-slate-600',
                  ].join(' ')}
                >
                  {readinessLabel}
                </span>
                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">{template.blocks.length} block{template.blocks.length !== 1 ? 's' : ''}</span>
                <span className={dirty ? 'font-medium text-amber-700' : 'text-slate-400'}>{dirty ? 'Unsaved' : 'Saved'}</span>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-1.5">
                <a href={fullScreenBuilderHref} target="_self" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Fullscreen</a>
                <a href={fullScreenBuilderHref} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">New Tab</a>
                <button type="button" onClick={openBuilderPopout} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50">Popout</button>
                <button
                  onClick={handleSave}
                  disabled={!canSaveDraftAction}
                  className={['rounded-lg px-3 py-1 text-xs font-semibold transition-colors', saving ? 'bg-blue-400 text-white cursor-wait' : 'bg-blue-600 hover:bg-blue-700 text-white'].join(' ')}
                  title={canSaveDraftAction ? 'Save draft (Ctrl/Cmd+S)' : 'Open this builder from a campaign route to save'}
                >
                  {saving ? 'Saving…' : 'Save Draft'}
                </button>
              </div>
            </div>
          ) : (
          <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <a
                  href={safeReturnHref}
                  target="_self"
                  className="text-slate-500 hover:text-blue-600 transition-colors flex items-center gap-1"
                  title={`Back to ${returnLabel}`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M19 12H5M12 19l-7-7 7-7" />
                  </svg>
                  {returnLabel}
                </a>
                <span className="text-slate-300">/</span>
                <span className="font-medium text-slate-700">Email Draft: {campaignName}</span>
              </div>
            </div>

            <div className="flex max-w-full flex-wrap items-center justify-end gap-2">
              <div className="hidden items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 lg:inline-flex">
                <button type="button" className="rounded-md bg-blue-50 px-2.5 py-1.5 text-blue-700 ring-1 ring-blue-200" title="Desktop preview">▣</button>
                <button type="button" className="rounded-md px-2.5 py-1.5 text-slate-500 hover:bg-white" title="Tablet preview">▯</button>
                <button type="button" className="rounded-md px-2.5 py-1.5 text-slate-500 hover:bg-white" title="Mobile preview">▯</button>
              </div>

              {embedded && (
                <>
                  <a
                    href={fullScreenBuilderHref}
                    target="_self"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Fullscreen
                  </a>
                  <a
                    href={fullScreenBuilderHref}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    New Tab
                  </a>
                  <button
                    type="button"
                    onClick={openBuilderPopout}
                    className="rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Popout
                  </button>
                </>
              )}

              <button
                onClick={() => setShowPreview(true)}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
              >
                Preview
              </button>
              <button
                type="button"
                onClick={() => void handleSendTest()}
                disabled={sendingTest || !campaignId || authLoading || loading}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-50"
                title={campaignId ? `Send test to ${testEmail || 'your test address'}` : 'Open this builder from a campaign route to send tests'}
              >
                {sendingTest ? 'Sending…' : 'Send Test'}
              </button>

              <button
                onClick={handleSave}
                disabled={!canSaveDraftAction}
                className={[
                  'rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors',
                  saving
                    ? 'bg-blue-400 text-white cursor-wait'
                    : 'bg-blue-600 hover:bg-blue-700 text-white',
                ].join(' ')}
                title={canSaveDraftAction ? 'Save draft (Ctrl/Cmd+S)' : 'Open this builder from a campaign route to save'}
              >
                {saving ? 'Saving…' : 'Save Draft'}
              </button>
            </div>
          </div>

          {!hasRouteContext && (
            <div className="mt-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              {ignoredDemoCampaignId
                ? "Route context missing: this builder was opened with a demo campaign id. Select or create a real campaign to save drafts and send tests."
                : "Route context missing: this builder was opened without a campaign id, so draft saves and test sends are disabled."}
            </div>
          )}

          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-2 py-2">
            <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Current stage: {BUILDER_JOURNEY_STEPS.find((step) => step.key === currentJourneyStep)?.label}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {BUILDER_JOURNEY_STEPS.map((step, index) => {
                const isCurrent = step.key === currentJourneyStep;
                const isComplete = BUILDER_JOURNEY_ORDER[step.key] < BUILDER_JOURNEY_ORDER[currentJourneyStep];
                const stepClassName = [
                  "inline-flex items-center rounded px-2 py-1 text-[11px] font-semibold transition-colors",
                  isCurrent
                    ? "border border-blue-300 bg-blue-100 text-blue-800"
                    : isComplete
                      ? "border border-blue-200 bg-blue-50 text-blue-700"
                      : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100",
                ].join(" ");

                let stageAction: React.ReactNode;
                if (step.key === 'audience') {
                  stageAction = (
                    <a href={audienceWorkspaceHref} target="_self" className={stepClassName}>
                      {step.label}
                    </a>
                  );
                } else if (step.key === 'schedule') {
                  stageAction = (
                    <a href={scheduleWorkspaceHref} target="_self" className={stepClassName}>
                      {step.label}
                    </a>
                  );
                } else {
                  const sidebarTabTarget: SidebarTab =
                    step.key === 'personalize' ? 'personalize' : step.key === 'review' ? 'review' : 'block';

                  stageAction = (
                    <button
                      type="button"
                      onClick={() => setActiveSidebarTab(sidebarTabTarget)}
                      className={stepClassName}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      {step.label}
                    </button>
                  );
                }

                return (
                  <div key={step.key} className="inline-flex items-center gap-1.5">
                    {stageAction}
                    {index < BUILDER_JOURNEY_STEPS.length - 1 && <span className="text-slate-300">→</span>}
                  </div>
                );
              })}
            </div>
          </div>

          {(saveSuccess || saveError || testStatus || mediaError) && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              {saveSuccess && (
                <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700 shadow-sm">
                  Saved to Draft
                </span>
              )}
              {saveError && (
                <span className="max-w-full rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-600 shadow-sm" title={saveError}>
                  Save issue: {saveError}
                </span>
              )}
              {testStatus && (
                <span className="max-w-full rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-emerald-700 shadow-sm" title={testStatus}>
                  {testStatus}
                </span>
              )}
              {mediaError && (
                <span className="max-w-full rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-red-600 shadow-sm" title={mediaError}>
                  Media issue: {mediaError}
                </span>
              )}
            </div>
          )}
          </>
          )}
        </header>

        {!embedded && (
          <div className="shrink-0 border-b border-slate-200 bg-white px-4 py-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-1.5 font-semibold text-emerald-700">✓ Saved</span>
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-600">{template.blocks.length} block{template.blocks.length !== 1 ? 's' : ''}</span>
              <span className={dirty ? 'rounded-lg border border-amber-100 bg-amber-50 px-3 py-1.5 font-semibold text-amber-700' : 'rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 font-semibold text-slate-500'}>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
              <span className={[
                'rounded-lg px-3 py-1.5 font-semibold',
                readinessLabel === 'Ready to Send'
                  ? 'border border-blue-200 bg-blue-50 text-blue-700'
                  : readinessLabel === 'Needs Review'
                    ? 'border border-amber-200 bg-amber-50 text-amber-700'
                    : 'border border-slate-200 bg-slate-50 text-slate-600',
              ].join(' ')}>{readinessLabel}</span>
              {campaignId ? <a href={campaignWorkspaceHref} target="_self" className="ml-auto rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-600 hover:bg-slate-50">Open Campaign Workspace</a> : null}
            </div>
          </div>
        )}

        {/* ── Three-panel body ── */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: block palette */}
          <div className="min-w-0 shrink-0" style={{ width: blockLibraryWidth }}>
            <BlockPalette />
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize block library"
            title="Drag to resize block library. Double-click to reset."
            onMouseDown={handleBlockLibraryResizeStart}
            onDoubleClick={() => setBlockLibraryWidth(BLOCK_LIBRARY_DEFAULT_WIDTH)}
            className="group relative w-2 shrink-0 cursor-col-resize bg-slate-50 hover:bg-blue-50 active:bg-blue-100"
          >
            <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-slate-200 group-hover:bg-blue-400 group-active:bg-blue-600" />
          </div>

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
          <aside className="w-[340px] shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="border-b border-slate-200 bg-white px-3 py-3">
              <div className="grid grid-cols-5 gap-1 border-b border-slate-200">
                {SIDEBAR_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveSidebarTab(tab.key)}
                    className={[
                      'border-b-2 px-1.5 py-2 text-[11px] font-semibold transition-colors',
                      activeSidebarTab === tab.key
                        ? 'border-blue-600 text-blue-700'
                        : 'border-transparent text-slate-600 hover:text-slate-800',
                    ].join(' ')}
                  >
                    <span className="block truncate">{tab.label}</span>
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
                onUploadImage={handleImageBlockUpload}
                imageUploadInProgress={mediaUploading}
                organizationLogoUrl={branding.logoUrl}
                organizationDisplayName={branding.organizationDisplayName}
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
                    onClick={addOrganizationLogoBlock}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Add Organization Logo Block
                  </button>
                  <button
                    type="button"
                    onClick={addThreeColumnGridBlock}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Add 3-Column Grid Block
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
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Reusable Sections</p>
                    <button
                      type="button"
                      onClick={saveSelectedAsReusableSection}
                      disabled={!selectedId}
                      className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                    >
                      Save selected
                    </button>
                  </div>

                  {reusableSections.length === 0 ? (
                    <p className="text-xs text-gray-500">Save a selected block to build your reusable section library.</p>
                  ) : (
                    <div className="space-y-2">
                      {reusableSections.slice(0, 6).map((section) => (
                        <div key={section.id} className="rounded-md border border-gray-200 bg-gray-50 p-2">
                          <p className="text-xs font-semibold text-gray-700">{section.name}</p>
                          <p className="mt-0.5 text-[11px] text-gray-500">{section.block.type} · {new Date(section.createdAt).toLocaleDateString()}</p>
                          <div className="mt-2 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => insertReusableSection(section.id)}
                              className="rounded-md border border-gray-300 bg-white px-2 py-1 text-[11px] font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              Insert
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteReusableSection(section.id)}
                              className="rounded-md border border-gray-200 bg-white px-2 py-1 text-[11px] font-semibold text-gray-500 hover:bg-gray-50"
                            >
                              Remove
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
                <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Campaign Readiness</p>
                      <p className="mt-1 text-sm font-semibold text-gray-800">
                        {reviewPassCount}/{reviewChecks.length} checks complete
                      </p>
                    </div>
                    <span
                      className={[
                        'rounded-md px-2 py-0.5 text-[11px] font-semibold',
                        readinessLabel === 'Ready to Send'
                          ? 'border border-green-200 bg-green-50 text-green-700'
                          : readinessLabel === 'Needs Review'
                            ? 'border border-amber-200 bg-amber-50 text-amber-700'
                            : 'border border-gray-200 bg-gray-50 text-gray-600',
                      ].join(' ')}
                    >
                      {readinessLabel}
                    </span>
                  </div>

                  <div className="mt-2 h-2 rounded-full bg-gray-100">
                    <div
                      className="h-2 rounded-full bg-green-500 transition-all"
                      style={{ width: `${readinessPercent}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-gray-500">
                    Complete these checks before scheduling or broad send.
                  </p>
                  {lastTestSendLabel && (
                    <p className="mt-1 text-[11px] text-gray-400">Latest test send: {lastTestSendLabel}</p>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Checklist</p>
                  {reviewChecks.map((check) => (
                    <div
                      key={check.label}
                      className={[
                        'flex items-center justify-between gap-2 rounded-md border px-2 py-1.5 text-sm',
                        check.pass
                          ? 'border-green-100 bg-green-50/40'
                          : 'border-amber-100 bg-amber-50/40',
                      ].join(' ')}
                    >
                      <span className={check.pass ? 'text-gray-700' : 'text-gray-600'}>{check.label}</span>
                      <span className={check.pass ? 'text-green-600' : 'text-amber-600'}>{check.pass ? 'PASS' : 'CHECK'}</span>
                    </div>
                  ))}
                </div>

                <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Route Checks</p>
                  <div className="grid grid-cols-2 gap-2">
                    <a href={campaignWorkspaceHref} target="_self" className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Campaign</a>
                    <a href={fullScreenBuilderHref} target="_self" className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Builder</a>
                    <a href={reviewRouteHref} target="_self" className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Review</a>
                    <a href={scheduleRouteHref} target="_self" className="rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Schedule</a>
                    <a href={activityRouteHref} target="_self" className="col-span-2 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50">Activity Log</a>
                  </div>
                  {!hasRouteContext && (
                    <p className="text-xs text-amber-700">Route context is missing. Open this workspace from a campaign page.</p>
                  )}
                </div>

                <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">Revision History</p>
                  {revisionEvents.length === 0 ? (
                    <p className="text-xs text-gray-500">No recorded campaign revisions yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {revisionEvents.slice(0, 8).map((event) => (
                        <div key={event.id} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1.5">
                          <div className="flex items-center justify-between gap-2">
                            <p className="text-xs font-semibold text-gray-700">{formatRevisionAction(event.action)}</p>
                            <p className="text-[11px] text-gray-500">{new Date(event.createdAt).toLocaleString()}</p>
                          </div>
                          {event.user?.name && (
                            <p className="mt-0.5 text-[11px] text-gray-500">By {event.user.name}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {(mergeTokenValidation.unknownTokens.length > 0 || mergeTokenValidation.malformedBraceCount > 0) && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 space-y-1">
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
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
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
          campaignId={campaignId}
          isDirty={dirty}
          onClose={() => setShowPreview(false)}
        />
      )}
    </DndContext>
  );
}
