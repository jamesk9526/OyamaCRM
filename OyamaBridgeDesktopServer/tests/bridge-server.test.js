const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");

const { createBridgeServer } = require("../bridge-server");
const { parseGpuListOutput, parseGpuTelemetryCsv } = require("../gpu-telemetry");
const {
  buildOllamaLaunchEnv,
  createOllamaRuntimeManager,
  resolveOllamaRuntimeSettings,
} = require("../ollama-runtime");

async function getFreePort() {
  const tempServer = http.createServer();
  tempServer.listen(0, "127.0.0.1");
  await once(tempServer, "listening");
  const address = tempServer.address();
  const port = typeof address === "object" && address ? address.port : 0;
  await new Promise((resolve) => tempServer.close(resolve));
  return port;
}

async function requestJson({ port, method = "GET", path = "/", headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;

    const req = http.request({
      hostname: "127.0.0.1",
      port,
      path,
      method,
      headers: {
        ...(payload ? { "content-type": "application/json", "content-length": Buffer.byteLength(payload) } : {}),
        ...headers,
      },
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        let json = null;
        try {
          json = text ? JSON.parse(text) : null;
        } catch {
          json = null;
        }

        resolve({
          statusCode: res.statusCode || 0,
          headers: res.headers,
          bodyText: text,
          json,
        });
      });
    });

    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function startUpstreamServer(handler) {
  const server = http.createServer(handler);
  return new Promise(async (resolve, reject) => {
    server.once("error", reject);
    const port = await getFreePort();
    server.listen(port, "127.0.0.1", () => {
      resolve({ server, port });
    });
  });
}

test("bridge server enforces health/auth/cors and records request logs", async () => {
  const upstream = await startUpstreamServer((req, res) => {
    if (req.url === "/api/fail") {
      res.statusCode = 503;
      res.setHeader("content-type", "application/json");
      res.end(JSON.stringify({ error: "upstream unavailable" }));
      return;
    }

    if (req.url !== "/api/ping") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, route: req.url }));
  });

  const bridgePort = await getFreePort();
  const config = {
    bridgePort,
    bridgeApiKey: "test-api-key",
    bridgeAllowedOrigins: "http://allowed.example",
    bridgeUpstreamUrl: `http://127.0.0.1:${upstream.port}`,
    bridgeTimeoutMs: 3000,
    bridgeCudaDevice: "auto",
  };

  const bridge = createBridgeServer(() => config);
  await bridge.start();

  try {
    const health = await requestJson({ port: bridgePort, path: "/health" });
    assert.equal(health.statusCode, 200);
    assert.equal(health.json?.ok, true);
    assert.equal(health.json?.requestCount, 0);

    const unauthorized = await requestJson({
      port: bridgePort,
      path: "/api/ping",
      headers: { origin: "http://allowed.example" },
    });
    assert.equal(unauthorized.statusCode, 401);

    const blockedOrigin = await requestJson({
      port: bridgePort,
      path: "/api/ping",
      headers: {
        origin: "http://blocked.example",
        authorization: "Bearer test-api-key",
      },
    });
    assert.equal(blockedOrigin.statusCode, 403);

    const forwarded = await requestJson({
      port: bridgePort,
      path: "/api/ping",
      headers: {
        origin: "http://allowed.example",
        authorization: "Bearer test-api-key",
      },
    });
    assert.equal(forwarded.statusCode, 200);
    assert.equal(forwarded.json?.ok, true);

    const upstreamFailure = await requestJson({
      port: bridgePort,
      path: "/api/fail",
      headers: {
        origin: "http://allowed.example",
        authorization: "Bearer test-api-key",
      },
    });
    assert.equal(upstreamFailure.statusCode, 503);

    const runtime = bridge.getRuntimeState();
    assert.equal(runtime.requestCount, 2);
    assert.ok(Array.isArray(runtime.requestLog));
    assert.ok(runtime.requestLog.length >= 4);
    assert.ok(runtime.requestLog.some((entry) => entry.statusCode === 200));
    assert.ok(runtime.requestLog.some((entry) => entry.statusCode === 401));
    assert.ok(runtime.requestLog.some((entry) => entry.statusCode === 403));
    assert.ok(runtime.requestLog.some((entry) => entry.statusCode === 503));
    assert.equal(runtime.telemetry.successCount >= 2, true);
    assert.equal(runtime.telemetry.clientErrorCount >= 2, true);
    assert.equal(runtime.telemetry.serverErrorCount >= 1, true);
    assert.equal(runtime.telemetry.recentErrorCount >= 1, true);
    assert.equal(typeof runtime.telemetry.averageLatencyMs, "number");
  } finally {
    await bridge.stop();
    await new Promise((resolve) => upstream.server.close(resolve));
  }
});

