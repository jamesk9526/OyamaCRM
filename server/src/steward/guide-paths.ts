/**
 * Steward AI GuidePath + ThoughtStack decision engine.
 * Produces interactive clarification / confirmation cards before running
 * high-risk actions, and guidance prompts when intent is under-specified.
 */

import type {
  StewardAiChatPayload,
  StewardChatMode,
  StewardResponseIntent,
  GuidePathState,
  StewardSuggestedActionPayload,
  StewardStructuredResponsePayload,
  ThoughtStackRiskLevel,
  ThoughtStackConfidence,
  ThoughtStackToolContract,
  ThoughtStackAssessment,
} from "./types.js";

// ─── Shared action builders ────────────────────────────────────────────────────

export function buildGuidePathChoice(label: string, prompt: string): StewardSuggestedActionPayload {
  return { label, actionType: "guidepath.choose", requiresConfirmation: false, payload: { prompt } };
}

export function buildGuidePathOpenReportChoice(label: string, path: string): StewardSuggestedActionPayload {
  return { label, actionType: "open_report", requiresConfirmation: false, payload: { path } };
}

export function buildThoughtStackChoice(
  actionType: "thoughtstack.continue" | "thoughtstack.review_first" | "thoughtstack.provide_details" | "thoughtstack.cancel",
  label: string,
  prompt: string
): StewardSuggestedActionPayload {
  return { label, actionType, requiresConfirmation: actionType === "thoughtstack.continue", payload: { prompt } };
}

// ─── GuidePath signals ─────────────────────────────────────────────────────────

interface GuidePathSignals {
  asksReport: boolean;
  hasTimeRange: boolean;
  hasReportFocus: boolean;
  asksCrossModule: boolean;
  hasAudience: boolean;
  hasTone: boolean;
  hasCrmContext: boolean;
}

function extractGuidePathSignals(text: string): GuidePathSignals {
  const n = text.toLowerCase();
  return {
    asksReport: /(report|dashboard|summary|kpi|metrics|board report|analysis)/.test(n),
    hasTimeRange: /(today|this\s+week|last\s+week|this\s+month|last\s+month|this\s+quarter|last\s+quarter|year(?:\s|-)?to(?:\s|-)?date|ytd|fiscal|fiscle|calendar|between|from\s+.+\s+to|q[1-4]|fy\s?\d{2,4}|custom\s+(date\s+)?range)/.test(n),
    hasReportFocus: /(financial|revenue|donor|engagement|campaign|attendance|clients?|events?|board)/.test(n),
    asksCrossModule: /(all\s+of\s+the\s+above|cross\s*-?\s*module|org(?:anization)?\s*-?\s*wide|across\s+all\s+modules)/.test(n),
    hasAudience: /(all active|monthly|lapsed|attendees?|guests?|segment|group|campaign|recipients?|these donors|this list)/.test(n),
    hasTone: /(warm|formal|direct|celebratory|board-ready|ministry|tone)/.test(n),
    hasCrmContext: /(donor|constituent|campaign|gift|donation|client|case|event|attendance|task|steward|segment)/.test(n),
  };
}

function inferModuleReportFocus(moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>): string {
  if (moduleKey === "events") return "attendance and operations";
  if (moduleKey === "compassion") return "client engagement and outcomes";
  if (moduleKey === "watchdog") return "security and operations";
  if (moduleKey === "webmaster") return "campaign and web performance";
  return "donor engagement and fundraising";
}

function reportWorkspacePathForModule(moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>): string {
  if (moduleKey === "events") return "/reports?tab=events&module=events";
  if (moduleKey === "compassion") return "/reports?tab=compassion&module=compassion";
  if (moduleKey === "watchdog") return "/reports?tab=operations&module=watchdog";
  if (moduleKey === "webmaster") return "/reports?tab=webmaster&module=webmaster";
  return "/reports?tab=donor-crm&module=donor";
}

// ─── GuidePath clarification engine ───────────────────────────────────────────

/**
 * Asks only the minimum follow-up when intent is risky or under-specified.
 * Returns null when Steward has enough context to proceed normally.
 */
