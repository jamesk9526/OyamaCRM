const { app, BrowserWindow, ipcMain, session } = require("electron");
const path = require("node:path");

let mainWindow = null;
const loginWindows = new Set();

function normalizeBaseUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) return "";
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(candidate).origin;
  } catch {
    return "";
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile(path.join(__dirname, "index.html"));
}

ipcMain.handle("oyama-desktop:probe-instance", async (_event, { baseUrl }) => {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return { ok: false, message: "Enter a valid Oyama CRM URL." };
  }

  const endpoints = ["/api/health", "/health"];
  for (const endpoint of endpoints) {
    try {
      const response = await fetch(`${normalized}${endpoint}`, { cache: "no-store" });
      if (!response.ok) continue;
      const payload = await response.json();
      return {
        ok: true,
        appName: typeof payload.appName === "string" ? payload.appName : "Oyama CRM",
        version: typeof payload.version === "string" ? payload.version : "",
        environment: typeof payload.environment === "string" ? payload.environment : "",
        status: typeof payload.status === "string" ? payload.status : "",
      };
    } catch {
      // try next endpoint
    }
  }

  return { ok: false, message: "No Oyama API health endpoint responded at that URL." };
});

ipcMain.handle("oyama-desktop:open-login", async (_event, { baseUrl }) => {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    throw new Error("Enter a valid Oyama CRM URL before opening login.");
  }

  const loginWindow = new BrowserWindow({
    width: 480,
    height: 720,
    minWidth: 420,
    minHeight: 600,
    parent: mainWindow ?? undefined,
    modal: Boolean(mainWindow),
    backgroundColor: "#ffffff",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loginWindows.add(loginWindow);
  loginWindow.on("closed", () => {
    loginWindows.delete(loginWindow);
  });

  await loginWindow.loadURL(`${normalized}/login`);
  loginWindow.show();
  return { ok: true };
});

ipcMain.handle("oyama-desktop:load-dashboard", async (_event, { baseUrl }) => {
  const normalized = normalizeBaseUrl(baseUrl);
  if (!normalized) {
    return { ok: false, code: "INVALID_URL", message: "Connect an Oyama CRM instance first." };
  }

  const runtimeSession = session.defaultSession;

  const refreshResponse = await runtimeSession.fetch(`${normalized}/api/auth/refresh`, {
    method: "POST",
    headers: {
      Accept: "application/json",
    },
  });

  if (refreshResponse.status === 401) {
    return {
      ok: false,
      code: "AUTH_REQUIRED",
      message: "Sign in to your Oyama CRM instance from Settings before loading the dashboard.",
    };
  }

  if (!refreshResponse.ok) {
    return {
      ok: false,
      code: "REFRESH_FAILED",
      message: `Could not refresh the desktop session (${refreshResponse.status}).`,
    };
  }

  const refreshPayload = await refreshResponse.json().catch(() => null);
  const accessToken = refreshPayload?.data?.accessToken;

  if (!accessToken || typeof accessToken !== "string") {
    return {
      ok: false,
      code: "TOKEN_MISSING",
      message: "The instance did not return a usable access token.",
    };
  }

  const authHeaders = {
    Accept: "application/json",
    Authorization: `Bearer ${accessToken}`,
  };

  const [meResponse, healthResponse, constituentsResponse] = await Promise.all([
    runtimeSession.fetch(`${normalized}/api/auth/me`, {
      method: "GET",
      headers: authHeaders,
    }),
    runtimeSession.fetch(`${normalized}/api/health`, {
      method: "GET",
      headers: authHeaders,
    }),
    runtimeSession.fetch(`${normalized}/api/constituents?page=1&pageSize=120`, {
      method: "GET",
      headers: authHeaders,
    }),
  ]);

  if (meResponse.status === 401) {
    return {
      ok: false,
      code: "AUTH_EXPIRED",
      message: "Your desktop session expired. Open Settings and sign in again.",
    };
  }

  if (!meResponse.ok) {
    return {
      ok: false,
      code: "ME_FAILED",
      message: `Could not load the current user (${meResponse.status}).`,
    };
  }

  if (!healthResponse.ok) {
    return {
      ok: false,
      code: "HEALTH_FAILED",
      message: `Could not load instance health (${healthResponse.status}).`,
    };
  }

  if (!constituentsResponse.ok) {
    return {
      ok: false,
      code: "CONSTITUENTS_FAILED",
      message: `Could not load constituents (${constituentsResponse.status}).`,
    };
  }

  const mePayload = await meResponse.json().catch(() => null);
  const healthPayload = await healthResponse.json().catch(() => null);
  const constituentsPayload = await constituentsResponse.json().catch(() => null);

  return {
    ok: true,
    baseUrl: normalized,
    fetchedAt: new Date().toISOString(),
    user: mePayload?.data ?? null,
    health: healthPayload ?? null,
    constituents: constituentsPayload ?? null,
  };
});

ipcMain.handle("oyama-desktop:window-control", async (event, action) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window) return { ok: false };

  if (action === "minimize") {
    window.minimize();
    return { ok: true };
  }
  if (action === "maximize") {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
    return { ok: true };
  }
  if (action === "close") {
    window.close();
    return { ok: true };
  }

  return { ok: false };
});

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
