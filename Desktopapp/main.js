// Main process for the Oyama desktop shell.
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const https = require("node:https");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const { execFile } = require("node:child_process");
const { createBridgeServer } = require("./bridge-server");

let mainWindow = null;
let bridgeWindow = null;
let bridgeManager = null;
const DEFAULT_CONFIG = {
  boundUrl: "",
  startupPage: "crm",
  shellColor: "#16a34a",
  pinEnabled: false,
  pinHash: "",
  pinLockOnStartup: true,
  pinTimeoutMinutes: 15,
  minimizeToTaskbarOnClose: true,
  bridgeEnabled: false,
  bridgeAutostart: false,
  bridgeUpstreamUrl: "http://127.0.0.1:11434",
  bridgePort: 43110,
  bridgeApiKey: "",
  bridgeAllowedOrigins: "",
  bridgePublicBaseUrl: "",
  bridgeDomainUrl: "",
  bridgeModel: "llama3.2:3b",
  bridgeThinkingModel: "deepseek-r1:8b",
  bridgeCudaDevice: "auto",
  bridgeTemperature: 0.3,
  bridgeTimeoutMs: 36500
};

function generateBridgeApiKey() {
  return `oyama-${crypto.randomBytes(18).toString("hex")}`;
}

function getConfigPath() {
  return path.join(app.getPath("userData"), "oyama-desktop-config.json");
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw);
    const merged = {
      ...DEFAULT_CONFIG,
      ...(parsed && typeof parsed === "object" ? parsed : {})
    };

    if (typeof merged.bridgeApiKey !== "string" || merged.bridgeApiKey.trim().length < 12) {
      merged.bridgeApiKey = generateBridgeApiKey();
      writeConfig(merged);
    }

    if (merged.startupPage !== "crm" && merged.startupPage !== "bridge") {
      merged.startupPage = "crm";
      writeConfig(merged);
    }

    return merged;
  } catch {
    const fallback = {
      ...DEFAULT_CONFIG,
      bridgeApiKey: generateBridgeApiKey(),
    };
    writeConfig(fallback);
    return fallback;
  }
}

function sendBridgeEventToWindow(targetWindow, payload) {
  if (!targetWindow || targetWindow.isDestroyed()) return;
  targetWindow.webContents.send("oyama:bridge-event", payload);
}

function emitBridgeEvent(payload) {
  sendBridgeEventToWindow(mainWindow, payload);
  sendBridgeEventToWindow(bridgeWindow, payload);
}

function writeConfig(nextConfig) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(nextConfig, null, 2), "utf8");
}

function normalizeHttpUrl(rawValue, { allowEmpty = false } = {}) {
  const text = String(rawValue || "").trim();
  if (!text) {
    if (allowEmpty) return "";
    throw new Error("A valid http/https URL is required.");
  }

  const parsed = new URL(text);
  if (!["http:", "https:"].includes(parsed.protocol)) {
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

function toBridgePublicConfig(config) {
  return {
    startupPage: config.startupPage === "bridge" ? "bridge" : "crm",
    minimizeToTaskbarOnClose: Boolean(config.minimizeToTaskbarOnClose),
    bridgeEnabled: Boolean(config.bridgeEnabled),
    bridgeAutostart: Boolean(config.bridgeAutostart),
    bridgeUpstreamUrl: String(config.bridgeUpstreamUrl || ""),
    bridgePort: Number(config.bridgePort || 43110),
    bridgeApiKey: String(config.bridgeApiKey || ""),
    bridgeAllowedOrigins: String(config.bridgeAllowedOrigins || ""),
    bridgePublicBaseUrl: String(config.bridgePublicBaseUrl || ""),
    bridgeDomainUrl: String(config.bridgeDomainUrl || ""),
    bridgeModel: String(config.bridgeModel || ""),
    bridgeThinkingModel: String(config.bridgeThinkingModel || ""),
    bridgeCudaDevice: String(config.bridgeCudaDevice || "auto"),
    bridgeTemperature: Number(config.bridgeTemperature || 0.3),
    bridgeTimeoutMs: Number(config.bridgeTimeoutMs || 36500),
  };
}

async function buildBridgeState() {
  const config = readConfig();
  const runtime = bridgeManager ? bridgeManager.getRuntimeState() : {
    running: false,
    startedAt: null,
    uptimeMs: 0,
    requestCount: 0,
    lastError: null,
  };

  const lanIps = getLanIpv4Addresses();
  const publicIp = await fetchPublicIpv4();
  const cudaDevices = await listCudaDevices();
  const localEndpoint = `http://127.0.0.1:${config.bridgePort}`;
  const lanEndpoints = lanIps.map((ip) => `http://${ip}:${config.bridgePort}`);
  const publicEndpointCandidate = publicIp ? `http://${publicIp}:${config.bridgePort}` : "";
  const endpointForDomain = String(config.bridgePublicBaseUrl || "").trim() || publicEndpointCandidate || lanEndpoints[0] || localEndpoint;

  return {
    config: toBridgePublicConfig(config),
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
      endpointUrl: endpointForDomain,
      apiKey: String(config.bridgeApiKey || ""),
      model: String(config.bridgeModel || ""),
      thinkingModel: String(config.bridgeThinkingModel || ""),
      cudaDevice: String(config.bridgeCudaDevice || "auto"),
      temperature: Number(config.bridgeTemperature || 0.3),
      timeoutMs: Number(config.bridgeTimeoutMs || 36500),
    },
  };
}

function createMainWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
    return mainWindow;
  }

  const iconPath = path.join(__dirname, "assets", "icon.ico");

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 620,
    frame: false,
    backgroundColor: "#f3f4f6",
    title: "OyamaCRM Desktop",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: true
    }
  });

  mainWindow.loadFile(path.join(__dirname, "shell.html"));
  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  return mainWindow;
}