export function buildGuidePathClarification(options: {
  mode: StewardChatMode;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  userQuery: string;
  recentUserQuery?: string;
}): { state: Exclude<GuidePathState, "Ready to Act">; structured: StewardStructuredResponsePayload } | null {
  const q = options.userQuery.trim();
  if (!q) return null;

  const normalized = q.toLowerCase();
  const recentUserQuery = options.recentUserQuery?.trim() || q;
  const latestSignals = extractGuidePathSignals(q);
  const recentSignals = extractGuidePathSignals(recentUserQuery);
  const isGuidedContinuation = /(continue|apply|selection|choose|use\s+.+\s+as\s+the\s+report\s+timeframe|focus\s+this\s+report)/.test(normalized);
  const moduleFocusHint = inferModuleReportFocus(options.moduleKey);
  const implicitModuleFocus = options.moduleKey !== "oshareview" && !recentSignals.asksCrossModule;
  const quickReportPath = reportWorkspacePathForModule(options.moduleKey);

  const asksReport = latestSignals.asksReport || (isGuidedContinuation && recentSignals.asksReport);
  const hasTimeRange = latestSignals.hasTimeRange || recentSignals.hasTimeRange;
  const hasReportFocus = latestSignals.hasReportFocus || recentSignals.hasReportFocus || implicitModuleFocus;

  // Default report timeframe to current fiscal/calendar context; only clarify missing focus.
  if (asksReport && !hasReportFocus) {
    const missing = !hasTimeRange ? "time period" : "report focus";
    const question = !hasTimeRange
      ? "What time period should this report cover?"
      : "What should this report focus on?";
    const choices = !hasTimeRange
      ? [
          buildGuidePathChoice("This month", "Use this month as the report timeframe and continue."),
          buildGuidePathChoice("Last month", "Use last month as the report timeframe and continue."),
          buildGuidePathChoice("This quarter", "Use this quarter as the report timeframe and continue."),
          buildGuidePathChoice("Year to date", "Use year-to-date as the report timeframe and continue."),
          buildGuidePathChoice("Custom range", "I want a custom date range for this report."),
          buildGuidePathOpenReportChoice("Open report workspace", quickReportPath),
        ]
      : [
          buildGuidePathChoice("Financial totals", "Focus this report on financial totals and continue."),
          buildGuidePathChoice("Donor engagement", "Focus this report on donor engagement and continue."),
          buildGuidePathChoice("Campaign performance", "Focus this report on campaign performance and continue."),
          buildGuidePathChoice("Attendance/operations", "Focus this report on attendance and operations and continue."),
          buildGuidePathChoice("All of the above", "Include financial totals, engagement, and campaign performance in one board report."),
          buildGuidePathChoice("Use current CRM context", `Use the current ${moduleFocusHint} focus and continue.`),
          buildGuidePathOpenReportChoice("Open report workspace", quickReportPath),
        ];

    return {
      state: "Needs Guided Setup",
      structured: {
        version: 1,
        replyMarkdown: [
          "**GuidePath: Needs Guided Setup**",
          `I can build this report, but one detail is missing: **${missing}**.`,
          "",
          question,
          "Choose one option below to continue.",
        ].join("\n"),
        artifacts: [],
        suggestedActions: choices,
        evidence: [
          { label: "GuidePath classified request as Needs Guided Setup" },
          { label: `CRM context: ${options.moduleKey} workspace` },
        ],
      },
    };
  }

  const asksOutboundComms = /(send(\s+now)?|deliver|notify|blast|schedule|queue|email\s+all|message\s+all|text\s+all)/.test(normalized);
  const draftingComms = /(draft|write|compose|create)\s+.*\b(email|letter|message|thank.?you|note)\b/.test(normalized)
    || /thank.?you\s+note/.test(normalized);
  const hasAudience = latestSignals.hasAudience || recentSignals.hasAudience;

  // Drafting asks should flow like chat. Clarify only for true outbound execution requests.
  if (asksOutboundComms && !draftingComms && !hasAudience) {
    const question = "Which audience should this message apply to?";
    const choices = [
      buildGuidePathChoice("All active donors", "Use all active donors as the audience and continue."),
      buildGuidePathChoice("Monthly donors only", "Use monthly donors only as the audience and continue."),
      buildGuidePathChoice("Lapsed donors", "Use lapsed donors as the audience and continue."),
      buildGuidePathChoice("Event attendees", "Use event attendees as the audience and continue."),
      buildGuidePathChoice("Choose manually", "I want to choose the audience manually before continuing."),
    ];

    return {
      state: "Needs Clarification",
      structured: {
        version: 1,
        replyMarkdown: [
          "**GuidePath: Needs Clarification**",
          "I can continue with a default warm tone, but I need one audience detail first.",
          "",
          question,
          "Choose an option below to continue quickly.",
        ].join("\n"),
        artifacts: [],
        suggestedActions: choices,
        evidence: [{ label: "GuidePath classified request as Needs Clarification" }],
      },
    };
  }

  const riskyMutation = /(delete|remove|erase|bulk\s+update|merge\s+records|trigger\s+automation|send\s+now|enroll\s+all|auto-?send)/.test(normalized);
  if (riskyMutation) {
    return {
      state: "Needs Confirmation",
      structured: {
        version: 1,
        replyMarkdown: [
          "**GuidePath: Needs Confirmation**",
          "This action may affect real CRM data or outbound communication.",
          "I can proceed once you confirm the exact intent.",
          "",
          "Choose one option:",
        ].join("\n"),
        artifacts: [],
        suggestedActions: [
          buildGuidePathChoice("Continue", "Confirmed. Continue with this action exactly as requested."),
          buildGuidePathChoice("Save as Draft", "Do not execute live changes. Prepare this as a draft instead."),
          buildGuidePathChoice("Edit First", "I want to edit scope/recipients before continuing."),
          buildGuidePathChoice("Cancel", "Cancel this action."),
        ],
        evidence: [{ label: "GuidePath classified request as Needs Confirmation" }],
      },
    };
  }

  const tooVague =
    /(do it|run it|make it|fix this|send this|use that)/.test(normalized) &&
    normalized.length < 40 &&
    !recentSignals.hasCrmContext;
  if (tooVague) {
    return {
      state: "Cannot Safely Answer Yet",
      structured: {
        version: 1,
        replyMarkdown: [
          "**GuidePath: Cannot Safely Answer Yet**",
          "I may guess wrong because the request is too ambiguous.",
          "Tell me what this should apply to so I can proceed safely.",
        ].join("\n"),
        artifacts: [],
        suggestedActions: [
          buildGuidePathChoice("Donor CRM", "Apply this request to Donor CRM context."),
          buildGuidePathChoice("Events CRM", "Apply this request to Events CRM context."),
          buildGuidePathChoice("Compassion CRM", "Apply this request to Compassion CRM context."),
          buildGuidePathChoice("Describe manually", "I will describe exactly what this should apply to."),
        ],
        evidence: [{ label: "GuidePath classified request as Cannot Safely Answer Yet" }],
      },
    };
  }

  return null;
}

