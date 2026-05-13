/** Operational settings and readiness notes for letters workflow lanes. */
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/app/lib/auth-client";
import LettersWorkspaceNav from "@/app/components/letters/LettersWorkspaceNav";

interface LettersWorkflowSettings {
  autoQueueBatchToPrint: boolean;
  requirePrintApproval: boolean;
  defaultPriority: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  mailingSlaDays: number;
  allowDirectMailQueue: boolean;
  enableAddressValidationGate: boolean;
  pdfFallbackMode: "BROWSER_PRINT" | "SERVER_RENDER";
  notes: string;
}

const DEFAULT_SETTINGS: LettersWorkflowSettings = {
  autoQueueBatchToPrint: true,
  requirePrintApproval: true,
  defaultPriority: "NORMAL",
  mailingSlaDays: 7,
  allowDirectMailQueue: false,
  enableAddressValidationGate: true,
  pdfFallbackMode: "BROWSER_PRINT",
  notes: "",
};

/** Displays letters workspace operational guidance and current implementation boundaries. */
export default function LetterWorkflowSettingsPage() {
  const [settings, setSettings] = useState<LettersWorkflowSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<LettersWorkflowSettings>("/api/letters/workflow-settings");
      setSettings({ ...DEFAULT_SETTINGS, ...payload });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load workflow settings.");
      setSettings(DEFAULT_SETTINGS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  /** Updates one settings field while clearing stale status flags. */
  function setField<K extends keyof LettersWorkflowSettings>(key: K, value: LettersWorkflowSettings[K]) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  }

  /** Persists letters workflow policy values. */
  async function saveSettings() {
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload = await apiFetch<LettersWorkflowSettings>("/api/letters/workflow-settings", {
        method: "PUT",
        body: JSON.stringify(settings),
      });
      setSettings({ ...DEFAULT_SETTINGS, ...payload });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save workflow settings.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-8 w-60 animate-pulse rounded bg-gray-200" />
        <div className="h-32 animate-pulse rounded-xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Letters Workflow Settings</h1>
        <p className="mt-0.5 text-sm text-gray-500">Configure operations guidance for review, print, mail, and output workflows.</p>
      </div>

      <LettersWorkspaceNav />

      {error && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </section>
      )}

      {saved && (
        <section className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-700">
          Workflow settings saved.
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-4 space-y-3">
        <h2 className="text-sm font-semibold text-gray-900">Current Workflow Defaults</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.autoQueueBatchToPrint}
              onChange={(event) => setField("autoQueueBatchToPrint", event.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            <span>Auto queue newly generated batch letters for print.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.requirePrintApproval}
              onChange={(event) => setField("requirePrintApproval", event.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            <span>Require explicit review approval before queue-for-print.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.allowDirectMailQueue}
              onChange={(event) => setField("allowDirectMailQueue", event.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            <span>Allow direct mail queue handoff without printed status enforcement.</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={settings.enableAddressValidationGate}
              onChange={(event) => setField("enableAddressValidationGate", event.target.checked)}
              className="mt-0.5 rounded border-gray-300"
            />
            <span>Enforce address completeness gate before queueing for mail.</span>
          </label>
          <label className="space-y-1 text-sm text-gray-700">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Default Priority</span>
            <select
              value={settings.defaultPriority}
              onChange={(event) => setField("defaultPriority", event.target.value as LettersWorkflowSettings["defaultPriority"])}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="LOW">Low</option>
              <option value="NORMAL">Normal</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-gray-700">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Mailing SLA (days)</span>
            <input
              type="number"
              min={1}
              max={30}
              value={settings.mailingSlaDays}
              onChange={(event) => setField("mailingSlaDays", Number(event.target.value))}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">PDF Fallback Mode</span>
            <select
              value={settings.pdfFallbackMode}
              onChange={(event) => setField("pdfFallbackMode", event.target.value as LettersWorkflowSettings["pdfFallbackMode"])}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
            >
              <option value="BROWSER_PRINT">Browser Print / Print-to-PDF (recommended)</option>
              <option value="SERVER_RENDER">Server Render (experimental)</option>
            </select>
          </label>
          <label className="space-y-1 text-sm text-gray-700 md:col-span-2">
            <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Operational Notes</span>
            <textarea
              rows={3}
              value={settings.notes}
              onChange={(event) => setField("notes", event.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="Optional notes for print/mail team handoff policy."
            />
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            disabled={saving}
            onClick={() => void saveSettings()}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save Workflow Settings"}
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700">In Development Notice</p>
        <p className="mt-1 text-sm text-amber-900">
          Server-side PDF rendering remains Partially Working. Browser print and print-to-PDF are still the supported production path.
        </p>
      </section>

      <section className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">Persistence</p>
        <p className="mt-1 text-sm text-blue-900">Workflow policy settings now persist through API and can be reused by queue automation lanes.</p>
      </section>
    </div>
  );
}
