/** Steward AI API routes for config, health test, and chat completion. */
import { Router } from "express";
import crypto from "node:crypto";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import {
  defaultStewardAiConfig,
  listStewardAiModels,
  parseStewardAiConfig,
  runStewardAiChat,
  runStewardAiChatStream,
  testStewardAiConnection,
  type StewardAiChatMessage,
  type StewardAiMode,
  type StewardAiReasoningMode,
} from "../services/steward-ai-ollama.js";
import type { Prisma } from "@prisma/client";
import type { Router as ExpressRouter } from "express";

const router: ExpressRouter = Router();
const STEWARD_AI_PLUGIN_KEY = "steward_ai";

// Steward AI endpoints require authenticated users.
router.use(requireAuth);

interface StewardAiConfigResponse {
  enabled: boolean;
  mode: StewardAiMode;
  endpointUrl: string;
  model: string;
  thinkingModel: string;
  reasoningMode: StewardAiReasoningMode;
  agenticMultiStage: boolean;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  systemPrompt: string;
  hasApiKey: boolean;
}

interface StewardAiUpdatePayload {
  enabled?: boolean;
  mode?: StewardAiMode;
  endpointUrl?: string;
  model?: string;
  thinkingModel?: string;
  reasoningMode?: StewardAiReasoningMode;
  agenticMultiStage?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
  apiKey?: string;
}

interface StewardAiModelsQuery {
  endpointUrl?: string;
}

interface BridgePairingRequestPayload {
  siteUrl?: string;
}

type ReadinessStatus = "Working" | "Partially Working" | "Broken";

interface BridgeReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

interface BridgeReadinessPayload {
  status: ReadinessStatus;
  summary: string;
  checks: BridgeReadinessCheck[];
  testedAt: string;
}

interface BridgePairingKeyPayload {
  version: 1;
  kind: "oyama.bridge.pairing";
  generatedAt: string;
  expiresAt: string;
  organizationId: string;
  organizationName: string;
  bridgeConfig: {
    bridgeAutostart: boolean;
    bridgeUpstreamUrl: string;
    bridgePort: number;
    bridgeApiKey: string;
    bridgeAllowedOrigins: string;
    bridgePublicBaseUrl: string;
    bridgeDomainUrl: string;
    bridgeModel: string;
    bridgeThinkingModel: string;
    bridgeCudaDevice: string;
    bridgeTemperature: number;
    bridgeTimeoutMs: number;
  };
  aiHints: {
    mode: "remote";
    endpointUrl: string;
    model: string;
    thinkingModel: string;
  };
}

interface StewardAiChatPayload {
  messages?: StewardAiChatMessage[];
  mode?: "ask" | "analyze" | "draft" | "action" | "help";
  moduleKey?: "donor" | "compassion" | "events" | "watchdog" | "webmaster";
  scopePath?: string;
}

type StewardChatMode = NonNullable<StewardAiChatPayload["mode"]>;

interface StewardContextResult {
  contextText: string;
  toolsUsed: string[];
  recordsUsed: string[];
}

interface TopDonorResult {
  reply: string;
  toolsUsed: string[];
  recordsUsed: string[];
}

interface AgenticPreparationResult {
  reasoningModel: string;
  stageSummaries: string[];
  toolsUsed: string[];
}

/** Returns query tokens suitable for lightweight retrieval. */
function tokenizeQuery(input: string): string[] {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3)
    .slice(0, 6);
}

/** Extracts path-scoped IDs from known workspace routes. */
function parseScopeIdentifiers(scopePath: string): { clientId?: string; eventId?: string; constituentId?: string } {
  const parts = scopePath.split("/").filter(Boolean);
  if (parts[0] === "compassion" && parts[1] === "clients" && parts[2]) {
    return { clientId: parts[2] };
  }
  if (parts[0] === "events" && parts[1] && !["events", "setup", "check-in", "guests", "reports", "tickets", "tables", "sponsors", "fundraising", "communications"].includes(parts[1])) {
    return { eventId: parts[1] };
  }
  if (parts[0] === "constituents" && parts[1]) {
    return { constituentId: parts[1] };
  }
  return {};
}

/** Returns true when a donor question clearly asks for top/major donor ranking. */
function isTopDonorQuestion(input: string): boolean {
  const normalized = input.toLowerCase();
  return /(top\s+donors?|largest\s+donors?|major\s+donors?|highest\s+donors?)/.test(normalized);
}

