/**
 * PluginsSettingsPage: Admin UI for managing third-party plugin integrations.
 * Currently supports QuickBooks — enable/disable the plugin, connect/disconnect OAuth.
 */
"use client";

import { useState } from "react";
import { usePlugins } from "@/app/components/plugins/PluginProvider";
import QBConnectionStatus from "@/app/components/quickbooks/QBConnectionStatus";
import { apiFetch } from "@/app/lib/auth-client";

/**
 * Full-page plugin management UI.
 * Shows a QuickBooks card with enable toggle, connection status, and connect/disconnect actions.
 */
export default function PluginsSettingsPage() {
  const { qbConfigured, qbEnabled, loading, refresh } = usePlugins();
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

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
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Plugins</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Manage third-party integrations. Plugins must be enabled by an admin before staff can use them.
        </p>
      </div>

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
