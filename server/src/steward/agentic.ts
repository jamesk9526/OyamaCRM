/**
 * Steward AI agentic multi-stage planning pipeline and tool-execution pass.
 * Runs planner → reasoning → composer → meta → meta-meta stages, then a
 * tool-backed read pass when safe tools are available.
 */

import type {
  StewardAiChatPayload,
  StewardChatMode,
  StewardResponseIntent,
  AgenticPreparationResult,
  StewardEvidencePayload,
} from "./types.js";
import { asSafeText } from "./sanitize.js";
import {
  resolveThinkingModel,
} from "./intent.js";
import { parseStewardAiConfig, runStewardAiChat } from "../services/steward-ai-ollama.js";
import { withStewardAiTask } from "../services/steward-ai-runtime-status.js";
import {
  executeStewardTool,
  listStewardTools,
  type StewardToolExecutionContext,
} from "../services/steward-tool-registry.js";
import {
  STEWARD_GROUNDING_RULES,
  STEWARD_TOOL_SELECTION_RULES,
  buildStewardModulePolicy,
  delimitStewardData,
} from "./prompt-policy.js";

// ─── Agentic pipeline types ────────────────────────────────────────────────────

export interface AgenticToolRequest {
  tool: string;
  reason: string;
  input?: Record<string, unknown>;
}

export interface AgenticToolPassResult {
  notes: string[];
  toolsUsed: string[];
}

// ─── Multi-stage preparation ───────────────────────────────────────────────────

/**
 * Runs planner → reasoning → composer → meta → meta-meta stages as a single combined pass.
 * Previously 5 sequential blocking calls; collapsed to 1 to eliminate ~5× timeout budget drain.
 * DeepSeek R1 handles multi-step internal reasoning natively via <think>, so separate stages
 * added latency without meaningful quality gain over a well-structured single prompt.
 * When agenticMultiStage is disabled, returns an empty shell immediately.
 */
export async function buildAgenticPreparation(options: {
  organizationId: string;
  enabled: boolean;
  config: ReturnType<typeof parseStewardAiConfig>;
  mode: StewardChatMode;
  userIntent: StewardResponseIntent;
  responseContract: string;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  contextText: string;
}): Promise<AgenticPreparationResult> {
  if (!options.config.agenticMultiStage) {
    return {
      reasoningModel: options.config.model,
      stageSummaries: [],
      toolsUsed: [],
      userIntent: options.userIntent,
    };
  }

  const reasoningModel =
    options.config.reasoningMode === "thinking"
      ? resolveThinkingModel(options.config)
      : options.config.model;

  const stageSummaries: string[] = [];
  const toolsUsed: string[] = [];

  try {
    // Single combined planning pass — covers plan + reasoning + blueprint + quality check.
    // Uses the thinking model so internal <think> gives the same deliberation depth
    // as the old 5-stage chain without the 5× serial latency cost.
    const combinedPrompt = [
      "You are Steward's agentic planning engine for a nonprofit donor CRM.",
      `User intent category: ${options.userIntent}`,
      `Scope: ${options.scopePath || "general"}`,
      `Module: ${options.moduleKey}`,
      "Return concise decision summaries only. Do not reveal hidden chain-of-thought.",
      "Grounding rules:",
      STEWARD_GROUNDING_RULES,
      buildStewardModulePolicy(options.moduleKey, options.scopePath),
      "",
      "Produce a concise planning brief using EXACTLY these four section headers:",
      "## Plan",
      "(Steps and approach to answer the user's request accurately)",
      "",
      "## Reasoning",
      "(Confidence level, evidence quality from context, and key data gaps)",
      "",
      "## Blueprint",
      "(Priority-ordered list of points the final response MUST include)",
      "",
      "## Quality Check",
      "(Instruction-following risks, format traps, or missing data that could hurt response quality)",
      "",
      "Response contract in effect:",
      options.responseContract,
      "",
      "User query:",
      delimitStewardData("user_query", options.userQuery, "(empty query)"),
      "",
      "Available CRM context:",
      delimitStewardData("crm_context", options.contextText.slice(0, 3000), "No CRM context available."),
    ].join("\n");

    const planResult = await withStewardAiTask(
      {
        organizationId: options.organizationId,
        enabled: options.enabled,
        config: options.config,
        label: "Agentic planning pass",
        status: "thinking",
        fallbackOnError: true,
      },
      () =>
        runStewardAiChat(
          options.config,
          [{ role: "system", content: combinedPrompt }],
          { model: reasoningModel, temperature: 0.15, maxTokens: 1200 }
        )
    );

    stageSummaries.push(`Agentic Plan:\n${planResult.content}`);
    toolsUsed.push("agentic.plan");

    return { reasoningModel, stageSummaries, toolsUsed, userIntent: options.userIntent };
  } catch {
    // Graceful fallback keeps chat responsive when the configured thinking model is unavailable.
    return {
      reasoningModel: options.config.model,
      stageSummaries,
      toolsUsed,
      userIntent: options.userIntent,
    };
  }
}