/** Formats a numeric donation value for concise human-readable output. */
function formatGivingAmount(value: unknown): string {
  const parsed = Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return String(value ?? "0");
  return `$${parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
}

/** Builds a deterministic top-donor answer directly from CRM data. */
async function buildTopDonorResult(organizationId: string): Promise<TopDonorResult> {
  const topDonors = await prisma.constituent.findMany({
    where: {
      organizationId,
      totalLifetimeGiving: { gt: 0 },
    },
    select: {
      firstName: true,
      lastName: true,
      totalLifetimeGiving: true,
      lastGiftDate: true,
    },
    orderBy: [
      { totalLifetimeGiving: "desc" },
      { lastGiftDate: "desc" },
    ],
    take: 5,
  });

  if (topDonors.length === 0) {
    return {
      reply: "I could not find any donors with lifetime giving greater than $0 yet.",
      toolsUsed: ["donor.topDonorSnapshot"],
      recordsUsed: [],
    };
  }

  const lines = topDonors.map((donor, index) => {
    const name = `${donor.firstName} ${donor.lastName}`.trim();
    const amount = formatGivingAmount(donor.totalLifetimeGiving);
    const lastGift = donor.lastGiftDate ? donor.lastGiftDate.toISOString().slice(0, 10) : "unknown";
    return `${index + 1}. ${name} — ${amount} (last gift: ${lastGift})`;
  });

  return {
    reply: [
      "Your top donors by lifetime giving are:",
      ...lines,
    ].join("\n"),
    toolsUsed: ["donor.topDonorSnapshot"],
    recordsUsed: topDonors.map((donor, index) =>
      `${index + 1}. ${donor.firstName} ${donor.lastName} (${formatGivingAmount(donor.totalLifetimeGiving)})`
    ),
  };
}

/** Returns mode-specific next-step defaults when the model does not provide explicit actions. */
function defaultNextStepsByMode(mode: StewardChatMode): string[] {
  if (mode === "analyze") {
    return [
      "Validate the top findings against your current filtered view.",
      "Prioritize one high-impact segment for immediate follow-up.",
      "Schedule a quick review of outliers before taking write actions.",
    ];
  }

  if (mode === "draft") {
    return [
      "Edit names, tone, and timing for your audience before sending.",
      "Confirm compliance and privacy language where required.",
      "Save the draft to Communications or Tasks for team review.",
    ];
  }

  if (mode === "action") {
    return [
      "Review the recommended action list and choose one to execute.",
      "Confirm scope and impacted records before any write operation.",
      "Capture an audit note once execution is complete.",
    ];
  }

  if (mode === "help") {
    return [
      "Follow the steps in order from your current page context.",
      "If expected options are missing, verify your role permissions.",
      "Use AI Settings to test runtime connectivity if responses fail.",
    ];
  }

  return [
    "Choose one concrete follow-up and assign an owner.",
    "Create a task or draft communication from the suggested steps.",
    "Re-run this question after updates to compare changes.",
  ];
}

/** Formats replies into consistent analyst-friendly sections. */
function formatReplyByMode(options: {
  mode: StewardChatMode;
  reply: string;
  toolsUsed: string[];
  recordsUsed: string[];
}): string {
  const summary = options.reply.trim() || "No summary was returned.";
  const evidenceItems = [
    ...options.recordsUsed.slice(0, 6).map((record) => `Record: ${record}`),
    ...options.toolsUsed.slice(0, 6).map((tool) => `Tool: ${tool}`),
  ];
  const nextSteps = defaultNextStepsByMode(options.mode);

  const evidenceSection = evidenceItems.length > 0
    ? evidenceItems.map((item, index) => `${index + 1}. ${item}`).join("\n")
    : "1. No direct evidence records were retrieved for this response.";

  return [
    "## Summary",
    summary,
    "## Evidence",
    evidenceSection,
    "## Next Steps",
    nextSteps.map((step, index) => `${index + 1}. ${step}`).join("\n"),
  ].join("\n\n");
}

/** Picks the effective thinking model, falling back to the primary model when unset. */
function resolveThinkingModel(config: ReturnType<typeof parseStewardAiConfig>): string {
  return String(config.thinkingModel || config.model).trim() || config.model;
}

/** Builds the planner stage prompt for agentic multi-stage preparation. */
function buildPlannerPrompt(options: {
  mode: StewardChatMode;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
  contextText: string;
}): string {
  return [
    "You are Steward's planning engine. Produce concise planning notes only.",
    "Do not answer the user yet.",
    `Mode: ${options.mode}`,
    `Module: ${options.moduleKey}`,
    `Scope: ${options.scopePath}`,
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
function buildReasoningPrompt(options: {
  mode: StewardChatMode;
  userQuery: string;
  contextText: string;
  plannerNotes: string;
}): string {
  return [
    "You are Steward's reasoning verifier.",
    "Do not answer the user directly.",
    `Mode: ${options.mode}`,
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

/** Runs agentic planning + reasoning stages when enabled and returns summary artifacts. */
async function buildAgenticPreparation(options: {
  config: ReturnType<typeof parseStewardAiConfig>;
  mode: StewardChatMode;
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
    };
  }

  const reasoningModel = options.config.reasoningMode === "thinking"
    ? resolveThinkingModel(options.config)
    : options.config.model;

  const stageSummaries: string[] = [];
  const toolsUsed: string[] = [];

  try {
    const plannerResult = await runStewardAiChat(
      options.config,
      [
        {
          role: "system",
          content: buildPlannerPrompt({
            mode: options.mode,
            moduleKey: options.moduleKey,
            scopePath: options.scopePath,
            userQuery: options.userQuery,
            contextText: options.contextText,
          }),
        },
      ],
      {
        model: reasoningModel,
        temperature: 0.2,
        maxTokens: 700,
      }
    );

    stageSummaries.push(`Planner Notes:\n${plannerResult.content}`);
    toolsUsed.push("agentic.plan");

    const reasoningResult = await runStewardAiChat(
      options.config,
      [
        {
          role: "system",
          content: buildReasoningPrompt({
            mode: options.mode,
            userQuery: options.userQuery,
            contextText: options.contextText,
            plannerNotes: plannerResult.content,
          }),
        },
      ],
      {
        model: reasoningModel,
        temperature: 0.15,
        maxTokens: 900,
      }
    );

    stageSummaries.push(`Reasoning Notes:\n${reasoningResult.content}`);
    toolsUsed.push("agentic.reason");

    return {
      reasoningModel,
      stageSummaries,
      toolsUsed,
    };
  } catch {
    // Graceful fallback keeps chat responsive when the configured thinking model is unavailable.
    return {
      reasoningModel: options.config.model,
      stageSummaries,
      toolsUsed,
    };
  }
}

/** Creates a runtime instruction block tailored to mode/module/context. */
function buildRuntimeSystemPrompt(options: {
  mode: NonNullable<StewardAiChatPayload["mode"]>;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  contextText: string;
  agenticNotes?: string[];
}): string {
  const actionPolicy = options.mode === "action"
    ? "Action mode policy: do not claim an action is executed. Propose explicit steps, required confirmations, and rollback considerations."
    : "Non-action policy: provide read-first analysis and practical next steps.";

  const moduleLexicon = options.moduleKey === "compassion"
    ? "Use client-care terminology (client, case, appointment, follow-up). Avoid donor fundraising terms unless explicitly requested."
    : options.moduleKey === "events"
      ? "Use event-operations terminology (event, guest, check-in, sponsor, seating, registration)."
      : options.moduleKey === "watchdog"
        ? "Use security operations terminology (incident, severity, alert, audit, access control, encrypted vault)."
        : options.moduleKey === "webmaster"
          ? "Use website operations terminology (templates, pages, publishing, domain, SEO, approvals)."
          : "Use donor stewardship terminology (constituent, donation, campaign, stewardship, retention). If the user asks for top donors and ranked donor context exists, answer directly from that ranked data with names plus lifetime values. Do not claim missing data for that question unless no ranked donor data exists.";

  return [
    "Runtime instruction: answer using the provided CRM context first.",
    `Current module: ${options.moduleKey}.`,
    `Current scope path: ${options.scopePath}.`,
    actionPolicy,
    moduleLexicon,
    "If context does not support a claim, clearly label it as unknown.",
    "Cite concrete records, counts, and names from context when possible.",
    "Do not expose private chain-of-thought. Provide concise conclusions grounded in evidence.",
    "Finish with a short numbered next-step list when the user asks for guidance.",
    options.agenticNotes && options.agenticNotes.length > 0
      ? [
          "Agentic preparation notes:",
          ...options.agenticNotes,
        ].join("\n\n")
      : "",
    "Retrieved context follows:",
    options.contextText || "No retrieval context available.",
  ].filter(Boolean).join("\n\n");
}

/** Builds donor module retrieval context from constituents, tasks, and meetings. */
async function buildDonorContext(params: {
  organizationId: string;
  tokens: string[];
  scopePath: string;
}): Promise<StewardContextResult> {
  const toolsUsed: string[] = ["donor.constituentLookup", "donor.workQueueSnapshot", "donor.topDonorSnapshot"];

  const donorMatches = params.tokens.length > 0
    ? await prisma.constituent.findMany({
        where: {
          organizationId: params.organizationId,
          OR: params.tokens.flatMap((token) => ([
            { firstName: { contains: token } },
            { lastName: { contains: token } },
            { email: { contains: token } },
          ])),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          donorStatus: true,
          lastGiftDate: true,
          totalLifetimeGiving: true,
        },
        take: 6,
      })
    : [];

  const pendingTaskCount = await prisma.task.count({
    where: {
      status: "PENDING",
      OR: [
        { constituent: { organizationId: params.organizationId } },
        { meeting: { organizationId: params.organizationId } },
        { createdBy: { organizationId: params.organizationId } },
        { assignee: { organizationId: params.organizationId } },
      ],
    },
  });

  const upcomingMeetings = await prisma.meeting.findMany({
    where: {
      organizationId: params.organizationId,
      status: "SCHEDULED",
    },
    select: {
      id: true,
      title: true,
      startTime: true,
    },
    orderBy: { startTime: "asc" },
    take: 5,
  });

  const topDonors = await prisma.constituent.findMany({
    where: {
      organizationId: params.organizationId,
      totalLifetimeGiving: { gt: 0 },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      donorStatus: true,
      totalLifetimeGiving: true,
      lastGiftDate: true,
    },
    orderBy: [
      { totalLifetimeGiving: "desc" },
      { lastGiftDate: "desc" },
    ],
    take: 8,
  });

  const topDonorLeaderboard = topDonors.map((donor, index) => ({
    rank: index + 1,
    name: `${donor.firstName} ${donor.lastName}`,
    donorStatus: donor.donorStatus,
    lifetimeGiving: String(donor.totalLifetimeGiving),
    lastGiftDate: donor.lastGiftDate?.toISOString() ?? null,
  }));

  const lines = [
    `Donor scope path: ${params.scopePath}`,
    `Pending tasks in queue: ${pendingTaskCount}`,
    `Upcoming meetings: ${upcomingMeetings.length}`,
    ...upcomingMeetings.map((meeting) => `- Meeting: ${meeting.title} at ${meeting.startTime.toISOString()}`),
    `Top donors by lifetime giving: ${topDonors.length}`,
    `Top donor leaderboard (authoritative JSON): ${JSON.stringify(topDonorLeaderboard)}`,
    ...topDonors.map((donor, index) =>
      `${index + 1}. ${donor.firstName} ${donor.lastName} [${donor.donorStatus}] lifetime=${String(donor.totalLifetimeGiving)} lastGift=${donor.lastGiftDate?.toISOString() ?? "none"}`
    ),
    `Matched constituents: ${donorMatches.length}`,
    ...donorMatches.map((constituent) =>
      `- ${constituent.firstName} ${constituent.lastName} [${constituent.donorStatus}] lastGift=${constituent.lastGiftDate?.toISOString() ?? "none"} lifetime=${String(constituent.totalLifetimeGiving)}`
    ),
  ];

  return {
    contextText: lines.join("\n"),
    toolsUsed,
    recordsUsed: [
      ...topDonors.slice(0, 5).map((donor) => `${donor.firstName} ${donor.lastName}`),
      ...donorMatches.slice(0, 4).map((donor) => `${donor.firstName} ${donor.lastName}`),
      ...upcomingMeetings.slice(0, 3).map((meeting) => `Meeting: ${meeting.title}`),
    ],
  };
}

/** Builds Compassion module retrieval context from clients, cases, appointments, and follow-ups. */
async function buildCompassionContext(params: {
  organizationId: string;
  tokens: string[];
  scopePath: string;
}): Promise<StewardContextResult> {
  const toolsUsed: string[] = ["compassion.clientLookup", "compassion.caseFollowupSnapshot"];
  const ids = parseScopeIdentifiers(params.scopePath);

  const scopedClient = ids.clientId
    ? await prisma.compassionClient.findFirst({
        where: { id: ids.clientId, organizationId: params.organizationId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientStatus: true,
          intakeDate: true,
          _count: { select: { cases: true, appointments: true, followUps: true } },
        },
      })
    : null;

  const matchedClients = params.tokens.length > 0
    ? await prisma.compassionClient.findMany({
        where: {
          organizationId: params.organizationId,
          OR: params.tokens.flatMap((token) => ([
            { firstName: { contains: token } },
            { lastName: { contains: token } },
            { email: { contains: token } },
          ])),
        },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          clientStatus: true,
        },
        take: 6,
      })
    : [];

  const openCases = await prisma.compassionCase.findMany({
    where: {
      organizationId: params.organizationId,
      caseStatus: "OPEN",
    },
    select: {
      id: true,
      caseNumber: true,
      caseType: true,
      priority: true,
      client: { select: { firstName: true, lastName: true } },
    },
    orderBy: { openedAt: "desc" },
    take: 6,
  });

  const pendingFollowUps = await prisma.compassionFollowUp.count({
    where: {
      organizationId: params.organizationId,
      status: "PENDING",
    },
  });

  const lines = [
    `Compassion scope path: ${params.scopePath}`,
    scopedClient
      ? `Scoped client: ${scopedClient.firstName} ${scopedClient.lastName} [${scopedClient.clientStatus}] intake=${scopedClient.intakeDate.toISOString()} cases=${scopedClient._count.cases} appointments=${scopedClient._count.appointments} followUps=${scopedClient._count.followUps}`
      : "Scoped client: none",
    `Pending follow-ups: ${pendingFollowUps}`,
    `Open cases sampled: ${openCases.length}`,
    ...openCases.map((item) =>
      `- Case ${item.caseNumber} (${item.caseType}/${item.priority}) for ${item.client.firstName} ${item.client.lastName}`
    ),
    `Matched clients: ${matchedClients.length}`,
    ...matchedClients.map((client) => `- ${client.firstName} ${client.lastName} [${client.clientStatus}]`),
  ];

  return {
    contextText: lines.join("\n"),
    toolsUsed,
    recordsUsed: [
      ...(scopedClient ? [`Scoped client: ${scopedClient.firstName} ${scopedClient.lastName}`] : []),
      ...matchedClients.slice(0, 5).map((client) => `${client.firstName} ${client.lastName}`),
      ...openCases.slice(0, 4).map((item) => `Case ${item.caseNumber}`),
    ],
  };
}

/** Builds Events module retrieval context from event and guest operations data. */
async function buildEventsContext(params: {
  organizationId: string;
  tokens: string[];
  scopePath: string;
}): Promise<StewardContextResult> {
  const toolsUsed: string[] = ["events.eventLookup", "events.guestOpsSnapshot"];
  const ids = parseScopeIdentifiers(params.scopePath);

  const scopedEvent = ids.eventId
    ? await prisma.event.findFirst({
        where: { id: ids.eventId, organizationId: params.organizationId },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
          _count: { select: { guests: true } },
        },
      })
    : null;

  const matchedEvents = params.tokens.length > 0
    ? await prisma.event.findMany({
        where: {
          organizationId: params.organizationId,
          OR: params.tokens.map((token) => ({ name: { contains: token } })),
        },
        select: {
          id: true,
          name: true,
          status: true,
          startDate: true,
        },
        take: 6,
      })
    : [];

  const guestCount = await prisma.eventGuest.count({
    where: {
      event: { organizationId: params.organizationId },
    },
  });

  const checkInCount = await prisma.eventGuest.count({
    where: {
      event: { organizationId: params.organizationId },
      checkedIn: true,
    },
  });

  const lines = [
    `Events scope path: ${params.scopePath}`,
    scopedEvent
      ? `Scoped event: ${scopedEvent.name} [${scopedEvent.status}] start=${scopedEvent.startDate.toISOString()} guests=${scopedEvent._count.guests}`
      : "Scoped event: none",
    `Guests total: ${guestCount}`,
    `Guests checked in: ${checkInCount}`,
    `Matched events: ${matchedEvents.length}`,
    ...matchedEvents.map((event) => `- ${event.name} [${event.status}] start=${event.startDate.toISOString()}`),
  ];

  return {
    contextText: lines.join("\n"),
    toolsUsed,
    recordsUsed: [
      ...(scopedEvent ? [`Scoped event: ${scopedEvent.name}`] : []),
      ...matchedEvents.slice(0, 5).map((event) => event.name),
      `Guests: ${guestCount}`,
      `Checked in: ${checkInCount}`,
    ],
  };
}

/** Runs module-specific retrieval tools and returns aggregated context text. */
async function buildRetrievalContext(params: {
  organizationId: string;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  userQuery: string;
}): Promise<StewardContextResult> {
  const tokens = tokenizeQuery(params.userQuery);

  if (params.moduleKey === "compassion") {
    return buildCompassionContext({
      organizationId: params.organizationId,
      tokens,
      scopePath: params.scopePath,
    });
  }

  if (params.moduleKey === "events") {
    return buildEventsContext({
      organizationId: params.organizationId,
      tokens,
      scopePath: params.scopePath,
    });
  }

  if (params.moduleKey === "watchdog") {
    const recentSecurityAudits = await prisma.auditLog.findMany({
      where: {
        organizationId: params.organizationId,
        OR: [
          { action: { contains: "UNAUTHORIZED" } },
          { action: { contains: "FORBIDDEN" } },
          { action: { contains: "LOGIN" } },
          { action: { contains: "DELETE" } },
          { action: { contains: "RESET" } },
        ],
      },
      select: {
        id: true,
        action: true,
        entity: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    return {
      toolsUsed: ["watchdog.auditSnapshot", "watchdog.accessRiskSummary"],
      contextText: [
        `Watchdog scope path: ${params.scopePath}`,
        `Recent critical/secure audit events: ${recentSecurityAudits.length}`,
        ...recentSecurityAudits.map((entry) => `- ${entry.action}${entry.entity ? ` on ${entry.entity}` : ""} at ${entry.createdAt.toISOString()}`),
      ].join("\n"),
      recordsUsed: recentSecurityAudits.slice(0, 8).map((entry) =>
        `${entry.action}${entry.entity ? ` (${entry.entity})` : ""}`
      ),
    };
  }

  if (params.moduleKey === "webmaster") {
    return {
      toolsUsed: ["webmaster.planningContext"],
      contextText: [
        `WebMaster scope path: ${params.scopePath}`,
        "Current module status: starter dashboard is active.",
        "No persisted website/page database records are available yet.",
        "Focus guidance on planning, IA, and staged implementation steps.",
      ].join("\n"),
      recordsUsed: [
        `Scope: ${params.scopePath}`,
        "WebMaster starter dashboard context",
      ],
    };
  }

  return buildDonorContext({
    organizationId: params.organizationId,
    tokens,
    scopePath: params.scopePath,
  });
}

/** Resolves active org ID, failing gracefully with null when unavailable. */
async function resolveOrgId(req: import("express").Request): Promise<string | null> {
  return resolveOrganizationId({ req });
}

/** Loads persisted Steward AI plugin settings for one organization. */
async function getStewardAiSetting(organizationId: string) {
  return prisma.pluginSetting.findUnique({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_AI_PLUGIN_KEY,
      },
    },
  });
}

/** Builds frontend-safe config payload without exposing secret fields. */
function toPublicConfig(enabled: boolean, config: ReturnType<typeof parseStewardAiConfig>): StewardAiConfigResponse {
  return {
    enabled,
    mode: config.mode,
    endpointUrl: config.endpointUrl,
    model: config.model,
    thinkingModel: config.thinkingModel,
    reasoningMode: config.reasoningMode,
    agenticMultiStage: config.agenticMultiStage,
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    systemPrompt: config.systemPrompt,
    hasApiKey: Boolean(config.apiKey),
  };
}

function statusWeight(status: ReadinessStatus): number {
  if (status === "Broken") return 2;
  if (status === "Partially Working") return 1;
  return 0;
}

function pickOverallStatus(checks: BridgeReadinessCheck[]): ReadinessStatus {
  if (checks.some((check) => check.status === "Broken")) return "Broken";
  if (checks.some((check) => check.status === "Partially Working")) return "Partially Working";
  return "Working";
}

function createReadinessSummary(status: ReadinessStatus, checks: BridgeReadinessCheck[]): string {
  const blocked = checks.filter((check) => check.status === "Broken").length;
  const partial = checks.filter((check) => check.status === "Partially Working").length;

  if (status === "Working") {
    return "CRM online is ready for Oyama Bridge pairing.";
  }

  if (status === "Partially Working") {
    return `Bridge setup is partially ready. ${partial} check(s) need attention before full pairing.`;
  }

  return `Bridge setup is blocked. ${blocked} critical check(s) must be fixed before pairing.`;
}

function normalizeSiteUrl(rawSiteUrl: unknown, req: import("express").Request): string {
  const text = String(rawSiteUrl ?? "").trim();

  if (text.length > 0) {
    const parsed = new URL(text);
    if (!parsed.protocol.startsWith("http")) {
      throw new Error("Site URL must use http or https.");
    }
    return parsed.toString().replace(/\/+$/, "");
  }

  const originHeader = String(req.headers.origin || "").trim();
  if (originHeader) {
    const parsed = new URL(originHeader);
    return parsed.toString().replace(/\/+$/, "");
  }

  const host = String(req.headers.host || "").trim();
  if (!host) {
    return "http://localhost:3000";
  }
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").trim();
  const proto = forwardedProto === "https" ? "https" : "http";
  return `${proto}://${host}`;
}

