// Database and environment configuration controls for Watchdog with typed confirmation.
"use client";

import { useMemo, useState } from "react";
import type { WatchdogDatabaseConfigResponse } from "@/app/components/watchdog/ops/types";

interface Props {
  configPayload: WatchdogDatabaseConfigResponse | null;
  busy: boolean;
  onSave: (payload: {
    confirmationText: string;
    databaseUrl?: string;
    watchdogDatabaseUrl?: string;
    watchdogEncryptionKey?: string;
    jwtSecret?: string;
    nextPublicApiUrl?: string;
  }) => Promise<void>;
}

/** Renders guarded database/env update controls that require typed confirmation before save. */
export default function WatchdogDatabaseSettingsCard({ configPayload, busy, onSave }: Props) {
  const [databaseUrl, setDatabaseUrl] = useState("");
  const [watchdogDatabaseUrl, setWatchdogDatabaseUrl] = useState("");
  const [watchdogEncryptionKey, setWatchdogEncryptionKey] = useState("");
  const [jwtSecret, setJwtSecret] = useState("");
  const [nextPublicApiUrl, setNextPublicApiUrl] = useState("");
  const [confirmationText, setConfirmationText] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const requiredText = configPayload?.confirmationText ?? "I UNDERSTAND THIS WILL CHANGE DATABASE SETTINGS";
  const confirmationMatched = confirmationText.trim() === requiredText;
  const hasInput = useMemo(
    () =>
      [databaseUrl, watchdogDatabaseUrl, watchdogEncryptionKey, jwtSecret, nextPublicApiUrl].some((value) => value.trim().length > 0),
    [databaseUrl, watchdogDatabaseUrl, watchdogEncryptionKey, jwtSecret, nextPublicApiUrl],
  );

  async function submitConfirmed() {
    await onSave({
      confirmationText,
      databaseUrl,
      watchdogDatabaseUrl,
      watchdogEncryptionKey,
      jwtSecret,
      nextPublicApiUrl,
    });

    setConfirmationText("");
    setDatabaseUrl("");
    setWatchdogDatabaseUrl("");
    setWatchdogEncryptionKey("");
    setJwtSecret("");
    setNextPublicApiUrl("");
    setShowConfirmModal(false);
  }

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <h2 className="text-sm font-semibold text-slate-900">Database Settings</h2>
      <p className="mt-1 text-sm text-slate-700">
        Add or change database and core environment values for Watchdog operations. Sensitive values are never returned after save.
      </p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p>Primary DB configured: {configPayload?.config.databaseUrlConfigured ? "yes" : "no"}</p>
          <p>Watchdog DB configured: {configPayload?.config.watchdogDatabaseConfigured ? "yes" : "no"}</p>
          <p>Watchdog DB value: {configPayload?.config.watchdogDatabaseUrlMasked ?? "not set"}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <p>Watchdog DB connected: {configPayload?.watchdogHealth.connected ? "yes" : "no"}</p>
          <p>Encryption key loaded: {configPayload?.config.watchdogEncryptionConfigured ? "yes" : "no"}</p>
          <p>JWT secret configured: {configPayload?.config.jwtSecretConfigured ? "yes" : "no"}</p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm text-slate-700">
          Primary Database URL
          <input
            value={databaseUrl}
            onChange={(event) => setDatabaseUrl(event.target.value)}
            placeholder="mysql://user:pass@host:3306/oyamacrm"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
        </label>
        <label className="text-sm text-slate-700">
          Watchdog Database URL
          <input
            value={watchdogDatabaseUrl}
            onChange={(event) => setWatchdogDatabaseUrl(event.target.value)}
            placeholder="mysql://user:pass@host:3306/oyama_watchdog"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
        </label>
        <label className="text-sm text-slate-700">
          Watchdog Encryption Key
          <input
            type="password"
            value={watchdogEncryptionKey}
            onChange={(event) => setWatchdogEncryptionKey(event.target.value)}
            placeholder="hex or passphrase"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
        </label>
        <label className="text-sm text-slate-700">
          JWT Secret
          <input
            type="password"
            value={jwtSecret}
            onChange={(event) => setJwtSecret(event.target.value)}
            placeholder="long-random-secret"
            className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
          />
        </label>
      </div>

      <label className="mt-3 block text-sm text-slate-700">
        NEXT_PUBLIC_API_URL
        <input
          value={nextPublicApiUrl}
          onChange={(event) => setNextPublicApiUrl(event.target.value)}
          placeholder="http://localhost:4000"
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
        />
      </label>

      <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
        Confirm this operation by typing the exact phrase below. Database and auth URL changes may require a service restart to fully apply.
      </div>

      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <p>{configPayload?.warnings.environmentMessage}</p>
        <p className="mt-1">{configPayload?.warnings.permissionMessage}</p>
      </div>

      <label className="mt-3 block text-sm text-slate-700">
        Confirmation phrase
        <input
          value={confirmationText}
          onChange={(event) => setConfirmationText(event.target.value)}
          placeholder={requiredText}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-xs"
        />
      </label>
      <p className="mt-1 text-xs text-slate-600">Required: {requiredText}</p>

      <button
        type="button"
        onClick={() => setShowConfirmModal(true)}
        disabled={busy || !hasInput || !confirmationMatched}
        className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? "Saving..." : "Save Database Settings"}
      </button>

      {showConfirmModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4">
          <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-5 shadow-2xl">
            <h3 className="text-base font-semibold text-slate-900">Are you sure?</h3>
            <p className="mt-2 text-sm text-slate-700">
              This will update database/environment settings. If you are in production, confirm you have a rollback plan before continuing.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-4 text-xs text-slate-600">
              <li>Changed values are written to .env on the server.</li>
              <li>Watchdog DB connection values are reloaded immediately.</li>
              <li>Primary database/auth/web URL changes may still require a service restart.</li>
            </ul>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  void submitConfirmed();
                }}
                disabled={busy}
                className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Yes, update settings
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </article>
  );
}
