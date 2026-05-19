/**
 * Steward AI intent detection, response contracts, and multi-stage prompt builders.
 * Pure functions — no Prisma I/O, no Express, no side effects.
 */

import type { StewardChatMode, StewardResponseIntent, StewardAiChatPayload } from "./types.js";
import type { parseStewardAiConfig } from "../services/steward-ai-ollama.js";

// ─── Thinking model resolver ───────────────────────────────────────────────────

/** Picks the effective thinking model, falling back to the primary model when unset. */
export function resolveThinkingModel(config: ReturnType<typeof parseStewardAiConfig>): string {
  return String(config.thinkingModel || config.model).trim() || config.model;
}

// ─── Fiscal year helper ────────────────────────────────────────────────────────

/** Extracts fiscal year label and calendar year from retrieval context text for system prompt injection. */
export function extractFiscalYearFromContext(contextText: string): { fiscalYearLabel?: string; calendarYear?: number } {
  const fyMatch = contextText.match(/^Fiscal year context: (.+)$/m);
  const calMatch = contextText.match(/^Calendar year: (\d{4})$/m);
  return {
    fiscalYearLabel: fyMatch?.[1] ?? undefined,
    calendarYear: calMatch ? parseInt(calMatch[1], 10) : undefined,
  };
}

// ─── Intent detection ──────────────────────────────────────────────────────────

/** Detects the user's primary requested deliverable so prompts can enforce a tighter response contract. */
export function detectStewardIntent(userQuery: string, mode: StewardChatMode): StewardResponseIntent {
  const q = userQuery.toLowerCase();

  if (mode === "draft" || mode === "writing" || /(draft|write|compose|create)\s+.*\b(email|letter|message)\b/.test(q)) {
    return "draft_email";
  }
  if (mode === "help" || /(how\s+do\s+i|how\s+to|where\s+is|steps?\s+to|walk\s+me\s+through)/.test(q)) {
    return "how_to";
  }
  if (mode === "action" || /(plan|next\s+step|what\s+should\s+we\s+do|execute|workflow|follow\s*up)/.test(q)) {
    return "action_plan";
  }
  if (mode === "analyze" || /(analy[sz]e|why|trend|compare|risk|retention|kpi|forecast)/.test(q)) {
    return "analysis";
  }
  if (/(summarize|summary|recap|brief|tl;dr)/.test(q)) {
    return "summary";
  }
  return "general";
}

// ─── Response contract builders ────────────────────────────────────────────────

/** Returns strict output rules that match the user's requested deliverable. */
export function buildIntentResponseContract(intent: StewardResponseIntent): string {
  if (intent === "draft_email") {
    return [
      "Response contract: output a real, sendable draft email.",
      "Format exactly as:",
      "Subject: <single line>",
      "Preview Text: <single line>",
      "Body:",
      "<email body in natural paragraphs>",
      "Do not wrap Subject/Preview Text/Body labels in markdown bold or special characters.",
      "Use Email Builder merge fields when personal or gift data is needed: {{preferredName}}, {{fullName}}, {{lastGiftAmount}}, {{lastGiftDate}}, {{campaignName}}, {{organizationName}}, {{staffName}}, {{unsubscribeUrl}}, {{managePreferencesUrl}}.",
      "Do not output donor data tables, tool traces, record dumps, JSON, or bullet lists of raw CRM fields.",
      "Use only facts needed for the draft and keep placeholders explicit only when data is missing.",
    ].join("\n");
  }

  if (intent === "how_to") {
    return [
      "Response contract: output concise procedural guidance.",
      "Use numbered steps in execution order.",
      "Keep to one workflow path unless the user asked for alternatives.",
    ].join("\n");
  }

  if (intent === "action_plan") {
    return [
      "Response contract: output an actionable plan.",
      "Use: 1) Immediate next action, 2) This week plan, 3) Risks/checks.",
      "Do not claim any action is already executed.",
    ].join("\n");
  }

  if (intent === "analysis") {
    return [
      "Response contract: output an evidence-backed analysis.",
      "Use concise findings and include only the most decision-relevant metrics.",
      "Avoid listing raw records unless explicitly requested.",
    ].join("\n");
  }

  if (intent === "summary") {
    return [
      "Response contract: output a concise summary.",
      "Keep to a short paragraph plus up to 3 bullets for key takeaways.",
    ].join("\n");
  }

  return "Response contract: answer directly and match the user's requested format and scope.";
}

// ─── Context reducer ───────────────────────────────────────────────────────────

