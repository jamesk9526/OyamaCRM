// Persisted HRM settings workspace for module governance controls.
"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchHrmSettings, updateHrmSettings } from "@/app/lib/hrm/api";
import type { HrmSettingsResponse } from "@/app/lib/hrm/types";

interface SettingsFormState {
  defaultTimezone: string;
  defaultLocationId: string;
  allowCompassionAssignmentSync: boolean;
  requireSchedulableFlag: boolean;
  messageDigestEnabled: boolean;
}

/** Builds editable form state from one persisted settings response payload. */
function formFromSettings(response: HrmSettingsResponse): SettingsFormState {
  return {
    defaultTimezone: response.item.defaultTimezone,
    defaultLocationId: response.item.defaultLocationId ?? "",
    allowCompassionAssignmentSync: response.item.allowCompassionAssignmentSync,
    requireSchedulableFlag: response.item.requireSchedulableFlag,
    messageDigestEnabled: response.item.messageDigestEnabled,
  };
}

/** HrmSettingsPage renders persisted HRM module settings and saves policy updates. */
export default function HrmSettingsPage() {
  const [data, setData] = useState<HrmSettingsResponse | null>(null);
  const [form, setForm] = useState<SettingsFormState>({
    defaultTimezone: "America/Chicago",
    defaultLocationId: "",
    allowCompassionAssignmentSync: true,
    requireSchedulableFlag: true,
    messageDigestEnabled: false,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  /** Loads persisted HRM settings and available location options from backend APIs. */
  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetchHrmSettings();
      setData(response);
      setForm(formFromSettings(response));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load HRM settings.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  /** Persists HRM settings changes to the backend. */
  async function saveSettings(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await updateHrmSettings({
        defaultTimezone: form.defaultTimezone.trim() || "America/Chicago",
        defaultLocationId: form.defaultLocationId || null,
        allowCompassionAssignmentSync: form.allowCompassionAssignmentSync,
        requireSchedulableFlag: form.requireSchedulableFlag,
        messageDigestEnabled: form.messageDigestEnabled,
      });

      setSuccess("HRM settings updated.");
      await loadSettings();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to update HRM settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-4">
      <header className="rounded-2xl border border-teal-200 bg-gradient-to-r from-teal-50 via-white to-cyan-50 p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">HRM Settings</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-900">Module Governance And Defaults</h1>
            <p className="mt-2 text-sm text-slate-600 max-w-3xl">
              Configure timezone defaults, default assignment location, and safeguards that control how HRM data participates in scheduling workflows.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void loadSettings()}
            className="rounded-lg border border-teal-200 bg-white px-3 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"
          >
            Refresh
          </button>
        </div>
      </header>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Default Timezone</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{loading ? "Loading..." : data?.item.defaultTimezone || "-"}</p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Default Location</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {loading ? "Loading..." : data?.locationOptions.find((location) => location.id === data.item.defaultLocationId)?.name || "Not set"}
          </p>
        </article>
        <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
          <p className="text-xs uppercase tracking-wide text-gray-500">Message Digest</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">
            {loading ? "Loading..." : data?.item.messageDigestEnabled ? "Enabled" : "Disabled"}
          </p>
        </article>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
        <h2 className="text-sm font-semibold text-slate-900">Edit HRM Settings</h2>

        <form onSubmit={saveSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Default Timezone</label>
              <input
                value={form.defaultTimezone}
                onChange={(event) => setForm((current) => ({ ...current, defaultTimezone: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Default Location</label>
              <select
                value={form.defaultLocationId}
                onChange={(event) => setForm((current) => ({ ...current, defaultLocationId: event.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">No default location</option>
                {(data?.locationOptions ?? []).map((location) => (
                  <option key={location.id} value={location.id}>{location.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-2">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.allowCompassionAssignmentSync}
                onChange={(event) => setForm((current) => ({ ...current, allowCompassionAssignmentSync: event.target.checked }))}
                className="rounded border-gray-300"
              />
              Allow Compassion assignment sync
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.requireSchedulableFlag}
                onChange={(event) => setForm((current) => ({ ...current, requireSchedulableFlag: event.target.checked }))}
                className="rounded border-gray-300"
              />
              Require schedulable flag for assignment workflows
            </label>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.messageDigestEnabled}
                onChange={(event) => setForm((current) => ({ ...current, messageDigestEnabled: event.target.checked }))}
                className="rounded border-gray-300"
              />
              Enable internal message digest delivery
            </label>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      </section>
    </section>
  );
}
