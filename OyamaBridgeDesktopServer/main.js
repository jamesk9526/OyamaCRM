// Main process for standalone Oyama Bridge app.
const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } = require("electron");
const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { createBridgeServer } = require("./bridge-server");

let mainWindow = null;
let tray = null;
let bridgeManager = null;
let isAppQuitting = false;
let backupRuntimeState = {
  lastRunAt: "",
  lastFilePath: "",
  lastStatus: "Idle",
  lastError: "",
};

const DEFAULT_CONFIG = {
  crmSiteUrl: "",
  startupLaunchEnabled: false,
  startHidden: false,
  bridgeAutostart: false,
  bridgeEnabled: false,
  minimizeToTaskbarOnClose: true,
  bridgeUpstreamUrl: "http://127.0.0.1:11434",
  bridgePort: 43110,
  bridgeApiKey: "",
  bridgeAllowedOrigins: "",
  bridgePublicBaseUrl: "",
  bridgeDomainUrl: "",
  bridgeModel: "llama3.2:3b",
  bridgeThinkingModel: "deepseek-r1:8b",
  bridgeSystemPromptBase: "You are Oyama Bridge Steward assistant. Stay donor/report focused, use grounded facts, and avoid unsupported claims.",
  bridgeInternalChatPrompt: "When possible, summarize bridge runtime state, request health, and operational risks in practical terms.",
  bridgeCudaDevice: "auto",
  bridgeTemperature: 0.3,
  bridgeTimeoutMs: 36500,
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
  const ttlDays = Math.min(90, Math.max(1, Number(options.ttlDays || 14)));
  const expiresAt = new Date(now + ttlDays * 24 * 60 * 60 * 1000).toISOString();
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
    : 36500;
  merged.bridgeTimeoutMs = Math.min(120000, Math.max(3650, merged.bridgeTimeoutMs));

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

function listCudaDevices() {
  return new Promise((resolve) => {
    execFile(
      "nvidia-smi",
      ["--query-gpu=index,name,memory.total", "--format=csv,noheader"],
      { timeout: 2500 },
      (error, stdout) => {
        if (error) {
          resolve([]);
          return;
        }

        const devices = String(stdout || "")
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter(Boolean)
          .map((line) => {
            const [indexRaw, nameRaw, memoryRaw] = line.split(",").map((part) => part.trim());
            const index = Number(indexRaw);
            if (!Number.isInteger(index) || index < 0) return null;
            return {
              index,
              name: nameRaw || `GPU ${index}`,
              memory: memoryRaw || "unknown",
            };
          })
          .filter(Boolean);

        resolve(devices);
      }
    );
  });
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

  const lanIps = getLanIpv4Addresses();
  const publicIp = await fetchPublicIpv4();
  const cudaDevices = await listCudaDevices();
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
    },
    appValues: {
      endpointUrl: endpointForCrm,
      apiKey: String(config.bridgeApiKey || ""),
      model: String(config.bridgeModel || ""),
      thinkingModel: String(config.bridgeThinkingModel || ""),
      cudaDevice: String(config.bridgeCudaDevice || "auto"),
      temperature: Number(config.bridgeTemperature || 0.3),
      timeoutMs: Number(config.bridgeTimeoutMs || 36500),
      systemPromptBase: String(config.bridgeSystemPromptBase || ""),
      internalChatPrompt: String(config.bridgeInternalChatPrompt || ""),
    },
  };
}

function getPreferredTrayIconPath() {
  const candidates = [
    path.join(__dirname, "assets", "icon.ico"),
    path.join(__dirname, "..", "Desktopapp", "assets", "icon.ico"),
  ];

  return candidates.find((candidate) => fs.existsSync(candidate)) || null;
}

function emitBridgeEvent(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send("oyama-bridge:event", payload);
}

function hideWindowToTray(targetWindow) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.setSkipTaskbar(true);
  targetWindow.hide();
  createTray();
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

function requestAppQuit() {
  isAppQuitting = true;
  app.quit();
}

function createTray() {
  if (tray) return tray;

  const iconPath = getPreferredTrayIconPath();
  if (!iconPath) return null;

  const image = nativeImage.createFromPath(iconPath);
  if (image.isEmpty()) return null;

  tray = new Tray(image);
  tray.setToolTip("Oyama Bridge");

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Open Oyama Bridge",
      click: showWindowFromTray,
    },
    {
      label: "Start Bridge",
      click: async () => {
        try {
          if (bridgeManager) await bridgeManager.start();
        } catch {
          // Ignore tray action errors.
        }
      },
    },
    {
      label: "Stop Bridge",
      click: async () => {
        try {
          if (bridgeManager) await bridgeManager.stop();
        } catch {
          // Ignore tray action errors.
        }
      },
    },
    { type: "separator" },
    { label: "Quit", click: requestAppQuit },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on("double-click", showWindowFromTray);

  return tray;
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

  writeConfig(next);

  if (bridgeManager && bridgeManager.getRuntimeState().running) {
    await bridgeManager.stop();
    if (next.bridgeEnabled) {
      try {
        await bridgeManager.start();
      } catch (error) {
        return {
          ok: false,
          message: error instanceof Error ? error.message : "Bridge failed to restart with the updated settings.",
          state: await buildBridgeState(),
        };
      }
    }
  }

  emitBridgeEvent({ type: "config", config: toPublicConfig(next) });

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

  if (!bridgeManager.getRuntimeState().running) {
    try {
      await bridgeManager.start();
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
  if (!bridgeManager) {
    bridgeManager = createBridgeServer(() => readConfig(), { onEvent: emitBridgeEvent });
  }

  const current = readConfig();
  if (!current.bridgeEnabled) {
    writeConfig({ ...current, bridgeEnabled: true });
  }

  try {
    await bridgeManager.start();
    return { ok: true, state: await buildBridgeState() };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Bridge failed to start.",
      state: await buildBridgeState(),
    };
  }
});

ipcMain.handle("oyama-bridge:stop", async () => {
  if (!bridgeManager) {
    bridgeManager = createBridgeServer(() => readConfig(), { onEvent: emitBridgeEvent });
  }

  const current = readConfig();
  writeConfig({ ...current, bridgeEnabled: false });

  await bridgeManager.stop();
  return { ok: true, state: await buildBridgeState() };
});

ipcMain.on("oyama-bridge:window-minimize", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow && !senderWindow.isDestroyed()) {
    hideWindowToTray(senderWindow);
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

  const initialConfig = readConfig();
  applyStartupSettings(initialConfig);

  if (initialConfig.bridgeAutostart || initialConfig.bridgeEnabled) {
    bridgeManager.start().catch(() => {
      // Runtime issues are shown in renderer state.
    });
  }

  const loginSettings = app.getLoginItemSettings();
  const launchedWithStartHidden = process.argv.includes("--start-hidden");
  const shouldStartHidden = launchedWithStartHidden || (initialConfig.startHidden && loginSettings.wasOpenedAtLogin);

  // Security-desktop behavior: when startHidden is enabled, always initialize tray support early.
  if (initialConfig.startHidden) {
    createTray();
  }

  createMainWindow(!shouldStartHidden);
  if (shouldStartHidden) {
    createTray();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.hide();
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

app.on("before-quit", () => {
  isAppQuitting = true;

  if (bridgeManager) {
    bridgeManager.stop().catch(() => {
      // Ignore shutdown errors.
    });
  }

  if (tray) {
    tray.destroy();
    tray = null;
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
