/** Tracks Steward AI runtime health and active task state for UI diagnostics and safe fallback behavior. */
import {
  testStewardAiConnection,
  type StewardAiConfig,
  type StewardAiMode,
} from "./steward-ai-ollama.js";

export type StewardAiRuntimeStatus =
  | "disabled"
  | "not_configured"
  | "connecting"
  | "connected"
  | "thinking"
  | "running_task"
  | "error"
  | "fallback";

export interface StewardAiRuntimeState {
  enabled: boolean;
  status: StewardAiRuntimeStatus;
  mode: StewardAiMode;
  endpointUrl: string;
  model: string;
  thinkingModel: string;
  activeTaskCount: number;
  currentTaskLabel: string | null;
  lastCheckedAt: string | null;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastErrorMessage: string | null;
}

interface RuntimeEntry {
  state: StewardAiRuntimeState;
  updatedAtMs: number;
}

interface RuntimeSnapshotOptions {
  organizationId: string;
  enabled: boolean;
  config: StewardAiConfig;
  forceRefresh?: boolean;
}

interface TaskStartOptions {
  organizationId: string;
  enabled: boolean;
  config: StewardAiConfig;
  label: string;
  status?: "thinking" | "running_task";
}

interface TaskRunOptions extends TaskStartOptions {
  fallbackOnError?: boolean;
}

const runtimeByOrganization = new Map<string, RuntimeEntry>();
const DEFAULT_HEALTH_CACHE_MS = 45_000;

function nowIso(): string {
  return new Date().toISOString();
}

function createBaseState(options: {
  enabled: boolean;
  config: StewardAiConfig;
  status: StewardAiRuntimeStatus;
}): StewardAiRuntimeState {
  return {
    enabled: options.enabled,
    status: options.status,
    mode: options.config.mode,
    endpointUrl: options.config.endpointUrl,
    model: options.config.model,
    thinkingModel: options.config.thinkingModel,
    activeTaskCount: 0,
    currentTaskLabel: null,
    lastCheckedAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
  };
}

function isConfigured(config: StewardAiConfig): boolean {
  return Boolean(config.endpointUrl.trim()) && Boolean(config.model.trim()) && Boolean(config.thinkingModel.trim());
}

function getOrCreateEntry(organizationId: string, enabled: boolean, config: StewardAiConfig): RuntimeEntry {
  const existing = runtimeByOrganization.get(organizationId);
  if (existing) {
    existing.state.enabled = enabled;
    existing.state.mode = config.mode;
    existing.state.endpointUrl = config.endpointUrl;
    existing.state.model = config.model;
    existing.state.thinkingModel = config.thinkingModel;
    return existing;
  }

  const created: RuntimeEntry = {
    state: createBaseState({
      enabled,
      config,
      status: enabled ? "not_configured" : "disabled",
    }),
    updatedAtMs: Date.now(),
  };

  runtimeByOrganization.set(organizationId, created);
  return created;
}

function setStatus(entry: RuntimeEntry, status: StewardAiRuntimeStatus): void {
  entry.state.status = status;
  entry.updatedAtMs = Date.now();
}

export function getStewardAiRuntimeState(options: RuntimeSnapshotOptions): StewardAiRuntimeState {
  const entry = getOrCreateEntry(options.organizationId, options.enabled, options.config);

  if (!options.enabled) {
    setStatus(entry, "disabled");
    entry.state.currentTaskLabel = null;
    entry.state.activeTaskCount = 0;
    return { ...entry.state };
  }

  if (!isConfigured(options.config)) {
    setStatus(entry, "not_configured");
    entry.state.currentTaskLabel = null;
    entry.state.activeTaskCount = 0;
    return { ...entry.state };
  }

  return { ...entry.state };
}

/**
 * Performs a cached connection check so UIs can request status often without hammering runtime endpoints.
 */