// ─── Tool verification helpers ─────────────────────────────────────────────────

/** Produces a human-readable verification line from a tool execution result. */
export function summarizeToolVerification(result: unknown): string {
  if (Array.isArray(result)) {
    return `Verification: result returned ${result.length} row(s).`;
  }

  if (!result || typeof result !== "object") {
    return "Verification: result payload was present but not object-shaped.";
  }

  const payload = result as Record<string, unknown>;
  const numericChecks = [
    "rowsRead",
    "createdCount",
    "updatedCount",
    "duplicateCount",
    "failedCount",
    "sentCount",
    "skippedCount",
    "affectedCount",
    "successCount",
    "total",
  ]
    .map((key) => ({ key, value: payload[key] }))
    .filter((entry) => typeof entry.value === "number" && Number.isFinite(entry.value as number))
    .slice(0, 5);

  if (numericChecks.length > 0) {
    return `Verification: ${numericChecks.map((entry) => `${entry.key}=${String(entry.value)}`).join(", ")}.`;
  }

  const keys = Object.keys(payload).slice(0, 6);
  return keys.length > 0
    ? `Verification: result keys present (${keys.join(", ")}).`
    : "Verification: empty result object returned.";
}

/** Extracts evidence items from tool-pass notes for the structured response. */
export function extractVerificationEvidence(notes: string[]): StewardEvidencePayload[] {
  const items: StewardEvidencePayload[] = [];

  for (const note of notes) {
    const lines = String(note || "").split("\n");
    for (const line of lines) {
      if (!line.startsWith("Verification:")) continue;
      items.push({ label: asSafeText(line, "", 220) });
      if (items.length >= 6) return items;
    }
  }

  return items;
}

/** Parses JSON tool-request plans produced by the agentic planner. */
export function parseAgenticToolRequestPlan(raw: string): AgenticToolRequest[] {
  const content = String(raw || "").trim();
  if (!content) return [];

  const fencedJson = content.match(/```(?:json|steward-artifacts)?\s*\n([\s\S]*?)```/i)?.[1] ?? content;

  try {
    const parsed = JSON.parse(fencedJson) as { toolRequests?: unknown } | unknown;
    const toolRequests =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as { toolRequests?: unknown }).toolRequests
        : undefined;
    if (!Array.isArray(toolRequests)) return [];

    return toolRequests
      .filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry)
      )
      .map((entry) => ({
        tool: asSafeText(entry.tool, "", 120),
        reason: asSafeText(entry.reason, "", 240),
        input:
          entry.input && typeof entry.input === "object" && !Array.isArray(entry.input)
            ? (entry.input as Record<string, unknown>)
            : undefined,
      }))
      .filter((entry) => Boolean(entry.tool));
  } catch {
    return [];
  }
}