// ─── ThoughtStack engine ───────────────────────────────────────────────────────

export function hasExplicitConfirmation(userQuery: string): boolean {
  return /(\b(confirm|confirmed|approve|approved|continue|proceed|send now|run now|yes, continue)\b)/i.test(userQuery);
}

export function buildThoughtStackToolContract(userQuery: string): ThoughtStackToolContract | undefined {
  const n = userQuery.toLowerCase();

  if (/(draft|write|compose|create)\s+.*\b(email|letter|message|thank.?you|note)\b/.test(n) || /thank.?you\s+note/.test(n)) {
    return {
      toolName: "communications.draftOnly",
      riskLevel: "low",
      requiresConfirmation: false,
      supportsDryRun: false,
      requiredFields: [],
      verificationChecks: ["draftGenerated"],
    };
  }

  if (/(send(\s+now)?|deliver|schedule|blast|notify|text|sms|queue|launch|email\s+all|message\s+all)/.test(n)) {
    return {
      toolName: "communications.sendDonorEmail",
      riskLevel: "high",
      requiresConfirmation: true,
      supportsDryRun: true,
      requiredFields: ["recipientSegment", "templateOrMessage", "deliveryTiming", "channel"],
      verificationChecks: ["preparedCount", "sentCount", "failedCount", "skippedCount"],
    };
  }

  if (/(import|csv|upload|spreadsheet|batch\s+entry)/.test(n)) {
    return {
      toolName: "data.importCsv",
      riskLevel: "high",
      requiresConfirmation: true,
      supportsDryRun: true,
      requiredFields: ["fileSource", "fieldMap", "duplicateStrategy"],
      verificationChecks: ["rowsRead", "createdCount", "updatedCount", "duplicateCount", "failedCount"],
    };
  }

  if (/(merge|dedupe|deduplicate|delete|remove|erase|publish|automation|bulk\s+update)/.test(n)) {
    return {
      toolName: "records.mutate",
      riskLevel: "high",
      requiresConfirmation: true,
      supportsDryRun: true,
      requiredFields: ["targetScope", "changePlan", "rollbackPlan"],
      verificationChecks: ["affectedCount", "successCount", "failureCount"],
    };
  }

  if (/(report|dashboard|summary|analy[sz]e|trend|retention|kpi|forecast|top donor)/.test(n)) {
    return {
      toolName: "reports.readInsights",
      riskLevel: "low",
      requiresConfirmation: false,
      supportsDryRun: false,
      requiredFields: [],
      verificationChecks: ["recordsExamined", "sourcesUsed"],
    };
  }

  return undefined;
}