async function buildBridgeReadinessPayload(options: {
  enabled: boolean;
  config: ReturnType<typeof parseStewardAiConfig>;
  includeLiveTest: boolean;
}): Promise<BridgeReadinessPayload> {
  const checks: BridgeReadinessCheck[] = [];

  checks.push({
    id: "ai-enabled",
    label: "Steward AI enabled",
    status: options.enabled ? "Working" : "Broken",
    detail: options.enabled
      ? "AI runtime is enabled for chat and bridge calls."
      : "Enable Steward AI before pairing with desktop bridge.",
  });

  checks.push({
    id: "mode-remote",
    label: "Remote mode selected",
    status: options.config.mode === "remote" ? "Working" : "Partially Working",
    detail: options.config.mode === "remote"
      ? "Remote mode is active and compatible with desktop bridge relay."
      : "Switch to Remote mode so CRM online uses the bridge endpoint.",
  });

  checks.push({
    id: "endpoint-url",
    label: "Endpoint URL configured",
    status: options.config.endpointUrl.trim().length > 0 ? "Working" : "Broken",
    detail: options.config.endpointUrl.trim().length > 0
      ? `Current endpoint: ${options.config.endpointUrl}`
      : "Set an endpoint URL before bridge pairing.",
  });

  checks.push({
    id: "api-key",
    label: "API key present",
    status: options.config.apiKey ? "Working" : "Partially Working",
    detail: options.config.apiKey
      ? "API key is configured for secure bridge calls."
      : "Add an API key for bridge authentication hardening.",
  });

  checks.push({
    id: "model-configured",
    label: "Model configured",
    status: options.config.model.trim().length > 0 ? "Working" : "Broken",
    detail: options.config.model.trim().length > 0
      ? `Primary model: ${options.config.model}`
      : "Select a model for chat responses.",
  });

  checks.push({
    id: "thinking-model-configured",
    label: "Thinking model configured",
    status: options.config.thinkingModel.trim().length > 0 ? "Working" : "Partially Working",
    detail: options.config.thinkingModel.trim().length > 0
      ? `Thinking model: ${options.config.thinkingModel}`
      : "Set a thinking model for multi-stage reasoning mode.",
  });

  if (options.includeLiveTest) {
    const testStartedAt = Date.now();
    try {
      const result = await testStewardAiConnection(options.config);
      checks.push({
        id: "live-endpoint-test",
        label: "Live endpoint reachability",
        status: "Working",
        detail: `Connected in ${Date.now() - testStartedAt}ms. Models detected: ${result.modelCount}.`,
      });
    } catch (error) {
      checks.push({
        id: "live-endpoint-test",
        label: "Live endpoint reachability",
        status: "Broken",
        detail: error instanceof Error ? error.message : "Bridge endpoint health test failed.",
      });
    }
  }

  checks.sort((a, b) => statusWeight(b.status) - statusWeight(a.status));
  const status = pickOverallStatus(checks);

  return {
    status,
    summary: createReadinessSummary(status, checks),
    checks,
    testedAt: new Date().toISOString(),
  };
}

