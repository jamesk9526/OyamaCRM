// Standalone Oyama Bridge local gateway server.
const http = require("node:http");
const https = require("node:https");

const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_REQUEST_LOGS = 250;
const MAX_ERROR_LOGS = 180;
const MAX_GENERATED_PREVIEW_CHARS = 6000;

function parseAllowedOrigins(rawValue) {
  const text = String(rawValue || "").trim();
  if (!text) return [];

  return text
    .split(/[\s,]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => /^https?:\/\//i.test(entry));
}

function setCorsHeaders(req, res, allowedOrigins) {
  const origin = typeof req.headers.origin === "string" ? req.headers.origin : "";

  if (!origin) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (allowedOrigins.length === 0) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    return false;
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  return true;
}

function isAuthorized(req, apiKey) {
  const expected = String(apiKey || "").trim();
  if (!expected) return true;

  const authHeader = String(req.headers.authorization || "").trim();
  return authHeader === `Bearer ${expected}`;
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let totalSize = 0;

    req.on("data", (chunk) => {
      totalSize += chunk.length;
      if (totalSize > MAX_BODY_BYTES) {
        reject(new Error("Request payload is too large for bridge processing."));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    req.on("error", (error) => {
      reject(error);
    });
  });
}

function sanitizeResponseHeaders(headers) {
  const hopByHop = new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
  ]);

  const result = {};
  for (const [key, value] of Object.entries(headers || {})) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (hopByHop.has(lower)) continue;
    result[key] = value;
  }
  return result;
}

function forwardToUpstream(config, req, targetPath, bodyBuffer) {
  const base = new URL(config.bridgeUpstreamUrl);
  const targetUrl = new URL(targetPath, `${base.origin}/`);
  const transport = targetUrl.protocol === "https:" ? https : http;
  const timeoutMs = Math.max(1000, Number(config.bridgeTimeoutMs || 180000));

  const headers = {};
  for (const [key, value] of Object.entries(req.headers || {})) {
    if (!value) continue;
    const lower = key.toLowerCase();
    if (["host", "content-length", "connection", "accept-encoding"].includes(lower)) continue;
    headers[key] = Array.isArray(value) ? value.join(", ") : String(value);
  }

  headers.host = targetUrl.host;
  headers.connection = "close";
  if (bodyBuffer && bodyBuffer.length > 0) {
    headers["content-length"] = String(bodyBuffer.length);
  }

  return new Promise((resolve, reject) => {
    const upstreamRequest = transport.request({
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
      method: req.method,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      headers,
      timeout: timeoutMs,
    }, (upstreamResponse) => {
      const responseChunks = [];
      upstreamResponse.on("data", (chunk) => responseChunks.push(chunk));
      upstreamResponse.on("end", () => {
        resolve({
          statusCode: upstreamResponse.statusCode || 502,
          headers: sanitizeResponseHeaders(upstreamResponse.headers),
          body: Buffer.concat(responseChunks),
        });
      });
    });

    upstreamRequest.on("timeout", () => {
      upstreamRequest.destroy(new Error(`Bridge request timed out while waiting for upstream after ${timeoutMs} ms.`));
    });

    upstreamRequest.on("error", (error) => {
      reject(error);
    });

    if (bodyBuffer && bodyBuffer.length > 0) {
      upstreamRequest.write(bodyBuffer);
    }

    upstreamRequest.end();
  });
}

