/** Ollama client utilities for Steward AI local/remote inference modes. */

export type StewardAiMode = "local" | "remote";
export type StewardAiReasoningMode = "standard" | "thinking";

export interface StewardAiConfig {
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

export interface StewardAiStreamOptions {
  onDelta?: (delta: string) => void;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface StewardAiRunOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
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

interface OllamaChatStreamResponse {
  model?: string;
  done?: boolean;
  error?: string;
  message?: {
    role?: string;
    content?: string;
  };
}

const DEFAULT_CONFIG: StewardAiConfig = {
  mode: "local",
  endpointUrl: "http://127.0.0.1:11434",
  model: "llama3.2:3b",
  thinkingModel: "deepseek-r1:8b",
  reasoningMode: "thinking",
  agenticMultiStage: true,
  temperature: 0.3,
  maxTokens: 600,
  timeoutMs: 36500,
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
  const reasoningMode = config.reasoningMode === "thinking" || config.reasoningMode === "standard"
    ? config.reasoningMode
    : DEFAULT_CONFIG.reasoningMode;

  return {
    mode,
    endpointUrl: normalizeEndpointUrl(config.endpointUrl, DEFAULT_CONFIG.endpointUrl),
    model: String(config.model ?? DEFAULT_CONFIG.model).trim() || DEFAULT_CONFIG.model,
    thinkingModel: String(config.thinkingModel ?? DEFAULT_CONFIG.thinkingModel).trim() || DEFAULT_CONFIG.thinkingModel,
    reasoningMode,
    agenticMultiStage: config.agenticMultiStage !== undefined
      ? Boolean(config.agenticMultiStage)
      : DEFAULT_CONFIG.agenticMultiStage,
    temperature: toBoundedNumber(config.temperature, DEFAULT_CONFIG.temperature, 0, 2),
    maxTokens: Math.round(toBoundedNumber(config.maxTokens, DEFAULT_CONFIG.maxTokens, 64, 4096)),
    timeoutMs: Math.round(toBoundedNumber(config.timeoutMs, DEFAULT_CONFIG.timeoutMs, 3650, 120000)),
    systemPrompt: String(config.systemPrompt ?? DEFAULT_CONFIG.systemPrompt).trim() || DEFAULT_CONFIG.systemPrompt,
    apiKey: String(config.apiKey ?? "").trim() || null,
  };
}

/** Applies auth headers for remote gateways that front Ollama instances. */
function authHeaders(config: StewardAiConfig): Record<string, string> {
  if (!config.apiKey) return {};
  return { Authorization: `Bearer ${config.apiKey}` };
}

/** Applies runtime/system instructions and bounded history for chat requests. */
function buildMergedMessages(config: StewardAiConfig, messages: StewardAiChatMessage[]): StewardAiChatMessage[] {
  const cleanedMessages = messages
    .map((message) => ({
      role: message.role,
      content: String(message.content ?? "").trim(),
    }))
    .filter((message) => message.content.length > 0);

  // Preserve the newest runtime/system instructions while keeping user+assistant history bounded.
  const runtimeSystemMessages = cleanedMessages.filter((message) => message.role === "system").slice(-2);
  const conversationalMessages = cleanedMessages.filter((message) => message.role !== "system").slice(-18);

  return [
    { role: "system", content: config.systemPrompt },
    ...runtimeSystemMessages,
    ...conversationalMessages,
  ];
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
  const models = await listStewardAiModels(config);
  return {
    modelCount: models.length,
    firstModel: models[0] ?? null,
  };
}

/** Lists model names exposed by the configured Ollama endpoint. */
export async function listStewardAiModels(config: StewardAiConfig): Promise<string[]> {
  const data = await ollamaJsonRequest<OllamaTagsResponse>(config, "/api/tags", {
    method: "GET",
  });

  const unique = new Set<string>();
  for (const model of data.models ?? []) {
    const name = String(model?.name ?? "").trim();
    if (name) unique.add(name);
  }

  return [...unique];
}

/** Sends chat messages to Ollama and returns the assistant response text. */
export async function runStewardAiChat(
  config: StewardAiConfig,
  messages: StewardAiChatMessage[],
  options: StewardAiRunOptions = {}
): Promise<StewardAiChatResult> {
  const mergedMessages = buildMergedMessages(config, messages);
  const selectedModel = String(options.model ?? config.model).trim() || config.model;
  const selectedTemperature = toBoundedNumber(options.temperature, config.temperature, 0, 2);
  const selectedMaxTokens = Math.round(toBoundedNumber(options.maxTokens, config.maxTokens, 64, 4096));

  const data = await ollamaJsonRequest<OllamaChatResponse>(config, "/api/chat", {
    method: "POST",
    body: JSON.stringify({
      model: selectedModel,
      stream: false,
      messages: mergedMessages,
      options: {
        temperature: selectedTemperature,
        num_predict: selectedMaxTokens,
      },
    }),
  });

  const content = data.message?.content?.trim();
  if (!content) {
    throw new Error("Ollama returned an empty assistant response.");
  }

  return {
    content,
    model: data.model ?? selectedModel,
  };
}

/** Streams chat tokens from Ollama and returns the final assistant payload. */
export async function runStewardAiChatStream(
  config: StewardAiConfig,
  messages: StewardAiChatMessage[],
  options: StewardAiStreamOptions = {}
): Promise<StewardAiChatResult> {
  const mergedMessages = buildMergedMessages(config, messages);
  const selectedModel = String(options.model ?? config.model).trim() || config.model;
  const selectedTemperature = toBoundedNumber(options.temperature, config.temperature, 0, 2);
  const selectedMaxTokens = Math.round(toBoundedNumber(options.maxTokens, config.maxTokens, 64, 4096));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(`${config.endpointUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authHeaders(config),
      },
      signal: controller.signal,
      body: JSON.stringify({
        model: selectedModel,
        stream: true,
        messages: mergedMessages,
        options: {
          temperature: selectedTemperature,
          num_predict: selectedMaxTokens,
        },
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`Ollama request failed (${response.status}): ${body.slice(0, 240)}`);
    }

    if (!response.body) {
      throw new Error("Ollama streaming response body is unavailable.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";
    let model = selectedModel;
    let done = false;

    while (!done) {
      const { value, done: streamDone } = await reader.read();
      if (streamDone) break;

      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        newlineIndex = buffer.indexOf("\n");

        if (!line) continue;

        const event = JSON.parse(line) as OllamaChatStreamResponse;
        if (event.error) {
          throw new Error(`Ollama stream error: ${event.error}`);
        }

        if (event.model) {
          model = event.model;
        }

        const delta = String(event.message?.content ?? "");
        if (delta) {
          fullText += delta;
          options.onDelta?.(delta);
        }

        if (event.done) {
          done = true;
        }
      }
    }

    if (!fullText.trim()) {
      throw new Error("Ollama returned an empty assistant response.");
    }

    return {
      content: fullText.trim(),
      model,
    };
  } finally {
    clearTimeout(timeout);
  }
}

/** Returns defaults for first-time setup flows. */
export function defaultStewardAiConfig(): StewardAiConfig {
  return { ...DEFAULT_CONFIG };
}
