"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";

interface CommunicationSettings {
  smtpFromName: string;
  smtpFromEmail: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecure: boolean;
  smtpUser: string;
}

export default function CommunicationsSettingsPanel() {
  const [settings, setSettings] = useState<CommunicationSettings>({
    smtpFromName: "",
    smtpFromEmail: "",
    smtpHost: "",
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<{
        smtpFromName?: string;
        smtpFromEmail?: string;
        smtpHost?: string;
        smtpPort?: number;
        smtpSecure?: boolean;
        smtpUser?: string;
      }>("/api/settings");

      setSettings({
        smtpFromName: payload.smtpFromName ?? "",
        smtpFromEmail: payload.smtpFromEmail ?? "",
        smtpHost: payload.smtpHost ?? "",
        smtpPort: payload.smtpPort ?? 587,
        smtpSecure: Boolean(payload.smtpSecure),
        smtpUser: payload.smtpUser ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load communication settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  async function save() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await apiFetch("/api/settings", {
        method: "PUT",
        body: JSON.stringify({
          smtpFromName: settings.smtpFromName,
          smtpFromEmail: settings.smtpFromEmail,
          smtpHost: settings.smtpHost,
          smtpPort: settings.smtpPort,
          smtpSecure: settings.smtpSecure,
          smtpUser: settings.smtpUser,
        }),
      });
      setMessage("Communication settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save communication settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="text-sm font-semibold text-gray-900">Communication Settings</h2>
      <p className="mt-1 text-xs text-gray-500">Manage default sender and SMTP transport details used by campaign sends.</p>

      {loading ? (
        <p className="mt-3 text-sm text-gray-500">Loading settings...</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-1">
            <span className="text-xs font-medium text-gray-700">From name</span>
            <input
              type="text"
              value={settings.smtpFromName}
              onChange={(event) => setSettings((prev) => ({ ...prev, smtpFromName: event.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium text-gray-700">From email</span>
            <input
              type="email"
              value={settings.smtpFromEmail}
              onChange={(event) => setSettings((prev) => ({ ...prev, smtpFromEmail: event.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium text-gray-700">SMTP host</span>
            <input
              type="text"
              value={settings.smtpHost}
              onChange={(event) => setSettings((prev) => ({ ...prev, smtpHost: event.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium text-gray-700">SMTP user</span>
            <input
              type="text"
              value={settings.smtpUser}
              onChange={(event) => setSettings((prev) => ({ ...prev, smtpUser: event.target.value }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="block sm:col-span-1">
            <span className="text-xs font-medium text-gray-700">SMTP port</span>
            <input
              type="number"
              value={settings.smtpPort}
              onChange={(event) => setSettings((prev) => ({ ...prev, smtpPort: Number(event.target.value) || 587 }))}
              className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="mt-6 inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.smtpSecure}
              onChange={(event) => setSettings((prev) => ({ ...prev, smtpSecure: event.target.checked }))}
              className="h-4 w-4 rounded border-gray-300"
            />
            Use secure SMTP connection
          </label>
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void save()}
          disabled={loading || saving}
          className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      {message && <p className="mt-3 text-xs text-green-700">{message}</p>}
      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </section>
  );
}