function injectCudaDeviceOptions(config, pathname, bodyBuffer) {
  const selected = String(config.bridgeCudaDevice || "auto").trim().toLowerCase();
  const result = {
    bodyBuffer,
    requestedDevice: selected || "auto",
    appliedDevice: selected === "auto" ? "auto" : "",
  };

  if (!bodyBuffer || bodyBuffer.length === 0) return result;
  if (selected === "auto") return result;
  if (!(pathname === "/api/chat" || pathname === "/api/generate")) return result;

  const cudaIndex = Number(selected);
  if (!Number.isInteger(cudaIndex) || cudaIndex < 0) {
    throw new Error(`Configured CUDA device "${selected}" is invalid. Choose auto or a non-negative GPU index.`);
  }

  try {
    const payload = JSON.parse(bodyBuffer.toString("utf8"));
    if (!payload || typeof payload !== "object") return result;

    const options = payload.options && typeof payload.options === "object"
      ? { ...payload.options }
      : {};

    options.main_gpu = cudaIndex;

    const nextPayload = {
      ...payload,
      options,
    };

    return {
      bodyBuffer: Buffer.from(JSON.stringify(nextPayload), "utf8"),
      requestedDevice: selected,
      appliedDevice: selected,
    };
  } catch {
    return result;
  }
}

