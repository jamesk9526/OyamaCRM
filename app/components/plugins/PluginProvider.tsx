/**
 * PluginProvider: React context that fetches QuickBooks plugin status once on mount
 * and makes it available to all child components via the `usePlugins` hook.
 *
 * Only DonorCRM uses this — QB features are gated behind { qbEnabled } being true.
 */
"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { apiFetch } from "@/app/lib/auth-client";

/** Shape of QuickBooks plugin state exposed to the app */
export interface PluginState {
  /** True if QB_CLIENT_ID and QB_CLIENT_SECRET env vars are present on the server */
  qbConfigured: boolean;
  /** True if an admin has enabled the QuickBooks plugin for this org */
  qbEnabled: boolean;
  /** True if OAuth tokens have been stored (org is connected to QB) */
  qbConnected: boolean;
  /** QB company realm ID, present when connected */
  qbRealmId: string | null;
  /** "sandbox" or "production" */
  qbEnvironment: string;
  /** Where runtime OAuth credentials come from: env or plugin config */
  qbRuntimeSource: "env" | "plugin" | null;
  /** OAuth callback URI currently used by runtime credentials */
  qbRedirectUri: string | null;
  /** Masked client id preview for UI diagnostics */
  qbClientIdPreview: string | null;
  /** True while the initial status fetch is in progress */
  loading: boolean;
  /** Refetch plugin status (e.g. after connecting or disconnecting) */
  refresh: () => void;
}

const defaultState: PluginState = {
  qbConfigured: false,
  qbEnabled: false,
  qbConnected: false,
  qbRealmId: null,
  qbEnvironment: "sandbox",
  qbRuntimeSource: null,
  qbRedirectUri: null,
  qbClientIdPreview: null,
  loading: true,
  refresh: () => {},
};

const PluginContext = createContext<PluginState>(defaultState);

/**
 * Hook to access plugin state anywhere inside PluginProvider.
 * Always use this instead of consuming the context directly.
 */
export function usePlugins(): PluginState {
  return useContext(PluginContext);
}

/**
 * PluginProvider wraps the app (or AppShell) and fetches /api/quickbooks/status once.
 * Gracefully handles auth errors (non-logged-in users get all-false state).
 *
 * @param children - Child components that can call usePlugins()
 */
export function PluginProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Omit<PluginState, "refresh">>({ ...defaultState });
  const [tick, setTick] = useState(0);

  // Refresh function increments tick to trigger re-fetch
  const refresh = () => setTick((t) => t + 1);

  useEffect(() => {
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await apiFetch("/api/quickbooks/status");
        const { data } = res as {
          data: {
            configured: boolean;
            enabled: boolean;
            connected: boolean;
            realmId: string | null;
            environment: string;
            runtimeSource?: "env" | "plugin" | null;
            redirectUri?: string | null;
            clientIdPreview?: string | null;
          };
        };
        if (!cancelled) {
          setState({
            qbConfigured: data.configured,
            qbEnabled: data.enabled,
            qbConnected: data.connected,
            qbRealmId: data.realmId,
            qbEnvironment: data.environment,
            qbRuntimeSource: data.runtimeSource ?? null,
            qbRedirectUri: data.redirectUri ?? null,
            qbClientIdPreview: data.clientIdPreview ?? null,
            loading: false,
          });
        }
      } catch {
        // Not logged in or server error — use defaults (all false)
        if (!cancelled) {
          setState((prev) => ({ ...prev, loading: false }));
        }
      }
    }

    fetchStatus();
    return () => { cancelled = true; };
  }, [tick]);

  return (
    <PluginContext.Provider value={{ ...state, refresh }}>
      {children}
    </PluginContext.Provider>
  );
}