test("bridge injects CUDA options for /api/chat when device is pinned", async () => {
  let receivedPayload = null;

  const upstream = await startUpstreamServer(async (req, res) => {
    if (req.url !== "/api/chat") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    await once(req, "end");
    receivedPayload = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true }));
  });

  const bridgePort = await getFreePort();
  const config = {
    bridgePort,
    bridgeApiKey: "cuda-key",
    bridgeAllowedOrigins: "",
    bridgeUpstreamUrl: `http://127.0.0.1:${upstream.port}`,
    bridgeTimeoutMs: 3000,
    bridgeCudaDevice: "2",
  };

  const bridge = createBridgeServer(() => config);
  await bridge.start();

  try {
    const result = await requestJson({
      port: bridgePort,
      method: "POST",
      path: "/api/chat",
      headers: {
        authorization: "Bearer cuda-key",
      },
      body: {
        model: "llama3.2:3b",
        messages: [{ role: "user", content: "hello" }],
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(receivedPayload?.options?.main_gpu, 2);
    assert.equal(receivedPayload?.options?.num_gpu, undefined);
  } finally {
    await bridge.stop();
    await new Promise((resolve) => upstream.server.close(resolve));
  }
});

test("bridge pins selected CUDA device for generate even when payload has options", async () => {
  let receivedPayload = null;

  const upstream = await startUpstreamServer(async (req, res) => {
    if (req.url !== "/api/generate") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    await once(req, "end");
    receivedPayload = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ response: "generated with selected gpu" }));
  });

  const bridgePort = await getFreePort();
  const config = {
    bridgePort,
    bridgeApiKey: "cuda-generate-key",
    bridgeAllowedOrigins: "",
    bridgeUpstreamUrl: `http://127.0.0.1:${upstream.port}`,
    bridgeTimeoutMs: 3000,
    bridgeCudaDevice: "1",
  };

  const bridge = createBridgeServer(() => config);
  await bridge.start();

  try {
    const result = await requestJson({
      port: bridgePort,
      method: "POST",
      path: "/api/generate",
      headers: {
        authorization: "Bearer cuda-generate-key",
      },
      body: {
        model: "llama3.2:3b",
        prompt: "hello",
        options: {
          main_gpu: 0,
          num_gpu: 4,
          temperature: 0.2,
        },
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(receivedPayload?.options?.main_gpu, 1);
    assert.equal(receivedPayload?.options?.num_gpu, 4);
    assert.equal(receivedPayload?.options?.temperature, 0.2);

    const runtime = bridge.getRuntimeState();
    const entry = runtime.requestLog.find((item) => item.path === "/api/generate");
    assert.equal(entry.cudaDeviceRequested, "1");
    assert.equal(entry.cudaDeviceApplied, "1");
  } finally {
    await bridge.stop();
    await new Promise((resolve) => upstream.server.close(resolve));
  }
});

test("bridge request metadata stores generated previews without storing prompt content", async () => {
  let receivedPayload = null;

  const upstream = await startUpstreamServer(async (req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    await once(req, "end");
    receivedPayload = JSON.parse(Buffer.concat(chunks).toString("utf8"));

    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ ok: true, reply: "stored upstream only" }));
  });

  const bridgePort = await getFreePort();
  const config = {
    bridgePort,
    bridgeApiKey: "metadata-key",
    bridgeAllowedOrigins: "",
    bridgeUpstreamUrl: `http://127.0.0.1:${upstream.port}`,
    bridgeTimeoutMs: 3000,
    bridgeCudaDevice: "auto",
  };

  const bridge = createBridgeServer(() => config);
  await bridge.start();

  try {
    const secretPrompt = "private donor note should not appear in logs";
    const result = await requestJson({
      port: bridgePort,
      method: "POST",
      path: "/api/chat",
      headers: {
        authorization: "Bearer metadata-key",
      },
      body: {
        model: "llama3.2:3b",
        messages: [{ role: "user", content: secretPrompt }],
      },
    });

    assert.equal(result.statusCode, 200);
    assert.equal(receivedPayload?.messages?.[0]?.content, secretPrompt);

    const runtime = bridge.getRuntimeState();
    const entry = runtime.requestLog.find((item) => item.path === "/api/chat");
    assert.ok(entry);
    assert.equal(entry.model, "llama3.2:3b");
    assert.equal(entry.routeGroup, "chat");
    assert.equal(entry.errorClass, "success");
    assert.equal(entry.upstreamHost, `127.0.0.1:${upstream.port}`);
    assert.equal(entry.contentType.includes("application/json"), true);
    assert.equal(entry.bodyBytes > 0, true);
    assert.equal(entry.responseBytes > 0, true);
    assert.equal(entry.generatedPreview, "");
    assert.equal(typeof entry.requestId, "string");

    const serializedLog = JSON.stringify(runtime.requestLog);
    assert.equal(serializedLog.includes(secretPrompt), false);
    assert.equal(serializedLog.includes("metadata-key"), false);
    assert.equal(serializedLog.includes("stored upstream only"), false);
  } finally {
    await bridge.stop();
    await new Promise((resolve) => upstream.server.close(resolve));
  }
});

