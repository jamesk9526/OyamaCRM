/** Security settings page surfaces auth hardening work plus destructive recovery controls. */
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AuditLogViewer from "@/app/components/settings/AuditLogViewer";
import SettingsResetPanel from "@/app/components/settings/SettingsResetPanel";
import SettingsRecoveryPanel from "@/app/components/settings/SettingsRecoveryPanel";
import { apiFetch } from "@/app/lib/auth-client";

interface AuthSecuritySettings {
  emailMfaEnabled: boolean;
  passwordResetEnabled: boolean;
  mfaCodeTtlMinutes: number;
  passwordResetTtlMinutes: number;
}

const DEFAULT_AUTH_SECURITY: AuthSecuritySettings = {
  emailMfaEnabled: false,
  passwordResetEnabled: true,
  mfaCodeTtlMinutes: 10,
  passwordResetTtlMinutes: 30,
};

/** SecuritySettingsPage defines the security tab backlog and the verified reset flow. */
export default function SecuritySettingsPage() {
  const [authSecurity, setAuthSecurity] = useState<AuthSecuritySettings>(DEFAULT_AUTH_SECURITY);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const requestId = useRef(0);

  /** A failed read must never make the initial defaults writable. */
  const loadAuthSecurity = useCallback(async () => {
      const current = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const payload = await apiFetch<AuthSecuritySettings>("/api/settings/security/auth");
        if (current !== requestId.current) return;
        setAuthSecurity({ ...DEFAULT_AUTH_SECURITY, ...payload });
        setLoaded(true);
      } catch (requestError) {
        if (current === requestId.current) {
          setLoaded(false);
          setError(requestError instanceof Error ? requestError.message : "Failed to load auth security settings.");
        }
      } finally {
        if (current === requestId.current) setLoading(false);
      }
  }, []);
  const cancelLoad = useCallback(() => { requestId.current++; }, []);
  useEffect(() => {
    void loadAuthSecurity();
    return cancelLoad;
  }, [loadAuthSecurity, cancelLoad]);

  /** Updates one auth security field while clearing stale status messages. */
  function setField<K extends keyof AuthSecuritySettings>(key: K, value: AuthSecuritySettings[K]) {
    setAuthSecurity((current) => ({ ...current, [key]: value }));
    setSaved(false);
    setError(null);
  }

  /** Persists auth security settings and surfaces confirmation state. */
  async function saveAuthSecurity() {
    if (!loaded || loading || saving) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const payload = await apiFetch<AuthSecuritySettings>("/api/settings/security/auth", {
        method: "PUT",
        body: JSON.stringify(authSecurity),
      });
      setAuthSecurity({ ...DEFAULT_AUTH_SECURITY, ...payload });
      setSaved(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to save auth security settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Security &amp; Audit</h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Control authentication policies, destructive recovery behavior, and organization audit visibility in one workspace.
        </p>
      </div>

      <section className="max-w-3xl rounded-lg border border-gray-200 bg-white p-6 space-y-3">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-sm font-semibold text-gray-900">Authentication Policy</h2>
          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-1 text-xs font-medium text-green-700">
            Live
          </span>
        </div>

        {loading ? (
          <p role="status" className="text-sm text-gray-500">Loading security policy...</p>
        ) : (
          <div className="space-y-4">
            {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><p>{error}</p>{!loaded && <button type="button" onClick={() => void loadAuthSecurity()} className="mt-2 font-semibold underline">Retry loading authentication policy</button>}</div>}
            <fieldset disabled={!loaded || saving} className="space-y-4 disabled:opacity-60">
            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={authSecurity.emailMfaEnabled}
                onChange={(event) => setField("emailMfaEnabled", event.target.checked)}
                className="mt-0.5 rounded border-gray-300"
              />
              <span>Require email-based MFA (2-step verification) at login.</span>
            </label>

            <label className="flex items-start gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={authSecurity.passwordResetEnabled}
                onChange={(event) => setField("passwordResetEnabled", event.target.checked)}
                className="mt-0.5 rounded border-gray-300"
              />
              <span>Allow forgot-password email reset flow.</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm text-gray-700">
                <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">MFA code TTL (minutes)</span>
                <input
                  type="number"
                  min={3}
                  max={30}
                  value={authSecurity.mfaCodeTtlMinutes}
                  onChange={(event) => setField("mfaCodeTtlMinutes", Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="space-y-1 text-sm text-gray-700">
                <span className="block text-xs font-semibold uppercase tracking-wide text-gray-500">Reset token TTL (minutes)</span>
                <input
                  type="number"
                  min={10}
                  max={120}
                  value={authSecurity.passwordResetTtlMinutes}
                  onChange={(event) => setField("passwordResetTtlMinutes", Number(event.target.value))}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {saved && <p role="status" className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">Authentication policy saved.</p>}

            <div className="flex justify-end">
              <button
                type="button"
                disabled={!loaded || loading || saving}
                onClick={() => void saveAuthSecurity()}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Auth Policy"}
              </button>
            </div>
            </fieldset>
          </div>
        )}
      </section>

      <div className="max-w-3xl">
        <SettingsResetPanel />
      </div>

      {/* Recovery snapshots — restore from pre-reset backups */}
      <div className="max-w-3xl">
        <SettingsRecoveryPanel />
      </div>

      <section id="audit-logs" className="rounded-lg border border-gray-200 bg-white p-5">
        <AuditLogViewer />
      </section>
    </div>
  );
}