function createBridgeWindow() {
  if (bridgeWindow && !bridgeWindow.isDestroyed()) {
    if (bridgeWindow.isMinimized()) bridgeWindow.restore();
    bridgeWindow.focus();
    return bridgeWindow;
  }

  const iconPath = path.join(__dirname, "assets", "icon.ico");

  bridgeWindow = new BrowserWindow({
    width: 1260,
    height: 860,
    minWidth: 900,
    minHeight: 620,
    frame: false,
    backgroundColor: "#eef2f7",
    title: "Oyama Bridge Server",
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webviewTag: false,
    },
  });

  bridgeWindow.loadFile(path.join(__dirname, "bridge.html"));
  bridgeWindow.on("closed", () => {
    bridgeWindow = null;
  });

  return bridgeWindow;
}

ipcMain.handle("oyama:get-bound-url", () => {
  const config = readConfig();
  return typeof config.boundUrl === "string" ? config.boundUrl : "";
});

ipcMain.handle("oyama:get-config", () => {
  return readConfig();
});

ipcMain.handle("oyama:set-bound-url", (_event, rawUrl) => {
  if (typeof rawUrl !== "string") {
    return { ok: false, message: "URL must be a string." };
  }

  const cleaned = rawUrl.trim();
  try {
    const parsed = new URL(cleaned);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return { ok: false, message: "Only http/https URLs are supported." };
    }

    const current = readConfig();
    writeConfig({ ...current, boundUrl: parsed.toString() });
    return { ok: true, url: parsed.toString() };
  } catch {
    return { ok: false, message: "Please enter a valid URL." };
  }
});

ipcMain.handle("oyama:set-shell-color", (_event, rawColor) => {
  if (typeof rawColor !== "string") {
    return { ok: false, message: "Color must be a string." };
  }

  const cleaned = rawColor.trim();
  if (!/^#[0-9a-fA-F]{6}$/.test(cleaned)) {
    return { ok: false, message: "Color must be a 6-digit hex value." };
  }

  const normalized = cleaned.toLowerCase();
  const current = readConfig();
  writeConfig({ ...current, shellColor: normalized });
  return { ok: true, color: normalized };
});