export function findThoughtStackMissingDetails(userQuery: string, contract?: ThoughtStackToolContract): string[] {
  if (!contract) return [];
  const n = userQuery.toLowerCase();

  const checks: Record<string, RegExp> = {
    recipientSegment: /(all\s+donors?|monthly|lapsed|segment|group|list|these donors|attendees?)/,
    templateOrMessage: /(template|subject|message|content|draft|email\s+body)/,
    deliveryTiming: /(schedule|now|tomorrow|send\s+on|at\s+\d|today|this\s+week)/,
    channel: /(email|sms|text|mail|push)/,
    fileSource: /(file|csv|upload|spreadsheet)/,
    fieldMap: /(map|column|field|header)/,
    duplicateStrategy: /(duplicate|skip|merge|overwrite)/,
    targetScope: /(all\s+records?|these\s+records?|this\s+segment|selected\s+donors?)/,
    changePlan: /(update|change|merge|delete|remove)/,
    rollbackPlan: /(backup|undo|rollback|restore)/,
    timeRange: /(this\s+month|last\s+month|this\s+quarter|ytd|year|from\s+.+\s+to)/,
    focusArea: /(donor|campaign|event|financial|engagement)/,
  };

  return contract.requiredFields.filter((field) => {
    const pattern = checks[field];
    return pattern ? !pattern.test(n) : false;
  });
}

