// Main process for standalone Oyama Bridge app.
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const zlib = require("node:zlib");
const { execFile } = require("node:child_process");
const { createBridgeServer } = require("./bridge-server");
const { parseGpuListOutput, parseGpuTelemetryCsv } = require("./gpu-telemetry");
const {
  createOllamaRuntimeManager,
  sanitizeOllamaRuntimeMode,
} = require("./ollama-runtime");

let mainWindow = null;
let tray = null;
let bridgeManager = null;
let ollamaRuntimeManager = null;
let isAppQuitting = false;
let vramIdleTimer = null;
let backupRuntimeState = {
  lastRunAt: "",
  lastFilePath: "",
  lastStatus: "Idle",
  lastError: "",
};

const VRAM_IDLE_TIMEOUT_MS = 12 * 60 * 1000;

const DEFAULT_CONFIG = {
  crmSiteUrl: "",
  startupLaunchEnabled: false,
  startHidden: false,
  bridgeAutostart: true,
  bridgeEnabled: false,
  minimizeToTaskbarOnClose: true,
  bridgeUpstreamUrl: "http://127.0.0.1:11434",
  bridgePort: 43110,
  bridgeApiKey: "",
  bridgeAllowedOrigins: "",
  bridgePublicBaseUrl: "",
  bridgeDomainUrl: "",
  ollamaRuntimeMode: "managed",
  ollamaExecutablePath: "ollama",
  bridgeModel: "llama3.2:3b",
  bridgeThinkingModel: "deepseek-r1:8b",
  bridgeSystemPromptBase: "You are Oyama Bridge Steward assistant. Stay donor/report focused, use grounded facts, and avoid unsupported claims.",
  bridgeInternalChatPrompt: "When possible, summarize bridge runtime state, request health, and operational risks in practical terms.",
  bridgeCudaDevice: "auto",
  bridgeTemperature: 0.3,
  bridgeTimeoutMs: 180000,
  // Ollama inference performance settings
  ollamaNumGpuLayers: 999,       // 999 = offload all layers to GPU
  ollamaMaxLoadedModels: 1,      // 1 = keep only one model in VRAM at a time
  ollamaKeepAliveSeconds: -1,    // -1 = keep model loaded until idle timer fires
  ollamaNumThreads: 0,           // 0 = auto-detect CPU threads
  donorReportsOnly: true,
  backgroundBackupEnabled: false,
  backgroundBackupDirectory: "",
  backgroundBackupIntervalHours: 24,
  backgroundBackupRetentionDays: 30,
  backgroundBackupIncludeLogs: true,
};

const APP_DATA_ROOT = path.join(app.getPath("appData"), "OyamaBridgeDesktopServer");
const SESSION_DATA_ROOT = path.join(APP_DATA_ROOT, "session-data");
const DISK_CACHE_ROOT = path.join(SESSION_DATA_ROOT, "Cache");

function configureElectronStoragePaths() {
  try {
    fs.mkdirSync(APP_DATA_ROOT, { recursive: true });
    fs.mkdirSync(SESSION_DATA_ROOT, { recursive: true });
    fs.mkdirSync(DISK_CACHE_ROOT, { recursive: true });
    app.setPath("userData", APP_DATA_ROOT);
    app.setPath("sessionData", SESSION_DATA_ROOT);
    app.commandLine.appendSwitch("disk-cache-dir", DISK_CACHE_ROOT);
    app.commandLine.appendSwitch("disable-gpu-shader-disk-cache");
  } catch {
    // If path override fails, Electron falls back to defaults.
  }
}

configureElectronStoragePaths();

function getConfigPath() {
  return path.join(app.getPath("userData"), "oyama-bridge-config.json");
}

function getUsageLedgerPath() {
  return path.join(app.getPath("userData"), "oyama-bridge-usage-ledger.json");
}

const USAGE_LEDGER_VERSION = 1;
const USAGE_ESTIMATE_MODEL = "OpenAI GPT-4o equivalent";
const USAGE_BYTES_PER_TOKEN = 4;
const USAGE_INPUT_COST_PER_MILLION_USD = 5;
const USAGE_OUTPUT_COST_PER_MILLION_USD = 15;

function toFiniteNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function monthKeyFromTimestamp(timestamp) {
  const date = new Date(timestamp || Date.now());
  if (Number.isNaN(date.getTime())) {
    const now = new Date();
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function buildEmptyUsageLedger() {
  const nowIso = new Date().toISOString();
  return {
    version: USAGE_LEDGER_VERSION,
    currency: "USD",
    model: USAGE_ESTIMATE_MODEL,
    pricing: {
      bytesPerToken: USAGE_BYTES_PER_TOKEN,
      inputCostPerMillionUsd: USAGE_INPUT_COST_PER_MILLION_USD,
      outputCostPerMillionUsd: USAGE_OUTPUT_COST_PER_MILLION_USD,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
    months: {},
  };
}

function normalizeUsageLedger(raw) {
  const fallback = buildEmptyUsageLedger();
  const source = raw && typeof raw === "object" ? raw : {};
  const rawMonths = source.months && typeof source.months === "object" ? source.months : {};

  const normalizedMonths = Object.entries(rawMonths).reduce((acc, [monthKey, rawMonth]) => {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) return acc;
    const month = rawMonth && typeof rawMonth === "object" ? rawMonth : {};
    acc[monthKey] = {
      month: monthKey,
      receiptId: String(month.receiptId || `OYB-${monthKey.replace("-", "")}`),
      generatedAt: String(month.generatedAt || source.createdAt || fallback.createdAt),
      updatedAt: String(month.updatedAt || source.updatedAt || fallback.updatedAt),
      requestCount: Math.max(0, Math.round(toFiniteNumber(month.requestCount, 0))),
      totalInputBytes: Math.max(0, Math.round(toFiniteNumber(month.totalInputBytes, 0))),
      totalOutputBytes: Math.max(0, Math.round(toFiniteNumber(month.totalOutputBytes, 0))),
      estimatedInputTokens: Math.max(0, toFiniteNumber(month.estimatedInputTokens, 0)),
      estimatedOutputTokens: Math.max(0, toFiniteNumber(month.estimatedOutputTokens, 0)),
      estimatedCostUsd: Math.max(0, toFiniteNumber(month.estimatedCostUsd, 0)),
    };
    return acc;
  }, {});

  return {
    ...fallback,
    ...source,
    version: USAGE_LEDGER_VERSION,
    currency: "USD",
    model: USAGE_ESTIMATE_MODEL,
    pricing: {
      bytesPerToken: USAGE_BYTES_PER_TOKEN,
      inputCostPerMillionUsd: USAGE_INPUT_COST_PER_MILLION_USD,
      outputCostPerMillionUsd: USAGE_OUTPUT_COST_PER_MILLION_USD,
    },
    createdAt: String(source.createdAt || fallback.createdAt),
    updatedAt: String(source.updatedAt || fallback.updatedAt),
    months: normalizedMonths,
  };
}

function ensureCurrentMonthReceiptEntry(ledger) {
  const normalized = normalizeUsageLedger(ledger);
  const monthKey = monthKeyFromTimestamp(new Date().toISOString());
  const nowIso = new Date().toISOString();

  if (normalized.months[monthKey] && typeof normalized.months[monthKey] === "object") {
    return normalized;
  }

  normalized.months[monthKey] = {
    month: monthKey,
    receiptId: `OYB-${monthKey.replace("-", "")}`,
    generatedAt: nowIso,
    updatedAt: nowIso,
    requestCount: 0,
    totalInputBytes: 0,
    totalOutputBytes: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedCostUsd: 0,
  };
  normalized.updatedAt = nowIso;
  return normalized;
}

function readUsageLedger() {
  try {
    const raw = fs.readFileSync(getUsageLedgerPath(), "utf8");
    const parsed = JSON.parse(raw);
    const normalized = normalizeUsageLedger(parsed);
    const withCurrentMonth = ensureCurrentMonthReceiptEntry(normalized);
    if (!parsed || !parsed.months || !parsed.months[monthKeyFromTimestamp(new Date().toISOString())]) {
      writeUsageLedger(withCurrentMonth);
    }
    return withCurrentMonth;
  } catch {
    const fallback = ensureCurrentMonthReceiptEntry(buildEmptyUsageLedger());
    writeUsageLedger(fallback);
    return fallback;
  }
}

function writeUsageLedger(nextLedger) {
  const normalized = normalizeUsageLedger(nextLedger);
  fs.writeFileSync(getUsageLedgerPath(), JSON.stringify(normalized, null, 2), "utf8");
  return normalized;
}

function estimateCostFromBytes(totalInputBytes, totalOutputBytes) {
  const inputBytes = Math.max(0, toFiniteNumber(totalInputBytes, 0));
  const outputBytes = Math.max(0, toFiniteNumber(totalOutputBytes, 0));
  const estimatedInputTokens = inputBytes / USAGE_BYTES_PER_TOKEN;
  const estimatedOutputTokens = outputBytes / USAGE_BYTES_PER_TOKEN;
  const inputCostUsd = (estimatedInputTokens / 1_000_000) * USAGE_INPUT_COST_PER_MILLION_USD;
  const outputCostUsd = (estimatedOutputTokens / 1_000_000) * USAGE_OUTPUT_COST_PER_MILLION_USD;
  return {
    estimatedInputTokens,
    estimatedOutputTokens,
    estimatedCostUsd: Number((inputCostUsd + outputCostUsd).toFixed(6)),
  };
}

function shouldTrackBillableUsage(entry) {
  const routeGroup = String(entry?.routeGroup || "").toLowerCase();
  if (routeGroup === "chat" || routeGroup === "generate") return true;
  const pathValue = String(entry?.path || "").toLowerCase();
  return pathValue.startsWith("/api/chat") || pathValue.startsWith("/api/generate");
}

function recordUsageEntry(entry) {
  if (!entry || typeof entry !== "object") return;
  if (!shouldTrackBillableUsage(entry)) return;

  const timestamp = String(entry.timestamp || new Date().toISOString());
  const monthKey = monthKeyFromTimestamp(timestamp);
  const ledger = readUsageLedger();
  const nowIso = new Date().toISOString();

  const existingMonth = ledger.months[monthKey] && typeof ledger.months[monthKey] === "object"
    ? ledger.months[monthKey]
    : {
      month: monthKey,
      receiptId: `OYB-${monthKey.replace("-", "")}`,
      generatedAt: nowIso,
      updatedAt: nowIso,
      requestCount: 0,
      totalInputBytes: 0,
      totalOutputBytes: 0,
      estimatedInputTokens: 0,
      estimatedOutputTokens: 0,
      estimatedCostUsd: 0,
    };

  const nextInputBytes = Math.max(0, Math.round(toFiniteNumber(entry.bodyBytes, 0)));
  const nextOutputBytes = Math.max(0, Math.round(toFiniteNumber(entry.responseBytes, 0)));
  const totalInputBytes = Math.max(0, Math.round(toFiniteNumber(existingMonth.totalInputBytes, 0))) + nextInputBytes;
  const totalOutputBytes = Math.max(0, Math.round(toFiniteNumber(existingMonth.totalOutputBytes, 0))) + nextOutputBytes;
  const totals = estimateCostFromBytes(totalInputBytes, totalOutputBytes);

  ledger.months[monthKey] = {
    ...existingMonth,
    month: monthKey,
    requestCount: Math.max(0, Math.round(toFiniteNumber(existingMonth.requestCount, 0))) + 1,
    totalInputBytes,
    totalOutputBytes,
    estimatedInputTokens: totals.estimatedInputTokens,
    estimatedOutputTokens: totals.estimatedOutputTokens,
    estimatedCostUsd: totals.estimatedCostUsd,
    updatedAt: nowIso,
  };

  ledger.updatedAt = nowIso;
  writeUsageLedger(ledger);
}

function buildUsageHistoryResponse() {
  const ledger = readUsageLedger();
  const currentMonthKey = monthKeyFromTimestamp(new Date().toISOString());
  const months = Object.values(ledger.months)
    .sort((a, b) => String(b.month).localeCompare(String(a.month)));

  const currentMonth = ledger.months[currentMonthKey] || {
    month: currentMonthKey,
    receiptId: `OYB-${currentMonthKey.replace("-", "")}`,
    generatedAt: "",
    updatedAt: "",
    requestCount: 0,
    totalInputBytes: 0,
    totalOutputBytes: 0,
    estimatedInputTokens: 0,
    estimatedOutputTokens: 0,
    estimatedCostUsd: 0,
  };

  return {
    currency: "USD",
    model: USAGE_ESTIMATE_MODEL,
    pricing: {
      bytesPerToken: USAGE_BYTES_PER_TOKEN,
      inputCostPerMillionUsd: USAGE_INPUT_COST_PER_MILLION_USD,
      outputCostPerMillionUsd: USAGE_OUTPUT_COST_PER_MILLION_USD,
    },
    currentMonth,
    months,
    generatedAt: new Date().toISOString(),
  };
}

function clearVramIdleTimer() {
  if (vramIdleTimer) {
    clearTimeout(vramIdleTimer);
    vramIdleTimer = null;
  }
}

function shouldCountAsModelActivity(entry) {
  const routeGroup = String(entry?.routeGroup || "").toLowerCase();
  if (routeGroup === "chat" || routeGroup === "generate") return true;

  const pathValue = String(entry?.path || "").toLowerCase();
  return pathValue.startsWith("/api/chat") || pathValue.startsWith("/api/generate");
}

function scheduleIdleVramClear() {
  clearVramIdleTimer();

  vramIdleTimer = setTimeout(() => {
    vramIdleTimer = null;

    if (!ollamaRuntimeManager || typeof ollamaRuntimeManager.clearVram !== "function") return;

    ollamaRuntimeManager.clearVram("idle-timeout").catch(() => {
      // Best-effort cleanup; never crash runtime flow on idle unload failures.
    });
  }, VRAM_IDLE_TIMEOUT_MS);
}

async function clearVramNow(reason) {
  if (!ollamaRuntimeManager || typeof ollamaRuntimeManager.clearVram !== "function") {
    return null;
  }

  try {
    return await ollamaRuntimeManager.clearVram(reason);
  } catch {
    return null;
  }
}

function generateBridgeApiKey() {
  return `oyama-${crypto.randomBytes(18).toString("hex")}`;
}

function toBase64Url(text) {
  return Buffer.from(String(text || ""), "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function buildPairingBundle(config, options = {}) {
  const safe = sanitizeConfig(config);
  const now = Date.now();
  // Pairing keys never expire — set expiresAt to null so the CRM and bridge
  // accept them indefinitely without requiring re-pairing.
  const expiresAt = null;
  const keyName = String(options.keyName || "Oyama Bridge Pairing Key").trim().slice(0, 80) || "Oyama Bridge Pairing Key";
  const mode = String(options.mode || "donor_reports_only").toLowerCase() === "full" ? "full" : "donor_reports_only";

  const endpoint = String(safe.bridgePublicBaseUrl || "").trim() || `http://127.0.0.1:${safe.bridgePort}`;
  const payload = {
    version: 1,
    name: keyName,
    createdAt: new Date(now).toISOString(),
    expiresAt,
    mode,
    donorReportsOnly: mode !== "full" ? true : Boolean(safe.donorReportsOnly),
    endpoint,
    apiKey: safe.bridgeApiKey,
    model: safe.bridgeModel,
    thinkingModel: safe.bridgeThinkingModel,
    cudaDevice: safe.bridgeCudaDevice,
    temperature: safe.bridgeTemperature,
    timeoutMs: safe.bridgeTimeoutMs,
  };

  const tokenPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", safe.bridgeApiKey)
    .update(tokenPayload)
    .digest("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");

  const token = `${tokenPayload}.${signature}`;
  const pairingUrl = `${String(safe.crmSiteUrl || "").replace(/\/+$/, "")}/settings/ai?bridgePair=${encodeURIComponent(token)}`;

  return {
    payload,
    token,
    pairingUrl,
  };
}

function sanitizeConfig(rawConfig) {
  const merged = {
    ...DEFAULT_CONFIG,
    ...(rawConfig && typeof rawConfig === "object" ? rawConfig : {}),
  };

  if (typeof merged.bridgeApiKey !== "string" || merged.bridgeApiKey.trim().length < 12) {
    merged.bridgeApiKey = generateBridgeApiKey();
  }

  merged.startupLaunchEnabled = Boolean(merged.startupLaunchEnabled);
  merged.startHidden = Boolean(merged.startHidden);
  merged.bridgeAutostart = Boolean(merged.bridgeAutostart);
  merged.bridgeEnabled = Boolean(merged.bridgeEnabled);
  merged.minimizeToTaskbarOnClose = Boolean(merged.minimizeToTaskbarOnClose);
  merged.donorReportsOnly = true;
  merged.backgroundBackupEnabled = Boolean(merged.backgroundBackupEnabled);
  merged.backgroundBackupIncludeLogs = Boolean(merged.backgroundBackupIncludeLogs);
  merged.ollamaRuntimeMode = sanitizeOllamaRuntimeMode(merged.ollamaRuntimeMode);
  merged.ollamaExecutablePath = String(merged.ollamaExecutablePath || DEFAULT_CONFIG.ollamaExecutablePath).trim() || DEFAULT_CONFIG.ollamaExecutablePath;

  const defaultBackupDir = path.join(app.getPath("documents"), "OyamaBridgeBackups");
  merged.backgroundBackupDirectory = String(merged.backgroundBackupDirectory || defaultBackupDir).trim() || defaultBackupDir;

  merged.bridgePort = Number.isInteger(Number(merged.bridgePort)) ? Number(merged.bridgePort) : 43110;
  if (merged.bridgePort < 1024 || merged.bridgePort > 65535) {
    merged.bridgePort = 43110;
  }

  merged.backgroundBackupIntervalHours = Number.isInteger(Number(merged.backgroundBackupIntervalHours))
    ? Number(merged.backgroundBackupIntervalHours)
    : 24;
  merged.backgroundBackupIntervalHours = Math.min(168, Math.max(1, merged.backgroundBackupIntervalHours));

  merged.backgroundBackupRetentionDays = Number.isInteger(Number(merged.backgroundBackupRetentionDays))
    ? Number(merged.backgroundBackupRetentionDays)
    : 30;
  merged.backgroundBackupRetentionDays = Math.min(365, Math.max(1, merged.backgroundBackupRetentionDays));

  merged.bridgeTemperature = Number.isFinite(Number(merged.bridgeTemperature))
    ? Number(merged.bridgeTemperature)
    : 0.3;
  merged.bridgeTemperature = Math.min(2, Math.max(0, merged.bridgeTemperature));

  merged.bridgeTimeoutMs = Number.isFinite(Number(merged.bridgeTimeoutMs))
    ? Math.round(Number(merged.bridgeTimeoutMs))
    : 180000;
  if (merged.bridgeTimeoutMs === 30000 || merged.bridgeTimeoutMs === 36500) {
    merged.bridgeTimeoutMs = 180000;
  }
  merged.bridgeTimeoutMs = Math.min(600000, Math.max(3650, merged.bridgeTimeoutMs));

  // Ollama inference performance settings
  merged.ollamaNumGpuLayers = Number.isInteger(Number(merged.ollamaNumGpuLayers))
    ? Math.max(0, Number(merged.ollamaNumGpuLayers))
    : 999;

  merged.ollamaMaxLoadedModels = Number.isInteger(Number(merged.ollamaMaxLoadedModels))
    ? Math.min(4, Math.max(1, Number(merged.ollamaMaxLoadedModels)))
    : 1;

  // -1 means "keep loaded indefinitely"; 0+ is seconds
  merged.ollamaKeepAliveSeconds = Number.isFinite(Number(merged.ollamaKeepAliveSeconds))
    ? Math.max(-1, Math.round(Number(merged.ollamaKeepAliveSeconds)))
    : -1;

  // 0 = auto-detect; positive = explicit thread count (capped at 64)
  merged.ollamaNumThreads = Number.isInteger(Number(merged.ollamaNumThreads))
    ? Math.min(64, Math.max(0, Number(merged.ollamaNumThreads)))
    : 0;

  merged.bridgeSystemPromptBase = String(merged.bridgeSystemPromptBase || DEFAULT_CONFIG.bridgeSystemPromptBase)
    .trim()
    .slice(0, 8000);
  if (!merged.bridgeSystemPromptBase) {
    merged.bridgeSystemPromptBase = DEFAULT_CONFIG.bridgeSystemPromptBase;
  }

  merged.bridgeInternalChatPrompt = String(merged.bridgeInternalChatPrompt || DEFAULT_CONFIG.bridgeInternalChatPrompt)
    .trim()
    .slice(0, 8000);
  if (!merged.bridgeInternalChatPrompt) {
    merged.bridgeInternalChatPrompt = DEFAULT_CONFIG.bridgeInternalChatPrompt;
  }

  return merged;
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw);
    const sanitized = sanitizeConfig(parsed);
    return sanitized;
  } catch {
    const fallback = sanitizeConfig(DEFAULT_CONFIG);
    writeConfig(fallback);
    return fallback;
  }
}

function writeConfig(nextConfig) {
  const sanitized = sanitizeConfig(nextConfig);
  fs.writeFileSync(getConfigPath(), JSON.stringify(sanitized, null, 2), "utf8");
  return sanitized;
}

function normalizeHttpUrl(rawValue, { allowEmpty = false } = {}) {
  const text = String(rawValue || "").trim();
  if (!text) {
    if (allowEmpty) return "";
    throw new Error("A valid http/https URL is required.");
  }

  const parsed = new URL(text);
  if (!parsed.protocol.startsWith("http")) {
    throw new Error("Only http/https URLs are supported.");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function getLanIpv4Addresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];

  Object.values(interfaces).forEach((entries) => {
    (entries || []).forEach((entry) => {
      if (!entry || entry.internal) return;
      const family = typeof entry.family === "string" ? entry.family : String(entry.family);
      if (family !== "IPv4") return;
      addresses.push(entry.address);
    });
  });

  return Array.from(new Set(addresses));
}

function fetchPublicIpv4() {
  return new Promise((resolve) => {
    const req = https.get("https://api.ipify.org?format=json", { timeout: 2500 }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(chunk));
      response.on("end", () => {
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          const ip = typeof payload.ip === "string" ? payload.ip.trim() : "";
          resolve(ip || null);
        } catch {
          resolve(null);
        }
      });
    });

    req.on("timeout", () => {
      req.destroy();
      resolve(null);
    });

    req.on("error", () => {
      resolve(null);
    });
  });
}