test("bridge captures generated assistant previews for chat and generate routes", async () => {
  const upstream = await startUpstreamServer(async (req, res) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    await once(req, "end");

    res.setHeader("content-type", "application/json");
    if (req.url === "/api/generate") {
      res.end(JSON.stringify({ response: "Generated appeal draft content." }));
      return;
    }

    res.end(JSON.stringify({ message: { role: "assistant", content: "Generated Steward chat content." } }));
  });

  const bridgePort = await getFreePort();
  const config = {
    bridgePort,
    bridgeApiKey: "preview-key",
    bridgeAllowedOrigins: "",
    bridgeUpstreamUrl: `http://127.0.0.1:${upstream.port}`,
    bridgeTimeoutMs: 3000,
    bridgeCudaDevice: "auto",
  };

  const bridge = createBridgeServer(() => config);
  await bridge.start();

  try {
    const chatResult = await requestJson({
      port: bridgePort,
      method: "POST",
      path: "/api/chat",
      headers: { authorization: "Bearer preview-key" },
      body: {
        model: "llama3.2:3b",
        messages: [{ role: "user", content: "private prompt stays out" }],
      },
    });
    assert.equal(chatResult.statusCode, 200);

    const generateResult = await requestJson({
      port: bridgePort,
      method: "POST",
      path: "/api/generate",
      headers: { authorization: "Bearer preview-key" },
      body: {
        model: "llama3.2:3b",
        prompt: "private generation prompt stays out",
      },
    });
    assert.equal(generateResult.statusCode, 200);

    const runtime = bridge.getRuntimeState();
    const chatEntry = runtime.requestLog.find((item) => item.path === "/api/chat");
    const generateEntry = runtime.requestLog.find((item) => item.path === "/api/generate");

    assert.equal(chatEntry.generatedPreview, "Generated Steward chat content.");
    assert.equal(generateEntry.generatedPreview, "Generated appeal draft content.");

    const serializedLog = JSON.stringify(runtime.requestLog);
    assert.equal(serializedLog.includes("private prompt stays out"), false);
    assert.equal(serializedLog.includes("private generation prompt stays out"), false);
    assert.equal(serializedLog.includes("preview-key"), false);
  } finally {
    await bridge.stop();
    await new Promise((resolve) => upstream.server.close(resolve));
  }
});

test("managed Ollama launch env pins one visible GPU and host binding", () => {
  const env = buildOllamaLaunchEnv({
    bridgeUpstreamUrl: "http://127.0.0.1:12555",
    bridgeCudaDevice: "2",
    ollamaRuntimeMode: "managed",
    ollamaExecutablePath: "C:/Ollama/ollama.exe",
  }, {
    PATH: "C:/Windows/System32",
    CUDA_VISIBLE_DEVICES: "0,1,2,3",
  });

  assert.equal(env.OLLAMA_HOST, "127.0.0.1:12555");
  assert.equal(env.CUDA_VISIBLE_DEVICES, "2");
  assert.equal(env.NVIDIA_VISIBLE_DEVICES, "2");
  assert.equal(env.GPU_DEVICE_ORDINAL, "2");
  assert.equal(env.OYAMA_OLLAMA_GPU_MODE, "pinned");
});

