/** ogenticAgentService runs OGentic prompts through the live Steward AI endpoint. */

import { apiFetch } from "@/app/lib/auth-client";
import type { OGenticExecutionContext } from "@/app/modules/ogentic/types/ogentic.types";

type StewardModuleKey = "donor" | "compassion" | "events" | "watchdog" | "webmaster";

interface OGenticAgentMessage {
  role: "user" | "assistant";
  content: string;
}

interface OGenticAgentRequest {
  prompt: string;
  draftOnly: boolean;
  scopes: string[];
  messages?: OGenticAgentMessage[];
}

interface StewardChatResponse {
  reply: string;
  model: string;
  mode: "ask" | "analyze" | "draft" | "action" | "help";
  runtimeMode?: "local" | "remote";
  provider: string;
  toolsUsed?: string[];
  recordsUsed?: string[];
  moduleKey?: StewardModuleKey;
  scopePath?: string;
}

export interface OGenticAgentResult {
  reply: string;
  model: string;
  mode: "ask" | "analyze" | "draft" | "action" | "help";
  runtimeMode: "local" | "remote" | "unknown";
  provider: string;
  toolsUsed: string[];
  recordsUsed: string[];
  moduleKey: StewardModuleKey;
  scopePath: string;
}

/** Maps OGentic module scopes to the closest Steward retrieval module. */
function resolveStewardModuleKey(scopes: OGenticExecutionContext["moduleScope"]): StewardModuleKey {
  if (scopes.includes("event")) return "events";
  if (scopes.includes("client")) return "compassion";
  if (scopes.includes("communication")) return "webmaster";
  return "donor";
}

/** Normalizes outbound chat history so the API only receives safe role/content fields. */
function normalizeMessages(messages: OGenticAgentMessage[], prompt: string): OGenticAgentMessage[] {
  const sanitized = messages
    .filter((message) => message.content.trim().length > 0)
    .map((message) => ({
      role: message.role,
      content: message.content.slice(0, 3500),
    }))
    .slice(-19);

  // Ensure the latest user prompt is always included as the final message.
  const latest = sanitized[sanitized.length - 1];
  if (!latest || latest.role !== "user" || latest.content.trim() !== prompt.trim()) {
    sanitized.push({ role: "user", content: prompt.slice(0, 3500) });
  }

  return sanitized.slice(-20);
}

/** runOGenticAgent executes OGentic chat using the live Steward AI backend contract. */
export async function runOGenticAgent(request: OGenticAgentRequest, context: OGenticExecutionContext): Promise<OGenticAgentResult> {
  const moduleKey = resolveStewardModuleKey(context.moduleScope);
  const messages = normalizeMessages(request.messages ?? [], request.prompt);

  const response = await apiFetch<StewardChatResponse>("/api/steward-ai/chat", {
    method: "POST",
    body: JSON.stringify({
      messages,
      mode: request.draftOnly ? "draft" : "analyze",
      moduleKey,
      scopePath: context.sourceRoute || "/ogentic",
    }),
  });

  return {
    reply: response.reply,
    model: response.model,
    mode: response.mode,
    runtimeMode: response.runtimeMode ?? "unknown",
    provider: response.provider,
    toolsUsed: response.toolsUsed ?? [],
    recordsUsed: response.recordsUsed ?? [],
    moduleKey: response.moduleKey ?? moduleKey,
    scopePath: response.scopePath ?? context.sourceRoute ?? "/ogentic",
  };
}
