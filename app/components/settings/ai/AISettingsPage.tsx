/** AISettingsPage configures Steward AI local/remote Ollama connection options. */
"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type StewardAiMode = "local" | "remote";

interface StewardAiConfigResponse {
  enabled: boolean;
  mode: StewardAiMode;
  endpointUrl: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutMs: number;
  systemPrompt: string;
  hasApiKey: boolean;
}

interface StewardAiTestResponse {
  ok: boolean;
  latencyMs: number;
  modelCount: number;
  firstModel: string | null;
}

/** AISettingsPage provides admin controls for local and remote Ollama deployment modes. */
export default function AISettingsPage() {
  const [config, setConfig] = useState<StewardAiConfigResponse | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [testResult, setTestResult] = useState<StewardAiTestResponse | null>(null);

  /** Loads saved AI config from the API. */
  async function loadConfig() {
    setLoading(true);
    setNotice(null);
    try {
      const response = await apiFetch<StewardAiConfigResponse>("/api/steward-ai/config");
      setConfig(response);
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to load AI settings.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadConfig();
  }, []);

  const endpointHint = useMemo(() => {
    if (config?.mode === "remote") {
      return "Remote Ollama URL (for hosted or LAN endpoint, e.g. https://ai.myorg.org)";
    }
    return "Local Ollama URL (default: http://127.0.0.1:11434)";
  }, [config?.mode]);

  /** Updates one config field in local component state. */
  function updateConfig<K extends keyof StewardAiConfigResponse>(key: K, value: StewardAiConfigResponse[K]) {
    setConfig((prev) => {
      if (!prev) return prev;
      return { ...prev, [key]: value };
    });
  }

  /** Persists AI config to the backend for the active organization. */
  async function saveConfig() {
    if (!config) return;
    setSaving(true);
    setNotice(null);

    try {
      const payload = {
        ...config,
        apiKey: apiKeyInput.trim() || undefined,
      };
      const response = await apiFetch<StewardAiConfigResponse>("/api/steward-ai/config", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      setConfig(response);
      setApiKeyInput("");
      setNotice({ type: "success", message: "Steward AI settings saved." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to save AI settings.",
      });
    } finally {
      setSaving(false);
    }
  }

  /** Tests active AI endpoint connectivity without sending user data. */
  async function runConnectionTest() {
    setTesting(true);
    setNotice(null);
    setTestResult(null);

    try {
      const response = await apiFetch<StewardAiTestResponse>("/api/steward-ai/test", {
        method: "POST",
      });
      setTestResult(response);
      setNotice({ type: "success", message: "Connection test succeeded." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Connection test failed.",
      });
    } finally {
      setTesting(false);
    }
  }

  if (loading || !config) {
    return (
      <div className="space-y-3">
        <h1 className="text-xl font-semibold text-gray-900">AI Assistant</h1>
        <p className="text-sm text-gray-500">Loading AI settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">AI Assistant</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Configure Steward AI using a local Ollama runtime or a remote hosted Ollama endpoint.
        </p>
      </div>

      {notice && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${notice.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {notice.message}
        </div>
      )}

      <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Steward AI Runtime</h2>
            <p className="text-xs text-gray-500 mt-0.5">Choose local or remote mode, then set Ollama endpoint + model.</p>
          </div>
          <label className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <input
              type="checkbox"
              checked={config.enabled}
              onChange={(event) => updateConfig("enabled", event.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Enabled
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className={`rounded-lg border p-3 text-sm cursor-pointer ${config.mode === "local" ? "border-green-300 bg-green-50" : "border-gray-200"}`}>
            <input
              type="radio"
              name="steward-ai-mode"
              checked={config.mode === "local"}
              onChange={() => updateConfig("mode", "local")}
              className="mr-2"
            />
            Local Mode
            <p className="text-xs text-gray-500 mt-1">Use Ollama on this machine or private localhost network.</p>
          </label>
          <label className={`rounded-lg border p-3 text-sm cursor-pointer ${config.mode === "remote" ? "border-green-300 bg-green-50" : "border-gray-200"}`}>
            <input
              type="radio"
              name="steward-ai-mode"
              checked={config.mode === "remote"}
              onChange={() => updateConfig("mode", "remote")}
              className="mr-2"
            />
            Remote Mode
            <p className="text-xs text-gray-500 mt-1">Use a hosted or remote Ollama endpoint (site, LAN, or VPN).</p>
          </label>
        </div>

        <div className="grid sm:grid-cols-2 gap-3">
          <label className="text-sm text-gray-700">
            Endpoint URL
            <input
              type="url"
              value={config.endpointUrl}
              onChange={(event) => updateConfig("endpointUrl", event.target.value)}
              placeholder={endpointHint}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="text-sm text-gray-700">
            Model
            <input
              type="text"
              value={config.model}
              onChange={(event) => updateConfig("model", event.target.value)}
              placeholder="llama3.2:3b"
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="text-sm text-gray-700">
            Temperature
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={config.temperature}
              onChange={(event) => updateConfig("temperature", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="text-sm text-gray-700">
            Max Tokens
            <input
              type="number"
              min={64}
              max={4096}
              step={32}
              value={config.maxTokens}
              onChange={(event) => updateConfig("maxTokens", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="text-sm text-gray-700">
            Timeout (ms)
            <input
              type="number"
              min={3000}
              max={120000}
              step={1000}
              value={config.timeoutMs}
              onChange={(event) => updateConfig("timeoutMs", Number(event.target.value))}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>

          <label className="text-sm text-gray-700">
            API Key (optional)
            <input
              type="password"
              value={apiKeyInput}
              onChange={(event) => setApiKeyInput(event.target.value)}
              placeholder={config.hasApiKey ? "Saved key exists. Enter a new key to replace it." : "Optional bearer token for remote gateway"}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </label>
        </div>

        <label className="text-sm text-gray-700 block">
          System Prompt
          <textarea
            value={config.systemPrompt}
            onChange={(event) => updateConfig("systemPrompt", event.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={saveConfig}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save AI Settings"}
          </button>

          <button
            onClick={runConnectionTest}
            disabled={testing}
            className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {testing ? "Testing..." : "Test Connection"}
          </button>

          <span className="text-xs text-gray-500">Use Local Mode for on-device privacy, or Remote Mode for hosted inference.</span>
        </div>

        {testResult && (
          <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-xs text-green-800">
            Connection OK in {testResult.latencyMs}ms. Models detected: {testResult.modelCount}
            {testResult.firstModel ? ` (first: ${testResult.firstModel})` : ""}.
          </div>
        )}
      </section>
    </div>
  );
}
