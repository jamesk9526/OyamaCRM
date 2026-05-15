/**
 * PluginsSettingsPage: Admin UI for managing third-party plugin integrations.
 * Currently supports QuickBooks — enable/disable the plugin, connect/disconnect OAuth.
 */
"use client";

import { useEffect, useState } from "react";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import QBConnectionStatus from "@/app/components/quickbooks/QBConnectionStatus";
import { apiFetch } from "@/app/lib/auth-client";

/**
 * Full-page plugin management UI.
 * Shows a QuickBooks card with enable toggle, connection status, and connect/disconnect actions.
 */
export default function PluginsSettingsPage({ embedded = false }: { embedded?: boolean }) {
  const { qbConfigured, qbEnabled, loading, refresh, qbRuntimeSource, qbRedirectUri, qbEnvironment, qbClientIdPreview } = usePlugins();
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [runtimeClientId, setRuntimeClientId] = useState("");
  const [runtimeClientSecret, setRuntimeClientSecret] = useState("");
  const [runtimeRedirectUri, setRuntimeRedirectUri] = useState("http://localhost:4000/api/quickbooks/callback");
  const [runtimeEnvironment, setRuntimeEnvironment] = useState<"sandbox" | "production">("sandbox");

  useEffect(() => {
    if (qbRedirectUri) {
      setRuntimeRedirectUri(qbRedirectUri);
    }
    if (qbEnvironment === "production" || qbEnvironment === "sandbox") {
      setRuntimeEnvironment(qbEnvironment);
    }
  }, [qbRedirectUri, qbEnvironment]);

  /** Show a dismissing toast notification */
  function showToast(type: "success" | "error", message: string) {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  }

  /** Toggle the QB plugin enabled/disabled state */
  async function handleTogglePlugin(enabled: boolean) {
    setActionLoading(true);
    try {
      await apiFetch("/api/quickbooks/plugin", {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      });
      refresh();
      showToast("success", enabled ? "QuickBooks plugin enabled." : "QuickBooks plugin disabled.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to update plugin.");
    } finally {
      setActionLoading(false);
    }
  }

  /** Redirect to QB OAuth authorization URL */
  async function handleConnect() {
    setActionLoading(true);
    try {
      const res = await apiFetch("/api/quickbooks/auth-uri") as { data: { authUri: string } };
      window.location.href = res.data.authUri;
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to start QuickBooks connection.");
      setActionLoading(false);
    }
  }

  /** Saves plugin-level runtime credentials so OAuth can be configured without server env vars. */
  async function handleSaveRuntimeCredentials() {
    if (!runtimeClientId.trim() || !runtimeClientSecret.trim()) {
      showToast("error", "Client ID and Client Secret are required.");
      return;
    }

    setActionLoading(true);
    try {
      await apiFetch("/api/quickbooks/runtime-config", {
        method: "PUT",
        body: JSON.stringify({
          clientId: runtimeClientId,
          clientSecret: runtimeClientSecret,
          redirectUri: runtimeRedirectUri,
          environment: runtimeEnvironment,
        }),
      });
      setRuntimeClientSecret("");
      refresh();
      showToast("success", "QuickBooks runtime credentials saved.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to save runtime credentials.");
    } finally {
      setActionLoading(false);
    }
  }

  /** Revoke QB OAuth tokens */
  async function handleDisconnect() {
    if (!confirm("Disconnect QuickBooks? You can reconnect at any time.")) return;
    setActionLoading(true);
    try {
      await apiFetch("/api/quickbooks/disconnect", { method: "POST" });
      refresh();
      showToast("success", "QuickBooks disconnected.");
    } catch (err) {
      showToast("error", err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {!embedded && (
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Plugins</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage third-party integrations. Plugins must be enabled by an admin before staff can use them.
          </p>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`rounded-lg px-4 py-3 text-sm font-medium flex items-center justify-between ${
          toast.type === "success"
            ? "bg-green-50 border border-green-200 text-green-800"
            : "bg-red-50 border border-red-200 text-red-800"
        }`}>
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-3 opacity-60 hover:opacity-100">✕</button>
        </div>
      )}

      {/* QuickBooks Plugin Card */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Card header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {/* QB logo approximation */}
            <div className="w-10 h-10 rounded-lg bg-[#2CA01C] flex items-center justify-center shrink-0">
              <span className="text-white font-bold text-sm">QB</span>
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">QuickBooks Online</h2>
              <p className="text-xs text-gray-500">
                Sync donations to QuickBooks as sales receipts or deposits.
              </p>
            </div>
          </div>

          {/* Enable / Disable toggle — only shows if QB env vars are configured */}
          {!loading && qbConfigured && (
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <span className="text-sm text-gray-600 font-medium">
                {qbEnabled ? "Enabled" : "Disabled"}
              </span>
              <button
                role="switch"
                aria-checked={qbEnabled}
                disabled={actionLoading}
                onClick={() => handleTogglePlugin(!qbEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                  qbEnabled ? "bg-green-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    qbEnabled ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </label>
          )}
        </div>

        {/* Connection status and actions */}
        <div className="px-6 py-4 space-y-4">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">Runtime OAuth Credentials</p>
              <p className="text-xs text-slate-600 mt-0.5">
                Use this when server env vars are unavailable. Stored per organization in plugin settings.
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Current source: {qbRuntimeSource ?? "none"}
                {qbClientIdPreview ? ` · Client ID: ${qbClientIdPreview}` : ""}
              </p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Client ID</span>
                <input
                  type="text"
                  value={runtimeClientId}
                  onChange={(event) => setRuntimeClientId(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="QuickBooks app client id"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Client Secret</span>
                <input
                  type="password"
                  value={runtimeClientSecret}
                  onChange={(event) => setRuntimeClientSecret(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="QuickBooks app client secret"
                />
              </label>
              <label className="block md:col-span-2">
                <span className="text-xs font-medium text-slate-700">Redirect URI</span>
                <input
                  type="text"
                  value={runtimeRedirectUri}
                  onChange={(event) => setRuntimeRedirectUri(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                  placeholder="http://localhost:4000/api/quickbooks/callback"
                />
              </label>
              <label className="block">
                <span className="text-xs font-medium text-slate-700">Environment</span>
                <select
                  value={runtimeEnvironment}
                  onChange={(event) => setRuntimeEnvironment(event.target.value === "production" ? "production" : "sandbox")}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="sandbox">Sandbox</option>
                  <option value="production">Production</option>
                </select>
              </label>
            </div>
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => void handleSaveRuntimeCredentials()}
                disabled={actionLoading}
                className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Save Runtime Credentials
              </button>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-400">Loading plugin status…</div>
          ) : (
            <>
              <QBConnectionStatus
                onConnect={handleConnect}
                onDisconnect={handleDisconnect}
                loading={actionLoading}
              />

              {/* Feature description */}
              {qbEnabled && (
                <div className="text-xs text-gray-500 space-y-1 pt-1">
                  <p className="font-medium text-gray-600">What this plugin does:</p>
                  <ul className="list-disc pl-4 space-y-0.5">
                    <li>Adds an <strong>Add to QuickBooks Queue</strong> button when recording donations</li>
                    <li>Shows a <strong>QB Sync</strong> tab in the sidebar for managing the queue</li>
                    <li>Lets staff review, edit, and manually sync queued donations to QuickBooks</li>
                    <li>Never syncs automatically — staff always review before pushing</li>
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Placeholder for future plugins */}
      <div className="bg-white rounded-xl border border-dashed border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-400">More integrations coming soon — Stripe, Mailchimp, and more.</p>
      </div>
    </div>
  );
}
