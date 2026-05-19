const http = require("node:http");
const https = require("node:https");
const { execFile, spawn } = require("node:child_process");

const GPU_PIN_ENV_KEYS = [
  "CUDA_VISIBLE_DEVICES",
  "NVIDIA_VISIBLE_DEVICES",
  "HIP_VISIBLE_DEVICES",
  "ROCR_VISIBLE_DEVICES",
  "GPU_DEVICE_ORDINAL",
];

function sanitizeOllamaRuntimeMode(rawValue) {
  return String(rawValue || "managed").trim().toLowerCase() === "external"
    ? "external"
    : "managed";
}

function normalizeGpuSelection(rawValue) {
  const selected = String(rawValue || "auto").trim().toLowerCase();
  if (!selected || selected === "auto") return "auto";

  const parsed = Number(selected);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error("CUDA device must be auto or a non-negative GPU index.");
  }

  return String(parsed);
}

function normalizeUpstreamUrl(rawValue) {
  const parsed = new URL(String(rawValue || "http://127.0.0.1:11434"));
  if (!(parsed.protocol === "http:" || parsed.protocol === "https:")) {
    throw new Error("Ollama upstream URL must use http or https.");
  }

  return parsed.toString().replace(/\/+$/, "");
}

function isLocalHost(hostname) {
  const host = String(hostname || "").trim().toLowerCase();
  return host === "127.0.0.1" || host === "localhost" || host === "0.0.0.0";
}

function resolveOllamaRuntimeSettings(config) {
  const mode = sanitizeOllamaRuntimeMode(config?.ollamaRuntimeMode);
  const upstreamUrl = normalizeUpstreamUrl(config?.bridgeUpstreamUrl);
  const parsedUrl = new URL(upstreamUrl);
  const executablePath = String(config?.ollamaExecutablePath || "ollama").trim() || "ollama";
  const selectedGpu = normalizeGpuSelection(config?.bridgeCudaDevice);
  const host = parsedUrl.hostname;
  const port = Number(parsedUrl.port || (parsedUrl.protocol === "https:" ? 443 : 11434));

  if (mode === "managed" && !isLocalHost(host)) {
    throw new Error("Managed Ollama mode requires a local upstream URL such as http://127.0.0.1:11434.");
  }

  return {
    mode,
    upstreamUrl,
    executablePath,
    selectedGpu,
    host,
    port,
    hostBinding: `${host}:${port}`,
    envHint: selectedGpu === "auto" ? "Automatic GPU selection" : `CUDA_VISIBLE_DEVICES=${selectedGpu}`,
  };
}

function buildOllamaLaunchEnv(config, baseEnv = process.env) {
  const settings = resolveOllamaRuntimeSettings(config);
  const env = { ...baseEnv };

  env.OLLAMA_HOST = settings.hostBinding;
  env.OYAMA_OLLAMA_MODE = settings.mode;

  GPU_PIN_ENV_KEYS.forEach((key) => {
    delete env[key];
  });

  if (settings.selectedGpu === "auto") {
    env.OYAMA_OLLAMA_GPU_MODE = "auto";
    return env;
  }

  GPU_PIN_ENV_KEYS.forEach((key) => {
    env[key] = settings.selectedGpu;
  });
  env.OYAMA_OLLAMA_GPU_MODE = "pinned";
  return env;
}

function buildOllamaRuntimeSummary(config) {
  const settings = resolveOllamaRuntimeSettings(config);
  return {
    mode: settings.mode,
    upstreamUrl: settings.upstreamUrl,
    executablePath: settings.executablePath,
    args: ["serve"],
    selectedGpu: settings.selectedGpu,
    envHint: settings.envHint,
  };
}

function requestJson(url, pathname, options = {}) {
  const base = new URL(url);
  const target = new URL(pathname, `${base.origin}/`);
  const transport = target.protocol === "https:" ? https : http;
  const timeoutMs = Math.max(500, Number(options.timeoutMs || 1500));
  const method = String(options.method || "GET").toUpperCase();
  const body = options.body && typeof options.body === "object" ? options.body : null;
  const bodyText = body ? JSON.stringify(body) : "";

  return new Promise((resolve, reject) => {
    const req = transport.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      method,
      path: `${target.pathname}${target.search}`,
      headers: bodyText
        ? {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(bodyText),
        }
        : undefined,
      timeout: timeoutMs,
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const bodyText = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try {
          json = bodyText ? JSON.parse(bodyText) : null;
        } catch {
          json = null;
        }

        resolve({
          statusCode: res.statusCode || 0,
          json,
          bodyText,
        });
      });
    });

    req.on("timeout", () => {
      req.destroy(new Error("Timed out waiting for Ollama."));
    });
    req.on("error", reject);

    if (bodyText) {
      req.write(bodyText);
    }

    req.end();
  });
}