ipcMain.handle("oyama:set-lock-settings", (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Settings payload is required." };
  }

  const current = readConfig();
  const next = { ...current };

  if (typeof payload.pinEnabled === "boolean") {
    next.pinEnabled = payload.pinEnabled;
  }

  if (typeof payload.pinLockOnStartup === "boolean") {
    next.pinLockOnStartup = payload.pinLockOnStartup;
  }

  if (typeof payload.pinHash === "string") {
    next.pinHash = payload.pinHash.trim();
  }

  if (typeof payload.pinTimeoutMinutes === "number") {
    const bounded = Math.min(Math.max(Math.floor(payload.pinTimeoutMinutes), 1), 240);
    next.pinTimeoutMinutes = bounded;
  }

  if (!next.pinEnabled) {
    next.pinHash = "";
  }

  if (next.pinEnabled && !next.pinHash) {
    return { ok: false, message: "PIN hash is required when lock is enabled." };
  }

  writeConfig(next);
  return {
    ok: true,
    settings: {
      pinEnabled: next.pinEnabled,
      pinLockOnStartup: next.pinLockOnStartup,
      pinTimeoutMinutes: next.pinTimeoutMinutes
    }
  };
});

ipcMain.handle("oyama:get-bridge-state", async () => {
  return buildBridgeState();
});

ipcMain.handle("oyama:set-bridge-config", async (_event, payload) => {
  if (!payload || typeof payload !== "object") {
    return { ok: false, message: "Bridge settings payload is required." };
  }

  const current = readConfig();
  const next = { ...current };

  try {
    if (Object.prototype.hasOwnProperty.call(payload, "startupPage")) {
      const startupPage = String(payload.startupPage || "crm").trim().toLowerCase();
      if (startupPage !== "crm" && startupPage !== "bridge") {
        return { ok: false, message: "Startup page must be crm or bridge." };
      }
      next.startupPage = startupPage;
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
  emitBridgeEvent({
    type: "config",
    config: toBridgePublicConfig(next),
  });

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

  return {
    ok: true,
    state: await buildBridgeState(),
  };
});

ipcMain.handle("oyama:open-bridge-window", () => {
  createBridgeWindow();
  return { ok: true };
});

ipcMain.handle("oyama:open-main-window", () => {
  createMainWindow();
  return { ok: true };
});

ipcMain.handle("oyama:bridge-start", async () => {
  if (!bridgeManager) {
    bridgeManager = createBridgeServer(() => readConfig());
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

ipcMain.handle("oyama:bridge-stop", async () => {
  if (!bridgeManager) {
    bridgeManager = createBridgeServer(() => readConfig());
  }

  const current = readConfig();
  writeConfig({ ...current, bridgeEnabled: false });

  await bridgeManager.stop();
  return { ok: true, state: await buildBridgeState() };
});

ipcMain.on("oyama:window-minimize", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (senderWindow && !senderWindow.isDestroyed()) {
    senderWindow.minimize();
  }
});

ipcMain.on("oyama:window-toggle-maximize", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow || senderWindow.isDestroyed()) return;
  if (senderWindow.isMaximized()) {
    senderWindow.unmaximize();
  } else {
    senderWindow.maximize();
  }
});

ipcMain.on("oyama:window-close", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  if (!senderWindow || senderWindow.isDestroyed()) return;
  const config = readConfig();
  if (config.minimizeToTaskbarOnClose) {
    senderWindow.minimize();
    return;
  }

  senderWindow.close();
});

ipcMain.on("oyama:app-quit", () => {
  app.quit();
});

ipcMain.handle("oyama:window-is-maximized", (event) => {
  const senderWindow = BrowserWindow.fromWebContents(event.sender);
  return Boolean(senderWindow && !senderWindow.isDestroyed() && senderWindow.isMaximized());
});

app.whenReady().then(() => {
  bridgeManager = createBridgeServer(
    () => readConfig(),
    {
      onEvent: (eventPayload) => {
        emitBridgeEvent(eventPayload);
      },
    }
  );

  const initialConfig = readConfig();
  if (initialConfig.bridgeAutostart || initialConfig.bridgeEnabled) {
    bridgeManager.start().catch(() => {
      // Swallow startup errors; UI bridge manager surfaces runtime errors.
    });
  }

  if (initialConfig.startupPage === "bridge") {
    createBridgeWindow();
  } else {
    createMainWindow();
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      const currentConfig = readConfig();
      if (currentConfig.startupPage === "bridge") {
        createBridgeWindow();
      } else {
        createMainWindow();
      }
    }
  });
});

app.on("before-quit", () => {
  if (bridgeManager) {
    bridgeManager.stop().catch(() => {
      // Ignore shutdown errors.
    });
  }
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
