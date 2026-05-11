// Connection-status display for site embed diagnostics, ping recency, and test execution feedback.
"use client";

import type { SiteEmbedSiteConfig } from "@/app/components/settings/site-embeds/site-embed-types";

interface ConnectionStatusPanelProps {
  /** Selected site configuration with latest status metadata. */
  site: SiteEmbedSiteConfig;
  /** True while the backend connection test request is running. */
  testingConnection: boolean;
  /** Triggers the backend connection-test workflow for selected site. */
  onTestConnection: () => void;
}

/**
 * ConnectionStatusPanel summarizes loader ping state and test results for embed troubleshooting.
 * It helps admins verify installs before sharing snippets with web developers.
 */
export default function ConnectionStatusPanel({ site, testingConnection, onTestConnection }: ConnectionStatusPanelProps) {
  const lastPing = site.lastSuccessfulScriptLoad;
  const lastTest = site.lastConnectionTestResult;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-gray-900">Connection Status</h2>
          <p className="mt-1 text-xs text-gray-500">
            Use this panel to verify script delivery, domain allow-list matches, and widget runtime health.
          </p>
        </div>

        <button
          type="button"
          onClick={onTestConnection}
          disabled={testingConnection}
          className="rounded-lg border border-green-300 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-800 hover:bg-green-100 disabled:opacity-60"
        >
          {testingConnection ? "Testing..." : "Test Connection"}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          <p className="font-semibold text-gray-800">Last Script Ping</p>
          <p className="mt-1">{lastPing ? new Date(lastPing.loadedAt).toLocaleString() : "No ping received yet"}</p>
          <p className="mt-1">Domain: {lastPing?.domain || "-"}</p>
          <p className="mt-1">Reason: {lastPing?.reason || "-"}</p>
        </article>

        <article className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
          <p className="font-semibold text-gray-800">Last Connection Test</p>
          <p className="mt-1">
            Status: {lastTest ? (lastTest.ok ? "Healthy" : "Needs attention") : "Not tested"}
          </p>
          <p className="mt-1">Checked: {lastTest ? new Date(lastTest.checkedAt).toLocaleString() : "-"}</p>
          <p className="mt-1">Observed domain: {lastTest?.observedDomain || "-"}</p>
        </article>
      </div>

      {lastTest?.message ? (
        <p className={`rounded-lg border px-3 py-2 text-xs ${lastTest.ok ? "border-green-200 bg-green-50 text-green-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
          {lastTest.message}
        </p>
      ) : null}

      {lastTest?.issues && lastTest.issues.length > 0 ? (
        <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {lastTest.issues.map((issue) => (
            <li key={issue}>- {issue}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
