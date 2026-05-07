/**
 * Settings page.
 * Organization settings form wired to GET/PUT /api/settings.
 * Sections: Organization Info and Regional Settings.
 */
"use client";

import { useState, useEffect } from "react";

const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

/** Settings shape from GET /api/settings */
interface Settings {
  orgName: string;
  fiscalYearStart: number;
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

/** Settings page — org settings form with save */
export default function SettingsPage() {
  const [form, setForm] = useState<Settings>({
    orgName: "",
    fiscalYearStart: 1,
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

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/api/settings`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: Settings = await res.json();
        setForm(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  /** Update a field in the form state */
  function set<K extends keyof Settings>(key: K, value: Settings[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSuccess(false);
  }

  /** Save settings via PUT /api/settings */
  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const res = await fetch(`${API}/api/settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
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
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-0.5">Organization profile and regional configuration</p>
      </div>

      {error && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {error} — ensure the API server is running with <code className="bg-amber-100 px-1 rounded">pnpm start:server</code>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 font-medium">
          ✓ Settings saved successfully.
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
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Fiscal Year Start</label>
            <select
              value={form.fiscalYearStart}
              onChange={(e) => set("fiscalYearStart", parseInt(e.target.value))}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-green-500"
            >
              {MONTHS.map((m, i) => (
                <option key={i + 1} value={i + 1}>{m}</option>
              ))}
            </select>
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
