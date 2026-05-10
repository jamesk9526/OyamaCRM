/** Steward AI API routes for config, health test, and chat completion. */
import { Router } from "express";
import { requireAuth } from "../middleware/requireAuth.js";
import { requireRole } from "../middleware/requireRole.js";
import { resolveOrganizationId } from "../lib/organization.js";
import { prisma } from "../lib/prisma.js";
import { logAudit } from "../lib/audit.js";
import {
  defaultStewardAiConfig,
  parseStewardAiConfig,
  runStewardAiChat,
  testStewardAiConnection,
  type StewardAiChatMessage,
  type StewardAiMode,
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
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
  apiKey?: string;
}

interface StewardAiChatPayload {
  messages?: StewardAiChatMessage[];
  mode?: "ask" | "analyze" | "draft" | "action" | "help";
  moduleKey?: "donor" | "compassion" | "events" | "watchdog" | "webmaster";
  scopePath?: string;
}

interface StewardContextResult {
  contextText: string;
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

/** Creates a runtime instruction block tailored to mode/module/context. */
function buildRuntimeSystemPrompt(options: {
  mode: NonNullable<StewardAiChatPayload["mode"]>;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  contextText: string;
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
      : "Use donor stewardship terminology (constituent, donation, campaign, stewardship, retention).";

  return [
    "Runtime instruction: answer using the provided CRM context first.",
    `Current module: ${options.moduleKey}.`,
    `Current scope path: ${options.scopePath}.`,
    actionPolicy,
    moduleLexicon,
    "If context does not support a claim, clearly label it as unknown.",
    "Cite concrete records, counts, and names from context when possible.",
    "Finish with a short numbered next-step list when the user asks for guidance.",
    "Retrieved context follows:",
    options.contextText || "No retrieval context available.",
  ].join("\n\n");
}

/** Builds donor module retrieval context from constituents, tasks, and meetings. */
async function buildDonorContext(params: {
  organizationId: string;
  tokens: string[];
  scopePath: string;
}): Promise<StewardContextResult> {
  const toolsUsed: string[] = ["donor.constituentLookup", "donor.workQueueSnapshot"];

  const donorMatches = params.tokens.length > 0
    ? await prisma.constituent.findMany({
        where: {
          organizationId: params.organizationId,
          OR: params.tokens.flatMap((token) => ([
            { firstName: { contains: token, mode: "insensitive" as const } },
            { lastName: { contains: token, mode: "insensitive" as const } },
            { email: { contains: token, mode: "insensitive" as const } },
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

  const lines = [
    `Donor scope path: ${params.scopePath}`,
    `Pending tasks in queue: ${pendingTaskCount}`,
    `Upcoming meetings: ${upcomingMeetings.length}`,
    ...upcomingMeetings.map((meeting) => `- Meeting: ${meeting.title} at ${meeting.startTime.toISOString()}`),
    `Matched constituents: ${donorMatches.length}`,
    ...donorMatches.map((constituent) =>
      `- ${constituent.firstName} ${constituent.lastName} [${constituent.donorStatus}] lastGift=${constituent.lastGiftDate?.toISOString() ?? "none"} lifetime=${String(constituent.totalLifetimeGiving)}`
    ),
  ];

  return {
    contextText: lines.join("\n"),
    toolsUsed,
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
            { firstName: { contains: token, mode: "insensitive" as const } },
            { lastName: { contains: token, mode: "insensitive" as const } },
            { email: { contains: token, mode: "insensitive" as const } },
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
          OR: params.tokens.map((token) => ({ name: { contains: token, mode: "insensitive" as const } })),
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
          { action: { contains: "UNAUTHORIZED", mode: "insensitive" } },
          { action: { contains: "FORBIDDEN", mode: "insensitive" } },
          { action: { contains: "LOGIN", mode: "insensitive" } },
          { action: { contains: "DELETE", mode: "insensitive" } },
          { action: { contains: "RESET", mode: "insensitive" } },
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
    temperature: config.temperature,
    maxTokens: config.maxTokens,
    timeoutMs: config.timeoutMs,
    systemPrompt: config.systemPrompt,
    hasApiKey: Boolean(config.apiKey),
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
    const retrieval = await buildRetrievalContext({
      organizationId,
      moduleKey,
      scopePath,
      userQuery: latestUserMessage,
    });

    const runtimeSystemPrompt = buildRuntimeSystemPrompt({
      mode,
      moduleKey,
      scopePath,
      contextText: retrieval.contextText,
    });

    const completion = await runStewardAiChat(config, [
      { role: "system", content: runtimeSystemPrompt },
      ...normalizedMessages,
    ]);

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
        chatMode: mode,
        moduleKey,
        scopePath,
        messageCount: normalizedMessages.length,
        toolsUsed: retrieval.toolsUsed,
      },
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });

    res.json({
      data: {
        reply: completion.content,
        model: completion.model,
        mode: config.mode,
        provider: "ollama",
        toolsUsed: retrieval.toolsUsed,
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