/** GET /api/steward-ai/config — Returns saved AI provider config for the active organization. */
router.get("/config", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  const config = parseStewardAiConfig(setting?.config);

  res.json({
    data: toPublicConfig(setting?.enabled ?? false, config),
  });
});

/** PUT /api/steward-ai/config — Updates AI provider mode + endpoint settings. Admin-only. */
router.put("/config", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = req.body as StewardAiUpdatePayload;
  const existing = await getStewardAiSetting(organizationId);
  const existingConfig = parseStewardAiConfig(existing?.config);

  const nextConfig = parseStewardAiConfig({
    ...existingConfig,
    mode: payload.mode ?? existingConfig.mode,
    endpointUrl: payload.endpointUrl ?? existingConfig.endpointUrl,
    model: payload.model ?? existingConfig.model,
    thinkingModel: payload.thinkingModel ?? existingConfig.thinkingModel,
    reasoningMode: payload.reasoningMode ?? existingConfig.reasoningMode,
    agenticMultiStage: payload.agenticMultiStage ?? existingConfig.agenticMultiStage,
    temperature: payload.temperature ?? existingConfig.temperature,
    maxTokens: payload.maxTokens ?? existingConfig.maxTokens,
    timeoutMs: payload.timeoutMs ?? existingConfig.timeoutMs,
    systemPrompt: payload.systemPrompt ?? existingConfig.systemPrompt,
    apiKey: payload.apiKey !== undefined
      ? String(payload.apiKey ?? "").trim()
      : (existingConfig.apiKey ?? ""),
  });

  const enabled = typeof payload.enabled === "boolean" ? payload.enabled : (existing?.enabled ?? false);

  const upserted = await prisma.pluginSetting.upsert({
    where: {
      organizationId_pluginKey: {
        organizationId,
        pluginKey: STEWARD_AI_PLUGIN_KEY,
      },
    },
    create: {
      organizationId,
      pluginKey: STEWARD_AI_PLUGIN_KEY,
      enabled,
      config: nextConfig as unknown as Prisma.InputJsonValue,
    },
    update: {
      enabled,
      config: nextConfig as unknown as Prisma.InputJsonValue,
    },
  });

  await logAudit({
    action: "STEWARD_AI_CONFIG_UPDATED",
    entity: "PluginSetting",
    entityId: upserted.id,
    userId: req.user?.sub,
    organizationId,
    metadata: {
      enabled,
      mode: nextConfig.mode,
      endpointUrl: nextConfig.endpointUrl,
      model: nextConfig.model,
      thinkingModel: nextConfig.thinkingModel,
      reasoningMode: nextConfig.reasoningMode,
      agenticMultiStage: nextConfig.agenticMultiStage,
      hasApiKey: Boolean(nextConfig.apiKey),
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    data: toPublicConfig(enabled, nextConfig),
  });
});