function parseNumberOrNull(value) {
  const parsed = Number(String(value || "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function getCudaVisibleDevicesHint(config) {
  const selected = String(config.bridgeCudaDevice || "auto").trim().toLowerCase();
  if (!selected || selected === "auto") return "";
  return `CUDA_VISIBLE_DEVICES=${selected}`;
}

function queryGpuTelemetry() {
  return new Promise((resolve) => {
    const mergeGpuListFallback = (devices) => {
      if (!devices.length || devices.every((device) => device.uuid)) {
        resolve(devices);
        return;
      }

      execFile("nvidia-smi", ["-L"], { timeout: 2500 }, (_error, listStdout) => {
        const fallbackDevices = parseGpuListOutput(listStdout);

        resolve(devices.map((device) => {
          const fallback = fallbackDevices.find((item) => item.index === device.index);
          return {
            ...device,
            uuid: device.uuid || fallback?.uuid || "",
            name: device.name || fallback?.name || `GPU ${device.index}`,
          };
        }));
      });
    };

    execFile(
      "nvidia-smi",
      ["--query-gpu=index,uuid,name,utilization.gpu,temperature.gpu,memory.used,memory.total,power.draw", "--format=csv,noheader,nounits"],
      { timeout: 2500 },
      (error, stdout) => {
        if (error) {
          execFile("nvidia-smi", ["-L"], { timeout: 2500 }, (_listError, listStdout) => {
            resolve(parseGpuListOutput(listStdout));
          });
          return;
        }

        const devices = parseGpuTelemetryCsv(stdout);

        mergeGpuListFallback(devices);
      }
    );
  });
}

function listCudaDevices() {
  return queryGpuTelemetry();
}

function toPublicConfig(config) {
  const safe = sanitizeConfig(config);
  return {
    ...safe,
    donorReportsOnly: true,
  };
}

function toBackgroundToolsState(config) {
  const safe = sanitizeConfig(config);
  return {
    enabled: Boolean(safe.backgroundBackupEnabled),
    backupDirectory: String(safe.backgroundBackupDirectory || ""),
    intervalHours: Number(safe.backgroundBackupIntervalHours || 24),
    retentionDays: Number(safe.backgroundBackupRetentionDays || 30),
    includeLogs: Boolean(safe.backgroundBackupIncludeLogs),
    lastRunAt: String(backupRuntimeState.lastRunAt || ""),
    lastFilePath: String(backupRuntimeState.lastFilePath || ""),
    lastStatus: String(backupRuntimeState.lastStatus || "Idle"),
    lastError: String(backupRuntimeState.lastError || ""),
  };
}

function pruneOldBackupFiles(directory, retentionDays) {
  const dir = String(directory || "").trim();
  if (!dir) return;

  const cutoffMs = Date.now() - (Number(retentionDays || 30) * 24 * 60 * 60 * 1000);
  const files = fs.readdirSync(dir, { withFileTypes: true });

  files.forEach((entry) => {
    if (!entry.isFile() || !entry.name.endsWith(".obkp")) return;
    const fullPath = path.join(dir, entry.name);
    try {
      const stats = fs.statSync(fullPath);
      if (stats.mtimeMs < cutoffMs) {
        fs.unlinkSync(fullPath);
      }
    } catch {
      // Keep best-effort cleanup only.
    }
  });
}

function buildSecureBackupPayload(config) {
  const runtimeSnapshot = bridgeManager
    ? bridgeManager.getRuntimeState()
    : { running: false, startedAt: null, uptimeMs: 0, requestCount: 0, lastError: null, requestLog: [], errorLog: [] };

  const includeLogs = Boolean(config.backgroundBackupIncludeLogs);
  const runtime = includeLogs
    ? runtimeSnapshot
    : {
      running: runtimeSnapshot.running,
      startedAt: runtimeSnapshot.startedAt,
      uptimeMs: runtimeSnapshot.uptimeMs,
      requestCount: runtimeSnapshot.requestCount,
      lastError: runtimeSnapshot.lastError,
    };

  return {
    kind: "oyama.bridge.secure-backup",
    version: 1,
    createdAt: new Date().toISOString(),
    app: {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
    },
    config,
    runtime,
    notes: [
      "Bridge secure backup snapshot for operational recovery.",
      "TODO: attach dedicated CRM database backup adapters when available.",
    ],
  };
}

function encryptBackup(payload, passphrase) {
  const json = JSON.stringify(payload);
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.scryptSync(passphrase, salt, 32);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    kind: "oyama.bridge.secure-backup.encrypted",
    version: 1,
    encryptedAt: new Date().toISOString(),
    algorithm: "aes-256-gcm",
    kdf: "scrypt",
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    authTag: authTag.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

function runSecureBackupNow(passphraseRaw) {
  const passphrase = String(passphraseRaw || "");
  if (passphrase.length < 10) {
    throw new Error("Passphrase must be at least 10 characters for secure backup encryption.");
  }

  const config = sanitizeConfig(readConfig());
  const backupDir = String(config.backgroundBackupDirectory || "").trim();
  if (!backupDir) {
    throw new Error("Backup directory is not configured.");
  }

  fs.mkdirSync(backupDir, { recursive: true });
  const payload = buildSecureBackupPayload(config);
  const encrypted = encryptBackup(payload, passphrase);

  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const outputFile = path.join(backupDir, `oyama-bridge-backup-${stamp}.obkp`);
  fs.writeFileSync(outputFile, JSON.stringify(encrypted, null, 2), "utf8");

  pruneOldBackupFiles(backupDir, config.backgroundBackupRetentionDays);

  backupRuntimeState = {
    lastRunAt: new Date().toISOString(),
    lastFilePath: outputFile,
    lastStatus: "Success",
    lastError: "",
  };

  return outputFile;
}

async function buildBridgeState() {
  const config = readConfig();
  const runtime = bridgeManager
    ? bridgeManager.getRuntimeState()
    : { running: false, startedAt: null, uptimeMs: 0, requestCount: 0, lastError: null, requestLog: [] };
  const ollama = ollamaRuntimeManager
    ? await ollamaRuntimeManager.refreshHealth()
    : {
      mode: sanitizeOllamaRuntimeMode(config.ollamaRuntimeMode),
      status: "idle",
      running: false,
      ready: false,
      healthOk: false,
      selectedGpu: String(config.bridgeCudaDevice || "auto"),
      envHint: String(config.bridgeCudaDevice || "auto") === "auto"
        ? "Automatic GPU selection"
        : `CUDA_VISIBLE_DEVICES=${String(config.bridgeCudaDevice || "auto")}`,
      upstreamUrl: String(config.bridgeUpstreamUrl || "http://127.0.0.1:11434"),
      executablePath: String(config.ollamaExecutablePath || "ollama"),
      pid: null,
      version: "",
      managedByApp: false,
      startedAt: "",
      lastError: "",
      lastExitCode: null,
      lastExitSignal: "",
      lastOutput: "",
    };

  const lanIps = getLanIpv4Addresses();
  const publicIp = await fetchPublicIpv4();
  const cudaDevices = await listCudaDevices();
  const selectedCudaDevice = String(config.bridgeCudaDevice || "auto");
  const localEndpoint = `http://127.0.0.1:${config.bridgePort}`;
  const lanEndpoints = lanIps.map((ip) => `http://${ip}:${config.bridgePort}`);
  const publicEndpointCandidate = publicIp ? `http://${publicIp}:${config.bridgePort}` : "";
  const endpointForCrm = String(config.bridgePublicBaseUrl || "").trim() || publicEndpointCandidate || lanEndpoints[0] || localEndpoint;

  return {
    config: toPublicConfig(config),
    runtime,
    network: {
      localEndpoint,
      lanIps,
      lanEndpoints,
      publicIp,
      publicEndpointCandidate,
      cudaDevices,
      gpuTelemetry: cudaDevices,
      selectedCudaDevice,
      cudaVisibleDevicesHint: getCudaVisibleDevicesHint(config),
    },
    ollama,
    appValues: {
      endpointUrl: endpointForCrm,
      apiKey: String(config.bridgeApiKey || ""),
      model: String(config.bridgeModel || ""),
      thinkingModel: String(config.bridgeThinkingModel || ""),
      cudaDevice: String(config.bridgeCudaDevice || "auto"),
      ollamaMode: String(config.ollamaRuntimeMode || "managed"),
      temperature: Number(config.bridgeTemperature || 0.3),
      timeoutMs: Number(config.bridgeTimeoutMs || 36500),
      systemPromptBase: String(config.bridgeSystemPromptBase || ""),
      internalChatPrompt: String(config.bridgeInternalChatPrompt || ""),
    },
  };
}

async function startBridgeStack() {
  if (!bridgeManager) {
    bridgeManager = createBridgeServer(() => readConfig(), { onEvent: emitBridgeEvent });
  }

  if (!ollamaRuntimeManager) {
    ollamaRuntimeManager = createOllamaRuntimeManager(() => readConfig(), { onEvent: emitBridgeEvent });
  }

  const current = readConfig();
  if (!current.bridgeEnabled) {
    writeConfig({ ...current, bridgeEnabled: true });
  }

  if (sanitizeOllamaRuntimeMode(current.ollamaRuntimeMode) === "managed") {
    await ollamaRuntimeManager.start();
  } else {
    await ollamaRuntimeManager.refreshHealth();
  }

  await bridgeManager.start();
  scheduleIdleVramClear();
  updateTrayMenu();
  return buildBridgeState();
}

async function stopBridgeStack(options = {}) {
  if (!bridgeManager) {
    bridgeManager = createBridgeServer(() => readConfig(), { onEvent: emitBridgeEvent });
  }

  if (!ollamaRuntimeManager) {
    ollamaRuntimeManager = createOllamaRuntimeManager(() => readConfig(), { onEvent: emitBridgeEvent });
  }

  const disableBridge = options.disableBridge !== false;
  const current = readConfig();
  if (disableBridge && current.bridgeEnabled) {
    writeConfig({ ...current, bridgeEnabled: false });
  }

  clearVramIdleTimer();
  await clearVramNow("bridge-stop");

  await bridgeManager.stop();

  if (sanitizeOllamaRuntimeMode(current.ollamaRuntimeMode) === "managed") {
    await ollamaRuntimeManager.stop();
  } else {
    await ollamaRuntimeManager.refreshHealth();
  }

  updateTrayMenu();
  return buildBridgeState();
}

function getPreferredTrayIconPath() {
  const candidates = [
    path.join(__dirname, "assets", "icon.ico"),
    path.join(__dirname, "assets", "icon-tray.png"),
    path.join(__dirname, "assets", "icon.png"),
    path.join(__dirname, "..", "Desktopapp", "assets", "icon.ico"),
    path.join(__dirname, "..", "Desktopapp", "assets", "icon.png"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

// Builds a 32×32 RGBA PNG in-memory — used as tray icon when no file is found.
// Pure Node.js, no canvas or external deps needed.
function buildFallbackTrayImage() {
  const SIZE = 32;
  const BG_R = 22, BG_G = 163, BG_B = 74; // Oyama green #16a34a
  const pixels = new Uint8Array(SIZE * SIZE * 4);
  const cx = (SIZE - 1) / 2;
  const cy = (SIZE - 1) / 2;
  const cornerR = SIZE * 0.18;
  const ringOuter = SIZE * 0.32;
  const ringInner = SIZE * 0.19;

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const off = (y * SIZE + x) * 4;
      // Rounded rectangle bounds check
      const inRect = (() => {
        if (x < cornerR && y < cornerR) return (x - cornerR) ** 2 + (y - cornerR) ** 2 <= cornerR * cornerR;
        if (x > SIZE - 1 - cornerR && y < cornerR) return (x - (SIZE - 1 - cornerR)) ** 2 + (y - cornerR) ** 2 <= cornerR * cornerR;
        if (x < cornerR && y > SIZE - 1 - cornerR) return (x - cornerR) ** 2 + (y - (SIZE - 1 - cornerR)) ** 2 <= cornerR * cornerR;
        if (x > SIZE - 1 - cornerR && y > SIZE - 1 - cornerR) return (x - (SIZE - 1 - cornerR)) ** 2 + (y - (SIZE - 1 - cornerR)) ** 2 <= cornerR * cornerR;
        return true;
      })();

      if (!inRect) { pixels[off + 3] = 0; continue; }

      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (dist >= ringInner && dist <= ringOuter) {
        // White ring
        pixels[off] = 255; pixels[off + 1] = 255; pixels[off + 2] = 255; pixels[off + 3] = 255;
      } else {
        // Green background
        pixels[off] = BG_R; pixels[off + 1] = BG_G; pixels[off + 2] = BG_B; pixels[off + 3] = 255;
      }
    }
  }

  // Build a minimal valid PNG from raw RGBA pixels
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c;
    }
    return t;
  })();
  const crc32png = (buf) => {
    let crc = 0xffffffff;
    for (let i = 0; i < buf.length; i++) crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type, data) => {
    const t = Buffer.from(type, "ascii");
    const l = Buffer.alloc(4); l.writeUInt32BE(data.length);
    const c = Buffer.alloc(4); c.writeUInt32BE(crc32png(Buffer.concat([t, data])));
    return Buffer.concat([l, t, data, c]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(SIZE, 0); ihdr.writeUInt32BE(SIZE, 4);
  ihdr.writeUInt8(8, 8); ihdr.writeUInt8(6, 9); // 8-bit RGBA

  const rowBytes = 1 + SIZE * 4;
  const raw = Buffer.alloc(SIZE * rowBytes, 0);
  for (let y = 0; y < SIZE; y++) {
    raw[y * rowBytes] = 0;
    for (let x = 0; x < SIZE; x++) {
      const s = (y * SIZE + x) * 4;
      const d = y * rowBytes + 1 + x * 4;
      raw[d] = pixels[s]; raw[d + 1] = pixels[s + 1]; raw[d + 2] = pixels[s + 2]; raw[d + 3] = pixels[s + 3];
    }
  }

  const idat = zlib.deflateSync(raw, { level: 1 });
  const pngBuf = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  return nativeImage.createFromBuffer(pngBuf, { scaleFactor: 1 });
}

function emitBridgeEvent(payload) {
  if (payload && payload.type === "request" && payload.entry) {
    try {
      recordUsageEntry(payload.entry);
      if (shouldCountAsModelActivity(payload.entry)) {
        scheduleIdleVramClear();
      }
    } catch {
      // Never block bridge event flow on usage ledger writes.
    }
  }

  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("oyama-bridge:event", payload);
}

function hideWindowToTray(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return false;
  const trayInstance = createTray();
  if (!trayInstance) {
    // Packaged fallback: never hide the app if tray support is unavailable.
    targetWindow.setSkipTaskbar(false);
    targetWindow.minimize();
    return false;
  }

  targetWindow.setSkipTaskbar(true);
  targetWindow.hide();
  return true;
}

function showWindowFromTray() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow(true);
    return;
  }

  mainWindow.setSkipTaskbar(false);
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function showWindowAndNavigate(page) {
  showWindowFromTray();
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("oyama-bridge:event", {
    type: "navigate",
    page: String(page || "dashboard"),
  });
}

function requestAppQuit() {
  isAppQuitting = true;
  app.quit();
}

function createTray() {
  if (tray) return tray;

  const iconPath = getPreferredTrayIconPath();
  // Fall back to a programmatically generated PNG when no icon file exists.
  // SVG data URLs are NOT supported by Electron's nativeImage on Windows — use PNG instead.
  const image = iconPath
    ? nativeImage.createFromPath(iconPath)
    : buildFallbackTrayImage();
  if (image.isEmpty()) return null;

  tray = new Tray(image);
  updateTrayMenu();
  tray.on("click", showWindowFromTray);
  tray.on("double-click", showWindowFromTray);

  return tray;
}

function getTrayRuntimeLabel() {
  const config = readConfig();
  const runtime = bridgeManager ? bridgeManager.getRuntimeState() : { running: false };
  const endpoint = `http://127.0.0.1:${config.bridgePort}`;
  return {
    running: Boolean(runtime.running),
    endpoint,
    tooltip: `Oyama Bridge - ${runtime.running ? "Running" : "Stopped"} - ${endpoint}`,
  };
}

function updateTrayMenu() {
  if (!tray) return;
  const state = getTrayRuntimeLabel();
  tray.setToolTip(state.tooltip);
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Dashboard",
      click: showWindowFromTray,
    },
    {
      label: "Open Request Flow",
      click: () => showWindowAndNavigate("requests"),
    },
    {
      label: "Open Generated Log",
      click: () => showWindowAndNavigate("generated"),
    },
    {
      label: state.running ? `Running on ${state.endpoint}` : `Stopped - ${state.endpoint}`,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Start Bridge",
      enabled: !state.running,
      click: async () => {
        try {
          if (bridgeManager) {
            await bridgeManager.start();
            updateTrayMenu();
          }
        } catch {
          // Ignore tray action errors.
        }
      },
    },
    {
      label: "Stop Bridge",
      enabled: state.running,
      click: async () => {
        try {
          if (bridgeManager) {
            await bridgeManager.stop();
            updateTrayMenu();
          }
        } catch {
          // Ignore tray action errors.
        }
      },
    },
    {
      label: "Hide Dashboard to Tray",
      enabled: Boolean(mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()),
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          hideWindowToTray(mainWindow);
        }
      },
    },
    { type: "separator" },
    { label: "Quit Oyama Bridge", click: requestAppQuit },
  ]);

  tray.setContextMenu(contextMenu);
}

