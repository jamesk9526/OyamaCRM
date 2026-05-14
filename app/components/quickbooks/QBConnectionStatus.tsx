/**
 * QBConnectionStatus: Shows a banner indicating QuickBooks connection state.
 * Used in the Plugins settings page and optionally the QB Sync queue page.
 */
"use client";

import { usePlugins } from "@/app/components/plugins/PluginProvider";

interface Props {
  /** Called when the user clicks "Connect" — should redirect to authUri */
  onConnect: () => void;
  /** Called when the user clicks "Disconnect" */
  onDisconnect: () => void;
  /** Whether a connection/disconnection action is in progress */
  loading?: boolean;
}

/**
 * Renders a colored status card:
 * - Green = connected
 * - Yellow = enabled but not connected
 * - Gray = disabled / not configured
 *
 * @param onConnect    - Callback when user wants to connect
 * @param onDisconnect - Callback when user wants to disconnect
 * @param loading      - Disables buttons during async operations
 */
export default function QBConnectionStatus({ onConnect, onDisconnect, loading = false }: Props) {
  const { qbConfigured, qbEnabled, qbConnected, qbRealmId, qbEnvironment, qbRuntimeSource } = usePlugins();

  if (!qbConfigured) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-start gap-3">
        <span className="text-gray-400 mt-0.5">
          {/* Warning icon */}
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </span>
        <div>
          <p className="text-sm font-medium text-gray-700">QuickBooks not configured</p>
          <p className="text-xs text-gray-500 mt-0.5">
            Add OAuth runtime credentials in Plugins (recommended) or set
            <code className="font-mono"> QB_CLIENT_ID </code> and
            <code className="font-mono"> QB_CLIENT_SECRET </code> server environment variables.
          </p>
        </div>
      </div>
    );
  }

  if (!qbEnabled) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-gray-400 shrink-0" />
        <p className="text-sm text-gray-600">QuickBooks plugin is <strong>disabled</strong>. Enable it above to allow syncing donations.</p>
      </div>
    );
  }

  if (!qbConnected) {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-yellow-400 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-800">Not connected to QuickBooks</p>
            <p className="text-xs text-yellow-700 mt-0.5">
              Authorize OyamaCRM to push donations to your QuickBooks {qbEnvironment} account.
              {qbRuntimeSource ? ` Runtime source: ${qbRuntimeSource}.` : ""}
            </p>
          </div>
        </div>
        <button
          onClick={onConnect}
          disabled={loading}
          className="px-4 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white text-sm font-medium rounded-lg disabled:opacity-60 transition-colors whitespace-nowrap"
        >
          Connect to QuickBooks
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-green-200 bg-green-50 p-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
        <div>
          <p className="text-sm font-medium text-green-800">Connected to QuickBooks</p>
          <p className="text-xs text-green-700 mt-0.5">
            {qbEnvironment === "sandbox" ? "🧪 Sandbox account" : "🏢 Production account"}
            {qbRealmId ? ` · Realm ID: ${qbRealmId}` : ""}
          </p>
        </div>
      </div>
      <button
        onClick={onDisconnect}
        disabled={loading}
        className="px-4 py-1.5 border border-green-300 text-green-700 text-sm font-medium rounded-lg hover:bg-green-100 disabled:opacity-60 transition-colors whitespace-nowrap"
      >
        Disconnect
      </button>
    </div>
  );
}
