/** Ollama client utilities for Steward AI local/remote inference modes. */

export type StewardAiMode = "local" | "remote";

export interface StewardAiConfig {
  mode: StewardAiMode;
  endpointUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  systemPrompt: string;
  apiKey: string | null;
}

export interface StewardAiChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface StewardAiChatResult {
  content: string;
  model: string;
}

interface OllamaTagsResponse {
  models?: Array<{ name?: string }>;
}

interface OllamaChatResponse {
  model?: string;
  message?: {
    role?: string;
    content?: string;
  };
}

const DEFAULT_CONFIG: StewardAiConfig = {
  mode: "local",
  endpointUrl: "http://127.0.0.1:11434",
  model: "llama3.2:3b",
  temperature: 0.3,
  maxTokens: 600,
  timeoutMs: 30000,
  systemPrompt: [
    "You are Steward, the AI assistant for OyamaCRM.",
    "Primary goals: help staff make accurate, safe, and practical next decisions.",
    "Always prioritize grounded answers over confident guesses.",
    "If context is missing, say what is missing and ask for the minimum needed clarification.",
    "Keep responses concise, scannable, and action-oriented.",
    "For suggested write operations, remain confirm-first and clearly state what would change.",
  ].join(" "),
  apiKey: null,
};

/** Converts unknown numeric values into bounded numbers with fallback. */
function toBoundedNumber(value: unknown, fallback: number, min: number, max: number): number {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

/** Normalizes endpoint URLs while preserving http/https scheme requirements. */
function normalizeEndpointUrl(value: unknown, fallback: string): string {
  const trimmed = String(value ?? "").trim();
  const endpoint = trimmed || fallback;
  if (!/^https?:\/\//i.test(endpoint)) return fallback;
  return endpoint.replace(/\/+$/, "");
}

/** Parses persisted config JSON into a safe runtime config with defaults. */
export function parseStewardAiConfig(rawConfig: unknown): StewardAiConfig {
  const config = rawConfig && typeof rawConfig === "object" ? (rawConfig as Record<string, unknown>) : {};
  const mode = config.mode === "remote" ? "remote" : "local";

  return {
    mode,
    endpointUrl: normalizeEndpointUrl(config.endpointUrl, DEFAULT_CONFIG.endpointUrl),
    model: String(config.model ?? DEFAULT_CONFIG.model).trim() || DEFAULT_CONFIG.model,
    temperature: toBoundedNumber(config.temperature, DEFAULT_CONFIG.temperature, 0, 2),
    maxTokens: Math.round(toBoundedNumber(config.maxTokens, DEFAULT_CONFIG.maxTokens, 64, 4096)),
    timeoutMs: Math.round(toBoundedNumber(config.timeoutMs, DEFAULT_CONFIG.timeoutMs, 3000, 120000)),
    systemPrompt: String(config.systemPrompt ?? DEFAULT_CONFIG.systemPrompt).trim() || DEFAULT_CONFIG.systemPrompt,
    apiKey: String(config.apiKey ?? "").trim() || null,
  };
}

/** Applies auth headers for remote gateways that front Ollama instances. */
function authHeaders(config: StewardAiConfig): Record<string, string> {
  if (!config.apiKey) return {};
  return { Authorization: `Bearer ${config.apiKey}` };
}

/** Executes a JSON request against the configured Ollama endpoint with timeout handling. */
async function ollamaJsonRequest<T>(
  config: StewardAiConfig,
  path: string,
  init: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.endpointUrl}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(config),
        ...(init.headers ?? {}),
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Ollama request failed (${response.status}): ${body.slice(0, 240)}`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

/** Tests whether the configured Ollama endpoint is reachable and returns model metadata. */
export async function testStewardAiConnection(config: StewardAiConfig): Promise<{ modelCount: number; firstModel: string | null }> {
  const data = await ollamaJsonRequest<OllamaTagsResponse>(config, "/api/tags", {
    method: "GET",
  });

  const models = data.models ?? [];
  return {
    modelCount: models.length,
    firstModel: models[0]?.name ?? null,
  };
}

/** Sends chat messages to Ollama and returns the assistant response text. */
export async function runStewardAiChat(config: StewardAiConfig, messages: StewardAiChatMessage[]): Promise<StewardAiChatResult> {
  const cleanedMessages = messages
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? "").trim(),
    }))
    .filter((message) => message.content.length > 0);

  // Preserve the newest runtime/system instructions while keeping user+assistant history bounded.
  const runtimeSystemMessages = cleanedMessages.filter((message) => message.role === "system").slice(-2);
  const conversationalMessages = cleanedMessages.filter((message) => message.role !== "system").slice(-18);

  const mergedMessages: StewardAiChatMessage[] = [
    { role: "system", content: config.systemPrompt },
    ...runtimeSystemMessages,
    ...conversationalMessages,
  ];

  const data = await ollamaJsonRequest<OllamaChatResponse>(config, "/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model: config.model,
      stream: false,
      messages: mergedMessages,
      options: {
        temperature: config.temperature,
        num_predict: config.maxTokens,
      },
    }),
  });

  const content = data.message?.content?.trim();
  if (!content) {
    throw new Error("Ollama returned an empty assistant response.");
  }

  return {
    content,
    model: data.model ?? config.model,
  };
}

/** Returns defaults for first-time setup flows. */
export function defaultStewardAiConfig(): StewardAiConfig {
  return { ...DEFAULT_CONFIG };
}
