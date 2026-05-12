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
  type StewardAiChatMessage,
} from "../services/steward-ai-ollama.js";

const router = Router();
const STEWARD_AI_PLUGIN_KEY = "steward_ai";

type SupportedBuilderBlockKind =
  | "text"
  | "quote"
  | "impactStat"
  | "button"
  | "aiText"
  | "aiButton"
  | "divider"
  | "spacer";

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

interface BuilderTemplateDraft {
  backgroundColor?: string;
  contentWidth?: number;
  fontFamily?: string;
  blocks?: BuilderBlockDraft[];
}

interface BuilderBlockDraft {
  type?: SupportedBuilderBlockKind;
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
  textColor?: string;
  href?: string;
  prompt?: string;
  tone?: "warm" | "urgent" | "celebratory" | "informative";
  borderRadius?: number;
  thickness?: number;
  height?: number;
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
        type: "text",
        content: `<h1>${campaignName}</h1><p>Dear ${audience},</p><p>Thank you for investing in ${options.organizationName}. Your support continues to create measurable impact.</p>`,
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
        type: "aiText",
        prompt: `Write ${tone} stewardship copy for: ${options.goal}`,
        tone: tone === "urgent" || tone === "celebratory" || tone === "informative" ? tone : "warm",
        content: "<p>Because of your generosity, families are receiving practical care and long-term support. We will continue sharing updates as this month progresses.</p>",
        padding: 16,
      }),
      normalizeDraftBlock({
        type: "button",
        label: "See Your Impact",
        href: "https://",
        bgColor: "#16a34a",
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
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  return {
    organizationName: organization?.name?.trim() || "Our Nonprofit",
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
    "You generate nonprofit fundraising email templates as strict JSON.",
    "Return JSON only. Do not include markdown code fences.",
    "Use block types only from: text, quote, impactStat, button, aiText, aiButton, divider, spacer.",
    "Ensure content is donor-safe, factual in tone, and action-oriented.",
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
          type: "text",
          content: "<h1>...</h1><p>...</p>",
          fontSize: 16,
          color: "#333333",
          align: "left",
          padding: 16,
        },
      ],
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
    maxTokens: Math.max(runtime.config.maxTokens, 900),
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
    "You generate one email-builder block as strict JSON.",
    "Return JSON only. Do not include markdown fences.",
    `Block kind: ${payload.blockKind}`,
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
    maxTokens: Math.max(runtime.config.maxTokens, 500),
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

export default router;
