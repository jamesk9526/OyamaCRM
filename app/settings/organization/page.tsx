/**
 * Organization settings page.
 * Organization-focused settings form wired to GET/PUT /api/settings.
 * Sections: Organization Info, Regional Settings, and SMTP defaults.
 */
"use client";

import { useState, useEffect } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import { getFiscalYearEndMonth } from "@/app/lib/fiscal-year";

/** Settings shape from GET /api/settings */
interface Settings {
  orgName: string;
  fiscalYearStart: number;
  fiscalYearEnd: number;
  currency: string;
  timezone: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
  smtpPass: string;
  smtpFromName: string;
  smtpFromEmail: string;
}

type EmailProviderType = "standard_smtp" | "microsoft_365_smtp" | "microsoft_graph";

interface EmailProviderSettings {
  provider: EmailProviderType;
  microsoftTenantId: string;
  microsoftClientId: string;
  microsoftClientSecretConfigured: boolean;
  microsoftMailbox: string;
  microsoftRedirectUri: string;
  microsoftScope: string;
  graphConnected: boolean;
  smtpHostOverride: string;
  smtpPortOverride: number;
  smtpSecureOverride: boolean;
}

const CURRENCIES = ["USD", "CAD", "EUR", "GBP", "AUD", "NZD"];
const TIMEZONES = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "America/Phoenix", "America/Anchorage", "Pacific/Honolulu", "America/Toronto",
  "Europe/London", "Europe/Paris", "Australia/Sydney",
];
const MONTHS = [
  "January (1)", "February (2)", "March (3)", "April (4)", "May (5)", "June (6)",
  "July (7)", "August (8)", "September (9)", "October (10)", "November (11)", "December (12)",
];

