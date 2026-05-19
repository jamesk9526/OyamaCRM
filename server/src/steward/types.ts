/**
 * Steward AI shared types, interfaces, and allowed-set constants.
 * Import from here rather than re-declaring these inline.
 */

import type { StewardAiChatMessage, StewardAiMode, StewardAiReasoningMode } from "../services/steward-ai-ollama.js";

// ─── Route payload/response shapes ────────────────────────────────────────────

export interface StewardAiConfigResponse {
  enabled: boolean;
  mode: StewardAiMode;
  endpointUrl: string;
  model: string;
  thinkingModel: string;
  reasoningMode: StewardAiReasoningMode;
  agenticMultiStage: boolean;
  chatHeadEnabled: boolean;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  systemPrompt: string;
  hasApiKey: boolean;
}

export interface StewardAiUpdatePayload {
  enabled?: boolean;
  mode?: StewardAiMode;
  endpointUrl?: string;
  model?: string;
  thinkingModel?: string;
  reasoningMode?: StewardAiReasoningMode;
  agenticMultiStage?: boolean;
  chatHeadEnabled?: boolean;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  systemPrompt?: string;
  apiKey?: string;
}

export interface StewardAiModelsQuery {
  endpointUrl?: string;
}

export interface StewardAiStatusQuery {
  force?: string;
}

// ─── Bridge types ──────────────────────────────────────────────────────────────

export interface BridgePairingRequestPayload {
  siteUrl?: string;
}

export type ReadinessStatus = "Working" | "Partially Working" | "Broken";

export interface BridgeReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

export interface BridgeReadinessPayload {
  status: ReadinessStatus;
  summary: string;
  checks: BridgeReadinessCheck[];
  testedAt: string;
}

export interface BridgePairingKeyPayload {
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

// ─── Chat payload ──────────────────────────────────────────────────────────────

export interface StewardAiChatPayload {
  messages?: StewardAiChatMessage[];
  mode?: "ask" | "analyze" | "draft" | "free" | "agentic" | "writing" | "llm" | "action" | "help";
  moduleKey?: "donor" | "compassion" | "events" | "watchdog" | "webmaster" | "oshareview";
  scopePath?: string;
  /** @mention-locked donors from the chat composer. Each entry provides a constituentId to load a full profile for. */
  donorContext?: Array<{ id?: string; name?: string }>;
  /** Reporting year mode set in the chat composer FY toggle. */
  reportingYearMode?: "calendar" | "fiscal";
  /** The fiscal year number the user has locked to (e.g. 2026). */
  fiscalYear?: number;
  /** Org fiscal year start month (1-12). */
  fiscalYearStart?: number;
  /** Beta toggle: when false, bypass ThoughtStack clarification/confirmation layer for this request. */
  thoughtStackEnabled?: boolean;
}

export interface StewardToolListQuery {
  moduleKey?: "donor" | "oshareview";
  scopePath?: string;
}

export interface StewardToolExecutePayload {
  tool?: string;
  input?: Record<string, unknown>;
  confirm?: boolean;
  moduleKey?: "donor" | "oshareview";
  scopePath?: string;
}

// ─── Memory / context file payloads ───────────────────────────────────────────

export interface AiMemoryPayload {
  title?: string;
  content?: string;
  category?: string;
  source?: string;
  confidence?: number;
  active?: boolean;
  workspaceScope?: string | null;
}

export interface AiContextFilePayload {
  fileName?: string;
  displayName?: string;
  mimeType?: string;
  fileType?: string;
  sizeBytes?: number;
  workspaceScope?: string | null;
  description?: string | null;
  tags?: string[] | string;
  extractedText?: string | null;
}

// ─── Chat pipeline types ───────────────────────────────────────────────────────

export type StewardChatMode = NonNullable<StewardAiChatPayload["mode"]>;

export type StewardResponseIntent =
  | "draft_email"
  | "how_to"
  | "action_plan"
  | "analysis"
  | "summary"
  | "general";

export type GuidePathState =
  | "Ready to Act"
  | "Needs Clarification"
  | "Needs Confirmation"
  | "Needs Guided Setup"
  | "Cannot Safely Answer Yet";

export interface StewardContextResult {
  contextText: string;
  toolsUsed: string[];
  recordsUsed: string[];
}

export interface TopDonorResult {
  reply: string;
  toolsUsed: string[];
  recordsUsed: string[];
}

export interface AgenticPreparationResult {
  reasoningModel: string;
  stageSummaries: string[];
  toolsUsed: string[];
  userIntent: StewardResponseIntent;
}

// ─── Structured response types ─────────────────────────────────────────────────

export type StewardArtifactType =
  | "email_draft"
  | "donor_list"
  | "report_summary"
  | "task_list"
  | "call_script"
  | "csv_rows"
  | "report_card"
  | "chart";

export interface StewardSuggestedActionPayload {
  label: string;
  actionType: string;
  requiresConfirmation: boolean;
  payload?: Record<string, string | number | boolean | null>;
}

export interface StewardEvidencePayload {
  label: string;
  detail?: string;
}

export interface StewardStructuredResponsePayload {
  version: 1;
  replyMarkdown: string;
  artifacts: Array<Record<string, unknown>>;
  suggestedActions: StewardSuggestedActionPayload[];
  evidence: StewardEvidencePayload[];
  parseWarning?: string;
}

// ─── ThoughtStack types ────────────────────────────────────────────────────────

export type ThoughtStackRiskLevel = "low" | "medium" | "high";
export type ThoughtStackConfidence = "low" | "medium" | "high";

export interface ThoughtStackToolContract {
  toolName: string;
  riskLevel: ThoughtStackRiskLevel;
  requiresConfirmation: boolean;
  supportsDryRun: boolean;
  requiredFields: string[];
  verificationChecks: string[];
}

export interface ThoughtStackAssessment {
  state: GuidePathState;
  confidence: ThoughtStackConfidence;
  riskLevel: ThoughtStackRiskLevel;
  requiresConfirmation: boolean;
  dryRunRecommended: boolean;
  selectedWorkflow: string;
  missingDetails: string[];
  summaryLines: string[];
  toolContract?: ThoughtStackToolContract;
  structured?: StewardStructuredResponsePayload;
}

// ─── Allowed-set constants ─────────────────────────────────────────────────────

export const ALLOWED_STEWARD_ARTIFACT_TYPES = new Set<StewardArtifactType>([
  "email_draft",
  "donor_list",
  "report_summary",
  "task_list",
  "call_script",
  "csv_rows",
  "report_card",
  "chart",
]);

export const ALLOWED_SUGGESTED_ACTION_TYPES = new Set<string>([
  "open_report",
  "open_donor",
  "copy",
  "copy_donor_list",
  "copy_csv",
  "prepare_steward_loop",
  "communications.create_email_draft",
  "communications.build_full_email_workspace",
  "tasks.create_follow_up_task",
  "letters.create_letter_draft",
  "letters.build_full_letter_draft",
  "guidepath.choose",
  "thoughtstack.continue",
  "thoughtstack.review_first",
  "thoughtstack.provide_details",
  "thoughtstack.cancel",
]);