async function probeOllamaHealth(upstreamUrl, timeoutMs = 1500) {
  try {
    const response = await requestJson(upstreamUrl, "/api/version", { timeoutMs });
    return {
      ok: response.statusCode >= 200 && response.statusCode < 300,
      statusCode: response.statusCode,
      version: String(response.json?.version || "").trim(),
      message: response.statusCode >= 200 && response.statusCode < 300
        ? "Ollama reachable"
        : `Ollama responded with ${response.statusCode}.`,
    };
  } catch (error) {
    return {
      ok: false,
      statusCode: 0,
      version: "",
      message: error instanceof Error ? error.message : "Unable to reach Ollama.",
    };
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForOllamaHealthy(upstreamUrl, options = {}) {
  const timeoutMs = Math.max(2000, Number(options.timeoutMs || 20000));
  const intervalMs = Math.max(150, Number(options.intervalMs || 300));
  const deadline = Date.now() + timeoutMs;
  let lastProbe = null;

  while (Date.now() < deadline) {
    lastProbe = await probeOllamaHealth(upstreamUrl, Math.min(intervalMs, 1200));
    if (lastProbe.ok) return lastProbe;
    await delay(intervalMs);
  }

  return lastProbe || {
    ok: false,
    statusCode: 0,
    version: "",
    message: "Timed out waiting for Ollama to become healthy.",
  };
}

function createOllamaRuntimeManager(readConfig, options = {}) {
  const emit = typeof options.onEvent === "function" ? options.onEvent : null;
  let child = null;
  let recentOutput = "";

  const state = {
    mode: "managed",
    status: "idle",
    running: false,
    ready: false,
    healthOk: false,
    selectedGpu: "auto",
    envHint: "Automatic GPU selection",
    upstreamUrl: "http://127.0.0.1:11434",
    executablePath: "ollama",
    pid: null,
    version: "",
    managedByApp: false,
    startedAt: "",
    lastError: "",
    lastExitCode: null,
    lastExitSignal: "",
    lastOutput: "",
  };

  function broadcast(type, extra = {}) {
    if (!emit) return;
    emit({
      type: "ollama-runtime",
      event: type,
      state: getState(),
      ...extra,
    });
  }

  function applySettings(settings) {
    state.mode = settings.mode;
    state.selectedGpu = settings.selectedGpu;
    state.envHint = settings.envHint;
    state.upstreamUrl = settings.upstreamUrl;
    state.executablePath = settings.executablePath;
  }

  function rememberOutput(chunk) {
    const text = String(chunk || "").trim();
    if (!text) return;
    recentOutput = `${recentOutput}\n${text}`.trim().slice(-4000);
    state.lastOutput = recentOutput;
  }

  async function unloadModel(upstreamUrl, modelName) {
    const model = String(modelName || "").trim();
    if (!model) {
      return { ok: false, statusCode: 0, model: "", message: "No model configured." };
    }

    const response = await requestJson(upstreamUrl, "/api/generate", {
      method: "POST",
      timeoutMs: 5000,
      body: {
        model,
        prompt: "",
        keep_alive: 0,
        stream: false,
      },
    });

    const ok = response.statusCode >= 200 && response.statusCode < 300;
    return {
      ok,
      statusCode: response.statusCode,
      model,
      message: ok
        ? `Unloaded ${model}`
        : `Unload request for ${model} returned ${response.statusCode}`,
    };
  }

  async function clearVram(reason = "manual") {
    const config = readConfig();
    const settings = resolveOllamaRuntimeSettings(config);
    applySettings(settings);

    const probe = await probeOllamaHealth(settings.upstreamUrl, 2500);
    if (!probe.ok) {
      return {
        ok: false,
        reason,
        cleared: [],
        message: probe.message || "Ollama is not reachable for VRAM clear.",
      };
    }

    const models = Array.from(new Set([
      String(config?.bridgeModel || "").trim(),
      String(config?.bridgeThinkingModel || "").trim(),
    ].filter(Boolean)));

    if (!models.length) {
      return {
        ok: true,
        reason,
        cleared: [],
        message: "No configured models to unload.",
      };
    }

    const results = [];
    for (const model of models) {
      try {
        const unloadResult = await unloadModel(settings.upstreamUrl, model);
        results.push(unloadResult);
      } catch (error) {
        results.push({
          ok: false,
          statusCode: 0,
          model,
          message: error instanceof Error ? error.message : `Failed to unload ${model}`,
        });
      }
    }

    const cleared = results.filter((result) => result.ok).map((result) => result.model);
    const failed = results.filter((result) => !result.ok);

    const summary = {
      ok: failed.length === 0,
      reason,
      cleared,
      failed,
      message: failed.length
        ? `VRAM clear completed with ${failed.length} failed unload request(s).`
        : (cleared.length ? `Cleared models: ${cleared.join(", ")}` : "No models required unload."),
    };

    broadcast("vram-cleared", summary);
    return summary;
  }

  async function refreshHealth() {
    const settings = resolveOllamaRuntimeSettings(readConfig());
    applySettings(settings);
    const probe = await probeOllamaHealth(settings.upstreamUrl);

    state.healthOk = probe.ok;
    state.ready = probe.ok;
    state.version = probe.version || "";

    if (settings.mode === "external") {
      state.running = probe.ok;
      state.managedByApp = false;
      state.status = probe.ok ? "external-ready" : "external-unreachable";
      if (!probe.ok) {
        state.lastError = probe.message;
      }
      return getState();
    }

    if (child && child.exitCode === null && !child.killed) {
      state.running = true;
      state.managedByApp = true;
      state.status = probe.ok ? "managed-ready" : "managed-starting";
      return getState();
    }

    if (probe.ok) {
      state.running = true;
      state.managedByApp = false;
      state.status = "managed-port-in-use";
      state.lastError = "Another Ollama service is already using the configured upstream URL.";
      return getState();
    }

    state.running = false;
    state.managedByApp = false;
    state.status = "stopped";
    return getState();
  }

  async function start() {
    const settings = resolveOllamaRuntimeSettings(readConfig());
    applySettings(settings);

    if (settings.mode === "external") {
      return refreshHealth();
    }

    if (child && child.exitCode === null && !child.killed) {
      return refreshHealth();
    }

    const existing = await probeOllamaHealth(settings.upstreamUrl);
    if (existing.ok) {
      state.running = true;
      state.ready = true;
      state.healthOk = true;
      state.version = existing.version || "";
      state.managedByApp = false;
      state.status = "managed-port-in-use";
      state.lastError = `Managed Ollama cannot guarantee GPU selection because a service is already listening on ${settings.upstreamUrl}. Stop that service or switch to External mode.`;
      throw new Error(state.lastError);
    }

    recentOutput = "";
    state.running = true;
    state.ready = false;
    state.healthOk = false;
    state.managedByApp = true;
    state.status = "managed-starting";
    state.startedAt = new Date().toISOString();
    state.lastError = "";
    state.lastExitCode = null;
    state.lastExitSignal = "";
    state.lastOutput = "";

    const env = buildOllamaLaunchEnv(readConfig(), process.env);
    const nextChild = spawn(settings.executablePath, ["serve"], {
      env,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    child = nextChild;
    state.pid = typeof nextChild.pid === "number" ? nextChild.pid : null;

    nextChild.stdout?.on("data", rememberOutput);
    nextChild.stderr?.on("data", rememberOutput);

    nextChild.on("error", (error) => {
      state.running = false;
      state.ready = false;
      state.healthOk = false;
      state.managedByApp = false;
      state.status = "error";
      state.pid = null;
      state.lastError = error && error.code === "ENOENT"
        ? "Ollama executable was not found. Set the executable path or install Ollama."
        : (error instanceof Error ? error.message : "Managed Ollama failed to start.");
      broadcast("error", { message: state.lastError });
    });

    nextChild.on("exit", (code, signal) => {
      state.running = false;
      state.ready = false;
      state.healthOk = false;
      state.pid = null;
      state.managedByApp = false;
      state.lastExitCode = code;
      state.lastExitSignal = signal || "";
      if (state.status !== "stopped") {
        state.status = code === 0 ? "stopped" : "error";
      }
      if (state.status === "error" && !state.lastError) {
        state.lastError = recentOutput || "Managed Ollama exited unexpectedly.";
      }
      child = null;
      broadcast("exit", { code, signal: signal || "" });
    });

    const ready = await waitForOllamaHealthy(settings.upstreamUrl);
    if (!ready.ok) {
      await stop();
      state.status = "error";
      state.lastError = ready.message || "Managed Ollama did not become ready in time.";
      throw new Error(state.lastError);
    }

    state.ready = true;
    state.healthOk = true;
    state.version = ready.version || "";
    state.status = "managed-ready";
    broadcast("ready", { version: state.version });
    return getState();
  }

  async function stop() {
    const activeChild = child;
    child = null;

    if (!activeChild || activeChild.exitCode !== null || activeChild.killed) {
      state.running = false;
      state.ready = false;
      state.healthOk = false;
      state.pid = null;
      state.managedByApp = false;
      state.status = "stopped";
      return getState();
    }

    const pid = activeChild.pid;
    if (process.platform === "win32" && pid) {
      await new Promise((resolve) => {
        execFile("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true }, () => resolve());
      });
    } else {
      activeChild.kill("SIGTERM");
      await delay(600);
      if (activeChild.exitCode === null && !activeChild.killed) {
        activeChild.kill("SIGKILL");
      }
    }

    state.running = false;
    state.ready = false;
    state.healthOk = false;
    state.pid = null;
    state.managedByApp = false;
    state.status = "stopped";
    broadcast("stopped");
    return getState();
  }

  function getState() {
    return { ...state };
  }

  return {
    getState,
    refreshHealth,
    start,
    stop,
    clearVram,
  };
}

module.exports = {
  GPU_PIN_ENV_KEYS,
  buildOllamaLaunchEnv,
  buildOllamaRuntimeSummary,
  createOllamaRuntimeManager,
  probeOllamaHealth,
  resolveOllamaRuntimeSettings,
  sanitizeOllamaRuntimeMode,
};