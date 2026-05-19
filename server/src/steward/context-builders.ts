/**
 * Steward AI runtime system prompt and per-module retrieval context builders.
 * Performs live Prisma queries to assemble contextText for each CRM module.
 */

import type {
  StewardAiChatPayload,
  StewardChatMode,
  StewardContextResult,
  StewardResponseIntent,
} from "./types.js";
import { tokenizeQuery, parseScopeIdentifiers, scopeFromModuleKey } from "./query-utils.js";
import { prisma } from "../lib/prisma.js";
import { buildDonorToolContextForChat } from "../services/steward-tool-registry.js";
import { buildUserMemoryContext, buildFileContext } from "../services/steward-memory-context.js";
import { searchStewardHelpGuides } from "../services/steward-help-knowledge.js";

// ─── Runtime system prompt ─────────────────────────────────────────────────────

/** Creates a runtime instruction block tailored to mode/module/context. */
export function buildRuntimeSystemPrompt(options: {
  mode: NonNullable<StewardAiChatPayload["mode"]>;
  userIntent: StewardResponseIntent;
  responseContract: string;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  scopePath: string;
  contextText: string;
  agenticNotes?: string[];
  fiscalYearLabel?: string;
  calendarYear?: number;
}): string {
  const actionPolicy =
    options.mode === "action"
      ? "Action mode policy: do not claim an action is executed. Propose explicit steps, required confirmations, and rollback considerations."
      : "Non-action policy: provide read-first analysis and practical next steps.";

  const modeSpecificPolicy =
    options.mode === "free"
      ? "Pure mode policy: do not use CRM tools, retrieval context, or structured artifacts. Answer directly from the user's prompt and general knowledge only."
      : options.mode === "agentic"
        ? "Agentic mode policy: if CRM evidence would improve the answer, expect tool-backed reasoning first and adapt the final answer after tool results arrive. Prefer the minimum number of read tools needed, and never auto-execute write tools without confirmation."
        : options.mode === "writing"
          ? "Legacy writing-mode alias: behave like Pure mode with a stronger emphasis on polished prose and draft quality. Do not use tools."
          : options.mode === "llm"
            ? "LLM mode policy: allow broader brainstorming and synthesis while staying grounded in retrieved CRM context; when context is missing, explicitly label uncertainty."
            : "";

  const moduleLexicon =
    options.moduleKey === "compassion"
      ? "Use client-care terminology (client, case, appointment, follow-up). Avoid donor fundraising terms unless explicitly requested."
      : options.moduleKey === "events"
        ? "Use event-operations terminology (event, guest, check-in, sponsor, seating, registration)."
        : options.moduleKey === "watchdog"
          ? "Use security operations terminology (incident, severity, alert, audit, access control, encrypted vault)."
          : options.moduleKey === "webmaster"
            ? "Use website operations terminology (templates, pages, publishing, domain, SEO, approvals)."
            : options.moduleKey === "oshareview"
              ? "Use donor report and board-summary terminology. Focus on practical donor analysis artifacts and evidence-backed recommendations."
              : "Use donor stewardship terminology (constituent, donation, campaign, stewardship, retention). If the user asks for top donors and ranked donor context exists, answer directly from that ranked data with names plus lifetime values. Do not claim missing data for that question unless no ranked donor data exists.";

  const structuredProtocol =
    options.moduleKey === "donor" || options.moduleKey === "oshareview"
      ? [
          "For donor/report questions, optionally append a structured block after your markdown answer using this exact fence label:",
          "```steward-artifacts",
          '{"version":1,"replyMarkdown":"...","artifacts":[...],"suggestedActions":[...],"evidence":[...]}',
          "```",
          "Allowed artifact types: email_draft, donor_list, report_summary, task_list, call_script, csv_rows, report_card, chart.",
          'Use report_card when sharing KPI metrics (ytdRevenue, retentionRate, giftCounts, etc.). Set deepLink to the CRM report route (e.g. "/reports/giving-summary").',
          'Use chart with chartType=bar and monthly data from reports.runGivingByMonth results. Set yAxisPrefix="$" for dollar values. Limit to 12-24 labels.',
        ].join("\n")
      : "Do not emit steward-artifacts JSON for this module.";

  return [
    "You are Steward, a CRM analyst assistant for a nonprofit organization. Answer as a helpful, calm, and knowledgeable analyst — not as a debug console or system trace.",
    `Current module: ${options.moduleKey}.`,
    `Detected user intent: ${options.userIntent}.`,
    `Current scope path: ${options.scopePath}.`,
    options.fiscalYearLabel
      ? `Current fiscal year: ${options.fiscalYearLabel}. Calendar year: ${options.calendarYear ?? new Date().getFullYear()}.`
      : `Calendar year: ${options.calendarYear ?? new Date().getFullYear()}.`,
    actionPolicy,
    modeSpecificPolicy,
    moduleLexicon,
    "CRITICAL OUTPUT RULES — follow these exactly:",
    "1. Write your answer in natural, flowing prose. Do not create sections labeled 'Evidence:', 'Tool:', 'Record:', or 'Sources:'.",
    "2. Do not mention tool names like donor.getDailyBrief, agentic.plan, or knowledge.searchCrmRecords in your answer. The UI shows those separately.",
    "3. Do not repeat the same donor or record multiple times. Consolidate duplicates into one clear statement.",
    "4. If data is available, state it clearly. If data is limited or missing, say specifically what is missing and why.",
    "5. Give specific, actionable next steps that are directly relevant to the question — not generic placeholders.",
    "6. Use markdown formatting: bold labels, bullet lists, numbered steps, and tables where they add clarity.",
    "7. Do not expose internal planning notes, reasoning traces, or retrieval metadata. Those stay hidden.",
    "8. End with 2-3 concrete next steps the user can take inside the CRM right now.",
    "9. Follow the user request format first. If they asked for a draft email, output the draft email itself, not an analysis of donor records.",
    "10. Never dump raw CRM record lines into the final answer unless the user explicitly asked for a record list.",
    "11. For numeric questions, do not estimate. Use deterministic values from context and show exact formulas when relevant.",
    "12. When a full email or letter build is requested, include one suggested action using actionType 'communications.build_full_email_workspace' or 'letters.build_full_letter_draft' with payload fields (goal/audience/tone/campaignName or name/subject/category).",
    "13. Treat context as four layers: current session messages, saved user memories, uploaded file context, and live CRM tool data.",
    "14. Do not guess from memory when the user asks about a donor, event, client, report, or uploaded document; use retrieved CRM/file context as the source of truth and name missing context clearly.",
    "15. Only durable facts should become saved memories: stable preferences, organization facts, writing style, recurring workflows, project names, CRM settings, and long-term event details. Never save every chat message or short-term tasks.",
    "16. Sensitive personal data should not be saved as memory unless the user explicitly asks and it clearly improves future work.",
    "Required response contract:",
    options.responseContract,
    structuredProtocol,
    options.agenticNotes && options.agenticNotes.length > 0
      ? [
          "Background preparation notes (do not quote these directly; use them to inform your answer):",
          ...options.agenticNotes,
        ].join("\n\n")
      : "",
    "CRM data context follows. Use this as your primary source of truth:",
    options.contextText || "No retrieval context available. Acknowledge this and ask the user to check AI settings.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

// ─── Per-module context builders ───────────────────────────────────────────────

/** Builds donor module retrieval context from constituents, tasks, and meetings. */
export async function buildDonorContext(params: {
  organizationId: string;
  scopePath: string;
  userId: string;
  role: string;
  moduleKey?: "donor" | "oshareview";
  userQuery: string;
  mentionedConstituentIds?: string[];
}): Promise<StewardContextResult> {
  return buildDonorToolContextForChat({
    organizationId: params.organizationId,
    userId: params.userId,
    role: params.role,
    scopePath: params.scopePath,
    moduleKey: params.moduleKey,
    query: params.userQuery,
    mentionedConstituentIds: params.mentionedConstituentIds,
  });
}

/** Builds Compassion module retrieval context from clients, cases, appointments, and follow-ups. */
export async function buildCompassionContext(params: {
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

  const matchedClients =
    params.tokens.length > 0
      ? await prisma.compassionClient.findMany({
          where: {
            organizationId: params.organizationId,
            OR: params.tokens.flatMap((token) => [
              { firstName: { contains: token } },
              { lastName: { contains: token } },
              { email: { contains: token } },
            ]),
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
    where: { organizationId: params.organizationId, caseStatus: "OPEN" },
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
    where: { organizationId: params.organizationId, status: "PENDING" },
  });

  const lines = [
    `Compassion scope path: ${params.scopePath}`,
    scopedClient
      ? `Scoped client: ${scopedClient.firstName} ${scopedClient.lastName} [${scopedClient.clientStatus}] intake=${scopedClient.intakeDate.toISOString()} cases=${scopedClient._count.cases} appointments=${scopedClient._count.appointments} followUps=${scopedClient._count.followUps}`
      : "Scoped client: none",
    `Pending follow-ups: ${pendingFollowUps}`,
    `Open cases sampled: ${openCases.length}`,
    ...openCases.map(
      (item) =>
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
export async function buildEventsContext(params: {
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

  const matchedEvents =
    params.tokens.length > 0
      ? await prisma.event.findMany({
          where: {
            organizationId: params.organizationId,
            OR: params.tokens.map((token) => ({ name: { contains: token } })),
          },
          select: { id: true, name: true, status: true, startDate: true },
          take: 6,
        })
      : [];

  const guestCount = await prisma.eventGuest.count({
    where: { event: { organizationId: params.organizationId } },
  });

  const checkInCount = await prisma.eventGuest.count({
    where: { event: { organizationId: params.organizationId }, checkedIn: true },
  });

  const lines = [
    `Events scope path: ${params.scopePath}`,
    scopedEvent
      ? `Scoped event: ${scopedEvent.name} [${scopedEvent.status}] start=${scopedEvent.startDate.toISOString()} guests=${scopedEvent._count.guests}`
      : "Scoped event: none",
    `Guests total: ${guestCount}`,
    `Guests checked in: ${checkInCount}`,
    `Matched events: ${matchedEvents.length}`,
    ...matchedEvents.map(
      (event) => `- ${event.name} [${event.status}] start=${event.startDate.toISOString()}`
    ),
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

// ─── Main retrieval coordinator ────────────────────────────────────────────────

/** Runs module-specific retrieval tools and returns aggregated context text. */
export async function buildRetrievalContext(params: {
  organizationId: string;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  mode: StewardChatMode;
  scopePath: string;
  userQuery: string;
  userId: string;
  role: string;
  mentionedConstituentIds?: string[];
}): Promise<StewardContextResult> {
  const tokens = tokenizeQuery(params.userQuery);
  const taggedDonorFocus =
    (params.moduleKey === "donor" || params.moduleKey === "oshareview") &&
    (params.mentionedConstituentIds?.length ?? 0) > 0;

  let base: StewardContextResult;

  if (params.moduleKey === "compassion") {
    base = await buildCompassionContext({
      organizationId: params.organizationId,
      tokens,
      scopePath: params.scopePath,
    });
  } else if (params.moduleKey === "events") {
    base = await buildEventsContext({
      organizationId: params.organizationId,
      tokens,
      scopePath: params.scopePath,
    });
  } else if (params.moduleKey === "watchdog") {
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
      select: { id: true, action: true, entity: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 8,
    });

    base = {
      toolsUsed: ["watchdog.auditSnapshot", "watchdog.accessRiskSummary"],
      contextText: [
        `Watchdog scope path: ${params.scopePath}`,
        `Recent critical/secure audit events: ${recentSecurityAudits.length}`,
        ...recentSecurityAudits.map(
          (entry) =>
            `- ${entry.action}${entry.entity ? ` on ${entry.entity}` : ""} at ${entry.createdAt.toISOString()}`
        ),
      ].join("\n"),
      recordsUsed: recentSecurityAudits
        .slice(0, 8)
        .map((entry) => `${entry.action}${entry.entity ? ` (${entry.entity})` : ""}`),
    };
  } else if (params.moduleKey === "webmaster") {
    base = {
      toolsUsed: ["webmaster.planningContext"],
      contextText: [
        `WebMaster scope path: ${params.scopePath}`,
        "Current module status: starter dashboard is active.",
        "No persisted website/page database records are available yet.",
        "Focus guidance on planning, IA, and staged implementation steps.",
      ].join("\n"),
      recordsUsed: [`Scope: ${params.scopePath}`, "WebMaster starter dashboard context"],
    };
  } else {
    base = await buildDonorContext({
      organizationId: params.organizationId,
      scopePath: params.scopePath,
      userId: params.userId,
      role: params.role,
      moduleKey: params.moduleKey === "oshareview" ? "oshareview" : "donor",
      userQuery: params.userQuery,
      mentionedConstituentIds: params.mentionedConstituentIds,
    });
  }

  if (!taggedDonorFocus) {
    const workspaceScope = scopeFromModuleKey(params.moduleKey);
    const [memoryContext, fileContext] = await Promise.all([
      buildUserMemoryContext({
        organizationId: params.organizationId,
        userId: params.userId,
        userQuery: params.userQuery,
        workspaceScope,
        limit: 8,
      }),
      buildFileContext({
        organizationId: params.organizationId,
        userId: params.userId,
        userQuery: params.userQuery,
        workspaceScope,
        limit: 6,
      }),
    ]);

    base = {
      contextText: [
        base.contextText,
        "Context layer policy: session context is temporary; saved memories are user-specific; uploaded file context is user-managed; CRM data remains live tool context.",
        memoryContext.contextText,
        fileContext.contextText,
      ].join("\n"),
      toolsUsed: [...base.toolsUsed, ...memoryContext.toolsUsed, ...fileContext.toolsUsed],
      recordsUsed: [...base.recordsUsed, ...memoryContext.recordsUsed, ...fileContext.recordsUsed],
    };
  } else {
    base = {
      ...base,
      contextText: [
        base.contextText,
        "Tagged donor focus policy: memory and file layers are skipped so answers stay grounded only in tagged donor profile data.",
      ].join("\n"),
      toolsUsed: [...base.toolsUsed, "context.taggedDonorFocus"],
    };
  }

  if (params.mode !== "help") {
    return base;
  }

  const helpScope =
    params.moduleKey === "compassion"
      ? "compassion"
      : params.moduleKey === "events"
        ? "events"
        : "donor";

  const guideMatches = searchStewardHelpGuides({
    scope: helpScope,
    query: params.userQuery,
    limit: 6,
  });

  if (guideMatches.length === 0) {
    return {
      ...base,
      toolsUsed: [...base.toolsUsed, "help.guides"],
      contextText: [
        base.contextText,
        `Help scope: ${helpScope}`,
        "No direct help guides matched this query. Use /help search with broader terms.",
      ].join("\n"),
      recordsUsed: [...base.recordsUsed, `Help scope: ${helpScope}`],
    };
  }

  const helpLines = [
    `Help scope: ${helpScope}`,
    `Matched help guides: ${guideMatches.length}`,
    ...guideMatches.map((guide) => `- ${guide.title} (/help/${guide.slug}?scope=${guide.scope})`),
  ];

  return {
    ...base,
    toolsUsed: [...base.toolsUsed, "help.guides"],
    contextText: [base.contextText, ...helpLines].join("\n"),
    recordsUsed: [
      ...base.recordsUsed,
      ...guideMatches.map((guide) => `${guide.title} (/help/${guide.slug})`),
    ],
  };
}