function createMainWindow(showImmediately = true) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (showImmediately) {
      mainWindow.setSkipTaskbar(false);
      mainWindow.show();
    }
    mainWindow.focus();
    return mainWindow;
  }

  const iconPath = getPreferredTrayIconPath() || undefined;

  mainWindow = new BrowserWindow({
    width: 1240,
    height: 840,
    minWidth: 980,
    minHeight: 680,
    frame: false,
    backgroundColor: "#eef2f7",
    title: "Oyama Bridge",
    icon: iconPath,
    show: Boolean(showImmediately),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));

  if (!showImmediately) {
    mainWindow.setSkipTaskbar(true);
  }

  mainWindow.on("minimize", (event) => {
    const config = readConfig();
    if (!config.minimizeToTaskbarOnClose) {
      return;
    }

    event.preventDefault();
    hideWindowToTray(mainWindow);
  });

  mainWindow.on("close", (event) => {
    if (isAppQuitting) {
      return;
    }

    const config = readConfig();
    if (config.minimizeToTaskbarOnClose) {
      event.preventDefault();
      hideWindowToTray(mainWindow);
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function getStartupSettings() {
  const loginItemSettings = app.getLoginItemSettings();
  const config = readConfig();

  return {
    openAtLogin: Boolean(loginItemSettings.openAtLogin),
    wasOpenedAtLogin: Boolean(loginItemSettings.wasOpenedAtLogin),
    startupLaunchEnabled: Boolean(config.startupLaunchEnabled),
    startHidden: Boolean(config.startHidden),
    bridgeAutostart: Boolean(config.bridgeAutostart),
  };
}

function applyStartupSettings(settings) {
  const openAtLogin = Boolean(settings.startupLaunchEnabled);
  const startHidden = Boolean(settings.startHidden);

  const args = ["--bridge"];
  if (startHidden) {
    args.push("--start-hidden");
  }

  app.setLoginItemSettings({
    openAtLogin,
    openAsHidden: startHidden,
    args,
  });
}

ipcMain.handle("oyama-bridge:get-config", () => {
  return readConfig();
});

ipcMain.handle("oyama-bridge:get-bridge-state", async () => {
  return buildBridgeState();
});

ipcMain.handle("oyama-bridge:get-gpu-telemetry", async () => {
  const config = readConfig();
  const gpuTelemetry = await queryGpuTelemetry();
  return {
    gpuTelemetry,
    selectedCudaDevice: String(config.bridgeCudaDevice || "auto"),
    cudaVisibleDevicesHint: getCudaVisibleDevicesHint(config),
  };
});

ipcMain.handle("oyama-bridge:get-usage-history", () => {
  return buildUsageHistoryResponse();
});

ipcMain.handle("oyama-bridge:get-startup-settings", () => {
  return getStartupSettings();
});

ipcMain.handle("oyama-bridge:get-background-tools", () => {
  const config = readConfig();
  return toBackgroundToolsState(config);
});

ipcMain.handle("oyama-bridge:set-background-tools", async (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Background tools payload is required." };
  }

  const current = readConfig();
  const next = {
    ...current,
    backgroundBackupEnabled: Object.prototype.hasOwnProperty.call(payload, "enabled")
      ? Boolean(payload.enabled)
      : current.backgroundBackupEnabled,
    backgroundBackupIncludeLogs: Object.prototype.hasOwnProperty.call(payload, "includeLogs")
      ? Boolean(payload.includeLogs)
      : current.backgroundBackupIncludeLogs,
  };

  if (Object.prototype.hasOwnProperty.call(payload, "backupDirectory")) {
    const rawDir = String(payload.backupDirectory || "").trim();
    if (!rawDir) {
      return { ok: false, message: "Backup directory is required." };
    }
    next.backgroundBackupDirectory = path.resolve(rawDir);
  }

  if (Object.prototype.hasOwnProperty.call(payload, "intervalHours")) {
    const intervalHours = Number(payload.intervalHours);
    if (!Number.isInteger(intervalHours) || intervalHours < 1 || intervalHours > 168) {
      return { ok: false, message: "Backup interval must be between 1 and 168 hours." };
    }
    next.backgroundBackupIntervalHours = intervalHours;
  }

  if (Object.prototype.hasOwnProperty.call(payload, "retentionDays")) {
    const retentionDays = Number(payload.retentionDays);
    if (!Number.isInteger(retentionDays) || retentionDays < 1 || retentionDays > 365) {
      return { ok: false, message: "Backup retention must be between 1 and 365 days." };
    }
    next.backgroundBackupRetentionDays = retentionDays;
  }

  const saved = writeConfig(next);

  return {
    ok: true,
    tools: toBackgroundToolsState(saved),
    state: await buildBridgeState(),
  };
});

ipcMain.handle("oyama-bridge:run-secure-backup", async (_event, payload) => {
  const passphrase = payload && typeof payload === "object" ? payload.passphrase : "";
  try {
    const outputFile = runSecureBackupNow(passphrase);
    return {
      ok: true,
      filePath: outputFile,
      tools: toBackgroundToolsState(readConfig()),
      state: await buildBridgeState(),
    };
  } catch (error) {
    backupRuntimeState = {
      ...backupRuntimeState,
      lastRunAt: new Date().toISOString(),
      lastStatus: "Failed",
      lastError: error instanceof Error ? error.message : "Backup failed.",
    };

    return {
      ok: false,
      message: error instanceof Error ? error.message : "Backup failed.",
      tools: toBackgroundToolsState(readConfig()),
      state: await buildBridgeState(),
    };
  }
});

ipcMain.handle("oyama-bridge:set-startup-settings", async (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Startup settings payload is required." };
  }

  const current = readConfig();
  const next = {
    ...current,
    startupLaunchEnabled: Object.prototype.hasOwnProperty.call(payload, "startupLaunchEnabled")
      ? Boolean(payload.startupLaunchEnabled)
      : current.startupLaunchEnabled,
    startHidden: Object.prototype.hasOwnProperty.call(payload, "startHidden")
      ? Boolean(payload.startHidden)
      : current.startHidden,
    bridgeAutostart: Object.prototype.hasOwnProperty.call(payload, "bridgeAutostart")
      ? Boolean(payload.bridgeAutostart)
      : current.bridgeAutostart,
  };

  writeConfig(next);
  applyStartupSettings(next);

  return {
    ok: true,
    startup: getStartupSettings(),
    state: await buildBridgeState(),
  };
});

ipcMain.handle("oyama-bridge:set-config", async (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Bridge settings payload is required." };
  }

  const current = readConfig();
  const next = { ...current };

  try {
    if (Object.prototype.hasOwnProperty.call(payload, "crmSiteUrl")) {
      next.crmSiteUrl = normalizeHttpUrl(payload.crmSiteUrl, { allowEmpty: true });
    }

    if (Object.prototype.hasOwnProperty.call(payload, "minimizeToTaskbarOnClose")) {
      next.minimizeToTaskbarOnClose = Boolean(payload.minimizeToTaskbarOnClose);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeEnabled")) {
      next.bridgeEnabled = Boolean(payload.bridgeEnabled);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeAutostart")) {
      next.bridgeAutostart = Boolean(payload.bridgeAutostart);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeUpstreamUrl")) {
      next.bridgeUpstreamUrl = normalizeHttpUrl(payload.bridgeUpstreamUrl);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgePort")) {
      const parsedPort = Number(payload.bridgePort);
      if (!Number.isInteger(parsedPort) || parsedPort < 1024 || parsedPort > 65535) {
        return { ok: false, message: "Bridge port must be an integer between 1024 and 65535." };
      }
      next.bridgePort = parsedPort;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeApiKey")) {
      const apiKey = String(payload.bridgeApiKey || "").trim();
      if (apiKey.length < 12) {
        return { ok: false, message: "API key must be at least 12 characters." };
      }
      next.bridgeApiKey = apiKey;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeAllowedOrigins")) {
      next.bridgeAllowedOrigins = String(payload.bridgeAllowedOrigins || "").trim();
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgePublicBaseUrl")) {
      next.bridgePublicBaseUrl = normalizeHttpUrl(payload.bridgePublicBaseUrl, { allowEmpty: true });
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeDomainUrl")) {
      next.bridgeDomainUrl = normalizeHttpUrl(payload.bridgeDomainUrl, { allowEmpty: true });
    }

    if (Object.prototype.hasOwnProperty.call(payload, "ollamaRuntimeMode")) {
      next.ollamaRuntimeMode = sanitizeOllamaRuntimeMode(payload.ollamaRuntimeMode);
    }

    if (Object.prototype.hasOwnProperty.call(payload, "ollamaExecutablePath")) {
      const executablePath = String(payload.ollamaExecutablePath || "").trim();
      if (!executablePath) {
        return { ok: false, message: "Ollama executable path is required." };
      }
      next.ollamaExecutablePath = executablePath;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeModel")) {
      next.bridgeModel = String(payload.bridgeModel || "").trim() || current.bridgeModel;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeThinkingModel")) {
      next.bridgeThinkingModel = String(payload.bridgeThinkingModel || "").trim() || current.bridgeThinkingModel;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeSystemPromptBase")) {
      next.bridgeSystemPromptBase = String(payload.bridgeSystemPromptBase || "").trim() || current.bridgeSystemPromptBase;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeInternalChatPrompt")) {
      next.bridgeInternalChatPrompt = String(payload.bridgeInternalChatPrompt || "").trim() || current.bridgeInternalChatPrompt;
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeCudaDevice")) {
      const rawCuda = String(payload.bridgeCudaDevice || "auto").trim().toLowerCase();
      if (rawCuda === "auto") {
        next.bridgeCudaDevice = "auto";
      } else {
        const parsedCuda = Number(rawCuda);
        if (!Number.isInteger(parsedCuda) || parsedCuda < 0) {
          return { ok: false, message: "CUDA device must be auto or a non-negative GPU index." };
        }
        next.bridgeCudaDevice = String(parsedCuda);
      }
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeTemperature")) {
      const temperature = Number(payload.bridgeTemperature);
      if (!Number.isFinite(temperature) || temperature < 0 || temperature > 2) {
        return { ok: false, message: "Temperature must be between 0 and 2." };
      }
      next.bridgeTemperature = Number(temperature.toFixed(2));
    }

    if (Object.prototype.hasOwnProperty.call(payload, "bridgeTimeoutMs")) {
      const timeoutMs = Number(payload.bridgeTimeoutMs);
      if (!Number.isFinite(timeoutMs) || timeoutMs < 3650 || timeoutMs > 120000) {
        return { ok: false, message: "Timeout must be between 3650 and 120000 ms." };
      }
      next.bridgeTimeoutMs = Math.round(timeoutMs);
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Bridge settings are invalid.",
    };
  }

  const wasRunning = Boolean(bridgeManager && bridgeManager.getRuntimeState().running);
  writeConfig(next);

  try {
    if (bridgeManager && bridgeManager.getRuntimeState().running) {
      await bridgeManager.stop();
    }

    if (ollamaRuntimeManager) {
      await ollamaRuntimeManager.stop();
    }

    if (wasRunning && next.bridgeEnabled) {
      await startBridgeStack();
    } else if (ollamaRuntimeManager) {
      await ollamaRuntimeManager.refreshHealth();
    }
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Bridge failed to restart with the updated settings.",
      state: await buildBridgeState(),
    };
  }

  emitBridgeEvent({ type: "config", config: toPublicConfig(next) });
  updateTrayMenu();

  return {
    ok: true,
    state: await buildBridgeState(),
  };
});

