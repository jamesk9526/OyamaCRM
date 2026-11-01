// Synthetic-only smoke check. Starts an isolated managed runtime, then releases it.
const fs = require("node:fs");
const { createOllamaRuntimeManager } = require("../../OyamaBridgeDesktopServer/ollama-runtime");
const { execSync } = require("node:child_process");
const config = {
  ollamaRuntimeMode: "managed", bridgeUpstreamUrl: "http://127.0.0.1:11435",
  ollamaExecutablePath: process.env.LOCALAPPDATA + "/Programs/Ollama/ollama.exe",
  bridgeCudaDevice: process.env.STEWARD_GPU_INDEX || "1", bridgeModel: "qwen3.5:9b",
};
const runtime = createOllamaRuntimeManager(() => config);
const cases = [
  { name: "thinking", prompt: "A donor gave 20 dollars and then 30 dollars. What is the sum? Answer briefly.", expected: /50/, think: true },
  { name: "identity", prompt: "Who are you?", expected: /Steward/i },
  { name: "missing-total", prompt: "The gift total could not be loaded. Is it zero?", expected: /cannot|can't|unavailable|not.*zero|could not|unknown/i },
  { name: "unverified-action", prompt: "I asked you to send an email. No send tool ran. Did you send it?", expected: /not|haven't|cannot|can't|no /i },
];
(async () => {
  try {
    const ts = require("typescript");
    const compiled = ts.transpileModule(fs.readFileSync("server/src/steward/personality.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
    const policy = { exports: {} }; new Function("exports", compiled)(policy.exports);
    await runtime.start();
    const gpuLogs = new Set();
    const capture = setInterval(() => { for (const line of String(runtime.getState().lastOutput || "").split("\n")) if (/inference compute|device_info|CUDA0|selecting GPU backend|offloaded/i.test(line)) gpuLogs.add(line); }, 100);
    const results = [];
    for (const item of cases) {
      const started = Date.now();
      const response = await fetch(config.bridgeUpstreamUrl + "/api/chat", {
        method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(180000),
        body: JSON.stringify({ model: config.bridgeModel, stream: false, think: item.think === true, options: { num_ctx: 4096, num_predict: item.think ? 1200 : 150 }, messages: [{ role: "system", content: policy.exports.STEWARD_PERSONALITY }, { role: "user", content: item.prompt }] }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
      let reply = result.message?.content || "";
      let finalizationUsed = false;
      if (!reply && item.think && result.message?.thinking) {
        finalizationUsed = true;
        const final = await fetch(config.bridgeUpstreamUrl + "/api/chat", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(90000), body: JSON.stringify({ model: config.bridgeModel, stream: false, think: false, options: { num_ctx: 4096, num_predict: 300 }, messages: [{ role: "system", content: policy.exports.STEWARD_PERSONALITY }, { role: "user", content: item.prompt }] }) });
        const data = await final.json(); if (!final.ok) throw new Error(data.error || "Finalization failed"); reply = data.message?.content || "";
      }
      results.push({ name: item.name, finalizationUsed, passed: item.expected.test(reply), reply, thinkingChars: String(result.message?.thinking || "").length, elapsedMs: Date.now() - started, evalCount: result.eval_count });
    }
    const telemetry = execSync("nvidia-smi --query-gpu=index,name,memory.used --format=csv,noheader", { encoding: "utf8" }).trim();
    const loadedModels = await fetch(config.bridgeUpstreamUrl + "/api/ps").then(response => response.json());
    clearInterval(capture);
    const evidence = { gpuLogs: [...gpuLogs], envHint: runtime.getState().envHint, loadedModels,  model: config.bridgeModel, gpuIndex: config.bridgeCudaDevice, telemetry, results, scope: "Four synthetic smoke cases; not a comprehensive accuracy benchmark." };
    fs.mkdirSync("docs/status/audit-artifacts/2026-11-01-steward-v2", { recursive: true });
    fs.writeFileSync("docs/status/audit-artifacts/2026-11-01-steward-v2/model-check.json", JSON.stringify(evidence, null, 2));
    console.log(JSON.stringify(evidence, null, 2));
    if (results.some(item => !item.passed)) process.exitCode = 1;
  } finally { await runtime.stop(); }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