/** POST /api/steward-ai/test — Verifies Ollama reachability for current config. Admin-only. */
router.post("/test", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  const config = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());

  const startedAt = Date.now();
  try {
    const result = await testStewardAiConnection(config);
    res.json({
      data: {
        ok: true,
        latencyMs: Date.now() - startedAt,
        modelCount: result.modelCount,
        firstModel: result.firstModel,
      },
    });
  } catch (error) {
    res.status(502).json({
      error: {
        code: "AI_CONNECTION_FAILED",
        message: error instanceof Error ? error.message : "Steward AI connection failed.",
      },
    });
  }
});

/** GET /api/steward-ai/bridge/readiness — Reports if CRM online is ready for bridge runtime usage. */
router.get("/bridge/readiness", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const includeLiveTest = String(req.query.live || "").toLowerCase() === "1" || String(req.query.live || "").toLowerCase() === "true";
  const setting = await getStewardAiSetting(organizationId);
  const config = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());
  const readiness = await buildBridgeReadinessPayload({
    enabled: setting?.enabled ?? false,
    config,
    includeLiveTest,
  });

  res.json({
    data: readiness,
  });
});

/** POST /api/steward-ai/bridge/pairing-key — Generates one-step desktop pairing URL and downloadable key payload. */
router.post("/bridge/pairing-key", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const payload = (req.body ?? {}) as BridgePairingRequestPayload;
  let siteUrl: string;
  try {
    siteUrl = normalizeSiteUrl(payload.siteUrl, req);
  } catch (error) {
    res.status(400).json({
      error: {
        code: "INVALID_SITE_URL",
        message: error instanceof Error ? error.message : "Site URL is invalid.",
      },
    });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  const config = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { name: true },
  });

  const siteOrigin = new URL(siteUrl).origin;
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + 7 * 24 * 60 * 60 * 1000);
  const bridgeApiKey = `oyama-${crypto.randomBytes(18).toString("hex")}`;

  const pairingPayload: BridgePairingKeyPayload = {
    version: 1,
    kind: "oyama.bridge.pairing",
    generatedAt: generatedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    organizationId,
    organizationName: organization?.name ?? "Organization",
    bridgeConfig: {
      bridgeAutostart: true,
      bridgeUpstreamUrl: "http://127.0.0.1:11434",
      bridgePort: 43110,
      bridgeApiKey,
      bridgeAllowedOrigins: siteOrigin,
      bridgePublicBaseUrl: "",
      bridgeDomainUrl: `${siteOrigin}/settings/ai`,
      bridgeModel: config.model,
      bridgeThinkingModel: config.thinkingModel,
      bridgeCudaDevice: "auto",
      bridgeTemperature: config.temperature,
      bridgeTimeoutMs: config.timeoutMs,
    },
    aiHints: {
      mode: "remote",
      endpointUrl: "Set to your desktop bridge endpoint after pairing",
      model: config.model,
      thinkingModel: config.thinkingModel,
    },
  };

  const pairingToken = Buffer.from(JSON.stringify(pairingPayload), "utf8").toString("base64url");
  const pairingUrl = `${siteOrigin}/settings/ai?bridgePair=${encodeURIComponent(pairingToken)}`;
  const readiness = await buildBridgeReadinessPayload({
    enabled: setting?.enabled ?? false,
    config,
    includeLiveTest: false,
  });

  await logAudit({
    action: "STEWARD_AI_BRIDGE_PAIRING_KEY_CREATED",
    entity: "PluginSetting",
    entityId: setting?.id ?? "steward_ai",
    userId: req.user?.sub,
    organizationId,
    metadata: {
      siteOrigin,
      readinessStatus: readiness.status,
      model: config.model,
      thinkingModel: config.thinkingModel,
    },
    ipAddress: req.ip,
    userAgent: req.headers["user-agent"],
  });

  res.json({
    data: {
      pairingUrl,
      pairingToken,
      expiresAt: expiresAt.toISOString(),
      connectionKey: pairingPayload,
      readiness,
    },
  });
});