/** Builds the strict, injection-resistant prompt used to choose safe read tools. */
export function buildAgenticToolPlannerPrompt(options: {
  userQuery: string;
  contextText: string;
  toolCatalog: string;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
}): string {
  return [
    "You are Steward's read-only tool planner.",
    "Return tool requests, not an answer to the user and not hidden reasoning.",
    "Grounding rules:",
    STEWARD_GROUNDING_RULES,
    "Tool-selection rules:",
    STEWARD_TOOL_SELECTION_RULES,
    buildStewardModulePolicy(options.moduleKey, options.scopePath),
    'Return exactly one JSON object shaped as {"toolRequests":[{"tool":"...","reason":"brief evidence need","input":{...}}]}.',
    'If no listed tool is necessary or its required input is unavailable, return {"toolRequests":[]}.',
    "Request no more than 4 tools. Use only exact tool names and input fields in the catalog.",
    "User query:",
    delimitStewardData("user_query", options.userQuery, "(empty query)"),
    "Existing context:",
    delimitStewardData("crm_context", options.contextText, "(none)"),
    "Available read tools and their input contracts:",
    delimitStewardData("tool_catalog", options.toolCatalog, "(none)"),
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ─── Agentic tool pass ─────────────────────────────────────────────────────────

/**
 * Asks the planning model which safe read tools to use, then executes them.
 * Returns a notes array for injection into the main context.
 */
export async function buildAgenticToolPass(options: {
  organizationId: string;
  enabled: boolean;
  config: ReturnType<typeof parseStewardAiConfig>;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  contextText: string;
  userId: string;
  role: string;
}): Promise<AgenticToolPassResult> {
  const context: StewardToolExecutionContext = {
    organizationId: options.organizationId,
    userId: options.userId,
    role: options.role,
    moduleKey: options.moduleKey === "oshareview" ? "oshareview" : "donor",
    scopePath: options.scopePath,
    requestRoute: "/api/steward-ai/chat",
  };

  const availableTools = (await listStewardTools(context)).filter(
    (tool) => tool.allowed && tool.kind === "read"
  );
  if (availableTools.length === 0) {
    return { notes: ["No safe read tools were available for this request."], toolsUsed: [] };
  }

  const toolCatalog = availableTools
    .map((tool) => `- ${tool.name}: ${tool.description} Input contract: ${tool.inputGuidance}`)
    .join("\n");

  const plannerPrompt = buildAgenticToolPlannerPrompt({
    userQuery: options.userQuery,
    contextText: options.contextText,
    toolCatalog,
    moduleKey: options.moduleKey,
    scopePath: options.scopePath,
  });

  const plannerResult = await withStewardAiTask(
    {
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: options.config,
      label: "Planning tool-assisted answer",
      status: "thinking",
      fallbackOnError: true,
    },
    () =>
      runStewardAiChat(
        options.config,
        [{ role: "system", content: plannerPrompt }],
        {
          model:
            options.config.reasoningMode === "thinking"
              ? resolveThinkingModel(options.config)
              : options.config.model,
          temperature: 0.1,
          maxTokens: 700,
        }
      )
  );

  const plannedRequests = parseAgenticToolRequestPlan(plannerResult.content).slice(0, 4);
  if (plannedRequests.length === 0) {
    return {
      notes: ["Agentic planner decided not to use any tools."],
      toolsUsed: ["agentic.tools.none"],
    };
  }

  const notes: string[] = [
    `Tool planner selected ${plannedRequests.length} read tool${plannedRequests.length === 1 ? "" : "s"}.`,
  ];
  const toolsUsed: string[] = ["agentic.tools.plan"];

  for (const request of plannedRequests) {
    const toolDefinition = availableTools.find((tool) => tool.name === request.tool);
    if (!toolDefinition) {
      notes.push(`Skipped unavailable tool: ${request.tool}.`);
      continue;
    }

    try {
      const execution = await executeStewardTool(context, toolDefinition.name, request.input, {
        confirm: false,
      });
      toolsUsed.push(`agentic.tool.${toolDefinition.name}`);
      const verificationSummary = summarizeToolVerification(execution.result);
      notes.push(
        [
          `Tool result: ${toolDefinition.name}`,
          request.reason ? `Reason: ${request.reason}` : "",
          verificationSummary,
          `Summary: ${JSON.stringify(execution.result).slice(0, 1200)}`,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (error) {
      notes.push(
        `Tool failed: ${toolDefinition.name} — ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  return { notes, toolsUsed };
}