export function buildThoughtStackAssessment(options: {
  mode: StewardChatMode;
  moduleKey: NonNullable<StewardAiChatPayload["moduleKey"]>;
  userIntent: StewardResponseIntent;
  userQuery: string;
}): ThoughtStackAssessment {
  if (options.mode === "free") {
    return {
      state: "Ready to Act",
      confidence: "medium",
      riskLevel: "low",
      requiresConfirmation: false,
      dryRunRecommended: false,
      selectedWorkflow: "pure.no-tools",
      missingDetails: [],
      summaryLines: [
        "ThoughtStack intent layer: direct no-tools response requested.",
        "ThoughtStack tool layer: no CRM tool selected.",
        "ThoughtStack safety layer: low risk, response-only action.",
      ],
    };
  }

  const contract = buildThoughtStackToolContract(options.userQuery);
  const missingDetails = findThoughtStackMissingDetails(options.userQuery, contract);
  const riskLevel: ThoughtStackRiskLevel = contract?.riskLevel ?? "low";
  const requiresConfirmation = Boolean(contract?.requiresConfirmation);
  const dryRunRecommended = Boolean(contract?.supportsDryRun) || riskLevel === "high";
  const confidence: ThoughtStackConfidence = missingDetails.length === 0 ? "high" : missingDetails.length === 1 ? "medium" : "low";
  const selectedWorkflow = contract?.toolName ?? `response.${options.userIntent}`;

  if (missingDetails.length > 0) {
    const detailList = missingDetails.map((d, i) => `${i + 1}. ${d}`).join("\n");
    return {
      state: "Needs Clarification",
      confidence,
      riskLevel,
      requiresConfirmation,
      dryRunRecommended,
      selectedWorkflow,
      missingDetails,
      toolContract: contract,
      summaryLines: [
        `ThoughtStack intent layer: ${options.userIntent}.`,
        `ThoughtStack tool layer: proposed workflow ${selectedWorkflow}.`,
        `ThoughtStack clarification layer: missing ${missingDetails.length} required detail(s).`,
      ],
      structured: {
        version: 1,
        replyMarkdown: [
          "**ThoughtStack: Needs Clarification**",
          "I can continue safely once these details are confirmed:",
          "",
          detailList,
          "",
          "Choose one option:",
        ].join("\n"),
        artifacts: [],
        suggestedActions: [
          buildThoughtStackChoice("thoughtstack.review_first", "Review First", "Show a dry-run preview first and do not execute live changes."),
          buildThoughtStackChoice("thoughtstack.provide_details", "I will provide details", "I will provide the missing details now so you can continue."),
          buildThoughtStackChoice("thoughtstack.cancel", "Cancel", "Cancel this request for now."),
        ],
        evidence: [
          { label: "ThoughtStack classified request as Needs Clarification" },
          ...(contract ? [{ label: `Proposed contract: ${contract.toolName}` }] : []),
        ],
      },
    };
  }

  if (requiresConfirmation && !hasExplicitConfirmation(options.userQuery)) {
    return {
      state: "Needs Confirmation",
      confidence,
      riskLevel,
      requiresConfirmation,
      dryRunRecommended,
      selectedWorkflow,
      missingDetails,
      toolContract: contract,
      summaryLines: [
        `ThoughtStack safety layer: ${riskLevel} risk action detected.`,
        "ThoughtStack confirmation layer: explicit user confirmation required before execution.",
        dryRunRecommended ? "ThoughtStack dry-run layer: preview recommended before commit." : "",
      ].filter(Boolean),
      structured: {
        version: 1,
        replyMarkdown: [
          "**ThoughtStack: Needs Confirmation**",
          "This request can change CRM data or send outbound communication.",
          "I can proceed after confirmation, or prepare a review-first preview.",
          "",
          "Choose one option:",
        ].join("\n"),
        artifacts: [],
        suggestedActions: [
          buildThoughtStackChoice("thoughtstack.continue", "Continue", "Confirmed. Continue with this workflow."),
          buildThoughtStackChoice("thoughtstack.review_first", "Review First", "Run a dry-run preview only. Do not execute live changes."),
          buildThoughtStackChoice("thoughtstack.cancel", "Cancel", "Cancel this request."),
        ],
        evidence: [
          { label: "ThoughtStack classified request as Needs Confirmation" },
          ...(contract ? [{ label: `Proposed contract: ${contract.toolName}` }] : []),
        ],
      },
    };
  }

  return {
    state: "Ready to Act",
    confidence,
    riskLevel,
    requiresConfirmation,
    dryRunRecommended,
    selectedWorkflow,
    missingDetails,
    toolContract: contract,
    summaryLines: [
      `ThoughtStack intent layer: ${options.userIntent}.`,
      `ThoughtStack tool layer: ${selectedWorkflow}.`,
      `ThoughtStack safety layer: ${riskLevel} risk (${requiresConfirmation ? "confirmation required" : "no confirmation required"}).`,
      dryRunRecommended ? "ThoughtStack execution layer: dry-run-first path is recommended." : "",
      "ThoughtStack verification layer: execution results must be verified before reporting completion.",
    ].filter(Boolean),
  };
}