/** Reduces noisy retrieval lines for model prompts while retaining decision-critical facts. */
export function buildModelContextForIntent(contextText: string, intent: StewardResponseIntent): string {
  const lines = contextText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  if (intent !== "draft_email") {
    return lines.slice(0, 220).join("\n");
  }

  const keepPatterns = [
    /^Donor scope path:/i,
    /^Fiscal year context:/i,
    /^Current fiscal year:/i,
    /^Calendar year:/i,
    /^Focused donor profile:/i,
    /^@Mentioned donor:/i,
    /^Status:/i,
    /^Preferred channel:/i,
    /^Lapse risk:/i,
    /^Best next step:/i,
    /^Communication preference flags:/i,
    /^Do not/i,
  ];

  const bannedPatterns = [
    /^- Top donor:/i,
    /^- Opportunity:/i,
    /^- Lapse signal:/i,
    /^- LYBUNT:/i,
    /^Top donors by lifetime giving:/i,
    /^Monthly giving \(/i,
    /^KPI report \(/i,
  ];

  return lines
    .filter(
      (line) =>
        keepPatterns.some((pattern) => pattern.test(line)) ||
        !bannedPatterns.some((pattern) => pattern.test(line))
    )
    .filter((line) => !bannedPatterns.some((pattern) => pattern.test(line)))
    .slice(0, 80)
    .join("\n");
}

// ─── Multi-stage prompt builders ───────────────────────────────────────────────

/** Builds the planner stage prompt for agentic multi-stage preparation. */
export function buildPlannerPrompt(options: {
  mode: StewardChatMode;
  userIntent: StewardResponseIntent;
  responseContract: string;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  contextText: string;
}): string {
  return [
    "You are Steward's planning engine. Produce concise planning notes only.",
    "Do not answer the user yet.",
    `Mode: ${options.mode}`,
    `Intent: ${options.userIntent}`,
    `Module: ${options.moduleKey}`,
    `Scope: ${options.scopePath}`,
    "Required response contract:",
    options.responseContract,
    "Return exactly three sections:",
    "1) Key intent",
    "2) Evidence to prioritize",
    "3) Execution plan",
    "Keep each section under 4 bullets and stay grounded in provided context.",
    "User query:",
    options.userQuery || "(empty query)",
    "Retrieved context:",
    options.contextText || "No retrieval context available.",
  ].join("\n\n");
}

/** Builds the reasoning stage prompt that pressure-tests the planner output. */
export function buildReasoningPrompt(options: {
  mode: StewardChatMode;
  userIntent: StewardResponseIntent;
  responseContract: string;
  userQuery: string;
  contextText: string;
  plannerNotes: string;
}): string {
  return [
    "You are Steward's reasoning verifier.",
    "Do not answer the user directly.",
    `Mode: ${options.mode}`,
    `Intent: ${options.userIntent}`,
    "Required response contract:",
    options.responseContract,
    "Validate the planner notes against evidence and identify any weak assumptions.",
    "Return exactly three sections:",
    "1) Validated evidence",
    "2) Risks and unknowns",
    "3) Final answer strategy",
    "Keep output concise, factual, and retrieval-grounded.",
    "User query:",
    options.userQuery || "(empty query)",
    "Planner notes:",
    options.plannerNotes || "(no planner notes)",
    "Retrieved context:",
    options.contextText || "No retrieval context available.",
  ].join("\n\n");
}

/** Builds the composer stage prompt that converts planning notes into a concrete answer blueprint. */
export function buildComposerPrompt(options: {
  mode: StewardChatMode;
  userIntent: StewardResponseIntent;
  responseContract: string;
  userQuery: string;
  contextText: string;
  plannerNotes: string;
  reasoningNotes: string;
}): string {
  return [
    "You are Steward's response composer.",
    "Do not answer the user directly.",
    `Mode: ${options.mode}`,
    `Intent: ${options.userIntent}`,
    "Required response contract:",
    options.responseContract,
    "Return exactly two sections:",
    "1) Must-include points",
    "2) Response shape checklist",
    "Each section: max 6 bullets, no filler.",
    "User query:",
    options.userQuery || "(empty query)",
    "Planner notes:",
    options.plannerNotes || "(none)",
    "Reasoning notes:",
    options.reasoningNotes || "(none)",
    "Retrieved context:",
    options.contextText || "No retrieval context available.",
  ].join("\n\n");
}

/** Builds a final meta-reflection prompt to stress-test instruction fidelity before answer generation. */
export function buildMetaReflectionPrompt(options: {
  userIntent: StewardResponseIntent;
  responseContract: string;
  userQuery: string;
  plannerNotes: string;
  reasoningNotes: string;
  composerNotes: string;
}): string {
  return [
    "You are Steward's meta-reflection validator.",
    "Do not answer the user directly.",
    `Intent: ${options.userIntent}`,
    "Required response contract:",
    options.responseContract,
    "Return exactly three sections:",
    "1) Instruction-following risks",
    "2) Data accuracy checks",
    "3) Final guardrails",
    "Each section max 5 bullets.",
    "User query:",
    options.userQuery || "(empty query)",
    "Planner notes:",
    options.plannerNotes || "(none)",
    "Reasoning notes:",
    options.reasoningNotes || "(none)",
    "Composer notes:",
    options.composerNotes || "(none)",
  ].join("\n\n");
}

/** Builds a second-order meta reflection prompt to harden instruction-following under uncertainty. */
export function buildMetaMetaReflectionPrompt(options: {
  userIntent: StewardResponseIntent;
  responseContract: string;
  userQuery: string;
  metaNotes: string;
}): string {
  return [
    "You are Steward's second-pass meta validator (meta-meta).",
    "Do not answer the user directly.",
    `Intent: ${options.userIntent}`,
    "Required response contract:",
    options.responseContract,
    "Return exactly three sections:",
    "1) Hidden failure modes",
    "2) Ambiguity you must surface",
    "3) Recovery strategy if model output is sparse",
    "Each section max 4 bullets.",
    "User query:",
    options.userQuery || "(empty query)",
    "Meta notes from prior pass:",
    options.metaNotes || "(none)",
  ].join("\n\n");
}