test("auto GPU mode clears inherited visibility overrides", () => {
  const env = buildOllamaLaunchEnv({
    bridgeUpstreamUrl: "http://localhost:11434",
    bridgeCudaDevice: "auto",
    ollamaRuntimeMode: "managed",
  }, {
    CUDA_VISIBLE_DEVICES: "1",
    NVIDIA_VISIBLE_DEVICES: "1",
    GPU_DEVICE_ORDINAL: "1",
  });

  assert.equal(env.OLLAMA_HOST, "localhost:11434");
  assert.equal("CUDA_VISIBLE_DEVICES" in env, false);
  assert.equal("NVIDIA_VISIBLE_DEVICES" in env, false);
  assert.equal("GPU_DEVICE_ORDINAL" in env, false);
  assert.equal(env.OYAMA_OLLAMA_GPU_MODE, "auto");
});

test("managed mode rejects remote upstream URLs", () => {
  assert.throws(() => {
    resolveOllamaRuntimeSettings({
      ollamaRuntimeMode: "managed",
      bridgeUpstreamUrl: "https://shared-ollama.example.com:11434",
      bridgeCudaDevice: "0",
    });
  }, /Managed Ollama mode requires a local upstream URL/);
});

test("managed runtime refuses to claim a port already owned by another Ollama service", async () => {
  const upstream = await startUpstreamServer((req, res) => {
    if (req.url !== "/api/version") {
      res.statusCode = 404;
      res.end("not found");
      return;
    }

    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ version: "0.6.0-test" }));
  });

  const runtimeManager = createOllamaRuntimeManager(() => ({
    ollamaRuntimeMode: "managed",
    bridgeUpstreamUrl: `http://127.0.0.1:${upstream.port}`,
    bridgeCudaDevice: "1",
    ollamaExecutablePath: "ollama",
  }));

  try {
    await assert.rejects(() => runtimeManager.start(), /cannot guarantee GPU selection/);
    const state = runtimeManager.getState();
    assert.equal(state.status, "managed-port-in-use");
    assert.equal(state.running, true);
    assert.equal(state.ready, true);
    assert.equal(state.version, "0.6.0-test");
  } finally {
    await new Promise((resolve) => upstream.server.close(resolve));
  }
});

test("GPU list parser preserves UUIDs from nvidia-smi -L output", () => {
  const devices = parseGpuListOutput([
    "GPU 0: NVIDIA GeForce RTX 3090 (UUID: GPU-cfcac369-8d20-296b-373b-0c4d627b543d)",
    "GPU 1: NVIDIA GeForce RTX 5060 Ti (UUID: GPU-2ee92a64-23c5-be1e-4dbb-1270e1ae04ca)",
  ].join("\n"));

  assert.equal(devices.length, 2);
  assert.equal(devices[0].index, 0);
  assert.equal(devices[0].uuid, "GPU-cfcac369-8d20-296b-373b-0c4d627b543d");
  assert.equal(devices[1].index, 1);
  assert.equal(devices[1].uuid, "GPU-2ee92a64-23c5-be1e-4dbb-1270e1ae04ca");
});

test("GPU telemetry parser keeps metrics from wrapped nvidia-smi CSV output", () => {
  const telemetry = parseGpuTelemetryCsv([
    "0, GPU-cfcac369-8d20-296b-373b-0c4d627b543d, NVIDIA GeForce RTX 3090, 0, 33, 224",
    ", 24576, 7.42",
    "1, GPU-2ee92a64-23c5-be1e-4dbb-1270e1ae04ca, NVIDIA GeForce RTX 5060 Ti, 11, 40,",
    " 2099, 16311, 20.30",
  ].join("\n"));

  assert.equal(telemetry.length, 2);
  assert.deepEqual(telemetry[0], {
    index: 0,
    uuid: "GPU-cfcac369-8d20-296b-373b-0c4d627b543d",
    name: "NVIDIA GeForce RTX 3090",
    utilizationPct: 0,
    temperatureC: 33,
    memoryUsedMiB: 224,
    memoryTotalMiB: 24576,
    powerDrawW: 7.42,
    memory: "24576 MiB",
  });
  assert.deepEqual(telemetry[1], {
    index: 1,
    uuid: "GPU-2ee92a64-23c5-be1e-4dbb-1270e1ae04ca",
    name: "NVIDIA GeForce RTX 5060 Ti",
    utilizationPct: 11,
    temperatureC: 40,
    memoryUsedMiB: 2099,
    memoryTotalMiB: 16311,
    powerDrawW: 20.3,
    memory: "16311 MiB",
  });
});