/** OrganizationSettingsPage renders the primary organization settings form. */
export default function OrganizationSettingsPage() {
  const [form, setForm] = useState<Settings>({
    orgName: "",
    fiscalYearStart: 1,
    fiscalYearEnd: 12,
    currency: "USD",
    timezone: "America/Chicago",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
    smtpPass: "",
    smtpFromName: "",
    smtpFromEmail: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [providerForm, setProviderForm] = useState<EmailProviderSettings>({
    provider: "standard_smtp",
    microsoftTenantId: "",
    microsoftClientId: "",
    microsoftClientSecretConfigured: false,
    microsoftMailbox: "",
    microsoftRedirectUri: "",
    microsoftScope: "Mail.Send offline_access User.Read",
    graphConnected: false,
    smtpHostOverride: "",
    smtpPortOverride: 587,
    smtpSecureOverride: false,
  });
  const [microsoftClientSecretInput, setMicrosoftClientSecretInput] = useState("");
  const [smtpTestRecipient, setSmtpTestRecipient] = useState("");
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [smtpTestMessage, setSmtpTestMessage] = useState<string | null>(null);
  const [smtpTestError, setSmtpTestError] = useState<string | null>(null);
  const [providerTesting, setProviderTesting] = useState(false);
  const [providerTestMessage, setProviderTestMessage] = useState<string | null>(null);
  const [providerTestError, setProviderTestError] = useState<string | null>(null);
  const [graphConnecting, setGraphConnecting] = useState(false);
  const [graphDisconnecting, setGraphDisconnecting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [data, providerData] = await Promise.all([
          apiFetch<Settings>("/api/settings"),
          apiFetch<EmailProviderSettings>("/api/settings/email/provider"),
        ]);
        setForm(data);
        setProviderForm(providerData);
        setSmtpTestRecipient(data.smtpFromEmail || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const graphStatus = params.get("microsoftGraph");
    const reason = params.get("reason");

    if (!graphStatus) return;

    if (graphStatus === "connected") {
      setProviderTestMessage("Microsoft Graph connected successfully.");
      setProviderTestError(null);
      void apiFetch<EmailProviderSettings>("/api/settings/email/provider")
        .then((provider) => setProviderForm(provider))
        .catch(() => {});
    } else if (graphStatus === "disconnected") {
      setProviderTestMessage("Microsoft Graph disconnected.");
      setProviderTestError(null);
    } else {
      setProviderTestError(reason ? `Microsoft Graph connect failed: ${reason}` : "Microsoft Graph connect failed.");
      setProviderTestMessage(null);
    }

    params.delete("microsoftGraph");
    params.delete("reason");
    const nextQuery = params.toString();
    const nextUrl = `${window.location.pathname}${nextQuery ? `?${nextQuery}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, []);

  /** Update a field in the form state */
  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => {
      if (key === "fiscalYearStart") {
        const fiscalYearStart = Number(value) || 1;
        return { ...prev, fiscalYearStart, fiscalYearEnd: getFiscalYearEndMonth(fiscalYearStart) };
      }
      return { ...prev, [key]: value };
    });
    setSuccess(false);
  }

  function setProvider<K extends keyof EmailProviderSettings>(key: K, value: EmailProviderSettings[K]) {
    setProviderForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  }

  /** Save settings via PUT /api/settings */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await Promise.all([
        apiFetch("/api/settings", {
          method: "PUT",
          body: JSON.stringify(form),
        }),
        apiFetch("/api/settings/email/provider", {
          method: "PUT",
          body: JSON.stringify({
            ...providerForm,
            microsoftClientSecret: microsoftClientSecretInput.trim() || undefined,
          }),
        }),
      ]);

      setMicrosoftClientSecretInput("");
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  /** Sends a live SMTP test email using current SMTP form values. */
  async function handleSmtpTestSend() {
    setSmtpTesting(true);
    setSmtpTestError(null);
    setSmtpTestMessage(null);
    try {
      const response = await apiFetch<{ success?: boolean; message?: string }>("/api/settings/smtp/test", {
        method: "POST",
        body: JSON.stringify({
          toEmail: smtpTestRecipient,
          smtpHost: form.smtpHost,
          smtpPort: form.smtpPort,
          smtpSecure: form.smtpSecure,
          smtpUser: form.smtpUser,
          smtpPass: form.smtpPass,
          smtpFromName: form.smtpFromName,
          smtpFromEmail: form.smtpFromEmail,
        }),
      });
      setSmtpTestMessage(response?.message ?? `SMTP test email sent to ${smtpTestRecipient}.`);
    } catch (err) {
      setSmtpTestError(err instanceof Error ? err.message : "SMTP test failed");
    } finally {
      setSmtpTesting(false);
    }
  }

  /** Sends provider-aware test email (Graph currently mocked server-side). */
  async function handleProviderTestSend() {
    setProviderTesting(true);
    setProviderTestError(null);
    setProviderTestMessage(null);

    try {
      const response = await apiFetch<{ success?: boolean; message?: string }>("/api/settings/email/provider/test", {
        method: "POST",
        body: JSON.stringify({
          toEmail: smtpTestRecipient,
        }),
      });
      setProviderTestMessage(response?.message ?? `Provider test completed for ${smtpTestRecipient}.`);
    } catch (err) {
      setProviderTestError(err instanceof Error ? err.message : "Provider test failed");
    } finally {
      setProviderTesting(false);
    }
  }

  /** Starts Microsoft Graph OAuth connect flow after persisting provider settings. */
  async function handleGraphConnect() {
    setGraphConnecting(true);
    setProviderTestError(null);
    setProviderTestMessage(null);

    try {
      const savedProvider = await apiFetch<EmailProviderSettings>("/api/settings/email/provider", {
        method: "PUT",
        body: JSON.stringify({
          ...providerForm,
          provider: "microsoft_graph",
          microsoftClientSecret: microsoftClientSecretInput.trim() || undefined,
        }),
      });

      setProviderForm(savedProvider);
      setMicrosoftClientSecretInput("");

      const response = await apiFetch<{ data?: { authUri?: string } }>("/api/settings/email/provider/microsoft/auth-uri");
      const authUri = response?.data?.authUri;
      if (!authUri) {
        throw new Error("Microsoft Graph auth URL was not returned by the server.");
      }

      window.location.href = authUri;
    } catch (err) {
      setProviderTestError(err instanceof Error ? err.message : "Failed to start Microsoft Graph connect.");
    } finally {
      setGraphConnecting(false);
    }
  }

  /** Disconnects persisted Microsoft Graph OAuth tokens for the active organization. */
  async function handleGraphDisconnect() {
    setGraphDisconnecting(true);
    setProviderTestError(null);
    setProviderTestMessage(null);

    try {
      const response = await apiFetch<{ provider?: EmailProviderSettings; message?: string }>("/api/settings/email/provider/microsoft/disconnect", {
        method: "POST",
        body: JSON.stringify({}),
      });

      if (response.provider) {
        setProviderForm(response.provider);
      } else {
        const latest = await apiFetch<EmailProviderSettings>("/api/settings/email/provider");
        setProviderForm(latest);
      }

      setProviderTestMessage(response.message ?? "Microsoft Graph disconnected.");
    } catch (err) {
      setProviderTestError(err instanceof Error ? err.message : "Failed to disconnect Microsoft Graph.");
    } finally {
      setGraphDisconnecting(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Organization Settings</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organization configuration</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4 animate-pulse">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-9 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Organization Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Organization profile and regional configuration</p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error} — ensure the API server is running with <code className="bg-amber-100 px-1 rounded">pnpm start:server</code>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 font-medium flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          <span>Settings saved successfully.</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Organization Info */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Organization Info</h2>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Organization Name</label>
            <input
              type="text"
              value={form.orgName}
              onChange={(e) => set("orgName", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              placeholder="My Nonprofit Organization"
            />
          </div>
        </div>

        {/* Regional Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Regional Settings</h2>
          <div className="rounded-lg border border-green-100 bg-green-50/60 p-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-green-800">Fiscal Year Settings</p>
            <p className="mt-1 text-xs text-green-700">
              Dashboard and report YTD calculations can use this offset when Fiscal Year mode is enabled in the top bar.
            </p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fiscal Year Start</label>
                <select
                  value={form.fiscalYearStart}
                  onChange={(e) => set("fiscalYearStart", parseInt(e.target.value, 10))}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Fiscal Year End</label>
                <select
                  value={form.fiscalYearEnd || getFiscalYearEndMonth(form.fiscalYearStart)}
                  disabled
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-gray-50 text-gray-600"
                >
                  {MONTHS.map((m, i) => (
                    <option key={i + 1} value={i + 1}>{m}</option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-gray-500">End month is calculated from the 12-month fiscal-year start.</p>
              </div>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Currency</label>
            <select
              value={form.currency}
              onChange={(e) => set("currency", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Timezone</label>
            <select
              value={form.timezone}
              onChange={(e) => set("timezone", e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {TIMEZONES.map((t) => <option key={t} value={t}>{t.replace("_", " ")}</option>)}
            </select>
          </div>
        </div>

        {/* Email Provider */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">Email Provider</h2>
          <p className="text-xs text-gray-500">
            Choose the outbound provider for DonorCRM communications. Microsoft Graph supports OAuth connect, callback token exchange, and refresh-backed provider testing.
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Provider</label>
            <select
              value={providerForm.provider}
              onChange={(e) => setProvider("provider", e.target.value as EmailProviderType)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              <option value="standard_smtp">Standard SMTP</option>
              <option value="microsoft_365_smtp">Microsoft 365 SMTP</option>
              <option value="microsoft_graph">Microsoft Graph</option>
            </select>
          </div>

          {providerForm.provider === "microsoft_365_smtp" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-blue-800">Microsoft 365 SMTP Overrides</p>
              <p className="text-xs text-blue-700">
                Defaults are smtp.office365.com:587 with STARTTLS. Override only when your organization requires custom values.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">SMTP Host Override</label>
                  <input
                    value={providerForm.smtpHostOverride}
                    onChange={(e) => setProvider("smtpHostOverride", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="smtp.office365.com"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">SMTP Port Override</label>
                  <input
                    type="number"
                    value={providerForm.smtpPortOverride}
                    onChange={(e) => setProvider("smtpPortOverride", Number(e.target.value) || 587)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
                <label className="inline-flex items-center gap-2 text-sm text-gray-700 mt-6">
                  <input
                    type="checkbox"
                    checked={providerForm.smtpSecureOverride}
                    onChange={(e) => setProvider("smtpSecureOverride", e.target.checked)}
                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Force SMTPS secure mode
                </label>
              </div>
            </div>
          )}

          {providerForm.provider === "microsoft_graph" && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 space-y-3">
              <p className="text-xs font-semibold text-blue-800">Microsoft Graph Configuration</p>
              <p className="text-xs text-blue-700">
                Configure Graph app credentials, then connect OAuth to activate token-backed sending.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Tenant ID</label>
                  <input
                    value={providerForm.microsoftTenantId}
                    onChange={(e) => setProvider("microsoftTenantId", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Client ID</label>
                  <input
                    value={providerForm.microsoftClientId}
                    onChange={(e) => setProvider("microsoftClientId", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Client Secret</label>
                  <input
                    type="password"
                    value={microsoftClientSecretInput}
                    onChange={(e) => setMicrosoftClientSecretInput(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder={providerForm.microsoftClientSecretConfigured ? "Configured (enter to replace)" : "Enter secret"}
                  />
                  <p className="text-[11px] text-gray-500 mt-1">Secret is not returned by API responses. Enter only when rotating.</p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Mailbox</label>
                  <input
                    value={providerForm.microsoftMailbox}
                    onChange={(e) => setProvider("microsoftMailbox", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="fundraising@organization.org"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Redirect URI</label>
                  <input
                    value={providerForm.microsoftRedirectUri}
                    onChange={(e) => setProvider("microsoftRedirectUri", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="http://localhost:4000/api/settings/email/provider/microsoft/callback"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Scopes</label>
                  <input
                    value={providerForm.microsoftScope}
                    onChange={(e) => setProvider("microsoftScope", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Mail.Send offline_access User.Read"
                  />
                </div>
              </div>
              <p className="text-xs text-gray-600">
                Graph connected state: <span className="font-semibold">{providerForm.graphConnected ? "Connected" : "Not connected"}</span>
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGraphConnect}
                  disabled={graphConnecting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-60 transition-colors"
                >
                  {graphConnecting ? "Connecting..." : providerForm.graphConnected ? "Reconnect Graph OAuth" : "Connect Graph OAuth"}
                </button>
                <button
                  type="button"
                  onClick={handleGraphDisconnect}
                  disabled={graphDisconnecting || !providerForm.graphConnected}
                  className="px-4 py-2 text-xs font-semibold text-blue-700 border border-blue-300 bg-white rounded-lg hover:bg-blue-100 disabled:opacity-60 transition-colors"
                >
                  {graphDisconnecting ? "Disconnecting..." : "Disconnect Graph"}
                </button>
              </div>
            </div>
          )}

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">Provider Test</p>
            <p className="text-xs text-gray-500">Runs provider-specific transport checks and sends one test message to the recipient.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="email"
                value={smtpTestRecipient}
                onChange={(e) => setSmtpTestRecipient(e.target.value)}
                className="w-full sm:max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="you@organization.org"
              />
              <button
                type="button"
                disabled={providerTesting || !smtpTestRecipient.trim()}
                onClick={handleProviderTestSend}
                className="px-4 py-2 text-sm font-medium text-blue-700 border border-blue-200 bg-blue-50 rounded-lg hover:bg-blue-100 disabled:opacity-60 transition-colors"
              >
                {providerTesting ? "Testing Provider..." : "Run Provider Test"}
              </button>
            </div>
            {providerTestMessage && (
              <p className="text-xs text-green-700">{providerTestMessage}</p>
            )}
            {providerTestError && (
              <p className="text-xs text-red-700">{providerTestError}</p>
            )}
          </div>
        </div>

        {/* SMTP Settings */}
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h2 className="text-sm font-semibold text-gray-900 border-b border-gray-100 pb-2">SMTP Email Settings</h2>
          <p className="text-xs text-gray-500">
            Used for sending campaigns from the Communications module.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">SMTP Host</label>
              <input
                value={form.smtpHost}
                onChange={(e) => set("smtpHost", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="smtp.mailtrap.io"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">SMTP Port</label>
              <input
                type="number"
                value={form.smtpPort}
                onChange={(e) => set("smtpPort", Number(e.target.value))}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">SMTP Username</label>
              <input
                value={form.smtpUser}
                onChange={(e) => set("smtpUser", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="user"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">SMTP Password</label>
              <input
                type="password"
                value={form.smtpPass}
                onChange={(e) => set("smtpPass", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="••••••••"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">From Name</label>
              <input
                value={form.smtpFromName}
                onChange={(e) => set("smtpFromName", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Hope Community Foundation"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">From Email</label>
              <input
                type="email"
                value={form.smtpFromEmail}
                onChange={(e) => set("smtpFromEmail", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="giving@hopecommunity.org"
              />
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.smtpSecure}
              onChange={(e) => set("smtpSecure", e.target.checked)}
              className="rounded border-gray-300 text-green-600 focus:ring-green-500"
            />
            Use secure TLS/SSL transport
          </label>

          <div className="border-t border-gray-100 pt-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">Send Test Email</p>
            <p className="text-xs text-gray-500">Uses the SMTP values currently in this form, even before saving.</p>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                type="email"
                value={smtpTestRecipient}
                onChange={(e) => setSmtpTestRecipient(e.target.value)}
                className="w-full sm:max-w-sm px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="you@organization.org"
              />
              <button
                type="button"
                disabled={smtpTesting || !smtpTestRecipient.trim()}
                onClick={handleSmtpTestSend}
                className="px-4 py-2 text-sm font-medium text-green-700 border border-green-200 bg-green-50 rounded-lg hover:bg-green-100 disabled:opacity-60 transition-colors"
              >
                {smtpTesting ? "Sending Test..." : "Send SMTP Test"}
              </button>
            </div>
            {smtpTestMessage && (
              <p className="text-xs text-green-700">{smtpTestMessage}</p>
            )}
            {smtpTestError && (
              <p className="text-xs text-red-700">{smtpTestError}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-60 transition-colors"
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}
