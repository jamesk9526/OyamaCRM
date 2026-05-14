const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const { once } = require("node:events");

const { createBridgeServer } = require("../bridge-server");

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

    const runtime = bridge.getRuntimeState();
    assert.equal(runtime.requestCount, 1);
    assert.ok(Array.isArray(runtime.requestLog));
    assert.ok(runtime.requestLog.length >= 4);
    assert.ok(runtime.requestLog.some((entry) => entry.statusCode === 200));
    assert.ok(runtime.requestLog.some((entry) => entry.statusCode === 401));
    assert.ok(runtime.requestLog.some((entry) => entry.statusCode === 403));
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
    assert.equal(receivedPayload?.options?.num_gpu, 1);
  } finally {
    await bridge.stop();
    await new Promise((resolve) => upstream.server.close(resolve));
  }
});