/** GET /api/steward-ai/models — Lists models from the configured local Ollama endpoint. Admin-only. */
router.get("/models", requireRole("admin"), async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const query = req.query as StewardAiModelsQuery;
  const endpointOverride = typeof query.endpointUrl === "string" ? query.endpointUrl : "";

  const setting = await getStewardAiSetting(organizationId);
  const savedConfig = parseStewardAiConfig(setting?.config ?? defaultStewardAiConfig());
  const localConfig = parseStewardAiConfig({
    ...savedConfig,
    mode: "local",
    endpointUrl: endpointOverride || savedConfig.endpointUrl,
  });

  try {
    const models = await listStewardAiModels(localConfig);
    res.json({
      data: {
        models,
      },
    });
  } catch (error) {
    res.status(502).json({
      error: {
        code: "AI_MODELS_FETCH_FAILED",
        message: error instanceof Error ? error.message : "Failed to load local Ollama models.",
      },
    });
  }
});

/** POST /api/steward-ai/chat — Produces a chat response using configured local/remote Ollama. */
router.post("/chat/stream", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  if (!setting?.enabled) {
    res.status(412).json({
      error: {
        code: "AI_NOT_ENABLED",
        message: "Steward AI is not enabled. Configure it in Settings > AI Assistant.",
      },
    });
    return;
  }

  const payload = req.body as StewardAiChatPayload;
  const normalizedMessages = (payload.messages ?? [])
    .filter((message) => message && typeof message.content === "string")
    .map((message): StewardAiChatMessage => ({
      role: message.role === "assistant" || message.role === "system" ? message.role : "user",
      content: message.content.slice(0, 3500),
    }))
    .slice(-20);

  if (normalizedMessages.length === 0) {
    res.status(400).json({
      error: {
        code: "EMPTY_MESSAGES",
        message: "At least one chat message is required.",
      },
    });
    return;
  }

  const config = parseStewardAiConfig(setting.config);
  const mode = payload.mode ?? "ask";
  const moduleKey = payload.moduleKey ?? "donor";
  const scopePath = payload.scopePath ?? "/";
  const latestUserMessage = [...normalizedMessages].reverse().find((message) => message.role === "user")?.content ?? "";

  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    if (moduleKey === "donor" && isTopDonorQuestion(latestUserMessage)) {
      const topDonorResult = await buildTopDonorResult(organizationId);
      const templatedReply = formatReplyByMode({
        mode,
        reply: topDonorResult.reply,
        toolsUsed: topDonorResult.toolsUsed,
        recordsUsed: topDonorResult.recordsUsed,
      });
      res.write(`${JSON.stringify({ type: "chunk", delta: templatedReply })}\n`);
      res.write(`${JSON.stringify({
        type: "done",
        reply: templatedReply,
        model: config.model,
        mode,
        runtimeMode: config.mode,
        provider: "crm-data",
        toolsUsed: topDonorResult.toolsUsed,
        recordsUsed: topDonorResult.recordsUsed,
        moduleKey,
        scopePath,
      })}\n`);
      res.end();
      return;
    }

    const retrieval = await buildRetrievalContext({
      organizationId,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
    });

    const agenticPreparation = await buildAgenticPreparation({
      config,
      mode,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
      contextText: retrieval.contextText,
    });

    const runtimeSystemPrompt = buildRuntimeSystemPrompt({
      mode,
      moduleKey,
      scopePath,
      contextText: retrieval.contextText,
      agenticNotes: agenticPreparation.stageSummaries,
    });

    const toolsUsed = [...retrieval.toolsUsed, ...agenticPreparation.toolsUsed];
    const provider = agenticPreparation.stageSummaries.length > 0 ? "ollama-agentic" : "ollama";

    const completion = await runStewardAiChatStream(
      config,
      [
        { role: "system", content: runtimeSystemPrompt },
        ...normalizedMessages,
      ],
      {
        onDelta: (delta) => {
          res.write(`${JSON.stringify({ type: "chunk", delta })}\n`);
        },
      }
    );

    const templatedReply = formatReplyByMode({
      mode,
      reply: completion.content,
      toolsUsed: retrieval.toolsUsed,
      recordsUsed: retrieval.recordsUsed,
    });

    await logAudit({
      action: "STEWARD_AI_CHAT",
      entity: "PluginSetting",
      entityId: setting.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        provider: "ollama",
        aiMode: config.mode,
        model: completion.model,
        thinkingModel: config.thinkingModel,
        reasoningMode: config.reasoningMode,
        reasoningModelUsed: agenticPreparation.reasoningModel,
        agenticMultiStage: config.agenticMultiStage,
        agenticStageCount: agenticPreparation.stageSummaries.length,
        chatMode: mode,
        moduleKey,
        scopePath,
        messageCount: normalizedMessages.length,
        toolsUsed,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.write(`${JSON.stringify({
      type: "done",
      reply: templatedReply,
      model: completion.model,
      mode,
      runtimeMode: config.mode,
      provider,
      toolsUsed,
      recordsUsed: retrieval.recordsUsed,
      moduleKey,
      scopePath,
    })}\n`);
    res.end();
  } catch (error) {
    res.write(`${JSON.stringify({
      type: "error",
      message: error instanceof Error ? error.message : "Steward AI request failed.",
    })}\n`);
    res.end();
  }
});

