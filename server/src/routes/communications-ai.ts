/** Communications AI routes provide robust AI generation tools for Email Builder workflows. */
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requirePermission } from "../middleware/requirePermission.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import {
  defaultStewardAiConfig,
  parseStewardAiConfig,
  runStewardAiChat,
  runStewardAiChatStream,
  type StewardAiChatMessage,
} from "../services/steward-ai-ollama.js";

const router = Router();
const STEWARD_AI_PLUGIN_KEY = "steward_ai";

type SupportedBuilderBlockKind =
  | "heading"
  | "text"
  | "quote"
  | "impactStat"
  | "impactStory"
  | "impactGrid"
  | "timeline"
  | "callout"
  | "progress"
  | "featureList"
  | "donorThankYou"
  | "donationReceipt"
  | "givingSummary"
  | "donationCta"
  | "monthlyDonorInvitation"
  | "lapsedDonorReengagement"
  | "firstTimeDonorWelcome"
  | "staffSignature"
  | "footerCompliance"
  | "image"
  | "video"
  | "social"
  | "button"
  | "aiText"
  | "aiButton"
  | "divider"
  | "spacer"
  | "columns"
  | "customHtml";

interface BuilderTemplateGenerationPayload {
  goal?: string;
  audience?: string;
  tone?: string;
  campaignName?: string;
}

interface BuilderBlockGenerationPayload {
  blockKind?: "aiText" | "aiButton";
  prompt?: string;
  tone?: "warm" | "urgent" | "celebratory" | "informative";
}

interface BuilderWritingStreamPayload {
  target?: "subject" | "previewText" | "bodyHtml" | "cta";
  mode?: "standard" | "smartHtml";
  prompt?: string;
  tone?: "warm" | "urgent" | "celebratory" | "informative";
  audience?: string;
  campaignName?: string;
  currentContent?: string;
  allowedMergeFields?: string[];
}

interface BuilderTemplateDraft {
  backgroundColor?: string;
  contentWidth?: number;
  fontFamily?: string;
  blocks?: BuilderBlockDraft[];
}

interface BuilderBlockDraft {
  type?: SupportedBuilderBlockKind;
  eyebrow?: string;
  headline?: string;
  title?: string;
  subtitle?: string;
  content?: string;
  fontSize?: number;
  color?: string;
  align?: "left" | "center" | "right";
  padding?: number;
  quote?: string;
  attribution?: string;
  value?: string;
  label?: string;
  sublabel?: string;
  bgColor?: string;
  bulletColor?: string;
  textColor?: string;
  href?: string;
  prompt?: string;
  tone?: "warm" | "urgent" | "celebratory" | "informative";
  borderRadius?: number;
  thickness?: number;
  height?: number;
  current?: number;
  goal?: number;
  barColor?: string;
  trackColor?: string;
  body?: string;
  story?: string;
  message?: string;
  appealText?: string;
  borderColor?: string;
  accentColor?: string;
  items?: Array<string | { value?: string; label?: string; title?: string; detail?: string }>;
  benefitBullets?: string[];
  suggestedMonthlyAmounts?: string[];
  whatToExpect?: string;
  contactPerson?: string;
  missionIntro?: string;
  greeting?: string;
  impactReminder?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  imageUrl?: string;
  pseudonym?: string;
  outcome?: string;
  yearToken?: string;
  totalGivingToken?: string;
  giftCountToken?: string;
  firstGiftDateToken?: string;
  lastGiftDateToken?: string;
  campaignsSupportedToken?: string;
  donorNameToken?: string;
  receiptNumberToken?: string;
  taxDeductibleToken?: string;
  designationToken?: string;
  organizationTaxIdToken?: string;
  goodsServicesStatement?: string;
  buttonLabel?: string;
  buttonUrl?: string;
  buttonColor?: string;
  buttonTextColor?: string;
  suggestedAmounts?: string[];
  thankYouMessage?: string;
  giftAmountToken?: string;
  giftDateToken?: string;
  campaignToken?: string;
  staffSignature?: string;
  organizationNameToken?: string;
  addressToken?: string;
  phoneToken?: string;
  websiteToken?: string;
  unsubscribeToken?: string;
  managePreferencesToken?: string;
  taxIdToken?: string;
  nameToken?: string;
  titleToken?: string;
  phoneTokenSecondary?: string;
  emailToken?: string;
  organizationToken?: string;
  src?: string;
  alt?: string;
  width?: number;
  url?: string;
  embedType?: "youtube" | "vimeo" | "onedrive" | "generic";
  caption?: string;
  columns?: Array<Array<Record<string, unknown>>>;
  html?: string;
  links?: Array<{ platform?: "facebook" | "twitter" | "instagram" | "linkedin" | "youtube"; url?: string }>;
}

interface AiRunOutcome {
  content: string | null;
  model: string;
  errorMessage: string | null;
  usedFallbackModel: boolean;
}

/** Auth and permissions are required for communications AI generation actions. */
router.use(requireAuth);
router.use(requirePermission("edit:communications"));

/** Keeps untrusted generated HTML safe enough for internal email editing workflows. */
function sanitizeGeneratedHtml(input: string): string {
  return String(input)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .trim();
}

/** Parses and bounds integer-like input values. */
function boundedInt(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

/** Parses hex-like colors with a sane fallback for email-safe rendering. */
function safeColor(value: unknown, fallback: string): string {
  const candidate = String(value ?? "").trim();
  return /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate) ? candidate : fallback;
}