function createBridgeServer(readConfig, options = {}) {
  let server = null;
  const eventListener = options && typeof options.onEvent === "function"
    ? options.onEvent
    : null;

  const runtime = {
    running: false,
    startedAt: null,
    requestCount: 0,
    lastError: null,
    telemetry: {
      lastRequestAt: null,
      lastLatencyMs: 0,
      averageLatencyMs: 0,
      totalLoggedRequests: 0,
      successCount: 0,
      clientErrorCount: 0,
      serverErrorCount: 0,
      recentErrorCount: 0,
      upstreamUrl: "",
      totalBodyBytes: 0,
      totalResponseBytes: 0,
    },
  };

  const requestLog = [];
  const errorLog = [];

  function emitEvent(payload) {
    if (!eventListener) return;
    try {
      eventListener(payload);
    } catch {
      // Ignore listener errors.
    }
  }

  function getRuntimeState() {
    return {
      running: runtime.running,
      startedAt: runtime.startedAt,
      uptimeMs: runtime.startedAt ? Date.now() - runtime.startedAt : 0,
      requestCount: runtime.requestCount,
      lastError: runtime.lastError,
      telemetry: {
        ...runtime.telemetry,
      },
      requestLog: requestLog.slice(0, MAX_REQUEST_LOGS),
      errorLog: errorLog.slice(0, MAX_ERROR_LOGS),
    };
  }

  function classifyStatus(statusCode) {
    const code = Number(statusCode || 0);
    if (code >= 500) return "server_error";
    if (code >= 400) return "client_error";
    if (code >= 300) return "redirect";
    if (code >= 200) return "success";
    return "unknown";
  }

  function classifyRoute(pathname) {
    if (pathname === "/health") return "health";
    if (pathname === "/api/chat") return "chat";
    if (pathname === "/api/generate") return "generate";
    if (pathname.startsWith("/api/")) return "api";
    return "other";
  }

  function getUpstreamHost(rawUrl) {
    try {
      const parsed = new URL(String(rawUrl || ""));
      return parsed.host;
    } catch {
      return "";
    }
  }

  function extractSafeModel(bodyBuffer) {
    if (!bodyBuffer || bodyBuffer.length === 0) return "";
    try {
      const payload = JSON.parse(bodyBuffer.toString("utf8"));
      return typeof payload?.model === "string" ? payload.model.slice(0, 120) : "";
    } catch {
      return "";
    }
  }

  /**
   * Pull assistant output from Ollama-style responses without storing prompts.
   * The renderer uses this in-memory preview for live Steward generation logs.
   */
  function extractGeneratedPreview(pathname, responseBuffer) {
    if (!(pathname === "/api/chat" || pathname === "/api/generate")) return "";
    if (!responseBuffer || responseBuffer.length === 0) return "";

    const text = responseBuffer.toString("utf8").trim();
    if (!text) return "";

    const getPayloadText = (payload) => {
      if (!payload || typeof payload !== "object") return "";
      if (typeof payload.response === "string") return payload.response;
      if (payload.message && typeof payload.message.content === "string") return payload.message.content;
      return "";
    };

    try {
      return getPayloadText(JSON.parse(text)).slice(0, MAX_GENERATED_PREVIEW_CHARS);
    } catch {
      // Streaming responses are usually newline-delimited JSON fragments.
    }

    const parts = [];
    text.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || parts.join("").length >= MAX_GENERATED_PREVIEW_CHARS) return;
      try {
        const nextPart = getPayloadText(JSON.parse(trimmed));
        if (nextPart) parts.push(nextPart);
      } catch {
        // Ignore malformed stream fragments.
      }
    });

    return parts.join("").slice(0, MAX_GENERATED_PREVIEW_CHARS);
  }

  function getContentType(req) {
    const raw = req.headers && req.headers["content-type"];
    return Array.isArray(raw) ? raw.join(", ").slice(0, 160) : String(raw || "").slice(0, 160);
  }

  function updateTelemetrySummary(entry) {
    const statusCode = Number(entry.statusCode || 0);
    const durationMs = Math.max(0, Number(entry.durationMs || 0));
    const previousTotal = Number(runtime.telemetry.totalLoggedRequests || 0);
    const nextTotal = previousTotal + 1;
    const previousAverage = Number(runtime.telemetry.averageLatencyMs || 0);
    const nextAverage = previousTotal === 0
      ? durationMs
      : ((previousAverage * previousTotal) + durationMs) / nextTotal;

    runtime.telemetry.lastRequestAt = entry.timestamp || new Date().toISOString();
    runtime.telemetry.lastLatencyMs = durationMs;
    runtime.telemetry.averageLatencyMs = Math.round(nextAverage);
    runtime.telemetry.totalLoggedRequests = nextTotal;
    runtime.telemetry.upstreamUrl = String(entry.upstreamUrl || runtime.telemetry.upstreamUrl || "");
    runtime.telemetry.totalBodyBytes += Math.max(0, Number(entry.bodyBytes || 0));
    runtime.telemetry.totalResponseBytes += Math.max(0, Number(entry.responseBytes || 0));

    if (statusCode >= 200 && statusCode < 300) {
      runtime.telemetry.successCount += 1;
    } else if (statusCode >= 400 && statusCode < 500) {
      runtime.telemetry.clientErrorCount += 1;
    } else if (statusCode >= 500) {
      runtime.telemetry.serverErrorCount += 1;
    }

    const cutoff = Date.now() - (15 * 60 * 1000);
    runtime.telemetry.recentErrorCount = errorLog.filter((item) => {
      const time = item.timestamp ? new Date(item.timestamp).getTime() : 0;
      return time >= cutoff;
    }).length;
  }

  function pushErrorLog(entry) {
    const normalizedEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level: String(entry.level || "error"),
      code: String(entry.code || "BRIDGE_ERROR"),
      message: String(entry.message || "Bridge error."),
      path: String(entry.path || ""),
      method: String(entry.method || "").toUpperCase(),
      statusCode: Number(entry.statusCode || 0),
    };

    errorLog.unshift(normalizedEntry);
    if (errorLog.length > MAX_ERROR_LOGS) {
      errorLog.length = MAX_ERROR_LOGS;
    }

    emitEvent({ type: "error", entry: normalizedEntry, runtime: getRuntimeState() });
  }

  function pushRequestLog(entry) {
    const normalizedEntry = {
      id: entry.requestId || `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      requestId: String(entry.requestId || ""),
      timestamp: new Date().toISOString(),
      method: String(entry.method || "GET").toUpperCase(),
      path: String(entry.path || "/"),
      statusCode: Number(entry.statusCode || 0),
      durationMs: Number(entry.durationMs || 0),
      origin: String(entry.origin || ""),
      detail: String(entry.detail || ""),
      upstreamUrl: String(entry.upstreamUrl || ""),
      upstreamHost: String(entry.upstreamHost || getUpstreamHost(entry.upstreamUrl)),
      bodyBytes: Math.max(0, Number(entry.bodyBytes || 0)),
      responseBytes: Math.max(0, Number(entry.responseBytes || 0)),
      contentType: String(entry.contentType || ""),
      routeGroup: String(entry.routeGroup || "other"),
      model: String(entry.model || ""),
      errorClass: String(entry.errorClass || classifyStatus(entry.statusCode)),
      generatedPreview: String(entry.generatedPreview || "").slice(0, MAX_GENERATED_PREVIEW_CHARS),
      generatedPreviewLength: Math.max(0, Number(entry.generatedPreviewLength || 0)),
      cudaDeviceRequested: String(entry.cudaDeviceRequested || "auto"),
      cudaDeviceApplied: String(entry.cudaDeviceApplied || ""),
    };

    requestLog.unshift(normalizedEntry);
    if (requestLog.length > MAX_REQUEST_LOGS) {
      requestLog.length = MAX_REQUEST_LOGS;
    }

    updateTelemetrySummary(normalizedEntry);

    emitEvent({ type: "request", entry: normalizedEntry, runtime: getRuntimeState() });
  }

  function emitRuntimeUpdate(reason) {
    emitEvent({ type: "runtime", reason, runtime: getRuntimeState() });
  }

  async function handleRequest(req, res) {
    const startedAt = Date.now();
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`;
    const config = readConfig();
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const allowedOrigins = parseAllowedOrigins(config.bridgeAllowedOrigins);
    const requestPath = `${url.pathname}${url.search}`;
    const requestOrigin = typeof req.headers.origin === "string" ? req.headers.origin : "";
    let bodyBytes = 0;
    let responseBytes = 0;
    let safeModel = "";
    let generatedPreview = "";
    let cudaDeviceRequested = String(config.bridgeCudaDevice || "auto");
    let cudaDeviceApplied = cudaDeviceRequested === "auto" ? "auto" : "";

    function logRequest(statusCode, detail, upstreamUrl = "") {
      if (Number(statusCode) >= 400) {
        pushErrorLog({
          level: Number(statusCode) >= 500 ? "error" : "warn",
          code: Number(statusCode) >= 500 ? "HTTP_UPSTREAM_ERROR" : "HTTP_CLIENT_ERROR",
          message: detail || `Bridge request failed with status ${statusCode}.`,
          path: requestPath,
          method: req.method || "GET",
          statusCode,
        });
      }

      pushRequestLog({
        requestId,
        method: req.method || "GET",
        path: requestPath,
        statusCode,
        durationMs: Date.now() - startedAt,
        origin: requestOrigin,
        detail,
        upstreamUrl,
        upstreamHost: getUpstreamHost(upstreamUrl),
        bodyBytes,
        responseBytes,
        contentType: getContentType(req),
        routeGroup: classifyRoute(url.pathname),
        model: safeModel,
        errorClass: classifyStatus(statusCode),
        generatedPreview,
        generatedPreviewLength: generatedPreview.length,
        cudaDeviceRequested,
        cudaDeviceApplied,
      });
    }

    if (!setCorsHeaders(req, res, allowedOrigins)) {
      res.statusCode = 403;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: "Origin is not allowed by bridge settings." } }));
      logRequest(403, "Origin blocked by bridge allowlist.");
      return;
    }

    if (req.method === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      logRequest(204, "CORS preflight handled.");
      return;
    }

    if (url.pathname === "/health") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        ok: true,
        running: runtime.running,
        upstream: config.bridgeUpstreamUrl,
        requestCount: runtime.requestCount,
      }));
      logRequest(200, "Bridge health check.");
      return;
    }

    if (!url.pathname.startsWith("/api/")) {
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: "Route not found. Use /api/* or /health." } }));
      logRequest(404, "Unsupported route path.");
      return;
    }

    if (!isAuthorized(req, config.bridgeApiKey)) {
      res.statusCode = 401;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ error: { message: "Missing or invalid Bearer token." } }));
      logRequest(401, "Unauthorized request (invalid/missing Bearer token).");
      return;
    }

    let bodyBuffer = req.method === "GET" || req.method === "HEAD"
      ? Buffer.alloc(0)
      : await readRequestBody(req);
    bodyBytes = bodyBuffer.length;
    safeModel = extractSafeModel(bodyBuffer);

    const cudaInjection = injectCudaDeviceOptions(config, url.pathname, bodyBuffer);
    bodyBuffer = cudaInjection.bodyBuffer;
    cudaDeviceRequested = cudaInjection.requestedDevice;
    cudaDeviceApplied = cudaInjection.appliedDevice;

    runtime.requestCount += 1;
    const upstreamResult = await forwardToUpstream(config, req, `${url.pathname}${url.search}`, bodyBuffer);
    responseBytes = upstreamResult.body ? upstreamResult.body.length : 0;
    generatedPreview = extractGeneratedPreview(url.pathname, upstreamResult.body);

    res.statusCode = upstreamResult.statusCode;
    for (const [key, value] of Object.entries(upstreamResult.headers)) {
      if (!value) continue;
      res.setHeader(key, value);
    }
    res.end(upstreamResult.body);
    logRequest(upstreamResult.statusCode, "Forwarded to upstream runtime.", String(config.bridgeUpstreamUrl || ""));
  }

  function start() {
    if (runtime.running && server) {
      return Promise.resolve(getRuntimeState());
    }

    const config = readConfig();

    return new Promise((resolve, reject) => {
      runtime.lastError = null;

      server = http.createServer((req, res) => {
        Promise.resolve(handleRequest(req, res)).catch((error) => {
          runtime.lastError = error instanceof Error ? error.message : String(error);
          const statusCode = /timed out while waiting for upstream/i.test(runtime.lastError) ? 504 : 502;
          res.setHeader("Content-Type", "application/json");
          res.statusCode = statusCode;
          res.end(JSON.stringify({ error: { message: runtime.lastError } }));
          pushErrorLog({
            level: "error",
            code: statusCode === 504 ? "REQUEST_HANDLER_TIMEOUT" : "REQUEST_HANDLER_ERROR",
            message: runtime.lastError,
            method: req.method || "GET",
            path: String(req.url || "/"),
            statusCode,
          });
          pushRequestLog({
            requestId: `${Date.now().toString(36)}-${Math.random().toString(16).slice(2, 10)}`,
            method: req.method || "GET",
            path: String(req.url || "/"),
            statusCode,
            durationMs: 0,
            origin: typeof req.headers.origin === "string" ? req.headers.origin : "",
            detail: runtime.lastError,
            upstreamUrl: String(config.bridgeUpstreamUrl || ""),
            upstreamHost: getUpstreamHost(config.bridgeUpstreamUrl),
            routeGroup: "api",
            errorClass: "server_error",
          });
          emitRuntimeUpdate("request-error");
        });
      });

      server.once("error", (error) => {
        runtime.lastError = error instanceof Error ? error.message : String(error);
        pushErrorLog({
          level: "error",
          code: "STARTUP_ERROR",
          message: runtime.lastError,
        });
        runtime.running = false;
        server = null;
        emitRuntimeUpdate("startup-error");
        reject(error);
      });

      server.listen(Number(config.bridgePort), "0.0.0.0", () => {
        runtime.running = true;
        runtime.startedAt = Date.now();
        runtime.lastError = null;
        emitRuntimeUpdate("started");
        resolve(getRuntimeState());
      });
    });
  }

  function stop() {
    if (!server) {
      runtime.running = false;
      runtime.startedAt = null;
      emitRuntimeUpdate("stopped");
      return Promise.resolve(getRuntimeState());
    }

    return new Promise((resolve) => {
      const target = server;
      server = null;

      target.close(() => {
        runtime.running = false;
        runtime.startedAt = null;
        emitRuntimeUpdate("stopped");
        resolve(getRuntimeState());
      });
    });
  }

  return {
    start,
    stop,
    getRuntimeState,
  };
}

module.exports = {
  createBridgeServer,
};