/** POST /api/steward-ai/chat — Produces a chat response using configured local/remote Ollama. */
router.post("/chat", async (req, res) => {
  const organizationId = await resolveOrgId(req);
  if (!organizationId) {
    res.status(400).json({ error: { code: "ORG_REQUIRED", message: "No organization is configured." } });
    return;
  }

  const setting = await getStewardAiSetting(organizationId);
  if (!setting?.enabled) {
    res.status(412).json({
      error: {
        code: "AI_NOT_ENABLED",
        message: "Steward AI is not enabled. Configure it in Settings > AI Assistant.",
      },
    });
    return;
  }

  const payload = req.body as StewardAiChatPayload;
  const normalizedMessages = (payload.messages ?? [])
    .filter((message) => message && typeof message.content === "string")
    .map((message): StewardAiChatMessage => ({
      role: message.role === "assistant" || message.role === "system" ? message.role : "user",
      content: message.content.slice(0, 3500),
    }))
    .slice(-20);

  if (normalizedMessages.length === 0) {
    res.status(400).json({
      error: {
        code: "EMPTY_MESSAGES",
        message: "At least one chat message is required.",
      },
    });
    return;
  }

  const config = parseStewardAiConfig(setting.config);
  const mode = payload.mode ?? "ask";
  const moduleKey = payload.moduleKey ?? "donor";
  const scopePath = payload.scopePath ?? "/";
  const latestUserMessage = [...normalizedMessages].reverse().find((message) => message.role === "user")?.content ?? "";

  try {
    if (moduleKey === "donor" && isTopDonorQuestion(latestUserMessage)) {
      const topDonorResult = await buildTopDonorResult(organizationId);
      const templatedReply = formatReplyByMode({
        mode,
        reply: topDonorResult.reply,
        toolsUsed: topDonorResult.toolsUsed,
        recordsUsed: topDonorResult.recordsUsed,
      });
      res.json({
        data: {
          reply: templatedReply,
          model: config.model,
          mode,
          runtimeMode: config.mode,
          provider: "crm-data",
          toolsUsed: topDonorResult.toolsUsed,
          recordsUsed: topDonorResult.recordsUsed,
          moduleKey,
          scopePath,
        },
      });
      return;
    }

    const retrieval = await buildRetrievalContext({
      organizationId,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
    });

    const agenticPreparation = await buildAgenticPreparation({
      config,
      mode,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
      contextText: retrieval.contextText,
    });

    const runtimeSystemPrompt = buildRuntimeSystemPrompt({
      mode,
      moduleKey,
      scopePath,
      contextText: retrieval.contextText,
      agenticNotes: agenticPreparation.stageSummaries,
    });

    const toolsUsed = [...retrieval.toolsUsed, ...agenticPreparation.toolsUsed];
    const provider = agenticPreparation.stageSummaries.length > 0 ? "ollama-agentic" : "ollama";

    const completion = await runStewardAiChat(config, [
      { role: "system", content: runtimeSystemPrompt },
      ...normalizedMessages,
    ]);

    const templatedReply = formatReplyByMode({
      mode,
      reply: completion.content,
      toolsUsed: retrieval.toolsUsed,
      recordsUsed: retrieval.recordsUsed,
    });

    await logAudit({
      action: "STEWARD_AI_CHAT",
      entity: "PluginSetting",
      entityId: setting.id,
      userId: req.user?.sub,
      organizationId,
      metadata: {
        provider: "ollama",
        aiMode: config.mode,
        model: completion.model,
        thinkingModel: config.thinkingModel,
        reasoningMode: config.reasoningMode,
        reasoningModelUsed: agenticPreparation.reasoningModel,
        agenticMultiStage: config.agenticMultiStage,
        agenticStageCount: agenticPreparation.stageSummaries.length,
        chatMode: mode,
        moduleKey,
        scopePath,
        messageCount: normalizedMessages.length,
        toolsUsed,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      data: {
        reply: templatedReply,
        model: completion.model,
        mode,
        runtimeMode: config.mode,
        provider,
        toolsUsed,
        recordsUsed: retrieval.recordsUsed,
        moduleKey,
        scopePath,
      },
    });
  } catch (error) {
    res.status(502).json({
      error: {
        code: "AI_CHAT_FAILED",
        message: error instanceof Error ? error.message : "Steward AI request failed.",
      },
    });
  }
});

export default router;