ipcMain.handle("oyama-bridge:build-pairing", async (_event, payload) => {
  try {
    const config = readConfig();
    const pairing = buildPairingBundle(config, payload && typeof payload === "object" ? payload : {});
    return {
      ok: true,
      pairing,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Failed to build pairing key.",
    };
  }
});

ipcMain.handle("oyama-bridge:chat", async (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Chat payload is required." };
  }

  const prompt = String(payload.prompt || "").trim();
  if (!prompt) {
    return { ok: false, message: "Prompt is required." };
  }

  const config = readConfig();
  if (!bridgeManager) {
    bridgeManager = createBridgeServer(() => readConfig(), { onEvent: emitBridgeEvent });
  }

  if (!ollamaRuntimeManager) {
    ollamaRuntimeManager = createOllamaRuntimeManager(() => readConfig(), { onEvent: emitBridgeEvent });
  }

  if (!bridgeManager.getRuntimeState().running) {
    try {
      await startBridgeStack();
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : "Bridge is not running.",
      };
    }
  }

  const runtime = bridgeManager.getRuntimeState();
  const contextLines = [
    `Bridge running: ${runtime.running}`,
    `Bridge request count: ${runtime.requestCount}`,
    `Bridge last error: ${runtime.lastError || "none"}`,
    `Bridge upstream: ${config.bridgeUpstreamUrl}`,
  ];

  const systemPrompt = [
    config.bridgeSystemPromptBase,
    config.bridgeInternalChatPrompt,
    "Use live bridge telemetry context below before answering.",
    contextLines.join("\n"),
  ].filter(Boolean).join("\n\n");

  const endpoint = `http://127.0.0.1:${config.bridgePort}/api/chat`;
  const requestBody = {
    model: config.bridgeModel,
    stream: false,
    options: {
      temperature: Number(config.bridgeTemperature || 0.3),
    },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  };

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.bridgeApiKey}`,
      },
      body: JSON.stringify(requestBody),
    });

    const rawText = await response.text();
    if (!response.ok) {
      return {
        ok: false,
        message: `Bridge chat failed (${response.status}). ${rawText || ""}`.trim(),
      };
    }

    let parsed = null;
    try {
      parsed = rawText ? JSON.parse(rawText) : null;
    } catch {
      parsed = null;
    }

    const reply = (parsed && parsed.message && typeof parsed.message.content === "string")
      ? parsed.message.content
      : (parsed && typeof parsed.response === "string" ? parsed.response : rawText);

    return {
      ok: true,
      reply: String(reply || "").trim(),
      raw: parsed || rawText,
      state: await buildBridgeState(),
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Bridge chat request failed.",
      state: await buildBridgeState(),
    };
  }
});

ipcMain.handle("oyama-bridge:start", async () => {
  try {
    return { ok: true, state: await startBridgeStack() };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Bridge failed to start.",
      state: await buildBridgeState(),
    };
  }
});

ipcMain.handle("oyama-bridge:stop", async () => {
  return { ok: true, state: await stopBridgeStack() };
});

ipcMain.on("oyama-bridge:window-minimize", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow && !senderWindow.isDestroyed()) {
    const config = readConfig();
    if (config.minimizeToTaskbarOnClose) {
      hideWindowToTray(senderWindow);
      return;
    }

    senderWindow.minimize();
  }
});

ipcMain.on("oyama-bridge:window-toggle-maximize", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow || senderWindow.isDestroyed()) return;

  if (senderWindow.isMaximized()) {
    senderWindow.unmaximize();
  } else {
    senderWindow.maximize();
  }
});

ipcMain.on("oyama-bridge:window-close", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow || senderWindow.isDestroyed()) return;

  const config = readConfig();
  if (config.minimizeToTaskbarOnClose) {
    hideWindowToTray(senderWindow);
    return;
  }

  senderWindow.close();
});

ipcMain.on("oyama-bridge:app-quit", () => {
  requestAppQuit();
});

ipcMain.handle("oyama-bridge:window-is-maximized", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  return Boolean(senderWindow && !senderWindow.isDestroyed() && senderWindow.isMaximized());
});

app.whenReady().then(() => {
  bridgeManager = createBridgeServer(() => readConfig(), { onEvent: emitBridgeEvent });
  ollamaRuntimeManager = createOllamaRuntimeManager(() => readConfig(), { onEvent: emitBridgeEvent });

  const initialConfig = readConfig();
  applyStartupSettings(initialConfig);

  if (initialConfig.bridgeAutostart || initialConfig.bridgeEnabled) {
    startBridgeStack().catch(() => {
      // Runtime issues are shown in renderer state.
    }).finally(() => {
      updateTrayMenu();
    });
  }

  const loginSettings = app.getLoginItemSettings();
  const launchedWithStartHidden = process.argv.includes("--start-hidden");
  const shouldStartHidden = launchedWithStartHidden || (initialConfig.startHidden && loginSettings.wasOpenedAtLogin);

  // Service-style behavior: initialize tray support before the dashboard is shown or hidden.
  if (initialConfig.startHidden || initialConfig.minimizeToTaskbarOnClose || initialConfig.bridgeAutostart) {
    createTray();
  }

  createMainWindow(!shouldStartHidden);
  if (shouldStartHidden) {
    if (mainWindow && !mainWindow.isDestroyed()) {
      hideWindowToTray(mainWindow);
    }
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow(true);
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      showWindowFromTray();
    }
  });
});

app.on("before-quit", (event) => {
  // Guard: second invocation after we call app.quit() from the async cleanup below.
  if (isAppQuitting) return;

  event.preventDefault();
  isAppQuitting = true;
  clearVramIdleTimer();

  // Force quit after 6 seconds if cleanup hangs, so the app never gets stuck.
  const forceQuitTimer = setTimeout(() => { app.quit(); }, 6000);

  (async () => {
    // Unload model from VRAM before killing the process so GPU memory is freed cleanly.
    try {
      if (ollamaRuntimeManager) await ollamaRuntimeManager.clearVram("app-quit");
    } catch {
      // Best-effort; never block quit on VRAM clear failure.
    }

    // Stop the HTTP bridge gateway first.
    try {
      if (bridgeManager) await bridgeManager.stop();
    } catch {
      // Ignore bridge stop errors.
    }

    // Kill the managed Ollama child process.
    try {
      if (ollamaRuntimeManager) await ollamaRuntimeManager.stop();
    } catch {
      // Ignore Ollama stop errors.
    }

    if (tray) {
      tray.destroy();
      tray = null;
    }

    clearTimeout(forceQuitTimer);
    app.quit();
  })();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
