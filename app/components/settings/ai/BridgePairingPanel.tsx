/** BridgePairingPanel generates desktop bridge pairing assets and readiness checks. */
"use client";

import { useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

type ReadinessStatus = "Working" | "Partially Working" | "Broken";

interface BridgeReadinessCheck {
  id: string;
  label: string;
  status: ReadinessStatus;
  detail: string;
}

interface BridgeReadinessPayload {
  status: ReadinessStatus;
  summary: string;
  checks: BridgeReadinessCheck[];
  testedAt: string;
}

interface BridgePairingKeyPayload {
  version: number;
  kind: string;
  generatedAt: string;
  expiresAt: string;
  organizationId: string;
  organizationName: string;
  bridgeConfig: {
    bridgeAutostart: boolean;
    bridgeUpstreamUrl: string;
    bridgePort: number;
    bridgeApiKey: string;
    bridgeAllowedOrigins: string;
    bridgePublicBaseUrl: string;
    bridgeDomainUrl: string;
    bridgeModel: string;
    bridgeThinkingModel: string;
    bridgeCudaDevice: string;
    bridgeTemperature: number;
    bridgeTimeoutMs: number;
  };
  aiHints: {
    mode: string;
    endpointUrl: string;
    model: string;
    thinkingModel: string;
  };
}

interface PairingResponse {
  pairingUrl: string;
  pairingToken: string;
  expiresAt: string;
  connectionKey: BridgePairingKeyPayload;
  readiness: BridgeReadinessPayload;
}

/** Bridge pairing controls let admins configure desktop bridge in one step. */
export default function BridgePairingPanel() {
  const [siteUrl, setSiteUrl] = useState("");
  const [generating, setGenerating] = useState(false);
  const [checkingReadiness, setCheckingReadiness] = useState(false);
  const [pairing, setPairing] = useState<PairingResponse | null>(null);
  const [readiness, setReadiness] = useState<BridgeReadinessPayload | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; message: string } | null>(null);

  function statusClasses(status: ReadinessStatus): string {
    if (status === "Working") return "bg-green-100 text-green-800 border-green-200";
    if (status === "Partially Working") return "bg-amber-100 text-amber-800 border-amber-200";
    return "bg-red-100 text-red-800 border-red-200";
  }

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setNotice({ type: "success", message: `${label} copied.` });
    } catch {
      setNotice({ type: "error", message: `Failed to copy ${label.toLowerCase()}.` });
    }
  }

  async function generatePairingAssets() {
    setGenerating(true);
    setNotice(null);
    try {
      const response = await apiFetch<PairingResponse>("/api/steward-ai/bridge/pairing-key", {
        method: "POST",
        body: JSON.stringify({
          siteUrl: siteUrl.trim() || undefined,
        }),
      });
      setPairing(response);
      setReadiness(response.readiness);
      setNotice({ type: "success", message: "Bridge pairing URL and connection key generated." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Failed to generate bridge pairing key.",
      });
    } finally {
      setGenerating(false);
    }
  }

  async function refreshReadiness() {
    setCheckingReadiness(true);
    setNotice(null);
    try {
      const response = await apiFetch<BridgeReadinessPayload>("/api/steward-ai/bridge/readiness?live=1");
      setReadiness(response);
      setNotice({ type: "success", message: "Bridge readiness check updated." });
    } catch (error) {
      setNotice({
        type: "error",
        message: error instanceof Error ? error.message : "Bridge readiness check failed.",
      });
    } finally {
      setCheckingReadiness(false);
    }
  }

  function downloadConnectionKey() {
    if (!pairing) return;

    const payload = {
      kind: "oyama.bridge.connection-key",
      exportedAt: new Date().toISOString(),
      pairingUrl: pairing.pairingUrl,
      pairingToken: pairing.pairingToken,
      expiresAt: pairing.expiresAt,
      connectionKey: pairing.connectionKey,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    link.href = URL.createObjectURL(blob);
    link.download = `oyama-bridge-connection-key-${stamp}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
    setNotice({ type: "success", message: "Connection key downloaded." });
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Oyama Bridge Pairing</h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Generate a pairing URL or key file, paste/import it in Desktop Bridge Manager, and complete setup in one step.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshReadiness}
          disabled={checkingReadiness}
          className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          {checkingReadiness ? "Checking..." : "Run Bridge Readiness Check"}
        </button>
      </div>

      {notice && (
        <div className={`rounded-lg border px-3 py-2 text-xs ${notice.type === "success" ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {notice.message}
        </div>
      )}

      <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
        <label className="text-sm text-gray-700">
          CRM Site URL (optional)
          <input
            type="url"
            value={siteUrl}
            onChange={(event) => setSiteUrl(event.target.value)}
            placeholder="https://crm.yourorg.org"
            className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
          <span className="mt-1 block text-xs text-gray-500">
            Leave blank to auto-use the current CRM domain.
          </span>
        </label>

        <button
          type="button"
          onClick={generatePairingAssets}
          disabled={generating}
          className="h-10 px-4 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700 disabled:opacity-60"
        >
          {generating ? "Generating..." : "Generate Pairing URL + Key"}
        </button>
      </div>

      {pairing && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-3 bg-gray-50">
          <div>
            <p className="text-xs font-semibold text-gray-700">Pairing URL</p>
            <p className="text-xs text-gray-500 mt-1 break-all">{pairing.pairingUrl}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => copyText(pairing.pairingUrl, "Pairing URL")}
              className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-white"
            >
              Copy Pairing URL
            </button>
            <button
              type="button"
              onClick={downloadConnectionKey}
              className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-white"
            >
              Download Connection Key
            </button>
            <button
              type="button"
              onClick={() => copyText(pairing.pairingToken, "Pairing token")}
              className="px-3 py-2 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-white"
            >
              Copy Raw Pairing Token
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Expires: {new Date(pairing.expiresAt).toLocaleString()}.
            In Desktop Bridge Manager, use Pair from URL or Import Key File.
          </p>
        </div>
      )}

      {readiness && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-3">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${statusClasses(readiness.status)}`}>
              {readiness.status}
            </span>
            <span className="text-xs text-gray-500">{new Date(readiness.testedAt).toLocaleString()}</span>
          </div>
          <p className="text-sm text-gray-700">{readiness.summary}</p>
          <ul className="space-y-2">
            {readiness.checks.map((check) => (
              <li key={check.id} className="rounded-md border border-gray-200 px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-800">{check.label}</p>
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${statusClasses(check.status)}`}>
                    {check.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-gray-500">{check.detail}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