export async function refreshStewardAiRuntimeState(options: RuntimeSnapshotOptions): Promise<StewardAiRuntimeState> {
  const entry = getOrCreateEntry(options.organizationId, options.enabled, options.config);

  if (!options.enabled) {
    setStatus(entry, "disabled");
    entry.state.currentTaskLabel = null;
    entry.state.activeTaskCount = 0;
    return { ...entry.state };
  }

  if (!isConfigured(options.config)) {
    setStatus(entry, "not_configured");
    entry.state.currentTaskLabel = null;
    entry.state.activeTaskCount = 0;
    return { ...entry.state };
  }

  const forceRefresh = options.forceRefresh === true;
  const lastCheckedMs = entry.state.lastCheckedAt ? Date.parse(entry.state.lastCheckedAt) : 0;
  const cacheFresh = Number.isFinite(lastCheckedMs) && Date.now() - lastCheckedMs < DEFAULT_HEALTH_CACHE_MS;

  if (!forceRefresh && cacheFresh) {
    return { ...entry.state };
  }

  setStatus(entry, "connecting");
  entry.state.lastCheckedAt = nowIso();

  try {
    await testStewardAiConnection(options.config);
    entry.state.lastSuccessAt = nowIso();
    entry.state.lastErrorAt = null;
    entry.state.lastErrorMessage = null;
    if (entry.state.activeTaskCount > 0) {
      setStatus(entry, entry.state.status === "thinking" ? "thinking" : "running_task");
    } else {
      setStatus(entry, "connected");
    }
  } catch (error) {
    entry.state.lastErrorAt = nowIso();
    entry.state.lastErrorMessage = error instanceof Error ? error.message : "Steward AI connection check failed.";
    setStatus(entry, "fallback");
  }

  return { ...entry.state };
}

export function recordStewardAiConnectionSuccess(options: {
  organizationId: string;
  enabled: boolean;
  config: StewardAiConfig;
}): StewardAiRuntimeState {
  const entry = getOrCreateEntry(options.organizationId, options.enabled, options.config);

  entry.state.lastCheckedAt = nowIso();
  entry.state.lastSuccessAt = nowIso();
  entry.state.lastErrorAt = null;
  entry.state.lastErrorMessage = null;

  if (!options.enabled) {
    setStatus(entry, "disabled");
  } else if (entry.state.activeTaskCount > 0) {
    setStatus(entry, entry.state.status === "thinking" ? "thinking" : "running_task");
  } else {
    setStatus(entry, "connected");
  }

  return { ...entry.state };
}

export function recordStewardAiConnectionError(options: {
  organizationId: string;
  enabled: boolean;
  config: StewardAiConfig;
  message: string;
  fallback?: boolean;
}): StewardAiRuntimeState {
  const entry = getOrCreateEntry(options.organizationId, options.enabled, options.config);

  entry.state.lastCheckedAt = nowIso();
  entry.state.lastErrorAt = nowIso();
  entry.state.lastErrorMessage = String(options.message || "Steward AI runtime failed.").slice(0, 1000);

  if (!options.enabled) {
    setStatus(entry, "disabled");
  } else if (!isConfigured(options.config)) {
    setStatus(entry, "not_configured");
  } else {
    setStatus(entry, options.fallback ? "fallback" : "error");
  }

  return { ...entry.state };
}

export function beginStewardAiTask(options: TaskStartOptions): StewardAiRuntimeState {
  const entry = getOrCreateEntry(options.organizationId, options.enabled, options.config);

  if (!options.enabled) {
    setStatus(entry, "disabled");
    return { ...entry.state };
  }

  if (!isConfigured(options.config)) {
    setStatus(entry, "not_configured");
    return { ...entry.state };
  }

  entry.state.activeTaskCount += 1;
  entry.state.currentTaskLabel = options.label;
  setStatus(entry, options.status ?? "running_task");

  return { ...entry.state };
}

export function endStewardAiTask(options: {
  organizationId: string;
  enabled: boolean;
  config: StewardAiConfig;
}): StewardAiRuntimeState {
  const entry = getOrCreateEntry(options.organizationId, options.enabled, options.config);

  entry.state.activeTaskCount = Math.max(0, entry.state.activeTaskCount - 1);
  if (entry.state.activeTaskCount === 0) {
    entry.state.currentTaskLabel = null;
    if (options.enabled && isConfigured(options.config)) {
      setStatus(entry, "connected");
    } else if (!options.enabled) {
      setStatus(entry, "disabled");
    } else {
      setStatus(entry, "not_configured");
    }
  }

  return { ...entry.state };
}

/**
 * Wraps one AI operation with runtime task telemetry so UI can show "thinking" or "running task" states.
 */
export async function withStewardAiTask<T>(options: TaskRunOptions, runTask: () => Promise<T>): Promise<T> {
  beginStewardAiTask(options);

  try {
    const result = await runTask();
    recordStewardAiConnectionSuccess({
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: options.config,
    });
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Steward AI task failed.";
    recordStewardAiConnectionError({
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: options.config,
      message,
      fallback: options.fallbackOnError === true,
    });
    throw error;
  } finally {
    endStewardAiTask({
      organizationId: options.organizationId,
      enabled: options.enabled,
      config: options.config,
    });
  }
}