/** Safely extracts JSON content from model replies that may include markdown fences. */
function parseJsonFromModelReply(reply: string): Record<string, unknown> | null {
  const raw = reply.trim();
  if (!raw) return null;

  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() || raw;

  try {
    return JSON.parse(candidate) as Record<string, unknown>;
  } catch {
    // Fallback: attempt to parse the first JSON object in the full string.
  }

  const firstBrace = raw.indexOf("{");
  const lastBrace = raw.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace <= firstBrace) return null;

  const sliced = raw.slice(firstBrace, lastBrace + 1);
  try {
    return JSON.parse(sliced) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Runs one AI request with model fallback so transient/empty responses do not hard-fail generation. */
async function runAiWithModelFallback(options: {
  config: ReturnType<typeof parseStewardAiConfig>;
  messages: StewardAiChatMessage[];
  preferredModel: string;
  temperature: number;
  maxTokens: number;
}): Promise<AiRunOutcome> {
  const uniqueModels = Array.from(new Set([options.preferredModel, options.config.model].filter(Boolean)));
  let lastErrorMessage: string | null = null;

  for (let index = 0; index < uniqueModels.length; index += 1) {
    const model = uniqueModels[index];
    try {
      const result = await runStewardAiChat(options.config, options.messages, {
        model,
        temperature: options.temperature,
        maxTokens: options.maxTokens,
      });
      const content = String(result.content ?? "").trim();
      if (content.length > 0) {
        return {
          content,
          model: result.model || model,
          errorMessage: null,
          usedFallbackModel: index > 0,
        };
      }
      lastErrorMessage = "AI returned empty content.";
    } catch (error) {
      lastErrorMessage = error instanceof Error ? error.message : "AI request failed.";
    }
  }

  return {
    content: null,
    model: uniqueModels[0] || options.config.model,
    errorMessage: lastErrorMessage,
    usedFallbackModel: uniqueModels.length > 1,
  };
}

/** Builds a deterministic template when AI content is unavailable or unparsable. */
function buildDeterministicTemplateFallback(options: {
  organizationName: string;
  campaignName?: string;
  audience?: string;
  tone?: string;
  goal: string;
  primaryColor?: string;
  contactEmail?: string;
  contactPhone?: string;
  websiteUrl?: string;
  addressLine?: string;
}) {
  const audience = String(options.audience ?? "Supporters").trim() || "Supporters";
  const campaignName = String(options.campaignName ?? "Community Update").trim() || "Community Update";
  const tone = String(options.tone ?? "warm").trim() || "warm";

  return {
    backgroundColor: "#f5f5f5",
    contentWidth: 600,
    fontFamily: "Arial, Helvetica, sans-serif",
    blocks: [
      normalizeDraftBlock({
        type: "heading",
        eyebrow: "Community Update",
        title: campaignName,
        subtitle: `A ${tone} message for ${audience}`,
        align: "left",
        textColor: "#111827",
        padding: 18,
      }),
      normalizeDraftBlock({
        type: "text",
        content: `<p>Dear ${audience},</p><p>Thank you for investing in ${options.organizationName}. Your support continues to create measurable impact.</p>`,
        fontSize: 16,
        color: "#333333",
        align: "left",
        padding: 16,
      }),
      normalizeDraftBlock({
        type: "impactStat",
        value: "1 Goal",
        label: "Focus This Month",
        sublabel: options.goal,
        bgColor: "#ecfdf3",
        textColor: "#14532d",
        padding: 16,
      }),
      normalizeDraftBlock({
        type: "callout",
        title: "What you made possible",
        body: "Local families received practical care and follow-up support this week because of donor partnership.",
        bgColor: "#eff6ff",
        borderColor: "#2563eb",
        textColor: "#1e3a8a",
        padding: 16,
      }),
      normalizeDraftBlock({
        type: "progress",
        label: "Current campaign progress",
        current: 65,
        goal: 100,
        barColor: options.primaryColor || "#16a34a",
        trackColor: "#d1fae5",
        textColor: "#14532d",
        padding: 16,
      }),
      normalizeDraftBlock({
        type: "aiText",
        prompt: `Write ${tone} stewardship copy for: ${options.goal}`,
        tone: tone === "urgent" || tone === "celebratory" || tone === "informative" ? tone : "warm",
        content: "<p>Because of your generosity, families are receiving practical care and long-term support. We will continue sharing updates as this month progresses.</p>",
        padding: 16,
      }),
      normalizeDraftBlock({
        type: "donationCta",
        headline: "Keep this momentum going",
        appealText: "Your next gift helps continue this work without interruption.",
        buttonLabel: "Give Today",
        buttonUrl: "https://",
        suggestedAmounts: ["$25", "$50", "$100", "$250"],
        bgColor: "#ecfdf3",
        textColor: "#14532d",
        buttonColor: options.primaryColor || "#16a34a",
        buttonTextColor: "#ffffff",
        padding: 16,
      }),
      normalizeDraftBlock({
        type: "staffSignature",
        nameToken: "{{staffName}}",
        titleToken: "{{staffTitle}}",
        phoneTokenSecondary: options.contactPhone || "{{organizationPhone}}",
        emailToken: options.contactEmail || "{{staffEmail}}",
        organizationToken: options.organizationName,
        textColor: "#1f2937",
        padding: 16,
      }),
      normalizeDraftBlock({
        type: "footerCompliance",
        organizationNameToken: options.organizationName,
        addressToken: options.addressLine || "{{addressBlock}}",
        phoneToken: options.contactPhone || "{{organizationPhone}}",
        websiteToken: options.websiteUrl || "{{organizationWebsite}}",
        unsubscribeToken: "{{unsubscribeUrl}}",
        managePreferencesToken: "{{managePreferencesUrl}}",
        taxIdToken: "{{organizationTaxId}}",
        bgColor: "#f9fafb",
        textColor: "#4b5563",
        padding: 16,
      }),
      normalizeDraftBlock({
        type: "button",
        label: "See Your Impact",
        href: "https://",
        bgColor: options.primaryColor || "#16a34a",
        textColor: "#ffffff",
        align: "center",
        borderRadius: 6,
        padding: 16,
      }),
    ],
  };
}

/** Builds a deterministic AI block when model output is unavailable or invalid. */
function buildDeterministicBlockFallback(options: {
  blockKind: "aiText" | "aiButton";
  prompt: string;
  tone: "warm" | "urgent" | "celebratory" | "informative";
}) {
  if (options.blockKind === "aiButton") {
    return normalizeDraftBlock({
      type: "aiButton",
      prompt: options.prompt,
      label: "Take the Next Step",
      href: "https://",
      bgColor: "#16a34a",
      textColor: "#ffffff",
      align: "center",
      borderRadius: 6,
      padding: 16,
    });
  }

  return normalizeDraftBlock({
    type: "aiText",
    prompt: options.prompt,
    tone: options.tone,
    content: "<p>Thank you for standing with our mission. Your partnership helps our team serve people with consistency and care.</p>",
    padding: 16,
  });
}

/** Converts AI draft block payloads into safe email-builder block records. */
function normalizeDraftBlock(block: BuilderBlockDraft): BuilderBlockDraft {
  const type = block.type;

  if (type === "heading") {
    return {
      type,
      eyebrow: block.eyebrow ? String(block.eyebrow) : undefined,
      title: String(block.title ?? "Campaign Update"),
      subtitle: block.subtitle ? String(block.subtitle) : undefined,
      align: block.align === "center" || block.align === "right" ? block.align : "left",
      textColor: safeColor(block.textColor, "#111827"),
      padding: boundedInt(block.padding, 18, 0, 100),
    };
  }

  if (type === "quote") {
    return {
      type,
      quote: String(block.quote ?? "Your support changed a real life."),
      attribution: String(block.attribution ?? "Community Member"),
      align: block.align === "left" || block.align === "right" ? block.align : "center",
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "impactStat") {
    return {
      type,
      value: String(block.value ?? "0"),
      label: String(block.label ?? "Impact Metric"),
      sublabel: block.sublabel ? String(block.sublabel) : undefined,
      bgColor: safeColor(block.bgColor, "#ecfdf3"),
      textColor: safeColor(block.textColor, "#14532d"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "impactStory") {
    return {
      type,
      headline: String(block.headline ?? block.title ?? "Impact Story"),
      story: String(block.content ?? block.body ?? "Share a donor-safe story of impact."),
      pseudonym: block.subtitle ? String(block.subtitle) : undefined,
      imageUrl: block.imageUrl ? String(block.imageUrl) : undefined,
      outcome: String(block.outcome ?? "Families received practical support and hope."),
      ctaLabel: block.ctaLabel ? String(block.ctaLabel) : undefined,
      ctaUrl: block.ctaUrl ? String(block.ctaUrl) : undefined,
      bgColor: safeColor(block.bgColor, "#f8fafc"),
      textColor: safeColor(block.textColor, "#1f2937"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "impactGrid") {
    const items = Array.isArray(block.items)
      ? block.items
        .map((item) => {
          const raw = String(item ?? "").trim();
          if (!raw) return null;
          const [value, ...rest] = raw.split("|");
          return {
            value: value.trim() || "0",
            label: rest.join("|").trim() || "Metric",
          };
        })
        .filter((item): item is { value: string; label: string } => Boolean(item))
        .slice(0, 4)
      : [];

    return {
      type,
      title: block.title ? String(block.title) : "Impact Snapshot",
      items: items.length > 0 ? items : [
        { value: "327", label: "Families Served" },
        { value: "54", label: "New Volunteers" },
      ],
      bgColor: safeColor(block.bgColor, "#ecfdf3"),
      textColor: safeColor(block.textColor, "#14532d"),
      accentColor: safeColor(block.borderColor, "#16a34a"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "timeline") {
    const items = Array.isArray(block.items)
      ? block.items
        .flatMap((item) => {
          const raw = String(item ?? "").trim();
          if (!raw) return [] as Array<{ title: string; detail?: string }>;
          const [title, ...rest] = raw.split("|");
          if (!title.trim()) return [] as Array<{ title: string; detail?: string }>;
          return [{ title: title.trim(), detail: rest.join("|").trim() || undefined }];
        })
        .slice(0, 6)
      : [];

    return {
      type,
      title: block.title ? String(block.title) : "Timeline",
      items: items.length > 0 ? items : [{ title: "Milestone", detail: "Update detail" }],
      accentColor: safeColor(block.borderColor, "#16a34a"),
      textColor: safeColor(block.textColor, "#1f2937"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "callout") {
    return {
      type,
      title: String(block.title ?? "Impact Highlight"),
      body: String(block.body ?? "Share one meaningful story or update for supporters."),
      bgColor: safeColor(block.bgColor, "#eff6ff"),
      borderColor: safeColor(block.borderColor, "#2563eb"),
      textColor: safeColor(block.textColor, "#1e3a8a"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "progress") {
    return {
      type,
      label: String(block.label ?? "Campaign Progress"),
      current: boundedInt(block.current, 0, 0, 100000000),
      goal: Math.max(1, boundedInt(block.goal, 100, 1, 100000000)),
      barColor: safeColor(block.barColor, "#16a34a"),
      trackColor: safeColor(block.trackColor, "#d1fae5"),
      textColor: safeColor(block.textColor, "#14532d"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "featureList") {
    const safeItems = Array.isArray(block.items)
      ? block.items.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
      : [];
    return {
      type,
      title: block.title ? String(block.title) : "What your support funds",
      items: safeItems.length > 0 ? safeItems : ["Critical direct services", "Community follow-up care", "Long-term support planning"],
      bulletColor: safeColor(block.bgColor, "#16a34a"),
      textColor: safeColor(block.textColor, "#1f2937"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "donorThankYou") {
    return {
      type,
      headline: String(block.title ?? "Thank you for your generosity"),
      thankYouMessage: String(block.thankYouMessage ?? "Your support is making a measurable difference right now."),
      giftAmountToken: String(block.giftAmountToken ?? "{{lastGiftAmount}}"),
      giftDateToken: String(block.giftDateToken ?? "{{lastGiftDate}}"),
      campaignToken: String(block.campaignToken ?? "{{campaignName}}"),
      staffSignature: String(block.staffSignature ?? "{{staffName}}"),
      bgColor: safeColor(block.bgColor, "#ecfdf3"),
      textColor: safeColor(block.textColor, "#14532d"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "donationCta") {
    const amounts = Array.isArray(block.suggestedAmounts)
      ? block.suggestedAmounts.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : [];
    return {
      type,
      headline: String(block.title ?? "Keep this work moving"),
      appealText: String(block.content ?? "Your gift today helps us continue serving families immediately."),
      buttonLabel: String(block.buttonLabel ?? "Give Today"),
      buttonUrl: String(block.buttonUrl ?? block.href ?? "https://"),
      suggestedAmounts: amounts.length > 0 ? amounts : ["$25", "$50", "$100"],
      bgColor: safeColor(block.bgColor, "#ecfdf3"),
      textColor: safeColor(block.textColor, "#14532d"),
      buttonColor: safeColor(block.buttonColor, "#16a34a"),
      buttonTextColor: safeColor(block.buttonTextColor, "#ffffff"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "donationReceipt") {
    return {
      type,
      donorNameToken: String(block.donorNameToken ?? "{{fullName}}"),
      giftAmountToken: String(block.giftAmountToken ?? "{{lastGiftAmount}}"),
      giftDateToken: String(block.giftDateToken ?? "{{lastGiftDate}}"),
      receiptNumberToken: String(block.receiptNumberToken ?? "{{receiptNumber}}"),
      taxDeductibleToken: String(block.taxDeductibleToken ?? "{{taxDeductibleAmount}}"),
      designationToken: String(block.designationToken ?? "{{campaignName}}"),
      organizationTaxIdToken: String(block.organizationTaxIdToken ?? "{{organizationTaxId}}"),
      goodsServicesStatement: String(block.goodsServicesStatement ?? "No goods or services were provided in exchange for this contribution unless noted."),
      bgColor: safeColor(block.bgColor, "#ffffff"),
      borderColor: safeColor(block.borderColor, "#d1d5db"),
      textColor: safeColor(block.textColor, "#111827"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "givingSummary") {
    return {
      type,
      yearToken: String(block.yearToken ?? "{{currentYear}}"),
      totalGivingToken: String(block.totalGivingToken ?? "{{totalYtdGiving}}"),
      giftCountToken: String(block.giftCountToken ?? "{{giftCount}}"),
      firstGiftDateToken: String(block.firstGiftDateToken ?? "{{firstGiftDate}}"),
      lastGiftDateToken: String(block.lastGiftDateToken ?? "{{lastGiftDate}}"),
      campaignsSupportedToken: String(block.campaignsSupportedToken ?? "{{campaignsSupported}}"),
      bgColor: safeColor(block.bgColor, "#f0fdf4"),
      textColor: safeColor(block.textColor, "#14532d"),
      accentColor: safeColor(block.borderColor, "#16a34a"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "monthlyDonorInvitation") {
    const suggestedMonthlyAmounts = Array.isArray(block.suggestedMonthlyAmounts)
      ? block.suggestedMonthlyAmounts.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : [];
    const benefitBullets = Array.isArray(block.benefitBullets)
      ? block.benefitBullets.map((item) => String(item).trim()).filter(Boolean).slice(0, 6)
      : [];

    return {
      type,
      headline: String(block.headline ?? block.title ?? "Become a Monthly Partner"),
      message: String(block.message ?? block.content ?? "Monthly support helps sustain this mission all year."),
      suggestedMonthlyAmounts: suggestedMonthlyAmounts.length > 0 ? suggestedMonthlyAmounts : ["$15/mo", "$30/mo", "$50/mo"],
      benefitBullets: benefitBullets.length > 0 ? benefitBullets : ["Sustained impact", "Predictable support"],
      ctaLabel: String(block.ctaLabel ?? block.buttonLabel ?? "Start Monthly Giving"),
      ctaUrl: String(block.ctaUrl ?? block.buttonUrl ?? "https://"),
      buttonColor: safeColor(block.buttonColor, "#16a34a"),
      bgColor: safeColor(block.bgColor, "#f0f9ff"),
      textColor: safeColor(block.textColor, "#1e3a8a"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "lapsedDonorReengagement") {
    return {
      type,
      greeting: String(block.greeting ?? "We have missed you, {{preferredName}}."),
      lastGiftDateToken: String(block.lastGiftDateToken ?? "{{lastGiftDate}}"),
      message: String(block.message ?? block.content ?? "We are grateful for your past partnership and wanted to reconnect."),
      impactReminder: String(block.impactReminder ?? "Your previous support made meaningful impact possible."),
      ctaLabel: String(block.ctaLabel ?? block.buttonLabel ?? "Reconnect with a Gift"),
      ctaUrl: String(block.ctaUrl ?? block.buttonUrl ?? "https://"),
      buttonColor: safeColor(block.buttonColor, "#16a34a"),
      bgColor: safeColor(block.bgColor, "#fff7ed"),
      textColor: safeColor(block.textColor, "#9a3412"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "firstTimeDonorWelcome") {
    return {
      type,
      headline: String(block.headline ?? block.title ?? "Welcome to the Mission"),
      missionIntro: String(block.missionIntro ?? "Thank you for taking your first step with us."),
      whatToExpect: String(block.whatToExpect ?? "You will receive thoughtful updates and impact stories."),
      contactPerson: String(block.contactPerson ?? "{{staffName}}"),
      ctaLabel: String(block.ctaLabel ?? block.buttonLabel ?? "See Your Impact"),
      ctaUrl: String(block.ctaUrl ?? block.buttonUrl ?? "https://"),
      buttonColor: safeColor(block.buttonColor, "#16a34a"),
      bgColor: safeColor(block.bgColor, "#eff6ff"),
      textColor: safeColor(block.textColor, "#1e3a8a"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "staffSignature") {
    return {
      type,
      nameToken: String(block.nameToken ?? "{{staffName}}"),
      titleToken: String(block.titleToken ?? "{{staffTitle}}"),
      phoneToken: String(block.phoneTokenSecondary ?? "{{organizationPhone}}"),
      emailToken: String(block.emailToken ?? "{{staffEmail}}"),
      organizationToken: String(block.organizationToken ?? "{{organizationName}}"),
      textColor: safeColor(block.textColor, "#1f2937"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "footerCompliance") {
    return {
      type,
      organizationNameToken: String(block.organizationNameToken ?? "{{organizationName}}"),
      addressToken: String(block.addressToken ?? "{{addressBlock}}"),
      phoneToken: String(block.phoneToken ?? "{{organizationPhone}}"),
      websiteToken: String(block.websiteToken ?? "{{organizationWebsite}}"),
      unsubscribeToken: String(block.unsubscribeToken ?? "{{unsubscribeUrl}}"),
      managePreferencesToken: String(block.managePreferencesToken ?? "{{managePreferencesUrl}}"),
      taxIdToken: String(block.taxIdToken ?? "{{organizationTaxId}}"),
      bgColor: safeColor(block.bgColor, "#f9fafb"),
      textColor: safeColor(block.textColor, "#4b5563"),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "image") {
    return {
      type,
      src: String(block.src ?? ""),
      alt: String(block.alt ?? "Campaign image"),
      width: boundedInt(block.width, 100, 10, 100),
      align: block.align === "left" || block.align === "right" ? block.align : "center",
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "video") {
    return {
      type,
      url: String(block.url ?? ""),
      embedType: block.embedType === "youtube" || block.embedType === "vimeo" || block.embedType === "onedrive" ? block.embedType : "generic",
      caption: block.caption ? String(block.caption) : undefined,
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "social") {
    const links = Array.isArray(block.links)
      ? block.links
        .map((link) => ({
          platform: link?.platform,
          url: String(link?.url ?? "").trim(),
        }))
        .filter((link) =>
          (link.platform === "facebook"
            || link.platform === "twitter"
            || link.platform === "instagram"
            || link.platform === "linkedin"
            || link.platform === "youtube")
          && Boolean(link.url),
        )
      : [];

    return {
      type,
      links: links.length > 0
        ? links
        : [
          { platform: "facebook", url: "https://facebook.com" },
          { platform: "instagram", url: "https://instagram.com" },
          { platform: "linkedin", url: "https://linkedin.com" },
        ],
      align: block.align === "left" || block.align === "right" ? block.align : "center",
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "button") {
    return {
      type,
      label: String(block.label ?? "Learn More"),
      href: String(block.href ?? "https://"),
      bgColor: safeColor(block.bgColor, "#16a34a"),
      textColor: safeColor(block.textColor, "#ffffff"),
      align: block.align === "left" || block.align === "right" ? block.align : "center",
      padding: boundedInt(block.padding, 16, 0, 100),
      borderRadius: boundedInt(block.borderRadius, 6, 0, 40),
    };
  }

  if (type === "aiText") {
    return {
      type,
      prompt: String(block.prompt ?? "Write a donor update."),
      content: sanitizeGeneratedHtml(String(block.content ?? "<p>Generated text.</p>")),
      tone:
        block.tone === "urgent" || block.tone === "celebratory" || block.tone === "informative"
          ? block.tone
          : "warm",
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "aiButton") {
    return {
      type,
      prompt: String(block.prompt ?? "Generate a donor call-to-action."),
      label: String(block.label ?? "Take Action"),
      href: String(block.href ?? "https://"),
      bgColor: safeColor(block.bgColor, "#16a34a"),
      textColor: safeColor(block.textColor, "#ffffff"),
      align: block.align === "left" || block.align === "right" ? block.align : "center",
      padding: boundedInt(block.padding, 16, 0, 100),
      borderRadius: boundedInt(block.borderRadius, 6, 0, 40),
    };
  }

  if (type === "divider") {
    return {
      type,
      color: safeColor(block.color, "#e5e7eb"),
      thickness: boundedInt(block.thickness, 1, 1, 12),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "spacer") {
    return {
      type,
      height: boundedInt(block.height, 28, 4, 200),
    };
  }

  if (type === "columns") {
    return {
      type,
      columns: Array.isArray(block.columns) ? block.columns : [[], []],
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  if (type === "customHtml") {
    return {
      type,
      html: sanitizeGeneratedHtml(String(block.html ?? block.content ?? "<div>Custom HTML</div>")),
      padding: boundedInt(block.padding, 16, 0, 100),
    };
  }

  // Default to text for malformed or unknown block kinds.
  return {
    type: "text",
    content: sanitizeGeneratedHtml(String(block.content ?? "<p>Generated content.</p>")),
    fontSize: boundedInt(block.fontSize, 16, 10, 32),
    color: safeColor(block.color, "#333333"),
    align: block.align === "center" || block.align === "right" ? block.align : "left",
    padding: boundedInt(block.padding, 16, 0, 100),
  };
}

/** Loads and parses Steward AI runtime config for communications AI endpoints. */
async function loadCommunicationsAiRuntime(organizationId: string) {
  const setting = await prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_AI_PLUGIN_KEY,
      },
    },
    select: {
      enabled: true,
      config: true,
    },
  });

  const parsed = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());
  return {
    enabled: setting?.enabled ?? false,
    config: parsed,
  };
}

/** Builds shared contextual lines for nonprofit-aware communications prompting. */
async function loadOrganizationPromptContext(organizationId: string) {
  const [organization, brandingSetting] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: organizationId },
      select: { name: true },
    }),
    prisma.pluginSetting.findUnique({
      where: {
        organizationId_pluginKey: {
          organizationId,
          pluginKey: "organization-branding",
        },
      },
      select: { config: true },
    }),
  ]);

  const branding = brandingSetting?.config && typeof brandingSetting.config === "object"
    ? (brandingSetting.config as Record<string, unknown>)
    : {};

  const asText = (value: unknown) => String(value ?? "").trim();
  const addressLine = [
    asText(branding.streetAddress1),
    asText(branding.streetAddress2),
    [asText(branding.city), asText(branding.stateProvince)].filter(Boolean).join(", "),
    asText(branding.postalCode),
    asText(branding.country),
  ].filter(Boolean).join(" | ");

  return {
    organizationName: organization?.name?.trim() || "Our Nonprofit",
    primaryColor: asText(branding.primaryColor) || "#16a34a",
    contactEmail: asText(branding.contactEmail),
    contactPhone: asText(branding.contactPhone),
    websiteUrl: asText(branding.websiteUrl),
    addressLine,
  };
}

/**
 * POST /api/communications-ai/email-builder/generate-template
 * Description: Generates a full email-builder template draft from an AI brief.
 * Request: { goal: string, audience?: string, tone?: string, campaignName?: string }
 * Response: { data: { template: { ... }, sourceModel: string } }
 */
router.post("/email-builder/generate-template", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = (req.body ?? {}) as BuilderTemplateGenerationPayload;
  const goal = String(payload.goal ?? "").trim();
  if (!goal) {
    res.status(400).json({ error: { code: "GOAL_REQUIRED", message: "A generation brief is required." } });
    return;
  }

  const runtime = await loadCommunicationsAiRuntime(organizationId);
  if (!runtime.enabled) {
    res.status(400).json({ error: { code: "AI_DISABLED", message: "Steward AI is disabled in settings." } });
    return;
  }

  const context = await loadOrganizationPromptContext(organizationId);

  const systemPrompt = [
    "You generate nonprofit fundraising email templates as one JSON object.",
    "Return one valid JSON object only. Do not include markdown code fences.",
    "Use block types only from: heading, text, quote, impactStat, impactStory, impactGrid, timeline, callout, progress, featureList, donorThankYou, donationReceipt, givingSummary, donationCta, monthlyDonorInvitation, lapsedDonorReengagement, firstTimeDonorWelcome, staffSignature, footerCompliance, image, video, social, button, aiText, aiButton, divider, spacer, columns, customHtml.",
    "Create a complete draft that is ready for a human to edit, usually 7-12 blocks.",
    "Content fields may be longer and richer when the brief calls for it; do not default to shallow copy.",
    "Include footerCompliance and at least one clear CTA button.",
    "Ensure content is donor-safe, factual in tone, and action-oriented.",
    "Follow the user's goal, audience, and tone exactly.",
    "Do not output CRM field dumps, donor profile lists, or internal analysis text in blocks.",
    "Produce polished user-facing copy, not planning notes.",
  ].join(" ");

  const userPrompt = {
    organizationName: context.organizationName,
    campaignName: payload.campaignName ?? "",
    audience: payload.audience ?? "General donor audience",
    tone: payload.tone ?? "warm",
    goal,
    schema: {
      backgroundColor: "#f5f5f5",
      contentWidth: 600,
      fontFamily: "Arial, Helvetica, sans-serif",
      blocks: [
        {
          type: "heading",
          title: "...",
          align: "left",
          textColor: "#111827",
          padding: 18,
        },
        {
          type: "donationCta",
          headline: "...",
          appealText: "...",
          buttonLabel: "Give Today",
          buttonUrl: "https://",
          suggestedAmounts: ["$25", "$50", "$100"],
          bgColor: "#ecfdf3",
          textColor: "#14532d",
          buttonColor: context.primaryColor,
          buttonTextColor: "#ffffff",
          padding: 16,
        },
        {
          type: "footerCompliance",
          organizationNameToken: context.organizationName,
          addressToken: context.addressLine || "{{addressBlock}}",
          phoneToken: context.contactPhone || "{{organizationPhone}}",
          websiteToken: context.websiteUrl || "{{organizationWebsite}}",
          unsubscribeToken: "{{unsubscribeUrl}}",
          managePreferencesToken: "{{managePreferencesUrl}}",
          taxIdToken: "{{organizationTaxId}}",
          bgColor: "#f9fafb",
          textColor: "#4b5563",
          padding: 16,
        },
      ],
    },
    branding: {
      primaryColor: context.primaryColor,
      contactEmail: context.contactEmail,
      contactPhone: context.contactPhone,
      websiteUrl: context.websiteUrl,
      addressLine: context.addressLine,
    },
  };

  const messages: StewardAiChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: JSON.stringify(userPrompt) },
  ];

  const modelToUse = runtime.config.reasoningMode === "thinking"
    ? (runtime.config.thinkingModel || runtime.config.model)
    : runtime.config.model;

  const aiOutcome = await runAiWithModelFallback({
    config: runtime.config,
    messages,
    preferredModel: modelToUse,
    temperature: Math.max(runtime.config.temperature, 0.2),
    maxTokens: Math.max(runtime.config.maxTokens, 1600),
  });

  let fallbackReason: string | null = null;
  let normalizedTemplate: {
    backgroundColor: string;
    contentWidth: number;
    fontFamily: string;
    blocks: BuilderBlockDraft[];
  };

  const parsed = aiOutcome.content ? parseJsonFromModelReply(aiOutcome.content) : null;
  if (!parsed) {
    fallbackReason = aiOutcome.errorMessage || "AI response was empty or not valid JSON.";
    normalizedTemplate = buildDeterministicTemplateFallback({
      organizationName: context.organizationName,
      campaignName: payload.campaignName,
      audience: payload.audience,
      tone: payload.tone,
      goal,
      primaryColor: context.primaryColor,
      contactEmail: context.contactEmail,
      contactPhone: context.contactPhone,
      websiteUrl: context.websiteUrl,
      addressLine: context.addressLine,
    });
  } else {
    const draft = parsed as BuilderTemplateDraft;
    const rawBlocks = Array.isArray(draft.blocks) ? draft.blocks : [];
    const blocks = rawBlocks.slice(0, 24).map((block) => normalizeDraftBlock(block));

    if (blocks.length === 0) {
      fallbackReason = "AI returned no usable blocks.";
      normalizedTemplate = buildDeterministicTemplateFallback({
        organizationName: context.organizationName,
        campaignName: payload.campaignName,
        audience: payload.audience,
        tone: payload.tone,
        goal,
        primaryColor: context.primaryColor,
        contactEmail: context.contactEmail,
        contactPhone: context.contactPhone,
        websiteUrl: context.websiteUrl,
        addressLine: context.addressLine,
      });
    } else {
      normalizedTemplate = {
        backgroundColor: safeColor(draft.backgroundColor, "#f5f5f5"),
        contentWidth: boundedInt(draft.contentWidth, 600, 420, 760),
        fontFamily: String(draft.fontFamily ?? "Arial, Helvetica, sans-serif"),
        blocks,
      };
    }
  }

  await logAudit({
    action: "COMMUNICATIONS_AI_TEMPLATE_GENERATED",
    organizationId,
    userId: req.user?.sub,
    metadata: {
      goalLength: goal.length,
      blockCount: normalizedTemplate.blocks.length,
      model: aiOutcome.model,
      usedFallbackModel: aiOutcome.usedFallbackModel,
      fallbackUsed: Boolean(fallbackReason),
      fallbackReason,
    },
  });

  res.json({
    data: {
      template: normalizedTemplate,
      sourceModel: fallbackReason ? `${aiOutcome.model} (fallback)` : aiOutcome.model,
    },
  });
});

/**
 * POST /api/communications-ai/email-builder/generate-block
 * Description: Generates one AI block payload for AI Text or AI CTA blocks.
 * Request: { blockKind: "aiText"|"aiButton", prompt: string, tone?: string }
 * Response: { data: { block: { ... }, sourceModel: string } }
 */
router.post("/email-builder/generate-block", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = (req.body ?? {}) as BuilderBlockGenerationPayload;
  if (payload.blockKind !== "aiText" && payload.blockKind !== "aiButton") {
    res.status(400).json({ error: { code: "BLOCK_KIND_INVALID", message: "blockKind must be aiText or aiButton." } });
    return;
  }

  const prompt = String(payload.prompt ?? "").trim();
  if (!prompt) {
    res.status(400).json({ error: { code: "PROMPT_REQUIRED", message: "prompt is required." } });
    return;
  }

  const runtime = await loadCommunicationsAiRuntime(organizationId);
  if (!runtime.enabled) {
    res.status(400).json({ error: { code: "AI_DISABLED", message: "Steward AI is disabled in settings." } });
    return;
  }

  const context = await loadOrganizationPromptContext(organizationId);
  const tone = payload.tone ?? "warm";

  const systemPrompt = [
    "You generate one email-builder block as one JSON object.",
    "Return one valid JSON object only. Do not include markdown fences.",
    `Block kind: ${payload.blockKind}`,
    "Follow the user's prompt closely and output user-facing copy only.",
    "Prefer stronger, more complete copy over terse placeholder language.",
    "Do not include donor record dumps, internal notes, or tool-style analysis text.",
  ].join(" ");

  const schema = payload.blockKind === "aiText"
    ? {
        type: "aiText",
        prompt,
        tone,
        content: "<p>...</p>",
        padding: 16,
      }
    : {
        type: "aiButton",
        prompt,
        label: "Take Action",
        href: "https://example.org/donate",
        bgColor: "#16a34a",
        textColor: "#ffffff",
        align: "center",
        borderRadius: 6,
        padding: 16,
      };

  const messages: StewardAiChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: JSON.stringify({
        organizationName: context.organizationName,
        tone,
        prompt,
        schema,
      }),
    },
  ];

  const modelToUse = runtime.config.reasoningMode === "thinking"
    ? (runtime.config.thinkingModel || runtime.config.model)
    : runtime.config.model;

  const aiOutcome = await runAiWithModelFallback({
    config: runtime.config,
    messages,
    preferredModel: modelToUse,
    temperature: Math.max(runtime.config.temperature, 0.2),
    maxTokens: Math.max(runtime.config.maxTokens, 900),
  });

  const parsed = aiOutcome.content ? parseJsonFromModelReply(aiOutcome.content) : null;
  const fallbackReason = parsed ? null : (aiOutcome.errorMessage || "AI response was empty or not valid JSON.");
  const normalizedBlock = parsed
    ? normalizeDraftBlock(parsed as BuilderBlockDraft)
    : buildDeterministicBlockFallback({
      blockKind: payload.blockKind,
      prompt,
      tone,
    });

  await logAudit({
    action: "COMMUNICATIONS_AI_BLOCK_GENERATED",
    organizationId,
    userId: req.user?.sub,
    metadata: {
      blockKind: payload.blockKind,
      promptLength: prompt.length,
      model: aiOutcome.model,
      usedFallbackModel: aiOutcome.usedFallbackModel,
      fallbackUsed: Boolean(fallbackReason),
      fallbackReason,
    },
  });

  res.json({
    data: {
      block: normalizedBlock,
      sourceModel: fallbackReason ? `${aiOutcome.model} (fallback)` : aiOutcome.model,
    },
  });
});

router.post("/email-builder/write-stream", async (req, res) => {
  const organizationId = await resolveOrganizationId({ req });
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = (req.body ?? {}) as BuilderWritingStreamPayload;
  const prompt = String(payload.prompt ?? "").trim();
  if (!prompt) {
    res.status(400).json({ error: { code: "PROMPT_REQUIRED", message: "prompt is required." } });
    return;
  }

  const runtime = await loadCommunicationsAiRuntime(organizationId);
  if (!runtime.enabled) {
    res.status(400).json({ error: { code: "AI_DISABLED", message: "Steward AI is disabled in settings." } });
    return;
  }

  const context = await loadOrganizationPromptContext(organizationId);
  const target = payload.target === "subject" || payload.target === "previewText" || payload.target === "cta"
    ? payload.target
    : "bodyHtml";
  const mode = payload.mode === "smartHtml" ? "smartHtml" : "standard";
  const tone = payload.tone ?? "warm";
  const audience = String(payload.audience ?? "").trim() || "General donor audience";
  const campaignName = String(payload.campaignName ?? "").trim();
  const currentContent = String(payload.currentContent ?? "").trim();
  const allowedMergeFields = Array.isArray(payload.allowedMergeFields)
    ? payload.allowedMergeFields
      .map((token) => String(token || "").trim())
      .filter((token) => /^\{\{\s*[a-zA-Z0-9_.]+\s*\}\}$/.test(token))
      .slice(0, 120)
    : [];

  const targetInstructions = target === "subject"
    ? "Write exactly one compelling email subject line. Plain text only. No quotation marks."
    : target === "previewText"
      ? "Write concise inbox preview text in plain text. Aim for one to two sentences and keep it under 140 characters."
      : target === "cta"
        ? "Write one strong call-to-action line in plain text. Keep it short and actionable."
        : "Write polished donor-facing HTML suitable for an email text block. Use <p>, <ul>, <ol>, <strong>, and <em> when useful. Do not wrap the result in markdown fences or include explanations.";

  const systemPrompt = [
    "You are a nonprofit email writing assistant.",
    "Produce only the requested final copy, with no preamble, no analysis, and no JSON.",
    "Use the brief, audience, and campaign context exactly.",
    "Prefer complete and persuasive copy over placeholder text.",
    "Do not mention internal tooling or unavailable data.",
    targetInstructions,
    ...(mode === "smartHtml"
      ? [
        "SMART HTML MODE: Return only an email-safe HTML fragment.",
        "Allowed tags: <p>, <br>, <ul>, <ol>, <li>, <strong>, <em>, <a>, <h2>, <h3>, <h4>, <blockquote>, <span>, <div>.",
        "Do not output <html>, <head>, <body>, <script>, <style>, <iframe>, forms, or markdown fences.",
        "Do not output markdown. Never use markdown bullets, markdown emphasis, or [text](url) link syntax.",
        "Links must be true <a href=\"...\"> tags.",
        "Do not use localhost, 127.0.0.1, or development URLs in href values.",
        "When a link depends on runtime data, use merge-token href values like {{donationUrl}}, {{unsubscribeUrl}}, or {{managePreferencesUrl}}.",
        "Do not include event handlers, JS, or CSS classes.",
        "Merge fields must remain exactly in double-curly format like {{donor.firstName}}.",
        "Never invent merge fields.",
        allowedMergeFields.length > 0
          ? `Only use merge fields from this allow-list: ${allowedMergeFields.join(", ")}.`
          : "If merge fields are used, keep them minimal and valid.",
      ]
      : []),
  ].join(" ");

  const messages: StewardAiChatMessage[] = [
    { role: "system", content: systemPrompt },
    {
      role: "user",
      content: [
        `Organization: ${context.organizationName}`,
        campaignName ? `Campaign: ${campaignName}` : "",
        `Audience: ${audience}`,
        `Tone: ${tone}`,
        currentContent ? `Current content to improve or continue:\n${currentContent}` : "",
        `Writing brief:\n${prompt}`,
      ].filter(Boolean).join("\n\n"),
    },
  ];

  const modelToUse = runtime.config.reasoningMode === "thinking"
    ? (runtime.config.thinkingModel || runtime.config.model)
    : runtime.config.model;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (event: string, data: Record<string, unknown>) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  let streamedReply = "";
  let modelUsed = modelToUse;

  try {
    const result = await runStewardAiChatStream(runtime.config, messages, {
      model: modelToUse,
      temperature: Math.max(runtime.config.temperature, 0.35),
      maxTokens: Math.max(runtime.config.maxTokens, target === "bodyHtml" ? 1800 : 600),
      timeoutMs: Math.max(runtime.config.timeoutMs, 180_000),
      onDelta(delta) {
        streamedReply += delta;
        sendEvent("delta", { delta });
      },
    });

    modelUsed = result.model || modelToUse;
    const reply = String(result.content ?? streamedReply).trim();

    await logAudit({
      action: "COMMUNICATIONS_AI_WRITING_STREAM_COMPLETED",
      organizationId,
      userId: req.user?.sub,
      metadata: {
        target,
        mode,
        promptLength: prompt.length,
        responseLength: reply.length,
        audience,
        tone,
        model: modelUsed,
      },
    });

    sendEvent("done", {
      reply,
      sourceModel: modelUsed,
      target,
    });
    res.end();
  } catch (error) {
    sendEvent("error", {
      message: error instanceof Error ? error.message : "AI writing stream failed.",
    });
    res.end();
  }
});

export default router;
