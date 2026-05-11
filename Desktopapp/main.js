// Main process for the Oyama desktop shell.
const { app, BrowserWindow, ipcMain } = require("electron");
const fs = require("node:fs");
const path = require("node:path");

let mainWindow = null;
const DEFAULT_CONFIG = {
  boundUrl: "",
  shellColor: "#16a34a",
  pinEnabled: false,
  pinHash: "",
  pinLockOnStartup: true,
  pinTimeoutMinutes: 15
};

function getConfigPath() {
  return path.join(app.getPath("userData"), "oyama-desktop-config.json");
}

function readConfig() {
  try {
    const raw = fs.readFileSync(getConfigPath(), "utf8");
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...(parsed && typeof parsed === "object" ? parsed : {})
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

function writeConfig(nextConfig) {
  fs.writeFileSync(getConfigPath(), JSON.stringify(nextConfig, null, 2), "utf8");
}

function createMainWindow() {
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

ipcMain.on("oyama:window-minimize", () => {
  if (mainWindow) mainWindow.minimize();
});

ipcMain.on("oyama:window-toggle-maximize", () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }
});

ipcMain.on("oyama:window-close", () => {
  if (mainWindow) mainWindow.close();
});

ipcMain.handle("oyama:window-is-maximized", () => {
  return Boolean(mainWindow && mainWindow.isMaximized());
});

app.whenReady().then(() => {
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
